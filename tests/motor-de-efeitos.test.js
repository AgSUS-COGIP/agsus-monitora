import { describe, expect, it } from "vitest";
import {
  criarAleatorio,
  estourar,
  FORMATOS,
  INTENSIDADES,
  paletaDosFogos,
} from "../src/lib/fogos.js";
import {
  avancarCena,
  cenaAcabou,
  componentesDoEfeito,
  criarCena,
  desenharParticulasDoMotor,
  DURACAO_PADRAO_MS,
  EFEITOS,
  efeitoChamaAya,
  efeitoComVeu,
  nivelDaIntensidade,
  normalizarDuracao,
  particulasDaCena,
} from "../src/lib/motor-de-efeitos.js";

/*
  O motor de efeitos das comemorações: cenas repetíveis com semente fixa,
  teto de partículas, fim dentro da duração e a mistura dos efeitos.
  Sorteio sempre com criarAleatorio(n).
*/

const tela = { largura: 1280, altura: 720 };

/* Roda a cena a 60 fps até acabar; devolve quantos quadros e o pico. */
function rodar(cena, limite = 2000) {
  let quadros = 0;
  let pico = 0;
  while (!cenaAcabou(cena) && quadros < limite) {
    avancarCena(cena, 1 / 60);
    pico = Math.max(pico, cena.particulas.length);
    quadros += 1;
  }
  return { quadros, pico };
}

const retrato = (cena) =>
  cena.particulas
    .slice(0, 20)
    .map((p) => [p.tipo, Math.round(p.x * 100), Math.round(p.y * 100), p.cor]);

describe("motor de efeitos", () => {
  it("a mesma semente e os mesmos passos dão a mesma cena", () => {
    for (const efeito of EFEITOS) {
      const a = criarCena({ ...tela, efeito, aleatorio: criarAleatorio(7) });
      const b = criarCena({ ...tela, efeito, aleatorio: criarAleatorio(7) });
      for (let i = 0; i < 90; i += 1) {
        avancarCena(a, 1 / 60);
        avancarCena(b, 1 / 60);
      }
      expect(retrato(a)).toEqual(retrato(b));
      expect(particulasDaCena(a)).toBe(particulasDaCena(b));
    }
  });

  it("cada efeito acaba dentro da duração e não deixa nada na tela", () => {
    for (const efeito of EFEITOS) {
      const cena = criarCena({
        ...tela,
        efeito,
        duracaoMs: 4000,
        aleatorio: criarAleatorio(3),
      });
      const { quadros } = rodar(cena);
      expect(cenaAcabou(cena)).toBe(true);
      expect(quadros).toBeLessThanOrEqual(Math.ceil(4 * 60) + 2);
    }
  });

  it("nunca passa do teto de partículas", () => {
    const cena = criarCena({
      ...tela,
      efeito: "confete",
      intensidade: "festa",
      limite: 120,
      aleatorio: criarAleatorio(1),
    });
    const { pico } = rodar(cena);
    expect(pico).toBeLessThanOrEqual(120);
    expect(pico).toBeGreaterThan(0);
  });

  it("festa solta mais que suave", () => {
    const contar = (intensidade) => {
      const cena = criarCena({
        ...tela,
        efeito: "confete",
        intensidade,
        aleatorio: criarAleatorio(2),
      });
      return rodar(cena).pico;
    };
    expect(contar("festa")).toBeGreaterThan(contar("suave"));
  });

  it("efeitos e peças: combinado mistura fogos, confete e serpentina; a Aya só chama a mascote", () => {
    expect(componentesDoEfeito("combinado")).toEqual([
      "fogos",
      "confete",
      "serpentina",
    ]);
    expect(componentesDoEfeito("aya")).toEqual([]);
    expect(componentesDoEfeito("inexistente")).toEqual(["fogos"]);
    expect(efeitoChamaAya("aya")).toBe(true);
    expect(efeitoChamaAya("combinado")).toBe(true);
    expect(efeitoChamaAya("fogos")).toBe(false);
    expect(efeitoComVeu("estrelas")).toBe(true);
    expect(efeitoComVeu("confete")).toBe(false);
    const combinado = criarCena({
      ...tela,
      efeito: "combinado",
      aleatorio: criarAleatorio(4),
    });
    expect(combinado.show).not.toBeNull();
    expect(new Set(combinado.lotes.map((l) => l.peca))).toEqual(
      new Set(["confete", "serpentina"]),
    );
    const aya = criarCena({ ...tela, efeito: "aya" });
    expect(aya.show).toBeNull();
    expect(aya.lotes).toHaveLength(0);
    expect(aya.chamaAya).toBe(true);
  });

  it("intensidades novas e os nomes antigos dos fogos", () => {
    expect(nivelDaIntensidade("suave")).toBe("suave");
    expect(nivelDaIntensidade("pequeno")).toBe("suave");
    expect(nivelDaIntensidade("cheio")).toBe("normal");
    expect(nivelDaIntensidade("fogos")).toBe("normal");
    expect(nivelDaIntensidade("festa")).toBe("festa");
    expect(nivelDaIntensidade("?")).toBe("normal");
    const antigo = criarCena({ ...tela, intensidade: "fogos" });
    expect(antigo.show.duracao).toBe(INTENSIDADES.fogos.duracaoMs / 1000);
  });

  it("duração: limitada; nos fogos, mais tempo = mais estouros", () => {
    expect(normalizarDuracao(null)).toBeNull();
    expect(normalizarDuracao("x")).toBeNull();
    expect(normalizarDuracao(500)).toBe(2000);
    expect(normalizarDuracao(99000)).toBe(15000);
    expect(criarCena({ ...tela, efeito: "confete" }).duracao).toBe(
      DURACAO_PADRAO_MS / 1000,
    );
    const curto = criarCena({
      ...tela,
      duracaoMs: 6000,
      aleatorio: criarAleatorio(5),
    });
    const longo = criarCena({
      ...tela,
      duracaoMs: 12000,
      aleatorio: criarAleatorio(5),
    });
    expect(longo.duracao).toBe(12);
    const comuns = (cena) =>
      cena.show.planos.filter((p) => p.papel === "comum").length;
    expect(comuns(longo)).toBeGreaterThan(comuns(curto));
    // Fogos nunca abaixo de 4 s (o roteiro precisa do tempo).
    expect(criarCena({ ...tela, duracaoMs: 2000 }).duracao).toBe(4);
  });

  it("canhões de confete tocam um estalo; os eventos dos fogos passam para a cena", () => {
    const cena = criarCena({
      ...tela,
      efeito: "combinado",
      aleatorio: criarAleatorio(6),
    });
    const eventos = [];
    for (let i = 0; i < 300; i += 1) {
      avancarCena(cena, 1 / 60);
      eventos.push(...cena.eventos.splice(0));
    }
    expect(eventos.some((e) => e.papel === "canhao")).toBe(true);
    expect(eventos.some((e) => e.papel === "comum" || e.papel === "aya")).toBe(
      true,
    );
  });

  it("o desenho usa só o contexto recebido e cada tipo de partícula aparece", () => {
    const chamadas = {};
    const contexto = new Proxy(
      {},
      {
        get:
          (_, chave) =>
          (...args) => {
            chamadas[chave] = (chamadas[chave] || 0) + 1;
            return args;
          },
        set: () => true,
      },
    );
    const tipos = new Set();
    for (const efeito of [
      "confete",
      "serpentina",
      "estrelas",
      "coracoes",
      "baloes",
    ]) {
      const cena = criarCena({ ...tela, efeito, aleatorio: criarAleatorio(8) });
      for (let i = 0; i < 40; i += 1) avancarCena(cena, 1 / 60);
      cena.particulas.forEach((p) => tipos.add(p.tipo));
      desenharParticulasDoMotor(contexto, cena);
    }
    expect(tipos).toEqual(
      new Set([
        "confete",
        "serpentina",
        "cometa",
        "estrela",
        "coracao",
        "balao",
      ]),
    );
    expect(chamadas.fillRect).toBeGreaterThan(0);
    expect(chamadas.bezierCurveTo).toBeGreaterThan(0);
    expect(chamadas.ellipse).toBeGreaterThan(0);
    expect(chamadas.stroke).toBeGreaterThan(0);
    expect(chamadas.save).toBe(chamadas.restore);
  });

  it("fogos em camadas: o miolo do pistilo é mais lento e da segunda cor", () => {
    const paleta = paletaDosFogos();
    const lista = estourar(
      { formato: "pistilo", cor: "#f00", cor2: "#0ff" },
      { x: 0, y: 0, aleatorio: criarAleatorio(9) },
    ).filter((p) => p.tipo === "faisca");
    expect(lista).toHaveLength(FORMATOS.pistilo.faiscas);
    const miolo = lista.filter((p) => p.cor === "#0ff");
    const casca = lista.filter((p) => p.cor === "#f00");
    expect(miolo.length).toBe(
      Math.round(FORMATOS.pistilo.faiscas * FORMATOS.pistilo.nucleo),
    );
    const velocidade = (ps) =>
      ps.reduce((s, p) => s + Math.hypot(p.vx, p.vy), 0) / ps.length;
    expect(velocidade(miolo)).toBeLessThan(velocidade(casca) * 0.6);
    expect(paleta.cores.length).toBeGreaterThan(2);
  });
});
