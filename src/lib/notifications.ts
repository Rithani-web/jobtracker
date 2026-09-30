import { getAuthedClient } from "@/lib/supabase";
import {
  formatDateShort,
  formatDateTime,
  startOfToday,
} from "@/lib/domain";
import type { NotificationKind } from "@/lib/domain";
import type { NotificationRow } from "@/lib/types";

type Supabase = Awaited<ReturnType<typeof getAuthedClient>>["supabase"];

// The two reminder kinds materialized by syncNotifications. JobTracker has no
// cross-user events, so notifications are derived from the user's own data:
// undone follow-ups past their due date, and interviews within the next 24h
// (the same "needs attention" signals the dashboard surfaces).
const KINDS: NotificationKind[] = ["follow_up_overdue", "interview_upcoming"];
const INTERVIEW_WINDOW_MS = 24 * 60 * 60 * 1000;

/** "PhoneScreen" → "Phone screen"; the other types are already readable. */
function interviewLabel(type: string): string {
  return type === "PhoneScreen" ? "Phone screen" : type;
}

type SourceRow = {
  id: string;
  application_id: string;
  applications: { company: string; role: string } | { company: string; role: string }[] | null;
};

function appLabel(row: SourceRow): string {
  // PostgREST returns a many-to-one embed as an object; array only for
  // one-to-many. Cast house-style like the list pages do.
  const embed = row.applications;
  const app = Array.isArray(embed) ? embed[0] : embed;
  return app ? `${app.company} — ${app.role}` : "Application removed";
}

/**
 * Materializes reminder notifications for the signed-in user (RLS scopes every
 * query). Idempotent: a unique (user_id, kind, entity_id) index backs the
 * upsert, and rows whose condition cleared are pruned — a done or deleted
 * follow-up, or an interview rescheduled out of the 24h window (entity_id has
 * no FK; pruning is what removes their rows. Only deleting the application
 * cascades, via application_id). read_at survives while an item stays in scope.
 *
 * Best-effort: called on the GET /api/notifications path, so any failure just
 * leaves the stored rows as-is rather than failing the request.
 */
export async function syncNotifications(
  supabase: Supabase,
  userId: string,
): Promise<void> {
  const now = new Date();
  const nowIso = now.toISOString();
  const todayStartIso = startOfToday().toISOString();
  const in24hIso = new Date(now.getTime() + INTERVIEW_WINDOW_MS).toISOString();

  const [overdue, upcoming, existing] = await Promise.all([
    supabase
      .from("follow_ups")
      .select("id, application_id, due_date, applications(company, role)")
      .eq("done", false)
      .lt("due_date", todayStartIso),
    supabase
      .from("interviews")
      .select("id, application_id, scheduled_at, type, applications(company, role)")
      .gte("scheduled_at", nowIso)
      .lt("scheduled_at", in24hIso),
    supabase.from("notifications").select("kind, entity_id").in("kind", KINDS),
  ]);

  if (overdue.error || upcoming.error || existing.error) return;

  type Desired = {
    user_id: string;
    kind: NotificationKind;
    entity_id: string;
    application_id: string;
    title: string;
    body: string;
  };

  const desired = new Map<string, Desired>();

  for (const row of (overdue.data ?? []) as (SourceRow & { due_date: string })[]) {
    desired.set(`follow_up_overdue:${row.id}`, {
      user_id: userId,
      kind: "follow_up_overdue",
      entity_id: row.id,
      application_id: row.application_id,
      title: "Follow-up overdue",
      body: `Due ${formatDateShort(new Date(row.due_date))} · ${appLabel(row)}`,
    });
  }

  for (const row of (upcoming.data ?? []) as (SourceRow & {
    scheduled_at: string;
    type: string;
  })[]) {
    desired.set(`interview_upcoming:${row.id}`, {
      user_id: userId,
      kind: "interview_upcoming",
      entity_id: row.id,
      application_id: row.application_id,
      title: `${interviewLabel(row.type)} interview`,
      body: `${formatDateTime(new Date(row.scheduled_at))} · ${appLabel(row)}`,
    });
  }

  const stale = (existing.data ?? []).filter(
    (row) => !desired.has(`${row.kind}:${row.entity_id}`),
  );

  for (const kind of KINDS) {
    const ids = stale
      .filter((row) => row.kind === kind)
      .map((row) => row.entity_id);
    if (ids.length === 0) continue;
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("kind", kind)
      .in("entity_id", ids);
    if (error) return;
  }

  if (desired.size === 0) return;
  const { error } = await supabase
    .from("notifications")
    .upsert([...desired.values()], {
      onConflict: "user_id,kind,entity_id",
      ignoreDuplicates: true,
    });
  if (error) return;
}

/** Live unread count, used by the API responses after sync and mutations. */
export async function countUnread(supabase: Supabase): Promise<number> {
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  return count ?? 0;
}

/**
 * Lists notifications for the panel: unread first, newest first within each
 * group. Returns raw rows (the client maps them with toNotification).
 */
export async function listNotifications(
  supabase: Supabase,
): Promise<NotificationRow[] | null> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("read_at", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) return null;
  return data as NotificationRow[];
}
