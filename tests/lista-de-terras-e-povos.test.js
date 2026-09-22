import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  povosDaFeature,
  resumoDasTerras,
} from "../src/modules/indigenous-territories-layer.js";

/*
  O MAPA MOSTRAVA AS TERRAS E NÃO AS NOMEAVA EM LADO NENHUM

  Para saber que terras um DSEI atende e que povos vivem nelas, era preciso
  passar o ponteiro por cima de cada polígono, um a um. Num distrito com trinta
  terras isso não é consulta, é garimpo.

  Duas coisas atrapalham quem quiser montar essa lista a partir da Funai: os
  povos vêm num campo só, separados por vírgula, e a mesma terra repete-se
  quando o limite dela é feito de vários polígonos.
*/
const terra = (nome, etnias, uf = "AM", fase = "Regularizada") => ({
  type: "Feature",
  properties: {
    terrai_nome: nome,
    etnia_nome: etnias,
    uf_sigla: uf,
    fase_ti: fase,
  },
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 0],
      ],
    ],
  },
});

describe("os povos de uma terra", () => {
  it("separa o campo único da Funai", () => {
    expect(povosDaFeature({ etnia_nome: "Kaingang, Guarani" })).toEqual([
      "Kaingang",
      "Guarani",
    ]);
  });

  it("aguenta os outros separadores e o espaço a mais", () => {
    expect(povosDaFeature({ etnia_nome: "Tikuna;  Kokama / Kambeba" })).toEqual(
      ["Tikuna", "Kokama", "Kambeba"],
    );
  });

  it("campo vazio não vira povo vazio", () => {
    expect(povosDaFeature({ etnia_nome: "" })).toEqual([]);
    expect(povosDaFeature({ etnia_nome: " , ; " })).toEqual([]);
    expect(povosDaFeature(null)).toEqual([]);
  });
});

describe("a lista que o painel mostra", () => {
  it("junta os polígonos da mesma terra numa linha só", () => {
    const lista = resumoDasTerras([
      terra("Yanomami", "Yanomami"),
      terra("Yanomami", "Ye'kuana"),
    ]);
    expect(lista).toHaveLength(1);
    expect(lista[0].povos).toEqual(["Yanomami", "Ye'kuana"]);
  });

  it("não repete o povo que aparece em dois polígonos", () => {
    const lista = resumoDasTerras([
      terra("Raposa Serra do Sol", "Macuxi, Wapixana"),
      terra("Raposa Serra do Sol", "Macuxi"),
    ]);
    expect(lista[0].povos).toEqual(["Macuxi", "Wapixana"]);
  });

  it("junta as UFs de uma terra que atravessa estados", () => {
    const lista = resumoDasTerras([
      terra("Yanomami", "Yanomami", "RR"),
      terra("Yanomami", "Yanomami", "AM"),
    ]);
    expect(lista[0].ufs).toEqual(["AM", "RR"]);
  });

  it("ordena por nome, como quem procura na lista", () => {
    const lista = resumoDasTerras([
      terra("Zo'é", "Zo'é"),
      terra("Araribóia", "Guajajara"),
      terra("Évare I", "Tikuna"),
    ]);
    expect(lista.map((t) => t.nome)).toEqual(["Araribóia", "Évare I", "Zo'é"]);
  });

  /*
    Terra sem nome não é linha: é registo que a Funai publicou incompleto, e uma
    linha em branco na lista não ajuda ninguém.
  */
  it("descarta a terra sem nome", () => {
    expect(
      resumoDasTerras([terra("", "Guarani"), terra("  ", "Guarani")]),
    ).toEqual([]);
  });

  it("guarda a fase, que é o estado do processo", () => {
    expect(resumoDasTerras([terra("X", "Y", "AM", "Declarada")])[0].fase).toBe(
      "Declarada",
    );
  });

  it("aguenta entrada vazia ou inválida", () => {
    expect(resumoDasTerras([])).toEqual([]);
    expect(resumoDasTerras()).toEqual([]);
    expect(resumoDasTerras(null)).toEqual([]);
    expect(resumoDasTerras([null, {}, { properties: {} }])).toEqual([]);
  });
});

/*
  Contra o catálogo real: se a compilação mudar de campo, o número cai aqui
  antes de a lista aparecer vazia no ecrã.
*/
describe("contra o catálogo compilado", () => {
  const catalogo = JSON.parse(
    readFileSync("public/data/terras-indigenas.json", "utf8"),
  );
  const lista = resumoDasTerras(catalogo.features);

  it("nomeia todas as terras publicadas", () => {
    expect(lista.length).toBeGreaterThanOrEqual(600);
  });

  it("a maioria esmagadora declara povo", () => {
    const comPovo = lista.filter((t) => t.povos.length).length;
    expect(comPovo / lista.length).toBeGreaterThan(0.9);
  });

  it("nenhuma linha sai sem nome", () => {
    for (const t of lista) expect(t.nome.trim()).toBeTruthy();
  });
});

/*
  O painel e o gancho que o alimenta. A lista é desenhada pela camada, não pelo
  código do painel — é a camada que sabe que terras sobreviveram ao filtro.
*/
describe("o painel está ligado", () => {
  const html = readFileSync("index.html", "utf8");
  const app = readFileSync("src/modules/legacy-app.js", "utf8");
  const camada = readFileSync(
    "src/modules/indigenous-territories-layer.js",
    "utf8",
  );

  it("o painel existe no HTML", () => {
    expect(html).toContain('id="detailTerraList"');
    expect(html).toContain('id="detailTerraCount"');
  });

  it("a camada avisa quem desenha", () => {
    expect(camada).toContain(
      "__agsusAoMudarTerras?.(resumoDasTerras(doDistritoInteiro))",
    );
    expect(app).toContain("__agsusAoMudarTerras = renderDetailTerraList");
  });

  /*
    A LISTA É DO DISTRITO, O DESENHO É DO ENQUADRAMENTO

    A lista saía do recorte do ecrã. Quem aproximasse o mapa num posto de saúde
    via "Terras Indígenas e povos: 0" num distrito que tem dezenas — o painel
    respondia a "o que cabe no ecrã" e a pergunta é "o que este DSEI atende".

    O recorte continua a existir para o desenho, e tem de continuar: são 665
    terras, e o Leaflet paga por cada traçado.
  */
  it("a lista não é recortada pelo enquadramento", () => {
    expect(camada).toContain("const doDistritoInteiro = unidadesDoDsei.length");
    expect(camada).toContain("catalogo.features.filter((f) =>");
    expect(camada).not.toMatch(
      /__agsusAoMudarTerras\?\.\(resumoDasTerras\(doDistrito\)\)/,
    );
  });

  it("voltar ao Brasil esvazia a lista", () => {
    expect(app).toContain("renderDetailTerraList([])");
  });

  /*
    O nome da terra e o do povo vêm da Funai. Entram no DOM como HTML, e HTML
    de terceiro sem escapar é injeção.
  */
  it("o que vem da Funai é escapado antes de virar HTML", () => {
    expect(app).toContain("esc(t.nome)");
    expect(app).toContain("esc(t.povos.join");
    expect(app).toContain("esc(t.ufs.join");
  });
});
