import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function isAllowedOrigin(hostname: string): boolean {
  if (!hostname) return false;
  const lower = hostname.toLowerCase();
  return (
    lower === 'localhost' ||
    lower === '127.0.0.1' ||
    lower === 'goodplusfast.com' ||
    lower.endsWith('.goodplusfast.com')
  );
}

function resolveAppUrl(
  siteUrl?: string,
  req?: Request,
  envAppSiteUrl?: string,
  defaultFallback = 'http://localhost:5173'
): string {
  const candidates = [
    siteUrl,
    req?.headers.get('origin') ?? undefined,
    req?.headers.get('referer') ?? undefined,
    envAppSiteUrl
  ];

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'string' || candidate === 'null') continue;
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        continue;
      }
      if (!isAllowedOrigin(parsed.hostname)) {
        continue;
      }
      return parsed.origin;
    } catch (_) {
      // ignore invalid URL candidate
    }
  }

  return defaultFallback;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Get the JWT of the caller
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const { email, role, troop_id, site_url } = await req.json()

    if (!email || !role || !troop_id) {
      return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Security Check: Is the caller a global_admin?
    const { data: globalAdmin } = await supabaseClient
      .from('global_admins')
      .select('id')
      .eq('user_id', user.id)
      .single()

    let hasPermission = !!globalAdmin;

    // Security Check: Is the caller a troop_admin or billing_admin for this troop?
    if (!hasPermission) {
      const { data: troopUser } = await supabaseClient
        .from('troop_users')
        .select('role')
        .eq('user_id', user.id)
        .eq('troop_id', troop_id)
        .single()
        
      if (troopUser && (troopUser.role === 'roster_manager' || troopUser.role === 'troop_admin')) {
        hasPermission = true;
      }
    }

    if (!hasPermission) {
      return new Response(JSON.stringify({ error: 'Forbidden: Insufficient permissions' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    // Initialize Service Role client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const appUrl = resolveAppUrl(site_url, req, Deno.env.get('APP_SITE_URL'))
    const normalizedEmail = email.trim().toLowerCase()

    // 1. Check if user already exists in auth.users using secure RPC
    const { data: accountExists, error: rpcError } = await supabaseAdmin
      .rpc('check_email_exists', { target_email: normalizedEmail })

    if (rpcError) {
      console.error('RPC check_email_exists error:', rpcError);
    }

    const isExistingUser = !!accountExists;

    // 2. Fail early if they are already in roster for this troop
    const { data: existingRoster } = await supabaseAdmin
      .from('roster')
      .select('id')
      .eq('troop_id', troop_id)
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existingRoster) {
      return new Response(JSON.stringify({ error: 'This person is already a member of this troop roster.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 409,
      })
    }

    // 2b. Fail early if an invitation has already been sent to this email address
    const { data: existingInvite } = await supabaseAdmin
      .from('pending_invites')
      .select('id')
      .eq('troop_id', troop_id)
      .eq('email', normalizedEmail)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (existingInvite) {
      return new Response(JSON.stringify({ error: 'An invitation has already been sent to this email address.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 409,
      })
    }

    // 3. UPSERT pending invite (handles double-clicks & refreshes token)
    const { data: pendingData, error: pendingError } = await supabaseAdmin
      .from('pending_invites')
      .upsert({
        email: normalizedEmail,
        troop_id: troop_id,
        role: role,
        invited_by: user.id,
        account_exists: isExistingUser,
        token: crypto.randomUUID(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      }, { onConflict: 'email,troop_id' })
      .select('token')
      .single()

    if (pendingError) {
      return new Response(JSON.stringify({ error: pendingError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const inviteToken = pendingData.token;
    const acceptUrl = `${appUrl}/#/accept-invite?token=${inviteToken}`

    // 4. Send email via Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const resendFrom = Deno.env.get('RESEND_FROM_EMAIL');

    if (!resendApiKey || !resendFrom) {
      return new Response(JSON.stringify({ error: 'Email configuration is missing on the server.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: `TLC Attendance <${resendFrom}>`,
        to: [normalizedEmail],
        subject: 'You have been invited to a Troop on TLC Attendance',
        html: `
          <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
            <h2 style="color: #0284c7;">You're invited!</h2>
            <p>You have been invited to join a troop on TLC Attendance as a <strong>${role === 'troop_admin' ? 'Troop Admin' : role === 'roster_manager' ? 'Roster Manager' : 'Badge Scanner'}</strong>.</p>
            <p>Click the button below to accept the invitation and access your troop dashboard.</p>
            <div style="margin: 30px 0;">
              <a href="${acceptUrl}" style="background-color: #0284c7; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Accept Invitation</a>
            </div>
            <p style="color: #4b5563; font-size: 13px; line-height: 1.5; margin-top: 20px;">
              If the button above does not work, copy and paste this link into your browser:<br/>
              <a href="${acceptUrl}" style="color: #0284c7; word-break: break-all;">${acceptUrl}</a>
            </p>
            <p style="color: #666; font-size: 14px;">If you didn't expect this invitation, you can ignore this email.</p>
          </div>
        `
      })
    });

    if (!resendRes.ok) {
      const resendError = await resendRes.text();
      console.error('Resend error:', resendError);
      return new Response(JSON.stringify({ error: 'Failed to send invite email.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    return new Response(JSON.stringify({ success: true, message: 'Invite email sent successfully.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
