import { Injectable } from '@nestjs/common';
import { CourseStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

const RESULTS_PER_CATEGORY = 5;
const MIN_QUERY_LENGTH     = 2;

export interface SearchResults {
  query:        string;
  courses:      CourseResult[];
  users:        UserResult[];
  certificates: CertResult[];
}

export interface CourseResult {
  id:           string;
  title:        string;
  status:       string;
  thumbnailUrl: string | null;
  totalLessons: number;
}

export interface UserResult {
  id:        string;
  name:      string;
  email:     string;
  role:      string;
  avatarUrl: string | null;
}

export interface CertResult {
  id:            string;
  publicUuid:    string;
  recipientName: string;
  courseTitle:   string;
  issuedAt:      Date;
}

/**
 * SearchService — búsqueda global multi-entidad scoped a tenant.
 *
 * Búsqueda con `contains` + `mode: 'insensitive'` (ILIKE en PostgreSQL).
 * Role-aware:
 *  - EMPLOYEE: solo cursos PUBLISHED + sus propios certificados. Sin usuarios.
 *  - OWNER/ADMIN/MANAGER: cursos (todos los estados) + usuarios + todos los certificados.
 *
 * Se ejecutan las queries en paralelo — una sola roundtrip a BD por búsqueda.
 */
@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(
    tenantId: string,
    userId:   string,
    role:     string,
    q:        string,
  ): Promise<SearchResults> {
    const term = q.trim();

    if (term.length < MIN_QUERY_LENGTH) {
      return { query: term, courses: [], users: [], certificates: [] };
    }

    const isAdmin  = ['OWNER', 'ADMIN', 'MANAGER'].includes(role);
    const contains = { contains: term, mode: 'insensitive' as const };

    const [rawCourses, rawUsers, rawCerts] = await Promise.all([
      // ── Cursos ──────────────────────────────────────────────────────────────
      this.prisma.course.findMany({
        where: {
          tenantId,
          deletedAt: null,
          ...(isAdmin ? {} : { status: CourseStatus.PUBLISHED }),
          OR: [
            { title:       contains },
            { description: contains },
          ],
        },
        take:    RESULTS_PER_CATEGORY,
        orderBy: { updatedAt: 'desc' },
        select:  { id: true, title: true, status: true, thumbnailUrl: true, totalLessons: true },
      }),

      // ── Usuarios (solo admins) ───────────────────────────────────────────────
      isAdmin
        ? this.prisma.user.findMany({
            where: {
              tenantId,
              deletedAt: null,
              isActive:  true,
              OR: [
                { firstName: contains },
                { lastName:  contains },
                { email:     contains },
              ],
            },
            take:    RESULTS_PER_CATEGORY,
            orderBy: { firstName: 'asc' },
            select:  { id: true, firstName: true, lastName: true, email: true, role: true, avatarUrl: true },
          })
        : Promise.resolve([]),

      // ── Certificados ────────────────────────────────────────────────────────
      this.prisma.certificate.findMany({
        where: {
          tenantId,
          ...(isAdmin ? {} : { userId }),   // Employees solo ven los suyos
          OR: [
            { recipientName: contains },
            { courseTitle:   contains },
          ],
        },
        take:    RESULTS_PER_CATEGORY,
        orderBy: { issuedAt: 'desc' },
        select:  { id: true, publicUuid: true, recipientName: true, courseTitle: true, issuedAt: true },
      }),
    ]);

    return {
      query: term,
      courses: rawCourses.map(c => ({
        id:           c.id,
        title:        c.title,
        status:       c.status,
        thumbnailUrl: c.thumbnailUrl,
        totalLessons: c.totalLessons,
      })),
      users: rawUsers.map(u => ({
        id:        u.id,
        name:      `${u.firstName} ${u.lastName}`,
        email:     u.email,
        role:      u.role,
        avatarUrl: u.avatarUrl,
      })),
      certificates: rawCerts.map(c => ({
        id:            c.id,
        publicUuid:    c.publicUuid,
        recipientName: c.recipientName,
        courseTitle:   c.courseTitle,
        issuedAt:      c.issuedAt,
      })),
    };
  }
}
