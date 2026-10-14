/*
  A justificativa do ajuste de um item com títulos, cursos ou vínculos, em
  texto, montada do que já foi lançado e calculado (pedido das COREs: "foram
  aceitos x cursos de x horas; não foram aceitos cursos por não terem o mínimo
  de 40h"). Não há regra de pontos nova: as faixas e os pontos são os da regra
  (faixaDoCurso, titulosDoNivel), o tempo é o de avaliacao.experiencia
  (apurarExperiencia) e a conta dos períodos é a de comprovadoDaExperiencia.

    Cursos      "Aceitos 2 cursos (205 h): 145 h (faixa ≥120 h, 3 pontos) e
                60 h (faixa 40–60 h, 1 ponto). Não pontuados: 1 curso de 30 h —
                abaixo de 40 h (8.2.6); 1 curso de 20 h — carga horária não
                comprovada."
    Titulação   aceitos com os pontos do nível ("vale o maior" quando não
                soma) e os não pontuados com o motivo.
    Experiência vínculos aceitos, dias unidos, dias em comum (contam uma vez)
                e a conta além do mínimo; os não contados com o motivo.

  Não pontuado = linha recusada (motivo do bloco), item lido recusado
  (recusas_lidas, motivo curto), curso aceito fora das faixas (abaixo do
  mínimo de horas) ou sem carga horária, título sem pontos no nível da vaga,
  vínculo de categoria que não pontua. O "abaixo do mínimo" da experiência
  fica de fora: o parecer já diz (sem duplicar).

  O texto vai para o campo que já existe, `justificativa_livre` do bloco
  (FC_VALIDAR_LANCAMENTO_FICHA: até 2.000 caracteres), e entra no parecer em
  "Observações da análise" como qualquer justificativa (textosDasJustificativas
  em pontuacao.js e pontuacao.py). comJustificativasDosItens decide quando o
  texto acompanha os itens: só quando o item precisa (Confere ou Editar nota,
  com a pontuação diferente da declarada ou com algum item não pontuado) e só
  enquanto o texto é o automático (vazio ou igual ao resumo anterior). O que o
  avaliador escreveu fica.
*/
import {
  BLOCOS_COM_ITENS,
  blocoSeAplica,
  divergenciaDoBloco,
  rotuloDoTitulo,
  titulosDoNivel,
} from "./ficha.js";
import { doNivel, faixaDoCurso, tetoDoBloco } from "./pontuacao.js";
import {
  comprovadoDaExperiencia,
  diasEmComum,
  textoDoTempo,
} from "./comprovado-da-ficha.ts";
import {
  chaveDoItemLido,
  leiturasDaFicha,
  rotuloDaRecusa,
} from "./leitura-dos-arquivos.ts";
import type {
  ItemLido,
  LeituraDoArquivo,
  Recusa,
} from "./leitura-dos-arquivos.ts";

/** O limite do campo no banco (FC_VALIDAR_LANCAMENTO_FICHA). */
export const TAMANHO_DA_JUSTIFICATIVA = 2000;

type Faixa = {
  min_horas?: number | null;
  max_horas?: number | null;
  pontos?: number | null;
};
type Motivo = { codigo: string; texto?: string; item_edital?: string | null };

export type BlocoComItens = {
  codigo: string;
  tipo: string;
  item_edital?: string | null;
  condicao?: string | null;
  motivos?: Motivo[];
  faixas?: Faixa[];
  cumulativa?: boolean;
  teto?: number | null;
  categorias?: { codigo: string; rotulo?: string; pontua?: boolean }[];
  minimo_meses?: number | null;
  unir_sobreposicao?: boolean;
  data_limite?: string | null;
  max_vinculos?: number;
  [campo: string]: unknown;
};

type ItemLancado = {
  titulo?: string;
  nome?: string;
  horas?: number | string | null;
  empregador?: string;
  categoria?: string;
  inicio?: string;
  fim?: string;
  aceito?: boolean;
  motivo?: string | null;
};

type BlocoLancado = {
  situacao?: string | null;
  justificativa_livre?: string;
  [campo: string]: unknown;
};

export type LancamentoComItens = {
  nivel?: string | null;
  modalidade?: string;
  indigena?: boolean;
  blocos?: Record<string, BlocoLancado | undefined>;
  titulos?: ItemLancado[];
  cursos?: ItemLancado[];
  vinculos?: ItemLancado[];
  recusas_lidas?: Record<string, Recusa>;
  [campo: string]: unknown;
};

type ExperienciaApurada = {
  dias_total: number;
  meses: number;
  meses_estagio: number;
  meses_considerados: number;
  pontos: number;
  abaixo_do_minimo: boolean;
};

/** O que a conta da ficha devolve e esta justificativa lê. */
export type RetratoDaFicha = {
  regra: { blocos: BlocoComItens[] };
  lancamento: LancamentoComItens;
  avaliacao: {
    parciais?: Record<string, number | undefined>;
    experiencia?: ExperienciaApurada | null;
  };
  declarada: unknown;
};

export type JustificativaDoBloco = {
  /** O resumo dos itens ("" se o bloco não tem itens nem recusas). */
  texto: string;
  /** Itens que não pontuaram (recusados, fora das faixas, sem carga…). */
  naoPontuados: number;
  /** O item pede a justificativa: Confere/Editar nota com nota diferente da declarada ou item não pontuado. */
  precisa: boolean;
};

const TIPO_LIDO: Record<string, ItemLido["tipo"]> = {
  titulos: "TITULO",
  cursos: "CURSO",
  vinculos: "VINCULO",
};
const DATA = /^\d{4}-\d{2}-\d{2}$/;

const numero = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const plural = (n: number, um: string, varios: string) =>
  `${n.toLocaleString("pt-BR")} ${n === 1 ? um : varios}`;
const horasBr = (n: number) =>
  `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`;
const pontosBr = (n: number) =>
  `${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ${n === 1 ? "ponto" : "pontos"}`;

function juntar(partes: string[]): string {
  if (partes.length <= 1) return partes.join("");
  return `${partes.slice(0, -1).join(", ")} e ${partes[partes.length - 1]}`;
}

/* "Eventos acadêmicos … não são pontuados." → "eventos acadêmicos … não são pontuados". */
function semPontoFinal(texto: string): string {
  const t = texto.trim().replace(/[.;:]+$/, "");
  return /^[A-ZÀ-Ý][a-zà-ÿ]/.test(t)
    ? t.charAt(0).toLowerCase() + t.slice(1)
    : t;
}

const comItem = (texto: string, item: string | null | undefined) =>
  item ? `${texto} (${item})` : texto;

/** O motivo da linha recusada: o texto do motivo do bloco, com o item do edital. */
function motivoDaLinha(bloco: BlocoComItens, codigo: unknown): string {
  const motivo = (bloco.motivos ?? []).find((m) => m.codigo === codigo);
  if (!motivo?.texto) return "recusado";
  return comItem(
    semPontoFinal(motivo.texto),
    motivo.item_edital || bloco.item_edital,
  );
}

/* Os não pontuados agrupados pelo motivo, na ordem em que aparecem. */
class NaoPontuados {
  private grupos = new Map<string, string[]>();
  total = 0;
  somar(motivo: string, detalhe: string) {
    const lista = this.grupos.get(motivo) ?? [];
    lista.push(detalhe);
    this.grupos.set(motivo, lista);
    this.total += 1;
  }
  /** "1 curso de 30 h — abaixo de 40 h (8.2.6); 2 cursos (20 h e 16 h) — …". */
  texto(um: string, varios: string, ligacao: "de" | "parenteses"): string {
    return [...this.grupos.entries()]
      .map(([motivo, detalhes]) => {
        const comDetalhe = detalhes.filter(Boolean);
        const qtd = plural(detalhes.length, um, varios);
        let detalhe = "";
        if (comDetalhe.length === 1 && detalhes.length === 1)
          detalhe =
            ligacao === "de" ? ` de ${comDetalhe[0]}` : ` (${comDetalhe[0]})`;
        else if (comDetalhe.length) detalhe = ` (${juntar(comDetalhe)})`;
        return `${qtd}${detalhe} — ${motivo}`;
      })
      .join("; ");
  }
}

/** Os itens lidos dos arquivos que o avaliador recusou, deste tipo. */
function recusadosLidos(
  lancamento: LancamentoComItens,
  leituras: readonly LeituraDoArquivo[],
  tipo: ItemLido["tipo"],
): { item: ItemLido; recusa: Recusa }[] {
  const recusas = lancamento.recusas_lidas ?? {};
  if (!Object.keys(recusas).length) return [];
  const saida: { item: ItemLido; recusa: Recusa }[] = [];
  for (const leitura of leituras)
    leitura.itens.forEach((item, indice) => {
      const recusa = recusas[chaveDoItemLido(leitura, indice)];
      if (item.tipo === tipo && recusa) saida.push({ item, recusa });
    });
  return saida;
}

function faixaEmTexto(f: Faixa): string {
  const min = numero(f.min_horas);
  if (f.max_horas === null || f.max_horas === undefined) return `≥${min} h`;
  return `${min}–${numero(f.max_horas)} h`;
}

function resumoDosCursos(
  bloco: BlocoComItens,
  lancamento: LancamentoComItens,
  leituras: readonly LeituraDoArquivo[],
): { texto: string; naoPontuados: number } {
  const doNivelDaVaga = doNivel(bloco, lancamento.nivel) as BlocoComItens;
  const faixas = doNivelDaVaga.faixas ?? [];
  const minimo = faixas.length
    ? Math.min(...faixas.map((f) => numero(f.min_horas)))
    : 0;
  const aceitos: { horas: number; faixa: Faixa }[] = [];
  const nao = new NaoPontuados();
  for (const c of lancamento.cursos ?? []) {
    if (!c) continue;
    const horas = numero(c.horas);
    const emHoras = horas > 0 ? horasBr(horas) : "";
    if (c.aceito === false) {
      nao.somar(motivoDaLinha(bloco, c.motivo), emHoras);
      continue;
    }
    if (!(horas > 0)) {
      // A linha em preenchimento (sem nome e sem horas) não conta.
      if (String(c.nome ?? "").trim()) nao.somar("sem carga horária", "");
      continue;
    }
    const faixa = faixaDoCurso(faixas, horas) as Faixa | null;
    if (faixa) aceitos.push({ horas, faixa });
    else
      nao.somar(
        horas < minimo
          ? comItem(`abaixo de ${horasBr(minimo)}`, bloco.item_edital)
          : "fora das faixas da regra",
        emHoras,
      );
  }
  for (const { item, recusa } of recusadosLidos(lancamento, leituras, "CURSO"))
    nao.somar(
      rotuloDaRecusa(recusa) || "recusado",
      numero(item.horas) > 0 ? horasBr(numero(item.horas)) : "",
    );
  const partes: string[] = [];
  if (aceitos.length) {
    const total = aceitos.reduce((s, a) => s + a.horas, 0);
    const itens = aceitos.map(
      (a) =>
        `${horasBr(a.horas)} (faixa ${faixaEmTexto(a.faixa)}, ${pontosBr(numero(a.faixa.pontos))})`,
    );
    partes.push(
      aceitos.length === 1
        ? `Aceito 1 curso: ${itens[0]}.`
        : `Aceitos ${plural(aceitos.length, "curso", "cursos")} (${horasBr(total)}): ${juntar(itens)}.`,
    );
    const soma = aceitos.reduce((s, a) => s + numero(a.faixa.pontos), 0);
    const teto = tetoDoBloco(bloco, lancamento.nivel) as number | null;
    if (teto !== null && soma > teto)
      partes.push(
        `Soma de ${pontosBr(soma)} limitada ao teto de ${teto.toLocaleString("pt-BR")}.`,
      );
  } else if (nao.total) partes.push("Nenhum curso pontuado.");
  if (nao.total)
    partes.push(`Não pontuados: ${nao.texto("curso", "cursos", "de")}.`);
  return { texto: partes.join(" "), naoPontuados: nao.total };
}

function resumoDosTitulos(
  bloco: BlocoComItens,
  lancamento: LancamentoComItens,
  leituras: readonly LeituraDoArquivo[],
): { texto: string; naoPontuados: number } {
  const tabela = titulosDoNivel(bloco, lancamento.nivel) as {
    codigo: string;
    rotulo: string;
    pontos: number;
  }[];
  const aceitos: { rotulo: string; pontos: number }[] = [];
  const nao = new NaoPontuados();
  for (const t of lancamento.titulos ?? []) {
    if (!t || !t.titulo) continue;
    const rotulo = String(rotuloDoTitulo(t.titulo) || t.titulo);
    if (t.aceito === false) {
      nao.somar(motivoDaLinha(bloco, t.motivo), rotulo);
      continue;
    }
    const pontos = numero(tabela.find((x) => x.codigo === t.titulo)?.pontos);
    if (pontos > 0) aceitos.push({ rotulo, pontos });
    else nao.somar("sem pontos no nível da vaga", rotulo);
  }
  for (const { item, recusa } of recusadosLidos(lancamento, leituras, "TITULO"))
    nao.somar(
      rotuloDaRecusa(recusa) || "recusado",
      item.titulo ? String(rotuloDoTitulo(item.titulo) || item.titulo) : "",
    );
  const partes: string[] = [];
  if (aceitos.length) {
    const itens = aceitos.map((a) => `${a.rotulo} (${pontosBr(a.pontos)})`);
    let regra = "";
    if (aceitos.length > 1) {
      regra = bloco.cumulativa ? "; somados" : "; vale o maior";
      const soma = aceitos.reduce((s, a) => s + a.pontos, 0);
      const teto = tetoDoBloco(bloco, lancamento.nivel) as number | null;
      if (bloco.cumulativa && teto !== null && soma > teto)
        regra += `, limitados ao teto de ${teto.toLocaleString("pt-BR")}`;
    }
    partes.push(
      `${aceitos.length === 1 ? "Aceito 1 título" : `Aceitos ${plural(aceitos.length, "título", "títulos")}`}: ${juntar(itens)}${regra}.`,
    );
  } else if (nao.total) partes.push("Nenhum título pontuado.");
  if (nao.total)
    partes.push(
      `Não pontuados: ${nao.texto("título", "títulos", "parenteses")}.`,
    );
  return { texto: partes.join(" "), naoPontuados: nao.total };
}

const datasValidas = (v: ItemLancado) =>
  DATA.test(String(v.inicio ?? "")) &&
  DATA.test(String(v.fim ?? "")) &&
  String(v.fim) >= String(v.inicio);

function resumoDosVinculos(
  bloco: BlocoComItens,
  lancamento: LancamentoComItens,
  experiencia: ExperienciaApurada | null | undefined,
  leituras: readonly LeituraDoArquivo[],
): { texto: string; naoPontuados: number } {
  const categorias = bloco.categorias ?? [];
  const queContam = new Set(
    categorias.filter((c) => c.pontua !== false).map((c) => c.codigo),
  );
  const vinculos = (lancamento.vinculos ?? []).filter(Boolean);
  const nao = new NaoPontuados();
  let aceitos = 0;
  for (const v of vinculos) {
    if (v.aceito === false) {
      nao.somar(motivoDaLinha(bloco, v.motivo), "");
      continue;
    }
    if (!datasValidas(v)) continue;
    if (categorias.length && !queContam.has(String(v.categoria ?? ""))) {
      const rotulo =
        categorias.find((c) => c.codigo === v.categoria)?.rotulo ||
        v.categoria ||
        "";
      nao.somar(
        rotulo ? `categoria "${rotulo}" não pontua` : "categoria não pontua",
        "",
      );
      continue;
    }
    aceitos += 1;
  }
  for (const { recusa } of recusadosLidos(lancamento, leituras, "VINCULO"))
    nao.somar(rotuloDaRecusa(recusa) || "recusado", "");
  const partes: string[] = [];
  if (aceitos) {
    const dias = experiencia?.dias_total ?? 0;
    const meses = experiencia?.meses ?? 0;
    const comum = diasEmComum(
      bloco as Parameters<typeof diasEmComum>[0],
      vinculos as Parameters<typeof diasEmComum>[1],
    );
    const comprovado = comprovadoDaExperiencia(
      bloco as Parameters<typeof comprovadoDaExperiencia>[0],
      experiencia,
      lancamento.nivel,
    );
    let frase = `${aceitos === 1 ? "Aceito 1 vínculo" : `Aceitos ${plural(aceitos, "vínculo", "vínculos")}`}: ${plural(dias, "dia unido", "dias unidos")} (${textoDoTempo(dias)}; ${plural(meses, "mês", "meses")})`;
    if (comum > 0)
      frase += `; ${plural(comum, "dia em comum", "dias em comum")} entre vínculos ${comum === 1 ? "conta" : "contam"} uma vez`;
    partes.push(`${frase}.`);
    // Abaixo do mínimo: o parecer já diz (eliminatório ou observação).
    if (comprovado.detalhe && !comprovado.abaixoDoMinimo)
      partes.push(`${comprovado.detalhe}.`);
  } else if (nao.total) partes.push("Nenhum vínculo contado.");
  if (nao.total)
    partes.push(`Não contados: ${nao.texto("vínculo", "vínculos", "de")}.`);
  return { texto: partes.join(" "), naoPontuados: nao.total };
}

function limitar(texto: string): string {
  return texto.length > TAMANHO_DA_JUSTIFICATIVA
    ? `${texto.slice(0, TAMANHO_DA_JUSTIFICATIVA - 1)}…`
    : texto;
}

/** O resumo dos itens de um bloco e se o item pede a justificativa. */
export function justificativaDoBloco(
  retrato: RetratoDaFicha,
  bloco: BlocoComItens,
  leiturasBrutas: unknown,
): JustificativaDoBloco {
  const vazio = { texto: "", naoPontuados: 0, precisa: false };
  const chave = (BLOCOS_COM_ITENS as Record<string, string | undefined>)[
    bloco.tipo
  ];
  const { lancamento, avaliacao } = retrato;
  if (!chave || !lancamento || !blocoSeAplica(bloco, lancamento)) return vazio;
  const leituras = TIPO_LIDO[chave] ? leiturasDaFicha(leiturasBrutas) : [];
  const resumo =
    chave === "cursos"
      ? resumoDosCursos(bloco, lancamento, leituras)
      : chave === "titulos"
        ? resumoDosTitulos(bloco, lancamento, leituras)
        : resumoDosVinculos(
            bloco,
            lancamento,
            avaliacao?.experiencia,
            leituras,
          );
  const texto = limitar(resumo.texto);
  const situacao = lancamento.blocos?.[bloco.codigo]?.situacao;
  const divergente =
    divergenciaDoBloco(bloco, avaliacao, retrato.declarada) !== null;
  return {
    texto,
    naoPontuados: resumo.naoPontuados,
    precisa:
      Boolean(texto) &&
      situacao === "CONFORME" &&
      (divergente || resumo.naoPontuados > 0),
  };
}

/**
 * O lançamento com a justificativa dos itens acompanhando os itens, bloco a
 * bloco. Na abertura (`antes` null), só preenche o campo vazio do item que
 * precisa. Depois de cada mudança, só mexe quando o resumo ou a necessidade
 * mudou e o texto é o automático (vazio ou igual ao resumo de antes): vira o
 * resumo novo, ou vazio se o item deixou de precisar. O texto do avaliador
 * fica. Devolve o mesmo objeto quando nada muda.
 */
export function comJustificativasDosItens<T extends LancamentoComItens>(
  antes: RetratoDaFicha | null,
  depois: RetratoDaFicha & { lancamento: T },
  leituras: unknown,
): T {
  let saida = depois.lancamento;
  for (const bloco of depois.regra?.blocos ?? []) {
    if (!(BLOCOS_COM_ITENS as Record<string, string>)[bloco.tipo]) continue;
    const agora = justificativaDoBloco(depois, bloco, leituras);
    const alvo = agora.precisa ? agora.texto : "";
    const texto = String(
      saida.blocos?.[bloco.codigo]?.justificativa_livre ?? "",
    );
    let novo: string;
    if (!antes) {
      if (texto.trim() || !alvo) continue;
      novo = alvo;
    } else {
      const blocoAntes =
        antes.regra?.blocos?.find((b) => b.codigo === bloco.codigo) ?? bloco;
      const anterior = justificativaDoBloco(antes, blocoAntes, leituras);
      if (anterior.texto === agora.texto && anterior.precisa === agora.precisa)
        continue;
      if (texto.trim() && texto !== anterior.texto) continue;
      novo = alvo;
    }
    if (novo === texto) continue;
    saida = {
      ...saida,
      blocos: {
        ...saida.blocos,
        [bloco.codigo]: {
          ...(saida.blocos?.[bloco.codigo] ?? {}),
          justificativa_livre: novo,
        },
      },
    };
  }
  return saida;
}
