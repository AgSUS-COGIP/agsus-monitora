-- current_profile has no identity parameter and only returns the caller's active profile.
revoke all on function private.current_profile() from public,anon;
grant execute on function private.current_profile() to authenticated;
notify pgrst,'reload schema';
