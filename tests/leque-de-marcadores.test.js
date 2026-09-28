import { describe, expect, it } from "vitest";
import {
  RAIO_DO_LEQUE,
  agruparNaTela,
  anguloNoLeque,
  calcularLeque,
} from "../src/lib/leque-de-marcadores.js";

const destino = (p, o) => ({ x: p.x + o.dx, y: p.y + o.dy });

describe("leque de marcadores", () => {
  it("um marcador sozinho não é deslocado", () => {
    expect(calcularLeque([{ x: 50, y: 80 }])).toEqual([
      { dx: 0, dy: 0, emLeque: false },
    ]);
  });

  it("dois no mesmo ponto: no raio, opostos, o primeiro em cima", () => {
    const p = { x: 100, y: 100 };
    const leque = calcularLeque([p, { ...p }]);
    expect(leque.every((o) => o.emLeque)).toBe(true);
    leque.forEach((o) =>
      expect(Math.hypot(o.dx, o.dy)).toBeCloseTo(RAIO_DO_LEQUE, 6),
    );
    expect(leque[0].dx).toBeCloseTo(0, 6);
    expect(leque[0].dy).toBeCloseTo(-RAIO_DO_LEQUE, 6);
    expect(leque[1].dy).toBeCloseTo(RAIO_DO_LEQUE, 6);
  });

  it("três no mesmo ponto: ângulos distintos a 120°, o primeiro em cima", () => {
    const p = { x: 10, y: 10 };
    const leque = calcularLeque([p, p, p], { raio: 18 });
    const angulos = leque.map((o) => Math.atan2(o.dy, o.dx));
    leque.forEach((o) => expect(Math.hypot(o.dx, o.dy)).toBeCloseTo(18, 6));
    expect(angulos[0]).toBeCloseTo(-Math.PI / 2, 6);
    expect(new Set(angulos.map((a) => a.toFixed(4))).size).toBe(3);
    const [a, b, c] = leque.map((o) => destino(p, o));
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeCloseTo(18 * Math.sqrt(3), 6);
    expect(Math.hypot(b.x - c.x, b.y - c.y)).toBeCloseTo(18 * Math.sqrt(3), 6);
  });

  it("pontos quase coincidentes giram em volta da média do grupo", () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
    ];
    const [a, b] = calcularLeque(pts).map((o, i) => destino(pts[i], o));
    expect(a.x).toBeCloseTo(1, 6);
    expect(a.y).toBeCloseTo(-RAIO_DO_LEQUE, 6);
    expect(b.y).toBeCloseTo(RAIO_DO_LEQUE, 6);
  });

  it("marcadores já afastados mais do que o diâmetro não são deslocados", () => {
    const leque = calcularLeque([
      { x: 0, y: 0 },
      { x: 2 * RAIO_DO_LEQUE + 1, y: 0 },
      { x: 0, y: 200 },
    ]);
    expect(leque.every((o) => !o.emLeque && o.dx === 0 && o.dy === 0)).toBe(
      true,
    );
  });

  it("agrupa por transitividade e mantém a ordem da entrada", () => {
    const grupos = agruparNaTela(
      [
        { x: 0, y: 0 },
        { x: 500, y: 500 },
        { x: 20, y: 0 },
        { x: 40, y: 0 },
      ],
      25,
    );
    expect(grupos).toEqual([[0, 2, 3], [1]]);
  });

  it("a mesma entrada dá sempre o mesmo resultado", () => {
    const entrada = [
      { x: 3, y: 4 },
      { x: 3, y: 4 },
      { x: 90, y: 4 },
      { x: 5, y: 6 },
    ];
    expect(calcularLeque(entrada)).toEqual(calcularLeque(entrada));
    expect(calcularLeque(entrada.map((p) => ({ ...p })))).toEqual(
      calcularLeque(entrada),
    );
  });

  it("ignora pontos sem coordenada de tela", () => {
    const leque = calcularLeque([{ x: 1, y: 1 }, { x: NaN, y: 1 }, null]);
    expect(leque.every((o) => !o.emLeque)).toBe(true);
    expect(anguloNoLeque(0, 4)).toBeCloseTo(-Math.PI / 2, 9);
  });
});
