/*
  ENSAIO de 20261113230000_catalogo_inicial_de_fontes_dos_paineis.sql

  Roda no banco ANTES de aplicar (com 20261113220000 já aplicada) e termina em rollback. Cria as
  visões e confere, em cada uma, uma linha por chave, e que o seletor (FC_OPCOES_DE_FONTE_DO_PAINEL)
  oferece as colunas esperadas.
  Ok = NOTICE com as contagens e "Ensaio 20261113230000 ok", e ROLLBACK.
*/
begin;

set local lock_timeout = '5s';

do $$
begin
  if to_regnamespace('painel') is null
     or to_regprocedure('private."FC_OPCOES_DE_FONTE_DO_PAINEL"(text, text)') is null then
    raise exception 'Aplique antes 20261113220000_fontes_das_colunas_dos_paineis.sql.';
  end if;
end;
$$;

-- Edital -----------------------------------------------------------------------------------------
create view painel."VW_EDITAL_QUADRO_DE_VAGAS" as
  select q."CO_MONITORAMENTO", sum(q."QT_VAGA_IMEDIATA")::integer as "QT_VAGA_IMEDIATA"
    from public."TB_QUADRO_VAGA_EDITAL" q
   where q."ST_REGISTRO_ATIVO" = 'S'
   group by q."CO_MONITORAMENTO";
comment on view painel."VW_EDITAL_QUADRO_DE_VAGAS" is 'Quadro de vagas do edital';
comment on column painel."VW_EDITAL_QUADRO_DE_VAGAS"."QT_VAGA_IMEDIATA" is 'Vagas imediatas (soma do quadro)';

create view painel."VW_EDITAL_VAGAS_DA_CONVOCACAO" as
  select v."CO_EDITAL"::uuid as "CO_MONITORAMENTO", sum(v."QT_VAGA_IMEDIATA")::integer as "QT_VAGA_IMEDIATA"
    from public."TB_VAGA_IMEDIATA" v
   where v."CO_EDITAL" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   group by v."CO_EDITAL"::uuid;
comment on view painel."VW_EDITAL_VAGAS_DA_CONVOCACAO" is 'Vagas da convocação (Lista de aprovados)';
comment on column painel."VW_EDITAL_VAGAS_DA_CONVOCACAO"."QT_VAGA_IMEDIATA" is 'Vagas imediatas (soma das vagas configuradas)';

create view painel."VW_EDITAL_CADASTRO" as
  select m.id as "CO_MONITORAMENTO", m.vagas_total as "QT_VAGA_TOTAL",
         m.data_inicio as "DT_INICIO", m.data_fim as "DT_FIM"
    from public."TB_MONITORAMENTO_INDIGENA" m;
comment on view painel."VW_EDITAL_CADASTRO" is 'Cadastro do edital (sem o cronograma)';
comment on column painel."VW_EDITAL_CADASTRO"."QT_VAGA_TOTAL" is 'Vagas imediatas do formulário';
comment on column painel."VW_EDITAL_CADASTRO"."DT_INICIO" is 'Data de início do formulário';
comment on column painel."VW_EDITAL_CADASTRO"."DT_FIM" is 'Data de fim do formulário';

-- Vaga -------------------------------------------------------------------------------------------
create view painel."VW_VAGA_CONVOCACAO" as
  select v."CO_EDITAL"::uuid as "CO_MONITORAMENTO", v."CO_VAGA", v."QT_VAGA_IMEDIATA"
    from public."TB_VAGA_IMEDIATA" v
   where v."CO_EDITAL" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
comment on view painel."VW_VAGA_CONVOCACAO" is 'Vagas da convocação (Lista de aprovados)';
comment on column painel."VW_VAGA_CONVOCACAO"."QT_VAGA_IMEDIATA" is 'Vagas imediatas configuradas';

create view painel."VW_VAGA_TRIAGEM" as
  select p."CO_MONITORAMENTO", p."CO_VAGA", p."QT_VAGA_IMEDIATA", p."QT_INSCRITO"
    from public."TB_PRE_CLASSIF_VAGA" p;
comment on view painel."VW_VAGA_TRIAGEM" is 'Triagem';
comment on column painel."VW_VAGA_TRIAGEM"."QT_VAGA_IMEDIATA" is 'Vagas imediatas da Triagem';
comment on column painel."VW_VAGA_TRIAGEM"."QT_INSCRITO" is 'Inscritos da Triagem';

create view painel."VW_VAGA_INSCRICOES" as
  select distinct on (i."CO_MONITORAMENTO", i."CO_VAGA")
         i."CO_MONITORAMENTO", i."CO_VAGA", i."QT_INSCRITO", i."DT_RETRATO"
    from public."TH_INSCRICAO_VAGA_EDITAL" i
   where i."ST_PREVIA" = 'N'
   order by i."CO_MONITORAMENTO", i."CO_VAGA", i."DT_RETRATO" desc, i."DT_ATUALIZACAO" desc;
comment on view painel."VW_VAGA_INSCRICOES" is 'Retrato das inscrições (o mais recente)';
comment on column painel."VW_VAGA_INSCRICOES"."QT_INSCRITO" is 'Inscritos no retrato';

-- Aprovado ---------------------------------------------------------------------------------------
create view painel."VW_APROVADO_CONTRATACAO" as
  select c."CO_CANDIDATO_APROVADO", c."TP_SITUACAO"::text as "TP_SITUACAO", c."DT_DECISAO"
    from public."TB_CONTRATACAO_APROVADO" c;
comment on view painel."VW_APROVADO_CONTRATACAO" is 'Contratação calculada (job dos aprovados)';
comment on column painel."VW_APROVADO_CONTRATACAO"."TP_SITUACAO" is 'Situação calculada (CONTRATACAO, AMBIGUO…)';
comment on column painel."VW_APROVADO_CONTRATACAO"."DT_DECISAO" is 'Data da decisão do job';

create view painel."VW_APROVADO_ANTES_DA_DECISAO" as
  select c.id as "CO_CANDIDATO_APROVADO", c.nota_original as "VL_NOTA_ORIGINAL",
         c.classificacao_original as "NU_CLASSIFICACAO_ORIGINAL"
    from public."TB_CANDIDATO_APROVADO" c
   where c.alterado_judicialmente;
comment on view painel."VW_APROVADO_ANTES_DA_DECISAO" is 'Antes da decisão judicial';
comment on column painel."VW_APROVADO_ANTES_DA_DECISAO"."VL_NOTA_ORIGINAL" is 'Nota original';
comment on column painel."VW_APROVADO_ANTES_DA_DECISAO"."NU_CLASSIFICACAO_ORIGINAL" is 'Classificação original';

revoke all on all tables in schema painel from public, anon, authenticated;


do $confere$
declare
  r record;
  v_linhas bigint;
  v_chaves bigint;
begin
  for r in
    select c.relname::text as visao,
           case when c.relname like 'VW\_VAGA\_%' then '"CO_MONITORAMENTO"::text || ''|'' || "CO_VAGA"::text'
                when c.relname like 'VW\_EDITAL\_%' then '"CO_MONITORAMENTO"::text'
                else '"CO_CANDIDATO_APROVADO"::text' end as chave
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'painel' and c.relkind = 'v'
  loop
    execute format('select count(*), count(distinct %s) from painel.%I', r.chave, r.visao) into v_linhas, v_chaves;
    raise notice '%: % linhas', r.visao, v_linhas;
    if v_linhas <> v_chaves then
      raise exception '% tem chave repetida (% linhas, % chaves).', r.visao, v_linhas, v_chaves;
    end if;
  end loop;

  -- O seletor oferece toda coluna inteira do grão: convocação, Triagem (vagas e inscritos) e retrato.
  if (select count(*) from private."FC_OPCOES_DE_FONTE_DO_PAINEL"('editais-por-cargo', 'vagas_imediatas')) <> 4 then
    raise exception 'Vagas imediatas por vaga deveriam ter 4 opções inteiras.';
  end if;
  if (select count(*) from private."FC_OPCOES_DE_FONTE_DO_PAINEL"('editais-por-cargo', 'inscritos')) <> 4 then
    raise exception 'Inscritos por vaga deveriam ter 4 opções numéricas.';
  end if;
  if (select count(*) from private."FC_OPCOES_DE_FONTE_DO_PAINEL"('resumo-dos-editais', 'data_divulgacao')) <> 2 then
    raise exception 'Data da divulgação deveria ter 2 opções (datas do formulário).';
  end if;
  if (select count(*) from private."FC_OPCOES_DE_FONTE_DO_PAINEL"('aprovados', 'status')) <> 1 then
    raise exception 'Status deveria ter 1 opção (situação calculada).';
  end if;
end;
$confere$;

do $ok$ begin raise notice 'Ensaio 20261113230000 ok'; end; $ok$;

rollback;
