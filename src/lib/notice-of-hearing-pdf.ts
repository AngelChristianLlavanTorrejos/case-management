import { pdf } from '@react-pdf/renderer'

import { NoticeOfHearingPdfDocument } from '@/components/hearing/notice-of-hearing-pdf-document'
import { getNoticeOfHearing } from '@/lib/hearing-summon-api'
import { ordinalDay } from '@/lib/pdf-dates'

export type NoticeHearingPdfDateParts = {
  day: string
  month: string
  year: string
}

export type NoticeHearingPdfTimeParts = {
  time: string
  period: string
}

export type NoticeHearingPdfData = {
  barangayCaseNo: string
  complainants: string
  appear: NoticeHearingPdfDateParts & NoticeHearingPdfTimeParts
  issued: NoticeHearingPdfDateParts
  acknowledged: NoticeHearingPdfDateParts
}

function calendarDate(value: string | null) {
  if (!value) return null
  const dateOnly = value.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return null
  const date = new Date(`${dateOnly}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function splitDateParts(value: string | null): NoticeHearingPdfDateParts {
  const date = calendarDate(value)
  if (!date) return { day: '', month: '', year: '' }
  return {
    day: ordinalDay(date.getDate()),
    month: date.toLocaleDateString('en-PH', { month: 'long' }),
    year: String(date.getFullYear()),
  }
}

function splitAppearParts(value: string | null): NoticeHearingPdfDateParts & NoticeHearingPdfTimeParts {
  if (!value) return { day: '', month: '', year: '', time: '', period: '' }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return { day: '', month: '', year: '', time: '', period: '' }
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const hour12 = hours % 12 || 12
  const time = minutes === 0 ? String(hour12) : `${hour12}:${String(minutes).padStart(2, '0')}`
  return {
    day: ordinalDay(date.getDate()),
    month: date.toLocaleDateString('en-PH', { month: 'long' }),
    year: String(date.getFullYear()),
    time,
    period: hours < 12 ? 'morning' : 'afternoon',
  }
}

export async function loadNoticeOfHearingPdfData(id: number, actorUserId: number): Promise<NoticeHearingPdfData> {
  const notice = await getNoticeOfHearing(id, actorUserId)
  return {
    barangayCaseNo: (notice.barangay_case_no ?? '').trim(),
    complainants: (notice.complainants ?? '').trim(),
    appear: splitAppearParts(notice.appear_at),
    issued: splitDateParts(notice.issued_on),
    acknowledged: splitDateParts(notice.acknowledged_on),
  }
}

export async function downloadNoticeOfHearingPdf(id: number, actorUserId: number) {
  const data = await loadNoticeOfHearingPdfData(id, actorUserId)
  const blob = await pdf(NoticeOfHearingPdfDocument({ data })).toBlob()
  const slug = (data.barangayCaseNo || `notice-${id}`).replace(/[^\w.-]+/g, '_')
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `notice-of-hearing-${slug}.pdf`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
