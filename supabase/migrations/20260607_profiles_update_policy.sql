-- Allow users to update their own profile (name, avatar_url, frase)
create policy "profiles_update_own" on profiles for update
  using (auth.uid() = id);
