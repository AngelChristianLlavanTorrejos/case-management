import { supabase } from '@/lib/supabase'

export type DashboardPeriod = 'month' | 'year'

export type DashboardMixPoint = {
  label: string
  value: number
}

export type DashboardMonthPoint = {
  month: string
  filed: number
  settlements: number
}

export type DashboardAttention = {
  case_no: string
  reason: string
  route: string
}

export type DashboardStats = {
  complaints_filed: number
  notice_overdue: number
  summons_unserved: number
  settlements: number
  repudiated: number
  complied: number
  in_execution: number
  settlement_mix: DashboardMixPoint[]
  monthly: DashboardMonthPoint[]
  attention: DashboardAttention[]
}

function rpcError(message: string) {
  return new Error(message.replace(/^.*ERROR:\s*/i, ''))
}

function parseJson<T>(data: unknown): T {
  return (typeof data === 'string' ? JSON.parse(data) : data) as T
}

function count(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

export async function getDashboardStats(period: DashboardPeriod): Promise<DashboardStats> {
  const { data, error } = await supabase.rpc('get_dashboard_stats', { p_period: period })
  if (error) throw rpcError(error.message)

  const parsed = parseJson<Partial<DashboardStats>>(data)
  return {
    complaints_filed: count(parsed?.complaints_filed),
    notice_overdue: count(parsed?.notice_overdue),
    summons_unserved: count(parsed?.summons_unserved),
    settlements: count(parsed?.settlements),
    repudiated: count(parsed?.repudiated),
    complied: count(parsed?.complied),
    in_execution: count(parsed?.in_execution),
    settlement_mix: (parsed?.settlement_mix ?? []).map((point) => ({
      label: point.label,
      value: count(point.value),
    })),
    monthly: (parsed?.monthly ?? []).map((point) => ({
      month: point.month,
      filed: count(point.filed),
      settlements: count(point.settlements),
    })),
    attention: parsed?.attention ?? [],
  }
}
