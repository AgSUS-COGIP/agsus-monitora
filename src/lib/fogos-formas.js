/*
  O marco desenhado no céu, sem DOM: os pontos para onde as faíscas do
  estouro final convergem. Coração (edital 100% analisado), estrela (fila
  zerada, trilha concluída), visto (acesso liberado) e texto curto, como o
  número do marco ("1.000", "2.500").

  Formas geométricas saem de curvas (contorno amostrado por comprimento). O
  texto sai de uma imagem: src/modules/comemoracao.js escreve o texto num
  canvas fora da tela (fillText) e passa os pixels para `pontosDaImagem`. Sem
  canvas (testes, navegador sem 2D), uma fonte de pontos 5×7 própria.

  Saída: pontos em px CSS da tela, centrados no alto (onde os fogos estouram).
*/

const limitar = (valor, min, max) => Math.min(max, Math.max(min, valor));

export const FORMAS = Object.freeze(["coracao", "estrela", "check"]);

/**
 * A forma pedida, normalizada: "coracao" | "estrela" | "check" viram
 * `{ tipo }`; `{ tipo: "texto" | "numero", texto }` fica com o texto (até 8
 * caracteres). Qualquer outra coisa: `null` (sem forma, um estouro comum).
 */
export function normalizarForma(forma) {
  if (typeof forma === "string")
    return FORMAS.includes(forma) ? { tipo: forma } : null;
  if (!forma || typeof forma !== "object") return null;
  if (FORMAS.includes(forma.tipo)) return { tipo: forma.tipo };
  if (forma.tipo === "texto" || forma.tipo === "numero") {
    const texto = String(forma.texto ?? "")
      .trim()
      .slice(0, 8);
    return texto ? { tipo: "texto", texto } : null;
  }
  return null;
}

// ── Contornos (unidade: caixa de -1 a 1, y para baixo) ──────────────────────

/* Pontos igualmente espaçados ao longo de uma polilinha (fechada ou não). */
function amostrarPolilinha(vertices, quantidade, fechada) {
  const lados = [];
  const total = fechada ? vertices.length : vertices.length - 1;
  let comprimento = 0;
  for (let i = 0; i < total; i += 1) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    const tamanho = Math.hypot(b[0] - a[0], b[1] - a[1]);
    lados.push({ a, b, tamanho, inicio: comprimento });
    comprimento += tamanho;
  }
  const pontos = [];
  const passos = fechada ? quantidade : Math.max(1, quantidade - 1);
  for (let i = 0; i < quantidade; i += 1) {
    const s = (comprimento * i) / passos;
    const lado =
      lados.find((l) => s <= l.inicio + l.tamanho + 1e-9) || lados.at(-1);
    const u = lado.tamanho ? (s - lado.inicio) / lado.tamanho : 0;
    pontos.push({
      x: lado.a[0] + (lado.b[0] - lado.a[0]) * u,
      y: lado.a[1] + (lado.b[1] - lado.a[1]) * u,
    });
  }
  return pontos;
}

/** O coração clássico (curva paramétrica), com `quantidade` pontos no contorno. */
export function contornoDoCoracao(quantidade = 160) {
  const vertices = [];
  for (let i = 0; i < 400; i += 1) {
    const t = (i / 400) * Math.PI * 2;
    vertices.push([
      (16 * Math.sin(t) ** 3) / 17,
      -(
        13 * Math.cos(t) -
        5 * Math.cos(2 * t) -
        2 * Math.cos(3 * t) -
        Math.cos(4 * t)
      ) / 17,
    ]);
  }
  return amostrarPolilinha(vertices, quantidade, true);
}

/** Estrela de cinco pontas (uma para cima), pontos no contorno. */
export function contornoDaEstrela(quantidade = 160, interno = 0.45) {
  const vertices = Array.from({ length: 10 }, (_, i) => {
    const raio = i % 2 ? interno : 1;
    const angulo = -Math.PI / 2 + (i * Math.PI) / 5;
    return [raio * Math.cos(angulo), raio * Math.sin(angulo)];
  });
  return amostrarPolilinha(vertices, quantidade, true);
}

/** O visto (✓): o traço em três linhas paralelas, para ficar grosso. */
export function tracoDoCheck(quantidade = 150) {
  const eixo = [
    [-0.85, 0.05],
    [-0.3, 0.6],
    [0.85, -0.6],
  ];
  const porLinha = Math.max(2, Math.round(quantidade / 3));
  return [-0.05, 0, 0.05].flatMap((d) =>
    amostrarPolilinha(
      eixo.map(([x, y]) => [x + d * 0.7, y + d]),
      porLinha,
      false,
    ),
  );
}

// ── Texto ───────────────────────────────────────────────────────────────────

/**
 * Pontos de uma imagem (pixels RGBA de getImageData): um a cada `passo` px
 * onde a opacidade passa de `limiar`. Em px da imagem.
 */
export function pontosDaImagem(imagem, { passo = 4, limiar = 128 } = {}) {
  const { data, width, height } = imagem || {};
  if (!data || !width || !height) return [];
  const pontos = [];
  for (let y = Math.floor(passo / 2); y < height; y += passo)
    for (let x = Math.floor(passo / 2); x < width; x += passo)
      if (data[(y * width + x) * 4 + 3] > limiar) pontos.push({ x, y });
  return pontos;
}

/* Fonte de pontos 5×7 (a reserva sem canvas): só o que um marco precisa. */
export const FONTE_DE_PONTOS = Object.freeze({
  0: ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  1: ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  2: ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  3: ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  4: ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  5: ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  6: ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  7: ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  8: ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  9: ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  ".": ["00", "00", "00", "00", "00", "11", "11"],
  ",": ["00", "00", "00", "00", "11", "01", "10"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
});

/**
 * O texto na fonte de pontos: 2×2 pontos por célula acesa (fica denso o
 * bastante para ler). Caractere fora da fonte vira espaço. Em unidades da
 * grade (uma célula = 1).
 */
export function pontosDoTextoNaFonte(texto) {
  const pontos = [];
  let coluna = 0;
  for (const caractere of String(texto ?? "")) {
    const desenho = FONTE_DE_PONTOS[caractere];
    if (!desenho) {
      coluna += 3;
      continue;
    }
    desenho.forEach((linha, y) => {
      [...linha].forEach((acesa, x) => {
        if (acesa !== "1") return;
        for (const [dx, dy] of [
          [0.25, 0.25],
          [0.75, 0.25],
          [0.25, 0.75],
          [0.75, 0.75],
        ])
          pontos.push({ x: coluna + x + dx, y: y + dy });
      });
    });
    coluna += desenho[0].length + 1;
  }
  return pontos;
}

// ── Ajuste à tela ───────────────────────────────────────────────────────────

/** No máximo `maximo` pontos, escolhidos igualmente espaçados (sem sorteio). */
export function reduzirPontos(pontos, maximo) {
  const lista = Array.isArray(pontos) ? pontos : [];
  if (lista.length <= maximo) return lista;
  return Array.from(
    { length: Math.max(0, maximo) },
    (_, i) => lista[Math.floor((i * lista.length) / maximo)],
  );
}

/** Escala sem distorcer para caber na caixa e centra em (cx, cy). */
export function ajustarPontos(pontos, { cx, cy, larguraMax, alturaMax }) {
  if (!pontos.length) return [];
  const xs = pontos.map((p) => p.x);
  const ys = pontos.map((p) => p.y);
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  const [y0, y1] = [Math.min(...ys), Math.max(...ys)];
  const escala = Math.min(
    larguraMax / Math.max(x1 - x0, 1e-6),
    alturaMax / Math.max(y1 - y0, 1e-6),
  );
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2;
  return pontos.map((p) => ({
    x: cx + (p.x - mx) * escala,
    y: cy + (p.y - my) * escala,
  }));
}

/*
  A caixa do marco na tela: centrada, um pouco acima do meio (abaixo do aviso
  do topo), sem passar das bordas.
*/
export function caixaDaForma({ largura = 800, altura = 600 } = {}) {
  return {
    cx: largura / 2,
    cy: altura * 0.4,
    larguraMax: Math.min(largura * 0.7, 560),
    alturaMax: Math.min(altura * 0.28, 230),
  };
}

/**
 * Os pontos-alvo do marco na tela (px CSS), até `quantidade`. `amostrarTexto`
 * (opcional) recebe o texto e devolve a imagem dele (getImageData) ou null;
 * sem ela, a fonte de pontos. Forma desconhecida: lista vazia.
 */
export function pontosDaForma(
  forma,
  { largura = 800, altura = 600, quantidade = 220, amostrarTexto = null } = {},
) {
  const pedida = normalizarForma(forma);
  if (!pedida) return [];
  const caixa = caixaDaForma({ largura, altura });
  const lado = Math.min(caixa.larguraMax, caixa.alturaMax);
  const quadrada = { ...caixa, larguraMax: lado, alturaMax: lado };
  // Contorno com faíscas a ~6 px umas das outras: brilha em pontos, não vira
  // uma linha contínua.
  const noContorno = Math.max(40, Math.min(quantidade, Math.round(lado * 0.6)));
  if (pedida.tipo === "coracao")
    return ajustarPontos(contornoDoCoracao(noContorno), quadrada);
  if (pedida.tipo === "estrela")
    return ajustarPontos(contornoDaEstrela(noContorno), quadrada);
  if (pedida.tipo === "check")
    return ajustarPontos(tracoDoCheck(Math.round(noContorno * 1.4)), {
      ...quadrada,
      larguraMax: lado * 1.2,
    });
  let imagem = null;
  try {
    imagem = amostrarTexto?.(pedida.texto) || null;
  } catch {
    imagem = null;
  }
  return ajustarPontos(
    reduzirPontos(
      imagem
        ? pontosDaImagem(imagem, { passo: passoParaCaber(imagem, quantidade) })
        : pontosDoTextoNaFonte(pedida.texto),
      quantidade,
    ),
    caixa,
  );
}

/*
  O passo da grade para a imagem dar até `quantidade` pontos: uma grade
  regular lê melhor (como um letreiro de LED) do que cortar pontos de uma
  grade fina, que deixa falhas em padrão.
*/
export function passoParaCaber(imagem, quantidade) {
  const finos = pontosDaImagem(imagem, { passo: 2 }).length;
  if (!finos || quantidade <= 0) return 2;
  return limitar(Math.ceil(2 * Math.sqrt(finos / quantidade)), 2, 16);
}
