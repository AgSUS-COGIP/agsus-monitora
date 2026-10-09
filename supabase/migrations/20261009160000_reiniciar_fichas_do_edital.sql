/*
  AVALIAÇÃO DOCUMENTAL: REINICIAR AS FICHAS DE UM EDITAL (admin global)

  Por quê: no 93/2026 a análise documental foi feita pela planilha; as fichas
  que existem no MONITORA (distribuídas, em análise e uma concluída) são de
  testes. É preciso voltar as fichas ao início — como logo depois da
  pré-classificação — sem apagar nada e com registro no histórico.

  "Início" de cada ficha do lote (toda ficha que não está FORA_LOTE):
    PENDENTE, sem responsável (e data de atribuição), sem reserva, sem
    lançamento, resultado da conta, parecer, resultado, notas, rascunho e
    conclusão (quem e quando); a versão da ficha sobe. FORA_LOTE fica como está.
  Nada mais muda: a regra e as versões dela, as decisões de inclusão no lote,
  a pré-classificação, as listas da Classificação e as análises da planilha
  (TB_ANALISE_CURRICULAR) não são tocadas. A ficha que já está no início não
  muda nem ganha histórico (rodar de novo não faz nada).

  O QUE ENTRA
    TH_FICHA_ANALISE    ação REINICIAR (com motivo de 10 a 2.000): uma linha por
                        ficha reiniciada, com a situação e o responsável de
                        antes e, em DS_ALTERACAO, o que foi limpo (de → nulo:
                        situação, reserva, resultado, notas, lançamento,
                        resultado da conta, parecer, rascunho e conclusão).
                        O retrato do conteúdo de antes continua nas linhas
                        SALVAR/CONCLUIR do histórico, que não mudam.
    private."FC_REINICIAR_FICHAS_DO_EDITAL"(p_edital, p_motivo, p_usuario)
                        faz o reinício; quem chama informa o autor (admin
                        global ativo). Sem grant: a RPC abaixo e o SQL Editor
                        (correção supabase/correcoes/20261009-reiniciar-fichas-93.sql).
    public.reiniciar_fichas_do_edital(p_edital, p_motivo)
                        RPC só do administrador global (42501); o autor é o
                        login.

  Gatilhos: TB_FICHA_ANALISE só barra o DELETE (FC_TG_FICHA_IMUTAVEL); nenhum
  gatilho foi desligado nem relaxado.

  Ensaio: supabase/ensaios/20261009160000_reiniciar_fichas_do_edital.sql
  Rollback: supabase/rollback/20261009160000_reiniciar_fichas_do_edital.sql
*/
begin;

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

commit;
