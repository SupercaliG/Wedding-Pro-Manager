import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/utils/honeybook/api-helpers';
import { createClient } from '@/utils/supabase/server';

/**
 * Handles incoming webhook events from HoneyBook
 * This endpoint receives real-time job update notifications
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Get the signature from the request header
    const signature = request.headers.get('X-HoneyBook-Signature');
    if (!signature) {
      console.error('Missing X-HoneyBook-Signature header');
      return NextResponse.json({ error: 'Missing signature header' }, { status: 401 });
    }

    // Get the raw request body for signature verification
    const rawBody = await request.text();
    
    // Verify the signature
    const isValid = verifyWebhookSignature(signature, rawBody);
    if (!isValid) {
      console.error('Invalid webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Parse the payload
    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch (error) {
      console.error('Error parsing webhook payload:', error);
      return NextResponse.json({ error: 'Invalid payload format' }, { status: 400 });
    }

    // Log the webhook event
    console.log('Received HoneyBook webhook event:', {
      event_type: payload.event_type,
      event_id: payload.event_id,
      timestamp: payload.timestamp,
      data: payload.data
    });

    // Store the webhook event in the database for debugging/audit purposes
    const supabase = await createClient();
    await supabase.from('audit_logs').insert({
      user_id: null, // Webhook events don't have a user ID
      action: 'WEBHOOK_RECEIVED',
      table_name: 'honeybook_webhooks',
      record_id: null,
      old_data: null,
      new_data: payload,
      metadata: {
        event_type: payload.event_type,
        event_id: payload.event_id,
        timestamp: payload.timestamp
      }
    });

    // Process the webhook data using the Supabase Edge Function
    if (payload.event_type === 'project.created' || payload.event_type === 'project.updated') {
      try {
        // Get the Supabase URL and anon key from environment variables
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        
        if (!supabaseUrl || !supabaseAnonKey) {
          throw new Error('Missing Supabase environment variables');
        }
        
        // Call the Edge Function to process the webhook
        const edgeFunctionUrl = `${supabaseUrl}/functions/v1/honeybook-job-sync`;
        const response = await fetch(edgeFunctionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`
          },
          body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          console.error('Error from Edge Function:', errorData);
        } else {
          console.log('Successfully processed webhook with Edge Function');
        }
      } catch (edgeFunctionError) {
        console.error('Error calling Edge Function:', edgeFunctionError);
        // We don't want to fail the webhook response if the Edge Function fails
        // The webhook is already logged in the database for retry
      }
    }

    // Acknowledge receipt of the webhook
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error handling HoneyBook webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}