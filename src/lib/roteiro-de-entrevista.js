/*
  Roteiro de entrevista (modelo reutilizável por edital), sem React e sem
  banco: o rascunho do formulário "Roteiros" do painel de entrevistas, a
  validação, o que vai para `salvar_roteiro_entrevista` e as contas que a tela
  mostra (pontuação máxima, mínimo de cada competência, "+50%" do peso, notas
  aceitas pela escala).

  O contrato é o da migration 20260930220000_entrevistas_roteiros_e_notas.sql:
  editar um roteiro grava uma versão nova (`origem` = o roteiro de origem); a
  versão anterior continua valendo para os editais que já a usam.

  No rascunho, todo número é texto (o que a pessoa digitou): o formulário não
  apaga "1," no meio da digitação. A conversão fica em `lerNumero` e nos
  `…ParaSalvar`.

  A regra de convocação e a composição da banca têm o mesmo formato no roteiro
  (padrão) e na configuração do edital; os conversores delas moram aqui e
  src/lib/conducao-de-entrevista.js os reaproveita.
*/

export const ESCALAS = Object.freeze([
  Object.freeze({ valor: "FAIXA", rotulo: "Faixa (0 até o máximo)" }),
  Object.freeze({ valor: "LISTA", rotulo: "Lista de notas" }),
  Object.freeze({ valor: "NIVEIS", rotulo: "Níveis descritos" }),
]);

export const TIPOS_DE_MINIMO = Object.freeze([
  Object.freeze({ valor: "VALOR", rotulo: "pontos" }),
  Object.freeze({ valor: "PERCENTUAL", rotulo: "% do máximo" }),
]);

export const TIPOS_DE_AVALIACAO = Object.freeze([
  Object.freeze({ valor: "INDIVIDUAL", rotulo: "Individual" }),
  Object.freeze({ valor: "GRUPO", rotulo: "Em grupo" }),
]);

export const LIMITE_DE_COMPETENCIAS = 20;

export const rotuloDaEscala = (valor) =>
  ESCALAS.find((e) => e.valor === valor)?.rotulo || valor || "—";

const texto = (valor) => String(valor ?? "").trim();

/** "1,5" ou "1.5" → 1.5; vazio → null; o que não é número → NaN. */
export function lerNumero(valor) {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : NaN;
  const bruto = texto(valor).replace(/\s+/g, "");
  if (!bruto) return null;
  const normal = bruto.includes(",")
    ? bruto.replace(/\./g, "").replace(",", ".")
    : bruto;
  const numero = Number(normal);
  return Number.isFinite(numero) ? numero : NaN;
}

/** O número como texto de campo (vazio para nulo). */
export const textoDoNumero = (valor) =>
  valor === null || valor === undefined || valor === ""
    ? ""
    : String(Number(valor));

/* Arredonda como o `round(numeric, 2)` do PostgreSQL (metade para longe do zero). */
export function arredondar(valor, casas = 2) {
  const fator = 10 ** casas;
  const sinal = valor < 0 ? -1 : 1;
  return (sinal * Math.round(Math.abs(valor) * fator + 1e-9)) / fator;
}

const ehInteiro = (n) => Number.isInteger(n);

let contador = 0;
/** Chave estável de uma linha do rascunho (lista do React). */
export const novaChave = () => `k${++contador}`;

/* ── Peso, mínimo e pontuação ──────────────────────────────────────── */

/** 1,5 → "+50%"; 0,5 → "−50%"; 1 → "". */
export function rotuloDoPeso(peso) {
  const p = lerNumero(peso);
  if (p === null || Number.isNaN(p) || p <= 0 || p === 1) return "";
  const diferenca = arredondar((p - 1) * 100, 0);
  return diferenca > 0 ? `+${diferenca}%` : `−${Math.abs(diferenca)}%`;
}

/** Nota máxima da competência na ficha (nota máxima × peso). */
export function maximoDaCompetencia(competencia) {
  const maxima = lerNumero(competencia?.nota_maxima);
  const peso = lerNumero(competencia?.peso) ?? 1;
  if (!Number.isFinite(maxima) || !Number.isFinite(peso)) return null;
  return arredondar(maxima * peso);
}

/** O mínimo da competência em pontos (o percentual é da nota máxima × peso). */
export function minimoEmPontos(competencia) {
  const minimo = lerNumero(competencia?.minimo);
  if (minimo === null || Number.isNaN(minimo)) return null;
  if (competencia?.tipo_minimo === "PERCENTUAL") {
    const maximo = maximoDaCompetencia(competencia);
    return maximo === null ? null : arredondar((maximo * minimo) / 100);
  }
  return minimo;
}

/** Soma de nota máxima × peso das competências. */
export function pontuacaoMaxima(competencias) {
  return arredondar(
    (competencias || []).reduce(
      (total, c) => total + (maximoDaCompetencia(c) ?? 0),
      0,
    ),
  );
}

/** A linha de prévia do roteiro: "Pontuação máxima 20 · mínimo 8". */
export function textoDaPontuacao(roteiro) {
  const maxima = pontuacaoMaxima(roteiro?.competencias);
  const minimo = lerNumero(roteiro?.nota_minima_total);
  const fmt = (n) => String(n).replace(".", ",");
  return `Pontuação máxima ${fmt(maxima)} · ${
    minimo === null || Number.isNaN(minimo)
      ? "sem mínimo total"
      : `mínimo ${fmt(minimo)}`
  }`;
}

/* ── Escala: as notas que o avaliador pode dar ─────────────────────── */

/**
 * As notas aceitas numa competência, na escala do roteiro (o mesmo que
 * `lancar_notas_entrevista` confere): `[{ valor, rotulo, descricao }]`.
 */
export function opcoesDaEscala(roteiro, notaMaxima) {
  const maximo = lerNumero(notaMaxima);
  const cabe = (n) =>
    Number.isFinite(n) && n >= 0 && (!Number.isFinite(maximo) || n <= maximo);
  if (roteiro?.escala === "NIVEIS") {
    return (roteiro.niveis || [])
      .map((n) => ({
        valor: lerNumero(n.nota),
        rotulo: texto(n.nome),
        descricao: texto(n.descricao),
      }))
      .filter((n) => cabe(n.valor))
      .sort((a, b) => a.valor - b.valor);
  }
  if (roteiro?.escala === "LISTA") {
    const vistas = new Set();
    return (roteiro.notas_permitidas || [])
      .map(lerNumero)
      .filter((n) => cabe(n) && !vistas.has(n) && vistas.add(n))
      .sort((a, b) => a - b)
      .map((valor) => ({ valor, rotulo: "", descricao: "" }));
  }
  const passo = lerNumero(roteiro?.passo) || 0.5;
  if (!Number.isFinite(maximo) || passo <= 0) return [];
  const quantos = Math.min(1000, Math.floor(maximo / passo + 1e-9));
  return Array.from({ length: quantos + 1 }, (_, i) => ({
    valor: arredondar(i * passo),
    rotulo: "",
    descricao: "",
  }));
}

/** A nota cabe na escala do roteiro (espelho da validação do banco). */
export function notaNaEscala(roteiro, competencia, nota) {
  const n = lerNumero(nota);
  const maximo = lerNumero(competencia?.nota_maxima);
  if (n === null || Number.isNaN(n) || n < 0) return false;
  if (Number.isFinite(maximo) && n > maximo) return false;
  if (roteiro?.escala === "FAIXA" || !roteiro?.escala) {
    const passo = lerNumero(roteiro?.passo) || 0.5;
    const razao = n / passo;
    return Math.abs(razao - Math.round(razao)) < 1e-9;
  }
  return opcoesDaEscala(roteiro, maximo).some((o) => o.valor === n);
}

/* ── Convocação e banca (padrão do roteiro ou do edital) ───────────── */

export function convocacaoParaRascunho(convocacao) {
  const c = convocacao || {};
  return {
    multiplo_imediatas: textoDoNumero(c.multiplo_imediatas),
    posicao_cadastro_reserva: textoDoNumero(c.posicao_cadastro_reserva),
    excecoes: (Array.isArray(c.excecoes) ? c.excecoes : []).map((e) => ({
      chave: novaChave(),
      termo_cargo: texto(e?.termo_cargo),
      multiplo_imediatas: textoDoNumero(e?.multiplo_imediatas),
      posicao_cadastro_reserva: textoDoNumero(e?.posicao_cadastro_reserva),
    })),
  };
}

const numeroOuNulo = (valor) => {
  const n = lerNumero(valor);
  return n === null || Number.isNaN(n) ? null : n;
};

export function convocacaoDoRascunho(rascunho) {
  const r = rascunho || {};
  return {
    multiplo_imediatas: numeroOuNulo(r.multiplo_imediatas),
    posicao_cadastro_reserva: numeroOuNulo(r.posicao_cadastro_reserva),
    excecoes: (r.excecoes || [])
      .filter((e) => texto(e.termo_cargo))
      .map((e) => ({
        termo_cargo: texto(e.termo_cargo),
        multiplo_imediatas: numeroOuNulo(e.multiplo_imediatas),
        posicao_cadastro_reserva: numeroOuNulo(e.posicao_cadastro_reserva),
      })),
  };
}

export function novaExcecao() {
  return {
    chave: novaChave(),
    termo_cargo: "",
    multiplo_imediatas: "",
    posicao_cadastro_reserva: "",
  };
}

function conferirQuantidade(erros, chave, valor, { minimo, maximo, rotulo }) {
  const n = lerNumero(valor);
  if (n === null) return;
  if (Number.isNaN(n) || !ehInteiro(n) || n < minimo || n > maximo)
    erros[chave] = `${rotulo}: número inteiro de ${minimo} a ${maximo}.`;
}

/** Erros da regra de convocação (chaves com o `prefixo`). */
export function errosDaConvocacao(rascunho, prefixo = "convocacao") {
  const erros = {};
  const r = rascunho || {};
  conferirQuantidade(erros, `${prefixo}.multiplo`, r.multiplo_imediatas, {
    minimo: 1,
    maximo: 100,
    rotulo: "Múltiplo das vagas imediatas",
  });
  conferirQuantidade(erros, `${prefixo}.posicao`, r.posicao_cadastro_reserva, {
    minimo: 1,
    maximo: 2000,
    rotulo: "Posição do cadastro reserva",
  });
  for (const e of r.excecoes || []) {
    if (!texto(e.termo_cargo))
      erros[`${prefixo}.excecao.${e.chave}`] =
        "Exceção sem o termo do cargo (ex.: Enfermagem).";
    conferirQuantidade(
      erros,
      `${prefixo}.excecao.${e.chave}.multiplo`,
      e.multiplo_imediatas,
      { minimo: 1, maximo: 100, rotulo: "Múltiplo da exceção" },
    );
    conferirQuantidade(
      erros,
      `${prefixo}.excecao.${e.chave}.posicao`,
      e.posicao_cadastro_reserva,
      { minimo: 1, maximo: 2000, rotulo: "Posição da exceção" },
    );
  }
  return erros;
}

export function bancaParaRascunho(banca) {
  return (Array.isArray(banca) ? banca : []).map((b) => ({
    chave: novaChave(),
    origem: texto(b?.origem),
    quantidade: textoDoNumero(b?.quantidade ?? 1),
  }));
}

export function bancaDoRascunho(linhas) {
  return (linhas || [])
    .filter((b) => texto(b.origem))
    .map((b) => ({
      origem: texto(b.origem),
      quantidade: numeroOuNulo(b.quantidade) ?? 1,
    }));
}

export const novaOrigemDaBanca = () => ({
  chave: novaChave(),
  origem: "",
  quantidade: "1",
});

export function errosDaBanca(linhas, prefixo = "banca") {
  const erros = {};
  for (const b of linhas || []) {
    const origem = texto(b.origem);
    if (origem.length < 2 || origem.length > 80)
      erros[`${prefixo}.${b.chave}`] = "Origem da banca: de 2 a 80 caracteres.";
    conferirQuantidade(
      erros,
      `${prefixo}.${b.chave}.quantidade`,
      b.quantidade,
      {
        minimo: 1,
        maximo: 20,
        rotulo: "Quantidade",
      },
    );
  }
  return erros;
}

/* ── Rascunho do roteiro ───────────────────────────────────────────── */

export function novaCompetencia() {
  return {
    chave: novaChave(),
    nome: "",
    descricao: "",
    nota_maxima: "5",
    peso: "1",
    minimo: "",
    tipo_minimo: "VALOR",
    avaliacao: "INDIVIDUAL",
  };
}

export const novoNivel = (nota = "") => ({
  chave: novaChave(),
  nota: textoDoNumero(nota),
  nome: "",
  descricao: "",
});

/**
 * O rascunho do formulário: vazio (`roteiro` nulo), a edição de um roteiro
 * (`modo` "editar": grava a versão seguinte) ou a cópia ("duplicar": um
 * roteiro novo, versão 1).
 */
export function rascunhoDoRoteiro(
  roteiro = null,
  { modo = "editar", area = "" } = {},
) {
  if (!roteiro) {
    return {
      origem: null,
      versao: null,
      nome: "",
      descricao: "",
      etapa: "Entrevista",
      area: area || "",
      escala: "FAIXA",
      passo: "0.5",
      notas_permitidas: "",
      niveis: [],
      competencias: [novaCompetencia()],
      nota_minima_total: "",
      notas_eliminatorias: [],
      ausencia_elimina: true,
      desempate: [],
      soma_analise: true,
      convocacao: convocacaoParaRascunho({
        multiplo_imediatas: 5,
        posicao_cadastro_reserva: 10,
      }),
      banca: [],
    };
  }
  const duplicar = modo === "duplicar";
  return {
    origem: duplicar ? null : roteiro.origem || roteiro.id || null,
    versao: duplicar ? null : Number(roteiro.versao) || 1,
    nome: duplicar ? `${texto(roteiro.nome)} (cópia)` : texto(roteiro.nome),
    descricao: texto(roteiro.descricao),
    etapa: texto(roteiro.etapa) || "Entrevista",
    area: roteiro.area || "",
    escala: roteiro.escala || "FAIXA",
    passo: textoDoNumero(roteiro.passo ?? 0.5),
    notas_permitidas: (roteiro.notas_permitidas || [])
      .map((n) => textoDoNumero(n))
      .join("; "),
    niveis: (roteiro.niveis || []).map((n) => ({
      chave: novaChave(),
      nota: textoDoNumero(n.nota),
      nome: texto(n.nome),
      descricao: texto(n.descricao),
    })),
    competencias: (roteiro.competencias || [])
      .slice()
      .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
      .map((c) => ({
        chave: novaChave(),
        nome: texto(c.nome),
        descricao: texto(c.descricao),
        nota_maxima: textoDoNumero(c.nota_maxima),
        peso: textoDoNumero(c.peso ?? 1),
        minimo: textoDoNumero(c.minimo),
        tipo_minimo: c.tipo_minimo === "PERCENTUAL" ? "PERCENTUAL" : "VALOR",
        avaliacao: c.avaliacao === "GRUPO" ? "GRUPO" : "INDIVIDUAL",
      })),
    nota_minima_total: textoDoNumero(roteiro.nota_minima_total),
    notas_eliminatorias: (roteiro.notas_eliminatorias || [])
      .map(lerNumero)
      .filter(Number.isFinite),
    ausencia_elimina: roteiro.ausencia_elimina !== false,
    desempate: (roteiro.desempate || []).map(texto).filter(Boolean),
    soma_analise: roteiro.soma_analise !== false,
    convocacao: convocacaoParaRascunho(roteiro.convocacao_padrao),
    banca: bancaParaRascunho(roteiro.banca_padrao),
  };
}

/** "0; 1; 2,5" → [0, 1, 2.5] (o que não é número fica de fora). */
export function lerListaDeNotas(valor) {
  return texto(valor)
    .split(/[;\s]+/)
    .map(lerNumero)
    .filter((n) => Number.isFinite(n));
}

/** Troca o item `indice` de lugar com o vizinho (`passo` -1 ou +1). */
export function moverItem(lista, indice, passo) {
  const destino = indice + passo;
  if (destino < 0 || destino >= lista.length) return lista;
  const nova = lista.slice();
  [nova[indice], nova[destino]] = [nova[destino], nova[indice]];
  return nova;
}

/**
 * Erros do rascunho, por campo: `{ nome: "…", "competencia.k3.nome": "…" }`.
 * Os limites são os das constraints das tabelas do roteiro.
 */
export function errosDoRoteiro(r) {
  const erros = {};
  const nome = texto(r?.nome);
  if (nome.length < 3 || nome.length > 150)
    erros.nome = "Nome do roteiro: de 3 a 150 caracteres.";
  const etapa = texto(r?.etapa);
  if (etapa && (etapa.length < 3 || etapa.length > 80))
    erros.etapa = "Etapa: de 3 a 80 caracteres.";
  if (texto(r?.descricao).length > 2000)
    erros.descricao = "Descrição: até 2000 caracteres.";

  if (r?.escala === "FAIXA") {
    const passo = lerNumero(r.passo);
    if (passo === null || Number.isNaN(passo) || passo <= 0 || passo > 5)
      erros.passo = "Passo das notas: maior que 0 e até 5 (ex.: 0,5).";
  } else if (r?.escala === "LISTA") {
    if (!lerListaDeNotas(r.notas_permitidas).length)
      erros.notas_permitidas = "Informe as notas permitidas (ex.: 0; 1; 2).";
  } else if (r?.escala === "NIVEIS") {
    if (!(r.niveis || []).length)
      erros.niveis = "Escala por níveis precisa de ao menos um nível.";
    const notas = new Set();
    for (const n of r.niveis || []) {
      const nota = lerNumero(n.nota);
      if (nota === null || Number.isNaN(nota) || nota < 0)
        erros[`nivel.${n.chave}.nota`] = "Nota do nível: número a partir de 0.";
      else if (notas.has(nota))
        erros[`nivel.${n.chave}.nota`] = "Dois níveis com a mesma nota.";
      else notas.add(nota);
      const nomeDoNivel = texto(n.nome);
      if (nomeDoNivel.length < 2 || nomeDoNivel.length > 80)
        erros[`nivel.${n.chave}.nome`] = "Nome do nível: de 2 a 80 caracteres.";
      if (texto(n.descricao).length > 1000)
        erros[`nivel.${n.chave}.descricao`] = "Descrição: até 1000 caracteres.";
    }
  } else {
    erros.escala = "Escolha a escala das notas.";
  }

  const competencias = r?.competencias || [];
  if (!competencias.length || competencias.length > LIMITE_DE_COMPETENCIAS)
    erros.competencias = `Informe de 1 a ${LIMITE_DE_COMPETENCIAS} competências.`;
  for (const c of competencias) {
    const p = `competencia.${c.chave}`;
    const nomeDaCompetencia = texto(c.nome);
    if (nomeDaCompetencia.length < 2 || nomeDaCompetencia.length > 200)
      erros[`${p}.nome`] = "Nome da competência: de 2 a 200 caracteres.";
    if (texto(c.descricao).length > 3000)
      erros[`${p}.descricao`] = "Descrição: até 3000 caracteres.";
    const maxima = lerNumero(c.nota_maxima);
    if (maxima === null || Number.isNaN(maxima) || maxima <= 0 || maxima > 100)
      erros[`${p}.nota_maxima`] = "Nota máxima: maior que 0 e até 100.";
    const peso = lerNumero(c.peso);
    if (peso !== null && (Number.isNaN(peso) || peso <= 0 || peso > 10))
      erros[`${p}.peso`] = "Peso: maior que 0 e até 10.";
    const minimo = lerNumero(c.minimo);
    if (minimo !== null) {
      if (Number.isNaN(minimo) || minimo < 0)
        erros[`${p}.minimo`] = "Mínimo: número a partir de 0.";
      else if (c.tipo_minimo === "PERCENTUAL" && minimo > 100)
        erros[`${p}.minimo`] = "Mínimo em %: até 100.";
      else if (c.tipo_minimo !== "PERCENTUAL") {
        const maximo = maximoDaCompetencia(c);
        if (maximo !== null && minimo > maximo)
          erros[`${p}.minimo`] =
            "Mínimo maior que a nota máxima da competência × peso.";
      }
    }
  }

  const minimoTotal = lerNumero(r?.nota_minima_total);
  if (minimoTotal !== null) {
    if (Number.isNaN(minimoTotal) || minimoTotal < 0)
      erros.nota_minima_total = "Nota mínima total: número a partir de 0.";
    else if (minimoTotal > pontuacaoMaxima(competencias))
      erros.nota_minima_total =
        "Nota mínima total maior que a pontuação máxima do roteiro.";
  }
  (r?.desempate || []).forEach((criterio, indice) => {
    if (!texto(criterio))
      erros[`desempate.${indice}`] = "Critério de desempate vazio.";
  });
  Object.assign(
    erros,
    errosDaConvocacao(r?.convocacao),
    errosDaBanca(r?.banca),
  );
  return erros;
}

/** O `p_dados` de `salvar_roteiro_entrevista`. */
export function dadosDoRoteiroParaSalvar(r) {
  const dados = {
    nome: texto(r.nome),
    descricao: texto(r.descricao) || null,
    etapa: texto(r.etapa) || "Entrevista",
    area: r.area || null,
    escala: r.escala,
    passo: r.escala === "FAIXA" ? lerNumero(r.passo) : 0.5,
    notas_permitidas:
      r.escala === "LISTA" ? lerListaDeNotas(r.notas_permitidas) : [],
    niveis:
      r.escala === "NIVEIS"
        ? (r.niveis || [])
            .map((n) => ({
              nota: lerNumero(n.nota),
              nome: texto(n.nome),
              descricao: texto(n.descricao) || null,
            }))
            .sort((a, b) => a.nota - b.nota)
        : [],
    competencias: (r.competencias || []).map((c) => ({
      nome: texto(c.nome),
      descricao: texto(c.descricao) || null,
      nota_maxima: lerNumero(c.nota_maxima),
      peso: lerNumero(c.peso) ?? 1,
      minimo: lerNumero(c.minimo),
      tipo_minimo: c.tipo_minimo === "PERCENTUAL" ? "PERCENTUAL" : "VALOR",
      avaliacao: c.avaliacao === "GRUPO" ? "GRUPO" : "INDIVIDUAL",
    })),
    nota_minima_total: lerNumero(r.nota_minima_total),
    notas_eliminatorias: [...new Set(r.notas_eliminatorias || [])].sort(
      (a, b) => a - b,
    ),
    ausencia_elimina: r.ausencia_elimina !== false,
    desempate: (r.desempate || []).map(texto).filter(Boolean),
    soma_analise: r.soma_analise !== false,
    convocacao_padrao: convocacaoDoRascunho(r.convocacao),
    banca_padrao: bancaDoRascunho(r.banca),
  };
  if (r.origem) dados.origem = r.origem;
  return dados;
}

/** Linha de resumo do roteiro na lista: competências, escala e pontuação. */
export function resumoDoRoteiro(roteiro) {
  const competencias = roteiro?.competencias || [];
  return {
    competencias: competencias.length,
    escala: rotuloDaEscala(roteiro?.escala),
    maxima: pontuacaoMaxima(competencias),
    minimo: lerNumero(roteiro?.nota_minima_total),
    emUso: Number(roteiro?.editais_em_uso) || 0,
    versao: Number(roteiro?.versao) || 1,
    grupo: competencias.some((c) => c.avaliacao === "GRUPO"),
  };
}
