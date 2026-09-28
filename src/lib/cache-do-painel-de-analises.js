/*
  Cópia do payload do painel de análises guardada no navegador.

  ## O problema

  O painel pedia o payload inteiro da área a cada abertura (Saúde Indígena:
  ≈3,5 MB) e mostrava o skeleton até ele chegar. O cache antigo, no
  `localStorage`, gravava as linhas já decodificadas — bem mais que os 5 MB do
  `localStorage` — e falhava calado: na prática não havia cache.

  ## O que este módulo decide

  Guardado e revalidado ("stale-while-revalidate"): ao abrir, o painel mostra
  a cópia guardada na hora e pede a versão nova por trás; só redesenha se ela
  mudou (`generated_at` diferente — o servidor devolve a hora em que montou o
  payload, que não muda entre um sync e outro). As proteções são as da cópia da
  sessão do MONITORA (`copia-da-sessao.js`):

  - de um usuário só: outro usuário abrindo o painel naquele navegador apaga as
    cópias de quem veio antes;
  - por área e escopo (as áreas nunca se misturam);
  - só para a mesma versão publicada do painel, o mesmo `schema_version` do
    payload e por `VALIDADE_DO_CACHE_MS`;
  - a permissão é sempre consultada antes de abrir o painel, e o servidor
    confere de novo a cada revalidação: acesso revogado apaga as cópias.

  O armazenamento (IndexedDB) é de `src/modules/cache-das-analises-indexeddb.js`
  e chega aqui como `{ ler(chave), guardar(chave, valor), apagarTudo() }`.
  Nenhuma função daqui lança erro por causa dele: falhou, é "não há cópia".
*/
import { chaveDoCacheDoPayload } from "./area-do-painel-de-analises.js";

export const VALIDADE_DO_CACHE_MS = 7 * 24 * 60 * 60 * 1000;

/* `schema_version` do payload de get_analises_dashboard_payload_v2 que a cópia aceita. */
export const ESQUEMA_DO_PAYLOAD = 3;

/* Registro que diz de quem são as cópias guardadas. */
export const CHAVE_DO_DONO = "__dono__";

/* Chaves do cache antigo no localStorage (e o marcador da migração dele). */
const PREFIXO_DO_CACHE_ANTIGO = "agsus_analises_cache_";
const MARCADOR_DO_CACHE_ANTIGO = "agsus_analises_responsavel_normalizado_v1";

const texto = (valor) => String(valor ?? "").trim();

/** O que identifica a versão dos dados de um payload. */
export function versaoDoPayload(payload) {
  return texto(payload?.generated_at);
}

/** O payload novo traz dados diferentes dos da cópia? */
export function payloadMudou(anterior, novo) {
  if (!anterior || !novo) return true;
  const versaoAnterior = versaoDoPayload(anterior);
  return (
    !versaoAnterior ||
    versaoAnterior !== versaoDoPayload(novo) ||
    Number(anterior.total) !== Number(novo.total)
  );
}

export function montarRegistro({ usuarioId, versao, agora, payload }) {
  return {
    usuarioId,
    versao,
    guardadoEm: agora,
    esquema: payload?.schema_version,
    // Texto e não o objeto: gravar e ler 1 texto de MB é bem mais rápido que
    // clonar milhões de valores soltos.
    texto: JSON.stringify(payload),
  };
}

/** O payload do registro, se ele serve para esta abertura; senão `null`. */
export function payloadDoRegistro(registro, { usuarioId, versao, agora }) {
  if (!registro || typeof registro !== "object" || !usuarioId) return null;
  const idade = agora - Number(registro.guardadoEm);
  if (
    registro.usuarioId !== usuarioId ||
    registro.versao !== versao ||
    registro.esquema !== ESQUEMA_DO_PAYLOAD ||
    !(idade >= 0 && idade <= VALIDADE_DO_CACHE_MS) ||
    typeof registro.texto !== "string"
  )
    return null;
  try {
    const payload = JSON.parse(registro.texto);
    return payload && Array.isArray(payload.rows) ? payload : null;
  } catch {
    return null;
  }
}

/**
 * Cópias do painel sobre um armazenamento. `versao` amarra a cópia à
 * publicação; `relogio` existe para o teste.
 */
export function criarCacheDoPainel({
  armazenamento,
  versao,
  relogio = Date.now,
}) {
  async function seguro(operar, padrao) {
    try {
      return await operar();
    } catch {
      return padrao;
    }
  }

  const gravar = (chave, valor) =>
    seguro(async () => {
      await armazenamento.guardar(chave, valor);
      return true;
    }, false);

  /** Apaga as cópias de outro usuário; devolve se o dono é este. */
  async function confirmarDono(usuarioId) {
    const dono = await seguro(() => armazenamento.ler(CHAVE_DO_DONO), null);
    if (dono === usuarioId) return true;
    if (dono) await seguro(() => armazenamento.apagarTudo());
    return false;
  }

  return {
    async ler({ usuarioId, area, escopo }) {
      if (!usuarioId || !(await confirmarDono(usuarioId))) return null;
      const registro = await seguro(
        () => armazenamento.ler(chaveDoCacheDoPayload(area, escopo)),
        null,
      );
      return payloadDoRegistro(registro, {
        usuarioId,
        versao,
        agora: relogio(),
      });
    },

    async guardar({ usuarioId, area, escopo }, payload) {
      if (!usuarioId || payload?.schema_version !== ESQUEMA_DO_PAYLOAD)
        return false;
      if (
        !(await confirmarDono(usuarioId)) &&
        !(await gravar(CHAVE_DO_DONO, usuarioId))
      )
        return false;
      const registro = montarRegistro({
        usuarioId,
        versao,
        agora: relogio(),
        payload,
      });
      return gravar(chaveDoCacheDoPayload(area, escopo), registro);
    },

    apagarTudo() {
      return seguro(() => armazenamento.apagarTudo());
    },
  };
}

/**
 * Revalidação por trás de uma cópia já mostrada. Busca o payload novo, chama
 * `aoMudar(novo)` só se ele difere da cópia, e guarda. Erro de permissão ou de
 * área (42501/22023) apaga as cópias e chama `aoPerderAcesso(erro)`; outro
 * erro (rede, tempo) mantém a cópia na tela.
 */
export async function revalidarPayload({
  guardado,
  buscar,
  guardar,
  aoMudar,
  aoPerderAcesso,
  apagarTudo,
}) {
  try {
    const novo = await buscar();
    // Redesenha primeiro; a cópia nova é gravada em seguida.
    if (payloadMudou(guardado, novo)) aoMudar(novo);
    await guardar(novo);
    return novo;
  } catch (erro) {
    if (["42501", "22023"].includes(String(erro?.code ?? ""))) {
      await apagarTudo();
      aoPerderAcesso(erro);
    } else {
      console.warn("Não foi possível revalidar o painel de análises:", erro);
    }
    return null;
  }
}

/** Chaves do cache antigo do painel no localStorage, para liberar espaço. */
export function chavesDoCacheAntigo(chaves) {
  return [...chaves].filter(
    (chave) =>
      typeof chave === "string" &&
      (chave.startsWith(PREFIXO_DO_CACHE_ANTIGO) ||
        chave === MARCADOR_DO_CACHE_ANTIGO),
  );
}
