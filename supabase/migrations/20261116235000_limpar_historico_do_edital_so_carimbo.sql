/*
  LIMPAR O HISTÓRICO DO EDITAL QUE SÓ TEM CARIMBO (16/11/2026)

  POR QUE
  TH_MONITORAMENTO guarda a foto inteira do edital a cada UPDATE. Até 20261116234000, o UPDATE
  que só mudava o carimbo também gravava: medição de 16/11/2026, 9.144 registros automáticos
  (usuario_id nulo) sem nenhuma mudança de conteúdo, 17,9 MB dos 21,8 MB da tabela, num banco
  de 500 MB. A 20261116234000 parou a entrada; esta tira o que já entrou.

  O QUE SAI
  O registro que cumpre TUDO isto:
    - automático: usuario_id nulo, evento 'atualizado', sem campo_alterado;
    - comparado com o registro anterior do mesmo edital (ordem: created_at, id), a foto só
      difere em updated_at, updated_by e "DT_FONTE_FUNIL";
    - nem ele nem o anterior dividem o mesmo created_at com outro registro do edital (com
      empate, a ordem é incerta: fica).

  O QUE FICA
  Todo registro humano, todo 'criado' e 'desativado', a auditoria da troca de área
  (campo_alterado), o primeiro registro de cada edital e todo registro com mudança de conteúdo.
  Como o registro apagado tem o mesmo conteúdo do anterior, o conteúdo que antecede cada
  registro que fica não muda: a confere final prova isso, registro por registro (md5 da foto
  anterior sem o carimbo, antes e depois).

  GUARDAS
    - 20261116234000 aplicada (senão o gatilho continua gravando carimbo);
    - entre 9.000 e 9.500 registros a apagar (medidos: 9.144). Fora disso, algo mudou: meça
      de novo antes.

  ENSAIO:   supabase/ensaios/20261116235000_limpar_historico_do_edital_so_carimbo.sql
  ROLLBACK: supabase/rollback/20261116235000_limpar_historico_do_edital_so_carimbo.sql (não
            devolve os registros: não têm conteúdo e o espaço é o objetivo).
  DEPOIS:   o espaço em disco só volta com VACUUM FULL de TH_MONITORAMENTO (manutenção à mão,
            fora do horário dos robôs).
*/
begin;

set local lock_timeout = '5s';

do $guarda$
begin
  if position('20261116234000' in coalesce((select prosrc from pg_proc where oid = to_regprocedure('public.fn_registrar_historico()')), '')) = 0 then
    raise exception 'Aplique antes 20261116234000_historico_do_edital_ignora_so_carimbo.sql.';
  end if;
end;
$guarda$;

-- Ninguém grava no histórico enquanto a limpeza mede e apaga.
lock table public."TH_MONITORAMENTO" in share row exclusive mode;

-- A foto anterior de cada registro (sem o carimbo), antes de apagar.
create temp table tmp_historico_antes on commit drop as
select t.id, t.id_registro, t.usuario_id, t.evento, t.campo_alterado, t.created_at,
       lag(t.created_at) over w as anterior_em,
       count(*) over (partition by t.id_registro, t.created_at) as qt_mesmo_instante,
       t.snapshot_json - array['updated_at', 'updated_by', 'DT_FONTE_FUNIL'] as conteudo,
       lag(t.snapshot_json) over w - array['updated_at', 'updated_by', 'DT_FONTE_FUNIL'] as conteudo_anterior,
       pg_column_size(t.*) as nu_bytes
  from public."TH_MONITORAMENTO" t
window w as (partition by t.id_registro order by t.created_at, t.id);
alter table tmp_historico_antes add primary key (id);
create index on tmp_historico_antes (id_registro, created_at);
analyze tmp_historico_antes;

create temp table tmp_historico_so_carimbo on commit drop as
select a.id, a.nu_bytes
  from tmp_historico_antes a
 where a.usuario_id is null
   and a.evento = 'atualizado'
   and a.campo_alterado is null
   and a.conteudo_anterior is not null
   and a.conteudo is not distinct from a.conteudo_anterior
   and a.qt_mesmo_instante = 1
   and not exists (select 1 from tmp_historico_antes e
                    where e.id_registro = a.id_registro and e.created_at = a.anterior_em
                      and e.qt_mesmo_instante > 1);
alter table tmp_historico_so_carimbo add primary key (id);
analyze tmp_historico_so_carimbo;

do $guarda_qtd$
declare
  v_qt integer;
begin
  select count(*) into v_qt from tmp_historico_so_carimbo;
  if v_qt not between 9000 and 9500 then
    raise exception 'São % registros só de carimbo; a medição de 16/11/2026 deu 9.144. Meça de novo antes de apagar.', v_qt;
  end if;
end;
$guarda_qtd$;

delete from public."TH_MONITORAMENTO" t
 using tmp_historico_so_carimbo c
 where t.id = c.id;

do $confere$
declare
  v_qt integer;
  v_mb numeric;
  v_restam integer;
  v_esperado integer;
  v_humanos_antes integer;
  v_humanos_depois integer;
  v_mudou integer;
begin
  select count(*), round(sum(nu_bytes) / 1048576.0, 1) into v_qt, v_mb from tmp_historico_so_carimbo;
  select count(*) into v_restam from public."TH_MONITORAMENTO";
  select count(*) - v_qt into v_esperado from tmp_historico_antes;
  if v_restam <> v_esperado then
    raise exception 'Restaram % registros; o esperado era %.', v_restam, v_esperado;
  end if;

  select count(*) into v_humanos_antes from tmp_historico_antes
   where usuario_id is not null or evento <> 'atualizado' or campo_alterado is not null;
  select count(*) into v_humanos_depois from public."TH_MONITORAMENTO"
   where usuario_id is not null or evento <> 'atualizado' or campo_alterado is not null;
  if v_humanos_depois <> v_humanos_antes then
    raise exception 'Registro humano, criado, desativado ou de troca de área sumiu (% → %).', v_humanos_antes, v_humanos_depois;
  end if;

  -- Cada registro que fica tem a mesma foto anterior (sem o carimbo) de antes da limpeza:
  -- nenhuma mudança de conteúdo some.
  with depois as (
    select t.id,
           lag(t.snapshot_json) over (partition by t.id_registro order by t.created_at, t.id)
             - array['updated_at', 'updated_by', 'DT_FONTE_FUNIL'] as conteudo_anterior
      from public."TH_MONITORAMENTO" t
  )
  select count(*) into v_mudou
    from depois d
    join tmp_historico_antes a on a.id = d.id
   where d.conteudo_anterior is distinct from a.conteudo_anterior;
  if v_mudou <> 0 then
    raise exception '% registro(s) ficariam com outra foto anterior: a limpeza apagaria mudança de conteúdo.', v_mudou;
  end if;

  raise notice 'Migration 20261116235000: % registros só de carimbo apagados (% MB de dados); restam %; nenhuma mudança de conteúdo some.',
    v_qt, v_mb, v_restam;
end;
$confere$;

commit;
