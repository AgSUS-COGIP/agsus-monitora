/*
  CORREÇÃO DE DADOS — recompõe TB_ANALISE_CURRICULAR.responsavel_analise das linhas
  que já existem para o nome e sobrenome do cadastro (Projetos e Saúde Indígena;
  linhas da planilha e do MONITORA; ativas e inativas).
  PRÉ-REQUISITO: 20261016120000 (private."FC_NOME_DO_RESPONSAVEL" e a carga de
  public."TB_APELIDO_RESPONSAVEL"). Daqui em diante o sincronismo e a publicação da
  ficha já gravam o nome padronizado; isto só alinha o passado.

  Leve: uma transação curta por edital (os 55 editais em que algum nome muda em
  16/10/2026), só nas linhas em que o nome muda. Não toca hash_registro nem
  ultima_atualizacao (o sincronismo compara pelo hash do payload; nada volta).
  updated_at anda pelo gatilho da tabela, e o gatilho TG_ANALISE_CACHE_UPD marca o
  cache do Painel das análises (ANALISES/ENTREVISTAS) das áreas tocadas.
  Reexecutar é inofensivo (o nome padronizado não muda de novo).
  Feita pela conta do setor Gestão da Informação de Pessoal
  (a01afddb-f64b-47d9-80e8-476a1ed14e43); a tabela não tem coluna de usuário.
*/
create temporary table if not exists tmp_recomposicao_responsavel (edital text, alteradas integer);

begin;
set local lock_timeout = '2s';
with u as (
  update public."TB_ANALISE_CURRICULAR" a
     set responsavel_analise = private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo)
   where a.edital = '22/2026'
     and a.responsavel_analise is not null
     and private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo) is distinct from a.responsavel_analise
  returning 1)
insert into tmp_recomposicao_responsavel select '22/2026', count(*) from u;
commit;

begin;
set local lock_timeout = '2s';
with u as (
  update public."TB_ANALISE_CURRICULAR" a
     set responsavel_analise = private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo)
   where a.edital = '23/2026'
     and a.responsavel_analise is not null
     and private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo) is distinct from a.responsavel_analise
  returning 1)
insert into tmp_recomposicao_responsavel select '23/2026', count(*) from u;
commit;

begin;
set local lock_timeout = '2s';
with u as (
  update public."TB_ANALISE_CURRICULAR" a
     set responsavel_analise = private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo)
   where a.edital = '28/2026'
     and a.responsavel_analise is not null
     and private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo) is distinct from a.responsavel_analise
  returning 1)
insert into tmp_recomposicao_responsavel select '28/2026', count(*) from u;
commit;

begin;
set local lock_timeout = '2s';
with u as (
  update public."TB_ANALISE_CURRICULAR" a
     set responsavel_analise = private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo)
   where a.edital = '30/2026'
     and a.responsavel_analise is not null
     and private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo) is distinct from a.responsavel_analise
  returning 1)
insert into tmp_recomposicao_responsavel select '30/2026', count(*) from u;
commit;

begin;
set local lock_timeout = '2s';
with u as (
  update public."TB_ANALISE_CURRICULAR" a
     set responsavel_analise = private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo)
   where a.edital = '34/2026'
     and a.responsavel_analise is not null
     and private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo) is distinct from a.responsavel_analise
  returning 1)
insert into tmp_recomposicao_responsavel select '34/2026', count(*) from u;
commit;

begin;
set local lock_timeout = '2s';
with u as (
  update public."TB_ANALISE_CURRICULAR" a
     set responsavel_analise = private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo)
   where a.edital = '36/2026'
     and a.responsavel_analise is not null
     and private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo) is distinct from a.responsavel_analise
  returning 1)
insert into tmp_recomposicao_responsavel select '36/2026', count(*) from u;
commit;

begin;
set local lock_timeout = '2s';
with u as (
  update public."TB_ANALISE_CURRICULAR" a
     set responsavel_analise = private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo)
   where a.edital = '37/2026'
     and a.responsavel_analise is not null
     and private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo) is distinct from a.responsavel_analise
  returning 1)
insert into tmp_recomposicao_responsavel select '37/2026', count(*) from u;
commit;

begin;
set local lock_timeout = '2s';
with u as (
  update public."TB_ANALISE_CURRICULAR" a
     set responsavel_analise = private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo)
   where a.edital = '38/2026'
     and a.responsavel_analise is not null
     and private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo) is distinct from a.responsavel_analise
  returning 1)
insert into tmp_recomposicao_responsavel select '38/2026', count(*) from u;
commit;

begin;
set local lock_timeout = '2s';
with u as (
  update public."TB_ANALISE_CURRICULAR" a
     set responsavel_analise = private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo)
   where a.edital = '39/2026'
     and a.responsavel_analise is not null
     and private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo) is distinct from a.responsavel_analise
  returning 1)
insert into tmp_recomposicao_responsavel select '39/2026', count(*) from u;
commit;

begin;
set local lock_timeout = '2s';
with u as (
  update public."TB_ANALISE_CURRICULAR" a
     set responsavel_analise = private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo)
   where a.edital = '41/2026'
     and a.responsavel_analise is not null
     and private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo) is distinct from a.responsavel_analise
  returning 1)
insert into tmp_recomposicao_responsavel select '41/2026', count(*) from u;
commit;

begin;
set local lock_timeout = '2s';
with u as (
  update public."TB_ANALISE_CURRICULAR" a
     set responsavel_analise = private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo)
   where a.edital = '43/2026'
     and a.responsavel_analise is not null
     and private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo) is distinct from a.responsavel_analise
  returning 1)
insert into tmp_recomposicao_responsavel select '43/2026', count(*) from u;
commit;

begin;
set local lock_timeout = '2s';
with u as (
  update public."TB_ANALISE_CURRICULAR" a
     set responsavel_analise = private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo)
   where a.edital = '44/2026'
     and a.responsavel_analise is not null
     and private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo) is distinct from a.responsavel_analise
  returning 1)
insert into tmp_recomposicao_responsavel select '44/2026', count(*) from u;
commit;

begin;
set local lock_timeout = '2s';
with u as (
  update public."TB_ANALISE_CURRICULAR" a
     set responsavel_analise = private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo)
   where a.edital = '46/2026'
     and a.responsavel_analise is not null
     and private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo) is distinct from a.responsavel_analise
  returning 1)
insert into tmp_recomposicao_responsavel select '46/2026', count(*) from u;
commit;

begin;
set local lock_timeout = '2s';
with u as (
  update public."TB_ANALISE_CURRICULAR" a
     set responsavel_analise = private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo)
   where a.edital = '47/2026'
     and a.responsavel_analise is not null
     and private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo) is distinct from a.responsavel_analise
  returning 1)
insert into tmp_recomposicao_responsavel select '47/2026', count(*) from u;
commit;

begin;
set local lock_timeout = '2s';
with u as (
  update public."TB_ANALISE_CURRICULAR" a
     set responsavel_analise = private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo)
   where a.edital = '48/2026'
     and a.responsavel_analise is not null
     and private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo) is distinct from a.responsavel_analise
  returning 1)
insert into tmp_recomposicao_responsavel select '48/2026', count(*) from u;
commit;

begin;
set local lock_timeout = '2s';
with u as (
  update public."TB_ANALISE_CURRICULAR" a
     set responsavel_analise = private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo)
   where a.edital = '49/2026'
     and a.responsavel_analise is not null
     and private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo) is distinct from a.responsavel_analise
  returning 1)
insert into tmp_recomposicao_responsavel select '49/2026', count(*) from u;
commit;

begin;
set local lock_timeout = '2s';
with u as (
  update public."TB_ANALISE_CURRICULAR" a
     set responsavel_analise = private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo)
   where a.edital = '50/2026'
     and a.responsavel_analise is not null
     and private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo) is distinct from a.responsavel_analise
  returning 1)
insert into tmp_recomposicao_responsavel select '50/2026', count(*) from u;
commit;

begin;
set local lock_timeout = '2s';
with u as (
  update public."TB_ANALISE_CURRICULAR" a
     set responsavel_analise = private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo)
   where a.edital = '51/2026'
     and a.responsavel_analise is not null
     and private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo) is distinct from a.responsavel_analise
  returning 1)
insert into tmp_recomposicao_responsavel select '51/2026', count(*) from u;
commit;

begin;
set local lock_timeout = '2s';
with u as (
  update public."TB_ANALISE_CURRICULAR" a
     set responsavel_analise = private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo)
   where a.edital = '57/2026'
     and a.responsavel_analise is not null
     and private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo) is distinct from a.responsavel_analise
  returning 1)
insert into tmp_recomposicao_responsavel select '57/2026', count(*) from u;
commit;

begin;
set local lock_timeout = '2s';
with u as (
  update public."TB_ANALISE_CURRICULAR" a
     set responsavel_analise = private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo)
   where a.edital = '58/2026'
     and a.responsavel_analise is not null
     and private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo) is distinct from a.responsavel_analise
  returning 1)
insert into tmp_recomposicao_responsavel select '58/2026', count(*) from u;
commit;

begin;
set local lock_timeout = '2s';
with u as (
  update public."TB_ANALISE_CURRICULAR" a
     set responsavel_analise = private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo)
   where a.edital = '59/2026'
     and a.responsavel_analise is not null
     and private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo) is distinct from a.responsavel_analise
  returning 1)
insert into tmp_recomposicao_responsavel select '59/2026', count(*) from u;
commit;

begin;
set local lock_timeout = '2s';
with u as (
  update public."TB_ANALISE_CURRICULAR" a
     set responsavel_analise = private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo)
   where a.edital = '60/2026'
     and a.responsavel_analise is not null
     and private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo) is distinct from a.responsavel_analise
  returning 1)
insert into tmp_recomposicao_responsavel select '60/2026', count(*) from u;
commit;

begin;
set local lock_timeout = '2s';
with u as (
  update public."TB_ANALISE_CURRICULAR" a
     set responsavel_analise = private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo)
   where a.edital = '63/2026'
     and a.responsavel_analise is not null
     and private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo) is distinct from a.responsavel_analise
  returning 1)
insert into tmp_recomposicao_responsavel select '63/2026', count(*) from u;
commit;

begin;
set local lock_timeout = '2s';
with u as (
  update public."TB_ANALISE_CURRICULAR" a
     set responsavel_analise = private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo)
   where a.edital = '64/2026'
     and a.responsavel_analise is not null
     and private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo) is distinct from a.responsavel_analise
  returning 1)
insert into tmp_recomposicao_responsavel select '64/2026', count(*) from u;
commit;

begin;
set local lock_timeout = '2s';
with u as (
  update public."TB_ANALISE_CURRICULAR" a
     set responsavel_analise = private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo)
   where a.edital = '65/2026'
     and a.responsavel_analise is not null
     and private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo) is distinct from a.responsavel_analise
  returning 1)
insert into tmp_recomposicao_responsavel select '65/2026', count(*) from u;
commit;

begin;
set local lock_timeout = '2s';
with u as (
  update public."TB_ANALISE_CURRICULAR" a
     set responsavel_analise = private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo)
   where a.edital = '66/2026'
     and a.responsavel_analise is not null
     and private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo) is distinct from a.responsavel_analise
  returning 1)
insert into tmp_recomposicao_responsavel select '66/2026', count(*) from u;
commit;

begin;
set local lock_timeout = '2s';
with u as (
  update public."TB_ANALISE_CURRICULAR" a
     set responsavel_analise = private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo)
   where a.edital = '67/2026'
     and a.responsavel_analise is not null
     and private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo) is distinct from a.responsavel_analise
  returning 1)
insert into tmp_recomposicao_responsavel select '67/2026', count(*) from u;
commit;

begin;
set local lock_timeout = '2s';
with u as (
  update public."TB_ANALISE_CURRICULAR" a
     set responsavel_analise = private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo)
   where a.edital = '69/2026'
     and a.responsavel_analise is not null
     and private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo) is distinct from a.responsavel_analise
  returning 1)
insert into tmp_recomposicao_responsavel select '69/2026', count(*) from u;
commit;

begin;
set local lock_timeout = '2s';
with u as (
  update public."TB_ANALISE_CURRICULAR" a
     set responsavel_analise = private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo)
   where a.edital = '70/2026'
     and a.responsavel_analise is not null
     and private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo) is distinct from a.responsavel_analise
  returning 1)
insert into tmp_recomposicao_responsavel select '70/2026', count(*) from u;
commit;

begin;
set local lock_timeout = '2s';
with u as (
  update public."TB_ANALISE_CURRICULAR" a
     set responsavel_analise = private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo)
   where a.edital = '72/2026'
     and a.responsavel_analise is not null
     and private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo) is distinct from a.responsavel_analise
  returning 1)
insert into tmp_recomposicao_responsavel select '72/2026', count(*) from u;
commit;

begin;
set local lock_timeout = '2s';
with u as (
  update public."TB_ANALISE_CURRICULAR" a
     set responsavel_analise = private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo)
   where a.edital = '74/2026'
     and a.responsavel_analise is not null
     and private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo) is distinct from a.responsavel_analise
  returning 1)
insert into tmp_recomposicao_responsavel select '74/2026', count(*) from u;
commit;

begin;
set local lock_timeout = '2s';
with u as (
  update public."TB_ANALISE_CURRICULAR" a
     set responsavel_analise = private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo)
   where a.edital = '75/2026'
     and a.responsavel_analise is not null
     and private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo) is distinct from a.responsavel_analise
  returning 1)
insert into tmp_recomposicao_responsavel select '75/2026', count(*) from u;
commit;

begin;
set local lock_timeout = '2s';
with u as (
  update public."TB_ANALISE_CURRICULAR" a
     set responsavel_analise = private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo)
   where a.edital = '76/2026'
     and a.responsavel_analise is not null
     and private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo) is distinct from a.responsavel_analise
  returning 1)
insert into tmp_recomposicao_responsavel select '76/2026', count(*) from u;
commit;

begin;
set local lock_timeout = '2s';
with u as (
  update public."TB_ANALISE_CURRICULAR" a
     set responsavel_analise = private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo)
   where a.edital = '79/2026'
     and a.responsavel_analise is not null
     and private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo) is distinct from a.responsavel_analise
  returning 1)
insert into tmp_recomposicao_responsavel select '79/2026', count(*) from u;
commit;

begin;
set local lock_timeout = '2s';
with u as (
  update public."TB_ANALISE_CURRICULAR" a
     set responsavel_analise = private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo)
   where a.edital = '81/2026'
     and a.responsavel_analise is not null
     and private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo) is distinct from a.responsavel_analise
  returning 1)
insert into tmp_recomposicao_responsavel select '81/2026', count(*) from u;
commit;

begin;
set local lock_timeout = '2s';
with u as (
  update public."TB_ANALISE_CURRICULAR" a
     set responsavel_analise = private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo)
   where a.edital = '82/2026'
     and a.responsavel_analise is not null
     and private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo) is distinct from a.responsavel_analise
  returning 1)
insert into tmp_recomposicao_responsavel select '82/2026', count(*) from u;
commit;

begin;
set local lock_timeout = '2s';
with u as (
  update public."TB_ANALISE_CURRICULAR" a
     set responsavel_analise = private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo)
   where a.edital = '83/2026'
     and a.responsavel_analise is not null
     and private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo) is distinct from a.responsavel_analise
  returning 1)
insert into tmp_recomposicao_responsavel select '83/2026', count(*) from u;
commit;

begin;
set local lock_timeout = '2s';
with u as (
  update public."TB_ANALISE_CURRICULAR" a
     set responsavel_analise = private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo)
   where a.edital = '88/2026'
     and a.responsavel_analise is not null
     and private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo) is distinct from a.responsavel_analise
  returning 1)
insert into tmp_recomposicao_responsavel select '88/2026', count(*) from u;
commit;

begin;
set local lock_timeout = '2s';
with u as (
  update public."TB_ANALISE_CURRICULAR" a
     set responsavel_analise = private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo)
   where a.edital = '91/2026'
     and a.responsavel_analise is not null
     and private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo) is distinct from a.responsavel_analise
  returning 1)
insert into tmp_recomposicao_responsavel select '91/2026', count(*) from u;
commit;

begin;
set local lock_timeout = '2s';
with u as (
  update public."TB_ANALISE_CURRICULAR" a
     set responsavel_analise = private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo)
   where a.edital = '92/2026'
     and a.responsavel_analise is not null
     and private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo) is distinct from a.responsavel_analise
  returning 1)
insert into tmp_recomposicao_responsavel select '92/2026', count(*) from u;
commit;

begin;
set local lock_timeout = '2s';
with u as (
  update public."TB_ANALISE_CURRICULAR" a
     set responsavel_analise = private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo)
   where a.edital = '93/2026'
     and a.responsavel_analise is not null
     and private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo) is distinct from a.responsavel_analise
  returning 1)
insert into tmp_recomposicao_responsavel select '93/2026', count(*) from u;
commit;

begin;
set local lock_timeout = '2s';
with u as (
  update public."TB_ANALISE_CURRICULAR" a
     set responsavel_analise = private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo)
   where a.edital = '94/2026'
     and a.responsavel_analise is not null
     and private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo) is distinct from a.responsavel_analise
  returning 1)
insert into tmp_recomposicao_responsavel select '94/2026', count(*) from u;
commit;

begin;
set local lock_timeout = '2s';
with u as (
  update public."TB_ANALISE_CURRICULAR" a
     set responsavel_analise = private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo)
   where a.edital = '95/2026'
     and a.responsavel_analise is not null
     and private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo) is distinct from a.responsavel_analise
  returning 1)
insert into tmp_recomposicao_responsavel select '95/2026', count(*) from u;
commit;

begin;
set local lock_timeout = '2s';
with u as (
  update public."TB_ANALISE_CURRICULAR" a
     set responsavel_analise = private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo)
   where a.edital = '97/2026'
     and a.responsavel_analise is not null
     and private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo) is distinct from a.responsavel_analise
  returning 1)
insert into tmp_recomposicao_responsavel select '97/2026', count(*) from u;
commit;

begin;
set local lock_timeout = '2s';
with u as (
  update public."TB_ANALISE_CURRICULAR" a
     set responsavel_analise = private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo)
   where a.edital = '100/2026'
     and a.responsavel_analise is not null
     and private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo) is distinct from a.responsavel_analise
  returning 1)
insert into tmp_recomposicao_responsavel select '100/2026', count(*) from u;
commit;

begin;
set local lock_timeout = '2s';
with u as (
  update public."TB_ANALISE_CURRICULAR" a
     set responsavel_analise = private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo)
   where a.edital = '101/2026'
     and a.responsavel_analise is not null
     and private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo) is distinct from a.responsavel_analise
  returning 1)
insert into tmp_recomposicao_responsavel select '101/2026', count(*) from u;
commit;

begin;
set local lock_timeout = '2s';
with u as (
  update public."TB_ANALISE_CURRICULAR" a
     set responsavel_analise = private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo)
   where a.edital = '102/2026'
     and a.responsavel_analise is not null
     and private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo) is distinct from a.responsavel_analise
  returning 1)
insert into tmp_recomposicao_responsavel select '102/2026', count(*) from u;
commit;

begin;
set local lock_timeout = '2s';
with u as (
  update public."TB_ANALISE_CURRICULAR" a
     set responsavel_analise = private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo)
   where a.edital = '103/2026'
     and a.responsavel_analise is not null
     and private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo) is distinct from a.responsavel_analise
  returning 1)
insert into tmp_recomposicao_responsavel select '103/2026', count(*) from u;
commit;

begin;
set local lock_timeout = '2s';
with u as (
  update public."TB_ANALISE_CURRICULAR" a
     set responsavel_analise = private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo)
   where a.edital = '105/2026'
     and a.responsavel_analise is not null
     and private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo) is distinct from a.responsavel_analise
  returning 1)
insert into tmp_recomposicao_responsavel select '105/2026', count(*) from u;
commit;

begin;
set local lock_timeout = '2s';
with u as (
  update public."TB_ANALISE_CURRICULAR" a
     set responsavel_analise = private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo)
   where a.edital = '107/2026'
     and a.responsavel_analise is not null
     and private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo) is distinct from a.responsavel_analise
  returning 1)
insert into tmp_recomposicao_responsavel select '107/2026', count(*) from u;
commit;

begin;
set local lock_timeout = '2s';
with u as (
  update public."TB_ANALISE_CURRICULAR" a
     set responsavel_analise = private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo)
   where a.edital = '108/2026'
     and a.responsavel_analise is not null
     and private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo) is distinct from a.responsavel_analise
  returning 1)
insert into tmp_recomposicao_responsavel select '108/2026', count(*) from u;
commit;

begin;
set local lock_timeout = '2s';
with u as (
  update public."TB_ANALISE_CURRICULAR" a
     set responsavel_analise = private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo)
   where a.edital = '109/2026'
     and a.responsavel_analise is not null
     and private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo) is distinct from a.responsavel_analise
  returning 1)
insert into tmp_recomposicao_responsavel select '109/2026', count(*) from u;
commit;

begin;
set local lock_timeout = '2s';
with u as (
  update public."TB_ANALISE_CURRICULAR" a
     set responsavel_analise = private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo)
   where a.edital = '110/2026'
     and a.responsavel_analise is not null
     and private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo) is distinct from a.responsavel_analise
  returning 1)
insert into tmp_recomposicao_responsavel select '110/2026', count(*) from u;
commit;

begin;
set local lock_timeout = '2s';
with u as (
  update public."TB_ANALISE_CURRICULAR" a
     set responsavel_analise = private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo)
   where a.edital = '111/2026'
     and a.responsavel_analise is not null
     and private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo) is distinct from a.responsavel_analise
  returning 1)
insert into tmp_recomposicao_responsavel select '111/2026', count(*) from u;
commit;

begin;
set local lock_timeout = '2s';
with u as (
  update public."TB_ANALISE_CURRICULAR" a
     set responsavel_analise = private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo)
   where a.edital = '112/2026'
     and a.responsavel_analise is not null
     and private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo) is distinct from a.responsavel_analise
  returning 1)
insert into tmp_recomposicao_responsavel select '112/2026', count(*) from u;
commit;

-- Relatório: linhas alteradas por edital.
select edital, alteradas from tmp_recomposicao_responsavel order by edital;
