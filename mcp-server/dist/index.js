#!/usr/bin/env node
// JobTracker MCP server — exposes applications / interviews / follow-ups /
// contacts (Supabase Postgres) as tools over stdio.
//
// Local, personal use only: it connects with SUPABASE_DB_URL (the DB owner
// role), so it bypasses RLS — the same trade-off as supabase/scripts/*.mjs.
// Do not host this remotely as-is.
//
// Env (process.env wins, then supabase/.env.local resolved relative to the
// script's own location so any cwd works):
//   SUPABASE_DB_URL  — session-pooler connection string (required)
//   MCP_USER_EMAIL   — scope all tools to one auth.users row (optional for
//                      reads; REQUIRED for writes, because a direct pg
//                      connection has no auth.uid() to default user_id from)
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import pg from "pg";
import { z } from "zod";
// ---- Domain vocabulary -----------------------------------------------------
// Mirrors src/lib/domain.ts (source of truth) and the CHECK constraints in
// supabase/migrations/0001_init.sql. Kept in sync by hand — this is a separate
// package and cannot import from the Next.js app.
const STATUSES = [
    "Saved",
    "Applied",
    "Interviewing",
    "Offer",
    "Rejected",
    "Withdrawn",
];
const INTERVIEW_TYPES = [
    "PhoneScreen",
    "Technical",
    "Behavioral",
    "Onsite",
    "Final",
    "Other",
];
const OUTCOMES = ["Pending", "Passed", "Rejected"];
// ---- Env -------------------------------------------------------------------
const here = dirname(fileURLToPath(import.meta.url)); // mcp-server/dist
const envPath = join(here, "..", "..", "supabase", ".env.local");
let fileEnv = {};
try {
    fileEnv = Object.fromEntries(readFileSync(envPath, "utf8")
        .split(/\r?\n/)
        .filter((l) => /^[A-Za-z_]+\s*=/.test(l))
        .map((l) => {
        const eq = l.indexOf("=");
        return [
            l.slice(0, eq).trim(),
            l
                .slice(eq + 1)
                .trim()
                .replace(/^["']|["']$/g, ""),
        ];
    }));
}
catch {
    // No supabase/.env.local — fine as long as process.env carries the values.
}
const env = (key) => process.env[key] ?? fileEnv[key];
const connectionString = env("SUPABASE_DB_URL");
if (!connectionString) {
    console.error("jobtracker-mcp: SUPABASE_DB_URL is not set (process.env or supabase/.env.local)");
    process.exit(1);
}
const pool = new pg.Pool({
    connectionString,
    // The Supabase session pooler presents a chain Node can't CA-validate
    // (verified: strict TLS rejects with "self-signed certificate in chain"),
    // so encryption-on / CA-validation-off — same convention as
    // supabase/scripts/*.mjs. Local personal tool only; don't host remotely.
    ssl: { rejectUnauthorized: false },
    max: 3,
});
// ---- Optional per-user scoping ---------------------------------------------
const userEmail = env("MCP_USER_EMAIL");
let scopedUserId = null;
if (userEmail) {
    const { rows } = await pool.query(`select id from auth.users where email = $1`, [userEmail]);
    if (rows.length === 0) {
        console.error(`jobtracker-mcp: MCP_USER_EMAIL "${userEmail}" not found in auth.users`);
        await pool.end();
        process.exit(1);
    }
    scopedUserId = rows[0].id;
}
const scopeArg = () => scopedUserId; // single $1::uuid param: null = unscoped
function ok(data) {
    return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
}
function say(message) {
    return { content: [{ type: "text", text: message }] };
}
function fail(message) {
    return { isError: true, content: [{ type: "text", text: message }] };
}
/** Writes need an owner: a direct pg connection has no auth.uid() to default to. */
function writeScopeError() {
    return fail("Write tools require MCP_USER_EMAIL to be set (the seed users are " +
        "user1..8@seed.jobtracker.test) because a direct DB connection has no " +
        "auth.uid() to attribute rows to.");
}
// ---- Server -------------------------------------------------------------------
const server = new McpServer({ name: "jobtracker-mcp", version: "0.1.0" }, {
    instructions: "Tools read and write a JobTracker database (job applications, " +
        "interviews, follow-ups, contacts). Reads see all users unless the " +
        "server was started with MCP_USER_EMAIL, which scopes everything to " +
        "that single user. IDs are UUIDs; get them from list_applications.",
});
server.registerTool("list_applications", {
    title: "List applications",
    description: "List job applications, newest activity first. Returns id, company, " +
        "role, status, applied_date, notes, archived_at, updated_at. Excludes " +
        "archived rows unless archived=true.",
    inputSchema: {
        status: z
            .enum(STATUSES)
            .optional()
            .describe("Only rows currently in this status"),
        archived: z
            .boolean()
            .default(false)
            .describe("true = only archived rows, false = only active rows"),
        limit: z
            .number()
            .int()
            .min(1)
            .max(100)
            .default(25)
            .describe("Max rows returned"),
    },
    annotations: { readOnlyHint: true, idempotentHint: true },
}, async ({ status, archived, limit }) => {
    const { rows } = await pool.query(`select id, company, role, status, applied_date, notes, archived_at,
              created_at, updated_at
       from public.applications
       where ($1::uuid is null or user_id = $1)
         and ($2::text is null or status = $2)
         and (archived_at is not null) = $3::boolean
       order by updated_at desc
       limit $4`, [scopeArg(), status ?? null, archived, limit]);
    return ok(rows);
});
server.registerTool("get_application", {
    title: "Get application detail",
    description: "Fetch one application with its full timeline: interviews, follow-ups, " +
        "and linked contacts. Returns not-found if the id is unknown — use " +
        "list_applications to find valid ids.",
    inputSchema: {
        id: z.string().uuid().describe("Application id (from list_applications)"),
    },
    annotations: { readOnlyHint: true, idempotentHint: true },
}, async ({ id }) => {
    const scope = scopeArg();
    const app = await pool.query(`select * from public.applications
       where id = $1 and ($2::uuid is null or user_id = $2)`, [id, scope]);
    if (app.rows.length === 0) {
        return fail(`Application ${id} not found. Use list_applications to get valid ids.`);
    }
    const [interviews, followUps, contacts] = await Promise.all([
        pool.query(`select id, scheduled_at, type, outcome, notes
         from public.interviews where application_id = $1
         order by scheduled_at desc`, [id]),
        pool.query(`select id, due_date, done, note
         from public.follow_ups where application_id = $1
         order by done asc, due_date asc`, [id]),
        pool.query(`select id, name, company, email, phone, notes
         from public.contacts where application_id = $1`, [id]),
    ]);
    return ok({
        application: app.rows[0],
        interviews: interviews.rows,
        follow_ups: followUps.rows,
        contacts: contacts.rows,
    });
});
server.registerTool("add_application", {
    title: "Add application",
    description: "Create a new job application. Returns the created row including its id.",
    inputSchema: {
        company: z.string().min(1).describe("Company name"),
        role: z.string().min(1).describe("Role / job title"),
        status: z
            .enum(STATUSES)
            .default("Saved")
            .describe("Initial status (default Saved)"),
        applied_date: z
            .string()
            .date()
            .optional()
            .describe("ISO date (YYYY-MM-DD); defaults to now"),
        notes: z.string().optional().describe("Free-form notes"),
    },
    annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
    },
}, async ({ company, role, status, applied_date, notes }) => {
    if (!scopedUserId)
        return writeScopeError();
    const applied = applied_date === undefined
        ? new Date()
        : new Date(`${applied_date}T12:00:00`);
    const { rows } = await pool.query(`insert into public.applications
         (user_id, company, role, status, applied_date, notes)
       values ($1, $2, $3, $4, $5, $6)
       returning *`, [scopedUserId, company, role, status, applied, notes ?? null]);
    return say(`Created application ${rows[0].id}\n${JSON.stringify(rows[0], null, 2)}`);
});
server.registerTool("set_application_status", {
    title: "Set application status",
    description: "Update one application's status. Returns not-found if the id is " +
        "unknown or out of scope — use list_applications to find valid ids. " +
        "Does not archive or unarchive.",
    inputSchema: {
        id: z.string().uuid().describe("Application id (from list_applications)"),
        status: z.enum(STATUSES).describe("New status"),
    },
    annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
    },
}, async ({ id, status }) => {
    if (!scopedUserId)
        return writeScopeError();
    const { rows, rowCount } = await pool.query(`update public.applications set status = $2
       where id = $1 and user_id = $3
       returning id, company, role, status, updated_at`, [id, status, scopedUserId]);
    if (rowCount === 0) {
        return fail(`Application ${id} not found. Use list_applications to get valid ids.`);
    }
    return say(`Application ${rows[0].id} (${rows[0].company} — ${rows[0].role}) is now "${rows[0].status}"`);
});
server.registerTool("list_follow_ups", {
    title: "List follow-ups",
    description: "List follow-ups with their application's company and role. Open items " +
        "first, soonest due date first. Use open_only=false to include done ones.",
    inputSchema: {
        open_only: z
            .boolean()
            .default(true)
            .describe("false also includes completed follow-ups"),
        limit: z
            .number()
            .int()
            .min(1)
            .max(100)
            .default(25)
            .describe("Max rows returned"),
    },
    annotations: { readOnlyHint: true, idempotentHint: true },
}, async ({ open_only, limit }) => {
    const { rows } = await pool.query(`select f.id, f.due_date, f.done, f.note,
              a.id as application_id, a.company, a.role, a.status
       from public.follow_ups f
       join public.applications a on a.id = f.application_id
       where ($1::uuid is null or f.user_id = $1)
         and ($2::boolean = false or f.done = false)
       order by f.done asc, f.due_date asc
       limit $3`, [scopeArg(), open_only, limit]);
    return ok(rows);
});
server.registerTool("complete_follow_up", {
    title: "Complete follow-up",
    description: "Mark a follow-up as done. Returns not-found if the id is unknown — " +
        "use list_follow_ups to find valid ids.",
    inputSchema: {
        id: z.string().uuid().describe("Follow-up id (from list_follow_ups)"),
    },
    annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
    },
}, async ({ id }) => {
    if (!scopedUserId)
        return writeScopeError();
    const { rows, rowCount } = await pool.query(`update public.follow_ups set done = true
       where id = $1 and user_id = $2
       returning id, note, due_date, done`, [id, scopedUserId]);
    if (rowCount === 0) {
        return fail(`Follow-up ${id} not found. Use list_follow_ups to get valid ids.`);
    }
    return say(`Follow-up ${rows[0].id} marked done${rows[0].note ? `: ${rows[0].note}` : ""}`);
});
server.registerTool("add_interview", {
    title: "Add interview",
    description: "Schedule an interview for an application. Returns the created row. " +
        "Does not change the application's status.",
    inputSchema: {
        application_id: z
            .string()
            .uuid()
            .describe("Application id (from list_applications)"),
        type: z.enum(INTERVIEW_TYPES).default("Other").describe("Interview type"),
        scheduled_at: z
            .string()
            .datetime({ offset: true })
            .describe("ISO 8601 datetime with timezone offset, e.g. 2026-09-30T14:00:00Z"),
        outcome: z
            .enum(OUTCOMES)
            .default("Pending")
            .describe("Outcome (default Pending until decided)"),
        notes: z.string().optional(),
    },
    annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
    },
}, async ({ application_id, type, scheduled_at, outcome, notes }) => {
    if (!scopedUserId)
        return writeScopeError();
    const owner = await pool.query(`select id from public.applications
       where id = $1 and user_id = $2`, [application_id, scopedUserId]);
    if (owner.rowCount === 0) {
        return fail(`Application ${application_id} not found. Use list_applications to get valid ids.`);
    }
    const { rows } = await pool.query(`insert into public.interviews
         (user_id, application_id, type, scheduled_at, outcome, notes)
       values ($1, $2, $3, $4, $5, $6)
       returning *`, [
        scopedUserId,
        application_id,
        type,
        scheduled_at,
        outcome,
        notes ?? null,
    ]);
    return say(`Scheduled interview ${rows[0].id}\n${JSON.stringify(rows[0], null, 2)}`);
});
server.registerTool("dashboard_summary", {
    title: "Dashboard summary",
    description: "Pipeline overview: application counts per status, open and overdue " +
        "follow-ups, upcoming interviews in the next 7 days, and the next " +
        "scheduled interview.",
    inputSchema: {},
    annotations: { readOnlyHint: true, idempotentHint: true },
}, async () => {
    const scope = scopeArg();
    const byStatus = await pool.query(`select status, count(*)::int as count
       from public.applications
       where ($1::uuid is null or user_id = $1)
       group by status order by status`, [scope]);
    const followUps = await pool.query(`select
         count(*) filter (where not done)::int as open,
         count(*) filter (where not done and due_date < date_trunc('day', now()))::int as overdue
       from public.follow_ups
       where ($1::uuid is null or user_id = $1)`, [scope]);
    const upcoming = await pool.query(`select i.id, i.scheduled_at, i.type, i.outcome,
              a.company, a.role
       from public.interviews i
       join public.applications a on a.id = i.application_id
       where ($1::uuid is null or i.user_id = $1)
         and i.scheduled_at >= now()
         and i.scheduled_at < now() + interval '7 days'
       order by i.scheduled_at asc`, [scope]);
    return ok({
        applications_by_status: Object.fromEntries(byStatus.rows.map((r) => [r.status, r.count])),
        follow_ups: followUps.rows[0],
        interviews_next_7_days: upcoming.rows,
    });
});
// ---- Run ----------------------------------------------------------------------
for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, async () => {
        await pool.end();
        process.exit(0);
    });
}
console.error(`jobtracker-mcp: ready (${userEmail ? `scoped to ${userEmail}` : "unscoped — writes disabled"})`);
await server.connect(new StdioServerTransport());
