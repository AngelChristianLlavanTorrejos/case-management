import { z } from 'zod'

export const lookupNameSchema = z.object({
  name: z
    .string({ error: 'Name is required' })
    .trim()
    .min(1, 'Name is required'),
})

export type LookupNameValues = z.infer<typeof lookupNameSchema>
