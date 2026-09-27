import type { ReactNode } from 'react'

import { Label } from '@/components/ui/label'

type FieldProps = {
  label: string
  htmlFor?: string
  required?: boolean
  optional?: boolean
  error?: string
  action?: ReactNode
  children: ReactNode
}

export function Field({ label, htmlFor, required, optional, error, action, children }: FieldProps) {
  const labelNode = (
    <Label htmlFor={htmlFor} className={action ? 'min-w-0 flex-1 text-[#171717]' : 'text-[#171717]'}>
      {label}
      {required ? <span className="text-destructive"> *</span> : null}
      {optional ? <span className="font-normal text-[#666666]"> (optional)</span> : null}
    </Label>
  )

  return (
    <div className="grid gap-1.5">
      {action ? (
        <div className="flex items-center justify-between gap-3">
          {labelNode}
          {action}
        </div>
      ) : (
        labelNode
      )}
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
