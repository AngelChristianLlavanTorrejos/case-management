import { pdf } from '@react-pdf/renderer'

import { NoticeOfExecutionPdfDocument } from '@/components/execution/notice-of-execution-pdf-document'
import { getNoticeOfExecution } from '@/lib/notice-of-execution-api'
import { ordinalDay } from '@/lib/pdf-dates'

export type ExecutionPdfDateParts = {
  day: string
  month: string
  year: string
}

export type ExecutionPdfData = {
  barangayCaseNo: string
  complaintType: string
  complainants: string[]
  respondents: string[]
  settlementDate: ExecutionPdfDateParts
  terms: string
  partyObligedNames: string
  personalPropertyOf: string
  amount: string
  signed: ExecutionPdfDateParts
}

function splitDateParts(value: string | null): ExecutionPdfDateParts {
  if (!value) return { day: '', month: '', year: '' }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return { day: '', month: '', year: '' }
  return {
    day: ordinalDay(date.getDate()),
    month: date.toLocaleDateString('en-PH', { month: 'long' }),
    year: String(date.getFullYear()),
  }
}

export async function loadNoticeOfExecutionPdfData(id: number): Promise<ExecutionPdfData> {
  const record = await getNoticeOfExecution(id)
  const complainants = record.complainants.map((name) => name.trim()).filter(Boolean)
  const respondents = record.respondents.map((name) => name.trim()).filter(Boolean)
  const partyObligedNames =
    record.party_obliged === 'respondents' ? respondents.join(', ') : complainants.join(', ')

  return {
    barangayCaseNo: (record.barangay_case_no ?? '').trim(),
    complaintType: (record.complaint_type ?? '').trim(),
    complainants,
    respondents,
    settlementDate: splitDateParts(record.settlement_created_at),
    terms: record.terms.trim(),
    partyObligedNames,
    personalPropertyOf: record.personal_property_of.trim(),
    amount: record.amount.trim(),
    signed: splitDateParts(record.created_at),
  }
}

export async function downloadNoticeOfExecutionPdf(id: number) {
  const data = await loadNoticeOfExecutionPdfData(id)
  const blob = await pdf(NoticeOfExecutionPdfDocument({ data })).toBlob()
  const slug = (data.barangayCaseNo || `execution-${id}`).replace(/[^\w.-]+/g, '_')
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `notice-of-execution-${slug}.pdf`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
