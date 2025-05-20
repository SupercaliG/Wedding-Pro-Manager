// Follow this setup guide to integrate the Deno runtime into your application:
// https://deno.com/deploy/docs/supabase-edge-functions

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders } from '../_shared/cors.ts';

interface RequestBody {
  action: 'fetch' | 'approve' | 'reject';
  userId?: string;
  orgId?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Create a Supabase client with the service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: 'Missing environment variables' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Parse request body
    const requestData: RequestBody = await req.json();
    const { action, userId, orgId } = requestData;
    
    // Validate request
    if (!action) {
      return new Response(
        JSON.stringify({ error: 'Missing required action parameter' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }
    
    // Handle different actions
    switch (action) {
      case 'fetch':
        return await handleFetchPendingAccounts(supabase, orgId);
      case 'approve':
        return await handleApproveAccount(supabase, userId);
      case 'reject':
        return await handleRejectAccount(supabase, userId);
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
    }
  } catch (error) {
    console.error('Error in account-approval function:', error);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

/**
 * Fetch pending accounts for a specific organization
 */
async function handleFetchPendingAccounts(supabase: any, orgId?: string) {
  if (!orgId) {
    return new Response(
      JSON.stringify({ error: 'Missing required orgId parameter' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }

  try {
    // Query profiles table for pending users in the specified organization
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        id, 
        role, 
        approval_status, 
        full_name, 
        phone_number, 
        created_at,
        auth_users:id(email)
      `)
      .eq('org_id', orgId)
      .eq('approval_status', 'pending');
    
    if (error) {
      console.error('Error fetching pending accounts:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch pending accounts' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }
    
    return new Response(
      JSON.stringify({ data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unexpected error fetching pending accounts:', error);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
}

/**
 * Approve a user account
 */
async function handleApproveAccount(supabase: any, userId?: string) {
  if (!userId) {
    return new Response(
      JSON.stringify({ error: 'Missing required userId parameter' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }

  try {
    // Update the user's approval status to 'approved'
    const { data, error } = await supabase
      .from('profiles')
      .update({ approval_status: 'approved' })
      .eq('id', userId)
      .select();
    
    if (error) {
      console.error('Error approving account:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to approve account' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }
    
    // Send notification to the user
    try {
      // Get user details for notification
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', userId)
        .single();
      
      if (!userError && userData) {
        // Create notification in the database
        await supabase
          .from('notifications')
          .insert({
            user_id: userId,
            title: 'Account Approved',
            content: `Your account has been approved. You can now access all features.`,
            channel: 'in-app',
            status: 'delivered',
            read: false,
            metadata: {
              eventType: 'org_announcement',
              action: 'approve',
              timestamp: new Date().toISOString()
            }
          });
      }
    } catch (notificationError) {
      // Log notification error but don't fail the approval process
      console.error('Error sending approval notification:', notificationError);
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Account approved successfully',
        data: data?.[0] || null
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unexpected error approving account:', error);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
}

/**
 * Reject a user account
 */
async function handleRejectAccount(supabase: any, userId?: string) {
  if (!userId) {
    return new Response(
      JSON.stringify({ error: 'Missing required userId parameter' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }

  try {
    // Update the user's approval status to 'rejected'
    const { data, error } = await supabase
      .from('profiles')
      .update({ approval_status: 'rejected' })
      .eq('id', userId)
      .select();
    
    if (error) {
      console.error('Error rejecting account:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to reject account' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }
    
    // Send notification to the user
    try {
      // Get user details for notification
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', userId)
        .single();
      
      if (!userError && userData) {
        // Create notification in the database
        await supabase
          .from('notifications')
          .insert({
            user_id: userId,
            title: 'Account Rejected',
            content: `Your account has been rejected. Please contact support for more information.`,
            channel: 'in-app',
            status: 'delivered',
            read: false,
            metadata: {
              eventType: 'org_announcement',
              action: 'reject',
              timestamp: new Date().toISOString()
            }
          });
      }
    } catch (notificationError) {
      // Log notification error but don't fail the rejection process
      console.error('Error sending rejection notification:', notificationError);
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Account rejected successfully',
        data: data?.[0] || null
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unexpected error rejecting account:', error);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
}