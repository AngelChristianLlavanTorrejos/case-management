import { z } from 'zod'

import type { SecuritySettings } from '@/lib/security-settings-api'

const AMOUNT_MESSAGE = 'Enter a value of at least 1.'

function amountField() {
  return z.number({ error: AMOUNT_MESSAGE }).int(AMOUNT_MESSAGE).min(0, AMOUNT_MESSAGE)
}

export const securitySettingsSchema = z
  .object({
    is_locked_after_a_certain_login_attempts: z.boolean(),
    allow_login_attempts: amountField(),
    is_logout_after_a_certain_idle_minutes: z.boolean(),
    max_idle_minutes: amountField(),
    is_restrict_user_after_a_certain_inactive_days: z.boolean(),
    max_inactive_days: amountField(),
    is_allow_dual_login: z.boolean(),
    is_enable_min_length_password: z.boolean(),
    min_length_password: amountField(),
    is_enable_max_length_password: z.boolean(),
    max_length_password: amountField(),
    is_enable_min_lowercase: z.boolean(),
    min_lowercase: amountField(),
    is_enable_min_uppercase: z.boolean(),
    min_uppercase: amountField(),
    is_enable_min_numeric: z.boolean(),
    min_numeric: amountField(),
    is_enable_min_special_character: z.boolean(),
    min_special_character: amountField(),
    is_enable_password_must_not_match_username: z.boolean(),
    is_enable_password_must_not_contain_sequential: z.boolean(),
    is_enable_password_must_not_contain_repeated_char: z.boolean(),
  })
  .superRefine((values, ctx) => {
    const requireAmount = (enabled: boolean, value: number, path: keyof SecuritySettings) => {
      if (enabled && value < 1) {
        ctx.addIssue({ code: 'custom', message: AMOUNT_MESSAGE, path: [path] })
      }
    }

    requireAmount(values.is_locked_after_a_certain_login_attempts, values.allow_login_attempts, 'allow_login_attempts')
    requireAmount(values.is_logout_after_a_certain_idle_minutes, values.max_idle_minutes, 'max_idle_minutes')
    requireAmount(
      values.is_restrict_user_after_a_certain_inactive_days,
      values.max_inactive_days,
      'max_inactive_days',
    )
    requireAmount(values.is_enable_min_length_password, values.min_length_password, 'min_length_password')
    requireAmount(values.is_enable_max_length_password, values.max_length_password, 'max_length_password')
    requireAmount(values.is_enable_min_lowercase, values.min_lowercase, 'min_lowercase')
    requireAmount(values.is_enable_min_uppercase, values.min_uppercase, 'min_uppercase')
    requireAmount(values.is_enable_min_numeric, values.min_numeric, 'min_numeric')
    requireAmount(values.is_enable_min_special_character, values.min_special_character, 'min_special_character')

    if (
      values.is_enable_min_length_password &&
      values.is_enable_max_length_password &&
      values.min_length_password > values.max_length_password
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'Minimum password length cannot be greater than maximum password length.',
        path: ['min_length_password'],
      })
    }
  })

export type SecuritySettingsValues = z.infer<typeof securitySettingsSchema>
