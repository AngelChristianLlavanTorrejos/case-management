import { Document, Font, Page, StyleSheet, Text, View } from '@react-pdf/renderer'

import type { DashboardAskPdfData } from '@/lib/dashboard-ask-pdf'

Font.registerHyphenationCallback((word) => [word])

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Times-Roman',
    fontSize: 11,
    lineHeight: 1.5,
    color: '#000000',
    backgroundColor: '#FFFFFF',
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 54,
  },
  header: {
    textAlign: 'center',
    fontFamily: 'Times-Bold',
    fontSize: 14,
    marginBottom: 4,
  },
  subheader: {
    textAlign: 'center',
    fontSize: 11,
    marginBottom: 20,
  },
  metaLabel: {
    fontFamily: 'Times-Bold',
    marginBottom: 2,
  },
  metaValue: {
    marginBottom: 10,
  },
  body: {
    textAlign: 'justify',
    marginTop: 8,
  },
  paragraph: {
    marginBottom: 8,
  },
})

export function DashboardAskPdfDocument({ data }: { data: DashboardAskPdfData }) {
  const paragraphs = data.answer
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)

  return (
    <Document title="Ask AI Report" author="Tanza Resolve">
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>Tanza Resolve — Ask AI Report</Text>
        <Text style={styles.subheader}>Barangay Tanza 1</Text>

        <View>
          <Text style={styles.metaLabel}>Question</Text>
          <Text style={styles.metaValue}>{data.question}</Text>
          <Text style={styles.metaLabel}>Period</Text>
          <Text style={styles.metaValue}>{data.periodLabel}</Text>
          <Text style={styles.metaLabel}>Generated</Text>
          <Text style={styles.metaValue}>{data.generatedAt}</Text>
        </View>

        <View style={styles.body}>
          {paragraphs.map((line, index) => (
            <Text key={`${index}-${line.slice(0, 24)}`} style={styles.paragraph}>
              {line}
            </Text>
          ))}
        </View>
      </Page>
    </Document>
  )
}
