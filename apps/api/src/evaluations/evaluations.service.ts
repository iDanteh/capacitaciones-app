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
import { NotificationType } from '@prisma/client';
import {
  CreateEvaluationDto,
  UpdateEvaluationDto,
  CreateQuestionDto,
  UpdateQuestionDto,
  ReorderQuestionsDto,
} from './dto/create-evaluation.dto';
import { SubmitAttemptDto } from './dto/submit-attempt.dto';
import {
  EvaluationForStudentDto,
  EvaluationForAdminDto,
  AttemptResultDto,
  AnswerResultDto,
  QuestionForStudentDto,
  QuestionForAdminDto,
  OptionForStudentDto,
  OptionForAdminDto,
  ResetRequestDto,
} from './dto/evaluation-response.dto';

/**
 * EvaluationsService — gestión de quizzes y evaluaciones.
 *
 * Flujo de seguridad:
 *  - Estudiante: recibe las preguntas SIN marcar cuál opción es correcta.
 *  - Al enviar respuestas: el servidor valida, calcula score y devuelve resultado.
 *  - Admin: recibe la evaluación completa CON isCorrect en cada opción.
 *
 * Flujo de scoring:
 *  score = Σ(puntos de preguntas correctas) / Σ(puntos totales) × 100
 *  passed = score >= evaluation.minScore
 */
@Injectable()
export class EvaluationsService {
  private readonly logger = new Logger(EvaluationsService.name);

  constructor(
    private readonly prisma:         PrismaService,
    private readonly notifications:  NotificationsService,
  ) {}

  // ── CRUD (ADMIN/OWNER) ───────────────────────────────────────────────────────

  async create(
    tenantId: string,
    lessonId: string,
    dto: CreateEvaluationDto,
  ): Promise<EvaluationForAdminDto> {
    // Verificar que la lección existe y pertenece al tenant
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, tenantId, deletedAt: null },
    });
    if (!lesson) throw new NotFoundException('Lección no encontrada');

    // Verificar que no exista ya una evaluación para esta lección
    const existing = await this.prisma.evaluation.findUnique({
      where: { lessonId },
    });
    if (existing) {
      throw new BadRequestException('Esta lección ya tiene una evaluación asignada');
    }

    const evaluation = await this.prisma.evaluation.create({
      data: {
        tenantId,
        lessonId,
        title:        dto.title,
        instructions: dto.instructions,
        minScore:     dto.minScore   ?? 70,
        maxAttempts:  dto.maxAttempts ?? 3,
        timeLimit:    dto.timeLimit,
        isRequired:   dto.isRequired ?? false,
        questions: dto.questions?.length
          ? {
              create: dto.questions.map((q, qi) => ({
                tenantId,
                text:        q.text,
                points:      q.points ?? 1,
                order:       q.order  ?? qi,
                explanation: q.explanation,
                options: {
                  create: q.options.map((o, oi) => ({
                    text:      o.text,
                    isCorrect: o.isCorrect,
                    order:     o.order ?? oi,
                  })),
                },
              })),
            }
          : undefined,
      },
      include: this.adminInclude(),
    });

    return this.toAdminDto(evaluation);
  }

  async findByLesson(tenantId: string, lessonId: string): Promise<EvaluationForAdminDto | null> {
    const evaluation = await this.prisma.evaluation.findFirst({
      where: { lessonId, tenantId },
      include: this.adminInclude(),
    });
    return evaluation ? this.toAdminDto(evaluation) : null;
  }

  async update(
    tenantId: string,
    evaluationId: string,
    dto: UpdateEvaluationDto,
  ): Promise<EvaluationForAdminDto> {
    await this.ensureEvaluationAccess(tenantId, evaluationId);

    const updated = await this.prisma.evaluation.update({
      where: { id: evaluationId },
      data: {
        title:        dto.title,
        instructions: dto.instructions,
        minScore:     dto.minScore,
        maxAttempts:  dto.maxAttempts,
        timeLimit:    dto.timeLimit,
        isRequired:   dto.isRequired,
      },
      include: this.adminInclude(),
    });

    return this.toAdminDto(updated);
  }

  async remove(tenantId: string, evaluationId: string): Promise<void> {
    await this.ensureEvaluationAccess(tenantId, evaluationId);
    await this.prisma.evaluation.delete({ where: { id: evaluationId } });
  }

  // ── Gestión de preguntas ─────────────────────────────────────────────────────

  async addQuestion(
    tenantId: string,
    evaluationId: string,
    dto: CreateQuestionDto,
  ): Promise<EvaluationForAdminDto> {
    const evaluation = await this.ensureEvaluationAccess(tenantId, evaluationId);

    const questionCount = await this.prisma.question.count({
      where: { evaluationId },
    });

    await this.prisma.question.create({
      data: {
        evaluationId,
        tenantId,
        text:        dto.text,
        points:      dto.points ?? 1,
        order:       dto.order  ?? questionCount,
        explanation: dto.explanation,
        options: {
          create: dto.options.map((o, i) => ({
            text:      o.text,
            isCorrect: o.isCorrect,
            order:     o.order ?? i,
          })),
        },
      },
    });

    const updated = await this.prisma.evaluation.findUnique({
      where: { id: evaluation.id },
      include: this.adminInclude(),
    });

    return this.toAdminDto(updated!);
  }

  async removeQuestion(
    tenantId: string,
    evaluationId: string,
    questionId: string,
  ): Promise<void> {
    await this.ensureEvaluationAccess(tenantId, evaluationId);

    const question = await this.prisma.question.findFirst({
      where: { id: questionId, evaluationId, tenantId },
    });
    if (!question) throw new NotFoundException('Pregunta no encontrada');

    await this.prisma.question.delete({ where: { id: questionId } });
  }

  // ── Vista para estudiante ────────────────────────────────────────────────────

  async getForStudent(
    tenantId: string,
    userId: string,
    lessonId: string,
  ): Promise<EvaluationForStudentDto | null> {
    const evaluation = await this.prisma.evaluation.findFirst({
      where: { lessonId, tenantId },
      include: {
        questions: {
          orderBy: { order: 'asc' },
          include: {
            options: { orderBy: { order: 'asc' } },
          },
        },
      },
    });

    if (!evaluation) return null;

    // Contar intentos del usuario y obtener mejor puntaje
    const attempts = await this.prisma.evaluationAttempt.findMany({
      where: { evaluationId: evaluation.id, userId, tenantId },
      orderBy: { completedAt: 'desc' },
    });

    const attemptsUsed = attempts.length;
    const bestScore    = attemptsUsed > 0 ? Math.max(...attempts.map(a => a.score)) : null;
    const passed       = attempts.some(a => a.passed);

    // Verificar si ya hay una solicitud de reinicio pendiente para este usuario
    const pendingReset = await this.prisma.attemptResetRequest.findFirst({
      where: { evaluationId: evaluation.id, userId, status: 'PENDING' },
    });
    const hasPendingResetRequest = pendingReset !== null;

    // Mezclar el orden de las preguntas para dificultar memorización
    const questions: QuestionForStudentDto[] = evaluation.questions.map(q => ({
      id:          q.id,
      text:        q.text,
      points:      q.points,
      order:       q.order,
      explanation: null, // Se revelará solo tras enviar el intento
      options:     q.options.map((o): OptionForStudentDto => ({
        id:    o.id,
        text:  o.text,
        order: o.order,
      })),
    }));

    return {
      id:           evaluation.id,
      title:        evaluation.title,
      instructions: evaluation.instructions,
      minScore:     evaluation.minScore,
      maxAttempts:  evaluation.maxAttempts,
      timeLimit:    evaluation.timeLimit,
      isRequired:   evaluation.isRequired,
      questions,
      attemptsUsed,
      bestScore,
      passed,
      hasPendingResetRequest,
    };
  }

  // ── Enviar intento ───────────────────────────────────────────────────────────

  async submitAttempt(
    tenantId: string,
    userId: string,
    evaluationId: string,
    dto: SubmitAttemptDto,
  ): Promise<AttemptResultDto> {
    // 1. Cargar evaluación con preguntas y opciones correctas
    const evaluation = await this.prisma.evaluation.findFirst({
      where: { id: evaluationId, tenantId },
      include: {
        questions: {
          include: { options: true },
        },
      },
    });

    if (!evaluation) throw new NotFoundException('Evaluación no encontrada');

    // 2. Verificar límite de intentos
    const prevAttempts = await this.prisma.evaluationAttempt.count({
      where: { evaluationId, userId, tenantId },
    });

    if (evaluation.maxAttempts !== -1 && prevAttempts >= evaluation.maxAttempts) {
      throw new ForbiddenException(
        `Has alcanzado el límite de ${evaluation.maxAttempts} intentos para esta evaluación.`,
      );
    }

    // 3. Verificar que el enrollment pertenece al usuario
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { id: dto.enrollmentId, userId, tenantId },
    });
    if (!enrollment) throw new ForbiddenException('Inscripción no válida');

    // 4. Calcular score
    let totalPoints   = 0;
    let earnedPoints  = 0;
    const answerResults: AnswerResultDto[] = [];

    for (const question of evaluation.questions) {
      totalPoints += question.points;

      const submittedAnswer = dto.answers.find(a => a.questionId === question.id);
      if (!submittedAnswer) {
        // Pregunta no respondida — cuenta como incorrecta
        const correctOption = question.options.find(o => o.isCorrect);
        answerResults.push({
          questionId:      question.id,
          questionText:    question.text,
          selectedOptionId: '',
          isCorrect:       false,
          explanation:     question.explanation,
          correctOptionId: correctOption?.id ?? '',
        });
        continue;
      }

      const selectedOption = question.options.find(o => o.id === submittedAnswer.optionId);
      if (!selectedOption) {
        throw new BadRequestException(`Opción inválida para la pregunta ${question.id}`);
      }

      const isCorrect = selectedOption.isCorrect;
      if (isCorrect) earnedPoints += question.points;

      const correctOption = question.options.find(o => o.isCorrect);
      answerResults.push({
        questionId:       question.id,
        questionText:     question.text,
        selectedOptionId: selectedOption.id,
        isCorrect,
        explanation:      question.explanation,
        correctOptionId:  correctOption?.id ?? '',
      });
    }

    const score  = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
    const passed = score >= evaluation.minScore;

    // 5. Guardar intento
    const attempt = await this.prisma.evaluationAttempt.create({
      data: {
        tenantId,
        evaluationId,
        userId,
        enrollmentId: dto.enrollmentId,
        score,
        passed,
        answers: {
          create: answerResults
            .filter(a => a.selectedOptionId) // Solo respuestas enviadas
            .map(a => ({
              questionId: a.questionId,
              optionId:   a.selectedOptionId,
              isCorrect:  a.isCorrect,
            })),
        },
      },
    });

    const attemptsUsed = prevAttempts + 1;
    const attemptsRemaining = evaluation.maxAttempts === -1
      ? null
      : Math.max(0, evaluation.maxAttempts - attemptsUsed);

    const message = passed
      ? `¡Felicitaciones! Obtuviste ${score}% — superaste el mínimo de ${evaluation.minScore}%.`
      : attemptsRemaining === 0
        ? `Obtuviste ${score}%. No superaste el mínimo (${evaluation.minScore}%) y no tienes más intentos.`
        : `Obtuviste ${score}%. Necesitas al menos ${evaluation.minScore}% para aprobar.`;

    this.logger.log(
      `Intento ${attemptsUsed} — usuario ${userId}, evaluación ${evaluationId}, score=${score}, passed=${passed}`,
    );

    return {
      attemptId:         attempt.id,
      score,
      passed,
      minScore:          evaluation.minScore,
      completedAt:       attempt.completedAt,
      answers:           answerResults,
      message,
      attemptsUsed,
      attemptsRemaining,
    };
  }

  // ── Historial de intentos ────────────────────────────────────────────────────

  async getMyAttempts(
    tenantId: string,
    userId: string,
    evaluationId: string,
  ): Promise<{ attemptId: string; score: number; passed: boolean; completedAt: Date }[]> {
    const attempts = await this.prisma.evaluationAttempt.findMany({
      where: { evaluationId, userId, tenantId },
      orderBy: { completedAt: 'desc' },
    });

    return attempts.map(a => ({
      attemptId:   a.id,
      score:       a.score,
      passed:      a.passed,
      completedAt: a.completedAt,
    }));
  }

  // ── Solicitudes de reinicio de intentos ────────────────────────────────────

  /**
   * El estudiante solicita una nueva oportunidad cuando ha agotado sus intentos.
   * Solo se permite una solicitud PENDING por usuario+evaluación.
   */
  async createResetRequest(
    tenantId: string,
    userId: string,
    evaluationId: string,
    message?: string,
  ): Promise<{ id: string }> {
    const evaluation = await this.prisma.evaluation.findFirst({
      where: { id: evaluationId, tenantId },
    });
    if (!evaluation) throw new NotFoundException('Evaluación no encontrada');

    if (evaluation.maxAttempts === -1) {
      throw new BadRequestException('Esta evaluación tiene intentos ilimitados.');
    }

    const attemptCount = await this.prisma.evaluationAttempt.count({
      where: { evaluationId, userId, tenantId },
    });
    if (attemptCount < evaluation.maxAttempts) {
      throw new BadRequestException('Aún tienes intentos disponibles.');
    }

    const existing = await this.prisma.attemptResetRequest.findFirst({
      where: { evaluationId, userId, status: 'PENDING' },
    });
    if (existing) {
      throw new ConflictException('Ya tienes una solicitud pendiente para esta evaluación.');
    }

    const req = await this.prisma.attemptResetRequest.create({
      data: { tenantId, evaluationId, userId, message },
    });

    // Obtener contexto de la evaluación para la notificación
    const evalWithContext = await this.prisma.evaluation.findUnique({
      where: { id: evaluationId },
      include: {
        lesson: {
          include: {
            module: { include: { course: { select: { id: true, title: true } } } },
          },
        },
      },
    });
    const student = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });

    const studentName = student ? `${student.firstName} ${student.lastName}` : 'Un estudiante';
    const courseId    = evalWithContext?.lesson.module.course.id;
    const lessonId    = evalWithContext?.lessonId;

    await this.notifications.createForAdmins(
      tenantId,
      NotificationType.RESET_REQUEST,
      'Solicitud de nueva oportunidad',
      `${studentName} solicita repetir la evaluación "${evalWithContext?.title ?? ''}"`,
      { courseId, lessonId, evaluationId, studentName },
    );

    this.logger.log(`Solicitud de reinicio creada — usuario ${userId}, evaluación ${evaluationId}`);
    return { id: req.id };
  }

  /** Admin: lista todas las solicitudes PENDING de una evaluación con datos del usuario. */
  async listPendingResets(tenantId: string, evaluationId: string): Promise<ResetRequestDto[]> {
    await this.ensureEvaluationAccess(tenantId, evaluationId);

    const requests = await this.prisma.attemptResetRequest.findMany({
      where: { evaluationId, tenantId, status: 'PENDING' },
      orderBy: { requestedAt: 'asc' },
    });

    if (requests.length === 0) return [];

    const userIds = [...new Set(requests.map(r => r.userId))];
    const users   = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true, email: true },
    });
    const userMap = new Map(users.map(u => [u.id, u]));

    return requests.map(r => {
      const u = userMap.get(r.userId);
      return {
        id:          r.id,
        userId:      r.userId,
        userName:    u ? `${u.firstName} ${u.lastName}` : 'Usuario desconocido',
        userEmail:   u?.email ?? '',
        message:     r.message,
        requestedAt: r.requestedAt,
      };
    });
  }

  /**
   * Admin aprueba la solicitud: elimina TODOS los intentos del usuario
   * para esa evaluación y marca la solicitud como APPROVED.
   */
  async approveReset(
    tenantId: string,
    evaluationId: string,
    requestId: string,
    adminId: string,
  ): Promise<void> {
    const request = await this.prisma.attemptResetRequest.findFirst({
      where: { id: requestId, evaluationId, tenantId, status: 'PENDING' },
    });
    if (!request) throw new NotFoundException('Solicitud no encontrada');

    // Obtener datos de la evaluación para la notificación antes de la transacción
    const evalWithContext = await this.prisma.evaluation.findFirst({
      where: { id: evaluationId },
      include: {
        lesson: {
          include: {
            module: { include: { course: { select: { id: true } } } },
          },
        },
      },
    });

    await this.prisma.$transaction([
      this.prisma.evaluationAttempt.deleteMany({
        where: { evaluationId, userId: request.userId, tenantId },
      }),
      this.prisma.attemptResetRequest.update({
        where: { id: requestId },
        data: { status: 'APPROVED', processedAt: new Date(), processedBy: adminId },
      }),
    ]);

    // Notificar al estudiante que su solicitud fue aprobada
    await this.notifications.createForUser(
      request.userId,
      tenantId,
      NotificationType.RESET_APPROVED,
      '¡Nueva oportunidad aprobada!',
      `Puedes volver a intentar la evaluación "${evalWithContext?.title ?? ''}"`,
      {
        courseId:    evalWithContext?.lesson.module.course.id,
        lessonId:    evalWithContext?.lessonId,
        evaluationId,
      },
    );

    this.logger.log(
      `Reinicio aprobado — admin ${adminId}, usuario ${request.userId}, evaluación ${evaluationId}`,
    );
  }

  /** Admin rechaza la solicitud y la marca como DENIED. */
  async denyReset(
    tenantId: string,
    evaluationId: string,
    requestId: string,
    adminId: string,
  ): Promise<void> {
    const request = await this.prisma.attemptResetRequest.findFirst({
      where: { id: requestId, evaluationId, tenantId, status: 'PENDING' },
    });
    if (!request) throw new NotFoundException('Solicitud no encontrada');

    const evalWithContext = await this.prisma.evaluation.findFirst({
      where: { id: evaluationId },
      include: {
        lesson: {
          include: {
            module: { include: { course: { select: { id: true } } } },
          },
        },
      },
    });

    await this.prisma.attemptResetRequest.update({
      where: { id: requestId },
      data: { status: 'DENIED', processedAt: new Date(), processedBy: adminId },
    });

    // Notificar al estudiante que su solicitud fue rechazada
    await this.notifications.createForUser(
      request.userId,
      tenantId,
      NotificationType.RESET_DENIED,
      'Solicitud no aprobada',
      `Tu solicitud para repetir la evaluación "${evalWithContext?.title ?? ''}" fue rechazada`,
      {
        courseId:    evalWithContext?.lesson.module.course.id,
        lessonId:    evalWithContext?.lessonId,
        evaluationId,
      },
    );

    this.logger.log(
      `Reinicio rechazado — admin ${adminId}, usuario ${request.userId}, evaluación ${evaluationId}`,
    );
  }

  // ── Helpers privados ─────────────────────────────────────────────────────────

  private async ensureEvaluationAccess(tenantId: string, evaluationId: string) {
    const evaluation = await this.prisma.evaluation.findFirst({
      where: { id: evaluationId, tenantId },
    });
    if (!evaluation) throw new NotFoundException('Evaluación no encontrada');
    return evaluation;
  }

  // ── Editar pregunta ──────────────────────────────────────────────────────────

  async updateQuestion(
    tenantId: string,
    evaluationId: string,
    questionId: string,
    dto: UpdateQuestionDto,
  ): Promise<EvaluationForAdminDto> {
    await this.ensureEvaluationAccess(tenantId, evaluationId);

    const question = await this.prisma.question.findFirst({
      where: { id: questionId, evaluationId, tenantId },
    });
    if (!question) throw new NotFoundException('Pregunta no encontrada');

    // Proteger integridad: no permitir reemplazar opciones si ya hay intentos.
    // Los AttemptAnswer tienen FK a QuestionOption; cambiarlas invalidaría el historial.
    if (dto.options !== undefined) {
      const attemptCount = await this.prisma.evaluationAttempt.count({
        where: { evaluationId, tenantId },
      });
      if (attemptCount > 0) {
        throw new BadRequestException(
          'No se pueden modificar las opciones de respuesta porque ya existen intentos registrados para esta evaluación.',
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.question.update({
        where: { id: questionId },
        data: {
          ...(dto.text        !== undefined && { text:        dto.text }),
          ...(dto.points      !== undefined && { points:      dto.points }),
          ...(dto.explanation !== undefined && { explanation: dto.explanation }),
        },
      });

      if (dto.options !== undefined) {
        await tx.questionOption.deleteMany({ where: { questionId } });
        await tx.questionOption.createMany({
          data: dto.options.map((o, i) => ({
            questionId,
            text:      o.text,
            isCorrect: o.isCorrect,
            order:     o.order ?? i,
          })),
        });
      }
    });

    const updated = await this.prisma.evaluation.findUnique({
      where: { id: evaluationId },
      include: this.adminInclude(),
    });
    return this.toAdminDto(updated!);
  }

  // ── Reordenar preguntas ──────────────────────────────────────────────────────

  async reorderQuestions(
    tenantId: string,
    evaluationId: string,
    orderedIds: string[],
  ): Promise<EvaluationForAdminDto> {
    await this.ensureEvaluationAccess(tenantId, evaluationId);

    await this.prisma.$transaction(
      orderedIds.map((id, index) =>
        this.prisma.question.update({
          where: { id },
          data: { order: index },
        }),
      ),
    );

    const updated = await this.prisma.evaluation.findUnique({
      where: { id: evaluationId },
      include: this.adminInclude(),
    });
    return this.toAdminDto(updated!);
  }

  private adminInclude() {
    return {
      questions: {
        orderBy: { order: 'asc' as const },
        include: {
          options: { orderBy: { order: 'asc' as const } },
        },
      },
      _count: {
        select: { attempts: true },
      },
    };
  }

  private toAdminDto(evaluation: any): EvaluationForAdminDto {
    return {
      id:           evaluation.id,
      lessonId:     evaluation.lessonId,
      title:        evaluation.title,
      instructions: evaluation.instructions,
      minScore:     evaluation.minScore,
      maxAttempts:  evaluation.maxAttempts,
      timeLimit:    evaluation.timeLimit,
      isRequired:   evaluation.isRequired,
      createdAt:    evaluation.createdAt,
      updatedAt:    evaluation.updatedAt,
      attemptCount: evaluation._count?.attempts ?? 0,
      questions:    evaluation.questions.map((q: any): QuestionForAdminDto => ({
        id:          q.id,
        text:        q.text,
        points:      q.points,
        order:       q.order,
        explanation: q.explanation,
        options:     q.options.map((o: any): OptionForAdminDto => ({
          id:        o.id,
          text:      o.text,
          isCorrect: o.isCorrect,
          order:     o.order,
        })),
      })),
    };
  }
}
