// GET /api/applications?company=<name>
//
// Returns the signed-in user's applications matching a company name.
// The company value is passed to PostgREST as a bound parameter (never
// concatenated into SQL), so `?company='; DROP TABLE applications; --`
// is treated as a literal company name that simply matches nothing. The
// authed client also means RLS scopes every returned row to its owner.

import { getAuthedClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const company = new URL(request.url).searchParams.get("company")?.trim();
  if (!company) {
    return Response.json(
      { error: "Missing required query parameter: company" },
      { status: 400 },
    );
  }

  const { supabase, user } = await getAuthedClient();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("applications")
    .select("*")
    .eq("company", company)
    .order("updated_at", { ascending: false });

  if (error) {
    return Response.json({ error: "Query failed" }, { status: 500 });
  }
  return Response.json({ applications: data });
}
