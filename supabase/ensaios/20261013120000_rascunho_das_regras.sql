/*
  ENSAIO de 20261013120000_rascunho_das_regras.sql — begin … rollback.

  Aplica o corpo da migration (copiado sem mudança, sem o begin/commit dela) e
  confere no 114/2026 (o edital do incidente), como a pessoa da coordenação
  (a01afddb…, administradora global):
    E1  tabela com RLS, sem grant; RPCs só para authenticated;
    E2  sem rascunho: obter devolve null; salvar grava e obter devolve o mesmo
        conteúdo e a versão base; salvar de novo troca (uma linha só);
    E3  ANALISE e CLASSIFICACAO são rascunhos separados;
    E4  tipo inválido, conteúdo que não é objeto e versão negativa = 22023;
    E5  outra pessoa (sem permissão) é barrada (42501) e não vê o rascunho;
        descartar só apaga o próprio;
    E6  descartar apaga (true) e repetir não acha nada (false); obter = null.
  Termina em ROLLBACK: nada fica gravado.

  Rodar (Git Bash):
    source …/ensaio.sh && ensaio "$(sed -E '/^\s*(begin|commit|rollback)\s*;\s*$/Id' supabase/ensaios/20261013120000_rascunho_das_regras.sql)"
*/
begin;

-- ═══ CORPO DA MIGRATION (início) ═══
set local lock_timeout = '10s';

do $$
begin
  if to_regprocedure('private."FC_EXIGIR_COORD_AVALIACAO"(uuid)') is null then
    raise exception 'Aplique antes 20261006100000_regra_da_analise.sql.';
  end if;
  if to_regprocedure('private."FC_EXIGIR_CLASSIFICACAO_EDITAL"(uuid, integer)') is null then
    raise exception 'Aplique antes 20261002150000_classificacao.sql.';
  end if;
end;
$$;

create table public."TB_RASCUNHO_REGRA" (
  "TP_REGRA" varchar(13) not null,
  "CO_MONITORAMENTO" uuid not null,
  "CO_USUARIO" uuid not null,
  "DS_CONTEUDO" jsonb not null,
  "NU_VERSAO_BASE" integer not null default 0,
  "DT_CRIACAO" timestamptz not null default now(),
  "DT_ATUALIZACAO" timestamptz not null default now(),
  constraint "PK_TB_RASCUNHO_REGRA" primary key ("TP_REGRA", "CO_MONITORAMENTO", "CO_USUARIO"),
  constraint "FK_MONITORAMENTO_RASCUNHOREGRA" foreign key ("CO_MONITORAMENTO")
    references public."TB_MONITORAMENTO_INDIGENA" (id) on delete cascade,
  constraint "FK_USUARIO_RASCUNHOREGRA" foreign key ("CO_USUARIO") references auth.users (id) on delete cascade,
  constraint "CK_RASCUNHOREGRA_TPREGRA" check ("TP_REGRA" in ('ANALISE', 'CLASSIFICACAO')),
  constraint "CK_RASCUNHOREGRA_CONTEUDO" check (jsonb_typeof("DS_CONTEUDO") = 'object'
                                                and octet_length("DS_CONTEUDO"::text) <= 1048576),
  constraint "CK_RASCUNHOREGRA_NUVERSAO" check ("NU_VERSAO_BASE" >= 0)
);
create index "IN_FKRASCUNHOREGRA_EDITAL" on public."TB_RASCUNHO_REGRA" ("CO_MONITORAMENTO");
create index "IN_FKRASCUNHOREGRA_USUARIO" on public."TB_RASCUNHO_REGRA" ("CO_USUARIO");

alter table public."TB_RASCUNHO_REGRA" enable row level security;
revoke all on public."TB_RASCUNHO_REGRA" from public, anon, authenticated;

create or replace function private."FC_EXIGIR_RASCUNHO_REGRA"(p_tipo text, p_edital uuid)
returns uuid
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Sessão expirada' using errcode = '42501';
  end if;
  if p_tipo = 'ANALISE' then
    perform private."FC_EXIGIR_COORD_AVALIACAO"(p_edital);
  elsif p_tipo = 'CLASSIFICACAO' then
    perform private."FC_EXIGIR_CLASSIFICACAO_EDITAL"(p_edital, 2);
  else
    raise exception 'Tipo de regra inválido' using errcode = '22023';
  end if;
  return v_uid;
end;
$function$;
revoke all on function private."FC_EXIGIR_RASCUNHO_REGRA"(text, uuid) from public, anon, authenticated;

create or replace function public.salvar_rascunho_regra(p_tipo text, p_edital uuid, p_conteudo jsonb,
                                                        p_versao_base integer)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := private."FC_EXIGIR_RASCUNHO_REGRA"(p_tipo, p_edital);
  v_em timestamptz;
begin
  if jsonb_typeof(p_conteudo) is distinct from 'object' then
    raise exception 'Rascunho inválido.' using errcode = '22023';
  end if;
  if octet_length(p_conteudo::text) > 1048576 then
    raise exception 'Rascunho grande demais (até 1 MB).' using errcode = '22023';
  end if;
  if p_versao_base is null or p_versao_base < 0 then
    raise exception 'Versão base inválida.' using errcode = '22023';
  end if;
  insert into public."TB_RASCUNHO_REGRA" ("TP_REGRA", "CO_MONITORAMENTO", "CO_USUARIO", "DS_CONTEUDO", "NU_VERSAO_BASE")
  values (p_tipo, p_edital, v_uid, p_conteudo, p_versao_base)
  on conflict ("TP_REGRA", "CO_MONITORAMENTO", "CO_USUARIO")
  do update set "DS_CONTEUDO" = excluded."DS_CONTEUDO", "NU_VERSAO_BASE" = excluded."NU_VERSAO_BASE",
                "DT_ATUALIZACAO" = now()
  returning "DT_ATUALIZACAO" into v_em;
  return json_build_object('atualizado_em', v_em, 'versao_base', p_versao_base);
end;
$function$;
revoke all on function public.salvar_rascunho_regra(text, uuid, jsonb, integer) from public, anon;
grant execute on function public.salvar_rascunho_regra(text, uuid, jsonb, integer) to authenticated;

create or replace function public.obter_rascunho_regra(p_tipo text, p_edital uuid)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := private."FC_EXIGIR_RASCUNHO_REGRA"(p_tipo, p_edital);
begin
  return (
    select json_build_object('conteudo', r."DS_CONTEUDO", 'versao_base', r."NU_VERSAO_BASE",
                             'criado_em', r."DT_CRIACAO", 'atualizado_em', r."DT_ATUALIZACAO")
      from public."TB_RASCUNHO_REGRA" r
     where r."TP_REGRA" = p_tipo and r."CO_MONITORAMENTO" = p_edital and r."CO_USUARIO" = v_uid);
end;
$function$;
revoke all on function public.obter_rascunho_regra(text, uuid) from public, anon;
grant execute on function public.obter_rascunho_regra(text, uuid) to authenticated;

create or replace function public.descartar_rascunho_regra(p_tipo text, p_edital uuid)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_apagados integer;
begin
  if v_uid is null then
    raise exception 'Sessão expirada' using errcode = '42501';
  end if;
  if p_tipo is null or p_tipo not in ('ANALISE', 'CLASSIFICACAO') then
    raise exception 'Tipo de regra inválido' using errcode = '22023';
  end if;
  delete from public."TB_RASCUNHO_REGRA"
   where "TP_REGRA" = p_tipo and "CO_MONITORAMENTO" = p_edital and "CO_USUARIO" = v_uid;
  get diagnostics v_apagados = row_count;
  return json_build_object('descartado', v_apagados > 0);
end;
$function$;
revoke all on function public.descartar_rascunho_regra(text, uuid) from public, anon;
grant execute on function public.descartar_rascunho_regra(text, uuid) to authenticated;
-- ═══ CORPO DA MIGRATION (fim) ═══

-- ═══ E1. Objetos e grants ═══════════════════════════════════════════════════════
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public."TB_RASCUNHO_REGRA"'::regclass) then
    raise exception 'FALHOU E1: RLS desligada';
  end if;
  if has_table_privilege('authenticated', 'public."TB_RASCUNHO_REGRA"', 'select')
     or has_table_privilege('anon', 'public."TB_RASCUNHO_REGRA"', 'select') then
    raise exception 'FALHOU E1: a tabela tem grant';
  end if;
  if has_function_privilege('anon', 'public.salvar_rascunho_regra(text, uuid, jsonb, integer)', 'execute')
     or not has_function_privilege('authenticated', 'public.obter_rascunho_regra(text, uuid)', 'execute')
     or has_function_privilege('authenticated', 'private."FC_EXIGIR_RASCUNHO_REGRA"(text, uuid)', 'execute') then
    raise exception 'FALHOU E1: grants das funções';
  end if;
  raise notice 'ok E1: RLS, sem grant na tabela; RPCs só authenticated; a função privada fechada';
end;
$$;

-- Para chamar as RPCs como a pessoa (o ensaio desfaz tudo no rollback).
grant usage on schema private to authenticated;
grant execute on all functions in schema private to authenticated;
set local role authenticated;

-- ═══ E2–E6. Como a coordenação (e como outra pessoa) ═══════════════════════════════
do $$
declare
  c_edital constant uuid := 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0'; -- 114/2026
  c_eu constant text := '{"sub":"a01afddb-f64b-47d9-80e8-476a1ed14e43","role":"authenticated"}';
  c_outra constant text := '{"sub":"00000000-0000-4000-8000-0000000e5a10","role":"authenticated"}';
  v json;
  v_codigo text;
begin
  perform set_config('request.jwt.claims', c_eu, true);

  -- E2
  if public.obter_rascunho_regra('ANALISE', c_edital) is not null then
    raise exception 'FALHOU E2: já havia rascunho';
  end if;
  v := public.salvar_rascunho_regra('ANALISE', c_edital, '{"regra":{"titulo_etapa":"Ensaio"}}', 2);
  if v ->> 'atualizado_em' is null then raise exception 'FALHOU E2: salvar %', v; end if;
  v := public.obter_rascunho_regra('ANALISE', c_edital);
  if v #>> '{conteudo,regra,titulo_etapa}' is distinct from 'Ensaio' or (v ->> 'versao_base')::int <> 2 then
    raise exception 'FALHOU E2: obter %', v;
  end if;
  perform public.salvar_rascunho_regra('ANALISE', c_edital, '{"regra":{"titulo_etapa":"Ensaio 2"}}', 3);
  v := public.obter_rascunho_regra('ANALISE', c_edital);
  if v #>> '{conteudo,regra,titulo_etapa}' is distinct from 'Ensaio 2' or (v ->> 'versao_base')::int <> 3 then
    raise exception 'FALHOU E2: troca %', v;
  end if;
  raise notice 'ok E2: sem rascunho = null; salvar grava, obter devolve conteúdo e versão base; salvar de novo troca';

  -- E3
  perform public.salvar_rascunho_regra('CLASSIFICACAO', c_edital, '{"regra":{"rodape":"Ensaio"}}', 1);
  if public.obter_rascunho_regra('CLASSIFICACAO', c_edital) #>> '{conteudo,regra,rodape}' is distinct from 'Ensaio'
     or public.obter_rascunho_regra('ANALISE', c_edital) #>> '{conteudo,regra,titulo_etapa}' is distinct from 'Ensaio 2' then
    raise exception 'FALHOU E3: tipos misturados';
  end if;
  raise notice 'ok E3: ANALISE e CLASSIFICACAO separados';

  -- E4
  begin
    perform public.salvar_rascunho_regra('OUTRA', c_edital, '{}', 0);
    raise exception 'FALHOU E4: tipo inválido aceito';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.salvar_rascunho_regra('ANALISE', c_edital, '[1]', 0);
    raise exception 'FALHOU E4: conteúdo lista aceito';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.salvar_rascunho_regra('ANALISE', c_edital, '{}', -1);
    raise exception 'FALHOU E4: versão negativa aceita';
  exception when sqlstate '22023' then null;
  end;
  raise notice 'ok E4: tipo, conteúdo e versão inválidos = 22023';

  -- E5
  perform set_config('request.jwt.claims', c_outra, true);
  begin
    perform public.obter_rascunho_regra('ANALISE', c_edital);
    raise exception 'FALHOU E5: outra pessoa leu';
  exception when sqlstate '42501' then null;
  end;
  begin
    perform public.salvar_rascunho_regra('CLASSIFICACAO', c_edital, '{}', 0);
    raise exception 'FALHOU E5: outra pessoa gravou';
  exception when sqlstate '42501' then null;
  end;
  if (public.descartar_rascunho_regra('ANALISE', c_edital) ->> 'descartado')::boolean then
    raise exception 'FALHOU E5: outra pessoa apagou o rascunho alheio';
  end if;
  perform set_config('request.jwt.claims', c_eu, true);
  if public.obter_rascunho_regra('ANALISE', c_edital) is null then
    raise exception 'FALHOU E5: o rascunho sumiu';
  end if;
  raise notice 'ok E5: outra pessoa barrada (42501) e não apaga o rascunho alheio';

  -- E6 (um comando por chamada: a função stable vê o retrato do comando)
  if not (public.descartar_rascunho_regra('ANALISE', c_edital) ->> 'descartado')::boolean then
    raise exception 'FALHOU E6: descartar não achou';
  end if;
  if (public.descartar_rascunho_regra('ANALISE', c_edital) ->> 'descartado')::boolean then
    raise exception 'FALHOU E6: descartar duas vezes';
  end if;
  if public.obter_rascunho_regra('ANALISE', c_edital) is not null then
    raise exception 'FALHOU E6: o rascunho ficou';
  end if;
  if public.obter_rascunho_regra('CLASSIFICACAO', c_edital) is null then
    raise exception 'FALHOU E6: apagou o outro tipo';
  end if;
  raise notice 'ok E6: descartar apaga só o tipo pedido; repetir = false; obter = null';
end;
$$;

reset role;

select 'ENSAIO OK' as resultado,
       (select count(*) from public."TB_RASCUNHO_REGRA") as rascunhos_no_ensaio;

rollback;
