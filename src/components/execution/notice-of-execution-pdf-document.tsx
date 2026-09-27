import { Document, Font, Page, StyleSheet, Text, View } from '@react-pdf/renderer'

import type { ExecutionPdfData, ExecutionPdfDateParts } from '@/lib/notice-of-execution-pdf'

Font.registerHyphenationCallback((word) => [word])

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Times-Roman',
    fontSize: 11,
    lineHeight: 1.45,
    color: '#000000',
    backgroundColor: '#FFFFFF',
    paddingTop: 40,
    paddingBottom: 40,
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
    marginBottom: 16,
  },
  title: {
    textAlign: 'center',
    fontFamily: 'Times-Bold',
    fontSize: 13,
    marginTop: 14,
    marginBottom: 12,
  },
  body: {
    textAlign: 'justify',
    marginBottom: 8,
  },
  terms: {
    minHeight: 36,
    marginBottom: 8,
    textAlign: 'justify',
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
  signBlock: {
    width: 260,
    marginTop: 18,
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
    marginTop: 12,
  },
  copyLabel: {
    marginTop: 18,
    marginBottom: 8,
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

function DateBlanks({ parts }: { parts: ExecutionPdfDateParts }) {
  return (
    <Text>
      <Blank value={parts.day} width={6} /> day of <Blank value={parts.month} width={12} />,{' '}
      <Blank value={parts.year} width={6} />
    </Text>
  )
}

export function NoticeOfExecutionPdfDocument({ data }: { data: ExecutionPdfData }) {
  const complainants = data.complainants.length > 0 ? data.complainants : ['']
  const respondents = data.respondents.length > 0 ? data.respondents : ['']

  return (
    <Document title={`Notice of Execution ${data.barangayCaseNo || ''}`.trim()} author="Barangay Tanza 1">
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

        <Text style={styles.title}>NOTICE OF EXECUTION</Text>

        <Text style={styles.body}>
          WHEREAS, on the <DateBlanks parts={data.settlementDate} />, an amicable settlement was signed by
          the parties in the above-entitled case [or an arbitration award was rendered by the Punong
          Barangay/Pangkat ng Tagapagkasundo];
        </Text>
        <Text style={styles.body}>
          WHEREAS, the terms and conditions of the settlement, the dispositive portion of the award
          read:
        </Text>
        <Text style={styles.terms}>{data.terms || '_______________________________________________'}</Text>
        <Text style={styles.body}>The said settlement/award is now final and executory;</Text>
        <Text style={styles.body}>
          WHEREAS, the party obliged <Blank value={data.partyObligedNames} width={28} /> has not complied
          voluntarily with the aforesaid amicable settlement/arbitration award, within the period of five
          (5) days from the date of hearing on the motion for execution;
        </Text>
        <Text style={styles.body}>
          NOW, THEREFORE, I, in behalf of the Lupong Tagapamayapa and by virtue of the powers vested in
          me and the Lupon by the Katarungang Pambarangay Law and Rules, I shall cause to be realized from
          the goods and personal property of <Blank value={data.personalPropertyOf} width={24} /> the sum
          of <Blank value={data.amount} width={22} /> [or the equivalent of the property obligated] in the
          said amicable settlement [or adjudged in the said arbitration award], unless voluntary
          compliance of said settlement or award shall have been made upon receipt hereof.
        </Text>
        <Text style={styles.dateLine}>
          Signed this <DateBlanks parts={data.signed} />.
        </Text>

        <View style={styles.signBlock}>
          <View style={styles.signLine} />
          <Text style={styles.signCaption}>Punong Barangay</Text>
        </View>

        <Text style={styles.copyLabel}>Copy furnished:</Text>
        <View style={styles.signRow}>
          <View style={styles.signCol}>
            <NameLine value={complainants.filter(Boolean).join(', ')} />
            <Text style={styles.signCaption}>Complainant/s</Text>
          </View>
          <View style={styles.signCol}>
            <NameLine value={respondents.filter(Boolean).join(', ')} />
            <Text style={styles.signCaption}>Respondent/s</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}
