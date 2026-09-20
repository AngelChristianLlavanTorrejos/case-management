import { LookupMasterPage } from '@/components/data/lookup-master-page'

export function SuffixPage() {
  return (
    <LookupMasterPage
      kind="suffix"
      title="Suffix"
      description="Manage suffix options used in personal information records."
      addLabel="Add suffix"
    />
  )
}
