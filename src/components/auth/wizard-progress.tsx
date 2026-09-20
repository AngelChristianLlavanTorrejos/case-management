import { cn } from '@/lib/utils'

export const REGISTER_STEPS = [
  'Personal Information',
  'Present Address',
  'Permanent Address',
  'Contact Information',
  'Account Information',
] as const

export function WizardProgress({ currentStep }: { currentStep: number }) {
  return (
    <ol className="mb-6 grid grid-cols-5 gap-1" aria-label="Registration progress">
      {REGISTER_STEPS.map((label, index) => {
        const isCurrent = index === currentStep
        const isComplete = index < currentStep

        return (
          <li key={label} className="flex flex-col items-center gap-1.5 text-center">
            <span
              className={cn(
                'flex size-7 items-center justify-center rounded-full border text-xs font-medium',
                isCurrent || isComplete
                  ? 'border-brand bg-brand text-white'
                  : 'border-[#E5E5E5] bg-[#F5F5F5] text-[#666666]',
              )}
              aria-current={isCurrent ? 'step' : undefined}
            >
              {index + 1}
            </span>
            <span
              className={cn(
                'hidden text-[10px] leading-tight sm:block',
                isCurrent ? 'font-medium text-[#171717]' : 'text-[#666666]',
              )}
            >
              {label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
