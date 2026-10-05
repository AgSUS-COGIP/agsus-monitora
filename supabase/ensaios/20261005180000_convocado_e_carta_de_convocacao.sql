/*
  ENSAIO de 20261005180000_convocado_e_carta_de_convocacao.sql — begin … rollback.

  Como rodar: cole o arquivo inteiro no SQL Editor do Supabase (papel postgres)
  e execute. Ele abre uma transação, aplica o corpo da migration (copiado sem
  mudança, sem o begin/commit dela) e percorre:
    E1  estrutura: tabelas novas com RLS e sem grant, as 8 RPCs SECURITY
        DEFINER com search_path vazio, a alterar_status de 4 argumentos fora,
        o domínio do status com Convocado e sem Fim de Fila, o gatilho;
    E2  atores sintéticos (editor = edital_gestor, leitor = usuario, admin),
        um edital real sem lista de aprovados, uma lista antiga (substituída)
        com um convocado e uma carta já emitida, e a lista vigente com seis
        candidatos (um contratado e um que veio da lista antiga);
    E3  pelas RPCs (papel authenticated): o leitor lê e não escreve (42501);
        o editor cria o modelo, a 2ª versão pede motivo, versão errada = 40001,
        nome repetido = 23505; Fim de Fila recusado; Convocado com data (nunca
        futura) e, do Convocado, o editor segue para Contratado mas não tira o
        status (o admin tira, e a data some); a carta registrada (recusas:
        agrupamento, versão, lista substituída, modelo de outro edital) e a
        marcação dos convocáveis por ela (o contratado fica de fora); o
        histórico do candidato (também da lista antiga) e as convocações da
        área; inativar pede motivo e tira o modelo da emissão e da edição;
    E4  (depois do reset role) o que ficou gravado: datas, gatilho, marcação
        ligada à carta, candidatos da carta, registro da emissão, versões do
        modelo, e o banco recusando Fim de Fila e Convocado sem data.
  Termina em ROLLBACK: nada fica gravado.

  Resultado esperado: "ok E1" … "ok E4" e a linha "ENSAIO OK" do SELECT final.
  Qualquer "FALHOU …" interrompe e desfaz tudo; copie a mensagem.

  Mantenha em sincronia: tests/convocado-e-carta-de-convocacao-migration.test.js
  confere que o corpo da migration aqui é idêntico ao do arquivo da migration.
*/
begin;

-- ═══ CORPO DA MIGRATION (início) ═══
-- 0. Pré-requisitos -----------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.publicar_lista_aprovados_da_classificacao(uuid, uuid, jsonb)') is null then
    raise exception 'Aplique antes 20261005160000_lista_de_aprovados_da_classificacao.sql.';
  end if;
  if to_regprocedure('public.alterar_status_candidato_aprovado(uuid, text, text, text)') is null then
    raise exception 'Aplique antes 20260930200000_aprovados_por_grupo_edital_gestor_edita.sql.';
  end if;
  if to_regprocedure('private.autor_da_sessao()') is null then
    raise exception 'Aplique antes 20260928180000_autoria_e_trava_da_lista_de_aprovados.sql.';
  end if;
  -- Ninguém usa "Fim de Fila" (conferido em 05/10/2026); se alguém usar, a troca é manual.
  if exists (select 1 from public."TB_CANDIDATO_APROVADO" where status = 'Fim de Fila') then
    raise exception 'Há candidatos com status Fim de Fila: troque o status deles antes de aplicar.';
  end if;
end;
$$;

-- 1. Status: entra Convocado (com a data), sai Fim de Fila ----------------------------------------
alter table public."TB_CANDIDATO_APROVADO"
  drop constraint "CK_CANDIDATO_APROVADO_STATUS";
alter table public."TB_CANDIDATO_APROVADO"
  add column "DT_CONVOCACAO" date,
  add constraint "CK_CANDIDATO_APROVADO_STATUS" check (
    status is null
    or status in ('Convocado', 'Contratado', 'Desistente', 'Migração', 'Documentação Rejeitada')
  ),
  add constraint "CK_CANDAPROVADO_DTCONVOCACAO" check (
    ("DT_CONVOCACAO" is null or status is not null)
    and (status is distinct from 'Convocado' or "DT_CONVOCACAO" is not null)
  );
comment on column public."TB_CANDIDATO_APROVADO".status is
  'Situação do candidato: Convocado (chamado para a contratação, aguardando apresentação e documentos; leva DT_CONVOCACAO), Contratado, Desistente, Migração ou Documentação Rejeitada. Nulo = sem status. Contratados (Seleção e KPIs) são só Contratado e Migração.';
comment on column public."TB_CANDIDATO_APROVADO"."DT_CONVOCACAO" is
  'Data em que o candidato foi convocado para a contratação. Fica depois que ele segue para Contratado, Desistente ou Documentação Rejeitada; some quando o status volta a nulo. A publicação de uma lista nova a herda do candidato anterior (TG_CANDAPROVADO_CONVOCACAO).';
comment on constraint "CK_CANDIDATO_APROVADO_STATUS" on public."TB_CANDIDATO_APROVADO" is
  'Status válidos (Fim de Fila saiu em 20261005180000).';
comment on constraint "CK_CANDAPROVADO_DTCONVOCACAO" on public."TB_CANDIDATO_APROVADO" is
  'Data da convocação só com status; Convocado sempre com a data.';
create index "IN_CANDAPROVADO_DTCONVOCACAO" on public."TB_CANDIDATO_APROVADO" ("DT_CONVOCACAO")
  where "DT_CONVOCACAO" is not null;
comment on index public."IN_CANDAPROVADO_DTCONVOCACAO" is 'Candidatos convocados (listar_convocacoes_aprovados).';

-- A lista nova publicada da Classificação leva o status; a data vem junto.
create function private."FC_TG_HERDAR_CONVOCACAO"()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if new."CO_CANDIDATO_ANTERIOR" is not null and new."DT_CONVOCACAO" is null and new.status is not null then
    select c."DT_CONVOCACAO" into new."DT_CONVOCACAO"
      from public."TB_CANDIDATO_APROVADO" c
     where c.id = new."CO_CANDIDATO_ANTERIOR";
  end if;
  return new;
end;
$function$;
comment on function private."FC_TG_HERDAR_CONVOCACAO"() is
  'Gatilho: candidato inserido com CO_CANDIDATO_ANTERIOR e status herda a data da convocação do anterior (publicação da lista da Classificação).';
revoke all on function private."FC_TG_HERDAR_CONVOCACAO"() from public, anon, authenticated;
create trigger "TG_CANDAPROVADO_CONVOCACAO"
  before insert on public."TB_CANDIDATO_APROVADO"
  for each row execute function private."FC_TG_HERDAR_CONVOCACAO"();
comment on trigger "TG_CANDAPROVADO_CONVOCACAO" on public."TB_CANDIDATO_APROVADO" is
  'Herda DT_CONVOCACAO do candidato anterior (FC_TG_HERDAR_CONVOCACAO).';

-- 2. Modelos da carta de convocação (por área e, se quiser, por edital), versionados -----------------
create table public."TB_MODELO_CARTA_CONVOCACAO" (
  "CO_MODELO_CARTA" uuid not null default gen_random_uuid(),
  "CO_AREA" text not null,
  "CO_MONITORAMENTO" uuid,
  "NO_MODELO" varchar(120) not null,
  "NU_VERSAO_VIGENTE" integer not null,
  "ST_ATIVO" boolean not null default true,
  "DS_MOTIVO_SITUACAO" varchar(500),
  "CO_USUARIO_CRIACAO" uuid,
  "CO_USUARIO_ATUALIZACAO" uuid,
  "DT_CRIACAO" timestamptz not null default now(),
  "DT_ATUALIZACAO" timestamptz not null default now(),
  constraint "PK_TB_MODELO_CARTA_CONVOCACAO" primary key ("CO_MODELO_CARTA"),
  constraint "FK_AREA_MODELOCARTA" foreign key ("CO_AREA") references public."TB_AREA" ("CO_AREA"),
  constraint "FK_MONITORAMENTO_MODELOCARTA" foreign key ("CO_MONITORAMENTO") references public."TB_MONITORAMENTO_INDIGENA" (id),
  constraint "CK_MODELOCARTA_NOMODELO" check (length(btrim("NO_MODELO")) between 3 and 120),
  constraint "CK_MODELOCARTA_NUVERSAO" check ("NU_VERSAO_VIGENTE" >= 1),
  constraint "CK_MODELOCARTA_MOTIVO" check ("DS_MOTIVO_SITUACAO" is null or length("DS_MOTIVO_SITUACAO") between 3 and 500)
);
comment on table public."TB_MODELO_CARTA_CONVOCACAO" is
  'Modelo da carta de convocação para contratação, da área (CO_MONITORAMENTO nulo) ou de um edital. O texto fica em cada versão (TH_MODELO_CARTA_CONVOCACAO); aqui, a versão vigente e se está ativo. Nada se apaga: inativa-se.';
comment on column public."TB_MODELO_CARTA_CONVOCACAO"."CO_MODELO_CARTA" is 'Identificador do modelo.';
comment on column public."TB_MODELO_CARTA_CONVOCACAO"."CO_AREA" is 'Área dona do modelo (TB_AREA).';
comment on column public."TB_MODELO_CARTA_CONVOCACAO"."CO_MONITORAMENTO" is 'Edital do modelo (TB_MONITORAMENTO_INDIGENA.id); nulo = vale para todos os editais da área.';
comment on column public."TB_MODELO_CARTA_CONVOCACAO"."NO_MODELO" is 'Nome do modelo (3 a 120 caracteres), único entre os ativos da área/edital.';
comment on column public."TB_MODELO_CARTA_CONVOCACAO"."NU_VERSAO_VIGENTE" is 'Versão vigente (TH_MODELO_CARTA_CONVOCACAO.NU_VERSAO). Salvar cria a próxima.';
comment on column public."TB_MODELO_CARTA_CONVOCACAO"."ST_ATIVO" is 'Ativo: aparece para emitir. Inativo continua no histórico das cartas.';
comment on column public."TB_MODELO_CARTA_CONVOCACAO"."DS_MOTIVO_SITUACAO" is 'Por que foi inativado ou reativado (3 a 500 caracteres).';
comment on column public."TB_MODELO_CARTA_CONVOCACAO"."CO_USUARIO_CRIACAO" is 'Quem criou (auth.users.id).';
comment on column public."TB_MODELO_CARTA_CONVOCACAO"."CO_USUARIO_ATUALIZACAO" is 'Quem salvou a última versão ou mudou a situação (auth.users.id).';
comment on column public."TB_MODELO_CARTA_CONVOCACAO"."DT_CRIACAO" is 'Primeira versão.';
comment on column public."TB_MODELO_CARTA_CONVOCACAO"."DT_ATUALIZACAO" is 'Última versão salva ou mudança de situação.';
comment on constraint "FK_AREA_MODELOCARTA" on public."TB_MODELO_CARTA_CONVOCACAO" is 'Área do modelo (MODELOCARTA = MODELO_CARTA_CONVOCACAO).';
comment on constraint "FK_MONITORAMENTO_MODELOCARTA" on public."TB_MODELO_CARTA_CONVOCACAO" is 'Edital do modelo, quando é de um edital.';
comment on constraint "CK_MODELOCARTA_NOMODELO" on public."TB_MODELO_CARTA_CONVOCACAO" is 'Nome entre 3 e 120 caracteres.';
comment on constraint "CK_MODELOCARTA_NUVERSAO" on public."TB_MODELO_CARTA_CONVOCACAO" is 'Versões começam em 1.';
comment on constraint "CK_MODELOCARTA_MOTIVO" on public."TB_MODELO_CARTA_CONVOCACAO" is 'Motivo da situação entre 3 e 500 caracteres.';
create index "IN_FKMODELOCARTA_AREA" on public."TB_MODELO_CARTA_CONVOCACAO" ("CO_AREA");
comment on index public."IN_FKMODELOCARTA_AREA" is 'Chave estrangeira para TB_AREA (modelos da área).';
create index "IN_FKMODELOCARTA_MONITORAMENTO" on public."TB_MODELO_CARTA_CONVOCACAO" ("CO_MONITORAMENTO")
  where "CO_MONITORAMENTO" is not null;
comment on index public."IN_FKMODELOCARTA_MONITORAMENTO" is 'Chave estrangeira para TB_MONITORAMENTO_INDIGENA.';
create unique index "IN_MODELOCARTA_NOME_ATIVO" on public."TB_MODELO_CARTA_CONVOCACAO"
  ("CO_AREA", coalesce("CO_MONITORAMENTO", '00000000-0000-0000-0000-000000000000'::uuid), lower(btrim("NO_MODELO")))
  where "ST_ATIVO";
comment on index public."IN_MODELOCARTA_NOME_ATIVO" is 'Um nome por área/edital entre os modelos ativos.';
alter table public."TB_MODELO_CARTA_CONVOCACAO" enable row level security;
revoke all on public."TB_MODELO_CARTA_CONVOCACAO" from public, anon, authenticated;

create table public."TH_MODELO_CARTA_CONVOCACAO" (
  "CO_MODELO_CARTA" uuid not null,
  "NU_VERSAO" integer not null,
  "NO_MODELO" varchar(120) not null,
  "DS_TITULO" varchar(300) not null,
  "DS_TEXTO" text not null,
  "DS_LOCAL" varchar(500),
  "DS_DOCUMENTOS" varchar(5000),
  "DS_CONTATO" varchar(500),
  "NU_PRAZO_DIAS" smallint,
  "DS_MOTIVO" varchar(500),
  "CO_USUARIO" uuid,
  "NO_USUARIO" varchar(255),
  "DS_EMAIL_USUARIO" varchar(320),
  "DT_CRIACAO" timestamptz not null default now(),
  constraint "PK_TH_MODELO_CARTA_CONVOCACAO" primary key ("CO_MODELO_CARTA", "NU_VERSAO"),
  constraint "FK_MODELOCARTA_HISTMODELOCARTA" foreign key ("CO_MODELO_CARTA") references public."TB_MODELO_CARTA_CONVOCACAO" ("CO_MODELO_CARTA"),
  constraint "CK_HISTMODCARTA_NUVERSAO" check ("NU_VERSAO" >= 1),
  constraint "CK_HISTMODCARTA_TITULO" check (length(btrim("DS_TITULO")) between 1 and 300),
  constraint "CK_HISTMODCARTA_TEXTO" check (length(btrim("DS_TEXTO")) between 1 and 20000),
  constraint "CK_HISTMODCARTA_PRAZO" check ("NU_PRAZO_DIAS" is null or "NU_PRAZO_DIAS" between 0 and 90),
  constraint "CK_HISTMODCARTA_MOTIVO" check (
    ("DS_MOTIVO" is null or length("DS_MOTIVO") between 3 and 500)
    and ("NU_VERSAO" = 1 or "DS_MOTIVO" is not null))
);
comment on table public."TH_MODELO_CARTA_CONVOCACAO" is
  'Versões do modelo da carta de convocação. Cada alteração cria uma linha (nada é sobrescrito); a carta emitida guarda a versão usada. Motivo obrigatório a partir da versão 2.';
comment on column public."TH_MODELO_CARTA_CONVOCACAO"."CO_MODELO_CARTA" is 'Modelo (TB_MODELO_CARTA_CONVOCACAO).';
comment on column public."TH_MODELO_CARTA_CONVOCACAO"."NU_VERSAO" is 'Número da versão (1, 2, 3…).';
comment on column public."TH_MODELO_CARTA_CONVOCACAO"."NO_MODELO" is 'Nome do modelo nesta versão.';
comment on column public."TH_MODELO_CARTA_CONVOCACAO"."DS_TITULO" is 'Título da carta (pode ter campos entre chaves).';
comment on column public."TH_MODELO_CARTA_CONVOCACAO"."DS_TEXTO" is 'Texto da carta: um parágrafo por linha, **negrito**, campos entre chaves ({NOME}, {CPF}, {CARGO}, {VAGA}, {LOTACAO}, {UNIDADE}, {EDITAL}, {POSICAO}, {MODALIDADE}, {DATA_LIMITE}, {LOCAL}, {DOCUMENTOS}, {CONTATO}, {DATA}); src/lib/carta-de-convocacao.js.';
comment on column public."TH_MODELO_CARTA_CONVOCACAO"."DS_LOCAL" is 'Valor padrão de {LOCAL}: onde o candidato se apresenta.';
comment on column public."TH_MODELO_CARTA_CONVOCACAO"."DS_DOCUMENTOS" is 'Valor padrão de {DOCUMENTOS}: um documento por linha.';
comment on column public."TH_MODELO_CARTA_CONVOCACAO"."DS_CONTATO" is 'Valor padrão de {CONTATO}: e-mail ou telefone para dúvidas.';
comment on column public."TH_MODELO_CARTA_CONVOCACAO"."NU_PRAZO_DIAS" is 'Prazo padrão, em dias corridos a partir da emissão, para {DATA_LIMITE} (0 a 90); nulo = informado na emissão.';
comment on column public."TH_MODELO_CARTA_CONVOCACAO"."DS_MOTIVO" is 'Por que o modelo mudou (obrigatório a partir da versão 2).';
comment on column public."TH_MODELO_CARTA_CONVOCACAO"."CO_USUARIO" is 'Quem salvou a versão (auth.users.id).';
comment on column public."TH_MODELO_CARTA_CONVOCACAO"."NO_USUARIO" is 'Nome de quem salvou, copiado do perfil.';
comment on column public."TH_MODELO_CARTA_CONVOCACAO"."DS_EMAIL_USUARIO" is 'E-mail de quem salvou, copiado da sessão.';
comment on column public."TH_MODELO_CARTA_CONVOCACAO"."DT_CRIACAO" is 'Quando a versão foi salva.';
comment on constraint "FK_MODELOCARTA_HISTMODELOCARTA" on public."TH_MODELO_CARTA_CONVOCACAO" is 'Modelo da versão.';
comment on constraint "CK_HISTMODCARTA_NUVERSAO" on public."TH_MODELO_CARTA_CONVOCACAO" is 'Versões começam em 1.';
comment on constraint "CK_HISTMODCARTA_TITULO" on public."TH_MODELO_CARTA_CONVOCACAO" is 'Título entre 1 e 300 caracteres.';
comment on constraint "CK_HISTMODCARTA_TEXTO" on public."TH_MODELO_CARTA_CONVOCACAO" is 'Texto entre 1 e 20.000 caracteres.';
comment on constraint "CK_HISTMODCARTA_PRAZO" on public."TH_MODELO_CARTA_CONVOCACAO" is 'Prazo padrão entre 0 e 90 dias.';
comment on constraint "CK_HISTMODCARTA_MOTIVO" on public."TH_MODELO_CARTA_CONVOCACAO" is 'Motivo entre 3 e 500 caracteres, obrigatório a partir da versão 2.';
alter table public."TH_MODELO_CARTA_CONVOCACAO" enable row level security;
revoke all on public."TH_MODELO_CARTA_CONVOCACAO" from public, anon, authenticated;

-- 3. Cartas emitidas e os candidatos de cada uma ------------------------------------------------------
create table public."TH_CARTA_CONVOCACAO" (
  "CO_CARTA_CONVOCACAO" uuid not null default gen_random_uuid(),
  "CO_MODELO_CARTA" uuid not null,
  "NU_VERSAO_MODELO" integer not null,
  "CO_AREA" text not null,
  "TP_AGRUPAMENTO" varchar(15) not null,
  "TP_SAIDA" varchar(10) not null,
  "DT_LIMITE" date,
  "DS_LOCAL" varchar(500),
  "DS_DOCUMENTOS" varchar(5000),
  "DS_CONTATO" varchar(500),
  "QT_CANDIDATO" integer not null,
  "CO_USUARIO" uuid not null,
  "NO_USUARIO" varchar(255),
  "DS_EMAIL_USUARIO" varchar(320),
  "DT_EMISSAO" timestamptz not null default now(),
  constraint "PK_TH_CARTA_CONVOCACAO" primary key ("CO_CARTA_CONVOCACAO"),
  constraint "FK_HISTMODCARTA_CARTACONVOC" foreign key ("CO_MODELO_CARTA", "NU_VERSAO_MODELO")
    references public."TH_MODELO_CARTA_CONVOCACAO" ("CO_MODELO_CARTA", "NU_VERSAO"),
  constraint "FK_AREA_CARTACONVOC" foreign key ("CO_AREA") references public."TB_AREA" ("CO_AREA"),
  constraint "CK_CARTACONVOC_TPAGRUPAMENTO" check ("TP_AGRUPAMENTO" in ('UNICO', 'POR_CANDIDATO')),
  constraint "CK_CARTACONVOC_TPSAIDA" check ("TP_SAIDA" in ('SEI', 'DOCX', 'PDF')),
  constraint "CK_CARTACONVOC_QTCANDIDATO" check ("QT_CANDIDATO" between 1 and 500)
);
comment on table public."TH_CARTA_CONVOCACAO" is
  'Cada emissão da carta de convocação para contratação: quem, quando, o modelo e a versão, como saiu (SEI, DOCX ou PDF; um documento ou uma carta por candidato) e os valores usados no prazo, local, documentos e contato. Os candidatos estão em RL_CARTA_CANDIDATO.';
comment on column public."TH_CARTA_CONVOCACAO"."CO_CARTA_CONVOCACAO" is 'Identificador da emissão.';
comment on column public."TH_CARTA_CONVOCACAO"."CO_MODELO_CARTA" is 'Modelo usado.';
comment on column public."TH_CARTA_CONVOCACAO"."NU_VERSAO_MODELO" is 'Versão do modelo usada.';
comment on column public."TH_CARTA_CONVOCACAO"."CO_AREA" is 'Área do modelo (e dos candidatos).';
comment on column public."TH_CARTA_CONVOCACAO"."TP_AGRUPAMENTO" is 'UNICO (um documento com todas as cartas) ou POR_CANDIDATO (uma carta por candidato).';
comment on column public."TH_CARTA_CONVOCACAO"."TP_SAIDA" is 'Como saiu: SEI (copiada para o SEI), DOCX ou PDF.';
comment on column public."TH_CARTA_CONVOCACAO"."DT_LIMITE" is 'Valor de {DATA_LIMITE}: até quando o candidato se apresenta.';
comment on column public."TH_CARTA_CONVOCACAO"."DS_LOCAL" is 'Valor de {LOCAL} usado na emissão.';
comment on column public."TH_CARTA_CONVOCACAO"."DS_DOCUMENTOS" is 'Valor de {DOCUMENTOS} usado na emissão (um por linha).';
comment on column public."TH_CARTA_CONVOCACAO"."DS_CONTATO" is 'Valor de {CONTATO} usado na emissão.';
comment on column public."TH_CARTA_CONVOCACAO"."QT_CANDIDATO" is 'Quantos candidatos receberam a carta (1 a 500).';
comment on column public."TH_CARTA_CONVOCACAO"."CO_USUARIO" is 'Quem emitiu (auth.users.id).';
comment on column public."TH_CARTA_CONVOCACAO"."NO_USUARIO" is 'Nome de quem emitiu, copiado do perfil.';
comment on column public."TH_CARTA_CONVOCACAO"."DS_EMAIL_USUARIO" is 'E-mail de quem emitiu, copiado da sessão.';
comment on column public."TH_CARTA_CONVOCACAO"."DT_EMISSAO" is 'Quando.';
comment on constraint "FK_HISTMODCARTA_CARTACONVOC" on public."TH_CARTA_CONVOCACAO" is 'Versão do modelo usada (CARTACONVOC = CARTA_CONVOCACAO).';
comment on constraint "FK_AREA_CARTACONVOC" on public."TH_CARTA_CONVOCACAO" is 'Área da emissão.';
comment on constraint "CK_CARTACONVOC_TPAGRUPAMENTO" on public."TH_CARTA_CONVOCACAO" is 'Agrupamentos válidos.';
comment on constraint "CK_CARTACONVOC_TPSAIDA" on public."TH_CARTA_CONVOCACAO" is 'Saídas válidas.';
comment on constraint "CK_CARTACONVOC_QTCANDIDATO" on public."TH_CARTA_CONVOCACAO" is 'De 1 a 500 candidatos por emissão.';
create index "IN_CARTACONVOC_AREA_DATA" on public."TH_CARTA_CONVOCACAO" ("CO_AREA", "DT_EMISSAO" desc);
comment on index public."IN_CARTACONVOC_AREA_DATA" is 'Emissões da área, da mais recente.';
create index "IN_FKCARTACONVOC_MODELO" on public."TH_CARTA_CONVOCACAO" ("CO_MODELO_CARTA", "NU_VERSAO_MODELO");
comment on index public."IN_FKCARTACONVOC_MODELO" is 'Chave estrangeira para TH_MODELO_CARTA_CONVOCACAO.';
alter table public."TH_CARTA_CONVOCACAO" enable row level security;
revoke all on public."TH_CARTA_CONVOCACAO" from public, anon, authenticated;

create table public."RL_CARTA_CANDIDATO" (
  "CO_CARTA_CONVOCACAO" uuid not null,
  "CO_CANDIDATO_APROVADO" uuid not null,
  "CO_MONITORAMENTO" uuid not null,
  "NU_ORDEM" smallint not null,
  "NO_CANDIDATO" varchar(255) not null,
  "DS_STATUS_ANTERIOR" varchar(40),
  "DT_CONVOCACAO_MARCADA" date,
  constraint "PK_RL_CARTA_CANDIDATO" primary key ("CO_CARTA_CONVOCACAO", "CO_CANDIDATO_APROVADO"),
  constraint "FK_CARTACONVOC_CARTACANDIDATO" foreign key ("CO_CARTA_CONVOCACAO") references public."TH_CARTA_CONVOCACAO" ("CO_CARTA_CONVOCACAO"),
  constraint "FK_CANDAPROVADO_CARTACANDIDATO" foreign key ("CO_CANDIDATO_APROVADO") references public."TB_CANDIDATO_APROVADO" (id),
  constraint "FK_MONITORAMENTO_CARTACAND" foreign key ("CO_MONITORAMENTO") references public."TB_MONITORAMENTO_INDIGENA" (id),
  constraint "CK_CARTACANDIDATO_NUORDEM" check ("NU_ORDEM" >= 1)
);
comment on table public."RL_CARTA_CANDIDATO" is
  'Os candidatos de cada carta de convocação emitida, na ordem do documento, com o nome e o status do momento da emissão e a data em que foram marcados como Convocado a partir dela.';
comment on column public."RL_CARTA_CANDIDATO"."CO_CARTA_CONVOCACAO" is 'Emissão (TH_CARTA_CONVOCACAO).';
comment on column public."RL_CARTA_CANDIDATO"."CO_CANDIDATO_APROVADO" is 'Candidato (TB_CANDIDATO_APROVADO.id). Numa lista publicada depois, o mesmo candidato é achado por CO_CANDIDATO_ANTERIOR.';
comment on column public."RL_CARTA_CANDIDATO"."CO_MONITORAMENTO" is 'Edital do candidato na emissão.';
comment on column public."RL_CARTA_CANDIDATO"."NU_ORDEM" is 'Posição da carta no documento (1, 2, 3…).';
comment on column public."RL_CARTA_CANDIDATO"."NO_CANDIDATO" is 'Nome do candidato na emissão.';
comment on column public."RL_CARTA_CANDIDATO"."DS_STATUS_ANTERIOR" is 'Status do candidato na emissão (nulo = sem status).';
comment on column public."RL_CARTA_CANDIDATO"."DT_CONVOCACAO_MARCADA" is 'Data da convocação gravada quando, depois da emissão, o candidato foi marcado como Convocado por ela; nulo = não marcado por esta carta.';
comment on constraint "FK_CARTACONVOC_CARTACANDIDATO" on public."RL_CARTA_CANDIDATO" is 'Emissão.';
comment on constraint "FK_CANDAPROVADO_CARTACANDIDATO" on public."RL_CARTA_CANDIDATO" is 'Candidato (CANDAPROVADO = CANDIDATO_APROVADO).';
comment on constraint "FK_MONITORAMENTO_CARTACAND" on public."RL_CARTA_CANDIDATO" is 'Edital do candidato.';
comment on constraint "CK_CARTACANDIDATO_NUORDEM" on public."RL_CARTA_CANDIDATO" is 'Ordem começa em 1.';
create index "IN_FKCARTACAND_CANDIDATO" on public."RL_CARTA_CANDIDATO" ("CO_CANDIDATO_APROVADO");
comment on index public."IN_FKCARTACAND_CANDIDATO" is 'Chave estrangeira para TB_CANDIDATO_APROVADO (cartas do candidato).';
create index "IN_FKCARTACAND_MONITORAMENTO" on public."RL_CARTA_CANDIDATO" ("CO_MONITORAMENTO");
comment on index public."IN_FKCARTACAND_MONITORAMENTO" is 'Chave estrangeira para TB_MONITORAMENTO_INDIGENA.';
alter table public."RL_CARTA_CANDIDATO" enable row level security;
revoke all on public."RL_CARTA_CANDIDATO" from public, anon, authenticated;

-- O histórico do status guarda a data e, quando veio de uma carta, qual.
alter table public."TH_CANDIDATO_APROVADO"
  add column "DT_CONVOCACAO" date,
  add column "CO_CARTA_CONVOCACAO" uuid,
  add constraint "FK_CARTACONVOC_HISTCANDAPROV" foreign key ("CO_CARTA_CONVOCACAO")
    references public."TH_CARTA_CONVOCACAO" ("CO_CARTA_CONVOCACAO");
comment on column public."TH_CANDIDATO_APROVADO"."DT_CONVOCACAO" is 'Data da convocação depois da alteração.';
comment on column public."TH_CANDIDATO_APROVADO"."CO_CARTA_CONVOCACAO" is 'Carta de convocação a partir da qual o candidato foi marcado como Convocado (TH_CARTA_CONVOCACAO); nulo nas alterações manuais.';
comment on constraint "FK_CARTACONVOC_HISTCANDAPROV" on public."TH_CANDIDATO_APROVADO" is 'Carta que originou a alteração.';
create index "IN_FKHISTCANDAPROV_CARTA" on public."TH_CANDIDATO_APROVADO" ("CO_CARTA_CONVOCACAO")
  where "CO_CARTA_CONVOCACAO" is not null;
comment on index public."IN_FKHISTCANDAPROV_CARTA" is 'Chave estrangeira para TH_CARTA_CONVOCACAO.';

-- 4. Alterar o status: Convocado com a data; do Convocado, quem edita segue o fluxo ---------------------
drop function public.alterar_status_candidato_aprovado(uuid, text, text, text);
create function public.alterar_status_candidato_aprovado(
  p_candidato_id uuid,
  p_status text,
  p_processo_sei text default null,
  p_matricula text default null,
  p_data_convocacao date default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_candidato public."TB_CANDIDATO_APROVADO"%rowtype;
  v_lista public."TB_LISTA_APROVADO"%rowtype;
  v_status text := nullif(btrim(coalesce(p_status, '')), '');
  v_matricula text := nullif(btrim(coalesce(p_matricula, '')), '');
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_data date;
begin
  -- Quem edita a Lista de aprovados (grupo ou exceção) e tem a área/edital.
  perform private."FC_EXIGIR_AREA_EDITAL"((select l.edital_id from public."TB_CANDIDATO_APROVADO" c
                                             join public."TB_LISTA_APROVADO" l on l.id = c.lista_id
                                            where c.id = p_candidato_id));
  if not private.pode_recurso('aprovados', 2) then
    raise exception 'Perfil sem permissao para alterar status' using errcode = '42501';
  end if;

  if v_status is not null and v_status not in (
    'Convocado', 'Contratado', 'Desistente', 'Migração', 'Documentação Rejeitada'
  ) then
    raise exception 'Status invalido' using errcode = '22023';
  end if;

  if v_status in ('Contratado', 'Migração') and v_matricula is null then
    raise exception 'Matricula obrigatoria para Contratado ou Migracao';
  end if;

  if p_data_convocacao is not null and v_status is distinct from 'Convocado' then
    raise exception 'A data da convocação só vale para o status Convocado' using errcode = '22023';
  end if;
  if p_data_convocacao > v_hoje then
    raise exception 'A data da convocação não pode ser futura' using errcode = '22023';
  end if;

  select * into v_candidato
  from public."TB_CANDIDATO_APROVADO"
  where id = p_candidato_id and removido_em is null
  for update;
  if not found then raise exception 'Candidato nao encontrado'; end if;

  -- Status já definido só o admin muda; do Convocado, quem edita segue o fluxo
  -- (ou corrige a data), mas voltar a "sem status" continua sendo do admin.
  if not private.pode_recurso('aprovados', 3) and v_candidato.status is not null
     and not (v_candidato.status = 'Convocado' and v_status is not null) then
    raise exception 'O status deste candidato ja foi definido. Somente admin pode altera-lo';
  end if;

  select * into v_lista
  from public."TB_LISTA_APROVADO"
  where id = v_candidato.lista_id and vigente is true
  for update;
  if not found then raise exception 'Lista vigente nao encontrada'; end if;
  if not v_lista.ativo then
    raise exception 'A lista esta inativa e nao permite alterar candidatos';
  end if;

  if v_status = 'Convocado' then
    v_data := coalesce(p_data_convocacao,
                       (case when v_candidato.status = 'Convocado' then v_candidato."DT_CONVOCACAO" end),
                       v_hoje);
  elsif v_status is null then
    v_data := null;
  else
    v_data := v_candidato."DT_CONVOCACAO";
  end if;

  insert into public."TH_CANDIDATO_APROVADO"(
    candidato_id, lista_id, status_anterior, status_novo,
    processo_sei, matricula, alterado_por, "DT_CONVOCACAO"
  ) values (
    v_candidato.id, v_candidato.lista_id, v_candidato.status, v_status,
    nullif(btrim(coalesce(p_processo_sei, '')), ''), v_matricula,
    (select auth.uid()), v_data
  );

  update public."TB_CANDIDATO_APROVADO"
  set status = v_status,
      processo_sei = nullif(btrim(coalesce(p_processo_sei, '')), ''),
      matricula = case
        when v_status in ('Contratado', 'Migração') then v_matricula
        else null
      end,
      "DT_CONVOCACAO" = v_data,
      updated_by = (select auth.uid()),
      updated_at = now()
  where id = v_candidato.id;

  return jsonb_build_object(
    'ok', true,
    'candidato_id', v_candidato.id,
    'status', v_status,
    'matricula', v_matricula,
    'data_convocacao', v_data
  );
end;
$function$;
comment on function public.alterar_status_candidato_aprovado(uuid, text, text, text, date) is
  'Altera o status de um candidato da lista vigente e ativa (Convocado, Contratado, Desistente, Migração, Documentação Rejeitada ou nulo), com processo SEI, matrícula (Contratado e Migração) e a data da convocação (Convocado; padrão hoje, nunca futura). Aprovados >= editor na área/edital; status já definido só o admin muda, exceto do Convocado para outro status. Grava TH_CANDIDATO_APROVADO.';
revoke all on function public.alterar_status_candidato_aprovado(uuid, text, text, text, date) from public, anon;
grant execute on function public.alterar_status_candidato_aprovado(uuid, text, text, text, date) to authenticated;

-- 5. Marcar vários como Convocado (depois de emitir a carta) ------------------------------------------
create function public.marcar_candidatos_convocados(
  p_candidatos uuid[],
  p_data_convocacao date default null,
  p_carta uuid default null
)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_data date := coalesce(p_data_convocacao, (now() at time zone 'America/Sao_Paulo')::date);
  v_ids uuid[];
  v_c record;
  v_marcados integer := 0;
  v_ignorados jsonb := '[]'::jsonb;
begin
  if not private.pode_recurso('aprovados', 2) then
    raise exception 'Perfil sem permissao para alterar status' using errcode = '42501';
  end if;
  select array_agg(distinct x) into v_ids from unnest(coalesce(p_candidatos, '{}'::uuid[])) x where x is not null;
  if coalesce(array_length(v_ids, 1), 0) = 0 then
    raise exception 'Escolha ao menos um candidato.' using errcode = '22023';
  end if;
  if array_length(v_ids, 1) > 500 then
    raise exception 'No máximo 500 candidatos por vez.' using errcode = '22023';
  end if;
  if v_data > v_hoje then
    raise exception 'A data da convocação não pode ser futura' using errcode = '22023';
  end if;
  if p_carta is not null and not exists (
    select 1 from public."TH_CARTA_CONVOCACAO" where "CO_CARTA_CONVOCACAO" = p_carta
  ) then
    raise exception 'Carta de convocação não encontrada' using errcode = '22023';
  end if;

  -- Área e recorte de cada edital antes de mudar qualquer um (tudo ou nada).
  perform private."FC_EXIGIR_AREA_EDITAL"(l.edital_id)
     from public."TB_CANDIDATO_APROVADO" c
     join public."TB_LISTA_APROVADO" l on l.id = c.lista_id
    where c.id = any (v_ids);

  for v_c in
    select c.id, c.nome, c.status, c.lista_id, c."DT_CONVOCACAO", l.vigente, l.ativo
      from public."TB_CANDIDATO_APROVADO" c
      join public."TB_LISTA_APROVADO" l on l.id = c.lista_id
     where c.id = any (v_ids) and c.removido_em is null
     order by c.id
       for update of c
  loop
    if not v_c.vigente or not v_c.ativo then
      v_ignorados := v_ignorados || jsonb_build_object('candidato_id', v_c.id, 'nome', v_c.nome, 'motivo', 'Lista inativa ou substituída');
    elsif v_c.status is not null and v_c.status <> 'Convocado' then
      v_ignorados := v_ignorados || jsonb_build_object('candidato_id', v_c.id, 'nome', v_c.nome, 'motivo', 'Já está como ' || v_c.status);
    else
      insert into public."TH_CANDIDATO_APROVADO"(
        candidato_id, lista_id, status_anterior, status_novo, alterado_por, "DT_CONVOCACAO", "CO_CARTA_CONVOCACAO"
      ) values (
        v_c.id, v_c.lista_id, v_c.status, 'Convocado', (select auth.uid()), v_data, p_carta
      );
      update public."TB_CANDIDATO_APROVADO"
         set status = 'Convocado', matricula = null, "DT_CONVOCACAO" = v_data,
             updated_by = (select auth.uid()), updated_at = now()
       where id = v_c.id;
      if p_carta is not null then
        update public."RL_CARTA_CANDIDATO"
           set "DT_CONVOCACAO_MARCADA" = v_data
         where "CO_CARTA_CONVOCACAO" = p_carta and "CO_CANDIDATO_APROVADO" = v_c.id;
      end if;
      v_marcados := v_marcados + 1;
    end if;
  end loop;

  -- Quem não existe (ou foi removido) também volta, para a tela dizer.
  v_ignorados := v_ignorados || coalesce((
    select jsonb_agg(jsonb_build_object('candidato_id', x, 'nome', null, 'motivo', 'Candidato não encontrado'))
      from unnest(v_ids) x
     where not exists (select 1 from public."TB_CANDIDATO_APROVADO" c where c.id = x and c.removido_em is null)
  ), '[]'::jsonb);

  return json_build_object('marcados', v_marcados, 'ignorados', v_ignorados, 'data_convocacao', v_data);
end;
$function$;
comment on function public.marcar_candidatos_convocados(uuid[], date, uuid) is
  'Marca como Convocado (com a data; padrão hoje, nunca futura) os candidatos sem status ou já convocados, de listas vigentes e ativas — os demais voltam em ignorados com o motivo. Com p_carta, liga a alteração à carta emitida (TH_CANDIDATO_APROVADO.CO_CARTA_CONVOCACAO e RL_CARTA_CANDIDATO.DT_CONVOCACAO_MARCADA). Aprovados >= editor na área/edital de todos; até 500 por vez.';
revoke all on function public.marcar_candidatos_convocados(uuid[], date, uuid) from public, anon;
grant execute on function public.marcar_candidatos_convocados(uuid[], date, uuid) to authenticated;

-- 6. Modelos da carta: listar, salvar (nova versão), ativar/inativar ----------------------------------
create function public.listar_modelos_carta_convocacao(p_area text)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_area text := lower(btrim(coalesce(p_area, '')));
begin
  if not private.pode_recurso('aprovados', 1) then
    raise exception 'Sem permissão para este recurso' using errcode = '42501';
  end if;
  if not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = v_area) then
    raise exception 'Área inválida: %', p_area using errcode = '22023';
  end if;
  if not (v_area = any ((select private."FC_AREAS_USUARIO"())::text[])) then
    raise exception 'Sem permissão para esta área' using errcode = '42501';
  end if;

  return json_build_object(
    'pode_editar', private.pode_recurso('aprovados', 2),
    'modelos', coalesce((
      select json_agg(json_build_object(
               'modelo_id', t."CO_MODELO_CARTA",
               'area', t."CO_AREA",
               'edital_id', t."CO_MONITORAMENTO",
               'edital', m.edital,
               'unidade', m.unidade,
               'nome', t."NO_MODELO",
               'ativo', t."ST_ATIVO",
               'motivo_situacao', t."DS_MOTIVO_SITUACAO",
               'versao', t."NU_VERSAO_VIGENTE",
               'atualizado_em', t."DT_ATUALIZACAO",
               'vigente', (select json_build_object(
                              'titulo', v."DS_TITULO", 'texto', v."DS_TEXTO", 'local', v."DS_LOCAL",
                              'documentos', v."DS_DOCUMENTOS", 'contato', v."DS_CONTATO",
                              'prazo_dias', v."NU_PRAZO_DIAS", 'usuario', v."NO_USUARIO", 'salvo_em', v."DT_CRIACAO")
                             from public."TH_MODELO_CARTA_CONVOCACAO" v
                            where v."CO_MODELO_CARTA" = t."CO_MODELO_CARTA" and v."NU_VERSAO" = t."NU_VERSAO_VIGENTE"),
               'versoes', (select coalesce(json_agg(json_build_object(
                                     'versao', v."NU_VERSAO", 'motivo', v."DS_MOTIVO",
                                     'usuario', coalesce(v."NO_USUARIO", v."DS_EMAIL_USUARIO"), 'salvo_em', v."DT_CRIACAO")
                                   order by v."NU_VERSAO" desc), '[]'::json)
                             from (select * from public."TH_MODELO_CARTA_CONVOCACAO" h
                                    where h."CO_MODELO_CARTA" = t."CO_MODELO_CARTA"
                                    order by h."NU_VERSAO" desc limit 20) v),
               'cartas', (select count(*) from public."TH_CARTA_CONVOCACAO" e where e."CO_MODELO_CARTA" = t."CO_MODELO_CARTA"))
             order by t."ST_ATIVO" desc, (t."CO_MONITORAMENTO" is null), lower(t."NO_MODELO"))
        from public."TB_MODELO_CARTA_CONVOCACAO" t
        left join public."TB_MONITORAMENTO_INDIGENA" m on m.id = t."CO_MONITORAMENTO"
       where t."CO_AREA" = v_area
         and (t."CO_MONITORAMENTO" is null or private."FC_PODE_VER_EDITAL"(t."CO_MONITORAMENTO"))
    ), '[]'::json)
  );
end;
$function$;
comment on function public.listar_modelos_carta_convocacao(text) is
  'Os modelos da carta de convocação da área (ativos e inativos; os de edital só se a pessoa vê o edital): a versão vigente com o texto e os valores padrão, as últimas 20 versões (motivo, quem, quando), quantas cartas saíram de cada um e pode_editar. Aprovados >= leitor e a área do usuário.';
revoke all on function public.listar_modelos_carta_convocacao(text) from public, anon;
grant execute on function public.listar_modelos_carta_convocacao(text) to authenticated;

/*
  p_modelo nulo cria (área e, se quiser, edital da área); senão, nova versão do
  modelo — p_versao_atual é a que a tela abriu (outra = 40001) e o motivo é
  obrigatório. Área e edital do modelo não mudam depois de criado.
  p_conteudo: {nome, titulo, texto, local, documentos, contato, prazo_dias}.
*/
create function public.salvar_modelo_carta_convocacao(
  p_modelo uuid,
  p_area text,
  p_edital uuid,
  p_conteudo jsonb,
  p_versao_atual integer default null,
  p_motivo text default null
)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_modelo public."TB_MODELO_CARTA_CONVOCACAO";
  v_area text := lower(btrim(coalesce(p_area, '')));
  v_nome text := btrim(coalesce(p_conteudo ->> 'nome', ''));
  v_titulo text := btrim(coalesce(p_conteudo ->> 'titulo', ''));
  v_texto text := btrim(coalesce(p_conteudo ->> 'texto', ''));
  v_local text := nullif(btrim(coalesce(p_conteudo ->> 'local', '')), '');
  v_documentos text := nullif(btrim(coalesce(p_conteudo ->> 'documentos', '')), '');
  v_contato text := nullif(btrim(coalesce(p_conteudo ->> 'contato', '')), '');
  v_prazo integer;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_versao integer;
  v_autor record;
begin
  if not private.pode_recurso('aprovados', 2) then
    raise exception 'Sem permissão para editar os modelos da carta' using errcode = '42501';
  end if;
  if jsonb_typeof(p_conteudo) is distinct from 'object' then
    raise exception 'Conteúdo do modelo inválido.' using errcode = '22023';
  end if;
  if length(v_nome) not between 3 and 120 then
    raise exception 'O nome do modelo deve ter de 3 a 120 caracteres.' using errcode = '22023';
  end if;
  if length(v_titulo) not between 1 and 300 then
    raise exception 'O título deve ter de 1 a 300 caracteres.' using errcode = '22023';
  end if;
  if length(v_texto) not between 1 and 20000 then
    raise exception 'O texto da carta deve ter de 1 a 20.000 caracteres.' using errcode = '22023';
  end if;
  if length(coalesce(v_local, '')) > 500 or length(coalesce(v_contato, '')) > 500
     or length(coalesce(v_documentos, '')) > 5000 then
    raise exception 'Local e contato vão até 500 caracteres; documentos, até 5.000.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_conteudo -> 'prazo_dias') = 'number' then
    v_prazo := (p_conteudo ->> 'prazo_dias')::numeric::integer;
    if v_prazo not between 0 and 90 then
      raise exception 'O prazo padrão vai de 0 a 90 dias.' using errcode = '22023';
    end if;
  elsif p_conteudo ? 'prazo_dias' and jsonb_typeof(p_conteudo -> 'prazo_dias') <> 'null' then
    raise exception 'O prazo padrão deve ser um número de dias.' using errcode = '22023';
  end if;
  if v_motivo is not null and length(v_motivo) not between 3 and 500 then
    raise exception 'O motivo deve ter de 3 a 500 caracteres.' using errcode = '22023';
  end if;

  select * into v_autor from private.autor_da_sessao();

  if p_modelo is null then
    if not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = v_area) then
      raise exception 'Área inválida: %', p_area using errcode = '22023';
    end if;
    if not (v_area = any ((select private."FC_AREAS_USUARIO"())::text[])) then
      raise exception 'Sem permissão para esta área' using errcode = '42501';
    end if;
    if p_edital is not null then
      if not exists (select 1 from public."TB_MONITORAMENTO_INDIGENA" m where m.id = p_edital and m."CO_AREA" = v_area) then
        raise exception 'O edital não é desta área.' using errcode = '22023';
      end if;
      perform private."FC_EXIGIR_AREA_EDITAL"(p_edital::text);
    end if;
    if exists (select 1 from public."TB_MODELO_CARTA_CONVOCACAO" t
                where t."ST_ATIVO" and t."CO_AREA" = v_area
                  and t."CO_MONITORAMENTO" is not distinct from p_edital
                  and lower(btrim(t."NO_MODELO")) = lower(v_nome)) then
      raise exception 'Já existe um modelo ativo com este nome.' using errcode = '23505';
    end if;
    insert into public."TB_MODELO_CARTA_CONVOCACAO" (
      "CO_AREA", "CO_MONITORAMENTO", "NO_MODELO", "NU_VERSAO_VIGENTE", "CO_USUARIO_CRIACAO", "CO_USUARIO_ATUALIZACAO"
    ) values (v_area, p_edital, v_nome, 1, (select auth.uid()), (select auth.uid()))
    returning * into v_modelo;
    v_versao := 1;
  else
    select * into v_modelo from public."TB_MODELO_CARTA_CONVOCACAO"
     where "CO_MODELO_CARTA" = p_modelo for update;
    if v_modelo."CO_MODELO_CARTA" is null then
      raise exception 'Modelo não encontrado' using errcode = '22023';
    end if;
    if not (v_modelo."CO_AREA" = any ((select private."FC_AREAS_USUARIO"())::text[])) then
      raise exception 'Sem permissão para esta área' using errcode = '42501';
    end if;
    perform private."FC_EXIGIR_AREA_EDITAL"(v_modelo."CO_MONITORAMENTO"::text);
    if not v_modelo."ST_ATIVO" then
      raise exception 'Modelo inativo: reative antes de editar.' using errcode = '22023';
    end if;
    if p_versao_atual is distinct from v_modelo."NU_VERSAO_VIGENTE" then
      raise exception 'O modelo mudou desde que você o abriu (versão %); abra de novo.', v_modelo."NU_VERSAO_VIGENTE" using errcode = '40001';
    end if;
    if v_motivo is null then
      raise exception 'Informe o motivo da alteração do modelo.' using errcode = '22023';
    end if;
    if exists (select 1 from public."TB_MODELO_CARTA_CONVOCACAO" t
                where t."ST_ATIVO" and t."CO_MODELO_CARTA" <> v_modelo."CO_MODELO_CARTA"
                  and t."CO_AREA" = v_modelo."CO_AREA"
                  and t."CO_MONITORAMENTO" is not distinct from v_modelo."CO_MONITORAMENTO"
                  and lower(btrim(t."NO_MODELO")) = lower(v_nome)) then
      raise exception 'Já existe um modelo ativo com este nome.' using errcode = '23505';
    end if;
    v_versao := v_modelo."NU_VERSAO_VIGENTE" + 1;
    update public."TB_MODELO_CARTA_CONVOCACAO"
       set "NO_MODELO" = v_nome, "NU_VERSAO_VIGENTE" = v_versao,
           "CO_USUARIO_ATUALIZACAO" = (select auth.uid()), "DT_ATUALIZACAO" = now()
     where "CO_MODELO_CARTA" = v_modelo."CO_MODELO_CARTA";
  end if;

  insert into public."TH_MODELO_CARTA_CONVOCACAO" (
    "CO_MODELO_CARTA", "NU_VERSAO", "NO_MODELO", "DS_TITULO", "DS_TEXTO", "DS_LOCAL", "DS_DOCUMENTOS",
    "DS_CONTATO", "NU_PRAZO_DIAS", "DS_MOTIVO", "CO_USUARIO", "NO_USUARIO", "DS_EMAIL_USUARIO"
  ) values (
    v_modelo."CO_MODELO_CARTA", v_versao, v_nome, v_titulo, v_texto, v_local, v_documentos,
    v_contato, v_prazo, v_motivo, (select auth.uid()), v_autor.nome, v_autor.email
  );

  return json_build_object('modelo_id', v_modelo."CO_MODELO_CARTA", 'versao', v_versao);
end;
$function$;
comment on function public.salvar_modelo_carta_convocacao(uuid, text, uuid, jsonb, integer, text) is
  'Cria o modelo da carta de convocação (área e, se quiser, edital da área) ou grava a próxima versão do modelo ativo: p_versao_atual tem de ser a vigente (senão 40001) e o motivo (3 a 500) é obrigatório a partir da versão 2. Nome único entre os ativos da área/edital. Aprovados >= editor e a área (e o recorte do edital).';
revoke all on function public.salvar_modelo_carta_convocacao(uuid, text, uuid, jsonb, integer, text) from public, anon;
grant execute on function public.salvar_modelo_carta_convocacao(uuid, text, uuid, jsonb, integer, text) to authenticated;

create function public.definir_modelo_carta_ativo(p_modelo uuid, p_ativo boolean, p_motivo text)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_modelo public."TB_MODELO_CARTA_CONVOCACAO";
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
begin
  if not private.pode_recurso('aprovados', 2) then
    raise exception 'Sem permissão para editar os modelos da carta' using errcode = '42501';
  end if;
  if p_ativo is null then
    raise exception 'Informe se o modelo fica ativo.' using errcode = '22023';
  end if;
  if v_motivo is null or length(v_motivo) not between 3 and 500 then
    raise exception 'Informe o motivo (3 a 500 caracteres).' using errcode = '22023';
  end if;
  select * into v_modelo from public."TB_MODELO_CARTA_CONVOCACAO"
   where "CO_MODELO_CARTA" = p_modelo for update;
  if v_modelo."CO_MODELO_CARTA" is null then
    raise exception 'Modelo não encontrado' using errcode = '22023';
  end if;
  if not (v_modelo."CO_AREA" = any ((select private."FC_AREAS_USUARIO"())::text[])) then
    raise exception 'Sem permissão para esta área' using errcode = '42501';
  end if;
  perform private."FC_EXIGIR_AREA_EDITAL"(v_modelo."CO_MONITORAMENTO"::text);
  if v_modelo."ST_ATIVO" = p_ativo then
    return json_build_object('modelo_id', v_modelo."CO_MODELO_CARTA", 'ativo', p_ativo, 'mudou', false);
  end if;
  if p_ativo and exists (select 1 from public."TB_MODELO_CARTA_CONVOCACAO" t
                          where t."ST_ATIVO" and t."CO_MODELO_CARTA" <> v_modelo."CO_MODELO_CARTA"
                            and t."CO_AREA" = v_modelo."CO_AREA"
                            and t."CO_MONITORAMENTO" is not distinct from v_modelo."CO_MONITORAMENTO"
                            and lower(btrim(t."NO_MODELO")) = lower(btrim(v_modelo."NO_MODELO"))) then
    raise exception 'Já existe um modelo ativo com este nome.' using errcode = '23505';
  end if;
  update public."TB_MODELO_CARTA_CONVOCACAO"
     set "ST_ATIVO" = p_ativo, "DS_MOTIVO_SITUACAO" = v_motivo,
         "CO_USUARIO_ATUALIZACAO" = (select auth.uid()), "DT_ATUALIZACAO" = now()
   where "CO_MODELO_CARTA" = v_modelo."CO_MODELO_CARTA";
  return json_build_object('modelo_id', v_modelo."CO_MODELO_CARTA", 'ativo', p_ativo, 'mudou', true);
end;
$function$;
comment on function public.definir_modelo_carta_ativo(uuid, boolean, text) is
  'Inativa ou reativa um modelo da carta de convocação, com motivo (3 a 500); nada se apaga e as cartas emitidas continuam no histórico. Aprovados >= editor e a área (e o recorte do edital).';
revoke all on function public.definir_modelo_carta_ativo(uuid, boolean, text) from public, anon;
grant execute on function public.definir_modelo_carta_ativo(uuid, boolean, text) to authenticated;

-- 7. Registrar a emissão da carta ---------------------------------------------------------------------
/*
  p_campos: {data_limite: 'AAAA-MM-DD' | null, local, documentos, contato} — os
  valores usados nesta emissão. Os candidatos vão na ordem do documento.
*/
create function public.registrar_carta_convocacao(
  p_modelo uuid,
  p_versao integer,
  p_candidatos uuid[],
  p_agrupamento text,
  p_saida text,
  p_campos jsonb default '{}'::jsonb
)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_modelo public."TB_MODELO_CARTA_CONVOCACAO";
  v_campos jsonb := coalesce(p_campos, '{}'::jsonb);
  v_agrupamento text := upper(btrim(coalesce(p_agrupamento, '')));
  v_saida text := upper(btrim(coalesce(p_saida, '')));
  v_limite date;
  v_local text;
  v_documentos text;
  v_contato text;
  v_qt integer;
  v_carta uuid;
  v_autor record;
  v_emitida timestamptz;
begin
  if not private.pode_recurso('aprovados', 2) then
    raise exception 'Sem permissão para emitir a carta de convocação' using errcode = '42501';
  end if;
  if v_agrupamento not in ('UNICO', 'POR_CANDIDATO') then
    raise exception 'Agrupamento inválido.' using errcode = '22023';
  end if;
  if v_saida not in ('SEI', 'DOCX', 'PDF') then
    raise exception 'Saída inválida.' using errcode = '22023';
  end if;
  if jsonb_typeof(v_campos) is distinct from 'object' then
    raise exception 'Campos da emissão inválidos.' using errcode = '22023';
  end if;
  begin
    v_limite := nullif(btrim(coalesce(v_campos ->> 'data_limite', '')), '')::date;
  exception when others then
    raise exception 'Data limite inválida.' using errcode = '22023';
  end;
  v_local := nullif(btrim(coalesce(v_campos ->> 'local', '')), '');
  v_documentos := nullif(btrim(coalesce(v_campos ->> 'documentos', '')), '');
  v_contato := nullif(btrim(coalesce(v_campos ->> 'contato', '')), '');
  if length(coalesce(v_local, '')) > 500 or length(coalesce(v_contato, '')) > 500
     or length(coalesce(v_documentos, '')) > 5000 then
    raise exception 'Local e contato vão até 500 caracteres; documentos, até 5.000.' using errcode = '22023';
  end if;

  select * into v_modelo from public."TB_MODELO_CARTA_CONVOCACAO" where "CO_MODELO_CARTA" = p_modelo;
  if v_modelo."CO_MODELO_CARTA" is null then
    raise exception 'Modelo não encontrado' using errcode = '22023';
  end if;
  if not v_modelo."ST_ATIVO" then
    raise exception 'Modelo inativo.' using errcode = '22023';
  end if;
  if not exists (select 1 from public."TH_MODELO_CARTA_CONVOCACAO" v
                  where v."CO_MODELO_CARTA" = p_modelo and v."NU_VERSAO" = p_versao) then
    raise exception 'Versão do modelo não encontrada' using errcode = '22023';
  end if;
  if not (v_modelo."CO_AREA" = any ((select private."FC_AREAS_USUARIO"())::text[])) then
    raise exception 'Sem permissão para esta área' using errcode = '42501';
  end if;

  -- Os candidatos: na ordem pedida, sem repetir, de listas vigentes e ativas da área do modelo.
  create temporary table if not exists tmp_carta_candidato (
    candidato_id uuid, ordem integer, nome text, status text, edital uuid, vigente boolean, ativo boolean, area text
  ) on commit drop;
  truncate pg_temp.tmp_carta_candidato;
  insert into pg_temp.tmp_carta_candidato
  select x.id, x.ordem, c.nome, c.status, m.id, l.vigente, l.ativo, m."CO_AREA"
    from (select distinct on (u.id) u.id, u.ordem
            from unnest(coalesce(p_candidatos, '{}'::uuid[])) with ordinality u(id, ordem)
           where u.id is not null
           order by u.id, u.ordem) x
    left join public."TB_CANDIDATO_APROVADO" c on c.id = x.id and c.removido_em is null
    left join public."TB_LISTA_APROVADO" l on l.id = c.lista_id
    left join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id;
  select count(*) into v_qt from pg_temp.tmp_carta_candidato;
  if v_qt = 0 then
    raise exception 'Escolha ao menos um candidato.' using errcode = '22023';
  end if;
  if v_qt > 500 then
    raise exception 'No máximo 500 candidatos por carta.' using errcode = '22023';
  end if;
  if exists (select 1 from pg_temp.tmp_carta_candidato where nome is null) then
    raise exception 'Candidato não encontrado.' using errcode = '22023';
  end if;
  if exists (select 1 from pg_temp.tmp_carta_candidato where not vigente or not ativo) then
    raise exception 'Há candidato de lista inativa ou substituída.' using errcode = '22023';
  end if;
  if exists (select 1 from pg_temp.tmp_carta_candidato where area is distinct from v_modelo."CO_AREA") then
    raise exception 'Há candidato de outra área que a do modelo.' using errcode = '22023';
  end if;
  if v_modelo."CO_MONITORAMENTO" is not null
     and exists (select 1 from pg_temp.tmp_carta_candidato where edital is distinct from v_modelo."CO_MONITORAMENTO") then
    raise exception 'O modelo é de outro edital que o de algum candidato.' using errcode = '22023';
  end if;
  if exists (select 1 from pg_temp.tmp_carta_candidato t where not private."FC_PODE_VER_EDITAL"(t.edital)) then
    raise exception 'Sem permissão para editais desta área ou coordenação' using errcode = '42501';
  end if;

  select * into v_autor from private.autor_da_sessao();
  insert into public."TH_CARTA_CONVOCACAO" (
    "CO_MODELO_CARTA", "NU_VERSAO_MODELO", "CO_AREA", "TP_AGRUPAMENTO", "TP_SAIDA", "DT_LIMITE",
    "DS_LOCAL", "DS_DOCUMENTOS", "DS_CONTATO", "QT_CANDIDATO", "CO_USUARIO", "NO_USUARIO", "DS_EMAIL_USUARIO"
  ) values (
    p_modelo, p_versao, v_modelo."CO_AREA", v_agrupamento, v_saida, v_limite,
    v_local, v_documentos, v_contato, v_qt, (select auth.uid()), v_autor.nome, v_autor.email
  ) returning "CO_CARTA_CONVOCACAO", "DT_EMISSAO" into v_carta, v_emitida;

  insert into public."RL_CARTA_CANDIDATO" (
    "CO_CARTA_CONVOCACAO", "CO_CANDIDATO_APROVADO", "CO_MONITORAMENTO", "NU_ORDEM", "NO_CANDIDATO", "DS_STATUS_ANTERIOR"
  )
  select v_carta, t.candidato_id, t.edital, (row_number() over (order by t.ordem))::smallint, left(t.nome, 255), t.status
    from pg_temp.tmp_carta_candidato t;

  return json_build_object('carta_id', v_carta, 'emitida_em', v_emitida, 'candidatos', v_qt);
end;
$function$;
comment on function public.registrar_carta_convocacao(uuid, integer, uuid[], text, text, jsonb) is
  'Registra a emissão da carta de convocação: modelo ativo e versão, candidatos (1 a 500, na ordem do documento; de listas vigentes e ativas da área do modelo e, se o modelo é de um edital, desse edital), agrupamento (UNICO ou POR_CANDIDATO), saída (SEI, DOCX ou PDF) e os valores de prazo, local, documentos e contato. Grava TH_CARTA_CONVOCACAO e RL_CARTA_CANDIDATO. Aprovados >= editor, a área e o recorte dos editais.';
revoke all on function public.registrar_carta_convocacao(uuid, integer, uuid[], text, text, jsonb) from public, anon;
grant execute on function public.registrar_carta_convocacao(uuid, integer, uuid[], text, text, jsonb) to authenticated;

-- 8. Leitura: cartas do candidato e convocações da área -------------------------------------------------
create function public.listar_cartas_do_candidato(p_candidato uuid)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_edital uuid;
  v_data date;
begin
  if not private.pode_recurso('aprovados', 1) then
    raise exception 'Sem permissão para este recurso' using errcode = '42501';
  end if;
  select m.id, c."DT_CONVOCACAO" into v_edital, v_data
    from public."TB_CANDIDATO_APROVADO" c
    join public."TB_LISTA_APROVADO" l on l.id = c.lista_id
    join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id
   where c.id = p_candidato;
  if v_edital is null then
    raise exception 'Candidato não encontrado' using errcode = '22023';
  end if;
  if not private."FC_PODE_VER_EDITAL"(v_edital) then
    raise exception 'Sem permissão para editais desta área ou coordenação' using errcode = '42501';
  end if;

  return json_build_object(
    'data_convocacao', v_data,
    'cartas', coalesce((
      with recursive anteriores(id, nivel) as (
        select p_candidato, 0
        union all
        select c."CO_CANDIDATO_ANTERIOR", a.nivel + 1
          from anteriores a
          join public."TB_CANDIDATO_APROVADO" c on c.id = a.id
         where c."CO_CANDIDATO_ANTERIOR" is not null and a.nivel < 50
      )
      select json_agg(json_build_object(
               'carta_id', e."CO_CARTA_CONVOCACAO",
               'emitida_em', e."DT_EMISSAO",
               'usuario', coalesce(e."NO_USUARIO", e."DS_EMAIL_USUARIO"),
               'modelo', t."NO_MODELO",
               'versao', e."NU_VERSAO_MODELO",
               'agrupamento', e."TP_AGRUPAMENTO",
               'saida', e."TP_SAIDA",
               'data_limite', e."DT_LIMITE",
               'candidatos', e."QT_CANDIDATO",
               'status_na_emissao', r."DS_STATUS_ANTERIOR",
               'convocacao_marcada', r."DT_CONVOCACAO_MARCADA")
             order by e."DT_EMISSAO" desc)
        from public."RL_CARTA_CANDIDATO" r
        join public."TH_CARTA_CONVOCACAO" e on e."CO_CARTA_CONVOCACAO" = r."CO_CARTA_CONVOCACAO"
        join public."TH_MODELO_CARTA_CONVOCACAO" t
          on t."CO_MODELO_CARTA" = e."CO_MODELO_CARTA" and t."NU_VERSAO" = e."NU_VERSAO_MODELO"
       where r."CO_CANDIDATO_APROVADO" in (select a.id from anteriores a)
    ), '[]'::json)
  );
end;
$function$;
comment on function public.listar_cartas_do_candidato(uuid) is
  'As cartas de convocação emitidas para o candidato (também nas listas anteriores do edital, por CO_CANDIDATO_ANTERIOR), da mais recente: quando, quem, modelo e versão, saída, data limite, quantos receberam a mesma carta e se a convocação foi marcada por ela; e a data da convocação atual. Aprovados >= leitor e o recorte do edital.';
revoke all on function public.listar_cartas_do_candidato(uuid) from public, anon;
grant execute on function public.listar_cartas_do_candidato(uuid) to authenticated;

create function public.listar_convocacoes_aprovados(p_area text)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_area text := lower(btrim(coalesce(p_area, '')));
begin
  if not private.pode_recurso('aprovados', 1) then
    raise exception 'Sem permissão para este recurso' using errcode = '42501';
  end if;
  if not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = v_area) then
    raise exception 'Área inválida: %', p_area using errcode = '22023';
  end if;
  if not (v_area = any ((select private."FC_AREAS_USUARIO"())::text[])) then
    raise exception 'Sem permissão para a lista de aprovados desta área' using errcode = '42501';
  end if;

  return coalesce((
    with recursive herdeiros(origem, atual, nivel) as (
      select distinct r."CO_CANDIDATO_APROVADO", r."CO_CANDIDATO_APROVADO", 0
        from public."RL_CARTA_CANDIDATO" r
      union all
      select h.origem, c.id, h.nivel + 1
        from herdeiros h
        join public."TB_CANDIDATO_APROVADO" c on c."CO_CANDIDATO_ANTERIOR" = h.atual
       where h.nivel < 50
    ),
    cartas as (
      select h.atual as candidato, count(distinct r."CO_CARTA_CONVOCACAO") as qt, max(e."DT_EMISSAO") as ultima
        from herdeiros h
        join public."RL_CARTA_CANDIDATO" r on r."CO_CANDIDATO_APROVADO" = h.origem
        join public."TH_CARTA_CONVOCACAO" e on e."CO_CARTA_CONVOCACAO" = r."CO_CARTA_CONVOCACAO"
       group by h.atual
    ),
    vivos as (
      select c.id, c."DT_CONVOCACAO"
        from public."TB_CANDIDATO_APROVADO" c
        join public."TB_LISTA_APROVADO" l on l.id = c.lista_id and l.vigente is true
        join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id
       where m."CO_AREA" = v_area and c.removido_em is null
         and (c."DT_CONVOCACAO" is not null or c.id in (select k.candidato from cartas k))
         and ((select private."FC_EDITAIS_VISIVEIS"()) is null
              or m.id = any ((select private."FC_EDITAIS_VISIVEIS"())::uuid[]))
    )
    select json_agg(json_build_object(
             'candidato_id', v.id, 'data_convocacao', v."DT_CONVOCACAO",
             'cartas', coalesce(k.qt, 0), 'ultima_carta', k.ultima))
      from vivos v
      left join cartas k on k.candidato = v.id
  ), '[]'::json);
end;
$function$;
comment on function public.listar_convocacoes_aprovados(text) is
  'Os candidatos das listas vigentes da área com data da convocação ou carta emitida (também nas listas anteriores): candidato_id, data_convocacao, quantas cartas e a última emissão. Aprovados >= leitor, a área do usuário e o recorte da coordenação.';
revoke all on function public.listar_convocacoes_aprovados(text) from public, anon;
grant execute on function public.listar_convocacoes_aprovados(text) to authenticated;
-- ═══ CORPO DA MIGRATION (fim) ═══

-- ═══════════════════════════════════════════════════════════════════════════
-- ENSAIO (tudo abaixo corre na mesma transação e é desfeito no rollback final)
-- ═══════════════════════════════════════════════════════════════════════════

-- E1. Estrutura: RLS sem grant direto; RPCs definer com search_path vazio; a função de
--     4 argumentos saiu; o domínio do status sem Fim de Fila e com Convocado.
do $$
declare
  v_def text;
begin
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
              where n.nspname = 'public'
                and c.relname in ('TB_MODELO_CARTA_CONVOCACAO', 'TH_MODELO_CARTA_CONVOCACAO',
                                  'TH_CARTA_CONVOCACAO', 'RL_CARTA_CANDIDATO')
                and not c.relrowsecurity) then
    raise exception 'FALHOU E1: tabela nova sem RLS';
  end if;
  if has_table_privilege('authenticated', 'public."TB_MODELO_CARTA_CONVOCACAO"', 'select,insert,update,delete')
     or has_table_privilege('authenticated', 'public."TH_MODELO_CARTA_CONVOCACAO"', 'select,insert,update,delete')
     or has_table_privilege('authenticated', 'public."TH_CARTA_CONVOCACAO"', 'select,insert,update,delete')
     or has_table_privilege('authenticated', 'public."RL_CARTA_CANDIDATO"', 'select,insert,update,delete') then
    raise exception 'FALHOU E1: authenticated com grant direto numa tabela nova';
  end if;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'
         and p.proname in ('alterar_status_candidato_aprovado', 'marcar_candidatos_convocados',
                           'listar_modelos_carta_convocacao', 'salvar_modelo_carta_convocacao',
                           'definir_modelo_carta_ativo', 'registrar_carta_convocacao',
                           'listar_cartas_do_candidato', 'listar_convocacoes_aprovados')
         and p.prosecdef and 'search_path=""' = any (coalesce(p.proconfig, '{}'))) <> 8 then
    raise exception 'FALHOU E1: RPC sem security definer, sem search_path vazio ou faltando';
  end if;
  if to_regprocedure('public.alterar_status_candidato_aprovado(uuid, text, text, text)') is not null then
    raise exception 'FALHOU E1: a função de 4 argumentos continua no banco';
  end if;
  select pg_get_constraintdef(c.oid) into v_def
    from pg_constraint c where c.conname = 'CK_CANDIDATO_APROVADO_STATUS';
  if v_def is null or v_def like '%Fim de Fila%' or v_def not like '%Convocado%' then
    raise exception 'FALHOU E1: domínio do status (%)', v_def;
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'TG_CANDAPROVADO_CONVOCACAO' and not tgisinternal) then
    raise exception 'FALHOU E1: gatilho da data da convocação ausente';
  end if;
  raise notice 'ok E1: RLS, sem grant direto, 8 RPCs definer, status sem Fim de Fila e com Convocado';
end;
$$;

-- E2. Atores sintéticos (editor = edital_gestor, leitor = usuario, admin), um edital real
--     sem lista, uma lista antiga (substituída) com uma carta já emitida e a lista vigente
--     com seis candidatos.
do $$
declare
  v_edital uuid;
  v_outro uuid;
  v_area text;
  v_antiga uuid;
  v_vigente uuid;
  v_dono constant uuid := '00000000-0000-4000-a000-00000000e401';
  v_modelo uuid;
  v_carta uuid;
  c uuid[] := array[]::uuid[];
  v_id uuid;
  v_c0 uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email) values
    ('00000000-0000-4000-a000-00000000e401', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.carta.editor@ensaio.invalid'),
    ('00000000-0000-4000-a000-00000000e402', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.carta.leitor@ensaio.invalid'),
    ('00000000-0000-4000-a000-00000000e403', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.carta.admin@ensaio.invalid');
  insert into public."TB_PERFIL_USUARIO" (user_id, email, nome, perfil, ativo) values
    ('00000000-0000-4000-a000-00000000e401', 'ensaio.carta.editor@ensaio.invalid', 'Ensaio Editor', 'edital_gestor', true),
    ('00000000-0000-4000-a000-00000000e402', 'ensaio.carta.leitor@ensaio.invalid', 'Ensaio Leitor', 'usuario', true),
    ('00000000-0000-4000-a000-00000000e403', 'ensaio.carta.admin@ensaio.invalid', 'Ensaio Admin', 'admin', true);

  select m.id, m."CO_AREA" into v_edital, v_area
    from public."TB_MONITORAMENTO_INDIGENA" m
   where m.ativo and m."CO_AREA" is not null
     and not exists (select 1 from public."TB_LISTA_APROVADO" l where l.edital_id = m.id::text)
   order by m.id limit 1;
  if v_edital is null then raise exception 'ENSAIO: nenhum edital ativo sem lista de aprovados'; end if;
  select m.id into v_outro from public."TB_MONITORAMENTO_INDIGENA" m
   where m."CO_AREA" = v_area and m.id <> v_edital order by m.id limit 1;
  insert into public."RL_PERFIL_USUARIO_AREA" ("CO_PERFIL_USUARIO", "CO_AREA")
  select u.id, v_area from public."TB_PERFIL_USUARIO" u where u.email like 'ensaio.carta.%@ensaio.invalid';

  -- A lista antiga, já substituída: c0 convocado em 01/10 e com uma carta emitida.
  insert into public."TB_LISTA_APROVADO" (edital_id, ativo, vigente, arquivo_nome, arquivo_path, importado_por)
  values (v_edital::text, false, false, 'antiga.xlsx', 'ensaio/antiga.xlsx', v_dono)
  returning id into v_antiga;
  insert into public."TB_CANDIDATO_APROVADO" (lista_id, codigo_vaga, cargo, classificacao, nota, nome, modalidade, status, "DT_CONVOCACAO", created_by, updated_by)
  values (v_antiga, 'ENS-1', 'Cargo do ensaio', 5, 70, 'Pessoa Da Lista Antiga Ensaio', 'Ampla', 'Convocado', date '2026-10-01', v_dono, v_dono)
  returning id into v_c0;
  insert into public."TB_MODELO_CARTA_CONVOCACAO" ("CO_AREA", "NO_MODELO", "NU_VERSAO_VIGENTE", "CO_USUARIO_CRIACAO")
  values (v_area, 'Modelo antigo do ensaio', 1, v_dono) returning "CO_MODELO_CARTA" into v_modelo;
  insert into public."TH_MODELO_CARTA_CONVOCACAO" ("CO_MODELO_CARTA", "NU_VERSAO", "NO_MODELO", "DS_TITULO", "DS_TEXTO", "CO_USUARIO")
  values (v_modelo, 1, 'Modelo antigo do ensaio', 'Carta', 'Prezado(a) {NOME}.', v_dono);
  insert into public."TH_CARTA_CONVOCACAO" ("CO_MODELO_CARTA", "NU_VERSAO_MODELO", "CO_AREA", "TP_AGRUPAMENTO", "TP_SAIDA", "QT_CANDIDATO", "CO_USUARIO")
  values (v_modelo, 1, v_area, 'UNICO', 'PDF', 1, v_dono) returning "CO_CARTA_CONVOCACAO" into v_carta;
  insert into public."RL_CARTA_CANDIDATO" ("CO_CARTA_CONVOCACAO", "CO_CANDIDATO_APROVADO", "CO_MONITORAMENTO", "NU_ORDEM", "NO_CANDIDATO")
  values (v_carta, v_c0, v_edital, 1, 'Pessoa Da Lista Antiga Ensaio');

  -- A lista vigente: c[1], c[2], c[4] sem status; c[3] contratado; c[5] veio de c0
  -- (o gatilho herda a data); c[6] sem status, para o modelo de outro edital.
  insert into public."TB_LISTA_APROVADO" (edital_id, ativo, vigente, arquivo_nome, arquivo_path, importado_por)
  values (v_edital::text, true, true, 'ensaio.xlsx', 'ensaio/ensaio.xlsx', v_dono)
  returning id into v_vigente;
  for i in 1..4 loop
    insert into public."TB_CANDIDATO_APROVADO" (lista_id, codigo_vaga, cargo, classificacao, nota, nome, modalidade, status, matricula, created_by, updated_by)
    values (v_vigente, 'ENS-1', 'Cargo do ensaio', i, 100 - i, 'Pessoa ' || i || ' Ensaio', 'Ampla',
            (case when i = 3 then 'Contratado' end), (case when i = 3 then 'M-3' end), v_dono, v_dono)
    returning id into v_id;
    c := c || v_id;
  end loop;
  insert into public."TB_CANDIDATO_APROVADO" (lista_id, codigo_vaga, cargo, classificacao, nota, nome, modalidade, status, "CO_CANDIDATO_ANTERIOR", created_by, updated_by)
  values (v_vigente, 'ENS-1', 'Cargo do ensaio', 5, 70, 'Pessoa Da Lista Antiga Ensaio', 'Ampla', 'Convocado', v_c0, v_dono, v_dono)
  returning id into v_id;
  c := c || v_id;
  insert into public."TB_CANDIDATO_APROVADO" (lista_id, codigo_vaga, cargo, classificacao, nota, nome, modalidade, created_by, updated_by)
  values (v_vigente, 'ENS-1', 'Cargo do ensaio', 6, 60, 'Pessoa 6 Ensaio', 'Ampla', v_dono, v_dono)
  returning id into v_id;
  c := c || v_id;

  perform set_config('ensaio.edital', v_edital::text, true);
  perform set_config('ensaio.outro', coalesce(v_outro::text, ''), true);
  perform set_config('ensaio.area', v_area, true);
  perform set_config('ensaio.c0', v_c0::text, true);
  perform set_config('ensaio.candidatos', array_to_string(c, ','), true);
  raise notice 'ok E2: edital % (área %), lista antiga com carta, lista vigente com 6 candidatos', v_edital, v_area;
end;
$$;

-- E3. O fluxo pelas RPCs, como cada pessoa (papel authenticated).
set local role authenticated;
do $$
declare
  c_editor constant text := '{"sub":"00000000-0000-4000-a000-00000000e401","role":"authenticated","email":"ensaio.carta.editor@ensaio.invalid"}';
  c_leitor constant text := '{"sub":"00000000-0000-4000-a000-00000000e402","role":"authenticated","email":"ensaio.carta.leitor@ensaio.invalid"}';
  c_admin constant text := '{"sub":"00000000-0000-4000-a000-00000000e403","role":"authenticated","email":"ensaio.carta.admin@ensaio.invalid"}';
  v_area text := current_setting('ensaio.area');
  v_outro uuid := nullif(current_setting('ensaio.outro'), '')::uuid;
  c uuid[] := string_to_array(current_setting('ensaio.candidatos'), ',')::uuid[];
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_conteudo constant jsonb := '{"nome":"Carta padrão do ensaio","titulo":"CARTA DE CONVOCAÇÃO","texto":"Prezado(a) {NOME},\nApresente-se até {DATA_LIMITE} em {LOCAL}.","local":"Sede","documentos":"RG\nCPF","contato":"rh@ensaio.invalid","prazo_dias":5}';
  v json;
  vb jsonb;
  v_modelo uuid;
  v_modelo_outro uuid;
  v_carta uuid;
begin
  -- Leitor: lê os modelos e não edita, não marca, não muda status.
  perform set_config('request.jwt.claims', c_leitor, true);
  v := public.listar_modelos_carta_convocacao(v_area);
  if (v ->> 'pode_editar')::boolean then raise exception 'FALHOU E3: leitor com pode_editar'; end if;
  begin
    perform public.salvar_modelo_carta_convocacao(null, v_area, null, v_conteudo, null, null);
    raise exception 'FALHOU E3: leitor salvou modelo';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.marcar_candidatos_convocados(array[c[1]], null, null);
    raise exception 'FALHOU E3: leitor marcou convocados';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.alterar_status_candidato_aprovado(c[1], 'Convocado', null, null, null);
    raise exception 'FALHOU E3: leitor alterou status';
  exception when insufficient_privilege then null;
  end;

  -- Editor: cria o modelo, versiona com motivo, conflito de versão e nome repetido.
  perform set_config('request.jwt.claims', c_editor, true);
  v := public.salvar_modelo_carta_convocacao(null, v_area, null, v_conteudo, null, null);
  v_modelo := (v ->> 'modelo_id')::uuid;
  if (v ->> 'versao')::integer <> 1 then raise exception 'FALHOU E3: primeira versão %', v; end if;
  begin
    perform public.salvar_modelo_carta_convocacao(v_modelo, v_area, null, v_conteudo, 1, null);
    raise exception 'FALHOU E3: segunda versão sem motivo';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.salvar_modelo_carta_convocacao(v_modelo, v_area, null, v_conteudo, 7, 'Ensaio: versão errada');
    raise exception 'FALHOU E3: salvou sobre versão diferente da vigente';
  exception when serialization_failure then null;
  end;
  begin
    perform public.salvar_modelo_carta_convocacao(null, v_area, null, v_conteudo, null, null);
    raise exception 'FALHOU E3: dois modelos ativos com o mesmo nome';
  exception when unique_violation then null;
  end;
  v := public.salvar_modelo_carta_convocacao(v_modelo, v_area, null,
         v_conteudo || '{"texto":"Prezado(a) {NOME}, convocamos para {CARGO}."}'::jsonb, 1, 'Ensaio: texto revisto');
  if (v ->> 'versao')::integer <> 2 then raise exception 'FALHOU E3: segunda versão %', v; end if;
  v := public.listar_modelos_carta_convocacao(v_area);
  if not (v ->> 'pode_editar')::boolean
     or not exists (select 1 from json_array_elements(v -> 'modelos') x
                     where (x ->> 'modelo_id')::uuid = v_modelo and (x ->> 'versao')::integer = 2
                       and json_array_length(x -> 'versoes') = 2
                       and x -> 'vigente' ->> 'texto' like '%{CARGO}%') then
    raise exception 'FALHOU E3: listar modelos depois da 2ª versão';
  end if;

  -- Status: Fim de Fila não existe mais; Convocado com data; do Convocado o editor segue o fluxo.
  begin
    perform public.alterar_status_candidato_aprovado(c[1], 'Fim de Fila', null, null, null);
    raise exception 'FALHOU E3: aceitou Fim de Fila';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.alterar_status_candidato_aprovado(c[1], 'Convocado', null, null, v_hoje + 1);
    raise exception 'FALHOU E3: aceitou data da convocação futura';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.alterar_status_candidato_aprovado(c[1], 'Desistente', null, null, v_hoje);
    raise exception 'FALHOU E3: aceitou data da convocação em outro status';
  exception when invalid_parameter_value then null;
  end;
  vb := public.alterar_status_candidato_aprovado(c[1], 'Convocado', null, null, v_hoje - 2);
  if (vb ->> 'data_convocacao')::date <> v_hoje - 2 then raise exception 'FALHOU E3: data da convocação %', vb; end if;
  vb := public.alterar_status_candidato_aprovado(c[1], 'Contratado', '00700.000001/2026-00', 'M-1', null);
  if (vb ->> 'data_convocacao')::date is distinct from v_hoje - 2 then
    raise exception 'FALHOU E3: a data da convocação não ficou depois do Contratado';
  end if;
  vb := public.alterar_status_candidato_aprovado(c[2], 'Convocado', null, null, null);
  if (vb ->> 'data_convocacao')::date <> v_hoje then raise exception 'FALHOU E3: data padrão da convocação'; end if;
  begin
    perform public.alterar_status_candidato_aprovado(c[2], null, null, null, null);
    raise exception 'FALHOU E3: editor tirou o status de um convocado';
  exception when raise_exception then
    if sqlerrm not like 'O status deste candidato ja foi definido%' then raise; end if;
  end;
  perform set_config('request.jwt.claims', c_admin, true);
  vb := public.alterar_status_candidato_aprovado(c[2], null, null, null, null);
  if vb ->> 'data_convocacao' is not null then raise exception 'FALHOU E3: sem status manteve a data'; end if;

  -- Carta: o editor emite para c2, c4 e c3 (contratado) e marca os convocáveis.
  perform set_config('request.jwt.claims', c_editor, true);
  begin
    perform public.registrar_carta_convocacao(v_modelo, 2, array[c[2]], 'TODAS', 'SEI', '{}'::jsonb);
    raise exception 'FALHOU E3: agrupamento inválido aceito';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.registrar_carta_convocacao(v_modelo, 9, array[c[2]], 'UNICO', 'SEI', '{}'::jsonb);
    raise exception 'FALHOU E3: versão inexistente aceita';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.registrar_carta_convocacao(v_modelo, 2, array[current_setting('ensaio.c0')::uuid], 'UNICO', 'SEI', '{}'::jsonb);
    raise exception 'FALHOU E3: carta para candidato de lista substituída';
  exception when invalid_parameter_value then null;
  end;
  v := public.registrar_carta_convocacao(v_modelo, 2, array[c[2], c[4], c[3], c[2]], 'UNICO', 'SEI',
         jsonb_build_object('data_limite', (v_hoje + 5)::text, 'local', 'Sede', 'documentos', E'RG\nCPF', 'contato', 'rh@ensaio.invalid'));
  v_carta := (v ->> 'carta_id')::uuid;
  if (v ->> 'candidatos')::integer <> 3 then raise exception 'FALHOU E3: candidatos da carta %', v; end if;
  v := public.marcar_candidatos_convocados(array[c[2], c[4], c[3]], null, v_carta);
  if (v ->> 'marcados')::integer <> 2 or json_array_length(v -> 'ignorados') <> 1
     or (v -> 'ignorados' -> 0 ->> 'candidato_id')::uuid <> c[3] then
    raise exception 'FALHOU E3: marcar convocados %', v;
  end if;
  begin
    perform public.marcar_candidatos_convocados(array[c[4]], v_hoje + 3, null);
    raise exception 'FALHOU E3: marcou com data futura';
  exception when invalid_parameter_value then null;
  end;

  -- Modelo de outro edital não serve para candidato deste edital.
  if v_outro is not null then
    v := public.salvar_modelo_carta_convocacao(null, v_area, v_outro, v_conteudo, null, null);
    v_modelo_outro := (v ->> 'modelo_id')::uuid;
    begin
      perform public.registrar_carta_convocacao(v_modelo_outro, 1, array[c[6]], 'POR_CANDIDATO', 'DOCX', '{}'::jsonb);
      raise exception 'FALHOU E3: modelo de outro edital aceito';
    exception when invalid_parameter_value then null;
    end;
  end if;

  -- Leitor: o histórico do candidato (também da lista antiga) e as convocações da área.
  perform set_config('request.jwt.claims', c_leitor, true);
  v := public.listar_cartas_do_candidato(c[4]);
  if json_array_length(v -> 'cartas') <> 1 or (v -> 'cartas' -> 0 ->> 'convocacao_marcada')::date <> v_hoje
     or (v ->> 'data_convocacao')::date <> v_hoje or v -> 'cartas' -> 0 ->> 'saida' <> 'SEI' then
    raise exception 'FALHOU E3: cartas do candidato %', v;
  end if;
  v := public.listar_cartas_do_candidato(c[5]);
  if json_array_length(v -> 'cartas') <> 1 or (v ->> 'data_convocacao')::date <> date '2026-10-01' then
    raise exception 'FALHOU E3: a carta da lista antiga não aparece no candidato da lista nova %', v;
  end if;
  v := public.listar_convocacoes_aprovados(v_area);
  if not exists (select 1 from json_array_elements(v) x
                  where (x ->> 'candidato_id')::uuid = c[4] and (x ->> 'cartas')::integer = 1
                    and (x ->> 'data_convocacao')::date = v_hoje)
     or not exists (select 1 from json_array_elements(v) x
                     where (x ->> 'candidato_id')::uuid = c[5] and (x ->> 'cartas')::integer = 1)
     or exists (select 1 from json_array_elements(v) x where (x ->> 'candidato_id')::uuid = c[6]) then
    raise exception 'FALHOU E3: convocações da área';
  end if;

  -- Inativar: some da emissão, continua no histórico; editar exige reativar.
  perform set_config('request.jwt.claims', c_editor, true);
  begin
    perform public.definir_modelo_carta_ativo(v_modelo, false, null);
    raise exception 'FALHOU E3: inativou sem motivo';
  exception when invalid_parameter_value then null;
  end;
  v := public.definir_modelo_carta_ativo(v_modelo, false, 'Ensaio: modelo substituído');
  begin
    perform public.registrar_carta_convocacao(v_modelo, 2, array[c[6]], 'UNICO', 'PDF', '{}'::jsonb);
    raise exception 'FALHOU E3: emitiu com modelo inativo';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.salvar_modelo_carta_convocacao(v_modelo, v_area, null, v_conteudo, 2, 'Ensaio: editar inativo');
    raise exception 'FALHOU E3: editou modelo inativo';
  exception when invalid_parameter_value then null;
  end;

  perform set_config('ensaio.carta', v_carta::text, true);
  perform set_config('ensaio.modelo', v_modelo::text, true);
  raise notice 'ok E3: permissões, versões, status Convocado, carta registrada, marcação e históricos';
end;
$$;

reset role;
select set_config('request.jwt.claims', '', true);

-- E4. O que ficou gravado.
do $$
declare
  c uuid[] := string_to_array(current_setting('ensaio.candidatos'), ',')::uuid[];
  v_carta uuid := current_setting('ensaio.carta')::uuid;
  v_modelo uuid := current_setting('ensaio.modelo')::uuid;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  r record;
begin
  select * into r from public."TB_CANDIDATO_APROVADO" where id = c[1];
  if r.status <> 'Contratado' or r.matricula <> 'M-1' or r."DT_CONVOCACAO" <> v_hoje - 2 then
    raise exception 'FALHOU E4: convocado que virou contratado (status %, data %)', r.status, r."DT_CONVOCACAO";
  end if;
  select * into r from public."TB_CANDIDATO_APROVADO" where id = c[5];
  if r."DT_CONVOCACAO" is distinct from date '2026-10-01' then
    raise exception 'FALHOU E4: o gatilho não herdou a data da convocação';
  end if;
  if (select count(*) from public."TB_CANDIDATO_APROVADO"
       where id in (c[2], c[4]) and status = 'Convocado' and "DT_CONVOCACAO" = v_hoje) <> 2 then
    raise exception 'FALHOU E4: os marcados não ficaram Convocado com a data';
  end if;
  if (select status from public."TB_CANDIDATO_APROVADO" where id = c[3]) <> 'Contratado' then
    raise exception 'FALHOU E4: o contratado foi marcado como convocado';
  end if;
  if (select count(*) from public."TH_CANDIDATO_APROVADO"
       where candidato_id in (c[2], c[4]) and "CO_CARTA_CONVOCACAO" = v_carta and status_novo = 'Convocado') <> 2 then
    raise exception 'FALHOU E4: o histórico do status não liga a marcação à carta';
  end if;
  if (select count(*) from public."RL_CARTA_CANDIDATO"
       where "CO_CARTA_CONVOCACAO" = v_carta and "DT_CONVOCACAO_MARCADA" = v_hoje) <> 2
     or (select "DS_STATUS_ANTERIOR" from public."RL_CARTA_CANDIDATO"
          where "CO_CARTA_CONVOCACAO" = v_carta and "CO_CANDIDATO_APROVADO" = c[3]) <> 'Contratado'
     or (select "NU_ORDEM" from public."RL_CARTA_CANDIDATO"
          where "CO_CARTA_CONVOCACAO" = v_carta and "CO_CANDIDATO_APROVADO" = c[4]) <> 2 then
    raise exception 'FALHOU E4: candidatos da carta (ordem, status na emissão, marcação)';
  end if;
  select * into r from public."TH_CARTA_CONVOCACAO" where "CO_CARTA_CONVOCACAO" = v_carta;
  if r."NU_VERSAO_MODELO" <> 2 or r."TP_SAIDA" <> 'SEI' or r."TP_AGRUPAMENTO" <> 'UNICO' or r."QT_CANDIDATO" <> 3
     or r."DT_LIMITE" <> v_hoje + 5 or r."NO_USUARIO" is distinct from 'Ensaio Editor' then
    raise exception 'FALHOU E4: registro da emissão incompleto';
  end if;
  if (select count(*) from public."TH_MODELO_CARTA_CONVOCACAO" where "CO_MODELO_CARTA" = v_modelo) <> 2
     or (select "DS_MOTIVO" from public."TH_MODELO_CARTA_CONVOCACAO" where "CO_MODELO_CARTA" = v_modelo and "NU_VERSAO" = 2) <> 'Ensaio: texto revisto'
     or (select "ST_ATIVO" from public."TB_MODELO_CARTA_CONVOCACAO" where "CO_MODELO_CARTA" = v_modelo) then
    raise exception 'FALHOU E4: versões ou situação do modelo';
  end if;
  begin
    update public."TB_CANDIDATO_APROVADO" set status = 'Fim de Fila' where id = c[6];
    raise exception 'FALHOU E4: o banco aceitou Fim de Fila';
  exception when check_violation then null;
  end;
  begin
    update public."TB_CANDIDATO_APROVADO" set status = 'Convocado', "DT_CONVOCACAO" = null where id = c[6];
    raise exception 'FALHOU E4: o banco aceitou Convocado sem data';
  exception when check_violation then null;
  end;
  raise notice 'ok E4: status, datas, carta, candidatos da carta, histórico e versões gravados';
end;
$$;

-- Resumo (o que o ensaio gravou, antes do rollback).
select
  'ENSAIO OK' as resultado,
  (select count(*) from public."TB_CANDIDATO_APROVADO" where status = 'Convocado') as convocados_no_ensaio,
  (select count(*) from public."TH_CARTA_CONVOCACAO") as cartas_no_ensaio;

rollback;
