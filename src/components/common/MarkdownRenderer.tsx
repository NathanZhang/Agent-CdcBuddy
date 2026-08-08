import React from 'react';

export interface MarkdownRendererProps {
  content: string;
  className?: string;
  isUser?: boolean;
}

type Section =
  | { type: 'code'; content: string; lang?: string }
  | { type: 'heading'; level: number; content: string }
  | { type: 'quote'; content: string }
  | { type: 'list'; ordered: boolean; content: string; items: string[] }
  | { type: 'paragraph'; content: string };

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className = '',
  isUser = false,
}) => {
  if (!content) return null;

  // Split content into blocks by code fences or multiple newlines
  const sections = splitContentIntoSections(content);

  return (
    <div className={`markdown-content space-y-2 text-xs leading-relaxed ${className}`}>
      {sections.map((sec, idx) => {
        if (sec.type === 'code') {
          return (
            <div
              key={idx}
              className="my-2 rounded-lg bg-slate-900 text-slate-100 p-3 font-mono text-[11px] overflow-x-auto border border-slate-800"
            >
              {sec.lang && (
                <div className="text-[10px] text-slate-400 font-semibold mb-1 uppercase tracking-wider">
                  {sec.lang}
                </div>
              )}
              <pre className="whitespace-pre">{sec.content}</pre>
            </div>
          );
        }

        if (sec.type === 'heading') {
          const Tag = `h${Math.min(sec.level + 2, 6)}` as keyof React.JSX.IntrinsicElements;
          return (
            <Tag
              key={idx}
              className={`font-bold ${
                sec.level === 1
                  ? 'text-sm text-sky-600 dark:text-sky-400 mt-2 mb-1'
                  : 'text-xs text-slate-900 dark:text-slate-100 mt-1.5 mb-1'
              }`}
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

        if (sec.type === 'list') {
          if (sec.ordered) {
            return (
              <ol key={idx} className="list-decimal list-inside space-y-1 my-1 pl-1 text-slate-800 dark:text-slate-200">
                {sec.items.map((item, itemIdx) => (
                  <li key={itemIdx} className="leading-relaxed">
                    {renderInline(item, isUser)}
                  </li>
                ))}
              </ol>
            );
          }
          return (
            <ul key={idx} className="list-disc list-inside space-y-1 my-1 pl-1 text-slate-800 dark:text-slate-200">
              {sec.items.map((item, itemIdx) => (
                <li key={itemIdx} className="leading-relaxed">
                  {renderInline(item, isUser)}
                </li>
              ))}
            </ul>
          );
        }

        // Standard Paragraph
        const lines = sec.content.split('\n');
        return (
          <p key={idx} className="leading-relaxed">
            {lines.map((line, lineIdx) => (
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

function splitContentIntoSections(raw: string): Section[] {
  const sections: Section[] = [];
  const lines = raw.split('\n');
  let inCodeBlock = false;
  let codeLang = '';
  let codeBuffer: string[] = [];
  let paragraphBuffer: string[] = [];

  const flushParagraph = () => {
    if (paragraphBuffer.length > 0) {
      const text = paragraphBuffer.join('\n').trim();
      if (text) {
        // Parse lists if applicable
        const pLines = text.split('\n');
        const isBulletList = pLines.length > 0 && pLines.every((l) => /^\s*[-*•]\s+/.test(l));
        const isNumberedList = pLines.length > 0 && pLines.every((l) => /^\s*\d+[\.\)]\s+/.test(l));

        if (isBulletList) {
          sections.push({
            type: 'list',
            ordered: false,
            content: text,
            items: pLines.map((l) => l.replace(/^\s*[-*•]\s+/, '')),
          });
        } else if (isNumberedList) {
          sections.push({
            type: 'list',
            ordered: true,
            content: text,
            items: pLines.map((l) => l.replace(/^\s*\d+[\.\)]\s+/, '')),
          });
        } else {
          sections.push({
            type: 'paragraph',
            content: text,
          });
        }
      }
      paragraphBuffer = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code fence
    if (line.trim().startsWith('```')) {
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
        flushParagraph();
        inCodeBlock = true;
        codeLang = line.trim().slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      sections.push({
        type: 'heading',
        level: headingMatch[1].length,
        content: headingMatch[2],
      });
      continue;
    }

    // Quote
    if (line.startsWith('>')) {
      flushParagraph();
      sections.push({
        type: 'quote',
        content: line.replace(/^>\s*/, ''),
      });
      continue;
    }

    // Empty line -> paragraph separator
    if (line.trim() === '') {
      flushParagraph();
      continue;
    }

    paragraphBuffer.push(line);
  }

  if (inCodeBlock && codeBuffer.length > 0) {
    sections.push({
      type: 'code',
      content: codeBuffer.join('\n'),
      lang: codeLang,
    });
  }

  flushParagraph();
  return sections;
}

// Inline parser for bold, italic, code, links, highlighted brackets
function renderInline(text: string, isUser: boolean): React.ReactNode[] {
  // Regex to match:
  // 1. **bold** or __bold__ (allowing inner whitespace/brackets)
  // 2. `code`
  // 3. *italic* or _italic_
  // 4. [text](url)
  const regex = /(\*\*(?:[^*]|\*(?!\*))+?\*\*|__(?:[^_]|_(?!_))+?__|`[^`]+?`|\*[^*\n]+?\*|_[^_\n]+?_|\[[^\]]+?\]\([^)]+?\))/g;
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
                : 'font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/60 px-1 py-0.5 rounded border border-sky-200/80 dark:border-sky-800/80 inline-block mx-0.5 align-baseline text-[12px]'
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
    // Inline code (`code`)
    else if (token.startsWith('`') && token.endsWith('`')) {
      const inner = token.slice(1, -1);
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
