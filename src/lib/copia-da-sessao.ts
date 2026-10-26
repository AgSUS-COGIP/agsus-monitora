/*
  Cópia da sessão guardada no navegador, para a entrada abrir sem esperar a rede.

  ## O problema

  A cada entrada, inclusive ao sair e entrar de novo, o sistema pedia ao Supabase
  configurações, painéis, mapa, unidades e monitoramento, e a tela de
  carregamento ficava até o último voltar.

  ## O que este módulo decide

  Quando uma cópia da sessão anterior serve, a tela abre com ela e as consultas
  reais chegam por trás; só o que mudou é reaplicado. A cópia fica no navegador
  depois da saída, por decisão do produto: é isso que faz sair e entrar ser
  imediato. As proteções:

  - uma cópia só, de um usuário: outro usuário entrando naquele navegador a apaga;
  - vale só com o mesmo acesso: mudou perfil, permissão, área ou painel liberado,
    ela é descartada, para nunca mostrar o que a pessoa deixou de poder ver;
  - vale só para a mesma versão publicada do sistema e por `VALIDADE_DA_COPIA_MS`;
  - o perfil é sempre consultado antes: acesso revogado não chega a ver a cópia.

  A leitura e a gravação no IndexedDB são de `src/modules/copia-da-sessao-indexeddb.js`.
*/

export const VALIDADE_DA_COPIA_MS = 7 * 24 * 60 * 60 * 1000;

/** Resposta de uma consulta da entrada (supabase-js), com a `versao` quando há. */
export interface RespostaDaConsulta {
  data?: unknown;
  error?: unknown;
  versao?: unknown;
}

/** As respostas das consultas da entrada, por parte. */
export type RespostasDaEntrada = Record<
  string,
  RespostaDaConsulta | null | undefined
>;

/** O que a cópia guarda: os dados de cada parte da entrada. */
export interface DadosDaCopia {
  [parte: string]: unknown;
  versaoDoMapa?: unknown;
  monitoramento?: { linhas: unknown; versao: unknown } | null;
}

export interface CopiaDaSessao {
  usuarioId: unknown;
  acesso: unknown;
  versao: unknown;
  guardadaEm: unknown;
  dados: DadosDaCopia;
}

/** O que identifica esta abertura: usuário, acesso, versão e hora. */
export interface AberturaDaSessao {
  usuarioId: unknown;
  acesso: unknown;
  versao: unknown;
  agora: number;
}

const PARTES_SIMPLES = Object.freeze(["config", "paineis", "mapa", "unidades"]);

/*
  Partes que podem faltar sem invalidar a cópia: `abas` (o catálogo de abas do
  menu) tem reserva no código (`ABAS_DO_MENU`, em `menu-lateral.ts`), com o
  mesmo menu. Falhou ou a função ainda não existe no banco, a parte fica `null`.
*/
const PARTES_OPCIONAIS = Object.freeze(["abas"]);

/** O que muda a cada acesso sem mudar o que a pessoa pode ver. */
const CAMPO_DE_DATA = /(^|_)(em|at)$|^ultimo_|^last_/;

/** JSON com as chaves em ordem, para a mesma informação dar o mesmo texto. */
function jsonEstavel(valor: unknown): string {
  if (Array.isArray(valor)) return `[${valor.map(jsonEstavel).join(",")}]`;
  if (valor && typeof valor === "object")
    return `{${Object.keys(valor)
      .sort()
      .map(
        (chave) =>
          `${JSON.stringify(chave)}:${jsonEstavel((valor as Record<string, unknown>)[chave])}`,
      )
      .join(",")}}`;
  return JSON.stringify(valor ?? null);
}

/**
 * Resumo do que define o acesso: o perfil inteiro (menos datas) e os painéis
 * liberados. Campo novo no perfil entra sozinho; na dúvida, a cópia é descartada.
 */
export function assinaturaDoAcesso(
  perfil: object | null | undefined,
  paineisLiberados: Iterable<unknown> = [],
): string {
  const campos = Object.fromEntries(
    Object.entries(perfil || {}).filter(
      ([chave]) => !CAMPO_DE_DATA.test(chave),
    ),
  );
  const paineis = [...paineisLiberados].map(String).sort();
  return jsonEstavel({ perfil: campos, paineis });
}

/** Espera todas as consultas e devolve as respostas com as mesmas chaves. */
export async function respostasDasConsultas<T extends Record<string, unknown>>(
  consultas: T,
): Promise<{ [K in keyof T]: Awaited<T[K]> }> {
  const partes = Object.keys(consultas);
  const respostas = await Promise.all(partes.map((parte) => consultas[parte]));
  return Object.fromEntries(
    partes.map((parte, i) => [parte, respostas[i]]),
  ) as { [K in keyof T]: Awaited<T[K]> };
}

/**
 * Dados das respostas das consultas da entrada, ou `null` se alguma falhou:
 * cópia pela metade misturaria versões.
 */
export function dadosDasRespostas(
  respostas: RespostasDaEntrada,
): DadosDaCopia | null {
  const dados: DadosDaCopia = {};
  for (const parte of PARTES_SIMPLES) {
    const resposta = respostas?.[parte];
    if (!resposta || resposta.error) return null;
    dados[parte] = resposta.data ?? [];
  }
  for (const parte of PARTES_OPCIONAIS) {
    const resposta = respostas?.[parte];
    dados[parte] = !resposta || resposta.error ? null : (resposta.data ?? null);
  }
  // A versão do mapa (listar_mapa_da_saude_indigena): a próxima entrada pergunta só se mudou.
  dados.versaoDoMapa = (respostas.mapa as RespostaDaConsulta).versao ?? null;
  const monitoramento = respostas.monitoramento;
  if (!monitoramento) {
    dados.monitoramento = null;
    return dados;
  }
  if (monitoramento.error) return null;
  // A `versao` do banco vai junto: a próxima entrada pergunta só se mudou.
  dados.monitoramento = {
    linhas: monitoramento.data ?? [],
    versao: monitoramento.versao ?? null,
  };
  return dados;
}

/** O inverso de `dadosDasRespostas`: respostas já resolvidas, no formato das consultas. */
export function consultasDosDados(dados: DadosDaCopia) {
  const resposta = (data: unknown) => Promise.resolve({ data, error: null });
  return {
    config: resposta(dados.config),
    paineis: resposta(dados.paineis),
    mapa: Promise.resolve({
      data: dados.mapa,
      versao: dados.versaoDoMapa ?? null,
      error: null,
    }),
    unidades: resposta(dados.unidades),
    abas: resposta(dados.abas ?? null),
    monitoramento: dados.monitoramento
      ? Promise.resolve({
          data: dados.monitoramento.linhas,
          versao: dados.monitoramento.versao ?? null,
          error: null,
        })
      : null,
  };
}

export function montarCopia({
  usuarioId,
  acesso,
  versao,
  agora,
  dados,
}: AberturaDaSessao & { dados: DadosDaCopia }): CopiaDaSessao {
  return { usuarioId, acesso, versao, guardadaEm: agora, dados };
}

/** A cópia pode abrir a tela desta sessão? */
export function copiaServe(
  copia: unknown,
  { usuarioId, acesso, versao, agora }: AberturaDaSessao,
): boolean {
  if (!copia || typeof copia !== "object" || !(copia as CopiaDaSessao).dados)
    return false;
  const lida = copia as CopiaDaSessao;
  const idade = agora - Number(lida.guardadaEm);
  return (
    !!usuarioId &&
    lida.usuarioId === usuarioId &&
    lida.acesso === acesso &&
    lida.versao === versao &&
    idade >= 0 &&
    idade <= VALIDADE_DA_COPIA_MS
  );
}

/**
 * Partes cujo conteúdo mudou entre a cópia e as respostas novas. `JSON.stringify`
 * simples: os dois lados vêm da mesma consulta, com as chaves na mesma ordem, e
 * o mapa é grande demais para ordenar chave por chave.
 */
export function partesQueMudaram(
  anteriores: Readonly<Record<string, unknown>> | null | undefined,
  atuais: Readonly<Record<string, unknown>> | null | undefined,
): Set<string> {
  const texto = (valor: unknown) => JSON.stringify(valor ?? null);
  return new Set(
    [...PARTES_SIMPLES, ...PARTES_OPCIONAIS, "monitoramento"].filter(
      (parte) => texto(anteriores?.[parte]) !== texto(atuais?.[parte]),
    ),
  );
}
