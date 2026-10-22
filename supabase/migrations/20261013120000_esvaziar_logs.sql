/*
  ESVAZIAR OS LOGS

  Por quê: antes de levar o banco para uma instância nova só com o 93/2026 e
  o 114/2026, a coordenação pediu para apagar todo o log — nenhum é usado.
  Só dados: nada de schema muda, e as rotinas de limpeza que já existem
  (agsus_eventos_acesso_limpeza_mensal, FC_CONFERIR_DISPAROS_ROBO,
  limpar_logs_operacionais) seguem como estão.

  O QUE SE APAGA INTEIRO (ninguém decide nada a partir dele)
    TL_EVENTO_ACESSO          acessos e heartbeats. "Último acesso" do
                              usuário fica vazio até ele entrar de novo.
    TL_ACESSO_FICHA_ANALISE   quem abriu cada ficha.
    cron.job_run_details      histórico das execuções do pg_cron.
    net._http_response        respostas do pg_net. Antes, os disparos ainda
                              em PEDIDO são conferidos, para não virarem
                              "Sem resposta do GitHub em 1 h.".

  O QUE FICA COM O ÚLTIMO DE CADA (o sistema lê para decidir)
    TL_SYNC_ANALISE, TL_SYNC_MONIT_INDIGENA, TL_SYNC_ENTREVISTA,
    TL_SYNC_SELECAO, TL_SYNC_EMPREGARE, TL_DISPARO_ROBO, TL_CONFERENCIA,
    TL_EXPURGO_ANEXO_CHAT
    São registro de execução, não só log: "última carga" das telas, guarda
    do sync incremental, situação do robô, saúde das cargas. Fica, por
    tabela:
      - a execução mais recente de cada situação (por planilha, área ou
        workflow, quando a tabela separa assim);
      - a que ainda não terminou;
      - a que tem dado apontando para ela por FK: candidatos e vagas da
        Empregare (CO_SYNC), avisos da conferência (CO_EXECUCAO). Apagar
        essas levaria o dado junto (CASCADE).
    TL_SYNC_ANALISE guarda também a última hora inteira: um sync incremental
    em curso escreve mais de uma linha.

  O QUE NÃO SE TOCA
    TL_PRE_CLASSIFICACAO           imutável de propósito
                                   (FC_TG_PRE_CLASSIF_IMUTAVEL): o lote,
                                   as fichas e as sugestões apontam para ela.
    private."TL_ALTERACAO_CACHE"   fila de "este cache mudou"
                                   (FC_CACHE_DESATUALIZADO). Esvaziar faria
                                   os painéis ficarem velhos.
    auth.audit_log_entries         é do Supabase Auth.
    TH_*                           histórico de negócio, não log.

  Depois do COMMIT: VACUUM FULL nas tabelas esvaziadas, para devolver o
  espaço ao disco. VACUUM não roda dentro de transação — no SQL Editor,
  rode o bloco do VACUUM separado.
*/

begin;

-- 1. Logs puros -------------------------------------------------------------

truncate table public."TL_EVENTO_ACESSO", public."TL_ACESSO_FICHA_ANALISE";

delete from cron.job_run_details;

select private."FC_CONFERIR_DISPAROS_ROBO"();
delete from net._http_response;

-- 2. Registros de execução: o último de cada, o que roda e o que tem FK ------

delete from public."TL_SYNC_ANALISE" t
 where t.finished_at is not null
   and t.created_at < now() - interval '1 hour'
   and t.id not in (
     select distinct on (x.origem, x."CO_PLANILHA", x.status) x.id
       from public."TL_SYNC_ANALISE" x
      order by x.origem, x."CO_PLANILHA", x.status, x.created_at desc);

delete from public."TL_SYNC_MONIT_INDIGENA" t
 where t.finished_at is not null
   and t.sync_id not in (
     select distinct on (x.origem, x.status) x.sync_id
       from public."TL_SYNC_MONIT_INDIGENA" x
      order by x.origem, x.status, x.created_at desc);

delete from public."TL_SYNC_ENTREVISTA" t
 where t."DT_FIM" is not null
   and t."CO_SYNC" not in (
     select distinct on (x."CO_AREA", x."TP_SITUACAO") x."CO_SYNC"
       from public."TL_SYNC_ENTREVISTA" x
      order by x."CO_AREA", x."TP_SITUACAO", x."DT_INICIO" desc);

delete from public."TL_SYNC_SELECAO" t
 where t."DT_FIM" is not null
   and t."CO_SYNC" not in (
     select distinct on (x."TP_SITUACAO") x."CO_SYNC"
       from public."TL_SYNC_SELECAO" x
      order by x."TP_SITUACAO", x."DT_INICIO" desc);

delete from public."TL_DISPARO_ROBO" t
 where t."TP_SITUACAO" <> 'PEDIDO'
   and t."CO_DISPARO" not in (
     select distinct on (x."NO_WORKFLOW", x."TP_SITUACAO") x."CO_DISPARO"
       from public."TL_DISPARO_ROBO" x
      order by x."NO_WORKFLOW", x."TP_SITUACAO", x."DT_DISPARO" desc);

delete from public."TL_EXPURGO_ANEXO_CHAT" t
 where t."DT_FIM" is not null
   and t."CO_EXECUCAO" not in (
     select distinct on (x."TP_SITUACAO") x."CO_EXECUCAO"
       from public."TL_EXPURGO_ANEXO_CHAT" x
      order by x."TP_SITUACAO", x."DT_INICIO" desc);

delete from public."TL_CONFERENCIA" t
 where t."DT_FIM" is not null
   and not exists (select 1 from public."TB_AVISO_CONFERENCIA" a where a."CO_EXECUCAO" = t."CO_EXECUCAO")
   and t."CO_EXECUCAO" not in (
     select distinct on (x."TP_SITUACAO") x."CO_EXECUCAO"
       from public."TL_CONFERENCIA" x
      order by x."TP_SITUACAO", x."DT_INICIO" desc);

delete from public."TL_SYNC_EMPREGARE" t
 where t."DT_FIM" is not null
   and not exists (select 1 from public."TB_EMPREGARE_VAGA" r where r."CO_SYNC" = t."CO_SYNC")
   and not exists (select 1 from public."TB_EMPREGARE_CANDIDATO" r where r."CO_SYNC" = t."CO_SYNC")
   and not exists (select 1 from public."TB_EMPREGARE_RESPOSTA" r where r."CO_SYNC" = t."CO_SYNC")
   and t."CO_SYNC" not in (
     select distinct on (x."TP_SITUACAO") x."CO_SYNC"
       from public."TL_SYNC_EMPREGARE" x
      order by x."TP_SITUACAO", x."DT_INICIO" desc);

commit;

-- 3. Devolver o espaço (fora de transação) ------------------------------------

vacuum full analyze public."TL_EVENTO_ACESSO";
vacuum full analyze public."TL_ACESSO_FICHA_ANALISE";
vacuum full analyze public."TL_SYNC_ANALISE";
vacuum full analyze public."TL_SYNC_MONIT_INDIGENA";
vacuum full analyze public."TL_SYNC_ENTREVISTA";
vacuum full analyze public."TL_SYNC_SELECAO";
vacuum full analyze public."TL_DISPARO_ROBO";
vacuum analyze cron.job_run_details;
