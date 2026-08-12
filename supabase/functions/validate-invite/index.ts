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
    const url = new URL(req.url)
    const token = url.searchParams.get('token')

    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing invite token' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Service role client to bypass RLS on pending_invites and read troop name
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Fetch pending invite with troop details
    const { data: inviteData, error: inviteError } = await supabaseAdmin
      .from('pending_invites')
      .select('id, email, account_exists, expires_at, troops(troop_number, city)')
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
      return new Response(JSON.stringify({ error: 'This invite has expired. Please ask a troop admin for a new invite.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const troopDetails = inviteData.troops || {};
    const troopDisplay = troopDetails.troop_number 
      ? `Troop ${troopDetails.troop_number} (${troopDetails.city || 'Unknown'})` 
      : 'a Troop';

    return new Response(JSON.stringify({
      email: inviteData.email,
      accountExists: inviteData.account_exists,
      troopName: troopDisplay
    }), {
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
