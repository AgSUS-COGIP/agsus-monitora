/*
  RASCUNHO DAS REGRAS GUARDADO NO BANCO (por edital e por pessoa)

  Incidente de 13/10/2026: a regra da avaliação documental do 114/2026 estava
  sendo editada no assistente e, ao recarregar a página, tudo se perdeu — o
  rascunho morava só na memória da tela. Agora o rascunho do assistente e do
  modo avançado (e o do editor da regra de classificação) é guardado a cada
  mudança e volta ao abrir a regra, neste ou em outro computador.

  O QUE ENTRA
    public."TB_RASCUNHO_REGRA"   o rascunho não salvo de uma regra: tipo
                                 (ANALISE = regra da avaliação documental;
                                 CLASSIFICACAO = regra de classificação),
                                 edital, pessoa, o JSON da tela e a versão da
                                 regra de onde ele partiu. Uma linha por tipo +
                                 edital + pessoa; salvar a regra (versão nova)
                                 ou descartar apaga a linha (é rascunho, não
                                 registro de auditoria: as versões ficam em
                                 TH_REGRA_ANALISE e TH_REGRA_CLASSIFICACAO).

  QUEM PODE
    Só quem edita a regra, com as mesmas travas das RPCs que salvam:
      ANALISE        private."FC_EXIGIR_COORD_AVALIACAO" (salvar_regra_analise)
      CLASSIFICACAO  private."FC_EXIGIR_CLASSIFICACAO_EDITAL"(edital, 2)
                     (salvar_regra_classificacao)
    Cada pessoa só lê e grava o próprio rascunho. Descartar o próprio rascunho
    não exige a permissão (quem a perdeu ainda pode limpar o que deixou).
    Tabela com RLS e sem grant: só as funções abaixo.

  RPCs
    salvar_rascunho_regra(p_tipo, p_edital, p_conteudo, p_versao_base)
    obter_rascunho_regra(p_tipo, p_edital)
    descartar_rascunho_regra(p_tipo, p_edital)
  O formato do conteúdo é da tela (src/app/rascunho-da-regra.ts e
  src/lib/rascunho-da-regra.ts): o banco confere só que é um objeto de até
  1 MB; a regra é validada de novo ao salvar a versão.

  PRÉ-REQUISITO: 20261006100000 (regra da análise) e 20261002150000
  (classificação) aplicadas — a migration para se não estiverem.

  Ensaio: supabase/ensaios/20261013120000_rascunho_das_regras.sql
  Rollback: supabase/rollback/20261013120000_rascunho_das_regras.sql
*/
begin;

set local lock_timeout = '10s';

-- 0. Pré-requisitos ---------------------------------------------------------------------
do $$
begin
  if to_regprocedure('private."FC_EXIGIR_COORD_AVALIACAO"(uuid)') is null then
    raise exception 'Aplique antes 20261006100000_regra_da_analise.sql.';
  end if;
  if to_regprocedure('private."FC_EXIGIR_CLASSIFICACAO_EDITAL"(uuid, integer)') is null then
    raise exception 'Aplique antes 20261002150000_classificacao.sql.';
  end if;
end;
$$;

-- 1. Tabela -----------------------------------------------------------------------------
create table public."TB_RASCUNHO_REGRA" (
  "TP_REGRA" varchar(13) not null,
  "CO_MONITORAMENTO" uuid not null,
  "CO_USUARIO" uuid not null,
  "DS_CONTEUDO" jsonb not null,
  "NU_VERSAO_BASE" integer not null default 0,
  "DT_CRIACAO" timestamptz not null default now(),
  "DT_ATUALIZACAO" timestamptz not null default now(),
  constraint "PK_TB_RASCUNHO_REGRA" primary key ("TP_REGRA", "CO_MONITORAMENTO", "CO_USUARIO"),
  constraint "FK_MONITORAMENTO_RASCUNHOREGRA" foreign key ("CO_MONITORAMENTO")
    references public."TB_MONITORAMENTO_INDIGENA" (id) on delete cascade,
  constraint "FK_USUARIO_RASCUNHOREGRA" foreign key ("CO_USUARIO") references auth.users (id) on delete cascade,
  constraint "CK_RASCUNHOREGRA_TPREGRA" check ("TP_REGRA" in ('ANALISE', 'CLASSIFICACAO')),
  constraint "CK_RASCUNHOREGRA_CONTEUDO" check (jsonb_typeof("DS_CONTEUDO") = 'object'
                                                and octet_length("DS_CONTEUDO"::text) <= 1048576),
  constraint "CK_RASCUNHOREGRA_NUVERSAO" check ("NU_VERSAO_BASE" >= 0)
);
create index "IN_FKRASCUNHOREGRA_EDITAL" on public."TB_RASCUNHO_REGRA" ("CO_MONITORAMENTO");
create index "IN_FKRASCUNHOREGRA_USUARIO" on public."TB_RASCUNHO_REGRA" ("CO_USUARIO");
comment on table public."TB_RASCUNHO_REGRA" is
  'Rascunho não salvo de uma regra (da avaliação documental ou de classificação), por edital e por pessoa: guardado a cada mudança na tela e devolvido ao abrir a regra. Salvar a versão nova ou descartar apaga a linha.';
comment on column public."TB_RASCUNHO_REGRA"."TP_REGRA" is 'ANALISE (regra da avaliação documental) ou CLASSIFICACAO (regra de classificação).';
comment on column public."TB_RASCUNHO_REGRA"."CO_MONITORAMENTO" is 'Edital (TB_MONITORAMENTO_INDIGENA.id).';
comment on column public."TB_RASCUNHO_REGRA"."CO_USUARIO" is 'Dono do rascunho (auth.users.id); só ele vê.';
comment on column public."TB_RASCUNHO_REGRA"."DS_CONTEUDO" is 'O rascunho da tela (objeto json de até 1 MB; formato de src/lib/rascunho-da-regra.ts). Validado como regra só ao salvar a versão.';
comment on column public."TB_RASCUNHO_REGRA"."NU_VERSAO_BASE" is 'Versão vigente da regra quando o rascunho começou (0: sem regra). Diferente da vigente = outra pessoa salvou no meio.';
comment on column public."TB_RASCUNHO_REGRA"."DT_CRIACAO" is 'Primeira gravação do rascunho.';
comment on column public."TB_RASCUNHO_REGRA"."DT_ATUALIZACAO" is 'Última gravação do rascunho.';
comment on constraint "PK_TB_RASCUNHO_REGRA" on public."TB_RASCUNHO_REGRA" is 'Um rascunho por tipo de regra, edital e pessoa.';
comment on constraint "FK_MONITORAMENTO_RASCUNHOREGRA" on public."TB_RASCUNHO_REGRA" is 'Edital do rascunho; apagar o edital apaga o rascunho.';
comment on constraint "FK_USUARIO_RASCUNHOREGRA" on public."TB_RASCUNHO_REGRA" is 'Dono do rascunho; apagar a conta apaga o rascunho.';
comment on constraint "CK_RASCUNHOREGRA_TPREGRA" on public."TB_RASCUNHO_REGRA" is 'Tipos de regra válidos.';
comment on constraint "CK_RASCUNHOREGRA_CONTEUDO" on public."TB_RASCUNHO_REGRA" is 'Conteúdo é um objeto json de até 1 MB.';
comment on constraint "CK_RASCUNHOREGRA_NUVERSAO" on public."TB_RASCUNHO_REGRA" is 'Versão base 0 (sem regra) ou maior.';
comment on index public."IN_FKRASCUNHOREGRA_EDITAL" is 'Chave estrangeira para TB_MONITORAMENTO_INDIGENA.';
comment on index public."IN_FKRASCUNHOREGRA_USUARIO" is 'Chave estrangeira para auth.users.';

alter table public."TB_RASCUNHO_REGRA" enable row level security;
revoke all on public."TB_RASCUNHO_REGRA" from public, anon, authenticated;

-- 2. Permissão --------------------------------------------------------------------------
create or replace function private."FC_EXIGIR_RASCUNHO_REGRA"(p_tipo text, p_edital uuid)
returns uuid
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Sessão expirada' using errcode = '42501';
  end if;
  if p_tipo = 'ANALISE' then
    perform private."FC_EXIGIR_COORD_AVALIACAO"(p_edital);
  elsif p_tipo = 'CLASSIFICACAO' then
    perform private."FC_EXIGIR_CLASSIFICACAO_EDITAL"(p_edital, 2);
  else
    raise exception 'Tipo de regra inválido' using errcode = '22023';
  end if;
  return v_uid;
end;
$function$;
comment on function private."FC_EXIGIR_RASCUNHO_REGRA"(text, uuid) is
  'Barra (42501) quem não edita a regra do tipo (ANALISE: coordenação da avaliação documental, como salvar_regra_analise; CLASSIFICACAO: classificacao >= editor, como salvar_regra_classificacao). Tipo inválido = 22023. Devolve auth.uid().';
revoke all on function private."FC_EXIGIR_RASCUNHO_REGRA"(text, uuid) from public, anon, authenticated;

-- 3. RPCs -------------------------------------------------------------------------------
create or replace function public.salvar_rascunho_regra(p_tipo text, p_edital uuid, p_conteudo jsonb,
                                                        p_versao_base integer)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := private."FC_EXIGIR_RASCUNHO_REGRA"(p_tipo, p_edital);
  v_em timestamptz;
begin
  if jsonb_typeof(p_conteudo) is distinct from 'object' then
    raise exception 'Rascunho inválido.' using errcode = '22023';
  end if;
  if octet_length(p_conteudo::text) > 1048576 then
    raise exception 'Rascunho grande demais (até 1 MB).' using errcode = '22023';
  end if;
  if p_versao_base is null or p_versao_base < 0 then
    raise exception 'Versão base inválida.' using errcode = '22023';
  end if;
  insert into public."TB_RASCUNHO_REGRA" ("TP_REGRA", "CO_MONITORAMENTO", "CO_USUARIO", "DS_CONTEUDO", "NU_VERSAO_BASE")
  values (p_tipo, p_edital, v_uid, p_conteudo, p_versao_base)
  on conflict ("TP_REGRA", "CO_MONITORAMENTO", "CO_USUARIO")
  do update set "DS_CONTEUDO" = excluded."DS_CONTEUDO", "NU_VERSAO_BASE" = excluded."NU_VERSAO_BASE",
                "DT_ATUALIZACAO" = now()
  returning "DT_ATUALIZACAO" into v_em;
  return json_build_object('atualizado_em', v_em, 'versao_base', p_versao_base);
end;
$function$;
comment on function public.salvar_rascunho_regra(text, uuid, jsonb, integer) is
  'Guarda (ou troca) o rascunho não salvo da regra do tipo (ANALISE ou CLASSIFICACAO) no edital, de quem chama: objeto json de até 1 MB e a versão vigente de onde ele partiu. Devolve atualizado_em. Só quem edita a regra.';
revoke all on function public.salvar_rascunho_regra(text, uuid, jsonb, integer) from public, anon;
grant execute on function public.salvar_rascunho_regra(text, uuid, jsonb, integer) to authenticated;

create or replace function public.obter_rascunho_regra(p_tipo text, p_edital uuid)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := private."FC_EXIGIR_RASCUNHO_REGRA"(p_tipo, p_edital);
begin
  return (
    select json_build_object('conteudo', r."DS_CONTEUDO", 'versao_base', r."NU_VERSAO_BASE",
                             'criado_em', r."DT_CRIACAO", 'atualizado_em', r."DT_ATUALIZACAO")
      from public."TB_RASCUNHO_REGRA" r
     where r."TP_REGRA" = p_tipo and r."CO_MONITORAMENTO" = p_edital and r."CO_USUARIO" = v_uid);
end;
$function$;
comment on function public.obter_rascunho_regra(text, uuid) is
  'O rascunho não salvo de quem chama para a regra do tipo no edital: conteudo, versao_base, criado_em e atualizado_em; null sem rascunho. Só quem edita a regra.';
revoke all on function public.obter_rascunho_regra(text, uuid) from public, anon;
grant execute on function public.obter_rascunho_regra(text, uuid) to authenticated;

create or replace function public.descartar_rascunho_regra(p_tipo text, p_edital uuid)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_apagados integer;
begin
  if v_uid is null then
    raise exception 'Sessão expirada' using errcode = '42501';
  end if;
  if p_tipo is null or p_tipo not in ('ANALISE', 'CLASSIFICACAO') then
    raise exception 'Tipo de regra inválido' using errcode = '22023';
  end if;
  delete from public."TB_RASCUNHO_REGRA"
   where "TP_REGRA" = p_tipo and "CO_MONITORAMENTO" = p_edital and "CO_USUARIO" = v_uid;
  get diagnostics v_apagados = row_count;
  return json_build_object('descartado', v_apagados > 0);
end;
$function$;
comment on function public.descartar_rascunho_regra(text, uuid) is
  'Apaga o rascunho não salvo de quem chama para a regra do tipo no edital (depois de salvar a versão nova ou ao descartar). Só o próprio rascunho; não exige a permissão de editar.';
revoke all on function public.descartar_rascunho_regra(text, uuid) from public, anon;
grant execute on function public.descartar_rascunho_regra(text, uuid) to authenticated;

commit;
