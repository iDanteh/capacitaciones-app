/**
 * PlanFeatureGuard
 *
 * Verifica que el plan activo del tenant tenga la feature solicitada.
 * Debe usarse DESPUÉS de JwtAuthGuard (necesita req.user) y con TenantMiddleware
 * activo (necesita req.tenantId).
 *
 * Si el tenant no tiene la feature, responde 403 con mensaje descriptivo.
 *
 * @example
 * @UseGuards(JwtAuthGuard, PlanFeatureGuard)
 * @RequireFeature('hasEvaluations')
 * async createEvaluation() {}
 */

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../database/prisma.service';
import { FEATURE_KEY, PlanFeatureKey } from '../decorators/require-feature.decorator';

@Injectable()
export class PlanFeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const feature = this.reflector.getAllAndOverride<PlanFeatureKey | undefined>(
      FEATURE_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Sin @RequireFeature() → el guard es transparente
    if (!feature) return true;

    const req = context.switchToHttp().getRequest<{ tenantId?: string }>();

    if (!req.tenantId) {
      throw new ForbiddenException(
        'No se pudo determinar el tenant. Asegúrate de enviar el header X-Tenant-Slug.',
      );
    }

    const subscription = await this.prisma.subscription.findUnique({
      where:   { tenantId: req.tenantId },
      include: { plan: true },
    });

    if (!subscription?.plan?.[feature]) {
      const featureLabels: Record<PlanFeatureKey, string> = {
        hasEvaluations:  'Evaluaciones',
        hasCertificates: 'Certificados',
        hasAnalytics:    'Analíticas',
        hasWhiteLabel:   'White-label',
        hasApi:          'Acceso a la API',
      };

      throw new ForbiddenException(
        `Tu plan actual no incluye: ${featureLabels[feature]}. Actualiza tu plan para acceder a esta funcionalidad.`,
      );
    }

    return true;
  }
}
