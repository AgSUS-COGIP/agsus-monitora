/*
  ENSAIO de 20261002200000_gestor_coordenadas_e_ultimo_acesso.sql — begin … rollback.

  Como rodar: cole o arquivo inteiro no SQL Editor do Supabase (papel postgres) e
  execute. Ele abre uma transação, aplica o corpo da migration (copiado sem
  mudança, sem o begin/commit dela), confere o catálogo e percorre:
    E1  catálogo: FC_PODE_EDITAR_COORDENADA e FC_ULTIMO_ACESSO SECURITY DEFINER com
        search_path vazio e fora do alcance de authenticated; as 10 funções do
        editor sem is_master e com a checagem nova; grupo "Gestor"; índice do
        último evento por pessoa;
    E2  atores sintéticos (administrador global, gestor, leitor, e duas contas
        para o último acesso), um polo real do mapa da Saúde Indígena e um lugar
        real das vagas de Projetos com coordenada sintética;
    E3  leitor recebe 42501 nas RPCs dos dois mapas;
    E4  gestor (papel authenticated) lista pendências e corrige pela RPC nos dois
        mapas e desfaz na Saúde Indígena; a escrita DIRETA dele em lmap continua
        bloqueada;
    E5  as gravações do gestor chegaram às tabelas (lidas como dono, depois do
        reset role), com tolerância de 1e-9 grau;
    E6  último acesso: evento de uso recente > last_sign_in_at antigo, presença
        de conta desativada, e obter_matriz_acessos / listar_contas_desativadas
        devolvendo o valor novo.
  Termina em ROLLBACK: nada fica gravado.

  Resultado esperado: "ok E1" … "ok E6", "ENSAIO OK" e o resumo final.
  Qualquer "FALHOU …" interrompe e desfaz tudo; copie a mensagem.

  Mantenha em sincronia: tests/gestor-coordenadas-e-ultimo-acesso-migration.test.js
  confere que o corpo da migration aqui é idêntico ao do arquivo da migration.
*/
begin;

-- ═══ CORPO DA MIGRATION (início) ═══

-- 0. Pré-requisitos ---------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.transicionar_recurso_candidato(uuid, text, integer, text)') is null then
    raise exception 'Aplique antes 20261001170000_recursos_parecer_juridico.sql.';
  end if;
  if to_regprocedure('public.obter_classificacao_do_edital(uuid)') is null then
    raise exception 'Aplique antes 20261002150000_classificacao.sql.';
  end if;
  if not exists (
    select 1 from pg_constraint
     where conname = 'CK_LISTACLASSIF_TPLISTA'
       and pg_get_constraintdef(oid) like '%ENTREVISTA%') then
    raise exception 'Aplique antes 20261002170000_classificacao_lista_da_entrevista.sql.';
  end if;
end;
$$;

-- 1. Ajuste (uma versão por proposta) ----------------------------------------------------
create table public."TB_AJUSTE_PONTUACAO_RECURSO" (
  "CO_AJUSTE_PONTUACAO" uuid not null default gen_random_uuid(),
  "CO_RECURSO_CANDIDATO" uuid not null,
  "CO_MONITORAMENTO" uuid not null,
  "CO_ANALISE_CURRICULAR" uuid not null,
  "NU_VERSAO" integer not null,
  "TP_SITUACAO" varchar(10) not null default 'PROPOSTO',
  "TP_LISTA" varchar(20) not null,
  "DS_JUSTIFICATIVA" text,
  "DS_PREVIA" jsonb,
  "DS_PREVIA_APROVACAO" jsonb,
  "ST_MUDOU_POSICAO" varchar(1) not null default 'N',
  "DT_PROPOSTA" timestamptz not null default now(),
  "CO_USUARIO_PROPOSTA" uuid not null,
  "DT_APROVACAO" timestamptz,
  "CO_USUARIO_APROVACAO" uuid,
  "DT_CANCELAMENTO" timestamptz,
  "CO_USUARIO_CANCELAMENTO" uuid,
  "DS_MOTIVO_CANCELAMENTO" text,
  constraint "PK_TB_AJUSTE_PONTUACAO_RECURSO" primary key ("CO_AJUSTE_PONTUACAO"),
  constraint "UK_AJUSTEPONTREC_RECURSO_VERSAO" unique ("CO_RECURSO_CANDIDATO", "NU_VERSAO"),
  constraint "FK_RECURSOCANDIDATO_AJUSTEPONTREC" foreign key ("CO_RECURSO_CANDIDATO")
    references public."TB_RECURSO_CANDIDATO" ("CO_RECURSO_CANDIDATO"),
  constraint "FK_MONITORAMENTO_AJUSTEPONTREC" foreign key ("CO_MONITORAMENTO")
    references public."TB_MONITORAMENTO_INDIGENA" (id),
  constraint "FK_ANALISECURRICULAR_AJUSTEPONTREC" foreign key ("CO_ANALISE_CURRICULAR")
    references public."TB_ANALISE_CURRICULAR" (id),
  constraint "CK_AJUSTEPONTREC_TPSITUACAO" check ("TP_SITUACAO" in ('PROPOSTO', 'APROVADO', 'CANCELADO')),
  constraint "CK_AJUSTEPONTREC_TPLISTA" check ("TP_LISTA" in ('PRELIMINAR', 'ENTREVISTA', 'FINAL')),
  constraint "CK_AJUSTEPONTREC_NUVERSAO" check ("NU_VERSAO" >= 1),
  constraint "CK_AJUSTEPONTREC_STMUDOUPOSICAO" check ("ST_MUDOU_POSICAO" in ('S', 'N')),
  constraint "CK_AJUSTEPONTREC_TEXTOS" check (
    ("DS_JUSTIFICATIVA" is null or length("DS_JUSTIFICATIVA") between 10 and 4000)
    and ("DS_MOTIVO_CANCELAMENTO" is null or length("DS_MOTIVO_CANCELAMENTO") between 3 and 2000)),
  constraint "CK_AJUSTEPONTREC_PREVIA" check (
    ("DS_PREVIA" is null or jsonb_typeof("DS_PREVIA") = 'object')
    and ("DS_PREVIA_APROVACAO" is null or jsonb_typeof("DS_PREVIA_APROVACAO") = 'object')),
  constraint "CK_AJUSTEPONTREC_FLUXO" check (
    ("DT_APROVACAO" is null) = ("CO_USUARIO_APROVACAO" is null)
    and ("DT_CANCELAMENTO" is null) = ("CO_USUARIO_CANCELAMENTO" is null)
    and ("DT_CANCELAMENTO" is null) = ("DS_MOTIVO_CANCELAMENTO" is null)
    and ("TP_SITUACAO" <> 'PROPOSTO' or ("DT_APROVACAO" is null and "DT_CANCELAMENTO" is null))
    and ("TP_SITUACAO" <> 'APROVADO' or ("DT_APROVACAO" is not null and "DT_CANCELAMENTO" is null))
    and ("TP_SITUACAO" <> 'CANCELADO' or "DT_CANCELAMENTO" is not null)
    and ("ST_MUDOU_POSICAO" = 'N' or "DT_APROVACAO" is not null))
);
create unique index "UK_AJUSTEPONTREC_PROPOSTO" on public."TB_AJUSTE_PONTUACAO_RECURSO" ("CO_RECURSO_CANDIDATO")
  where "TP_SITUACAO" = 'PROPOSTO';
create unique index "UK_AJUSTEPONTREC_APROVADO" on public."TB_AJUSTE_PONTUACAO_RECURSO" ("CO_RECURSO_CANDIDATO")
  where "TP_SITUACAO" = 'APROVADO';
create index "IN_AJUSTEPONTREC_EDITAL" on public."TB_AJUSTE_PONTUACAO_RECURSO" ("CO_MONITORAMENTO", "TP_SITUACAO");
create index "IN_FKAJUSTEPONTREC_ANALISE" on public."TB_AJUSTE_PONTUACAO_RECURSO" ("CO_ANALISE_CURRICULAR");

comment on table public."TB_AJUSTE_PONTUACAO_RECURSO" is
  'Ajuste da pontuação de um candidato decidido em recurso (deferido total ou parcialmente): cada proposta é uma versão; os valores não mudam, só a situação (PROPOSTO, APROVADO, CANCELADO). A nota da análise e da entrevista nunca é sobrescrita; a Classificação aplica os aprovados por cima.';
comment on column public."TB_AJUSTE_PONTUACAO_RECURSO"."CO_AJUSTE_PONTUACAO" is 'Identificador da versão do ajuste.';
comment on column public."TB_AJUSTE_PONTUACAO_RECURSO"."CO_RECURSO_CANDIDATO" is 'Recurso que originou o ajuste (TB_RECURSO_CANDIDATO).';
comment on column public."TB_AJUSTE_PONTUACAO_RECURSO"."CO_MONITORAMENTO" is 'Edital do recurso (TB_MONITORAMENTO_INDIGENA.id), para a Classificação ler os ajustes do edital.';
comment on column public."TB_AJUSTE_PONTUACAO_RECURSO"."CO_ANALISE_CURRICULAR" is 'Candidato ajustado: a linha da análise curricular ligada ao recurso (TB_ANALISE_CURRICULAR.id).';
comment on column public."TB_AJUSTE_PONTUACAO_RECURSO"."NU_VERSAO" is 'Versão do ajuste no recurso (1, 2, …); cada proposta cria a seguinte.';
comment on column public."TB_AJUSTE_PONTUACAO_RECURSO"."TP_SITUACAO" is 'PROPOSTO (não vale na classificação), APROVADO (vale) ou CANCELADO (substituído, cancelado ou desfeito pela reabertura do recurso).';
comment on column public."TB_AJUSTE_PONTUACAO_RECURSO"."TP_LISTA" is 'Lista da etapa em que a prévia foi calculada: PRELIMINAR (documental), ENTREVISTA ou FINAL.';
comment on column public."TB_AJUSTE_PONTUACAO_RECURSO"."DS_JUSTIFICATIVA" is 'Justificativa geral (10 a 4.000 caracteres). Nula só quando cada item alterado tem a sua.';
comment on column public."TB_AJUSTE_PONTUACAO_RECURSO"."DS_PREVIA" is 'Prévia calculada pelo motor da Classificação ao propor: nota e posição antes e depois e quem muda de posição (resumo).';
comment on column public."TB_AJUSTE_PONTUACAO_RECURSO"."DS_PREVIA_APROVACAO" is 'Prévia recalculada no momento da aprovação (base de ST_MUDOU_POSICAO).';
comment on column public."TB_AJUSTE_PONTUACAO_RECURSO"."ST_MUDOU_POSICAO" is 'S: a prévia da aprovação mostrou mudança de posição ou de situação do candidato. Marca ST_MUDOU_CLASSIFICACAO do recurso.';
comment on column public."TB_AJUSTE_PONTUACAO_RECURSO"."DT_PROPOSTA" is 'Quando foi proposto.';
comment on column public."TB_AJUSTE_PONTUACAO_RECURSO"."CO_USUARIO_PROPOSTA" is 'Quem propôs (auth.users.id; parecer jurídico).';
comment on column public."TB_AJUSTE_PONTUACAO_RECURSO"."DT_APROVACAO" is 'Quando foi aprovado (passa a valer na Classificação).';
comment on column public."TB_AJUSTE_PONTUACAO_RECURSO"."CO_USUARIO_APROVACAO" is 'Quem aprovou (auth.users.id; parecer jurídico).';
comment on column public."TB_AJUSTE_PONTUACAO_RECURSO"."DT_CANCELAMENTO" is 'Quando foi cancelado (ou substituído, ou desfeito pela reabertura).';
comment on column public."TB_AJUSTE_PONTUACAO_RECURSO"."CO_USUARIO_CANCELAMENTO" is 'Quem cancelou (auth.users.id).';
comment on column public."TB_AJUSTE_PONTUACAO_RECURSO"."DS_MOTIVO_CANCELAMENTO" is 'Por que saiu (3 a 2.000 caracteres): motivo informado, "Substituído pela versão N" ou a mudança do recurso.';
comment on constraint "PK_TB_AJUSTE_PONTUACAO_RECURSO" on public."TB_AJUSTE_PONTUACAO_RECURSO" is 'Chave da versão do ajuste.';
comment on constraint "UK_AJUSTEPONTREC_RECURSO_VERSAO" on public."TB_AJUSTE_PONTUACAO_RECURSO" is 'Uma versão de cada número por recurso.';
comment on constraint "FK_RECURSOCANDIDATO_AJUSTEPONTREC" on public."TB_AJUSTE_PONTUACAO_RECURSO" is 'Recurso do ajuste.';
comment on constraint "FK_MONITORAMENTO_AJUSTEPONTREC" on public."TB_AJUSTE_PONTUACAO_RECURSO" is 'Edital do ajuste.';
comment on constraint "FK_ANALISECURRICULAR_AJUSTEPONTREC" on public."TB_AJUSTE_PONTUACAO_RECURSO" is 'Candidato (análise curricular) do ajuste.';
comment on constraint "CK_AJUSTEPONTREC_TPSITUACAO" on public."TB_AJUSTE_PONTUACAO_RECURSO" is 'Situações do ajuste.';
comment on constraint "CK_AJUSTEPONTREC_TPLISTA" on public."TB_AJUSTE_PONTUACAO_RECURSO" is 'Listas em que a prévia é calculada.';
comment on constraint "CK_AJUSTEPONTREC_NUVERSAO" on public."TB_AJUSTE_PONTUACAO_RECURSO" is 'Versão a partir de 1.';
comment on constraint "CK_AJUSTEPONTREC_STMUDOUPOSICAO" on public."TB_AJUSTE_PONTUACAO_RECURSO" is 'Flag S/N.';
comment on constraint "CK_AJUSTEPONTREC_TEXTOS" on public."TB_AJUSTE_PONTUACAO_RECURSO" is 'Justificativa de 10 a 4.000 e motivo do cancelamento de 3 a 2.000 caracteres.';
comment on constraint "CK_AJUSTEPONTREC_PREVIA" on public."TB_AJUSTE_PONTUACAO_RECURSO" is 'Prévias são objetos json.';
comment on constraint "CK_AJUSTEPONTREC_FLUXO" on public."TB_AJUSTE_PONTUACAO_RECURSO" is 'Aprovação e cancelamento guardam quando e quem juntos; cada situação tem os passos coerentes; mudança de posição só depois de aprovado.';
comment on index public."UK_AJUSTEPONTREC_PROPOSTO" is 'No máximo uma versão proposta por recurso.';
comment on index public."UK_AJUSTEPONTREC_APROVADO" is 'No máximo uma versão aprovada (vigente) por recurso.';
comment on index public."IN_AJUSTEPONTREC_EDITAL" is 'Ajustes do edital por situação (a Classificação lê os aprovados).';
comment on index public."IN_FKAJUSTEPONTREC_ANALISE" is 'Chave estrangeira para TB_ANALISE_CURRICULAR.';

-- 2. Itens do ajuste ----------------------------------------------------------------------
create table public."TB_ITEM_AJUSTE_PONTUACAO" (
  "CO_AJUSTE_PONTUACAO" uuid not null,
  "CO_ITEM" varchar(20) not null,
  "NU_ORDEM" smallint not null,
  "VL_ANTERIOR" numeric,
  "VL_NOVO" numeric not null,
  "DS_JUSTIFICATIVA" text,
  constraint "PK_TB_ITEM_AJUSTE_PONTUACAO" primary key ("CO_AJUSTE_PONTUACAO", "CO_ITEM"),
  constraint "FK_AJUSTEPONTREC_ITEMAJUSTEPONT" foreign key ("CO_AJUSTE_PONTUACAO")
    references public."TB_AJUSTE_PONTUACAO_RECURSO" ("CO_AJUSTE_PONTUACAO"),
  constraint "CK_ITEMAJUSTEPONT_COITEM" check (
    "CO_ITEM" ~ '^(ETNICO|FORMACAO|CURSOS|EXPERIENCIA|DOCUMENTAL|ENTREVISTA|ART|COMPETENCIA_([1-9]|1[0-9]|20))$'),
  constraint "CK_ITEMAJUSTEPONT_VALORES" check (
    "VL_NOVO" between 0 and 1000 and ("VL_ANTERIOR" is null or "VL_ANTERIOR" between 0 and 1000)),
  constraint "CK_ITEMAJUSTEPONT_NUORDEM" check ("NU_ORDEM" between 1 and 40),
  constraint "CK_ITEMAJUSTEPONT_JUSTIFICATIVA" check (coalesce(length("DS_JUSTIFICATIVA"), 0) <= 2000)
);
comment on table public."TB_ITEM_AJUSTE_PONTUACAO" is
  'Componentes da nota ajustados numa versão do ajuste do recurso: valor de antes (o da análise/entrevista, com os ajustes aprovados de outros recursos), valor novo e justificativa. Não mudam depois de gravados.';
comment on column public."TB_ITEM_AJUSTE_PONTUACAO"."CO_AJUSTE_PONTUACAO" is 'Versão do ajuste (TB_AJUSTE_PONTUACAO_RECURSO).';
comment on column public."TB_ITEM_AJUSTE_PONTUACAO"."CO_ITEM" is 'Componente: ETNICO, FORMACAO, CURSOS, EXPERIENCIA (parciais da documental), DOCUMENTAL (nota documental), ENTREVISTA (nota da entrevista), COMPETENCIA_n (competência n da entrevista) ou ART.';
comment on column public."TB_ITEM_AJUSTE_PONTUACAO"."NU_ORDEM" is 'Ordem do componente na tela.';
comment on column public."TB_ITEM_AJUSTE_PONTUACAO"."VL_ANTERIOR" is 'Valor do componente quando o ajuste foi proposto (nulo se a análise não tinha).';
comment on column public."TB_ITEM_AJUSTE_PONTUACAO"."VL_NOVO" is 'Valor do componente depois do recurso (0 a 1000). Substitui o da análise na Classificação quando o ajuste é aprovado.';
comment on column public."TB_ITEM_AJUSTE_PONTUACAO"."DS_JUSTIFICATIVA" is 'Justificativa do item (até 2.000 caracteres).';
comment on constraint "PK_TB_ITEM_AJUSTE_PONTUACAO" on public."TB_ITEM_AJUSTE_PONTUACAO" is 'Um valor por componente em cada versão.';
comment on constraint "FK_AJUSTEPONTREC_ITEMAJUSTEPONT" on public."TB_ITEM_AJUSTE_PONTUACAO" is 'Versão do ajuste do item.';
comment on constraint "CK_ITEMAJUSTEPONT_COITEM" on public."TB_ITEM_AJUSTE_PONTUACAO" is 'Componentes da nota conhecidos.';
comment on constraint "CK_ITEMAJUSTEPONT_VALORES" on public."TB_ITEM_AJUSTE_PONTUACAO" is 'Valores entre 0 e 1000.';
comment on constraint "CK_ITEMAJUSTEPONT_NUORDEM" on public."TB_ITEM_AJUSTE_PONTUACAO" is 'Ordem de 1 a 40.';
comment on constraint "CK_ITEMAJUSTEPONT_JUSTIFICATIVA" on public."TB_ITEM_AJUSTE_PONTUACAO" is 'Justificativa do item até 2.000 caracteres.';

-- 3. Acesso: só as funções ----------------------------------------------------------------
alter table public."TB_AJUSTE_PONTUACAO_RECURSO" enable row level security;
alter table public."TB_ITEM_AJUSTE_PONTUACAO" enable row level security;
revoke all on public."TB_AJUSTE_PONTUACAO_RECURSO", public."TB_ITEM_AJUSTE_PONTUACAO" from public, anon, authenticated;

-- 4. Versões imutáveis: só a situação anda --------------------------------------------------
create function private."FC_TG_AJUSTE_PONTUACAO_IMUTAVEL"()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if tg_op = 'DELETE' then
    raise exception 'Ajuste da pontuação não se apaga: cancele' using errcode = '42501';
  end if;
  if tg_table_name = 'TB_ITEM_AJUSTE_PONTUACAO' then
    raise exception 'Os itens de uma versão do ajuste não mudam: proponha outra versão' using errcode = '42501';
  end if;
  if (new."CO_RECURSO_CANDIDATO", new."CO_MONITORAMENTO", new."CO_ANALISE_CURRICULAR", new."NU_VERSAO",
      new."TP_LISTA", new."DS_JUSTIFICATIVA", new."DS_PREVIA", new."DT_PROPOSTA", new."CO_USUARIO_PROPOSTA")
     is distinct from
     (old."CO_RECURSO_CANDIDATO", old."CO_MONITORAMENTO", old."CO_ANALISE_CURRICULAR", old."NU_VERSAO",
      old."TP_LISTA", old."DS_JUSTIFICATIVA", old."DS_PREVIA", old."DT_PROPOSTA", old."CO_USUARIO_PROPOSTA") then
    raise exception 'Os valores de uma versão do ajuste não mudam: proponha outra versão' using errcode = '42501';
  end if;
  if new."TP_SITUACAO" is distinct from old."TP_SITUACAO"
     and not ((old."TP_SITUACAO" = 'PROPOSTO' and new."TP_SITUACAO" in ('APROVADO', 'CANCELADO'))
              or (old."TP_SITUACAO" = 'APROVADO' and new."TP_SITUACAO" = 'CANCELADO')) then
    raise exception 'Passagem inválida do ajuste: % → %', old."TP_SITUACAO", new."TP_SITUACAO" using errcode = '22023';
  end if;
  if old."TP_SITUACAO" = 'CANCELADO' then
    raise exception 'Ajuste cancelado não muda' using errcode = '22023';
  end if;
  return new;
end;
$function$;
comment on function private."FC_TG_AJUSTE_PONTUACAO_IMUTAVEL"() is
  'Gatilho dos ajustes da pontuação: nada se apaga; itens e valores de uma versão não mudam; a situação só anda PROPOSTO → APROVADO/CANCELADO e APROVADO → CANCELADO.';
revoke all on function private."FC_TG_AJUSTE_PONTUACAO_IMUTAVEL"() from public, anon, authenticated;

create trigger "TG_AJUSTEPONTREC_IMUTAVEL"
  before update or delete on public."TB_AJUSTE_PONTUACAO_RECURSO"
  for each row execute function private."FC_TG_AJUSTE_PONTUACAO_IMUTAVEL"();
comment on trigger "TG_AJUSTEPONTREC_IMUTAVEL" on public."TB_AJUSTE_PONTUACAO_RECURSO" is
  'Versões do ajuste imutáveis; só a situação anda (FC_TG_AJUSTE_PONTUACAO_IMUTAVEL).';
create trigger "TG_ITEMAJUSTEPONT_IMUTAVEL"
  before update or delete on public."TB_ITEM_AJUSTE_PONTUACAO"
  for each row execute function private."FC_TG_AJUSTE_PONTUACAO_IMUTAVEL"();
comment on trigger "TG_ITEMAJUSTEPONT_IMUTAVEL" on public."TB_ITEM_AJUSTE_PONTUACAO" is
  'Itens do ajuste não mudam nem se apagam (FC_TG_AJUSTE_PONTUACAO_IMUTAVEL).';

-- 5. Histórico do recurso ganha 'ajuste' ----------------------------------------------------
alter table public."TH_RECURSO_CANDIDATO" drop constraint "CK_HISTRECURSO_TPACAO";
alter table public."TH_RECURSO_CANDIDATO" add constraint "CK_HISTRECURSO_TPACAO"
  check ("TP_ACAO" in ('criacao', 'edicao', 'etapa', 'exclusao', 'anexo', 'resposta', 'parecer', 'ajuste'));
comment on constraint "CK_HISTRECURSO_TPACAO" on public."TH_RECURSO_CANDIDATO" is
  'Ações registradas: criacao, edicao, etapa, exclusao, anexo, resposta, parecer (fluxo jurídico) e ajuste (ajuste da pontuação).';
comment on column public."TH_RECURSO_CANDIDATO"."TP_ACAO" is
  'criacao, edicao, etapa, exclusao, anexo, resposta, parecer ou ajuste.';
comment on column public."TH_RECURSO_CANDIDATO"."DS_CAMPO" is
  'Campo editado, etapa, ação do anexo (inclusao, arquivamento), da resposta (criacao, enviar_revisao, aprovar, devolver, reabrir, marcar_enviada), do parecer (enviar_parecer, devolver, deferir, deferir_parcialmente, indeferir, reabrir) ou do ajuste da pontuação (propor, aprovar, cancelar). Nulo na criação e na exclusão do recurso.';

-- 6. Recurso: a caixa automática e o cancelamento ao reabrir --------------------------------
create function private."FC_TG_AJUSTE_DO_RECURSO"()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  v_pelo_ajuste boolean := coalesce(current_setting('monitora.ajuste_pontuacao', true), '') = 'S';
  v_motivo text;
  v_uid uuid;
  a record;
begin
  if tg_op = 'INSERT' then
    if new."ST_MUDOU_CLASSIFICACAO" = 'S' and not v_pelo_ajuste then
      raise exception 'A marca "O recurso mudou a classificação" é automática: vem do ajuste da pontuação aprovado' using errcode = '22023';
    end if;
    return new;
  end if;

  if new."ST_MUDOU_CLASSIFICACAO" is distinct from old."ST_MUDOU_CLASSIFICACAO" and not v_pelo_ajuste then
    raise exception 'A marca "O recurso mudou a classificação" é automática: vem do ajuste da pontuação aprovado' using errcode = '22023';
  end if;

  v_motivo := case
    when new."ST_ATIVO" = 'N' and old."ST_ATIVO" = 'S' then 'Recurso excluído.'
    when new."TP_SITUACAO" is distinct from old."TP_SITUACAO"
         and old."TP_SITUACAO" in ('DEFERIDO', 'PARCIALMENTE_INDEFERIDO') then 'Decisão do recurso reaberta.'
    when new."TP_SITUACAO" is distinct from old."TP_SITUACAO" and new."TP_SITUACAO" = 'INDEFERIDO' then 'Recurso indeferido.'
    when new."TP_SITUACAO" is distinct from old."TP_SITUACAO" and new."TP_SITUACAO" = 'REGISTRADO' then 'Recurso devolvido para ajuste.'
    else null end;
  if v_motivo is null then
    return new;
  end if;

  v_uid := coalesce((select auth.uid()), new."CO_USUARIO_ATUALIZACAO");
  for a in
    select j."CO_AJUSTE_PONTUACAO", j."TP_SITUACAO", j."NU_VERSAO"
      from public."TB_AJUSTE_PONTUACAO_RECURSO" j
     where j."CO_RECURSO_CANDIDATO" = new."CO_RECURSO_CANDIDATO"
       and j."TP_SITUACAO" in ('PROPOSTO', 'APROVADO')
     for update
  loop
    update public."TB_AJUSTE_PONTUACAO_RECURSO" set
      "TP_SITUACAO" = 'CANCELADO',
      "DT_CANCELAMENTO" = now(),
      "CO_USUARIO_CANCELAMENTO" = v_uid,
      "DS_MOTIVO_CANCELAMENTO" = v_motivo
    where "CO_AJUSTE_PONTUACAO" = a."CO_AJUSTE_PONTUACAO";
    insert into public."TH_RECURSO_CANDIDATO" ("CO_RECURSO_CANDIDATO", "TP_ACAO", "DS_CAMPO", "DS_VALOR_ANTERIOR", "DS_VALOR_NOVO", "DS_MOTIVO", "CO_USUARIO")
    values (new."CO_RECURSO_CANDIDATO", 'ajuste', 'cancelar', a."TP_SITUACAO", 'CANCELADO',
            format('Versão %s. %s', a."NU_VERSAO", v_motivo), v_uid);
    if a."TP_SITUACAO" = 'APROVADO' then
      new."ST_MUDOU_CLASSIFICACAO" := 'N';
    end if;
  end loop;
  return new;
end;
$function$;
comment on function private."FC_TG_AJUSTE_DO_RECURSO"() is
  'Gatilho de TB_RECURSO_CANDIDATO: ST_MUDOU_CLASSIFICACAO só muda pelas RPCs do ajuste da pontuação (22023); reabrir a decisão de um deferido, indeferir, devolver ou excluir cancela o ajuste proposto e o aprovado (com histórico) e desmarca a classificação mudada.';
revoke all on function private."FC_TG_AJUSTE_DO_RECURSO"() from public, anon, authenticated;

create trigger "TG_RECURSOCANDIDATO_AJUSTE"
  before insert or update on public."TB_RECURSO_CANDIDATO"
  for each row execute function private."FC_TG_AJUSTE_DO_RECURSO"();
comment on trigger "TG_RECURSOCANDIDATO_AJUSTE" on public."TB_RECURSO_CANDIDATO" is
  'Marca automática da classificação mudada e cancelamento do ajuste da pontuação quando o recurso deixa de estar deferido (FC_TG_AJUSTE_DO_RECURSO).';

comment on column public."TB_RECURSO_CANDIDATO"."ST_MUDOU_CLASSIFICACAO" is
  'S: o recurso mudou a classificação. Desde 20261005130000 é automática: marcada ao aprovar o ajuste da pontuação que muda a posição ou a situação do candidato e desmarcada quando esse ajuste é cancelado; valores anteriores (manuais) ficam.';

-- 7. Leitura: o json de um ajuste e os dados da Classificação --------------------------------
create function private."FC_AJUSTE_PONTUACAO_JSON"(p_ajuste uuid)
returns json
language sql
stable
security definer
set search_path to ''
as $function$
  select json_build_object(
           'id', j."CO_AJUSTE_PONTUACAO", 'recurso_id', j."CO_RECURSO_CANDIDATO", 'numero', r."NU_RECURSO",
           'origem', r."CO_ORIGEM_RECURSO", 'analise_id', j."CO_ANALISE_CURRICULAR", 'versao', j."NU_VERSAO",
           'situacao', j."TP_SITUACAO", 'lista', j."TP_LISTA", 'justificativa', j."DS_JUSTIFICATIVA",
           'previa', j."DS_PREVIA", 'previa_aprovacao', j."DS_PREVIA_APROVACAO",
           'mudou_posicao', j."ST_MUDOU_POSICAO" = 'S',
           'proposto_em', j."DT_PROPOSTA", 'proposto_por', private."FC_NOME_USUARIO"(j."CO_USUARIO_PROPOSTA"),
           'aprovado_em', j."DT_APROVACAO", 'aprovado_por', private."FC_NOME_USUARIO"(j."CO_USUARIO_APROVACAO"),
           'cancelado_em', j."DT_CANCELAMENTO", 'cancelado_por', private."FC_NOME_USUARIO"(j."CO_USUARIO_CANCELAMENTO"),
           'motivo_cancelamento', j."DS_MOTIVO_CANCELAMENTO",
           'itens', coalesce((
             select json_agg(json_build_object('codigo', i."CO_ITEM", 'anterior', i."VL_ANTERIOR", 'novo', i."VL_NOVO",
                                               'justificativa', i."DS_JUSTIFICATIVA") order by i."NU_ORDEM")
               from public."TB_ITEM_AJUSTE_PONTUACAO" i
              where i."CO_AJUSTE_PONTUACAO" = j."CO_AJUSTE_PONTUACAO"), '[]'::json))
    from public."TB_AJUSTE_PONTUACAO_RECURSO" j
    join public."TB_RECURSO_CANDIDATO" r on r."CO_RECURSO_CANDIDATO" = j."CO_RECURSO_CANDIDATO"
   where j."CO_AJUSTE_PONTUACAO" = p_ajuste;
$function$;
comment on function private."FC_AJUSTE_PONTUACAO_JSON"(uuid) is
  'Uma versão do ajuste da pontuação (json): recurso e número, situação, lista, justificativa, prévias, itens e quem/quando de cada passo.';
revoke all on function private."FC_AJUSTE_PONTUACAO_JSON"(uuid) from public, anon, authenticated;

-- O corpo de obter_classificacao_do_edital (20261002150000), sem o porteiro, com os ajustes aprovados.
create function private."FC_DADOS_CLASSIFICACAO_EDITAL"(p_edital uuid, p_area text)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_area text := p_area;
  v_m public."TB_MONITORAMENTO_INDIGENA";
  v_numero text;
begin
  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" where id = p_edital;
  v_numero := private."FC_NUMERO_EDITAL"(v_m.edital);
  return json_build_object(
    'schema_version', 1,
    'gerado_em', now(),
    'edital', json_build_object('id', v_m.id, 'edital', v_m.edital, 'unidade', v_m.unidade, 'area', v_area, 'numero', v_numero),
    'pode_editar', private.pode_recurso('classificacao', 2),
    'regra', private."FC_REGRA_CLASSIFICACAO_JSON"(p_edital),
    'catalogo', (
      select json_agg(json_build_object('codigo', k."CO_CRITERIO", 'nome', k."NO_CRITERIO", 'tipo', k."TP_VALOR",
               'direcao', k."TP_DIRECAO_PADRAO", 'ativo', k."ST_ATIVO" = 'S') order by k."NU_ORDEM")
        from public."TB_CRITERIO_CLASSIFICACAO" k),
    'cronograma', coalesce((
      select json_agg(json_build_object('ordem', c.ordem, 'atividade', c.atividade, 'inicio', c.data_inicio, 'fim', c.data_fim)
             order by c.ordem)
        from public."TB_CRONOGRAMA_MONIT_INDIG" c where c.monitoramento_id = p_edital), '[]'::json),
    'quadro', coalesce((
      select json_agg(json_build_object('id', q."CO_QUADRO_VAGA", 'ordem', q."NU_ORDEM", 'cargo', q."NO_CARGO",
               'lotacao', q."NO_LOTACAO", 'modalidades', q."DS_MODALIDADE_VAGA", 'vagas_imediatas', q."QT_VAGA_IMEDIATA",
               'cadastro_reserva', q."ST_CADASTRO_RESERVA" = 'S') order by q."NU_ORDEM")
        from public."TB_QUADRO_VAGA_EDITAL" q
       where q."CO_MONITORAMENTO" = p_edital and q."ST_REGISTRO_ATIVO" = 'S'), '[]'::json),
    'candidatos', coalesce((
      with a as (
        select a.* from public."TB_ANALISE_CURRICULAR" a
         where a."CO_AREA" = v_area and a.ativo and private."FC_NUMERO_EDITAL"(a.edital) = v_numero
      ),
      vq as (
        select n.nome_vaga, private."FC_QUADRO_DA_VAGA"(p_edital, n.nome_vaga) as quadro
          from (select distinct a.nome_vaga from a) n
      )
      select json_agg(json_build_object(
               'analise_id', a.id, 'codigo', a.id_origem, 'nome', a.candidato, 'vaga', a.codigo_vaga,
               'cargo', a.nome_vaga, 'categoria', a.categoria, 'modalidade', a.modalidade_concorrencia, 'pcd', a.pcd,
               'data_nascimento', a.data_nascimento, 'nota_documental', a.nota_final_ajustada, 'nota_art', a.nota_empregare,
               'pontuacao_formacao', a.pontuacao_escolaridade, 'pontuacao_cursos', a.pontuacao_cursos_aperfeicoamento,
               'pontuacao_experiencia', a.pontuacao_experiencia_profissional, 'pontuacao_etnica', a.pontuacao_criterio_etnico,
               'exp_saude_indigena', a.experiencia_saude_indigena_total, 'exp_atencao_basica', a.experiencia_atencao_basica_total,
               'exp_profissional', a.experiencia_profissional_total, 'status', a.status_consolidado, 'etapa', a.etapa,
               'quadro', vq.quadro)
             order by a.codigo_vaga, a.candidato)
        from a left join vq on vq.nome_vaga is not distinct from a.nome_vaga), '[]'::json),
    'entrevistas', coalesce((
      select json_agg(json_build_object(
               'id', e."CO_ENTREVISTA", 'analise_id', e."CO_ANALISE_CURRICULAR", 'nome', e."NO_CANDIDATO",
               'vaga', e."CO_VAGA", 'nota', e."VL_NOTA_TOTAL", 'parecer', e."TP_PARECER", 'compareceu', e."ST_COMPARECEU",
               'ligacao', e."TP_LIGACAO_ANALISE", 'origem', e."TP_ORIGEM",
               'notas', coalesce((select json_agg(json_build_object('ordem', n."NU_ORDEM", 'criterio', n."DS_CRITERIO", 'nota', n."VL_NOTA")
                                         order by n."NU_ORDEM")
                                    from public."TB_ENTREVISTA_NOTA" n where n."CO_ENTREVISTA" = e."CO_ENTREVISTA"), '[]'::json))
             order by e."CO_VAGA", e."NO_CANDIDATO")
        from public."TB_ENTREVISTA" e
       where e."ST_ATIVO" = 'S'
         and (e."CO_MONITORAMENTO" = p_edital
              or (e."CO_MONITORAMENTO" is null and e."CO_AREA" = v_area
                  and private."FC_NUMERO_EDITAL"(e."DS_EDITAL") = v_numero))), '[]'::json),
    'listas', coalesce((
      select json_agg(private."FC_LISTA_CLASSIFICACAO_JSON"(l."CO_LISTA_CLASSIFICACAO") order by l."DT_GERACAO" desc)
        from (select l."CO_LISTA_CLASSIFICACAO", l."DT_GERACAO"
                from public."TB_LISTA_CLASSIFICACAO" l
               where l."CO_MONITORAMENTO" = p_edital
               order by l."DT_GERACAO" desc limit 60) l), '[]'::json),
    'desempates', coalesce((
      select json_agg(private."FC_DESEMPATE_CLASSIFICACAO_JSON"(d."CO_DESEMPATE_CLASSIFICACAO") order by d."DT_REGISTRO")
        from public."TB_DESEMPATE_CLASSIFICACAO" d
       where d."CO_MONITORAMENTO" = p_edital and d."ST_ATIVO" = 'S'), '[]'::json),
    'ajustes', coalesce((
      select json_agg(private."FC_AJUSTE_PONTUACAO_JSON"(j."CO_AJUSTE_PONTUACAO") order by j."DT_APROVACAO", j."CO_AJUSTE_PONTUACAO")
        from public."TB_AJUSTE_PONTUACAO_RECURSO" j
       where j."CO_MONITORAMENTO" = p_edital and j."TP_SITUACAO" = 'APROVADO'), '[]'::json),
    'ajustes_mudaram_em', (
      select greatest(max(j."DT_APROVACAO"), max(j."DT_CANCELAMENTO") filter (where j."DT_APROVACAO" is not null))
        from public."TB_AJUSTE_PONTUACAO_RECURSO" j
       where j."CO_MONITORAMENTO" = p_edital)
  );
end;
$function$;
comment on function private."FC_DADOS_CLASSIFICACAO_EDITAL"(uuid, text) is
  'O que o motor de classificação precisa de um edital (json), sem conferir permissão: regra e versões, catálogo, cronograma, quadro, análises (sem CPF), entrevistas, listas, desempates, os ajustes da pontuação aprovados em recurso e quando eles mudaram por último. Usada por obter_classificacao_do_edital e obter_dados_previa_ajuste.';
revoke all on function private."FC_DADOS_CLASSIFICACAO_EDITAL"(uuid, text) from public, anon, authenticated;

create or replace function public.obter_classificacao_do_edital(p_edital uuid)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_area text := private."FC_EXIGIR_CLASSIFICACAO_EDITAL"(p_edital, 1);
begin
  return private."FC_DADOS_CLASSIFICACAO_EDITAL"(p_edital, v_area);
end;
$function$;
comment on function public.obter_classificacao_do_edital(uuid) is
  'Tudo o que o motor de classificação precisa de um edital (json): regra vigente e versões, catálogo de critérios, cronograma (data de corte), quadro de vagas, análises (sem CPF), entrevistas com notas por competência (ligadas por CO_ANALISE_CURRICULAR), listas geradas, desempates registrados, ajustes da pontuação aprovados em recurso (ajustes) e quando mudaram (ajustes_mudaram_em); pode_editar. Exige classificacao >= leitor, a área e o recorte da coordenação.';

-- 8. RPCs do ajuste ---------------------------------------------------------------------------
create function public.obter_ajustes_pontuacao_recurso(p_recurso uuid)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_r public."TB_RECURSO_CANDIDATO";
begin
  perform private."FC_EXIGIR_RECURSO_ACESSIVEL"(p_recurso, 1);
  select * into v_r from public."TB_RECURSO_CANDIDATO" where "CO_RECURSO_CANDIDATO" = p_recurso;
  return json_build_object(
    'recurso_id', p_recurso,
    'situacao', v_r."TP_SITUACAO",
    'pode_propor', private."FC_PODE_PARECER_RECURSO"() and v_r."ST_FORA_ANALISE" = 'N'
                   and v_r."TP_SITUACAO" in ('EM_ANALISE_JURIDICA', 'DEFERIDO', 'PARCIALMENTE_INDEFERIDO'),
    'pode_aprovar', private."FC_PODE_PARECER_RECURSO"() and v_r."TP_SITUACAO" in ('DEFERIDO', 'PARCIALMENTE_INDEFERIDO'),
    'pode_cancelar', private."FC_PODE_PARECER_RECURSO"(),
    'ajustes', coalesce((
      select json_agg(private."FC_AJUSTE_PONTUACAO_JSON"(j."CO_AJUSTE_PONTUACAO") order by j."NU_VERSAO" desc)
        from public."TB_AJUSTE_PONTUACAO_RECURSO" j
       where j."CO_RECURSO_CANDIDATO" = p_recurso), '[]'::json));
end;
$function$;
comment on function public.obter_ajustes_pontuacao_recurso(uuid) is
  'As versões do ajuste da pontuação de um recurso (json, da mais nova), com itens, prévias e quem/quando; pode_propor (parecer jurídico, recurso ligado à análise, em análise jurídica ou deferido), pode_aprovar (parecer jurídico, recurso deferido) e pode_cancelar. Exige Recursos >= leitor, a área e a coordenação do edital.';
revoke all on function public.obter_ajustes_pontuacao_recurso(uuid) from public, anon;
grant execute on function public.obter_ajustes_pontuacao_recurso(uuid) to authenticated, service_role;

create function public.obter_dados_previa_ajuste(p_recurso uuid)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_area text := private."FC_EXIGIR_RECURSO_ACESSIVEL"(p_recurso, 1);
  v_edital uuid;
begin
  perform private."FC_EXIGIR_PARECER_RECURSO"();
  select r."CO_MONITORAMENTO" into v_edital from public."TB_RECURSO_CANDIDATO" r where r."CO_RECURSO_CANDIDATO" = p_recurso;
  return private."FC_DADOS_CLASSIFICACAO_EDITAL"(v_edital, v_area);
end;
$function$;
comment on function public.obter_dados_previa_ajuste(uuid) is
  'Para a prévia do ajuste da pontuação: o mesmo json de obter_classificacao_do_edital, do edital do recurso (com os ajustes aprovados). Só o parecer jurídico (recursos_parecer; 42501), com Recursos >= leitor, a área e a coordenação do edital.';
revoke all on function public.obter_dados_previa_ajuste(uuid) from public, anon;
grant execute on function public.obter_dados_previa_ajuste(uuid) to authenticated, service_role;

create function public.propor_ajuste_pontuacao(p_recurso uuid, p_dados jsonb)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_r public."TB_RECURSO_CANDIDATO";
  v_lista text := upper(btrim(coalesce(p_dados ->> 'lista', '')));
  v_justificativa text := nullif(btrim(coalesce(p_dados ->> 'justificativa', '')), '');
  v_itens jsonb := p_dados -> 'itens';
  v_previa jsonb := p_dados -> 'previa';
  v_versao integer;
  v_id uuid;
  v_anterior public."TB_AJUSTE_PONTUACAO_RECURSO";
  v_mudados integer;
  v_sem_justificativa integer;
begin
  if v_uid is null then
    raise exception 'Sessão inválida' using errcode = '42501';
  end if;
  perform private."FC_EXIGIR_RECURSO_ACESSIVEL"(p_recurso, 1);
  perform private."FC_EXIGIR_PARECER_RECURSO"();

  select * into v_r from public."TB_RECURSO_CANDIDATO"
   where "CO_RECURSO_CANDIDATO" = p_recurso and "ST_ATIVO" = 'S'
   for update;
  if v_r."ST_FORA_ANALISE" = 'S' or v_r."CO_ANALISE_CURRICULAR" is null then
    raise exception 'O candidato não está ligado à análise: não há nota para ajustar' using errcode = '22023';
  end if;
  if v_r."TP_SITUACAO" not in ('EM_ANALISE_JURIDICA', 'DEFERIDO', 'PARCIALMENTE_INDEFERIDO') then
    raise exception 'O ajuste da pontuação é do recurso em análise jurídica ou deferido' using errcode = '22023';
  end if;
  if v_lista not in ('PRELIMINAR', 'ENTREVISTA', 'FINAL') then
    raise exception 'Lista da prévia inválida' using errcode = '22023';
  end if;
  if v_previa is not null and (jsonb_typeof(v_previa) <> 'object' or pg_column_size(v_previa) > 100000) then
    raise exception 'Prévia inválida' using errcode = '22023';
  end if;
  if jsonb_typeof(v_itens) is distinct from 'array' or jsonb_array_length(v_itens) not between 1 and 40 then
    raise exception 'Informe de 1 a 40 componentes' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_itens) i
     where case
             when jsonb_typeof(i) <> 'object' then true
             when coalesce(i ->> 'codigo', '') !~ '^(ETNICO|FORMACAO|CURSOS|EXPERIENCIA|DOCUMENTAL|ENTREVISTA|ART|COMPETENCIA_([1-9]|1[0-9]|20))$' then true
             when jsonb_typeof(i -> 'novo') is distinct from 'number' then true
             when (i ->> 'novo')::numeric not between 0 and 1000 then true
             when coalesce(jsonb_typeof(i -> 'anterior'), 'null') not in ('number', 'null') then true
             when jsonb_typeof(i -> 'anterior') = 'number' then (i ->> 'anterior')::numeric not between 0 and 1000
             else false
           end
        or length(coalesce(case when jsonb_typeof(i) = 'object' then i ->> 'justificativa' end, '')) > 2000) then
    raise exception 'Componente inválido: código conhecido, valor novo de 0 a 1000 e justificativa até 2.000 caracteres' using errcode = '22023';
  end if;
  if (select count(distinct i ->> 'codigo') from jsonb_array_elements(v_itens) i) <> jsonb_array_length(v_itens) then
    raise exception 'Componente repetido' using errcode = '22023';
  end if;
  select count(*),
         count(*) filter (where length(btrim(coalesce(i ->> 'justificativa', ''))) < 10)
    into v_mudados, v_sem_justificativa
    from jsonb_array_elements(v_itens) i
   where case when jsonb_typeof(i -> 'anterior') = 'number'
              then (i ->> 'anterior')::numeric <> (i ->> 'novo')::numeric
              else true end;
  if v_mudados = 0 then
    raise exception 'Nenhum valor mudou' using errcode = '22023';
  end if;
  if v_justificativa is not null and length(v_justificativa) not between 10 and 4000 then
    raise exception 'Justificativa geral de 10 a 4.000 caracteres' using errcode = '22023';
  end if;
  if v_justificativa is null and v_sem_justificativa > 0 then
    raise exception 'Escreva a justificativa geral ou a de cada componente alterado (10 caracteres ou mais)' using errcode = '22023';
  end if;

  select coalesce(max(j."NU_VERSAO"), 0) + 1 into v_versao
    from public."TB_AJUSTE_PONTUACAO_RECURSO" j where j."CO_RECURSO_CANDIDATO" = p_recurso;

  -- A proposta em aberto é substituída pela nova versão.
  select * into v_anterior from public."TB_AJUSTE_PONTUACAO_RECURSO"
   where "CO_RECURSO_CANDIDATO" = p_recurso and "TP_SITUACAO" = 'PROPOSTO'
   for update;
  if v_anterior."CO_AJUSTE_PONTUACAO" is not null then
    update public."TB_AJUSTE_PONTUACAO_RECURSO" set
      "TP_SITUACAO" = 'CANCELADO', "DT_CANCELAMENTO" = now(), "CO_USUARIO_CANCELAMENTO" = v_uid,
      "DS_MOTIVO_CANCELAMENTO" = format('Substituído pela versão %s.', v_versao)
    where "CO_AJUSTE_PONTUACAO" = v_anterior."CO_AJUSTE_PONTUACAO";
    insert into public."TH_RECURSO_CANDIDATO" ("CO_RECURSO_CANDIDATO", "TP_ACAO", "DS_CAMPO", "DS_VALOR_ANTERIOR", "DS_VALOR_NOVO", "DS_MOTIVO", "CO_USUARIO")
    values (p_recurso, 'ajuste', 'cancelar', 'PROPOSTO', 'CANCELADO',
            format('Versão %s. Substituído pela versão %s.', v_anterior."NU_VERSAO", v_versao), v_uid);
  end if;

  insert into public."TB_AJUSTE_PONTUACAO_RECURSO"
    ("CO_RECURSO_CANDIDATO", "CO_MONITORAMENTO", "CO_ANALISE_CURRICULAR", "NU_VERSAO", "TP_LISTA",
     "DS_JUSTIFICATIVA", "DS_PREVIA", "CO_USUARIO_PROPOSTA")
  values (p_recurso, v_r."CO_MONITORAMENTO", v_r."CO_ANALISE_CURRICULAR", v_versao, v_lista,
          v_justificativa, v_previa, v_uid)
  returning "CO_AJUSTE_PONTUACAO" into v_id;

  insert into public."TB_ITEM_AJUSTE_PONTUACAO"
    ("CO_AJUSTE_PONTUACAO", "CO_ITEM", "NU_ORDEM", "VL_ANTERIOR", "VL_NOVO", "DS_JUSTIFICATIVA")
  select v_id, i.valor ->> 'codigo', i.ordem,
         case when jsonb_typeof(i.valor -> 'anterior') = 'number' then (i.valor ->> 'anterior')::numeric end,
         (i.valor ->> 'novo')::numeric,
         nullif(btrim(coalesce(i.valor ->> 'justificativa', '')), '')
    from jsonb_array_elements(v_itens) with ordinality i(valor, ordem);

  insert into public."TH_RECURSO_CANDIDATO" ("CO_RECURSO_CANDIDATO", "TP_ACAO", "DS_CAMPO", "DS_VALOR_ANTERIOR", "DS_VALOR_NOVO", "DS_MOTIVO", "CO_USUARIO")
  values (p_recurso, 'ajuste', 'propor', null, 'PROPOSTO',
          format('Versão %s.%s', v_versao, coalesce(' ' || v_justificativa, '')), v_uid);

  return public.obter_ajustes_pontuacao_recurso(p_recurso);
end;
$function$;
comment on function public.propor_ajuste_pontuacao(uuid, jsonb) is
  'Propõe o ajuste da pontuação de um recurso (nova versão PROPOSTO; a proposta em aberto vira CANCELADO "substituído"). p_dados: lista (PRELIMINAR, ENTREVISTA, FINAL), justificativa geral, itens [{codigo, anterior, novo, justificativa}] e a prévia do motor. Justificativa geral ou a de cada componente alterado. Só o parecer jurídico (42501), recurso ligado à análise, em análise jurídica ou deferido (22023). Histórico em TH_RECURSO_CANDIDATO (ajuste).';
revoke all on function public.propor_ajuste_pontuacao(uuid, jsonb) from public, anon;
grant execute on function public.propor_ajuste_pontuacao(uuid, jsonb) to authenticated, service_role;

create function public.aprovar_ajuste_pontuacao(p_ajuste uuid, p_previa jsonb)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_j public."TB_AJUSTE_PONTUACAO_RECURSO";
  v_r public."TB_RECURSO_CANDIDATO";
  v_vigente public."TB_AJUSTE_PONTUACAO_RECURSO";
  v_mudou boolean;
begin
  if v_uid is null then
    raise exception 'Sessão inválida' using errcode = '42501';
  end if;
  select * into v_j from public."TB_AJUSTE_PONTUACAO_RECURSO" where "CO_AJUSTE_PONTUACAO" = p_ajuste;
  if v_j."CO_AJUSTE_PONTUACAO" is null then
    raise exception 'Ajuste não encontrado' using errcode = 'P0002';
  end if;
  perform private."FC_EXIGIR_RECURSO_ACESSIVEL"(v_j."CO_RECURSO_CANDIDATO", 1);
  perform private."FC_EXIGIR_PARECER_RECURSO"();
  if p_previa is null or jsonb_typeof(p_previa) <> 'object' or pg_column_size(p_previa) > 100000 then
    raise exception 'Confira a prévia antes de aprovar' using errcode = '22023';
  end if;

  select * into v_r from public."TB_RECURSO_CANDIDATO"
   where "CO_RECURSO_CANDIDATO" = v_j."CO_RECURSO_CANDIDATO" and "ST_ATIVO" = 'S'
   for update;
  select * into v_j from public."TB_AJUSTE_PONTUACAO_RECURSO" where "CO_AJUSTE_PONTUACAO" = p_ajuste for update;
  if v_j."TP_SITUACAO" <> 'PROPOSTO' then
    raise exception 'Só o ajuste proposto é aprovado' using errcode = '22023';
  end if;
  if v_r."TP_SITUACAO" not in ('DEFERIDO', 'PARCIALMENTE_INDEFERIDO') then
    raise exception 'Aprove o ajuste depois de deferir o recurso (total ou parcialmente)' using errcode = '22023';
  end if;
  v_mudou := coalesce(case when jsonb_typeof(p_previa -> 'mudou') = 'boolean' then (p_previa ->> 'mudou')::boolean end, false);

  -- O aprovado de antes (se houver) sai: vale só uma versão por recurso.
  select * into v_vigente from public."TB_AJUSTE_PONTUACAO_RECURSO"
   where "CO_RECURSO_CANDIDATO" = v_j."CO_RECURSO_CANDIDATO" and "TP_SITUACAO" = 'APROVADO'
   for update;
  if v_vigente."CO_AJUSTE_PONTUACAO" is not null then
    update public."TB_AJUSTE_PONTUACAO_RECURSO" set
      "TP_SITUACAO" = 'CANCELADO', "DT_CANCELAMENTO" = now(), "CO_USUARIO_CANCELAMENTO" = v_uid,
      "DS_MOTIVO_CANCELAMENTO" = format('Substituído pela versão %s.', v_j."NU_VERSAO")
    where "CO_AJUSTE_PONTUACAO" = v_vigente."CO_AJUSTE_PONTUACAO";
    insert into public."TH_RECURSO_CANDIDATO" ("CO_RECURSO_CANDIDATO", "TP_ACAO", "DS_CAMPO", "DS_VALOR_ANTERIOR", "DS_VALOR_NOVO", "DS_MOTIVO", "CO_USUARIO")
    values (v_j."CO_RECURSO_CANDIDATO", 'ajuste', 'cancelar', 'APROVADO', 'CANCELADO',
            format('Versão %s. Substituído pela versão %s.', v_vigente."NU_VERSAO", v_j."NU_VERSAO"), v_uid);
  end if;

  update public."TB_AJUSTE_PONTUACAO_RECURSO" set
    "TP_SITUACAO" = 'APROVADO', "DT_APROVACAO" = now(), "CO_USUARIO_APROVACAO" = v_uid,
    "DS_PREVIA_APROVACAO" = p_previa, "ST_MUDOU_POSICAO" = case when v_mudou then 'S' else 'N' end
  where "CO_AJUSTE_PONTUACAO" = p_ajuste;

  perform set_config('monitora.ajuste_pontuacao', 'S', true);
  update public."TB_RECURSO_CANDIDATO" set
    "ST_MUDOU_CLASSIFICACAO" = case when v_mudou then 'S' else 'N' end,
    "NU_REVISAO" = "NU_REVISAO" + 1,
    "DT_ATUALIZACAO" = now(),
    "CO_USUARIO_ATUALIZACAO" = v_uid
  where "CO_RECURSO_CANDIDATO" = v_j."CO_RECURSO_CANDIDATO";
  perform set_config('monitora.ajuste_pontuacao', 'N', true);

  insert into public."TH_RECURSO_CANDIDATO" ("CO_RECURSO_CANDIDATO", "TP_ACAO", "DS_CAMPO", "DS_VALOR_ANTERIOR", "DS_VALOR_NOVO", "DS_MOTIVO", "CO_USUARIO")
  values (v_j."CO_RECURSO_CANDIDATO", 'ajuste', 'aprovar', 'PROPOSTO', 'APROVADO',
          format('Versão %s. %s', v_j."NU_VERSAO",
                 case when v_mudou then 'Muda a classificação.' else 'Não muda a posição.' end), v_uid);

  return public.obter_ajustes_pontuacao_recurso(v_j."CO_RECURSO_CANDIDATO");
end;
$function$;
comment on function public.aprovar_ajuste_pontuacao(uuid, jsonb) is
  'Aprova o ajuste da pontuação proposto (passa a valer na Classificação; o aprovado de antes do mesmo recurso vira CANCELADO "substituído"). p_previa = a prévia recalculada pelo motor na aprovação; mudou = true marca "O recurso mudou a classificação" (senão desmarca). Só o parecer jurídico (42501) e com o recurso deferido, total ou parcialmente (22023). Histórico em TH_RECURSO_CANDIDATO (ajuste).';
revoke all on function public.aprovar_ajuste_pontuacao(uuid, jsonb) from public, anon;
grant execute on function public.aprovar_ajuste_pontuacao(uuid, jsonb) to authenticated, service_role;

create function public.cancelar_ajuste_pontuacao(p_ajuste uuid, p_motivo text)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_j public."TB_AJUSTE_PONTUACAO_RECURSO";
begin
  if v_uid is null then
    raise exception 'Sessão inválida' using errcode = '42501';
  end if;
  select * into v_j from public."TB_AJUSTE_PONTUACAO_RECURSO" where "CO_AJUSTE_PONTUACAO" = p_ajuste;
  if v_j."CO_AJUSTE_PONTUACAO" is null then
    raise exception 'Ajuste não encontrado' using errcode = 'P0002';
  end if;
  perform private."FC_EXIGIR_RECURSO_ACESSIVEL"(v_j."CO_RECURSO_CANDIDATO", 1);
  perform private."FC_EXIGIR_PARECER_RECURSO"();
  if length(coalesce(v_motivo, '')) not between 3 and 2000 then
    raise exception 'Informe o motivo (3 a 2.000 caracteres)' using errcode = '22023';
  end if;

  perform 1 from public."TB_RECURSO_CANDIDATO" where "CO_RECURSO_CANDIDATO" = v_j."CO_RECURSO_CANDIDATO" for update;
  select * into v_j from public."TB_AJUSTE_PONTUACAO_RECURSO" where "CO_AJUSTE_PONTUACAO" = p_ajuste for update;
  if v_j."TP_SITUACAO" not in ('PROPOSTO', 'APROVADO') then
    raise exception 'O ajuste já foi cancelado' using errcode = '22023';
  end if;

  update public."TB_AJUSTE_PONTUACAO_RECURSO" set
    "TP_SITUACAO" = 'CANCELADO', "DT_CANCELAMENTO" = now(), "CO_USUARIO_CANCELAMENTO" = v_uid,
    "DS_MOTIVO_CANCELAMENTO" = v_motivo
  where "CO_AJUSTE_PONTUACAO" = p_ajuste;

  if v_j."TP_SITUACAO" = 'APROVADO' then
    perform set_config('monitora.ajuste_pontuacao', 'S', true);
    update public."TB_RECURSO_CANDIDATO" set
      "ST_MUDOU_CLASSIFICACAO" = 'N',
      "NU_REVISAO" = "NU_REVISAO" + 1,
      "DT_ATUALIZACAO" = now(),
      "CO_USUARIO_ATUALIZACAO" = v_uid
    where "CO_RECURSO_CANDIDATO" = v_j."CO_RECURSO_CANDIDATO";
    perform set_config('monitora.ajuste_pontuacao', 'N', true);
  end if;

  insert into public."TH_RECURSO_CANDIDATO" ("CO_RECURSO_CANDIDATO", "TP_ACAO", "DS_CAMPO", "DS_VALOR_ANTERIOR", "DS_VALOR_NOVO", "DS_MOTIVO", "CO_USUARIO")
  values (v_j."CO_RECURSO_CANDIDATO", 'ajuste', 'cancelar', v_j."TP_SITUACAO", 'CANCELADO',
          format('Versão %s. %s', v_j."NU_VERSAO", v_motivo), v_uid);

  return public.obter_ajustes_pontuacao_recurso(v_j."CO_RECURSO_CANDIDATO");
end;
$function$;
comment on function public.cancelar_ajuste_pontuacao(uuid, text) is
  'Cancela o ajuste da pontuação proposto ou aprovado, com motivo (3 a 2.000 caracteres); cancelar o aprovado tira o ajuste da Classificação e desmarca "O recurso mudou a classificação". Só o parecer jurídico (42501). Histórico em TH_RECURSO_CANDIDATO (ajuste).';
revoke all on function public.cancelar_ajuste_pontuacao(uuid, text) from public, anon;
grant execute on function public.cancelar_ajuste_pontuacao(uuid, text) to authenticated, service_role;

-- ═══ CORPO DA MIGRATION (fim) ═══

-- ═══════════════════════════════════════════════════════════════════════════
-- ENSAIO (tudo abaixo corre na mesma transação e é desfeito no rollback final)
-- ═══════════════════════════════════════════════════════════════════════════

-- E1. Estrutura: tabelas com RLS e sem grant; RPCs definer com search_path vazio.
do $$
begin
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
              where n.nspname = 'public' and c.relname in ('TB_AJUSTE_PONTUACAO_RECURSO', 'TB_ITEM_AJUSTE_PONTUACAO')
                and not c.relrowsecurity) then
    raise exception 'FALHOU E1: tabela do ajuste sem RLS';
  end if;
  if has_table_privilege('authenticated', 'public."TB_AJUSTE_PONTUACAO_RECURSO"', 'select,insert,update,delete')
     or has_table_privilege('authenticated', 'public."TB_ITEM_AJUSTE_PONTUACAO"', 'select,insert,update,delete') then
    raise exception 'FALHOU E1: authenticated com grant direto nas tabelas do ajuste';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public'
                and p.proname in ('obter_ajustes_pontuacao_recurso', 'obter_dados_previa_ajuste', 'propor_ajuste_pontuacao',
                                  'aprovar_ajuste_pontuacao', 'cancelar_ajuste_pontuacao', 'obter_classificacao_do_edital')
                and (not p.prosecdef or not ('search_path=""' = any (coalesce(p.proconfig, '{}'))))) then
    raise exception 'FALHOU E1: RPC sem security definer ou sem search_path vazio';
  end if;
  raise notice 'ok E1: RLS ligada, sem grant direto, RPCs definer com search_path vazio';
end;
$$;

-- E2. Atores sintéticos e um candidato real (o de menor nota numa vaga com mais candidatos).
do $$
declare
  v_edital uuid;
  v_area text;
  v_analise uuid;
  v_vaga text;
begin
  with a as (
    select m.id as edital, m."CO_AREA" as area, x.id as analise, x.codigo_vaga as vaga,
           case when x.nota_final_ajustada::text ~ '^-?[0-9]+([.,][0-9]+)?$'
                then replace(x.nota_final_ajustada::text, ',', '.')::numeric end as nota
      from public."TB_MONITORAMENTO_INDIGENA" m
      join public."TB_ANALISE_CURRICULAR" x
        on x."CO_AREA" = m."CO_AREA" and x.ativo
       and private."FC_NUMERO_EDITAL"(x.edital) = private."FC_NUMERO_EDITAL"(m.edital)
     where m.ativo and m."CO_AREA" is not null and x.codigo_vaga is not null
  )
  select a.edital, a.area, a.analise, a.vaga into v_edital, v_area, v_analise, v_vaga
    from a
   where a.nota is not null
     and exists (select 1 from a b where b.edital = a.edital and b.vaga = a.vaga and b.analise <> a.analise and b.nota > a.nota)
   order by a.nota, a.analise
   limit 1;
  if v_analise is null then raise exception 'ENSAIO: nenhum edital ativo com dois candidatos de notas diferentes na mesma vaga'; end if;
  perform set_config('ensaio.edital', v_edital::text, true);
  perform set_config('ensaio.area', v_area, true);
  perform set_config('ensaio.analise', v_analise::text, true);
  perform set_config('ensaio.vaga', v_vaga, true);
  perform set_config('ensaio.nota_planilha',
    coalesce((select x.nota_final_ajustada::text from public."TB_ANALISE_CURRICULAR" x where x.id = v_analise), ''), true);

  insert into auth.users (id, instance_id, aud, role, email) values
    ('00000000-0000-4000-a000-00000000e201', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.ajuste.editor@ensaio.invalid'),
    ('00000000-0000-4000-a000-00000000e202', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.ajuste.juridico@ensaio.invalid'),
    ('00000000-0000-4000-a000-00000000e203', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.ajuste.leitor@ensaio.invalid');
  insert into public."TB_PERFIL_USUARIO" (user_id, email, nome, perfil, ativo) values
    ('00000000-0000-4000-a000-00000000e201', 'ensaio.ajuste.editor@ensaio.invalid', 'Ensaio Editor', 'edital_gestor', true),
    ('00000000-0000-4000-a000-00000000e202', 'ensaio.ajuste.juridico@ensaio.invalid', 'Ensaio Jurídico', 'juridico', true),
    ('00000000-0000-4000-a000-00000000e203', 'ensaio.ajuste.leitor@ensaio.invalid', 'Ensaio Leitor', 'usuario', true);
  insert into public."RL_PERFIL_USUARIO_AREA" ("CO_PERFIL_USUARIO", "CO_AREA")
  select u.id, v_area from public."TB_PERFIL_USUARIO" u where u.email like 'ensaio.ajuste.%@ensaio.invalid';
  raise notice 'ok E2: atores criados; edital %, área %, vaga %, análise %', v_edital, v_area, v_vaga, v_analise;
end;
$$;

-- Posição do candidato na nota documental da vaga, lida do json da prévia
-- (o ajuste aprovado por cima da nota da análise). Função só do ensaio: some
-- no rollback (nunca chega a ser vista por outra sessão).
create function public."FC_ENSAIO_POSICAO_AJUSTE"(p_dados json, p_analise uuid, p_vaga text)
returns integer
language sql
as $function$
  with c as (
    select (x ->> 'analise_id')::uuid as analise,
           coalesce(
             (select (i ->> 'novo')::numeric
                from json_array_elements(p_dados -> 'ajustes') j, json_array_elements(j -> 'itens') i
               where (j ->> 'analise_id')::uuid = (x ->> 'analise_id')::uuid and i ->> 'codigo' = 'DOCUMENTAL'
               order by j ->> 'aprovado_em' desc limit 1),
             case when x ->> 'nota_documental' ~ '^-?[0-9]+([.,][0-9]+)?$'
                  then replace(x ->> 'nota_documental', ',', '.')::numeric end) as nota
      from json_array_elements(p_dados -> 'candidatos') x
     where x ->> 'vaga' = p_vaga
  )
  select 1 + count(*)::integer from c o, c a
   where a.analise = p_analise and o.analise <> a.analise and o.nota > a.nota;
$function$;
grant execute on function public."FC_ENSAIO_POSICAO_AJUSTE"(json, uuid, text) to authenticated;

-- E3. O fluxo, como cada pessoa, pelas RPCs (papel authenticated).
set local role authenticated;
do $$
declare
  c_editor constant text := '{"sub":"00000000-0000-4000-a000-00000000e201","role":"authenticated","email":"ensaio.ajuste.editor@ensaio.invalid"}';
  c_juridico constant text := '{"sub":"00000000-0000-4000-a000-00000000e202","role":"authenticated","email":"ensaio.ajuste.juridico@ensaio.invalid"}';
  c_leitor constant text := '{"sub":"00000000-0000-4000-a000-00000000e203","role":"authenticated","email":"ensaio.ajuste.leitor@ensaio.invalid"}';
  v_analise uuid := current_setting('ensaio.analise')::uuid;
  v_vaga text := current_setting('ensaio.vaga');
  v_area text := current_setting('ensaio.area');
  v json;
  v_dados json;
  v_id uuid;
  v_rev integer;
  v_ajuste uuid;
  v_antes integer;
  v_depois integer;
  v_maior numeric;
  v_itens jsonb;
begin
  -- Editor cadastra o recurso ligado à análise e envia para parecer; não propõe ajuste.
  perform set_config('request.jwt.claims', c_editor, true);
  v := public.salvar_recurso_candidato(jsonb_build_object(
    'edital_id', current_setting('ensaio.edital'), 'origem', 'analise-curricular',
    'fora_analise', false, 'analise_id', v_analise, 'permitir_duplicado', true));
  v_id := (v->>'id')::uuid;
  v_rev := (v->>'revisao')::integer;
  v := public.transicionar_recurso_candidato(v_id, 'enviar_parecer', v_rev, null);
  v_rev := (v->>'revisao')::integer;
  begin
    perform public.propor_ajuste_pontuacao(v_id, '{"lista":"PRELIMINAR","justificativa":"Editor tentando ajustar.","itens":[{"codigo":"DOCUMENTAL","anterior":1,"novo":2}]}'::jsonb);
    raise exception 'FALHOU E3: editor propôs ajuste';
  exception when insufficient_privilege then null;
  end;
  if (public.obter_ajustes_pontuacao_recurso(v_id)->>'pode_propor')::boolean then
    raise exception 'FALHOU E3: editor com pode_propor';
  end if;

  -- Leitor: não lê os dados da prévia.
  perform set_config('request.jwt.claims', c_leitor, true);
  begin
    perform public.obter_dados_previa_ajuste(v_id);
    raise exception 'FALHOU E3: leitor leu os dados da prévia';
  exception when insufficient_privilege then null;
  end;
  raise notice 'ok E3.1: editor e leitor não propõem nem leem a prévia (42501)';

  -- Jurídico: propõe (em análise jurídica) a nota documental acima da maior da vaga.
  perform set_config('request.jwt.claims', c_juridico, true);
  v_dados := public.obter_dados_previa_ajuste(v_id);
  v_antes := public."FC_ENSAIO_POSICAO_AJUSTE"(v_dados, v_analise, v_vaga);
  select max(case when x ->> 'nota_documental' ~ '^-?[0-9]+([.,][0-9]+)?$'
                  then replace(x ->> 'nota_documental', ',', '.')::numeric end)
    into v_maior
    from json_array_elements(v_dados -> 'candidatos') x where x ->> 'vaga' = v_vaga;
  v_itens := jsonb_build_array(jsonb_build_object(
    'codigo', 'DOCUMENTAL',
    'anterior', (select case when x ->> 'nota_documental' ~ '^-?[0-9]+([.,][0-9]+)?$'
                             then replace(x ->> 'nota_documental', ',', '.')::numeric end
                   from json_array_elements(v_dados -> 'candidatos') x where (x ->> 'analise_id')::uuid = v_analise),
    'novo', least(1000, v_maior + 1),
    'justificativa', 'Experiência comprovada no recurso.'));
  begin
    perform public.propor_ajuste_pontuacao(v_id, jsonb_build_object('lista', 'PRELIMINAR', 'itens',
      jsonb_build_array(jsonb_build_object('codigo', 'DOCUMENTAL', 'anterior', 1, 'novo', 2))));
    raise exception 'FALHOU E3: proposta sem justificativa';
  exception when invalid_parameter_value then null;
  end;
  v := public.propor_ajuste_pontuacao(v_id, jsonb_build_object('lista', 'PRELIMINAR', 'itens', v_itens,
         'justificativa', 'Deferimento da experiência profissional.', 'previa', jsonb_build_object('mudou', true)));
  v_ajuste := (v -> 'ajustes' -> 0 ->> 'id')::uuid;
  if v -> 'ajustes' -> 0 ->> 'situacao' <> 'PROPOSTO' or (v -> 'ajustes' -> 0 ->> 'versao')::integer <> 1 then
    raise exception 'FALHOU E3: proposta não ficou PROPOSTO v1';
  end if;
  v_dados := public.obter_dados_previa_ajuste(v_id);
  if exists (select 1 from json_array_elements(v_dados -> 'ajustes') j where (j ->> 'recurso_id')::uuid = v_id) then
    raise exception 'FALHOU E3: ajuste proposto entrou na classificação';
  end if;
  if public."FC_ENSAIO_POSICAO_AJUSTE"(v_dados, v_analise, v_vaga) <> v_antes then
    raise exception 'FALHOU E3: posição mudou com o ajuste só proposto';
  end if;
  begin
    perform public.aprovar_ajuste_pontuacao(v_ajuste, '{"mudou":true}'::jsonb);
    raise exception 'FALHOU E3: aprovou antes de deferir';
  exception when invalid_parameter_value then null;
  end;
  raise notice 'ok E3.2: proposto não vale (posição %), não aprova antes de deferir (22023)', v_antes;

  -- Jurídico defere e aprova: vale na classificação, muda a posição e marca o recurso.
  v := public.transicionar_recurso_candidato(v_id, 'deferir', v_rev, 'Defiro: a experiência foi comprovada no recurso.');
  v_rev := (v->>'revisao')::integer;
  perform set_config('request.jwt.claims', c_editor, true);
  begin
    perform public.aprovar_ajuste_pontuacao(v_ajuste, '{"mudou":true}'::jsonb);
    raise exception 'FALHOU E3: editor aprovou o ajuste';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claims', c_juridico, true);
  v := public.aprovar_ajuste_pontuacao(v_ajuste, jsonb_build_object('mudou', true, 'tipo', 'PRELIMINAR',
         'antes', jsonb_build_object('posicao', v_antes), 'depois', jsonb_build_object('posicao', 1)));
  if v -> 'ajustes' -> 0 ->> 'situacao' <> 'APROVADO' or not (v -> 'ajustes' -> 0 ->> 'mudou_posicao')::boolean then
    raise exception 'FALHOU E3: aprovação';
  end if;
  v_dados := public.obter_dados_previa_ajuste(v_id);
  if not exists (select 1 from json_array_elements(v_dados -> 'ajustes') j where (j ->> 'id')::uuid = v_ajuste) then
    raise exception 'FALHOU E3: aprovado fora da classificação';
  end if;
  if v_dados ->> 'ajustes_mudaram_em' is null then
    raise exception 'FALHOU E3: ajustes_mudaram_em vazio depois da aprovação';
  end if;
  v_depois := public."FC_ENSAIO_POSICAO_AJUSTE"(v_dados, v_analise, v_vaga);
  if v_depois <> 1 or v_depois >= v_antes then
    raise exception 'FALHOU E3: a posição não mudou (antes %, depois %)', v_antes, v_depois;
  end if;
  if not (select (r ->> 'mudou_classificacao')::boolean
            from json_array_elements(public.get_recursos_da_area(v_area) -> 'recursos') r
           where (r ->> 'id')::uuid = v_id) then
    raise exception 'FALHOU E3: o recurso não ficou com a classificação mudada';
  end if;
  raise notice 'ok E3.3: aprovado vale (posição % → %) e marca "mudou a classificação"', v_antes, v_depois;

  -- A marca é automática: o salvar não a muda; editor não cancela o ajuste.
  perform set_config('request.jwt.claims', c_editor, true);
  v_rev := (select (r ->> 'revisao')::integer
              from json_array_elements(public.get_recursos_da_area(v_area) -> 'recursos') r
             where (r ->> 'id')::uuid = v_id);
  begin
    perform public.salvar_recurso_candidato(jsonb_build_object('id', v_id, 'revisao', v_rev, 'origem', 'analise-curricular',
      'mudou_classificacao', false));
    raise exception 'FALHOU E3: salvar desmarcou a classificação mudada';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.cancelar_ajuste_pontuacao(v_ajuste, 'Editor tentando cancelar');
    raise exception 'FALHOU E3: editor cancelou o ajuste';
  exception when insufficient_privilege then null;
  end;
  raise notice 'ok E3.4: a marca é automática (22023) e editor não cancela (42501)';

  -- Jurídico reabre a decisão: o ajuste aprovado é cancelado e sai da classificação.
  perform set_config('request.jwt.claims', c_juridico, true);
  perform public.transicionar_recurso_candidato(v_id, 'reabrir', v_rev, 'Erro material na análise do recurso');
  v := public.obter_ajustes_pontuacao_recurso(v_id);
  if v -> 'ajustes' -> 0 ->> 'situacao' <> 'CANCELADO'
     or v -> 'ajustes' -> 0 ->> 'motivo_cancelamento' <> 'Decisão do recurso reaberta.' then
    raise exception 'FALHOU E3: reabrir não cancelou o ajuste';
  end if;
  v_dados := public.obter_dados_previa_ajuste(v_id);
  if exists (select 1 from json_array_elements(v_dados -> 'ajustes') j where (j ->> 'recurso_id')::uuid = v_id) then
    raise exception 'FALHOU E3: ajuste cancelado continua na classificação';
  end if;
  if public."FC_ENSAIO_POSICAO_AJUSTE"(v_dados, v_analise, v_vaga) <> v_antes then
    raise exception 'FALHOU E3: posição não voltou depois de reabrir';
  end if;
  if (select (r ->> 'mudou_classificacao')::boolean
        from json_array_elements(public.get_recursos_da_area(v_area) -> 'recursos') r
       where (r ->> 'id')::uuid = v_id) then
    raise exception 'FALHOU E3: a classificação mudada não foi desmarcada';
  end if;

  perform set_config('ensaio.recurso', v_id::text, true);
  perform set_config('ensaio.ajuste', v_ajuste::text, true);
  raise notice 'ok E3.5: reabrir cancela o ajuste, a posição volta (%) e a marca sai', v_antes;
end;
$$;
reset role;

-- E4. Histórico e imutabilidade (como postgres, depois do reset role).
do $$
declare
  v_recurso uuid := current_setting('ensaio.recurso')::uuid;
  v_ajuste uuid := current_setting('ensaio.ajuste')::uuid;
begin
  if (select string_agg("DS_CAMPO", ',' order by "CO_HISTORICO_RECURSO")
        from public."TH_RECURSO_CANDIDATO" where "CO_RECURSO_CANDIDATO" = v_recurso and "TP_ACAO" = 'ajuste')
     is distinct from 'propor,aprovar,cancelar' then
    raise exception 'FALHOU E4: histórico do ajuste incompleto';
  end if;
  if exists (select 1 from public."TB_AJUSTE_PONTUACAO_RECURSO"
              where "CO_AJUSTE_PONTUACAO" = v_ajuste
                and ("CO_USUARIO_PROPOSTA" is null or "CO_USUARIO_APROVACAO" is null or "CO_USUARIO_CANCELAMENTO" is null)) then
    raise exception 'FALHOU E4: quem propôs, aprovou ou cancelou se perdeu';
  end if;
  begin
    update public."TB_ITEM_AJUSTE_PONTUACAO" set "VL_NOVO" = 0 where "CO_AJUSTE_PONTUACAO" = v_ajuste;
    raise exception 'FALHOU E4: item do ajuste mudou';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public."TB_AJUSTE_PONTUACAO_RECURSO" where "CO_AJUSTE_PONTUACAO" = v_ajuste;
    raise exception 'FALHOU E4: ajuste apagado';
  exception when insufficient_privilege then null;
  end;
  begin
    update public."TB_AJUSTE_PONTUACAO_RECURSO" set "TP_SITUACAO" = 'APROVADO' where "CO_AJUSTE_PONTUACAO" = v_ajuste;
    raise exception 'FALHOU E4: cancelado voltou a aprovado';
  exception when invalid_parameter_value then null;
  end;
  raise notice 'ok E4: histórico propor → aprovar → cancelar, quem e quando guardados; versões imutáveis';
end;
$$;

-- E5. A nota da planilha não foi tocada.
do $$
begin
  if (select coalesce(x.nota_final_ajustada::text, '') from public."TB_ANALISE_CURRICULAR" x
       where x.id = current_setting('ensaio.analise')::uuid) is distinct from current_setting('ensaio.nota_planilha') then
    raise exception 'FALHOU E5: a nota da análise mudou';
  end if;
  raise notice 'ok E5: a nota da análise curricular continua a mesma (o ajuste é tabela própria)';
end;
$$;

-- Resumo.
select
  (select string_agg(j."TP_SITUACAO" || ' v' || j."NU_VERSAO", ', ')
     from public."TB_AJUSTE_PONTUACAO_RECURSO" j
    where j."CO_RECURSO_CANDIDATO" = current_setting('ensaio.recurso')::uuid) as versoes,
  (select string_agg(h."DS_CAMPO", ' → ' order by h."CO_HISTORICO_RECURSO")
     from public."TH_RECURSO_CANDIDATO" h
    where h."CO_RECURSO_CANDIDATO" = current_setting('ensaio.recurso')::uuid and h."TP_ACAO" = 'ajuste') as historico,
  current_setting('ensaio.nota_planilha') as nota_da_planilha,
  'ENSAIO OK (tudo será desfeito)' as resultado;

rollback;
