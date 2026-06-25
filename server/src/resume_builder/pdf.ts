import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { normalizeResumeDraft } from '../ai/builderData.js'

function stringify(value: unknown): string {
  if (typeof value === 'string') return value
  if (value == null) return ''
  return String(value)
}

function wrapText(text: string, maxChars = 92): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
  const lines: string[] = []
  let line = ''

  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (next.length > maxChars && line) {
      lines.push(line)
      line = word
    } else {
      line = next
    }
  }

  if (line) lines.push(line)
  return lines
}

export async function renderResumePdf(resumeData: unknown, template = 'simple'): Promise<Uint8Array> {
  void template

  const resume = normalizeResumeDraft(resumeData)
  const pdfDoc = await PDFDocument.create()
  let page = pdfDoc.addPage([595.28, 841.89])
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  let y = 800
  const margin = 50
  const bottomMargin = 50

  const ensureSpace = (space: number) => {
    if (y - space >= bottomMargin) return
    page = pdfDoc.addPage([595.28, 841.89])
    y = 800
  }

  const drawLine = (text: string, size = 10, bold = false, color = rgb(0, 0, 0)) => {
    ensureSpace(size + 8)
    page.drawText(text, {
      x: margin,
      y,
      size,
      font: bold ? boldFont : font,
      color,
    })
    y -= size + 6
  }

  const drawWrapped = (text: string, size = 10, indent = 0) => {
    for (const line of wrapText(text)) {
      ensureSpace(size + 8)
      page.drawText(line, {
        x: margin + indent,
        y,
        size,
        font,
        color: rgb(0.1, 0.1, 0.1),
      })
      y -= size + 6
    }
  }

  const drawSection = (title: string, drawContent: () => void) => {
    ensureSpace(36)
    y -= 8
    drawLine(title.toUpperCase(), 12, true)
    drawContent()
  }

  drawLine(resume.personal_name || 'Your Name', 24, true)

  const contact = [resume.contact_email, resume.contact_phone, resume.contact_address].filter(Boolean).join(' | ')
  if (contact) drawLine(contact, 10, false, rgb(0.3, 0.3, 0.3))
  y -= 12

  if (resume.target_role) {
    drawSection('Target Role', () => drawWrapped(resume.target_role || ''))
  }

  if (resume.summary) {
    drawSection('Professional Summary', () => drawWrapped(resume.summary || ''))
  }

  if (resume.skills?.length) {
    drawSection('Skills', () => drawWrapped(resume.skills?.join(', ') || ''))
  }

  if (resume.experience?.length) {
    drawSection('Experience', () => {
      for (const item of resume.experience || []) {
        drawLine([item.role, item.organization].filter(Boolean).join(' - '), 10, true)
        if (item.dates) drawLine(item.dates, 9, false, rgb(0.35, 0.35, 0.35))
        for (const duty of item.duties || []) {
          drawWrapped(`- ${duty}`, 10, 8)
        }
        y -= 4
      }
    })
  }

  if (resume.education?.length) {
    drawSection('Education & Training', () => {
      for (const item of resume.education || []) {
        const qualification = item.qualification ?? item.degree
        const institution = item.institution ?? item.school
        drawWrapped([qualification, institution, item.year ?? item.dates].filter(Boolean).map(stringify).join(' - '))
      }
    })
  }

  if (resume.certificates?.length) {
    drawSection('Certificates', () => {
      for (const cert of resume.certificates || []) {
        drawWrapped(`- ${typeof cert === 'string' ? cert : cert.title ?? cert.name ?? ''}`)
      }
    })
  }

  if (resume.availability) {
    drawSection('Availability', () => drawWrapped(resume.availability || ''))
  }

  drawSection('References', () => drawWrapped(resume.references || 'Available on request'))

  return pdfDoc.save()
}
