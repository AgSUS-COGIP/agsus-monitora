/*
  Rollback de 20260929230000_recursos_modelos_anexos_respostas.sql.

  O QUE DESFAZ
    - As políticas recursos_anexos_storage_select/insert saem: ninguém mais lê
      nem envia pelo Storage.
    - As 8 RPCs novas e as 4 funções private saem.
    - get_recursos_da_area e get_recurso_candidato_detalhe voltam aos corpos
      de 20260929190200_recorte_por_coordenacao_nos_recursos.sql (copiados de
      lá, sem mudança).

  O QUE NÃO DESFAZ (de propósito)
    - O bucket recursos-anexos e os arquivos ficam: o Storage não deixa apagar
      por SQL (storage.protect_delete) e nenhum arquivo enviado se perde. Sem
      política, o bucket privado fica inacessível pela API.
    - As tabelas só saem se estiverem sem dado de uso: nenhum anexo, nenhuma
      resposta, nenhum objeto no bucket e nenhum modelo criado, editado ou
      arquivado por alguém (só os 6 da migration). Com dado, ficam (e um
      NOTICE avisa); para arquivar, copie-as antes para o schema arquivo.
    - O CHECK de TH_RECURSO_CANDIDATO volta às 4 ações só se não houver
      registro de anexo ou resposta; senão fica (o histórico não se apaga).
*/
begin;

-- 1. Storage: sem política, sem acesso (bucket e arquivos ficam) ----------------------
drop policy if exists recursos_anexos_storage_select on storage.objects;
drop policy if exists recursos_anexos_storage_insert on storage.objects;

-- 2. RPCs novas -----------------------------------------------------------------------
drop function if exists public.listar_modelos_resposta_recurso();
drop function if exists public.salvar_modelo_resposta_recurso(jsonb);
drop function if exists public.arquivar_modelo_resposta_recurso(uuid, text);
drop function if exists public.salvar_resposta_recurso(jsonb);
drop function if exists public.transicionar_resposta_recurso(uuid, text, integer, text);
drop function if exists public.registrar_anexo_recurso(uuid, text, text, text, uuid);
drop function if exists public.arquivar_anexo_recurso(uuid, text);
drop function if exists public.registrar_download_anexo_recurso(uuid);

-- 3. Leitura e detalhe: os corpos de 20260929190200 -----------------------------------
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
             a.nota_final_ajustada, a.status_consolidado
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
            'revisao', r."NU_REVISAO"
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
      )
    )
    from public."TB_RECURSO_CANDIDATO" r
    left join public."TB_ANALISE_CURRICULAR" a on a.id = r."CO_ANALISE_CURRICULAR"
    where r."CO_RECURSO_CANDIDATO" = p_id
  );
end;
$function$;

-- 4. Funções auxiliares -----------------------------------------------------------------
drop function if exists private."FC_PODE_BAIXAR_ANEXO_RECURSO"(text);
drop function if exists private."FC_PODE_ANEXO_RECURSO"(text, integer);
drop function if exists private."FC_EXIGIR_RECURSO_ACESSIVEL"(uuid, integer);
drop function if exists private."FC_MARCADORES_MODELO_RESPOSTA"();

-- 5. Tabelas (só sem dado de uso) e o CHECK do histórico do recurso -------------------
do $$
declare
  v_com_dados boolean;
begin
  v_com_dados := exists (select 1 from public."TB_ANEXO_RECURSO")
    or exists (select 1 from public."TB_RESPOSTA_RECURSO")
    or exists (select 1 from storage.objects o where o.bucket_id = 'recursos-anexos')
    or exists (select 1 from public."TB_MODELO_RESPOSTA_RECURSO" t
               where t."CO_USUARIO_CRIACAO" is not null or t."CO_USUARIO_ARQUIVAMENTO" is not null);
  if v_com_dados then
    raise notice 'Tabelas de anexos, respostas e modelos mantidas: há dados de uso (copie para o schema arquivo antes de apagar).';
  else
    drop table public."TH_ANEXO_RECURSO";
    drop table public."TB_ANEXO_RECURSO";
    drop table public."TH_RESPOSTA_RECURSO";
    drop table public."TB_RESPOSTA_RECURSO";
    drop table public."TB_MODELO_RESPOSTA_RECURSO";
  end if;

  if exists (select 1 from public."TH_RECURSO_CANDIDATO" h where h."TP_ACAO" in ('anexo', 'resposta')) then
    raise notice 'CK_HISTRECURSO_TPACAO mantido com anexo e resposta: há histórico dessas ações.';
  else
    alter table public."TH_RECURSO_CANDIDATO" drop constraint "CK_HISTRECURSO_TPACAO";
    alter table public."TH_RECURSO_CANDIDATO" add constraint "CK_HISTRECURSO_TPACAO"
      check ("TP_ACAO" in ('criacao', 'edicao', 'etapa', 'exclusao'));
    comment on constraint "CK_HISTRECURSO_TPACAO" on public."TH_RECURSO_CANDIDATO" is 'Ações registradas.';
    comment on column public."TH_RECURSO_CANDIDATO"."TP_ACAO" is 'criacao, edicao, etapa ou exclusao.';
    comment on column public."TH_RECURSO_CANDIDATO"."DS_CAMPO" is 'Campo editado ou etapa (download_empregare, processo_sei, upload_sei, resposta_candidato). Nulo na criação e na exclusão.';
  end if;
end;
$$;

commit;
