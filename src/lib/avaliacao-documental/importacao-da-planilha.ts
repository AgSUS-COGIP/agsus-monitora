/*
  A importação da avaliação documental da planilha para o sistema (fase F8,
  16/11/2026; migration 20261116233000_importar_avaliacao_da_planilha).

  - A prévia (previa_importacao_da_planilha) diz à coordenação, antes de
    importar, o que vira ficha concluída e o que impede a importação.
  - A ficha importada leva a marca `importada_da_planilha` no lançamento
    gravado (DS_LANCAMENTO): a linha da planilha, o que ela decidiu e quem
    analisou. A ficha mostra esse resultado só para ler; reaberta, a análise é
    refeita no sistema, e a marca sai do lançamento na primeira gravação
    (`semMarcaDaImportacao`).
*/
import { formatarNota } from "../classificacao/numeros.ts";

const plural = (n: number, um: string, varios: string) =>
  `${n.toLocaleString("pt-BR")} ${n === 1 ? um : varios}`;

export type PreviaDaImportacao = Readonly<{
  aprovados: number;
  reprovados: number;
  em_aberto: number;
  saem_do_lote: number;
  analista_sem_cadastro: number;
  problemas: Readonly<Record<string, number>>;
  origem: string;
}>;

/** Os problemas do plano (FC_PLANO_IMPORTACAO_PLANILHA), em linguagem da tela. */
export const ROTULO_DO_PROBLEMA: Readonly<
  Record<string, readonly [string, string]>
> = Object.freeze({
  SEM_INSCRITO: [
    "análise da planilha sem inscrito no Yeendé",
    "análises da planilha sem inscrito no Yeendé",
  ],
  MAIS_DE_UM_INSCRITO: [
    "análise com o código de dois inscritos",
    "análises com o código de dois inscritos",
  ],
  SEM_FICHA: [
    "inscrito analisado na planilha sem ficha no lote",
    "inscritos analisados na planilha sem ficha no lote",
  ],
  VAGA_DIFERENTE: [
    "análise em vaga diferente da ficha",
    "análises em vaga diferente da ficha",
  ],
  EM_REVISAO: [
    "análise em revisão na planilha (termine a revisão lá)",
    "análises em revisão na planilha (termine a revisão lá)",
  ],
  SEM_NOTA: ["análise decidida sem nota", "análises decididas sem nota"],
  NOTA_INVALIDA: [
    "análise com nota acima de 1.000",
    "análises com nota acima de 1.000",
  ],
  SEM_PARECER: [
    "análise decidida sem parecer",
    "análises decididas sem parecer",
  ],
  PARECER_LONGO: [
    "parecer com mais de 8.000 caracteres",
    "pareceres com mais de 8.000 caracteres",
  ],
  CONCLUIDA_SEM_PLANILHA: [
    "ficha concluída no Yeendé sem análise na planilha",
    "fichas concluídas no Yeendé sem análise na planilha",
  ],
});

const inteiro = (valor: unknown) => {
  const n = Number(valor);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
};

const objeto = (valor: unknown): Record<string, unknown> =>
  valor && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : {};

export function normalizarPrevia(bruta: unknown): PreviaDaImportacao {
  const p = objeto(bruta);
  const problemas: Record<string, number> = {};
  for (const [codigo, n] of Object.entries(objeto(p.problemas)))
    if (inteiro(n)) problemas[codigo] = inteiro(n);
  return Object.freeze({
    aprovados: inteiro(p.aprovados),
    reprovados: inteiro(p.reprovados),
    em_aberto: inteiro(p.em_aberto),
    saem_do_lote: inteiro(p.saem_do_lote),
    analista_sem_cadastro: inteiro(p.analista_sem_cadastro),
    problemas: Object.freeze(problemas),
    origem: typeof p.origem === "string" && p.origem ? p.origem : "PLANILHA",
  });
}

export type ResumoDaImportacao = Readonly<{
  /** A planilha decidiu análises do edital: a troca de dono é a importação. */
  importa: boolean;
  /** Sem problema: dá para importar. */
  pode: boolean;
  linhas: readonly string[];
  problemas: readonly string[];
}>;

export function resumoDaImportacao(
  previa: PreviaDaImportacao,
): ResumoDaImportacao {
  const decididas = previa.aprovados + previa.reprovados;
  const problemas = Object.entries(previa.problemas).map(([codigo, n]) => {
    const [um, varios] = ROTULO_DO_PROBLEMA[codigo] ?? [
      `caso que impede (${codigo})`,
      `casos que impedem (${codigo})`,
    ];
    return plural(n, um, varios);
  });
  const linhas: string[] = [];
  if (decididas)
    linhas.push(
      `${plural(previa.aprovados, "aprovado", "aprovados")} e ${plural(previa.reprovados, "reprovado", "reprovados")} viram fichas concluídas, com o resultado, a nota, o parecer e a data da planilha.`,
    );
  if (previa.analista_sem_cadastro)
    linhas.push(
      `${plural(previa.analista_sem_cadastro, "análise tem", "análises têm")} analista sem cadastro no Yeendé: a ficha fica em nome de quem importa, e o nome da planilha continua no painel.`,
    );
  if (previa.em_aberto)
    linhas.push(
      `${plural(previa.em_aberto, "análise em aberto continua", "análises em aberto continuam")} na fila.`,
    );
  if (previa.saem_do_lote)
    linhas.push(
      `${plural(previa.saem_do_lote, "ficha sem análise na planilha sai", "fichas sem análise na planilha saem")} do lote.`,
    );
  return Object.freeze({
    importa: decididas > 0 || problemas.length > 0,
    pode: decididas > 0 && problemas.length === 0,
    linhas: Object.freeze(linhas),
    problemas: Object.freeze(problemas),
  });
}

export type MarcaDaImportacao = Readonly<{
  status: string;
  responsavel: string;
  data: string;
  nota: number | null;
  parciais: Readonly<Record<string, number>>;
  modalidade: string;
  link: string;
  importadaEm: string;
}>;

const CHAVE = "importada_da_planilha";

const texto = (valor: unknown) =>
  typeof valor === "string" ? valor.trim() : "";

/** A marca da ficha importada, lida do lançamento gravado; null se não é importada. */
export function marcaDaImportacao(
  lancamento: unknown,
): MarcaDaImportacao | null {
  const marca = objeto(lancamento)[CHAVE];
  if (!marca || typeof marca !== "object" || Array.isArray(marca)) return null;
  const m = marca as Record<string, unknown>;
  const parciais: Record<string, number> = {};
  for (const [codigo, valor] of Object.entries(objeto(m.parciais)))
    if (typeof valor === "number" && Number.isFinite(valor))
      parciais[codigo] = valor;
  const link = texto(m.link_pdf);
  return Object.freeze({
    status: texto(m.status),
    responsavel: texto(m.responsavel),
    data: texto(m.data),
    nota:
      typeof m.nota_final === "number" && Number.isFinite(m.nota_final)
        ? m.nota_final
        : null,
    parciais: Object.freeze(parciais),
    modalidade: texto(m.modalidade),
    link: /^https:\/\//i.test(link) ? link : "",
    importadaEm: texto(m.em),
  });
}

/** O lançamento sem a marca: reaberta, a ficha é refeita no sistema. */
export function semMarcaDaImportacao<T>(lancamento: T): T {
  const l = objeto(lancamento);
  if (!(CHAVE in l)) return lancamento;
  const { [CHAVE]: _marca, ...resto } = l;
  return resto as T;
}

/** As parciais da planilha, na ordem da nota. */
export const ROTULO_DA_PARCIAL: Readonly<Record<string, string>> =
  Object.freeze({
    FORMACAO: "Escolaridade",
    CURSOS: "Cursos",
    EXPERIENCIA: "Experiência profissional",
    ETNICO: "Critério étnico",
  });

export function parciaisDaMarca(marca: MarcaDaImportacao) {
  return Object.keys(ROTULO_DA_PARCIAL)
    .filter((codigo) => codigo in marca.parciais)
    .map((codigo) => ({
      codigo,
      rotulo: ROTULO_DA_PARCIAL[codigo]!,
      valor: formatarNota(marca.parciais[codigo]),
    }));
}
