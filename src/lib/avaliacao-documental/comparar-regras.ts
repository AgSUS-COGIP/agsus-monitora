/*
  A diferença legível entre duas versões da regra da avaliação documental
  (a vigente e a nova, ou duas do histórico): o que entrou, o que saiu e o
  que mudou, com o nome de cada coisa como a tela mostra ("Titulação
  acadêmica › teto: 10 → 12"). Sem DOM e sem estado.
*/
import { regraNormalizada } from "./assistente-da-regra.ts";
import { textoDaPergunta } from "./regra.js";
import type { RegraAnalise } from "./tipos-da-regra.ts";

export type Diferenca = {
  tipo: "entrou" | "saiu" | "mudou";
  onde: string;
  antes: string;
  depois: string;
};

const NOMES: Record<string, string> = {
  titulo_etapa: "título da etapa",
  edital_rotulo: "edital no parecer",
  casas_parecer: "casas decimais do parecer",
  provisoria: "Provisória",
  eliminacao_automatica: "eliminação automática",
  nota_declarada: "nota declarada",
  divergencia_tolerancia: "tolerância da divergência",
  desempate: "desempate",
  pergunta_experiencia: "pergunta da experiência",
  base_da_nota: "nota do corte e da ordem do lote",
  lote: "Lote",
  base: "tamanho",
  multiplo: "vezes as vagas",
  fixo: "número fixo",
  nota_minima: "pontos mínimos",
  inclui_cr: "soma o cadastro reserva",
  por_modalidade: "por modalidade",
  inclui_empatados: "inclui os empatados",
  linha_anda: "a linha anda",
  publica_reposicao: "publica cada reposição",
  por_vaga: "tamanho por vaga",
  distribuicao: "Distribuição",
  revisao: "Revisão",
  corte: "Nota mínima",
  parecer: "Parecer",
  observacoes_prontas: "Observações prontas",
  titulo: "título",
  item_edital: "item do edital",
  perguntas: "perguntas",
  condicao: "condição",
  efeitos: "efeitos",
  motivos: "motivos",
  teto: "teto",
  indigena: "pontos de indígena",
  aldeia: "pontos de aldeia",
  lista_aldeias: "lista de aldeias",
  cumulativa: "títulos somam",
  pontos_por_nivel: "pontos por nível",
  faixas: "faixas",
  por_nivel: "por nível",
  categorias: "categorias",
  minimo_meses: "mínimo de meses",
  efeito_minimo: "abaixo do mínimo",
  item_minimo: "item do mínimo",
  pontuacao: "pontuação",
  pontos_por_mes: "pontos por mês",
  periodo_meses: "meses do período",
  pontos_por_periodo: "pontos por período",
  desconta_minimo: "só além do mínimo",
  estagio_indigena: "estágio de indígena",
  pergunta: "pergunta",
  pontos: "pontos",
  meses: "meses",
  tipo: "tipo",
  quando: "elimina quando",
  exceto: "passa só com",
  motivo: "motivo",
  coluna: "coluna",
  coluna_prefixo: "colunas que começam com",
  texto: "texto",
  rotulo: "rótulo",
  CONFORME: "Conforme",
  NAO_CONFORME: "Não conforme",
  NAO_ENVIADO: "Não enviado",
  superior: "superior",
  tecnico: "técnico",
  medio: "médio",
  fundamental: "fundamental",
};
const nome = (chave: string) => NOMES[chave] ?? chave.replace(/_/g, " ");

const ehObjeto = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);

/** Um valor da regra como a tela mostra. */
export function textoDoValor(valor: unknown): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  if (typeof valor === "boolean") return valor ? "Sim" : "Não";
  if (typeof valor === "number")
    return valor.toLocaleString("pt-BR", { maximumFractionDigits: 4 });
  if (typeof valor === "string") return valor;
  if (Array.isArray(valor))
    return valor.length
      ? valor
          .map((v) => (ehObjeto(v) ? textoDoValor(v) : textoDoValor(v)))
          .join("; ")
      : "—";
  if (ehObjeto(valor))
    return Object.entries(valor)
      .map(([k, v]) => `${nome(k)}: ${textoDoValor(v)}`)
      .join(", ");
  return String(valor);
}

const igual = (a: unknown, b: unknown) =>
  JSON.stringify(ordenar(a)) === JSON.stringify(ordenar(b));
function ordenar(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(ordenar);
  if (ehObjeto(v))
    return Object.fromEntries(
      Object.keys(v)
        .sort()
        .map((k) => [k, ordenar(v[k])]),
    );
  return v;
}

/* Listas de objetos com chave: blocos, motivos e eliminações por código; a nota declarada pela parcial. */
const CHAVE_DA_LISTA: Record<
  string,
  (item: Record<string, unknown>, i: number) => string
> = {
  blocos: (b) => String(b.codigo),
  motivos: (m) => String(m.codigo),
  eliminacao_automatica: (e) => String(e.codigo),
  observacoes_prontas: (o) => String(o.codigo),
  categorias: (c) => String(c.codigo),
  nota_declarada: (d, i) => `${String(d.parcial)}#${i}`,
};
const ROTULO_DO_ITEM: Record<
  string,
  (item: Record<string, unknown>) => string
> = {
  blocos: (b) => String(b.titulo || b.codigo),
  motivos: (m) => `motivo ${String(m.codigo)}`,
  eliminacao_automatica: (e) => `eliminação "${String(e.motivo || e.codigo)}"`,
  observacoes_prontas: (o) => `observação "${String(o.rotulo || o.codigo)}"`,
  categorias: (c) => `categoria ${String(c.rotulo || c.codigo)}`,
  nota_declarada: (d) =>
    `nota declarada (${String(d.parcial).toLowerCase()}: ${textoDaPergunta(d.pergunta as string)})`,
};

function comparar(
  antes: unknown,
  depois: unknown,
  onde: string[],
  chave: string,
  saida: Diferenca[],
) {
  if (igual(antes, depois)) return;
  const lugar = onde.join(" › ");
  const fabrica = CHAVE_DA_LISTA[chave];
  if (
    fabrica &&
    Array.isArray(antes) &&
    Array.isArray(depois) &&
    [...antes, ...depois].every(ehObjeto)
  ) {
    const mapa = (lista: Record<string, unknown>[]) =>
      new Map(lista.map((item, i) => [fabrica(item, i), item]));
    const a = mapa(antes as Record<string, unknown>[]);
    const d = mapa(depois as Record<string, unknown>[]);
    const rotulo =
      ROTULO_DO_ITEM[chave] ?? ((x: Record<string, unknown>) => fabrica(x, 0));
    for (const [k, item] of a)
      if (!d.has(k))
        saida.push({
          tipo: "saiu",
          onde: [...onde, rotulo(item)].join(" › "),
          antes: "",
          depois: "",
        });
    for (const [k, item] of d) {
      const anterior = a.get(k);
      if (!anterior)
        saida.push({
          tipo: "entrou",
          onde: [...onde, rotulo(item)].join(" › "),
          antes: "",
          depois: "",
        });
      else comparar(anterior, item, [...onde, rotulo(item)], "", saida);
    }
    const ordemAntes = [...a.keys()].filter((k) => d.has(k));
    const ordemDepois = [...d.keys()].filter((k) => a.has(k));
    if (chave === "blocos" && !igual(ordemAntes, ordemDepois))
      saida.push({
        tipo: "mudou",
        onde: [...onde, "ordem"].join(" › "),
        antes: "",
        depois: "",
      });
    return;
  }
  if (ehObjeto(antes) && ehObjeto(depois)) {
    for (const k of new Set([...Object.keys(antes), ...Object.keys(depois)]))
      comparar(antes[k], depois[k], [...onde, nome(k)], k, saida);
    return;
  }
  saida.push({
    tipo:
      antes === undefined ? "entrou" : depois === undefined ? "saiu" : "mudou",
    onde: lugar,
    antes: textoDoValor(antes),
    depois: textoDoValor(depois),
  });
}

/** As diferenças entre duas regras (vazio = iguais). */
export function diferencasEntreRegras(
  antes: unknown,
  depois: unknown,
): Diferenca[] {
  const a = regraNormalizada(antes) as RegraAnalise & Record<string, unknown>;
  const d = regraNormalizada(depois) as RegraAnalise & Record<string, unknown>;
  const saida: Diferenca[] = [];
  for (const chave of Object.keys(d)) {
    if (chave === "schema" || chave === "modelo") continue;
    comparar(
      a[chave],
      d[chave],
      chave === "blocos" ? [] : [nome(chave)],
      chave,
      saida,
    );
  }
  return saida;
}

/** A diferença numa frase ("Titulação › teto: 10 → 12"). */
export function fraseDaDiferenca(d: Diferenca): string {
  if (d.tipo === "entrou" && !d.depois) return `Entrou: ${d.onde}`;
  if (d.tipo === "saiu" && !d.antes) return `Saiu: ${d.onde}`;
  if (!d.antes && !d.depois) return `Mudou: ${d.onde}`;
  return `${d.onde}: ${d.antes} → ${d.depois}`;
}
