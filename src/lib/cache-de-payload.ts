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
  — ver `PAINEL_DE_ANALISES` (cache-do-painel-de-analises.ts) e
  `LISTA_DE_APROVADOS` (candidatos-aprovados-compactos.ts).
*/

/** O armazenamento (IndexedDB): pode lançar erro; aqui ele vira "não há cópia". */
export interface ArmazenamentoDoCache {
  ler(chave: string): unknown;
  guardar(chave: string, valor: unknown): unknown;
  apagarTudo(): unknown;
}

/** Um tipo de payload guardado; `C` é o contexto que dá a chave da cópia. */
export interface TipoDePayload<C> {
  readonly nome?: string;
  chave(contexto: C): string;
  esquema(payload: unknown): unknown;
  readonly esquemas: readonly unknown[];
  valido(payload: unknown): boolean;
}

/** O que identifica a abertura: o usuário da sessão e o resto da chave. */
export type ContextoDoCache<C> = C & { usuarioId?: unknown };

/** O registro gravado no armazenamento. */
export interface RegistroDoCache {
  usuarioId: unknown;
  versao: unknown;
  guardadoEm: number;
  esquema: unknown;
  texto: string;
}

export const VALIDADE_DO_CACHE_MS = 7 * 24 * 60 * 60 * 1000;

/*
  As RPCs `*_se_mudou` (migration 20261013160000) recebem a `versao` da cópia
  e, se ela ainda vale, devolvem só `{ inalterado: true, versao }` em vez do
  payload inteiro: a revalidação deixa de baixar megabytes para nada.
*/

/** A versão dos dados que o banco mandou junto do payload, ou `null`. */
export function versaoDoPacote(payload: unknown): string | null {
  const versao = (payload as { versao?: unknown } | null | undefined)?.versao;
  return typeof versao === "string" && versao ? versao : null;
}

/** O banco disse que a versão enviada ainda vale? */
export const respostaInalterada = (resposta: unknown): boolean =>
  Boolean(resposta) &&
  (resposta as { inalterado?: unknown }).inalterado === true;

/* Registro que diz de quem são as cópias guardadas. */
export const CHAVE_DO_DONO = "__dono__";

const esquemaAceito = <C>(tipo: TipoDePayload<C>, esquema: unknown) =>
  tipo.esquemas.includes(esquema);

export function montarRegistro<C>({
  usuarioId,
  versao,
  agora,
  payload,
  tipo,
}: {
  usuarioId: unknown;
  versao: unknown;
  agora: number;
  payload: unknown;
  tipo: TipoDePayload<C>;
}): RegistroDoCache {
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
export function payloadDoRegistro<C>(
  registro: unknown,
  {
    usuarioId,
    versao,
    agora,
    tipo,
  }: {
    usuarioId: unknown;
    versao: unknown;
    agora: number;
    tipo: TipoDePayload<C>;
  },
): unknown {
  if (!registro || typeof registro !== "object" || !usuarioId) return null;
  const lido = registro as Partial<Record<keyof RegistroDoCache, unknown>>;
  const idade = agora - Number(lido.guardadoEm);
  if (
    lido.usuarioId !== usuarioId ||
    lido.versao !== versao ||
    !esquemaAceito(tipo, lido.esquema) ||
    !(idade >= 0 && idade <= VALIDADE_DO_CACHE_MS) ||
    typeof lido.texto !== "string"
  )
    return null;
  try {
    const payload: unknown = JSON.parse(lido.texto);
    return payload && tipo.valido(payload) ? payload : null;
  } catch {
    return null;
  }
}

/** As cópias de um tipo de payload: ler, guardar e apagar tudo. */
export interface CacheDePayload<C> {
  ler(contexto: ContextoDoCache<C> | null | undefined): Promise<unknown>;
  guardar(
    contexto: ContextoDoCache<C> | null | undefined,
    payload: unknown,
  ): Promise<boolean>;
  apagarTudo(): Promise<unknown>;
}

/**
 * Cópias de um tipo de payload sobre um armazenamento. `versao` amarra a cópia
 * à publicação; `relogio` existe para o teste.
 */
export function criarCacheDePayload<C>({
  armazenamento,
  versao,
  tipo,
  relogio = Date.now,
}: {
  armazenamento: ArmazenamentoDoCache;
  versao: unknown;
  tipo: TipoDePayload<C>;
  relogio?: () => number;
}): CacheDePayload<C> {
  async function seguro<R, P = undefined>(
    operar: () => R | PromiseLike<R>,
    padrao?: P,
  ): Promise<R | P> {
    try {
      return await operar();
    } catch {
      return padrao as P;
    }
  }

  const gravar = (chave: string, valor: unknown) =>
    seguro(async () => {
      await armazenamento.guardar(chave, valor);
      return true;
    }, false);

  /** Apaga as cópias de outro usuário; devolve se o dono é este. */
  async function confirmarDono(usuarioId: unknown) {
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
        () => armazenamento.ler(tipo.chave(contexto as C)),
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
      return gravar(tipo.chave(contexto as C), registro);
    },

    apagarTudo() {
      return seguro(() => armazenamento.apagarTudo());
    },
  };
}

/** Erro de permissão (42501) ou de área (22023): a cópia não vale mais. */
export function ehErroDeAcesso(erro: unknown): boolean {
  return ["42501", "22023"].includes(
    String((erro as { code?: unknown } | null | undefined)?.code ?? ""),
  );
}

/**
 * Revalidação por trás de uma cópia já mostrada. Busca o payload novo, chama
 * `aoMudar(novo)` só se `mudou(guardado, novo)`, e guarda. Erro de permissão
 * ou de área apaga as cópias e chama `aoPerderAcesso(erro)`; outro erro (rede,
 * tempo) mantém a cópia na tela.
 *
 * `mudou` aparece como opcional porque o painel de análises
 * (src/modulos/analises/consultas.ts) chama pelo `revalidarPayload` de
 * cache-do-painel-de-analises, que o injeta (`payloadMudou`); as outras telas
 * (aprovados, entrevistas) o passam aqui direto. Sem ele não há revalidação.
 */
export async function revalidarPayload<N>({
  guardado,
  buscar,
  guardar,
  mudou,
  aoMudar,
  aoPerderAcesso,
  apagarTudo,
}: {
  guardado: unknown;
  buscar: () => N | PromiseLike<N>;
  guardar: (novo: N) => unknown;
  mudou?: (guardado: unknown, novo: N) => boolean;
  aoMudar: (novo: N) => void;
  aoPerderAcesso: (erro: unknown) => void;
  apagarTudo: () => unknown;
}): Promise<N | null> {
  try {
    const novo = await buscar();
    // Redesenha primeiro; a cópia nova é gravada em seguida.
    if ((mudou as NonNullable<typeof mudou>)(guardado, novo)) aoMudar(novo);
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
