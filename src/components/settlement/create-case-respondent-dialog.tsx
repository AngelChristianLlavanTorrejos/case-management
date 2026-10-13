import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Controller, useForm, type FieldErrors, type UseFormReturn } from 'react-hook-form'

import { Field } from '@/components/auth/field'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import {
  createAndLinkCaseRespondent,
  linkExistingCaseRespondent,
  listLinkableCaseRespondents,
} from '@/lib/amicable-settlement-api'
import { getRegisterLookups, type RegisterPayload } from '@/lib/auth-api'
import { maxAdultBirthdate, placeholders } from '@/lib/form-fields'
import { getSecuritySettings } from '@/lib/security-settings-api'
import { createRegisterResolver, type RegisterValues } from '@/schemas/auth'
import type { LookupOption } from '@/types/auth'

type Mode = 'choose' | 'create' | 'link'
type AccountTab = 'personal' | 'address' | 'contact'

const TAB_ORDER: AccountTab[] = ['personal', 'address', 'contact']

const tabFields: Record<AccountTab, readonly (keyof RegisterValues)[]> = {
  personal: [
    'first_name',
    'middle_name',
    'last_name',
    'suffix_id',
    'sex_id',
    'civil_status_id',
    'birthdate',
    'username',
    'password',
    'confirm_password',
  ],
  address: [
    'present_address_house_block_lot',
    'present_address_street',
    'present_address_barangay',
    'present_address_municipality_city',
    'present_address_province',
    'present_address_region',
    'present_address_zip_code',
    'permanent_address_house_block_lot',
    'permanent_address_street',
    'permanent_address_barangay',
    'permanent_address_municipality_city',
    'permanent_address_province',
    'permanent_address_region',
    'permanent_address_zip_code',
  ],
  contact: ['mobile_number', 'telephone_number', 'email'],
}

const emptyValues: RegisterValues = {
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
}

function toPayload(values: RegisterValues): RegisterPayload {
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
  }
}

function firstInvalidTab(errors: FieldErrors<RegisterValues>): AccountTab {
  if (
    (
      [
        'first_name',
        'middle_name',
        'last_name',
        'suffix_id',
        'sex_id',
        'civil_status_id',
        'birthdate',
        'username',
        'password',
        'confirm_password',
      ] as const
    ).some((key) => errors[key])
  ) {
    return 'personal'
  }
  if ((['mobile_number', 'telephone_number', 'email'] as const).some((key) => errors[key])) {
    return 'contact'
  }
  return 'address'
}

export function CreateCaseRespondentDialog({
  open,
  complaintId,
  caseLabel,
  actorUserId,
  onClose,
  onCreated,
}: {
  open: boolean
  complaintId: number | null
  caseLabel?: string | null
  actorUserId: number | undefined
  onClose: () => void
  onCreated: () => Promise<void>
}) {
  const [mode, setMode] = useState<Mode>('choose')
  const [tab, setTab] = useState<AccountTab>('personal')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState('')
  const settingsRef = useRef<Awaited<ReturnType<typeof getSecuritySettings>> | null>(null)

  const lookups = useQuery({
    queryKey: ['register-lookups'],
    queryFn: getRegisterLookups,
    enabled: open && mode === 'create',
  })
  const settingsQuery = useQuery({
    queryKey: ['security-settings'],
    queryFn: getSecuritySettings,
    enabled: open && mode === 'create',
  })
  const linkableQuery = useQuery({
    queryKey: ['linkable-case-respondents', complaintId, actorUserId],
    queryFn: () => listLinkableCaseRespondents(complaintId!, actorUserId!),
    enabled: open && mode === 'link' && complaintId != null && actorUserId != null,
  })

  useEffect(() => {
    settingsRef.current = settingsQuery.data ?? null
  }, [settingsQuery.data])

  const form = useForm<RegisterValues>({
    resolver: (values, context, options) =>
      createRegisterResolver(settingsRef.current)(values, context, options),
    defaultValues: emptyValues,
  })

  const sameAsPresent = form.watch('same_as_present')
  const linkableAccounts = linkableQuery.data ?? []

  useEffect(() => {
    if (!open) {
      form.reset(emptyValues)
      setMode('choose')
      setTab('personal')
      setSubmitError(null)
      setSaving(false)
      setSelectedUserId('')
    }
  }, [open, form])

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

  async function changeTab(nextTab: AccountTab) {
    const currentIndex = TAB_ORDER.indexOf(tab)
    const nextIndex = TAB_ORDER.indexOf(nextTab)
    if (nextIndex <= currentIndex) {
      setTab(nextTab)
      return
    }

    for (let index = currentIndex; index < nextIndex; index += 1) {
      const step = TAB_ORDER[index]
      if (step === 'address' && form.getValues('same_as_present')) {
        copyPresentToPermanent()
      }

      const valid = await form.trigger([...tabFields[step]])
      if (!valid) {
        setTab(step)
        return
      }
    }

    setSubmitError(null)
    setTab(nextTab)
  }

  async function goNext() {
    const index = TAB_ORDER.indexOf(tab)
    if (index < TAB_ORDER.length - 1) await changeTab(TAB_ORDER[index + 1])
  }

  function goPrevTab() {
    const index = TAB_ORDER.indexOf(tab)
    if (index > 0) setTab(TAB_ORDER[index - 1])
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
    if (!complaintId) {
      setSubmitError('Complaint is required.')
      return
    }

    if (form.getValues('same_as_present')) {
      copyPresentToPermanent()
    }

    setSubmitError(null)
    setSaving(true)
    try {
      await createAndLinkCaseRespondent(complaintId, actorUserId, toPayload(form.getValues()))
      await onCreated()
      toast.success('Respondent account created and linked to this case.')
      onClose()
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : 'Unable to create the respondent account.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleLinkExisting() {
    if (!actorUserId) {
      setSubmitError('You must be signed in.')
      return
    }
    if (!complaintId) {
      setSubmitError('Complaint is required.')
      return
    }
    if (!selectedUserId) {
      setSubmitError('Select an existing account.')
      return
    }

    setSubmitError(null)
    setSaving(true)
    try {
      await linkExistingCaseRespondent(complaintId, actorUserId, Number(selectedUserId))
      await onCreated()
      toast.success('Existing account linked as respondent for this case.')
      onClose()
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : 'Unable to link the respondent account.',
      )
    } finally {
      setSaving(false)
    }
  }

  function goBackToChoose() {
    setSubmitError(null)
    setSaving(false)
    setSelectedUserId('')
    setTab('personal')
    form.reset(emptyValues)
    setMode('choose')
  }

  const actions =
    tab === 'personal' ? (
      <div className="flex gap-3">
        <Button type="button" variant="outline" className="cursor-pointer bg-white" onClick={goBackToChoose}>
          Back
        </Button>
        <Button type="button" className="cursor-pointer" onClick={() => void goNext()}>
          Next
        </Button>
      </div>
    ) : tab === 'address' ? (
      <div className="flex gap-3">
        <Button type="button" variant="outline" className="cursor-pointer bg-white" onClick={goPrevTab}>
          Back
        </Button>
        <Button type="button" className="cursor-pointer" onClick={() => void goNext()}>
          Next
        </Button>
      </div>
    ) : (
      <div className="flex gap-3">
        <Button type="button" variant="outline" className="cursor-pointer bg-white" onClick={goPrevTab}>
          Back
        </Button>
        <Button type="button" className="cursor-pointer" disabled={saving} onClick={() => void handleSave()}>
          {saving ? 'Saving…' : 'Create and link'}
        </Button>
      </div>
    )

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'choose'
              ? 'Respondent account'
              : mode === 'link'
                ? 'Link existing account'
                : 'Create respondent account'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'choose'
              ? `This community-filed case needs a linked respondent User account${caseLabel ? ` for ${caseLabel}` : ''}. Create a new account or link an existing one.`
              : mode === 'link'
                ? `Choose an active community account to link as the respondent${caseLabel ? ` for ${caseLabel}` : ''}.`
                : `Create a new respondent User account${caseLabel ? ` for ${caseLabel}` : ''}.`}
          </DialogDescription>
        </DialogHeader>

        {mode === 'choose' ? (
          <div className="grid gap-3">
            <Button
              type="button"
              className="cursor-pointer"
              onClick={() => {
                setSubmitError(null)
                setMode('create')
              }}
            >
              Create a respondent account
            </Button>
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer bg-white"
              onClick={() => {
                setSubmitError(null)
                setMode('link')
              }}
            >
              Link existing account
            </Button>
            <Button type="button" variant="outline" className="cursor-pointer bg-white" onClick={onClose}>
              Later
            </Button>
          </div>
        ) : null}

        {mode === 'link' ? (
          <div className="grid gap-4">
            <Field
              label="Existing account"
              htmlFor="link-respondent-account"
              required
              error={submitError && !selectedUserId ? submitError : undefined}
            >
              <Select
                value={selectedUserId || undefined}
                onValueChange={(value) => {
                  setSelectedUserId(value)
                  if (submitError) setSubmitError(null)
                }}
              >
                <SelectTrigger id="link-respondent-account" className="h-10 w-full bg-white">
                  <SelectValue
                    placeholder={
                      linkableQuery.isLoading
                        ? 'Loading accounts…'
                        : linkableAccounts.length === 0
                          ? 'No linkable accounts found'
                          : 'Select account'
                    }
                  />
                </SelectTrigger>
                <SelectContent position="popper" align="start" className="w-(--radix-select-trigger-width)">
                  {linkableAccounts.map((account) => (
                    <SelectItem key={account.id} value={String(account.id)}>
                      {account.display_name} ({account.username})
                      {account.mobile_number ? ` · ${account.mobile_number}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {submitError && selectedUserId ? <p className="text-sm text-destructive">{submitError}</p> : null}
            {linkableQuery.isError ? (
              <p className="text-sm text-destructive">
                {linkableQuery.error instanceof Error
                  ? linkableQuery.error.message
                  : 'Unable to load accounts.'}
              </p>
            ) : null}
            <div className="flex gap-3">
              <Button type="button" variant="outline" className="cursor-pointer bg-white" onClick={goBackToChoose}>
                Back
              </Button>
              <Button
                type="button"
                className="cursor-pointer"
                disabled={saving || !selectedUserId}
                onClick={() => void handleLinkExisting()}
              >
                {saving ? 'Linking…' : 'Link account'}
              </Button>
            </div>
          </div>
        ) : null}

        {mode === 'create' ? (
        <Tabs
          value={tab}
          onValueChange={(value) => {
            void changeTab(value as AccountTab)
          }}
        >
          <TabsList>
            <TabsTrigger value="personal">Personal</TabsTrigger>
            <TabsTrigger value="address">Address</TabsTrigger>
            <TabsTrigger value="contact">Contact</TabsTrigger>
          </TabsList>

          <TabsContent value="personal">
            <div className="grid gap-4">
              <Field label="Username" htmlFor="respondent-username" required error={form.formState.errors.username?.message}>
                <Input
                  id="respondent-username"
                  autoComplete="username"
                  className="h-10 bg-white"
                  placeholder={placeholders.username}
                  {...form.register('username')}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Password" htmlFor="respondent-password" required error={form.formState.errors.password?.message}>
                  <Input
                    id="respondent-password"
                    type="password"
                    autoComplete="new-password"
                    className="h-10 bg-white"
                    placeholder={placeholders.password}
                    {...form.register('password')}
                  />
                </Field>
                <Field
                  label="Confirm password"
                  htmlFor="respondent-confirm-password"
                  required
                  error={form.formState.errors.confirm_password?.message}
                >
                  <Input
                    id="respondent-confirm-password"
                    type="password"
                    autoComplete="new-password"
                    className="h-10 bg-white"
                    placeholder={placeholders.confirm_password}
                    {...form.register('confirm_password')}
                  />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="First name" htmlFor="respondent-first-name" required error={form.formState.errors.first_name?.message}>
                  <Input id="respondent-first-name" className="h-10 bg-white" placeholder={placeholders.first_name} {...form.register('first_name')} />
                </Field>
                <Field label="Middle name" htmlFor="respondent-middle-name" optional error={form.formState.errors.middle_name?.message}>
                  <Input id="respondent-middle-name" className="h-10 bg-white" placeholder={placeholders.middle_name} {...form.register('middle_name')} />
                </Field>
                <Field label="Last name" htmlFor="respondent-last-name" required error={form.formState.errors.last_name?.message}>
                  <Input id="respondent-last-name" className="h-10 bg-white" placeholder={placeholders.last_name} {...form.register('last_name')} />
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
                <Field label="Birthdate" htmlFor="respondent-birthdate" required error={form.formState.errors.birthdate?.message}>
                  <Input id="respondent-birthdate" type="date" max={maxAdultBirthdate()} className="h-10 bg-white" {...form.register('birthdate')} />
                </Field>
              </div>
              {submitError && tab === 'personal' ? <p className="text-sm text-destructive">{submitError}</p> : null}
              {actions}
            </div>
          </TabsContent>

          <TabsContent value="address">
            <div className="grid gap-6">
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
            <div className="grid gap-4 sm:grid-cols-2">
              <Controller
                control={form.control}
                name="mobile_number"
                render={({ field, fieldState }) => (
                  <Field label="Mobile number" htmlFor="respondent-mobile" required error={fieldState.error?.message}>
                    <MobileNumberInput
                      id="respondent-mobile"
                      className="h-10 bg-white"
                      aria-invalid={Boolean(fieldState.error)}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  </Field>
                )}
              />
              <Field label="Telephone number" htmlFor="respondent-telephone" optional error={form.formState.errors.telephone_number?.message}>
                <Input id="respondent-telephone" className="h-10 bg-white" placeholder={placeholders.telephone_number} {...form.register('telephone_number')} />
              </Field>
              <Field label="Email" htmlFor="respondent-email" required error={form.formState.errors.email?.message}>
                <Input id="respondent-email" type="email" className="h-10 bg-white sm:col-span-2" placeholder={placeholders.email} {...form.register('email')} />
              </Field>
              <div className="sm:col-span-2">
                {submitError && tab === 'contact' ? <p className="mb-3 text-sm text-destructive">{submitError}</p> : null}
                {actions}
              </div>
            </div>
          </TabsContent>
        </Tabs>
        ) : null}
      </DialogContent>
    </Dialog>
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
  form: UseFormReturn<RegisterValues>
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
