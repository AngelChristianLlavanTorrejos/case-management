import { Sparkles } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast.tsx'
import { enhanceText, type EnhanceField } from '@/lib/ai-api'

export function EnhanceButton({
  field,
  text,
  disabled,
  onEnhanced,
}: {
  field: EnhanceField
  text: string
  disabled?: boolean
  onEnhanced: (value: string) => void
}) {
  const [loading, setLoading] = useState(false)
  const hasContent = text.trim().length > 0

  async function handleClick() {
    setLoading(true)
    try {
      const next = await enhanceText(field, text)
      onEnhanced(next)
    } catch (error) {
      toast.error('Unable to enhance this text.', error instanceof Error ? error.message : undefined)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="shrink-0"
      disabled={disabled || loading || !hasContent}
      onClick={() => void handleClick()}
    >
      <Sparkles />
      {loading ? 'Enhancing…' : 'AI Enhance'}
    </Button>
  )
}
