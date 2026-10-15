/* Ensaio de 20261015141500 (rode dentro de begin/rollback): aplica a migration, abre uma carga fictícia de cada tipo e mostra que as presas há mais de 3 h viraram FALHOU. */
\ir ../migrations/20261015141500_cargas_presas_fecham_sozinhas_e_folga_dos_robos.sql
insert into public."TL_SYNC_SELECAO" ("CO_SYNC", "DT_INICIO", "TP_SITUACAO") values ('ensaio-selecao', now(), 'EM_ANDAMENTO');
insert into public."TL_SYNC_ENTREVISTA" ("CO_SYNC", "CO_AREA", "DT_INICIO", "TP_SITUACAO")
select 'ensaio-entrevista-' || a, a, now(), 'EM_ANDAMENTO'
  from (select distinct "CO_AREA" a from public."TL_SYNC_ENTREVISTA" where "TP_SITUACAO" = 'EM_ANDAMENTO') x;
select 'entrevista' tabela, "CO_SYNC", "CO_AREA", "TP_SITUACAO", "DS_MENSAGEM" from public."TL_SYNC_ENTREVISTA" where "TP_SITUACAO" in ('EM_ANDAMENTO', 'FALHOU')
union all
select 'selecao', "CO_SYNC", null, "TP_SITUACAO", "DS_MENSAGEM" from public."TL_SYNC_SELECAO" where "TP_SITUACAO" in ('EM_ANDAMENTO', 'FALHOU');
