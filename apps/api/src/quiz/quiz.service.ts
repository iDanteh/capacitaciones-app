import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { CertificatesService } from '../certificates/certificates.service';
import { NotificationType, QuizAssignmentStatus, UserRole } from '@prisma/client';
import {
  CreateQuizDto,
  UpdateQuizDto,
  AddQuizQuestionDto,
  UpdateQuizQuestionDto,
  ReorderQuizQuestionsDto,
  AssignQuizDto,
  SubmitQuizAttemptDto,
} from './dto/quiz.dto';

@Injectable()
export class QuizService {
  private readonly logger = new Logger(QuizService.name);

  constructor(
    private readonly prisma:        PrismaService,
    private readonly notifications: NotificationsService,
    private readonly gateway:       NotificationsGateway,
    private readonly certificates:  CertificatesService,
  ) {}

  // ── Gestión de Quizzes (ADMIN/OWNER) ────────────────────────────────────────

  async createQuiz(tenantId: string, creatorId: string, dto: CreateQuizDto) {
    return this.prisma.quiz.create({
      data: { tenantId, createdById: creatorId, ...dto },
      include: { questions: { include: { options: true } } },
    });
  }

  async listQuizzes(tenantId: string) {
    return this.prisma.quiz.findMany({
      where:   { tenantId, deletedAt: null },
      include: {
        _count:    { select: { questions: true, assignments: true } },
        createdBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getQuiz(tenantId: string, quizId: string) {
    const quiz = await this.prisma.quiz.findFirst({
      where:   { id: quizId, tenantId, deletedAt: null },
      include: {
        questions: { orderBy: { order: 'asc' }, include: { options: { orderBy: { order: 'asc' } } } },
        createdBy: { select: { firstName: true, lastName: true } },
        _count:    { select: { assignments: true } },
      },
    });
    if (!quiz) throw new NotFoundException('Quiz no encontrado');
    return quiz;
  }

  async updateQuiz(tenantId: string, quizId: string, dto: UpdateQuizDto) {
    await this.assertQuizExists(tenantId, quizId);
    return this.prisma.quiz.update({ where: { id: quizId }, data: dto });
  }

  async deleteQuiz(tenantId: string, quizId: string) {
    await this.assertQuizExists(tenantId, quizId);
    await this.prisma.quiz.update({
      where: { id: quizId },
      data:  { deletedAt: new Date() },
    });
  }

  // ── Preguntas ──────────────────────────────────────────────────────────────

  async addQuestion(tenantId: string, quizId: string, dto: AddQuizQuestionDto) {
    await this.assertQuizExists(tenantId, quizId);

    const correctCount = dto.options.filter(o => o.isCorrect).length;
    if (correctCount !== 1) {
      throw new BadRequestException('Debe haber exactamente 1 opción correcta');
    }

    const lastOrder = await this.prisma.quizQuestion.count({ where: { quizId } });
    const { options, ...questionData } = dto;

    return this.prisma.quizQuestion.create({
      data: {
        quizId,
        tenantId,
        order: lastOrder,
        ...questionData,
        options: { create: options.map((o, i) => ({ ...o, order: o.order ?? i })) },
      },
      include: { options: { orderBy: { order: 'asc' } } },
    });
  }

  // ── Empleado: Detalle de asignación (read-only) ────────────────────────────

  async getAssignmentDetail(tenantId: string, assignmentId: string, userId: string) {
    const assignment = await this.prisma.quizAssignment.findFirst({
      where:   { id: assignmentId, tenantId, userId },
      include: {
        quiz:    { select: { id: true, title: true, description: true, instructions: true, timeLimit: true, minScore: true } },
        attempt: { select: { startedAt: true, submittedAt: true } },
      },
    });
    if (!assignment) throw new NotFoundException('Asignación no encontrada');
    return assignment;
  }

  async updateQuestion(tenantId: string, quizId: string, questionId: string, dto: UpdateQuizQuestionDto) {
    await this.assertQuestionBelongsToQuiz(tenantId, quizId, questionId);
    return this.prisma.quizQuestion.update({ where: { id: questionId }, data: dto });
  }

  async removeQuestion(tenantId: string, quizId: string, questionId: string) {
    await this.assertQuestionBelongsToQuiz(tenantId, quizId, questionId);
    await this.prisma.quizQuestion.delete({ where: { id: questionId } });
  }

  async reorderQuestions(tenantId: string, quizId: string, dto: ReorderQuizQuestionsDto) {
    await this.assertQuizExists(tenantId, quizId);

    const count = await this.prisma.quizQuestion.count({
      where: { id: { in: dto.orderedIds }, quizId, tenantId },
    });
    if (count !== dto.orderedIds.length) {
      throw new BadRequestException('IDs de preguntas inválidos');
    }

    await this.prisma.$transaction(
      dto.orderedIds.map((id, i) =>
        this.prisma.quizQuestion.update({ where: { id }, data: { order: i } }),
      ),
    );
  }

  // ── Asignaciones ────────────────────────────────────────────────────────────

  async assignToUsers(tenantId: string, quizId: string, assignerId: string, dto: AssignQuizDto) {
    const quiz = await this.assertQuizExists(tenantId, quizId);

    if (!quiz.isActive) {
      throw new BadRequestException('El quiz debe estar publicado antes de poder asignarse');
    }

    // Bulk: usuarios válidos del tenant en una sola query
    const users = await this.prisma.user.findMany({
      where:  { id: { in: dto.userIds }, tenantId, deletedAt: null },
      select: { id: true },
    });
    const validIds = new Set(users.map(u => u.id));

    // Bulk: asignaciones previas en una sola query
    const existing = await this.prisma.quizAssignment.findMany({
      where:  { quizId, userId: { in: [...validIds] } },
      select: { userId: true },
    });
    const alreadyAssigned = new Set(existing.map(a => a.userId));

    const toAssign = [...validIds].filter(id => !alreadyAssigned.has(id));
    const dueDate  = dto.dueDate ? new Date(dto.dueDate) : null;

    if (toAssign.length > 0) {
      await this.prisma.quizAssignment.createMany({
        data: toAssign.map(userId => ({ tenantId, quizId, userId, assignedById: assignerId, dueDate })),
        skipDuplicates: true,
      });

      // Notificaciones + evento WS en paralelo (fire-and-forget)
      toAssign.forEach(userId => {
        this.notifications.createForUser(
          userId, tenantId,
          NotificationType.QUIZ_ASSIGNED,
          'Tienes un nuevo Quiz asignado',
          `Se te asignó el quiz "${quiz.title}". Deberás completarlo en una sola sesión.`,
          { quizId },
        ).catch(() => undefined);

        // Evento dedicado para que QuizLockdown active el overlay sin esperar polling
        this.gateway.emitToUser(userId, 'quiz.assigned', { quizId, quizTitle: quiz.title });
      });
    }

    return dto.userIds.map(userId => ({
      userId,
      status: !validIds.has(userId)        ? 'not_found'
            : alreadyAssigned.has(userId)  ? 'already_assigned'
            : 'assigned',
    }));
  }

  async removeAssignment(tenantId: string, quizId: string, assignmentId: string) {
    const assignment = await this.prisma.quizAssignment.findFirst({
      where: { id: assignmentId, tenantId, quizId },
    });
    if (!assignment) throw new NotFoundException('Asignación no encontrada');
    if (assignment.status === QuizAssignmentStatus.COMPLETED) {
      throw new BadRequestException('No se puede eliminar una asignación ya completada');
    }
    await this.prisma.quizAssignment.delete({ where: { id: assignmentId } });
  }

  async getAssignments(tenantId: string, quizId: string) {
    await this.assertQuizExists(tenantId, quizId);
    return this.prisma.quizAssignment.findMany({
      where:   { quizId, tenantId },
      include: {
        user:    { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
        attempt: { select: { score: true, passed: true, submittedAt: true } },
      },
      orderBy: { assignedAt: 'desc' },
    });
  }

  // ── Empleado: Mis asignaciones ─────────────────────────────────────────────

  async getMyAssignments(tenantId: string, userId: string) {
    return this.prisma.quizAssignment.findMany({
      where:   { tenantId, userId, status: { in: [QuizAssignmentStatus.PENDING, QuizAssignmentStatus.IN_PROGRESS] } },
      include: {
        quiz: {
          select: { id: true, title: true, description: true, instructions: true, timeLimit: true, minScore: true },
        },
        attempt: { select: { startedAt: true } },
      },
      orderBy: [{ dueDate: 'asc' }, { assignedAt: 'asc' }],
    });
  }

  // ── Empleado: Iniciar intento ──────────────────────────────────────────────

  async startAttempt(tenantId: string, assignmentId: string, userId: string) {
    const assignment = await this.prisma.quizAssignment.findFirst({
      where:   { id: assignmentId, tenantId, userId },
      include: {
        quiz: {
          include: {
            questions: {
              where:   { quiz: { deletedAt: null } },
              orderBy: { order: 'asc' },
              include: { options: { orderBy: { order: 'asc' }, select: { id: true, text: true, order: true } } },
            },
          },
        },
      },
    });

    if (!assignment) throw new NotFoundException('Asignación no encontrada');
    if (assignment.status === QuizAssignmentStatus.COMPLETED) {
      throw new ForbiddenException('Ya completaste este quiz. Solo se permite un intento.');
    }

    // Si ya tiene intento IN_PROGRESS, devolver el mismo (no crear uno nuevo)
    if (assignment.status === QuizAssignmentStatus.IN_PROGRESS) {
      const existingAttempt = await this.prisma.quizAttempt.findUnique({ where: { assignmentId } });
      return { assignment, attempt: existingAttempt };
    }

    // Crear el intento y marcar como IN_PROGRESS
    const [attempt] = await this.prisma.$transaction([
      this.prisma.quizAttempt.create({
        data: { tenantId, assignmentId, userId, quizId: assignment.quizId },
      }),
      this.prisma.quizAssignment.update({
        where: { id: assignmentId },
        data:  { status: QuizAssignmentStatus.IN_PROGRESS, startedAt: new Date() },
      }),
    ]);

    return { assignment, attempt };
  }

  // ── Empleado: Enviar respuestas ────────────────────────────────────────────

  async submitAttempt(tenantId: string, assignmentId: string, userId: string, dto: SubmitQuizAttemptDto) {
    const assignment = await this.prisma.quizAssignment.findFirst({
      where:   { id: assignmentId, tenantId, userId },
      include: { quiz: { include: { questions: { include: { options: true } } } } },
    });

    if (!assignment) throw new NotFoundException('Asignación no encontrada');
    if (assignment.status === QuizAssignmentStatus.COMPLETED) {
      throw new ForbiddenException('Ya completaste este quiz. Solo se permite un intento.');
    }
    if (assignment.status !== QuizAssignmentStatus.IN_PROGRESS) {
      throw new BadRequestException('Debes iniciar el quiz antes de enviar respuestas');
    }

    const attempt = await this.prisma.quizAttempt.findUnique({ where: { assignmentId } });
    if (!attempt) throw new NotFoundException('Intento no encontrado');
    if (attempt.submittedAt) throw new ConflictException('Este intento ya fue enviado');

    // Validar tiempo límite server-side (30 s de margen para latencia de red)
    if (assignment.quiz.timeLimit) {
      const elapsed = (Date.now() - attempt.startedAt.getTime()) / 1000;
      if (elapsed > assignment.quiz.timeLimit + 30) {
        throw new ForbiddenException('Tiempo límite excedido');
      }
    }

    // Evitar respuestas duplicadas por pregunta antes de tocar la BD
    const submittedIds = dto.answers.map(a => a.questionId);
    if (new Set(submittedIds).size !== submittedIds.length) {
      throw new BadRequestException('No se permiten respuestas duplicadas por pregunta');
    }

    const questions = assignment.quiz.questions;
    let correctCount = 0;
    const answerRecords = [];

    for (const question of questions) {
      const answer = dto.answers.find(a => a.questionId === question.id);
      if (!answer) continue;

      const option = question.options.find(o => o.id === answer.optionId);
      if (!option) throw new BadRequestException(`Opción inválida para pregunta ${question.id}`);

      const isCorrect = option.isCorrect;
      if (isCorrect) correctCount++;

      answerRecords.push({
        attemptId:  attempt.id,
        questionId: question.id,
        optionId:   answer.optionId,
        isCorrect,
      });
    }

    const score  = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;
    const passed = score >= assignment.quiz.minScore;
    const now    = new Date();

    await this.prisma.$transaction([
      this.prisma.quizAttempt.update({
        where: { id: attempt.id },
        data:  { score, passed, submittedAt: now },
      }),
      this.prisma.quizAssignment.update({
        where: { id: assignmentId },
        data:  { status: QuizAssignmentStatus.COMPLETED },
      }),
      this.prisma.quizAttemptAnswer.createMany({ data: answerRecords }),
    ]);

    // Notificar a todos los admins/managers del tenant (fire-and-forget)
    this.notifications.createForAdmins(
      tenantId,
      NotificationType.QUIZ_COMPLETED,
      'Empleado completó un quiz',
      `El quiz "${assignment.quiz.title}" fue completado. Calificación: ${score}% (${passed ? 'Aprobado' : 'Reprobado'})`,
      { quizId: assignment.quizId, assignmentId },
    ).catch(() => undefined);

    // Generar certificado si aprobó (fire-and-forget en caso de error)
    let certificate: { id: string; publicUuid: string; verifyUrl: string } | null = null;
    if (passed) {
      try {
        const cert = await this.certificates.generateQuizCertificate(
          tenantId,
          userId,
          assignment.quizId,
          assignmentId,
          assignment.quiz.title,
        );
        if (cert) {
          certificate = { id: cert.id, publicUuid: cert.publicUuid, verifyUrl: cert.verifyUrl };
        }
      } catch (err) {
        this.logger.warn(`No se pudo generar certificado para assignment ${assignmentId}: ${err}`);
      }
    }

    return {
      score,
      passed,
      minScore: assignment.quiz.minScore,
      certificate,
      answers: questions.map(q => {
        const userAnswer = answerRecords.find(a => a.questionId === q.id);
        const correctOpt = q.options.find(o => o.isCorrect);
        return {
          questionId:        q.id,
          optionId:          userAnswer?.optionId   ?? null,
          isCorrect:         userAnswer?.isCorrect  ?? false,
          correctOptionId:   correctOpt?.id         ?? null,
          correctOptionText: correctOpt?.text       ?? null,
          explanation:       q.explanation          ?? null,
        };
      }),
    };
  }

  // ── Empleado: Historial de quizzes completados ────────────────────────────

  async getMyResults(tenantId: string, userId: string) {
    return this.prisma.quizAssignment.findMany({
      where: { tenantId, userId, status: QuizAssignmentStatus.COMPLETED },
      select: {
        id:         true,
        assignedAt: true,
        dueDate:    true,
        quiz: {
          select: { id: true, title: true, description: true, minScore: true, timeLimit: true },
        },
        attempt: {
          select: {
            id:          true,
            score:       true,
            passed:      true,
            startedAt:   true,
            submittedAt: true,
            answers: {
              select: {
                isCorrect: true,
                question: {
                  select: {
                    id:          true,
                    text:        true,
                    explanation: true,
                    order:       true,
                    options: {
                      select:  { id: true, text: true, isCorrect: true },
                      orderBy: { order: 'asc' },
                    },
                  },
                },
                option: { select: { id: true, text: true } },
              },
              orderBy: { question: { order: 'asc' } },
            },
          },
        },
        certificate: { select: { id: true, publicUuid: true } },
      },
      orderBy: { assignedAt: 'desc' },
    });
  }

  // ── Admin: Resultados ──────────────────────────────────────────────────────

  async getResults(tenantId: string, quizId: string) {
    await this.assertQuizExists(tenantId, quizId);
    return this.prisma.quizAssignment.findMany({
      where:   { quizId, tenantId },
      include: {
        user:    { select: { id: true, firstName: true, lastName: true, email: true } },
        attempt: {
          select: { score: true, passed: true, startedAt: true, submittedAt: true },
        },
      },
      orderBy: { assignedAt: 'desc' },
    });
  }

  // ── Admin: Empleados asignables ───────────────────────────────────────────

  async getAssignableEmployees(tenantId: string) {
    const employees = await this.prisma.user.findMany({
      where:   { tenantId, role: UserRole.EMPLOYEE, deletedAt: null, isActive: true },
      select:  { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    return { employees };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async assertQuizExists(tenantId: string, quizId: string) {
    const quiz = await this.prisma.quiz.findFirst({ where: { id: quizId, tenantId, deletedAt: null } });
    if (!quiz) throw new NotFoundException('Quiz no encontrado');
    return quiz;
  }

  private async assertQuestionBelongsToQuiz(tenantId: string, quizId: string, questionId: string) {
    const q = await this.prisma.quizQuestion.findFirst({ where: { id: questionId, quizId, tenantId } });
    if (!q) throw new NotFoundException('Pregunta no encontrada');
    return q;
  }
}
