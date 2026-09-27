import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Controller, useForm, type FieldErrors, type UseFormReturn } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router-dom'

import { Field } from '@/components/auth/field'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { MobileNumberInput } from '@/components/ui/mobile-number-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from '@/hooks/use-toast.tsx'
import { getRegisterLookups } from '@/lib/auth-api'
import {
  getCommunityMember,
  updateCommunityMember,
  type CommunityMember,
} from '@/lib/community-members-api'
import { formatStatusLabel, maxAdultBirthdate, placeholders } from '@/lib/form-fields'
import { getLuponMember, updateLuponMember, type LuponMember } from '@/lib/lupon-members-api'
import { listPositions } from '@/lib/positions-api'
import { getTechnicalSupport, updateTechnicalSupport, type TechnicalSupport } from '@/lib/technical-support-api'
import { luponMemberEditSchema, type LuponMemberEditValues } from '@/schemas/auth'
import { useAuthStore } from '@/stores/auth-store'
import type { LookupOption } from '@/types/auth'

export type StaffAccountKind = 'community' | 'lupon' | 'technical'
export type StaffAccountMode = 'view' | 'edit'
type AccountTab = 'personal' | 'address' | 'contact'

type StaffProfile = (CommunityMember | LuponMember | TechnicalSupport) & {
  role_name?: string
  position_id?: number | null
  position_name?: string | null
}

const kindConfig: Record<
  StaffAccountKind,
  {
    listPath: string
    queryKey: string
    noun: string
    getFn: (id: number) => Promise<StaffProfile>
    showPosition: boolean
    showRole: boolean
  }
> = {
  community: {
    listPath: '/community-members',
    queryKey: 'community-member',
    noun: 'resident',
    getFn: getCommunityMember,
    showPosition: false,
    showRole: false,
  },
  lupon: {
    listPath: '/lupon-members',
    queryKey: 'lupon-member',
    noun: 'lupon member',
    getFn: getLuponMember,
    showPosition: true,
    showRole: true,
  },
  technical: {
    listPath: '/technical-support',
    queryKey: 'technical-support-account',
    noun: 'technical support',
    getFn: getTechnicalSupport,
    showPosition: false,
    showRole: true,
  },
}

const emptyValues: LuponMemberEditValues = {
  first_name: '',
  middle_name: '',
  last_name: '',
  suffix_id: '',
  sex_id: '',
  civil_status_id: '',
  birthdate: '',
  present_address_house_block_lot: '',
  present_address_street: '',
  present_address_barangay: '',
  present_address_municipality_city: '',
  present_address_province: '',
  present_address_region: '',
  present_address_zip_code: '',
  same_as_present: false,
  permanent_address_house_block_lot: '',
  permanent_address_street: '',
  permanent_address_barangay: '',
  permanent_address_municipality_city: '',
  permanent_address_province: '',
  permanent_address_region: '',
  permanent_address_zip_code: '',
  mobile_number: '',
  telephone_number: '',
  email: '',
  position_id: '-',
}

function toDateInput(value: string | null | undefined) {
  return (value ?? '').slice(0, 10)
}

function addressesMatch(member: StaffProfile) {
  return (
    member.present_address_house_block_lot === member.permanent_address_house_block_lot &&
    member.present_address_street === member.permanent_address_street &&
    member.present_address_barangay === member.permanent_address_barangay &&
    member.present_address_municipality_city === member.permanent_address_municipality_city &&
    member.present_address_province === member.permanent_address_province &&
    member.present_address_region === member.permanent_address_region &&
    member.present_address_zip_code === member.permanent_address_zip_code
  )
}

function toFormValues(member: StaffProfile): LuponMemberEditValues {
  return {
    first_name: member.first_name,
    middle_name: member.middle_name ?? '',
    last_name: member.last_name,
    suffix_id: String(member.suffix_id),
    sex_id: String(member.sex_id),
    civil_status_id: String(member.civil_status_id),
    birthdate: toDateInput(member.birthdate),
    present_address_house_block_lot: member.present_address_house_block_lot,
    present_address_street: member.present_address_street,
    present_address_barangay: member.present_address_barangay,
    present_address_municipality_city: member.present_address_municipality_city,
    present_address_province: member.present_address_province,
    present_address_region: member.present_address_region,
    present_address_zip_code: member.present_address_zip_code,
    same_as_present: addressesMatch(member),
    permanent_address_house_block_lot: member.permanent_address_house_block_lot,
    permanent_address_street: member.permanent_address_street,
    permanent_address_barangay: member.permanent_address_barangay,
    permanent_address_municipality_city: member.permanent_address_municipality_city,
    permanent_address_province: member.permanent_address_province,
    permanent_address_region: member.permanent_address_region,
    permanent_address_zip_code: member.permanent_address_zip_code,
    mobile_number: member.mobile_number,
    telephone_number: member.telephone_number ?? '',
    email: member.email,
    position_id: member.position_id ? String(member.position_id) : '-',
  }
}

function profilePayload(values: LuponMemberEditValues) {
  const permanent = values.same_as_present
    ? {
        permanent_address_house_block_lot: values.present_address_house_block_lot,
        permanent_address_street: values.present_address_street,
        permanent_address_barangay: values.present_address_barangay,
        permanent_address_municipality_city: values.present_address_municipality_city,
        permanent_address_province: values.present_address_province,
        permanent_address_region: values.present_address_region,
        permanent_address_zip_code: values.present_address_zip_code,
      }
    : {
        permanent_address_house_block_lot: values.permanent_address_house_block_lot,
        permanent_address_street: values.permanent_address_street,
        permanent_address_barangay: values.permanent_address_barangay,
        permanent_address_municipality_city: values.permanent_address_municipality_city,
        permanent_address_province: values.permanent_address_province,
        permanent_address_region: values.permanent_address_region,
        permanent_address_zip_code: values.permanent_address_zip_code,
      }

  return {
    first_name: values.first_name,
    middle_name: values.middle_name,
    last_name: values.last_name,
    suffix_id: Number(values.suffix_id),
    sex_id: Number(values.sex_id),
    civil_status_id: Number(values.civil_status_id),
    birthdate: values.birthdate,
    present_address_house_block_lot: values.present_address_house_block_lot,
    present_address_street: values.present_address_street,
    present_address_barangay: values.present_address_barangay,
    present_address_municipality_city: values.present_address_municipality_city,
    present_address_province: values.present_address_province,
    present_address_region: values.present_address_region,
    present_address_zip_code: values.present_address_zip_code,
    ...permanent,
    mobile_number: values.mobile_number,
    telephone_number: values.telephone_number,
    email: values.email,
  }
}

function firstInvalidTab(errors: FieldErrors<LuponMemberEditValues>): AccountTab {
  const personal = ['first_name', 'middle_name', 'last_name', 'suffix_id', 'sex_id', 'civil_status_id', 'birthdate', 'position_id'] as const
  const contact = ['mobile_number', 'telephone_number', 'email'] as const
  if (personal.some((key) => errors[key])) return 'personal'
  if (contact.some((key) => errors[key])) return 'contact'
  return 'address'
}

export function StaffAccountRecordPage({
  kind,
  mode,
}: {
  kind: StaffAccountKind
  mode: StaffAccountMode
}) {
  const navigate = useNavigate()
  const { id } = useParams()
  const actorUserId = useAuthStore((state) => state.session?.id)
  const config = kindConfig[kind]
  const memberId = Number(id)
  const readOnly = mode === 'view'
  const [tab, setTab] = useState<AccountTab>('personal')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const memberQuery = useQuery({
    queryKey: [config.queryKey, memberId],
    queryFn: () => config.getFn(memberId),
    enabled: Number.isFinite(memberId) && memberId > 0,
  })
  const lookups = useQuery({
    queryKey: ['register-lookups'],
    queryFn: getRegisterLookups,
  })
  const positionsQuery = useQuery({
    queryKey: ['positions'],
    queryFn: listPositions,
    enabled: config.showPosition,
  })

  const form = useForm<LuponMemberEditValues>({
    resolver: zodResolver(luponMemberEditSchema),
    defaultValues: emptyValues,
  })

  useEffect(() => {
    if (memberQuery.data) {
      form.reset(toFormValues(memberQuery.data))
      setSubmitError(null)
    }
  }, [form, memberQuery.data])

  const sameAsPresent = form.watch('same_as_present')
  const profile = memberQuery.data

  function goBack() {
    navigate(config.listPath)
  }

  function copyPresentToPermanent() {
    const values = form.getValues()
    form.setValue('permanent_address_house_block_lot', values.present_address_house_block_lot)
    form.setValue('permanent_address_street', values.present_address_street)
    form.setValue('permanent_address_barangay', values.present_address_barangay)
    form.setValue('permanent_address_municipality_city', values.present_address_municipality_city)
    form.setValue('permanent_address_province', values.present_address_province)
    form.setValue('permanent_address_region', values.present_address_region)
    form.setValue('permanent_address_zip_code', values.present_address_zip_code)
  }

  async function handleSave() {
    const valid = await form.trigger()
    if (!valid) {
      setTab(firstInvalidTab(form.formState.errors))
      return
    }
    if (!actorUserId) {
      setSubmitError('You must be signed in.')
      return
    }

    if (form.getValues('same_as_present')) {
      copyPresentToPermanent()
    }

    setSubmitError(null)
    setSaving(true)
    try {
      const values = form.getValues()
      const payload = profilePayload(values)
      if (kind === 'lupon') {
        await updateLuponMember(memberId, { ...payload, position_id: Number(values.position_id) }, actorUserId)
      } else if (kind === 'technical') {
        await updateTechnicalSupport(memberId, payload, actorUserId)
      } else {
        await updateCommunityMember(memberId, payload, actorUserId)
      }
      toast.success(`${config.noun.charAt(0).toUpperCase()}${config.noun.slice(1)} updated.`)
      goBack()
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : `Unable to save this ${config.noun}.`)
    } finally {
      setSaving(false)
    }
  }

  const title = mode === 'view' ? 'View' : 'Edit'
  const description =
    mode === 'view'
      ? `Read-only profile for this ${config.noun}.`
      : `Update the profile for this ${config.noun}.`

  const actions = (
    <TabActions
      readOnly={readOnly}
      saving={saving}
      onBack={goBack}
      onSave={() => void handleSave()}
    />
  )

  return (
    <div>
      <PageHeader title={title} description={description} />

      {!Number.isFinite(memberId) || memberId <= 0 ? (
        <p className="mt-5 text-sm text-destructive">Record not found.</p>
      ) : memberQuery.isError ? (
        <p className="mt-5 text-sm text-destructive">
          {memberQuery.error instanceof Error ? memberQuery.error.message : 'Unable to load profile.'}
        </p>
      ) : memberQuery.isLoading || !profile ? (
        <p className="mt-5 text-sm text-[#666666]">Loading profile...</p>
      ) : (
        <Tabs value={tab} onValueChange={(value) => setTab(value as AccountTab)} className="mt-5">
          <TabsList>
            <TabsTrigger value="personal">Personal information</TabsTrigger>
            <TabsTrigger value="address">Address</TabsTrigger>
            <TabsTrigger value="contact">Contact</TabsTrigger>
          </TabsList>

          <TabsContent value="personal">
            <div className="grid max-w-3xl gap-4">
              <Field label="Username" htmlFor="account-username">
                <Input id="account-username" className="h-10 bg-white" value={profile.username} disabled readOnly />
              </Field>
              {config.showPosition ? (
                <Controller
                  control={form.control}
                  name="position_id"
                  render={({ field, fieldState }) => (
                    <Field label="Position" required error={fieldState.error?.message}>
                      <LookupSelect
                        value={field.value === '-' ? '' : field.value}
                        onChange={field.onChange}
                        options={positionsQuery.data ?? []}
                        placeholder={positionsQuery.isLoading ? 'Loading positions…' : 'Select position'}
                        invalid={Boolean(fieldState.error)}
                        disabled={readOnly}
                      />
                    </Field>
                  )}
                />
              ) : null}
              {config.showRole && 'role_name' in profile ? (
                <Field label="Role" htmlFor="account-role">
                  <Input id="account-role" className="h-10 bg-white" value={profile.role_name ?? ''} disabled readOnly />
                </Field>
              ) : null}
              <Field label="Status" htmlFor="account-status">
                <Input
                  id="account-status"
                  className="h-10 bg-white"
                  value={formatStatusLabel(profile.status_name)}
                  disabled
                  readOnly
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="First name" htmlFor="first_name" required error={form.formState.errors.first_name?.message}>
                  <Input
                    id="first_name"
                    className="h-10 bg-white"
                    placeholder={placeholders.first_name}
                    disabled={readOnly}
                    {...form.register('first_name')}
                  />
                </Field>
                <Field label="Middle name" htmlFor="middle_name" optional error={form.formState.errors.middle_name?.message}>
                  <Input
                    id="middle_name"
                    className="h-10 bg-white"
                    placeholder={placeholders.middle_name}
                    disabled={readOnly}
                    {...form.register('middle_name')}
                  />
                </Field>
                <Field label="Last name" htmlFor="last_name" required error={form.formState.errors.last_name?.message}>
                  <Input
                    id="last_name"
                    className="h-10 bg-white"
                    placeholder={placeholders.last_name}
                    disabled={readOnly}
                    {...form.register('last_name')}
                  />
                </Field>
                <Controller
                  control={form.control}
                  name="suffix_id"
                  render={({ field, fieldState }) => (
                    <Field label="Suffix" required error={fieldState.error?.message}>
                      <LookupSelect
                        value={field.value}
                        onChange={field.onChange}
                        options={lookups.data?.suffixes ?? []}
                        placeholder="Select suffix"
                        invalid={Boolean(fieldState.error)}
                        disabled={readOnly}
                      />
                    </Field>
                  )}
                />
                <Controller
                  control={form.control}
                  name="sex_id"
                  render={({ field, fieldState }) => (
                    <Field label="Sex" required error={fieldState.error?.message}>
                      <LookupSelect
                        value={field.value}
                        onChange={field.onChange}
                        options={lookups.data?.sexes ?? []}
                        placeholder="Select sex"
                        invalid={Boolean(fieldState.error)}
                        disabled={readOnly}
                      />
                    </Field>
                  )}
                />
                <Controller
                  control={form.control}
                  name="civil_status_id"
                  render={({ field, fieldState }) => (
                    <Field label="Civil status" required error={fieldState.error?.message}>
                      <LookupSelect
                        value={field.value}
                        onChange={field.onChange}
                        options={lookups.data?.civilStatuses ?? []}
                        placeholder="Select civil status"
                        invalid={Boolean(fieldState.error)}
                        disabled={readOnly}
                      />
                    </Field>
                  )}
                />
                <Field label="Birthdate" htmlFor="birthdate" required error={form.formState.errors.birthdate?.message}>
                  <Input
                    id="birthdate"
                    type="date"
                    max={maxAdultBirthdate()}
                    className="h-10 bg-white"
                    disabled={readOnly}
                    {...form.register('birthdate')}
                  />
                </Field>
              </div>
              {submitError && tab === 'personal' ? <p className="text-sm text-destructive">{submitError}</p> : null}
              {actions}
            </div>
          </TabsContent>

          <TabsContent value="address">
            <div className="grid max-w-3xl gap-6">
              <section className="grid gap-4">
                <h2 className="text-sm font-medium text-[#171717]">Present address</h2>
                <AddressFields form={form} prefix="present_address" disabled={readOnly} />
              </section>
              <section className="grid gap-4">
                <h2 className="text-sm font-medium text-[#171717]">Permanent address</h2>
                <Controller
                  control={form.control}
                  name="same_as_present"
                  render={({ field }) => (
                    <label className="flex items-center gap-2 text-sm text-[#171717]">
                      <Checkbox
                        checked={field.value}
                        disabled={readOnly}
                        onCheckedChange={(checked) => {
                          if (readOnly) return
                          const next = checked === true
                          field.onChange(next)
                          if (next) copyPresentToPermanent()
                        }}
                      />
                      Same as present address
                    </label>
                  )}
                />
                <AddressFields form={form} prefix="permanent_address" disabled={readOnly || sameAsPresent} />
              </section>
              {submitError && tab === 'address' ? <p className="text-sm text-destructive">{submitError}</p> : null}
              {actions}
            </div>
          </TabsContent>

          <TabsContent value="contact">
            <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
              <Controller
                control={form.control}
                name="mobile_number"
                render={({ field, fieldState }) => (
                  <Field label="Mobile number" htmlFor="mobile_number" required error={fieldState.error?.message}>
                    <MobileNumberInput
                      id="mobile_number"
                      className="h-10 bg-white"
                      aria-invalid={Boolean(fieldState.error)}
                      value={field.value}
                      disabled={readOnly}
                      onChange={field.onChange}
                    />
                  </Field>
                )}
              />
              <Field label="Telephone number" htmlFor="telephone_number" optional error={form.formState.errors.telephone_number?.message}>
                <Input
                  id="telephone_number"
                  className="h-10 bg-white"
                  placeholder={placeholders.telephone_number}
                  disabled={readOnly}
                  {...form.register('telephone_number')}
                />
              </Field>
              <Field label="Email" htmlFor="email" required error={form.formState.errors.email?.message}>
                <Input
                  id="email"
                  type="email"
                  className="h-10 bg-white sm:col-span-2"
                  placeholder={placeholders.email}
                  disabled={readOnly}
                  {...form.register('email')}
                />
              </Field>
              <div className="sm:col-span-2">
                {submitError && tab === 'contact' ? <p className="mb-3 text-sm text-destructive">{submitError}</p> : null}
                {actions}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

function TabActions({
  readOnly,
  saving,
  onBack,
  onSave,
}: {
  readOnly: boolean
  saving: boolean
  onBack: () => void
  onSave: () => void
}) {
  if (readOnly) {
    return (
      <div>
        <Button type="button" variant="outline" className="cursor-pointer bg-white" onClick={onBack}>
          Back
        </Button>
      </div>
    )
  }

  return (
    <div className="flex gap-3">
      <Button type="button" variant="outline" className="cursor-pointer bg-white" onClick={onBack}>
        Cancel
      </Button>
      <Button type="button" className="cursor-pointer" disabled={saving} onClick={onSave}>
        {saving ? 'Saving…' : 'Save'}
      </Button>
    </div>
  )
}

function LookupSelect({
  value,
  onChange,
  options,
  placeholder,
  invalid,
  disabled,
}: {
  value: string
  onChange: (value: string) => void
  options: LookupOption[]
  placeholder: string
  invalid?: boolean
  disabled?: boolean
}) {
  return (
    <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="h-10 w-full bg-white" aria-invalid={invalid}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent position="popper" align="start" className="w-(--radix-select-trigger-width)">
        {options.map((option) => (
          <SelectItem key={option.id} value={String(option.id)}>
            {option.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function AddressFields({
  prefix,
  form,
  disabled,
}: {
  prefix: 'present_address' | 'permanent_address'
  form: UseFormReturn<LuponMemberEditValues>
  disabled?: boolean
}) {
  const fields = [
    ['house_block_lot', 'House / block / lot', placeholders.house_block_lot],
    ['street', 'Street', placeholders.street],
    ['barangay', 'Barangay', placeholders.barangay],
    ['municipality_city', 'Municipality / city', placeholders.municipality_city],
    ['province', 'Province', placeholders.province],
    ['region', 'Region', placeholders.region],
    ['zip_code', 'ZIP code', placeholders.zip_code],
  ] as const

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.map(([key, label, placeholder]) => {
        const name = `${prefix}_${key}` as
          | 'present_address_house_block_lot'
          | 'present_address_street'
          | 'present_address_barangay'
          | 'present_address_municipality_city'
          | 'present_address_province'
          | 'present_address_region'
          | 'present_address_zip_code'
          | 'permanent_address_house_block_lot'
          | 'permanent_address_street'
          | 'permanent_address_barangay'
          | 'permanent_address_municipality_city'
          | 'permanent_address_province'
          | 'permanent_address_region'
          | 'permanent_address_zip_code'

        return (
          <Field key={name} label={label} htmlFor={name} required error={form.formState.errors[name]?.message}>
            <Input
              id={name}
              className="h-10 bg-white"
              placeholder={placeholder}
              disabled={disabled}
              {...form.register(name)}
            />
          </Field>
        )
      })}
    </div>
  )
}
