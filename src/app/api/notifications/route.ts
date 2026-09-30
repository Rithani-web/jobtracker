// Notification center API. All queries run as the signed-in user, so RLS
// scopes every row to its owner (the proxy's redirect is not the auth check).
//
//   GET    /api/notifications          — syncs reminders (overdue follow-ups,
//                                        interviews in the next 24h) and returns
//                                        { notifications, unreadCount }
//   PATCH  /api/notifications          — body { id } marks one read,
//                                        body { all: true } marks all read
//   DELETE /api/notifications?id=<uuid> — dismisses one notification
//
// Sync is best-effort (see syncNotifications); a sync failure still returns
// the stored rows rather than erroring the poll.

import { getAuthedClient } from "@/lib/supabase";
import {
  countUnread,
  listNotifications,
  syncNotifications,
} from "@/lib/notifications";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET() {
  const { supabase, user } = await getAuthedClient();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  await syncNotifications(supabase, user.id);

  const [rows, unreadCount] = await Promise.all([
    listNotifications(supabase),
    countUnread(supabase),
  ]);

  if (rows === null) {
    return Response.json({ error: "Query failed" }, { status: 500 });
  }
  return Response.json({ notifications: rows, unreadCount });
}

export async function PATCH(request: Request) {
  const { supabase, user } = await getAuthedClient();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { id?: unknown; all?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const readAt = new Date().toISOString();
  if (body.all === true) {
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: readAt })
      .is("read_at", null);
    if (error) {
      return Response.json({ error: "Update failed" }, { status: 500 });
    }
  } else if (typeof body.id === "string" && UUID_RE.test(body.id)) {
    // RLS scopes the update to the owner; a foreign id updates zero rows.
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: readAt })
      .eq("id", body.id);
    if (error) {
      return Response.json({ error: "Update failed" }, { status: 500 });
    }
  } else {
    return Response.json(
      { error: "Provide { id: <uuid> } or { all: true }." },
      { status: 400 },
    );
  }

  return Response.json({ ok: true, unreadCount: await countUnread(supabase) });
}

export async function DELETE(request: Request) {
  const { supabase, user } = await getAuthedClient();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  if (!UUID_RE.test(id)) {
    return Response.json(
      { error: "Missing required query parameter: id (uuid)" },
      { status: 400 },
    );
  }

  // RLS scopes the delete to the owner; a foreign id deletes zero rows.
  const { error } = await supabase.from("notifications").delete().eq("id", id);
  if (error) {
    return Response.json({ error: "Delete failed" }, { status: 500 });
  }
  return Response.json({ ok: true, unreadCount: await countUnread(supabase) });
}
