import { existsSync, readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import {
  blocoDo,
  calcularMesesCompletos,
  comporParecer,
  dataUtc,
  linhasDeTexto,
  mesesDaExperiencia,
  periodoDeInterposicao,
  preencher,
  rascunhoInicial,
  rascunhoVazio,
  referenciasDoEdital,
  REFERENCIAS_PADRAO,
  textoDoParecer,
  textosDoModelo,
  totalSemSobreposicao,
} from "../src/lib/parecer-em-blocos.ts";
import {
  linhasVisiveis,
  preencherOSimulador,
} from "../src/modulos/recursos/parecer-em-blocos/simulador.ts";
import { dadosFicticios } from "../src/modulos/recursos/parecer-em-blocos/dados-ficticios.ts";
import { CASOS, casoCompleto } from "./casos-do-parecer.js";
import { TEXTOS_ESPERADOS } from "./parecer-em-blocos-esperado.js";

/*
  O parecer em blocos escreve o MESMO texto que o simulador da equipe.

  1. Texto esperado (sempre roda): cada caso de casos-do-parecer.js (nomes
     fictícios) tem o texto, linha a linha, em parecer-em-blocos-esperado.js —
     conferido contra o simulador quando foi escrito.
  2. Paridade com o simulador (só com SIMULADOR_DE_PARECERES apontando para o
     HTML da equipe, que NÃO fica no repositório; no CI, pulado): abre o
     simulador no jsdom com o script dele, preenche os campos com o mesmo caso
     (como o clique faria) e compara o texto visível da prévia dele. A única
     diferença aceita é CORRECOES_DO_SIMULADOR (palavras em inglês).
  3. Meses: a função do simulador, copiada aqui sem mudança, contra a porta.
*/

const textoDoMonitora = (rascunho) =>
  linhasDeTexto(comporParecer(rascunho)).map((l) =>
    l.replace(/\s+/g, " ").trim(),
  );

describe("o texto de cada caso é o esperado", () => {
  it("todos os casos têm texto esperado", () => {
    expect(Object.keys(TEXTOS_ESPERADOS).sort()).toEqual(
      CASOS.map(([nome]) => nome).sort(),
    );
  });

  for (const [nome, caso] of CASOS)
    it(nome, async () => {
      expect(textoDoMonitora(await caso())).toEqual(TEXTOS_ESPERADOS[nome]);
    });

  it("o cômputo sem sobreposição do caso completo", () => {
    expect(textoDoMonitora(casoCompleto()).join("\n")).toContain(
      "consolida-se o tempo efetivo de 28 mês(es) completo(s), o que perfaz a pontuação total de 5,6 ponto(s)",
    );
  });
});

const SIMULADOR_DE_PARECERES = process.env.SIMULADOR_DE_PARECERES || "";

describe.skipIf(!SIMULADOR_DE_PARECERES || !existsSync(SIMULADOR_DE_PARECERES))(
  "paridade com o simulador da equipe (SIMULADOR_DE_PARECERES)",
  () => {
    async function textoDoSimulador(rascunho) {
      const dom = new JSDOM(readFileSync(SIMULADOR_DE_PARECERES, "utf8"), {
        runScripts: "dangerously",
        beforeParse(janela) {
          // O jsdom não tem innerText; o simulador escreve a prévia por ele.
          Object.defineProperty(janela.HTMLElement.prototype, "innerText", {
            configurable: true,
            get() {
              return this.textContent;
            },
            set(valor) {
              this.textContent = valor;
            },
          });
          janela.confirm = () => true;
        },
      });
      // O simulador monta a 1ª experiência no DOMContentLoaded (o jsdom dispara depois).
      await new Promise((pronto) =>
        dom.window.addEventListener("DOMContentLoaded", pronto, { once: true }),
      );
      preencherOSimulador(dom.window, rascunho);
      return linhasVisiveis(
        dom.window.document.querySelector(".document-page"),
        { corrigir: true },
      );
    }

    for (const [nome, caso] of CASOS)
      it(nome, async () => {
        const rascunho = await caso();
        expect(textoDoMonitora(rascunho)).toEqual(
          await textoDoSimulador(rascunho),
        );
      });
  },
);

/*
  parseUTCDate e calcularMesesCompletos do simulador, copiadas sem mudança
  (só a sintaxe de módulo), para comparar com a porta em src/lib.
*/
function parseUTCDate(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split("-");
  if (parts.length !== 3) return null;
  return new Date(
    Date.UTC(
      parseInt(parts[0], 10),
      parseInt(parts[1], 10) - 1,
      parseInt(parts[2], 10),
    ),
  );
}

function calcularMesesDoSimulador(d1, d2) {
  if (!d1 || !d2 || d2 < d1) return 0;

  let meses =
    (d2.getUTCFullYear() - d1.getUTCFullYear()) * 12 +
    (d2.getUTCMonth() - d1.getUTCMonth());
  let diaOriginal = d1.getUTCDate();

  let tempDate = new Date(
    Date.UTC(d1.getUTCFullYear(), d1.getUTCMonth() + meses, diaOriginal),
  );
  if (
    tempDate.getUTCMonth() !==
    (((d1.getUTCMonth() + meses) % 12) + 12) % 12
  ) {
    tempDate = new Date(
      Date.UTC(d1.getUTCFullYear(), d1.getUTCMonth() + meses + 1, 0),
    );
  }

  if (d2 < tempDate) {
    meses--;
  }

  return meses < 0 ? 0 : meses;
}

const doSimulador = {
  parseUTCDate,
  calcularMesesCompletos: calcularMesesDoSimulador,
};

describe("meses completos: a conta do simulador, portada sem mudança", () => {
  const iso = (d) => d.toISOString().slice(0, 10);

  it("dá o mesmo resultado que a função do simulador numa grade de datas", () => {
    const inicio = Date.UTC(2019, 0, 1);
    let comparados = 0;
    for (let a = 0; a < 800; a += 3) {
      const d1 = new Date(inicio + a * 86_400_000);
      for (const dias of [
        0, 1, 27, 28, 29, 30, 31, 58, 59, 60, 61, 89, 90, 365, 366, 400, 731,
      ]) {
        const d2 = new Date(d1.getTime() + dias * 86_400_000);
        const esperado = doSimulador.calcularMesesCompletos(
          doSimulador.parseUTCDate(iso(d1)),
          doSimulador.parseUTCDate(iso(d2)),
        );
        expect(calcularMesesCompletos(dataUtc(iso(d1)), dataUtc(iso(d2)))).toBe(
          esperado,
        );
        expect(mesesDaExperiencia(iso(d1), iso(d2))).toBe(esperado);
        comparados++;
      }
    }
    expect(comparados).toBeGreaterThan(4000);
  });

  it("casos que a equipe deve conhecer (fim de mês e o dia final)", () => {
    expect(mesesDaExperiencia("2026-01-01", "2026-01-31")).toBe(0);
    expect(mesesDaExperiencia("2026-01-01", "2026-02-01")).toBe(1);
    expect(mesesDaExperiencia("2026-01-31", "2026-02-28")).toBe(1);
    expect(mesesDaExperiencia("2024-01-31", "2024-02-28")).toBe(0);
    expect(mesesDaExperiencia("2024-01-31", "2024-02-29")).toBe(1);
    expect(mesesDaExperiencia("2026-03-10", "2026-03-01")).toBe(0);
    expect(mesesDaExperiencia("", "2026-03-01")).toBe(0);
  });

  it("une sobreposições, mas não emenda o dia seguinte (como o simulador)", () => {
    const itens = [
      { atende: true, inicio: "2020-01-01", fim: "2020-06-30" },
      { atende: true, inicio: "2020-07-01", fim: "2020-12-31" },
    ];
    // 5 + 5: cada intervalo perde o mês do dia final.
    expect(totalSemSobreposicao(itens)).toEqual({
      meses: 10,
      pontos: 10 * 0.2,
    });
    expect(
      totalSemSobreposicao([
        { atende: true, inicio: "2020-01-01", fim: "2020-12-31" },
        { atende: true, inicio: "2020-03-01", fim: "2020-05-31" },
        { atende: false, inicio: "2010-01-01", fim: "2020-01-01" },
      ]).meses,
    ).toBe(11);
  });
});

describe("referências do edital", () => {
  it("sem regra, valem os números do simulador", () => {
    const { referencias, fontes } = referenciasDoEdital(null);
    expect(referencias).toEqual(REFERENCIAS_PADRAO);
    expect(new Set(Object.values(fontes))).toEqual(new Set(["padrao"]));
  });

  it("o item do bloco da regra e as referências gravadas vencem o padrão e entram no texto", () => {
    const { referencias, fontes } = referenciasDoEdital({
      blocos: [
        { codigo: "TITULACAO", tipo: "TITULOS", item_edital: "9.3" },
        { codigo: "EXPERIENCIA", tipo: "VINCULOS", item_edital: "" },
      ],
      referencias_do_parecer: {
        anexo_quilombola: "XII",
        heteroidentificacao: "5.6.2",
        inexistente: "1",
      },
    });
    expect(referencias.formacao).toBe("9.3");
    expect(referencias.experiencia).toBe("8.15");
    expect(fontes).toMatchObject({
      formacao: "bloco",
      anexo_quilombola: "regra",
      experiencia: "padrao",
    });
    const r = casoCompleto();
    r.referencias = referencias;
    const texto = textoDoParecer(comporParecer(r));
    expect(texto).toContain("conforme item 9.3. do edital");
    expect(texto).toContain("conforme modelo estabelecido no Anexo XII.");
    expect(texto).toContain(
      "Declaração conforme modelo estabelecido no Anexo VI",
    );
    expect(texto).toContain("item 5.6.2 do Edital");
    expect(texto).not.toContain("{ref_");
  });
});

describe("modelo e marcadores", () => {
  it("o valor digitado com ** não vira negrito; marcador desconhecido fica", () => {
    expect(preencher("A **{x}** e {y}", { x: "**b**" })).toEqual([
      { texto: "A " },
      { texto: "**b**", negrito: true },
      { texto: " e {y}" },
    ]);
  });

  it("o modelo editado troca só o texto gravado", () => {
    const textos = textosDoModelo({
      titulo_objeto: "1. DO OBJETO",
      desconhecido: "x",
      objeto: "  ",
    });
    const linhas = linhasDeTexto(comporParecer(rascunhoVazio(), textos));
    expect(linhas).toContain("1. DO OBJETO");
    expect(linhas.some((l) => l.startsWith("1.1. O presente parecer"))).toBe(
      true,
    );
  });
});

describe("pré-preenchimento com o que o MONITORA sabe", () => {
  it("cabeçalho, prazo, envio, ficha, cotas e ajuste, com a fonte de cada campo", async () => {
    const {
      rascunho: r,
      fontes,
      avisos,
    } = rascunhoInicial(await dadosFicticios.carregar("ficticio-1"));
    expect(r.cabecalho.candidato).toBeTruthy();
    expect(r.admissibilidade.prazo_de).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(r.admissibilidade.envio_hora).toMatch(/^\d{2}:\d{2}$/);
    expect(r.admissibilidade.tempestivo).toBe(true);
    expect(blocoDo(r, "experiencia").itens.length).toBeGreaterThan(1);
    expect(blocoDo(r, "formacao").titulos.length).toBeGreaterThan(0);
    expect(r.conclusao.retificar).toBe(true);
    expect(fontes).toMatchObject({
      "cabecalho.candidato": "recurso",
      "admissibilidade.prazo": "cronograma",
      "admissibilidade.envio": "recurso",
      "bloco.experiencia": "ficha",
      "conclusao.notas": "ajuste",
    });
    // A ficha conta dias ÷ 30; o simulador, meses de calendário: o aviso mostra a diferença.
    expect(avisos.some((a) => a.includes("dias ÷ 30"))).toBe(true);
  });

  it("envio depois do prazo vira intempestivo e indeferimento", async () => {
    const dados = await dadosFicticios.carregar("ficticio-1");
    dados.recurso.enviado_em = "2026-10-22T09:10:00-03:00";
    const { rascunho } = rascunhoInicial(dados);
    expect(rascunho.admissibilidade.tempestivo).toBe(false);
    expect(textoDoParecer(comporParecer(rascunho))).toContain(
      "NÃO CONHECIMENTO",
    );
  });

  it("sem ficha e sem cronograma: blocos em branco e avisos", () => {
    const { rascunho, avisos } = rascunhoInicial({
      recurso: {
        id: 1,
        candidato: "X",
        codigo: 1,
        edital: "1/2026",
        unidade: "U",
        vaga: "V",
        criado_em: "2026-10-21T12:00:00Z",
      },
    });
    expect(rascunho.blocos.map((b) => b.codigo)).toEqual(
      rascunhoVazio().blocos.map((b) => b.codigo),
    );
    expect(avisos).toHaveLength(3);
  });

  it("período de interposição: a atividade de abertura mais tardia da origem", () => {
    expect(
      periodoDeInterposicao(
        [
          {
            atividade: "Prazo de recurso",
            inicio: "2026-10-01",
            fim: "2026-10-02",
            origem: "analise-curricular",
            papel: "abertura",
          },
          {
            atividade: "Prazo de recurso (errata)",
            inicio: "2026-10-20",
            fim: "2026-10-21",
            origem: "analise-curricular",
            papel: "abertura",
          },
          {
            atividade: "Resposta",
            inicio: "2026-10-28",
            fim: "2026-10-30",
            origem: "analise-curricular",
            papel: "resposta",
          },
          {
            atividade: "Prazo de recurso",
            inicio: "2026-11-20",
            fim: "2026-11-21",
            origem: "entrevista",
            papel: "abertura",
          },
        ],
        "analise-curricular",
      ),
    ).toEqual({
      inicio: "2026-10-20",
      fim: "2026-10-21",
      atividade: "Prazo de recurso (errata)",
    });
  });
});
