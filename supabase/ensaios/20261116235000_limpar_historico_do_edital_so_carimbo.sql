/*
  ENSAIO de 20261116235000_limpar_historico_do_edital_so_carimbo: aplica 20261116234000 (a guarda
  exige o gatilho novo) e a limpeza na mesma transação, confere e termina em rollback (não grava
  nada).

  A confere da própria migration prova que nenhuma mudança de conteúdo some (a foto anterior de
  cada registro que fica é a mesma de antes, sem o carimbo) e que nenhum registro humano, criado,
  desativado ou de troca de área sai. Este ensaio confere também que o número de estados de
  conteúdo de cada edital não muda.
*/
begin;

-- 20261116234000 (pré-requisito), como está no arquivo dela.

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


-- Estados de conteúdo de cada edital antes da limpeza.
create temp table tmp_estados_antes on commit drop as
select t.id_registro, count(distinct t.snapshot_json - array['updated_at', 'updated_by', 'DT_FONTE_FUNIL']) qt
  from public."TH_MONITORAMENTO" t group by 1;

-- 20261116235000, como está no arquivo.

set local lock_timeout = '5s';

do $guarda$
begin
  if position('20261116234000' in coalesce((select prosrc from pg_proc where oid = to_regprocedure('public.fn_registrar_historico()')), '')) = 0 then
    raise exception 'Aplique antes 20261116234000_historico_do_edital_ignora_so_carimbo.sql.';
  end if;
end;
$guarda$;

-- Ninguém grava no histórico enquanto a limpeza mede e apaga.
lock table public."TH_MONITORAMENTO" in share row exclusive mode;

-- A foto anterior de cada registro (sem o carimbo), antes de apagar.
create temp table tmp_historico_antes on commit drop as
select t.id, t.id_registro, t.usuario_id, t.evento, t.campo_alterado, t.created_at,
       lag(t.created_at) over w as anterior_em,
       count(*) over (partition by t.id_registro, t.created_at) as qt_mesmo_instante,
       t.snapshot_json - array['updated_at', 'updated_by', 'DT_FONTE_FUNIL'] as conteudo,
       lag(t.snapshot_json) over w - array['updated_at', 'updated_by', 'DT_FONTE_FUNIL'] as conteudo_anterior,
       pg_column_size(t.*) as nu_bytes
  from public."TH_MONITORAMENTO" t
window w as (partition by t.id_registro order by t.created_at, t.id);
alter table tmp_historico_antes add primary key (id);
create index on tmp_historico_antes (id_registro, created_at);
analyze tmp_historico_antes;

create temp table tmp_historico_so_carimbo on commit drop as
select a.id, a.nu_bytes
  from tmp_historico_antes a
 where a.usuario_id is null
   and a.evento = 'atualizado'
   and a.campo_alterado is null
   and a.conteudo_anterior is not null
   and a.conteudo is not distinct from a.conteudo_anterior
   and a.qt_mesmo_instante = 1
   and not exists (select 1 from tmp_historico_antes e
                    where e.id_registro = a.id_registro and e.created_at = a.anterior_em
                      and e.qt_mesmo_instante > 1);
alter table tmp_historico_so_carimbo add primary key (id);
analyze tmp_historico_so_carimbo;

do $guarda_qtd$
declare
  v_qt integer;
begin
  select count(*) into v_qt from tmp_historico_so_carimbo;
  if v_qt not between 9000 and 9500 then
    raise exception 'São % registros só de carimbo; a medição de 16/11/2026 deu 9.144. Meça de novo antes de apagar.', v_qt;
  end if;
end;
$guarda_qtd$;

delete from public."TH_MONITORAMENTO" t
 using tmp_historico_so_carimbo c
 where t.id = c.id;

do $confere$
declare
  v_qt integer;
  v_mb numeric;
  v_restam integer;
  v_esperado integer;
  v_humanos_antes integer;
  v_humanos_depois integer;
  v_mudou integer;
begin
  select count(*), round(sum(nu_bytes) / 1048576.0, 1) into v_qt, v_mb from tmp_historico_so_carimbo;
  select count(*) into v_restam from public."TH_MONITORAMENTO";
  select count(*) - v_qt into v_esperado from tmp_historico_antes;
  if v_restam <> v_esperado then
    raise exception 'Restaram % registros; o esperado era %.', v_restam, v_esperado;
  end if;

  select count(*) into v_humanos_antes from tmp_historico_antes
   where usuario_id is not null or evento <> 'atualizado' or campo_alterado is not null;
  select count(*) into v_humanos_depois from public."TH_MONITORAMENTO"
   where usuario_id is not null or evento <> 'atualizado' or campo_alterado is not null;
  if v_humanos_depois <> v_humanos_antes then
    raise exception 'Registro humano, criado, desativado ou de troca de área sumiu (% → %).', v_humanos_antes, v_humanos_depois;
  end if;

  -- Cada registro que fica tem a mesma foto anterior (sem o carimbo) de antes da limpeza:
  -- nenhuma mudança de conteúdo some.
  with depois as (
    select t.id,
           lag(t.snapshot_json) over (partition by t.id_registro order by t.created_at, t.id)
             - array['updated_at', 'updated_by', 'DT_FONTE_FUNIL'] as conteudo_anterior
      from public."TH_MONITORAMENTO" t
  )
  select count(*) into v_mudou
    from depois d
    join tmp_historico_antes a on a.id = d.id
   where d.conteudo_anterior is distinct from a.conteudo_anterior;
  if v_mudou <> 0 then
    raise exception '% registro(s) ficariam com outra foto anterior: a limpeza apagaria mudança de conteúdo.', v_mudou;
  end if;

  raise notice 'Migration 20261116235000: % registros só de carimbo apagados (% MB de dados); restam %; nenhuma mudança de conteúdo some.',
    v_qt, v_mb, v_restam;
end;
$confere$;


do $ensaio$
declare
  v_diferentes integer;
begin
  select count(*) into v_diferentes
    from tmp_estados_antes a
    full join (select t.id_registro, count(distinct t.snapshot_json - array['updated_at', 'updated_by', 'DT_FONTE_FUNIL']) qt
                 from public."TH_MONITORAMENTO" t group by 1) d on d.id_registro = a.id_registro
   where a.qt is distinct from d.qt;
  if v_diferentes <> 0 then
    raise exception '% edital(is) perderam estado de conteúdo no histórico.', v_diferentes;
  end if;
  raise notice 'Ensaio 20261116235000: todo edital mantém os mesmos estados de conteúdo no histórico.';
end;
$ensaio$;

rollback;
