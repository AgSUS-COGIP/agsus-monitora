/*
  ENSAIO de 20261116234000_historico_do_edital_ignora_so_carimbo: aplica a migration, confere e
  termina em rollback (não grava nada).

  Confere, num edital ativo:
    - UPDATE só de updated_at e DT_FONTE_FUNIL não grava histórico;
    - UPDATE de conteúdo (observacoes) grava um registro, com a foto inteira;
    - desativar grava 'desativado';
  e, rodando private."FC_ATUALIZAR_KPIS_PELA_SELECAO"() de verdade, que todo registro novo tem
  mudança de conteúdo (nenhum só de carimbo).
*/
begin;

set local lock_timeout = '5s';

do $guarda$
begin
  if md5(replace((select prosrc from pg_proc where oid = to_regprocedure('public.fn_registrar_historico()')), chr(13), ''))
       is distinct from '3a95b60de55006aac09a8d0169d68244' then
    raise exception 'fn_registrar_historico: o corpo no banco não é o de 16/11/2026 (md5). Já aplicada, ou alguém mudou: junte as mudanças antes.';
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
    -- Só o carimbo mudou (updated_at, updated_by e a data da fonte do funil, que a carga da
    -- Seleção renova sem mudar número): não é mudança, não vai para o histórico
    -- (20261116234000).
    if (to_jsonb(OLD) - array['updated_at', 'updated_by', 'DT_FONTE_FUNIL'])
       is distinct from
       (to_jsonb(NEW) - array['updated_at', 'updated_by', 'DT_FONTE_FUNIL']) then
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

comment on function public.fn_registrar_historico() is
  'Gatilho trg_historico_monitoramento: grava a foto do edital (to_jsonb(NEW)) em TH_MONITORAMENTO no INSERT e no UPDATE que muda conteúdo. O UPDATE que só muda updated_at, updated_by e DT_FONTE_FUNIL não grava (20261116234000).';


do $ensaio$
declare
  v_id uuid;
  v_antes integer;
  v_depois integer;
  v_editais integer;
  v_carimbo integer;
begin
  select m.id into v_id from public."TB_MONITORAMENTO_INDIGENA" m
   where m.ativo order by m.updated_at desc limit 1;

  select count(*) into v_antes from public."TH_MONITORAMENTO" where id_registro = v_id;
  update public."TB_MONITORAMENTO_INDIGENA"
     set updated_at = now() + interval '1 second', "DT_FONTE_FUNIL" = now()
   where id = v_id;
  select count(*) into v_depois from public."TH_MONITORAMENTO" where id_registro = v_id;
  if v_depois <> v_antes then
    raise exception 'Mudança só de carimbo gravou histórico (% → %).', v_antes, v_depois;
  end if;

  update public."TB_MONITORAMENTO_INDIGENA"
     set observacoes = coalesce(observacoes, '') || ' [ensaio]', updated_at = now() + interval '2 seconds'
   where id = v_id;
  select count(*) into v_depois from public."TH_MONITORAMENTO" where id_registro = v_id;
  if v_depois <> v_antes + 1 then
    raise exception 'Mudança de conteúdo não gravou histórico (% → %).', v_antes, v_depois;
  end if;
  if not exists (select 1 from public."TH_MONITORAMENTO" h
                  where h.id_registro = v_id and h.evento = 'atualizado'
                    and h.snapshot_json ->> 'observacoes' like '%[ensaio]') then
    raise exception 'O registro novo não tem a foto com a mudança.';
  end if;

  update public."TB_MONITORAMENTO_INDIGENA" set ativo = false where id = v_id;
  if not exists (select 1 from public."TH_MONITORAMENTO" h
                  where h.id_registro = v_id and h.evento = 'desativado'
                    and h.created_at = now()) then
    raise exception 'Desativar não gravou o evento desativado.';
  end if;
  update public."TB_MONITORAMENTO_INDIGENA" set ativo = true where id = v_id;

  -- A função dos KPIs de verdade: o que ela grava no histórico tem conteúdo.
  select count(*) into v_antes from public."TH_MONITORAMENTO";
  v_editais := private."FC_ATUALIZAR_KPIS_PELA_SELECAO"();
  select count(*) into v_depois from public."TH_MONITORAMENTO";
  with novos as (
    select h.id_registro, h.snapshot_json s,
           (select a.snapshot_json from public."TH_MONITORAMENTO" a
             where a.id_registro = h.id_registro and a.created_at < now()
             order by a.created_at desc, a.id desc limit 1) ant
      from public."TH_MONITORAMENTO" h
     where h.created_at = now() and h.id_registro <> v_id
  )
  select count(*) into v_carimbo from novos
   where (s - array['updated_at', 'updated_by', 'DT_FONTE_FUNIL'])
         is not distinct from (ant - array['updated_at', 'updated_by', 'DT_FONTE_FUNIL']);
  if v_carimbo <> 0 then
    raise exception 'FC_ATUALIZAR_KPIS_PELA_SELECAO ainda grava % registro(s) só de carimbo.', v_carimbo;
  end if;
  raise notice 'Ensaio 20261116234000: KPIs atualizaram % edital(is) e gravaram % registro(s) de histórico, todos com conteúdo; só carimbo não grava; conteúdo e desativação gravam.',
    v_editais, v_depois - v_antes;
end;
$ensaio$;

rollback;
