// Shared types and utilities for the courses editor module.
// No 'use client' needed — pure data/types.

// ─── Evaluation types ────────────────────────────────────────────────────────

export interface EvalOption {
  id:        string;
  text:      string;
  isCorrect: boolean;
  order:     number;
}

export interface EvalQuestion {
  id:          string;
  text:        string;
  points:      number;
  order:       number;
  explanation: string | null;
  options:     EvalOption[];
}

export interface EvaluationAdmin {
  id:           string;
  lessonId:     string;
  title:        string;
  instructions: string | null;
  minScore:     number;
  maxAttempts:  number;
  timeLimit:    number | null;
  isRequired:   boolean;
  showAnswers:  boolean;
  questions:    EvalQuestion[];
  attemptCount: number;
}

export interface ResetRequestItem {
  id:          string;
  userId:      string;
  userName:    string;
  userEmail:   string;
  message:     string | null;
  requestedAt: string;
}

// ─── Enrollment types ────────────────────────────────────────────────────────

export interface EnrolleeUser {
  id:        string;
  firstName: string;
  lastName:  string;
  email:     string;
  avatarUrl?: string;
}

export interface Enrollee {
  id:          string;
  progress:    number;
  status:      'ACTIVE' | 'COMPLETED' | 'DROPPED';
  completedAt: string | null;
  createdAt:   string;
  user:        EnrolleeUser;
}

export const ENROLLEE_STATUS: Record<string, { label: string; className: string }> = {
  ACTIVE:    { label: 'En curso',   className: 'bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-400' },
  COMPLETED: { label: 'Completado', className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' },
  DROPPED:   { label: 'Abandonó',   className: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' },
};

// ─── Course structure types ───────────────────────────────────────────────────

export interface Lesson {
  id:            string;
  title:         string;
  type:          'VIDEO' | 'TEXT' | 'FILE';
  order:         number;
  isPreview:     boolean;
  duration?:     number;
  muxStatus?:    string;
  muxPlaybackId?: string;
  fileKey?:      string;
  fileName?:     string;
  fileSizeBytes?: number;
  content?:      string;
}

export interface Module {
  id:          string;
  title:       string;
  description?: string;
  order:       number;
  lessons:     Lesson[];
}

export interface Course {
  id:              string;
  title:           string;
  description?:    string;
  thumbnailUrl?:   string;
  status:          'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  totalLessons:    number;
  enrollmentCount?: number;
  modules:         Module[];
}

// ─── Visual config ────────────────────────────────────────────────────────────

export const LESSON_TYPE_CONFIG = {
  VIDEO: { color: '#1E4F7A', label: 'Video',   iconName: 'video'  as const },
  TEXT:  { color: '#16a34a', label: 'Texto',   iconName: 'file'   as const },
  FILE:  { color: '#f59e0b', label: 'Archivo', iconName: 'upload' as const },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function formatDuration(seconds?: number): string {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')} min`;
}

export function formatBytes(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
