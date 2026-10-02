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
      "Corrige a coordenada de um ponto existente e/ou o marca como conferido (p_conferido), com histórico privado. Só administrador global.",
  },
  desfazer_coordenada_mapa_saude_indigena: {
    argumentos: ["p_historico", "p_motivo"],
    critica: false,
    resumo:
      "Volta a última alteração de um ponto do mapa como alteração nova, com motivo. Só administrador global.",
  },
  listar_historico_coordenada_mapa_saude_indigena: {
    argumentos: ["p_alvo", "p_limite"],
    critica: false,
    resumo:
      "Últimas alterações de um ponto do mapa (quem, quando, de/para, motivo). Só administrador global.",
  },
  listar_pendencias_coordenada_mapa_saude_indigena: {
    argumentos: [],
    critica: false,
    resumo:
      "Pontos do mapa ainda não conferidos depois da auditoria, com candidatos. Só administrador global.",
  },
  // ── Configurações › Acessos (admin global ou coordenador, com teto) ──────
  obter_matriz_acessos: {
    argumentos: ["p_busca", "p_offset", "p_coordenacao", "p_grupo"],
    critica: true,
    resumo:
      "Pessoas paginadas (célula: do grupo ou individual), grupos, coordenações, teto de quem pede e histórico.",
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
      "Aba Desativadas de Acessos (admin global): quando, por quem, motivo, grupo/áreas de antes e pedido pendente.",
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
  listar_acompanhamento_da_visao_geral: {
    argumentos: ["p_area"],
    critica: false,
    resumo:
      "Visão geral de uma área: etapas do cronograma e, por edital com lista vigente, aprovados, com status, contratados e desistentes (crítico parado, Próximos 7 dias e Pós-resultado; migration 20261002131000). Sem ela, a tela usa só as linhas.",
  },
  get_monitoramento_dashboard_payload: {
    argumentos: [],
    critica: false,
    resumo:
      "Payload consolidado da Saúde Indígena; sem ele a tela volta ao carregamento legado.",
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
      "Lista as listas vigentes de aprovados vinculadas aos editais, com nome e e-mail de quem importou.",
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
      "Altera o status de um candidato e registra processo SEI e matrícula quando informados. Status já definido só o admin altera.",
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
      "Lugares das vagas da área (TB_LOCAL_VAGA_EDITAL, lidos dos PDFs dos editais, + UBS móvel no nome da vaga): município ou UF, projetos e editais de cada um, vagas publicadas e nas análises, candidatos, aprovados e reprovados — mapa da Visão geral de Projetos (migrations 20260929090000 e 20261001180000).",
  },
  get_analises_dashboard_payload_v2: {
    argumentos: ["p_scope", "p_area"],
    critica: true,
    resumo:
      "Lista enxuta (schema_version 4) do painel de Análises da área (Saúde Indígena, SEDE ou Projetos), por escopo: ativo, inativo ou desativadas ('Todos' = os três juntos no navegador). Vem do cache do servidor (`TA_PAINEL_ANALISE`, `cache.hit`), exceto para quem tem recorte por coordenação (migration 20260929150000).",
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

  // ── Entrevistas (aba Entrevistas, 20260929235000_entrevistas.sql) ──────
  get_entrevistas_da_area: {
    argumentos: ["p_area"],
    critica: false,
    resumo:
      "Aba Entrevistas de uma área (json, só leitura): entrevistas com as notas por critério, a análise ligada, a última carga da planilha e os aprovados na análise sem entrevista.",
  },
  // ── Seleção (aba Seleção, 20261001090000_selecao.sql) ──────────────────
  // ── Status das atualizações (Configurações, 20261001120000_saude_das_cargas.sql) ──
  get_saude_das_cargas: {
    argumentos: [],
    critica: false,
    resumo:
      "Últimas 10 execuções de cada carga (análises por origem, entrevistas, seleção) e das tarefas agsus_* do pg_cron, para a seção Status das atualizações (só administrador global).",
  },
  get_selecao_da_area: {
    argumentos: ["p_area"],
    critica: false,
    resumo:
      "Aba Seleção de uma área (json, só leitura): o funil de cada vaga da planilha Auditoria, os convocados (entrevistas do MONITORA ou a planilha) e aprovados/contratados da lista vigente.",
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
      "Cria um roteiro ou a versão seguinte de um roteiro (p_dados.origem); os editais que usam a anterior continuam nela. entrevistas >= editor.",
  },
  obter_entrevistas_do_edital: {
    argumentos: ["p_edital"],
    critica: false,
    resumo:
      "Condução da entrevista de um edital: configuração, vagas com vagas imediatas, aprovados na análise (posição por vaga), banca e convocados com as notas; pode_editar, admin_global e meu_perfil.",
  },
  configurar_entrevista_edital: {
    argumentos: ["p_edital", "p_dados"],
    critica: false,
    resumo:
      "Grava roteiro, convocação, banca, modo de lançamento, vagas imediatas e membros da banca do edital (23514 se trocar o roteiro com notas). Devolve o payload do edital.",
  },
  convocar_para_entrevista: {
    argumentos: ["p_edital", "p_analises"],
    critica: false,
    resumo:
      "Convoca aprovados da análise do edital para a entrevista (idempotente; 23514 sem configuração). Devolve {convocados, dados}.",
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
      "Lança/corrige notas e comparecimento de um convocado (22023 fora da escala; 42501 no modo AVALIADOR para nota de outro) e recalcula o resultado. Devolve o payload do edital.",
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
      "Cria um modelo ou grava a versão seguinte (revisão 40001, marcadores conferidos). Só admin de Recursos.",
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
      "Cria ou grava o rascunho da resposta (modelo + versão, fundamentação, texto final; revisão 40001).",
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
      "O que o motor de classificação precisa: regra vigente e versões, catálogo, cronograma, quadro de vagas, análises (sem CPF), entrevistas ligadas por CO_ANALISE_CURRICULAR, listas geradas e desempates.",
  },
  salvar_regra_classificacao: {
    argumentos: ["p_edital", "p_configuracao", "p_versao_atual", "p_motivo"],
    critica: false,
    resumo:
      "Salva a regra do edital como versão nova (40001 se a versão aberta não é a vigente; motivo obrigatório da 2ª em diante). Editor.",
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
