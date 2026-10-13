import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { Link, Navigate } from 'react-router-dom'
import { useState } from 'react'

import { AuthBrand, AuthShell } from '@/components/auth/auth-shell'
import { Field } from '@/components/auth/field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MobileNumberInput } from '@/components/ui/mobile-number-input'
import { requestPasswordReset } from '@/lib/auth-api'
import { placeholders } from '@/lib/form-fields'
import { homePathForRole } from '@/lib/roles'
import { type ResetPasswordValues, resetPasswordSchema } from '@/schemas/auth'
import { useAuthStore } from '@/stores/auth-store'

export function ResetPasswordPage() {
  const session = useAuthStore((state) => state.session)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      username: '',
      mobile_number: '',
    },
  })

  if (session) {
    return <Navigate to={homePathForRole(session.roleName)} replace />
  }

  async function onSubmit(values: ResetPasswordValues) {
    setSubmitError(null)
    setSuccess(false)

    try {
      await requestPasswordReset(values.username, values.mobile_number)
      setSuccess(true)
      form.reset()
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to reset password.')
    }
  }

  return (
    <AuthShell cardClassName="max-w-[420px]">
      <AuthBrand description="Reset your password" />

      {success ? (
        <p className="text-sm text-[#171717]">
          If your details match our records, a temporary password was sent to your mobile.
        </p>
      ) : (
        <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <Field
            label="Username"
            htmlFor="username"
            required
            error={form.formState.errors.username?.message}
          >
            <Input
              id="username"
              autoComplete="username"
              placeholder={placeholders.username}
              className="h-10 bg-white"
              aria-invalid={Boolean(form.formState.errors.username)}
              {...form.register('username')}
            />
          </Field>

          <Field
            label="Registered mobile number"
            htmlFor="mobile_number"
            required
            error={form.formState.errors.mobile_number?.message}
          >
            <Controller
              control={form.control}
              name="mobile_number"
              render={({ field }) => (
                <MobileNumberInput
                  id="mobile_number"
                  className="h-10 bg-white"
                  aria-invalid={Boolean(form.formState.errors.mobile_number)}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                />
              )}
            />
          </Field>

          {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}

          <Button type="submit" className="h-10 w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Resetting…' : 'Reset password'}
          </Button>
        </form>
      )}

      <p className="mt-5 text-center text-sm text-[#666666]">
        <Link to="/login" className="cursor-pointer font-medium text-brand hover:underline">
          Back to login
        </Link>
      </p>
    </AuthShell>
  )
}
