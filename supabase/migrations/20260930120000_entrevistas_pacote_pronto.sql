/*
  Aba Entrevistas com pacote pronto (como o painel de análises).

  get_entrevistas_da_area montava, a cada abertura, as 3.404 entrevistas com
  notas e análises ligadas: 0,3 s a 4 s medidos em 30/09 no servidor atual
  (NANO), e o painel "travava" na abertura. Agora:
  - private."TA_PAINEL_ENTREVISTA": o json pronto de cada área, com a versão
    dos dados (entrevistas + sync das análises) e quando foi gerado;
  - atualizar_cache_painel_entrevistas(p_area): remonta só as áreas cuja
    versão mudou; pg_cron a cada 2 min e gatilho no fim de cada carga;
  - get_entrevistas_da_area entrega o pacote pronto para quem vê todos os
    editais; quem tem recorte de coordenação continua recebendo o montado na
    hora (só os seus editais, bem menor).
  O json é o mesmo de antes (schema_version 1).

  Rollback: supabase/rollback/20260930120000_entrevistas_pacote_pronto.sql
*/
begin;

create table private."TA_PAINEL_ENTREVISTA" (
  "CO_AREA" text not null,
  "DS_PAYLOAD" json not null,
  "QT_ENTREVISTA" integer not null,
  "DS_VERSAO_DADOS" text not null,
  "DT_GERACAO" timestamptz not null default now(),
  "NU_DURACAO_MS" integer,
  constraint "PK_TA_PAINEL_ENTREVISTA" primary key ("CO_AREA"),
  constraint "FK_AREA_PAINELENTREVISTA" foreign key ("CO_AREA") references public."TB_AREA" ("CO_AREA")
);
comment on table private."TA_PAINEL_ENTREVISTA" is 'Pacote pronto (json) da aba Entrevistas por área; remontado quando a versão dos dados muda.';
comment on column private."TA_PAINEL_ENTREVISTA"."CO_AREA" is 'Área (TB_AREA).';
comment on column private."TA_PAINEL_ENTREVISTA"."DS_PAYLOAD" is 'Json de get_entrevistas_da_area para quem vê todos os editais da área.';
comment on column private."TA_PAINEL_ENTREVISTA"."QT_ENTREVISTA" is 'Entrevistas no pacote.';
comment on column private."TA_PAINEL_ENTREVISTA"."DS_VERSAO_DADOS" is 'Versão dos dados usada (FC_VERSAO_ENTREVISTAS).';
comment on column private."TA_PAINEL_ENTREVISTA"."DT_GERACAO" is 'Quando o pacote foi montado.';
comment on column private."TA_PAINEL_ENTREVISTA"."NU_DURACAO_MS" is 'Quanto levou para montar (ms).';
comment on constraint "FK_AREA_PAINELENTREVISTA" on private."TA_PAINEL_ENTREVISTA" is 'Área do pacote.';
revoke all on private."TA_PAINEL_ENTREVISTA" from public, anon, authenticated;

create function private."FC_VERSAO_ENTREVISTAS"(p_area text)
returns text
language sql
stable
set search_path to ''
as $function$
  -- Entrevistas da área + versão das análises (o pacote mostra nota/resultado
  -- da análise e os aprovados sem entrevista).
  select count(*)::text || '|' || coalesce(max(e."DT_ATUALIZACAO")::text, '-')
         || '|' || private."FC_VERSAO_DADOS_ANALISE"(p_area)
    from public."TB_ENTREVISTA" e
   where e."CO_AREA" = p_area;
$function$;
comment on function private."FC_VERSAO_ENTREVISTAS"(text) is 'Versão dos dados da aba Entrevistas de uma área (muda quando entrevistas ou o sync das análises mudam).';
revoke all on function private."FC_VERSAO_ENTREVISTAS"(text) from public, anon, authenticated;

create function private."FC_MONTAR_ENTREVISTAS_AREA"(p_area text, p_editais uuid[])
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  return (
    with e as (
      select e.*
        from public."TB_ENTREVISTA" e
       where e."CO_AREA" = p_area and e."ST_ATIVO" = 'S'
         and (p_editais is null or e."CO_MONITORAMENTO" = any (p_editais))
    ),
    criterios as (
      select n."DS_CRITERIO" as criterio, row_number() over (order by min(n."NU_ORDEM"), n."DS_CRITERIO") - 1 as i
        from public."TB_ENTREVISTA_NOTA" n
        join e on e."CO_ENTREVISTA" = n."CO_ENTREVISTA"
       where n."VL_NOTA" is not null
       group by n."DS_CRITERIO"
    ),
    vagas as (
      select distinct e."CO_VAGA" from e
    ),
    sem_entrevista as (
      select a.id, a.candidato, a.id_origem, a.codigo_vaga, a.nome_vaga, a.edital, a.unidade,
             a.nota_final_ajustada, a.modalidade_concorrencia
        from public."TB_ANALISE_CURRICULAR" a
        join vagas v on v."CO_VAGA" = a.codigo_vaga
       where a."CO_AREA" = p_area and a.ativo
         and a.status_consolidado = 'Aprovado'
         and not exists (select 1 from public."TB_ENTREVISTA" x
                          where x."CO_ANALISE_CURRICULAR" = a.id and x."ST_ATIVO" = 'S')
         and (p_editais is null or exists (
               select 1 from public."TB_MONITORAMENTO_INDIGENA" m
                where m.id = any (p_editais) and m."CO_AREA" = a."CO_AREA"
                  and private."FC_NUMERO_EDITAL"(m.edital) = private."FC_NUMERO_EDITAL"(a.edital)))
       order by a.edital, a.codigo_vaga, a.candidato
       limit 3000
    )
    select json_build_object(
      'schema_version', 1,
      'area', p_area,
      'gerado_em', now(),
      'ultima_carga', (
        select json_build_object('em', s."DT_FIM", 'linhas', s."QT_LINHA",
                                 'ligadas_analise', s."QT_LIGADA_ANALISE",
                                 'sem_analise', s."QT_SEM_ANALISE", 'sem_edital', s."QT_SEM_EDITAL")
          from public."TL_SYNC_ENTREVISTA" s
         where s."CO_AREA" = p_area and s."TP_SITUACAO" = 'CONCLUIDA'
         order by s."DT_FIM" desc limit 1
      ),
      'criterios', (select coalesce(json_agg(c.criterio order by c.i), '[]'::json) from criterios c),
      'entrevistas', (
        select coalesce(json_agg(json_build_object(
            'id', e."CO_ENTREVISTA",
            'edital_id', e."CO_MONITORAMENTO",
            'edital', coalesce(m.edital, e."DS_EDITAL"),
            'edital_planilha', e."DS_EDITAL",
            'unidade', coalesce(m.unidade, e."NO_UNIDADE"),
            'vaga', e."CO_VAGA",
            'cargo', coalesce(a.nome_vaga, e."NO_CARGO"),
            'candidato', e."NO_CANDIDATO",
            'codigo', e."CO_CANDIDATO",
            'modalidade', coalesce(a.modalidade_concorrencia, e."DS_MODALIDADE"),
            'nota', e."VL_NOTA_TOTAL",
            'parecer', e."TP_PARECER",
            'compareceu', e."ST_COMPARECEU",
            'link', e."DS_LINK_PLANILHA",
            'notas', (
              select coalesce(json_agg(json_build_array(c.i, n."VL_NOTA") order by n."NU_ORDEM"), '[]'::json)
                from public."TB_ENTREVISTA_NOTA" n
                join criterios c on c.criterio = n."DS_CRITERIO"
               where n."CO_ENTREVISTA" = e."CO_ENTREVISTA" and n."VL_NOTA" is not null
            ),
            'analise', case when a.id is null then null else json_build_object(
              'id', a.id,
              'ligacao', e."TP_LIGACAO_ANALISE",
              'nota', a.nota_final_ajustada,
              'resultado', a.status_consolidado,
              'etapa', a.etapa,
              'responsavel', a.responsavel_analise,
              'ativo', a.ativo
            ) end
          ) order by coalesce(m.edital, e."DS_EDITAL"), e."CO_VAGA", e."VL_NOTA_TOTAL" desc nulls last, e."NO_CANDIDATO"), '[]'::json)
          from e
          left join public."TB_MONITORAMENTO_INDIGENA" m on m.id = e."CO_MONITORAMENTO"
          left join public."TB_ANALISE_CURRICULAR" a on a.id = e."CO_ANALISE_CURRICULAR"
      ),
      'aprovados_sem_entrevista', (
        select coalesce(json_agg(json_build_object(
            'analise_id', s.id,
            'candidato', s.candidato,
            'codigo', s.id_origem,
            'vaga', s.codigo_vaga,
            'cargo', s.nome_vaga,
            'edital', s.edital,
            'unidade', s.unidade,
            'nota', s.nota_final_ajustada,
            'modalidade', s.modalidade_concorrencia
          )), '[]'::json)
          from sem_entrevista s
      )
    )
  );
end;
$function$;
comment on function private."FC_MONTAR_ENTREVISTAS_AREA"(text, uuid[]) is
  'Monta o json da aba Entrevistas de uma área; p_editais nulo = todos os editais (pacote pronto), senão só os editais da lista (recorte da coordenação). Sem checagem de permissão: quem chama checa.';
revoke all on function private."FC_MONTAR_ENTREVISTAS_AREA"(text, uuid[]) from public, anon, authenticated;

create function public.atualizar_cache_painel_entrevistas(p_area text default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_area text;
  v_versao text;
  v_inicio timestamptz;
  v_payload json;
  v_feitas jsonb := '[]'::jsonb;
begin
  for v_area in
    select a."CO_AREA" from public."TB_AREA" a
     where p_area is null or a."CO_AREA" = p_area
     order by a."CO_AREA"
  loop
    v_versao := private."FC_VERSAO_ENTREVISTAS"(v_area);
    if exists (select 1 from private."TA_PAINEL_ENTREVISTA" c
                where c."CO_AREA" = v_area and c."DS_VERSAO_DADOS" = v_versao) then
      continue;
    end if;
    v_inicio := clock_timestamp();
    v_payload := private."FC_MONTAR_ENTREVISTAS_AREA"(v_area, null);
    insert into private."TA_PAINEL_ENTREVISTA" as c
      ("CO_AREA", "DS_PAYLOAD", "QT_ENTREVISTA", "DS_VERSAO_DADOS", "DT_GERACAO", "NU_DURACAO_MS")
    values (v_area, v_payload, json_array_length(v_payload->'entrevistas'), v_versao, now(),
            (extract(epoch from clock_timestamp() - v_inicio) * 1000)::integer)
    on conflict ("CO_AREA") do update set
      "DS_PAYLOAD" = excluded."DS_PAYLOAD", "QT_ENTREVISTA" = excluded."QT_ENTREVISTA",
      "DS_VERSAO_DADOS" = excluded."DS_VERSAO_DADOS", "DT_GERACAO" = excluded."DT_GERACAO",
      "NU_DURACAO_MS" = excluded."NU_DURACAO_MS";
    v_feitas := v_feitas || to_jsonb(v_area);
  end loop;
  return jsonb_build_object('remontadas', v_feitas);
end;
$function$;
comment on function public.atualizar_cache_painel_entrevistas(text) is
  'Remonta o pacote pronto da aba Entrevistas das áreas cuja versão mudou (todas, ou só p_area). pg_cron a cada 2 min; barata quando nada mudou.';
revoke all on function public.atualizar_cache_painel_entrevistas(text) from public, anon, authenticated;
grant execute on function public.atualizar_cache_painel_entrevistas(text) to service_role;

create or replace function public.get_entrevistas_da_area(p_area text)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_editais uuid[];
  v_payload json;
begin
  if not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = p_area) then
    raise exception 'Área inválida' using errcode = '22023';
  end if;
  if not private.pode_recurso('entrevistas', 1) then
    raise exception 'Sem permissão para Entrevistas' using errcode = '42501';
  end if;
  if not private."FC_PODE_AREA"(p_area) then
    raise exception 'Sem acesso a esta área' using errcode = '42501';
  end if;
  v_editais := (select private."FC_EDITAIS_VISIVEIS"())::uuid[];

  -- Vê todos os editais: o pacote pronto (o pg_cron remonta em até 2 min
  -- depois de uma mudança). Recorte de coordenação: montado na hora.
  if v_editais is null then
    select c."DS_PAYLOAD" into v_payload
      from private."TA_PAINEL_ENTREVISTA" c where c."CO_AREA" = p_area;
    if v_payload is not null then
      return v_payload;
    end if;
  end if;
  return private."FC_MONTAR_ENTREVISTAS_AREA"(p_area, v_editais);
end;
$function$;

create function private."FC_REMONTAR_ENTREVISTAS_APOS_SYNC"()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if new."TP_SITUACAO" = 'CONCLUIDA' and old."TP_SITUACAO" is distinct from 'CONCLUIDA' then
    perform public.atualizar_cache_painel_entrevistas(new."CO_AREA");
  end if;
  return new;
end;
$function$;
comment on function private."FC_REMONTAR_ENTREVISTAS_APOS_SYNC"() is 'Gatilho: carga de entrevistas concluída remonta o pacote pronto da área.';
revoke all on function private."FC_REMONTAR_ENTREVISTAS_APOS_SYNC"() from public, anon, authenticated;
create trigger "TG_SYNCENTREVISTA_REMONTA_PAINEL"
  after update of "TP_SITUACAO" on public."TL_SYNC_ENTREVISTA"
  for each row execute function private."FC_REMONTAR_ENTREVISTAS_APOS_SYNC"();

do $$
begin
  if not exists (select 1 from cron.job where jobname = 'agsus_entrevistas_cache_do_painel') then
    perform cron.schedule('agsus_entrevistas_cache_do_painel', '1-59/2 * * * *',
      'select public.atualizar_cache_painel_entrevistas();');
  end if;
end;
$$;

select public.atualizar_cache_painel_entrevistas();

commit;
