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
      return new Response(JSON.stringify({ error: 'Unauthorized. Please log in first.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const { token } = await req.json()

    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing invite token' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Initialize Service Role client to query pending_invites (which has no RLS policies for users)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Validate token
    const { data: inviteData, error: inviteError } = await supabaseAdmin
      .from('pending_invites')
      .select('*')
      .eq('token', token)
      .single()

    if (inviteError || !inviteData) {
      return new Response(JSON.stringify({ error: 'This invite is no longer valid or has already been accepted.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // 2. Check expiration
    if (new Date(inviteData.expires_at) < new Date()) {
      // Clean it up
      await supabaseAdmin.from('pending_invites').delete().eq('id', inviteData.id)
      return new Response(JSON.stringify({ error: 'This invite has expired.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // 3. Ensure the logged in user's email matches the invited email
    if (user.email !== inviteData.email) {
      return new Response(JSON.stringify({ error: 'This invite was sent to a different email address.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    // 4. Insert into troop_users
    const { error: linkError } = await supabaseAdmin.from('troop_users').insert([{
      user_id: user.id,
      troop_id: inviteData.troop_id,
      role: inviteData.role
    }])

    if (linkError) {
      if (linkError.code === '23505') {
        // Unique constraint violation (already in troop)
        // Cleanup the invite anyway
        await supabaseAdmin.from('pending_invites').delete().eq('id', inviteData.id)
        return new Response(JSON.stringify({ error: 'You are already a member of this troop.' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        })
      }
      return new Response(JSON.stringify({ error: linkError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // 5. Delete the invite
    await supabaseAdmin.from('pending_invites').delete().eq('id', inviteData.id)

    return new Response(JSON.stringify({ success: true, message: 'Invite accepted successfully!' }), {
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
