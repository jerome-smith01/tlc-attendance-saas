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
      await supabaseAdmin.from('pending_invites').delete().eq('id', inviteData.id)
      return new Response(JSON.stringify({ error: 'This invite has expired.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // 3. Normalized email comparison
    const loggedInEmail = (user.email || '').trim().toLowerCase()
    const invitedEmail = (inviteData.email || '').trim().toLowerCase()

    if (loggedInEmail !== invitedEmail) {
      return new Response(JSON.stringify({
        error: `You are signed in as ${user.email}, but this invite was sent to ${inviteData.email}.`,
        emailMismatch: true,
        loggedInEmail: user.email,
        invitedEmail: inviteData.email
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    // 4. Check if user already has a roster entry in any troop or user_metadata to reuse their name
    const { data: existingRoster } = await supabaseAdmin
      .from('roster')
      .select('first_name, last_initial')
      .or(`user_id.eq.${user.id},email.eq.${invitedEmail}`)
      .not('first_name', 'is', null)
      .limit(1)
      .maybeSingle()

    let firstNameToUse = existingRoster?.first_name || user.user_metadata?.first_name || user.user_metadata?.given_name || ''
    let lastInitialToUse = existingRoster?.last_initial || user.user_metadata?.last_initial || user.user_metadata?.last_name || user.user_metadata?.family_name || ''

    if (!firstNameToUse && (user.user_metadata?.full_name || user.user_metadata?.name)) {
      const fullName = (user.user_metadata.full_name || user.user_metadata.name).trim()
      const parts = fullName.split(/\s+/)
      if (parts.length > 0) firstNameToUse = parts[0]
      if (parts.length > 1 && !lastInitialToUse) lastInitialToUse = parts[parts.length - 1].charAt(0).toUpperCase()
    }

    const hasName = !!(firstNameToUse && lastInitialToUse)

    // 5. Insert into troop_users
    const { error: linkError } = await supabaseAdmin.from('troop_users').insert([{
      user_id: user.id,
      troop_id: inviteData.troop_id,
      role: inviteData.role,
      onboarding_completed: hasName
    }])

    if (linkError) {
      if (linkError.code === '23505') {
        // Unique constraint violation (already in troop)
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

    // 6. Link or create roster entry for this troop
    const { data: rosterEntries } = await supabaseAdmin
      .from('roster')
      .select('id')
      .eq('troop_id', inviteData.troop_id)
      .or(`user_id.eq.${user.id},email.eq.${invitedEmail}`)
      .limit(1)

    const targetRoster = rosterEntries && rosterEntries.length > 0 ? rosterEntries[0] : null

    if (targetRoster) {
      // Link existing roster record to user_id and sync name if available
      const updateData: any = { user_id: user.id }
      if (firstNameToUse) updateData.first_name = firstNameToUse
      if (lastInitialToUse) updateData.last_initial = lastInitialToUse
      await supabaseAdmin.from('roster').update(updateData).eq('id', targetRoster.id)
    } else {
      // Create new roster entry pre-filled with user's name
      await supabaseAdmin.from('roster').insert([{
        troop_id: inviteData.troop_id,
        user_id: user.id,
        email: invitedEmail,
        first_name: firstNameToUse || null,
        last_initial: lastInitialToUse || null,
        role: inviteData.role
      }])
    }

    // 7. Delete the invite
    await supabaseAdmin.from('pending_invites').delete().eq('id', inviteData.id)

    return new Response(JSON.stringify({ success: true, message: 'Invite accepted successfully!', troop_id: inviteData.troop_id }), {
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
