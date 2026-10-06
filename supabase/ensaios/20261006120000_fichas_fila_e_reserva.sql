/*
  ENSAIO de 20261006120000_fichas_fila_e_reserva.sql — begin … rollback.

  PRÉ-REQUISITO: as migrations até 20261006110000 aplicadas (a pré-classificação
  da F2); o corpo para se faltar.

  Como rodar: cole o arquivo inteiro no SQL Editor do Supabase (papel postgres)
  e execute. Ele abre uma transação, aplica o corpo da migration (copiado sem
  mudança, sem o begin/commit dela) e:
    E1  confere a RLS, a falta de acesso direto e o job só pelo service_role;
    E2  cria, num edital real (de preferência o 93/2026), uma vaga sintética com
        6 inscritos (CPF fictício, para ver que não sai), 6 atores (admin,
        gestor, analistas Ana — edital todo — e Beto — só a vaga —, leitor e
        sem acesso) e uma versão conferida da regra (Pegar próximo);
    E3  faz o papel do job: grava o lote (4), lê a distribuição (sem nomes) e
        abre as fichas (rodar de novo não duplica; atribuição indevida e
        execução fechada recusadas);
    E4  percorre a tela como cada pessoa (papel authenticated): leitura sem CPF,
        "Pegar próximo" com duas pessoas (nunca a mesma ficha), "Em uso por …"
        só para leitura, renovar e liberar, distribuir, versão velha (40001),
        redistribuir sem motivo, liberar reserva presa, mandar para revisão,
        devolver à fila e os filtros salvos por pessoa;
    E5  depois de "reset role": analista com ficha não sai da equipe (AM-3.3),
        refazer o lote não tira quem tem ficha, "a linha anda" (FORA_LOTE com o
        motivo e ficha nova atribuída pelo job), histórico, acessos e nada se
        apaga;
    E6  distribuição inicial: ficha livre não se pega, as suas sim.
  Termina em ROLLBACK: nada fica gravado.

  Resultado esperado: os "ok E1" … "ok E6" e a linha "ENSAIO OK". Qualquer
  "FALHOU …" interrompe e desfaz tudo; copie a mensagem.

  Mantenha em sincronia: tests/fichas-fila-reserva-migration.test.js confere
  que o corpo da migration aqui é idêntico ao do arquivo da migration.
*/
begin;

-- ═══ CORPO DA MIGRATION (início) ═══

-- 0. Pré-requisitos ---------------------------------------------------------------------
do $$
begin
  if to_regclass('public."TB_PRE_CLASSIFICACAO"') is null
     or to_regprocedure('private."FC_EXIGIR_EXECUCAO_PRECLASSIF"(text)') is null then
    raise exception 'Aplique antes 20261006110000_pre_classificacao_e_lote.sql.';
  end if;
end;
$$;

-- 1. A ficha ------------------------------------------------------------------------------
create table public."TB_FICHA_ANALISE" (
  "CO_FICHA_ANALISE" uuid not null default gen_random_uuid(),
  "CO_MONITORAMENTO" uuid not null,
  "CO_EMPREGARE_CANDIDATO" uuid not null,
  "CO_VAGA" varchar(20) not null,
  "CO_REGRA_ANALISE" uuid not null,
  "NU_VERSAO_REGRA" integer not null,
  "NU_LOTE" smallint not null,
  "TP_SITUACAO" varchar(12) not null default 'PENDENTE',
  "CO_USUARIO_RESPONSAVEL" uuid,
  "DT_ATRIBUICAO" timestamptz,
  "CO_USUARIO_RESERVA" uuid,
  "DT_RESERVA" timestamptz,
  "DT_RESERVA_EXPIRA" timestamptz,
  "DS_MOTIVO_SAIDA" varchar(300),
  "NU_VERSAO" integer not null default 1,
  "DT_CRIACAO" timestamptz not null default now(),
  "DT_ATUALIZACAO" timestamptz not null default now(),
  constraint "PK_TB_FICHA_ANALISE" primary key ("CO_FICHA_ANALISE"),
  constraint "UK_FICHAANALISE_CANDIDATO" unique ("CO_MONITORAMENTO", "CO_EMPREGARE_CANDIDATO"),
  constraint "FK_MONITORAMENTO_FICHAANALISE" foreign key ("CO_MONITORAMENTO") references public."TB_MONITORAMENTO_INDIGENA" (id),
  constraint "FK_PRECLASSIF_FICHAANALISE" foreign key ("CO_MONITORAMENTO", "CO_EMPREGARE_CANDIDATO")
    references public."TB_PRE_CLASSIFICACAO" ("CO_MONITORAMENTO", "CO_EMPREGARE_CANDIDATO"),
  constraint "FK_THREGRAANAL_FICHAANALISE" foreign key ("CO_REGRA_ANALISE", "NU_VERSAO_REGRA")
    references public."TH_REGRA_ANALISE" ("CO_REGRA_ANALISE", "NU_VERSAO"),
  constraint "FK_USUARIORESP_FICHAANALISE" foreign key ("CO_USUARIO_RESPONSAVEL") references auth.users (id),
  constraint "FK_USUARIORESERVA_FICHAANALISE" foreign key ("CO_USUARIO_RESERVA") references auth.users (id),
  constraint "CK_FICHAANALISE_TPSITUACAO" check ("TP_SITUACAO" in ('PENDENTE', 'EM_ANALISE', 'REVISAR', 'CONCLUIDA', 'FORA_LOTE')),
  constraint "CK_FICHAANALISE_RESERVA" check (
    ("CO_USUARIO_RESERVA" is null) = ("DT_RESERVA" is null)
    and ("DT_RESERVA" is null) = ("DT_RESERVA_EXPIRA" is null)
    and ("CO_USUARIO_RESERVA" is null or ("TP_SITUACAO" in ('EM_ANALISE', 'REVISAR') and "DT_RESERVA_EXPIRA" > "DT_RESERVA"))),
  constraint "CK_FICHAANALISE_FLUXO" check (
    ("TP_SITUACAO" <> 'EM_ANALISE' or "CO_USUARIO_RESPONSAVEL" is not null)
    and ("CO_USUARIO_RESPONSAVEL" is null) = ("DT_ATRIBUICAO" is null)
    and ("TP_SITUACAO" = 'FORA_LOTE') = ("DS_MOTIVO_SAIDA" is not null)),
  constraint "CK_FICHAANALISE_NUMEROS" check ("NU_VERSAO" >= 1 and "NU_VERSAO_REGRA" >= 1 and "NU_LOTE" between 1 and 999)
);
create index "IN_FICHAANALISE_FILA" on public."TB_FICHA_ANALISE" ("CO_MONITORAMENTO", "TP_SITUACAO", "CO_VAGA");
create index "IN_FICHAANALISE_RESPONSAVEL" on public."TB_FICHA_ANALISE" ("CO_USUARIO_RESPONSAVEL", "TP_SITUACAO");
create index "IN_FKFICHAANALISE_REGRA" on public."TB_FICHA_ANALISE" ("CO_REGRA_ANALISE", "NU_VERSAO_REGRA");
create index "IN_FKFICHAANALISE_RESERVA" on public."TB_FICHA_ANALISE" ("CO_USUARIO_RESERVA");
comment on table public."TB_FICHA_ANALISE" is
  'Ficha da avaliação documental de um inscrito do lote de convocação: situação, responsável, reserva de 15 minutos (quem está com a ficha aberta) e versão para o controle otimista. Criada pelo banco (FC_ABRIR_FICHAS) para quem está no lote; quem sai eliminado mantém a ficha como FORA_LOTE. O conteúdo da análise entra na fase F4. Nada se apaga.';
comment on column public."TB_FICHA_ANALISE"."CO_FICHA_ANALISE" is 'Identificador da ficha.';
comment on column public."TB_FICHA_ANALISE"."CO_MONITORAMENTO" is 'Edital (TB_MONITORAMENTO_INDIGENA.id).';
comment on column public."TB_FICHA_ANALISE"."CO_EMPREGARE_CANDIDATO" is 'Inscrito (TB_EMPREGARE_CANDIDATO; a linha da pré-classificação do edital).';
comment on column public."TB_FICHA_ANALISE"."CO_VAGA" is 'Código da vaga da Empregare.';
comment on column public."TB_FICHA_ANALISE"."CO_REGRA_ANALISE" is 'Regra da avaliação do edital (TB_REGRA_ANALISE).';
comment on column public."TB_FICHA_ANALISE"."NU_VERSAO_REGRA" is 'Versão (conferida) da regra com que o inscrito entrou no lote; a ficha é analisada por ela.';
comment on column public."TB_FICHA_ANALISE"."NU_LOTE" is 'Lote em que o inscrito entrou (1 = inicial; 2, 3… = reposições).';
comment on column public."TB_FICHA_ANALISE"."TP_SITUACAO" is 'PENDENTE (na fila, com ou sem responsável), EM_ANALISE (o responsável abriu), REVISAR (mandada para revisão), CONCLUIDA (fase F4) ou FORA_LOTE (saiu do lote, eliminado; a ficha fica com o motivo).';
comment on column public."TB_FICHA_ANALISE"."CO_USUARIO_RESPONSAVEL" is 'Analista responsável (auth.users.id): quem pegou ou para quem a coordenação distribuiu. Nulo = livre na fila.';
comment on column public."TB_FICHA_ANALISE"."DT_ATRIBUICAO" is 'Quando a ficha foi para o responsável atual.';
comment on column public."TB_FICHA_ANALISE"."CO_USUARIO_RESERVA" is 'Quem está com a ficha aberta (reserva); só essa pessoa grava. Vale até DT_RESERVA_EXPIRA.';
comment on column public."TB_FICHA_ANALISE"."DT_RESERVA" is 'Início da reserva ("Em uso por … desde HH:MM").';
comment on column public."TB_FICHA_ANALISE"."DT_RESERVA_EXPIRA" is 'Fim da reserva (15 minutos, renovada enquanto a pessoa trabalha). Vencida = livre.';
comment on column public."TB_FICHA_ANALISE"."DS_MOTIVO_SAIDA" is 'Por que saiu do lote (o motivo da eliminação automática); só em FORA_LOTE.';
comment on column public."TB_FICHA_ANALISE"."NU_VERSAO" is 'Versão da ficha (controle otimista): sobe a cada mudança de situação, responsável ou reserva; quem age com versão velha recebe 40001.';
comment on column public."TB_FICHA_ANALISE"."DT_CRIACAO" is 'Quando a ficha foi aberta.';
comment on column public."TB_FICHA_ANALISE"."DT_ATUALIZACAO" is 'Última mudança.';
comment on constraint "PK_TB_FICHA_ANALISE" on public."TB_FICHA_ANALISE" is 'Identificador da ficha.';
comment on constraint "UK_FICHAANALISE_CANDIDATO" on public."TB_FICHA_ANALISE" is 'Uma ficha por inscrito no edital.';
comment on constraint "FK_MONITORAMENTO_FICHAANALISE" on public."TB_FICHA_ANALISE" is 'Edital.';
comment on constraint "FK_PRECLASSIF_FICHAANALISE" on public."TB_FICHA_ANALISE" is 'Só quem está na pré-classificação do edital tem ficha.';
comment on constraint "FK_THREGRAANAL_FICHAANALISE" on public."TB_FICHA_ANALISE" is 'Versão da regra usada.';
comment on constraint "FK_USUARIORESP_FICHAANALISE" on public."TB_FICHA_ANALISE" is 'Responsável.';
comment on constraint "FK_USUARIORESERVA_FICHAANALISE" on public."TB_FICHA_ANALISE" is 'Quem está com a reserva.';
comment on constraint "CK_FICHAANALISE_TPSITUACAO" on public."TB_FICHA_ANALISE" is 'Situações válidas.';
comment on constraint "CK_FICHAANALISE_RESERVA" on public."TB_FICHA_ANALISE" is 'Reserva tem quem, início e fim (fim depois do início), só em análise ou revisão.';
comment on constraint "CK_FICHAANALISE_FLUXO" on public."TB_FICHA_ANALISE" is 'Em análise tem responsável; responsável tem data de atribuição; motivo de saída só (e sempre) fora do lote.';
comment on constraint "CK_FICHAANALISE_NUMEROS" on public."TB_FICHA_ANALISE" is 'Versões a partir de 1; lote de 1 a 999.';
comment on index public."IN_FICHAANALISE_FILA" is 'Fila do edital por situação e vaga.';
comment on index public."IN_FICHAANALISE_RESPONSAVEL" is 'Fichas de uma pessoa (Minhas fichas, pendentes por analista).';
comment on index public."IN_FKFICHAANALISE_REGRA" is 'Chave estrangeira para TH_REGRA_ANALISE.';
comment on index public."IN_FKFICHAANALISE_RESERVA" is 'Chave estrangeira para auth.users (reserva).';

-- 2. Histórico das transições ------------------------------------------------------------------
create table public."TH_FICHA_ANALISE" (
  "CO_HISTORICO_FICHA" bigint generated always as identity,
  "CO_FICHA_ANALISE" uuid not null,
  "NU_VERSAO" integer not null,
  "TP_ACAO" varchar(16) not null,
  "TP_SITUACAO_ANTERIOR" varchar(12),
  "TP_SITUACAO" varchar(12) not null,
  "CO_USUARIO_RESP_ANTERIOR" uuid,
  "CO_USUARIO_RESPONSAVEL" uuid,
  "DS_MOTIVO" varchar(2000),
  "TP_ORIGEM" varchar(6) not null,
  "CO_USUARIO" uuid,
  "DT_REGISTRO" timestamptz not null default now(),
  constraint "PK_TH_FICHA_ANALISE" primary key ("CO_HISTORICO_FICHA"),
  constraint "FK_FICHAANALISE_THFICHA" foreign key ("CO_FICHA_ANALISE") references public."TB_FICHA_ANALISE" ("CO_FICHA_ANALISE"),
  constraint "CK_THFICHA_TPACAO" check ("TP_ACAO" in ('CRIAR', 'PEGAR', 'RESERVAR', 'LIBERAR', 'LIBERAR_RESERVA', 'DISTRIBUIR',
    'REDISTRIBUIR', 'DEVOLVER_FILA', 'REVISAR', 'SAIR_LOTE', 'VOLTAR_LOTE')),
  constraint "CK_THFICHA_SITUACOES" check (
    "TP_SITUACAO" in ('PENDENTE', 'EM_ANALISE', 'REVISAR', 'CONCLUIDA', 'FORA_LOTE')
    and ("TP_SITUACAO_ANTERIOR" is null or "TP_SITUACAO_ANTERIOR" in ('PENDENTE', 'EM_ANALISE', 'REVISAR', 'CONCLUIDA', 'FORA_LOTE'))),
  constraint "CK_THFICHA_MOTIVO" check (
    "TP_ACAO" not in ('REDISTRIBUIR', 'DEVOLVER_FILA', 'LIBERAR_RESERVA', 'REVISAR')
    or length(btrim(coalesce("DS_MOTIVO", ''))) between 10 and 2000),
  constraint "CK_THFICHA_ORIGEM" check ("TP_ORIGEM" in ('TELA', 'JOB') and (("TP_ORIGEM" = 'JOB') = ("CO_USUARIO" is null)))
);
create index "IN_THFICHA_FICHA" on public."TH_FICHA_ANALISE" ("CO_FICHA_ANALISE", "DT_REGISTRO");
comment on table public."TH_FICHA_ANALISE" is
  'Histórico imutável das transições da ficha: criação, pegar, reservar e liberar, distribuição e redistribuição (com motivo), devolução à fila, envio à revisão e saída ou volta ao lote. O retrato do conteúdo da análise entra na fase F4.';
comment on column public."TH_FICHA_ANALISE"."CO_HISTORICO_FICHA" is 'Identificador do registro.';
comment on column public."TH_FICHA_ANALISE"."CO_FICHA_ANALISE" is 'Ficha.';
comment on column public."TH_FICHA_ANALISE"."NU_VERSAO" is 'Versão da ficha depois da ação.';
comment on column public."TH_FICHA_ANALISE"."TP_ACAO" is 'CRIAR, PEGAR (Pegar próximo), RESERVAR (abriu), LIBERAR (fechou), LIBERAR_RESERVA (a coordenação liberou a reserva de outra pessoa), DISTRIBUIR, REDISTRIBUIR, DEVOLVER_FILA, REVISAR, SAIR_LOTE ou VOLTAR_LOTE.';
comment on column public."TH_FICHA_ANALISE"."TP_SITUACAO_ANTERIOR" is 'Situação antes (nula na criação).';
comment on column public."TH_FICHA_ANALISE"."TP_SITUACAO" is 'Situação depois.';
comment on column public."TH_FICHA_ANALISE"."CO_USUARIO_RESP_ANTERIOR" is 'Responsável antes (auth.users.id).';
comment on column public."TH_FICHA_ANALISE"."CO_USUARIO_RESPONSAVEL" is 'Responsável depois (auth.users.id).';
comment on column public."TH_FICHA_ANALISE"."DS_MOTIVO" is 'Motivo (obrigatório, 10 a 2.000, em redistribuir, devolver à fila, liberar a reserva de outra pessoa e mandar para revisão; nas saídas e entradas do lote, o motivo da pré-classificação).';
comment on column public."TH_FICHA_ANALISE"."TP_ORIGEM" is 'TELA (uma pessoa) ou JOB (o job da pré-classificação).';
comment on column public."TH_FICHA_ANALISE"."CO_USUARIO" is 'Quem agiu (auth.users.id); nulo quando foi o job.';
comment on column public."TH_FICHA_ANALISE"."DT_REGISTRO" is 'Quando.';
comment on constraint "PK_TH_FICHA_ANALISE" on public."TH_FICHA_ANALISE" is 'Identificador do registro.';
comment on constraint "FK_FICHAANALISE_THFICHA" on public."TH_FICHA_ANALISE" is 'Ficha.';
comment on constraint "CK_THFICHA_TPACAO" on public."TH_FICHA_ANALISE" is 'Ações válidas.';
comment on constraint "CK_THFICHA_SITUACOES" on public."TH_FICHA_ANALISE" is 'Situações válidas.';
comment on constraint "CK_THFICHA_MOTIVO" on public."TH_FICHA_ANALISE" is 'Motivo de 10 a 2.000 caracteres nas ações que mexem no trabalho de outra pessoa.';
comment on constraint "CK_THFICHA_ORIGEM" on public."TH_FICHA_ANALISE" is 'Origem TELA tem quem agiu; JOB, não.';
comment on index public."IN_THFICHA_FICHA" is 'Histórico de uma ficha na ordem.';

-- 3. Acessos (LGPD) ------------------------------------------------------------------------------
create table public."TL_ACESSO_FICHA_ANALISE" (
  "CO_ACESSO_FICHA" bigint generated always as identity,
  "CO_FICHA_ANALISE" uuid not null,
  "TP_ACESSO" varchar(16) not null,
  "DS_ALVO" varchar(120),
  "CO_USUARIO" uuid not null,
  "DT_ACESSO" timestamptz not null default now(),
  constraint "PK_TL_ACESSO_FICHA_ANALISE" primary key ("CO_ACESSO_FICHA"),
  constraint "FK_FICHAANALISE_ACESSOFICHA" foreign key ("CO_FICHA_ANALISE") references public."TB_FICHA_ANALISE" ("CO_FICHA_ANALISE"),
  constraint "CK_ACESSOFICHA_TPACESSO" check ("TP_ACESSO" in
    ('ABRIR_FICHA', 'REVELAR_CPF', 'REVELAR_PARENTE', 'ABRIR_EMPREGARE', 'ABRIR_ANEXO', 'IMPRIMIR', 'COPIAR_CODIGO'))
);
create index "IN_ACESSOFICHA_FICHA" on public."TL_ACESSO_FICHA_ANALISE" ("CO_FICHA_ANALISE", "DT_ACESSO");
comment on table public."TL_ACESSO_FICHA_ANALISE" is 'Acessos à ficha e a dado pessoal (LGPD): quem abriu, quando e o quê. Imutável; nunca guarda CPF nem conteúdo de documento. Na fase F3, só ABRIR_FICHA.';
comment on column public."TL_ACESSO_FICHA_ANALISE"."CO_ACESSO_FICHA" is 'Identificador do acesso.';
comment on column public."TL_ACESSO_FICHA_ANALISE"."CO_FICHA_ANALISE" is 'Ficha.';
comment on column public."TL_ACESSO_FICHA_ANALISE"."TP_ACESSO" is 'ABRIR_FICHA, REVELAR_CPF, REVELAR_PARENTE, ABRIR_EMPREGARE, ABRIR_ANEXO, IMPRIMIR ou COPIAR_CODIGO (os demais chegam com a ficha completa).';
comment on column public."TL_ACESSO_FICHA_ANALISE"."DS_ALVO" is 'O que foi acessado (bloco ou documento), sem dado pessoal.';
comment on column public."TL_ACESSO_FICHA_ANALISE"."CO_USUARIO" is 'Quem acessou (auth.users.id).';
comment on column public."TL_ACESSO_FICHA_ANALISE"."DT_ACESSO" is 'Quando.';
comment on constraint "PK_TL_ACESSO_FICHA_ANALISE" on public."TL_ACESSO_FICHA_ANALISE" is 'Identificador do acesso.';
comment on constraint "FK_FICHAANALISE_ACESSOFICHA" on public."TL_ACESSO_FICHA_ANALISE" is 'Ficha.';
comment on constraint "CK_ACESSOFICHA_TPACESSO" on public."TL_ACESSO_FICHA_ANALISE" is 'Tipos de acesso válidos.';
comment on index public."IN_ACESSOFICHA_FICHA" is 'Acessos de uma ficha na ordem.';

-- 4. Filtros salvos da fila ------------------------------------------------------------------------
create table public."TB_FILTRO_FILA_ANALISE" (
  "CO_FILTRO_FILA" uuid not null default gen_random_uuid(),
  "CO_USUARIO" uuid not null,
  "NO_FILTRO" varchar(60) not null,
  "DS_FILTRO" jsonb not null,
  "ST_ATIVO" varchar(1) not null default 'S',
  "DT_CRIACAO" timestamptz not null default now(),
  "DT_ATUALIZACAO" timestamptz not null default now(),
  constraint "PK_TB_FILTRO_FILA_ANALISE" primary key ("CO_FILTRO_FILA"),
  constraint "FK_USUARIO_FILTROFILA" foreign key ("CO_USUARIO") references auth.users (id),
  constraint "CK_FILTROFILA_NOME" check (length(btrim("NO_FILTRO")) between 1 and 60),
  constraint "CK_FILTROFILA_FILTRO" check (jsonb_typeof("DS_FILTRO") = 'object' and length("DS_FILTRO"::text) <= 2000),
  constraint "CK_FILTROFILA_STATIVO" check ("ST_ATIVO" in ('S', 'N'))
);
create unique index "UK_FILTROFILA_NOME" on public."TB_FILTRO_FILA_ANALISE" ("CO_USUARIO", lower(btrim("NO_FILTRO"))) where "ST_ATIVO" = 'S';
comment on table public."TB_FILTRO_FILA_ANALISE" is 'Filtros salvos da fila da Avaliação documental, por pessoa: uma combinação de etapa, vaga, responsável, modalidade e busca com um nome. Excluir desativa (nada se apaga).';
comment on column public."TB_FILTRO_FILA_ANALISE"."CO_FILTRO_FILA" is 'Identificador do filtro.';
comment on column public."TB_FILTRO_FILA_ANALISE"."CO_USUARIO" is 'Dono do filtro (auth.users.id); só ele vê.';
comment on column public."TB_FILTRO_FILA_ANALISE"."NO_FILTRO" is 'Nome dado pela pessoa (1 a 60 caracteres).';
comment on column public."TB_FILTRO_FILA_ANALISE"."DS_FILTRO" is 'A combinação (objeto json no formato de src/lib/avaliacao-documental/fila.js: etapa, vaga, responsavel, modalidade, busca).';
comment on column public."TB_FILTRO_FILA_ANALISE"."ST_ATIVO" is 'S: aparece na lista; N: excluído.';
comment on column public."TB_FILTRO_FILA_ANALISE"."DT_CRIACAO" is 'Quando foi salvo pela primeira vez.';
comment on column public."TB_FILTRO_FILA_ANALISE"."DT_ATUALIZACAO" is 'Última gravação.';
comment on constraint "PK_TB_FILTRO_FILA_ANALISE" on public."TB_FILTRO_FILA_ANALISE" is 'Identificador do filtro.';
comment on constraint "FK_USUARIO_FILTROFILA" on public."TB_FILTRO_FILA_ANALISE" is 'Dono do filtro.';
comment on constraint "CK_FILTROFILA_NOME" on public."TB_FILTRO_FILA_ANALISE" is 'Nome de 1 a 60 caracteres.';
comment on constraint "CK_FILTROFILA_FILTRO" on public."TB_FILTRO_FILA_ANALISE" is 'Filtro é um objeto json de até 2.000 caracteres.';
comment on constraint "CK_FILTROFILA_STATIVO" on public."TB_FILTRO_FILA_ANALISE" is 'Flag S/N.';
comment on index public."UK_FILTROFILA_NOME" is 'Um nome por pessoa entre os filtros ativos (sem diferenciar maiúsculas).';

-- 5. Nada se apaga; histórico e acessos não mudam ------------------------------------------------
create function private."FC_TG_FICHA_IMUTAVEL"()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if tg_op = 'DELETE' then
    raise exception 'Registro da avaliação documental não se apaga (%)', tg_table_name using errcode = '42501';
  end if;
  raise exception 'Histórico não muda (%)', tg_table_name using errcode = '42501';
end;
$function$;
comment on function private."FC_TG_FICHA_IMUTAVEL"() is 'Gatilho: barra o apagamento das fichas e dos filtros e qualquer mudança no histórico e no log de acessos da ficha (42501).';
revoke all on function private."FC_TG_FICHA_IMUTAVEL"() from public, anon, authenticated;

create trigger "TG_FICHAANALISE_SEMAPAGAR" before delete on public."TB_FICHA_ANALISE"
  for each row execute function private."FC_TG_FICHA_IMUTAVEL"();
create trigger "TG_FILTROFILA_SEMAPAGAR" before delete on public."TB_FILTRO_FILA_ANALISE"
  for each row execute function private."FC_TG_FICHA_IMUTAVEL"();
create trigger "TG_THFICHA_IMUTAVEL" before update or delete on public."TH_FICHA_ANALISE"
  for each row execute function private."FC_TG_FICHA_IMUTAVEL"();
create trigger "TG_ACESSOFICHA_IMUTAVEL" before update or delete on public."TL_ACESSO_FICHA_ANALISE"
  for each row execute function private."FC_TG_FICHA_IMUTAVEL"();
comment on trigger "TG_FICHAANALISE_SEMAPAGAR" on public."TB_FICHA_ANALISE" is 'Sem hard delete (FC_TG_FICHA_IMUTAVEL).';
comment on trigger "TG_FILTROFILA_SEMAPAGAR" on public."TB_FILTRO_FILA_ANALISE" is 'Excluir um filtro o desativa (FC_TG_FICHA_IMUTAVEL).';
comment on trigger "TG_THFICHA_IMUTAVEL" on public."TH_FICHA_ANALISE" is 'Histórico imutável (FC_TG_FICHA_IMUTAVEL).';
comment on trigger "TG_ACESSOFICHA_IMUTAVEL" on public."TL_ACESSO_FICHA_ANALISE" is 'Log de acessos imutável (FC_TG_FICHA_IMUTAVEL).';

alter table public."TB_FICHA_ANALISE" enable row level security;
alter table public."TH_FICHA_ANALISE" enable row level security;
alter table public."TL_ACESSO_FICHA_ANALISE" enable row level security;
alter table public."TB_FILTRO_FILA_ANALISE" enable row level security;
revoke all on public."TB_FICHA_ANALISE", public."TH_FICHA_ANALISE", public."TL_ACESSO_FICHA_ANALISE",
  public."TB_FILTRO_FILA_ANALISE" from public, anon, authenticated;

-- 6. Funções de apoio -------------------------------------------------------------------------------
create function private."FC_PRAZO_RESERVA_FICHA"()
returns interval
language sql
immutable
set search_path to ''
as $function$
  select interval '15 minutes';
$function$;
comment on function private."FC_PRAZO_RESERVA_FICHA"() is 'Duração da reserva da ficha (15 minutos), renovada enquanto a pessoa trabalha.';
revoke all on function private."FC_PRAZO_RESERVA_FICHA"() from public, anon, authenticated;

create function private."FC_PODE_ANALISAR_VAGA"(p_edital uuid, p_usuario uuid, p_vaga text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1
      from public."RL_ANALISTA_EDITAL" r
      join public."TB_PERFIL_USUARIO" u on u.user_id = r."CO_USUARIO"
     where r."CO_MONITORAMENTO" = p_edital and r."CO_USUARIO" = p_usuario
       and r."TP_PAPEL" = 'ANALISTA' and r."ST_ATIVO" = 'S'
       and (p_vaga is null or r."CO_VAGA" is null or r."CO_VAGA" = p_vaga)
       and u.ativo
       and private."FC_NIVEL_AVALIACAO_DO_PERFIL"(u.id) >= 2
       and private."FC_PERFIL_VE_EDITAL"(u.id, p_edital));
$function$;
comment on function private."FC_PODE_ANALISAR_VAGA"(uuid, uuid, text) is
  'A pessoa (auth.users.id) analisa a vaga no edital: linha ANALISTA ativa na equipe (na vaga ou no edital todo), conta ativa, Editor em avaliacao_documental e vê o edital. p_vaga nula = qualquer vaga.';
revoke all on function private."FC_PODE_ANALISAR_VAGA"(uuid, uuid, text) from public, anon, authenticated;

create function private."FC_DISTRIBUICAO_DO_EDITAL"(p_edital uuid)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  select jsonb_build_object(
           'modo', coalesce(d ->> 'modo', 'PEGAR_PROXIMO'),
           'criterio', coalesce(d ->> 'criterio', 'PARTES_IGUAIS'),
           'limite_por_analista', case when jsonb_typeof(d -> 'limite_por_analista') = 'number' then d -> 'limite_por_analista' end,
           'novos', coalesce(d ->> 'novos', 'MENOS_PENDENTES'))
    from (select coalesce((select h."DS_CONFIGURACAO" -> 'distribuicao'
                             from public."TB_REGRA_ANALISE" r
                             join public."TH_REGRA_ANALISE" h
                               on h."CO_REGRA_ANALISE" = r."CO_REGRA_ANALISE" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
                            where r."CO_MONITORAMENTO" = p_edital), '{}'::jsonb) as d) x;
$function$;
comment on function private."FC_DISTRIBUICAO_DO_EDITAL"(uuid) is
  'O bloco de distribuição da regra vigente do edital com os padrões: modo (PEGAR_PROXIMO ou DISTRIBUICAO_INICIAL), critério (PARTES_IGUAIS ou LIMITE), limite por analista e destino dos que entram depois (MENOS_PENDENTES ou PEGAR_PROXIMO).';
revoke all on function private."FC_DISTRIBUICAO_DO_EDITAL"(uuid) from public, anon, authenticated;

create function private."FC_ANALISTAS_DO_EDITAL"(p_edital uuid, p_com_nome boolean)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce(jsonb_agg(x.obj order by x.usuario::text), '[]'::jsonb)
    from (
      select r."CO_USUARIO" as usuario,
             jsonb_build_object(
               'usuario', r."CO_USUARIO",
               'nome', case when p_com_nome then coalesce(min(u.nome), min(u.email)) end,
               'vagas', case when bool_or(r."CO_VAGA" is null) then null
                             else jsonb_agg(distinct r."CO_VAGA" order by r."CO_VAGA") end,
               'limite', min(r."QT_LIMITE_FICHA"),
               'pendentes', (select count(*) from public."TB_FICHA_ANALISE" f
                              where f."CO_MONITORAMENTO" = p_edital and f."CO_USUARIO_RESPONSAVEL" = r."CO_USUARIO"
                                and f."TP_SITUACAO" in ('PENDENTE', 'EM_ANALISE'))) as obj
        from public."RL_ANALISTA_EDITAL" r
        join public."TB_PERFIL_USUARIO" u on u.user_id = r."CO_USUARIO"
       where r."CO_MONITORAMENTO" = p_edital and r."TP_PAPEL" = 'ANALISTA' and r."ST_ATIVO" = 'S'
         and u.ativo
         and private."FC_NIVEL_AVALIACAO_DO_PERFIL"(u.id) >= 2
         and private."FC_PERFIL_VE_EDITAL"(u.id, p_edital)
       group by r."CO_USUARIO") x;
$function$;
comment on function private."FC_ANALISTAS_DO_EDITAL"(uuid, boolean) is
  'Os analistas que podem receber ficha no edital (FC_PODE_ANALISAR_VAGA), na ordem do id: vagas (nula = todas), limite da distribuição, quantas fichas pendentes ou em análise já têm e, com p_com_nome, o nome. Entrada da distribuição (src/lib/avaliacao-documental/distribuicao.js e o job Python).';
revoke all on function private."FC_ANALISTAS_DO_EDITAL"(uuid, boolean) from public, anon, authenticated;

create function private."FC_FICHA_ANALISE_JSON"(p_ficha uuid)
returns json
language sql
stable
security definer
set search_path to ''
as $function$
  select json_build_object(
           'id', f."CO_FICHA_ANALISE", 'versao', f."NU_VERSAO", 'edital', f."CO_MONITORAMENTO",
           'vaga', f."CO_VAGA", 'cargo', pv."NO_CARGO", 'lotacao', pv."NO_LOTACAO",
           'candidato', f."CO_EMPREGARE_CANDIDATO", 'codigo', c."CO_CANDIDATO_EMPREGARE", 'nome', c."NO_CANDIDATO",
           'posicao', p."NU_POSICAO", 'lote', f."NU_LOTE", 'art', p."VL_ART", 'nota', p."VL_NOTA_ORDEM",
           'modalidade', p."NO_MODALIDADE", 'situacao', f."TP_SITUACAO", 'motivo_saida', f."DS_MOTIVO_SAIDA",
           'versao_regra', f."NU_VERSAO_REGRA",
           'responsavel', f."CO_USUARIO_RESPONSAVEL", 'responsavel_nome', coalesce(ur.nome, ur.email),
           'atribuida_em', f."DT_ATRIBUICAO",
           'reserva', case when f."DT_RESERVA_EXPIRA" > now() then json_build_object(
                             'usuario', f."CO_USUARIO_RESERVA", 'nome', coalesce(uv.nome, uv.email),
                             'desde', f."DT_RESERVA", 'expira', f."DT_RESERVA_EXPIRA") end)
    from public."TB_FICHA_ANALISE" f
    join public."TB_PRE_CLASSIFICACAO" p
      on p."CO_MONITORAMENTO" = f."CO_MONITORAMENTO" and p."CO_EMPREGARE_CANDIDATO" = f."CO_EMPREGARE_CANDIDATO"
    join public."TB_EMPREGARE_CANDIDATO" c on c."CO_EMPREGARE_CANDIDATO" = f."CO_EMPREGARE_CANDIDATO"
    left join public."TB_PRE_CLASSIF_VAGA" pv on pv."CO_MONITORAMENTO" = f."CO_MONITORAMENTO" and pv."CO_VAGA" = f."CO_VAGA"
    left join public."TB_PERFIL_USUARIO" ur on ur.user_id = f."CO_USUARIO_RESPONSAVEL"
    left join public."TB_PERFIL_USUARIO" uv on uv.user_id = f."CO_USUARIO_RESERVA"
   where f."CO_FICHA_ANALISE" = p_ficha;
$function$;
comment on function private."FC_FICHA_ANALISE_JSON"(uuid) is
  'O cabeçalho da ficha (json): candidato pelo código e nome (sem CPF nem contato), vaga e cargo, posição, lote, ART, modalidade, situação, responsável, versão e a reserva vigente (quem, desde, até).';
revoke all on function private."FC_FICHA_ANALISE_JSON"(uuid) from public, anon, authenticated;

create function private."FC_HISTORICO_FICHA"(
  p_ficha uuid, p_acao text, p_situacao_anterior text, p_responsavel_anterior uuid, p_motivo text, p_usuario uuid)
returns void
language sql
security definer
set search_path to ''
as $function$
  insert into public."TH_FICHA_ANALISE"
    ("CO_FICHA_ANALISE", "NU_VERSAO", "TP_ACAO", "TP_SITUACAO_ANTERIOR", "TP_SITUACAO", "CO_USUARIO_RESP_ANTERIOR",
     "CO_USUARIO_RESPONSAVEL", "DS_MOTIVO", "TP_ORIGEM", "CO_USUARIO")
  select f."CO_FICHA_ANALISE", f."NU_VERSAO", p_acao, p_situacao_anterior, f."TP_SITUACAO", p_responsavel_anterior,
         f."CO_USUARIO_RESPONSAVEL", nullif(left(btrim(coalesce(p_motivo, '')), 2000), ''),
         case when p_usuario is null then 'JOB' else 'TELA' end, p_usuario
    from public."TB_FICHA_ANALISE" f
   where f."CO_FICHA_ANALISE" = p_ficha;
$function$;
comment on function private."FC_HISTORICO_FICHA"(uuid, text, text, uuid, text, uuid) is
  'Grava em TH_FICHA_ANALISE o estado atual da ficha depois de uma ação, com a situação e o responsável de antes, o motivo e quem agiu (nulo = o job).';
revoke all on function private."FC_HISTORICO_FICHA"(uuid, text, text, uuid, text, uuid) from public, anon, authenticated;

create function private."FC_RESERVAR_FICHA"(p_ficha uuid, p_usuario uuid, p_acao text)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_antes public."TB_FICHA_ANALISE";
begin
  select * into v_antes from public."TB_FICHA_ANALISE" where "CO_FICHA_ANALISE" = p_ficha for update;
  update public."TB_FICHA_ANALISE" set
    "CO_USUARIO_RESPONSAVEL" = coalesce("CO_USUARIO_RESPONSAVEL", p_usuario),
    "DT_ATRIBUICAO" = coalesce("DT_ATRIBUICAO", now()),
    "TP_SITUACAO" = case when "TP_SITUACAO" = 'PENDENTE' then 'EM_ANALISE' else "TP_SITUACAO" end,
    "CO_USUARIO_RESERVA" = p_usuario, "DT_RESERVA" = now(),
    "DT_RESERVA_EXPIRA" = now() + private."FC_PRAZO_RESERVA_FICHA"(),
    "NU_VERSAO" = "NU_VERSAO" + 1, "DT_ATUALIZACAO" = now()
   where "CO_FICHA_ANALISE" = p_ficha;
  perform private."FC_HISTORICO_FICHA"(p_ficha, p_acao, v_antes."TP_SITUACAO", v_antes."CO_USUARIO_RESPONSAVEL", null, p_usuario);
end;
$function$;
comment on function private."FC_RESERVAR_FICHA"(uuid, uuid, text) is
  'Reserva a ficha (já travada e conferida por quem chama) para a pessoa por 15 minutos: vira responsável se não houver, PENDENTE passa a EM_ANALISE, a versão sobe e o histórico registra PEGAR ou RESERVAR.';
revoke all on function private."FC_RESERVAR_FICHA"(uuid, uuid, text) from public, anon, authenticated;

create function private."FC_EXIGIR_COORD_FICHAS"(p_edital uuid)
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
    raise exception 'Só a coordenação do edital distribui as fichas, libera reservas de outras pessoas e manda para revisão' using errcode = '42501';
  end if;
  return v_area;
end;
$function$;
comment on function private."FC_EXIGIR_COORD_FICHAS"(uuid) is 'Barra (42501) quem não coordena a avaliação documental do edital nas ações da coordenação sobre as fichas. Devolve a área do edital.';
revoke all on function private."FC_EXIGIR_COORD_FICHAS"(uuid) from public, anon, authenticated;

create function private."FC_FILTROS_FILA_JSON"(p_usuario uuid)
returns json
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce(json_agg(json_build_object('id', f."CO_FILTRO_FILA", 'nome', f."NO_FILTRO", 'filtro', f."DS_FILTRO")
                           order by lower(f."NO_FILTRO")), '[]'::json)
    from public."TB_FILTRO_FILA_ANALISE" f
   where f."CO_USUARIO" = p_usuario and f."ST_ATIVO" = 'S';
$function$;
comment on function private."FC_FILTROS_FILA_JSON"(uuid) is 'Os filtros salvos ativos de uma pessoa (id, nome e a combinação), por nome.';
revoke all on function private."FC_FILTROS_FILA_JSON"(uuid) from public, anon, authenticated;

-- 7. Abrir as fichas do lote (o banco valida e grava) -------------------------------------------------
create function private."FC_ABRIR_FICHAS"(p_edital uuid, p_atribuicoes jsonb, p_usuario uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_regra public."TB_REGRA_ANALISE";
  v_atrib jsonb := coalesce(p_atribuicoes, '[]'::jsonb);
  v_item record;
  v_criados uuid[] := '{}';
  v_saem integer := 0;
  v_voltam integer := 0;
  v_atribuidas integer := 0;
  v_ficha public."TB_FICHA_ANALISE";
begin
  -- Uma abertura por edital de cada vez (job e tela não se atropelam).
  perform pg_advisory_xact_lock(hashtextextended('avaliacao-documental:fichas:' || p_edital::text, 0));
  select * into v_regra from public."TB_REGRA_ANALISE" where "CO_MONITORAMENTO" = p_edital;
  if v_regra."CO_REGRA_ANALISE" is null then
    raise exception 'O edital ainda não tem regra da avaliação' using errcode = '22023';
  end if;
  if jsonb_typeof(v_atrib) <> 'array' or jsonb_array_length(v_atrib) > 20000 then
    raise exception 'Atribuições inválidas (lista de até 20.000)' using errcode = '22023';
  end if;

  -- Saem do lote: eliminados (ou fora do recorte) com ficha aberta. A ficha fica, com o motivo.
  for v_item in
    select f."CO_FICHA_ANALISE" as ficha, f."TP_SITUACAO" as situacao, f."CO_USUARIO_RESPONSAVEL" as responsavel,
           left(coalesce(p."DS_MOTIVO_ELIMINACAO", 'Saiu do lote de convocação'), 300) as motivo
      from public."TB_FICHA_ANALISE" f
      join public."TB_PRE_CLASSIFICACAO" p
        on p."CO_MONITORAMENTO" = f."CO_MONITORAMENTO" and p."CO_EMPREGARE_CANDIDATO" = f."CO_EMPREGARE_CANDIDATO"
     where f."CO_MONITORAMENTO" = p_edital
       and f."TP_SITUACAO" in ('PENDENTE', 'EM_ANALISE', 'REVISAR')
       and p."TP_SITUACAO" in ('ELIMINADO', 'RANQUEADO')
     order by f."CO_FICHA_ANALISE"
     for update of f
  loop
    update public."TB_FICHA_ANALISE" set
      "TP_SITUACAO" = 'FORA_LOTE', "DS_MOTIVO_SAIDA" = v_item.motivo,
      "CO_USUARIO_RESERVA" = null, "DT_RESERVA" = null, "DT_RESERVA_EXPIRA" = null,
      "NU_VERSAO" = "NU_VERSAO" + 1, "DT_ATUALIZACAO" = now()
     where "CO_FICHA_ANALISE" = v_item.ficha;
    perform private."FC_HISTORICO_FICHA"(v_item.ficha, 'SAIR_LOTE', v_item.situacao, v_item.responsavel, v_item.motivo, p_usuario);
    v_saem := v_saem + 1;
  end loop;

  -- Voltam ao lote: quem saiu e está no lote de novo recomeça livre na fila.
  for v_item in
    select f."CO_FICHA_ANALISE" as ficha, f."CO_USUARIO_RESPONSAVEL" as responsavel,
           coalesce(p."DS_MOTIVO_ENTRADA", 'Voltou ao lote de convocação') as motivo
      from public."TB_FICHA_ANALISE" f
      join public."TB_PRE_CLASSIFICACAO" p
        on p."CO_MONITORAMENTO" = f."CO_MONITORAMENTO" and p."CO_EMPREGARE_CANDIDATO" = f."CO_EMPREGARE_CANDIDATO"
     where f."CO_MONITORAMENTO" = p_edital and f."TP_SITUACAO" = 'FORA_LOTE'
       and p."TP_SITUACAO" in ('NO_LOTE', 'ANALISADO')
     order by f."CO_FICHA_ANALISE"
     for update of f
  loop
    update public."TB_FICHA_ANALISE" set
      "TP_SITUACAO" = 'PENDENTE', "DS_MOTIVO_SAIDA" = null, "CO_USUARIO_RESPONSAVEL" = null, "DT_ATRIBUICAO" = null,
      "NU_VERSAO" = "NU_VERSAO" + 1, "DT_ATUALIZACAO" = now()
     where "CO_FICHA_ANALISE" = v_item.ficha;
    perform private."FC_HISTORICO_FICHA"(v_item.ficha, 'VOLTAR_LOTE', 'FORA_LOTE', v_item.responsavel, v_item.motivo, p_usuario);
    v_voltam := v_voltam + 1;
  end loop;

  -- Entram: quem está no lote e ainda não tem ficha (uma por inscrito; "a linha anda" cria ficha nova).
  for v_item in
    select p."CO_EMPREGARE_CANDIDATO" as candidato, p."CO_VAGA" as vaga, p."NU_VERSAO_REGRA" as versao, p."NU_LOTE" as lote,
           coalesce(p."DS_MOTIVO_ENTRADA", 'Entrou no lote ' || p."NU_LOTE") as motivo
      from public."TB_PRE_CLASSIFICACAO" p
     where p."CO_MONITORAMENTO" = p_edital and p."TP_SITUACAO" in ('NO_LOTE', 'ANALISADO')
       and not exists (select 1 from public."TB_FICHA_ANALISE" f
                        where f."CO_MONITORAMENTO" = p_edital and f."CO_EMPREGARE_CANDIDATO" = p."CO_EMPREGARE_CANDIDATO")
     order by p."NU_POSICAO", p."CO_VAGA", p."CO_EMPREGARE_CANDIDATO"
  loop
    insert into public."TB_FICHA_ANALISE"
      ("CO_MONITORAMENTO", "CO_EMPREGARE_CANDIDATO", "CO_VAGA", "CO_REGRA_ANALISE", "NU_VERSAO_REGRA", "NU_LOTE")
    values (p_edital, v_item.candidato, v_item.vaga, v_regra."CO_REGRA_ANALISE", v_item.versao, v_item.lote)
    returning * into v_ficha;
    perform private."FC_HISTORICO_FICHA"(v_ficha."CO_FICHA_ANALISE", 'CRIAR', null, null, v_item.motivo, p_usuario);
    v_criados := v_criados || v_item.candidato;
  end loop;

  -- As fichas novas que já vão para alguém (quem entra depois, para quem tem menos pendentes).
  begin
    for v_item in
      select (a ->> 'candidato')::uuid as candidato, (a ->> 'usuario')::uuid as usuario
        from jsonb_array_elements(v_atrib) a
    loop
      select * into v_ficha from public."TB_FICHA_ANALISE"
       where "CO_MONITORAMENTO" = p_edital and "CO_EMPREGARE_CANDIDATO" = v_item.candidato
       for update;
      if v_item.candidato is null or not (v_item.candidato = any (v_criados)) or v_ficha."CO_USUARIO_RESPONSAVEL" is not null then
        raise exception 'Atribuição recusada: só a ficha aberta agora, uma vez' using errcode = '22023';
      end if;
      if v_item.usuario is null or not private."FC_PODE_ANALISAR_VAGA"(p_edital, v_item.usuario, v_ficha."CO_VAGA") then
        raise exception 'Atribuição recusada: a pessoa não analisa a vaga %', v_ficha."CO_VAGA" using errcode = '22023';
      end if;
      update public."TB_FICHA_ANALISE" set
        "CO_USUARIO_RESPONSAVEL" = v_item.usuario, "DT_ATRIBUICAO" = now(),
        "NU_VERSAO" = "NU_VERSAO" + 1, "DT_ATUALIZACAO" = now()
       where "CO_FICHA_ANALISE" = v_ficha."CO_FICHA_ANALISE";
      perform private."FC_HISTORICO_FICHA"(v_ficha."CO_FICHA_ANALISE", 'DISTRIBUIR', 'PENDENTE', null,
                                           'Entrou depois: para quem tem menos pendentes', p_usuario);
      v_atribuidas := v_atribuidas + 1;
    end loop;
  exception when invalid_text_representation then
    raise exception 'Atribuição com id inválido' using errcode = '22023';
  end;

  return jsonb_build_object('criadas', cardinality(v_criados), 'atribuidas', v_atribuidas,
                            'fora_do_lote', v_saem, 'voltaram', v_voltam);
end;
$function$;
comment on function private."FC_ABRIR_FICHAS"(uuid, jsonb, uuid) is
  'Sincroniza as fichas do edital com a pré-classificação gravada: quem saiu do lote (eliminado) fica FORA_LOTE com o motivo e sem reserva; quem voltou ao lote volta PENDENTE e livre; quem está no lote sem ficha ganha uma (PENDENTE, versão da regra com que entrou). p_atribuicoes [{candidato, usuario}] dá responsável só às fichas criadas agora, para analistas da vaga. p_usuario nulo = o job. Histórico de tudo. Devolve as contagens.';
revoke all on function private."FC_ABRIR_FICHAS"(uuid, jsonb, uuid) from public, anon, authenticated;

-- 8. Travas que protegem as fichas -------------------------------------------------------------------
create function private."FC_TG_LOTE_COM_FICHA"()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if old."TP_SITUACAO" in ('NO_LOTE', 'ANALISADO') and new."TP_SITUACAO" = 'RANQUEADO'
     and exists (select 1 from public."TB_FICHA_ANALISE" f
                  where f."CO_MONITORAMENTO" = new."CO_MONITORAMENTO"
                    and f."CO_EMPREGARE_CANDIDATO" = new."CO_EMPREGARE_CANDIDATO"
                    and f."TP_SITUACAO" <> 'FORA_LOTE') then
    raise exception 'Resultado da vaga % recusado: quem tem ficha aberta não sai do lote por recálculo (refazer o lote só antes das fichas)', new."CO_VAGA"
      using errcode = '22023';
  end if;
  return new;
end;
$function$;
comment on function private."FC_TG_LOTE_COM_FICHA"() is 'Gatilho de TB_PRE_CLASSIFICACAO: recusa tirar do lote (NO_LOTE → RANQUEADO, o "refazer o lote") quem já tem ficha aberta; sair eliminado continua valendo.';
revoke all on function private."FC_TG_LOTE_COM_FICHA"() from public, anon, authenticated;

create trigger "TG_PRECLASSIF_FICHA" before update of "TP_SITUACAO" on public."TB_PRE_CLASSIFICACAO"
  for each row execute function private."FC_TG_LOTE_COM_FICHA"();
comment on trigger "TG_PRECLASSIF_FICHA" on public."TB_PRE_CLASSIFICACAO" is 'Quem tem ficha aberta só sai do lote eliminado (FC_TG_LOTE_COM_FICHA).';

create function private."FC_TG_EQUIPE_COM_FICHAS"()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  v_qt integer;
  v_nome text;
begin
  if old."ST_ATIVO" = 'S' and new."ST_ATIVO" = 'N' and new."TP_PAPEL" = 'ANALISTA' then
    select count(*) into v_qt
      from public."TB_FICHA_ANALISE" f
     where f."CO_MONITORAMENTO" = new."CO_MONITORAMENTO" and f."CO_USUARIO_RESPONSAVEL" = new."CO_USUARIO"
       and f."TP_SITUACAO" in ('PENDENTE', 'EM_ANALISE')
       and not exists (select 1 from public."RL_ANALISTA_EDITAL" r
                        where r."CO_MONITORAMENTO" = f."CO_MONITORAMENTO" and r."CO_USUARIO" = f."CO_USUARIO_RESPONSAVEL"
                          and r."TP_PAPEL" = 'ANALISTA' and r."ST_ATIVO" = 'S'
                          and (r."CO_VAGA" is null or r."CO_VAGA" = f."CO_VAGA"));
    if v_qt > 0 then
      select coalesce(u.nome, u.email) into v_nome from public."TB_PERFIL_USUARIO" u where u.user_id = new."CO_USUARIO";
      raise exception '% tem % ficha(s) em aberto neste edital: redistribua ou devolva à fila (aba Fila) antes de tirar da equipe.',
        coalesce(v_nome, 'A pessoa'), v_qt using errcode = '22023';
    end if;
  end if;
  return null;
end;
$function$;
comment on function private."FC_TG_EQUIPE_COM_FICHAS"() is 'Gatilho (adiado para o fim da transação) de RL_ANALISTA_EDITAL: recusa tirar da equipe o analista que ainda tem fichas pendentes ou em análise numa vaga que ele deixa de cobrir (AM-3.3).';
revoke all on function private."FC_TG_EQUIPE_COM_FICHAS"() from public, anon, authenticated;

create constraint trigger "TG_ANALISTAEDT_FICHAS" after update of "ST_ATIVO" on public."RL_ANALISTA_EDITAL"
  deferrable initially deferred
  for each row execute function private."FC_TG_EQUIPE_COM_FICHAS"();
comment on trigger "TG_ANALISTAEDT_FICHAS" on public."RL_ANALISTA_EDITAL" is 'Analista com fichas abertas só sai da equipe depois de redistribuí-las (FC_TG_EQUIPE_COM_FICHAS, AM-3.3).';

-- 9. Job (service_role) -------------------------------------------------------------------------------
create function public.pre_classificacao_ler_distribuicao(p_edital uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if not exists (select 1 from public."TB_MONITORAMENTO_INDIGENA" m where m.id = p_edital) then
    raise exception 'Edital não encontrado' using errcode = '22023';
  end if;
  return private."FC_DISTRIBUICAO_DO_EDITAL"(p_edital) || jsonb_build_object(
    'distribuicao_iniciada', exists (
      select 1 from public."TH_FICHA_ANALISE" h
        join public."TB_FICHA_ANALISE" f on f."CO_FICHA_ANALISE" = h."CO_FICHA_ANALISE"
       where f."CO_MONITORAMENTO" = p_edital and h."TP_ACAO" in ('DISTRIBUIR', 'REDISTRIBUIR') and h."TP_ORIGEM" = 'TELA'),
    'analistas', private."FC_ANALISTAS_DO_EDITAL"(p_edital, false),
    'a_abrir', coalesce((
      select jsonb_agg(jsonb_build_object('candidato', p."CO_EMPREGARE_CANDIDATO", 'vaga', p."CO_VAGA",
                                          'posicao', p."NU_POSICAO", 'lote', p."NU_LOTE")
                       order by p."NU_POSICAO", p."CO_VAGA", p."CO_EMPREGARE_CANDIDATO")
        from public."TB_PRE_CLASSIFICACAO" p
       where p."CO_MONITORAMENTO" = p_edital and p."TP_SITUACAO" in ('NO_LOTE', 'ANALISADO')
         and not exists (select 1 from public."TB_FICHA_ANALISE" f
                          where f."CO_MONITORAMENTO" = p_edital and f."CO_EMPREGARE_CANDIDATO" = p."CO_EMPREGARE_CANDIDATO")), '[]'::jsonb));
end;
$function$;
comment on function public.pre_classificacao_ler_distribuicao(uuid) is
  'Job da pré-classificação: a distribuição do edital (modo, critério, limite, destino dos novos), se a coordenação já distribuiu, os analistas que podem receber ficha (ids, vagas, limite, pendentes; sem nome) e quem está no lote sem ficha (id, vaga, posição, lote), na ordem da Provisória. Só service_role.';

create function public.abrir_fichas_pre_classificacao(p_execucao text, p_edital uuid, p_atribuicoes jsonb default '[]'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_exec public."TL_PRE_CLASSIFICACAO" := private."FC_EXIGIR_EXECUCAO_PRECLASSIF"(p_execucao);
begin
  return private."FC_ABRIR_FICHAS"(p_edital, p_atribuicoes, null) || jsonb_build_object('execucao', v_exec."CO_EXECUCAO");
end;
$function$;
comment on function public.abrir_fichas_pre_classificacao(text, uuid, jsonb) is
  'Job da pré-classificação, no fim de cada edital (execução em andamento): abre as fichas de quem está no lote, marca FORA_LOTE quem saiu eliminado e dá as fichas novas aos analistas calculados pelo job (FC_ABRIR_FICHAS valida). Só service_role.';

revoke all on function public.pre_classificacao_ler_distribuicao(uuid) from public, anon, authenticated;
revoke all on function public.abrir_fichas_pre_classificacao(text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.pre_classificacao_ler_distribuicao(uuid) to service_role;
grant execute on function public.abrir_fichas_pre_classificacao(text, uuid, jsonb) to service_role;

-- 10. Tela (authenticated) ------------------------------------------------------------------------------
create function public.obter_fila_avaliacao(p_edital uuid)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_area text := private."FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 1);
  v_papel text := private."FC_PAPEL_AVALIACAO"(p_edital);
  v_uid uuid := (select auth.uid());
  v_m public."TB_MONITORAMENTO_INDIGENA";
begin
  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" where id = p_edital;
  return json_build_object(
    'schema_version', 1,
    'gerado_em', now(),
    'edital', json_build_object('id', v_m.id, 'edital', v_m.edital, 'area', v_area,
                                'rotulo', private."FC_ROTULO_DO_EDITAL"(v_m.edital)),
    'papel', v_papel,
    'pode_coordenar', coalesce(v_papel = 'COORDENADOR', false),
    'pode_pegar', private."FC_PODE_ANALISAR_VAGA"(p_edital, v_uid, null),
    'eu', v_uid,
    'prazo_reserva_min', extract(epoch from private."FC_PRAZO_RESERVA_FICHA"())::integer / 60,
    'distribuicao', private."FC_DISTRIBUICAO_DO_EDITAL"(p_edital),
    'sem_ficha', (select count(*) from public."TB_PRE_CLASSIFICACAO" p
                   where p."CO_MONITORAMENTO" = p_edital and p."TP_SITUACAO" in ('NO_LOTE', 'ANALISADO')
                     and not exists (select 1 from public."TB_FICHA_ANALISE" f
                                      where f."CO_MONITORAMENTO" = p_edital and f."CO_EMPREGARE_CANDIDATO" = p."CO_EMPREGARE_CANDIDATO")),
    'vagas', coalesce((
      select json_agg(json_build_object('codigo', pv."CO_VAGA", 'cargo', pv."NO_CARGO", 'lotacao', pv."NO_LOTACAO")
                      order by pv."CO_VAGA")
        from public."TB_PRE_CLASSIF_VAGA" pv where pv."CO_MONITORAMENTO" = p_edital), '[]'::json),
    'analistas', private."FC_ANALISTAS_DO_EDITAL"(p_edital, true),
    'filtros', private."FC_FILTROS_FILA_JSON"(v_uid),
    'candidatos', coalesce((
      select json_agg(json_build_object(
               'id', a."CO_EMPREGARE_CANDIDATO", 'vaga', a."CO_VAGA", 'codigo', c."CO_CANDIDATO_EMPREGARE",
               'nome', c."NO_CANDIDATO", 'situacao_pre', a."TP_SITUACAO", 'motivo_eliminacao', a."DS_MOTIVO_ELIMINACAO",
               'posicao', a."NU_POSICAO", 'lote', a."NU_LOTE", 'art', a."VL_ART", 'nota', a."VL_NOTA_ORDEM",
               'modalidade', a."NO_MODALIDADE",
               'ficha', case when f."CO_FICHA_ANALISE" is null then null else json_build_object(
                 'id', f."CO_FICHA_ANALISE", 'versao', f."NU_VERSAO", 'situacao', f."TP_SITUACAO",
                 'responsavel', f."CO_USUARIO_RESPONSAVEL", 'responsavel_nome', coalesce(ur.nome, ur.email),
                 'atribuida_em', f."DT_ATRIBUICAO", 'motivo_saida', f."DS_MOTIVO_SAIDA", 'lote', f."NU_LOTE",
                 'reserva', case when f."DT_RESERVA_EXPIRA" > now() then json_build_object(
                   'usuario', f."CO_USUARIO_RESERVA", 'nome', coalesce(uv.nome, uv.email),
                   'desde', f."DT_RESERVA", 'expira', f."DT_RESERVA_EXPIRA") end) end)
             order by a."CO_VAGA", a."TP_SITUACAO" = 'ELIMINADO', a."NU_POSICAO", c."CO_CANDIDATO_EMPREGARE")
        from public."TB_PRE_CLASSIFICACAO" a
        join public."TB_EMPREGARE_CANDIDATO" c on c."CO_EMPREGARE_CANDIDATO" = a."CO_EMPREGARE_CANDIDATO"
        left join public."TB_FICHA_ANALISE" f
          on f."CO_MONITORAMENTO" = a."CO_MONITORAMENTO" and f."CO_EMPREGARE_CANDIDATO" = a."CO_EMPREGARE_CANDIDATO"
        left join public."TB_PERFIL_USUARIO" ur on ur.user_id = f."CO_USUARIO_RESPONSAVEL"
        left join public."TB_PERFIL_USUARIO" uv on uv.user_id = f."CO_USUARIO_RESERVA"
       where a."CO_MONITORAMENTO" = p_edital), '[]'::json)
  );
end;
$function$;
comment on function public.obter_fila_avaliacao(uuid) is
  'A fila da avaliação documental do edital (json): papel de quem está logado (coordena, pode pegar), a distribuição da regra, cada inscrito da pré-classificação com a ficha (situação, responsável, reserva vigente e versão; nome do candidato, sem CPF nem contato), as vagas, os analistas com as pendentes, quantos do lote ainda estão sem ficha e os filtros salvos de quem chama. Exige avaliacao_documental >= leitor, a área e o recorte da coordenação.';
revoke all on function public.obter_fila_avaliacao(uuid) from public, anon;
grant execute on function public.obter_fila_avaliacao(uuid) to authenticated;

create function public.pegar_proxima_ficha(p_edital uuid, p_vaga text default null)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_area text := private."FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 2);
  v_uid uuid := (select auth.uid());
  v_vaga text := nullif(btrim(coalesce(p_vaga, '')), '');
  v_dist jsonb := private."FC_DISTRIBUICAO_DO_EDITAL"(p_edital);
  v_ficha uuid;
begin
  if not private."FC_PODE_ANALISAR_VAGA"(p_edital, v_uid, v_vaga) then
    raise exception 'Você não está na equipe deste edital como analista%', case when v_vaga is null then '' else ' da vaga ' || v_vaga end
      using errcode = '42501';
  end if;

  -- Primeiro as suas (a que já está em análise, depois as distribuídas), na ordem da Provisória.
  select f."CO_FICHA_ANALISE" into v_ficha
    from public."TB_FICHA_ANALISE" f
    join public."TB_PRE_CLASSIFICACAO" p
      on p."CO_MONITORAMENTO" = f."CO_MONITORAMENTO" and p."CO_EMPREGARE_CANDIDATO" = f."CO_EMPREGARE_CANDIDATO"
   where f."CO_MONITORAMENTO" = p_edital and f."CO_USUARIO_RESPONSAVEL" = v_uid
     and f."TP_SITUACAO" in ('PENDENTE', 'EM_ANALISE')
     and (v_vaga is null or f."CO_VAGA" = v_vaga)
     and (f."CO_USUARIO_RESERVA" is null or f."CO_USUARIO_RESERVA" = v_uid or f."DT_RESERVA_EXPIRA" <= now())
   order by f."TP_SITUACAO" = 'EM_ANALISE' desc, p."NU_POSICAO", f."CO_VAGA", f."CO_FICHA_ANALISE"
   limit 1
   for update of f skip locked;

  -- Depois a primeira livre (Pegar próximo, ou os que entram depois ficam livres).
  if v_ficha is null and (v_dist ->> 'modo' = 'PEGAR_PROXIMO' or v_dist ->> 'novos' = 'PEGAR_PROXIMO') then
    select f."CO_FICHA_ANALISE" into v_ficha
      from public."TB_FICHA_ANALISE" f
      join public."TB_PRE_CLASSIFICACAO" p
        on p."CO_MONITORAMENTO" = f."CO_MONITORAMENTO" and p."CO_EMPREGARE_CANDIDATO" = f."CO_EMPREGARE_CANDIDATO"
     where f."CO_MONITORAMENTO" = p_edital and f."CO_USUARIO_RESPONSAVEL" is null and f."TP_SITUACAO" = 'PENDENTE'
       and (v_vaga is null or f."CO_VAGA" = v_vaga)
       and exists (select 1 from public."RL_ANALISTA_EDITAL" r
                    where r."CO_MONITORAMENTO" = p_edital and r."CO_USUARIO" = v_uid and r."TP_PAPEL" = 'ANALISTA'
                      and r."ST_ATIVO" = 'S' and (r."CO_VAGA" is null or r."CO_VAGA" = f."CO_VAGA"))
     order by p."NU_POSICAO", f."CO_VAGA", f."CO_FICHA_ANALISE"
     limit 1
     for update of f skip locked;
  end if;

  if v_ficha is null then
    return json_build_object('ficha', null, 'reservada', false,
                             'motivo', case when v_dist ->> 'modo' = 'DISTRIBUICAO_INICIAL' and v_dist ->> 'novos' <> 'PEGAR_PROXIMO'
                                            then 'Nenhuma ficha sua na fila: a coordenação distribui as fichas deste edital.'
                                            else 'Nenhuma ficha livre na fila.' end);
  end if;
  perform private."FC_RESERVAR_FICHA"(v_ficha, v_uid, 'PEGAR');
  insert into public."TL_ACESSO_FICHA_ANALISE" ("CO_FICHA_ANALISE", "TP_ACESSO", "CO_USUARIO") values (v_ficha, 'ABRIR_FICHA', v_uid);
  return json_build_object('ficha', private."FC_FICHA_ANALISE_JSON"(v_ficha), 'reservada', true, 'motivo', null);
end;
$function$;
comment on function public.pegar_proxima_ficha(uuid, text) is
  '"Pegar próximo": dá ao analista a próxima ficha na ordem da Provisória — primeiro as suas (em análise, depois as distribuídas), depois a primeira livre das vagas que ele analisa (no modo Pegar próximo, ou quando a regra deixa livres os que entram depois) — e a reserva por 15 minutos. for update skip locked: duas pessoas nunca recebem a mesma (AM-6.1). p_vaga restringe a uma vaga. Exige Editor e a linha ANALISTA na equipe.';
revoke all on function public.pegar_proxima_ficha(uuid, text) from public, anon;
grant execute on function public.pegar_proxima_ficha(uuid, text) to authenticated;

create function public.reservar_ficha(p_ficha uuid)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_f public."TB_FICHA_ANALISE";
  v_uid uuid := (select auth.uid());
  v_area text;
  v_dist jsonb;
  v_reservada boolean := false;
  v_motivo text;
begin
  select * into v_f from public."TB_FICHA_ANALISE" where "CO_FICHA_ANALISE" = p_ficha;
  if v_f."CO_FICHA_ANALISE" is null then
    raise exception 'Ficha não encontrada' using errcode = '22023';
  end if;
  v_area := private."FC_EXIGIR_AVALIACAO_EDITAL"(v_f."CO_MONITORAMENTO", 1);
  select * into v_f from public."TB_FICHA_ANALISE" where "CO_FICHA_ANALISE" = p_ficha for update;
  v_dist := private."FC_DISTRIBUICAO_DO_EDITAL"(v_f."CO_MONITORAMENTO");

  if v_f."TP_SITUACAO" in ('CONCLUIDA', 'FORA_LOTE', 'REVISAR') then
    v_motivo := case v_f."TP_SITUACAO" when 'CONCLUIDA' then 'Ficha concluída.' when 'FORA_LOTE' then 'Fora do lote.'
                                       else 'Ficha em revisão.' end;
  elsif v_f."DT_RESERVA_EXPIRA" > now() and v_f."CO_USUARIO_RESERVA" <> v_uid then
    v_motivo := 'Em uso por outra pessoa.';
  elsif v_f."CO_USUARIO_RESPONSAVEL" = v_uid
        and private."FC_PODE_ANALISAR_VAGA"(v_f."CO_MONITORAMENTO", v_uid, v_f."CO_VAGA") then
    perform private."FC_RESERVAR_FICHA"(p_ficha, v_uid, 'RESERVAR');
    v_reservada := true;
  elsif v_f."CO_USUARIO_RESPONSAVEL" is null
        and (v_dist ->> 'modo' = 'PEGAR_PROXIMO' or v_dist ->> 'novos' = 'PEGAR_PROXIMO')
        and private."FC_PODE_ANALISAR_VAGA"(v_f."CO_MONITORAMENTO", v_uid, v_f."CO_VAGA") then
    perform private."FC_RESERVAR_FICHA"(p_ficha, v_uid, 'PEGAR');
    v_reservada := true;
  else
    v_motivo := case when v_f."CO_USUARIO_RESPONSAVEL" is null then 'Ficha livre: a coordenação distribui as fichas deste edital.'
                     else 'Ficha de outra pessoa.' end;
  end if;

  insert into public."TL_ACESSO_FICHA_ANALISE" ("CO_FICHA_ANALISE", "TP_ACESSO", "CO_USUARIO") values (p_ficha, 'ABRIR_FICHA', v_uid);
  return json_build_object('ficha', private."FC_FICHA_ANALISE_JSON"(p_ficha), 'reservada', v_reservada,
                           'somente_leitura', not v_reservada, 'motivo', v_motivo);
end;
$function$;
comment on function public.reservar_ficha(uuid) is
  'Abre a ficha: o responsável (ou um analista da vaga que pega uma livre, quando a regra deixa) fica com a reserva por 15 minutos; quem abre uma ficha em uso, de outra pessoa, concluída, em revisão ou fora do lote vê só para leitura, com o motivo e o "Em uso por … desde …" (AM-12.2). Registra o acesso (TL_ACESSO_FICHA_ANALISE). Exige avaliacao_documental >= leitor no edital da ficha.';
revoke all on function public.reservar_ficha(uuid) from public, anon;
grant execute on function public.reservar_ficha(uuid) to authenticated;

create function public.renovar_reserva(p_ficha uuid)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_f public."TB_FICHA_ANALISE";
  v_uid uuid := (select auth.uid());
  v_area text;
begin
  select * into v_f from public."TB_FICHA_ANALISE" where "CO_FICHA_ANALISE" = p_ficha;
  if v_f."CO_FICHA_ANALISE" is null then
    raise exception 'Ficha não encontrada' using errcode = '22023';
  end if;
  v_area := private."FC_EXIGIR_AVALIACAO_EDITAL"(v_f."CO_MONITORAMENTO", 2);
  select * into v_f from public."TB_FICHA_ANALISE" where "CO_FICHA_ANALISE" = p_ficha for update;
  if v_f."CO_USUARIO_RESERVA" = v_uid and v_f."DT_RESERVA_EXPIRA" > now() then
    -- Renovar não muda a versão nem vai ao histórico.
    update public."TB_FICHA_ANALISE" set "DT_RESERVA_EXPIRA" = now() + private."FC_PRAZO_RESERVA_FICHA"()
     where "CO_FICHA_ANALISE" = p_ficha;
  elsif (v_f."DT_RESERVA_EXPIRA" is null or v_f."DT_RESERVA_EXPIRA" <= now())
        and v_f."CO_USUARIO_RESPONSAVEL" = v_uid and v_f."TP_SITUACAO" in ('PENDENTE', 'EM_ANALISE')
        and private."FC_PODE_ANALISAR_VAGA"(v_f."CO_MONITORAMENTO", v_uid, v_f."CO_VAGA") then
    perform private."FC_RESERVAR_FICHA"(p_ficha, v_uid, 'RESERVAR');
  else
    raise exception 'A ficha não está mais com você (reserva liberada ou com outra pessoa); abra de novo.' using errcode = '40001';
  end if;
  return json_build_object('ficha', private."FC_FICHA_ANALISE_JSON"(p_ficha));
end;
$function$;
comment on function public.renovar_reserva(uuid) is
  'Renova por mais 15 minutos a reserva de quem está com a ficha aberta (sem mudar a versão). Reserva vencida e ninguém no lugar: o responsável reserva de novo. Com outra pessoa ou liberada pela coordenação: 40001. Exige Editor no edital da ficha.';
revoke all on function public.renovar_reserva(uuid) from public, anon;
grant execute on function public.renovar_reserva(uuid) to authenticated;

create function public.liberar_reserva(p_edital uuid, p_fichas uuid[], p_motivo text default null)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_area text := private."FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 2);
  v_uid uuid := (select auth.uid());
  v_coord boolean := coalesce(private."FC_PAPEL_AVALIACAO"(p_edital) = 'COORDENADOR', false);
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_item record;
  v_liberadas integer := 0;
begin
  if p_fichas is null or cardinality(p_fichas) not between 1 and 5000 then
    raise exception 'Escolha de 1 a 5.000 fichas.' using errcode = '22023';
  end if;
  if v_motivo is not null and length(v_motivo) > 2000 then
    raise exception 'Motivo com até 2.000 caracteres.' using errcode = '22023';
  end if;
  for v_item in
    select f."CO_FICHA_ANALISE" as ficha, f."CO_USUARIO_RESERVA" as reserva, f."TP_SITUACAO" as situacao,
           f."CO_USUARIO_RESPONSAVEL" as responsavel
      from public."TB_FICHA_ANALISE" f
     where f."CO_MONITORAMENTO" = p_edital and f."CO_FICHA_ANALISE" = any (p_fichas)
       and f."DT_RESERVA_EXPIRA" > now()
     order by f."CO_FICHA_ANALISE"
     for update
  loop
    if v_item.reserva <> v_uid then
      if not v_coord then
        raise exception 'Só a coordenação libera a reserva de outra pessoa' using errcode = '42501';
      end if;
      if v_motivo is null or length(v_motivo) < 10 then
        raise exception 'Informe o motivo para liberar a reserva de outra pessoa (10 a 2.000 caracteres).' using errcode = '22023';
      end if;
    end if;
    update public."TB_FICHA_ANALISE" set
      "CO_USUARIO_RESERVA" = null, "DT_RESERVA" = null, "DT_RESERVA_EXPIRA" = null,
      "NU_VERSAO" = "NU_VERSAO" + 1, "DT_ATUALIZACAO" = now()
     where "CO_FICHA_ANALISE" = v_item.ficha;
    perform private."FC_HISTORICO_FICHA"(v_item.ficha, case when v_item.reserva = v_uid then 'LIBERAR' else 'LIBERAR_RESERVA' end,
                                         v_item.situacao, v_item.responsavel,
                                         case when v_item.reserva = v_uid then null else v_motivo end, v_uid);
    v_liberadas := v_liberadas + 1;
  end loop;
  return json_build_object('liberadas', v_liberadas);
end;
$function$;
comment on function public.liberar_reserva(uuid, uuid[], text) is
  'Libera reservas vigentes de fichas do edital: a sua (ao fechar ou concluir), sem motivo; a de outra pessoa (reserva presa), só a coordenação e com motivo de 10 a 2.000. A situação e o responsável não mudam. Fichas sem reserva vigente são ignoradas. Devolve quantas foram liberadas.';
revoke all on function public.liberar_reserva(uuid, uuid[], text) from public, anon;
grant execute on function public.liberar_reserva(uuid, uuid[], text) to authenticated;

create function public.distribuir_fichas(p_edital uuid, p_atribuicoes jsonb, p_motivo text default null)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_area text := private."FC_EXIGIR_COORD_FICHAS"(p_edital);
  v_uid uuid := (select auth.uid());
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_item record;
  v_f public."TB_FICHA_ANALISE";
  v_acao text;
  v_qt integer;
  v_alteradas integer := 0;
  v_codigo text;
begin
  if jsonb_typeof(p_atribuicoes) is distinct from 'array' or jsonb_array_length(p_atribuicoes) not between 1 and 5000 then
    raise exception 'Escolha de 1 a 5.000 fichas.' using errcode = '22023';
  end if;
  if v_motivo is not null and length(v_motivo) > 2000 then
    raise exception 'Motivo com até 2.000 caracteres.' using errcode = '22023';
  end if;
  begin
    -- Controle otimista: alguma ficha mudou desde que a tela leu? Nada é gravado.
    select count(*) into v_qt
      from jsonb_to_recordset(p_atribuicoes) x(ficha uuid, versao integer, usuario uuid)
      left join public."TB_FICHA_ANALISE" f on f."CO_FICHA_ANALISE" = x.ficha and f."CO_MONITORAMENTO" = p_edital
     where f."CO_FICHA_ANALISE" is null or f."NU_VERSAO" is distinct from x.versao;
  exception when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'Atribuição com id ou versão inválida' using errcode = '22023';
  end;
  if v_qt > 0 then
    raise exception '% ficha(s) mudaram desde que você abriu a fila; atualize e confira.', v_qt using errcode = '40001';
  end if;

  for v_item in
    select x.ficha, x.usuario from jsonb_to_recordset(p_atribuicoes) x(ficha uuid, versao integer, usuario uuid) order by x.ficha
  loop
    select * into v_f from public."TB_FICHA_ANALISE" where "CO_FICHA_ANALISE" = v_item.ficha for update;
    select c."CO_CANDIDATO_EMPREGARE" into v_codigo from public."TB_EMPREGARE_CANDIDATO" c
     where c."CO_EMPREGARE_CANDIDATO" = v_f."CO_EMPREGARE_CANDIDATO";
    if v_f."TP_SITUACAO" in ('CONCLUIDA', 'FORA_LOTE') then
      raise exception 'A ficha % está %: não é redistribuída (AM-6.3).', v_codigo,
        case v_f."TP_SITUACAO" when 'CONCLUIDA' then 'concluída' else 'fora do lote' end using errcode = '22023';
    end if;
    continue when v_item.usuario is not distinct from v_f."CO_USUARIO_RESPONSAVEL"
                  and not (v_item.usuario is null and v_f."TP_SITUACAO" = 'REVISAR');
    if v_item.usuario is not null and not private."FC_PODE_ANALISAR_VAGA"(p_edital, v_item.usuario, v_f."CO_VAGA") then
      raise exception 'A pessoa escolhida para a ficha % não analisa a vaga % (equipe do edital, papel Analista, Editor).', v_codigo, v_f."CO_VAGA"
        using errcode = '22023';
    end if;
    v_acao := case when v_item.usuario is null then 'DEVOLVER_FILA'
                   when v_f."CO_USUARIO_RESPONSAVEL" is null then 'DISTRIBUIR' else 'REDISTRIBUIR' end;
    if v_acao <> 'DISTRIBUIR' and (v_motivo is null or length(v_motivo) < 10) then
      raise exception 'Informe o motivo para redistribuir ou devolver à fila (10 a 2.000 caracteres).' using errcode = '22023';
    end if;
    update public."TB_FICHA_ANALISE" set
      "CO_USUARIO_RESPONSAVEL" = v_item.usuario,
      "DT_ATRIBUICAO" = case when v_item.usuario is null then null else now() end,
      "TP_SITUACAO" = case when v_item.usuario is null then 'PENDENTE' else "TP_SITUACAO" end,
      "CO_USUARIO_RESERVA" = null, "DT_RESERVA" = null, "DT_RESERVA_EXPIRA" = null,
      "NU_VERSAO" = "NU_VERSAO" + 1, "DT_ATUALIZACAO" = now()
     where "CO_FICHA_ANALISE" = v_item.ficha;
    perform private."FC_HISTORICO_FICHA"(v_item.ficha, v_acao, v_f."TP_SITUACAO", v_f."CO_USUARIO_RESPONSAVEL", v_motivo, v_uid);
    v_alteradas := v_alteradas + 1;
  end loop;
  return json_build_object('alteradas', v_alteradas);
end;
$function$;
comment on function public.distribuir_fichas(uuid, jsonb, text) is
  'Distribuição inicial, redistribuição e devolução à fila pela coordenação (a prévia é da tela: src/lib/avaliacao-documental/distribuicao.js). p_atribuicoes [{ficha, versao, usuario}] (usuario nulo = devolver à fila): confere a versão de todas antes (40001, nada grava), recusa ficha concluída ou fora do lote (AM-6.3) e pessoa que não analisa a vaga; redistribuir e devolver exigem motivo (10 a 2.000); a reserva cai; tudo vai ao histórico. Só a coordenação do edital.';
revoke all on function public.distribuir_fichas(uuid, jsonb, text) from public, anon;
grant execute on function public.distribuir_fichas(uuid, jsonb, text) to authenticated;

create function public.mandar_fichas_revisao(p_edital uuid, p_fichas jsonb, p_motivo text)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_area text := private."FC_EXIGIR_COORD_FICHAS"(p_edital);
  v_uid uuid := (select auth.uid());
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_item record;
  v_f public."TB_FICHA_ANALISE";
  v_qt integer;
  v_codigo text;
begin
  if jsonb_typeof(p_fichas) is distinct from 'array' or jsonb_array_length(p_fichas) not between 1 and 5000 then
    raise exception 'Escolha de 1 a 5.000 fichas.' using errcode = '22023';
  end if;
  if v_motivo is null or length(v_motivo) not between 10 and 2000 then
    raise exception 'Informe o motivo para mandar para revisão (10 a 2.000 caracteres).' using errcode = '22023';
  end if;
  begin
    select count(*) into v_qt
      from jsonb_to_recordset(p_fichas) x(ficha uuid, versao integer)
      left join public."TB_FICHA_ANALISE" f on f."CO_FICHA_ANALISE" = x.ficha and f."CO_MONITORAMENTO" = p_edital
     where f."CO_FICHA_ANALISE" is null or f."NU_VERSAO" is distinct from x.versao;
  exception when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'Ficha com id ou versão inválida' using errcode = '22023';
  end;
  if v_qt > 0 then
    raise exception '% ficha(s) mudaram desde que você abriu a fila; atualize e confira.', v_qt using errcode = '40001';
  end if;
  for v_item in select x.ficha from jsonb_to_recordset(p_fichas) x(ficha uuid, versao integer) order by x.ficha loop
    select * into v_f from public."TB_FICHA_ANALISE" where "CO_FICHA_ANALISE" = v_item.ficha for update;
    if v_f."TP_SITUACAO" not in ('PENDENTE', 'EM_ANALISE') then
      select c."CO_CANDIDATO_EMPREGARE" into v_codigo from public."TB_EMPREGARE_CANDIDATO" c
       where c."CO_EMPREGARE_CANDIDATO" = v_f."CO_EMPREGARE_CANDIDATO";
      raise exception 'A ficha % não está pendente nem em análise.', v_codigo using errcode = '22023';
    end if;
    update public."TB_FICHA_ANALISE" set
      "TP_SITUACAO" = 'REVISAR', "CO_USUARIO_RESERVA" = null, "DT_RESERVA" = null, "DT_RESERVA_EXPIRA" = null,
      "NU_VERSAO" = "NU_VERSAO" + 1, "DT_ATUALIZACAO" = now()
     where "CO_FICHA_ANALISE" = v_item.ficha;
    perform private."FC_HISTORICO_FICHA"(v_item.ficha, 'REVISAR', v_f."TP_SITUACAO", v_f."CO_USUARIO_RESPONSAVEL", v_motivo, v_uid);
  end loop;
  return json_build_object('alteradas', jsonb_array_length(p_fichas));
end;
$function$;
comment on function public.mandar_fichas_revisao(uuid, jsonb, text) is
  'A coordenação manda fichas pendentes ou em análise para revisão (situação REVISAR; a reserva cai), com motivo de 10 a 2.000. p_fichas [{ficha, versao}]: versão velha em qualquer uma = 40001 e nada grava. A validação ou devolução pelo revisor é da fase F5.';
revoke all on function public.mandar_fichas_revisao(uuid, jsonb, text) from public, anon;
grant execute on function public.mandar_fichas_revisao(uuid, jsonb, text) to authenticated;

create function public.abrir_fichas_do_edital(p_edital uuid)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_area text := private."FC_EXIGIR_COORD_FICHAS"(p_edital);
begin
  if not exists (select 1 from public."TB_PRE_CLASSIFICACAO" p where p."CO_MONITORAMENTO" = p_edital) then
    raise exception 'O edital ainda não tem pré-classificação: rode o Recalcular.' using errcode = '22023';
  end if;
  return private."FC_ABRIR_FICHAS"(p_edital, '[]'::jsonb, (select auth.uid()))::json;
end;
$function$;
comment on function public.abrir_fichas_do_edital(uuid) is
  'A coordenação abre as fichas do lote pela tela (o job já faz no fim de cada pré-classificação): cria as que faltam (livres na fila), marca FORA_LOTE quem saiu e devolve quem voltou. Devolve as contagens. Só a coordenação do edital.';
revoke all on function public.abrir_fichas_do_edital(uuid) from public, anon;
grant execute on function public.abrir_fichas_do_edital(uuid) to authenticated;

create function public.salvar_filtro_fila(p_nome text, p_filtro jsonb)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_nome text := btrim(coalesce(p_nome, ''));
begin
  if v_uid is null or not private.pode_recurso('avaliacao_documental', 1) then
    raise exception 'Sem permissão para a Avaliação documental' using errcode = '42501';
  end if;
  if length(v_nome) not between 1 and 60 then
    raise exception 'Nome do filtro de 1 a 60 caracteres.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_filtro) is distinct from 'object' or length(p_filtro::text) > 2000 then
    raise exception 'Filtro inválido.' using errcode = '22023';
  end if;
  update public."TB_FILTRO_FILA_ANALISE" set "DS_FILTRO" = p_filtro, "NO_FILTRO" = v_nome, "DT_ATUALIZACAO" = now()
   where "CO_USUARIO" = v_uid and "ST_ATIVO" = 'S' and lower(btrim("NO_FILTRO")) = lower(v_nome);
  if not found then
    if (select count(*) from public."TB_FILTRO_FILA_ANALISE" where "CO_USUARIO" = v_uid and "ST_ATIVO" = 'S') >= 30 then
      raise exception 'Até 30 filtros salvos: exclua um antes.' using errcode = '22023';
    end if;
    insert into public."TB_FILTRO_FILA_ANALISE" ("CO_USUARIO", "NO_FILTRO", "DS_FILTRO") values (v_uid, v_nome, p_filtro);
  end if;
  return private."FC_FILTROS_FILA_JSON"(v_uid);
end;
$function$;
comment on function public.salvar_filtro_fila(text, jsonb) is
  'Salva (ou troca, pelo mesmo nome) um filtro da fila de quem chama; até 30 por pessoa. Devolve os filtros salvos. Exige avaliacao_documental >= leitor.';
revoke all on function public.salvar_filtro_fila(text, jsonb) from public, anon;
grant execute on function public.salvar_filtro_fila(text, jsonb) to authenticated;

create function public.excluir_filtro_fila(p_filtro uuid)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null or not private.pode_recurso('avaliacao_documental', 1) then
    raise exception 'Sem permissão para a Avaliação documental' using errcode = '42501';
  end if;
  update public."TB_FILTRO_FILA_ANALISE" set "ST_ATIVO" = 'N', "DT_ATUALIZACAO" = now()
   where "CO_FILTRO_FILA" = p_filtro and "CO_USUARIO" = v_uid and "ST_ATIVO" = 'S';
  if not found then
    raise exception 'Filtro não encontrado.' using errcode = '22023';
  end if;
  return private."FC_FILTROS_FILA_JSON"(v_uid);
end;
$function$;
comment on function public.excluir_filtro_fila(uuid) is 'Exclui (desativa) um filtro salvo de quem chama. Devolve os filtros salvos. Exige avaliacao_documental >= leitor.';
revoke all on function public.excluir_filtro_fila(uuid) from public, anon;
grant execute on function public.excluir_filtro_fila(uuid) to authenticated;

-- ═══ CORPO DA MIGRATION (fim) ═══

-- E1. Estrutura: RLS, sem acesso direto, job só pelo service_role.
do $$
declare
  v_sem_rls integer;
begin
  select count(*) into v_sem_rls
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname in ('TB_FICHA_ANALISE', 'TH_FICHA_ANALISE', 'TL_ACESSO_FICHA_ANALISE', 'TB_FILTRO_FILA_ANALISE')
     and not c.relrowsecurity;
  if v_sem_rls <> 0 then raise exception 'FALHOU E1: % tabela(s) sem RLS', v_sem_rls; end if;
  if has_table_privilege('authenticated', 'public."TB_FICHA_ANALISE"', 'select')
     or has_table_privilege('anon', 'public."TB_FILTRO_FILA_ANALISE"', 'select') then
    raise exception 'FALHOU E1: tabela com acesso direto';
  end if;
  if has_function_privilege('authenticated', 'public.abrir_fichas_pre_classificacao(text, uuid, jsonb)', 'execute')
     or has_function_privilege('authenticated', 'public.pre_classificacao_ler_distribuicao(uuid)', 'execute')
     or not has_function_privilege('service_role', 'public.abrir_fichas_pre_classificacao(text, uuid, jsonb)', 'execute')
     or not has_function_privilege('authenticated', 'public.pegar_proxima_ficha(uuid, text)', 'execute')
     or has_function_privilege('anon', 'public.obter_fila_avaliacao(uuid)', 'execute') then
    raise exception 'FALHOU E1: permissões das funções';
  end if;
  raise notice 'ok E1: RLS nas 4 tabelas, sem acesso direto, job só pelo service_role';
end;
$$;

-- E2. Dados sintéticos (somem no rollback) num edital real — de preferência o 93/2026 (Projetos).
do $$
declare
  v_edital uuid;
  v_area text;
  v_admin text;
  v_regra uuid;
  v_versao integer;
  v_config jsonb := '{"schema":1,"provisoria":{"eliminacao_automatica":[],"nota_declarada":[],"divergencia_tolerancia":0},
    "lote":{"base":"FIXO","fixo":4,"inclui_cr":false,"por_modalidade":false,"inclui_empatados":false,"linha_anda":true,"publica_reposicao":false},
    "distribuicao":{"modo":"PEGAR_PROXIMO","criterio":"PARTES_IGUAIS","limite_por_analista":null,"novos":"MENOS_PENDENTES","dias_parada":3},
    "blocos":[]}';
begin
  select m.id, m."CO_AREA" into v_edital, v_area
    from public."TB_MONITORAMENTO_INDIGENA" m
   where m."CO_AREA" is not null
   order by coalesce(m."CO_AREA" = 'projetos' and private."FC_NUMERO_EDITAL"(m.edital) = '93/2026', false) desc,
            coalesce(m.ativo, false) desc, m.edital
   limit 1;
  if v_edital is null then raise exception 'ENSAIO: nenhum edital com área'; end if;
  select g."CO_GRUPO_ACESSO" into v_admin from public."TB_GRUPO_ACESSO" g where g."ST_ADMIN_GLOBAL" order by g."CO_GRUPO_ACESSO" = 'admin' desc limit 1;
  perform set_config('ensaio.edital', v_edital::text, true);

  insert into public."TB_EMPREGARE_VAGA" ("CO_VAGA", "CO_MONITORAMENTO", "TP_SITUACAO", "QT_CANDIDATO_ATIVO")
  values ('99999101', v_edital, 'GRAVADA', 6);
  insert into public."TB_EMPREGARE_CANDIDATO"
    ("CO_EMPREGARE_CANDIDATO", "CO_VAGA", "DS_CHAVE_CANDIDATO", "TP_CHAVE", "CO_CANDIDATO_EMPREGARE", "NO_CANDIDATO",
     "NU_CPF", "DT_NASCIMENTO", "DT_CANDIDATURA", "DS_COLUNA_ORIGINAL", "DS_HASH_LINHA")
  select ('00000000-0000-4000-a000-0000000f300' || x.n)::uuid, '99999101', 'cod:F3E000' || x.n, 'CODIGO', 'F3E000' || x.n,
         'Ensaio F3 ' || x.n, '00000000000', date '1990-01-01', timestamptz '2026-09-20 12:00:00+00', '{}'::jsonb, repeat('a', 64)
    from generate_series(1, 6) x(n);

  insert into auth.users (id, instance_id, aud, role, email) values
    ('00000000-0000-4000-a000-0000000f3a01', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.f3.admin@ensaio.invalid'),
    ('00000000-0000-4000-a000-0000000f3a02', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.f3.gestor@ensaio.invalid'),
    ('00000000-0000-4000-a000-0000000f3a03', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.f3.ana@ensaio.invalid'),
    ('00000000-0000-4000-a000-0000000f3a04', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.f3.beto@ensaio.invalid'),
    ('00000000-0000-4000-a000-0000000f3a05', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.f3.leitor@ensaio.invalid'),
    ('00000000-0000-4000-a000-0000000f3a06', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.f3.sem@ensaio.invalid');
  insert into public."TB_PERFIL_USUARIO" (user_id, email, nome, perfil, ativo) values
    ('00000000-0000-4000-a000-0000000f3a01', 'ensaio.f3.admin@ensaio.invalid', 'Ensaio F3 Admin', v_admin, true),
    ('00000000-0000-4000-a000-0000000f3a02', 'ensaio.f3.gestor@ensaio.invalid', 'Ensaio F3 Gestor', 'edital_gestor', true),
    ('00000000-0000-4000-a000-0000000f3a03', 'ensaio.f3.ana@ensaio.invalid', 'Ensaio F3 Ana', 'usuario', true),
    ('00000000-0000-4000-a000-0000000f3a04', 'ensaio.f3.beto@ensaio.invalid', 'Ensaio F3 Beto', 'usuario', true),
    ('00000000-0000-4000-a000-0000000f3a05', 'ensaio.f3.leitor@ensaio.invalid', 'Ensaio F3 Leitor', 'usuario', true),
    ('00000000-0000-4000-a000-0000000f3a06', 'ensaio.f3.sem@ensaio.invalid', 'Ensaio F3 Sem Acesso', 'usuario', true);
  insert into public."RL_PERFIL_USUARIO_AREA" ("CO_PERFIL_USUARIO", "CO_AREA")
  select u.id, v_area from public."TB_PERFIL_USUARIO" u
   where u.email like 'ensaio.f3.%@ensaio.invalid' and u.email <> 'ensaio.f3.admin@ensaio.invalid';
  insert into public."TB_PERMISSAO_RECURSO" (perfil_usuario_id, recurso, nivel, updated_by)
  select u.id, 'avaliacao_documental', x.nivel, '00000000-0000-4000-a000-0000000f3a01'
    from (values ('ensaio.f3.ana@ensaio.invalid', 'editor'), ('ensaio.f3.beto@ensaio.invalid', 'editor'),
                 ('ensaio.f3.leitor@ensaio.invalid', 'leitor')) x(email, nivel)
    join public."TB_PERFIL_USUARIO" u on u.email = x.email;
  -- Ana analisa o edital todo; Beto, só a vaga sintética.
  insert into public."RL_ANALISTA_EDITAL" ("CO_MONITORAMENTO", "CO_USUARIO", "TP_PAPEL", "CO_VAGA", "CO_USUARIO_ATUALIZACAO") values
    (v_edital, '00000000-0000-4000-a000-0000000f3a03', 'ANALISTA', null, '00000000-0000-4000-a000-0000000f3a01'),
    (v_edital, '00000000-0000-4000-a000-0000000f3a04', 'ANALISTA', '99999101', '00000000-0000-4000-a000-0000000f3a01');

  select r."CO_REGRA_ANALISE", r."NU_VERSAO_VIGENTE" into v_regra, v_versao
    from public."TB_REGRA_ANALISE" r where r."CO_MONITORAMENTO" = v_edital;
  if v_regra is null then
    insert into public."TB_REGRA_ANALISE" ("CO_MONITORAMENTO", "NU_VERSAO_VIGENTE", "TP_SITUACAO", "CO_USUARIO_ATUALIZACAO")
    values (v_edital, 1, 'CONFERIR', '00000000-0000-4000-a000-0000000f3a01')
    returning "CO_REGRA_ANALISE" into v_regra;
    v_versao := 1;
  else
    v_versao := v_versao + 1;
  end if;
  insert into public."TH_REGRA_ANALISE" ("CO_REGRA_ANALISE", "NU_VERSAO", "DS_CONFIGURACAO", "DS_HASH", "DS_MOTIVO", "CO_USUARIO")
  values (v_regra, v_versao, v_config, encode(sha256(convert_to(v_config::text, 'UTF8')), 'hex'),
          'Versão do ensaio da fase F3', '00000000-0000-4000-a000-0000000f3a01');
  update public."TB_REGRA_ANALISE" set "NU_VERSAO_VIGENTE" = v_versao, "TP_SITUACAO" = 'CONFERIDA',
         "CO_USUARIO_CONFERENCIA" = '00000000-0000-4000-a000-0000000f3a01', "DT_CONFERENCIA" = now()
   where "CO_REGRA_ANALISE" = v_regra;
  perform set_config('ensaio.versao', v_versao::text, true);
  perform set_config('ensaio.regra', v_regra::text, true);
  raise notice 'ok E2: edital %, vaga sintética com 6 inscritos, regra v% conferida (Pegar próximo), Ana (edital todo) e Beto (só a vaga)', v_edital, v_versao;
end;
$$;

-- E3. O job: grava o lote (4), lê a distribuição e abre as fichas.
do $$
declare
  v_edital uuid := current_setting('ensaio.edital')::uuid;
  v_versao integer := current_setting('ensaio.versao')::integer;
  v jsonb;
  c_linha constant text := '{"id":"00000000-0000-4000-a000-0000000f300%s","situacao":"%s","posicao":%s,"posicao_modalidade":%s,"lote":%s,"lista_lote":%s,"entrada":%s,"motivo_entrada":%s,"art":%s,"nota":%s,"origem_nota":"ART","modalidade":"AC","motivo_codigo":%s,"motivo":%s}';
begin
  perform public.iniciar_pre_classificacao('ensaio-precl-f3-0001', 'GITHUB');
  perform public.gravar_pre_classificacao_vaga('ensaio-precl-f3-0001', v_edital, '99999101', v_versao,
    '{"tamanho":4,"descricao":"4 (número fixo)","avisos":[]}'::jsonb,
    jsonb_build_array(
      format(c_linha, 1, 'NO_LOTE', 1, 1, 1, '"GERAL"', '"INICIAL"', '"Lote inicial"', 29, 29, 'null', 'null')::jsonb,
      format(c_linha, 2, 'NO_LOTE', 2, 2, 1, '"GERAL"', '"INICIAL"', '"Lote inicial"', 27, 27, 'null', 'null')::jsonb,
      format(c_linha, 3, 'NO_LOTE', 3, 3, 1, '"GERAL"', '"INICIAL"', '"Lote inicial"', 25, 25, 'null', 'null')::jsonb,
      format(c_linha, 4, 'NO_LOTE', 4, 4, 1, '"GERAL"', '"INICIAL"', '"Lote inicial"', 22, 22, 'null', 'null')::jsonb,
      format(c_linha, 5, 'RANQUEADO', 5, 5, 'null', 'null', 'null', 'null', 20, 20, 'null', 'null')::jsonb,
      format(c_linha, 6, 'ELIMINADO', 'null', 'null', 'null', 'null', 'null', 'null', 10, 10, '"CANCELADO"', '"Cancelou a inscrição"')::jsonb));

  v := public.pre_classificacao_ler_distribuicao(v_edital);
  if jsonb_array_length(v -> 'a_abrir') < 4 or v ->> 'modo' <> 'PEGAR_PROXIMO' or (v ->> 'distribuicao_iniciada')::boolean
     or jsonb_array_length(v -> 'analistas') <> 2 or v::text ~ 'Ensaio F3' then
    raise exception 'FALHOU E3: leitura da distribuição %', v;
  end if;
  v := public.abrir_fichas_pre_classificacao('ensaio-precl-f3-0001', v_edital, '[]'::jsonb);
  if (v ->> 'criadas')::int < 4 then raise exception 'FALHOU E3: fichas criadas %', v; end if;
  v := public.abrir_fichas_pre_classificacao('ensaio-precl-f3-0001', v_edital, '[]'::jsonb);
  if (v ->> 'criadas')::int <> 0 then raise exception 'FALHOU E3: rodar de novo criou de novo %', v; end if;
  begin
    perform public.abrir_fichas_pre_classificacao('ensaio-precl-f3-0001', v_edital,
      '[{"candidato":"00000000-0000-4000-a000-0000000f3001","usuario":"00000000-0000-4000-a000-0000000f3a03"}]'::jsonb);
    raise exception 'FALHOU E3: atribuiu ficha que não foi aberta agora';
  exception when sqlstate '22023' then null;
  end;
  perform public.finalizar_pre_classificacao('ensaio-precl-f3-0001', '[]'::jsonb, null);
  begin
    perform public.abrir_fichas_pre_classificacao('ensaio-precl-f3-0001', v_edital, '[]'::jsonb);
    raise exception 'FALHOU E3: abriu fichas com a execução fechada';
  exception when sqlstate '22023' then null;
  end;
  raise notice 'ok E3: o job grava o lote, lê a distribuição sem nomes, abre 4 fichas (rodar de novo não duplica); atribuição fora das fichas novas e execução fechada recusadas';
end;
$$;

-- E4. A tela, como cada pessoa (papel authenticated).
set local role authenticated;
do $$
declare
  c_gestor constant text := '{"sub":"00000000-0000-4000-a000-0000000f3a02","role":"authenticated","email":"ensaio.f3.gestor@ensaio.invalid"}';
  c_ana constant text := '{"sub":"00000000-0000-4000-a000-0000000f3a03","role":"authenticated","email":"ensaio.f3.ana@ensaio.invalid"}';
  c_beto constant text := '{"sub":"00000000-0000-4000-a000-0000000f3a04","role":"authenticated","email":"ensaio.f3.beto@ensaio.invalid"}';
  c_leitor constant text := '{"sub":"00000000-0000-4000-a000-0000000f3a05","role":"authenticated","email":"ensaio.f3.leitor@ensaio.invalid"}';
  c_sem constant text := '{"sub":"00000000-0000-4000-a000-0000000f3a06","role":"authenticated","email":"ensaio.f3.sem@ensaio.invalid"}';
  u_ana constant uuid := '00000000-0000-4000-a000-0000000f3a03';
  u_beto constant uuid := '00000000-0000-4000-a000-0000000f3a04';
  u_leitor constant uuid := '00000000-0000-4000-a000-0000000f3a05';
  v_edital uuid := current_setting('ensaio.edital')::uuid;
  v json;
  v_f1 uuid;
  v_f2 uuid;
  v_f3 uuid;
  v_f4 uuid;
  v_versao integer;
begin
  perform set_config('request.jwt.claims', c_sem, true);
  begin
    perform public.obter_fila_avaliacao(v_edital);
    raise exception 'FALHOU E4: sem acesso leu a fila';
  exception when sqlstate '42501' then null;
  end;

  perform set_config('request.jwt.claims', c_leitor, true);
  v := public.obter_fila_avaliacao(v_edital);
  if (v ->> 'pode_coordenar')::boolean or (v ->> 'pode_pegar')::boolean
     or (select count(*) from json_array_elements(v -> 'candidatos') c where c ->> 'vaga' = '99999101') <> 6
     or (select count(*) from json_array_elements(v -> 'candidatos') c where c ->> 'vaga' = '99999101' and c -> 'ficha' ->> 'id' is not null) <> 4 then
    raise exception 'FALHOU E4: fila do leitor %', v;
  end if;
  if exists (select 1 from json_array_elements(v -> 'candidatos') c where c::text ~ '00000000000') then
    raise exception 'FALHOU E4: CPF na fila';
  end if;
  select (c -> 'ficha' ->> 'id')::uuid into v_f1 from json_array_elements(v -> 'candidatos') c where c ->> 'codigo' = 'F3E0001';
  select (c -> 'ficha' ->> 'id')::uuid into v_f2 from json_array_elements(v -> 'candidatos') c where c ->> 'codigo' = 'F3E0002';
  select (c -> 'ficha' ->> 'id')::uuid into v_f3 from json_array_elements(v -> 'candidatos') c where c ->> 'codigo' = 'F3E0003';
  select (c -> 'ficha' ->> 'id')::uuid into v_f4 from json_array_elements(v -> 'candidatos') c where c ->> 'codigo' = 'F3E0004';
  begin
    perform public.pegar_proxima_ficha(v_edital, '99999101');
    raise exception 'FALHOU E4: leitor pegou ficha';
  exception when sqlstate '42501' then null;
  end;
  v := public.reservar_ficha(v_f1);
  if (v ->> 'reservada')::boolean then raise exception 'FALHOU E4: leitor reservou'; end if;
  raise notice 'ok E4.1: sem acesso não lê; o leitor lê 6 inscritos e 4 fichas, sem CPF, e não pega nem reserva';

  -- Pegar próximo: duas pessoas nunca recebem a mesma, na ordem da Provisória (AM-6.1).
  perform set_config('request.jwt.claims', c_ana, true);
  v := public.pegar_proxima_ficha(v_edital, '99999101');
  if (v -> 'ficha' ->> 'id')::uuid <> v_f1 or not (v ->> 'reservada')::boolean or v -> 'ficha' -> 'reserva' ->> 'nome' <> 'Ensaio F3 Ana' then
    raise exception 'FALHOU E4: Ana pegou %', v;
  end if;
  perform set_config('request.jwt.claims', c_beto, true);
  v := public.pegar_proxima_ficha(v_edital, '99999101');
  if (v -> 'ficha' ->> 'id')::uuid <> v_f2 then raise exception 'FALHOU E4: Beto pegou % (esperado a 2ª)', v; end if;
  v := public.reservar_ficha(v_f1);
  if (v ->> 'reservada')::boolean or v ->> 'motivo' <> 'Em uso por outra pessoa.' or v -> 'ficha' -> 'reserva' ->> 'nome' <> 'Ensaio F3 Ana' then
    raise exception 'FALHOU E4: Beto abriu a ficha da Ana %', v;
  end if;
  begin
    perform public.renovar_reserva(v_f1);
    raise exception 'FALHOU E4: Beto renovou a reserva da Ana';
  exception when sqlstate '40001' then null;
  end;
  begin
    perform public.liberar_reserva(v_edital, array[v_f1], 'Tentativa do ensaio');
    raise exception 'FALHOU E4: analista liberou a reserva de outra pessoa';
  exception when sqlstate '42501' then null;
  end;
  perform set_config('request.jwt.claims', c_ana, true);
  v := public.renovar_reserva(v_f1);
  if (v -> 'ficha' -> 'reserva' ->> 'expira')::timestamptz <= now() then raise exception 'FALHOU E4: renovação %', v; end if;
  v := public.liberar_reserva(v_edital, array[v_f1], null);
  if (v ->> 'liberadas')::int <> 1 then raise exception 'FALHOU E4: Ana não liberou a própria %', v; end if;
  raise notice 'ok E4.2: Ana pega a 1ª e Beto a 2ª; Beto vê "Em uso por Ensaio F3 Ana" só para leitura, não renova nem libera; Ana renova e libera';

  -- Coordenação: distribuir, redistribuir com motivo, versão velha, liberar reserva presa, revisão.
  perform set_config('request.jwt.claims', c_gestor, true);
  v := public.obter_fila_avaliacao(v_edital);
  if not (v ->> 'pode_coordenar')::boolean then raise exception 'FALHOU E4: gestor sem coordenação'; end if;
  select (c -> 'ficha' ->> 'versao')::int into v_versao from json_array_elements(v -> 'candidatos') c where c ->> 'codigo' = 'F3E0003';
  v := public.distribuir_fichas(v_edital, json_build_array(json_build_object('ficha', v_f3, 'versao', v_versao, 'usuario', u_beto))::jsonb, null);
  if (v ->> 'alteradas')::int <> 1 then raise exception 'FALHOU E4: distribuição %', v; end if;
  begin
    perform public.distribuir_fichas(v_edital, json_build_array(json_build_object('ficha', v_f3, 'versao', v_versao, 'usuario', u_ana))::jsonb, 'Motivo do ensaio');
    raise exception 'FALHOU E4: aceitou versão velha';
  exception when sqlstate '40001' then null;
  end;
  begin
    perform public.distribuir_fichas(v_edital, json_build_array(json_build_object('ficha', v_f3, 'versao', v_versao + 1, 'usuario', u_ana))::jsonb, null);
    raise exception 'FALHOU E4: redistribuiu sem motivo';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.distribuir_fichas(v_edital, json_build_array(json_build_object('ficha', v_f3, 'versao', v_versao + 1, 'usuario', u_leitor))::jsonb, 'Motivo do ensaio');
    raise exception 'FALHOU E4: distribuiu para quem não analisa';
  exception when sqlstate '22023' then null;
  end;
  perform set_config('request.jwt.claims', c_beto, true);
  v := public.reservar_ficha(v_f3);
  if not (v ->> 'reservada')::boolean or v -> 'ficha' ->> 'situacao' <> 'EM_ANALISE' then raise exception 'FALHOU E4: Beto não abriu a sua %', v; end if;
  perform set_config('request.jwt.claims', c_gestor, true);
  begin
    perform public.liberar_reserva(v_edital, array[v_f3], null);
    raise exception 'FALHOU E4: liberou reserva de outra pessoa sem motivo';
  exception when sqlstate '22023' then null;
  end;
  v := public.liberar_reserva(v_edital, array[v_f3], 'Reserva presa no ensaio');
  if (v ->> 'liberadas')::int <> 1 then raise exception 'FALHOU E4: coordenação não liberou %', v; end if;
  select (c -> 'ficha' ->> 'versao')::int into v_versao from json_array_elements(public.obter_fila_avaliacao(v_edital) -> 'candidatos') c where c ->> 'codigo' = 'F3E0004';
  begin
    perform public.mandar_fichas_revisao(v_edital, json_build_array(json_build_object('ficha', v_f4, 'versao', v_versao))::jsonb, 'curto');
    raise exception 'FALHOU E4: revisão sem motivo';
  exception when sqlstate '22023' then null;
  end;
  perform public.mandar_fichas_revisao(v_edital, json_build_array(json_build_object('ficha', v_f4, 'versao', v_versao))::jsonb, 'Conferência da coordenação no ensaio');
  select (c -> 'ficha' ->> 'versao')::int into v_versao from json_array_elements(public.obter_fila_avaliacao(v_edital) -> 'candidatos') c where c ->> 'codigo' = 'F3E0004';
  begin
    perform public.distribuir_fichas(v_edital, json_build_array(json_build_object('ficha', v_f4, 'versao', v_versao, 'usuario', null))::jsonb, 'Devolver à fila no ensaio');
  exception when others then raise exception 'FALHOU E4: devolver à fila a ficha em revisão: %', sqlerrm;
  end;
  raise notice 'ok E4.3: a coordenação distribui; versão velha (40001), sem motivo e pessoa fora da vaga recusados; libera a reserva presa com motivo; manda para revisão e devolve à fila';

  -- Filtros salvos, por pessoa.
  perform set_config('request.jwt.claims', c_ana, true);
  v := public.salvar_filtro_fila('Minhas pendentes', '{"etapa":"pendentes","responsavel":"eu"}');
  v := public.salvar_filtro_fila('minhas pendentes', '{"etapa":"em_analise","responsavel":"eu"}');
  if json_array_length(v) <> 1 or v -> 0 -> 'filtro' ->> 'etapa' <> 'em_analise' then raise exception 'FALHOU E4: filtro salvo %', v; end if;
  begin
    perform public.salvar_filtro_fila('', '{}');
    raise exception 'FALHOU E4: filtro sem nome';
  exception when sqlstate '22023' then null;
  end;
  perform set_config('request.jwt.claims', c_beto, true);
  if json_array_length(public.obter_fila_avaliacao(v_edital) -> 'filtros') <> 0 then raise exception 'FALHOU E4: Beto vê filtro da Ana'; end if;
  begin
    perform public.excluir_filtro_fila((v -> 0 ->> 'id')::uuid);
    raise exception 'FALHOU E4: Beto excluiu filtro da Ana';
  exception when sqlstate '22023' then null;
  end;
  perform set_config('request.jwt.claims', c_ana, true);
  v := public.excluir_filtro_fila((v -> 0 ->> 'id')::uuid);
  if json_array_length(v) <> 0 then raise exception 'FALHOU E4: exclusão do filtro'; end if;
  raise notice 'ok E4.4: filtro salvo por nome (troca sem duplicar), só o dono vê e exclui';
  perform set_config('ensaio.f3', v_f3::text, true);
end;
$$;
reset role;

-- E5. Depois do reset role: equipe, refazer o lote, a linha anda, histórico e nada se apaga.
do $$
declare
  v_edital uuid := current_setting('ensaio.edital')::uuid;
  v_versao integer := current_setting('ensaio.versao')::integer;
  v jsonb;
  v_qt integer;
  c_linha constant text := '{"id":"00000000-0000-4000-a000-0000000f300%s","situacao":"%s","posicao":%s,"posicao_modalidade":%s,"lote":%s,"lista_lote":%s,"entrada":%s,"motivo_entrada":%s,"art":%s,"nota":%s,"origem_nota":"ART","modalidade":"AC","motivo_codigo":%s,"motivo":%s}';
begin
  -- AM-3.3: Beto tem a ficha 3; tirá-lo da equipe é recusado.
  set constraints "TG_ANALISTAEDT_FICHAS" immediate;
  begin
    update public."RL_ANALISTA_EDITAL" set "ST_ATIVO" = 'N', "DS_MOTIVO_ATUALIZACAO" = 'Saída do ensaio'
     where "CO_MONITORAMENTO" = v_edital and "CO_USUARIO" = '00000000-0000-4000-a000-0000000f3a04';
    raise exception 'FALHOU E5: tirou da equipe quem tem ficha aberta';
  exception when sqlstate '22023' then null;
  end;
  set constraints "TG_ANALISTAEDT_FICHAS" deferred;

  -- Refazer o lote não tira quem tem ficha.
  begin
    update public."TB_PRE_CLASSIFICACAO" set "TP_SITUACAO" = 'RANQUEADO', "NU_LOTE" = null, "CO_LISTA_LOTE" = null,
           "TP_ENTRADA_LOTE" = null, "DS_MOTIVO_ENTRADA" = null, "DT_ENTRADA_LOTE" = null
     where "CO_MONITORAMENTO" = v_edital and "CO_EMPREGARE_CANDIDATO" = '00000000-0000-4000-a000-0000000f3002';
    raise exception 'FALHOU E5: refazer o lote tirou quem tem ficha';
  exception when sqlstate '22023' then null;
  end;

  -- A linha anda: o 1º sai eliminado e o 5º entra no lote 2; a ficha nova vai para a Ana.
  perform public.iniciar_pre_classificacao('ensaio-precl-f3-0002', 'GITHUB');
  perform public.gravar_pre_classificacao_vaga('ensaio-precl-f3-0002', v_edital, '99999101', v_versao,
    '{"tamanho":4,"descricao":"4 (número fixo)","avisos":[]}'::jsonb,
    jsonb_build_array(
      format(c_linha, 1, 'ELIMINADO', 'null', 'null', 'null', 'null', 'null', 'null', 29, 29, '"CANCELADO"', '"Cancelou a inscrição"')::jsonb,
      format(c_linha, 2, 'NO_LOTE', 1, 1, 1, '"GERAL"', '"INICIAL"', '"Lote inicial"', 27, 27, 'null', 'null')::jsonb,
      format(c_linha, 3, 'NO_LOTE', 2, 2, 1, '"GERAL"', '"INICIAL"', '"Lote inicial"', 25, 25, 'null', 'null')::jsonb,
      format(c_linha, 4, 'NO_LOTE', 3, 3, 1, '"GERAL"', '"INICIAL"', '"Lote inicial"', 22, 22, 'null', 'null')::jsonb,
      format(c_linha, 5, 'NO_LOTE', 4, 4, 2, '"GERAL"', '"REPOSICAO"', '"Entrou no lugar de F3E0001 (Cancelou a inscrição)"', 20, 20, 'null', 'null')::jsonb,
      format(c_linha, 6, 'ELIMINADO', 'null', 'null', 'null', 'null', 'null', 'null', 10, 10, '"CANCELADO"', '"Cancelou a inscrição"')::jsonb));
  v := public.abrir_fichas_pre_classificacao('ensaio-precl-f3-0002', v_edital,
    '[{"candidato":"00000000-0000-4000-a000-0000000f3005","usuario":"00000000-0000-4000-a000-0000000f3a03"}]'::jsonb);
  if (v ->> 'criadas')::int < 1 or (v ->> 'fora_do_lote')::int <> 1 or (v ->> 'atribuidas')::int <> 1 then
    raise exception 'FALHOU E5: a linha anda %', v;
  end if;
  perform public.finalizar_pre_classificacao('ensaio-precl-f3-0002', '[]'::jsonb, null);
  if (select "TP_SITUACAO" || '|' || "DS_MOTIVO_SAIDA" from public."TB_FICHA_ANALISE"
       where "CO_MONITORAMENTO" = v_edital and "CO_EMPREGARE_CANDIDATO" = '00000000-0000-4000-a000-0000000f3001')
     is distinct from 'FORA_LOTE|Cancelou a inscrição' then
    raise exception 'FALHOU E5: quem saiu eliminado não ficou FORA_LOTE com o motivo';
  end if;
  if (select "CO_USUARIO_RESPONSAVEL" from public."TB_FICHA_ANALISE"
       where "CO_MONITORAMENTO" = v_edital and "CO_EMPREGARE_CANDIDATO" = '00000000-0000-4000-a000-0000000f3005')
     is distinct from '00000000-0000-4000-a000-0000000f3a03'::uuid then
    raise exception 'FALHOU E5: a ficha nova não foi para a Ana';
  end if;

  -- Histórico: as transições com o motivo.
  select count(*) into v_qt from public."TH_FICHA_ANALISE" h
    join public."TB_FICHA_ANALISE" f on f."CO_FICHA_ANALISE" = h."CO_FICHA_ANALISE"
   where f."CO_MONITORAMENTO" = v_edital and f."CO_VAGA" = '99999101';
  if v_qt < 14 then raise exception 'FALHOU E5: só % registros no histórico', v_qt; end if;
  if not exists (select 1 from public."TH_FICHA_ANALISE" where "CO_FICHA_ANALISE" = current_setting('ensaio.f3')::uuid
                   and "TP_ACAO" = 'LIBERAR_RESERVA' and "DS_MOTIVO" = 'Reserva presa no ensaio') then
    raise exception 'FALHOU E5: liberação da reserva presa sem histórico';
  end if;
  if (select count(*) from public."TL_ACESSO_FICHA_ANALISE" a join public."TB_FICHA_ANALISE" f on f."CO_FICHA_ANALISE" = a."CO_FICHA_ANALISE"
       where f."CO_MONITORAMENTO" = v_edital) < 4 then
    raise exception 'FALHOU E5: acessos não registrados';
  end if;
  begin
    delete from public."TB_FICHA_ANALISE" where "CO_MONITORAMENTO" = v_edital;
    raise exception 'FALHOU E5: apagou ficha';
  exception when sqlstate '42501' then null;
  end;
  begin
    update public."TH_FICHA_ANALISE" set "DS_MOTIVO" = 'x' where "CO_FICHA_ANALISE" = current_setting('ensaio.f3')::uuid;
    raise exception 'FALHOU E5: mudou o histórico';
  exception when sqlstate '42501' then null;
  end;
  raise notice 'ok E5: analista com ficha não sai da equipe (AM-3.3); refazer não tira quem tem ficha; a linha anda (FORA_LOTE com motivo, ficha nova para a Ana); histórico e acessos gravados; nada se apaga';
end;
$$;

-- E6. Distribuição inicial: ficha livre não se pega; as suas sim.
do $$
declare
  v_regra uuid := current_setting('ensaio.regra')::uuid;
  v_versao integer := current_setting('ensaio.versao')::integer + 1;
  v_config jsonb;
begin
  select h."DS_CONFIGURACAO" || '{"distribuicao":{"modo":"DISTRIBUICAO_INICIAL","criterio":"PARTES_IGUAIS","novos":"MENOS_PENDENTES"}}'::jsonb
    into v_config from public."TH_REGRA_ANALISE" h where h."CO_REGRA_ANALISE" = v_regra and h."NU_VERSAO" = v_versao - 1;
  insert into public."TH_REGRA_ANALISE" ("CO_REGRA_ANALISE", "NU_VERSAO", "DS_CONFIGURACAO", "DS_HASH", "DS_MOTIVO", "CO_USUARIO")
  values (v_regra, v_versao, v_config, encode(sha256(convert_to(v_config::text, 'UTF8')), 'hex'),
          'Distribuição inicial no ensaio', '00000000-0000-4000-a000-0000000f3a01');
  update public."TB_REGRA_ANALISE" set "NU_VERSAO_VIGENTE" = v_versao where "CO_REGRA_ANALISE" = v_regra;
end;
$$;
set local role authenticated;
do $$
declare
  v_edital uuid := current_setting('ensaio.edital')::uuid;
  v json;
begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-0000000f3a03","role":"authenticated","email":"ensaio.f3.ana@ensaio.invalid"}', true);
  v := public.reservar_ficha((select (c -> 'ficha' ->> 'id')::uuid from json_array_elements(public.obter_fila_avaliacao(v_edital) -> 'candidatos') c
                               where c ->> 'codigo' = 'F3E0004'));
  if (v ->> 'reservada')::boolean or v ->> 'motivo' not like 'Ficha livre%' then raise exception 'FALHOU E6: pegou ficha livre na distribuição inicial %', v; end if;
  v := public.pegar_proxima_ficha(v_edital, '99999101');
  if v -> 'ficha' ->> 'codigo' <> 'F3E0005' then raise exception 'FALHOU E6: Ana devia pegar a sua (a 5ª) %', v; end if;
  raise notice 'ok E6: na distribuição inicial o analista pega as suas, não as livres';
end;
$$;
reset role;

select 'ENSAIO OK' as resultado;

rollback;
