/*
  Ensaio da correção 20261026-edital-teste-da-sede-como-treinamento
  (begin … rollback; nada fica gravado). O trecho entre "-- >>> correcao" e
  "-- <<< correcao" é cópia literal da correção (o teste
  tests/edital-teste-da-sede-como-treinamento-correcao.test.js confere).

  Reprova (raise exception, e o rollback acontece do mesmo jeito) se a
  correção reprovaria: conta do setor, edital certo e sem movimento, marca S,
  nenhuma linha apagada, histórico assinado, Lista de aprovados e Visão geral
  perdendo exatamente as linhas do edital, contratados iguais, indicadores
  com 1 processo a menos.

  A última consulta DENTRO da transação mostra o antes → depois da SEDE.
  Depois do rollback, rode a "Prova" (o último bloco deste arquivo) à parte:
  a marca tem de continuar N, o histórico do edital sem linha nova e o
  comentário da coluna sem a exceção.
*/
begin;

-- >>> correcao
set local lock_timeout = '3s';

-- A autoria desta transação: auth.uid() = conta do setor (histórico e cache).
select set_config('request.jwt.claims',
  '{"sub":"a01afddb-f64b-47d9-80e8-476a1ed14e43","role":"authenticated"}', true);

do $$
declare
  v_m public."TB_MONITORAMENTO_INDIGENA";
begin
  if to_regprocedure('private."FC_EH_TREINAMENTO"(text)') is null then
    raise exception 'Aplique antes a migration 20261007230000_edital_de_treinamento.sql.';
  end if;
  if not exists (select 1 from public."TB_PERFIL_USUARIO" p
                   join public."TB_GRUPO_ACESSO" a on a."CO_GRUPO_ACESSO" = p.perfil
                  where p.user_id = 'a01afddb-f64b-47d9-80e8-476a1ed14e43' and p.ativo is true and a."ST_ADMIN_GLOBAL") then
    raise exception 'A conta do setor (a01afddb-…) não é administrador global ativo.';
  end if;
  if auth.uid() is distinct from 'a01afddb-f64b-47d9-80e8-476a1ed14e43'::uuid then
    raise exception 'auth.uid() desta transação não é a conta do setor.';
  end if;

  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" m
   where m.id = '317709c7-e5a5-4333-b2f2-ef0a8cfb8c12' for update;
  if v_m.id is null or v_m.edital is distinct from 'Teste' or v_m."CO_AREA" is distinct from 'sede'
     or v_m.unidade is distinct from 'SEDE' then
    raise exception 'O edital 317709c7-… não é o "Teste" da SEDE: nada foi gravado.';
  end if;
  if private."FC_EH_TREINAMENTO"(v_m."ST_TREINAMENTO") then
    raise exception 'O edital "Teste" da SEDE já é treinamento: nada a fazer.';
  end if;

  -- Sem movimento real: se apareceu, alguém usou o edital e a decisão volta à equipe.
  if exists (select 1 from public."TB_CANDIDATO_APROVADO" c
               join public."TB_LISTA_APROVADO" l on l.id = c.lista_id
              where l.edital_id = '317709c7-e5a5-4333-b2f2-ef0a8cfb8c12'
                and (c.status is not null or c."DT_CONVOCACAO" is not null
                     or nullif(btrim(coalesce(c.matricula, '')), '') is not null))
     or exists (select 1 from public."TB_ENTREVISTA" e where e."CO_MONITORAMENTO" = v_m.id)
     or exists (select 1 from public."TB_SELECAO_VAGA" s where s."CO_MONITORAMENTO" = v_m.id)
     or exists (select 1 from public."TB_EMPREGARE_VAGA" s where s."CO_MONITORAMENTO" = v_m.id)
     or exists (select 1 from public."TB_LISTA_CLASSIFICACAO" s where s."CO_MONITORAMENTO" = v_m.id)
     or exists (select 1 from public."RL_CARTA_CANDIDATO" s where s."CO_MONITORAMENTO" = v_m.id) then
    raise exception 'O edital "Teste" da SEDE tem movimento (status, convocação, matrícula, entrevista, Seleção, robô, Classificação ou carta): nada foi gravado; leve à equipe.';
  end if;
end;
$$;

create temporary table tmp_contagens_sede (
  momento text not null,
  onde text not null,
  aprovados integer,
  contratados integer
) on commit drop;

create temporary table tmp_base_do_teste on commit drop as
select (select count(*) from public."TB_CANDIDATO_APROVADO" c
          join public."TB_LISTA_APROVADO" l on l.id = c.lista_id
         where l.edital_id = '317709c7-e5a5-4333-b2f2-ef0a8cfb8c12')::integer as linhas_todas,
       (select count(*) from public."TB_CANDIDATO_APROVADO" c
          join public."TB_LISTA_APROVADO" l on l.id = c.lista_id
         where l.edital_id = '317709c7-e5a5-4333-b2f2-ef0a8cfb8c12'
           and l.vigente is true and c.removido_em is null)::integer as linhas_vigentes,
       (select count(*) from public."TB_LISTA_APROVADO" l
         where l.edital_id = '317709c7-e5a5-4333-b2f2-ef0a8cfb8c12' and l.vigente is true)::integer as listas_vigentes,
       (select count(*) from public."TH_MONITORAMENTO" h
         where h.id_registro = '317709c7-e5a5-4333-b2f2-ef0a8cfb8c12')::integer as historico;

select set_config('monitora.momento', 'antes', true);
-- >>> contagens
insert into tmp_contagens_sede (momento, onde, aprovados, contratados)
select current_setting('monitora.momento'), x.onde, x.aprovados, x.contratados
  from (
    select 'Lista de aprovados (FC_MONTAR_APROVADOS_AREA)' as onde,
           (select a.p_total from private."FC_MONTAR_APROVADOS_AREA"('sede', null) a) as aprovados,
           null::integer as contratados
    union all
    select 'Visão geral (listar_acompanhamento_da_visao_geral)',
           coalesce(sum((l ->> 'aprovados')::integer), 0)::integer,
           coalesce(sum((l ->> 'contratados')::integer), 0)::integer
      from jsonb_array_elements(public.listar_acompanhamento_da_visao_geral('sede')::jsonb -> 'listas') l
    union all
    select 'Seleção (get_selecao_da_area)',
           coalesce(sum((v ->> 'aprovados')::integer), 0)::integer,
           coalesce(sum((v ->> 'contratados')::integer), 0)::integer
      from jsonb_array_elements(public.get_selecao_da_area('sede')::jsonb -> 'vagas') v
    union all
    select 'Conferência dos aprovados (conferencia_ler_aprovados: Convocado/Contratado)',
           count(*)::integer,
           (count(*) filter (where c ->> 'status' = 'Contratado'))::integer
      from jsonb_array_elements(public.conferencia_ler_aprovados() -> 'candidatos') c
     where c ->> 'area' = 'sede'
    union all
    select 'Job Contratado em outra lista (contratacao_ler_aprovados)',
           count(*)::integer,
           (count(*) filter (where c ->> 'status' = 'Contratado'))::integer
      from jsonb_array_elements(public.contratacao_ler_aprovados() -> 'linhas') c
     where c ->> 'area' = 'sede'
    union all
    select 'Indicadores (VW_MONITORAMENTO_INDIGENA_KPIS: processos ativos e contratados, todas as áreas)',
           k.processos_ativos, k.contratados
      from public."VW_MONITORAMENTO_INDIGENA_KPIS" k
    union all
    select 'Editais ativos da SEDE fora do treinamento (quantos e contratados)',
           count(*)::integer, coalesce(sum(m.contratados), 0)::integer
      from public."TB_MONITORAMENTO_INDIGENA" m
     where m."CO_AREA" = 'sede' and m.ativo is true and not private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO")
  ) x;
-- <<< contagens

update public."TB_MONITORAMENTO_INDIGENA"
   set "ST_TREINAMENTO" = 'S',
       updated_by = 'a01afddb-f64b-47d9-80e8-476a1ed14e43'
 where id = '317709c7-e5a5-4333-b2f2-ef0a8cfb8c12'
   and "ST_TREINAMENTO" = 'N';

-- O cache da Lista de aprovados e das Entrevistas da SEDE monta de novo sem o edital.
select private."FC_MARCAR_CACHE"(array['APROVADOS', 'ENTREVISTAS'], array['sede'],
                                 'correcao-20261026-edital-teste-sede');

comment on column public."TB_MONITORAMENTO_INDIGENA"."ST_TREINAMENTO" is
  'S = edital de treinamento (dados fictícios, sem valor oficial): fora da Visão geral, indicadores, painéis, caches, conferências e robôs; aparece nas telas operacionais com o selo "Treinamento". Só private."FC_PREPARAR_EDITAL_TREINAMENTO" grava S. Padrão N. Exceção: em 26/10/2026 a correção supabase/correcoes/20261026-edital-teste-da-sede-como-treinamento.sql, assinada pela conta do setor Gestão da Informação de Pessoal (a01afddb-f64b-47d9-80e8-476a1ed14e43), marcou S o edital "Teste" da SEDE (317709c7-e5a5-4333-b2f2-ef0a8cfb8c12), sem apagar dados.';

select set_config('monitora.momento', 'depois', true);
-- >>> contagens
insert into tmp_contagens_sede (momento, onde, aprovados, contratados)
select current_setting('monitora.momento'), x.onde, x.aprovados, x.contratados
  from (
    select 'Lista de aprovados (FC_MONTAR_APROVADOS_AREA)' as onde,
           (select a.p_total from private."FC_MONTAR_APROVADOS_AREA"('sede', null) a) as aprovados,
           null::integer as contratados
    union all
    select 'Visão geral (listar_acompanhamento_da_visao_geral)',
           coalesce(sum((l ->> 'aprovados')::integer), 0)::integer,
           coalesce(sum((l ->> 'contratados')::integer), 0)::integer
      from jsonb_array_elements(public.listar_acompanhamento_da_visao_geral('sede')::jsonb -> 'listas') l
    union all
    select 'Seleção (get_selecao_da_area)',
           coalesce(sum((v ->> 'aprovados')::integer), 0)::integer,
           coalesce(sum((v ->> 'contratados')::integer), 0)::integer
      from jsonb_array_elements(public.get_selecao_da_area('sede')::jsonb -> 'vagas') v
    union all
    select 'Conferência dos aprovados (conferencia_ler_aprovados: Convocado/Contratado)',
           count(*)::integer,
           (count(*) filter (where c ->> 'status' = 'Contratado'))::integer
      from jsonb_array_elements(public.conferencia_ler_aprovados() -> 'candidatos') c
     where c ->> 'area' = 'sede'
    union all
    select 'Job Contratado em outra lista (contratacao_ler_aprovados)',
           count(*)::integer,
           (count(*) filter (where c ->> 'status' = 'Contratado'))::integer
      from jsonb_array_elements(public.contratacao_ler_aprovados() -> 'linhas') c
     where c ->> 'area' = 'sede'
    union all
    select 'Indicadores (VW_MONITORAMENTO_INDIGENA_KPIS: processos ativos e contratados, todas as áreas)',
           k.processos_ativos, k.contratados
      from public."VW_MONITORAMENTO_INDIGENA_KPIS" k
    union all
    select 'Editais ativos da SEDE fora do treinamento (quantos e contratados)',
           count(*)::integer, coalesce(sum(m.contratados), 0)::integer
      from public."TB_MONITORAMENTO_INDIGENA" m
     where m."CO_AREA" = 'sede' and m.ativo is true and not private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO")
  ) x;
-- <<< contagens

-- Conferência: reprova (e nada fica) se o efeito não for exatamente o esperado.
do $$
declare
  b tmp_base_do_teste;
  r record;
begin
  select * into b from tmp_base_do_teste;
  if not exists (select 1 from public."TB_MONITORAMENTO_INDIGENA"
                  where id = '317709c7-e5a5-4333-b2f2-ef0a8cfb8c12' and "ST_TREINAMENTO" = 'S'
                    and updated_by = 'a01afddb-f64b-47d9-80e8-476a1ed14e43') then
    raise exception 'A marca de treinamento não ficou S (ou o autor não é a conta do setor).';
  end if;
  if (select count(*) from public."TB_CANDIDATO_APROVADO" c
        join public."TB_LISTA_APROVADO" l on l.id = c.lista_id
       where l.edital_id = '317709c7-e5a5-4333-b2f2-ef0a8cfb8c12') <> b.linhas_todas
     or (select count(*) from public."TB_LISTA_APROVADO" l
          where l.edital_id = '317709c7-e5a5-4333-b2f2-ef0a8cfb8c12' and l.vigente is true) <> b.listas_vigentes then
    raise exception 'Linhas ou listas do edital mudaram: a correção não apaga nada.';
  end if;
  if not exists (select 1 from public."TH_MONITORAMENTO" h
                  where h.id_registro = '317709c7-e5a5-4333-b2f2-ef0a8cfb8c12'
                    and h.usuario_id = 'a01afddb-f64b-47d9-80e8-476a1ed14e43'
                    and h.snapshot_json ->> 'ST_TREINAMENTO' = 'S')
     or (select count(*) from public."TH_MONITORAMENTO" h
          where h.id_registro = '317709c7-e5a5-4333-b2f2-ef0a8cfb8c12') <> b.historico + 1 then
    raise exception 'O histórico do edital não tem o retrato da marca assinado pela conta do setor.';
  end if;

  for r in
    select a.onde, a.aprovados as aprov_antes, d.aprovados as aprov_depois,
           a.contratados as contr_antes, d.contratados as contr_depois
      from tmp_contagens_sede a
      join tmp_contagens_sede d on d.onde = a.onde and d.momento = 'depois'
     where a.momento = 'antes'
  loop
    if r.contr_antes is distinct from r.contr_depois then
      raise exception 'Contratados mudaram em "%": % → %.', r.onde, r.contr_antes, r.contr_depois;
    end if;
    if r.onde like 'Lista de aprovados%' or r.onde like 'Visão geral%' then
      if r.aprov_antes - r.aprov_depois <> b.linhas_vigentes then
        raise exception '"%" deveria perder % linhas do edital: % → %.', r.onde, b.linhas_vigentes, r.aprov_antes, r.aprov_depois;
      end if;
    elsif r.onde like 'Indicadores%' or r.onde like 'Editais ativos da SEDE%' then
      if r.aprov_antes - r.aprov_depois <> 1 then
        raise exception '"%" deveria perder 1 edital: % → %.', r.onde, r.aprov_antes, r.aprov_depois;
      end if;
    elsif r.aprov_depois > r.aprov_antes then
      raise exception '"%" aumentou: % → %.', r.onde, r.aprov_antes, r.aprov_depois;
    end if;
  end loop;
end;
$$;
-- <<< correcao

-- Antes → depois (SEDE).
select a.onde, a.aprovados as aprovados_antes, d.aprovados as aprovados_depois,
       a.contratados as contratados_antes, d.contratados as contratados_depois
  from tmp_contagens_sede a
  join tmp_contagens_sede d on d.onde = a.onde and d.momento = 'depois'
 where a.momento = 'antes'
 order by a.onde;

rollback;

-- Prova (depois do rollback): nada ficou gravado.
select m."ST_TREINAMENTO" as marca,
       m.updated_by,
       m.updated_at,
       (select count(*) from public."TH_MONITORAMENTO" h
         where h.id_registro = m.id) as historico_do_edital,
       (select count(*) from public."TB_CANDIDATO_APROVADO" c
          join public."TB_LISTA_APROVADO" l on l.id = c.lista_id
         where l.edital_id = m.id::text) as linhas_da_lista,
       position('Exceção' in coalesce(col_description('public."TB_MONITORAMENTO_INDIGENA"'::regclass,
         (select attnum from pg_attribute where attrelid = 'public."TB_MONITORAMENTO_INDIGENA"'::regclass
             and attname = 'ST_TREINAMENTO')), '')) > 0 as comentario_com_excecao,
       (select count(*) from private."TL_ALTERACAO_CACHE" t
         where t."NO_TABELA_ORIGEM" = 'correcao-20261026-edital-teste-sede') as marcas_de_cache_da_correcao
  from public."TB_MONITORAMENTO_INDIGENA" m
 where m.id = '317709c7-e5a5-4333-b2f2-ef0a8cfb8c12';
