/*
  Cópia de um payload do servidor guardada no navegador — o painel de análises
  e a lista de aprovados usam a mesma.

  ## O problema

  O painel de análises pedia o payload inteiro da área a cada abertura (Saúde
  Indígena: ≈3,5 MB) e a lista de aprovados, os candidatos da área (≈1,5 MB),
  mostrando o skeleton até chegar.

  ## O que este módulo decide

  Guardado e revalidado ("stale-while-revalidate"): ao abrir, a tela mostra a
  cópia guardada na hora e pede a versão nova por trás; só redesenha se ela
  mudou (cada tela diz como sabe). As proteções são as da cópia da sessão do
  MONITORA (`copia-da-sessao.js`):

  - de um usuário só: outro usuário abrindo aquele navegador apaga as cópias de
    quem veio antes (de todos os tipos: o registro do dono é um só);
  - por chave (`tipo.chave(contexto)`: área e escopo — nunca se misturam);
  - só para a mesma versão publicada do front (`versao`), um esquema aceito
    (`tipo.esquemas`) e por `VALIDADE_DO_CACHE_MS`;
  - a permissão é conferida pelo servidor a cada revalidação: acesso revogado
    (42501) ou área inválida (22023) apaga as cópias.

  O armazenamento (IndexedDB) é de `src/modules/cache-de-payload-indexeddb.js`
  e chega aqui como `{ ler(chave), guardar(chave, valor), apagarTudo() }`.
  Nenhuma função daqui lança erro por causa dele: falhou, é "não há cópia".

  Um tipo é `{ nome, chave(contexto), esquema(payload), esquemas, valido(payload) }`
  — ver `PAINEL_DE_ANALISES` (cache-do-painel-de-analises.js) e
  `LISTA_DE_APROVADOS` (candidatos-aprovados-compactos.js).
*/

export const VALIDADE_DO_CACHE_MS = 7 * 24 * 60 * 60 * 1000;

/* Registro que diz de quem são as cópias guardadas. */
export const CHAVE_DO_DONO = "__dono__";

const esquemaAceito = (tipo, esquema) => tipo.esquemas.includes(esquema);

export function montarRegistro({ usuarioId, versao, agora, payload, tipo }) {
  return {
    usuarioId,
    versao,
    guardadoEm: agora,
    esquema: tipo.esquema(payload),
    // Texto e não o objeto: gravar e ler 1 texto de MB é bem mais rápido que
    // clonar milhões de valores soltos.
    texto: JSON.stringify(payload),
  };
}

/** O payload do registro, se ele serve para esta abertura; senão `null`. */
export function payloadDoRegistro(
  registro,
  { usuarioId, versao, agora, tipo },
) {
  if (!registro || typeof registro !== "object" || !usuarioId) return null;
  const idade = agora - Number(registro.guardadoEm);
  if (
    registro.usuarioId !== usuarioId ||
    registro.versao !== versao ||
    !esquemaAceito(tipo, registro.esquema) ||
    !(idade >= 0 && idade <= VALIDADE_DO_CACHE_MS) ||
    typeof registro.texto !== "string"
  )
    return null;
  try {
    const payload = JSON.parse(registro.texto);
    return payload && tipo.valido(payload) ? payload : null;
  } catch {
    return null;
  }
}

/**
 * Cópias de um tipo de payload sobre um armazenamento. `versao` amarra a cópia
 * à publicação; `relogio` existe para o teste.
 */
export function criarCacheDePayload({
  armazenamento,
  versao,
  tipo,
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
    async ler(contexto) {
      const usuarioId = contexto?.usuarioId;
      if (!usuarioId || !(await confirmarDono(usuarioId))) return null;
      const registro = await seguro(
        () => armazenamento.ler(tipo.chave(contexto)),
        null,
      );
      return payloadDoRegistro(registro, {
        usuarioId,
        versao,
        agora: relogio(),
        tipo,
      });
    },

    async guardar(contexto, payload) {
      const usuarioId = contexto?.usuarioId;
      if (!usuarioId || !esquemaAceito(tipo, tipo.esquema(payload)))
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
        tipo,
      });
      return gravar(tipo.chave(contexto), registro);
    },

    apagarTudo() {
      return seguro(() => armazenamento.apagarTudo());
    },
  };
}

/** Erro de permissão (42501) ou de área (22023): a cópia não vale mais. */
export function ehErroDeAcesso(erro) {
  return ["42501", "22023"].includes(String(erro?.code ?? ""));
}

/**
 * Revalidação por trás de uma cópia já mostrada. Busca o payload novo, chama
 * `aoMudar(novo)` só se `mudou(guardado, novo)`, e guarda. Erro de permissão
 * ou de área apaga as cópias e chama `aoPerderAcesso(erro)`; outro erro (rede,
 * tempo) mantém a cópia na tela.
 */
export async function revalidarPayload({
  guardado,
  buscar,
  guardar,
  mudou,
  aoMudar,
  aoPerderAcesso,
  apagarTudo,
}) {
  try {
    const novo = await buscar();
    // Redesenha primeiro; a cópia nova é gravada em seguida.
    if (mudou(guardado, novo)) aoMudar(novo);
    await guardar(novo);
    return novo;
  } catch (erro) {
    if (ehErroDeAcesso(erro)) {
      await apagarTudo();
      aoPerderAcesso(erro);
    } else {
      console.warn("Não foi possível revalidar a cópia guardada:", erro);
    }
    return null;
  }
}
