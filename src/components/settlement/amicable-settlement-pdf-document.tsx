import { Document, Font, Page, StyleSheet, Text, View } from '@react-pdf/renderer'

import type { AmicableSettlementPdfData, SettlementPdfDateParts } from '@/lib/amicable-settlement-pdf'

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
    letterSpacing: 0,
    marginTop: 14,
    marginBottom: 12,
  },
  body: {
    textAlign: 'justify',
    marginBottom: 10,
  },
  terms: {
    minHeight: 48,
    marginBottom: 8,
    textAlign: 'justify',
  },
  termsBlank: {
    marginBottom: 6,
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
  issued: {
    marginTop: 4,
    marginBottom: 18,
  },
  signRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 24,
    marginBottom: 18,
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
    width: 240,
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

function DateBlanks({ parts }: { parts: SettlementPdfDateParts }) {
  return (
    <Text>
      <Blank value={parts.day} width={6} /> day of <Blank value={parts.month} width={12} />,{' '}
      <Blank value={parts.year} width={6} />
    </Text>
  )
}

export function AmicableSettlementPdfDocument({ data }: { data: AmicableSettlementPdfData }) {
  const complainants = data.complainants.length > 0 ? data.complainants : ['']
  const respondents = data.respondents.length > 0 ? data.respondents : ['']

  return (
    <Document title={`Amicable Settlement ${data.barangayCaseNo || ''}`.trim()} author="Barangay Tanza 1">
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

        <Text style={styles.title}>AMICABLE SETTLEMENT</Text>

        <Text style={styles.body}>
          We, the complainant/s and respondent/s in the above-captioned case, do hereby agree to settle our
          dispute as follows:
        </Text>

        {data.terms.trim() ? (
          <Text style={styles.terms}>{data.terms.trim()}</Text>
        ) : (
          <View>
            <Text style={styles.termsBlank}>_______________________________________________</Text>
            <Text style={styles.termsBlank}>_______________________________________________</Text>
            <Text style={styles.termsBlank}>_______________________________________________</Text>
          </View>
        )}

        <Text style={styles.body}>
          and bind ourselves to comply honestly and faithfully with the above terms of settlement.
        </Text>

        <Text style={styles.issued}>
          Entered into this <DateBlanks parts={data.entered} />.
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

        <View wrap={false}>
          <Text style={styles.title}>ATTESTATION</Text>

          <Text style={styles.body}>
            I hereby certify that the foregoing amicable settlement was entered into by the parties freely and
            voluntarily, after I had explained to them the nature and consequence of such settlement.
          </Text>

          <View style={styles.chairBlock}>
            <View style={styles.signLine} />
            <Text style={styles.signCaption}>Punong Barangay/Pangkat Chairman</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}
