/*
  ENSAIO de 20261009120000_treinamentos_completos.sql — begin … rollback.

  Cole no SQL Editor do Supabase (papel postgres). Tira o retrato dos dados
  reais, aplica a migration e confere (cada falha para com "FALHOU En"; o
  resultado é a última consulta):
    E1  os dois editais com as duas etapas prontas (contagens):
          991/2099 — regra do 111/2026 CONFERIDA e nomeada, 30 inscrições,
          pré-classificação (24 no lote, 2 fora, 4 eliminados: os casos do
          Python), 24 fichas PENDENTE livres, execução concluída; entrevista
          (roteiro com aspectos, banca, 15 convocados) e agenda (6 hoje);
          992/2099 — a avaliação documental de antes (21 fichas) e a entrevista:
          roteiro FAIXA do SESMT sem aspectos, secretaria, 5 vagas, 3
          avaliadores (P3 só "Habilidade intercultural"), lista de convocação
          do lote (21), 21 convocados, agenda (6 hoje) e liberação da janela;
        e o preparar de novo não muda nada;
    E2  as funções novas recusam edital real (42501) e o preparar, outra área;
    E3  como admin sintético: o reinício recusa quem não é admin e edital
        real; as telas (avaliação documental, pré-classificação, entrevistas,
        agenda) trazem os dois; fora da pré-classificação padrão, do painel dos
        robôs e da Visão geral;
    E4  "Pegar próximo" entrega ficha da Saúde Indígena (admin na equipe);
    E5  o reinício dos dois, duas vezes, volta ao mesmo estado do E1;
    E6  nenhuma contagem real muda (entrevistas, agenda, roteiros, regras,
        fichas, pré-classificação, inscrições, 93/2026 e 111/2026).
  Termina em ROLLBACK. Só dados fictícios.
*/
begin;

-- ═══ E0. Retrato dos dados reais (antes da migration) ══════════════════════
create temporary table tmp_ensaio_real on commit drop as
with e93 as (select m.id from public."TB_MONITORAMENTO_INDIGENA" m where m."CO_AREA" = 'projetos' and m.edital = '93/2026' and m."ST_TREINAMENTO" = 'N'),
     e111 as (select m.id from public."TB_MONITORAMENTO_INDIGENA" m where private."FC_NUMERO_EDITAL"(m.edital) = '111/2026' and m."ST_TREINAMENTO" = 'N')
select 'entrevistas' as tabela, count(*)::text as qt from public."TB_ENTREVISTA" e where not private."FC_EDITAL_EH_TREINAMENTO"(e."CO_MONITORAMENTO")
union all select 'historico_entrevistas', count(*)::text from public."TH_ENTREVISTA_AVALIACAO" h join public."TB_ENTREVISTA" e on e."CO_ENTREVISTA" = h."CO_ENTREVISTA" where not private."FC_EDITAL_EH_TREINAMENTO"(e."CO_MONITORAMENTO")
union all select 'config_entrevista', count(*)::text from public."TB_ENTREVISTA_EDITAL" c where not private."FC_EDITAL_EH_TREINAMENTO"(c."CO_MONITORAMENTO")
union all select 'avaliadores', count(*)::text from public."TB_ENTREVISTA_AVALIADOR" b where not private."FC_EDITAL_EH_TREINAMENTO"(b."CO_MONITORAMENTO")
union all select 'avaliador_competencia', count(*)::text from public."TB_ENTREVISTA_AVALIADOR_COMPETENCIA" l join public."TB_ENTREVISTA_AVALIADOR" b on b."CO_AVALIADOR" = l."CO_AVALIADOR" where not private."FC_EDITAL_EH_TREINAMENTO"(b."CO_MONITORAMENTO")
union all select 'liberacoes', count(*)::text from public."TB_ENTREVISTA_LIBERACAO" l where not private."FC_EDITAL_EH_TREINAMENTO"(l."CO_MONITORAMENTO")
union all select 'agenda', count(*)::text from public."TB_AGENDA_ENTREVISTA" g where not private."FC_EDITAL_EH_TREINAMENTO"(g."CO_MONITORAMENTO")
union all select 'historico_agenda', count(*)::text from public."TH_AGENDA_ENTREVISTA" g where not private."FC_EDITAL_EH_TREINAMENTO"(g."CO_MONITORAMENTO")
union all select 'regras_agenda', count(*)::text from public."TB_REGRA_AGENDA_ENTREVISTA" g where not private."FC_EDITAL_EH_TREINAMENTO"(g."CO_MONITORAMENTO")
union all select 'roteiros_reais', count(*)::text || ' ' || coalesce(string_agg(r."CO_ROTEIRO"::text || r."ST_ATIVO", ',' order by r."CO_ROTEIRO"), '') from public."TB_ROTEIRO_ENTREVISTA" r where r."NO_ROTEIRO" not like 'Treinamento%'
union all select 'analises', count(*)::text from public."TB_ANALISE_CURRICULAR" a where not private."FC_ANALISE_EH_TREINAMENTO"(a.origem_planilha)
union all select 'listas_classificacao', count(*)::text from public."TB_LISTA_CLASSIFICACAO" l where not private."FC_EDITAL_EH_TREINAMENTO"(l."CO_MONITORAMENTO")
union all select 'regras_analise', count(*)::text from public."TB_REGRA_ANALISE" r where not private."FC_EDITAL_EH_TREINAMENTO"(r."CO_MONITORAMENTO")
union all select 'versoes_regras_analise', count(*)::text || ' ' || count(h."NO_VERSAO")::text from public."TH_REGRA_ANALISE" h join public."TB_REGRA_ANALISE" r on r."CO_REGRA_ANALISE" = h."CO_REGRA_ANALISE" where not private."FC_EDITAL_EH_TREINAMENTO"(r."CO_MONITORAMENTO")
union all select 'fichas', count(*)::text from public."TB_FICHA_ANALISE" f where not private."FC_EDITAL_EH_TREINAMENTO"(f."CO_MONITORAMENTO")
union all select 'pre_classificacao', count(*)::text from public."TB_PRE_CLASSIFICACAO" p where not private."FC_EDITAL_EH_TREINAMENTO"(p."CO_MONITORAMENTO")
union all select 'execucoes_pre_classificacao', count(*)::text from public."TL_PRE_CLASSIFICACAO" t where not private."FC_EXECUCAO_EH_TREINAMENTO"(t."CO_EXECUCAO")
union all select 'inscricoes', count(*)::text from public."TB_EMPREGARE_CANDIDATO" c join public."TB_EMPREGARE_VAGA" v on v."CO_VAGA" = c."CO_VAGA" where not private."FC_EDITAL_EH_TREINAMENTO"(v."CO_MONITORAMENTO")
union all select 'cronograma', count(*)::text from public."TB_CRONOGRAMA_MONIT_INDIG" c where not private."FC_EDITAL_EH_TREINAMENTO"(c.monitoramento_id)
union all select 'aprovados', count(*)::text from public."TB_CANDIDATO_APROVADO" c
union all select 'editais_reais', count(*)::text from public."TB_MONITORAMENTO_INDIGENA" m where m."ST_TREINAMENTO" = 'N'
union all select 'kpis', (select row_to_json(k)::text from public."VW_MONITORAMENTO_INDIGENA_KPIS" k)
union all select '93_regra', (select r."NU_VERSAO_VIGENTE" || ' ' || r."TP_SITUACAO" || ' ' || h."DS_HASH" || ' ' || coalesce(h."NO_VERSAO", '-') from public."TB_REGRA_ANALISE" r join public."TH_REGRA_ANALISE" h on h."CO_REGRA_ANALISE" = r."CO_REGRA_ANALISE" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE" where r."CO_MONITORAMENTO" in (select id from e93))
union all select '93_entrevistas', count(*)::text from public."TB_ENTREVISTA" e where e."CO_MONITORAMENTO" in (select id from e93)
union all select '111_regra', coalesce((select r."NU_VERSAO_VIGENTE" || ' ' || r."TP_SITUACAO" from public."TB_REGRA_ANALISE" r where r."CO_MONITORAMENTO" in (select id from e111)), '-')
union all select '111_inscricoes', count(*)::text from public."TB_EMPREGARE_CANDIDATO" c join public."TB_EMPREGARE_VAGA" v on v."CO_VAGA" = c."CO_VAGA" where v."CO_MONITORAMENTO" in (select id from e111)
union all select '111_entrevistas', count(*)::text from public."TB_ENTREVISTA" e where e."CO_MONITORAMENTO" in (select id from e111)
;

-- ═══ A MIGRATION ═══════════════════════════════════════════════════════
/*
  TREINAMENTOS COMPLETOS: AS DUAS ETAPAS PRONTAS NOS DOIS EDITAIS DE TREINAMENTO (09/10/2026)

  Pedido (apresentação para Saúde Indígena e Projetos): "não tem teste de
  avaliação documental para Saúde Indígena e não tem entrevistas para
  Projetos". Antes: o 991/2099 (SI) tinha a entrevista, mas a avaliação
  documental só com a regra em Conferir (sem pré-classificação nem fichas); o
  992/2099 (Projetos) tinha a avaliação documental (21 fichas), mas nenhuma
  entrevista. Depois, cada um com as DUAS etapas prontas para demonstrar:

  1. SAÚDE INDÍGENA (991/2099) — avaliação documental
     - a regra do Edital 111/2026 (modelo SI26-PARINTINS, perguntas do
       questionário NERSSI ligadas) CONFERIDA e com nome de versão
       ("SI26-PARINTINS — Edital 111/2026"); a que estava em Conferir, sem
       pré-classificação, passa a conferida;
     - 30 candidatos fictícios (os 15 de antes, iguais, e mais 15): indígena
       com e sem aldeia, não indígena, quem compete na ampla mesmo sendo
       indígena, cotas (pretos e pardos, PcD, quilombola), cancelado,
       questionário pendente, reprovado na Empregare, empate (o mais velho na
       frente) e dois abaixo da linha de corte do lote (AIS: 5 × 2 vagas);
     - a pré-classificação gravada: o resultado do MESMO cálculo Python do
       job (processar_edital), gerado por
       scripts/pre_classificacao/gerar_treinamento.py --area saude-indigena a
       partir de tests/fixtures/avaliacao-documental/treinamento-saude-indigena.json
       (conferido por tests/python/test_treinamento_saude_indigena.py), gravado
       por private."FC_PRE_CLASSIFICAR_TREINAMENTO" pelas RPCs do job; as
       fichas do lote ficam PENDENTE, prontas para "Pegar próximo".
     As análises aprovadas, a lista de convocação e a entrevista continuam
     as de antes (os 15 primeiros).

  2. PROJETOS (992/2099) — entrevista
     - roteiro "Treinamento — Entrevista Projetos (exemplo)": cópia
       independente do modelo da área (Análise Comportamental do SESMT, Edital
       93/2026): 4 competências de 0 a 2 (passo 0,5; intercultural e
       comportamental com peso 1,5; o estudo de caso é em grupo), apto com 5
       pontos e 50% em cada; sem aspectos (o de SI mostra os aspectos);
     - configuração com lançamento "secretaria passa a limpo", as 5 vagas e
       a banca do modelo (CDHO / AgSUS, SSO / AgSUS, CONDISI) com 3
       avaliadores fictícios — o Avaliador Teste P3 (CONDISI) avalia só
       "Habilidade intercultural" (avaliador por competência);
     - a regra da classificação (a do 93/2026, já copiada: entrevista e
       convocação 5 × vagas) e a lista de convocação gerada do lote da
       pré-classificação (os 21 do lote, pela nota da pré-classificação);
     - liberação da janela da entrevista (o cronograma do 93/2026 põe as
       entrevistas depois da análise; o treino mostra as duas etapas juntas).

  3. NOS DOIS: os convocados da lista viram entrevistas do sistema (como
     public.convocar_para_entrevista) e a agenda é montada a partir de HOJE
     (o dia do preparar ou do reinício): 6 entrevistas hoje e as demais nos
     dias úteis seguintes, banca 1, 30 minutos — a fila "Hoje" do Conduzir
     tem itens. Agenda já existente ou entrevistas já convocadas ficam.

  Travas mantidas: o reinício (public.reiniciar_edital_treinamento) só para
  admin global e só ST_TREINAMENTO = S (antes de apagar), apaga só o que o
  private."FC_APAGAR_DADOS_DO_TREINAMENTO" já apagava (entrevistas, agenda,
  liberação, listas, fichas, pré-classificação, inscrições fictícias,
  análises de origem treinamento) e recria tudo isto por área; as funções
  novas recusam edital real (42501). Os predicados de sempre
  (FC_EH_TREINAMENTO, FC_EDITAL_EH_TREINAMENTO, FC_ANALISE_EH_TREINAMENTO,
  FC_EXECUCAO_EH_TREINAMENTO) continuam tirando o treinamento de painéis,
  KPIs, conferências e robôs: nada novo é lido fora do edital.

  O QUE MUDA (nenhuma assinatura de RPC pública muda)
    private."FC_PREPARAR_TREINAMENTO_SI"(text, text)            recriada (30 candidatos, regra conferida, pré-classificação)
    private."FC_PREPARAR_ENTREVISTA_TREINAMENTO_PROJETOS"(uuid)  NOVA (roteiro, banca, liberação, lista de convocação)
    private."FC_CONVOCAR_E_AGENDAR_TREINAMENTO"(uuid)            NOVA (entrevistas do sistema e agenda a partir de hoje)
    private."FC_PREPARAR_EDITAL_TREINAMENTO"(text)               recriada (chama as novas)
    public.reiniciar_edital_treinamento(uuid)                    recriada (SI com 30 inscritos)
  E prepara os dois editais (idempotente: completa o que falta).

  Rollback: supabase/rollback/20261009120000_treinamentos_completos.sql
  Ensaio:   supabase/ensaios/20261009120000_treinamentos_completos.sql
*/

set local lock_timeout = '10s';

-- 0. Pré-requisitos ---------------------------------------------------------------------
do $$
begin
  if to_regprocedure('private."FC_PRE_CLASSIFICAR_TREINAMENTO"(uuid, jsonb)') is null then
    raise exception 'Aplique antes 20261008110000_treinamento_avaliacao_documental.sql.';
  end if;
  if to_regclass('public."TB_ENTREVISTA_AVALIADOR_COMPETENCIA"') is null then
    raise exception 'Aplique antes 20261008170000_avaliador_por_competencia.sql.';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'TH_REGRA_ANALISE' and column_name = 'NO_VERSAO') then
    raise exception 'Aplique antes 20261008180000_nome_das_versoes_das_regras.sql.';
  end if;
  if to_regclass('public."TB_AGENDA_ENTREVISTA"') is null then
    raise exception 'Aplique antes 20261005120000_agenda_das_entrevistas.sql.';
  end if;
end;
$$;

-- ── 1. Saúde Indígena: avaliação documental pronta ───────────────────────────
create or replace function private."FC_PREPARAR_TREINAMENTO_SI"(p_grupo text, p_planilha text)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  c_numero constant text := '991/2099';
  c_edital constant text := 'Treinamento – Saúde Indígena (991/2099)';
  c_unidade constant text := 'DSEI Treinamento';
  c_origem constant text := 'treinamento';
  c_nome_regra constant text := 'SI26-PARINTINS — Edital 111/2026';
  v_area constant text := 'saude-indigena';
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_uid uuid := coalesce((select auth.uid()), '00000000-0000-0000-0000-000000000000'::uuid);
  v_id uuid;
  v_planilha text := p_planilha;
  v_grupo text := p_grupo;
  v_enun_fund text[];
  v_enun_sup text[];
  v_enun_tec text[];
  v_perguntas jsonb;
  v_roteiro uuid;
  v_origem_roteiro uuid;
  v_regra_classif uuid;
  v_config_classif jsonb;
  v_modelo public."TB_REGRA_ANALISE_MODELO";
  v_config_analise jsonb;
  v_resultado jsonb;
  -- O resultado da pré-classificação destes fictícios, calculado pelo Python
  -- (python/monitora/avaliacao_documental/pre_classificacao.py) com a regra do 111/2026.
  -- Gerado por scripts/pre_classificacao/gerar_treinamento.py --area saude-indigena; o
  -- pytest tests/python/test_treinamento_saude_indigena.py confere que o Python dá o mesmo.
  -- pre-classificacao-do-treinamento-si:inicio
  c_pre constant jsonb := $pre${"edital":{"rotulo":"991/2099","situacao":"PROCESSADO","vagas":3,"inscritos":30,"eliminados":4,"ranqueados":26,"no_lote":24,"por_decisao":0,"divergencias":0,"pela_art":0,"congeladas":0,"avisos":[],"base_da_nota":"ART","congelar":true},"vagas":{"9909910001":{"resumo":{"tamanho":15,"descricao":"5 × (2 + CR) = 15","por_modalidade":null,"acima_do_corte":0,"avisos":[]},"linhas":[{"codigo":"TREINO-01","situacao":"NO_LOTE","motivo_codigo":null,"motivo":null,"art":1.0,"nota":1.0,"origem_nota":"ART","declarada":null,"declarada_parciais":null,"declarada_completa":null,"declarada_congelada":null,"sem_mapa":0,"divergente":false,"modalidade":"AC","posicao":7,"posicao_modalidade":4,"lote":1,"lista_lote":"GERAL","entrada":"INICIAL","motivo_entrada":"Lote inicial: 5 × (2 + CR) = 15"},{"codigo":"TREINO-02","situacao":"NO_LOTE","motivo_codigo":null,"motivo":null,"art":2.6,"nota":2.6,"origem_nota":"ART","declarada":null,"declarada_parciais":null,"declarada_completa":null,"declarada_congelada":null,"sem_mapa":0,"divergente":false,"modalidade":"AC","posicao":6,"posicao_modalidade":3,"lote":1,"lista_lote":"GERAL","entrada":"INICIAL","motivo_entrada":"Lote inicial: 5 × (2 + CR) = 15"},{"codigo":"TREINO-03","situacao":"NO_LOTE","motivo_codigo":null,"motivo":null,"art":15.2,"nota":15.2,"origem_nota":"ART","declarada":null,"declarada_parciais":null,"declarada_completa":null,"declarada_congelada":null,"sem_mapa":0,"divergente":false,"modalidade":"PI","posicao":1,"posicao_modalidade":1,"lote":1,"lista_lote":"GERAL","entrada":"INICIAL","motivo_entrada":"Lote inicial: 5 × (2 + CR) = 15"},{"codigo":"TREINO-04","situacao":"NO_LOTE","motivo_codigo":null,"motivo":null,"art":3.8,"nota":3.8,"origem_nota":"ART","declarada":null,"declarada_parciais":null,"declarada_completa":null,"declarada_congelada":null,"sem_mapa":0,"divergente":false,"modalidade":"AC","posicao":5,"posicao_modalidade":2,"lote":1,"lista_lote":"GERAL","entrada":"INICIAL","motivo_entrada":"Lote inicial: 5 × (2 + CR) = 15"},{"codigo":"TREINO-05","situacao":"NO_LOTE","motivo_codigo":null,"motivo":null,"art":7.2,"nota":7.2,"origem_nota":"ART","declarada":null,"declarada_parciais":null,"declarada_completa":null,"declarada_congelada":null,"sem_mapa":0,"divergente":false,"modalidade":"AC","posicao":3,"posicao_modalidade":1,"lote":1,"lista_lote":"GERAL","entrada":"INICIAL","motivo_entrada":"Lote inicial: 5 × (2 + CR) = 15"},{"codigo":"TREINO-16","situacao":"NO_LOTE","motivo_codigo":null,"motivo":null,"art":9.2,"nota":9.2,"origem_nota":"ART","declarada":null,"declarada_parciais":null,"declarada_completa":null,"declarada_congelada":null,"sem_mapa":0,"divergente":false,"modalidade":"PP","posicao":2,"posicao_modalidade":1,"lote":1,"lista_lote":"GERAL","entrada":"INICIAL","motivo_entrada":"Lote inicial: 5 × (2 + CR) = 15"},{"codigo":"TREINO-17","situacao":"ELIMINADO","motivo_codigo":"CANCELADO","motivo":"Cancelou a inscrição","art":11.6,"nota":11.6,"origem_nota":"ART","declarada":null,"declarada_parciais":null,"declarada_completa":null,"declarada_congelada":null,"sem_mapa":0,"divergente":false,"modalidade":"AC","posicao":null,"posicao_modalidade":null,"lote":null,"lista_lote":null,"entrada":null,"motivo_entrada":null},{"codigo":"TREINO-18","situacao":"NO_LOTE","motivo_codigo":null,"motivo":null,"art":5.0,"nota":5.0,"origem_nota":"ART","declarada":null,"declarada_parciais":null,"declarada_completa":null,"declarada_congelada":null,"sem_mapa":0,"divergente":false,"modalidade":"PCD","posicao":4,"posicao_modalidade":1,"lote":1,"lista_lote":"GERAL","entrada":"INICIAL","motivo_entrada":"Lote inicial: 5 × (2 + CR) = 15"}]},"9909910002":{"resumo":{"tamanho":20,"descricao":"5 × (3 + CR) = 20","por_modalidade":null,"acima_do_corte":0,"avisos":[]},"linhas":[{"codigo":"TREINO-06","situacao":"NO_LOTE","motivo_codigo":null,"motivo":null,"art":10.0,"nota":10.0,"origem_nota":"ART","declarada":null,"declarada_parciais":null,"declarada_completa":null,"declarada_congelada":null,"sem_mapa":0,"divergente":false,"modalidade":"AC","posicao":4,"posicao_modalidade":2,"lote":1,"lista_lote":"GERAL","entrada":"INICIAL","motivo_entrada":"Lote inicial: 5 × (3 + CR) = 20"},{"codigo":"TREINO-07","situacao":"NO_LOTE","motivo_codigo":null,"motivo":null,"art":3.8,"nota":3.8,"origem_nota":"ART","declarada":null,"declarada_parciais":null,"declarada_completa":null,"declarada_congelada":null,"sem_mapa":0,"divergente":false,"modalidade":"AC","posicao":7,"posicao_modalidade":5,"lote":1,"lista_lote":"GERAL","entrada":"INICIAL","motivo_entrada":"Lote inicial: 5 × (3 + CR) = 20"},{"codigo":"TREINO-08","situacao":"NO_LOTE","motivo_codigo":null,"motivo":null,"art":15.6,"nota":15.6,"origem_nota":"ART","declarada":null,"declarada_parciais":null,"declarada_completa":null,"declarada_congelada":null,"sem_mapa":0,"divergente":false,"modalidade":"PI","posicao":2,"posicao_modalidade":2,"lote":1,"lista_lote":"GERAL","entrada":"INICIAL","motivo_entrada":"Lote inicial: 5 × (3 + CR) = 20"},{"codigo":"TREINO-09","situacao":"NO_LOTE","motivo_codigo":null,"motivo":null,"art":6.2,"nota":6.2,"origem_nota":"ART","declarada":null,"declarada_parciais":null,"declarada_completa":null,"declarada_congelada":null,"sem_mapa":0,"divergente":false,"modalidade":"AC","posicao":5,"posicao_modalidade":3,"lote":1,"lista_lote":"GERAL","entrada":"INICIAL","motivo_entrada":"Lote inicial: 5 × (3 + CR) = 20"},{"codigo":"TREINO-10","situacao":"NO_LOTE","motivo_codigo":null,"motivo":null,"art":10.8,"nota":10.8,"origem_nota":"ART","declarada":null,"declarada_parciais":null,"declarada_completa":null,"declarada_congelada":null,"sem_mapa":0,"divergente":false,"modalidade":"AC","posicao":3,"posicao_modalidade":1,"lote":1,"lista_lote":"GERAL","entrada":"INICIAL","motivo_entrada":"Lote inicial: 5 × (3 + CR) = 20"},{"codigo":"TREINO-11","situacao":"NO_LOTE","motivo_codigo":null,"motivo":null,"art":4.8,"nota":4.8,"origem_nota":"ART","declarada":null,"declarada_parciais":null,"declarada_completa":null,"declarada_congelada":null,"sem_mapa":0,"divergente":false,"modalidade":"AC","posicao":6,"posicao_modalidade":4,"lote":1,"lista_lote":"GERAL","entrada":"INICIAL","motivo_entrada":"Lote inicial: 5 × (3 + CR) = 20"},{"codigo":"TREINO-19","situacao":"ELIMINADO","motivo_codigo":"QUESTIONARIO","motivo":"Não finalizou o questionário","art":null,"nota":null,"origem_nota":null,"declarada":null,"declarada_parciais":null,"declarada_completa":null,"declarada_congelada":null,"sem_mapa":0,"divergente":false,"modalidade":"AC","posicao":null,"posicao_modalidade":null,"lote":null,"lista_lote":null,"entrada":null,"motivo_entrada":null},{"codigo":"TREINO-20","situacao":"NO_LOTE","motivo_codigo":null,"motivo":null,"art":27.6,"nota":27.6,"origem_nota":"ART","declarada":null,"declarada_parciais":null,"declarada_completa":null,"declarada_congelada":null,"sem_mapa":0,"divergente":false,"modalidade":"PI","posicao":1,"posicao_modalidade":1,"lote":1,"lista_lote":"GERAL","entrada":"INICIAL","motivo_entrada":"Lote inicial: 5 × (3 + CR) = 20"}]},"9909910003":{"resumo":{"tamanho":10,"descricao":"5 × 2 = 10","por_modalidade":null,"acima_do_corte":0,"avisos":[]},"linhas":[{"codigo":"TREINO-12","situacao":"NO_LOTE","motivo_codigo":null,"motivo":null,"art":22.4,"nota":22.4,"origem_nota":"ART","declarada":null,"declarada_parciais":null,"declarada_completa":null,"declarada_congelada":null,"sem_mapa":0,"divergente":false,"modalidade":"PI","posicao":2,"posicao_modalidade":2,"lote":1,"lista_lote":"GERAL","entrada":"INICIAL","motivo_entrada":"Lote inicial: 5 × 2 = 10"},{"codigo":"TREINO-13","situacao":"NO_LOTE","motivo_codigo":null,"motivo":null,"art":12.4,"nota":12.4,"origem_nota":"ART","declarada":null,"declarada_parciais":null,"declarada_completa":null,"declarada_congelada":null,"sem_mapa":0,"divergente":false,"modalidade":"AC","posicao":7,"posicao_modalidade":2,"lote":1,"lista_lote":"GERAL","entrada":"INICIAL","motivo_entrada":"Lote inicial: 5 × 2 = 10"},{"codigo":"TREINO-14","situacao":"NO_LOTE","motivo_codigo":null,"motivo":null,"art":21.4,"nota":21.4,"origem_nota":"ART","declarada":null,"declarada_parciais":null,"declarada_completa":null,"declarada_congelada":null,"sem_mapa":0,"divergente":false,"modalidade":"PI","posicao":3,"posicao_modalidade":3,"lote":1,"lista_lote":"GERAL","entrada":"INICIAL","motivo_entrada":"Lote inicial: 5 × 2 = 10"},{"codigo":"TREINO-15","situacao":"ELIMINADO","motivo_codigo":"QUESTIONARIO","motivo":"Não finalizou o questionário","art":10.0,"nota":10.0,"origem_nota":"ART","declarada":null,"declarada_parciais":null,"declarada_completa":null,"declarada_congelada":null,"sem_mapa":0,"divergente":false,"modalidade":"AC","posicao":null,"posicao_modalidade":null,"lote":null,"lista_lote":null,"entrada":null,"motivo_entrada":null},{"codigo":"TREINO-21","situacao":"NO_LOTE","motivo_codigo":null,"motivo":null,"art":28.0,"nota":28.0,"origem_nota":"ART","declarada":null,"declarada_parciais":null,"declarada_completa":null,"declarada_congelada":null,"sem_mapa":0,"divergente":false,"modalidade":"PI","posicao":1,"posicao_modalidade":1,"lote":1,"lista_lote":"GERAL","entrada":"INICIAL","motivo_entrada":"Lote inicial: 5 × 2 = 10"},{"codigo":"TREINO-22","situacao":"NO_LOTE","motivo_codigo":null,"motivo":null,"art":12.8,"nota":12.8,"origem_nota":"ART","declarada":null,"declarada_parciais":null,"declarada_completa":null,"declarada_congelada":null,"sem_mapa":0,"divergente":false,"modalidade":"PI","posicao":6,"posicao_modalidade":5,"lote":1,"lista_lote":"GERAL","entrada":"INICIAL","motivo_entrada":"Lote inicial: 5 × 2 = 10"},{"codigo":"TREINO-23","situacao":"NO_LOTE","motivo_codigo":null,"motivo":null,"art":15.2,"nota":15.2,"origem_nota":"ART","declarada":null,"declarada_parciais":null,"declarada_completa":null,"declarada_congelada":null,"sem_mapa":0,"divergente":false,"modalidade":"AC","posicao":5,"posicao_modalidade":1,"lote":1,"lista_lote":"GERAL","entrada":"INICIAL","motivo_entrada":"Lote inicial: 5 × 2 = 10"},{"codigo":"TREINO-24","situacao":"NO_LOTE","motivo_codigo":null,"motivo":null,"art":12.0,"nota":12.0,"origem_nota":"ART","declarada":null,"declarada_parciais":null,"declarada_completa":null,"declarada_congelada":null,"sem_mapa":0,"divergente":false,"modalidade":"AC","posicao":8,"posicao_modalidade":3,"lote":1,"lista_lote":"GERAL","entrada":"INICIAL","motivo_entrada":"Lote inicial: 5 × 2 = 10"},{"codigo":"TREINO-25","situacao":"RANQUEADO","motivo_codigo":null,"motivo":null,"art":0.0,"nota":0.0,"origem_nota":"ART","declarada":null,"declarada_parciais":null,"declarada_completa":null,"declarada_congelada":null,"sem_mapa":0,"divergente":false,"modalidade":"AC","posicao":12,"posicao_modalidade":6,"lote":null,"lista_lote":null,"entrada":null,"motivo_entrada":null},{"codigo":"TREINO-26","situacao":"RANQUEADO","motivo_codigo":null,"motivo":null,"art":0.6,"nota":0.6,"origem_nota":"ART","declarada":null,"declarada_parciais":null,"declarada_completa":null,"declarada_congelada":null,"sem_mapa":0,"divergente":false,"modalidade":"AC","posicao":11,"posicao_modalidade":5,"lote":null,"lista_lote":null,"entrada":null,"motivo_entrada":null},{"codigo":"TREINO-27","situacao":"ELIMINADO","motivo_codigo":"REPROVADO_EMPREGARE","motivo":"Reprovado na Empregare","art":23.6,"nota":23.6,"origem_nota":"ART","declarada":null,"declarada_parciais":null,"declarada_completa":null,"declarada_congelada":null,"sem_mapa":0,"divergente":false,"modalidade":"PI","posicao":null,"posicao_modalidade":null,"lote":null,"lista_lote":null,"entrada":null,"motivo_entrada":null},{"codigo":"TREINO-28","situacao":"NO_LOTE","motivo_codigo":null,"motivo":null,"art":8.4,"nota":8.4,"origem_nota":"ART","declarada":null,"declarada_parciais":null,"declarada_completa":null,"declarada_congelada":null,"sem_mapa":0,"divergente":false,"modalidade":"PQ","posicao":10,"posicao_modalidade":1,"lote":1,"lista_lote":"GERAL","entrada":"INICIAL","motivo_entrada":"Lote inicial: 5 × 2 = 10"},{"codigo":"TREINO-29","situacao":"NO_LOTE","motivo_codigo":null,"motivo":null,"art":16.4,"nota":16.4,"origem_nota":"ART","declarada":null,"declarada_parciais":null,"declarada_completa":null,"declarada_congelada":null,"sem_mapa":0,"divergente":false,"modalidade":"PI","posicao":4,"posicao_modalidade":4,"lote":1,"lista_lote":"GERAL","entrada":"INICIAL","motivo_entrada":"Lote inicial: 5 × 2 = 10"},{"codigo":"TREINO-30","situacao":"NO_LOTE","motivo_codigo":null,"motivo":null,"art":8.4,"nota":8.4,"origem_nota":"ART","declarada":null,"declarada_parciais":null,"declarada_completa":null,"declarada_congelada":null,"sem_mapa":0,"divergente":false,"modalidade":"AC","posicao":9,"posicao_modalidade":4,"lote":1,"lista_lote":"GERAL","entrada":"INICIAL","motivo_entrada":"Lote inicial: 5 × 2 = 10"}]}}}$pre$::jsonb;
  -- pre-classificacao-do-treinamento-si:fim
begin
  -- Vagas, candidatos e notas fictícios (nada de dado pessoal real).
  create temporary table if not exists tmp_treino_vaga (
    vaga text primary key, ordem smallint, cargo text, imediatas integer, cr boolean, nivel text
  ) on commit drop;
  truncate tmp_treino_vaga;
  insert into tmp_treino_vaga values
    ('9909910001', 1, 'Enfermeiro', 2, true, 'Superior'),
    ('9909910002', 2, 'Técnico de Enfermagem', 3, true, 'Técnico'),
    ('9909910003', 3, 'Agente Indígena de Saúde (AIS)', 2, false, 'Fundamental');

  -- Os 30 candidatos: os 15 primeiros são os de antes (análise aprovada, convocação e
  -- entrevista); os demais só se inscreveram (avaliação documental). Respostas: étnico
  -- (0, 8 = indígena, 14 = indígena e aldeia), formação (pontos do nível), meses de
  -- experiência (0,2 ponto por mês, até 10), modalidade como na Empregare.
  create temporary table if not exists tmp_treino_candidato (
    n integer primary key, codigo text, nome text, email text, vaga text, nota numeric,
    modalidade text, indigena boolean, nascimento date, situacao text, quest text,
    etnico integer, formacao integer, meses integer, modal text, reprovado text
  ) on commit drop;
  truncate tmp_treino_candidato;
  insert into tmp_treino_candidato
  select x.n, 'TREINO-' || lpad(x.n::text, 2, '0'), 'Candidato Teste ' || lpad(x.n::text, 2, '0'),
         'candidato.teste' || lpad(x.n::text, 2, '0') || '@exemplo.invalid',
         x.vaga, x.nota, x.modalidade, x.indigena, x.nascimento, x.situacao, x.quest,
         x.etnico, x.formacao, x.meses, x.modal, x.reprovado
    from (values
      -- Enfermeiro (2 vagas + CR: lote de 15)
      ( 1, '9909910001', 82.5,  'Ampla Concorrência', false, date '1972-02-02', 'INSCRITO',  'FINALIZADO',    0, 1,  0, '"Ampla concorrência"', 'NÃO'),
      ( 2, '9909910001', 77,    'Ampla Concorrência', false, date '1974-03-03', 'INSCRITO',  'FINALIZADO',    0, 2,  3, '"Ampla concorrência"', 'NÃO'),
      ( 3, '9909910001', 71.25, 'Indígenas',          true,  date '1976-04-04', 'INSCRITO',  'FINALIZADO',   14, 0,  6, '"Indígenas"',          'NÃO'),
      ( 4, '9909910001', 64,    'Ampla Concorrência', false, date '1978-05-05', 'INSCRITO',  'FINALIZADO',    0, 1, 14, '"Ampla concorrência"', 'NÃO'),
      ( 5, '9909910001', 58.5,  'Ampla Concorrência', false, date '1980-06-06', 'INSCRITO',  'FINALIZADO',    0, 2, 26, '"Ampla concorrência"', 'NÃO'),
      (16, '9909910001', null,  'Pretos ou pardos',   false, date '1985-03-18', 'INSCRITO',  'FINALIZADO',    0, 2, 36, '"Pretos ou pardos"',   'NÃO'),
      (17, '9909910001', null,  'Ampla Concorrência', false, date '1983-09-27', 'CANCELADO', 'FINALIZADO',    0, 2, 48, '"Ampla concorrência"', 'NÃO'),
      (18, '9909910001', null,  'PcD',                false, date '1989-12-05', 'INSCRITO',  'FINALIZADO',    0, 1, 20, '"Pessoa com deficiência (PcD)"', 'NÃO'),
      -- Técnico de Enfermagem (3 vagas + CR: lote de 20)
      ( 6, '9909910002', 88,    'Ampla Concorrência', false, date '1982-07-07', 'INSCRITO',  'FINALIZADO',    0, 0, 50, '"Ampla concorrência"', 'NÃO'),
      ( 7, '9909910002', 79.5,  'Ampla Concorrência', false, date '1984-08-08', 'INSCRITO',  'FINALIZADO',    0, 2,  9, '"Ampla concorrência"', 'NÃO'),
      ( 8, '9909910002', 73,    'Indígenas',          true,  date '1986-09-09', 'INSCRITO',  'FINALIZADO',    8, 4, 18, '"Indígenas"',          'NÃO'),
      ( 9, '9909910002', 69.75, 'Ampla Concorrência', false, date '1988-10-10', 'INSCRITO',  'FINALIZADO',    0, 0, 31, '"Ampla concorrência"', 'NÃO'),
      (10, '9909910002', 61,    'Ampla Concorrência', false, date '1990-11-11', 'INSCRITO',  'FINALIZADO',    0, 2, 44, '"Ampla concorrência"', 'NÃO'),
      (11, '9909910002', 55.5,  'Ampla Concorrência', false, date '1992-12-12', 'INSCRITO',  'FINALIZADO',    0, 4,  4, '"Ampla concorrência"', 'NÃO'),
      (19, '9909910002', null,  'Ampla Concorrência', false, date '1994-06-21', 'INSCRITO',  'PENDENTE',      0, 0,  0, '"Ampla concorrência"', 'NÃO'),
      (20, '9909910002', null,  'Indígenas',          false, date '1987-02-14', 'INSCRITO',  'FINALIZADO',   14, 4, 48, '"Indígenas"',          'NÃO'),
      -- Agente Indígena de Saúde (2 vagas, sem CR: lote de 10)
      (12, '9909910003', 74,    'Indígenas',          true,  date '1994-01-13', 'INSCRITO',  'FINALIZADO',   14, 6, 12, '"Indígenas"',          'NÃO'),
      (13, '9909910003', 68.25, 'Ampla Concorrência', true,  date '1996-02-14', 'INSCRITO',  'FINALIZADO',    8, 0, 22, '"Ampla concorrência"', 'NÃO'),
      (14, '9909910003', 62,    'Indígenas',          true,  date '1998-03-15', 'INSCRITO',  'FINALIZADO',   14, 6,  7, '"Indígenas"',          'NÃO'),
      (15, '9909910003', 51.5,  'Ampla Concorrência', false, date '2000-04-16', 'INSCRITO',  'EM ANDAMENTO',  0, 0, 60, '"Ampla concorrência"', 'NÃO'),
      (21, '9909910003', null,  'Indígenas',          false, date '1979-08-30', 'INSCRITO',  'FINALIZADO',   14, 6, 40, '"Indígenas"',          'NÃO'),
      (22, '9909910003', null,  'Indígenas',          false, date '1991-05-09', 'INSCRITO',  'FINALIZADO',    8, 0, 24, '"Indígenas"',          'NÃO'),
      (23, '9909910003', null,  'Ampla Concorrência', false, date '1993-10-02', 'INSCRITO',  'FINALIZADO',   14, 0,  6, '"Ampla concorrência"', 'NÃO'),
      (24, '9909910003', null,  'Ampla Concorrência', false, date '1986-04-25', 'INSCRITO',  'FINALIZADO',    0, 6, 30, '"Ampla concorrência"', 'NÃO'),
      (25, '9909910003', null,  'Ampla Concorrência', false, date '1999-11-19', 'INSCRITO',  'FINALIZADO',    0, 0,  0, '"Ampla concorrência"', 'NÃO'),
      (26, '9909910003', null,  'Ampla Concorrência', false, date '1997-07-07', 'INSCRITO',  'FINALIZADO',    0, 0,  3, '"Ampla concorrência"', 'NÃO'),
      (27, '9909910003', null,  'Indígenas',          false, date '1990-01-31', 'INSCRITO',  'FINALIZADO',   14, 6, 18, '"Indígenas"',          'SIM'),
      (28, '9909910003', null,  'Quilombolas',        false, date '1985-06-12', 'INSCRITO',  'FINALIZADO',    0, 6, 12, '"Quilombolas"',        'NÃO'),
      (29, '9909910003', null,  'Indígenas',          false, date '1992-09-03', 'INSCRITO',  'FINALIZADO',    8, 6, 12, '"Indígenas"',          'NÃO'),
      (30, '9909910003', null,  'Ampla Concorrência', false, date '1962-03-08', 'INSCRITO',  'FINALIZADO',    0, 6, 12, '"Ampla concorrência"', 'NÃO')
    ) x(n, vaga, nota, modalidade, indigena, nascimento, situacao, quest, etnico, formacao, meses, modal, reprovado);

  -- O edital.
  select m.id into v_id
    from public."TB_MONITORAMENTO_INDIGENA" m
   where m."CO_AREA" = v_area and m."ST_TREINAMENTO" = 'S'
   order by m.created_at, m.id
   limit 1;
  if v_id is null then
    insert into public."TB_MONITORAMENTO_INDIGENA" (
      processo, edital, sigla_unidade, tipo_unidade, unidade, uf, ciclo, cargos, vagas_total, inscritos,
      aptos_analise, data_inicio, data_fim, status, etapa, risco, responsavel, observacoes,
      observacoes_internas, ativo, origem_carga, cronograma_origem, "CO_AREA", "ST_TREINAMENTO")
    values (
      'TREINAMENTO', c_edital, 'TREINO', 'DSEI', c_unidade, 'DF', '2099',
      'Enfermeiro; Técnico de Enfermagem; Agente Indígena de Saúde (AIS)', 7, 30, 30,
      v_hoje - 45, v_hoje + 30, 'Em andamento', 'Entrevistas', 'Baixo', 'Treinamento',
      'Edital de treinamento: dados fictícios, sem valor oficial.',
      'Criado por private."FC_PREPARAR_EDITAL_TREINAMENTO". Reinicie em Editais (admin).',
      true, 'TREINAMENTO', 'MANUAL', v_area, 'S')
    returning id into v_id;
  else
    update public."TB_MONITORAMENTO_INDIGENA" set inscritos = 30, aptos_analise = 30
     where id = v_id and "ST_TREINAMENTO" = 'S' and (inscritos, aptos_analise) is distinct from (30, 30);
  end if;

  -- Cronograma relativo a hoje: inscrições já passaram, avaliação documental e
  -- entrevistas em andamento (FC_JANELA_ENTREVISTA fica aberta).
  if not exists (select 1 from public."TB_CRONOGRAMA_MONIT_INDIG" c where c.monitoramento_id = v_id) then
    insert into public."TB_CRONOGRAMA_MONIT_INDIG" (monitoramento_id, ordem, atividade, tipo_atividade, data_inicio, data_fim, origem, observacao)
    select v_id, x.ordem, x.atividade, x.tipo, v_hoje + x.ini, v_hoje + x.fim, 'MANUAL', 'Treinamento'
      from (values
        (1, 'Publicação do Edital', 'PUBLICACAO', -45, -45),
        (2, 'Período de inscrição e Envio dos Documentos Comprobatórios de Requisitos', 'INSCRICAO', -44, -30),
        (3, 'Avaliação Documental e de Títulos', 'ANALISE', -29, 10),
        (4, 'Resultado Preliminar da Avaliação Documental e de Títulos', 'RESULTADO', -12, -12),
        (5, 'Prazo de recurso referente ao resultado preliminar da Avaliação Documental e de Títulos', 'RECURSO', -11, -9),
        (6, 'Resultado Final da Avaliação Documental e de Títulos', 'RESULTADO', -7, -7),
        (7, 'Convocação para a Entrevista', 'CONVOCACAO', -5, -5),
        (8, 'Período de Entrevistas', 'ENTREVISTA', -2, 12),
        (9, 'Resultado Preliminar das Entrevistas', 'RESULTADO', 15, 15),
        (10, 'Prazo para recursos referentes ao resultado preliminar das entrevistas', 'RECURSO', 16, 18),
        (11, 'Resultado final da Entrevista', 'RESULTADO', 21, 21),
        (12, 'Resultado final do Processo Seletivo', 'RESULTADO', 25, 25)
      ) x(ordem, atividade, tipo, ini, fim);
  end if;

  -- Quadro de vagas.
  if not exists (select 1 from public."TB_QUADRO_VAGA_EDITAL" q where q."CO_MONITORAMENTO" = v_id and q."ST_REGISTRO_ATIVO" = 'S') then
    insert into public."TB_QUADRO_VAGA_EDITAL" ("CO_MONITORAMENTO", "NU_ORDEM", "NO_CARGO", "NO_LOTACAO",
      "DS_MODALIDADE_VAGA", "QT_VAGA_IMEDIATA", "ST_CADASTRO_RESERVA", "TP_ORIGEM", "DS_ARQUIVO_ORIGEM", "CO_USUARIO_ATUALIZACAO")
    select v_id, t.ordem, t.cargo, c_unidade,
           jsonb_build_object('Ampla Concorrência', t.imediatas, 'Indígenas', null),
           t.imediatas, case when t.cr then 'S' else 'N' end, 'MANUAL', 'treinamento', v_uid
      from tmp_treino_vaga t;
  end if;

  -- Análises curriculares fictícias (aprovadas) dos 15 primeiros: a fonte da Classificação
  -- e da convocação.
  insert into public."TB_ANALISE_CURRICULAR" (grupo, unidade, edital, codigo_vaga, nome_vaga, candidato, cpf_hash,
    categoria, modalidade_concorrencia, status_consolidado, etapa, responsavel_analise, data_analise,
    nota_final_ajustada, pontuacao_escolaridade, pontuacao_cursos_aperfeicoamento,
    pontuacao_experiencia_profissional, pontuacao_criterio_etnico, experiencia_saude_indigena_total,
    experiencia_atencao_basica_total, analise, ativo, id_origem, data_nascimento, nota_empregare,
    pcd, origem_planilha, chave_natural, "CO_AREA", "CO_PLANILHA")
  select v_grupo, c_unidade, c_edital, c.vaga, v.cargo, c.nome, null,
         v.nivel, c.modalidade, 'Aprovado', 'Análise concluída', 'Treinamento', v_hoje - 14,
         c.nota, round(c.nota * 0.3, 2), round(c.nota * 0.1, 2), round(c.nota * 0.4, 2),
         case when c.indigena then 14 else 0 end, (c.n % 5) * 6, (c.n % 4) * 9,
         'Análise fictícia do edital de treinamento.', true, c.codigo, c.nascimento, round(c.nota * 0.9, 2),
         'Não', c_origem, c_origem || '|' || v_area || '|' || c.codigo, v_area, v_planilha
    from tmp_treino_candidato c
    join tmp_treino_vaga v on v.vaga = c.vaga
   where c.nota is not null
  on conflict (chave_natural) do nothing;

  -- Roteiro de exemplo, com os aspectos (id fixo por área: o reinício reaproveita). É a
  -- versão seguinte do roteiro de exemplo sem aspectos, quando ele já existe.
  v_roteiro := md5('agsus-treinamento-roteiro-aspectos-' || v_area)::uuid;
  if not exists (select 1 from public."TB_ROTEIRO_ENTREVISTA" r where r."CO_ROTEIRO" = v_roteiro) then
    v_origem_roteiro := md5('agsus-treinamento-roteiro-' || v_area)::uuid;
    if not exists (select 1 from public."TB_ROTEIRO_ENTREVISTA" r where r."CO_ROTEIRO_ORIGEM" = v_origem_roteiro) then
      v_origem_roteiro := v_roteiro;
    end if;
    update public."TB_ROTEIRO_ENTREVISTA" set "ST_ATIVO" = 'N'
     where "CO_ROTEIRO_ORIGEM" = v_origem_roteiro and "ST_ATIVO" = 'S';
    insert into public."TB_ROTEIRO_ENTREVISTA" ("CO_ROTEIRO", "CO_ROTEIRO_ORIGEM", "NU_VERSAO", "CO_AREA", "NO_ROTEIRO",
      "DS_DESCRICAO", "NO_ETAPA", "TP_ESCALA", "VL_PASSO", "DS_NOTAS_PERMITIDAS", "VL_NOTA_MINIMA_TOTAL",
      "DS_NOTAS_ELIMINATORIAS", "ST_AUSENCIA_ELIMINA", "DS_DESEMPATE", "ST_SOMA_ANALISE",
      "DS_CONVOCACAO_PADRAO", "DS_BANCA_PADRAO", "ST_ATIVO")
    values (v_roteiro, v_origem_roteiro,
      (select coalesce(max(r."NU_VERSAO"), 0) + 1 from public."TB_ROTEIRO_ENTREVISTA" r where r."CO_ROTEIRO_ORIGEM" = v_origem_roteiro),
      v_area, 'Treinamento — Entrevista individual (exemplo)',
      'Roteiro de exemplo do edital de treinamento: 4 competências; cada avaliador dá de 0 a 5 em 3 aspectos (Conceitua, Propriedade, Profundidade) e a nota dele é a média; apto com 8 pontos e 2 em cada competência (abaixo de 2 elimina).',
      'Entrevista Individual', 'NIVEIS', 1, '[]'::jsonb, 8, '[]'::jsonb, 'S',
      '["Idade igual ou superior a 60 anos (Estatuto da Pessoa Idosa)", "Maior pontuação na Avaliação Documental e de Títulos", "Maior pontuação na Entrevista"]'::jsonb,
      'S', '{"multiplo_imediatas": 3, "posicao_cadastro_reserva": 5}'::jsonb,
      '[{"origem": "AgSUS", "quantidade": 1}, {"origem": "DSEI", "quantidade": 1}]'::jsonb, 'S');
    insert into public."TB_ROTEIRO_COMPETENCIA" ("CO_ROTEIRO", "NU_ORDEM", "NO_COMPETENCIA", "DS_DESCRICAO", "VL_NOTA_MAXIMA", "VL_PESO", "VL_MINIMO")
    values (v_roteiro, 1, 'Comunicação e escuta', 'Expressa-se com clareza e escuta o outro.', 5, 1, 2),
           (v_roteiro, 2, 'Trabalho em equipe', 'Colabora e compartilha responsabilidades.', 5, 1, 2),
           (v_roteiro, 3, 'Respeito à diversidade cultural', 'Reconhece e respeita os modos de vida dos povos indígenas.', 5, 1, 2),
           (v_roteiro, 4, 'Conhecimento da função', 'Conhece as atribuições do cargo no território.', 5, 1, 2);
    insert into public."TB_ROTEIRO_NIVEL" ("CO_ROTEIRO", "VL_NOTA", "NO_NIVEL", "DS_DESCRICAO")
    values (v_roteiro, 0, 'Não demonstrou', null), (v_roteiro, 1, 'Insuficiente', null),
           (v_roteiro, 2, 'Básico', null), (v_roteiro, 3, 'Adequado', null),
           (v_roteiro, 4, 'Bom', null), (v_roteiro, 5, 'Excelente', null);
    insert into public."TB_ROTEIRO_ASPECTO" ("CO_ROTEIRO", "NU_ORDEM", "NO_ASPECTO")
    values (v_roteiro, 1, 'Conceitua'), (v_roteiro, 2, 'Propriedade'), (v_roteiro, 3, 'Profundidade');
  end if;

  -- Entrevista configurada (roteiro, banca, vagas imediatas e avaliadores fictícios).
  if not exists (select 1 from public."TB_ENTREVISTA_EDITAL" e where e."CO_MONITORAMENTO" = v_id) then
    insert into public."TB_ENTREVISTA_EDITAL" ("CO_MONITORAMENTO", "CO_ROTEIRO", "DS_CONVOCACAO", "DS_BANCA", "TP_LANCAMENTO", "CO_USUARIO_ATUALIZACAO")
    values (v_id, v_roteiro, '{}'::jsonb,
            '[{"origem": "AgSUS", "quantidade": 1}, {"origem": "DSEI", "quantidade": 1}]'::jsonb, 'SECRETARIA', v_uid);
  end if;
  insert into public."TB_ENTREVISTA_VAGA" ("CO_MONITORAMENTO", "CO_VAGA", "QT_VAGA_IMEDIATA")
  select v_id, t.vaga, t.imediatas from tmp_treino_vaga t
   where not exists (select 1 from public."TB_ENTREVISTA_VAGA" x where x."CO_MONITORAMENTO" = v_id and x."CO_VAGA" = t.vaga);
  if not exists (select 1 from public."TB_ENTREVISTA_AVALIADOR" b where b."CO_MONITORAMENTO" = v_id) then
    insert into public."TB_ENTREVISTA_AVALIADOR" ("CO_MONITORAMENTO", "NO_AVALIADOR", "NO_ORIGEM", "NU_BANCA")
    values (v_id, 'Avaliador Teste 1', 'AgSUS', 1), (v_id, 'Avaliador Teste 2', 'DSEI', 1);
  end if;
  -- Exemplo de avaliador por competência: o Avaliador Teste 2 (DSEI) avalia só "Trabalho em equipe"
  -- (também na banca criada antes do avaliador por competência, enquanto ele não deu nota).
  insert into public."TB_ENTREVISTA_AVALIADOR_COMPETENCIA" ("CO_AVALIADOR", "CO_COMPETENCIA", "CO_USUARIO_CRIACAO")
  select b."CO_AVALIADOR", k."CO_COMPETENCIA", v_uid
    from public."TB_ENTREVISTA_AVALIADOR" b
    join public."TB_ENTREVISTA_EDITAL" e on e."CO_MONITORAMENTO" = b."CO_MONITORAMENTO"
    join public."TB_ROTEIRO_COMPETENCIA" k on k."CO_ROTEIRO" = e."CO_ROTEIRO" and k."NO_COMPETENCIA" = 'Trabalho em equipe'
   where b."CO_MONITORAMENTO" = v_id and b."NO_AVALIADOR" = 'Avaliador Teste 2'
     and not exists (select 1 from public."TB_ENTREVISTA_AVALIADOR_COMPETENCIA" l where l."CO_AVALIADOR" = b."CO_AVALIADOR")
     and not exists (select 1 from public."TB_ENTREVISTA_AVALIACAO" a where a."CO_AVALIADOR" = b."CO_AVALIADOR");

  -- Regra da classificação (formato de src/lib/classificacao/regra.js) e a lista de convocação.
  select r."CO_REGRA_CLASSIFICACAO" into v_regra_classif
    from public."TB_REGRA_CLASSIFICACAO" r where r."CO_MONITORAMENTO" = v_id;
  if v_regra_classif is null then
    v_config_classif := jsonb_build_object(
      'schema', 1,
      'data_corte', to_char(v_hoje - 30, 'YYYY-MM-DD'),
      'etapas', jsonb_build_object('documental', true, 'entrevista', true),
      'documental', jsonb_build_object('situacoes_aptas', jsonb_build_array('Aprovado'), 'nota_minima', null,
                                       'nota_minima_por_nivel', '{}'::jsonb, 'niveis_por_cargo', '[]'::jsonb,
                                       'nivel_padrao', null, 'parciais', '[]'::jsonb),
      'entrevista', jsonb_build_object('nota_minima', 8, 'nota_minima_competencia', 2, 'nota_eliminatoria_ate', 0,
                                       'competencias', '[]'::jsonb, 'exige_comparecimento', true,
                                       'inapto_elimina', true, 'so_parecer', false),
      'composicao', jsonb_build_object('componentes', jsonb_build_array(
                                         jsonb_build_object('codigo', 'DOCUMENTAL', 'peso', 1),
                                         jsonb_build_object('codigo', 'ENTREVISTA', 'peso', 1)),
                                       'casas', 2, 'arredondamento', 'MEIO_PARA_CIMA'),
      'desempate', '[]'::jsonb,
      'listas', jsonb_build_object('PRELIMINAR', jsonb_build_object('empate', 'MESMA_POSICAO'),
                                   'ENTREVISTA', jsonb_build_object('empate', 'MESMA_POSICAO'),
                                   'FINAL', jsonb_build_object('empate', 'CRITERIOS')),
      'empate_final', jsonb_build_object('metodo', 'MESMA_POSICAO', 'numeracao', 'DENSA'),
      'modalidades', jsonb_build_array(jsonb_build_object(
                       'codigo', 'AC', 'nome', 'Ampla concorrência', 'percentual', null,
                       'arredondamento', 'MEIO_PARA_CIMA', 'lista_propria', false, 'recomeca_posicao', true,
                       'aparece_na_geral', true, 'remanejar_para', '[]'::jsonb, 'agrupa', '[]'::jsonb)),
      'cotas', jsonb_build_object('minimo_vagas_reserva', 0, 'acumulo', 'TODAS'),
      'convocacao', jsonb_build_object('multiplo_vagas', 3, 'posicao_max_cr', 5, 'incluir_empatados', true,
                                       'excecoes', '[]'::jsonb),
      'rodape', 'TREINAMENTO — sem valor oficial.',
      'documento', jsonb_build_object('edital', 'TREINAMENTO ' || c_numero, 'unidade', c_unidade));
    perform private."FC_VALIDAR_REGRA_CLASSIFICACAO"(v_config_classif);
    insert into public."TB_REGRA_CLASSIFICACAO" ("CO_MONITORAMENTO", "NU_VERSAO_VIGENTE", "CO_USUARIO_ATUALIZACAO")
    values (v_id, 1, v_uid) returning "CO_REGRA_CLASSIFICACAO" into v_regra_classif;
    insert into public."TH_REGRA_CLASSIFICACAO" ("CO_REGRA_CLASSIFICACAO", "NU_VERSAO", "DS_CONFIGURACAO", "TP_EMPATE_FINAL", "DS_MOTIVO", "CO_USUARIO")
    values (v_regra_classif, 1, v_config_classif, 'MESMA_POSICAO', 'Edital de treinamento', v_uid);
  end if;

  if not exists (select 1 from public."TB_LISTA_CLASSIFICACAO" l where l."CO_MONITORAMENTO" = v_id and l."TP_LISTA" = 'CONVOCACAO') then
    with ordenados as (
      select a.id, a.candidato, a.nota_final_ajustada as nota, a.codigo_vaga,
             rank() over (partition by a.codigo_vaga order by a.nota_final_ajustada desc) as posicao
        from public."TB_ANALISE_CURRICULAR" a
       where a."CO_AREA" = v_area and a.ativo and private."FC_ANALISE_EH_TREINAMENTO"(a.origem_planilha)
         and private."FC_NUMERO_EDITAL"(a.edital) = c_numero
    ),
    vagas as (
      select t.ordem, jsonb_build_object(
               'codigo', t.vaga, 'chave', t.vaga, 'cargo', t.cargo, 'lotacao', c_unidade,
               'cabecalho', 'Vaga ' || t.vaga || ' — ' || t.cargo || ' — ' || c_unidade,
               'total', t.imediatas, 'cadastro_reserva', t.cr, 'origem_das_vagas', 'QUADRO',
               'limite_convocacao', null,
               'geral', coalesce((select jsonb_agg(jsonb_build_object(
                          'analise_id', o.id, 'nome', o.candidato, 'posicao', o.posicao, 'nota', o.nota,
                          'modalidades', '[]'::jsonb, 'situacao', 'Classificado') order by o.posicao, o.candidato)
                          from ordenados o where o.codigo_vaga = t.vaga), '[]'::jsonb),
               'listas', '{}'::jsonb, 'eliminados', '[]'::jsonb) as vaga
        from tmp_treino_vaga t
    )
    select jsonb_build_object(
             'schema', 1, 'tipo', 'CONVOCACAO', 'casas', 2, 'avisos', '[]'::jsonb, 'pendencias', '[]'::jsonb,
             'edital', jsonb_build_object('id', v_id, 'edital', c_edital, 'unidade', c_unidade, 'treinamento', true),
             'rodape', 'TREINAMENTO — sem valor oficial.', 'data_corte', to_char(v_hoje - 30, 'YYYY-MM-DD'),
             'modalidades', '[]'::jsonb, 'empate_final', 'MESMA_POSICAO', 'regra_versao', 1,
             'totais', jsonb_build_object('vagas', (select sum(t.imediatas) from tmp_treino_vaga t),
                                          'avisos', 0, 'elegiveis', (select count(*) from ordenados),
                                          'candidatos', (select count(*) from ordenados), 'eliminados', 0, 'pendencias', 0),
             'vagas', (select jsonb_agg(v.vaga order by v.ordem) from vagas v))
      into v_resultado;
    insert into public."TB_LISTA_CLASSIFICACAO" ("CO_MONITORAMENTO", "TP_LISTA", "CO_REGRA_CLASSIFICACAO", "NU_VERSAO_REGRA",
      "DS_RESULTADO", "DS_HASH", "QT_ELEGIVEL", "CO_USUARIO")
    values (v_id, 'CONVOCACAO', v_regra_classif, 1, v_resultado,
            encode(sha256(convert_to(v_resultado::text, 'UTF8')), 'hex'),
            (v_resultado #>> '{totais,elegiveis}')::integer, v_uid);
  end if;

  -- Avaliação documental: inscrições e questionários no formato da exportação da Empregare,
  -- com os enunciados do questionário NERSSI da Saúde Indígena (o do Edital 101/2026; nos
  -- níveis superior e técnico, as perguntas de escolaridade e formação do mesmo jeito).
  v_enun_fund := array[
       $q$Nome completo:(conforme registrado em documento, sem abreviações)$q$,
       $q$Número do CPF:(vinculado ao nome informado acima)Ex: 000.000.000-00$q$,
       $q$Data de nascimento (dd/mm/aaaa):dd/mm/aaaa = dia/mês/ano$q$,
       $q$Anexe um documento de identificação com foto ( frente e verso).Conforme orientação do item 6,4, alínea "c", do Edital.$q$,
       $q$Indique em qual sistema de concorrência deseja se inscrever:$q$,
       $q$Você é indígena e mora em aldeia?(será necessária a comprovação)Ser Indígena: 8 pontosResidir em Aldeia: 6 pontosMáximo: 14 pontos$q$,
       $q$Anexe sua identificação e/ou Declaração de Pertencimento Étnico e/ou de moradia em aldeia:(Obrigatório o envio de identificação étnica, conforme item 6.4 do edital, alínea "h")(Para resid$q$,
       $q$Candidatos(as) que optaram por concorrer às vagas destinadas a Pretos e Pardos:Anexe, neste campo, a autodeclaração conforme o modelo constante no Anexo IX.Importante: Candidatos(as) que $q$,
       $q$Candidatos(as) que optaram por concorrer às vagas destinadas a Pretos e Pardos, grave um vídeo, em fundo branco, com duração máxima de 20 segundos, apresentando o seu nome completo e a co$q$,
       $q$Candidatos(as) que optaram por concorrer às vagas destinadas a Pretos e Pardos, anexe uma foto de frente e uma foto de perfil, reunidas em um único arquivo, preferencialmente no formato $q$,
       $q$Candidatos(as) que optaram por concorrer às vagas destinadas a Quilombolas:Anexe, neste campo, a autodeclaração, conforme o modelo constante no Anexo XI e as orientações descritas no ite$q$,
       $q$Candidatos(as) que concorrem às vagas destinadas a PCD devem anexar aqui o laudo médico, devidamente assinado por médico(a) com registro ativo no CRM, conforme descrito no item 4 do Edit$q$,
       $q$Você possui nível fundamental completo ?(será necessária a comprovação)$q$,
       $q$Anexe certificado ou histórico escolar de conclusão de nível fundamental:(frente e verso de acordo com o item 8.12.2 do Edital)Se desejar unir as páginas em arquivo único, favor acessar $q$,
       $q$Você possui ensino médio completo ?(será necessária a comprovação)$q$,
       $q$Anexe o certificado de conclusão de nível médio.(frente e verso, de acordo com o item 8.12.2 do Edital)Se desejar unir as páginas em arquivo único, favor acessar o site: Unir PDF.$q$,
       $q$Selecione sua Experiência Profissional na área/vaga em que concorre:(0,2 ponto por mês)&nbsp;Pontuação máxima: 10 pontos.Conforme o item 8.15.2.1 do Edital,para candidatos indígenas, ind$q$,
       $q$Anexe o comprovante de Experiência Profissional na vaga em que concorre:Serão aceitos comprovante de acordo com o item 8.15 do edital e suas respectivas alíneas e subitens.&nbsp;Se preci$q$,
       $q$Você possui cônjuge, companheiro(a), parentes até o terceiro grau ou qualquer conhecido que integre o quadro de trabalhadores da AgSUS?$q$,
       $q$Se respondeu SIM na pergunta anterior, por gentileza informe o nome do trabalhador da AgSUS.$q$,
       $q$Você está com contrato de trabalho ativo na AgSUS ou foi desligado nos últimos 6 meses?$q$,
       $q$Você possui interesse em atuar em outros DSEI?$q$,
       $q$TERMO DE RESPONSABILIDADE PELAS INFORMAÇÕES DECLARADASDeclaro que todas as informações prestadas neste Formulário de Inscrição são verdadeiras e correspondem aos documentos comprobatório$q$,
       $q$Declaro estar ciente de que meus dados pessoais poderão ser coletados, tratados e compartilhados com órgãos competentes, exclusivamente para fins de participação em processos seletivos e$q$];
  v_enun_sup := v_enun_fund[1:12] || array[
    'Você possui graduação na área da vaga ?(será necessária a comprovação)',
    'Anexe o diploma de graduação na área da vaga:(frente e verso de acordo com o item 8.12.2 do Edital)',
    'Qual sua titulação acadêmica na área da vaga ?(será necessária a comprovação)Especialização: 1 pontoMestrado ou Residência: 2 pontosDoutorado: 3 pontos',
    'Anexe os comprovantes de titulação acadêmica.(frente e verso, de acordo com o item 8.12.2 do Edital)'] || v_enun_fund[17:];
  v_enun_tec := v_enun_fund[1:12] || array[
    'Você possui curso técnico na área da vaga ?(será necessária a comprovação)',
    'Anexe o certificado do curso técnico na área da vaga:(frente e verso de acordo com o item 8.12.2 do Edital)',
    'Você possui especialização técnica ou graduação na área da vaga ?(será necessária a comprovação)Especialização técnica: 2 pontosGraduação: 4 pontos',
    'Anexe o certificado de especialização técnica ou o diploma de graduação.(frente e verso, de acordo com o item 8.12.2 do Edital)'] || v_enun_fund[17:];

  -- Código de vaga fictícia já usado por vaga real ou carregada pelo robô: recusa sem mexer.
  if exists (select 1 from public."TB_EMPREGARE_VAGA" v join tmp_treino_vaga t on t.vaga = v."CO_VAGA"
              where v."CO_MONITORAMENTO" is distinct from v_id or v."CO_SYNC" is not null) then
    raise exception 'Vaga fictícia do treinamento já existe fora dele (ou veio do robô da Empregare): nada foi feito' using errcode = '23514';
  end if;

  insert into public."TB_EMPREGARE_VAGA" ("CO_VAGA", "CO_MONITORAMENTO", "TP_SITUACAO", "DS_COLUNA", "NO_ARQUIVO",
    "QT_CANDIDATO_ATIVO", "QT_LINHA_ARQUIVO", "QT_RECEBIDA", "DS_MENSAGEM", "DT_ULTIMA_CARGA")
  select t.vaga, v_id, 'GRAVADA',
         private."FC_TREINO_COLUNAS"('NÍVEL ' || upper(t.nivel) || ' - DSEI TREINAMENTO',
           case t.nivel when 'Superior' then v_enun_sup when 'Técnico' then v_enun_tec else v_enun_fund end, false),
         'treinamento-' || t.vaga || '.xlsx',
         (select count(*) from tmp_treino_candidato c where c.vaga = t.vaga),
         (select count(*) from tmp_treino_candidato c where c.vaga = t.vaga),
         (select count(*) from tmp_treino_candidato c where c.vaga = t.vaga),
         'Carga fictícia do edital de treinamento.', now()
    from tmp_treino_vaga t
  on conflict ("CO_VAGA") do update set
    "DS_COLUNA" = excluded."DS_COLUNA", "QT_CANDIDATO_ATIVO" = excluded."QT_CANDIDATO_ATIVO",
    "QT_LINHA_ARQUIVO" = excluded."QT_LINHA_ARQUIVO", "QT_RECEBIDA" = excluded."QT_RECEBIDA"
   where public."TB_EMPREGARE_VAGA"."CO_MONITORAMENTO" = v_id and public."TB_EMPREGARE_VAGA"."CO_SYNC" is null;

  -- As respostas batem com as perguntas da regra (SI26-PARINTINS, abaixo); a ART
  -- ("x,x/30,0") é a soma declarada: étnico (8 + 6) + formação + 0,2 por mês de experiência.
  -- Questionário pendente: sem respostas nem ART (cai na eliminação automática).
  insert into public."TB_EMPREGARE_CANDIDATO" ("CO_VAGA", "DS_CHAVE_CANDIDATO", "TP_CHAVE", "CO_CANDIDATO_EMPREGARE",
    "NO_CANDIDATO", "DS_EMAIL", "NU_CPF", "NU_TELEFONE", "DT_NASCIMENTO", "DS_SITUACAO_EMPREGARE", "DT_CANDIDATURA",
    "DS_COLUNA_ORIGINAL", "DS_HASH_LINHA")
  select x.vaga, 'cod:' || x.codigo, 'CODIGO', x.codigo, x.nome, x.email, null, '(00) 00000-0000', x.nascimento,
         case when x.situacao = 'CANCELADO' then 'Cancelado' else 'Inscrito' end,
         x.candidatura::timestamp at time zone 'America/Sao_Paulo', x.original,
         encode(sha256(convert_to(x.original::text, 'UTF8')), 'hex')
    from (
      select c.*, r.candidatura,
             private."FC_TREINO_INSCRICAO"('NÍVEL ' || upper(t.nivel) || ' - DSEI TREINAMENTO',
               case t.nivel when 'Superior' then v_enun_sup when 'Técnico' then v_enun_tec else v_enun_fund end, false,
               jsonb_build_object(
                 'codigo', c.codigo, 'nome', c.nome, 'email', c.email, 'nascimento', c.nascimento,
                 'candidatura', r.candidatura, 'uf', 'DF', 'situacao', c.situacao,
                 'quest', c.quest,
                 'art', case when r.respondeu
                             then replace(to_char(c.etnico + c.formacao + least(10, c.meses * 0.2), 'FM990.0'), '.', ',') || '/30,0'
                             else '--' end,
                 'modal', c.modal,
                 'etnico', case when not r.respondeu then '--'
                                when c.etnico = 14 then '"Sou indígena", "Moro em aldeia"'
                                when c.etnico = 8 then '"Sou indígena"' else '"Não se aplica"' end,
                 'escol', case when r.respondeu then '"Sim"' else '--' end,
                 'especial', case when not r.respondeu then '--'
                               when t.nivel = 'Superior' then case c.formacao when 2 then '"Mestrado ou Residência"' when 1 then '"Especialização"' else '"Não possuo"' end
                               when t.nivel = 'Técnico' then case c.formacao when 4 then '"Graduação na área"' when 2 then '"Especialização técnica na área"' else '"Não possuo"' end
                               else case c.formacao when 6 then '"Certificado de conclusão de nível médio porinstituição reconhecida pelo MEC"' else '"Não possuo"' end
                             end,
                 'exp', case when not r.respondeu then '--'
                             when c.meses = 0 then '"Não possuo"'
                             when c.meses < 12 then '"' || c.meses || ' meses"'
                             when c.meses % 12 = 0 then '"' || (c.meses / 12) || case when c.meses = 12 then ' ano"' else ' anos"' end
                             else '"' || (c.meses / 12) || case when c.meses < 24 then ' ano e ' else ' anos e ' end
                                  || (c.meses % 12) || case when c.meses % 12 = 1 then ' mês"' else ' meses"' end
                        end,
                 'conjuge', '"Não"', 'contrato', '"Não"',
                 'termo', '"Declaro que li, compreendi e concordo com as condições acima.&nbsp;"', 'declaro', '"Sim"',
                 'reprovado', c.reprovado,
                 'marcadores', case when c.reprovado = 'SIM' then 'Reprovado' else 'Nenhum Marcador' end,
                 'nivel_formacao', t.nivel, 'curso_formacao', t.cargo)) as original
        from tmp_treino_candidato c
        join tmp_treino_vaga t on t.vaga = c.vaga
       cross join lateral (
         select v_hoje - 40 + (c.n % 10) as candidatura,
                c.quest in ('FINALIZADO', 'EM ANDAMENTO') as respondeu
       ) r
    ) x
  on conflict ("CO_VAGA", "DS_CHAVE_CANDIDATO") do update set
    "NO_CANDIDATO" = excluded."NO_CANDIDATO", "DS_EMAIL" = excluded."DS_EMAIL", "DT_NASCIMENTO" = excluded."DT_NASCIMENTO",
    "DS_SITUACAO_EMPREGARE" = excluded."DS_SITUACAO_EMPREGARE",
    "DS_COLUNA_ORIGINAL" = excluded."DS_COLUNA_ORIGINAL", "DS_HASH_LINHA" = excluded."DS_HASH_LINHA"
   where public."TB_EMPREGARE_CANDIDATO"."CO_SYNC" is null
     and exists (select 1 from public."TB_EMPREGARE_VAGA" v
                  where v."CO_VAGA" = public."TB_EMPREGARE_CANDIDATO"."CO_VAGA" and v."CO_MONITORAMENTO" = v_id and v."CO_SYNC" is null)
     and not exists (select 1 from public."TB_PRE_CLASSIFICACAO" p
                      where p."CO_EMPREGARE_CANDIDATO" = public."TB_EMPREGARE_CANDIDATO"."CO_EMPREGARE_CANDIDATO");

  -- A avaliação documental do edital é feita no MONITORA.
  insert into public."TB_ORIGEM_ANALISE_EDITAL" ("CO_MONITORAMENTO", "TP_ORIGEM")
  values (v_id, 'MONITORA')
  on conflict ("CO_MONITORAMENTO") do nothing;

  -- Regra da avaliação documental: a do Edital 111/2026 (DSEI Parintins, modelo
  -- SI26-PARINTINS, o edital SI mais recente com o modelo do próprio PDF), com as perguntas
  -- do questionário NERSSI ligadas aos blocos, CONFERIDA e com nome de versão.
  select * into v_modelo
    from public."TB_REGRA_ANALISE_MODELO" m
   where m."CO_MODELO" = 'SI26-PARINTINS' and m."ST_ATIVO" = 'S';
  if v_modelo."CO_MODELO" is not null then
    v_perguntas := jsonb_build_object(
      'IDENTIDADE', jsonb_build_array('Anexe um documento de identificação com foto'),
      'MODALIDADE', jsonb_build_array('Indique em qual sistema de concorrência'),
      'ESCOLARIDADE', jsonb_build_array('Você possui nível fundamental completo', 'Anexe certificado ou histórico escolar de conclusão de nível fundamental',
                                        'Você possui curso técnico na área da vaga', 'Anexe o certificado do curso técnico na área da vaga',
                                        'Você possui graduação na área da vaga', 'Anexe o diploma de graduação na área da vaga'),
      'ETNICO', jsonb_build_array('Você é indígena e mora em aldeia', 'Anexe sua identificação e/ou Declaração de Pertencimento Étnico'),
      'COTA_PP', jsonb_build_array('Candidatos(as) que optaram por concorrer às vagas destinadas a Pretos e Pardos'),
      'COTA_PI', jsonb_build_array('Anexe sua identificação e/ou Declaração de Pertencimento Étnico'),
      'COTA_PQ', jsonb_build_array('Candidatos(as) que optaram por concorrer às vagas destinadas a Quilombolas'),
      'COTA_PCD', jsonb_build_array('Candidatos(as) que concorrem às vagas destinadas a PCD'),
      'FORMACAO', jsonb_build_array('Você possui ensino médio completo', 'Anexe o certificado de conclusão de nível médio',
                                    'Você possui especialização técnica ou graduação na área da vaga', 'Anexe o certificado de especialização técnica ou o diploma de graduação',
                                    'Qual sua titulação acadêmica na área da vaga', 'Anexe os comprovantes de titulação acadêmica'),
      'EXPERIENCIA', jsonb_build_array('Selecione sua Experiência Profissional na área/vaga em que concorre', 'Anexe o comprovante de Experiência Profissional'));
    v_config_analise := jsonb_set(v_modelo."DS_CONFIGURACAO", '{blocos}', coalesce((
        select jsonb_agg(b.bloco || case when v_perguntas ? (b.bloco ->> 'codigo')
                                         then jsonb_build_object('perguntas', v_perguntas -> (b.bloco ->> 'codigo'))
                                         else '{}'::jsonb end order by b.ordem)
          from jsonb_array_elements(v_modelo."DS_CONFIGURACAO" -> 'blocos') with ordinality b(bloco, ordem)), '[]'::jsonb))
      || jsonb_build_object('modelo', v_modelo."CO_MODELO", 'edital_rotulo', 'Edital ' || c_numero || ' (TREINAMENTO)');
    perform private."FC_REGRA_DO_TREINAMENTO"(v_id, v_config_analise, 'CONFERIDA',
      'Edital de treinamento: regra do Edital 111/2026 (modelo SI26-PARINTINS) com as perguntas do questionário NERSSI', v_uid);
    -- A regra preparada antes (em Conferir, ainda sem pré-classificação) fica conferida.
    update public."TB_REGRA_ANALISE" set
      "TP_SITUACAO" = 'CONFERIDA', "CO_USUARIO_CONFERENCIA" = v_uid, "DT_CONFERENCIA" = now(), "DT_ATUALIZACAO" = now()
     where "CO_MONITORAMENTO" = v_id and "TP_SITUACAO" <> 'CONFERIDA' and "CO_MODELO_ORIGEM" = v_modelo."CO_MODELO"
       and private."FC_EDITAL_EH_TREINAMENTO"(v_id)
       and not exists (select 1 from public."TB_PRE_CLASSIFICACAO" p where p."CO_MONITORAMENTO" = v_id);
    -- O nome da versão vigente (só o NO_VERSAO: configuração e hash ficam).
    update public."TH_REGRA_ANALISE" h set "NO_VERSAO" = c_nome_regra
      from public."TB_REGRA_ANALISE" r
     where h."CO_REGRA_ANALISE" = r."CO_REGRA_ANALISE" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
       and r."CO_MONITORAMENTO" = v_id and h."NO_VERSAO" is null
       and h."DS_CONFIGURACAO" ->> 'modelo' = v_modelo."CO_MODELO";
    -- A pré-classificação pronta (o resultado do Python) e as fichas PENDENTE do lote.
    perform private."FC_PRE_CLASSIFICAR_TREINAMENTO"(v_id, c_pre);
  end if;

  return v_id;
end;
$$;
comment on function private."FC_PREPARAR_TREINAMENTO_SI"(text, text) is
  'Edital de treinamento da Saúde Indígena ("Treinamento – Saúde Indígena (991/2099)", unidade "DSEI Treinamento"): cronograma relativo a hoje (janela de entrevista aberta), quadro, 30 candidatos fictícios (os 15 primeiros com análise aprovada, lista de convocação e entrevista; os 30 com inscrição e questionário NERSSI no formato da Empregare, com cotas, cancelado, pendente, reprovado e empate), roteiro de exemplo com aspectos, banca com o Avaliador Teste 2 (DSEI) avaliando só "Trabalho em equipe", regra da classificação e a regra da avaliação documental do Edital 111/2026 (SI26-PARINTINS) CONFERIDA e nomeada, com a pré-classificação gravada (resultado do Python) e as fichas PENDENTE do lote. Chamada só por private."FC_PREPARAR_EDITAL_TREINAMENTO".';
revoke all on function private."FC_PREPARAR_TREINAMENTO_SI"(text, text) from public, anon, authenticated;
grant execute on function private."FC_PREPARAR_TREINAMENTO_SI"(text, text) to service_role;

-- ── 2. Projetos: entrevista pronta ───────────────────────────────────────────
create or replace function private."FC_PREPARAR_ENTREVISTA_TREINAMENTO_PROJETOS"(p_edital uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  c_numero constant text := '992/2099';
  c_edital constant text := 'Treinamento – Projetos (992/2099)';
  c_unidade constant text := 'Escritório Treinamento';
  c_area constant text := 'projetos';
  c_banca constant jsonb := '[{"origem": "CDHO / AgSUS", "quantidade": 1}, {"origem": "SSO / AgSUS", "quantidade": 1}, {"origem": "CONDISI", "quantidade": 1}]';
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_uid uuid := coalesce((select auth.uid()), '00000000-0000-0000-0000-000000000000'::uuid);
  v_roteiro uuid := md5('agsus-treinamento-roteiro-' || c_area)::uuid;
  v_regra_classif uuid;
  v_versao_classif integer;
  v_resultado jsonb;
begin
  if not private."FC_EDITAL_EH_TREINAMENTO"(p_edital)
     or not exists (select 1 from public."TB_MONITORAMENTO_INDIGENA" m where m.id = p_edital and m."CO_AREA" = c_area) then
    raise exception 'Só o edital de treinamento de Projetos recebe a entrevista de exemplo' using errcode = '42501';
  end if;

  -- As vagas do 992/2099 (as do 93/2026, com códigos fictícios) e as imediatas.
  create temporary table if not exists tmp_treino_p_entrevista_vaga (
    vaga text primary key, ordem smallint, cargo text, imediatas integer
  ) on commit drop;
  truncate tmp_treino_p_entrevista_vaga;
  insert into tmp_treino_p_entrevista_vaga values
    ('990992001', 1, 'ANALISTA DE GESTÃO: MÉDICO DO TRABALHO (Nível Superior)', 2),
    ('990992002', 2, 'ANALISTA DE GESTÃO: ENFERMEIRO DO TRABALHO (Nível Superior)', 1),
    ('990992003', 3, 'ANALISTA DE GESTÃO: ENGENHARIA DO TRABALHO (Nível Superior)', 1),
    ('990992004', 4, 'TÉCNICO DE ENFERMAGEM DO TRABALHO', 1),
    ('990992005', 5, 'TÉCNICO DE SEGURANÇA DO TRABALHO (Nível Médio)', 6);

  -- Roteiro de exemplo (id fixo: o reinício reaproveita): cópia independente do modelo
  -- da área (Projetos — Análise Comportamental do SESMT, Edital 93/2026). Sem aspectos.
  if not exists (select 1 from public."TB_ROTEIRO_ENTREVISTA" r where r."CO_ROTEIRO" = v_roteiro) then
    insert into public."TB_ROTEIRO_ENTREVISTA" ("CO_ROTEIRO", "CO_ROTEIRO_ORIGEM", "NU_VERSAO", "CO_AREA", "NO_ROTEIRO",
      "DS_DESCRICAO", "NO_ETAPA", "TP_ESCALA", "VL_PASSO", "DS_NOTAS_PERMITIDAS", "VL_NOTA_MINIMA_TOTAL",
      "DS_NOTAS_ELIMINATORIAS", "ST_AUSENCIA_ELIMINA", "DS_DESEMPATE", "ST_SOMA_ANALISE",
      "DS_CONVOCACAO_PADRAO", "DS_BANCA_PADRAO", "ST_ATIVO", "NO_VERSAO")
    values (v_roteiro, v_roteiro, 1, c_area, 'Treinamento — Entrevista Projetos (exemplo)',
      'Roteiro de exemplo do edital de treinamento de Projetos, copiado do modelo do SESMT (Edital 93/2026): 4 competências de 0 a 2 (passo 0,5; intercultural e comportamental com peso 1,5), o estudo de caso é em grupo; apto com 5 pontos e 50% do máximo em cada competência.',
      'Análise Comportamental', 'FAIXA', 0.5, '[]'::jsonb, 5, '[]'::jsonb, 'S',
      '["Idade igual ou superior a 60 anos (Estatuto da Pessoa Idosa)", "Maior tempo de experiência profissional comprovado", "Maior idade"]'::jsonb,
      'S', '{"excecoes": [], "multiplo_imediatas": 5, "posicao_cadastro_reserva": 10}'::jsonb, c_banca, 'S',
      'Modelo SESMT do Edital 93/2026');
    insert into public."TB_ROTEIRO_COMPETENCIA" ("CO_ROTEIRO", "NU_ORDEM", "NO_COMPETENCIA", "DS_DESCRICAO",
      "VL_NOTA_MAXIMA", "VL_PESO", "VL_MINIMO", "TP_MINIMO", "TP_AVALIACAO")
    values
      (v_roteiro, 1, 'Habilidade técnica', 'Fundamentos de Saúde e Segurança do Trabalho, normas regulamentadoras, riscos ocupacionais, prevenção, investigação de acidentes e indicadores.', 2, 1, 50, 'PERCENTUAL', 'INDIVIDUAL'),
      (v_roteiro, 2, 'Habilidade intercultural', 'Atuar em contexto de saúde indígena, atenção diferenciada, SasiSUS e adaptação às características do território.', 2, 1.5, 50, 'PERCENTUAL', 'INDIVIDUAL'),
      (v_roteiro, 3, 'Habilidade comportamental', 'Comunicação, escuta ativa, trabalho em equipe, ética, tomada de decisão e equilíbrio emocional.', 2, 1.5, 50, 'PERCENTUAL', 'INDIVIDUAL'),
      (v_roteiro, 4, 'Habilidade situacional (estudo de caso)', 'Aplicar conhecimentos em situações concretas e coletivas; lidar com risco, conflitos e resistência às medidas de saúde e segurança.', 2, 1, 50, 'PERCENTUAL', 'GRUPO');
  end if;

  -- Entrevista configurada: lançamento "secretaria passa a limpo", vagas e banca do modelo.
  if not exists (select 1 from public."TB_ENTREVISTA_EDITAL" e where e."CO_MONITORAMENTO" = p_edital) then
    insert into public."TB_ENTREVISTA_EDITAL" ("CO_MONITORAMENTO", "CO_ROTEIRO", "DS_CONVOCACAO", "DS_BANCA", "TP_LANCAMENTO", "CO_USUARIO_ATUALIZACAO")
    values (p_edital, v_roteiro, '{}'::jsonb, c_banca, 'SECRETARIA', v_uid);
  end if;
  insert into public."TB_ENTREVISTA_VAGA" ("CO_MONITORAMENTO", "CO_VAGA", "QT_VAGA_IMEDIATA")
  select p_edital, t.vaga, t.imediatas from tmp_treino_p_entrevista_vaga t
   where not exists (select 1 from public."TB_ENTREVISTA_VAGA" x where x."CO_MONITORAMENTO" = p_edital and x."CO_VAGA" = t.vaga);
  if not exists (select 1 from public."TB_ENTREVISTA_AVALIADOR" b where b."CO_MONITORAMENTO" = p_edital) then
    insert into public."TB_ENTREVISTA_AVALIADOR" ("CO_MONITORAMENTO", "NO_AVALIADOR", "NO_ORIGEM", "NU_BANCA")
    values (p_edital, 'Avaliador Teste P1', 'CDHO / AgSUS', 1),
           (p_edital, 'Avaliador Teste P2', 'SSO / AgSUS', 1),
           (p_edital, 'Avaliador Teste P3', 'CONDISI', 1);
    -- Avaliador por competência: o Avaliador Teste P3 (CONDISI) avalia só "Habilidade intercultural".
    insert into public."TB_ENTREVISTA_AVALIADOR_COMPETENCIA" ("CO_AVALIADOR", "CO_COMPETENCIA", "CO_USUARIO_CRIACAO")
    select b."CO_AVALIADOR", k."CO_COMPETENCIA", v_uid
      from public."TB_ENTREVISTA_AVALIADOR" b
      join public."TB_ENTREVISTA_EDITAL" e on e."CO_MONITORAMENTO" = b."CO_MONITORAMENTO"
      join public."TB_ROTEIRO_COMPETENCIA" k on k."CO_ROTEIRO" = e."CO_ROTEIRO" and k."NO_COMPETENCIA" = 'Habilidade intercultural'
     where b."CO_MONITORAMENTO" = p_edital and b."NO_AVALIADOR" = 'Avaliador Teste P3';
  end if;

  -- A janela da entrevista (pelo cronograma do 93/2026) abre só depois da análise: o
  -- treino mostra as duas etapas juntas, com a liberação que o admin global daria.
  if not exists (select 1 from public."TB_ENTREVISTA_LIBERACAO" l
                  where l."CO_MONITORAMENTO" = p_edital and l."ST_REGISTRO_ATIVO" = 'S' and l."DT_LIBERADO_ATE" >= v_hoje) then
    update public."TB_ENTREVISTA_LIBERACAO" set "ST_REGISTRO_ATIVO" = 'N', "DT_DESATIVACAO" = now()
     where "CO_MONITORAMENTO" = p_edital and "ST_REGISTRO_ATIVO" = 'S';
    insert into public."TB_ENTREVISTA_LIBERACAO" ("CO_MONITORAMENTO", "DT_LIBERADO_ATE", "DS_MOTIVO", "CO_USUARIO")
    values (p_edital, v_hoje + 60,
            'Edital de treinamento: entrevistas liberadas para demonstrar junto com a avaliação documental.', (select auth.uid()));
  end if;

  -- A lista de convocação: os do lote da pré-classificação (com a análise fictícia "Pendente"),
  -- pela nota da pré-classificação, na regra da classificação copiada do 93/2026.
  select r."CO_REGRA_CLASSIFICACAO", r."NU_VERSAO_VIGENTE" into v_regra_classif, v_versao_classif
    from public."TB_REGRA_CLASSIFICACAO" r where r."CO_MONITORAMENTO" = p_edital;
  if v_regra_classif is not null
     and not exists (select 1 from public."TB_LISTA_CLASSIFICACAO" l where l."CO_MONITORAMENTO" = p_edital and l."TP_LISTA" = 'CONVOCACAO') then
    with ordenados as (
      select a.id, a.candidato, a.codigo_vaga, p."VL_NOTA_ORDEM" as nota, p."NU_POSICAO" as ordem,
             rank() over (partition by a.codigo_vaga order by p."VL_NOTA_ORDEM" desc) as posicao
        from public."TB_ANALISE_CURRICULAR" a
        join public."TB_EMPREGARE_CANDIDATO" c on c."CO_VAGA" = a.codigo_vaga and c."CO_CANDIDATO_EMPREGARE" = a.id_origem
        join public."TB_PRE_CLASSIFICACAO" p on p."CO_EMPREGARE_CANDIDATO" = c."CO_EMPREGARE_CANDIDATO" and p."CO_MONITORAMENTO" = p_edital
       where a."CO_AREA" = c_area and a.ativo and private."FC_ANALISE_EH_TREINAMENTO"(a.origem_planilha)
         and private."FC_NUMERO_EDITAL"(a.edital) = c_numero
         and p."TP_SITUACAO" in ('NO_LOTE', 'ANALISADO')
    ),
    vagas as (
      select t.ordem, jsonb_build_object(
               'codigo', t.vaga, 'chave', t.vaga, 'cargo', t.cargo, 'lotacao', c_unidade,
               'cabecalho', 'Vaga ' || t.vaga || ' — ' || t.cargo || ' — ' || c_unidade,
               'total', t.imediatas, 'cadastro_reserva', false, 'origem_das_vagas', 'QUADRO',
               'limite_convocacao', null,
               'geral', coalesce((select jsonb_agg(jsonb_build_object(
                          'analise_id', o.id, 'nome', o.candidato, 'posicao', o.posicao, 'nota', o.nota,
                          'modalidades', '[]'::jsonb, 'situacao', 'Classificado') order by o.posicao, o.ordem, o.candidato)
                          from ordenados o where o.codigo_vaga = t.vaga), '[]'::jsonb),
               'listas', '{}'::jsonb, 'eliminados', '[]'::jsonb) as vaga
        from tmp_treino_p_entrevista_vaga t
    )
    select jsonb_build_object(
             'schema', 1, 'tipo', 'CONVOCACAO', 'casas', 2, 'avisos', '[]'::jsonb, 'pendencias', '[]'::jsonb,
             'edital', jsonb_build_object('id', p_edital, 'edital', c_edital, 'unidade', c_unidade, 'treinamento', true),
             'rodape', 'TREINAMENTO — sem valor oficial.', 'data_corte', null,
             'modalidades', '[]'::jsonb, 'empate_final', 'MESMA_POSICAO', 'regra_versao', v_versao_classif,
             'totais', jsonb_build_object('vagas', (select sum(t.imediatas) from tmp_treino_p_entrevista_vaga t),
                                          'avisos', 0, 'elegiveis', (select count(*) from ordenados),
                                          'candidatos', (select count(*) from ordenados), 'eliminados', 0, 'pendencias', 0),
             'vagas', (select jsonb_agg(v.vaga order by v.ordem) from vagas v))
      into v_resultado;
    if (v_resultado #>> '{totais,elegiveis}')::integer > 0 then
      insert into public."TB_LISTA_CLASSIFICACAO" ("CO_MONITORAMENTO", "TP_LISTA", "CO_REGRA_CLASSIFICACAO", "NU_VERSAO_REGRA",
        "DS_RESULTADO", "DS_HASH", "QT_ELEGIVEL", "CO_USUARIO")
      values (p_edital, 'CONVOCACAO', v_regra_classif, v_versao_classif, v_resultado,
              encode(sha256(convert_to(v_resultado::text, 'UTF8')), 'hex'),
              (v_resultado #>> '{totais,elegiveis}')::integer, v_uid);
    end if;
  end if;
end;
$$;
comment on function private."FC_PREPARAR_ENTREVISTA_TREINAMENTO_PROJETOS"(uuid) is
  'Edital de treinamento de Projetos (992/2099): a entrevista de exemplo — roteiro "Treinamento — Entrevista Projetos (exemplo)" (cópia do modelo do SESMT do 93/2026, sem aspectos), configuração com lançamento pela secretaria, as 5 vagas, banca com 3 avaliadores fictícios (o Avaliador Teste P3 avalia só "Habilidade intercultural"), liberação da janela e a lista de convocação dos que estão no lote da pré-classificação. Idempotente; recusa edital real (42501). Chamada só por private."FC_PREPARAR_EDITAL_TREINAMENTO".';
revoke all on function private."FC_PREPARAR_ENTREVISTA_TREINAMENTO_PROJETOS"(uuid) from public, anon, authenticated;
grant execute on function private."FC_PREPARAR_ENTREVISTA_TREINAMENTO_PROJETOS"(uuid) to service_role;

-- ── 3. Nos dois: convocados e agenda a partir de hoje ───────────────────────
create or replace function private."FC_CONVOCAR_E_AGENDAR_TREINAMENTO"(p_edital uuid)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_uid uuid := coalesce((select auth.uid()), '00000000-0000-0000-0000-000000000000'::uuid);
  v_m public."TB_MONITORAMENTO_INDIGENA";
  v_roteiro uuid;
  v_lista uuid;
  v_regra uuid;
  v_dias date[];
  v_config jsonb;
  v_qt integer := 0;
begin
  if not private."FC_EDITAL_EH_TREINAMENTO"(p_edital) then
    raise exception 'Só o edital de treinamento é convocado e agendado por aqui' using errcode = '42501';
  end if;
  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" m where m.id = p_edital;
  select e."CO_ROTEIRO" into v_roteiro from public."TB_ENTREVISTA_EDITAL" e where e."CO_MONITORAMENTO" = p_edital;
  v_lista := private."FC_LISTA_CONVOCACAO_VIGENTE"(p_edital);
  if v_roteiro is null or v_lista is null then
    return 0;
  end if;

  -- Os convocados da lista viram entrevistas do sistema (como public.convocar_para_entrevista),
  -- na banca 1. Entrevistas já convocadas (talvez com notas do treino) ficam.
  if not exists (select 1 from public."TB_ENTREVISTA" e
                  where e."CO_MONITORAMENTO" = p_edital and e."TP_ORIGEM" = 'sistema') then
    insert into public."TB_ENTREVISTA" ("CO_AREA", "CO_MONITORAMENTO", "CO_ANALISE_CURRICULAR", "TP_LIGACAO_ANALISE",
      "NO_UNIDADE", "DS_EDITAL", "CO_VAGA", "NO_CANDIDATO", "CO_CANDIDATO", "DS_MODALIDADE", "NO_CARGO", "TP_PARECER",
      "TP_ORIGEM", "DS_CHAVE_ORIGEM", "CO_ROTEIRO", "ST_ATIVO", "NU_BANCA")
    select v_m."CO_AREA", p_edital, a.id, 'codigo', left(coalesce(v_m.unidade, ''), 200), left(v_m.edital, 120),
           left(a.codigo_vaga, 60), left(a.candidato, 200), left(a.id_origem, 60), left(a.modalidade_concorrencia, 300),
           left(a.nome_vaga, 400), 'SEM_PARECER', 'sistema', 'sistema|' || p_edital || '|' || a.id, v_roteiro, 'S', 1
      from private."FC_CONVOCADOS_DA_LISTA"(v_lista) c(analise)
      join public."TB_ANALISE_CURRICULAR" a on a.id = c.analise
     where a."CO_AREA" = v_m."CO_AREA" and a.ativo and private."FC_ANALISE_EH_TREINAMENTO"(a.origem_planilha)
       and private."FC_NUMERO_EDITAL"(a.edital) = private."FC_NUMERO_EDITAL"(v_m.edital)
    on conflict ("DS_CHAVE_ORIGEM") do nothing;
    get diagnostics v_qt = row_count;
    insert into public."TH_ENTREVISTA_AVALIACAO" ("CO_ENTREVISTA", "DS_CAMPO", "DS_VALOR_NOVO", "CO_USUARIO")
    select e."CO_ENTREVISTA", 'convocacao', 'convocado pela lista ' || v_lista || ' (edital de treinamento)', (select auth.uid())
      from public."TB_ENTREVISTA" e
     where e."CO_MONITORAMENTO" = p_edital and e."TP_ORIGEM" = 'sistema';
  end if;

  -- A regra da agenda: hoje e os dias úteis seguintes, 30 minutos, uma banca.
  select array_agg(d order by d) into v_dias
    from (select v_hoje as d
          union all
          (select g::date from generate_series(v_hoje + 1, v_hoje + 14, interval '1 day') g
            where extract(isodow from g) < 6 order by g limit 4)) x;
  select r."CO_REGRA_AGENDA" into v_regra from public."TB_REGRA_AGENDA_ENTREVISTA" r where r."CO_MONITORAMENTO" = p_edital;
  if v_regra is null then
    v_config := jsonb_build_object(
      'schema', 1,
      'datas', jsonb_build_object('modo', 'LISTA', 'inicio', '', 'fim', '', 'so_dias_uteis', true,
                                  'dias', (select jsonb_agg(to_char(d, 'YYYY-MM-DD') order by d) from unnest(v_dias) d),
                                  'excluir', '[]'::jsonb),
      'periodos', jsonb_build_array(jsonb_build_object('inicio', '08:00', 'fim', '12:00'),
                                    jsonb_build_object('inicio', '14:00', 'fim', '18:00')),
      'duracao_min', 30, 'intervalo_min', 0, 'pausa', null, 'bancas', 1,
      'nomes_das_bancas', jsonb_build_array('Banca 1'), 'ordem', 'VAGA',
      'agrupar_por_cargo', true, 'reservar_primeiro_horario', false, 'fuso', 'America/Sao_Paulo');
    perform private."FC_VALIDAR_REGRA_AGENDA"(v_config);
    insert into public."TB_REGRA_AGENDA_ENTREVISTA" ("CO_MONITORAMENTO", "NU_VERSAO_VIGENTE", "CO_USUARIO_ATUALIZACAO")
    values (p_edital, 1, (select auth.uid()))
    returning "CO_REGRA_AGENDA" into v_regra;
    insert into public."TH_REGRA_AGENDA_ENTREVISTA" ("CO_REGRA_AGENDA", "NU_VERSAO", "DS_CONFIGURACAO", "DS_MOTIVO", "CO_USUARIO")
    values (v_regra, 1, v_config, 'Edital de treinamento: agenda de exemplo a partir de hoje', (select auth.uid()));
  end if;

  -- A agenda: 6 entrevistas hoje (09:00 às 12:00) e as demais, 8 por dia, nos dias úteis seguintes.
  if not exists (select 1 from public."TB_AGENDA_ENTREVISTA" g where g."CO_MONITORAMENTO" = p_edital) then
    insert into public."TB_AGENDA_ENTREVISTA" ("CO_MONITORAMENTO", "CO_ANALISE_CURRICULAR", "DT_ENTREVISTA", "HR_INICIO",
      "HR_FIM", "NU_BANCA", "TP_ORIGEM", "NU_VERSAO_REGRA", "CO_LISTA_CLASSIFICACAO", "CO_USUARIO_ATUALIZACAO")
    select p_edital, s.analise, s.dia, s.inicio, s.inicio + interval '30 minutes', 1, 'GERADA',
           (select r."NU_VERSAO_VIGENTE" from public."TB_REGRA_AGENDA_ENTREVISTA" r where r."CO_REGRA_AGENDA" = v_regra),
           v_lista, (select auth.uid())
      from (
        select o.analise,
               case when o.i < 6 then v_dias[1] else v_dias[least(2 + (o.i - 6) / 8, cardinality(v_dias))] end as dia,
               case when o.i < 6 then time '09:00' + o.i * interval '30 minutes'
                    else time '08:00' + ((o.i - 6) % 8) * interval '30 minutes' end as inicio
          from (select e."CO_ANALISE_CURRICULAR" as analise,
                       (row_number() over (order by e."CO_VAGA", e."NO_CANDIDATO", e."CO_ENTREVISTA") - 1)::integer as i
                  from public."TB_ENTREVISTA" e
                 where e."CO_MONITORAMENTO" = p_edital and e."TP_ORIGEM" = 'sistema' and e."ST_ATIVO" = 'S'
                   and e."CO_ANALISE_CURRICULAR" is not null) o
         where o.i < 6 + 8 * (cardinality(v_dias) - 1)
      ) s;
    get diagnostics v_qt = row_count;
    if v_qt > 0 then
      insert into public."TH_AGENDA_ENTREVISTA" ("CO_MONITORAMENTO", "TP_ACAO", "NU_VERSAO_REGRA", "CO_LISTA_CLASSIFICACAO",
        "QT_ITEM", "QT_ALTERACAO", "DS_ALTERACAO", "DS_MOTIVO", "CO_USUARIO")
      values (p_edital, 'GERAR', 1, v_lista, v_qt, v_qt, '[]'::jsonb,
              'Edital de treinamento: agenda de exemplo a partir de hoje', v_uid);
    end if;
  end if;
  return v_qt;
end;
$$;
comment on function private."FC_CONVOCAR_E_AGENDAR_TREINAMENTO"(uuid) is
  'Edital de treinamento: os convocados da lista de convocação vigente viram entrevistas do sistema (banca 1) e a agenda é montada a partir de hoje (6 hoje, as demais 8 por dia nos dias úteis seguintes), com a regra da agenda (versão 1) e o registro no histórico. Não mexe no que já existe; recusa edital real (42501). Chamada só por private."FC_PREPARAR_EDITAL_TREINAMENTO".';
revoke all on function private."FC_CONVOCAR_E_AGENDAR_TREINAMENTO"(uuid) from public, anon, authenticated;
grant execute on function private."FC_CONVOCAR_E_AGENDAR_TREINAMENTO"(uuid) to service_role;

-- ── 4. Preparar: as duas etapas nos dois editais ────────────────────────────
create or replace function private."FC_PREPARAR_EDITAL_TREINAMENTO"(p_area text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_area text := lower(btrim(coalesce(p_area, '')));
  v_grupo text;
  v_planilha text;
  v_id uuid;
begin
  if v_area not in ('saude-indigena', 'projetos') then
    raise exception 'Edital de treinamento disponível só para a Saúde Indígena e Projetos' using errcode = '22023';
  end if;
  select a."NO_GRUPO_PLANILHA" into v_grupo from public."TB_AREA" a where a."CO_AREA" = v_area;
  select p."CO_PLANILHA" into v_planilha from public."TB_PLANILHA_ANALISE" p where p."CO_AREA" = v_area;
  if v_grupo is null or v_planilha is null then
    raise exception 'Área sem planilha de análises cadastrada: %', v_area using errcode = '22023';
  end if;

  -- Um edital de treinamento por área; uma preparação por vez.
  perform pg_advisory_xact_lock(hashtextextended('edital_treinamento:' || v_area, 0));

  if v_area = 'projetos' then
    v_id := private."FC_PREPARAR_TREINAMENTO_PROJETOS"(v_grupo, v_planilha);
    perform private."FC_PREPARAR_ENTREVISTA_TREINAMENTO_PROJETOS"(v_id);
  else
    v_id := private."FC_PREPARAR_TREINAMENTO_SI"(v_grupo, v_planilha);
  end if;
  perform private."FC_CONVOCAR_E_AGENDAR_TREINAMENTO"(v_id);
  return v_id;
end;
$$;
comment on function private."FC_PREPARAR_EDITAL_TREINAMENTO"(text) is
  'Cria ou completa (idempotente) o edital de treinamento da área (ST_TREINAMENTO = S), com as duas etapas prontas: Saúde Indígena (991/2099: regra do 111/2026 conferida, 30 fictícios, pré-classificação e fichas; entrevista com aspectos) ou Projetos (992/2099: espelho do 93/2026 com a regra conferida, pré-classificação e fichas; entrevista com o roteiro do SESMT, banca, lista de convocação do lote). Nos dois, convocados e agenda a partir de hoje. Devolve o id do edital. Só o service_role (e o reinício, como dono) chamam.';
revoke all on function private."FC_PREPARAR_EDITAL_TREINAMENTO"(text) from public, anon, authenticated;
grant execute on function private."FC_PREPARAR_EDITAL_TREINAMENTO"(text) to service_role;

-- ── 5. Reinício: o mesmo, com a Saúde Indígena em 30 inscritos ──────────────
create or replace function public.reiniciar_edital_treinamento(p_edital uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_m public."TB_MONITORAMENTO_INDIGENA";
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_apagados jsonb;
  v_id uuid;
begin
  if not private.is_master() then
    raise exception 'Só o administrador global reinicia o edital de treinamento' using errcode = '42501';
  end if;
  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" m where m.id = p_edital;
  if v_m.id is null then
    raise exception 'Edital não encontrado' using errcode = '22023';
  end if;
  if v_m."ST_TREINAMENTO" is distinct from 'S' then
    raise exception 'Só o edital de treinamento pode ser reiniciado' using errcode = '42501';
  end if;
  if v_m."CO_AREA" is null or v_m."CO_AREA" not in ('saude-indigena', 'projetos') then
    raise exception 'Edital de treinamento fora da Saúde Indígena e de Projetos: nada foi apagado' using errcode = '22023';
  end if;

  v_apagados := private."FC_APAGAR_DADOS_DO_TREINAMENTO"(p_edital);

  -- O edital volta ao cadastro inicial (o id fica: links e coordenações seguem valendo).
  if v_m."CO_AREA" = 'projetos' then
    update public."TB_MONITORAMENTO_INDIGENA"
       set processo = 'TREINAMENTO', edital = 'Treinamento – Projetos (992/2099)', unidade = 'Escritório Treinamento',
           sigla_unidade = 'TREINO', tipo_unidade = null, id_unidade = null, uf = 'RR', ciclo = '2099',
           cargos = 'Médico do Trabalho; Enfermeiro do Trabalho; Engenharia do Trabalho; Técnico de Enfermagem do Trabalho; Técnico de Segurança do Trabalho',
           vagas_total = 11, inscritos = 40, aptos_analise = 0, cancelados = 0, eliminados_nota = 0, reprovados_analise = 0,
           total_eliminados = 0, aprovados_analise = 0, aprovados_prova = 0, entrevistados = 0, contratados = 0,
           data_inicio = v_hoje - 24, data_fim = v_hoje + 50, status = 'Em andamento', etapa = 'Período de Análise Curricular',
           risco = 'Baixo', responsavel = 'Treinamento', ativo = true,
           status_override = null, etapa_override = null, status_override_motivo = null,
           status_override_data = null, status_override_previsao_retomada = null,
           updated_by = (select auth.uid()), updated_at = now()
     where id = p_edital and "ST_TREINAMENTO" = 'S';
  else
    update public."TB_MONITORAMENTO_INDIGENA"
       set processo = 'TREINAMENTO', edital = 'Treinamento – Saúde Indígena (991/2099)', unidade = 'DSEI Treinamento',
           sigla_unidade = 'TREINO', tipo_unidade = 'DSEI', id_unidade = null, uf = 'DF', ciclo = '2099',
           cargos = 'Enfermeiro; Técnico de Enfermagem; Agente Indígena de Saúde (AIS)', vagas_total = 7,
           inscritos = 30, aptos_analise = 30, cancelados = 0, eliminados_nota = 0, reprovados_analise = 0,
           total_eliminados = 0, aprovados_analise = 0, aprovados_prova = 0, entrevistados = 0, contratados = 0,
           data_inicio = v_hoje - 45, data_fim = v_hoje + 30, status = 'Em andamento', etapa = 'Entrevistas',
           risco = 'Baixo', responsavel = 'Treinamento', ativo = true,
           status_override = null, etapa_override = null, status_override_motivo = null,
           status_override_data = null, status_override_previsao_retomada = null,
           updated_by = (select auth.uid()), updated_at = now()
     where id = p_edital and "ST_TREINAMENTO" = 'S';
  end if;
  -- A área fica a do edital: o gatilho da área recalcula pela unidade quando ela muda.
  update public."TB_MONITORAMENTO_INDIGENA" set "CO_AREA" = v_m."CO_AREA"
   where id = p_edital and "ST_TREINAMENTO" = 'S' and "CO_AREA" is distinct from v_m."CO_AREA";

  v_id := private."FC_PREPARAR_EDITAL_TREINAMENTO"(v_m."CO_AREA");
  if v_id is distinct from p_edital then
    raise exception 'O reinício não reencontrou o edital de treinamento' using errcode = 'P0001';
  end if;
  return json_build_object('edital', p_edital, 'apagados', v_apagados, 'reiniciado_em', now());
end;
$$;
comment on function public.reiniciar_edital_treinamento(uuid) is
  'Só admin global: volta o edital de TREINAMENTO (ST_TREINAMENTO = S) da Saúde Indígena ou de Projetos ao estado inicial — apaga fisicamente os dados dele (exceção documentada à exclusão lógica) e recria os fictícios com as duas etapas prontas (avaliação documental com pré-classificação e fichas; entrevista configurada, convocados e agenda a partir de hoje). Edital real: 42501 e nada muda.';
revoke all on function public.reiniciar_edital_treinamento(uuid) from public, anon;
grant execute on function public.reiniciar_edital_treinamento(uuid) to authenticated, service_role;

-- ── 6. Os dois editais de treinamento, completos ────────────────────────────
select private."FC_PREPARAR_EDITAL_TREINAMENTO"('saude-indigena');
select private."FC_PREPARAR_EDITAL_TREINAMENTO"('projetos');

-- ═══ CONFERÊNCIAS DO ENSAIO (tudo some no rollback) ═══════════════════════

-- O estado de um edital de treinamento (só contagens e nomes: comparável entre reinícios).
create function pg_temp.estado_do_treino(p_id uuid)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'edital', (select m.edital || ' · ' || m.inscritos || ' inscritos' from public."TB_MONITORAMENTO_INDIGENA" m where m.id = p_id),
    'regra', (select r."NU_VERSAO_VIGENTE" || ' ' || r."TP_SITUACAO" || ' ' || coalesce(r."CO_MODELO_ORIGEM", '-') || ' · ' || coalesce(h."NO_VERSAO", 'sem nome')
                from public."TB_REGRA_ANALISE" r
                join public."TH_REGRA_ANALISE" h on h."CO_REGRA_ANALISE" = r."CO_REGRA_ANALISE" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
               where r."CO_MONITORAMENTO" = p_id),
    'inscricoes', (select count(*) from public."TB_EMPREGARE_CANDIDATO" c join public."TB_EMPREGARE_VAGA" v on v."CO_VAGA" = c."CO_VAGA" where v."CO_MONITORAMENTO" = p_id),
    'pre', (select jsonb_object_agg(s, n) from (select p."TP_SITUACAO" s, count(*) n from public."TB_PRE_CLASSIFICACAO" p where p."CO_MONITORAMENTO" = p_id group by 1) x),
    'fichas_livres', (select count(*) from public."TB_FICHA_ANALISE" f where f."CO_MONITORAMENTO" = p_id and f."TP_SITUACAO" = 'PENDENTE' and f."CO_USUARIO_RESPONSAVEL" is null),
    'execucao', (select t."TP_SITUACAO" from public."TL_PRE_CLASSIFICACAO" t where t."CO_EXECUCAO" = 'treinamento-' || p_id),
    'analises', (select count(*) from public."TB_ANALISE_CURRICULAR" a join public."TB_MONITORAMENTO_INDIGENA" m on m.id = p_id
                  where private."FC_ANALISE_EH_TREINAMENTO"(a.origem_planilha) and a."CO_AREA" = m."CO_AREA"
                    and private."FC_NUMERO_EDITAL"(a.edital) = private."FC_NUMERO_EDITAL"(m.edital)),
    'entrevista', (select r."NO_ROTEIRO" || ' · ' || c."TP_LANCAMENTO" || ' · ' || r."TP_ESCALA"
                          || ' · ' || (select count(*) from public."TB_ROTEIRO_COMPETENCIA" k where k."CO_ROTEIRO" = r."CO_ROTEIRO") || ' competências'
                          || ' · ' || (select count(*) from public."TB_ROTEIRO_ASPECTO" a where a."CO_ROTEIRO" = r."CO_ROTEIRO") || ' aspectos'
                     from public."TB_ENTREVISTA_EDITAL" c join public."TB_ROTEIRO_ENTREVISTA" r on r."CO_ROTEIRO" = c."CO_ROTEIRO"
                    where c."CO_MONITORAMENTO" = p_id),
    'vagas_entrevista', (select count(*) from public."TB_ENTREVISTA_VAGA" v where v."CO_MONITORAMENTO" = p_id),
    'avaliadores', (select count(*) from public."TB_ENTREVISTA_AVALIADOR" b where b."CO_MONITORAMENTO" = p_id and b."ST_ATIVO" = 'S'),
    'por_competencia', (select jsonb_agg(b."NO_AVALIADOR" || ' → ' || k."NO_COMPETENCIA" order by b."NO_AVALIADOR")
                          from public."TB_ENTREVISTA_AVALIADOR_COMPETENCIA" l
                          join public."TB_ENTREVISTA_AVALIADOR" b on b."CO_AVALIADOR" = l."CO_AVALIADOR"
                          join public."TB_ROTEIRO_COMPETENCIA" k on k."CO_COMPETENCIA" = l."CO_COMPETENCIA"
                         where b."CO_MONITORAMENTO" = p_id),
    'regra_classificacao', (select count(*) from public."TB_REGRA_CLASSIFICACAO" r where r."CO_MONITORAMENTO" = p_id),
    'lista_convocacao', (select l."QT_ELEGIVEL" from public."TB_LISTA_CLASSIFICACAO" l where l."CO_LISTA_CLASSIFICACAO" = private."FC_LISTA_CONVOCACAO_VIGENTE"(p_id)),
    'convocados', (select count(*) from public."TB_ENTREVISTA" e where e."CO_MONITORAMENTO" = p_id and e."TP_ORIGEM" = 'sistema' and e."ST_ATIVO" = 'S'),
    'regra_agenda', (select count(*) from public."TB_REGRA_AGENDA_ENTREVISTA" g where g."CO_MONITORAMENTO" = p_id),
    'agenda', (select count(*) from public."TB_AGENDA_ENTREVISTA" g where g."CO_MONITORAMENTO" = p_id),
    'agenda_hoje', (select count(*) from public."TB_AGENDA_ENTREVISTA" g where g."CO_MONITORAMENTO" = p_id
                       and g."DT_ENTREVISTA" = (now() at time zone 'America/Sao_Paulo')::date),
    'liberada', (select count(*) from public."TB_ENTREVISTA_LIBERACAO" l where l."CO_MONITORAMENTO" = p_id and l."ST_REGISTRO_ATIVO" = 'S'
                    and l."DT_LIBERADO_ATE" >= (now() at time zone 'America/Sao_Paulo')::date));
$$;

-- E1. Os dois editais com as duas etapas prontas (contagens).
do $$
declare
  v_si uuid;
  v_proj uuid;
  v_esperado_si jsonb := '{
    "edital": "Treinamento – Saúde Indígena (991/2099) · 30 inscritos",
    "regra": "1 CONFERIDA SI26-PARINTINS · SI26-PARINTINS — Edital 111/2026",
    "inscricoes": 30, "pre": {"ELIMINADO": 4, "RANQUEADO": 2, "NO_LOTE": 24}, "fichas_livres": 24, "execucao": "CONCLUIDA",
    "analises": 15,
    "entrevista": "Treinamento — Entrevista individual (exemplo) · SECRETARIA · NIVEIS · 4 competências · 3 aspectos",
    "vagas_entrevista": 3, "avaliadores": 2, "por_competencia": ["Avaliador Teste 2 → Trabalho em equipe"],
    "regra_classificacao": 1, "lista_convocacao": 15, "convocados": 15, "regra_agenda": 1, "agenda": 15, "agenda_hoje": 6,
    "liberada": 0}';
  v_esperado_proj jsonb := '{
    "edital": "Treinamento – Projetos (992/2099) · 40 inscritos",
    "regra": "1 CONFERIDA PROJ26-CURRICULAR · sem nome",
    "inscricoes": 40, "pre": {"ELIMINADO": 11, "RANQUEADO": 8, "NO_LOTE": 21}, "fichas_livres": 21, "execucao": "CONCLUIDA",
    "analises": 21,
    "entrevista": "Treinamento — Entrevista Projetos (exemplo) · SECRETARIA · FAIXA · 4 competências · 0 aspectos",
    "vagas_entrevista": 5, "avaliadores": 3, "por_competencia": ["Avaliador Teste P3 → Habilidade intercultural"],
    "regra_classificacao": 1, "lista_convocacao": 21, "convocados": 21, "regra_agenda": 1, "agenda": 21, "agenda_hoje": 6,
    "liberada": 1}';
  v jsonb;
begin
  select m.id into v_si from public."TB_MONITORAMENTO_INDIGENA" m where m."ST_TREINAMENTO" = 'S' and m."CO_AREA" = 'saude-indigena';
  select m.id into v_proj from public."TB_MONITORAMENTO_INDIGENA" m where m."ST_TREINAMENTO" = 'S' and m."CO_AREA" = 'projetos';
  if v_si is null or v_proj is null then raise exception 'FALHOU E1: faltou edital de treinamento'; end if;
  perform set_config('ensaio.si', v_si::text, true);
  perform set_config('ensaio.proj', v_proj::text, true);
  perform set_config('ensaio.esperado_si', v_esperado_si::text, true);
  perform set_config('ensaio.esperado_proj', v_esperado_proj::text, true);
  -- Na Saúde Indígena já preparada, a banca de antes pode ter dado notas: o vínculo por
  -- competência do Avaliador Teste 2 só vem com o reinício (E5 confere).
  v := pg_temp.estado_do_treino(v_si);
  -- O que o uso do treino muda (o número de inscritos no cadastro, fichas já pegas) também
  -- só volta com o reinício; aqui, fichas livres para pegar.
  if v - array['por_competencia', 'edital', 'fichas_livres'] <> v_esperado_si - array['por_competencia', 'edital', 'fichas_livres']
     or (v ->> 'fichas_livres')::integer = 0 then
    raise exception 'FALHOU E1: Saúde Indígena: %', v;
  end if;
  if pg_temp.estado_do_treino(v_proj) - array['edital', 'fichas_livres'] <> v_esperado_proj - array['edital', 'fichas_livres']
     or (pg_temp.estado_do_treino(v_proj) ->> 'fichas_livres')::integer = 0 then
    raise exception 'FALHOU E1: Projetos: %', pg_temp.estado_do_treino(v_proj);
  end if;
  perform set_config('ensaio.estado_proj', pg_temp.estado_do_treino(v_proj)::text, true);
  -- A pré-classificação gravada é a do Python (os casos fora do lote).
  if (select string_agg(c."CO_CANDIDATO_EMPREGARE" || '=' || p."TP_SITUACAO" || coalesce('/' || p."CO_MOTIVO_ELIMINACAO", ''), ',' order by c."CO_CANDIDATO_EMPREGARE")
        from public."TB_PRE_CLASSIFICACAO" p join public."TB_EMPREGARE_CANDIDATO" c on c."CO_EMPREGARE_CANDIDATO" = p."CO_EMPREGARE_CANDIDATO"
       where p."CO_MONITORAMENTO" = v_si and p."TP_SITUACAO" <> 'NO_LOTE')
     <> 'TREINO-15=ELIMINADO/QUESTIONARIO,TREINO-17=ELIMINADO/CANCELADO,TREINO-19=ELIMINADO/QUESTIONARIO,TREINO-25=RANQUEADO,TREINO-26=RANQUEADO,TREINO-27=ELIMINADO/REPROVADO_EMPREGARE' then
    raise exception 'FALHOU E1: os casos da pré-classificação da Saúde Indígena';
  end if;
  -- Preparar de novo não muda nada (idempotente).
  perform private."FC_PREPARAR_EDITAL_TREINAMENTO"('saude-indigena');
  perform private."FC_PREPARAR_EDITAL_TREINAMENTO"('projetos');
  if pg_temp.estado_do_treino(v_si) <> v or pg_temp.estado_do_treino(v_proj) <> current_setting('ensaio.estado_proj')::jsonb then
    raise exception 'FALHOU E1: preparar de novo mudou o estado';
  end if;
  raise notice 'ok E1: SI (regra conferida e nomeada, 30 inscritos, 24 fichas, entrevista e agenda) e Projetos (21 fichas, entrevista, banca, lista e agenda)';
end;
$$;

-- E2. As funções novas recusam edital real; o preparar só aceita as duas áreas.
do $$
declare
  v_real uuid;
begin
  select m.id into v_real from public."TB_MONITORAMENTO_INDIGENA" m where m."CO_AREA" = 'projetos' and m.edital = '93/2026' and m."ST_TREINAMENTO" = 'N';
  begin
    perform private."FC_PREPARAR_ENTREVISTA_TREINAMENTO_PROJETOS"(v_real);
    raise exception 'FALHOU E2: entrevista de exemplo em edital real';
  exception when insufficient_privilege then null;
  end;
  begin
    perform private."FC_PREPARAR_ENTREVISTA_TREINAMENTO_PROJETOS"(current_setting('ensaio.si')::uuid);
    raise exception 'FALHOU E2: entrevista de Projetos no treinamento da Saúde Indígena';
  exception when insufficient_privilege then null;
  end;
  begin
    perform private."FC_CONVOCAR_E_AGENDAR_TREINAMENTO"(v_real);
    raise exception 'FALHOU E2: convocou e agendou edital real';
  exception when insufficient_privilege then null;
  end;
  begin
    perform private."FC_PREPARAR_EDITAL_TREINAMENTO"('sede');
    raise exception 'FALHOU E2: preparou treinamento da SEDE';
  exception when invalid_parameter_value then null;
  end;
  raise notice 'ok E2: edital real e outra área recusados';
end;
$$;

-- Admin sintético.
insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-4000-a000-0000000071e3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.treino.admin3@ensaio.invalid');
insert into public."TB_PERFIL_USUARIO" (user_id, email, nome, perfil, ativo)
select '00000000-0000-4000-a000-0000000071e3', 'ensaio.treino.admin3@ensaio.invalid', 'Ensaio Admin',
       (select g."CO_GRUPO_ACESSO" from public."TB_GRUPO_ACESSO" g where g."ST_ADMIN_GLOBAL" order by 1 limit 1), true;

-- E3. As telas (como admin global) e as travas do reinício.
set local role authenticated;
do $$
declare
  v_si uuid := current_setting('ensaio.si')::uuid;
  v_proj uuid := current_setting('ensaio.proj')::uuid;
  v_real uuid;
  v json;
  v_txt text;
begin
  perform set_config('request.jwt.claims', '{"role":"authenticated"}', true);
  begin
    perform public.reiniciar_edital_treinamento(v_si);
    raise exception 'FALHOU E3: reiniciou sem ser admin';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-4000-a000-0000000071e3","role":"authenticated","email":"ensaio.treino.admin3@ensaio.invalid"}', true);
  if not private.is_master() then raise exception 'ENSAIO: o admin sintético não é admin global'; end if;
  select m.id into v_real from public."TB_MONITORAMENTO_INDIGENA" m where m."CO_AREA" = 'projetos' and m.edital = '93/2026' and m."ST_TREINAMENTO" = 'N';
  begin
    perform public.reiniciar_edital_treinamento(v_real);
    raise exception 'FALHOU E3: reiniciou edital real';
  exception when insufficient_privilege then null;
  end;

  -- Avaliação documental da Saúde Indígena: na lista, com a pré-classificação.
  if not exists (select 1 from json_array_elements(public.listar_editais_avaliacao('saude-indigena') -> 'editais') e
                  where e ->> 'id' = v_si::text and (e ->> 'treinamento')::boolean) then
    raise exception 'FALHOU E3: 991/2099 fora de listar_editais_avaliacao';
  end if;
  v := public.obter_pre_classificacao(v_si);
  if (v #>> '{edital,treinamento}')::boolean is not true or v #>> '{ultima_execucao,situacao}' <> 'CONCLUIDA' then
    raise exception 'FALHOU E3: obter_pre_classificacao(991): %', left(v::text, 300);
  end if;
  -- Entrevista de Projetos: na lista (liberada), configurada, banca com o avaliador por competência, agenda.
  if not exists (select 1 from json_array_elements(public.listar_editais_entrevista('projetos') -> 'editais') e
                  where e ->> 'id' = v_proj::text and (e ->> 'configurado')::boolean and (e ->> 'convocados')::integer = 21
                    and e ->> 'visivel_por' = 'liberado') then
    raise exception 'FALHOU E3: 992/2099 fora de listar_editais_entrevista: %', left((public.listar_editais_entrevista('projetos'))::text, 400);
  end if;
  v := public.obter_entrevistas_do_edital(v_proj);
  if v #>> '{configuracao,lancamento}' <> 'SECRETARIA' or json_array_length(v -> 'convocados') <> 21
     or json_array_length(v -> 'avaliadores') <> 3
     or (select count(*) from json_array_elements(v -> 'avaliadores') a where json_typeof(a -> 'competencias') = 'array') <> 1
     or v -> 'lista_convocacao' is null then
    raise exception 'FALHOU E3: obter_entrevistas_do_edital(992): %', left(v::text, 400);
  end if;
  v := public.obter_agenda_entrevista(v_proj);
  if json_array_length(v -> 'itens') <> 21 or v -> 'regra' is null then
    raise exception 'FALHOU E3: obter_agenda_entrevista(992): %', left(v::text, 300);
  end if;
  v := public.obter_agenda_entrevista(v_si);
  if json_array_length(v -> 'itens') <> 15 then raise exception 'FALHOU E3: obter_agenda_entrevista(991)'; end if;

  -- Fora de painéis, conferências e robôs.
  v_txt := public.get_painel_dos_robos()::text;
  if v_txt like '%treinamento-%' then raise exception 'FALHOU E3: execução do treinamento no painel dos robôs'; end if;
  if public.listar_acompanhamento_da_visao_geral('projetos')::text like '%' || v_proj || '%'
     or public.listar_acompanhamento_da_visao_geral('saude-indigena')::text like '%' || v_si || '%' then
    raise exception 'FALHOU E3: treinamento no acompanhamento da Visão geral';
  end if;
  raise notice 'ok E3: telas com as duas etapas; travas; fora de painéis e robôs';
end;
$$;
reset role;
do $$
declare
  v_txt text;
begin
  -- O job (service_role) no modo padrão não vê os editais de treinamento.
  v_txt := public.pre_classificacao_ler_editais(null, false)::text || public.pre_classificacao_ler_editais(null, true)::text;
  if v_txt like '%' || current_setting('ensaio.si') || '%' or v_txt like '%' || current_setting('ensaio.proj') || '%' then
    raise exception 'FALHOU E3: treinamento na pré-classificação (modo padrão)';
  end if;
end;
$$;

-- E4. "Pegar próximo" na Saúde Indígena (o admin entra na equipe como analista, como na tela).
insert into public."RL_ANALISTA_EDITAL" ("CO_MONITORAMENTO", "CO_USUARIO", "TP_PAPEL", "CO_USUARIO_ATUALIZACAO")
values (current_setting('ensaio.si')::uuid, '00000000-0000-4000-a000-0000000071e3', 'ANALISTA', '00000000-0000-4000-a000-0000000071e3');
set local role authenticated;
do $$
declare
  v json;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-4000-a000-0000000071e3","role":"authenticated","email":"ensaio.treino.admin3@ensaio.invalid"}', true);
  v := public.pegar_proxima_ficha(current_setting('ensaio.si')::uuid, null);
  if v is null or v::text not like '%TREINO-%' then
    raise exception 'FALHOU E4: pegar_proxima_ficha(991): %', left(coalesce(v::text, 'nulo'), 300);
  end if;
  raise notice 'ok E4: Pegar próximo entregou uma ficha da Saúde Indígena';
end;
$$;
reset role;

-- E5. Reinício dos dois (admin), duas vezes: volta ao mesmo estado (idempotente).
set local role authenticated;
do $$
declare
  v_si uuid := current_setting('ensaio.si')::uuid;
  v_proj uuid := current_setting('ensaio.proj')::uuid;
  v json;
  i integer;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-4000-a000-0000000071e3","role":"authenticated","email":"ensaio.treino.admin3@ensaio.invalid"}', true);
  for i in 1..2 loop
    v := public.reiniciar_edital_treinamento(v_si);
    v := public.reiniciar_edital_treinamento(v_proj);
  end loop;
end;
$$;
reset role;
do $$
declare
  v_si uuid := current_setting('ensaio.si')::uuid;
  v_proj uuid := current_setting('ensaio.proj')::uuid;
  v jsonb;
begin
  v := pg_temp.estado_do_treino(v_si);
  if v <> current_setting('ensaio.esperado_si')::jsonb then raise exception 'FALHOU E5: SI depois do reinício: %', v; end if;
  v := pg_temp.estado_do_treino(v_proj);
  if v <> current_setting('ensaio.esperado_proj')::jsonb then raise exception 'FALHOU E5: Projetos depois do reinício: %', v; end if;
  if (select count(*) from public."RL_ANALISTA_EDITAL" r where r."CO_MONITORAMENTO" = v_si) <> 0 then
    raise exception 'FALHOU E5: o reinício deixou a equipe do treino';
  end if;
  if (select count(*) from public."TB_ROTEIRO_ENTREVISTA" r where r."NO_ROTEIRO" = 'Treinamento — Entrevista Projetos (exemplo)') <> 1 then
    raise exception 'FALHOU E5: o reinício duplicou o roteiro de Projetos';
  end if;
  raise notice 'ok E5: reinício (duas vezes) recria as duas etapas nos dois editais';
end;
$$;

-- E6. Nenhuma contagem real mudou.
do $$
declare
  v_dif text;
begin
  select string_agg(r.tabela || ' ' || r.qt || ' → ' || coalesce(n.qt, '?'), '; ') into v_dif
    from tmp_ensaio_real r
    left join (
with e93 as (select m.id from public."TB_MONITORAMENTO_INDIGENA" m where m."CO_AREA" = 'projetos' and m.edital = '93/2026' and m."ST_TREINAMENTO" = 'N'),
     e111 as (select m.id from public."TB_MONITORAMENTO_INDIGENA" m where private."FC_NUMERO_EDITAL"(m.edital) = '111/2026' and m."ST_TREINAMENTO" = 'N')
select 'entrevistas' as tabela, count(*)::text as qt from public."TB_ENTREVISTA" e where not private."FC_EDITAL_EH_TREINAMENTO"(e."CO_MONITORAMENTO")
union all select 'historico_entrevistas', count(*)::text from public."TH_ENTREVISTA_AVALIACAO" h join public."TB_ENTREVISTA" e on e."CO_ENTREVISTA" = h."CO_ENTREVISTA" where not private."FC_EDITAL_EH_TREINAMENTO"(e."CO_MONITORAMENTO")
union all select 'config_entrevista', count(*)::text from public."TB_ENTREVISTA_EDITAL" c where not private."FC_EDITAL_EH_TREINAMENTO"(c."CO_MONITORAMENTO")
union all select 'avaliadores', count(*)::text from public."TB_ENTREVISTA_AVALIADOR" b where not private."FC_EDITAL_EH_TREINAMENTO"(b."CO_MONITORAMENTO")
union all select 'avaliador_competencia', count(*)::text from public."TB_ENTREVISTA_AVALIADOR_COMPETENCIA" l join public."TB_ENTREVISTA_AVALIADOR" b on b."CO_AVALIADOR" = l."CO_AVALIADOR" where not private."FC_EDITAL_EH_TREINAMENTO"(b."CO_MONITORAMENTO")
union all select 'liberacoes', count(*)::text from public."TB_ENTREVISTA_LIBERACAO" l where not private."FC_EDITAL_EH_TREINAMENTO"(l."CO_MONITORAMENTO")
union all select 'agenda', count(*)::text from public."TB_AGENDA_ENTREVISTA" g where not private."FC_EDITAL_EH_TREINAMENTO"(g."CO_MONITORAMENTO")
union all select 'historico_agenda', count(*)::text from public."TH_AGENDA_ENTREVISTA" g where not private."FC_EDITAL_EH_TREINAMENTO"(g."CO_MONITORAMENTO")
union all select 'regras_agenda', count(*)::text from public."TB_REGRA_AGENDA_ENTREVISTA" g where not private."FC_EDITAL_EH_TREINAMENTO"(g."CO_MONITORAMENTO")
union all select 'roteiros_reais', count(*)::text || ' ' || coalesce(string_agg(r."CO_ROTEIRO"::text || r."ST_ATIVO", ',' order by r."CO_ROTEIRO"), '') from public."TB_ROTEIRO_ENTREVISTA" r where r."NO_ROTEIRO" not like 'Treinamento%'
union all select 'analises', count(*)::text from public."TB_ANALISE_CURRICULAR" a where not private."FC_ANALISE_EH_TREINAMENTO"(a.origem_planilha)
union all select 'listas_classificacao', count(*)::text from public."TB_LISTA_CLASSIFICACAO" l where not private."FC_EDITAL_EH_TREINAMENTO"(l."CO_MONITORAMENTO")
union all select 'regras_analise', count(*)::text from public."TB_REGRA_ANALISE" r where not private."FC_EDITAL_EH_TREINAMENTO"(r."CO_MONITORAMENTO")
union all select 'versoes_regras_analise', count(*)::text || ' ' || count(h."NO_VERSAO")::text from public."TH_REGRA_ANALISE" h join public."TB_REGRA_ANALISE" r on r."CO_REGRA_ANALISE" = h."CO_REGRA_ANALISE" where not private."FC_EDITAL_EH_TREINAMENTO"(r."CO_MONITORAMENTO")
union all select 'fichas', count(*)::text from public."TB_FICHA_ANALISE" f where not private."FC_EDITAL_EH_TREINAMENTO"(f."CO_MONITORAMENTO")
union all select 'pre_classificacao', count(*)::text from public."TB_PRE_CLASSIFICACAO" p where not private."FC_EDITAL_EH_TREINAMENTO"(p."CO_MONITORAMENTO")
union all select 'execucoes_pre_classificacao', count(*)::text from public."TL_PRE_CLASSIFICACAO" t where not private."FC_EXECUCAO_EH_TREINAMENTO"(t."CO_EXECUCAO")
union all select 'inscricoes', count(*)::text from public."TB_EMPREGARE_CANDIDATO" c join public."TB_EMPREGARE_VAGA" v on v."CO_VAGA" = c."CO_VAGA" where not private."FC_EDITAL_EH_TREINAMENTO"(v."CO_MONITORAMENTO")
union all select 'cronograma', count(*)::text from public."TB_CRONOGRAMA_MONIT_INDIG" c where not private."FC_EDITAL_EH_TREINAMENTO"(c.monitoramento_id)
union all select 'aprovados', count(*)::text from public."TB_CANDIDATO_APROVADO" c
union all select 'editais_reais', count(*)::text from public."TB_MONITORAMENTO_INDIGENA" m where m."ST_TREINAMENTO" = 'N'
union all select 'kpis', (select row_to_json(k)::text from public."VW_MONITORAMENTO_INDIGENA_KPIS" k)
union all select '93_regra', (select r."NU_VERSAO_VIGENTE" || ' ' || r."TP_SITUACAO" || ' ' || h."DS_HASH" || ' ' || coalesce(h."NO_VERSAO", '-') from public."TB_REGRA_ANALISE" r join public."TH_REGRA_ANALISE" h on h."CO_REGRA_ANALISE" = r."CO_REGRA_ANALISE" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE" where r."CO_MONITORAMENTO" in (select id from e93))
union all select '93_entrevistas', count(*)::text from public."TB_ENTREVISTA" e where e."CO_MONITORAMENTO" in (select id from e93)
union all select '111_regra', coalesce((select r."NU_VERSAO_VIGENTE" || ' ' || r."TP_SITUACAO" from public."TB_REGRA_ANALISE" r where r."CO_MONITORAMENTO" in (select id from e111)), '-')
union all select '111_inscricoes', count(*)::text from public."TB_EMPREGARE_CANDIDATO" c join public."TB_EMPREGARE_VAGA" v on v."CO_VAGA" = c."CO_VAGA" where v."CO_MONITORAMENTO" in (select id from e111)
union all select '111_entrevistas', count(*)::text from public."TB_ENTREVISTA" e where e."CO_MONITORAMENTO" in (select id from e111)
    ) n on n.tabela = r.tabela
   where n.qt is distinct from r.qt;
  if v_dif is not null then raise exception 'FALHOU E6: dado real mudou: %', v_dif; end if;
  raise notice 'ok E6: nenhuma contagem real mudou';
end;
$$;

select jsonb_build_object(
  'resultado', 'TUDO OK',
  'saude_indigena', pg_temp.estado_do_treino(current_setting('ensaio.si')::uuid),
  'projetos', pg_temp.estado_do_treino(current_setting('ensaio.proj')::uuid),
  'reais', (select jsonb_object_agg(r.tabela, r.qt) from tmp_ensaio_real r where r.tabela not in ('kpis', 'roteiros_reais'))
) as ensaio;

rollback;
