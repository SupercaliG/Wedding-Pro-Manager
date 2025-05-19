// Follow this setup guide to integrate the Deno runtime into your application:
// https://deno.com/deploy/docs/supabase-edge-functions

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

// This function runs on a schedule to check for drop requests that have exceeded the 24-hour SLA
// and escalates them to admin for review
Deno.serve(async (req) => {
  try {
    // Create a Supabase client with the admin key
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: 'Missing environment variables' }),
        { headers: { 'Content-Type': 'application/json' }, status: 500 }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get the current time
    const now = new Date();
    
    // Calculate the time 24 hours ago
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    // Find pending drop requests that are older than 24 hours
    const { data: pendingRequests, error: pendingError } = await supabase
      .from('drop_requests')
      .select('id, requested_at, status')
      .eq('status', 'pending')
      .lt('requested_at', twentyFourHoursAgo.toISOString());
    
    if (pendingError) {
      console.error('Error fetching pending drop requests:', pendingError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch pending drop requests' }),
        { headers: { 'Content-Type': 'application/json' }, status: 500 }
      );
    }
    
    console.log(`Found ${pendingRequests?.length || 0} drop requests exceeding 24-hour SLA`);
    
    // Update each request to 'escalated' status
    const escalationResults = [];
    
    if (pendingRequests && pendingRequests.length > 0) {
      for (const request of pendingRequests) {
        const { data, error } = await supabase
          .from('drop_requests')
          .update({ status: 'escalated' })
          .eq('id', request.id)
          .select('id, status');
        
        if (error) {
          console.error(`Error escalating drop request ${request.id}:`, error);
          escalationResults.push({
            id: request.id,
            success: false,
            error: error.message
          });
        } else {
          console.log(`Successfully escalated drop request ${request.id}`);
          escalationResults.push({
            id: request.id,
            success: true,
            data
          });
          
          // TODO: Send notification to admin (will be implemented in Task 15)
          console.log(`[Notification] Drop request ${request.id} has been escalated to admin due to 24-hour SLA`);
        }
      }
    }
    
    return new Response(
      JSON.stringify({
        message: `Processed ${pendingRequests?.length || 0} drop requests`,
        escalated: escalationResults
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unexpected error in check-drop-request-sla function:', error);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred' }),
      { headers: { 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

/* To invoke locally:
  1. Run `supabase functions serve check-drop-request-sla` in your terminal
  2. Run `curl -i --location --request POST 'http://localhost:54321/functions/v1/check-drop-request-sla'` in another terminal

  To deploy and schedule:
  1. Run `supabase functions deploy check-drop-request-sla`
  2. Run `supabase functions schedule check-drop-request-sla --cron "0 * * * *"` to run hourly
*/