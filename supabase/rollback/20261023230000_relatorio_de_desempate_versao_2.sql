-- ROLLBACK de supabase/migrations/20261023230000_relatorio_de_desempate_versao_2.sql
-- Volta ao estado de 20261023170000: classificacao_ler_lista sem gerada_por e classificacao_gravar_desempate
-- só com a versão 1. Os relatórios já gravados na versão 2 ficam (a tela lê as duas versões); o job
-- novo passa a falhar na gravação até a migration voltar — reverta o código junto.
begin;

set local lock_timeout = '5s';

-- classificacao_ler_lista: o corpo de 20261023170000.
create or replace function public.classificacao_ler_lista(p_lista uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v public."TB_LISTA_CLASSIFICACAO";
begin
  select * into v from public."TB_LISTA_CLASSIFICACAO" l where l."CO_LISTA_CLASSIFICACAO" = p_lista;
  if v."CO_LISTA_CLASSIFICACAO" is null then
    raise exception 'Lista não encontrada' using errcode = '22023';
  end if;
  return jsonb_build_object(
    'id', v."CO_LISTA_CLASSIFICACAO",
    'edital', v."CO_MONITORAMENTO",
    'tipo', v."TP_LISTA",
    'versao_regra', v."NU_VERSAO_REGRA",
    'hash', v."DS_HASH",
    'gerada_em', v."DT_GERACAO",
    'resultado', v."DS_RESULTADO");
end;
$function$;
comment on function public.classificacao_ler_lista(uuid) is
  'Job da classificação em Python (--desempate, 20261023170000): a lista gerada como foi registrada — o retrato (DS_RESULTADO, com os nomes), o hash, o tipo, a versão da regra e o edital — para conferir com o cálculo do Python antes de gravar o relatório de desempate. Só service_role.';
revoke all on function public.classificacao_ler_lista(uuid) from public, anon, authenticated;
grant execute on function public.classificacao_ler_lista(uuid) to service_role;

-- classificacao_gravar_desempate: o corpo de 20261023170000.
create or replace function public.classificacao_gravar_desempate(p_execucao text, p_lista uuid, p_hash text,
                                                                p_relatorio jsonb, p_texto text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_lista public."TB_LISTA_CLASSIFICACAO";
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
     or coalesce(jsonb_typeof(p_relatorio->'versao'), '') <> 'number' or (p_relatorio->>'versao')::numeric <> 1
     or p_relatorio->>'tipo' is distinct from v_lista."TP_LISTA"
     or coalesce(jsonb_typeof(p_relatorio->'vagas'), '') <> 'array'
     or coalesce(jsonb_typeof(p_relatorio->'totais'), '') <> 'object' then
    raise exception 'Relatório de desempate inválido (versão, tipo ou forma)' using errcode = '22023';
  end if;
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
  values (p_lista, 1, p_relatorio, p_texto, p_hash, v_grupos, v_empatados, v_pendentes, p_execucao, now())
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

  return jsonb_build_object('lista', p_lista, 'grupos', v_grupos, 'empatados', v_empatados, 'pendentes', v_pendentes);
end;
$function$;
comment on function public.classificacao_gravar_desempate(text, uuid, text, jsonb, text) is
  'Job da classificação em Python: grava (ou troca) o relatório de desempate de uma lista gerada e marca o preparo PRONTO (TB_PREPARO_DESEMPATE, 20261023170000). Confere o hash da lista, a versão e o tipo do relatório, que cada candidato está na lista, os totais e a ausência de contato ou documento (@ ou 11 dígitos fora dos ids). Só service_role.';
revoke all on function public.classificacao_gravar_desempate(text, uuid, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.classificacao_gravar_desempate(text, uuid, text, jsonb, text) to service_role;

comment on column public."TB_RELATORIO_DESEMPATE"."NU_VERSAO_RELATORIO" is 'Versão do formato do relatório (python/monitora/classificacao/desempate.py, VERSAO_DO_RELATORIO).';
comment on column public."TB_RELATORIO_DESEMPATE"."DS_RELATORIO" is 'O relatório em json estável (versao, tipo, criterios, empateFinal, totais, vagas[].grupos[]).';

commit;
