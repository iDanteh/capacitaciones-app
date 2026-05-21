/**
 * SubscriptionsService
 *
 * Orquesta la lógica de negocio de planes y pagos:
 *  - Consulta del estado de suscripción de un tenant
 *  - Creación de sesiones de checkout/portal en Stripe
 *  - Gestión de storage add-ons (SubscriptionItem en Stripe + BD)
 *  - Procesamiento de webhooks de Stripe (fuente de verdad → BD)
 *
 * Principio clave: la BD siempre refleja el estado de Stripe, no al revés.
 * Los webhooks son los que actualizan la BD; nunca confiar solo en la
 * respuesta del checkout para cambiar el plan.
 */

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { StripeService, StripeEvent } from './stripe.service';
import { SubscriptionStatus, PlanType } from '@prisma/client';

// Los tipos de los objetos de evento se infieren como `any` desde el SDK de Stripe v22.
// La seguridad de tipos está garantizada en runtime por la verificación de firma del webhook
// y el narrowing del switch statement sobre event.type.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    private readonly config: ConfigService,
  ) {}

  // ── Consultas ───────────────────────────────────────────────────────────────

  async findAllPlans() {
    return this.prisma.plan.findMany({ orderBy: { priceUsd: 'asc' } });
  }

  async findActiveStoragePacks() {
    return this.prisma.storagePack.findMany({
      where: { isActive: true },
      orderBy: { storageGb: 'asc' },
    });
  }

  async findMySubscription(tenantId: string) {
    const [sub, storageAgg] = await Promise.all([
      this.prisma.subscription.findUnique({
        where: { tenantId },
        include: {
          plan: true,
          storagePacks: { include: { storagePack: true } },
        },
      }),
      // Suma de fileSizeBytes de todas las lecciones con archivo en el tenant.
      // Excluye lecciones eliminadas (soft delete).
      this.prisma.lesson.aggregate({
        where: { tenantId, deletedAt: null, fileSizeBytes: { not: null } },
        _sum: { fileSizeBytes: true },
      }),
    ]);

    if (!sub) throw new NotFoundException('No se encontró suscripción para este tenant');

    return {
      ...sub,
      usedStorageBytes: storageAgg._sum.fileSizeBytes ?? 0,
    };
  }

  // ── Stripe — Checkout ───────────────────────────────────────────────────────

  /**
   * Crea una sesión de Stripe Checkout para que el tenant cambie de plan.
   * Redirige al frontend con el resultado (success_url / cancel_url).
   *
   * Solo aplica a planes BUSINESS o ENTERPRISE (FREE no paga).
   */
  async createCheckoutSession(
    tenantId: string,
    planType: PlanType,
    userEmail: string,
  ): Promise<string> {
    if (planType === PlanType.FREE) {
      throw new BadRequestException('El plan FREE no requiere checkout');
    }

    const plan = await this.prisma.plan.findUnique({ where: { type: planType } });
    if (!plan?.stripePriceId) {
      throw new BadRequestException(
        `El plan ${planType} no tiene precio configurado en Stripe. ` +
        `Agrega el stripePriceId al plan en la BD.`,
      );
    }

    const sub         = await this.prisma.subscription.findUnique({ where: { tenantId } });
    const frontendUrl = this.config.get<string>('frontendUrl');

    const session = await this.stripe.client.checkout.sessions.create({
      mode: 'subscription',
      ...(sub?.stripeCustomerId
        ? { customer: sub.stripeCustomerId }
        : { customer_email: userEmail }),
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      metadata: { tenantId, planType },
      success_url: `${frontendUrl}/dashboard/billing?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url:  `${frontendUrl}/dashboard/billing?canceled=true`,
      subscription_data: {
        metadata: { tenantId, planType },
      },
    });

    return session.url!;
  }

  // ── Stripe — Customer Portal ────────────────────────────────────────────────

  /**
   * Crea una sesión del Customer Portal de Stripe para que el tenant
   * gestione su suscripción (método de pago, cancelación, facturas).
   */
  async createPortalSession(tenantId: string): Promise<string> {
    const sub = await this.prisma.subscription.findUnique({ where: { tenantId } });

    if (!sub?.stripeCustomerId) {
      throw new BadRequestException(
        'Este tenant no tiene un cliente en Stripe todavía. Completa un checkout primero.',
      );
    }

    const frontendUrl = this.config.get<string>('frontendUrl');
    const session     = await this.stripe.client.billingPortal.sessions.create({
      customer:   sub.stripeCustomerId,
      return_url: `${frontendUrl}/dashboard/billing`,
    });

    return session.url;
  }

  // ── Storage Add-ons ─────────────────────────────────────────────────────────

  /**
   * Agrega un storage pack a la suscripción activa del tenant.
   * Crea un SubscriptionItem en Stripe y lo persiste en BD.
   *
   * Si el pack ya existe, incrementa la cantidad en +1 (comportamiento acumulable).
   */
  async addStoragePack(tenantId: string, packId: string) {
    const [sub, pack] = await Promise.all([
      this.prisma.subscription.findUnique({
        where:   { tenantId },
        include: { storagePacks: { where: { storagePackId: packId } } },
      }),
      this.prisma.storagePack.findUnique({ where: { id: packId } }),
    ]);

    if (!sub)            throw new NotFoundException('Suscripción no encontrada');
    if (!pack?.isActive) throw new NotFoundException('Storage pack no encontrado o inactivo');

    if (sub.status !== SubscriptionStatus.ACTIVE && sub.status !== SubscriptionStatus.TRIALING) {
      throw new BadRequestException('La suscripción debe estar activa para agregar storage packs');
    }

    if (!sub.stripeSubscriptionId) {
      throw new BadRequestException(
        'El tenant no tiene una suscripción activa en Stripe. Completa un checkout primero.',
      );
    }

    if (!pack.stripePriceId) {
      throw new BadRequestException('Este storage pack no tiene precio configurado en Stripe');
    }

    const existingItem = sub.storagePacks[0];

    if (existingItem?.stripeSubscriptionItemId) {
      await this.stripe.client.subscriptionItems.update(
        existingItem.stripeSubscriptionItemId,
        { quantity: existingItem.quantity + 1 },
      );

      return this.prisma.subscriptionStoragePack.update({
        where:   { id: existingItem.id },
        data:    { quantity: { increment: 1 } },
        include: { storagePack: true },
      });
    }

    const stripeItem = await this.stripe.client.subscriptionItems.create({
      subscription: sub.stripeSubscriptionId,
      price:        pack.stripePriceId,
      quantity:     1,
    });

    return this.prisma.subscriptionStoragePack.create({
      data: {
        subscriptionId:           sub.id,
        storagePackId:            packId,
        quantity:                 1,
        stripeSubscriptionItemId: stripeItem.id,
      },
      include: { storagePack: true },
    });
  }

  /**
   * Elimina un storage pack de la suscripción.
   * Cancela el SubscriptionItem en Stripe sin prorrateo.
   */
  async removeStoragePack(tenantId: string, packId: string) {
    const sub = await this.prisma.subscription.findUnique({
      where:   { tenantId },
      include: {
        storagePacks: {
          where:   { storagePackId: packId },
          include: { storagePack: true },
        },
      },
    });

    if (!sub) throw new NotFoundException('Suscripción no encontrada');

    const item = sub.storagePacks[0];
    if (!item) throw new NotFoundException('Este storage pack no está activo en tu suscripción');

    if (item.stripeSubscriptionItemId) {
      await this.stripe.client.subscriptionItems.del(item.stripeSubscriptionItemId, {
        proration_behavior: 'none',
      });
    }

    await this.prisma.subscriptionStoragePack.delete({ where: { id: item.id } });
  }

  // ── Webhooks ────────────────────────────────────────────────────────────────

  /**
   * Punto de entrada para eventos de Stripe.
   * Cada handler es idempotente: procesar el mismo evento dos veces
   * tiene el mismo efecto que procesarlo una vez.
   */
  async handleWebhookEvent(rawBody: Buffer, signature: string): Promise<void> {
    let event: StripeEvent;

    try {
      event = this.stripe.constructEvent(rawBody, signature);
    } catch (err) {
      this.logger.warn(`Webhook signature inválida: ${(err as Error).message}`);
      throw new BadRequestException('Stripe webhook signature inválida');
    }

    this.logger.log(`Webhook recibido: ${event.type}`);

    // Los handlers reciben el objeto como AnyRecord. El tipo real está garantizado por
    // Stripe en runtime (verificación de firma + schema del evento).
    const data = event.data.object as AnyRecord;

    switch (event.type) {
      case 'checkout.session.completed':
        await this.onCheckoutCompleted(data);
        break;

      case 'invoice.paid':
        await this.onInvoicePaid(data);
        break;

      case 'invoice.payment_failed':
        await this.onInvoicePaymentFailed(data);
        break;

      case 'customer.subscription.updated':
        await this.onSubscriptionUpdated(data);
        break;

      case 'customer.subscription.deleted':
        await this.onSubscriptionDeleted(data);
        break;

      default:
        this.logger.debug(`Evento no manejado: ${event.type}`);
    }
  }

  // ── Handlers privados ───────────────────────────────────────────────────────

  /**
   * El usuario completó el flujo de checkout. Vinculamos el customer y la
   * suscripción de Stripe con el registro de BD del tenant, y actualizamos el plan.
   */
  private async onCheckoutCompleted(session: AnyRecord) {
    const tenantId = session.metadata?.tenantId as string | undefined;
    const planType = session.metadata?.planType as PlanType | undefined;

    if (!tenantId || !planType) {
      this.logger.warn('checkout.session.completed sin metadata tenantId/planType');
      return;
    }

    const plan = await this.prisma.plan.findUnique({ where: { type: planType } });
    if (!plan) return;

    const stripeSub = await this.stripe.client.subscriptions.retrieve(
      session.subscription as string,
    );

    await this.prisma.subscription.update({
      where: { tenantId },
      data: {
        planId:               plan.id,
        status:               SubscriptionStatus.ACTIVE,
        stripeCustomerId:     session.customer as string,
        stripeSubscriptionId: session.subscription as string,
        currentPeriodStart:   new Date((stripeSub as AnyRecord).current_period_start * 1000),
        currentPeriodEnd:     new Date((stripeSub as AnyRecord).current_period_end * 1000),
        cancelAtPeriodEnd:    (stripeSub as AnyRecord).cancel_at_period_end as boolean,
      },
    });

    this.logger.log(`Tenant ${tenantId} actualizado al plan ${planType}`);
  }

  /**
   * Factura pagada → suscripción renovada.
   * Actualizamos fechas del período y aseguramos estado ACTIVE.
   */
  private async onInvoicePaid(invoice: AnyRecord) {
    if (!invoice.subscription) return;

    const sub = await this.prisma.subscription.findFirst({
      where: { stripeSubscriptionId: invoice.subscription as string },
    });
    if (!sub) return;

    const stripeSub = await this.stripe.client.subscriptions.retrieve(
      invoice.subscription as string,
    ) as AnyRecord;

    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: {
        status:             SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
        currentPeriodEnd:   new Date(stripeSub.current_period_end * 1000),
      },
    });
  }

  /** Pago fallido → período de gracia PAST_DUE. */
  private async onInvoicePaymentFailed(invoice: AnyRecord) {
    if (!invoice.subscription) return;

    await this.prisma.subscription.updateMany({
      where: { stripeSubscriptionId: invoice.subscription as string },
      data:  { status: SubscriptionStatus.PAST_DUE },
    });
  }

  /** Sincroniza cambios de estado desde el portal o via API de Stripe. */
  private async onSubscriptionUpdated(stripeSub: AnyRecord) {
    const sub = await this.prisma.subscription.findFirst({
      where: { stripeSubscriptionId: stripeSub.id as string },
    });
    if (!sub) return;

    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: {
        status:             this.mapStripeStatus(stripeSub.status as string),
        cancelAtPeriodEnd:  stripeSub.cancel_at_period_end as boolean,
        currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
        currentPeriodEnd:   new Date(stripeSub.current_period_end * 1000),
      },
    });
  }

  /** Suscripción eliminada en Stripe → marcamos CANCELED en BD. */
  private async onSubscriptionDeleted(stripeSub: AnyRecord) {
    await this.prisma.subscription.updateMany({
      where: { stripeSubscriptionId: stripeSub.id as string },
      data:  { status: SubscriptionStatus.CANCELED },
    });
  }

  // ── Utilidades ──────────────────────────────────────────────────────────────

  private mapStripeStatus(stripeStatus: string): SubscriptionStatus {
    const map: Record<string, SubscriptionStatus> = {
      active:             SubscriptionStatus.ACTIVE,
      trialing:           SubscriptionStatus.TRIALING,
      past_due:           SubscriptionStatus.PAST_DUE,
      unpaid:             SubscriptionStatus.UNPAID,
      canceled:           SubscriptionStatus.CANCELED,
      incomplete:         SubscriptionStatus.PAST_DUE,
      incomplete_expired: SubscriptionStatus.CANCELED,
      paused:             SubscriptionStatus.UNPAID,
    };
    return map[stripeStatus] ?? SubscriptionStatus.PAST_DUE;
  }
}
