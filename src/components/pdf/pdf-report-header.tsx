import { Image, StyleSheet, View } from '@react-pdf/renderer'

const HEADER_IMAGE_HEIGHT = 88

let pdfHeaderDataUrl: string | undefined
let pdfHeaderLoadPromise: Promise<string> | undefined

function pdfHeaderAssetUrl(): string {
  const path = `${import.meta.env.BASE_URL}images/pdf-header.png`
  if (typeof window !== 'undefined' && window.location?.origin) {
    return new URL(path, window.location.origin).href
  }
  return path
}

async function loadPdfHeaderDataUrl(): Promise<string> {
  if (pdfHeaderDataUrl) return pdfHeaderDataUrl

  const response = await fetch(pdfHeaderAssetUrl())
  if (!response.ok) {
    throw new Error(`PDF header image failed to load (${response.status})`)
  }

  const bytes = new Uint8Array(await response.arrayBuffer())
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }

  pdfHeaderDataUrl = `data:image/png;base64,${btoa(binary)}`
  return pdfHeaderDataUrl
}

/** Call before `pdf(...).toBlob()` so the header is embedded reliably (e.g. GitHub Pages). */
export function ensurePdfHeaderImageReady(): Promise<string> {
  pdfHeaderLoadPromise ??= loadPdfHeaderDataUrl()
  return pdfHeaderLoadPromise
}

function pdfHeaderImageSrc(): string {
  return pdfHeaderDataUrl ?? pdfHeaderAssetUrl()
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: HEADER_IMAGE_HEIGHT,
    objectFit: 'contain',
  },
})

export function PdfReportHeaderImage() {
  return (
    <View style={styles.wrap}>
      <Image src={pdfHeaderImageSrc()} style={styles.image} />
    </View>
  )
}
