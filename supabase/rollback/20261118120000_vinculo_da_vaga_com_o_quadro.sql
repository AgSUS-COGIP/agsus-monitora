/*
  ROLLBACK de 20261118120000_vinculo_da_vaga_com_o_quadro.sql

  Volta as cinco funções trocadas ao corpo e ao comentário de antes, copiados letra por letra do
  retrato de produção (supabase/esquema-atual.sql de 17/11/2026), tira a tarefa
  agsus_vinculos_do_quadro do pg_cron e do catálogo e apaga as funções e as tabelas novas.

  O QUE FICA PERDIDO: os vínculos confirmados pela equipe (TA_VAGA_QUADRO_EDITAL) e o histórico
  (TH_VAGA_QUADRO_EDITAL). Se já houver vínculo MANUAL, a guarda para: exporte antes
  (select * from public."TA_VAGA_QUADRO_EDITAL" where "TP_ORIGEM" = 'MANUAL') e rode de novo com
  set_config('agsus.rollback_perde_manuais', 'sim', true) na mesma transação.
*/
begin;

set local lock_timeout = '5s';

do $$
begin
  if to_regclass('public."TA_VAGA_QUADRO_EDITAL"') is null then
    raise exception 'A migration 20261118120000 não está aplicada (TA_VAGA_QUADRO_EDITAL não existe).';
  end if;
  if exists (select 1 from public."TA_VAGA_QUADRO_EDITAL" where "TP_ORIGEM" = 'MANUAL')
     and coalesce(current_setting('agsus.rollback_perde_manuais', true), '') <> 'sim' then
    raise exception 'Há vínculos decididos pela equipe (MANUAL): exporte-os e confirme a perda (veja o cabeçalho).';
  end if;
end
$$;

-- 1. As funções de antes (corpo e comentário).
CREATE OR REPLACE FUNCTION private."FC_DADOS_CLASSIFICACAO_EDITAL"(p_edital uuid, p_area text) RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_area text := p_area;
  v_m public."TB_MONITORAMENTO_INDIGENA";
  v_numero text;
begin
  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" where id = p_edital;
  v_numero := private."FC_NUMERO_EDITAL"(v_m.edital);
  return json_build_object(
    'schema_version', 1,
    'gerado_em', now(),
    'edital', json_build_object('id', v_m.id, 'edital', v_m.edital, 'unidade', v_m.unidade, 'area', v_area, 'numero', v_numero,
                               'treinamento', private."FC_EH_TREINAMENTO"(v_m."ST_TREINAMENTO")),
    'pode_editar', private.pode_recurso('classificacao', 2),
    'regra', private."FC_REGRA_CLASSIFICACAO_JSON"(p_edital),
    'catalogo', (
      select json_agg(json_build_object('codigo', k."CO_CRITERIO", 'nome', k."NO_CRITERIO", 'tipo', k."TP_VALOR",
               'direcao', k."TP_DIRECAO_PADRAO", 'ativo', k."ST_ATIVO" = 'S') order by k."NU_ORDEM")
        from public."TB_CRITERIO_CLASSIFICACAO" k),
    'cronograma', coalesce((
      select json_agg(json_build_object('ordem', c.ordem, 'atividade', c.atividade, 'inicio', c.data_inicio, 'fim', c.data_fim)
             order by c.ordem)
        from public."TB_CRONOGRAMA_MONIT_INDIG" c where c.monitoramento_id = p_edital), '[]'::json),
    'quadro', coalesce((
      select json_agg(json_build_object('id', q."CO_QUADRO_VAGA", 'ordem', q."NU_ORDEM", 'cargo', q."NO_CARGO",
               'lotacao', q."NO_LOTACAO", 'modalidades', q."DS_MODALIDADE_VAGA", 'vagas_imediatas', q."QT_VAGA_IMEDIATA",
               'cadastro_reserva', q."ST_CADASTRO_RESERVA" = 'S') order by q."NU_ORDEM")
        from public."TB_QUADRO_VAGA_EDITAL" q
       where q."CO_MONITORAMENTO" = p_edital and q."ST_REGISTRO_ATIVO" = 'S'), '[]'::json),
    'candidatos', coalesce((
      with a as (
        select a.* from public."TB_ANALISE_CURRICULAR" a
         where a."CO_AREA" = v_area and a.ativo and private."FC_NUMERO_EDITAL"(a.edital) = v_numero
      ),
      vq as (
        select n.nome_vaga, private."FC_QUADRO_DA_VAGA"(p_edital, n.nome_vaga) as quadro
          from (select distinct a.nome_vaga from a) n
      )
      select json_agg(json_build_object(
               'analise_id', a.id, 'codigo', a.id_origem, 'nome', a.candidato, 'vaga', a.codigo_vaga,
               'cargo', a.nome_vaga, 'categoria', a.categoria, 'modalidade', a.modalidade_concorrencia, 'pcd', a.pcd,
               'data_nascimento', a.data_nascimento, 'nota_documental', a.nota_final_ajustada, 'nota_art', a.nota_empregare,
               'pontuacao_formacao', a.pontuacao_escolaridade, 'pontuacao_cursos', a.pontuacao_cursos_aperfeicoamento,
               'pontuacao_experiencia', a.pontuacao_experiencia_profissional, 'pontuacao_etnica', a.pontuacao_criterio_etnico,
               'exp_saude_indigena', a.experiencia_saude_indigena_total, 'exp_atencao_basica', a.experiencia_atencao_basica_total,
               'exp_profissional', a.experiencia_profissional_total, 'status', a.status_consolidado, 'etapa', a.etapa,
               'quadro', vq.quadro, 'hora_nascimento', to_char(h."HR_NASCIMENTO", 'HH24:MI:SS'))
             order by a.codigo_vaga, a.candidato)
        from a left join vq on vq.nome_vaga is not distinct from a.nome_vaga
               left join public."TB_HORA_NASCIMENTO_CANDIDATO" h on h."CO_ANALISE_CURRICULAR" = a.id), '[]'::json),
    'entrevistas', coalesce((
      select json_agg(json_build_object(
               'id', e."CO_ENTREVISTA", 'analise_id', e."CO_ANALISE_CURRICULAR", 'nome', e."NO_CANDIDATO",
               'vaga', e."CO_VAGA", 'nota', e."VL_NOTA_TOTAL", 'parecer', e."TP_PARECER", 'compareceu', e."ST_COMPARECEU",
               'ligacao', e."TP_LIGACAO_ANALISE", 'origem', e."TP_ORIGEM",
               'notas', coalesce((select json_agg(json_build_object('ordem', n."NU_ORDEM", 'criterio', n."DS_CRITERIO", 'nota', n."VL_NOTA")
                                         order by n."NU_ORDEM")
                                    from public."TB_ENTREVISTA_NOTA" n where n."CO_ENTREVISTA" = e."CO_ENTREVISTA"), '[]'::json))
             order by e."CO_VAGA", e."NO_CANDIDATO")
        from public."TB_ENTREVISTA" e
       where e."ST_ATIVO" = 'S'
         and (e."CO_MONITORAMENTO" = p_edital
              or (e."CO_MONITORAMENTO" is null and e."CO_AREA" = v_area
                  and private."FC_NUMERO_EDITAL"(e."DS_EDITAL") = v_numero))), '[]'::json),
    'listas', coalesce((
      select json_agg(private."FC_LISTA_CLASSIFICACAO_JSON"(l."CO_LISTA_CLASSIFICACAO") order by l."DT_GERACAO" desc)
        from (select l."CO_LISTA_CLASSIFICACAO", l."DT_GERACAO"
                from public."TB_LISTA_CLASSIFICACAO" l
               where l."CO_MONITORAMENTO" = p_edital
               order by l."DT_GERACAO" desc limit 60) l), '[]'::json),
    'desempates', coalesce((
      select json_agg(private."FC_DESEMPATE_CLASSIFICACAO_JSON"(d."CO_DESEMPATE_CLASSIFICACAO") order by d."DT_REGISTRO")
        from public."TB_DESEMPATE_CLASSIFICACAO" d
       where d."CO_MONITORAMENTO" = p_edital and d."ST_ATIVO" = 'S'), '[]'::json),
    'ajustes', coalesce((
      select json_agg(private."FC_AJUSTE_PONTUACAO_JSON"(j."CO_AJUSTE_PONTUACAO") order by j."DT_APROVACAO", j."CO_AJUSTE_PONTUACAO")
        from public."TB_AJUSTE_PONTUACAO_RECURSO" j
       where j."CO_MONITORAMENTO" = p_edital and j."TP_SITUACAO" = 'APROVADO'), '[]'::json),
    'ajustes_mudaram_em', (
      select greatest(max(j."DT_APROVACAO"), max(j."DT_CANCELAMENTO") filter (where j."DT_APROVACAO" is not null))
        from public."TB_AJUSTE_PONTUACAO_RECURSO" j
       where j."CO_MONITORAMENTO" = p_edital)
  );
end;
$$;

COMMENT ON FUNCTION private."FC_DADOS_CLASSIFICACAO_EDITAL"(p_edital uuid, p_area text) IS 'O que o motor de classificação precisa de um edital (json), sem conferir permissão: regra e versões, catálogo, cronograma, quadro, análises (sem CPF, com a hora de nascimento da certidão quando informada), entrevistas, listas, desempates, os ajustes da pontuação aprovados em recurso e quando eles mudaram por último. Usada por obter_classificacao_do_edital e obter_dados_previa_ajuste.';

CREATE OR REPLACE FUNCTION private."FC_QUADRO_DA_VAGA_EMPREGARE"(p_edital uuid, p_vaga text) RETURNS public."TB_QUADRO_VAGA_EDITAL"
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  select q.*
    from (select coalesce(
                   (select v.quadro_id
                      from private."FC_EMPREGARE_VAGAS_DO_QUADRO"(p_vaga) v
                      join public."TB_QUADRO_VAGA_EDITAL" l
                        on l."CO_QUADRO_VAGA" = v.quadro_id and l."CO_MONITORAMENTO" = p_edital and l."ST_REGISTRO_ATIVO" = 'S'
                     where v.edital_id = p_edital
                     limit 1),
                   private."FC_QUADRO_PELO_TITULO_EMPREGARE"(p_edital, p_vaga)) as id) x
    join public."TB_QUADRO_VAGA_EDITAL" q
      on q."CO_QUADRO_VAGA" = x.id and q."CO_MONITORAMENTO" = p_edital and q."ST_REGISTRO_ATIVO" = 'S';
$$;

COMMENT ON FUNCTION private."FC_QUADRO_DA_VAGA_EMPREGARE"(p_edital uuid, p_vaga text) IS 'A linha do quadro de vagas de uma vaga da Empregare no edital: pelo nome_vaga da análise curricular (planilha, FC_EMPREGARE_VAGAS_DO_QUADRO) e, sem ele, pelo título da vaga na Empregare (FC_QUADRO_PELO_TITULO_EMPREGARE, desde 20261013140000). Usada pelo job da pré-classificação (cargo e nível) e pela gravação de cada vaga (NO_CARGO, NO_LOTACAO, quadro).';

CREATE OR REPLACE FUNCTION public.obter_quadro_de_vagas(p_edital uuid) RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_m public."TB_MONITORAMENTO_INDIGENA";
begin
  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" where id = p_edital;
  if v_m.id is null then raise exception 'Edital não encontrado' using errcode = '22023'; end if;
  if not (private.pode_recurso('nucleo', 1) or private.pode_recurso('calendario', 1) or private.pode_recurso('entrevistas', 1)) then
    raise exception 'Sem permissão para este recurso' using errcode = '42501';
  end if;
  perform private."FC_EXIGIR_AREA_EDITAL"(p_edital::text);
  return json_build_object(
    'edital', p_edital,
    'linhas', coalesce((
      select json_agg(json_build_object('id', q."CO_QUADRO_VAGA", 'ordem', q."NU_ORDEM", 'cargo', q."NO_CARGO",
               'lotacao', q."NO_LOTACAO", 'modalidades', q."DS_MODALIDADE_VAGA", 'vagas_imediatas', q."QT_VAGA_IMEDIATA",
               'cadastro_reserva', q."ST_CADASTRO_RESERVA" = 'S') order by q."NU_ORDEM")
        from public."TB_QUADRO_VAGA_EDITAL" q
       where q."CO_MONITORAMENTO" = p_edital and q."ST_REGISTRO_ATIVO" = 'S'), '[]'::json),
    'origem', (select json_build_object('tipo', q."TP_ORIGEM", 'arquivo', q."DS_ARQUIVO_ORIGEM", 'gravado_em', q."DT_CRIACAO")
                 from public."TB_QUADRO_VAGA_EDITAL" q
                where q."CO_MONITORAMENTO" = p_edital and q."ST_REGISTRO_ATIVO" = 'S' limit 1),
    'vinculos', coalesce((
      select json_agg(json_build_object('vaga', v.codigo_vaga, 'cargo', v.cargo,
               'quadro', private."FC_QUADRO_DA_VAGA"(p_edital, v.cargo)) order by v.cargo)
        from (select a.codigo_vaga, min(a.nome_vaga) cargo
                from public."TB_ANALISE_CURRICULAR" a
               where a."CO_AREA" = v_m."CO_AREA" and a.ativo
                 and private."FC_NUMERO_EDITAL"(a.edital) = private."FC_NUMERO_EDITAL"(v_m.edital)
               group by a.codigo_vaga) v), '[]'::json)
  );
end;
$$;

COMMENT ON FUNCTION public.obter_quadro_de_vagas(p_edital uuid) IS 'Quadro de vagas vigente do edital, de onde veio e a que linha cada vaga da análise se liga. Núcleo, Calendário ou Entrevistas (leitor) e o edital.';

CREATE OR REPLACE FUNCTION public.salvar_quadro_de_vagas(p_edital uuid, p_dados jsonb) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_linhas jsonb := coalesce(p_dados -> 'linhas', '[]'::jsonb);
  v_origem text := coalesce(nullif(upper(p_dados ->> 'origem'), ''), 'PDF');
  v_arquivo text := left(nullif(btrim(p_dados ->> 'arquivo'), ''), 300);
begin
  if not exists (select 1 from public."TB_MONITORAMENTO_INDIGENA" where id = p_edital) then
    raise exception 'Edital não encontrado' using errcode = '22023';
  end if;
  if not (private.pode_recurso('nucleo', 2) or private.pode_recurso('calendario', 2)) then
    raise exception 'Sem permissão para este recurso' using errcode = '42501';
  end if;
  perform private."FC_EXIGIR_AREA_EDITAL"(p_edital::text);
  if jsonb_typeof(v_linhas) <> 'array' or jsonb_array_length(v_linhas) > 500 then
    raise exception 'Quadro de vagas inválido (até 500 linhas)' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(v_linhas) l
              where length(btrim(coalesce(l ->> 'cargo', ''))) not between 1 and 300
                 or coalesce(nullif(l ->> 'vagas_imediatas', '')::integer, 0) not between 0 and 9999
                 or jsonb_typeof(coalesce(l -> 'modalidades', '{}'::jsonb)) <> 'object') then
    raise exception 'Há linha do quadro sem cargo ou com quantidade inválida' using errcode = '22023';
  end if;

  update public."TB_QUADRO_VAGA_EDITAL"
     set "ST_REGISTRO_ATIVO" = 'N', "DT_DESATIVACAO" = now()
   where "CO_MONITORAMENTO" = p_edital and "ST_REGISTRO_ATIVO" = 'S';

  insert into public."TB_QUADRO_VAGA_EDITAL" ("CO_MONITORAMENTO", "NU_ORDEM", "NO_CARGO", "NO_LOTACAO", "DS_MODALIDADE_VAGA",
    "QT_VAGA_IMEDIATA", "ST_CADASTRO_RESERVA", "TP_ORIGEM", "DS_ARQUIVO_ORIGEM", "CO_USUARIO_ATUALIZACAO")
  select p_edital, l.ordem, btrim(l.valor ->> 'cargo'), left(nullif(btrim(l.valor ->> 'lotacao'), ''), 300),
         coalesce(l.valor -> 'modalidades', '{}'::jsonb), coalesce(nullif(l.valor ->> 'vagas_imediatas', '')::integer, 0),
         case when (l.valor ->> 'cadastro_reserva')::boolean then 'S' else 'N' end,
         v_origem, v_arquivo, (select auth.uid())
    from jsonb_array_elements(v_linhas) with ordinality l(valor, ordem);

  return public.obter_quadro_de_vagas(p_edital);
end;
$$;

COMMENT ON FUNCTION public.salvar_quadro_de_vagas(p_edital uuid, p_dados jsonb) IS 'Substitui o quadro de vagas do edital (o anterior fica desativado). p_dados: {origem PDF|MANUAL, arquivo, linhas:[{cargo, lotacao, modalidades, vagas_imediatas, cadastro_reserva}]}. Núcleo ou Calendário (editor) e o edital.';

CREATE OR REPLACE FUNCTION public.conferencia_ler_listas_e_quadros() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  -- 20261103181500: a leitura da classificação das conferências sem as análises. A última
  -- atualização das análises e as vagas sem quadro saem das páginas de conferencia_ler_analises,
  -- no robô (scripts/conferencias/regras.py, python/monitora/classificacao/quadro_da_vaga.py).
  with ultimas as (
    select distinct on (l."CO_MONITORAMENTO", l."TP_LISTA")
           l."CO_LISTA_CLASSIFICACAO", l."CO_MONITORAMENTO", l."TP_LISTA", l."DT_GERACAO",
           l."QT_PENDENCIA", l."ST_PUBLICADA", l."DS_RESULTADO"
      from public."TB_LISTA_CLASSIFICACAO" l
     where not private."FC_EDITAL_EH_TREINAMENTO"(l."CO_MONITORAMENTO")
     order by l."CO_MONITORAMENTO", l."TP_LISTA", l."DT_GERACAO" desc, l."CO_LISTA_CLASSIFICACAO" desc
  )
  select jsonb_build_object(
    'schema_version', 1,
    'listas', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', u."CO_LISTA_CLASSIFICACAO", 'edital', u."CO_MONITORAMENTO", 'area', m."CO_AREA",
          'tipo', u."TP_LISTA", 'gerada_em', u."DT_GERACAO", 'pendencias', u."QT_PENDENCIA",
          'publicada', u."ST_PUBLICADA" = 'S',
          'vagas_pendentes', (select coalesce(jsonb_agg(distinct p ->> 'vaga'), '[]'::jsonb)
                                from jsonb_array_elements(case when jsonb_typeof(u."DS_RESULTADO" -> 'pendencias') = 'array'
                                                               then u."DS_RESULTADO" -> 'pendencias' else '[]'::jsonb end) p
                               where p ->> 'vaga' is not null))), '[]'::jsonb)
        from ultimas u
        join public."TB_MONITORAMENTO_INDIGENA" m on m.id = u."CO_MONITORAMENTO"
    ),
    'ajustes', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', j."CO_AJUSTE_PONTUACAO", 'edital', j."CO_MONITORAMENTO", 'area', m."CO_AREA",
          'tipo', j."TP_LISTA", 'aprovado_em', j."DT_APROVACAO")), '[]'::jsonb)
        from public."TB_AJUSTE_PONTUACAO_RECURSO" j
        join public."TB_MONITORAMENTO_INDIGENA" m on m.id = j."CO_MONITORAMENTO"
       where j."TP_SITUACAO" = 'APROVADO'
         and not private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO")
    ),
    'quadros', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', q."CO_QUADRO_VAGA", 'edital', q."CO_MONITORAMENTO", 'cargo', q."NO_CARGO", 'lotacao', q."NO_LOTACAO")
          order by q."CO_MONITORAMENTO", q."CO_QUADRO_VAGA"), '[]'::jsonb)
        from public."TB_QUADRO_VAGA_EDITAL" q
       where q."ST_REGISTRO_ATIVO" = 'S'
    )
  );
$$;

COMMENT ON FUNCTION public.conferencia_ler_listas_e_quadros() IS 'Conferências (job Python, só service_role): a última lista de classificação de cada edital e tipo (fora do treinamento) com as vagas com empate pendente, os ajustes de recurso aprovados e as linhas ativas do quadro de vagas (id, edital, cargo, lotação), cruas. A vaga sem linha no quadro e a lista final desatualizada são conferidas no robô, com as páginas de conferencia_ler_analises (20261103181500).';

-- 2. A tarefa diária.
select cron.unschedule(j.jobid) from cron.job j where j.jobname = 'agsus_vinculos_do_quadro';
delete from public."TB_TAREFA_AGENDADA" where "NO_TAREFA" = 'agsus_vinculos_do_quadro';

-- 3. O que a migration criou, na ordem inversa das dependências.
drop function public.atualizar_vinculos_do_quadro(uuid);
drop function public.gravar_vinculo_do_quadro(uuid, text, text, uuid);
drop function private."FC_EXIGIR_EDITAR_QUADRO"(uuid);
drop function private."FC_QUADRO_DA_VAGA_VINCULADA"(uuid, text, text);
drop function private."FC_PREENCHER_TODOS_VINCULOS_QUADRO"();
drop function private."FC_PREENCHER_VINCULOS_QUADRO"(uuid, boolean, uuid);
drop function private."FC_GRAVAR_VINCULO_QUADRO"(uuid, text, text, text, text, text, uuid, uuid[], text, text, uuid);
drop function private."FC_VINCULO_AUTOMATICO_QUADRO"(uuid, text, text, boolean);
drop function private."FC_VAGAS_PARA_O_QUADRO"(uuid);
drop function private."FC_CANDIDATAS_DO_QUADRO"(uuid, text);
drop function private."FC_CHAVE_LINHA_QUADRO"(text, text);
drop table public."TH_VAGA_QUADRO_EDITAL";
drop table public."TA_VAGA_QUADRO_EDITAL";

commit;
