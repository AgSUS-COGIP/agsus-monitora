/*
  Datas impossíveis e inscritos zerados (02/10/2026).

  O QUE ESTAVA QUEBRADO
  1. Datas do edital digitadas com o ano errado e aceitas pelo banco (as
     colunas são date e aceitam o ano 202 ou 20206): 107/2026 (início
     0202-11-12, fim 20206-09-14), 108 e 110/2026 (início 0202-10-09),
     05/2026 MFC (início 0202-02-25) e FGV (início 0225-07-24); no cronograma
     do 112/2026, o recurso do resultado preliminar começava em 2025-10-23.
     O cronograma de cada um está certo: as datas corrigidas são as dele.
  2. Seis editais da Saúde Indígena apareciam como críticos "Sem inscritos"
     com centenas de candidatos nas análises: inscritos só vinha da Seleção
     (TB_SELECAO_VAGA), e a planilha da Seleção não tem 97/2026 nem 107 a
     117/2026.

  O QUE MUDA
  - Corrige as datas acima (cada UPDATE só age se o valor ainda for o errado;
    o valor anterior está neste comentário).
  - CK nas datas do edital e das etapas: ano entre 2015 e 2100 (os mesmos
    limites de src/lib/datas-do-cronograma.js) e início <= fim no edital.
  - private."FC_ATUALIZAR_KPIS_PELA_SELECAO": inscritos vem da Seleção; sem
    vaga do edital na Seleção, vem do total de candidatos das análises do
    edital (mesma chave única de aprovados_analise). É um piso: as análises
    só têm quem chegou à análise curricular. Recalcula no fim.

  Ensaio: supabase/ensaios/20261002180000_datas_validas_e_inscritos_pelas_analises.sql
  Rollback: supabase/rollback/20261002180000_datas_validas_e_inscritos_pelas_analises.sql
*/
begin;

-- 1. Datas digitadas erradas (pelo cronograma de cada edital).
update public."TB_MONITORAMENTO_INDIGENA" set data_inicio = '2026-09-14', data_fim = '2026-11-12'
 where id = '10bfbcf9-4f21-4b1e-8312-d428cd758f1f' and data_inicio = '0202-11-12';
update public."TB_MONITORAMENTO_INDIGENA" set data_inicio = '2026-09-16'
 where id in ('5fb89464-e47f-4960-9a42-f329468c45de', '64811db4-bf03-4092-bb70-13b347906d46')
   and data_inicio = '0202-10-09';
update public."TB_MONITORAMENTO_INDIGENA" set data_inicio = '2026-02-25'
 where id = '3e86b706-193a-454f-b345-7c260b88d32f' and data_inicio = '0202-02-25';
update public."TB_MONITORAMENTO_INDIGENA" set data_inicio = '2025-07-24'
 where id = '65f6f52a-615d-4072-a784-fca9e0f34454' and data_inicio = '0225-07-24';
update public."TB_MONITORAMENTO_INDIGENA" set data_inicio = '2026-09-23'
 where id = 'a22901ed-c247-4a4b-aa9c-c75824e2bdfb' and data_inicio = '2025-10-23';
update public."TB_CRONOGRAMA_MONIT_INDIG" set data_inicio = '2026-10-23'
 where id = '8c3fd790-5287-43b5-8bd4-72a28a623194' and data_inicio = '2025-10-23';

-- 2. Datas possíveis daqui em diante.
alter table public."TB_MONITORAMENTO_INDIGENA"
  add constraint "CK_MONIT_INDIG_DATA_EDITAL" check (
    (data_inicio is null or data_inicio between date '2015-01-01' and date '2100-12-31')
    and (data_fim is null or data_fim between date '2015-01-01' and date '2100-12-31')
    and (data_inicio is null or data_fim is null or data_inicio <= data_fim)
  );
comment on constraint "CK_MONIT_INDIG_DATA_EDITAL" on public."TB_MONITORAMENTO_INDIGENA" is 'Datas do edital com ano entre 2015 e 2100 e início até o fim (anos digitados errados, como 0202 e 20206, eram aceitos).';
alter table public."TB_CRONOGRAMA_MONIT_INDIG"
  add constraint "CK_CRONOG_MONIT_DATA_ETAPA" check (
    data_inicio between date '2015-01-01' and date '2100-12-31'
    and (data_fim is null or data_fim between date '2015-01-01' and date '2100-12-31')
  );
comment on constraint "CK_CRONOG_MONIT_DATA_ETAPA" on public."TB_CRONOGRAMA_MONIT_INDIG" is 'Datas da etapa com ano entre 2015 e 2100 (os mesmos limites da tela).';

-- 3. Inscritos: Seleção; sem ela, os candidatos das análises.
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

select private."FC_ATUALIZAR_KPIS_PELA_SELECAO"();

commit;
