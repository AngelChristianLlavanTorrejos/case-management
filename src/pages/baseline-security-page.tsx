import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Controller, useForm, type Control, type FieldPath } from 'react-hook-form'

import { Field } from '@/components/auth/field'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useConfirm } from '@/hooks/use-confirm'
import { toast } from '@/hooks/use-toast.tsx'
import {
  emptySecuritySettings,
  getSecuritySettings,
  updateSecuritySettings,
  type SecuritySettings,
} from '@/lib/security-settings-api'
import { securitySettingsSchema, type SecuritySettingsValues } from '@/schemas/security'
import { useAuthStore } from '@/stores/auth-store'

type ToggleAmount = {
  toggle: FieldPath<SecuritySettingsValues>
  amount?: FieldPath<SecuritySettingsValues>
  label: string
  amountLabel?: string
}

const LOGIN_ROWS: ToggleAmount[] = [
  {
    toggle: 'is_locked_after_a_certain_login_attempts',
    amount: 'allow_login_attempts',
    label: 'Lock account after a certain number of failed login attempts',
    amountLabel: 'Allowed attempts',
  },
  {
    toggle: 'is_logout_after_a_certain_idle_minutes',
    amount: 'max_idle_minutes',
    label: 'Log out after a certain number of idle minutes',
    amountLabel: 'Idle minutes',
  },
  {
    toggle: 'is_restrict_user_after_a_certain_inactive_days',
    amount: 'max_inactive_days',
    label: 'Restrict user after a certain number of inactive days',
    amountLabel: 'Inactive days',
  },
  {
    toggle: 'is_allow_dual_login',
    label: 'Allow dual login',
  },
]

const PASSWORD_ROWS: ToggleAmount[] = [
  {
    toggle: 'is_enable_min_length_password',
    amount: 'min_length_password',
    label: 'Require a minimum password length',
    amountLabel: 'Minimum length',
  },
  {
    toggle: 'is_enable_max_length_password',
    amount: 'max_length_password',
    label: 'Require a maximum password length',
    amountLabel: 'Maximum length',
  },
  {
    toggle: 'is_enable_min_lowercase',
    amount: 'min_lowercase',
    label: 'Require lowercase letters',
    amountLabel: 'Minimum lowercase',
  },
  {
    toggle: 'is_enable_min_uppercase',
    amount: 'min_uppercase',
    label: 'Require uppercase letters',
    amountLabel: 'Minimum uppercase',
  },
  {
    toggle: 'is_enable_min_numeric',
    amount: 'min_numeric',
    label: 'Require numbers',
    amountLabel: 'Minimum numbers',
  },
  {
    toggle: 'is_enable_min_special_character',
    amount: 'min_special_character',
    label: 'Require special characters',
    amountLabel: 'Minimum special characters',
  },
  {
    toggle: 'is_enable_password_must_not_match_username',
    label: 'Password must not contain the username',
  },
  {
    toggle: 'is_enable_password_must_not_contain_sequential',
    label: 'Password must not contain sequential characters',
  },
  {
    toggle: 'is_enable_password_must_not_contain_repeated_char',
    label: 'Password must not repeat the same character 3 times in a row',
  },
]

function SettingRow({
  control,
  row,
  enabled,
}: {
  control: Control<SecuritySettingsValues>
  row: ToggleAmount
  enabled: boolean
}) {
  return (
    <div className="grid gap-3 rounded-lg border border-[#E5E5E6] bg-white p-4 sm:grid-cols-[1fr_10rem] sm:items-start">
      <Controller
        name={row.toggle}
        control={control}
        render={({ field }) => (
          <label className="flex cursor-pointer items-start gap-2 text-sm text-[#171717]">
            <Checkbox
              className="mt-0.5"
              checked={field.value === true}
              onCheckedChange={(checked) => field.onChange(checked === true)}
            />
            <span>{row.label}</span>
          </label>
        )}
      />
      {row.amount && row.amountLabel ? (
        <Controller
          name={row.amount}
          control={control}
          render={({ field, fieldState }) => (
            <Field label={row.amountLabel} htmlFor={row.amount} error={fieldState.error?.message}>
              <Input
                id={row.amount}
                type="number"
                min={0}
                disabled={!enabled}
                className="h-10 bg-white"
                value={String(field.value ?? 0)}
                onChange={(event) => field.onChange(event.target.value === '' ? 0 : Number(event.target.value))}
              />
            </Field>
          )}
        />
      ) : null}
    </div>
  )
}

export function BaselineSecurityPage() {
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const actorUserId = useAuthStore((state) => state.session?.id)

  const settingsQuery = useQuery({
    queryKey: ['security-settings'],
    queryFn: getSecuritySettings,
  })

  const form = useForm<SecuritySettingsValues>({
    resolver: zodResolver(securitySettingsSchema),
    defaultValues: emptySecuritySettings,
  })

  useEffect(() => {
    if (settingsQuery.data) {
      form.reset(settingsQuery.data)
    }
  }, [form, settingsQuery.data])

  const saveMutation = useMutation({
    mutationFn: async (values: SecuritySettingsValues) => {
      if (!actorUserId) throw new Error('You must be signed in.')
      return updateSecuritySettings(values as SecuritySettings, actorUserId)
    },
    onSuccess: async (next) => {
      form.reset(next)
      await queryClient.invalidateQueries({ queryKey: ['security-settings'] })
      toast.success('Baseline Security settings saved.')
    },
    onError: (error) => {
      toast.error(
        'Unable to save settings.',
        error instanceof Error ? error.message : undefined,
      )
    },
  })

  async function handleSave() {
    const valid = await form.trigger()
    if (!valid) return

    const confirmed = await confirm({
      title: 'Save Baseline Security settings?',
      description: 'These rules will apply to login and new registrations immediately.',
      confirmLabel: 'Save',
    })
    if (!confirmed) return

    await saveMutation.mutateAsync(form.getValues())
  }

  const values = form.watch()

  return (
    <div>
      <PageHeader
        title="Baseline Security"
        description="Configure login lockout, idle timeout, sessions, and password rules."
      />

      {settingsQuery.isError ? (
        <p className="mt-5 text-sm text-destructive">
          {settingsQuery.error instanceof Error
            ? settingsQuery.error.message
            : 'Unable to load security settings.'}
        </p>
      ) : (
        <Tabs defaultValue="login" className="mt-5">
          <TabsList>
            <TabsTrigger value="login">Login Configuration</TabsTrigger>
            <TabsTrigger value="password">Password Configuration</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <div className="grid gap-3">
              {LOGIN_ROWS.map((row) => (
                <SettingRow
                  key={row.toggle}
                  control={form.control}
                  row={row}
                  enabled={Boolean(values[row.toggle])}
                />
              ))}
              <div>
                <Button
                  type="button"
                  className="cursor-pointer"
                  disabled={saveMutation.isPending || settingsQuery.isLoading}
                  onClick={() => void handleSave()}
                >
                  Save
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="password">
            <div className="grid gap-3">
              {PASSWORD_ROWS.map((row) => (
                <SettingRow
                  key={row.toggle}
                  control={form.control}
                  row={row}
                  enabled={Boolean(values[row.toggle])}
                />
              ))}
              <div>
                <Button
                  type="button"
                  className="cursor-pointer"
                  disabled={saveMutation.isPending || settingsQuery.isLoading}
                  onClick={() => void handleSave()}
                >
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
