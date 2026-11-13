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
import { needsLightForeground } from "./access-branding.ts";

/** As cores que a tela realmente usa, definidas na seção Login de platform-shell.css. */
export const TEXTO_CLARO = "#ffffff";
export const TEXTO_ESCURO = "#102a43";

/** WCAG 2.1 AA para texto normal. */
export const MINIMO_AA = 4.5;

const HEX = /^#[0-9a-f]{6}$/i;

function canais(cor: string): number[] {
  return [1, 3, 5].map((i) => parseInt(cor.slice(i, i + 2), 16));
}

function canalLinear(valor: number): number {
  const v = valor / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

export function luminanciaRelativa(cor: string): number {
  const [r, g, b] = canais(cor).map(canalLinear) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function razaoDeContraste(uma: string, outra: string): number {
  const [maior, menor] = [
    luminanciaRelativa(uma),
    luminanciaRelativa(outra),
  ].sort((a, b) => b - a) as [number, number];
  return (maior + 0.05) / (menor + 0.05);
}

/*
  Num tom médio nenhum dos dois primeiros planos alcança 4.5:1 — é o meio da
  escala que atrapalha, não a direção. Escurecer faz o texto claro passar;
  clarear faz o escuro passar. Por isso a frase não manda escurecer: manda sair
  do meio.
*/
/*
  Modos do texto sobre o painel.

  `auto` deriva da luminância, que é o comportamento histórico e o padrão. Os
  outros dois existem porque a decisão é de identidade visual, não só de
  contraste: uma instituição pode querer a marca clara sobre um lilás claro
  mesmo sabendo que aquilo reprova. O papel do sistema aí é **avisar**, com o
  número na tela, e não decidir sozinho.
*/
export const MODO_AUTO = "auto";
export const MODO_CLARO = "claro";
export const MODO_ESCURO = "escuro";
export type ModoDoTexto =
  typeof MODO_AUTO | typeof MODO_CLARO | typeof MODO_ESCURO;
const MODOS: ReadonlySet<string> = new Set([
  MODO_AUTO,
  MODO_CLARO,
  MODO_ESCURO,
]);

export function normalizarModo(valor: unknown): ModoDoTexto {
  const bruto = String(valor ?? "")
    .trim()
    .toLowerCase();
  return MODOS.has(bruto) ? (bruto as ModoDoTexto) : MODO_AUTO;
}

/** O primeiro plano que a tela vai usar, já considerando o modo escolhido. */
export function corDoTextoPara(cor: string, modo: unknown = MODO_AUTO): string {
  const escolhido = normalizarModo(modo);
  if (escolhido === MODO_CLARO) return TEXTO_CLARO;
  if (escolhido === MODO_ESCURO) return TEXTO_ESCURO;
  return needsLightForeground(cor) ? TEXTO_CLARO : TEXTO_ESCURO;
}

/*
  O estilo do painel da tela de acesso (Configurações › Tela de acesso):
  sólido (o padrão) ou vidro. No vidro o painel não tem cor (13/11/2026,
  "totalmente transparente"): o texto fica direto sobre a arte desfocada, só
  com o brilho branco do vidro (até BRILHO_DO_VIDRO, no alto do cartão), a
  borda clara e o realce de luz. A arte é configurável e o sistema não a mede:
  no vidro, a leitura depende de a arte atrás do painel combinar com o texto
  (escura para o texto claro, clara para o escuro). A cor do painel continua
  escolhendo o texto no modo automático e é o painel de quem não vê o vidro
  (menos transparência pedida ao sistema, ou navegador sem desfoque).
*/
export const ESTILO_SOLIDO = "solido";
export const ESTILO_VIDRO = "vidro";
export type EstiloDoPainel = typeof ESTILO_SOLIDO | typeof ESTILO_VIDRO;
export const BRILHO_DO_VIDRO = 0.08;

export function normalizarEstilo(valor: unknown): EstiloDoPainel {
  const bruto = String(valor ?? "")
    .trim()
    .toLowerCase();
  return bruto === ESTILO_VIDRO ? ESTILO_VIDRO : ESTILO_SOLIDO;
}

export interface AvaliacaoDaCor {
  cor: string;
  corDoTexto: string;
  razao: number;
  /** O contraste está garantido: a cor passa e o painel é sólido. */
  passa: boolean;
  mensagem: string;
}

export function avaliarCor(
  cor: unknown,
  modo: unknown = MODO_AUTO,
  estilo: unknown = ESTILO_SOLIDO,
): AvaliacaoDaCor | null {
  if (typeof cor !== "string" || !HEX.test(cor.trim())) return null;

  const normalizada = cor.trim().toLowerCase();
  const corDoTexto = corDoTextoPara(normalizada, modo);
  const exata = razaoDeContraste(corDoTexto, normalizada);
  /*
    Duas casas, cortadas e não arredondadas: arredondar mostrava "4,50 — abaixo
    do mínimo de 4,5" para uma cor que mede 4,497 (o azul #3879ab).
  */
  const razao = Math.floor(exata * 100) / 100;
  const cumpre = exata >= MINIMO_AA;
  const medida = `Contraste do texto sobre esta cor: ${numero(razao, 2)}.`;

  if (normalizarEstilo(estilo) === ESTILO_VIDRO) {
    const claro = corDoTexto === TEXTO_CLARO;
    return {
      cor: normalizada,
      corDoTexto,
      razao,
      passa: false,
      mensagem: `No vidro o painel fica sem cor e o texto ${claro ? "claro" : "escuro"} vai direto sobre a arte: ela precisa ser ${claro ? "escura" : "clara"} atrás do painel. O sistema não mede a arte; só o painel sólido garante o contraste.`,
    };
  }

  return {
    cor: normalizada,
    corDoTexto,
    razao,
    passa: cumpre,
    mensagem: cumpre
      ? `${medida} Acima do mínimo de ${numero(MINIMO_AA, 1)} da WCAG AA.`
      : `${medida} Abaixo do mínimo de ${numero(MINIMO_AA, 1)} da WCAG AA — quem tem baixa visão pode não conseguir ler. Uma cor mais escura ou mais clara resolve sem mudar o tom.`,
  };
}

/** Número no formato brasileiro, com as casas fixas (4,49; 4,5). */
function numero(valor: number, casas: number): string {
  return valor.toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}
