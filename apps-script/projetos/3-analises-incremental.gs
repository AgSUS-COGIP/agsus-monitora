/**
 * PLANILHA PROJETOS - sincronizacao incremental de Analises Curriculares.
 * Mesmo codigo da Saude Indigena (apps-script/saude-indigena), com ORIGEM propria.
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
  ORIGEM: 'apps_script_analises_projetos_incremental_v1',
  // [por-planilha] Origens desta planilha (incremental e FULL): as consultas ao log so enxergam estas.
  ORIGENS_PLANILHA: ['apps_script_analises_projetos_incremental_v1', 'apps_script_analises_projetos_full_v1'], // [por-planilha]
  PROP_STATE: 'ANALISES_SYNC_INCREMENTAL_CLIENT_V1',
  COMPARE_CHUNK_SIZE: 300,
  STAGING_CHUNK_SIZE: 300,
  RPC_BATCH_SIZE: 250,
  MAX_RUNTIME_MS: 240000,
  RPC_RESERVE_MS: 45000,
  CONTINUATION_DELAY_MS: 60000,
  CONTINUATION_HANDLER: 'continuarSyncAnalisesCurricularesIncremental',
  MAX_CONFIRMATION_CHECKS: 3,
  // [nao-trava] Sem progresso por mais que isto, o sync guardado e descartado e outro comeca.
  // Mesmo limite do banco (20261007170000): la a execucao parada sai como "encerrada por inatividade".
  MAX_SEM_PROGRESSO_MS: 30 * 60 * 1000
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
      // [nao-trava] Pendente remoto parado ha mais de 30 min e execucao morta: nao adota nem
      // espera; comeca um novo e o banco encerra o parado por inatividade ao iniciar.
      if (remotePending && pendenteRemotoParadoAnalisesIncremental_(remotePending, Date.now())) {
        Logger.log('Incremental: sync ' + remotePending.sync_id + ' (modo ' + remotePending.modo + ', status ' + remotePending.status +
          ') esta parado ha mais de 30 min; comecando um novo (o banco encerra o parado por inatividade).');
        remotePending = null;
        state = criarEstadoAnalisesIncremental_(Utilities.getUuid(), false);
        salvarEstadoAnalisesIncremental_(state);
      }
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
      } else if (!state && opts.resumeOnly) {
        return { ok: false, idle: true, motivo: 'Nenhum sync incremental pendente para retomar.' };
      }
    }

    if (!state) {
      state = criarEstadoAnalisesIncremental_(Utilities.getUuid(), false);
      salvarEstadoAnalisesIncremental_(state);
    }

    const snapshot = montarSnapshotAnalisesIncremental_();

    // [nao-trava] Antes de tudo, o banco diz se o sync guardado ainda pode seguir. Se nao pode
    // (erro, inexistente, parado ha mais de 30 min), o estado local sai e um sync novo comeca
    // nesta mesma execucao. Antes (06/10/2026), o cliente repetia "Status remoto nao permite
    // retomada: erro" a cada gatilho ate alguem apagar a propriedade a mao.
    let remote = consultarSyncAnalisesIncremental_(state.sync_id);
    const decisao = decidirRetomadaAnalisesIncremental_(state, remote, Date.now());
    if (decisao.acao === 'DESCARTAR') {
      state = descartarEstadoAnalisesIncremental_(state, decisao.motivo);
      remote = null;
    }

    validarSnapshotAnalisesIncremental_(state, snapshot);

    if (!state.snapshot_hash) {
      state.snapshot_hash = snapshot.snapshotHash;
      state.total_ativos_local = snapshot.fatoAtivo.length;
      state.total_editais_local = snapshot.editais.length;
      salvarEstadoAnalisesIncremental_(state);
    }

    if (!remote) {
      state.inFlight = { operation: 'iniciar_sync_analises_incremental', startedAt: new Date().toISOString() };
      salvarEstadoAnalisesIncremental_(state);
      const started = rpcAnalisesIncremental_('iniciar_sync_analises_incremental', { p_sync_id: state.sync_id, p_origem: ANALISES_INCREMENTAL_CFG.ORIGEM }, false); // [por-planilha]
      if (!started || started.ok !== true || started.sync_id !== state.sync_id) {
        return pendenciaAnalisesIncremental_(state, 'Resposta invalida ao iniciar sync incremental.', true);
      }
      if (Number(started.encerradas_por_inatividade || 0) > 0) {
        Logger.log('Incremental: o banco encerrou ' + started.encerradas_por_inatividade + ' execucao(oes) parada(s) desta planilha por inatividade.');
      }
      delete state.inFlight;
      state.remote_started = true;
      state.phase = 'COMPARING';
      marcarProgressoAnalisesIncremental_(state);
      salvarEstadoAnalisesIncremental_(state);
    } else {
      state.remote_started = true;
      if (remote.status === 'processado') {
        return concluirAnalisesIncremental_(state, remote, snapshot);
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
      marcarProgressoAnalisesIncremental_(state);
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
      marcarProgressoAnalisesIncremental_(state);
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

    // v2: anota as linhas no manifesto do sync; no fim, o banco desativa quem saiu
    // da planilha (20261001140000). O primeiro lote (index 0) recomeça o manifesto.
    const diff = rpcAnalisesIncremental_('comparar_analises_incremental_v2', {
      p_sync_id: state.sync_id,
      p_itens: manifesto,
      p_reiniciar: index === 0
    }, true);
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
    marcarProgressoAnalisesIncremental_(state);
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
      marcarProgressoAnalisesIncremental_(state);
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
    marcarProgressoAnalisesIncremental_(state);
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
      marcarProgressoAnalisesIncremental_(state);
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
  const agora = new Date().toISOString();
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
    created_at: agora,
    progress_at: agora
  };
}

// [nao-trava] Ultimo avanço confirmado (comparacao, envio, preparo, lote, finalizacao).
function marcarProgressoAnalisesIncremental_(state) {
  state.progress_at = new Date().toISOString();
}

/**
 * [nao-trava] Decide o que fazer com o sync guardado (PROP_STATE), pelo que o banco diz dele.
 * Funcao pura: sem Apps Script, testada em tests/apps-script-analises-incremental.test.js.
 *   INICIAR    o log remoto ainda nao existe e o inicio nao foi confirmado: inicia com o mesmo sync_id;
 *   RETOMAR    o banco aceita seguir (carregado/processando com progresso recente, ou processado);
 *   DESCARTAR  nao ha como seguir: status erro (ou outro fora da fila), log sumiu depois de
 *              iniciado, ou nenhum progresso local ha mais de MAX_SEM_PROGRESSO_MS.
 */
function decidirRetomadaAnalisesIncremental_(state, remote, agoraMs) {
  const limiteMin = Math.round(ANALISES_INCREMENTAL_CFG.MAX_SEM_PROGRESSO_MS / 60000);
  if (!remote) {
    if (state && state.remote_started) {
      return { acao: 'DESCARTAR', motivo: 'O sync ' + state.sync_id + ' nao existe mais no banco.' };
    }
    return { acao: 'INICIAR', motivo: 'Sync ainda nao iniciado no banco.' };
  }
  if (remote.status === 'processado') {
    return { acao: 'RETOMAR', motivo: 'Sync processado no banco; falta concluir localmente.' };
  }
  if (['carregado', 'processando'].indexOf(remote.status) === -1) {
    return { acao: 'DESCARTAR', motivo: 'Status remoto nao permite retomada: ' + remote.status };
  }
  const ultimo = Date.parse((state && (state.progress_at || state.created_at)) || '');
  if (!isFinite(ultimo) || agoraMs - ultimo > ANALISES_INCREMENTAL_CFG.MAX_SEM_PROGRESSO_MS) {
    return { acao: 'DESCARTAR', motivo: 'Sem progresso local ha mais de ' + limiteMin + ' min (fase ' + (state && state.phase) + ').' };
  }
  return { acao: 'RETOMAR', motivo: 'Sync ' + remote.status + ' com progresso recente.' };
}

/** [nao-trava] Pendente remoto (sem estado local) sem sinal no log ha mais de MAX_SEM_PROGRESSO_MS. Pura. */
function pendenteRemotoParadoAnalisesIncremental_(remote, agoraMs) {
  if (!remote) return false;
  const ultimo = Math.max(Date.parse(remote.updated_at || '') || 0, Date.parse(remote.created_at || '') || 0);
  return ultimo > 0 && agoraMs - ultimo > ANALISES_INCREMENTAL_CFG.MAX_SEM_PROGRESSO_MS;
}

// [nao-trava] Tira o sync guardado (nada e apagado no banco) e devolve um estado novo, ja salvo.
function descartarEstadoAnalisesIncremental_(state, motivo) {
  Logger.log('Incremental: estado local do sync ' + state.sync_id + ' (fase ' + state.phase + ') descartado: ' + motivo +
    ' Comecando um sync novo nesta execucao.');
  PropertiesService.getScriptProperties().deleteProperty(ANALISES_INCREMENTAL_CFG.PROP_STATE);
  limparContinuacoesAnalisesIncremental_();
  const novo = criarEstadoAnalisesIncremental_(Utilities.getUuid(), false);
  novo.descartado_anterior = { sync_id: state.sync_id, phase: state.phase, motivo: motivo, em: novo.created_at };
  salvarEstadoAnalisesIncremental_(novo);
  return novo;
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
    // Antes da preparação no banco (nada processado ainda): recomeça a
    // comparação com a planilha de agora, descartando o staging deste sync.
    // Antes, a planilha mudava entre duas execuções da comparação (a equipe
    // trabalhando) e o sync ficava travado para sempre (29/09/2026, 17 h sem
    // sincronizar a Saúde Indígena).
    // Inclui UPLOADING_EDITAIS e PREPARING: em 30/09 a preparação foi recusada
    // (linha de DIM_EDITAIS sem grupo) e a correção na planilha travaria de novo.
    if (!state.prepared && ['INIT', 'COMPARING', 'UPLOADING_EDITAIS', 'PREPARING'].indexOf(state.phase) !== -1) {
      recomecarComparacaoAnalisesIncremental_(state, snapshot);
      return;
    }
    throw new Error('A planilha mudou durante um sync incremental pendente. Nao misture snapshots. Conclua/reconcilie o sync atual antes de iniciar outro.');
  }
}

function recomecarComparacaoAnalisesIncremental_(state, snapshot) {
  // Staging deste sync (FATO alterados e DIM_EDITAIS) sai inteiro; é reenviado.
  requestIdempotenteAnalisesIncremental_(
    '/rest/v1/TM_ANALISE_CURRICULAR?sync_id=eq.' + encodeURIComponent(state.sync_id),
    'DELETE',
    undefined,
    { Prefer: 'return=minimal' },
    3
  );
  Logger.log('Planilha mudou durante a comparacao: recomecando o sync ' + state.sync_id + ' com a planilha atual (alterados descartados=' + Number(state.changed_count || 0) + ').');
  state.snapshot_hash = snapshot.snapshotHash;
  state.total_ativos_local = snapshot.fatoAtivo.length;
  state.total_editais_local = snapshot.editais.length;
  state.compare_index = 0;
  state.changed_count = 0;
  state.editais_uploaded = false;
  state.phase = 'COMPARING';
  marcarProgressoAnalisesIncremental_(state);
  salvarEstadoAnalisesIncremental_(state);
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
