import { Document, Font, Page, StyleSheet, Text, View } from '@react-pdf/renderer'

import type { NoticeHearingPdfData, NoticeHearingPdfDateParts } from '@/lib/notice-of-hearing-pdf'

Font.registerHyphenationCallback((word) => [word])

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Times-Roman',
    fontSize: 11,
    lineHeight: 1.45,
    color: '#000000',
    backgroundColor: '#FFFFFF',
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 54,
  },
  header: {
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 1.35,
  },
  office: {
    textAlign: 'center',
    fontSize: 11,
    marginTop: 10,
    marginBottom: 8,
  },
  title: {
    textAlign: 'center',
    fontFamily: 'Times-Bold',
    fontSize: 13,
    marginTop: 16,
  },
  subtitle: {
    textAlign: 'center',
    fontFamily: 'Times-Bold',
    fontSize: 12,
    marginBottom: 18,
  },
  toRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 16,
  },
  toCol: {
    width: '58%',
  },
  caseCol: {
    width: '38%',
  },
  toLabel: {
    fontFamily: 'Times-Bold',
    marginBottom: 4,
  },
  nameLine: {
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    minHeight: 16,
    marginBottom: 2,
    paddingBottom: 1,
  },
  caption: {
    fontSize: 10,
    marginTop: 2,
  },
  body: {
    textAlign: 'justify',
    marginTop: 8,
    marginBottom: 14,
  },
  dateLine: {
    marginTop: 8,
    marginBottom: 28,
  },
  fill: {
    fontFamily: 'Times-Bold',
  },
  blank: {
    fontFamily: 'Times-Roman',
  },
  signBlock: {
    width: 240,
    alignSelf: 'flex-end',
    marginBottom: 28,
  },
  signLine: {
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    minHeight: 18,
    marginBottom: 4,
  },
  signCaption: {
    fontSize: 10,
    textAlign: 'center',
  },
  notified: {
    marginBottom: 22,
  },
  complainantSign: {
    width: 220,
  },
})

function filledOrBlank(value: string, width: number) {
  const text = value.trim()
  return text || '_'.repeat(width)
}

function Blank({ value, width }: { value: string; width: number }) {
  const text = value.trim()
  return (
    <Text wrap={false} style={text ? styles.fill : styles.blank}>
      {filledOrBlank(text, width)}
    </Text>
  )
}

function DateBlanks({ parts }: { parts: NoticeHearingPdfDateParts }) {
  return (
    <Text>
      <Blank value={parts.day} width={6} /> day of <Blank value={parts.month} width={12} />,{' '}
      <Blank value={parts.year} width={6} />
    </Text>
  )
}

export function NoticeOfHearingPdfDocument({ data }: { data: NoticeHearingPdfData }) {
  const period = data.appear.period || 'morning/afternoon'

  return (
    <Document
      title={`Notice of Hearing ${data.barangayCaseNo || ''}`.trim()}
      author="Barangay Tanza 1"
    >
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>Republic of the Philippines</Text>
        <Text style={styles.header}>Province of Metro Manila</Text>
        <Text style={styles.header}>CITY/MUNICIPALITY OF NAVOTAS</Text>
        <Text style={styles.header}>Barangay Tanza 1</Text>
        <Text style={styles.office}>OFFICE OF THE LUPONG TAGAPAMAYAPA</Text>

        <Text style={styles.title}>NOTICE OF HEARING</Text>
        <Text style={styles.subtitle}>(MEDIATION PROCEEDINGS)</Text>

        <View style={styles.toRow}>
          <View style={styles.toCol}>
            <Text style={styles.toLabel}>TO:</Text>
            <View style={styles.nameLine}>
              {data.complainants ? <Text style={styles.fill}>{data.complainants}</Text> : <Text> </Text>}
            </View>
            <Text style={styles.caption}>Complainant&apos;s</Text>
          </View>
          <View style={styles.caseCol}>
            <Text>
              Barangay Case No. <Blank value={data.barangayCaseNo} width={14} />
            </Text>
          </View>
        </View>

        <Text style={styles.body}>
          You are hereby required to appear before me on the <DateBlanks parts={data.appear} /> at{' '}
          <Blank value={data.appear.time} width={6} /> o&apos;clock in the <Blank value={period} width={12} />{' '}
          for the hearing of your complaint.
        </Text>

        <Text style={styles.dateLine}>
          This <DateBlanks parts={data.issued} />.
        </Text>

        <View style={styles.signBlock}>
          <View style={styles.signLine} />
          <Text style={styles.signCaption}>Punong Barangay/Lupon Chairman</Text>
        </View>

        <Text style={styles.notified}>
          Notified this <DateBlanks parts={data.acknowledged} />.
        </Text>

        <View style={styles.complainantSign}>
          <View style={styles.signLine} />
          <Text style={styles.signCaption}>complainant&apos;s</Text>
        </View>
      </Page>
    </Document>
  )
}
