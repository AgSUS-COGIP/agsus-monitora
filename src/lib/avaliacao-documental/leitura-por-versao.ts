/*
  Leitura por versão das telas da Avaliação documental e da Classificação
  (supabase/migrations/20261014230000_avaliacao_leitura_por_versao.sql). Sem
  DOM e sem estado global.

  As RPCs "se mudou" recebem a versão do que a tela já tem (p_versao) e
  respondem só { inalterado: true, versao } quando nada mudou; quando mudou,
  mandam o payload de sempre com a "versao" e, nas listas grandes, a lista em
  colunas (`<campo>_em_colunas`: { colunas, dicionarios, linhas }), que
  `linhasDoPacote` refaz nos mesmos objetos, com as chaves nulas.

  A tela guarda o último payload na memória (e, com `copias`, no navegador —
  src/lib/cache-de-payload.js) e manda a versão dele na próxima leitura. Banco
  sem a RPC nova (migration não aplicada: PGRST202) ou resposta vazia: lê pela
  RPC de sempre, como antes.
*/
import { respostaInalterada, versaoDoPacote } from "../cache-de-payload.js";

export type ChamadaDeRpc = (
  nome: string,
  argumentos: Record<string, unknown>,
) => Promise<unknown>;

type Registro = Record<string, unknown>;

/** Uma lista de objetos em colunas (private."FC_COLUNAS_JSON"). */
export interface PacoteEmColunas {
  colunas: string[];
  dicionarios?: Record<string, unknown[]> | null;
  linhas: unknown[][];
}

const ehRegistro = (v: unknown): v is Registro =>
  v !== null && typeof v === "object" && !Array.isArray(v);

/** A função ainda não existe no banco (migration não aplicada)? */
export function funcaoAusente(erro: unknown): boolean {
  const codigo = ehRegistro(erro) ? String(erro.code ?? "") : "";
  return codigo === "PGRST202" || codigo === "42883";
}

/** Os objetos de um pacote em colunas (todas as chaves, nulas incluídas). */
export function linhasDoPacote(pacote: unknown): Registro[] {
  if (!ehRegistro(pacote)) return [];
  const colunas = Array.isArray(pacote.colunas)
    ? pacote.colunas.map((c) => String(c))
    : [];
  const dicionarios = ehRegistro(pacote.dicionarios) ? pacote.dicionarios : {};
  const linhas = Array.isArray(pacote.linhas) ? pacote.linhas : [];
  const valores = colunas.map((c) =>
    Array.isArray(dicionarios[c]) ? (dicionarios[c] as unknown[]) : null,
  );
  return linhas.map((linha) => {
    const celulas = Array.isArray(linha) ? linha : [];
    const objeto: Registro = {};
    colunas.forEach((coluna, i) => {
      const celula = celulas[i] ?? null;
      const dicionario = valores[i];
      objeto[coluna] = dicionario
        ? (dicionario[Number(celula)] ?? null)
        : celula;
    });
    return objeto;
  });
}

/**
 * O payload com as listas em colunas refeitas (`candidatos_em_colunas` volta a
 * ser `candidatos`). Payload sem colunas (RPC de sempre) volta como veio.
 */
export function comListasRefeitas(payload: unknown): unknown {
  if (!ehRegistro(payload)) return payload;
  let saida: Registro | null = null;
  for (const chave of Object.keys(payload)) {
    if (!chave.endsWith("_em_colunas")) continue;
    saida ??= { ...payload };
    saida[chave.slice(0, -"_em_colunas".length)] = linhasDoPacote(
      payload[chave],
    );
    delete saida[chave];
  }
  return saida ?? payload;
}

/** Onde a cópia do navegador fica (src/lib/cache-de-payload.js com o usuário da sessão). */
export interface CopiasPorChave {
  ler(chave: string): Promise<unknown>;
  guardar(chave: string, payload: unknown): Promise<unknown>;
}

export interface OpcoesDaLeitura {
  /** A RPC com p_versao ("…_se_mudou"). */
  nova: string;
  /** A RPC de sempre (banco sem a migration). */
  antiga: string;
  copias?: CopiasPorChave | null;
}

export interface LeituraPorVersao {
  /** Lê (ou revalida) o payload; `chave` separa o que é de cada edital. */
  ler(
    rpc: ChamadaDeRpc,
    argumentos: Record<string, unknown>,
    chave: string,
  ): Promise<unknown>;
  /** Esquece o que guardou na memória (troca de usuário). */
  esquecer(): void;
}

interface Conhecido {
  chave: string;
  bruto: Registro;
  dados: unknown;
}

/**
 * A leitura de uma RPC por versão. Guarda só o último payload na memória (o
 * da pré-classificação passa de 4 MB refeito); a cópia do navegador, se
 * houver, guarda o payload como veio (em colunas, ~1/4 do tamanho).
 */
export function criarLeituraPorVersao({
  nova,
  antiga,
  copias = null,
}: OpcoesDaLeitura): LeituraPorVersao {
  let memoria: Conhecido | null = null;
  let semNova = false;

  async function daCopia(chave: string): Promise<Conhecido | null> {
    if (!copias) return null;
    try {
      const bruto = await copias.ler(chave);
      if (!ehRegistro(bruto) || !versaoDoPacote(bruto)) return null;
      return { chave, bruto, dados: comListasRefeitas(bruto) };
    } catch {
      return null;
    }
  }

  return {
    async ler(rpc, argumentos, chave) {
      if (!semNova) {
        const conhecido =
          memoria?.chave === chave ? memoria : await daCopia(chave);
        try {
          const r = await rpc(nova, {
            ...argumentos,
            p_versao: conhecido ? versaoDoPacote(conhecido.bruto) : null,
          });
          if (conhecido && respostaInalterada(r)) {
            memoria = conhecido;
            return conhecido.dados;
          }
          if (ehRegistro(r) && !respostaInalterada(r)) {
            const dados = comListasRefeitas(r);
            memoria = { chave, bruto: r, dados };
            if (copias) void copias.guardar(chave, r).catch(() => null);
            return dados;
          }
        } catch (erro) {
          if (!funcaoAusente(erro)) throw erro;
          semNova = true;
        }
      }
      memoria = null;
      return rpc(antiga, argumentos);
    },
    esquecer() {
      memoria = null;
    },
  };
}
