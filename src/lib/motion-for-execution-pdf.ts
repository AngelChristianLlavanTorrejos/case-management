import { pdf } from '@react-pdf/renderer'

import { MotionForExecutionPdfDocument } from '@/components/motion/motion-for-execution-pdf-document'
import { getMotionForExecution } from '@/lib/motion-for-execution-api'
import { ordinalDay } from '@/lib/pdf-dates'

export type MotionPdfDateParts = {
  day: string
  month: string
  year: string
}

export type MotionPdfData = {
  barangayCaseNo: string
  complaintType: string
  complainants: string[]
  respondents: string[]
  settlementDate: MotionPdfDateParts
  motionDate: MotionPdfDateParts
}

function splitDateParts(value: string | null): MotionPdfDateParts {
  if (!value) return { day: '', month: '', year: '' }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return { day: '', month: '', year: '' }
  return {
    day: ordinalDay(date.getDate()),
    month: date.toLocaleDateString('en-PH', { month: 'long' }),
    year: String(date.getFullYear()),
  }
}

export async function loadMotionForExecutionPdfData(id: number): Promise<MotionPdfData> {
  const record = await getMotionForExecution(id)
  return {
    barangayCaseNo: (record.barangay_case_no ?? '').trim(),
    complaintType: (record.complaint_type ?? '').trim(),
    complainants: record.complainants.map((name) => name.trim()).filter(Boolean),
    respondents: record.respondents.map((name) => name.trim()).filter(Boolean),
    settlementDate: splitDateParts(record.settlement_created_at),
    motionDate: splitDateParts(record.created_at),
  }
}

export async function downloadMotionForExecutionPdf(id: number) {
  const data = await loadMotionForExecutionPdfData(id)
  const blob = await pdf(MotionForExecutionPdfDocument({ data })).toBlob()
  const slug = (data.barangayCaseNo || `motion-${id}`).replace(/[^\w.-]+/g, '_')
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `motion-for-execution-${slug}.pdf`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
