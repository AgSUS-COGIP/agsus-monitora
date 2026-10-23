-- ENSAIO de supabase/migrations/20261023230000_relatorio_de_desempate_versao_2.sql: roda o corpo e desfaz (rollback).
-- Esperado, no edital 114/2026 (bcecfb08-88ef-4e06-8401-bcad6bf88fd0), com a última lista gerada dele como base:
--   classificacao_ler_lista traz gerada_por (nome e sobrenome do cadastro de quem gerou, FC_NOME_E_SOBRENOME; aqui só se veio
--   preenchido e se é o mesmo que a função dá para o cadastro);
--   classificacao_gravar_desempate grava a versão 2 (NU_VERSAO_RELATORIO = 2) e ainda a 1, recusa a 3 e o
--   relatório com "@"; as duas RPCs só para service_role.
-- O resultado (json) traz só verdadeiro/falso e números; nenhum nome real.
begin;

-- ═══ CORPO DA MIGRATION (início) ═══

set local lock_timeout = '5s';

-- 0. Pré-requisitos ---------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.classificacao_ler_lista(uuid)') is null
     or to_regprocedure('public.classificacao_gravar_desempate(text, uuid, text, jsonb, text)') is null
     or to_regclass('public."TB_PREPARO_DESEMPATE"') is null then
    raise exception 'Aplique antes 20261023170000_classificacao_em_python_etapa_2.sql.';
  end if;
  if to_regprocedure('private."FC_NOME_E_SOBRENOME"(text)') is null then
    raise exception 'Aplique antes 20261016120000_responsavel_nome_do_cadastro.sql.';
  end if;
end;
$$;

-- 1. A lista gerada para o job, com quem a gerou ------------------------------------------
create or replace function public.classificacao_ler_lista(p_lista uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v public."TB_LISTA_CLASSIFICACAO";
  v_nome text;
begin
  select * into v from public."TB_LISTA_CLASSIFICACAO" l where l."CO_LISTA_CLASSIFICACAO" = p_lista;
  if v."CO_LISTA_CLASSIFICACAO" is null then
    raise exception 'Lista não encontrada' using errcode = '22023';
  end if;
  -- Nome e sobrenome do cadastro de quem gerou; nada que pareça e-mail.
  select private."FC_NOME_E_SOBRENOME"(p.nome) into v_nome
    from public."TB_PERFIL_USUARIO" p where p.user_id = v."CO_USUARIO" limit 1;
  return jsonb_build_object(
    'id', v."CO_LISTA_CLASSIFICACAO",
    'edital', v."CO_MONITORAMENTO",
    'tipo', v."TP_LISTA",
    'versao_regra', v."NU_VERSAO_REGRA",
    'hash', v."DS_HASH",
    'gerada_em', v."DT_GERACAO",
    'gerada_por', case when v_nome ~ '@' then null else left(v_nome, 120) end,
    'resultado', v."DS_RESULTADO");
end;
$function$;
comment on function public.classificacao_ler_lista(uuid) is
  'Job da classificação em Python (--desempate, 20261023170000): a lista gerada como foi registrada — o retrato (DS_RESULTADO, com os nomes), o hash, o tipo, a versão da regra, o edital, quando e por quem foi gerada (gerada_por: nome e sobrenome do cadastro, FC_NOME_E_SOBRENOME; nulo sem cadastro ou com "@"; 20261023230000) — para conferir com o cálculo do Python antes de gravar o relatório de desempate. Só service_role.';
revoke all on function public.classificacao_ler_lista(uuid) from public, anon, authenticated;
grant execute on function public.classificacao_ler_lista(uuid) to service_role;

-- 2. A gravação aceita a versão 2 --------------------------------------------------------
-- Corpo de 20261023170000, com a versão 1 ou 2 e gravada como veio.
create or replace function public.classificacao_gravar_desempate(p_execucao text, p_lista uuid, p_hash text,
                                                                p_relatorio jsonb, p_texto text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_lista public."TB_LISTA_CLASSIFICACAO";
  v_versao smallint;
  v_grupos integer;
  v_empatados integer;
  v_pendentes integer;
  v_fora integer;
begin
  if coalesce(p_execucao, '') !~ '^[A-Za-z0-9_.:-]{1,80}$' then
    raise exception 'Execução inválida' using errcode = '22023';
  end if;
  select * into v_lista from public."TB_LISTA_CLASSIFICACAO" l where l."CO_LISTA_CLASSIFICACAO" = p_lista;
  if v_lista."CO_LISTA_CLASSIFICACAO" is null then
    raise exception 'Lista não encontrada' using errcode = '22023';
  end if;
  if p_hash is distinct from v_lista."DS_HASH" then
    raise exception 'A lista mudou desde o cálculo do relatório (hash diferente)' using errcode = '22023';
  end if;
  if p_relatorio is null or jsonb_typeof(p_relatorio) <> 'object'
     or coalesce(jsonb_typeof(p_relatorio->'versao'), '') <> 'number'
     or (p_relatorio->>'versao') not in ('1', '2')
     or p_relatorio->>'tipo' is distinct from v_lista."TP_LISTA"
     or coalesce(jsonb_typeof(p_relatorio->'vagas'), '') <> 'array'
     or coalesce(jsonb_typeof(p_relatorio->'totais'), '') <> 'object' then
    raise exception 'Relatório de desempate inválido (versão, tipo ou forma)' using errcode = '22023';
  end if;
  v_versao := (p_relatorio->>'versao')::smallint;
  if coalesce(p_texto, '') = '' or octet_length(p_texto) > 8000000 or octet_length(p_relatorio::text) > 8000000 then
    raise exception 'Relatório de desempate vazio ou grande demais' using errcode = '22023';
  end if;
  -- Sem contato nem documento: nada de e-mail nem 11 dígitos seguidos (fora os ids das análises).
  if regexp_replace(p_relatorio::text || p_texto, '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', '', 'g')
     ~ '@|[0-9]{11}' then
    raise exception 'Relatório de desempate com dado que parece pessoal (@ ou 11 dígitos)' using errcode = '22023';
  end if;
  -- Cada candidato do relatório está na lista gerada.
  select count(*) into v_fora
    from jsonb_path_query(p_relatorio, '$.vagas[*].grupos[*].candidatos[*].analiseId') r(id)
   where not exists (
     select 1 from jsonb_path_query(v_lista."DS_RESULTADO", '$.vagas[*].geral[*].analise_id') g(id) where g.id = r.id
     union all
     select 1 from jsonb_path_query(v_lista."DS_RESULTADO", '$.vagas[*].listas.*[*].analise_id') m(id) where m.id = r.id);
  if v_fora > 0 then
    raise exception 'Relatório de desempate com % candidato(s) fora da lista', v_fora using errcode = '22023';
  end if;
  select count(*) into v_grupos from jsonb_path_query(p_relatorio, '$.vagas[*].grupos[*]');
  v_empatados := coalesce((p_relatorio#>>'{totais,empatadosAteOFim}')::integer, -1);
  v_pendentes := coalesce((p_relatorio#>>'{totais,pendentes}')::integer, -1);
  if v_grupos is distinct from (p_relatorio#>>'{totais,grupos}')::integer or v_empatados < 0 or v_pendentes < 0 then
    raise exception 'Totais do relatório de desempate não batem com os grupos' using errcode = '22023';
  end if;

  insert into public."TB_RELATORIO_DESEMPATE" as r
    ("CO_LISTA_CLASSIFICACAO", "NU_VERSAO_RELATORIO", "DS_RELATORIO", "DS_TEXTO", "DS_HASH_LISTA",
     "QT_GRUPO", "QT_EMPATE_FINAL", "QT_PENDENCIA", "CO_EXECUCAO", "DT_GERACAO")
  values (p_lista, v_versao, p_relatorio, p_texto, p_hash, v_grupos, v_empatados, v_pendentes, p_execucao, now())
  on conflict ("CO_LISTA_CLASSIFICACAO") do update
    set "NU_VERSAO_RELATORIO" = excluded."NU_VERSAO_RELATORIO", "DS_RELATORIO" = excluded."DS_RELATORIO",
        "DS_TEXTO" = excluded."DS_TEXTO", "DS_HASH_LISTA" = excluded."DS_HASH_LISTA",
        "QT_GRUPO" = excluded."QT_GRUPO", "QT_EMPATE_FINAL" = excluded."QT_EMPATE_FINAL",
        "QT_PENDENCIA" = excluded."QT_PENDENCIA", "CO_EXECUCAO" = excluded."CO_EXECUCAO", "DT_GERACAO" = now();

  -- O preparo da lista fica pronto (20261023170000).
  insert into public."TB_PREPARO_DESEMPATE" as p
    ("CO_LISTA_CLASSIFICACAO", "TP_SITUACAO", "DS_MENSAGEM", "CO_EXECUCAO", "DT_PEDIDO", "DT_ATUALIZACAO")
  values (p_lista, 'PRONTO', null, p_execucao, now(), now())
  on conflict ("CO_LISTA_CLASSIFICACAO") do update
    set "TP_SITUACAO" = 'PRONTO', "DS_MENSAGEM" = null, "CO_EXECUCAO" = excluded."CO_EXECUCAO", "DT_ATUALIZACAO" = now();

  return jsonb_build_object('lista', p_lista, 'versao', v_versao, 'grupos', v_grupos, 'empatados', v_empatados,
                            'pendentes', v_pendentes);
end;
$function$;
comment on function public.classificacao_gravar_desempate(text, uuid, text, jsonb, text) is
  'Job da classificação em Python: grava (ou troca) o relatório de desempate de uma lista gerada, nas versões 1 ou 2 do formato (gravada em NU_VERSAO_RELATORIO; 20261023230000), e marca o preparo PRONTO (TB_PREPARO_DESEMPATE, 20261023170000). Confere o hash da lista, a versão e o tipo do relatório, que cada candidato está na lista, os totais e a ausência de contato ou documento (@ ou 11 dígitos fora dos ids). Só service_role.';
revoke all on function public.classificacao_gravar_desempate(text, uuid, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.classificacao_gravar_desempate(text, uuid, text, jsonb, text) to service_role;

comment on column public."TB_RELATORIO_DESEMPATE"."NU_VERSAO_RELATORIO" is
  'Versão do formato do relatório (python/monitora/classificacao/desempate.py, VERSAO_DO_RELATORIO): 1 (20261023140000) ou 2, com cabeçalho, idade em anos e resumo (20261023230000).';
comment on column public."TB_RELATORIO_DESEMPATE"."DS_RELATORIO" is
  'O relatório em json estável (versao, tipo, criterios, empateFinal, totais, vagas[].grupos[]; na versão 2 também cabecalho, modalidades e resumo).';

-- ═══ CORPO DA MIGRATION (fim) ═══

create temp table t_ensaio (chave text primary key, valor jsonb) on commit drop;

do $$
declare
  v_lista public."TB_LISTA_CLASSIFICACAO";
  v_lida jsonb;
  v_vazio jsonb;
  v_r2 jsonb;
  v_r1 jsonb;
  v_recusa_3 boolean := false;
  v_recusa_arroba boolean := false;
begin
  select * into v_lista from public."TB_LISTA_CLASSIFICACAO" l
   where l."CO_MONITORAMENTO" = 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0'
   order by l."DT_GERACAO" desc limit 1;
  if v_lista."CO_LISTA_CLASSIFICACAO" is null then
    raise exception 'Ensaio: o 114/2026 não tem lista gerada.';
  end if;
  v_lida := public.classificacao_ler_lista(v_lista."CO_LISTA_CLASSIFICACAO");
  v_vazio := jsonb_build_object('tipo', v_lista."TP_LISTA", 'vagas', '[]'::jsonb,
                                'totais', jsonb_build_object('grupos', 0, 'empatadosAteOFim', 0, 'pendentes', 0));

  v_r2 := public.classificacao_gravar_desempate('ensaio-versao-2', v_lista."CO_LISTA_CLASSIFICACAO", v_lista."DS_HASH",
                                                v_vazio || '{"versao": 2}', 'Relatório de ensaio.');
  insert into t_ensaio values ('versao_2', jsonb_build_object(
    'devolve_2', (v_r2->>'versao')::integer = 2,
    'gravada_2', (select r."NU_VERSAO_RELATORIO" from public."TB_RELATORIO_DESEMPATE" r
                   where r."CO_LISTA_CLASSIFICACAO" = v_lista."CO_LISTA_CLASSIFICACAO") = 2,
    'preparo_pronto', (select p."TP_SITUACAO" from public."TB_PREPARO_DESEMPATE" p
                        where p."CO_LISTA_CLASSIFICACAO" = v_lista."CO_LISTA_CLASSIFICACAO") = 'PRONTO'));

  v_r1 := public.classificacao_gravar_desempate('ensaio-versao-1', v_lista."CO_LISTA_CLASSIFICACAO", v_lista."DS_HASH",
                                                v_vazio || '{"versao": 1}', 'Relatório de ensaio.');
  begin
    perform public.classificacao_gravar_desempate('ensaio-versao-3', v_lista."CO_LISTA_CLASSIFICACAO", v_lista."DS_HASH",
                                                  v_vazio || '{"versao": 3}', 'Relatório de ensaio.');
  exception when sqlstate '22023' then v_recusa_3 := true;
  end;
  begin
    perform public.classificacao_gravar_desempate('ensaio-arroba', v_lista."CO_LISTA_CLASSIFICACAO", v_lista."DS_HASH",
                                                  v_vazio || '{"versao": 2}', 'Gerada por alguem@exemplo.org');
  exception when sqlstate '22023' then v_recusa_arroba := true;
  end;

  insert into t_ensaio values ('leitura', jsonb_build_object(
    'tem_gerada_por', v_lida ? 'gerada_por',
    'gerada_por_preenchido', coalesce(v_lida->>'gerada_por', '') <> '',
    'gerada_por_sem_arroba', coalesce(v_lida->>'gerada_por', '') !~ '@',
    'gerada_por_e_nome_e_sobrenome', (v_lida->>'gerada_por') is not distinct from (
      select private."FC_NOME_E_SOBRENOME"(p.nome) from public."TB_PERFIL_USUARIO" p
       where p.user_id = v_lista."CO_USUARIO" limit 1),
    'mesmas_chaves_de_antes', v_lida ?& array['id', 'edital', 'tipo', 'versao_regra', 'hash', 'gerada_em', 'resultado']));
  insert into t_ensaio values ('versao_1_e_recusas', jsonb_build_object(
    'versao_1_ainda_grava', (v_r1->>'versao')::integer = 1,
    'recusa_versao_3', v_recusa_3,
    'recusa_arroba', v_recusa_arroba));
end;
$$;

select json_build_object(
  'leitura', (select valor from t_ensaio where chave = 'leitura'),
  'versao_2', (select valor from t_ensaio where chave = 'versao_2'),
  'versao_1_e_recusas', (select valor from t_ensaio where chave = 'versao_1_e_recusas'),
  'so_service_role', not has_function_privilege('authenticated', 'public.classificacao_ler_lista(uuid)', 'execute')
                     and not has_function_privilege('authenticated', 'public.classificacao_gravar_desempate(text, uuid, text, jsonb, text)', 'execute')
                     and has_function_privilege('service_role', 'public.classificacao_ler_lista(uuid)', 'execute')
                     and has_function_privilege('service_role', 'public.classificacao_gravar_desempate(text, uuid, text, jsonb, text)', 'execute')
) as ensaio;

rollback;
