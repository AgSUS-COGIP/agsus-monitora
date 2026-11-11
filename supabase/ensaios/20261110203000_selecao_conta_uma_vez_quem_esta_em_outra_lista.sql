/*
  ENSAIO de 20261110203000_selecao_conta_uma_vez_quem_esta_em_outra_lista.sql

  Roda no SQL Editor (papel postgres) ANTES de aplicar. Termina em rollback:
  nada fica no banco.

  O que confere, por área:
    A. Antes do corpo: conta, direto nas tabelas (sem a checagem de sessão da
       RPC), as linhas de aprovados, as que ficam (fora quem está em outra
       lista) e os contratados.
    B. Aplica o corpo da migration (igual ao arquivo; o teste confere).
    C. O corpo aplicado tem o md5 esperado, e em cada área os aprovados de
       depois ficam entre os contratados e os de antes.
  Ok = termina com NOTICE "Ensaio 20261110203000 ok" e ROLLBACK.
*/
begin;

set local lock_timeout = '5s';

create temp table "ENSAIO_SELECAO" on commit drop as
with listas as (
  select l.id, l.edital_id from public."TB_LISTA_APROVADO" l where l.vigente is true
), linhas as (
  select s.area, c.status, private."FC_EM_OUTRA_LISTA"(c.id) as outra
    from listas l
    join public."TB_CANDIDATO_APROVADO" c on c.lista_id = l.id and c.removido_em is null
    join (select distinct v."CO_MONITORAMENTO"::text as edital_id, v."CO_AREA" as area
            from public."TB_SELECAO_VAGA" v
           where v."ST_REGISTRO_ATIVO" = 'S' and v."CO_MONITORAMENTO" is not null) s
      on s.edital_id = l.edital_id
)
select area,
       count(*)::integer as total_antes,
       (count(*) filter (where status is distinct from 'Contratado em outra lista' and not outra))::integer as total_depois,
       (count(*) filter (where status in ('Contratado', 'Migração') and not outra))::integer as contratados
  from linhas group by area;

do $guarda$
begin
  if md5((select prosrc from pg_proc where oid = to_regprocedure('public.get_selecao_da_area(text)'))) is distinct from '07ef20528cba24ed26c971f2e62500b4' then
    raise exception 'Ensaio: o corpo vigente de get_selecao_da_area não é o que a migration conhece.';
  end if;
end;
$guarda$;

create or replace function public.get_selecao_da_area(p_area text)
 returns json
 language plpgsql
 stable security definer
 set search_path to ''
as $_$
declare
  v_editais uuid[];
begin
  if not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = p_area) then
    raise exception 'Área inválida' using errcode = '22023';
  end if;
  if not private.pode_recurso('selecao', 1) then
    raise exception 'Sem permissão para Seleção' using errcode = '42501';
  end if;
  if not private."FC_PODE_AREA"(p_area) then
    raise exception 'Sem acesso a esta área' using errcode = '42501';
  end if;
  v_editais := (select private."FC_EDITAIS_VISIVEIS"())::uuid[];

  return (
    with s as (
      select s.*, private."FC_NUMERO_EDITAL"(s."DS_EDITAL") as numero
        from public."TB_SELECAO_VAGA" s
       where s."CO_AREA" = p_area and s."ST_REGISTRO_ATIVO" = 'S'
         and (v_editais is null or s."CO_MONITORAMENTO" = any (v_editais))
    ),
    -- Convocados: a entrevista vigente de cada pessoa (FC_ENTREVISTAS_VIGENTES) por edital e vaga.
    convocados as (
      select private."FC_NUMERO_EDITAL"(e."DS_EDITAL") as numero, e."CO_VAGA" as vaga, count(*)::integer as qt
        from public."TB_ENTREVISTA" e
       where e."CO_AREA" = p_area and e."ST_ATIVO" = 'S'
         and e."CO_ENTREVISTA" in (select v from private."FC_ENTREVISTAS_VIGENTES"(p_area) v)
       group by 1, 2
    ),
    editais_com_entrevista as (
      select distinct c.numero from convocados c where c.numero is not null
    ),
    -- Lista de aprovados vigente dos editais ligados.
    listas as (
      select l.id, l.edital_id
        from public."TB_LISTA_APROVADO" l
       where l.vigente is true
         and l.edital_id in (select s."CO_MONITORAMENTO"::text from s where s."CO_MONITORAMENTO" is not null)
    ),
    aprovados as (
      select l.edital_id, regexp_replace(coalesce(c.codigo_vaga, ''), '[^0-9]', '', 'g') as vaga,
             -- Quem foi contratado pela outra linha do edital (ampla x cota) é a mesma pessoa:
             -- conta uma vez, como já não conta nos contratados (20261110203000).
             (count(*) filter (where c.status is distinct from 'Contratado em outra lista'
                                 and not private."FC_EM_OUTRA_LISTA"(c.id)))::integer as total,
             (count(*) filter (where c.status in ('Contratado', 'Migração') and not private."FC_EM_OUTRA_LISTA"(c.id)))::integer as contratados
        from listas l
        join public."TB_CANDIDATO_APROVADO" c on c.lista_id = l.id and c.removido_em is null
       group by 1, 2
    ),
    -- Outras bancas (CESPE, FGV…): sem código numérico, o "id da vaga" da lista é
    -- o nome do cargo. Chave: o texto sem acento, caixa nem pontuação.
    aprovados_por_cargo as (
      select l.edital_id,
             btrim(regexp_replace(private."FC_TEXTO_BUSCA_RECURSO"(c.codigo_vaga), '[^a-z0-9]+', ' ', 'g')) as cargo,
             -- Quem foi contratado pela outra linha do edital (ampla x cota) é a mesma pessoa:
             -- conta uma vez, como já não conta nos contratados (20261110203000).
             (count(*) filter (where c.status is distinct from 'Contratado em outra lista'
                                 and not private."FC_EM_OUTRA_LISTA"(c.id)))::integer as total,
             (count(*) filter (where c.status in ('Contratado', 'Migração') and not private."FC_EM_OUTRA_LISTA"(c.id)))::integer as contratados
        from listas l
        join public."TB_CANDIDATO_APROVADO" c on c.lista_id = l.id and c.removido_em is null
       group by 1, 2
    ),
    linhas as (
      select s.*,
             m.edital as edital_cadastrado,
             (s.numero is not null and s.numero in (select x.numero from editais_com_entrevista x)) as usa_entrevistas,
             cv.qt as qt_convocado_entrevistas,
             exists (select 1 from listas l where l.edital_id = s."CO_MONITORAMENTO"::text) as tem_lista,
             coalesce(ap.total, apc.total) as qt_aprovado,
             coalesce(ap.contratados, apc.contratados) as qt_contratado
        from s
        left join public."TB_MONITORAMENTO_INDIGENA" m on m.id = s."CO_MONITORAMENTO"
        left join convocados cv on cv.numero = s.numero and cv.vaga = s."CO_VAGA"
        -- A 2ª vaga de mesmo código (chave com #2…) não recebe de novo os mesmos aprovados (20261022200000).
        left join aprovados ap
          on ap.edital_id = s."CO_MONITORAMENTO"::text and ap.vaga = s."CO_VAGA"
         and s."DS_CHAVE_ORIGEM" !~ '#[0-9]+$'
        -- Vaga sem código (outra banca): pelo nome do cargo; a 2ª vaga de mesmo nome
        -- (chave com #2…) não recebe de novo os mesmos aprovados.
        left join aprovados_por_cargo apc
          on s."CO_VAGA" is null
         and s."DS_CHAVE_ORIGEM" !~ '#[0-9]+$'
         and apc.edital_id = s."CO_MONITORAMENTO"::text
         and apc.cargo = btrim(regexp_replace(private."FC_TEXTO_BUSCA_RECURSO"(s."DS_VAGA_PLANILHA"), '[^a-z0-9]+', ' ', 'g'))
    )
    select json_build_object(
      'schema_version', 1,
      'area', p_area,
      'gerado_em', now(),
      'ultima_carga', (
        select json_build_object('em', t."DT_FIM", 'linhas', t."QT_LINHA", 'sem_edital', t."QT_SEM_EDITAL")
          from public."TL_SYNC_SELECAO" t
         where t."TP_SITUACAO" = 'CONCLUIDA'
         order by t."DT_FIM" desc limit 1
      ),
      'vagas', (
        select coalesce(json_agg(json_build_object(
            'id', l."CO_SELECAO_VAGA",
            'edital_id', l."CO_MONITORAMENTO",
            'edital', coalesce(l.edital_cadastrado, l."DS_EDITAL"),
            'edital_planilha', l."DS_EDITAL",
            'unidade', l."NO_UNIDADE",
            'vaga', l."CO_VAGA",
            'vaga_planilha', l."DS_VAGA_PLANILHA",
            'cargo', l."NO_CARGO",
            'inscritos', l."QT_INSCRITO",
            'aptos', l."QT_APTO_ANALISE",
            'cancelados', l."QT_CANCELADO",
            'reprovados_questionario', l."QT_REPROVADO_QUESTIONARIO",
            'eliminados_nota', l."QT_ELIMINADO_NOTA",
            'reprovados_analise', l."QT_REPROVADO_ANALISE",
            'triados', l."QT_TRIADO",
            'total_eliminados', l."QT_TOTAL_ELIMINADO",
            'observacao', l."DS_OBSERVACAO",
            'convocados', case when l.usa_entrevistas then coalesce(l.qt_convocado_entrevistas, 0)
                               else l."QT_CONVOCADO_PLANILHA" end,
            'origem_convocados', case when l.usa_entrevistas then 'entrevistas' else 'planilha' end,
            'aprovados', case when l.tem_lista then coalesce(l.qt_aprovado, 0) end,
            'contratados', case when l.tem_lista then coalesce(l.qt_contratado, 0) end,
            'nao_contratados', case when l.tem_lista then coalesce(l.qt_aprovado, 0) - coalesce(l.qt_contratado, 0) end
          ) order by coalesce(l.edital_cadastrado, l."DS_EDITAL"), l."NO_UNIDADE", l."NO_CARGO", l."CO_VAGA"), '[]'::json)
          from linhas l
      )
    )
  );
end;
$_$;

comment on function public.get_selecao_da_area(p_area text) is 'Leitura da aba Seleção de uma área (json): o funil de cada vaga (aba Resultado da Auditoria), os convocados (entrevistas vigentes, FC_ENTREVISTAS_VIGENTES, quando o edital tem entrevista; senão o V da planilha) e aprovados/contratados/não contratados da lista vigente (a 2ª vaga de mesmo código ou cargo não repete os aprovados; quem foi contratado pela outra linha do edital conta uma vez nos aprovados, 20261110203000). Exige selecao >= leitor, a área e o recorte da coordenação.';

do $confere$
declare
  r record;
begin
  if md5((select prosrc from pg_proc where oid = to_regprocedure('public.get_selecao_da_area(text)'))) is distinct from 'a35c8cf054c4c5aa887abe42064bbb37' then
    raise exception 'Ensaio: o corpo aplicado não é o da migration.';
  end if;
  for r in select * from "ENSAIO_SELECAO" order by area loop
    if r.total_depois > r.total_antes or r.total_depois < r.contratados then
      raise exception 'Ensaio: % aprovados % -> %, contratados %: conta incoerente.', r.area, r.total_antes, r.total_depois, r.contratados;
    end if;
    raise notice '%: aprovados % -> % (-%); contratados %; não contratados % -> %',
      r.area, r.total_antes, r.total_depois, r.total_antes - r.total_depois, r.contratados,
      r.total_antes - r.contratados, r.total_depois - r.contratados;
  end loop;
  raise notice 'Ensaio 20261110203000 ok.';
end;
$confere$;

rollback;
