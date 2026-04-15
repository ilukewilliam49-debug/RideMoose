

# Email Notification for Corporate Applications

## What this does
When someone submits a corporate account application, an email is automatically sent to **contact@pickyou.ca** so the admin is notified immediately and no application gets missed.

## Technical approach

The project has a verified email domain (`notify.aurorabusyellowknife.com`) but no transactional email infrastructure set up yet. We need to scaffold the full email pipeline first, then create the notification template and wire it into the submit flow.

### Steps

1. **Set up email infrastructure** — Create the database tables, queues, and cron job needed for email sending (pgmq queues, send log, suppression list, etc.)

2. **Scaffold transactional email system** — Create the `send-transactional-email` Edge Function and supporting functions (unsubscribe handler, suppression handler)

3. **Create the notification template** — A React Email component (`corporate-application-notification.tsx`) that includes:
   - Company name
   - Contact person name & email
   - Billing email
   - Requested credit limit & payment terms
   - Submitted timestamp
   - Branded with PickYou colors (blue #2F80ED, dark #0B0F1A accents on white background)

4. **Register the template** in the TEMPLATES registry

5. **Create the unsubscribe page** — Required by the email system for compliance

6. **Wire up the trigger** — In `CorporateApply.tsx`, after the successful database insert, call `send-transactional-email` with:
   - `recipientEmail: "contact@pickyou.ca"`
   - `templateName: "corporate-application-notification"`
   - `templateData` containing company name, contact info, and financial details
   - `idempotencyKey` derived from the inserted record

7. **Deploy Edge Functions** — Deploy `send-transactional-email`, `handle-email-unsubscribe`, `handle-email-suppression`, and `process-email-queue`

### What the admin receives
A clean branded email with the subject "New Corporate Application: [Company Name]" containing all the key details from the application form, so they can review and act on it without logging into the admin dashboard.

