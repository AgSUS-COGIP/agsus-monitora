/*
  Rollback de 20261016130000_abas_da_coordenacao_no_banco.sql: volta as seis
  funções como estavam no banco novo antes da migration (obter_pre_classificacao,
  obter_situacao_pre_classificacao, obter_equipe_edital e obter_apoio_regra_analise
  de novo para o Leitor; obter_regra_analise inteira para todos;
  listar_editais_avaliacao sem fichas) e os comentários de antes. Nenhuma tabela
  mudou; os GRANTs ficam como estão.
*/

begin;

set local lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.obter_pre_classificacao(p_edital uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_area text := private."FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 1);
  v_m public."TB_MONITORAMENTO_INDIGENA";
  v_papel text := private."FC_PAPEL_AVALIACAO"(p_edital);
  v_classif_editor boolean := private.pode_recurso('classificacao', 2);
begin
  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" where id = p_edital;
  return json_build_object(
    'schema_version', 1,
    'gerado_em', now(),
    'edital', json_build_object('id', v_m.id, 'edital', v_m.edital, 'unidade', v_m.unidade, 'area', v_area,
                                'numero', private."FC_NUMERO_EDITAL"(v_m.edital), 'rotulo', private."FC_ROTULO_DO_EDITAL"(v_m.edital),
                                'treinamento', private."FC_EH_TREINAMENTO"(v_m."ST_TREINAMENTO")),
    'papel', v_papel,
    'pode_coordenar', coalesce(v_papel = 'COORDENADOR', false),
    'pode_registrar_lista', coalesce(v_papel = 'COORDENADOR', false) or coalesce(v_classif_editor, false),
    'pode_publicar_lista', coalesce(v_classif_editor, false),
    'regra', (select json_build_object('versao', r."NU_VERSAO_VIGENTE", 'situacao', r."TP_SITUACAO",
                                       'configuracao', h."DS_CONFIGURACAO")
                from public."TB_REGRA_ANALISE" r
                join public."TH_REGRA_ANALISE" h on h."CO_REGRA_ANALISE" = r."CO_REGRA_ANALISE" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
               where r."CO_MONITORAMENTO" = p_edital),
    'regra_classificacao', (select json_build_object('versao', r."NU_VERSAO_VIGENTE", 'configuracao', h."DS_CONFIGURACAO")
                              from public."TB_REGRA_CLASSIFICACAO" r
                              join public."TH_REGRA_CLASSIFICACAO" h
                                on h."CO_REGRA_CLASSIFICACAO" = r."CO_REGRA_CLASSIFICACAO" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
                             where r."CO_MONITORAMENTO" = p_edital),
    'em_andamento', exists (select 1 from public."TL_PRE_CLASSIFICACAO" t
                             where t."TP_SITUACAO" = 'EM_ANDAMENTO' and t."DT_INICIO" > now() - interval '1 hour'),
    'ultima_execucao', (
      select json_build_object('id', t."CO_EXECUCAO", 'inicio', t."DT_INICIO", 'fim', t."DT_FIM", 'situacao', t."TP_SITUACAO",
                               'disparo', t."TP_DISPARO", 'refazer', t."ST_REFAZER_LOTE" = 'S', 'mensagem', t."DS_MENSAGEM",
                               'execucao', t."DS_URL_EXECUCAO",
                               'edital', (select e from jsonb_array_elements(t."DS_EDITAL") e where e ->> 'edital' = p_edital::text limit 1))
        from public."TL_PRE_CLASSIFICACAO" t
       where t."DS_EDITAL" @> jsonb_build_array(jsonb_build_object('edital', p_edital::text))
       order by t."DT_INICIO" desc limit 1),
    'vagas', coalesce((
      select json_agg(json_build_object(
               'codigo', v."CO_VAGA",
               'candidatos_empregare', v."QT_CANDIDATO_ATIVO",
               'ultima_carga', v."DT_ULTIMA_CARGA",
               'cargo', pv."NO_CARGO", 'lotacao', pv."NO_LOTACAO",
               'vagas_imediatas', pv."QT_VAGA_IMEDIATA", 'cadastro_reserva', pv."ST_CADASTRO_RESERVA" = 'S',
               'inscritos', pv."QT_INSCRITO", 'eliminados', pv."QT_ELIMINADO", 'ranqueados', pv."QT_RANQUEADO",
               'no_lote', pv."QT_LOTE", 'tamanho', pv."QT_TAMANHO_LOTE", 'descricao', pv."DS_TAMANHO_LOTE",
               'por_modalidade', pv."DS_TAMANHO_MODALIDADE", 'art_corte', pv."VL_ART_CORTE",
               'divergencias', pv."QT_DIVERGENCIA", 'sem_art', pv."QT_SEM_ART", 'acima_do_corte', pv."QT_ACIMA_CORTE",
               'ultimo_lote', pv."NU_ULTIMO_LOTE", 'avisos', coalesce(pv."DS_AVISO", '[]'::jsonb),
               -- O lote pela regra e por decisão da coordenação, contados agora.
               'no_lote_regra', (select count(*) from public."TB_PRE_CLASSIFICACAO" a
                                  where a."CO_MONITORAMENTO" = p_edital and a."CO_VAGA" = v."CO_VAGA"
                                    and a."TP_SITUACAO" in ('NO_LOTE', 'ANALISADO') and a."TP_ENTRADA_LOTE" is distinct from 'DECISAO'),
               'no_lote_decisao', (select count(*) from public."TB_PRE_CLASSIFICACAO" a
                                    where a."CO_MONITORAMENTO" = p_edital and a."CO_VAGA" = v."CO_VAGA"
                                      and a."TP_SITUACAO" in ('NO_LOTE', 'ANALISADO') and a."TP_ENTRADA_LOTE" = 'DECISAO'),
               'versao_regra', pv."NU_VERSAO_REGRA", 'atualizado_em', pv."DT_ATUALIZACAO")
             order by v."CO_VAGA")
        from public."TB_EMPREGARE_VAGA" v
        left join public."TB_PRE_CLASSIF_VAGA" pv on pv."CO_MONITORAMENTO" = p_edital and pv."CO_VAGA" = v."CO_VAGA"
       where v."CO_MONITORAMENTO" = p_edital), '[]'::json),
    'candidatos', coalesce((
      select json_agg(json_build_object(
               'id', a."CO_EMPREGARE_CANDIDATO", 'vaga', a."CO_VAGA",
               'codigo', c."CO_CANDIDATO_EMPREGARE", 'nome', c."NO_CANDIDATO",
               'situacao', a."TP_SITUACAO", 'motivo_codigo', a."CO_MOTIVO_ELIMINACAO", 'motivo', a."DS_MOTIVO_ELIMINACAO",
               'art', a."VL_ART", 'nota', a."VL_NOTA_ORDEM", 'origem_nota', a."TP_ORIGEM_NOTA",
               'declarada', a."VL_NOTA_DECLARADA", 'divergente', a."ST_DIVERGENTE" = 'S', 'modalidade', a."NO_MODALIDADE",
               'declarada_completa', (a."DS_NOTA_DECLARADA" ->> 'completa')::boolean,
               'declarada_congelada', a."VL_DECLARADA_CONGELADA", 'congelada_em', a."DT_CONGELAMENTO_DECLARADA",
               'posicao', a."NU_POSICAO", 'posicao_modalidade', a."NU_POSICAO_MODALIDADE",
               'lote', a."NU_LOTE", 'lista_lote', a."CO_LISTA_LOTE", 'entrada', a."TP_ENTRADA_LOTE",
               'motivo_entrada', a."DS_MOTIVO_ENTRADA", 'entrada_em', a."DT_ENTRADA_LOTE",
               'decisao', case when d."CO_DECISAO_LOTE" is not null then json_build_object(
                 'motivo', d."DS_MOTIVO", 'por', coalesce(ud.nome, ud.email), 'em', d."DT_DECISAO",
                 'situacao_regra', d."TP_SITUACAO_REGRA", 'motivo_regra', d."DS_MOTIVO_ELIMINACAO_REGRA") end)
             order by a."CO_VAGA", a."TP_SITUACAO" = 'ELIMINADO', a."NU_POSICAO", c."CO_CANDIDATO_EMPREGARE")
        from public."TB_PRE_CLASSIFICACAO" a
        join public."TB_EMPREGARE_CANDIDATO" c on c."CO_EMPREGARE_CANDIDATO" = a."CO_EMPREGARE_CANDIDATO"
        left join public."TB_DECISAO_LOTE" d
          on d."CO_MONITORAMENTO" = a."CO_MONITORAMENTO" and d."CO_EMPREGARE_CANDIDATO" = a."CO_EMPREGARE_CANDIDATO" and d."ST_ATIVO" = 'S'
        left join public."TB_PERFIL_USUARIO" ud on ud.user_id = d."CO_USUARIO_DECISAO"
       where a."CO_MONITORAMENTO" = p_edital), '[]'::json),
    'listas', coalesce((
      select json_agg(json_build_object('meta', private."FC_LISTA_CLASSIFICACAO_JSON"(l."CO_LISTA_CLASSIFICACAO"),
                                        'lote', l."DS_RESULTADO" -> 'lote')
             order by l."DT_GERACAO" desc)
        from public."TB_LISTA_CLASSIFICACAO" l
       where l."CO_MONITORAMENTO" = p_edital and l."TP_LISTA" in ('PROVISORIA', 'LOTE')), '[]'::json)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.obter_situacao_pre_classificacao(p_edital uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_area text := private."FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 1);
begin
  -- As mesmas chaves (e o mesmo cálculo) de obter_pre_classificacao.
  return json_build_object(
    'em_andamento', exists (select 1 from public."TL_PRE_CLASSIFICACAO" t
                             where t."TP_SITUACAO" = 'EM_ANDAMENTO' and t."DT_INICIO" > now() - interval '1 hour'),
    'ultima_execucao', (
      select json_build_object('id', t."CO_EXECUCAO", 'inicio', t."DT_INICIO", 'fim', t."DT_FIM", 'situacao', t."TP_SITUACAO",
                               'disparo', t."TP_DISPARO", 'refazer', t."ST_REFAZER_LOTE" = 'S', 'mensagem', t."DS_MENSAGEM",
                               'execucao', t."DS_URL_EXECUCAO")
        from public."TL_PRE_CLASSIFICACAO" t
       where t."DS_EDITAL" @> jsonb_build_array(jsonb_build_object('edital', p_edital::text))
       order by t."DT_INICIO" desc limit 1));
end;
$function$;

CREATE OR REPLACE FUNCTION public.obter_equipe_edital(p_edital uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_area text := private."FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 1);
  v_coordena boolean := coalesce(private."FC_PAPEL_AVALIACAO"(p_edital) = 'COORDENADOR', false);
  v_numero text;
begin
  select private."FC_NUMERO_EDITAL"(m.edital) into v_numero from public."TB_MONITORAMENTO_INDIGENA" m where m.id = p_edital;
  return json_build_object(
    'papel', private."FC_PAPEL_AVALIACAO"(p_edital),
    'pode_coordenar', v_coordena,
    'gestores', coalesce((
      select json_agg(json_build_object('usuario', u.user_id, 'nome', coalesce(u.nome, u.email),
                                        'email', case when v_coordena then u.email end)
             order by coalesce(u.nome, u.email))
        from public."TB_PERFIL_USUARIO" u
       where u.ativo and u.user_id is not null and private."FC_GESTOR_DO_EDITAL"(u.id, p_edital)), '[]'::json),
    'equipe', coalesce((
      select json_agg(json_build_object(
               'id', r."CO_ANALISTA_EDITAL", 'usuario', r."CO_USUARIO", 'nome', coalesce(u.nome, u.email, 'Conta removida'),
               'email', case when v_coordena then u.email end, 'papel', r."TP_PAPEL", 'vaga', r."CO_VAGA",
               'limite', r."QT_LIMITE_FICHA", 'desde', r."DT_CRIACAO",
               'nivel', case when u.id is null then 0 else private."FC_NIVEL_AVALIACAO_DO_PERFIL"(u.id) end,
               'ativo_no_sistema', coalesce(u.ativo, false))
             order by r."TP_PAPEL", coalesce(u.nome, u.email), r."CO_VAGA" nulls first)
        from public."RL_ANALISTA_EDITAL" r
        left join public."TB_PERFIL_USUARIO" u on u.user_id = r."CO_USUARIO"
       where r."CO_MONITORAMENTO" = p_edital and r."ST_ATIVO" = 'S'), '[]'::json),
    -- Quem pode entrar na equipe: só para a coordenação.
    'pessoas', case when v_coordena then coalesce((
      select json_agg(json_build_object('usuario', u.user_id, 'nome', coalesce(u.nome, u.email), 'email', u.email,
                                        'nivel', private."FC_NIVEL_AVALIACAO_DO_PERFIL"(u.id),
                                        'gestor', private."FC_GESTOR_DO_EDITAL"(u.id, p_edital))
             order by coalesce(u.nome, u.email))
        from public."TB_PERFIL_USUARIO" u
       where u.ativo and u.user_id is not null
         and private."FC_NIVEL_AVALIACAO_DO_PERFIL"(u.id) >= 2
         and private."FC_PERFIL_VE_EDITAL"(u.id, p_edital)), '[]'::json) else '[]'::json end,
    'vagas', coalesce((
      select json_agg(x.vaga order by x.vaga)
        from (select s."CO_VAGA" as vaga from public."TB_SELECAO_VAGA" s
               where s."CO_MONITORAMENTO" = p_edital and s."CO_VAGA" ~ '^[0-9]{1,20}$'
              union
              select v."CO_VAGA" from public."TB_EMPREGARE_VAGA" v where v."CO_MONITORAMENTO" = p_edital
              union
              select a.codigo_vaga from public."TB_ANALISE_CURRICULAR" a
               where a."CO_AREA" = v_area and a.ativo and a.codigo_vaga ~ '^[0-9]{1,20}$'
                 and private."FC_NUMERO_EDITAL"(a.edital) = v_numero) x), '[]'::json)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.obter_apoio_regra_analise(p_edital uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$

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

               -- O cargo da vaga: a Seleção, a pré-classificação ou, sem elas, o nome

               -- do arquivo da carga da Empregare ("Candidatos da vaga N - <cargo> em Excel").

               'cargo', coalesce(

                 (select s."NO_CARGO" from public."TB_SELECAO_VAGA" s

                   where s."CO_VAGA" = v."CO_VAGA" and s."NO_CARGO" is not null

                   order by s."CO_MONITORAMENTO" = p_edital desc limit 1),

                 (select pv."NO_CARGO" from public."TB_PRE_CLASSIF_VAGA" pv

                   where pv."CO_MONITORAMENTO" = p_edital and pv."CO_VAGA" = v."CO_VAGA" and pv."NO_CARGO" is not null),

                 nullif(btrim(substring(v."NO_ARQUIVO" from '^Candidatos da vaga [0-9]+ - (.+) em Excel')), '')),

               'colunas', coalesce((

                 select json_agg(c.coluna order by c.ordem)

                   from jsonb_array_elements_text(v."DS_COLUNA") with ordinality c(coluna, ordem)

                  where c.coluna ilike 'Pergunta %'), '[]'::json))

             order by v."CO_VAGA")

        from public."TB_EMPREGARE_VAGA" v

       where v."CO_MONITORAMENTO" = p_edital and v."TP_SITUACAO" = 'GRAVADA'), '[]'::json),

    -- Os cargos do quadro de vagas do edital (as diferenças por cargo, 20261013130000).

    'cargos_do_quadro', coalesce((

      select json_agg(q."NO_CARGO" order by q.ordem)

        from (select qv."NO_CARGO", min(qv."NU_ORDEM") as ordem

                from public."TB_QUADRO_VAGA_EDITAL" qv

               where qv."CO_MONITORAMENTO" = p_edital and qv."ST_REGISTRO_ATIVO" = 'S'

               group by qv."NO_CARGO") q), '[]'::json),

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

CREATE OR REPLACE FUNCTION public.obter_regra_analise(p_edital uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_area text := private."FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 1);
  v_m public."TB_MONITORAMENTO_INDIGENA";
  v_papel text := private."FC_PAPEL_AVALIACAO"(p_edital);
  v_coordena boolean := coalesce(v_papel = 'COORDENADOR', false);
  v_vagas integer;
begin
  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" where id = p_edital;
  select count(*) into v_vagas
    from public."TB_EMPREGARE_VAGA" v
   where v."CO_MONITORAMENTO" = p_edital and v."TP_SITUACAO" = 'GRAVADA';

  return json_build_object(
    'schema_version', 1,
    'edital', json_build_object('id', v_m.id, 'edital', v_m.edital, 'unidade', v_m.unidade, 'area', v_area,
                                'numero', private."FC_NUMERO_EDITAL"(v_m.edital), 'id_unidade', v_m.id_unidade),
    'papel', v_papel,
    'pode_coordenar', v_coordena,
    'origem', coalesce((select o."TP_ORIGEM" from public."TB_ORIGEM_ANALISE_EDITAL" o where o."CO_MONITORAMENTO" = p_edital), 'PLANILHA'),
    'regra', private."FC_REGRA_ANALISE_JSON"(p_edital),
    'modelos', coalesce((
      select json_agg(json_build_object('codigo', d."CO_MODELO", 'nome', d."NO_MODELO", 'configuracao', d."DS_CONFIGURACAO")
             order by d."CO_MODELO")
        from public."TB_REGRA_ANALISE_MODELO" d where d."ST_ATIVO" = 'S'), '[]'::json),
    'nota_minima', (
      select json_build_object('nota_minima', h."DS_CONFIGURACAO" #> '{documental,nota_minima}',
                               'nota_minima_por_nivel', coalesce(h."DS_CONFIGURACAO" #> '{documental,nota_minima_por_nivel}', '{}'::jsonb),
                               'versao_regra_classificacao', r."NU_VERSAO_VIGENTE")
        from public."TB_REGRA_CLASSIFICACAO" r
        join public."TH_REGRA_CLASSIFICACAO" h
          on h."CO_REGRA_CLASSIFICACAO" = r."CO_REGRA_CLASSIFICACAO" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
       where r."CO_MONITORAMENTO" = p_edital),
    'aldeias', (
      select json_build_object('quantidade', count(*), 'atualizado_em', max(a."DT_ATUALIZACAO"),
                               'fonte', (array_agg(a."DS_FONTE" order by a."DT_ATUALIZACAO" desc))[1])
        from public."TD_ALDEIA_DSEI" a
       where v_m.id_unidade is not null and a."CO_UNIDADE" = v_m.id_unidade::text and a."ST_ATIVO" = 'S'),
    'pode_carregar_aldeias', private.is_master(),
    'vagas_empregare', v_vagas,
    'fichas_concluidas', 0
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.listar_editais_avaliacao(p_area text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

comment on function public.obter_pre_classificacao(uuid) is
  'A pré-classificação do edital para a aba Pré-classificação (json): regra vigente, regra de classificação (textos do documento), última execução do job que tratou o edital, se há execução em andamento, cada vaga da Empregare com o resumo (quadro, tamanho do lote, linha de corte, divergências, avisos), os inscritos (código, nome, situação, motivo, ART, nota declarada — completa ou não, congelada e quando, desde 20261007170000 —, posição, lote e motivo da entrada e, desde 20261007200000, a decisão vigente da coordenação: motivo, quem, quando e a situação pela regra; sem CPF nem contato), por vaga quantos estão no lote pela regra e por decisão (desde 20261007200000) e as listas PROVISORIA e LOTE registradas. Exige avaliacao_documental >= leitor, a área e o recorte da coordenação.';

comment on function public.obter_situacao_pre_classificacao(uuid) is
  'Só em_andamento e ultima_execucao da pré-classificação do edital (as chaves de obter_pre_classificacao, ≈0,4 KB): o acompanhamento do Recalcular pergunta a cada 15 s e relê o pacote só no fim (20261014230000). Leitor da Avaliação documental.';

comment on function public.obter_equipe_edital(uuid) is
  'A equipe da avaliação documental do edital (json): gestores (coordenação automática), as linhas ativas de RL_ANALISTA_EDITAL com o nível de cada pessoa, as vagas do edital e, só para a coordenação, os e-mails e as pessoas que podem entrar (Editor ou mais em avaliacao_documental que veem o edital). Exige avaliacao_documental >= leitor, a área e o recorte da coordenação.';

comment on function public.obter_apoio_regra_analise(uuid) is
  'O que o assistente da regra da avaliação documental lê (json): os nomes das colunas de pergunta da última carga de cada vaga do edital (sem respostas) com o cargo (Seleção, pré-classificação ou o nome do arquivo da carga), os cargos do quadro de vagas (cargos_do_quadro, para as diferenças por cargo, desde 20261013130000), as regras conferidas dos outros editais da área que a pessoa vê (só para a coordenação do edital, para copiar; com o nome da versão) e a regra de classificação vigente (nota mínima, desempate e o nome da versão) para quem lê a Classificação, com pode_editar (Editor na Classificação). Exige avaliacao_documental >= leitor, a área e o recorte da coordenação.';

comment on function public.obter_regra_analise(uuid) is
  'A regra da avaliação documental do edital (json): vigente e versões, modelos para copiar, nota mínima da regra de classificação, aldeias do DSEI do edital, dono da avaliação, papel de quem está logado e quantas vagas da Empregare têm carga. As perguntas da carga saíram para obter_perguntas_carga_analise (20261009180000). fichas_concluidas fica 0 até as fichas da fase F3. Exige avaliacao_documental >= leitor, a área e o recorte da coordenação.';

comment on function public.listar_editais_avaliacao(text) is
  'Editais da área para a Avaliação documental (json): status do edital (a tela mostra só os vigentes, src/lib/avaliacao-documental/editais.js), treinamento, versão, nome da versão e situação da regra, dono da avaliação (PLANILHA, COMPARACAO, MONITORA) e o papel de quem está logado. Exige avaliacao_documental >= leitor, a área e o recorte da coordenação.';

commit;
