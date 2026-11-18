/*
  ENSAIO de 20261118120000_central_de_avisos_das_conferencias (não grava: termina em rollback). Aplica a migration; confere a migração dos
  ignorados, a lista, um ciclo de tratamento como o administrador global (sem sessão: as funções que
  exigem sessão ficam de fora) e a marca; aplica o rollback e confere que os corpos e os ignorados
  voltaram.
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/ensaios/20261118120000_central_de_avisos_das_conferencias.sql
*/

begin;

create temp table ensaio_antes as
select a."CO_AVISO_CONFERENCIA" as id, a."TP_SITUACAO" as situacao, a."DS_MOTIVO_IGNORADO" as motivo,
       a."QT_OCORRENCIA_IGNORADA" as qt_ignorada
  from public."TB_AVISO_CONFERENCIA" a;

do $$
begin
  if to_regclass('public."TH_AVISO_CONFERENCIA"') is not null then
    raise exception 'Já aplicada: TH_AVISO_CONFERENCIA existe.';
  end if;
  if md5(replace((select prosrc from pg_proc where oid = to_regprocedure('public.gravar_avisos_conferencia(text, jsonb)')), chr(13), ''))
       is distinct from '5b66702e4d9e545fa77feb1a715bd029'
     or md5(replace((select prosrc from pg_proc where oid = to_regprocedure('public.finalizar_conferencia(text, text[], text[], text)')), chr(13), ''))
       is distinct from '7504ee7a84170ae06839e4d834ea217c'
     or md5(replace((select prosrc from pg_proc where oid = to_regprocedure('public.listar_avisos_conferencia(text, text)')), chr(13), ''))
       is distinct from 'be53920c2e720c44268d5003dd5488f1'
     or md5(replace((select prosrc from pg_proc where oid = to_regprocedure('public.listar_casos_aviso_conferencia(uuid, text, text, text, integer, integer)')), chr(13), ''))
       is distinct from 'e993ea3451a2ebe8f604059df2ecadcb'
     or md5(replace((select prosrc from pg_proc where oid = to_regprocedure('private."FC_FECHAR_CASOS_DO_AVISO"(text, uuid[])')), chr(13), ''))
       is distinct from 'b4b445bbb0c5d09e8c7857508db7d03b'
     or md5(replace((select prosrc from pg_proc where oid = to_regprocedure('public.ignorar_aviso_conferencia(uuid, text)')), chr(13), ''))
       is distinct from 'c5f9f342ebd5e9ccb0cb239ea21ef04c' then
    raise exception 'Uma das funções dos avisos mudou depois do retrato de 18/11/2026: junte as mudanças antes de aplicar.';
  end if;
  if exists (select 1 from public."TB_AVISO_CONFERENCIA" a
              where a."TP_SITUACAO" = 'IGNORADO' and length(btrim(coalesce(a."DS_MOTIVO_IGNORADO", ''))) < 3) then
    raise exception 'Há aviso ignorado sem motivo: corrija antes (o histórico exige 3 caracteres).';
  end if;
end;
$$;

-- 1. Tratamento, responsável e prazo no aviso ─────────────────────────────────────────────────
alter table public."TB_AVISO_CONFERENCIA"
  add column "TP_TRATAMENTO" character varying(25) default 'PENDENTE' not null,
  add column "CO_USUARIO_TRATAMENTO" uuid,
  add column "DT_TRATAMENTO" timestamp with time zone,
  add column "QT_OCORRENCIA_DISPENSADA" integer,
  add column "CO_USUARIO_RESPONSAVEL" uuid,
  add column "DT_PRAZO" date;

-- 2. Histórico (só cresce) ──────────────────────────────────────────────────────────────────────
create table public."TH_AVISO_CONFERENCIA" (
  "CO_EVENTO" bigint generated always as identity,
  "CO_AVISO_CONFERENCIA" uuid not null,
  "TP_EVENTO" character varying(30) not null,
  "TP_TRATAMENTO_ANTERIOR" character varying(25),
  "TP_TRATAMENTO" character varying(25),
  "TP_SITUACAO" character varying(10) not null,
  "QT_OCORRENCIA" integer not null,
  "DS_MOTIVO" character varying(500),
  "CO_USUARIO_RESPONSAVEL" uuid,
  "DT_PRAZO" date,
  "CO_EVIDENCIA_AVISO" uuid,
  "CO_USUARIO" uuid,
  "CO_EXECUCAO" text,
  "DT_EVENTO" timestamp with time zone default now() not null,
  constraint "PK_TH_AVISO_CONFERENCIA" primary key ("CO_EVENTO"),
  constraint "FK_AVISOCONF_HISTAVISOCONF" foreign key ("CO_AVISO_CONFERENCIA")
    references public."TB_AVISO_CONFERENCIA" ("CO_AVISO_CONFERENCIA") on delete cascade,
  constraint "CK_HISTAVISOCONF_TPEVENTO" check ("TP_EVENTO" in
    ('ACHADO', 'REABERTO', 'TRATAMENTO', 'RESPONSAVEL', 'EVIDENCIA_INCLUIDA', 'EVIDENCIA_RETIRADA',
     'RECHECADO_COM_PROBLEMA', 'NAO_ACHADO', 'MIGRADO')),
  constraint "CK_HISTAVISOCONF_TPTRATAMENTO" check
    (("TP_TRATAMENTO" is null or "TP_TRATAMENTO" in ('PENDENTE', 'EM_ANALISE', 'AGUARDANDO_DOCUMENTO', 'CORRIGIDO', 'RECHECADO_SEM_PROBLEMA', 'DISPENSADO'))
     and ("TP_TRATAMENTO_ANTERIOR" is null or "TP_TRATAMENTO_ANTERIOR" in ('PENDENTE', 'EM_ANALISE', 'AGUARDANDO_DOCUMENTO', 'CORRIGIDO', 'RECHECADO_SEM_PROBLEMA', 'DISPENSADO'))),
  constraint "CK_HISTAVISOCONF_TPSITUACAO" check ("TP_SITUACAO" in ('ABERTO', 'RESOLVIDO')),
  constraint "CK_HISTAVISOCONF_DSMOTIVO" check
    ("DS_MOTIVO" is null or length(btrim("DS_MOTIVO")) between 3 and 500)
);
create index "IN_FKHISTAVISOCONF_COAVISO" on public."TH_AVISO_CONFERENCIA" ("CO_AVISO_CONFERENCIA", "CO_EVENTO");
alter table public."TH_AVISO_CONFERENCIA" enable row level security;

-- 3. Evidência (exclusão lógica) ────────────────────────────────────────────────────────────────
create table public."TB_EVIDENCIA_AVISO_CONFERENCIA" (
  "CO_EVIDENCIA_AVISO" uuid default gen_random_uuid() not null,
  "CO_AVISO_CONFERENCIA" uuid not null,
  "DS_CHAVE_CASO" character varying(100),
  "TP_EVIDENCIA" character varying(10) not null,
  "DS_EVIDENCIA" character varying(500) not null,
  "DS_URL" character varying(500),
  "ST_REGISTRO_ATIVO" character varying(1) default 'S' not null,
  "CO_USUARIO" uuid not null,
  "DT_CRIACAO" timestamp with time zone default now() not null,
  "CO_USUARIO_RETIRADA" uuid,
  "DT_RETIRADA" timestamp with time zone,
  constraint "PK_EVIDAVISOCONF" primary key ("CO_EVIDENCIA_AVISO"),
  constraint "FK_AVISOCONF_EVIDAVISOCONF" foreign key ("CO_AVISO_CONFERENCIA")
    references public."TB_AVISO_CONFERENCIA" ("CO_AVISO_CONFERENCIA") on delete cascade,
  constraint "CK_EVIDAVISOCONF_TPEVIDENCIA" check ("TP_EVIDENCIA" in ('SEI', 'LINK', 'NOTA')),
  constraint "CK_EVIDAVISOCONF_DSCHAVECASO" check
    ("DS_CHAVE_CASO" is null or "DS_CHAVE_CASO" ~ '^(analise|codigo|referencia):[A-Za-z0-9._:/-]{1,90}$'),
  constraint "CK_EVIDAVISOCONF_DSEVIDENCIA" check (length(btrim("DS_EVIDENCIA")) between 3 and 500),
  constraint "CK_EVIDAVISOCONF_DSURL" check ("DS_URL" is null or "DS_URL" ~ '^https://[^\s]+$'),
  constraint "CK_EVIDAVISOCONF_STREGATIVO" check ("ST_REGISTRO_ATIVO" in ('S', 'N')),
  constraint "CK_EVIDAVISOCONF_RETIRADA" check
    ((("ST_REGISTRO_ATIVO" = 'N') = ("DT_RETIRADA" is not null))
     and (("DT_RETIRADA" is null) = ("CO_USUARIO_RETIRADA" is null)))
);
create index "IN_FKEVIDAVISOCONF_COAVISO" on public."TB_EVIDENCIA_AVISO_CONFERENCIA" ("CO_AVISO_CONFERENCIA")
  where "ST_REGISTRO_ATIVO" = 'S';
alter table public."TB_EVIDENCIA_AVISO_CONFERENCIA" enable row level security;

-- 4. O IGNORADO vira ABERTO + DISPENSADO; quem, quando e o motivo vão para o histórico ──────────────
insert into public."TH_AVISO_CONFERENCIA" (
  "CO_AVISO_CONFERENCIA", "TP_EVENTO", "TP_TRATAMENTO_ANTERIOR", "TP_TRATAMENTO", "TP_SITUACAO", "QT_OCORRENCIA",
  "DS_MOTIVO", "CO_USUARIO", "DT_EVENTO")
select a."CO_AVISO_CONFERENCIA", 'MIGRADO', 'PENDENTE', 'DISPENSADO', 'ABERTO', a."QT_OCORRENCIA_IGNORADA",
       left(btrim(a."DS_MOTIVO_IGNORADO"), 500), a."CO_USUARIO_IGNORADO", a."DT_IGNORADO"
  from public."TB_AVISO_CONFERENCIA" a
 where a."TP_SITUACAO" = 'IGNORADO';

alter table public."TB_AVISO_CONFERENCIA" drop constraint "CK_AVISOCONF_TPSITUACAO";
alter table public."TB_AVISO_CONFERENCIA" drop constraint "CK_AVISOCONF_IGNORADO";
alter table public."TB_AVISO_CONFERENCIA" drop constraint "CK_AVISOCONF_QT";
drop index public."IN_AVISOCONF_VIGENTE";

update public."TB_AVISO_CONFERENCIA" a set
  "TP_SITUACAO" = 'ABERTO', "TP_TRATAMENTO" = 'DISPENSADO',
  "QT_OCORRENCIA_DISPENSADA" = a."QT_OCORRENCIA_IGNORADA",
  "CO_USUARIO_TRATAMENTO" = a."CO_USUARIO_IGNORADO", "DT_TRATAMENTO" = a."DT_IGNORADO"
 where a."TP_SITUACAO" = 'IGNORADO';
-- O resolvido de antes já tinha passado pela conferência: fica como rechecado.
update public."TB_AVISO_CONFERENCIA" a set
  "TP_TRATAMENTO" = 'RECHECADO_SEM_PROBLEMA', "DT_TRATAMENTO" = a."DT_RESOLUCAO"
 where a."TP_SITUACAO" = 'RESOLVIDO';

alter table public."TB_AVISO_CONFERENCIA"
  drop column "CO_USUARIO_IGNORADO",
  drop column "DT_IGNORADO",
  drop column "DS_MOTIVO_IGNORADO",
  drop column "QT_OCORRENCIA_IGNORADA",
  add constraint "CK_AVISOCONF_TPSITUACAO" check ("TP_SITUACAO" in ('ABERTO', 'RESOLVIDO')),
  add constraint "CK_AVISOCONF_TPTRATAMENTO" check ("TP_TRATAMENTO" in ('PENDENTE', 'EM_ANALISE', 'AGUARDANDO_DOCUMENTO', 'CORRIGIDO', 'RECHECADO_SEM_PROBLEMA', 'DISPENSADO')),
  add constraint "CK_AVISOCONF_QTDISPENSADA" check
    ((("TP_TRATAMENTO" = 'DISPENSADO') = ("QT_OCORRENCIA_DISPENSADA" is not null))
     and coalesce("QT_OCORRENCIA_DISPENSADA", 1) >= 1),
  add constraint "CK_AVISOCONF_DTPRAZO" check ("DT_PRAZO" is null or "CO_USUARIO_RESPONSAVEL" is not null),
  add constraint "CK_AVISOCONF_QT" check ("QT_OCORRENCIA" >= 1);
create index "IN_AVISOCONF_VIGENTE" on public."TB_AVISO_CONFERENCIA" ("CO_MODULO", "CO_AREA")
  where "TP_SITUACAO" = 'ABERTO';
create index "IN_AVISOCONF_COUSURESP" on public."TB_AVISO_CONFERENCIA" ("CO_USUARIO_RESPONSAVEL")
  where "CO_USUARIO_RESPONSAVEL" is not null;

-- 6. As funções que mudam ───────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.gravar_avisos_conferencia(p_execucao text, p_avisos jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare
  v_aviso jsonb;
  v_atual public."TB_AVISO_CONFERENCIA";
  v_id uuid;
  v_conferencia text;
  v_escopo text;
  v_gravidade text;
  v_modulo text;
  v_area text;
  v_edital uuid;
  v_qt integer;
  v_exemplos jsonb;
  v_casos jsonb;
  v_resumo text;
  v_novos integer := 0;
  v_reabertos integer := 0;
  v_mantidos integer := 0;
begin
  perform private."FC_EXIGIR_EXECUCAO_CONFERENCIA"(p_execucao);
  if jsonb_typeof(p_avisos) is distinct from 'array' or jsonb_array_length(p_avisos) > 1000 then
    raise exception 'Envie até 1000 avisos por chamada, em lista' using errcode = '22023';
  end if;

  for v_aviso in select x from jsonb_array_elements(p_avisos) x loop
    v_conferencia := v_aviso ->> 'conferencia';
    v_escopo := v_aviso ->> 'escopo';
    v_gravidade := v_aviso ->> 'gravidade';
    v_modulo := v_aviso ->> 'modulo';
    v_area := nullif(v_aviso ->> 'area', '');
    v_exemplos := coalesce(v_aviso -> 'exemplos', '[]'::jsonb);
    v_casos := v_aviso -> 'casos';
    v_resumo := btrim(coalesce(v_aviso ->> 'resumo', ''));

    if v_conferencia is null or v_conferencia !~ '^[A-Z][A-Z0-9_]{2,59}$' then
      raise exception 'Código de conferência inválido' using errcode = '22023';
    end if;
    if v_escopo is null or v_escopo !~ '^[a-z_]{2,20}:[A-Za-z0-9._:/|-]{1,170}$' then
      raise exception 'Escopo inválido em %', v_conferencia using errcode = '22023';
    end if;
    if v_gravidade is null or v_gravidade not in ('CRITICA', 'ATENCAO', 'INFORMATIVO') then
      raise exception 'Gravidade inválida em %', v_conferencia using errcode = '22023';
    end if;
    if v_modulo is null or v_modulo not in ('analises', 'entrevistas', 'classificacao', 'aprovados', 'cargas') then
      raise exception 'Módulo inválido em %', v_conferencia using errcode = '22023';
    end if;
    if v_area is not null and not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = v_area) then
      raise exception 'Área inválida em %', v_conferencia using errcode = '22023';
    end if;
    begin
      v_edital := nullif(v_aviso ->> 'edital', '')::uuid;
      v_qt := (v_aviso ->> 'quantidade')::integer;
    exception when others then
      raise exception 'Edital ou quantidade inválidos em %', v_conferencia using errcode = '22023';
    end;
    if v_edital is not null and not exists (select 1 from public."TB_MONITORAMENTO_INDIGENA" m where m.id = v_edital) then
      raise exception 'Edital inexistente em %', v_conferencia using errcode = '22023';
    end if;
    if v_qt is null or v_qt < 1 then
      raise exception 'Quantidade inválida em %', v_conferencia using errcode = '22023';
    end if;
    if jsonb_typeof(v_exemplos) <> 'array' or jsonb_array_length(v_exemplos) > 20
       or exists (select 1 from jsonb_array_elements(v_exemplos) e
                   where jsonb_typeof(e) <> 'string'
                      or (e #>> '{}') !~ '^[A-Za-z0-9._:/-]{1,80}$'
                      or (e #>> '{}') ~ '[0-9]{11}') then
      raise exception 'Exemplos de % só com ids e códigos (até 20, sem espaço, sem @, sem 11 dígitos)', v_conferencia
        using errcode = '22023';
    end if;
    -- Casos: até 5000 objetos, cada um com análise (uuid), código ou referência
    -- (identificadores), o tipo da referência e o detalhe (objeto de valores
    -- simples, sem dado pessoal).
    if v_casos is not null and (
         jsonb_typeof(v_casos) <> 'array' or jsonb_array_length(v_casos) > 5000
         or exists (
           select 1 from jsonb_array_elements(v_casos) c
            where jsonb_typeof(c) <> 'object'
               or (c ? 'analise' and jsonb_typeof(c -> 'analise') <> 'null'
                   and coalesce(c ->> 'analise', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
               or (c ? 'codigo' and jsonb_typeof(c -> 'codigo') <> 'null'
                   and (coalesce(c ->> 'codigo', '') !~ '^[A-Za-z0-9._:/-]{1,80}$' or (c ->> 'codigo') ~ '[0-9]{11}'))
               or (c ? 'referencia' and jsonb_typeof(c -> 'referencia') <> 'null'
                   and (coalesce(c ->> 'referencia', '') !~ '^[A-Za-z0-9._:/-]{1,80}$' or (c ->> 'referencia') ~ '[0-9]{11}'))
               or (c ? 'tipo' and jsonb_typeof(c -> 'tipo') <> 'null'
                   and coalesce(c ->> 'tipo', '') not in ('candidato_aprovado', 'entrevista', 'lista_classificacao',
                                                          'ajuste_recurso', 'vaga', 'vaga_empregare'))
               or num_nonnulls(nullif(c ->> 'analise', ''), nullif(c ->> 'codigo', ''), nullif(c ->> 'referencia', '')) = 0
               or (c ? 'detalhe' and (
                     jsonb_typeof(c -> 'detalhe') <> 'object'
                     or exists (select 1 from jsonb_each(c -> 'detalhe') d
                                 where d.key !~ '^[a-z_]{1,30}$'
                                    or jsonb_typeof(d.value) not in ('string', 'number', 'boolean', 'null')
                                    or (jsonb_typeof(d.value) = 'string' and (d.value #>> '{}') !~ '^[A-Za-z0-9._:/-]{0,40}$')
                                    or (d.value #>> '{}') ~ '[0-9]{11}')
                     or length((c -> 'detalhe')::text) > 1000))
         )) then
      raise exception 'Casos de % só com ids, códigos, tipo conhecido e detalhe simples (até 5000, sem nome, @ ou 11 dígitos)', v_conferencia
        using errcode = '22023';
    end if;
    if length(v_resumo) not between 3 and 300 or not private."FC_TEXTO_SEGURO_DO_AVISO"(v_resumo) then
      raise exception 'Resumo de % vazio, longo ou com cara de dado pessoal', v_conferencia using errcode = '22023';
    end if;

    select * into v_atual from public."TB_AVISO_CONFERENCIA" a
     where a."CO_CONFERENCIA" = v_conferencia and a."DS_ESCOPO" = v_escopo
     for update;

    if v_atual."CO_AVISO_CONFERENCIA" is null then
      insert into public."TB_AVISO_CONFERENCIA" (
        "CO_CONFERENCIA", "DS_ESCOPO", "TP_GRAVIDADE", "CO_MODULO", "CO_AREA", "CO_MONITORAMENTO",
        "QT_OCORRENCIA", "DS_EXEMPLO", "DS_RESUMO", "CO_EXECUCAO")
      values (v_conferencia, v_escopo, v_gravidade, v_modulo, v_area, v_edital, v_qt, v_exemplos, v_resumo, p_execucao)
      returning "CO_AVISO_CONFERENCIA" into v_id;
      insert into public."TH_AVISO_CONFERENCIA" ("CO_AVISO_CONFERENCIA", "TP_EVENTO", "TP_TRATAMENTO_ANTERIOR", "TP_TRATAMENTO", "TP_SITUACAO", "QT_OCORRENCIA", "DS_MOTIVO", "CO_EXECUCAO")
      values (v_id, 'ACHADO', null, 'PENDENTE', 'ABERTO', v_qt, null, p_execucao);
      v_novos := v_novos + 1;
    -- 20261118120000: o dispensado volta a pendente se a quantidade passar da dispensada; o resolvido
    -- reabre; tudo vai para o histórico (TH_AVISO_CONFERENCIA), nada se apaga.
    elsif v_atual."TP_SITUACAO" = 'RESOLVIDO'
       or (v_atual."TP_TRATAMENTO" = 'DISPENSADO' and v_qt > v_atual."QT_OCORRENCIA_DISPENSADA") then
      v_id := v_atual."CO_AVISO_CONFERENCIA";
      update public."TB_AVISO_CONFERENCIA" set
        "TP_GRAVIDADE" = v_gravidade, "CO_MODULO" = v_modulo, "CO_AREA" = v_area, "CO_MONITORAMENTO" = v_edital,
        "QT_OCORRENCIA" = v_qt, "DS_EXEMPLO" = v_exemplos, "DS_RESUMO" = v_resumo, "CO_EXECUCAO" = p_execucao,
        "TP_SITUACAO" = 'ABERTO', "DT_ULTIMA_VEZ" = now(), "DT_RESOLUCAO" = null,
        "DT_PRIMEIRA_VEZ" = case when v_atual."TP_SITUACAO" = 'RESOLVIDO' then now() else "DT_PRIMEIRA_VEZ" end,
        "TP_TRATAMENTO" = 'PENDENTE', "QT_OCORRENCIA_DISPENSADA" = null,
        "CO_USUARIO_TRATAMENTO" = null, "DT_TRATAMENTO" = now()
       where "CO_AVISO_CONFERENCIA" = v_id;
      insert into public."TH_AVISO_CONFERENCIA" ("CO_AVISO_CONFERENCIA", "TP_EVENTO", "TP_TRATAMENTO_ANTERIOR", "TP_TRATAMENTO", "TP_SITUACAO", "QT_OCORRENCIA", "DS_MOTIVO", "CO_EXECUCAO")
      values (v_id, 'REABERTO', v_atual."TP_TRATAMENTO", 'PENDENTE', 'ABERTO', v_qt,
              case when v_atual."TP_SITUACAO" = 'RESOLVIDO' then 'Achado de novo depois de resolvido'
                   else 'A quantidade passou da dispensada (' || v_atual."QT_OCORRENCIA_DISPENSADA" || ')' end,
              p_execucao);
      v_reabertos := v_reabertos + 1;
    elsif v_atual."TP_TRATAMENTO" = 'CORRIGIDO'
          and v_atual."DT_TRATAMENTO" < (select c."DT_INICIO" from public."TL_CONFERENCIA" c where c."CO_EXECUCAO" = p_execucao) then
      -- Marcado como corrigido antes desta execução, e ela ainda acha: volta para análise.
      v_id := v_atual."CO_AVISO_CONFERENCIA";
      update public."TB_AVISO_CONFERENCIA" set
        "TP_GRAVIDADE" = v_gravidade, "CO_MODULO" = v_modulo, "CO_AREA" = v_area, "CO_MONITORAMENTO" = v_edital,
        "QT_OCORRENCIA" = v_qt, "DS_EXEMPLO" = v_exemplos, "DS_RESUMO" = v_resumo, "CO_EXECUCAO" = p_execucao,
        "DT_ULTIMA_VEZ" = now(), "TP_TRATAMENTO" = 'EM_ANALISE', "CO_USUARIO_TRATAMENTO" = null, "DT_TRATAMENTO" = now()
       where "CO_AVISO_CONFERENCIA" = v_id;
      insert into public."TH_AVISO_CONFERENCIA" ("CO_AVISO_CONFERENCIA", "TP_EVENTO", "TP_TRATAMENTO_ANTERIOR", "TP_TRATAMENTO", "TP_SITUACAO", "QT_OCORRENCIA", "DS_MOTIVO", "CO_EXECUCAO")
      values (v_id, 'RECHECADO_COM_PROBLEMA', 'CORRIGIDO', 'EM_ANALISE', 'ABERTO', v_qt,
              'Marcado como corrigido, mas a conferência ainda acha o problema', p_execucao);
      v_mantidos := v_mantidos + 1;
    else
      v_id := v_atual."CO_AVISO_CONFERENCIA";
      update public."TB_AVISO_CONFERENCIA" set
        "TP_GRAVIDADE" = v_gravidade, "CO_MODULO" = v_modulo, "CO_AREA" = v_area, "CO_MONITORAMENTO" = v_edital,
        "QT_OCORRENCIA" = v_qt, "DS_EXEMPLO" = v_exemplos, "DS_RESUMO" = v_resumo, "CO_EXECUCAO" = p_execucao,
        "DT_ULTIMA_VEZ" = now()
       where "CO_AVISO_CONFERENCIA" = v_id;
      v_mantidos := v_mantidos + 1;
    end if;

    -- Com 'casos', os do aviso são trocados pelos desta execução.
    if v_casos is not null then
      delete from public."TB_CASO_AVISO_CONFERENCIA" k where k."CO_AVISO_CONFERENCIA" = v_id;
      insert into public."TB_CASO_AVISO_CONFERENCIA" (
        "CO_AVISO_CONFERENCIA", "NU_CASO", "CO_ANALISE_CURRICULAR", "CO_CANDIDATO_EMPREGARE", "DS_REFERENCIA",
        "TP_REFERENCIA", "DS_DETALHE")
      select v_id, x.ordem::integer, nullif(x.caso ->> 'analise', '')::uuid,
             nullif(x.caso ->> 'codigo', ''), nullif(x.caso ->> 'referencia', ''), nullif(x.caso ->> 'tipo', ''),
             coalesce(case when jsonb_typeof(x.caso -> 'detalhe') = 'object' then x.caso -> 'detalhe' end, '{}'::jsonb)
        from jsonb_array_elements(v_casos) with ordinality as x(caso, ordem);
    end if;
  end loop;

  update public."TL_CONFERENCIA" set "QT_AVISO_NOVO" = "QT_AVISO_NOVO" + v_novos + v_reabertos
   where "CO_EXECUCAO" = p_execucao;
  return jsonb_build_object('novos', v_novos, 'reabertos', v_reabertos, 'mantidos', v_mantidos);
end;
$_$;

COMMENT ON FUNCTION public.gravar_avisos_conferencia(p_execucao text, p_avisos jsonb) IS 'Grava até 1000 avisos de uma execução (um por conferência + escopo): novo abre; resolvido reabre; dispensado volta a pendente só se a quantidade passou da dispensada; corrigido antes da execução e achado de novo volta para em análise; aberto atualiza quantidade e exemplos. Cada mudança vai para TH_AVISO_CONFERENCIA (20261118120000). Com ''casos'' (até 5000: análise, código do candidato, referência, tipo da referência e o detalhe que motivou), troca os casos do aviso. Recusa (22023) exemplo ou caso que não seja id ou código (espaço, @, 11 dígitos), tipo desconhecido e resumo com cara de dado pessoal. Só service_role.';

CREATE OR REPLACE FUNCTION public.finalizar_conferencia(p_execucao text, p_conferencias text[], p_falhas text[] DEFAULT '{}'::text[], p_erro text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare
  v_mensagem text := nullif(left(btrim(coalesce(p_erro, '')), 2000), '');
  v_conferencias text[] := coalesce(p_conferencias, '{}');
  v_falhas text[] := coalesce(p_falhas, '{}');
  v_resolvidos integer := 0;
  v_abertos integer;
  v_situacao text;
begin
  perform private."FC_EXIGIR_EXECUCAO_CONFERENCIA"(p_execucao);
  if exists (select 1 from unnest(v_conferencias || v_falhas) c where c is null or c !~ '^[A-Z][A-Z0-9_]{2,59}$') then
    raise exception 'Código de conferência inválido' using errcode = '22023';
  end if;
  if v_mensagem is not null and not private."FC_TEXTO_SEGURO_DO_AVISO"(v_mensagem) then
    v_mensagem := 'Erro geral (a mensagem foi omitida por parecer ter dado pessoal).';
  end if;

  -- Só conferência que rodou até o fim resolve: a que falhou deixa os avisos como estavam.
  -- 20261118120000: o tratamento vira "rechecado sem problema" (o dispensado continua dispensado) e o
  -- histórico guarda o que era; o motivo de quem tratou não se apaga.
  if v_mensagem is null then
    with alvo as (
      select a."CO_AVISO_CONFERENCIA" as id, a."TP_TRATAMENTO" as antes, a."QT_OCORRENCIA" as qt
        from public."TB_AVISO_CONFERENCIA" a
       where a."CO_CONFERENCIA" = any (v_conferencias)
         and not (a."CO_CONFERENCIA" = any (v_falhas))
         and a."TP_SITUACAO" = 'ABERTO'
         and a."CO_EXECUCAO" <> p_execucao
         for update
    ),
    mudou as (
      update public."TB_AVISO_CONFERENCIA" a set
        "TP_SITUACAO" = 'RESOLVIDO', "DT_RESOLUCAO" = now(),
        "TP_TRATAMENTO" = case when x.antes = 'DISPENSADO' then 'DISPENSADO' else 'RECHECADO_SEM_PROBLEMA' end,
        "CO_USUARIO_TRATAMENTO" = case when x.antes = 'DISPENSADO' then a."CO_USUARIO_TRATAMENTO" end,
        "DT_TRATAMENTO" = case when x.antes = 'DISPENSADO' then a."DT_TRATAMENTO" else now() end
        from alvo x
       where a."CO_AVISO_CONFERENCIA" = x.id
      returning a."CO_AVISO_CONFERENCIA" as id, a."TP_TRATAMENTO" as depois
    ),
    historico as (
      insert into public."TH_AVISO_CONFERENCIA" ("CO_AVISO_CONFERENCIA", "TP_EVENTO", "TP_TRATAMENTO_ANTERIOR", "TP_TRATAMENTO", "TP_SITUACAO", "QT_OCORRENCIA", "CO_EXECUCAO")
      select x.id, 'NAO_ACHADO', x.antes, m.depois, 'RESOLVIDO', x.qt, p_execucao
        from alvo x join mudou m on m.id = x.id
      returning 1
    )
    select count(*) into v_resolvidos from historico;
  end if;

  select count(*) into v_abertos from public."TB_AVISO_CONFERENCIA" a where a."TP_SITUACAO" = 'ABERTO';
  v_situacao := case
    when v_mensagem is not null then 'FALHOU'
    when cardinality(v_falhas) > 0 then 'PARCIAL'
    else 'CONCLUIDA' end;

  update public."TL_CONFERENCIA" set
    "TP_SITUACAO" = v_situacao, "DT_FIM" = now(),
    "DS_CONFERENCIA" = to_jsonb(v_conferencias), "DS_FALHA" = to_jsonb(v_falhas),
    "QT_AVISO_ABERTO" = v_abertos, "QT_AVISO_RESOLVIDO" = v_resolvidos, "DS_MENSAGEM" = v_mensagem
   where "CO_EXECUCAO" = p_execucao;

  return jsonb_build_object(
    'situacao', v_situacao, 'abertos', v_abertos, 'resolvidos', v_resolvidos,
    'novos', (select c."QT_AVISO_NOVO" from public."TL_CONFERENCIA" c where c."CO_EXECUCAO" = p_execucao));
end;
$_$;

COMMENT ON FUNCTION public.finalizar_conferencia(p_execucao text, p_conferencias text[], p_falhas text[], p_erro text) IS 'Fecha a execução das conferências: os avisos abertos das conferências que rodaram até o fim e não foram achados de novo viram RESOLVIDO, com o tratamento RECHECADO_SEM_PROBLEMA (o DISPENSADO fica) e o evento NAO_ACHADO no histórico (20261118120000); com p_erro, nada é resolvido e a execução FALHOU; com falhas, PARCIAL. Só service_role.';

CREATE OR REPLACE FUNCTION private."FC_FECHAR_CASOS_DO_AVISO"(p_conferencia text, p_candidatos uuid[]) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_avisos uuid[];
begin
  -- O caso sai do aviso; o aviso sem caso fica resolvido (a conferência confirma na rodada seguinte).
  with apagados as (
    delete from public."TB_CASO_AVISO_CONFERENCIA" k
     using public."TB_AVISO_CONFERENCIA" a
     where a."CO_AVISO_CONFERENCIA" = k."CO_AVISO_CONFERENCIA"
       and a."CO_CONFERENCIA" = p_conferencia
       and a."TP_SITUACAO" = 'ABERTO'
       and k."DS_REFERENCIA" = any (select c::text from unnest(p_candidatos) c)
    returning k."CO_AVISO_CONFERENCIA"
  )
  select array_agg(distinct x."CO_AVISO_CONFERENCIA") into v_avisos from apagados x;
  if v_avisos is null then
    return 0;
  end if;
  update public."TB_AVISO_CONFERENCIA" a
     set "DS_EXEMPLO" = (select coalesce(jsonb_agg(e), '[]'::jsonb) from jsonb_array_elements(a."DS_EXEMPLO") e
                          where not ((e #>> '{}') = any (select c::text from unnest(p_candidatos) c))),
         "QT_OCORRENCIA" = greatest(1, (select count(*) from public."TB_CASO_AVISO_CONFERENCIA" k
                                         where k."CO_AVISO_CONFERENCIA" = a."CO_AVISO_CONFERENCIA")::integer)
   where a."CO_AVISO_CONFERENCIA" = any (v_avisos)
     and exists (select 1 from public."TB_CASO_AVISO_CONFERENCIA" k where k."CO_AVISO_CONFERENCIA" = a."CO_AVISO_CONFERENCIA");
  -- 20261118120000: o aviso sem caso fica resolvido como rechecado sem problema (o dispensado fica), no histórico.
  with alvo as (
    select a."CO_AVISO_CONFERENCIA" as id, a."TP_TRATAMENTO" as antes, a."QT_OCORRENCIA" as qt
      from public."TB_AVISO_CONFERENCIA" a
     where a."CO_AVISO_CONFERENCIA" = any (v_avisos)
       and not exists (select 1 from public."TB_CASO_AVISO_CONFERENCIA" k where k."CO_AVISO_CONFERENCIA" = a."CO_AVISO_CONFERENCIA")
  ),
  mudou as (
    update public."TB_AVISO_CONFERENCIA" a
       set "TP_SITUACAO" = 'RESOLVIDO', "DT_RESOLUCAO" = now(),
           "TP_TRATAMENTO" = case when x.antes = 'DISPENSADO' then 'DISPENSADO' else 'RECHECADO_SEM_PROBLEMA' end,
           "DT_TRATAMENTO" = case when x.antes = 'DISPENSADO' then a."DT_TRATAMENTO" else now() end
      from alvo x
     where a."CO_AVISO_CONFERENCIA" = x.id
    returning a."CO_AVISO_CONFERENCIA" as id, a."TP_TRATAMENTO" as depois
  )
  insert into public."TH_AVISO_CONFERENCIA" ("CO_AVISO_CONFERENCIA", "TP_EVENTO", "TP_TRATAMENTO_ANTERIOR", "TP_TRATAMENTO", "TP_SITUACAO", "QT_OCORRENCIA", "DS_MOTIVO", "CO_USUARIO")
  select x.id, 'NAO_ACHADO', x.antes, m.depois, 'RESOLVIDO', x.qt, 'Casos decididos na pendência do edital', auth.uid()
    from alvo x join mudou m on m.id = x.id;
  return cardinality(v_avisos);
end;
$$;

COMMENT ON FUNCTION private."FC_FECHAR_CASOS_DO_AVISO"(p_conferencia text, p_candidatos uuid[]) IS 'Tira dos avisos abertos da conferência os casos das linhas decididas na pendência e resolve o aviso que fica sem caso. 20261026190000; histórico e tratamento em 20261118120000.';

CREATE OR REPLACE FUNCTION public.listar_avisos_conferencia(p_area text DEFAULT NULL::text, p_modulo text DEFAULT NULL::text) RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_area text := nullif(lower(btrim(coalesce(p_area, ''))), '');
  v_modulo text := nullif(lower(btrim(coalesce(p_modulo, ''))), '');
begin
  if auth.uid() is null then
    raise exception 'Sessão necessária' using errcode = '42501';
  end if;
  if v_area is not null and not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = v_area) then
    raise exception 'Área inválida' using errcode = '22023';
  end if;
  if v_modulo is not null and v_modulo not in ('analises', 'entrevistas', 'classificacao', 'aprovados', 'cargas') then
    raise exception 'Módulo inválido' using errcode = '22023';
  end if;

  return json_build_object(
    'schema_version', 1,
    'gerado_em', now(),
    'ultima_execucao', (
      select json_build_object('inicio', c."DT_INICIO", 'fim', c."DT_FIM", 'situacao', c."TP_SITUACAO")
        from public."TL_CONFERENCIA" c
       where c."TP_SITUACAO" <> 'EM_ANDAMENTO'
       order by c."DT_INICIO" desc
       limit 1
    ),
    'avisos', (
      select coalesce(json_agg(json_build_object(
          'id', a."CO_AVISO_CONFERENCIA",
          'conferencia', a."CO_CONFERENCIA",
          'escopo', a."DS_ESCOPO",
          'gravidade', a."TP_GRAVIDADE",
          'modulo', a."CO_MODULO",
          'area', a."CO_AREA",
          'edital_id', a."CO_MONITORAMENTO",
          'edital', m.edital,
          'quantidade', a."QT_OCORRENCIA",
          'exemplos', a."DS_EXEMPLO",
          'resumo', a."DS_RESUMO",
          'situacao', a."TP_SITUACAO",
          'primeira_vez', a."DT_PRIMEIRA_VEZ",
          'ultima_vez', a."DT_ULTIMA_VEZ",
          'resolvido_em', a."DT_RESOLUCAO",
          -- 20261118120000: o tratamento da equipe, o último motivo, responsável, prazo e evidências.
          'tratamento', a."TP_TRATAMENTO",
          'tratado_em', a."DT_TRATAMENTO",
          'tratado_por', private."FC_NOME_DO_USUARIO"(a."CO_USUARIO_TRATAMENTO"),
          'motivo', (select h."DS_MOTIVO" from public."TH_AVISO_CONFERENCIA" h
                      where h."CO_AVISO_CONFERENCIA" = a."CO_AVISO_CONFERENCIA"
                        and h."TP_EVENTO" in ('TRATAMENTO', 'REABERTO', 'RECHECADO_COM_PROBLEMA', 'MIGRADO')
                      order by h."CO_EVENTO" desc limit 1),
          'responsavel_id', a."CO_USUARIO_RESPONSAVEL",
          'responsavel', private."FC_NOME_DO_USUARIO"(a."CO_USUARIO_RESPONSAVEL"),
          'prazo', a."DT_PRAZO",
          'evidencias', (select count(*) from public."TB_EVIDENCIA_AVISO_CONFERENCIA" e
                          where e."CO_AVISO_CONFERENCIA" = a."CO_AVISO_CONFERENCIA" and e."ST_REGISTRO_ATIVO" = 'S'),
          'pode_gerir', a."TP_SITUACAO" = 'ABERTO'
                        and private."FC_PODE_IGNORAR_AVISO"(a."CO_MODULO", a."CO_AREA", a."CO_MONITORAMENTO"),
          'pode_tratar', a."TP_SITUACAO" = 'ABERTO'
                         and (a."CO_USUARIO_RESPONSAVEL" = auth.uid()
                              or private."FC_PODE_IGNORAR_AVISO"(a."CO_MODULO", a."CO_AREA", a."CO_MONITORAMENTO"))
        ) order by case a."TP_SITUACAO" when 'ABERTO' then 0 else 1 end,
                   case a."TP_GRAVIDADE" when 'CRITICA' then 0 when 'ATENCAO' then 1 else 2 end,
                   a."DT_PRIMEIRA_VEZ"), '[]'::json)
        from public."TB_AVISO_CONFERENCIA" a
        left join public."TB_MONITORAMENTO_INDIGENA" m on m.id = a."CO_MONITORAMENTO"
       where (a."TP_SITUACAO" = 'ABERTO' or a."DT_RESOLUCAO" >= now() - interval '30 days')
         and (v_area is null or a."CO_AREA" = v_area)
         and (v_modulo is null or a."CO_MODULO" = v_modulo)
         and private."FC_PODE_VER_AVISO"(a."CO_MODULO", a."CO_AREA", a."CO_MONITORAMENTO")
    )
  );
end;
$$;

COMMENT ON FUNCTION public.listar_avisos_conferencia(p_area text, p_modulo text) IS 'Avisos de conferência abertos e os resolvidos nos últimos 30 dias (json) que quem chama pode ver: o módulo (leitor), a área e o edital no recorte; cargas e avisos sem área, só o administrador global. Filtra por área e módulo (opcionais). Com o tratamento da equipe, o último motivo, responsável, prazo e quantas evidências (20261118120000); pode_gerir (dispensar, atribuir) e pode_tratar (o gestor ou o responsável).';

CREATE OR REPLACE FUNCTION public.listar_casos_aviso_conferencia(p_aviso uuid DEFAULT NULL::uuid, p_busca text DEFAULT NULL::text, p_area text DEFAULT NULL::text, p_modulo text DEFAULT NULL::text, p_limite integer DEFAULT 50, p_deslocamento integer DEFAULT 0) RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    SET statement_timeout TO '15s'
    AS $_$
declare
  v_area text := nullif(lower(btrim(coalesce(p_area, ''))), '');
  v_modulo text := nullif(lower(btrim(coalesce(p_modulo, ''))), '');
  v_busca text := nullif(private."FC_TEXTO_DE_BUSCA"(left(coalesce(p_busca, ''), 80)), '');
  v_limite integer := least(greatest(coalesce(p_limite, 50), 1), 1000);
  v_deslocamento integer := greatest(coalesce(p_deslocamento, 0), 0);
  v_total integer;
  v_casos json;
begin
  if auth.uid() is null then
    raise exception 'Sessão necessária' using errcode = '42501';
  end if;
  if v_area is not null and not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = v_area) then
    raise exception 'Área inválida' using errcode = '22023';
  end if;
  if v_modulo is not null and v_modulo not in ('analises', 'entrevistas', 'classificacao', 'aprovados', 'cargas') then
    raise exception 'Módulo inválido' using errcode = '22023';
  end if;
  if p_aviso is null and v_busca is null then
    raise exception 'Informe o aviso ou o que buscar' using errcode = '22023';
  end if;
  if p_aviso is not null and not exists (
       select 1 from public."TB_AVISO_CONFERENCIA" a
        where a."CO_AVISO_CONFERENCIA" = p_aviso
          and private."FC_PODE_VER_AVISO"(a."CO_MODULO", a."CO_AREA", a."CO_MONITORAMENTO")) then
    raise exception 'Aviso não encontrado' using errcode = '22023';
  end if;

  with avisos as (
    select a."CO_AVISO_CONFERENCIA" as id, a."CO_CONFERENCIA" as conferencia, a."CO_MODULO" as modulo,
           a."CO_AREA" as area, a."CO_MONITORAMENTO" as edital
      from public."TB_AVISO_CONFERENCIA" a
     -- 20261118120000: os casos do aviso resolvido também se abrem (pelo id); a busca, só nos abertos.
     where (a."TP_SITUACAO" = 'ABERTO' or a."CO_AVISO_CONFERENCIA" = p_aviso)
       and (p_aviso is null or a."CO_AVISO_CONFERENCIA" = p_aviso)
       and (v_area is null or a."CO_AREA" = v_area)
       and (v_modulo is null or a."CO_MODULO" = v_modulo)
       and private."FC_PODE_VER_AVISO"(a."CO_MODULO", a."CO_AREA", a."CO_MONITORAMENTO")
  ),
  casos as materialized (
    select av.id as aviso, av.conferencia, k."NU_CASO" as ordem,
           k."CO_ANALISE_CURRICULAR" as analise_do_caso, k."CO_CANDIDATO_EMPREGARE" as codigo_do_caso,
           k."DS_REFERENCIA" as referencia_do_caso, k."DS_DETALHE" as detalhe,
           an.id as an_id, nullif(btrim(an.id_origem), '') as an_codigo, an.candidato as an_nome,
           an.edital as an_edital, an.codigo_vaga as an_codigo_vaga, an.nome_vaga as an_nome_vaga,
           an.responsavel_analise, an.status_consolidado as an_status, an.data_analise,
           private."FC_REFERENCIA_DO_CASO"(av.modulo, av.conferencia, k."TP_REFERENCIA", k."DS_REFERENCIA",
                                           k."CO_ANALISE_CURRICULAR", av.area, av.edital) as r
      from avisos av
      join public."TB_CASO_AVISO_CONFERENCIA" k on k."CO_AVISO_CONFERENCIA" = av.id
      left join lateral (
        (select x.id, x.id_origem, x.candidato, x.edital, x.codigo_vaga, x.nome_vaga,
                x.responsavel_analise, x.status_consolidado, x.data_analise
           from public."TB_ANALISE_CURRICULAR" x
          where x.id = k."CO_ANALISE_CURRICULAR"
            and private."FC_PODE_VER_ANALISE_DO_AVISO"(x."CO_AREA", x.edital_norm, x.unidade_norm))
        union all
        (select x.id, x.id_origem, x.candidato, x.edital, x.codigo_vaga, x.nome_vaga,
                x.responsavel_analise, x.status_consolidado, x.data_analise
           from public."TB_ANALISE_CURRICULAR" x
          where k."CO_ANALISE_CURRICULAR" is null
            and x.ativo is true
            and x.id_origem = k."CO_CANDIDATO_EMPREGARE"
            and private."FC_PODE_VER_ANALISE_DO_AVISO"(x."CO_AREA", x.edital_norm, x.unidade_norm)
          order by x.edital, x.id
          limit 1)
        limit 1
      ) an on true
  ),
  resolvidos as materialized (
    select c.*,
           coalesce(c.an_nome, c.r ->> 'nome') as nome,
           coalesce(c.codigo_do_caso, c.an_codigo, c.r ->> 'codigo') as codigo,
           coalesce(c.an_edital, c.r ->> 'edital') as edital,
           coalesce(c.an_codigo_vaga, c.r ->> 'codigo_vaga') as codigo_vaga,
           coalesce(c.an_nome_vaga, c.r ->> 'nome_vaga') as nome_vaga,
           coalesce(c.r ->> 'status', c.an_status) as status,
           c.r ->> 'tipo' as tipo,
           case
             when c.an_id is not null or c.r ->> 'resolucao' = 'ok' then 'ok'
             when c.r ? 'resolucao' then c.r ->> 'resolucao'
             when c.analise_do_caso is not null then
               case when exists (select 1 from public."TB_ANALISE_CURRICULAR" x where x.id = c.analise_do_caso)
                    then 'sem_acesso' else 'removido' end
             when c.codigo_do_caso is not null then
               case when exists (select 1 from public."TB_ANALISE_CURRICULAR" x
                                  where x.ativo is true and x.id_origem = c.codigo_do_caso)
                    then 'sem_acesso' else 'removido' end
             when c.referencia_do_caso ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then 'removido'
             else 'ok'
           end as resolucao,
           -- A referência só sai quando é um código (vaga, lista do job antigo), nunca um UUID.
           case when c.referencia_do_caso ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                then null else c.referencia_do_caso end as referencia,
           case when c.r ->> 'tipo' = 'candidato_aprovado'
                 and c.referencia_do_caso ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                then c.referencia_do_caso::uuid end as aprovado_do_caso
      from casos c
  ),
  filtrados as (
    select f.* from resolvidos f
     where v_busca is null
        or private."FC_TEXTO_DE_BUSCA"(coalesce(f.codigo, '')) like '%' || v_busca || '%'
        or private."FC_TEXTO_DE_BUSCA"(coalesce(f.referencia, '')) like '%' || v_busca || '%'
        or private."FC_TEXTO_DE_BUSCA"(coalesce(f.nome, '')) like '%' || v_busca || '%'
        or private."FC_TEXTO_DE_BUSCA"(coalesce(f.codigo_vaga, '')) like '%' || v_busca || '%'
        or private."FC_TEXTO_DE_BUSCA"(coalesce(f.nome_vaga, '')) like '%' || v_busca || '%'
  ),
  numerados as (
    select f.*,
           row_number() over (order by f.nome is null, private."FC_TEXTO_DE_BUSCA"(f.nome),
                                       f.codigo, f.codigo_vaga, f.conferencia, f.ordem) as posicao,
           count(*) over () as total
      from filtrados f
  ),
  pagina as materialized (
    select n.*,
           case when n.aprovado_do_caso is not null
                then private."FC_VINCULOS_DO_APROVADO"(n.aprovado_do_caso) end as vinculos
      from numerados n
     where n.posicao > v_deslocamento and n.posicao <= v_deslocamento + v_limite
  )
  select (select max(n.total) from numerados n)::integer,
         json_agg(json_build_object(
           'aviso_id', p.aviso,
           'conferencia', p.conferencia,
           'ordem', p.ordem,
           'tipo', p.tipo,
           'resolucao', p.resolucao,
           'analise_id', coalesce(p.an_id::text, p.r ->> 'analise_id'),
           'aprovado_id', p.r ->> 'aprovado_id',
           'entrevista_id', p.r ->> 'entrevista_id',
           'edital_id', p.r ->> 'edital_id',
           'codigo', p.codigo,
           'nome', p.nome,
           'edital', p.edital,
           'codigo_vaga', p.codigo_vaga,
           'nome_vaga', p.nome_vaga,
           'responsavel', p.responsavel_analise,
           'status', p.status,
           'data_analise', p.data_analise,
           'nota', p.r -> 'nota',
           'compareceu', p.r ->> 'compareceu',
           'data_convocacao', p.r ->> 'data_convocacao',
           'data_contratacao', p.r ->> 'data_contratacao',
           'candidatos', p.r -> 'candidatos',
           'lista', p.r -> 'lista',
           'referencia', p.referencia,
           'detalhe', p.detalhe,
           'vinculos', p.vinculos -> 'vinculos',
           'analises', case when p.analise_do_caso is null and p.codigo_do_caso is not null then (
             select coalesce(json_agg(json_build_object(
                      'id', x.id, 'edital', x.edital, 'codigo_vaga', x.codigo_vaga, 'nome_vaga', x.nome_vaga,
                      'status', x.status_consolidado, 'responsavel', x.responsavel_analise,
                      'data_analise', x.data_analise) order by x.edital, x.codigo_vaga, x.id), '[]'::json)
               from public."TB_ANALISE_CURRICULAR" x
              where x.ativo is true and x.id_origem = p.codigo_do_caso
                and private."FC_PODE_VER_ANALISE_DO_AVISO"(x."CO_AREA", x.edital_norm, x.unidade_norm)) end,
           'fora_do_acesso', case
             when p.analise_do_caso is null and p.codigo_do_caso is not null then (
               select count(*)::integer
                 from public."TB_ANALISE_CURRICULAR" x
                where x.ativo is true and x.id_origem = p.codigo_do_caso
                  and not private."FC_PODE_VER_ANALISE_DO_AVISO"(x."CO_AREA", x.edital_norm, x.unidade_norm))
             when p.vinculos is not null then (p.vinculos ->> 'fora')::integer end
         ) order by p.posicao)
    into v_total, v_casos
    from pagina p;

  return json_build_object(
    'schema_version', 2,
    'total', coalesce(v_total, 0),
    'limite', v_limite,
    'deslocamento', v_deslocamento,
    'casos', coalesce(v_casos, '[]'::json));
end;
$_$;

COMMENT ON FUNCTION public.listar_casos_aviso_conferencia(p_aviso uuid, p_busca text, p_area text, p_modulo text, p_limite integer, p_deslocamento integer) IS 'Casos (json, em páginas de até 1000) de um aviso de conferência, ou de todos os avisos abertos e ignorados que quem chama vê (área e módulo opcionais; exige p_busca). Busca por código do candidato, nome, código ou nome da vaga e referência (sem acento e sem caixa). Cada caso: tipo e resolução (ok, removido, sem_acesso), código, nome, edital, vaga, situação e datas — da análise (área e recorte de quem lê) ou do registro do módulo (aprovado, entrevista, lista, ajuste, vaga) com a permissão daquele módulo —, o detalhe que motivou o aviso, as análises do candidato em dois editais e as vagas da pessoa nas listas de aprovados (com quantas ficaram fora do acesso). A referência só sai quando não é UUID. Sem CPF.';

drop function public.ignorar_aviso_conferencia(uuid, text);

-- 5. Funções novas ─────────────────────────────────────────────────────────────────────────────
create function private."FC_PODE_SER_RESPONSAVEL_AVISO"(p_usuario uuid, p_modulo text) returns boolean
  language sql stable security definer
  set search_path to ''
as $$
  select p_usuario is not null and exists (
    select 1 from public."TB_PERFIL_USUARIO" p
     where p.user_id = p_usuario and p.ativo is true
       and (private."FC_ADMIN_GLOBAL_ATIVO"(p_usuario)
            or (private."FC_CONFERENCIA_RECURSO"(p_modulo) is not null
                and private."FC_NIVEL_EFETIVO"(p.id, p.perfil, private."FC_CONFERENCIA_RECURSO"(p_modulo))
                      in ('leitor', 'editor', 'admin'))));
$$;
comment on function private."FC_PODE_SER_RESPONSAVEL_AVISO"(uuid, text) is 'O usuário (auth.users.id) pode ser responsável por um aviso do módulo? Perfil ativo com acesso ao módulo (leitor ou mais) ou administrador global; cargas, só o administrador global (20261118120000).';
revoke all on function private."FC_PODE_SER_RESPONSAVEL_AVISO"(uuid, text) from public;

create function private."FC_AVISO_PARA_AGIR"(p_id uuid, p_gerir boolean) returns public."TB_AVISO_CONFERENCIA"
  language plpgsql security definer
  set search_path to ''
as $$
declare
  v_aviso public."TB_AVISO_CONFERENCIA";
begin
  if auth.uid() is null then
    raise exception 'Sessão necessária' using errcode = '42501';
  end if;
  select * into v_aviso from public."TB_AVISO_CONFERENCIA" a where a."CO_AVISO_CONFERENCIA" = p_id for update;
  if v_aviso."CO_AVISO_CONFERENCIA" is null
     or not private."FC_PODE_VER_AVISO"(v_aviso."CO_MODULO", v_aviso."CO_AREA", v_aviso."CO_MONITORAMENTO") then
    raise exception 'Aviso não encontrado' using errcode = '22023';
  end if;
  if not private."FC_PODE_IGNORAR_AVISO"(v_aviso."CO_MODULO", v_aviso."CO_AREA", v_aviso."CO_MONITORAMENTO")
     and (p_gerir or v_aviso."CO_USUARIO_RESPONSAVEL" is distinct from auth.uid()) then
    raise exception '%', case when p_gerir then 'Só o gestor do módulo ou o administrador global faz isso'
                              else 'Só o gestor do módulo ou o responsável pelo aviso faz isso' end
      using errcode = '42501';
  end if;
  if v_aviso."TP_SITUACAO" <> 'ABERTO' then
    raise exception 'O aviso já foi resolvido pela conferência' using errcode = '22023';
  end if;
  return v_aviso;
end;
$$;
comment on function private."FC_AVISO_PARA_AGIR"(uuid, boolean) is 'O aviso aberto que quem chama pode mexer, travado (for update): p_gerir (dispensar, atribuir) exige o gestor do módulo ou o administrador global (FC_PODE_IGNORAR_AVISO); senão, também o responsável. 20261118120000.';
revoke all on function private."FC_AVISO_PARA_AGIR"(uuid, boolean) from public;

create function public.tratar_aviso_conferencia(p_id uuid, p_tratamento text, p_motivo text default null) returns json
  language plpgsql security definer
  set search_path to ''
as $$
declare
  v_tratamento text := upper(btrim(coalesce(p_tratamento, '')));
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_aviso public."TB_AVISO_CONFERENCIA";
begin
  if v_tratamento not in ('EM_ANALISE', 'AGUARDANDO_DOCUMENTO', 'CORRIGIDO', 'DISPENSADO') then
    raise exception 'Situação inválida' using errcode = '22023';
  end if;
  v_aviso := private."FC_AVISO_PARA_AGIR"(p_id, v_tratamento = 'DISPENSADO');
  if v_tratamento = 'DISPENSADO' and (v_motivo is null or length(v_motivo) not between 10 and 500) then
    raise exception 'Escreva a justificativa (10 a 500 caracteres)' using errcode = '22023';
  end if;
  if v_tratamento in ('AGUARDANDO_DOCUMENTO', 'CORRIGIDO') and (v_motivo is null or length(v_motivo) < 3) then
    raise exception 'Escreva o que falta ou o que foi corrigido (3 a 500 caracteres)' using errcode = '22023';
  end if;
  if v_motivo is not null and (length(v_motivo) not between 3 and 500 or not private."FC_TEXTO_SEGURO_DO_AVISO"(v_motivo)) then
    raise exception 'Motivo de 3 a 500 caracteres, sem CPF nem e-mail' using errcode = '22023';
  end if;

  update public."TB_AVISO_CONFERENCIA" set
    "TP_TRATAMENTO" = v_tratamento,
    "QT_OCORRENCIA_DISPENSADA" = case when v_tratamento = 'DISPENSADO' then "QT_OCORRENCIA" end,
    "CO_USUARIO_TRATAMENTO" = auth.uid(), "DT_TRATAMENTO" = now()
   where "CO_AVISO_CONFERENCIA" = p_id;
  insert into public."TH_AVISO_CONFERENCIA" (
    "CO_AVISO_CONFERENCIA", "TP_EVENTO", "TP_TRATAMENTO_ANTERIOR", "TP_TRATAMENTO", "TP_SITUACAO", "QT_OCORRENCIA",
    "DS_MOTIVO", "CO_USUARIO")
  values (p_id, 'TRATAMENTO', v_aviso."TP_TRATAMENTO", v_tratamento, 'ABERTO', v_aviso."QT_OCORRENCIA", v_motivo, auth.uid());

  return json_build_object('id', p_id, 'tratamento', v_tratamento, 'tratado_em', now());
end;
$$;
comment on function public.tratar_aviso_conferencia(uuid, text, text) is 'Muda o tratamento de um aviso aberto (20261118120000): EM_ANALISE, AGUARDANDO_DOCUMENTO e CORRIGIDO (o gestor do módulo ou o responsável; os dois últimos com motivo), DISPENSADO (só o gestor ou o administrador global, justificativa de 10 a 500). Grava o histórico. O RECHECADO_SEM_PROBLEMA é só da conferência.';
revoke all on function public.tratar_aviso_conferencia(uuid, text, text) from public;
grant execute on function public.tratar_aviso_conferencia(uuid, text, text) to authenticated;

create function public.atribuir_aviso_conferencia(p_id uuid, p_responsavel uuid, p_prazo date default null) returns json
  language plpgsql security definer
  set search_path to ''
as $$
declare
  v_aviso public."TB_AVISO_CONFERENCIA";
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  v_aviso := private."FC_AVISO_PARA_AGIR"(p_id, true);
  if p_prazo is not null and p_responsavel is null then
    raise exception 'Prazo só com responsável' using errcode = '22023';
  end if;
  if p_prazo is not null and p_prazo < v_hoje and p_prazo is distinct from v_aviso."DT_PRAZO" then
    raise exception 'O prazo não pode ser antes de hoje' using errcode = '22023';
  end if;
  if p_prazo > v_hoje + 365 then
    raise exception 'Prazo de até um ano' using errcode = '22023';
  end if;
  if p_responsavel is not null and not private."FC_PODE_SER_RESPONSAVEL_AVISO"(p_responsavel, v_aviso."CO_MODULO") then
    raise exception 'O responsável precisa ter acesso ao módulo do aviso' using errcode = '22023';
  end if;
  if p_responsavel is not distinct from v_aviso."CO_USUARIO_RESPONSAVEL" and p_prazo is not distinct from v_aviso."DT_PRAZO" then
    return json_build_object('id', p_id, 'inalterado', true);
  end if;

  update public."TB_AVISO_CONFERENCIA" set "CO_USUARIO_RESPONSAVEL" = p_responsavel, "DT_PRAZO" = p_prazo
   where "CO_AVISO_CONFERENCIA" = p_id;
  insert into public."TH_AVISO_CONFERENCIA" (
    "CO_AVISO_CONFERENCIA", "TP_EVENTO", "TP_TRATAMENTO_ANTERIOR", "TP_TRATAMENTO", "TP_SITUACAO", "QT_OCORRENCIA",
    "CO_USUARIO_RESPONSAVEL", "DT_PRAZO", "CO_USUARIO")
  values (p_id, 'RESPONSAVEL', v_aviso."TP_TRATAMENTO", v_aviso."TP_TRATAMENTO", 'ABERTO', v_aviso."QT_OCORRENCIA",
          p_responsavel, p_prazo, auth.uid());

  return json_build_object('id', p_id, 'responsavel_id', p_responsavel,
                           'responsavel', private."FC_NOME_DO_USUARIO"(p_responsavel), 'prazo', p_prazo);
end;
$$;
comment on function public.atribuir_aviso_conferencia(uuid, uuid, date) is 'Põe (ou tira, com nulo) o responsável e o prazo de um aviso aberto (20261118120000): só o gestor do módulo ou o administrador global; o responsável é um perfil ativo com acesso ao módulo (FC_PODE_SER_RESPONSAVEL_AVISO); prazo só com responsável, de hoje a um ano. Grava o histórico.';
revoke all on function public.atribuir_aviso_conferencia(uuid, uuid, date) from public;
grant execute on function public.atribuir_aviso_conferencia(uuid, uuid, date) to authenticated;

create function public.listar_responsaveis_aviso_conferencia(p_id uuid) returns json
  language plpgsql stable security definer
  set search_path to ''
as $$
declare
  v_aviso public."TB_AVISO_CONFERENCIA";
begin
  if auth.uid() is null then
    raise exception 'Sessão necessária' using errcode = '42501';
  end if;
  select * into v_aviso from public."TB_AVISO_CONFERENCIA" a where a."CO_AVISO_CONFERENCIA" = p_id;
  if v_aviso."CO_AVISO_CONFERENCIA" is null
     or not private."FC_PODE_VER_AVISO"(v_aviso."CO_MODULO", v_aviso."CO_AREA", v_aviso."CO_MONITORAMENTO") then
    raise exception 'Aviso não encontrado' using errcode = '22023';
  end if;
  if not private."FC_PODE_IGNORAR_AVISO"(v_aviso."CO_MODULO", v_aviso."CO_AREA", v_aviso."CO_MONITORAMENTO") then
    raise exception 'Só o gestor do módulo ou o administrador global atribui o aviso' using errcode = '42501';
  end if;
  return (
    select coalesce(json_agg(json_build_object('id', x.user_id, 'nome', x.nome) order by lower(x.nome)), '[]'::json)
      from (select distinct on (p.user_id) p.user_id, coalesce(nullif(btrim(p.nome), ''), p.email) as nome
              from public."TB_PERFIL_USUARIO" p
             where p.user_id is not null and p.ativo is true
               and private."FC_PODE_SER_RESPONSAVEL_AVISO"(p.user_id, v_aviso."CO_MODULO")
             order by p.user_id) x
  );
end;
$$;
comment on function public.listar_responsaveis_aviso_conferencia(uuid) is 'Quem pode ser responsável por um aviso (20261118120000): perfis ativos com acesso ao módulo, com id (auth.users.id) e nome. Só o gestor do módulo ou o administrador global.';
revoke all on function public.listar_responsaveis_aviso_conferencia(uuid) from public;
grant execute on function public.listar_responsaveis_aviso_conferencia(uuid) to authenticated;

create function public.incluir_evidencia_aviso_conferencia(
  p_id uuid, p_tipo text, p_descricao text, p_url text default null, p_chave_caso text default null) returns json
  language plpgsql security definer
  set search_path to ''
as $$
declare
  v_aviso public."TB_AVISO_CONFERENCIA";
  v_tipo text := upper(btrim(coalesce(p_tipo, '')));
  v_descricao text := btrim(coalesce(p_descricao, ''));
  v_url text := nullif(btrim(coalesce(p_url, '')), '');
  v_chave text := nullif(btrim(coalesce(p_chave_caso, '')), '');
  v_id uuid;
begin
  v_aviso := private."FC_AVISO_PARA_AGIR"(p_id, false);
  if v_tipo not in ('SEI', 'LINK', 'NOTA') then
    raise exception 'Tipo de evidência inválido' using errcode = '22023';
  end if;
  if length(v_descricao) not between 3 and 500 or not private."FC_TEXTO_SEGURO_DO_AVISO"(v_descricao) then
    raise exception 'Descreva a evidência (3 a 500 caracteres, sem CPF nem e-mail)' using errcode = '22023';
  end if;
  if v_tipo = 'LINK' and v_url is null then
    raise exception 'Informe o link' using errcode = '22023';
  end if;
  if v_url is not null and (v_url !~ '^https://[^\s]+$' or length(v_url) > 500) then
    raise exception 'O link precisa começar com https://' using errcode = '22023';
  end if;
  if v_chave is not null and (
       v_chave !~ '^(analise|codigo|referencia):[A-Za-z0-9._:/-]{1,90}$'
       or not exists (
         select 1 from public."TB_CASO_AVISO_CONFERENCIA" k
          where k."CO_AVISO_CONFERENCIA" = p_id
            and case split_part(v_chave, ':', 1)
                  when 'analise' then k."CO_ANALISE_CURRICULAR"::text = substr(v_chave, 9)
                  when 'codigo' then k."CO_CANDIDATO_EMPREGARE" = substr(v_chave, 8)
                  else k."DS_REFERENCIA" = substr(v_chave, 12) end)) then
    raise exception 'Caso não encontrado no aviso' using errcode = '22023';
  end if;

  insert into public."TB_EVIDENCIA_AVISO_CONFERENCIA" (
    "CO_AVISO_CONFERENCIA", "DS_CHAVE_CASO", "TP_EVIDENCIA", "DS_EVIDENCIA", "DS_URL", "CO_USUARIO")
  values (p_id, v_chave, v_tipo, v_descricao, v_url, auth.uid())
  returning "CO_EVIDENCIA_AVISO" into v_id;
  insert into public."TH_AVISO_CONFERENCIA" (
    "CO_AVISO_CONFERENCIA", "TP_EVENTO", "TP_TRATAMENTO_ANTERIOR", "TP_TRATAMENTO", "TP_SITUACAO", "QT_OCORRENCIA",
    "CO_EVIDENCIA_AVISO", "CO_USUARIO")
  values (p_id, 'EVIDENCIA_INCLUIDA', v_aviso."TP_TRATAMENTO", v_aviso."TP_TRATAMENTO", 'ABERTO', v_aviso."QT_OCORRENCIA",
          v_id, auth.uid());
  return json_build_object('id', v_id);
end;
$$;
comment on function public.incluir_evidencia_aviso_conferencia(uuid, text, text, text, text) is 'Junta uma evidência a um aviso aberto (20261118120000): SEI, LINK (https obrigatório) ou NOTA, com descrição de 3 a 500 sem CPF nem e-mail, do aviso ou de um caso dele (analise:, codigo: ou referencia:). O gestor do módulo ou o responsável. Grava o histórico.';
revoke all on function public.incluir_evidencia_aviso_conferencia(uuid, text, text, text, text) from public;
grant execute on function public.incluir_evidencia_aviso_conferencia(uuid, text, text, text, text) to authenticated;

create function public.retirar_evidencia_aviso_conferencia(p_evidencia uuid, p_motivo text) returns json
  language plpgsql security definer
  set search_path to ''
as $$
declare
  v_evidencia public."TB_EVIDENCIA_AVISO_CONFERENCIA";
  v_aviso public."TB_AVISO_CONFERENCIA";
  v_motivo text := btrim(coalesce(p_motivo, ''));
begin
  if auth.uid() is null then
    raise exception 'Sessão necessária' using errcode = '42501';
  end if;
  select * into v_evidencia from public."TB_EVIDENCIA_AVISO_CONFERENCIA" e
   where e."CO_EVIDENCIA_AVISO" = p_evidencia and e."ST_REGISTRO_ATIVO" = 'S';
  if v_evidencia."CO_EVIDENCIA_AVISO" is null then
    raise exception 'Evidência não encontrada' using errcode = '22023';
  end if;
  v_aviso := private."FC_AVISO_PARA_AGIR"(v_evidencia."CO_AVISO_CONFERENCIA", false);
  if length(v_motivo) not between 3 and 500 or not private."FC_TEXTO_SEGURO_DO_AVISO"(v_motivo) then
    raise exception 'Escreva o motivo (3 a 500 caracteres, sem CPF nem e-mail)' using errcode = '22023';
  end if;

  update public."TB_EVIDENCIA_AVISO_CONFERENCIA" set
    "ST_REGISTRO_ATIVO" = 'N', "CO_USUARIO_RETIRADA" = auth.uid(), "DT_RETIRADA" = now()
   where "CO_EVIDENCIA_AVISO" = p_evidencia;
  insert into public."TH_AVISO_CONFERENCIA" (
    "CO_AVISO_CONFERENCIA", "TP_EVENTO", "TP_TRATAMENTO_ANTERIOR", "TP_TRATAMENTO", "TP_SITUACAO", "QT_OCORRENCIA",
    "DS_MOTIVO", "CO_EVIDENCIA_AVISO", "CO_USUARIO")
  values (v_aviso."CO_AVISO_CONFERENCIA", 'EVIDENCIA_RETIRADA', v_aviso."TP_TRATAMENTO", v_aviso."TP_TRATAMENTO", 'ABERTO',
          v_aviso."QT_OCORRENCIA", v_motivo, p_evidencia, auth.uid());
  return json_build_object('id', p_evidencia, 'retirada', true);
end;
$$;
comment on function public.retirar_evidencia_aviso_conferencia(uuid, text) is 'Retira (exclusão lógica) uma evidência de um aviso aberto, com motivo de 3 a 500 (20261118120000). O gestor do módulo ou o responsável. Grava o histórico.';
revoke all on function public.retirar_evidencia_aviso_conferencia(uuid, text) from public;
grant execute on function public.retirar_evidencia_aviso_conferencia(uuid, text) to authenticated;

create function public.listar_historico_aviso_conferencia(p_id uuid) returns json
  language plpgsql stable security definer
  set search_path to ''
as $$
declare
  v_aviso public."TB_AVISO_CONFERENCIA";
begin
  if auth.uid() is null then
    raise exception 'Sessão necessária' using errcode = '42501';
  end if;
  select * into v_aviso from public."TB_AVISO_CONFERENCIA" a where a."CO_AVISO_CONFERENCIA" = p_id;
  if v_aviso."CO_AVISO_CONFERENCIA" is null
     or not private."FC_PODE_VER_AVISO"(v_aviso."CO_MODULO", v_aviso."CO_AREA", v_aviso."CO_MONITORAMENTO") then
    raise exception 'Aviso não encontrado' using errcode = '22023';
  end if;
  return json_build_object(
    'schema_version', 1,
    'eventos', (
      select coalesce(json_agg(json_build_object(
          'id', h."CO_EVENTO", 'evento', h."TP_EVENTO",
          'tratamento_anterior', h."TP_TRATAMENTO_ANTERIOR", 'tratamento', h."TP_TRATAMENTO",
          'situacao', h."TP_SITUACAO", 'quantidade', h."QT_OCORRENCIA", 'motivo', h."DS_MOTIVO",
          'responsavel', private."FC_NOME_DO_USUARIO"(h."CO_USUARIO_RESPONSAVEL"), 'prazo', h."DT_PRAZO",
          'evidencia', h."CO_EVIDENCIA_AVISO",
          'por', case when h."CO_USUARIO" is null then null else private."FC_NOME_DO_USUARIO"(h."CO_USUARIO") end,
          'robo', h."CO_EXECUCAO" is not null,
          'em', h."DT_EVENTO") order by h."CO_EVENTO" desc), '[]'::json)
        from public."TH_AVISO_CONFERENCIA" h
       where h."CO_AVISO_CONFERENCIA" = p_id
    ),
    'evidencias', (
      select coalesce(json_agg(json_build_object(
          'id', e."CO_EVIDENCIA_AVISO", 'tipo', e."TP_EVIDENCIA", 'descricao', e."DS_EVIDENCIA", 'url', e."DS_URL",
          'caso', e."DS_CHAVE_CASO", 'ativa', e."ST_REGISTRO_ATIVO" = 'S',
          'por', private."FC_NOME_DO_USUARIO"(e."CO_USUARIO"), 'em', e."DT_CRIACAO",
          'retirada_em', e."DT_RETIRADA") order by e."DT_CRIACAO" desc), '[]'::json)
        from public."TB_EVIDENCIA_AVISO_CONFERENCIA" e
       where e."CO_AVISO_CONFERENCIA" = p_id
    )
  );
end;
$$;
comment on function public.listar_historico_aviso_conferencia(uuid) is 'O histórico de um aviso de conferência (20261118120000): os eventos (achado, reaberto, tratamento, responsável e prazo, evidência, rechecagem), do mais novo ao mais velho, com motivo, quem (ou a conferência) e quando, e as evidências (ativas e retiradas). Quem vê o aviso.';
revoke all on function public.listar_historico_aviso_conferencia(uuid) from public;
grant execute on function public.listar_historico_aviso_conferencia(uuid) to authenticated;


comment on column public."TB_AVISO_CONFERENCIA"."TP_SITUACAO" is 'O que a conferência acha: ABERTO (achado na última execução) ou RESOLVIDO (não achado). O que a equipe fez fica em TP_TRATAMENTO (20261118120000; o antigo IGNORADO virou DISPENSADO).';
comment on column public."TB_AVISO_CONFERENCIA"."TP_TRATAMENTO" is 'O que a equipe fez: PENDENTE, EM_ANALISE, AGUARDANDO_DOCUMENTO, CORRIGIDO, DISPENSADO (com justificativa) e RECHECADO_SEM_PROBLEMA (só o robô põe, quando deixa de achar). Histórico em TH_AVISO_CONFERENCIA.';
comment on column public."TB_AVISO_CONFERENCIA"."CO_USUARIO_TRATAMENTO" is 'Quem pôs o tratamento atual (auth.users.id); nulo quando foi a conferência.';
comment on column public."TB_AVISO_CONFERENCIA"."DT_TRATAMENTO" is 'Quando o tratamento atual foi posto.';
comment on column public."TB_AVISO_CONFERENCIA"."QT_OCORRENCIA_DISPENSADA" is 'Quantidade quando foi dispensado: o aviso volta a PENDENTE se a conferência achar mais que isso.';
comment on column public."TB_AVISO_CONFERENCIA"."CO_USUARIO_RESPONSAVEL" is 'Quem cuida do aviso (auth.users.id; perfil ativo com acesso ao módulo). Também pode tratar e juntar evidência.';
comment on column public."TB_AVISO_CONFERENCIA"."DT_PRAZO" is 'Prazo para o responsável (data de Brasília); vencido só destaca na tela.';
comment on constraint "CK_AVISOCONF_TPSITUACAO" on public."TB_AVISO_CONFERENCIA" is 'ABERTO ou RESOLVIDO (20261118120000).';
comment on constraint "CK_AVISOCONF_TPTRATAMENTO" on public."TB_AVISO_CONFERENCIA" is 'Tratamentos da equipe e o RECHECADO_SEM_PROBLEMA do robô.';
comment on constraint "CK_AVISOCONF_QTDISPENSADA" on public."TB_AVISO_CONFERENCIA" is 'Só o dispensado guarda a quantidade dispensada (1 ou mais).';
comment on constraint "CK_AVISOCONF_DTPRAZO" on public."TB_AVISO_CONFERENCIA" is 'Prazo só com responsável.';
comment on constraint "CK_AVISOCONF_QT" on public."TB_AVISO_CONFERENCIA" is 'Pelo menos um caso.';
comment on index public."IN_AVISOCONF_VIGENTE" is 'Avisos abertos por módulo e área (tela e selos).';
comment on index public."IN_AVISOCONF_COUSURESP" is 'Avisos de cada responsável.';

comment on table public."TH_AVISO_CONFERENCIA" is 'Histórico de cada aviso de conferência (20261118120000): o que a conferência achou ou deixou de achar e o que a equipe fez (tratamento, responsável, prazo, evidência), com motivo, quem (ou a execução) e quando. Só cresce; RLS sem policy (só as RPCs).';
comment on column public."TH_AVISO_CONFERENCIA"."CO_EVENTO" is 'Identificador do evento (identity, em ordem).';
comment on column public."TH_AVISO_CONFERENCIA"."CO_AVISO_CONFERENCIA" is 'Aviso (TB_AVISO_CONFERENCIA).';
comment on column public."TH_AVISO_CONFERENCIA"."TP_EVENTO" is 'ACHADO, REABERTO, TRATAMENTO, RESPONSAVEL, EVIDENCIA_INCLUIDA, EVIDENCIA_RETIRADA, RECHECADO_COM_PROBLEMA, NAO_ACHADO ou MIGRADO (o IGNORADO de antes).';
comment on column public."TH_AVISO_CONFERENCIA"."TP_TRATAMENTO_ANTERIOR" is 'Tratamento antes do evento.';
comment on column public."TH_AVISO_CONFERENCIA"."TP_TRATAMENTO" is 'Tratamento depois do evento.';
comment on column public."TH_AVISO_CONFERENCIA"."TP_SITUACAO" is 'Situação do aviso depois do evento (ABERTO ou RESOLVIDO).';
comment on column public."TH_AVISO_CONFERENCIA"."QT_OCORRENCIA" is 'Quantidade de casos no evento.';
comment on column public."TH_AVISO_CONFERENCIA"."DS_MOTIVO" is 'Motivo, justificativa ou explicação do evento (3 a 500 caracteres, sem CPF nem e-mail).';
comment on column public."TH_AVISO_CONFERENCIA"."CO_USUARIO_RESPONSAVEL" is 'Responsável depois do evento RESPONSAVEL.';
comment on column public."TH_AVISO_CONFERENCIA"."DT_PRAZO" is 'Prazo depois do evento RESPONSAVEL.';
comment on column public."TH_AVISO_CONFERENCIA"."CO_EVIDENCIA_AVISO" is 'Evidência incluída ou retirada (TB_EVIDENCIA_AVISO_CONFERENCIA).';
comment on column public."TH_AVISO_CONFERENCIA"."CO_USUARIO" is 'Quem fez (auth.users.id); nulo quando foi a conferência.';
comment on column public."TH_AVISO_CONFERENCIA"."CO_EXECUCAO" is 'Execução da conferência (TL_CONFERENCIA) que fez, quando foi o robô.';
comment on column public."TH_AVISO_CONFERENCIA"."DT_EVENTO" is 'Quando.';
comment on constraint "CK_HISTAVISOCONF_TPEVENTO" on public."TH_AVISO_CONFERENCIA" is 'Eventos conhecidos.';
comment on constraint "CK_HISTAVISOCONF_TPTRATAMENTO" on public."TH_AVISO_CONFERENCIA" is 'Tratamentos conhecidos (os mesmos de TB_AVISO_CONFERENCIA).';
comment on constraint "CK_HISTAVISOCONF_TPSITUACAO" on public."TH_AVISO_CONFERENCIA" is 'ABERTO ou RESOLVIDO.';
comment on constraint "CK_HISTAVISOCONF_DSMOTIVO" on public."TH_AVISO_CONFERENCIA" is 'Motivo de 3 a 500 caracteres.';
comment on index public."IN_FKHISTAVISOCONF_COAVISO" is 'Chave estrangeira para TB_AVISO_CONFERENCIA, na ordem dos eventos.';

comment on table public."TB_EVIDENCIA_AVISO_CONFERENCIA" is 'Evidências de um aviso de conferência (20261118120000): processo SEI, link (https) ou nota, do aviso ou de um caso (pela chave estável do caso). Retirar é lógico; RLS sem policy (só as RPCs).';
comment on column public."TB_EVIDENCIA_AVISO_CONFERENCIA"."CO_EVIDENCIA_AVISO" is 'Identificador da evidência.';
comment on column public."TB_EVIDENCIA_AVISO_CONFERENCIA"."CO_AVISO_CONFERENCIA" is 'Aviso (TB_AVISO_CONFERENCIA).';
comment on column public."TB_EVIDENCIA_AVISO_CONFERENCIA"."DS_CHAVE_CASO" is 'Caso do aviso: analise:<id>, codigo:<código> ou referencia:<id> (o NU_CASO muda a cada execução). Nulo = o aviso todo.';
comment on column public."TB_EVIDENCIA_AVISO_CONFERENCIA"."TP_EVIDENCIA" is 'SEI (número do processo), LINK (documento por link) ou NOTA (texto).';
comment on column public."TB_EVIDENCIA_AVISO_CONFERENCIA"."DS_EVIDENCIA" is 'O número do SEI, a descrição do link ou a nota (3 a 500 caracteres, sem CPF nem e-mail).';
comment on column public."TB_EVIDENCIA_AVISO_CONFERENCIA"."DS_URL" is 'Link https do documento (opcional no SEI e na nota).';
comment on column public."TB_EVIDENCIA_AVISO_CONFERENCIA"."ST_REGISTRO_ATIVO" is 'S ativa; N retirada.';
comment on column public."TB_EVIDENCIA_AVISO_CONFERENCIA"."CO_USUARIO" is 'Quem incluiu (auth.users.id).';
comment on column public."TB_EVIDENCIA_AVISO_CONFERENCIA"."DT_CRIACAO" is 'Quando foi incluída.';
comment on column public."TB_EVIDENCIA_AVISO_CONFERENCIA"."CO_USUARIO_RETIRADA" is 'Quem retirou.';
comment on column public."TB_EVIDENCIA_AVISO_CONFERENCIA"."DT_RETIRADA" is 'Quando foi retirada.';
comment on constraint "CK_EVIDAVISOCONF_TPEVIDENCIA" on public."TB_EVIDENCIA_AVISO_CONFERENCIA" is 'SEI, LINK ou NOTA.';
comment on constraint "CK_EVIDAVISOCONF_DSCHAVECASO" on public."TB_EVIDENCIA_AVISO_CONFERENCIA" is 'Chave do caso: tipo e identificador.';
comment on constraint "CK_EVIDAVISOCONF_DSEVIDENCIA" on public."TB_EVIDENCIA_AVISO_CONFERENCIA" is 'Texto de 3 a 500 caracteres.';
comment on constraint "CK_EVIDAVISOCONF_DSURL" on public."TB_EVIDENCIA_AVISO_CONFERENCIA" is 'Só link https.';
comment on constraint "CK_EVIDAVISOCONF_STREGATIVO" on public."TB_EVIDENCIA_AVISO_CONFERENCIA" is 'S ou N.';
comment on constraint "CK_EVIDAVISOCONF_RETIRADA" on public."TB_EVIDENCIA_AVISO_CONFERENCIA" is 'Retirada com quem e quando.';
comment on index public."IN_FKEVIDAVISOCONF_COAVISO" is 'Chave estrangeira para TB_AVISO_CONFERENCIA (evidências ativas).';

-- 7. A marca da lista dos avisos conta o histórico e as evidências.
select private."FC_ATUALIZAR_FONTES_DAS_LEITURAS"();


do $$
declare
  v_ignorados integer := (select count(*) from ensaio_antes where situacao = 'IGNORADO');
  v_dispensados integer;
begin
  select count(*) into v_dispensados from public."TB_AVISO_CONFERENCIA" a
    join ensaio_antes e on e.id = a."CO_AVISO_CONFERENCIA"
   where e.situacao = 'IGNORADO' and a."TP_SITUACAO" = 'ABERTO' and a."TP_TRATAMENTO" = 'DISPENSADO'
     and a."QT_OCORRENCIA_DISPENSADA" = e.qt_ignorada;
  if v_dispensados <> v_ignorados then
    raise exception 'Ignorados % viraram % dispensados', v_ignorados, v_dispensados;
  end if;
  if (select count(*) from public."TH_AVISO_CONFERENCIA" h join ensaio_antes e on e.id = h."CO_AVISO_CONFERENCIA"
       where h."TP_EVENTO" = 'MIGRADO' and h."DS_MOTIVO" = left(btrim(e.motivo), 500)) <> v_ignorados then
    raise exception 'O motivo dos ignorados não foi para o histórico';
  end if;
  if not exists (select 1 from private."TD_FONTE_DA_LEITURA" f
                  where f."NO_LEITURA" = 'avisos_conferencia' and f."NO_FONTE" = 'public.TH_AVISO_CONFERENCIA')
     or not exists (select 1 from private."TD_FONTE_DA_LEITURA" f
                  where f."NO_LEITURA" = 'avisos_conferencia' and f."NO_FONTE" = 'public.TB_EVIDENCIA_AVISO_CONFERENCIA') then
    raise exception 'A marca dos avisos não conta o histórico e as evidências: %',
      (select string_agg(f."NO_FONTE", ', ') from private."TD_FONTE_DA_LEITURA" f where f."NO_LEITURA" = 'avisos_conferencia');
  end if;
  raise notice 'Avisos: % (abertos %, resolvidos %); ignorados migrados para dispensados: %',
    (select count(*) from public."TB_AVISO_CONFERENCIA"),
    (select count(*) from public."TB_AVISO_CONFERENCIA" where "TP_SITUACAO" = 'ABERTO'),
    (select count(*) from public."TB_AVISO_CONFERENCIA" where "TP_SITUACAO" = 'RESOLVIDO'), v_dispensados;
end;
$$;

-- Um ciclo da conferência num aviso aberto qualquer, como a execução faria (sem sessão).
do $$
declare
  v_aviso public."TB_AVISO_CONFERENCIA";
  v_exec text := 'ensaio_central_' || to_char(now(), 'YYYYMMDDHH24MISS');
begin
  select * into v_aviso from public."TB_AVISO_CONFERENCIA" a where a."TP_SITUACAO" = 'ABERTO'
   order by a."DT_ULTIMA_VEZ" desc limit 1;
  if v_aviso."CO_AVISO_CONFERENCIA" is null then
    raise notice 'Sem aviso aberto: ciclo pulado';
    return;
  end if;
  -- Marcado como corrigido antes da execução; a execução ainda acha → volta para em análise.
  update public."TB_AVISO_CONFERENCIA" set "TP_TRATAMENTO" = 'CORRIGIDO', "DT_TRATAMENTO" = now() - interval '1 day',
         "QT_OCORRENCIA_DISPENSADA" = null
   where "CO_AVISO_CONFERENCIA" = v_aviso."CO_AVISO_CONFERENCIA";
  insert into public."TL_CONFERENCIA" ("CO_EXECUCAO", "TP_DISPARO") values (v_exec, 'GITHUB');
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  perform public.gravar_avisos_conferencia(v_exec, jsonb_build_array(jsonb_build_object(
    'conferencia', v_aviso."CO_CONFERENCIA", 'escopo', v_aviso."DS_ESCOPO", 'gravidade', v_aviso."TP_GRAVIDADE",
    'modulo', v_aviso."CO_MODULO", 'area', v_aviso."CO_AREA", 'edital', v_aviso."CO_MONITORAMENTO",
    'quantidade', v_aviso."QT_OCORRENCIA", 'exemplos', v_aviso."DS_EXEMPLO", 'resumo', v_aviso."DS_RESUMO")));
  if (select "TP_TRATAMENTO" from public."TB_AVISO_CONFERENCIA" where "CO_AVISO_CONFERENCIA" = v_aviso."CO_AVISO_CONFERENCIA")
     <> 'EM_ANALISE' then
    raise exception 'Corrigido e achado de novo não voltou para em análise';
  end if;
  -- A execução seguinte (a mesma conferência) não acha → resolvido como rechecado, com histórico.
  update public."TB_AVISO_CONFERENCIA" set "CO_EXECUCAO" = v_exec where "CO_AVISO_CONFERENCIA" = v_aviso."CO_AVISO_CONFERENCIA";
  insert into public."TL_CONFERENCIA" ("CO_EXECUCAO", "TP_DISPARO") values (v_exec || '_2', 'GITHUB');
  perform public.finalizar_conferencia(v_exec || '_2', array[v_aviso."CO_CONFERENCIA"], '{}', null);
  if (select "TP_SITUACAO" || '/' || "TP_TRATAMENTO" from public."TB_AVISO_CONFERENCIA"
       where "CO_AVISO_CONFERENCIA" = v_aviso."CO_AVISO_CONFERENCIA") <> 'RESOLVIDO/RECHECADO_SEM_PROBLEMA' then
    raise exception 'Não achado não ficou resolvido e rechecado';
  end if;
  raise notice 'Ciclo ok: %', (select string_agg(h."TP_EVENTO" || ':' || coalesce(h."TP_TRATAMENTO", ''), ' → ' order by h."CO_EVENTO")
                                 from public."TH_AVISO_CONFERENCIA" h where h."CO_AVISO_CONFERENCIA" = v_aviso."CO_AVISO_CONFERENCIA");
end;
$$;


do $$
begin
  if to_regclass('public."TH_AVISO_CONFERENCIA"') is null then
    raise exception 'Não aplicada: TH_AVISO_CONFERENCIA não existe.';
  end if;
  if md5(replace((select prosrc from pg_proc where oid = to_regprocedure('public.gravar_avisos_conferencia(text, jsonb)')), chr(13), ''))
       is distinct from '6443f23fc74d5b9ae033f219ccae3561'
     or md5(replace((select prosrc from pg_proc where oid = to_regprocedure('public.finalizar_conferencia(text, text[], text[], text)')), chr(13), ''))
       is distinct from '7ed3333263b3c4028251ab02cdc6ee6a'
     or md5(replace((select prosrc from pg_proc where oid = to_regprocedure('private."FC_FECHAR_CASOS_DO_AVISO"(text, uuid[])')), chr(13), ''))
       is distinct from 'cf63d45d133a1bcbc8f4d920d1173980'
     or md5(replace((select prosrc from pg_proc where oid = to_regprocedure('public.listar_avisos_conferencia(text, text)')), chr(13), ''))
       is distinct from '0e9933193d1167d55c94116854cedaec'
     or md5(replace((select prosrc from pg_proc where oid = to_regprocedure('public.listar_casos_aviso_conferencia(uuid, text, text, text, integer, integer)')), chr(13), ''))
       is distinct from 'e21ee015e3b00dfad0c8dee4027ec194' then
    raise exception 'As funções dos avisos não estão com o corpo de 20261118120000_central_de_avisos_das_conferencias: junte as mudanças antes.';
  end if;
end;
$$;

drop function public.listar_historico_aviso_conferencia(uuid);
drop function public.retirar_evidencia_aviso_conferencia(uuid, text);
drop function public.incluir_evidencia_aviso_conferencia(uuid, text, text, text, text);
drop function public.listar_responsaveis_aviso_conferencia(uuid);
drop function public.atribuir_aviso_conferencia(uuid, uuid, date);
drop function public.tratar_aviso_conferencia(uuid, text, text);
drop function private."FC_AVISO_PARA_AGIR"(uuid, boolean);
drop function private."FC_PODE_SER_RESPONSAVEL_AVISO"(uuid, text);

alter table public."TB_AVISO_CONFERENCIA"
  add column "CO_USUARIO_IGNORADO" uuid,
  add column "DT_IGNORADO" timestamp with time zone,
  add column "DS_MOTIVO_IGNORADO" character varying(500),
  add column "QT_OCORRENCIA_IGNORADA" integer;
alter table public."TB_AVISO_CONFERENCIA" drop constraint "CK_AVISOCONF_TPSITUACAO";

-- O dispensado aberto volta a IGNORADO, com o último motivo de dispensa (ou da migração).
update public."TB_AVISO_CONFERENCIA" a set
  "TP_SITUACAO" = 'IGNORADO',
  "CO_USUARIO_IGNORADO" = coalesce(a."CO_USUARIO_TRATAMENTO", h."CO_USUARIO", '00000000-0000-0000-0000-000000000000'),
  "DT_IGNORADO" = coalesce(a."DT_TRATAMENTO", h."DT_EVENTO", now()),
  "DS_MOTIVO_IGNORADO" = coalesce(h."DS_MOTIVO", 'Dispensado na central de avisos'),
  "QT_OCORRENCIA_IGNORADA" = a."QT_OCORRENCIA_DISPENSADA"
  from (select distinct on (x."CO_AVISO_CONFERENCIA") x.*
          from public."TH_AVISO_CONFERENCIA" x
         where (x."TP_EVENTO" = 'TRATAMENTO' and x."TP_TRATAMENTO" = 'DISPENSADO') or x."TP_EVENTO" = 'MIGRADO'
         order by x."CO_AVISO_CONFERENCIA", x."CO_EVENTO" desc) h
 where a."TP_SITUACAO" = 'ABERTO' and a."TP_TRATAMENTO" = 'DISPENSADO'
   and h."CO_AVISO_CONFERENCIA" = a."CO_AVISO_CONFERENCIA";
update public."TB_AVISO_CONFERENCIA" a set
  "TP_SITUACAO" = 'IGNORADO', "CO_USUARIO_IGNORADO" = coalesce(a."CO_USUARIO_TRATAMENTO", '00000000-0000-0000-0000-000000000000'),
  "DT_IGNORADO" = coalesce(a."DT_TRATAMENTO", now()), "DS_MOTIVO_IGNORADO" = 'Dispensado na central de avisos',
  "QT_OCORRENCIA_IGNORADA" = a."QT_OCORRENCIA_DISPENSADA"
 where a."TP_SITUACAO" = 'ABERTO' and a."TP_TRATAMENTO" = 'DISPENSADO';

drop index public."IN_AVISOCONF_COUSURESP";
drop index public."IN_AVISOCONF_VIGENTE";
drop table public."TB_EVIDENCIA_AVISO_CONFERENCIA";
drop table public."TH_AVISO_CONFERENCIA";
alter table public."TB_AVISO_CONFERENCIA" drop constraint "CK_AVISOCONF_QT";
alter table public."TB_AVISO_CONFERENCIA"
  drop column "TP_TRATAMENTO",
  drop column "CO_USUARIO_TRATAMENTO",
  drop column "DT_TRATAMENTO",
  drop column "QT_OCORRENCIA_DISPENSADA",
  drop column "CO_USUARIO_RESPONSAVEL",
  drop column "DT_PRAZO",
  add constraint "CK_AVISOCONF_IGNORADO" CHECK ((((("TP_SITUACAO")::text = 'IGNORADO'::text) = ("CO_USUARIO_IGNORADO" IS NOT NULL)) AND (("CO_USUARIO_IGNORADO" IS NULL) = ("DT_IGNORADO" IS NULL)) AND (("CO_USUARIO_IGNORADO" IS NULL) = ("DS_MOTIVO_IGNORADO" IS NULL)) AND (("CO_USUARIO_IGNORADO" IS NULL) = ("QT_OCORRENCIA_IGNORADA" IS NULL)))),
  add constraint "CK_AVISOCONF_QT" CHECK ((("QT_OCORRENCIA" >= 1) AND (COALESCE("QT_OCORRENCIA_IGNORADA", 1) >= 1))),
  add constraint "CK_AVISOCONF_TPSITUACAO" CHECK ((("TP_SITUACAO")::text = ANY (ARRAY[('ABERTO'::character varying)::text, ('RESOLVIDO'::character varying)::text, ('IGNORADO'::character varying)::text])));
CREATE INDEX "IN_AVISOCONF_VIGENTE" ON public."TB_AVISO_CONFERENCIA" USING btree ("CO_MODULO", "CO_AREA") WHERE (("TP_SITUACAO")::text = ANY (ARRAY[('ABERTO'::character varying)::text, ('IGNORADO'::character varying)::text]));

COMMENT ON COLUMN public."TB_AVISO_CONFERENCIA"."TP_SITUACAO" IS 'ABERTO; RESOLVIDO (a conferência rodou e não achou mais); IGNORADO (com motivo; volta a ABERTO se a quantidade crescer).';
COMMENT ON COLUMN public."TB_AVISO_CONFERENCIA"."CO_USUARIO_IGNORADO" IS 'Quem ignorou (auth.users.id); só IGNORADO.';
COMMENT ON COLUMN public."TB_AVISO_CONFERENCIA"."DT_IGNORADO" IS 'Quando ignorou.';
COMMENT ON COLUMN public."TB_AVISO_CONFERENCIA"."DS_MOTIVO_IGNORADO" IS 'Motivo informado ao ignorar (10 a 500 caracteres).';
COMMENT ON COLUMN public."TB_AVISO_CONFERENCIA"."QT_OCORRENCIA_IGNORADA" IS 'Quantidade no momento em que foi ignorado: se crescer, o aviso volta a ABERTO.';
COMMENT ON CONSTRAINT "CK_AVISOCONF_IGNORADO" ON public."TB_AVISO_CONFERENCIA" IS 'Quem, quando, motivo e quantidade só (e sempre) no aviso ignorado.';
COMMENT ON CONSTRAINT "CK_AVISOCONF_QT" ON public."TB_AVISO_CONFERENCIA" IS 'Quantidades positivas.';
COMMENT ON CONSTRAINT "CK_AVISOCONF_TPSITUACAO" ON public."TB_AVISO_CONFERENCIA" IS 'Situações válidas.';
COMMENT ON INDEX public."IN_AVISOCONF_VIGENTE" IS 'Avisos abertos e ignorados por módulo e área (tela e selos).';

CREATE OR REPLACE FUNCTION public.gravar_avisos_conferencia(p_execucao text, p_avisos jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare
  v_aviso jsonb;
  v_atual public."TB_AVISO_CONFERENCIA";
  v_id uuid;
  v_conferencia text;
  v_escopo text;
  v_gravidade text;
  v_modulo text;
  v_area text;
  v_edital uuid;
  v_qt integer;
  v_exemplos jsonb;
  v_casos jsonb;
  v_resumo text;
  v_novos integer := 0;
  v_reabertos integer := 0;
  v_mantidos integer := 0;
begin
  perform private."FC_EXIGIR_EXECUCAO_CONFERENCIA"(p_execucao);
  if jsonb_typeof(p_avisos) is distinct from 'array' or jsonb_array_length(p_avisos) > 1000 then
    raise exception 'Envie até 1000 avisos por chamada, em lista' using errcode = '22023';
  end if;

  for v_aviso in select x from jsonb_array_elements(p_avisos) x loop
    v_conferencia := v_aviso ->> 'conferencia';
    v_escopo := v_aviso ->> 'escopo';
    v_gravidade := v_aviso ->> 'gravidade';
    v_modulo := v_aviso ->> 'modulo';
    v_area := nullif(v_aviso ->> 'area', '');
    v_exemplos := coalesce(v_aviso -> 'exemplos', '[]'::jsonb);
    v_casos := v_aviso -> 'casos';
    v_resumo := btrim(coalesce(v_aviso ->> 'resumo', ''));

    if v_conferencia is null or v_conferencia !~ '^[A-Z][A-Z0-9_]{2,59}$' then
      raise exception 'Código de conferência inválido' using errcode = '22023';
    end if;
    if v_escopo is null or v_escopo !~ '^[a-z_]{2,20}:[A-Za-z0-9._:/|-]{1,170}$' then
      raise exception 'Escopo inválido em %', v_conferencia using errcode = '22023';
    end if;
    if v_gravidade is null or v_gravidade not in ('CRITICA', 'ATENCAO', 'INFORMATIVO') then
      raise exception 'Gravidade inválida em %', v_conferencia using errcode = '22023';
    end if;
    if v_modulo is null or v_modulo not in ('analises', 'entrevistas', 'classificacao', 'aprovados', 'cargas') then
      raise exception 'Módulo inválido em %', v_conferencia using errcode = '22023';
    end if;
    if v_area is not null and not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = v_area) then
      raise exception 'Área inválida em %', v_conferencia using errcode = '22023';
    end if;
    begin
      v_edital := nullif(v_aviso ->> 'edital', '')::uuid;
      v_qt := (v_aviso ->> 'quantidade')::integer;
    exception when others then
      raise exception 'Edital ou quantidade inválidos em %', v_conferencia using errcode = '22023';
    end;
    if v_edital is not null and not exists (select 1 from public."TB_MONITORAMENTO_INDIGENA" m where m.id = v_edital) then
      raise exception 'Edital inexistente em %', v_conferencia using errcode = '22023';
    end if;
    if v_qt is null or v_qt < 1 then
      raise exception 'Quantidade inválida em %', v_conferencia using errcode = '22023';
    end if;
    if jsonb_typeof(v_exemplos) <> 'array' or jsonb_array_length(v_exemplos) > 20
       or exists (select 1 from jsonb_array_elements(v_exemplos) e
                   where jsonb_typeof(e) <> 'string'
                      or (e #>> '{}') !~ '^[A-Za-z0-9._:/-]{1,80}$'
                      or (e #>> '{}') ~ '[0-9]{11}') then
      raise exception 'Exemplos de % só com ids e códigos (até 20, sem espaço, sem @, sem 11 dígitos)', v_conferencia
        using errcode = '22023';
    end if;
    -- Casos: até 5000 objetos, cada um com análise (uuid), código ou referência
    -- (identificadores), o tipo da referência e o detalhe (objeto de valores
    -- simples, sem dado pessoal).
    if v_casos is not null and (
         jsonb_typeof(v_casos) <> 'array' or jsonb_array_length(v_casos) > 5000
         or exists (
           select 1 from jsonb_array_elements(v_casos) c
            where jsonb_typeof(c) <> 'object'
               or (c ? 'analise' and jsonb_typeof(c -> 'analise') <> 'null'
                   and coalesce(c ->> 'analise', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
               or (c ? 'codigo' and jsonb_typeof(c -> 'codigo') <> 'null'
                   and (coalesce(c ->> 'codigo', '') !~ '^[A-Za-z0-9._:/-]{1,80}$' or (c ->> 'codigo') ~ '[0-9]{11}'))
               or (c ? 'referencia' and jsonb_typeof(c -> 'referencia') <> 'null'
                   and (coalesce(c ->> 'referencia', '') !~ '^[A-Za-z0-9._:/-]{1,80}$' or (c ->> 'referencia') ~ '[0-9]{11}'))
               or (c ? 'tipo' and jsonb_typeof(c -> 'tipo') <> 'null'
                   and coalesce(c ->> 'tipo', '') not in ('candidato_aprovado', 'entrevista', 'lista_classificacao',
                                                          'ajuste_recurso', 'vaga', 'vaga_empregare'))
               or num_nonnulls(nullif(c ->> 'analise', ''), nullif(c ->> 'codigo', ''), nullif(c ->> 'referencia', '')) = 0
               or (c ? 'detalhe' and (
                     jsonb_typeof(c -> 'detalhe') <> 'object'
                     or exists (select 1 from jsonb_each(c -> 'detalhe') d
                                 where d.key !~ '^[a-z_]{1,30}$'
                                    or jsonb_typeof(d.value) not in ('string', 'number', 'boolean', 'null')
                                    or (jsonb_typeof(d.value) = 'string' and (d.value #>> '{}') !~ '^[A-Za-z0-9._:/-]{0,40}$')
                                    or (d.value #>> '{}') ~ '[0-9]{11}')
                     or length((c -> 'detalhe')::text) > 1000))
         )) then
      raise exception 'Casos de % só com ids, códigos, tipo conhecido e detalhe simples (até 5000, sem nome, @ ou 11 dígitos)', v_conferencia
        using errcode = '22023';
    end if;
    if length(v_resumo) not between 3 and 300 or not private."FC_TEXTO_SEGURO_DO_AVISO"(v_resumo) then
      raise exception 'Resumo de % vazio, longo ou com cara de dado pessoal', v_conferencia using errcode = '22023';
    end if;

    select * into v_atual from public."TB_AVISO_CONFERENCIA" a
     where a."CO_CONFERENCIA" = v_conferencia and a."DS_ESCOPO" = v_escopo
     for update;

    if v_atual."CO_AVISO_CONFERENCIA" is null then
      insert into public."TB_AVISO_CONFERENCIA" (
        "CO_CONFERENCIA", "DS_ESCOPO", "TP_GRAVIDADE", "CO_MODULO", "CO_AREA", "CO_MONITORAMENTO",
        "QT_OCORRENCIA", "DS_EXEMPLO", "DS_RESUMO", "CO_EXECUCAO")
      values (v_conferencia, v_escopo, v_gravidade, v_modulo, v_area, v_edital, v_qt, v_exemplos, v_resumo, p_execucao)
      returning "CO_AVISO_CONFERENCIA" into v_id;
      v_novos := v_novos + 1;
    elsif v_atual."TP_SITUACAO" = 'RESOLVIDO'
       or (v_atual."TP_SITUACAO" = 'IGNORADO' and v_qt > v_atual."QT_OCORRENCIA_IGNORADA") then
      v_id := v_atual."CO_AVISO_CONFERENCIA";
      update public."TB_AVISO_CONFERENCIA" set
        "TP_GRAVIDADE" = v_gravidade, "CO_MODULO" = v_modulo, "CO_AREA" = v_area, "CO_MONITORAMENTO" = v_edital,
        "QT_OCORRENCIA" = v_qt, "DS_EXEMPLO" = v_exemplos, "DS_RESUMO" = v_resumo, "CO_EXECUCAO" = p_execucao,
        "TP_SITUACAO" = 'ABERTO', "DT_ULTIMA_VEZ" = now(), "DT_RESOLUCAO" = null,
        "DT_PRIMEIRA_VEZ" = case when v_atual."TP_SITUACAO" = 'RESOLVIDO' then now() else "DT_PRIMEIRA_VEZ" end,
        "CO_USUARIO_IGNORADO" = null, "DT_IGNORADO" = null, "DS_MOTIVO_IGNORADO" = null, "QT_OCORRENCIA_IGNORADA" = null
       where "CO_AVISO_CONFERENCIA" = v_id;
      v_reabertos := v_reabertos + 1;
    else
      v_id := v_atual."CO_AVISO_CONFERENCIA";
      update public."TB_AVISO_CONFERENCIA" set
        "TP_GRAVIDADE" = v_gravidade, "CO_MODULO" = v_modulo, "CO_AREA" = v_area, "CO_MONITORAMENTO" = v_edital,
        "QT_OCORRENCIA" = v_qt, "DS_EXEMPLO" = v_exemplos, "DS_RESUMO" = v_resumo, "CO_EXECUCAO" = p_execucao,
        "DT_ULTIMA_VEZ" = now()
       where "CO_AVISO_CONFERENCIA" = v_id;
      v_mantidos := v_mantidos + 1;
    end if;

    -- Com 'casos', os do aviso são trocados pelos desta execução.
    if v_casos is not null then
      delete from public."TB_CASO_AVISO_CONFERENCIA" k where k."CO_AVISO_CONFERENCIA" = v_id;
      insert into public."TB_CASO_AVISO_CONFERENCIA" (
        "CO_AVISO_CONFERENCIA", "NU_CASO", "CO_ANALISE_CURRICULAR", "CO_CANDIDATO_EMPREGARE", "DS_REFERENCIA",
        "TP_REFERENCIA", "DS_DETALHE")
      select v_id, x.ordem::integer, nullif(x.caso ->> 'analise', '')::uuid,
             nullif(x.caso ->> 'codigo', ''), nullif(x.caso ->> 'referencia', ''), nullif(x.caso ->> 'tipo', ''),
             coalesce(case when jsonb_typeof(x.caso -> 'detalhe') = 'object' then x.caso -> 'detalhe' end, '{}'::jsonb)
        from jsonb_array_elements(v_casos) with ordinality as x(caso, ordem);
    end if;
  end loop;

  update public."TL_CONFERENCIA" set "QT_AVISO_NOVO" = "QT_AVISO_NOVO" + v_novos + v_reabertos
   where "CO_EXECUCAO" = p_execucao;
  return jsonb_build_object('novos', v_novos, 'reabertos', v_reabertos, 'mantidos', v_mantidos);
end;
$_$;

COMMENT ON FUNCTION public.gravar_avisos_conferencia(p_execucao text, p_avisos jsonb) IS 'Grava até 1000 avisos de uma execução (um por conferência + escopo): novo abre; resolvido reabre; ignorado reabre só se a quantidade passou da ignorada; aberto atualiza quantidade e exemplos. Com ''casos'' (até 5000: análise, código do candidato, referência, tipo da referência e o detalhe que motivou), troca os casos do aviso. Recusa (22023) exemplo ou caso que não seja id ou código (espaço, @, 11 dígitos), tipo desconhecido e resumo com cara de dado pessoal. Só service_role.';

CREATE OR REPLACE FUNCTION public.finalizar_conferencia(p_execucao text, p_conferencias text[], p_falhas text[] DEFAULT '{}'::text[], p_erro text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare
  v_mensagem text := nullif(left(btrim(coalesce(p_erro, '')), 2000), '');
  v_conferencias text[] := coalesce(p_conferencias, '{}');
  v_falhas text[] := coalesce(p_falhas, '{}');
  v_resolvidos integer := 0;
  v_abertos integer;
  v_situacao text;
begin
  perform private."FC_EXIGIR_EXECUCAO_CONFERENCIA"(p_execucao);
  if exists (select 1 from unnest(v_conferencias || v_falhas) c where c is null or c !~ '^[A-Z][A-Z0-9_]{2,59}$') then
    raise exception 'Código de conferência inválido' using errcode = '22023';
  end if;
  if v_mensagem is not null and not private."FC_TEXTO_SEGURO_DO_AVISO"(v_mensagem) then
    v_mensagem := 'Erro geral (a mensagem foi omitida por parecer ter dado pessoal).';
  end if;

  -- Só conferência que rodou até o fim resolve: a que falhou deixa os avisos como estavam.
  if v_mensagem is null then
    update public."TB_AVISO_CONFERENCIA" set
      "TP_SITUACAO" = 'RESOLVIDO', "DT_RESOLUCAO" = now(),
      "CO_USUARIO_IGNORADO" = null, "DT_IGNORADO" = null, "DS_MOTIVO_IGNORADO" = null, "QT_OCORRENCIA_IGNORADA" = null
     where "CO_CONFERENCIA" = any (v_conferencias)
       and not ("CO_CONFERENCIA" = any (v_falhas))
       and "TP_SITUACAO" in ('ABERTO', 'IGNORADO')
       and "CO_EXECUCAO" <> p_execucao;
    get diagnostics v_resolvidos = row_count;
  end if;

  select count(*) into v_abertos from public."TB_AVISO_CONFERENCIA" a where a."TP_SITUACAO" = 'ABERTO';
  v_situacao := case
    when v_mensagem is not null then 'FALHOU'
    when cardinality(v_falhas) > 0 then 'PARCIAL'
    else 'CONCLUIDA' end;

  update public."TL_CONFERENCIA" set
    "TP_SITUACAO" = v_situacao, "DT_FIM" = now(),
    "DS_CONFERENCIA" = to_jsonb(v_conferencias), "DS_FALHA" = to_jsonb(v_falhas),
    "QT_AVISO_ABERTO" = v_abertos, "QT_AVISO_RESOLVIDO" = v_resolvidos, "DS_MENSAGEM" = v_mensagem
   where "CO_EXECUCAO" = p_execucao;

  return jsonb_build_object(
    'situacao', v_situacao, 'abertos', v_abertos, 'resolvidos', v_resolvidos,
    'novos', (select c."QT_AVISO_NOVO" from public."TL_CONFERENCIA" c where c."CO_EXECUCAO" = p_execucao));
end;
$_$;

COMMENT ON FUNCTION public.finalizar_conferencia(p_execucao text, p_conferencias text[], p_falhas text[], p_erro text) IS 'Fecha a execução das conferências: os avisos abertos ou ignorados das conferências que rodaram até o fim e não foram achados de novo viram RESOLVIDO; com p_erro, nada é resolvido e a execução FALHOU; com falhas, PARCIAL. Só service_role.';

CREATE OR REPLACE FUNCTION private."FC_FECHAR_CASOS_DO_AVISO"(p_conferencia text, p_candidatos uuid[]) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_avisos uuid[];
begin
  -- O caso sai do aviso; o aviso sem caso fica resolvido (a conferência confirma na rodada seguinte).
  with apagados as (
    delete from public."TB_CASO_AVISO_CONFERENCIA" k
     using public."TB_AVISO_CONFERENCIA" a
     where a."CO_AVISO_CONFERENCIA" = k."CO_AVISO_CONFERENCIA"
       and a."CO_CONFERENCIA" = p_conferencia
       and a."TP_SITUACAO" in ('ABERTO', 'IGNORADO')
       and k."DS_REFERENCIA" = any (select c::text from unnest(p_candidatos) c)
    returning k."CO_AVISO_CONFERENCIA"
  )
  select array_agg(distinct x."CO_AVISO_CONFERENCIA") into v_avisos from apagados x;
  if v_avisos is null then
    return 0;
  end if;
  update public."TB_AVISO_CONFERENCIA" a
     set "DS_EXEMPLO" = (select coalesce(jsonb_agg(e), '[]'::jsonb) from jsonb_array_elements(a."DS_EXEMPLO") e
                          where not ((e #>> '{}') = any (select c::text from unnest(p_candidatos) c))),
         "QT_OCORRENCIA" = greatest(1, (select count(*) from public."TB_CASO_AVISO_CONFERENCIA" k
                                         where k."CO_AVISO_CONFERENCIA" = a."CO_AVISO_CONFERENCIA")::integer)
   where a."CO_AVISO_CONFERENCIA" = any (v_avisos)
     and exists (select 1 from public."TB_CASO_AVISO_CONFERENCIA" k where k."CO_AVISO_CONFERENCIA" = a."CO_AVISO_CONFERENCIA");
  update public."TB_AVISO_CONFERENCIA" a
     set "TP_SITUACAO" = 'RESOLVIDO', "DT_RESOLUCAO" = now(),
         "CO_USUARIO_IGNORADO" = null, "DT_IGNORADO" = null, "DS_MOTIVO_IGNORADO" = null, "QT_OCORRENCIA_IGNORADA" = null
   where a."CO_AVISO_CONFERENCIA" = any (v_avisos)
     and not exists (select 1 from public."TB_CASO_AVISO_CONFERENCIA" k where k."CO_AVISO_CONFERENCIA" = a."CO_AVISO_CONFERENCIA");
  return cardinality(v_avisos);
end;
$$;

COMMENT ON FUNCTION private."FC_FECHAR_CASOS_DO_AVISO"(p_conferencia text, p_candidatos uuid[]) IS 'Tira dos avisos abertos (ou ignorados) da conferência os casos das linhas decididas na pendência e resolve o aviso que fica sem caso. 20261026190000.';

CREATE OR REPLACE FUNCTION public.listar_avisos_conferencia(p_area text DEFAULT NULL::text, p_modulo text DEFAULT NULL::text) RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_area text := nullif(lower(btrim(coalesce(p_area, ''))), '');
  v_modulo text := nullif(lower(btrim(coalesce(p_modulo, ''))), '');
begin
  if auth.uid() is null then
    raise exception 'Sessão necessária' using errcode = '42501';
  end if;
  if v_area is not null and not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = v_area) then
    raise exception 'Área inválida' using errcode = '22023';
  end if;
  if v_modulo is not null and v_modulo not in ('analises', 'entrevistas', 'classificacao', 'aprovados', 'cargas') then
    raise exception 'Módulo inválido' using errcode = '22023';
  end if;

  return json_build_object(
    'schema_version', 1,
    'gerado_em', now(),
    'ultima_execucao', (
      select json_build_object('inicio', c."DT_INICIO", 'fim', c."DT_FIM", 'situacao', c."TP_SITUACAO")
        from public."TL_CONFERENCIA" c
       where c."TP_SITUACAO" <> 'EM_ANDAMENTO'
       order by c."DT_INICIO" desc
       limit 1
    ),
    'avisos', (
      select coalesce(json_agg(json_build_object(
          'id', a."CO_AVISO_CONFERENCIA",
          'conferencia', a."CO_CONFERENCIA",
          'escopo', a."DS_ESCOPO",
          'gravidade', a."TP_GRAVIDADE",
          'modulo', a."CO_MODULO",
          'area', a."CO_AREA",
          'edital_id', a."CO_MONITORAMENTO",
          'edital', m.edital,
          'quantidade', a."QT_OCORRENCIA",
          'exemplos', a."DS_EXEMPLO",
          'resumo', a."DS_RESUMO",
          'situacao', a."TP_SITUACAO",
          'primeira_vez', a."DT_PRIMEIRA_VEZ",
          'ultima_vez', a."DT_ULTIMA_VEZ",
          'ignorado_em', a."DT_IGNORADO",
          'motivo', a."DS_MOTIVO_IGNORADO",
          'pode_ignorar', a."TP_SITUACAO" = 'ABERTO'
                          and private."FC_PODE_IGNORAR_AVISO"(a."CO_MODULO", a."CO_AREA", a."CO_MONITORAMENTO")
        ) order by case a."TP_SITUACAO" when 'ABERTO' then 0 else 1 end,
                   case a."TP_GRAVIDADE" when 'CRITICA' then 0 when 'ATENCAO' then 1 else 2 end,
                   a."DT_PRIMEIRA_VEZ"), '[]'::json)
        from public."TB_AVISO_CONFERENCIA" a
        left join public."TB_MONITORAMENTO_INDIGENA" m on m.id = a."CO_MONITORAMENTO"
       where a."TP_SITUACAO" in ('ABERTO', 'IGNORADO')
         and (v_area is null or a."CO_AREA" = v_area)
         and (v_modulo is null or a."CO_MODULO" = v_modulo)
         and private."FC_PODE_VER_AVISO"(a."CO_MODULO", a."CO_AREA", a."CO_MONITORAMENTO")
    )
  );
end;
$$;

COMMENT ON FUNCTION public.listar_avisos_conferencia(p_area text, p_modulo text) IS 'Avisos de conferência abertos e ignorados (json) que quem chama pode ver: o módulo (leitor), a área e o edital no recorte; cargas e avisos sem área, só o administrador global. Filtra por área e módulo (opcionais). pode_ignorar diz se a pessoa pode ignorar cada aviso aberto.';

CREATE OR REPLACE FUNCTION public.listar_casos_aviso_conferencia(p_aviso uuid DEFAULT NULL::uuid, p_busca text DEFAULT NULL::text, p_area text DEFAULT NULL::text, p_modulo text DEFAULT NULL::text, p_limite integer DEFAULT 50, p_deslocamento integer DEFAULT 0) RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    SET statement_timeout TO '15s'
    AS $_$
declare
  v_area text := nullif(lower(btrim(coalesce(p_area, ''))), '');
  v_modulo text := nullif(lower(btrim(coalesce(p_modulo, ''))), '');
  v_busca text := nullif(private."FC_TEXTO_DE_BUSCA"(left(coalesce(p_busca, ''), 80)), '');
  v_limite integer := least(greatest(coalesce(p_limite, 50), 1), 1000);
  v_deslocamento integer := greatest(coalesce(p_deslocamento, 0), 0);
  v_total integer;
  v_casos json;
begin
  if auth.uid() is null then
    raise exception 'Sessão necessária' using errcode = '42501';
  end if;
  if v_area is not null and not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = v_area) then
    raise exception 'Área inválida' using errcode = '22023';
  end if;
  if v_modulo is not null and v_modulo not in ('analises', 'entrevistas', 'classificacao', 'aprovados', 'cargas') then
    raise exception 'Módulo inválido' using errcode = '22023';
  end if;
  if p_aviso is null and v_busca is null then
    raise exception 'Informe o aviso ou o que buscar' using errcode = '22023';
  end if;
  if p_aviso is not null and not exists (
       select 1 from public."TB_AVISO_CONFERENCIA" a
        where a."CO_AVISO_CONFERENCIA" = p_aviso
          and a."TP_SITUACAO" in ('ABERTO', 'IGNORADO')
          and private."FC_PODE_VER_AVISO"(a."CO_MODULO", a."CO_AREA", a."CO_MONITORAMENTO")) then
    raise exception 'Aviso não encontrado' using errcode = '22023';
  end if;

  with avisos as (
    select a."CO_AVISO_CONFERENCIA" as id, a."CO_CONFERENCIA" as conferencia, a."CO_MODULO" as modulo,
           a."CO_AREA" as area, a."CO_MONITORAMENTO" as edital
      from public."TB_AVISO_CONFERENCIA" a
     where a."TP_SITUACAO" in ('ABERTO', 'IGNORADO')
       and (p_aviso is null or a."CO_AVISO_CONFERENCIA" = p_aviso)
       and (v_area is null or a."CO_AREA" = v_area)
       and (v_modulo is null or a."CO_MODULO" = v_modulo)
       and private."FC_PODE_VER_AVISO"(a."CO_MODULO", a."CO_AREA", a."CO_MONITORAMENTO")
  ),
  casos as materialized (
    select av.id as aviso, av.conferencia, k."NU_CASO" as ordem,
           k."CO_ANALISE_CURRICULAR" as analise_do_caso, k."CO_CANDIDATO_EMPREGARE" as codigo_do_caso,
           k."DS_REFERENCIA" as referencia_do_caso, k."DS_DETALHE" as detalhe,
           an.id as an_id, nullif(btrim(an.id_origem), '') as an_codigo, an.candidato as an_nome,
           an.edital as an_edital, an.codigo_vaga as an_codigo_vaga, an.nome_vaga as an_nome_vaga,
           an.responsavel_analise, an.status_consolidado as an_status, an.data_analise,
           private."FC_REFERENCIA_DO_CASO"(av.modulo, av.conferencia, k."TP_REFERENCIA", k."DS_REFERENCIA",
                                           k."CO_ANALISE_CURRICULAR", av.area, av.edital) as r
      from avisos av
      join public."TB_CASO_AVISO_CONFERENCIA" k on k."CO_AVISO_CONFERENCIA" = av.id
      left join lateral (
        (select x.id, x.id_origem, x.candidato, x.edital, x.codigo_vaga, x.nome_vaga,
                x.responsavel_analise, x.status_consolidado, x.data_analise
           from public."TB_ANALISE_CURRICULAR" x
          where x.id = k."CO_ANALISE_CURRICULAR"
            and private."FC_PODE_VER_ANALISE_DO_AVISO"(x."CO_AREA", x.edital_norm, x.unidade_norm))
        union all
        (select x.id, x.id_origem, x.candidato, x.edital, x.codigo_vaga, x.nome_vaga,
                x.responsavel_analise, x.status_consolidado, x.data_analise
           from public."TB_ANALISE_CURRICULAR" x
          where k."CO_ANALISE_CURRICULAR" is null
            and x.ativo is true
            and x.id_origem = k."CO_CANDIDATO_EMPREGARE"
            and private."FC_PODE_VER_ANALISE_DO_AVISO"(x."CO_AREA", x.edital_norm, x.unidade_norm)
          order by x.edital, x.id
          limit 1)
        limit 1
      ) an on true
  ),
  resolvidos as materialized (
    select c.*,
           coalesce(c.an_nome, c.r ->> 'nome') as nome,
           coalesce(c.codigo_do_caso, c.an_codigo, c.r ->> 'codigo') as codigo,
           coalesce(c.an_edital, c.r ->> 'edital') as edital,
           coalesce(c.an_codigo_vaga, c.r ->> 'codigo_vaga') as codigo_vaga,
           coalesce(c.an_nome_vaga, c.r ->> 'nome_vaga') as nome_vaga,
           coalesce(c.r ->> 'status', c.an_status) as status,
           c.r ->> 'tipo' as tipo,
           case
             when c.an_id is not null or c.r ->> 'resolucao' = 'ok' then 'ok'
             when c.r ? 'resolucao' then c.r ->> 'resolucao'
             when c.analise_do_caso is not null then
               case when exists (select 1 from public."TB_ANALISE_CURRICULAR" x where x.id = c.analise_do_caso)
                    then 'sem_acesso' else 'removido' end
             when c.codigo_do_caso is not null then
               case when exists (select 1 from public."TB_ANALISE_CURRICULAR" x
                                  where x.ativo is true and x.id_origem = c.codigo_do_caso)
                    then 'sem_acesso' else 'removido' end
             when c.referencia_do_caso ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then 'removido'
             else 'ok'
           end as resolucao,
           -- A referência só sai quando é um código (vaga, lista do job antigo), nunca um UUID.
           case when c.referencia_do_caso ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                then null else c.referencia_do_caso end as referencia,
           case when c.r ->> 'tipo' = 'candidato_aprovado'
                 and c.referencia_do_caso ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                then c.referencia_do_caso::uuid end as aprovado_do_caso
      from casos c
  ),
  filtrados as (
    select f.* from resolvidos f
     where v_busca is null
        or private."FC_TEXTO_DE_BUSCA"(coalesce(f.codigo, '')) like '%' || v_busca || '%'
        or private."FC_TEXTO_DE_BUSCA"(coalesce(f.referencia, '')) like '%' || v_busca || '%'
        or private."FC_TEXTO_DE_BUSCA"(coalesce(f.nome, '')) like '%' || v_busca || '%'
        or private."FC_TEXTO_DE_BUSCA"(coalesce(f.codigo_vaga, '')) like '%' || v_busca || '%'
        or private."FC_TEXTO_DE_BUSCA"(coalesce(f.nome_vaga, '')) like '%' || v_busca || '%'
  ),
  numerados as (
    select f.*,
           row_number() over (order by f.nome is null, private."FC_TEXTO_DE_BUSCA"(f.nome),
                                       f.codigo, f.codigo_vaga, f.conferencia, f.ordem) as posicao,
           count(*) over () as total
      from filtrados f
  ),
  pagina as materialized (
    select n.*,
           case when n.aprovado_do_caso is not null
                then private."FC_VINCULOS_DO_APROVADO"(n.aprovado_do_caso) end as vinculos
      from numerados n
     where n.posicao > v_deslocamento and n.posicao <= v_deslocamento + v_limite
  )
  select (select max(n.total) from numerados n)::integer,
         json_agg(json_build_object(
           'aviso_id', p.aviso,
           'conferencia', p.conferencia,
           'ordem', p.ordem,
           'tipo', p.tipo,
           'resolucao', p.resolucao,
           'analise_id', coalesce(p.an_id::text, p.r ->> 'analise_id'),
           'aprovado_id', p.r ->> 'aprovado_id',
           'entrevista_id', p.r ->> 'entrevista_id',
           'edital_id', p.r ->> 'edital_id',
           'codigo', p.codigo,
           'nome', p.nome,
           'edital', p.edital,
           'codigo_vaga', p.codigo_vaga,
           'nome_vaga', p.nome_vaga,
           'responsavel', p.responsavel_analise,
           'status', p.status,
           'data_analise', p.data_analise,
           'nota', p.r -> 'nota',
           'compareceu', p.r ->> 'compareceu',
           'data_convocacao', p.r ->> 'data_convocacao',
           'data_contratacao', p.r ->> 'data_contratacao',
           'candidatos', p.r -> 'candidatos',
           'lista', p.r -> 'lista',
           'referencia', p.referencia,
           'detalhe', p.detalhe,
           'vinculos', p.vinculos -> 'vinculos',
           'analises', case when p.analise_do_caso is null and p.codigo_do_caso is not null then (
             select coalesce(json_agg(json_build_object(
                      'id', x.id, 'edital', x.edital, 'codigo_vaga', x.codigo_vaga, 'nome_vaga', x.nome_vaga,
                      'status', x.status_consolidado, 'responsavel', x.responsavel_analise,
                      'data_analise', x.data_analise) order by x.edital, x.codigo_vaga, x.id), '[]'::json)
               from public."TB_ANALISE_CURRICULAR" x
              where x.ativo is true and x.id_origem = p.codigo_do_caso
                and private."FC_PODE_VER_ANALISE_DO_AVISO"(x."CO_AREA", x.edital_norm, x.unidade_norm)) end,
           'fora_do_acesso', case
             when p.analise_do_caso is null and p.codigo_do_caso is not null then (
               select count(*)::integer
                 from public."TB_ANALISE_CURRICULAR" x
                where x.ativo is true and x.id_origem = p.codigo_do_caso
                  and not private."FC_PODE_VER_ANALISE_DO_AVISO"(x."CO_AREA", x.edital_norm, x.unidade_norm))
             when p.vinculos is not null then (p.vinculos ->> 'fora')::integer end
         ) order by p.posicao)
    into v_total, v_casos
    from pagina p;

  return json_build_object(
    'schema_version', 2,
    'total', coalesce(v_total, 0),
    'limite', v_limite,
    'deslocamento', v_deslocamento,
    'casos', coalesce(v_casos, '[]'::json));
end;
$_$;

COMMENT ON FUNCTION public.listar_casos_aviso_conferencia(p_aviso uuid, p_busca text, p_area text, p_modulo text, p_limite integer, p_deslocamento integer) IS 'Casos (json, em páginas de até 1000) de um aviso de conferência, ou de todos os avisos abertos e ignorados que quem chama vê (área e módulo opcionais; exige p_busca). Busca por código do candidato, nome, código ou nome da vaga e referência (sem acento e sem caixa). Cada caso: tipo e resolução (ok, removido, sem_acesso), código, nome, edital, vaga, situação e datas — da análise (área e recorte de quem lê) ou do registro do módulo (aprovado, entrevista, lista, ajuste, vaga) com a permissão daquele módulo —, o detalhe que motivou o aviso, as análises do candidato em dois editais e as vagas da pessoa nas listas de aprovados (com quantas ficaram fora do acesso). A referência só sai quando não é UUID. Sem CPF.';

CREATE FUNCTION public.ignorar_aviso_conferencia(p_id uuid, p_motivo text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_aviso public."TB_AVISO_CONFERENCIA";
  v_motivo text := btrim(coalesce(p_motivo, ''));
begin
  if auth.uid() is null then
    raise exception 'Sessão necessária' using errcode = '42501';
  end if;
  if length(v_motivo) not between 10 and 500 then
    raise exception 'Escreva o motivo (10 a 500 caracteres)' using errcode = '22023';
  end if;
  select * into v_aviso from public."TB_AVISO_CONFERENCIA" a where a."CO_AVISO_CONFERENCIA" = p_id for update;
  if v_aviso."CO_AVISO_CONFERENCIA" is null
     or not private."FC_PODE_VER_AVISO"(v_aviso."CO_MODULO", v_aviso."CO_AREA", v_aviso."CO_MONITORAMENTO") then
    raise exception 'Aviso não encontrado' using errcode = '22023';
  end if;
  if not private."FC_PODE_IGNORAR_AVISO"(v_aviso."CO_MODULO", v_aviso."CO_AREA", v_aviso."CO_MONITORAMENTO") then
    raise exception 'Só o gestor do módulo ou o administrador global ignora avisos' using errcode = '42501';
  end if;
  if v_aviso."TP_SITUACAO" <> 'ABERTO' then
    raise exception 'Só aviso aberto pode ser ignorado' using errcode = '22023';
  end if;

  update public."TB_AVISO_CONFERENCIA" set
    "TP_SITUACAO" = 'IGNORADO', "CO_USUARIO_IGNORADO" = auth.uid(), "DT_IGNORADO" = now(),
    "DS_MOTIVO_IGNORADO" = v_motivo, "QT_OCORRENCIA_IGNORADA" = "QT_OCORRENCIA"
   where "CO_AVISO_CONFERENCIA" = p_id;

  return json_build_object('id', p_id, 'situacao', 'IGNORADO', 'ignorado_em', now());
end;
$$;

COMMENT ON FUNCTION public.ignorar_aviso_conferencia(p_id uuid, p_motivo text) IS 'Ignora um aviso de conferência aberto, com motivo (10 a 500 caracteres): administrador global ou quem vê o aviso e administra o módulo (classificação: editor). O aviso volta a ABERTO se a quantidade crescer.';

REVOKE ALL ON FUNCTION public.ignorar_aviso_conferencia(p_id uuid, p_motivo text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.ignorar_aviso_conferencia(p_id uuid, p_motivo text) TO authenticated;

select private."FC_ATUALIZAR_FONTES_DAS_LEITURAS"();


do $$
begin
  if md5(replace((select prosrc from pg_proc where oid = to_regprocedure('public.gravar_avisos_conferencia(text, jsonb)')), chr(13), ''))
         is distinct from '5b66702e4d9e545fa77feb1a715bd029'
       or md5(replace((select prosrc from pg_proc where oid = to_regprocedure('public.finalizar_conferencia(text, text[], text[], text)')), chr(13), ''))
         is distinct from '7504ee7a84170ae06839e4d834ea217c'
       or md5(replace((select prosrc from pg_proc where oid = to_regprocedure('public.listar_avisos_conferencia(text, text)')), chr(13), ''))
         is distinct from 'be53920c2e720c44268d5003dd5488f1'
       or md5(replace((select prosrc from pg_proc where oid = to_regprocedure('public.listar_casos_aviso_conferencia(uuid, text, text, text, integer, integer)')), chr(13), ''))
         is distinct from 'e993ea3451a2ebe8f604059df2ecadcb'
       or md5(replace((select prosrc from pg_proc where oid = to_regprocedure('private."FC_FECHAR_CASOS_DO_AVISO"(text, uuid[])')), chr(13), ''))
         is distinct from 'b4b445bbb0c5d09e8c7857508db7d03b'
       or md5(replace((select prosrc from pg_proc where oid = to_regprocedure('public.ignorar_aviso_conferencia(uuid, text)')), chr(13), ''))
         is distinct from 'c5f9f342ebd5e9ccb0cb239ea21ef04c' then
    raise exception 'O rollback não devolveu os corpos de antes';
  end if;
  if exists (select 1 from ensaio_antes e join public."TB_AVISO_CONFERENCIA" a on a."CO_AVISO_CONFERENCIA" = e.id
              where e.situacao = 'IGNORADO'
                and (a."TP_SITUACAO" <> 'IGNORADO' or a."DS_MOTIVO_IGNORADO" is distinct from left(btrim(e.motivo), 500))) then
    raise exception 'O rollback não devolveu os ignorados com o motivo';
  end if;
  raise notice 'Ensaio ok: migration, ciclo e rollback conferidos.';
end;
$$;

rollback;
