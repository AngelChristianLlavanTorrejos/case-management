import type { ComponentProps } from 'react'

import { Input } from '@/components/ui/input'
import { maskMobileNumber, placeholders } from '@/lib/form-fields'

export function MobileNumberInput({
  value,
  onChange,
  ...props
}: Omit<ComponentProps<typeof Input>, 'value' | 'onChange' | 'type'> & {
  value: string
  onChange: (digits: string) => void
}) {
  return (
    <Input
      {...props}
      type="tel"
      inputMode="numeric"
      autoComplete="tel"
      maxLength={11}
      placeholder={placeholders.mobile_number}
      value={value}
      onChange={(event) => onChange(maskMobileNumber(event.target.value))}
    />
  )
}
