// Monthly summary emails. Same secrets as send-reminders (CRON_SECRET, SMTP_*).
import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.14";

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const money = (n: unknown, cur?: string) => `${Number(n ?? 0).toLocaleString("en-US", { maximumFractionDigits: 0 })} ${cur ?? ""}`.trim();

Deno.serve(async (req) => {
  const secret = Deno.env.get("CRON_SECRET");
  if (!secret || req.headers.get("x-cron-secret") !== secret) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }
  const host = Deno.env.get("SMTP_HOST"), user = Deno.env.get("SMTP_USER"), pass = Deno.env.get("SMTP_PASS");
  if (!host || !user || !pass) return new Response(JSON.stringify({ error: "SMTP secrets not set" }), { status: 500 });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data, error } = await admin.rpc("monthly_summary_digest");
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  const port = Number(Deno.env.get("SMTP_PORT") ?? 465);
  const transport = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
  const from = Deno.env.get("SMTP_FROM") ?? user;
  const siteUrl = Deno.env.get("SITE_URL") ?? "";

  let sent = 0;
  const failed: string[] = [];
  for (const r of data ?? []) {
    const left = Number(r.income) - Number(r.expense);
    const change = r.prev_expense > 0 ? Math.round(((r.expense - r.prev_expense) / r.prev_expense) * 100) : null;
    const html = `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto">
      <h2>${esc(r.month_label)} ka hisaab${r.workspace_name ? ` — ${esc(r.workspace_name)}` : ""}</h2>
      <p>Is mahine kharch <b>${esc(money(r.expense, r.currency))}</b>, ${left >= 0 ? "bacha" : "kami"} <b>${esc(money(Math.abs(left), r.currency))}</b>, sabse zyada <b>${esc(r.top_category)}</b> par (${esc(money(r.top_amount, r.currency))}).</p>
      <p>Aamdani: ${esc(money(r.income, r.currency))}${change !== null ? ` · Pichle mahine se kharch ${change >= 0 ? "+" : ""}${change}%` : ""}</p>
      ${siteUrl ? `<p><a href="${esc(siteUrl)}">App kholo</a></p>` : ""}
      <p style="color:#888;font-size:12px">Band karne ke liye App → Preferences → Reminders (email).</p></div>`;
    try {
      await transport.sendMail({ from: `Expense Tracker <${from}>`, to: r.email, subject: `${r.month_label}: kharch ${money(r.expense, r.currency)}`, html });
      sent++;
    } catch (e) { failed.push(`${r.email}: ${(e as Error).message}`); }
  }
  return new Response(JSON.stringify({ rows: data?.length ?? 0, sent, failed }), { headers: { "Content-Type": "application/json" } });
});
