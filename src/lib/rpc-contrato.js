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
  salvar_coordenada_mapa_saude_indigena: {
    argumentos: [
      "p_alvo",
      "p_latitude",
      "p_longitude",
      "p_latitude_anterior",
      "p_longitude_anterior",
      "p_motivo",
      "p_conferido",
    ],
    critica: true,
    resumo:
      "Corrige a coordenada de um ponto existente e/ou o marca como conferido (p_conferido), com histórico privado. Só administrador global ou Gestor.",
  },
  desfazer_coordenada_mapa_saude_indigena: {
    argumentos: ["p_historico", "p_motivo"],
    critica: false,
    resumo:
      "Volta a última alteração de um ponto do mapa como alteração nova, com motivo. Só administrador global ou Gestor.",
  },
  listar_historico_coordenada_mapa_saude_indigena: {
    argumentos: ["p_alvo", "p_limite"],
    critica: false,
    resumo:
      "Últimas alterações de um ponto do mapa (quem, quando, de/para, motivo). Só administrador global ou Gestor.",
  },
  listar_pendencias_coordenada_mapa_saude_indigena: {
    argumentos: [],
    critica: false,
    resumo:
      "Pontos do mapa ainda não conferidos depois da auditoria, com candidatos. Só administrador global ou Gestor.",
  },
  // ── Editor de coordenadas do mapa de Projetos (admin global ou Gestor) ──
  salvar_coordenada_mapa_projetos: {
    argumentos: [
      "p_lugar",
      "p_latitude",
      "p_longitude",
      "p_latitude_anterior",
      "p_longitude_anterior",
      "p_motivo",
      "p_conferido",
    ],
    critica: true,
    resumo:
      "Corrige a coordenada de um lugar das vagas de Projetos (cria a linha se não havia) e/ou o marca como conferido (p_conferido), com concorrência pela posição anterior e histórico privado. Só administrador global ou Gestor (migrations 20261002190000 e 20261002200000).",
  },
  desfazer_coordenada_mapa_projetos: {
    argumentos: ["p_historico", "p_motivo"],
    critica: false,
    resumo:
      "Volta a última alteração de um lugar do mapa de Projetos como alteração nova, com motivo. Só administrador global ou Gestor.",
  },
  listar_historico_coordenada_mapa_projetos: {
    argumentos: ["p_lugar", "p_limite"],
    critica: false,
    resumo:
      "Últimas alterações de um lugar do mapa de Projetos (quem, quando, de/para, motivo). Só administrador global ou Gestor.",
  },
  listar_pendencias_coordenada_mapa_projetos: {
    argumentos: [],
    critica: false,
    resumo:
      "Lugares do mapa de Projetos com coordenada duvidosa (sem coordenada, só a sede do município, só a UF, município/UF que não batem…), com candidatos e situação. Só administrador global ou Gestor.",
  },
  // ── Configurações › Acessos (admin global ou coordenador, com teto) ──────
  obter_matriz_acessos: {
    argumentos: ["p_busca", "p_offset", "p_coordenacao", "p_grupo"],
    critica: true,
    resumo:
      "Pessoas paginadas (célula: do grupo ou individual; último acesso real: login, uso ou presença), grupos, coordenações, teto de quem pede e histórico.",
  },
  salvar_matriz_acessos: {
    argumentos: ["p_alteracoes", "p_motivo"],
    critica: true,
    resumo:
      "Salva níveis individuais, grupo e coordenação (nível null volta ao grupo), com teto do coordenador, auditoria e revisão.",
  },
  listar_solicitacoes_acesso: {
    argumentos: ["p_status"],
    critica: true,
    resumo:
      "Solicitações de acesso: todas (admin) ou da coordenação (coordenador).",
  },
  salvar_grupo_acesso: {
    argumentos: ["p_grupo", "p_motivo"],
    critica: false,
    resumo:
      "Cria ou edita um grupo de permissões (níveis por módulo). Só admin global.",
  },
  remover_grupo_acesso: {
    argumentos: ["p_codigo", "p_motivo"],
    critica: false,
    resumo: "Exclui grupo sem pessoas. Só admin global.",
  },
  salvar_coordenacao: {
    argumentos: ["p_coordenacao", "p_motivo"],
    critica: false,
    resumo:
      "Cria ou edita coordenação (área, responsável, unidades, editais). Só admin global.",
  },
  desativar_coordenacao: {
    argumentos: ["p_codigo", "p_motivo"],
    critica: false,
    resumo: "Desativa coordenação sem usuários. Só admin global.",
  },
  obter_contexto_de_usuario: {
    argumentos: ["p_perfil_usuario_id"],
    critica: false,
    resumo: '"Ver como": contexto de acesso de outra pessoa, só leitura.',
  },
  listar_coordenacoes_ativas: {
    argumentos: [],
    critica: false,
    resumo:
      "Coordenações para escolher ao pedir acesso (autenticado, mesmo sem perfil).",
  },
  registrar_solicitacao_acesso: {
    argumentos: ["p_nome", "p_setor", "p_justificativa", "p_coordenacao"],
    critica: true,
    resumo: "Registra a solicitação de acesso de quem está autenticado.",
  },
  adicionar_pessoa_acesso: {
    argumentos: [
      "p_email",
      "p_nome",
      "p_grupo",
      "p_coordenacao",
      "p_areas",
      "p_motivo",
    ],
    critica: false,
    resumo:
      "Cadastra uma pessoa pelo e-mail (entra sem pedir), com grupo e coordenação ou áreas.",
  },
  mover_conta_para_coordenacoes: {
    argumentos: ["p_perfil_usuario_id", "p_area", "p_motivo"],
    critica: false,
    resumo:
      "Conta que é uma coordenação vira coordenação e é desativada. Só admin global.",
  },
  obter_minha_solicitacao_acesso: {
    argumentos: [],
    critica: false,
    resumo: "Última solicitação de acesso de quem está autenticado.",
  },
  minha_conta_desativada: {
    argumentos: [],
    critica: false,
    resumo:
      "true quando quem está autenticado tem conta no MONITORA e ela está desativada.",
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
  listar_abas_do_menu: {
    argumentos: [],
    critica: false,
    resumo:
      "Catálogo de abas do menu lateral (TB_ABA × RL_ABA_AREA), já resolvido por área, com selo BETA (st_beta) e manutenção da aba e da aba na área. Sem ela, o menu usa ABAS_DO_MENU (o mesmo catálogo no código).",
  },
  // ── Módulos e abas: ativar, desativar, manutenção e selo BETA ────────────
  obter_situacao_do_sistema: {
    argumentos: [],
    critica: false,
    resumo:
      "Situação do sistema inteiro e de cada área (ativo, manutenção, mensagem, previsão) para o menu e a tela de manutenção, e o liga/desliga das comemorações (sistema.comemoracoes), lido também pelos painéis. Sem ela, tudo vale como ativo e as comemorações ficam desligadas.",
  },
  obter_modulos_e_abas: {
    argumentos: [],
    critica: false,
    resumo:
      "Configurações › Módulos e abas (admin global): sistema, áreas com as abas, abas, painéis externos e as 50 últimas mudanças.",
  },
  salvar_situacao_modulos: {
    argumentos: ["p_alteracoes", "p_motivo"],
    critica: false,
    resumo:
      "Grava em lote ativo/situação/mensagem/previsão/beta de sistema, áreas, abas, abas por área e painéis, e comemoracoes (S/N) do sistema, com motivo e histórico (admin global).",
  },
  // ── Comemorações: marcos do ano da equipe (nunca ranking individual) ─────
  obter_marcos_da_area: {
    argumentos: ["p_area"],
    critica: false,
    resumo:
      "Análises concluídas (Aprovado/Reprovado, ativas) da área no ano corrente e no total, para o card de marcos do ano na Visão geral. Exige a área do usuário. Sem ela, o card não aparece.",
  },
  obter_branding_acesso_publico: {
    argumentos: [],
    critica: true,
    resumo:
      "Identidade da tela de acesso, antes de autenticar. Só as seis chaves públicas de branding.",
  },
  obter_ultima_conferencia: {
    argumentos: ["p_fonte", "p_area"],
    resumo:
      "Hora da última conferência da fonte: análises = a mais recente entre a carga da planilha, a montagem do resumo do Painel da área e a última rodada do job do resumo (migration 20261019190000); seleção e entrevistas = última carga que terminou bem; só quem pode ler a tela.",
  },
  obter_ritmo_da_analise: {
    argumentos: ["p_area"],
    resumo:
      "Card Ritmo da análise do Painel das análises (migration 20261019170000): por edital da área com a avaliação documental no MONITORA, contagens por situação, concluídas por dia (14 dias), equipe de analistas, avaliadores recentes e cronograma; só quem pode ler o Painel da área.",
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
      "p_grupo",
      "p_coordenacao",
      "p_areas",
      "p_observacao_admin",
    ],
    critica: true,
    resumo:
      "Aprova solicitação definindo grupo e coordenação (ou áreas). Admin ou coordenador da coordenação pedida.",
  },
  recusar_solicitacao_acesso: {
    argumentos: ["p_solicitacao_id", "p_observacao_admin"],
    critica: true,
    resumo: "Recusa solicitação registando quem avaliou e quando.",
  },
  desativar_acesso_usuario: {
    argumentos: ["p_perfil_usuario_id", "p_motivo"],
    critica: true,
    resumo:
      "Desativa o acesso de um usuário; motivo obrigatório (3 a 500), gravado no histórico.",
  },
  listar_contas_desativadas: {
    argumentos: ["p_busca"],
    critica: false,
    resumo:
      "Aba Desativadas de Acessos (admin global): quando, por quem, motivo, grupo/áreas de antes, pedido pendente e último acesso real.",
  },
  reativar_acesso_usuario: {
    argumentos: [
      "p_perfil_usuario_id",
      "p_grupo",
      "p_coordenacao",
      "p_areas",
      "p_motivo",
    ],
    critica: false,
    resumo:
      "Reativa uma conta desativada com grupo, coordenação e áreas (regras da matriz), com motivo. Só admin global.",
  },

  // ── Configurações ───────────────────────────────────────────────────────
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
    resumo:
      "Grava monitoramento junto com o cronograma. Com `co_area` no p_payload, salva na área pretendida (recusa unidade de outra área e registra a unidade nova).",
  },
  mover_edital_de_area: {
    argumentos: ["p_id", "p_area", "p_motivo"],
    critica: false,
    resumo:
      "Só admin: muda o edital de área, com motivo auditado em TH_MONITORAMENTO.",
  },
  // ── Edital de treinamento (20261007230000_edital_de_treinamento.sql)
  reiniciar_edital_treinamento: {
    argumentos: ["p_edital"],
    critica: false,
    resumo:
      "Só admin global: volta o edital de treinamento (ST_TREINAMENTO = S) ao estado inicial — apaga fisicamente os dados dele e recria os fictícios; edital real é recusado (42501).",
  },
  listar_unidades_por_area: {
    argumentos: [],
    critica: false,
    resumo:
      "Unidades com área definida (TA_UNIDADE_AREA); sem ela o formulário cai na área dos editais.",
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
    resumo:
      "Lista as listas vigentes de aprovados vinculadas aos editais, com nome e e-mail de quem importou, a origem (XLSX ou CLASSIFICACAO) e a lista de classificação publicada.",
  },
  // ── Payload só quando muda (20261013160000_payload_so_quando_muda.sql) ──
  // As quatro primeiras chamam a função de sempre e devolvem o payload com
  // `versao` (md5 sem `gerado_em`), ou só `{ inalterado, versao }` quando
  // p_versao é a atual.
  get_analises_dashboard_payload_v2_se_mudou: {
    argumentos: ["p_scope", "p_area", "p_versao"],
    critica: true,
    resumo:
      "get_analises_dashboard_payload_v2 com versão: o painel de Análises revalida a cópia sem baixar o payload (até 4 MB) quando nada mudou.",
  },
  get_entrevistas_da_area_se_mudou: {
    argumentos: ["p_area", "p_versao"],
    critica: false,
    resumo:
      "get_entrevistas_da_area com versão: a aba Entrevistas revalida a cópia ou o que já tem sem baixar o payload quando nada mudou.",
  },
  get_selecao_da_area_se_mudou: {
    argumentos: ["p_area", "p_versao"],
    critica: false,
    resumo:
      "get_selecao_da_area com versão: a aba Seleção revalida a cópia ou o que já tem sem baixar o payload quando nada mudou.",
  },
  listar_acompanhamento_da_visao_geral_se_mudou: {
    argumentos: ["p_area", "p_versao"],
    critica: false,
    resumo:
      "listar_acompanhamento_da_visao_geral com versão: a Visão geral relê o acompanhamento da área sem baixar de novo o que não mudou.",
  },
  listar_mapa_da_saude_indigena: {
    argumentos: ["p_versao"],
    critica: false,
    resumo:
      "O mapa da Saúde Indígena (`lmap` e `rede_cnes` de TB_CONFIG_MAPA_SAUDE_INDIG, ~150 kB; SECURITY INVOKER, a RLS de sempre) como `{ linhas: [{ chave, payload }], versao }`; p_versao igual à atual devolve só `inalterado` (20261015000100). Substitui o select direto na tabela na entrada.",
  },
  listar_monitoramento_operacional: {
    argumentos: ["p_versao"],
    critica: true,
    resumo:
      "As linhas ativas do monitoramento (VW_MONITORAMENTO_INDIGENA_OPERACIONAL, 40 colunas, por unidade e edital; SECURITY INVOKER, a RLS de sempre), com versão: a entrada, o F5 e o 'Atualizar dados' não baixam de novo o que não mudou. Substitui o select direto na view.",
  },
  listar_candidatos_aprovados_compacto: {
    argumentos: ["p_area", "p_versao"],
    critica: true,
    resumo:
      "Candidatos vigentes da lista de aprovados de uma área numa chamada só: listas uma vez, cargo/modalidade/status/código da vaga em dicionário e linhas posicionais; p_versao igual à atual devolve só `inalterado`.",
  },
  importar_lista_aprovados: {
    argumentos: [
      "p_edital_id",
      "p_ativo",
      "p_arquivo_nome",
      "p_arquivo_path",
      "p_candidatos",
      "p_substituir",
      "p_motivo",
    ],
    critica: true,
    resumo:
      "Importa ou substitui a lista XLSX de aprovados de um edital; sobre lista publicada da Classificação, exige p_motivo. Vai para o histórico das publicações.",
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
    argumentos: [
      "p_candidato_id",
      "p_status",
      "p_processo_sei",
      "p_matricula",
      "p_data_convocacao",
    ],
    critica: true,
    resumo:
      "Altera o status de um candidato (Convocado, Contratado, Desistente, Migração, Documentação Rejeitada ou nulo), com processo SEI, matrícula e a data da convocação (Convocado). Status já definido só o admin altera, exceto do Convocado para outro status.",
  },
  marcar_candidatos_convocados: {
    argumentos: ["p_candidatos", "p_data_convocacao", "p_carta"],
    critica: false,
    resumo:
      "Marca como Convocado, com a data, os candidatos sem status ou já convocados (os demais voltam em ignorados); com p_carta, liga a marcação à carta emitida. Aprovados editor.",
  },
  listar_modelos_carta_convocacao: {
    argumentos: ["p_area"],
    critica: false,
    resumo:
      "Modelos da carta de convocação da área, com a versão vigente, as últimas versões e quantas cartas saíram de cada um; pode_editar.",
  },
  salvar_modelo_carta_convocacao: {
    argumentos: [
      "p_modelo",
      "p_area",
      "p_edital",
      "p_conteudo",
      "p_versao_atual",
      "p_motivo",
    ],
    critica: false,
    resumo:
      "Cria o modelo da carta (área ou edital) ou grava a próxima versão: PT409 se a versão mudou; motivo obrigatório a partir da 2ª. Aprovados editor.",
  },
  definir_modelo_carta_ativo: {
    argumentos: ["p_modelo", "p_ativo", "p_motivo"],
    critica: false,
    resumo:
      "Inativa ou reativa um modelo da carta de convocação, com motivo. Aprovados editor.",
  },
  registrar_carta_convocacao: {
    argumentos: [
      "p_modelo",
      "p_versao",
      "p_candidatos",
      "p_agrupamento",
      "p_saida",
      "p_campos",
    ],
    critica: false,
    resumo:
      "Registra a emissão da carta de convocação (modelo e versão, candidatos, agrupamento, saída SEI/DOCX/PDF e os valores usados). Aprovados editor.",
  },
  listar_cartas_do_candidato: {
    argumentos: ["p_candidato"],
    critica: false,
    resumo:
      "Cartas de convocação emitidas para o candidato (também nas listas anteriores do edital) e a data da convocação.",
  },
  listar_convocacoes_aprovados: {
    argumentos: ["p_area"],
    critica: false,
    resumo:
      "Data da convocação e cartas emitidas por candidato das listas vigentes da área.",
  },
  listar_anexos_candidatos_aprovados: {
    argumentos: [],
    critica: false,
    resumo:
      "Lista os anexos (PDF) dos candidatos vigentes das áreas do usuário, sem o arquivo.",
  },
  baixar_anexo_candidato_aprovado: {
    argumentos: ["p_anexo_id"],
    critica: false,
    resumo: "Devolve um anexo do candidato, com o PDF em base64.",
  },
  registrar_anexo_candidato_aprovado: {
    argumentos: ["p_candidato_id", "p_arquivo_nome", "p_arquivo_base64"],
    critica: false,
    resumo:
      "Grava um PDF (base64) como anexo do candidato, em bytea (até 5, 2 MB cada).",
  },
  remover_anexo_candidato_aprovado: {
    argumentos: ["p_anexo_id"],
    critica: false,
    resumo: "Remove um anexo do candidato, com o arquivo.",
  },
  incluir_sub_judice: {
    argumentos: [
      "p_edital_id",
      "p_cargo",
      "p_nome",
      "p_nota",
      "p_modalidade",
      "p_processo",
      "p_observacao",
    ],
    critica: true,
    resumo:
      "Inclui manualmente um candidato sub judice na lista vigente do edital (modalidade, processo e observação opcionais); entra na classificação pela nota e fica no histórico.",
  },
  remover_sub_judice: {
    argumentos: ["p_candidato_id"],
    critica: true,
    resumo:
      "Remove logicamente um candidato sub judice incluído (não o alterado), fecha a classificação e preserva o histórico.",
  },
  alterar_candidato_sub_judice: {
    argumentos: [
      "p_candidato_id",
      "p_nota",
      "p_modalidade",
      "p_processo",
      "p_observacao",
    ],
    critica: true,
    resumo:
      "Altera nota e/ou modalidade de candidato da lista por decisão judicial (só admin do módulo): guarda o resultado publicado, marca sub judice e refaz a classificação.",
  },
  desfazer_alteracao_sub_judice: {
    argumentos: ["p_candidato_id", "p_observacao"],
    critica: true,
    resumo:
      "Desfaz a alteração judicial (só admin do módulo): volta à nota, modalidade e classificação do resultado publicado.",
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
  listar_municipios_das_vagas_da_area: {
    argumentos: ["p_area"],
    critica: false,
    resumo:
      "Lugares das vagas da área (TB_LOCAL_VAGA_EDITAL, lidos dos PDFs dos editais, + UBS móvel no nome da vaga): chave do lugar, município ou UF, coordenada do banco (TB_COORDENADA_LOCAL_VAGA, nula se ainda não há), projetos e editais de cada um, vagas publicadas e nas análises, candidatos, aprovados e reprovados — mapa da Visão geral de Projetos (migrations 20260929090000, 20261001180000 e 20261002190000).",
  },
  get_analise_detalhe_do_painel: {
    argumentos: ["p_id"],
    critica: false,
    resumo:
      "Detalhamento de uma linha do painel de Análises (parecer, pontuações, experiências, links, datas), ao abrir o registro.",
  },
  get_analises_texto_do_painel: {
    argumentos: ["p_scope", "p_area"],
    critica: false,
    resumo:
      "Parecer, link do PDF e tempo de experiência profissional da área e escopo do painel de Análises, em lote, para o CSV e a busca geral.",
  },

  // ── Status das atualizações (Configurações, 20261001120000_saude_das_cargas.sql) ──
  get_saude_das_cargas: {
    argumentos: [],
    critica: false,
    resumo:
      "Últimas 10 execuções de cada carga (análises por origem, entrevistas, seleção, robô da Empregare com vagas pedidas/baixadas/falhas/recusadas e quem disparou — 20261005170000 —, conferências de consistência com avisos novos/abertos/resolvidos — 20261005210000; análises com encerrada_por_inatividade — 20261007170000; agenda dos robôs pelo banco com chave cadastrada, último pedido aceito, falhas/sem chave em 24 h e os últimos pedidos — 20261008140000) e das tarefas agsus_* do pg_cron, para a seção Status das atualizações (só administrador global). O expurgo dos anexos do chat saiu em 20261014160000 (desligar o chat).",
  },
  // ── Painel dos robôs (Status das atualizações, 20261007190000_painel_dos_robos.sql) ──
  get_painel_dos_robos: {
    argumentos: [],
    critica: false,
    resumo:
      "Rodar com opções e histórico dos robôs: áreas, editais (com status, para a regra de vigente) e as 8 últimas execuções do robô da Empregare (filtro, quem pediu, contagens e, por vaga, situação, candidatos e com link) e da pré-classificação (pedido, quem pediu). Só administrador global.",
  },
  // ── Rodar agora pelo banco (20261008140000_agenda_dos_robos_pelo_banco.sql) ──
  disparar_robo: {
    argumentos: ["p_robo", "p_inputs"],
    critica: false,
    resumo:
      "Rodar agora, Opções e Recalcular: confere quem pede (administrador global; coordenação só na pré-classificação de um edital) e as opções do robô, pede o workflow ao GitHub com a chave do Vault e devolve o id do pedido (TL_DISPARO_ROBO). 28000, 42501, 22023 e 55006 (pedido repetido em 2 min).",
  },
  situacao_do_disparo_robo: {
    argumentos: ["p_disparo"],
    critica: false,
    resumo:
      "Situação de um pedido de disparar_robo (PEDIDO, ACEITO, FALHOU ou SEM_TOKEN, com o código HTTP e a mensagem do GitHub). Só quem pediu ou o administrador global.",
  },
  listar_vagas_dos_robos: {
    argumentos: ["p_editais", "p_vagas"],
    critica: false,
    resumo:
      "Vagas da Empregare conhecidas dos editais (ids) ou dos códigos pedidos (quadro do edital, Seleção e já carregadas): código, edital, cargo, última carga e situação. Sugestões do Rodar com opções; só administrador global.",
  },
  // ── Conferências de consistência (20261005210000_conferencias_de_consistencia.sql) ──
  listar_avisos_conferencia_se_mudou: {
    argumentos: ["p_area", "p_modulo", "p_versao"],
    critica: false,
    resumo:
      "listar_avisos_conferencia com versão (20261015000000): avisos abertos e ignorados das conferências que a pessoa pode ver (módulo, área e recorte do edital; cargas e avisos sem área, só o administrador global), sem campos nulos e sem `exemplos` quando o aviso tem casos; p_versao igual à atual devolve só `inalterado`. Cartão do Status das atualizações e selo de cada tela.",
  },
  listar_casos_aviso_conferencia: {
    argumentos: [
      "p_aviso",
      "p_busca",
      "p_area",
      "p_modulo",
      "p_limite",
      "p_deslocamento",
    ],
    critica: false,
    resumo:
      "Casos de um aviso de conferência, ou de todos os avisos que a pessoa vê (com busca), em páginas de até 1000 (20261007120000; 20261007240000 resolve todos os módulos): tipo e resolução (ok, removido, sem_acesso), código, nome, edital, vaga, situação e datas da análise ou do registro do módulo (aprovado, entrevista, lista, ajuste, vaga), com a permissão daquele módulo; o motivo; as análises do candidato em dois editais e as vagas da pessoa na lista de aprovados. Busca por código, nome ou vaga, sem acento. Referência só quando não é UUID. Sem CPF. Gaveta dos avisos e CSV.",
  },
  ignorar_aviso_conferencia: {
    argumentos: ["p_id", "p_motivo"],
    critica: false,
    resumo:
      "Ignora um aviso de conferência aberto com motivo (10 a 500 caracteres): administrador global ou quem administra o módulo (classificação: editor). Volta a aberto se a quantidade crescer.",
  },
  // ── Entrevistas no sistema (20260930220000_entrevistas_roteiros_e_notas.sql)
  listar_roteiros_entrevista: {
    argumentos: ["p_area"],
    critica: false,
    resumo:
      "Roteiros de entrevista ativos (última versão de cada), da área pedida ou de qualquer área, com competências e níveis.",
  },
  salvar_roteiro_entrevista: {
    argumentos: ["p_dados"],
    critica: false,
    resumo:
      "Cria um roteiro ou a versão seguinte de um roteiro (p_dados.origem; p_dados.aspectos e p_dados.nome_versao — o nome da versão, 3 a 80 — opcionais); os editais que usam a anterior continuam nela. entrevistas >= editor.",
  },
  renomear_versao_roteiro_entrevista: {
    argumentos: ["p_roteiro", "p_nome", "p_motivo"],
    critica: false,
    resumo:
      "Troca só o nome de uma versão do roteiro (p_roteiro = id da versão; p_nome vazio tira; motivo de 10 a 500; histórico em TH_NOME_VERSAO_REGRA); competências e editais não mudam. Devolve o roteiro. entrevistas >= editor e a área do roteiro.",
  },
  obter_entrevistas_do_edital: {
    argumentos: ["p_edital"],
    critica: false,
    resumo:
      "Condução da entrevista de um edital: configuração (roteiro, banca, lançamento), a lista de convocação vigente da Classificação com o retrato (lista_convocacao), a regra vigente da Classificação (convocação, desempate e empate final — 20261008130000), banca (avaliadores[].competencias: as que cada membro avalia, nulo = todas — 20261008170000) e convocados com as notas, a justificativa da banca e as observações dos avaliadores (20261008220000); pode_editar, pode_gerar_lista, admin_global e meu_perfil.",
  },
  configurar_entrevista_edital: {
    argumentos: ["p_edital", "p_dados"],
    critica: false,
    resumo:
      "Grava roteiro, composição da banca, modo de lançamento e membros da banca do edital, com as competências de cada um (avaliadores[].competencias: nulo = todas, lista = só estas; 22023 lista vazia, competência de fora ou banca com competência sem avaliador; 23514 tirar competência de quem já deu nota ou trocar o roteiro com notas); convocação e vagas são as da Classificação. Devolve o payload do edital.",
  },
  convocar_para_entrevista: {
    argumentos: ["p_edital", "p_lista", "p_analises"],
    critica: false,
    resumo:
      "Registra para a ficha de notas convocados da lista de convocação vigente da Classificação (idempotente; PT409 se p_lista não é a vigente; 23514 fora da lista, sem lista ou sem configuração). Devolve {convocados, lista, dados}.",
  },
  desconvocar_da_entrevista: {
    argumentos: ["p_entrevista", "p_motivo"],
    critica: false,
    resumo:
      "Retira um convocado sem notas, com motivo (23514 se já tem notas). Devolve o payload do edital.",
  },
  listar_editais_entrevista: {
    argumentos: ["p_area", "p_todos"],
    critica: false,
    resumo:
      "Editais da área para conduzir entrevistas: na janela do cronograma, liberados pelo administrador global ou com convocado sem parecer; p_todos (administrador global) traz todos. Devolve {admin_global, hoje, editais}.",
  },
  liberar_entrevista_edital: {
    argumentos: ["p_edital", "p_ate", "p_motivo"],
    critica: false,
    resumo:
      "Administrador global: libera o edital fora da janela até p_ate (máx. 180 dias), com motivo; p_ate nulo encerra.",
  },
  obter_quadro_de_vagas: {
    argumentos: ["p_edital"],
    critica: false,
    resumo:
      "Quadro de vagas vigente do edital (Anexo II importado do PDF), de onde veio e a que linha cada vaga da análise se liga.",
  },
  salvar_quadro_de_vagas: {
    argumentos: ["p_edital", "p_dados"],
    critica: false,
    resumo:
      "Substitui o quadro de vagas do edital (o anterior fica desativado). Núcleo ou Calendário (editor). Devolve o quadro.",
  },
  lancar_notas_entrevista: {
    argumentos: ["p_entrevista", "p_dados"],
    critica: false,
    resumo:
      "Lança/corrige notas (roteiro com aspectos: todos os aspectos de cada avaliador), comparecimento, observações dos avaliadores (observacoes, opcional) e a justificativa da banca (justificativa, opcional) de um convocado (22023 fora da escala, aspecto faltando ou texto longo; 23514 avaliador em competência que não é dele ou INAPTO/Faltou sem justificativa; 42501 no modo AVALIADOR para nota ou observação de outro) e recalcula o resultado. Devolve o payload do edital.",
  },

  // ── Recursos dos candidatos (aba Recursos, 20260929120000_recursos.sql) ──
  get_recursos_da_area: {
    argumentos: ["p_area"],
    critica: false,
    resumo:
      "Aba Recursos de uma área (json): recursos com o candidato da análise, o estado da resposta e o nº de anexos, origens, editais e modelos (quem edita) e as etapas do cronograma para o prazo.",
  },
  get_recurso_candidato_detalhe: {
    argumentos: ["p_id"],
    critica: false,
    resumo:
      "Detalhe de um recurso: observação, quem fez cada etapa, o histórico, os anexos, a resposta (com o histórico dela) e o id de quem pede.",
  },
  buscar_candidatos_recurso: {
    argumentos: ["p_edital_id", "p_busca"],
    critica: false,
    resumo:
      "Candidatos das análises curriculares do edital, por nome ou código, para o cadastro de recurso.",
  },
  salvar_recurso_candidato: {
    argumentos: ["p_dados"],
    critica: false,
    resumo:
      "Cadastra ou edita um recurso (revisão, duplicado 23505, histórico).",
  },
  marcar_etapa_recurso: {
    argumentos: ["p_id", "p_etapa", "p_feita"],
    critica: false,
    resumo:
      "Marca ou desmarca uma etapa do recurso (Empregare, SEI, upload, resposta), com quando e quem.",
  },
  excluir_recurso_candidato: {
    argumentos: ["p_id", "p_motivo"],
    critica: false,
    resumo: "Exclusão lógica de um recurso, com motivo no histórico.",
  },

  // ── Recursos: parecer jurídico (20261001170000) ──────────────────────────
  transicionar_recurso_candidato: {
    argumentos: ["p_id", "p_acao", "p_revisao", "p_texto"],
    critica: false,
    resumo:
      "Fluxo do parecer: enviar para parecer (editor); deferir, deferir parcialmente, indeferir (parecer obrigatório), devolver e reabrir só com recursos_parecer (42501).",
  },

  // ── Recursos: ajuste da pontuação (20261005130000) ────────────────────────
  obter_ajustes_pontuacao_recurso: {
    argumentos: ["p_recurso"],
    critica: false,
    resumo:
      "Versões do ajuste da pontuação do recurso (itens antes/depois, justificativa, prévias, quem e quando); pode_propor, pode_aprovar e pode_cancelar. Recursos >= leitor.",
  },
  obter_dados_previa_ajuste: {
    argumentos: ["p_recurso"],
    critica: false,
    resumo:
      "Os dados da Classificação do edital do recurso (mesmo json de obter_classificacao_do_edital, com os ajustes aprovados) para a prévia. Só o parecer jurídico (42501).",
  },
  propor_ajuste_pontuacao: {
    argumentos: ["p_recurso", "p_dados"],
    critica: false,
    resumo:
      "Nova versão PROPOSTO do ajuste (a proposta em aberto vira cancelada): lista, justificativa, itens e prévia. Só o parecer jurídico, recurso em análise jurídica ou deferido.",
  },
  aprovar_ajuste_pontuacao: {
    argumentos: ["p_ajuste", "p_previa"],
    critica: false,
    resumo:
      "Aprova o ajuste proposto (passa a valer na Classificação) com a prévia recalculada; marca ou desmarca 'mudou a classificação'. Só o parecer jurídico e com o recurso deferido.",
  },
  cancelar_ajuste_pontuacao: {
    argumentos: ["p_ajuste", "p_motivo"],
    critica: false,
    resumo:
      "Cancela o ajuste proposto ou aprovado, com motivo (o aprovado sai da Classificação e a marca do recurso é desmarcada). Só o parecer jurídico.",
  },

  // ── Recursos: modelos, resposta e anexos (20260929230000) ────────────────
  listar_modelos_resposta_recurso: {
    argumentos: [],
    critica: false,
    resumo:
      "Modelos de resposta (versão vigente, ativos e arquivados), versões, áreas, origens e marcadores. Só admin de Recursos.",
  },
  salvar_modelo_resposta_recurso: {
    argumentos: ["p_dados"],
    critica: false,
    resumo:
      "Cria um modelo ou grava a versão seguinte (revisão PT409, marcadores conferidos). Só admin de Recursos.",
  },
  arquivar_modelo_resposta_recurso: {
    argumentos: ["p_modelo_id", "p_motivo"],
    critica: false,
    resumo: "Arquiva um modelo de resposta, com motivo. Só admin de Recursos.",
  },
  salvar_resposta_recurso: {
    argumentos: ["p_dados"],
    critica: false,
    resumo:
      "Cria ou grava o rascunho da resposta (modelo + versão, fundamentação, texto final; revisão PT409).",
  },
  transicionar_resposta_recurso: {
    argumentos: ["p_resposta_id", "p_acao", "p_revisao", "p_comentario"],
    critica: false,
    resumo:
      "Enviar para revisão, aprovar, devolver, reabrir ou marcar enviada (marca a etapa do recurso); quem escreveu não aprova depois da revisão.",
  },
  registrar_anexo_recurso: {
    argumentos: [
      "p_recurso_id",
      "p_tipo",
      "p_nome",
      "p_caminho",
      "p_resposta_id",
    ],
    critica: false,
    resumo:
      "Registra o arquivo enviado ao bucket recursos-anexos (caminho, dono, tamanho e tipo lidos do Storage).",
  },
  arquivar_anexo_recurso: {
    argumentos: ["p_anexo_id", "p_motivo"],
    critica: false,
    resumo: "Arquiva um anexo (lógico, com motivo); o arquivo fica no bucket.",
  },
  registrar_download_anexo_recurso: {
    argumentos: ["p_anexo_id"],
    critica: false,
    resumo:
      "Confere o acesso, registra o download e devolve o caminho para a URL assinada (a política do bucket exige o registro).",
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
  // ── Classificação (20261002150000_classificacao.sql) ─────────────────────
  listar_editais_classificacao: {
    argumentos: ["p_area"],
    critica: false,
    resumo:
      "Editais da área para a aba Classificação: candidatos nas análises, versão da regra e a última lista gerada; pode_editar.",
  },
  obter_classificacao_do_edital: {
    argumentos: ["p_edital"],
    critica: false,
    resumo:
      "O que o motor de classificação precisa: regra vigente e versões, catálogo, cronograma, quadro de vagas, análises (sem CPF), entrevistas ligadas por CO_ANALISE_CURRICULAR, listas geradas, desempates e os ajustes da pontuação aprovados em recurso (ajustes, ajustes_mudaram_em).",
  },
  obter_classificacao_do_edital_se_mudou: {
    argumentos: ["p_edital", "p_versao"],
    critica: false,
    resumo:
      "obter_classificacao_do_edital com versão e os candidatos em colunas (candidatos_em_colunas; 114/2026: 850 KB → 235 KB cheio, 66 bytes inalterado; 20261014230000). Mesma permissão.",
  },
  salvar_regra_classificacao: {
    argumentos: [
      "p_edital",
      "p_configuracao",
      "p_versao_atual",
      "p_motivo",
      "p_nome",
    ],
    critica: false,
    resumo:
      "Salva a regra do edital como versão nova (PT409 se a versão aberta não é a vigente; motivo obrigatório da 2ª em diante; p_nome opcional, 3 a 80: o nome da versão). Editor.",
  },
  renomear_versao_regra_classificacao: {
    argumentos: ["p_edital", "p_versao", "p_nome", "p_motivo"],
    critica: false,
    resumo:
      "Troca só o nome de uma versão da regra de classificação (p_nome vazio tira; motivo de 10 a 500; histórico em TH_NOME_VERSAO_REGRA); a configuração não muda. Devolve a regra. Editor.",
  },
  registrar_lista_classificacao: {
    argumentos: ["p_edital", "p_tipo", "p_versao", "p_resultado"],
    critica: false,
    resumo:
      "Registra a lista gerada (retrato, versão da regra, quem, quando) e devolve o hash SHA-256 calculado no banco. Editor.",
  },
  publicar_lista_classificacao: {
    argumentos: ["p_lista"],
    critica: false,
    resumo:
      "Marca a lista gerada como publicada (sem empate pendente). Editor.",
  },
  obter_publicacao_lista_aprovados: {
    argumentos: ["p_edital", "p_com_candidatos"],
    critica: false,
    resumo:
      "Lista de aprovados vigente do edital (origem; com p_com_candidatos, os candidatos para a prévia), último resultado final da Classificação, se há análises e o histórico das publicações. Classificação, Aprovados ou Importação.",
  },
  publicar_lista_aprovados_da_classificacao: {
    argumentos: ["p_lista_classificacao", "p_lista_vigente", "p_vinculos"],
    critica: false,
    resumo:
      "Publica o resultado final da Classificação como a lista de aprovados vigente (a anterior fica no histórico), levando status, sub judice e anexos de quem casou (p_vinculos). PT409 se a lista vigente mudou. Classificação editor.",
  },
  obter_lista_classificacao: {
    argumentos: ["p_lista"],
    critica: false,
    resumo: "Uma lista gerada com o retrato, para exportar de novo. Leitor.",
  },
  registrar_desempate_classificacao: {
    argumentos: ["p_edital", "p_dados"],
    critica: false,
    resumo:
      "Registra o empate final de um grupo: sorteio (semente do servidor ou informada, reprodutível) ou decisão manual com justificativa. Editor.",
  },
  // 20261009130000_hora_de_nascimento_na_classificacao.sql
  salvar_hora_nascimento_candidato: {
    argumentos: ["p_edital", "p_analise", "p_hora"],
    critica: false,
    resumo:
      "Grava, troca ou tira (p_hora vazio = 23:59:59) a hora de nascimento da certidão de um candidato, para o desempate por maior idade entre quem nasceu no mesmo dia (93/2026, 6.11.5 e 6.11.6); histórico em TH_HORA_NASCIMENTO_CANDIDATO. Classificação editor.",
  },
  // ── Agenda das entrevistas (20261005120000_agenda_das_entrevistas.sql) ───
  obter_agenda_entrevista: {
    argumentos: ["p_edital"],
    critica: false,
    resumo:
      "A agenda das entrevistas do edital: regra vigente e versões, horários por convocado (dia, hora de Brasília, banca, origem), bancas e histórico; pode_editar. Entrevistas ou Classificação leitor.",
  },
  salvar_regra_agenda_entrevista: {
    argumentos: ["p_edital", "p_configuracao", "p_versao_atual", "p_motivo"],
    critica: false,
    resumo:
      "Salva a regra da agenda do edital como versão nova (PT409 se a versão aberta não é a vigente; motivo obrigatório da 2ª em diante). Entrevistas ou Classificação editor.",
  },
  salvar_agenda_entrevista: {
    argumentos: ["p_edital", "p_dados"],
    critica: false,
    resumo:
      "Grava a agenda inteira (GERAR, AJUSTAR ou LIMPAR) e o que mudou no histórico; recusa repetido, fora do edital e mesma banca com horário sobreposto. Entrevistas ou Classificação editor.",
  },
  // ── Avaliação documental: pré-classificação e listas (20261006110000_pre_classificacao_e_lote.sql)
  obter_pre_classificacao: {
    argumentos: ["p_edital"],
    critica: false,
    resumo:
      "Pré-classificação gravada pelo job Python: regra, última execução, vagas (quadro, tamanho do lote, linha de corte, avisos), inscritos (código, nome, situação, ART, nota declarada, posição, lote e motivo; sem CPF nem contato) e as listas PROVISORIA/LOTE registradas. Só a coordenação do edital (FC_EXIGIR_COORD_AVALIACAO; os demais 42501, desde 20261016130000).",
  },
  // ── Leitura por versão (20261014230000_avaliacao_leitura_por_versao.sql): chamam a função de
  // sempre e devolvem o payload com `versao` (md5 sem `gerado_em`) e as listas grandes em colunas
  // (`<campo>_em_colunas`), ou só `{ inalterado, versao }` quando p_versao é a atual.
  obter_pre_classificacao_se_mudou: {
    argumentos: ["p_edital", "p_versao"],
    critica: false,
    resumo:
      "obter_pre_classificacao com versão e os inscritos em colunas (candidatos_em_colunas; 114/2026: 4,6 MB → 1,1 MB cheio, 66 bytes inalterado). Mesma permissão.",
  },
  obter_situacao_pre_classificacao: {
    argumentos: ["p_edital"],
    critica: false,
    resumo:
      "Só em_andamento e ultima_execucao da pré-classificação do edital (~0,4 KB): o acompanhamento do Recalcular a cada 15 s, sem reler o pacote. Só a coordenação do edital (FC_EXIGIR_COORD_AVALIACAO; os demais 42501, desde 20261016130000).",
  },
  // ── Avaliação documental: acompanhamento das inscrições (20261009140000_acompanhamento_das_inscricoes.sql)
  obter_acompanhamento_inscricoes: {
    argumentos: ["p_edital"],
    critica: false,
    resumo:
      "Cartão Inscrições da Pré-classificação: cronograma, vagas da Empregare do edital (código e cargo) e os retratos diários dos últimos 60 dias (inscritos, finalizaram o questionário, aptos pela regra, eliminados; só contagens). Leitor da Avaliação documental.",
  },
  registrar_lista_pre_classificacao: {
    argumentos: ["p_edital", "p_tipo", "p_lote"],
    critica: false,
    resumo:
      "Registra a lista PROVISORIA ou LOTE (p_lote = só aquela reposição) em TB_LISTA_CLASSIFICACAO, com o retrato montado no banco a partir da pré-classificação. Coordenação do edital ou Editor na Classificação; exige a regra de classificação.",
  },
  // ── Avaliação documental: lote pela nota declarada e declarada congelada (20261007180000_lote_pela_declarada.sql)
  descongelar_declarada_pre_classificacao: {
    argumentos: ["p_edital", "p_motivo", "p_vaga"],
    critica: false,
    resumo:
      "Descongela a nota declarada dos inscritos do edital (ou da vaga p_vaga): apaga o valor congelado e registra no histórico o valor que era, quem pediu e o motivo (10 a 250 caracteres); o próximo recálculo congela de novo com as respostas de agora. Só a coordenação da avaliação do edital; recusa (55P03) com pré-classificação rodando.",
  },
  // ── Avaliação documental: inclusão no lote por decisão (20261007200000_inclusao_no_lote_por_decisao.sql)
  incluir_no_lote_por_decisao: {
    argumentos: ["p_edital", "p_codigos", "p_motivo", "p_vaga"],
    critica: false,
    resumo:
      'A coordenação inclui no lote, por decisão, candidatos que a regra deixa fora (eliminados ou abaixo do corte), pelos códigos da Empregare (1 a 200; p_vaga opcional), com motivo de 5 a 250 caracteres (ex.: "Critério CORES"): entrada DECISAO, no último lote da vaga, ficha aberta; os recálculos mantêm até a revogação. Recusa quem já está no lote, saiu da Empregare ou já tem decisão; 55P03 com pré-classificação rodando.',
  },
  revogar_decisao_lote: {
    argumentos: ["p_edital", "p_codigos", "p_motivo", "p_vaga"],
    critica: false,
    resumo:
      "A coordenação revoga decisões de lote (exclusão lógica, motivo de 10 a 250 caracteres, histórico): quem entrou por decisão volta à situação da regra e a ficha não concluída fica fora do lote. Recusa sem decisão vigente ou com a ficha concluída; 55P03 com pré-classificação rodando.",
  },
  // ── Avaliação documental: fila, distribuição e reserva (20261006120000_fichas_fila_e_reserva.sql)
  obter_fila_avaliacao: {
    argumentos: ["p_edital"],
    critica: false,
    resumo:
      "A fila do edital (schema_version 2, 20261014180000_fila_leve.sql): os inscritos do núcleo (no lote ou com ficha viva) com a ficha (situação, responsável, reserva vigente, versão, rascunho e, concluída, resultado e nota; nome sem CPF nem contato), as contagens e a versão dos de fora do lote (fora_do_lote; as linhas vêm de obter_fila_fora_do_lote), as vagas, os analistas com as pendentes, a distribuição da regra, quantos do lote estão sem ficha e os filtros salvos de quem chama. O analista vê só as vagas dele. Leitor da Avaliação documental.",
  },
  obter_fila_avaliacao_desde: {
    argumentos: ["p_edital", "p_desde", "p_marca"],
    critica: false,
    resumo:
      "obter_fila_avaliacao só com o que mudou (20261014231000_fila_e_ficha_so_o_que_mudou.sql): sem p_desde (ou outra marca), a fila inteira com marca e parcial false; com o gerado_em e a marca da leitura anterior, só as linhas do núcleo cuja ficha mudou (ou cuja reserva vence) desde p_desde − 2 min, saiu, total_nucleo e o resto sem vagas (~1,5 KB). Desde 20261019150000_fila_parcial_sem_montar_tudo.sql a parcial não monta a fila inteira: só as linhas desses inscritos (FC_LINHAS_DA_FILA com p_candidatos) e o total do núcleo por contagem; mesmo contrato. Mesma permissão.",
  },
  obter_fila_fora_do_lote: {
    argumentos: ["p_edital", "p_apos", "p_limite"],
    critica: false,
    resumo:
      "Os inscritos de fora do lote na fila (eliminados e ranqueados sem ficha viva), no formato de obter_fila_avaliacao, em páginas de até 2.000 pela chave do inscrito (p_apos = o proximo da página anterior). Pedida só pelas abas Inscritos e Eliminados e por Incluir por decisão. 20261014180000_fila_leve.sql.",
  },
  obter_espelhos_de_nota: {
    argumentos: [
      "p_edital",
      "p_vagas",
      "p_filtro",
      "p_codigos",
      "p_apos",
      "p_limite",
      "p_regras",
    ],
    critica: false,
    resumo:
      "Espelhos de nota em massa (20261015180000): das fichas concluídas do edital, só o que a montagem do espelho individual usa (~1 KB por ficha: nome, código, vaga, cargo, modalidade, ART, resultado, nota final, declarada gravada, lançamento sem empregador nem nome de curso, chave da regra) e as regras ainda não lidas (p_regras). Páginas de até 200 pela chave da ficha (p_apos = proximo). Filtro por vagas e TODOS/APTOS/INAPTOS, ou p_codigos (até 5.000; nao_concluidos na primeira página). Só administrador e coordenação do edital. Não grava nada.",
  },
  obter_modelo_espelho_nota: {
    argumentos: ["p_edital"],
    critica: false,
    resumo:
      "Modelo do espelho de nota do edital (20261019120000): versao (0 = nunca salvo), textos (só o que difere do padrão do código; {} = padrão), atualizado_em, atualizado_por e pode_editar. Para todos da avaliação documental do edital (o espelho da ficha usa o modelo); sem a RPC, a tela usa o padrão. Não grava nada.",
  },
  salvar_modelo_espelho_nota: {
    argumentos: ["p_edital", "p_textos", "p_versao_atual"],
    critica: false,
    resumo:
      "Salva os textos do modelo do espelho de nota do edital (20261019120000): só as diferenças do padrão ({} = Restaurar padrão), validadas como em validarModeloDoEspelho (22023), com a versão que a tela abriu (outra = PT409). Só a coordenação do edital (42501). Grava a versão nova e o histórico (TH_MODELO_ESPELHO_NOTA).",
  },
  pegar_proxima_ficha: {
    argumentos: ["p_edital", "p_vaga"],
    critica: false,
    resumo:
      "Pegar próximo: a próxima ficha na ordem da Provisória (as suas primeiro; depois a primeira livre, quando a regra deixa), reservada por 15 minutos; duas pessoas nunca recebem a mesma. Analista do edital.",
  },
  reservar_ficha: {
    argumentos: ["p_ficha"],
    critica: false,
    resumo:
      "Abre a ficha: reserva por 15 minutos para o responsável (ou analista que pega uma livre) ou devolve só para leitura com o motivo (Em uso por … desde …). Registra o acesso.",
  },
  renovar_reserva: {
    argumentos: ["p_ficha"],
    critica: false,
    resumo:
      "Renova a reserva de quem está com a ficha aberta (sem mudar a versão); PT409 quando a ficha já não está com a pessoa.",
  },
  liberar_reserva: {
    argumentos: ["p_edital", "p_fichas", "p_motivo"],
    critica: false,
    resumo:
      "Libera reservas: a própria, sem motivo; a de outra pessoa, só a coordenação e com motivo de 10 a 2.000.",
  },
  distribuir_fichas: {
    argumentos: ["p_edital", "p_atribuicoes", "p_motivo"],
    critica: false,
    resumo:
      "Distribuição inicial, redistribuição (motivo) e devolução à fila (motivo) pela coordenação: [{ficha, versao, usuario}], com controle otimista (PT409), sem mexer em ficha concluída ou fora do lote.",
  },
  mandar_fichas_revisao: {
    argumentos: ["p_edital", "p_fichas", "p_motivo"],
    critica: false,
    resumo:
      "A coordenação manda fichas pendentes ou em análise para revisão, com motivo; [{ficha, versao}] com controle otimista.",
  },
  abrir_fichas_do_edital: {
    argumentos: ["p_edital"],
    critica: false,
    resumo:
      "A coordenação abre as fichas do lote que faltam (o job já faz no fim da pré-classificação), marca fora do lote quem saiu e devolve quem voltou.",
  },
  salvar_filtro_fila: {
    argumentos: ["p_nome", "p_filtro"],
    critica: false,
    resumo:
      "Salva (ou troca, pelo nome) um filtro da fila de quem chama; até 30. Devolve os filtros salvos.",
  },
  excluir_filtro_fila: {
    argumentos: ["p_filtro"],
    critica: false,
    resumo:
      "Exclui (desativa) um filtro salvo de quem chama. Devolve os filtros salvos.",
  },
  // ── Avaliação documental: conteúdo da ficha (20261007130000_conteudo_da_ficha.sql)
  obter_ficha_analise: {
    argumentos: ["p_ficha"],
    critica: false,
    resumo:
      "A ficha para analisar: cabeçalho, lançamento e resultado gravados, a regra com que é analisada (a vigente; a da conclusão, se concluída), nota mínima e níveis da regra de classificação, nota declarada e ART, as respostas da Empregare só das perguntas que a regra liga, os links da Empregare capturados pelo robô (candidato e candidaturas da vaga — 20261007160000; as respostas e os anexos do questionário (Visualizar Arquivo por pergunta e impressão) — 20261008160000 — só da resposta vigente, a mais nova com pergunta lida, e os envios anteriores com os arquivos de cada um — 20261009210000; dado restrito), as sugestões de títulos, cursos e vínculos tiradas das respostas pelo job Python (20261009190000), as leituras dos anexos da resposta vigente feitas pelo robô (cursos, títulos, vínculos, alertas, nome/CPF só como confere — 20261009220000), o CPF que o candidato informou no questionário (cpf_informado, para a identificação no cabeçalho — 20261015050000), o histórico e se pode editar ou reabrir. Coordenação, revisão, analista da vaga; leitor só a concluída.",
  },
  obter_ficha_analise_leve: {
    argumentos: ["p_ficha", "p_regra_chave"],
    critica: false,
    resumo:
      "obter_ficha_analise com regra.chave (md5 da configuração); com p_regra_chave igual, regra.configuracao vem null e regra_omitida true — a tela usa a que guardou (~29 KB a menos por ficha; 20261014231000). Mesma permissão.",
  },
  salvar_rascunho_ficha: {
    argumentos: [
      "p_ficha",
      "p_versao",
      "p_lancamento",
      "p_resultado",
      "p_parecer",
    ],
    critica: false,
    resumo:
      "Salvamento automático da ficha: lançamento (com a vaga e o cargo da ficha), resultado da conta da tela e parecer, revalidados contra a regra da vaga, com as diferenças por cargo (estrutura, limites, coerência); exige a reserva (55P03) e a versão aberta (PT409); renova a reserva; alteração vai ao histórico.",
  },
  concluir_ficha: {
    argumentos: [
      "p_ficha",
      "p_versao",
      "p_versao_regra",
      "p_lancamento",
      "p_resultado",
      "p_parecer",
    ],
    critica: false,
    resumo:
      "Conclui a ficha: confere reserva, versões (ficha e regra vigente conferida), estrutura e o que falta pela regra da vaga (situação, motivos, requisitos e extras do cargo, itens, justificativa de nota diferente da declarada); grava resultado, notas, parecer e a versão da regra; libera a reserva.",
  },
  reabrir_ficha: {
    argumentos: ["p_ficha", "p_versao", "p_motivo"],
    critica: false,
    resumo:
      "A coordenação reabre uma ficha concluída (volta a Em análise com o mesmo responsável), com motivo de 10 a 2.000.",
  },
  // ── Reiniciar as fichas do edital (20261009160000_reiniciar_fichas_do_edital.sql)
  reiniciar_fichas_do_edital: {
    argumentos: ["p_edital", "p_motivo"],
    critica: false,
    resumo:
      "Só admin global (42501): volta ao início as fichas do lote do edital (PENDENTE, sem responsável, reserva nem conteúdo; versão + 1), com motivo de 10 a 2.000 e histórico REINICIAR por ficha; FORA_LOTE fica; nada se apaga.",
  },
  registrar_acesso_ficha: {
    argumentos: ["p_ficha", "p_tipo"],
    critica: false,
    resumo:
      "Registra (LGPD) que quem vê a ficha abriu o candidato na Empregare (ABRIR_EMPREGARE) ou copiou o código (COPIAR_CODIGO).",
  },
  // ── Dono da avaliação do edital (20261009200000_fichas_no_painel_das_analises.sql)
  definir_origem_analise: {
    argumentos: ["p_edital", "p_origem", "p_motivo"],
    critica: false,
    resumo:
      "A coordenação da avaliação do edital (ou o admin global; 42501) troca o dono: MONITORA (as fichas alimentam TB_ANALISE_CURRICULAR, o Painel das análises e a Classificação; a planilha deixa de mexer no edital; recusa 23514 se a planilha já decidiu análises) ou PLANILHA. Motivo de 10 a 2.000 e histórico. Devolve { origem, anterior, mudou, publicadas, devolvidas }.",
  },
  // ── Avaliação documental: regra e equipe (20261006100000_regra_da_analise.sql)
  listar_editais_avaliacao: {
    argumentos: ["p_area"],
    critica: false,
    resumo:
      "Editais da área para a Avaliação documental: versão e situação da regra, dono da avaliação, o papel de quem está logado e fichas {concluidas, pendentes, em_analise, minhas_em_analise} das fichas do lote (20261016130000). avaliacao_documental >= leitor, área e coordenação.",
  },
  obter_regra_analise: {
    argumentos: ["p_edital"],
    critica: false,
    resumo:
      "Regra da avaliação do edital (vigente e versões), modelos, nota mínima da regra de classificação, aldeias do DSEI e quantas vagas da Empregare têm carga. As perguntas da carga saíram para obter_perguntas_carga_analise (20261009180000). Leitor; quem não coordena recebe a resposta enxuta (regra só com versao, nome, situacao e versoes {versao, nome}; modelos vazio; aldeias nulo; 20261016130000).",
  },
  obter_regra_analise_se_mudou: {
    argumentos: ["p_edital", "p_versao"],
    critica: false,
    resumo:
      "obter_regra_analise com versão (FC_SE_MUDOU; 20261014230000): a tela revalida a regra guardada (~0,5 MB com as versões) recebendo só { inalterado } quando nada mudou. Mesma permissão.",
  },
  // ── Perguntas da carga da Empregare (20261009180000_resumo_das_perguntas_da_carga.sql)
  obter_perguntas_carga_analise: {
    argumentos: ["p_edital"],
    critica: false,
    resumo:
      "Perguntas e respostas da última carga da Empregare do edital, do instantâneo TB_RESUMO_PERGUNTA_EDITAL (calculado em Python pelo robô da Empregare ao fim de cada carga): só respostas que aparecem 2+ vezes, até 30 por pergunta; as únicas viram 'outras'. Só a coordenação (os demais recebem lista vazia). Leitor.",
  },
  salvar_regra_analise: {
    argumentos: [
      "p_edital",
      "p_configuracao",
      "p_versao_atual",
      "p_motivo",
      "p_nome",
    ],
    critica: false,
    resumo:
      "Salva a regra como versão nova (PT409 se a versão aberta não é a vigente; motivo de 10 a 2.000 da 2ª em diante) e volta para Conferir; devolve as fichas concluídas com versão anterior (nenhuma nota muda). p_nome (opcional, 3 a 80): o nome da versão (20261008180000). Só a coordenação do edital.",
  },
  obter_rascunho_regra: {
    argumentos: ["p_tipo", "p_edital"],
    critica: false,
    resumo:
      "O rascunho não salvo de quem chama para a regra do tipo (ANALISE ou CLASSIFICACAO) no edital: conteudo, versao_base, criado_em e atualizado_em; null sem rascunho (20261013120000). Só quem edita a regra.",
  },
  salvar_rascunho_regra: {
    argumentos: ["p_tipo", "p_edital", "p_conteudo", "p_versao_base"],
    critica: false,
    resumo:
      "Guarda (ou troca) o rascunho não salvo da regra do tipo no edital, de quem chama (objeto json de até 1 MB e a versão vigente de onde partiu); devolve atualizado_em. Uma linha por tipo + edital + pessoa em TB_RASCUNHO_REGRA. Só quem edita a regra.",
  },
  descartar_rascunho_regra: {
    argumentos: ["p_tipo", "p_edital"],
    critica: false,
    resumo:
      "Apaga o rascunho não salvo de quem chama para a regra do tipo no edital (versão nova salva ou Descartar); devolve { descartado }. Só o próprio rascunho.",
  },
  renomear_versao_regra_analise: {
    argumentos: ["p_edital", "p_versao", "p_nome", "p_motivo"],
    critica: false,
    resumo:
      "Troca só o nome de uma versão da regra (p_nome vazio tira; motivo de 10 a 500; histórico em TH_NOME_VERSAO_REGRA); configuração, hash e situação não mudam. Devolve { regra }. Só a coordenação do edital (e o administrador global).",
  },
  copiar_modelo_regra_analise: {
    argumentos: ["p_edital", "p_modelo"],
    critica: false,
    resumo:
      "Cria a versão 1 da regra copiando um modelo (Conferir); edital com regra = 23505. Só a coordenação do edital.",
  },
  conferir_regra_analise: {
    argumentos: ["p_edital", "p_versao"],
    critica: false,
    resumo:
      "Marca a versão vigente da regra como conferida (PT409 se não é a vigente). Dupla conferência: quem salvou a versão não confere (42501), salvo o administrador global. Só a coordenação do edital.",
  },
  obter_apoio_regra_analise: {
    argumentos: ["p_edital"],
    critica: false,
    resumo:
      "O que o assistente da regra lê: os nomes das colunas de pergunta da última carga de cada vaga (sem respostas) com o cargo da vaga, os cargos do quadro de vagas (diferenças por cargo), as regras conferidas dos outros editais da área (só a coordenação) e a regra de classificação vigente com pode_editar. Só a coordenação do edital (FC_EXIGIR_COORD_AVALIACAO; os demais 42501, desde 20261016130000).",
  },
  obter_equipe_edital: {
    argumentos: ["p_edital"],
    critica: false,
    resumo:
      "Equipe da avaliação do edital: gestores (coordenação automática), analistas, revisores e coordenação, vagas e, só para a coordenação, e-mails e pessoas que podem entrar. Só a coordenação do edital (FC_EXIGIR_COORD_AVALIACAO; os demais 42501, desde 20261016130000).",
  },
  salvar_equipe_edital: {
    argumentos: ["p_edital", "p_equipe", "p_motivo"],
    critica: false,
    resumo:
      "Grava a equipe inteira: quem sai é desativado (motivo obrigatório), quem entra precisa de Editor (analista, revisor) ou Administrador (coordenador) e ver o edital; 42501 diz a permissão que falta. Só a coordenação do edital.",
  },
  salvar_aldeias_dsei: {
    argumentos: ["p_unidade", "p_aldeias", "p_fonte"],
    critica: false,
    resumo:
      "Carrega a lista oficial de aldeias de um DSEI (a enviada vira a vigente; as que saem são desativadas). Só o administrador global.",
  },
  registrar_presenca_monitora: {
    argumentos: ["p_current_view"],
    critica: false,
    resumo:
      "Marca presença online do usuário (a cada 90 s com a aba visível) e devolve { status, versao_do_catalogo } (20261019160000): a versão do catálogo de abas e da situação do sistema, para a tela reler o menu e fechar a página desligada só quando ela muda (src/app/vigia-do-catalogo.ts). Sem a versão, nada é relido no meio da sessão.",
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
