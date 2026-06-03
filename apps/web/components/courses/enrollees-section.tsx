'use client';

import { useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@/components/capta-icon';
import { api } from '@/lib/api';
import { ENROLLEE_STATUS, type Enrollee } from './types';

const Users       = (p: { size?: number; className?: string }) => <Icon name="users"        size={p.size} className={p.className} />;
const ChevronDown = (p: { size?: number; className?: string }) => <Icon name="chevron-down" size={p.size} className={p.className} />;
const Loader2     = (p: { size?: number; className?: string }) => <Icon name="refresh"      size={p.size} className={p.className} />;

export function EnrolleesSection({ courseId }: { courseId: string }) {
  const [open,     setOpen]     = useState(false);
  const [enrollees,setEnrollees]= useState<Enrollee[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [fetched,  setFetched]  = useState(false);

  const load = useCallback(async () => {
    if (fetched) return;
    setLoading(true);
    try {
      const { data } = await api.get<Enrollee[]>(`/enrollments/course/${courseId}`);
      setEnrollees(data);
      setFetched(true);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [courseId, fetched]);

  const handleToggle = () => {
    if (!open && !fetched) load();
    setOpen(o => !o);
  };

  const completedCount = enrollees.filter(e => e.status === 'COMPLETED').length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.08 }}
      className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden"
    >
      {/* Header colapsable */}
      <button
        onClick={handleToggle}
        className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-muted/30 transition-colors"
      >
        <div
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl"
          style={{ background: 'linear-gradient(135deg, #DCE9F4, #8FC4E840)', color: '#1E4F7A' }}
        >
          <Users size={15} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">Estudiantes inscritos</p>
          {fetched && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {enrollees.length} {enrollees.length === 1 ? 'estudiante' : 'estudiantes'}
              {completedCount > 0 && ` · ${completedCount} completaron`}
            </p>
          )}
        </div>
        {fetched && enrollees.length > 0 && (
          <span
            className="flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #1E4F7A, #2D6FA0)' }}
          >
            {enrollees.length}
          </span>
        )}
        <ChevronDown
          size={16}
          className={`flex-shrink-0 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Contenido colapsable */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="enrollees-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden border-t border-border"
          >
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div
                  className="h-5 w-5 animate-spin rounded-full border-2 border-transparent"
                  style={{ borderTopColor: '#1E4F7A', borderRightColor: '#8FC4E820' }}
                />
              </div>
            ) : enrollees.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted mb-3">
                  <Users size={18} className="text-muted-foreground/40" />
                </div>
                <p className="text-sm font-medium text-foreground">Sin inscritos aún</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Los estudiantes aparecerán aquí cuando se inscriban al curso.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {enrollees.map(e => {
                  const fullName = `${e.user.firstName} ${e.user.lastName}`;
                  const initials = `${e.user.firstName.charAt(0)}${e.user.lastName.charAt(0)}`.toUpperCase();
                  const st = ENROLLEE_STATUS[e.status] ?? ENROLLEE_STATUS.ACTIVE;
                  const enrollDate = new Date(e.createdAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
                  const doneDate   = e.completedAt
                    ? new Date(e.completedAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
                    : null;

                  return (
                    <div key={e.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/20 transition-colors">
                      {/* Avatar */}
                      <div
                        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                        style={{ background: 'linear-gradient(135deg, #DCE9F4, #8FC4E830)', color: '#1E4F7A' }}
                      >
                        {initials}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{fullName}</p>
                        <p className="text-xs text-muted-foreground truncate">{e.user.email}</p>
                      </div>

                      {/* Progreso */}
                      <div className="hidden sm:flex flex-col items-end gap-1 w-28 flex-shrink-0">
                        <div className="flex items-center justify-between w-full">
                          <span className="text-[10px] text-muted-foreground">Progreso</span>
                          <span className="text-[11px] font-semibold text-foreground">{e.progress}%</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${e.progress}%`,
                              background: e.status === 'COMPLETED'
                                ? 'linear-gradient(90deg, #16a34a, #22c55e)'
                                : 'linear-gradient(90deg, #1E4F7A, #2D6FA0)',
                            }}
                          />
                        </div>
                      </div>

                      {/* Estado */}
                      <span className={`hidden md:inline-flex flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${st.className}`}>
                        {st.label}
                      </span>

                      {/* Fecha */}
                      <div className="hidden lg:flex flex-col items-end flex-shrink-0 text-right">
                        {doneDate ? (
                          <>
                            <span className="text-[10px] text-muted-foreground">Completó</span>
                            <span className="text-[11px] font-medium text-foreground">{doneDate}</span>
                          </>
                        ) : (
                          <>
                            <span className="text-[10px] text-muted-foreground">Inscrito</span>
                            <span className="text-[11px] font-medium text-foreground">{enrollDate}</span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
