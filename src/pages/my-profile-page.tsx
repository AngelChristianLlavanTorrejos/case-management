import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Controller, useForm, type UseFormReturn } from 'react-hook-form'

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
import { useConfirm } from '@/hooks/use-confirm'
import { toast } from '@/hooks/use-toast.tsx'
import { getRegisterLookups } from '@/lib/auth-api'
import { maxAdultBirthdate, placeholders } from '@/lib/form-fields'
import { getOwnProfile, updateOwnProfile, type OwnProfile } from '@/lib/profile-api'
import { communityMemberSchema, type CommunityMemberValues } from '@/schemas/auth'
import { useAuthStore } from '@/stores/auth-store'
import type { LookupOption } from '@/types/auth'

function toDateInput(value: string | null | undefined) {
  return (value ?? '').slice(0, 10)
}

function addressesMatch(profile: OwnProfile) {
  return (
    profile.present_address_house_block_lot === profile.permanent_address_house_block_lot &&
    profile.present_address_street === profile.permanent_address_street &&
    profile.present_address_barangay === profile.permanent_address_barangay &&
    profile.present_address_municipality_city === profile.permanent_address_municipality_city &&
    profile.present_address_province === profile.permanent_address_province &&
    profile.present_address_region === profile.permanent_address_region &&
    profile.present_address_zip_code === profile.permanent_address_zip_code
  )
}

function toFormValues(profile: OwnProfile): CommunityMemberValues {
  return {
    first_name: profile.first_name,
    middle_name: profile.middle_name ?? '',
    last_name: profile.last_name,
    suffix_id: String(profile.suffix_id),
    sex_id: String(profile.sex_id),
    civil_status_id: String(profile.civil_status_id),
    birthdate: toDateInput(profile.birthdate),
    present_address_house_block_lot: profile.present_address_house_block_lot,
    present_address_street: profile.present_address_street,
    present_address_barangay: profile.present_address_barangay,
    present_address_municipality_city: profile.present_address_municipality_city,
    present_address_province: profile.present_address_province,
    present_address_region: profile.present_address_region,
    present_address_zip_code: profile.present_address_zip_code,
    same_as_present: addressesMatch(profile),
    permanent_address_house_block_lot: profile.permanent_address_house_block_lot,
    permanent_address_street: profile.permanent_address_street,
    permanent_address_barangay: profile.permanent_address_barangay,
    permanent_address_municipality_city: profile.permanent_address_municipality_city,
    permanent_address_province: profile.permanent_address_province,
    permanent_address_region: profile.permanent_address_region,
    permanent_address_zip_code: profile.permanent_address_zip_code,
    mobile_number: profile.mobile_number,
    telephone_number: profile.telephone_number ?? '',
    email: profile.email,
  }
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
  form: UseFormReturn<CommunityMemberValues>
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

export function MyProfilePage() {
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const actorUserId = useAuthStore((state) => state.session?.id)

  const profileQuery = useQuery({
    queryKey: ['own-profile', actorUserId],
    queryFn: () => getOwnProfile(actorUserId as number),
    enabled: Boolean(actorUserId),
  })

  const lookups = useQuery({
    queryKey: ['register-lookups'],
    queryFn: getRegisterLookups,
  })

  const form = useForm<CommunityMemberValues>({
    resolver: zodResolver(communityMemberSchema),
    defaultValues: {
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
    },
  })

  useEffect(() => {
    if (profileQuery.data) {
      form.reset(toFormValues(profileQuery.data))
    }
  }, [form, profileQuery.data])

  const sameAsPresent = form.watch('same_as_present')

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

  const saveMutation = useMutation({
    mutationFn: async (values: CommunityMemberValues) => {
      if (!actorUserId) throw new Error('You must be signed in.')
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

      return updateOwnProfile(actorUserId, {
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
      })
    },
    onSuccess: async (next) => {
      form.reset(toFormValues(next))
      await queryClient.invalidateQueries({ queryKey: ['own-profile'] })
      await queryClient.invalidateQueries({ queryKey: ['user-profile'] })
      toast.success('Profile updated.')
    },
    onError: (error) => {
      toast.error('Unable to save profile.', error instanceof Error ? error.message : undefined)
    },
  })

  async function handleSave() {
    const valid = await form.trigger()
    if (!valid) return

    const confirmed = await confirm({
      title: 'Save profile changes?',
      description: 'Your personal, address, and contact details will be updated.',
      confirmLabel: 'Save',
    })
    if (!confirmed) return

    if (form.getValues('same_as_present')) {
      copyPresentToPermanent()
    }

    await saveMutation.mutateAsync(form.getValues())
  }

  const profile = profileQuery.data

  return (
    <div>
      <PageHeader title="My Profile" description="Update your personal, address, and contact information." />

      {profileQuery.isError ? (
        <p className="mt-5 text-sm text-destructive">
          {profileQuery.error instanceof Error ? profileQuery.error.message : 'Unable to load profile.'}
        </p>
      ) : profileQuery.isLoading || !profile ? (
        <p className="mt-5 text-sm text-[#666666]">Loading profile...</p>
      ) : (
        <Tabs defaultValue="personal" className="mt-5">
          <TabsList>
            <TabsTrigger value="personal">Personal information</TabsTrigger>
            <TabsTrigger value="address">Address</TabsTrigger>
            <TabsTrigger value="contact">Contact</TabsTrigger>
          </TabsList>

          <TabsContent value="personal">
            <div className="grid max-w-3xl gap-4">
              <Field label="Username" htmlFor="profile_username">
                <Input id="profile_username" className="h-10 bg-white" value={profile.username} disabled readOnly />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="First name" htmlFor="profile_first_name" required error={form.formState.errors.first_name?.message}>
                  <Input id="profile_first_name" className="h-10 bg-white" placeholder={placeholders.first_name} {...form.register('first_name')} />
                </Field>
                <Field label="Middle name" htmlFor="profile_middle_name" optional error={form.formState.errors.middle_name?.message}>
                  <Input id="profile_middle_name" className="h-10 bg-white" placeholder={placeholders.middle_name} {...form.register('middle_name')} />
                </Field>
                <Field label="Last name" htmlFor="profile_last_name" required error={form.formState.errors.last_name?.message}>
                  <Input id="profile_last_name" className="h-10 bg-white" placeholder={placeholders.last_name} {...form.register('last_name')} />
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
                <Field label="Birthdate" htmlFor="profile_birthdate" required error={form.formState.errors.birthdate?.message}>
                  <Input id="profile_birthdate" type="date" max={maxAdultBirthdate()} className="h-10 bg-white" {...form.register('birthdate')} />
                </Field>
              </div>
              <div>
                <Button type="button" className="cursor-pointer" disabled={saveMutation.isPending} onClick={() => void handleSave()}>
                  Save
                </Button>
              </div>
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
              <div>
                <Button type="button" className="cursor-pointer" disabled={saveMutation.isPending} onClick={() => void handleSave()}>
                  Save
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="contact">
            <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
              <Controller
                control={form.control}
                name="mobile_number"
                render={({ field, fieldState }) => (
                  <Field label="Mobile number" htmlFor="profile_mobile_number" required error={fieldState.error?.message}>
                    <MobileNumberInput
                      id="profile_mobile_number"
                      className="h-10 bg-white"
                      aria-invalid={Boolean(fieldState.error)}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  </Field>
                )}
              />
              <Field label="Telephone number" htmlFor="profile_telephone_number" optional error={form.formState.errors.telephone_number?.message}>
                <Input id="profile_telephone_number" className="h-10 bg-white" placeholder={placeholders.telephone_number} {...form.register('telephone_number')} />
              </Field>
              <Field label="Email" htmlFor="profile_email" required error={form.formState.errors.email?.message}>
                <Input id="profile_email" type="email" className="h-10 bg-white sm:col-span-2" placeholder={placeholders.email} {...form.register('email')} />
              </Field>
              <div className="sm:col-span-2">
                <Button type="button" className="cursor-pointer" disabled={saveMutation.isPending} onClick={() => void handleSave()}>
                  Save
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
