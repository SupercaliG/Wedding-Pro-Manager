# HoneyBook Job Sync Edge Function

This Supabase Edge Function processes HoneyBook webhook events and synchronizes job data between HoneyBook and the Wedding Pro application.

## Purpose

The function handles the following webhook events:

- `project.created`: Creates a new job in the Wedding Pro database when a new project is created in HoneyBook.
- `project.updated`: Updates an existing job in the Wedding Pro database when a project is updated in HoneyBook.

## Data Mapping

The function maps HoneyBook project data to Wedding Pro job data as follows:

- HoneyBook project → Wedding Pro job
- HoneyBook project name → Job title
- HoneyBook project dates → Job start/end times
- HoneyBook project status → Job status
- HoneyBook location → Venue (creates a new venue if needed)
- HoneyBook services → Job required roles

## Implementation Details

1. **Webhook Verification**: The Next.js API route (`/api/honeybook/webhook/route.ts`) verifies the webhook signature before forwarding the payload to this Edge Function.

2. **Organization Identification**: The function identifies which organization the webhook belongs to by looking up the webhook registration in the `honeybook_webhooks` table.

3. **Data Processing**:
   - For `project.created` events, the function creates a new job and associated venue/roles.
   - For `project.updated` events, the function updates an existing job or creates a new one if it doesn't exist.

4. **Error Handling**: The function includes robust error handling and logging to ensure data integrity and facilitate debugging.

## Database Schema

The function interacts with the following tables:

- `jobs`: Stores job data with HoneyBook-specific fields (`honeybook_project_id`, `honeybook_data`, `honeybook_last_synced_at`)
- `venues`: Stores venue data created from HoneyBook location information
- `job_required_roles`: Stores job roles created from HoneyBook services
- `honeybook_webhooks`: Used to identify which organization a webhook belongs to

## Testing

Use the included `test.ts` file to test the Edge Function locally:

1. Install the Supabase CLI: `npm install -g supabase`
2. Start the local development server: `supabase start`
3. Run the Edge Function locally: `supabase functions serve honeybook-job-sync --env-file .env.local`
4. Send test requests using the sample payloads in `test.ts`

## Deployment

Deploy the Edge Function to Supabase:

```bash
supabase functions deploy honeybook-job-sync
```

## Environment Variables

The Edge Function requires the following environment variables:

- `SUPABASE_URL`: The URL of your Supabase project
- `SUPABASE_SERVICE_ROLE_KEY`: The service role key for your Supabase project

These should be set in the Supabase dashboard under Settings > API > Edge Functions.