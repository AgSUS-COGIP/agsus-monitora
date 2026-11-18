/*
  ROLLBACK de 20261118140000_central_de_avisos_das_conferencias: volta ao ABERTO/IGNORADO/RESOLVIDO de antes. As funções trocadas voltam ao corpo e
  ao comentário do retrato de 18/11/2026 (depois do vínculo vaga–quadro) (letra por letra), a ignorar_aviso_conferencia volta, as RPCs
  novas saem. O DISPENSADO aberto volta a IGNORADO com quem, quando e o último motivo do histórico. O que
  não tem lugar no modelo antigo se perde: responsável, prazo, evidências, os outros tratamentos e o
  histórico (as tabelas saem). Guarda: só roda com as funções no corpo desta migration (md5).
  Depois: delete from public.migracoes_aplicadas where caminho = 'migrations/20261118140000_central_de_avisos_das_conferencias.sql';
  Antes ou junto: volte o front (a tela nova chama as RPCs que saem).
*/

begin;

do $$
begin
  if to_regclass('public."TH_AVISO_CONFERENCIA"') is null then
    raise exception 'Não aplicada: TH_AVISO_CONFERENCIA não existe.';
  end if;
  if md5(replace((select prosrc from pg_proc where oid = to_regprocedure('public.gravar_avisos_conferencia(text, jsonb)')), chr(13), ''))
       is distinct from 'e108d7d69d6d6f861c4bc7fa1fea40ee'
     or md5(replace((select prosrc from pg_proc where oid = to_regprocedure('public.finalizar_conferencia(text, text[], text[], text)')), chr(13), ''))
       is distinct from 'fc49576572c0460b615f1fdc86274f6b'
     or md5(replace((select prosrc from pg_proc where oid = to_regprocedure('private."FC_FECHAR_CASOS_DO_AVISO"(text, uuid[])')), chr(13), ''))
       is distinct from '86ae4c22d85012f1ad209d5d9d7525c2'
     or md5(replace((select prosrc from pg_proc where oid = to_regprocedure('public.listar_avisos_conferencia(text, text)')), chr(13), ''))
       is distinct from '8b3cb6fd177345d5fcac864cac4a9857'
     or md5(replace((select prosrc from pg_proc where oid = to_regprocedure('public.listar_casos_aviso_conferencia(uuid, text, text, text, integer, integer)')), chr(13), ''))
       is distinct from '98157f553abf27da3e345303c48c11e0' then
    raise exception 'As funções dos avisos não estão com o corpo de 20261118140000_central_de_avisos_das_conferencias: junte as mudanças antes.';
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

commit;
