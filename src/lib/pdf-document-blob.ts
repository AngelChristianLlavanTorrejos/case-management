import { pdf, type DocumentProps } from '@react-pdf/renderer'
import type { ReactElement } from 'react'

import { ensurePdfHeaderImageReady } from '@/components/pdf/pdf-report-header'

export async function pdfDocumentToBlob(
  element: ReactElement<DocumentProps>,
): Promise<Blob> {
  await ensurePdfHeaderImageReady()
  return pdf(element).toBlob()
}
