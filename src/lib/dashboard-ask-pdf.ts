
import { DashboardAskPdfDocument } from '@/components/ai/dashboard-ask-pdf-document'
import { pdfDocumentToBlob } from '@/lib/pdf-document-blob'
import type { DashboardPeriod } from '@/lib/dashboard-api'

export type DashboardAskPdfData = {
  question: string
  periodLabel: string
  answer: string
  generatedAt: string
}

export async function downloadDashboardAskPdf(input: {
  question: string
  period: DashboardPeriod
  answer: string
}) {
  const data: DashboardAskPdfData = {
    question: input.question.trim(),
    periodLabel: input.period === 'year' ? 'This year' : 'This month',
    answer: input.answer.trim(),
    generatedAt: new Date().toLocaleString('en-PH', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }),
  }

  const blob = await pdfDocumentToBlob(DashboardAskPdfDocument({ data }))
  const slug = data.question
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `ask-ai-report-${slug || 'report'}.pdf`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
