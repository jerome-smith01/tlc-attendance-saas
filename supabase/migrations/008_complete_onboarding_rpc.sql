CREATE OR REPLACE FUNCTION complete_user_onboarding()
RETURNS void AS $$
BEGIN
  UPDATE troop_users
  SET onboarding_completed = true
  WHERE user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;