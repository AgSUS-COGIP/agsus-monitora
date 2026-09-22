import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  reconciliarDsei,
  unirEstabelecimentosRepetidos,
} from "../src/lib/reconciliacao-unidades.js";

/*
  A DICA DO DSEI RESPONDIA MAL A DUAS PERGUNTAS DIFERENTES

  Ela dizia "Polos base: 6" no DSEI Maranhão enquanto o mapa desenhava 71
  marcadores. Trocou-se por três números somando as listas cruas, e isso estava
  errado de outra maneira: em Alagoas e Sergipe dava "13 polos · 14 unidades ·
  1 CASAI", vinte e oito, quando o mapa desenha vinte e um.

  Doze daquelas catorze "unidades" chamam-se POLO BASE ALGUMA COISA no CNES:
  são os mesmos polos, cadastrados. Medido nos 34 distritos, somar as listas
  prometia 1578 pontos onde o mapa desenha 1328.

  Mas contar o que o mapa desenha também não responde sozinho: Alagoas e
  Sergipe tem treze polos na planilha e o mapa desenha dezoito marcadores de
  polo, porque cinco saem duas vezes. Daí duas linhas — quantos o distrito tem,
  quantos o mapa mostra.
*/
const polo = (nome, lat, lon) => ({ nome, lat, lon, tipo: "polo", cnes: "" });
const unidade = (nome, cnes, lat, lon) => ({
  nome,
  cnes,
  chave: cnes,
  lat,
  lon,
});

/*
  Nomes reais de Alagoas e Sergipe. A planilha chama-lhe `ACONÃ`, o CNES
  chama-lhe `POLO BASE ACONA`: é a mesma coisa, e enquanto a dica somava listas
  contava-a duas vezes.
*/
const ALAGOAS = {
  polos: [
    polo("ACONÃ", -10.0702, -36.9434),
    polo("KARUAZU", -9.23, -38.0341),
    polo("XOKÓ", -9.8199, -37.4122),
  ],
  estabelecimentos: [
    unidade("POLO BASE ACONA", "6247571", -10.0702, -36.9434),
    unidade("POLO BASE INDIGENA KARUAZU", "6383637", -9.23, -38.0341),
    unidade("UNIDADE BASICA DE SAUDE INDIGENA XOKO", "7778511", -9.82, -37.41),
    unidade("CASAI MACEIÓ (DSEI ALSE)", "7748396", -9.62, -35.73),
  ],
};

/*
  O mesmo caminho de `detailRecordsForDsei`: os pares reconciliados, mais TODOS
  os polos que não entraram num par, mais os estabelecimentos que sobraram.

  O "todos" importa. Um polo recusado por tipo incompatível não vai para
  `polosSemPar` — vai para `rejeitados`, e continua a ser desenhado. A primeira
  medição desta correção somava só `polosSemPar`, e por isso contou a menos.
*/
function pontosDesenhados({ polos, estabelecimentos }) {
  const { estabelecimentos: unicos } =
    unirEstabelecimentosRepetidos(estabelecimentos);
  const { reconciliados } = reconciliarDsei({
    dseiChave: "ALAGOAS E SERGIPE",
    polos,
    estabelecimentos: unicos,
  });
  const nomesUnificados = new Set(reconciliados.map((r) => r.nomes.lmap));
  const usados = new Set(reconciliados.map((r) => String(r.cnes || "")));
  return {
    somaDasListas: polos.length + estabelecimentos.length,
    desenhados:
      reconciliados.length +
      polos.filter((p) => !nomesUnificados.has(p.nome)).length +
      unicos.filter((e) => !usados.has(String(e.cnes))).length,
    pares: reconciliados.length,
  };
}

describe("o polo que o CNES também cadastra", () => {
  const contas = pontosDesenhados(ALAGOAS);

  it("a soma das listas promete mais do que o mapa desenha", () => {
    expect(contas.somaDasListas).toBe(7);
    expect(contas.desenhados).toBeLessThan(contas.somaDasListas);
  });

  /*
    ACONÃ e KARUAZU casam pelo nome; XOKÓ não, porque a UBSI que leva o nome da
    terra é outra coisa que não o polo. Cada par é um ponto a menos no mapa e,
    antes disto, um ponto a mais na dica.
  */
  it("cada par reconciliado é um ponto que a dica contava a dobrar", () => {
    expect(contas.pares).toBe(2);
    expect(contas.desenhados).toBe(contas.somaDasListas - contas.pares);
  });
});

describe("a dica responde às duas perguntas", () => {
  const app = readFileSync("src/modules/legacy-app.js", "utf8");

  it("diz quantos polos o distrito tem, da planilha de lotações", () => {
    expect(app).toContain("const polosDaLotacao = (d.polos || []).length;");
    expect(app).toContain("`Polos base: ${polosDaLotacao}`");
  });

  it("e quantos pontos o mapa mostra, contados como se desenha", () => {
    expect(app).toContain("for (const registo of detailRecordsForDsei(d))");
    expect(app).toContain("No mapa: ");
  });

  it("não volta a somar o tamanho das listas", () => {
    expect(app).not.toContain('["Unidades de saúde", (grupo.u || []).length]');
  });

  it("só mostra o que existe, sem CASAIs: 0", () => {
    expect(app).toContain(".filter(([, n]) => n > 0)");
  });

  it("a dica do mapa usa o resumo", () => {
    expect(app).toContain("${resumoDaRedeDoDsei(d)}");
  });

  /*
    O resumo traz uma quebra de linha, que é marcação nossa, e por isso não vai
    envolvido em `esc`. Só pode ser montado com números e texto literal: no dia
    em que alguém lá meter um nome vindo da base, isto vira injeção.
  */
  it("o resumo não interpola texto vindo da base", () => {
    const corpo = app.slice(
      app.indexOf("function resumoDaRedeDoDsei(d)"),
      app.indexOf("return _resumoDaRedePorDsei.get(d.k);"),
    );
    expect(corpo).toContain("<br>");
    expect(corpo).not.toContain("d.n");
    expect(corpo).not.toContain("registo.name");
    expect(corpo).not.toContain("registo.nome");
  });

  /*
    Contar é o mesmo trabalho que desenhar: 11 ms para os 34 distritos, medido.
    Guardar o resultado é o que torna isso aceitável numa dica; esquecê-lo
    quando os dados mudam é o que impede a dica de mentir depois de um
    recarregamento.
  */
  it("guarda o resultado e esquece-o quando os dados mudam", () => {
    expect(app).toContain("_resumoDaRedePorDsei");
    expect(app).toContain("function esquecerResumoDaRede()");
    expect(app).toMatch(
      /REDE_CNES = byKey\.rede_cnes;[\s\S]{0,140}esquecerResumoDaRede\(\)/,
    );
  });
});
