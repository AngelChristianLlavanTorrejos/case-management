import { useQuery } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'

import { Field } from '@/components/auth/field'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useConfirm } from '@/hooks/use-confirm'
import { toast } from '@/hooks/use-toast.tsx'
import { placeholders } from '@/lib/form-fields'
import { changeOwnPassword } from '@/lib/profile-api'
import { getSecuritySettings } from '@/lib/security-settings-api'
import { createChangePasswordResolver, type ChangePasswordValues } from '@/schemas/auth'
import { useAuthStore } from '@/stores/auth-store'

export function ChangePasswordPage() {
  const confirm = useConfirm()
  const session = useAuthStore((state) => state.session)
  const actorUserId = session?.id
  const username = session?.username ?? ''
  const [submitError, setSubmitError] = useState<string | null>(null)

  const settingsQuery = useQuery({
    queryKey: ['security-settings'],
    queryFn: getSecuritySettings,
  })
  const settingsRef = useRef(settingsQuery.data ?? null)
  settingsRef.current = settingsQuery.data ?? null
  const usernameRef = useRef(username)
  usernameRef.current = username

  const form = useForm<ChangePasswordValues>({
    resolver: (values, context, options) =>
      createChangePasswordResolver(settingsRef.current, usernameRef.current)(values, context, options),
    defaultValues: {
      current_password: '',
      new_password: '',
      confirm_password: '',
    },
  })

  async function onSubmit(values: ChangePasswordValues) {
    if (!actorUserId) throw new Error('You must be signed in.')

    const confirmed = await confirm({
      title: 'Change password?',
      description: 'You will use the new password the next time you sign in.',
      confirmLabel: 'Save',
    })
    if (!confirmed) return

    setSubmitError(null)

    try {
      await changeOwnPassword(actorUserId, values.current_password, values.new_password)
      form.reset()
      toast.success('Password updated.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to change password.'
      setSubmitError(message)
      toast.error('Unable to change password.', message)
    }
  }

  return (
    <div>
      <PageHeader title="Change Password" description="Update the password for your account." />

      <form className="mt-5 grid max-w-md gap-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <Field
          label="Current password"
          htmlFor="current_password"
          required
          error={form.formState.errors.current_password?.message}
        >
          <Input
            id="current_password"
            type="password"
            autoComplete="current-password"
            className="h-10 bg-white"
            placeholder={placeholders.current_password}
            {...form.register('current_password')}
          />
        </Field>
        <Field
          label="New password"
          htmlFor="new_password"
          required
          error={form.formState.errors.new_password?.message}
        >
          <Input
            id="new_password"
            type="password"
            autoComplete="new-password"
            className="h-10 bg-white"
            placeholder={placeholders.new_password}
            {...form.register('new_password')}
          />
        </Field>
        <Field
          label="Confirm password"
          htmlFor="confirm_new_password"
          required
          error={form.formState.errors.confirm_password?.message}
        >
          <Input
            id="confirm_new_password"
            type="password"
            autoComplete="new-password"
            className="h-10 bg-white"
            placeholder={placeholders.confirm_password}
            {...form.register('confirm_password')}
          />
        </Field>

        {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}

        <div>
          <Button type="submit" className="cursor-pointer" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>
    </div>
  )
}
