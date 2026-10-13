
import { CertificateToFileActionPdfDocument } from '@/components/cfa/certificate-to-file-action-pdf-document'
import { pdfDocumentToBlob } from '@/lib/pdf-document-blob'
import { getCertificateToFileAction } from '@/lib/certificate-to-file-action-api'
import { getLuponChairmanName } from '@/lib/positions-api'

export type CfaPdfData = {
  barangayCaseNo: string
  complaintType: string
  complainants: string[]
  respondents: string[]
  luponChairmanName: string
}

export async function loadCertificateToFileActionPdfData(id: number): Promise<CfaPdfData> {
  const [record, luponChairmanName] = await Promise.all([
    getCertificateToFileAction(id),
    getLuponChairmanName(),
  ])
  return {
    barangayCaseNo: (record.barangay_case_no ?? '').trim(),
    complaintType: (record.complaint_type ?? '').trim(),
    complainants: record.complainants.map((name) => name.trim()).filter(Boolean),
    respondents: record.respondents.map((name) => name.trim()).filter(Boolean),
    luponChairmanName,
  }
}

export async function downloadCertificateToFileActionPdf(id: number) {
  const data = await loadCertificateToFileActionPdfData(id)
  const blob = await pdfDocumentToBlob(CertificateToFileActionPdfDocument({ data }))
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
