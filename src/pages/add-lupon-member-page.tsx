import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Controller, useForm, type FieldErrors, type UseFormReturn } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'

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
import { getRegisterLookups, type RegisterPayload } from '@/lib/auth-api'
import { maxAdultBirthdate, placeholders } from '@/lib/form-fields'
import { createLuponMember } from '@/lib/lupon-members-api'
import { listPositions } from '@/lib/positions-api'
import { getSecuritySettings } from '@/lib/security-settings-api'
import { createLuponMemberResolver, type LuponMemberValues } from '@/schemas/auth'
import { useAuthStore } from '@/stores/auth-store'
import type { LookupOption } from '@/types/auth'

type AccountTab = 'personal' | 'address' | 'contact'

const emptyValues: LuponMemberValues = {
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
  username: '',
  password: '',
  confirm_password: '',
  position_id: '',
}

function toPayload(values: LuponMemberValues): RegisterPayload & { position_id: number } {
  const payload = values.same_as_present
    ? {
        ...values,
        permanent_address_house_block_lot: values.present_address_house_block_lot,
        permanent_address_street: values.present_address_street,
        permanent_address_barangay: values.present_address_barangay,
        permanent_address_municipality_city: values.present_address_municipality_city,
        permanent_address_province: values.present_address_province,
        permanent_address_region: values.present_address_region,
        permanent_address_zip_code: values.present_address_zip_code,
      }
    : values

  return {
    ...payload,
    suffix_id: Number(payload.suffix_id),
    sex_id: Number(payload.sex_id),
    civil_status_id: Number(payload.civil_status_id),
    position_id: Number(payload.position_id),
  }
}

function firstInvalidTab(errors: FieldErrors<LuponMemberValues>): AccountTab {
  const personal = [
    'first_name',
    'middle_name',
    'last_name',
    'suffix_id',
    'sex_id',
    'civil_status_id',
    'birthdate',
    'position_id',
    'username',
    'password',
    'confirm_password',
  ] as const
  const contact = ['mobile_number', 'telephone_number', 'email'] as const
  if (personal.some((key) => errors[key])) return 'personal'
  if (contact.some((key) => errors[key])) return 'contact'
  return 'address'
}

export function AddLuponMemberPage() {
  const navigate = useNavigate()
  const actorUserId = useAuthStore((state) => state.session?.id)
  const [tab, setTab] = useState<AccountTab>('personal')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const settingsRef = useRef<Awaited<ReturnType<typeof getSecuritySettings>> | null>(null)

  const lookups = useQuery({
    queryKey: ['register-lookups'],
    queryFn: getRegisterLookups,
  })
  const positionsQuery = useQuery({
    queryKey: ['positions'],
    queryFn: listPositions,
  })
  const settingsQuery = useQuery({
    queryKey: ['security-settings'],
    queryFn: getSecuritySettings,
  })

  useEffect(() => {
    settingsRef.current = settingsQuery.data ?? null
  }, [settingsQuery.data])

  const form = useForm<LuponMemberValues>({
    resolver: (values, context, options) =>
      createLuponMemberResolver(settingsRef.current)(values, context, options),
    defaultValues: emptyValues,
  })

  const sameAsPresent = form.watch('same_as_present')

  function goBack() {
    navigate('/lupon-members')
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
      await createLuponMember(actorUserId, toPayload(form.getValues()))
      toast.success('Lupon member recorded.')
      goBack()
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to save this lupon member.')
    } finally {
      setSaving(false)
    }
  }

  const actions = (
    <div className="flex gap-3">
      <Button type="button" variant="outline" className="cursor-pointer bg-white" onClick={goBack}>
        Cancel
      </Button>
      <Button type="button" className="cursor-pointer" disabled={saving} onClick={() => void handleSave()}>
        {saving ? 'Saving…' : 'Save'}
      </Button>
    </div>
  )

  return (
    <div>
      <PageHeader
        title="Add"
        description="Create a lupon member account. Position sets Super Admin or Admin."
      />

      <Tabs value={tab} onValueChange={(value) => setTab(value as AccountTab)} className="mt-5">
        <TabsList>
          <TabsTrigger value="personal">Personal information</TabsTrigger>
          <TabsTrigger value="address">Address</TabsTrigger>
          <TabsTrigger value="contact">Contact</TabsTrigger>
        </TabsList>

        <TabsContent value="personal">
          <div className="grid max-w-3xl gap-4">
            <Controller
              control={form.control}
              name="position_id"
              render={({ field, fieldState }) => (
                <Field label="Position" required error={fieldState.error?.message}>
                  <LookupSelect
                    value={field.value}
                    onChange={field.onChange}
                    options={positionsQuery.data ?? []}
                    placeholder={positionsQuery.isLoading ? 'Loading positions…' : 'Select position'}
                    invalid={Boolean(fieldState.error)}
                  />
                </Field>
              )}
            />
            <Field label="Username" htmlFor="lupon-username" required error={form.formState.errors.username?.message}>
              <Input
                id="lupon-username"
                autoComplete="username"
                className="h-10 bg-white"
                placeholder={placeholders.username}
                {...form.register('username')}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Password" htmlFor="lupon-password" required error={form.formState.errors.password?.message}>
                <Input
                  id="lupon-password"
                  type="password"
                  autoComplete="new-password"
                  className="h-10 bg-white"
                  placeholder={placeholders.password}
                  {...form.register('password')}
                />
              </Field>
              <Field
                label="Confirm password"
                htmlFor="lupon-confirm-password"
                required
                error={form.formState.errors.confirm_password?.message}
              >
                <Input
                  id="lupon-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  className="h-10 bg-white"
                  placeholder={placeholders.confirm_password}
                  {...form.register('confirm_password')}
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First name" htmlFor="first_name" required error={form.formState.errors.first_name?.message}>
                <Input id="first_name" className="h-10 bg-white" placeholder={placeholders.first_name} {...form.register('first_name')} />
              </Field>
              <Field label="Middle name" htmlFor="middle_name" optional error={form.formState.errors.middle_name?.message}>
                <Input id="middle_name" className="h-10 bg-white" placeholder={placeholders.middle_name} {...form.register('middle_name')} />
              </Field>
              <Field label="Last name" htmlFor="last_name" required error={form.formState.errors.last_name?.message}>
                <Input id="last_name" className="h-10 bg-white" placeholder={placeholders.last_name} {...form.register('last_name')} />
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
                    />
                  </Field>
                )}
              />
              <Field label="Birthdate" htmlFor="birthdate" required error={form.formState.errors.birthdate?.message}>
                <Input id="birthdate" type="date" max={maxAdultBirthdate()} className="h-10 bg-white" {...form.register('birthdate')} />
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
              <AddressFields form={form} prefix="present_address" />
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
                      onCheckedChange={(checked) => {
                        const next = checked === true
                        field.onChange(next)
                        if (next) copyPresentToPermanent()
                      }}
                    />
                    Same as present address
                  </label>
                )}
              />
              <AddressFields form={form} prefix="permanent_address" disabled={sameAsPresent} />
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
                    onChange={field.onChange}
                  />
                </Field>
              )}
            />
            <Field label="Telephone number" htmlFor="telephone_number" optional error={form.formState.errors.telephone_number?.message}>
              <Input id="telephone_number" className="h-10 bg-white" placeholder={placeholders.telephone_number} {...form.register('telephone_number')} />
            </Field>
            <Field label="Email" htmlFor="email" required error={form.formState.errors.email?.message}>
              <Input id="email" type="email" className="h-10 bg-white sm:col-span-2" placeholder={placeholders.email} {...form.register('email')} />
            </Field>
            <div className="sm:col-span-2">
              {submitError && tab === 'contact' ? <p className="mb-3 text-sm text-destructive">{submitError}</p> : null}
              {actions}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function LookupSelect({
  value,
  onChange,
  options,
  placeholder,
  invalid,
}: {
  value: string
  onChange: (value: string) => void
  options: LookupOption[]
  placeholder: string
  invalid?: boolean
}) {
  return (
    <Select value={value || undefined} onValueChange={onChange}>
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
  form: UseFormReturn<LuponMemberValues>
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
            <Input id={name} className="h-10 bg-white" placeholder={placeholder} disabled={disabled} {...form.register(name)} />
          </Field>
        )
      })}
    </div>
  )
}
