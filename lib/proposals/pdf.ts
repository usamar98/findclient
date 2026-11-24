import PDFDocument from 'pdfkit'
import path from 'node:path'
import { formatPrice, type Proposal } from './model'

const regular = path.join(process.cwd(), 'node_modules/geist/dist/fonts/geist-sans/Geist-Regular.ttf')
const semibold = path.join(process.cwd(), 'node_modules/geist/dist/fonts/geist-sans/Geist-SemiBold.ttf')

export async function renderProposalPdf(proposal: Proposal): Promise<Uint8Array<ArrayBuffer>> {
  const doc = new PDFDocument({
    size: 'A4', margins: { top: 50, left: 50, right: 50, bottom: 64 },
    font: regular, bufferPages: true,
    info: { Title: proposal.title, Author: proposal.brand, Subject: 'Project proposal' },
  })
  const buffers: Buffer[] = []
  const output = new Promise<Uint8Array<ArrayBuffer>>((resolve, reject) => {
    doc.on('data', piece => buffers.push(piece))
    doc.on('error', reject)
    doc.on('end', () => resolve(Uint8Array.from(Buffer.concat(buffers))))
  })
  const width = doc.page.width - 100
  function line(text: string, size: number, bold = false, gray = false) {
    doc.font(bold ? semibold : regular).fontSize(size).fillColor(gray ? '#515151' : '#171717')
      .text(text, 50, doc.y, { width, lineGap: 3 })
  }
  function space(points: number) { doc.y += points }
  function room(points: number) {
    if (doc.y + points > doc.page.height - doc.page.margins.bottom) doc.addPage()
  }
  function rule() {
    doc.moveTo(50, doc.y).lineTo(50 + width, doc.y).lineWidth(0.8).strokeColor('#c9c9c9').stroke()
    space(13)
  }
  if (proposal.logo) {
    const logo = Buffer.from(proposal.logo.slice('data:image/jpeg;base64,'.length), 'base64')
    const y = doc.y
    doc.image(logo, 50, y, { fit: [140, 43] })
    doc.y = y + 50
  }
  line(proposal.brand, 14, true)
  space(12)
  rule()
  line('PROJECT PROPOSAL', 9, true, true)
  space(6)
  line(proposal.title, 30, true)
  space(8)
  line('Prepared for ' + proposal.recipient, 12, false, true)
  space(23)
  room(75)
  line('Scope of work', 16, true)
  space(4)
  line(proposal.scope, 11)
  space(20)
  room(115)
  line(proposal.packages.length === 1 ? 'Package' : 'Package options', 16, true)
  for (const pack of proposal.packages) {
    room(95)
    space(8)
    rule()
    line(pack.name, 14, true)
    line(formatPrice(pack.priceCents, proposal.currency), 12, true)
    space(4)
    line(pack.details, 11)
    space(4)
    line('Timeline · ' + pack.timeline, 10, false, true)
  }
  if (proposal.contact) {
    space(20)
    room(55)
    line('Contact', 13, true)
    line(proposal.contact, 11)
  }
  const pages = doc.bufferedPageRange()
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i)
    doc.font(regular).fontSize(9).fillColor('#646464').text(
      'Project proposal  /  ' + (i + 1) + ' of ' + pages.count, 50, doc.page.height - 37, { lineBreak: false },
    )
  }
  doc.end()
  return output
}

export async function proposalDownload(proposal: Proposal) {
  return new Response(await renderProposalPdf(proposal), {
    headers: {
      'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="project-proposal.pdf"',
      'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer',
    },
  })
}
