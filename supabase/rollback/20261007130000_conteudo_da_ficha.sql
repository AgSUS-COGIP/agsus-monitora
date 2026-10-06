-- Desfaz 20261007130000_conteudo_da_ficha: tira as RPCs da ficha (obter_ficha_analise,
-- salvar_rascunho_ficha, concluir_ficha, reabrir_ficha, registrar_acesso_ficha) e as funções de
-- apoio, volta obter_fila_avaliacao (F3) e salvar_regra_analise (F1) ao que eram e tira as colunas
-- do conteúdo de TB_FICHA_ANALISE e TH_FICHA_ANALISE.
-- ATENÇÃO: apaga o conteúdo das fichas (lançamentos, resultados, pareceres) e, do histórico, os
-- registros SALVAR, CONCLUIR e REABRIR. Fichas concluídas ficam CONCLUIDA (a situação existe desde
-- a F3), sem o conteúdo. As fichas, a fila e a reserva (F3) ficam como estão.
begin;

drop function if exists public.registrar_acesso_ficha(uuid, text);
drop function if exists public.reabrir_ficha(uuid, integer, text);
drop function if exists public.concluir_ficha(uuid, integer, integer, jsonb, jsonb, text);
drop function if exists public.salvar_rascunho_ficha(uuid, integer, jsonb, jsonb, text);
drop function if exists public.obter_ficha_analise(uuid);

drop function if exists private."FC_EXIGIR_GRAVAR_FICHA"(public."TB_FICHA_ANALISE", integer);
drop function if exists private."FC_EXIGIR_VER_FICHA"(public."TB_FICHA_ANALISE");
drop function if exists private."FC_HISTORICO_CONTEUDO_FICHA"(uuid, text, text, text, uuid, jsonb, jsonb);
drop function if exists private."FC_ALTERACOES_FICHA"(jsonb, jsonb, jsonb, jsonb, jsonb);
drop function if exists private."FC_PENDENCIAS_FICHA"(jsonb, jsonb, jsonb);
drop function if exists private."FC_VALIDAR_RESULTADO_FICHA"(jsonb, jsonb, jsonb, jsonb);
drop function if exists private."FC_VALIDAR_LANCAMENTO_FICHA"(jsonb, jsonb);
drop function if exists private."FC_PARCIAL_DO_TIPO"(text);
drop function if exists private."FC_TETO_DO_BLOCO"(jsonb, text);
drop function if exists private."FC_BLOCO_SE_APLICA"(jsonb, jsonb);
drop function if exists private."FC_DOCUMENTAL_DO_EDITAL"(uuid);
drop function if exists private."FC_REGRA_VIGENTE_FICHA"(uuid);
drop function if exists private."FC_RESPOSTAS_DA_FICHA"(uuid, jsonb);
drop function if exists private."FC_TEXTO_COMPARAVEL"(text);

-- O histórico do conteúdo sai (o gatilho de imutável fica desligado só aqui).
alter table public."TH_FICHA_ANALISE" disable trigger "TG_THFICHA_IMUTAVEL";
delete from public."TH_FICHA_ANALISE" where "TP_ACAO" in ('SALVAR', 'CONCLUIR', 'REABRIR');
alter table public."TH_FICHA_ANALISE" enable trigger "TG_THFICHA_IMUTAVEL";
alter table public."TH_FICHA_ANALISE"
  drop constraint if exists "CK_THFICHA_CONTEUDO",
  drop constraint if exists "CK_THFICHA_TPACAO",
  drop constraint if exists "CK_THFICHA_MOTIVO",
  drop column if exists "DS_RETRATO",
  drop column if exists "DS_ALTERACAO",
  drop column if exists "VL_NOTA_FINAL",
  drop column if exists "TP_RESULTADO",
  add constraint "CK_THFICHA_TPACAO" check ("TP_ACAO" in ('CRIAR', 'PEGAR', 'RESERVAR', 'LIBERAR', 'LIBERAR_RESERVA', 'DISTRIBUIR',
    'REDISTRIBUIR', 'DEVOLVER_FILA', 'REVISAR', 'SAIR_LOTE', 'VOLTAR_LOTE')),
  add constraint "CK_THFICHA_MOTIVO" check (
    "TP_ACAO" not in ('REDISTRIBUIR', 'DEVOLVER_FILA', 'LIBERAR_RESERVA', 'REVISAR')
    or length(btrim(coalesce("DS_MOTIVO", ''))) between 10 and 2000);
comment on constraint "CK_THFICHA_TPACAO" on public."TH_FICHA_ANALISE" is 'Ações válidas.';
comment on constraint "CK_THFICHA_MOTIVO" on public."TH_FICHA_ANALISE" is 'Motivo de 10 a 2.000 caracteres nas ações que mexem no trabalho de outra pessoa.';

drop index if exists public."IN_FKFICHAANALISE_CONCLUSAO";
drop index if exists public."IN_FKFICHAANALISE_RASCUNHO";
alter table public."TB_FICHA_ANALISE"
  drop constraint if exists "CK_FICHAANALISE_CONCLUSAO",
  drop constraint if exists "CK_FICHAANALISE_CONTEUDO",
  drop constraint if exists "CK_FICHAANALISE_TPRESULTADO",
  drop constraint if exists "FK_USUARIOCONCL_FICHAANALISE",
  drop constraint if exists "FK_USUARIORASC_FICHAANALISE",
  drop column if exists "DT_CONCLUSAO",
  drop column if exists "CO_USUARIO_CONCLUSAO",
  drop column if exists "DT_RASCUNHO",
  drop column if exists "CO_USUARIO_RASCUNHO",
  drop column if exists "VL_NOTA_FINAL",
  drop column if exists "VL_NOTA_APURADA",
  drop column if exists "TP_RESULTADO",
  drop column if exists "DS_PARECER",
  drop column if exists "DS_RESULTADO",
  drop column if exists "DS_LANCAMENTO";

-- obter_fila_avaliacao como na F3 (20261006120000).
create or replace function public.obter_fila_avaliacao(p_edital uuid)
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


-- salvar_regra_analise como na F1 (20261006100000).
create or replace function public.salvar_regra_analise(p_edital uuid, p_configuracao jsonb, p_versao_atual integer, p_motivo text)
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

  insert into public."TH_REGRA_ANALISE" ("CO_REGRA_ANALISE", "NU_VERSAO", "DS_CONFIGURACAO", "DS_HASH", "DS_MOTIVO", "CO_USUARIO")
  values (v_regra."CO_REGRA_ANALISE", v_nova, p_configuracao,
          encode(sha256(convert_to(p_configuracao::text, 'UTF8')), 'hex'), coalesce(v_motivo, 'Regra criada do zero'), v_uid);

  update public."TB_REGRA_ANALISE"
     set "NU_VERSAO_VIGENTE" = v_nova, "TP_SITUACAO" = 'CONFERIR', "CO_USUARIO_CONFERENCIA" = null, "DT_CONFERENCIA" = null,
         "DT_ATUALIZACAO" = now(), "CO_USUARIO_ATUALIZACAO" = v_uid
   where "CO_REGRA_ANALISE" = v_regra."CO_REGRA_ANALISE";

  return json_build_object('regra', private."FC_REGRA_ANALISE_JSON"(p_edital), 'fichas_afetadas', '[]'::json);
end;
$function$;
comment on function public.salvar_regra_analise(uuid, jsonb, integer, text) is
  'Salva a regra da avaliação documental do edital como versão nova (a anterior fica no histórico, imutável) e volta a situação para Conferir. p_versao_atual = a versão que a tela abriu (0 sem regra; outra = 40001). Motivo obrigatório da versão 2 em diante (10 a 2.000). fichas_afetadas: as fichas concluídas com versão anterior (vazio até a fase F3; nada é recalculado). Só a coordenação do edital.';


commit;
