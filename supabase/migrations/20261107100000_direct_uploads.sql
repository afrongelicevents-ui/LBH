-- Direct uploads: the browser uploads to a private "incoming" bucket using a
-- one-time signed URL; the server then claims, checks and moves the file.
-- No storage policies are added: only signed URLs and the service role can
-- touch these objects.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'incoming', 'incoming', false, 52428800,
  array['image/jpeg','image/png','image/webp','application/pdf',
        'video/mp4','video/quicktime','video/webm']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
