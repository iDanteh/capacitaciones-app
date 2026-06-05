import { SetMetadata } from '@nestjs/common';
import type { Plan } from '@prisma/client';

/** Claves del Plan que representan feature flags */
export type PlanFeatureKey = Extract<keyof Plan,
  | 'hasEvaluations'
  | 'hasCertificates'
  | 'hasAnalytics'
  | 'hasWhiteLabel'
  | 'hasApi'
>;

export const FEATURE_KEY = 'requiredFeature';

/**
 * Restringe un endpoint a tenants cuyo plan tenga la feature activa.
 * Requiere PlanFeatureGuard + JwtAuthGuard activos en la ruta.
 *
 * @example
 * @UseGuards(JwtAuthGuard, PlanFeatureGuard)
 * @RequireFeature('hasEvaluations')
 * createEvaluation() {}
 */
export const RequireFeature = (feature: PlanFeatureKey) =>
  SetMetadata(FEATURE_KEY, feature);
