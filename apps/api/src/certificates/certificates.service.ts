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
import * as http  from 'node:http';
import * as https from 'node:https';
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
 * El certificado almacena solo metadatos en BD; el PDF se genera on-demand.
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

  // ── Generación para Quiz (llamado desde QuizService) ─────────────────────

  async generateQuizCertificate(
    tenantId:     string,
    userId:       string,
    quizId:       string,
    assignmentId: string,
    quizTitle:    string,
  ): Promise<CertificateResponseDto | null> {
    const subscription = await this.prisma.subscription.findUnique({
      where:   { tenantId },
      include: { plan: true, tenant: true },
    });

    if (!subscription?.plan?.hasCertificates) return null;

    const existing = await this.prisma.certificate.findUnique({
      where: { quizAssignmentId: assignmentId },
    });

    if (existing) return CertificateResponseDto.from(existing, this.frontendBaseUrl());

    const [user, tenant] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.tenant.findUnique({ where: { id: tenantId } }),
    ]);

    if (!user || !tenant) throw new NotFoundException('Usuario o tenant no encontrado');

    const certificate = await this.prisma.certificate.create({
      data: {
        tenantId,
        userId,
        quizId,
        quizAssignmentId: assignmentId,
        recipientName:    `${user.firstName} ${user.lastName}`,
        courseTitle:      quizTitle,
        tenantName:       tenant.name,
      },
    });

    this.logger.log(`Certificado de quiz generado — usuario: ${userId}, quiz: ${quizId}, uuid: ${certificate.publicUuid}`);
    return CertificateResponseDto.from(certificate, this.frontendBaseUrl());
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
        type:          'COURSE',
      };
    }

    return {
      publicUuid:    cert.publicUuid,
      recipientName: cert.recipientName,
      courseTitle:   cert.courseTitle,
      tenantName:    cert.tenantName,
      issuedAt:      cert.issuedAt,
      isValid:       true,
      type:          cert.quizAssignmentId ? 'QUIZ' : 'COURSE',
    };
  }

  // ── Descarga PDF ─────────────────────────────────────────────────────────

  async downloadPdf(tenantId: string, userId: string, certificateId: string): Promise<Buffer> {
    const cert = await this.prisma.certificate.findFirst({
      where: { id: certificateId, tenantId, userId },
    });

    if (!cert) throw new NotFoundException('Certificado no encontrado');

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const logoBuffer = tenant?.logoUrl ? await this.downloadImageBuffer(tenant.logoUrl) : null;
    const type = cert.quizAssignmentId ? 'QUIZ' : 'COURSE';

    return this.buildPdf(cert, logoBuffer, type);
  }

  async downloadPdfByUuid(uuid: string): Promise<Buffer> {
    const cert = await this.prisma.certificate.findUnique({
      where: { publicUuid: uuid },
    });

    if (!cert) throw new NotFoundException('Certificado no encontrado');

    const tenant = await this.prisma.tenant.findUnique({ where: { id: cert.tenantId } });
    const logoBuffer = tenant?.logoUrl ? await this.downloadImageBuffer(tenant.logoUrl) : null;
    const type = cert.quizAssignmentId ? 'QUIZ' : 'COURSE';

    return this.buildPdf(cert, logoBuffer, type);
  }

  // ── Descarga de imagen remota ─────────────────────────────────────────────

  /**
   * Descarga una imagen desde una URL pública y devuelve su Buffer.
   * Devuelve null si la URL no es accesible o hay un error.
   * Timeout de 5 segundos para no bloquear la generación del PDF.
   */
  private downloadImageBuffer(url: string): Promise<Buffer | null> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(null), 5000);

      const client = url.startsWith('https://') ? https : http;

      client.get(url, (res) => {
        if (res.statusCode !== 200) {
          clearTimeout(timeout);
          res.resume();
          resolve(null);
          return;
        }

        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          clearTimeout(timeout);
          resolve(Buffer.concat(chunks));
        });
        res.on('error', () => {
          clearTimeout(timeout);
          resolve(null);
        });
      }).on('error', () => {
        clearTimeout(timeout);
        resolve(null);
      });
    });
  }

  // ── Generación de PDF (pdfkit) ────────────────────────────────────────────

  /**
   * Dibuja el mark vectorial de Capta (replicando el SVG public/brand/mark-dark.svg).
   *
   * SVG original: viewBox 0 0 48 48
   *   - Arco C: M 36 14 A 16 16 0 1 0 36 34 (stroke mint, lineCap round, width 5)
   *   - Círculo exterior: cx=38 cy=24 r=4 (fill mint)
   *   - Círculo interior: cx=38 cy=24 r=2 (fill dark #0B2840)
   *
   * @param doc  - instancia de PDFDocument
   * @param x    - coordenada x del extremo superior izquierdo del mark
   * @param y    - coordenada y del extremo superior izquierdo del mark
   * @param size - tamaño objetivo en pt (el mark se escala desde 48×48)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private drawCaptaMark(doc: any, x: number, y: number, size: number): void {
    const s = size / 48;

    doc.save();
    // Transformación: escalar desde el espacio SVG (48×48) y trasladar al destino
    doc.transform(s, 0, 0, s, x, y);

    // Arco "C" — apertura hacia la derecha
    doc
      .path('M 36 14 A 16 16 0 1 0 36 34')
      .lineWidth(5)
      .strokeColor('#7FD1AE')
      .lineCap('round')
      .stroke();

    // Punto exterior (mint)
    doc.circle(38, 24, 4).fillColor('#7FD1AE').fill();

    // Punto interior (oscuro — crea el efecto de apertura de lente)
    doc.circle(38, 24, 2).fillColor('#0B2840').fill();

    doc.restore();
  }

  /**
   * buildPdf — genera un certificado en formato A4 landscape.
   *
   * Diseño:
   *  - Fondo crema (#FAFAF4), marco doble navy/celeste.
   *  - Header navy: mark vectorial Capta + "Capta" + logo del tenant (si existe).
   *  - Cuerpo: nombre del participante, curso/quiz, empresa, fecha.
   *  - Footer: URL de verificación pública + UUID.
   */
  private buildPdf(
    cert: {
      publicUuid:    string;
      recipientName: string;
      courseTitle:   string;
      tenantName:    string;
      issuedAt:      Date;
    },
    tenantLogoBuffer: Buffer | null = null,
    type: 'COURSE' | 'QUIZ' = 'COURSE',
  ): Promise<Buffer> {
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
      const headerH = 90;
      doc.rect(0, 0, W, headerH).fill('#1E4F7A');

      if (tenantLogoBuffer) {
        // ── Header dividido: Capta a la izquierda, logo empresa a la derecha ──

        // Mark vectorial Capta (izquierda)
        const markSize = 52;
        const markX    = 32;
        const markY    = (headerH - markSize) / 2;  // centrado vertical
        this.drawCaptaMark(doc, markX, markY, markSize);

        // Texto "Capta" a la derecha del mark
        const textX = markX + markSize + 8;
        doc
          .fillColor('#FFFFFF')
          .font('Helvetica-Bold')
          .fontSize(22)
          .text('Capta', textX, markY + 6, { width: W / 2 - textX - 10 });

        doc
          .fillColor('#8FC4E8')
          .font('Helvetica')
          .fontSize(9)
          .text('Plataforma de Capacitación Empresarial', textX, markY + 32, { width: W / 2 - textX - 10 });

        // Separador vertical central
        doc
          .moveTo(W / 2, 14)
          .lineTo(W / 2, headerH - 14)
          .lineWidth(0.5)
          .stroke('#8FC4E840');

        // Logo del tenant (derecha) — caja blanca redondeada de 56×56
        const logoBoxSize = 56;
        const logoBoxX = W - 40 - logoBoxSize;
        const logoBoxY = (headerH - logoBoxSize) / 2;

        // Fondo blanco para el logo
        doc
          .roundedRect(logoBoxX, logoBoxY, logoBoxSize, logoBoxSize, 8)
          .fill('#FFFFFF');

        // Insertar imagen del logo con padding interno
        const padding = 6;
        try {
          doc.image(tenantLogoBuffer, logoBoxX + padding, logoBoxY + padding, {
            width:  logoBoxSize - padding * 2,
            height: logoBoxSize - padding * 2,
            fit:    [logoBoxSize - padding * 2, logoBoxSize - padding * 2],
            align:  'center',
            valign: 'center',
          });
        } catch {
          // Si el formato de imagen no es compatible (ej. SVG), omitir el logo
          this.logger.warn('No se pudo incrustar el logo del tenant en el PDF — formato no compatible');
        }

        // Nombre de la empresa debajo de la caja (solo si hay espacio)
        doc
          .fillColor('#8FC4E8')
          .font('Helvetica')
          .fontSize(8)
          .text(cert.tenantName, logoBoxX - 10, logoBoxY + logoBoxSize + 4, {
            width: logoBoxSize + 20,
            align: 'center',
          });

      } else {
        // ── Header centrado (sin logo de empresa) ──────────────────────────
        // Grupo: mark (52pt) + gap (10pt) + texto estimado (~90pt) = ~152pt
        // Centrar el grupo: startX = (W - 152) / 2
        const markSizeC = 52;
        const groupW    = 152;
        const groupX    = (W - groupW) / 2;
        const markYC    = (headerH - markSizeC) / 2;
        this.drawCaptaMark(doc, groupX, markYC, markSizeC);

        const textXC = groupX + markSizeC + 10;
        doc
          .fillColor('#FFFFFF')
          .font('Helvetica-Bold')
          .fontSize(24)
          .text('Capta', textXC, markYC + 5, { width: 90 });

        doc
          .fillColor('#8FC4E8')
          .font('Helvetica')
          .fontSize(9)
          .text('Plataforma de Capacitación Empresarial', 0, markYC + markSizeC + 6, {
            align: 'center',
            width: W,
          });
      }

      // ── Título del certificado ─────────────────────────────────────────────
      const certTitle = type === 'QUIZ' ? 'CERTIFICADO DE EVALUACIÓN' : 'CERTIFICADO DE FINALIZACIÓN';
      doc
        .fillColor('#0B1F2A')
        .font('Helvetica-Bold')
        .fontSize(13)
        .text(certTitle, 0, 108, {
          align:            'center',
          width:            W,
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

      // ── "ha completado satisfactoriamente el curso/evaluación" ────────────
      const completionText = type === 'QUIZ'
        ? 'ha completado satisfactoriamente la evaluación'
        : 'ha completado satisfactoriamente el curso';
      doc
        .fillColor('#4B6478')
        .font('Helvetica')
        .fontSize(12)
        .text(completionText, 0, 228, {
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
      const verifyUrl = `${this.frontendBaseUrl()}/verify/${cert.publicUuid}`;
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
