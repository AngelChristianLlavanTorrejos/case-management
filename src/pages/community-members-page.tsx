import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, Check, Eye, Pencil, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'

import { Field } from '@/components/auth/field'
import { PageContent, type PageContentAction, type SortDir } from '@/components/data/page-content'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { useConfirm } from '@/hooks/use-confirm'
import { toast } from '@/hooks/use-toast.tsx'
import { getRegisterLookups } from '@/lib/auth-api'
import {
  maxAdultBirthdate,
  placeholders,
} from '@/lib/form-fields'
import {
  approveCommunityMember,
  deleteCommunityMember,
  disapproveCommunityMember,
  getCommunityMember,
  listCommunityMembers,
  restrictCommunityMember,
  updateCommunityMember,
  type CommunityMember,
  type CommunityMemberListRow,
  type CommunityMemberStatusGroup,
} from '@/lib/community-members-api'
import { communityMemberSchema, type CommunityMemberValues } from '@/schemas/auth'
import { useAuthStore } from '@/stores/auth-store'
import type { LookupOption } from '@/types/auth'

const PAGE_SIZE = 10

function toDateInput(value: string | null | undefined) {
  return (value ?? '').slice(0, 10)
}

function addressesMatch(member: CommunityMember) {
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

function toFormValues(member: CommunityMember): CommunityMemberValues {
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

function DetailItem({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-[#666666]">{label}</p>
      <p className="mt-0.5 text-sm text-[#171717]">{value || '—'}</p>
    </div>
  )
}

export function CommunityMembersPage() {
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const actorUserId = useAuthStore((state) => state.session?.id)
  const [tab, setTab] = useState<CommunityMemberStatusGroup>('residents')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('display_name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [page, setPage] = useState(1)
  const [viewId, setViewId] = useState<number | null>(null)
  const [editId, setEditId] = useState<number | null>(null)

  const listQuery = useQuery({
    queryKey: ['community-members', tab, search, sortKey, sortDir, page],
    queryFn: () =>
      listCommunityMembers({
        statusGroup: tab,
        search,
        sortKey,
        sortDir,
        page,
        pageSize: PAGE_SIZE,
      }),
  })

  const rows = listQuery.data?.rows ?? []
  const total = listQuery.data?.total ?? 0

  useEffect(() => {
    if (listQuery.isError) {
      toast.error(
        'Unable to load community members.',
        listQuery.error instanceof Error ? listQuery.error.message : undefined,
      )
    }
  }, [listQuery.error, listQuery.isError])

  useEffect(() => {
    setPage(1)
  }, [tab, search])

  useEffect(() => {
    const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
    if (page > pageCount) {
      setPage(pageCount)
    }
  }, [page, total])

  async function invalidateList() {
    await queryClient.invalidateQueries({ queryKey: ['community-members'] })
  }

  async function handleApprove(row: CommunityMemberListRow) {
    const ok = await confirm({
      title: 'Approve registration?',
      description: `Approve ${row.display_name} so they can sign in as a registered resident.`,
      confirmLabel: 'Approve',
    })
    if (!ok) return

    try {
      if (!actorUserId) throw new Error('You must be signed in.')
      await approveCommunityMember(row.id, actorUserId)
      await invalidateList()
      toast.success('Registration approved.')
    } catch (error) {
      toast.error('Unable to approve this request.', error instanceof Error ? error.message : undefined)
    }
  }

  async function handleDisapprove(row: CommunityMemberListRow) {
    const ok = await confirm({
      title: 'Disapprove registration?',
      description: `This will permanently delete ${row.display_name} and their personal records.`,
      confirmLabel: 'Disapprove',
      variant: 'destructive',
    })
    if (!ok) return

    try {
      if (!actorUserId) throw new Error('You must be signed in.')
      await disapproveCommunityMember(row.id, actorUserId)
      await invalidateList()
      toast.success('Registration request deleted.')
    } catch (error) {
      toast.error('Unable to disapprove this request.', error instanceof Error ? error.message : undefined)
    }
  }

  async function handleRestrict(row: CommunityMemberListRow) {
    const ok = await confirm({
      title: 'Restrict this resident?',
      description: `${row.display_name} will no longer be able to sign in.`,
      confirmLabel: 'Restrict',
      variant: 'destructive',
    })
    if (!ok) return

    try {
      if (!actorUserId) throw new Error('You must be signed in.')
      await restrictCommunityMember(row.id, actorUserId)
      await invalidateList()
      toast.success('Resident restricted.')
    } catch (error) {
      toast.error('Unable to restrict this resident.', error instanceof Error ? error.message : undefined)
    }
  }

  async function handleDelete(row: CommunityMemberListRow) {
    const ok = await confirm({
      title: 'Delete this resident?',
      description: `This will permanently delete ${row.display_name} and their personal records.`,
      confirmLabel: 'Delete',
      variant: 'destructive',
    })
    if (!ok) return

    try {
      if (!actorUserId) throw new Error('You must be signed in.')
      await deleteCommunityMember(row.id, actorUserId)
      await invalidateList()
      toast.success('Resident deleted.')
    } catch (error) {
      toast.error('Unable to delete this resident.', error instanceof Error ? error.message : undefined)
    }
  }

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDir('asc')
  }

  const requestActions: PageContentAction<CommunityMemberListRow>[] = [
    { label: 'View', icon: Eye, onSelect: (row) => setViewId(row.id) },
    { label: 'Approve', icon: Check, onSelect: (row) => void handleApprove(row) },
    { label: 'Disapprove', icon: Trash2, onSelect: (row) => void handleDisapprove(row), variant: 'destructive' },
  ]

  const residentActions: PageContentAction<CommunityMemberListRow>[] = [
    { label: 'View', icon: Eye, onSelect: (row) => setViewId(row.id) },
    { label: 'Edit', icon: Pencil, onSelect: (row) => setEditId(row.id) },
    { label: 'Delete', icon: Trash2, onSelect: (row) => void handleDelete(row), variant: 'destructive' },
    {
      label: 'Restrict',
      icon: Ban,
      onSelect: (row) => void handleRestrict(row),
      variant: 'destructive',
      hidden: (row) => row.status_name.toLowerCase() === 'inactive',
    },
  ]

  return (
    <div>
      <PageHeader
        title="Community Members"
        description="Review registration requests and manage registered residents."
      />

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as CommunityMemberStatusGroup)}
        className="mt-5"
      >
        <TabsList>
          <TabsTrigger value="residents">Registered Members</TabsTrigger>
          <TabsTrigger value="requests">Registration Requests</TabsTrigger>
        </TabsList>
        <TabsContent value={tab}>
          <PageContent
            searchPlaceholder={placeholders.search_member}
            searchValue={search}
            onSearchChange={setSearch}
            columns={[
              { key: 'display_name', header: 'Name', sortable: true },
              { key: 'age', header: 'Age', sortable: true, className: 'w-24' },
              { key: 'sex_name', header: 'Sex', sortable: true, className: 'w-28' },
              { key: 'location', header: 'Location', sortable: true },
            ]}
            rows={rows}
            isLoading={listQuery.isLoading}
            getRowId={(row) => row.id}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            onPageChange={setPage}
            actions={tab === 'requests' ? requestActions : residentActions}
          />
        </TabsContent>
      </Tabs>

      <MemberViewDialog
        memberId={viewId}
        onClose={() => setViewId(null)}
      />
      <MemberEditDialog
        memberId={editId}
        actorUserId={actorUserId}
        onClose={() => setEditId(null)}
        onSaved={invalidateList}
      />
    </div>
  )
}

function MemberViewDialog({
  memberId,
  onClose,
}: {
  memberId: number | null
  onClose: () => void
}) {
  const memberQuery = useQuery({
    queryKey: ['community-member', memberId],
    queryFn: () => getCommunityMember(memberId as number),
    enabled: memberId !== null,
  })

  const member = memberQuery.data

  return (
    <Dialog open={memberId !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>View member</DialogTitle>
          <DialogDescription>Read-only profile details for this community member.</DialogDescription>
        </DialogHeader>
        {memberQuery.isError ? (
          <p className="py-8 text-center text-sm text-destructive">
            {memberQuery.error instanceof Error ? memberQuery.error.message : 'Unable to load profile.'}
          </p>
        ) : memberQuery.isLoading || !member ? (
          <p className="py-8 text-center text-sm text-[#666666]">Loading profile...</p>
        ) : (
          <div className="grid gap-6">
            <section className="grid gap-3">
              <h2 className="text-sm font-medium text-[#171717]">Personal information</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailItem label="Name" value={member.display_name} />
                <DetailItem label="Username" value={member.username} />
                <DetailItem label="Status" value={member.status_name} />
                <DetailItem label="Age" value={member.age} />
                <DetailItem label="Birthdate" value={toDateInput(member.birthdate)} />
                <DetailItem label="Sex" value={member.sex_name} />
                <DetailItem label="Civil status" value={member.civil_status_name} />
                <DetailItem label="Suffix" value={member.suffix_name} />
              </div>
            </section>
            <section className="grid gap-3">
              <h2 className="text-sm font-medium text-[#171717]">Present address</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailItem label="House / block / lot" value={member.present_address_house_block_lot} />
                <DetailItem label="Street" value={member.present_address_street} />
                <DetailItem label="Barangay" value={member.present_address_barangay} />
                <DetailItem label="Municipality / city" value={member.present_address_municipality_city} />
                <DetailItem label="Province" value={member.present_address_province} />
                <DetailItem label="Region" value={member.present_address_region} />
                <DetailItem label="ZIP code" value={member.present_address_zip_code} />
              </div>
            </section>
            <section className="grid gap-3">
              <h2 className="text-sm font-medium text-[#171717]">Permanent address</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailItem label="House / block / lot" value={member.permanent_address_house_block_lot} />
                <DetailItem label="Street" value={member.permanent_address_street} />
                <DetailItem label="Barangay" value={member.permanent_address_barangay} />
                <DetailItem label="Municipality / city" value={member.permanent_address_municipality_city} />
                <DetailItem label="Province" value={member.permanent_address_province} />
                <DetailItem label="Region" value={member.permanent_address_region} />
                <DetailItem label="ZIP code" value={member.permanent_address_zip_code} />
              </div>
            </section>
            <section className="grid gap-3">
              <h2 className="text-sm font-medium text-[#171717]">Contact</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailItem label="Mobile number" value={member.mobile_number} />
                <DetailItem label="Telephone number" value={member.telephone_number} />
                <DetailItem label="Email" value={member.email} />
              </div>
            </section>
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" className="cursor-pointer" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function MemberEditDialog({
  memberId,
  actorUserId,
  onClose,
  onSaved,
}: {
  memberId: number | null
  actorUserId: number | undefined
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [submitError, setSubmitError] = useState<string | null>(null)
  const lookups = useQuery({
    queryKey: ['register-lookups'],
    queryFn: getRegisterLookups,
    enabled: memberId !== null,
  })
  const memberQuery = useQuery({
    queryKey: ['community-member', memberId],
    queryFn: () => getCommunityMember(memberId as number),
    enabled: memberId !== null,
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
    if (memberQuery.data) {
      form.reset(toFormValues(memberQuery.data))
      setSubmitError(null)
    }
  }, [form, memberQuery.data])

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
      if (memberId === null) return
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

      if (!actorUserId) throw new Error('You must be signed in.')
      await updateCommunityMember(memberId, {
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
      }, actorUserId)
    },
    onSuccess: async () => {
      await onSaved()
      toast.success('Resident updated.')
      onClose()
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Unable to save resident.'
      setSubmitError(message)
      toast.error('Unable to save resident.', message)
    },
  })

  return (
    <Dialog open={memberId !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit resident</DialogTitle>
          <DialogDescription>Update personal and contact information for this resident.</DialogDescription>
        </DialogHeader>
        {memberQuery.isError ? (
          <p className="py-8 text-center text-sm text-destructive">
            {memberQuery.error instanceof Error ? memberQuery.error.message : 'Unable to load profile.'}
          </p>
        ) : memberQuery.isLoading ? (
          <p className="py-8 text-center text-sm text-[#666666]">Loading profile...</p>
        ) : (
          <form
            className="grid gap-5"
            onSubmit={form.handleSubmit((values) => {
              setSubmitError(null)
              saveMutation.mutate(values)
            })}
          >
            <section className="grid gap-4">
              <h2 className="text-sm font-medium text-[#171717]">Personal information</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="First name" htmlFor="edit_first_name" required error={form.formState.errors.first_name?.message}>
                  <Input
                    id="edit_first_name"
                    className="h-10 bg-white"
                    placeholder={placeholders.first_name}
                    {...form.register('first_name')}
                  />
                </Field>
                <Field label="Middle name" htmlFor="edit_middle_name" optional error={form.formState.errors.middle_name?.message}>
                  <Input
                    id="edit_middle_name"
                    className="h-10 bg-white"
                    placeholder={placeholders.middle_name}
                    {...form.register('middle_name')}
                  />
                </Field>
                <Field label="Last name" htmlFor="edit_last_name" required error={form.formState.errors.last_name?.message}>
                  <Input
                    id="edit_last_name"
                    className="h-10 bg-white"
                    placeholder={placeholders.last_name}
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
                <Field label="Birthdate" htmlFor="edit_birthdate" required error={form.formState.errors.birthdate?.message}>
                  <Input
                    id="edit_birthdate"
                    type="date"
                    max={maxAdultBirthdate()}
                    className="h-10 bg-white"
                    {...form.register('birthdate')}
                  />
                </Field>
              </div>
            </section>

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

            <section className="grid gap-4">
              <h2 className="text-sm font-medium text-[#171717]">Contact</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Controller
                  control={form.control}
                  name="mobile_number"
                  render={({ field, fieldState }) => (
                    <Field label="Mobile number" htmlFor="edit_mobile_number" required error={fieldState.error?.message}>
                      <MobileNumberInput
                        id="edit_mobile_number"
                        className="h-10 bg-white"
                        aria-invalid={Boolean(fieldState.error)}
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </Field>
                  )}
                />
                <Field label="Telephone number" htmlFor="edit_telephone_number" optional error={form.formState.errors.telephone_number?.message}>
                  <Input
                    id="edit_telephone_number"
                    className="h-10 bg-white"
                    placeholder={placeholders.telephone_number}
                    {...form.register('telephone_number')}
                  />
                </Field>
                <Field label="Email" htmlFor="edit_email" required error={form.formState.errors.email?.message}>
                  <Input
                    id="edit_email"
                    type="email"
                    className="h-10 bg-white sm:col-span-2"
                    placeholder={placeholders.email}
                    {...form.register('email')}
                  />
                </Field>
              </div>
            </section>

            {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}

            <DialogFooter>
              <Button type="button" variant="outline" className="cursor-pointer" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" className="cursor-pointer" disabled={saveMutation.isPending}>
                Save
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

function AddressFields({
  prefix,
  form,
  disabled,
}: {
  prefix: 'present_address' | 'permanent_address'
  form: ReturnType<typeof useForm<CommunityMemberValues>>
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
            htmlFor={`edit_${name}`}
            required
            error={form.formState.errors[name]?.message}
          >
            <Input
              id={`edit_${name}`}
              className="h-10 bg-white"
              disabled={disabled}
              placeholder={placeholders[key]}
              aria-invalid={Boolean(form.formState.errors[name])}
              {...form.register(name)}
            />
          </Field>
        )
      })}
    </div>
  )
}
