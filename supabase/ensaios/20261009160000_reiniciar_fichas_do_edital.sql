/*
  ENSAIO de 20261009160000_reiniciar_fichas_do_edital.sql — begin … rollback.

  Como rodar: cole o arquivo inteiro no SQL Editor do Supabase (papel postgres)
  e execute. Ele abre uma transação, aplica o corpo da migration (copiado sem
  mudança, sem o begin/commit dela) e confere, no 93/2026 (Projetos):
    E1  permissões: a função privada sem grant; a RPC só para authenticated;
    E2  a RPC sem sessão (não é admin global) recusa com 42501;
    E3  motivo curto recusa (22023); autor que não é admin global recusa (42501);
    E4  o reinício: toda ficha do lote fica PENDENTE, sem responsável, reserva
        nem conteúdo, versão + 1; uma linha REINICIAR por ficha reiniciada,
        com o motivo e o autor;
    E5  FORA_LOTE, regra, decisões de inclusão, pré-classificação,
        Classificação, análises da planilha e fichas dos outros editais iguais
        (md5 das tabelas);
    E6  rodar de novo não muda nada nem grava histórico.
  Termina em ROLLBACK: nada fica gravado.

  Precisa de: o edital 93/2026 de Projetos e um administrador global ativo.
  Resultado esperado: a linha final com "ok": true e as contagens antes/depois.
  Mantenha em sincronia: tests/reiniciar-fichas-do-edital-migration.test.js
  confere que o corpo da migration aqui é idêntico ao do arquivo da migration.
*/
begin;

-- ===== corpo da migration (sem begin/commit) =====

set local lock_timeout = '10s';

-- 0. Pré-requisitos ---------------------------------------------------------------------
do $$
begin
  if to_regclass('public."TH_FICHA_ANALISE"') is null
     or to_regprocedure('private.is_master()') is null
     or not exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = 'TB_FICHA_ANALISE'
                       and column_name = 'DT_CONCLUSAO') then
    raise exception 'Aplique antes 20261006120000_fichas_fila_e_reserva.sql e 20261007130000_conteudo_da_ficha.sql.';
  end if;
end;
$$;

-- 1. A ação REINICIAR no histórico -------------------------------------------------------
alter table public."TH_FICHA_ANALISE"
  drop constraint "CK_THFICHA_TPACAO",
  drop constraint "CK_THFICHA_MOTIVO",
  add constraint "CK_THFICHA_TPACAO" check ("TP_ACAO" in ('CRIAR', 'PEGAR', 'RESERVAR', 'LIBERAR', 'LIBERAR_RESERVA', 'DISTRIBUIR',
    'REDISTRIBUIR', 'DEVOLVER_FILA', 'REVISAR', 'SAIR_LOTE', 'VOLTAR_LOTE', 'SALVAR', 'CONCLUIR', 'REABRIR', 'REINICIAR')),
  add constraint "CK_THFICHA_MOTIVO" check (
    "TP_ACAO" not in ('REDISTRIBUIR', 'DEVOLVER_FILA', 'LIBERAR_RESERVA', 'REVISAR', 'REABRIR', 'REINICIAR')
    or length(btrim(coalesce("DS_MOTIVO", ''))) between 10 and 2000);
comment on column public."TH_FICHA_ANALISE"."TP_ACAO" is 'CRIAR, PEGAR (Pegar próximo), RESERVAR (abriu), LIBERAR (fechou), LIBERAR_RESERVA (a coordenação liberou a reserva de outra pessoa), DISTRIBUIR, REDISTRIBUIR, DEVOLVER_FILA, REVISAR, SAIR_LOTE, VOLTAR_LOTE, SALVAR (rascunho com alteração), CONCLUIR, REABRIR ou REINICIAR (o administrador global voltou as fichas do edital ao início).';
comment on column public."TH_FICHA_ANALISE"."DS_MOTIVO" is 'Motivo (obrigatório, 10 a 2.000, em redistribuir, devolver à fila, liberar a reserva de outra pessoa, mandar para revisão, reabrir e reiniciar; nas saídas e entradas do lote, o motivo da pré-classificação).';
comment on constraint "CK_THFICHA_TPACAO" on public."TH_FICHA_ANALISE" is 'Ações válidas.';
comment on constraint "CK_THFICHA_MOTIVO" on public."TH_FICHA_ANALISE" is 'Motivo de 10 a 2.000 caracteres nas ações que mexem no trabalho de outra pessoa, na reabertura e no reinício.';

-- 2. O reinício -------------------------------------------------------------------------
create function private."FC_REINICIAR_FICHAS_DO_EDITAL"(p_edital uuid, p_motivo text, p_usuario uuid)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_motivo text := btrim(coalesce(p_motivo, ''));
  v_f public."TB_FICHA_ANALISE";
  v_antes jsonb := '{}'::jsonb;
  v_reiniciadas integer := 0;
  v_no_inicio integer := 0;
  v_fora integer := 0;
begin
  if length(v_motivo) not between 10 and 2000 then
    raise exception 'Informe o motivo para reiniciar as fichas (10 a 2.000 caracteres).' using errcode = '22023';
  end if;
  if p_usuario is null or not exists (
       select 1 from public."TB_PERFIL_USUARIO" p
         join public."TB_GRUPO_ACESSO" a on a."CO_GRUPO_ACESSO" = p.perfil
        where p.user_id = p_usuario and p.ativo is true and a."ST_ADMIN_GLOBAL") then
    raise exception 'Só o administrador global reinicia as fichas do edital' using errcode = '42501';
  end if;
  -- Trava o edital: ninguém abre fichas novas dele enquanto o reinício corre.
  perform 1 from public."TB_MONITORAMENTO_INDIGENA" m where m.id = p_edital for update;
  if not found then
    raise exception 'Edital não encontrado' using errcode = '22023';
  end if;

  for v_f in
    select * from public."TB_FICHA_ANALISE" f
     where f."CO_MONITORAMENTO" = p_edital
     order by f."CO_FICHA_ANALISE"
       for update
  loop
    if v_f."TP_SITUACAO" = 'FORA_LOTE' then
      v_fora := v_fora + 1;
      continue;
    end if;
    if v_f."TP_SITUACAO" = 'PENDENTE' and v_f."CO_USUARIO_RESPONSAVEL" is null and v_f."DT_ATRIBUICAO" is null
       and v_f."CO_USUARIO_RESERVA" is null and v_f."DS_LANCAMENTO" is null and v_f."DS_RESULTADO" is null
       and v_f."DS_PARECER" is null and v_f."TP_RESULTADO" is null and v_f."VL_NOTA_APURADA" is null
       and v_f."VL_NOTA_FINAL" is null and v_f."CO_USUARIO_RASCUNHO" is null and v_f."CO_USUARIO_CONCLUSAO" is null then
      v_no_inicio := v_no_inicio + 1;
      continue;
    end if;

    update public."TB_FICHA_ANALISE" set
      "TP_SITUACAO" = 'PENDENTE',
      "CO_USUARIO_RESPONSAVEL" = null, "DT_ATRIBUICAO" = null,
      "CO_USUARIO_RESERVA" = null, "DT_RESERVA" = null, "DT_RESERVA_EXPIRA" = null,
      "DS_LANCAMENTO" = null, "DS_RESULTADO" = null, "DS_PARECER" = null, "TP_RESULTADO" = null,
      "VL_NOTA_APURADA" = null, "VL_NOTA_FINAL" = null,
      "CO_USUARIO_RASCUNHO" = null, "DT_RASCUNHO" = null,
      "CO_USUARIO_CONCLUSAO" = null, "DT_CONCLUSAO" = null,
      "NU_VERSAO" = "NU_VERSAO" + 1, "DT_ATUALIZACAO" = now()
     where "CO_FICHA_ANALISE" = v_f."CO_FICHA_ANALISE";

    insert into public."TH_FICHA_ANALISE"
      ("CO_FICHA_ANALISE", "NU_VERSAO", "TP_ACAO", "TP_SITUACAO_ANTERIOR", "TP_SITUACAO", "CO_USUARIO_RESP_ANTERIOR",
       "CO_USUARIO_RESPONSAVEL", "DS_MOTIVO", "TP_ORIGEM", "CO_USUARIO", "TP_RESULTADO", "VL_NOTA_FINAL", "DS_ALTERACAO")
    select v_f."CO_FICHA_ANALISE", v_f."NU_VERSAO" + 1, 'REINICIAR', v_f."TP_SITUACAO", 'PENDENTE',
           v_f."CO_USUARIO_RESPONSAVEL", null, v_motivo, 'TELA', p_usuario, null, null,
           coalesce(jsonb_agg(jsonb_build_object('campo', a.campo, 'de', a.de, 'para', a.para) order by a.ordem), '[]'::jsonb)
      from (values
              (1, 'situacao', to_jsonb(v_f."TP_SITUACAO"), to_jsonb('PENDENTE'::text)),
              (2, 'responsavel', to_jsonb(v_f."CO_USUARIO_RESPONSAVEL"), null),
              (3, 'reserva', to_jsonb(v_f."CO_USUARIO_RESERVA"), null),
              (4, 'resultado', to_jsonb(v_f."TP_RESULTADO"), null),
              (5, 'nota_apurada', to_jsonb(v_f."VL_NOTA_APURADA"), null),
              (6, 'nota_final', to_jsonb(v_f."VL_NOTA_FINAL"), null),
              (7, 'lancamento', v_f."DS_LANCAMENTO", null),
              (8, 'resultado_da_conta', v_f."DS_RESULTADO", null),
              (9, 'parecer', to_jsonb(v_f."DS_PARECER"), null),
              (10, 'rascunho', to_jsonb(v_f."DT_RASCUNHO"), null),
              (11, 'conclusao', to_jsonb(v_f."DT_CONCLUSAO"), null)
           ) as a(ordem, campo, de, para)
     where a.de is distinct from a.para;

    v_reiniciadas := v_reiniciadas + 1;
    v_antes := jsonb_set(v_antes, array[v_f."TP_SITUACAO"]::text[],
                         to_jsonb(coalesce((v_antes ->> v_f."TP_SITUACAO")::integer, 0) + 1));
  end loop;

  return json_build_object('edital', p_edital, 'reiniciadas', v_reiniciadas, 'por_situacao_anterior', v_antes,
                           'ja_no_inicio', v_no_inicio, 'fora_do_lote', v_fora, 'reiniciado_em', now());
end;
$function$;
comment on function private."FC_REINICIAR_FICHAS_DO_EDITAL"(uuid, text, uuid) is
  'Volta ao início as fichas do lote do edital (toda ficha que não está FORA_LOTE): PENDENTE, sem responsável, reserva, lançamento, resultado, parecer, notas, rascunho e conclusão; versão + 1; histórico REINICIAR com o motivo (10 a 2.000), o autor (admin global ativo, 42501) e o que foi limpo. FORA_LOTE e a ficha já no início não mudam. Não toca regra, decisões, pré-classificação, Classificação nem análises. Sem grant: public.reiniciar_fichas_do_edital e o SQL Editor.';
revoke all on function private."FC_REINICIAR_FICHAS_DO_EDITAL"(uuid, text, uuid) from public, anon, authenticated, service_role;

-- 3. RPC (admin global) -----------------------------------------------------------------
create function public.reiniciar_fichas_do_edital(p_edital uuid, p_motivo text)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if not private.is_master() then
    raise exception 'Só o administrador global reinicia as fichas do edital' using errcode = '42501';
  end if;
  return private."FC_REINICIAR_FICHAS_DO_EDITAL"(p_edital, p_motivo, (select auth.uid()));
end;
$function$;
comment on function public.reiniciar_fichas_do_edital(uuid, text) is
  'Só admin global: volta ao início (PENDENTE, sem responsável nem conteúdo) as fichas do lote do edital, com motivo de 10 a 2.000 e histórico REINICIAR por ficha; FORA_LOTE fica. Nada se apaga (FC_REINICIAR_FICHAS_DO_EDITAL).';
revoke all on function public.reiniciar_fichas_do_edital(uuid, text) from public, anon;
grant execute on function public.reiniciar_fichas_do_edital(uuid, text) to authenticated;

-- ===== fim do corpo =====

create temp table ensaio_md5 (nome text primary key, antes text, depois text);
create temp table ensaio_resultado (chave text primary key, valor jsonb);

create function pg_temp.md5_tabela(p_tabela text, p_filtro text default 'true')
returns text
language plpgsql
as $f$
declare
  v text;
begin
  execute format('select md5(coalesce(string_agg(t::text, %L order by t::text), %L)) from public.%I t where %s',
                 '|', '', p_tabela, p_filtro) into v;
  return v;
end;
$f$;

do $$
declare
  v_edital uuid := (select m.id from public."TB_MONITORAMENTO_INDIGENA" m
                     where private."FC_NUMERO_EDITAL"(m.edital) = '93/2026' and m."CO_AREA" = 'projetos'
                       and m."ST_TREINAMENTO" is distinct from 'S');
  v_autor uuid := (select p.user_id from public."TB_PERFIL_USUARIO" p
                     join public."TB_GRUPO_ACESSO" a on a."CO_GRUPO_ACESSO" = p.perfil
                    where p.ativo is true and a."ST_ADMIN_GLOBAL" and p.user_id is not null
                    order by p.user_id limit 1);
  c_motivo constant text := 'Reinício do edital: a análise documental do 93/2026 foi feita pela planilha';
  v_tabelas text[] := array['TB_REGRA_ANALISE', 'TH_REGRA_ANALISE', 'TB_DECISAO_LOTE', 'TH_DECISAO_LOTE',
    'TB_PRE_CLASSIFICACAO', 'TB_PRE_CLASSIF_VAGA', 'TH_PRE_CLASSIFICACAO', 'TL_PRE_CLASSIFICACAO',
    'TB_REGRA_CLASSIFICACAO', 'TH_REGRA_CLASSIFICACAO', 'TB_CRITERIO_CLASSIFICACAO',
    'TB_DESEMPATE_CLASSIFICACAO', 'TB_LISTA_CLASSIFICACAO', 'TB_ANALISE_CURRICULAR'];
  v_outros text;
  v_fora text;
  v_t text;
  v_r json;
  v_hist_antes integer;
  v_hist_depois integer;
  v_antes jsonb;
  v_depois jsonb;
  v_versoes_antes bigint;
  v_lote integer;
begin
  if v_edital is null then
    raise exception 'ENSAIO: 93/2026 de Projetos não encontrado';
  end if;
  if v_autor is null then
    raise exception 'ENSAIO: sem administrador global ativo';
  end if;
  v_outros := format('"CO_MONITORAMENTO" <> %L', v_edital);
  v_fora := format('"CO_MONITORAMENTO" = %L and "TP_SITUACAO" = %L', v_edital, 'FORA_LOTE');

  -- E1
  if has_function_privilege('authenticated', 'private."FC_REINICIAR_FICHAS_DO_EDITAL"(uuid, text, uuid)', 'execute')
     or has_function_privilege('anon', 'public.reiniciar_fichas_do_edital(uuid, text)', 'execute')
     or not has_function_privilege('authenticated', 'public.reiniciar_fichas_do_edital(uuid, text)', 'execute') then
    raise exception 'ENSAIO E1: permissões erradas';
  end if;

  -- E2
  begin
    perform public.reiniciar_fichas_do_edital(v_edital, c_motivo);
    raise exception 'ENSAIO E2: a RPC sem sessão não recusou';
  exception when insufficient_privilege then
    null;
  end;

  -- E3
  begin
    perform private."FC_REINICIAR_FICHAS_DO_EDITAL"(v_edital, 'curto', v_autor);
    raise exception 'ENSAIO E3: motivo curto não recusou';
  exception when invalid_parameter_value then
    null;
  end;
  begin
    perform private."FC_REINICIAR_FICHAS_DO_EDITAL"(v_edital, c_motivo, gen_random_uuid());
    raise exception 'ENSAIO E3: autor que não é admin global não recusou';
  exception when insufficient_privilege then
    null;
  end;

  -- Antes
  foreach v_t in array v_tabelas loop
    insert into ensaio_md5 values (v_t, pg_temp.md5_tabela(v_t), null);
  end loop;
  insert into ensaio_md5 values
    ('fichas de outros editais', pg_temp.md5_tabela('TB_FICHA_ANALISE', v_outros), null),
    ('fichas FORA_LOTE do 93', pg_temp.md5_tabela('TB_FICHA_ANALISE', v_fora), null);
  select jsonb_object_agg(s, n) into v_antes from (
    select "TP_SITUACAO" s, count(*) n from public."TB_FICHA_ANALISE" where "CO_MONITORAMENTO" = v_edital group by 1) x;
  select count(*) into v_hist_antes from public."TH_FICHA_ANALISE" h
    join public."TB_FICHA_ANALISE" f using ("CO_FICHA_ANALISE") where f."CO_MONITORAMENTO" = v_edital;
  select coalesce(sum("NU_VERSAO"), 0) into v_versoes_antes from public."TB_FICHA_ANALISE"
   where "CO_MONITORAMENTO" = v_edital and "TP_SITUACAO" <> 'FORA_LOTE';

  -- E4
  v_r := private."FC_REINICIAR_FICHAS_DO_EDITAL"(v_edital, c_motivo, v_autor);
  select count(*) into v_lote from public."TB_FICHA_ANALISE"
   where "CO_MONITORAMENTO" = v_edital and "TP_SITUACAO" <> 'FORA_LOTE';
  if exists (select 1 from public."TB_FICHA_ANALISE" f
              where f."CO_MONITORAMENTO" = v_edital and f."TP_SITUACAO" <> 'FORA_LOTE'
                and (f."TP_SITUACAO" <> 'PENDENTE' or f."CO_USUARIO_RESPONSAVEL" is not null or f."DT_ATRIBUICAO" is not null
                     or f."CO_USUARIO_RESERVA" is not null or f."DS_LANCAMENTO" is not null or f."DS_RESULTADO" is not null
                     or f."DS_PARECER" is not null or f."TP_RESULTADO" is not null or f."VL_NOTA_APURADA" is not null
                     or f."VL_NOTA_FINAL" is not null or f."CO_USUARIO_RASCUNHO" is not null or f."DT_RASCUNHO" is not null
                     or f."CO_USUARIO_CONCLUSAO" is not null or f."DT_CONCLUSAO" is not null)) then
    raise exception 'ENSAIO E4: ficha do lote fora do início';
  end if;
  if (v_r ->> 'reiniciadas')::integer + (v_r ->> 'ja_no_inicio')::integer <> v_lote then
    raise exception 'ENSAIO E4: o retorno % não fecha com o lote %', v_r, v_lote;
  end if;
  if (select coalesce(sum("NU_VERSAO"), 0) from public."TB_FICHA_ANALISE"
       where "CO_MONITORAMENTO" = v_edital and "TP_SITUACAO" <> 'FORA_LOTE')
     <> v_versoes_antes + (v_r ->> 'reiniciadas')::integer then
    raise exception 'ENSAIO E4: a versão não subiu 1 por ficha reiniciada';
  end if;
  select count(*) into v_hist_depois from public."TH_FICHA_ANALISE" h
    join public."TB_FICHA_ANALISE" f using ("CO_FICHA_ANALISE") where f."CO_MONITORAMENTO" = v_edital;
  if v_hist_depois - v_hist_antes <> (v_r ->> 'reiniciadas')::integer
     or (select count(*) from public."TH_FICHA_ANALISE" h join public."TB_FICHA_ANALISE" f using ("CO_FICHA_ANALISE")
          where f."CO_MONITORAMENTO" = v_edital and h."TP_ACAO" = 'REINICIAR' and h."DS_MOTIVO" = c_motivo
            and h."CO_USUARIO" = v_autor and h."TP_ORIGEM" = 'TELA' and h."TP_SITUACAO" = 'PENDENTE'
            and h."CO_USUARIO_RESPONSAVEL" is null and h."NU_VERSAO" = f."NU_VERSAO"
            and jsonb_array_length(h."DS_ALTERACAO") >= 1) <> (v_r ->> 'reiniciadas')::integer then
    raise exception 'ENSAIO E4: o histórico REINICIAR não bate (% → %, retorno %)', v_hist_antes, v_hist_depois, v_r;
  end if;
  select jsonb_object_agg(s, n) into v_depois from (
    select "TP_SITUACAO" s, count(*) n from public."TB_FICHA_ANALISE" where "CO_MONITORAMENTO" = v_edital group by 1) x;

  -- E5
  update ensaio_md5 set depois = case nome
    when 'fichas de outros editais' then pg_temp.md5_tabela('TB_FICHA_ANALISE', v_outros)
    when 'fichas FORA_LOTE do 93' then pg_temp.md5_tabela('TB_FICHA_ANALISE', v_fora)
    else pg_temp.md5_tabela(nome) end;
  if exists (select 1 from ensaio_md5 where antes is distinct from depois) then
    raise exception 'ENSAIO E5: mudou %', (select string_agg(nome, ', ') from ensaio_md5 where antes is distinct from depois);
  end if;

  -- E6
  v_r := private."FC_REINICIAR_FICHAS_DO_EDITAL"(v_edital, c_motivo, v_autor);
  if (v_r ->> 'reiniciadas')::integer <> 0
     or (select count(*) from public."TH_FICHA_ANALISE" h join public."TB_FICHA_ANALISE" f using ("CO_FICHA_ANALISE")
          where f."CO_MONITORAMENTO" = v_edital) <> v_hist_depois then
    raise exception 'ENSAIO E6: rodar de novo mudou algo (%)', v_r;
  end if;

  insert into ensaio_resultado values
    ('fichas_antes', v_antes),
    ('fichas_depois', v_depois),
    ('historico_reiniciar', to_jsonb(v_hist_depois - v_hist_antes)),
    ('intactas', (select jsonb_agg(nome order by nome) from ensaio_md5));
end;
$$;

select json_build_object('ok', true,
  'fichas_antes', (select valor from ensaio_resultado where chave = 'fichas_antes'),
  'fichas_depois', (select valor from ensaio_resultado where chave = 'fichas_depois'),
  'historico_reiniciar', (select valor from ensaio_resultado where chave = 'historico_reiniciar'),
  'intactas', (select valor from ensaio_resultado where chave = 'intactas')) as ensaio;

rollback;
