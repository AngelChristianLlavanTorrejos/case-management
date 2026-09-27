import { Document, Font, Page, StyleSheet, Text, View } from '@react-pdf/renderer'

import type { RepudiationPdfData, RepudiationPdfDateParts } from '@/lib/repudiation-pdf'

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
  note: {
    fontSize: 10,
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
  ground: {
    marginBottom: 10,
  },
  groundRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 4,
  },
  box: {
    width: 11,
    height: 11,
    borderWidth: 1,
    borderColor: '#000000',
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxMark: {
    fontSize: 9,
    lineHeight: 1,
  },
  groundText: {
    flex: 1,
  },
  details: {
    marginLeft: 19,
    minHeight: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    marginBottom: 4,
    paddingBottom: 1,
  },
  issued: {
    marginTop: 8,
    marginBottom: 16,
  },
  signRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 24,
    marginBottom: 16,
  },
  signCol: {
    width: '46%',
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
  chairBlock: {
    width: 280,
    marginBottom: 16,
  },
  footnote: {
    fontSize: 10,
    textAlign: 'justify',
    marginTop: 8,
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

function DateBlanks({ parts }: { parts: RepudiationPdfDateParts }) {
  return (
    <Text>
      <Blank value={parts.day} width={6} /> day of <Blank value={parts.month} width={12} />,{' '}
      <Blank value={parts.year} width={6} />
    </Text>
  )
}

function Ground({
  checked,
  label,
  details,
}: {
  checked: boolean
  label: string
  details: string
}) {
  return (
    <View style={styles.ground}>
      <View style={styles.groundRow}>
        <View style={styles.box}>{checked ? <Text style={styles.boxMark}>X</Text> : <Text> </Text>}</View>
        <Text style={styles.groundText}>{label}</Text>
      </View>
      <View style={styles.details}>{details.trim() ? <Text>{details.trim()}</Text> : <Text> </Text>}</View>
      <View style={styles.details} />
    </View>
  )
}

export function RepudiationPdfDocument({ data }: { data: RepudiationPdfData }) {
  const complainants = data.complainants.length > 0 ? data.complainants : ['']
  const respondents = data.respondents.length > 0 ? data.respondents : ['']

  return (
    <Document title={`Repudiation ${data.barangayCaseNo || ''}`.trim()} author="Barangay Tanza 1">
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

        <Text style={styles.title}>REPUDIATION</Text>

        <Text style={styles.body}>
          I/WE hereby repudiate the settlement/agreement for arbitration on the ground that my/our consent was
          vitiated by:
        </Text>
        <Text style={styles.note}>(Check out whichever is applicable)</Text>

        <Ground checked={data.fraud} label="Fraud. (State details)" details={data.fraudDetails} />
        <Ground checked={data.violence} label="Violence. (State details)" details={data.violenceDetails} />
        <Ground
          checked={data.intimidation}
          label="Intimidation. (State details)"
          details={data.intimidationDetails}
        />

        <Text style={styles.issued}>
          This <DateBlanks parts={data.thisDate} />.
        </Text>

        <View style={styles.signRow}>
          <View style={styles.signCol}>
            <Text style={styles.signCaption}>Complainant/s</Text>
            <View style={styles.signLine} />
          </View>
          <View style={styles.signCol}>
            <Text style={styles.signCaption}>Respondent/s</Text>
            <View style={styles.signLine} />
          </View>
        </View>

        <Text style={styles.body}>
          SUBSCRIBED AND SWORN TO before me this <DateBlanks parts={data.sworn} /> at ______________.
        </Text>
      </Page>

      <Page size="A4" style={styles.page}>
        <View style={styles.chairBlock}>
          <View style={styles.signLine} />
          <Text style={styles.signCaption}>Punong Barangay/Pangkat Chairman/Member</Text>
        </View>

        <Text style={styles.body}>
          Received and filed * this <DateBlanks parts={data.received} />.
        </Text>

        <View style={styles.chairBlock}>
          <View style={styles.signLine} />
          <Text style={styles.signCaption}>Punong Barangay</Text>
        </View>

        <Text style={styles.footnote}>
          * Failure to repudiate the settlement or the arbitration agreement within the time limits respectively
          set (ten [10] days from the date of settlement and five [5] days from the date of arbitration
          agreement) shall be deemed a waiver of the right to challenge on said grounds.
        </Text>
      </Page>
    </Document>
  )
}
