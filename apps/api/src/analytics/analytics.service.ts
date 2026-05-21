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
    ] = await Promise.all([
      this.prisma.course.count({ where: { tenantId, deletedAt: null } }),
      this.prisma.course.count({ where: { tenantId, deletedAt: null, status: 'PUBLISHED' } }),
      // Solo empleados y managers — excluir OWNER/ADMIN para un reporte de capacitación real
      this.prisma.user.count({ where: { tenantId, deletedAt: null, isActive: true, role: { in: ['EMPLOYEE', 'MANAGER'] } } }),
      // Enrollment no tiene soft delete (usa status DROPPED), pero lo filtramos explícitamente
      this.prisma.enrollment.count({ where: { tenantId, status: 'ACTIVE' } }),
      this.prisma.enrollment.count({ where: { tenantId, status: 'COMPLETED' } }),
      this.prisma.lesson.count({ where: { tenantId, deletedAt: null } }),
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
