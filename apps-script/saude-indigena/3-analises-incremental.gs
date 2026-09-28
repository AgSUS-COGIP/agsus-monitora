/**
 * Sincronizacao incremental de Analises Curriculares.
 *
 * Este arquivo deve ser adicionado AO LADO do sincronizador FULL existente.
 * Ele reutiliza os helpers ja existentes no projeto, especialmente:
 * - obterConfiguracaoSupabaseAnalises_()
 * - readSheetObjectsForAnalises_()
 * - buildHashPayloadAnalises_()
 * - hashTextAnalises_()
 *
 * Nao substitua o arquivo FULL por este.
 */

const ANALISES_INCREMENTAL_CFG = {
  MODE: 'INCREMENTAL_ACTIVE',
  ORIGEM: 'apps_script_analises_incremental_v1',
  // [por-planilha] Origens desta planilha (incremental e FULL): as consultas ao log so enxergam estas.
  ORIGENS_PLANILHA: ['apps_script_analises_incremental_v1', 'apps_script_analises_curriculares_v2_pdf'], // [por-planilha]
  PROP_STATE: 'ANALISES_SYNC_INCREMENTAL_CLIENT_V1',
  COMPARE_CHUNK_SIZE: 300,
  STAGING_CHUNK_SIZE: 300,
  RPC_BATCH_SIZE: 250,
  MAX_RUNTIME_MS: 240000,
  RPC_RESERVE_MS: 45000,
  CONTINUATION_DELAY_MS: 60000,
  CONTINUATION_HANDLER: 'continuarSyncAnalisesCurricularesIncremental',
  MAX_CONFIRMATION_CHECKS: 3
};

function syncAnalisesCurricularesIncremental() {
  return executarSyncAnalisesCurricularesIncremental_({ resumeOnly: false });
}

function retomarSyncAnalisesCurricularesIncremental() {
  return executarSyncAnalisesCurricularesIncremental_({ resumeOnly: true });
}

function continuarSyncAnalisesCurricularesIncremental() {
  return executarSyncAnalisesCurricularesIncremental_({ resumeOnly: true, continuation: true });
}

function statusSyncAnalisesCurricularesIncremental() {
  const state = lerEstadoAnalisesIncremental_();
  const remote = state ? consultarSyncAnalisesIncremental_(state.sync_id) : consultarSyncPendenteAnalisesIncremental_();
  const result = { state: state, remote: remote };
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function limparEstadoLocalAnalisesIncremental(confirmacao) {
  if (confirmacao !== 'LIMPAR_ESTADO_LOCAL') {
    throw new Error('Use confirmaracao LIMPAR_ESTADO_LOCAL apenas depois de conferir o sync remoto.');
  }
  PropertiesService.getScriptProperties().deleteProperty(ANALISES_INCREMENTAL_CFG.PROP_STATE);
  limparContinuacoesAnalisesIncremental_();
  return { ok: true };
}

function executarSyncAnalisesCurricularesIncremental_(options) {
  const opts = options || {};
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    return { ok: false, skipped: true, motivo: 'Outra execucao do projeto esta em andamento.' };
  }

  const deadline = Date.now() + ANALISES_INCREMENTAL_CFG.MAX_RUNTIME_MS;

  try {
    obterConfiguracaoSupabaseAnalises_();

    let state = lerEstadoAnalisesIncremental_();
    let remotePending = null;

    if (!state) {
      remotePending = consultarQualquerSyncPendenteAnalises_();
      if (remotePending) {
        if (remotePending.modo !== ANALISES_INCREMENTAL_CFG.MODE) {
          return {
            ok: false,
            pending: true,
            requires_reconciliation: true,
            sync_id: remotePending.sync_id,
            modo: remotePending.modo,
            motivo: 'Existe um sync de Analises desta planilha pendente em outro modo. Finalize ou reconcilie antes do incremental.' // [por-planilha]
          };
        }
        state = criarEstadoAnalisesIncremental_(remotePending.sync_id, true);
        salvarEstadoAnalisesIncremental_(state);
      } else if (opts.resumeOnly) {
        return { ok: false, idle: true, motivo: 'Nenhum sync incremental pendente para retomar.' };
      }
    }

    if (!state) {
      state = criarEstadoAnalisesIncremental_(Utilities.getUuid(), false);
      salvarEstadoAnalisesIncremental_(state);
    }

    const snapshot = montarSnapshotAnalisesIncremental_();
    validarSnapshotAnalisesIncremental_(state, snapshot);

    if (!state.snapshot_hash) {
      state.snapshot_hash = snapshot.snapshotHash;
      state.total_ativos_local = snapshot.fatoAtivo.length;
      state.total_editais_local = snapshot.editais.length;
      salvarEstadoAnalisesIncremental_(state);
    }

    const remote = consultarSyncAnalisesIncremental_(state.sync_id);

    if (!remote) {
      if (state.remote_started) {
        return pendenciaAnalisesIncremental_(state, 'Estado local indica inicio remoto, mas o log nao foi encontrado. Reconcilie antes de criar outro sync.', true);
      }

      state.inFlight = { operation: 'iniciar_sync_analises_incremental', startedAt: new Date().toISOString() };
      salvarEstadoAnalisesIncremental_(state);
      const started = rpcAnalisesIncremental_('iniciar_sync_analises_incremental', { p_sync_id: state.sync_id, p_origem: ANALISES_INCREMENTAL_CFG.ORIGEM }, false); // [por-planilha]
      if (!started || started.ok !== true || started.sync_id !== state.sync_id) {
        return pendenciaAnalisesIncremental_(state, 'Resposta invalida ao iniciar sync incremental.', true);
      }
      delete state.inFlight;
      state.remote_started = true;
      state.phase = 'COMPARING';
      salvarEstadoAnalisesIncremental_(state);
    } else {
      state.remote_started = true;
      if (remote.status === 'processado') {
        return concluirAnalisesIncremental_(state, remote, snapshot);
      }
      if (['carregado', 'processando'].indexOf(remote.status) === -1) {
        return pendenciaAnalisesIncremental_(state, 'Status remoto nao permite retomada: ' + remote.status, true);
      }
      reconciliarInFlightAnalisesIncremental_(state, remote);
    }

    if (state.inFlight) {
      return agendarContinuacaoAnalisesIncremental_(state, 'Existe uma chamada RPC sem confirmacao. O cliente nao repetira automaticamente.');
    }

    if (state.phase === 'COMPARING' || state.phase === 'INIT') {
      const r = compararEEnviarAlteradosAnalisesIncremental_(state, snapshot, deadline);
      if (r) return r;
    }

    if (state.phase === 'UPLOADING_EDITAIS') {
      if (Date.now() >= deadline - ANALISES_INCREMENTAL_CFG.RPC_RESERVE_MS) {
        return agendarContinuacaoAnalisesIncremental_(state, 'Pausa antes do envio de DIM_EDITAIS.');
      }
      enviarEditaisAnalisesIncremental_(state, snapshot.editais);
      state.editais_uploaded = true;
      state.phase = 'PREPARING';
      salvarEstadoAnalisesIncremental_(state);
    }

    if (state.phase === 'PREPARING') {
      const prep = rpcAnalisesIncremental_('preparar_sync_analises_incremental', {
        p_sync_id: state.sync_id,
        p_total_ativos_local: snapshot.fatoAtivo.length
      }, false);
      if (!prep || prep.ok !== true) {
        return pendenciaAnalisesIncremental_(state, 'Falha ao preparar sync incremental.', true);
      }
      state.prepared = true;
      state.phase = 'PROCESSING';
      state.cursor = 0;
      salvarEstadoAnalisesIncremental_(state);
    }

    if (state.phase === 'PROCESSING') {
      return processarLotesAnalisesIncremental_(state, snapshot, deadline);
    }

    if (state.phase === 'CONFIRMING') {
      return confirmarFinalizacaoAnalisesIncremental_(state, snapshot);
    }

    return pendenciaAnalisesIncremental_(state, 'Estado incremental em fase desconhecida: ' + state.phase, true);
  } catch (err) {
    const state = lerEstadoAnalisesIncremental_();
    if (state) {
      Logger.log('ERRO incremental: ' + (err && err.stack ? err.stack : err));
      return pendenciaAnalisesIncremental_(state, String(err && err.message || err), !!state.inFlight);
    }
    throw err;
  } finally {
    lock.releaseLock();
  }
}

function montarSnapshotAnalisesIncremental_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetEditais = ss.getSheetByName('DIM_EDITAIS');
  const sheetFato = ss.getSheetByName('FATO_ANALISES');
  if (!sheetEditais || !sheetFato) throw new Error('DIM_EDITAIS e FATO_ANALISES sao obrigatorias.');

  const editaisTable = readSheetObjectsForAnalises_(sheetEditais, 'DIM_EDITAIS');
  const fatoTable = readSheetObjectsForAnalises_(sheetFato, 'FATO_ANALISES');

  const activeKeys = new Set();
  editaisTable.rows.forEach(function(row) {
    const p = row.payload || {};
    if (boolAnalisesIncremental_(p.ativo, true)) {
      activeKeys.add(chaveEditalAnalisesIncremental_(p.grupo, p.unidade, p.edital));
    }
  });

  const fatoAtivo = [];
  fatoTable.rows.forEach(function(row) {
    const p = row.payload || {};
    const keyEdital = chaveEditalAnalisesIncremental_(p.grupo, p.unidade, p.edital);
    if (!activeKeys.has(keyEdital)) return;

    const chaveNatural = makeChaveNaturalAnalisesIncremental_(
      p.grupo,
      p.unidade == null || String(p.unidade).trim() === '' ? 'Nao informada' : p.unidade,
      p.edital == null || String(p.edital).trim() === '' ? 'Sem edital' : p.edital,
      p.codigo_vaga,
      p.id,
      p.candidato
    );
    const hashRegistro = hashTextAnalises_(JSON.stringify(buildHashPayloadAnalises_(p)));

    fatoAtivo.push({
      linha_origem: row.linha_origem,
      payload: p,
      chave_natural: chaveNatural,
      hash_registro: hashRegistro
    });
  });

  const editais = editaisTable.rows.map(function(row) {
    return {
      linha_origem: row.linha_origem,
      payload: row.payload,
      hash_registro: hashTextAnalises_(JSON.stringify(buildHashPayloadAnalises_(row.payload || {})))
    };
  });

  const manifest = fatoAtivo.map(function(r) {
    return r.linha_origem + '|' + r.chave_natural + '|' + r.hash_registro;
  }).join('\n');
  const editaisManifest = editais.map(function(r) {
    return r.linha_origem + '|' + r.hash_registro;
  }).join('\n');

  return {
    fatoAtivo: fatoAtivo,
    editais: editais,
    snapshotHash: hashTextAnalises_(manifest + '\n--EDITAIS--\n' + editaisManifest)
  };
}

function compararEEnviarAlteradosAnalisesIncremental_(state, snapshot, deadline) {
  let index = Number(state.compare_index || 0);
  const rows = snapshot.fatoAtivo;

  while (index < rows.length) {
    if (Date.now() >= deadline - ANALISES_INCREMENTAL_CFG.RPC_RESERVE_MS) {
      state.compare_index = index;
      salvarEstadoAnalisesIncremental_(state);
      return agendarContinuacaoAnalisesIncremental_(state, 'Comparacao incremental pausada por limite de tempo.');
    }

    const chunk = rows.slice(index, index + ANALISES_INCREMENTAL_CFG.COMPARE_CHUNK_SIZE);
    const manifesto = chunk.map(function(r) {
      return {
        linha_origem: r.linha_origem,
        chave_natural: r.chave_natural,
        hash_registro: r.hash_registro
      };
    });

    const diff = rpcAnalisesIncremental_('comparar_analises_incremental', { p_itens: manifesto }, true);
    if (!diff || diff.ok !== true || !Array.isArray(diff.linhas_alteradas)) {
      throw new Error('Resposta invalida da comparacao incremental.');
    }

    const changedSet = new Set(diff.linhas_alteradas.map(Number));
    const changedRows = chunk.filter(function(r) { return changedSet.has(Number(r.linha_origem)); });

    if (changedRows.length) {
      enviarFatoAlteradoAnalisesIncremental_(state, changedRows);
      state.changed_count = Number(state.changed_count || 0) + changedRows.length;
    }

    index += chunk.length;
    state.compare_index = index;
    state.phase = 'COMPARING';
    salvarEstadoAnalisesIncremental_(state);
    Logger.log('Incremental comparado: ' + index + '/' + rows.length + '; alterados acumulados=' + Number(state.changed_count || 0));
  }

  state.phase = 'UPLOADING_EDITAIS';
  salvarEstadoAnalisesIncremental_(state);
  return null;
}

function enviarFatoAlteradoAnalisesIncremental_(state, rows) {
  const staging = rows.map(function(r) {
    return {
      sync_id: state.sync_id,
      entidade: 'FATO_ANALISES',
      linha_origem: r.linha_origem,
      payload: r.payload,
      hash_registro: r.hash_registro
    };
  });
  enviarStagingIdempotenteAnalisesIncremental_(staging);
}

function enviarEditaisAnalisesIncremental_(state, editais) {
  const rows = editais.map(function(r) {
    return {
      sync_id: state.sync_id,
      entidade: 'DIM_EDITAIS',
      linha_origem: r.linha_origem,
      payload: r.payload,
      hash_registro: r.hash_registro
    };
  });
  enviarStagingIdempotenteAnalisesIncremental_(rows);
}

function enviarStagingIdempotenteAnalisesIncremental_(rows) {
  for (let i = 0; i < rows.length; i += ANALISES_INCREMENTAL_CFG.STAGING_CHUNK_SIZE) {
    const chunk = rows.slice(i, i + ANALISES_INCREMENTAL_CFG.STAGING_CHUNK_SIZE);
    requestIdempotenteAnalisesIncremental_(
      '/rest/v1/TM_ANALISE_CURRICULAR?on_conflict=sync_id,entidade,linha_origem',
      'POST',
      chunk,
      { Prefer: 'resolution=merge-duplicates,return=minimal' },
      3
    );
  }
}

function processarLotesAnalisesIncremental_(state, snapshot, deadline) {
  while (Date.now() < deadline - ANALISES_INCREMENTAL_CFG.RPC_RESERVE_MS) {
    const remote = consultarSyncAnalisesIncremental_(state.sync_id);
    if (!remote) return pendenciaAnalisesIncremental_(state, 'Log remoto nao encontrado durante processamento.', true);
    if (remote.status === 'processado') return concluirAnalisesIncremental_(state, remote, snapshot);
    if (['carregado', 'processando'].indexOf(remote.status) === -1) {
      return pendenciaAnalisesIncremental_(state, 'Status remoto inesperado durante processamento: ' + remote.status, true);
    }

    reconciliarInFlightAnalisesIncremental_(state, remote);
    if (state.inFlight) {
      return agendarContinuacaoAnalisesIncremental_(state, 'Aguardando confirmacao de RPC incremental anterior.');
    }

    if (state.fato_concluido === true) {
      state.inFlight = { operation: 'finalizar_sync_analises_incremental', startedAt: new Date().toISOString() };
      salvarEstadoAnalisesIncremental_(state);
      const fin = rpcAnalisesIncremental_('finalizar_sync_analises_incremental', { p_sync_id: state.sync_id }, false);
      if (!fin || fin.ok !== true || fin.sync_id !== state.sync_id) {
        return pendenciaAnalisesIncremental_(state, 'Finalizacao incremental sem resposta valida.', true);
      }
      delete state.inFlight;
      state.phase = 'CONFIRMING';
      salvarEstadoAnalisesIncremental_(state);
      return confirmarFinalizacaoAnalisesIncremental_(state, snapshot);
    }

    const cursorBefore = Number((remote.resultado || {}).lote_cursor || 0);
    state.inFlight = {
      operation: 'processar_sync_analises_incremental_lote',
      cursorBefore: cursorBefore,
      startedAt: new Date().toISOString()
    };
    salvarEstadoAnalisesIncremental_(state);

    const result = rpcAnalisesIncremental_('processar_sync_analises_incremental_lote', {
      p_sync_id: state.sync_id,
      p_limite: ANALISES_INCREMENTAL_CFG.RPC_BATCH_SIZE
    }, false);

    if (!result || result.ok !== true || result.sync_id !== state.sync_id || typeof result.concluido_fato !== 'boolean') {
      return pendenciaAnalisesIncremental_(state, 'Resposta invalida do lote incremental.', true);
    }

    delete state.inFlight;
    state.cursor = Number(result.cursor || 0);
    state.fato_concluido = result.concluido_fato;
    salvarEstadoAnalisesIncremental_(state);
    Logger.log('Lote incremental confirmado. cursor=' + state.cursor + ', concluido=' + state.fato_concluido);
  }

  return agendarContinuacaoAnalisesIncremental_(state, 'Processamento incremental pausado por limite de tempo.');
}

function reconciliarInFlightAnalisesIncremental_(state, remote) {
  if (!state.inFlight) return;

  const op = state.inFlight.operation;
  if (remote.status === 'processado') {
    delete state.inFlight;
    state.phase = 'CONFIRMING';
    salvarEstadoAnalisesIncremental_(state);
    return;
  }

  if (op === 'processar_sync_analises_incremental_lote') {
    const cursor = Number((remote.resultado || {}).lote_cursor || 0);
    if (cursor > Number(state.inFlight.cursorBefore || 0)) {
      delete state.inFlight;
      state.cursor = cursor;
      state.fato_concluido = false;
      salvarEstadoAnalisesIncremental_(state);
    }
    return;
  }

  if (op === 'iniciar_sync_analises_incremental' && remote && remote.sync_id === state.sync_id) {
    delete state.inFlight;
    state.remote_started = true;
    state.phase = state.phase === 'INIT' ? 'COMPARING' : state.phase;
    salvarEstadoAnalisesIncremental_(state);
  }
}

function confirmarFinalizacaoAnalisesIncremental_(state, snapshot) {
  const remote = consultarSyncAnalisesIncremental_(state.sync_id);
  if (remote && remote.status === 'processado') {
    return concluirAnalisesIncremental_(state, remote, snapshot);
  }

  state.confirmation_checks = Number(state.confirmation_checks || 0) + 1;
  salvarEstadoAnalisesIncremental_(state);
  if (state.confirmation_checks >= ANALISES_INCREMENTAL_CFG.MAX_CONFIRMATION_CHECKS) {
    return pendenciaAnalisesIncremental_(state, 'Finalizacao ainda sem confirmacao apos varias verificacoes.', true);
  }
  return agendarContinuacaoAnalisesIncremental_(state, 'Aguardando confirmacao da finalizacao incremental.');
}

function concluirAnalisesIncremental_(state, remote, snapshot) {
  const verification = rpcAnalisesIncremental_('verificar_sync_analises_incremental', {
    p_total_ativos_local: snapshot.fatoAtivo.length,
    p_origem: ANALISES_INCREMENTAL_CFG.ORIGEM // [por-planilha]
  }, true);

  PropertiesService.getScriptProperties().deleteProperty(ANALISES_INCREMENTAL_CFG.PROP_STATE);
  limparContinuacoesAnalisesIncremental_();

  const result = {
    ok: true,
    sync_id: state.sync_id,
    status: remote.status,
    modo: ANALISES_INCREMENTAL_CFG.MODE,
    total_ativos_local: snapshot.fatoAtivo.length,
    alterados_enviados: Number(state.changed_count || 0),
    resultado_remoto: remote.resultado || null,
    verificacao: verification || null
  };
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

// [por-planilha] Filtro PostgREST para enxergar so os logs desta planilha.
function filtroOrigensAnalisesIncremental_() { // [por-planilha]
  return '&origem=in.(' + ANALISES_INCREMENTAL_CFG.ORIGENS_PLANILHA.map(encodeURIComponent).join(',') + ')'; // [por-planilha]
} // [por-planilha]

function consultarQualquerSyncPendenteAnalises_() {
  const path = '/rest/v1/TL_SYNC_ANALISE?select=sync_id,status,modo,linhas_staging,resultado,created_at,updated_at' +
    filtroOrigensAnalisesIncremental_() + // [por-planilha]
    '&status=in.(carregado,processando)&order=created_at.asc&limit=2';
  const rows = requestGetAnalisesIncremental_(path) || [];
  if (rows.length > 1) {
    throw new Error('Existem multiplos syncs de Analises pendentes desta planilha. Reconcilie antes de continuar.'); // [por-planilha]
  }
  return rows.length ? rows[0] : null;
}

function consultarSyncPendenteAnalisesIncremental_() {
  const path = '/rest/v1/TL_SYNC_ANALISE?select=sync_id,status,modo,linhas_staging,resultado,created_at,updated_at' +
    '&modo=eq.' + encodeURIComponent(ANALISES_INCREMENTAL_CFG.MODE) +
    filtroOrigensAnalisesIncremental_() + // [por-planilha]
    '&status=in.(carregado,processando)&order=created_at.asc&limit=2';
  const rows = requestGetAnalisesIncremental_(path) || [];
  if (rows.length > 1) throw new Error('Existem multiplos syncs incrementais pendentes.');
  return rows.length ? rows[0] : null;
}

function consultarSyncAnalisesIncremental_(syncId) {
  const path = '/rest/v1/TL_SYNC_ANALISE?select=sync_id,status,modo,linhas_staging,total_lidos,total_processados,resultado,erro,finished_at,created_at,updated_at' +
    '&sync_id=eq.' + encodeURIComponent(syncId) +
    filtroOrigensAnalisesIncremental_() + // [por-planilha]
    '&order=id.desc&limit=1';
  const rows = requestGetAnalisesIncremental_(path) || [];
  return rows.length ? rows[0] : null;
}

function rpcAnalisesIncremental_(name, payload, idempotent) {
  if (idempotent) {
    return requestIdempotenteAnalisesIncremental_('/rest/v1/rpc/' + name, 'POST', payload, undefined, 3);
  }
  return requestUnicoAnalisesIncremental_('/rest/v1/rpc/' + name, 'POST', payload);
}

function requestGetAnalisesIncremental_(path) {
  return requestIdempotenteAnalisesIncremental_(path, 'GET', undefined, undefined, 3);
}

function requestUnicoAnalisesIncremental_(path, method, payload, extraHeaders) {
  const auth = obterConfiguracaoSupabaseAnalises_();
  const headers = Object.assign({ apikey: auth.key, 'Content-Type': 'application/json', Accept: 'application/json' }, extraHeaders || {});
  if (auth.jwt) headers.Authorization = 'Bearer ' + auth.key;
  const options = { method: method, headers: headers, muteHttpExceptions: true };
  if (payload !== undefined) options.payload = JSON.stringify(payload);

  let res;
  try {
    res = UrlFetchApp.fetch(auth.url + path, options);
  } catch (err) {
    const e = new Error('Falha de transporte Supabase em ' + path + '. A chamada nao sera repetida automaticamente.');
    e.ambiguous = true;
    throw e;
  }

  return parseRespostaAnalisesIncremental_(res, auth.key, path);
}

function requestIdempotenteAnalisesIncremental_(path, method, payload, extraHeaders, maxAttempts) {
  const auth = obterConfiguracaoSupabaseAnalises_();
  const headers = Object.assign({ apikey: auth.key, 'Content-Type': 'application/json', Accept: 'application/json' }, extraHeaders || {});
  if (auth.jwt) headers.Authorization = 'Bearer ' + auth.key;
  const options = { method: method, headers: headers, muteHttpExceptions: true };
  if (payload !== undefined) options.payload = JSON.stringify(payload);

  const attempts = Math.max(1, Math.min(4, Number(maxAttempts || 1)));
  let lastErr = null;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = UrlFetchApp.fetch(auth.url + path, options);
      const code = res.getResponseCode();
      if (code >= 200 && code < 300) return parseRespostaAnalisesIncremental_(res, auth.key, path);
      lastErr = erroRespostaAnalisesIncremental_(res, auth.key, path);
      if (![408, 425, 429].includes(code) && code < 500) throw lastErr;
    } catch (err) {
      lastErr = err;
    }

    if (attempt < attempts) Utilities.sleep(750 * Math.pow(2, attempt - 1));
  }
  throw lastErr || new Error('Falha idempotente no Supabase.');
}

function parseRespostaAnalisesIncremental_(res, key, path) {
  const code = res.getResponseCode();
  if (code < 200 || code >= 300) throw erroRespostaAnalisesIncremental_(res, key, path);
  const body = res.getContentText();
  if (!body || !body.trim()) return null;
  try { return JSON.parse(body); }
  catch (err) { throw new Error('Resposta Supabase nao e JSON valido em ' + path + '.'); }
}

function erroRespostaAnalisesIncremental_(res, key, path) {
  const code = res.getResponseCode();
  const body = String(res.getContentText() || '').split(key).join('[CHAVE OMITIDA]');
  const err = new Error('Supabase HTTP ' + code + ' em ' + path + ': ' + body.slice(0, 1500));
  err.httpStatus = code;
  return err;
}

function criarEstadoAnalisesIncremental_(syncId, resumed) {
  return {
    sync_id: syncId,
    mode: ANALISES_INCREMENTAL_CFG.MODE,
    phase: 'INIT',
    resumed: !!resumed,
    remote_started: !!resumed,
    compare_index: 0,
    changed_count: 0,
    editais_uploaded: false,
    prepared: false,
    fato_concluido: false,
    confirmation_checks: 0,
    created_at: new Date().toISOString()
  };
}

function lerEstadoAnalisesIncremental_() {
  const raw = PropertiesService.getScriptProperties().getProperty(ANALISES_INCREMENTAL_CFG.PROP_STATE);
  if (!raw) return null;
  try {
    const state = JSON.parse(raw);
    if (!state || !state.sync_id) throw new Error('Estado incremental local sem sync_id.');
    return state;
  } catch (err) {
    throw new Error('Estado incremental local invalido: ' + err.message);
  }
}

function salvarEstadoAnalisesIncremental_(state) {
  PropertiesService.getScriptProperties().setProperty(ANALISES_INCREMENTAL_CFG.PROP_STATE, JSON.stringify(state));
}

function validarSnapshotAnalisesIncremental_(state, snapshot) {
  if (!snapshot.editais.length) throw new Error('DIM_EDITAIS sem registros.');
  if (!snapshot.fatoAtivo.length) throw new Error('Nenhuma analise pertence a edital ativo.');
  if (state.snapshot_hash && state.snapshot_hash !== snapshot.snapshotHash) {
    throw new Error('A planilha mudou durante um sync incremental pendente. Nao misture snapshots. Conclua/reconcilie o sync atual antes de iniciar outro.');
  }
}

function pendenciaAnalisesIncremental_(state, motivo, reconciliation) {
  const result = {
    ok: false,
    pending: true,
    sync_id: state && state.sync_id,
    phase: state && state.phase,
    requires_reconciliation: !!reconciliation,
    motivo: motivo
  };
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function agendarContinuacaoAnalisesIncremental_(state, motivo) {
  let scheduled = false;
  try {
    limparContinuacoesAnalisesIncremental_();
    ScriptApp.newTrigger(ANALISES_INCREMENTAL_CFG.CONTINUATION_HANDLER)
      .timeBased()
      .after(ANALISES_INCREMENTAL_CFG.CONTINUATION_DELAY_MS)
      .create();
    scheduled = true;
  } catch (err) {
    Logger.log('Nao foi possivel agendar continuacao incremental: ' + err.message);
  }
  const result = pendenciaAnalisesIncremental_(state, motivo, false);
  result.continuation_scheduled = scheduled;
  return result;
}

function limparContinuacoesAnalisesIncremental_() {
  ScriptApp.getProjectTriggers()
    .filter(function(t) { return t.getHandlerFunction() === ANALISES_INCREMENTAL_CFG.CONTINUATION_HANDLER; })
    .forEach(function(t) { ScriptApp.deleteTrigger(t); });
}

function boolAnalisesIncremental_(value, defaultValue) {
  if (value === true || value === false) return value;
  if (value == null || String(value).trim() === '') return !!defaultValue;
  const s = String(value).trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (['TRUE','T','YES','Y','SIM','S','1'].indexOf(s) !== -1) return true;
  if (['FALSE','F','NO','N','NAO','0'].indexOf(s) !== -1) return false;
  return !!defaultValue;
}

function normKeyAnalisesIncremental_(value) {
  return String(value == null ? '' : value).trim().toLowerCase().replace(/\s+/g, ' ');
}

function chaveEditalAnalisesIncremental_(grupo, unidade, edital) {
  return [
    normKeyAnalisesIncremental_(grupo),
    normKeyAnalisesIncremental_(unidade == null || String(unidade).trim() === '' ? 'Nao informada' : unidade),
    normKeyAnalisesIncremental_(edital == null || String(edital).trim() === '' ? 'Sem edital' : edital)
  ].join('|');
}

function makeChaveNaturalAnalisesIncremental_(grupo, unidade, edital, codigoVaga, idOrigem, candidato) {
  return [grupo, unidade, edital, codigoVaga, idOrigem, candidato].map(function(v) {
    if (v == null) return '<null>';
    const s = String(v).trim();
    return s === '' ? '<null>' : s;
  }).join('|');
}
