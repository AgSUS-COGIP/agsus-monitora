/*
  Contrato das RPCs — o mapa único do que o frontend espera do banco.

  Antes, os 30 pontos de chamada espalhavam o nome de 22 funções por 12
  ficheiros, metade como literal e metade como constante local. Nada garantia
  que a função existisse no banco, nem que a assinatura batesse: a descoberta
  vinha em produção, como mensagem de erro — e, pior, como mensagem *errada*,
  porque "função ausente" era lida como sessão expirada (ver `lib/sessao.js`).

  Este ficheiro é a fonte de verdade. `scripts/check-rpc-contract.mjs` verifica
  duas coisas contra ele:

  1. Estático, em todo build: nenhuma chamada usa nome que não esteja declarado
     aqui, e nenhuma entrada daqui fica sem quem a chame. O mapa não pode ficar
     desatualizado em silêncio. Conta como chamada tanto `.rpc("…")` pelo cliente
     Supabase como uma constante `RPC_*` que nomeia uma função do contrato — é
     assim que `obter_branding_acesso_publico` é pedida, por `fetch` direto, para
     não herdar a sessão do utilizador.
  2. Contra o banco, em job próprio (`check:rpc-contract:db`), quando há
     credencial de servidor: cada função existe e aceita os parâmetros
     declarados, lendo `pg_proc` — o catálogo do PostgreSQL — em sessão
     somente-leitura. Nenhuma função é chamada.

     Não é a especificação OpenAPI do PostgREST, e a distinção custou um erro:
     aquela especificação reflete os privilégios da role que pergunta, de modo
     que com `anon` as funções de `authenticated` ficam invisíveis e passariam
     por inexistentes. O catálogo mostra o que existe, independentemente de quem
     pode executar.

  `critica: true` marca as funções sem as quais a tela correspondente não
  funciona. São as que fazem a verificação falhar; as demais apenas avisam.
*/

/** @typedef {{ argumentos: string[], critica: boolean, resumo: string }} ContratoRpc */

/** @type {Record<string, ContratoRpc>} */
export const CONTRATO_RPC = {
  obter_matriz_acessos: {
    argumentos: ["p_busca", "p_offset"],
    critica: true,
    resumo: "Matriz paginada de permissões por módulo e painel com histórico.",
  },
  salvar_matriz_acessos: {
    argumentos: ["p_alteracoes", "p_motivo"],
    critica: true,
    resumo:
      "Salva alterações de acesso com auditoria e controle de concorrência.",
  },
  // ── Identidade e autorização ────────────────────────────────────────────
  meu_usuario: {
    argumentos: [],
    critica: true,
    resumo: "Perfil e permissões de quem está autenticado.",
  },
  obter_contexto_monitora: {
    argumentos: [],
    critica: true,
    resumo: "Contexto unificado de acesso: perfil, permissões e painéis.",
  },
  obter_branding_acesso_publico: {
    argumentos: [],
    critica: true,
    resumo:
      "Identidade da tela de acesso, antes de autenticar. Só as seis chaves públicas de branding.",
  },
  usuario_pode_ler_analises: {
    argumentos: [],
    critica: true,
    resumo: "Porteiro da página de Análises.",
  },

  // ── Administração de acesso (somente perfil master) ─────────────────────
  aprovar_solicitacao_acesso: {
    argumentos: [
      "p_solicitacao_id",
      "p_perfil",
      "p_permissoes",
      "p_paineis",
      "p_observacao_admin",
    ],
    critica: true,
    resumo: "Aprova solicitação e cria/atualiza o perfil correspondente.",
  },
  recusar_solicitacao_acesso: {
    argumentos: ["p_solicitacao_id", "p_observacao_admin"],
    critica: true,
    resumo: "Recusa solicitação registando quem avaliou e quando.",
  },
  atualizar_acesso_usuario: {
    argumentos: [
      "p_perfil_usuario_id",
      "p_perfil",
      "p_permissoes",
      "p_paineis",
      "p_motivo",
    ],
    critica: true,
    resumo: "Altera perfil, permissões e painéis de um usuário.",
  },
  desativar_acesso_usuario: {
    argumentos: ["p_perfil_usuario_id", "p_motivo"],
    critica: true,
    resumo: "Desativa o acesso de um usuário.",
  },
  get_acessos_config_master: {
    argumentos: ["p_days", "p_online_minutes", "p_recent_limit"],
    critica: false,
    resumo: "Painel de acessos da tela de Configurações.",
  },

  // ── Configurações ───────────────────────────────────────────────────────
  salvar_configuracoes_e_paineis: {
    argumentos: ["p_config_rows", "p_paineis"],
    critica: true,
    resumo: "Grava configurações e painéis (caminho clássico).",
  },
  salvar_configuracoes_e_paineis_v2: {
    argumentos: ["p_config_rows", "p_paineis", "p_motivo"],
    critica: true,
    resumo: "Grava configurações com versionamento e motivo.",
  },
  get_configuracoes_snapshot: {
    argumentos: [],
    critica: false,
    resumo: "Estado corrente de configurações e painéis.",
  },
  get_configuracoes_historico: {
    argumentos: ["p_limit"],
    critica: false,
    resumo: "Histórico de versões das configurações.",
  },
  restaurar_configuracoes_versao: {
    argumentos: ["p_versao_id", "p_motivo"],
    critica: false,
    resumo: "Restaura uma versão anterior das configurações.",
  },
  definir_fundo_acesso_monitora: {
    argumentos: ["p_url", "p_caminho"],
    critica: false,
    resumo: "Define a arte de fundo da tela de acesso.",
  },

  // ── Monitoramento e cronograma ──────────────────────────────────────────
  salvar_monitoramento_com_cronograma_v2: {
    argumentos: ["p_payload", "p_cronograma", "p_motivo", "p_numero_errata"],
    critica: true,
    resumo: "Grava monitoramento junto com o cronograma.",
  },
  get_monitoramento_cronograma: {
    argumentos: ["p_monitoramento_id"],
    critica: true,
    resumo: "Cronograma de um monitoramento.",
  },
  listar_etapas_do_cronograma: {
    argumentos: [],
    critica: false,
    resumo:
      "Todas as etapas de cronograma dos editais ativos, num pedido só (tela Cronograma).",
  },
  get_nucleo_cronograma_resumo: {
    argumentos: [],
    critica: false,
    resumo: "Resumo dos cronogramas da Equipe Núcleo.",
  },

  // ── Lista de Aprovados ─────────────────────────────────────────────────
  listar_listas_aprovados: {
    argumentos: [],
    critica: true,
    resumo: "Lista as listas vigentes de aprovados vinculadas aos editais.",
  },
  listar_candidatos_aprovados: {
    argumentos: [],
    critica: true,
    resumo: "Lista os candidatos vigentes das listas de aprovados.",
  },
  importar_lista_aprovados: {
    argumentos: [
      "p_edital_id",
      "p_ativo",
      "p_arquivo_nome",
      "p_arquivo_path",
      "p_candidatos",
      "p_substituir",
    ],
    critica: true,
    resumo: "Importa ou substitui a lista XLSX de aprovados de um edital.",
  },
  definir_lista_aprovados_ativa: {
    argumentos: ["p_lista_id", "p_ativo"],
    critica: true,
    resumo: "Ativa ou inativa uma lista vigente de aprovados.",
  },
  remover_lista_aprovados: {
    argumentos: ["p_lista_id"],
    critica: true,
    resumo: "Arquiva a lista vigente de aprovados preservando o histórico.",
  },
  alterar_status_candidato_aprovado: {
    argumentos: ["p_candidato_id", "p_status", "p_processo_sei", "p_matricula"],
    critica: true,
    resumo:
      "Altera o status de um candidato e registra processo SEI e matrícula quando informados.",
  },
  incluir_sub_judice: {
    argumentos: ["p_edital_id", "p_cargo", "p_nome", "p_nota"],
    critica: true,
    resumo:
      "Inclui manualmente um candidato sub judice na lista vigente do edital.",
  },
  remover_sub_judice: {
    argumentos: ["p_candidato_id"],
    critica: true,
    resumo:
      "Remove logicamente um candidato sub judice preservando o histórico.",
  },

  // ── Lista de convocação ─────────────────────────────────────────────────
  listar_modelos_convocacao: {
    argumentos: [],
    critica: true,
    resumo: "Lista os modelos de regras disponíveis para convocação.",
  },
  listar_configuracao_convocacao: {
    argumentos: [],
    critica: true,
    resumo: "Lista a configuração de convocação dos editais.",
  },
  salvar_modelo_convocacao: {
    argumentos: ["p_modelo"],
    critica: true,
    resumo: "Cria ou atualiza um modelo de regras de convocação.",
  },
  remover_modelo_convocacao: {
    argumentos: ["p_modelo_id"],
    critica: true,
    resumo: "Remove um modelo de convocação quando não está em uso.",
  },
  salvar_configuracao_convocacao: {
    argumentos: [
      "p_edital_id",
      "p_proporcionalidade",
      "p_modelo_id",
      "p_padrao_imediata",
      "p_vagas",
    ],
    critica: true,
    resumo: "Grava modelo, proporcionalidade e vagas imediatas de um edital.",
  },

  // ── Análises ────────────────────────────────────────────────────────────
  get_analises_dashboard_payload_v2: {
    argumentos: ["p_scope"],
    critica: true,
    resumo: "Payload consolidado do painel de Análises.",
  },

  // ── Auditoria e presença ────────────────────────────────────────────────
  registrar_evento_acesso: {
    argumentos: [
      "p_evento",
      "p_tela",
      "p_origem",
      "p_detalhes",
      "p_client_session_id",
      "p_user_agent",
      "p_app_version",
    ],
    critica: false,
    resumo: "Registo de auditoria de acesso. Nunca deve bloquear a interface.",
  },
  registrar_presenca_monitora: {
    argumentos: ["p_current_view"],
    critica: false,
    resumo: "Marca presença online do usuário.",
  },
  listar_presenca_online_monitora: {
    argumentos: [],
    critica: false,
    resumo: "Lista quem está online agora.",
  },
};

export const RPCS_CRITICAS = Object.entries(CONTRATO_RPC)
  .filter(([, c]) => c.critica)
  .map(([nome]) => nome);

export function contratoDe(nome) {
  return CONTRATO_RPC[nome] || null;
}
