import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import { authenticator } from '@otplib/preset-default';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../database/prisma.service';

// ─── Constantes ───────────────────────────────────────────────────────────────

const APP_NAME      = 'Capta LMS';
const BACKUP_COUNT  = 8;
const BACKUP_ROUNDS = 10; // bcrypt para backup codes — menos rondas (short-lived)

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface MfaSetupResult {
  secret:        string;          // TOTP secret en texto plano (solo en este request)
  qrCodeDataUrl: string;          // data URL del QR listo para <img>
  otpauthUrl:    string;          // URL otpauth:// para copiar manualmente
}

export interface MfaConfirmResult {
  backupCodes: string[];          // 8 códigos de un solo uso (solo visibles aquí)
}

/** Payload del JWT temporal emitido cuando el login requiere 2FA. */
export interface MfaPendingPayload {
  sub:        string;
  mfaPending: true;
}

/**
 * Servicio de autenticación de dos factores (TOTP — RFC 6238).
 *
 * Responsabilidades:
 *  - setup():      genera secret TOTP + QR, guarda secret cifrado (sin activar aún)
 *  - confirm():    valida primer código → activa 2FA → genera backup codes
 *  - verifyCode(): valida TOTP o backup code (invalida el código usado)
 *  - disable():    desactiva 2FA tras verificar el código del usuario
 *
 * El secret TOTP nunca se guarda en texto plano.
 * Se cifra con AES-256-GCM usando la clave MFA_ENCRYPTION_KEY.
 */
@Injectable()
export class MfaService {
  private readonly logger = new Logger(MfaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly jwt:    JwtService,
  ) {}

  // ── Setup ──────────────────────────────────────────────────────────────────

  /**
   * Inicia el proceso de configuración de 2FA.
   * Genera un nuevo TOTP secret, crea el QR y lo guarda cifrado.
   * El 2FA NO se activa hasta que el usuario confirme con un código válido.
   */
  async setup(userId: string): Promise<MfaSetupResult> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    if (user.mfaEnabled) {
      throw new ConflictException('El 2FA ya está activado. Desactívalo primero para reconfigurarlo.');
    }

    const secret      = authenticator.generateSecret(20); // 160-bit secret
    const otpauthUrl  = authenticator.keyuri(user.email, APP_NAME, secret);
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, { errorCorrectionLevel: 'M' });

    // Guardar el secret cifrado (pendiente de confirmación)
    await this.prisma.user.update({
      where: { id: userId },
      data:  { mfaSecret: this.encryptSecret(secret) },
    });

    return { secret, qrCodeDataUrl, otpauthUrl };
  }

  // ── Confirm ────────────────────────────────────────────────────────────────

  /**
   * Confirma la configuración de 2FA con el primer código TOTP.
   * Activa el 2FA y retorna los códigos de respaldo (solo se muestran una vez).
   */
  async confirm(userId: string, code: string): Promise<MfaConfirmResult> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    if (!user.mfaSecret) {
      throw new BadRequestException('Primero inicia el proceso de configuración de 2FA.');
    }
    if (user.mfaEnabled) {
      throw new ConflictException('El 2FA ya está activado.');
    }

    const secret  = this.decryptSecret(user.mfaSecret);
    const isValid = authenticator.verify({ token: code.trim(), secret });
    if (!isValid) {
      throw new UnauthorizedException('Código inválido. Verifica que la hora de tu dispositivo sea correcta.');
    }

    // Generar backup codes — 8 tokens hex de 4 bytes (8 chars)
    const rawCodes    = Array.from({ length: BACKUP_COUNT }, () =>
      crypto.randomBytes(4).toString('hex'),
    );
    const hashedCodes = await Promise.all(rawCodes.map(c => bcrypt.hash(c, BACKUP_ROUNDS)));

    await this.prisma.user.update({
      where: { id: userId },
      data:  { mfaEnabled: true, mfaBackupCodes: hashedCodes },
    });

    this.logger.log(`2FA activado para usuario ${userId}`);

    return { backupCodes: rawCodes };
  }

  // ── Verify (durante login) ─────────────────────────────────────────────────

  /**
   * Verifica el código TOTP o backup code en el flujo de login MFA.
   * @returns El usuario verificado (para que AuthService emita los tokens).
   */
  async verifyLoginCode(
    mfaToken: string,
    code:     string,
  ): Promise<User & { tenant: { slug: string } }> {
    // 1. Validar el JWT temporal
    let payload: MfaPendingPayload;
    try {
      payload = await this.jwt.verifyAsync<MfaPendingPayload>(mfaToken, {
        secret: this.config.get<string>('mfa.jwtSecret') || this.config.getOrThrow<string>('jwt.secret'),
      });
    } catch {
      throw new UnauthorizedException('Token MFA inválido o expirado. Inicia sesión nuevamente.');
    }

    if (!payload.mfaPending) {
      throw new UnauthorizedException('Token inválido.');
    }

    // 2. Cargar usuario
    const user = await this.prisma.user.findUnique({
      where:   { id: payload.sub },
      include: { tenant: { select: { slug: true } } },
    });

    if (!user || !user.isActive || user.deletedAt) {
      throw new UnauthorizedException('Usuario no encontrado o inactivo.');
    }
    if (!user.mfaEnabled || !user.mfaSecret) {
      throw new UnauthorizedException('2FA no configurado para este usuario.');
    }

    // 3. Verificar código
    const valid = await this.verifyCode(user, code.replace(/\s/g, ''));
    if (!valid) {
      throw new UnauthorizedException('Código de verificación incorrecto.');
    }

    return user as User & { tenant: { slug: string } };
  }

  // ── Disable ────────────────────────────────────────────────────────────────

  /** Desactiva el 2FA después de verificar el código actual. */
  async disable(userId: string, code: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    if (!user.mfaEnabled) {
      throw new BadRequestException('El 2FA no está activado.');
    }

    const valid = await this.verifyCode(user, code.replace(/\s/g, ''));
    if (!valid) {
      throw new UnauthorizedException('Código de verificación incorrecto.');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data:  { mfaEnabled: false, mfaSecret: null, mfaBackupCodes: [] },
    });

    this.logger.log(`2FA desactivado para usuario ${userId}`);
  }

  // ── Helpers públicos ───────────────────────────────────────────────────────

  /**
   * Emite el JWT temporal de 5 min para el flujo de MFA pending.
   * Usa MFA_JWT_SECRET si está configurado, o cae al JWT_SECRET como fallback.
   */
  async issueMfaToken(userId: string): Promise<string> {
    const secret = this.config.get<string>('mfa.jwtSecret') || this.config.getOrThrow<string>('jwt.secret');
    const payload: MfaPendingPayload = { sub: userId, mfaPending: true };
    return this.jwt.signAsync(payload, { secret, expiresIn: '5m' });
  }

  // ── Helpers privados ───────────────────────────────────────────────────────

  /**
   * Verifica un código: primero intenta TOTP, luego backup codes.
   * Si un backup code coincide, lo invalida (uso único).
   */
  async verifyCode(user: User, code: string): Promise<boolean> {
    // Intentar TOTP
    const secret  = this.decryptSecret(user.mfaSecret!);
    if (authenticator.verify({ token: code, secret })) return true;

    // Intentar backup codes
    for (let i = 0; i < user.mfaBackupCodes.length; i++) {
      const match = await bcrypt.compare(code, user.mfaBackupCodes[i]);
      if (match) {
        // Invalidar el código usado
        const remaining = [...user.mfaBackupCodes];
        remaining.splice(i, 1);
        await this.prisma.user.update({
          where: { id: user.id },
          data:  { mfaBackupCodes: remaining },
        });
        this.logger.warn(`Backup code usado por usuario ${user.id} (${remaining.length} restantes)`);
        return true;
      }
    }

    return false;
  }

  /** Cifra el TOTP secret con AES-256-GCM. Formato: base64(iv[12] + tag[16] + ciphertext). */
  private encryptSecret(plaintext: string): string {
    const key = this.getMfaKey();
    const iv  = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const enc    = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag    = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString('base64');
  }

  /** Descifra un secret previamente cifrado con encryptSecret(). */
  private decryptSecret(encoded: string): string {
    const key  = this.getMfaKey();
    const buf  = Buffer.from(encoded, 'base64');
    const iv   = buf.subarray(0, 12);
    const tag  = buf.subarray(12, 28);
    const data = buf.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(data).toString('utf8') + decipher.final('utf8');
  }

  /**
   * Obtiene la clave AES-256 para cifrado del secret TOTP.
   * Si MFA_ENCRYPTION_KEY no está configurado, deriva una clave desde JWT_SECRET
   * (solo aceptable en desarrollo — en producción siempre configurar MFA_ENCRYPTION_KEY).
   */
  private getMfaKey(): Buffer {
    const hexKey = this.config.get<string>('mfa.encryptionKey');
    if (hexKey && hexKey.length === 64) {
      return Buffer.from(hexKey, 'hex');
    }
    // Fallback: derivar 32 bytes desde JWT_SECRET via SHA-256
    const jwtSecret = this.config.getOrThrow<string>('jwt.secret');
    return crypto.createHash('sha256').update(jwtSecret).digest();
  }
}
