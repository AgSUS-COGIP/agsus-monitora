/*
  ROLLBACK de 20261103171500_leituras_pesadas_sem_refazer.sql

  Volta as seis funções ao código do banco de 03/11/2026 (pg_get_functiondef,
  mesmo md5 que a guarda da migration confere), tira as leituras
  fila_avaliacao e monitoramento_operacional (as fontes saem em cascata), os
  gatilhos de versão das tabelas que deixaram de ser fonte de alguma leitura e
  o índice IN_CANDAPROVADO_LISTAVIVA. As marcas que a tela guardou mudam de
  formato de novo: a próxima leitura de cada uma manda o payload uma vez.
*/
begin;

set local lock_timeout = '10s';

create or replace function private."FC_TG_CACHE_CANDIDATO_APROVADO"()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_listas uuid[];
  v_antigas uuid[];
begin
  if tg_op in ('INSERT', 'UPDATE') then
    select array_agg(distinct n.lista_id) into v_listas from novas n;
  end if;
  if tg_op in ('UPDATE', 'DELETE') then
    select array_agg(distinct o.lista_id) into v_antigas from antigas o;
    v_listas := v_listas || v_antigas;
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

create or replace function private."FC_TG_CACHE_LISTA_APROVADO"()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_editais text[];
  v_antigos text[];
begin
  if tg_op in ('INSERT', 'UPDATE') then
    select array_agg(distinct n.edital_id) into v_editais from novas n;
  end if;
  if tg_op in ('UPDATE', 'DELETE') then
    select array_agg(distinct o.edital_id) into v_antigos from antigas o;
    v_editais := v_editais || v_antigos;
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

create or replace function public.listar_listas_aprovados()
 RETURNS TABLE(lista_id uuid, edital_id text, edital text, unidade text, ativo boolean, arquivo_nome text, arquivo_path text, importado_em timestamp with time zone, total_candidatos bigint, importado_por_email text, importado_por_nome text, origem text, lista_classificacao_id uuid)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not ((private.pode_recurso('aprovados') or private.pode_recurso('importacao',2))) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;
  return query
  select l.id, l.edital_id, m.edital, m.unidade, l.ativo, l.arquivo_nome,
         l.arquivo_path, l.importado_em,
         count(c.id) filter (where c.removido_em is null),
         l."DS_EMAIL_IMPORTACAO"::text, l."NO_USUARIO_IMPORTACAO"::text,
         l."TP_ORIGEM"::text, l."CO_LISTA_CLASSIFICACAO"
  from public."TB_LISTA_APROVADO" l
  join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id
  left join public."TB_CANDIDATO_APROVADO" c on c.lista_id = l.id
  where l.vigente is true
    and m."CO_AREA" = any ((select private."FC_AREAS_USUARIO"())::text[])
      and ((select private."FC_EDITAIS_VISIVEIS"()) is null or m.id = any ((select private."FC_EDITAIS_VISIVEIS"())::uuid[]))
  group by l.id, m.edital, m.unidade
  order by m.edital, m.unidade;
end;
$function$;

create or replace function public.listar_monitoramento_operacional(p_versao text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select private."FC_SE_MUDOU"(jsonb_build_object('linhas', coalesce((
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
      ) l), '[]'::jsonb)), p_versao);
$function$;

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
    casada as (
      select a.id, a.codigo_vaga, a.status_consolidado, a.numero, a.unidade, a.edital,
             private."FC_TEXTO_BUSCA_RECURSO"(btrim(mu.partes[1])) || '/' || mu.partes[2] as chave,
             btrim(mu.partes[1]) as municipio, mu.partes[2] as uf
        from analise a
       cross join lateral regexp_match(a.nome_vaga, 'UBS m[óo]vel ([^/]+)/([A-Z]{2})') as mu(partes)
       where btrim(mu.partes[1]) <> ''
      union
      select a.id, a.codigo_vaga, a.status_consolidado, a.numero, a.unidade, a.edital,
             l.chave, l.municipio, l.uf
        from analise a
        join (select distinct numero, chave, municipio, uf from loc where ibge is not null) l
          on l.numero = a.numero
         and private."FC_TEXTO_BUSCA_RECURSO"(a.nome_vaga)
             ~ ('(^|[^a-z0-9])' || private."FC_TEXTO_BUSCA_RECURSO"(l.municipio) || '($|[^a-z0-9])')
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

create or replace function public.obter_fila_avaliacao_desde(p_edital uuid, p_desde timestamp with time zone DEFAULT NULL::timestamp with time zone, p_marca text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_parcial boolean := p_desde is not null and p_marca is not null;
  v_uid uuid := (select auth.uid());
  v_papel text;
  v_vagas text[];
  v_vagas_json json;
  v_ids uuid[];
  v json;
  v_marca text;
begin
  -- A permissão primeiro (a montagem confere de novo, lá dentro).
  perform private."FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 1);

  -- A marca, com o que a montagem usaria: papel, recorte de vagas do analista e as vagas
  -- no mesmo JSON da chave "vagas" (a marca não muda com esta migration).
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
  if v_parcial and p_marca <> v_marca then
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
$function$;

comment on function public.obter_fila_avaliacao_desde(uuid, timestamptz, text) is
  'obter_fila_avaliacao só com o que mudou (20261014231000; sem montar a fila inteira desde 20261019150000; marca conferida antes de montar desde 20261022181000): sem p_desde ou com outra marca, a fila inteira com marca e parcial false; com o gerado_em e a marca da leitura anterior, só as linhas do núcleo cuja ficha mudou (ou cuja reserva vence) desde p_desde − 2 min, os ids que saíram do núcleo (saiu), total_nucleo e o resto da fila sem vagas. Mesma permissão.';
comment on function public.listar_monitoramento_operacional(text) is null;
comment on function private."FC_TG_CACHE_CANDIDATO_APROVADO"() is
  'Gatilho por comando de TB_CANDIDATO_APROVADO: marca APROVADOS da área da lista.';
comment on function private."FC_TG_CACHE_LISTA_APROVADO"() is
  'Gatilho por comando de TB_LISTA_APROVADO: marca APROVADOS da área do edital.';

delete from private."TD_LEITURA_POR_MARCA" l
 where l."NO_LEITURA" in ('fila_avaliacao', 'monitoramento_operacional');

-- Os gatilhos de versão das tabelas que não são mais fonte de nenhuma leitura.
do $$
declare
  v record;
begin
  for v in select t.tgrelid::regclass as rel, t.tgname
             from pg_catalog.pg_trigger t
             join pg_catalog.pg_class c on c.oid = t.tgrelid
             join pg_catalog.pg_namespace n on n.oid = c.relnamespace
            where t.tgname in ('TG_VERSAO_FONTE_INS', 'TG_VERSAO_FONTE_UPD', 'TG_VERSAO_FONTE_DEL', 'TG_VERSAO_FONTE_TRUNC')
              and not exists (select 1 from private."TD_FONTE_DA_LEITURA" f
                               where f."NO_FONTE" = n.nspname || '.' || c.relname) loop
    execute format('drop trigger if exists %I on %s', v.tgname, v.rel);
  end loop;
end;
$$;

drop index if exists public."IN_CANDAPROVADO_LISTAVIVA";
drop function if exists private."FC_MARCA_DO_MONITORAMENTO_OPERACIONAL"();

select private."FC_ATUALIZAR_FONTES_DAS_LEITURAS"();
notify pgrst, 'reload schema';

commit;
