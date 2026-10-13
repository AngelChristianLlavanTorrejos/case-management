import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'

import { Field } from '@/components/auth/field'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PasswordInput } from '@/components/ui/password-input'
import { toast } from '@/hooks/use-toast.tsx'
import {
  superAdminSetMemberPassword,
  type AdminPasswordMemberScope,
} from '@/lib/admin-reset-password-api'
import { getCommunityMember } from '@/lib/community-members-api'
import { placeholders } from '@/lib/form-fields'
import { getSecuritySettings } from '@/lib/security-settings-api'
import {
  type AdminSetPasswordValues,
  createAdminSetPasswordResolver,
} from '@/schemas/auth'

type AdminResetPasswordDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  targetUserId: number | null
  targetDisplayName: string
  targetUsername?: string
  scope: AdminPasswordMemberScope
  actorUserId: number | undefined
}

export function AdminResetPasswordDialog({
  open,
  onOpenChange,
  targetUserId,
  targetDisplayName,
  targetUsername,
  scope,
  actorUserId,
}: AdminResetPasswordDialogProps) {
  const memberQuery = useQuery({
    queryKey: ['community-member-username', targetUserId],
    queryFn: () => getCommunityMember(targetUserId!),
    enabled: open && scope === 'community' && targetUserId != null && !targetUsername,
  })

  const settingsQuery = useQuery({
    queryKey: ['security-settings'],
    queryFn: getSecuritySettings,
    enabled: open,
  })

  const username =
    targetUsername ?? memberQuery.data?.username ?? ''
  const settingsRef = useRef(settingsQuery.data ?? null)
  settingsRef.current = settingsQuery.data ?? null
  const usernameRef = useRef(username)
  usernameRef.current = username

  const form = useForm<AdminSetPasswordValues>({
    resolver: (values, context, options) =>
      createAdminSetPasswordResolver(settingsRef.current, usernameRef.current)(values, context, options),
    defaultValues: {
      password: '',
      confirm_password: '',
    },
  })

  useEffect(() => {
    if (!open) {
      form.reset()
    }
  }, [open, form])

  async function onSubmit(values: AdminSetPasswordValues) {
    if (!actorUserId || targetUserId == null) {
      toast.error('You must be signed in.')
      return
    }
    if (!username) {
      toast.error('Unable to reset password.', 'Username could not be loaded.')
      return
    }

    try {
      await superAdminSetMemberPassword(
        actorUserId,
        targetUserId,
        values.password,
        scope,
      )
      toast.success('Password updated.', `${targetDisplayName} must sign in with the new temporary password.`)
      onOpenChange(false)
    } catch (error) {
      toast.error(
        'Unable to reset password.',
        error instanceof Error ? error.message : undefined,
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>
            Set a temporary password for {targetDisplayName}. They should change it after signing in.
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <Field
            label="Temporary password"
            htmlFor="admin_temp_password"
            required
            error={form.formState.errors.password?.message}
          >
            <PasswordInput
              id="admin_temp_password"
              autoComplete="new-password"
              placeholder={placeholders.password}
              className="h-10 bg-white"
              aria-invalid={Boolean(form.formState.errors.password)}
              {...form.register('password')}
            />
          </Field>

          <Field
            label="Confirm password"
            htmlFor="admin_confirm_password"
            required
            error={form.formState.errors.confirm_password?.message}
          >
            <PasswordInput
              id="admin_confirm_password"
              autoComplete="new-password"
              placeholder={placeholders.confirm_password}
              className="h-10 bg-white"
              aria-invalid={Boolean(form.formState.errors.confirm_password)}
              {...form.register('confirm_password')}
            />
          </Field>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting || memberQuery.isLoading}>
              {form.formState.isSubmitting ? 'Saving…' : 'Reset password'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
