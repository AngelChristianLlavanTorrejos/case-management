export const placeholders = {
  first_name: 'e.g. Juan',
  middle_name: 'e.g. Reyes',
  last_name: 'e.g. Dela Cruz',
  house_block_lot: 'e.g. Blk 12 Lot 5',
  street: 'e.g. M. Naval St.',
  barangay: 'e.g. Tanza 1',
  municipality_city: 'e.g. Navotas',
  province: 'e.g. Metro Manila',
  region: 'e.g. NCR',
  zip_code: 'e.g. 1485',
  mobile_number: 'e.g. 09171234567',
  telephone_number: 'e.g. 82821111',
  email: 'e.g. juan.delacruz@email.com',
  username: 'Enter username',
  password: 'Enter password',
  confirm_password: 'Confirm password',
  lookup_suffix: 'e.g. Jr.',
  lookup_civil_status: 'e.g. Married',
  search_member: 'e.g. Juan Dela Cruz',
  search_activity: 'e.g. Juan Dela Cruz',
} as const

export function formatStatusLabel(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

export function maskMobileNumber(value: string) {
  const digits = value.replace(/\D/g, '')
  if (!digits) return ''
  if (digits === '0') return '0'
  if (digits.startsWith('09')) return digits.slice(0, 11)
  if (digits.startsWith('9')) return `0${digits}`.slice(0, 11)
  if (digits.startsWith('0')) return `09${digits.slice(1)}`.slice(0, 11)
  return `09${digits}`.slice(0, 11)
}

export function isAtLeast18(value: string) {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return false

  const today = new Date()
  const adultOn = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate())
  return date <= adultOn
}

export function maxAdultBirthdate() {
  const today = new Date()
  const adultOn = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate())
  const month = String(adultOn.getMonth() + 1).padStart(2, '0')
  const day = String(adultOn.getDate()).padStart(2, '0')
  return `${adultOn.getFullYear()}-${month}-${day}`
}
