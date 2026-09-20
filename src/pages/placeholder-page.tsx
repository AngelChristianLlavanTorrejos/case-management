import { PageHeader } from '@/components/layout/page-header'

export function PlaceholderPage({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return <PageHeader title={title} description={description} />
}
