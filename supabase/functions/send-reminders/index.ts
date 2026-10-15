// Daily reminder emails (bills due, budgets at threshold, loans due).
// Invoked by a scheduler with header  x-cron-secret: <CRON_SECRET>.
//
// Required secrets (Supabase -> Edge Functions -> Secrets):
//   CRON_SECRET   any long random string (same value the scheduler sends)
//   SMTP_HOST     e.g. smtp.gmail.com
//   SMTP_PORT     e.g. 465
//   SMTP_USER     e.g. yourname@gmail.com
//   SMTP_PASS     Gmail app password (no spaces)
//   SMTP_FROM     optional, defaults to SMTP_USER
//   SITE_URL      optional, link inside the email
import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.14";

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

const money = (n: unknown, cur?: string) => `${Number(n ?? 0).toLocaleString("en-US", { maximumFractionDigits: 2 })} ${cur ?? ""}`.trim();

const when = (days: number) =>
  days < 0 ? `${Math.abs(days)} din se late` : days === 0 ? "aaj" : `${days} din mein`;

function render(name: string | null, items: any[], siteUrl: string) {
  const lines = items.map((it) => {
    if (it.kind === "bill") return `<li><b>${esc(it.title)}</b> — ${esc(money(it.amount, it.currency))} due ${when(it.days)}</li>`;
    if (it.kind === "loan_to_collect") return `<li>Udhaar wapsi: <b>${esc(it.title)}</b> se ${esc(money(it.amount, it.currency))} — ${when(it.days)}</li>`;
    if (it.kind === "loan_to_pay") return `<li>Udhaar dena hai: <b>${esc(it.title)}</b> ko ${esc(money(it.amount, it.currency))} — ${when(it.days)}</li>`;
    if (it.kind === "budget") return `<li>Budget <b>${esc(it.title)}</b>: ${esc(it.percent)}% use ho gaya (${esc(money(it.amount, it.currency))} / ${esc(money(it.limit, it.currency))})</li>`;
    return "";
  });
  return `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto">
    <h2>Assalam o Alaikum${name ? ` ${esc(name)}` : ""} 👋</h2>
    <p>Aaj ke reminders:</p><ul>${lines.join("")}</ul>
    ${siteUrl ? `<p><a href="${esc(siteUrl)}">App kholo</a></p>` : ""}
    <p style="color:#888;font-size:12px">Yeh emails band karne ke liye App → Preferences → Reminders.</p></div>`;
}

Deno.serve(async (req) => {
  const secret = Deno.env.get("CRON_SECRET");
  if (!secret || req.headers.get("x-cron-secret") !== secret) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }
  const host = Deno.env.get("SMTP_HOST"), user = Deno.env.get("SMTP_USER"), pass = Deno.env.get("SMTP_PASS");
  if (!host || !user || !pass) {
    return new Response(JSON.stringify({ error: "SMTP secrets not set" }), { status: 500 });
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data, error } = await admin.rpc("reminder_digest");
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  const port = Number(Deno.env.get("SMTP_PORT") ?? 465);
  const transport = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
  const from = Deno.env.get("SMTP_FROM") ?? user;
  const siteUrl = Deno.env.get("SITE_URL") ?? "";

  let sent = 0;
  const failed: string[] = [];
  for (const row of data ?? []) {
    try {
      await transport.sendMail({
        from: `Expense Tracker <${from}>`,
        to: row.email,
        subject: `Reminder: ${row.items.length} cheez${row.items.length > 1 ? "ain" : ""} dhyan talab`,
        html: render(row.full_name, row.items, siteUrl),
      });
      sent++;
    } catch (e) {
      failed.push(`${row.email}: ${(e as Error).message}`);
    }
  }
  return new Response(JSON.stringify({ users: data?.length ?? 0, sent, failed }), {
    headers: { "Content-Type": "application/json" },
  });
});
