-- One-time bootstrap: creates the first admin login so the admin panel has
-- *someone* who can sign in and invite everyone else through the normal UI
-- (once app/(dashboard)/admins is built — see docs/blueprint.html §07/§08).
--
-- This writes directly into auth.users/auth.identities rather than going
-- through the Supabase Auth REST API. That's not the normal way to create a
-- user — GoTrue's signUp endpoint is — but this sandbox's network policy
-- can't reach *.supabase.co directly, and this is the documented pattern
-- Supabase itself ships in local-dev seed scripts for exactly this
-- situation. It only ever needs to run once.
--
-- Temporary password: 0R3PtQKLBdzudxhR!7 — change it after first login
-- (Supabase Auth's password-reset flow, once the app has one, or via the
-- Supabase dashboard in the meantime).
do $$
declare
  new_user_id uuid := gen_random_uuid();
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000',
    new_user_id,
    'authenticated',
    'authenticated',
    'muhamad.itani@gmail.com',
    crypt('0R3PtQKLBdzudxhR!7', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    '', ''
  );

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(),
    new_user_id,
    new_user_id::text,
    jsonb_build_object('sub', new_user_id::text, 'email', 'muhamad.itani@gmail.com'),
    'email',
    now(), now(), now()
  );

  insert into admin_users (auth_user_id, full_name, email, role_id, status)
  values (
    new_user_id,
    'Mohamad',
    'muhamad.itani@gmail.com',
    (select id from admin_roles where name = 'Super Admin'),
    'active'
  );
end $$;
