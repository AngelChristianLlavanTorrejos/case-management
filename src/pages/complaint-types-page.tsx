import { LookupMasterPage } from '@/components/data/lookup-master-page'

export function ComplaintTypesPage() {
  return (
    <LookupMasterPage
      kind="complaint_type"
      title="Complaint Types"
      description="Manage complaint type options used in complainant’s forms."
      addLabel="Add complaint type"
    />
  )
}
