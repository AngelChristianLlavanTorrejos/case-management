import { Skeleton } from '@/components/ui/skeleton'

export function FormPageSkeleton({ fields = 6 }: { fields?: number }) {
  return (
    <div className="mt-5 grid max-w-3xl gap-4">
      {Array.from({ length: fields }, (_, index) => (
        <div key={index} className="grid gap-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
      <div className="flex gap-2 pt-2">
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-9 w-24" />
      </div>
    </div>
  )
}
