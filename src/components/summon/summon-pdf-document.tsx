import { Document, Font, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { ReactNode } from 'react'

import type { SummonPdfData, SummonPdfDateParts } from '@/lib/summon-pdf'

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
    marginBottom: 22,
  },
  title: {
    textAlign: 'center',
    fontFamily: 'Times-Bold',
    fontSize: 13,
    letterSpacing: 0,
    marginTop: 18,
    marginBottom: 16,
  },
  body: {
    textAlign: 'justify',
    marginBottom: 10,
  },
  warn: {
    textAlign: 'justify',
    marginTop: 4,
    marginBottom: 10,
  },
  fail: {
    marginTop: 4,
    marginBottom: 14,
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
  toRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 4,
    gap: 8,
  },
  toLabel: {
    fontFamily: 'Times-Bold',
    width: 28,
  },
  toNames: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    minHeight: 14,
    paddingBottom: 1,
  },
  toCaption: {
    fontSize: 10,
    marginLeft: 36,
    marginBottom: 16,
  },
  fill: {
    fontFamily: 'Times-Bold',
  },
  blank: {
    fontFamily: 'Times-Roman',
  },
  issued: {
    marginTop: 6,
    marginBottom: 28,
  },
  signBlock: {
    width: 240,
    marginTop: 8,
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
  returnLead: {
    textAlign: 'justify',
    marginBottom: 12,
  },
  byNote: {
    fontSize: 10,
    marginBottom: 10,
  },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 10,
  },
  modeName: {
    width: 150,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    minHeight: 14,
    paddingBottom: 1,
  },
  modeText: {
    flex: 1,
  },
  officerBlock: {
    width: 220,
    marginTop: 18,
    marginBottom: 22,
  },
  receivedTitle: {
    marginBottom: 12,
  },
  receivedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 24,
    marginBottom: 14,
  },
  receivedCol: {
    width: '46%',
  },
  receivedCaption: {
    fontSize: 10,
    textAlign: 'center',
    marginTop: 2,
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

function DateBlanks({ parts, yearWidth = 6 }: { parts: SummonPdfDateParts; yearWidth?: number }) {
  return (
    <Text>
      <Blank value={parts.day} width={6} /> day of <Blank value={parts.month} width={12} />,{' '}
      <Blank value={parts.year} width={yearWidth} />
    </Text>
  )
}

function ServiceMode({
  names,
  children,
}: {
  names: string
  children: ReactNode
}) {
  return (
    <View style={styles.modeRow} wrap={false}>
      <View style={styles.modeName}>{names.trim() ? <Text style={styles.fill}>{names}</Text> : <Text> </Text>}</View>
      <Text style={styles.modeText}>{children}</Text>
    </View>
  )
}

export function SummonPdfDocument({ data }: { data: SummonPdfData }) {
  const complainants = data.complainants.length > 0 ? data.complainants : ['']
  const respondents = data.respondents
  const respondentLine = respondents.join(', ')
  const firstRespondent = respondents[0] ?? ''
  const otherRespondents = respondents.slice(1).join(', ')
  const servedNames = respondentLine
  const period = data.appear.period || 'morning/afternoon'

  return (
    <Document title={`Summons ${data.barangayCaseNo || ''}`.trim()} author="Barangay Tanza 1">
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
          {respondents.length > 0 ? (
            respondents.map((name, index) => <NameLine key={`respondent-${index}`} value={name} />)
          ) : (
            <NameLine />
          )}
          <Text style={styles.caption}>Respondent/s</Text>
        </View>

        <Text style={styles.title}>SUMMONS</Text>

        <View style={styles.toRow}>
          <Text style={styles.toLabel}>TO:</Text>
          <View style={styles.toNames}>
            {respondentLine ? <Text style={styles.fill}>{respondentLine}</Text> : <Text> </Text>}
          </View>
        </View>
        <Text style={styles.toCaption}>Respondent/s</Text>

        <Text style={styles.body}>
          You are hereby summoned to appear before me in person, together with your witnesses, on the{' '}
          <Blank value={data.appear.day} width={6} /> day of <Blank value={data.appear.month} width={12} />,{' '}
          <Blank value={data.appear.year} width={6} /> at <Blank value={data.appear.time} width={8} /> o&apos;clock
          in the {period}, then and there to answer to a complaint made before me, copy of which is attached
          hereto, for mediation/conciliation of your dispute with complainant/s.
        </Text>

        <Text style={styles.warn}>
          You are hereby warned that if you refuse or willfully fail to appear in obedience to this summons, you
          may be barred from filing any counterclaim arising from said complaint.
        </Text>

        <Text style={styles.fail}>FAIL NOT or else face punishment for contempt of court.</Text>

        <Text style={styles.issued}>
          This <DateBlanks parts={data.issued} />.
        </Text>

        <View style={styles.signBlock}>
          <View style={styles.signLine} />
          <Text style={styles.signCaption}>Punong Barangay/Pangkat Chairman</Text>
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>OFFICER&apos;S RETURN</Text>

        <Text style={styles.returnLead}>
          I served this summons upon respondent <Blank value={firstRespondent} width={18} /> on the{' '}
          <DateBlanks parts={data.served} />, and upon respondent <Blank value={otherRespondents} width={18} /> on
          the <DateBlanks parts={data.served} />,
        </Text>

        <Text style={styles.byNote}>
          by: (Write name/s of respondent/s before mode by which he/they was/were served.)
        </Text>

        <Text style={styles.caption}>Respondent/s</Text>

        <ServiceMode names={data.personalService ? servedNames : ''}>
          1. handing to him/them said summons in person, or
        </ServiceMode>
        <ServiceMode names="">
          2. handing to him/them said summons and he/they refused to receive it, or
        </ServiceMode>
        <ServiceMode names={data.dwellingRecipient ? servedNames : ''}>
          3. leaving said summons at his/their dwelling with{' '}
          <Blank value={data.dwellingRecipient} width={16} /> (name of a person of suitable age and discretion
          residing therein), or
        </ServiceMode>
        <ServiceMode names={data.officeRecipient ? servedNames : ''}>
          4. leaving said summons at his/their office/place of business with{' '}
          <Blank value={data.officeRecipient} width={16} />, (name) a competent person in charge thereof.
        </ServiceMode>

        <View style={styles.officerBlock}>
          <View style={styles.signLine}>
            {data.officerInCharge ? <Text style={styles.fill}>{data.officerInCharge}</Text> : <Text> </Text>}
          </View>
          <Text style={styles.signCaption}>Officer</Text>
        </View>

        <Text style={styles.receivedTitle}>Received by Respondent/s representative/s:</Text>

        <View style={styles.receivedRow}>
          <View style={styles.receivedCol}>
            <View style={styles.signLine} />
            <Text style={styles.receivedCaption}>Signature</Text>
          </View>
          <View style={styles.receivedCol}>
            <View style={styles.signLine} />
            <Text style={styles.receivedCaption}>Date</Text>
          </View>
        </View>
        <View style={styles.receivedRow}>
          <View style={styles.receivedCol}>
            <View style={styles.signLine} />
            <Text style={styles.receivedCaption}>Signature</Text>
          </View>
          <View style={styles.receivedCol}>
            <View style={styles.signLine} />
            <Text style={styles.receivedCaption}>Date</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}
