// This file contains test data and functions for local testing of the Edge Function

// Sample webhook payload for a project.created event
export const sampleProjectCreatedPayload = {
  event_id: "evt_123456789",
  event_type: "project.created",
  timestamp: new Date().toISOString(),
  data: {
    id: "proj_123456789",
    name: "Smith Wedding",
    start_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
    end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000 + 6 * 60 * 60 * 1000).toISOString(), // 6 hours after start
    status: "booked",
    client: {
      id: "client_123456789",
      name: "John and Jane Smith",
      email: "smiths@example.com",
      phone: "555-123-4567"
    },
    location: {
      name: "Grand Ballroom",
      address: "123 Main St",
      city: "New York",
      state: "NY",
      zip: "10001"
    },
    services: [
      {
        id: "service_1",
        name: "Photography",
        price: 2500,
        quantity: 1
      },
      {
        id: "service_2",
        name: "DJ",
        price: 1200,
        quantity: 1
      },
      {
        id: "service_3",
        name: "Catering Staff",
        price: 500,
        quantity: 4
      }
    ],
    notes: "Outdoor ceremony, indoor reception. Need extra lighting for dance floor."
  }
};

// Sample webhook payload for a project.updated event
export const sampleProjectUpdatedPayload = {
  event_id: "evt_987654321",
  event_type: "project.updated",
  timestamp: new Date().toISOString(),
  data: {
    id: "proj_123456789", // Same ID as created event for testing update flow
    name: "Smith Wedding - Updated",
    start_date: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(), // Date changed to 45 days from now
    end_date: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000).toISOString(), // 8 hours after start
    status: "booked",
    client: {
      id: "client_123456789",
      name: "John and Jane Smith",
      email: "smiths@example.com",
      phone: "555-123-4567"
    },
    location: {
      name: "Luxury Hotel Ballroom", // Changed venue
      address: "456 Park Ave",
      city: "New York",
      state: "NY",
      zip: "10022"
    },
    services: [
      {
        id: "service_1",
        name: "Photography",
        price: 2500,
        quantity: 1
      },
      {
        id: "service_2",
        name: "DJ",
        price: 1200,
        quantity: 1
      },
      {
        id: "service_3",
        name: "Catering Staff",
        price: 500,
        quantity: 6 // Increased quantity
      },
      {
        id: "service_4",
        name: "Videography", // Added new service
        price: 1800,
        quantity: 1
      }
    ],
    notes: "Outdoor ceremony, indoor reception. Need extra lighting for dance floor and photo booth area."
  }
};

/**
 * To test the Edge Function locally:
 * 
 * 1. Install Supabase CLI: https://supabase.com/docs/guides/cli
 * 2. Start the local development server: supabase start
 * 3. Run the Edge Function locally: supabase functions serve honeybook-job-sync --env-file .env.local
 * 4. In another terminal, send test requests:
 *    - For project.created:
 *      curl -X POST http://localhost:54321/functions/v1/honeybook-job-sync \
 *        -H "Content-Type: application/json" \
 *        -d "$(node -e "console.log(JSON.stringify(require('./test').sampleProjectCreatedPayload))")"
 * 
 *    - For project.updated:
 *      curl -X POST http://localhost:54321/functions/v1/honeybook-job-sync \
 *        -H "Content-Type: application/json" \
 *        -d "$(node -e "console.log(JSON.stringify(require('./test').sampleProjectUpdatedPayload))")"
 * 
 * 5. Check the logs: supabase logs
 */