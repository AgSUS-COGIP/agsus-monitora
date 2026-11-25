import { classes } from "./classes.ts";

/*
  O símbolo do Yeendé (marca de 25/11/2026), "pássaro" em Kariri: de frente,
  asas abertas em V, asa esquerda amarela, asa direita verde, cabeça vermelha
  redonda com a pontinha para baixo e o corpo em cápsula entre as asas.

  As formas são as de icons/yeende.svg (a fonte do favicon e dos ícones do PWA;
  um teste confere que são as mesmas). As cores vêm dos tokens do manual da
  AgSUS (`--marca-agsus-*`, platform-shell.css); o corpo é `currentColor`: escuro
  sobre fundo claro e claro sobre fundo escuro, como o nome ao lado.

  Decorativo (`aria-hidden`): quem nomeia o sistema é o texto "Yeendé" que
  sempre o acompanha.
*/

/** As formas do símbolo, num quadro de 100 × 100 (o desenho ocupa y 16 a 84). */
export const FORMAS_DO_SIMBOLO = Object.freeze({
  asaEsquerda:
    "M17.8 22C9.4 27.6 2 36.4 1.9 47C1.8 58.1 10.6 65.9 22.8 70.1C28.3 72 33.9 73.7 36.4 76.2C37.1 76.9 37.9 76.6 37.7 75.3C36.2 65.9 37.3 57 41.3 49.8C42.2 48.1 41.8 46.6 40.1 45C32.2 38.7 22.8 32.6 19.6 23.7C19.1 22.3 18.3 21.4 17.8 22Z",
  asaDireita:
    "M82.2 22C90.6 27.6 98 36.4 98.1 47C98.2 58.1 89.4 65.9 77.2 70.1C71.7 72 66.1 73.7 63.6 76.2C62.9 76.9 62.1 76.6 62.3 75.3C63.8 65.9 62.7 57 58.7 49.8C57.8 48.1 58.2 46.6 59.9 45C67.8 38.7 77.2 32.6 80.4 23.7C80.9 22.3 81.7 21.4 82.2 22Z",
  cabeca:
    "M44 39.1A11.4 11.4 0 1 1 56.2 39.1C53.6 41.4 51.1 43.2 50.4 45.2C50.2 45.9 49.8 45.9 49.6 45.2C48.9 43.2 46.4 41.4 44 39.1Z",
  corpo: { x: 42.4, y: 48.1, largura: 15.1, altura: 33.6, raio: 7.6 },
});

/** O recorte justo do desenho: 100 de largura por 68 de altura. */
export const QUADRO_DO_SIMBOLO = "0 16 100 68";

export function SimboloDoYeende({
  className,
  altura = 32,
  id,
}: {
  className?: string;
  /** Altura em px (a largura segue a proporção do desenho, 100:68). */
  altura?: number;
  id?: string;
}) {
  const { corpo } = FORMAS_DO_SIMBOLO;
  return (
    <svg
      id={id}
      className={classes("marca-yeende", className)}
      viewBox={QUADRO_DO_SIMBOLO}
      width={Math.round((altura * 100) / 68)}
      height={altura}
      aria-hidden="true"
      focusable="false"
    >
      <path
        className="marca-yeende__asa-esquerda"
        d={FORMAS_DO_SIMBOLO.asaEsquerda}
      />
      <path
        className="marca-yeende__asa-direita"
        d={FORMAS_DO_SIMBOLO.asaDireita}
      />
      <path className="marca-yeende__cabeca" d={FORMAS_DO_SIMBOLO.cabeca} />
      <rect
        className="marca-yeende__corpo"
        x={corpo.x}
        y={corpo.y}
        width={corpo.largura}
        height={corpo.altura}
        rx={corpo.raio}
      />
    </svg>
  );
}
