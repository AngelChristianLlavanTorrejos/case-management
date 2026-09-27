import { Document, Font, Page, StyleSheet, Text, View } from '@react-pdf/renderer'

import type {
  NoticeMotionPdfData,
  NoticeMotionPdfDateParts,
  NoticeMotionPdfTimeParts,
} from '@/lib/notice-of-hearing-motion-pdf'

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
    marginTop: 8,
    marginBottom: 18,
  },
  title: {
    textAlign: 'center',
    fontFamily: 'Times-Bold',
    fontSize: 13,
    marginTop: 16,
    marginBottom: 4,
  },
  subtitle: {
    textAlign: 'center',
    fontFamily: 'Times-Bold',
    fontSize: 12,
    marginBottom: 14,
  },
  body: {
    textAlign: 'justify',
    marginBottom: 10,
  },
  parties: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  partyLeft: {
    width: '46%',
  },
  partyRight: {
    width: '50%',
  },
  nameLine: {
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    minHeight: 14,
    marginBottom: 4,
    paddingBottom: 1,
  },
  caption: {
    fontSize: 10,
    marginTop: 2,
    marginBottom: 8,
  },
  against: {
    textAlign: 'center',
    marginVertical: 10,
  },
  fill: {
    fontFamily: 'Times-Bold',
  },
  blank: {
    fontFamily: 'Times-Roman',
  },
  toRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 12,
    marginTop: 4,
  },
  toCol: {
    width: '46%',
  },
  toLabel: {
    marginBottom: 6,
  },
  signBlock: {
    width: 260,
    marginTop: 22,
  },
  signLine: {
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    minHeight: 16,
    marginBottom: 4,
  },
  signCaption: {
    fontSize: 10,
    textAlign: 'center',
  },
  dateLine: {
    marginTop: 18,
    marginBottom: 4,
  },
  notified: {
    marginTop: 22,
    marginBottom: 14,
  },
  signRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 24,
  },
  signCol: {
    width: '46%',
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

function NameLine({ value }: { value?: string }) {
  return (
    <View style={styles.nameLine}>
      {value?.trim() ? <Text style={styles.fill}>{value.trim()}</Text> : <Text> </Text>}
    </View>
  )
}

function DateBlanks({ parts }: { parts: NoticeMotionPdfDateParts }) {
  return (
    <Text>
      <Blank value={parts.day} width={6} /> day of <Blank value={parts.month} width={12} />,{' '}
      <Blank value={parts.year} width={6} />
    </Text>
  )
}

function TimeBlanks({ parts }: { parts: NoticeMotionPdfTimeParts }) {
  return (
    <Text>
      <Blank value={parts.time} width={6} /> o&apos;clock in the{' '}
      <Blank value={parts.period} width={10} />
    </Text>
  )
}

export function NoticeOfHearingMotionPdfDocument({ data }: { data: NoticeMotionPdfData }) {
  const complainants = data.complainants.length > 0 ? data.complainants : ['']
  const respondents = data.respondents.length > 0 ? data.respondents : ['']

  return (
    <Document
      title={`Notice of Hearing (RE: Motion for Execution) ${data.barangayCaseNo || ''}`.trim()}
      author="Barangay Tanza 1"
    >
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>Republic of the Philippines</Text>
        <Text style={styles.header}>Province of Metro Manila</Text>
        <Text style={styles.header}>CITY/MUNICIPALITY OF NAVOTAS</Text>
        <Text style={styles.header}>Barangay Tanza 1</Text>
        <Text style={styles.office}>OFFICE OF THE LUPONG TAGAPAMAYAPA</Text>

        <View style={styles.parties}>
          <View style={styles.partyLeft}>
            {complainants.map((name, index) => (
              <NameLine key={`complainant-${index}`} value={name} />
            ))}
            <Text style={styles.caption}>Complainant/s</Text>
          </View>
          <View style={styles.partyRight}>
            <Text>
              Barangay Case No. <Blank value={data.barangayCaseNo} width={18} />
            </Text>
            <Text>
              For: <Blank value={data.complaintType} width={22} />
            </Text>
          </View>
        </View>

        <Text style={styles.against}>— against —</Text>

        <View style={styles.partyLeft}>
          {respondents.map((name, index) => (
            <NameLine key={`respondent-${index}`} value={name} />
          ))}
          <Text style={styles.caption}>Respondent/s</Text>
        </View>

        <Text style={styles.title}>NOTICE OF HEARING</Text>
        <Text style={styles.subtitle}>(RE: MOTION FOR EXECUTION)</Text>

        <Text style={styles.toLabel}>TO:</Text>
        <View style={styles.toRow}>
          <View style={styles.toCol}>
            <NameLine value={complainants.filter(Boolean).join(', ')} />
            <Text style={styles.caption}>Complainant/s</Text>
          </View>
          <View style={styles.toCol}>
            <NameLine value={respondents.filter(Boolean).join(', ')} />
            <Text style={styles.caption}>Respondent/s</Text>
          </View>
        </View>

        <Text style={styles.body}>
          You are hereby required to appear before me on the <DateBlanks parts={data.appear} /> at{' '}
          <TimeBlanks parts={data.appear} /> for the hearing of the motion for execution, copy of which
          is attached hereto, filed by <Blank value={data.filedByNames} width={28} />.
        </Text>

        <Text style={styles.dateLine}>
          This <DateBlanks parts={data.issued} />.
        </Text>

        <View style={styles.signBlock}>
          <View style={styles.signLine} />
          <Text style={styles.signCaption}>Punong Barangay/Lupon Chairman</Text>
        </View>

        <Text style={styles.notified}>
          Notified this <Blank value="" width={6} /> day of <Blank value="" width={12} />,{' '}
          <Blank value="" width={6} />.
        </Text>

        <View style={styles.signRow}>
          <View style={styles.signCol}>
            <View style={styles.signLine} />
            <Text style={styles.signCaption}>(Signature) Complainant/s</Text>
          </View>
          <View style={styles.signCol}>
            <View style={styles.signLine} />
            <Text style={styles.signCaption}>(Signature) Respondent/s</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}
