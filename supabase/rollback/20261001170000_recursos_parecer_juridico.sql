/*
  Rollback de 20261001170000_recursos_parecer_juridico.sql.

  O QUE DESFAZ
    - O gatilho TG_RECURSOCANDIDATO_SITUACAO, a RPC transicionar_recurso_candidato
      e as funções private do parecer saem.
    - REGISTRADO e EM_ANALISE_JURIDICA voltam a EM_ANALISE; os decididos ficam
      decididos (quem e quando). Os CHECKs, o default e o histórico (TP_ACAO)
      voltam aos de antes; as colunas do parecer saem.
    - 'recursos_parecer' sai da lista de módulos, dos grupos e das permissões
      individuais; o grupo "Jurídico" sai.
    - get_recursos_da_area, get_recurso_candidato_detalhe e
      transicionar_resposta_recurso voltam aos corpos de
      20260929230000_recursos_modelos_anexos_respostas.sql; salvar, marcar etapa
      e excluir, aos de 20260929190200_recorte_por_coordenacao_nos_recursos.sql
      (copiados de lá, sem mudança, com os comentários que tinham).
    - Os dois modelos iniciais "Deferido parcialmente" voltam a "Parcialmente
      indeferido" (título e frase do corpo), só se ainda estiverem como a
      migration deixou.

  QUANDO NÃO RODA (para, sem mudar nada)
    - Já houve transição do parecer (TH_RECURSO_CANDIDATO com TP_ACAO
      'parecer'): o parecer escrito se perderia com as colunas. Arquive antes
      (copie TB_RECURSO_CANDIDATO e TH_RECURSO_CANDIDATO para o schema arquivo).
    - Alguém está no grupo "Jurídico": troque o grupo da pessoa antes.
*/
begin;

-- 0. Travas -------------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from public."TH_RECURSO_CANDIDATO" h where h."TP_ACAO" = 'parecer') then
    raise exception 'Há transições do parecer jurídico no histórico: arquive TB/TH_RECURSO_CANDIDATO antes do rollback.';
  end if;
  if exists (select 1 from public."TB_PERFIL_USUARIO" u where u.perfil = 'juridico') then
    raise exception 'Há pessoas no grupo Jurídico: troque o grupo delas antes do rollback.';
  end if;
end;
$$;

-- 1. Gatilho, RPC e funções do parecer -------------------------------------------------------
drop trigger if exists "TG_RECURSOCANDIDATO_SITUACAO" on public."TB_RECURSO_CANDIDATO";
drop function if exists public.transicionar_recurso_candidato(uuid, text, integer, text);
drop function if exists private."FC_TG_SITUACAO_RECURSO"();

-- 2. Recurso: estados e colunas de antes ----------------------------------------------------
alter table public."TB_RECURSO_CANDIDATO" drop constraint "CK_RECURSOCANDIDATO_TPSITUACAO";
alter table public."TB_RECURSO_CANDIDATO" drop constraint "CK_RECURSOCANDIDATO_DECISAO";
alter table public."TB_RECURSO_CANDIDATO" drop constraint "CK_RECURSOCANDIDATO_PARECER";
alter table public."TB_RECURSO_CANDIDATO" drop constraint "CK_RECURSOCANDIDATO_TAMPARECER";
update public."TB_RECURSO_CANDIDATO" set "TP_SITUACAO" = 'EM_ANALISE'
 where "TP_SITUACAO" in ('REGISTRADO', 'EM_ANALISE_JURIDICA');
alter table public."TB_RECURSO_CANDIDATO" alter column "TP_SITUACAO" set default 'EM_ANALISE';
alter table public."TB_RECURSO_CANDIDATO"
  drop column "DS_PARECER_JURIDICO",
  drop column "DT_ENVIO_PARECER",
  drop column "CO_USUARIO_ENVIO_PARECER",
  drop column "DT_DEVOLUCAO",
  drop column "CO_USUARIO_DEVOLUCAO",
  drop column "DS_COMENTARIO_DEVOLUCAO";
alter table public."TB_RECURSO_CANDIDATO"
  add constraint "CK_RECURSOCANDIDATO_TPSITUACAO" check ("TP_SITUACAO" in ('EM_ANALISE', 'DEFERIDO', 'INDEFERIDO', 'PARCIALMENTE_INDEFERIDO')),
  add constraint "CK_RECURSOCANDIDATO_DECISAO" check (
    ("TP_SITUACAO" = 'EM_ANALISE') = ("DT_DECISAO" is null)
    and ("DT_DECISAO" is null) = ("CO_USUARIO_DECISAO" is null)
  );
comment on constraint "CK_RECURSOCANDIDATO_TPSITUACAO" on public."TB_RECURSO_CANDIDATO" is 'Situações válidas do recurso.';
comment on constraint "CK_RECURSOCANDIDATO_DECISAO" on public."TB_RECURSO_CANDIDATO" is 'Data e autor da decisão existem só fora de EM_ANALISE.';
comment on column public."TB_RECURSO_CANDIDATO"."TP_SITUACAO" is 'EM_ANALISE, DEFERIDO, INDEFERIDO ou PARCIALMENTE_INDEFERIDO.';
comment on column public."TB_RECURSO_CANDIDATO"."DT_DECISAO" is 'Quando a situação saiu de EM_ANALISE (fim dos dias em aberto). Nula em análise.';
comment on column public."TB_RECURSO_CANDIDATO"."CO_USUARIO_DECISAO" is 'Quem registrou a decisão (auth.users.id).';

alter table public."TH_RECURSO_CANDIDATO" drop constraint "CK_HISTRECURSO_TPACAO";
alter table public."TH_RECURSO_CANDIDATO" add constraint "CK_HISTRECURSO_TPACAO"
  check ("TP_ACAO" in ('criacao', 'edicao', 'etapa', 'exclusao', 'anexo', 'resposta'));
comment on constraint "CK_HISTRECURSO_TPACAO" on public."TH_RECURSO_CANDIDATO" is
  'Ações registradas: criacao, edicao, etapa, exclusao, anexo (inclusão/arquivamento) e resposta (transições da resposta).';
comment on column public."TH_RECURSO_CANDIDATO"."TP_ACAO" is
  'criacao, edicao, etapa, exclusao, anexo ou resposta.';
comment on column public."TH_RECURSO_CANDIDATO"."DS_CAMPO" is
  'Campo editado, etapa (download_empregare, processo_sei, upload_sei, resposta_candidato), ação do anexo (inclusao, arquivamento) ou da resposta (criacao, enviar_revisao, aprovar, devolver, reabrir, marcar_enviada). Nulo na criação e na exclusão do recurso.';
comment on column public."TH_RECURSO_CANDIDATO"."DS_MOTIVO" is 'Motivo informado (exclusão).';

-- 3. Funções: corpos de antes ------------------------------------------------------------------
-- public.get_recursos_da_area(text): corpo de 20260929230000_recursos_modelos_anexos_respostas.sql, copiado sem mudança.
create or replace function public.get_recursos_da_area(p_area text)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_pode_editar boolean;
begin
  if not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = p_area) then
    raise exception 'Área inválida' using errcode = '22023';
  end if;
  perform private."FC_EXIGIR_RECURSOS_NA_AREA"(p_area, 1);
  v_pode_editar := private.pode_recurso('recursos', 2);
  return (
    with recursos as (
      select r.*, m.edital, m.unidade,
             a.candidato, a.id_origem, a.nome_vaga, a.codigo_vaga,
             a.nota_final_ajustada, a.status_consolidado,
             (select s."TP_ESTADO" from public."TB_RESPOSTA_RECURSO" s
               where s."CO_RECURSO_CANDIDATO" = r."CO_RECURSO_CANDIDATO") as resposta_estado,
             (select count(*) from public."TB_ANEXO_RECURSO" x
               where x."CO_RECURSO_CANDIDATO" = r."CO_RECURSO_CANDIDATO" and x."ST_ATIVO" = 'S') as qt_anexos
      from public."TB_RECURSO_CANDIDATO" r
      join public."TB_MONITORAMENTO_INDIGENA" m on m.id = r."CO_MONITORAMENTO"
      left join public."TB_ANALISE_CURRICULAR" a on a.id = r."CO_ANALISE_CURRICULAR"
      where m."CO_AREA" = p_area
        and r."ST_ATIVO" = 'S'
        and ((select private."FC_EDITAIS_VISIVEIS"()) is null or m.id = any ((select private."FC_EDITAIS_VISIVEIS"())::uuid[]))
    )
    select json_build_object(
      'schema_version', 1,
      'area', p_area,
      'pode_editar', v_pode_editar,
      'pode_administrar_modelos', private.pode_recurso('recursos', 3),
      'gerado_em', now(),
      'origens', (
        select coalesce(json_agg(json_build_object(
            'id', o."CO_ORIGEM_RECURSO",
            'rotulo', o."NO_ORIGEM_RECURSO",
            'ativo', o."ST_ATIVO" = 'S'
          ) order by o."NU_ORDEM"), '[]'::json)
        from public."TB_ORIGEM_RECURSO" o
      ),
      'editais', case when v_pode_editar then (
        select coalesce(json_agg(json_build_object(
            'id', m.id,
            'edital', m.edital,
            'unidade', m.unidade,
            'status', m.status,
            'tem_analises', exists (
              select 1 from public."TB_ANALISE_CURRICULAR" a
              where a.edital = m.edital and a."CO_AREA" = m."CO_AREA"
            )
          ) order by m.edital), '[]'::json)
        from public."TB_MONITORAMENTO_INDIGENA" m
        where m."CO_AREA" = p_area
          and m.ativo
          and ((select private."FC_EDITAIS_VISIVEIS"()) is null or m.id = any ((select private."FC_EDITAIS_VISIVEIS"())::uuid[]))
      ) else '[]'::json end,
      'modelos', case when v_pode_editar then (
        select coalesce(json_agg(json_build_object(
            'id', t."CO_MODELO_RESPOSTA",
            'versao', t."NU_VERSAO",
            'area', t."CO_AREA",
            'origem', t."CO_ORIGEM_RECURSO",
            'situacao', t."TP_SITUACAO",
            'nome', t."NO_MODELO",
            'corpo', t."DS_CORPO"
          ) order by t."NO_MODELO"), '[]'::json)
        from public."TB_MODELO_RESPOSTA_RECURSO" t
        where t."ST_VIGENTE" = 'S'
          and t."ST_ATIVO" = 'S'
          and (t."CO_AREA" is null or t."CO_AREA" = p_area)
      ) else '[]'::json end,
      'recursos', (
        select coalesce(json_agg(json_build_object(
            'id', r."CO_RECURSO_CANDIDATO",
            'nu', r."NU_RECURSO",
            'edital_id', r."CO_MONITORAMENTO",
            'edital', r.edital,
            'unidade', r.unidade,
            'origem', r."CO_ORIGEM_RECURSO",
            'analise_id', r."CO_ANALISE_CURRICULAR",
            'fora_analise', r."ST_FORA_ANALISE" = 'S',
            'candidato', coalesce(r.candidato, r."NO_CANDIDATO_INFORMADO"),
            'codigo', coalesce(r.id_origem, r."CO_CANDIDATO_INFORMADO"),
            'cargo', coalesce(r.nome_vaga, r."NO_CARGO_INFORMADO"),
            'vaga', coalesce(r.codigo_vaga, r."CO_VAGA_INFORMADA"),
            'nota_anterior', r."VL_NOTA_ANTERIOR",
            'nota_atual', r.nota_final_ajustada,
            'resultado_anterior', r."DS_RESULTADO_ANTERIOR",
            'resultado_atual', r.status_consolidado,
            'analista', r."NO_ANALISTA",
            'situacao', r."TP_SITUACAO",
            'processo_sei', r."NU_PROCESSO_SEI",
            'mudou_classificacao', r."ST_MUDOU_CLASSIFICACAO" = 'S',
            'download_empregare_em', r."DT_DOWNLOAD_EMPREGARE",
            'processo_sei_em', r."DT_PROCESSO_SEI",
            'upload_sei_em', r."DT_UPLOAD_SEI",
            'resposta_candidato_em', r."DT_RESPOSTA_CANDIDATO",
            'decisao_em', r."DT_DECISAO",
            'criado_em', r."DT_CRIACAO",
            'atualizado_em', r."DT_ATUALIZACAO",
            'revisao', r."NU_REVISAO",
            'resposta_estado', r.resposta_estado,
            'qt_anexos', r.qt_anexos
          ) order by r."NU_RECURSO" desc), '[]'::json)
        from recursos r
      ),
      'cronogramas', (
        select coalesce(json_agg(json_build_object(
            'edital_id', c.monitoramento_id,
            'ordem', c.ordem,
            'atividade', c.atividade,
            'inicio', c.data_inicio,
            'fim', c.data_fim
          ) order by c.monitoramento_id, c.ordem), '[]'::json)
        from public."TB_CRONOGRAMA_MONIT_INDIG" c
        where c.monitoramento_id in (select r."CO_MONITORAMENTO" from recursos r)
      )
    )
  );
end;
$function$;
comment on function public.get_recursos_da_area(text) is
  'Aba Recursos de uma área (json): recursos ativos com os dados do candidato vindos da análise, origens, editais da área (só para quem edita) e as etapas do cronograma dos editais com recurso (o prazo é classificado no front). Exige recursos >= leitor e a área (42501).';

-- public.get_recurso_candidato_detalhe(uuid): corpo de 20260929230000_recursos_modelos_anexos_respostas.sql, copiado sem mudança.
create or replace function public.get_recurso_candidato_detalhe(p_id uuid)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_area text;
begin
  select m."CO_AREA" into v_area
  from public."TB_RECURSO_CANDIDATO" r
  join public."TB_MONITORAMENTO_INDIGENA" m on m.id = r."CO_MONITORAMENTO"
  where r."CO_RECURSO_CANDIDATO" = p_id and r."ST_ATIVO" = 'S';
  if v_area is null then
    raise exception 'Recurso não encontrado' using errcode = 'P0002';
  end if;
  perform private."FC_EXIGIR_RECURSOS_NA_AREA"(v_area, 1);
  perform private."FC_EXIGIR_AREA_EDITAL"((select r."CO_MONITORAMENTO"::text from public."TB_RECURSO_CANDIDATO" r where r."CO_RECURSO_CANDIDATO" = p_id));
  return (
    select json_build_object(
      'id', r."CO_RECURSO_CANDIDATO",
      'eu', (select auth.uid()),
      'observacao', r."DS_OBSERVACAO",
      'modalidade', a.modalidade_concorrencia,
      'responsavel_analise', a.responsavel_analise,
      'analise_ativa', a.ativo,
      'nome_informado', r."NO_CANDIDATO_INFORMADO",
      'codigo_informado', r."CO_CANDIDATO_INFORMADO",
      'cargo_informado', r."NO_CARGO_INFORMADO",
      'vaga_informada', r."CO_VAGA_INFORMADA",
      'criado_por', private."FC_NOME_USUARIO"(r."CO_USUARIO_CRIACAO"),
      'decisao_por', private."FC_NOME_USUARIO"(r."CO_USUARIO_DECISAO"),
      'etapas', json_build_object(
        'download_empregare', private."FC_NOME_USUARIO"(r."CO_USUARIO_DOWNLOAD_EMPREGARE"),
        'processo_sei', private."FC_NOME_USUARIO"(r."CO_USUARIO_PROCESSO_SEI"),
        'upload_sei', private."FC_NOME_USUARIO"(r."CO_USUARIO_UPLOAD_SEI"),
        'resposta_candidato', private."FC_NOME_USUARIO"(r."CO_USUARIO_RESPOSTA_CANDIDATO")
      ),
      'historico', (
        select coalesce(json_agg(json_build_object(
            'em', h."DT_ALTERACAO",
            'acao', h."TP_ACAO",
            'campo', h."DS_CAMPO",
            'anterior', h."DS_VALOR_ANTERIOR",
            'novo', h."DS_VALOR_NOVO",
            'motivo', h."DS_MOTIVO",
            'autor', private."FC_NOME_USUARIO"(h."CO_USUARIO")
          ) order by h."DT_ALTERACAO" desc, h."CO_HISTORICO_RECURSO" desc), '[]'::json)
        from public."TH_RECURSO_CANDIDATO" h
        where h."CO_RECURSO_CANDIDATO" = r."CO_RECURSO_CANDIDATO"
      ),
      'anexos', (
        select coalesce(json_agg(json_build_object(
            'id', x."CO_ANEXO_RECURSO",
            'tipo', x."TP_ANEXO",
            'nome', x."NO_ARQUIVO",
            'bytes', x."QT_BYTES",
            'mime', x."DS_MIME",
            'ativo', x."ST_ATIVO" = 'S',
            'resposta_id', x."CO_RESPOSTA_RECURSO",
            'incluido_em', x."DT_INCLUSAO",
            'incluido_por', private."FC_NOME_USUARIO"(x."CO_USUARIO_INCLUSAO"),
            'arquivado_em', x."DT_ARQUIVAMENTO",
            'arquivado_por', private."FC_NOME_USUARIO"(x."CO_USUARIO_ARQUIVAMENTO"),
            'motivo_arquivamento', x."DS_MOTIVO_ARQUIVAMENTO"
          ) order by x."ST_ATIVO" desc, x."DT_INCLUSAO" desc), '[]'::json)
        from public."TB_ANEXO_RECURSO" x
        where x."CO_RECURSO_CANDIDATO" = r."CO_RECURSO_CANDIDATO"
      ),
      'resposta', (
        select json_build_object(
          'id', s."CO_RESPOSTA_RECURSO",
          'modelo_id', s."CO_MODELO_RESPOSTA",
          'modelo_versao', s."NU_VERSAO_MODELO",
          'modelo_nome', t."NO_MODELO",
          'modelo_situacao', t."TP_SITUACAO",
          'modelo_vigente', t."ST_VIGENTE" = 'S',
          'modelo_corpo', t."DS_CORPO",
          'fundamentacao', s."DS_FUNDAMENTACAO",
          'texto_final', s."DS_TEXTO_FINAL",
          'estado', s."TP_ESTADO",
          'passou_revisao', s."ST_PASSOU_REVISAO" = 'S',
          'autor_id', s."CO_USUARIO_AUTOR",
          'autor', private."FC_NOME_USUARIO"(s."CO_USUARIO_AUTOR"),
          'envio_revisao_em', s."DT_ENVIO_REVISAO",
          'envio_revisao_por_id', s."CO_USUARIO_ENVIO_REVISAO",
          'envio_revisao_por', private."FC_NOME_USUARIO"(s."CO_USUARIO_ENVIO_REVISAO"),
          'revisor_id', s."CO_USUARIO_REVISOR",
          'revisor', private."FC_NOME_USUARIO"(s."CO_USUARIO_REVISOR"),
          'revisao_em', s."DT_REVISAO",
          'comentario_revisao', s."DS_COMENTARIO_REVISAO",
          'enviada_em', s."DT_ENVIO",
          'enviada_por', private."FC_NOME_USUARIO"(s."CO_USUARIO_ENVIO"),
          'revisao', s."NU_REVISAO",
          'criado_em', s."DT_CRIACAO",
          'atualizado_em', s."DT_ATUALIZACAO",
          'historico', (
            select coalesce(json_agg(json_build_object(
                'em', h."DT_ACAO",
                'acao', h."TP_ACAO",
                'anterior', h."TP_ESTADO_ANTERIOR",
                'novo', h."TP_ESTADO_NOVO",
                'comentario', h."DS_COMENTARIO",
                'versao_modelo', h."NU_VERSAO_MODELO",
                'autor', private."FC_NOME_USUARIO"(h."CO_USUARIO")
              ) order by h."DT_ACAO" desc, h."CO_HISTORICO_RESPOSTA" desc), '[]'::json)
            from public."TH_RESPOSTA_RECURSO" h
            where h."CO_RESPOSTA_RECURSO" = s."CO_RESPOSTA_RECURSO"
          )
        )
        from public."TB_RESPOSTA_RECURSO" s
        join public."TB_MODELO_RESPOSTA_RECURSO" t
          on t."CO_MODELO_RESPOSTA" = s."CO_MODELO_RESPOSTA" and t."NU_VERSAO" = s."NU_VERSAO_MODELO"
        where s."CO_RECURSO_CANDIDATO" = r."CO_RECURSO_CANDIDATO"
      )
    )
    from public."TB_RECURSO_CANDIDATO" r
    left join public."TB_ANALISE_CURRICULAR" a on a.id = r."CO_ANALISE_CURRICULAR"
    where r."CO_RECURSO_CANDIDATO" = p_id
  );
end;
$function$;
comment on function public.get_recurso_candidato_detalhe(uuid) is
  'Detalhe de um recurso (observação, quem fez cada etapa, dados digitados) e o histórico, do mais recente ao mais antigo. Mesma permissão da leitura da aba, na área do edital.';

-- public.salvar_recurso_candidato(jsonb): corpo de 20260929190200_recorte_por_coordenacao_nos_recursos.sql, copiado sem mudança.
create or replace function public.salvar_recurso_candidato(p_dados jsonb)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
  v_edital_id uuid;
  v_edital text;
  v_area text;
  v_origem text;
  v_situacao text;
  v_fora boolean;
  v_analise_id uuid;
  v_nota numeric;
  v_resultado text;
  v_responsavel text;
  v_duplicado bigint;
  v_atual public."TB_RECURSO_CANDIDATO";
  v_novo public."TB_RECURSO_CANDIDATO";
  v_texto text;
begin
  if jsonb_typeof(p_dados) is distinct from 'object' then
    raise exception 'Dados inválidos' using errcode = '22023';
  end if;
  if v_uid is null then
    raise exception 'Sessão inválida' using errcode = '42501';
  end if;
  v_id := nullif(p_dados->>'id', '')::uuid;

  if v_id is null then
    -- Cadastro ---------------------------------------------------------------
    v_edital_id := nullif(p_dados->>'edital_id', '')::uuid;
    select m.edital, m."CO_AREA" into v_edital, v_area
    from public."TB_MONITORAMENTO_INDIGENA" m
    where m.id = v_edital_id;
    if v_area is null then
      raise exception 'Edital não encontrado' using errcode = '22023';
    end if;
    perform private."FC_EXIGIR_RECURSOS_NA_AREA"(v_area, 2);
    perform private."FC_EXIGIR_AREA_EDITAL"(v_edital_id::text);

    v_origem := nullif(p_dados->>'origem', '');
    if not exists (select 1 from public."TB_ORIGEM_RECURSO" o where o."CO_ORIGEM_RECURSO" = v_origem and o."ST_ATIVO" = 'S') then
      raise exception 'Origem do recurso inválida' using errcode = '22023';
    end if;
    v_situacao := coalesce(nullif(p_dados->>'situacao', ''), 'EM_ANALISE');
    if v_situacao not in ('EM_ANALISE', 'DEFERIDO', 'INDEFERIDO', 'PARCIALMENTE_INDEFERIDO') then
      raise exception 'Situação inválida' using errcode = '22023';
    end if;
    v_fora := coalesce((p_dados->>'fora_analise')::boolean, false);

    if not v_fora then
      select a.id, a.nota_final_ajustada, a.status_consolidado, a.responsavel_analise
        into v_analise_id, v_nota, v_resultado, v_responsavel
      from public."TB_ANALISE_CURRICULAR" a
      where a.id = nullif(p_dados->>'analise_id', '')::uuid
        and a.edital = v_edital
        and a."CO_AREA" = v_area;
      if v_analise_id is null then
        raise exception 'Candidato não encontrado nas análises deste edital' using errcode = '22023';
      end if;
      select r."NU_RECURSO" into v_duplicado
      from public."TB_RECURSO_CANDIDATO" r
      where r."CO_ANALISE_CURRICULAR" = v_analise_id
        and r."CO_MONITORAMENTO" = v_edital_id
        and r."CO_ORIGEM_RECURSO" = v_origem
        and r."ST_ATIVO" = 'S'
        and r."TP_SITUACAO" = 'EM_ANALISE'
      order by r."NU_RECURSO"
      limit 1;
    else
      v_texto := btrim(coalesce(p_dados->>'nome_informado', ''));
      if length(v_texto) not between 3 and 200 then
        raise exception 'Informe o nome do candidato (3 a 200 caracteres)' using errcode = '22023';
      end if;
      select r."NU_RECURSO" into v_duplicado
      from public."TB_RECURSO_CANDIDATO" r
      where r."ST_FORA_ANALISE" = 'S'
        and private."FC_TEXTO_BUSCA_RECURSO"(r."NO_CANDIDATO_INFORMADO") = private."FC_TEXTO_BUSCA_RECURSO"(v_texto)
        and r."CO_MONITORAMENTO" = v_edital_id
        and r."CO_ORIGEM_RECURSO" = v_origem
        and r."ST_ATIVO" = 'S'
        and r."TP_SITUACAO" = 'EM_ANALISE'
      order by r."NU_RECURSO"
      limit 1;
    end if;

    if v_duplicado is not null and not coalesce((p_dados->>'permitir_duplicado')::boolean, false) then
      raise exception 'Já existe o recurso nº % em análise para este candidato, edital e origem', v_duplicado
        using errcode = '23505', hint = 'duplicado:' || v_duplicado;
    end if;

    insert into public."TB_RECURSO_CANDIDATO" (
      "CO_MONITORAMENTO", "CO_ORIGEM_RECURSO", "CO_ANALISE_CURRICULAR", "ST_FORA_ANALISE",
      "NO_CANDIDATO_INFORMADO", "CO_CANDIDATO_INFORMADO", "NO_CARGO_INFORMADO", "CO_VAGA_INFORMADA",
      "VL_NOTA_ANTERIOR", "DS_RESULTADO_ANTERIOR", "NO_ANALISTA", "TP_SITUACAO",
      "NU_PROCESSO_SEI", "ST_MUDOU_CLASSIFICACAO", "DS_OBSERVACAO",
      "DT_PROCESSO_SEI", "CO_USUARIO_PROCESSO_SEI", "DT_DECISAO", "CO_USUARIO_DECISAO",
      "CO_USUARIO_CRIACAO", "CO_USUARIO_ATUALIZACAO"
    ) values (
      v_edital_id, v_origem,
      v_analise_id,
      case when v_fora then 'S' else 'N' end,
      case when v_fora then v_texto end,
      case when v_fora then nullif(btrim(p_dados->>'codigo_informado'), '') end,
      case when v_fora then nullif(btrim(p_dados->>'cargo_informado'), '') end,
      case when v_fora then nullif(btrim(p_dados->>'vaga_informada'), '') end,
      v_nota,
      v_resultado,
      coalesce(nullif(btrim(p_dados->>'analista'), ''), nullif(btrim(v_responsavel), '')),
      v_situacao,
      nullif(btrim(p_dados->>'processo_sei'), ''),
      case when coalesce((p_dados->>'mudou_classificacao')::boolean, false) then 'S' else 'N' end,
      nullif(btrim(p_dados->>'observacao'), ''),
      case when nullif(btrim(p_dados->>'processo_sei'), '') is not null then now() end,
      case when nullif(btrim(p_dados->>'processo_sei'), '') is not null then v_uid end,
      case when v_situacao <> 'EM_ANALISE' then now() end,
      case when v_situacao <> 'EM_ANALISE' then v_uid end,
      v_uid, v_uid
    )
    returning * into v_novo;

    insert into public."TH_RECURSO_CANDIDATO" ("CO_RECURSO_CANDIDATO", "TP_ACAO", "DS_VALOR_NOVO", "CO_USUARIO")
    values (v_novo."CO_RECURSO_CANDIDATO", 'criacao', v_novo."TP_SITUACAO", v_uid);

    return json_build_object('id', v_novo."CO_RECURSO_CANDIDATO", 'nu', v_novo."NU_RECURSO", 'revisao', v_novo."NU_REVISAO");
  end if;

  -- Edição -------------------------------------------------------------------
  select r.* into v_atual
  from public."TB_RECURSO_CANDIDATO" r
  where r."CO_RECURSO_CANDIDATO" = v_id and r."ST_ATIVO" = 'S'
  for update;
  if not found then
    raise exception 'Recurso não encontrado' using errcode = 'P0002';
  end if;
  select m."CO_AREA" into v_area from public."TB_MONITORAMENTO_INDIGENA" m where m.id = v_atual."CO_MONITORAMENTO";
  perform private."FC_EXIGIR_RECURSOS_NA_AREA"(v_area, 2);
  perform private."FC_EXIGIR_AREA_EDITAL"(v_atual."CO_MONITORAMENTO"::text);
  if (p_dados->>'revisao') is null or (p_dados->>'revisao')::integer <> v_atual."NU_REVISAO" then
    raise exception 'O recurso foi alterado por outra pessoa. Recarregue e tente de novo.' using errcode = '40001';
  end if;

  v_novo := v_atual;
  if p_dados ? 'origem' then
    v_novo."CO_ORIGEM_RECURSO" := nullif(p_dados->>'origem', '');
    if v_novo."CO_ORIGEM_RECURSO" is distinct from v_atual."CO_ORIGEM_RECURSO"
       and not exists (select 1 from public."TB_ORIGEM_RECURSO" o where o."CO_ORIGEM_RECURSO" = v_novo."CO_ORIGEM_RECURSO" and o."ST_ATIVO" = 'S') then
      raise exception 'Origem do recurso inválida' using errcode = '22023';
    end if;
  end if;
  if p_dados ? 'situacao' then
    v_novo."TP_SITUACAO" := coalesce(nullif(p_dados->>'situacao', ''), 'EM_ANALISE');
    if v_novo."TP_SITUACAO" not in ('EM_ANALISE', 'DEFERIDO', 'INDEFERIDO', 'PARCIALMENTE_INDEFERIDO') then
      raise exception 'Situação inválida' using errcode = '22023';
    end if;
  end if;
  if p_dados ? 'analista' then v_novo."NO_ANALISTA" := nullif(btrim(p_dados->>'analista'), ''); end if;
  if p_dados ? 'processo_sei' then v_novo."NU_PROCESSO_SEI" := nullif(btrim(p_dados->>'processo_sei'), ''); end if;
  if p_dados ? 'mudou_classificacao' then
    v_novo."ST_MUDOU_CLASSIFICACAO" := case when coalesce((p_dados->>'mudou_classificacao')::boolean, false) then 'S' else 'N' end;
  end if;
  if p_dados ? 'observacao' then v_novo."DS_OBSERVACAO" := nullif(btrim(p_dados->>'observacao'), ''); end if;
  if v_atual."ST_FORA_ANALISE" = 'S' then
    if p_dados ? 'nome_informado' then
      v_novo."NO_CANDIDATO_INFORMADO" := btrim(coalesce(p_dados->>'nome_informado', ''));
      if length(v_novo."NO_CANDIDATO_INFORMADO") not between 3 and 200 then
        raise exception 'Informe o nome do candidato (3 a 200 caracteres)' using errcode = '22023';
      end if;
    end if;
    if p_dados ? 'codigo_informado' then v_novo."CO_CANDIDATO_INFORMADO" := nullif(btrim(p_dados->>'codigo_informado'), ''); end if;
    if p_dados ? 'cargo_informado' then v_novo."NO_CARGO_INFORMADO" := nullif(btrim(p_dados->>'cargo_informado'), ''); end if;
    if p_dados ? 'vaga_informada' then v_novo."CO_VAGA_INFORMADA" := nullif(btrim(p_dados->>'vaga_informada'), ''); end if;
  end if;

  -- Decisão: sair de "em análise" fecha os dias em aberto; voltar reabre.
  if v_novo."TP_SITUACAO" <> 'EM_ANALISE' and v_atual."TP_SITUACAO" = 'EM_ANALISE' then
    v_novo."DT_DECISAO" := now();
    v_novo."CO_USUARIO_DECISAO" := v_uid;
  elsif v_novo."TP_SITUACAO" = 'EM_ANALISE' then
    v_novo."DT_DECISAO" := null;
    v_novo."CO_USUARIO_DECISAO" := null;
  end if;
  -- Informar o número do processo SEI marca a etapa "processo SEI criado".
  if v_novo."NU_PROCESSO_SEI" is not null and v_novo."DT_PROCESSO_SEI" is null then
    v_novo."DT_PROCESSO_SEI" := now();
    v_novo."CO_USUARIO_PROCESSO_SEI" := v_uid;
  end if;

  insert into public."TH_RECURSO_CANDIDATO" ("CO_RECURSO_CANDIDATO", "TP_ACAO", "DS_CAMPO", "DS_VALOR_ANTERIOR", "DS_VALOR_NOVO", "CO_USUARIO")
  select v_id, c.acao, c.campo, c.antes, c.depois, v_uid
  from (values
    ('edicao', 'origem', v_atual."CO_ORIGEM_RECURSO", v_novo."CO_ORIGEM_RECURSO"),
    ('edicao', 'situacao', v_atual."TP_SITUACAO", v_novo."TP_SITUACAO"),
    ('edicao', 'analista', v_atual."NO_ANALISTA", v_novo."NO_ANALISTA"),
    ('edicao', 'processo_sei', v_atual."NU_PROCESSO_SEI", v_novo."NU_PROCESSO_SEI"),
    ('edicao', 'mudou_classificacao', v_atual."ST_MUDOU_CLASSIFICACAO", v_novo."ST_MUDOU_CLASSIFICACAO"),
    ('edicao', 'observacao', v_atual."DS_OBSERVACAO", v_novo."DS_OBSERVACAO"),
    ('edicao', 'nome_informado', v_atual."NO_CANDIDATO_INFORMADO", v_novo."NO_CANDIDATO_INFORMADO"),
    ('edicao', 'codigo_informado', v_atual."CO_CANDIDATO_INFORMADO", v_novo."CO_CANDIDATO_INFORMADO"),
    ('edicao', 'cargo_informado', v_atual."NO_CARGO_INFORMADO", v_novo."NO_CARGO_INFORMADO"),
    ('edicao', 'vaga_informada', v_atual."CO_VAGA_INFORMADA", v_novo."CO_VAGA_INFORMADA"),
    ('etapa', 'processo_sei', case when v_atual."DT_PROCESSO_SEI" is null then 'N' else 'S' end, case when v_novo."DT_PROCESSO_SEI" is null then 'N' else 'S' end)
  ) as c(acao, campo, antes, depois)
  where c.antes is distinct from c.depois;
  if not found then
    return json_build_object('id', v_atual."CO_RECURSO_CANDIDATO", 'nu', v_atual."NU_RECURSO", 'revisao', v_atual."NU_REVISAO");
  end if;

  update public."TB_RECURSO_CANDIDATO" set
    "CO_ORIGEM_RECURSO" = v_novo."CO_ORIGEM_RECURSO",
    "TP_SITUACAO" = v_novo."TP_SITUACAO",
    "NO_ANALISTA" = v_novo."NO_ANALISTA",
    "NU_PROCESSO_SEI" = v_novo."NU_PROCESSO_SEI",
    "ST_MUDOU_CLASSIFICACAO" = v_novo."ST_MUDOU_CLASSIFICACAO",
    "DS_OBSERVACAO" = v_novo."DS_OBSERVACAO",
    "NO_CANDIDATO_INFORMADO" = v_novo."NO_CANDIDATO_INFORMADO",
    "CO_CANDIDATO_INFORMADO" = v_novo."CO_CANDIDATO_INFORMADO",
    "NO_CARGO_INFORMADO" = v_novo."NO_CARGO_INFORMADO",
    "CO_VAGA_INFORMADA" = v_novo."CO_VAGA_INFORMADA",
    "DT_PROCESSO_SEI" = v_novo."DT_PROCESSO_SEI",
    "CO_USUARIO_PROCESSO_SEI" = v_novo."CO_USUARIO_PROCESSO_SEI",
    "DT_DECISAO" = v_novo."DT_DECISAO",
    "CO_USUARIO_DECISAO" = v_novo."CO_USUARIO_DECISAO",
    "NU_REVISAO" = v_atual."NU_REVISAO" + 1,
    "DT_ATUALIZACAO" = now(),
    "CO_USUARIO_ATUALIZACAO" = v_uid
  where "CO_RECURSO_CANDIDATO" = v_id
  returning * into v_novo;

  return json_build_object('id', v_novo."CO_RECURSO_CANDIDATO", 'nu', v_novo."NU_RECURSO", 'revisao', v_novo."NU_REVISAO");
end;
$function$;
comment on function public.salvar_recurso_candidato(jsonb) is
  'Cadastra (sem id) ou edita (com id e revisão) um recurso. Cadastro: edital, origem ativa e o candidato das análises do mesmo edital (ou fora_analise com nome); guarda a nota e o resultado da análise do dia; analista padrão = responsável pela análise; duplicado em análise (mesmo candidato, edital e origem) dá 23505 salvo permitir_duplicado. Edição: origem, situação, analista, processo SEI, mudou a classificação, observação e, fora das análises, os dados digitados; revisão desatualizada dá 40001. Número do processo SEI marca a etapa; a decisão grava quando e quem. Tudo vai para TH_RECURSO_CANDIDATO. Exige recursos >= editor e a área do edital.';

-- public.marcar_etapa_recurso(uuid, text, boolean): corpo de 20260929190200_recorte_por_coordenacao_nos_recursos.sql, copiado sem mudança.
create or replace function public.marcar_etapa_recurso(p_id uuid, p_etapa text, p_feita boolean)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_atual public."TB_RECURSO_CANDIDATO";
  v_area text;
  v_antes timestamptz;
  v_em timestamptz;
  v_revisao integer;
begin
  if p_etapa is null or p_etapa not in ('download_empregare', 'processo_sei', 'upload_sei', 'resposta_candidato') then
    raise exception 'Etapa inválida' using errcode = '22023';
  end if;
  if v_uid is null then
    raise exception 'Sessão inválida' using errcode = '42501';
  end if;
  select r.* into v_atual
  from public."TB_RECURSO_CANDIDATO" r
  where r."CO_RECURSO_CANDIDATO" = p_id and r."ST_ATIVO" = 'S'
  for update;
  if not found then
    raise exception 'Recurso não encontrado' using errcode = 'P0002';
  end if;
  select m."CO_AREA" into v_area from public."TB_MONITORAMENTO_INDIGENA" m where m.id = v_atual."CO_MONITORAMENTO";
  perform private."FC_EXIGIR_RECURSOS_NA_AREA"(v_area, 2);
  perform private."FC_EXIGIR_AREA_EDITAL"(v_atual."CO_MONITORAMENTO"::text);

  v_antes := case p_etapa
    when 'download_empregare' then v_atual."DT_DOWNLOAD_EMPREGARE"
    when 'processo_sei' then v_atual."DT_PROCESSO_SEI"
    when 'upload_sei' then v_atual."DT_UPLOAD_SEI"
    else v_atual."DT_RESPOSTA_CANDIDATO" end;
  if (v_antes is not null) = coalesce(p_feita, false) then
    return json_build_object('revisao', v_atual."NU_REVISAO", 'alterou', false, 'em', v_antes);
  end if;
  v_em := case when p_feita then now() end;

  update public."TB_RECURSO_CANDIDATO" set
    "DT_DOWNLOAD_EMPREGARE" = case when p_etapa = 'download_empregare' then v_em else "DT_DOWNLOAD_EMPREGARE" end,
    "CO_USUARIO_DOWNLOAD_EMPREGARE" = case when p_etapa = 'download_empregare' then case when p_feita then v_uid end else "CO_USUARIO_DOWNLOAD_EMPREGARE" end,
    "DT_PROCESSO_SEI" = case when p_etapa = 'processo_sei' then v_em else "DT_PROCESSO_SEI" end,
    "CO_USUARIO_PROCESSO_SEI" = case when p_etapa = 'processo_sei' then case when p_feita then v_uid end else "CO_USUARIO_PROCESSO_SEI" end,
    "DT_UPLOAD_SEI" = case when p_etapa = 'upload_sei' then v_em else "DT_UPLOAD_SEI" end,
    "CO_USUARIO_UPLOAD_SEI" = case when p_etapa = 'upload_sei' then case when p_feita then v_uid end else "CO_USUARIO_UPLOAD_SEI" end,
    "DT_RESPOSTA_CANDIDATO" = case when p_etapa = 'resposta_candidato' then v_em else "DT_RESPOSTA_CANDIDATO" end,
    "CO_USUARIO_RESPOSTA_CANDIDATO" = case when p_etapa = 'resposta_candidato' then case when p_feita then v_uid end else "CO_USUARIO_RESPOSTA_CANDIDATO" end,
    "NU_REVISAO" = "NU_REVISAO" + 1,
    "DT_ATUALIZACAO" = now(),
    "CO_USUARIO_ATUALIZACAO" = v_uid
  where "CO_RECURSO_CANDIDATO" = p_id
  returning "NU_REVISAO" into v_revisao;

  insert into public."TH_RECURSO_CANDIDATO" ("CO_RECURSO_CANDIDATO", "TP_ACAO", "DS_CAMPO", "DS_VALOR_ANTERIOR", "DS_VALOR_NOVO", "CO_USUARIO")
  values (p_id, 'etapa', p_etapa, case when v_antes is null then 'N' else 'S' end, case when p_feita then 'S' else 'N' end, v_uid);

  return json_build_object('revisao', v_revisao, 'alterou', true, 'em', v_em);
end;
$function$;
comment on function public.marcar_etapa_recurso(uuid, text, boolean) is
  'Marca (p_feita = true, com quando e quem) ou desmarca uma etapa do recurso: download_empregare, processo_sei, upload_sei ou resposta_candidato. Registra no histórico e sobe a revisão. Exige recursos >= editor e a área do edital.';

-- public.excluir_recurso_candidato(uuid, text): corpo de 20260929190200_recorte_por_coordenacao_nos_recursos.sql, copiado sem mudança.
create or replace function public.excluir_recurso_candidato(p_id uuid, p_motivo text)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_edital uuid;
  v_area text;
begin
  if length(btrim(coalesce(p_motivo, ''))) not between 3 and 500 then
    raise exception 'Informe um motivo entre 3 e 500 caracteres' using errcode = '22023';
  end if;
  if v_uid is null then
    raise exception 'Sessão inválida' using errcode = '42501';
  end if;
  select r."CO_MONITORAMENTO" into v_edital
  from public."TB_RECURSO_CANDIDATO" r
  where r."CO_RECURSO_CANDIDATO" = p_id and r."ST_ATIVO" = 'S'
  for update;
  if v_edital is null then
    raise exception 'Recurso não encontrado' using errcode = 'P0002';
  end if;
  select m."CO_AREA" into v_area from public."TB_MONITORAMENTO_INDIGENA" m where m.id = v_edital;
  perform private."FC_EXIGIR_RECURSOS_NA_AREA"(v_area, 2);
  perform private."FC_EXIGIR_AREA_EDITAL"(v_edital::text);
  update public."TB_RECURSO_CANDIDATO" set
    "ST_ATIVO" = 'N',
    "NU_REVISAO" = "NU_REVISAO" + 1,
    "DT_ATUALIZACAO" = now(),
    "CO_USUARIO_ATUALIZACAO" = v_uid
  where "CO_RECURSO_CANDIDATO" = p_id;
  insert into public."TH_RECURSO_CANDIDATO" ("CO_RECURSO_CANDIDATO", "TP_ACAO", "DS_VALOR_ANTERIOR", "DS_VALOR_NOVO", "DS_MOTIVO", "CO_USUARIO")
  values (p_id, 'exclusao', 'S', 'N', btrim(p_motivo), v_uid);
  return json_build_object('id', p_id, 'excluido', true);
end;
$function$;
comment on function public.excluir_recurso_candidato(uuid, text) is
  'Exclusão lógica (ST_ATIVO = N) de um recurso cadastrado por engano, com motivo no histórico. Exige recursos >= editor e a área do edital.';

-- public.transicionar_resposta_recurso(uuid, text, integer, text): corpo de 20260929230000_recursos_modelos_anexos_respostas.sql, copiado sem mudança.
create or replace function public.transicionar_resposta_recurso(p_resposta_id uuid, p_acao text, p_revisao integer, p_comentario text default null)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_atual public."TB_RESPOSTA_RECURSO";
  v_rec public."TB_RECURSO_CANDIDATO";
  v_situacao_modelo text;
  v_comentario text := nullif(btrim(coalesce(p_comentario, '')), '');
  v_novo text;
  v_revisao integer;
  v_etapa_em timestamptz;
begin
  if p_acao is null or p_acao not in ('enviar_revisao', 'aprovar', 'devolver', 'reabrir', 'marcar_enviada') then
    raise exception 'Ação inválida' using errcode = '22023';
  end if;
  if v_uid is null then
    raise exception 'Sessão inválida' using errcode = '42501';
  end if;
  if length(coalesce(v_comentario, '')) > 2000 then
    raise exception 'O comentário passa de 2.000 caracteres' using errcode = '22023';
  end if;
  select s.* into v_atual from public."TB_RESPOSTA_RECURSO" s where s."CO_RESPOSTA_RECURSO" = p_resposta_id;
  if not found then
    raise exception 'Resposta não encontrada' using errcode = 'P0002';
  end if;
  perform private."FC_EXIGIR_RECURSO_ACESSIVEL"(v_atual."CO_RECURSO_CANDIDATO", 2);
  -- Mesma ordem de trava de salvar_resposta_recurso: o recurso, depois a resposta.
  select r.* into v_rec from public."TB_RECURSO_CANDIDATO" r
  where r."CO_RECURSO_CANDIDATO" = v_atual."CO_RECURSO_CANDIDATO" for update;
  select s.* into v_atual from public."TB_RESPOSTA_RECURSO" s
  where s."CO_RESPOSTA_RECURSO" = p_resposta_id for update;
  if p_revisao is null or p_revisao <> v_atual."NU_REVISAO" then
    raise exception 'Outra pessoa alterou esta resposta. Recarregue e tente de novo.' using errcode = '40001';
  end if;

  if p_acao = 'enviar_revisao' then
    if v_atual."TP_ESTADO" not in ('rascunho', 'devolvida') then
      raise exception 'Só rascunho ou devolvida vai para revisão' using errcode = '22023';
    end if;
    v_novo := 'em_revisao';
  elsif p_acao = 'aprovar' then
    if v_atual."TP_ESTADO" not in ('rascunho', 'em_revisao') then
      raise exception 'Só rascunho ou resposta em revisão pode ser aprovada' using errcode = '22023';
    end if;
    if (v_atual."TP_ESTADO" = 'em_revisao' or v_atual."ST_PASSOU_REVISAO" = 'S')
       and (v_uid = v_atual."CO_USUARIO_AUTOR" or v_uid is not distinct from v_atual."CO_USUARIO_ENVIO_REVISAO") then
      raise exception 'Quem escreveu ou enviou a resposta para revisão não pode aprová-la' using errcode = '42501';
    end if;
    select t."TP_SITUACAO" into v_situacao_modelo from public."TB_MODELO_RESPOSTA_RECURSO" t
    where t."CO_MODELO_RESPOSTA" = v_atual."CO_MODELO_RESPOSTA" and t."NU_VERSAO" = v_atual."NU_VERSAO_MODELO";
    if v_rec."TP_SITUACAO" = 'EM_ANALISE' then
      raise exception 'Registre a decisão do recurso antes de aprovar a resposta' using errcode = '22023';
    end if;
    if v_rec."TP_SITUACAO" <> v_situacao_modelo then
      raise exception 'A situação do recurso não é a do modelo usado na resposta' using errcode = '22023';
    end if;
    v_novo := 'aprovada';
  elsif p_acao = 'devolver' then
    if v_atual."TP_ESTADO" <> 'em_revisao' then
      raise exception 'Só resposta em revisão pode ser devolvida' using errcode = '22023';
    end if;
    if v_uid = v_atual."CO_USUARIO_AUTOR" then
      raise exception 'Quem escreveu a resposta não pode devolvê-la' using errcode = '42501';
    end if;
    if length(coalesce(v_comentario, '')) < 3 then
      raise exception 'Informe o que precisa ser ajustado (3 caracteres ou mais)' using errcode = '22023';
    end if;
    v_novo := 'devolvida';
  elsif p_acao = 'reabrir' then
    if v_atual."TP_ESTADO" <> 'aprovada' then
      raise exception 'Só resposta aprovada pode ser reaberta' using errcode = '22023';
    end if;
    if length(coalesce(v_comentario, '')) < 3 then
      raise exception 'Informe o motivo da reabertura (3 caracteres ou mais)' using errcode = '22023';
    end if;
    v_novo := 'rascunho';
  else
    if v_atual."TP_ESTADO" <> 'aprovada' then
      raise exception 'Só resposta aprovada pode ser marcada como enviada' using errcode = '22023';
    end if;
    v_novo := 'enviada';
  end if;

  update public."TB_RESPOSTA_RECURSO" set
    "TP_ESTADO" = v_novo,
    "ST_PASSOU_REVISAO" = case when p_acao = 'enviar_revisao' then 'S' else "ST_PASSOU_REVISAO" end,
    "DT_ENVIO_REVISAO" = case when p_acao = 'enviar_revisao' then now() else "DT_ENVIO_REVISAO" end,
    "CO_USUARIO_ENVIO_REVISAO" = case when p_acao = 'enviar_revisao' then v_uid else "CO_USUARIO_ENVIO_REVISAO" end,
    "DT_REVISAO" = case when p_acao in ('aprovar', 'devolver') then now() else "DT_REVISAO" end,
    "CO_USUARIO_REVISOR" = case when p_acao in ('aprovar', 'devolver') then v_uid else "CO_USUARIO_REVISOR" end,
    "DS_COMENTARIO_REVISAO" = case when p_acao in ('aprovar', 'devolver', 'reabrir') then v_comentario else "DS_COMENTARIO_REVISAO" end,
    "DT_ENVIO" = case when p_acao = 'marcar_enviada' then now() else "DT_ENVIO" end,
    "CO_USUARIO_ENVIO" = case when p_acao = 'marcar_enviada' then v_uid else "CO_USUARIO_ENVIO" end,
    "NU_REVISAO" = "NU_REVISAO" + 1,
    "DT_ATUALIZACAO" = now(),
    "CO_USUARIO_ATUALIZACAO" = v_uid
  where "CO_RESPOSTA_RECURSO" = p_resposta_id
  returning "NU_REVISAO" into v_revisao;

  insert into public."TH_RESPOSTA_RECURSO" (
    "CO_RESPOSTA_RECURSO", "TP_ACAO", "TP_ESTADO_ANTERIOR", "TP_ESTADO_NOVO", "DS_COMENTARIO",
    "CO_MODELO_RESPOSTA", "NU_VERSAO_MODELO", "DS_TEXTO_FINAL", "NU_REVISAO", "CO_USUARIO"
  ) values (
    p_resposta_id, p_acao, v_atual."TP_ESTADO", v_novo, v_comentario,
    v_atual."CO_MODELO_RESPOSTA", v_atual."NU_VERSAO_MODELO", v_atual."DS_TEXTO_FINAL", v_revisao, v_uid
  );
  insert into public."TH_RECURSO_CANDIDATO" ("CO_RECURSO_CANDIDATO", "TP_ACAO", "DS_CAMPO", "DS_VALOR_ANTERIOR", "DS_VALOR_NOVO", "DS_MOTIVO", "CO_USUARIO")
  values (v_rec."CO_RECURSO_CANDIDATO", 'resposta', p_acao, v_atual."TP_ESTADO", v_novo, v_comentario, v_uid);

  -- Resposta enviada: a etapa do recurso acompanha (se ainda não estava marcada).
  v_etapa_em := v_rec."DT_RESPOSTA_CANDIDATO";
  if p_acao = 'marcar_enviada' and v_rec."DT_RESPOSTA_CANDIDATO" is null then
    v_etapa_em := now();
    update public."TB_RECURSO_CANDIDATO" set
      "DT_RESPOSTA_CANDIDATO" = v_etapa_em,
      "CO_USUARIO_RESPOSTA_CANDIDATO" = v_uid,
      "NU_REVISAO" = "NU_REVISAO" + 1,
      "DT_ATUALIZACAO" = now(),
      "CO_USUARIO_ATUALIZACAO" = v_uid
    where "CO_RECURSO_CANDIDATO" = v_rec."CO_RECURSO_CANDIDATO";
    insert into public."TH_RECURSO_CANDIDATO" ("CO_RECURSO_CANDIDATO", "TP_ACAO", "DS_CAMPO", "DS_VALOR_ANTERIOR", "DS_VALOR_NOVO", "CO_USUARIO")
    values (v_rec."CO_RECURSO_CANDIDATO", 'etapa', 'resposta_candidato', 'N', 'S', v_uid);
  end if;

  return json_build_object('id', p_resposta_id, 'estado', v_novo, 'revisao', v_revisao, 'resposta_candidato_em', v_etapa_em);
end;
$function$;
comment on function public.transicionar_resposta_recurso(uuid, text, integer, text) is
  'Transição da resposta: enviar_revisao, aprovar, devolver (com comentário), reabrir (com comentário) ou marcar_enviada (marca também a etapa resposta_candidato do recurso). Em revisão (ou depois de passar por ela), quem escreveu ou enviou não aprova; aprovar exige o recurso decidido com a situação do modelo. Revisão → 40001. Exige recursos >= editor, a área e a coordenação do edital.';

drop function if exists private."FC_EXIGIR_PARECER_RECURSO"();
drop function if exists private."FC_PODE_PARECER_RECURSO"();

-- Modelos iniciais: de volta a "Parcialmente indeferido", só os que a migration renomeou.
update public."TB_MODELO_RESPOSTA_RECURSO" t
   set "NO_MODELO" = v.original
  from (values
    ('6f1d8a52-3b0e-4c11-9a51-000000000103'::uuid, 'Parcialmente indeferido — Análise curricular', 'Deferido parcialmente — Análise curricular'),
    ('6f1d8a52-3b0e-4c11-9a51-000000000203'::uuid, 'Parcialmente indeferido — Entrevista', 'Deferido parcialmente — Entrevista')
  ) as v(id, original, novo)
 where t."CO_MODELO_RESPOSTA" = v.id
   and t."NO_MODELO" = v.novo;

update public."TB_MODELO_RESPOSTA_RECURSO" t
   set "DS_CORPO" = replace(t."DS_CORPO",
         'comunica que o recurso foi DEFERIDO PARCIALMENTE:',
         'comunica que o recurso foi PARCIALMENTE INDEFERIDO:')
 where t."CO_MODELO_RESPOSTA" in ('6f1d8a52-3b0e-4c11-9a51-000000000103', '6f1d8a52-3b0e-4c11-9a51-000000000203')
   and t."NU_VERSAO" = 1
   and t."ST_VIGENTE" = 'S'
   and position('comunica que o recurso foi DEFERIDO PARCIALMENTE:' in t."DS_CORPO") > 0;

-- 4. Permissão 'recursos_parecer' e o grupo Jurídico ----------------------------------------
delete from public."TB_GRUPO_ACESSO" where "CO_GRUPO_ACESSO" = 'juridico';
delete from public."TA_GRUPO_ACESSO_RECURSO" where "NO_RECURSO" = 'recursos_parecer';
delete from public."TB_PERMISSAO_RECURSO" where recurso = 'recursos_parecer';
alter table public."TA_GRUPO_ACESSO_RECURSO" drop constraint "CK_GRUPACESSOREC_PARECER";
alter table public."TB_PERMISSAO_RECURSO" drop constraint "CK_PERMISSAORECURSO_PARECER";

create or replace function private."FC_RECURSOS_MODULO"()
 returns text[]
 language sql
 immutable
 set search_path to ''
as $function$
  select array['dashboard','analises','nucleo','calendario','aprovados','importacao','paineis','configuracoes','acessos','recursos','entrevistas','selecao']::text[];
$function$;

commit;
