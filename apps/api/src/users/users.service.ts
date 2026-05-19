import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { EmailService } from '../email/email.service';
import { UserResponseDto } from './dto/user-response.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

const BCRYPT_ROUNDS = 12;

/**
 * Servicio de gestión de usuarios dentro de un tenant.
 *
 * Responsabilidades:
 *  - CRUD de usuarios con scope de tenant (RLS activo vía middleware).
 *  - Flujo de invitación: generar token → email → aceptar → crear cuenta.
 *  - Protecciones de integridad: no eliminar el OWNER, no auto-eliminarse.
 */
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  // ── List ───────────────────────────────────────────────────────────────────

  async findAll(tenantId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: { tenantId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where: { tenantId, deletedAt: null } }),
    ]);

    return {
      data:       users.map(UserResponseDto.from),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ── Find one ───────────────────────────────────────────────────────────────

  async findOne(tenantId: string, userId: string): Promise<UserResponseDto> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, deletedAt: null },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return UserResponseDto.from(user);
  }

  // ── Update ─────────────────────────────────────────────────────────────────

  async update(
    tenantId: string,
    userId: string,
    dto: UpdateUserDto,
    requesterId: string,
  ): Promise<UserResponseDto> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, deletedAt: null },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    // El rol OWNER no se puede cambiar desde esta API
    if (user.role === 'OWNER' && dto.role && dto.role !== 'OWNER') {
      throw new ForbiddenException('No se puede cambiar el rol del propietario');
    }

    // No se puede desactivar al propio solicitante
    if (userId === requesterId && dto.isActive === false) {
      throw new ForbiddenException('No puedes desactivar tu propia cuenta');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { ...dto },
    });

    return UserResponseDto.from(updated);
  }

  // ── Delete (soft) ──────────────────────────────────────────────────────────

  async remove(tenantId: string, userId: string, requesterId: string): Promise<void> {
    if (userId === requesterId) {
      throw new ForbiddenException('No puedes eliminar tu propia cuenta');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, deletedAt: null },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    if (user.role === 'OWNER') {
      throw new ForbiddenException('No se puede eliminar al propietario de la empresa');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date(), isActive: false },
    });

    this.logger.log(`Usuario ${userId} eliminado por ${requesterId}`);
  }

  // ── Invite ─────────────────────────────────────────────────────────────────

  async invite(
    tenantId: string,
    inviterId: string,
    dto: InviteUserDto,
  ): Promise<{ message: string }> {
    const normalizedEmail = dto.email.toLowerCase().trim();

    // Verificar que no exista ya un usuario activo con ese email
    const existingUser = await this.prisma.user.findFirst({
      where: { tenantId, email: normalizedEmail, deletedAt: null },
    });
    if (existingUser) {
      throw new ConflictException('Ya existe un usuario con ese email en tu empresa');
    }

    // Si ya hay una invitación pendiente y vigente, rechazar
    const existingInvite = await this.prisma.userInvite.findUnique({
      where: { tenantId_email: { tenantId, email: normalizedEmail } },
    });
    if (
      existingInvite &&
      !existingInvite.acceptedAt &&
      existingInvite.expiresAt > new Date()
    ) {
      throw new ConflictException(
        'Ya existe una invitación pendiente para ese email. Espera a que expire o cancélala.',
      );
    }

    // Obtener datos del invitante y el tenant para el email
    const [inviter, tenant] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: inviterId } }),
      this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } }),
    ]);

    // Generar token seguro
    const rawToken  = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 días

    // Upsert — reemplaza si existía una invitación expirada o ya aceptada
    await this.prisma.userInvite.upsert({
      where: { tenantId_email: { tenantId, email: normalizedEmail } },
      create: {
        tenantId,
        email:      normalizedEmail,
        firstName:  dto.firstName.trim(),
        lastName:   dto.lastName.trim(),
        role:       dto.role,
        tokenHash,
        invitedById: inviterId,
        expiresAt,
      },
      update: {
        firstName:  dto.firstName.trim(),
        lastName:   dto.lastName.trim(),
        role:       dto.role,
        tokenHash,
        invitedById: inviterId,
        expiresAt,
        acceptedAt: null,
      },
    });

    // Enviar email (fallo silencioso — no revierte la invitación en DB)
    await this.email.sendInvite({
      to:          dto.email,
      inviterName: `${inviter.firstName} ${inviter.lastName}`,
      companyName: tenant.name,
      role:        dto.role,
      token:       rawToken,
    });

    this.logger.log(`Invitación enviada a ${normalizedEmail} por ${inviterId}`);

    return { message: 'Invitación enviada correctamente' };
  }

  // ── Get invite info (público — sin auth) ───────────────────────────────────

  async getInviteByToken(rawToken: string) {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const invite = await this.prisma.userInvite.findUnique({
      where: { tokenHash },
      include: { tenant: { select: { name: true } } },
    });

    if (!invite) throw new NotFoundException('Invitación no encontrada o inválida');
    if (invite.acceptedAt) {
      throw new ConflictException('Esta invitación ya fue aceptada');
    }
    if (invite.expiresAt < new Date()) {
      throw new BadRequestException('Esta invitación ha expirado');
    }

    return {
      email:       invite.email,
      firstName:   invite.firstName,
      lastName:    invite.lastName,
      role:        invite.role,
      companyName: invite.tenant.name,
    };
  }

  // ── Accept invite (público — sin auth) ────────────────────────────────────

  async acceptInvite(dto: AcceptInviteDto): Promise<UserResponseDto> {
    const tokenHash = crypto.createHash('sha256').update(dto.token).digest('hex');

    const invite = await this.prisma.userInvite.findUnique({ where: { tokenHash } });

    if (!invite) throw new NotFoundException('Invitación no encontrada o inválida');
    if (invite.acceptedAt) throw new ConflictException('Esta invitación ya fue aceptada');
    if (invite.expiresAt < new Date()) throw new BadRequestException('Esta invitación ha expirado');

    // Verificar que no se haya registrado ya (edge case: register + invite mismo email)
    const existingUser = await this.prisma.user.findFirst({
      where: { tenantId: invite.tenantId, email: invite.email, deletedAt: null },
    });
    if (existingUser) throw new ConflictException('Ya existe una cuenta con ese email');

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          tenantId:     invite.tenantId,
          email:        invite.email,
          passwordHash,
          firstName:    invite.firstName,
          lastName:     invite.lastName,
          role:         invite.role,
          isActive:     true,
        },
      });
      await tx.userInvite.update({
        where: { id: invite.id },
        data:  { acceptedAt: new Date() },
      });
      return created;
    });

    this.logger.log(`Invitación aceptada: ${user.email} en tenant ${user.tenantId}`);

    return UserResponseDto.from(user);
  }

  // ── Pending invites ────────────────────────────────────────────────────────

  async findPendingInvites(tenantId: string) {
    const invites = await this.prisma.userInvite.findMany({
      where: {
        tenantId,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, expiresAt: true, createdAt: true,
        invitedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return invites;
  }

  async cancelInvite(tenantId: string, inviteId: string): Promise<void> {
    const invite = await this.prisma.userInvite.findFirst({
      where: { id: inviteId, tenantId, acceptedAt: null },
    });
    if (!invite) throw new NotFoundException('Invitación no encontrada');
    // Expire immediately by setting expiresAt to now
    await this.prisma.userInvite.update({
      where: { id: inviteId },
      data:  { expiresAt: new Date() },
    });
  }
}
