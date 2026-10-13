import { Image, StyleSheet, View } from '@react-pdf/renderer'

const PDF_HEADER_PATH = '/images/pdf-header.png'

const HEADER_IMAGE_HEIGHT = 88

function pdfHeaderImageSrc() {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return new URL(PDF_HEADER_PATH, window.location.origin).href
  }
  return PDF_HEADER_PATH
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
