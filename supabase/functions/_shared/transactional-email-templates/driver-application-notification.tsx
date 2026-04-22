import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr, Button,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "PickYou"
const REVIEW_URL = "https://pickyou.ca/admin/verifications"

interface Props {
  driverName?: string
  driverEmail?: string
  driverPhone?: string
  vehicleYear?: string
  vehicleMake?: string
  vehicleModel?: string
  vehicleColor?: string
  vehicleType?: string
  licensePlate?: string
  documentsUploaded?: number
  submittedAt?: string
}

const DriverApplicationNotificationEmail = ({
  driverName = 'Unknown Driver',
  driverEmail = 'N/A',
  driverPhone = 'N/A',
  vehicleYear = 'N/A',
  vehicleMake = 'N/A',
  vehicleModel = 'N/A',
  vehicleColor = 'N/A',
  vehicleType = 'N/A',
  licensePlate = 'N/A',
  documentsUploaded = 0,
  submittedAt = new Date().toLocaleString(),
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New Driver Application: {driverName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>New Driver Application</Heading>
        <Text style={text}>
          A new driver has submitted their onboarding application on {SITE_NAME}.
        </Text>

        <Section style={detailsBox}>
          <Text style={detailLabel}>Driver Name</Text>
          <Text style={detailValue}>{driverName}</Text>

          <Text style={detailLabel}>Email</Text>
          <Text style={detailValue}>{driverEmail}</Text>

          <Text style={detailLabel}>Phone</Text>
          <Text style={detailValue}>{driverPhone}</Text>

          <Hr style={divider} />

          <Text style={detailLabel}>Vehicle</Text>
          <Text style={detailValue}>
            {vehicleYear} {vehicleMake} {vehicleModel} ({vehicleColor})
          </Text>

          <Text style={detailLabel}>Vehicle Type</Text>
          <Text style={detailValue}>{vehicleType}</Text>

          <Text style={detailLabel}>License Plate</Text>
          <Text style={detailValue}>{licensePlate}</Text>

          <Hr style={divider} />

          <Text style={detailLabel}>Documents Uploaded</Text>
          <Text style={detailValue}>{documentsUploaded}</Text>
        </Section>

        <Section style={{ textAlign: 'center' as const, margin: '24px 0' }}>
          <Button href={REVIEW_URL} style={button}>
            Review Application
          </Button>
        </Section>

        <Text style={footer}>Submitted at {submittedAt}</Text>
        <Text style={footer}>— {SITE_NAME} System</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: DriverApplicationNotificationEmail,
  subject: (data: Record<string, any>) => `New Driver Application: ${data.driverName || 'Unknown'}`,
  to: 'contact@pickyou.ca',
  displayName: 'Driver application notification',
  previewData: {
    driverName: 'John Smith',
    driverEmail: 'john@example.com',
    driverPhone: '+1 867 555 0123',
    vehicleYear: '2022',
    vehicleMake: 'Toyota',
    vehicleModel: 'Camry',
    vehicleColor: 'Silver',
    vehicleType: 'sedan',
    licensePlate: 'ABC123',
    documentsUploaded: 4,
    submittedAt: 'April 22, 2026, 2:15 PM',
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
const button = {
  backgroundColor: '#2F80ED',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: '600' as const,
  padding: '12px 24px',
  borderRadius: '8px',
  textDecoration: 'none',
  display: 'inline-block',
}
const footer = { fontSize: '12px', color: '#999', margin: '4px 0 0' }
