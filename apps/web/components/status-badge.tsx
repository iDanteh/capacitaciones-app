export type CourseStatus = 'PUBLISHED' | 'DRAFT' | 'ARCHIVED';

const CONFIG: Record<CourseStatus, {
  dot:    string;
  pulse:  boolean;
  bg:     string;
  border: string;
  text:   string;
  label:  string;
}> = {
  PUBLISHED: {
    dot:    '#10B981',
    pulse:  true,
    bg:     'rgba(16,185,129,0.08)',
    border: 'rgba(16,185,129,0.18)',
    text:   '#059669',
    label:  'Publicado',
  },
  DRAFT: {
    dot:    '#6B7F8F',
    pulse:  false,
    bg:     'rgba(107,127,143,0.08)',
    border: 'rgba(107,127,143,0.12)',
    text:   '#6B7F8F',
    label:  'Borrador',
  },
  ARCHIVED: {
    dot:    '#D97706',
    pulse:  false,
    bg:     'rgba(217,119,6,0.08)',
    border: 'rgba(217,119,6,0.18)',
    text:   '#D97706',
    label:  'Archivado',
  },
};

export function StatusBadge({ status }: { status: CourseStatus }) {
  const cfg = CONFIG[status];
  return (
    <span
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.text }}
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none"
    >
      <span
        style={{
          background:  cfg.dot,
          boxShadow:   cfg.pulse ? `0 0 0 2px ${cfg.dot}30` : 'none',
        }}
        className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${cfg.pulse ? 'animate-pulse-soft' : ''}`}
      />
      {cfg.label}
    </span>
  );
}
