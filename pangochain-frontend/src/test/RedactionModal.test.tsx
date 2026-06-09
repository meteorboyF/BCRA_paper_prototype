import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { extractEditableText, normalizeRedactedName } from '../components/RedactionModal'

async function makeDocx(lines: string[]) {
  const zip = new JSZip()
  zip.file('word/document.xml', [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>',
    ...lines.map((line) => `<w:p><w:r><w:t>${line}</w:t></w:r></w:p>`),
    '</w:body></w:document>',
  ].join(''))
  return zip.generateAsync({ type: 'arraybuffer' })
}

describe('RedactionModal helpers', () => {
  it('extracts the actual text from text-like files', async () => {
    const source = new TextEncoder().encode('Client: Marcus Chen\nLease: MC-LEASE-2021-7784').buffer

    await expect(extractEditableText(source, 'matter-notes.md')).resolves.toEqual({
      text: 'Client: Marcus Chen\nLease: MC-LEASE-2021-7784',
      format: 'text',
    })
  })

  it('extracts editable text from docx files in browser-compatible form', async () => {
    const source = await makeDocx(['Client: Marcus Chen', 'Authority: $445,000'])

    await expect(extractEditableText(source, 'authority.docx')).resolves.toEqual({
      text: 'Client: Marcus Chen\nAuthority: $445,000',
      format: 'docx',
    })
  })

  it('names saved redactions as the next version without compounding old redaction labels', () => {
    expect(normalizeRedactedName('EXPERIMENT_PROGRESS.md', 2, 'text'))
      .toBe('EXPERIMENT_PROGRESS v2 redacted.md')
    expect(normalizeRedactedName('EXPERIMENT_PROGRESS (redacted).md', 2, 'text'))
      .toBe('EXPERIMENT_PROGRESS v2 redacted.md')
    expect(normalizeRedactedName('authority.docx', 2, 'docx'))
      .toBe('authority v2 redacted.txt')
  })
})
