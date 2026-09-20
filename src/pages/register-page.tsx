import { useQuery } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import { useState, type ChangeEvent } from 'react'
import { Controller, useForm, type FieldPath, type UseFormReturn } from 'react-hook-form'
import { Link, Navigate, useNavigate } from 'react-router-dom'

import { AuthBrand, AuthShell } from '@/components/auth/auth-shell'
import { Field } from '@/components/auth/field'
import { REGISTER_STEPS, WizardProgress } from '@/components/auth/wizard-progress'
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
import { getRegisterLookups, registerUser } from '@/lib/auth-api'
import { maxAdultBirthdate, placeholders } from '@/lib/form-fields'
import { type RegisterValues, registerResolver, registerStepFields } from '@/schemas/auth'
import { useAuthStore } from '@/stores/auth-store'
import type { LookupOption } from '@/types/auth'

const emptyRegisterValues: RegisterValues = {
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

function registerLiveField(
  form: UseFormReturn<RegisterValues>,
  name: FieldPath<RegisterValues>,
  options?: { mask?: (value: string) => string },
) {
  const registration = form.register(name)

  return {
    ...registration,
    async onChange(event: ChangeEvent<HTMLInputElement>) {
      if (options?.mask) {
        event.target.value = options.mask(event.target.value)
      }
      await registration.onChange(event)
      if (form.getFieldState(name).error) {
        await form.trigger(name)
      }
    },
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

export function RegisterPage() {
  const navigate = useNavigate()
  const session = useAuthStore((state) => state.session)
  const [step, setStep] = useState(0)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const lookups = useQuery({
    queryKey: ['register-lookups'],
    queryFn: getRegisterLookups,
  })

  const form = useForm<RegisterValues>({
    resolver: registerResolver,
    defaultValues: emptyRegisterValues,
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  })

  if (session) {
    return <Navigate to="/" replace />
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

  async function goNext() {
    if (step === 2 && form.getValues('same_as_present')) {
      copyPresentToPermanent()
    }

    const valid = await form.trigger([...registerStepFields[step]])
    if (!valid) return

    setSubmitError(null)
    setStep((current) => current + 1)
  }

  async function onSubmit(values: RegisterValues) {
    setSubmitError(null)

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

    try {
      await registerUser({
        ...payload,
        suffix_id: Number(payload.suffix_id),
        sex_id: Number(payload.sex_id),
        civil_status_id: Number(payload.civil_status_id),
      })
      setSubmitted(true)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to create account.')
    }
  }

  const sameAsPresent = form.watch('same_as_present')
  const isLastStep = step === REGISTER_STEPS.length - 1

  if (submitted) {
    return (
      <AuthShell cardClassName="max-w-[420px]">
        <AuthBrand description="Create an account" />
        <div className="flex gap-3">
          <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-[#EEF4EA] text-[#225008]">
            <Check className="size-5" />
          </span>
          <div className="min-w-0 pt-0.5">
            <h2 className="text-lg font-semibold text-[#171717]">Registration submitted</h2>
            <p className="mt-1.5 text-sm leading-5 text-[#666666]">
              Your registration is pending approval. Review usually takes up to 3 working days. You
              will receive an SMS when your account is active. Please wait for that message before
              logging in.
            </p>
          </div>
        </div>
        <Button type="button" className="mt-6 h-10 w-full" onClick={() => navigate('/login', { replace: true })}>
          Go to login
        </Button>
      </AuthShell>
    )
  }

  return (
    <AuthShell cardClassName="max-w-xl">
      <AuthBrand description="Create an account" />
      <WizardProgress currentStep={step} />

      <p className="mb-4 text-sm font-medium text-[#171717] sm:hidden">{REGISTER_STEPS[step]}</p>

      {lookups.isError ? (
        <p className="text-sm text-destructive">
          {lookups.error instanceof Error
            ? lookups.error.message
            : 'Unable to load registration options.'}
        </p>
      ) : null}

      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          if (isLastStep) {
            void form.handleSubmit(onSubmit)(event)
            return
          }
          void goNext()
        }}
        noValidate
      >
        {step === 0 ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="First name"
                htmlFor="first_name"
                required
                error={form.formState.errors.first_name?.message}
              >
                <Input
                  id="first_name"
                  className="h-10 bg-white"
                  placeholder={placeholders.first_name}
                  aria-invalid={Boolean(form.formState.errors.first_name)}
                  {...registerLiveField(form, 'first_name')}
                />
              </Field>
              <Field
                label="Middle name"
                htmlFor="middle_name"
                optional
                error={form.formState.errors.middle_name?.message}
              >
                <Input
                  id="middle_name"
                  className="h-10 bg-white"
                  placeholder={placeholders.middle_name}
                  {...registerLiveField(form, 'middle_name')}
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Last name"
                htmlFor="last_name"
                required
                error={form.formState.errors.last_name?.message}
              >
                <Input
                  id="last_name"
                  className="h-10 bg-white"
                  placeholder={placeholders.last_name}
                  aria-invalid={Boolean(form.formState.errors.last_name)}
                  {...registerLiveField(form, 'last_name')}
                />
              </Field>
              <Controller
                control={form.control}
                name="suffix_id"
                render={({ field, fieldState }) => (
                  <Field label="Suffix" required error={fieldState.error?.message}>
                    <LookupSelect
                      value={field.value}
                      onChange={(value) => {
                        field.onChange(value)
                        void form.trigger(field.name)
                      }}
                      options={lookups.data?.suffixes ?? []}
                      placeholder="Select suffix"
                      invalid={Boolean(fieldState.error)}
                    />
                  </Field>
                )}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Controller
                control={form.control}
                name="sex_id"
                render={({ field, fieldState }) => (
                  <Field label="Sex" required error={fieldState.error?.message}>
                    <LookupSelect
                      value={field.value}
                      onChange={(value) => {
                        field.onChange(value)
                        void form.trigger(field.name)
                      }}
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
                      onChange={(value) => {
                        field.onChange(value)
                        void form.trigger(field.name)
                      }}
                      options={lookups.data?.civilStatuses ?? []}
                      placeholder="Select civil status"
                      invalid={Boolean(fieldState.error)}
                    />
                  </Field>
                )}
              />
            </div>
            <Field
              label="Birthdate"
              htmlFor="birthdate"
              required
              error={form.formState.errors.birthdate?.message}
            >
              <Input
                id="birthdate"
                type="date"
                max={maxAdultBirthdate()}
                className="h-10 bg-white"
                aria-invalid={Boolean(form.formState.errors.birthdate)}
                {...registerLiveField(form, 'birthdate')}
              />
            </Field>
          </>
        ) : null}

        {step === 1 ? (
          <AddressFields prefix="present_address" form={form} />
        ) : null}

        {step === 2 ? (
          <>
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
            <AddressFields prefix="permanent_address" form={form} disabled={sameAsPresent} />
          </>
        ) : null}

        {step === 3 ? (
          <>
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
                    onChange={(digits) => {
                      field.onChange(digits)
                      if (fieldState.error) {
                        void form.trigger('mobile_number')
                      }
                    }}
                  />
                </Field>
              )}
            />
            <Field
              label="Telephone number"
              htmlFor="telephone_number"
              optional
              error={form.formState.errors.telephone_number?.message}
            >
              <Input
                id="telephone_number"
                inputMode="tel"
                placeholder={placeholders.telephone_number}
                className="h-10 bg-white"
                {...registerLiveField(form, 'telephone_number')}
              />
            </Field>
            <Field
              label="Email"
              htmlFor="email"
              required
              error={form.formState.errors.email?.message}
            >
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder={placeholders.email}
                className="h-10 bg-white"
                aria-invalid={Boolean(form.formState.errors.email)}
                {...registerLiveField(form, 'email')}
              />
            </Field>
          </>
        ) : null}

        {step === 4 ? (
          <>
            <Field
              label="Username"
              htmlFor="reg-username"
              required
              error={form.formState.errors.username?.message}
            >
              <Input
                id="reg-username"
                autoComplete="username"
                placeholder={placeholders.username}
                className="h-10 bg-white"
                aria-invalid={Boolean(form.formState.errors.username)}
                {...registerLiveField(form, 'username')}
              />
            </Field>
            <Field
              label="Password"
              htmlFor="reg-password"
              required
              error={form.formState.errors.password?.message}
            >
              <Input
                id="reg-password"
                type="password"
                autoComplete="new-password"
                placeholder={placeholders.password}
                className="h-10 bg-white"
                aria-invalid={Boolean(form.formState.errors.password)}
                {...registerLiveField(form, 'password')}
              />
            </Field>
            <Field
              label="Confirm password"
              htmlFor="confirm_password"
              required
              error={form.formState.errors.confirm_password?.message}
            >
              <Input
                id="confirm_password"
                type="password"
                autoComplete="new-password"
                placeholder={placeholders.confirm_password}
                className="h-10 bg-white"
                aria-invalid={Boolean(form.formState.errors.confirm_password)}
                {...registerLiveField(form, 'confirm_password')}
              />
            </Field>
          </>
        ) : null}

        {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}

        <div className="mt-2 flex gap-3">
          {step > 0 ? (
            <Button
              type="button"
              variant="outline"
              className="h-10 flex-1 bg-white"
              onClick={() => setStep((current) => current - 1)}
            >
              Back
            </Button>
          ) : null}
          <Button type="submit" className="h-10 flex-1" disabled={form.formState.isSubmitting}>
            {isLastStep
              ? form.formState.isSubmitting
                ? 'Submitting…'
                : 'Create Account'
              : 'Next'}
          </Button>
        </div>
      </form>

      <p className="mt-5 text-center text-sm text-[#666666]">
        Already have an account?{' '}
        <Link to="/login" className="cursor-pointer font-medium text-brand hover:underline">
          Login
        </Link>
      </p>
    </AuthShell>
  )
}

function AddressFields({
  prefix,
  form,
  disabled,
}: {
  prefix: 'present_address' | 'permanent_address'
  form: ReturnType<typeof useForm<RegisterValues>>
  disabled?: boolean
}) {
  const fields = [
    ['house_block_lot', 'House / block / lot'],
    ['street', 'Street'],
    ['barangay', 'Barangay'],
    ['municipality_city', 'Municipality / city'],
    ['province', 'Province'],
    ['region', 'Region'],
    ['zip_code', 'ZIP code'],
  ] as const

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.map(([key, label]) => {
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
          <Field
            key={name}
            label={label}
            htmlFor={name}
            required
            error={form.formState.errors[name]?.message}
          >
            <Input
              id={name}
              className="h-10 bg-white"
              disabled={disabled}
              placeholder={placeholders[key]}
              aria-invalid={Boolean(form.formState.errors[name])}
              {...registerLiveField(form, name)}
            />
          </Field>
        )
      })}
    </div>
  )
}
