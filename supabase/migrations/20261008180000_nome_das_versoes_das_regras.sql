/*
  NOME DAS VERSÕES DAS REGRAS (avaliação documental, classificação e roteiro
  de entrevista)

  Pedido: "a pessoa poder escolher o nome da regra e não via v1, v2". Cada
  versão ganha um NOME opcional (3 a 80 caracteres), escolhido ao salvar (a
  tela sugere um, editável) e que pode ser trocado depois sem mudar o
  conteúdo nem o hash. A tela mostra o nome em destaque e o número discreto
  ("Decisão CORES · v7"); sem nome, "Versão 7". O número continua sendo a
  chave (fichas, listas e editais apontam para a versão pelo número/id).

  O QUE MUDA
    public."TH_REGRA_ANALISE"."NO_VERSAO"        varchar(80) NOVA, nula
    public."TH_REGRA_CLASSIFICACAO"."NO_VERSAO"  varchar(80) NOVA, nula
    public."TB_ROTEIRO_ENTREVISTA"."NO_VERSAO"   varchar(80) NOVA, nula
    public."TH_NOME_VERSAO_REGRA"                NOVA: cada troca de nome
        (de, para, motivo, quem, quando) das três regras. Imutável.
    private."FC_TG_REGRA_ANALISE_IMUTAVEL"()     a versão da regra da avaliação
        continua imutável, menos o NO_VERSAO (o resto da linha, inclusive
        DS_CONFIGURACAO e DS_HASH, tem de ficar igual).
    private."FC_NOME_DA_VERSAO"(p_nome)          normaliza e valida o nome.
    private."FC_RENOMEACOES_JSON"(...)           o histórico de nomes de uma versão.

    SALVAR (aceitam o nome, opcional; as chamadas atuais continuam valendo)
      public.salvar_regra_analise(..., p_nome text default null)
      public.salvar_regra_classificacao(..., p_nome text default null)
      public.salvar_roteiro_entrevista(p_dados)  p_dados.nome_versao (a
          assinatura não muda: outra frente mexe nos roteiros em paralelo).
    RENOMEAR (só o nome, com motivo de 10 a 500; conteúdo e hash ficam)
      public.renomear_versao_regra_analise(p_edital, p_versao, p_nome, p_motivo)
          quem muda a regra: a coordenação do edital (e o administrador global).
      public.renomear_versao_regra_classificacao(p_edital, p_versao, p_nome, p_motivo)
          quem grava a regra: Editor na Classificação.
      public.renomear_versao_roteiro_entrevista(p_roteiro, p_nome, p_motivo)
          quem grava roteiros: Editor em Entrevistas (com a área do roteiro).
      p_nome vazio tira o nome (a tela volta a "Versão N").
    LER (devolvem o nome)
      private."FC_REGRA_ANALISE_JSON"           nome; versoes[].nome e .renomeacoes
      private."FC_REGRA_CLASSIFICACAO_JSON"     nome; versoes[].nome e .renomeacoes
      private."FC_ROTEIRO_JSON"                 nome_versao e renomeacoes
      public.listar_editais_avaliacao           editais[].nome_regra
      public.listar_editais_classificacao       editais[].nome_regra
      public.obter_apoio_regra_analise          regras_da_area[].nome e classificacao.regra.nome

  PRÉ-REQUISITO: 20261008120000_assistente_da_regra.sql,
  20261008100000_aspectos_da_entrevista.sql e
  20261007230000_edital_de_treinamento.sql aplicadas.

  Ensaio: supabase/ensaios/20261008180000_nome_das_versoes_das_regras.sql
  Rollback: supabase/rollback/20261008180000_nome_das_versoes_das_regras.sql
*/
begin;

-- 0. Pré-requisitos ---------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.obter_apoio_regra_analise(uuid)') is null
     or to_regprocedure('public.salvar_regra_analise(uuid, jsonb, integer, text)') is null then
    raise exception 'Aplique antes 20261008120000_assistente_da_regra.sql.';
  end if;
  if to_regprocedure('public.salvar_regra_classificacao(uuid, jsonb, integer, text)') is null then
    raise exception 'Aplique antes 20261002150000_classificacao.sql.';
  end if;
  if to_regclass('public."TB_ROTEIRO_ASPECTO"') is null then
    raise exception 'Aplique antes 20261008100000_aspectos_da_entrevista.sql.';
  end if;
  if to_regprocedure('private."FC_REINICIO_TREINAMENTO_PERMITE"(text, jsonb)') is null then
    raise exception 'Aplique antes 20261007230000_edital_de_treinamento.sql.';
  end if;
end;
$$;

-- 1. O nome em cada versão --------------------------------------------------------------
alter table public."TH_REGRA_ANALISE" add column "NO_VERSAO" varchar(80);
alter table public."TH_REGRA_ANALISE" add constraint "CK_THREGRAANALISE_NOVERSAO"
  check ("NO_VERSAO" is null or (length("NO_VERSAO") between 3 and 80 and "NO_VERSAO" = btrim("NO_VERSAO")));
comment on column public."TH_REGRA_ANALISE"."NO_VERSAO" is
  'Nome desta versão (3 a 80 caracteres), escolhido ao salvar ou renomeado depois (histórico em TH_NOME_VERSAO_REGRA). Nulo: sem nome (a tela mostra "Versão N"). Renomear muda só este campo; DS_CONFIGURACAO e DS_HASH não mudam.';
comment on constraint "CK_THREGRAANALISE_NOVERSAO" on public."TH_REGRA_ANALISE" is 'Nome da versão de 3 a 80 caracteres, sem espaço nas pontas.';

alter table public."TH_REGRA_CLASSIFICACAO" add column "NO_VERSAO" varchar(80);
alter table public."TH_REGRA_CLASSIFICACAO" add constraint "CK_HISTREGRACLASSIF_NOVERSAO"
  check ("NO_VERSAO" is null or (length("NO_VERSAO") between 3 and 80 and "NO_VERSAO" = btrim("NO_VERSAO")));
comment on column public."TH_REGRA_CLASSIFICACAO"."NO_VERSAO" is
  'Nome desta versão (3 a 80 caracteres), escolhido ao salvar ou renomeado depois (histórico em TH_NOME_VERSAO_REGRA). Nulo: sem nome (a tela mostra "Versão N"). Renomear muda só este campo; a configuração não muda.';
comment on constraint "CK_HISTREGRACLASSIF_NOVERSAO" on public."TH_REGRA_CLASSIFICACAO" is 'Nome da versão de 3 a 80 caracteres, sem espaço nas pontas.';

alter table public."TB_ROTEIRO_ENTREVISTA" add column "NO_VERSAO" varchar(80);
alter table public."TB_ROTEIRO_ENTREVISTA" add constraint "CK_ROTEIROENTREVISTA_NOVERSAO"
  check ("NO_VERSAO" is null or (length("NO_VERSAO") between 3 and 80 and "NO_VERSAO" = btrim("NO_VERSAO")));
comment on column public."TB_ROTEIRO_ENTREVISTA"."NO_VERSAO" is
  'Nome desta versão do roteiro (3 a 80 caracteres; NO_ROTEIRO é o nome do roteiro, comum às versões). Renomeado depois com histórico em TH_NOME_VERSAO_REGRA. Nulo: sem nome (a tela mostra "Versão N").';
comment on constraint "CK_ROTEIROENTREVISTA_NOVERSAO" on public."TB_ROTEIRO_ENTREVISTA" is 'Nome da versão de 3 a 80 caracteres, sem espaço nas pontas.';

-- 2. Histórico das trocas de nome ------------------------------------------------------
create table public."TH_NOME_VERSAO_REGRA" (
  "CO_NOME_VERSAO_REGRA" uuid not null default gen_random_uuid(),
  "TP_REGRA" varchar(13) not null,
  "CO_REGRA" uuid not null,
  "NU_VERSAO" integer not null,
  "NO_VERSAO_ANTERIOR" varchar(80),
  "NO_VERSAO_NOVO" varchar(80),
  "DS_MOTIVO" varchar(500) not null,
  "CO_USUARIO" uuid not null,
  "DT_CRIACAO" timestamptz not null default now(),
  constraint "PK_TH_NOME_VERSAO_REGRA" primary key ("CO_NOME_VERSAO_REGRA"),
  constraint "CK_THNOMEVERSAOREGRA_TPREGRA" check ("TP_REGRA" in ('ANALISE', 'CLASSIFICACAO', 'ROTEIRO')),
  constraint "CK_THNOMEVERSAOREGRA_NUVERSAO" check ("NU_VERSAO" >= 1),
  constraint "CK_THNOMEVERSAOREGRA_MUDOU" check ("NO_VERSAO_ANTERIOR" is distinct from "NO_VERSAO_NOVO"),
  constraint "CK_THNOMEVERSAOREGRA_MOTIVO" check (length(btrim("DS_MOTIVO")) between 10 and 500)
);
comment on table public."TH_NOME_VERSAO_REGRA" is
  'Cada troca do nome de uma versão de regra (avaliação documental, classificação ou roteiro de entrevista): de, para, motivo, quem e quando. Só o nome muda; o conteúdo e o hash da versão ficam. Nada se apaga nem muda.';
comment on column public."TH_NOME_VERSAO_REGRA"."CO_NOME_VERSAO_REGRA" is 'Identificador da troca.';
comment on column public."TH_NOME_VERSAO_REGRA"."TP_REGRA" is 'ANALISE (TH_REGRA_ANALISE), CLASSIFICACAO (TH_REGRA_CLASSIFICACAO) ou ROTEIRO (TB_ROTEIRO_ENTREVISTA).';
comment on column public."TH_NOME_VERSAO_REGRA"."CO_REGRA" is 'A regra: CO_REGRA_ANALISE, CO_REGRA_CLASSIFICACAO ou CO_ROTEIRO_ORIGEM (conforme TP_REGRA).';
comment on column public."TH_NOME_VERSAO_REGRA"."NU_VERSAO" is 'Número da versão renomeada.';
comment on column public."TH_NOME_VERSAO_REGRA"."NO_VERSAO_ANTERIOR" is 'Nome antes da troca (nulo: não tinha).';
comment on column public."TH_NOME_VERSAO_REGRA"."NO_VERSAO_NOVO" is 'Nome depois da troca (nulo: ficou sem nome).';
comment on column public."TH_NOME_VERSAO_REGRA"."DS_MOTIVO" is 'Por que o nome mudou (10 a 500 caracteres).';
comment on column public."TH_NOME_VERSAO_REGRA"."CO_USUARIO" is 'Quem trocou (auth.users.id).';
comment on column public."TH_NOME_VERSAO_REGRA"."DT_CRIACAO" is 'Quando trocou.';
comment on constraint "CK_THNOMEVERSAOREGRA_TPREGRA" on public."TH_NOME_VERSAO_REGRA" is 'Regras que têm nome por versão.';
comment on constraint "CK_THNOMEVERSAOREGRA_NUVERSAO" on public."TH_NOME_VERSAO_REGRA" is 'Versões começam em 1.';
comment on constraint "CK_THNOMEVERSAOREGRA_MUDOU" on public."TH_NOME_VERSAO_REGRA" is 'Só registra troca de verdade.';
comment on constraint "CK_THNOMEVERSAOREGRA_MOTIVO" on public."TH_NOME_VERSAO_REGRA" is 'Motivo de 10 a 500 caracteres.';
create index "IN_THNOMEVERSAOREGRA_REGRA" on public."TH_NOME_VERSAO_REGRA" ("TP_REGRA", "CO_REGRA", "NU_VERSAO");
comment on index public."IN_THNOMEVERSAOREGRA_REGRA" is 'As trocas de nome de uma versão.';

create function private."FC_TG_NOME_VERSAO_IMUTAVEL"()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  raise exception 'Histórico não muda (%)', tg_table_name using errcode = '42501';
end;
$function$;
comment on function private."FC_TG_NOME_VERSAO_IMUTAVEL"() is 'Gatilho: o histórico de nomes das versões (TH_NOME_VERSAO_REGRA) não muda nem se apaga.';
revoke all on function private."FC_TG_NOME_VERSAO_IMUTAVEL"() from public, anon, authenticated;
create trigger "TG_THNOMEVERSAOREGRA_IMUTAVEL" before update or delete on public."TH_NOME_VERSAO_REGRA"
  for each row execute function private."FC_TG_NOME_VERSAO_IMUTAVEL"();
comment on trigger "TG_THNOMEVERSAOREGRA_IMUTAVEL" on public."TH_NOME_VERSAO_REGRA" is 'Histórico de nomes imutável (FC_TG_NOME_VERSAO_IMUTAVEL).';

alter table public."TH_NOME_VERSAO_REGRA" enable row level security;
revoke all on public."TH_NOME_VERSAO_REGRA" from public, anon, authenticated;

-- 3. A versão da avaliação continua imutável, menos o nome ------------------------------
create or replace function private."FC_TG_REGRA_ANALISE_IMUTAVEL"()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if tg_op = 'DELETE' and private."FC_REINICIO_TREINAMENTO_PERMITE"(tg_table_name, to_jsonb(old)) then
    return old;
  end if;
  if tg_op = 'DELETE' then
    raise exception 'Registro da avaliação documental não se apaga (%): desative ou crie outra versão', tg_table_name using errcode = '42501';
  end if;
  -- Renomear a versão: só o NO_VERSAO muda (configuração, hash, motivo, autor e data ficam).
  if tg_table_name = 'TH_REGRA_ANALISE' and (to_jsonb(new) - 'NO_VERSAO') = (to_jsonb(old) - 'NO_VERSAO') then
    return new;
  end if;
  if tg_table_name in ('TH_REGRA_ANALISE', 'TH_ORIGEM_ANALISE_EDITAL') then
    raise exception 'Histórico não muda (%): crie outra versão', tg_table_name using errcode = '42501';
  end if;
  return new;
end;
$function$;
comment on function private."FC_TG_REGRA_ANALISE_IMUTAVEL"() is
  'Gatilho da avaliação documental: nenhuma linha se apaga (regra, equipe, aldeias, origem; exceto no reinício do edital de treinamento) e as tabelas de histórico (TH_) não mudam — só o nome da versão da regra (TH_REGRA_ANALISE.NO_VERSAO) pode ser trocado, com o resto da linha igual.';
revoke all on function private."FC_TG_REGRA_ANALISE_IMUTAVEL"() from public, anon, authenticated;

-- 4. Apoio: o nome e o histórico de nomes ---------------------------------------------
create function private."FC_NOME_DA_VERSAO"(p_nome text)
returns varchar
language plpgsql
immutable
set search_path to ''
as $function$
declare
  v_nome text := nullif(regexp_replace(btrim(coalesce(p_nome, '')), '\s+', ' ', 'g'), '');
begin
  if v_nome is not null and length(v_nome) not between 3 and 80 then
    raise exception 'Nome da versão: de 3 a 80 caracteres.' using errcode = '22023';
  end if;
  return v_nome;
end;
$function$;
comment on function private."FC_NOME_DA_VERSAO"(text) is
  'Nome da versão normalizado (sem espaço nas pontas, espaços seguidos viram um); vazio = nulo (sem nome). Fora de 3 a 80 caracteres = 22023.';
revoke all on function private."FC_NOME_DA_VERSAO"(text) from public, anon, authenticated;

create function private."FC_RENOMEACOES_JSON"(p_tipo text, p_regra uuid, p_versao integer)
returns json
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce(json_agg(json_build_object(
           'em', n."DT_CRIACAO", 'por', coalesce(u.nome, u.email),
           'de', n."NO_VERSAO_ANTERIOR", 'para', n."NO_VERSAO_NOVO", 'motivo', n."DS_MOTIVO")
         order by n."DT_CRIACAO" desc), '[]'::json)
    from public."TH_NOME_VERSAO_REGRA" n
    left join public."TB_PERFIL_USUARIO" u on u.user_id = n."CO_USUARIO"
   where n."TP_REGRA" = p_tipo and n."CO_REGRA" = p_regra and n."NU_VERSAO" = p_versao;
$function$;
comment on function private."FC_RENOMEACOES_JSON"(text, uuid, integer) is
  'As trocas de nome de uma versão de regra (mais recente primeiro): em, por, de, para, motivo.';
revoke all on function private."FC_RENOMEACOES_JSON"(text, uuid, integer) from public, anon, authenticated;

-- 5. Avaliação documental -------------------------------------------------------------
create or replace function private."FC_REGRA_ANALISE_JSON"(p_edital uuid)
returns json
language sql
stable
security definer
set search_path to ''
as $function$
  select json_build_object(
           'versao', r."NU_VERSAO_VIGENTE",
           'nome', v."NO_VERSAO",
           'situacao', r."TP_SITUACAO",
           'modelo_origem', r."CO_MODELO_ORIGEM",
           'configuracao', v."DS_CONFIGURACAO",
           'hash', v."DS_HASH",
           'atualizado_em', v."DT_CRIACAO",
           'por', coalesce(p.nome, p.email),
           'conferida_em', r."DT_CONFERENCIA",
           'conferida_por', coalesce(pc.nome, pc.email),
           'conferir_pede_outra_pessoa',
             coalesce(v."CO_USUARIO" = (select auth.uid()), false) and not private.is_master(),
           'versoes', coalesce((
             select json_agg(json_build_object(
                      'versao', h."NU_VERSAO", 'nome', h."NO_VERSAO", 'em', h."DT_CRIACAO", 'por', coalesce(pu.nome, pu.email),
                      'motivo', h."DS_MOTIVO", 'hash', h."DS_HASH", 'configuracao', h."DS_CONFIGURACAO",
                      'renomeacoes', private."FC_RENOMEACOES_JSON"('ANALISE', h."CO_REGRA_ANALISE", h."NU_VERSAO"))
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
  'Regra da avaliação vigente do edital (versão, nome da versão, situação, configuração, hash, quem e quando, conferência, e se quem está logado precisa de outra pessoa para conferir: salvou a versão vigente e não é administrador global) e o histórico de versões (com o nome e as trocas de nome); null sem regra.';
revoke all on function private."FC_REGRA_ANALISE_JSON"(uuid) from public, anon, authenticated;

drop function public.salvar_regra_analise(uuid, jsonb, integer, text);
create function public.salvar_regra_analise(p_edital uuid, p_configuracao jsonb, p_versao_atual integer, p_motivo text,
                                            p_nome text default null)
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
  v_nome varchar := private."FC_NOME_DA_VERSAO"(p_nome);
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

  insert into public."TH_REGRA_ANALISE" ("CO_REGRA_ANALISE", "NU_VERSAO", "DS_CONFIGURACAO", "DS_HASH", "DS_MOTIVO", "CO_USUARIO", "NO_VERSAO")
  values (v_regra."CO_REGRA_ANALISE", v_nova, p_configuracao,
          encode(sha256(convert_to(p_configuracao::text, 'UTF8')), 'hex'), coalesce(v_motivo, 'Regra criada do zero'), v_uid, v_nome);

  update public."TB_REGRA_ANALISE"
     set "NU_VERSAO_VIGENTE" = v_nova, "TP_SITUACAO" = 'CONFERIR', "CO_USUARIO_CONFERENCIA" = null, "DT_CONFERENCIA" = null,
         "DT_ATUALIZACAO" = now(), "CO_USUARIO_ATUALIZACAO" = v_uid
   where "CO_REGRA_ANALISE" = v_regra."CO_REGRA_ANALISE";

  return json_build_object(
    'regra', private."FC_REGRA_ANALISE_JSON"(p_edital),
    'fichas_afetadas', coalesce((
      select json_agg(json_build_object('ficha', f."CO_FICHA_ANALISE", 'codigo', c."CO_CANDIDATO_EMPREGARE", 'vaga', f."CO_VAGA",
                                        'versao_regra', f."NU_VERSAO_REGRA", 'resultado', f."TP_RESULTADO", 'nota_final', f."VL_NOTA_FINAL")
                      order by f."CO_VAGA", c."CO_CANDIDATO_EMPREGARE")
        from public."TB_FICHA_ANALISE" f
        join public."TB_EMPREGARE_CANDIDATO" c on c."CO_EMPREGARE_CANDIDATO" = f."CO_EMPREGARE_CANDIDATO"
       where f."CO_REGRA_ANALISE" = v_regra."CO_REGRA_ANALISE" and f."TP_SITUACAO" = 'CONCLUIDA' and f."NU_VERSAO_REGRA" < v_nova), '[]'::json));
end;
$function$;
comment on function public.salvar_regra_analise(uuid, jsonb, integer, text, text) is
  'Salva a regra da avaliação documental do edital como versão nova (a anterior fica no histórico, imutável) e volta a situação para Conferir. p_versao_atual = a versão que a tela abriu (0 sem regra; outra = 40001). Motivo obrigatório da versão 2 em diante (10 a 2.000). p_nome (opcional, 3 a 80): o nome desta versão. fichas_afetadas: as fichas concluídas com versão anterior (código, vaga, versão, resultado e nota) — nenhuma nota muda (AM-2.3); as pendentes e em análise passam a seguir a versão nova. Só a coordenação do edital.';
revoke all on function public.salvar_regra_analise(uuid, jsonb, integer, text, text) from public, anon;
grant execute on function public.salvar_regra_analise(uuid, jsonb, integer, text, text) to authenticated, service_role;

create function public.renomear_versao_regra_analise(p_edital uuid, p_versao integer, p_nome text, p_motivo text)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_area text := private."FC_EXIGIR_COORD_AVALIACAO"(p_edital);
  v_regra uuid;
  v_antes varchar;
  v_nome varchar := private."FC_NOME_DA_VERSAO"(p_nome);
  v_motivo text := btrim(coalesce(p_motivo, ''));
begin
  if length(v_motivo) not between 10 and 500 then
    raise exception 'Informe o motivo da troca do nome (10 a 500 caracteres).' using errcode = '22023';
  end if;
  select r."CO_REGRA_ANALISE" into v_regra from public."TB_REGRA_ANALISE" r where r."CO_MONITORAMENTO" = p_edital for update;
  select h."NO_VERSAO" into v_antes
    from public."TH_REGRA_ANALISE" h
   where h."CO_REGRA_ANALISE" = v_regra and h."NU_VERSAO" = p_versao;
  if not found then
    raise exception 'Versão % da regra não encontrada.', p_versao using errcode = '22023';
  end if;
  if v_antes is not distinct from v_nome then
    raise exception 'O nome não mudou.' using errcode = '22023';
  end if;
  update public."TH_REGRA_ANALISE" set "NO_VERSAO" = v_nome
   where "CO_REGRA_ANALISE" = v_regra and "NU_VERSAO" = p_versao;
  insert into public."TH_NOME_VERSAO_REGRA" ("TP_REGRA", "CO_REGRA", "NU_VERSAO", "NO_VERSAO_ANTERIOR", "NO_VERSAO_NOVO", "DS_MOTIVO", "CO_USUARIO")
  values ('ANALISE', v_regra, p_versao, v_antes, v_nome, v_motivo, (select auth.uid()));
  return json_build_object('regra', private."FC_REGRA_ANALISE_JSON"(p_edital));
end;
$function$;
comment on function public.renomear_versao_regra_analise(uuid, integer, text, text) is
  'Troca só o nome de uma versão da regra da avaliação documental (p_nome vazio tira o nome), com motivo de 10 a 500 (histórico em TH_NOME_VERSAO_REGRA). Configuração, hash e situação (conferida ou não) não mudam. Devolve a regra. Quem muda a regra: a coordenação do edital (e o administrador global).';
revoke all on function public.renomear_versao_regra_analise(uuid, integer, text, text) from public, anon;
grant execute on function public.renomear_versao_regra_analise(uuid, integer, text, text) to authenticated, service_role;

create or replace function public.listar_editais_avaliacao(p_area text)
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
               'id', m.id, 'edital', m.edital, 'unidade', m.unidade, 'ativo', m.ativo, 'status', m.status,
               'treinamento', private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO"),
               'numero', private."FC_NUMERO_EDITAL"(m.edital),
               'versao_regra', r."NU_VERSAO_VIGENTE", 'nome_regra', h."NO_VERSAO", 'situacao_regra', r."TP_SITUACAO",
               'origem', coalesce(o."TP_ORIGEM", 'PLANILHA'),
               'papel', private."FC_PAPEL_AVALIACAO"(m.id))
             order by m.ativo desc, r."NU_VERSAO_VIGENTE" is null, m.edital)
        from public."TB_MONITORAMENTO_INDIGENA" m
        left join public."TB_REGRA_ANALISE" r on r."CO_MONITORAMENTO" = m.id
        left join public."TH_REGRA_ANALISE" h
          on h."CO_REGRA_ANALISE" = r."CO_REGRA_ANALISE" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
        left join public."TB_ORIGEM_ANALISE_EDITAL" o on o."CO_MONITORAMENTO" = m.id
       where m."CO_AREA" = p_area and (v_editais is null or m.id = any (v_editais))), '[]'::json)
  );
end;
$function$;
comment on function public.listar_editais_avaliacao(text) is
  'Editais da área para a Avaliação documental (json): status do edital (a tela mostra só os vigentes, src/lib/avaliacao-documental/editais.js), treinamento, versão, nome da versão e situação da regra, dono da avaliação (PLANILHA, COMPARACAO, MONITORA) e o papel de quem está logado. Exige avaliacao_documental >= leitor, a área e o recorte da coordenação.';

create or replace function public.obter_apoio_regra_analise(p_edital uuid)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_area text := private."FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 1);
  v_coordena boolean := coalesce(private."FC_PAPEL_AVALIACAO"(p_edital) = 'COORDENADOR', false);
  v_le_classificacao boolean := private.pode_recurso('classificacao', 1);
begin
  return json_build_object(
    'schema_version', 1,
    -- Só os nomes das colunas de pergunta, por vaga (nenhuma resposta de candidato).
    'perguntas_por_vaga', coalesce((
      select json_agg(json_build_object(
               'vaga', v."CO_VAGA",
               'cargo', (select s."NO_CARGO" from public."TB_SELECAO_VAGA" s
                          where s."CO_VAGA" = v."CO_VAGA" and s."NO_CARGO" is not null
                          order by s."CO_MONITORAMENTO" = p_edital desc limit 1),
               'colunas', coalesce((
                 select json_agg(c.coluna order by c.ordem)
                   from jsonb_array_elements_text(v."DS_COLUNA") with ordinality c(coluna, ordem)
                  where c.coluna ilike 'Pergunta %'), '[]'::json))
             order by v."CO_VAGA")
        from public."TB_EMPREGARE_VAGA" v
       where v."CO_MONITORAMENTO" = p_edital and v."TP_SITUACAO" = 'GRAVADA'), '[]'::json),
    'regras_da_area', case when v_coordena then coalesce((
      select json_agg(json_build_object(
               'id', m.id, 'edital', m.edital, 'numero', private."FC_NUMERO_EDITAL"(m.edital), 'unidade', m.unidade,
               'versao', r."NU_VERSAO_VIGENTE", 'nome', h."NO_VERSAO", 'conferida_em', r."DT_CONFERENCIA",
               'configuracao', h."DS_CONFIGURACAO")
             order by r."DT_CONFERENCIA" desc, m.edital)
        from public."TB_REGRA_ANALISE" r
        join public."TB_MONITORAMENTO_INDIGENA" m on m.id = r."CO_MONITORAMENTO"
        join public."TH_REGRA_ANALISE" h
          on h."CO_REGRA_ANALISE" = r."CO_REGRA_ANALISE" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
       where r."TP_SITUACAO" = 'CONFERIDA' and m."CO_AREA" = v_area and m.id <> p_edital
         and private."FC_PODE_VER_EDITAL"(m.id)), '[]'::json) else '[]'::json end,
    'classificacao', json_build_object(
      'pode_ler', v_le_classificacao,
      'pode_editar', v_le_classificacao and private.pode_recurso('classificacao', 2),
      'regra', case when v_le_classificacao then (
        select json_build_object('versao', r."NU_VERSAO_VIGENTE", 'nome', h."NO_VERSAO", 'configuracao', h."DS_CONFIGURACAO",
                                 'atualizado_em', h."DT_CRIACAO", 'por', coalesce(p.nome, p.email))
          from public."TB_REGRA_CLASSIFICACAO" r
          join public."TH_REGRA_CLASSIFICACAO" h
            on h."CO_REGRA_CLASSIFICACAO" = r."CO_REGRA_CLASSIFICACAO" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
          left join public."TB_PERFIL_USUARIO" p on p.user_id = h."CO_USUARIO"
         where r."CO_MONITORAMENTO" = p_edital) end)
  );
end;
$function$;
comment on function public.obter_apoio_regra_analise(uuid) is
  'O que o assistente da regra da avaliação documental lê (json): os nomes das colunas de pergunta da última carga de cada vaga do edital (sem respostas), as regras conferidas dos outros editais da área que a pessoa vê (só para a coordenação do edital, para copiar; com o nome da versão) e a regra de classificação vigente (nota mínima, desempate e o nome da versão) para quem lê a Classificação, com pode_editar (Editor na Classificação). Exige avaliacao_documental >= leitor, a área e o recorte da coordenação.';

-- 6. Classificação ------------------------------------------------------------------------
create or replace function private."FC_REGRA_CLASSIFICACAO_JSON"(p_edital uuid)
returns json
language sql
stable
security definer
set search_path to ''
as $function$
  select json_build_object(
           'versao', r."NU_VERSAO_VIGENTE",
           'nome', v."NO_VERSAO",
           'configuracao', v."DS_CONFIGURACAO",
           'atualizado_em', v."DT_CRIACAO",
           'por', coalesce(p.nome, p.email),
           'versoes', coalesce((
             select json_agg(json_build_object(
                      'versao', h."NU_VERSAO", 'nome', h."NO_VERSAO", 'em', h."DT_CRIACAO", 'por', coalesce(pu.nome, pu.email),
                      'motivo', h."DS_MOTIVO", 'empate_final', h."TP_EMPATE_FINAL", 'configuracao', h."DS_CONFIGURACAO",
                      'renomeacoes', private."FC_RENOMEACOES_JSON"('CLASSIFICACAO', h."CO_REGRA_CLASSIFICACAO", h."NU_VERSAO"))
                    order by h."NU_VERSAO" desc)
               from public."TH_REGRA_CLASSIFICACAO" h
               left join public."TB_PERFIL_USUARIO" pu on pu.user_id = h."CO_USUARIO"
              where h."CO_REGRA_CLASSIFICACAO" = r."CO_REGRA_CLASSIFICACAO"), '[]'::json))
    from public."TB_REGRA_CLASSIFICACAO" r
    join public."TH_REGRA_CLASSIFICACAO" v
      on v."CO_REGRA_CLASSIFICACAO" = r."CO_REGRA_CLASSIFICACAO" and v."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
    left join public."TB_PERFIL_USUARIO" p on p.user_id = v."CO_USUARIO"
   where r."CO_MONITORAMENTO" = p_edital;
$function$;
comment on function private."FC_REGRA_CLASSIFICACAO_JSON"(uuid) is
  'Regra de classificação vigente do edital (versão, nome da versão, configuração, quem e quando) e o histórico de versões (com o nome e as trocas de nome); null sem regra.';
revoke all on function private."FC_REGRA_CLASSIFICACAO_JSON"(uuid) from public, anon, authenticated;

drop function public.salvar_regra_classificacao(uuid, jsonb, integer, text);
create function public.salvar_regra_classificacao(p_edital uuid, p_configuracao jsonb, p_versao_atual integer, p_motivo text,
                                                  p_nome text default null)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_area text := private."FC_EXIGIR_CLASSIFICACAO_EDITAL"(p_edital, 2);
  v_regra public."TB_REGRA_CLASSIFICACAO";
  v_nova integer;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_nome varchar := private."FC_NOME_DA_VERSAO"(p_nome);
  v_uid uuid := (select auth.uid());
begin
  perform private."FC_VALIDAR_REGRA_CLASSIFICACAO"(p_configuracao);
  if v_motivo is not null and length(v_motivo) not between 3 and 500 then
    raise exception 'Motivo da alteração entre 3 e 500 caracteres.' using errcode = '22023';
  end if;

  select * into v_regra from public."TB_REGRA_CLASSIFICACAO" where "CO_MONITORAMENTO" = p_edital for update;
  if v_regra."CO_REGRA_CLASSIFICACAO" is null then
    if coalesce(p_versao_atual, 0) <> 0 then
      raise exception 'A regra mudou desde que você abriu; recarregue.' using errcode = '40001';
    end if;
    insert into public."TB_REGRA_CLASSIFICACAO" ("CO_MONITORAMENTO", "NU_VERSAO_VIGENTE", "CO_USUARIO_ATUALIZACAO")
    values (p_edital, 1, v_uid)
    returning * into v_regra;
    v_nova := 1;
  else
    if p_versao_atual is distinct from v_regra."NU_VERSAO_VIGENTE" then
      raise exception 'A regra mudou desde que você abriu (versão %); recarregue.', v_regra."NU_VERSAO_VIGENTE" using errcode = '40001';
    end if;
    if v_motivo is null then
      raise exception 'Informe o motivo da alteração.' using errcode = '22023';
    end if;
    v_nova := v_regra."NU_VERSAO_VIGENTE" + 1;
  end if;

  insert into public."TH_REGRA_CLASSIFICACAO"
    ("CO_REGRA_CLASSIFICACAO", "NU_VERSAO", "DS_CONFIGURACAO", "TP_EMPATE_FINAL", "DS_MOTIVO", "CO_USUARIO", "NO_VERSAO")
  values (v_regra."CO_REGRA_CLASSIFICACAO", v_nova, p_configuracao, p_configuracao #>> '{empate_final,metodo}', v_motivo, v_uid, v_nome);

  insert into public."RL_REGRA_CRITERIO_DESEMPATE"
    ("CO_REGRA_CLASSIFICACAO", "NU_VERSAO", "NU_ORDEM", "CO_CRITERIO", "TP_DIRECAO")
  select v_regra."CO_REGRA_CLASSIFICACAO", v_nova, d.ordem, upper(d.valor ->> 'criterio'), d.valor ->> 'direcao'
    from jsonb_array_elements(coalesce(p_configuracao -> 'desempate', '[]'::jsonb)) with ordinality d(valor, ordem);

  update public."TB_REGRA_CLASSIFICACAO"
     set "NU_VERSAO_VIGENTE" = v_nova, "DT_ATUALIZACAO" = now(), "CO_USUARIO_ATUALIZACAO" = v_uid
   where "CO_REGRA_CLASSIFICACAO" = v_regra."CO_REGRA_CLASSIFICACAO";

  return private."FC_REGRA_CLASSIFICACAO_JSON"(p_edital);
end;
$function$;
comment on function public.salvar_regra_classificacao(uuid, jsonb, integer, text, text) is
  'Salva a regra de classificação do edital como versão nova (a anterior fica no histórico). p_versao_atual = a versão que a tela abriu (0 sem regra; outra = 40001). Motivo obrigatório a partir da versão 2. p_nome (opcional, 3 a 80): o nome desta versão. Exige classificacao >= editor, a área e o recorte da coordenação.';
revoke all on function public.salvar_regra_classificacao(uuid, jsonb, integer, text, text) from public, anon;
grant execute on function public.salvar_regra_classificacao(uuid, jsonb, integer, text, text) to authenticated, service_role;

create function public.renomear_versao_regra_classificacao(p_edital uuid, p_versao integer, p_nome text, p_motivo text)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_area text := private."FC_EXIGIR_CLASSIFICACAO_EDITAL"(p_edital, 2);
  v_regra uuid;
  v_antes varchar;
  v_nome varchar := private."FC_NOME_DA_VERSAO"(p_nome);
  v_motivo text := btrim(coalesce(p_motivo, ''));
begin
  if length(v_motivo) not between 10 and 500 then
    raise exception 'Informe o motivo da troca do nome (10 a 500 caracteres).' using errcode = '22023';
  end if;
  select r."CO_REGRA_CLASSIFICACAO" into v_regra from public."TB_REGRA_CLASSIFICACAO" r where r."CO_MONITORAMENTO" = p_edital for update;
  select h."NO_VERSAO" into v_antes
    from public."TH_REGRA_CLASSIFICACAO" h
   where h."CO_REGRA_CLASSIFICACAO" = v_regra and h."NU_VERSAO" = p_versao;
  if not found then
    raise exception 'Versão % da regra não encontrada.', p_versao using errcode = '22023';
  end if;
  if v_antes is not distinct from v_nome then
    raise exception 'O nome não mudou.' using errcode = '22023';
  end if;
  update public."TH_REGRA_CLASSIFICACAO" set "NO_VERSAO" = v_nome
   where "CO_REGRA_CLASSIFICACAO" = v_regra and "NU_VERSAO" = p_versao;
  insert into public."TH_NOME_VERSAO_REGRA" ("TP_REGRA", "CO_REGRA", "NU_VERSAO", "NO_VERSAO_ANTERIOR", "NO_VERSAO_NOVO", "DS_MOTIVO", "CO_USUARIO")
  values ('CLASSIFICACAO', v_regra, p_versao, v_antes, v_nome, v_motivo, (select auth.uid()));
  return private."FC_REGRA_CLASSIFICACAO_JSON"(p_edital);
end;
$function$;
comment on function public.renomear_versao_regra_classificacao(uuid, integer, text, text) is
  'Troca só o nome de uma versão da regra de classificação (p_nome vazio tira o nome), com motivo de 10 a 500 (histórico em TH_NOME_VERSAO_REGRA). A configuração não muda. Devolve a regra. Exige classificacao >= editor, a área e o recorte da coordenação.';
revoke all on function public.renomear_versao_regra_classificacao(uuid, integer, text, text) from public, anon;
grant execute on function public.renomear_versao_regra_classificacao(uuid, integer, text, text) to authenticated, service_role;

create or replace function public.listar_editais_classificacao(p_area text)
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
  if not private.pode_recurso('classificacao', 1) then
    raise exception 'Sem permissão para Classificação' using errcode = '42501';
  end if;
  if not private."FC_PODE_AREA"(p_area) then
    raise exception 'Sem acesso a esta área' using errcode = '42501';
  end if;
  v_editais := (select private."FC_EDITAIS_VISIVEIS"())::uuid[];

  return json_build_object(
    'area', p_area,
    'pode_editar', private.pode_recurso('classificacao', 2),
    'editais', (
      with m as (
        select m.id, m.edital, m.unidade, m.ativo, private."FC_NUMERO_EDITAL"(m.edital) as numero,
               private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO") as treinamento
          from public."TB_MONITORAMENTO_INDIGENA" m
         where m."CO_AREA" = p_area and (v_editais is null or m.id = any (v_editais))
      ),
      an as (
        select private."FC_NUMERO_EDITAL"(a.edital) as numero, count(*)::integer as qt
          from public."TB_ANALISE_CURRICULAR" a
         where a."CO_AREA" = p_area and a.ativo
         group by 1
      )
      select coalesce(json_agg(json_build_object(
               'id', m.id, 'edital', m.edital, 'unidade', m.unidade, 'ativo', m.ativo,
               'treinamento', m.treinamento,
               'candidatos', coalesce(an.qt, 0),
               'versao_regra', r."NU_VERSAO_VIGENTE",
               'nome_regra', h."NO_VERSAO",
               'ultima_lista', (
                 select json_build_object('tipo', l."TP_LISTA", 'em', l."DT_GERACAO", 'publicada', l."ST_PUBLICADA" = 'S')
                   from public."TB_LISTA_CLASSIFICACAO" l
                  where l."CO_MONITORAMENTO" = m.id
                  order by l."DT_GERACAO" desc limit 1))
             order by m.ativo desc, coalesce(an.qt, 0) = 0, m.edital), '[]'::json)
        from m
        left join an on an.numero = m.numero
        left join public."TB_REGRA_CLASSIFICACAO" r on r."CO_MONITORAMENTO" = m.id
        left join public."TH_REGRA_CLASSIFICACAO" h
          on h."CO_REGRA_CLASSIFICACAO" = r."CO_REGRA_CLASSIFICACAO" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
    )
  );
end;
$function$;
comment on function public.listar_editais_classificacao(text) is
  'Editais da área para a aba Classificação (json): candidatos nas análises, treinamento, versão e nome da versão da regra e a última lista gerada. Exige classificacao >= leitor, a área e o recorte da coordenação.';

-- 7. Roteiro de entrevista ------------------------------------------------------------
create or replace function private."FC_ROTEIRO_JSON"(p_roteiro uuid)
returns json
language sql
stable
security definer
set search_path to ''
as $function$
  select json_build_object(
    'id', r."CO_ROTEIRO", 'origem', r."CO_ROTEIRO_ORIGEM", 'versao', r."NU_VERSAO", 'area', r."CO_AREA",
    'nome', r."NO_ROTEIRO", 'nome_versao', r."NO_VERSAO", 'descricao', r."DS_DESCRICAO", 'etapa', r."NO_ETAPA",
    'escala', r."TP_ESCALA", 'passo', r."VL_PASSO", 'notas_permitidas', r."DS_NOTAS_PERMITIDAS",
    'nota_minima_total', r."VL_NOTA_MINIMA_TOTAL", 'notas_eliminatorias', r."DS_NOTAS_ELIMINATORIAS",
    'ausencia_elimina', r."ST_AUSENCIA_ELIMINA" = 'S', 'desempate', r."DS_DESEMPATE",
    'soma_analise', r."ST_SOMA_ANALISE" = 'S', 'convocacao_padrao', r."DS_CONVOCACAO_PADRAO",
    'banca_padrao', r."DS_BANCA_PADRAO", 'ativo', r."ST_ATIVO" = 'S', 'criado_em', r."DT_CRIACAO",
    'competencias', coalesce((select json_agg(json_build_object(
        'id', k."CO_COMPETENCIA", 'ordem', k."NU_ORDEM", 'nome', k."NO_COMPETENCIA", 'descricao', k."DS_DESCRICAO",
        'nota_maxima', k."VL_NOTA_MAXIMA", 'peso', k."VL_PESO", 'minimo', k."VL_MINIMO",
        'tipo_minimo', k."TP_MINIMO", 'avaliacao', k."TP_AVALIACAO") order by k."NU_ORDEM")
      from public."TB_ROTEIRO_COMPETENCIA" k where k."CO_ROTEIRO" = r."CO_ROTEIRO"), '[]'::json),
    'niveis', coalesce((select json_agg(json_build_object('nota', n."VL_NOTA", 'nome', n."NO_NIVEL", 'descricao', n."DS_DESCRICAO") order by n."VL_NOTA")
      from public."TB_ROTEIRO_NIVEL" n where n."CO_ROTEIRO" = r."CO_ROTEIRO"), '[]'::json),
    'aspectos', coalesce((select json_agg(json_build_object('id', s."CO_ASPECTO", 'ordem', s."NU_ORDEM", 'nome', s."NO_ASPECTO") order by s."NU_ORDEM")
      from public."TB_ROTEIRO_ASPECTO" s where s."CO_ROTEIRO" = r."CO_ROTEIRO"), '[]'::json),
    'renomeacoes', private."FC_RENOMEACOES_JSON"('ROTEIRO', r."CO_ROTEIRO_ORIGEM", r."NU_VERSAO"),
    'editais_em_uso', (select count(*) from public."TB_ENTREVISTA_EDITAL" e where e."CO_ROTEIRO" = r."CO_ROTEIRO"))
  from public."TB_ROTEIRO_ENTREVISTA" r where r."CO_ROTEIRO" = p_roteiro;
$function$;
comment on function private."FC_ROTEIRO_JSON"(uuid) is 'Um roteiro (versão) em json, com o nome da versão (nome_versao) e as trocas de nome, competências, níveis e aspectos (vazio = uma nota por avaliador).';

create or replace function public.salvar_roteiro_entrevista(p_dados jsonb)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_origem uuid := nullif(p_dados ->> 'origem', '')::uuid;
  v_versao integer := 1;
  v_id uuid := gen_random_uuid();
  v_area text := nullif(p_dados ->> 'area', '');
  v_escala text := coalesce(nullif(p_dados ->> 'escala', ''), 'FAIXA');
  v_nome_versao varchar := private."FC_NOME_DA_VERSAO"(p_dados ->> 'nome_versao');
  k jsonb;
  v_ordem integer := 0;
  v_aspectos text[];
begin
  if not private.pode_recurso('entrevistas', 2) then
    raise exception 'Sem permissão para editar roteiros de entrevista' using errcode = '42501';
  end if;
  if v_area is not null and not private."FC_PODE_AREA"(v_area) then
    raise exception 'Sem acesso a esta área' using errcode = '42501';
  end if;
  if jsonb_typeof(p_dados -> 'competencias') is distinct from 'array'
     or jsonb_array_length(p_dados -> 'competencias') not between 1 and 20 then
    raise exception 'Informe de 1 a 20 competências' using errcode = '22023';
  end if;
  if v_escala = 'LISTA' and jsonb_array_length(coalesce(p_dados -> 'notas_permitidas', '[]')) = 0 then
    raise exception 'Escala em lista precisa das notas permitidas' using errcode = '22023';
  end if;
  if v_escala = 'NIVEIS' and jsonb_array_length(coalesce(p_dados -> 'niveis', '[]')) = 0 then
    raise exception 'Escala por níveis precisa dos níveis' using errcode = '22023';
  end if;

  -- Aspectos (opcionais): [{nome}] ou ["nome"], na ordem; nomes únicos.
  if p_dados ? 'aspectos' and jsonb_typeof(p_dados -> 'aspectos') not in ('array', 'null') then
    raise exception 'Aspectos: informe uma lista' using errcode = '22023';
  end if;
  select coalesce(array_agg(btrim(case when jsonb_typeof(a.valor) = 'string' then a.valor #>> '{}' else a.valor ->> 'nome' end)
                            order by a.ordem), '{}')
    into v_aspectos
    from jsonb_array_elements(case when jsonb_typeof(p_dados -> 'aspectos') = 'array' then p_dados -> 'aspectos' else '[]'::jsonb end)
         with ordinality a(valor, ordem);
  if cardinality(v_aspectos) > 10 then
    raise exception 'Informe até 10 aspectos' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(v_aspectos) n where coalesce(length(n), 0) not between 2 and 60) then
    raise exception 'Nome do aspecto: de 2 a 60 caracteres' using errcode = '22023';
  end if;
  if (select count(distinct lower(n)) from unnest(v_aspectos) n) <> cardinality(v_aspectos) then
    raise exception 'Dois aspectos com o mesmo nome' using errcode = '22023';
  end if;

  if v_origem is not null then
    select coalesce(max(r."NU_VERSAO"), 0) + 1 into v_versao from public."TB_ROTEIRO_ENTREVISTA" r where r."CO_ROTEIRO_ORIGEM" = v_origem;
    if v_versao = 1 then raise exception 'Roteiro de origem não encontrado' using errcode = '22023'; end if;
    update public."TB_ROTEIRO_ENTREVISTA" set "ST_ATIVO" = 'N' where "CO_ROTEIRO_ORIGEM" = v_origem and "ST_ATIVO" = 'S';
  else
    v_origem := v_id;
  end if;

  insert into public."TB_ROTEIRO_ENTREVISTA" ("CO_ROTEIRO", "CO_ROTEIRO_ORIGEM", "NU_VERSAO", "CO_AREA", "NO_ROTEIRO",
    "DS_DESCRICAO", "NO_ETAPA", "TP_ESCALA", "VL_PASSO", "DS_NOTAS_PERMITIDAS", "VL_NOTA_MINIMA_TOTAL",
    "DS_NOTAS_ELIMINATORIAS", "ST_AUSENCIA_ELIMINA", "DS_DESEMPATE", "ST_SOMA_ANALISE", "DS_CONVOCACAO_PADRAO",
    "DS_BANCA_PADRAO", "CO_USUARIO_CRIACAO", "NO_VERSAO")
  values (v_id, v_origem, v_versao, v_area, btrim(p_dados ->> 'nome'), nullif(btrim(coalesce(p_dados ->> 'descricao', '')), ''),
    coalesce(nullif(btrim(coalesce(p_dados ->> 'etapa', '')), ''), 'Entrevista'), v_escala,
    coalesce(nullif(p_dados ->> 'passo', '')::numeric, 0.5), coalesce(p_dados -> 'notas_permitidas', '[]'),
    nullif(p_dados ->> 'nota_minima_total', '')::numeric,
    -- Com aspectos, a eliminação é pelo mínimo da competência: sem notas eliminatórias.
    case when cardinality(v_aspectos) > 0 then '[]'::jsonb else coalesce(p_dados -> 'notas_eliminatorias', '[]') end,
    case when coalesce((p_dados ->> 'ausencia_elimina')::boolean, true) then 'S' else 'N' end,
    coalesce(p_dados -> 'desempate', '[]'),
    case when coalesce((p_dados ->> 'soma_analise')::boolean, true) then 'S' else 'N' end,
    coalesce(p_dados -> 'convocacao_padrao', '{}'), coalesce(p_dados -> 'banca_padrao', '[]'), (select auth.uid()), v_nome_versao);

  for k in select value from jsonb_array_elements(p_dados -> 'competencias') loop
    v_ordem := v_ordem + 1;
    insert into public."TB_ROTEIRO_COMPETENCIA" ("CO_ROTEIRO", "NU_ORDEM", "NO_COMPETENCIA", "DS_DESCRICAO",
      "VL_NOTA_MAXIMA", "VL_PESO", "VL_MINIMO", "TP_MINIMO", "TP_AVALIACAO")
    values (v_id, v_ordem, btrim(k ->> 'nome'), nullif(btrim(coalesce(k ->> 'descricao', '')), ''),
      (k ->> 'nota_maxima')::numeric, coalesce(nullif(k ->> 'peso', '')::numeric, 1), nullif(k ->> 'minimo', '')::numeric,
      coalesce(nullif(k ->> 'tipo_minimo', ''), 'VALOR'), coalesce(nullif(k ->> 'avaliacao', ''), 'INDIVIDUAL'));
  end loop;

  insert into public."TB_ROTEIRO_NIVEL" ("CO_ROTEIRO", "VL_NOTA", "NO_NIVEL", "DS_DESCRICAO")
  select v_id, (n ->> 'nota')::numeric, btrim(n ->> 'nome'), nullif(btrim(coalesce(n ->> 'descricao', '')), '')
    from jsonb_array_elements(coalesce(p_dados -> 'niveis', '[]')) n;

  insert into public."TB_ROTEIRO_ASPECTO" ("CO_ROTEIRO", "NU_ORDEM", "NO_ASPECTO")
  select v_id, a.ordem, a.nome from unnest(v_aspectos) with ordinality a(nome, ordem);

  return private."FC_ROTEIRO_JSON"(v_id);
end;
$function$;
comment on function public.salvar_roteiro_entrevista(jsonb) is 'Cria um roteiro ou uma versão nova de um roteiro (p_dados.origem); a versão anterior deixa de ser oferecida, mas os editais que a usam continuam nela. p_dados.nome_versao (opcional, 3 a 80): o nome desta versão. p_dados.aspectos (opcional, até 10): cada avaliador dá uma nota por aspecto; com aspectos, as notas eliminatórias gravam vazias. entrevistas >= editor.';

create function public.renomear_versao_roteiro_entrevista(p_roteiro uuid, p_nome text, p_motivo text)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_r public."TB_ROTEIRO_ENTREVISTA";
  v_nome varchar := private."FC_NOME_DA_VERSAO"(p_nome);
  v_motivo text := btrim(coalesce(p_motivo, ''));
begin
  if not private.pode_recurso('entrevistas', 2) then
    raise exception 'Sem permissão para editar roteiros de entrevista' using errcode = '42501';
  end if;
  select * into v_r from public."TB_ROTEIRO_ENTREVISTA" where "CO_ROTEIRO" = p_roteiro for update;
  if v_r."CO_ROTEIRO" is null then
    raise exception 'Roteiro não encontrado' using errcode = '22023';
  end if;
  if v_r."CO_AREA" is not null and not private."FC_PODE_AREA"(v_r."CO_AREA") then
    raise exception 'Sem acesso a esta área' using errcode = '42501';
  end if;
  if length(v_motivo) not between 10 and 500 then
    raise exception 'Informe o motivo da troca do nome (10 a 500 caracteres).' using errcode = '22023';
  end if;
  if v_r."NO_VERSAO" is not distinct from v_nome then
    raise exception 'O nome não mudou.' using errcode = '22023';
  end if;
  update public."TB_ROTEIRO_ENTREVISTA" set "NO_VERSAO" = v_nome where "CO_ROTEIRO" = p_roteiro;
  insert into public."TH_NOME_VERSAO_REGRA" ("TP_REGRA", "CO_REGRA", "NU_VERSAO", "NO_VERSAO_ANTERIOR", "NO_VERSAO_NOVO", "DS_MOTIVO", "CO_USUARIO")
  values ('ROTEIRO', v_r."CO_ROTEIRO_ORIGEM", v_r."NU_VERSAO", v_r."NO_VERSAO", v_nome, v_motivo, (select auth.uid()));
  return private."FC_ROTEIRO_JSON"(p_roteiro);
end;
$function$;
comment on function public.renomear_versao_roteiro_entrevista(uuid, text, text) is
  'Troca só o nome de uma versão do roteiro de entrevista (p_roteiro = CO_ROTEIRO da versão; p_nome vazio tira o nome), com motivo de 10 a 500 (histórico em TH_NOME_VERSAO_REGRA). Competências, escala e editais que a usam não mudam. Devolve o roteiro. entrevistas >= editor e a área do roteiro.';
revoke all on function public.renomear_versao_roteiro_entrevista(uuid, text, text) from public, anon;
grant execute on function public.renomear_versao_roteiro_entrevista(uuid, text, text) to authenticated, service_role;

commit;
