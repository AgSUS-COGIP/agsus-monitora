/*
  CORREÇÃO DE DADOS — o registro das migrations (public.migracoes_aplicadas)
  volta a dizer a verdade.

  POR QUÊ (auditoria de 13/10/2026; hash = sha256 do arquivo sem "\r"):
    1. 125 linhas foram gravadas com o caminho "supabase/migrations/…" e as
       demais com "migrations/…" (o que scripts/estado-das-migrations.mjs lê):
       a mesma migration aparecia órfã e pendente. Normaliza para
       "migrations/…" e "correcoes/…". (O script também passou a aceitar o
       prefixo — esta branch.)
    2. migrations/20261013160000_payload_so_quando_muda.sql (PR #434, ainda
       aberta, já aplicada) foi registrada com o hash do arquivo COM "\r";
       o conteúdo é o mesmo do arquivo da PR. Troca pelo hash sem "\r".
    3. 29 migrations e 5 correções aplicadas antes do registro (ou sem
       registrar) — cada uma conferida no banco nesta auditoria (objetos que
       criam existem / efeito presente) — entram como 'registro-historico'.

  O QUE FICA DE FORA (pendente no registro, de propósito):
    - migrations/20260624_access_requests_and_panel_permissions.sql: faltam: public.solicitacoes_acesso_paineis, public.perfis_paineis_externos
    - migrations/20260721144500_create_get_analises_dashboard_filtrado.sql: faltam: public.get_analises_dashboard_filtrado
    - migrations/20260721152000_paginate_get_analises_dashboard_filtrado.sql: faltam: public.get_analises_dashboard_filtrado
    - migrations/20260721190000_normalize_analises_historical_filters.sql: faltam: public.get_analises_dashboard_filtrado
    - migrations/20260901114500_configurable_access_branding.sql: sem objeto para conferir
    - migrations/20260901120443_online_presence_sigav.sql: faltam: public.presenca_online_monitora
    - migrations/20260901171419_quarantine_edital_101_2026_analises.sql: faltam: public.analises_curriculares_quarentena, public.analises_importacoes_bloqueadas
    - migrations/20260909114500_platform_assets_6mb.sql: sem objeto para conferir
    - migrations/20260915150000_lista_aprovados_e_perfis.sql: faltam: public.lista_aprovados_candidatos, public.lista_aprovados_historico
    - migrations/20260918120000_registro_do_bridge_da_aya.sql: faltam: public.definir_segredo_bridge_aya, public.registrar_bridge_aya, public.obter_bridge_aya, public.aya_bridge
    - migrations/20260918160000_padronizacao_nomenclatura_tabelas.sql: faltam: public.salvar_monitoramento_indigena
    - migrations/20260918170000_padronizacao_views_item9.sql: faltam: public.get_analises_dashboard_recorte, public.get_monitoramento_dashboard_payload
    - migrations/20260921130000_corrige_acentos_das_funcoes_restantes.sql: sem objeto para conferir
    - migrations/20260922120000_editais_existentes_como_usi.sql: sem objeto para conferir
    - migrations/20260922160000_permissoes_por_modulo.sql: faltam: private.meu_perfil_id, public.minhas_permissoes_por_modulo, public.definir_nivel_do_modulo, public.permissoes_por_modulo, public.permissoes_por_modulo_historico
    - migrations/20260923153000_corrigir_concluido_saude_indigena.sql: sem objeto para conferir
    - migrations/20260924112623_permitir_contexto_permissoes_autenticado.sql: sem objeto para conferir
    - migrations/20260929121200_recorte_por_coordenacao_nas_rpcs.sql: faltam: public.get_analises_dashboard_filtrado
    - migrations/20260929180000_cce_e_escritorio_em_projetos.sql: sem objeto para conferir
    - migrations/20260929190000_acesso_basico_institucional.sql: NÃO APLICAR (acesso automático @agenciasus; decisão do usuário)
    - as demais correções de supabase/correcoes/: rodaram (ou não) à mão;
      a equipe confirma uma a uma (node scripts/estado-das-migrations.mjs
      --registrar=correcoes/<arquivo>.sql). Marcar sem ter aplicado é a única
      forma de o registro mentir.

  Idempotente: rodar de novo não muda nada. Nada no schema muda.
*/
begin;

-- 1. Caminho sem o prefixo "supabase/".
update public.migracoes_aplicadas a
   set caminho = substr(a.caminho, length('supabase/') + 1)
 where a.caminho like 'supabase/%'
   and not exists (select 1 from public.migracoes_aplicadas b
                    where b.caminho = substr(a.caminho, length('supabase/') + 1));

-- 2. Hash sem "\r" da migration da PR #434 (registrada com CRLF).
update public.migracoes_aplicadas
   set hash = 'c7c8a34f4fb8aacf833ffaeec4215769534538f66fac5b613fa0c491f1a15640'
 where caminho = 'migrations/20261013160000_payload_so_quando_muda.sql'
   and hash = 'e6c932da65872bd85fd330871271d8a344f5a292799fba5be54845a53ec93e00';

-- 3. Aplicadas e conferidas, sem registro.
insert into public.migracoes_aplicadas (caminho, hash, origem)
select v.caminho, v.hash, 'registro-historico'
  from (values
  ('migrations/20260805115500_add_profile_avatar_preferences.sql', '52905ec4b2cc845f00d779dd42e7e0ded67e791d2c671cd8b6de039933873f7d'),  -- objetos: public.meu_usuario, public.set_my_avatar_choice
  ('migrations/20260828143954_unify_platform_access_context.sql', '4fb7147c90aeaee56262f6071fd05a19b01cfbb7275c06a9195dd2f7bce9401e'),  -- objetos: public.obter_contexto_monitora
  ('migrations/20260902174355_configurable_access_background_storage.sql', '7b9d5c3ef933098b555ee65d4844e0b5fa771ac7dc6548c1233a36135001316e'),  -- objetos: public.definir_fundo_acesso_monitora
  ('migrations/20260903115251_harden_access_background_rpc.sql', 'e9f65da69eae256a3b9f566fd4e84db0d8e51409cb069425152ad90c7a65d4fc'),  -- objetos: private.definir_fundo_acesso_monitora, public.definir_fundo_acesso_monitora
  ('migrations/20260908123500_reconcile_monitora_access_context.sql', '90525562c9c8267a494db97c8b9bd6ba8e21458fb8695cdb730aafa8d39ab977'),  -- objetos: public.obter_contexto_monitora
  ('migrations/20260908181500_recusar_solicitacao_acesso_por_rpc.sql', '9db44ad836f02306babc47225b29434beeb08ba49ea8cf0722005d90caff8b54'),  -- objetos: public.recusar_solicitacao_acesso
  ('migrations/20260909121500_branding_publico_da_tela_de_acesso.sql', 'a7358a50c97cf051c10d10f31dc449b2a91e0aeecda074f9dd29b313ebba5cab'),  -- objetos: public.obter_branding_acesso_publico
  ('migrations/20260910120000_modo_do_texto_da_tela_de_acesso.sql', '1b467e3669e476ff12effdf5bca013056fdf6db2ed5c288700df0c799dbf582d'),  -- objetos: public.obter_branding_acesso_publico
  ('migrations/20260916102000_proteger_proprio_acesso_admin.sql', 'aff1f5746eaa8e3a0c11f745a0abc9035cd12b7e1044ad84b3a18367aaeded0b'),  -- objetos: private.proteger_proprio_acesso
  ('migrations/20260921120000_corrige_acentos_do_status_do_candidato.sql', '00e9c397d6fa6c696340643d2c8969a156303d62c1ccdcd87a8654a91dc389f4'),  -- objetos: public.alterar_status_candidato_aprovado
  ('migrations/20260923120000_lista_de_convocacao.sql', 'bfe7ca9348a98f35eaafdb2cc92b14d4e842bc554fa55a5a5793c65713fed104'),  -- objetos: public.listar_configuracao_convocacao, public.salvar_configuracao_convocacao, public.listar_candidatos_aprovados, public."TB_CONVOCACAO_EDITAL", public."TB_VAGA_IMEDIATA"
  ('migrations/20260923140000_status_fim_de_fila.sql', '00143d476b8d852174f1e07ae773c412a13478b470d7683512b700c8057ceeb0'),  -- objetos: public.alterar_status_candidato_aprovado
  ('migrations/20260923150000_padronizar_modalidade_concorrencia.sql', 'a531a269b5b1e1a822432c5bb18ed804f9be63ebe41cbeb055b0be1cfef3b886'),  -- objetos: private.normalizar_modalidade_concorrencia, private.aplicar_normalizacao_modalidade_concorrencia
  ('migrations/20260923181135_permissoes_modulos_paineis.sql', 'a1e3006e879ce3e96271c6925e1be35abf0d0802e4fcc0a9a1146e559256ffc8'),  -- objetos: public.salvar_matriz_acessos, private.has_perm, public.usuario_pode_ler_analises, public."TB_PERMISSAO_RECURSO", public."TH_PERMISSAO_RECURSO"
  ('migrations/20260928180000_autoria_e_trava_da_lista_de_aprovados.sql', '8e2951f57a11ae7d03413220aa1eafacff336a98ee398cc77ef69ddc8494abee'),  -- objetos: public.remover_lista_aprovados, public.listar_listas_aprovados, public.alterar_status_candidato_aprovado
  ('migrations/20260928235000_anexos_so_admin.sql', 'ce03c9b9f562e8c2cd4823ecd8012e8481cb3e60c78bced7029abd58acdd3954'),  -- objetos: public.registrar_anexo_candidato_aprovado, public.remover_anexo_candidato_aprovado
  ('migrations/20260929121000_grupos_de_acesso.sql', '368d4c12c620cc74e7cae0dd9f4a9bd3192a5d154b3dd0e0cd606fb462307fa6'),  -- objetos: private.nivel_recurso, private.is_master, private.monitora_role, public."TB_GRUPO_ACESSO", public."TA_GRUPO_ACESSO_RECURSO"
  ('migrations/20260929121100_coordenacoes.sql', '852fdb799decf1ab73c5a8ca5dfad650326cc48df03ee425155c396a986aab23'),  -- objetos: private."FC_EDITAIS_NORM_VISIVEIS", private."FC_UNIDADES_NORM_VISIVEIS", public.obter_contexto_monitora, public."RL_COORDENACAO_UNIDADE", public."RL_COORDENACAO_EDITAL"
  ('migrations/20260929121300_gestao_de_acessos_delegada.sql', 'd0fa306638d86b89d3945628f500394b3577dba047f2cb4a1aaf37cca3e6bdd0'),  -- objetos: public.listar_coordenacoes_ativas, public.registrar_solicitacao_acesso, public.obter_minha_solicitacao_acesso, public."TH_GRUPO_ACESSO", public."TH_COORDENACAO"
  ('migrations/20261001090000_selecao.sql', '6e59e5ea983b08c372cd7bb38a1577eec31cdb7ec4c0f1010c92f56b30fb7404'),  -- objetos: public.sincronizar_selecao, public.finalizar_sync_selecao, public.get_selecao_da_area, public."TB_SELECAO_VAGA", public."TL_SYNC_SELECAO"
  ('migrations/20261001090500_liga_aba_selecao.sql', '8a822b578c7882e4e8ee83f9bc577884540c29641efd308a855bc3191cea2aec'),  -- TB_ABA selecao ativa
  ('migrations/20261001100000_selecao_area_pelos_editais.sql', '540a839117597901eaecf0439608a66af908da12ddaeaa98c447c0f2caf15c24'),  -- objetos: private."FC_LIGAR_SELECAO_AOS_EDITAIS", public.finalizar_sync_selecao
  ('migrations/20261001120000_saude_das_cargas.sql', 'f1f45ecb29874499814cc9962113596124949e543a5f018cf43fd73bfef042e8'),  -- objetos: public.get_saude_das_cargas
  ('migrations/20261001130000_selecao_aprovados_outras_bancas.sql', '95962973f31dc23553e4b68aec47a21224f624296db00a2be8a72b83310e07ea'),  -- objetos: public.get_selecao_da_area
  ('migrations/20261001150000_sub_judice_alteracao.sql', 'f1a89a345d5ba76caec5b0b138d63114ae7025a6aaa27859ee3f526a02326f45'),  -- objetos: public.desfazer_alteracao_sub_judice, private."FC_MONTAR_APROVADOS_AREA", public.listar_candidatos_aprovados_compacto, public."TH_CANDIDATO_SUB_JUDICE"
  ('migrations/20261002090000_convocacao_serie_mgi.sql', '44cee09ca31df1a3332313527004bf7aabcfee20eaac8422e5a518b703ffe0c6'),  -- CK_MODELO_CONVOC_DISTRIB aceita SERIE_MGI
  ('migrations/20261006170000_remove_atualizacao_manual_dos_dashboards.sql', 'd760cbab6cf3e24971c3fb29c2ed14fac1931331dd2328189d7cbd1a910e63be'),  -- pode_atualizar_dashboard não existe
  ('migrations/add_update_user_access_rpc.sql', 'd74bc56b097df738ca883b9d55163edd7470b16464313206de9197fd253518b1'),  -- objetos: private.is_master, public.atualizar_acesso_usuario
  ('migrations/restrict_access_management_to_master.sql', 'cee2d7fce90b32b21c7eda96dc90ffc45c05f731e03ee22a1d981e5497674f07'),  -- objetos: public.aprovar_solicitacao_acesso, public.revogar_paineis_usuario, public.desativar_acesso_usuario
  ('correcoes/20261009-edital-114-regra-da-avaliacao.sql', '87cb1dba0b6793ea3e7abaa0b4c16858b998aaaa3fad9db705d52c7928776807'),  -- TH_REGRA_ANALISE do 114: versões 1 e 2
  ('correcoes/20261009-edital-114-analise-no-monitora.sql', 'ec45003c7188843046eb4fe8c6551318ed0aa0563c69f32a36cfbf6465807157'),  -- TB_ORIGEM_ANALISE_EDITAL do 114 = MONITORA
  ('correcoes/20261013-edital-114-regra-por-cargo.sql', '0215e6e9acd8299082c252372509bc4adf835e2aff6659cf388c8e4f058d23d0'),  -- TH_REGRA_ANALISE do 114: versão 8 (Diferenças por cargo)
  ('correcoes/20261013-edital-114-regra-v9.sql', 'dd691ebf070a27409fd9b21a65ca096d8aa9d60dc48ebeff84040674d8ee9ff8'),  -- TH_REGRA_ANALISE do 114: versão 9 (Revisão dos motivos)
  ('correcoes/20261013-edital-114-regra-v10-cotas.sql', '26f102e28f4e943011978118bb04fa561b4385b1fad24c89ae3b696b0e9054cc')  -- TH_REGRA_ANALISE do 114: versão 10 (Motivos das cotas)
       ) as v(caminho, hash)
on conflict (caminho) do nothing;

-- Conferência (esperado: 0 com prefixo; total = antes + 34).
select count(*) filter (where caminho like 'supabase/%') as com_prefixo,
       count(*) as total
  from public.migracoes_aplicadas;

commit;
