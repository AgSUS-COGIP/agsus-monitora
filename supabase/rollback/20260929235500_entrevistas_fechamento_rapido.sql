-- Volta finalizar_sync_entrevistas à versão linha a linha de 20260929235000_entrevistas.
begin;

create or replace function public.finalizar_sync_entrevistas(p_sync text, p_area text, p_forcar boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_sync public."TL_SYNC_ENTREVISTA";
  v_ativas integer;
  v_desativadas integer;
  v_ligadas integer;
  v_sem_analise integer;
  v_sem_edital integer;
begin
  select * into v_sync from public."TL_SYNC_ENTREVISTA" s where s."CO_SYNC" = p_sync for update;
  if v_sync."CO_SYNC" is null or v_sync."CO_AREA" <> p_area or v_sync."TP_SITUACAO" <> 'EM_ANDAMENTO' then
    raise exception 'Carga % não encontrada, de outra área ou já fechada', p_sync using errcode = '22023';
  end if;

  select count(*) into v_ativas from public."TB_ENTREVISTA" e
   where e."CO_AREA" = p_area and e."TP_ORIGEM" = 'planilha' and e."ST_ATIVO" = 'S';
  if not coalesce(p_forcar, false) and v_ativas > 0 and v_sync."QT_LINHA" * 2 < v_ativas then
    update public."TL_SYNC_ENTREVISTA" set "TP_SITUACAO" = 'RECUSADA', "DT_FIM" = now(),
      "DS_MENSAGEM" = format('Carga com %s linhas e %s ativas no banco: menos da metade. Nada foi desativado; confira a planilha ou rode com forçar.', v_sync."QT_LINHA", v_ativas)
     where "CO_SYNC" = p_sync;
    return jsonb_build_object('situacao', 'RECUSADA', 'linhas', v_sync."QT_LINHA", 'ativas', v_ativas);
  end if;

  update public."TB_ENTREVISTA" e set "ST_ATIVO" = 'N', "DT_ATUALIZACAO" = now()
   where e."CO_AREA" = p_area and e."TP_ORIGEM" = 'planilha' and e."ST_ATIVO" = 'S'
     and e."CO_SYNC" is distinct from p_sync;
  get diagnostics v_desativadas = row_count;

  -- Edital: número + área; com mais de um, o da mesma unidade.
  with alvo as (
    select e."CO_ENTREVISTA", (
      select m1.id from public."TB_MONITORAMENTO_INDIGENA" m1
       where m1."CO_AREA" = e."CO_AREA"
         and private."FC_NUMERO_EDITAL"(m1.edital) = private."FC_NUMERO_EDITAL"(e."DS_EDITAL")
       order by (private."FC_TEXTO_BUSCA_RECURSO"(m1.unidade) = private."FC_TEXTO_BUSCA_RECURSO"(e."NO_UNIDADE")) desc,
                m1.ativo desc
       limit 1) as edital_id
      from public."TB_ENTREVISTA" e
     where e."CO_AREA" = p_area and e."ST_ATIVO" = 'S'
  )
  update public."TB_ENTREVISTA" e set "CO_MONITORAMENTO" = alvo.edital_id
    from alvo
   where e."CO_ENTREVISTA" = alvo."CO_ENTREVISTA"
     and e."CO_MONITORAMENTO" is distinct from alvo.edital_id;

  -- Análise: código do candidato + vaga; senão nome sem acento + vaga.
  with alvo as (
    select e."CO_ENTREVISTA", x.id, x.modo
      from public."TB_ENTREVISTA" e
      left join lateral (
        select c.id, c.modo from (
          select a.id, 'codigo'::text as modo, 1 as prioridade, a.ativo, a.edital
            from public."TB_ANALISE_CURRICULAR" a
           where e."CO_CANDIDATO" is not null
             and a."CO_AREA" = e."CO_AREA" and a.codigo_vaga = e."CO_VAGA" and a.id_origem = e."CO_CANDIDATO"
          union all
          select a.id, 'nome', 2, a.ativo, a.edital
            from public."TB_ANALISE_CURRICULAR" a
           where a."CO_AREA" = e."CO_AREA" and a.codigo_vaga = e."CO_VAGA"
             and private."FC_TEXTO_BUSCA_RECURSO"(a.candidato) = private."FC_TEXTO_BUSCA_RECURSO"(e."NO_CANDIDATO")
        ) c
        order by c.prioridade,
                 (private."FC_NUMERO_EDITAL"(c.edital) = private."FC_NUMERO_EDITAL"(e."DS_EDITAL")) desc,
                 c.ativo desc
        limit 1
      ) x on true
     where e."CO_AREA" = p_area and e."ST_ATIVO" = 'S'
  )
  update public."TB_ENTREVISTA" e set "CO_ANALISE_CURRICULAR" = alvo.id, "TP_LIGACAO_ANALISE" = alvo.modo
    from alvo
   where e."CO_ENTREVISTA" = alvo."CO_ENTREVISTA"
     and (e."CO_ANALISE_CURRICULAR" is distinct from alvo.id or e."TP_LIGACAO_ANALISE" is distinct from alvo.modo);

  select count(*) filter (where e."CO_ANALISE_CURRICULAR" is not null),
         count(*) filter (where e."CO_ANALISE_CURRICULAR" is null),
         count(*) filter (where e."CO_MONITORAMENTO" is null)
    into v_ligadas, v_sem_analise, v_sem_edital
    from public."TB_ENTREVISTA" e
   where e."CO_AREA" = p_area and e."ST_ATIVO" = 'S';

  update public."TL_SYNC_ENTREVISTA" set
    "TP_SITUACAO" = 'CONCLUIDA', "DT_FIM" = now(),
    "QT_LIGADA_ANALISE" = v_ligadas, "QT_SEM_ANALISE" = v_sem_analise,
    "QT_SEM_EDITAL" = v_sem_edital, "QT_DESATIVADA" = v_desativadas,
    "DS_MENSAGEM" = case when coalesce(p_forcar, false) then 'Fechada com forçar.' end
   where "CO_SYNC" = p_sync;

  return jsonb_build_object('situacao', 'CONCLUIDA', 'linhas', v_sync."QT_LINHA",
    'ligadas_analise', v_ligadas, 'sem_analise', v_sem_analise,
    'sem_edital', v_sem_edital, 'desativadas', v_desativadas);
end;
$function$;

commit;
