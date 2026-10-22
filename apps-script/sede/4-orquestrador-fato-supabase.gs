/**
 * PLANILHA SEDE - orquestrador automatico: DIM_VAGAS -> FATO_ANALISES -> Supabase incremental.
 * Mesmo codigo da Saude Indigena; nao consulta TL_SYNC_ANALISE diretamente.
 * Diferenca: acrescenta processarLoteSincronizacaoAnalises (sem '_'), que o
 * "Atualizar base" de Projetos nao tem. Ver apps-script/LEIA-ME.md.
 *
 * Adicione este arquivo AO LADO de:
 * - Atualizar base.gs
 * - Sincronizar com Supabase.gs
 * - AnalisesIncremental.gs
 *
 * Nao substitui nenhum dos arquivos acima.
 */

const FATO_SUPABASE_ORQ_CFG = {
  HANDLER: 'orquestrarFatoESupabaseAgendado',
  CHECK_EVERY_MINUTES: 5,
  CYCLE_EVERY_MINUTES: 20,
  PROP_STATE: 'FATO_SUPABASE_ORQ_STATE_V1',
  PROP_LAST_CYCLE_AT: 'FATO_SUPABASE_ORQ_LAST_CYCLE_AT',
  PROP_MFC_ACTIVE: 'MFC_SYNC_ACTIVE',
  PROP_INCREMENTAL_STATE: 'ANALISES_SYNC_INCREMENTAL_CLIENT_V1',
  LEGACY_MAIN_HANDLER: 'atualizarDimVagasESincronizarAgendado',
  LEGACY_FULL_SUPABASE_HANDLER: 'syncAnalisesCurricularesCompleto',
  FATO_CONTINUATION_HANDLER: 'processarLoteSincronizacaoAnalises',
  FATO_HEARTBEAT_RECOVERY_MINUTES: 8,
  STARTING_RECOVERY_MINUTES: 10,
  SUCCESS_STATUSES: ['SUCCESS', 'NO_CHANGES'],
  // [nao-trava] Execucao do Apps Script tem 30 min. Se a FATO ja consumiu isto, o incremental
  // (ate ~5 min) fica para a proxima verificacao de 5 min, em vez de ser cortado no meio.
  // [sempre-avanca] 15 min de FATO + leitura da planilha + 4 min de trabalho cabem nos 30 min.
  MAX_ELAPSED_BEFORE_INCREMENTAL_MS: 15 * 60 * 1000
};

// [nao-trava] Inicio desta execucao do orquestrador (cada execucao recarrega o script).
let INICIO_EXECUCAO_ORQ_MS_ = 0;

/**
 * Execute UMA VEZ manualmente para instalar o novo gatilho.
 * Remove apenas o gatilho principal antigo e eventuais gatilhos FULL diretos.
 * Nao remove os gatilhos de continuacao da FATO nem do incremental.
 */
function instalarGatilhoFatoESupabase() {
  const removidos = removerGatilhosConflitantesFatoSupabase_();
  const props = PropertiesService.getScriptProperties();

  props.deleteProperty(FATO_SUPABASE_ORQ_CFG.PROP_STATE);
  props.deleteProperty(FATO_SUPABASE_ORQ_CFG.PROP_LAST_CYCLE_AT);
  // O controle antigo de 20 minutos deixa de ser usado pelo handler principal antigo.
  props.deleteProperty('MFC_LAST_MAIN_SCHEDULED_RUN_AT');

  ScriptApp.newTrigger(FATO_SUPABASE_ORQ_CFG.HANDLER)
    .timeBased()
    .everyMinutes(FATO_SUPABASE_ORQ_CFG.CHECK_EVERY_MINUTES)
    .create();

  const result = {
    ok: true,
    handler: FATO_SUPABASE_ORQ_CFG.HANDLER,
    verifica_a_cada_minutos: FATO_SUPABASE_ORQ_CFG.CHECK_EVERY_MINUTES,
    ciclo_efetivo_a_cada_minutos: FATO_SUPABASE_ORQ_CFG.CYCLE_EVERY_MINUTES,
    gatilhos_conflitantes_removidos: removidos
  };
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

/**
 * Remove somente o orquestrador novo.
 * Nao reinstala automaticamente o gatilho antigo.
 */
function removerGatilhoFatoESupabase() {
  let removidos = 0;
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() !== FATO_SUPABASE_ORQ_CFG.HANDLER) return;
    ScriptApp.deleteTrigger(trigger);
    removidos += 1;
  });

  const result = { ok: true, removidos: removidos };
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

/**
 * Forca um novo ciclo na proxima chamada do orquestrador.
 * Pode ser executada manualmente para testar agora.
 */
function executarFatoESupabaseAgora() {
  PropertiesService.getScriptProperties().deleteProperty(FATO_SUPABASE_ORQ_CFG.PROP_LAST_CYCLE_AT);
  return orquestrarFatoESupabaseAgendado();
}

/**
 * Mostra o estado do orquestrador sem alterar dados.
 */
function statusGatilhoFatoESupabase() {
  const props = PropertiesService.getScriptProperties();
  const result = {
    estado_orquestrador: lerEstadoFatoSupabase_(),
    fato_em_execucao: props.getProperty(FATO_SUPABASE_ORQ_CFG.PROP_MFC_ACTIVE) === '1',
    incremental_em_execucao: !!props.getProperty(FATO_SUPABASE_ORQ_CFG.PROP_INCREMENTAL_STATE),
    meta_fato: lerMetaFatoSupabase_(),
    ultimo_ciclo_iniciado_em_ms: Number(props.getProperty(FATO_SUPABASE_ORQ_CFG.PROP_LAST_CYCLE_AT) || 0) || null,
    gatilho_instalado: ScriptApp.getProjectTriggers().some(function(t) {
      return t.getHandlerFunction() === FATO_SUPABASE_ORQ_CFG.HANDLER;
    })
  };
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

/**
 * Handler do gatilho. Nao execute em paralelo manualmente.
 */
function orquestrarFatoESupabaseAgendado() {
  INICIO_EXECUCAO_ORQ_MS_ = Date.now();
  const props = PropertiesService.getScriptProperties();
  let state = lerEstadoFatoSupabase_();

  // 1) Se existe um incremental em andamento, nunca iniciar uma nova FATO.
  if (state && state.phase === 'WAIT_INCREMENTAL') {
    return acompanharIncrementalFatoSupabase_(state);
  }

  if (props.getProperty(FATO_SUPABASE_ORQ_CFG.PROP_INCREMENTAL_STATE)) {
    state = state || criarEstadoFatoSupabase_('WAIT_INCREMENTAL');
    state.phase = 'WAIT_INCREMENTAL';
    state.updated_at = new Date().toISOString();
    salvarEstadoFatoSupabase_(state);
    return acompanharIncrementalFatoSupabase_(state);
  }

  // 2) Se a FATO esta processando em lotes, o orquestrador acompanha e
  // pode assumir a continuacao caso o gatilho temporario nao exista mais.
  if (props.getProperty(FATO_SUPABASE_ORQ_CFG.PROP_MFC_ACTIVE) === '1') {
    if (!state) state = criarEstadoFatoSupabase_('WAIT_FATO');
    state.phase = 'WAIT_FATO';
    state.updated_at = new Date().toISOString();
    salvarEstadoFatoSupabase_(state);
    return avancarFatoPeloOrquestrador_(state);
  }

  // 3) Uma FATO iniciada por este orquestrador terminou: validar antes de enviar.
  if (state && state.phase === 'WAIT_FATO') {
    return concluirFatoEIniciarIncremental_(state);
  }

  // Recuperacao conservadora: se a execucao caiu durante STARTING_FATO, nunca envia
  // usando um status antigo. Aguarda e reinicia a FATO de forma segura.
  if (state && state.phase === 'STARTING_FATO') {
    const startedMs = Date.parse(state.started_at || '');
    const staleMs = FATO_SUPABASE_ORQ_CFG.STARTING_RECOVERY_MINUTES * 60 * 1000;
    if (Number.isFinite(startedMs) && (Date.now() - startedMs) < staleMs) {
      return logResultadoOrq_({
        ok: false,
        pending: true,
        phase: 'STARTING_FATO',
        cycle_id: state.cycle_id,
        motivo: 'Aguardando confirmacao do inicio da FATO; nenhum envio ao Supabase sera feito.'
      });
    }

    registrarFalhaEstadoOrq_(state, 'Execucao interrompida durante o inicio da FATO. O ciclo sera reiniciado antes de qualquer envio ao Supabase.');
    limparEstadoFatoSupabase_();
    state = null;
  }

  // 4) Respeitar o intervalo efetivo de 20 minutos entre inicios de ciclo.
  const lastCycleAt = Number(props.getProperty(FATO_SUPABASE_ORQ_CFG.PROP_LAST_CYCLE_AT) || 0);
  const intervalMs = FATO_SUPABASE_ORQ_CFG.CYCLE_EVERY_MINUTES * 60 * 1000;
  if (lastCycleAt && (Date.now() - lastCycleAt) < intervalMs) {
    return {
      ok: true,
      idle: true,
      motivo: 'Aguardando a proxima janela do ciclo de ' + FATO_SUPABASE_ORQ_CFG.CYCLE_EVERY_MINUTES + ' minutos.'
    };
  }

  // 5) Marcar o ciclo ANTES de chamar a atualizacao da FATO.
  state = criarEstadoFatoSupabase_('STARTING_FATO');
  salvarEstadoFatoSupabase_(state);
  props.setProperty(FATO_SUPABASE_ORQ_CFG.PROP_LAST_CYCLE_AT, String(Date.now()));

  try {
    Logger.log('Ciclo ' + state.cycle_id + ': iniciando DIM_VAGAS -> FATO_ANALISES.');

    // Funcao existente em Atualizar base.gs:
    // atualizarDimVagasAPartirDasPastas() -> reconciliacao -> sincronizarAnalises()
    const fluxo = atualizarDimVagasESincronizar();
    const syncLocal = fluxo && fluxo.sincronizacao ? fluxo.sincronizacao : null;

    state.phase = 'WAIT_FATO';
    state.fato_started = true;
    state.fato_finished_in_call = !!(syncLocal && syncLocal.finished === true);
    state.fato_local_summary = syncLocal ? {
      finished: !!syncLocal.finished,
      processedTotal: Number(syncLocal.processedTotal || 0),
      recordsTotal: Number(syncLocal.recordsTotal || 0),
      totalVagas: Number(syncLocal.totalVagas || 0),
      promoted: !!syncLocal.promoted,
      blockedPromotion: !!syncLocal.blockedPromotion,
      errorCount: Number(syncLocal.errorCount || 0)
    } : null;
    state.updated_at = new Date().toISOString();
    salvarEstadoFatoSupabase_(state);

    // Se a FATO terminou nesta mesma chamada, nao esperar cinco minutos.
    if (syncLocal && syncLocal.finished === true &&
        props.getProperty(FATO_SUPABASE_ORQ_CFG.PROP_MFC_ACTIVE) !== '1') {
      return concluirFatoEIniciarIncremental_(state);
    }

    return logResultadoOrq_({
      ok: false,
      pending: true,
      phase: 'WAIT_FATO',
      cycle_id: state.cycle_id,
      fato_local: state.fato_local_summary,
      motivo: 'Atualizacao da FATO ainda esta em andamento. O incremental sera iniciado assim que a FATO confirmar conclusao segura.'
    });
  } catch (err) {
    registrarFalhaEstadoOrq_(state, String(err && err.message ? err.message : err));
    limparEstadoFatoSupabase_();
    const result = {
      ok: false,
      phase: 'FATO_ERROR',
      cycle_id: state.cycle_id,
      motivo: 'Falha antes da etapa Supabase. Nenhum envio incremental foi iniciado.',
      erro: String(err && err.message ? err.message : err)
    };
    Logger.log(JSON.stringify(result, null, 2));
    return result;
  }
}

function avancarFatoPeloOrquestrador_(state) {
  const props = PropertiesService.getScriptProperties();
  const continuationHandler = FATO_SUPABASE_ORQ_CFG.FATO_CONTINUATION_HANDLER;
  const triggers = ScriptApp.getProjectTriggers();
  let continuationExists = triggers.some(function(t) {
    const handler = t.getHandlerFunction();
    return handler === continuationHandler || handler === 'processarLoteSincronizacaoAnalises_';
  });

  const heartbeatRaw = props.getProperty('MFC_SYNC_LAST_HEARTBEAT_AT');
  const heartbeatMs = Date.parse(heartbeatRaw || '');
  const heartbeatAgeMs = Number.isFinite(heartbeatMs) ? (Date.now() - heartbeatMs) : Infinity;
  const heartbeatStale = heartbeatAgeMs >= FATO_SUPABASE_ORQ_CFG.FATO_HEARTBEAT_RECOVERY_MINUTES * 60 * 1000;

  if ((!continuationExists || heartbeatStale) && typeof processarLoteSincronizacaoAnalises_ === 'function') {
    try {
      if (heartbeatStale && typeof limparGatilhosSincronizacaoAnalises_ === 'function') {
        Logger.log('Orquestrador: heartbeat da FATO esta stale; substituindo gatilho de continuacao e retomando um lote.');
        limparGatilhosSincronizacaoAnalises_();
        continuationExists = false;
      } else {
        Logger.log('Orquestrador: continuacao temporaria da FATO nao encontrada; processando um lote de recuperacao.');
      }
      const lote = processarLoteSincronizacaoAnalises_();
      state.last_fato_batch = lote || null;
      state.updated_at = new Date().toISOString();
      salvarEstadoFatoSupabase_(state);

      if (lote && lote.finished === true &&
          props.getProperty(FATO_SUPABASE_ORQ_CFG.PROP_MFC_ACTIVE) !== '1') {
        return concluirFatoEIniciarIncremental_(state);
      }
    } catch (err) {
      Logger.log('Orquestrador: lote de recuperacao da FATO nao executado: ' + String(err && err.message ? err.message : err));
    }
  }

  return logResultadoOrq_({
    ok: false,
    pending: true,
    phase: 'WAIT_FATO',
    cycle_id: state.cycle_id,
    continuation_trigger_present: continuationExists,
    heartbeat_stale: heartbeatStale,
    heartbeat_age_minutes: Number.isFinite(heartbeatAgeMs) ? Math.round(heartbeatAgeMs / 60000) : null,
    motivo: 'FATO_ANALISES ainda esta sendo atualizada. Nenhum envio ao Supabase sera feito antes da conclusao.'
  });
}

function concluirFatoEIniciarIncremental_(state) {
  const props = PropertiesService.getScriptProperties();

  if (props.getProperty(FATO_SUPABASE_ORQ_CFG.PROP_MFC_ACTIVE) === '1') {
    return logResultadoOrq_({ ok: false, pending: true, phase: 'WAIT_FATO', cycle_id: state.cycle_id });
  }

  const meta = lerMetaFatoSupabase_();
  const status = String(meta.last_run_status || '').toUpperCase();

  if (FATO_SUPABASE_ORQ_CFG.SUCCESS_STATUSES.indexOf(status) === -1) {
    if (['ERROR', 'PARTIAL', 'BLOCKED', 'STALE_RESET', 'CANCELLED'].indexOf(status) !== -1) {
      registrarFalhaEstadoOrq_(state, 'FATO terminou com status ' + status + '. Supabase incremental bloqueado.');
      limparEstadoFatoSupabase_();
      return logResultadoOrq_({
        ok: false,
        blocked: true,
        phase: 'FATO_NOT_SAFE',
        cycle_id: state.cycle_id,
        fato_status: status,
        motivo: 'A FATO nao terminou em estado seguro; nada foi enviado ao Supabase.'
      });
    }

    return logResultadoOrq_({
      ok: false,
      pending: true,
      phase: 'WAIT_FATO',
      cycle_id: state.cycle_id,
      fato_status: status || null,
      motivo: 'A FATO ainda nao possui confirmacao SUCCESS/NO_CHANGES.'
    });
  }

  state.phase = 'WAIT_INCREMENTAL';
  state.fato_status = status;
  state.fato_confirmed_at = new Date().toISOString();
  state.updated_at = state.fato_confirmed_at;
  salvarEstadoFatoSupabase_(state);

  // Agora sim: somente apos a FATO estar confirmada.
  return iniciarOuRetomarIncrementalFatoSupabase_(state, false);
}

function acompanharIncrementalFatoSupabase_(state) {
  // Se ja sabemos o sync_id, consultar o log remoto antes de repetir qualquer coisa.
  if (state.supabase_sync_id && typeof consultarSyncAnalisesIncremental_ === 'function') {
    try {
      const remote = consultarSyncAnalisesIncremental_(state.supabase_sync_id);
      if (remote && remote.status === 'processado') {
        return concluirCicloFatoSupabase_(state, {
          ok: true,
          sync_id: state.supabase_sync_id,
          status: 'processado',
          resultado_remoto: remote.resultado || null,
          recovered_by_orchestrator: true
        });
      }
      // [nao-trava] Sync do ciclo em erro (ex.: encerrado por inatividade) ou sumido: nao ha o que
      // esperar. O ciclo esquece esse sync_id; o incremental descarta o estado local e comeca outro.
      if (!remote || ['carregado', 'processando'].indexOf(remote.status) === -1) {
        Logger.log('Orquestrador: sync ' + state.supabase_sync_id + ' nao pode ser retomado (' +
          (remote ? 'status ' + remote.status : 'nao encontrado') + '); o ciclo segue com um sync novo.');
        state.supabase_sync_id = null;
        state.updated_at = new Date().toISOString();
        salvarEstadoFatoSupabase_(state);
      }
    } catch (err) {
      Logger.log('Nao foi possivel consultar o sync incremental pelo orquestrador: ' + err.message);
    }
  }

  return iniciarOuRetomarIncrementalFatoSupabase_(state, true);
}

function iniciarOuRetomarIncrementalFatoSupabase_(state, resumeOnly) {
  let result;

  // [nao-trava] A FATO desta execucao demorou: o incremental comeca na proxima verificacao
  // (5 min), com o prazo inteiro, em vez de estourar os 30 min do Apps Script no meio.
  const decorridoMs = INICIO_EXECUCAO_ORQ_MS_ ? Date.now() - INICIO_EXECUCAO_ORQ_MS_ : 0;
  if (decorridoMs > FATO_SUPABASE_ORQ_CFG.MAX_ELAPSED_BEFORE_INCREMENTAL_MS) {
    state.phase = 'WAIT_INCREMENTAL';
    state.updated_at = new Date().toISOString();
    salvarEstadoFatoSupabase_(state);
    return logResultadoOrq_({
      ok: false,
      pending: true,
      phase: 'WAIT_INCREMENTAL',
      cycle_id: state.cycle_id,
      motivo: 'Execucao ja dura ' + Math.round(decorridoMs / 60000) + ' min; o incremental comeca na proxima verificacao.'
    });
  }

  try {
    result = resumeOnly
      ? retomarSyncAnalisesCurricularesIncremental()
      : syncAnalisesCurricularesIncremental();
  } catch (err) {
    state.phase = 'WAIT_INCREMENTAL';
    state.last_error = String(err && err.message ? err.message : err);
    state.updated_at = new Date().toISOString();
    salvarEstadoFatoSupabase_(state);
    return logResultadoOrq_({
      ok: false,
      pending: true,
      phase: 'WAIT_INCREMENTAL',
      cycle_id: state.cycle_id,
      motivo: 'Falha ao chamar o incremental. O ciclo foi preservado para nova verificacao.',
      erro: state.last_error
    });
  }

  // Se a retomada informou que nao existe sync pendente e este ciclo ainda nao
  // possui sync_id, significa que a primeira tentativa nem chegou a iniciar
  // o incremental. Como a FATO ja foi confirmada, iniciar agora e seguro.
  if (resumeOnly && result && result.idle === true && !state.supabase_sync_id &&
      !PropertiesService.getScriptProperties().getProperty(FATO_SUPABASE_ORQ_CFG.PROP_INCREMENTAL_STATE)) {
    result = syncAnalisesCurricularesIncremental();
  }

  if (result && result.sync_id) {
    state.supabase_sync_id = result.sync_id;
  }
  state.updated_at = new Date().toISOString();
  salvarEstadoFatoSupabase_(state);

  if (result && result.ok === true && result.status === 'processado') {
    return concluirCicloFatoSupabase_(state, result);
  }

  // Um incremental pode ter sua propria continuacao de 1 minuto.
  // O orquestrador de 5 minutos funciona apenas como rede de seguranca.
  state.phase = 'WAIT_INCREMENTAL';
  salvarEstadoFatoSupabase_(state);

  return logResultadoOrq_({
    ok: false,
    pending: true,
    phase: 'WAIT_INCREMENTAL',
    cycle_id: state.cycle_id,
    sync_id: state.supabase_sync_id || (result && result.sync_id) || null,
    incremental_result: result || null,
    motivo: 'Incremental ainda nao confirmou status processado. Nenhuma nova FATO sera iniciada enquanto isso.'
  });
}

function concluirCicloFatoSupabase_(state, incrementalResult) {
  const result = {
    ok: true,
    cycle_id: state.cycle_id,
    fato_status: state.fato_status,
    supabase_status: 'processado',
    sync_id: state.supabase_sync_id || (incrementalResult && incrementalResult.sync_id) || null,
    incremental: incrementalResult || null,
    concluido_em: new Date().toISOString()
  };

  Logger.log('Ciclo FATO -> Supabase concluido: ' + JSON.stringify(result, null, 2));

  // Se o banco ja confirmou o incremental como processado, qualquer estado local
  // remanescente e apenas um checkpoint obsoleto. Limpa-o para nao bloquear o
  // proximo ciclo do orquestrador.
  limparEstadoIncrementalConfirmadoPeloOrquestrador_();
  limparEstadoFatoSupabase_();
  return result;
}

function limparEstadoIncrementalConfirmadoPeloOrquestrador_() {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty(FATO_SUPABASE_ORQ_CFG.PROP_INCREMENTAL_STATE);

  if (typeof limparContinuacoesAnalisesIncremental_ === 'function') {
    try {
      limparContinuacoesAnalisesIncremental_();
    } catch (err) {
      Logger.log('Nao foi possivel limpar gatilho de continuacao incremental ja concluido: ' + err.message);
    }
  }
}

function criarEstadoFatoSupabase_(phase) {
  return {
    version: 1,
    cycle_id: Utilities.getUuid(),
    phase: phase || 'IDLE',
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    fato_status: null,
    supabase_sync_id: null
  };
}

function lerEstadoFatoSupabase_() {
  const raw = PropertiesService.getScriptProperties().getProperty(FATO_SUPABASE_ORQ_CFG.PROP_STATE);
  if (!raw) return null;
  try {
    const state = JSON.parse(raw);
    return state && state.cycle_id ? state : null;
  } catch (err) {
    Logger.log('Estado do orquestrador invalido; preservado para verificacao manual.');
    return null;
  }
}

function salvarEstadoFatoSupabase_(state) {
  PropertiesService.getScriptProperties().setProperty(
    FATO_SUPABASE_ORQ_CFG.PROP_STATE,
    JSON.stringify(state)
  );
}

function limparEstadoFatoSupabase_() {
  PropertiesService.getScriptProperties().deleteProperty(FATO_SUPABASE_ORQ_CFG.PROP_STATE);
}

function registrarFalhaEstadoOrq_(state, message) {
  if (!state) return;
  state.last_error = String(message || 'Erro desconhecido').slice(0, 2000);
  state.last_error_at = new Date().toISOString();
  state.updated_at = state.last_error_at;
  salvarEstadoFatoSupabase_(state);
  Logger.log('Orquestrador: ' + state.last_error);
}

function lerMetaFatoSupabase_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('META_PAINEL');
  if (!sheet || sheet.getLastRow() < 2) return {};

  const values = sheet.getDataRange().getDisplayValues();
  const headers = values[0].map(function(v) { return String(v || '').trim().toLowerCase(); });
  const idxKey = headers.indexOf('chave');
  const idxValue = headers.indexOf('valor');
  if (idxKey < 0 || idxValue < 0) return {};

  const result = {};
  for (let i = 1; i < values.length; i++) {
    const key = String(values[i][idxKey] || '').trim();
    if (!key) continue;
    result[key] = values[i][idxValue];
  }
  return result;
}

function removerGatilhosConflitantesFatoSupabase_() {
  const handlers = [
    FATO_SUPABASE_ORQ_CFG.HANDLER,
    FATO_SUPABASE_ORQ_CFG.LEGACY_MAIN_HANDLER,
    FATO_SUPABASE_ORQ_CFG.LEGACY_FULL_SUPABASE_HANDLER
  ];

  let removidos = 0;
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (handlers.indexOf(trigger.getHandlerFunction()) === -1) return;
    ScriptApp.deleteTrigger(trigger);
    removidos += 1;
  });
  return removidos;
}

/**
 * Handler PUBLICO para o gatilho de continuacao da FATO (o "Atualizar base" da
 * Saude Indigena ja tem esta funcao; o de Projetos nao). Gatilho nao chama funcao
 * terminada em '_'. So passa a ser usado se CFG.CONTINUATION_SYNC_TRIGGER_HANDLER
 * do "Atualizar base" de Projetos for trocado para 'processarLoteSincronizacaoAnalises'.
 */
function processarLoteSincronizacaoAnalises(e) {
  return processarLoteSincronizacaoAnalises_(e);
}

function logResultadoOrq_(result) {
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
