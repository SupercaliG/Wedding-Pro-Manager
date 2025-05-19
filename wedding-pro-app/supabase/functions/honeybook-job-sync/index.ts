import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Define types for HoneyBook webhook payload
interface HoneyBookWebhookPayload {
  event_id: string;
  event_type: string;
  timestamp: string;
  data: {
    id: string;
    name?: string;
    start_date?: string;
    end_date?: string;
    status?: string;
    client?: {
      id: string;
      name?: string;
      email?: string;
      phone?: string;
    };
    location?: {
      name?: string;
      address?: string;
      city?: string;
      state?: string;
      zip?: string;
    };
    services?: Array<{
      id: string;
      name: string;
      price?: number;
      quantity?: number;
    }>;
    [key: string]: any; // Allow for additional fields
  };
}

// Define types for our job data
interface JobData {
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  venue_id?: string;
  status: 'draft' | 'available' | 'upcoming' | 'in_progress' | 'completed' | 'cancelled';
  org_id: string;
  honeybook_project_id: string;
  honeybook_data: any;
}

serve(async (req) => {
  try {
    // Parse the request body
    const payload: HoneyBookWebhookPayload = await req.json();
    
    // Create Supabase client with service role key
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Log the received webhook for debugging
    console.log(`Processing HoneyBook webhook: ${payload.event_type} for project ${payload.data.id}`);
    
    // Find the organization associated with this webhook
    // We need to look up which org has registered this webhook
    const { data: webhook, error: webhookError } = await supabase
      .from('honeybook_webhooks')
      .select('org_id')
      .eq('event_type', payload.event_type)
      .eq('is_active', true)
      .single();
    
    if (webhookError || !webhook) {
      throw new Error(`No active webhook found for event type ${payload.event_type}`);
    }
    
    const orgId = webhook.org_id;
    
    // Process the webhook based on event type
    switch (payload.event_type) {
      case 'project.created':
        await handleProjectCreated(supabase, orgId, payload);
        break;
      case 'project.updated':
        await handleProjectUpdated(supabase, orgId, payload);
        break;
      default:
        console.log(`Unhandled event type: ${payload.event_type}`);
    }
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error("Error processing HoneyBook webhook:", error);
    
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

/**
 * Handle 'project.created' event
 */
async function handleProjectCreated(
  supabase: any,
  orgId: string,
  payload: HoneyBookWebhookPayload
) {
  const honeyBookProjectId = payload.data.id;
  
  // Check if a job with this HoneyBook project ID already exists
  const { data: existingJob } = await supabase
    .from('jobs')
    .select('id')
    .eq('org_id', orgId)
    .eq('honeybook_project_id', honeyBookProjectId)
    .maybeSingle();
  
  if (existingJob) {
    console.log(`Job already exists for HoneyBook project ${honeyBookProjectId}`);
    // Update the existing job instead of creating a new one
    return await handleProjectUpdated(supabase, orgId, payload);
  }
  
  // Map HoneyBook project data to job data
  const jobData = mapHoneyBookToJob(orgId, payload);
  
  // Create a new venue if needed
  let venueId = null;
  if (payload.data.location) {
    venueId = await getOrCreateVenue(supabase, orgId, payload.data.location);
    if (venueId) {
      jobData.venue_id = venueId;
    }
  }
  
  // Insert the new job
  const { data: job, error } = await supabase
    .from('jobs')
    .insert(jobData)
    .select()
    .single();
  
  if (error) {
    throw new Error(`Failed to create job: ${error.message}`);
  }
  
  console.log(`Created new job with ID ${job.id} from HoneyBook project ${honeyBookProjectId}`);
  
  // Create job required roles based on HoneyBook services
  if (payload.data.services && payload.data.services.length > 0) {
    await createJobRoles(supabase, job.id, payload.data.services);
  }
  
  return job;
}

/**
 * Handle 'project.updated' event
 */
async function handleProjectUpdated(
  supabase: any,
  orgId: string,
  payload: HoneyBookWebhookPayload
) {
  const honeyBookProjectId = payload.data.id;
  
  // Find the existing job
  const { data: existingJob, error: jobError } = await supabase
    .from('jobs')
    .select('id, venue_id')
    .eq('org_id', orgId)
    .eq('honeybook_project_id', honeyBookProjectId)
    .maybeSingle();
  
  if (jobError || !existingJob) {
    // If job doesn't exist, create it instead
    console.log(`No existing job found for HoneyBook project ${honeyBookProjectId}, creating new job`);
    return await handleProjectCreated(supabase, orgId, payload);
  }
  
  // Map HoneyBook project data to job data
  const jobData = mapHoneyBookToJob(orgId, payload);
  
  // Update venue if needed
  if (payload.data.location) {
    const venueId = await getOrCreateVenue(supabase, orgId, payload.data.location);
    if (venueId) {
      jobData.venue_id = venueId;
    }
  }
  
  // Update the job
  const { data: job, error } = await supabase
    .from('jobs')
    .update(jobData)
    .eq('id', existingJob.id)
    .select()
    .single();
  
  if (error) {
    throw new Error(`Failed to update job: ${error.message}`);
  }
  
  console.log(`Updated job with ID ${job.id} from HoneyBook project ${honeyBookProjectId}`);
  
  // Update job required roles if services have changed
  if (payload.data.services && payload.data.services.length > 0) {
    // First, remove existing roles
    await supabase
      .from('job_required_roles')
      .delete()
      .eq('job_id', existingJob.id);
    
    // Then create new roles
    await createJobRoles(supabase, existingJob.id, payload.data.services);
  }
  
  return job;
}

/**
 * Map HoneyBook project data to our job data structure
 */
function mapHoneyBookToJob(
  orgId: string,
  payload: HoneyBookWebhookPayload
): JobData {
  const { data } = payload;
  
  // Map HoneyBook status to our job status
  let jobStatus: JobData['status'] = 'draft';
  if (data.status) {
    switch (data.status.toLowerCase()) {
      case 'booked':
        jobStatus = 'upcoming';
        break;
      case 'completed':
        jobStatus = 'completed';
        break;
      case 'cancelled':
        jobStatus = 'cancelled';
        break;
      default:
        jobStatus = 'draft';
    }
  }
  
  // Create a description that includes client details
  let description = '';
  if (data.client) {
    description += `Client: ${data.client.name || 'Unknown'}\n`;
    if (data.client.email) description += `Email: ${data.client.email}\n`;
    if (data.client.phone) description += `Phone: ${data.client.phone}\n`;
  }
  
  // Add services to description
  if (data.services && data.services.length > 0) {
    description += '\nServices:\n';
    data.services.forEach((service) => {
      description += `- ${service.name}`;
      if (service.quantity && service.quantity > 1) {
        description += ` (Qty: ${service.quantity})`;
      }
      description += '\n';
    });
  }
  
  // Add any notes or additional details
  if (data.notes) {
    description += `\nNotes: ${data.notes}\n`;
  }
  
  // Parse dates
  let startTime = new Date();
  let endTime = new Date();
  
  if (data.start_date) {
    startTime = new Date(data.start_date);
  }
  
  if (data.end_date) {
    endTime = new Date(data.end_date);
  } else {
    // If no end date, default to 4 hours after start
    endTime = new Date(startTime.getTime() + 4 * 60 * 60 * 1000);
  }
  
  return {
    title: data.name || `HoneyBook Project ${data.id}`,
    description: description.trim(),
    start_time: startTime.toISOString(),
    end_time: endTime.toISOString(),
    status: jobStatus,
    org_id: orgId,
    honeybook_project_id: data.id,
    honeybook_data: data,
  };
}

/**
 * Get or create a venue based on HoneyBook location data
 */
async function getOrCreateVenue(
  supabase: any,
  orgId: string,
  location: any
): Promise<string | null> {
  if (!location.name && !location.address) {
    return null;
  }
  
  // Try to find an existing venue with the same name and address
  const { data: existingVenue } = await supabase
    .from('venues')
    .select('id')
    .eq('org_id', orgId)
    .eq('name', location.name || '')
    .eq('address', location.address || '')
    .maybeSingle();
  
  if (existingVenue) {
    return existingVenue.id;
  }
  
  // Create a new venue
  const { data: venue, error } = await supabase
    .from('venues')
    .insert({
      org_id: orgId,
      name: location.name || 'Unknown Venue',
      address: location.address || '',
      city: location.city || '',
      state: location.state || '',
      zip: location.zip || '',
    })
    .select()
    .single();
  
  if (error) {
    console.error(`Failed to create venue: ${error.message}`);
    return null;
  }
  
  return venue.id;
}

/**
 * Create job required roles based on HoneyBook services
 */
async function createJobRoles(
  supabase: any,
  jobId: string,
  services: Array<{ id: string; name: string; }>
): Promise<void> {
  const roles = services.map((service) => ({
    job_id: jobId,
    role_name: service.name,
    external_id: service.id,
  }));
  
  if (roles.length === 0) {
    return;
  }
  
  const { error } = await supabase
    .from('job_required_roles')
    .insert(roles);
  
  if (error) {
    console.error(`Failed to create job roles: ${error.message}`);
  }
}