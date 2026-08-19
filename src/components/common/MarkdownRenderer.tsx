'use client';

import React, { useState } from 'react';
import { cleanXmlToolCalls } from '@/lib/skills/tool-parser';
import { Copy, Check } from 'lucide-react';

export interface MarkdownRendererProps {
  content: string;
  className?: string;
  isUser?: boolean;
}

type TableAlign = 'left' | 'center' | 'right';

interface ListItem {
  ordered: boolean;
  number?: string;
  indent: number;
  content: string;
}

type Section =
  | { type: 'code'; content: string; lang?: string }
  | { type: 'heading'; level: number; content: string }
  | { type: 'quote'; content: string }
  | { type: 'hr' }
  | { type: 'list'; items: ListItem[] }
  | {
      type: 'table';
      headers: string[];
      aligns: TableAlign[];
      rows: string[][];
    }
  | { type: 'paragraph'; lines: string[] };

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className = '',
  isUser = false,
}) => {
  if (!content) return null;

  const sanitized = isUser ? content : cleanXmlToolCalls(content);
  if (!sanitized && !isUser) return null;

  const sections = splitContentIntoSections(sanitized || content);

  return (
    <div className={`markdown-content space-y-2.5 text-xs leading-relaxed ${className}`}>
      {sections.map((sec, idx) => {
        if (sec.type === 'code') {
          return <CodeBlock key={idx} content={sec.content} lang={sec.lang} />;
        }

        if (sec.type === 'heading') {
          const Tag = `h${Math.min(sec.level + 1, 6)}` as keyof React.JSX.IntrinsicElements;
          const headingStyles: Record<number, string> = {
            1: 'text-[13px] font-bold text-sky-700 dark:text-sky-400 mt-2 mb-1 pb-1 border-b border-sky-200/60 dark:border-sky-800/60 flex items-center gap-1.5',
            2: 'text-xs font-bold text-slate-900 dark:text-slate-100 mt-2 mb-1 flex items-center gap-1.5',
            3: 'text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1.5 mb-0.5',
            4: 'text-[11px] font-semibold text-slate-800 dark:text-slate-300 mt-1 mb-0.5',
            5: 'text-[11px] font-medium text-slate-700 dark:text-slate-300 mt-1',
            6: 'text-[10px] font-medium text-slate-600 dark:text-slate-400 mt-0.5'
          };

          return (
            <Tag
              key={idx}
              className={headingStyles[sec.level] || headingStyles[2]}
            >
              {renderInline(sec.content, isUser)}
            </Tag>
          );
        }

        if (sec.type === 'quote') {
          return (
            <blockquote
              key={idx}
              className="border-l-3 border-sky-500 pl-2.5 py-1 text-slate-600 dark:text-slate-400 italic bg-sky-50/50 dark:bg-sky-950/20 rounded-r text-[11px]"
            >
              {renderInline(sec.content, isUser)}
            </blockquote>
          );
        }

        if (sec.type === 'hr') {
          return <hr key={idx} className="my-2 border-slate-200/80 dark:border-slate-800" />;
        }

        if (sec.type === 'list') {
          return (
            <div key={idx} className="my-1.5 space-y-1 pl-1">
              {sec.items.map((item, itemIdx) => {
                const indentPadding = item.indent > 0 ? (item.indent === 1 ? 'pl-4' : 'pl-7') : 'pl-0';
                return (
                  <div
                    key={itemIdx}
                    className={`flex items-start gap-1.5 leading-relaxed text-slate-800 dark:text-slate-200 ${indentPadding}`}
                  >
                    {item.ordered ? (
                      <span className="font-mono text-sky-600 dark:text-sky-400 text-[11px] font-semibold shrink-0 select-none">
                        {item.number || `${itemIdx + 1}.`}
                      </span>
                    ) : (
                      <span className="text-sky-500 dark:text-sky-400 text-xs shrink-0 select-none leading-[18px]">
                        {item.indent > 0 ? '◦' : '•'}
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      {renderInline(item.content, isUser)}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        }

        if (sec.type === 'table') {
          const getAlignClass = (align: TableAlign) => {
            if (align === 'center') return 'text-center';
            if (align === 'right') return 'text-right';
            return 'text-left';
          };

          return (
            <div
              key={idx}
              className={`my-2 overflow-x-auto rounded-lg border shadow-xs ${
                isUser
                  ? 'border-white/20 bg-white/10'
                  : 'border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80'
              }`}
            >
              <table className="w-full text-xs border-collapse">
                <thead
                  className={`${
                    isUser
                      ? 'bg-white/15 text-white border-b border-white/20'
                      : 'bg-slate-100/90 dark:bg-slate-800/90 text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800'
                  } font-semibold`}
                >
                  <tr>
                    {sec.headers.map((header, hIdx) => (
                      <th
                        key={hIdx}
                        className={`px-3 py-2 text-[11px] font-bold ${getAlignClass(
                          sec.aligns[hIdx] || 'left'
                        )}`}
                      >
                        {renderInline(header, isUser)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody
                  className={`divide-y ${
                    isUser
                      ? 'divide-white/10 text-white'
                      : 'divide-slate-200/80 dark:divide-slate-800/80 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {sec.rows.map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      className={
                        isUser
                          ? 'hover:bg-white/10 transition-colors'
                          : 'hover:bg-sky-50/50 dark:hover:bg-slate-800/50 transition-colors'
                      }
                    >
                      {sec.headers.map((_, cIdx) => (
                        <td
                          key={cIdx}
                          className={`px-3 py-2 text-[11px] leading-relaxed break-words ${getAlignClass(
                            sec.aligns[cIdx] || 'left'
                          )}`}
                        >
                          {renderInline(row[cIdx] ?? '', isUser)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        // Standard Paragraph
        return (
          <p key={idx} className="leading-relaxed text-slate-800 dark:text-slate-200">
            {sec.lines.map((line, lineIdx) => (
              <React.Fragment key={lineIdx}>
                {lineIdx > 0 && <br />}
                {renderInline(line, isUser)}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
};

const CodeBlock: React.FC<{ content: string; lang?: string }> = ({ content, lang }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative my-2 rounded-lg bg-slate-900 text-slate-100 p-3 font-mono text-[11px] overflow-x-auto border border-slate-800 group shadow-xs">
      <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold mb-1 uppercase tracking-wider pb-1 border-b border-slate-800/80">
        <span>{lang || 'CODE'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-white transition-colors cursor-pointer"
          title="复制内容"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400 font-normal">已复制</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span className="font-normal opacity-0 group-hover:opacity-100 transition-opacity">复制</span>
            </>
          )}
        </button>
      </div>
      <pre className="whitespace-pre overflow-x-auto leading-relaxed">{content}</pre>
    </div>
  );
};

function splitRowCells(line: string): string[] {
  let trimmed = line.trim();
  if (trimmed.startsWith('|')) {
    trimmed = trimmed.slice(1);
  }
  if (trimmed.endsWith('|') && !trimmed.endsWith('\\|')) {
    trimmed = trimmed.slice(0, -1);
  }
  const cells: string[] = [];
  let current = '';
  let escaped = false;
  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i];
    if (char === '\\' && !escaped) {
      escaped = true;
      current += char;
    } else if (char === '|' && !escaped) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
      escaped = false;
    }
  }
  cells.push(current.trim());
  return cells;
}

function isTableSeparator(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || !trimmed.includes('-') || !trimmed.includes('|')) return false;
  const content = trimmed.replace(/^\|/, '').replace(/\|$/, '');
  const cells = content.split('|');
  if (cells.length === 0) return false;
  return cells.every((c) => /^\s*:?-{1,}:?\s*$/.test(c));
}

function parseAlignments(separatorLine: string): TableAlign[] {
  const cells = splitRowCells(separatorLine);
  return cells.map((cell) => {
    const trimmed = cell.trim();
    const startColon = trimmed.startsWith(':');
    const endColon = trimmed.endsWith(':');
    if (startColon && endColon) return 'center';
    if (endColon) return 'right';
    return 'left';
  });
}

function splitContentIntoSections(raw: string): Section[] {
  const sections: Section[] = [];
  const lines = raw.split('\n');
  let inCodeBlock = false;
  let codeLang = '';
  let codeBuffer: string[] = [];
  let paragraphBuffer: string[] = [];
  let listBuffer: ListItem[] = [];

  const flushParagraph = () => {
    if (paragraphBuffer.length > 0) {
      sections.push({
        type: 'paragraph',
        lines: [...paragraphBuffer],
      });
      paragraphBuffer = [];
    }
  };

  const flushList = () => {
    if (listBuffer.length > 0) {
      sections.push({
        type: 'list',
        items: [...listBuffer],
      });
      listBuffer = [];
    }
  };

  const flushAll = () => {
    flushParagraph();
    flushList();
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 1. Code fence (```lang or ```)
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        sections.push({
          type: 'code',
          content: codeBuffer.join('\n'),
          lang: codeLang,
        });
        codeBuffer = [];
        inCodeBlock = false;
        codeLang = '';
      } else {
        flushAll();
        inCodeBlock = true;
        codeLang = trimmed.slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      continue;
    }

    // 2. Horizontal Rule (---, ***, ___)
    if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushAll();
      sections.push({ type: 'hr' });
      continue;
    }

    // 3. Heading (# H1 to ###### H6, with or without space)
    const headingMatch = line.match(/^(#{1,6})\s*(.+)$/);
    if (headingMatch && headingMatch[2].trim()) {
      flushAll();
      sections.push({
        type: 'heading',
        level: headingMatch[1].length,
        content: headingMatch[2].trim(),
      });
      continue;
    }

    // 4. Quote (> quote)
    if (line.startsWith('>')) {
      flushAll();
      sections.push({
        type: 'quote',
        content: line.replace(/^>\s*/, ''),
      });
      continue;
    }

    // 5. Table detection: line has '|' and next line is a table separator
    if (i + 1 < lines.length && line.includes('|') && isTableSeparator(lines[i + 1])) {
      flushAll();
      const headerLine = line;
      const separatorLine = lines[i + 1];
      const headers = splitRowCells(headerLine);
      const aligns = parseAlignments(separatorLine);
      const rows: string[][] = [];

      i += 2;
      while (i < lines.length) {
        const currentLine = lines[i];
        if (
          currentLine.trim() === '' ||
          currentLine.trim().startsWith('```') ||
          currentLine.match(/^(#{1,6})\s*/) ||
          currentLine.startsWith('>') ||
          /^(?:-{3,}|\*{3,}|_{3,})$/.test(currentLine.trim())
        ) {
          i--; // Reprocess this line in outer loop
          break;
        }
        if (!currentLine.includes('|')) {
          i--;
          break;
        }
        rows.push(splitRowCells(currentLine));
        i++;
      }

      sections.push({
        type: 'table',
        headers,
        aligns,
        rows,
      });
      continue;
    }

    // 6. List items (ordered & unordered, with indentation support)
    const listMatch = line.match(/^(\s*)([-*•+]|\d+[\.\)])\s+(.*)$/);
    if (listMatch) {
      flushParagraph();
      const indentSpaces = listMatch[1].length;
      const marker = listMatch[2];
      const itemContent = listMatch[3];
      const isOrdered = /^\d+[\.\)]$/.test(marker);
      const indentLevel = indentSpaces >= 4 ? 2 : indentSpaces >= 2 ? 1 : 0;

      listBuffer.push({
        ordered: isOrdered,
        number: isOrdered ? marker : undefined,
        indent: indentLevel,
        content: itemContent,
      });
      continue;
    }

    // 7. Empty line -> separator
    if (trimmed === '') {
      flushAll();
      continue;
    }

    // 8. Normal text line -> paragraph buffer
    flushList();
    paragraphBuffer.push(line);
  }

  if (inCodeBlock && codeBuffer.length > 0) {
    sections.push({
      type: 'code',
      content: codeBuffer.join('\n'),
      lang: codeLang,
    });
  }

  flushAll();
  return sections;
}

// Inline parser for bold, italic, code, links, highlighted brackets
function renderInline(text: string, isUser: boolean): React.ReactNode[] {
  if (!text) return [];

  // Regex to match:
  // 1. **bold** or __bold__
  // 2. `code` or ```code```
  // 3. *italic* or _italic_
  // 4. [text](url)
  const regex = /(\*\*(?:[^*]|\*(?!\*))+?\*\*|__(?:[^_]|_(?!_))+?__|`{1,3}[^`]+?`{1,3}|\*[^*\n]+?\*|_[^_\n]+?_|\[[^\]]+?\]\([^)]+?\))/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    const token = match[0];
    const key = `token-${match.index}-${lastIndex}`;

    // Bold (**text** or __text__)
    if ((token.startsWith('**') && token.endsWith('**')) || (token.startsWith('__') && token.endsWith('__'))) {
      const inner = token.slice(2, -2).trim();
      // If bold text has bracket tags like 【中长期气象融合密度预测模型】
      if (inner.startsWith('【') && inner.endsWith('】')) {
        parts.push(
          <strong
            key={key}
            className={
              isUser
                ? 'font-bold underline underline-offset-2'
                : 'font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/60 px-1 py-0.5 rounded border border-sky-200/80 dark:border-sky-800/80 inline-block mx-0.5 align-baseline text-[11px]'
            }
          >
            {inner}
          </strong>
        );
      } else {
        parts.push(
          <strong
            key={key}
            className={
              isUser
                ? 'font-bold text-white'
                : 'font-bold text-slate-900 dark:text-slate-100'
            }
          >
            {inner}
          </strong>
        );
      }
    }
    // Inline code (`code` or ```code```)
    else if (token.startsWith('`') && token.endsWith('`')) {
      const codeFenceLen = token.match(/^`+/)?.[0].length || 1;
      const inner = token.slice(codeFenceLen, -codeFenceLen);
      parts.push(
        <code
          key={key}
          className={`font-mono text-[11px] px-1 py-0.5 rounded ${
            isUser
              ? 'bg-sky-700/80 text-white border border-sky-500/40'
              : 'bg-slate-200/80 dark:bg-slate-800 text-sky-700 dark:text-sky-300 border border-slate-300 dark:border-slate-700'
          }`}
        >
          {inner}
        </code>
      );
    }
    // Italic (*text* or _text_)
    else if ((token.startsWith('*') && token.endsWith('*')) || (token.startsWith('_') && token.endsWith('_'))) {
      const inner = token.slice(1, -1);
      if (token.startsWith('_')) {
        const prevChar = match.index > 0 ? text[match.index - 1] : ' ';
        const nextChar = match.index + token.length < text.length ? text[match.index + token.length] : ' ';
        if (/\w/.test(prevChar) || /\w/.test(nextChar)) {
          parts.push(token);
          lastIndex = regex.lastIndex;
          continue;
        }
      }
      parts.push(
        <em key={key} className="italic">
          {inner}
        </em>
      );
    }
    // Link ([text](url))
    else if (token.startsWith('[') && token.includes('](') && token.endsWith(')')) {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        parts.push(
          <a
            key={key}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-500 underline hover:text-sky-400 font-medium"
          >
            {linkMatch[1]}
          </a>
        );
      } else {
        parts.push(token);
      }
    } else {
      parts.push(token);
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts;
}
