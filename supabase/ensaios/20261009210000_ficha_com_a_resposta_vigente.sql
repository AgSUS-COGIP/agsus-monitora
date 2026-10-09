/*
  ENSAIO de 20261009210000_ficha_com_a_resposta_vigente.sql — begin … rollback.

  Como rodar: cole o arquivo inteiro no SQL Editor do Supabase (papel postgres)
  e execute. Ele abre uma transação, aplica o corpo da migration (copiado sem
  mudança, sem o begin/commit dela) e confere:
    E1  FC_RESPOSTA_VIGENTE_EMPREGARE privada e, em todo candidato com 2+
        respostas, a de maior id (numérico) entre as com pergunta lida; quem
        tem a mais nova vazia fica com a anterior respondida;
    E2  a ficha de um candidato com 2+ respostas (o 6452621 da vaga 180231, se
        houver ficha): empregare.respostas com uma só (a vigente), anexos só
        dela e sem pergunta repetida, envios_anteriores com as outras e os
        arquivos de cada uma;
    E3  a ficha de um candidato com uma resposta: envios_anteriores vazio e os
        mesmos anexos de antes;
    E4  a ficha de um candidato com a resposta mais nova vazia (questionário
        retificado não respondido): a vigente é a anterior respondida, e a
        vazia não aparece nos envios anteriores.
  Termina em ROLLBACK: nada fica gravado.
*/
begin;

-- ═══ CORPO DA MIGRATION (início) ═══
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
  -- A mais nova com pergunta lida (id da Empregare sequencial; o JSON não traz data de envio);
  -- a resposta vazia (questionário retificado não respondido) só vale se não houver outra.
  select r."CO_EMPREGARE_RESPOSTA"
    from public."TB_EMPREGARE_RESPOSTA" r
   where r."CO_EMPREGARE_CANDIDATO" = p_candidato
   order by (r."QT_PERGUNTA" > 0) desc, r."CO_RESPOSTA_QUESTIONARIO"::numeric desc
   limit 1;
$function$;
comment on function private."FC_RESPOSTA_VIGENTE_EMPREGARE"(uuid) is
  'A resposta vigente do questionário de um candidato (TB_EMPREGARE_RESPOSTA): a de maior CO_RESPOSTA_QUESTIONARIO (numérico; o id da Empregare é sequencial e GetRespostaDetails não traz data de envio) entre as que têm pergunta lida (QT_PERGUNTA > 0); só se nenhuma tiver, a de maior id. Null sem resposta.';
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
  'A ficha para analisar (json): o cabeçalho (sem CPF nem contato), o lançamento e o resultado gravados, a regra com que é analisada (a vigente; a da conclusão, se concluída — AM-2.3), a nota mínima e os níveis da regra de classificação, a nota declarada e a ART da pré-classificação, as respostas da Empregare SÓ das perguntas que a regra liga, os links da Empregare capturados pelo robô (empregare: link_candidato da página de detalhes, vaga_interno e link_vaga das candidaturas, respostas [{resposta, link_impressao, perguntas, anexos, capturado_em}] e anexos [{resposta, pergunta, arquivo, ordem, enunciado, coluna, tipo, link}] SÓ da resposta vigente do questionário — a mais nova com pergunta lida, FC_RESPOSTA_VIGENTE_EMPREGARE — e envios_anteriores [{resposta, link_impressao, perguntas, capturado_em, arquivos: [{pergunta, arquivo, ordem, enunciado, coluna, tipo, link}]}] com as outras, da mais nova para a mais antiga (20261009210000); dado restrito, só aqui), as sugestões de títulos, cursos e vínculos tiradas das respostas pelo job Python (20261009190000), o histórico (até 200, com as alterações) e se quem chama pode editar (reserva vigente, em análise) ou reabrir (coordenação, concluída). Vê: coordenação e revisão; o analista, só nas vagas dele; o leitor, só concluída.';
revoke all on function public.obter_ficha_analise(uuid) from public, anon;
grant execute on function public.obter_ficha_analise(uuid) to authenticated;
-- ═══ CORPO DA MIGRATION (fim) ═══

-- E1: a vigente é a mais nova com pergunta lida -----------------------------------------
do $$
declare
  v_erradas integer;
  v_com_duas integer;
  v_nova_vazia integer;
begin
  if has_function_privilege('authenticated', 'private."FC_RESPOSTA_VIGENTE_EMPREGARE"(uuid)', 'execute') then
    raise exception 'E1: authenticated executa FC_RESPOSTA_VIGENTE_EMPREGARE';
  end if;
  select count(*), count(*) filter (
           where private."FC_RESPOSTA_VIGENTE_EMPREGARE"(x.cand) is distinct from x.maior
              or (select v."QT_PERGUNTA" from public."TB_EMPREGARE_RESPOSTA" v
                   where v."CO_EMPREGARE_RESPOSTA" = private."FC_RESPOSTA_VIGENTE_EMPREGARE"(x.cand)) = 0 and x.nova_vazia),
         count(*) filter (where x.nova_vazia)
    into v_com_duas, v_erradas, v_nova_vazia
    from (select r."CO_EMPREGARE_CANDIDATO" as cand,
                 (array_agg(r."CO_EMPREGARE_RESPOSTA" order by r."QT_PERGUNTA" = 0, r."CO_RESPOSTA_QUESTIONARIO"::numeric desc))[1] as maior,
                 (array_agg(r."QT_PERGUNTA" order by r."CO_RESPOSTA_QUESTIONARIO"::numeric desc))[1] = 0
                   and max(r."QT_PERGUNTA") > 0 as nova_vazia
            from public."TB_EMPREGARE_RESPOSTA" r
           group by 1 having count(*) > 1) x;
  if v_erradas > 0 then
    raise exception 'E1: % de % candidatos com a vigente errada', v_erradas, v_com_duas;
  end if;
  raise notice 'E1 ok: % candidatos com 2+ respostas, % com a mais nova vazia (ficam com a anterior)', v_com_duas, v_nova_vazia;
end;
$$;

-- Fichas para E2 e E3: lidas como quem coordena (a RPC exige poder ver a ficha).
create temporary table ensaio_ficha on commit drop as
select f."CO_FICHA_ANALISE" as ficha, c."CO_CANDIDATO_EMPREGARE" as codigo,
       x.respostas, x.respondida, x.qt_nova = 0 and x.qt_max > 0 as nova_vazia
  from public."TB_FICHA_ANALISE" f
  join public."TB_EMPREGARE_CANDIDATO" c on c."CO_EMPREGARE_CANDIDATO" = f."CO_EMPREGARE_CANDIDATO"
  cross join lateral (
    select count(*) as respostas,
           (array_agg(r."CO_RESPOSTA_QUESTIONARIO" order by r."QT_PERGUNTA" = 0,
                      r."CO_RESPOSTA_QUESTIONARIO"::numeric desc))[1] as respondida,
           (array_agg(r."QT_PERGUNTA" order by r."CO_RESPOSTA_QUESTIONARIO"::numeric desc))[1] as qt_nova,
           max(r."QT_PERGUNTA") as qt_max
      from public."TB_EMPREGARE_RESPOSTA" r
     where r."CO_EMPREGARE_CANDIDATO" = c."CO_EMPREGARE_CANDIDATO") x;
grant select on ensaio_ficha to authenticated;
grant usage on schema private to authenticated;
grant execute on all functions in schema private to authenticated;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a01afddb-f64b-47d9-80e8-476a1ed14e43","role":"authenticated"}', true);

-- E2: candidato com 2+ respostas ----------------------------------------------------------
do $$
declare
  v_ficha uuid;
  v_e jsonb;
begin
  select e.ficha into v_ficha from ensaio_ficha e
   where e.respostas > 1 order by (e.codigo = '6452621') desc, e.ficha limit 1;
  if v_ficha is null then
    raise notice 'E2 pulado: nenhuma ficha de candidato com 2+ respostas';
    return;
  end if;
  v_e := public.obter_ficha_analise(v_ficha)::jsonb -> 'empregare';
  if jsonb_array_length(v_e -> 'respostas') <> 1 then
    raise exception 'E2: % respostas na ficha (esperava a vigente)', jsonb_array_length(v_e -> 'respostas');
  end if;
  if exists (select 1 from jsonb_array_elements(v_e -> 'anexos') a
              where a ->> 'resposta' <> v_e -> 'respostas' -> 0 ->> 'resposta') then
    raise exception 'E2: anexo de outra resposta na ficha';
  end if;
  if exists (select 1 from jsonb_array_elements(v_e -> 'anexos') a
              group by a ->> 'coluna', a ->> 'arquivo' having count(*) > 1 and a ->> 'coluna' is not null) then
    raise exception 'E2: arquivo repetido na mesma coluna';
  end if;
  if exists (select 1 from jsonb_array_elements(v_e -> 'envios_anteriores') x
              where (x ->> 'resposta')::numeric >= (v_e -> 'respostas' -> 0 ->> 'resposta')::numeric) then
    raise exception 'E2: envio anterior mais novo que a vigente';
  end if;
  if exists (select 1 from jsonb_array_elements(v_e -> 'envios_anteriores') x where (x ->> 'perguntas')::int = 0) then
    raise exception 'E2: envio vazio nos anteriores';
  end if;
  raise notice 'E2 ok';
end;
$$;

-- E3: candidato com uma resposta ----------------------------------------------------------
do $$
declare
  v_ficha uuid;
  v_e jsonb;
begin
  select e.ficha into v_ficha from ensaio_ficha e where e.respostas = 1 order by e.ficha limit 1;
  if v_ficha is null then
    raise notice 'E3 pulado: nenhuma ficha de candidato com uma resposta';
    return;
  end if;
  v_e := public.obter_ficha_analise(v_ficha)::jsonb -> 'empregare';
  if jsonb_array_length(v_e -> 'respostas') <> 1 or jsonb_array_length(v_e -> 'envios_anteriores') <> 0 then
    raise exception 'E3: % respostas e % envios anteriores', jsonb_array_length(v_e -> 'respostas'),
      jsonb_array_length(v_e -> 'envios_anteriores');
  end if;
  raise notice 'E3 ok';
end;
$$;

-- E4: candidato com a resposta mais nova vazia: a vigente é a anterior respondida, sem envios anteriores vazios
do $$
declare
  v_ficha uuid;
  v_e jsonb;
  v_respondida text;
begin
  select e.ficha, e.respondida into v_ficha, v_respondida
    from ensaio_ficha e
   where e.respostas > 1 and e.nova_vazia
   order by e.ficha limit 1;
  if v_ficha is null then
    raise notice 'E4 pulado: nenhuma ficha de candidato com a resposta mais nova vazia';
    return;
  end if;
  v_e := public.obter_ficha_analise(v_ficha)::jsonb -> 'empregare';
  if v_e -> 'respostas' -> 0 ->> 'resposta' is distinct from v_respondida
     or (v_e -> 'respostas' -> 0 ->> 'perguntas')::int = 0 then
    raise exception 'E4: vigente % (esperava a respondida %)', v_e -> 'respostas' -> 0 ->> 'resposta', v_respondida;
  end if;
  if exists (select 1 from jsonb_array_elements(v_e -> 'envios_anteriores') x where (x ->> 'perguntas')::int = 0) then
    raise exception 'E4: a resposta vazia aparece nos envios anteriores';
  end if;
  raise notice 'E4 ok';
end;
$$;

-- O que a tela recebe do 6452621 (vaga 180231): o item de identidade e os envios anteriores (sem os links).
select e.codigo,
       (select count(*) from jsonb_array_elements(x -> 'empregare' -> 'anexos') a
         where a ->> 'ordem' = '4') as arquivos_no_item_de_identidade,
       x -> 'empregare' -> 'respostas' -> 0 ->> 'resposta' as resposta_vigente,
       (select jsonb_agg(jsonb_build_object('resposta', p ->> 'resposta', 'perguntas', p -> 'perguntas',
                                            'arquivos', jsonb_array_length(p -> 'arquivos'),
                                            'identidade', (select count(*) from jsonb_array_elements(p -> 'arquivos') a
                                                            where a ->> 'ordem' = '4')))
          from jsonb_array_elements(x -> 'empregare' -> 'envios_anteriores') p) as envios_anteriores
  from ensaio_ficha e
  cross join lateral (select public.obter_ficha_analise(e.ficha)::jsonb as x) f
 where e.codigo = '6452621';

rollback;
