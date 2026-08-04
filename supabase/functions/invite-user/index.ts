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

    // 1. Invite the user
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email)

    if (inviteError) {
      return new Response(JSON.stringify({ error: inviteError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const newUserId = inviteData.user.id

    // 2. Link them to the troop in troop_users
    const { error: linkError } = await supabaseAdmin.from('troop_users').insert([{
      user_id: newUserId,
      troop_id: troop_id,
      role: role
    }])

    if (linkError) {
      // If linking fails (e.g. they are already in the troop), we return an error but the invite was already sent
      return new Response(JSON.stringify({ error: linkError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    return new Response(JSON.stringify({ success: true, message: 'User invited successfully' }), {
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
