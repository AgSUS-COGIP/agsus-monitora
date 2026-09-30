/*
  Comemorações do MONITORA, sem DOM: a regra de QUANDO comemorar e O QUE dizer.
  O desenho (confete em <canvas> e o aviso) é de src/modules/comemoracao.js.

  Comemora-se o PROCESSO e a EQUIPE, nunca uma pessoa (nada de ranking):
    - edital 100% analisado e fila de análises zerada (painel de análises);
    - vaga pronta para o resultado final (painel de entrevistas);
    - marcos do ano da área (1.000, 2.500, 5.000, 7.500, 10.000 e, dali em
      diante, a cada 5.000 análises concluídas);
    - o acesso liberado (src/lib/acesso-liberado.js).

  Liga/desliga global: `sistema.comemoracoes` de obter_situacao_do_sistema
  (Configurações › Módulos e abas › Sistema inteiro). Sem resposta, desligado:
  comemoração nunca é motivo para travar nada, e na dúvida não aparece.

  LINHA DE BASE: só comemora TRANSIÇÃO vista por esta pessoa neste navegador.
  Na primeira vez que um tipo de marco é avaliado para o usuário e a área, o
  estado atual é guardado em silêncio (localStorage); a comemoração vem quando
  uma leitura seguinte mostra a mudança. Assim, publicar a novidade não solta
  dezenas de confetes pelo que já estava concluído. Guardar o estado novo
  depois de comemorar faz cada marco aparecer uma vez por pessoa.

  Armazenamento sempre em try/catch (janela privada, bloqueado): sem ele, não
  há linha de base e, portanto, nenhuma comemoração de marco.
*/

export const DURACAO_DOS_FOGOS_MS = 3000;
export const PREFIXO_DO_MARCO = "agsus_monitora_marco:";
/* Os marcos do ano; depois do último, a cada PASSO_DOS_MARCOS. */
export const MARCOS_DO_ANO = Object.freeze([1000, 2500, 5000, 7500, 10000]);
export const PASSO_DOS_MARCOS = 5000;

const texto = (valor) => String(valor ?? "").trim();

// ── Armazenamento ───────────────────────────────────────────────────────────

export function lerArmazenamento(armazenamento, chave) {
  try {
    return armazenamento?.getItem(chave) ?? null;
  } catch {
    return null;
  }
}

/** Grava (ou apaga, com `null`). Devolve se conseguiu. */
export function gravarArmazenamento(armazenamento, chave, valor) {
  try {
    if (!armazenamento) return false;
    if (valor === null) armazenamento.removeItem(chave);
    else armazenamento.setItem(chave, valor);
    return true;
  } catch {
    return false;
  }
}

/** A chave do estado guardado de um tipo de marco, por usuário e área. */
export function chaveDoMarco(tipo, usuarioId, area) {
  return `${PREFIXO_DO_MARCO}${texto(tipo)}:${texto(usuarioId)}:${texto(area)}`;
}

/**
 * Compara o estado atual com o guardado e guarda o atual. Devolve o anterior,
 * ou `null` quando não havia (a linha de base acabou de ser gravada) ou não
 * há armazenamento — nos dois casos, nada a comemorar.
 */
export function trocarEstadoGuardado({ armazenamento, chave, atual }) {
  const bruto = lerArmazenamento(armazenamento, chave);
  let anterior = null;
  if (bruto !== null) {
    try {
      anterior = JSON.parse(bruto);
    } catch {
      anterior = null;
    }
  }
  const gravou = gravarArmazenamento(
    armazenamento,
    chave,
    JSON.stringify(atual),
  );
  return gravou ? anterior : null;
}

// ── Liga/desliga ────────────────────────────────────────────────────────────

/**
 * `sistema.comemoracoes` da resposta de obter_situacao_do_sistema. Resposta
 * sem o objeto `sistema` (falha, sem sessão) desliga; `sistema` sem o campo
 * (banco anterior à migration 20260930150000) vale o padrão do banco: ligado.
 */
export function comemoracoesLigadasNaResposta(dados) {
  if (!dados || typeof dados !== "object" || Array.isArray(dados)) return false;
  const sistema = dados.sistema;
  if (!sistema || typeof sistema !== "object") return false;
  return sistema.comemoracoes !== false;
}

// ── Painel de análises: edital concluído e fila zerada ──────────────────────

/* "Pendente" (ou sem status) é o que ainda não foi analisado. */
export const analisePendente = (linha) =>
  (texto(linha?.status_consolidado) || "Pendente") === "Pendente";

const chaveDoEdital = (linha) =>
  `${texto(linha?.edital)}|${texto(linha?.unidade)}`;

/**
 * Por edital (número + unidade): total de análises e quantas estão
 * pendentes. `{ [chave]: { edital, unidade, total, pendentes } }`.
 */
export function situacaoDosEditais(linhas) {
  const mapa = {};
  for (const linha of Array.isArray(linhas) ? linhas : []) {
    if (!texto(linha?.edital)) continue;
    const chave = chaveDoEdital(linha);
    mapa[chave] ??= {
      edital: texto(linha.edital),
      unidade: texto(linha.unidade),
      total: 0,
      pendentes: 0,
    };
    mapa[chave].total += 1;
    if (analisePendente(linha)) mapa[chave].pendentes += 1;
  }
  return mapa;
}

/** O que se guarda dos editais: `{ [chave]: pendentes }`. */
export function estadoGuardadoDosEditais(situacao) {
  return Object.fromEntries(
    Object.entries(situacao || {}).map(([chave, e]) => [chave, e.pendentes]),
  );
}

/**
 * Os editais que TINHAM pendências na leitura anterior e agora não têm
 * nenhuma (com pelo menos uma análise). Edital que não estava na leitura
 * anterior não conta: não houve transição vista.
 */
export function editaisConcluidos(anterior, situacao) {
  if (!anterior || typeof anterior !== "object") return [];
  return Object.entries(situacao || {})
    .filter(
      ([chave, e]) =>
        Number(anterior[chave]) > 0 && e.total >= 1 && e.pendentes === 0,
    )
    .map(([, e]) => e);
}

export const pendentesDaFila = (linhas) =>
  (Array.isArray(linhas) ? linhas : []).filter(analisePendente).length;

/** A fila foi de >0 pendentes para 0 (com a leitura anterior conhecida). */
export function filaZerou(anterior, pendentes) {
  return Number(anterior) > 0 && pendentes === 0;
}

export function mensagemDoEditalConcluido({ edital, unidade }) {
  const nome = [texto(edital), texto(unidade)].filter(Boolean).join(" · ");
  return `Edital ${nome} concluído! 🎉 Todas as análises foram feitas.`;
}

export function mensagemDaFilaZerada(nomeDaArea) {
  const onde = texto(nomeDaArea) ? ` na ${texto(nomeDaArea)}` : "";
  return `Fila de análises zerada${onde}! Parabéns, equipe. 🎉`;
}

/**
 * O que o painel de análises comemora nesta leitura. `anterior` é
 * `{ editais, fila }` guardado (ou nulos, na linha de base). Devolve
 * `{ texto, itens }` ou `null`: um aviso só, com os demais editais na lista.
 */
export function comemoracaoDasAnalises({
  anteriorEditais,
  anteriorFila,
  situacao,
  pendentes,
  nomeDaArea,
}) {
  const concluidos = editaisConcluidos(anteriorEditais, situacao);
  const zerou = filaZerou(anteriorFila, pendentes);
  const mensagens = [
    ...concluidos.map(mensagemDoEditalConcluido),
    ...(zerou ? [mensagemDaFilaZerada(nomeDaArea)] : []),
  ];
  if (!mensagens.length) return null;
  const [primeira, ...demais] = mensagens;
  return { texto: primeira, itens: demais };
}

// ── Painel de entrevistas: vaga pronta ──────────────────────────────────────

const chaveDaVaga = (item) => `${texto(item?.edital)}|${texto(item?.vaga)}`;

/**
 * Por vaga (edital + código): pronta quando tem entrevista, nenhum aprovado
 * na análise está sem entrevista e toda entrevista tem parecer.
 * `{ [chave]: { vaga, cargo, edital, pronta } }`.
 */
export function situacaoDasVagas({ entrevistas, aprovadosSemEntrevista } = {}) {
  const mapa = {};
  for (const e of Array.isArray(entrevistas) ? entrevistas : []) {
    if (!texto(e?.vaga)) continue;
    const chave = chaveDaVaga(e);
    mapa[chave] ??= {
      vaga: texto(e.vaga),
      cargo: texto(e.cargo),
      edital: texto(e.edital),
      pronta: true,
    };
    if (!mapa[chave].cargo && texto(e.cargo))
      mapa[chave].cargo = texto(e.cargo);
    if (texto(e.parecer || "SEM_PARECER") === "SEM_PARECER")
      mapa[chave].pronta = false;
  }
  for (const a of Array.isArray(aprovadosSemEntrevista)
    ? aprovadosSemEntrevista
    : []) {
    if (!texto(a?.vaga)) continue;
    const chave = chaveDaVaga(a);
    mapa[chave] ??= {
      vaga: texto(a.vaga),
      cargo: texto(a.cargo),
      edital: texto(a.edital),
      pronta: false,
    };
    mapa[chave].pronta = false;
  }
  return mapa;
}

export function estadoGuardadoDasVagas(situacao) {
  return Object.fromEntries(
    Object.entries(situacao || {}).map(([chave, v]) => [chave, v.pronta]),
  );
}

/** As vagas que estavam incompletas na leitura anterior e agora estão prontas. */
export function vagasProntas(anterior, situacao) {
  if (!anterior || typeof anterior !== "object") return [];
  return Object.entries(situacao || {})
    .filter(([chave, v]) => anterior[chave] === false && v.pronta)
    .map(([, v]) => v);
}

export function mensagemDaVagaPronta({ vaga, cargo }) {
  const nome = [texto(vaga), texto(cargo)].filter(Boolean).join(" · ");
  return `Vaga ${nome} pronta para o resultado final.`;
}

export function comemoracaoDasEntrevistas({ anterior, situacao }) {
  const prontas = vagasProntas(anterior, situacao);
  if (!prontas.length) return null;
  const [primeira, ...demais] = prontas.map(mensagemDaVagaPronta);
  return { texto: primeira, itens: demais };
}

// ── Marcos do ano ───────────────────────────────────────────────────────────

/** O maior marco já alcançado com `quantidade` (0 se nenhum). */
export function marcoAlcancado(quantidade) {
  const n = Math.floor(Number(quantidade) || 0);
  const ultimo = MARCOS_DO_ANO.at(-1);
  if (n >= ultimo)
    return (
      ultimo + Math.floor((n - ultimo) / PASSO_DOS_MARCOS) * PASSO_DOS_MARCOS
    );
  return [...MARCOS_DO_ANO].reverse().find((marco) => n >= marco) || 0;
}

/**
 * O marco novo desta leitura, ou 0. `anterior` é `{ ano, marco }` guardado;
 * sem ele (primeira vez da pessoa), anuncia o marco já alcançado no ano — é
 * notícia da equipe, não uma pendência antiga (pedido de 30/09). Guardado de um ano
 * anterior: a contagem recomeçou, e o ano novo parte de zero para quem já
 * acompanhava.
 */
export function marcoNovo(anterior, { ano, quantidade }) {
  if (!anterior || typeof anterior !== "object")
    return marcoAlcancado(quantidade);
  const anoAnterior = Number(anterior.ano);
  if (anoAnterior > Number(ano)) return 0;
  const jaVisto = anoAnterior === Number(ano) ? Number(anterior.marco) || 0 : 0;
  const atual = marcoAlcancado(quantidade);
  return atual > jaVisto ? atual : 0;
}

/**
 * O que guardar e o que comemorar numa leitura de obter_marcos_da_area.
 * `{ estado: { ano, marco }, novo }`: `novo` é o marco a anunciar (0 se
 * nenhum). O marco guardado nunca desce no mesmo ano (uma análise
 * desativada não faz o mesmo marco voltar).
 */
export function proximoEstadoDoMarco(anterior, { ano, quantidade }) {
  const alcancado = marcoAlcancado(quantidade);
  const mesmoAno =
    anterior &&
    typeof anterior === "object" &&
    Number(anterior.ano) === Number(ano);
  const guardado = mesmoAno ? Number(anterior.marco) || 0 : 0;
  return {
    estado: { ano: Number(ano), marco: Math.max(alcancado, guardado) },
    novo: marcoNovo(anterior, { ano, quantidade }),
  };
}

export const formatarMarco = (numero) =>
  Math.floor(Number(numero) || 0).toLocaleString("pt-BR");

export function mensagemDoMarcoDoAno({ nomeDaArea, marco, ano }) {
  const equipe = texto(nomeDaArea)
    ? `A equipe da ${texto(nomeDaArea)}`
    : "A equipe";
  return `🎉 ${equipe} passou de ${formatarMarco(marco)} análises concluídas em ${ano}!`;
}
