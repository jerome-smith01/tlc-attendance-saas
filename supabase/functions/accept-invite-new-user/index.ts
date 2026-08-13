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
    const { token, password, firstName, lastInitial } = await req.json()

    if (!token || !password || !firstName?.trim() || !lastInitial?.trim()) {
      return new Response(JSON.stringify({ error: 'Missing required fields: token, password, first name, or last initial.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const trimmedFirstName = firstName.trim()
    const trimmedLastInitial = lastInitial.trim().charAt(0).toUpperCase()

    // Validate password rules (min 8 chars, 1 uppercase, 1 number or special char)
    const hasMinLength = password.length >= 8
    const hasUppercase = /[A-Z]/.test(password)
    const hasNumOrSpecial = /[0-9]/.test(password) || /[^A-Za-z0-9]/.test(password)

    if (!hasMinLength || !hasUppercase || !hasNumOrSpecial) {
      return new Response(JSON.stringify({ error: 'Password does not meet minimum security requirements (at least 8 characters, 1 uppercase letter, and 1 number or special character).' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Fetch & validate invite
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

    if (new Date(inviteData.expires_at) < new Date()) {
      await supabaseAdmin.from('pending_invites').delete().eq('id', inviteData.id)
      return new Response(JSON.stringify({ error: 'This invite has expired.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const normalizedEmail = inviteData.email.toLowerCase()

    // 2. Create the user in Auth
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password: password,
      email_confirm: true // Mark email confirmed automatically since they received the invite link
    })

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // 3. Link user to troop with onboarding_completed = true
    const { error: linkError } = await supabaseAdmin.from('troop_users').insert([{
      user_id: newUser.user.id,
      troop_id: inviteData.troop_id,
      role: inviteData.role,
      onboarding_completed: true
    }])

    if (linkError) {
      // Rollback user creation if troop_users insert fails
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
      return new Response(JSON.stringify({ error: linkError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // 4. Create roster entry for the new user
    const { error: rosterError } = await supabaseAdmin.from('roster').insert([{
      troop_id: inviteData.troop_id,
      user_id: newUser.user.id,
      email: normalizedEmail,
      first_name: trimmedFirstName,
      last_initial: trimmedLastInitial,
      role: inviteData.role
    }])

    if (rosterError) {
      // Rollback troop_users link and auth user if roster creation fails
      await supabaseAdmin.from('troop_users').delete().eq('user_id', newUser.user.id).eq('troop_id', inviteData.troop_id)
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
      return new Response(JSON.stringify({ error: rosterError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // 5. Delete the invite
    await supabaseAdmin.from('pending_invites').delete().eq('id', inviteData.id)

    return new Response(JSON.stringify({ success: true, email: normalizedEmail }), {
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
