import type { SecuritySettings } from '@/lib/security-settings-api'

function countPhrase(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`
}

function hasSequential(password: string) {
  if (password.length < 3) return false

  function walk(text: string) {
    for (let index = 0; index < text.length - 2; index += 1) {
      const a = text.charCodeAt(index)
      const b = text.charCodeAt(index + 1)
      const c = text.charCodeAt(index + 2)
      if ((b - a === 1 && c - b === 1) || (a - b === 1 && b - c === 1)) {
        return true
      }
    }
    return false
  }

  return walk(password) || walk(password.toLowerCase())
}

export function checkPassword(
  password: string,
  username: string,
  settings: SecuritySettings | null | undefined,
) {
  if (!settings || !password) return null

  if (settings.is_enable_min_length_password && password.length < settings.min_length_password) {
    return `Password must be at least ${settings.min_length_password} characters.`
  }

  if (settings.is_enable_max_length_password && password.length > settings.max_length_password) {
    return `Password must be ${settings.max_length_password} characters or fewer.`
  }

  const lowercase = (password.match(/[a-z]/g) ?? []).length
  const uppercase = (password.match(/[A-Z]/g) ?? []).length
  const numeric = (password.match(/[0-9]/g) ?? []).length
  const special = (password.match(/[^a-zA-Z0-9]/g) ?? []).length

  if (settings.is_enable_min_lowercase && lowercase < settings.min_lowercase) {
    return `Password must include at least ${countPhrase(settings.min_lowercase, 'lowercase letter', 'lowercase letters')}.`
  }

  if (settings.is_enable_min_uppercase && uppercase < settings.min_uppercase) {
    return `Password must include at least ${countPhrase(settings.min_uppercase, 'uppercase letter', 'uppercase letters')}.`
  }

  if (settings.is_enable_min_numeric && numeric < settings.min_numeric) {
    return `Password must include at least ${countPhrase(settings.min_numeric, 'number', 'numbers')}.`
  }

  if (settings.is_enable_min_special_character && special < settings.min_special_character) {
    return `Password must include at least ${countPhrase(settings.min_special_character, 'special character', 'special characters')}.`
  }

  if (
    settings.is_enable_password_must_not_match_username &&
    username &&
    password.toLowerCase().includes(username.toLowerCase())
  ) {
    return 'Password must not contain your username.'
  }

  if (settings.is_enable_password_must_not_contain_sequential && hasSequential(password)) {
    return 'Password must not contain sequential characters such as abc or 123.'
  }

  if (settings.is_enable_password_must_not_contain_repeated_char && /(.)\1{2}/.test(password)) {
    return 'Password must not repeat the same character 3 times in a row.'
  }

  return null
}
