/*
  AVALIAÇÃO DOCUMENTAL (FASE F1): REGRA DA AVALIAÇÃO POR EDITAL E EQUIPE

  Desenho: docs/analises-no-monitora/ (README, modelo-de-dados.md e
  plano-de-construcao.md, fase F1); histórias AM-2 e AM-3.

  O QUE ENTRA
    public."TB_REGRA_ANALISE_MODELO"   modelos de regra para copiar num edital
                                       (carga em supabase/correcoes/
                                       20261006-modelos-da-regra-da-analise.sql)
    public."TB_REGRA_ANALISE"          a regra da avaliação de um edital (uma por
                                       edital): versão vigente e situação
                                       (CONFERIR | CONFERIDA)
    public."TH_REGRA_ANALISE"          cada versão, imutável: a configuração
                                       inteira (jsonb), quem, quando e por quê
                                       (motivo obrigatório da 2ª em diante)
    public."RL_ANALISTA_EDITAL"        a equipe: ANALISTA, REVISOR ou COORDENADOR,
                                       no edital todo ou numa vaga; sair da equipe
                                       desativa a linha (nada se apaga)
    public."TD_ALDEIA_DSEI"            aldeias oficiais de cada DSEI (critério
                                       étnico: "mora em aldeia")
    public."TB_ORIGEM_ANALISE_EDITAL"  dono da avaliação do edital: PLANILHA,
    public."TH_ORIGEM_ANALISE_EDITAL"  COMPARACAO ou MONITORA (sem linha =
                                       PLANILHA); as trocas são da fase F8

  A REGRA É DADO
    O formato está em src/lib/avaliacao-documental/regra.js (validarRegraAnalise);
    private."FC_VALIDAR_REGRA_ANALISE" confere o mesmo. Nenhum peso fica no
    código: pontos de indígena e de aldeia, escolaridade por nível, faixas de
    cursos, experiência (por mês ou por período, com ou sem o mínimo), lote e
    reposição, distribuição, revisão e os textos do parecer vêm da regra. A
    nota mínima continua sendo a da regra de classificação do edital.

  QUEM PODE
    Recurso 'avaliacao_documental' (20261006090000), área e recorte da
    coordenação do edital, como as RPCs vizinhas:
      ler (regra, equipe)                      leitor
      salvar e conferir a regra, copiar modelo  coordenação do edital
      salvar a equipe
    Coordenação = administrador global, ou Administrador em
    avaliacao_documental que seja gestor do edital (grupo edital_gestor que vê
    o edital — automático, sem linha) ou COORDENADOR em RL_ANALISTA_EDITAL.
    Na equipe, analista e revisor precisam de Editor; coordenador, de
    Administrador; a mensagem diz qual permissão falta (AM-3.2).
    Aldeias: só o administrador global.
    Tabelas com RLS e sem grant: só as funções abaixo.

  RPCs
    listar_editais_avaliacao(p_area)
    obter_regra_analise(p_edital)
    copiar_modelo_regra_analise(p_edital, p_modelo)
    salvar_regra_analise(p_edital, p_configuracao, p_versao_atual, p_motivo)
    conferir_regra_analise(p_edital, p_versao)
    obter_equipe_edital(p_edital)
    salvar_equipe_edital(p_edital, p_equipe, p_motivo)
    salvar_aldeias_dsei(p_unidade, p_aldeias, p_fonte)
  A prévia "Testar com um candidato fictício" é a conta pura do navegador
  (src/lib/avaliacao-documental/pontuacao.js): não grava nada. A mesma conta
  entra no banco na fase F4, conferida pelos casos de
  tests/fixtures/avaliacao-documental/.

  PRÉ-REQUISITO: 20261006090000 (recurso 'avaliacao_documental'),
  20261002150000 (regra de classificação e FC_JSON_NUMERO_ENTRE) e
  20261005170000 (robô da Empregare) aplicadas — a migration para se não
  estiverem.

  Ensaio: supabase/ensaios/20261006100000_regra_da_analise.sql
  Rollback: supabase/rollback/20261006100000_regra_da_analise.sql
*/
begin;

-- 0. Pré-requisitos ---------------------------------------------------------------------
do $$
begin
  if not ('avaliacao_documental' = any (private."FC_RECURSOS_MODULO"())) then
    raise exception 'Aplique antes 20261006090000_avaliacao_documental_permissao_e_menu.sql.';
  end if;
  if to_regprocedure('private."FC_JSON_NUMERO_ENTRE"(jsonb, numeric, numeric)') is null
     or to_regclass('public."TH_REGRA_CLASSIFICACAO"') is null then
    raise exception 'Aplique antes 20261002150000_classificacao.sql.';
  end if;
  if to_regclass('public."TB_EMPREGARE_VAGA"') is null then
    raise exception 'Aplique antes 20261005170000_robo_empregare.sql.';
  end if;
end;
$$;

-- 1. Modelos ----------------------------------------------------------------------------
create table public."TB_REGRA_ANALISE_MODELO" (
  "CO_MODELO" varchar(30) not null,
  "NO_MODELO" varchar(200) not null,
  "DS_CONFIGURACAO" jsonb not null,
  "ST_ATIVO" varchar(1) not null default 'S',
  "DT_ATUALIZACAO" timestamptz not null default now(),
  constraint "PK_TB_REGRA_ANALISE_MODELO" primary key ("CO_MODELO"),
  constraint "CK_REGRAANALMOD_COMODELO" check ("CO_MODELO" ~ '^[A-Z0-9][A-Z0-9-]{1,29}$'),
  constraint "CK_REGRAANALMOD_CONFIG" check (jsonb_typeof("DS_CONFIGURACAO") = 'object'),
  constraint "CK_REGRAANALMOD_STATIVO" check ("ST_ATIVO" in ('S', 'N'))
);
comment on table public."TB_REGRA_ANALISE_MODELO" is
  'Modelos de regra da avaliação documental para copiar num edital novo (PROJ26-CURRICULAR, SI26-INTERIOR-SUL, SI26-100…). A cópia vira a versão 1 da regra do edital, na situação Conferir.';
comment on column public."TB_REGRA_ANALISE_MODELO"."CO_MODELO" is 'Código do modelo (maiúsculas, dígitos e hífen).';
comment on column public."TB_REGRA_ANALISE_MODELO"."NO_MODELO" is 'Nome do modelo na tela.';
comment on column public."TB_REGRA_ANALISE_MODELO"."DS_CONFIGURACAO" is 'A regra do modelo (formato de src/lib/avaliacao-documental/regra.js; validada por FC_VALIDAR_REGRA_ANALISE na carga e na cópia).';
comment on column public."TB_REGRA_ANALISE_MODELO"."ST_ATIVO" is 'S: aparece para copiar.';
comment on column public."TB_REGRA_ANALISE_MODELO"."DT_ATUALIZACAO" is 'Última carga do modelo.';
comment on constraint "PK_TB_REGRA_ANALISE_MODELO" on public."TB_REGRA_ANALISE_MODELO" is 'Código do modelo.';
comment on constraint "CK_REGRAANALMOD_COMODELO" on public."TB_REGRA_ANALISE_MODELO" is 'Código em maiúsculas, dígitos e hífen (2 a 30).';
comment on constraint "CK_REGRAANALMOD_CONFIG" on public."TB_REGRA_ANALISE_MODELO" is 'Configuração é um objeto json.';
comment on constraint "CK_REGRAANALMOD_STATIVO" on public."TB_REGRA_ANALISE_MODELO" is 'Flag S/N.';

-- 2. Regra por edital e versões -------------------------------------------------------------
create table public."TB_REGRA_ANALISE" (
  "CO_REGRA_ANALISE" uuid not null default gen_random_uuid(),
  "CO_MONITORAMENTO" uuid not null,
  "NU_VERSAO_VIGENTE" integer not null,
  "TP_SITUACAO" varchar(10) not null default 'CONFERIR',
  "CO_MODELO_ORIGEM" varchar(30),
  "CO_USUARIO_ATUALIZACAO" uuid not null,
  "CO_USUARIO_CONFERENCIA" uuid,
  "DT_CONFERENCIA" timestamptz,
  "DT_CRIACAO" timestamptz not null default now(),
  "DT_ATUALIZACAO" timestamptz not null default now(),
  constraint "PK_TB_REGRA_ANALISE" primary key ("CO_REGRA_ANALISE"),
  constraint "UK_REGRAANALISE_EDITAL" unique ("CO_MONITORAMENTO"),
  constraint "FK_MONITORAMENTO_REGRAANALISE" foreign key ("CO_MONITORAMENTO") references public."TB_MONITORAMENTO_INDIGENA" (id),
  constraint "FK_REGRAANALMOD_REGRAANALISE" foreign key ("CO_MODELO_ORIGEM") references public."TB_REGRA_ANALISE_MODELO" ("CO_MODELO"),
  constraint "CK_REGRAANALISE_NUVERSAO" check ("NU_VERSAO_VIGENTE" >= 1),
  constraint "CK_REGRAANALISE_TPSITUACAO" check ("TP_SITUACAO" in ('CONFERIR', 'CONFERIDA')),
  constraint "CK_REGRAANALISE_CONFERENCIA" check (
    ("TP_SITUACAO" = 'CONFERIDA') = ("DT_CONFERENCIA" is not null)
    and ("DT_CONFERENCIA" is null) = ("CO_USUARIO_CONFERENCIA" is null))
);
create index "IN_FKREGRAANALISE_MODELO" on public."TB_REGRA_ANALISE" ("CO_MODELO_ORIGEM");
comment on table public."TB_REGRA_ANALISE" is
  'Regra da avaliação documental de um edital (uma por edital), decidida pela coordenação do edital. A configuração fica em cada versão (TH_REGRA_ANALISE); aqui, a versão vigente e se ela foi conferida.';
comment on column public."TB_REGRA_ANALISE"."CO_REGRA_ANALISE" is 'Identificador da regra.';
comment on column public."TB_REGRA_ANALISE"."CO_MONITORAMENTO" is 'Edital (TB_MONITORAMENTO_INDIGENA.id).';
comment on column public."TB_REGRA_ANALISE"."NU_VERSAO_VIGENTE" is 'Versão vigente (TH_REGRA_ANALISE.NU_VERSAO). Salvar cria a próxima.';
comment on column public."TB_REGRA_ANALISE"."TP_SITUACAO" is 'CONFERIR (versão nova ou copiada de modelo, ainda não conferida) ou CONFERIDA (a coordenação conferiu a versão vigente).';
comment on column public."TB_REGRA_ANALISE"."CO_MODELO_ORIGEM" is 'Modelo de onde a versão 1 foi copiada (nulo: começou do zero).';
comment on column public."TB_REGRA_ANALISE"."CO_USUARIO_ATUALIZACAO" is 'Quem salvou a versão vigente (auth.users.id).';
comment on column public."TB_REGRA_ANALISE"."CO_USUARIO_CONFERENCIA" is 'Quem conferiu a versão vigente (auth.users.id).';
comment on column public."TB_REGRA_ANALISE"."DT_CONFERENCIA" is 'Quando a versão vigente foi conferida.';
comment on column public."TB_REGRA_ANALISE"."DT_CRIACAO" is 'Primeira versão.';
comment on column public."TB_REGRA_ANALISE"."DT_ATUALIZACAO" is 'Última versão salva ou conferência.';
comment on constraint "PK_TB_REGRA_ANALISE" on public."TB_REGRA_ANALISE" is 'Identificador da regra.';
comment on constraint "UK_REGRAANALISE_EDITAL" on public."TB_REGRA_ANALISE" is 'Uma regra por edital.';
comment on constraint "FK_MONITORAMENTO_REGRAANALISE" on public."TB_REGRA_ANALISE" is 'Edital da regra. Sem cascata: as versões são registro de auditoria.';
comment on constraint "FK_REGRAANALMOD_REGRAANALISE" on public."TB_REGRA_ANALISE" is 'Modelo copiado.';
comment on constraint "CK_REGRAANALISE_NUVERSAO" on public."TB_REGRA_ANALISE" is 'Versões começam em 1.';
comment on constraint "CK_REGRAANALISE_TPSITUACAO" on public."TB_REGRA_ANALISE" is 'Situações válidas.';
comment on constraint "CK_REGRAANALISE_CONFERENCIA" on public."TB_REGRA_ANALISE" is 'Conferida tem quem e quando; a conferir, nenhum dos dois.';
comment on index public."IN_FKREGRAANALISE_MODELO" is 'Chave estrangeira para TB_REGRA_ANALISE_MODELO.';

create table public."TH_REGRA_ANALISE" (
  "CO_REGRA_ANALISE" uuid not null,
  "NU_VERSAO" integer not null,
  "DS_CONFIGURACAO" jsonb not null,
  "DS_HASH" varchar(64) not null,
  "DS_MOTIVO" varchar(2000),
  "CO_USUARIO" uuid not null,
  "DT_CRIACAO" timestamptz not null default now(),
  constraint "PK_TH_REGRA_ANALISE" primary key ("CO_REGRA_ANALISE", "NU_VERSAO"),
  constraint "FK_REGRAANALISE_THREGRAANALISE" foreign key ("CO_REGRA_ANALISE") references public."TB_REGRA_ANALISE" ("CO_REGRA_ANALISE"),
  constraint "CK_THREGRAANALISE_NUVERSAO" check ("NU_VERSAO" >= 1),
  constraint "CK_THREGRAANALISE_CONFIG" check (jsonb_typeof("DS_CONFIGURACAO") = 'object'),
  constraint "CK_THREGRAANALISE_DSHASH" check ("DS_HASH" ~ '^[0-9a-f]{64}$'),
  constraint "CK_THREGRAANALISE_MOTIVO" check ("NU_VERSAO" = 1 or length(btrim(coalesce("DS_MOTIVO", ''))) between 10 and 2000)
);
comment on table public."TH_REGRA_ANALISE" is
  'Versões imutáveis da regra da avaliação documental de um edital. Cada alteração cria uma linha (nada é sobrescrito nem apagado); a ficha (fase F3+) guarda a versão usada.';
comment on column public."TH_REGRA_ANALISE"."CO_REGRA_ANALISE" is 'Regra (TB_REGRA_ANALISE).';
comment on column public."TH_REGRA_ANALISE"."NU_VERSAO" is 'Número da versão (1, 2, 3…).';
comment on column public."TH_REGRA_ANALISE"."DS_CONFIGURACAO" is 'Configuração inteira da regra (formato de src/lib/avaliacao-documental/regra.js; validada por FC_VALIDAR_REGRA_ANALISE).';
comment on column public."TH_REGRA_ANALISE"."DS_HASH" is 'SHA-256 (hex) do texto de DS_CONFIGURACAO, calculado no banco.';
comment on column public."TH_REGRA_ANALISE"."DS_MOTIVO" is 'Por que a regra mudou (obrigatório a partir da versão 2, de 10 a 2.000 caracteres). Na versão 1: de onde veio (modelo ou do zero).';
comment on column public."TH_REGRA_ANALISE"."CO_USUARIO" is 'Quem salvou a versão (auth.users.id).';
comment on column public."TH_REGRA_ANALISE"."DT_CRIACAO" is 'Quando a versão foi salva.';
comment on constraint "PK_TH_REGRA_ANALISE" on public."TH_REGRA_ANALISE" is 'Uma linha por versão da regra.';
comment on constraint "FK_REGRAANALISE_THREGRAANALISE" on public."TH_REGRA_ANALISE" is 'Regra da versão.';
comment on constraint "CK_THREGRAANALISE_NUVERSAO" on public."TH_REGRA_ANALISE" is 'Versões começam em 1.';
comment on constraint "CK_THREGRAANALISE_CONFIG" on public."TH_REGRA_ANALISE" is 'Configuração é um objeto json.';
comment on constraint "CK_THREGRAANALISE_DSHASH" on public."TH_REGRA_ANALISE" is 'SHA-256 em hexadecimal minúsculo.';
comment on constraint "CK_THREGRAANALISE_MOTIVO" on public."TH_REGRA_ANALISE" is 'Da versão 2 em diante, motivo de 10 a 2.000 caracteres.';

-- 3. Equipe do edital -----------------------------------------------------------------------
create table public."RL_ANALISTA_EDITAL" (
  "CO_ANALISTA_EDITAL" uuid not null default gen_random_uuid(),
  "CO_MONITORAMENTO" uuid not null,
  "CO_USUARIO" uuid not null,
  "TP_PAPEL" varchar(12) not null,
  "CO_VAGA" varchar(20),
  "QT_LIMITE_FICHA" integer,
  "ST_ATIVO" varchar(1) not null default 'S',
  "DS_MOTIVO_ATUALIZACAO" varchar(500),
  "CO_USUARIO_ATUALIZACAO" uuid not null,
  "DT_CRIACAO" timestamptz not null default now(),
  "DT_ATUALIZACAO" timestamptz not null default now(),
  constraint "PK_RL_ANALISTA_EDITAL" primary key ("CO_ANALISTA_EDITAL"),
  constraint "FK_MONITORAMENTO_ANALISTAEDT" foreign key ("CO_MONITORAMENTO") references public."TB_MONITORAMENTO_INDIGENA" (id),
  constraint "FK_USUARIO_ANALISTAEDT" foreign key ("CO_USUARIO") references auth.users (id),
  constraint "CK_ANALISTAEDT_TPPAPEL" check ("TP_PAPEL" in ('ANALISTA', 'REVISOR', 'COORDENADOR')),
  constraint "CK_ANALISTAEDT_COVAGA" check ("CO_VAGA" is null or "CO_VAGA" ~ '^[0-9]{1,20}$'),
  constraint "CK_ANALISTAEDT_COORDVAGA" check ("TP_PAPEL" <> 'COORDENADOR' or "CO_VAGA" is null),
  constraint "CK_ANALISTAEDT_LIMITE" check ("QT_LIMITE_FICHA" is null or "QT_LIMITE_FICHA" between 1 and 5000),
  constraint "CK_ANALISTAEDT_STATIVO" check ("ST_ATIVO" in ('S', 'N'))
);
create unique index "UK_ANALISTAEDT_PAPEL" on public."RL_ANALISTA_EDITAL"
  ("CO_MONITORAMENTO", "CO_USUARIO", "TP_PAPEL", coalesce("CO_VAGA", '')) where "ST_ATIVO" = 'S';
create index "IN_ANALISTAEDT_USUARIO" on public."RL_ANALISTA_EDITAL" ("CO_USUARIO", "CO_MONITORAMENTO") where "ST_ATIVO" = 'S';
comment on table public."RL_ANALISTA_EDITAL" is
  'Equipe da avaliação documental do edital (substitui a DIM_RESPONSAVEIS das planilhas): analista, revisor ou coordenador, no edital todo ou numa vaga. O gestor do edital já é coordenação, sem linha aqui. Sair da equipe desativa a linha; nada se apaga.';
comment on column public."RL_ANALISTA_EDITAL"."CO_ANALISTA_EDITAL" is 'Identificador da linha.';
comment on column public."RL_ANALISTA_EDITAL"."CO_MONITORAMENTO" is 'Edital (TB_MONITORAMENTO_INDIGENA.id).';
comment on column public."RL_ANALISTA_EDITAL"."CO_USUARIO" is 'Pessoa (auth.users.id).';
comment on column public."RL_ANALISTA_EDITAL"."TP_PAPEL" is 'ANALISTA (analisa as suas fichas), REVISOR (valida ou devolve as fichas de outras pessoas) ou COORDENADOR (regra, equipe, lote, distribuição e revisão).';
comment on column public."RL_ANALISTA_EDITAL"."CO_VAGA" is 'Código da vaga (só dígitos); nulo = todas as vagas do edital.';
comment on column public."RL_ANALISTA_EDITAL"."QT_LIMITE_FICHA" is 'Limite de fichas na distribuição inicial (1 a 5.000); nulo = sem limite.';
comment on column public."RL_ANALISTA_EDITAL"."ST_ATIVO" is 'S: está na equipe. N: saiu (a linha fica como histórico).';
comment on column public."RL_ANALISTA_EDITAL"."DS_MOTIVO_ATUALIZACAO" is 'Motivo informado na última mudança da linha (obrigatório ao tirar alguém da equipe).';
comment on column public."RL_ANALISTA_EDITAL"."CO_USUARIO_ATUALIZACAO" is 'Quem incluiu ou mudou a linha por último (auth.users.id).';
comment on column public."RL_ANALISTA_EDITAL"."DT_CRIACAO" is 'Quando a pessoa entrou com este papel.';
comment on column public."RL_ANALISTA_EDITAL"."DT_ATUALIZACAO" is 'Última mudança da linha.';
comment on constraint "PK_RL_ANALISTA_EDITAL" on public."RL_ANALISTA_EDITAL" is 'Identificador da linha.';
comment on constraint "FK_MONITORAMENTO_ANALISTAEDT" on public."RL_ANALISTA_EDITAL" is 'Edital da equipe.';
comment on constraint "FK_USUARIO_ANALISTAEDT" on public."RL_ANALISTA_EDITAL" is 'Pessoa da equipe.';
comment on constraint "CK_ANALISTAEDT_TPPAPEL" on public."RL_ANALISTA_EDITAL" is 'Papéis válidos.';
comment on constraint "CK_ANALISTAEDT_COVAGA" on public."RL_ANALISTA_EDITAL" is 'Código da vaga só com dígitos.';
comment on constraint "CK_ANALISTAEDT_COORDVAGA" on public."RL_ANALISTA_EDITAL" is 'A coordenação é do edital todo, sem vaga.';
comment on constraint "CK_ANALISTAEDT_LIMITE" on public."RL_ANALISTA_EDITAL" is 'Limite de fichas entre 1 e 5.000.';
comment on constraint "CK_ANALISTAEDT_STATIVO" on public."RL_ANALISTA_EDITAL" is 'Flag S/N.';
comment on index public."UK_ANALISTAEDT_PAPEL" is 'Uma linha ativa por pessoa, papel e vaga no edital.';
comment on index public."IN_ANALISTAEDT_USUARIO" is 'Papéis ativos de uma pessoa (porteiro das RPCs).';

-- 4. Aldeias dos DSEI ------------------------------------------------------------------------
create table public."TD_ALDEIA_DSEI" (
  "CO_ALDEIA_DSEI" uuid not null default gen_random_uuid(),
  "CO_UNIDADE" varchar(60) not null,
  "NO_ALDEIA" varchar(200) not null,
  "CO_POLO" varchar(20),
  "NO_EXIBICAO" varchar(230) not null,
  "ST_ATIVO" varchar(1) not null default 'S',
  "DS_FONTE" varchar(300) not null,
  "CO_USUARIO_ATUALIZACAO" uuid not null,
  "DT_ATUALIZACAO" timestamptz not null default now(),
  constraint "PK_TD_ALDEIA_DSEI" primary key ("CO_ALDEIA_DSEI"),
  constraint "UK_ALDEIADSEI_NOME" unique ("CO_UNIDADE", "NO_EXIBICAO"),
  constraint "CK_ALDEIADSEI_NOME" check (length(btrim("NO_ALDEIA")) between 1 and 200 and length(btrim("NO_EXIBICAO")) between 1 and 230),
  constraint "CK_ALDEIADSEI_STATIVO" check ("ST_ATIVO" in ('S', 'N')),
  constraint "CK_ALDEIADSEI_FONTE" check (length(btrim("DS_FONTE")) between 3 and 300)
);
comment on table public."TD_ALDEIA_DSEI" is
  'Aldeias oficiais de cada DSEI, para validar o "mora em aldeia" do critério étnico. Carga só pelo administrador global (salvar_aldeias_dsei). Aldeia que sai da lista é desativada.';
comment on column public."TD_ALDEIA_DSEI"."CO_ALDEIA_DSEI" is 'Identificador da aldeia.';
comment on column public."TD_ALDEIA_DSEI"."CO_UNIDADE" is 'O DSEI: TD_UNIDADE.id_unidade (o mesmo id_unidade do edital). Conferido na gravação; sem chave estrangeira porque TD_UNIDADE não garante id_unidade único.';
comment on column public."TD_ALDEIA_DSEI"."NO_ALDEIA" is 'Nome da aldeia.';
comment on column public."TD_ALDEIA_DSEI"."CO_POLO" is 'Código do polo base, quando a lista traz ("NOME-(polo)").';
comment on column public."TD_ALDEIA_DSEI"."NO_EXIBICAO" is 'Como o analista busca: "NOME-(polo)" ou só o nome.';
comment on column public."TD_ALDEIA_DSEI"."ST_ATIVO" is 'S: na lista vigente do DSEI.';
comment on column public."TD_ALDEIA_DSEI"."DS_FONTE" is 'De onde veio a lista (documento, data).';
comment on column public."TD_ALDEIA_DSEI"."CO_USUARIO_ATUALIZACAO" is 'Quem carregou a lista por último (auth.users.id).';
comment on column public."TD_ALDEIA_DSEI"."DT_ATUALIZACAO" is 'Última carga da linha.';
comment on constraint "PK_TD_ALDEIA_DSEI" on public."TD_ALDEIA_DSEI" is 'Identificador da aldeia.';
comment on constraint "UK_ALDEIADSEI_NOME" on public."TD_ALDEIA_DSEI" is 'Um nome de exibição por DSEI.';
comment on constraint "CK_ALDEIADSEI_NOME" on public."TD_ALDEIA_DSEI" is 'Nomes não vazios.';
comment on constraint "CK_ALDEIADSEI_STATIVO" on public."TD_ALDEIA_DSEI" is 'Flag S/N.';
comment on constraint "CK_ALDEIADSEI_FONTE" on public."TD_ALDEIA_DSEI" is 'Fonte de 3 a 300 caracteres.';

-- 5. Dono da avaliação do edital ------------------------------------------------------------
create table public."TB_ORIGEM_ANALISE_EDITAL" (
  "CO_MONITORAMENTO" uuid not null,
  "TP_ORIGEM" varchar(10) not null default 'PLANILHA',
  "CO_USUARIO_ATUALIZACAO" uuid,
  "DT_ATUALIZACAO" timestamptz not null default now(),
  constraint "PK_TB_ORIGEM_ANALISE_EDITAL" primary key ("CO_MONITORAMENTO"),
  constraint "FK_MONITORAMENTO_ORIGANALEDT" foreign key ("CO_MONITORAMENTO") references public."TB_MONITORAMENTO_INDIGENA" (id),
  constraint "CK_ORIGANALEDT_TPORIGEM" check ("TP_ORIGEM" in ('PLANILHA', 'COMPARACAO', 'MONITORA'))
);
comment on table public."TB_ORIGEM_ANALISE_EDITAL" is
  'Dono da avaliação documental do edital: PLANILHA (Apps Script), COMPARACAO (o MONITORA avalia em paralelo e não publica) ou MONITORA (as fichas publicam em TB_ANALISE_CURRICULAR). Edital sem linha = PLANILHA. As trocas são da fase F8 (definir_origem_analise).';
comment on column public."TB_ORIGEM_ANALISE_EDITAL"."CO_MONITORAMENTO" is 'Edital (TB_MONITORAMENTO_INDIGENA.id).';
comment on column public."TB_ORIGEM_ANALISE_EDITAL"."TP_ORIGEM" is 'PLANILHA, COMPARACAO ou MONITORA.';
comment on column public."TB_ORIGEM_ANALISE_EDITAL"."CO_USUARIO_ATUALIZACAO" is 'Quem trocou o dono por último (auth.users.id). Nulo: carga inicial.';
comment on column public."TB_ORIGEM_ANALISE_EDITAL"."DT_ATUALIZACAO" is 'Última troca.';
comment on constraint "PK_TB_ORIGEM_ANALISE_EDITAL" on public."TB_ORIGEM_ANALISE_EDITAL" is 'Um dono por edital.';
comment on constraint "FK_MONITORAMENTO_ORIGANALEDT" on public."TB_ORIGEM_ANALISE_EDITAL" is 'Edital.';
comment on constraint "CK_ORIGANALEDT_TPORIGEM" on public."TB_ORIGEM_ANALISE_EDITAL" is 'Donos válidos.';

create table public."TH_ORIGEM_ANALISE_EDITAL" (
  "CO_MONITORAMENTO" uuid not null,
  "NU_SEQUENCIA" integer not null,
  "TP_ORIGEM_ANTERIOR" varchar(10),
  "TP_ORIGEM" varchar(10) not null,
  "DS_MOTIVO" varchar(2000) not null,
  "DS_RESULTADO" jsonb,
  "CO_USUARIO" uuid not null,
  "DT_REGISTRO" timestamptz not null default now(),
  constraint "PK_TH_ORIGEM_ANALISE_EDITAL" primary key ("CO_MONITORAMENTO", "NU_SEQUENCIA"),
  constraint "FK_ORIGANALEDT_THORIGANALEDT" foreign key ("CO_MONITORAMENTO") references public."TB_ORIGEM_ANALISE_EDITAL" ("CO_MONITORAMENTO"),
  constraint "CK_THORIGANALEDT_NUSEQ" check ("NU_SEQUENCIA" >= 1),
  constraint "CK_THORIGANALEDT_TPORIGEM" check ("TP_ORIGEM" in ('PLANILHA', 'COMPARACAO', 'MONITORA')
    and ("TP_ORIGEM_ANTERIOR" is null or "TP_ORIGEM_ANTERIOR" in ('PLANILHA', 'COMPARACAO', 'MONITORA'))),
  constraint "CK_THORIGANALEDT_MOTIVO" check (length(btrim("DS_MOTIVO")) between 10 and 2000),
  constraint "CK_THORIGANALEDT_RESULTADO" check ("DS_RESULTADO" is null or jsonb_typeof("DS_RESULTADO") = 'object')
);
comment on table public."TH_ORIGEM_ANALISE_EDITAL" is 'Histórico imutável das trocas de dono da avaliação do edital, com o resumo da virada (fase F8).';
comment on column public."TH_ORIGEM_ANALISE_EDITAL"."CO_MONITORAMENTO" is 'Edital.';
comment on column public."TH_ORIGEM_ANALISE_EDITAL"."NU_SEQUENCIA" is 'Ordem da troca no edital (1, 2…).';
comment on column public."TH_ORIGEM_ANALISE_EDITAL"."TP_ORIGEM_ANTERIOR" is 'Dono antes da troca (nulo = PLANILHA sem linha).';
comment on column public."TH_ORIGEM_ANALISE_EDITAL"."TP_ORIGEM" is 'Dono depois da troca.';
comment on column public."TH_ORIGEM_ANALISE_EDITAL"."DS_MOTIVO" is 'Por que trocou (10 a 2.000 caracteres).';
comment on column public."TH_ORIGEM_ANALISE_EDITAL"."DS_RESULTADO" is 'Resumo da virada (contagens adotadas), quando houver.';
comment on column public."TH_ORIGEM_ANALISE_EDITAL"."CO_USUARIO" is 'Quem trocou (auth.users.id).';
comment on column public."TH_ORIGEM_ANALISE_EDITAL"."DT_REGISTRO" is 'Quando trocou.';
comment on constraint "PK_TH_ORIGEM_ANALISE_EDITAL" on public."TH_ORIGEM_ANALISE_EDITAL" is 'Uma linha por troca.';
comment on constraint "FK_ORIGANALEDT_THORIGANALEDT" on public."TH_ORIGEM_ANALISE_EDITAL" is 'Dono atual do edital.';
comment on constraint "CK_THORIGANALEDT_NUSEQ" on public."TH_ORIGEM_ANALISE_EDITAL" is 'Sequência a partir de 1.';
comment on constraint "CK_THORIGANALEDT_TPORIGEM" on public."TH_ORIGEM_ANALISE_EDITAL" is 'Donos válidos.';
comment on constraint "CK_THORIGANALEDT_MOTIVO" on public."TH_ORIGEM_ANALISE_EDITAL" is 'Motivo de 10 a 2.000 caracteres.';
comment on constraint "CK_THORIGANALEDT_RESULTADO" on public."TH_ORIGEM_ANALISE_EDITAL" is 'Resumo é um objeto json.';

-- 6. Nada se apaga; versões não mudam -----------------------------------------------------
create function private."FC_TG_REGRA_ANALISE_IMUTAVEL"()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if tg_op = 'DELETE' then
    raise exception 'Registro da avaliação documental não se apaga (%): desative ou crie outra versão', tg_table_name using errcode = '42501';
  end if;
  if tg_table_name in ('TH_REGRA_ANALISE', 'TH_ORIGEM_ANALISE_EDITAL') then
    raise exception 'Histórico não muda (%): crie outra versão', tg_table_name using errcode = '42501';
  end if;
  return new;
end;
$function$;
comment on function private."FC_TG_REGRA_ANALISE_IMUTAVEL"() is
  'Gatilho da avaliação documental: nenhuma linha se apaga (regra, equipe, aldeias, origem) e as tabelas de histórico (TH_) não mudam.';
revoke all on function private."FC_TG_REGRA_ANALISE_IMUTAVEL"() from public, anon, authenticated;

create trigger "TG_REGRAANALISE_SEMAPAGAR" before delete on public."TB_REGRA_ANALISE"
  for each row execute function private."FC_TG_REGRA_ANALISE_IMUTAVEL"();
comment on trigger "TG_REGRAANALISE_SEMAPAGAR" on public."TB_REGRA_ANALISE" is 'A regra do edital não se apaga (FC_TG_REGRA_ANALISE_IMUTAVEL).';
create trigger "TG_THREGRAANALISE_IMUTAVEL" before update or delete on public."TH_REGRA_ANALISE"
  for each row execute function private."FC_TG_REGRA_ANALISE_IMUTAVEL"();
comment on trigger "TG_THREGRAANALISE_IMUTAVEL" on public."TH_REGRA_ANALISE" is 'Versões da regra imutáveis (FC_TG_REGRA_ANALISE_IMUTAVEL).';
create trigger "TG_ANALISTAEDT_SEMAPAGAR" before delete on public."RL_ANALISTA_EDITAL"
  for each row execute function private."FC_TG_REGRA_ANALISE_IMUTAVEL"();
comment on trigger "TG_ANALISTAEDT_SEMAPAGAR" on public."RL_ANALISTA_EDITAL" is 'Quem sai da equipe é desativado, não apagado (FC_TG_REGRA_ANALISE_IMUTAVEL).';
create trigger "TG_ALDEIADSEI_SEMAPAGAR" before delete on public."TD_ALDEIA_DSEI"
  for each row execute function private."FC_TG_REGRA_ANALISE_IMUTAVEL"();
comment on trigger "TG_ALDEIADSEI_SEMAPAGAR" on public."TD_ALDEIA_DSEI" is 'Aldeia que sai da lista é desativada (FC_TG_REGRA_ANALISE_IMUTAVEL).';
create trigger "TG_ORIGANALEDT_SEMAPAGAR" before delete on public."TB_ORIGEM_ANALISE_EDITAL"
  for each row execute function private."FC_TG_REGRA_ANALISE_IMUTAVEL"();
comment on trigger "TG_ORIGANALEDT_SEMAPAGAR" on public."TB_ORIGEM_ANALISE_EDITAL" is 'O dono do edital troca, não se apaga (FC_TG_REGRA_ANALISE_IMUTAVEL).';
create trigger "TG_THORIGANALEDT_IMUTAVEL" before update or delete on public."TH_ORIGEM_ANALISE_EDITAL"
  for each row execute function private."FC_TG_REGRA_ANALISE_IMUTAVEL"();
comment on trigger "TG_THORIGANALEDT_IMUTAVEL" on public."TH_ORIGEM_ANALISE_EDITAL" is 'Histórico das trocas imutável (FC_TG_REGRA_ANALISE_IMUTAVEL).';

-- 7. Acesso: só as funções abaixo ------------------------------------------------------------
alter table public."TB_REGRA_ANALISE_MODELO" enable row level security;
alter table public."TB_REGRA_ANALISE" enable row level security;
alter table public."TH_REGRA_ANALISE" enable row level security;
alter table public."RL_ANALISTA_EDITAL" enable row level security;
alter table public."TD_ALDEIA_DSEI" enable row level security;
alter table public."TB_ORIGEM_ANALISE_EDITAL" enable row level security;
alter table public."TH_ORIGEM_ANALISE_EDITAL" enable row level security;
revoke all on public."TB_REGRA_ANALISE_MODELO", public."TB_REGRA_ANALISE", public."TH_REGRA_ANALISE",
  public."RL_ANALISTA_EDITAL", public."TD_ALDEIA_DSEI", public."TB_ORIGEM_ANALISE_EDITAL", public."TH_ORIGEM_ANALISE_EDITAL"
  from public, anon, authenticated;

-- 8. Papel no edital e porteiros --------------------------------------------------------------
create function private."FC_PERFIL_VE_EDITAL"(p_perfil_usuario uuid, p_edital uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1
      from public."TB_PERFIL_USUARIO" u
      join public."TB_MONITORAMENTO_INDIGENA" m on m.id = p_edital
     where u.id = p_perfil_usuario and u.ativo
       and m."CO_AREA" = any (coalesce(private."FC_AREAS_DO_PERFIL"(u.id), '{}'))
       and (private."FC_EDITAIS_DA_COORDENACAO"(u."CO_COORDENACAO") is null
            or m.id = any (private."FC_EDITAIS_DA_COORDENACAO"(u."CO_COORDENACAO"))));
$function$;
comment on function private."FC_PERFIL_VE_EDITAL"(uuid, uuid) is
  'Um usuário ativo (TB_PERFIL_USUARIO.id) vê o edital pela área e pelo recorte da coordenação? (a regra de FC_PODE_VER_EDITAL, para outra pessoa).';
revoke all on function private."FC_PERFIL_VE_EDITAL"(uuid, uuid) from public, anon, authenticated;

create function private."FC_NIVEL_AVALIACAO_DO_PERFIL"(p_perfil_usuario uuid)
returns integer
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce((
    select private."FC_RANK_NIVEL"(private."FC_NIVEL_EFETIVO"(u.id, u.perfil, 'avaliacao_documental'))
      from public."TB_PERFIL_USUARIO" u
     where u.id = p_perfil_usuario and u.ativo), 0);
$function$;
comment on function private."FC_NIVEL_AVALIACAO_DO_PERFIL"(uuid) is
  'Nível de um usuário ativo em avaliacao_documental: 0 sem acesso, 1 leitor, 2 editor, 3 administrador.';
revoke all on function private."FC_NIVEL_AVALIACAO_DO_PERFIL"(uuid) from public, anon, authenticated;

create function private."FC_GESTOR_DO_EDITAL"(p_perfil_usuario uuid, p_edital uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1 from public."TB_PERFIL_USUARIO" u
     where u.id = p_perfil_usuario and u.ativo and u.perfil = 'edital_gestor'
       and private."FC_NIVEL_AVALIACAO_DO_PERFIL"(u.id) >= 3
       and private."FC_PERFIL_VE_EDITAL"(u.id, p_edital));
$function$;
comment on function private."FC_GESTOR_DO_EDITAL"(uuid, uuid) is
  'O usuário é gestor do edital na avaliação documental: grupo edital_gestor, Administrador em avaliacao_documental e vê o edital (área e coordenação). Coordena sem linha em RL_ANALISTA_EDITAL.';
revoke all on function private."FC_GESTOR_DO_EDITAL"(uuid, uuid) from public, anon, authenticated;

create function private."FC_PAPEL_AVALIACAO"(p_edital uuid)
returns text
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_perfil public."TB_PERFIL_USUARIO";
  v_nivel integer;
begin
  if (select auth.uid()) is null then return null; end if;
  if private.is_master() then return 'COORDENADOR'; end if;
  v_perfil := private.current_profile();
  if v_perfil.id is null or v_perfil.ativo is not true or not private."FC_PODE_VER_EDITAL"(p_edital) then
    return null;
  end if;
  v_nivel := private."FC_RANK_NIVEL"(private.nivel_recurso('avaliacao_documental'));
  if v_nivel >= 3 and (private."FC_GESTOR_DO_EDITAL"(v_perfil.id, p_edital)
                       or exists (select 1 from public."RL_ANALISTA_EDITAL" r
                                   where r."CO_MONITORAMENTO" = p_edital and r."CO_USUARIO" = v_perfil.user_id
                                     and r."TP_PAPEL" = 'COORDENADOR' and r."ST_ATIVO" = 'S')) then
    return 'COORDENADOR';
  end if;
  if v_nivel >= 2 then
    return (select r."TP_PAPEL" from public."RL_ANALISTA_EDITAL" r
             where r."CO_MONITORAMENTO" = p_edital and r."CO_USUARIO" = v_perfil.user_id
               and r."TP_PAPEL" in ('REVISOR', 'ANALISTA') and r."ST_ATIVO" = 'S'
             order by r."TP_PAPEL" = 'REVISOR' desc limit 1);
  end if;
  return null;
end;
$function$;
comment on function private."FC_PAPEL_AVALIACAO"(uuid) is
  'Papel de quem está logado na avaliação documental do edital: COORDENADOR (administrador global; ou Administrador que é gestor do edital ou coordenador na equipe), REVISOR, ANALISTA (com Editor e a linha na equipe) ou nulo.';
revoke all on function private."FC_PAPEL_AVALIACAO"(uuid) from public, anon, authenticated;

create function private."FC_EXIGIR_AVALIACAO_EDITAL"(p_edital uuid, p_minimo integer)
returns text
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_area text;
begin
  select m."CO_AREA" into v_area from public."TB_MONITORAMENTO_INDIGENA" m where m.id = p_edital;
  if v_area is null then raise exception 'Edital não encontrado' using errcode = '22023'; end if;
  if not private.pode_recurso('avaliacao_documental', p_minimo) then
    raise exception 'Sem permissão para a Avaliação documental' using errcode = '42501';
  end if;
  if not private."FC_PODE_AREA"(v_area) then
    raise exception 'Sem acesso a esta área' using errcode = '42501';
  end if;
  perform private."FC_EXIGIR_AREA_EDITAL"(p_edital::text);
  return v_area;
end;
$function$;
comment on function private."FC_EXIGIR_AVALIACAO_EDITAL"(uuid, integer) is
  'Barra (42501) quem não tem avaliacao_documental no nível pedido (1 leitor, 2 editor, 3 administrador), a área ou o recorte da coordenação do edital; edital inexistente = 22023. Devolve a área do edital.';
revoke all on function private."FC_EXIGIR_AVALIACAO_EDITAL"(uuid, integer) from public, anon, authenticated;

create function private."FC_EXIGIR_COORD_AVALIACAO"(p_edital uuid)
returns text
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_area text := private."FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 3);
begin
  if private."FC_PAPEL_AVALIACAO"(p_edital) is distinct from 'COORDENADOR' then
    raise exception 'Só o gestor do edital ou a coordenação da avaliação muda a regra e a equipe' using errcode = '42501';
  end if;
  return v_area;
end;
$function$;
comment on function private."FC_EXIGIR_COORD_AVALIACAO"(uuid) is
  'Barra (42501) quem não coordena a avaliação documental do edital (Administrador em avaliacao_documental + gestor do edital, coordenador na equipe ou administrador global). Devolve a área do edital.';
revoke all on function private."FC_EXIGIR_COORD_AVALIACAO"(uuid) from public, anon, authenticated;

-- 9. Validação da regra (as mesmas regras de validarRegraAnalise) -----------------------------
create function private."FC_JSON_TEXTO_OK"(p_valor jsonb, p_obrigatorio boolean, p_max integer)
returns boolean
language sql
immutable
set search_path to ''
as $function$
  select case
    when p_valor is null or jsonb_typeof(p_valor) = 'null' or p_valor = '""'::jsonb then not p_obrigatorio
    when jsonb_typeof(p_valor) <> 'string' then false
    else length(p_valor #>> '{}') <= p_max
  end;
$function$;
comment on function private."FC_JSON_TEXTO_OK"(jsonb, boolean, integer) is
  'Texto json válido: ausente, nulo ou vazio só se não for obrigatório; senão, texto de até p_max caracteres.';
revoke all on function private."FC_JSON_TEXTO_OK"(jsonb, boolean, integer) from public, anon, authenticated;

create function private."FC_JSON_TEXTOS_OK"(p_valor jsonb, p_max integer)
returns boolean
language sql
immutable
set search_path to ''
as $function$
  select p_valor is null or jsonb_typeof(p_valor) = 'null'
      or (jsonb_typeof(p_valor) = 'array' and jsonb_array_length(p_valor) <= p_max
          and not exists (select 1 from jsonb_array_elements(p_valor) t
                           where jsonb_typeof(t) <> 'string' or btrim(t #>> '{}') = '' or length(t #>> '{}') > 200));
$function$;
comment on function private."FC_JSON_TEXTOS_OK"(jsonb, integer) is
  'Lista json de textos (1 a 200 caracteres) com até p_max itens; ausente ou nula vale.';
revoke all on function private."FC_JSON_TEXTOS_OK"(jsonb, integer) from public, anon, authenticated;

create function private."FC_JSON_NUMERO_OBRIGATORIO"(p_valor jsonb, p_min numeric, p_max numeric)
returns boolean
language sql
immutable
set search_path to ''
as $function$
  select p_valor is not null and jsonb_typeof(p_valor) = 'number' and (p_valor #>> '{}')::numeric between p_min and p_max;
$function$;
comment on function private."FC_JSON_NUMERO_OBRIGATORIO"(jsonb, numeric, numeric) is 'Número json presente e entre os limites.';
revoke all on function private."FC_JSON_NUMERO_OBRIGATORIO"(jsonb, numeric, numeric) from public, anon, authenticated;

create function private."FC_JSON_SIM_NAO_OK"(p_objeto jsonb, p_chave text)
returns boolean
language sql
immutable
set search_path to ''
as $function$
  select not (p_objeto ? p_chave) or jsonb_typeof(p_objeto -> p_chave) = 'boolean';
$function$;
comment on function private."FC_JSON_SIM_NAO_OK"(jsonb, text) is 'A chave está ausente ou é booleana.';
revoke all on function private."FC_JSON_SIM_NAO_OK"(jsonb, text) from public, anon, authenticated;

create function private."FC_ERRO_EFEITO_ANALISE"(p_efeito text, p_tipo text, p_onde text)
returns text
language sql
immutable
set search_path to ''
as $function$
  select case
    when p_efeito is null or p_efeito not in ('ELIMINA', 'ZERA_PONTOS', 'SEM_PONTOS_ALDEIA', 'AJUSTA_PONTOS', 'SO_REGISTRO',
                                              'ENCAMINHA_HETEROIDENTIFICACAO', 'ENCAMINHA_PERICIA', 'SEGUE_AMPLA')
      then p_onde || ': efeito desconhecido.'
    when p_efeito in ('ZERA_PONTOS', 'AJUSTA_PONTOS') and p_tipo not in ('PONTUACAO', 'TITULOS', 'CURSOS', 'VINCULOS')
      then p_onde || ': só bloco que pontua zera ou ajusta pontos.'
    when p_efeito = 'SEM_PONTOS_ALDEIA' and p_tipo <> 'PONTUACAO'
      then p_onde || ': só o critério étnico tira os pontos de aldeia.'
    when p_efeito in ('ENCAMINHA_HETEROIDENTIFICACAO', 'ENCAMINHA_PERICIA', 'SEGUE_AMPLA') and p_tipo <> 'COTA'
      then p_onde || ': só bloco de cota encaminha.'
  end;
$function$;
comment on function private."FC_ERRO_EFEITO_ANALISE"(text, text, text) is 'Mensagem do erro de um efeito no tipo de bloco; nulo se o efeito vale.';
revoke all on function private."FC_ERRO_EFEITO_ANALISE"(text, text, text) from public, anon, authenticated;

create function private."FC_ERRO_FAIXAS_ANALISE"(p_alvo jsonb, p_onde text)
returns text
language sql
immutable
set search_path to ''
as $function$
  select case
    when jsonb_typeof(p_alvo) is distinct from 'object' then p_onde || ': faixas inválidas.'
    when not private."FC_JSON_NUMERO_ENTRE"(p_alvo -> 'teto', 0, 100) then p_onde || ': teto entre 0 e 100.'
    when jsonb_typeof(p_alvo -> 'faixas') is distinct from 'array' or jsonb_array_length(p_alvo -> 'faixas') not between 1 and 10
      then p_onde || ': de 1 a 10 faixas de carga horária.'
    when exists (select 1 from jsonb_array_elements(p_alvo -> 'faixas') f
                  where jsonb_typeof(f) <> 'object'
                     or not private."FC_JSON_NUMERO_OBRIGATORIO"(f -> 'min_horas', 0, 20000)
                     or not private."FC_JSON_NUMERO_ENTRE"(f -> 'max_horas', 0, 20000)
                     or (jsonb_typeof(f -> 'max_horas') = 'number' and (f ->> 'max_horas')::numeric < (f ->> 'min_horas')::numeric)
                     or not private."FC_JSON_NUMERO_OBRIGATORIO"(f -> 'pontos', 0, 100))
      then p_onde || ': horas de 0 a 20.000 (mínimo ≤ máximo) e pontos de 0 a 100 em cada faixa.'
  end;
$function$;
comment on function private."FC_ERRO_FAIXAS_ANALISE"(jsonb, text) is 'Mensagem do erro nas faixas de carga horária dos cursos (geral ou de um nível); nulo se valem.';
revoke all on function private."FC_ERRO_FAIXAS_ANALISE"(jsonb, text) from public, anon, authenticated;

create function private."FC_ERRO_PONTOS_EXPERIENCIA"(p_alvo jsonb, p_pontuacao text, p_onde text)
returns text
language sql
immutable
set search_path to ''
as $function$
  select case
    when jsonb_typeof(p_alvo) is distinct from 'object' then p_onde || ': pontos inválidos.'
    when p_pontuacao = 'POR_PERIODO' and not private."FC_JSON_NUMERO_OBRIGATORIO"(p_alvo -> 'pontos_por_periodo', 0, 100)
      then p_onde || ': pontos por período entre 0 e 100.'
    when p_pontuacao <> 'POR_PERIODO' and not private."FC_JSON_NUMERO_OBRIGATORIO"(p_alvo -> 'pontos_por_mes', 0, 100)
      then p_onde || ': pontos por mês entre 0 e 100.'
    when not private."FC_JSON_NUMERO_ENTRE"(p_alvo -> 'teto', 0, 1000) then p_onde || ': teto entre 0 e 1000.'
  end;
$function$;
comment on function private."FC_ERRO_PONTOS_EXPERIENCIA"(jsonb, text, text) is 'Mensagem do erro nos pontos da experiência (geral ou de um nível); nulo se valem.';
revoke all on function private."FC_ERRO_PONTOS_EXPERIENCIA"(jsonb, text, text) from public, anon, authenticated;

create function private."FC_VALIDAR_BLOCO_ANALISE"(p_bloco jsonb, p_ordem integer)
returns void
language plpgsql
stable
set search_path to ''
as $function$
declare
  v_onde text := 'Bloco ' || p_ordem || coalesce(' (' || (p_bloco ->> 'codigo') || ')', '');
  v_tipo text := p_bloco ->> 'tipo';
  v_parcial text;
  v_item record;
  v_titulos jsonb;
  v_erro text;
  v_pontuacao text;
  v_codigos text[] := '{}';
  v_desempates text[] := '{}';
  v_ord integer;
begin
  if jsonb_typeof(p_bloco) is distinct from 'object' then
    raise exception '%: inválido.', v_onde using errcode = '22023';
  end if;
  if coalesce(p_bloco ->> 'codigo', '') !~ '^[A-Z][A-Z0-9_]{1,29}$' then
    raise exception '%: código em maiúsculas (2 a 30, letras, dígitos, _).', v_onde using errcode = '22023';
  end if;
  if not private."FC_JSON_TEXTO_OK"(p_bloco -> 'titulo', true, 200) then
    raise exception '% (título): obrigatório, até 200 caracteres.', v_onde using errcode = '22023';
  end if;
  if not private."FC_JSON_TEXTO_OK"(p_bloco -> 'item_edital', false, 40) then
    raise exception '% (item do edital): até 40 caracteres.', v_onde using errcode = '22023';
  end if;
  if v_tipo is null or v_tipo not in ('DOCUMENTO', 'PONTUACAO', 'TITULOS', 'CURSOS', 'VINCULOS', 'COTA', 'REGISTRO') then
    raise exception '%: tipo desconhecido.', v_onde using errcode = '22023';
  end if;
  if not private."FC_JSON_TEXTOS_OK"(p_bloco -> 'perguntas', 10) then
    raise exception '% (perguntas): lista de até 10 textos.', v_onde using errcode = '22023';
  end if;
  if coalesce(jsonb_typeof(p_bloco -> 'condicao'), 'null') <> 'null'
     and coalesce(p_bloco ->> 'condicao', '') !~ '^(INDIGENA|MODALIDADE=[A-Z]{2,12})$' then
    raise exception '%: condição INDIGENA ou MODALIDADE=<código>.', v_onde using errcode = '22023';
  end if;

  -- Efeitos por situação.
  if coalesce(jsonb_typeof(p_bloco -> 'efeitos'), 'null') <> 'null' then
    if jsonb_typeof(p_bloco -> 'efeitos') <> 'object' then
      raise exception '%: efeitos inválidos.', v_onde using errcode = '22023';
    end if;
    for v_item in select e.key, e.value from jsonb_each(p_bloco -> 'efeitos') e loop
      if v_item.key not in ('CONFORME', 'NAO_CONFORME', 'NAO_ENVIADO') then
        raise exception '%: situação % não tem efeito.', v_onde, v_item.key using errcode = '22023';
      end if;
      if v_item.key = 'CONFORME' and (v_item.value #>> '{}') in ('ELIMINA', 'ZERA_PONTOS', 'SEM_PONTOS_ALDEIA') then
        raise exception '%: Conforme não pode eliminar nem tirar pontos.', v_onde using errcode = '22023';
      end if;
      v_erro := private."FC_ERRO_EFEITO_ANALISE"(case when jsonb_typeof(v_item.value) = 'string' then v_item.value #>> '{}' end, v_tipo, v_onde || ', ' || v_item.key);
      if v_erro is not null then raise exception '%', v_erro using errcode = '22023'; end if;
    end loop;
  end if;

  -- Motivos padronizados.
  if coalesce(jsonb_typeof(p_bloco -> 'motivos'), 'null') <> 'null' then
    if jsonb_typeof(p_bloco -> 'motivos') <> 'array' or jsonb_array_length(p_bloco -> 'motivos') > 30 then
      raise exception '%: até 30 motivos.', v_onde using errcode = '22023';
    end if;
    for v_item in select m.value, m.ordinality from jsonb_array_elements(p_bloco -> 'motivos') with ordinality m loop
      if jsonb_typeof(v_item.value) <> 'object' or coalesce(v_item.value ->> 'codigo', '') !~ '^[A-Z][A-Z0-9_]{1,29}$' then
        raise exception '%, motivo %: código em maiúsculas.', v_onde, v_item.ordinality using errcode = '22023';
      end if;
      if (v_item.value ->> 'codigo') = any (v_codigos) then
        raise exception '%, motivo %: código repetido.', v_onde, v_item.ordinality using errcode = '22023';
      end if;
      v_codigos := v_codigos || (v_item.value ->> 'codigo');
      if not private."FC_JSON_TEXTO_OK"(v_item.value -> 'texto', true, 1000)
         or not private."FC_JSON_TEXTO_OK"(v_item.value -> 'item_edital', false, 40) then
        raise exception '%, motivo %: texto obrigatório (até 1000) e item do edital até 40.', v_onde, v_item.ordinality using errcode = '22023';
      end if;
      if coalesce(jsonb_typeof(v_item.value -> 'efeito'), 'null') <> 'null' then
        v_erro := private."FC_ERRO_EFEITO_ANALISE"(case when jsonb_typeof(v_item.value -> 'efeito') = 'string' then v_item.value ->> 'efeito' end,
                                                   v_tipo, v_onde || ', motivo ' || v_item.ordinality);
        if v_erro is not null then raise exception '%', v_erro using errcode = '22023'; end if;
      end if;
    end loop;
  end if;

  -- A parcial de cada tipo.
  v_parcial := case v_tipo when 'PONTUACAO' then 'ETNICO' when 'TITULOS' then 'FORMACAO'
                           when 'CURSOS' then 'CURSOS' when 'VINCULOS' then 'EXPERIENCIA' end;
  if v_parcial is not null and p_bloco ? 'parcial' and (p_bloco -> 'parcial') is distinct from to_jsonb(v_parcial) then
    raise exception '%: a parcial deste tipo é %.', v_onde, v_parcial using errcode = '22023';
  end if;
  if v_parcial is null and coalesce(jsonb_typeof(p_bloco -> 'parcial'), 'null') <> 'null' then
    raise exception '%: este tipo não pontua.', v_onde using errcode = '22023';
  end if;

  if v_tipo = 'PONTUACAO' then
    if not private."FC_JSON_NUMERO_OBRIGATORIO"(p_bloco -> 'indigena', 0, 100)
       or not private."FC_JSON_NUMERO_OBRIGATORIO"(p_bloco -> 'aldeia', 0, 100) then
      raise exception '%: pontos de indígena e de aldeia entre 0 e 100.', v_onde using errcode = '22023';
    end if;
    if not private."FC_JSON_NUMERO_ENTRE"(p_bloco -> 'teto', 0, 100) then
      raise exception '%: teto entre 0 e 100.', v_onde using errcode = '22023';
    end if;
    if coalesce(jsonb_typeof(p_bloco -> 'lista_aldeias'), 'null') <> 'null' and (p_bloco -> 'lista_aldeias') <> '"DSEI_DO_EDITAL"'::jsonb then
      raise exception '%: lista de aldeias DSEI_DO_EDITAL ou nenhuma.', v_onde using errcode = '22023';
    end if;
  elsif v_tipo = 'TITULOS' then
    if jsonb_typeof(p_bloco -> 'cumulativa') is distinct from 'boolean' then
      raise exception '%: diga se os títulos somam (cumulativa).', v_onde using errcode = '22023';
    end if;
    if not private."FC_JSON_NUMERO_ENTRE"(p_bloco -> 'teto', 0, 100) then
      raise exception '%: teto entre 0 e 100.', v_onde using errcode = '22023';
    end if;
    if jsonb_typeof(p_bloco -> 'pontos_por_nivel') is distinct from 'object' or p_bloco -> 'pontos_por_nivel' = '{}'::jsonb then
      raise exception '%: informe os títulos e pontos de ao menos um nível.', v_onde using errcode = '22023';
    end if;
    for v_item in select n.key, n.value from jsonb_each(p_bloco -> 'pontos_por_nivel') n loop
      if v_item.key not in ('superior', 'tecnico', 'medio', 'fundamental') then
        raise exception '%: nível % desconhecido.', v_onde, v_item.key using errcode = '22023';
      end if;
      v_titulos := v_item.value;
      if jsonb_typeof(v_titulos) <> 'array' or jsonb_array_length(v_titulos) > 10 then
        raise exception '%, %: até 10 títulos.', v_onde, v_item.key using errcode = '22023';
      end if;
      if exists (select 1 from jsonb_array_elements(v_titulos) t
                  where jsonb_typeof(t) <> 'object'
                     or coalesce(t ->> 'titulo', '') not in ('ENSINO_MEDIO', 'TECNICO', 'GRADUACAO', 'ESPECIALIZACAO', 'RESIDENCIA', 'MESTRADO', 'DOUTORADO')
                     or not private."FC_JSON_NUMERO_OBRIGATORIO"(t -> 'pontos', 0, 100)) then
        raise exception '%, %: título conhecido e pontos entre 0 e 100.', v_onde, v_item.key using errcode = '22023';
      end if;
      if (select count(distinct t ->> 'titulo') from jsonb_array_elements(v_titulos) t) <> jsonb_array_length(v_titulos) then
        raise exception '%, %: título repetido.', v_onde, v_item.key using errcode = '22023';
      end if;
    end loop;
  elsif v_tipo = 'CURSOS' then
    v_erro := private."FC_ERRO_FAIXAS_ANALISE"(p_bloco, v_onde);
    if v_erro is not null then raise exception '%', v_erro using errcode = '22023'; end if;
    if coalesce(jsonb_typeof(p_bloco -> 'por_nivel'), 'null') <> 'null' then
      if jsonb_typeof(p_bloco -> 'por_nivel') <> 'object' then
        raise exception '%: pontos por nível inválidos.', v_onde using errcode = '22023';
      end if;
      for v_item in select n.key, n.value from jsonb_each(p_bloco -> 'por_nivel') n loop
        if v_item.key not in ('superior', 'tecnico', 'medio', 'fundamental') then
          raise exception '%: nível % desconhecido.', v_onde, v_item.key using errcode = '22023';
        end if;
        v_erro := private."FC_ERRO_FAIXAS_ANALISE"(v_item.value, v_onde || ', ' || v_item.key);
        if v_erro is not null then raise exception '%', v_erro using errcode = '22023'; end if;
      end loop;
    end if;
  elsif v_tipo = 'VINCULOS' then
    if jsonb_typeof(p_bloco -> 'categorias') is distinct from 'array' or jsonb_array_length(p_bloco -> 'categorias') not between 1 and 10 then
      raise exception '%: de 1 a 10 categorias.', v_onde using errcode = '22023';
    end if;
    v_codigos := '{}';
    for v_item in select c.value, c.ordinality from jsonb_array_elements(p_bloco -> 'categorias') with ordinality c loop
      if jsonb_typeof(v_item.value) <> 'object' or coalesce(v_item.value ->> 'codigo', '') !~ '^[A-Z][A-Z0-9_]{1,29}$' then
        raise exception '%, categoria %: código em maiúsculas.', v_onde, v_item.ordinality using errcode = '22023';
      end if;
      if (v_item.value ->> 'codigo') = any (v_codigos) then
        raise exception '%, categoria %: código repetido.', v_onde, v_item.ordinality using errcode = '22023';
      end if;
      v_codigos := v_codigos || (v_item.value ->> 'codigo');
      if not private."FC_JSON_TEXTO_OK"(v_item.value -> 'rotulo', true, 100) then
        raise exception '%, categoria % (rótulo): obrigatório, até 100 caracteres.', v_onde, v_item.ordinality using errcode = '22023';
      end if;
      if not private."FC_JSON_NUMERO_ENTRE"(v_item.value -> 'desempate', 1, 5) then
        raise exception '%, categoria %: desempate de 1 a 5 ou nenhum.', v_onde, v_item.ordinality using errcode = '22023';
      end if;
      if jsonb_typeof(v_item.value -> 'desempate') = 'number' then
        if (v_item.value ->> 'desempate') = any (v_desempates) then
          raise exception '%, categoria %: desempate % repetido.', v_onde, v_item.ordinality, v_item.value ->> 'desempate' using errcode = '22023';
        end if;
        v_desempates := v_desempates || (v_item.value ->> 'desempate');
      end if;
      if not private."FC_JSON_SIM_NAO_OK"(v_item.value, 'pontua') then
        raise exception '%, categoria %: diga se pontua.', v_onde, v_item.ordinality using errcode = '22023';
      end if;
    end loop;
    if not private."FC_JSON_NUMERO_ENTRE"(p_bloco -> 'minimo_meses', 0, 600) then
      raise exception '%: mínimo de meses entre 0 e 600.', v_onde using errcode = '22023';
    end if;
    if coalesce(jsonb_typeof(p_bloco -> 'efeito_minimo'), 'null') <> 'null' and coalesce(p_bloco ->> 'efeito_minimo', '') not in ('ELIMINA', 'SO_REGISTRO') then
      raise exception '%: abaixo do mínimo elimina ou só registra.', v_onde using errcode = '22023';
    end if;
    v_pontuacao := case when coalesce(jsonb_typeof(p_bloco -> 'pontuacao'), 'null') = 'null' then 'POR_MES' else p_bloco ->> 'pontuacao' end;
    if v_pontuacao is null or v_pontuacao not in ('POR_MES', 'POR_PERIODO') then
      raise exception '%: pontuação por mês ou por período.', v_onde using errcode = '22023';
    end if;
    if v_pontuacao = 'POR_PERIODO' and not private."FC_JSON_NUMERO_OBRIGATORIO"(p_bloco -> 'periodo_meses', 1, 120) then
      raise exception '%: período de 1 a 120 meses.', v_onde using errcode = '22023';
    end if;
    if not private."FC_JSON_SIM_NAO_OK"(p_bloco, 'desconta_minimo') then
      raise exception '%: diga se o mínimo exigido fica fora da pontuação.', v_onde using errcode = '22023';
    end if;
    v_erro := private."FC_ERRO_PONTOS_EXPERIENCIA"(p_bloco, v_pontuacao, v_onde);
    if v_erro is not null then raise exception '%', v_erro using errcode = '22023'; end if;
    if coalesce(jsonb_typeof(p_bloco -> 'por_nivel'), 'null') <> 'null' then
      if jsonb_typeof(p_bloco -> 'por_nivel') <> 'object' then
        raise exception '%: pontos por nível inválidos.', v_onde using errcode = '22023';
      end if;
      for v_item in select n.key, n.value from jsonb_each(p_bloco -> 'por_nivel') n loop
        if v_item.key not in ('superior', 'tecnico', 'medio', 'fundamental') then
          raise exception '%: nível % desconhecido.', v_onde, v_item.key using errcode = '22023';
        end if;
        v_erro := private."FC_ERRO_PONTOS_EXPERIENCIA"(v_item.value, v_pontuacao, v_onde || ', ' || v_item.key);
        if v_erro is not null then raise exception '%', v_erro using errcode = '22023'; end if;
      end loop;
    end if;
    if not private."FC_JSON_NUMERO_ENTRE"(p_bloco -> 'dias_por_mes', 1, 31) then
      raise exception '%: dias por mês entre 1 e 31.', v_onde using errcode = '22023';
    end if;
    if not private."FC_JSON_NUMERO_ENTRE"(p_bloco -> 'max_vinculos', 1, 50) then
      raise exception '%: de 1 a 50 vínculos.', v_onde using errcode = '22023';
    end if;
    if coalesce(jsonb_typeof(p_bloco -> 'data_limite'), 'null') <> 'null' then
      if jsonb_typeof(p_bloco -> 'data_limite') <> 'string' or (p_bloco ->> 'data_limite') !~ '^\d{4}-\d{2}-\d{2}$'
         then
        raise exception '%: data limite AAAA-MM-DD.', v_onde using errcode = '22023';
      end if;
      begin
        perform (p_bloco ->> 'data_limite')::date;
      exception when others then
        raise exception '%: data limite AAAA-MM-DD.', v_onde using errcode = '22023';
      end;
    end if;
    if coalesce(jsonb_typeof(p_bloco -> 'estagio_indigena'), 'null') <> 'null'
       and (jsonb_typeof(p_bloco -> 'estagio_indigena') <> 'object'
            or jsonb_typeof(p_bloco #> '{estagio_indigena,ativo}') is distinct from 'boolean'
            or not private."FC_JSON_NUMERO_ENTRE"(p_bloco #> '{estagio_indigena,horas_por_dia}', 1, 24)
            or not private."FC_JSON_NUMERO_ENTRE"(p_bloco #> '{estagio_indigena,dias_por_mes}', 1, 31)) then
      raise exception '%: estágio de indígena com horas por dia (1 a 24) e dias por mês (1 a 31).', v_onde using errcode = '22023';
    end if;
  end if;
end;
$function$;
comment on function private."FC_VALIDAR_BLOCO_ANALISE"(jsonb, integer) is
  'Confere um bloco da regra da avaliação documental (22023 com a mensagem); as regras de conferirBloco em src/lib/avaliacao-documental/regra.js.';
revoke all on function private."FC_VALIDAR_BLOCO_ANALISE"(jsonb, integer) from public, anon, authenticated;

create function private."FC_VALIDAR_REGRA_ANALISE"(p_regra jsonb)
returns void
language plpgsql
stable
set search_path to ''
as $function$
declare
  v_lista jsonb;
  v_obj jsonb;
  v_item record;
  v_codigos text[] := '{}';
  v_mapa jsonb;
  v_tipo text;
begin
  if jsonb_typeof(p_regra) is distinct from 'object' then
    raise exception 'Regra inválida: envie um objeto.' using errcode = '22023';
  end if;
  if length(p_regra::text) > 200000 then
    raise exception 'Regra grande demais.' using errcode = '22023';
  end if;
  if (p_regra -> 'schema') is distinct from '1'::jsonb then
    raise exception 'Versão do formato (schema) deve ser 1.' using errcode = '22023';
  end if;
  if not private."FC_JSON_TEXTO_OK"(p_regra -> 'modelo', false, 30)
     or not private."FC_JSON_TEXTO_OK"(p_regra -> 'titulo_etapa', true, 200)
     or not private."FC_JSON_TEXTO_OK"(p_regra -> 'edital_rotulo', false, 120) then
    raise exception 'Modelo (até 30), título da etapa (obrigatório, até 200) ou rótulo do edital (até 120) inválidos.' using errcode = '22023';
  end if;
  if not private."FC_JSON_NUMERO_ENTRE"(p_regra -> 'casas_parecer', 0, 4) then
    raise exception 'Casas decimais do parecer entre 0 e 4.' using errcode = '22023';
  end if;

  -- Provisória: eliminação automática e nota declarada.
  v_obj := coalesce(p_regra -> 'provisoria', '{}'::jsonb);
  if jsonb_typeof(v_obj) <> 'object' then
    raise exception 'Provisória inválida.' using errcode = '22023';
  end if;
  v_lista := coalesce(v_obj -> 'eliminacao_automatica', '[]'::jsonb);
  if jsonb_typeof(v_lista) <> 'array' or jsonb_array_length(v_lista) > 20 then
    raise exception 'Eliminação automática: até 20 regras.' using errcode = '22023';
  end if;
  for v_item in select e.value, e.ordinality from jsonb_array_elements(v_lista) with ordinality e loop
    if jsonb_typeof(v_item.value) <> 'object' or coalesce(v_item.value ->> 'codigo', '') !~ '^[A-Z][A-Z0-9_]{1,29}$' then
      raise exception 'Eliminação automática %: código em maiúsculas.', v_item.ordinality using errcode = '22023';
    end if;
    if (v_item.value ->> 'codigo') = any (v_codigos) then
      raise exception 'Eliminação automática %: código repetido.', v_item.ordinality using errcode = '22023';
    end if;
    v_codigos := v_codigos || (v_item.value ->> 'codigo');
    if (select count(*) from unnest(array['coluna', 'coluna_prefixo', 'pergunta']) k
         where jsonb_typeof(v_item.value -> k) = 'string' and btrim(v_item.value ->> k) <> '') <> 1 then
      raise exception 'Eliminação automática %: diga uma coluna, um prefixo de coluna ou uma pergunta.', v_item.ordinality using errcode = '22023';
    end if;
    if not private."FC_JSON_TEXTOS_OK"(v_item.value -> 'quando', 20) or not private."FC_JSON_TEXTOS_OK"(v_item.value -> 'exceto', 20) then
      raise exception 'Eliminação automática %: quando/exceto com até 20 textos.', v_item.ordinality using errcode = '22023';
    end if;
    if coalesce(jsonb_array_length(case when jsonb_typeof(v_item.value -> 'quando') = 'array' then v_item.value -> 'quando' end), 0)
       + coalesce(jsonb_array_length(case when jsonb_typeof(v_item.value -> 'exceto') = 'array' then v_item.value -> 'exceto' end), 0) = 0 then
      raise exception 'Eliminação automática %: diga os valores que eliminam (quando) ou os que passam (exceto).', v_item.ordinality using errcode = '22023';
    end if;
    if not private."FC_JSON_TEXTO_OK"(v_item.value -> 'motivo', true, 200) then
      raise exception 'Eliminação automática % (motivo): obrigatório, até 200 caracteres.', v_item.ordinality using errcode = '22023';
    end if;
  end loop;
  v_lista := coalesce(v_obj -> 'nota_declarada', '[]'::jsonb);
  if jsonb_typeof(v_lista) <> 'array' or jsonb_array_length(v_lista) > 20 then
    raise exception 'Nota declarada: até 20 perguntas.' using errcode = '22023';
  end if;
  for v_item in select d.value, d.ordinality from jsonb_array_elements(v_lista) with ordinality d loop
    if jsonb_typeof(v_item.value) <> 'object' then
      raise exception 'Nota declarada %: inválida.', v_item.ordinality using errcode = '22023';
    end if;
    if coalesce(v_item.value ->> 'parcial', '') not in ('ETNICO', 'FORMACAO', 'CURSOS', 'EXPERIENCIA') then
      raise exception 'Nota declarada %: parcial ETNICO, FORMACAO, CURSOS ou EXPERIENCIA.', v_item.ordinality using errcode = '22023';
    end if;
    if not private."FC_JSON_TEXTO_OK"(v_item.value -> 'pergunta', true, 200) then
      raise exception 'Nota declarada % (pergunta): obrigatória, até 200 caracteres.', v_item.ordinality using errcode = '22023';
    end if;
    v_tipo := v_item.value ->> 'tipo';
    if v_tipo is null or v_tipo not in ('OPCAO', 'OPCOES_SOMADAS', 'FAIXA_EM_MESES') then
      raise exception 'Nota declarada %: tipo OPCAO, OPCOES_SOMADAS ou FAIXA_EM_MESES.', v_item.ordinality using errcode = '22023';
    end if;
    v_mapa := case when v_tipo = 'FAIXA_EM_MESES' then v_item.value -> 'meses' else v_item.value -> 'pontos' end;
    if jsonb_typeof(v_mapa) is distinct from 'object'
       or (select count(*) from jsonb_object_keys(v_mapa)) > 50
       or exists (select 1 from jsonb_each(v_mapa) r
                   where btrim(r.key) = '' or length(r.key) > 200
                      or not private."FC_JSON_NUMERO_OBRIGATORIO"(r.value, 0, case when v_tipo = 'FAIXA_EM_MESES' then 1200 else 100 end)) then
      raise exception 'Nota declarada %: % de cada resposta (até 50 respostas).', v_item.ordinality,
        case when v_tipo = 'FAIXA_EM_MESES' then 'meses (0 a 1200)' else 'pontos (0 a 100)' end using errcode = '22023';
    end if;
    if v_tipo = 'FAIXA_EM_MESES' and not private."FC_JSON_NUMERO_OBRIGATORIO"(v_item.value -> 'pontos_por_mes', 0, 100) then
      raise exception 'Nota declarada %: pontos por mês entre 0 e 100.', v_item.ordinality using errcode = '22023';
    end if;
    if not private."FC_JSON_NUMERO_ENTRE"(v_item.value -> 'teto', 0, 100) then
      raise exception 'Nota declarada %: teto entre 0 e 100.', v_item.ordinality using errcode = '22023';
    end if;
  end loop;
  if not private."FC_JSON_NUMERO_ENTRE"(v_obj -> 'divergencia_tolerancia', 0, 30) then
    raise exception 'Tolerância da divergência entre 0 e 30 pontos.' using errcode = '22023';
  end if;

  -- Lote.
  v_obj := coalesce(p_regra -> 'lote', '{}'::jsonb);
  if jsonb_typeof(v_obj) <> 'object' then
    raise exception 'Lote inválido.' using errcode = '22023';
  end if;
  if coalesce(v_obj ->> 'base', '') not in ('MULTIPLO_VAGAS', 'FIXO') then
    raise exception 'Lote: múltiplo das vagas ou número fixo.' using errcode = '22023';
  end if;
  if v_obj ->> 'base' = 'MULTIPLO_VAGAS' and not private."FC_JSON_NUMERO_OBRIGATORIO"(v_obj -> 'multiplo', 1, 100) then
    raise exception 'Lote: múltiplo de 1 a 100.' using errcode = '22023';
  end if;
  if v_obj ->> 'base' = 'FIXO' and not private."FC_JSON_NUMERO_OBRIGATORIO"(v_obj -> 'fixo', 1, 100000) then
    raise exception 'Lote: número fixo de 1 a 100.000.' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(array['inclui_cr', 'por_modalidade', 'inclui_empatados', 'linha_anda', 'publica_reposicao']) k
              where not private."FC_JSON_SIM_NAO_OK"(v_obj, k)) then
    raise exception 'Lote: as opções são sim ou não.' using errcode = '22023';
  end if;

  -- Distribuição e revisão.
  v_obj := coalesce(p_regra -> 'distribuicao', '{}'::jsonb);
  if jsonb_typeof(v_obj) <> 'object' then
    raise exception 'Distribuição inválida.' using errcode = '22023';
  end if;
  if coalesce(v_obj ->> 'modo', '') not in ('PEGAR_PROXIMO', 'DISTRIBUICAO_INICIAL') then
    raise exception 'Distribuição: Pegar próximo ou Distribuição inicial.' using errcode = '22023';
  end if;
  if coalesce(jsonb_typeof(v_obj -> 'criterio'), 'null') <> 'null' and coalesce(v_obj ->> 'criterio', '') not in ('PARTES_IGUAIS', 'LIMITE') then
    raise exception 'Distribuição: partes iguais ou até um limite.' using errcode = '22023';
  end if;
  if not private."FC_JSON_NUMERO_ENTRE"(v_obj -> 'limite_por_analista', 1, 5000) then
    raise exception 'Distribuição: limite por analista de 1 a 5.000.' using errcode = '22023';
  end if;
  if coalesce(jsonb_typeof(v_obj -> 'novos'), 'null') <> 'null' and coalesce(v_obj ->> 'novos', '') not in ('MENOS_PENDENTES', 'PEGAR_PROXIMO') then
    raise exception 'Distribuição: destino dos que entram depois inválido.' using errcode = '22023';
  end if;
  if not private."FC_JSON_NUMERO_ENTRE"(v_obj -> 'dias_parada', 1, 60) then
    raise exception 'Distribuição: ficha parada de 1 a 60 dias úteis.' using errcode = '22023';
  end if;
  v_obj := coalesce(p_regra -> 'revisao', '{}'::jsonb);
  if jsonb_typeof(v_obj) <> 'object' then
    raise exception 'Revisão inválida.' using errcode = '22023';
  end if;
  if not private."FC_JSON_NUMERO_ENTRE"(v_obj -> 'amostra_percentual', 0, 100)
     or not private."FC_JSON_NUMERO_ENTRE"(v_obj -> 'minimo_por_analista', 0, 1000)
     or not private."FC_JSON_NUMERO_ENTRE"(v_obj -> 'divergencia_pontos', 0, 1000) then
    raise exception 'Revisão: amostra de 0 a 100%%, mínimo por analista e divergência de 0 a 1.000.' using errcode = '22023';
  end if;
  if coalesce(jsonb_typeof(v_obj -> 'sinais'), 'null') <> 'null'
     and (jsonb_typeof(v_obj -> 'sinais') <> 'array'
          or exists (select 1 from jsonb_array_elements(v_obj -> 'sinais') s
                      where coalesce(s #>> '{}', '') not in ('VINCULO_ATIVO', 'PARENTESCO') or jsonb_typeof(s) <> 'string')) then
    raise exception 'Revisão: sinais desconhecidos.' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(array['todas', 'inaptos_requisito', 'inaptos_nota', 'entrou_pela_linha', 'duplo_cego']) k
              where not private."FC_JSON_SIM_NAO_OK"(v_obj, k)) then
    raise exception 'Revisão: as opções são sim ou não.' using errcode = '22023';
  end if;

  -- Blocos.
  v_lista := p_regra -> 'blocos';
  if jsonb_typeof(v_lista) is distinct from 'array' or jsonb_array_length(v_lista) not between 1 and 40 then
    raise exception 'De 1 a 40 blocos.' using errcode = '22023';
  end if;
  for v_item in select b.value, b.ordinality from jsonb_array_elements(v_lista) with ordinality b loop
    perform private."FC_VALIDAR_BLOCO_ANALISE"(v_item.value, v_item.ordinality::integer);
  end loop;
  if (select count(distinct b ->> 'codigo') from jsonb_array_elements(v_lista) b) <> jsonb_array_length(v_lista) then
    raise exception 'Código de bloco repetido.' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(v_lista) b
              where b ->> 'tipo' in ('PONTUACAO', 'TITULOS', 'CURSOS', 'VINCULOS')
              group by b ->> 'tipo' having count(*) > 1) then
    raise exception 'Só um bloco de cada tipo que pontua (uma parcial por regra).' using errcode = '22023';
  end if;

  -- Nota mínima, parecer e observações prontas.
  if coalesce(jsonb_typeof(p_regra -> 'corte'), 'null') <> 'null' then
    if jsonb_typeof(p_regra -> 'corte') <> 'object' or (p_regra #> '{corte,fonte}') is distinct from '"REGRA_CLASSIFICACAO"'::jsonb then
      raise exception 'A nota mínima vem da regra de classificação (REGRA_CLASSIFICACAO).' using errcode = '22023';
    end if;
    if not private."FC_JSON_TEXTO_OK"(p_regra #> '{corte,item_edital}', false, 40) then
      raise exception 'Item da nota mínima: até 40 caracteres.' using errcode = '22023';
    end if;
  end if;
  v_obj := coalesce(p_regra -> 'parecer', '{}'::jsonb);
  if jsonb_typeof(v_obj) <> 'object'
     or exists (select 1 from unnest(array['APTO', 'INAPTO_REQUISITO', 'INAPTO_NOTA', 'observacoes']) k
                 where not private."FC_JSON_TEXTO_OK"(v_obj -> k, true, 4000)) then
    raise exception 'Modelos de parecer: APTO, INAPTO_REQUISITO, INAPTO_NOTA e observacoes, cada um com até 4.000 caracteres.' using errcode = '22023';
  end if;
  v_lista := coalesce(p_regra -> 'observacoes_prontas', '[]'::jsonb);
  if jsonb_typeof(v_lista) <> 'array' or jsonb_array_length(v_lista) > 40 then
    raise exception 'Até 40 observações prontas.' using errcode = '22023';
  end if;
  v_codigos := '{}';
  for v_item in select o.value, o.ordinality from jsonb_array_elements(v_lista) with ordinality o loop
    if jsonb_typeof(v_item.value) <> 'object' or coalesce(v_item.value ->> 'codigo', '') !~ '^[A-Z][A-Z0-9_]{1,29}$' then
      raise exception 'Observação pronta %: código em maiúsculas.', v_item.ordinality using errcode = '22023';
    end if;
    if (v_item.value ->> 'codigo') = any (v_codigos) then
      raise exception 'Observação pronta %: código repetido.', v_item.ordinality using errcode = '22023';
    end if;
    v_codigos := v_codigos || (v_item.value ->> 'codigo');
    if not private."FC_JSON_TEXTO_OK"(v_item.value -> 'rotulo', true, 100)
       or not private."FC_JSON_TEXTO_OK"(v_item.value -> 'texto', true, 1000)
       or not private."FC_JSON_TEXTO_OK"(v_item.value -> 'item_edital', false, 40) then
      raise exception 'Observação pronta %: rótulo (até 100) e texto (até 1000) obrigatórios; item até 40.', v_item.ordinality using errcode = '22023';
    end if;
  end loop;
end;
$function$;
comment on function private."FC_VALIDAR_REGRA_ANALISE"(jsonb) is
  'Confere a configuração de uma regra da avaliação documental (22023 com a mensagem do primeiro erro). As mesmas regras de validarRegraAnalise() em src/lib/avaliacao-documental/regra.js.';
revoke all on function private."FC_VALIDAR_REGRA_ANALISE"(jsonb) from public, anon, authenticated;

-- 10. Leituras em json -------------------------------------------------------------------------
create function private."FC_REGRA_ANALISE_JSON"(p_edital uuid)
returns json
language sql
stable
security definer
set search_path to ''
as $function$
  select json_build_object(
           'versao', r."NU_VERSAO_VIGENTE",
           'situacao', r."TP_SITUACAO",
           'modelo_origem', r."CO_MODELO_ORIGEM",
           'configuracao', v."DS_CONFIGURACAO",
           'hash', v."DS_HASH",
           'atualizado_em', v."DT_CRIACAO",
           'por', coalesce(p.nome, p.email),
           'conferida_em', r."DT_CONFERENCIA",
           'conferida_por', coalesce(pc.nome, pc.email),
           'versoes', coalesce((
             select json_agg(json_build_object(
                      'versao', h."NU_VERSAO", 'em', h."DT_CRIACAO", 'por', coalesce(pu.nome, pu.email),
                      'motivo', h."DS_MOTIVO", 'hash', h."DS_HASH", 'configuracao', h."DS_CONFIGURACAO")
                    order by h."NU_VERSAO" desc)
               from public."TH_REGRA_ANALISE" h
               left join public."TB_PERFIL_USUARIO" pu on pu.user_id = h."CO_USUARIO"
              where h."CO_REGRA_ANALISE" = r."CO_REGRA_ANALISE"), '[]'::json))
    from public."TB_REGRA_ANALISE" r
    join public."TH_REGRA_ANALISE" v
      on v."CO_REGRA_ANALISE" = r."CO_REGRA_ANALISE" and v."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
    left join public."TB_PERFIL_USUARIO" p on p.user_id = v."CO_USUARIO"
    left join public."TB_PERFIL_USUARIO" pc on pc.user_id = r."CO_USUARIO_CONFERENCIA"
   where r."CO_MONITORAMENTO" = p_edital;
$function$;
comment on function private."FC_REGRA_ANALISE_JSON"(uuid) is
  'Regra da avaliação vigente do edital (versão, situação, configuração, hash, quem e quando, conferência) e o histórico de versões; null sem regra.';
revoke all on function private."FC_REGRA_ANALISE_JSON"(uuid) from public, anon, authenticated;

-- 11. RPCs --------------------------------------------------------------------------------------
create function public.listar_editais_avaliacao(p_area text)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_editais uuid[];
begin
  if not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = p_area) then
    raise exception 'Área inválida' using errcode = '22023';
  end if;
  if not private.pode_recurso('avaliacao_documental', 1) then
    raise exception 'Sem permissão para a Avaliação documental' using errcode = '42501';
  end if;
  if not private."FC_PODE_AREA"(p_area) then
    raise exception 'Sem acesso a esta área' using errcode = '42501';
  end if;
  v_editais := (select private."FC_EDITAIS_VISIVEIS"())::uuid[];

  return json_build_object(
    'area', p_area,
    'nivel', private.nivel_recurso('avaliacao_documental'),
    'editais', coalesce((
      select json_agg(json_build_object(
               'id', m.id, 'edital', m.edital, 'unidade', m.unidade, 'ativo', m.ativo,
               'numero', private."FC_NUMERO_EDITAL"(m.edital),
               'versao_regra', r."NU_VERSAO_VIGENTE", 'situacao_regra', r."TP_SITUACAO",
               'origem', coalesce(o."TP_ORIGEM", 'PLANILHA'),
               'papel', private."FC_PAPEL_AVALIACAO"(m.id))
             order by m.ativo desc, r."NU_VERSAO_VIGENTE" is null, m.edital)
        from public."TB_MONITORAMENTO_INDIGENA" m
        left join public."TB_REGRA_ANALISE" r on r."CO_MONITORAMENTO" = m.id
        left join public."TB_ORIGEM_ANALISE_EDITAL" o on o."CO_MONITORAMENTO" = m.id
       where m."CO_AREA" = p_area and (v_editais is null or m.id = any (v_editais))), '[]'::json)
  );
end;
$function$;
comment on function public.listar_editais_avaliacao(text) is
  'Editais da área para a Avaliação documental (json): versão e situação da regra, dono da avaliação (PLANILHA, COMPARACAO, MONITORA) e o papel de quem está logado. Exige avaliacao_documental >= leitor, a área e o recorte da coordenação.';
revoke all on function public.listar_editais_avaliacao(text) from public, anon;
grant execute on function public.listar_editais_avaliacao(text) to authenticated, service_role;

create function public.obter_regra_analise(p_edital uuid)
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
  v_coordena boolean := private."FC_PAPEL_AVALIACAO"(p_edital) = 'COORDENADOR';
  v_vagas text[];
begin
  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" where id = p_edital;
  select coalesce(array_agg(v."CO_VAGA"), '{}') into v_vagas
    from public."TB_EMPREGARE_VAGA" v
   where v."CO_MONITORAMENTO" = p_edital and v."TP_SITUACAO" = 'GRAVADA';

  return json_build_object(
    'schema_version', 1,
    'edital', json_build_object('id', v_m.id, 'edital', v_m.edital, 'unidade', v_m.unidade, 'area', v_area,
                                'numero', private."FC_NUMERO_EDITAL"(v_m.edital), 'id_unidade', v_m.id_unidade),
    'papel', v_papel,
    'pode_coordenar', coalesce(v_coordena, false),
    'origem', coalesce((select o."TP_ORIGEM" from public."TB_ORIGEM_ANALISE_EDITAL" o where o."CO_MONITORAMENTO" = p_edital), 'PLANILHA'),
    'regra', private."FC_REGRA_ANALISE_JSON"(p_edital),
    'modelos', coalesce((
      select json_agg(json_build_object('codigo', d."CO_MODELO", 'nome', d."NO_MODELO", 'configuracao', d."DS_CONFIGURACAO")
             order by d."CO_MODELO")
        from public."TB_REGRA_ANALISE_MODELO" d where d."ST_ATIVO" = 'S'), '[]'::json),
    'nota_minima', (
      select json_build_object('nota_minima', h."DS_CONFIGURACAO" #> '{documental,nota_minima}',
                               'nota_minima_por_nivel', coalesce(h."DS_CONFIGURACAO" #> '{documental,nota_minima_por_nivel}', '{}'::jsonb),
                               'versao_regra_classificacao', r."NU_VERSAO_VIGENTE")
        from public."TB_REGRA_CLASSIFICACAO" r
        join public."TH_REGRA_CLASSIFICACAO" h
          on h."CO_REGRA_CLASSIFICACAO" = r."CO_REGRA_CLASSIFICACAO" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
       where r."CO_MONITORAMENTO" = p_edital),
    'aldeias', (
      select json_build_object('quantidade', count(*), 'atualizado_em', max(a."DT_ATUALIZACAO"),
                               'fonte', (array_agg(a."DS_FONTE" order by a."DT_ATUALIZACAO" desc))[1])
        from public."TD_ALDEIA_DSEI" a
       where v_m.id_unidade is not null and a."CO_UNIDADE" = v_m.id_unidade::text and a."ST_ATIVO" = 'S'),
    'pode_carregar_aldeias', private.is_master(),
    'vagas_empregare', cardinality(v_vagas),
    -- Perguntas e respostas da última carga: só para a coordenação, que liga os blocos.
    -- Resposta que aparece uma vez só não sai (pode ser texto livre com dado pessoal):
    -- vira a contagem "outras".
    'perguntas', case when coalesce(v_coordena, false) then coalesce((
      with colunas as (
        select distinct c.coluna
          from public."TB_EMPREGARE_VAGA" v,
               lateral jsonb_array_elements_text(v."DS_COLUNA") c(coluna)
         where v."CO_VAGA" = any (v_vagas) and c.coluna ilike 'Pergunta %'
      ),
      respostas as (
        select k.coluna, left(btrim(c."DS_COLUNA_ORIGINAL" ->> k.coluna), 200) as valor, count(*)::integer as qt
          from colunas k
          join public."TB_EMPREGARE_CANDIDATO" c
            on c."CO_VAGA" = any (v_vagas) and c."ST_REGISTRO_ATIVO" = 'S'
         where coalesce(btrim(c."DS_COLUNA_ORIGINAL" ->> k.coluna), '') <> ''
         group by 1, 2
      )
      select json_agg(json_build_object(
               'coluna', k.coluna,
               'respostas', coalesce((
                 select json_agg(json_build_object('valor', x.valor, 'quantidade', x.qt) order by x.qt desc, x.valor)
                   from (select r.valor, r.qt from respostas r where r.coluna = k.coluna and r.qt >= 2
                          order by r.qt desc, r.valor limit 30) x), '[]'::json),
               'outras', (select count(*) from respostas r where r.coluna = k.coluna and r.qt < 2),
               'distintas', (select count(*) from respostas r where r.coluna = k.coluna))
             order by nullif(substring(k.coluna from '^Pergunta\s+(\d+)'), '')::integer nulls last, k.coluna)
        from colunas k), '[]'::json) else '[]'::json end,
    'fichas_concluidas', 0
  );
end;
$function$;
comment on function public.obter_regra_analise(uuid) is
  'A regra da avaliação documental do edital (json): vigente e versões, modelos para copiar, nota mínima da regra de classificação, aldeias do DSEI do edital, dono da avaliação, papel de quem está logado e, só para a coordenação, as perguntas da última carga da Empregare com as respostas encontradas (só as que aparecem 2+ vezes, até 30 por pergunta). fichas_concluidas fica 0 até as fichas da fase F3. Exige avaliacao_documental >= leitor, a área e o recorte da coordenação.';
revoke all on function public.obter_regra_analise(uuid) from public, anon;
grant execute on function public.obter_regra_analise(uuid) to authenticated, service_role;

create function public.salvar_regra_analise(p_edital uuid, p_configuracao jsonb, p_versao_atual integer, p_motivo text)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_area text := private."FC_EXIGIR_COORD_AVALIACAO"(p_edital);
  v_regra public."TB_REGRA_ANALISE";
  v_nova integer;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_uid uuid := (select auth.uid());
begin
  perform private."FC_VALIDAR_REGRA_ANALISE"(p_configuracao);
  if v_motivo is not null and length(v_motivo) > 2000 then
    raise exception 'Motivo com até 2.000 caracteres.' using errcode = '22023';
  end if;

  select * into v_regra from public."TB_REGRA_ANALISE" where "CO_MONITORAMENTO" = p_edital for update;
  if v_regra."CO_REGRA_ANALISE" is null then
    if coalesce(p_versao_atual, 0) <> 0 then
      raise exception 'A regra mudou desde que você abriu; recarregue.' using errcode = '40001';
    end if;
    insert into public."TB_REGRA_ANALISE" ("CO_MONITORAMENTO", "NU_VERSAO_VIGENTE", "CO_USUARIO_ATUALIZACAO")
    values (p_edital, 1, v_uid)
    returning * into v_regra;
    v_nova := 1;
  else
    if p_versao_atual is distinct from v_regra."NU_VERSAO_VIGENTE" then
      raise exception 'A regra mudou desde que você abriu (versão %); recarregue.', v_regra."NU_VERSAO_VIGENTE" using errcode = '40001';
    end if;
    if v_motivo is null or length(v_motivo) < 10 then
      raise exception 'Informe o motivo da alteração (10 a 2.000 caracteres).' using errcode = '22023';
    end if;
    v_nova := v_regra."NU_VERSAO_VIGENTE" + 1;
  end if;

  insert into public."TH_REGRA_ANALISE" ("CO_REGRA_ANALISE", "NU_VERSAO", "DS_CONFIGURACAO", "DS_HASH", "DS_MOTIVO", "CO_USUARIO")
  values (v_regra."CO_REGRA_ANALISE", v_nova, p_configuracao,
          encode(sha256(convert_to(p_configuracao::text, 'UTF8')), 'hex'), coalesce(v_motivo, 'Regra criada do zero'), v_uid);

  update public."TB_REGRA_ANALISE"
     set "NU_VERSAO_VIGENTE" = v_nova, "TP_SITUACAO" = 'CONFERIR', "CO_USUARIO_CONFERENCIA" = null, "DT_CONFERENCIA" = null,
         "DT_ATUALIZACAO" = now(), "CO_USUARIO_ATUALIZACAO" = v_uid
   where "CO_REGRA_ANALISE" = v_regra."CO_REGRA_ANALISE";

  return json_build_object('regra', private."FC_REGRA_ANALISE_JSON"(p_edital), 'fichas_afetadas', '[]'::json);
end;
$function$;
comment on function public.salvar_regra_analise(uuid, jsonb, integer, text) is
  'Salva a regra da avaliação documental do edital como versão nova (a anterior fica no histórico, imutável) e volta a situação para Conferir. p_versao_atual = a versão que a tela abriu (0 sem regra; outra = 40001). Motivo obrigatório da versão 2 em diante (10 a 2.000). fichas_afetadas: as fichas concluídas com versão anterior (vazio até a fase F3; nada é recalculado). Só a coordenação do edital.';
revoke all on function public.salvar_regra_analise(uuid, jsonb, integer, text) from public, anon;
grant execute on function public.salvar_regra_analise(uuid, jsonb, integer, text) to authenticated, service_role;

create function public.copiar_modelo_regra_analise(p_edital uuid, p_modelo text)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_area text := private."FC_EXIGIR_COORD_AVALIACAO"(p_edital);
  v_modelo public."TB_REGRA_ANALISE_MODELO";
  v_config jsonb;
  v_numero text;
  v_regra uuid;
  v_uid uuid := (select auth.uid());
begin
  select * into v_modelo from public."TB_REGRA_ANALISE_MODELO" where "CO_MODELO" = p_modelo and "ST_ATIVO" = 'S';
  if v_modelo."CO_MODELO" is null then
    raise exception 'Modelo não encontrado' using errcode = '22023';
  end if;
  if exists (select 1 from public."TB_REGRA_ANALISE" where "CO_MONITORAMENTO" = p_edital) then
    raise exception 'O edital já tem regra: carregue o modelo no formulário e salve uma versão nova com o motivo.' using errcode = '23505';
  end if;
  select private."FC_NUMERO_EDITAL"(m.edital) into v_numero from public."TB_MONITORAMENTO_INDIGENA" m where m.id = p_edital;
  v_config := v_modelo."DS_CONFIGURACAO" || jsonb_build_object('modelo', v_modelo."CO_MODELO");
  if coalesce(btrim(v_config ->> 'edital_rotulo'), '') = '' and v_numero is not null then
    v_config := v_config || jsonb_build_object('edital_rotulo', 'Edital ' || v_numero);
  end if;
  perform private."FC_VALIDAR_REGRA_ANALISE"(v_config);

  insert into public."TB_REGRA_ANALISE" ("CO_MONITORAMENTO", "NU_VERSAO_VIGENTE", "CO_MODELO_ORIGEM", "CO_USUARIO_ATUALIZACAO")
  values (p_edital, 1, v_modelo."CO_MODELO", v_uid)
  returning "CO_REGRA_ANALISE" into v_regra;
  insert into public."TH_REGRA_ANALISE" ("CO_REGRA_ANALISE", "NU_VERSAO", "DS_CONFIGURACAO", "DS_HASH", "DS_MOTIVO", "CO_USUARIO")
  values (v_regra, 1, v_config, encode(sha256(convert_to(v_config::text, 'UTF8')), 'hex'),
          'Copiada do modelo ' || v_modelo."CO_MODELO", v_uid);

  return json_build_object('regra', private."FC_REGRA_ANALISE_JSON"(p_edital), 'fichas_afetadas', '[]'::json);
end;
$function$;
comment on function public.copiar_modelo_regra_analise(uuid, text) is
  'Cria a versão 1 da regra do edital copiando um modelo (situação Conferir; o rótulo do edital vem do número quando o modelo não traz). Edital que já tem regra: 23505 (carregue o modelo no formulário e salve uma versão). Só a coordenação do edital.';
revoke all on function public.copiar_modelo_regra_analise(uuid, text) from public, anon;
grant execute on function public.copiar_modelo_regra_analise(uuid, text) to authenticated, service_role;

create function public.conferir_regra_analise(p_edital uuid, p_versao integer)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_area text := private."FC_EXIGIR_COORD_AVALIACAO"(p_edital);
  v_regra public."TB_REGRA_ANALISE";
begin
  select * into v_regra from public."TB_REGRA_ANALISE" where "CO_MONITORAMENTO" = p_edital for update;
  if v_regra."CO_REGRA_ANALISE" is null then
    raise exception 'O edital ainda não tem regra.' using errcode = '22023';
  end if;
  if p_versao is distinct from v_regra."NU_VERSAO_VIGENTE" then
    raise exception 'A regra mudou (versão %); confira de novo.', v_regra."NU_VERSAO_VIGENTE" using errcode = '40001';
  end if;
  if v_regra."TP_SITUACAO" <> 'CONFERIDA' then
    update public."TB_REGRA_ANALISE"
       set "TP_SITUACAO" = 'CONFERIDA', "CO_USUARIO_CONFERENCIA" = (select auth.uid()), "DT_CONFERENCIA" = now(), "DT_ATUALIZACAO" = now()
     where "CO_REGRA_ANALISE" = v_regra."CO_REGRA_ANALISE";
  end if;
  return json_build_object('regra', private."FC_REGRA_ANALISE_JSON"(p_edital), 'fichas_afetadas', '[]'::json);
end;
$function$;
comment on function public.conferir_regra_analise(uuid, integer) is
  'Marca a versão vigente da regra como conferida (quem e quando). p_versao tem de ser a vigente (senão 40001). Salvar uma versão nova volta para Conferir. Só a coordenação do edital.';
revoke all on function public.conferir_regra_analise(uuid, integer) from public, anon;
grant execute on function public.conferir_regra_analise(uuid, integer) to authenticated, service_role;

create function public.obter_equipe_edital(p_edital uuid)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_area text := private."FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 1);
  v_coordena boolean := coalesce(private."FC_PAPEL_AVALIACAO"(p_edital) = 'COORDENADOR', false);
  v_numero text;
begin
  select private."FC_NUMERO_EDITAL"(m.edital) into v_numero from public."TB_MONITORAMENTO_INDIGENA" m where m.id = p_edital;
  return json_build_object(
    'papel', private."FC_PAPEL_AVALIACAO"(p_edital),
    'pode_coordenar', v_coordena,
    'gestores', coalesce((
      select json_agg(json_build_object('usuario', u.user_id, 'nome', coalesce(u.nome, u.email),
                                        'email', case when v_coordena then u.email end)
             order by coalesce(u.nome, u.email))
        from public."TB_PERFIL_USUARIO" u
       where u.ativo and u.user_id is not null and private."FC_GESTOR_DO_EDITAL"(u.id, p_edital)), '[]'::json),
    'equipe', coalesce((
      select json_agg(json_build_object(
               'id', r."CO_ANALISTA_EDITAL", 'usuario', r."CO_USUARIO", 'nome', coalesce(u.nome, u.email, 'Conta removida'),
               'email', case when v_coordena then u.email end, 'papel', r."TP_PAPEL", 'vaga', r."CO_VAGA",
               'limite', r."QT_LIMITE_FICHA", 'desde', r."DT_CRIACAO",
               'nivel', case when u.id is null then 0 else private."FC_NIVEL_AVALIACAO_DO_PERFIL"(u.id) end,
               'ativo_no_sistema', coalesce(u.ativo, false))
             order by r."TP_PAPEL", coalesce(u.nome, u.email), r."CO_VAGA" nulls first)
        from public."RL_ANALISTA_EDITAL" r
        left join public."TB_PERFIL_USUARIO" u on u.user_id = r."CO_USUARIO"
       where r."CO_MONITORAMENTO" = p_edital and r."ST_ATIVO" = 'S'), '[]'::json),
    -- Quem pode entrar na equipe: só para a coordenação.
    'pessoas', case when v_coordena then coalesce((
      select json_agg(json_build_object('usuario', u.user_id, 'nome', coalesce(u.nome, u.email), 'email', u.email,
                                        'nivel', private."FC_NIVEL_AVALIACAO_DO_PERFIL"(u.id),
                                        'gestor', private."FC_GESTOR_DO_EDITAL"(u.id, p_edital))
             order by coalesce(u.nome, u.email))
        from public."TB_PERFIL_USUARIO" u
       where u.ativo and u.user_id is not null
         and private."FC_NIVEL_AVALIACAO_DO_PERFIL"(u.id) >= 2
         and private."FC_PERFIL_VE_EDITAL"(u.id, p_edital)), '[]'::json) else '[]'::json end,
    'vagas', coalesce((
      select json_agg(x.vaga order by x.vaga)
        from (select s."CO_VAGA" as vaga from public."TB_SELECAO_VAGA" s
               where s."CO_MONITORAMENTO" = p_edital and s."CO_VAGA" ~ '^[0-9]{1,20}$'
              union
              select v."CO_VAGA" from public."TB_EMPREGARE_VAGA" v where v."CO_MONITORAMENTO" = p_edital
              union
              select a.codigo_vaga from public."TB_ANALISE_CURRICULAR" a
               where a."CO_AREA" = v_area and a.ativo and a.codigo_vaga ~ '^[0-9]{1,20}$'
                 and private."FC_NUMERO_EDITAL"(a.edital) = v_numero) x), '[]'::json)
  );
end;
$function$;
comment on function public.obter_equipe_edital(uuid) is
  'A equipe da avaliação documental do edital (json): gestores (coordenação automática), as linhas ativas de RL_ANALISTA_EDITAL com o nível de cada pessoa, as vagas do edital e, só para a coordenação, os e-mails e as pessoas que podem entrar (Editor ou mais em avaliacao_documental que veem o edital). Exige avaliacao_documental >= leitor, a área e o recorte da coordenação.';
revoke all on function public.obter_equipe_edital(uuid) from public, anon;
grant execute on function public.obter_equipe_edital(uuid) to authenticated, service_role;

create function public.salvar_equipe_edital(p_edital uuid, p_equipe jsonb, p_motivo text)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_area text := private."FC_EXIGIR_COORD_AVALIACAO"(p_edital);
  v_uid uuid := (select auth.uid());
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_item record;
  v_usuario uuid;
  v_papel text;
  v_vaga text;
  v_limite integer;
  v_perfil public."TB_PERFIL_USUARIO";
  v_nivel integer;
  v_nome text;
  v_chaves text[] := '{}';
  v_chave text;
  v_saem integer;
  v_novos jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(p_equipe) is distinct from 'array' or jsonb_array_length(p_equipe) > 300 then
    raise exception 'Envie a equipe como lista (até 300 linhas).' using errcode = '22023';
  end if;
  if v_motivo is not null and length(v_motivo) > 500 then
    raise exception 'Motivo com até 500 caracteres.' using errcode = '22023';
  end if;

  for v_item in select e.value, e.ordinality from jsonb_array_elements(p_equipe) with ordinality e loop
    if jsonb_typeof(v_item.value) <> 'object'
       or coalesce(v_item.value ->> 'usuario', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'Linha %: escolha a pessoa.', v_item.ordinality using errcode = '22023';
    end if;
    v_usuario := (v_item.value ->> 'usuario')::uuid;
    v_papel := upper(coalesce(v_item.value ->> 'papel', ''));
    if v_papel not in ('ANALISTA', 'REVISOR', 'COORDENADOR') then
      raise exception 'Linha %: papel ANALISTA, REVISOR ou COORDENADOR.', v_item.ordinality using errcode = '22023';
    end if;
    v_vaga := nullif(btrim(coalesce(v_item.value ->> 'vaga', '')), '');
    if v_vaga is not null and v_vaga !~ '^[0-9]{1,20}$' then
      raise exception 'Linha %: código da vaga só com dígitos.', v_item.ordinality using errcode = '22023';
    end if;
    if v_papel = 'COORDENADOR' and v_vaga is not null then
      raise exception 'Linha %: a coordenação é do edital todo, sem vaga.', v_item.ordinality using errcode = '22023';
    end if;
    if coalesce(jsonb_typeof(v_item.value -> 'limite'), 'null') <> 'null' then
      if not private."FC_JSON_NUMERO_OBRIGATORIO"(v_item.value -> 'limite', 1, 5000) or (v_item.value ->> 'limite')::numeric % 1 <> 0 then
        raise exception 'Linha %: limite de fichas de 1 a 5.000.', v_item.ordinality using errcode = '22023';
      end if;
      v_limite := (v_item.value ->> 'limite')::integer;
    else
      v_limite := null;
    end if;

    select * into v_perfil from public."TB_PERFIL_USUARIO" u where u.user_id = v_usuario;
    v_nome := coalesce(v_perfil.nome, v_perfil.email, 'a pessoa da linha ' || v_item.ordinality);
    if v_perfil.id is null or v_perfil.ativo is not true then
      raise exception '%: conta inexistente ou desativada.', v_nome using errcode = '22023';
    end if;
    v_nivel := private."FC_NIVEL_AVALIACAO_DO_PERFIL"(v_perfil.id);
    if v_papel in ('ANALISTA', 'REVISOR') and v_nivel < 2 then
      raise exception '% não tem Editor em Avaliação documental (tem %); peça em Configurações › Acessos.', v_nome,
        case v_nivel when 1 then 'Leitor' else 'Sem acesso' end using errcode = '42501';
    end if;
    if v_papel = 'COORDENADOR' and v_nivel < 3 then
      raise exception '% não tem Administrador em Avaliação documental (tem %); peça em Configurações › Acessos.', v_nome,
        case v_nivel when 2 then 'Editor' when 1 then 'Leitor' else 'Sem acesso' end using errcode = '42501';
    end if;
    if not private."FC_PERFIL_VE_EDITAL"(v_perfil.id, p_edital) then
      raise exception '% não vê este edital (área ou coordenação).', v_nome using errcode = '42501';
    end if;
    if v_papel = 'COORDENADOR' and private."FC_GESTOR_DO_EDITAL"(v_perfil.id, p_edital) then
      raise exception '% é gestor do edital e já coordena.', v_nome using errcode = '22023';
    end if;
    v_chave := v_usuario::text || '|' || v_papel || '|' || coalesce(v_vaga, '');
    if v_chave = any (v_chaves) then
      raise exception 'Linha %: repetida.', v_item.ordinality using errcode = '22023';
    end if;
    v_chaves := v_chaves || v_chave;
    v_novos := v_novos || jsonb_build_object('usuario', v_usuario, 'papel', v_papel, 'vaga', v_vaga, 'limite', v_limite);
  end loop;

  select count(*) into v_saem
    from public."RL_ANALISTA_EDITAL" r
   where r."CO_MONITORAMENTO" = p_edital and r."ST_ATIVO" = 'S'
     and not exists (select 1 from jsonb_to_recordset(v_novos) n(usuario uuid, papel text, vaga text, limite integer)
                      where n.usuario = r."CO_USUARIO" and n.papel = r."TP_PAPEL"
                        and coalesce(n.vaga, '') = coalesce(r."CO_VAGA", ''));
  if v_saem > 0 and (v_motivo is null or length(v_motivo) < 10) then
    raise exception 'Informe o motivo para tirar % pessoa(s) da equipe (10 a 500 caracteres).', v_saem using errcode = '22023';
  end if;

  -- Quem sai: desativa (a linha fica). As fichas em análise de quem sai são tratadas na fase F3.
  update public."RL_ANALISTA_EDITAL" r
     set "ST_ATIVO" = 'N', "DS_MOTIVO_ATUALIZACAO" = v_motivo, "CO_USUARIO_ATUALIZACAO" = v_uid, "DT_ATUALIZACAO" = now()
   where r."CO_MONITORAMENTO" = p_edital and r."ST_ATIVO" = 'S'
     and not exists (select 1 from jsonb_to_recordset(v_novos) n(usuario uuid, papel text, vaga text, limite integer)
                      where n.usuario = r."CO_USUARIO" and n.papel = r."TP_PAPEL"
                        and coalesce(n.vaga, '') = coalesce(r."CO_VAGA", ''));
  -- Quem fica: só o limite pode mudar.
  update public."RL_ANALISTA_EDITAL" r
     set "QT_LIMITE_FICHA" = n.limite, "DS_MOTIVO_ATUALIZACAO" = coalesce(v_motivo, r."DS_MOTIVO_ATUALIZACAO"),
         "CO_USUARIO_ATUALIZACAO" = v_uid, "DT_ATUALIZACAO" = now()
    from jsonb_to_recordset(v_novos) n(usuario uuid, papel text, vaga text, limite integer)
   where r."CO_MONITORAMENTO" = p_edital and r."ST_ATIVO" = 'S'
     and n.usuario = r."CO_USUARIO" and n.papel = r."TP_PAPEL" and coalesce(n.vaga, '') = coalesce(r."CO_VAGA", '')
     and r."QT_LIMITE_FICHA" is distinct from n.limite;
  -- Quem entra.
  insert into public."RL_ANALISTA_EDITAL"
    ("CO_MONITORAMENTO", "CO_USUARIO", "TP_PAPEL", "CO_VAGA", "QT_LIMITE_FICHA", "DS_MOTIVO_ATUALIZACAO", "CO_USUARIO_ATUALIZACAO")
  select p_edital, n.usuario, n.papel, n.vaga, n.limite, v_motivo, v_uid
    from jsonb_to_recordset(v_novos) n(usuario uuid, papel text, vaga text, limite integer)
   where not exists (select 1 from public."RL_ANALISTA_EDITAL" r
                      where r."CO_MONITORAMENTO" = p_edital and r."ST_ATIVO" = 'S'
                        and r."CO_USUARIO" = n.usuario and r."TP_PAPEL" = n.papel
                        and coalesce(r."CO_VAGA", '') = coalesce(n.vaga, ''));

  return public.obter_equipe_edital(p_edital);
end;
$function$;
comment on function public.salvar_equipe_edital(uuid, jsonb, text) is
  'Grava a equipe da avaliação documental do edital. p_equipe = a lista inteira [{usuario, papel, vaga, limite}]: quem não está mais é desativado (motivo obrigatório, 10 a 500), quem entra é incluído e quem fica pode mudar o limite. Analista e revisor precisam de Editor em avaliacao_documental; coordenador, de Administrador (a mensagem diz qual permissão falta, 42501); todos precisam ver o edital; o gestor do edital já coordena. Só a coordenação do edital.';
revoke all on function public.salvar_equipe_edital(uuid, jsonb, text) from public, anon;
grant execute on function public.salvar_equipe_edital(uuid, jsonb, text) to authenticated, service_role;

create function public.salvar_aldeias_dsei(p_unidade text, p_aldeias jsonb, p_fonte text)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_unidade text := btrim(coalesce(p_unidade, ''));
  v_fonte text := btrim(coalesce(p_fonte, ''));
  v_uid uuid := (select auth.uid());
  v_desativadas integer;
  v_incluidas integer;
  v_reativadas integer;
  v_novas jsonb;
begin
  if not private.is_master() then
    raise exception 'Só o administrador global carrega a lista de aldeias' using errcode = '42501';
  end if;
  if v_unidade = '' or length(v_unidade) > 60
     or not exists (select 1 from public."TD_UNIDADE" u where u.id_unidade::text = v_unidade) then
    raise exception 'DSEI não encontrado no catálogo de unidades' using errcode = '22023';
  end if;
  if length(v_fonte) not between 3 and 300 then
    raise exception 'Informe a fonte da lista (3 a 300 caracteres).' using errcode = '22023';
  end if;
  if jsonb_typeof(p_aldeias) is distinct from 'array' or jsonb_array_length(p_aldeias) not between 1 and 3000
     or exists (select 1 from jsonb_array_elements(p_aldeias) a
                 where jsonb_typeof(a) <> 'string' or btrim(a #>> '{}') = '' or length(btrim(a #>> '{}')) > 230) then
    raise exception 'Envie de 1 a 3.000 aldeias, uma por texto ("NOME" ou "NOME-(polo)", até 230 caracteres).' using errcode = '22023';
  end if;

  -- A lista enviada, sem repetição: "NOME-(polo)" separa o polo.
  select jsonb_agg(jsonb_build_object(
           'exibicao', y.exibicao,
           'nome', left(btrim(coalesce(substring(y.exibicao from '^(.*)-\([^()]{1,20}\)$'), y.exibicao)), 200),
           'polo', substring(y.exibicao from '-\(([^()]{1,20})\)$')))
    into v_novas
    from (select distinct regexp_replace(btrim(a #>> '{}'), '\s+', ' ', 'g') as exibicao
            from jsonb_array_elements(p_aldeias) a) y;

  update public."TD_ALDEIA_DSEI" a
     set "ST_ATIVO" = 'N', "CO_USUARIO_ATUALIZACAO" = v_uid, "DT_ATUALIZACAO" = now()
   where a."CO_UNIDADE" = v_unidade and a."ST_ATIVO" = 'S'
     and not exists (select 1 from jsonb_to_recordset(v_novas) n(exibicao text, nome text, polo text)
                      where n.exibicao = a."NO_EXIBICAO");
  get diagnostics v_desativadas = row_count;
  update public."TD_ALDEIA_DSEI" a
     set "ST_ATIVO" = 'S', "DS_FONTE" = v_fonte, "CO_USUARIO_ATUALIZACAO" = v_uid, "DT_ATUALIZACAO" = now()
    from jsonb_to_recordset(v_novas) n(exibicao text, nome text, polo text)
   where a."CO_UNIDADE" = v_unidade and a."NO_EXIBICAO" = n.exibicao
     and (a."ST_ATIVO" = 'N' or a."DS_FONTE" is distinct from v_fonte);
  get diagnostics v_reativadas = row_count;
  insert into public."TD_ALDEIA_DSEI" ("CO_UNIDADE", "NO_ALDEIA", "CO_POLO", "NO_EXIBICAO", "DS_FONTE", "CO_USUARIO_ATUALIZACAO")
  select v_unidade, n.nome, n.polo, n.exibicao, v_fonte, v_uid
    from jsonb_to_recordset(v_novas) n(exibicao text, nome text, polo text)
   where not exists (select 1 from public."TD_ALDEIA_DSEI" a where a."CO_UNIDADE" = v_unidade and a."NO_EXIBICAO" = n.exibicao);
  get diagnostics v_incluidas = row_count;

  return json_build_object(
    'unidade', v_unidade,
    'ativas', (select count(*) from public."TD_ALDEIA_DSEI" a where a."CO_UNIDADE" = v_unidade and a."ST_ATIVO" = 'S'),
    'incluidas', v_incluidas, 'atualizadas', v_reativadas, 'desativadas', v_desativadas);
end;
$function$;
comment on function public.salvar_aldeias_dsei(text, jsonb, text) is
  'Carrega a lista oficial de aldeias de um DSEI (TD_UNIDADE.id_unidade): a lista enviada passa a ser a vigente; as que saíram são desativadas, as que voltaram são reativadas. "NOME-(polo)" separa o polo. Só o administrador global.';
revoke all on function public.salvar_aldeias_dsei(text, jsonb, text) from public, anon;
grant execute on function public.salvar_aldeias_dsei(text, jsonb, text) to authenticated, service_role;

commit;
