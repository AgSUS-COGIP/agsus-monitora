/*
  Diferenças por cargo da regra da avaliação documental (regra.por_cargo).

  A regra varia por nível (por_nivel dos blocos); alguns editais mudam também
  por CARGO (114/2026: o Motorista categoria D tem cursos até 15 com 5 pontos
  do certificado UMCQA; os cargos 5 a 8 exigem Cromatografia Gasosa…). Cada
  diferença diz a quem vale (códigos de vaga da Empregare e/ou o começo do
  nome do cargo, como "CARGO 15") e o que muda em cada bloco:

    por_cargo: [{
      codigo, rotulo, vagas: ["182528"], cargos: ["CARGO 15"],
      blocos: {
        <CODIGO_DO_BLOCO>: {
          teto, faixas,         // CURSOS (faixas) e TITULOS/VINCULOS (teto)
          extras: [{ codigo, rotulo, pontos, item_edital }],   // CURSOS e TITULOS
          area,                 // VINCULOS: a área exigida da experiência
          requisitos: [{ codigo, rotulo, motivo, item_edital,
                         termos: [], nao_pontua_em: [<bloco>] }]  // DOCUMENTO
        }
      }
    }]

  Precedência: cargo > nível > padrão. A primeira diferença cujo código de
  vaga é o da ficha vale; sem ela, a primeira cujo cargo casa (palavras
  inteiras, sem acento: "CARGO 1" não casa "CARGO 15"). A regra da vaga
  (regraDaVaga) já traz cada bloco com a diferença aplicada: por_nivel do
  nível por baixo, a diferença por cima; os requisitos viram motivos do bloco
  (efeito ELIMINA), os extras viram linhas conferíveis que somam até o teto.

  A mesma conta está em python/monitora/avaliacao_documental/pontuacao.py
  (regra_da_vaga) e no banco (private."FC_REGRA_DA_VAGA",
  supabase/migrations/20261013130000_regra_por_cargo.sql), e os casos dourados
  de tests/fixtures/avaliacao-documental/casos-de-pontuacao.json rodam nos
  dois lados. Mudou aqui, muda lá.
*/

export type ItemExtra = {
  codigo: string;
  rotulo: string;
  pontos: number;
  item_edital?: string;
};

export type RequisitoDoCargo = {
  codigo: string;
  rotulo: string;
  /** O texto do motivo da eliminação quando não confere. */
  motivo: string;
  item_edital?: string;
  /** Palavras do nome do curso/título que é este requisito (aviso do 8.2.7). */
  termos?: string[];
  /** Blocos (títulos, cursos) onde o documento do requisito não pontua. */
  nao_pontua_em?: string[];
};

export type FaixaDoCargo = {
  min_horas: number;
  max_horas: number | null;
  pontos: number;
};

export type SobrescritaDoBloco = {
  teto?: number | null;
  faixas?: FaixaDoCargo[];
  extras?: ItemExtra[];
  area?: string;
  requisitos?: RequisitoDoCargo[];
};

export type DiferencaDoCargo = {
  codigo: string;
  rotulo: string;
  vagas?: string[];
  cargos?: string[];
  blocos: Record<string, SobrescritaDoBloco>;
};

/** A vaga da ficha: o código da Empregare, o nome do cargo e o nível. */
export type VagaDaFicha = {
  vaga?: string | number | null;
  cargo?: string | null;
  nivel?: string | null;
};

type BlocoGenerico = Record<string, unknown> & {
  codigo?: string;
  tipo?: string;
  titulo?: string;
  item_edital?: string;
  motivos?: unknown;
  por_nivel?: unknown;
};
type RegraGenerica = Record<string, unknown> & {
  blocos?: unknown;
  por_cargo?: unknown;
};

export const LIMITES_POR_CARGO = Object.freeze({
  diferencas: 40,
  vagas: 200,
  cargos: 20,
  extras: 10,
  requisitos: 15,
  termos: 10,
  naoPontuaEm: 4,
  rotulo: 200,
  motivo: 1000,
  area: 1000,
});

/** O que cada tipo de bloco aceita mudar por cargo. */
export const CAMPOS_POR_TIPO: Readonly<Record<string, readonly string[]>> =
  Object.freeze({
    CURSOS: ["teto", "faixas", "extras"],
    TITULOS: ["teto", "extras"],
    VINCULOS: ["teto", "area"],
    DOCUMENTO: ["requisitos"],
  });

const CODIGO = /^[A-Z][A-Z0-9_]{1,29}$/;
const VAGA = /^[0-9]{1,20}$/;

const ehObjeto = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);
const lista = <T = unknown>(v: unknown): T[] =>
  Array.isArray(v) ? (v as T[]) : [];
const texto = (v: unknown) => (typeof v === "string" ? v : "");
const ehNumero = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);
const entre = (v: unknown, min: number, max: number) =>
  ehNumero(v) && v >= min && v <= max;

/** O texto do cargo para comparar: sem acento, minúsculo, só letras e dígitos. */
export function textoDoCargo(valor: unknown): string {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** O cargo casa com o seletor (palavras inteiras: "cargo 1" não casa "cargo 15"). */
export function cargoCasa(cargo: unknown, seletor: unknown): boolean {
  const s = textoDoCargo(seletor);
  const c = textoDoCargo(cargo);
  return Boolean(s && c) && ` ${c} `.includes(` ${s} `);
}

/** O seletor curto de um cargo do quadro: "CARGO 15: MOTORISTA…" → "CARGO 15". */
export function seletorDoCargo(nome: unknown): string {
  const t = String(nome ?? "").trim();
  const m = /^cargo\s*n?[ºo°.]?\s*(\d{1,3})\b/i.exec(t);
  return m ? `CARGO ${m[1]}` : t.replace(/\s*\(n[íi]vel [^)]*\)\s*$/i, "");
}

/** A diferença que vale para a vaga (null = só nível e padrão). */
export function diferencaDaVaga(
  regra: unknown,
  alvo: VagaDaFicha | null | undefined,
): DiferencaDoCargo | null {
  const diferencas = lista<DiferencaDoCargo>(
    ehObjeto(regra) ? regra.por_cargo : null,
  ).filter(ehObjeto);
  const vaga = String(alvo?.vaga ?? "").trim();
  if (vaga) {
    const pelaVaga = diferencas.find((d) =>
      lista(d.vagas).some((v) => String(v).trim() === vaga),
    );
    if (pelaVaga) return pelaVaga;
  }
  const cargo = alvo?.cargo;
  if (!textoDoCargo(cargo)) return null;
  return (
    diferencas.find((d) => lista(d.cargos).some((s) => cargoCasa(cargo, s))) ??
    null
  );
}

/** O bloco com a diferença do cargo por cima do nível (precedência cargo > nível > padrão). */
export function blocoDoCargo(
  bloco: BlocoGenerico,
  sobrescrita: SobrescritaDoBloco | null | undefined,
  nivel: string | null | undefined,
): BlocoGenerico {
  if (!ehObjeto(sobrescrita)) return bloco;
  const parte = ehObjeto(bloco.por_nivel)
    ? (bloco.por_nivel as Record<string, unknown>)[String(nivel ?? "")]
    : undefined;
  const r: BlocoGenerico = ehObjeto(parte)
    ? { ...bloco, ...parte }
    : { ...bloco };
  delete r.por_nivel;
  if (Object.hasOwn(sobrescrita, "teto")) r.teto = sobrescrita.teto ?? null;
  if (lista(sobrescrita.faixas).length) r.faixas = sobrescrita.faixas;
  if (lista(sobrescrita.extras).length) r.extras = sobrescrita.extras;
  if (texto(sobrescrita.area).trim()) r.area = texto(sobrescrita.area).trim();
  const requisitos = lista<RequisitoDoCargo>(sobrescrita.requisitos);
  if (requisitos.length) {
    r.requisitos = requisitos;
    r.motivos = [
      ...lista(bloco.motivos),
      ...requisitos.map((q) => ({
        codigo: q.codigo,
        texto: q.motivo,
        item_edital: q.item_edital || bloco.item_edital || "",
        efeito: "ELIMINA",
      })),
    ];
  }
  return r;
}

/**
 * A regra da vaga: os blocos com a diferença do cargo aplicada, `por_cargo`
 * vazio (aplicar de novo não muda nada) e `cargo` = { codigo, rotulo } da
 * diferença. Sem diferença para a vaga, a própria regra.
 */
export function regraDaVaga<T extends RegraGenerica>(
  regra: T,
  alvo: VagaDaFicha | null | undefined,
): T {
  const diferenca = diferencaDaVaga(regra, alvo);
  if (!diferenca) return regra;
  const sobrescritas = ehObjeto(diferenca.blocos) ? diferenca.blocos : {};
  return {
    ...regra,
    por_cargo: [],
    cargo: { codigo: diferenca.codigo, rotulo: diferenca.rotulo },
    blocos: lista<BlocoGenerico>(regra.blocos).map((b) =>
      ehObjeto(b)
        ? blocoDoCargo(
            b,
            sobrescritas[String(b.codigo)] as SobrescritaDoBloco | undefined,
            alvo?.nivel,
          )
        : b,
    ),
  };
}

/* ── Pontos dos extras e o lançamento da ficha ─────────────────────────── */

type Lancado = Record<string, unknown> & {
  situacao?: string | null;
  motivos?: string[];
  extras?: Record<string, boolean>;
  requisitos?: Record<string, boolean>;
  nota_ajustada?: number | null;
};

/** Os pontos dos extras conferidos (Confere) do bloco. */
export function pontosDosExtras(bloco: unknown, lancado: unknown): number {
  const marcados =
    ehObjeto(lancado) && ehObjeto(lancado.extras) ? lancado.extras : {};
  return lista<ItemExtra>(ehObjeto(bloco) ? bloco.extras : null)
    .filter((e) => ehObjeto(e) && marcados[e.codigo] === true)
    .reduce((soma, e) => soma + (ehNumero(e.pontos) ? e.pontos : 0), 0);
}

/** O bloco lançado com a linha extra conferida (true), não conferida (false) ou desmarcada (null). */
export function lancadoComExtra(
  lancado: Lancado | undefined,
  codigo: string,
  valor: boolean | null,
): Lancado {
  const atual = { ...(ehObjeto(lancado?.extras) ? lancado.extras : {}) };
  if (valor === null) delete atual[codigo];
  else atual[codigo] = valor;
  return { ...(lancado ?? {}), extras: atual };
}

/**
 * O bloco lançado depois de uma linha da lista de requisitos do cargo: o
 * Não confere entra como motivo (elimina) e deixa o bloco Não conforme;
 * com todas as linhas Confere e nenhum outro motivo, Conforme.
 */
export function lancadoComRequisito(
  bloco: { requisitos?: RequisitoDoCargo[] },
  lancado: Lancado | undefined,
  codigo: string,
  valor: boolean | null,
): Lancado {
  const requisitos = lista<RequisitoDoCargo>(bloco.requisitos);
  const codigos = requisitos.map((r) => r.codigo);
  const marcados: Record<string, boolean> = {
    ...(ehObjeto(lancado?.requisitos) ? lancado.requisitos : {}),
  };
  if (valor === null) delete marcados[codigo];
  else marcados[codigo] = valor;
  const outros = lista<string>(lancado?.motivos).filter(
    (m) => !codigos.includes(m),
  );
  const naoConferem = codigos.filter((c) => marcados[c] === false);
  const todos = codigos.every((c) => typeof marcados[c] === "boolean");
  const situacaoAtual = lancado?.situacao ?? null;
  let situacao = situacaoAtual;
  if (naoConferem.length)
    situacao = situacaoAtual === "NAO_ENVIADO" ? "NAO_ENVIADO" : "NAO_CONFORME";
  else if (todos && !outros.length) situacao = "CONFORME";
  else if (!outros.length && situacaoAtual !== "CONFORME") situacao = null;
  return {
    ...(lancado ?? {}),
    requisitos: marcados,
    situacao,
    motivos: situacao === "CONFORME" ? [] : [...outros, ...naoConferem],
  };
}

/** As faltas do cargo num bloco (as mesmas do banco em FC_PENDENCIAS_FICHA). */
export function faltasDoCargo(
  bloco: unknown,
  lancado: unknown,
): { tipo: "requisito" | "extra"; texto: string }[] {
  if (!ehObjeto(bloco)) return [];
  const l: Lancado = ehObjeto(lancado) ? lancado : {};
  if (l.situacao !== "CONFORME") return [];
  const faltas: { tipo: "requisito" | "extra"; texto: string }[] = [];
  const marcados = ehObjeto(l.requisitos) ? l.requisitos : {};
  if (
    lista<RequisitoDoCargo>(bloco.requisitos).some(
      (r) => marcados[r.codigo] !== true,
    )
  )
    faltas.push({
      tipo: "requisito",
      texto: "Confira cada requisito do cargo.",
    });
  // Os extras só contam na pontuação pelos itens (sem nota ajustada).
  if (!ehNumero(l.nota_ajustada)) {
    const extras = ehObjeto(l.extras) ? l.extras : {};
    for (const e of lista<ItemExtra>(bloco.extras))
      if (typeof extras[e.codigo] !== "boolean")
        faltas.push({ tipo: "extra", texto: `Confira: ${e.rotulo}.` });
  }
  return faltas;
}

/* ── 8.2.7: cada título conta uma única vez ─────────────────────────────── */

export type AvisoDoTituloUnico = {
  requisito: string;
  item: string | null;
  texto: string;
};

/**
 * Os avisos do item 8.2.7 num bloco de títulos ou cursos: o documento que é
 * requisito do cargo (nao_pontua_em este bloco) lançado para pontuar. Com o
 * nome do curso/título casando os termos do requisito, aviso da linha; com o
 * requisito conferido e linhas lançadas sem o nome casar, o lembrete.
 */
export function avisosDoTituloUnico(
  regra: unknown,
  bloco: unknown,
  itens: unknown,
  lancamento: unknown,
): AvisoDoTituloUnico[] {
  if (!ehObjeto(regra) || !ehObjeto(bloco)) return [];
  const codigo = String(bloco.codigo ?? "");
  const aceitos = lista<Record<string, unknown>>(itens).filter(
    (i) => ehObjeto(i) && i.aceito !== false,
  );
  const blocosLancados =
    ehObjeto(lancamento) && ehObjeto(lancamento.blocos)
      ? lancamento.blocos
      : {};
  const avisos: AvisoDoTituloUnico[] = [];
  for (const dono of lista<BlocoGenerico>(regra.blocos)) {
    if (!ehObjeto(dono)) continue;
    for (const q of lista<RequisitoDoCargo>(dono.requisitos)) {
      if (!lista(q.nao_pontua_em).includes(codigo)) continue;
      const termos = lista<string>(q.termos).map(textoDoCargo).filter(Boolean);
      const casados = aceitos.filter((i) =>
        termos.some((t) => cargoCasa(i.nome, t)),
      );
      for (const i of casados)
        avisos.push({
          requisito: q.codigo,
          item: texto(i.nome) || null,
          texto: `Item 8.2.7: "${texto(i.nome)}" parece ser o requisito "${q.rotulo}" — documento usado como requisito não pontua (8.2.10.5).`,
        });
      const lancadoDoDono = blocosLancados[String(dono.codigo)];
      const conferido =
        ehObjeto(lancadoDoDono) &&
        ehObjeto(lancadoDoDono.requisitos) &&
        lancadoDoDono.requisitos[q.codigo] === true;
      if (!casados.length && conferido && aceitos.length)
        avisos.push({
          requisito: q.codigo,
          item: null,
          texto: `Item 8.2.7: "${q.rotulo}" já valeu como requisito do cargo e não pontua aqui.`,
        });
    }
  }
  return avisos;
}

/* ── Validação (o banco repete em private."FC_VALIDAR_POR_CARGO_ANALISE") ── */

function conferirTexto(
  erros: string[],
  valor: unknown,
  rotulo: string,
  { obrigatorio = false, max }: { obrigatorio?: boolean; max: number },
) {
  if (valor === undefined || valor === null || valor === "") {
    if (obrigatorio) erros.push(`${rotulo}: obrigatório.`);
    return;
  }
  if (typeof valor !== "string") erros.push(`${rotulo}: deve ser texto.`);
  else if (!valor.trim() && obrigatorio) erros.push(`${rotulo}: obrigatório.`);
  else if (valor.length > max) erros.push(`${rotulo}: até ${max} caracteres.`);
}

function conferirTextos(
  erros: string[],
  valor: unknown,
  rotulo: string,
  max: number,
  maxTexto: number,
) {
  if (valor === undefined || valor === null) return;
  if (
    !Array.isArray(valor) ||
    valor.length > max ||
    valor.some((t) => typeof t !== "string" || !t.trim() || t.length > maxTexto)
  )
    erros.push(
      `${rotulo}: lista de até ${max} textos de 1 a ${maxTexto} caracteres.`,
    );
}

function conferirFaixas(erros: string[], faixas: unknown, onde: string) {
  if (!Array.isArray(faixas) || !faixas.length || faixas.length > 10) {
    erros.push(`${onde}: de 1 a 10 faixas de carga horária.`);
    return;
  }
  faixas.forEach((f, j) => {
    if (
      !ehObjeto(f) ||
      !entre(f.min_horas, 0, 20000) ||
      !(f.max_horas === null || entre(f.max_horas, 0, 20000)) ||
      (ehNumero(f.max_horas) && f.max_horas < (f.min_horas as number)) ||
      !entre(f.pontos, 0, 100)
    )
      erros.push(
        `${onde}, faixa ${j + 1}: horas de 0 a 20.000 (mínimo ≤ máximo) e pontos de 0 a 100.`,
      );
  });
}

function conferirSobrescrita(
  erros: string[],
  s: unknown,
  bloco: BlocoGenerico,
  blocos: BlocoGenerico[],
  onde: string,
) {
  if (!ehObjeto(s)) {
    erros.push(`${onde}: diferença inválida.`);
    return;
  }
  const campos = CAMPOS_POR_TIPO[String(bloco.tipo)] ?? [];
  if (!campos.length) {
    erros.push(`${onde}: este tipo de bloco não muda por cargo.`);
    return;
  }
  const chaves = Object.keys(s);
  if (!chaves.length) erros.push(`${onde}: diga o que muda.`);
  for (const k of chaves)
    if (!campos.includes(k))
      erros.push(`${onde}: ${k} não muda por cargo neste bloco.`);
  if (Object.hasOwn(s, "teto") && !(s.teto === null || entre(s.teto, 0, 100)))
    erros.push(`${onde}: teto entre 0 e 100.`);
  if (Object.hasOwn(s, "faixas")) conferirFaixas(erros, s.faixas, onde);
  if (Object.hasOwn(s, "area"))
    conferirTexto(erros, s.area, `${onde} (área exigida)`, {
      obrigatorio: true,
      max: LIMITES_POR_CARGO.area,
    });
  if (Object.hasOwn(s, "extras")) {
    const extras = s.extras;
    if (
      !Array.isArray(extras) ||
      !extras.length ||
      extras.length > LIMITES_POR_CARGO.extras
    )
      erros.push(`${onde}: de 1 a ${LIMITES_POR_CARGO.extras} itens extras.`);
    else {
      const vistos = new Set<string>();
      extras.forEach((e, j) => {
        const aqui = `${onde}, extra ${j + 1}`;
        if (!ehObjeto(e) || !CODIGO.test(texto(e.codigo))) {
          erros.push(
            `${aqui}: código em maiúsculas (2 a 30, letras, dígitos, _).`,
          );
          return;
        }
        if (vistos.has(e.codigo as string))
          erros.push(`${aqui}: código repetido.`);
        vistos.add(e.codigo as string);
        conferirTexto(erros, e.rotulo, `${aqui} (rótulo)`, {
          obrigatorio: true,
          max: LIMITES_POR_CARGO.rotulo,
        });
        if (!entre(e.pontos, 0, 100))
          erros.push(`${aqui}: pontos entre 0 e 100.`);
        conferirTexto(erros, e.item_edital, `${aqui} (item do edital)`, {
          max: 40,
        });
      });
    }
  }
  if (Object.hasOwn(s, "requisitos")) {
    const requisitos = s.requisitos;
    if (
      !Array.isArray(requisitos) ||
      !requisitos.length ||
      requisitos.length > LIMITES_POR_CARGO.requisitos
    )
      erros.push(`${onde}: de 1 a ${LIMITES_POR_CARGO.requisitos} requisitos.`);
    else {
      const doBloco = new Set(
        lista<{ codigo?: string }>(bloco.motivos).map((m) => m?.codigo),
      );
      const pontuam = new Set(
        blocos
          .filter((b) => b.tipo === "TITULOS" || b.tipo === "CURSOS")
          .map((b) => b.codigo),
      );
      const vistos = new Set<string>();
      requisitos.forEach((q, j) => {
        const aqui = `${onde}, requisito ${j + 1}`;
        if (!ehObjeto(q) || !CODIGO.test(texto(q.codigo))) {
          erros.push(
            `${aqui}: código em maiúsculas (2 a 30, letras, dígitos, _).`,
          );
          return;
        }
        const codigo = q.codigo as string;
        if (vistos.has(codigo)) erros.push(`${aqui}: código repetido.`);
        else if (doBloco.has(codigo))
          erros.push(`${aqui}: o código ${codigo} já é um motivo do bloco.`);
        vistos.add(codigo);
        conferirTexto(erros, q.rotulo, `${aqui} (rótulo)`, {
          obrigatorio: true,
          max: LIMITES_POR_CARGO.rotulo,
        });
        conferirTexto(erros, q.motivo, `${aqui} (motivo)`, {
          obrigatorio: true,
          max: LIMITES_POR_CARGO.motivo,
        });
        conferirTexto(erros, q.item_edital, `${aqui} (item do edital)`, {
          max: 40,
        });
        conferirTextos(
          erros,
          q.termos,
          `${aqui} (termos)`,
          LIMITES_POR_CARGO.termos,
          100,
        );
        const onde8 = q.nao_pontua_em;
        if (onde8 !== undefined && onde8 !== null) {
          if (
            !Array.isArray(onde8) ||
            onde8.length > LIMITES_POR_CARGO.naoPontuaEm ||
            onde8.some((c) => !pontuam.has(c))
          )
            erros.push(
              `${aqui}: "não pontua em" só com blocos de títulos ou cursos da regra.`,
            );
        }
      });
    }
  }
}

/** Confere regra.por_cargo. Devolve os erros (vazio = válido). */
export function validarPorCargo(regra: unknown): string[] {
  const erros: string[] = [];
  if (!ehObjeto(regra)) return erros;
  const valor = regra.por_cargo;
  if (valor === undefined || valor === null) return erros;
  if (!Array.isArray(valor) || valor.length > LIMITES_POR_CARGO.diferencas) {
    erros.push(`Diferenças por cargo: até ${LIMITES_POR_CARGO.diferencas}.`);
    return erros;
  }
  const blocos = lista<BlocoGenerico>(regra.blocos).filter(ehObjeto);
  const codigos = new Set<string>();
  const vagas = new Map<string, number>();
  valor.forEach((d, i) => {
    const onde = `Diferença por cargo ${i + 1}${ehObjeto(d) && d.rotulo ? ` (${String(d.rotulo)})` : ""}`;
    if (!ehObjeto(d)) {
      erros.push(`${onde}: inválida.`);
      return;
    }
    if (!CODIGO.test(texto(d.codigo)))
      erros.push(`${onde}: código em maiúsculas (2 a 30, letras, dígitos, _).`);
    else if (codigos.has(d.codigo as string))
      erros.push(`${onde}: código repetido.`);
    codigos.add(texto(d.codigo));
    conferirTexto(erros, d.rotulo, `${onde} (nome)`, {
      obrigatorio: true,
      max: 120,
    });
    const listaDeVagas = d.vagas;
    if (
      listaDeVagas !== undefined &&
      listaDeVagas !== null &&
      (!Array.isArray(listaDeVagas) ||
        listaDeVagas.length > LIMITES_POR_CARGO.vagas ||
        listaDeVagas.some((v) => typeof v !== "string" || !VAGA.test(v)))
    )
      erros.push(
        `${onde}: vagas com o código da Empregare (só dígitos, até ${LIMITES_POR_CARGO.vagas}).`,
      );
    else
      for (const v of lista<string>(listaDeVagas)) {
        const outra = vagas.get(v);
        if (outra !== undefined && outra !== i)
          erros.push(`${onde}: a vaga ${v} já está na diferença ${outra + 1}.`);
        else vagas.set(v, i);
      }
    conferirTextos(
      erros,
      d.cargos,
      `${onde} (cargos)`,
      LIMITES_POR_CARGO.cargos,
      LIMITES_POR_CARGO.rotulo,
    );
    if (!lista(d.vagas).length && !lista(d.cargos).length)
      erros.push(`${onde}: diga as vagas ou o cargo.`);
    if (!ehObjeto(d.blocos) || !Object.keys(d.blocos).length) {
      erros.push(`${onde}: diga o que muda em ao menos um bloco.`);
      return;
    }
    for (const [codigo, s] of Object.entries(d.blocos)) {
      const bloco = blocos.find((b) => b.codigo === codigo);
      if (!bloco) {
        erros.push(`${onde}: o bloco ${codigo} não está na regra.`);
        continue;
      }
      conferirSobrescrita(erros, s, bloco, blocos, `${onde}, ${codigo}`);
    }
  });
  return erros;
}

/** Uma diferença nova (sem pesos: o usuário escolhe vagas e o que muda). */
export function diferencaNova(
  existentes: unknown,
  rotulo = "",
): DiferencaDoCargo {
  const usados = new Set(
    lista<{ codigo?: string }>(existentes).map((d) => d?.codigo),
  );
  let n = lista(existentes).length + 1;
  while (usados.has(`CARGO_${n}`)) n += 1;
  return { codigo: `CARGO_${n}`, rotulo, vagas: [], cargos: [], blocos: {} };
}

/** Um resumo de uma linha do que a diferença muda ("Cursos: teto 15, +1 extra · Requisito…: 2 requisitos"). */
export function resumoDaDiferenca(
  diferenca: DiferencaDoCargo,
  blocos: unknown,
): string {
  const partes: string[] = [];
  for (const [codigo, s] of Object.entries(
    ehObjeto(diferenca?.blocos) ? diferenca.blocos : {},
  )) {
    const bloco = lista<BlocoGenerico>(blocos).find(
      (b) => ehObjeto(b) && b.codigo === codigo,
    );
    const nome = String(bloco?.titulo || codigo)
      .split(/ \(|,/)[0]
      ?.trim();
    const itens: string[] = [];
    if (ehObjeto(s)) {
      if (Object.hasOwn(s, "teto"))
        itens.push(s.teto === null ? "sem teto" : `teto ${s.teto}`);
      if (lista(s.faixas).length)
        itens.push(`${lista(s.faixas).length} faixas`);
      const extras = lista(s.extras).length;
      if (extras) itens.push(`+${extras} ${extras === 1 ? "extra" : "extras"}`);
      if (texto(s.area).trim()) itens.push("área exigida");
      const req = lista(s.requisitos).length;
      if (req) itens.push(`${req} ${req === 1 ? "requisito" : "requisitos"}`);
    }
    if (itens.length) partes.push(`${nome}: ${itens.join(", ")}`);
  }
  return partes.join(" · ");
}

/** Um código livre a partir do texto ("CNH categoria D" → "CNH_CATEGORIA_D"), fora dos usados. */
export function codigoDoTexto(
  valor: unknown,
  usados: Iterable<string> = [],
): string {
  const ocupados = new Set(usados);
  const base =
    textoDoCargo(valor)
      .toUpperCase()
      .replace(/ /g, "_")
      .replace(/^[^A-Z]+/, "")
      .slice(0, 26) || "ITEM";
  const inicio = base.length < 2 ? `${base}_X` : base;
  if (!ocupados.has(inicio)) return inicio;
  for (let n = 2; n < 1000; n += 1) {
    const codigo = `${inicio.slice(0, 26)}_${n}`;
    if (!ocupados.has(codigo)) return codigo;
  }
  return `${inicio.slice(0, 20)}_${Date.now() % 100000}`;
}
