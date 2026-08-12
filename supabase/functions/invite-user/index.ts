import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const { email, role, troop_id } = await req.json()

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
        
      if (troopUser && (troopUser.role === 'troop_admin' || troopUser.role === 'billing_admin')) {
        hasPermission = true;
      }
    }

    if (!hasPermission) {
      return new Response(JSON.stringify({ error: 'Forbidden: Insufficient permissions' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    // Now initialize a Service Role client to bypass RLS and use Admin Auth API
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const appUrl = Deno.env.get('APP_SITE_URL') ?? 'http://localhost:5173'
    const normalizedEmail = email.trim().toLowerCase()

    // 1. Check if the user already exists in auth.users
    // listUsers is paginated, but we can search by email
    // Or we can just try to invite, but we can't reliably know if it failed because it exists.
    // Actually, listUsers requires a search query, but it's not exact match.
    // But we can get a user by email in the auth api? No, `admin.getUserById` exists, not by email.
    // But we can just query the `users` table via rpc or listUsers. Wait, edge functions can't query auth.users directly without sql.
    // Let's use `admin.listUsers()` and filter. But since we might have many users, this could be bad.
    // A better way is: just call inviteUserByEmail. If it fails with "already registered", catch it and handle as existing user.
    // Let's try that, but the error message from Supabase is "A user with this email address has already been registered" (status 400).
    
    // Wait, let's use listUsers with the email as a query? 
    // supabaseAdmin.auth.admin.listUsers() doesn't support query in standard js client sometimes, but actually we can just look up in `roster` or `troop_users`? No, they might be in another troop.
    
    let isExistingUser = false;
    let existingUserId = null;

    // We can actually just call inviteUserByEmail. If it fails with already registered, we handle it.
    let inviteData = null;
    let newUserId = null;

    const { data: inviteRes, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      normalizedEmail,
      { redirectTo: `${appUrl}` } // PKCE root redirect
    )

    if (inviteError) {
      if (inviteError.message.includes('already been registered')) {
        isExistingUser = true;
      } else {
        return new Response(JSON.stringify({ error: inviteError.message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        })
      }
    } else {
      inviteData = inviteRes;
      newUserId = inviteData.user.id;
    }

    if (!isExistingUser) {
      // BRANCH 1: Brand New User
      // Link them to the troop in troop_users
      const { error: linkError } = await supabaseAdmin.from('troop_users').insert([{
        user_id: newUserId,
        troop_id: troop_id,
        role: role
      }])

      if (linkError) {
        // Rollback orphaned user
        await supabaseAdmin.auth.admin.deleteUser(newUserId);
        
        return new Response(JSON.stringify({ error: linkError.message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        })
      }

      return new Response(JSON.stringify({ success: true, message: 'User invited successfully' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    } 
    
    // BRANCH 2 & 3: Existing User
    // Find their user_id. We can query `roster` or we have to use listUsers if they are in another troop but not in roster.
    // Actually, `roster` only has them if they were fully added. What if they only exist in `auth.users`?
    // Let's use listUsers and find them. (Supabase SDK doesn't have an exact email lookup, so we paginate or filter).
    // Actually, listUsers doesn't scale if we have millions of users. 
    // Let's use `listUsers` because it does have an undocumented/rarely used search param, or we just fetch page 1 since it's an edge case?
    // No, Deno Supabase client `listUsers` doesn't let us query easily without scanning.
    // Wait, `auth.admin.generateLink` can generate an invite link for an existing user? No.
    // If the user already exists, we MUST get their UUID to see if they are in THIS troop. But actually, we don't need their UUID to insert into `pending_invites`! `pending_invites` just uses the email.
    // So we don't need their user_id right now.
    // But we DO need to check if they are already in THIS troop. We can't query `troop_users` by email.
    // Let's query `roster`? Or wait, can we just insert into `pending_invites`, and when they accept it, it will fail the unique constraint on `troop_users` if they are already in it? Yes.
    // But we want to fail EARLY if they are already in the troop.
    // To do that, we need their user_id.
    // Let's fetch it via a database RPC, or by querying a secure view, or we can just fetch via listUsers.
    // Actually, the simplest way to get a user by email in Edge Functions is:
    const { data: usersPage } = await supabaseAdmin.auth.admin.listUsers();
    // This only returns the first 50 users. This is a known Supabase limitation.
    // Instead of relying on listUsers, we can just look up `roster.email` or `roster` where `email = normalizedEmail`.
    // Wait, what if we just try to insert into `pending_invites` and let the accept flow handle the "already in troop" error?
    // If we want to fail early, we can check `roster`.
    const { data: existingRoster } = await supabaseAdmin
      .from('roster')
      .select('id, user_id')
      .eq('troop_id', troop_id)
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existingRoster && existingRoster.user_id) {
      // They are already in this troop's roster
      return new Response(JSON.stringify({ error: 'This person is already a member of this troop.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 409,
      })
    }

    // Since they might be in troop_users but not roster, the accept flow will still catch it if so.

    // 1. Delete any stale pending invite for this email/troop
    await supabaseAdmin
      .from('pending_invites')
      .delete()
      .eq('email', normalizedEmail)
      .eq('troop_id', troop_id)

    // 2. Insert new pending invite
    const { data: pendingData, error: pendingError } = await supabaseAdmin
      .from('pending_invites')
      .insert([{
        email: normalizedEmail,
        troop_id: troop_id,
        role: role,
        invited_by: user.id
      }])
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

    // 3. Send email via Resend
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
          <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
            <h2>You're invited!</h2>
            <p>You have been invited to join a new troop on TLC Attendance.</p>
            <p>Click the button below to accept the invitation and access your new troop dashboard.</p>
            <div style="margin: 30px 0;">
              <a href="${acceptUrl}" style="background-color: #0284c7; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Accept Invitation</a>
            </div>
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
