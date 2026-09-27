import { Document, Font, Page, StyleSheet, Text, View } from '@react-pdf/renderer'

import type { CfaPdfData } from '@/lib/certificate-to-file-action-pdf'

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
    marginBottom: 14,
  },
  body: {
    textAlign: 'justify',
    marginBottom: 10,
  },
  item: {
    textAlign: 'justify',
    marginBottom: 8,
    paddingLeft: 12,
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
    width: 240,
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
  attested: {
    marginTop: 22,
    marginBottom: 8,
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

export function CertificateToFileActionPdfDocument({ data }: { data: CfaPdfData }) {
  const complainants = data.complainants.length > 0 ? data.complainants : ['']
  const respondents = data.respondents.length > 0 ? data.respondents : ['']

  return (
    <Document title={`Certificate to File Action ${data.barangayCaseNo || ''}`.trim()} author="Barangay Tanza 1">
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

        <Text style={styles.title}>CERTIFICATION TO FILE ACTION</Text>

        <Text style={styles.body}>This is to certify that:</Text>
        <Text style={styles.item}>
          1. There was a personal confrontation between the parties before the Punong Barangay but mediation
          failed;
        </Text>
        <Text style={styles.item}>
          2. The Punong Barangay set a meeting of the parties for the constitution of the Pangkat;
        </Text>
        <Text style={styles.item}>
          3. The respondent willfully failed or refused to appear without justifiable reason at the conciliation
          proceedings before the Pangkat; and
        </Text>
        <Text style={styles.item}>
          4. Therefore, the corresponding complaint for the dispute may now be filed in court/governmental
          office.
        </Text>

        <View style={styles.signBlock}>
          <View style={styles.signLine} />
          <Text style={styles.signCaption}>Pangkat Secretary</Text>
        </View>

        <Text style={styles.attested}>Attested by:</Text>
        <View style={styles.signBlock}>
          <View style={styles.signLine} />
          <Text style={styles.signCaption}>Pangkat Chairman</Text>
        </View>
      </Page>
    </Document>
  )
}
