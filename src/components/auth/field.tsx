import type { ReactNode } from 'react'

import { Label } from '@/components/ui/label'

type FieldProps = {
  label: string
  htmlFor?: string
  required?: boolean
  optional?: boolean
  error?: string
  children: ReactNode
}

export function Field({ label, htmlFor, required, optional, error, children }: FieldProps) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={htmlFor} className="text-[#171717]">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
        {optional ? <span className="font-normal text-[#666666]"> (optional)</span> : null}
      </Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
