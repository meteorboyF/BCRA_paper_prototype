import React from 'react'

/**
 * Minimal markdown renderer for AI responses — no external deps.
 * Supports: ### headings, **bold**, *italic*, `inline code`, ``` code blocks,
 * - / * bullet lists, 1. numbered lists, and paragraphs. Anything else renders
 * as plain text, so malformed model output never breaks the layout.
 */

const INLINE_TOKEN = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`)/g

function renderInline(text: string): React.ReactNode[] {
  return text.split(INLINE_TOKEN).filter(Boolean).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-gold-200">{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={i}>{part.slice(1, -1)}</em>
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} className="rounded bg-navy-950/70 px-1.5 py-0.5 font-mono text-[0.85em] text-gold-300">{part.slice(1, -1)}</code>
    }
    return <React.Fragment key={i}>{part}</React.Fragment>
  })
}

type Block =
  | { type: 'p'; text: string }
  | { type: 'h'; level: number; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'code'; text: string }

function parseBlocks(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const blocks: Block[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.trim() === '') { i++; continue }

    if (line.trimStart().startsWith('```')) {
      const buf: string[] = []
      i++
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) { buf.push(lines[i]); i++ }
      i++ // skip closing fence
      blocks.push({ type: 'code', text: buf.join('\n') })
      continue
    }

    const heading = line.match(/^(#{1,4})\s+(.*)$/)
    if (heading) {
      blocks.push({ type: 'h', level: heading[1].length, text: heading[2] })
      i++
      continue
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''))
        i++
      }
      blocks.push({ type: 'ul', items })
      continue
    }

    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+[.)]\s+/, ''))
        i++
      }
      blocks.push({ type: 'ol', items })
      continue
    }

    // Paragraph: gather consecutive plain lines
    const buf: string[] = []
    while (i < lines.length && lines[i].trim() !== '' &&
      !/^(#{1,4})\s+/.test(lines[i]) && !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+[.)]\s+/.test(lines[i]) && !lines[i].trimStart().startsWith('```')) {
      buf.push(lines[i])
      i++
    }
    blocks.push({ type: 'p', text: buf.join('\n') })
  }
  return blocks
}

export function AiMarkdown({ content, className = '' }: { content: string; className?: string }) {
  const blocks = parseBlocks(content ?? '')
  return (
    <div className={`space-y-2.5 text-sm leading-relaxed ${className}`}>
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'h': {
            const sizes = ['text-base', 'text-base', 'text-sm', 'text-sm']
            return (
              <p key={i} className={`${sizes[b.level - 1]} pt-1 font-serif font-bold tracking-wide text-gold-300`}>
                {renderInline(b.text)}
              </p>
            )
          }
          case 'ul':
            return (
              <ul key={i} className="space-y-1.5 pl-1">
                {b.items.map((item, j) => (
                  <li key={j} className="flex gap-2">
                    <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-gold-400" />
                    <span className="min-w-0">{renderInline(item)}</span>
                  </li>
                ))}
              </ul>
            )
          case 'ol':
            return (
              <ol key={i} className="space-y-1.5 pl-1">
                {b.items.map((item, j) => (
                  <li key={j} className="flex gap-2">
                    <span className="shrink-0 font-mono text-xs font-semibold text-gold-400">{j + 1}.</span>
                    <span className="min-w-0">{renderInline(item)}</span>
                  </li>
                ))}
              </ol>
            )
          case 'code':
            return (
              <pre key={i} className="overflow-x-auto rounded-lg border border-gold-500/10 bg-navy-950/70 p-3 font-mono text-xs leading-relaxed text-gold-100">
                {b.text}
              </pre>
            )
          default:
            return <p key={i} className="whitespace-pre-wrap break-words">{renderInline(b.text)}</p>
        }
      })}
    </div>
  )
}
