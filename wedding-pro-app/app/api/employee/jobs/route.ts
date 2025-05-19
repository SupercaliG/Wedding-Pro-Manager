import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserProfile, isEmployee } from "@/utils/supabase/auth-helpers";
import { getAvailableJobsForEmployee } from "@/app/job-actions";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  // Check if user is employee
  const hasAccess = await isEmployee();
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  
  // Get query parameters
  const searchParams = request.nextUrl.searchParams;
  const role = searchParams.get("role") || undefined;
  const distance = searchParams.get("distance") || undefined;
  const status = searchParams.get("status") || undefined;
  
  // Get filtered jobs
  const { data: jobs, error } = await getAvailableJobsForEmployee({
    role,
    distance,
    status
  });
  
  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }
  
  return NextResponse.json({ jobs });
}