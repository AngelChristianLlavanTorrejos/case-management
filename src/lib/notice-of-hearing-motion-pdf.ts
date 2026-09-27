import { pdf } from '@react-pdf/renderer'

import { NoticeOfHearingMotionPdfDocument } from '@/components/motion/notice-of-hearing-motion-pdf-document'
import { getNoticeOfHearingMotion } from '@/lib/notice-of-hearing-motion-api'
import { ordinalDay } from '@/lib/pdf-dates'

export type NoticeMotionPdfDateParts = {
  day: string
  month: string
  year: string
}

export type NoticeMotionPdfTimeParts = {
  time: string
  period: string
}

export type NoticeMotionPdfData = {
  barangayCaseNo: string
  complaintType: string
  complainants: string[]
  respondents: string[]
  appear: NoticeMotionPdfDateParts & NoticeMotionPdfTimeParts
  filedByNames: string
  issued: NoticeMotionPdfDateParts
}

function splitDateParts(value: string | null): NoticeMotionPdfDateParts {
  if (!value) return { day: '', month: '', year: '' }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return { day: '', month: '', year: '' }
  return {
    day: ordinalDay(date.getDate()),
    month: date.toLocaleDateString('en-PH', { month: 'long' }),
    year: String(date.getFullYear()),
  }
}

function splitTimeParts(value: string | null): NoticeMotionPdfTimeParts {
  if (!value) return { time: '', period: '' }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return { time: '', period: '' }
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const hour12 = hours % 12 || 12
  const time = minutes === 0 ? String(hour12) : `${hour12}:${String(minutes).padStart(2, '0')}`
  let period = 'afternoon'
  if (hours < 12) period = 'morning'
  else if (hours >= 18) period = 'evening'
  return { time, period }
}

export async function loadNoticeOfHearingMotionPdfData(id: number): Promise<NoticeMotionPdfData> {
  const record = await getNoticeOfHearingMotion(id)
  const complainants = record.complainants.map((name) => name.trim()).filter(Boolean)
  const respondents = record.respondents.map((name) => name.trim()).filter(Boolean)
  const filedByNames =
    record.filed_by === 'respondents' ? respondents.join(', ') : complainants.join(', ')

  return {
    barangayCaseNo: (record.barangay_case_no ?? '').trim(),
    complaintType: (record.complaint_type ?? '').trim(),
    complainants,
    respondents,
    appear: {
      ...splitDateParts(record.appear_at),
      ...splitTimeParts(record.appear_at),
    },
    filedByNames,
    issued: splitDateParts(record.issued_on),
  }
}

export async function downloadNoticeOfHearingMotionPdf(id: number) {
  const data = await loadNoticeOfHearingMotionPdfData(id)
  const blob = await pdf(NoticeOfHearingMotionPdfDocument({ data })).toBlob()
  const slug = (data.barangayCaseNo || `notice-motion-${id}`).replace(/[^\w.-]+/g, '_')
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `notice-of-hearing-motion-${slug}.pdf`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
