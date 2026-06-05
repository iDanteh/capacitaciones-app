'use client';

/**
 * TextLessonSplitEditor
 *
 * Editor Markdown full-screen split-screen para lecciones de tipo TEXT.
 * Panel izquierdo: toolbar + contenteditable (plain-text, Markdown).
 * Panel derecho: preview renderizado con debounce 400ms.
 * Autosave cada 30 s (timer reiniciado en cada keystroke, DOM directo — sin re-render).
 * Carga de imágenes: presigned upload MinIO, inserta ![alt](url) en el cursor.
 * Escape / botón X → flush save (guarda si hay cambios pendientes) → cierra.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@/components/capta-icon';
import { useToast } from '@/components/toast';
import { api } from '@/lib/api';
import { MarkdownRenderer } from '@/components/markdown/markdown-renderer';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  lessonId:       string;
  courseId:       string;
  moduleId:       string;
  lessonTitle:    string;
  initialContent: string;
  onSave:         (content: string) => void;
  onClose:        () => void;
}

// ─── Toolbar button ───────────────────────────────────────────────────────────

function TBtn({
  children,
  onClick,
  title,
  disabled = false,
  active = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <motion.button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      whileTap={{ scale: 0.9 }}
      className={`
        flex h-7 min-w-[28px] items-center justify-center rounded-lg px-1.5 transition-colors
        disabled:opacity-40 disabled:cursor-not-allowed
        ${active
          ? 'bg-capta-tint text-capta-deep dark:bg-capta-soft/20 dark:text-capta-soft'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        }
      `}
    >
      {children}
    </motion.button>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TextLessonSplitEditor({
  lessonId,
  courseId,
  moduleId,
  lessonTitle,
  initialContent,
  onSave,
  onClose,
}: Props) {
  const { error: toastError } = useToast();

  // ── Split resize ──────────────────────────────────────────────────────────
  const [splitPct,   setSplitPct]   = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Editor core ───────────────────────────────────────────────────────────
  const editorRef    = useRef<HTMLDivElement>(null);
  const contentRef   = useRef(initialContent); // Fuente de verdad sin re-renders
  const lastSavedRef = useRef(initialContent);

  // ── Preview ───────────────────────────────────────────────────────────────
  const [previewContent, setPreviewContent] = useState(initialContent);
  const previewTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Autosave ──────────────────────────────────────────────────────────────
  const saveTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failCountRef     = useRef(0);
  const saveIndicatorRef = useRef<HTMLSpanElement>(null);
  const [isSaving,       setIsSaving]       = useState(false);

  // ── Link popover ──────────────────────────────────────────────────────────
  const [linkOpen,     setLinkOpen]     = useState(false);
  const [linkUrl,      setLinkUrl]      = useState('');
  const savedRangeRef    = useRef<Range | null>(null);
  const savedSelTextRef  = useRef('');
  const linkInputRef     = useRef<HTMLInputElement>(null);

  // ── Image upload ──────────────────────────────────────────────────────────
  const [imgUploading, setImgUploading] = useState(false);
  const imgInputRef      = useRef<HTMLInputElement>(null);

  // ── Montar contenteditable con el contenido inicial ───────────────────────
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerText = initialContent;
      // Colocar cursor al final
      const range = document.createRange();
      const sel   = window.getSelection();
      range.selectNodeContents(editorRef.current);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  // Solo en el montaje
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Indicador de autosave (DOM directo — sin setState) ───────────────────
  const setIndicator = useCallback(
    (state: 'idle' | 'saving' | 'saved' | 'error') => {
      const el = saveIndicatorRef.current;
      if (!el) return;
      switch (state) {
        case 'idle':
          el.textContent = '';
          break;
        case 'saving':
          el.textContent = '· Guardando…';
          el.style.color = '#94a3b8';
          break;
        case 'saved':
          el.textContent = '· Guardado';
          el.style.color = '#16a34a';
          break;
        case 'error':
          el.textContent = '· Error al guardar — clic para reintentar';
          el.style.color  = '#ef4444';
          el.style.cursor = 'pointer';
          break;
      }
    },
    [],
  );

  // ── Guardar ───────────────────────────────────────────────────────────────
  const performSave = useCallback(
    async (content: string) => {
      if (content === lastSavedRef.current) return;
      setIsSaving(true);
      setIndicator('saving');
      try {
        await api.patch(
          `/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}`,
          { content },
        );
        lastSavedRef.current = content;
        failCountRef.current = 0;
        setIndicator('saved');
        onSave(content);
      } catch {
        failCountRef.current += 1;
        setIndicator('error');
        if (failCountRef.current >= 2) {
          toastError(
            'Tus cambios no se están guardando.',
            'Revisa tu conexión e intenta de nuevo.',
          );
        }
      } finally {
        setIsSaving(false);
      }
    },
    [courseId, moduleId, lessonId, onSave, setIndicator, toastError],
  );

  // ── Programar autosave (se reinicia en cada keystroke) ───────────────────
  const scheduleAutosave = useCallback(
    (content: string) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => performSave(content), 30_000);
      setIndicator('idle');
    },
    [performSave, setIndicator],
  );

  // ── Preview con debounce 400ms ────────────────────────────────────────────
  const schedulePreview = useCallback((md: string) => {
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = setTimeout(() => {
      setPreviewContent(md);
    }, 400);
  }, []);

  // ── onInput del editor ────────────────────────────────────────────────────
  const handleInput = useCallback(() => {
    const text = editorRef.current?.innerText ?? '';
    contentRef.current = text;
    scheduleAutosave(text);
    schedulePreview(text);
  }, [scheduleAutosave, schedulePreview]);

  // ── Insertar texto en el cursor ───────────────────────────────────────────
  const insertAtCursor = useCallback(
    (text: string) => {
      const editor = editorRef.current;
      if (!editor) return;
      editor.focus();
      const sel = window.getSelection();
      if (!sel?.rangeCount) return;
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const node = document.createTextNode(text);
      range.insertNode(node);
      range.setStartAfter(node);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      handleInput();
    },
    [handleInput],
  );

  // ── Envolver selección con Markdown ──────────────────────────────────────
  const wrapSelection = useCallback(
    (before: string, after: string, placeholder = 'texto') => {
      const editor = editorRef.current;
      if (!editor) return;
      editor.focus();
      const sel = window.getSelection();
      if (!sel?.rangeCount) return;
      const range    = sel.getRangeAt(0);
      const selected = range.toString();
      range.deleteContents();
      const wrapped = before + (selected || placeholder) + after;
      const node    = document.createTextNode(wrapped);
      range.insertNode(node);
      if (!selected) {
        // Seleccionar el placeholder para sobreescribirlo fácilmente
        range.setStart(node, before.length);
        range.setEnd(node, before.length + placeholder.length);
      } else {
        range.setStartAfter(node);
        range.collapse(true);
      }
      sel.removeAllRanges();
      sel.addRange(range);
      handleInput();
    },
    [handleInput],
  );

  // ── Upload de imagen ──────────────────────────────────────────────────────
  const uploadImageFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) return;
      if (file.size > 5 * 1024 * 1024) {
        toastError(
          'No pudimos subir la imagen.',
          'Verifica que pese menos de 5 MB e intenta de nuevo.',
        );
        return;
      }
      setImgUploading(true);
      try {
        const { data: presigned } = await api.post<{
          uploadUrl: string;
          key:       string;
          publicUrl: string;
        }>('/storage/presigned-upload', {
          fileName:    file.name,
          folder:      'lesson-images',
          contentType: file.type,
          isPublic:    true,
        });

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.onload  = () =>
            xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`HTTP ${xhr.status}`));
          xhr.onerror = () => reject(new Error('Error de red'));
          xhr.open('PUT', presigned.uploadUrl);
          xhr.setRequestHeader('Content-Type', file.type);
          xhr.send(file);
        });

        const alt = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
        insertAtCursor(`\n![${alt}](${presigned.publicUrl})\n`);
      } catch {
        toastError(
          'No pudimos subir la imagen.',
          'Algo falló de nuestro lado. Intenta de nuevo o verifica que el archivo pese menos de 5 MB.',
        );
      } finally {
        setImgUploading(false);
      }
    },
    [insertAtCursor, toastError],
  );

  // ── Paste: strip HTML, capturar imágenes ─────────────────────────────────
  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      e.preventDefault();
      const items = Array.from(e.clipboardData.items);
      const imgItem = items.find(i => i.type.startsWith('image/'));
      if (imgItem) {
        const f = imgItem.getAsFile();
        if (f) { uploadImageFile(f); return; }
      }
      // Pegar solo texto plano
      const text = e.clipboardData.getData('text/plain');
      const sel   = window.getSelection();
      if (!sel?.rangeCount) return;
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const node = document.createTextNode(text);
      range.insertNode(node);
      range.setStartAfter(node);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      handleInput();
    },
    [uploadImageFile, handleInput],
  );

  // ── Drag-and-drop de imágenes sobre el editor ─────────────────────────────
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop     = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f?.type.startsWith('image/')) uploadImageFile(f);
  };

  // ── Shortcuts de teclado ──────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'b') { e.preventDefault(); wrapSelection('**', '**'); }
      if (mod && e.key === 'i') { e.preventDefault(); wrapSelection('*', '*'); }
      if (mod && e.key === 'k') {
        e.preventDefault();
        const sel = window.getSelection();
        if (sel?.rangeCount) {
          savedRangeRef.current   = sel.getRangeAt(0).cloneRange();
          savedSelTextRef.current = sel.getRangeAt(0).toString();
        }
        setLinkOpen(o => !o);
      }
      if (mod && e.key === 's') {
        e.preventDefault();
        performSave(contentRef.current);
      }
    },
    [wrapSelection, performSave],
  );

  // ── Confirmar inserción de link ───────────────────────────────────────────
  const confirmLink = useCallback(() => {
    const url = linkUrl.trim();
    if (!url) { setLinkOpen(false); return; }
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    if (savedRangeRef.current) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(savedRangeRef.current);
    }
    const label = savedSelTextRef.current || 'enlace';
    insertAtCursor(`[${label}](${url})`);
    setLinkOpen(false);
    setLinkUrl('');
    savedRangeRef.current   = null;
    savedSelTextRef.current = '';
  }, [linkUrl, insertAtCursor]);

  // Auto-focus input del popover de link
  useEffect(() => {
    if (linkOpen) linkInputRef.current?.focus();
  }, [linkOpen]);

  // ── Resize handle ─────────────────────────────────────────────────────────
  const handleResizeDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    const onMove = (ev: MouseEvent) => {
      const cnt = containerRef.current;
      if (!cnt) return;
      const { left, width } = cnt.getBoundingClientRect();
      setSplitPct(Math.min(75, Math.max(25, ((ev.clientX - left) / width) * 100)));
    };
    const onUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  // ── Cerrar con flush save ─────────────────────────────────────────────────
  const handleClose = useCallback(async () => {
    if (saveTimerRef.current)    clearTimeout(saveTimerRef.current);
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    const current = contentRef.current;
    if (current !== lastSavedRef.current) {
      try {
        await api.patch(
          `/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}`,
          { content: current },
        );
        onSave(current);
      } catch {
        // Cerrar de todas formas
      }
    }
    onClose();
  }, [courseId, moduleId, lessonId, onSave, onClose]);

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleClose]);

  // Limpiar timers al desmontar
  useEffect(() => {
    return () => {
      if (saveTimerRef.current)    clearTimeout(saveTimerRef.current);
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    };
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  //  Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-[58] bg-black/40 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Panel principal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="fixed inset-3 z-[59] flex flex-col rounded-2xl border border-border bg-card overflow-hidden"
        style={{
          boxShadow: '0 24px 80px rgba(0,0,0,.22), 0 1px 0 rgba(255,255,255,.6) inset',
        }}
        onClick={e => e.stopPropagation()}
      >

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex h-12 flex-shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4">

          {/* Izquierda: ícono + título + indicador */}
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg"
              style={{ background: '#16a34a12', color: '#16a34a' }}
            >
              <Icon name="file" size={13} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground flex-shrink-0">
              Editor Texto
            </span>
            <span className="text-muted-foreground/30 flex-shrink-0">/</span>
            <span className="text-sm font-semibold text-foreground truncate">
              {lessonTitle}
            </span>
            {/* Indicador de autosave — actualizado por ref, sin setState */}
            <motion.span
              ref={saveIndicatorRef}
              className="text-[11px] font-medium ml-1 flex-shrink-0"
              style={{ color: '#94a3b8' }}
            />
          </div>

          {/* Derecha: botón guardar + cerrar */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {isSaving && (
              <Icon name="refresh" size={13} className="animate-spin text-muted-foreground" />
            )}
            <button
              onClick={() => performSave(contentRef.current)}
              disabled={isSaving}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50 transition-all active:scale-[0.97]"
            >
              <Icon name="save" size={12} />
              Guardar
            </button>
            <button
              onClick={handleClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Cerrar (Esc)"
            >
              <Icon name="close" size={15} />
            </button>
          </div>
        </div>

        {/* ── Split body ─────────────────────────────────────────────────── */}
        <div
          ref={containerRef}
          className="flex flex-1 overflow-hidden"
          style={{ userSelect: isDragging ? 'none' : 'auto', cursor: isDragging ? 'col-resize' : 'auto' }}
        >

          {/* ── Panel izquierdo: editor ──────────────────────────────────── */}
          <div
            className="relative flex flex-col overflow-hidden"
            style={{ width: `${splitPct}%` }}
          >
            {/* Toolbar */}
            <div className="relative flex-shrink-0 border-b border-border bg-card/60 backdrop-blur-sm">
              <div className="flex items-center gap-0.5 px-3 py-1.5 flex-wrap">

                {/* Bold */}
                <TBtn title="Negrita (Cmd+B)" onClick={() => wrapSelection('**', '**')}>
                  <span className="text-xs font-bold leading-none">B</span>
                </TBtn>
                {/* Italic */}
                <TBtn title="Cursiva (Cmd+I)" onClick={() => wrapSelection('*', '*')}>
                  <span className="text-xs italic leading-none">I</span>
                </TBtn>

                <div className="mx-1 h-4 w-px flex-shrink-0 bg-border" />

                {/* H2 */}
                <TBtn title="Encabezado 2" onClick={() => insertAtCursor('\n## ')}>
                  <span className="text-[10px] font-bold leading-none">H2</span>
                </TBtn>
                {/* H3 */}
                <TBtn title="Encabezado 3" onClick={() => insertAtCursor('\n### ')}>
                  <span className="text-[10px] font-bold leading-none">H3</span>
                </TBtn>

                <div className="mx-1 h-4 w-px flex-shrink-0 bg-border" />

                {/* Lista sin orden */}
                <TBtn title="Lista sin orden" onClick={() => insertAtCursor('\n- ')}>
                  <Icon name="menu" size={13} />
                </TBtn>
                {/* Lista numerada */}
                <TBtn title="Lista numerada" onClick={() => insertAtCursor('\n1. ')}>
                  <span className="text-[10px] font-bold leading-none">1.</span>
                </TBtn>

                <div className="mx-1 h-4 w-px flex-shrink-0 bg-border" />

                {/* Link (Cmd+K) */}
                <TBtn
                  title="Insertar enlace (Cmd+K)"
                  active={linkOpen}
                  onClick={() => {
                    const sel = window.getSelection();
                    if (sel?.rangeCount) {
                      savedRangeRef.current   = sel.getRangeAt(0).cloneRange();
                      savedSelTextRef.current = sel.getRangeAt(0).toString();
                    }
                    setLinkOpen(o => !o);
                  }}
                >
                  <Icon name="external-link" size={13} />
                </TBtn>

                {/* Imagen */}
                <TBtn
                  title="Insertar imagen (drag/paste también funcionan)"
                  disabled={imgUploading}
                  onClick={() => imgInputRef.current?.click()}
                >
                  {imgUploading
                    ? <Icon name="refresh" size={13} className="animate-spin" />
                    : <Icon name="upload" size={13} />}
                </TBtn>
                <input
                  ref={imgInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) uploadImageFile(f);
                    e.target.value = '';
                  }}
                />

                <div className="mx-1 h-4 w-px flex-shrink-0 bg-border" />

                {/* Separador horizontal */}
                <TBtn title="Línea divisoria (---)" onClick={() => insertAtCursor('\n\n---\n\n')}>
                  <span className="text-xs font-mono leading-none text-muted-foreground">—</span>
                </TBtn>

                {/* Atajos hint */}
                <span className="ml-auto text-[10px] text-muted-foreground/50 hidden sm:block flex-shrink-0 pr-1">
                  Cmd+B · Cmd+I · Cmd+K · Cmd+S
                </span>
              </div>

              {/* Popover de link */}
              <AnimatePresence>
                {linkOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.12 }}
                    className="absolute top-full left-0 right-0 z-10 flex items-center gap-2 border-b border-border bg-card px-3 py-2 shadow-sm"
                  >
                    <Icon name="external-link" size={13} className="text-muted-foreground flex-shrink-0" />
                    <input
                      ref={linkInputRef}
                      value={linkUrl}
                      onChange={e => setLinkUrl(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter')  { e.preventDefault(); confirmLink(); }
                        if (e.key === 'Escape') { setLinkOpen(false); setLinkUrl(''); }
                      }}
                      placeholder="https://…"
                      className="flex-1 bg-transparent text-sm text-foreground focus:outline-none placeholder:text-muted-foreground/40"
                    />
                    <button
                      onClick={confirmLink}
                      className="text-xs font-semibold text-capta-deep dark:text-capta-soft hover:opacity-75 transition-opacity flex-shrink-0"
                    >
                      Insertar
                    </button>
                    <button
                      onClick={() => { setLinkOpen(false); setLinkUrl(''); }}
                      className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                    >
                      <Icon name="close" size={13} />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Área editable */}
            <div
              className="flex-1 overflow-y-auto"
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              {/* Placeholder vía CSS cuando div está vacío */}
              <style>{`
                [data-editor]:empty:before {
                  content: attr(data-placeholder);
                  color: #94a3b8;
                  pointer-events: none;
                }
              `}</style>
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                data-editor="true"
                data-placeholder={`# Título de la lección\n\nEscribe el contenido en Markdown…\n\n## Sección\n\nPuedes usar **negrita**, *cursiva*, \`código\`, listas, etc.`}
                onInput={handleInput}
                onPaste={handlePaste}
                onKeyDown={handleKeyDown}
                className="min-h-full w-full px-5 py-5 text-sm text-foreground leading-relaxed focus:outline-none"
                style={{
                  fontFamily: 'ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, monospace',
                  fontSize:   '13px',
                  lineHeight: '1.8',
                  whiteSpace: 'pre-wrap',
                  wordBreak:  'break-word',
                  tabSize:    2,
                }}
              />
            </div>
          </div>

          {/* ── Resize handle ────────────────────────────────────────────── */}
          <div
            onMouseDown={handleResizeDown}
            className="group relative flex w-2 flex-shrink-0 cursor-col-resize items-center justify-center transition-colors hover:bg-capta-soft/20"
            style={{ background: isDragging ? 'rgba(143,196,232,0.2)' : undefined }}
          >
            <div className="h-10 w-0.5 rounded-full bg-border group-hover:bg-capta-soft transition-colors" />
          </div>

          {/* ── Panel derecho: preview ────────────────────────────────────── */}
          <div
            className="flex flex-col overflow-hidden border-l border-border"
            style={{ width: `${100 - splitPct}%` }}
          >
            {/* Subheader del preview */}
            <div className="flex h-9 flex-shrink-0 items-center gap-2 border-b border-border px-4 bg-muted/30">
              <Icon name="eye" size={13} className="text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground">Vista previa</span>
              <span className="ml-auto text-[10px] text-muted-foreground/40">400 ms delay</span>
            </div>

            {/* Contenido del preview */}
            <div className="flex-1 overflow-y-auto px-7 py-6">
              <MarkdownRenderer content={previewContent} />
            </div>
          </div>

        </div>
      </motion.div>
    </>
  );
}
