// ─────────────────────────────────────────────────────────────────────────────
// @capacitaciones/types — Tipos compartidos entre frontend y backend.
//
// Regla: este paquete NO importa nada externo ni de Prisma.
// Es puro TypeScript. El backend usa los enums de Prisma como fuente de verdad
// para la DB; estos enums son el contrato hacia el frontend.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Enums ────────────────────────────────────────────────────────────────────

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN', // Equipo interno de la plataforma
  OWNER       = 'OWNER',       // Dueño del tenant, gestiona suscripción
  ADMIN       = 'ADMIN',       // Administrador del tenant
  MANAGER     = 'MANAGER',     // Supervisor con acceso a reportes
  EMPLOYEE    = 'EMPLOYEE',    // Estudiante / empleado
}

export enum PlanType {
  FREE       = 'FREE',
  BUSINESS   = 'BUSINESS',
  ENTERPRISE = 'ENTERPRISE',
}

export enum SubscriptionStatus {
  TRIALING = 'TRIALING',
  ACTIVE   = 'ACTIVE',
  PAST_DUE = 'PAST_DUE',
  UNPAID   = 'UNPAID',
  CANCELED = 'CANCELED',
}

export enum ContentType {
  VIDEO    = 'VIDEO',
  DOCUMENT = 'DOCUMENT',
  TEXT     = 'TEXT',
}

export enum QuestionType {
  SINGLE_CHOICE   = 'SINGLE_CHOICE',
  MULTIPLE_CHOICE = 'MULTIPLE_CHOICE',
  TRUE_FALSE      = 'TRUE_FALSE',
}

// ─── API Utilities ─────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  search?: string;
}

// ─── Plan Limits ───────────────────────────────────────────────────────────────

/// Límites estáticos por plan. La fuente de verdad en producción es la DB,
/// estos valores son para validaciones en el frontend sin necesidad de API call.
export const PLAN_LIMITS: Record<
  PlanType,
  { maxCompanies: number; maxEmployees: number; maxStorageGb: number }
> = {
  [PlanType.FREE]:       { maxCompanies: 1,  maxEmployees: 15,  maxStorageGb: 1  },
  [PlanType.BUSINESS]:   { maxCompanies: 5,  maxEmployees: 500, maxStorageGb: 20 },
  [PlanType.ENTERPRISE]: { maxCompanies: -1, maxEmployees: -1,  maxStorageGb: -1 }, // -1 = ilimitado
};

// ─── Role Hierarchy ────────────────────────────────────────────────────────────

/// Jerarquía numérica de roles. Mayor número = más permisos.
/// Útil para comparaciones de autorización en guards del frontend.
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.EMPLOYEE]:    1,
  [UserRole.MANAGER]:     2,
  [UserRole.ADMIN]:       3,
  [UserRole.OWNER]:       4,
  [UserRole.SUPER_ADMIN]: 99,
};

/// Roles con capacidad de administrar el tenant (crear usuarios, cursos, etc.)
export const TENANT_ADMIN_ROLES: UserRole[] = [
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.SUPER_ADMIN,
];
