/*
  RECURSOS: AJUSTE DA PONTUAÇÃO NO RECURSO DEFERIDO

  Até aqui o recurso registrava a decisão e uma caixa manual "O recurso mudou a
  classificação"; a nota vinha só da análise curricular (planilha) e a tela
  comparava "nota atual" × "nota no cadastro". Agora, no recurso deferido (total
  ou parcialmente), quem decide propõe o ajuste da pontuação do candidato nos
  componentes da nota da regra de classificação do edital (pertencimento
  étnico, formação, cursos, experiência, nota documental, entrevista e cada
  competência, ART), com o valor de antes, o novo e a justificativa; quem aprova
  a resposta (o parecer jurídico) aprova o ajuste. A Classificação aplica os
  ajustes aprovados por cima da nota da análise.

  NADA SE PERDE
    - A nota da análise (TB_ANALISE_CURRICULAR) e a da entrevista
      (TB_ENTREVISTA) NUNCA são sobrescritas: o ajuste fica em tabela própria.
    - Cada proposta é uma versão nova (NU_VERSAO) com os itens; os itens e os
      valores de uma versão não mudam (gatilhos); só a situação anda:
          PROPOSTO ─aprovar→ APROVADO ─cancelar/reabrir/substituir→ CANCELADO
          PROPOSTO ─cancelar/substituir→ CANCELADO
      com quem e quando em cada passo, e a passagem também vai para
      TH_RECURSO_CANDIDATO (TP_ACAO 'ajuste').

  O QUE ENTRA
    public."TB_AJUSTE_PONTUACAO_RECURSO"  uma versão do ajuste de um recurso:
                                          situação, lista da prévia, justificativa
                                          geral, prévia da proposta e da aprovação
                                          (calculadas pelo motor da Classificação),
                                          quem/quando propôs, aprovou e cancelou
    public."TB_ITEM_AJUSTE_PONTUACAO"     os componentes ajustados de uma versão:
                                          valor de antes, valor novo, justificativa
    RPCs (SECURITY DEFINER, search_path vazio):
      obter_ajustes_pontuacao_recurso(p_recurso)   versões, itens, quem pode
      obter_dados_previa_ajuste(p_recurso)         o que o motor precisa (mesmo
                                                   json da Classificação) para a
                                                   prévia; só o parecer jurídico
      propor_ajuste_pontuacao(p_recurso, p_dados)  nova versão PROPOSTO
      aprovar_ajuste_pontuacao(p_ajuste, p_previa) PROPOSTO → APROVADO
      cancelar_ajuste_pontuacao(p_ajuste, p_motivo)
    obter_classificacao_do_edital passa a ler de
    private."FC_DADOS_CLASSIFICACAO_EDITAL" (o mesmo corpo de 20261002150000)
    e ganha 'ajustes' (os aprovados do edital) e 'ajustes_mudaram_em' (última
    aprovação ou cancelamento de aprovado: a tela avisa "gere de novo" quando a
    lista é anterior).

  PERMISSÕES
    Propor = quem decide o recurso; aprovar = quem aprova a resposta — hoje os
    dois são o parecer jurídico (recursos_parecer = editor,
    FC_EXIGIR_PARECER_RECURSO; 42501). Propor: recurso em análise jurídica ou
    deferido (total ou parcialmente), ligado à análise. Aprovar: só com o
    recurso deferido — e decidir já exige o parecer jurídico. Ver as versões:
    Recursos >= leitor, área e coordenação do edital.

  REABRIR / DESFAZER
    Gatilho TG_RECURSOCANDIDATO_AJUSTE (antes de gravar o recurso): reabrir a
    decisão de um deferido, indeferir, devolver para ajuste ou excluir o recurso
    cancela o ajuste proposto e o aprovado, com o motivo e o histórico.

  "O RECURSO MUDOU A CLASSIFICAÇÃO" (ST_MUDOU_CLASSIFICACAO) FICA AUTOMÁTICA
    Continua existindo (KPIs, filtros, CSV e o histórico a usam), mas deixa de
    ser caixa manual: aprovar o ajuste a marca quando a prévia da aprovação
    (motor da Classificação, calculada no navegador no momento da aprovação e
    gravada em DS_PREVIA_APROVACAO) mostra mudança de posição ou de situação do
    candidato; cancelar o ajuste aprovado a desmarca. Mudar a coluna por outra
    via é recusado (22023); os valores manuais de antes ficam como estão.

  PRÉ-REQUISITO: 20261001170000 e 20261002170000 aplicadas (a migration para se
  não estiverem).

  Ensaio: supabase/ensaios/20261005130000_recurso_ajusta_pontuacao.sql
  Rollback: supabase/rollback/20261005130000_recurso_ajusta_pontuacao.sql
*/
begin;

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

commit;
