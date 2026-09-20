import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import type { Resolver } from 'react-hook-form'

import { isAtLeast18 } from '@/lib/form-fields'
import { checkPassword } from '@/lib/password-policy'
import type { SecuritySettings } from '@/lib/security-settings-api'

const requiredText = (label: string) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)

const birthdateField = requiredText('Birthdate').refine(isAtLeast18, 'You must be at least 18 years old')
const mobileNumberField = requiredText('Mobile number').regex(
  /^09\d{9}$/,
  'Enter an 11-digit mobile number in 09XXXXXXXX format',
)

export const loginSchema = z.object({
  username: requiredText('Username').min(3, 'Username must be at least 3 characters'),
  password: requiredText('Password'),
})

export const registerFieldsSchema = z.object({
  first_name: requiredText('First name'),
  middle_name: z.string().trim(),
  last_name: requiredText('Last name'),
  suffix_id: requiredText('Suffix'),
  sex_id: requiredText('Sex'),
  civil_status_id: requiredText('Civil status'),
  birthdate: birthdateField,
  present_address_house_block_lot: requiredText('House / block / lot'),
  present_address_street: requiredText('Street'),
  present_address_barangay: requiredText('Barangay'),
  present_address_municipality_city: requiredText('Municipality / city'),
  present_address_province: requiredText('Province'),
  present_address_region: requiredText('Region'),
  present_address_zip_code: requiredText('ZIP code'),
  same_as_present: z.boolean(),
  permanent_address_house_block_lot: requiredText('House / block / lot'),
  permanent_address_street: requiredText('Street'),
  permanent_address_barangay: requiredText('Barangay'),
  permanent_address_municipality_city: requiredText('Municipality / city'),
  permanent_address_province: requiredText('Province'),
  permanent_address_region: requiredText('Region'),
  permanent_address_zip_code: requiredText('ZIP code'),
  mobile_number: mobileNumberField,
  telephone_number: z.string().trim(),
  email: z.email('Enter a valid email'),
  username: requiredText('Username').min(3, 'Username must be at least 3 characters'),
  password: requiredText('Password'),
  confirm_password: requiredText('Confirm password'),
})

export const registerSchema = registerFieldsSchema.refine((data) => data.password === data.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
})

export type LoginValues = z.infer<typeof loginSchema>
export type RegisterValues = z.infer<typeof registerSchema>

export const communityMemberSchema = z.object({
  first_name: requiredText('First name'),
  middle_name: z.string().trim(),
  last_name: requiredText('Last name'),
  suffix_id: requiredText('Suffix'),
  sex_id: requiredText('Sex'),
  civil_status_id: requiredText('Civil status'),
  birthdate: birthdateField,
  present_address_house_block_lot: requiredText('House / block / lot'),
  present_address_street: requiredText('Street'),
  present_address_barangay: requiredText('Barangay'),
  present_address_municipality_city: requiredText('Municipality / city'),
  present_address_province: requiredText('Province'),
  present_address_region: requiredText('Region'),
  present_address_zip_code: requiredText('ZIP code'),
  same_as_present: z.boolean(),
  permanent_address_house_block_lot: requiredText('House / block / lot'),
  permanent_address_street: requiredText('Street'),
  permanent_address_barangay: requiredText('Barangay'),
  permanent_address_municipality_city: requiredText('Municipality / city'),
  permanent_address_province: requiredText('Province'),
  permanent_address_region: requiredText('Region'),
  permanent_address_zip_code: requiredText('ZIP code'),
  mobile_number: mobileNumberField,
  telephone_number: z.string().trim(),
  email: z.email('Enter a valid email'),
})

export type CommunityMemberValues = z.infer<typeof communityMemberSchema>

export const registerStepFields = [
  ['first_name', 'middle_name', 'last_name', 'suffix_id', 'sex_id', 'civil_status_id', 'birthdate'],
  [
    'present_address_house_block_lot',
    'present_address_street',
    'present_address_barangay',
    'present_address_municipality_city',
    'present_address_province',
    'present_address_region',
    'present_address_zip_code',
  ],
  [
    'permanent_address_house_block_lot',
    'permanent_address_street',
    'permanent_address_barangay',
    'permanent_address_municipality_city',
    'permanent_address_province',
    'permanent_address_region',
    'permanent_address_zip_code',
  ],
  ['mobile_number', 'telephone_number', 'email'],
  ['username', 'password', 'confirm_password'],
] as const

export function parseRegisterStep(step: number, values: RegisterValues) {
  const fields = registerStepFields[step]
  const pick = Object.fromEntries(fields.map((field) => [field, true])) as Record<
    (typeof fields)[number],
    true
  >

  return registerFieldsSchema.pick(pick).safeParse(values)
}

export function createRegisterResolver(policy: SecuritySettings | null): Resolver<RegisterValues> {
  return async (values, context, options) => {
    const names = options.names as (keyof RegisterValues)[] | undefined

    const applyPolicy = (result: Awaited<ReturnType<Resolver<RegisterValues>>>) => {
      const message = checkPassword(values.password, values.username, policy)
      if (!message) return result
      if (names?.length && !names.includes('password')) return result
      return {
        ...result,
        errors: {
          ...result.errors,
          password: {
            type: 'custom',
            message,
          },
        },
        values: result.errors && Object.keys(result.errors).length ? result.values : result.values,
      }
    }

    if (!names?.length) {
      const result = await zodResolver(registerSchema)(values, context, options)
      return applyPolicy(result)
    }

    const pick = Object.fromEntries(names.map((name) => [name, true]))
    const checkPasswords = names.includes('password') || names.includes('confirm_password')
    const schema = checkPasswords
      ? registerFieldsSchema
          .pick({
            password: true,
            confirm_password: true,
            username: true,
            ...pick,
          } as { password: true; confirm_password: true; username: true })
          .refine(
            (data) => !data.password || !data.confirm_password || data.password === data.confirm_password,
            { message: 'Passwords do not match', path: ['confirm_password'] },
          )
      : registerFieldsSchema.pick(pick as Record<(typeof names)[number], true>)

    const result = await (zodResolver(schema) as unknown as Resolver<RegisterValues>)(values, context, options)
    return applyPolicy(result)
  }
}

export const registerResolver = createRegisterResolver(null)
