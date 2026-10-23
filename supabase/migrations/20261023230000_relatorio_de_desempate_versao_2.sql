/*
  RELATÓRIO DE DESEMPATE MAIS CLARO: A VERSÃO 2 DO RELATÓRIO (23/10/2026)

  O QUE MUDA PARA QUEM USA
  O relatório de desempate (Classificação › Listas › "Relatório de desempate")
  ganha o cabeçalho da lista — edital e unidade, tipo e fase, número da
  geração e identificador, quando e por quem foi gerada (o nome do cadastro),
  versão da regra —, a idade em anos na data de corte, o resumo por critério e
  o título de cada grupo dizendo se o empate é na lista geral ou numa lista de
  cota. Quem calcula é o Python (python/monitora/classificacao/desempate.py,
  VERSAO_DO_RELATORIO = 2); o banco só passa a aceitar a versão nova e a
  entregar ao job quem gerou a lista. O relatório já gravado (versão 1) fica
  como está e continua abrindo na tela; para ter o formato novo, gere a lista
  de novo ou peça o relatório pelo "Rodar agora".

  1. classificacao_ler_lista (só service_role): o mesmo corpo (20261023170000)
     + 'gerada_por', o nome do cadastro (TB_PERFIL_USUARIO.nome) de quem gerou
     a lista (nulo sem cadastro ou se o nome tiver "@"). O nome vai para o
     relatório (documento interno da comissão), nunca para o log do Actions.
  2. classificacao_gravar_desempate (só service_role): o mesmo corpo
     (20261023170000), aceitando o relatório nas versões 1 e 2 e gravando em
     NU_VERSAO_RELATORIO a versão recebida (antes, sempre 1). As conferências
     (hash, tipo, forma, candidatos da lista, totais, nada de "@" nem 11
     dígitos) não mudam. Mesma assinatura.

  PRÉ-REQUISITOS: 20261023170000 (classificação em Python, etapa 2a).
  Aplicar ANTES de mesclar o código (o job novo grava a versão 2).

  Ensaio: supabase/ensaios/20261023230000_relatorio_de_desempate_versao_2.sql
  Rollback: supabase/rollback/20261023230000_relatorio_de_desempate_versao_2.sql
*/
begin;

set local lock_timeout = '5s';

-- 0. Pré-requisitos ---------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.classificacao_ler_lista(uuid)') is null
     or to_regprocedure('public.classificacao_gravar_desempate(text, uuid, text, jsonb, text)') is null
     or to_regclass('public."TB_PREPARO_DESEMPATE"') is null then
    raise exception 'Aplique antes 20261023170000_classificacao_em_python_etapa_2.sql.';
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
  -- O nome do cadastro de quem gerou; nada que pareça e-mail.
  select nullif(btrim(regexp_replace(p.nome, '\s+', ' ', 'g')), '') into v_nome
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
  'Job da classificação em Python (--desempate, 20261023170000): a lista gerada como foi registrada — o retrato (DS_RESULTADO, com os nomes), o hash, o tipo, a versão da regra, o edital, quando e por quem foi gerada (gerada_por: o nome do cadastro, nulo sem cadastro ou com "@"; 20261023230000) — para conferir com o cálculo do Python antes de gravar o relatório de desempate. Só service_role.';
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

commit;
