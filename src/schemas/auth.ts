import { z } from 'zod'

const requiredText = (label: string) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)

export const loginSchema = z.object({
  username: requiredText('Username').min(3, 'Username must be at least 3 characters'),
  password: requiredText('Password'),
})

export const registerSchema = z
  .object({
    first_name: requiredText('First name'),
    middle_name: z.string().trim(),
    last_name: requiredText('Last name'),
    suffix_id: requiredText('Suffix'),
    sex_id: requiredText('Sex'),
    civil_status_id: requiredText('Civil status'),
    birthdate: requiredText('Birthdate').refine((value) => {
      const date = new Date(value)
      return !Number.isNaN(date.getTime()) && date < new Date()
    }, 'Enter a valid birthdate'),
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
    mobile_number: requiredText('Mobile number'),
    telephone_number: z.string().trim(),
    email: z.email('Enter a valid email'),
    username: requiredText('Username').min(3, 'Username must be at least 3 characters'),
    password: requiredText('Password').min(8, 'Password must be at least 8 characters'),
    confirm_password: requiredText('Confirm password'),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  })

export type LoginValues = z.infer<typeof loginSchema>
export type RegisterValues = z.infer<typeof registerSchema>

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
