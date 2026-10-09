/*
  O que o candidato informou, para a ficha já vir pronta para conferir:
  - os arquivos de cada pergunta de anexo, com o link direto de cada um (o
    "Visualizar Arquivo" que o robô captura, migration 20261008160000) e o
    nome do arquivo, lido do próprio link (o parâmetro `arquivo` é o nome que
    a Empregare guardou); sem nome legível, "Arquivo 1", "Arquivo 2"…;
  - as linhas de curso, título ou vínculo que o job Python
    (python/monitora/avaliacao_documental/sugestoes_da_ficha.py) tirou das
    respostas e o banco devolve em `sugestoes` (migration 20261009190000):
    aqui não se interpreta nada, só se lê. A linha vem marcada
    `da_resposta`, para o avaliador conferir ou corrigir.
  Sem DOM e sem estado. Testes: tests/lib/avaliacao-documental-respostas-do-candidato.test.js.
*/
import {
  anexosDaColuna,
  type EnderecosDaEmpregare,
} from "./anexo-na-empregare.ts";

export type ArquivoDoCandidato = {
  numero: number;
  nome: string;
  link: string;
  /** O anexo na Empregare (a chave da leitura automática: leitura-dos-arquivos.ts). */
  resposta: string;
  pergunta: string;
  arquivo: number;
};

const TAMANHO_DO_NOME = 60;

/* O nome do arquivo no link (parâmetro `arquivo`), sem o prefixo de código que a Empregare põe. */
function nomeDoLink(link: string): string {
  let bruto = "";
  try {
    bruto = new URL(link).searchParams.get("arquivo") ?? "";
  } catch {
    return "";
  }
  const nome = bruto
    .split(/[\\/]/)
    .pop()!
    .replace(/^[0-9a-f]{8,}(?:-[0-9a-f]{4,})*[_-]/i, "")
    .replace(/[<>"]|\p{Cc}/gu, "")
    .trim();
  if (!/[a-z0-9]/i.test(nome)) return "";
  if (nome.length <= TAMANHO_DO_NOME) return nome;
  const ponto = nome.lastIndexOf(".");
  const extensao =
    ponto > 0 && nome.length - ponto <= 6 ? nome.slice(ponto) : "";
  return `${nome.slice(0, TAMANHO_DO_NOME - extensao.length - 1)}…${extensao}`;
}

/** Os arquivos da pergunta (coluna), na ordem, com o nome e o link direto. */
export function arquivosDaPergunta(
  enderecos: EnderecosDaEmpregare,
  coluna: unknown,
): ArquivoDoCandidato[] {
  return anexosDaColuna(enderecos.anexos, coluna)
    .sort((a, b) => a.arquivo - b.arquivo)
    .map((a, i) => ({
      numero: i + 1,
      nome: nomeDoLink(a.link) || `Arquivo ${i + 1}`,
      link: a.link,
      resposta: a.resposta,
      pergunta: a.pergunta,
      arquivo: a.arquivo,
    }));
}

/* ── As linhas sugeridas pelo job Python ──────────────────────────────── */

export type ItemSugerido = Record<string, unknown> & { da_resposta: true };
type BlocoComCategorias = {
  codigo: string;
  categorias?: { codigo: string }[];
};

/**
 * As linhas que o job Python tirou das respostas do candidato para o bloco
 * (obter_ficha_analise → sugestoes; o banco já limpou cada item). A tela só
 * exibe: aqui, só a leitura (lista vazia sem sugestão) e a categoria do
 * vínculo, quando o job não mandou, a primeira do bloco.
 */
export function itensSugeridos(
  sugestoes: unknown,
  bloco: BlocoComCategorias,
): ItemSugerido[] {
  const doBloco = (sugestoes as Record<string, unknown> | null | undefined)?.[
    bloco.codigo
  ];
  if (!Array.isArray(doBloco)) return [];
  const categoria = bloco.categorias?.[0]?.codigo;
  return doBloco
    .filter(
      (i): i is Record<string, unknown> =>
        Boolean(i) && typeof i === "object" && !Array.isArray(i),
    )
    .map((i) => ({
      ...i,
      ...("inicio" in i && !i.categoria && categoria ? { categoria } : {}),
      aceito: true,
      da_resposta: true as const,
    }));
}
