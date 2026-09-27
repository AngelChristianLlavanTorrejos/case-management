import { pdf } from '@react-pdf/renderer'

import { AmicableSettlementPdfDocument } from '@/components/settlement/amicable-settlement-pdf-document'
import { getAmicableSettlement } from '@/lib/amicable-settlement-api'
import { ordinalDay } from '@/lib/pdf-dates'

export type SettlementPdfDateParts = {
  day: string
  month: string
  year: string
}

export type AmicableSettlementPdfData = {
  barangayCaseNo: string
  complaintType: string
  complainants: string[]
  respondents: string[]
  terms: string
  entered: SettlementPdfDateParts
}

function splitDateParts(value: string | null): SettlementPdfDateParts {
  if (!value) return { day: '', month: '', year: '' }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return { day: '', month: '', year: '' }
  return {
    day: ordinalDay(date.getDate()),
    month: date.toLocaleDateString('en-PH', { month: 'long' }),
    year: String(date.getFullYear()),
  }
}

export async function loadAmicableSettlementPdfData(id: number): Promise<AmicableSettlementPdfData> {
  const record = await getAmicableSettlement(id)
  return {
    barangayCaseNo: (record.barangay_case_no ?? '').trim(),
    complaintType: (record.complaint_type ?? '').trim(),
    complainants: record.complainants.map((name) => name.trim()).filter(Boolean),
    respondents: record.respondents.map((name) => name.trim()).filter(Boolean),
    terms: record.terms.trim(),
    entered: splitDateParts(record.created_at),
  }
}

export async function downloadAmicableSettlementPdf(id: number) {
  const data = await loadAmicableSettlementPdfData(id)
  const blob = await pdf(AmicableSettlementPdfDocument({ data })).toBlob()
  const slug = (data.barangayCaseNo || `settlement-${id}`).replace(/[^\w.-]+/g, '_')
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `amicable-settlement-${slug}.pdf`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
