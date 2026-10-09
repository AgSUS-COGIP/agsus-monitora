/*
  FICHA COM A RESPOSTA VIGENTE DO QUESTIONÁRIO (09/10/2026)

  Na ficha da avaliação documental, o item "Documento de identificação oficial
  com foto" do candidato 6452621 (vaga 180231, edital 93/2026) mostrava DOIS
  arquivos. O candidato respondeu o questionário duas vezes (o questionário da
  vaga foi retificado e a Empregare abriu uma resposta nova): 7995988 (25
  perguntas, 6 anexos) e 8019889 (27 perguntas, 7 anexos), as duas com a
  Ordem 4 e a mesma coluna do Excel no documento. obter_ficha_analise devolvia
  os anexos de TODAS as respostas, e a tela juntava os da mesma coluna. Em
  09/10/2026: 223 de 4.889 candidatos com 2 respostas.

  A RESPOSTA VIGENTE
    É a de maior CO_RESPOSTA_QUESTIONARIO (numérico). O JSON de
    GetRespostaDetails não traz data de envio (sucesso, questionario: {id,
    totalPerguntas, respostas: [{PerguntaID, Ordem, Pergunta, TipoResposta,
    Resposta, RespostaID, AlternativaID}]}); o id da Empregare é sequencial.
    É a mesma que a exportação (Excel, DS_COLUNA_ORIGINAL) traz: conferido nas
    223 — a coluna "Pergunta N" é a do questionário mais novo; quem não
    respondeu o novo (42, resposta com 0 perguntas) tem "--" no Excel. Por
    isso a vigente é a de maior id mesmo vazia: os arquivos da ficha batem com
    as respostas que ela mostra, e os antigos ficam nos envios anteriores.

  POR QUE CALCULAR NA LEITURA (e não uma coluna ST_VIGENTE)
    A regra é função só dos ids gravados. Uma coluna teria de ser recalculada
    por candidato a cada gravação — e o robô grava em lotes de 500 e, com o
    tempo esgotado, deixa respostas do mesmo candidato para a execução seguinte
    — além de exigir carga inicial. Lida, é uma busca pelo índice da
    UK_EMPREGRESP_CANDRESPOSTA (candidato, resposta), para um candidato por vez,
    e não tem como ficar defasada.

  O QUE ENTRA
    FC_RESPOSTA_VIGENTE_EMPREGARE   a resposta vigente de um candidato (privada)
    obter_ficha_analise             empregare.respostas e empregare.anexos só da
                                    vigente; empregare.envios_anteriores com as
                                    outras (as que têm pergunta lida), cada uma
                                    com os arquivos, da mais nova para a mais
                                    antiga. O resto igual a 20261009190000.

  O Python (sugestoes_da_ficha.py, perguntas_da_carga.py) lê o Excel
  (DS_COLUNA_ORIGINAL), uma linha por candidato, que já é a vigente: não muda.

  PRÉ-REQUISITO: 20261009190000_sugestoes_da_ficha.sql.

  Ensaio: supabase/ensaios/20261009210000_ficha_com_a_resposta_vigente.sql
  Rollback: supabase/rollback/20261009210000_ficha_com_a_resposta_vigente.sql
*/
begin;

set local lock_timeout = '10s';

-- 0. Pré-requisito ----------------------------------------------------------------------
do $$
begin
  if to_regclass('public."TB_SUGESTAO_FICHA"') is null
     or to_regclass('public."TB_EMPREGARE_RESPOSTA"') is null then
    raise exception 'Aplique antes 20261009190000_sugestoes_da_ficha.sql.';
  end if;
end;
$$;

-- 1. A resposta vigente de um candidato -------------------------------------------------
create function private."FC_RESPOSTA_VIGENTE_EMPREGARE"(p_candidato uuid)
returns uuid
language sql
stable
set search_path to ''
as $function$
  -- A de maior id da Empregare (sequencial; o JSON não traz data de envio).
  select r."CO_EMPREGARE_RESPOSTA"
    from public."TB_EMPREGARE_RESPOSTA" r
   where r."CO_EMPREGARE_CANDIDATO" = p_candidato
   order by r."CO_RESPOSTA_QUESTIONARIO"::numeric desc
   limit 1;
$function$;
comment on function private."FC_RESPOSTA_VIGENTE_EMPREGARE"(uuid) is
  'A resposta vigente do questionário de um candidato (TB_EMPREGARE_RESPOSTA): a de maior CO_RESPOSTA_QUESTIONARIO (numérico; o id da Empregare é sequencial e GetRespostaDetails não traz data de envio). É a que a exportação (Excel) traz. Null sem resposta.';
revoke all on function private."FC_RESPOSTA_VIGENTE_EMPREGARE"(uuid) from public, anon, authenticated;

-- 2. A ficha: só a vigente; as outras em envios_anteriores -----------------------------
create or replace function public.obter_ficha_analise(p_ficha uuid)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_f public."TB_FICHA_ANALISE";
  v_papel text;
  v_uid uuid := (select auth.uid());
  v_regra record;
  v_vigente integer;
  v_m public."TB_MONITORAMENTO_INDIGENA";
  v_envio uuid;
begin
  select * into v_f from public."TB_FICHA_ANALISE" where "CO_FICHA_ANALISE" = p_ficha;
  v_papel := private."FC_EXIGIR_VER_FICHA"(v_f);
  select * into v_regra from private."FC_REGRA_VIGENTE_FICHA"(p_ficha);
  select r."NU_VERSAO_VIGENTE" into v_vigente from public."TB_REGRA_ANALISE" r where r."CO_REGRA_ANALISE" = v_f."CO_REGRA_ANALISE";
  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" where id = v_f."CO_MONITORAMENTO";
  v_envio := private."FC_RESPOSTA_VIGENTE_EMPREGARE"(v_f."CO_EMPREGARE_CANDIDATO");
  return json_build_object(
    'schema_version', 1,
    'gerado_em', now(),
    'edital', json_build_object('id', v_m.id, 'rotulo', private."FC_ROTULO_DO_EDITAL"(v_m.edital), 'area', v_m."CO_AREA"),
    'papel', v_papel,
    'eu', v_uid,
    'pode_editar', v_f."TP_SITUACAO" = 'EM_ANALISE' and v_f."CO_USUARIO_RESERVA" = v_uid and v_f."DT_RESERVA_EXPIRA" > now(),
    'pode_reabrir', v_f."TP_SITUACAO" = 'CONCLUIDA' and coalesce(v_papel, '') = 'COORDENADOR',
    'ficha', (private."FC_FICHA_ANALISE_JSON"(p_ficha)::jsonb || jsonb_build_object(
               'lancamento', v_f."DS_LANCAMENTO", 'resultado', v_f."DS_RESULTADO", 'parecer', v_f."DS_PARECER",
               'tp_resultado', v_f."TP_RESULTADO", 'nota_final', v_f."VL_NOTA_FINAL", 'nota_apurada', v_f."VL_NOTA_APURADA",
               'rascunho_em', v_f."DT_RASCUNHO", 'concluida_em', v_f."DT_CONCLUSAO",
               'concluida_por', (select coalesce(u.nome, u.email) from public."TB_PERFIL_USUARIO" u where u.user_id = v_f."CO_USUARIO_CONCLUSAO"))),
    'regra', json_build_object('versao', v_regra.p_versao, 'vigente', v_vigente, 'situacao', v_regra.p_situacao,
                               'configuracao', v_regra.p_configuracao),
    'documental', private."FC_DOCUMENTAL_DO_EDITAL"(v_f."CO_MONITORAMENTO"),
    'declarada_gravada', (select json_build_object('total', p."VL_NOTA_DECLARADA", 'parciais', p."DS_NOTA_DECLARADA" -> 'parciais',
                                                   'art', p."VL_ART", 'divergente', p."ST_DIVERGENTE" = 'S')
                            from public."TB_PRE_CLASSIFICACAO" p
                           where p."CO_MONITORAMENTO" = v_f."CO_MONITORAMENTO" and p."CO_EMPREGARE_CANDIDATO" = v_f."CO_EMPREGARE_CANDIDATO"),
    'respostas', private."FC_RESPOSTAS_DA_FICHA"(v_f."CO_EMPREGARE_CANDIDATO", v_regra.p_configuracao),
    -- As linhas que as respostas do candidato já dão (job Python, 20261009190000): a tela só exibe.
    'sugestoes', coalesce((select s."DS_SUGESTAO" from public."TB_SUGESTAO_FICHA" s
                            where s."CO_MONITORAMENTO" = v_f."CO_MONITORAMENTO"
                              and s."CO_EMPREGARE_CANDIDATO" = v_f."CO_EMPREGARE_CANDIDATO"), '{}'::jsonb),
    -- Links da Empregare (dado restrito, só aqui): o do candidato, o das candidaturas, os da resposta vigente
    -- do questionário e dos anexos dela (20261009210000) e, à parte, os dos envios anteriores.
    'empregare', (select json_build_object(
                           'link_candidato', c."DS_LINK_DETALHE",
                           'capturado_em', c."DT_CAPTURA_LINK",
                           'vaga_interno', ev."CO_VAGA_INTERNO",
                           'link_vaga', case when ev."CO_VAGA_INTERNO" is not null
                                             then 'https://corporate.empregare.com/empresa/vagas/candidaturas/' || ev."CO_VAGA_INTERNO" end,
                           'respostas', coalesce((
                             select json_agg(json_build_object('resposta', r."CO_RESPOSTA_QUESTIONARIO",
                                                               'link_impressao', r."DS_LINK_IMPRESSAO",
                                                               'perguntas', r."QT_PERGUNTA", 'anexos', r."QT_ANEXO",
                                                               'capturado_em', r."DT_CAPTURA")
                                             order by r."CO_RESPOSTA_QUESTIONARIO")
                               from public."TB_EMPREGARE_RESPOSTA" r
                              where r."CO_EMPREGARE_RESPOSTA" = v_envio), '[]'::json),
                           'anexos', coalesce((
                             select json_agg(json_build_object('resposta', r."CO_RESPOSTA_QUESTIONARIO",
                                                               'pergunta', a."CO_PERGUNTA_EMPREGARE",
                                                               'arquivo', a."NU_ARQUIVO", 'ordem', a."NU_ORDEM",
                                                               'enunciado', a."DS_ENUNCIADO",
                                                               'coluna', a."DS_COLUNA", 'tipo', a."TP_LINK",
                                                               'link', a."DS_LINK")
                                             order by r."CO_RESPOSTA_QUESTIONARIO", a."CO_PERGUNTA_EMPREGARE", a."NU_ARQUIVO")
                               from public."TB_EMPREGARE_ANEXO" a
                               join public."TB_EMPREGARE_RESPOSTA" r on r."CO_EMPREGARE_RESPOSTA" = a."CO_EMPREGARE_RESPOSTA"
                              where r."CO_EMPREGARE_RESPOSTA" = v_envio), '[]'::json),
                           -- As outras respostas com alguma pergunta lida, da mais nova para a mais antiga.
                           'envios_anteriores', coalesce((
                             select json_agg(json_build_object('resposta', r."CO_RESPOSTA_QUESTIONARIO",
                                                               'link_impressao', r."DS_LINK_IMPRESSAO",
                                                               'perguntas', r."QT_PERGUNTA",
                                                               'capturado_em', r."DT_CAPTURA",
                                                               'arquivos', coalesce((
                                                                 select json_agg(json_build_object('pergunta', a."CO_PERGUNTA_EMPREGARE",
                                                                                                   'arquivo', a."NU_ARQUIVO", 'ordem', a."NU_ORDEM",
                                                                                                   'enunciado', a."DS_ENUNCIADO",
                                                                                                   'coluna', a."DS_COLUNA", 'tipo', a."TP_LINK",
                                                                                                   'link', a."DS_LINK")
                                                                                 order by a."NU_ORDEM" nulls last, a."CO_PERGUNTA_EMPREGARE", a."NU_ARQUIVO")
                                                                   from public."TB_EMPREGARE_ANEXO" a
                                                                  where a."CO_EMPREGARE_RESPOSTA" = r."CO_EMPREGARE_RESPOSTA"), '[]'::json))
                                             order by r."CO_RESPOSTA_QUESTIONARIO"::numeric desc)
                               from public."TB_EMPREGARE_RESPOSTA" r
                              where r."CO_EMPREGARE_CANDIDATO" = c."CO_EMPREGARE_CANDIDATO"
                                and r."CO_EMPREGARE_RESPOSTA" is distinct from v_envio
                                and r."QT_PERGUNTA" > 0), '[]'::json))
                    from public."TB_EMPREGARE_CANDIDATO" c
                    left join public."TB_EMPREGARE_VAGA" ev on ev."CO_VAGA" = c."CO_VAGA"
                   where c."CO_EMPREGARE_CANDIDATO" = v_f."CO_EMPREGARE_CANDIDATO"),
    'historico', coalesce((
      select json_agg(json_build_object('versao', h."NU_VERSAO", 'acao', h."TP_ACAO", 'situacao', h."TP_SITUACAO",
                                        'quando', h."DT_REGISTRO", 'por', coalesce(u.nome, u.email), 'motivo', h."DS_MOTIVO",
                                        'resultado', h."TP_RESULTADO", 'nota_final', h."VL_NOTA_FINAL",
                                        'alteracao', h."DS_ALTERACAO")
                      order by h."CO_HISTORICO_FICHA" desc)
        from (select * from public."TH_FICHA_ANALISE" x where x."CO_FICHA_ANALISE" = p_ficha
               order by x."CO_HISTORICO_FICHA" desc limit 200) h
        left join public."TB_PERFIL_USUARIO" u on u.user_id = h."CO_USUARIO"), '[]'::json)
  );
end;
$function$;
comment on function public.obter_ficha_analise(uuid) is
  'A ficha para analisar (json): o cabeçalho (sem CPF nem contato), o lançamento e o resultado gravados, a regra com que é analisada (a vigente; a da conclusão, se concluída — AM-2.3), a nota mínima e os níveis da regra de classificação, a nota declarada e a ART da pré-classificação, as respostas da Empregare SÓ das perguntas que a regra liga, os links da Empregare capturados pelo robô (empregare: link_candidato da página de detalhes, vaga_interno e link_vaga das candidaturas, respostas [{resposta, link_impressao, perguntas, anexos, capturado_em}] e anexos [{resposta, pergunta, arquivo, ordem, enunciado, coluna, tipo, link}] SÓ da resposta vigente do questionário — a de maior id, FC_RESPOSTA_VIGENTE_EMPREGARE — e envios_anteriores [{resposta, link_impressao, perguntas, capturado_em, arquivos: [{pergunta, arquivo, ordem, enunciado, coluna, tipo, link}]}] com as outras, da mais nova para a mais antiga (20261009210000); dado restrito, só aqui), as sugestões de títulos, cursos e vínculos tiradas das respostas pelo job Python (20261009190000), o histórico (até 200, com as alterações) e se quem chama pode editar (reserva vigente, em análise) ou reabrir (coordenação, concluída). Vê: coordenação e revisão; o analista, só nas vagas dele; o leitor, só concluída.';
revoke all on function public.obter_ficha_analise(uuid) from public, anon;
grant execute on function public.obter_ficha_analise(uuid) to authenticated;

commit;
