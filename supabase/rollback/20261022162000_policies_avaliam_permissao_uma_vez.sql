/*
  Rollback de 20261022162000_policies_avaliam_permissao_uma_vez.sql: as 74
  policies voltam às expressões de antes (a função direto, linha a linha) e as
  quatro de SELECT de TB_ANALISE_CURRICULAR e TB_EDITAL_ANALISE voltam.
*/
begin;

alter policy "analises_curriculares_delete_admin" on public."TB_ANALISE_CURRICULAR"
  using ((private.has_perm('config'::text) OR private.has_perm('admin'::text)));

alter policy "analises_curriculares_insert_admin" on public."TB_ANALISE_CURRICULAR"
  with check ((private.has_perm('config'::text) OR private.has_perm('admin'::text)));

alter policy "analises_curriculares_update_admin" on public."TB_ANALISE_CURRICULAR"
  using ((private.has_perm('config'::text) OR private.has_perm('admin'::text)))
  with check ((private.has_perm('config'::text) OR private.has_perm('admin'::text)));

alter policy "recurso_atualizacao" on public."TB_ANALISE_CURRICULAR"
  using (private.pode_recurso('analises'::text, 2))
  with check (private.pode_recurso('analises'::text, 2));

alter policy "recurso_exclusao" on public."TB_ANALISE_CURRICULAR"
  using (private.pode_recurso('analises'::text, 3));

alter policy "recurso_insercao" on public."TB_ANALISE_CURRICULAR"
  with check (private.pode_recurso('analises'::text, 2));

alter policy "recurso_leitura_permitida" on public."TB_ANALISE_CURRICULAR"
  using (private.pode_recurso('analises'::text));

alter policy "lista_aprovados_candidatos_select_perfil_ativo" on public."TB_CANDIDATO_APROVADO"
  using ((private.monitora_role() <> ''::text));

alter policy "recurso_leitura" on public."TB_CANDIDATO_APROVADO"
  using (private.pode_recurso('aprovados'::text));

alter policy "categoria_convocacao_select_perfil_ativo" on public."TB_CATEGORIA_CONVOCACAO"
  using ((private.monitora_role() <> ''::text));

alter policy "recurso_leitura" on public."TB_CATEGORIA_CONVOCACAO"
  using (private.pode_recurso('aprovados'::text));

alter policy "mapa_saude_indigena_delete_config" on public."TB_CONFIG_MAPA_SAUDE_INDIG"
  using ((private.has_perm('config'::text) AND ((chave <> ALL (ARRAY['lmap'::text, 'rede_cnes'::text])) OR private.is_master())));

alter policy "mapa_saude_indigena_insert_config" on public."TB_CONFIG_MAPA_SAUDE_INDIG"
  with check ((private.has_perm('config'::text) AND ((chave <> ALL (ARRAY['lmap'::text, 'rede_cnes'::text])) OR private.is_master())));

alter policy "mapa_saude_indigena_update_config" on public."TB_CONFIG_MAPA_SAUDE_INDIG"
  using ((private.has_perm('config'::text) AND ((chave <> ALL (ARRAY['lmap'::text, 'rede_cnes'::text])) OR private.is_master())))
  with check ((private.has_perm('config'::text) AND ((chave <> ALL (ARRAY['lmap'::text, 'rede_cnes'::text])) OR private.is_master())));

alter policy "config_delete_config" on public."TB_CONFIGURACAO"
  using (private.has_perm('config'::text));

alter policy "config_insert_config" on public."TB_CONFIGURACAO"
  with check (private.has_perm('config'::text));

alter policy "config_update_config" on public."TB_CONFIGURACAO"
  using (private.has_perm('config'::text))
  with check (private.has_perm('config'::text));

alter policy "convocacao_edital_select_perfil_ativo" on public."TB_CONVOCACAO_EDITAL"
  using ((private.monitora_role() <> ''::text));

alter policy "recurso_leitura" on public."TB_CONVOCACAO_EDITAL"
  using (private.pode_recurso('aprovados'::text));

alter policy "analises_editais_delete_config" on public."TB_EDITAL_ANALISE"
  using ((private.has_perm('config'::text) OR private.has_perm('admin'::text)));

alter policy "analises_editais_insert_config" on public."TB_EDITAL_ANALISE"
  with check ((private.has_perm('config'::text) OR private.has_perm('admin'::text)));

alter policy "analises_editais_update_config" on public."TB_EDITAL_ANALISE"
  using ((private.has_perm('config'::text) OR private.has_perm('admin'::text)))
  with check ((private.has_perm('config'::text) OR private.has_perm('admin'::text)));

alter policy "recurso_atualizacao" on public."TB_EDITAL_ANALISE"
  using (private.pode_recurso('analises'::text, 2))
  with check (private.pode_recurso('analises'::text, 2));

alter policy "recurso_exclusao" on public."TB_EDITAL_ANALISE"
  using (private.pode_recurso('analises'::text, 3));

alter policy "recurso_insercao" on public."TB_EDITAL_ANALISE"
  with check (private.pode_recurso('analises'::text, 2));

alter policy "recurso_leitura_permitida" on public."TB_EDITAL_ANALISE"
  using (private.pode_recurso('analises'::text));

alter policy "listas_aprovados_select_perfil_ativo" on public."TB_LISTA_APROVADO"
  using ((private.monitora_role() <> ''::text));

alter policy "recurso_leitura" on public."TB_LISTA_APROVADO"
  using (private.pode_recurso('aprovados'::text));

alter policy "modelo_convocacao_select_perfil_ativo" on public."TB_MODELO_CONVOCACAO"
  using ((private.monitora_role() <> ''::text));

alter policy "recurso_leitura" on public."TB_MODELO_CONVOCACAO"
  using (private.pode_recurso('aprovados'::text));

alter policy "monitoramento_delete_cores" on public."TB_MONITORAMENTO_INDIGENA"
  using (private.has_perm('cores'::text));

alter policy "monitoramento_insert_cores" on public."TB_MONITORAMENTO_INDIGENA"
  with check (private.has_perm('cores'::text));

alter policy "monitoramento_select_allowed" on public."TB_MONITORAMENTO_INDIGENA"
  using ((private.has_perm('ind'::text) OR private.has_perm('cores'::text) OR private.has_perm('config'::text) OR private.has_perm('admin'::text)));

alter policy "monitoramento_update_cores" on public."TB_MONITORAMENTO_INDIGENA"
  using (private.has_perm('cores'::text))
  with check (private.has_perm('cores'::text));

alter policy "recurso_escrita" on public."TB_MONITORAMENTO_INDIGENA"
  using ((private.pode_recurso('dashboard'::text) OR private.pode_recurso('nucleo'::text) OR private.pode_recurso('calendario'::text) OR private.pode_recurso('aprovados'::text) OR private.pode_recurso('importacao'::text)))
  with check ((private.pode_recurso('nucleo'::text, 2) OR private.pode_recurso('calendario'::text, 2)));

alter policy "recurso_exclusao" on public."TB_MONITORAMENTO_INDIGENA"
  using ((private.pode_recurso('nucleo'::text, 3) OR private.pode_recurso('calendario'::text, 3)));

alter policy "recurso_leitura" on public."TB_MONITORAMENTO_INDIGENA"
  using ((private.pode_recurso('dashboard'::text) OR private.pode_recurso('nucleo'::text) OR private.pode_recurso('calendario'::text) OR private.pode_recurso('aprovados'::text) OR private.pode_recurso('importacao'::text)));

alter policy "recurso_leitura_permitida" on public."TB_MONITORAMENTO_INDIGENA"
  using ((private.pode_recurso('dashboard'::text) OR private.pode_recurso('nucleo'::text) OR private.pode_recurso('calendario'::text) OR private.pode_recurso('aprovados'::text) OR private.pode_recurso('importacao'::text, 2)));

alter policy "paineis_delete_config" on public."TB_PAINEL_EXTERNO"
  using (private.has_perm('config'::text));

alter policy "paineis_insert_config" on public."TB_PAINEL_EXTERNO"
  with check (private.has_perm('config'::text));

alter policy "paineis_update_config" on public."TB_PAINEL_EXTERNO"
  using (private.has_perm('config'::text))
  with check (private.has_perm('config'::text));

alter policy "perfis_insert_admin" on public."TB_PERFIL_USUARIO"
  with check (private.is_master());

alter policy "perfis_select_admin" on public."TB_PERFIL_USUARIO"
  using (private.is_master());

alter policy "perfis_update_admin" on public."TB_PERFIL_USUARIO"
  using (private.is_master())
  with check (private.is_master());

alter policy "solicitacoes_delete_admin" on public."TB_SOLICITACAO_ACESSO"
  using (private.is_master());

alter policy "solicitacoes_select_own_or_admin" on public."TB_SOLICITACAO_ACESSO"
  using (((user_id = ( SELECT auth.uid() AS uid)) OR (lower(email) = lower(COALESCE(( SELECT (auth.jwt() ->> 'email'::text)), ''::text))) OR private.is_master()));

alter policy "solicitacoes_update_admin" on public."TB_SOLICITACAO_ACESSO"
  using (private.is_master())
  with check (private.is_master());

alter policy "recurso_leitura" on public."TB_VAGA_IMEDIATA"
  using (private.pode_recurso('aprovados'::text));

alter policy "vaga_imediata_select_perfil_ativo" on public."TB_VAGA_IMEDIATA"
  using ((private.monitora_role() <> ''::text));

alter policy "unidades_delete_config" on public."TD_UNIDADE"
  using (private.has_perm('config'::text));

alter policy "unidades_insert_config" on public."TD_UNIDADE"
  with check (private.has_perm('config'::text));

alter policy "unidades_select_auth" on public."TD_UNIDADE"
  using (((ativo = true) OR private.has_perm('config'::text)));

alter policy "unidades_update_config" on public."TD_UNIDADE"
  using (private.has_perm('config'::text))
  with check (private.has_perm('config'::text));

alter policy "lista_aprovados_historico_select_admin" on public."TH_CANDIDATO_APROVADO"
  using ((private.monitora_role() = 'admin'::text));

alter policy "recurso_leitura" on public."TH_CANDIDATO_APROVADO"
  using (private.pode_recurso('aprovados'::text));

alter policy "historico_select_autenticado" on public."TH_MONITORAMENTO"
  using ((private.has_perm('ind'::text) OR private.has_perm('cores'::text) OR private.has_perm('config'::text) OR private.has_perm('admin'::text)));

alter policy "recurso_leitura" on public."TH_MONITORAMENTO"
  using ((private.pode_recurso('dashboard'::text) OR private.pode_recurso('nucleo'::text) OR private.pode_recurso('calendario'::text) OR private.pode_recurso('aprovados'::text) OR private.pode_recurso('importacao'::text)));

alter policy "recurso_leitura_permitida" on public."TH_MONITORAMENTO"
  using ((private.pode_recurso('dashboard'::text) OR private.pode_recurso('nucleo'::text) OR private.pode_recurso('calendario'::text) OR private.pode_recurso('aprovados'::text) OR private.pode_recurso('importacao'::text, 2)));

alter policy "eventos_acesso_select_admin" on public."TL_EVENTO_ACESSO"
  using ((private.has_perm('admin'::text) OR private.has_perm('config'::text)));

alter policy "analises_sync_log_delete_admin" on public."TL_SYNC_ANALISE"
  using ((private.has_perm('config'::text) OR private.has_perm('admin'::text)));

alter policy "analises_sync_log_insert_admin" on public."TL_SYNC_ANALISE"
  with check ((private.has_perm('config'::text) OR private.has_perm('admin'::text)));

alter policy "analises_sync_log_select_admin" on public."TL_SYNC_ANALISE"
  using ((private.has_perm('config'::text) OR private.has_perm('admin'::text)));

alter policy "analises_sync_log_update_admin" on public."TL_SYNC_ANALISE"
  using ((private.has_perm('config'::text) OR private.has_perm('admin'::text)))
  with check ((private.has_perm('config'::text) OR private.has_perm('admin'::text)));

alter policy "recurso_atualizacao" on public."TL_SYNC_ANALISE"
  using (private.pode_recurso('analises'::text, 2))
  with check (private.pode_recurso('analises'::text, 2));

alter policy "recurso_exclusao" on public."TL_SYNC_ANALISE"
  using (private.pode_recurso('analises'::text, 3));

alter policy "recurso_insercao" on public."TL_SYNC_ANALISE"
  with check (private.pode_recurso('analises'::text, 2));

alter policy "recurso_leitura" on public."TL_SYNC_ANALISE"
  using (private.pode_recurso('analises'::text));

alter policy "analises_staging_delete_admin" on public."TM_ANALISE_CURRICULAR"
  using ((private.has_perm('config'::text) OR private.has_perm('admin'::text)));

alter policy "analises_staging_insert_admin" on public."TM_ANALISE_CURRICULAR"
  with check ((private.has_perm('config'::text) OR private.has_perm('admin'::text)));

alter policy "analises_staging_select_admin" on public."TM_ANALISE_CURRICULAR"
  using ((private.has_perm('config'::text) OR private.has_perm('admin'::text)));

alter policy "recurso_atualizacao" on public."TM_ANALISE_CURRICULAR"
  using (private.pode_recurso('analises'::text, 2))
  with check (private.pode_recurso('analises'::text, 2));

alter policy "recurso_exclusao" on public."TM_ANALISE_CURRICULAR"
  using (private.pode_recurso('analises'::text, 3));

alter policy "recurso_insercao" on public."TM_ANALISE_CURRICULAR"
  with check (private.pode_recurso('analises'::text, 2));

alter policy "recurso_leitura" on public."TM_ANALISE_CURRICULAR"
  using (private.pode_recurso('analises'::text));

drop policy if exists "analises_curriculares_select_allowed" on public."TB_ANALISE_CURRICULAR";
create policy "analises_curriculares_select_allowed" on public."TB_ANALISE_CURRICULAR" as permissive for select to authenticated
  using ((private.has_perm('paineis'::text) OR private.has_perm('ind'::text) OR private.has_perm('config'::text) OR private.has_perm('admin'::text)));

drop policy if exists "recurso_leitura" on public."TB_ANALISE_CURRICULAR";
create policy "recurso_leitura" on public."TB_ANALISE_CURRICULAR" as restrictive for select to authenticated
  using (private.pode_recurso('analises'::text));

drop policy if exists "analises_editais_select_allowed" on public."TB_EDITAL_ANALISE";
create policy "analises_editais_select_allowed" on public."TB_EDITAL_ANALISE" as permissive for select to authenticated
  using ((private.has_perm('paineis'::text) OR private.has_perm('ind'::text) OR private.has_perm('config'::text) OR private.has_perm('admin'::text)));

drop policy if exists "recurso_leitura" on public."TB_EDITAL_ANALISE";
create policy "recurso_leitura" on public."TB_EDITAL_ANALISE" as restrictive for select to authenticated
  using (private.pode_recurso('analises'::text));

commit;
