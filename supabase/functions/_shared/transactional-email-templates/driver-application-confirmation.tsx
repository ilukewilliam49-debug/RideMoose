import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "PickYou"

interface Props {
  driverName?: string
}

const DriverApplicationConfirmationEmail = ({
  driverName,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your {SITE_NAME} driver application has been received</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>
          {driverName ? `Thanks, ${driverName}!` : 'Thanks for applying!'}
        </Heading>
        <Text style={text}>
          We've received your driver application for {SITE_NAME}. Our team
          will review your documents and vehicle details and get back to you
          within <strong>1–3 business days</strong>.
        </Text>

        <Section style={infoBox}>
          <Text style={infoTitle}>What happens next?</Text>
          <Text style={infoItem}>1. Our team verifies your documents.</Text>
          <Text style={infoItem}>2. You'll receive an email when your account is approved (or if we need anything else).</Text>
          <Text style={infoItem}>3. Once approved, you can sign in and start accepting trips right away.</Text>
        </Section>

        <Text style={text}>
          In the meantime, feel free to explore the driver app — you'll see
          your application status on the dashboard.
        </Text>

        <Text style={text}>
          Questions? Just reply to this email and we'll be glad to help.
        </Text>

        <Text style={footer}>— The {SITE_NAME} Team</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: DriverApplicationConfirmationEmail,
  subject: `Your ${SITE_NAME} driver application is in review`,
  displayName: 'Driver application confirmation',
  previewData: {
    driverName: 'John',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '520px', margin: '0 auto' }
const h1 = { fontSize: '24px', fontWeight: '700' as const, color: '#0B0F1A', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.6', margin: '0 0 16px' }
const infoBox = {
  backgroundColor: '#f0f6ff',
  borderLeft: '3px solid #2F80ED',
  borderRadius: '6px',
  padding: '16px 20px',
  margin: '20px 0',
}
const infoTitle = { fontSize: '14px', fontWeight: '700' as const, color: '#0B0F1A', margin: '0 0 8px' }
const infoItem = { fontSize: '13px', color: '#55575d', lineHeight: '1.6', margin: '4px 0' }
const footer = { fontSize: '12px', color: '#999', margin: '24px 0 0' }
