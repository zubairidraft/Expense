Deploy:  supabase functions deploy send-workspace-invite
Secrets: supabase secrets set SITE_URL=https://your-app-domain   (optional; fallback = siteUrl sent by the app)
Auth:    JWT verification stays ON (default).
Also add the app URL to Supabase Auth > URL Configuration > Redirect URLs.
