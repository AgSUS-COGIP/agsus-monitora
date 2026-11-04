/*
  CORREÇÃO DE DADOS — apagar os editais de treinamento 991/2099 (Saúde
  Indígena) e 992/2099 (Projetos) e tudo ligado a eles (decisão do usuário em
  04/11/2026).
    d06a691d-a3f5-4494-b3e2-c01220d6050d  "Treinamento – Saúde Indígena (991/2099)"
    efbb0a48-d5c5-4792-9c06-ad4e4c6f3f80  "Treinamento – Projetos (992/2099)"
  Criados em 07/10/2026 pela migration 20261007230000_edital_de_treinamento.sql
  (private."FC_PREPARAR_EDITAL_TREINAMENTO").

  Dados fictícios (conferido em 04/11/2026): as 70 inscrições são "Candidato
  Teste NN"/"Candidato Teste PNN", e-mail @exemplo.invalid, telefone
  (00) 00000-0000, sem CPF, vagas 99099100NN/990992NNN sem robô (CO_SYNC nulo);
  as 46 análises têm origem 'treinamento' e os mesmos nomes; entrevistas,
  fichas e listas de classificação só citam esses candidatos. O que é real são
  os vínculos de usuários do sistema (analistas, avaliadores da banca e quem
  editou), que saem junto com o edital. A correção para se achar inscrição sem
  a marca fictícia.

  O que apaga (levantado em 04/11/2026 pelo catálogo — chaves estrangeiras
  recursivas a partir de TB_MONITORAMENTO_INDIGENA e varredura dos ids e dos
  números 991/2099, 992/2099 e das vagas em todas as tabelas de public, private,
  arquivo e storage, inclusive colunas sem chave estrangeira, TH_/TL_/TM_/TA_ e
  JSON), 991 + 992:
    TH_FICHA_ANALISE 24+105 · TB_ENTREVISTA_AVALIACAO_ASPECTO 72+0 ·
    TB_PRE_CLASSIFICACAO 30+40 · TH_PRE_CLASSIFICACAO 30+40 ·
    TB_EMPREGARE_CANDIDATO 30+40 · TH_ENTREVISTA_AVALIACAO 46+21 ·
    TB_ANALISE_CURRICULAR 25+21 · TB_FICHA_ANALISE 24+21 ·
    TB_AGENDA_ENTREVISTA 15+21 · TB_ENTREVISTA 15+21 · TH_MONITORAMENTO 12+16 ·
    TB_CRONOGRAMA_MONIT_INDIG 12+14 · TB_ENTREVISTA_AVALIACAO 24+0 ·
    TB_ENTREVISTA_NOTA 12+0 · TL_ACESSO_FICHA_ANALISE 2+6 ·
    TB_EMPREGARE_VAGA 3+5 · TB_ENTREVISTA_VAGA 3+5 · TB_PRE_CLASSIF_VAGA 3+5 ·
    TB_QUADRO_VAGA_EDITAL 3+5 · TB_ENTREVISTA_AVALIADOR 2+3 ·
    TB_LISTA_CLASSIFICACAO 1+3 · RL_ANALISTA_EDITAL 0+2 ·
    TB_ENTREVISTA_AVALIADOR_COMPETENCIA 0+1 · TB_ENTREVISTA_LIBERACAO 0+1 ·
    1+1 em TB_/TH_REGRA_AGENDA_ENTREVISTA, TH_AGENDA_ENTREVISTA,
    TB_/TH_REGRA_CLASSIFICACAO, TB_/TH_REGRA_ANALISE, TB_ORIGEM_ANALISE_EDITAL,
    TB_/TH_REGRA_TRIAGEM, TL_PRE_CLASSIFICACAO, TB_RESUMO_PERGUNTA_EDITAL,
    TB_ENTREVISTA_EDITAL e TB_MONITORAMENTO_INDIGENA  (total 812).
  As outras tabelas da lista (95 ao todo) são conferidas e têm de estar vazias.

  O que FICA, de propósito: os dois roteiros de exemplo (TB_ROTEIRO_ENTREVISTA
  932f1038-… "Treinamento — Entrevista individual (exemplo)" e 84994638-…
  "Treinamento — Entrevista Projetos (exemplo)", com competências, aspectos e
  níveis): o de Projetos também é o roteiro do edital 114/2026, e roteiro é
  modelo, sem dado de candidato. As funções do treinamento
  (FC_PREPARAR_EDITAL_TREINAMENTO, reiniciar_edital_treinamento…) também ficam:
  sem edital de treinamento, o botão "Reiniciar treinamento" não aparece e a
  RPC responde "Edital não encontrado". Nenhum arquivo no Storage.

  Como (uma transação; a mesma máquina da correção do edital "Teste"):
    1. confere a conta do setor (administrador global ativo, auth.uid()), que
       os editais são exatamente esses dois, com ST_TREINAMENTO = 'S', sem vaga
       do robô, sem inscrição real, sem demanda interna nem conversa ligada;
    2. mede ANTES: as chaves (pela chave primária) de toda linha ligada, em 95
       tabelas, e o total de cada tabela;
    3. reprova se o medido não for exatamente o esperado acima (o banco mudou);
    4. apaga pelas chaves medidas, filhos antes dos pais, edital por edital,
       com a marca agsus.reinicio_treinamento (a do reinício do treinamento,
       que libera os gatilhos de imutabilidade só para o edital de treinamento
       da vez); os 3 gatilhos da Triagem, que não têm essa liberação
       (TG_REGRATRIAGEM_SEMAPAGAR, TG_THREGRATRIAGEM_IMUTAVEL,
       TG_TLPRECLASSIF_SEMAPAGAR), ficam desligados só dentro da transação;
    5. marca os caches da Saúde Indígena e de Projetos (FC_MARCAR_CACHE; os
       gatilhos de versão de fonte já marcam as leituras);
    6. reprova (raise → nada fica) se sobrar linha ligada, se alguma tabela
       ainda citar um dos ids no texto, se o total de alguma tabela cair mais
       ou menos que o apagado (nada fora dos editais) ou se um gatilho da
       Triagem não voltar.

  Assinada pela conta do setor Gestão da Informação de Pessoal
  (a01afddb-f64b-47d9-80e8-476a1ed14e43). Rode no SQL Editor (papel postgres)
  SÓ COM A AUTORIZAÇÃO do usuário. NÃO é idempotente de propósito: rodada de
  novo, para no passo 1 ("não existe") sem apagar nada. Depois de aplicar:
    npm run db:estado -- --registrar=correcoes/20261104-apagar-editais-de-treinamento.sql
  Ensaio (begin … rollback): supabase/ensaios/20261104-apagar-editais-de-treinamento.sql
  Não tem volta: para ter treinamento de novo seria preciso recriar os
  editais (a preparação exige a linha do edital; ver docs/banco-de-dados.md).
*/
begin;

-- >>> correcao
set local lock_timeout = '3s';

-- A autoria desta transação: auth.uid() = conta do setor (gatilhos de cache e de versão).
select set_config('request.jwt.claims',
  '{"sub":"a01afddb-f64b-47d9-80e8-476a1ed14e43","role":"authenticated"}', true);

-- Os editais desta correção (id, nome exato, área). Nenhum outro é tocado.
create temporary table tmp_editais (
  id uuid primary key,
  edital text not null,
  area text not null
) on commit drop;
insert into tmp_editais (id, edital, area) values
  ('d06a691d-a3f5-4494-b3e2-c01220d6050d', 'Treinamento – Saúde Indígena (991/2099)', 'saude-indigena'),
  ('efbb0a48-d5c5-4792-9c06-ad4e4c6f3f80', 'Treinamento – Projetos (992/2099)', 'projetos');

-- O que se espera apagar, por tabela e edital (levantado em 04/11/2026). A
-- tabela que não está aqui espera 0. Se o banco mudou, a correção para.
create temporary table tmp_esperado (
  tabela text not null,
  edital uuid not null,
  qt integer not null,
  primary key (tabela, edital)
) on commit drop;
insert into tmp_esperado (tabela, edital, qt) values
  ('public."TB_AGENDA_ENTREVISTA"', 'd06a691d-a3f5-4494-b3e2-c01220d6050d', 15),
  ('public."TH_AGENDA_ENTREVISTA"', 'd06a691d-a3f5-4494-b3e2-c01220d6050d', 1),
  ('public."TH_REGRA_AGENDA_ENTREVISTA"', 'd06a691d-a3f5-4494-b3e2-c01220d6050d', 1),
  ('public."TB_REGRA_AGENDA_ENTREVISTA"', 'd06a691d-a3f5-4494-b3e2-c01220d6050d', 1),
  ('public."TB_ENTREVISTA_AVALIACAO_ASPECTO"', 'd06a691d-a3f5-4494-b3e2-c01220d6050d', 72),
  ('public."TB_ENTREVISTA_AVALIACAO"', 'd06a691d-a3f5-4494-b3e2-c01220d6050d', 24),
  ('public."TB_ENTREVISTA_NOTA"', 'd06a691d-a3f5-4494-b3e2-c01220d6050d', 12),
  ('public."TH_ENTREVISTA_AVALIACAO"', 'd06a691d-a3f5-4494-b3e2-c01220d6050d', 46),
  ('public."TB_ENTREVISTA"', 'd06a691d-a3f5-4494-b3e2-c01220d6050d', 15),
  ('public."TB_ENTREVISTA_AVALIADOR"', 'd06a691d-a3f5-4494-b3e2-c01220d6050d', 2),
  ('public."TB_ENTREVISTA_EDITAL"', 'd06a691d-a3f5-4494-b3e2-c01220d6050d', 1),
  ('public."TB_ENTREVISTA_VAGA"', 'd06a691d-a3f5-4494-b3e2-c01220d6050d', 3),
  ('public."TB_LISTA_CLASSIFICACAO"', 'd06a691d-a3f5-4494-b3e2-c01220d6050d', 1),
  ('public."TH_REGRA_CLASSIFICACAO"', 'd06a691d-a3f5-4494-b3e2-c01220d6050d', 1),
  ('public."TB_REGRA_CLASSIFICACAO"', 'd06a691d-a3f5-4494-b3e2-c01220d6050d', 1),
  ('public."TL_ACESSO_FICHA_ANALISE"', 'd06a691d-a3f5-4494-b3e2-c01220d6050d', 2),
  ('public."TH_FICHA_ANALISE"', 'd06a691d-a3f5-4494-b3e2-c01220d6050d', 24),
  ('public."TB_FICHA_ANALISE"', 'd06a691d-a3f5-4494-b3e2-c01220d6050d', 24),
  ('public."TH_PRE_CLASSIFICACAO"', 'd06a691d-a3f5-4494-b3e2-c01220d6050d', 30),
  ('public."TB_PRE_CLASSIFICACAO"', 'd06a691d-a3f5-4494-b3e2-c01220d6050d', 30),
  ('public."TB_PRE_CLASSIF_VAGA"', 'd06a691d-a3f5-4494-b3e2-c01220d6050d', 3),
  ('public."TH_REGRA_ANALISE"', 'd06a691d-a3f5-4494-b3e2-c01220d6050d', 1),
  ('public."TB_REGRA_ANALISE"', 'd06a691d-a3f5-4494-b3e2-c01220d6050d', 1),
  ('public."TB_ORIGEM_ANALISE_EDITAL"', 'd06a691d-a3f5-4494-b3e2-c01220d6050d', 1),
  ('public."TH_REGRA_TRIAGEM"', 'd06a691d-a3f5-4494-b3e2-c01220d6050d', 1),
  ('public."TB_REGRA_TRIAGEM"', 'd06a691d-a3f5-4494-b3e2-c01220d6050d', 1),
  ('public."TL_PRE_CLASSIFICACAO"', 'd06a691d-a3f5-4494-b3e2-c01220d6050d', 1),
  ('public."TB_RESUMO_PERGUNTA_EDITAL"', 'd06a691d-a3f5-4494-b3e2-c01220d6050d', 1),
  ('public."TB_ANALISE_CURRICULAR"', 'd06a691d-a3f5-4494-b3e2-c01220d6050d', 25),
  ('public."TB_EMPREGARE_CANDIDATO"', 'd06a691d-a3f5-4494-b3e2-c01220d6050d', 30),
  ('public."TB_EMPREGARE_VAGA"', 'd06a691d-a3f5-4494-b3e2-c01220d6050d', 3),
  ('public."TB_QUADRO_VAGA_EDITAL"', 'd06a691d-a3f5-4494-b3e2-c01220d6050d', 3),
  ('public."TB_CRONOGRAMA_MONIT_INDIG"', 'd06a691d-a3f5-4494-b3e2-c01220d6050d', 12),
  ('public."TH_MONITORAMENTO"', 'd06a691d-a3f5-4494-b3e2-c01220d6050d', 12),
  ('public."TB_MONITORAMENTO_INDIGENA"', 'd06a691d-a3f5-4494-b3e2-c01220d6050d', 1),
  ('public."TB_AGENDA_ENTREVISTA"', 'efbb0a48-d5c5-4792-9c06-ad4e4c6f3f80', 21),
  ('public."TH_AGENDA_ENTREVISTA"', 'efbb0a48-d5c5-4792-9c06-ad4e4c6f3f80', 1),
  ('public."TH_REGRA_AGENDA_ENTREVISTA"', 'efbb0a48-d5c5-4792-9c06-ad4e4c6f3f80', 1),
  ('public."TB_REGRA_AGENDA_ENTREVISTA"', 'efbb0a48-d5c5-4792-9c06-ad4e4c6f3f80', 1),
  ('public."TH_ENTREVISTA_AVALIACAO"', 'efbb0a48-d5c5-4792-9c06-ad4e4c6f3f80', 21),
  ('public."TB_ENTREVISTA"', 'efbb0a48-d5c5-4792-9c06-ad4e4c6f3f80', 21),
  ('public."TB_ENTREVISTA_AVALIADOR_COMPETENCIA"', 'efbb0a48-d5c5-4792-9c06-ad4e4c6f3f80', 1),
  ('public."TB_ENTREVISTA_AVALIADOR"', 'efbb0a48-d5c5-4792-9c06-ad4e4c6f3f80', 3),
  ('public."TB_ENTREVISTA_EDITAL"', 'efbb0a48-d5c5-4792-9c06-ad4e4c6f3f80', 1),
  ('public."TB_ENTREVISTA_VAGA"', 'efbb0a48-d5c5-4792-9c06-ad4e4c6f3f80', 5),
  ('public."TB_ENTREVISTA_LIBERACAO"', 'efbb0a48-d5c5-4792-9c06-ad4e4c6f3f80', 1),
  ('public."TB_LISTA_CLASSIFICACAO"', 'efbb0a48-d5c5-4792-9c06-ad4e4c6f3f80', 3),
  ('public."TH_REGRA_CLASSIFICACAO"', 'efbb0a48-d5c5-4792-9c06-ad4e4c6f3f80', 1),
  ('public."TB_REGRA_CLASSIFICACAO"', 'efbb0a48-d5c5-4792-9c06-ad4e4c6f3f80', 1),
  ('public."TL_ACESSO_FICHA_ANALISE"', 'efbb0a48-d5c5-4792-9c06-ad4e4c6f3f80', 6),
  ('public."TH_FICHA_ANALISE"', 'efbb0a48-d5c5-4792-9c06-ad4e4c6f3f80', 105),
  ('public."TB_FICHA_ANALISE"', 'efbb0a48-d5c5-4792-9c06-ad4e4c6f3f80', 21),
  ('public."TH_PRE_CLASSIFICACAO"', 'efbb0a48-d5c5-4792-9c06-ad4e4c6f3f80', 40),
  ('public."TB_PRE_CLASSIFICACAO"', 'efbb0a48-d5c5-4792-9c06-ad4e4c6f3f80', 40),
  ('public."TB_PRE_CLASSIF_VAGA"', 'efbb0a48-d5c5-4792-9c06-ad4e4c6f3f80', 5),
  ('public."RL_ANALISTA_EDITAL"', 'efbb0a48-d5c5-4792-9c06-ad4e4c6f3f80', 2),
  ('public."TH_REGRA_ANALISE"', 'efbb0a48-d5c5-4792-9c06-ad4e4c6f3f80', 1),
  ('public."TB_REGRA_ANALISE"', 'efbb0a48-d5c5-4792-9c06-ad4e4c6f3f80', 1),
  ('public."TB_ORIGEM_ANALISE_EDITAL"', 'efbb0a48-d5c5-4792-9c06-ad4e4c6f3f80', 1),
  ('public."TH_REGRA_TRIAGEM"', 'efbb0a48-d5c5-4792-9c06-ad4e4c6f3f80', 1),
  ('public."TB_REGRA_TRIAGEM"', 'efbb0a48-d5c5-4792-9c06-ad4e4c6f3f80', 1),
  ('public."TL_PRE_CLASSIFICACAO"', 'efbb0a48-d5c5-4792-9c06-ad4e4c6f3f80', 1),
  ('public."TB_RESUMO_PERGUNTA_EDITAL"', 'efbb0a48-d5c5-4792-9c06-ad4e4c6f3f80', 1),
  ('public."TB_ANALISE_CURRICULAR"', 'efbb0a48-d5c5-4792-9c06-ad4e4c6f3f80', 21),
  ('public."TB_EMPREGARE_CANDIDATO"', 'efbb0a48-d5c5-4792-9c06-ad4e4c6f3f80', 40),
  ('public."TB_EMPREGARE_VAGA"', 'efbb0a48-d5c5-4792-9c06-ad4e4c6f3f80', 5),
  ('public."TB_QUADRO_VAGA_EDITAL"', 'efbb0a48-d5c5-4792-9c06-ad4e4c6f3f80', 5),
  ('public."TB_CRONOGRAMA_MONIT_INDIG"', 'efbb0a48-d5c5-4792-9c06-ad4e4c6f3f80', 14),
  ('public."TH_MONITORAMENTO"', 'efbb0a48-d5c5-4792-9c06-ad4e4c6f3f80', 16),
  ('public."TB_MONITORAMENTO_INDIGENA"', 'efbb0a48-d5c5-4792-9c06-ad4e4c6f3f80', 1);

-- Os conjuntos de chaves ligados a cada edital, medidos ANTES de apagar ($1 = edital).
create temporary table tmp_def_conjunto (nome text primary key, consulta text not null) on commit drop;
insert into tmp_def_conjunto (nome, consulta) values
  ('LISTAS', $q$select l.id::text from public."TB_LISTA_APROVADO" l where l.edital_id = $1::text$q$),
  ('CANDIDATOS', $q$select c.id::text from public."TB_CANDIDATO_APROVADO" c join public."TB_LISTA_APROVADO" l on l.id = c.lista_id where l.edital_id = $1::text$q$),
  ('MODELOS_CARTA', $q$select m."CO_MODELO_CARTA"::text from public."TB_MODELO_CARTA_CONVOCACAO" m where m."CO_MONITORAMENTO" = $1$q$),
  ('CARTAS', $q$select h."CO_CARTA_CONVOCACAO"::text from public."TH_CARTA_CONVOCACAO" h join public."TB_MODELO_CARTA_CONVOCACAO" m on m."CO_MODELO_CARTA" = h."CO_MODELO_CARTA" where m."CO_MONITORAMENTO" = $1$q$),
  ('PENDENCIAS', $q$select p."CO_PENDENCIA_APROVADO"::text from public."TB_PENDENCIA_APROVADO" p where p."CO_MONITORAMENTO" = $1$q$),
  ('LISTAS_CLASSIFICACAO', $q$select k."CO_LISTA_CLASSIFICACAO"::text from public."TB_LISTA_CLASSIFICACAO" k where k."CO_MONITORAMENTO" = $1$q$),
  ('ANALISES', $q$select a.id::text from public."TB_ANALISE_CURRICULAR" a join public."TB_MONITORAMENTO_INDIGENA" m on m.id = $1 where private."FC_ANALISE_EH_TREINAMENTO"(a.origem_planilha) and a."CO_AREA" = m."CO_AREA" and private."FC_NUMERO_EDITAL"(a.edital) = private."FC_NUMERO_EDITAL"(m.edital)$q$),
  ('RECURSOS', $q$select r."CO_RECURSO_CANDIDATO"::text from public."TB_RECURSO_CANDIDATO" r where r."CO_MONITORAMENTO" = $1$q$),
  ('RESPOSTAS_RECURSO', $q$select s."CO_RESPOSTA_RECURSO"::text from public."TB_RESPOSTA_RECURSO" s join public."TB_RECURSO_CANDIDATO" r on r."CO_RECURSO_CANDIDATO" = s."CO_RECURSO_CANDIDATO" where r."CO_MONITORAMENTO" = $1$q$),
  ('ANEXOS_RECURSO', $q$select a."CO_ANEXO_RECURSO"::text from public."TB_ANEXO_RECURSO" a join public."TB_RECURSO_CANDIDATO" r on r."CO_RECURSO_CANDIDATO" = a."CO_RECURSO_CANDIDATO" where r."CO_MONITORAMENTO" = $1$q$),
  ('AJUSTES', $q$select j."CO_AJUSTE_PONTUACAO"::text from public."TB_AJUSTE_PONTUACAO_RECURSO" j where j."CO_MONITORAMENTO" = $1$q$),
  ('REGRAS_AGENDA', $q$select r."CO_REGRA_AGENDA"::text from public."TB_REGRA_AGENDA_ENTREVISTA" r where r."CO_MONITORAMENTO" = $1$q$),
  ('ENTREVISTAS', $q$select e."CO_ENTREVISTA"::text from public."TB_ENTREVISTA" e where e."CO_MONITORAMENTO" = $1$q$),
  ('AVALIADORES', $q$select v."CO_AVALIADOR"::text from public."TB_ENTREVISTA_AVALIADOR" v where v."CO_MONITORAMENTO" = $1$q$),
  ('REGRAS_CLASSIFICACAO', $q$select r."CO_REGRA_CLASSIFICACAO"::text from public."TB_REGRA_CLASSIFICACAO" r where r."CO_MONITORAMENTO" = $1$q$),
  ('FICHAS', $q$select f."CO_FICHA_ANALISE"::text from public."TB_FICHA_ANALISE" f where f."CO_MONITORAMENTO" = $1$q$),
  ('DECISOES', $q$select d."CO_DECISAO_LOTE"::text from public."TB_DECISAO_LOTE" d where d."CO_MONITORAMENTO" = $1$q$),
  ('REGRAS_ANALISE', $q$select r."CO_REGRA_ANALISE"::text from public."TB_REGRA_ANALISE" r where r."CO_MONITORAMENTO" = $1$q$),
  ('REGRAS_TRIAGEM', $q$select r."CO_REGRA_TRIAGEM"::text from public."TB_REGRA_TRIAGEM" r where r."CO_MONITORAMENTO" = $1$q$),
  ('EXECUCOES_TRIAGEM', $q$select t."CO_EXECUCAO" from public."TL_PRE_CLASSIFICACAO" t where t."CO_EXECUCAO" = 'treinamento-' || $1::text or t."DS_EDITAL" @> jsonb_build_array(jsonb_build_object('edital', $1::text))$q$),
  ('PEDIDOS_REINICIO', $q$select p."CO_PEDIDO_REINICIO"::text from public."TB_PEDIDO_REINICIO_FICHA" p where p."CO_MONITORAMENTO" = $1$q$),
  ('VAGAS_EMPREGARE', $q$select v."CO_VAGA" from public."TB_EMPREGARE_VAGA" v where v."CO_MONITORAMENTO" = $1$q$),
  ('INSCRICOES', $q$select c."CO_EMPREGARE_CANDIDATO"::text from public."TB_EMPREGARE_CANDIDATO" c join public."TB_EMPREGARE_VAGA" v on v."CO_VAGA" = c."CO_VAGA" where v."CO_MONITORAMENTO" = $1$q$),
  ('RESPOSTAS_EMPREGARE', $q$select r."CO_EMPREGARE_RESPOSTA"::text from public."TB_EMPREGARE_RESPOSTA" r join public."TB_EMPREGARE_CANDIDATO" c on c."CO_EMPREGARE_CANDIDATO" = r."CO_EMPREGARE_CANDIDATO" join public."TB_EMPREGARE_VAGA" v on v."CO_VAGA" = c."CO_VAGA" where v."CO_MONITORAMENTO" = $1$q$),
  ('AVISOS', $q$select a."CO_AVISO_CONFERENCIA"::text from public."TB_AVISO_CONFERENCIA" a where a."CO_MONITORAMENTO" = $1$q$),
  ('MODELOS_ESPELHO', $q$select m."CO_MODELO_ESPELHO_NOTA"::text from public."TB_MODELO_ESPELHO_NOTA" m where m."CO_MONITORAMENTO" = $1$q$);

-- As tabelas, na ordem de exclusão (filhos antes dos pais; nenhuma cascata
-- apaga linha que não esteja na lista). x = a linha; $1 = o edital;
-- {CONJUNTO} = as chaves (text) medidas antes.
create temporary table tmp_alvo (
  ordem integer primary key,
  tabela text not null unique,
  filtro text not null
) on commit drop;
insert into tmp_alvo (ordem, tabela, filtro) values
  -- Lista de aprovados, cartas, contratação, pendências, publicações, vagas imediatas, convocação.
  (10, 'public."RL_CARTA_CANDIDATO"', $f$x."CO_MONITORAMENTO" = $1 or x."CO_CANDIDATO_APROVADO"::text in {CANDIDATOS} or x."CO_CARTA_CONVOCACAO"::text in {CARTAS}$f$),
  (20, 'public."TH_CANDIDATO_APROVADO"', $f$x.lista_id::text in {LISTAS} or x.candidato_id::text in {CANDIDATOS} or x."CO_CARTA_CONVOCACAO"::text in {CARTAS}$f$),
  (30, 'public."TH_CARTA_CONVOCACAO"', $f$x."CO_MODELO_CARTA"::text in {MODELOS_CARTA}$f$),
  (40, 'public."TH_MODELO_CARTA_CONVOCACAO"', $f$x."CO_MODELO_CARTA"::text in {MODELOS_CARTA}$f$),
  (50, 'public."TB_MODELO_CARTA_CONVOCACAO"', $f$x."CO_MONITORAMENTO" = $1$f$),
  (60, 'public."TH_CANDIDATO_SUB_JUDICE"', $f$x."CO_LISTA"::text in {LISTAS} or x."CO_CANDIDATO"::text in {CANDIDATOS}$f$),
  (70, 'public."TB_ANEXO_CANDIDATO_APROVADO"', $f$x."CO_CANDIDATO"::text in {CANDIDATOS}$f$),
  (80, 'public."TB_CONTRATACAO_APROVADO"', $f$x."CO_MONITORAMENTO" = $1 or x."CO_CANDIDATO_APROVADO"::text in {CANDIDATOS} or x."CO_CANDIDATO_CONTRATACAO"::text in {CANDIDATOS}$f$),
  (90, 'public."TH_PENDENCIA_APROVADO"', $f$x."CO_PENDENCIA_APROVADO"::text in {PENDENCIAS}$f$),
  (100, 'public."TB_PENDENCIA_APROVADO"', $f$x."CO_MONITORAMENTO" = $1 or x."CO_CANDIDATO_APROVADO"::text in {CANDIDATOS}$f$),
  (110, 'public."TH_PUBLICACAO_APROVADO"', $f$x."CO_MONITORAMENTO" = $1 or x."CO_LISTA_APROVADO"::text in {LISTAS} or x."CO_LISTA_APROVADO_ANTERIOR"::text in {LISTAS} or x."CO_LISTA_CLASSIFICACAO"::text in {LISTAS_CLASSIFICACAO}$f$),
  (120, 'public."TB_PEDIDO_CASAMENTO_LISTA"', $f$x."CO_MONITORAMENTO" = $1 or x."CO_LISTA_APROVADO"::text in {LISTAS} or x."CO_LISTA_APROVADO_ANTERIOR"::text in {LISTAS} or x."CO_LISTA_CLASSIFICACAO"::text in {LISTAS_CLASSIFICACAO}$f$),
  (130, 'public."TB_CANDIDATO_APROVADO"', $f$x.lista_id::text in {LISTAS}$f$),
  (140, 'public."TB_LISTA_APROVADO"', $f$x.edital_id = $1::text or x."CO_LISTA_CLASSIFICACAO"::text in {LISTAS_CLASSIFICACAO}$f$),
  (150, 'public."TB_VAGA_IMEDIATA"', $f$x."CO_EDITAL" = $1::text$f$),
  (160, 'public."TB_CONVOCACAO_EDITAL"', $f$x."CO_EDITAL" = $1::text$f$),
  -- Recursos.
  (200, 'public."TH_ANEXO_RECURSO"', $f$x."CO_ANEXO_RECURSO"::text in {ANEXOS_RECURSO}$f$),
  (210, 'public."TB_ANEXO_RECURSO"', $f$x."CO_RECURSO_CANDIDATO"::text in {RECURSOS} or x."CO_RESPOSTA_RECURSO"::text in {RESPOSTAS_RECURSO}$f$),
  (220, 'public."TH_RESPOSTA_RECURSO"', $f$x."CO_RESPOSTA_RECURSO"::text in {RESPOSTAS_RECURSO}$f$),
  (230, 'public."TB_RESPOSTA_RECURSO"', $f$x."CO_RECURSO_CANDIDATO"::text in {RECURSOS}$f$),
  (240, 'public."TB_ITEM_AJUSTE_PONTUACAO"', $f$x."CO_AJUSTE_PONTUACAO"::text in {AJUSTES}$f$),
  (250, 'public."TB_AJUSTE_PONTUACAO_RECURSO"', $f$x."CO_MONITORAMENTO" = $1 or x."CO_RECURSO_CANDIDATO"::text in {RECURSOS} or x."CO_ANALISE_CURRICULAR"::text in {ANALISES}$f$),
  (260, 'public."TH_RECURSO_CANDIDATO"', $f$x."CO_RECURSO_CANDIDATO"::text in {RECURSOS}$f$),
  (270, 'public."TB_RECURSO_CANDIDATO"', $f$x."CO_MONITORAMENTO" = $1 or x."CO_ANALISE_CURRICULAR"::text in {ANALISES}$f$),
  -- Entrevistas e agenda.
  (300, 'public."TB_AGENDA_ENTREVISTA"', $f$x."CO_MONITORAMENTO" = $1 or x."CO_LISTA_CLASSIFICACAO"::text in {LISTAS_CLASSIFICACAO} or x."CO_ANALISE_CURRICULAR"::text in {ANALISES}$f$),
  (310, 'public."TH_AGENDA_ENTREVISTA"', $f$x."CO_MONITORAMENTO" = $1 or x."CO_LISTA_CLASSIFICACAO"::text in {LISTAS_CLASSIFICACAO}$f$),
  (320, 'public."TH_REGRA_AGENDA_ENTREVISTA"', $f$x."CO_REGRA_AGENDA"::text in {REGRAS_AGENDA}$f$),
  (330, 'public."TB_REGRA_AGENDA_ENTREVISTA"', $f$x."CO_MONITORAMENTO" = $1$f$),
  (340, 'public."TB_ENTREVISTA_AVALIACAO_ASPECTO"', $f$x."CO_ENTREVISTA"::text in {ENTREVISTAS} or x."CO_AVALIADOR"::text in {AVALIADORES}$f$),
  (350, 'public."TB_ENTREVISTA_AVALIACAO"', $f$x."CO_ENTREVISTA"::text in {ENTREVISTAS} or x."CO_AVALIADOR"::text in {AVALIADORES}$f$),
  (360, 'public."TB_ENTREVISTA_NOTA"', $f$x."CO_ENTREVISTA"::text in {ENTREVISTAS}$f$),
  (370, 'public."TH_ENTREVISTA_AVALIACAO"', $f$x."CO_ENTREVISTA"::text in {ENTREVISTAS} or x."CO_AVALIADOR"::text in {AVALIADORES}$f$),
  (380, 'public."TB_ENTREVISTA_OBSERVACAO_AVALIADOR"', $f$x."CO_ENTREVISTA"::text in {ENTREVISTAS} or x."CO_AVALIADOR"::text in {AVALIADORES}$f$),
  (390, 'public."TB_ENTREVISTA"', $f$x."CO_MONITORAMENTO" = $1 or x."CO_ANALISE_CURRICULAR"::text in {ANALISES}$f$),
  (400, 'public."TB_ENTREVISTA_AVALIADOR_COMPETENCIA"', $f$x."CO_AVALIADOR"::text in {AVALIADORES}$f$),
  (410, 'public."TB_ENTREVISTA_AVALIADOR"', $f$x."CO_MONITORAMENTO" = $1$f$),
  (420, 'public."TB_ENTREVISTA_EDITAL"', $f$x."CO_MONITORAMENTO" = $1$f$),
  (430, 'public."TB_ENTREVISTA_VAGA"', $f$x."CO_MONITORAMENTO" = $1$f$),
  (440, 'public."TB_ENTREVISTA_LIBERACAO"', $f$x."CO_MONITORAMENTO" = $1$f$),
  (450, 'public."TH_PREVISAO_ENTREVISTA_EDITAL"', $f$x."CO_MONITORAMENTO" = $1$f$),
  (460, 'public."TB_PREVISAO_ENTREVISTA_EDITAL"', $f$x."CO_MONITORAMENTO" = $1$f$),
  -- Classificação.
  (500, 'public."TB_DESEMPATE_CLASSIFICACAO"', $f$x."CO_MONITORAMENTO" = $1$f$),
  (510, 'public."TB_PEDIDO_CALCULO_CLASSIFICACAO"', $f$x."CO_MONITORAMENTO" = $1 or x."CO_LISTA_CLASSIFICACAO"::text in {LISTAS_CLASSIFICACAO}$f$),
  (520, 'public."TB_PREPARO_DESEMPATE"', $f$x."CO_LISTA_CLASSIFICACAO"::text in {LISTAS_CLASSIFICACAO}$f$),
  (530, 'public."TB_RELATORIO_DESEMPATE"', $f$x."CO_LISTA_CLASSIFICACAO"::text in {LISTAS_CLASSIFICACAO}$f$),
  (540, 'public."TB_LISTA_CLASSIFICACAO"', $f$x."CO_MONITORAMENTO" = $1$f$),
  (550, 'public."RL_REGRA_CRITERIO_DESEMPATE"', $f$x."CO_REGRA_CLASSIFICACAO"::text in {REGRAS_CLASSIFICACAO}$f$),
  (560, 'public."TH_REGRA_CLASSIFICACAO"', $f$x."CO_REGRA_CLASSIFICACAO"::text in {REGRAS_CLASSIFICACAO}$f$),
  (570, 'public."TB_REGRA_CLASSIFICACAO"', $f$x."CO_MONITORAMENTO" = $1$f$),
  -- Avaliação documental e Triagem.
  (600, 'public."TL_ACESSO_FICHA_ANALISE"', $f$x."CO_FICHA_ANALISE"::text in {FICHAS}$f$),
  (610, 'public."TH_FICHA_ANALISE"', $f$x."CO_FICHA_ANALISE"::text in {FICHAS}$f$),
  (620, 'public."TB_FICHA_ANALISE"', $f$x."CO_MONITORAMENTO" = $1$f$),
  (630, 'public."TH_DECISAO_LOTE"', $f$x."CO_DECISAO_LOTE"::text in {DECISOES}$f$),
  (640, 'public."TB_DECISAO_LOTE"', $f$x."CO_MONITORAMENTO" = $1$f$),
  (650, 'public."TB_SUGESTAO_FICHA"', $f$x."CO_MONITORAMENTO" = $1 or x."CO_EMPREGARE_CANDIDATO"::text in {INSCRICOES} or x."CO_EXECUCAO" in {EXECUCOES_TRIAGEM}$f$),
  (660, 'public."TH_PRE_CLASSIFICACAO"', $f$x."CO_MONITORAMENTO" = $1 or x."CO_EMPREGARE_CANDIDATO"::text in {INSCRICOES} or x."CO_EXECUCAO" in {EXECUCOES_TRIAGEM}$f$),
  (670, 'public."TB_PRE_CLASSIFICACAO"', $f$x."CO_MONITORAMENTO" = $1 or x."CO_EMPREGARE_CANDIDATO"::text in {INSCRICOES} or x."CO_EXECUCAO" in {EXECUCOES_TRIAGEM}$f$),
  (680, 'public."TB_PRE_CLASSIF_VAGA"', $f$x."CO_MONITORAMENTO" = $1 or x."CO_EXECUCAO" in {EXECUCOES_TRIAGEM}$f$),
  (690, 'public."RL_ANALISTA_EDITAL"', $f$x."CO_MONITORAMENTO" = $1$f$),
  (700, 'public."TH_REGRA_ANALISE"', $f$x."CO_REGRA_ANALISE"::text in {REGRAS_ANALISE}$f$),
  (710, 'public."TB_REGRA_ANALISE"', $f$x."CO_MONITORAMENTO" = $1$f$),
  (720, 'public."TH_ORIGEM_ANALISE_EDITAL"', $f$x."CO_MONITORAMENTO" = $1$f$),
  (730, 'public."TB_ORIGEM_ANALISE_EDITAL"', $f$x."CO_MONITORAMENTO" = $1$f$),
  (740, 'public."TH_REGRA_TRIAGEM"', $f$x."CO_REGRA_TRIAGEM"::text in {REGRAS_TRIAGEM}$f$),
  (750, 'public."TB_REGRA_TRIAGEM"', $f$x."CO_MONITORAMENTO" = $1$f$),
  (760, 'public."TL_PRE_CLASSIFICACAO"', $f$x."CO_EXECUCAO" in {EXECUCOES_TRIAGEM}$f$),
  (770, 'public."TB_RESUMO_PERGUNTA_EDITAL"', $f$x."CO_MONITORAMENTO" = $1$f$),
  (780, 'public."TB_RASCUNHO_REGRA"', $f$x."CO_MONITORAMENTO" = $1$f$),
  (790, 'public."TH_PEDIDO_REINICIO_FICHA"', $f$x."CO_MONITORAMENTO" = $1 or x."CO_PEDIDO_REINICIO"::text in {PEDIDOS_REINICIO}$f$),
  (800, 'public."TB_PEDIDO_REINICIO_FICHA"', $f$x."CO_MONITORAMENTO" = $1$f$),
  -- Inscrições (Empregare), análises fictícias, avisos e congelamento.
  (810, 'public."TB_LEITURA_ARQUIVO"', $f$x."CO_EMPREGARE_RESPOSTA"::text in {RESPOSTAS_EMPREGARE}$f$),
  (820, 'public."TB_EMPREGARE_ANEXO"', $f$x."CO_EMPREGARE_RESPOSTA"::text in {RESPOSTAS_EMPREGARE}$f$),
  (830, 'public."TB_EMPREGARE_RESPOSTA"', $f$x."CO_EMPREGARE_CANDIDATO"::text in {INSCRICOES}$f$),
  (840, 'public."TB_CASO_AVISO_CONFERENCIA"', $f$x."CO_AVISO_CONFERENCIA"::text in {AVISOS}$f$),
  (850, 'public."TB_AVISO_CONFERENCIA"', $f$x."CO_MONITORAMENTO" = $1$f$),
  (860, 'public."TH_HORA_NASCIMENTO_CANDIDATO"', $f$x."CO_MONITORAMENTO" = $1 or x."CO_ANALISE_CURRICULAR"::text in {ANALISES}$f$),
  (870, 'public."TB_HORA_NASCIMENTO_CANDIDATO"', $f$x."CO_MONITORAMENTO" = $1 or x."CO_ANALISE_CURRICULAR"::text in {ANALISES}$f$),
  (880, 'public."TB_ANALISE_CURRICULAR"', $f$x.id::text in {ANALISES}$f$),
  (890, 'public."TB_EMPREGARE_CANDIDATO"', $f$x."CO_VAGA" in {VAGAS_EMPREGARE}$f$),
  (900, 'public."TB_EMPREGARE_VAGA"', $f$x."CO_MONITORAMENTO" = $1$f$),
  (910, 'public."TH_INSCRICAO_VAGA_EDITAL"', $f$x."CO_MONITORAMENTO" = $1$f$),
  (920, 'public."TH_CONGELAMENTO_INSCRICAO"', $f$x."CO_MONITORAMENTO" = $1$f$),
  (930, 'public."TB_CONGELAMENTO_INSCRICAO"', $f$x."CO_MONITORAMENTO" = $1$f$),
  (940, 'public."TB_SELECAO_VAGA"', $f$x."CO_MONITORAMENTO" = $1$f$),
  -- Quadro, locais, espelho de nota, cronograma, vínculos e o próprio edital.
  (950, 'public."TB_QUADRO_VAGA_EDITAL"', $f$x."CO_MONITORAMENTO" = $1$f$),
  (960, 'public."TB_LOCAL_VAGA_EDITAL"', $f$x."CO_MONITORAMENTO" = $1$f$),
  (970, 'public."TH_MODELO_ESPELHO_NOTA"', $f$x."CO_MODELO_ESPELHO_NOTA"::text in {MODELOS_ESPELHO}$f$),
  (980, 'public."TB_MODELO_ESPELHO_NOTA"', $f$x."CO_MONITORAMENTO" = $1$f$),
  (990, 'public."TH_CRONOGRAMA_MONIT_INDIG"', $f$x.monitoramento_id = $1$f$),
  (1000, 'public."TB_CRONOGRAMA_MONIT_INDIG"', $f$x.monitoramento_id = $1$f$),
  (1010, 'public."RL_COORDENACAO_EDITAL"', $f$x."CO_EDITAL" = $1$f$),
  (1020, 'public."RL_ENCERRAMENTO_EDITAL_USUARIO"', $f$x."CO_MONITORAMENTO" = $1$f$),
  (1030, 'public."RL_RESPONSAVEL_EDITAL"', $f$x."CO_MONITORAMENTO" = $1$f$),
  (1040, 'public."TH_MONITORAMENTO"', $f$x.id_registro = $1$f$),
  (1050, 'public."TB_MONITORAMENTO_INDIGENA"', $f$x.id = $1$f$);

create temporary table tmp_conjunto (nome text not null, edital uuid not null, chave text not null) on commit drop;
create temporary table tmp_linha (
  tabela text not null,
  edital uuid not null,
  chave text not null,
  unique (tabela, chave)
) on commit drop;
create temporary table tmp_resumo (
  ordem integer primary key,
  tabela text not null,
  apagadas integer not null default 0,
  total_antes bigint not null,
  total_depois bigint
) on commit drop;

-- 1. Conferências antes de apagar: a conta do setor e os editais exatos, de treinamento.
do $$
declare
  e record;
  v_m public."TB_MONITORAMENTO_INDIGENA";
begin
  if to_regprocedure('private."FC_REINICIO_TREINAMENTO_PERMITE"(text,jsonb)') is null
     or to_regprocedure('private."FC_EDITAL_EH_TREINAMENTO"(uuid)') is null then
    raise exception 'Faltam as funções do edital de treinamento: nada foi apagado.';
  end if;
  if not exists (select 1 from public."TB_PERFIL_USUARIO" p
                   join public."TB_GRUPO_ACESSO" a on a."CO_GRUPO_ACESSO" = p.perfil
                  where p.user_id = 'a01afddb-f64b-47d9-80e8-476a1ed14e43' and p.ativo is true and a."ST_ADMIN_GLOBAL") then
    raise exception 'A conta do setor (a01afddb-…) não é administrador global ativo: nada foi apagado.';
  end if;
  if auth.uid() is distinct from 'a01afddb-f64b-47d9-80e8-476a1ed14e43'::uuid then
    raise exception 'auth.uid() desta transação não é a conta do setor: nada foi apagado.';
  end if;
  for e in select * from tmp_editais order by id loop
    select * into v_m from public."TB_MONITORAMENTO_INDIGENA" m where m.id = e.id for update;
    if v_m.id is null then
      raise exception 'O edital % não existe (já apagado?): nada foi apagado.', e.id;
    end if;
    if v_m.edital is distinct from e.edital or v_m."CO_AREA" is distinct from e.area then
      raise exception 'O edital % não é "%" da área %: é "%" (%). Nada foi apagado.',
        e.id, e.edital, e.area, v_m.edital, v_m."CO_AREA";
    end if;
    if v_m."ST_TREINAMENTO" is distinct from 'S' or not private."FC_EDITAL_EH_TREINAMENTO"(e.id) then
      raise exception 'O edital % ("%") não está marcado como treinamento (ST_TREINAMENTO = S): nada foi apagado.', e.id, e.edital;
    end if;
    -- Vaga carregada pelo robô da Empregare não é do treinamento.
    if exists (select 1 from public."TB_EMPREGARE_VAGA" v where v."CO_MONITORAMENTO" = e.id and v."CO_SYNC" is not null) then
      raise exception 'O edital % tem vaga carregada pelo robô da Empregare: nada foi apagado.', e.id;
    end if;
    -- Inscrição de pessoa real (sem a marca do treinamento) não se apaga aqui.
    if exists (select 1 from public."TB_EMPREGARE_CANDIDATO" c
                 join public."TB_EMPREGARE_VAGA" v on v."CO_VAGA" = c."CO_VAGA"
                where v."CO_MONITORAMENTO" = e.id
                  and (c."NO_CANDIDATO" !~ '^Candidato Teste ' or c."DS_EMAIL" !~ '@exemplo\.invalid$'
                       or c."NU_CPF" is not null or c."CO_SYNC" is not null)) then
      raise exception 'O edital % tem inscrição que não é fictícia: nada foi apagado.', e.id;
    end if;
    -- O que tem chave estrangeira com SET NULL para o edital não se apaga: tem de estar vazio.
    if exists (select 1 from public."TB_DEMANDA_INTERNA" d where d."CO_MONITORAMENTO" = e.id) then
      raise exception 'O edital % tem demanda interna ligada: nada foi apagado; leve à equipe.', e.id;
    end if;
    if to_regclass('arquivo."TB_CONVERSA"') is not null
       and exists (select 1 from arquivo."TB_CONVERSA" c where c."CO_MONITORAMENTO" = e.id) then
      raise exception 'O edital % tem conversa arquivada ligada: nada foi apagado.', e.id;
    end if;
    -- Execução da Triagem com outros editais junto não se apaga.
    if exists (select 1 from public."TL_PRE_CLASSIFICACAO" t
                where (t."CO_EXECUCAO" = 'treinamento-' || e.id::text
                       or t."DS_EDITAL" @> jsonb_build_array(jsonb_build_object('edital', e.id::text)))
                  and jsonb_array_length(coalesce(t."DS_EDITAL", '[]'::jsonb)) <> 1) then
      raise exception 'O edital % está numa execução da Triagem com outros editais: nada foi apagado.', e.id;
    end if;
  end loop;
end;
$$;

-- 2. Mede ANTES: os conjuntos, as linhas ligadas (pela chave primária) e o total de cada tabela.
do $$
declare
  e record;
  d record;
  a record;
  v_pk text;
  v_filtro text;
  v_total bigint;
begin
  for e in select * from tmp_editais order by id loop
    for d in select * from tmp_def_conjunto order by nome loop
      execute format('insert into tmp_conjunto (nome, edital, chave) select %L, $1, q.chave from (%s) as q(chave)',
                     d.nome, d.consulta) using e.id;
    end loop;
  end loop;

  for a in select * from tmp_alvo order by ordem loop
    if to_regclass(a.tabela) is null then
      raise exception 'Tabela % não existe: nada foi apagado.', a.tabela;
    end if;
    select string_agg(format('x.%I', att.attname), ', ' order by k.ord)
      into v_pk
      from pg_constraint c
     cross join lateral unnest(c.conkey) with ordinality as k(attnum, ord)
      join pg_attribute att on att.attrelid = c.conrelid and att.attnum = k.attnum
     where c.conrelid = a.tabela::regclass and c.contype = 'p';
    if v_pk is null then
      raise exception 'Tabela % sem chave primária: nada foi apagado.', a.tabela;
    end if;
    execute format('select count(*) from %s', a.tabela) into v_total;
    insert into tmp_resumo (ordem, tabela, total_antes) values (a.ordem, a.tabela, v_total);
    for e in select * from tmp_editais order by id loop
      v_filtro := a.filtro;
      for d in select nome from tmp_def_conjunto loop
        v_filtro := replace(v_filtro, '{' || d.nome || '}',
          format('(select k.chave from tmp_conjunto k where k.nome = %L and k.edital = $1)', d.nome));
      end loop;
      if v_filtro ~ '\{[A-Z_]+\}' then
        raise exception 'Filtro de % cita conjunto desconhecido: %', a.tabela, v_filtro;
      end if;
      execute format('insert into tmp_linha (tabela, edital, chave) select %L, $1, jsonb_build_array(%s)::text from %s x where %s',
                     a.tabela, v_pk, a.tabela, v_filtro) using e.id;
    end loop;
  end loop;
end;
$$;

-- Os arquivos no Storage ligados aos editais (o XLSX importado pela Lista de
-- aprovados e o que estiver na pasta do edital). NÃO se apagam por SQL: ficam
-- listados no resultado para apagar pelo painel/API do Storage.
create temporary table tmp_arquivos on commit drop as
select o.bucket_id, o.name, (o.metadata ->> 'size')::bigint as bytes
  from storage.objects o
 where exists (select 1 from tmp_editais e where o.name like e.id::text || '/%')
    or o.name in (select l.arquivo_path from public."TB_LISTA_APROVADO" l
                    join tmp_editais e on l.edital_id = e.id::text);

-- 3. O medido tem de ser exatamente o esperado (por tabela e edital).
do $$
declare
  r record;
  v_dif text;
begin
  select string_agg(format('%s / %s: medido %s, esperado %s', t.tabela, t.edital, t.medido, t.esperado), '; ' order by t.tabela, t.edital)
    into v_dif
    from (select coalesce(m.tabela, s.tabela) as tabela, coalesce(m.edital, s.edital) as edital,
                 coalesce(m.qt, 0) as medido, coalesce(s.qt, 0) as esperado
            from (select l.tabela, l.edital, count(*)::integer as qt from tmp_linha l group by 1, 2) m
            full join tmp_esperado s on s.tabela = m.tabela and s.edital = m.edital) t
   where t.medido <> t.esperado;
  if v_dif is not null then
    raise exception 'O banco mudou desde o levantamento (04/11/2026): %. Nada foi apagado.', v_dif;
  end if;
  for r in select s.tabela from tmp_esperado s where not exists (select 1 from tmp_alvo a where a.tabela = s.tabela) loop
    raise exception 'Esperado cita tabela fora da lista: %', r.tabela;
  end loop;
end;
$$;

-- 4. Apaga, edital por edital, na ordem. A marca agsus.reinicio_treinamento é a
-- mesma do reinício do treinamento: libera os gatilhos de imutabilidade da
-- avaliação documental SÓ para as linhas deste edital (que é de treinamento).
-- A Triagem (regra e execução) não tem essa liberação: os três gatilhos dela
-- ficam desligados só dentro desta transação e voltam no fim (se houver o que apagar).
do $$
begin
  if exists (select 1 from tmp_linha l where l.tabela in
               ('public."TB_REGRA_TRIAGEM"', 'public."TH_REGRA_TRIAGEM"', 'public."TL_PRE_CLASSIFICACAO"')) then
    alter table public."TB_REGRA_TRIAGEM" disable trigger "TG_REGRATRIAGEM_SEMAPAGAR";
    alter table public."TH_REGRA_TRIAGEM" disable trigger "TG_THREGRATRIAGEM_IMUTAVEL";
    alter table public."TL_PRE_CLASSIFICACAO" disable trigger "TG_TLPRECLASSIF_SEMAPAGAR";
  end if;
end;
$$;

do $$
declare
  e record;
  a record;
  v_pk text;
  v_n integer;
  v_esperado integer;
begin
  for e in select * from tmp_editais order by id loop
    perform set_config('agsus.reinicio_treinamento', e.id::text, true);
    for a in select * from tmp_alvo order by ordem loop
      select count(*)::integer into v_esperado from tmp_linha l where l.tabela = a.tabela and l.edital = e.id;
      if v_esperado = 0 then
        continue;
      end if;
      select string_agg(format('x.%I', att.attname), ', ' order by k.ord)
        into v_pk
        from pg_constraint c
       cross join lateral unnest(c.conkey) with ordinality as k(attnum, ord)
        join pg_attribute att on att.attrelid = c.conrelid and att.attnum = k.attnum
       where c.conrelid = a.tabela::regclass and c.contype = 'p';
      execute format('delete from %s x where jsonb_build_array(%s)::text in (select l.chave from tmp_linha l where l.tabela = %L and l.edital = $1)',
                     a.tabela, v_pk, a.tabela) using e.id;
      get diagnostics v_n = row_count;
      if v_n <> v_esperado then
        raise exception 'Em %, edital %: apagou % linhas, esperava %.', a.tabela, e.id, v_n, v_esperado;
      end if;
      update tmp_resumo set apagadas = apagadas + v_n where tabela = a.tabela;
    end loop;
  end loop;
  perform set_config('agsus.reinicio_treinamento', '', true);
end;
$$;

do $$
begin
  if exists (select 1 from tmp_linha l where l.tabela in
               ('public."TB_REGRA_TRIAGEM"', 'public."TH_REGRA_TRIAGEM"', 'public."TL_PRE_CLASSIFICACAO"')) then
    alter table public."TB_REGRA_TRIAGEM" enable trigger "TG_REGRATRIAGEM_SEMAPAGAR";
    alter table public."TH_REGRA_TRIAGEM" enable trigger "TG_THREGRATRIAGEM_IMUTAVEL";
    alter table public."TL_PRE_CLASSIFICACAO" enable trigger "TG_TLPRECLASSIF_SEMAPAGAR";
  end if;
end;
$$;

-- 5. Os caches das áreas montam de novo sem os editais (os gatilhos de versão
-- de fonte já marcaram as leituras das tabelas apagadas).
select private."FC_MARCAR_CACHE"(array['APROVADOS', 'ANALISES', 'ENTREVISTAS'],
                                 array(select distinct area from tmp_editais),
                                 'correcao-20261104-apagar-editais-de-treinamento');

-- 6. Conferência DEPOIS: reprova (raise → nada fica) se sobrar linha ligada ou
-- se o total de alguma tabela cair mais (ou menos) que o apagado.
do $$
declare
  e record;
  a record;
  d record;
  v_filtro text;
  v_n bigint;
  v_total bigint;
  r record;
begin
  for a in select * from tmp_alvo order by ordem loop
    execute format('select count(*) from %s', a.tabela) into v_total;
    update tmp_resumo set total_depois = v_total where tabela = a.tabela;
    for e in select * from tmp_editais order by id loop
      v_filtro := a.filtro;
      for d in select nome from tmp_def_conjunto loop
        v_filtro := replace(v_filtro, '{' || d.nome || '}',
          format('(select k.chave from tmp_conjunto k where k.nome = %L and k.edital = $1)', d.nome));
      end loop;
      execute format('select count(*) from %s x where %s', a.tabela, v_filtro) into v_n using e.id;
      if v_n <> 0 then
        raise exception 'Sobrou % linha(s) ligada(s) ao edital % em %.', v_n, e.id, a.tabela;
      end if;
      -- E nenhuma linha que ainda cite o id do edital no texto (colunas sem chave estrangeira, JSON).
      execute format('select count(*) from %s x where x::text like %L', a.tabela, '%' || e.id::text || '%') into v_n;
      if v_n <> 0 then
        raise exception 'Sobrou % linha(s) em % que citam o edital %.', v_n, a.tabela, e.id;
      end if;
    end loop;
  end loop;
  for r in select * from tmp_resumo where total_antes - total_depois <> apagadas loop
    raise exception 'Em %: o total caiu % (de % para %), mas a correção apagou %.',
      r.tabela, r.total_antes - r.total_depois, r.total_antes, r.total_depois, r.apagadas;
  end loop;
  if (select sum(apagadas) from tmp_resumo) <> (select count(*) from tmp_linha) then
    raise exception 'O apagado não bate com o medido antes.';
  end if;
  if exists (select 1 from public."TB_MONITORAMENTO_INDIGENA" m join tmp_editais t on t.id = m.id) then
    raise exception 'Algum edital ainda existe.';
  end if;
  if exists (select 1 from pg_trigger t
              where t.tgname in ('TG_REGRATRIAGEM_SEMAPAGAR', 'TG_THREGRATRIAGEM_IMUTAVEL', 'TG_TLPRECLASSIF_SEMAPAGAR')
                and t.tgenabled <> 'O') then
    raise exception 'Um gatilho da Triagem ficou desligado.';
  end if;
  if current_setting('agsus.reinicio_treinamento', true) <> '' then
    raise exception 'A marca agsus.reinicio_treinamento ficou ligada.';
  end if;
end;
$$;
-- <<< correcao

-- O que foi apagado (por tabela) e os arquivos do Storage que FICAM. A última
-- consulta é o que o SQL Editor mostra.
select x.tabela, x.apagadas, x.total_antes, x.total_depois
  from (
    select r.ordem, r.tabela, r.apagadas, r.total_antes, r.total_depois
      from tmp_resumo r
     where r.apagadas > 0
    union all
    select 100000, 'TOTAL', sum(r.apagadas)::integer, null, null from tmp_resumo r
    union all
    select 200000, 'FICA no Storage (apagar pelo painel/API): ' || a.bucket_id || '/' || a.name, 0, a.bytes, null
      from tmp_arquivos a
  ) x
 order by x.ordem, x.tabela;

commit;
