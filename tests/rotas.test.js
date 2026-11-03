import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  TELAS_DAS_AREAS,
  caminhoDoDestino,
  destinoDoCaminho,
  ehRaizDoApp,
  telaDaRota,
} from "../src/lib/rotas.ts";
import { AREAS_DO_MENU, AREAS_DO_SISTEMA } from "../src/lib/menu-lateral.ts";
import { paginaDoCaminho } from "../server/servidor.ts";

/*
  As rotas do app (src/lib/rotas.ts): a área e a tela no endereço. O caminho
  vai e volta sem perder nada, o que não é rota fica de fora, e a Vercel e o
  servidor entregam o index.html para toda rota (o link direto não dá 404).
*/
const EDITAL = "0b7c9a52-2d55-4c4e-9f7a-1c3d5e7f9a1b";

describe("caminho ↔ destino", () => {
  it("as telas das áreas: /<área>/<tela>", () => {
    expect(caminhoDoDestino({ view: "calendario", area: "sede" })).toBe(
      "/sede/cronograma",
    );
    expect(caminhoDoDestino({ view: "dashboard", area: "projetos" })).toBe(
      "/projetos/visao-geral",
    );
    expect(caminhoDoDestino({ view: "pre-classificacao", area: "sede" })).toBe(
      "/sede/triagem",
    );
    expect(destinoDoCaminho("/saude-indigena/editais")).toEqual({
      view: "nucleo",
      area: "saude-indigena",
    });
  });

  it("todas as telas vão e voltam, em todas as áreas", () => {
    for (const { id: area } of AREAS_DO_SISTEMA)
      for (const { view } of TELAS_DAS_AREAS) {
        const caminho = caminhoDoDestino({ view, area });
        expect(destinoDoCaminho(caminho), caminho).toEqual({ view, area });
      }
  });

  it("o edital só nas telas que o abrem; a visão na busca", () => {
    expect(
      caminhoDoDestino({ view: "classificacao", area: "sede", edital: EDITAL }),
    ).toBe(`/sede/classificacao/${EDITAL}`);
    expect(
      caminhoDoDestino({ view: "nucleo", area: "sede", edital: EDITAL }),
    ).toBe("/sede/editais");
    expect(
      destinoDoCaminho(`/sede/entrevistas/${EDITAL}`, "?visao=fila"),
    ).toEqual({
      view: "conduzir-entrevistas",
      area: "sede",
      edital: EDITAL,
      visao: "fila",
    });
    expect(destinoDoCaminho(`/sede/editais/${EDITAL}`)).toBeNull();
  });

  it("Configurações, painel externo e sem acesso", () => {
    expect(caminhoDoDestino({ view: "config", secao: "acessos" })).toBe(
      "/administracao/configuracoes/acessos",
    );
    expect(caminhoDoDestino({ view: "config" })).toBe(
      "/administracao/configuracoes",
    );
    expect(destinoDoCaminho("/administracao/configuracoes/marca")).toEqual({
      view: "config",
      secao: "marca",
    });
    expect(caminhoDoDestino({ view: "panel:bi-rh" })).toBe("/paineis/bi-rh");
    expect(destinoDoCaminho("/paineis/bi-rh")).toEqual({ view: "panel:bi-rh" });
    expect(caminhoDoDestino({ view: "sem-acesso" })).toBe("/sem-acesso");
    expect(destinoDoCaminho("/sem-acesso")).toEqual({ view: "sem-acesso" });
  });

  it("o que não é rota: a raiz, tela que não existe, pedaço estranho", () => {
    expect(destinoDoCaminho("/")).toBeNull();
    expect(destinoDoCaminho("/index.html")).toBeNull();
    expect(ehRaizDoApp("/")).toBe(true);
    expect(ehRaizDoApp("/index.html")).toBe(true);
    expect(ehRaizDoApp("/sede/editais")).toBe(false);
    for (const caminho of [
      "/sede",
      "/sede/nao-existe",
      "/sede/editais/a/b",
      "/sede/%3Cscript%3E",
      "/sede/editais%2F..",
      "/paineis",
      "/administracao/outra",
    ])
      expect(destinoDoCaminho(caminho), caminho).toBeNull();
    // Sem área conhecida, a tela vai para a raiz (a de entrada decide).
    expect(caminhoDoDestino({ view: "nucleo" })).toBe("/");
    expect(caminhoDoDestino({ view: "chat", area: "sede" })).toBe("/");
    expect(telaDaRota("config")).toBeUndefined();
  });
});

describe("hospedagem: toda rota entrega o app", () => {
  const exemplos = [
    ...AREAS_DO_SISTEMA.flatMap(({ id: area }) =>
      TELAS_DAS_AREAS.map(({ view }) => caminhoDoDestino({ view, area })),
    ),
    caminhoDoDestino({
      view: "conduzir-entrevistas",
      area: "sede",
      edital: EDITAL,
    }),
    caminhoDoDestino({ view: "config", secao: "acessos" }),
    caminhoDoDestino({ view: "panel:bi" }),
    caminhoDoDestino({ view: "sem-acesso" }),
  ];

  it("o servidor (server/servidor.ts) entrega o index.html", () => {
    for (const caminho of exemplos)
      expect(paginaDoCaminho(caminho), caminho).toBe("index.html");
  });

  it("a Vercel reescreve as mesmas áreas para a página inicial", () => {
    const vercel = JSON.parse(readFileSync("vercel.json", "utf8"));
    const [areas, semAcesso] = vercel.rewrites;
    // Com cleanUrls, /index.html responde 308; o destino tem de ser "/".
    expect(vercel.cleanUrls).toBe(true);
    expect(areas.destination).toBe("/");
    const lista = /\/:area\(([^)]+)\)\/:caminho\*/.exec(areas.source)?.[1];
    expect(lista?.split("|").sort()).toEqual(
      AREAS_DO_MENU.map((area) => area.id).sort(),
    );
    expect(semAcesso).toEqual({
      source: "/sem-acesso",
      destination: "/",
    });
    // Arquivos e funções continuam com a Vercel (o sistema de arquivos vem antes).
    for (const fora of ["/api/", "/assets/", "/auth/", "/icons/", "/data/"])
      expect(areas.source.startsWith(fora)).toBe(false);
  });
});
