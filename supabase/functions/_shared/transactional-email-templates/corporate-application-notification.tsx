import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "PickYou"

interface Props {
  companyName?: string
  contactName?: string
  contactEmail?: string
  billingEmail?: string
  creditLimit?: string
  paymentTerms?: number
  estimatedSpend?: string
  submittedAt?: string
}

const CorporateApplicationNotificationEmail = ({
  companyName = 'Unknown Company',
  contactName = 'N/A',
  contactEmail = 'N/A',
  billingEmail = 'N/A',
  creditLimit = '$0.00',
  paymentTerms = 30,
  estimatedSpend = '$0.00',
  submittedAt = new Date().toLocaleString(),
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New Corporate Application: {companyName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>New Corporate Application</Heading>
        <Text style={text}>
          A new corporate account application has been submitted on {SITE_NAME}.
        </Text>

        <Section style={detailsBox}>
          <Text style={detailLabel}>Company Name</Text>
          <Text style={detailValue}>{companyName}</Text>

          <Text style={detailLabel}>Contact Person</Text>
          <Text style={detailValue}>{contactName} ({contactEmail})</Text>

          <Text style={detailLabel}>Billing Email</Text>
          <Text style={detailValue}>{billingEmail}</Text>

          <Hr style={divider} />

          <Text style={detailLabel}>Requested Credit Limit</Text>
          <Text style={detailValue}>{creditLimit}</Text>

          <Text style={detailLabel}>Payment Terms</Text>
          <Text style={detailValue}>Net {paymentTerms} days</Text>

          <Text style={detailLabel}>Estimated Monthly Spend</Text>
          <Text style={detailValue}>{estimatedSpend}</Text>
        </Section>

        <Text style={text}>
          Please review this application in the Admin dashboard under Corporate accounts.
        </Text>

        <Text style={footer}>
          Submitted at {submittedAt}
        </Text>
        <Text style={footer}>— {SITE_NAME} System</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: CorporateApplicationNotificationEmail,
  subject: (data: Record<string, any>) => `New Corporate Application: ${data.companyName || 'Unknown'}`,
  to: 'contact@pickyou.ca',
  displayName: 'Corporate application notification',
  previewData: {
    companyName: 'Acme Corp',
    contactName: 'Jane Doe',
    contactEmail: 'jane@acme.com',
    billingEmail: 'billing@acme.com',
    creditLimit: '$5,000.00',
    paymentTerms: 30,
    estimatedSpend: '$2,000.00',
    submittedAt: 'April 15, 2026, 10:30 AM',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '520px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: '700' as const, color: '#0B0F1A', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.6', margin: '0 0 16px' }
const detailsBox = {
  backgroundColor: '#f8f9fb',
  borderRadius: '8px',
  padding: '20px 24px',
  margin: '0 0 20px',
  border: '1px solid #e5e7eb',
}
const detailLabel = { fontSize: '11px', color: '#888', margin: '12px 0 2px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }
const detailValue = { fontSize: '14px', color: '#0B0F1A', fontWeight: '600' as const, margin: '0 0 4px' }
const divider = { borderColor: '#e5e7eb', margin: '16px 0' }
const footer = { fontSize: '12px', color: '#999', margin: '4px 0 0' }
