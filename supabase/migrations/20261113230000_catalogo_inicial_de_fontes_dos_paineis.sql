/*
  CATÁLOGO INICIAL DE FONTES DOS PAINÉIS (13/11/2026)

  POR QUE
  As fontes das colunas dos Painéis são visões do schema painel (migration 20261113220000). Esta
  migration cria as primeiras, que embrulham as alternativas que já existem no banco. Cada uma traz
  a chave do grão, uma linha por chave, e COMMENT na visão e nas colunas de valor (é o que aparece
  no seletor da tela "Fontes dos dados").

  AS VISÕES
    Edital ("CO_MONITORAMENTO"):
      VW_EDITAL_QUADRO_DE_VAGAS      soma das vagas imediatas do quadro do edital (registros ativos)
      VW_EDITAL_VAGAS_DA_CONVOCACAO  soma das vagas imediatas configuradas na convocação
      VW_EDITAL_CADASTRO             vagas e datas do formulário do edital, sem o cronograma
    Vaga ("CO_MONITORAMENTO" + "CO_VAGA"):
      VW_VAGA_CONVOCACAO             vagas imediatas configuradas na convocação (TB_VAGA_IMEDIATA)
      VW_VAGA_TRIAGEM                vagas imediatas e inscritos da Triagem (TB_PRE_CLASSIF_VAGA)
      VW_VAGA_INSCRICOES             inscritos do retrato mais recente (TH_INSCRICAO_VAGA_EDITAL,
                                     sem as prévias)
    Aprovado ("CO_CANDIDATO_APROVADO"):
      VW_APROVADO_CONTRATACAO        situação e data da decisão do job da contratação
                                     (TB_CONTRATACAO_APROVADO: códigos CONTRATACAO, AMBIGUO…, não
                                     os status da lista)
      VW_APROVADO_ANTES_DA_DECISAO   nota e classificação de antes da decisão judicial (só dos
                                     candidatos alterados judicialmente)

  Na convocação, o edital vem em texto ("CO_EDITAL"); só entram os que são um uuid.

  DEPENDE DE: 20261113220000_fontes_das_colunas_dos_paineis.sql (o schema painel).
  DESFAZER: supabase/rollback/20261113230000_catalogo_inicial_de_fontes_dos_paineis.sql.
  ENSAIO:   supabase/ensaios/20261113230000_catalogo_inicial_de_fontes_dos_paineis.sql.
*/
begin;

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

commit;
