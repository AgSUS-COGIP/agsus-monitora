/****************************************************
 * ENTREVISTAS -> MONITORA (Supabase)
 *
 * Vai no projeto Apps Script da planilha "[dash] entrevistados", ao lado do
 * script que monta a aba Entrevistados. Lê essa aba e envia tudo para o banco
 * (public.sincronizar_entrevistas em lotes + public.finalizar_sync_entrevistas).
 * A aba Entrevistas do MONITORA passa a mostrar esses dados.
 *
 * Nada na planilha é alterado. No banco, quem sumiu da planilha fica
 * desativado (não é apagado). Uma carga com menos da metade das linhas que
 * já estão no banco é recusada — protege contra uma aba vazia ou quebrada.
 *
 * Primeira vez (chave fixa, como nos outros scripts):
 *   1. Cole a chave service_role em CHAVE_FIXA, logo abaixo.
 *   2. Rode enviarEntrevistasParaSupabase e autorize.
 *   A chave fixa vale só dentro deste projeto; não copie este arquivo com a
 *   chave para o repositório nem para conversas. (Se preferir, a propriedade
 *   do script SUPABASE_SERVICE_ROLE_KEY tem prioridade sobre a fixa.)
 *   3. (Opcional) No onOpen do script da planilha, acrescente no menu:
 *        .addItem('Enviar para o MONITORA', 'enviarEntrevistasParaSupabase')
 *   4. (Opcional) instalarGatilhoEntrevistasMonitora: envia de hora em hora.
 *
 * Os nomes internos terminam em ES_: no Apps Script todos os arquivos do
 * projeto dividem o mesmo escopo e a última função com o mesmo nome vence.
 ****************************************************/

const ENTREVISTAS_MONITORA_CFG = {
  CHAVE_FIXA: '', // cole aqui a SUPABASE_SERVICE_ROLE_KEY, entre as aspas
  ABA: 'Entrevistados',
  AREA: 'saude-indigena',
  LOTE: 500,
  PROP_URL: 'SUPABASE_URL',
  PROP_CHAVE: 'SUPABASE_SERVICE_ROLE_KEY',
  URL_PADRAO: 'https://gnudtaxhjfgtvwkwpsel.supabase.co',
  MAX_CRITERIOS: 20
};


/**
 * Envia a aba Entrevistados para o MONITORA.
 * forcar = true aceita uma carga com menos da metade das linhas do banco.
 */
function enviarEntrevistasParaSupabase(forcar) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('Já existe um envio em andamento.');
  try {
    const linhas = lerEntrevistadosES_();
    if (!linhas.length) throw new Error('A aba "' + ENTREVISTAS_MONITORA_CFG.ABA + '" não tem linhas para enviar.');

    const sync = 'es-' + Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyyMMdd-HHmmss') + '-' +
      Utilities.getUuid().slice(0, 8);

    let gravadas = 0;
    for (let i = 0; i < linhas.length; i += ENTREVISTAS_MONITORA_CFG.LOTE) {
      const lote = linhas.slice(i, i + ENTREVISTAS_MONITORA_CFG.LOTE);
      const r = chamarRpcES_('sincronizar_entrevistas', {
        p_sync: sync,
        p_area: ENTREVISTAS_MONITORA_CFG.AREA,
        p_linhas: lote
      });
      gravadas += Number((r && r.gravadas) || 0);
    }

    const fim = chamarRpcES_('finalizar_sync_entrevistas', {
      p_sync: sync,
      p_area: ENTREVISTAS_MONITORA_CFG.AREA,
      p_forcar: forcar === true
    });

    const msg = fim && fim.situacao === 'CONCLUIDA'
      ? [
          'Entrevistas enviadas ao MONITORA.',
          'Linhas lidas: ' + linhas.length + ' · gravadas: ' + gravadas,
          'Ligadas à análise curricular: ' + fim.ligadas_analise,
          'Sem análise encontrada: ' + fim.sem_analise,
          'Sem edital cadastrado: ' + fim.sem_edital,
          'Saíram da planilha (desativadas): ' + fim.desativadas
        ].join('\n')
      : 'Envio RECUSADO: a planilha trouxe ' + (fim && fim.linhas) + ' linhas e o banco tem ' +
        (fim && fim.ativas) + ' ativas (menos da metade). Nada foi desativado. ' +
        'Confira a aba Entrevistados; se estiver certa, rode enviarEntrevistasForcandoES().';

    Logger.log(msg);
    avisarES_(msg);
    return fim;
  } finally {
    lock.releaseLock();
  }
}


/** Envio que aceita carga pequena (depois de conferir a planilha). */
function enviarEntrevistasForcandoES() {
  return enviarEntrevistasParaSupabase(true);
}


/** Envio automático de hora em hora (um gatilho só). */
function instalarGatilhoEntrevistasMonitora() {
  ScriptApp.getProjectTriggers()
    .filter(function (t) { return t.getHandlerFunction() === 'enviarEntrevistasAgendadoES'; })
    .forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('enviarEntrevistasAgendadoES').timeBased().everyHours(1).create();
  avisarES_('Envio automático das entrevistas instalado (de hora em hora).');
}


function enviarEntrevistasAgendadoES() {
  enviarEntrevistasParaSupabase(false);
}


/** Lê a aba Entrevistados no formato que o banco espera. */
function lerEntrevistadosES_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const aba = ss.getSheetByName(ENTREVISTAS_MONITORA_CFG.ABA);
  if (!aba) throw new Error('Aba "' + ENTREVISTAS_MONITORA_CFG.ABA + '" não encontrada.');

  const dados = aba.getDataRange().getDisplayValues();
  if (dados.length < 2) return [];

  const cab = dados[0].map(normalizarCabecalhoES_);
  const idx = {
    unidade: acharColunaES_(cab, ['DSEI']),
    edital: acharColunaES_(cab, ['EDITAL']),
    link: acharColunaES_(cab, ['LINK PLANILHA ENTREVISTA']),
    vaga: acharColunaES_(cab, ['VAGA']),
    candidato: acharColunaES_(cab, ['NOME']),
    modalidade: acharColunaES_(cab, ['MODALIDADE DE CONCORRENCIA', 'MODALIDADE']),
    cargo: acharColunaES_(cab, ['CARGO']),
    codigo: acharColunaES_(cab, ['CODIGO']),
    nota: acharColunaES_(cab, ['NOTA TOTAL']),
    parecer: acharColunaES_(cab, ['PARECER']),
    compareceu: acharColunaES_(cab, ['COMPARECIMENTO'])
  };
  ['unidade', 'edital', 'vaga', 'candidato'].forEach(function (k) {
    if (idx[k] < 0) throw new Error('Coluna obrigatória não encontrada na aba Entrevistados: ' + k);
  });

  // Pares "Critério N" / "Nota N" na ordem em que aparecem.
  const criterios = [];
  for (let n = 1; n <= ENTREVISTAS_MONITORA_CFG.MAX_CRITERIOS; n++) {
    const c = cab.indexOf('CRITERIO ' + n);
    const v = cab.indexOf('NOTA ' + n);
    if (c < 0 || v < 0) break;
    criterios.push({ c: c, v: v });
  }

  const saida = [];
  for (let i = 1; i < dados.length; i++) {
    const l = dados[i];
    const candidato = textoES_(l[idx.candidato]);
    const vaga = textoES_(l[idx.vaga]).replace(/\D/g, '');
    const edital = textoES_(l[idx.edital]);
    if (!candidato || !vaga || !edital) continue;

    saida.push({
      unidade: textoES_(l[idx.unidade]),
      edital: edital,
      vaga: vaga,
      candidato: candidato,
      codigo: idx.codigo < 0 ? '' : textoES_(l[idx.codigo]).replace(/\D/g, ''),
      modalidade: idx.modalidade < 0 ? '' : textoES_(l[idx.modalidade]),
      cargo: idx.cargo < 0 ? '' : textoES_(l[idx.cargo]),
      nota: idx.nota < 0 ? '' : textoES_(l[idx.nota]),
      parecer: idx.parecer < 0 ? '' : textoES_(l[idx.parecer]),
      compareceu: idx.compareceu < 0 ? '' : textoES_(l[idx.compareceu]),
      link: idx.link < 0 ? '' : textoES_(l[idx.link]),
      notas: criterios
        .map(function (p) { return { criterio: textoES_(l[p.c]), nota: textoES_(l[p.v]) }; })
        .filter(function (x) { return x.criterio; })
    });
  }
  return saida;
}


function chamarRpcES_(funcao, corpo) {
  const props = PropertiesService.getScriptProperties();
  const url = String(props.getProperty(ENTREVISTAS_MONITORA_CFG.PROP_URL) || ENTREVISTAS_MONITORA_CFG.URL_PADRAO)
    .replace(/\/$/, '');
  const chave = String(props.getProperty(ENTREVISTAS_MONITORA_CFG.PROP_CHAVE) ||
    ENTREVISTAS_MONITORA_CFG.CHAVE_FIXA || '').trim();
  if (!chave) {
    throw new Error('Falta a chave: cole a service_role em CHAVE_FIXA, no topo deste arquivo.');
  }

  let ultimoErro = null;
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    const resp = UrlFetchApp.fetch(url + '/rest/v1/rpc/' + funcao, {
      method: 'post',
      contentType: 'application/json',
      headers: { apikey: chave, Authorization: 'Bearer ' + chave },
      payload: JSON.stringify(corpo),
      muteHttpExceptions: true
    });
    const status = resp.getResponseCode();
    const texto = resp.getContentText();
    if (status >= 200 && status < 300) return texto ? JSON.parse(texto) : null;
    ultimoErro = new Error(funcao + ' respondeu ' + status + ': ' + texto.slice(0, 500));
    // Erro do banco (4xx) não melhora repetindo; só rede/servidor (5xx).
    if (status < 500) break;
    Utilities.sleep(1500 * tentativa);
  }
  throw ultimoErro;
}


function avisarES_(msg) {
  try {
    SpreadsheetApp.getUi().alert(msg);
  } catch (e) {
    // Rodando por gatilho: não há tela; fica no registro de execução.
  }
}


function acharColunaES_(cab, nomes) {
  const alvos = nomes.map(normalizarCabecalhoES_);
  for (let i = 0; i < cab.length; i++) if (alvos.indexOf(cab[i]) >= 0) return i;
  for (let i = 0; i < cab.length; i++) {
    for (let j = 0; j < alvos.length; j++) if (cab[i].indexOf(alvos[j]) === 0) return i;
  }
  return -1;
}


function normalizarCabecalhoES_(v) {
  return String(v || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}


function textoES_(v) {
  return String(v === null || v === undefined ? '' : v).replace(/\s+/g, ' ').trim();
}
