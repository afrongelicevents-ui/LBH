-- Staff invited from the Admin Portal ended up as "client" profiles.
--
-- handle_new_user() reads the role from app_metadata when the auth user is
-- INSERTED, but Supabase's admin createUser() writes custom app_metadata in
-- a follow-up UPDATE, so the profile was created before the role existed.
-- Result: invited admins, field agents and lawyers were treated as clients.
--
-- Fix: keep profiles.role / staff_kind in step with app_metadata whenever the
-- role there changes. app_metadata can only be written with the service
-- role (never by the user), so this cannot be used to gain rights.

create or replace function public.sync_role_from_app_metadata()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_role public.user_role;
begin
  if (new.raw_app_meta_data->>'role') is distinct from (old.raw_app_meta_data->>'role')
     or (new.raw_app_meta_data->>'staff_kind') is distinct from (old.raw_app_meta_data->>'staff_kind') then
    v_role := coalesce((new.raw_app_meta_data->>'role')::public.user_role, 'client');
    update public.profiles
       set role = v_role,
           staff_kind = case
             when v_role = 'field' and new.raw_app_meta_data->>'staff_kind' = 'lawyer' then 'lawyer'
             when v_role = 'field' then 'field_agent'
             else null
           end
     where id = new.id;
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_role_changed on auth.users;
create trigger on_auth_user_role_changed
  after update of raw_app_meta_data on auth.users
  for each row execute function public.sync_role_from_app_metadata();

-- Repair anyone already affected (role set in app_metadata, profile still client).
update public.profiles p
   set role = (u.raw_app_meta_data->>'role')::public.user_role,
       staff_kind = case
         when u.raw_app_meta_data->>'role' = 'field' and u.raw_app_meta_data->>'staff_kind' = 'lawyer' then 'lawyer'
         when u.raw_app_meta_data->>'role' = 'field' then 'field_agent'
         else null
       end
  from auth.users u
 where u.id = p.id
   and u.raw_app_meta_data->>'role' in ('admin', 'field')
   and p.role::text is distinct from u.raw_app_meta_data->>'role';
