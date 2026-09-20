export type AuthSession = {
  id: number
  username: string
  displayName?: string
  roleName: string
  statusName: string
  sessionToken?: string | null
}

export type LookupOption = {
  id: number
  name: string
}

export type RegisterLookups = {
  suffixes: LookupOption[]
  sexes: LookupOption[]
  civilStatuses: LookupOption[]
}
