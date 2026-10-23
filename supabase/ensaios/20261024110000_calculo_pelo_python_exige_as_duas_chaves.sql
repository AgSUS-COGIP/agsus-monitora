-- ENSAIO de supabase/migrations/20261024110000_calculo_pelo_python_exige_as_duas_chaves.sql: roda o corpo e desfaz (rollback).
-- Esperado:
--   FC_CALCULO_PELO_PYTHON() só é verdadeira com classificacao = 'S' e classificacao_calculo = 'S';
--   as outras três combinações (e a falta da linha de classificacao) dão falso; o estado real das chaves
--   não muda (as mudanças de ST_LIGADA abaixo existem só dentro desta transação);
--   o caso que travava (classificacao_calculo ligada, classificacao desligada), no edital 114/2026
--   (bcecfb08-88ef-4e06-8401-bcad6bf88fd0): pedir_calculo_classificacao responde {ligada: false} sem gravar
--   pedido, registrar_lista_classificacao registra (não recusa com 55000) e o relatório de desempate fica
--   DESLIGADA, sem pedido HTTP ao GitHub.
-- O resultado (json) traz só verdadeiro/falso, números e situações; nenhum nome.
begin;

-- ═══ CORPO DA MIGRATION (início) ═══
set local lock_timeout = '5s';

do $$
begin
  if to_regprocedure('private."FC_CALCULO_PELO_PYTHON"()') is null
     or not exists (select 1 from public."TB_CHAVE_AUTOMACAO" c where c."CO_CHAVE" = 'classificacao_calculo') then
    raise exception 'Aplique antes 20261023200000_classificacao_em_python_etapa_2b.sql.';
  end if;
end;
$$;

create or replace function private."FC_CALCULO_PELO_PYTHON"()
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select count(*) = 2 from public."TB_CHAVE_AUTOMACAO" c
   where c."CO_CHAVE" in ('classificacao', 'classificacao_calculo') and c."ST_LIGADA" = 'S';
$function$;
comment on function private."FC_CALCULO_PELO_PYTHON"() is
  'As chaves "Classificação em Python" (classificacao) e "Gerar listas pelo Python" (classificacao_calculo) estão as duas ligadas (20261024110000)? Qualquer uma desligada ou sem a linha na tabela: não (o padrão é o cálculo da tela). Só o dono (as RPCs da Classificação).';
revoke all on function private."FC_CALCULO_PELO_PYTHON"() from public, anon, authenticated, service_role;
-- ═══ CORPO DA MIGRATION (fim) ═══

create temp table t_ensaio (chave text primary key, valor jsonb) on commit drop;
grant select, insert, update on t_ensaio to authenticated;

-- Segredo FALSO para todo o ensaio: nenhum pedido usa o segredo real do disparo.
select vault.create_secret('token-falso-do-ensaio', 'ensaio_disparo_duas_chaves');
select set_config('agsus.segredo_disparo_robos', 'ensaio_disparo_duas_chaves', true);

-- A. As combinações das duas chaves.
do $$
declare
  v_real jsonb := (select jsonb_object_agg(c."CO_CHAVE", c."ST_LIGADA") from public."TB_CHAVE_AUTOMACAO" c
                    where c."CO_CHAVE" in ('classificacao', 'classificacao_calculo'));
  v_combinacoes jsonb := '{}'::jsonb;
  v_classificacao text;
  v_calculo text;
  v_sem_linha boolean;
begin
  foreach v_classificacao in array array['S', 'N'] loop
    foreach v_calculo in array array['S', 'N'] loop
      update public."TB_CHAVE_AUTOMACAO" set "ST_LIGADA" = v_classificacao where "CO_CHAVE" = 'classificacao';
      update public."TB_CHAVE_AUTOMACAO" set "ST_LIGADA" = v_calculo where "CO_CHAVE" = 'classificacao_calculo';
      v_combinacoes := v_combinacoes || jsonb_build_object(
        'classificacao_' || v_classificacao || '_calculo_' || v_calculo, private."FC_CALCULO_PELO_PYTHON"());
    end loop;
  end loop;
  -- Sem a linha de classificacao (só neste bloco, desfeito em seguida), com o cálculo ligado.
  update public."TB_CHAVE_AUTOMACAO" set "ST_LIGADA" = 'S' where "CO_CHAVE" = 'classificacao_calculo';
  begin
    delete from public."TH_CHAVE_AUTOMACAO" where "CO_CHAVE" = 'classificacao';
    delete from public."TB_CHAVE_AUTOMACAO" where "CO_CHAVE" = 'classificacao';
    v_sem_linha := private."FC_CALCULO_PELO_PYTHON"();
    raise exception using errcode = 'P0001', message = 'desfaz';
  exception when sqlstate 'P0001' then null;
  end;
  insert into t_ensaio values ('chaves', jsonb_build_object(
    'estado_real', v_real,
    'combinacoes', v_combinacoes,
    'sem_linha_de_classificacao', v_sem_linha,
    'linha_de_classificacao_de_volta', exists (select 1 from public."TB_CHAVE_AUTOMACAO" c where c."CO_CHAVE" = 'classificacao'),
    'so_o_dono', not has_function_privilege('authenticated', 'private."FC_CALCULO_PELO_PYTHON"()', 'execute')
                 and not has_function_privilege('service_role', 'private."FC_CALCULO_PELO_PYTHON"()', 'execute')));
end;
$$;

-- B. O caso que travava: "Gerar listas pelo Python" ligada e "Classificação em Python" desligada.
update public."TB_CHAVE_AUTOMACAO" set "ST_LIGADA" = 'N' where "CO_CHAVE" = 'classificacao';
update public."TB_CHAVE_AUTOMACAO" set "ST_LIGADA" = 'S' where "CO_CHAVE" = 'classificacao_calculo';
insert into t_ensaio
select 'base', jsonb_build_object('tipo', l."TP_LISTA", 'versao', r."NU_VERSAO_VIGENTE",
                                  'resultado', jsonb_set(l."DS_RESULTADO", '{regra_versao}', to_jsonb(r."NU_VERSAO_VIGENTE")),
                                  'pedidos_http', (select count(*) from net.http_request_queue),
                                  'pedidos_calculo', (select count(*) from public."TB_PEDIDO_CALCULO_CLASSIFICACAO"))
  from public."TB_LISTA_CLASSIFICACAO" l
  join public."TB_REGRA_CLASSIFICACAO" r on r."CO_MONITORAMENTO" = l."CO_MONITORAMENTO"
 where l."CO_MONITORAMENTO" = 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0'
 order by l."DT_GERACAO" desc limit 1;

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"df5b852c-f981-4486-94b9-67857fff8f93","role":"authenticated"}', true);
do $$
declare
  v_edital constant uuid := 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0';
  v_base record;
  v_pedido json;
  v_lista json;
  v_recusou boolean := false;
begin
  select (b.valor->>'tipo') as tipo, (b.valor->'resultado') as resultado, (b.valor->>'versao')::integer as versao
    into v_base from t_ensaio b where b.chave = 'base';
  if v_base.tipo is null then
    raise exception 'Ensaio: o 114/2026 não tem lista gerada.';
  end if;
  v_pedido := public.pedir_calculo_classificacao(v_edital, v_base.tipo, v_base.versao);
  begin
    v_lista := public.registrar_lista_classificacao(v_edital, v_base.tipo, v_base.versao, v_base.resultado);
  exception when sqlstate '55000' then v_recusou := true;
  end;
  insert into t_ensaio values ('travava', jsonb_build_object(
    'resposta_do_pedido', v_pedido,
    'caminho_da_tela_recusou', v_recusou,
    'lista', v_lista->>'id'));
end;
$$;
reset role;

update t_ensaio t set valor = (t.valor - 'lista') || jsonb_build_object(
    'lista_registrada', t.valor->>'lista' is not null,
    'pedidos_de_calculo_novos', (select count(*) from public."TB_PEDIDO_CALCULO_CLASSIFICACAO")
                                - (select (b.valor->>'pedidos_calculo')::integer from t_ensaio b where b.chave = 'base'),
    'preparo_do_desempate', (select p."TP_SITUACAO" from public."TB_PREPARO_DESEMPATE" p
                              where p."CO_LISTA_CLASSIFICACAO" = (t.valor->>'lista')::uuid),
    'pedidos_http_novos', (select count(*) from net.http_request_queue)
                          - (select (b.valor->>'pedidos_http')::integer from t_ensaio b where b.chave = 'base'))
 where t.chave = 'travava';

select json_build_object(
  'chaves', (select valor from t_ensaio where chave = 'chaves'),
  'travava', (select valor from t_ensaio where chave = 'travava')
) as ensaio;

rollback;
