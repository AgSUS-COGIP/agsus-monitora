-- ROLLBACK de supabase/migrations/20261023170000_classificacao_em_python_etapa_2.sql
-- Volta ao estado de 20261023140000 (etapa 1): a leitura do job com apelidos (e a collation),
-- a gravação e a leitura do relatório sem o preparo, registrar_lista_classificacao sem o pedido,
-- FC_DISPARAR_ROBO e FC_CHAVE_DO_WORKFLOW sem classificacao.yml e sem a chave "classificacao".
-- Os relatórios já gravados (TB_RELATORIO_DESEMPATE) ficam; os preparos e os pedidos de
-- classificacao.yml em TL_DISPARO_ROBO saem (a constraint antiga não os aceita).
begin;

set local lock_timeout = '5s';

-- registrar_lista_classificacao: o corpo de 20261016160000 (sem o pedido do relatório).
create or replace function public.registrar_lista_classificacao(p_edital uuid, p_tipo text, p_versao integer, p_resultado jsonb)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_area text := private."FC_EXIGIR_CLASSIFICACAO_EDITAL"(p_edital, 2);
  v_regra public."TB_REGRA_CLASSIFICACAO";
  v_id uuid;
  v_totais jsonb := coalesce(p_resultado -> 'totais', '{}'::jsonb);
  v_qt integer[];
begin
  if p_tipo is null or p_tipo not in ('PRELIMINAR', 'CONVOCACAO', 'ENTREVISTA', 'FINAL') then
    raise exception 'Tipo de lista inválido' using errcode = '22023';
  end if;
  select * into v_regra from public."TB_REGRA_CLASSIFICACAO" where "CO_MONITORAMENTO" = p_edital;
  if v_regra."CO_REGRA_CLASSIFICACAO" is null then
    raise exception 'Salve a regra do edital antes de gerar a lista.' using errcode = '22023';
  end if;
  if p_versao is distinct from v_regra."NU_VERSAO_VIGENTE" then
    raise exception 'A regra mudou (versão %); gere de novo.', v_regra."NU_VERSAO_VIGENTE" using errcode = 'PT409';
  end if;
  if jsonb_typeof(p_resultado) is distinct from 'object' or jsonb_typeof(p_resultado -> 'vagas') is distinct from 'array'
     or p_resultado ->> 'tipo' is distinct from p_tipo then
    raise exception 'Lista inválida.' using errcode = '22023';
  end if;
  if pg_column_size(p_resultado) > 8000000 then
    raise exception 'Lista grande demais para registrar.' using errcode = '22023';
  end if;
  -- Os candidatos do retrato são análises ativas deste edital (20261006070000).
  perform private."FC_EXIGIR_CANDIDATOS_DO_EDITAL"(p_edital, p_resultado);
  select array_agg(case when jsonb_typeof(v_totais -> k) = 'number'
                        then greatest(0, least(1000000, (v_totais ->> k)::numeric))::integer else 0 end order by o)
    into v_qt
    from unnest(array['elegiveis', 'eliminados', 'avisos', 'pendencias']) with ordinality t(k, o);

  insert into public."TB_LISTA_CLASSIFICACAO"
    ("CO_MONITORAMENTO", "TP_LISTA", "CO_REGRA_CLASSIFICACAO", "NU_VERSAO_REGRA", "DS_RESULTADO", "DS_HASH",
     "QT_ELEGIVEL", "QT_ELIMINADO", "QT_AVISO", "QT_PENDENCIA", "CO_USUARIO")
  values (p_edital, p_tipo, v_regra."CO_REGRA_CLASSIFICACAO", v_regra."NU_VERSAO_VIGENTE", p_resultado,
          encode(sha256(convert_to(p_resultado::text, 'UTF8')), 'hex'),
          v_qt[1], v_qt[2], v_qt[3], v_qt[4], (select auth.uid()))
  returning "CO_LISTA_CLASSIFICACAO" into v_id;

  return private."FC_LISTA_CLASSIFICACAO_JSON"(v_id);
end;
$function$;

drop function if exists public.classificacao_marcar_preparo(text, uuid, text, text);
drop function if exists public.classificacao_ler_lista(uuid);
drop function if exists public.classificacao_ler_pedidos_desempate(uuid[]);
drop function if exists private."FC_PEDIR_DESEMPATE"(uuid, uuid);

-- O relatório sem o preparo (20261023140000).
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

drop table if exists public."TB_PREPARO_DESEMPATE";
comment on table public."TB_RELATORIO_DESEMPATE" is
  'Relatório de desempate de uma lista de classificação gerada (TB_LISTA_CLASSIFICACAO), calculado pelo Python: por vaga, lista e nota, os grupos de empate, os critérios aplicados, o valor de cada candidato, o critério que decidiu cada par e quem ficou empatado até o fim. Sem nomes, CPF ou data de nascimento (candidato = id da análise e código de inscrição). Grava classificacao_gravar_desempate; a tela lê por obter_desempate_da_lista.';

-- A leitura do job com apelidos (20261023140000) e a collation do apelido.
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

-- FC_DISPARAR_ROBO e FC_CHAVE_DO_WORKFLOW de 20261022190000.
create or replace function private."FC_DISPARAR_ROBO"(
  p_workflow text,
  p_inputs jsonb default '{}'::jsonb,
  p_usuario uuid default null,
  p_origem text default null)
returns bigint
language plpgsql
security definer
set search_path to ''
as $function$
declare
  -- Lista fixa: workflow → inputs que ele aceita (além de disparado_por).
  c_aceitos constant jsonb := jsonb_build_object(
    'sincronizar-entrevistas.yml', jsonb_build_array('modo'),
    'sincronizar-selecao.yml', jsonb_build_array('modo'),
    'conferencias.yml', jsonb_build_array('modo'),
    'robo-empregare.yml', jsonb_build_array('modo', 'editais', 'vagas', 'limite', 'anexos', 'candidatos', 'seco', 'forcar_congelado'),
    'pre-classificacao.yml', jsonb_build_array('modo', 'editais', 'forcar_congelado'));
  v_inputs jsonb := coalesce(p_inputs, '{}'::jsonb);
  -- AGENDA só do pg_cron: as tarefas passam p_origem = 'AGENDA' (e a sessão do pg_cron
  -- se chama pg_cron); MONITORA com o usuário da tela; MANUAL = SQL direto, sem usuário.
  v_origem constant text := case
    when p_usuario is not null then 'MONITORA'
    when p_origem = 'AGENDA' or current_setting('application_name', true) = 'pg_cron' then 'AGENDA'
    else 'MANUAL' end;
  v_disparado_por constant text := case v_origem
    when 'MONITORA' then p_usuario::text
    when 'AGENDA' then 'AGENDA'
    else 'manual' end;
  v_chave text;
  v_pedido bigint;
  v_disparo bigint;
begin
  if p_workflow is null or not (c_aceitos ? p_workflow) then
    raise exception 'Workflow fora da lista fixa dos robôs' using errcode = '22023';
  end if;
  if p_origem is not null and p_origem <> 'AGENDA' then
    raise exception 'Origem inválida (só AGENDA, nas tarefas do pg_cron)' using errcode = '22023';
  end if;
  if jsonb_typeof(v_inputs) <> 'object'
     or exists (
       select 1 from jsonb_each(v_inputs) i
        where not ((c_aceitos -> p_workflow) ? i.key)
           or jsonb_typeof(i.value) <> 'string'
           or length(i.value #>> '{}') > 20000) then
    raise exception 'Inputs inválidos para %', p_workflow using errcode = '22023';
  end if;

  -- [chaves-da-automacao] Chave desligada (20261022190000): a agenda não pede nada.
  -- O Rodar agora (MONITORA) e o SQL direto (MANUAL) seguem.
  if v_origem = 'AGENDA'
     and not private."FC_AUTOMACAO_LIGADA"(private."FC_CHAVE_DO_WORKFLOW"(p_workflow)) then
    return null;
  end if;

  -- O nome do segredo é sempre github_disparo_robos; a configuração da sessão
  -- agsus.segredo_disparo_robos só existe para o ensaio simular a chave ausente
  -- (set local) sem tocar no Vault nem ler o valor.
  select nullif(btrim(s.decrypted_secret), '')
    into v_chave
    from vault.decrypted_secrets s
   where s.name = coalesce(nullif(current_setting('agsus.segredo_disparo_robos', true), ''), 'github_disparo_robos')
   order by s.updated_at desc nulls last
   limit 1;

  if v_chave is null then
    insert into public."TL_DISPARO_ROBO" ("NO_WORKFLOW", "TP_ORIGEM", "CO_USUARIO", "TP_SITUACAO", "DS_MENSAGEM")
    values (p_workflow, v_origem, p_usuario, 'SEM_TOKEN', 'Sem a chave github_disparo_robos no Vault.')
    returning "CO_DISPARO" into v_disparo;
    return v_disparo;
  end if;

  begin
    v_pedido := net.http_post(
      url := 'https://api.github.com/repos/AgSUS-COGIP/agsus-monitora/actions/workflows/' || p_workflow || '/dispatches',
      body := jsonb_build_object(
        'ref', 'main',
        'inputs', v_inputs || jsonb_build_object('disparado_por', v_disparado_por)),
      headers := jsonb_build_object(
        'Accept', 'application/vnd.github+json',
        'Authorization', 'Bearer ' || v_chave,
        'X-GitHub-Api-Version', '2022-11-28',
        'User-Agent', 'agsus-monitora-agenda',
        'Content-Type', 'application/json'),
      timeout_milliseconds := 10000);
  exception when others then
    -- Só o código do erro: a mensagem poderia citar o pedido.
    v_chave := null;
    insert into public."TL_DISPARO_ROBO" ("NO_WORKFLOW", "TP_ORIGEM", "CO_USUARIO", "TP_SITUACAO", "DT_RESPOSTA", "DS_MENSAGEM")
    values (p_workflow, v_origem, p_usuario, 'FALHOU', now(), 'O pg_net recusou o pedido (' || sqlstate || ').')
    returning "CO_DISPARO" into v_disparo;
    return v_disparo;
  end;
  v_chave := null;

  insert into public."TL_DISPARO_ROBO" ("NO_WORKFLOW", "TP_ORIGEM", "CO_USUARIO", "CO_PEDIDO_HTTP", "TP_SITUACAO")
  values (p_workflow, v_origem, p_usuario, v_pedido, 'PEDIDO')
  returning "CO_DISPARO" into v_disparo;
  return v_disparo;
end;
$function$;
comment on function private."FC_DISPARAR_ROBO"(text, jsonb, uuid, text) is
  'Único caminho do banco até o GitHub (20261008140000): pede a execução (workflow_dispatch, ramo main) de um workflow da lista fixa, com os inputs que ele aceita (texto até 20000; o robô da Empregare aceita modo, editais, vagas, limite, anexos, candidatos, seco e forcar_congelado; a pré-classificação, modo, editais e forcar_congelado). Origem (20261020170000): MONITORA com p_usuario (vai como disparado_por); AGENDA só do pg_cron (p_origem = AGENDA nas tarefas ou a sessão pg_cron; disparado_por = AGENDA); MANUAL quando chamada direto pelo SQL, sem usuário (disparado_por = manual). Chaves da automação (20261022190000): na origem AGENDA, com a chave do workflow desligada (FC_CHAVE_DO_WORKFLOW, TB_CHAVE_AUTOMACAO), não pede nada e devolve nulo. Lê a chave github_disparo_robos do Vault na hora e só a entrega ao pg_net; sem a chave, registra SEM_TOKEN e sai sem erro. Grava o pedido em TL_DISPARO_ROBO e devolve o CO_DISPARO. 22023 para workflow fora da lista, origem ou input recusado. Só o dono (pg_cron e as RPCs SECURITY DEFINER).';
revoke all on function private."FC_DISPARAR_ROBO"(text, jsonb, uuid, text) from public, anon, authenticated, service_role;

create or replace function private."FC_CHAVE_DO_WORKFLOW"(p_workflow text)
returns text
language sql
immutable
set search_path to ''
as $function$
  select case p_workflow
    when 'sincronizar-entrevistas.yml' then 'entrevistas'
    when 'sincronizar-selecao.yml' then 'selecao'
    when 'conferencias.yml' then 'conferencias'
    when 'robo-empregare.yml' then 'robo_de_inscricoes'
    when 'pre-classificacao.yml' then 'pre_classificacao'
  end;
$function$;
comment on function private."FC_CHAVE_DO_WORKFLOW"(text) is
  'Chave da automação que manda nos pedidos da agenda (origem AGENDA) de cada workflow da lista fixa de FC_DISPARAR_ROBO. 20261022190000.';
revoke all on function private."FC_CHAVE_DO_WORKFLOW"(text) from public, anon, authenticated, service_role;

delete from public."TL_DISPARO_ROBO" where "NO_WORKFLOW" = 'classificacao.yml';
alter table public."TL_DISPARO_ROBO" drop constraint "CK_DISPROBO_NOWORKFLOW";
alter table public."TL_DISPARO_ROBO" add constraint "CK_DISPROBO_NOWORKFLOW" check ("NO_WORKFLOW" = any (array[
  'sincronizar-entrevistas.yml', 'sincronizar-selecao.yml', 'conferencias.yml', 'expurgo-anexos-chat.yml',
  'robo-empregare.yml', 'pre-classificacao.yml', 'leitura-de-arquivos.yml']));

-- A chave "classificacao" (o histórico dela sai junto: on delete cascade).
delete from public."TB_CHAVE_AUTOMACAO" where "CO_CHAVE" = 'classificacao';
alter table public."TB_CHAVE_AUTOMACAO" drop constraint "CK_CHAVEAUTOM_COCHAVE";
alter table public."TB_CHAVE_AUTOMACAO" add constraint "CK_CHAVEAUTOM_COCHAVE" check ("CO_CHAVE" in (
  'entrevistas', 'selecao', 'kpis_do_edital', 'robo_de_inscricoes',
  'pre_classificacao', 'conferencias', 'paineis', 'manutencao'));
comment on constraint "CK_CHAVEAUTOM_COCHAVE" on public."TB_CHAVE_AUTOMACAO" is 'Só as chaves da lista fixa.';

commit;
