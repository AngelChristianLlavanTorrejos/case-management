import { pdf } from '@react-pdf/renderer'

import { CertificateToFileActionPdfDocument } from '@/components/cfa/certificate-to-file-action-pdf-document'
import { getCertificateToFileAction } from '@/lib/certificate-to-file-action-api'

export type CfaPdfData = {
  barangayCaseNo: string
  complaintType: string
  complainants: string[]
  respondents: string[]
}

export async function loadCertificateToFileActionPdfData(id: number): Promise<CfaPdfData> {
  const record = await getCertificateToFileAction(id)
  return {
    barangayCaseNo: (record.barangay_case_no ?? '').trim(),
    complaintType: (record.complaint_type ?? '').trim(),
    complainants: record.complainants.map((name) => name.trim()).filter(Boolean),
    respondents: record.respondents.map((name) => name.trim()).filter(Boolean),
  }
}

export async function downloadCertificateToFileActionPdf(id: number) {
  const data = await loadCertificateToFileActionPdfData(id)
  const blob = await pdf(CertificateToFileActionPdfDocument({ data })).toBlob()
  const slug = (data.barangayCaseNo || `certificate-${id}`).replace(/[^\w.-]+/g, '_')
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `certificate-to-file-action-${slug}.pdf`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
