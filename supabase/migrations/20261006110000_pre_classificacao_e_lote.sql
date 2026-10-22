/*
  AVALIAÇÃO DOCUMENTAL (FASE F2): PRÉ-CLASSIFICAÇÃO POR ART, LOTE DE CONVOCAÇÃO
  E AS LISTAS PROVISORIA E LOTE

  Desenho: docs/analises-no-monitora/ (README seção 6, modelo-de-dados.md
  seção 5 e plano-de-construcao.md, fase F2); histórias AM-4, AM-5 e AM-16.

  QUEM CALCULA (decisão de 06/10/2026)
    A conta é pesada e em lote: roda no job Python scripts/pre_classificacao/
    (workflow .github/workflows/pre-classificacao.yml, base python/monitora/),
    que lê os inscritos do robô da Empregare por RPC, calcula e GRAVA O
    RESULTADO PRONTO aqui. O banco só guarda, valida (a forma do resultado, a
    versão conferida da regra, quem está no lote só sai eliminado, quem tem
    ficha não muda) e serve. Nenhuma conta de pontos ou de ordem em SQL. A
    mesma conta existe em src/lib/avaliacao-documental/pre-classificacao.js
    para a prévia da tela, conferida pelos casos dourados de
    tests/fixtures/avaliacao-documental/casos-de-pre-classificacao.json.

  O QUE ENTRA
    public."TL_PRE_CLASSIFICACAO"   cada execução do job: início, fim, situação,
                                    quem disparou (ROBO ao fim do robô, MONITORA
                                    pelo Recalcular/Rodar agora, GITHUB), se
                                    refez o lote, o resultado por edital (só
                                    códigos e contagens) e o endereço no Actions
    public."TB_PRE_CLASSIFICACAO"   um inscrito × edital: ELIMINADO (motivo),
                                    RANQUEADO (posição pela ART), NO_LOTE
                                    (lote 1 = inicial; 2, 3… = reposições, com
                                    o motivo da entrada) ou ANALISADO (já tem
                                    ficha — fase F3); ART, nota declarada,
                                    divergência e modalidade
    public."TB_PRE_CLASSIF_VAGA"    o resumo de cada vaga na última execução:
                                    quadro, tamanho do lote (e como foi
                                    contado), linha de corte e avisos
    public."TH_PRE_CLASSIFICACAO"   histórico imutável de cada mudança de
                                    situação ou de lote, com o motivo ("a linha
                                    anda" auditável)
    TB_LISTA_CLASSIFICACAO          ganha os tipos PROVISORIA e LOTE
    TH_REGRA_ANALISE                gatilho que valida os campos novos da regra
                                    (provisoria.desempate e lote.por_vaga)

  FUNÇÕES
    Job (só service_role):
      pre_classificacao_ler_editais(p_editais, p_apos_robo)
      pre_classificacao_ler_candidatos(p_edital, p_vaga)
      iniciar_pre_classificacao, gravar_pre_classificacao_vaga, finalizar_pre_classificacao
    Tela (authenticated):
      obter_pre_classificacao(p_edital)                     leitor da Avaliação documental
      registrar_lista_pre_classificacao(p_edital, p_tipo, p_lote)
                                                            coordenação do edital ou
                                                            editor da Classificação
      pode_recalcular_pre_classificacao(p_edital)           api/rodar-carga.js confere
                                                            antes do "Recalcular"
    Status das atualizações: get_saude_das_cargas() ganha 'pre_classificacao'.

  DADO PESSOAL
    O job recebe as colunas do questionário sem as do cadastro (nome, e-mail,
    CPF, telefone, endereço, nascimento em texto): o nome nunca sai do banco
    para o job. O resultado gravado por ele só tem ids, códigos, notas,
    posições e motivos; o log da execução, só códigos e contagens (recusa
    texto com @ ou CPF). O nome só aparece na leitura da tela e no retrato da
    lista oficial, como nas outras listas.

  PRÉ-REQUISITO: 20261006100000 (regra da análise), 20261006080000 (vagas do
  quadro no robô), 20261005210000 (conferências, por get_saude_das_cargas) e
  20261002170000 (lista ENTREVISTA) aplicadas — a migration para se não estiverem.

  Ensaio: supabase/ensaios/20261006110000_pre_classificacao_e_lote.sql
  Rollback: supabase/rollback/20261006110000_pre_classificacao_e_lote.sql
*/
begin;

-- 0. Pré-requisitos ---------------------------------------------------------------------
do $$
begin
  if to_regclass('public."TH_REGRA_ANALISE"') is null
     or to_regprocedure('private."FC_PAPEL_AVALIACAO"(uuid)') is null then
    raise exception 'Aplique antes 20261006100000_regra_da_analise.sql.';
  end if;
  if to_regprocedure('private."FC_EMPREGARE_VAGAS_DO_QUADRO"(text)') is null then
    raise exception 'Aplique antes 20261006080000_robo_empregare_vagas_do_quadro.sql.';
  end if;
  if to_regclass('public."TL_CONFERENCIA"') is null
     or to_regprocedure('private."FC_TEXTO_SEGURO_DO_AVISO"(text)') is null then
    raise exception 'Aplique antes 20261005210000_conferencias_de_consistencia.sql.';
  end if;
  if not exists (
    select 1 from pg_constraint
     where conname = 'CK_LISTACLASSIF_TPLISTA'
       and pg_get_constraintdef(oid) like '%ENTREVISTA%') then
    raise exception 'Aplique antes 20261002170000_classificacao_lista_da_entrevista.sql.';
  end if;
end;
$$;

-- 1. Log das execuções ------------------------------------------------------------------
create table public."TL_PRE_CLASSIFICACAO" (
  "CO_EXECUCAO" text not null,
  "DT_INICIO" timestamptz not null default now(),
  "DT_FIM" timestamptz,
  "TP_SITUACAO" varchar(12) not null default 'EM_ANDAMENTO',
  "TP_DISPARO" varchar(8) not null,
  "CO_USUARIO_DISPARO" uuid,
  "ST_REFAZER_LOTE" varchar(1) not null default 'N',
  "DS_PEDIDO" jsonb not null default '[]'::jsonb,
  "DS_EDITAL" jsonb not null default '[]'::jsonb,
  "QT_EDITAL" integer not null default 0,
  "QT_VAGA" integer not null default 0,
  "QT_INSCRITO" integer not null default 0,
  "QT_ELIMINADO" integer not null default 0,
  "QT_RANQUEADO" integer not null default 0,
  "QT_LOTE" integer not null default 0,
  "QT_DIVERGENCIA" integer not null default 0,
  "DS_MENSAGEM" varchar(2000),
  "DS_URL_EXECUCAO" varchar(300),
  constraint "PK_TL_PRE_CLASSIFICACAO" primary key ("CO_EXECUCAO"),
  constraint "CK_TLPRECLASSIF_COEXECUCAO" check ("CO_EXECUCAO" ~ '^[A-Za-z0-9_-]{8,80}$'),
  constraint "CK_TLPRECLASSIF_TPSITUACAO" check ("TP_SITUACAO" in ('EM_ANDAMENTO', 'CONCLUIDA', 'PARCIAL', 'FALHOU')),
  constraint "CK_TLPRECLASSIF_TPDISPARO" check ("TP_DISPARO" in ('ROBO', 'MONITORA', 'GITHUB')),
  constraint "CK_TLPRECLASSIF_USUARIO" check (("TP_DISPARO" = 'MONITORA') = ("CO_USUARIO_DISPARO" is not null)),
  constraint "CK_TLPRECLASSIF_STREFAZER" check ("ST_REFAZER_LOTE" in ('S', 'N')),
  constraint "CK_TLPRECLASSIF_LISTAS" check (jsonb_typeof("DS_PEDIDO") = 'array' and jsonb_typeof("DS_EDITAL") = 'array'),
  constraint "CK_TLPRECLASSIF_QT" check (
    "QT_EDITAL" >= 0 and "QT_VAGA" >= 0 and "QT_INSCRITO" >= 0 and "QT_ELIMINADO" >= 0
    and "QT_RANQUEADO" >= 0 and "QT_LOTE" >= 0 and "QT_DIVERGENCIA" >= 0),
  constraint "CK_TLPRECLASSIF_URL" check ("DS_URL_EXECUCAO" is null or "DS_URL_EXECUCAO" ~ '^https://github\.com/')
);
comment on table public."TL_PRE_CLASSIFICACAO" is 'Log das execuções do job da pré-classificação (scripts/pre_classificacao/): uma linha por execução, só com códigos e contagens.';
comment on column public."TL_PRE_CLASSIFICACAO"."CO_EXECUCAO" is 'Identificador da execução (gerado pelo job: precl-<data>-<sufixo>).';
comment on column public."TL_PRE_CLASSIFICACAO"."DT_INICIO" is 'Início da execução.';
comment on column public."TL_PRE_CLASSIFICACAO"."DT_FIM" is 'Fechamento (finalizar_pre_classificacao). Nulo enquanto roda.';
comment on column public."TL_PRE_CLASSIFICACAO"."TP_SITUACAO" is 'EM_ANDAMENTO; CONCLUIDA (todos os editais pedidos foram tratados); PARCIAL (algum edital falhou); FALHOU (erro geral).';
comment on column public."TL_PRE_CLASSIFICACAO"."TP_DISPARO" is 'Quem disparou: ROBO (ao fim do robô da Empregare), MONITORA (Recalcular ou Rodar agora) ou GITHUB (Run workflow).';
comment on column public."TL_PRE_CLASSIFICACAO"."CO_USUARIO_DISPARO" is 'Usuário do MONITORA (auth.users.id) que pediu; nulo nos outros disparos.';
comment on column public."TL_PRE_CLASSIFICACAO"."ST_REFAZER_LOTE" is 'S: o lote foi recortado do zero (só antes das fichas).';
comment on column public."TL_PRE_CLASSIFICACAO"."DS_PEDIDO" is 'Editais pedidos (ids ou números, lista json); vazia = os editais ativos com vagas da Empregare.';
comment on column public."TL_PRE_CLASSIFICACAO"."DS_EDITAL" is 'Resultado por edital (lista json): edital, situação (PROCESSADO, SEM_REGRA, REGRA_NAO_CONFERIDA, SEM_VAGAS, FALHOU), vagas e contagens. Sem dado pessoal.';
comment on column public."TL_PRE_CLASSIFICACAO"."QT_EDITAL" is 'Editais processados.';
comment on column public."TL_PRE_CLASSIFICACAO"."QT_VAGA" is 'Vagas gravadas nesta execução.';
comment on column public."TL_PRE_CLASSIFICACAO"."QT_INSCRITO" is 'Inscritos considerados nas vagas gravadas.';
comment on column public."TL_PRE_CLASSIFICACAO"."QT_ELIMINADO" is 'Eliminados automáticos nas vagas gravadas.';
comment on column public."TL_PRE_CLASSIFICACAO"."QT_RANQUEADO" is 'Inscritos na Provisória (não eliminados) nas vagas gravadas.';
comment on column public."TL_PRE_CLASSIFICACAO"."QT_LOTE" is 'Inscritos no lote (NO_LOTE e ANALISADO) nas vagas gravadas.';
comment on column public."TL_PRE_CLASSIFICACAO"."QT_DIVERGENCIA" is 'Inscritos com a ART diferente da nota declarada além da tolerância.';
comment on column public."TL_PRE_CLASSIFICACAO"."DS_MENSAGEM" is 'Erro geral ou observação (sem dado pessoal).';
comment on column public."TL_PRE_CLASSIFICACAO"."DS_URL_EXECUCAO" is 'Endereço da execução no GitHub Actions.';
comment on constraint "PK_TL_PRE_CLASSIFICACAO" on public."TL_PRE_CLASSIFICACAO" is 'Identificador da execução.';
comment on constraint "CK_TLPRECLASSIF_COEXECUCAO" on public."TL_PRE_CLASSIFICACAO" is 'Identificador de 8 a 80 caracteres seguros.';
comment on constraint "CK_TLPRECLASSIF_TPSITUACAO" on public."TL_PRE_CLASSIFICACAO" is 'Situações válidas.';
comment on constraint "CK_TLPRECLASSIF_TPDISPARO" on public."TL_PRE_CLASSIFICACAO" is 'Disparos válidos.';
comment on constraint "CK_TLPRECLASSIF_USUARIO" on public."TL_PRE_CLASSIFICACAO" is 'Usuário só (e sempre) no disparo pelo MONITORA.';
comment on constraint "CK_TLPRECLASSIF_STREFAZER" on public."TL_PRE_CLASSIFICACAO" is 'Flag S/N.';
comment on constraint "CK_TLPRECLASSIF_LISTAS" on public."TL_PRE_CLASSIFICACAO" is 'Pedido e resultado em listas json.';
comment on constraint "CK_TLPRECLASSIF_QT" on public."TL_PRE_CLASSIFICACAO" is 'Contagens não negativas.';
comment on constraint "CK_TLPRECLASSIF_URL" on public."TL_PRE_CLASSIFICACAO" is 'Endereço só do GitHub.';

create index "IN_TLPRECLASSIF_INICIO" on public."TL_PRE_CLASSIFICACAO" ("DT_INICIO" desc);
comment on index public."IN_TLPRECLASSIF_INICIO" is 'Últimas execuções (Status das atualizações e a aba Pré-classificação).';

-- 2. A Provisória e o lote: um inscrito × edital -----------------------------------------
create table public."TB_PRE_CLASSIFICACAO" (
  "CO_MONITORAMENTO" uuid not null,
  "CO_EMPREGARE_CANDIDATO" uuid not null,
  "CO_VAGA" varchar(20) not null,
  "NU_VERSAO_REGRA" integer not null,
  "TP_SITUACAO" varchar(12) not null,
  "CO_MOTIVO_ELIMINACAO" varchar(30),
  "DS_MOTIVO_ELIMINACAO" varchar(200),
  "VL_ART" numeric(8,4),
  "VL_NOTA_ORDEM" numeric(8,4),
  "TP_ORIGEM_NOTA" varchar(10),
  "VL_NOTA_DECLARADA" numeric(8,4),
  "DS_NOTA_DECLARADA" jsonb,
  "ST_DIVERGENTE" varchar(1) not null default 'N',
  "NO_MODALIDADE" varchar(10) not null default 'AC',
  "NU_POSICAO" integer,
  "NU_POSICAO_MODALIDADE" integer,
  "NU_LOTE" smallint,
  "CO_LISTA_LOTE" varchar(12),
  "TP_ENTRADA_LOTE" varchar(10),
  "DS_MOTIVO_ENTRADA" varchar(300),
  "DT_ENTRADA_LOTE" timestamptz,
  "CO_EXECUCAO" text not null,
  "DT_CRIACAO" timestamptz not null default now(),
  "DT_ATUALIZACAO" timestamptz not null default now(),
  constraint "PK_TB_PRE_CLASSIFICACAO" primary key ("CO_MONITORAMENTO", "CO_EMPREGARE_CANDIDATO"),
  constraint "FK_MONITORAMENTO_PRECLASSIF" foreign key ("CO_MONITORAMENTO") references public."TB_MONITORAMENTO_INDIGENA" (id),
  constraint "FK_EMPREGARECAND_PRECLASSIF" foreign key ("CO_EMPREGARE_CANDIDATO")
    references public."TB_EMPREGARE_CANDIDATO" ("CO_EMPREGARE_CANDIDATO"),
  constraint "FK_TLPRECLASSIF_PRECLASSIF" foreign key ("CO_EXECUCAO") references public."TL_PRE_CLASSIFICACAO" ("CO_EXECUCAO"),
  constraint "CK_PRECLASSIF_TPSITUACAO" check ("TP_SITUACAO" in ('ELIMINADO', 'RANQUEADO', 'NO_LOTE', 'ANALISADO')),
  constraint "CK_PRECLASSIF_ELIMINADO" check (
    ("TP_SITUACAO" = 'ELIMINADO') = ("CO_MOTIVO_ELIMINACAO" is not null)
    and ("CO_MOTIVO_ELIMINACAO" is null) = ("DS_MOTIVO_ELIMINACAO" is null)),
  constraint "CK_PRECLASSIF_COMOTIVO" check ("CO_MOTIVO_ELIMINACAO" is null or "CO_MOTIVO_ELIMINACAO" ~ '^[A-Z][A-Z0-9_]{1,29}$'),
  constraint "CK_PRECLASSIF_POSICAO" check (
    case when "TP_SITUACAO" = 'ELIMINADO' then "NU_POSICAO" is null and "NU_POSICAO_MODALIDADE" is null
         else "NU_POSICAO" >= 1 and "NU_POSICAO_MODALIDADE" >= 1 end),
  constraint "CK_PRECLASSIF_LOTE" check (
    case when "TP_SITUACAO" in ('NO_LOTE', 'ANALISADO')
         then "NU_LOTE" between 1 and 999 and "CO_LISTA_LOTE" is not null and "TP_ENTRADA_LOTE" is not null
         else "NU_LOTE" is null and "CO_LISTA_LOTE" is null and "TP_ENTRADA_LOTE" is null
              and "DS_MOTIVO_ENTRADA" is null and "DT_ENTRADA_LOTE" is null end),
  constraint "CK_PRECLASSIF_LISTALOTE" check ("CO_LISTA_LOTE" is null or "CO_LISTA_LOTE" ~ '^(GERAL|[A-Z]{2,10})$'),
  constraint "CK_PRECLASSIF_ENTRADA" check ("TP_ENTRADA_LOTE" is null or "TP_ENTRADA_LOTE" in ('INICIAL', 'REPOSICAO', 'AMPLIACAO')),
  constraint "CK_PRECLASSIF_ORIGEMNOTA" check ("TP_ORIGEM_NOTA" is null or "TP_ORIGEM_NOTA" in ('ART', 'DECLARADA')),
  constraint "CK_PRECLASSIF_STDIVERGENTE" check ("ST_DIVERGENTE" in ('S', 'N')),
  constraint "CK_PRECLASSIF_MODALIDADE" check ("NO_MODALIDADE" ~ '^[A-Z]{2,10}$'),
  constraint "CK_PRECLASSIF_DECLARADA" check ("DS_NOTA_DECLARADA" is null or jsonb_typeof("DS_NOTA_DECLARADA") = 'object'),
  constraint "CK_PRECLASSIF_NUVERSAO" check ("NU_VERSAO_REGRA" >= 1)
);
create index "IN_PRECLASSIF_VAGA" on public."TB_PRE_CLASSIFICACAO" ("CO_MONITORAMENTO", "CO_VAGA", "TP_SITUACAO", "NU_POSICAO");
create index "IN_FKPRECLASSIF_CANDIDATO" on public."TB_PRE_CLASSIFICACAO" ("CO_EMPREGARE_CANDIDATO");
create index "IN_FKPRECLASSIF_EXECUCAO" on public."TB_PRE_CLASSIFICACAO" ("CO_EXECUCAO");
comment on table public."TB_PRE_CLASSIFICACAO" is
  'Lista provisória por ART (item 8.3.1) e lote de convocação (item 8.4) de cada vaga, gravados prontos pelo job Python: eliminados automáticos com motivo, ranqueados, os do lote e os já analisados. Fonte das listas PROVISORIA e LOTE e dos contadores da aba Pré-classificação. Nada se apaga.';
comment on column public."TB_PRE_CLASSIFICACAO"."CO_MONITORAMENTO" is 'Edital (TB_MONITORAMENTO_INDIGENA.id).';
comment on column public."TB_PRE_CLASSIFICACAO"."CO_EMPREGARE_CANDIDATO" is 'Inscrito na vaga (TB_EMPREGARE_CANDIDATO: um candidato por vaga).';
comment on column public."TB_PRE_CLASSIFICACAO"."CO_VAGA" is 'Código da vaga da Empregare (o mesmo do inscrito).';
comment on column public."TB_PRE_CLASSIFICACAO"."NU_VERSAO_REGRA" is 'Versão (conferida) da regra da avaliação usada (TH_REGRA_ANALISE.NU_VERSAO).';
comment on column public."TB_PRE_CLASSIFICACAO"."TP_SITUACAO" is 'ELIMINADO (eliminação automática, com motivo), RANQUEADO (na Provisória, fora do lote), NO_LOTE (no lote de convocação) ou ANALISADO (já tem ficha; nunca muda por recálculo).';
comment on column public."TB_PRE_CLASSIFICACAO"."CO_MOTIVO_ELIMINACAO" is 'Código da regra de eliminação automática (CANCELADO, QUESTIONARIO, REPROVADO_EMPREGARE, TERMO…) ou SAIU_DA_EMPREGARE.';
comment on column public."TB_PRE_CLASSIFICACAO"."DS_MOTIVO_ELIMINACAO" is 'Motivo da eliminação, como a regra escreve (vai para a lista).';
comment on column public."TB_PRE_CLASSIFICACAO"."VL_ART" is 'Nota da Autodeclaração de Requisitos e Títulos: a nota do questionário da Empregare ("24,0/30,0" → 24). Nula quando o arquivo não traz número.';
comment on column public."TB_PRE_CLASSIFICACAO"."VL_NOTA_ORDEM" is 'Nota que ordena a Provisória: a ART ou, sem ela, a nota declarada (TP_ORIGEM_NOTA).';
comment on column public."TB_PRE_CLASSIFICACAO"."TP_ORIGEM_NOTA" is 'ART ou DECLARADA (sem ART, vale a nota declarada, com aviso); nula sem as duas.';
comment on column public."TB_PRE_CLASSIFICACAO"."VL_NOTA_DECLARADA" is 'Nota declarada recalculada pela regra a partir das respostas (só confere a ART).';
comment on column public."TB_PRE_CLASSIFICACAO"."DS_NOTA_DECLARADA" is 'Parciais da nota declarada e quantas respostas ficaram fora do mapa da regra ({"parciais": {...}, "sem_mapa": n}).';
comment on column public."TB_PRE_CLASSIFICACAO"."ST_DIVERGENTE" is 'S: a ART difere da nota declarada além da tolerância da regra (aviso para a coordenação; a ordem segue a ART).';
comment on column public."TB_PRE_CLASSIFICACAO"."NO_MODALIDADE" is 'Modalidade declarada (AC, PP, PI, PQ, PCD, TRANS), pelo bloco MODALIDADE da regra.';
comment on column public."TB_PRE_CLASSIFICACAO"."NU_POSICAO" is 'Posição na Provisória da vaga (nula para eliminado).';
comment on column public."TB_PRE_CLASSIFICACAO"."NU_POSICAO_MODALIDADE" is 'Posição entre os da mesma modalidade.';
comment on column public."TB_PRE_CLASSIFICACAO"."NU_LOTE" is '1 = lote inicial; 2, 3… = as reposições ("a linha anda"). Nulo fora do lote.';
comment on column public."TB_PRE_CLASSIFICACAO"."CO_LISTA_LOTE" is 'Lista pela qual entrou no lote: GERAL ou, no lote por modalidade, AC ou o código da cota.';
comment on column public."TB_PRE_CLASSIFICACAO"."TP_ENTRADA_LOTE" is 'INICIAL, REPOSICAO (no lugar de quem saiu) ou AMPLIACAO (o lote cresceu).';
comment on column public."TB_PRE_CLASSIFICACAO"."DS_MOTIVO_ENTRADA" is 'Por que entrou no lote ("Entrou no lugar de 7000654 (Cancelou a inscrição)").';
comment on column public."TB_PRE_CLASSIFICACAO"."DT_ENTRADA_LOTE" is 'Quando entrou no lote.';
comment on column public."TB_PRE_CLASSIFICACAO"."CO_EXECUCAO" is 'Última execução do job que gravou a linha.';
comment on column public."TB_PRE_CLASSIFICACAO"."DT_CRIACAO" is 'Primeira gravação.';
comment on column public."TB_PRE_CLASSIFICACAO"."DT_ATUALIZACAO" is 'Última gravação.';
comment on constraint "PK_TB_PRE_CLASSIFICACAO" on public."TB_PRE_CLASSIFICACAO" is 'Um inscrito por edital: rodar de novo atualiza, não duplica (AM-4.2).';
comment on constraint "FK_MONITORAMENTO_PRECLASSIF" on public."TB_PRE_CLASSIFICACAO" is 'Edital.';
comment on constraint "FK_EMPREGARECAND_PRECLASSIF" on public."TB_PRE_CLASSIFICACAO" is 'Inscrito do robô da Empregare.';
comment on constraint "FK_TLPRECLASSIF_PRECLASSIF" on public."TB_PRE_CLASSIFICACAO" is 'Execução que gravou.';
comment on constraint "CK_PRECLASSIF_TPSITUACAO" on public."TB_PRE_CLASSIFICACAO" is 'Situações válidas.';
comment on constraint "CK_PRECLASSIF_ELIMINADO" on public."TB_PRE_CLASSIFICACAO" is 'Eliminado tem código e texto do motivo; os demais, nenhum.';
comment on constraint "CK_PRECLASSIF_COMOTIVO" on public."TB_PRE_CLASSIFICACAO" is 'Código do motivo em maiúsculas.';
comment on constraint "CK_PRECLASSIF_POSICAO" on public."TB_PRE_CLASSIFICACAO" is 'Eliminado sem posição; os demais com posição na vaga e na modalidade.';
comment on constraint "CK_PRECLASSIF_LOTE" on public."TB_PRE_CLASSIFICACAO" is 'No lote (ou analisado) tem número do lote, lista e entrada; fora dele, nada disso.';
comment on constraint "CK_PRECLASSIF_LISTALOTE" on public."TB_PRE_CLASSIFICACAO" is 'GERAL ou código de modalidade.';
comment on constraint "CK_PRECLASSIF_ENTRADA" on public."TB_PRE_CLASSIFICACAO" is 'Entradas válidas.';
comment on constraint "CK_PRECLASSIF_ORIGEMNOTA" on public."TB_PRE_CLASSIFICACAO" is 'ART ou DECLARADA.';
comment on constraint "CK_PRECLASSIF_STDIVERGENTE" on public."TB_PRE_CLASSIFICACAO" is 'Flag S/N.';
comment on constraint "CK_PRECLASSIF_MODALIDADE" on public."TB_PRE_CLASSIFICACAO" is 'Código de modalidade em maiúsculas.';
comment on constraint "CK_PRECLASSIF_DECLARADA" on public."TB_PRE_CLASSIFICACAO" is 'Detalhe da nota declarada é objeto json.';
comment on constraint "CK_PRECLASSIF_NUVERSAO" on public."TB_PRE_CLASSIFICACAO" is 'Versões começam em 1.';
comment on index public."IN_PRECLASSIF_VAGA" is 'Provisória de uma vaga na ordem (tela e listas).';
comment on index public."IN_FKPRECLASSIF_CANDIDATO" is 'Chave estrangeira para TB_EMPREGARE_CANDIDATO.';
comment on index public."IN_FKPRECLASSIF_EXECUCAO" is 'Chave estrangeira para TL_PRE_CLASSIFICACAO.';

-- 3. Resumo por vaga --------------------------------------------------------------------
create table public."TB_PRE_CLASSIF_VAGA" (
  "CO_MONITORAMENTO" uuid not null,
  "CO_VAGA" varchar(20) not null,
  "CO_EXECUCAO" text not null,
  "NU_VERSAO_REGRA" integer not null,
  "CO_QUADRO_VAGA" uuid,
  "NO_CARGO" varchar(300),
  "NO_LOTACAO" varchar(300),
  "QT_VAGA_IMEDIATA" integer,
  "ST_CADASTRO_RESERVA" varchar(1) not null default 'N',
  "QT_INSCRITO" integer not null default 0,
  "QT_ELIMINADO" integer not null default 0,
  "QT_RANQUEADO" integer not null default 0,
  "QT_LOTE" integer not null default 0,
  "QT_TAMANHO_LOTE" integer,
  "DS_TAMANHO_LOTE" varchar(200),
  "DS_TAMANHO_MODALIDADE" jsonb,
  "VL_ART_CORTE" numeric(8,4),
  "QT_DIVERGENCIA" integer not null default 0,
  "QT_SEM_ART" integer not null default 0,
  "QT_ACIMA_CORTE" integer not null default 0,
  "NU_ULTIMO_LOTE" smallint not null default 0,
  "DS_AVISO" jsonb not null default '[]'::jsonb,
  "DT_CRIACAO" timestamptz not null default now(),
  "DT_ATUALIZACAO" timestamptz not null default now(),
  constraint "PK_TB_PRE_CLASSIF_VAGA" primary key ("CO_MONITORAMENTO", "CO_VAGA"),
  constraint "FK_MONITORAMENTO_PRECLASSVAGA" foreign key ("CO_MONITORAMENTO") references public."TB_MONITORAMENTO_INDIGENA" (id),
  constraint "FK_TLPRECLASSIF_PRECLASSVAGA" foreign key ("CO_EXECUCAO") references public."TL_PRE_CLASSIFICACAO" ("CO_EXECUCAO"),
  constraint "FK_QUADROVAGA_PRECLASSVAGA" foreign key ("CO_QUADRO_VAGA") references public."TB_QUADRO_VAGA_EDITAL" ("CO_QUADRO_VAGA"),
  constraint "CK_PRECLASSVAGA_STCR" check ("ST_CADASTRO_RESERVA" in ('S', 'N')),
  constraint "CK_PRECLASSVAGA_QT" check (
    "QT_INSCRITO" >= 0 and "QT_ELIMINADO" >= 0 and "QT_RANQUEADO" >= 0 and "QT_LOTE" >= 0
    and "QT_DIVERGENCIA" >= 0 and "QT_SEM_ART" >= 0 and "QT_ACIMA_CORTE" >= 0 and "NU_ULTIMO_LOTE" between 0 and 999
    and ("QT_VAGA_IMEDIATA" is null or "QT_VAGA_IMEDIATA" >= 0)
    and ("QT_TAMANHO_LOTE" is null or "QT_TAMANHO_LOTE" between 0 and 100000)),
  constraint "CK_PRECLASSVAGA_JSON" check (
    jsonb_typeof("DS_AVISO") = 'array'
    and ("DS_TAMANHO_MODALIDADE" is null or jsonb_typeof("DS_TAMANHO_MODALIDADE") = 'object'))
);
create index "IN_FKPRECLASSVAGA_EXECUCAO" on public."TB_PRE_CLASSIF_VAGA" ("CO_EXECUCAO");
create index "IN_FKPRECLASSVAGA_QUADRO" on public."TB_PRE_CLASSIF_VAGA" ("CO_QUADRO_VAGA");
comment on table public."TB_PRE_CLASSIF_VAGA" is 'Resumo da pré-classificação de cada vaga na última execução do job: quadro de vagas, tamanho do lote e como foi contado, linha de corte, contagens e avisos (códigos).';
comment on column public."TB_PRE_CLASSIF_VAGA"."CO_MONITORAMENTO" is 'Edital.';
comment on column public."TB_PRE_CLASSIF_VAGA"."CO_VAGA" is 'Código da vaga da Empregare.';
comment on column public."TB_PRE_CLASSIF_VAGA"."CO_EXECUCAO" is 'Última execução que gravou a vaga.';
comment on column public."TB_PRE_CLASSIF_VAGA"."NU_VERSAO_REGRA" is 'Versão da regra da avaliação usada.';
comment on column public."TB_PRE_CLASSIF_VAGA"."CO_QUADRO_VAGA" is 'Linha do quadro de vagas ligada à vaga (FC_EMPREGARE_VAGAS_DO_QUADRO), lida pelo banco na gravação.';
comment on column public."TB_PRE_CLASSIF_VAGA"."NO_CARGO" is 'Cargo do quadro (cabeçalho das listas).';
comment on column public."TB_PRE_CLASSIF_VAGA"."NO_LOTACAO" is 'Lotação do quadro.';
comment on column public."TB_PRE_CLASSIF_VAGA"."QT_VAGA_IMEDIATA" is 'Vagas imediatas do quadro; nulo sem quadro (o lote então precisa de tamanho definido para a vaga).';
comment on column public."TB_PRE_CLASSIF_VAGA"."ST_CADASTRO_RESERVA" is 'S: a linha do quadro tem cadastro reserva.';
comment on column public."TB_PRE_CLASSIF_VAGA"."QT_INSCRITO" is 'Inscritos considerados (contados no banco).';
comment on column public."TB_PRE_CLASSIF_VAGA"."QT_ELIMINADO" is 'Eliminados automáticos.';
comment on column public."TB_PRE_CLASSIF_VAGA"."QT_RANQUEADO" is 'Na Provisória (não eliminados).';
comment on column public."TB_PRE_CLASSIF_VAGA"."QT_LOTE" is 'No lote (NO_LOTE e ANALISADO).';
comment on column public."TB_PRE_CLASSIF_VAGA"."QT_TAMANHO_LOTE" is 'Tamanho do lote pela regra; nulo quando não dá para calcular (sem quadro).';
comment on column public."TB_PRE_CLASSIF_VAGA"."DS_TAMANHO_LOTE" is 'Como o tamanho foi contado ("3 × (11 + CR) = 36", "40 (definido para a vaga)").';
comment on column public."TB_PRE_CLASSIF_VAGA"."DS_TAMANHO_MODALIDADE" is 'No lote por modalidade, o tamanho de cada lista ({"AC": 30, "PP": 6}).';
comment on column public."TB_PRE_CLASSIF_VAGA"."VL_ART_CORTE" is 'Linha de corte: a menor nota dentro do lote.';
comment on column public."TB_PRE_CLASSIF_VAGA"."QT_DIVERGENCIA" is 'Inscritos com ART divergente da nota declarada.';
comment on column public."TB_PRE_CLASSIF_VAGA"."QT_SEM_ART" is 'Inscritos na Provisória sem ART no arquivo.';
comment on column public."TB_PRE_CLASSIF_VAGA"."QT_ACIMA_CORTE" is 'Fora do lote com nota acima da linha de corte (entraram depois do recorte; quem está no lote só sai eliminado).';
comment on column public."TB_PRE_CLASSIF_VAGA"."NU_ULTIMO_LOTE" is 'Maior número de lote já usado na vaga (a próxima reposição é o seguinte).';
comment on column public."TB_PRE_CLASSIF_VAGA"."DS_AVISO" is 'Avisos da vaga (códigos: SEM_QUADRO, ART_AUSENTE, LINHA_PARADA, FORA_DO_LOTE_ACIMA_DO_CORTE, COLUNA_AUSENTE:<regra>…).';
comment on column public."TB_PRE_CLASSIF_VAGA"."DT_CRIACAO" is 'Primeira gravação.';
comment on column public."TB_PRE_CLASSIF_VAGA"."DT_ATUALIZACAO" is 'Última gravação.';
comment on constraint "PK_TB_PRE_CLASSIF_VAGA" on public."TB_PRE_CLASSIF_VAGA" is 'Uma linha por vaga do edital.';
comment on constraint "FK_MONITORAMENTO_PRECLASSVAGA" on public."TB_PRE_CLASSIF_VAGA" is 'Edital.';
comment on constraint "FK_TLPRECLASSIF_PRECLASSVAGA" on public."TB_PRE_CLASSIF_VAGA" is 'Execução que gravou.';
comment on constraint "FK_QUADROVAGA_PRECLASSVAGA" on public."TB_PRE_CLASSIF_VAGA" is 'Linha do quadro de vagas.';
comment on constraint "CK_PRECLASSVAGA_STCR" on public."TB_PRE_CLASSIF_VAGA" is 'Flag S/N.';
comment on constraint "CK_PRECLASSVAGA_QT" on public."TB_PRE_CLASSIF_VAGA" is 'Contagens e tamanhos dentro dos limites.';
comment on constraint "CK_PRECLASSVAGA_JSON" on public."TB_PRE_CLASSIF_VAGA" is 'Avisos em lista; tamanhos por modalidade em objeto.';
comment on index public."IN_FKPRECLASSVAGA_EXECUCAO" is 'Chave estrangeira para TL_PRE_CLASSIFICACAO.';
comment on index public."IN_FKPRECLASSVAGA_QUADRO" is 'Chave estrangeira para TB_QUADRO_VAGA_EDITAL.';

-- 4. Histórico das mudanças ("a linha anda") ---------------------------------------------
create table public."TH_PRE_CLASSIFICACAO" (
  "CO_HISTORICO" uuid not null default gen_random_uuid(),
  "CO_EXECUCAO" text not null,
  "CO_MONITORAMENTO" uuid not null,
  "CO_EMPREGARE_CANDIDATO" uuid not null,
  "CO_VAGA" varchar(20) not null,
  "TP_SITUACAO_ANTERIOR" varchar(12),
  "TP_SITUACAO" varchar(12) not null,
  "NU_LOTE_ANTERIOR" smallint,
  "NU_LOTE" smallint,
  "NU_POSICAO" integer,
  "DS_MOTIVO" varchar(300),
  "DT_REGISTRO" timestamptz not null default now(),
  constraint "PK_TH_PRE_CLASSIFICACAO" primary key ("CO_HISTORICO"),
  constraint "FK_PRECLASSIF_THPRECLASSIF" foreign key ("CO_MONITORAMENTO", "CO_EMPREGARE_CANDIDATO")
    references public."TB_PRE_CLASSIFICACAO" ("CO_MONITORAMENTO", "CO_EMPREGARE_CANDIDATO"),
  constraint "FK_TLPRECLASSIF_THPRECLASSIF" foreign key ("CO_EXECUCAO") references public."TL_PRE_CLASSIFICACAO" ("CO_EXECUCAO"),
  constraint "CK_THPRECLASSIF_SITUACOES" check (
    "TP_SITUACAO" in ('ELIMINADO', 'RANQUEADO', 'NO_LOTE', 'ANALISADO')
    and ("TP_SITUACAO_ANTERIOR" is null or "TP_SITUACAO_ANTERIOR" in ('ELIMINADO', 'RANQUEADO', 'NO_LOTE', 'ANALISADO')))
);
create index "IN_THPRECLASSIF_CANDIDATO" on public."TH_PRE_CLASSIFICACAO" ("CO_MONITORAMENTO", "CO_EMPREGARE_CANDIDATO", "DT_REGISTRO");
create index "IN_FKTHPRECLASSIF_EXECUCAO" on public."TH_PRE_CLASSIFICACAO" ("CO_EXECUCAO");
comment on table public."TH_PRE_CLASSIFICACAO" is 'Histórico imutável da pré-classificação: cada entrada na lista, mudança de situação ou de lote de um inscrito, com a execução e o motivo (quem saiu, quem entrou no lugar).';
comment on column public."TH_PRE_CLASSIFICACAO"."CO_HISTORICO" is 'Identificador do registro.';
comment on column public."TH_PRE_CLASSIFICACAO"."CO_EXECUCAO" is 'Execução do job.';
comment on column public."TH_PRE_CLASSIFICACAO"."CO_MONITORAMENTO" is 'Edital.';
comment on column public."TH_PRE_CLASSIFICACAO"."CO_EMPREGARE_CANDIDATO" is 'Inscrito.';
comment on column public."TH_PRE_CLASSIFICACAO"."CO_VAGA" is 'Vaga.';
comment on column public."TH_PRE_CLASSIFICACAO"."TP_SITUACAO_ANTERIOR" is 'Situação antes (nula na primeira gravação).';
comment on column public."TH_PRE_CLASSIFICACAO"."TP_SITUACAO" is 'Situação depois.';
comment on column public."TH_PRE_CLASSIFICACAO"."NU_LOTE_ANTERIOR" is 'Lote antes.';
comment on column public."TH_PRE_CLASSIFICACAO"."NU_LOTE" is 'Lote depois.';
comment on column public."TH_PRE_CLASSIFICACAO"."NU_POSICAO" is 'Posição na Provisória depois.';
comment on column public."TH_PRE_CLASSIFICACAO"."DS_MOTIVO" is 'Motivo: o da eliminação ou o da entrada no lote.';
comment on column public."TH_PRE_CLASSIFICACAO"."DT_REGISTRO" is 'Quando.';
comment on constraint "PK_TH_PRE_CLASSIFICACAO" on public."TH_PRE_CLASSIFICACAO" is 'Identificador do registro.';
comment on constraint "FK_PRECLASSIF_THPRECLASSIF" on public."TH_PRE_CLASSIFICACAO" is 'Inscrito da pré-classificação.';
comment on constraint "FK_TLPRECLASSIF_THPRECLASSIF" on public."TH_PRE_CLASSIFICACAO" is 'Execução.';
comment on constraint "CK_THPRECLASSIF_SITUACOES" on public."TH_PRE_CLASSIFICACAO" is 'Situações válidas.';
comment on index public."IN_THPRECLASSIF_CANDIDATO" is 'Histórico de um inscrito na ordem.';
comment on index public."IN_FKTHPRECLASSIF_EXECUCAO" is 'Chave estrangeira para TL_PRE_CLASSIFICACAO.';

-- 5. Nada se apaga; histórico não muda ----------------------------------------------------
create function private."FC_TG_PRE_CLASSIF_IMUTAVEL"()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if tg_op = 'DELETE' then
    raise exception 'A pré-classificação não se apaga (%): rode o job de novo', tg_table_name using errcode = '42501';
  end if;
  raise exception 'Histórico não muda (%)', tg_table_name using errcode = '42501';
end;
$function$;
comment on function private."FC_TG_PRE_CLASSIF_IMUTAVEL"() is 'Gatilho: barra o apagamento da pré-classificação e a alteração do histórico (42501).';
revoke all on function private."FC_TG_PRE_CLASSIF_IMUTAVEL"() from public, anon, authenticated;

create trigger "TG_PRECLASSIF_SEMAPAGAR" before delete on public."TB_PRE_CLASSIFICACAO"
  for each row execute function private."FC_TG_PRE_CLASSIF_IMUTAVEL"();
create trigger "TG_PRECLASSVAGA_SEMAPAGAR" before delete on public."TB_PRE_CLASSIF_VAGA"
  for each row execute function private."FC_TG_PRE_CLASSIF_IMUTAVEL"();
create trigger "TG_TLPRECLASSIF_SEMAPAGAR" before delete on public."TL_PRE_CLASSIFICACAO"
  for each row execute function private."FC_TG_PRE_CLASSIF_IMUTAVEL"();
create trigger "TG_THPRECLASSIF_IMUTAVEL" before update or delete on public."TH_PRE_CLASSIFICACAO"
  for each row execute function private."FC_TG_PRE_CLASSIF_IMUTAVEL"();
comment on trigger "TG_PRECLASSIF_SEMAPAGAR" on public."TB_PRE_CLASSIFICACAO" is 'Sem hard delete (FC_TG_PRE_CLASSIF_IMUTAVEL).';
comment on trigger "TG_PRECLASSVAGA_SEMAPAGAR" on public."TB_PRE_CLASSIF_VAGA" is 'Sem hard delete (FC_TG_PRE_CLASSIF_IMUTAVEL).';
comment on trigger "TG_TLPRECLASSIF_SEMAPAGAR" on public."TL_PRE_CLASSIFICACAO" is 'Log das execuções não se apaga (FC_TG_PRE_CLASSIF_IMUTAVEL).';
comment on trigger "TG_THPRECLASSIF_IMUTAVEL" on public."TH_PRE_CLASSIFICACAO" is 'Histórico imutável (FC_TG_PRE_CLASSIF_IMUTAVEL).';

alter table public."TL_PRE_CLASSIFICACAO" enable row level security;
alter table public."TB_PRE_CLASSIFICACAO" enable row level security;
alter table public."TB_PRE_CLASSIF_VAGA" enable row level security;
alter table public."TH_PRE_CLASSIFICACAO" enable row level security;
revoke all on public."TL_PRE_CLASSIFICACAO", public."TB_PRE_CLASSIFICACAO", public."TB_PRE_CLASSIF_VAGA",
  public."TH_PRE_CLASSIFICACAO" from public, anon, authenticated;

-- 6. Campos novos da regra: desempate da Provisória e lote por vaga ------------------------
/*
  FC_VALIDAR_REGRA_ANALISE (F1) ignora chaves que não conhece. Os dois campos
  novos (src/lib/avaliacao-documental/regra.js) são conferidos aqui, em toda
  versão nova da regra, com as mesmas mensagens do JavaScript.
*/
create function private."FC_TG_REGRA_ANALISE_F2"()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  v_desempate jsonb := new."DS_CONFIGURACAO" -> 'provisoria' -> 'desempate';
  v_por_vaga jsonb := new."DS_CONFIGURACAO" -> 'lote' -> 'por_vaga';
begin
  if v_desempate is not null and jsonb_typeof(v_desempate) <> 'null' then
    if jsonb_typeof(v_desempate) <> 'array' or jsonb_array_length(v_desempate) > 3
       or exists (select 1 from jsonb_array_elements(v_desempate) d
                   where jsonb_typeof(d) <> 'string' or d #>> '{}' not in ('IDOSO', 'MAIS_VELHO', 'CANDIDATURA'))
       or (select count(distinct d #>> '{}') from jsonb_array_elements(v_desempate) d) <> jsonb_array_length(v_desempate) then
      raise exception 'Desempate da Provisória: IDOSO, MAIS_VELHO ou CANDIDATURA, sem repetir.' using errcode = '22023';
    end if;
  end if;
  if v_por_vaga is not null and jsonb_typeof(v_por_vaga) <> 'null' then
    if jsonb_typeof(v_por_vaga) <> 'object'
       or (select count(*) from jsonb_object_keys(v_por_vaga)) > 500
       or exists (select 1 from jsonb_each(v_por_vaga) p
                   where p.key !~ '^[0-9]{1,20}$'
                      or case when jsonb_typeof(p.value) <> 'number' then true
                              else (p.value #>> '{}')::numeric <> trunc((p.value #>> '{}')::numeric)
                                   or (p.value #>> '{}')::numeric not between 1 and 100000 end) then
      raise exception 'Lote por vaga: código da vaga (só dígitos) e tamanho inteiro de 1 a 100.000.' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$function$;
comment on function private."FC_TG_REGRA_ANALISE_F2"() is
  'Gatilho de TH_REGRA_ANALISE: confere os campos da fase F2 que FC_VALIDAR_REGRA_ANALISE não conhece — provisoria.desempate (IDOSO, MAIS_VELHO, CANDIDATURA, sem repetir) e lote.por_vaga (código da vaga → tamanho inteiro de 1 a 100.000). 22023 com a mensagem do formulário.';
revoke all on function private."FC_TG_REGRA_ANALISE_F2"() from public, anon, authenticated;

create trigger "TG_THREGRAANALISE_CAMPOSF2" before insert on public."TH_REGRA_ANALISE"
  for each row execute function private."FC_TG_REGRA_ANALISE_F2"();
comment on trigger "TG_THREGRAANALISE_CAMPOSF2" on public."TH_REGRA_ANALISE" is 'Confere o desempate da Provisória e o lote por vaga (FC_TG_REGRA_ANALISE_F2).';

-- 7. As duas listas oficiais novas na Classificação --------------------------------------
alter table public."TB_LISTA_CLASSIFICACAO" drop constraint "CK_LISTACLASSIF_TPLISTA";
alter table public."TB_LISTA_CLASSIFICACAO"
  add constraint "CK_LISTACLASSIF_TPLISTA" check ("TP_LISTA" in ('PROVISORIA', 'LOTE', 'PRELIMINAR', 'CONVOCACAO', 'ENTREVISTA', 'FINAL'));
comment on constraint "CK_LISTACLASSIF_TPLISTA" on public."TB_LISTA_CLASSIFICACAO" is
  'Tipos de lista válidos: PROVISORIA (por ART, item 8.3.1) e LOTE (lote de convocação, item 8.4), vindos da pré-classificação; PRELIMINAR, CONVOCACAO, ENTREVISTA e FINAL, do motor da Classificação.';
comment on column public."TB_LISTA_CLASSIFICACAO"."TP_LISTA" is
  'PROVISORIA (Lista Geral de Classificação Provisória por ART) e LOTE (Lote de Convocação), registradas a partir de TB_PRE_CLASSIFICACAO; PRELIMINAR (avaliação documental), CONVOCACAO (para entrevista), ENTREVISTA (resultado da entrevista) ou FINAL (resultado final).';

-- 8. Funções de apoio ---------------------------------------------------------------------
create function private."FC_EXIGIR_EXECUCAO_PRECLASSIF"(p_execucao text)
returns public."TL_PRE_CLASSIFICACAO"
language plpgsql
stable
set search_path to ''
as $function$
declare
  v public."TL_PRE_CLASSIFICACAO";
begin
  if p_execucao is null or p_execucao !~ '^[A-Za-z0-9_-]{8,80}$' then
    raise exception 'Identificador de execução inválido' using errcode = '22023';
  end if;
  select * into v from public."TL_PRE_CLASSIFICACAO" t where t."CO_EXECUCAO" = p_execucao;
  if v."CO_EXECUCAO" is null or v."TP_SITUACAO" <> 'EM_ANDAMENTO' then
    raise exception 'Execução % não encontrada ou já fechada', p_execucao using errcode = '22023';
  end if;
  return v;
end;
$function$;
comment on function private."FC_EXIGIR_EXECUCAO_PRECLASSIF"(text) is 'Recusa (22023) identificador inválido ou execução da pré-classificação que não está em andamento; devolve a execução.';
revoke all on function private."FC_EXIGIR_EXECUCAO_PRECLASSIF"(text) from public, anon, authenticated;

create function private."FC_ROTULO_DO_EDITAL"(p_edital text)
returns text
language sql
stable
set search_path to ''
as $function$
  select coalesce(private."FC_NUMERO_EDITAL"(p_edital), nullif(left(btrim(p_edital), 100), ''));
$function$;
comment on function private."FC_ROTULO_DO_EDITAL"(text) is 'O número do edital ("93/2026") ou, sem número (ex.: "FCC"), o nome cadastrado.';
revoke all on function private."FC_ROTULO_DO_EDITAL"(text) from public, anon, authenticated;

create function private."FC_QUADRO_DA_VAGA_EMPREGARE"(p_edital uuid, p_vaga text)
returns public."TB_QUADRO_VAGA_EDITAL"
language sql
stable
set search_path to ''
as $function$
  select q.*
    from private."FC_EMPREGARE_VAGAS_DO_QUADRO"(p_vaga) v
    join public."TB_QUADRO_VAGA_EDITAL" q
      on q."CO_QUADRO_VAGA" = v.quadro_id and q."CO_MONITORAMENTO" = p_edital and q."ST_REGISTRO_ATIVO" = 'S'
   where v.edital_id = p_edital
   limit 1;
$function$;
comment on function private."FC_QUADRO_DA_VAGA_EMPREGARE"(uuid, text) is 'A linha vigente do quadro de vagas do edital ligada à vaga da Empregare (FC_EMPREGARE_VAGAS_DO_QUADRO); nula sem ligação única.';
revoke all on function private."FC_QUADRO_DA_VAGA_EMPREGARE"(uuid, text) from public, anon, authenticated;

create function private."FC_LINHAS_PRE_CLASSIF"(p_linhas jsonb)
returns table (
  id uuid, situacao text, motivo_codigo text, motivo text, art numeric, nota numeric, origem_nota text,
  declarada numeric, declarada_parciais jsonb, sem_mapa integer, divergente boolean, modalidade text,
  posicao integer, posicao_modalidade integer, lote integer, lista_lote text, entrada text, motivo_entrada text)
language sql
immutable
set search_path to ''
as $function$
  select (l ->> 'id')::uuid, l ->> 'situacao', l ->> 'motivo_codigo', l ->> 'motivo',
         (l ->> 'art')::numeric, (l ->> 'nota')::numeric, l ->> 'origem_nota',
         (l ->> 'declarada')::numeric, case when jsonb_typeof(l -> 'declarada_parciais') = 'object' then l -> 'declarada_parciais' end,
         coalesce((l ->> 'sem_mapa')::integer, 0), coalesce((l ->> 'divergente')::boolean, false),
         coalesce(l ->> 'modalidade', 'AC'), (l ->> 'posicao')::integer, (l ->> 'posicao_modalidade')::integer,
         (l ->> 'lote')::integer, l ->> 'lista_lote', l ->> 'entrada', l ->> 'motivo_entrada'
    from jsonb_array_elements(p_linhas) l;
$function$;
comment on function private."FC_LINHAS_PRE_CLASSIF"(jsonb) is 'As linhas da pré-classificação de uma vaga enviadas pelo job (lista json) como tabela tipada; tipo inválido levanta erro de conversão.';
revoke all on function private."FC_LINHAS_PRE_CLASSIF"(jsonb) from public, anon, authenticated;

-- 9. Leitura para o job (service_role) ---------------------------------------------------
create function public.pre_classificacao_ler_editais(p_editais text[] default null, p_apos_robo boolean default false)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_pedidos text[] := array(select btrim(x) from unnest(coalesce(p_editais, '{}')) x where btrim(x) <> '');
  v_ids uuid[];
  v_sync text;
begin
  if cardinality(v_pedidos) > 100 then
    raise exception 'Até 100 editais por execução' using errcode = '22023';
  end if;
  if cardinality(v_pedidos) > 0 then
    -- Cada pedido é o id do edital, o número ("93/2026") ou, sem número, o nome ("FCC").
    select coalesce(array_agg(distinct m.id), '{}') into v_ids
      from public."TB_MONITORAMENTO_INDIGENA" m
      join unnest(v_pedidos) p(texto)
        on m.id::text = lower(p.texto)
        or private."FC_NUMERO_EDITAL"(m.edital) = p.texto
        or lower(btrim(m.edital)) = lower(p.texto);
  elsif p_apos_robo then
    -- Os editais das vagas gravadas na última execução fechada do robô.
    select s."CO_SYNC" into v_sync
      from public."TL_SYNC_EMPREGARE" s
     where s."TP_SITUACAO" in ('CONCLUIDA', 'PARCIAL')
     order by s."DT_INICIO" desc limit 1;
    select coalesce(array_agg(distinct v."CO_MONITORAMENTO"), '{}') into v_ids
      from public."TB_EMPREGARE_VAGA" v
     where v."CO_SYNC" = v_sync and v."CO_MONITORAMENTO" is not null;
  else
    select coalesce(array_agg(distinct v."CO_MONITORAMENTO"), '{}') into v_ids
      from public."TB_EMPREGARE_VAGA" v
      join public."TB_MONITORAMENTO_INDIGENA" m on m.id = v."CO_MONITORAMENTO"
     where coalesce(m.ativo, false);
  end if;

  return jsonb_build_object(
    'hoje', (now() at time zone 'America/Sao_Paulo')::date,
    'sync', v_sync,
    'nao_encontrados', coalesce((
      select jsonb_agg(p.texto order by p.texto)
        from unnest(v_pedidos) p(texto)
       where not exists (select 1 from public."TB_MONITORAMENTO_INDIGENA" m
                          where m.id::text = lower(p.texto)
                             or private."FC_NUMERO_EDITAL"(m.edital) = p.texto
                             or lower(btrim(m.edital)) = lower(p.texto))), '[]'::jsonb),
    'editais', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', m.id,
               'rotulo', private."FC_ROTULO_DO_EDITAL"(m.edital),
               'area', m."CO_AREA",
               'ativo', coalesce(m.ativo, false),
               'regra', (select jsonb_build_object('versao', r."NU_VERSAO_VIGENTE", 'situacao', r."TP_SITUACAO",
                                                   'configuracao', h."DS_CONFIGURACAO")
                           from public."TB_REGRA_ANALISE" r
                           join public."TH_REGRA_ANALISE" h
                             on h."CO_REGRA_ANALISE" = r."CO_REGRA_ANALISE" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
                          where r."CO_MONITORAMENTO" = m.id),
               'refazer_permitido', not exists (select 1 from public."TB_PRE_CLASSIFICACAO" a
                                                 where a."CO_MONITORAMENTO" = m.id and a."TP_SITUACAO" = 'ANALISADO'),
               'vagas', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'codigo', v."CO_VAGA",
                          'situacao_carga', v."TP_SITUACAO",
                          'candidatos_ativos', v."QT_CANDIDATO_ATIVO",
                          'ultima_carga', v."DT_ULTIMA_CARGA",
                          'ultimo_lote', coalesce(pv."NU_ULTIMO_LOTE", 0),
                          'quadro', case when q."CO_QUADRO_VAGA" is null then null else jsonb_build_object(
                            'id', q."CO_QUADRO_VAGA", 'vagas_imediatas', q."QT_VAGA_IMEDIATA",
                            'cadastro_reserva', q."ST_CADASTRO_RESERVA" = 'S', 'modalidades', q."DS_MODALIDADE_VAGA") end)
                        order by v."CO_VAGA")
                   from public."TB_EMPREGARE_VAGA" v
                   left join public."TB_PRE_CLASSIF_VAGA" pv on pv."CO_MONITORAMENTO" = m.id and pv."CO_VAGA" = v."CO_VAGA"
                   left join lateral (select * from private."FC_QUADRO_DA_VAGA_EMPREGARE"(m.id, v."CO_VAGA")) q on true
                  where v."CO_MONITORAMENTO" = m.id), '[]'::jsonb))
             order by private."FC_ROTULO_DO_EDITAL"(m.edital), m.id)
        from public."TB_MONITORAMENTO_INDIGENA" m
       where m.id = any (v_ids)), '[]'::jsonb)
  );
end;
$function$;
comment on function public.pre_classificacao_ler_editais(text[], boolean) is
  'Pré-classificação (job Python): os editais a processar — os pedidos (id, número ou nome), os da última carga fechada do robô (p_apos_robo) ou, sem filtro, os ativos com vagas da Empregare — com a regra vigente (versão, situação e configuração), se o lote ainda pode ser refeito e as vagas (carga, último lote, linha do quadro com vagas imediatas, cadastro reserva e modalidades). Sem dado pessoal. Só service_role.';

create function public.pre_classificacao_ler_candidatos(p_edital uuid, p_vaga text)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if not exists (select 1 from public."TB_EMPREGARE_VAGA" v where v."CO_VAGA" = p_vaga and v."CO_MONITORAMENTO" = p_edital) then
    raise exception 'A vaga % não é do edital', p_vaga using errcode = '22023';
  end if;
  return jsonb_build_object(
    'candidatos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c."CO_EMPREGARE_CANDIDATO",
               'codigo', coalesce(c."CO_CANDIDATO_EMPREGARE", left(c."DS_CHAVE_CANDIDATO", 12)),
               'ativo', c."ST_REGISTRO_ATIVO" = 'S',
               'nascimento', c."DT_NASCIMENTO",
               'candidatura', to_char(c."DT_CANDIDATURA" at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"+00:00"'),
               -- As respostas do questionário e as colunas do processo, sem as do cadastro.
               'colunas', coalesce((
                 select jsonb_object_agg(k.key, k.value)
                   from jsonb_each(c."DS_COLUNA_ORIGINAL") k
                  where lower(k.key) like 'pergunta %'
                     or lower(k.key) !~ '(nome|e-?mail|cpf|telefone|celular|whatsapp|endere|logradouro|bairro|cep|nascimento|linkedin|^rg$|documento)'),
                 '{}'::jsonb))
             order by c."CO_EMPREGARE_CANDIDATO")
        from public."TB_EMPREGARE_CANDIDATO" c
       where c."CO_VAGA" = p_vaga), '[]'::jsonb),
    'anterior', coalesce((
      select jsonb_object_agg(a."CO_EMPREGARE_CANDIDATO", jsonb_build_object(
               'situacao', a."TP_SITUACAO", 'posicao', a."NU_POSICAO", 'lote', a."NU_LOTE",
               'lista_lote', a."CO_LISTA_LOTE", 'entrada', a."TP_ENTRADA_LOTE", 'motivo_entrada', a."DS_MOTIVO_ENTRADA"))
        from public."TB_PRE_CLASSIFICACAO" a
       where a."CO_MONITORAMENTO" = p_edital and a."CO_VAGA" = p_vaga), '{}'::jsonb)
  );
end;
$function$;
comment on function public.pre_classificacao_ler_candidatos(uuid, text) is
  'Pré-classificação (job Python): os inscritos de uma vaga do edital (id, código, ativo, nascimento, data da candidatura e as colunas do questionário e do processo SEM as do cadastro — nome, e-mail, CPF, telefone, endereço) e a situação anterior de cada um (situação, posição, lote, lista e entrada). Só service_role.';

-- 10. Gravação (service_role) ------------------------------------------------------------
create function public.iniciar_pre_classificacao(
  p_execucao text, p_disparo text, p_usuario uuid default null, p_url text default null,
  p_refazer boolean default false, p_pedido jsonb default '[]'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_interrompidas integer;
begin
  if p_execucao is null or p_execucao !~ '^[A-Za-z0-9_-]{8,80}$' then
    raise exception 'Identificador de execução inválido' using errcode = '22023';
  end if;
  if p_disparo is null or p_disparo not in ('ROBO', 'MONITORA', 'GITHUB') then
    raise exception 'Disparo inválido: ROBO, MONITORA ou GITHUB' using errcode = '22023';
  end if;
  if (p_disparo = 'MONITORA') <> (p_usuario is not null) then
    raise exception 'Usuário só (e sempre) no disparo pelo MONITORA' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_pedido, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_pedido, '[]'::jsonb)) > 100
     or exists (select 1 from jsonb_array_elements(coalesce(p_pedido, '[]'::jsonb)) e
                 where jsonb_typeof(e) <> 'string' or length(e #>> '{}') > 100
                    or not private."FC_TEXTO_SEGURO_DO_AVISO"(e #>> '{}')) then
    raise exception 'Pedido inválido: até 100 editais (id, número ou nome)' using errcode = '22023';
  end if;

  -- Execução que morreu sem fechar (o workflow tem tempo limite de 20 min) não segura as próximas.
  update public."TL_PRE_CLASSIFICACAO" set
    "TP_SITUACAO" = 'FALHOU', "DT_FIM" = now(),
    "DS_MENSAGEM" = 'Interrompida: a execução terminou sem fechar.'
   where "TP_SITUACAO" = 'EM_ANDAMENTO' and "DT_INICIO" < now() - interval '1 hour';
  get diagnostics v_interrompidas = row_count;

  if exists (select 1 from public."TL_PRE_CLASSIFICACAO" t where t."TP_SITUACAO" = 'EM_ANDAMENTO') then
    raise exception 'Já há uma pré-classificação em andamento' using errcode = '55P03';
  end if;

  insert into public."TL_PRE_CLASSIFICACAO"
    ("CO_EXECUCAO", "TP_DISPARO", "CO_USUARIO_DISPARO", "DS_URL_EXECUCAO", "ST_REFAZER_LOTE", "DS_PEDIDO")
  values (p_execucao, p_disparo, p_usuario, left(p_url, 300),
          case when coalesce(p_refazer, false) then 'S' else 'N' end, coalesce(p_pedido, '[]'::jsonb));

  return jsonb_build_object('execucao', p_execucao, 'interrompidas', v_interrompidas);
end;
$function$;
comment on function public.iniciar_pre_classificacao(text, text, uuid, text, boolean, jsonb) is
  'Abre uma execução da pré-classificação em TL_PRE_CLASSIFICACAO (quem disparou, se refaz o lote, os editais pedidos, o endereço da execução). Fecha como FALHOU a esquecida há mais de 1 h e recusa (55P03) se outra estiver em andamento. Só service_role.';

create function public.gravar_pre_classificacao_vaga(
  p_execucao text, p_edital uuid, p_vaga text, p_versao_regra integer, p_resumo jsonb, p_linhas jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_exec public."TL_PRE_CLASSIFICACAO" := private."FC_EXIGIR_EXECUCAO_PRECLASSIF"(p_execucao);
  v_refazer boolean := v_exec."ST_REFAZER_LOTE" = 'S';
  v_quadro public."TB_QUADRO_VAGA_EDITAL";
  v_qt integer;
  v_erro text;
  v_mudancas integer;
  v_avisos jsonb := coalesce(p_resumo -> 'avisos', '[]'::jsonb);
  v_ant jsonb;
begin
  -- A regra usada é a vigente e está conferida.
  if not exists (select 1 from public."TB_REGRA_ANALISE" r
                  where r."CO_MONITORAMENTO" = p_edital and r."NU_VERSAO_VIGENTE" = p_versao_regra
                    and r."TP_SITUACAO" = 'CONFERIDA') then
    raise exception 'A regra do edital mudou ou não está conferida; rode de novo' using errcode = '40001';
  end if;
  if not exists (select 1 from public."TB_EMPREGARE_VAGA" v where v."CO_VAGA" = p_vaga and v."CO_MONITORAMENTO" = p_edital) then
    raise exception 'A vaga % não é do edital', p_vaga using errcode = '22023';
  end if;
  if jsonb_typeof(p_linhas) is distinct from 'array' or jsonb_array_length(p_linhas) > 20000 then
    raise exception 'Linhas inválidas (lista de até 20000)' using errcode = '22023';
  end if;
  if jsonb_typeof(p_resumo) is distinct from 'object' or jsonb_typeof(v_avisos) <> 'array' or jsonb_array_length(v_avisos) > 50
     or exists (select 1 from jsonb_array_elements(v_avisos) a where jsonb_typeof(a) <> 'string' or a #>> '{}' !~ '^[A-Z][A-Z0-9_:]{1,59}$')
     or length(coalesce(p_resumo ->> 'descricao', '')) > 200
     or (p_resumo -> 'tamanho' is not null and jsonb_typeof(p_resumo -> 'tamanho') not in ('number', 'null'))
     or (p_resumo -> 'por_modalidade' is not null and jsonb_typeof(p_resumo -> 'por_modalidade') not in ('object', 'null')) then
    raise exception 'Resumo da vaga inválido' using errcode = '22023';
  end if;

  begin
    perform count(*) from private."FC_LINHAS_PRE_CLASSIF"(p_linhas);
  exception when invalid_text_representation or numeric_value_out_of_range or datatype_mismatch then
    raise exception 'Linha com tipo inválido (id, nota, posição ou lote)' using errcode = '22023';
  end;

  -- A forma do resultado (as mesmas regras das CK_, com mensagem clara).
  select case
    when exists (select 1 from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t where t.id is null) then 'linha sem id'
    when (select count(*) from private."FC_LINHAS_PRE_CLASSIF"(p_linhas)) <> (select count(distinct t.id) from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t) then 'inscrito repetido'
    when exists (select 1 from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t
                  where not exists (select 1 from public."TB_EMPREGARE_CANDIDATO" c
                                     where c."CO_EMPREGARE_CANDIDATO" = t.id and c."CO_VAGA" = p_vaga)) then 'inscrito que não é da vaga'
    when exists (select 1 from public."TB_PRE_CLASSIFICACAO" a
                  where a."CO_MONITORAMENTO" = p_edital and a."CO_VAGA" = p_vaga
                    and not exists (select 1 from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t where t.id = a."CO_EMPREGARE_CANDIDATO")) then 'faltam inscritos já pré-classificados'
    when exists (select 1 from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t where t.situacao is null or t.situacao not in ('ELIMINADO', 'RANQUEADO', 'NO_LOTE', 'ANALISADO')) then 'situação inválida'
    when exists (select 1 from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t
                  where (t.situacao = 'ELIMINADO') <> (t.motivo_codigo is not null)
                     or (t.motivo_codigo is not null and (t.motivo_codigo !~ '^[A-Z][A-Z0-9_]{1,29}$'
                         or coalesce(length(btrim(t.motivo)), 0) not between 1 and 200))) then 'eliminado sem motivo (ou motivo fora de eliminado)'
    when exists (select 1 from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t
                  where (t.situacao = 'ELIMINADO' and (t.posicao is not null or t.posicao_modalidade is not null))
                     or (t.situacao <> 'ELIMINADO' and (coalesce(t.posicao, 0) < 1 or coalesce(t.posicao_modalidade, 0) < 1))) then 'posição inválida'
    when (select count(*) from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t where t.situacao <> 'ELIMINADO')
         <> coalesce((select max(t.posicao) from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t where t.situacao <> 'ELIMINADO'), 0)
      or (select count(distinct t.posicao) from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t where t.situacao <> 'ELIMINADO')
         <> (select count(*) from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t where t.situacao <> 'ELIMINADO') then 'posições não vão de 1 a N sem repetir'
    when exists (select 1 from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t
                  where case when t.situacao in ('NO_LOTE', 'ANALISADO')
                             then coalesce(t.lote, 0) not between 1 and 999
                                  or coalesce(t.lista_lote, '') !~ '^(GERAL|[A-Z]{2,10})$'
                                  or coalesce(t.entrada, '') not in ('INICIAL', 'REPOSICAO', 'AMPLIACAO')
                                  or length(coalesce(t.motivo_entrada, '')) > 300
                             else t.lote is not null or t.lista_lote is not null or t.entrada is not null end) then 'lote inválido'
    when exists (select 1 from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t
                  where coalesce(t.origem_nota, 'ART') not in ('ART', 'DECLARADA')
                     or t.modalidade !~ '^[A-Z]{2,10}$'
                     or abs(coalesce(t.art, 0)) > 1000 or abs(coalesce(t.nota, 0)) > 1000 or abs(coalesce(t.declarada, 0)) > 1000
                     or t.sem_mapa not between 0 and 100) then 'nota, origem ou modalidade inválida'
    else null end
    into v_erro;
  if v_erro is not null then
    raise exception 'Resultado da vaga % recusado: %', p_vaga, v_erro using errcode = '22023';
  end if;

  -- A situação de antes de cada inscrito (para as travas e o histórico).
  select coalesce(jsonb_object_agg(a."CO_EMPREGARE_CANDIDATO", jsonb_build_object('s', a."TP_SITUACAO", 'l', a."NU_LOTE")), '{}'::jsonb)
    into v_ant
    from public."TB_PRE_CLASSIFICACAO" a
   where a."CO_MONITORAMENTO" = p_edital and a."CO_VAGA" = p_vaga;

  -- Quem tem ficha (ANALISADO) não muda; ANALISADO só vem do banco (fase F3).
  if exists (select 1 from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t
               cross join lateral (select v_ant -> t.id::text ->> 's' as ant_situacao, (v_ant -> t.id::text ->> 'l')::integer as ant_lote) h
              where (h.ant_situacao is not distinct from 'ANALISADO') <> (t.situacao = 'ANALISADO')
                 or (h.ant_situacao = 'ANALISADO' and h.ant_lote is distinct from t.lote)) then
    raise exception 'Resultado da vaga % recusado: quem já tem ficha não muda', p_vaga using errcode = '22023';
  end if;
  -- Quem está no lote só sai eliminado (a não ser que a execução refaça o lote).
  if not v_refazer and exists (
      select 1 from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t
       cross join lateral (select v_ant -> t.id::text ->> 's' as ant_situacao, (v_ant -> t.id::text ->> 'l')::integer as ant_lote) h
       where h.ant_situacao = 'NO_LOTE'
         and not (t.situacao = 'ELIMINADO' or (t.situacao = 'NO_LOTE' and t.lote = h.ant_lote))) then
    raise exception 'Resultado da vaga % recusado: quem está no lote só sai eliminado (AM-5.5)', p_vaga using errcode = '22023';
  end if;

  -- Grava o resultado (rodar de novo atualiza a mesma linha: AM-4.2).
  insert into public."TB_PRE_CLASSIFICACAO" as a
    ("CO_MONITORAMENTO", "CO_EMPREGARE_CANDIDATO", "CO_VAGA", "NU_VERSAO_REGRA", "TP_SITUACAO",
     "CO_MOTIVO_ELIMINACAO", "DS_MOTIVO_ELIMINACAO", "VL_ART", "VL_NOTA_ORDEM", "TP_ORIGEM_NOTA",
     "VL_NOTA_DECLARADA", "DS_NOTA_DECLARADA", "ST_DIVERGENTE", "NO_MODALIDADE", "NU_POSICAO",
     "NU_POSICAO_MODALIDADE", "NU_LOTE", "CO_LISTA_LOTE", "TP_ENTRADA_LOTE", "DS_MOTIVO_ENTRADA",
     "DT_ENTRADA_LOTE", "CO_EXECUCAO")
  select p_edital, t.id, p_vaga, p_versao_regra, t.situacao,
         t.motivo_codigo, left(btrim(t.motivo), 200), t.art, t.nota, t.origem_nota,
         t.declarada,
         case when t.declarada is null then null
              else jsonb_build_object('parciais', coalesce(t.declarada_parciais, '{}'::jsonb), 'sem_mapa', t.sem_mapa) end,
         case when t.divergente then 'S' else 'N' end, t.modalidade, t.posicao,
         t.posicao_modalidade, t.lote, t.lista_lote, t.entrada, nullif(left(btrim(t.motivo_entrada), 300), ''),
         case when t.lote is not null then now() end, p_execucao
    from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t
  on conflict ("CO_MONITORAMENTO", "CO_EMPREGARE_CANDIDATO") do update set
    "NU_VERSAO_REGRA" = excluded."NU_VERSAO_REGRA",
    "TP_SITUACAO" = excluded."TP_SITUACAO",
    "CO_MOTIVO_ELIMINACAO" = excluded."CO_MOTIVO_ELIMINACAO",
    "DS_MOTIVO_ELIMINACAO" = excluded."DS_MOTIVO_ELIMINACAO",
    "VL_ART" = excluded."VL_ART",
    "VL_NOTA_ORDEM" = excluded."VL_NOTA_ORDEM",
    "TP_ORIGEM_NOTA" = excluded."TP_ORIGEM_NOTA",
    "VL_NOTA_DECLARADA" = excluded."VL_NOTA_DECLARADA",
    "DS_NOTA_DECLARADA" = excluded."DS_NOTA_DECLARADA",
    "ST_DIVERGENTE" = excluded."ST_DIVERGENTE",
    "NO_MODALIDADE" = excluded."NO_MODALIDADE",
    "NU_POSICAO" = excluded."NU_POSICAO",
    "NU_POSICAO_MODALIDADE" = excluded."NU_POSICAO_MODALIDADE",
    "NU_LOTE" = excluded."NU_LOTE",
    "CO_LISTA_LOTE" = excluded."CO_LISTA_LOTE",
    "TP_ENTRADA_LOTE" = excluded."TP_ENTRADA_LOTE",
    "DS_MOTIVO_ENTRADA" = excluded."DS_MOTIVO_ENTRADA",
    -- Quem continua no mesmo lote guarda a data de entrada.
    "DT_ENTRADA_LOTE" = case when excluded."NU_LOTE" is null then null
                             when a."NU_LOTE" is not distinct from excluded."NU_LOTE" then a."DT_ENTRADA_LOTE"
                             else now() end,
    "CO_EXECUCAO" = excluded."CO_EXECUCAO",
    "DT_ATUALIZACAO" = now();

  -- Histórico: entrada na lista, troca de situação ou de lote (com o motivo).
  insert into public."TH_PRE_CLASSIFICACAO"
    ("CO_EXECUCAO", "CO_MONITORAMENTO", "CO_EMPREGARE_CANDIDATO", "CO_VAGA", "TP_SITUACAO_ANTERIOR",
     "TP_SITUACAO", "NU_LOTE_ANTERIOR", "NU_LOTE", "NU_POSICAO", "DS_MOTIVO")
  select p_execucao, p_edital, t.id, p_vaga, h.ant_situacao, t.situacao, h.ant_lote, t.lote, t.posicao,
         left(case when t.situacao = 'ELIMINADO' then t.motivo
                   when t.lote is not null and t.lote is distinct from h.ant_lote then t.motivo_entrada
                   when h.ant_situacao = 'NO_LOTE' and t.situacao = 'RANQUEADO' then 'Saiu do lote: o recorte foi refeito'
                   when h.ant_situacao is null then 'Entrou na Provisória'
                   else null end, 300)
    from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t
   cross join lateral (select v_ant -> t.id::text ->> 's' as ant_situacao, (v_ant -> t.id::text ->> 'l')::integer as ant_lote) h
   where h.ant_situacao is null
      or h.ant_situacao is distinct from t.situacao
      or h.ant_lote is distinct from t.lote;
  get diagnostics v_mudancas = row_count;

  -- O resumo da vaga: contagens feitas aqui; quadro lido aqui.
  v_quadro := private."FC_QUADRO_DA_VAGA_EMPREGARE"(p_edital, p_vaga);
  select count(*) into v_qt from private."FC_LINHAS_PRE_CLASSIF"(p_linhas);
  insert into public."TB_PRE_CLASSIF_VAGA" as pv
    ("CO_MONITORAMENTO", "CO_VAGA", "CO_EXECUCAO", "NU_VERSAO_REGRA", "CO_QUADRO_VAGA", "NO_CARGO", "NO_LOTACAO",
     "QT_VAGA_IMEDIATA", "ST_CADASTRO_RESERVA", "QT_INSCRITO", "QT_ELIMINADO", "QT_RANQUEADO", "QT_LOTE",
     "QT_TAMANHO_LOTE", "DS_TAMANHO_LOTE", "DS_TAMANHO_MODALIDADE", "VL_ART_CORTE", "QT_DIVERGENCIA", "QT_SEM_ART",
     "QT_ACIMA_CORTE", "NU_ULTIMO_LOTE", "DS_AVISO")
  select p_edital, p_vaga, p_execucao, p_versao_regra, v_quadro."CO_QUADRO_VAGA", v_quadro."NO_CARGO", v_quadro."NO_LOTACAO",
         v_quadro."QT_VAGA_IMEDIATA", coalesce(v_quadro."ST_CADASTRO_RESERVA", 'N'), v_qt,
         count(*) filter (where t.situacao = 'ELIMINADO'),
         count(*) filter (where t.situacao <> 'ELIMINADO'),
         count(*) filter (where t.situacao in ('NO_LOTE', 'ANALISADO')),
         case when jsonb_typeof(p_resumo -> 'tamanho') = 'number'
              then greatest(0, least(100000, (p_resumo ->> 'tamanho')::numeric))::integer end,
         nullif(left(btrim(coalesce(p_resumo ->> 'descricao', '')), 200), ''),
         case when jsonb_typeof(p_resumo -> 'por_modalidade') = 'object' then p_resumo -> 'por_modalidade' end,
         min(t.nota) filter (where t.situacao in ('NO_LOTE', 'ANALISADO')),
         count(*) filter (where t.divergente),
         count(*) filter (where t.situacao <> 'ELIMINADO' and t.art is null),
         case when jsonb_typeof(p_resumo -> 'acima_do_corte') = 'number'
              then greatest(0, least(100000, (p_resumo ->> 'acima_do_corte')::numeric))::integer else 0 end,
         coalesce(max(t.lote), 0),
         v_avisos
    from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t
  on conflict ("CO_MONITORAMENTO", "CO_VAGA") do update set
    "CO_EXECUCAO" = excluded."CO_EXECUCAO",
    "NU_VERSAO_REGRA" = excluded."NU_VERSAO_REGRA",
    "CO_QUADRO_VAGA" = excluded."CO_QUADRO_VAGA",
    "NO_CARGO" = excluded."NO_CARGO",
    "NO_LOTACAO" = excluded."NO_LOTACAO",
    "QT_VAGA_IMEDIATA" = excluded."QT_VAGA_IMEDIATA",
    "ST_CADASTRO_RESERVA" = excluded."ST_CADASTRO_RESERVA",
    "QT_INSCRITO" = excluded."QT_INSCRITO",
    "QT_ELIMINADO" = excluded."QT_ELIMINADO",
    "QT_RANQUEADO" = excluded."QT_RANQUEADO",
    "QT_LOTE" = excluded."QT_LOTE",
    "QT_TAMANHO_LOTE" = excluded."QT_TAMANHO_LOTE",
    "DS_TAMANHO_LOTE" = excluded."DS_TAMANHO_LOTE",
    "DS_TAMANHO_MODALIDADE" = excluded."DS_TAMANHO_MODALIDADE",
    "VL_ART_CORTE" = excluded."VL_ART_CORTE",
    "QT_DIVERGENCIA" = excluded."QT_DIVERGENCIA",
    "QT_SEM_ART" = excluded."QT_SEM_ART",
    "QT_ACIMA_CORTE" = excluded."QT_ACIMA_CORTE",
    "NU_ULTIMO_LOTE" = greatest(pv."NU_ULTIMO_LOTE", excluded."NU_ULTIMO_LOTE"),
    "DS_AVISO" = excluded."DS_AVISO",
    "DT_ATUALIZACAO" = now();

  return jsonb_build_object('vaga', p_vaga, 'inscritos', v_qt, 'mudancas', v_mudancas);
end;
$function$;
comment on function public.gravar_pre_classificacao_vaga(text, uuid, text, integer, jsonb, jsonb) is
  'Grava a pré-classificação PRONTA de uma vaga (calculada pelo job Python): confere a regra vigente e conferida (40001), que os inscritos são da vaga, que nenhum já gravado falta, a forma (eliminado com motivo, posições de 1 a N, lote com número, lista e entrada), que quem tem ficha não muda e que quem está no lote só sai eliminado (salvo execução que refaz o lote); grava o histórico das mudanças com o motivo e o resumo da vaga (contagens feitas no banco; quadro lido no banco). 22023 com o motivo da recusa. Só service_role.';

create function public.finalizar_pre_classificacao(p_execucao text, p_editais jsonb default '[]'::jsonb, p_erro text default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_exec public."TL_PRE_CLASSIFICACAO" := private."FC_EXIGIR_EXECUCAO_PRECLASSIF"(p_execucao);
  v_mensagem text := nullif(left(btrim(coalesce(p_erro, '')), 2000), '');
  v_editais jsonb := coalesce(p_editais, '[]'::jsonb);
  v_situacao text;
begin
  if jsonb_typeof(v_editais) <> 'array' or jsonb_array_length(v_editais) > 500
     or exists (select 1 from jsonb_array_elements(v_editais) e
                 where jsonb_typeof(e) <> 'object'
                    or coalesce(e ->> 'edital', '') !~ '^[0-9a-f-]{36}$'
                    or coalesce(e ->> 'situacao', '') !~ '^[A-Z][A-Z_]{1,29}$'
                    or length(e::text) > 4000
                    -- O id do edital (uuid) pode ter 11 dígitos seguidos: confere o resto.
                    or not private."FC_TEXTO_SEGURO_DO_AVISO"((e - 'edital')::text)) then
    raise exception 'Resultado por edital inválido (até 500, com edital, situação e só códigos e contagens)' using errcode = '22023';
  end if;
  if v_mensagem is not null and not private."FC_TEXTO_SEGURO_DO_AVISO"(v_mensagem) then
    v_mensagem := 'Erro geral (a mensagem foi omitida por parecer ter dado pessoal).';
  end if;
  v_situacao := case
    when v_mensagem is not null then 'FALHOU'
    when exists (select 1 from jsonb_array_elements(v_editais) e where e ->> 'situacao' = 'FALHOU') then 'PARCIAL'
    else 'CONCLUIDA' end;

  update public."TL_PRE_CLASSIFICACAO" t set
    "TP_SITUACAO" = v_situacao, "DT_FIM" = now(), "DS_MENSAGEM" = v_mensagem, "DS_EDITAL" = v_editais,
    "QT_EDITAL" = (select count(*) from jsonb_array_elements(v_editais) e where e ->> 'situacao' = 'PROCESSADO'),
    "QT_VAGA" = r.vagas, "QT_INSCRITO" = r.inscritos, "QT_ELIMINADO" = r.eliminados,
    "QT_RANQUEADO" = r.ranqueados, "QT_LOTE" = r.lote, "QT_DIVERGENCIA" = r.divergencias
    from (select count(*)::integer as vagas, coalesce(sum(v."QT_INSCRITO"), 0)::integer as inscritos,
                 coalesce(sum(v."QT_ELIMINADO"), 0)::integer as eliminados, coalesce(sum(v."QT_RANQUEADO"), 0)::integer as ranqueados,
                 coalesce(sum(v."QT_LOTE"), 0)::integer as lote, coalesce(sum(v."QT_DIVERGENCIA"), 0)::integer as divergencias
            from public."TB_PRE_CLASSIF_VAGA" v where v."CO_EXECUCAO" = p_execucao) r
   where t."CO_EXECUCAO" = v_exec."CO_EXECUCAO";

  return (select jsonb_build_object('situacao', t."TP_SITUACAO", 'editais', t."QT_EDITAL", 'vagas', t."QT_VAGA",
                                    'inscritos', t."QT_INSCRITO", 'lote', t."QT_LOTE")
            from public."TL_PRE_CLASSIFICACAO" t where t."CO_EXECUCAO" = p_execucao);
end;
$function$;
comment on function public.finalizar_pre_classificacao(text, jsonb, text) is
  'Fecha a execução da pré-classificação: o resultado por edital (só códigos e contagens; recusa texto com @ ou CPF), as contagens somadas das vagas gravadas nesta execução e a situação (FALHOU com p_erro; PARCIAL se algum edital falhou; CONCLUIDA). Só service_role.';

revoke all on function public.pre_classificacao_ler_editais(text[], boolean) from public, anon, authenticated;
revoke all on function public.pre_classificacao_ler_candidatos(uuid, text) from public, anon, authenticated;
revoke all on function public.iniciar_pre_classificacao(text, text, uuid, text, boolean, jsonb) from public, anon, authenticated;
revoke all on function public.gravar_pre_classificacao_vaga(text, uuid, text, integer, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.finalizar_pre_classificacao(text, jsonb, text) from public, anon, authenticated;
grant execute on function public.pre_classificacao_ler_editais(text[], boolean) to service_role;
grant execute on function public.pre_classificacao_ler_candidatos(uuid, text) to service_role;
grant execute on function public.iniciar_pre_classificacao(text, text, uuid, text, boolean, jsonb) to service_role;
grant execute on function public.gravar_pre_classificacao_vaga(text, uuid, text, integer, jsonb, jsonb) to service_role;
grant execute on function public.finalizar_pre_classificacao(text, jsonb, text) to service_role;

-- 11. Tela (authenticated) ---------------------------------------------------------------
create function public.obter_pre_classificacao(p_edital uuid)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_area text := private."FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 1);
  v_m public."TB_MONITORAMENTO_INDIGENA";
  v_papel text := private."FC_PAPEL_AVALIACAO"(p_edital);
  v_classif_editor boolean := private.pode_recurso('classificacao', 2);
begin
  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" where id = p_edital;
  return json_build_object(
    'schema_version', 1,
    'gerado_em', now(),
    'edital', json_build_object('id', v_m.id, 'edital', v_m.edital, 'unidade', v_m.unidade, 'area', v_area,
                                'numero', private."FC_NUMERO_EDITAL"(v_m.edital), 'rotulo', private."FC_ROTULO_DO_EDITAL"(v_m.edital)),
    'papel', v_papel,
    'pode_coordenar', coalesce(v_papel = 'COORDENADOR', false),
    'pode_registrar_lista', coalesce(v_papel = 'COORDENADOR', false) or coalesce(v_classif_editor, false),
    'pode_publicar_lista', coalesce(v_classif_editor, false),
    'regra', (select json_build_object('versao', r."NU_VERSAO_VIGENTE", 'situacao', r."TP_SITUACAO",
                                       'configuracao', h."DS_CONFIGURACAO")
                from public."TB_REGRA_ANALISE" r
                join public."TH_REGRA_ANALISE" h on h."CO_REGRA_ANALISE" = r."CO_REGRA_ANALISE" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
               where r."CO_MONITORAMENTO" = p_edital),
    'regra_classificacao', (select json_build_object('versao', r."NU_VERSAO_VIGENTE", 'configuracao', h."DS_CONFIGURACAO")
                              from public."TB_REGRA_CLASSIFICACAO" r
                              join public."TH_REGRA_CLASSIFICACAO" h
                                on h."CO_REGRA_CLASSIFICACAO" = r."CO_REGRA_CLASSIFICACAO" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
                             where r."CO_MONITORAMENTO" = p_edital),
    'em_andamento', exists (select 1 from public."TL_PRE_CLASSIFICACAO" t
                             where t."TP_SITUACAO" = 'EM_ANDAMENTO' and t."DT_INICIO" > now() - interval '1 hour'),
    'ultima_execucao', (
      select json_build_object('id', t."CO_EXECUCAO", 'inicio', t."DT_INICIO", 'fim', t."DT_FIM", 'situacao', t."TP_SITUACAO",
                               'disparo', t."TP_DISPARO", 'refazer', t."ST_REFAZER_LOTE" = 'S', 'mensagem', t."DS_MENSAGEM",
                               'execucao', t."DS_URL_EXECUCAO",
                               'edital', (select e from jsonb_array_elements(t."DS_EDITAL") e where e ->> 'edital' = p_edital::text limit 1))
        from public."TL_PRE_CLASSIFICACAO" t
       where t."DS_EDITAL" @> jsonb_build_array(jsonb_build_object('edital', p_edital::text))
       order by t."DT_INICIO" desc limit 1),
    'vagas', coalesce((
      select json_agg(json_build_object(
               'codigo', v."CO_VAGA",
               'candidatos_empregare', v."QT_CANDIDATO_ATIVO",
               'ultima_carga', v."DT_ULTIMA_CARGA",
               'cargo', pv."NO_CARGO", 'lotacao', pv."NO_LOTACAO",
               'vagas_imediatas', pv."QT_VAGA_IMEDIATA", 'cadastro_reserva', pv."ST_CADASTRO_RESERVA" = 'S',
               'inscritos', pv."QT_INSCRITO", 'eliminados', pv."QT_ELIMINADO", 'ranqueados', pv."QT_RANQUEADO",
               'no_lote', pv."QT_LOTE", 'tamanho', pv."QT_TAMANHO_LOTE", 'descricao', pv."DS_TAMANHO_LOTE",
               'por_modalidade', pv."DS_TAMANHO_MODALIDADE", 'art_corte', pv."VL_ART_CORTE",
               'divergencias', pv."QT_DIVERGENCIA", 'sem_art', pv."QT_SEM_ART", 'acima_do_corte', pv."QT_ACIMA_CORTE",
               'ultimo_lote', pv."NU_ULTIMO_LOTE", 'avisos', coalesce(pv."DS_AVISO", '[]'::jsonb),
               'versao_regra', pv."NU_VERSAO_REGRA", 'atualizado_em', pv."DT_ATUALIZACAO")
             order by v."CO_VAGA")
        from public."TB_EMPREGARE_VAGA" v
        left join public."TB_PRE_CLASSIF_VAGA" pv on pv."CO_MONITORAMENTO" = p_edital and pv."CO_VAGA" = v."CO_VAGA"
       where v."CO_MONITORAMENTO" = p_edital), '[]'::json),
    'candidatos', coalesce((
      select json_agg(json_build_object(
               'id', a."CO_EMPREGARE_CANDIDATO", 'vaga', a."CO_VAGA",
               'codigo', c."CO_CANDIDATO_EMPREGARE", 'nome', c."NO_CANDIDATO",
               'situacao', a."TP_SITUACAO", 'motivo_codigo', a."CO_MOTIVO_ELIMINACAO", 'motivo', a."DS_MOTIVO_ELIMINACAO",
               'art', a."VL_ART", 'nota', a."VL_NOTA_ORDEM", 'origem_nota', a."TP_ORIGEM_NOTA",
               'declarada', a."VL_NOTA_DECLARADA", 'divergente', a."ST_DIVERGENTE" = 'S', 'modalidade', a."NO_MODALIDADE",
               'posicao', a."NU_POSICAO", 'posicao_modalidade', a."NU_POSICAO_MODALIDADE",
               'lote', a."NU_LOTE", 'lista_lote', a."CO_LISTA_LOTE", 'entrada', a."TP_ENTRADA_LOTE",
               'motivo_entrada', a."DS_MOTIVO_ENTRADA", 'entrada_em', a."DT_ENTRADA_LOTE")
             order by a."CO_VAGA", a."TP_SITUACAO" = 'ELIMINADO', a."NU_POSICAO", c."CO_CANDIDATO_EMPREGARE")
        from public."TB_PRE_CLASSIFICACAO" a
        join public."TB_EMPREGARE_CANDIDATO" c on c."CO_EMPREGARE_CANDIDATO" = a."CO_EMPREGARE_CANDIDATO"
       where a."CO_MONITORAMENTO" = p_edital), '[]'::json),
    'listas', coalesce((
      select json_agg(json_build_object('meta', private."FC_LISTA_CLASSIFICACAO_JSON"(l."CO_LISTA_CLASSIFICACAO"),
                                        'lote', l."DS_RESULTADO" -> 'lote')
             order by l."DT_GERACAO" desc)
        from public."TB_LISTA_CLASSIFICACAO" l
       where l."CO_MONITORAMENTO" = p_edital and l."TP_LISTA" in ('PROVISORIA', 'LOTE')), '[]'::json)
  );
end;
$function$;
comment on function public.obter_pre_classificacao(uuid) is
  'A pré-classificação do edital para a aba Pré-classificação (json): regra vigente, regra de classificação (textos do documento), última execução do job que tratou o edital, se há execução em andamento, cada vaga da Empregare com o resumo (quadro, tamanho do lote, linha de corte, divergências, avisos), os inscritos (código, nome, situação, motivo, ART, nota declarada, posição, lote e motivo da entrada; sem CPF nem contato) e as listas PROVISORIA e LOTE registradas. Exige avaliacao_documental >= leitor, a área e o recorte da coordenação.';
revoke all on function public.obter_pre_classificacao(uuid) from public, anon;
grant execute on function public.obter_pre_classificacao(uuid) to authenticated;

create function public.registrar_lista_pre_classificacao(p_edital uuid, p_tipo text, p_lote integer default null)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_area text;
  v_m public."TB_MONITORAMENTO_INDIGENA";
  v_regra public."TB_REGRA_CLASSIFICACAO";
  v_resultado jsonb;
  v_id uuid;
  v_elegiveis integer;
  v_eliminados integer;
begin
  if private."FC_PAPEL_AVALIACAO"(p_edital) = 'COORDENADOR' then
    v_area := private."FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 3);
  else
    v_area := private."FC_EXIGIR_CLASSIFICACAO_EDITAL"(p_edital, 2);
  end if;
  if p_tipo is null or p_tipo not in ('PROVISORIA', 'LOTE') then
    raise exception 'Tipo de lista inválido: PROVISORIA ou LOTE' using errcode = '22023';
  end if;
  if p_lote is not null and (p_tipo <> 'LOTE' or p_lote not between 1 and 999) then
    raise exception 'Número do lote só na lista LOTE, de 1 a 999' using errcode = '22023';
  end if;
  select * into v_regra from public."TB_REGRA_CLASSIFICACAO" where "CO_MONITORAMENTO" = p_edital;
  if v_regra."CO_REGRA_CLASSIFICACAO" is null then
    raise exception 'Cadastre a regra de classificação do edital antes de registrar a lista.' using errcode = '22023';
  end if;
  if not exists (select 1 from public."TB_PRE_CLASSIFICACAO" a where a."CO_MONITORAMENTO" = p_edital) then
    raise exception 'O edital ainda não tem pré-classificação: rode o Recalcular.' using errcode = '22023';
  end if;
  if p_lote is not null and not exists (select 1 from public."TB_PRE_CLASSIFICACAO" a
                                         where a."CO_MONITORAMENTO" = p_edital and a."NU_LOTE" = p_lote) then
    raise exception 'Não há ninguém no lote %.', p_lote using errcode = '22023';
  end if;
  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" where id = p_edital;

  -- O retrato (formato de src/lib/classificacao/exportacao.js): só nome, posição, nota e motivo.
  select jsonb_build_object(
           'schema', 1,
           'tipo', p_tipo,
           'edital', jsonb_build_object('id', v_m.id, 'edital', v_m.edital, 'unidade', v_m.unidade),
           'regra_versao', v_regra."NU_VERSAO_VIGENTE",
           'regra_analise_versao', (select max(a."NU_VERSAO_REGRA") from public."TB_PRE_CLASSIFICACAO" a where a."CO_MONITORAMENTO" = p_edital),
           'lote', p_lote,
           'casas', 1,
           'modalidades', '[]'::jsonb,
           'vagas', coalesce(jsonb_agg(jsonb_build_object(
             'chave', pv."CO_VAGA",
             'codigo', pv."CO_VAGA",
             'cargo', pv."NO_CARGO",
             'lotacao', pv."NO_LOTACAO",
             'cabecalho', concat_ws(' - ', 'VAGA ' || pv."CO_VAGA", pv."NO_CARGO", pv."NO_LOTACAO",
                            case when coalesce(pv."QT_VAGA_IMEDIATA", 0) = 0 and pv."ST_CADASTRO_RESERVA" = 'S' then 'Cadastro reserva'
                                 when pv."QT_VAGA_IMEDIATA" is null then null
                                 else pv."QT_VAGA_IMEDIATA" || case when pv."QT_VAGA_IMEDIATA" = 1 then ' vaga' else ' vagas' end
                                      || case when pv."ST_CADASTRO_RESERVA" = 'S' then ' + CR' else '' end end),
             'total', pv."QT_VAGA_IMEDIATA",
             'cadastro_reserva', pv."ST_CADASTRO_RESERVA" = 'S',
             'geral', coalesce((
               select jsonb_agg(jsonb_build_object('posicao', a."NU_POSICAO", 'nome', c."NO_CANDIDATO",
                                                   'nota', a."VL_NOTA_ORDEM", 'modalidades', jsonb_build_array(a."NO_MODALIDADE"),
                                                   'situacao', a."TP_SITUACAO", 'lote', a."NU_LOTE")
                                order by a."NU_POSICAO")
                 from public."TB_PRE_CLASSIFICACAO" a
                 join public."TB_EMPREGARE_CANDIDATO" c on c."CO_EMPREGARE_CANDIDATO" = a."CO_EMPREGARE_CANDIDATO"
                where a."CO_MONITORAMENTO" = p_edital and a."CO_VAGA" = pv."CO_VAGA"
                  and case when p_tipo = 'PROVISORIA' then a."TP_SITUACAO" <> 'ELIMINADO'
                           else a."TP_SITUACAO" in ('NO_LOTE', 'ANALISADO') and (p_lote is null or a."NU_LOTE" = p_lote) end), '[]'::jsonb),
             'listas', '{}'::jsonb,
             'eliminados', case when p_tipo = 'PROVISORIA' then coalesce((
               select jsonb_agg(jsonb_build_object('nome', c."NO_CANDIDATO", 'motivo', a."DS_MOTIVO_ELIMINACAO", 'detalhe', '')
                                order by c."NO_CANDIDATO")
                 from public."TB_PRE_CLASSIFICACAO" a
                 join public."TB_EMPREGARE_CANDIDATO" c on c."CO_EMPREGARE_CANDIDATO" = a."CO_EMPREGARE_CANDIDATO"
                where a."CO_MONITORAMENTO" = p_edital and a."CO_VAGA" = pv."CO_VAGA" and a."TP_SITUACAO" = 'ELIMINADO'), '[]'::jsonb)
               else '[]'::jsonb end)
             order by pv."CO_VAGA"), '[]'::jsonb),
           'avisos', '[]'::jsonb,
           'pendencias', '[]'::jsonb)
    into v_resultado
    from public."TB_PRE_CLASSIF_VAGA" pv
   where pv."CO_MONITORAMENTO" = p_edital;

  select coalesce(sum(jsonb_array_length(v -> 'geral')), 0), coalesce(sum(jsonb_array_length(v -> 'eliminados')), 0)
    into v_elegiveis, v_eliminados
    from jsonb_array_elements(v_resultado -> 'vagas') v;
  v_resultado := v_resultado || jsonb_build_object('totais', jsonb_build_object(
    'elegiveis', v_elegiveis, 'eliminados', v_eliminados, 'avisos', 0, 'pendencias', 0));

  insert into public."TB_LISTA_CLASSIFICACAO"
    ("CO_MONITORAMENTO", "TP_LISTA", "CO_REGRA_CLASSIFICACAO", "NU_VERSAO_REGRA", "DS_RESULTADO", "DS_HASH",
     "QT_ELEGIVEL", "QT_ELIMINADO", "QT_AVISO", "QT_PENDENCIA", "CO_USUARIO")
  values (p_edital, p_tipo, v_regra."CO_REGRA_CLASSIFICACAO", v_regra."NU_VERSAO_VIGENTE", v_resultado,
          encode(sha256(convert_to(v_resultado::text, 'UTF8')), 'hex'), v_elegiveis, v_eliminados, 0, 0, (select auth.uid()))
  returning "CO_LISTA_CLASSIFICACAO" into v_id;

  return json_build_object('lista', private."FC_LISTA_CLASSIFICACAO_JSON"(v_id), 'resultado', v_resultado);
end;
$function$;
comment on function public.registrar_lista_pre_classificacao(uuid, text, integer) is
  'Registra a lista PROVISORIA (por vaga: classificação, nome e nota da ART; os eliminados automáticos com o motivo) ou LOTE (os do lote; com p_lote, só aquele lote — uma reposição) em TB_LISTA_CLASSIFICACAO, montando o retrato a partir de TB_PRE_CLASSIFICACAO (sem conta: só leitura e ordem já gravadas). Exige a coordenação da avaliação do edital ou Editor na Classificação, a regra de classificação do edital e a pré-classificação já gravada. Devolve os metadados e o retrato.';
revoke all on function public.registrar_lista_pre_classificacao(uuid, text, integer) from public, anon;
grant execute on function public.registrar_lista_pre_classificacao(uuid, text, integer) to authenticated;

create function public.pode_recalcular_pre_classificacao(p_edital uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select (select auth.uid()) is not null
     and (private.is_master() or coalesce(private."FC_PAPEL_AVALIACAO"(p_edital) = 'COORDENADOR', false));
$function$;
comment on function public.pode_recalcular_pre_classificacao(uuid) is
  'true quando quem chama coordena a avaliação documental do edital (ou é o administrador global): api/rodar-carga.js confere com o Bearer de quem clicou em Recalcular antes de disparar o job da pré-classificação.';
revoke all on function public.pode_recalcular_pre_classificacao(uuid) from public, anon;
grant execute on function public.pode_recalcular_pre_classificacao(uuid) to authenticated;

-- 12. Status das atualizações ganha a pré-classificação -----------------------------------
create or replace function public.get_saude_das_cargas()
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_tarefas json;
begin
  if not private.is_master() then
    raise exception 'Somente o administrador global vê a saúde das cargas' using errcode = '42501';
  end if;

  -- pg_cron pode não estar acessível: a seção mostra "indisponível" nessa parte.
  begin
    select coalesce(json_agg(json_build_object(
        'nome', j.jobname,
        'agenda', j.schedule,
        'ativa', j.active,
        'execucoes', (
          select coalesce(json_agg(json_build_object(
              'inicio', d.start_time,
              'fim', d.end_time,
              'situacao', d.status,
              'mensagem', left(d.return_message, 500)
            ) order by d.start_time desc), '[]'::json)
            from (select * from cron.job_run_details r
                   where r.jobid = j.jobid
                   order by r.start_time desc limit 10) d
        )
      ) order by j.jobname), '[]'::json)
      into v_tarefas
      from cron.job j
     where left(j.jobname, 6) = 'agsus_';
  exception when others then
    v_tarefas := null;
  end;

  return json_build_object(
    'schema_version', 1,
    'gerado_em', now(),
    'analises', (
      select coalesce(json_agg(json_build_object(
          'origem', o."CO_ORIGEM",
          'area', p."CO_AREA",
          'planilha', p."NO_PLANILHA",
          'tipo', o."TP_CARGA",
          'execucoes', (
            select coalesce(json_agg(json_build_object(
                'inicio', x.j ->> 'started_at',
                'fim', x.j ->> 'finished_at',
                'situacao', x.j ->> 'status',
                'linhas', coalesce(x.j ->> 'total_processados', x.j ->> 'total_lidos', x.j ->> 'linhas_staging'),
                'mensagem', left(coalesce(x.j ->> 'erro', x.j ->> 'mensagem'), 500)
              ) order by x.inicio desc nulls last), '[]'::json)
              from (select to_jsonb(s) as j, s.started_at as inicio
                      from public."TL_SYNC_ANALISE" s
                     where s.origem = o."CO_ORIGEM"
                     order by s.started_at desc nulls last
                     limit 10) x
          )
        ) order by p."CO_AREA", o."TP_CARGA" desc), '[]'::json)
        from public."TA_ORIGEM_ANALISE" o
        join public."TB_PLANILHA_ANALISE" p on p."CO_PLANILHA" = o."CO_PLANILHA"
    ),
    'entrevistas', (
      select coalesce(json_agg(json_build_object(
          'inicio', e."DT_INICIO",
          'fim', e."DT_FIM",
          'situacao', e."TP_SITUACAO",
          'linhas', e."QT_LINHA",
          'mensagem', e."DS_MENSAGEM",
          'area', e."CO_AREA"
        ) order by e."DT_INICIO" desc), '[]'::json)
        from (select * from public."TL_SYNC_ENTREVISTA" t order by t."DT_INICIO" desc limit 10) e
    ),
    'selecao', (
      select coalesce(json_agg(json_build_object(
          'inicio', e."DT_INICIO",
          'fim', e."DT_FIM",
          'situacao', e."TP_SITUACAO",
          'linhas', e."QT_LINHA",
          'mensagem', e."DS_MENSAGEM"
        ) order by e."DT_INICIO" desc), '[]'::json)
        from (select * from public."TL_SYNC_SELECAO" t order by t."DT_INICIO" desc limit 10) e
    ),
    'empregare', (
      select coalesce(json_agg(json_build_object(
          'inicio', e."DT_INICIO",
          'fim', e."DT_FIM",
          'situacao', e."TP_SITUACAO",
          'linhas', e."QT_LINHA",
          'mensagem', e."DS_MENSAGEM",
          'disparo', e."TP_DISPARO",
          'vagas_pedidas', e."QT_VAGA_PEDIDA",
          'vagas_baixadas', e."QT_VAGA_BAIXADA",
          'vagas_falha', e."QT_VAGA_FALHA",
          'vagas_recusadas', e."QT_VAGA_RECUSADA",
          'desativadas', e."QT_DESATIVADA",
          'execucao', e."DS_URL_EXECUCAO"
        ) order by e."DT_INICIO" desc), '[]'::json)
        from (select * from public."TL_SYNC_EMPREGARE" t order by t."DT_INICIO" desc limit 10) e
    ),
    'conferencias', (
      select coalesce(json_agg(json_build_object(
          'inicio', c."DT_INICIO",
          'fim', c."DT_FIM",
          'situacao', c."TP_SITUACAO",
          'linhas', c."QT_AVISO_ABERTO",
          'mensagem', c."DS_MENSAGEM",
          'disparo', c."TP_DISPARO",
          'novos', c."QT_AVISO_NOVO",
          'abertos', c."QT_AVISO_ABERTO",
          'resolvidos', c."QT_AVISO_RESOLVIDO",
          'falhas', c."DS_FALHA",
          'execucao', c."DS_URL_EXECUCAO"
        ) order by c."DT_INICIO" desc), '[]'::json)
        from (select * from public."TL_CONFERENCIA" t order by t."DT_INICIO" desc limit 10) c
    ),
    'pre_classificacao', (
      select coalesce(json_agg(json_build_object(
          'inicio', p."DT_INICIO",
          'fim', p."DT_FIM",
          'situacao', p."TP_SITUACAO",
          'linhas', p."QT_INSCRITO",
          'mensagem', p."DS_MENSAGEM",
          'disparo', p."TP_DISPARO",
          'editais', p."QT_EDITAL",
          'vagas', p."QT_VAGA",
          'lote', p."QT_LOTE",
          'refazer', p."ST_REFAZER_LOTE" = 'S',
          'execucao', p."DS_URL_EXECUCAO"
        ) order by p."DT_INICIO" desc), '[]'::json)
        from (select * from public."TL_PRE_CLASSIFICACAO" t order by t."DT_INICIO" desc limit 10) p
    ),
    'tarefas', v_tarefas
  );
end;
$function$;
comment on function public.get_saude_das_cargas() is
  'Saúde das cargas (Configurações, só administrador global): as últimas 10 execuções de cada carga das análises (por origem), das entrevistas, da seleção, do robô da Empregare (com vagas pedidas/baixadas/falhas/recusadas e quem disparou), das conferências de consistência (avisos novos, abertos e resolvidos), da pré-classificação da Avaliação documental (editais, vagas, inscritos e lote) e das tarefas agsus_* do pg_cron (nulas sem acesso ao pg_cron). Só leitura.';

commit;
