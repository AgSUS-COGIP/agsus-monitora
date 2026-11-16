/*
  ROLLBACK de 20261116234000_historico_do_edital_ignora_so_carimbo: volta public.fn_registrar_historico
  ao corpo de 16/11/2026 (copiado do banco com pg_get_functiondef), que grava histórico a cada
  UPDATE em que qualquer coluna mudou, e tira o comentário (a função não tinha).

  Dado não se desfaz: o histórico que deixou de ser gravado enquanto a migration valia não volta.
*/
begin;

set local lock_timeout = '5s';

do $guarda$
begin
  if position('20261116234000' in coalesce((select prosrc from pg_proc where oid = to_regprocedure('public.fn_registrar_historico()')), '')) = 0 then
    raise exception 'fn_registrar_historico não tem o corpo de 20261116234000: a migration não está aplicada, nada a desfazer.';
  end if;
end;
$guarda$;

CREATE OR REPLACE FUNCTION public.fn_registrar_historico()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
declare
  v_usuario_id    uuid;
  v_usuario_email text;
  v_evento        text;
begin
  v_usuario_id := auth.uid();

  if v_usuario_id is not null then
    select u.email
      into v_usuario_email
    from auth.users u
    where u.id = v_usuario_id
    limit 1;
  end if;

  if TG_OP = 'INSERT' then
    v_evento := 'criado';

    insert into public."TH_MONITORAMENTO"
      (id_registro, usuario_id, usuario_email, evento, snapshot_json)
    values
      (NEW.id, v_usuario_id, v_usuario_email, v_evento, to_jsonb(NEW));

  elsif TG_OP = 'UPDATE' then
    if OLD is distinct from NEW then
      v_evento := case
        when NEW.ativo = false and OLD.ativo = true then 'desativado'
        else 'atualizado'
      end;

      insert into public."TH_MONITORAMENTO"
        (id_registro, usuario_id, usuario_email, evento, snapshot_json)
      values
        (NEW.id, v_usuario_id, v_usuario_email, v_evento, to_jsonb(NEW));
    end if;
  end if;

  return NEW;
end;
$function$;

comment on function public.fn_registrar_historico() is null;

do $confere$
begin
  if md5(replace((select prosrc from pg_proc where oid = to_regprocedure('public.fn_registrar_historico()')), chr(13), ''))
       is distinct from '3a95b60de55006aac09a8d0169d68244' then
    raise exception 'O corpo restaurado não bate com o de 16/11/2026 (md5).';
  end if;
end;
$confere$;

commit;
