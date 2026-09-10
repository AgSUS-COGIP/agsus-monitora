/*
  Contraste do texto sobre uma cor escolhida em Configurações.

  Serve para responder, na hora da escolha, a pergunta que hoje só aparece
  depois de salvar: "com esta cor, dá para ler?".

  Uma diferença deliberada em relação ao SIGAV, que mostra o mesmo aviso: lá o
  cálculo é sempre contra texto branco, e por isso um painel lilás claro acusa
  2.30 mesmo quando a tela é desenhada com texto escuro. Aqui o primeiro plano é
  **derivado** da cor, por `needsLightForeground()`, então o número medido é o do
  texto que a pessoa vai ver de fato.

  Isso não torna o aviso decorativo. Varrendo o espaço de cor, o pior caso com o
  primeiro plano derivado é 1.52:1, e tons médios reprovam com folga — `#8a7fb0`
  dá 3.52:1. O que o limiar de luminância garante é a *melhor das duas opções*,
  não que ela baste.
*/
import { needsLightForeground } from "./access-branding.js";

/** As cores que a tela realmente usa, definidas em post-152-regression-fixes.css. */
export const TEXTO_CLARO = "#f7fbff";
export const TEXTO_ESCURO = "#102a43";

/** WCAG 2.1 AA para texto normal. */
export const MINIMO_AA = 4.5;

const HEX = /^#[0-9a-f]{6}$/i;

function canais(cor) {
  return [1, 3, 5].map((i) => parseInt(cor.slice(i, i + 2), 16));
}

function canalLinear(valor) {
  const v = valor / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

export function luminanciaRelativa(cor) {
  const [r, g, b] = canais(cor).map(canalLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function razaoDeContraste(uma, outra) {
  const [maior, menor] = [
    luminanciaRelativa(uma),
    luminanciaRelativa(outra),
  ].sort((a, b) => b - a);
  return (maior + 0.05) / (menor + 0.05);
}

/*
  Num tom médio nenhum dos dois primeiros planos alcança 4.5:1 — é o meio da
  escala que atrapalha, não a direção. Escurecer faz o texto claro passar;
  clarear faz o escuro passar. Por isso a frase não manda escurecer: manda sair
  do meio.
*/
export function avaliarCor(cor) {
  if (typeof cor !== "string" || !HEX.test(cor.trim())) return null;

  const normalizada = cor.trim().toLowerCase();
  const corDoTexto = needsLightForeground(normalizada)
    ? TEXTO_CLARO
    : TEXTO_ESCURO;
  const razao = razaoDeContraste(corDoTexto, normalizada);
  const passa = razao >= MINIMO_AA;

  return {
    cor: normalizada,
    corDoTexto,
    razao: Math.round(razao * 100) / 100,
    passa,
    mensagem: passa
      ? `Contraste do texto sobre esta cor: ${razao.toFixed(2)}. Acima do mínimo de ${MINIMO_AA} da WCAG AA.`
      : `Contraste do texto sobre esta cor: ${razao.toFixed(2)}. Abaixo do mínimo de ${MINIMO_AA} da WCAG AA — quem tem baixa visão pode não conseguir ler. Uma cor mais escura ou mais clara resolve sem mudar o tom.`,
  };
}
