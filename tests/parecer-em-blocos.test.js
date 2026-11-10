import { existsSync, readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import {
  blocoDo,
  comporParecer,
  DIAS_POR_MES,
  linhasDeTexto,
  mesesDaExperiencia,
  periodoDeInterposicao,
  pontosDoParecer,
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
import { diasDosIntervalos } from "../src/lib/avaliacao-documental/pontuacao.ts";
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
     (como o clique faria) e compara o texto visível da prévia dele. As
     diferenças aceitas são CORRECOES_DO_SIMULADOR (palavras em inglês) e os
     números do total de meses da experiência (ver o item 3).
  3. Meses: desde 10/11/2026, a regra da ficha (dias corridos com o primeiro
     e o último, unidos, ÷ 30), e não mais a do simulador (meses de
     calendário sem o dia final), que dava um mês a menos que a ficha.
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
      "consolida-se o tempo efetivo de 29 mês(es) completo(s), o que perfaz a pontuação total de 5,8 ponto(s)",
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

    // O total de meses segue a ficha, não o simulador: os números saem da comparação.
    const semOsMeses = (linhas) =>
      linhas.map((l) =>
        l.replace(
          /tempo efetivo de \d+ mês\(es\) completo\(s\), o que perfaz a pontuação total de [\d,]+ ponto\(s\)/,
          "tempo efetivo de # mês(es) completo(s), o que perfaz a pontuação total de # ponto(s)",
        ),
      );

    for (const [nome, caso] of CASOS)
      it(nome, async () => {
        const rascunho = await caso();
        expect(semOsMeses(textoDoMonitora(rascunho))).toEqual(
          semOsMeses(await textoDoSimulador(rascunho)),
        );
      });
  },
);

describe("meses da experiência: a regra da ficha", () => {
  const iso = (ms) => new Date(ms).toISOString().slice(0, 10);

  it("dá o mesmo que a ficha (dias ÷ 30) numa grade de datas", () => {
    const inicio = Date.UTC(2019, 0, 1);
    let comparados = 0;
    for (let a = 0; a < 800; a += 3) {
      const d1 = inicio + a * 86_400_000;
      for (const dias of [
        0, 1, 27, 28, 29, 30, 31, 58, 59, 60, 61, 89, 90, 365, 366, 400, 731,
      ]) {
        const d2 = d1 + dias * 86_400_000;
        const esperado = Math.floor(
          diasDosIntervalos([{ inicio: iso(d1), fim: iso(d2) }]) / DIAS_POR_MES,
        );
        expect(mesesDaExperiencia(iso(d1), iso(d2))).toBe(esperado);
        expect(
          totalSemSobreposicao([
            { atende: true, inicio: iso(d1), fim: iso(d2) },
          ]).meses,
        ).toBe(esperado);
        comparados++;
      }
    }
    expect(comparados).toBeGreaterThan(4000);
  });

  it("casos que a equipe deve conhecer (o dia final conta)", () => {
    // 30 dias com o primeiro e o último fecham um mês.
    expect(mesesDaExperiencia("2026-01-01", "2026-01-30")).toBe(1);
    expect(mesesDaExperiencia("2026-01-01", "2026-01-29")).toBe(0);
    // Antes (simulador): 01/01 a 31/01 dava 0 mês.
    expect(mesesDaExperiencia("2026-01-01", "2026-01-31")).toBe(1);
    expect(mesesDaExperiencia("2026-01-01", "2026-12-31")).toBe(12);
    expect(mesesDaExperiencia("2026-03-10", "2026-03-01")).toBe(0);
    expect(mesesDaExperiencia("", "2026-03-01")).toBe(0);
  });

  it("une sobreposições e emenda o dia seguinte (como a ficha)", () => {
    // 182 + 184 dias seguidos = 366 dias = 12 meses (o simulador dava 5 + 5).
    expect(
      totalSemSobreposicao([
        { atende: true, inicio: "2020-01-01", fim: "2020-06-30" },
        { atende: true, inicio: "2020-07-01", fim: "2020-12-31" },
      ]),
    ).toEqual({ meses: 12, pontos: 12 * 0.2 });
    expect(
      totalSemSobreposicao([
        { atende: true, inicio: "2020-01-01", fim: "2020-12-31" },
        { atende: true, inicio: "2020-03-01", fim: "2020-05-31" },
        { atende: false, inicio: "2010-01-01", fim: "2020-01-01" },
      ]).meses,
    ).toBe(12);
  });
});

describe("pontos no parecer", () => {
  it("um decimal, meio para cima sem o erro do float", () => {
    expect(pontosDoParecer(1.45)).toBe("1,5");
    expect(pontosDoParecer(0.05)).toBe("0,1");
    expect(pontosDoParecer(2.25)).toBe("2,3");
    expect(pontosDoParecer(1.44)).toBe("1,4");
    expect(pontosDoParecer(5.8)).toBe("5,8");
    expect(pontosDoParecer(0)).toBe("0,0");
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
    // Parecer e ficha contam igual (dias ÷ 30): sem aviso de diferença.
    expect(avisos.some((a) => a.includes("A ficha apurou"))).toBe(false);
  });

  it("avisa quando a ficha apurou outro total (estágio ou data limite)", async () => {
    const dados = await dadosFicticios.carregar("ficticio-1");
    const ficha = { ...dados.ficha, meses_apurados: 999 };
    const { avisos } = rascunhoInicial({ ...dados, ficha });
    expect(
      avisos.some((a) =>
        a.startsWith("A ficha apurou 999 meses; o parecer conta"),
      ),
    ).toBe(true);
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
