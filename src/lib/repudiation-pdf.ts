
import { RepudiationPdfDocument } from '@/components/repudiation/repudiation-pdf-document'
import { pdfDocumentToBlob } from '@/lib/pdf-document-blob'
import { ordinalDay } from '@/lib/pdf-dates'
import { getLuponChairmanName } from '@/lib/positions-api'
import { getRepudiation } from '@/lib/repudiation-api'

export type RepudiationPdfDateParts = {
  day: string
  month: string
  year: string
}

export type RepudiationPdfData = {
  barangayCaseNo: string
  complaintType: string
  complainants: string[]
  respondents: string[]
  fraud: boolean
  fraudDetails: string
  violence: boolean
  violenceDetails: string
  intimidation: boolean
  intimidationDetails: string
  thisDate: RepudiationPdfDateParts
  sworn: RepudiationPdfDateParts
  received: RepudiationPdfDateParts
  receivedAndFiledByName: string
  luponChairmanName: string
}

function splitDateParts(value: string | null): RepudiationPdfDateParts {
  if (!value) return { day: '', month: '', year: '' }
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value)
  if (Number.isNaN(date.getTime())) return { day: '', month: '', year: '' }
  return {
    day: ordinalDay(date.getDate()),
    month: date.toLocaleDateString('en-PH', { month: 'long' }),
    year: String(date.getFullYear()),
  }
}

export async function loadRepudiationPdfData(
  id: number,
  actorUserId: number,
): Promise<RepudiationPdfData> {
  const [record, luponChairmanName] = await Promise.all([
    getRepudiation(id, actorUserId),
    getLuponChairmanName(),
  ])
  return {
    barangayCaseNo: (record.barangay_case_no ?? '').trim(),
    complaintType: (record.complaint_type ?? '').trim(),
    complainants: record.complainants.map((name) => name.trim()).filter(Boolean),
    respondents: record.respondents.map((name) => name.trim()).filter(Boolean),
    fraud: record.fraud,
    fraudDetails: record.fraud_details.trim(),
    violence: record.violence,
    violenceDetails: record.violence_details.trim(),
    intimidation: record.intimidation,
    intimidationDetails: record.intimidation_details.trim(),
    thisDate: splitDateParts(record.created_at),
    sworn: splitDateParts(record.sworn_on),
    received: splitDateParts(record.received_and_filed_on),
    receivedAndFiledByName: (record.received_and_filed_by_name ?? '').trim(),
    luponChairmanName,
  }
}

export async function downloadRepudiationPdf(id: number, actorUserId: number) {
  const data = await loadRepudiationPdfData(id, actorUserId)
  const blob = await pdfDocumentToBlob(RepudiationPdfDocument({ data }))
  const slug = (data.barangayCaseNo || `repudiation-${id}`).replace(/[^\w.-]+/g, '_')
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `repudiation-${slug}.pdf`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
