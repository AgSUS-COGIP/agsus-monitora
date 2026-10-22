-- ROLLBACK de supabase/migrations/20261002180000_datas_validas_e_inscritos_pelas_analises.sql: tira as restrições e volta a função de 20261002130000 (inscritos só pela Seleção). As datas corrigidas não voltam ao valor errado.
begin;
alter table public."TB_MONITORAMENTO_INDIGENA" drop constraint if exists "CK_MONIT_INDIG_DATA_EDITAL";
alter table public."TB_CRONOGRAMA_MONIT_INDIG" drop constraint if exists "CK_CRONOG_MONIT_DATA_ETAPA";
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
    select u.id, (count(*) filter (where a.status_consolidado = 'Aprovado'))::integer qt
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
    select t.id, s.inscritos, s.aptos, s.cancelados, s.eliminados_nota, s.reprovados, s.total_eliminados,
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
commit;
