-- Removing a device signs out only that device.
-- Each device row remembers the sign-in session that registered it; removing the device
-- ends that session, so it cannot quietly re-register. Other devices stay signed in.
-- Backward compatible: rows registered before this migration get their session the next
-- time that device opens the app.

alter table public.devices add column if not exists session_id uuid;

-- Customers may rename their devices; everything else is set by the functions below.
revoke update on public.devices from anon, authenticated;
grant update (nickname) on public.devices to authenticated;

create or replace function public.current_session_id()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'session_id', '')::uuid
$$;

create or replace function public.register_device(p_token_hash text, p_nickname text, p_description text default null)
returns public.devices
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_session uuid := public.current_session_id();
  v_existing public.devices;
  v_count integer;
  v_limit integer;
  v_result public.devices;
  v_nick text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_token_hash is null or length(p_token_hash) < 32 then
    raise exception 'Invalid device token';
  end if;

  -- A device that was removed keeps a valid access token for up to an hour; it must sign in again.
  if v_session is not null and not exists (select 1 from auth.sessions where id = v_session) then
    raise exception 'SESSION_ENDED' using errcode = 'P0001';
  end if;

  v_nick := left(trim(coalesce(p_nickname, '')), 40);
  if v_nick = '' then
    v_nick := 'My Device';
  end if;

  select * into v_existing
  from public.devices
  where user_id = v_user_id
    and device_token_hash = p_token_hash;

  if found then
    update public.devices
      set last_seen_at = now(),
          device_description = coalesce(nullif(p_description, ''), device_description),
          nickname = case when v_nick = 'My Device' then nickname else v_nick end,
          session_id = coalesce(v_session, session_id)
      where id = v_existing.id
      returning * into v_result;
    return v_result;
  end if;

  select device_limit into v_limit from public.profiles where id = v_user_id;
  select count(*) into v_count from public.devices where user_id = v_user_id;

  if v_count >= coalesce(v_limit, 0) and not public.is_owner() then
    raise exception 'DEVICE_LIMIT_REACHED'
      using errcode = 'P0001',
            hint = 'Remove one of your existing devices to continue.';
  end if;

  insert into public.devices (user_id, device_token_hash, nickname, device_description, session_id)
  values (v_user_id, p_token_hash, v_nick, p_description, v_session)
  returning * into v_result;

  return v_result;
end;
$$;

grant execute on function public.register_device(text, text, text) to authenticated;

create or replace function public.remove_device(p_device_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_device public.devices;
  v_signed_out boolean := false;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.devices
  where id = p_device_id and user_id = v_user_id
  returning * into v_device;

  if not found then
    return jsonb_build_object('removed', false, 'signed_out', false);
  end if;

  -- Never end the session this request is using, or one another registered device still uses.
  if v_device.session_id is not null
     and v_device.session_id is distinct from public.current_session_id()
     and not exists (select 1 from public.devices where user_id = v_user_id and session_id = v_device.session_id) then
    delete from auth.sessions where id = v_device.session_id and user_id = v_user_id;
    v_signed_out := found;
  end if;

  return jsonb_build_object('removed', true, 'signed_out', v_signed_out);
end;
$$;

revoke all on function public.remove_device(uuid) from public, anon;
grant execute on function public.remove_device(uuid) to authenticated;
