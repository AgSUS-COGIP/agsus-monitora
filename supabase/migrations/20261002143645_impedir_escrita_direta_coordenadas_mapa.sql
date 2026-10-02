-- Somente os dois cadastros ativos do mapa exigem administrador global.
-- Demais chaves (backups/configurações), grants e SELECT conservam as regras anteriores.
alter policy mapa_saude_indigena_insert_config on public."TB_CONFIG_MAPA_SAUDE_INDIG"
  with check (private.has_perm('config') and
    (chave not in ('lmap','rede_cnes') or private.is_master()));
alter policy mapa_saude_indigena_update_config on public."TB_CONFIG_MAPA_SAUDE_INDIG"
  using (private.has_perm('config') and
    (chave not in ('lmap','rede_cnes') or private.is_master()))
  with check (private.has_perm('config') and
    (chave not in ('lmap','rede_cnes') or private.is_master()));
alter policy mapa_saude_indigena_delete_config on public."TB_CONFIG_MAPA_SAUDE_INDIG"
  using (private.has_perm('config') and
    (chave not in ('lmap','rede_cnes') or private.is_master()));
