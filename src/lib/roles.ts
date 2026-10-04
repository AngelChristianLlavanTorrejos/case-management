export function isUserRole(roleName: string | null | undefined) {
  return roleName === 'User'
}

export function isSuperAdmin(roleName: string | null | undefined) {
  return roleName === 'Super Admin'
}

export function canAccessDashboard(roleName: string | null | undefined) {
  return roleName === 'Super Admin' || roleName === 'Admin'
}

export function homePathForRole(roleName: string | null | undefined) {
  return canAccessDashboard(roleName) ? '/' : '/complainants-form'
}
