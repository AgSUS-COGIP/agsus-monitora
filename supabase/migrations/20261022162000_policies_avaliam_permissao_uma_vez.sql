/*
  AS POLICIES AVALIAM A PERMISSÃO UMA VEZ POR CONSULTA

  Por quê: 74 policies antigas de public chamam private.has_perm,
  private.pode_recurso, private.monitora_role ou private.is_master direto na
  expressão. Assim o Postgres avalia a função linha a linha (cada uma lê
  TB_PERFIL_USUARIO, TB_GRUPO_ACESSO e as permissões): em 22/10/2026,
  pg_stat_user_tables mostrava 17,3 milhões de seq scans em TB_GRUPO_ACESSO
  (7 linhas) e 12,5 milhões em TB_PERFIL_USUARIO (40 linhas) desde 02/10 — a
  maior parte vinda das leituras security_invoker (VW_MONITORAMENTO_INDIGENA_
  OPERACIONAL lê TB_MONITORAMENTO_INDIGENA com a RLS de quem lê) e de quem lê
  as tabelas pela API. Embrulhada em (select …), a chamada vira um InitPlan:
  uma avaliação por consulta (o padrão das policies novas e a recomendação do
  Supabase, "auth_rls_initplan"). Os argumentos são constantes; nada depende
  da linha.

  O QUE MUDA
    1. alter policy nas 74, trocando só `private.f(args)` por
       `(select private.f(args))` — a mesma expressão (o ensaio confere, policy
       a policy, que tirar o embrulho devolve o texto de antes). A de
       TB_PAINEL_EXTERNO que lê pode_recurso('painel:' || id) depende da
       linha e fica como está na parte da linha.
    2. TB_ANALISE_CURRICULAR e TB_EDITAL_ANALISE tinham, para SELECT, duas
       permissivas (A: has_perm paineis/ind/config/admin; B:
       pode_recurso('analises')) e duas restritivas (a da área, e de novo B).
       (A ou B) e área e B = B e área: A e a restritiva repetida não mudam o
       resultado e só custam. Saem analises_curriculares_select_allowed /
       analises_editais_select_allowed e as duas recurso_leitura; ficam
       recurso_leitura_permitida (B) e PL_*_AREA. O ensaio confere, perfil a
       perfil, que cada um vê o mesmo número de linhas.
    As policies de storage.objects (buckets) têm o mesmo padrão, mas a tabela é
    do supabase_storage_admin: ficam para quem administra o Storage.

  Dependentes: só as tabelas listadas. Nenhuma função muda.
  Ensaio: supabase/ensaios/20261022162000_policies_avaliam_permissao_uma_vez.sql
  Rollback: supabase/rollback/20261022162000_policies_avaliam_permissao_uma_vez.sql
*/
begin;

-- 1. A permissão numa avaliação só (InitPlan) ----------------------------------------------
alter policy "analises_curriculares_delete_admin" on public."TB_ANALISE_CURRICULAR"
  using (((select private.has_perm('config'::text)) OR (select private.has_perm('admin'::text))));

alter policy "analises_curriculares_insert_admin" on public."TB_ANALISE_CURRICULAR"
  with check (((select private.has_perm('config'::text)) OR (select private.has_perm('admin'::text))));

alter policy "analises_curriculares_update_admin" on public."TB_ANALISE_CURRICULAR"
  using (((select private.has_perm('config'::text)) OR (select private.has_perm('admin'::text))))
  with check (((select private.has_perm('config'::text)) OR (select private.has_perm('admin'::text))));

alter policy "recurso_atualizacao" on public."TB_ANALISE_CURRICULAR"
  using ((select private.pode_recurso('analises'::text, 2)))
  with check ((select private.pode_recurso('analises'::text, 2)));

alter policy "recurso_exclusao" on public."TB_ANALISE_CURRICULAR"
  using ((select private.pode_recurso('analises'::text, 3)));

alter policy "recurso_insercao" on public."TB_ANALISE_CURRICULAR"
  with check ((select private.pode_recurso('analises'::text, 2)));

alter policy "recurso_leitura_permitida" on public."TB_ANALISE_CURRICULAR"
  using ((select private.pode_recurso('analises'::text)));

alter policy "lista_aprovados_candidatos_select_perfil_ativo" on public."TB_CANDIDATO_APROVADO"
  using (((select private.monitora_role()) <> ''::text));

alter policy "recurso_leitura" on public."TB_CANDIDATO_APROVADO"
  using ((select private.pode_recurso('aprovados'::text)));

alter policy "categoria_convocacao_select_perfil_ativo" on public."TB_CATEGORIA_CONVOCACAO"
  using (((select private.monitora_role()) <> ''::text));

alter policy "recurso_leitura" on public."TB_CATEGORIA_CONVOCACAO"
  using ((select private.pode_recurso('aprovados'::text)));

alter policy "mapa_saude_indigena_delete_config" on public."TB_CONFIG_MAPA_SAUDE_INDIG"
  using (((select private.has_perm('config'::text)) AND ((chave <> ALL (ARRAY['lmap'::text, 'rede_cnes'::text])) OR (select private.is_master()))));

alter policy "mapa_saude_indigena_insert_config" on public."TB_CONFIG_MAPA_SAUDE_INDIG"
  with check (((select private.has_perm('config'::text)) AND ((chave <> ALL (ARRAY['lmap'::text, 'rede_cnes'::text])) OR (select private.is_master()))));

alter policy "mapa_saude_indigena_update_config" on public."TB_CONFIG_MAPA_SAUDE_INDIG"
  using (((select private.has_perm('config'::text)) AND ((chave <> ALL (ARRAY['lmap'::text, 'rede_cnes'::text])) OR (select private.is_master()))))
  with check (((select private.has_perm('config'::text)) AND ((chave <> ALL (ARRAY['lmap'::text, 'rede_cnes'::text])) OR (select private.is_master()))));

alter policy "config_delete_config" on public."TB_CONFIGURACAO"
  using ((select private.has_perm('config'::text)));

alter policy "config_insert_config" on public."TB_CONFIGURACAO"
  with check ((select private.has_perm('config'::text)));

alter policy "config_update_config" on public."TB_CONFIGURACAO"
  using ((select private.has_perm('config'::text)))
  with check ((select private.has_perm('config'::text)));

alter policy "convocacao_edital_select_perfil_ativo" on public."TB_CONVOCACAO_EDITAL"
  using (((select private.monitora_role()) <> ''::text));

alter policy "recurso_leitura" on public."TB_CONVOCACAO_EDITAL"
  using ((select private.pode_recurso('aprovados'::text)));

alter policy "analises_editais_delete_config" on public."TB_EDITAL_ANALISE"
  using (((select private.has_perm('config'::text)) OR (select private.has_perm('admin'::text))));

alter policy "analises_editais_insert_config" on public."TB_EDITAL_ANALISE"
  with check (((select private.has_perm('config'::text)) OR (select private.has_perm('admin'::text))));

alter policy "analises_editais_update_config" on public."TB_EDITAL_ANALISE"
  using (((select private.has_perm('config'::text)) OR (select private.has_perm('admin'::text))))
  with check (((select private.has_perm('config'::text)) OR (select private.has_perm('admin'::text))));

alter policy "recurso_atualizacao" on public."TB_EDITAL_ANALISE"
  using ((select private.pode_recurso('analises'::text, 2)))
  with check ((select private.pode_recurso('analises'::text, 2)));

alter policy "recurso_exclusao" on public."TB_EDITAL_ANALISE"
  using ((select private.pode_recurso('analises'::text, 3)));

alter policy "recurso_insercao" on public."TB_EDITAL_ANALISE"
  with check ((select private.pode_recurso('analises'::text, 2)));

alter policy "recurso_leitura_permitida" on public."TB_EDITAL_ANALISE"
  using ((select private.pode_recurso('analises'::text)));

alter policy "listas_aprovados_select_perfil_ativo" on public."TB_LISTA_APROVADO"
  using (((select private.monitora_role()) <> ''::text));

alter policy "recurso_leitura" on public."TB_LISTA_APROVADO"
  using ((select private.pode_recurso('aprovados'::text)));

alter policy "modelo_convocacao_select_perfil_ativo" on public."TB_MODELO_CONVOCACAO"
  using (((select private.monitora_role()) <> ''::text));

alter policy "recurso_leitura" on public."TB_MODELO_CONVOCACAO"
  using ((select private.pode_recurso('aprovados'::text)));

alter policy "monitoramento_delete_cores" on public."TB_MONITORAMENTO_INDIGENA"
  using ((select private.has_perm('cores'::text)));

alter policy "monitoramento_insert_cores" on public."TB_MONITORAMENTO_INDIGENA"
  with check ((select private.has_perm('cores'::text)));

alter policy "monitoramento_select_allowed" on public."TB_MONITORAMENTO_INDIGENA"
  using (((select private.has_perm('ind'::text)) OR (select private.has_perm('cores'::text)) OR (select private.has_perm('config'::text)) OR (select private.has_perm('admin'::text))));

alter policy "monitoramento_update_cores" on public."TB_MONITORAMENTO_INDIGENA"
  using ((select private.has_perm('cores'::text)))
  with check ((select private.has_perm('cores'::text)));

alter policy "recurso_escrita" on public."TB_MONITORAMENTO_INDIGENA"
  using (((select private.pode_recurso('dashboard'::text)) OR (select private.pode_recurso('nucleo'::text)) OR (select private.pode_recurso('calendario'::text)) OR (select private.pode_recurso('aprovados'::text)) OR (select private.pode_recurso('importacao'::text))))
  with check (((select private.pode_recurso('nucleo'::text, 2)) OR (select private.pode_recurso('calendario'::text, 2))));

alter policy "recurso_exclusao" on public."TB_MONITORAMENTO_INDIGENA"
  using (((select private.pode_recurso('nucleo'::text, 3)) OR (select private.pode_recurso('calendario'::text, 3))));

alter policy "recurso_leitura" on public."TB_MONITORAMENTO_INDIGENA"
  using (((select private.pode_recurso('dashboard'::text)) OR (select private.pode_recurso('nucleo'::text)) OR (select private.pode_recurso('calendario'::text)) OR (select private.pode_recurso('aprovados'::text)) OR (select private.pode_recurso('importacao'::text))));

alter policy "recurso_leitura_permitida" on public."TB_MONITORAMENTO_INDIGENA"
  using (((select private.pode_recurso('dashboard'::text)) OR (select private.pode_recurso('nucleo'::text)) OR (select private.pode_recurso('calendario'::text)) OR (select private.pode_recurso('aprovados'::text)) OR (select private.pode_recurso('importacao'::text, 2))));

alter policy "paineis_delete_config" on public."TB_PAINEL_EXTERNO"
  using ((select private.has_perm('config'::text)));

alter policy "paineis_insert_config" on public."TB_PAINEL_EXTERNO"
  with check ((select private.has_perm('config'::text)));

alter policy "paineis_update_config" on public."TB_PAINEL_EXTERNO"
  using ((select private.has_perm('config'::text)))
  with check ((select private.has_perm('config'::text)));

alter policy "perfis_insert_admin" on public."TB_PERFIL_USUARIO"
  with check ((select private.is_master()));

alter policy "perfis_select_admin" on public."TB_PERFIL_USUARIO"
  using ((select private.is_master()));

alter policy "perfis_update_admin" on public."TB_PERFIL_USUARIO"
  using ((select private.is_master()))
  with check ((select private.is_master()));

alter policy "solicitacoes_delete_admin" on public."TB_SOLICITACAO_ACESSO"
  using ((select private.is_master()));

alter policy "solicitacoes_select_own_or_admin" on public."TB_SOLICITACAO_ACESSO"
  using (((user_id = ( SELECT auth.uid() AS uid)) OR (lower(email) = lower(COALESCE(( SELECT (auth.jwt() ->> 'email'::text)), ''::text))) OR (select private.is_master())));

alter policy "solicitacoes_update_admin" on public."TB_SOLICITACAO_ACESSO"
  using ((select private.is_master()))
  with check ((select private.is_master()));

alter policy "recurso_leitura" on public."TB_VAGA_IMEDIATA"
  using ((select private.pode_recurso('aprovados'::text)));

alter policy "vaga_imediata_select_perfil_ativo" on public."TB_VAGA_IMEDIATA"
  using (((select private.monitora_role()) <> ''::text));

alter policy "unidades_delete_config" on public."TD_UNIDADE"
  using ((select private.has_perm('config'::text)));

alter policy "unidades_insert_config" on public."TD_UNIDADE"
  with check ((select private.has_perm('config'::text)));

alter policy "unidades_select_auth" on public."TD_UNIDADE"
  using (((ativo = true) OR (select private.has_perm('config'::text))));

alter policy "unidades_update_config" on public."TD_UNIDADE"
  using ((select private.has_perm('config'::text)))
  with check ((select private.has_perm('config'::text)));

alter policy "lista_aprovados_historico_select_admin" on public."TH_CANDIDATO_APROVADO"
  using (((select private.monitora_role()) = 'admin'::text));

alter policy "recurso_leitura" on public."TH_CANDIDATO_APROVADO"
  using ((select private.pode_recurso('aprovados'::text)));

alter policy "historico_select_autenticado" on public."TH_MONITORAMENTO"
  using (((select private.has_perm('ind'::text)) OR (select private.has_perm('cores'::text)) OR (select private.has_perm('config'::text)) OR (select private.has_perm('admin'::text))));

alter policy "recurso_leitura" on public."TH_MONITORAMENTO"
  using (((select private.pode_recurso('dashboard'::text)) OR (select private.pode_recurso('nucleo'::text)) OR (select private.pode_recurso('calendario'::text)) OR (select private.pode_recurso('aprovados'::text)) OR (select private.pode_recurso('importacao'::text))));

alter policy "recurso_leitura_permitida" on public."TH_MONITORAMENTO"
  using (((select private.pode_recurso('dashboard'::text)) OR (select private.pode_recurso('nucleo'::text)) OR (select private.pode_recurso('calendario'::text)) OR (select private.pode_recurso('aprovados'::text)) OR (select private.pode_recurso('importacao'::text, 2))));

alter policy "eventos_acesso_select_admin" on public."TL_EVENTO_ACESSO"
  using (((select private.has_perm('admin'::text)) OR (select private.has_perm('config'::text))));

alter policy "analises_sync_log_delete_admin" on public."TL_SYNC_ANALISE"
  using (((select private.has_perm('config'::text)) OR (select private.has_perm('admin'::text))));

alter policy "analises_sync_log_insert_admin" on public."TL_SYNC_ANALISE"
  with check (((select private.has_perm('config'::text)) OR (select private.has_perm('admin'::text))));

alter policy "analises_sync_log_select_admin" on public."TL_SYNC_ANALISE"
  using (((select private.has_perm('config'::text)) OR (select private.has_perm('admin'::text))));

alter policy "analises_sync_log_update_admin" on public."TL_SYNC_ANALISE"
  using (((select private.has_perm('config'::text)) OR (select private.has_perm('admin'::text))))
  with check (((select private.has_perm('config'::text)) OR (select private.has_perm('admin'::text))));

alter policy "recurso_atualizacao" on public."TL_SYNC_ANALISE"
  using ((select private.pode_recurso('analises'::text, 2)))
  with check ((select private.pode_recurso('analises'::text, 2)));

alter policy "recurso_exclusao" on public."TL_SYNC_ANALISE"
  using ((select private.pode_recurso('analises'::text, 3)));

alter policy "recurso_insercao" on public."TL_SYNC_ANALISE"
  with check ((select private.pode_recurso('analises'::text, 2)));

alter policy "recurso_leitura" on public."TL_SYNC_ANALISE"
  using ((select private.pode_recurso('analises'::text)));

alter policy "analises_staging_delete_admin" on public."TM_ANALISE_CURRICULAR"
  using (((select private.has_perm('config'::text)) OR (select private.has_perm('admin'::text))));

alter policy "analises_staging_insert_admin" on public."TM_ANALISE_CURRICULAR"
  with check (((select private.has_perm('config'::text)) OR (select private.has_perm('admin'::text))));

alter policy "analises_staging_select_admin" on public."TM_ANALISE_CURRICULAR"
  using (((select private.has_perm('config'::text)) OR (select private.has_perm('admin'::text))));

alter policy "recurso_atualizacao" on public."TM_ANALISE_CURRICULAR"
  using ((select private.pode_recurso('analises'::text, 2)))
  with check ((select private.pode_recurso('analises'::text, 2)));

alter policy "recurso_exclusao" on public."TM_ANALISE_CURRICULAR"
  using ((select private.pode_recurso('analises'::text, 3)));

alter policy "recurso_insercao" on public."TM_ANALISE_CURRICULAR"
  with check ((select private.pode_recurso('analises'::text, 2)));

alter policy "recurso_leitura" on public."TM_ANALISE_CURRICULAR"
  using ((select private.pode_recurso('analises'::text)));


-- 2. Leitura das análises e dos editais de análise: sem as policies que não mudam o resultado
drop policy if exists "analises_curriculares_select_allowed" on public."TB_ANALISE_CURRICULAR";
drop policy if exists "recurso_leitura" on public."TB_ANALISE_CURRICULAR";
drop policy if exists "analises_editais_select_allowed" on public."TB_EDITAL_ANALISE";
drop policy if exists "recurso_leitura" on public."TB_EDITAL_ANALISE";

commit;
