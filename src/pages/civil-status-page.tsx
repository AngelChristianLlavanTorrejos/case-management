import { LookupMasterPage } from '@/components/data/lookup-master-page'

export function CivilStatusPage() {
  return (
    <LookupMasterPage
      kind="civil_status"
      title="Civil Status"
      description="Manage civil status options used in personal information records."
      addLabel="Add civil status"
    />
  )
}
