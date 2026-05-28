import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

/**
 * AnalyticsService — reportes de progreso y uso de la plataforma por tenant.
 *
 * Todas las queries están scoped a tenantId. Las agregaciones se hacen
 * directamente en PostgreSQL vía Prisma para máxima eficiencia.
 */
@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resumen general del tenant: totales de cursos, empleados,
   * inscripciones activas y tasa de completado.
   */
  async getOverview(tenantId: string) {
    const [
      totalCourses,
      publishedCourses,
      totalUsers,
      activeEnrollments,
      completedEnrollments,
      totalLessons,
      totalCertificates,
    ] = await Promise.all([
      this.prisma.course.count({ where: { tenantId, deletedAt: null } }),
      this.prisma.course.count({ where: { tenantId, deletedAt: null, status: 'PUBLISHED' } }),
      // Solo empleados y managers — excluir OWNER/ADMIN para un reporte de capacitación real
      this.prisma.user.count({ where: { tenantId, deletedAt: null, isActive: true, role: { in: ['EMPLOYEE', 'MANAGER'] } } }),
      // Enrollment no tiene soft delete (usa status DROPPED), pero lo filtramos explícitamente
      this.prisma.enrollment.count({ where: { tenantId, status: 'ACTIVE' } }),
      this.prisma.enrollment.count({ where: { tenantId, status: 'COMPLETED' } }),
      this.prisma.lesson.count({ where: { tenantId, deletedAt: null } }),
      this.prisma.certificate.count({ where: { tenantId } }),
    ]);

    const totalEnrollments = activeEnrollments + completedEnrollments;
    const completionRate = totalEnrollments > 0
      ? Math.round((completedEnrollments / totalEnrollments) * 100)
      : 0;

    return {
      totalCourses,
      publishedCourses,
      totalUsers,
      totalEnrollments,
      completedEnrollments,
      completionRate,
      totalLessons,
      totalCertificates,
    };
  }

  /**
   * Estadísticas por curso: inscritos, completados, progreso promedio,
   * total de lecciones.
   */
  async getCourseStats(tenantId: string) {
    const courses = await this.prisma.course.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        status: true,
        totalLessons: true,
        thumbnailUrl: true,
        enrollments: {
          // Excluir inscripciones canceladas para no inflar los contadores
          where:  { status: { not: 'DROPPED' } },
          select: { status: true, progress: true },
        },
      },
    });

    return courses.map(course => {
      const enrolled   = course.enrollments.length;
      const completed  = course.enrollments.filter(e => e.status === 'COMPLETED').length;
      const avgProgress = enrolled > 0
        ? Math.round(course.enrollments.reduce((sum, e) => sum + e.progress, 0) / enrolled)
        : 0;
      const completionRate = enrolled > 0
        ? Math.round((completed / enrolled) * 100)
        : 0;

      return {
        id:             course.id,
        title:          course.title,
        status:         course.status,
        totalLessons:   course.totalLessons,
        thumbnailUrl:   course.thumbnailUrl,
        enrolled,
        completed,
        avgProgress,
        completionRate,
      };
    });
  }

  /**
   * Feed de actividad reciente del tenant — últimos 30 días, máx. `limit` eventos.
   *
   * Fusiona 4 tipos de eventos (inscripción, completado, certificado, nuevo usuario),
   * los ordena por timestamp descendente y devuelve los más recientes.
   * Sin tabla separada — todo se deriva de las relaciones existentes.
   */
  async getActivity(tenantId: string, limit = 20) {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const [enrollments, completions, certificates, newUsers] = await Promise.all([
      this.prisma.enrollment.findMany({
        where: { tenantId, createdAt: { gte: since }, status: { not: 'DROPPED' } },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id:        true,
          createdAt: true,
          user:      { select: { firstName: true, lastName: true } },
          course:    { select: { title: true } },
        },
      }),
      this.prisma.enrollment.findMany({
        where: { tenantId, completedAt: { gte: since }, status: 'COMPLETED' },
        orderBy: { completedAt: 'desc' },
        take: limit,
        select: {
          id:          true,
          completedAt: true,
          user:        { select: { firstName: true, lastName: true } },
          course:      { select: { title: true } },
        },
      }),
      this.prisma.certificate.findMany({
        where: { tenantId, issuedAt: { gte: since } },
        orderBy: { issuedAt: 'desc' },
        take: limit,
        select: { id: true, issuedAt: true, recipientName: true, courseTitle: true },
      }),
      this.prisma.user.findMany({
        where: { tenantId, createdAt: { gte: since }, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: { id: true, createdAt: true, firstName: true, lastName: true },
      }),
    ]);

    type EventType = 'ENROLLMENT' | 'COMPLETION' | 'CERTIFICATE' | 'NEW_USER';
    interface ActivityEvent {
      type:      EventType;
      id:        string;
      userName:  string;
      detail:    string | null;
      timestamp: string;
    }

    const events: ActivityEvent[] = [
      ...enrollments.map(e => ({
        type:      'ENROLLMENT' as const,
        id:        `enroll-${e.id}`,
        userName:  `${e.user.firstName} ${e.user.lastName}`,
        detail:    e.course.title,
        timestamp: e.createdAt.toISOString(),
      })),
      ...completions.map(e => ({
        type:      'COMPLETION' as const,
        id:        `complete-${e.id}`,
        userName:  `${e.user.firstName} ${e.user.lastName}`,
        detail:    e.course.title,
        timestamp: e.completedAt!.toISOString(),
      })),
      ...certificates.map(c => ({
        type:      'CERTIFICATE' as const,
        id:        `cert-${c.id}`,
        userName:  c.recipientName,
        detail:    c.courseTitle,
        timestamp: c.issuedAt.toISOString(),
      })),
      ...newUsers.map(u => ({
        type:      'NEW_USER' as const,
        id:        `user-${u.id}`,
        userName:  `${u.firstName} ${u.lastName}`,
        detail:    null,
        timestamp: u.createdAt.toISOString(),
      })),
    ];

    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return events.slice(0, limit);
  }

  /**
   * Datos históricos de los últimos 7 días para alimentar sparklines en el dashboard.
   *
   * Para cada día retorna: nuevas inscripciones, cursos completados, nuevos usuarios,
   * nuevos cursos y certificados emitidos. Usa 5 × 7 = 35 queries paralelas — aceptable
   * para el dashboard; en alta escala considerar materializar con Redis.
   */
  async getWeekly(tenantId: string) {
    const now  = new Date();
    // Generar los últimos 7 días (el más antiguo primero)
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (6 - i));
      d.setHours(0, 0, 0, 0);
      return d;
    });

    const ranges = days.map(day => {
      const next = new Date(day);
      next.setDate(next.getDate() + 1);
      return { gte: day, lt: next };
    });

    // Ejecutar todas las queries en paralelo
    const [enrollments, completions, users, courses, certificates] = await Promise.all([
      Promise.all(ranges.map(r =>
        this.prisma.enrollment.count({ where: { tenantId, createdAt: r, status: { not: 'DROPPED' } } })
      )),
      Promise.all(ranges.map(r =>
        this.prisma.enrollment.count({ where: { tenantId, completedAt: r, status: 'COMPLETED' } })
      )),
      Promise.all(ranges.map(r =>
        this.prisma.user.count({ where: { tenantId, createdAt: r, deletedAt: null } })
      )),
      Promise.all(ranges.map(r =>
        this.prisma.course.count({ where: { tenantId, createdAt: r, deletedAt: null } })
      )),
      Promise.all(ranges.map(r =>
        this.prisma.certificate.count({ where: { tenantId, issuedAt: r } })
      )),
    ]);

    return {
      labels:       days.map(d => d.toISOString().slice(5, 10)), // "MM-DD"
      enrollments,
      completions,
      users,
      courses,
      certificates,
    };
  }

  /**
   * Estadísticas por empleado: cursos inscritos, completados, progreso promedio.
   * Solo incluye usuarios con rol EMPLOYEE, MANAGER.
   */
  async getEmployeeStats(tenantId: string) {
    const users = await this.prisma.user.findMany({
      where: {
        tenantId,
        deletedAt: null,
        isActive: true,
        role: { in: ['EMPLOYEE', 'MANAGER'] },
      },
      orderBy: { firstName: 'asc' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        lastLoginAt: true,
        enrollments: {
          select: { status: true, progress: true, courseId: true },
        },
      },
    });

    return users.map(user => {
      const enrolled   = user.enrollments.length;
      const completed  = user.enrollments.filter(e => e.status === 'COMPLETED').length;
      const inProgress = user.enrollments.filter(e => e.status === 'ACTIVE' && e.progress > 0).length;
      const avgProgress = enrolled > 0
        ? Math.round(user.enrollments.reduce((sum, e) => sum + e.progress, 0) / enrolled)
        : 0;

      return {
        id:          user.id,
        name:        `${user.firstName} ${user.lastName}`,
        email:       user.email,
        role:        user.role,
        lastLoginAt: user.lastLoginAt,
        enrolled,
        completed,
        inProgress,
        avgProgress,
      };
    });
  }
}
