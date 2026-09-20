import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useNavigate } from 'react-router-dom'

import { AuthBrand, AuthShell } from '@/components/auth/auth-shell'
import { Field } from '@/components/auth/field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { loginUser } from '@/lib/auth-api'
import { placeholders } from '@/lib/form-fields'
import { type LoginValues, loginSchema } from '@/schemas/auth'
import { useAuthStore } from '@/stores/auth-store'

export function LoginPage() {
  const navigate = useNavigate()
  const session = useAuthStore((state) => state.session)
  const setSession = useAuthStore((state) => state.setSession)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  })

  if (session) {
    return <Navigate to="/" replace />
  }

  async function onSubmit(values: LoginValues) {
    setSubmitError(null)

    try {
      const nextSession = await loginUser(values.username, values.password)
      setSession(nextSession)
      navigate('/', { replace: true })
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to sign in.')
    }
  }

  return (
    <AuthShell cardClassName="max-w-[420px]">
      <AuthBrand description="Sign in to continue" />

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
          label="Password"
          htmlFor="password"
          required
          error={form.formState.errors.password?.message}
        >
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder={placeholders.password}
            className="h-10 bg-white"
            aria-invalid={Boolean(form.formState.errors.password)}
            {...form.register('password')}
          />
        </Field>

        {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}

        <Button type="submit" className="h-10 w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Signing in…' : 'Login'}
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-[#666666]">
        Need an account?{' '}
        <Link to="/register" className="cursor-pointer font-medium text-brand hover:underline">
          Create Account
        </Link>
      </p>
    </AuthShell>
  )
}
