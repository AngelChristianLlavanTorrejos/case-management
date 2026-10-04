import { pdf } from '@react-pdf/renderer'

import { SummonPdfDocument } from '@/components/summon/summon-pdf-document'
import { getComplaint } from '@/lib/complaints-api'
import { getSummon } from '@/lib/hearing-summon-api'
import { ordinalDay } from '@/lib/pdf-dates'

export type SummonPdfDateParts = {
  day: string
  month: string
  year: string
}

export type SummonPdfTimeParts = {
  time: string
  period: string
}

export type SummonPdfData = {
  barangayCaseNo: string
  complaintType: string
  complainants: string[]
  respondents: string[]
  appear: SummonPdfDateParts & SummonPdfTimeParts
  issued: SummonPdfDateParts
  served: SummonPdfDateParts
  dwellingRecipient: string
  officeRecipient: string
  officerInCharge: string
  personalService: boolean
}

function splitDateParts(value: string | null): SummonPdfDateParts {
  if (!value) return { day: '', month: '', year: '' }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return { day: '', month: '', year: '' }
  return {
    day: ordinalDay(date.getDate()),
    month: date.toLocaleDateString('en-PH', { month: 'long' }),
    year: String(date.getFullYear()),
  }
}

function splitTimeParts(value: string | null): SummonPdfTimeParts {
  if (!value) return { time: '', period: '' }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return { time: '', period: '' }
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const hour12 = hours % 12 || 12
  const time = minutes === 0 ? String(hour12) : `${hour12}:${String(minutes).padStart(2, '0')}`
  return {
    time,
    period: hours < 12 ? 'morning' : 'afternoon',
  }
}

function namesFromJoined(value: string) {
  return value
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
}

export async function loadSummonPdfData(id: number, actorUserId: number): Promise<SummonPdfData> {
  const summon = await getSummon(id)
  const complaint = await getComplaint(summon.complaint_id, actorUserId)
  const complainants = complaint.complainants.map((name) => name.trim()).filter(Boolean)
  const respondents = complaint.respondents.map((name) => name.trim()).filter(Boolean)
  const dwellingRecipient = (summon.dwelling_recipient ?? '').trim()
  const officeRecipient = (summon.office_recipient ?? '').trim()

  return {
    barangayCaseNo: (summon.barangay_case_no ?? complaint.barangay_case_no ?? '').trim(),
    complaintType: (complaint.complaint_type ?? '').trim(),
    complainants,
    respondents: respondents.length > 0 ? respondents : namesFromJoined(summon.respondents),
    appear: {
      ...splitDateParts(summon.appear_at),
      ...splitTimeParts(summon.appear_at),
    },
    issued: splitDateParts(summon.issued_on),
    served: splitDateParts(summon.served_on),
    dwellingRecipient,
    officeRecipient,
    officerInCharge: (summon.officer_in_charge ?? '').trim(),
    personalService: Boolean(summon.served_on && !dwellingRecipient && !officeRecipient),
  }
}

export async function downloadSummonPdf(id: number, actorUserId: number) {
  const data = await loadSummonPdfData(id, actorUserId)
  const blob = await pdf(SummonPdfDocument({ data })).toBlob()
  const slug = (data.barangayCaseNo || `summon-${id}`).replace(/[^\w.-]+/g, '_')
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `summons-${slug}.pdf`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
