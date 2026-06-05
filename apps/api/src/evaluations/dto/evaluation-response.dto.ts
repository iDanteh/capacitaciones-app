/**
 * DTOs de respuesta para evaluaciones.
 *
 * IMPORTANTE sobre seguridad:
 *  - EvaluationForStudentDto NO expone isCorrect en las opciones.
 *    El frontend no debe poder saber cuál es la respuesta correcta antes de enviar.
 *  - EvaluationForAdminDto SÍ expone isCorrect para que el creador pueda editarlas.
 *  - AttemptResultDto sí muestra si cada respuesta fue correcta y la explicación,
 *    porque ya se entregó el intento.
 */

// ─── Evaluación para estudiante (sin respuestas correctas expuestas) ──────────

export class OptionForStudentDto {
  id:    string;
  text:  string;
  order: number;
}

export class QuestionForStudentDto {
  id:          string;
  text:        string;
  points:      number;
  order:       number;
  explanation: string | null;
  options:     OptionForStudentDto[];
}

export class EvaluationForStudentDto {
  id:           string;
  title:        string;
  instructions: string | null;
  minScore:     number;
  maxAttempts:  number;
  timeLimit:    number | null;
  isRequired:   boolean;
  /// Si false, las respuestas correctas no se revelan al reprobar con intentos restantes.
  showAnswers:  boolean;
  questions:    QuestionForStudentDto[];
  /// Intentos ya realizados por el usuario en esta evaluación
  attemptsUsed: number;
  /// Mejor puntuación obtenida (null si no hay intentos)
  bestScore:    number | null;
  passed:       boolean;
  /// Si el usuario ya tiene una solicitud de reinicio PENDING para esta evaluación
  hasPendingResetRequest: boolean;
}

// ─── Evaluación para admin/owner (con respuestas correctas) ───────────────────

export class OptionForAdminDto {
  id:        string;
  text:      string;
  isCorrect: boolean;
  order:     number;
}

export class QuestionForAdminDto {
  id:          string;
  text:        string;
  points:      number;
  order:       number;
  explanation: string | null;
  options:     OptionForAdminDto[];
}

export class EvaluationForAdminDto {
  id:           string;
  lessonId:     string;
  title:        string;
  instructions: string | null;
  minScore:     number;
  maxAttempts:  number;
  timeLimit:    number | null;
  isRequired:   boolean;
  /// Si false, las respuestas correctas no se revelan al reprobar con intentos restantes.
  showAnswers:  boolean;
  questions:    QuestionForAdminDto[];
  createdAt:    Date;
  updatedAt:    Date;
  /// Número de intentos registrados. Si > 0, no se pueden reemplazar opciones.
  attemptCount: number;
}

// ─── Solicitud de reinicio de intentos ───────────────────────────────────────

export class ResetRequestDto {
  id:          string;
  userId:      string;
  userName:    string;
  userEmail:   string;
  message:     string | null;
  requestedAt: Date;
}

// ─── Resultado de un intento ──────────────────────────────────────────────────

export class AnswerResultDto {
  questionId:   string;
  questionText: string;
  selectedOptionId: string;
  isCorrect:    boolean;
  explanation:  string | null;
  /// Opción correcta. null cuando showAnswers=false y el estudiante reprueba con intentos restantes.
  correctOptionId: string | null;
}

export class AttemptResultDto {
  attemptId:   string;
  score:       number;
  passed:      boolean;
  minScore:    number;
  completedAt: Date;
  answers:     AnswerResultDto[];
  /// Mensaje motivacional o informativo
  message:     string;
  attemptsUsed:     number;
  attemptsRemaining: number | null; // null = ilimitado
}
