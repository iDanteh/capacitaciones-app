import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { CertificateResponseDto, VerifyCertificateDto } from './dto/certificate-response.dto';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit') as typeof import('pdfkit');

/**
 * CertificatesService
 *
 * Responsabilidades:
 *  1. Generar un certificado cuando el enrollment se completa al 100% (llamado desde EnrollmentsService).
 *  2. Permitir la descarga del PDF al usuario autenticado.
 *  3. Verificación pública por UUID (endpoint sin autenticación).
 *
 * El PDF se genera en memoria (sin disco) — Buffer devuelto directamente al controller.
 * El certificado se almacena solo los metadatos en BD; el PDF se genera on-demand.
 */
@Injectable()
export class CertificatesService {
  private readonly logger = new Logger(CertificatesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // ── Generación (llamado desde EnrollmentsService) ─────────────────────────

  async generateCertificate(
    tenantId: string,
    userId: string,
    courseId: string,
    enrollmentId: string,
  ): Promise<CertificateResponseDto | null> {
    // Verificar que el plan tiene hasCertificates
    const subscription = await this.prisma.subscription.findUnique({
      where:   { tenantId },
      include: { plan: true, tenant: true },
    });

    if (!subscription?.plan?.hasCertificates) return null;

    // Evitar duplicados — si ya existe, devolver el existente
    const existing = await this.prisma.certificate.findFirst({
      where: { enrollmentId },
    });

    if (existing) {
      return CertificateResponseDto.from(existing, this.frontendBaseUrl());
    }

    // Obtener datos necesarios para el snapshot del certificado
    const [user, course] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.course.findUnique({ where: { id: courseId } }),
    ]);

    if (!user || !course) {
      throw new NotFoundException('Usuario o curso no encontrado');
    }

    const tenant = subscription.tenant;

    const certificate = await this.prisma.certificate.create({
      data: {
        tenantId,
        userId,
        courseId,
        enrollmentId,
        recipientName: `${user.firstName} ${user.lastName}`,
        courseTitle:   course.title,
        tenantName:    tenant.name,
      },
    });

    this.logger.log(
      `Certificado generado — usuario: ${userId}, curso: ${courseId}, uuid: ${certificate.publicUuid}`,
    );

    return CertificateResponseDto.from(certificate, this.frontendBaseUrl());
  }

  // ── Mis certificados ─────────────────────────────────────────────────────

  async getMyCertificates(tenantId: string, userId: string): Promise<CertificateResponseDto[]> {
    const certs = await this.prisma.certificate.findMany({
      where:   { tenantId, userId },
      orderBy: { issuedAt: 'desc' },
    });

    const base = this.frontendBaseUrl();
    return certs.map(c => CertificateResponseDto.from(c, base));
  }

  async getCertificateByCourse(
    tenantId: string,
    userId: string,
    courseId: string,
  ): Promise<CertificateResponseDto | null> {
    const cert = await this.prisma.certificate.findFirst({
      where: { tenantId, userId, courseId },
    });

    return cert ? CertificateResponseDto.from(cert, this.frontendBaseUrl()) : null;
  }

  // ── Verificación pública ─────────────────────────────────────────────────

  async verifyByUuid(uuid: string): Promise<VerifyCertificateDto> {
    const cert = await this.prisma.certificate.findUnique({
      where: { publicUuid: uuid },
    });

    if (!cert) {
      return {
        publicUuid:    uuid,
        recipientName: '',
        courseTitle:   '',
        tenantName:    '',
        issuedAt:      new Date(),
        isValid:       false,
      };
    }

    return {
      publicUuid:    cert.publicUuid,
      recipientName: cert.recipientName,
      courseTitle:   cert.courseTitle,
      tenantName:    cert.tenantName,
      issuedAt:      cert.issuedAt,
      isValid:       true,
    };
  }

  // ── Descarga PDF ─────────────────────────────────────────────────────────

  async downloadPdf(tenantId: string, userId: string, certificateId: string): Promise<Buffer> {
    const cert = await this.prisma.certificate.findFirst({
      where: { id: certificateId, tenantId, userId },
    });

    if (!cert) throw new NotFoundException('Certificado no encontrado');

    return this.buildPdf(cert);
  }

  async downloadPdfByUuid(uuid: string): Promise<Buffer> {
    const cert = await this.prisma.certificate.findUnique({
      where: { publicUuid: uuid },
    });

    if (!cert) throw new NotFoundException('Certificado no encontrado');

    return this.buildPdf(cert);
  }

  // ── Generación de PDF (pdfkit) ────────────────────────────────────────────

  /**
   * buildPdf — genera un certificado en formato A4 landscape.
   *
   * Diseño: fondo crema (#FAFAF4), marco dorado, logo textual "Capta",
   * nombres con tipografía grande, sello de verificación con UUID público.
   */
  private buildPdf(cert: {
    publicUuid:    string;
    recipientName: string;
    courseTitle:   string;
    tenantName:    string;
    issuedAt:      Date;
  }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];

      const doc = new PDFDocument({
        size:    'A4',
        layout:  'landscape',
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
      });

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const W = doc.page.width;   // 841.89
      const H = doc.page.height;  // 595.28

      // ── Fondo ──────────────────────────────────────────────────────────────
      doc.rect(0, 0, W, H).fill('#FAFAF4');

      // ── Marco exterior ─────────────────────────────────────────────────────
      const margin = 28;
      doc
        .rect(margin, margin, W - margin * 2, H - margin * 2)
        .lineWidth(2)
        .stroke('#1E4F7A');

      // ── Marco interior decorativo ──────────────────────────────────────────
      const inner = margin + 10;
      doc
        .rect(inner, inner, W - inner * 2, H - inner * 2)
        .lineWidth(0.5)
        .stroke('#8FC4E8');

      // ── Banda superior (header) ────────────────────────────────────────────
      doc.rect(0, 0, W, 90).fill('#1E4F7A');

      // ── Nombre de la plataforma ────────────────────────────────────────────
      doc
        .fillColor('#FFFFFF')
        .font('Helvetica-Bold')
        .fontSize(28)
        .text('CAPTA', 0, 24, { align: 'center', width: W });

      doc
        .fillColor('#8FC4E8')
        .font('Helvetica')
        .fontSize(11)
        .text('Plataforma de Capacitación Empresarial', 0, 57, { align: 'center', width: W });

      // ── Título del certificado ─────────────────────────────────────────────
      doc
        .fillColor('#0B1F2A')
        .font('Helvetica-Bold')
        .fontSize(13)
        .text('CERTIFICADO DE FINALIZACIÓN', 0, 108, {
          align:       'center',
          width:       W,
          characterSpacing: 3,
        });

      // ── Línea decorativa ───────────────────────────────────────────────────
      const lineY = 132;
      const lineX = W / 2 - 120;
      doc
        .moveTo(lineX, lineY)
        .lineTo(lineX + 240, lineY)
        .lineWidth(1)
        .stroke('#1E4F7A');

      // ── "Se certifica que" ─────────────────────────────────────────────────
      doc
        .fillColor('#4B6478')
        .font('Helvetica')
        .fontSize(12)
        .text('Se certifica que', 0, 152, { align: 'center', width: W });

      // ── Nombre del participante ────────────────────────────────────────────
      doc
        .fillColor('#0B1F2A')
        .font('Helvetica-Bold')
        .fontSize(32)
        .text(cert.recipientName, 0, 172, { align: 'center', width: W });

      // ── Línea bajo nombre ──────────────────────────────────────────────────
      const nameLineY = 215;
      const nameLine  = W / 2 - 160;
      doc
        .moveTo(nameLine, nameLineY)
        .lineTo(nameLine + 320, nameLineY)
        .lineWidth(0.75)
        .stroke('#8FC4E8');

      // ── "ha completado satisfactoriamente el curso" ────────────────────────
      doc
        .fillColor('#4B6478')
        .font('Helvetica')
        .fontSize(12)
        .text('ha completado satisfactoriamente el curso', 0, 228, {
          align: 'center',
          width: W,
        });

      // ── Título del curso ───────────────────────────────────────────────────
      doc
        .fillColor('#1E4F7A')
        .font('Helvetica-Bold')
        .fontSize(20)
        .text(`"${cert.courseTitle}"`, 60, 252, {
          align: 'center',
          width: W - 120,
        });

      // ── Empresa ────────────────────────────────────────────────────────────
      doc
        .fillColor('#4B6478')
        .font('Helvetica')
        .fontSize(11)
        .text(`Organización: ${cert.tenantName}`, 0, 298, { align: 'center', width: W });

      // ── Fecha de emisión ───────────────────────────────────────────────────
      const issued = new Intl.DateTimeFormat('es-MX', {
        day: 'numeric', month: 'long', year: 'numeric',
      }).format(cert.issuedAt);

      doc
        .fillColor('#4B6478')
        .font('Helvetica')
        .fontSize(11)
        .text(`Emitido el ${issued}`, 0, 318, { align: 'center', width: W });

      // ── Separador decorativo central ───────────────────────────────────────
      doc
        .moveTo(W / 2, 346)
        .lineTo(W / 2, 346)
        .lineWidth(0);

      // ── Columna izquierda: firma ───────────────────────────────────────────
      const sigColX = W / 4;
      const sigY    = 370;
      doc
        .moveTo(sigColX - 60, sigY)
        .lineTo(sigColX + 60, sigY)
        .lineWidth(0.75)
        .stroke('#1E4F7A');

      doc
        .fillColor('#0B1F2A')
        .font('Helvetica-Bold')
        .fontSize(10)
        .text('Capta Platform', sigColX - 80, sigY + 6, { width: 160, align: 'center' });

      doc
        .fillColor('#4B6478')
        .font('Helvetica')
        .fontSize(9)
        .text('Director de Certificación', sigColX - 80, sigY + 20, { width: 160, align: 'center' });

      // ── Columna derecha: sello de verificación ─────────────────────────────
      const sealColX = (W / 4) * 3;
      doc
        .circle(sealColX, sigY - 16, 32)
        .lineWidth(1.5)
        .stroke('#1E4F7A');

      doc
        .fillColor('#1E4F7A')
        .font('Helvetica-Bold')
        .fontSize(9)
        .text('VERIFICADO', sealColX - 30, sigY - 22, { width: 60, align: 'center' });

      doc
        .fillColor('#4B6478')
        .font('Helvetica')
        .fontSize(7)
        .text('CAPTA · CERT', sealColX - 30, sigY - 10, { width: 60, align: 'center' });

      // ── UUID de verificación (footer) ──────────────────────────────────────
      const verifyUrl = `${this.frontendBaseUrl()}/certificates/verify/${cert.publicUuid}`;
      doc
        .rect(0, H - 52, W, 52)
        .fill('#F0F4F8');

      doc
        .fillColor('#4B6478')
        .font('Helvetica')
        .fontSize(8)
        .text('Verifica la autenticidad de este certificado en:', 0, H - 42, {
          align: 'center',
          width: W,
        });

      doc
        .fillColor('#1E4F7A')
        .font('Helvetica-Bold')
        .fontSize(8)
        .text(verifyUrl, 0, H - 28, { align: 'center', width: W });

      doc
        .fillColor('#8FC4E8')
        .font('Helvetica')
        .fontSize(7)
        .text(`ID: ${cert.publicUuid}`, 0, H - 16, { align: 'center', width: W });

      doc.end();
    });
  }

  private frontendBaseUrl(): string {
    return this.config.get<string>('FRONTEND_URL') || 'http://localhost:5001';
  }
}
