/*
  ENSAIO de 20261117150000_tirar_do_mapa_as_casais_que_vem_do_sigepsi

  Dentro de begin; … rollback;: aplica a mesma mudança, confere que só as CASAIs saíram (as
  unidades u, os DSEIs e os polos ficam iguais), que as cópias guardam tudo, que o rollback põe
  as CASAIs de volta e que a RPC do mapa continua entregando só lmap e rede_cnes. Nada fica gravado.
*/

begin;

create temporary table antes on commit drop as
select chave, payload from public."TB_CONFIG_MAPA_SAUDE_INDIG" where chave in ('lmap', 'rede_cnes');

-- A mudança (o mesmo corpo da migration).
insert into public."TB_CONFIG_MAPA_SAUDE_INDIG" (chave, payload, descricao)
select chave || '_backup_20261117_pre_casais_do_sigepsi', payload, 'ensaio'
  from public."TB_CONFIG_MAPA_SAUDE_INDIG" where chave in ('lmap', 'rede_cnes');
update public."TB_CONFIG_MAPA_SAUDE_INDIG"
   set payload = jsonb_set(payload, '{casai}', '[]'::jsonb) where chave = 'lmap';
update public."TB_CONFIG_MAPA_SAUDE_INDIG" m
   set payload = jsonb_set(jsonb_set(m.payload, '{nac}', '[]'::jsonb), '{rede}',
         coalesce((select jsonb_object_agg(e.k, e.v || jsonb_build_object('c', '[]'::jsonb))
                     from jsonb_each(m.payload -> 'rede') e(k, v)), '{}'::jsonb))
 where m.chave = 'rede_cnes';

do $confere$
declare
  v_r jsonb;
begin
  select jsonb_build_object(
    'c_depois', (select coalesce(sum(jsonb_array_length(e.v -> 'c')), 0)
                   from public."TB_CONFIG_MAPA_SAUDE_INDIG" m, jsonb_each(m.payload -> 'rede') e(k, v)
                  where m.chave = 'rede_cnes'),
    'nac_depois', (select jsonb_array_length(payload -> 'nac') from public."TB_CONFIG_MAPA_SAUDE_INDIG" where chave = 'rede_cnes'),
    'casai_depois', (select jsonb_array_length(payload -> 'casai') from public."TB_CONFIG_MAPA_SAUDE_INDIG" where chave = 'lmap'),
    -- O que não é CASAI fica igual.
    'u_igual', (select (select jsonb_object_agg(k, v -> 'u') from jsonb_each(m.payload -> 'rede') e(k, v))
                     = (select jsonb_object_agg(k, v -> 'u') from antes a, jsonb_each(a.payload -> 'rede') e(k, v) where a.chave = 'rede_cnes')
                  from public."TB_CONFIG_MAPA_SAUDE_INDIG" m where m.chave = 'rede_cnes'),
    'lmap_igual_sem_casai', (select (m.payload - 'casai') = (a.payload - 'casai')
                  from public."TB_CONFIG_MAPA_SAUDE_INDIG" m, antes a where m.chave = 'lmap' and a.chave = 'lmap'),
    'copias_iguais', (select bool_and(b.payload = a.payload)
                  from public."TB_CONFIG_MAPA_SAUDE_INDIG" b
                  join antes a on b.chave = a.chave || '_backup_20261117_pre_casais_do_sigepsi'),
    'rpc_chaves', (select jsonb_agg(l -> 'chave') from jsonb_array_elements(public.listar_mapa_da_saude_indigena(null) -> 'linhas') l)
  ) into v_r;
  if (v_r ->> 'c_depois')::int <> 0 or (v_r ->> 'nac_depois')::int <> 0 or (v_r ->> 'casai_depois')::int <> 0
     or not (v_r ->> 'u_igual')::boolean or not (v_r ->> 'lmap_igual_sem_casai')::boolean
     or not (v_r ->> 'copias_iguais')::boolean or v_r -> 'rpc_chaves' <> '["lmap", "rede_cnes"]'::jsonb then
    raise exception 'ENSAIO: fora do esperado %', v_r;
  end if;
  raise notice 'ENSAIO (migration) OK: %', v_r;
end
$confere$;

-- O rollback (o mesmo corpo do arquivo de rollback).
update public."TB_CONFIG_MAPA_SAUDE_INDIG" m
   set payload = jsonb_set(m.payload, '{casai}', coalesce(b.payload -> 'casai', '[]'::jsonb))
  from public."TB_CONFIG_MAPA_SAUDE_INDIG" b
 where m.chave = 'lmap' and b.chave = 'lmap_backup_20261117_pre_casais_do_sigepsi';
update public."TB_CONFIG_MAPA_SAUDE_INDIG" m
   set payload = jsonb_set(jsonb_set(m.payload, '{nac}', coalesce(b.payload -> 'nac', '[]'::jsonb)), '{rede}',
         coalesce((select jsonb_object_agg(e.k, e.v || jsonb_build_object('c', coalesce(b.payload -> 'rede' -> e.k -> 'c', '[]'::jsonb)))
                     from jsonb_each(m.payload -> 'rede') e(k, v)), '{}'::jsonb))
  from public."TB_CONFIG_MAPA_SAUDE_INDIG" b
 where m.chave = 'rede_cnes' and b.chave = 'rede_cnes_backup_20261117_pre_casais_do_sigepsi';

do $confere_rollback$
begin
  if exists (select 1 from public."TB_CONFIG_MAPA_SAUDE_INDIG" m join antes a using (chave) where m.payload <> a.payload) then
    raise exception 'ENSAIO: o rollback não devolveu lmap e rede_cnes ao que eram';
  end if;
  raise notice 'ENSAIO (rollback) OK: lmap e rede_cnes iguais aos de antes';
end
$confere_rollback$;

rollback;
