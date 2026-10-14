import { CRITERIO_POR_CODIGO } from "../../src/lib/classificacao/catalogo.ts";
import {
  numeroBR,
  arredondar,
  escalar,
  segundosDeVida,
} from "../../src/lib/classificacao/numeros.ts";
import {
  ordemDoSorteio,
  conferirSorteio,
} from "../../src/lib/classificacao/sorteio.ts";
export function conferirCalculos() {
  const nota: number | null = numeroBR("12,5");
  const arredondada: number | null = arredondar(nota, 2);
  const escala: number | null = escalar(arredondada, 2);
  const idade: number | null = segundosDeVida(
    "1960-01-01",
    "08:05",
    "2026-10-14",
  );
  const ordem: string[] = ordemDoSorteio("semente", ["a1", "a2"]);
  return { escala, idade, confere: conferirSorteio("semente", ordem) };
}
export function rejeitarCriterioInvalido() {
  const criterio = CRITERIO_POR_CODIGO.NOTA_DOCUMENTAL;
  if (!criterio) return;
  // @ts-expect-error O catálogo recebe a nota já normalizada como número.
  criterio.ler({ notaDocumental: "12,5" }, {});
  // @ts-expect-error Data de corte é textual, nunca numérica.
  criterio.ler({}, { dataCorte: 20261014 });
}
