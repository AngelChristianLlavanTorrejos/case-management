import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from '@/hooks/use-toast.tsx'
import { askDashboard } from '@/lib/ai-api'
import { getDashboardStats, type DashboardPeriod, type DashboardStats } from '@/lib/dashboard-api'

const QUESTIONS = [
  'How many complaints were filed this month?',
  'Which cases missed the 3-day notice or summons deadline?',
  'Which summons are still not served?',
  'How many settlements are inside the 10-day repudiation window?',
  'How many were complied vs repudiated vs in execution?',
  'Which settlements can already have a motion for execution?',
  'Which cases are due for a Notice of Execution?',
] as const

const EMPTY_STATS: DashboardStats = {
  complaints_filed: 0,
  notice_overdue: 0,
  summons_unserved: 0,
  settlements: 0,
  repudiated: 0,
  complied: 0,
  in_execution: 0,
  settlement_mix: [],
  monthly: [],
  attention: [],
}

export function HomePage() {
  const navigate = useNavigate()
  const [period, setPeriod] = useState<DashboardPeriod>('month')
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [asking, setAsking] = useState<string | null>(null)

  const statsQuery = useQuery({
    queryKey: ['dashboard-stats', period],
    queryFn: () => getDashboardStats(period),
  })

  useEffect(() => {
    if (statsQuery.isError) {
      toast.error(
        'Unable to load the dashboard.',
        statsQuery.error instanceof Error ? statsQuery.error.message : undefined,
      )
    }
  }, [statsQuery.error, statsQuery.isError])

  const stats = statsQuery.data ?? EMPTY_STATS
  const periodLabel = period === 'year' ? 'This year' : 'This month'

  async function ask(label: string) {
    setQuestion(label)
    setAnswer('')
    setAsking(label)
    try {
      setAnswer(await askDashboard(label, period))
    } catch (error) {
      toast.error('Unable to ask AI.', error instanceof Error ? error.message : undefined)
    } finally {
      setAsking(null)
    }
  }

  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader
          title="Dashboard"
          description="Settled-path counts for complaints, notices, summons, and settlements."
        />
        <div className="flex gap-2">
          <Button
            type="button"
            variant={period === 'month' ? 'default' : 'outline'}
            onClick={() => setPeriod('month')}
          >
            This month
          </Button>
          <Button
            type="button"
            variant={period === 'year' ? 'default' : 'outline'}
            onClick={() => setPeriod('year')}
          >
            This year
          </Button>
        </div>
      </div>

      {statsQuery.isLoading ? <p className="text-sm text-[#666666]">Loading dashboard...</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Complaints filed"
          value={stats.complaints_filed}
          onClick={() => navigate('/complainants-form')}
        />
        <KpiCard
          label="Notice/summons overdue"
          value={stats.notice_overdue}
          onClick={() => navigate('/complainants-form')}
        />
        <KpiCard
          label="Summons not served"
          value={stats.summons_unserved}
          onClick={() => navigate('/summon-for-the-respondent')}
        />
        <KpiCard
          label="Settlements"
          value={stats.settlements}
          onClick={() => navigate('/amicable-settlement')}
        />
        <KpiCard
          label="Repudiated"
          value={stats.repudiated}
          onClick={() => navigate('/repudiation')}
        />
        <KpiCard
          label="Complied"
          value={stats.complied}
          onClick={() => navigate('/amicable-settlement')}
        />
        <KpiCard
          label="In execution"
          value={stats.in_execution}
          onClick={() => navigate('/motion-for-execution')}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-[#E5E5E6] bg-white p-4">
          <h2 className="text-sm font-medium text-[#171717]">Settlement mix</h2>
          <p className="mt-1 text-xs text-[#666666]">{periodLabel}</p>
          <div className="mt-3 h-55">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.settlement_mix} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#E5E5E6" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#666666', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: '#666666', fontSize: 12 }} axisLine={false} tickLine={false} width={32} />
                <Tooltip cursor={{ fill: '#F5F5F5' }} />
                <Bar dataKey="value" fill="#225008" isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-lg border border-[#E5E5E6] bg-white p-4">
          <h2 className="text-sm font-medium text-[#171717]">Filed and settlements</h2>
          <p className="mt-1 text-xs text-[#666666]">This year, by month</p>
          <div className="mt-3 h-55">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#E5E5E6" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: '#666666', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: '#666666', fontSize: 12 }} axisLine={false} tickLine={false} width={32} />
                <Tooltip cursor={{ fill: '#F5F5F5' }} />
                <Bar dataKey="filed" name="Filed" fill="#225008" isAnimationActive={false} />
                <Bar dataKey="settlements" name="Settlements" fill="#6B6B6B" isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <section>
        <h2 className="text-sm font-medium text-[#171717]">Needs attention</h2>
        <div className="mt-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Barangay case no.</TableHead>
                <TableHead>Needs attention</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.attention.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-[#666666]">
                    No items need attention.
                  </TableCell>
                </TableRow>
              ) : (
                stats.attention.map((row) => (
                  <TableRow
                    key={`${row.route}-${row.case_no}-${row.reason}`}
                    className="cursor-pointer"
                    onClick={() => navigate(row.route)}
                  >
                    <TableCell>{row.case_no}</TableCell>
                    <TableCell>{row.reason}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="max-w-3xl">
        <h2 className="text-sm font-medium text-[#171717]">Ask AI</h2>
        <Input
          className="mt-3 h-10 bg-white"
          readOnly
          value={question}
          placeholder="Ask about cases or this dashboard…"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {QUESTIONS.map((label) => (
            <Button
              key={label}
              type="button"
              variant={question === label ? 'default' : 'outline'}
              className="h-auto whitespace-normal py-1.5 text-left"
              disabled={asking !== null}
              onClick={() => void ask(label)}
            >
              {label}
            </Button>
          ))}
        </div>
        {asking ? <p className="mt-3 text-sm text-[#666666]">Asking…</p> : null}
        {answer ? (
          <p className="mt-3 rounded-lg border border-[#E5E5E6] bg-white p-4 text-sm whitespace-pre-wrap text-[#171717]">
            {answer}
          </p>
        ) : null}
      </section>
    </div>
  )
}

function KpiCard({ label, value, onClick }: { label: string; value: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer rounded-lg border border-[#E5E5E6] bg-white p-4 text-left hover:bg-[#F5F5F5]"
    >
      <p className="text-xs text-[#666666]">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-[#171717]">{value}</p>
    </button>
  )
}
