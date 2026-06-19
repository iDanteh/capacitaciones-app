import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  RawBodyRequest,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { UserRole } from '@prisma/client';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../tenants/decorators/current-tenant.decorator';
import { Public } from '../auth/decorators/public.decorator';

import { SubscriptionsService } from './subscriptions.service';
import { PlanResponseDto } from './dto/plan-response.dto';
import { StoragePackResponseDto } from './dto/storage-pack-response.dto';
import { SubscriptionResponseDto } from './dto/subscription-response.dto';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { AddStoragePackDto } from './dto/add-storage-pack.dto';

interface AuthUser { id: string; email: string; role: UserRole; tenantSlug: string }
interface TenantContext { id: string }

@ApiTags('subscriptions')
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subs: SubscriptionsService) {}

  // ── Planes (público) ────────────────────────────────────────────────────────

  @Get('plans')
  @Public()
  @ApiOperation({ summary: 'Lista todos los planes disponibles' })
  async getPlans(): Promise<PlanResponseDto[]> {
    const plans = await this.subs.findAllPlans();
    return plans.map(PlanResponseDto.from);
  }

  // ── Storage packs (autenticado) ─────────────────────────────────────────────

  @Get('storage-packs')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Lista los storage add-ons disponibles' })
  async getStoragePacks(): Promise<StoragePackResponseDto[]> {
    const packs = await this.subs.findActiveStoragePacks();
    return packs.map(StoragePackResponseDto.from);
  }

  // ── Suscripción activa ──────────────────────────────────────────────────────

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Retorna la suscripción activa del tenant' })
  async getMySubscription(
    @CurrentTenant() tenant: TenantContext,
  ): Promise<SubscriptionResponseDto> {
    const sub = await this.subs.findMySubscription(tenant.id);
    return SubscriptionResponseDto.from(sub);
  }

  // ── Checkout ────────────────────────────────────────────────────────────────

  @Post('checkout')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Crea una sesión de Stripe Checkout para cambio de plan' })
  async createCheckout(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateCheckoutDto,
  ): Promise<{ url: string }> {
    const url = await this.subs.createCheckoutSession(tenant.id, dto.planType, user.email);
    return { url };
  }

  // ── Customer Portal ─────────────────────────────────────────────────────────

  @Post('portal')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Crea una sesión del portal de facturación de Stripe' })
  async createPortal(
    @CurrentTenant() tenant: TenantContext,
  ): Promise<{ url: string }> {
    const url = await this.subs.createPortalSession(tenant.id);
    return { url };
  }

  // ── Storage Add-ons ─────────────────────────────────────────────────────────

  @Post('storage-packs')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Agrega un storage pack a la suscripción activa' })
  async addStoragePack(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: AddStoragePackDto,
  ) {
    return this.subs.addStoragePack(tenant.id, dto.packId);
  }

  @Delete('storage-packs/:packId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Elimina un storage pack de la suscripción' })
  async removeStoragePack(
    @CurrentTenant() tenant: TenantContext,
    @Param('packId') packId: string,
  ) {
    await this.subs.removeStoragePack(tenant.id, packId);
  }

  // ── Stripe Webhook ──────────────────────────────────────────────────────────
  //
  // IMPORTANTE: Esta ruta NO usa JwtAuthGuard — Stripe llama directamente.
  // La seguridad la da la verificación de firma (stripe.webhooks.constructEvent).
  // Además, necesita el cuerpo RAW (Buffer) antes de cualquier parsing JSON.

  @Post('webhook')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Endpoint de webhooks de Stripe (uso interno)' })
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
  ): Promise<{ received: boolean }> {
    const signature = req.headers['stripe-signature'] as string;
    await this.subs.handleWebhookEvent(req.rawBody!, signature);
    return { received: true };
  }
}
