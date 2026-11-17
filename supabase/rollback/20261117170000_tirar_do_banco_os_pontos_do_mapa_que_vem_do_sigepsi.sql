/*
  ROLLBACK de 20261117170000_tirar_do_banco_os_pontos_do_mapa_que_vem_do_sigepsi

  Volta, das cópias *_backup_20261117_pre_sigepsi: o lmap inteiro, a linha rede_cnes e as
  pendências de coordenada (com os mesmos códigos). Para o mapa voltar a ler o banco, é preciso
  também o front de antes (o atual lê tudo do SIGEPSI). As cópias ficam. Sem as cópias, não faz
  nada.
*/

begin;

set local lock_timeout = '5s';

update public."TB_CONFIG_MAPA_SAUDE_INDIG" m
   set payload = b.payload, updated_at = now()
  from public."TB_CONFIG_MAPA_SAUDE_INDIG" b
 where m.chave = 'lmap' and b.chave = 'lmap_backup_20261117_pre_sigepsi';

insert into public."TB_CONFIG_MAPA_SAUDE_INDIG" (chave, payload, descricao)
select 'rede_cnes', b.payload, 'Rede CNES (volta do rollback de 20261117170000)'
  from public."TB_CONFIG_MAPA_SAUDE_INDIG" b
 where b.chave = 'rede_cnes_backup_20261117_pre_sigepsi'
on conflict (chave) do update set payload = excluded.payload, updated_at = now();

insert into private."TB_PENDENCIA_COORDENADA_MAPA" overriding system value
select p.*
  from public."TB_CONFIG_MAPA_SAUDE_INDIG" b
 cross join lateral jsonb_populate_recordset(null::private."TB_PENDENCIA_COORDENADA_MAPA", b.payload) p
 where b.chave = 'pendencias_coordenada_backup_20261117_pre_sigepsi'
on conflict do nothing;

commit;
