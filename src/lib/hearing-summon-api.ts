import { notifyComplaintSms } from '@/lib/complaint-sms'
import { supabase } from '@/lib/supabase'

export type HearingListRow = {
  id: number
  complaint_id: number
  barangay_case_no: string | null
  complainants: string
  appear_at: string
  issued_on: string
  acknowledged_on: string | null
  status: string
}

export type HearingRecord = HearingListRow

export type SummonListRow = {
  id: number
  complaint_id: number
  barangay_case_no: string | null
  respondents: string
  appear_at: string
  issued_on: string
  served_on: string | null
  officer_in_charge: string | null
}

export type SummonAttachment = {
  id: number
  file_path: string
  file_name: string
}

export type SummonRecord = SummonListRow & {
  dwelling_recipient: string | null
  office_recipient: string | null
  attachments: SummonAttachment[]
}

type ListQuery = {
  search: string
  sortKey: string
  sortDir: 'asc' | 'desc'
  page: number
  pageSize: number
}

function rpcError(message: string) {
  return new Error(message.replace(/^.*ERROR:\s*/i, ''))
}

function parseJson<T>(data: unknown): T {
  return (typeof data === 'string' ? JSON.parse(data) : data) as T
}

export function formatDateOn(value: string | null) {
  if (!value) return '—'
  const dateOnly = new Date(`${value.slice(0, 10)}T00:00:00`)
  if (!Number.isNaN(dateOnly.getTime())) {
    return dateOnly.toLocaleDateString('en-PH', { dateStyle: 'medium' })
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-PH', { dateStyle: 'medium' })
}

export function toDatetimeLocalValue(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function fromDatetimeLocalValue(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error('Enter a valid date and time.')
  }
  return date.toISOString()
}

export async function issueNoticeAndSummon(
  complaintId: number,
  actorUserId: number,
  appearAt: string,
  officerInCharge: string,
) {
  const { error } = await supabase.rpc('issue_notice_and_summon', {
    p_complaint_id: complaintId,
    p_actor_user_id: actorUserId,
    p_appear_at: appearAt,
    p_officer_in_charge: officerInCharge.trim() || null,
  })
  if (error) throw rpcError(error.message)
  await notifyComplaintSms('notice_of_hearing', complaintId)
}

export async function listNoticesOfHearing(query: ListQuery) {
  const { data, error } = await supabase.rpc('list_notices_of_hearing', {
    p_search: query.search,
    p_sort_key: query.sortKey,
    p_sort_dir: query.sortDir,
    p_page: query.page,
    p_page_size: query.pageSize,
  })
  if (error) throw rpcError(error.message)

  const parsed = parseJson<{ rows: HearingListRow[]; total: number }>(data)
  return { rows: parsed?.rows ?? [], total: parsed?.total ?? 0 }
}

export async function getNoticeOfHearing(id: number): Promise<HearingRecord> {
  const { data, error } = await supabase.rpc('get_notice_of_hearing', { p_id: id })
  if (error) throw rpcError(error.message)

  const parsed = parseJson<HearingRecord>(data)
  if (!parsed?.id) throw new Error('Notice of hearing not found')
  return parsed
}

export async function acknowledgeNoticeOfHearing(
  id: number,
  actorUserId: number,
  appearAt: string,
) {
  await updateNoticeOfHearing(id, actorUserId, {
    appear_at: appearAt,
    acknowledged_on: new Date().toISOString(),
  })
}

export async function updateNoticeOfHearing(
  id: number,
  actorUserId: number,
  payload: { appear_at: string; acknowledged_on: string | null },
) {
  const { error } = await supabase.rpc('update_notice_of_hearing', {
    p_id: id,
    p_actor_user_id: actorUserId,
    p_appear_at: payload.appear_at,
    p_acknowledged_on: payload.acknowledged_on,
  })
  if (error) throw rpcError(error.message)
}

export async function listSummons(query: ListQuery) {
  const { data, error } = await supabase.rpc('list_summons', {
    p_search: query.search,
    p_sort_key: query.sortKey,
    p_sort_dir: query.sortDir,
    p_page: query.page,
    p_page_size: query.pageSize,
  })
  if (error) throw rpcError(error.message)

  const parsed = parseJson<{ rows: SummonListRow[]; total: number }>(data)
  return { rows: parsed?.rows ?? [], total: parsed?.total ?? 0 }
}

export async function getSummon(id: number): Promise<SummonRecord> {
  const { data, error } = await supabase.rpc('get_summon', { p_id: id })
  if (error) throw rpcError(error.message)

  const parsed = parseJson<SummonRecord>(data)
  if (!parsed?.id) throw new Error('Summon not found')
  return {
    ...parsed,
    attachments: parsed.attachments ?? [],
  }
}

export async function updateSummon(
  id: number,
  actorUserId: number,
  payload: {
    appear_at: string
    served_on: string | null
    dwelling_recipient: string
    office_recipient: string
    officer_in_charge: string
  },
) {
  const { error } = await supabase.rpc('update_summon', {
    p_id: id,
    p_actor_user_id: actorUserId,
    p_appear_at: payload.appear_at,
    p_served_on: payload.served_on,
    p_dwelling_recipient: payload.dwelling_recipient,
    p_office_recipient: payload.office_recipient,
    p_officer_in_charge: payload.officer_in_charge,
  })
  if (error) throw rpcError(error.message)
}

export async function uploadSummonAttachment(summonId: number, file: File) {
  const safeName = file.name.replace(/[^\w.\-]+/g, '_')
  const path = `${summonId}/${Date.now()}-${safeName}`
  const { error } = await supabase.storage.from('summon-attachments').upload(path, file, {
    upsert: false,
  })
  if (error) throw new Error(error.message)
  return { path, fileName: file.name }
}

export async function addSummonAttachment(
  summonId: number,
  actorUserId: number,
  filePath: string,
  fileName: string,
) {
  const { error } = await supabase.rpc('add_summon_attachment', {
    p_summon_id: summonId,
    p_actor_user_id: actorUserId,
    p_file_path: filePath,
    p_file_name: fileName,
  })
  if (error) throw rpcError(error.message)
}

export async function deleteSummonAttachment(id: number, actorUserId: number) {
  const { data, error } = await supabase.rpc('delete_summon_attachment', {
    p_id: id,
    p_actor_user_id: actorUserId,
  })
  if (error) throw rpcError(error.message)

  const parsed = parseJson<{ file_path?: string }>(data)
  if (parsed?.file_path) {
    await supabase.storage.from('summon-attachments').remove([parsed.file_path])
  }
}

export async function getSummonAttachmentUrl(path: string) {
  const { data, error } = await supabase.storage.from('summon-attachments').createSignedUrl(path, 60 * 10)
  if (error) throw new Error(error.message)
  return data.signedUrl
}
