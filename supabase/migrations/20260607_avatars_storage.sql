-- Create avatars bucket as public (idempotent)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

-- Allow anyone to read avatars (public profile pictures)
create policy "avatars_public_read" on storage.objects
  for select using (bucket_id = 'avatars');
