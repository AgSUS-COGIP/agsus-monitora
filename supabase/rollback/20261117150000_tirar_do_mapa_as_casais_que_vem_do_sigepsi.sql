/*
  ROLLBACK de 20261117150000_tirar_do_mapa_as_casais_que_vem_do_sigepsi

  Põe de volta, das cópias *_backup_20261117_pre_casais_do_sigepsi, só as CASAIs: lmap.casai,
  rede_cnes.nac e rede_cnes.rede[<DSEI>].c. O resto do lmap e do rede_cnes fica como está (uma
  coordenada corrigida depois da migration não volta atrás). As cópias ficam, como as outras da
  tabela. Sem as cópias, não faz nada.
*/

begin;

set local lock_timeout = '5s';

update public."TB_CONFIG_MAPA_SAUDE_INDIG" m
   set payload = jsonb_set(m.payload, '{casai}', coalesce(b.payload -> 'casai', '[]'::jsonb)),
       updated_at = now()
  from public."TB_CONFIG_MAPA_SAUDE_INDIG" b
 where m.chave = 'lmap'
   and b.chave = 'lmap_backup_20261117_pre_casais_do_sigepsi';

update public."TB_CONFIG_MAPA_SAUDE_INDIG" m
   set payload = jsonb_set(
         jsonb_set(m.payload, '{nac}', coalesce(b.payload -> 'nac', '[]'::jsonb)),
         '{rede}',
         coalesce((select jsonb_object_agg(
                            e.k,
                            e.v || jsonb_build_object(
                              'c', coalesce(b.payload -> 'rede' -> e.k -> 'c', '[]'::jsonb)))
                     from jsonb_each(m.payload -> 'rede') e(k, v)), '{}'::jsonb)),
       updated_at = now()
  from public."TB_CONFIG_MAPA_SAUDE_INDIG" b
 where m.chave = 'rede_cnes'
   and b.chave = 'rede_cnes_backup_20261117_pre_casais_do_sigepsi';

commit;
