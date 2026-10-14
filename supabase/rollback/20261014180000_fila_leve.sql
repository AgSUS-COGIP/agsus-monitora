-- Desfaz 20261014180000_fila_leve.sql: devolve obter_fila_avaliacao como estava em 14/10/2026
-- (definição viva: todos os inscritos em "candidatos", permissão do analista por inscrito) e
-- apaga as funções novas. O front volta pelo git (revertendo o commit da fila leve): a tela de
-- antes não chama obter_fila_fora_do_lote nem lê "fora_do_lote".
begin;

set local lock_timeout = '10s';

create or replace function public.obter_fila_avaliacao(p_edital uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_area text := private."FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 1);
  v_papel text := private."FC_PAPEL_AVALIACAO"(p_edital);
  v_uid uuid := (select auth.uid());
  v_so_minhas_vagas boolean := coalesce(v_papel, '') = 'ANALISTA';
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
        from public."TB_PRE_CLASSIF_VAGA" pv
       where pv."CO_MONITORAMENTO" = p_edital
         and (not v_so_minhas_vagas or private."FC_PODE_ANALISAR_VAGA"(p_edital, v_uid, pv."CO_VAGA"))), '[]'::json),
    'analistas', private."FC_ANALISTAS_DO_EDITAL"(p_edital, true),
    'filtros', private."FC_FILTROS_FILA_JSON"(v_uid),
    'candidatos', coalesce((
      select json_agg(json_build_object(
               'id', a."CO_EMPREGARE_CANDIDATO", 'vaga', a."CO_VAGA", 'codigo', c."CO_CANDIDATO_EMPREGARE",
               'nome', c."NO_CANDIDATO", 'situacao_pre', a."TP_SITUACAO", 'motivo_eliminacao', a."DS_MOTIVO_ELIMINACAO",
               'posicao', a."NU_POSICAO", 'lote', a."NU_LOTE", 'art', a."VL_ART", 'nota', a."VL_NOTA_ORDEM",
               'modalidade', a."NO_MODALIDADE", 'motivo_codigo', a."CO_MOTIVO_ELIMINACAO", 'entrada', a."TP_ENTRADA_LOTE",
               'decisao', case when a."TP_ENTRADA_LOTE" = 'DECISAO' then a."DS_MOTIVO_ENTRADA" end,
               'ficha', case when f."CO_FICHA_ANALISE" is null then null else json_build_object(
                 'id', f."CO_FICHA_ANALISE", 'versao', f."NU_VERSAO", 'situacao', f."TP_SITUACAO",
                 'responsavel', f."CO_USUARIO_RESPONSAVEL", 'responsavel_nome', coalesce(ur.nome, ur.email),
                 'atribuida_em', f."DT_ATRIBUICAO", 'motivo_saida', f."DS_MOTIVO_SAIDA", 'lote', f."NU_LOTE",
                 'resultado', case when f."TP_SITUACAO" = 'CONCLUIDA' then f."TP_RESULTADO" end,
                 'nota_final', case when f."TP_SITUACAO" = 'CONCLUIDA' then f."VL_NOTA_FINAL" end,
                 'concluida_em', case when f."TP_SITUACAO" = 'CONCLUIDA' then f."DT_CONCLUSAO" end,
                 'rascunho_em', f."DT_RASCUNHO",
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
       where a."CO_MONITORAMENTO" = p_edital
         and (not v_so_minhas_vagas or private."FC_PODE_ANALISAR_VAGA"(p_edital, v_uid, a."CO_VAGA"))), '[]'::json)
  );
end;
$function$;

comment on function public.obter_fila_avaliacao(uuid) is
  'A fila da avaliação documental do edital (json): papel de quem está logado (coordena, pode pegar), a distribuição da regra, cada inscrito da pré-classificação (com a entrada no lote e, desde 20261007200000, o motivo da decisão da coordenação quando entrou por decisão) com a ficha (situação, responsável, reserva vigente, versão, rascunho e, concluída, resultado e nota; nome do candidato, sem CPF nem contato), as vagas, os analistas com as pendentes, quantos do lote ainda estão sem ficha e os filtros salvos de quem chama. O analista vê só as vagas que analisa. Exige avaliacao_documental >= leitor, a área e o recorte da coordenação.';

drop function if exists public.obter_fila_fora_do_lote(uuid, uuid, integer);
drop function if exists private."FC_LINHAS_DA_FILA"(uuid, text[], boolean, uuid, integer);
drop function if exists private."FC_VAGAS_DO_ANALISTA"(uuid, uuid);
drop function if exists private."FC_NO_NUCLEO_DA_FILA"(text, text);

commit;
