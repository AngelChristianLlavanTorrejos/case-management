import { z } from 'zod'

const requiredText = (label: string) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)

export const complaintFormSchema = z.object({
  complaint_type_id: requiredText('Complaint type'),
  complainants: z.array(z.string().trim().min(1)).min(1, 'Add at least one complainant.'),
  respondents: z.array(z.string().trim().min(1)).min(1, 'Add at least one respondent.'),
  manner: requiredText('This description'),
  relief: requiredText('This description'),
})

export type ComplaintFormValues = z.infer<typeof complaintFormSchema>
