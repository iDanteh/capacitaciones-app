/**
 * MarkdownRenderer — canonical Markdown renderer for the entire project.
 *
 * Produces React nodes directly. No dangerouslySetInnerHTML, no HTML strings.
 *
 * Supported block syntax:
 *   # H1  ## H2  ### H3
 *   - item / * item        → <ul>  (consecutive lines grouped)
 *   1. item                → <ol>  (consecutive lines grouped; fixes per-line <ol> bug)
 *   > quote                → <blockquote>  (consecutive lines grouped)
 *   ```...```              → <pre><code>  (fenced code block)
 *   ---  ***               → <hr>
 *   (empty line)           → spacer div
 *   anything else          → <p>
 *
 * Supported inline syntax (via renderInline):
 *   ![alt](https://...)    → <img>
 *   [text](https://...)    → <a>
 *   ***bold-italic***      → <strong><em>
 *   **bold**               → <strong>
 *   *italic*               → <em>
 *   `inline code`          → <code>
 */

import type { ReactNode } from 'react';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface MarkdownRendererProps {
  content: string;
  className?: string;
  /** Reduce heading margins for compact previews or sidebar contexts. */
  compact?: boolean;
}

// ─── Inline renderer ──────────────────────────────────────────────────────────
//
// Alternation priority (leftmost match wins):
//   1. Images      ![alt](https://...)     — before links so ![ isn't misread
//   2. Links       [text](https://...)
//   3. Bold+italic ***text***              — before ** and * to avoid short-circuit
//   4. Bold        **text**
//   5. Italic      *text*
//   6. Inline code `code`
//
// Uses .+? (non-greedy, any char) instead of [^*]+ so * inside bold/italic works.
// A fresh RegExp instance is created per call to avoid shared lastIndex state.

const INLINE_PATTERN =
  /!\[([^\]]*)\]\((https?:\/\/[^)]+)\)|\[([^\]]+)\]\((https?:\/\/[^)]+)\)|\*{3}(.+?)\*{3}|\*{2}(.+?)\*{2}|\*(.+?)\*|`([^`]+)`/g;

function renderInline(text: string, keyPrefix: string | number): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  const re = new RegExp(INLINE_PATTERN.source, 'g');
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    // Plain text before this match
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const [full, imgAlt, imgUrl, linkText, linkUrl, boldItalic, bold, italic, code] = match;
    const k = `${keyPrefix}:${match.index}`;

    if (imgUrl !== undefined) {
      // Only renders for absolute https:// URLs (guaranteed by regex)
      nodes.push(
        <img
          key={k}
          src={imgUrl}
          alt={imgAlt ?? ''}
          className="rounded-xl max-w-full my-2 block"
        />,
      );
    } else if (linkUrl !== undefined) {
      nodes.push(
        <a
          key={k}
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-capta-soft underline underline-offset-2 hover:opacity-80 transition-opacity"
        >
          {linkText}
        </a>,
      );
    } else if (boldItalic !== undefined) {
      nodes.push(<strong key={k}><em>{boldItalic}</em></strong>);
    } else if (bold !== undefined) {
      nodes.push(<strong key={k}>{bold}</strong>);
    } else if (italic !== undefined) {
      nodes.push(<em key={k}>{italic}</em>);
    } else if (code !== undefined) {
      nodes.push(
        <code
          key={k}
          className="rounded px-1 py-0.5 text-[0.8em] font-mono bg-muted text-foreground"
        >
          {code}
        </code>,
      );
    }

    lastIndex = match.index + full.length;
  }

  // Remaining plain text after last match
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

// ─── Block parser ─────────────────────────────────────────────────────────────

export function MarkdownRenderer({
  content,
  className,
  compact = false,
}: MarkdownRendererProps) {
  const lines   = content.split('\n');
  const elements: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line    = lines[i];
    const trimmed = line.trim();

    // ── Fenced code block ── `` ``` `` opens, next `` ``` `` closes ───────────
    if (trimmed.startsWith('```')) {
      i++;
      const codeLines: string[] = [];
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // consume closing ```
      elements.push(
        <pre
          key={`pre-${elements.length}`}
          className="rounded-lg bg-muted p-4 text-sm font-mono overflow-x-auto whitespace-pre-wrap break-words my-2"
        >
          <code>{codeLines.join('\n')}</code>
        </pre>,
      );
      continue;
    }

    // ── Headings — checked h3 → h2 → h1 (most specific first) ───────────────
    if (line.startsWith('### ')) {
      elements.push(
        <h3
          key={i}
          className={`text-base font-semibold text-foreground ${compact ? 'mt-3 mb-0.5' : 'mt-4 mb-1'}`}
        >
          {renderInline(line.slice(4), i)}
        </h3>,
      );
      i++; continue;
    }
    if (line.startsWith('## ')) {
      elements.push(
        <h2
          key={i}
          className={`text-xl font-semibold text-foreground ${compact ? 'mt-4 mb-1' : 'mt-5 mb-2'}`}
        >
          {renderInline(line.slice(3), i)}
        </h2>,
      );
      i++; continue;
    }
    if (line.startsWith('# ')) {
      elements.push(
        <h1
          key={i}
          className={`text-2xl font-bold text-foreground ${compact ? 'mt-5 mb-1.5' : 'mt-7 mb-3'}`}
        >
          {renderInline(line.slice(2), i)}
        </h1>,
      );
      i++; continue;
    }

    // ── Blockquote — consecutive '> ' lines grouped into one element ──────────
    if (line.startsWith('> ')) {
      const startI  = i;
      const bqLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        bqLines.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <blockquote
          key={`bq-${startI}`}
          className={`border-l-[3px] border-capta-soft pl-4 text-muted-foreground italic ${compact ? 'my-1' : 'my-2'}`}
        >
          {bqLines.map((bl, bi) => (
            <span key={bi}>
              {renderInline(bl, `${startI}-${bi}`)}
              {bi < bqLines.length - 1 && <br />}
            </span>
          ))}
        </blockquote>,
      );
      continue;
    }

    // ── Unordered list — consecutive '- ' / '* ' lines ───────────────────────
    if (line.startsWith('- ') || line.startsWith('* ')) {
      const startI = i;
      const items: ReactNode[] = [];
      while (i < lines.length && (lines[i].startsWith('- ') || lines[i].startsWith('* '))) {
        items.push(
          <li key={i} className="text-sm leading-relaxed">
            {renderInline(lines[i].slice(2), i)}
          </li>,
        );
        i++;
      }
      elements.push(
        <ul
          key={`ul-${startI}`}
          className="ml-5 space-y-1 list-disc marker:text-muted-foreground/60"
        >
          {items}
        </ul>,
      );
      continue;
    }

    // ── Ordered list — consecutive 'N. ' lines grouped into one <ol> ─────────
    // (fixes the original bug where each line produced its own <ol>)
    if (/^\d+\.\s/.test(line)) {
      const startI = i;
      const items: ReactNode[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(
          <li key={i} className="text-sm leading-relaxed">
            {renderInline(lines[i].replace(/^\d+\.\s/, ''), i)}
          </li>,
        );
        i++;
      }
      elements.push(
        <ol
          key={`ol-${startI}`}
          className="ml-5 space-y-1 list-decimal marker:text-muted-foreground/60"
        >
          {items}
        </ol>,
      );
      continue;
    }

    // ── Horizontal rule — '---' or '***' on its own line ─────────────────────
    if (trimmed === '---' || trimmed === '***') {
      elements.push(<hr key={i} className="my-4 border-border" />);
      i++; continue;
    }

    // ── Empty line ────────────────────────────────────────────────────────────
    if (trimmed === '') {
      elements.push(<div key={i} className={compact ? 'h-1' : 'h-2'} />);
      i++; continue;
    }

    // ── Paragraph ─────────────────────────────────────────────────────────────
    elements.push(
      <p key={i} className="text-sm leading-relaxed text-foreground">
        {renderInline(line, i)}
      </p>,
    );
    i++;
  }

  return (
    <div className={`space-y-1${className ? ` ${className}` : ''}`}>
      {elements}
    </div>
  );
}
