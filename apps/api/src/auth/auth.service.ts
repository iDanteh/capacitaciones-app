import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { MfaService } from './mfa.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit.types';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './strategies/jwt.strategy';
import { JwtRefreshPayload } from './strategies/jwt-refresh.strategy';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

// ─── Tipos de respuesta ───────────────────────────────────────────────────────

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse extends AuthTokens {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    tenantId: string;
    tenantSlug: string;
  };
}

/** Respuesta cuando el login requiere un segundo factor. */
export interface MfaChallengeResponse {
  mfaPending: true;
  mfaToken:   string; // JWT de 5 min para POST /auth/mfa/verify
}

export type LoginResponse = AuthResponse | MfaChallengeResponse;

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Costo de bcrypt. 12 es un balance entre seguridad y performance (~250ms en hardware moderno). */
const BCRYPT_ROUNDS = 12;

/**
 * Servicio de autenticación.
 *
 * Responsabilidades:
 *  - Registro: crea tenant + usuario OWNER en una transacción atómica.
 *  - Login: valida credenciales, emite par de tokens.
 *  - Refresh: rota refresh token (invalida el viejo, emite uno nuevo).
 *  - Logout: revoca el refresh token activo.
 *
 * Patrón de seguridad para refresh tokens:
 *  1. El token raw solo viaja al cliente — nunca se persiste en DB.
 *  2. En DB se guarda el hash SHA-256 del token.
 *  3. Para validar: hash(token_recibido) == hash_almacenado.
 *  4. En cada refresh se revoca el token anterior (revokedAt = now).
 *  5. Esto permite detectar replay attacks: si el mismo token se usa dos veces,
 *     el segundo intento encontrará el token ya revocado.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma:  PrismaService,
    private readonly jwt:     JwtService,
    private readonly config:  ConfigService,
    private readonly mfa:     MfaService,
    private readonly audit:   AuditService,
  ) {}

  // ── Register ───────────────────────────────────────────────────────────────

  /**
   * Registra una nueva empresa y su primer usuario (OWNER).
   *
   * Se ejecuta en una transacción para garantizar atomicidad:
   * si cualquier paso falla, ni el tenant ni el usuario se crean.
   * Esto previene tenants huérfanos (sin OWNER).
   */
  async register(dto: RegisterDto): Promise<AuthResponse> {
    const slug = this.generateSlug(dto.companyName);

    // Verificar que el slug no esté ocupado
    const existingTenant = await this.prisma.tenant.findUnique({ where: { slug } });
    if (existingTenant) {
      throw new ConflictException(
        `Ya existe una empresa con el nombre "${dto.companyName}". Prueba un nombre diferente.`,
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    // Transacción atómica: tenant + usuario + suscripción FREE
    const { tenant, user } = await this.prisma.$transaction(async (tx) => {
      // 1. Crear el tenant
      const tenant = await tx.tenant.create({
        data: { name: dto.companyName, slug },
      });

      // 2. Crear el usuario OWNER
      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: dto.email.toLowerCase().trim(),
          passwordHash,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          role: 'OWNER',
        },
      });

      // 3. Asignar suscripción FREE automáticamente
      const freePlan = await tx.plan.findUnique({ where: { type: 'FREE' } });
      if (freePlan) {
        await tx.subscription.create({
          data: {
            tenantId: tenant.id,
            planId: freePlan.id,
            status: 'ACTIVE',
            currentPeriodStart: new Date(),
            // El plan FREE no expira — ponemos 100 años como convención
            currentPeriodEnd: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000),
          },
        });
      }

      return { tenant, user };
    });

    this.logger.log(`Nuevo tenant registrado: ${tenant.slug} (${user.email})`);
    this.audit.log({
      action:   AuditAction.USER_REGISTERED,
      userId:   user.id,
      tenantId: tenant.id,
      entity:   'User',
      entityId: user.id,
      meta:     { email: user.email, tenantSlug: tenant.slug },
    });

    const tokens = await this.issueTokenPair(user.id, user.email, tenant.id, user.role, tenant.slug);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
      },
    };
  }

  // ── Login ──────────────────────────────────────────────────────────────────

  async login(dto: LoginDto): Promise<LoginResponse> {
    // Buscar tenant por slug
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: dto.tenantSlug },
    });

    if (!tenant || !tenant.isActive) {
      // Mensaje genérico para no filtrar si el tenant existe o no
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Buscar usuario dentro del tenant
    const user = await this.prisma.user.findUnique({
      where: {
        tenantId_email: {
          tenantId: tenant.id,
          email: dto.email.toLowerCase().trim(),
        },
      },
    });

    // Siempre comparamos el hash aunque el usuario no exista para prevenir
    // timing attacks (el tiempo de respuesta no revela si el email existe).
    const isPasswordValid = user
      ? await bcrypt.compare(dto.password, user.passwordHash)
      : await bcrypt.hash(dto.password, BCRYPT_ROUNDS); // dummy hash

    if (!user || !isPasswordValid || !user.isActive || user.deletedAt) {
      this.audit.log({
        action:   AuditAction.USER_LOGIN_FAILED,
        tenantId: tenant.id,
        meta:     { email: dto.email.toLowerCase().trim() },
      });
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Si el usuario tiene 2FA activo, emitir un token temporal y pedir el código
    if (user.mfaEnabled) {
      const mfaToken = await this.mfa.issueMfaToken(user.id);
      this.audit.log({
        action:   AuditAction.MFA_CHALLENGE,
        userId:   user.id,
        tenantId: tenant.id,
        meta:     { email: user.email },
      });
      return { mfaPending: true, mfaToken };
    }

    // Actualizar lastLoginAt de forma no bloqueante
    void this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    this.audit.log({
      action:   AuditAction.USER_LOGIN,
      userId:   user.id,
      tenantId: tenant.id,
      meta:     { email: user.email, role: user.role },
    });

    const tokens = await this.issueTokenPair(user.id, user.email, tenant.id, user.role, tenant.slug);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
      },
    };
  }

  // ── MFA verify (step 2 del login) ──────────────────────────────────────────

  /**
   * Completa el login de un usuario con 2FA activo.
   * Valida el mfaToken temporal + el código TOTP/backup, luego emite el par de tokens.
   */
  async verifyMfa(mfaToken: string, code: string): Promise<AuthResponse> {
    const user = await this.mfa.verifyLoginCode(mfaToken, code);

    // Actualizar lastLoginAt de forma no bloqueante
    void this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    this.audit.log({
      action:   AuditAction.MFA_VERIFIED,
      userId:   user.id,
      tenantId: user.tenantId,
      meta:     { email: user.email },
    });

    const tokens = await this.issueTokenPair(
      user.id, user.email, user.tenantId, user.role, user.tenant.slug,
    );

    return {
      ...tokens,
      user: {
        id:         user.id,
        email:      user.email,
        firstName:  user.firstName,
        lastName:   user.lastName,
        role:       user.role,
        tenantId:   user.tenantId,
        tenantSlug: user.tenant.slug,
      },
    };
  }

  // ── Switch tenant ──────────────────────────────────────────────────────────

  /**
   * Permite al OWNER de una empresa padre acceder a una sub-empresa
   * sin necesidad de un login separado.
   *
   * Si el usuario padre aún no tiene cuenta en la sub-empresa, se crea
   * un usuario espejo (mismas credenciales) con rol OWNER.
   */
  async switchTenant(
    userId:         string,
    parentTenantId: string,
    childTenantId:  string,
  ): Promise<AuthResponse> {
    // 1. Verificar que la sub-empresa pertenece al tenant padre
    const child = await this.prisma.tenant.findFirst({
      where: { id: childTenantId, parentTenantId, deletedAt: null, isActive: true },
    });
    if (!child) {
      throw new ForbiddenException('No tienes acceso a esta empresa.');
    }

    // 2. Obtener usuario padre
    const parentUser = await this.prisma.user.findFirst({
      where: { id: userId, tenantId: parentTenantId, deletedAt: null, isActive: true },
    });
    if (!parentUser) {
      throw new UnauthorizedException('Usuario no encontrado.');
    }

    // 3. Buscar o crear usuario espejo en la sub-empresa
    let childUser = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId: childTenantId, email: parentUser.email } },
    });

    if (!childUser) {
      childUser = await this.prisma.user.create({
        data: {
          tenantId:     childTenantId,
          email:        parentUser.email,
          passwordHash: parentUser.passwordHash,
          firstName:    parentUser.firstName,
          lastName:     parentUser.lastName,
          role:         'OWNER',
        },
      });
      this.logger.log(`Usuario espejo creado para ${parentUser.email} en tenant ${childTenantId}`);
    }

    const tokens = await this.issueTokenPair(
      childUser.id, childUser.email, childTenantId, childUser.role, child.slug,
    );

    this.audit.log({
      action:   AuditAction.TENANT_SWITCHED,
      userId:   userId,
      tenantId: parentTenantId,
      entity:   'Tenant',
      entityId: childTenantId,
      meta:     { fromTenantId: parentTenantId, toTenantId: childTenantId, toSlug: child.slug },
    });

    return {
      ...tokens,
      user: {
        id:         childUser.id,
        email:      childUser.email,
        firstName:  childUser.firstName,
        lastName:   childUser.lastName,
        role:       childUser.role,
        tenantId:   childTenantId,
        tenantSlug: child.slug,
      },
    };
  }

  // ── Refresh ────────────────────────────────────────────────────────────────

  /**
   * Rota el par de tokens.
   *
   * Flujo:
   *  1. Verificar que el token tiene un hash válido en DB (no revocado).
   *  2. Revocar el token antiguo (soft-delete: setear revokedAt).
   *  3. Emitir un nuevo par.
   *
   * Si detectamos que el hash no existe o ya está revocado, es una señal
   * de posible replay attack — revocamos TODOS los tokens del usuario
   * como medida de seguridad (forzar nuevo login).
   */
  async refresh(payload: JwtRefreshPayload): Promise<AuthTokens> {
    const tokenHash = this.hashToken(payload.refreshToken!);

    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { include: { tenant: true } } },
    });

    // Token no encontrado o ya revocado — posible replay attack
    if (!storedToken || storedToken.revokedAt || storedToken.expiresAt < new Date()) {
      if (storedToken?.userId) {
        // Revocar todos los tokens del usuario como respuesta a la anomalía
        await this.revokeAllUserTokens(storedToken.userId);
        this.logger.warn(`Posible replay attack detectado para userId: ${storedToken.userId}`);
      }
      throw new UnauthorizedException('Refresh token inválido. Por favor inicia sesión nuevamente.');
    }

    const { user } = storedToken;

    if (!user.isActive || user.deletedAt) {
      throw new ForbiddenException('Cuenta desactivada');
    }

    // Revocar el token actual y emitir uno nuevo en una transacción
    const tokens = await this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.update({
        where: { id: storedToken.id },
        data: { revokedAt: new Date() },
      });

      return this.issueTokenPair(
        user.id,
        user.email,
        user.tenantId,
        user.role,
        user.tenant.slug,
        tx as unknown as PrismaService,
      );
    });

    return tokens;
  }

  // ── Logout ─────────────────────────────────────────────────────────────────

  async logout(refreshToken: string, userId?: string, tenantId?: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    this.audit.log({
      action: AuditAction.USER_LOGOUT,
      userId,
      tenantId,
    });
  }

  // ── Helpers privados ───────────────────────────────────────────────────────

  /**
   * Emite un nuevo par access + refresh token.
   *
   * El refresh token raw se genera con crypto.randomBytes para máxima entropía,
   * luego se firma como JWT para agregar expiración verificable.
   * Solo el hash SHA-256 se persiste en DB.
   */
  private async issueTokenPair(
    userId: string,
    email: string,
    tenantId: string,
    role: string,
    tenantSlug: string,
    tx?: PrismaService,
  ): Promise<AuthTokens> {
    const db = tx ?? this.prisma;

    const payload: JwtPayload = { sub: userId, email, tenantId, role };

    const [accessToken, refreshTokenRaw] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.getOrThrow<string>('jwt.secret'),
        expiresIn: this.config.get<string>('jwt.expiresIn', '15m'),
      }),
      // Refresh token: JWT firmado con secreto distinto
      this.jwt.signAsync(
        { sub: userId, tenantId },
        {
          secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
          expiresIn: this.config.get<string>('jwt.refreshExpiresIn', '7d'),
        },
      ),
    ]);

    const tokenHash = this.hashToken(refreshTokenRaw);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 días

    await (db as PrismaService).refreshToken.create({
      data: { userId, tokenHash, expiresAt },
    });

    return { accessToken, refreshToken: refreshTokenRaw };
  }

  /** SHA-256 del token. Determinista: el mismo token siempre produce el mismo hash. */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /** Genera un slug URL-safe a partir del nombre de empresa. */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // eliminar acentos
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 50);
  }

  /** Revoca todos los refresh tokens activos de un usuario. */
  private async revokeAllUserTokens(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
