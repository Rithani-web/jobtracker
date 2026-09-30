// UI-facing models for the Supabase rows (camelCase + real Dates, matching
// the shapes the form components were built against), and the mappers from
// PostgREST's snake_case ISO-string rows.

import type { NotificationKind } from "@/lib/domain";

export type Application = {
  id: string;
  company: string;
  role: string;
  status: string;
  archivedAt: Date | null;
  appliedDate: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type Interview = {
  id: string;
  applicationId: string;
  scheduledAt: Date;
  type: string;
  outcome: string;
  notes: string | null;
};

export type Contact = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  applicationId: string | null;
};

export type FollowUp = {
  id: string;
  applicationId: string;
  dueDate: Date;
  done: boolean;
  note: string | null;
};

export type Notification = {
  id: string;
  kind: NotificationKind;
  entityId: string;
  applicationId: string | null;
  title: string;
  body: string | null;
  readAt: Date | null;
  createdAt: Date;
};

export type AppSummary = Pick<Application, "id" | "company" | "role">;

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export type ApplicationRow = {
  id: string;
  company: string;
  role: string;
  status: string;
  archived_at: string | null;
  applied_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type InterviewRow = {
  id: string;
  application_id: string;
  scheduled_at: string;
  type: string;
  outcome: string;
  notes: string | null;
};

export type ContactRow = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  application_id: string | null;
};

export type FollowUpRow = {
  id: string;
  application_id: string;
  due_date: string;
  done: boolean;
  note: string | null;
};

export type NotificationRow = {
  id: string;
  user_id: string;
  kind: string;
  entity_id: string;
  application_id: string | null;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
};

export type ApplicationDetailRow = ApplicationRow & {
  interviews: InterviewRow[];
  follow_ups: FollowUpRow[];
  contacts: ContactRow[];
};

export function toApplication(row: ApplicationRow): Application {
  return {
    id: row.id,
    company: row.company,
    role: row.role,
    status: row.status,
    archivedAt: toDate(row.archived_at),
    appliedDate: toDate(row.applied_date),
    notes: row.notes,
    createdAt: toDate(row.created_at)!,
    updatedAt: toDate(row.updated_at)!,
  };
}

export function toInterview(row: InterviewRow): Interview {
  return {
    id: row.id,
    applicationId: row.application_id,
    scheduledAt: toDate(row.scheduled_at)!,
    type: row.type,
    outcome: row.outcome,
    notes: row.notes,
  };
}

export function toContact(row: ContactRow): Contact {
  return {
    id: row.id,
    name: row.name,
    company: row.company,
    email: row.email,
    phone: row.phone,
    notes: row.notes,
    applicationId: row.application_id,
  };
}

export function toFollowUp(row: FollowUpRow): FollowUp {
  return {
    id: row.id,
    applicationId: row.application_id,
    dueDate: toDate(row.due_date)!,
    done: row.done,
    note: row.note,
  };
}

export function toNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    // Constrained by notifications_kind_check in Postgres; only sync writes rows.
    kind: row.kind as NotificationKind,
    entityId: row.entity_id,
    applicationId: row.application_id,
    title: row.title,
    body: row.body,
    readAt: toDate(row.read_at),
    createdAt: toDate(row.created_at)!,
  };
}

