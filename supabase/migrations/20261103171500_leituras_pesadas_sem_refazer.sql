/*
  LEITURAS PESADAS SEM REFAZER O QUE NÃO MUDOU (03/11/2026)

  pg_stat_statements (14/10 a 03/11/2026) e medição em begin … rollback
  (03/11/2026, conta do setor, administrador global):

    RPC                                    chamadas  média    causa
    obter_fila_avaliacao_desde                1.322  973 ms   toda volta à lista refaz a marca
                                                              (md5 da pré-classificação do
                                                              edital) e chama
                                                              FC_FILA_AVALIACAO_JSON, mesmo sem
                                                              nada mudar
    listar_listas_aprovados                     295  976 ms   conta os candidatos lendo as
                                                              linhas da tabela (35 mil, ~3 mil
                                                              páginas; 2,3 s a frio)
    listar_municipios_das_vagas_da_area         253  1,1 s    FC_TEXTO_BUSCA_RECURSO (com
                                                              search_path: não é embutida) e a
                                                              expressão regular por PAR
                                                              análise × município (Projetos:
                                                              ~2,9 mil × ~100)
    listar_monitoramento_operacional            570  579 ms   FC_SE_MUDOU monta o payload
                                                              inteiro (330 KB) para comparar
    abrir_lista_aprovados                        46  1,0 s    o pacote da área (TA_CANDIDATO_
    listar_candidatos_aprovados_compacto        277  807 ms   APROVADO_AREA) era dado por
                                                              vencido a QUALQUER update de
                                                              TB_CANDIDATO_APROVADO (data da
                                                              convocação, quem atualizou…) e
                                                              quem abria remontava e regravava
                                                              o pacote na leitura (SI: 1,2 s
                                                              frio, 0,3 s quente)

  O QUE MUDA (mesmas assinaturas, retornos e permissões)
    1. Fila (obter_fila_avaliacao_desde): nova leitura com marca barata
       'fila_avaliacao' (private."TD_LEITURA_POR_MARCA", 20261029170000). A
       marca devolvida passa a ser "<marca de sempre>.<marca barata>.<total do
       núcleo>" (opaca para a tela). Com p_desde, a marca barata igual e
       nenhuma reserva do edital vencida entre p_desde − 2 min e agora, devolve
       uma PARCIAL VAZIA — { marca, parcial: true, total_nucleo,
       candidatos: [], saiu: [] } — sem montar nada: a tela (fila-por-
       mudancas.ts) junta à fila que tem e fica com ela, inclusive com o
       gerado_em anterior (a próxima leitura parte de lá). É o que a parcial de
       antes daria sem mudança (as linhas iguais trocadas por elas mesmas, o
       resto da fila igual). Senão, o caminho de sempre, comparando só a
       primeira parte da marca. O que depende do relógio na fila é só a reserva
       vigente (FC_LINHAS_DA_FILA, DT_RESERVA_EXPIRA > now()): por isso a
       conferência das reservas vencidas.
    2. Monitoramento operacional: leitura com marca 'monitoramento_operacional'
       (a função, a view e as funções das políticas de RLS de
       TB_MONITORAMENTO_INDIGENA, porque a view é security_invoker), com a data
       de hoje na chave (a view usa CURRENT_DATE). Marca igual:
       { inalterado, versao } sem montar; senão o payload de sempre com a marca
       como versao. Sem fontes registradas: FC_SE_MUDOU, como antes.
    3. Listas de aprovados: a contagem por lista vai pelo índice parcial novo
       "IN_CANDAPROVADO_LISTAVIVA" (lista_id) where removido_em is null, numa
       subconsulta por lista (index-only), como abrir_lista_aprovados já faz.
    4. Municípios das vagas: o texto de busca sai uma vez por município e por
       análise; strpos antes da expressão regular (só sem caractere especial no
       nome do município); "UBS m" antes do regexp_match da UBS móvel.
    5. Pacote dos aprovados: os gatilhos de TB_CANDIDATO_APROVADO e
       TB_LISTA_APROVADO só marcam a área no UPDATE quando muda uma coluna que
       FC_MONTAR_APROVADOS_AREA lê (ou a linha entra/sai). Insert e delete
       continuam marcando sempre.

  Ao fim, private."FC_ATUALIZAR_FONTES_DAS_LEITURAS"() (fontes das leituras
  novas e os gatilhos nelas).

  Para aplicar, a guarda confere que as funções trocadas são as do banco de
  03/11/2026 (md5 do código sem \r), ou já as desta.

  Ensaio:   supabase/ensaios/20261103171500_leituras_pesadas_sem_refazer.sql
  Rollback: supabase/rollback/20261103171500_leituras_pesadas_sem_refazer.sql
  Teste:    tests/leituras-pesadas-sem-refazer-migration.test.js
*/
begin;

set local lock_timeout = '10s';

-- 0. As funções que esta migration troca são as que ela conhece (ou já as desta) ---------
do $guarda$
declare
  v_esperado constant jsonb := jsonb_build_object(
    'obter_fila_avaliacao_desde', '608748ef8f219d2f59538e99467952f1',
    'listar_listas_aprovados', 'eaa96e1695fb23274d4359fd0c379dd9',
    'listar_municipios_das_vagas_da_area', 'd33d8485a94bc6a370f5342df13b26bc',
    'listar_monitoramento_operacional', '39073735bd817b31722e19c568561ada',
    'FC_TG_CACHE_CANDIDATO_APROVADO', '55ea534bf2b189f7002fe8769e0c2551',
    'FC_TG_CACHE_LISTA_APROVADO', '0758f9a180c54724277ea05a1a65c473');
  v_diferentes text;
begin
  select string_agg(p.proname, ', ' order by p.proname) into v_diferentes
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace and n.nspname in ('public', 'private')
   where v_esperado ? p.proname
     and md5(replace(p.prosrc, chr(13), '')) <> v_esperado ->> p.proname::text
     and p.prosrc not like '%20261103171500%';
  if v_diferentes is not null then
    raise exception 'Função(ões) diferente(s) da que esta migration conhece: %. Refaça a migration sobre a versão do banco.', v_diferentes;
  end if;
end;
$guarda$;

-- 1. As leituras novas com marca barata ------------------------------------------------------
insert into private."TD_LEITURA_POR_MARCA" ("NO_LEITURA", "DS_FUNCOES", "DS_FONTES_EXTRAS", "DS_LEITURA")
values
  ('fila_avaliacao',
   array['FC_FILA_AVALIACAO_JSON', 'FC_PAPEL_AVALIACAO', 'FC_VAGAS_DO_ANALISTA', 'FC_EXIGIR_AVALIACAO_EDITAL'],
   array['public.TB_PRE_CLASSIFICACAO', 'public.TB_PRE_CLASSIF_VAGA', 'public.TB_FICHA_ANALISE'],
   'obter_fila_avaliacao_desde: a fila da Avaliação documental de um edital (chave: o edital). As extras são as que a própria RPC lê para a marca de sempre e as fichas mudadas.'),
  ('monitoramento_operacional',
   array['listar_monitoramento_operacional', 'FC_AREAS_USUARIO', 'FC_EDITAIS_VISIVEIS', 'has_perm', 'pode_recurso'],
   '{}',
   'listar_monitoramento_operacional: as linhas ativas da VW_MONITORAMENTO_INDIGENA_OPERACIONAL (security_invoker: as funções das políticas de TB_MONITORAMENTO_INDIGENA entram no fecho; chave: a data de hoje).')
on conflict ("NO_LEITURA") do update set
  "DS_FUNCOES" = excluded."DS_FUNCOES",
  "DS_FONTES_EXTRAS" = excluded."DS_FONTES_EXTRAS",
  "DS_LEITURA" = excluded."DS_LEITURA";

-- 2. A fila: parcial vazia sem montar, quando nada mudou ----------------------------------------
create or replace function public.obter_fila_avaliacao_desde(
  p_edital uuid, p_desde timestamptz default null, p_marca text default null)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_parcial boolean := p_desde is not null and p_marca is not null;
  v_uid uuid := (select auth.uid());
  v_papel text;
  v_vagas text[];
  v_vagas_json json;
  v_ids uuid[];
  v json;
  v_marca text;
  v_barata text;
  v_partes text[] := string_to_array(coalesce(p_marca, ''), '.');
  v_total bigint;
begin
  -- A permissão primeiro (a montagem confere de novo, lá dentro).
  perform private."FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 1);

  -- Marca barata (20261103171500): nenhuma fonte da fila mudou desde a leitura anterior
  -- (nem quem lê) e nenhuma reserva do edital venceu desde p_desde − 2 min: a parcial
  -- vazia, sem montar nada. Mesmo snapshot da montagem (função stable).
  v_barata := private."FC_MARCA_DA_LEITURA"('fila_avaliacao', p_edital::text);
  if v_parcial and v_barata is not null and cardinality(v_partes) = 3
     and v_partes[2] = v_barata and v_partes[3] ~ '^[0-9]{1,9}$'
     and not exists (
       select 1 from public."TB_FICHA_ANALISE" f
        where f."CO_MONITORAMENTO" = p_edital
          and f."DT_RESERVA_EXPIRA" >= p_desde - interval '2 minutes'
          and f."DT_RESERVA_EXPIRA" <= now()) then
    return json_build_object(
      'marca', p_marca, 'parcial', true, 'total_nucleo', v_partes[3]::bigint,
      'candidatos', '[]'::json, 'saiu', '[]'::json);
  end if;

  -- A marca de sempre, com o que a montagem usaria: papel, recorte de vagas do analista e
  -- as vagas no mesmo JSON da chave "vagas".
  v_papel := private."FC_PAPEL_AVALIACAO"(p_edital);
  if coalesce(v_papel, '') = 'ANALISTA' then
    v_vagas := private."FC_VAGAS_DO_ANALISTA"(p_edital, v_uid);
  end if;
  v_vagas_json := coalesce((
    select json_agg(json_build_object('codigo', pv."CO_VAGA", 'cargo', pv."NO_CARGO", 'lotacao', pv."NO_LOTACAO")
                    order by pv."CO_VAGA")
      from public."TB_PRE_CLASSIF_VAGA" pv
     where pv."CO_MONITORAMENTO" = p_edital
       and (v_vagas is null or pv."CO_VAGA" = any (v_vagas))), '[]'::json);
  select md5(concat_ws('|', count(*), max(a."DT_ATUALIZACAO"), max(a."CO_EXECUCAO"),
                       v_uid::text, v_papel, v_vagas_json::text))
    into v_marca
    from public."TB_PRE_CLASSIFICACAO" a
   where a."CO_MONITORAMENTO" = p_edital;

  -- Outra marca (pré-classificação regravada, outro recorte, papel ou pessoa): a inteira.
  if v_parcial and v_partes[1] is distinct from v_marca then
    v_parcial := false;
  end if;

  if v_parcial then
    -- As fichas que mudaram desde a leitura anterior (a margem de 2 min cobre as transações
    -- que gravaram com now() anterior à leitura e terminaram depois dela).
    select coalesce(array_agg(f."CO_EMPREGARE_CANDIDATO"), '{}'::uuid[])
      into v_ids
      from public."TB_FICHA_ANALISE" f
     where f."CO_MONITORAMENTO" = p_edital
       and (f."DT_ATUALIZACAO" >= p_desde - interval '2 minutes'
            or f."DT_RESERVA_EXPIRA" >= p_desde - interval '2 minutes');
  end if;

  -- Parcial: só as linhas desses inscritos e o total do núcleo; senão, a fila inteira.
  v := private."FC_FILA_AVALIACAO_JSON"(p_edital, case when v_parcial then v_ids end);
  if v is null then
    return null;
  end if;

  -- A marca que sai: a de sempre, a barata e o total do núcleo (o da parcial vazia).
  v_total := case when v_parcial then (v ->> 'total_nucleo')::bigint
                  else json_array_length(v -> 'candidatos') end;
  if v_barata is not null then
    v_marca := v_marca || '.' || v_barata || '.' || v_total::text;
  end if;

  if not v_parcial then
    return (
      select json_object_agg(x.k, x.v order by x.o)
        from (select t.k, t.v, t.o from json_each(v) with ordinality t(k, v, o)
              union all select 'marca', to_json(v_marca), 100000
              union all select 'parcial', to_json(false), 100001) x);
  end if;

  return (
    select json_object_agg(x.k, x.v order by x.o)
      from (select t.k, t.v, t.o
              from json_each(v) with ordinality t(k, v, o)
             where t.k not in ('candidatos', 'vagas', 'total_nucleo')
            union all select 'marca', to_json(v_marca), 100000
            union all select 'parcial', to_json(true), 100001
            union all select 'total_nucleo', v -> 'total_nucleo', 100002
            union all select 'candidatos', v -> 'candidatos', 100003
            union all
            select 'saiu', coalesce((
                     select json_agg(i)
                       from unnest(v_ids) i
                      where not exists (select 1 from json_array_elements(v -> 'candidatos') e
                                         where (e ->> 'id')::uuid = i)), '[]'::json), 100004) x);
end;
$$;

comment on function public.obter_fila_avaliacao_desde(uuid, timestamptz, text) is
  'obter_fila_avaliacao só com o que mudou (20261014231000; sem montar a fila inteira desde 20261019150000; marca conferida antes de montar desde 20261022181000): sem p_desde ou com outra marca, a fila inteira com marca e parcial false; com o gerado_em e a marca da leitura anterior, só as linhas do núcleo cuja ficha mudou (ou cuja reserva vence) desde p_desde − 2 min, os ids que saíram do núcleo (saiu), total_nucleo e o resto da fila sem vagas. Desde 20261103171500 a marca leva a marca barata (fila_avaliacao) e o total do núcleo: sem fonte mudada e sem reserva vencida desde p_desde − 2 min, a parcial vazia (marca, parcial, total_nucleo, candidatos e saiu vazios) sem montar nada. Mesma permissão.';

-- 3. Monitoramento operacional: inalterado pela marca barata ------------------------------------
-- A RPC é security invoker (a view aplica a RLS de quem lê) e FC_MARCA_DA_LEITURA não é
-- de authenticated: a marca desta leitura sai por uma função própria, sem parâmetro.
create or replace function private."FC_MARCA_DO_MONITORAMENTO_OPERACIONAL"()
returns text
language sql
stable
security definer
set search_path to ''
as $function$
  -- A view usa CURRENT_DATE (cronograma): a data entra na chave.
  select private."FC_MARCA_DA_LEITURA"('monitoramento_operacional', current_date::text);
$function$;

revoke all on function private."FC_MARCA_DO_MONITORAMENTO_OPERACIONAL"() from public, anon;
grant execute on function private."FC_MARCA_DO_MONITORAMENTO_OPERACIONAL"() to authenticated, service_role;
comment on function private."FC_MARCA_DO_MONITORAMENTO_OPERACIONAL"() is
  'A marca barata da leitura monitoramento_operacional (fontes, quem lê e a data de hoje) para listar_monitoramento_operacional, que é security invoker (20261103171500).';

create or replace function public.listar_monitoramento_operacional(p_versao text default null::text)
returns jsonb
language plpgsql
stable
set search_path to ''
as $function$
declare
  -- Marca barata com a data de hoje na chave (20261103171500).
  v_marca constant text := private."FC_MARCA_DO_MONITORAMENTO_OPERACIONAL"();
  v_payload jsonb;
begin
  if v_marca is not null and p_versao = v_marca then
    return jsonb_build_object('inalterado', true, 'versao', v_marca);
  end if;
  v_payload := jsonb_build_object('linhas', coalesce((
    select jsonb_agg(to_jsonb(l) order by l.unidade, l.edital)
      from (
        select v.aprovados_analise, v.aprovados_prova, v.aptos_analise, v.ativo,
               v.cancelados, v.cargos, v.ciclo, v.contratados,
               v.cronograma_atividade_atual, v.cronograma_automatico,
               v.cronograma_dias_para_proxima, v.cronograma_percentual,
               v.cronograma_proxima_atividade, v.cronograma_proxima_data,
               v.data_fim, v.data_inicio, v.edital, v.eliminados_nota,
               v.entrevistados, v.etapa, v.id, v.id_unidade, v.inscritos,
               v.link_edital, v.observacoes, v.observacoes_internas, v.processo,
               v.reprovados_analise, v.responsavel, v.risco, v.sigla_unidade,
               v.status, v.tipo_unidade, v.total_eliminados, v.uf, v.unidade,
               v.vagas_ociosas, v.vagas_total, v."CO_AREA", v."ST_TREINAMENTO",
               v."TP_FONTE_FUNIL", v."DT_FONTE_FUNIL"
          from public."VW_MONITORAMENTO_INDIGENA_OPERACIONAL" v
         where v.ativo is true
      ) l), '[]'::jsonb));
  if v_marca is null then
    return private."FC_SE_MUDOU"(v_payload, p_versao);
  end if;
  return v_payload || jsonb_build_object('versao', v_marca);
end;
$function$;

comment on function public.listar_monitoramento_operacional(text) is
  'As linhas ativas da VW_MONITORAMENTO_INDIGENA_OPERACIONAL (security_invoker), por versão: com p_versao igual à marca barata monitoramento_operacional (fontes da view e das políticas de RLS, quem lê e a data de hoje), { inalterado, versao } sem montar (20261103171500); senão { linhas, versao }. Sem fontes registradas, FC_SE_MUDOU (md5 do payload), como antes.';

-- 4. Listas de aprovados: a contagem pelo índice -------------------------------------------------
create index if not exists "IN_CANDAPROVADO_LISTAVIVA"
  on public."TB_CANDIDATO_APROVADO" (lista_id) where removido_em is null;
comment on index public."IN_CANDAPROVADO_LISTAVIVA" is
  'Candidatos não removidos por lista (20261103171500): a contagem de listar_listas_aprovados e de abrir_lista_aprovados sem ler as linhas.';

create or replace function public.listar_listas_aprovados()
returns table(lista_id uuid, edital_id text, edital text, unidade text, ativo boolean, arquivo_nome text, arquivo_path text, importado_em timestamp with time zone, total_candidatos bigint, importado_por_email text, importado_por_nome text, origem text, lista_classificacao_id uuid)
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if not ((private.pode_recurso('aprovados') or private.pode_recurso('importacao',2))) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;
  -- A contagem por lista pelo índice IN_CANDAPROVADO_LISTAVIVA (20261103171500).
  return query
  select l.id, l.edital_id, m.edital, m.unidade, l.ativo, l.arquivo_nome,
         l.arquivo_path, l.importado_em,
         (select count(*) from public."TB_CANDIDATO_APROVADO" c
           where c.lista_id = l.id and c.removido_em is null),
         l."DS_EMAIL_IMPORTACAO"::text, l."NO_USUARIO_IMPORTACAO"::text,
         l."TP_ORIGEM"::text, l."CO_LISTA_CLASSIFICACAO"
  from public."TB_LISTA_APROVADO" l
  join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id
  where l.vigente is true
    and m."CO_AREA" = any ((select private."FC_AREAS_USUARIO"())::text[])
      and ((select private."FC_EDITAIS_VISIVEIS"()) is null or m.id = any ((select private."FC_EDITAIS_VISIVEIS"())::uuid[]))
  order by m.edital, m.unidade;
end;
$function$;

-- 5. Municípios das vagas ---------------------------------------------------------------------
create or replace function public.listar_municipios_das_vagas_da_area(p_area text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
 SET statement_timeout TO '5s'
AS $function$
declare
  v_grupos_norm text[];
  v_area text := lower(btrim(coalesce(p_area, '')));
begin
  if not private.pode_recurso('dashboard') then
    raise exception 'Sem permissão para este recurso' using errcode = '42501';
  end if;

  -- Valida a área e confere se ela é do usuário (ou se ele é admin).
  v_grupos_norm := private."FC_GRUPOS_ANALISES_DA_AREA"(p_area);

  return coalesce((
    with
    -- Os locais publicados nos editais da área.
    loc as (
      select l."CO_MONITORAMENTO" as id,
             m.edital,
             m.unidade as projeto,
             private."FC_NUMERO_EDITAL"(m.edital) as numero,
             l."CO_MUNICIPIO_IBGE" as ibge,
             l."NO_MUNICIPIO" as municipio,
             l."SG_UF" as uf,
             case when l."CO_MUNICIPIO_IBGE" is null then 'uf:' || l."SG_UF"
                  else private."FC_TEXTO_BUSCA_RECURSO"(l."NO_MUNICIPIO") || '/' || l."SG_UF" end as chave,
             l."QT_VAGA" as qt,
             l."ST_CADASTRO_RESERVA" = 'S' as cr,
             l."NO_LOTACAO" as lotacao,
             l."TP_ORIGEM" as origem
        from public."TB_LOCAL_VAGA_EDITAL" l
        join public."TB_MONITORAMENTO_INDIGENA" m on m.id = l."CO_MONITORAMENTO"
       where l."ST_REGISTRO_ATIVO" = 'S'
         and m."CO_AREA" = v_area
         and m.ativo is not false
    ),
    -- Um edital da área por número (o ativo primeiro), para dar nome às análises.
    edital_da_area as (
      select distinct on (private."FC_NUMERO_EDITAL"(m.edital))
             m.id, m.edital, m.unidade, private."FC_NUMERO_EDITAL"(m.edital) as numero
        from public."TB_MONITORAMENTO_INDIGENA" m
       where m."CO_AREA" = v_area
         and private."FC_NUMERO_EDITAL"(m.edital) is not null
       order by private."FC_NUMERO_EDITAL"(m.edital), m.ativo desc nulls last, m.id
    ),
    -- Análises da área no recorte "ativo" do painel: pela área da análise
    -- (CO_AREA, a fonte canônica) ou pelo grupo da planilha, como antes.
    analise as (
      select ac.id, ac.codigo_vaga, ac.nome_vaga, ac.status_consolidado, ac.unidade, ac.edital,
             private."FC_NUMERO_EDITAL"(ac.edital) as numero
        from public."TB_ANALISE_CURRICULAR" ac
        left join public."TB_EDITAL_ANALISE" e
          on e.grupo_norm = ac.grupo_norm
         and e.unidade_norm = ac.unidade_norm
         and e.edital_norm = ac.edital_norm
       where (ac."CO_AREA" = v_area or ac.grupo_norm = any (v_grupos_norm))
         and ac.ativo is true
         and coalesce(e.ativo, true) is true
    ),
    -- Cada análise no seu município: "UBS móvel <Município>/<UF>" no nome da
    -- vaga, ou o nome de um município de local do mesmo edital (palavra inteira).
    -- O texto de busca sai uma vez por município e uma vez por análise (antes,
    -- uma vez por par análise × município); o strpos descarta, antes da
    -- expressão regular, o par que ela nunca casaria — só quando o nome do
    -- município não tem caractere especial de expressão regular (20261103171500).
    municipio_do_edital as materialized (
      select x.numero, x.chave, x.municipio, x.uf, x.texto,
             x.texto !~ '^[a-z0-9 ''-]*$' as especial
        from (select distinct l.numero, l.chave, l.municipio, l.uf,
                     private."FC_TEXTO_BUSCA_RECURSO"(l.municipio) as texto
                from loc l
               where l.ibge is not null) x
    ),
    texto_da_analise as materialized (
      select a.id, a.codigo_vaga, a.status_consolidado, a.numero, a.unidade, a.edital,
             private."FC_TEXTO_BUSCA_RECURSO"(a.nome_vaga) as texto
        from analise a
       where a.numero in (select m.numero from municipio_do_edital m)
    ),
    casada as (
      select a.id, a.codigo_vaga, a.status_consolidado, a.numero, a.unidade, a.edital,
             private."FC_TEXTO_BUSCA_RECURSO"(btrim(mu.partes[1])) || '/' || mu.partes[2] as chave,
             btrim(mu.partes[1]) as municipio, mu.partes[2] as uf
        from analise a
       cross join lateral regexp_match(a.nome_vaga, 'UBS m[óo]vel ([^/]+)/([A-Z]{2})') as mu(partes)
       where a.nome_vaga like '%UBS m%'
         and btrim(mu.partes[1]) <> ''
      union
      select t.id, t.codigo_vaga, t.status_consolidado, t.numero, t.unidade, t.edital,
             l.chave, l.municipio, l.uf
        from texto_da_analise t
        join municipio_do_edital l
          on l.numero = t.numero
         and (l.especial or strpos(t.texto, l.texto) > 0)
         and t.texto ~ ('(^|[^a-z0-9])' || l.texto || '($|[^a-z0-9])')
    ),
    estatistica as (
      select chave,
             min(municipio) as municipio,
             min(uf) as uf,
             count(distinct codigo_vaga) as vagas,
             count(distinct id) as candidatos,
             count(distinct id) filter (where status_consolidado ilike 'aprovad%') as aprovados,
             count(distinct id) filter (where status_consolidado ilike 'reprovad%') as reprovados
        from casada
       group by chave
    ),
    -- Os editais de cada lugar: o que veio da tabela e o que veio das análises.
    edital_do_local as (
      select chave, numero, id, edital, projeto, qt, cr, lotacao, origem from loc
      union all
      select c.chave, c.numero, e.id, coalesce(e.edital, c.edital), coalesce(e.unidade, c.unidade),
             null::integer, false, null::varchar, 'NOME_VAGA'
        from (select chave, numero, min(unidade) as unidade, min(edital) as edital
                from casada group by chave, numero) c
        left join edital_da_area e on e.numero = c.numero
    ),
    por_edital as (
      select chave, numero,
             coalesce((array_agg(id) filter (where origem <> 'NOME_VAGA' and id is not null))[1],
                      (array_agg(id) filter (where id is not null))[1]) as id,
             coalesce(min(edital) filter (where origem <> 'NOME_VAGA'), min(edital)) as edital,
             coalesce(min(projeto) filter (where origem <> 'NOME_VAGA'), min(projeto)) as projeto,
             sum(qt) as vagas,
             coalesce(bool_or(cr), false) as cr,
             array_agg(distinct origem order by origem) as origens,
             coalesce(array_agg(distinct lotacao order by lotacao) filter (where lotacao is not null), '{}') as lotacoes
        from edital_do_local
       group by chave, numero
    ),
    lugar as (
      select chave, min(ibge) as ibge, min(municipio) as municipio, min(uf) as uf
        from loc
       group by chave
    ),
    chaves as (
      select chave from loc
      union
      select chave from casada
    ),
    linha as (
      select k.chave,
             k.chave like 'uf:%' as so_uf,
             coalesce(l.municipio, s.municipio) as municipio,
             coalesce(l.uf, s.uf) as uf,
             l.ibge,
             s.vagas, s.candidatos, s.aprovados, s.reprovados,
             c."CG_LATITUDE" as latitude,
             c."CG_LONGITUDE" as longitude,
             c."TP_ORIGEM" as coordenada_origem
        from chaves k
        left join lugar l on l.chave = k.chave
        left join estatistica s on s.chave = k.chave
        left join public."TB_COORDENADA_LOCAL_VAGA" c on c."DS_CHAVE_LUGAR" = k.chave
    )
    select json_agg(json_build_object(
      'lugar', r.chave,
      'municipio_uf', case when r.so_uf then null else r.municipio || '/' || r.uf end,
      'municipio', case when r.so_uf then null else r.municipio end,
      'uf', r.uf,
      'codigo_ibge', r.ibge,
      'nivel', case when r.so_uf then 'uf' else 'municipio' end,
      'latitude', r.latitude,
      'longitude', r.longitude,
      'coordenada_origem', r.coordenada_origem,
      'vagas', coalesce(r.vagas, 0),
      'candidatos', coalesce(r.candidatos, 0),
      'aprovados', coalesce(r.aprovados, 0),
      'reprovados', coalesce(r.reprovados, 0),
      'vagas_edital', (select sum(p.vagas) from por_edital p where p.chave = r.chave),
      'cadastro_reserva', coalesce((select bool_or(p.cr) from por_edital p where p.chave = r.chave), false),
      'projetos', coalesce((select json_agg(distinct p.projeto) from por_edital p
                             where p.chave = r.chave and p.projeto is not null), '[]'::json),
      'editais', coalesce((select json_agg(json_build_object(
                             'id', p.id,
                             'edital', p.edital,
                             'projeto', p.projeto,
                             'vagas', p.vagas,
                             'cadastro_reserva', p.cr,
                             'origens', p.origens,
                             'lotacoes', p.lotacoes) order by p.projeto, p.numero)
                             from por_edital p where p.chave = r.chave), '[]'::json)
    ) order by r.uf, r.so_uf desc, r.municipio)
    from linha r
  ), '[]'::json);
end;
$function$;

-- 6. O pacote dos aprovados só vence com mudança no que ele mostra ---------------------------
create or replace function private."FC_TG_CACHE_CANDIDATO_APROVADO"()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_listas uuid[];
begin
  -- No UPDATE, só as linhas em que muda uma coluna que FC_MONTAR_APROVADOS_AREA lê
  -- (20261103171500): a data da convocação, quem atualizou etc. não vencem o pacote.
  if tg_op = 'INSERT' then
    select array_agg(distinct n.lista_id) into v_listas from novas n;
  elsif tg_op = 'DELETE' then
    select array_agg(distinct o.lista_id) into v_listas from antigas o;
  else
    select array_agg(distinct u.lista) into v_listas
      from novas n
      full join antigas o on o.id = n.id
     cross join lateral unnest(array[n.lista_id, o.lista_id]) as u(lista)
     where u.lista is not null
       and (n.id is null or o.id is null
            or (n.lista_id, n.cargo, n.classificacao, n.nota, n.nome, n.modalidade, n.status,
                n.processo_sei, n.matricula, n.sub_judice, n.codigo_vaga, n.alterado_judicialmente,
                n.nota_original, n.modalidade_original, n.classificacao_original, n.removido_em)
               is distinct from
               (o.lista_id, o.cargo, o.classificacao, o.nota, o.nome, o.modalidade, o.status,
                o.processo_sei, o.matricula, o.sub_judice, o.codigo_vaga, o.alterado_judicialmente,
                o.nota_original, o.modalidade_original, o.classificacao_original, o.removido_em));
  end if;
  if v_listas is null then
    return null;
  end if;
  perform private."FC_MARCAR_CACHE"(
    array['APROVADOS'],
    array(select m."CO_AREA"
            from public."TB_LISTA_APROVADO" l
            join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id
           where l.id = any (v_listas)),
    tg_table_name);
  return null;
end;
$function$;

comment on function private."FC_TG_CACHE_CANDIDATO_APROVADO"() is
  'Gatilho por comando de TB_CANDIDATO_APROVADO: marca APROVADOS da área da lista. Desde 20261103171500, no UPDATE só quando muda uma coluna que FC_MONTAR_APROVADOS_AREA lê.';

create or replace function private."FC_TG_CACHE_LISTA_APROVADO"()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_editais text[];
begin
  -- No UPDATE, só quando muda uma coluna que FC_MONTAR_APROVADOS_AREA lê da lista
  -- (20261103171500).
  if tg_op = 'INSERT' then
    select array_agg(distinct n.edital_id) into v_editais from novas n;
  elsif tg_op = 'DELETE' then
    select array_agg(distinct o.edital_id) into v_editais from antigas o;
  else
    select array_agg(distinct u.edital) into v_editais
      from novas n
      full join antigas o on o.id = n.id
     cross join lateral unnest(array[n.edital_id, o.edital_id]) as u(edital)
     where u.edital is not null
       and (n.id is null or o.id is null
            or (n.edital_id, n.vigente, n.ativo, n.arquivo_nome, n.importado_em)
               is distinct from (o.edital_id, o.vigente, o.ativo, o.arquivo_nome, o.importado_em));
  end if;
  if v_editais is null then
    return null;
  end if;
  perform private."FC_MARCAR_CACHE"(
    array['APROVADOS'],
    array(select m."CO_AREA" from public."TB_MONITORAMENTO_INDIGENA" m where m.id::text = any (v_editais)),
    tg_table_name);
  return null;
end;
$function$;

comment on function private."FC_TG_CACHE_LISTA_APROVADO"() is
  'Gatilho por comando de TB_LISTA_APROVADO: marca APROVADOS da área do edital. Desde 20261103171500, no UPDATE só quando muda uma coluna que FC_MONTAR_APROVADOS_AREA lê.';

-- 7. As fontes das leituras (as duas novas) e os gatilhos delas --------------------------------
select private."FC_ATUALIZAR_FONTES_DAS_LEITURAS"();
notify pgrst, 'reload schema';

commit;
