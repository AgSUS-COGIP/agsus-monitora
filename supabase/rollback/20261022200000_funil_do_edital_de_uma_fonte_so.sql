/*
  ROLLBACK de supabase/migrations/20261022200000_funil_do_edital_de_uma_fonte_so.sql

  Volta as funções às versões anteriores (cada uma copiada da migration de
  origem, indicada acima de cada bloco), tira as duas restrições e as duas
  funções novas. As colunas "TP_FONTE_FUNIL" e "DT_FONTE_FUNIL" ficam (nulas
  depois do próximo recálculo não importam: a função antiga não as lê) porque a
  view operacional as seleciona e CREATE OR REPLACE VIEW não tira coluna; a
  leitura do monitoramento (listar_monitoramento_operacional) volta às 40
  colunas de antes. As entrevistas desativadas como "repetida" não voltam
  sozinhas: a próxima carga da planilha as reativa (upsert com ST_ATIVO = 'S').
  Os KPIs são recalculados no fim pela função antiga.
*/
begin;

set local lock_timeout = '10s';

alter table public."TB_MONITORAMENTO_INDIGENA" drop constraint if exists "CK_MONIT_INDIG_APTOS_INSCRITOS";
alter table public."TB_MONITORAMENTO_INDIGENA" drop constraint if exists "CK_MONIT_INDIG_FONTE_FUNIL";

-- O funil volta a NOT NULL (nulo = sem fonte vira 0, como era).
update public."TB_MONITORAMENTO_INDIGENA" set inscritos = coalesce(inscritos, 0), aptos_analise = coalesce(aptos_analise, 0),
  cancelados = coalesce(cancelados, 0), eliminados_nota = coalesce(eliminados_nota, 0),
  total_eliminados = coalesce(total_eliminados, 0), reprovados_analise = coalesce(reprovados_analise, 0)
 where inscritos is null or aptos_analise is null or cancelados is null or eliminados_nota is null
    or total_eliminados is null or reprovados_analise is null;
alter table public."TB_MONITORAMENTO_INDIGENA"
  alter column inscritos set not null, alter column aptos_analise set not null,
  alter column cancelados set not null, alter column eliminados_nota set not null,
  alter column total_eliminados set not null, alter column reprovados_analise set not null;

-- De 20261002180000_datas_validas_e_inscritos_pelas_analises.sql
create or replace function private."FC_ATUALIZAR_KPIS_PELA_SELECAO"()
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_qt integer;
begin
  with ed as materialized (
    select m.id, m."CO_AREA",
           coalesce(private."FC_NUMERO_EDITAL"(m.edital),
                    nullif('nome:' || private."FC_TEXTO_BUSCA_RECURSO"(m.edital), 'nome:')) as chave
      from public."TB_MONITORAMENTO_INDIGENA" m
     where m.ativo
  ),
  -- A chave da análise só vale quando aponta para um edital só na área.
  chave_unica as (
    select e."CO_AREA", e.chave, min(e.id::text)::uuid as id
      from ed e
     where e.chave is not null
     group by 1, 2
    having count(*) = 1
  ),
  sel as (
    select s."CO_MONITORAMENTO" id,
           sum(coalesce(s."QT_INSCRITO", 0))::integer inscritos,
           sum(coalesce(s."QT_APTO_ANALISE", 0))::integer aptos,
           sum(coalesce(s."QT_CANCELADO", 0))::integer cancelados,
           sum(coalesce(s."QT_ELIMINADO_NOTA", 0))::integer eliminados_nota,
           sum(coalesce(s."QT_REPROVADO_ANALISE", 0))::integer reprovados,
           sum(coalesce(s."QT_TOTAL_ELIMINADO", 0))::integer total_eliminados
      from public."TB_SELECAO_VAGA" s
     where s."ST_REGISTRO_ATIVO" = 'S' and s."CO_MONITORAMENTO" in (select id from ed)
     group by 1
  ),
  -- Cada fonte só conta para o edital que ela cobre (linha no grupo = tem a fonte).
  aprov as (
    select u.id, (count(*) filter (where a.status_consolidado = 'Aprovado'))::integer qt,
           count(*)::integer candidatos
      from chave_unica u
      join public."TB_ANALISE_CURRICULAR" a
        on a."CO_AREA" = u."CO_AREA" and a.ativo
       and coalesce(private."FC_NUMERO_EDITAL"(a.edital),
                    nullif('nome:' || private."FC_TEXTO_BUSCA_RECURSO"(a.edital), 'nome:')) = u.chave
     group by 1
  ),
  entr as (
    select e."CO_MONITORAMENTO" id, (count(*) filter (where e."TP_PARECER" in ('APTO', 'INAPTO')))::integer qt
      from public."TB_ENTREVISTA" e
     where e."ST_ATIVO" = 'S' and e."CO_MONITORAMENTO" in (select id from ed)
     group by 1
  ),
  contr as (
    select l.edital_id::uuid id,
           (count(c.id) filter (where c.status in ('Contratado', 'Migração')))::integer qt
      from public."TB_LISTA_APROVADO" l
      left join public."TB_CANDIDATO_APROVADO" c on c.lista_id = l.id and c.removido_em is null
     where l.vigente is true and l.edital_id in (select id::text from ed)
     group by 1
  ),
  novo as (
    select t.id, coalesce(s.inscritos, a.candidatos) inscritos, s.aptos, s.cancelados, s.eliminados_nota, s.reprovados, s.total_eliminados,
           a.qt aprovados, e.qt entrevistados, c.qt contratados
      from ed t
      left join sel s on s.id = t.id
      left join aprov a on a.id = t.id
      left join entr e on e.id = t.id
      left join contr c on c.id = t.id
     where s.id is not null or a.id is not null or e.id is not null or c.id is not null
  )
  update public."TB_MONITORAMENTO_INDIGENA" m
     set inscritos = coalesce(n.inscritos, m.inscritos),
         aptos_analise = coalesce(n.aptos, m.aptos_analise),
         cancelados = coalesce(n.cancelados, m.cancelados),
         eliminados_nota = coalesce(n.eliminados_nota, m.eliminados_nota),
         reprovados_analise = coalesce(n.reprovados, m.reprovados_analise),
         total_eliminados = coalesce(n.total_eliminados, m.total_eliminados),
         aprovados_analise = coalesce(n.aprovados, m.aprovados_analise),
         entrevistados = coalesce(n.entrevistados, m.entrevistados),
         contratados = coalesce(n.contratados, m.contratados),
         updated_at = now()
    from novo n
   where m.id = n.id
     and (m.inscritos, m.aptos_analise, m.cancelados, m.eliminados_nota, m.reprovados_analise,
          m.total_eliminados, m.aprovados_analise, m.entrevistados, m.contratados)
         is distinct from
         (coalesce(n.inscritos, m.inscritos), coalesce(n.aptos, m.aptos_analise),
          coalesce(n.cancelados, m.cancelados), coalesce(n.eliminados_nota, m.eliminados_nota),
          coalesce(n.reprovados, m.reprovados_analise), coalesce(n.total_eliminados, m.total_eliminados),
          coalesce(n.aprovados, m.aprovados_analise), coalesce(n.entrevistados, m.entrevistados),
          coalesce(n.contratados, m.contratados));
  get diagnostics v_qt = row_count;
  return v_qt;
end;
$function$;
comment on function private."FC_ATUALIZAR_KPIS_PELA_SELECAO"() is 'Recalcula os KPIs de todo edital ativo (TB_MONITORAMENTO_INDIGENA) que tem a fonte: Seleção nativa (pelo id), lista de aprovados vigente (pelo id), entrevistas (pelo id) e análises (número do edital ou nome, quando único na área). Inscritos: Seleção; sem vaga do edital na Seleção, o total de candidatos das análises (piso). Sem a fonte, o valor anterior fica; só grava o que mudou. Devolve quantos editais mudaram.';
revoke all on function private."FC_ATUALIZAR_KPIS_PELA_SELECAO"() from public, anon, authenticated;

-- De 20261016160000_conflito_de_versao_sem_repeticao.sql
CREATE OR REPLACE FUNCTION public.convocar_para_entrevista(p_edital uuid, p_lista uuid, p_analises uuid[])
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_area text := private."FC_EXIGIR_ENTREVISTAS_EDITAL"(p_edital, 2);
  v_m public."TB_MONITORAMENTO_INDIGENA";
  v_roteiro uuid;
  v_vigente uuid;
  v_fora integer;
  v_qt integer;
begin
  select "CO_ROTEIRO" into v_roteiro from public."TB_ENTREVISTA_EDITAL" where "CO_MONITORAMENTO" = p_edital;
  if v_roteiro is null then raise exception 'Configure a entrevista do edital antes de convocar' using errcode = '23514'; end if;
  if coalesce(cardinality(p_analises), 0) not between 1 and 2000 then raise exception 'Escolha de 1 a 2000 candidatos' using errcode = '22023'; end if;

  -- Uma convocação por vez no edital; a tela tem de estar na lista vigente.
  perform pg_advisory_xact_lock(hashtextextended('convocacao_entrevista:' || p_edital::text, 0));
  v_vigente := private."FC_LISTA_CONVOCACAO_VIGENTE"(p_edital);
  if v_vigente is null then
    raise exception 'Gere a lista de convocação na Classificação antes de convocar' using errcode = '23514';
  end if;
  if p_lista is distinct from v_vigente then
    raise exception 'A lista de convocação mudou na Classificação; recarregue' using errcode = 'PT409';
  end if;
  select count(*) into v_fora
    from (select distinct x.analise from unnest(p_analises) x(analise)) s
   where s.analise is null
      or not exists (select 1 from private."FC_CONVOCADOS_DA_LISTA"(v_vigente) c(analise) where c.analise = s.analise);
  if v_fora > 0 then
    raise exception '% candidato(s) fora da lista de convocação vigente da Classificação', v_fora using errcode = '23514';
  end if;

  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" where id = p_edital;
  insert into public."TB_ENTREVISTA" as e ("CO_AREA", "CO_MONITORAMENTO", "CO_ANALISE_CURRICULAR", "TP_LIGACAO_ANALISE",
    "NO_UNIDADE", "DS_EDITAL", "CO_VAGA", "NO_CANDIDATO", "CO_CANDIDATO", "DS_MODALIDADE", "NO_CARGO", "TP_PARECER",
    "TP_ORIGEM", "DS_CHAVE_ORIGEM", "CO_ROTEIRO", "ST_ATIVO")
  select v_area, p_edital, a.id, 'codigo', left(coalesce(v_m.unidade, ''), 200), left(v_m.edital, 120), left(a.codigo_vaga, 60),
         left(a.candidato, 200), left(a.id_origem, 60), left(a.modalidade_concorrencia, 300), left(a.nome_vaga, 400), 'SEM_PARECER',
         'sistema', 'sistema|' || p_edital || '|' || a.id, v_roteiro, 'S'
    from public."TB_ANALISE_CURRICULAR" a
   where a.id = any (p_analises) and a."CO_AREA" = v_area
     and private."FC_NUMERO_EDITAL"(a.edital) = private."FC_NUMERO_EDITAL"(v_m.edital)
  on conflict ("DS_CHAVE_ORIGEM") do update set "ST_ATIVO" = 'S', "CO_ROTEIRO" = excluded."CO_ROTEIRO", "DT_ATUALIZACAO" = now();
  get diagnostics v_qt = row_count;

  insert into public."TH_ENTREVISTA_AVALIACAO" ("CO_ENTREVISTA", "DS_CAMPO", "DS_VALOR_NOVO", "CO_USUARIO")
  select e."CO_ENTREVISTA", 'convocacao', 'convocado pela lista ' || v_vigente, (select auth.uid())
    from public."TB_ENTREVISTA" e where e."DS_CHAVE_ORIGEM" = any (select 'sistema|' || p_edital || '|' || x from unnest(p_analises) x);

  return json_build_object('convocados', v_qt, 'lista', v_vigente, 'dados', public.obter_entrevistas_do_edital(p_edital));
end;
$function$;

-- De 20260929235500_entrevistas_fechamento_rapido.sql (com o limite de 20261015120000)
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

  -- Tudo em conjunto (uma passada por tabela): no plano atual do banco, a
  -- busca linha a linha passava dos 8 s com 3.400 entrevistas.
  -- Edital: número + área; com mais de um, o da mesma unidade.
  with ent as materialized (
    select e."CO_ENTREVISTA", e."CO_MONITORAMENTO",
           private."FC_NUMERO_EDITAL"(e."DS_EDITAL") as num,
           private."FC_TEXTO_BUSCA_RECURSO"(e."NO_UNIDADE") as uni
      from public."TB_ENTREVISTA" e
     where e."CO_AREA" = p_area and e."ST_ATIVO" = 'S'
  ), m as materialized (
    select m1.id, private."FC_NUMERO_EDITAL"(m1.edital) as num,
           private."FC_TEXTO_BUSCA_RECURSO"(m1.unidade) as uni, m1.ativo
      from public."TB_MONITORAMENTO_INDIGENA" m1
     where m1."CO_AREA" = p_area
  ), alvo as (
    select distinct on (ent."CO_ENTREVISTA") ent."CO_ENTREVISTA", ent."CO_MONITORAMENTO" as atual, m.id
      from ent
      left join m on m.num = ent.num
     order by ent."CO_ENTREVISTA", (m.uni = ent.uni) desc nulls last, m.ativo desc nulls last
  )
  update public."TB_ENTREVISTA" e set "CO_MONITORAMENTO" = alvo.id
    from alvo
   where e."CO_ENTREVISTA" = alvo."CO_ENTREVISTA"
     and alvo.atual is distinct from alvo.id;

  -- Análise: código do candidato + vaga; senão nome sem acento + vaga.
  with ent as materialized (
    select e."CO_ENTREVISTA", e."CO_ANALISE_CURRICULAR" as atual, e."TP_LIGACAO_ANALISE" as modo_atual,
           e."CO_VAGA", e."CO_CANDIDATO",
           private."FC_NUMERO_EDITAL"(e."DS_EDITAL") as num,
           private."FC_TEXTO_BUSCA_RECURSO"(e."NO_CANDIDATO") as nome
      from public."TB_ENTREVISTA" e
     where e."CO_AREA" = p_area and e."ST_ATIVO" = 'S'
  ), an as materialized (
    select a.id, a.codigo_vaga, a.id_origem, a.ativo,
           private."FC_NUMERO_EDITAL"(a.edital) as num,
           private."FC_TEXTO_BUSCA_RECURSO"(a.candidato) as nome
      from public."TB_ANALISE_CURRICULAR" a
     where a."CO_AREA" = p_area
       and a.codigo_vaga in (select distinct ent."CO_VAGA" from ent)
  ), cand as (
    select ent."CO_ENTREVISTA", an.id,
           case when ent."CO_CANDIDATO" is not null and an.id_origem = ent."CO_CANDIDATO" then 'codigo' else 'nome' end as modo,
           an.num = ent.num as mesmo_edital, an.ativo
      from ent
      join an on an.codigo_vaga = ent."CO_VAGA"
             and ((ent."CO_CANDIDATO" is not null and an.id_origem = ent."CO_CANDIDATO") or an.nome = ent.nome)
  ), melhor as (
    select distinct on (c."CO_ENTREVISTA") c."CO_ENTREVISTA", c.id, c.modo
      from cand c
     order by c."CO_ENTREVISTA", (c.modo = 'codigo') desc, c.mesmo_edital desc nulls last, c.ativo desc
  ), alvo as (
    select ent."CO_ENTREVISTA", ent.atual, ent.modo_atual, melhor.id, melhor.modo
      from ent left join melhor on melhor."CO_ENTREVISTA" = ent."CO_ENTREVISTA"
  )
  update public."TB_ENTREVISTA" e set "CO_ANALISE_CURRICULAR" = alvo.id, "TP_LIGACAO_ANALISE" = alvo.modo
    from alvo
   where e."CO_ENTREVISTA" = alvo."CO_ENTREVISTA"
     and (alvo.atual is distinct from alvo.id or alvo.modo_atual is distinct from alvo.modo);

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
alter function public.finalizar_sync_entrevistas(text, text, boolean) set statement_timeout = '30s';

-- De 20261007230000_edital_de_treinamento.sql
CREATE OR REPLACE FUNCTION private."FC_MONTAR_ENTREVISTAS_AREA"(p_area text, p_editais uuid[])
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  return (
    with e as (
      select e.*
        from public."TB_ENTREVISTA" e
       where e."CO_AREA" = p_area and e."ST_ATIVO" = 'S'
         and not private."FC_EDITAL_EH_TREINAMENTO"(e."CO_MONITORAMENTO")
         and (p_editais is null or e."CO_MONITORAMENTO" = any (p_editais))
    ),
    criterios as (
      select n."DS_CRITERIO" as criterio, row_number() over (order by min(n."NU_ORDEM"), n."DS_CRITERIO") - 1 as i
        from public."TB_ENTREVISTA_NOTA" n
        join e on e."CO_ENTREVISTA" = n."CO_ENTREVISTA"
       where n."VL_NOTA" is not null
       group by n."DS_CRITERIO"
    ),
    vagas as (
      select distinct e."CO_VAGA" from e
    ),
    sem_entrevista as (
      select a.id, a.candidato, a.id_origem, a.codigo_vaga, a.nome_vaga, a.edital, a.unidade,
             a.nota_final_ajustada, a.modalidade_concorrencia
        from public."TB_ANALISE_CURRICULAR" a
        join vagas v on v."CO_VAGA" = a.codigo_vaga
       where a."CO_AREA" = p_area and a.ativo
         and not private."FC_ANALISE_EH_TREINAMENTO"(a.origem_planilha)
         and a.status_consolidado = 'Aprovado'
         and not exists (select 1 from public."TB_ENTREVISTA" x
                          where x."CO_ANALISE_CURRICULAR" = a.id and x."ST_ATIVO" = 'S')
         and (p_editais is null or exists (
               select 1 from public."TB_MONITORAMENTO_INDIGENA" m
                where m.id = any (p_editais) and m."CO_AREA" = a."CO_AREA"
                  and private."FC_NUMERO_EDITAL"(m.edital) = private."FC_NUMERO_EDITAL"(a.edital)))
       order by a.edital, a.codigo_vaga, a.candidato
       limit 3000
    )
    select json_build_object(
      'schema_version', 1,
      'area', p_area,
      'gerado_em', now(),
      'ultima_carga', (
        select json_build_object('em', s."DT_FIM", 'linhas', s."QT_LINHA",
                                 'ligadas_analise', s."QT_LIGADA_ANALISE",
                                 'sem_analise', s."QT_SEM_ANALISE", 'sem_edital', s."QT_SEM_EDITAL")
          from public."TL_SYNC_ENTREVISTA" s
         where s."CO_AREA" = p_area and s."TP_SITUACAO" = 'CONCLUIDA'
         order by s."DT_FIM" desc limit 1
      ),
      'criterios', (select coalesce(json_agg(c.criterio order by c.i), '[]'::json) from criterios c),
      'entrevistas', (
        select coalesce(json_agg(json_build_object(
            'id', e."CO_ENTREVISTA",
            'edital_id', e."CO_MONITORAMENTO",
            'edital', coalesce(m.edital, e."DS_EDITAL"),
            'edital_planilha', e."DS_EDITAL",
            'unidade', coalesce(m.unidade, e."NO_UNIDADE"),
            'vaga', e."CO_VAGA",
            'cargo', coalesce(a.nome_vaga, e."NO_CARGO"),
            'candidato', e."NO_CANDIDATO",
            'codigo', e."CO_CANDIDATO",
            'modalidade', coalesce(a.modalidade_concorrencia, e."DS_MODALIDADE"),
            'nota', e."VL_NOTA_TOTAL",
            'parecer', e."TP_PARECER",
            'compareceu', e."ST_COMPARECEU",
            'link', e."DS_LINK_PLANILHA",
            'notas', (
              select coalesce(json_agg(json_build_array(c.i, n."VL_NOTA") order by n."NU_ORDEM"), '[]'::json)
                from public."TB_ENTREVISTA_NOTA" n
                join criterios c on c.criterio = n."DS_CRITERIO"
               where n."CO_ENTREVISTA" = e."CO_ENTREVISTA" and n."VL_NOTA" is not null
            ),
            'analise', case when a.id is null then null else json_build_object(
              'id', a.id,
              'ligacao', e."TP_LIGACAO_ANALISE",
              'nota', a.nota_final_ajustada,
              'resultado', a.status_consolidado,
              'etapa', a.etapa,
              'responsavel', a.responsavel_analise,
              'ativo', a.ativo
            ) end
          ) order by coalesce(m.edital, e."DS_EDITAL"), e."CO_VAGA", e."VL_NOTA_TOTAL" desc nulls last, e."NO_CANDIDATO"), '[]'::json)
          from e
          left join public."TB_MONITORAMENTO_INDIGENA" m on m.id = e."CO_MONITORAMENTO"
          left join public."TB_ANALISE_CURRICULAR" a on a.id = e."CO_ANALISE_CURRICULAR"
      ),
      'aprovados_sem_entrevista', (
        select coalesce(json_agg(json_build_object(
            'analise_id', s.id,
            'candidato', s.candidato,
            'codigo', s.id_origem,
            'vaga', s.codigo_vaga,
            'cargo', s.nome_vaga,
            'edital', s.edital,
            'unidade', s.unidade,
            'nota', s.nota_final_ajustada,
            'modalidade', s.modalidade_concorrencia
          )), '[]'::json)
          from sem_entrevista s
      )
    )
  );
end;
$function$;
-- De 20261001130000_selecao_aprovados_outras_bancas.sql
create or replace function public.get_selecao_da_area(p_area text)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_editais uuid[];
begin
  if not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = p_area) then
    raise exception 'Área inválida' using errcode = '22023';
  end if;
  if not private.pode_recurso('selecao', 1) then
    raise exception 'Sem permissão para Seleção' using errcode = '42501';
  end if;
  if not private."FC_PODE_AREA"(p_area) then
    raise exception 'Sem acesso a esta área' using errcode = '42501';
  end if;
  v_editais := (select private."FC_EDITAIS_VISIVEIS"())::uuid[];

  return (
    with s as (
      select s.*, private."FC_NUMERO_EDITAL"(s."DS_EDITAL") as numero
        from public."TB_SELECAO_VAGA" s
       where s."CO_AREA" = p_area and s."ST_REGISTRO_ATIVO" = 'S'
         and (v_editais is null or s."CO_MONITORAMENTO" = any (v_editais))
    ),
    -- Convocados: entrevistas ativas (planilha ou sistema) por edital e vaga.
    convocados as (
      select private."FC_NUMERO_EDITAL"(e."DS_EDITAL") as numero, e."CO_VAGA" as vaga, count(*)::integer as qt
        from public."TB_ENTREVISTA" e
       where e."CO_AREA" = p_area and e."ST_ATIVO" = 'S'
       group by 1, 2
    ),
    editais_com_entrevista as (
      select distinct c.numero from convocados c where c.numero is not null
    ),
    -- Lista de aprovados vigente dos editais ligados.
    listas as (
      select l.id, l.edital_id
        from public."TB_LISTA_APROVADO" l
       where l.vigente is true
         and l.edital_id in (select s."CO_MONITORAMENTO"::text from s where s."CO_MONITORAMENTO" is not null)
    ),
    aprovados as (
      select l.edital_id, regexp_replace(coalesce(c.codigo_vaga, ''), '[^0-9]', '', 'g') as vaga,
             count(*)::integer as total,
             (count(*) filter (where c.status in ('Contratado', 'Migração')))::integer as contratados
        from listas l
        join public."TB_CANDIDATO_APROVADO" c on c.lista_id = l.id and c.removido_em is null
       group by 1, 2
    ),
    -- Outras bancas (CESPE, FGV…): sem código numérico, o "id da vaga" da lista é
    -- o nome do cargo. Chave: o texto sem acento, caixa nem pontuação.
    aprovados_por_cargo as (
      select l.edital_id,
             btrim(regexp_replace(private."FC_TEXTO_BUSCA_RECURSO"(c.codigo_vaga), '[^a-z0-9]+', ' ', 'g')) as cargo,
             count(*)::integer as total,
             (count(*) filter (where c.status in ('Contratado', 'Migração')))::integer as contratados
        from listas l
        join public."TB_CANDIDATO_APROVADO" c on c.lista_id = l.id and c.removido_em is null
       group by 1, 2
    ),
    linhas as (
      select s.*,
             m.edital as edital_cadastrado,
             (s.numero is not null and s.numero in (select x.numero from editais_com_entrevista x)) as usa_entrevistas,
             cv.qt as qt_convocado_entrevistas,
             exists (select 1 from listas l where l.edital_id = s."CO_MONITORAMENTO"::text) as tem_lista,
             coalesce(ap.total, apc.total) as qt_aprovado,
             coalesce(ap.contratados, apc.contratados) as qt_contratado
        from s
        left join public."TB_MONITORAMENTO_INDIGENA" m on m.id = s."CO_MONITORAMENTO"
        left join convocados cv on cv.numero = s.numero and cv.vaga = s."CO_VAGA"
        left join aprovados ap on ap.edital_id = s."CO_MONITORAMENTO"::text and ap.vaga = s."CO_VAGA"
        -- Vaga sem código (outra banca): pelo nome do cargo; a 2ª vaga de mesmo nome
        -- (chave com #2…) não recebe de novo os mesmos aprovados.
        left join aprovados_por_cargo apc
          on s."CO_VAGA" is null
         and s."DS_CHAVE_ORIGEM" !~ '#[0-9]+$'
         and apc.edital_id = s."CO_MONITORAMENTO"::text
         and apc.cargo = btrim(regexp_replace(private."FC_TEXTO_BUSCA_RECURSO"(s."DS_VAGA_PLANILHA"), '[^a-z0-9]+', ' ', 'g'))
    )
    select json_build_object(
      'schema_version', 1,
      'area', p_area,
      'gerado_em', now(),
      'ultima_carga', (
        select json_build_object('em', t."DT_FIM", 'linhas', t."QT_LINHA", 'sem_edital', t."QT_SEM_EDITAL")
          from public."TL_SYNC_SELECAO" t
         where t."TP_SITUACAO" = 'CONCLUIDA'
         order by t."DT_FIM" desc limit 1
      ),
      'vagas', (
        select coalesce(json_agg(json_build_object(
            'id', l."CO_SELECAO_VAGA",
            'edital_id', l."CO_MONITORAMENTO",
            'edital', coalesce(l.edital_cadastrado, l."DS_EDITAL"),
            'edital_planilha', l."DS_EDITAL",
            'unidade', l."NO_UNIDADE",
            'vaga', l."CO_VAGA",
            'vaga_planilha', l."DS_VAGA_PLANILHA",
            'cargo', l."NO_CARGO",
            'inscritos', l."QT_INSCRITO",
            'aptos', l."QT_APTO_ANALISE",
            'cancelados', l."QT_CANCELADO",
            'reprovados_questionario', l."QT_REPROVADO_QUESTIONARIO",
            'eliminados_nota', l."QT_ELIMINADO_NOTA",
            'reprovados_analise', l."QT_REPROVADO_ANALISE",
            'triados', l."QT_TRIADO",
            'total_eliminados', l."QT_TOTAL_ELIMINADO",
            'observacao', l."DS_OBSERVACAO",
            'convocados', case when l.usa_entrevistas then coalesce(l.qt_convocado_entrevistas, 0)
                               else l."QT_CONVOCADO_PLANILHA" end,
            'origem_convocados', case when l.usa_entrevistas then 'entrevistas' else 'planilha' end,
            'aprovados', case when l.tem_lista then coalesce(l.qt_aprovado, 0) end,
            'contratados', case when l.tem_lista then coalesce(l.qt_contratado, 0) end,
            'nao_contratados', case when l.tem_lista then coalesce(l.qt_aprovado, 0) - coalesce(l.qt_contratado, 0) end
          ) order by coalesce(l.edital_cadastrado, l."DS_EDITAL"), l."NO_UNIDADE", l."NO_CARGO", l."CO_VAGA"), '[]'::json)
          from linhas l
      )
    )
  );
end;
$function$;
comment on function public.get_selecao_da_area(text) is
  'Leitura da aba Seleção de uma área (json): o funil de cada vaga (aba Resultado da Auditoria), os convocados (TB_ENTREVISTA quando o edital tem entrevista; senão o V da planilha) e aprovados/contratados/não contratados da lista vigente. Exige selecao >= leitor, a área e o recorte da coordenação.';

-- De 20261001100000_selecao_area_pelos_editais.sql
create or replace function private."FC_LIGAR_SELECAO_AOS_EDITAIS"()
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_qt integer;
begin
  with m as materialized (
    select m.id, m."CO_AREA" as area, m.ativo,
           private."FC_NUMERO_EDITAL"(m.edital) as numero,
           private."FC_TEXTO_BUSCA_RECURSO"(m.unidade) as unidade
      from public."TB_MONITORAMENTO_INDIGENA" m
     where private."FC_NUMERO_EDITAL"(m.edital) is not null
  ),
  u as materialized (
    select private."FC_TEXTO_BUSCA_RECURSO"(u."NO_UNIDADE") as unidade, u."CO_AREA" as area
      from public."TA_UNIDADE_AREA" u
  ),
  s as materialized (
    select s."CO_SELECAO_VAGA" as id,
           private."FC_NUMERO_EDITAL"(s."DS_EDITAL") as numero,
           private."FC_TEXTO_BUSCA_RECURSO"(s."NO_UNIDADE") as unidade,
           private."FC_TEXTO_BUSCA_RECURSO"(s."NO_UNIDADE") ~ '^(dsei|casai)( |$)' as indigena
      from public."TB_SELECAO_VAGA" s
     where s."ST_REGISTRO_ATIVO" = 'S'
  ),
  com_tabela as (
    select s.*, (select u.area from u where u.unidade = s.unidade limit 1) as area_tabela
      from s
  ),
  alvo as (
    select c.id,
           e.id as edital_id,
           case when c.indigena then 'saude-indigena'
                else coalesce(e.area, c.area_tabela, 'sede') end as area
      from com_tabela c
      left join lateral (
        select m.id, m.area from m
         where c.numero is not null and m.numero = c.numero
           and (case when c.indigena then m.area = 'saude-indigena'
                     else m.area <> 'saude-indigena' end)
         order by (m.unidade = c.unidade) desc,
                  (m.area = c.area_tabela) desc,
                  m.ativo desc
         limit 1
      ) e on true
  )
  update public."TB_SELECAO_VAGA" s set
    "CO_MONITORAMENTO" = alvo.edital_id,
    "CO_AREA" = alvo.area
    from alvo
   where s."CO_SELECAO_VAGA" = alvo.id
     and (s."CO_MONITORAMENTO" is distinct from alvo.edital_id
          or s."CO_AREA" is distinct from alvo.area);
  get diagnostics v_qt = row_count;
  return v_qt;
end;
$function$;
comment on function private."FC_LIGAR_SELECAO_AOS_EDITAIS"() is
  'Liga cada vaga ativa de TB_SELECAO_VAGA ao edital cadastrado e acerta a área: DSEI/CASAI só na Saúde Indígena; as outras unidades só na SEDE ou em Projetos (edital de mesmo número; sem edital, TA_UNIDADE_AREA ou sede). Devolve quantas linhas mudaram.';

-- De 20261013160000_payload_so_quando_muda.sql
create or replace function public.listar_monitoramento_operacional(p_versao text default null)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private."FC_SE_MUDOU"(jsonb_build_object('linhas', coalesce((
    select jsonb_agg(to_jsonb(l) order by l.unidade, l.edital)
      from (
        select v.aprovados_analise, v.aprovados_prova, v.aptos_analise, v.ativo,
               v.cancelados, v.cargos, v.ciclo, v.contratados,
               v.cronograma_atividade_atual, v.cronograma_automatico,
               v.cronograma_dias_para_proxima, v.cronograma_percentual,
               v.cronograma_proxima_atividade, v.cronograma_proxima_data,
               v.data_fim, v.data_inicio, v.edital, v.eliminados_nota,
               v.entrevistados, v.etapa, v.id, v.id_unidade, v.inscritos,
               v.link_edital, v.observacoes, v.observacoes_internas, v.processo,
               v.reprovados_analise, v.responsavel, v.risco, v.sigla_unidade,
               v.status, v.tipo_unidade, v.total_eliminados, v.uf, v.unidade,
               v.vagas_ociosas, v.vagas_total, v."CO_AREA", v."ST_TREINAMENTO"
          from public."VW_MONITORAMENTO_INDIGENA_OPERACIONAL" v
         where v.ativo is true
      ) l), '[]'::jsonb)), p_versao);
$$;
comment on column public."TB_ENTREVISTA"."ST_ATIVO" is 'S: está na planilha; N: saiu da planilha numa carga (fica para o histórico).';

drop function if exists private."FC_DESATIVAR_ENTREVISTAS_REPETIDAS"(text, uuid, uuid);
drop function if exists private."FC_ENTREVISTAS_VIGENTES"(text);

select private."FC_ATUALIZAR_KPIS_PELA_SELECAO"();
select private."FC_MARCAR_CACHE"(array['ENTREVISTAS'], array(select a."CO_AREA" from public."TB_AREA" a),
                                 'rollback 20261022200000');

commit;
