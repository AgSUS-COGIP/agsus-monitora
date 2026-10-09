/*
  As justificativas de um bloco na ficha, separadas: primeiro as DO BLOCO (os
  motivos padronizados do próprio bloco e as observações prontas do mesmo
  assunto), depois as outras (gerais ou de outros blocos), que a tela mostra
  recolhidas. A lista completa e a gravação não mudam (opcoesDeJustificativa
  em ficha.js; os códigos continuam os mesmos).

  A regra não liga a observação pronta a um bloco (só tem item_edital, que não
  bate com o do bloco: a "Nota de cursos diminuída" cita o 6.4, o bloco de
  cursos é o 8.2.6). Por isso o assunto sai de palavras-chave, nesta ordem, no
  rótulo da observação; sem acerto, no código; sem acerto, no texto:
    experiência/vínculo/estágio/tempo de serviço → Experiência;
    título/titulação/diploma/especialização/mestrado/doutorado → Titulação;
    curso/certificado/aperfeiçoamento → Cursos;
    nome/identidade/identificação → Identidade.
  O rótulo vem primeiro porque o texto pode citar outro assunto de passagem
  ("Alteração de nome sem documento" fala de "títulos e experiências" no
  texto, mas é de Identidade). O assunto do bloco vem do tipo (VINCULOS,
  TITULOS, CURSOS); nos outros, do título e do código pelas mesmas palavras.
*/
import { opcoesDeJustificativa } from "./ficha.js";

export type Assunto = "EXPERIENCIA" | "TITULOS" | "CURSOS" | "IDENTIDADE";

const PALAVRAS: ReadonlyArray<readonly [Assunto, RegExp]> = [
  ["EXPERIENCIA", /experi[eê]ncia|v[ií]nculo|est[aá]gio|tempo de servi[cç]o/i],
  [
    "TITULOS",
    /t[ií]tulo|titula[cç][aã]o|diploma|especializa[cç][aã]o|mestrado|doutorado/i,
  ],
  ["CURSOS", /curso|certificado|aperfei[cç]oamento/i],
  ["IDENTIDADE", /\bnome\b|identidade|identifica[cç][aã]o/i],
];

const ASSUNTO_DO_TIPO: Record<string, Assunto> = {
  VINCULOS: "EXPERIENCIA",
  TITULOS: "TITULOS",
  CURSOS: "CURSOS",
};

/** O assunto de um texto pelas palavras-chave (null = geral). */
export function assuntoDoTexto(texto: unknown): Assunto | null {
  const t = String(texto ?? "").replace(/_/g, " ");
  return PALAVRAS.find(([, re]) => re.test(t))?.[0] ?? null;
}

type ObservacaoPronta = {
  codigo: string;
  rotulo?: string;
  texto?: string;
};

/** O assunto de uma observação pronta: rótulo, depois código, depois texto. */
export function assuntoDaObservacao(o: ObservacaoPronta): Assunto | null {
  return (
    assuntoDoTexto(o.rotulo) ??
    assuntoDoTexto(o.codigo) ??
    assuntoDoTexto(o.texto)
  );
}

type BlocoDaRegra = {
  codigo: string;
  tipo: string;
  titulo?: string;
  motivos?: { codigo: string }[];
};

/** O assunto do bloco: pelo tipo; senão pelo título e pelo código. */
export function assuntoDoBloco(bloco: BlocoDaRegra): Assunto | null {
  return (
    ASSUNTO_DO_TIPO[bloco.tipo] ??
    assuntoDoTexto(bloco.titulo) ??
    assuntoDoTexto(bloco.codigo)
  );
}

export type OpcaoDeJustificativa = {
  codigo: string;
  texto: string;
  grupo: string;
};

type RegraComProntas = {
  observacoes_prontas?: ObservacaoPronta[];
} & Record<string, unknown>;

/** As justificativas do bloco primeiro; as outras à parte (mesmos códigos). */
export function justificativasDoBloco(
  regra: RegraComProntas,
  bloco: BlocoDaRegra,
): { doBloco: OpcaoDeJustificativa[]; outras: OpcaoDeJustificativa[] } {
  const opcoes = opcoesDeJustificativa(regra, bloco) as OpcaoDeJustificativa[];
  const prontas = new Map(
    (regra.observacoes_prontas ?? []).map((o) => [o.codigo, o]),
  );
  const motivos = new Set((bloco.motivos ?? []).map((m) => m.codigo));
  const assunto = assuntoDoBloco(bloco);
  const doBloco: OpcaoDeJustificativa[] = [];
  const outras: OpcaoDeJustificativa[] = [];
  for (const o of opcoes) {
    const pronta = prontas.get(o.codigo);
    const doAssunto =
      motivos.has(o.codigo) ||
      (assunto !== null && pronta && assuntoDaObservacao(pronta) === assunto);
    (doAssunto ? doBloco : outras).push(o);
  }
  return { doBloco, outras };
}
