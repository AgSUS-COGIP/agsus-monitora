-- ENSAIO de supabase/migrations/20261023140000_classificacao_em_python_e_relatorio_de_desempate.sql: roda o corpo e desfaz (rollback).
-- Esperado, no edital 114/2026 (bcecfb08-88ef-4e06-8401-bcad6bf88fd0):
--   classificacao_ler_edital traz os mesmos candidatos e entrevistas de FC_DADOS_CLASSIFICACAO_EDITAL, com
--   todo nome trocado por um apelido de 6 dígitos (únicos, na ordem alfabética do motor), sem "por" nos
--   desempates, sem o conteúdo das listas e com a configuração de convocação do edital;
--   classificacao_gravar_desempate grava um relatório fictício para a última lista e recusa hash velho,
--   "@", candidato fora da lista, totais que não batem e relatório sem versão;
--   obter_desempate_da_lista devolve o relatório a um administrador global (sub do JWT abaixo) e null
--   para a lista sem relatório.
-- O resultado (json) traz só contagens e verdadeiro/falso; nenhum nome nem data de nascimento.
begin;

-- ═══ CORPO DA MIGRATION (início) ═══

-- 0. Pré-requisitos ---------------------------------------------------------------------
do $$
begin
  if to_regprocedure('private."FC_DADOS_CLASSIFICACAO_EDITAL"(uuid, text)') is null
     or to_regprocedure('private."FC_EXIGIR_CLASSIFICACAO_EDITAL"(uuid, integer)') is null
     or to_regclass('public."TB_LISTA_CLASSIFICACAO"') is null
     or to_regclass('public."TB_CONVOCACAO_EDITAL"') is null
     or to_regclass('public."TB_MODELO_CONVOCACAO"') is null then
    raise exception 'Aplique antes 20261002150000_classificacao.sql, 20261009130000_hora_de_nascimento_na_classificacao.sql e 20260923120000_lista_de_convocacao.sql.';
  end if;
end;
$$;

-- 1. A ordem alfabética do motor ---------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_collation c
      join pg_catalog.pg_namespace n on n.oid = c.collnamespace
     where n.nspname = 'private' and c.collname = 'CL_NOME_PT_BR_BASE'
  ) then
    create collation private."CL_NOME_PT_BR_BASE" (provider = icu, locale = 'pt-BR-u-ks-level1', deterministic = false);
  end if;
end;
$$;
comment on collation private."CL_NOME_PT_BR_BASE" is
  'Ordem alfabética do motor da classificação (localeCompare "pt-BR", sensitivity "base"): maiúscula, minúscula e acento iguais; espaço e pontuação contam. Usada para o apelido dos nomes em classificacao_ler_edital.';

-- 2. O relatório de desempate de uma lista gerada ----------------------------------------
create table if not exists public."TB_RELATORIO_DESEMPATE" (
  "CO_LISTA_CLASSIFICACAO" uuid not null,
  "NU_VERSAO_RELATORIO" smallint not null,
  "DS_RELATORIO" jsonb not null,
  "DS_TEXTO" text not null,
  "DS_HASH_LISTA" varchar(64) not null,
  "QT_GRUPO" integer not null default 0,
  "QT_EMPATE_FINAL" integer not null default 0,
  "QT_PENDENCIA" integer not null default 0,
  "CO_EXECUCAO" varchar(80) not null,
  "DT_GERACAO" timestamptz not null default now(),
  constraint "PK_TB_RELATORIO_DESEMPATE" primary key ("CO_LISTA_CLASSIFICACAO"),
  constraint "FK_LISTACLASSIF_RELATDESEMP" foreign key ("CO_LISTA_CLASSIFICACAO")
    references public."TB_LISTA_CLASSIFICACAO" ("CO_LISTA_CLASSIFICACAO"),
  constraint "CK_RELATDESEMP_VERSAO" check ("NU_VERSAO_RELATORIO" >= 1),
  constraint "CK_RELATDESEMP_RELATORIO" check (jsonb_typeof("DS_RELATORIO") = 'object'),
  constraint "CK_RELATDESEMP_TAMANHO" check (octet_length("DS_RELATORIO"::text) <= 8000000 and octet_length("DS_TEXTO") <= 8000000),
  constraint "CK_RELATDESEMP_HASH" check ("DS_HASH_LISTA" ~ '^[0-9a-f]{64}$'),
  constraint "CK_RELATDESEMP_QUANTIDADES" check ("QT_GRUPO" >= 0 and "QT_EMPATE_FINAL" >= 0 and "QT_PENDENCIA" >= 0),
  constraint "CK_RELATDESEMP_EXECUCAO" check ("CO_EXECUCAO" ~ '^[A-Za-z0-9_.:-]{1,80}$')
);
comment on table public."TB_RELATORIO_DESEMPATE" is
  'Relatório de desempate de uma lista de classificação gerada (TB_LISTA_CLASSIFICACAO), calculado pelo Python: por vaga, lista e nota, os grupos de empate, os critérios aplicados, o valor de cada candidato, o critério que decidiu cada par e quem ficou empatado até o fim. Sem nomes, CPF ou data de nascimento (candidato = id da análise e código de inscrição). Grava classificacao_gravar_desempate; a tela lê por obter_desempate_da_lista.';
comment on column public."TB_RELATORIO_DESEMPATE"."CO_LISTA_CLASSIFICACAO" is 'Lista gerada a que o relatório pertence (TB_LISTA_CLASSIFICACAO).';
comment on column public."TB_RELATORIO_DESEMPATE"."NU_VERSAO_RELATORIO" is 'Versão do formato do relatório (python/monitora/classificacao/desempate.py, VERSAO_DO_RELATORIO).';
comment on column public."TB_RELATORIO_DESEMPATE"."DS_RELATORIO" is 'O relatório em json estável (versao, tipo, criterios, empateFinal, totais, vagas[].grupos[]).';
comment on column public."TB_RELATORIO_DESEMPATE"."DS_TEXTO" is 'O mesmo relatório em texto legível (exportação).';
comment on column public."TB_RELATORIO_DESEMPATE"."DS_HASH_LISTA" is 'DS_HASH da lista quando o relatório foi gravado: relatório de outra versão do retrato não entra.';
comment on column public."TB_RELATORIO_DESEMPATE"."QT_GRUPO" is 'Grupos de empate de nota no relatório (totais.grupos).';
comment on column public."TB_RELATORIO_DESEMPATE"."QT_EMPATE_FINAL" is 'Grupos com empate até o fim, depois de todos os critérios (totais.empatadosAteOFim).';
comment on column public."TB_RELATORIO_DESEMPATE"."QT_PENDENCIA" is 'Empates que esperavam sorteio ou decisão (totais.pendentes).';
comment on column public."TB_RELATORIO_DESEMPATE"."CO_EXECUCAO" is 'Identificador da execução do job que gravou (monitora.execucao.identificador).';
comment on column public."TB_RELATORIO_DESEMPATE"."DT_GERACAO" is 'Quando o relatório foi gravado.';
alter table public."TB_RELATORIO_DESEMPATE" enable row level security;
revoke all on table public."TB_RELATORIO_DESEMPATE" from public, anon, authenticated;

-- 3. Leitura do edital para o job (service_role) ------------------------------------------
create or replace function public.classificacao_ler_edital(p_edital uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_area text;
  v_dados jsonb;
  v_apelidos jsonb;
begin
  select m."CO_AREA" into v_area from public."TB_MONITORAMENTO_INDIGENA" m where m.id = p_edital;
  if v_area is null then
    raise exception 'Edital não encontrado' using errcode = '22023';
  end if;
  v_dados := private."FC_DADOS_CLASSIFICACAO_EDITAL"(p_edital, v_area)::jsonb;

  -- O apelido: a posição do nome na ordem alfabética do motor (o id da análise desempata).
  select coalesce(jsonb_object_agg(x.id, x.apelido), '{}'::jsonb) into v_apelidos
    from (
      select c.value->>'analise_id' as id,
             lpad(row_number() over (
                    order by coalesce(nullif(btrim(c.value->>'nome'), ''), '(sem nome)') collate private."CL_NOME_PT_BR_BASE",
                             (c.value->>'analise_id') collate "C")::text, 6, '0') as apelido
        from jsonb_array_elements(coalesce(v_dados->'candidatos', '[]'::jsonb)) c
    ) x;

  return jsonb_build_object(
    'schema_version', 1,
    'gerado_em', now(),
    'edital', v_dados->'edital',
    'regra', case when v_dados->'regra' is null or jsonb_typeof(v_dados->'regra') = 'null' then null
                  else jsonb_build_object('versao', v_dados#>'{regra,versao}', 'configuracao', v_dados#>'{regra,configuracao}') end,
    'cronograma', v_dados->'cronograma',
    'quadro', v_dados->'quadro',
    'candidatos', coalesce((
      select jsonb_agg(c.value || jsonb_build_object('nome', v_apelidos->>(c.value->>'analise_id')) order by c.ordinality)
        from jsonb_array_elements(coalesce(v_dados->'candidatos', '[]'::jsonb)) with ordinality c), '[]'::jsonb),
    'entrevistas', coalesce((
      select jsonb_agg(e.value || jsonb_build_object('nome', v_apelidos->>(e.value->>'analise_id')) order by e.ordinality)
        from jsonb_array_elements(coalesce(v_dados->'entrevistas', '[]'::jsonb)) with ordinality e), '[]'::jsonb),
    'desempates', coalesce((
      select jsonb_agg(d.value - 'por' order by d.ordinality)
        from jsonb_array_elements(coalesce(v_dados->'desempates', '[]'::jsonb)) with ordinality d), '[]'::jsonb),
    'ajustes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', j.value->'id', 'recurso_id', j.value->'recurso_id', 'numero', j.value->'numero',
               'analise_id', j.value->'analise_id', 'aprovado_em', j.value->'aprovado_em',
               'itens', coalesce((select jsonb_agg(i.value - 'justificativa' order by i.ordinality)
                                    from jsonb_array_elements(coalesce(j.value->'itens', '[]'::jsonb)) with ordinality i), '[]'::jsonb))
             order by j.ordinality)
        from jsonb_array_elements(coalesce(v_dados->'ajustes', '[]'::jsonb)) with ordinality j), '[]'::jsonb),
    'listas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', l."CO_LISTA_CLASSIFICACAO", 'tipo', l."TP_LISTA", 'versao_regra', l."NU_VERSAO_REGRA",
               'hash', l."DS_HASH", 'gerada_em', l."DT_GERACAO", 'publicada', l."ST_PUBLICADA" = 'S')
             order by l."DT_GERACAO" desc)
        from public."TB_LISTA_CLASSIFICACAO" l
       where l."CO_MONITORAMENTO" = p_edital), '[]'::jsonb),
    'convocacao', jsonb_build_object(
      'configuracoes', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'edital_id', c."CO_EDITAL",
                 'proporcionalidade', c."TP_CONVOCACAO" = 'COM_PROPORCIONALIDADE',
                 'modelo_id', c."CO_MODELO",
                 'padrao_imediata', c."QT_PADRAO_IMEDIATA",
                 'vagas', coalesce((
                   select jsonb_agg(jsonb_build_object(
                            'codigo_vaga', v."CO_VAGA", 'cargo', v."NO_CARGO", 'imediatas', v."QT_VAGA_IMEDIATA",
                            'manual', v."ST_QUADRO_MANUAL" = 'S', 'quadro', v."DS_QUADRO_MANUAL")
                          order by v."CO_VAGA")
                     from public."TB_VAGA_IMEDIATA" v
                    where v."CO_EDITAL" = c."CO_EDITAL"), '[]'::jsonb)))
          from public."TB_CONVOCACAO_EDITAL" c
         where c."CO_EDITAL" = p_edital::text), '[]'::jsonb),
      'modelos', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'modelo_id', m."CO_MODELO",
                 'nome', m."NO_MODELO",
                 'distribuicao', lower(m."TP_DISTRIBUICAO"),
                 'cota_multipla', lower(m."TP_COTA_MULTIPLA"),
                 'categorias', coalesce((
                   select jsonb_agg(jsonb_build_object(
                            'id', k."CO_CATEGORIA", 'rotulo', k."NO_CATEGORIA", 'sigla', k."SG_CATEGORIA",
                            'ampla', k."ST_AMPLA" = 'S', 'acumulavel', k."ST_ACUMULAVEL" = 'S',
                            'percentual', k."TX_RESERVA", 'arredondamento', lower(k."TP_ARREDONDAMENTO"),
                            'teto', k."TX_TETO", 'minimo', k."QT_MINIMA_RESERVA", 'termos', k."DS_TERMO",
                            'posicoes', k."DS_POSICAO", 'intervalo', k."QT_INTERVALO", 'cascata', k."DS_CASCATA")
                          order by k."NU_ORDEM", k."CO_CATEGORIA")
                     from public."TB_CATEGORIA_CONVOCACAO" k
                    where k."CO_MODELO" = m."CO_MODELO"), '[]'::jsonb))
               order by m."NO_MODELO")
          from public."TB_MODELO_CONVOCACAO" m
         where m."CO_MODELO" in (select c."CO_MODELO" from public."TB_CONVOCACAO_EDITAL" c where c."CO_EDITAL" = p_edital::text)),
        '[]'::jsonb)));
end;
$function$;
comment on function public.classificacao_ler_edital(uuid) is
  'Job da classificação em Python (scripts/classificacao/): o json de obter_classificacao_do_edital sem nomes (apelido de 6 dígitos na ordem alfabética do motor, CL_NOME_PT_BR_BASE), sem o conteúdo das listas geradas (id, tipo, hash), sem quem registrou desempates nem autores da regra e dos ajustes, e com a configuração de convocação do edital. Só service_role.';
revoke all on function public.classificacao_ler_edital(uuid) from public, anon, authenticated;
grant execute on function public.classificacao_ler_edital(uuid) to service_role;

-- 4. Gravação do relatório (service_role) -------------------------------------------------
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
  -- Sem dado pessoal: nada de e-mail nem 11 dígitos seguidos (fora os ids das análises).
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

  return jsonb_build_object('lista', p_lista, 'grupos', v_grupos, 'empatados', v_empatados, 'pendentes', v_pendentes);
end;
$function$;
comment on function public.classificacao_gravar_desempate(text, uuid, text, jsonb, text) is
  'Job da classificação em Python: grava (ou troca) o relatório de desempate de uma lista gerada. Confere o hash da lista, a versão e o tipo do relatório, que cada candidato está na lista, os totais e a ausência de dado pessoal (@ ou 11 dígitos fora dos ids). Só service_role.';
revoke all on function public.classificacao_gravar_desempate(text, uuid, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.classificacao_gravar_desempate(text, uuid, text, jsonb, text) to service_role;

-- 5. Leitura do relatório pela tela -------------------------------------------------------
create or replace function public.obter_desempate_da_lista(p_lista uuid)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_edital uuid;
  v_hash text;
begin
  select l."CO_MONITORAMENTO", l."DS_HASH" into v_edital, v_hash
    from public."TB_LISTA_CLASSIFICACAO" l where l."CO_LISTA_CLASSIFICACAO" = p_lista;
  if v_edital is null then
    raise exception 'Lista não encontrada' using errcode = '22023';
  end if;
  perform private."FC_EXIGIR_CLASSIFICACAO_EDITAL"(v_edital, 1);
  return (
    select json_build_object(
             'lista_id', r."CO_LISTA_CLASSIFICACAO",
             'versao', r."NU_VERSAO_RELATORIO",
             'gerado_em', r."DT_GERACAO",
             'da_lista_atual', r."DS_HASH_LISTA" = v_hash,
             'grupos', r."QT_GRUPO",
             'empatados', r."QT_EMPATE_FINAL",
             'pendentes', r."QT_PENDENCIA",
             'relatorio', r."DS_RELATORIO",
             'texto', r."DS_TEXTO")
      from public."TB_RELATORIO_DESEMPATE" r
     where r."CO_LISTA_CLASSIFICACAO" = p_lista);
end;
$function$;
comment on function public.obter_desempate_da_lista(uuid) is
  'O relatório de desempate de uma lista gerada (json e texto), para Classificação › Listas; null quando a lista não tem relatório. Exige classificacao >= leitor, a área e o recorte da coordenação do edital.';
revoke all on function public.obter_desempate_da_lista(uuid) from public, anon;
grant execute on function public.obter_desempate_da_lista(uuid) to authenticated, service_role;

-- ═══ CORPO DA MIGRATION (fim) ═══

create temp table t_ensaio (chave text primary key, valor jsonb) on commit drop;
grant select on t_ensaio to authenticated;

do $$
declare
  v_edital constant uuid := 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0';
  v jsonb;
  v_orig jsonb;
  v_lista public."TB_LISTA_CLASSIFICACAO";
  v_outra uuid;
  v_ids text[];
  v_rel jsonb;
  v_gravado jsonb;
  v_recusas jsonb := '{}'::jsonb;
  v_ordem_ok boolean;
begin
  v := public.classificacao_ler_edital(v_edital);
  v_orig := private."FC_DADOS_CLASSIFICACAO_EDITAL"(v_edital,
              (select m."CO_AREA" from public."TB_MONITORAMENTO_INDIGENA" m where m.id = v_edital))::jsonb;

  if jsonb_array_length(v->'candidatos') <> jsonb_array_length(v_orig->'candidatos')
     or jsonb_array_length(v->'entrevistas') <> jsonb_array_length(v_orig->'entrevistas') then
    raise exception 'ENSAIO: candidatos ou entrevistas diferentes de FC_DADOS_CLASSIFICACAO_EDITAL';
  end if;
  if exists (select 1 from jsonb_array_elements(v->'candidatos') c where coalesce(c->>'nome', '') !~ '^[0-9]{6}$') then
    raise exception 'ENSAIO: candidato sem apelido';
  end if;
  if (select count(distinct c->>'nome') from jsonb_array_elements(v->'candidatos') c) <> jsonb_array_length(v->'candidatos') then
    raise exception 'ENSAIO: apelido repetido';
  end if;
  if exists (select 1 from jsonb_array_elements(v->'entrevistas') e where e->>'nome' is not null and e->>'nome' !~ '^[0-9]{6}$') then
    raise exception 'ENSAIO: entrevista com nome';
  end if;
  if exists (select 1 from jsonb_array_elements(v->'desempates') d where d ? 'por')
     or exists (select 1 from jsonb_array_elements(v->'listas') l where l ? 'resultado')
     or coalesce(v->'regra', '{}'::jsonb) ? 'versoes' or coalesce(v->'regra', '{}'::jsonb) ? 'por' then
    raise exception 'ENSAIO: autor ou retrato com nomes na leitura do job';
  end if;
  -- O apelido segue a ordem dos nomes (CL_NOME_PT_BR_BASE, o id desempata), sem mostrar nome nenhum.
  select coalesce(bool_and(a.apelido_ordem = a.nome_ordem), true) into v_ordem_ok
    from (
      select row_number() over (order by j.value->>'nome') as apelido_ordem,
             row_number() over (order by coalesce(nullif(btrim(o.value->>'nome'), ''), '(sem nome)') collate private."CL_NOME_PT_BR_BASE",
                                         (o.value->>'analise_id') collate "C") as nome_ordem
        from jsonb_array_elements(v->'candidatos') j
        join jsonb_array_elements(v_orig->'candidatos') o on o.value->>'analise_id' = j.value->>'analise_id'
    ) a;

  insert into t_ensaio values ('leitura', jsonb_build_object(
    'candidatos', jsonb_array_length(v->'candidatos'),
    'entrevistas', jsonb_array_length(v->'entrevistas'),
    'desempates', jsonb_array_length(v->'desempates'),
    'ajustes', jsonb_array_length(v->'ajustes'),
    'listas', jsonb_array_length(v->'listas'),
    'quadro', jsonb_array_length(v->'quadro'),
    'configuracoes_de_convocacao', jsonb_array_length(v#>'{convocacao,configuracoes}'),
    'modelos_de_convocacao', jsonb_array_length(v#>'{convocacao,modelos}'),
    'com_regra', coalesce(jsonb_typeof(v->'regra'), 'null') <> 'null',
    'apelidos_na_ordem_dos_nomes', v_ordem_ok));

  -- Gravação de um relatório fictício na última lista do edital.
  select * into v_lista from public."TB_LISTA_CLASSIFICACAO" l
   where l."CO_MONITORAMENTO" = v_edital order by l."DT_GERACAO" desc limit 1;
  select array_agg(x.id #>> '{}') into v_ids
    from (select jsonb_path_query(v_lista."DS_RESULTADO", '$.vagas[*].geral[*].analise_id') as id limit 2) x;
  v_rel := jsonb_build_object(
    'versao', 1, 'tipo', v_lista."TP_LISTA",
    'totais', jsonb_build_object('grupos', 1, 'empatadosAteOFim', 0, 'pendentes', 0),
    'vagas', jsonb_build_array(jsonb_build_object('chave', 'ensaio', 'grupos', jsonb_build_array(jsonb_build_object(
      'candidatos', jsonb_build_array(jsonb_build_object('analiseId', v_ids[1]), jsonb_build_object('analiseId', v_ids[2])))))));
  v_gravado := public.classificacao_gravar_desempate('ensaio-1', v_lista."CO_LISTA_CLASSIFICACAO", v_lista."DS_HASH", v_rel, 'Relatório do ensaio.');
  -- Gravar de novo troca (uma linha por lista).
  v_gravado := public.classificacao_gravar_desempate('ensaio-2', v_lista."CO_LISTA_CLASSIFICACAO", v_lista."DS_HASH", v_rel, 'Relatório do ensaio.');

  begin
    perform public.classificacao_gravar_desempate('ensaio-3', v_lista."CO_LISTA_CLASSIFICACAO", repeat('0', 64), v_rel, 'x');
  exception when sqlstate '22023' then v_recusas := v_recusas || '{"hash_velho": true}';
  end;
  begin
    perform public.classificacao_gravar_desempate('ensaio-4', v_lista."CO_LISTA_CLASSIFICACAO", v_lista."DS_HASH", v_rel, 'contato@exemplo');
  exception when sqlstate '22023' then v_recusas := v_recusas || '{"arroba": true}';
  end;
  begin
    perform public.classificacao_gravar_desempate('ensaio-5', v_lista."CO_LISTA_CLASSIFICACAO", v_lista."DS_HASH",
      jsonb_set(v_rel, '{vagas,0,grupos,0,candidatos,0,analiseId}', to_jsonb(gen_random_uuid()::text)), 'x');
  exception when sqlstate '22023' then v_recusas := v_recusas || '{"fora_da_lista": true}';
  end;
  begin
    perform public.classificacao_gravar_desempate('ensaio-6', v_lista."CO_LISTA_CLASSIFICACAO", v_lista."DS_HASH",
      jsonb_set(v_rel, '{totais,grupos}', '2'), 'x');
  exception when sqlstate '22023' then v_recusas := v_recusas || '{"totais": true}';
  end;
  begin
    perform public.classificacao_gravar_desempate('ensaio-7', v_lista."CO_LISTA_CLASSIFICACAO", v_lista."DS_HASH",
      v_rel - 'versao', 'x');
  exception when sqlstate '22023' then v_recusas := v_recusas || '{"sem_versao": true}';
  end;

  select l."CO_LISTA_CLASSIFICACAO" into v_outra from public."TB_LISTA_CLASSIFICACAO" l
   where l."CO_MONITORAMENTO" = v_edital and l."CO_LISTA_CLASSIFICACAO" <> v_lista."CO_LISTA_CLASSIFICACAO" limit 1;
  insert into t_ensaio values ('gravacao', jsonb_build_object(
    'gravado', v_gravado - 'lista',
    'linhas', (select count(*) from public."TB_RELATORIO_DESEMPATE" r where r."CO_LISTA_CLASSIFICACAO" = v_lista."CO_LISTA_CLASSIFICACAO"),
    'execucao', (select r."CO_EXECUCAO" from public."TB_RELATORIO_DESEMPATE" r where r."CO_LISTA_CLASSIFICACAO" = v_lista."CO_LISTA_CLASSIFICACAO"),
    'recusas', v_recusas));
  perform set_config('ensaio.lista', v_lista."CO_LISTA_CLASSIFICACAO"::text, true);
  perform set_config('ensaio.outra', coalesce(v_outra::text, ''), true);
end;
$$;

-- A tela, como um administrador global.
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"df5b852c-f981-4486-94b9-67857fff8f93","role":"authenticated"}', true);
select json_build_object(
  'leitura', (select valor from t_ensaio where chave = 'leitura'),
  'gravacao', (select valor from t_ensaio where chave = 'gravacao'),
  'tela', json_build_object(
    'com_relatorio', public.obter_desempate_da_lista(current_setting('ensaio.lista')::uuid) is not null,
    'da_lista_atual', public.obter_desempate_da_lista(current_setting('ensaio.lista')::uuid)->>'da_lista_atual',
    'grupos', public.obter_desempate_da_lista(current_setting('ensaio.lista')::uuid)->>'grupos',
    'outra_lista_sem_relatorio', nullif(current_setting('ensaio.outra'), '') is null
                                 or public.obter_desempate_da_lista(nullif(current_setting('ensaio.outra'), '')::uuid) is null)
) as ensaio;

rollback;
