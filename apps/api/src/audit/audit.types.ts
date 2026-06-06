// ─────────────────────────────────────────────────────────────────────────────
// Audit Trail — tipos compartidos
// ─────────────────────────────────────────────────────────────────────────────

/** Catálogo de acciones auditables. Prefijadas por dominio para facilitar filtros. */
export enum AuditAction {
  // ── Autenticación ──────────────────────────────────────────────────────────
  USER_REGISTERED       = 'USER_REGISTERED',
  USER_LOGIN            = 'USER_LOGIN',
  USER_LOGIN_FAILED     = 'USER_LOGIN_FAILED',
  USER_LOGOUT           = 'USER_LOGOUT',
  TENANT_SWITCHED       = 'TENANT_SWITCHED',

  // ── Autenticación multifactor ─────────────────────────────────────────────
  MFA_CHALLENGE         = 'MFA_CHALLENGE',    // login pausado — esperando 2FA
  MFA_VERIFIED          = 'MFA_VERIFIED',     // 2FA completado correctamente
  MFA_SETUP             = 'MFA_SETUP',        // usuario inició setup de 2FA
  MFA_CONFIRMED         = 'MFA_CONFIRMED',    // 2FA activado con éxito
  MFA_DISABLED          = 'MFA_DISABLED',     // 2FA desactivado

  // ── Gestión de usuarios ───────────────────────────────────────────────────
  USER_UPDATED          = 'USER_UPDATED',
  USER_DELETED          = 'USER_DELETED',
  USER_PASSWORD_CHANGED = 'USER_PASSWORD_CHANGED',

  // ── Invitaciones ─────────────────────────────────────────────────────────
  USER_INVITED          = 'USER_INVITED',
  USER_BULK_INVITED     = 'USER_BULK_INVITED',
  INVITE_ACCEPTED       = 'INVITE_ACCEPTED',
  INVITE_CANCELLED      = 'INVITE_CANCELLED',
}

export interface AuditLogParams {
  action:    AuditAction;
  /** null cuando la acción ocurre antes de autenticar (ej. login fallido). */
  userId?:   string;
  /** null para acciones de SUPER_ADMIN o en rutas pre-autenticación. */
  tenantId?: string;
  /** Nombre del modelo Prisma afectado: "User", "Course", "Tenant", etc. */
  entity?:   string;
  /** ID del registro afectado. */
  entityId?: string;
  /** Datos extra: email, valores anteriores/nuevos, conteos, etc. */
  meta?:     Record<string, unknown>;
}
