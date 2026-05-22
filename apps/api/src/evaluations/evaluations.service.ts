import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  CreateEvaluationDto,
  UpdateEvaluationDto,
  CreateQuestionDto,
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

  constructor(private readonly prisma: PrismaService) {}

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

  // ── Helpers privados ─────────────────────────────────────────────────────────

  private async ensureEvaluationAccess(tenantId: string, evaluationId: string) {
    const evaluation = await this.prisma.evaluation.findFirst({
      where: { id: evaluationId, tenantId },
    });
    if (!evaluation) throw new NotFoundException('Evaluación no encontrada');
    return evaluation;
  }

  private adminInclude() {
    return {
      questions: {
        orderBy: { order: 'asc' as const },
        include: {
          options: { orderBy: { order: 'asc' as const } },
        },
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
