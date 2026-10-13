import { Image, StyleSheet, View } from '@react-pdf/renderer'

const HEADER_IMAGE_HEIGHT = 88

function pdfHeaderImageSrc() {
  const path = `${import.meta.env.BASE_URL}images/pdf-header.png`
  if (typeof window !== 'undefined' && window.location?.origin) {
    return new URL(path, window.location.origin).href
  }
  return path
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
