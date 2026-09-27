import { supabase } from '@/lib/supabase'

export type CfaCaseOption = {
  id: number
  barangay_case_no: string | null
  complainants: string
  respondents: string
}

export type CfaListRow = {
  id: number
  complaint_id: number
  barangay_case_no: string | null
  complainants: string
  respondents: string
  created_at: string
}

export type CfaRecord = {
  id: number
  complaint_id: number
  barangay_case_no: string | null
  complaint_type: string
  complainants: string[]
  respondents: string[]
  created_at: string
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

export async function listCfaCases(): Promise<CfaCaseOption[]> {
  const { data, error } = await supabase.rpc('list_cfa_cases')
  if (error) throw rpcError(error.message)

  const parsed = parseJson<CfaCaseOption[]>(data)
  return parsed ?? []
}

export async function createCertificateToFileAction(
  complaintId: number,
  actorUserId: number,
): Promise<{ id: number }> {
  const { data, error } = await supabase.rpc('create_certificate_to_file_action', {
    p_complaint_id: complaintId,
    p_actor_user_id: actorUserId,
  })
  if (error) throw rpcError(error.message)

  const parsed = parseJson<{ id?: number }>(data)
  if (!parsed?.id) throw new Error('Certificate to file action was not saved.')
  return { id: parsed.id }
}

export async function listCertificatesToFileAction(query: ListQuery) {
  const { data, error } = await supabase.rpc('list_certificates_to_file_action', {
    p_search: query.search,
    p_sort_key: query.sortKey,
    p_sort_dir: query.sortDir,
    p_page: query.page,
    p_page_size: query.pageSize,
  })
  if (error) throw rpcError(error.message)

  const parsed = parseJson<{ rows: CfaListRow[]; total: number }>(data)
  return { rows: parsed?.rows ?? [], total: parsed?.total ?? 0 }
}

export async function getCertificateToFileAction(id: number): Promise<CfaRecord> {
  const { data, error } = await supabase.rpc('get_certificate_to_file_action', { p_id: id })
  if (error) throw rpcError(error.message)

  const parsed = parseJson<CfaRecord>(data)
  if (!parsed?.id) throw new Error('Certificate to file action not found')
  return {
    ...parsed,
    barangay_case_no: parsed.barangay_case_no ?? null,
    complaint_type: parsed.complaint_type ?? '',
    complainants: parsed.complainants ?? [],
    respondents: parsed.respondents ?? [],
  }
}
