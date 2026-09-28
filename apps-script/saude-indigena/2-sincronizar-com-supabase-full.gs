const ANALISES_SYNC_CFG = {
  ORIGEM: 'apps_script_analises_curriculares_v2_pdf',
  // [por-planilha] Origens desta planilha (FULL e incremental): as consultas ao log so enxergam estas.
  ORIGENS_PLANILHA: ['apps_script_analises_curriculares_v2_pdf', 'apps_script_analises_incremental_v1'], // [por-planilha]
  DEFAULT_SUPABASE_URL: 'https://gnudtaxhjfgtvwkwpsel.supabase.co',


SERVICE_ROLE_KEY_FIXA: '',

  SUPABASE_URL_FIXA: '',

  PROP_SUPABASE_URL: 'SUPABASE_URL',
  PROP_SERVICE_ROLE_KEY: 'SUPABASE_SERVICE_ROLE_KEY',
  CHUNK_SIZE: 300,
  MAX_HTTP_RETRIES: 4,
  RPC_MAX_HTTP_RETRIES: 1,
  RPC_BATCH_SIZE: 250,
  RPC_BATCH_MAX_ITERATIONS: 200,
  CLIENT_MAX_RUNTIME_MS: 240000,
  CLIENT_RPC_RESERVE_MS: 45000,
  CONTINUATION_DELAY_MS: 60000,
  CONTINUATION_HANDLER: 'continuarSyncAnalisesCurriculares',
  INFLIGHT_RECHECK_MAX: 3,
  PROP_CLIENT_STATE: 'ANALISES_SYNC_LOTES_CLIENT_V1',
  RETRY_BASE_MS: 1500,
  PENDING_SYNC_MAX_MINUTES: 30,
  HASH_EXCLUDED_FIELDS: [
    'ultima_atualizacao'
  ],
  CLEANUP_STAGING_DAYS: 2,
  SYNC_TRIGGER_EVERY_MINUTES: 10,
  SHEETS: [
    { name: 'DIM_EDITAIS', entidade: 'DIM_EDITAIS' },
    { name: 'FATO_ANALISES', entidade: 'FATO_ANALISES' }
  ],
  DATE_ONLY_HEADERS: [
    'data_inicio_analise',
    'data_fim_analise',
    'data_nascimento',
    'data_analise'
  ],
  TIMESTAMP_HEADERS: [
    'ultima_sincronizacao_vaga',
    'drive_ultima_atualizacao',
    'ultima_sincronizacao',
    'ultima_atualizacao',
    'data_geracao_pdf',
    'pdf_ultima_tentativa'
  ],
  INTEGER_HEADERS: [
    'idade',
    'experiencia_saude_indigena_anos',
    'experiencia_saude_indigena_meses',
    'experiencia_saude_indigena_dias',
    'experiencia_saude_indigena_total',
    'experiencia_atencao_basica_anos',
    'experiencia_atencao_basica_meses',
    'experiencia_atencao_basica_dias',
    'experiencia_atencao_basica_total',
    'qtd_registros',
    'vagas_linhas',
    'linha_origem'
  ],
  NUMBER_HEADERS: [
    'nota_empregare',
    'nota_final_ajustada',
    'somatorio',
    'pontuacao_escolaridade',
    'pontuacao_cursos_aperfeicoamento',
    'pontuacao_experiencia_profissional',
    'pontuacao_criterio_etnico'
  ],
  TEXT_FORCE_HEADERS: [
    'grupo',
    'unidade',
    'edital',
    'codigo_vaga',
    'id',
    'planilha_origem_id',
    'origem_arquivo_id',
    'pdf_gerado',
    'link_pdf',
    'erro_pdf',
    'pdf_status',
    'pdf_file_id',
    'pdf_hash_origem'
  ]
};

const ANALISES_PDF_FIELD_ALIASES = {
  pdf_gerado: [
    'pdf_gerado',
    'pdf gerado',
    'PDF_GERADO',
    'PDF Gerado'
  ],
  link_pdf: [
    'link_pdf',
    'link pdf',
    'LINK_PDF',
    'Link PDF'
  ],
  data_geracao_pdf: [
    'data_geracao_pdf',
    'data geracao pdf',
    'data geração pdf',
    'DATA_GERACAO_PDF',
    'Data Geração PDF'
  ],
  erro_pdf: [
    'erro_pdf',
    'erro pdf',
    'ERRO_PDF',
    'Erro PDF'
  ],
  pdf_status: [
    'pdf_status',
    'pdf status',
    'PDF_STATUS',
    'PDF Status'
  ],
  pdf_file_id: [
    'pdf_file_id',
    'pdf file id',
    'PDF_FILE_ID',
    'PDF File ID'
  ],
  pdf_ultima_tentativa: [
    'pdf_ultima_tentativa',
    'pdf ultima tentativa',
    'ultima tentativa pdf',
    'última tentativa pdf',
    'PDF_ULTIMA_TENTATIVA',
    'PDF Última Tentativa'
  ],
  pdf_hash_origem: [
    'pdf_hash_origem',
    'pdf hash origem',
    'PDF_HASH_ORIGEM',
    'PDF Hash Origem'
  ]
};

const ANALISES_PDF_FIELDS = Object.keys(ANALISES_PDF_FIELD_ALIASES);

function getSupabaseServiceRoleKeyFixaAnalises_() {
  const key = String(ANALISES_SYNC_CFG.SERVICE_ROLE_KEY_FIXA || '').trim();

  if (!key || key === 'COLE_AQUI_A_SUA_SUPABASE_SERVICE_ROLE_KEY') {
    return '';
  }

  return key;
}

function getSupabaseUrlFixaAnalises_() {
  const url = String(ANALISES_SYNC_CFG.SUPABASE_URL_FIXA || '').trim();

  if (!url) {
    return '';
  }

  return url.replace(/\/$/, '');
}

function configurarSupabaseAnalisesCurriculares(serviceRoleKey, supabaseUrl) {
  const props = {};
  props[ANALISES_SYNC_CFG.PROP_SUPABASE_URL] = String(supabaseUrl || ANALISES_SYNC_CFG.DEFAULT_SUPABASE_URL).replace(/\/$/, '');

  if (serviceRoleKey && String(serviceRoleKey).trim()) {
    props[ANALISES_SYNC_CFG.PROP_SERVICE_ROLE_KEY] = String(serviceRoleKey).trim();
  }

  PropertiesService.getScriptProperties().setProperties(props, false);
  Logger.log('SUPABASE_URL configurada: ' + props[ANALISES_SYNC_CFG.PROP_SUPABASE_URL]);
  Logger.log(serviceRoleKey ? 'SUPABASE_SERVICE_ROLE_KEY configurada.' : 'SUPABASE_SERVICE_ROLE_KEY nao foi alterada.');
}

function verificarConfiguracaoSupabaseAnalisesCurriculares() {
  const props = PropertiesService.getScriptProperties();
  const urlFixa = getSupabaseUrlFixaAnalises_();
  const keyFixa = getSupabaseServiceRoleKeyFixaAnalises_();
  const urlProp = props.getProperty(ANALISES_SYNC_CFG.PROP_SUPABASE_URL);
  const keyProp = props.getProperty(ANALISES_SYNC_CFG.PROP_SERVICE_ROLE_KEY);
  const urlFinal = urlFixa || urlProp || ANALISES_SYNC_CFG.DEFAULT_SUPABASE_URL;
  const keyFinal = keyFixa || keyProp || '';

  Logger.log('SUPABASE_URL usada: ' + (urlFinal || 'NAO CONFIGURADA'));
  Logger.log('SUPABASE_URL origem: ' + (urlFixa ? 'SUPABASE_URL_FIXA no codigo' : (urlProp ? 'Propriedades do Script' : 'DEFAULT_SUPABASE_URL')));
  Logger.log('SUPABASE_SERVICE_ROLE_KEY origem: ' + (keyFixa ? 'SERVICE_ROLE_KEY_FIXA no codigo' : (keyProp ? 'Propriedades do Script' : 'NAO CONFIGURADA')));
  Logger.log('SUPABASE_SERVICE_ROLE_KEY: ' + (keyFinal ? 'CONFIGURADA' : 'NAO CONFIGURADA'));
}

function diagnosticarAnalisesCurricularesSupabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const summary = [];

  ANALISES_SYNC_CFG.SHEETS.forEach(function(cfg) {
    const sheet = ss.getSheetByName(cfg.name);
    if (!sheet) {
      summary.push({ aba: cfg.name, entidade: cfg.entidade, encontrada: false, linhas: 0, colunas: 0, headers: [] });
      return;
    }

    const values = sheet.getDataRange().getDisplayValues();
    const headers = values.length ? values[0].map(normalizeHeaderAnalises_) : [];
    const item = {
      aba: cfg.name,
      entidade: cfg.entidade,
      encontrada: true,
      linhas: Math.max(0, sheet.getLastRow() - 1),
      colunas: sheet.getLastColumn(),
      headers: headers.filter(Boolean)
    };

    if (cfg.entidade === 'FATO_ANALISES') {
      item.pdf = diagnosticarPdfAnalisesCurricularesLocal_(sheet);
    }

    summary.push(item);
  });

  Logger.log(JSON.stringify(summary, null, 2));
  return summary;
}

function diagnosticarPdfAnalisesCurricularesLocal() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('FATO_ANALISES');

  if (!sheet) {
    throw new Error('Aba FATO_ANALISES nao encontrada.');
  }

  const resumo = diagnosticarPdfAnalisesCurricularesLocal_(sheet);
  Logger.log('Diagnostico PDF FATO_ANALISES: ' + JSON.stringify(resumo, null, 2));
  return resumo;
}

function diagnosticarPdfAnalisesCurricularesLocal_(sheet) {
  const table = readSheetObjectsForAnalises_(sheet, 'FATO_ANALISES');
  return summarizePdfRowsForAnalises_(table.rows);
}

function syncAnalisesCurricularesCompleto() {
  return executarSyncAnalisesCurriculares_('FULL');
}

/**
 * Alias seguro para uso pelo script principal.
 * Mantem compatibilidade sem criar gatilho recorrente.
 */
function syncAnalisesCurricularesSeguro() {
  return executarSyncAnalisesCurriculares_('FULL');
}

function testarSyncAnalisesCurriculares() {
  const result = syncAnalisesCurricularesCompleto();
  Logger.log('Resultado do sync (confira ok/status): ' + JSON.stringify(result, null, 2));
  return result;
}

/**
 * Mantida para compatibilidade com o nome antigo.
 * O gatilho direto do Supabase foi desativado.
 */
function instalarGatilhoDiarioAnalisesCurriculares() {
  instalarGatilhoAnalisesCurricularesCada10Minutos();
}

/**
 * Desativada de proposito.
 * O envio ao Supabase deve ser agendado pelo script principal somente
 * depois da publicacao da FATO_ANALISES.
 */
function instalarGatilhoAnalisesCurricularesCada10Minutos() {
  removerGatilhoDiarioAnalisesCurriculares();
  throw new Error('Gatilho direto do Supabase desativado. Use instalarGatilhoFatoESupabase() no orquestrador principal.');
}

/**
 * Mantida por compatibilidade com a versao anterior.
 * O gatilho direto do Supabase foi desativado.
 */
function instalarGatilhosAnalisesCurricularesDiaNoite() {
  instalarGatilhoAnalisesCurricularesCada10Minutos();
}

function removerGatilhoDiarioAnalisesCurriculares() {
  ScriptApp.getProjectTriggers()
    .filter(function(t) { return t.getHandlerFunction() === 'syncAnalisesCurricularesCompleto'; })
    .forEach(function(t) { ScriptApp.deleteTrigger(t); });

  Logger.log('Gatilhos removidos para syncAnalisesCurricularesCompleto.');
}

function listarGatilhosAnalisesCurriculares() {
  const triggers = ScriptApp.getProjectTriggers()
    .filter(function(t) { return t.getHandlerFunction() === 'syncAnalisesCurricularesCompleto'; })
    .map(function(t) {
      return {
        handler: t.getHandlerFunction(),
        eventType: String(t.getEventType()),
        source: String(t.getTriggerSource()),
        uniqueId: t.getUniqueId()
      };
    });

  Logger.log(JSON.stringify(triggers, null, 2));
  return triggers;
}

function executarSyncAnalisesCurriculares_(modo, options) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return { ok: false, skipped: true, motivo: 'Outra execução está em andamento. Retome após seu término.' };
  const opts = options || {};
  const startedAt = new Date();
  const deadline = Date.now() + ANALISES_SYNC_CFG.CLIENT_MAX_RUNTIME_MS;
  let state = null;
  try {
    validarConfiguracaoSupabaseAnalises_();
    state = lerEstadoLotesAnalises_();
    if (opts.syncId && state && opts.syncId !== state.sync_id) {
      throw new Error('Existe estado local para outro sync_id. Reconcilie-o antes de trocar de lote.');
    }
    const knownId = opts.syncId || (state && state.sync_id);
    const remote = knownId ? consultarStatusSyncAnalises_(knownId) : verificarSyncAnalisesPendente_();
    if (knownId && !remote) {
      return resultadoPendenteAnalises_(state || { sync_id: knownId }, 'Log remoto não encontrado; não será criado outro lote.', true);
    }
    if (remote) {
      if (!state) state = { sync_id: remote.sync_id, modo: remote.modo || modo || 'FULL', phase: 'PROCESSING', resumed: true };
      if (remote.sync_id !== state.sync_id) throw new Error('O log retornou um sync_id diferente do solicitado.');
      if (remote.status === 'processado') return concluirClienteLotesAnalises_(state, remote);
      if (['carregado', 'processando'].indexOf(remote.status) === -1) {
        salvarEstadoLotesAnalises_(state);
        return resultadoPendenteAnalises_(state, 'Status remoto não permite processamento: ' + remote.status, true);
      }
      state.resumed = true;
      state.staging = remote.linhas_staging;
      salvarEstadoLotesAnalises_(state);
      if (state.inFlight) {
        const reconciliacao = reconciliarChamadaEmVooAnalises_(state, remote);
        if (reconciliacao) return reconciliacao;
        state = lerEstadoLotesAnalises_() || state;
      }
      if (state.phase === 'CONFIRMING') return confirmarConclusaoLotesAnalises_(state);
      if (state.phase === 'UPLOADING') {
        const retomadaUpload = retomarUploadStagingAnalises_(state, remote, deadline);
        if (retomadaUpload) return retomadaUpload;
        state = lerEstadoLotesAnalises_() || state;
      } else {
        // "carregado" é gravado antes do upload: conferir a contagem é obrigatório.
        validarStagingCompletoAnalises_(state.sync_id, remote.linhas_staging);
        state.phase = 'PROCESSING';
        salvarEstadoLotesAnalises_(state);
      }
      Logger.log('Retomando o mesmo sync_id sem reenviar staging completo: ' + state.sync_id);
    } else {
      if (opts.resumeOnly) return { ok: false, idle: true, motivo: 'Nenhum lote pendente. Nenhuma carga foi criada.' };
      const props = PropertiesService.getScriptProperties();
      if (props.getProperty('MFC_SYNC_ACTIVE') === '1') return { ok: false, skipped: true, motivo: 'A Central ainda está processando.' };
      const syncId = Utilities.getUuid();
      const rows = buildAnalisesStagingRows_(SpreadsheetApp.getActiveSpreadsheet(), syncId);
      if (!rows.length) throw new Error('Nenhuma linha para envio.');
      // Não inicia uma carga se a leitura já consumiu o orçamento da execução.
      if (Date.now() >= deadline - ANALISES_SYNC_CFG.CLIENT_RPC_RESERVE_MS) {
        return { ok: false, skipped: true, motivo: 'Leitura consumiu o orçamento de execução. Nenhum lote remoto foi criado.' };
      }
      state = {
        sync_id: syncId,
        modo: modo || 'FULL',
        phase: 'UPLOADING',
        staging: rows.length,
        snapshot_hash: calcularSnapshotHashAnalises_(rows),
        resumed: false
      };
      salvarEstadoLotesAnalises_(state); // Sobrevive inclusive a encerramento forçado.
      insertAnalisesSyncLog_(syncId, state.modo, rows.length, startedAt);
      insertAnalisesStagingRows_(rows);
      validarStagingCompletoAnalises_(syncId, rows.length);
      state.phase = 'PROCESSING';
      salvarEstadoLotesAnalises_(state);
    }
    return callProcessarSyncAnalisesRpc_(state.sync_id, deadline);
  } catch (err) {
    // Não apagar staging, não marcar o log como erro e não gerar outro UUID.
    const saved = lerEstadoLotesAnalises_();
    if (saved) {
      try {
        const remote = consultarStatusSyncAnalises_(saved.sync_id);
        if (remote && remote.status === 'processado') return concluirClienteLotesAnalises_(saved, remote);
      } catch (readError) { Logger.log('Não foi possível confirmar o log remoto.'); }
      if (!saved.inFlight && saved.phase === 'CONFIRMING') {
        return agendarContinuacaoLotesAnalises_(saved, 'Finalização respondeu; aguardando confirmação do log remoto.');
      }
      if (saved.inFlight) {
        return agendarContinuacaoLotesAnalises_(saved, 'Chamada RPC sem confirmação; a continuação apenas verificará o estado remoto antes de qualquer nova RPC.');
      }
      if (saved.phase === 'UPLOADING') {
        return agendarContinuacaoLotesAnalises_(saved, 'Upload de staging não concluído; a continuação validará e completará o mesmo sync_id de forma idempotente.');
      }
      return resultadoPendenteAnalises_(saved, String(err && err.message || err), false);
    }
    throw err;
  } finally {
    lock.releaseLock();
  }
}

function retomarSyncAnalisesCurriculares() {
  return executarSyncAnalisesCurriculares_('FULL', { resumeOnly: true });
}

function retomarSyncAnalisesCurricularesPorId(syncId) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(syncId || ''))) throw new Error('Informe um sync_id UUID válido.');
  return executarSyncAnalisesCurriculares_('FULL', { resumeOnly: true, syncId: syncId });
}

function continuarSyncAnalisesCurriculares() {
  const result = retomarSyncAnalisesCurriculares();
  // Um gatilho que colidiu com o lock pode reagendar apenas uma retomada.
  // A retomada nunca cria nova carga, e continua verificando inFlight.
  if (result.skipped && lerEstadoLotesAnalises_()) {
    return agendarContinuacaoLotesAnalises_(lerEstadoLotesAnalises_(), result.motivo);
  }
  return result;
}

function lerEstadoLotesAnalises_() {
  const raw = PropertiesService.getScriptProperties().getProperty(ANALISES_SYNC_CFG.PROP_CLIENT_STATE);
  if (!raw) return null;
  let state;
  try { state = JSON.parse(raw); } catch (err) { throw new Error('Estado local inválido. Reconcilie antes de iniciar outra carga.'); }
  if (!state || !state.sync_id) throw new Error('Estado local sem sync_id.');
  return state;
}

function salvarEstadoLotesAnalises_(state) {
  PropertiesService.getScriptProperties().setProperty(ANALISES_SYNC_CFG.PROP_CLIENT_STATE, JSON.stringify(state));
}

function resultadoPendenteAnalises_(state, motivo, reconciliation) {
  const result = { ok: false, pending: true, sync_id: state.sync_id, resumed: !!state.resumed, phase: state.phase, requires_reconciliation: !!reconciliation, motivo: motivo };
  Logger.log(JSON.stringify(result));
  return result;
}

function reconciliarChamadaEmVooAnalises_(state, remote) {
  if (!state || !state.inFlight) return null;
  if (remote && remote.status === 'processado') return concluirClienteLotesAnalises_(state, remote);

  const operation = state.inFlight.operation;
  const cursorBefore = Number(state.inFlight.cursorBefore || 0);
  const cursorRemote = Number(remote && (remote.resultado || {}).lote_cursor || 0);

  // O avanço do cursor é prova de que o lote foi confirmado no banco.
  if (operation === 'processar_sync_analises_lote' && remote &&
      ['carregado', 'processando'].indexOf(remote.status) !== -1 &&
      Number.isSafeInteger(cursorRemote) && cursorRemote > cursorBefore) {
    delete state.inFlight;
    state.cursor = cursorRemote;
    // Se o lote perdido era o último, uma chamada adicional sem linhas apenas
    // confirma concluido_fato=true; não duplica dados porque o cursor é remoto.
    state.concluidoFato = false;
    state.phase = 'PROCESSING';
    salvarEstadoLotesAnalises_(state);
    Logger.log('RPC reconciliada pelo cursor remoto. cursor=' + cursorRemote);
    return null;
  }

  state.inFlight.checks = Number(state.inFlight.checks || 0) + 1;
  salvarEstadoLotesAnalises_(state);
  if (state.inFlight.checks < ANALISES_SYNC_CFG.INFLIGHT_RECHECK_MAX) {
    return agendarContinuacaoLotesAnalises_(state, 'RPC ainda sem confirmação; nenhuma RPC será repetida antes de nova conferência do estado remoto.');
  }
  return resultadoPendenteAnalises_(state, 'RPC permaneceu sem confirmação após as conferências automáticas. Reconciliação manual necessária.', true);
}

function calcularSnapshotHashAnalises_(rows) {
  const material = (rows || []).map(function(row) {
    return [row.entidade, row.linha_origem, row.hash_registro].join('|');
  }).join('\n');
  return hashTextAnalises_(material);
}

function retomarUploadStagingAnalises_(state, remote, deadline) {
  if (!state || !remote || state.sync_id !== remote.sync_id) {
    throw new Error('Não foi possível reconciliar o upload do staging.');
  }

  const esperado = Number(remote.linhas_staging || state.staging || 0);
  const cursor = Number((remote.resultado || {}).lote_cursor || 0);
  if (remote.status !== 'carregado' || cursor > 0) {
    return resultadoPendenteAnalises_(state, 'O staging estava em upload, mas o banco já iniciou processamento. Não haverá reenvio automático.', true);
  }

  const recebido = contarStagingAnalises_(state.sync_id);
  if (recebido > esperado) {
    return resultadoPendenteAnalises_(state, 'Staging contém mais linhas que o total esperado. Reconciliação manual necessária.', true);
  }
  if (recebido === esperado) {
    validarStagingCompletoAnalises_(state.sync_id, esperado);
    state.phase = 'PROCESSING';
    salvarEstadoLotesAnalises_(state);
    return null;
  }

  if (!state.snapshot_hash) {
    return resultadoPendenteAnalises_(state, 'Staging parcial sem hash local do snapshot original. O cliente não reconstruirá o lote automaticamente.', true);
  }
  if (Date.now() >= (deadline || 0) - ANALISES_SYNC_CFG.CLIENT_RPC_RESERVE_MS) {
    return agendarContinuacaoLotesAnalises_(state, 'Sem orçamento suficiente para completar o staging nesta execução.');
  }

  const rows = buildAnalisesStagingRows_(SpreadsheetApp.getActiveSpreadsheet(), state.sync_id);
  if (rows.length !== esperado || calcularSnapshotHashAnalises_(rows) !== state.snapshot_hash) {
    return resultadoPendenteAnalises_(state, 'A planilha mudou desde o início do upload. O staging parcial foi preservado e não será misturado com outro snapshot.', true);
  }
  if (Date.now() >= (deadline || 0) - ANALISES_SYNC_CFG.CLIENT_RPC_RESERVE_MS) {
    return agendarContinuacaoLotesAnalises_(state, 'Leitura concluída, mas sem orçamento suficiente para completar o staging nesta execução.');
  }

  // O índice único (sync_id, entidade, linha_origem) torna este replay idempotente.
  insertAnalisesStagingRows_(rows);
  validarStagingCompletoAnalises_(state.sync_id, esperado);
  state.phase = 'PROCESSING';
  salvarEstadoLotesAnalises_(state);
  Logger.log('Staging parcial completado no mesmo sync_id sem criar nova carga: ' + state.sync_id);
  return null;
}

function limparContinuacoesLotesAnalises_() {
  ScriptApp.getProjectTriggers().filter(function(t) { return t.getHandlerFunction() === ANALISES_SYNC_CFG.CONTINUATION_HANDLER; }).forEach(function(t) { ScriptApp.deleteTrigger(t); });
}

function agendarContinuacaoLotesAnalises_(state, motivo) {
  let scheduled = false;
  try {
    limparContinuacoesLotesAnalises_();
    ScriptApp.newTrigger(ANALISES_SYNC_CFG.CONTINUATION_HANDLER).timeBased().after(ANALISES_SYNC_CFG.CONTINUATION_DELAY_MS).create();
    scheduled = true;
  } catch (err) { Logger.log('Gatilho indisponível. Execute retomarSyncAnalisesCurriculares manualmente.'); }
  const result = resultadoPendenteAnalises_(state, motivo, false);
  result.continuation_scheduled = scheduled;
  return result;
}

function concluirClienteLotesAnalises_(state, remote) {
  if (!remote || remote.sync_id !== state.sync_id || remote.status !== 'processado') throw new Error('Conclusão não confirmada pelo log remoto.');
  PropertiesService.getScriptProperties().deleteProperty(ANALISES_SYNC_CFG.PROP_CLIENT_STATE);
  try { limparContinuacoesLotesAnalises_(); } catch (err) { Logger.log('Não foi possível limpar o gatilho de continuação.'); }
  const result = { ok: true, sync_id: state.sync_id, resumed: !!state.resumed, modo_processamento: 'lotes', status: remote.status, staging: remote.linhas_staging, result: remote.resultado };
  Logger.log(JSON.stringify(result));
  return result;
}

function confirmarConclusaoLotesAnalises_(state) {
  const remote = consultarStatusSyncAnalises_(state.sync_id);
  if (remote && remote.status === 'processado') return concluirClienteLotesAnalises_(state, remote);
  // Não repetir finalização só porque a leitura do log ainda não confirmou.
  if (remote && ['carregado', 'processando'].indexOf(remote.status) === -1) {
    return resultadoPendenteAnalises_(state, 'Finalização sem confirmação: status ' + remote.status, true);
  }
  state.confirmationChecks = (state.confirmationChecks || 0) + 1;
  salvarEstadoLotesAnalises_(state);
  if (state.confirmationChecks >= 3) return resultadoPendenteAnalises_(state, 'Finalização respondeu, mas o log não está processado. Conferência necessária.', true);
  return agendarContinuacaoLotesAnalises_(state, 'Aguardando status remoto processado.');
}

function contarStagingAnalises_(syncId, entidade) {
  const path = '/rest/v1/TM_ANALISE_CURRICULAR?select=id&sync_id=eq.' + encodeURIComponent(syncId) + (entidade ? '&entidade=eq.' + encodeURIComponent(entidade) : '') + '&limit=1';
  const res = supabaseAnalisesRequest_(path, 'GET', undefined, { Prefer: 'count=exact' }, { operation: 'contar_staging', returnMetadata: true, maxRetries: 2 });
  const headers = res && res.headers || {};
  const name = Object.keys(headers).filter(function(k) { return k.toLowerCase() === 'content-range'; })[0];
  const match = String(name ? headers[name] : '').match(/\/(\d+)$/);
  if (!match) throw new Error('Contagem exata do staging indisponível. Processamento bloqueado.');
  return Number(match[1]);
}

function validarStagingCompletoAnalises_(syncId, esperado) {
  const total = Number(esperado);
  if (!Number.isSafeInteger(total) || total <= 0) throw new Error('Total esperado de staging inválido no log.');
  const recebido = contarStagingAnalises_(syncId);
  if (recebido !== total) throw new Error('Staging incompleto: ' + recebido + '/' + total + '. Nenhuma RPC executada e nenhuma linha reenviada.');
  const fato = contarStagingAnalises_(syncId, 'FATO_ANALISES');
  const editais = contarStagingAnalises_(syncId, 'DIM_EDITAIS');
  if (fato < 1 || editais < 1 || fato + editais !== total) throw new Error('Staging sem as entidades completas FATO_ANALISES e DIM_EDITAIS.');
}

// Use apenas depois de comprovar externamente o rollback da chamada incerta.
// O texto é uma declaração explícita do operador, não uma prova obtida pelo cliente.
function confirmarFalhaRpcAnalisesCurriculares(syncId, confirmacao) {
  if (confirmacao !== 'FALHA_NO_BANCO_CONFIRMADA') throw new Error('Confirme primeiro no banco que a chamada terminou com rollback.');
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw new Error('Outra execução está em andamento.');
  try {
    const state = lerEstadoLotesAnalises_();
    if (!state || state.sync_id !== syncId || !state.inFlight) throw new Error('Não existe chamada incerta para esse sync_id.');
    const remote = consultarStatusSyncAnalises_(syncId);
    if (remote && remote.status === 'processado') return concluirClienteLotesAnalises_(state, remote);
    if (!remote || ['carregado', 'processando'].indexOf(remote.status) === -1) throw new Error('Log remoto indisponível para retomada.');
    const cursor = Number((remote.resultado || {}).lote_cursor || 0);
    if (cursor !== state.inFlight.cursorBefore) throw new Error('O cursor remoto avançou. Não é possível declarar rollback da chamada com este checkpoint; reconcilie o progresso.');
    delete state.inFlight;
    salvarEstadoLotesAnalises_(state);
    return resultadoPendenteAnalises_(state, 'Rollback confirmado pelo operador. Use retomarSyncAnalisesCurriculares; o staging será reutilizado.', false);
  } finally { lock.releaseLock(); }
}

function confirmarSucessoRpcAnalisesCurriculares(syncId, confirmacao) {
  if (confirmacao !== 'SUCESSO_NO_BANCO_CONFIRMADO') throw new Error('Confirme primeiro no banco que a chamada terminou com commit.');
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw new Error('Outra execução está em andamento.');
  try {
    const state = lerEstadoLotesAnalises_();
    if (!state || state.sync_id !== syncId || !state.inFlight) throw new Error('Não existe chamada incerta para esse sync_id.');
    const remote = consultarStatusSyncAnalises_(syncId);
    if (remote && remote.status === 'processado') return concluirClienteLotesAnalises_(state, remote);
    const cursor = Number(remote && (remote.resultado || {}).lote_cursor || 0);
    if (!remote || remote.status !== 'processando' || state.inFlight.operation !== 'processar_sync_analises_lote' || cursor <= state.inFlight.cursorBefore) {
      throw new Error('Log remoto não comprova avanço de lote. Mantenha o checkpoint para reconciliação.');
    }
    delete state.inFlight;
    state.cursor = cursor;
    // O próximo lote usa o cursor do banco. Se não restam linhas, retorna concluido_fato.
    state.concluidoFato = false;
    state.phase = 'PROCESSING';
    salvarEstadoLotesAnalises_(state);
    return resultadoPendenteAnalises_(state, 'Commit confirmado pelo operador e cursor avançado. Use retomarSyncAnalisesCurriculares.', false);
  } finally { lock.releaseLock(); }
}

function validarConfiguracaoSupabaseAnalises_() {
  return obterConfiguracaoSupabaseAnalises_();
}

function obterConfiguracaoSupabaseAnalises_() {
  const props = PropertiesService.getScriptProperties();
  const url = String(getSupabaseUrlFixaAnalises_() || props.getProperty(ANALISES_SYNC_CFG.PROP_SUPABASE_URL) || ANALISES_SYNC_CFG.DEFAULT_SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = String(getSupabaseServiceRoleKeyFixaAnalises_() || props.getProperty(ANALISES_SYNC_CFG.PROP_SERVICE_ROLE_KEY) || '').trim();
  if (!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(url)) throw new Error('SUPABASE_URL inválida. Informe a URL HTTPS do projeto, sem /rest/v1.');
  if (key.indexOf('sb_secret_') === 0 && key.length > 10) return { url: url, key: key, jwt: false };
  if (key.split('.').length === 3) {
    try {
      const payload = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(key.split('.')[1])).getDataAsString());
      if (payload.role === 'service_role') return { url: url, key: key, jwt: true };
    } catch (err) { /* Mensagem abaixo não expõe a chave. */ }
  }
  throw new Error('Configure SUPABASE_SERVICE_ROLE_KEY com uma chave secreta sb_secret_ ou JWT service_role. Chaves públicas não são aceitas.');
}

function verificarSyncAnalisesPendente_() {
  const path =
    '/rest/v1/TL_SYNC_ANALISE' +
    '?select=sync_id,status,modo,created_at,updated_at,linhas_staging,resultado' +
    filtroOrigensLotesAnalises_() + // [por-planilha]
    '&status=in.(carregado,processando)' +
    '&order=created_at.asc' +
    '&limit=2';

  const rows = supabaseAnalisesRequest_(path, 'GET', undefined, undefined, {
    operation: 'verificar_sync_pendente',
    maxRetries: 2
  }) || [];

  if (rows.length > 1) throw new Error('Existe mais de um sync de Análises pendente. Reconcilie os lotes antes de continuar.');
  return rows.length ? rows[0] : null;
}

// [por-planilha] Filtro PostgREST para enxergar so os logs desta planilha.
function filtroOrigensLotesAnalises_() { // [por-planilha]
  return '&origem=in.(' + ANALISES_SYNC_CFG.ORIGENS_PLANILHA.map(encodeURIComponent).join(',') + ')'; // [por-planilha]
} // [por-planilha]

function consultarStatusSyncAnalises_(syncId) {
  if (!syncId) return null;

  const path =
    '/rest/v1/TL_SYNC_ANALISE' +
    '?select=sync_id,status,modo,linhas_staging,total_processados,resultado,erro,finished_at,updated_at,created_at' +
    '&sync_id=eq.' + encodeURIComponent(syncId) +
    filtroOrigensLotesAnalises_() + // [por-planilha]
    '&order=created_at.desc' +
    '&limit=2';

  const rows = supabaseAnalisesRequest_(path, 'GET', undefined, undefined, {
    operation: 'consultar_status_sync',
    maxRetries: 2
  }) || [];

  if (rows.length > 1) throw new Error('Foram encontrados logs duplicados para o mesmo sync_id. Reconciliação manual necessária.');
  return rows.length ? rows[0] : null;
}

function buildHashPayloadAnalises_(payload) {
  const clone = {};
  const excluded = new Set(ANALISES_SYNC_CFG.HASH_EXCLUDED_FIELDS || []);

  Object.keys(payload || {}).forEach(function(key) {
    if (!excluded.has(key)) clone[key] = payload[key];
  });

  return clone;
}

function limparStagingDoSyncAnalises_(syncId) {
  throw new Error('Limpeza de staging pelo cliente desativada. A finalização remota gerencia o staging.');
}

function limparStagingAnalisesAntigo_() {
  Logger.log('Limpeza automática desativada; staging preservado para retomada.');
}

function buildAnalisesStagingRows_(ss, syncId) {
  const allRows = [];

  ANALISES_SYNC_CFG.SHEETS.forEach(function(cfg) {
    const sheet = ss.getSheetByName(cfg.name);
    if (!sheet) {
      throw new Error('Envio bloqueado: aba obrigatória ausente: ' + cfg.name);
    }

    const table = readSheetObjectsForAnalises_(sheet, cfg.entidade);
    Logger.log('Aba ' + cfg.name + ': ' + table.rows.length + ' linha(s).');

    if (cfg.entidade === 'FATO_ANALISES') {
      Logger.log('Resumo PDF FATO_ANALISES antes do envio: ' + JSON.stringify(summarizePdfRowsForAnalises_(table.rows), null, 2));
    }

    table.rows.forEach(function(rowObj) {
      const hashPayload = buildHashPayloadAnalises_(rowObj.payload);
      allRows.push({
        sync_id: syncId,
        entidade: cfg.entidade,
        linha_origem: rowObj.linha_origem,
        payload: rowObj.payload,
        hash_registro: hashTextAnalises_(JSON.stringify(hashPayload))
      });
    });
  });

  return allRows;
}

function readSheetObjectsForAnalises_(sheet, entidade) {
  const rawValues = sheet.getDataRange().getValues();
  const displayValues = sheet.getDataRange().getDisplayValues();

  if (!displayValues.length || displayValues.length < 2) {
    throw new Error('Aba obrigatória sem dados: ' + sheet.getName());
  }

  const headers = displayValues[0].map(normalizeHeaderAnalises_);
  const seen = new Set();
  headers.forEach(function(h) {
    if (!h) return;
    if (seen.has(h)) throw new Error('Cabeçalho duplicado em ' + sheet.getName() + ': ' + h);
    seen.add(h);
  });
  const required = entidade === 'FATO_ANALISES' ? ['id', 'candidato', 'origem_arquivo_id', 'status_consolidado'] : ['grupo', 'unidade', 'edital', 'ativo'];
  required.forEach(function(h) { if (!seen.has(h)) throw new Error('Cabeçalho obrigatório ausente em ' + sheet.getName() + ': ' + h); });
  const rows = [];

  for (let r = 1; r < displayValues.length; r++) {
    const displayRow = displayValues[r];
    const rawRow = rawValues[r] || [];

    if (!displayRow.some(function(v) { return String(v == null ? '' : v).trim() !== ''; })) continue;

    const payload = {};
    headers.forEach(function(header, colIndex) {
      if (!header) {
        if (String(displayRow[colIndex] || '').trim()) throw new Error('Coluna sem cabeçalho em ' + sheet.getName() + ', linha ' + (r + 1));
        return;
      }
      if (/^#(?:REF!|VALUE!|N\/A|DIV\/0!|NAME\?|NUM!|ERROR!|NOME\?|VALOR!)$/.test(String(displayRow[colIndex] || '').trim())) {
        throw new Error('Erro de célula em ' + sheet.getName() + ', linha ' + (r + 1) + ', campo ' + header);
      }
      payload[header] = normalizeValueForAnalises_(header, rawRow[colIndex], displayRow[colIndex]);
    });

    if (entidade === 'FATO_ANALISES' || normalizeHeaderAnalises_(sheet.getName()) === 'fato_analises') {
      ensureFatoAnalisesPdfFields_(payload);
    }

    rows.push({ linha_origem: r + 1, payload: payload });
  }

  return { headers: headers.filter(Boolean), rows: rows };
}

function ensureFatoAnalisesPdfFields_(payload) {
  ANALISES_PDF_FIELDS.forEach(function(field) {
    var value = payload[field];

    if (value === undefined || value === null || String(value).trim() === '') {
      value = getPayloadValueByAliasesAnalises_(payload, ANALISES_PDF_FIELD_ALIASES[field]);
    }

    payload[field] = value === undefined || value === null || String(value).trim() === ''
      ? null
      : String(value).trim();
  });

  return payload;
}

function getPayloadValueByAliasesAnalises_(payload, aliases) {
  for (var i = 0; i < aliases.length; i++) {
    var normalized = normalizeHeaderAnalises_(aliases[i]);
    var value = payload[normalized];

    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value;
    }
  }

  return null;
}

function summarizePdfRowsForAnalises_(rows) {
  const summary = {
    total_linhas_fato: rows.length,
    campos: {}
  };

  ANALISES_PDF_FIELDS.forEach(function(field) {
    summary.campos[field] = {
      preenchidos: 0,
      vazios: 0
    };
  });

  rows.forEach(function(rowObj) {
    const payload = rowObj.payload || {};

    ANALISES_PDF_FIELDS.forEach(function(field) {
      const value = payload[field];

      if (value !== undefined && value !== null && String(value).trim() !== '') {
        summary.campos[field].preenchidos += 1;
      } else {
        summary.campos[field].vazios += 1;
      }
    });
  });

  return summary;
}

function normalizeValueForAnalises_(header, rawValue, displayValue) {
  if (ANALISES_SYNC_CFG.TEXT_FORCE_HEADERS.indexOf(header) !== -1) {
    return cleanTextAnalises_(displayValue != null && displayValue !== '' ? displayValue : rawValue);
  }

  if (ANALISES_SYNC_CFG.DATE_ONLY_HEADERS.indexOf(header) !== -1) {
    return toIsoDateAnalises_(rawValue, displayValue);
  }

  if (ANALISES_SYNC_CFG.TIMESTAMP_HEADERS.indexOf(header) !== -1) {
    return toIsoTimestampAnalises_(rawValue, displayValue);
  }

  if (ANALISES_SYNC_CFG.INTEGER_HEADERS.indexOf(header) !== -1) {
    return toIntegerAnalises_(rawValue, displayValue);
  }

  if (ANALISES_SYNC_CFG.NUMBER_HEADERS.indexOf(header) !== -1) {
    return toNumberAnalises_(rawValue, displayValue);
  }

  if (rawValue instanceof Date) {
    return Utilities.formatDate(rawValue, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ssZ");
  }

  if (typeof rawValue === 'number' && isFinite(rawValue)) {
    return rawValue;
  }

  return cleanTextAnalises_(displayValue != null && displayValue !== '' ? displayValue : rawValue);
}

function insertAnalisesSyncLog_(syncId, modo, rowsLength, startedAt) {
  supabaseAnalisesRequest_('/rest/v1/TL_SYNC_ANALISE', 'POST', [{
    sync_id: syncId,
    origem: ANALISES_SYNC_CFG.ORIGEM,
    modo: modo || 'FULL',
    status: 'carregado',
    linhas_staging: rowsLength,
    started_at: startedAt.toISOString()
  }], {
    Prefer: 'return=minimal'
  }, {
    operation: 'criar_sync_log',
    maxRetries: 1
  });
}

function updateAnalisesSyncLogErro_(syncId, message) {
  throw new Error('O cliente não altera o status remoto após uma falha HTTP. Consulte o log no banco.');
}

function insertAnalisesStagingRows_(rows) {
  for (let i = 0; i < rows.length; i += ANALISES_SYNC_CFG.CHUNK_SIZE) {
    const chunk = rows.slice(i, i + ANALISES_SYNC_CFG.CHUNK_SIZE);
    supabaseAnalisesRequest_(
      '/rest/v1/TM_ANALISE_CURRICULAR?on_conflict=sync_id,entidade,linha_origem',
      'POST',
      chunk,
      { Prefer: 'resolution=merge-duplicates,return=minimal' },
      { operation: 'staging', maxRetries: 2, idempotent: true }
    );
    Logger.log('Staging enviado: ' + Math.min(i + chunk.length, rows.length) + '/' + rows.length);
  }
}

function callProcessarSyncAnalisesRpc_(syncId, deadline) {
  let state = lerEstadoLotesAnalises_();
  if (!state || state.sync_id !== syncId) throw new Error('Checkpoint local não corresponde ao sync_id.');
  if (state.inFlight) return resultadoPendenteAnalises_(state, 'RPC anterior sem confirmação; reexecução bloqueada.', true);
  const endAt = deadline || Date.now() + ANALISES_SYNC_CFG.CLIENT_MAX_RUNTIME_MS;
  for (let lote = 0; lote < ANALISES_SYNC_CFG.RPC_BATCH_MAX_ITERATIONS; lote++) {
    if (Date.now() >= endAt - ANALISES_SYNC_CFG.CLIENT_RPC_RESERVE_MS) {
      return agendarContinuacaoLotesAnalises_(state, 'Pausa por orçamento de tempo; retomada usará o mesmo sync_id.');
    }
    const remote = consultarStatusSyncAnalises_(syncId);
    if (!remote) throw new Error('Log remoto não encontrado.');
    if (remote.status === 'processado') return concluirClienteLotesAnalises_(state, remote);
    if (['carregado', 'processando'].indexOf(remote.status) === -1) throw new Error('Status remoto impede processamento: ' + remote.status);
    const finalizando = state.concluidoFato === true;
    const operation = finalizando ? 'finalizar_sync_analises_lotes' : 'processar_sync_analises_lote';
    state.inFlight = { operation: operation, cursorBefore: Number((remote.resultado || {}).lote_cursor || 0), startedAt: new Date().toISOString() };
    salvarEstadoLotesAnalises_(state); // ANTES do HTTP; um timeout pode impedir o catch.
    let result;
    try {
      result = supabaseAnalisesRequest_(
        '/rest/v1/rpc/' + operation,
        'POST',
        finalizando ? { p_sync_id: syncId } : { p_sync_id: syncId, p_limite: ANALISES_SYNC_CFG.RPC_BATCH_SIZE },
        undefined,
        { operation: operation, maxRetries: 1 }
      );
      if (!result || result.ok !== true || result.sync_id !== syncId) throw new Error('Resposta RPC sem confirmação válida para este sync_id.');
      if (!finalizando && typeof result.concluido_fato !== 'boolean') throw new Error('Resposta de lote sem concluido_fato booleano.');
      if (!finalizando && (!Number.isSafeInteger(result.cursor) || result.cursor < state.inFlight.cursorBefore || (!result.concluido_fato && result.cursor <= state.inFlight.cursorBefore))) throw new Error('Resposta de lote sem avanço válido do cursor.');
    } catch (err) {
      // Apenas erro PostgreSQL explícito comprova que a instrução falhou.
      // 504, falha de rede ou JSON inesperado continuam incertos entre execuções.
      if (err && err.databaseFailureConfirmed) {
        delete state.inFlight;
        salvarEstadoLotesAnalises_(state);
      }
      throw err;
    }
    delete state.inFlight;
    if (finalizando) {
      state.phase = 'CONFIRMING';
      salvarEstadoLotesAnalises_(state);
      return confirmarConclusaoLotesAnalises_(state);
    }
    state.cursor = result.cursor;
    state.concluidoFato = result.concluido_fato;
    salvarEstadoLotesAnalises_(state);
    Logger.log('Lote confirmado: sync_id=' + syncId + ', cursor=' + result.cursor + ', concluido_fato=' + result.concluido_fato);
  }
  return agendarContinuacaoLotesAnalises_(state, 'Limite de lotes por execução atingido; progresso preservado.');
}

function supabaseAnalisesRequest_(path, method, payload, extraHeaders, requestConfig) {
  const auth = obterConfiguracaoSupabaseAnalises_();
  const headers = Object.assign({ apikey: auth.key, 'Content-Type': 'application/json', Accept: 'application/json' }, extraHeaders || {});
  if (auth.jwt) headers.Authorization = 'Bearer ' + auth.key;
  const options = { method: method, headers: headers, muteHttpExceptions: true };
  if (payload !== undefined) options.payload = JSON.stringify(payload);
  const cfg = requestConfig || {};
  const requested = Number(cfg.maxRetries != null ? cfg.maxRetries : ANALISES_SYNC_CFG.MAX_HTTP_RETRIES);
  // Escritas comuns/RPCs não são repetidas. Apenas GET e writes explicitamente
  // idempotentes (staging com chave única) podem usar retry automático.
  const retryPermitido = String(method).toUpperCase() === 'GET' || cfg.idempotent === true;
  const attempts = retryPermitido
    ? (Number.isFinite(requested) ? Math.max(1, Math.min(6, Math.floor(requested))) : 1)
    : 1;
  const baseMs = Math.max(250, Number(ANALISES_SYNC_CFG.RETRY_BASE_MS) || 1500);
  for (let attempt = 1; attempt <= attempts; attempt++) {
    let res;
    try {
      res = UrlFetchApp.fetch(auth.url + path, options);
    } catch (err) {
      if (attempt === attempts) throw new Error('Falha de transporte Supabase em ' + (cfg.operation || method) + '. Confirme o status remoto antes de repetir.');
      Utilities.sleep(baseMs * Math.pow(2, attempt - 1));
      continue;
    }
    const code = res.getResponseCode();
    const body = res.getContentText();
    if (code >= 200 && code < 300) {
      let data = null;
      if (body && body.trim()) {
        try { data = JSON.parse(body); } catch (err) { throw new Error('Resposta Supabase não é JSON válido.'); }
      }
      return cfg.returnMetadata ? { data: data, headers: res.getAllHeaders(), status: code } : data;
    }
    const error = new Error('Supabase HTTP ' + code + ' em ' + (cfg.operation || method) + ': ' + String(body || '').split(auth.key).join('[CHAVE OMITIDA]').slice(0,2000));
    error.httpStatus = code;
    let detail = null;
    try { detail = JSON.parse(body); } catch (ignored) {}
    const clientFailureDefinitivo = code >= 400 && code < 500 && [408, 425, 429].indexOf(code) === -1;
    error.databaseFailureConfirmed = clientFailureDefinitivo || !!(detail && ['57014', '55P03', '40P01', '40001', 'P0001', '22023', '23505'].indexOf(detail.code) !== -1);
    const retryable = code === 408 || code === 425 || code === 429 || code >= 500;
    if (!retryable || attempt === attempts) throw error;
    Utilities.sleep(baseMs * Math.pow(2, attempt - 1));
  }
}

function normalizeHeaderAnalises_(value) {
  return String(value == null ? '' : value)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function cleanTextAnalises_(value) {
  const raw = String(value == null ? '' : value).trim();
  return raw || null;
}

function toNumberAnalises_(rawValue, displayValue) {
  if (typeof rawValue === 'number') return isFinite(rawValue) ? rawValue : null;
  if (rawValue instanceof Date) return null;
  const raw = String(displayValue != null && displayValue !== '' ? displayValue : (rawValue == null ? '' : rawValue)).trim();
  if (!raw) return null;
  let normalized = raw;
  if (raw.indexOf(',') !== -1) {
    if (!/^[+-]?(?:\d+|\d{1,3}(?:\.\d{3})+),\d+$/.test(raw)) return null;
    normalized = raw.replace(/\./g, '').replace(',', '.');
  } else if (!/^[+-]?\d+(?:\.\d+)?$/.test(raw)) return null;
  const n = Number(normalized);
  return isFinite(n) ? n : null;
}

function toIntegerAnalises_(rawValue, displayValue) {
  const n = toNumberAnalises_(rawValue, displayValue);
  return n != null && Number.isSafeInteger(n) ? n : null;
}

function toIsoDateAnalises_(rawValue, displayValue) {
  const dt = coerceDateAnalises_(rawValue, displayValue);
  if (!dt) return null;
  return Utilities.formatDate(dt, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function toIsoTimestampAnalises_(rawValue, displayValue) {
  const dt = coerceDateAnalises_(rawValue, displayValue);
  if (!dt) return null;
  return Utilities.formatDate(dt, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ssZ");
}

function coerceDateAnalises_(rawValue, displayValue) {
  if (rawValue instanceof Date) return isNaN(rawValue.getTime()) ? null : rawValue;
  let raw = String(displayValue != null && displayValue !== '' ? displayValue : (rawValue == null ? '' : rawValue)).trim();
  if (typeof rawValue === 'number' && isFinite(rawValue) && rawValue > 20000 && rawValue < 90000) {
    raw = new Date(Math.round((rawValue - 25569) * 86400000)).toISOString().slice(0,19).replace('T', ' ');
  }
  if (!raw) return null;
  const br = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (br || iso) {
    const m = br || iso;
    const y = Number(br ? m[3] : m[1]), mo = Number(m[2]), d = Number(br ? m[1] : m[3]);
    const h = Number(m[4] || 0), mi = Number(m[5] || 0), sec = Number(m[6] || 0);
    const check = new Date(Date.UTC(y, mo - 1, d));
    if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d || h > 23 || mi > 59 || sec > 59) return null;
    const pad = function(n) { return String(n).padStart(2, '0'); };
    return Utilities.parseDate(y + '-' + pad(mo) + '-' + pad(d) + ' ' + pad(h) + ':' + pad(mi) + ':' + pad(sec), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/.test(raw)) return null;
  const dt = new Date(raw);
  return isNaN(dt.getTime()) ? null : dt;
}

function hashTextAnalises_(text) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text || '');
  return Utilities.base64EncodeWebSafe(digest).replace(/=+$/g, '');
}
