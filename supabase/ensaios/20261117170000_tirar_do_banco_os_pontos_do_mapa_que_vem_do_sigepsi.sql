/*
  ENSAIO de 20261117170000_tirar_do_banco_os_pontos_do_mapa_que_vem_do_sigepsi

  Dentro de begin; … rollback;: aplica a mudança (o mesmo corpo da migration), confere que cada
  DSEI ficou só com k, n, pop, ufs e sedeuf (os 34, na mesma ordem e com os mesmos valores), que
  rede_cnes e as pendências saíram, que as cópias guardam tudo e que a RPC do mapa entrega só o
  lmap; depois o rollback, e confere que tudo voltou ao que era. Nada fica gravado.
*/

begin;

create temporary table antes_config on commit drop as
select chave, payload from public."TB_CONFIG_MAPA_SAUDE_INDIG" where chave in ('lmap', 'rede_cnes');
create temporary table antes_pendencias on commit drop as
select * from private."TB_PENDENCIA_COORDENADA_MAPA";

-- A mudança (o mesmo corpo da migration).
insert into public."TB_CONFIG_MAPA_SAUDE_INDIG" (chave, payload, descricao)
select chave || '_backup_20261117_pre_sigepsi', payload, 'ensaio'
  from public."TB_CONFIG_MAPA_SAUDE_INDIG" where chave in ('lmap', 'rede_cnes');
insert into public."TB_CONFIG_MAPA_SAUDE_INDIG" (chave, payload, descricao)
select 'pendencias_coordenada_backup_20261117_pre_sigepsi',
       coalesce(jsonb_agg(to_jsonb(p) order by p."CO_SEQ_PENDENCIA"), '[]'::jsonb), 'ensaio'
  from private."TB_PENDENCIA_COORDENADA_MAPA" p;
update public."TB_CONFIG_MAPA_SAUDE_INDIG" m
   set payload = jsonb_build_object('dsei', coalesce((
         select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                  'k', d -> 'k', 'n', d -> 'n', 'pop', d -> 'pop',
                  'ufs', d -> 'ufs', 'sedeuf', d -> 'sedeuf')) order by o)
           from jsonb_array_elements(m.payload -> 'dsei') with ordinality x(d, o)), '[]'::jsonb))
 where m.chave = 'lmap';
delete from public."TB_CONFIG_MAPA_SAUDE_INDIG" where chave = 'rede_cnes';
delete from private."TB_PENDENCIA_COORDENADA_MAPA";

do $confere$
declare
  v_r jsonb;
begin
  select jsonb_build_object(
    'dseis', (select jsonb_array_length(payload -> 'dsei') from public."TB_CONFIG_MAPA_SAUDE_INDIG" where chave = 'lmap'),
    'chaves_do_lmap', (select jsonb_agg(k) from public."TB_CONFIG_MAPA_SAUDE_INDIG", jsonb_object_keys(payload) k where chave = 'lmap'),
    'campos_dos_dseis', (select jsonb_agg(distinct k) from public."TB_CONFIG_MAPA_SAUDE_INDIG" m, jsonb_array_elements(m.payload -> 'dsei') d, jsonb_object_keys(d) k where m.chave = 'lmap'),
    -- Mesmos DSEIs, na mesma ordem, com os mesmos k/n/pop/ufs/sedeuf.
    'mesmos_valores', (select bool_and(
          d.v -> 'k' is not distinct from a.v -> 'k' and d.v -> 'n' is not distinct from a.v -> 'n'
          and d.v -> 'pop' is not distinct from a.v -> 'pop' and d.v -> 'ufs' is not distinct from a.v -> 'ufs'
          and d.v -> 'sedeuf' is not distinct from a.v -> 'sedeuf')
        from (select v, o from public."TB_CONFIG_MAPA_SAUDE_INDIG" m, jsonb_array_elements(m.payload -> 'dsei') with ordinality x(v, o) where m.chave = 'lmap') d
        join (select v, o from antes_config c, jsonb_array_elements(c.payload -> 'dsei') with ordinality x(v, o) where c.chave = 'lmap') a using (o)),
    'rede_cnes', (select count(*) from public."TB_CONFIG_MAPA_SAUDE_INDIG" where chave = 'rede_cnes'),
    'pendencias', (select count(*) from private."TB_PENDENCIA_COORDENADA_MAPA"),
    'copias_iguais', (select bool_and(b.payload = a.payload)
        from public."TB_CONFIG_MAPA_SAUDE_INDIG" b join antes_config a on b.chave = a.chave || '_backup_20261117_pre_sigepsi'),
    'copia_das_pendencias', (select jsonb_array_length(payload) from public."TB_CONFIG_MAPA_SAUDE_INDIG" where chave = 'pendencias_coordenada_backup_20261117_pre_sigepsi'),
    'pendencias_antes', (select count(*) from antes_pendencias),
    'rpc_chaves', (select jsonb_agg(l -> 'chave') from jsonb_array_elements(public.listar_mapa_da_saude_indigena(null) -> 'linhas') l)
  ) into v_r;
  if (v_r ->> 'dseis')::int <> 34 or v_r -> 'chaves_do_lmap' <> '["dsei"]'::jsonb
     or exists (select 1 from jsonb_array_elements_text(v_r -> 'campos_dos_dseis') c where c not in ('k', 'n', 'pop', 'ufs', 'sedeuf'))
     or not (v_r ->> 'mesmos_valores')::boolean
     or (v_r ->> 'rede_cnes')::int <> 0 or (v_r ->> 'pendencias')::int <> 0
     or not (v_r ->> 'copias_iguais')::boolean
     or (v_r ->> 'copia_das_pendencias')::int <> (v_r ->> 'pendencias_antes')::int
     or v_r -> 'rpc_chaves' <> '["lmap"]'::jsonb then
    raise exception 'ENSAIO: fora do esperado %', v_r;
  end if;
  raise notice 'ENSAIO (migration) OK: %', v_r;
end
$confere$;

-- O rollback (o mesmo corpo do arquivo de rollback).
update public."TB_CONFIG_MAPA_SAUDE_INDIG" m
   set payload = b.payload
  from public."TB_CONFIG_MAPA_SAUDE_INDIG" b
 where m.chave = 'lmap' and b.chave = 'lmap_backup_20261117_pre_sigepsi';
insert into public."TB_CONFIG_MAPA_SAUDE_INDIG" (chave, payload, descricao)
select 'rede_cnes', b.payload, 'ensaio'
  from public."TB_CONFIG_MAPA_SAUDE_INDIG" b
 where b.chave = 'rede_cnes_backup_20261117_pre_sigepsi'
on conflict (chave) do update set payload = excluded.payload;
insert into private."TB_PENDENCIA_COORDENADA_MAPA" overriding system value
select p.*
  from public."TB_CONFIG_MAPA_SAUDE_INDIG" b
 cross join lateral jsonb_populate_recordset(null::private."TB_PENDENCIA_COORDENADA_MAPA", b.payload) p
 where b.chave = 'pendencias_coordenada_backup_20261117_pre_sigepsi'
on conflict do nothing;

do $confere_rollback$
begin
  if exists (select 1 from antes_config a left join public."TB_CONFIG_MAPA_SAUDE_INDIG" m using (chave)
              where m.payload is distinct from a.payload) then
    raise exception 'ENSAIO: o rollback não devolveu lmap e rede_cnes';
  end if;
  if exists (select * from antes_pendencias except select * from private."TB_PENDENCIA_COORDENADA_MAPA")
     or exists (select * from private."TB_PENDENCIA_COORDENADA_MAPA" except select * from antes_pendencias) then
    raise exception 'ENSAIO: o rollback não devolveu as pendências';
  end if;
  raise notice 'ENSAIO (rollback) OK: lmap, rede_cnes e pendências iguais aos de antes';
end
$confere_rollback$;

rollback;
