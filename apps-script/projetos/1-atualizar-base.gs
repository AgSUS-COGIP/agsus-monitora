// Atualizado: aliases e contrato da FATO adequados ao Edital 30/2026 - Projeto Agora Tem Especialistas Caminhoneiros.
const CFG = {
  ABA_DIM_EDITAIS: 'DIM_EDITAIS',
  ABA_DIM_VAGAS: 'DIM_VAGAS',
  ABA_DIM_RESPONSAVEIS: 'DIM_RESPONSAVEIS',
  ABA_FATO: 'FATO_ANALISES',
  ABA_FATO_STAGING: 'FATO_ANALISES_STG',
  ABA_LOG: 'LOG_CONSOLIDACAO',
  ABA_META_PAINEL: 'META_PAINEL',
  ABA_PRE_VALIDACAO: 'REL_PRE_VALIDACAO',
  ABA_AUDITORIA_FATO: 'REL_AUDITORIA_FATO',
  ABA_ORIGEM_PADRAO: 'APTOS PARA ANÁLISE',

  DIM_EDITAIS_HEADERS: [
    'grupo',
    'unidade',
    'edital',
    'pasta_origem_link',
    'ativo',
    'data_inicio_analise',
    'data_fim_analise',
    'observacao'
  ],

  DIM_VAGAS_HEADERS: [
    'grupo',
    'unidade',
    'edital',
    'codigo_vaga',
    'nome_vaga',
    'regime',
    'carga_horaria',
    'categoria',
    'planilha_origem_id',
    'link_planilha_origem',
    'nome_arquivo_origem',
    'ultima_sincronizacao_vaga'
  ],

  DIM_RESP_HEADERS: [
    'grupo',
    'unidade',
    'edital',
    'codigo_vaga',
    'responsavel_analise',
    'coord_demandante',
    'email_demandante'
  ],

  FATO_HEADERS: [
    'grupo',
    'unidade',
    'edital',
    'codigo_vaga',
    'nome_vaga',
    'regime',
    'carga_horaria',
    'categoria',
    'candidato',
    'id',
    'data_nascimento',
    'idade',
    'nota_empregare',
    'modalidade_concorrencia',
    'nota_final_ajustada',
    'somatorio',
    'pontuacao_escolaridade',
    'pontuacao_cursos_aperfeicoamento',
    'pontuacao_experiencia_profissional',
    'pontuacao_criterio_etnico',
    'experiencia_profissional_anos',
    'experiencia_profissional_meses',
    'experiencia_profissional_dias',
    'experiencia_profissional_total',
    'experiencia_saude_indigena_anos',
    'experiencia_saude_indigena_meses',
    'experiencia_saude_indigena_dias',
    'experiencia_saude_indigena_total',
    'experiencia_atencao_basica_anos',
    'experiencia_atencao_basica_meses',
    'experiencia_atencao_basica_dias',
    'experiencia_atencao_basica_total',
    'etapa',
    'data_analise',
    'analise',
    'pcd',
    'responsavel_analise',
    'coord_demandante',
    'email_demandante',
    'status_consolidado',
    'origem_planilha',
    'origem_arquivo_id',
    'ultima_atualizacao',
    'pdf_gerado',
    'link_pdf',
    'data_geracao_pdf',
    'erro_pdf',
    'pdf_status',
    'pdf_file_id',
    'pdf_ultima_tentativa',
    'pdf_hash_origem'
  ],

  LOG_HEADERS: [
    'data_hora',
    'tipo',
    'edital',
    'codigo_vaga',
    'arquivo',
    'mensagem'
  ],

  META_PAINEL_HEADERS: [
    'chave',
    'valor',
    'ultima_atualizacao'
  ],

  PRE_VALIDACAO_HEADERS: [
    'data_hora',
    'tipo',
    'grupo',
    'unidade',
    'edital',
    'codigo_vaga',
    'origem',
    'mensagem',
    'acao_recomendada'
  ],

  AUDITORIA_FATO_HEADERS: [
    'grupo',
    'unidade',
    'edital',
    'codigo_vaga',
    'nome_vaga',
    'total_registros',
    'pendente',
    'revisar',
    'aprovado',
    'reprovado',
    'sem_data_analise',
    'ultima_atualizacao_max'
  ],

  ABA_CTRL_SYNC: 'CTRL_SYNC_ORIGENS',
  CTRL_SYNC_HEADERS: [
    'grupo',
    'unidade',
    'edital',
    'codigo_vaga',
    'planilha_origem_id',
    'nome_arquivo_origem',
    'drive_ultima_atualizacao',
    'assinatura_contexto',
    'ultima_sincronizacao',
    'qtd_registros',
    'status_sync',
    'mensagem'
  ],

  MIME_GOOGLE_SHEETS: 'application/vnd.google-apps.spreadsheet',
  ACTIVE_VALUES: ['sim', 's', 'ativo', '1', 'true', 'x'],
  HEADER_SCAN_LIMIT: 10,
  REGIMES_VALIDOS: ['presencial', 'teletrabalho', 'hibrido', 'híbrido'],
  MAX_RUNTIME_SYNC_MS: 2.5 * 60 * 1000,
  WRITE_CHUNK_ROWS: 400,
  READ_CHUNK_ROWS: 800,
  RECLASS_STATUS_CHUNK_ROWS: 1200,
  RECLASS_STATUS_MAX_RUNTIME_MS: 2 * 60 * 1000,
  REPAIR_SCORE_CHUNK_ROWS: 1200,
  REPAIR_SCORE_MAX_RUNTIME_MS: 2 * 60 * 1000,
  MAX_AUTO_FILTER_ROWS: 5000,
  SYNC_TRIGGER_DELAY_MS: 60 * 1000,
  SYNC_STALE_TIMEOUT_MS: 30 * 60 * 1000,
  MAIN_SYNC_TRIGGER_EVERY_MINUTES: 20,
  MAIN_SYNC_TRIGGER_CHECK_EVERY_MINUTES: 5,
  MAIN_SYNC_TRIGGER_HANDLER: 'atualizarDimVagasESincronizarAgendado',
  CONTINUATION_SYNC_TRIGGER_HANDLER: 'processarLoteSincronizacaoAnalises_',
  RECLASS_STATUS_TRIGGER_HANDLER: 'continuarRecalculoStatusFato_',
  REPAIR_SCORE_TRIGGER_HANDLER: 'continuarRecalculoNotasPontuacoesFato_',
  PROP_SYNC_ACTIVE: 'MFC_SYNC_ACTIVE',
  PROP_SYNC_TOTAL_PENDING: 'MFC_SYNC_TOTAL_PENDING',
  PROP_SYNC_PROCESSED_SOURCES: 'MFC_SYNC_PROCESSED_SOURCES',
  PROP_SYNC_UPDATED_RECORDS: 'MFC_SYNC_UPDATED_RECORDS',
  PROP_SYNC_MODE: 'MFC_SYNC_MODE',
  PROP_SYNC_STARTED_AT: 'MFC_SYNC_STARTED_AT',
  PROP_SYNC_LAST_HEARTBEAT_AT: 'MFC_SYNC_LAST_HEARTBEAT_AT',
  PROP_RECLASS_STATUS_ACTIVE: 'MFC_RECLASS_STATUS_ACTIVE',
  PROP_RECLASS_STATUS_NEXT_ROW: 'MFC_RECLASS_STATUS_NEXT_ROW',
  PROP_RECLASS_STATUS_TOTAL_ROWS: 'MFC_RECLASS_STATUS_TOTAL_ROWS',
  PROP_REPAIR_SCORE_ACTIVE: 'MFC_REPAIR_SCORE_ACTIVE',
  PROP_REPAIR_SCORE_NEXT_ROW: 'MFC_REPAIR_SCORE_NEXT_ROW',
  PROP_REPAIR_SCORE_TOTAL_ROWS: 'MFC_REPAIR_SCORE_TOTAL_ROWS',
  PROP_LAST_MAIN_SCHEDULED_RUN_AT: 'MFC_LAST_MAIN_SCHEDULED_RUN_AT'
};

const FATO_SCORE_HEADERS = [
  'nota_empregare',
  'nota_final_ajustada',
  'somatorio',
  'pontuacao_escolaridade',
  'pontuacao_cursos_aperfeicoamento',
  'pontuacao_experiencia_profissional',
  'pontuacao_criterio_etnico'
];

const FATO_INTEGER_HEADERS = [
  'idade',
  'experiencia_profissional_anos',
  'experiencia_profissional_meses',
  'experiencia_profissional_dias',
  'experiencia_profissional_total',
  'experiencia_saude_indigena_anos',
  'experiencia_saude_indigena_meses',
  'experiencia_saude_indigena_dias',
  'experiencia_saude_indigena_total',
  'experiencia_atencao_basica_anos',
  'experiencia_atencao_basica_meses',
  'experiencia_atencao_basica_dias',
  'experiencia_atencao_basica_total'
];

const SOURCE_SCORE_ALIAS_KEYS = [
  'notaEmpregare',
  'notaFinalAjustada',
  'somatorio',
  'pontuacaoEscolaridade',
  'pontuacaoCursosAperfeicoamento',
  'pontuacaoExperienciaProfissional',
  'pontuacaoCriterioEtnico'
];

const SOURCE_INTEGER_ALIAS_KEYS = [
  'idade',
  'experienciaProfissionalAnos',
  'experienciaProfissionalMeses',
  'experienciaProfissionalDias',
  'experienciaProfissionalTotal',
  'experienciaSaudeIndigenaAnos',
  'experienciaSaudeIndigenaMeses',
  'experienciaSaudeIndigenaDias',
  'experienciaSaudeIndigenaTotal',
  'experienciaAtencaoBasicaAnos',
  'experienciaAtencaoBasicaMeses',
  'experienciaAtencaoBasicaDias',
  'experienciaAtencaoBasicaTotal'
];

const SOURCE_DATE_ALIAS_KEYS = [
  'dataNascimento',
  'dataAnalise'
];

const SOURCE_TEXT_ALIAS_KEYS = [
  'candidato',
  'id',
  'modalidadeConcorrencia',
  'etnia',
  'etapa',
  'analise',
  'pcd',
  'responsavelAnalise',
  'coordDemandante',
  'emailDemandante'
];

const SOURCE_CONTEXTUAL_ALIAS_ORDER = SOURCE_SCORE_ALIAS_KEYS
  .concat(SOURCE_INTEGER_ALIAS_KEYS)
  .concat(SOURCE_DATE_ALIAS_KEYS)
  .concat(SOURCE_TEXT_ALIAS_KEYS);

const SOURCE_HEADER_ALIASES = {
  candidato: ['nome', 'candidato'],
  id: ['codigo', 'código', 'id'],

  idade: ['idade'],
  dataNascimento: ['data de nascimento', 'data nascimento', 'nascimento'],

  notaEmpregare: ['nota empregare', 'nota empregare final', 'nota'],
  modalidadeConcorrencia: [
    'modalidade_concorrencia',
    'modalidade concorrencia',
    'modalidade concorrência',
    'modalidade de concorrencia',
    'modalidade de concorrência',
    'categoria de concorrencia',
    'categoria de concorrência',
    'etnia'
  ],
  etnia: [
    'modalidade_concorrencia',
    'modalidade concorrencia',
    'modalidade concorrência',
    'modalidade de concorrencia',
    'modalidade de concorrência',
    'categoria de concorrencia',
    'categoria de concorrência',
    'etnia'
  ],
  notaFinalAjustada: [
    'nota final ajustada',
    'nota final',
    'pontuacao final',
    'pontuação final'
  ],

  somatorio: ['somatorio', 'somatório'],
  pontuacaoEscolaridade: [
    'pontuacao_escolaridade',
    'pontuacao escolaridade',
    'pontuação escolaridade',
    'nota especializacao',
    'nota especialização',
    'nota de especializacao',
    'nota de especialização',
    'titulacao academica',
    'titulação acadêmica',
    'titulacao',
    'titulação',
    'especializacao',
    'especialização',
    'mestrado',
    'doutorado',
    'escolaridade pergunta 15',
    'escolaridade pontuacao pergunta 15',
    'escolaridade pontuação pergunta 15',
    'escolaridade pontuacao pergunta 6',
    'escolaridade pontuação pergunta 6',
    'escolaridade pontuacao',
    'escolaridade pontuação',
    'escolaridade - pontuacao',
    'escolaridade - pontuação'
  ],
  pontuacaoCursosAperfeicoamento: [
    'pontuacao_cursos_aperfeicoamento',
    'pontuacao cursos aperfeicoamento',
    'pontuação cursos aperfeiçoamento',
    'pontuacao cursos de aperfeicoamento',
    'pontuação cursos de aperfeiçoamento',
    'nota cursos',
    'nota de cursos',
    'cursos de aperfeicoamento',
    'cursos de aperfeiçoamento',
    'cursos relacionados',
    'aperfeicoamento',
    'aperfeiçoamento',
    'nota cursos pergunta 17',
    'nota cursos pontuacao pergunta 17',
    'nota cursos pontuação pergunta 17',
    'cursos de aperfeicoamento pontuacao pergunta 8',
    'cursos de aperfeiçoamento pontuação pergunta 8',
    'cursos de aperfeicoamento pontuacao',
    'cursos de aperfeiçoamento pontuação',
    'cursos de aperfeicoamento - pontuacao',
    'cursos de aperfeiçoamento - pontuação'
  ],
  pontuacaoExperienciaProfissional: [
    'pontuacao_experiencia_profissional',
    'pontuacao experiencia profissional',
    'pontuação experiência profissional',
    'nota experiencia',
    'nota experiência',
    'nota de experiencia',
    'nota de experiência',
    'experiencia pergunta 9',
    'experiência pergunta 9',
    'experiencia pontuacao pergunta 9',
    'experiência pontuação pergunta 9',
    'experiencia profissional pontuacao pergunta 10',
    'experiência profissional pontuação pergunta 10',
    'experiencia profissional pontuacao',
    'experiência profissional pontuação',
    'experiencia profissional - pontuacao',
    'experiência profissional - pontuação',
    'experiencia profissional',
    'experiência profissional',
    'experiencia na area',
    'experiência na área',
    'experiencia no sus',
    'experiência no sus'
  ],
  pontuacaoCriterioEtnico: [
    'pontuacao_criterio_etnico',
    'pontuacao criterio etnico',
    'pontuação critério étnico',
    'criterio etnico pontuacao',
    'critério étnico pontuação',
    'indigena pergunta 5',
    'indígena pergunta 5',
    'indigena pontuacao pergunta 5',
    'indígena pontuação pergunta 5',
    'criterio etnico - pontuacao',
    'critério étnico - pontuação',
    'e indigena e mora em aldeia pontuacao pergunta 16',
    'é indígena e mora em aldeia pontuação pergunta 16',
    'indigena mora aldeia pontuacao',
    'indígena mora aldeia pontuação',
    'e indigena e mora em aldeia - pontuacao',
    'é indígena e mora em aldeia - pontuação'
  ],

  experienciaProfissionalAnos: [
    'experiencia anos',
    'experiência anos',
    'experiencia (anos)',
    'experiência (anos)',
    'experiencia ano',
    'experiência ano',
    'experiencia profissional anos',
    'experiência profissional anos',
    'experiencia profissional (anos)',
    'experiência profissional (anos)'
  ],
  experienciaProfissionalMeses: [
    'experiencia meses',
    'experiência meses',
    'experiencia (meses)',
    'experiência (meses)',
    'experiencia mes',
    'experiência mês',
    'experiencia profissional meses',
    'experiência profissional meses',
    'experiencia profissional (meses)',
    'experiência profissional (meses)'
  ],
  experienciaProfissionalDias: [
    'experiencia dias',
    'experiência dias',
    'experiencia (dias)',
    'experiência (dias)',
    'experiencia dia',
    'experiência dia',
    'experiencia profissional dias',
    'experiência profissional dias',
    'experiencia profissional (dias)',
    'experiência profissional (dias)'
  ],
  experienciaProfissionalTotal: [
    'experiencia total',
    'experiência total',
    'experiencia profissional total',
    'experiência profissional total',
    'total experiencia profissional',
    'total experiência profissional',
    'criterio desempate',
    'critério desempate',
    'criterio de desempate',
    'critério de desempate',
    'maior tempo de experiencia profissional',
    'maior tempo de experiência profissional',
    'tempo de experiencia profissional',
    'tempo de experiência profissional'
  ],

  experienciaSaudeIndigenaAnos: [
    'experiencia na saude indigena anos',
    'experiência na saúde indígena anos',
    'experiencia na saude indigena (anos)',
    'experiência na saúde indígena (anos)'
  ],
  experienciaSaudeIndigenaMeses: [
    'experiencia na saude indigena meses',
    'experiência na saúde indígena meses',
    'experiencia na saude indigena (meses)',
    'experiência na saúde indígena (meses)'
  ],
  experienciaSaudeIndigenaDias: [
    'experiencia na saude indigena dias',
    'experiência na saúde indígena dias',
    'experiencia na saude indigena (dias)',
    'experiência na saúde indígena (dias)'
  ],
  experienciaSaudeIndigenaTotal: [
    'experiencia total na saude indigena',
    'experiência total na saúde indígena',
    'experiencia total saude indigena',
    'experiência total saúde indígena'
  ],

  experienciaAtencaoBasicaAnos: [
    'experiencia na atencao basica anos',
    'experiência na atenção básica anos',
    'experiencia na atencao basica (anos)',
    'experiência na atenção básica (anos)'
  ],
  experienciaAtencaoBasicaMeses: [
    'experiencia na atencao basica meses',
    'experiência na atenção básica meses',
    'experiencia na atencao basica (meses)',
    'experiência na atenção básica (meses)'
  ],
  experienciaAtencaoBasicaDias: [
    'experiencia na atencao basica dias',
    'experiência na atenção básica dias',
    'experiencia na atencao basica (dias)',
    'experiência na atenção básica (dias)'
  ],
  experienciaAtencaoBasicaTotal: [
    'experiencia total na atencao basica',
    'experiência total na atenção básica',
    'experiencia total atencao basica',
    'experiência total atenção básica'
  ],


  etapa: ['etapa'],
  dataAnalise: ['data da analise', 'data da análise', 'data analise', 'data análise'],
  analise: ['analise', 'análise'],
  pcd: ['pcd'],
  responsavelAnalise: [
    'responsavel pela analise',
    'responsável pela análise',
    'responsavel analise',
    'responsável análise',
    'responsavel da analise',
    'responsável da análise',
    'responsavel'
  ],
  coordDemandante: [
    'coord demandante',
    'coordenacao demandante',
    'coordenação demandante'
  ],
  emailDemandante: ['email demandante', 'e mail demandante']
};

const SOURCE_ALIAS_TO_CATEGORY = buildSourceAliasCategoryMap_();

function onOpen(e) {
  try {
    SpreadsheetApp.getUi()
      .createMenu('MFC Consolidação')
      .addItem('Validar estrutura', 'validarEstrutura')
      .addItem('Migrar contrato da FATO para novo formato', 'migrarContratoFatoNovoFormato')
      .addItem('Pré-validar origens antes da sincronização', 'preValidarOrigensAntesDaSincronizacao')
      .addItem('Gerar auditoria da FATO', 'gerarAuditoriaStatusFato')
      .addItem('Recalcular status_consolidado da FATO', 'recalcularStatusConsolidadoFato')
      .addItem('Recalcular notas/pontuações da FATO', 'recalcularNotasPontuacoesFato')
      .addSeparator()
      .addItem('Atualizar DIM_VAGAS pelas pastas', 'atualizarDimVagasAPartirDasPastas')
      .addItem('Recalcular DIM_VAGAS pelo nome dos arquivos', 'recalcularDimVagasPeloNomeArquivos')
      .addItem('Sincronizar FATO_ANALISES (incremental)', 'sincronizarAnalises')
      .addItem('Reconstruir FATO_ANALISES do zero', 'reconstruirFatoAnalisesCompleta')
      .addItem('Atualizar DIM_VAGAS + Sincronizar FATO', 'atualizarDimVagasESincronizar')
      .addItem('Cancelar sincronização em andamento', 'cancelarSincronizacaoAnalises')
      .addSeparator()
      .addItem('Criar gatilho de 20 minutos', 'criarGatilhoVinteMinutos')
      .addItem('Remover gatilhos gerenciados por este script', 'removerGatilhosProjeto')
      .addToUi();
  } catch (err) {
    Logger.log('onOpen executado sem contexto de UI: ' + (err && err.message ? err.message : err));
  }
}

function onInstall(e) {
  onOpen(e);
}

function acquireScriptLockOrThrow_(contextLabel, waitMs) {
  const lock = LockService.getScriptLock();
  const timeout = Number(waitMs || 30000);

  try {
    lock.waitLock(timeout);
    return lock;
  } catch (err) {
    throw new Error(
      (contextLabel || 'Operação') +
      ': outro processo ainda está em execução. ' +
      'Use "Cancelar sincronização em andamento", aguarde alguns instantes e tente novamente.'
    );
  }
}


function validarEstrutura() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  garantirCabecalhoPreservandoDados_(getOrCreateSheet_(ss, CFG.ABA_DIM_EDITAIS), CFG.DIM_EDITAIS_HEADERS);
  garantirCabecalhoPreservandoDados_(getOrCreateSheet_(ss, CFG.ABA_DIM_VAGAS), CFG.DIM_VAGAS_HEADERS);
  garantirCabecalhoPreservandoDados_(getOrCreateSheet_(ss, CFG.ABA_DIM_RESPONSAVEIS), CFG.DIM_RESP_HEADERS);
  garantirCabecalhoPreservandoDados_(getOrCreateSheet_(ss, CFG.ABA_FATO), CFG.FATO_HEADERS);
  garantirCabecalhoPreservandoDados_(getOrCreateSheet_(ss, CFG.ABA_FATO_STAGING), CFG.FATO_HEADERS);
  garantirCabecalhoPreservandoDados_(getOrCreateSheet_(ss, CFG.ABA_LOG), CFG.LOG_HEADERS);
  garantirCabecalhoPreservandoDados_(getOrCreateSheet_(ss, CFG.ABA_META_PAINEL), CFG.META_PAINEL_HEADERS);
  garantirCabecalhoPreservandoDados_(getOrCreateSheet_(ss, CFG.ABA_PRE_VALIDACAO), CFG.PRE_VALIDACAO_HEADERS);
  garantirCabecalhoPreservandoDados_(getOrCreateSheet_(ss, CFG.ABA_AUDITORIA_FATO), CFG.AUDITORIA_FATO_HEADERS);
  garantirCabecalhoPreservandoDados_(getOrCreateSheet_(ss, CFG.ABA_CTRL_SYNC), CFG.CTRL_SYNC_HEADERS);

  aplicarFormatoTextoColunas_(ss.getSheetByName(CFG.ABA_DIM_EDITAIS), [1, 2, 3]);
  aplicarFormatoTextoColunas_(ss.getSheetByName(CFG.ABA_DIM_VAGAS), [1, 2, 3, 4]);
  aplicarFormatoTextoColunas_(ss.getSheetByName(CFG.ABA_DIM_RESPONSAVEIS), [1, 2, 3, 4]);
  aplicarFormatoTextoColunas_(ss.getSheetByName(CFG.ABA_FATO), [1, 2, 3, 4, 10]);
  aplicarFormatoTextoColunas_(ss.getSheetByName(CFG.ABA_FATO_STAGING), [1, 2, 3, 4, 10]);
  aplicarFormatosFatoNovoContrato_(ss.getSheetByName(CFG.ABA_FATO));
  aplicarFormatosFatoNovoContrato_(ss.getSheetByName(CFG.ABA_FATO_STAGING));
  aplicarFormatoTextoColunas_(ss.getSheetByName(CFG.ABA_CTRL_SYNC), [1, 2, 3, 4, 5]);

  validarContratoPainel_(ss);
  atualizarMetaPainel_(ss, {
    last_run_status: 'READY',
    contract_status: 'OK'
  });

  safeAlert_(
    'Estrutura validada.\n\n' +
    'Preencha manualmente:\n' +
    '- DIM_EDITAIS (grupo, unidade, edital, pasta_origem_link, ativo, data_inicio_analise, data_fim_analise, observacao)\n' +
    '- DIM_RESPONSAVEIS (grupo, unidade, edital, codigo_vaga, responsavel_analise, coord_demandante, email_demandante)\n\n' +
    'Regras de vigência:\n' +
    '- se inicio/fim estiverem vazios, o edital segue a lógica atual\n' +
    '- fora da janela, o script não reprocessa a origem e preserva o FATO já publicado\n\n' +
    'Depois rode:\n' +
    '1) Atualizar DIM_VAGAS pelas pastas\n' +
    '2) Sincronizar FATO_ANALISES'
  );
}



function migrarContratoFatoNovoFormato() {
  const lock = acquireScriptLockOrThrow_('Migração do contrato da FATO', 30000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    garantirCabecalhoPreservandoDados_(getOrCreateSheet_(ss, CFG.ABA_FATO), CFG.FATO_HEADERS);
    garantirCabecalhoPreservandoDados_(getOrCreateSheet_(ss, CFG.ABA_FATO_STAGING), CFG.FATO_HEADERS);
    aplicarFormatoTextoColunas_(ss.getSheetByName(CFG.ABA_FATO), [1, 2, 3, 4, 10]);
    aplicarFormatoTextoColunas_(ss.getSheetByName(CFG.ABA_FATO_STAGING), [1, 2, 3, 4, 10]);
    aplicarFormatosFatoNovoContrato_(ss.getSheetByName(CFG.ABA_FATO));
    aplicarFormatosFatoNovoContrato_(ss.getSheetByName(CFG.ABA_FATO_STAGING));
    validarContratoPainel_(ss);
    atualizarMetaPainel_(ss, {
      last_contract_migration_at: new Date(),
      contract_status: 'OK'
    });
    safeAlert_(
      'Contrato da FATO_ANALISES migrado para o novo formato.\n\n' +
      'Novas colunas incluídas: data_nascimento, modalidade_concorrencia, pontuações, critério de desempate, experiência profissional, experiências em Saúde Indígena/Atenção Básica e metadados de PDF.\n\n' +
      'Agora rode: Reconstruir FATO_ANALISES do zero.'
    );
  } finally {
    lock.releaseLock();
  }
}

function atualizarDimVagasESincronizar() {
  atualizarDimVagasAPartirDasPastas();
  sincronizarAnalises();
}

function atualizarDimVagasAPartirDasPastas() {
  const lock = acquireScriptLockOrThrow_('Atualização de DIM_VAGAS', 30000);

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const dimEditaisSheet = getSheetOrThrow_(ss, CFG.ABA_DIM_EDITAIS);
    const dimVagasSheet = getOrCreateSheet_(ss, CFG.ABA_DIM_VAGAS);
    const logSheet = getOrCreateSheet_(ss, CFG.ABA_LOG);

    validarCabecalho_(dimEditaisSheet, CFG.DIM_EDITAIS_HEADERS);
    garantirCabecalhoPreservandoDados_(dimVagasSheet, CFG.DIM_VAGAS_HEADERS);
    garantirCabecalhoPreservandoDados_(logSheet, CFG.LOG_HEADERS);
    garantirCabecalhoPreservandoDados_(getOrCreateSheet_(ss, CFG.ABA_META_PAINEL), CFG.META_PAINEL_HEADERS);

    aplicarFormatoTextoColunas_(dimEditaisSheet, [1, 2, 3]);
    aplicarFormatoTextoColunas_(dimVagasSheet, [1, 2, 3, 4]);
    validarContratoPainel_(ss);

    const editais = readObjects_(dimEditaisSheet).filter(function(row) {
      return isEditalElegivelParaAtualizacao_(row, { ignoreWindow: false });
    });
    const existingRows = readObjects_(dimVagasSheet);
    const existingMap = buildDimVagasMap_(existingRows);

    const discoveredMap = {};
    const logs = [];

    editais.forEach(function(editalRow) {
      const grupo = normalizeGrupo_(editalRow.grupo);
      const unidade = normalizeUnidade_(editalRow.unidade);
      const edital = normalizeEdital_(editalRow.edital);
      const folderId = extractDriveId_(editalRow.pasta_origem_link);

      if (!edital || !folderId) {
        logs.push(buildLogRow_('WARN', edital, '', '', 'Linha de DIM_EDITAIS ignorada por edital ou pasta vazios.'));
        return;
      }

      let folder;
      try {
        folder = DriveApp.getFolderById(folderId);
      } catch (err) {
        logs.push(buildLogRow_('ERRO', edital, '', '', 'Não foi possível abrir a pasta: ' + err.message));
        return;
      }

      const files = folder.getFiles();
      while (files.hasNext()) {
        const file = files.next();
        if (file.getMimeType() !== CFG.MIME_GOOGLE_SHEETS) continue;

        const parsed = parseVagaFromFileName_(file.getName());
        if (!parsed.codigo_vaga) {
          logs.push(buildLogRow_('WARN', edital, '', file.getName(), 'Arquivo ignorado por não conter código da vaga no nome.'));
          continue;
        }

        const key = buildDimVagaKey_(grupo, unidade, edital, parsed.codigo_vaga);
        const current = existingMap[key] || {};

        discoveredMap[key] = {
          grupo: grupo,
          unidade: unidade,
          edital: edital,
          codigo_vaga: parsed.codigo_vaga,
          nome_vaga: chooseValue_(current.nome_vaga, parsed.nome_vaga),
          regime: chooseValue_(current.regime, parsed.regime),
          carga_horaria: chooseValue_(current.carga_horaria, parsed.carga_horaria),
          categoria: chooseValue_(current.categoria, parsed.categoria),
          planilha_origem_id: file.getId(),
          link_planilha_origem: file.getUrl(),
          nome_arquivo_origem: file.getName(),
          ultima_sincronizacao_vaga: new Date()
        };
      }
    });

    const mergedRows = mergeDimVagasPreservingManual_(existingRows, discoveredMap);

    writeDimVagasPreservingManual_(dimVagasSheet, CFG.DIM_VAGAS_HEADERS, mergedRows);
    appendLogs_(logSheet, logs);
    atualizarMetaPainel_(ss, {
      last_dim_vagas_update_at: new Date(),
      contract_status: 'OK'
    });

    safeAlert_(
      'DIM_VAGAS atualizada com sucesso.\n\n' +
      'Total de vagas após mesclagem: ' + mergedRows.length
    );

  } finally {
    lock.releaseLock();
  }
}



function recalcularDimVagasPeloNomeArquivos() {
  const lock = acquireScriptLockOrThrow_('Recalculo da DIM_VAGAS', 30000);

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const dimVagasSheet = getSheetOrThrow_(ss, CFG.ABA_DIM_VAGAS);
    validarCabecalho_(dimVagasSheet, CFG.DIM_VAGAS_HEADERS);

    const rows = readObjects_(dimVagasSheet);
    let atualizadas = 0;

    const outputRows = rows.map(function(row) {
      const planilhaId = cleanStr_(row.planilha_origem_id) || extractDriveId_(row.link_planilha_origem);
      let nomeArquivo = cleanStr_(row.nome_arquivo_origem);

      if (!nomeArquivo && planilhaId) {
        try {
          nomeArquivo = DriveApp.getFileById(planilhaId).getName();
        } catch (err) {
          nomeArquivo = '';
        }
      }

      const parsed = nomeArquivo ? parseVagaFromFileName_(nomeArquivo) : {};
      const nomeVaga = cleanStr_(parsed.nome_vaga) || cleanStr_(row.nome_vaga);
      const regime = cleanStr_(parsed.regime) || cleanStr_(row.regime);
      const cargaHoraria = cleanStr_(parsed.carga_horaria) || cleanStr_(row.carga_horaria);
      const categoria = cleanStr_(parsed.categoria) || cleanStr_(row.categoria);

      if (
        cleanStr_(row.nome_vaga) !== nomeVaga ||
        cleanStr_(row.regime) !== regime ||
        cleanStr_(row.carga_horaria) !== cargaHoraria ||
        cleanStr_(row.categoria) !== categoria
      ) {
        atualizadas += 1;
      }

      return [
        normalizeGrupo_(row.grupo),
        normalizeUnidade_(row.unidade),
        normalizeEdital_(row.edital),
        cleanStr_(parsed.codigo_vaga || row.codigo_vaga),
        nomeVaga,
        regime,
        cargaHoraria,
        categoria,
        planilhaId,
        cleanStr_(row.link_planilha_origem),
        nomeArquivo || cleanStr_(row.nome_arquivo_origem),
        new Date()
      ];
    });

    writeDimVagasPreservingManual_(dimVagasSheet, CFG.DIM_VAGAS_HEADERS, outputRows);
    atualizarMetaPainel_(ss, {
      last_dim_vagas_reparse_at: new Date(),
      contract_status: 'OK'
    });

    safeAlert_(
      'DIM_VAGAS recalculada pelo nome dos arquivos.\n\n' +
      'Linhas atualizadas: ' + atualizadas + '\n\n' +
      'Depois rode: Reconstruir FATO_ANALISES do zero.'
    );
  } finally {
    lock.releaseLock();
  }
}

function preValidarOrigensAntesDaSincronizacao() {
  const lock = acquireScriptLockOrThrow_('Pré-validação das origens', 30000);

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const dimEditaisSheet = getSheetOrThrow_(ss, CFG.ABA_DIM_EDITAIS);
    const dimVagasSheet = getSheetOrThrow_(ss, CFG.ABA_DIM_VAGAS);
    const reportSheet = getOrCreateSheet_(ss, CFG.ABA_PRE_VALIDACAO);

    garantirCabecalhoPreservandoDados_(reportSheet, CFG.PRE_VALIDACAO_HEADERS);
    validarCabecalho_(dimEditaisSheet, CFG.DIM_EDITAIS_HEADERS);
    validarCabecalho_(dimVagasSheet, CFG.DIM_VAGAS_HEADERS);

    const editais = readObjects_(dimEditaisSheet);
    const vagas = readObjects_(dimVagasSheet);
    const reportRows = [];
    const resumo = {
      erros: 0,
      avisos: 0,
      resumos: 0
    };

    editais.forEach(function(editalRow) {
      const grupo = normalizeGrupo_(editalRow.grupo);
      const unidade = normalizeUnidade_(editalRow.unidade);
      const edital = normalizeEdital_(editalRow.edital);
      const folderId = extractDriveId_(editalRow.pasta_origem_link);

      if (!edital) {
        reportRows.push(buildPreValidationRow_('ERRO', grupo, unidade, edital, '', '', 'Linha de DIM_EDITAIS sem edital informado.', 'Preencha a coluna edital antes de sincronizar.'));
        resumo.erros += 1;
        return;
      }

      if (!folderId) {
        reportRows.push(buildPreValidationRow_('ERRO', grupo, unidade, edital, '', '', 'Pasta de origem ausente ou inválida.', 'Corrija a coluna pasta_origem_link em DIM_EDITAIS.'));
        resumo.erros += 1;
        return;
      }

      try {
        const folder = DriveApp.getFolderById(folderId);
        const files = folder.getFiles();
        let totalSheets = 0;
        let totalInvalidNames = 0;

        while (files.hasNext()) {
          const file = files.next();
          if (file.getMimeType() !== CFG.MIME_GOOGLE_SHEETS) continue;
          totalSheets += 1;

          const parsed = parseVagaFromFileName_(file.getName());
          if (!parsed.codigo_vaga) {
            totalInvalidNames += 1;
            reportRows.push(buildPreValidationRow_('WARN', grupo, unidade, edital, '', file.getName(), 'Arquivo ignorável: nome sem código de vaga detectável.', 'Padronize o nome do arquivo com o código da vaga.'));
            resumo.avisos += 1;
          }
        }

        reportRows.push(buildPreValidationRow_('RESUMO', grupo, unidade, edital, '', folder.getName(), 'Pastas e arquivos verificados: ' + totalSheets + ' planilha(s), ' + totalInvalidNames + ' com nome inconsistente.', 'Sem ação, salvo se houver avisos/erros acima.'));
        resumo.resumos += 1;
      } catch (err) {
        reportRows.push(buildPreValidationRow_('ERRO', grupo, unidade, edital, '', '', 'Não foi possível abrir a pasta de origem: ' + cleanStr_(err && err.message ? err.message : err), 'Confirme permissão de acesso e o ID da pasta.'));
        resumo.erros += 1;
      }
    });

    vagas.forEach(function(vaga) {
      const grupo = normalizeGrupo_(vaga.grupo);
      const unidade = normalizeUnidade_(vaga.unidade);
      const edital = normalizeEdital_(vaga.edital);
      const codigoVaga = cleanStr_(vaga.codigo_vaga);
      const planilhaId = cleanStr_(vaga.planilha_origem_id) || extractDriveId_(vaga.link_planilha_origem);
      const origemLabel = cleanStr_(vaga.nome_arquivo_origem) || planilhaId;

      if (!codigoVaga) {
        reportRows.push(buildPreValidationRow_('ERRO', grupo, unidade, edital, codigoVaga, origemLabel, 'Vaga sem código na DIM_VAGAS.', 'Corrija a coluna codigo_vaga antes de sincronizar.'));
        resumo.erros += 1;
        return;
      }

      if (!planilhaId) {
        reportRows.push(buildPreValidationRow_('ERRO', grupo, unidade, edital, codigoVaga, origemLabel, 'Vaga sem planilha_origem_id ou link válido.', 'Atualize DIM_VAGAS a partir das pastas.'));
        resumo.erros += 1;
        return;
      }

      try {
        const origemSS = SpreadsheetApp.openById(planilhaId);
        const origemSheet = origemSS.getSheetByName(CFG.ABA_ORIGEM_PADRAO) || getSheetByNormalizedName_(origemSS, CFG.ABA_ORIGEM_PADRAO);
        if (!origemSheet) {
          reportRows.push(buildPreValidationRow_('ERRO', grupo, unidade, edital, codigoVaga, origemSS.getName(), 'Aba obrigatória "' + CFG.ABA_ORIGEM_PADRAO + '" não encontrada.', 'Crie ou renomeie a aba de origem antes da sincronização.'));
          resumo.erros += 1;
          return;
        }

        const values = origemSheet.getDataRange().getValues();
        if (!values.length) {
          reportRows.push(buildPreValidationRow_('WARN', grupo, unidade, edital, codigoVaga, origemSS.getName(), 'Planilha de origem vazia.', 'Confirme se a origem já recebeu candidatos aptos para análise.'));
          resumo.avisos += 1;
          return;
        }

        const headerRowIndex = detectarLinhaCabecalho_(values);
        const headers = values[headerRowIndex].map(normalizarCabecalhoAB_);
        const idx = buildHeaderIndex_(headers);
        validarCabecalhoOrigemMinimo_(idx);

        avaliarQualidadeCabecalhoOrigem_(idx).forEach(function(aviso) {
          reportRows.push(buildPreValidationRow_('WARN', grupo, unidade, edital, codigoVaga, origemSS.getName(), aviso.mensagem, aviso.acao));
          resumo.avisos += 1;
        });

        const registros = values.slice(headerRowIndex + 1);
        let contagemValidos = 0;
        let contagemRevisar = 0;

        registros.forEach(function(row) {
          const candidato = cleanStr_(getSourceField_(row, idx, SOURCE_HEADER_ALIASES.candidato));
          if (!candidato) return;
          contagemValidos += 1;
          const etapa = getSourceField_(row, idx, SOURCE_HEADER_ALIASES.etapa);
          const analise = getSourceField_(row, idx, SOURCE_HEADER_ALIASES.analise);
          const status = derivarStatusConsolidado_(etapa, analise);
          if (status === 'Revisar') contagemRevisar += 1;
        });

        reportRows.push(buildPreValidationRow_('RESUMO', grupo, unidade, edital, codigoVaga, origemSS.getName(), 'Registros válidos detectados: ' + contagemValidos + '. Em revisão: ' + contagemRevisar + '.', 'Sem ação, salvo se a contagem parecer inconsistente.'));
        resumo.resumos += 1;
      } catch (err) {
        reportRows.push(buildPreValidationRow_('ERRO', grupo, unidade, edital, codigoVaga, origemLabel, 'Falha ao validar origem: ' + cleanStr_(err && err.message ? err.message : err), 'Revise a planilha e execute a pré-validação novamente.'));
        resumo.erros += 1;
      }
    });

    writeSimpleReportSheet_(reportSheet, CFG.PRE_VALIDACAO_HEADERS, reportRows);
    safeAlert_(
      'Pré-validação concluída.\n\n' +
      'Erros: ' + resumo.erros + '\n' +
      'Avisos: ' + resumo.avisos + '\n' +
      'Resumos: ' + resumo.resumos + '\n\n' +
      'Consulte a aba ' + CFG.ABA_PRE_VALIDACAO + ' para os detalhes.'
    );
  } finally {
    lock.releaseLock();
  }
}

function gerarAuditoriaStatusFato() {
  const lock = acquireScriptLockOrThrow_('Auditoria da FATO', 30000);

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const fatoSheet = getSheetOrThrow_(ss, CFG.ABA_FATO);
    const reportSheet = getOrCreateSheet_(ss, CFG.ABA_AUDITORIA_FATO);
    garantirCabecalhoPreservandoDados_(reportSheet, CFG.AUDITORIA_FATO_HEADERS);
    validarCabecalho_(fatoSheet, CFG.FATO_HEADERS);

    const rows = readObjects_(fatoSheet);
    const grouped = {};

    rows.forEach(function(row) {
      const key = [
        normalizeGrupo_(row.grupo),
        normalizeUnidade_(row.unidade),
        normalizeEdital_(row.edital),
        cleanStr_(row.codigo_vaga),
        cleanStr_(row.nome_vaga)
      ].join('|');

      if (!grouped[key]) {
        grouped[key] = {
          grupo: normalizeGrupo_(row.grupo),
          unidade: normalizeUnidade_(row.unidade),
          edital: normalizeEdital_(row.edital),
          codigo_vaga: cleanStr_(row.codigo_vaga),
          nome_vaga: cleanStr_(row.nome_vaga),
          total_registros: 0,
          pendente: 0,
          revisar: 0,
          aprovado: 0,
          reprovado: 0,
          sem_data_analise: 0,
          ultima_atualizacao_max: ''
        };
      }

      const item = grouped[key];
      const status = cleanStr_(row.status_consolidado);
      item.total_registros += 1;
      if (status === 'Pendente') item.pendente += 1;
      else if (status === 'Revisar') item.revisar += 1;
      else if (status === 'Aprovado') item.aprovado += 1;
      else if (status === 'Reprovado') item.reprovado += 1;
      if (!cleanStr_(row.data_analise)) item.sem_data_analise += 1;

      const atual = normalizeDateTimeKey_(row.ultima_atualizacao);
      if (atual && (!item.ultima_atualizacao_max || atual > item.ultima_atualizacao_max)) {
        item.ultima_atualizacao_max = atual;
      }
    });

    const outputRows = Object.keys(grouped).sort().map(function(key) {
      const item = grouped[key];
      return CFG.AUDITORIA_FATO_HEADERS.map(function(header) {
        return item[normalizarCabecalhoAB_(header)] != null ? item[normalizarCabecalhoAB_(header)] : item[header] || '';
      });
    });

    writeSimpleReportSheet_(reportSheet, CFG.AUDITORIA_FATO_HEADERS, outputRows);
    const idxUltima = CFG.AUDITORIA_FATO_HEADERS.indexOf('ultima_atualizacao_max');
    if (idxUltima !== -1 && outputRows.length) {
      reportSheet.getRange(2, idxUltima + 1, outputRows.length, 1).setNumberFormat('yyyy-MM-dd HH:mm:ss');
    }

    safeAlert_(
      'Auditoria da FATO concluída.\n\n' +
      'Linhas auditadas: ' + rows.length + '\n' +
      'Agrupamentos gerados: ' + outputRows.length + '\n\n' +
      'Consulte a aba ' + CFG.ABA_AUDITORIA_FATO + ' para os detalhes.'
    );
  } finally {
    lock.releaseLock();
  }
}

function buildPreValidationRow_(tipo, grupo, unidade, edital, codigoVaga, origem, mensagem, acao) {
  return [
    new Date(),
    tipo,
    cleanStr_(grupo),
    cleanStr_(unidade),
    cleanStr_(edital),
    cleanStr_(codigoVaga),
    cleanStr_(origem),
    cleanStr_(mensagem),
    cleanStr_(acao)
  ];
}

function writeSimpleReportSheet_(sheet, headers, rows) {
  resetSheetWithHeaders_(sheet, headers);
  if (rows && rows.length) {
    writeRowsInChunks_(sheet, 2, 1, rows, headers.length, getWriteChunkRows_());
  }
}

function getWriteChunkRows_() {
  return Math.max(100, Number(CFG.WRITE_CHUNK_ROWS || 400));
}

function getReadChunkRows_() {
  return Math.max(200, Number(CFG.READ_CHUNK_ROWS || 800));
}

function clearUsedContent_(sheet, totalCols) {
  const cols = Math.max(1, Number(totalCols || sheet.getLastColumn() || 1));
  const rows = Math.max(1, sheet.getLastRow());
  sheet.getRange(1, 1, rows, cols).clearContent();
}

function removeFilterSafe_(sheet) {
  try {
    const filter = sheet.getFilter();
    if (filter) filter.remove();
  } catch (err) {
    Logger.log('Aviso ao remover filtro de ' + sheet.getName() + ': ' + (err && err.message ? err.message : err));
  }
}

function createFilterSafe_(sheet, totalRows, totalCols) {
  const rows = Math.max(1, Number(totalRows || sheet.getLastRow() || 1));
  const cols = Math.max(1, Number(totalCols || sheet.getLastColumn() || 1));

  removeFilterSafe_(sheet);

  if (rows > Number(CFG.MAX_AUTO_FILTER_ROWS || 5000)) {
    Logger.log('Filtro automático ignorado em ' + sheet.getName() + ' porque há ' + rows + ' linha(s).');
    return;
  }

  try {
    sheet.getRange(1, 1, rows, cols).createFilter();
  } catch (err) {
    Logger.log('Aviso ao criar filtro em ' + sheet.getName() + ': ' + (err && err.message ? err.message : err));
  }
}

function resetSheetWithHeaders_(sheet, headers) {
  const totalCols = headers.length;
  removeFilterSafe_(sheet);
  clearUsedContent_(sheet, totalCols);
  sheet.getRange(1, 1, 1, totalCols).setValues([headers]);
}

function writeRowsInChunks_(sheet, startRow, startCol, rows, totalCols, chunkSize) {
  if (!rows || !rows.length) return;
  const size = Math.max(100, Number(chunkSize || getWriteChunkRows_()));
  const cols = Math.max(1, Number(totalCols || (rows[0] ? rows[0].length : 1)));

  for (let offset = 0; offset < rows.length; offset += size) {
    const chunk = rows.slice(offset, offset + size);
    sheet.getRange(startRow + offset, startCol, chunk.length, cols).setValues(chunk);
    if (offset && offset % (size * 5) === 0) SpreadsheetApp.flush();
  }
}

function clearFatoDataOnly_(sheet) {
  const headers = CFG.FATO_HEADERS;
  const totalCols = headers.length;
  removeFilterSafe_(sheet);
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, totalCols).clearContent();
  }
  sheet.getRange(1, 1, 1, totalCols).setValues([headers]);
}

function sincronizarAnalises() {
  return iniciarSincronizacaoAnalises_(false);
}

function reconstruirFatoAnalisesCompleta() {
  return iniciarSincronizacaoAnalises_(true);
}


function iniciarSincronizacaoAnalises_(forceFullRebuild) {
  const lock = acquireScriptLockOrThrow_('Início da sincronização', 30000);

  try {
    const ssCentral = SpreadsheetApp.getActiveSpreadsheet();
    const logSheet = getOrCreateSheet_(ssCentral, CFG.ABA_LOG);
    garantirCabecalhoPreservandoDados_(logSheet, CFG.LOG_HEADERS);

    const props = PropertiesService.getScriptProperties();
    recuperarSincronizacaoTravadaSeNecessario_(ssCentral, logSheet, props);

    const jaEstavaAtiva = props.getProperty(CFG.PROP_SYNC_ACTIVE) === '1';

    if (!jaEstavaAtiva) {
      const dimEditaisSheet = getSheetOrThrow_(ssCentral, CFG.ABA_DIM_EDITAIS);
      const dimVagasSheet = getSheetOrThrow_(ssCentral, CFG.ABA_DIM_VAGAS);
      const dimRespSheet = getSheetOrThrow_(ssCentral, CFG.ABA_DIM_RESPONSAVEIS);
      const fatoSheet = getOrCreateSheet_(ssCentral, CFG.ABA_FATO);
      const fatoStagingSheet = getOrCreateSheet_(ssCentral, CFG.ABA_FATO_STAGING);
      const ctrlSheet = getOrCreateSheet_(ssCentral, CFG.ABA_CTRL_SYNC);
      const metaSheet = getOrCreateSheet_(ssCentral, CFG.ABA_META_PAINEL);

      validarCabecalho_(dimEditaisSheet, CFG.DIM_EDITAIS_HEADERS);
      validarCabecalho_(dimVagasSheet, CFG.DIM_VAGAS_HEADERS);
      validarCabecalho_(dimRespSheet, CFG.DIM_RESP_HEADERS);
      garantirCabecalhoPreservandoDados_(fatoSheet, CFG.FATO_HEADERS);
      garantirCabecalhoPreservandoDados_(fatoStagingSheet, CFG.FATO_HEADERS);
      garantirCabecalhoPreservandoDados_(logSheet, CFG.LOG_HEADERS);
      garantirCabecalhoPreservandoDados_(metaSheet, CFG.META_PAINEL_HEADERS);
      garantirCabecalhoPreservandoDados_(ctrlSheet, CFG.CTRL_SYNC_HEADERS);
      validarContratoPainel_(ssCentral);

      aplicarFormatoTextoColunas_(fatoSheet, [1, 2, 3, 4, 10]);
      aplicarFormatoTextoColunas_(fatoStagingSheet, [1, 2, 3, 4, 10]);
      aplicarFormatosFatoNovoContrato_(fatoSheet);
      aplicarFormatosFatoNovoContrato_(fatoStagingSheet);
      aplicarFormatoTextoColunas_(ctrlSheet, [1, 2, 3, 4, 5]);

      const responsaveis = readObjects_(dimRespSheet);
      const respMap = buildRespMap_(responsaveis);
      const prep = prepararControleSincronizacao_(dimEditaisSheet, dimVagasSheet, ctrlSheet, respMap, forceFullRebuild);

      limparGatilhosSincronizacaoAnalises_();

      if (forceFullRebuild) {
        prepararFatoParaNovaSincronizacao_(fatoStagingSheet);
      } else {
        finalizarSincronizacaoAnalises_(fatoSheet);
      }

      if (!prep.pendingCount) {
        const prepErrorCount = Number(prep.errorCount || 0);
        limparEstadoSincronizacaoAnalises_();
        atualizarMetaPainel_(ssCentral, {
          last_run_status: prepErrorCount ? 'ERROR' : 'NO_CHANGES',
          last_run_mode: forceFullRebuild ? 'FULL' : 'INCREMENTAL',
          last_run_finished_at: new Date(),
          contract_status: 'OK',
          sources_error: prepErrorCount
        });
        safeAlert_(
          prepErrorCount
            ? ('Nenhuma origem foi processada porque há ' + prepErrorCount + ' origem(ns) com erro. Consulte CTRL_SYNC_ORIGENS e LOG_CONSOLIDACAO.')
            : (forceFullRebuild
                ? 'Nenhuma origem encontrada para reconstrução.'
                : 'Nenhuma alteração detectada. A FATO_ANALISES já está atualizada.')
        );
        return {
          finished: true,
          processedTotal: 0,
          recordsTotal: 0,
          totalVagas: 0,
          promoted: false,
          errorCount: prepErrorCount
        };
      }

      const startedAtIso = new Date().toISOString();
      props.setProperties({
        [CFG.PROP_SYNC_ACTIVE]: '1',
        [CFG.PROP_SYNC_TOTAL_PENDING]: String(prep.pendingCount),
        [CFG.PROP_SYNC_PROCESSED_SOURCES]: '0',
        [CFG.PROP_SYNC_UPDATED_RECORDS]: '0',
        [CFG.PROP_SYNC_MODE]: forceFullRebuild ? 'FULL' : 'INCREMENTAL',
        [CFG.PROP_SYNC_STARTED_AT]: startedAtIso,
        [CFG.PROP_SYNC_LAST_HEARTBEAT_AT]: startedAtIso
      }, true);

      atualizarMetaPainel_(ssCentral, {
        last_run_status: 'RUNNING',
        last_run_mode: forceFullRebuild ? 'FULL' : 'INCREMENTAL',
        last_run_started_at: new Date(startedAtIso),
        contract_status: 'OK',
        total_sources_pending: prep.pendingCount
      });
    }
  } finally {
    lock.releaseLock();
  }

  const result = processarLoteSincronizacaoAnalises_();

  if (result.finished) {
    if (result.blockedPromotion) {
      safeAlert_(
        'Reconstrução concluída com inconsistências.\n\n' +
        'O painel foi preservado: a aba FATO_ANALISES não foi substituída.\n' +
        'Origens processadas: ' + result.processedTotal + '\n' +
        'Registros preparados na staging: ' + result.recordsTotal + '\n' +
        'Origens com erro: ' + result.errorCount
      );
    } else {
      safeAlert_(
        'FATO_ANALISES sincronizado com sucesso.\n\n' +
        'Origens processadas: ' + result.processedTotal + '\n' +
        'Registros atualizados: ' + result.recordsTotal
      );
    }
  } else {
    safeAlert_(
      'Sincronização iniciada em lote.\n\n' +
      'Origens processadas até agora: ' + result.processedTotal + ' de ' + result.totalVagas + '\n' +
      'Registros atualizados até agora: ' + result.recordsTotal + '\n\n' +
      'Se necessário, o script continuará automaticamente até concluir.'
    );
  }

  return result;
}



function processarLoteSincronizacaoAnalises_() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    return { finished: false, busy: true, processedTotal: 0, recordsTotal: 0, totalVagas: 0, promoted: false, blockedPromotion: false, errorCount: 0 };
  }

  try {
    const props = PropertiesService.getScriptProperties();
    const ssCentral = SpreadsheetApp.getActiveSpreadsheet();
    const logSheet = getOrCreateSheet_(ssCentral, CFG.ABA_LOG);
    garantirCabecalhoPreservandoDados_(logSheet, CFG.LOG_HEADERS);

    recuperarSincronizacaoTravadaSeNecessario_(ssCentral, logSheet, props);

    if (props.getProperty(CFG.PROP_SYNC_ACTIVE) !== '1') {
      return { finished: true, processedTotal: 0, recordsTotal: 0, totalVagas: 0, promoted: false, blockedPromotion: false, errorCount: 0 };
    }

    const syncMode = getSyncMode_(props);
    const dimEditaisSheet = getSheetOrThrow_(ssCentral, CFG.ABA_DIM_EDITAIS);
    const dimVagasSheet = getSheetOrThrow_(ssCentral, CFG.ABA_DIM_VAGAS);
    const dimRespSheet = getSheetOrThrow_(ssCentral, CFG.ABA_DIM_RESPONSAVEIS);
    const fatoSheet = getOrCreateSheet_(ssCentral, CFG.ABA_FATO);
    const targetFatoSheet = getTargetFatoSheetForMode_(ssCentral, syncMode);
    const ctrlSheet = getOrCreateSheet_(ssCentral, CFG.ABA_CTRL_SYNC);

    validarContratoPainel_(ssCentral);

    const dimEditais = readObjects_(dimEditaisSheet);
    const editaisMap = buildDimEditaisMap_(dimEditais);
    const vagas = readObjects_(dimVagasSheet);
    const vagasByPlanilhaId = buildDimVagasByPlanilhaIdMap_(vagas);
    const responsaveis = readObjects_(dimRespSheet);
    const respMap = buildRespMap_(responsaveis);
    const ctrlRows = readObjects_(ctrlSheet);
    const pendingRows = ctrlRows.filter(function(row) {
      return isCtrlPendingStatus_(row.status_sync);
    });
    const logs = [];

    const totalPendentes = Math.max(0, Number(props.getProperty(CFG.PROP_SYNC_TOTAL_PENDING) || pendingRows.length));
    let totalProcessadas = Math.max(0, Number(props.getProperty(CFG.PROP_SYNC_PROCESSED_SOURCES) || 0));
    let totalRegistrosAtualizados = Math.max(0, Number(props.getProperty(CFG.PROP_SYNC_UPDATED_RECORDS) || 0));
    const startedAt = Date.now();
    const idsParaSubstituir = [];
    const novasLinhas = [];
    const fatoCountsByOrigemId = countFatoRowsByOrigemId_(fatoSheet);

    while (pendingRows.length) {
      if ((Date.now() - startedAt) >= CFG.MAX_RUNTIME_SYNC_MS) break;

      const ctrlRow = pendingRows.shift();
      const planilhaId = cleanStr_(ctrlRow.planilha_origem_id);
      const vaga = vagasByPlanilhaId[planilhaId];

      if (!planilhaId) {
        ctrlRow.status_sync = 'ERRO';
        ctrlRow.mensagem = 'planilha_origem_id vazio na linha de controle.';
        ctrlRow.ultima_sincronizacao = new Date();
        totalProcessadas += 1;
        continue;
      }

      if (!vaga) {
        idsParaSubstituir.push(planilhaId);
        ctrlRow.status_sync = 'REMOVIDO';
        ctrlRow.mensagem = 'Origem não encontrada mais na DIM_VAGAS; registros antigos removidos da FATO.';
        ctrlRow.qtd_registros = 0;
        ctrlRow.ultima_sincronizacao = new Date();
        totalProcessadas += 1;
        continue;
      }

      const editalInfo = resolveEditalInfo_(editaisMap, vaga);
      const elegibilidadeEd = evaluateEditalSyncEligibility_(editalInfo, { ignoreWindow: false });

      if (!elegibilidadeEd.eligible) {
        ctrlRow.status_sync = elegibilidadeEd.status;
        ctrlRow.mensagem = elegibilidadeEd.message;
        ctrlRow.ultima_sincronizacao = new Date();
        totalProcessadas += 1;
        continue;
      }

      try {
        const file = DriveApp.getFileById(planilhaId);
        const origemSS = SpreadsheetApp.openById(planilhaId);
        const origemSheet = origemSS.getSheetByName(CFG.ABA_ORIGEM_PADRAO) || getSheetByNormalizedName_(origemSS, CFG.ABA_ORIGEM_PADRAO);

        if (!origemSheet) {
          throw new Error('Aba "' + CFG.ABA_ORIGEM_PADRAO + '" não encontrada.');
        }

        const respInfo = resolveRespInfo_(respMap, vaga);
        const registros = extrairRegistrosOrigem_(origemSheet, vaga, respInfo, origemSS.getName(), planilhaId);
        const existingCount = Math.max(0, Number(fatoCountsByOrigemId[planilhaId] || 0));
        const replaceCheck = avaliarSubstituicaoSeguraOrigem_(registros, existingCount);

        if (!replaceCheck.ok) {
          ctrlRow.status_sync = 'ERRO';
          ctrlRow.mensagem = replaceCheck.message;
          ctrlRow.ultima_sincronizacao = new Date();
          logs.push(buildLogRow_(
            'ERRO',
            vaga.edital,
            vaga.codigo_vaga,
            origemSS.getName(),
            replaceCheck.message
          ));
          totalProcessadas += 1;
          continue;
        }

        idsParaSubstituir.push(planilhaId);
        if (registros.length) {
          novasLinhas.push.apply(novasLinhas, registros);
          totalRegistrosAtualizados += registros.length;
        }

        ctrlRow.grupo = normalizeGrupo_(vaga.grupo);
        ctrlRow.unidade = normalizeUnidade_(vaga.unidade);
        ctrlRow.edital = normalizeEdital_(vaga.edital);
        ctrlRow.codigo_vaga = cleanStr_(vaga.codigo_vaga);
        ctrlRow.planilha_origem_id = planilhaId;
        ctrlRow.nome_arquivo_origem = cleanStr_(origemSS.getName());
        ctrlRow.drive_ultima_atualizacao = file.getLastUpdated();
        ctrlRow.assinatura_contexto = buildSyncSignature_(vaga, respInfo);
        ctrlRow.ultima_sincronizacao = new Date();
        ctrlRow.qtd_registros = registros.length;
        ctrlRow.status_sync = 'SINCRONIZADO';
        ctrlRow.mensagem = registros.length
          ? ''
          : 'Origem sincronizada sem registros; nenhuma linha anterior precisou ser preservada.';
      } catch (err) {
        ctrlRow.status_sync = 'ERRO';
        ctrlRow.mensagem = cleanStr_(err && err.message ? err.message : err);
        ctrlRow.ultima_sincronizacao = new Date();
        logs.push(buildLogRow_(
          'ERRO',
          vaga ? vaga.edital : ctrlRow.edital,
          vaga ? vaga.codigo_vaga : ctrlRow.codigo_vaga,
          vaga ? vaga.nome_arquivo_origem : ctrlRow.nome_arquivo_origem,
          ctrlRow.mensagem
        ));
      }

      totalProcessadas += 1;
    }

    if (idsParaSubstituir.length) {
      deleteFatoRowsByOrigemIds_(targetFatoSheet, idsParaSubstituir);
    }
    if (novasLinhas.length) {
      appendFatoRows_(targetFatoSheet, novasLinhas);
    }

    sortCtrlSyncRows_(ctrlRows);
    writeCtrlSyncSheet_(ctrlSheet, ctrlRows);
    appendLogs_(logSheet, logs);

    const pendentesRestantes = ctrlRows.filter(function(row) {
      return isCtrlPendingStatus_(row.status_sync);
    }).length;
    const erroCount = countCtrlRowsByStatuses_(ctrlRows, ['ERRO']);
    const foraJanelaCount = countCtrlRowsByStatuses_(ctrlRows, ['FORA_JANELA']);

    props.setProperties({
      [CFG.PROP_SYNC_ACTIVE]: '1',
      [CFG.PROP_SYNC_TOTAL_PENDING]: String(totalPendentes),
      [CFG.PROP_SYNC_PROCESSED_SOURCES]: String(totalProcessadas),
      [CFG.PROP_SYNC_UPDATED_RECORDS]: String(totalRegistrosAtualizados),
      [CFG.PROP_SYNC_MODE]: syncMode,
      [CFG.PROP_SYNC_LAST_HEARTBEAT_AT]: new Date().toISOString()
    }, true);

    atualizarMetaPainel_(ssCentral, {
      last_run_status: pendentesRestantes ? 'RUNNING' : (erroCount ? 'ERROR' : 'SUCCESS'),
      last_run_mode: syncMode,
      last_run_heartbeat_at: new Date(),
      sources_processed: totalProcessadas,
      sources_pending: pendentesRestantes,
      sources_error: erroCount,
      sources_outside_window: foraJanelaCount,
      records_updated_current_run: totalRegistrosAtualizados
    });

    if (!pendentesRestantes) {
      let promoted = false;
      let blockedPromotion = false;

      if (syncMode === 'FULL') {
        if (erroCount > 0) {
          blockedPromotion = true;
          finalizeSafeFatoSheet_(targetFatoSheet);
          appendLogs_(logSheet, [buildLogRow_(
            'ERRO',
            '',
            '',
            CFG.ABA_FATO_STAGING,
            'Reconstrução completa concluída com erro(s); FATO_ANALISES preservada sem promoção da staging.'
          )]);
        } else {
          promoverStagingParaFato_(targetFatoSheet, fatoSheet);
          promoted = true;
        }
      } else {
        finalizarSincronizacaoAnalises_(fatoSheet);
        promoted = true;
      }

      limparEstadoSincronizacaoAnalises_();

      atualizarMetaPainel_(ssCentral, {
        last_run_status: blockedPromotion ? 'BLOCKED' : (erroCount ? 'PARTIAL' : 'SUCCESS'),
        last_run_mode: syncMode,
        last_run_finished_at: new Date(),
        last_success_at: (!blockedPromotion && promoted) ? new Date() : '',
        records_total_fato: getSheetDataRowCount_(fatoSheet),
        records_total_staging: getSheetDataRowCount_(targetFatoSheet),
        sources_processed: totalProcessadas,
        sources_error: erroCount,
        sources_outside_window: foraJanelaCount,
        contract_status: 'OK'
      });

      return {
        finished: true,
        processedTotal: totalProcessadas,
        recordsTotal: totalRegistrosAtualizados,
        totalVagas: totalPendentes,
        promoted: promoted,
        blockedPromotion: blockedPromotion,
        errorCount: erroCount
      };
    }

    agendarProximoLoteSincronizacaoAnalises_();
    return {
      finished: false,
      processedTotal: totalProcessadas,
      recordsTotal: totalRegistrosAtualizados,
      totalVagas: totalPendentes,
      promoted: false,
      blockedPromotion: false,
      errorCount: erroCount
    };
  } finally {
    lock.releaseLock();
  }
}


function prepararControleSincronizacao_(dimEditaisSheet, dimVagasSheet, ctrlSheet, respMap, forceFullRebuild) {
  const editaisMap = buildDimEditaisMap_(readObjects_(dimEditaisSheet));
  const vagas = readObjects_(dimVagasSheet);
  const ctrlRows = readObjects_(ctrlSheet);
  const ctrlMap = buildCtrlSyncMap_(ctrlRows);
  const ativos = {};
  const fileMetaCache = {};

  (vagas || []).forEach(function(vaga) {
    const planilhaId = cleanStr_(vaga.planilha_origem_id) || extractDriveId_(vaga.link_planilha_origem);
    const codigoVaga = cleanStr_(vaga.codigo_vaga);
    if (!planilhaId || !codigoVaga) return;

    ativos[planilhaId] = true;

    const respInfo = resolveRespInfo_(respMap, vaga);
    const assinatura = buildSyncSignature_(vaga, respInfo);
    const current = ctrlMap[planilhaId] || createCtrlSyncRow_(vaga, planilhaId);
    const assinaturaAnterior = cleanStr_(current.assinatura_contexto);
    const editalInfo = resolveEditalInfo_(editaisMap, vaga);
    const elegibilidadeEd = evaluateEditalSyncEligibility_(editalInfo, { ignoreWindow: forceFullRebuild });

    current.grupo = normalizeGrupo_(vaga.grupo);
    current.unidade = normalizeUnidade_(vaga.unidade);
    current.edital = normalizeEdital_(vaga.edital);
    current.codigo_vaga = codigoVaga;
    current.planilha_origem_id = planilhaId;

    try {
      const file = fileMetaCache[planilhaId] || DriveApp.getFileById(planilhaId);
      fileMetaCache[planilhaId] = file;
      current.nome_arquivo_origem = cleanStr_(vaga.nome_arquivo_origem) || cleanStr_(file.getName());
      const driveUpdated = file.getLastUpdated();
      const mudouDrive = normalizeDateTimeKey_(current.drive_ultima_atualizacao) !== normalizeDateTimeKey_(driveUpdated);
      const mudouContexto = assinaturaAnterior !== assinatura;
      const statusAtual = String(current.status_sync || '').toUpperCase();

      current.drive_ultima_atualizacao = driveUpdated;

      if (!elegibilidadeEd.eligible) {
        current.status_sync = elegibilidadeEd.status;
        current.mensagem = elegibilidadeEd.message;
      } else if (forceFullRebuild || mudouDrive || mudouContexto || statusAtual === 'ERRO' || statusAtual === 'ORFA' || statusAtual === 'PENDENTE' || statusAtual === 'FORA_JANELA') {
        current.status_sync = 'PENDENTE';
        current.mensagem = forceFullRebuild
          ? 'Reconstrução completa solicitada.'
          : (mudouContexto
              ? 'Contexto manual alterado desde a última sincronização.'
              : 'Origem alterada desde a última sincronização.');
      } else if (!current.status_sync) {
        current.status_sync = 'SINCRONIZADO';
      }
    } catch (err) {
      current.status_sync = 'ERRO';
      current.mensagem = 'Falha ao ler metadata da planilha de origem: ' + cleanStr_(err && err.message ? err.message : err);
    }

    current.assinatura_contexto = assinatura;
    ctrlMap[planilhaId] = current;
  });

  Object.keys(ctrlMap).forEach(function(planilhaId) {
    if (ativos[planilhaId]) return;
    const row = ctrlMap[planilhaId];
    row.status_sync = 'ORFA';
    row.mensagem = 'Origem não existe mais na DIM_VAGAS; registros antigos serão removidos da FATO.';
  });

  const mergedRows = Object.keys(ctrlMap).map(function(planilhaId) {
    return ctrlMap[planilhaId];
  });
  sortCtrlSyncRows_(mergedRows);
  writeCtrlSyncSheet_(ctrlSheet, mergedRows);

  return {
    pendingCount: mergedRows.filter(function(row) { return isCtrlPendingStatus_(row.status_sync); }).length,
    errorCount: countCtrlRowsByStatuses_(mergedRows, ['ERRO']),
    totalSources: mergedRows.length
  };
}

function createCtrlSyncRow_(vaga, planilhaId) {
  return {
    grupo: normalizeGrupo_(vaga.grupo),
    unidade: normalizeUnidade_(vaga.unidade),
    edital: normalizeEdital_(vaga.edital),
    codigo_vaga: cleanStr_(vaga.codigo_vaga),
    planilha_origem_id: cleanStr_(planilhaId),
    nome_arquivo_origem: cleanStr_(vaga.nome_arquivo_origem),
    drive_ultima_atualizacao: '',
    assinatura_contexto: '',
    ultima_sincronizacao: '',
    qtd_registros: '',
    status_sync: 'PENDENTE',
    mensagem: ''
  };
}

function buildCtrlSyncMap_(rows) {
  const map = {};
  (rows || []).forEach(function(row) {
    const id = cleanStr_(row.planilha_origem_id);
    if (!id) return;
    map[id] = row;
  });
  return map;
}

function writeCtrlSyncSheet_(sheet, rows) {
  const headers = CFG.CTRL_SYNC_HEADERS;
  const dataRows = (rows || []).map(function(row) {
    return headers.map(function(header) {
      return row[normalizarCabecalhoAB_(header)] != null ? row[normalizarCabecalhoAB_(header)] : row[header];
    });
  });

  resetSheetWithHeaders_(sheet, headers);

  if (dataRows.length) {
    writeRowsInChunks_(sheet, 2, 1, dataRows, headers.length, getWriteChunkRows_());
  }

  const idxDrive = headers.indexOf('drive_ultima_atualizacao');
  if (idxDrive !== -1 && dataRows.length) {
    sheet.getRange(2, idxDrive + 1, dataRows.length, 1).setNumberFormat('dd/MM/yyyy HH:mm:ss');
  }

  const idxSync = headers.indexOf('ultima_sincronizacao');
  if (idxSync !== -1 && dataRows.length) {
    sheet.getRange(2, idxSync + 1, dataRows.length, 1).setNumberFormat('dd/MM/yyyy HH:mm:ss');
  }
}

function sortCtrlSyncRows_(rows) {
  (rows || []).sort(function(a, b) {
    const grupoCmp = String(a.grupo || '').localeCompare(String(b.grupo || ''), 'pt-BR', { numeric: true });
    if (grupoCmp !== 0) return grupoCmp;

    const unidadeCmp = String(a.unidade || '').localeCompare(String(b.unidade || ''), 'pt-BR', { numeric: true });
    if (unidadeCmp !== 0) return unidadeCmp;

    const editalCmp = String(a.edital || '').localeCompare(String(b.edital || ''), 'pt-BR', { numeric: true });
    if (editalCmp !== 0) return editalCmp;

    return String(a.codigo_vaga || '').localeCompare(String(b.codigo_vaga || ''), 'pt-BR', { numeric: true });
  });
}

function isCtrlPendingStatus_(status) {
  const s = String(status || '').toUpperCase();
  return s === 'PENDENTE' || s === 'ORFA';
}

function buildSyncSignature_(vaga, respInfo) {
  return [
    normalizeGrupo_(vaga.grupo),
    normalizeUnidade_(vaga.unidade),
    normalizeEdital_(vaga.edital),
    cleanStr_(vaga.codigo_vaga),
    cleanStr_(vaga.nome_vaga),
    cleanStr_(vaga.regime),
    cleanStr_(vaga.carga_horaria),
    cleanStr_(vaga.categoria),
    cleanStr_(respInfo && respInfo.responsavel_analise),
    cleanStr_(respInfo && respInfo.coord_demandante),
    cleanStr_(respInfo && respInfo.email_demandante)
  ].join('|');
}

function normalizeDateTimeKey_(value) {
  if (!value) return '';
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  }

  const s = cleanStr_(value);
  if (!s) return '';

  const brMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (brMatch) {
    const dtBr = new Date(
      Number(brMatch[3]),
      Number(brMatch[2]) - 1,
      Number(brMatch[1]),
      Number(brMatch[4] || 0),
      Number(brMatch[5] || 0),
      Number(brMatch[6] || 0)
    );
    if (!isNaN(dtBr.getTime())) {
      return Utilities.formatDate(dtBr, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    }
  }

  const dt = new Date(s);
  if (!isNaN(dt.getTime())) {
    return Utilities.formatDate(dt, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  }
  return s;
}


function recalcularStatusConsolidadoFato() {
  const lock = acquireScriptLockOrThrow_('Recalculo do status_consolidado', 30000);

  try {
    const props = PropertiesService.getScriptProperties();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const fatoSheet = getSheetOrThrow_(ss, CFG.ABA_FATO);
    const headerInfo = detectarCabecalhoFatoPorColunas_(fatoSheet, ['etapa', 'analise', 'status_consolidado'], 20);

    const lastRow = fatoSheet.getLastRow();
    const totalRows = Math.max(0, lastRow - headerInfo.headerRow);

    limparGatilhosRecalculoStatusFato_();
    props.deleteProperty(CFG.PROP_RECLASS_STATUS_ACTIVE);
    props.deleteProperty(CFG.PROP_RECLASS_STATUS_NEXT_ROW);
    props.deleteProperty(CFG.PROP_RECLASS_STATUS_TOTAL_ROWS);

    if (totalRows <= 0) {
      atualizarMetaPainel_(ss, {
        last_status_recalc_status: 'NO_ROWS',
        last_status_recalc_finished_at: new Date()
      });
      safeAlert_('A FATO_ANALISES não possui linhas para recalcular.');
      return { finished: true, processedRows: 0, totalRows: 0 };
    }

    props.setProperties({
      [CFG.PROP_RECLASS_STATUS_ACTIVE]: '1',
      [CFG.PROP_RECLASS_STATUS_NEXT_ROW]: '2',
      [CFG.PROP_RECLASS_STATUS_TOTAL_ROWS]: String(totalRows)
    }, true);

    atualizarMetaPainel_(ss, {
      last_status_recalc_status: 'RUNNING',
      last_status_recalc_started_at: new Date(),
      last_status_recalc_total_rows: totalRows
    });
  } finally {
    lock.releaseLock();
  }

  const result = processarLoteRecalculoStatusFato_();
  safeAlert_(result.finished
    ? 'Recalculo do status_consolidado concluido.\n\nLinhas processadas: ' + result.processedRows + ' de ' + result.totalRows
    : 'Recalculo do status_consolidado iniciado em lotes.\n\nLinhas processadas: ' + result.processedRows + ' de ' + result.totalRows + '\n\nO script continuara automaticamente ate concluir.'
  );
  return result;
}

function continuarRecalculoStatusFato_() {
  return processarLoteRecalculoStatusFato_();
}

function processarLoteRecalculoStatusFato_() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    return { finished: false, busy: true, processedRows: 0, totalRows: 0 };
  }

  try {
    const props = PropertiesService.getScriptProperties();
    if (props.getProperty(CFG.PROP_RECLASS_STATUS_ACTIVE) !== '1') {
      return { finished: true, processedRows: 0, totalRows: 0 };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const fatoSheet = getSheetOrThrow_(ss, CFG.ABA_FATO);
    const lastRow = fatoSheet.getLastRow();
    const headerInfo = detectarCabecalhoFatoPorColunas_(fatoSheet, ['etapa', 'analise', 'status_consolidado'], 20);
    const dataStartRow = headerInfo.headerRow + 1;
    const totalRows = Math.max(0, Number(props.getProperty(CFG.PROP_RECLASS_STATUS_TOTAL_ROWS) || (lastRow - headerInfo.headerRow)));
    let nextRow = Math.max(dataStartRow, Number(props.getProperty(CFG.PROP_RECLASS_STATUS_NEXT_ROW) || dataStartRow));

    const headersNorm = headerInfo.headersNorm;
    const etapaCol = getHeaderColumn_(headersNorm, 'etapa');
    const analiseCol = getHeaderColumn_(headersNorm, 'analise');
    const statusCol = getHeaderColumn_(headersNorm, 'status_consolidado');

    if (!etapaCol || !analiseCol || !statusCol) {
      limparEstadoRecalculoStatusFato_();
      throw new Error('A FATO_ANALISES precisa conter as colunas etapa, analise e status_consolidado para recalcular status. Cabeçalhos encontrados na linha ' + headerInfo.headerRow + ': ' + headerInfo.headersRaw.join(' | '));
    }

    const startedAt = Date.now();
    const chunkSize = Math.max(100, Number(CFG.RECLASS_STATUS_CHUNK_ROWS || 1200));
    let processedThisRun = 0;

    while (nextRow <= lastRow) {
      if (processedThisRun > 0 && (Date.now() - startedAt) >= CFG.RECLASS_STATUS_MAX_RUNTIME_MS) break;

      const count = Math.min(chunkSize, lastRow - nextRow + 1);
      const etapaValues = fatoSheet.getRange(nextRow, etapaCol, count, 1).getDisplayValues();
      const analiseValues = fatoSheet.getRange(nextRow, analiseCol, count, 1).getDisplayValues();
      const statusValues = [];

      for (let i = 0; i < count; i++) {
        statusValues.push([derivarStatusConsolidado_(etapaValues[i][0], analiseValues[i][0])]);
      }

      fatoSheet.getRange(nextRow, statusCol, count, 1).setValues(statusValues);
      nextRow += count;
      processedThisRun += count;
    }

    const processedTotal = Math.max(0, Math.min(totalRows, nextRow - dataStartRow));

    if (nextRow <= lastRow) {
      props.setProperty(CFG.PROP_RECLASS_STATUS_NEXT_ROW, String(nextRow));
      agendarProximoLoteRecalculoStatusFato_();
      atualizarMetaPainel_(ss, {
        last_status_recalc_status: 'RUNNING',
        last_status_recalc_heartbeat_at: new Date(),
        last_status_recalc_processed_rows: processedTotal,
        last_status_recalc_total_rows: totalRows
      });
      return { finished: false, processedRows: processedTotal, totalRows: totalRows };
    }

    limparEstadoRecalculoStatusFato_();
    atualizarMetaPainel_(ss, {
      last_status_recalc_status: 'SUCCESS',
      last_status_recalc_finished_at: new Date(),
      last_status_recalc_processed_rows: processedTotal,
      last_status_recalc_total_rows: totalRows
    });
    return { finished: true, processedRows: processedTotal, totalRows: totalRows };
  } finally {
    lock.releaseLock();
  }
}

function agendarProximoLoteRecalculoStatusFato_() {
  const triggers = ScriptApp.getProjectTriggers().filter(function(trigger) {
    return trigger.getHandlerFunction() === CFG.RECLASS_STATUS_TRIGGER_HANDLER;
  });
  if (triggers.length) return;

  ScriptApp.newTrigger(CFG.RECLASS_STATUS_TRIGGER_HANDLER)
    .timeBased()
    .after(CFG.SYNC_TRIGGER_DELAY_MS)
    .create();
}

function limparGatilhosRecalculoStatusFato_() {
  return limparTriggersPorPredicado_(function(trigger) {
    return trigger.getHandlerFunction() === CFG.RECLASS_STATUS_TRIGGER_HANDLER;
  });
}

function limparEstadoRecalculoStatusFato_() {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty(CFG.PROP_RECLASS_STATUS_ACTIVE);
  props.deleteProperty(CFG.PROP_RECLASS_STATUS_NEXT_ROW);
  props.deleteProperty(CFG.PROP_RECLASS_STATUS_TOTAL_ROWS);
  limparGatilhosRecalculoStatusFato_();
}


function detectarCabecalhoFatoPorColunas_(sheet, requiredHeaders, maxRowsToScan) {
  return detectarCabecalhoPorColunas_(sheet, requiredHeaders, maxRowsToScan, true);
}

function detectarCabecalhoFatoPorAlgumaColuna_(sheet, candidateHeaders, maxRowsToScan) {
  return detectarCabecalhoPorColunas_(sheet, candidateHeaders, maxRowsToScan, false);
}

function detectarCabecalhoPorColunas_(sheet, headers, maxRowsToScan, exigirTodos) {
  const lastRow = Math.max(1, sheet.getLastRow());
  const lastCol = Math.max(1, sheet.getLastColumn());
  const rowsToScan = Math.min(Math.max(1, maxRowsToScan || 10), lastRow);
  const values = sheet.getRange(1, 1, rowsToScan, lastCol).getValues();
  const wanted = (headers || []).map(normalizarCabecalhoAB_).filter(Boolean);

  for (let r = 0; r < values.length; r++) {
    const headersRaw = values[r].map(function(v) { return cleanStr_(v); });
    const headersNorm = headersRaw.map(normalizarCabecalhoAB_);
    const matches = wanted.filter(function(h) { return headersNorm.indexOf(h) !== -1; }).length;
    if ((exigirTodos && matches === wanted.length) || (!exigirTodos && matches > 0)) {
      return { headerRow: r + 1, headersRaw: headersRaw, headersNorm: headersNorm, lastCol: lastCol };
    }
  }

  const firstRaw = values.length ? values[0].map(function(v) { return cleanStr_(v); }) : [];
  throw new Error('Não localizei cabeçalho válido na aba "' + sheet.getName() + '". Procurado: ' + wanted.join(', ') + '. Primeira linha encontrada: ' + firstRaw.join(' | '));
}

function getHeaderColumn_(headersNorm, header) {
  const normalized = normalizarCabecalhoAB_(header);
  return headersNorm.indexOf(normalized) + 1;
}

function recalcularNotasPontuacoesFato() {
  const lock = acquireScriptLockOrThrow_('Recalculo de notas e pontuacoes da FATO', 30000);

  try {
    const props = PropertiesService.getScriptProperties();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const fatoSheet = getSheetOrThrow_(ss, CFG.ABA_FATO);
    const headerInfo = detectarCabecalhoFatoPorAlgumaColuna_(fatoSheet, FATO_SCORE_HEADERS, 20);
    aplicarFormatosFatoNovoContrato_(fatoSheet);

    const lastRow = fatoSheet.getLastRow();
    const totalRows = Math.max(0, lastRow - headerInfo.headerRow);

    limparGatilhosRecalculoNotasPontuacoesFato_();
    props.deleteProperty(CFG.PROP_REPAIR_SCORE_ACTIVE);
    props.deleteProperty(CFG.PROP_REPAIR_SCORE_NEXT_ROW);
    props.deleteProperty(CFG.PROP_REPAIR_SCORE_TOTAL_ROWS);

    if (totalRows <= 0) {
      atualizarMetaPainel_(ss, {
        last_score_recalc_status: 'NO_ROWS',
        last_score_recalc_finished_at: new Date()
      });
      safeAlert_('A FATO_ANALISES não possui linhas para recalcular notas/pontuações.');
      return { finished: true, processedRows: 0, totalRows: 0 };
    }

    props.setProperties({
      [CFG.PROP_REPAIR_SCORE_ACTIVE]: '1',
      [CFG.PROP_REPAIR_SCORE_NEXT_ROW]: '2',
      [CFG.PROP_REPAIR_SCORE_TOTAL_ROWS]: String(totalRows)
    }, true);

    atualizarMetaPainel_(ss, {
      last_score_recalc_status: 'RUNNING',
      last_score_recalc_started_at: new Date(),
      last_score_recalc_total_rows: totalRows
    });
  } finally {
    lock.releaseLock();
  }

  const result = processarLoteRecalculoNotasPontuacoesFato_();
  safeAlert_(result.finished
    ? 'Recalculo de notas/pontuações concluído.\n\nLinhas processadas: ' + result.processedRows + ' de ' + result.totalRows
    : 'Recalculo de notas/pontuações iniciado em lotes.\n\nLinhas processadas: ' + result.processedRows + ' de ' + result.totalRows + '\n\nO script continuará automaticamente até concluir.'
  );
  return result;
}

function continuarRecalculoNotasPontuacoesFato_() {
  return processarLoteRecalculoNotasPontuacoesFato_();
}

function processarLoteRecalculoNotasPontuacoesFato_() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    return { finished: false, busy: true, processedRows: 0, totalRows: 0 };
  }

  try {
    const props = PropertiesService.getScriptProperties();
    if (props.getProperty(CFG.PROP_REPAIR_SCORE_ACTIVE) !== '1') {
      return { finished: true, processedRows: 0, totalRows: 0 };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const fatoSheet = getSheetOrThrow_(ss, CFG.ABA_FATO);
    aplicarFormatosFatoNovoContrato_(fatoSheet);

    const lastRow = fatoSheet.getLastRow();
    const headerInfo = detectarCabecalhoFatoPorAlgumaColuna_(fatoSheet, FATO_SCORE_HEADERS, 20);
    const dataStartRow = headerInfo.headerRow + 1;
    const totalRows = Math.max(0, Number(props.getProperty(CFG.PROP_REPAIR_SCORE_TOTAL_ROWS) || (lastRow - headerInfo.headerRow)));
    let nextRow = Math.max(dataStartRow, Number(props.getProperty(CFG.PROP_REPAIR_SCORE_NEXT_ROW) || dataStartRow));

    const headersNorm = headerInfo.headersNorm;
    const scoreCols = FATO_SCORE_HEADERS
      .map(function(header) { return { header: header, col: getHeaderColumn_(headersNorm, header) }; })
      .filter(function(item) { return item.col > 0; });

    if (!scoreCols.length) {
      limparEstadoRecalculoNotasPontuacoesFato_();
      throw new Error('A FATO_ANALISES não possui colunas de nota/pontuação para recalcular.');
    }

    const startedAt = Date.now();
    const chunkSize = Math.max(100, Number(CFG.REPAIR_SCORE_CHUNK_ROWS || 1200));
    let processedThisRun = 0;

    while (nextRow <= lastRow) {
      if (processedThisRun > 0 && (Date.now() - startedAt) >= CFG.REPAIR_SCORE_MAX_RUNTIME_MS) break;

      const count = Math.min(chunkSize, lastRow - nextRow + 1);

      scoreCols.forEach(function(item) {
        const sourceRange = fatoSheet.getRange(nextRow, item.col, count, 1);
        const rawValues = sourceRange.getValues();
        const repaired = rawValues.map(function(row) {
          return [normalizeScoreText_(row[0])];
        });
        const targetRange = fatoSheet.getRange(nextRow, item.col, count, 1);
        targetRange.setNumberFormat('0.###');
        targetRange.setValues(repaired);
      });

      nextRow += count;
      processedThisRun += count;
    }

    const processedTotal = Math.max(0, Math.min(totalRows, nextRow - dataStartRow));

    if (nextRow <= lastRow) {
      props.setProperty(CFG.PROP_REPAIR_SCORE_NEXT_ROW, String(nextRow));
      agendarProximoLoteRecalculoNotasPontuacoesFato_();
      atualizarMetaPainel_(ss, {
        last_score_recalc_status: 'RUNNING',
        last_score_recalc_heartbeat_at: new Date(),
        last_score_recalc_processed_rows: processedTotal,
        last_score_recalc_total_rows: totalRows
      });
      return { finished: false, processedRows: processedTotal, totalRows: totalRows };
    }

    limparEstadoRecalculoNotasPontuacoesFato_();
    atualizarMetaPainel_(ss, {
      last_score_recalc_status: 'SUCCESS',
      last_score_recalc_finished_at: new Date(),
      last_score_recalc_processed_rows: processedTotal,
      last_score_recalc_total_rows: totalRows
    });
    return { finished: true, processedRows: processedTotal, totalRows: totalRows };
  } finally {
    lock.releaseLock();
  }
}

function agendarProximoLoteRecalculoNotasPontuacoesFato_() {
  const triggers = ScriptApp.getProjectTriggers().filter(function(trigger) {
    return trigger.getHandlerFunction() === CFG.REPAIR_SCORE_TRIGGER_HANDLER;
  });
  if (triggers.length) return;

  ScriptApp.newTrigger(CFG.REPAIR_SCORE_TRIGGER_HANDLER)
    .timeBased()
    .after(CFG.SYNC_TRIGGER_DELAY_MS)
    .create();
}

function limparGatilhosRecalculoNotasPontuacoesFato_() {
  return limparTriggersPorPredicado_(function(trigger) {
    return trigger.getHandlerFunction() === CFG.REPAIR_SCORE_TRIGGER_HANDLER;
  });
}

function limparEstadoRecalculoNotasPontuacoesFato_() {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty(CFG.PROP_REPAIR_SCORE_ACTIVE);
  props.deleteProperty(CFG.PROP_REPAIR_SCORE_NEXT_ROW);
  props.deleteProperty(CFG.PROP_REPAIR_SCORE_TOTAL_ROWS);
  limparGatilhosRecalculoNotasPontuacoesFato_();
}

function buildDimVagasByPlanilhaIdMap_(rows) {
  const map = {};
  (rows || []).forEach(function(row) {
    const planilhaId = cleanStr_(row.planilha_origem_id) || extractDriveId_(row.link_planilha_origem);
    if (!planilhaId) return;
    map[planilhaId] = row;
  });
  return map;
}

function deleteFatoRowsByOrigemIds_(sheet, origemIds) {
  const ids = {};
  (origemIds || []).forEach(function(id) {
    const cleanId = cleanStr_(id);
    if (cleanId) ids[cleanId] = true;
  });

  const keys = Object.keys(ids);
  if (!keys.length) return 0;

  const colIndex = CFG.FATO_HEADERS.indexOf('origem_arquivo_id') + 1;
  const lastRow = sheet.getLastRow();
  const totalCols = CFG.FATO_HEADERS.length;

  if (colIndex < 1 || lastRow < 2) return 0;

  const values = sheet.getRange(2, colIndex, lastRow - 1, 1).getDisplayValues();
  const rowsToDelete = [];

  values.forEach(function(row, idx) {
    const origemId = cleanStr_(row[0]);
    if (ids[origemId]) {
      rowsToDelete.push(idx + 2);
    }
  });

  if (!rowsToDelete.length) return 0;

  const totalDataRows = lastRow - 1;

  // Proteção operacional:
  // O Google Sheets pode bloquear deleteRows() quando a exclusão física
  // removeria todas as linhas não congeladas/linhas de dados da aba.
  // Nesse cenário, limpamos o conteúdo das linhas de dados e preservamos
  // a estrutura da planilha para que appendFatoRows_() insira a nova base.
  if (rowsToDelete.length >= totalDataRows) {
    removeFilterSafe_(sheet);
    sheet.getRange(2, 1, totalDataRows, totalCols).clearContent();
    sheet.getRange(1, 1, 1, totalCols).setValues([CFG.FATO_HEADERS]);
    return rowsToDelete.length;
  }

  const blocks = [];
  let start = rowsToDelete[0];
  let prev = rowsToDelete[0];

  for (let i = 1; i < rowsToDelete.length; i++) {
    const current = rowsToDelete[i];
    if (current === prev + 1) {
      prev = current;
      continue;
    }
    blocks.push({ start: start, count: prev - start + 1 });
    start = current;
    prev = current;
  }
  blocks.push({ start: start, count: prev - start + 1 });

  blocks.reverse().forEach(function(block) {
    sheet.deleteRows(block.start, block.count);
  });

  return rowsToDelete.length;
}

function prepararFatoParaNovaSincronizacao_(sheet) {
  const headers = CFG.FATO_HEADERS;
  resetSheetWithHeaders_(sheet, headers);
  aplicarFormatoTextoColunas_(sheet, [1, 2, 3, 4, 10]);
  aplicarFormatosFatoNovoContrato_(sheet);
}

function finalizeSafeFatoSheet_(sheet) {
  if (!sheet) return;
  finalizarSincronizacaoAnalises_(sheet);
}

function appendFatoRows_(sheet, linhas) {
  if (!linhas || !linhas.length) return;

  aplicarFormatosFatoNovoContrato_(sheet);
  const headers = CFG.FATO_HEADERS;
  const startRow = Math.max(sheet.getLastRow(), 1) + 1;
  writeRowsInChunks_(sheet, startRow, 1, linhas, headers.length, getWriteChunkRows_());

  const idxUltima = headers.indexOf('ultima_atualizacao');
  if (idxUltima !== -1) {
    sheet.getRange(startRow, idxUltima + 1, linhas.length, 1).setNumberFormat('dd/MM/yyyy HH:mm:ss');
  }
}

function finalizarSincronizacaoAnalises_(sheet) {
  const totalRows = Math.max(sheet.getLastRow(), 1);
  const totalCols = CFG.FATO_HEADERS.length;
  createFilterSafe_(sheet, totalRows, totalCols);
}

function getManagedTriggerHandlers_() {
  return [CFG.MAIN_SYNC_TRIGGER_HANDLER, CFG.CONTINUATION_SYNC_TRIGGER_HANDLER, CFG.RECLASS_STATUS_TRIGGER_HANDLER, CFG.REPAIR_SCORE_TRIGGER_HANDLER];
}

function isManagedTrigger_(trigger) {
  return getManagedTriggerHandlers_().indexOf(trigger.getHandlerFunction()) !== -1;
}

function isMainSyncTrigger_(trigger) {
  return trigger.getHandlerFunction() === CFG.MAIN_SYNC_TRIGGER_HANDLER;
}

function isContinuationSyncTrigger_(trigger) {
  return trigger.getHandlerFunction() === CFG.CONTINUATION_SYNC_TRIGGER_HANDLER;
}

function limparTriggersPorPredicado_(predicate) {
  let removidos = 0;
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (!predicate(trigger)) return;
    ScriptApp.deleteTrigger(trigger);
    removidos += 1;
  });
  return removidos;
}

function limparGatilhosPrincipais_() {
  return limparTriggersPorPredicado_(isMainSyncTrigger_);
}

function limparGatilhosGerenciados_() {
  return limparTriggersPorPredicado_(isManagedTrigger_);
}

function garantirGatilhoPrincipal_() {
  const jaExiste = ScriptApp.getProjectTriggers().some(isMainSyncTrigger_);
  if (jaExiste) return false;

  ScriptApp.newTrigger(CFG.MAIN_SYNC_TRIGGER_HANDLER)
    .timeBased()
    .everyMinutes(CFG.MAIN_SYNC_TRIGGER_CHECK_EVERY_MINUTES)
    .create();

  return true;
}

function atualizarDimVagasESincronizarAgendado() {
  if (!deveExecutarJanela20Min_()) return;
  return atualizarDimVagasESincronizar();
}

function deveExecutarJanela20Min_() {
  const lock = acquireScriptLockOrThrow_('Controle da janela do gatilho principal', 30000);

  try {
    const props = PropertiesService.getScriptProperties();
    const agora = Date.now();
    const ultimo = Number(props.getProperty(CFG.PROP_LAST_MAIN_SCHEDULED_RUN_AT) || 0);
    const intervaloMs = CFG.MAIN_SYNC_TRIGGER_EVERY_MINUTES * 60 * 1000;

    if (ultimo && (agora - ultimo) < intervaloMs) {
      return false;
    }

    props.setProperty(CFG.PROP_LAST_MAIN_SCHEDULED_RUN_AT, String(agora));
    return true;
  } finally {
    lock.releaseLock();
  }
}

function agendarProximoLoteSincronizacaoAnalises_() {
  const triggers = ScriptApp.getProjectTriggers().filter(isContinuationSyncTrigger_);
  if (triggers.length) return;

  ScriptApp.newTrigger(CFG.CONTINUATION_SYNC_TRIGGER_HANDLER)
    .timeBased()
    .after(CFG.SYNC_TRIGGER_DELAY_MS)
    .create();
}

function limparGatilhosSincronizacaoAnalises_() {
  return limparTriggersPorPredicado_(isContinuationSyncTrigger_);
}

function limparEstadoSincronizacaoAnalises_() {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty(CFG.PROP_SYNC_ACTIVE);
  props.deleteProperty(CFG.PROP_SYNC_TOTAL_PENDING);
  props.deleteProperty(CFG.PROP_SYNC_PROCESSED_SOURCES);
  props.deleteProperty(CFG.PROP_SYNC_UPDATED_RECORDS);
  props.deleteProperty(CFG.PROP_SYNC_MODE);
  props.deleteProperty(CFG.PROP_SYNC_STARTED_AT);
  props.deleteProperty(CFG.PROP_SYNC_LAST_HEARTBEAT_AT);
  limparGatilhosSincronizacaoAnalises_();
}

function cancelarSincronizacaoAnalises() {
  const lock = acquireScriptLockOrThrow_('Cancelamento da sincronização', 30000);
  try {
    limparEstadoSincronizacaoAnalises_();
    atualizarMetaPainel_(SpreadsheetApp.getActiveSpreadsheet(), {
      last_run_status: 'CANCELLED',
      last_run_finished_at: new Date(),
      contract_status: 'OK'
    });
  } finally {
    lock.releaseLock();
  }

  safeAlert_('Sincronização em andamento cancelada.');
}


function extrairRegistrosOrigem_(sheet, vaga, respInfo, nomeArquivoOrigem, planilhaId) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];

  const values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  if (!values || values.length < 2) return [];

  const headerRowIndex = detectarLinhaCabecalho_(values);
  const headers = values[headerRowIndex].map(normalizarCabecalhoAB_);
  const idx = buildHeaderIndex_(headers);
  validarCabecalhoOrigemMinimo_(idx);

  const rows = values.slice(headerRowIndex + 1);
  const agora = new Date();
  const saida = [];

  rows.forEach(function(row) {
    const fatoRow = buildFatoRowFromOrigem_(row, idx, vaga, respInfo, nomeArquivoOrigem, planilhaId, agora);
    if (fatoRow) {
      saida.push(fatoRow);
    }
  });

  return saida;
}


function detectarLinhaCabecalho_(values) {
  const limite = Math.min(values.length, CFG.HEADER_SCAN_LIMIT);

  for (let i = 0; i < limite; i++) {
    const normalizedRow = values[i].map(normalizarCabecalhoAB_);
    const idx = buildHeaderIndex_(normalizedRow);

    if (
      hasAnyHeaderAlias_(idx, SOURCE_HEADER_ALIASES.candidato) &&
      hasAnyHeaderAlias_(idx, SOURCE_HEADER_ALIASES.id) &&
      hasAnyHeaderAlias_(idx, SOURCE_HEADER_ALIASES.etapa)
    ) {
      return i;
    }
  }

  return 0;
}

function derivarStatusConsolidado_(etapa, analise) {
  const etapaN = normalizarCabecalhoAB_(etapa);
  const temAnaliseSuficiente = hasAnaliseSuficienteParaStatus_(analise);

  if (!etapaN) {
    return temAnaliseSuficiente ? 'Revisar' : 'Pendente';
  }

  const isEtapaReprovada =
    etapaN.includes('reprovado') ||
    etapaN.includes('reprovada') ||
    etapaN.includes('inabilitado') ||
    etapaN.includes('inabilitada') ||
    etapaN.includes('eliminado') ||
    etapaN.includes('eliminada') ||
    etapaN.includes('indeferido') ||
    etapaN.includes('indeferida') ||
    etapaN.includes('nao habilitado') ||
    etapaN.includes('nao habilitada');

  const isEtapaTriada = etapaN.includes('triado') || etapaN.includes('triados') || etapaN.includes('triada') || etapaN.includes('triadas');

  const isEtapaAprovada =
    etapaN.includes('aprovado') ||
    etapaN.includes('aprovada') ||
    etapaN.includes('habilitado') ||
    etapaN.includes('habilitada') ||
    etapaN.includes('classificado') ||
    etapaN.includes('classificada') ||
    etapaN.includes('deferido') ||
    etapaN.includes('deferida') ||
    etapaN === 'apto' ||
    etapaN === 'apta';

  if (isEtapaReprovada) {
    return temAnaliseSuficiente ? 'Reprovado' : 'Revisar';
  }

  if (isEtapaTriada || isEtapaAprovada) {
    return temAnaliseSuficiente ? 'Aprovado' : 'Revisar';
  }

  return 'Revisar';
}

function hasAnaliseSuficienteParaStatus_(analise) {
  const raw = cleanStr_(analise);
  const n = normalizarCabecalhoAB_(raw);

  if (!n) return false;

  const placeholders = {
    '-': true,
    '--': true,
    '.': true,
    'na': true,
    'n a': true,
    'n d': true,
    'ok': true,
    'sim': true,
    'nao': true,
    'não': true,
    'sem analise': true,
    'sem análise': true,
    'sem observacao': true,
    'sem observação': true,
    'nao se aplica': true,
    'não se aplica': true,
    'nada consta': true
  };

  if (placeholders[n] || placeholders[raw]) return false;

  // A coluna ANÁLISE não é interpretada por teor positivo/negativo.
  // Ela apenas comprova que há justificativa registrada para consolidar a ETAPA.
  return n.length >= 8;
}

function escreverFato_(sheet, linhas) {
  const headers = CFG.FATO_HEADERS;
  const totalCols = headers.length;
  const totalRows = Math.max(1, linhas.length + 1);

  resetSheetWithHeaders_(sheet, headers);

  if (linhas.length) {
    writeRowsInChunks_(sheet, 2, 1, linhas, totalCols, getWriteChunkRows_());
  }

  aplicarFormatoTextoColunas_(sheet, [1, 2, 3, 4]);

  const idxUltima = headers.indexOf('ultima_atualizacao');
  if (idxUltima !== -1 && linhas.length) {
    sheet.getRange(2, idxUltima + 1, linhas.length, 1).setNumberFormat('dd/MM/yyyy HH:mm:ss');
  }

  createFilterSafe_(sheet, totalRows, totalCols);
}

function criarGatilhoVinteMinutos() {
  const removidos = limparGatilhosPrincipais_();
  PropertiesService.getScriptProperties().deleteProperty(CFG.PROP_LAST_MAIN_SCHEDULED_RUN_AT);
  garantirGatilhoPrincipal_();

  safeAlert_(
    'Gatilho criado. O verificador roda a cada ' + CFG.MAIN_SYNC_TRIGGER_CHECK_EVERY_MINUTES +
      ' minutos, mas a sincronização efetiva só ocorre a cada ' + CFG.MAIN_SYNC_TRIGGER_EVERY_MINUTES +
      ' minutos. Gatilhos principais antigos removidos: ' + removidos + '.'
  );
}

function removerGatilhosProjeto() {
  const removidos = limparGatilhosGerenciados_();
  PropertiesService.getScriptProperties().deleteProperty(CFG.PROP_LAST_MAIN_SCHEDULED_RUN_AT);
  safeAlert_('Gatilhos gerenciados removidos: ' + removidos + '.');
}

function isEditalAtivo_(row) {
  return CFG.ACTIVE_VALUES.indexOf(normalizeBooleanText_(row.ativo)) !== -1;
}

function isEditalElegivelParaAtualizacao_(row, options) {
  return evaluateEditalSyncEligibility_(row, options).eligible;
}

function evaluateEditalSyncEligibility_(row, options) {
  const opts = options || {};
  if (!row || !isEditalAtivo_(row)) {
    return {
      eligible: false,
      status: 'INATIVO',
      message: 'Edital inativo; origem preservada sem nova sincronização.'
    };
  }

  if (opts.ignoreWindow) {
    return { eligible: true, status: 'ELEGIVEL', message: '' };
  }

  const inicio = parseDataSemHoraAB_(row.data_inicio_analise);
  const fim = parseDataSemHoraAB_(row.data_fim_analise);
  const hoje = hojeSemHoraAB_();

  if (inicio && hoje.getTime() < inicio.getTime()) {
    return {
      eligible: false,
      status: 'FORA_JANELA',
      message: 'Fora da janela de análise: início previsto em ' + formatarDataPtBrAB_(inicio) + '.'
    };
  }

  if (fim && hoje.getTime() > fim.getTime()) {
    return {
      eligible: false,
      status: 'FORA_JANELA',
      message: 'Fora da janela de análise: encerrado em ' + formatarDataPtBrAB_(fim) + '.'
    };
  }

  return { eligible: true, status: 'ELEGIVEL', message: '' };
}

function parseVagaFromFileName_(fileName) {
  const original = cleanStr_(fileName).replace(/\.[^.]+$/, '');
  const codigoMatch = original.match(/\b(\d{4,})\b/);
  const codigoVaga = codigoMatch ? codigoMatch[1] : '';

  if (!codigoVaga) {
    return {
      codigo_vaga: '',
      nome_vaga: '',
      regime: '',
      carga_horaria: '',
      categoria: ''
    };
  }

  let tail = original
    .replace(/^\[[^\]]+\]\s*/i, '')
    .replace(/^vaga\s+/i, '')
    .replace(new RegExp('^.*?\\b' + codigoVaga + '\\b\\s*-\\s*', 'i'), '')
    .trim();

  const parts = tail.split(' - ').map(function(p) { return cleanStr_(p); }).filter(Boolean);
  if (!parts.length) {
    return {
      codigo_vaga: codigoVaga,
      nome_vaga: '',
      regime: '',
      carga_horaria: '',
      categoria: ''
    };
  }

  // Novo padrão: [CD] Vaga 155520 - Psicólogo - Ampla concorrência - Polo Base ...
  // A modalidade de concorrência vem logo após o cargo; o restante é contexto/local.
  const categoriaConcorrenciaIdx = parts.findIndex(function(p) {
    return isCategoriaConcorrenciaToken_(p);
  });

  if (categoriaConcorrenciaIdx !== -1) {
    return {
      codigo_vaga: codigoVaga,
      nome_vaga: parts.slice(0, categoriaConcorrenciaIdx).join(' - ').trim(),
      regime: '',
      carga_horaria: '',
      categoria: normalizeCategoriaConcorrencia_(parts[categoriaConcorrenciaIdx])
    };
  }

  let regimeIdx = -1;
  let cargaIdx = -1;

  for (let i = 0; i < parts.length; i++) {
    if (regimeIdx === -1 && isRegimeToken_(parts[i])) regimeIdx = i;
    if (cargaIdx === -1 && isCargaHorariaToken_(parts[i])) cargaIdx = i;
  }

  if (regimeIdx !== -1 && cargaIdx !== -1 && regimeIdx > cargaIdx) {
    const newRegimeIdx = parts.findIndex(function(p) { return isRegimeToken_(p); });
    let newCargaIdx = -1;
    for (let i = newRegimeIdx + 1; i < parts.length; i++) {
      if (isCargaHorariaToken_(parts[i])) {
        newCargaIdx = i;
        break;
      }
    }
    regimeIdx = newRegimeIdx;
    cargaIdx = newCargaIdx;
  }

  let nomeParts = [];
  let categoriaParts = [];
  let regime = '';
  let cargaHoraria = '';

  if (regimeIdx !== -1) {
    regime = normalizeRegime_(parts[regimeIdx]);
  }

  if (cargaIdx !== -1) {
    cargaHoraria = normalizeCargaHoraria_(parts[cargaIdx]);
  }

  if (regimeIdx !== -1) {
    nomeParts = parts.slice(0, regimeIdx);
    if (cargaIdx !== -1 && cargaIdx > regimeIdx) {
      categoriaParts = parts.slice(cargaIdx + 1);
    } else {
      categoriaParts = parts.slice(regimeIdx + 1);
    }
  } else if (cargaIdx !== -1) {
    nomeParts = parts.slice(0, cargaIdx);
    categoriaParts = parts.slice(cargaIdx + 1);
  } else {
    nomeParts = parts.length > 1 ? parts.slice(0, parts.length - 1) : parts.slice(0, 1);
    categoriaParts = parts.length > 1 ? parts.slice(parts.length - 1) : [];
  }

  const nomeVaga = nomeParts.join(' - ').trim();
  let categoria = categoriaParts.join(' - ').trim();

  if (!categoria && parts.length > 1) {
    categoria = parts[parts.length - 1];
  }

  return {
    codigo_vaga: codigoVaga,
    nome_vaga: nomeVaga,
    regime: regime,
    carga_horaria: cargaHoraria,
    categoria: normalizeCategoria_(categoria)
  };
}


function isCategoriaConcorrenciaToken_(value) {
  const s = normalizeBooleanText_(value);
  return [
    'ampla concorrencia',
    'indigenas',
    'indigena',
    'pcd',
    'pessoa com deficiencia',
    'pessoas com deficiencia',
    'ppq',
    'ppiq',
    'negros',
    'pretos e pardos',
    'pessoas pretas e pardas'
  ].indexOf(s) !== -1;
}

function normalizeCategoriaConcorrencia_(value) {
  const s = normalizeBooleanText_(value);

  if (s === 'ampla concorrencia') return 'Ampla concorrência';
  if (s === 'indigenas' || s === 'indigena') return 'Indígenas';
  if (s === 'pcd' || s === 'pessoa com deficiencia' || s === 'pessoas com deficiencia') return 'PCD';
  if (s === 'ppq') return 'PPQ';
  if (s === 'ppiq') return 'PPIQ';
  if (s === 'negros' || s === 'pretos e pardos' || s === 'pessoas pretas e pardas') return 'Pretos e Pardos';

  return cleanStr_(value);
}

function isCargaHorariaToken_(value) {
  const s = normalizeBooleanText_(value);
  return /^\d+\s*h$/.test(s) || /^\d+\s*horas?$/.test(s) || /^\d+$/.test(s);
}

function normalizeCargaHoraria_(value) {
  const s = cleanStr_(value);
  const match = s.match(/(\d+)/);
  return match ? (match[1] + 'h') : s;
}

function isCadastroReservaToken_(value) {
  return normalizeBooleanText_(value) === 'cadastro reserva';
}

function normalizeCadastroReserva_(value) {
  return isCadastroReservaToken_(value) ? 'Cadastro Reserva' : cleanStr_(value);
}

function normalizeCategoria_(value) {
  return cleanStr_(value)
    .replace(/\s+-\s+/g, ' - ')
    .replace(/^\-+\s*/, '')
    .replace(/\s*\-+$/, '')
    .trim();
}

function isRegimeToken_(value) {
  const s = normalizeBooleanText_(value);
  return CFG.REGIMES_VALIDOS.indexOf(s) !== -1;
}

function normalizeRegime_(value) {
  const s = normalizeBooleanText_(value);
  if (s === 'presencial') return 'Presencial';
  if (s === 'teletrabalho') return 'Teletrabalho';
  if (s === 'hibrido' || s === 'híbrido') return 'Híbrido';
  return cleanStr_(value);
}

function readObjects_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0].map(normalizarCabecalhoAB_);
  const rows = values.slice(1);

  return rows
    .filter(function(r) {
      return r.some(function(v) { return cleanStr_(v) !== ''; });
    })
    .map(function(r) {
      const obj = {};
      headers.forEach(function(h, i) { obj[h] = r[i]; });
      return obj;
    });
}

function buildDimEditaisMap_(rows) {
  const map = {};
  (rows || []).forEach(function(row) {
    const fullKey = buildDimEditalKey_(row.grupo, row.unidade, row.edital);
    const editalKey = normalizeEdital_(row.edital);
    if (fullKey) map[fullKey] = row;
    if (editalKey && !map['EDITAL|' + editalKey]) {
      map['EDITAL|' + editalKey] = row;
    }
  });
  return map;
}

function resolveEditalInfo_(editaisMap, rowLike) {
  if (!editaisMap || !rowLike) return {};
  const fullKey = buildDimEditalKey_(rowLike.grupo, rowLike.unidade, rowLike.edital);
  const editalKey = normalizeEdital_(rowLike.edital);
  return editaisMap[fullKey] || editaisMap['EDITAL|' + editalKey] || {};
}

function buildRespMap_(rows) {
  const map = {};
  rows.forEach(function(r) {
    const codigo = cleanStr_(r.codigo_vaga);
    if (!codigo) return;

    const contextualKey = buildDimVagaKey_(r.grupo, r.unidade, r.edital, codigo);
    if (contextualKey) {
      map[contextualKey] = r;
    }

    map[codigo] = r;
  });
  return map;
}

function resolveRespInfo_(respMap, vaga) {
  const contextualKey = buildDimVagaKey_(vaga.grupo, vaga.unidade, vaga.edital, vaga.codigo_vaga);
  return respMap[contextualKey] || respMap[cleanStr_(vaga.codigo_vaga)] || {};
}

function buildDimVagasMap_(rows) {
  const map = {};
  rows.forEach(function(r) {
    const key = buildDimVagaKey_(r.grupo, r.unidade, r.edital, r.codigo_vaga);
    if (!key) return;
    map[key] = r;
  });
  return map;
}

function buildDimEditalKey_(grupo, unidade, edital) {
  const g = normalizeGrupo_(grupo);
  const u = normalizeUnidade_(unidade);
  const e = normalizeEdital_(edital);
  return e ? [g, u, e].join('|') : '';
}

function buildDimVagaKey_(grupo, unidade, edital, codigoVaga) {
  const g = normalizeGrupo_(grupo);
  const u = normalizeUnidade_(unidade);
  const e = normalizeEdital_(edital);
  const c = cleanStr_(codigoVaga);
  return e && c ? [g, u, e, c].join('|') : '';
}

function chooseValue_(existingValue, discoveredValue) {
  const current = cleanStr_(existingValue);
  const parsed = cleanStr_(discoveredValue);
  return current || parsed;
}

function buildHeaderIndex_(headers) {
  const idx = {};
  headers.forEach(function(h, i) { idx[h] = i; });
  return idx;
}

function getByHeader_(row, idx, aliases) {
  for (const alias of aliases) {
    const key = normalizarCabecalhoAB_(alias);
    if (Object.prototype.hasOwnProperty.call(idx, key)) {
      return row[idx[key]];
    }
  }
  return '';
}

function buildSourceAliasCategoryMap_() {
  const map = {};
  function add(aliasKey, category) {
    const aliases = SOURCE_HEADER_ALIASES && SOURCE_HEADER_ALIASES[aliasKey] ? SOURCE_HEADER_ALIASES[aliasKey] : [];
    aliases.forEach(function(alias) {
      const norm = normalizarCabecalhoAB_(alias);
      if (norm && !map[norm]) map[norm] = category;
    });
  }

  SOURCE_SCORE_ALIAS_KEYS.forEach(function(key) { add(key, 'score'); });
  SOURCE_INTEGER_ALIAS_KEYS.forEach(function(key) { add(key, 'integer'); });
  SOURCE_DATE_ALIAS_KEYS.forEach(function(key) { add(key, 'date'); });
  SOURCE_TEXT_ALIAS_KEYS.forEach(function(key) { add(key, 'text'); });
  return map;
}

function getSourceField_(row, idx, aliases) {
  aliases = aliases || [];
  for (const alias of aliases) {
    const key = normalizarCabecalhoAB_(alias);
    if (!Object.prototype.hasOwnProperty.call(idx, key)) continue;
    const category = SOURCE_ALIAS_TO_CATEGORY[key] || '';
    const raw = row[idx[key]];

    if (category === 'score') return normalizeScoreText_(raw);
    if (category === 'integer') return normalizeIntegerLikeText_(raw);
    if (category === 'date') return normalizeDateDisplay_(raw);
    return raw;
  }
  return '';
}

function hasAnyHeaderAlias_(idx, aliases) {
  return (aliases || []).some(function(alias) {
    return Object.prototype.hasOwnProperty.call(idx, normalizarCabecalhoAB_(alias));
  });
}


function getResponsavelAnaliseComFallback_(row, idx, respInfo) {
  const responsavelOrigem = getSourceField_(row, idx, SOURCE_HEADER_ALIASES.responsavelAnalise);
  return cleanStr_(responsavelOrigem) || cleanStr_(respInfo && respInfo.responsavel_analise);
}

function getCoordDemandanteComFallback_(row, idx, respInfo) {
  const coordOrigem = getSourceField_(row, idx, SOURCE_HEADER_ALIASES.coordDemandante);
  return cleanStr_(coordOrigem) || cleanStr_(respInfo && respInfo.coord_demandante);
}

function getEmailDemandanteComFallback_(row, idx, respInfo) {
  const emailOrigem = getSourceField_(row, idx, SOURCE_HEADER_ALIASES.emailDemandante);
  return cleanStr_(emailOrigem) || cleanStr_(respInfo && respInfo.email_demandante);
}

function buildFatoRowFromOrigem_(row, idx, vaga, respInfo, nomeArquivoOrigem, planilhaId, agora) {
  const candidato = getSourceField_(row, idx, SOURCE_HEADER_ALIASES.candidato);
  if (!cleanStr_(candidato)) return null;

  const id = getSourceField_(row, idx, SOURCE_HEADER_ALIASES.id);
  const dataNascimentoRaw = getSourceField_(row, idx, SOURCE_HEADER_ALIASES.dataNascimento);
  const dataNascimento = normalizeDateDisplay_(dataNascimentoRaw);
  const idadeOrigem = getSourceField_(row, idx, SOURCE_HEADER_ALIASES.idade);
  const idade = cleanStr_(idadeOrigem) || calcularIdadePorDataNascimento_(dataNascimentoRaw);

  const notaEmpregare = normalizeScoreText_(getSourceField_(row, idx, SOURCE_HEADER_ALIASES.notaEmpregare));
  const modalidadeConcorrencia = normalizeModalidadeConcorrenciaText_(getSourceField_(row, idx, SOURCE_HEADER_ALIASES.modalidadeConcorrencia) || getSourceField_(row, idx, SOURCE_HEADER_ALIASES.etnia));
  const notaFinalAjustada = normalizeScoreText_(getSourceField_(row, idx, SOURCE_HEADER_ALIASES.notaFinalAjustada));
  const somatorio = normalizeScoreText_(getSourceField_(row, idx, SOURCE_HEADER_ALIASES.somatorio));
  let pontuacaoEscolaridade = normalizeScoreText_(getSourceField_(row, idx, SOURCE_HEADER_ALIASES.pontuacaoEscolaridade));
  let pontuacaoCursos = normalizeScoreText_(getSourceField_(row, idx, SOURCE_HEADER_ALIASES.pontuacaoCursosAperfeicoamento));
  let pontuacaoExperienciaProfissional = normalizeScoreText_(getSourceField_(row, idx, SOURCE_HEADER_ALIASES.pontuacaoExperienciaProfissional));
  let pontuacaoCriterioEtnico = normalizeScoreText_(getSourceField_(row, idx, SOURCE_HEADER_ALIASES.pontuacaoCriterioEtnico));
  const expProfAnos = normalizeIntegerLikeText_(getSourceField_(row, idx, SOURCE_HEADER_ALIASES.experienciaProfissionalAnos));
  const expProfMeses = normalizeIntegerLikeText_(getSourceField_(row, idx, SOURCE_HEADER_ALIASES.experienciaProfissionalMeses));
  const expProfDias = normalizeIntegerLikeText_(getSourceField_(row, idx, SOURCE_HEADER_ALIASES.experienciaProfissionalDias));
  let expProfTotal = normalizeIntegerLikeText_(getSourceField_(row, idx, SOURCE_HEADER_ALIASES.experienciaProfissionalTotal));

  if (expProfTotal === '') {
    expProfTotal = calcularTotalDiasExperiencia_(expProfAnos, expProfMeses, expProfDias);
  }

  const expSaudeAnos = normalizeIntegerLikeText_(getSourceField_(row, idx, SOURCE_HEADER_ALIASES.experienciaSaudeIndigenaAnos));
  const expSaudeMeses = normalizeIntegerLikeText_(getSourceField_(row, idx, SOURCE_HEADER_ALIASES.experienciaSaudeIndigenaMeses));
  const expSaudeDias = normalizeIntegerLikeText_(getSourceField_(row, idx, SOURCE_HEADER_ALIASES.experienciaSaudeIndigenaDias));
  const expSaudeTotal = normalizeIntegerLikeText_(getSourceField_(row, idx, SOURCE_HEADER_ALIASES.experienciaSaudeIndigenaTotal));
  const expAtencaoAnos = normalizeIntegerLikeText_(getSourceField_(row, idx, SOURCE_HEADER_ALIASES.experienciaAtencaoBasicaAnos));
  const expAtencaoMeses = normalizeIntegerLikeText_(getSourceField_(row, idx, SOURCE_HEADER_ALIASES.experienciaAtencaoBasicaMeses));
  const expAtencaoDias = normalizeIntegerLikeText_(getSourceField_(row, idx, SOURCE_HEADER_ALIASES.experienciaAtencaoBasicaDias));
  const expAtencaoTotal = normalizeIntegerLikeText_(getSourceField_(row, idx, SOURCE_HEADER_ALIASES.experienciaAtencaoBasicaTotal));

  const etapa = getSourceField_(row, idx, SOURCE_HEADER_ALIASES.etapa);
  const dataAnalise = getSourceField_(row, idx, SOURCE_HEADER_ALIASES.dataAnalise);
  const analise = getSourceField_(row, idx, SOURCE_HEADER_ALIASES.analise);

  const pontuacoesAnalise = extrairPontuacoesDaAnalise_(analise);
  if (pontuacaoEscolaridade === '' && pontuacoesAnalise.escolaridade !== '') {
    pontuacaoEscolaridade = pontuacoesAnalise.escolaridade;
  }
  if (pontuacaoCursos === '' && pontuacoesAnalise.cursos !== '') {
    pontuacaoCursos = pontuacoesAnalise.cursos;
  }
  if (pontuacaoExperienciaProfissional === '' && pontuacoesAnalise.experiencia !== '') {
    pontuacaoExperienciaProfissional = pontuacoesAnalise.experiencia;
  }
  if (pontuacaoCriterioEtnico === '' && pontuacoesAnalise.criterioEtnico !== '') {
    pontuacaoCriterioEtnico = pontuacoesAnalise.criterioEtnico;
  }
  if (expProfTotal === '' && pontuacoesAnalise.experienciaProfissionalTotalDesempate !== '') {
    expProfTotal = pontuacoesAnalise.experienciaProfissionalTotalDesempate;
  }

  const pcd = getSourceField_(row, idx, SOURCE_HEADER_ALIASES.pcd);
  const responsavelAnalise = getResponsavelAnaliseComFallback_(row, idx, respInfo);
  const coordDemandante = getCoordDemandanteComFallback_(row, idx, respInfo);
  const emailDemandante = getEmailDemandanteComFallback_(row, idx, respInfo);
  const statusConsolidado = derivarStatusConsolidado_(etapa, analise);

  return [
    normalizeGrupo_(vaga.grupo),
    normalizeUnidade_(vaga.unidade),
    normalizeEdital_(vaga.edital),
    cleanStr_(vaga.codigo_vaga),
    cleanStr_(vaga.nome_vaga),
    cleanStr_(vaga.regime),
    cleanStr_(vaga.carga_horaria),
    cleanStr_(vaga.categoria),
    cleanStr_(candidato),
    normalizeIntegerLikeText_(id),
    cleanStr_(dataNascimento),
    cleanStr_(idade),
    notaEmpregare,
    modalidadeConcorrencia,
    notaFinalAjustada,
    somatorio,
    pontuacaoEscolaridade,
    pontuacaoCursos,
    pontuacaoExperienciaProfissional,
    pontuacaoCriterioEtnico,
    expProfAnos,
    expProfMeses,
    expProfDias,
    expProfTotal,
    expSaudeAnos,
    expSaudeMeses,
    expSaudeDias,
    expSaudeTotal,
    expAtencaoAnos,
    expAtencaoMeses,
    expAtencaoDias,
    expAtencaoTotal,
    cleanStr_(etapa),
    normalizeDateDisplay_(dataAnalise),
    cleanStr_(analise),
    cleanStr_(pcd),
    cleanStr_(responsavelAnalise),
    cleanStr_(coordDemandante),
    cleanStr_(emailDemandante),
    statusConsolidado,
    cleanStr_(nomeArquivoOrigem),
    cleanStr_(planilhaId),
    agora,
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    ''
  ];
}

function validarCabecalho_(sheet, expectedHeaders) {
  const actual = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), expectedHeaders.length)).getValues()[0].map(normalizarCabecalhoAB_);
  const expected = expectedHeaders.map(normalizarCabecalhoAB_);
  const faltantes = expected.filter(function(h) { return actual.indexOf(h) === -1; });
  if (faltantes.length) {
    throw new Error('Aba "' + sheet.getName() + '" sem cabeçalhos esperados: ' + faltantes.join(', '));
  }
}

function garantirCabecalhoPreservandoDados_(sheet, headers) {
  const targetHeadersNorm = headers.map(normalizarCabecalhoAB_);
  const lastRow = sheet.getLastRow();
  const lastCol = Math.max(sheet.getLastColumn(), headers.length, 1);

  if (lastRow < 1) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return;
  }

  const currentHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(v) {
    return cleanStr_(v);
  });
  const currentHeadersNorm = currentHeaders.map(normalizarCabecalhoAB_);

  const headerJaEstaOk = headers.every(function(h, i) {
    return currentHeaders[i] === h;
  });
  if (headerJaEstaOk) return;

  const dataLastRow = Math.max(lastRow - 1, 0);
  const oldRows = dataLastRow > 0
    ? sheet.getRange(2, 1, dataLastRow, lastCol).getValues().filter(function(r) {
        return r.some(function(v) { return cleanStr_(v) !== ''; });
      })
    : [];

  const remappedRows = oldRows.map(function(row) {
    return headers.map(function(targetHeader) {
      const idx = currentHeadersNorm.indexOf(normalizarCabecalhoAB_(targetHeader));
      return idx === -1 ? '' : row[idx];
    });
  });

  const clearRows = Math.max(lastRow, remappedRows.length + 1, 1);
  sheet.getRange(1, 1, clearRows, headers.length).clearContent();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  if (remappedRows.length) {
    sheet.getRange(2, 1, remappedRows.length, headers.length).setValues(remappedRows);
  }
}

function mergeDimVagasPreservingManual_(existingRows, discoveredMap) {
  const merged = [];
  const seenKeys = {};

  (existingRows || []).forEach(function(row) {
    const key = buildDimVagaKey_(row.grupo, row.unidade, row.edital, row.codigo_vaga);
    if (!key) return;

    const found = discoveredMap[key];
    if (found) {
      merged.push([
        normalizeGrupo_(chooseValue_(row.grupo, found.grupo)),
        normalizeUnidade_(chooseValue_(row.unidade, found.unidade)),
        normalizeEdital_(chooseValue_(row.edital, found.edital)),
        chooseValue_(row.codigo_vaga, found.codigo_vaga),
        chooseValue_(row.nome_vaga, found.nome_vaga),
        chooseValue_(row.regime, found.regime),
        chooseValue_(row.carga_horaria, found.carga_horaria),
        chooseValue_(row.categoria, found.categoria),
        chooseValue_(found.planilha_origem_id, row.planilha_origem_id),
        chooseValue_(found.link_planilha_origem, row.link_planilha_origem),
        chooseValue_(found.nome_arquivo_origem, row.nome_arquivo_origem),
        found.ultima_sincronizacao_vaga || row.ultima_sincronizacao_vaga || new Date()
      ]);
    } else {
      merged.push([
        normalizeGrupo_(row.grupo),
        normalizeUnidade_(row.unidade),
        normalizeEdital_(row.edital),
        cleanStr_(row.codigo_vaga),
        cleanStr_(row.nome_vaga),
        cleanStr_(row.regime),
        cleanStr_(row.carga_horaria),
        cleanStr_(row.categoria),
        cleanStr_(row.planilha_origem_id),
        cleanStr_(row.link_planilha_origem),
        cleanStr_(row.nome_arquivo_origem),
        row.ultima_sincronizacao_vaga || ''
      ]);
    }

    seenKeys[key] = true;
  });

  Object.keys(discoveredMap).forEach(function(key) {
    if (seenKeys[key]) return;
    const found = discoveredMap[key];
    merged.push([
      normalizeGrupo_(found.grupo),
      normalizeUnidade_(found.unidade),
      normalizeEdital_(found.edital),
      cleanStr_(found.codigo_vaga),
      cleanStr_(found.nome_vaga),
      cleanStr_(found.regime),
      cleanStr_(found.carga_horaria),
      cleanStr_(found.categoria),
      cleanStr_(found.planilha_origem_id),
      cleanStr_(found.link_planilha_origem),
      cleanStr_(found.nome_arquivo_origem),
      found.ultima_sincronizacao_vaga || new Date()
    ]);
  });

  merged.sort(function(a, b) {
    const grupoCmp = String(a[0] || '').localeCompare(String(b[0] || ''), 'pt-BR', { numeric: true });
    if (grupoCmp !== 0) return grupoCmp;

    const unidadeCmp = String(a[1] || '').localeCompare(String(b[1] || ''), 'pt-BR', { numeric: true });
    if (unidadeCmp !== 0) return unidadeCmp;

    const editalCmp = String(a[2] || '').localeCompare(String(b[2] || ''), 'pt-BR', { numeric: true });
    if (editalCmp !== 0) return editalCmp;

    return String(a[3] || '').localeCompare(String(b[3] || ''), 'pt-BR', { numeric: true });
  });

  return merged;
}

function writeDimVagasPreservingManual_(sheet, headers, rows) {
  const totalCols = headers.length;

  resetSheetWithHeaders_(sheet, headers);

  if (rows && rows.length) {
    writeRowsInChunks_(sheet, 2, 1, rows, totalCols, getWriteChunkRows_());
  }

  const idxSync = headers.indexOf('ultima_sincronizacao_vaga');
  if (idxSync !== -1 && rows && rows.length) {
    sheet.getRange(2, idxSync + 1, rows.length, 1).setNumberFormat('dd/MM/yyyy HH:mm:ss');
  }
}

function writeSheetWithHeaders_(sheet, headers, rows) {
  sheet.clearContents();
  const data = [headers];
  if (rows && rows.length) {
    data.push.apply(data, rows);
  }

  sheet.getRange(1, 1, data.length, headers.length).setValues(data);

  if (headers.indexOf('ultima_sincronizacao_vaga') !== -1 && data.length > 1) {
    const col = headers.indexOf('ultima_sincronizacao_vaga') + 1;
    sheet.getRange(2, col, data.length - 1, 1).setNumberFormat('dd/MM/yyyy HH:mm:ss');
  }

  if (headers.indexOf('ultima_atualizacao') !== -1 && data.length > 1) {
    const col = headers.indexOf('ultima_atualizacao') + 1;
    sheet.getRange(2, col, data.length - 1, 1).setNumberFormat('dd/MM/yyyy HH:mm:ss');
  }
}


function appendLogs_(sheet, logs) {
  if (!logs || !logs.length) return;
  const startRow = Math.max(sheet.getLastRow(), 1) + 1;
  sheet.getRange(startRow, 1, logs.length, CFG.LOG_HEADERS.length).setValues(logs);
  sheet.getRange(startRow, 1, logs.length, 1).setNumberFormat('dd/MM/yyyy HH:mm:ss');
}

function validarContratoPainel_(ss) {
  validarCabecalhoContractual_(getSheetOrThrow_(ss, CFG.ABA_DIM_EDITAIS), CFG.DIM_EDITAIS_HEADERS);
  validarCabecalhoContractual_(getSheetOrThrow_(ss, CFG.ABA_DIM_VAGAS), CFG.DIM_VAGAS_HEADERS);
  validarCabecalhoContractual_(getSheetOrThrow_(ss, CFG.ABA_DIM_RESPONSAVEIS), CFG.DIM_RESP_HEADERS);
  validarCabecalhoContractual_(getSheetOrThrow_(ss, CFG.ABA_FATO), CFG.FATO_HEADERS);
  validarCabecalhoContractual_(getSheetOrThrow_(ss, CFG.ABA_CTRL_SYNC), CFG.CTRL_SYNC_HEADERS);
}

function validarCabecalhoContractual_(sheet, expectedHeaders) {
  const actual = sheet.getRange(1, 1, 1, expectedHeaders.length).getValues()[0].map(cleanStr_);
  const divergencias = [];

  expectedHeaders.forEach(function(expected, idx) {
    if (actual[idx] !== expected) {
      divergencias.push('coluna ' + (idx + 1) + ': esperado "' + expected + '", atual "' + cleanStr_(actual[idx]) + '"');
    }
  });

  if (divergencias.length) {
    throw new Error('Contrato da aba "' + sheet.getName() + '" divergente do esperado para o painel: ' + divergencias.join('; '));
  }
}

function atualizarMetaPainel_(ss, valuesMap) {
  if (!ss || !valuesMap) return;
  const sheet = getOrCreateSheet_(ss, CFG.ABA_META_PAINEL);
  garantirCabecalhoPreservandoDados_(sheet, CFG.META_PAINEL_HEADERS);

  const headers = CFG.META_PAINEL_HEADERS;
  const data = readObjects_(sheet);
  const existingMap = {};
  data.forEach(function(row) {
    const key = cleanStr_(row.chave);
    if (key) existingMap[key] = row;
  });

  Object.keys(valuesMap).forEach(function(key) {
    existingMap[key] = {
      chave: key,
      valor: formatMetaValue_(valuesMap[key]),
      ultima_atualizacao: new Date()
    };
  });

  const rows = Object.keys(existingMap).sort().map(function(key) {
    return [existingMap[key].chave, existingMap[key].valor, existingMap[key].ultima_atualizacao || new Date()];
  });

  resetSheetWithHeaders_(sheet, headers);
  if (rows.length) {
    writeRowsInChunks_(sheet, 2, 1, rows, headers.length, getWriteChunkRows_());
    sheet.getRange(2, 3, rows.length, 1).setNumberFormat('dd/MM/yyyy HH:mm:ss');
  }
}

function formatMetaValue_(value) {
  if (value === '' || value == null) return '';
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

function getSyncMode_(props) {
  return String(props.getProperty(CFG.PROP_SYNC_MODE) || 'INCREMENTAL').toUpperCase() === 'FULL' ? 'FULL' : 'INCREMENTAL';
}

function getTargetFatoSheetForMode_(ss, syncMode) {
  return syncMode === 'FULL'
    ? getOrCreateSheet_(ss, CFG.ABA_FATO_STAGING)
    : getOrCreateSheet_(ss, CFG.ABA_FATO);
}

function countFatoRowsByOrigemId_(sheet) {
  const map = {};
  const colIndex = CFG.FATO_HEADERS.indexOf('origem_arquivo_id') + 1;
  const lastRow = sheet.getLastRow();
  if (colIndex < 1 || lastRow < 2) return map;

  const values = sheet.getRange(2, colIndex, lastRow - 1, 1).getDisplayValues();
  values.forEach(function(row) {
    const origemId = cleanStr_(row[0]);
    if (!origemId) return;
    map[origemId] = (map[origemId] || 0) + 1;
  });
  return map;
}

function avaliarSubstituicaoSeguraOrigem_(registros, existingCount) {
  if (registros.length > 0) {
    return { ok: true, message: '' };
  }

  if (existingCount > 0) {
    return {
      ok: false,
      message: 'Extração retornou 0 registros para uma origem que já possuía ' + existingCount + ' registro(s) no FATO. Substituição bloqueada para preservar o painel.'
    };
  }

  return { ok: true, message: '' };
}

function validarCabecalhoOrigemMinimo_(idx) {
  const requiredGroups = [
    { label: 'nome/candidato', aliases: SOURCE_HEADER_ALIASES.candidato },
    { label: 'codigo/id', aliases: SOURCE_HEADER_ALIASES.id },
    { label: 'etapa', aliases: SOURCE_HEADER_ALIASES.etapa }
  ];

  const faltantes = requiredGroups.filter(function(group) {
    return !hasAnyHeaderAlias_(idx, group.aliases);
  }).map(function(group) {
    return group.label;
  });

  if (faltantes.length) {
    throw new Error('Cabeçalho mínimo da planilha de origem não encontrado. Campos obrigatórios ausentes: ' + faltantes.join(', '));
  }
}

function avaliarQualidadeCabecalhoOrigem_(idx) {
  const warningGroups = [
    { label: 'data da análise', aliases: SOURCE_HEADER_ALIASES.dataAnalise },
    { label: 'análise/parecer', aliases: SOURCE_HEADER_ALIASES.analise },
    { label: 'responsável pela análise', aliases: SOURCE_HEADER_ALIASES.responsavelAnalise },
    { label: 'modalidade de concorrência/etnia', aliases: SOURCE_HEADER_ALIASES.etnia },
    { label: 'nota final ajustada', aliases: SOURCE_HEADER_ALIASES.notaFinalAjustada },
    { label: 'PCD', aliases: SOURCE_HEADER_ALIASES.pcd }
  ];

  const avisos = [];
  warningGroups.forEach(function(group) {
    if (hasAnyHeaderAlias_(idx, group.aliases)) return;
    avisos.push({
      mensagem: 'Cabeçalho recomendado ausente: ' + group.label + '.',
      acao: 'A origem pode sincronizar, mas revise o layout para melhorar a qualidade da base e dos espelhos.'
    });
  });

  if (!hasAnyHeaderAlias_(idx, SOURCE_HEADER_ALIASES.idade) && !hasAnyHeaderAlias_(idx, SOURCE_HEADER_ALIASES.dataNascimento)) {
    avisos.push({
      mensagem: 'Cabeçalho recomendado ausente: idade ou data de nascimento.',
      acao: 'Inclua Idade ou Data de Nascimento para permitir preenchimento do campo idade na FATO.'
    });
  }

  return avisos;
}

function parseIsoDateSafe_(value) {
  const s = cleanStr_(value);
  if (!s) return null;
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? null : dt;
}

function recuperarSincronizacaoTravadaSeNecessario_(ss, logSheet, props) {
  if (props.getProperty(CFG.PROP_SYNC_ACTIVE) !== '1') return false;

  const heartbeatValue = props.getProperty(CFG.PROP_SYNC_LAST_HEARTBEAT_AT) || props.getProperty(CFG.PROP_SYNC_STARTED_AT);
  const heartbeatAt = parseIsoDateSafe_(heartbeatValue);
  if (!heartbeatAt) return false;

  const staleForMs = Date.now() - heartbeatAt.getTime();
  if (staleForMs < CFG.SYNC_STALE_TIMEOUT_MS) return false;

  const mode = getSyncMode_(props);
  appendLogs_(logSheet, [buildLogRow_(
    'ERRO',
    '',
    '',
    '',
    'Estado de sincronização travado detectado após ' + Math.round(staleForMs / 60000) + ' minuto(s). O estado anterior foi limpo para proteger o painel.'
  )]);
  limparEstadoSincronizacaoAnalises_();
  atualizarMetaPainel_(ss, {
    last_run_status: 'STALE_RESET',
    last_run_mode: mode,
    last_run_finished_at: new Date(),
    contract_status: 'OK'
  });
  return true;
}

function promoverStagingParaFato_(stagingSheet, fatoSheet) {
  const headers = CFG.FATO_HEADERS;
  const totalCols = headers.length;
  const lastRow = Math.max(stagingSheet.getLastRow(), 1);
  const chunkSize = getReadChunkRows_();

  resetSheetWithHeaders_(fatoSheet, headers);

  if (lastRow > 1) {
    let targetRow = 2;
    for (let sourceRow = 2; sourceRow <= lastRow; sourceRow += chunkSize) {
      const count = Math.min(chunkSize, lastRow - sourceRow + 1);
      const chunk = stagingSheet.getRange(sourceRow, 1, count, totalCols).getValues();
      writeRowsInChunks_(fatoSheet, targetRow, 1, chunk, totalCols, getWriteChunkRows_());
      targetRow += count;
    }
  }

  aplicarFormatoTextoColunas_(fatoSheet, [1, 2, 3, 4]);

  const idxUltima = headers.indexOf('ultima_atualizacao');
  if (idxUltima !== -1 && lastRow > 1) {
    fatoSheet.getRange(2, idxUltima + 1, lastRow - 1, 1).setNumberFormat('dd/MM/yyyy HH:mm:ss');
  }

  finalizarSincronizacaoAnalises_(fatoSheet);
}

function countCtrlRowsByStatuses_(rows, statuses) {
  const wanted = (statuses || []).reduce(function(acc, status) {
    acc[String(status || '').toUpperCase()] = true;
    return acc;
  }, {});

  return (rows || []).filter(function(row) {
    return !!wanted[String(row.status_sync || '').toUpperCase()];
  }).length;
}

function getSheetDataRowCount_(sheet) {
  return Math.max(0, sheet.getLastRow() - 1);
}

function safeAlert_(message) {
  try {
    SpreadsheetApp.getUi().alert(message);
  } catch (err) {
    // Execução por gatilho/time-based não tem UI.
  }
}

function aplicarFormatosFatoNovoContrato_(sheet) {
  if (!sheet) return;
  const maxRows = Math.max(1, sheet.getMaxRows());
  let headers = [];
  try {
    headers = detectarCabecalhoFatoPorAlgumaColuna_(sheet, FATO_SCORE_HEADERS.concat(FATO_INTEGER_HEADERS).concat(['data_nascimento', 'data_analise']), 20).headersNorm;
  } catch (err) {
    const lastCol = Math.max(1, sheet.getLastColumn());
    headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(normalizarCabecalhoAB_);
  }

  FATO_SCORE_HEADERS.forEach(function(header) {
    const col = getHeaderColumn_(headers, header);
    if (col > 0) sheet.getRange(1, col, maxRows, 1).setNumberFormat('0.###');
  });

  FATO_INTEGER_HEADERS.forEach(function(header) {
    const col = getHeaderColumn_(headers, header);
    if (col > 0) sheet.getRange(1, col, maxRows, 1).setNumberFormat('0');
  });

  ['data_nascimento', 'data_analise'].forEach(function(header) {
    const col = getHeaderColumn_(headers, header);
    if (col > 0) sheet.getRange(1, col, maxRows, 1).setNumberFormat('@STRING@');
  });
}

function aplicarFormatoTextoColunas_(sheet, columnNumbers) {
  (columnNumbers || []).forEach(function(columnNumber) {
    aplicarFormatoTextoColuna_(sheet, columnNumber);
  });
}

function buildLogRow_(tipo, edital, codigoVaga, arquivo, mensagem) {
  return [
    new Date(),
    tipo,
    normalizeEdital_(edital),
    cleanStr_(codigoVaga),
    cleanStr_(arquivo),
    cleanStr_(mensagem)
  ];
}

function aplicarFormatoTextoColuna_(sheet, columnNumber) {
  if (!sheet || columnNumber < 1) return;
  const rowsToFormat = Math.max(sheet.getLastRow(), 1);
  sheet.getRange(1, columnNumber, rowsToFormat, 1).setNumberFormat('@STRING@');
}

function getSheetByNormalizedName_(ss, name) {
  const expected = normalizarCabecalhoAB_(name);
  const sheets = ss.getSheets();
  for (let i = 0; i < sheets.length; i++) {
    if (normalizarCabecalhoAB_(sheets[i].getName()) === expected) {
      return sheets[i];
    }
  }
  return null;
}

function getSheetOrThrow_(ss, name) {
  const sh = ss.getSheetByName(name);
  if (!sh) throw new Error('Aba não encontrada: ' + name);
  return sh;
}

function getOrCreateSheet_(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function extractDriveId_(urlOrId) {
  const text = String(urlOrId || '').trim();
  if (!text) return '';

  const match = text.match(/[-\w]{25,}/);
  return match ? match[0] : '';
}

function normalizeGrupo_(value) {
  return toTitleCasePreservingAcronyms_(cleanStr_(value));
}

function normalizeUnidade_(value) {
  return toTitleCasePreservingAcronyms_(cleanStr_(value));
}

function toTitleCasePreservingAcronyms_(value) {
  const s = cleanStr_(value);
  if (!s) return '';

  return s
    .split(/\s+/)
    .map(function(part) {
      if (!part) return '';
      if (/^[A-Z0-9_\-]{2,}$/.test(part)) return part;
      const lower = part.toLowerCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ')
    .trim();
}

function normalizeEdital_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'MM/yyyy');
  }

  const s = cleanStr_(value);
  if (!s) return '';

  const mmYyyy = s.match(/^(\d{2})\/(\d{4})$/);
  if (mmYyyy) return mmYyyy[1] + '/' + mmYyyy[2];

  const dt = new Date(s);
  if (!isNaN(dt.getTime())) {
    return Utilities.formatDate(dt, Session.getScriptTimeZone(), 'MM/yyyy');
  }

  return s;
}

function normalizeDateDisplay_(value) {
  const dt = parseDataSemHoraAB_(value);
  if (dt) {
    return Utilities.formatDate(dt, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  }
  return cleanStr_(value);
}

function parseDataSemHoraAB_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  if (typeof value === 'number' && isFinite(value)) {
    return parseExcelSerialDateOnly_(value);
  }

  const s = cleanStr_(value);
  if (!s) return null;

  // Proteção para datas que vierem como serial do Excel em texto: 36538, 36538.0, 46148.
  if (/^\d+(?:\.0+)?$/.test(s)) {
    const n = Number(s);
    if (n >= 20000 && n <= 80000) {
      return parseExcelSerialDateOnly_(n);
    }
  }

  const brMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/);
  if (brMatch) {
    const day = Number(brMatch[1]);
    const month = Number(brMatch[2]) - 1;
    const year = Number(brMatch[3]);
    const dtBr = new Date(year, month, day);
    if (dtBr.getFullYear() === year && dtBr.getMonth() === month && dtBr.getDate() === day) {
      return dtBr;
    }
    return null;
  }

  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]) - 1;
    const day = Number(isoMatch[3]);
    const dtIso = new Date(year, month, day);
    if (dtIso.getFullYear() === year && dtIso.getMonth() === month && dtIso.getDate() === day) {
      return dtIso;
    }
    return null;
  }

  const dt = new Date(s);
  if (isNaN(dt.getTime())) return null;
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
}


function parseExcelSerialDateOnly_(serial) {
  const n = Number(serial);
  if (!isFinite(n)) return null;

  // Google Sheets/Excel serial date system: day 25569 = 1970-01-01.
  const utcMs = Math.round((n - 25569) * 86400 * 1000);
  const dt = new Date(utcMs);
  if (isNaN(dt.getTime())) return null;
  return new Date(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate());
}

function calcularIdadePorDataNascimento_(dataNascimento) {
  const nascimento = parseDataSemHoraAB_(dataNascimento);
  if (!nascimento) return '';

  const hoje = hojeSemHoraAB_();
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const mesAtual = hoje.getMonth();
  const diaAtual = hoje.getDate();
  const mesNasc = nascimento.getMonth();
  const diaNasc = nascimento.getDate();

  if (mesAtual < mesNasc || (mesAtual === mesNasc && diaAtual < diaNasc)) {
    idade -= 1;
  }

  return idade >= 0 && idade <= 120 ? idade : '';
}

function hojeSemHoraAB_() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function formatarDataPtBrAB_(date) {
  if (!(date instanceof Date) || isNaN(date.getTime())) return '';
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'dd/MM/yyyy');
}

function normalizeBooleanText_(v) {
  return cleanStr_(v)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}



function extrairPontuacoesDaAnalise_(analise) {
  const texto = cleanStr_(analise);

  return {
    escolaridade: extrairPontuacaoPorRotulos_(texto, [
      'Escolaridade',
      'Escolaridade \(p[oó]s\)',
      'Especializa[cç][aã]o',
      'Nota Especializa[cç][aã]o',
      'Titula[cç][aã]o Acad[eê]mica',
      'Titula[cç][aã]o'
    ]),
    cursos: extrairPontuacaoPorRotulos_(texto, [
      'Cursos de Aperfei[cç]oamento',
      'Nota Cursos',
      'Cursos'
    ]),
    experiencia: extrairPontuacaoPorRotulos_(texto, [
      'Experi[eê]ncia Profissional',
      'Nota Experi[eê]ncia',
      'Experi[eê]ncia'
    ]),
    criterioEtnico: extrairPontuacaoPorRotulos_(texto, [
      'Crit[eé]rio [EÉeé]tnico',
      '[EÉeé]tnico',
      'Ind[ií]gena residente em aldeia'
    ]),
    experienciaProfissionalTotalDesempate: extrairPontuacaoPorRotulos_(texto, [
      'Crit[eé]rio de Desempate',
      'Crit[eé]rio Desempate',
      'Maior tempo de experi[eê]ncia profissional'
    ])
  };
}

function extrairPontuacaoPorRotulos_(texto, rotulos) {
  const raw = cleanStr_(texto);
  if (!raw) return '';

  for (let i = 0; i < rotulos.length; i++) {
    const rotulo = rotulos[i];

    const padraoComPonto = new RegExp(
      rotulo + '[\\s\\S]{0,220}?(?:pontua[cç][aã]o\\s*(?:de)?\\s*[:\\-]?\\s*)?(-?\\d+(?:[\\.,]\\d+)?)\\s*ponto',
      'i'
    );
    const achadoComPonto = raw.match(padraoComPonto);
    if (achadoComPonto && achadoComPonto[1] !== undefined) {
      return normalizeScoreText_(achadoComPonto[1]);
    }

    const padraoDireto = new RegExp(
      rotulo + '\\s*[:\\-]\\s*(-?\\d+(?:[\\.,]\\d+)?)',
      'i'
    );
    const achadoDireto = raw.match(padraoDireto);
    if (achadoDireto && achadoDireto[1] !== undefined) {
      return normalizeScoreText_(achadoDireto[1]);
    }
  }

  return '';
}

function normalizeScoreText_(value) {
  if (value == null || value === '') return '';

  // Pontuação decimal no Brasil vem como 27,6. Em algumas importações, valores como 8,2
  // foram interpretados pelo Sheets como data (08/02/2026) e depois apareceram como serial
  // numérico (ex.: 46061). Para campos de nota, 46061 deve voltar para 8.2.
  if (value instanceof Date && !isNaN(value.getTime())) {
    return normalizeDecimalText_(value.getDate() + ',' + (value.getMonth() + 1));
  }

  if (typeof value === 'number' && isFinite(value)) {
    if (isLikelyExcelSerialScoreNumber_(value)) {
      const dt = parseExcelSerialDateOnly_(value);
      if (dt) return normalizeDecimalText_(dt.getDate() + ',' + (dt.getMonth() + 1));
    }
    return Number(value);
  }

  const raw = cleanStr_(value);
  if (!raw) return '';

  const dateScore = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/);
  if (dateScore) {
    return normalizeDecimalText_(Number(dateScore[1]) + ',' + Number(dateScore[2]));
  }

  if (/^\d+(?:[\.,]0+)?$/.test(raw)) {
    const n = Number(raw.replace(',', '.'));
    if (isLikelyExcelSerialScoreNumber_(n)) {
      const dt = parseExcelSerialDateOnly_(n);
      if (dt) return normalizeDecimalText_(dt.getDate() + ',' + (dt.getMonth() + 1));
    }
  }

  return normalizeDecimalText_(raw);
}

function isLikelyExcelSerialScoreNumber_(value) {
  const n = Number(value);
  return isFinite(n) && n >= 20000 && n <= 80000;
}

function normalizeDecimalText_(value) {
  let s = cleanStr_(value).replace(/\s+/g, '');
  if (!s) return '';

  // Formato brasileiro: 1.234,56 -> 1234.56; 27,6 -> 27.6.
  if (s.indexOf(',') !== -1) {
    s = s.replace(/\./g, '').replace(',', '.');
  }

  if (/^-?\d+(?:\.\d+)?$/.test(s)) {
    const n = Number(s);
    return isFinite(n) ? n : '';
  }

  return cleanStr_(value);
}

function normalizeModalidadeConcorrenciaText_(value) {
  const original = cleanStr_(value);
  const s = normalizeBooleanText_(original);

  if (!s) return '';
  if (s === 'ampla concorrencia') return 'Ampla concorrência';
  if (s === 'indigenas' || s === 'indigena') return 'Indígenas';
  if (s === 'pretos e pardos' || s === 'preto e pardo') return 'Pretos e pardos';
  if (s === 'pessoas com deficiencia pcd' || s === 'pessoa com deficiencia pcd' || s === 'pcd') return 'Pessoas com deficiência (PCD)';
  if (s === 'ppiq') return 'PPIQ';
  if (s === 'ppq') return 'PPQ';

  return original;
}

function cleanStr_(v) {
  if (v == null) return '';
  let s = String(v).trim();

  // Algumas planilhas exportadas trazem valores textuais entre aspas literais, ex.: "Ampla concorrência".
  if ((s.length >= 2 && s.charAt(0) === '"' && s.charAt(s.length - 1) === '"') ||
      (s.length >= 2 && s.charAt(0) === "'" && s.charAt(s.length - 1) === "'")) {
    s = s.substring(1, s.length - 1).trim();
  }

  return s;
}


function calcularTotalDiasExperiencia_(anos, meses, dias) {
  const a = toSafeInteger_(anos);
  const m = toSafeInteger_(meses);
  const d = toSafeInteger_(dias);

  if (a === null && m === null && d === null) return '';

  return (a || 0) * 365 + (m || 0) * 30 + (d || 0);
}

function toSafeInteger_(value) {
  const s = normalizeIntegerLikeText_(value);
  if (s === '') return null;
  const n = Number(String(s).replace(',', '.'));
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function normalizeIntegerLikeText_(value) {
  const s = cleanStr_(value);
  if (/^-?\d+\.0+$/.test(s)) return s.replace(/\.0+$/, '');
  return s;
}

// Nome próprio deste arquivo: o Code.gs (painel) também tem um normalizeHeader_,
// e no Apps Script a última definição carregada vence sem avisar. Chaves com
// sublinhado ("pasta_origem_link"), como as que o resto do arquivo lê.
function normalizarCabecalhoAB_(v) {
  return cleanStr_(v)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .trim()
    .replace(/\s+/g, '_');
}
