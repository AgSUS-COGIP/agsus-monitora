import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  comPassoDaTrilha,
  comTrilhaConcluida,
  PAGINAS_COM_TOUR,
  passoParaRetomar,
  posicaoDoBalao,
  progressoDasTrilhas,
  rotuloDoPasso,
  rotuloDoProgresso,
  tourDaPagina,
  trilhasDoPerfil,
  chaveDoTour,
  convitesFeitos,
  deveConvidar,
  geometriaDoHolofote,
  MARGEM_DO_HOLOFOTE,
} from "../src/lib/aya-tours.js";

/*
  Os roteiros dos tours e das trilhas da Aya (src/lib/aya-tours.js): cada
  tela pedida tem tour, a Visão geral muda por área, as trilhas aparecem só
  para quem pode fazê-las, o progresso guardado é limpo e o balão fica
  sempre dentro da tela.
*/

const perfil = (permissoes, extra = {}) => ({
  ativo: true,
  perfil: "usuario",
  admin_global: false,
  permissoes,
  ...extra,
});

const LEITOR_DE_TUDO = perfil({
  dashboard: "leitor",
  nucleo: "leitor",
  calendario: "leitor",
  analises: "leitor",
  aprovados: "leitor",
  entrevistas: "leitor",
  recursos: "leitor",
  selecao: "leitor",
});

const ids = (trilhas) => trilhas.map((t) => t.id);

describe("tours das telas", () => {
  it("as telas pedidas têm tour", () => {
    for (const chave of [
      "dashboard",
      "nucleo",
      "calendario",
      "analises",
      "recursos",
      "entrevistas",
      "approved",
      "selecao",
      "classificacao",
      "entrevistas:conduzir",
      "entrevistas:roteiros",
      "classificacao:agenda",
      "classificacao:regra",
      "approved:convocacao",
      "config:marca",
      "config:inicio",
      "config:acesso",
      "config:aparencia",
      "config:recursos",
      "config:operacao",
      "config:modulos",
      "config:cargas",
      "config:mensagens",
      "config:acessos",
    ])
      expect(PAGINAS_COM_TOUR).toContain(chave);
  });

  it("textos curtos: título e no máximo duas frases", () => {
    for (const chave of PAGINAS_COM_TOUR) {
      const [view, resto] = chave.split(":");
      const tour = tourDaPagina({
        view,
        secao: view === "config" ? resto : "",
        aba: view === "config" ? "" : resto,
        area: "saude-indigena",
      });
      expect(tour.chave).toBe(chave);
      for (const p of tour.passos) {
        expect(p.titulo.length).toBeLessThanOrEqual(40);
        expect(p.texto.length).toBeLessThanOrEqual(160);
        expect(
          p.texto.split(/[.!?](\s|$)/).filter((f) => f.trim()).length,
        ).toBeLessThanOrEqual(3);
      }
    }
  });

  it("a Visão geral mostra o mapa da área (e nenhum na SEDE)", () => {
    const titulos = (area) =>
      tourDaPagina({ view: "dashboard", area }).passos.map((p) => p.titulo);
    expect(titulos("saude-indigena")).toContain("Mapa dos DSEIs");
    expect(titulos("projetos")).toContain("Mapa dos projetos");
    expect(titulos("sede").some((t) => t.startsWith("Mapa"))).toBe(false);
  });

  it("Configurações sem seção, ou tela sem tour, não tem tour", () => {
    expect(tourDaPagina({ view: "config", secao: "acessos" })).not.toBeNull();
    expect(tourDaPagina({ view: "config", secao: "marca" })).not.toBeNull();
    expect(tourDaPagina({ view: "config" })).toBeNull();
    expect(tourDaPagina({ view: "panel:x" })).toBeNull();
  });

  it("cada aba principal tem o próprio tour; aba sem tour usa o da tela", () => {
    expect(chaveDoTour({ view: "entrevistas", aba: "conduzir" })).toBe(
      "entrevistas:conduzir",
    );
    expect(chaveDoTour({ view: "entrevistas", aba: "Resultados" })).toBe(
      "entrevistas",
    );
    expect(chaveDoTour({ view: "classificacao", aba: "regra" })).toBe(
      "classificacao:regra",
    );
    expect(chaveDoTour({ view: "approved", aba: "Convocação" })).toBe(
      "approved:convocacao",
    );
    expect(chaveDoTour({ view: "config", secao: "cargas", aba: "x" })).toBe(
      "config:cargas",
    );
  });

  it("o botão que o perfil não vê sai do tour", () => {
    const leitor = perfil({ ...LEITOR_DE_TUDO.permissoes });
    const editor = perfil({ ...LEITOR_DE_TUDO.permissoes, recursos: "editor" });
    const titulos = (p) =>
      tourDaPagina({ view: "recursos", perfil: p }).passos.map((x) => x.titulo);
    expect(titulos(leitor)).not.toContain("Novo recurso");
    expect(titulos(editor)).toContain("Novo recurso");
    // Sem perfil (testes, legado), o tour não corta nada.
    expect(titulos(null)).toContain("Novo recurso");
  });

  it("contador e convite da primeira visita", () => {
    expect(rotuloDoPasso(2, 9)).toBe("Passo 3 de 9");
    expect(convitesFeitos(["recursos", "recursos", 3, null])).toEqual([
      "recursos",
    ]);
    expect(convitesFeitos("x")).toEqual([]);
    expect(deveConvidar({ chave: "recursos", feitos: [] })).toBe(true);
    expect(deveConvidar({ chave: "recursos", feitos: ["recursos"] })).toBe(
      false,
    );
    expect(deveConvidar({ chave: "recursos", feitos: [], ocupado: true })).toBe(
      false,
    );
    expect(deveConvidar({ chave: "", feitos: [] })).toBe(false);
  });

  it("todo data-tour usado nos roteiros existe num componente", () => {
    const fonte = readFileSync("src/lib/aya-tours.js", "utf8");
    // `t("nome")` monta o seletor [data-tour='nome'].
    const usados = [
      ...fonte.matchAll(/data-tour='([^']+)'/g),
      ...fonte.matchAll(/\bt\("([^"]+)"\)/g),
    ]
      .map((m) => m[1])
      .filter((id) => !id.includes("$"));
    expect(usados.length).toBeGreaterThan(0);
    const arquivos = [];
    const varrer = (pasta) => {
      for (const nome of readdirSync(pasta)) {
        const caminho = join(pasta, nome);
        if (statSync(caminho).isDirectory()) varrer(caminho);
        else if (caminho.endsWith(".jsx")) arquivos.push(caminho);
      }
    };
    varrer("src/modulos");
    varrer("src/componentes");
    const jsx = arquivos.map((a) => readFileSync(a, "utf8")).join("\n");
    // O atributo vem escrito (data-tour="x"), pela prop dos componentes de
    // src/ui (tour="x") ou montado num modelo (data-tour={`prefixo-${…}`}).
    const prefixos = [
      ...jsx.matchAll(/data-tour"?[=:]\s*\{?`([a-z-]+)\$\{/g),
    ].map((m) => m[1]);
    for (const id of new Set(usados))
      expect(
        jsx.includes(`data-tour="${id}"`) ||
          jsx.includes(`tour="${id}"`) ||
          jsx.includes(`"data-tour": "${id}"`) ||
          jsx.includes(`? "${id}"`) ||
          prefixos.some((prefixo) => id.startsWith(prefixo)),
        id,
      ).toBe(true);
  });
});

describe("trilhas por permissão", () => {
  it("sem perfil ou inativo, nenhuma", () => {
    expect(trilhasDoPerfil(null)).toEqual([]);
    expect(trilhasDoPerfil({ ...LEITOR_DE_TUDO, ativo: false })).toEqual([]);
  });

  it("leitor: primeiros passos, edital ao aprovado e entrevista; sem recurso nem acessos", () => {
    expect(ids(trilhasDoPerfil(LEITOR_DE_TUDO))).toEqual([
      "primeiros-passos",
      "do-edital-ao-aprovado",
      "conduzir-entrevista",
    ]);
  });

  it("quem edita Recursos faz a trilha do recurso, com os passos de quem registra", () => {
    const trilha = trilhasDoPerfil(
      perfil({ ...LEITOR_DE_TUDO.permissoes, recursos: "editor" }),
    ).find((t) => t.id === "registrar-recurso");
    expect(trilha.passos.map((p) => p.titulo)).toContain("Registrar");
  });

  it("o jurídico faz a trilha do recurso sem os passos de quem registra", () => {
    const trilha = trilhasDoPerfil(
      perfil({
        ...LEITOR_DE_TUDO.permissoes,
        recursos_parecer: "editor",
      }),
    ).find((t) => t.id === "registrar-recurso");
    const titulos = trilha.passos.map((p) => p.titulo);
    expect(titulos).toContain("Decisão do jurídico");
    expect(titulos).not.toContain("Registrar");
  });

  it("convocar e emitir carta só para quem muda o status do candidato", () => {
    expect(ids(trilhasDoPerfil(LEITOR_DE_TUDO))).not.toContain(
      "convocar-e-emitir-carta",
    );
    const editor = perfil({
      ...LEITOR_DE_TUDO.permissoes,
      aprovados: "editor",
    });
    const trilha = trilhasDoPerfil(editor).find(
      (x) => x.id === "convocar-e-emitir-carta",
    );
    expect(trilha.passos.length).toBeGreaterThan(4);
    expect(trilha.passos.every((x) => x.pagina === "approved")).toBe(true);
  });

  it("dar acesso só para quem gerencia acessos", () => {
    expect(ids(trilhasDoPerfil(LEITOR_DE_TUDO))).not.toContain("dar-acesso");
    expect(
      ids(trilhasDoPerfil({ ...LEITOR_DE_TUDO, admin_global: true })),
    ).toContain("dar-acesso");
  });

  it("passo de página que o perfil não abre fica de fora", () => {
    const semAnalises = perfil({
      ...LEITOR_DE_TUDO.permissoes,
      analises: "sem_acesso",
    });
    const trilha = trilhasDoPerfil(semAnalises).find(
      (t) => t.id === "do-edital-ao-aprovado",
    );
    expect(trilha.passos.map((p) => p.pagina)).not.toContain("analises");
    expect(trilha.passos).toHaveLength(6);
  });
});

describe("progresso", () => {
  it("descarta o que não é trilha conhecida ou está estragado", () => {
    expect(progressoDasTrilhas(null)).toEqual({});
    expect(progressoDasTrilhas([1])).toEqual({});
    expect(
      progressoDasTrilhas({
        "primeiros-passos": { passo: 2, concluida: false },
        "dar-acesso": { passo: -3, concluida: "sim" },
        inventada: { passo: 1 },
      }),
    ).toEqual({
      "primeiros-passos": { passo: 2, concluida: false },
      "dar-acesso": { passo: 0, concluida: false },
    });
  });

  it("guarda o passo, conclui e diz onde retomar", () => {
    let p = comPassoDaTrilha({}, "primeiros-passos", 2);
    expect(rotuloDoProgresso(p["primeiros-passos"], 7)).toBe("3 de 7");
    expect(passoParaRetomar(p["primeiros-passos"], 7)).toBe(2);
    p = comTrilhaConcluida(p, "primeiros-passos");
    expect(rotuloDoProgresso(p["primeiros-passos"], 7)).toBe("Concluída");
    expect(passoParaRetomar(p["primeiros-passos"], 7)).toBe(0);
    expect(rotuloDoProgresso(undefined, 7)).toBe("7 passos");
    // A trilha encolheu (perdeu permissão): retoma no último passo que existe.
    expect(passoParaRetomar({ passo: 9, concluida: false }, 4)).toBe(3);
  });
});

describe("posição do balão", () => {
  const tela = { largura: 1200, altura: 800 };
  const balao = { largura: 300, altura: 150 };

  it("embaixo do elemento quando cabe, centralizado nele", () => {
    const pos = posicaoDoBalao({
      caixa: { top: 100, left: 500, width: 200, height: 50 },
      balao,
      tela,
    });
    expect(pos).toEqual({ modo: "baixo", top: 162, left: 450 });
  });

  it("em cima quando não cabe embaixo", () => {
    const pos = posicaoDoBalao({
      caixa: { top: 600, left: 500, width: 200, height: 150 },
      balao,
      tela,
    });
    expect(pos.modo).toBe("cima");
    expect(pos.top).toBe(600 - 150 - 12);
  });

  it("nunca sai da tela", () => {
    const pos = posicaoDoBalao({
      caixa: { top: 10, left: 1150, width: 40, height: 20 },
      balao,
      tela,
    });
    expect(pos.left).toBeLessThanOrEqual(1200 - 300 - 12);
    expect(pos.left).toBeGreaterThanOrEqual(12);
  });

  it("elemento enorme: no pé da tela, por cima", () => {
    const pos = posicaoDoBalao({
      caixa: { top: 0, left: 0, width: 1200, height: 800 },
      balao,
      tela,
    });
    expect(pos.modo).toBe("sobre");
    expect(pos.top).toBe(800 - 150 - 12);
  });

  it("sem elemento, no meio", () => {
    expect(posicaoDoBalao({ caixa: null, balao, tela })).toEqual({
      modo: "centro",
      top: 325,
      left: 450,
    });
  });

  it("celular: largura total, do lado oposto ao elemento", () => {
    const celular = { largura: 375, altura: 800 };
    expect(
      posicaoDoBalao({
        caixa: { top: 100, left: 0, width: 375, height: 80 },
        balao,
        tela: celular,
        celular: true,
      }),
    ).toEqual({ modo: "celular", lado: "baixo" });
    expect(
      posicaoDoBalao({
        caixa: { top: 600, left: 0, width: 375, height: 80 },
        balao,
        tela: celular,
        celular: true,
      }),
    ).toEqual({ modo: "celular", lado: "cima" });
  });
});

describe("holofote", () => {
  // O buraco entre as quatro faixas tem de ser exatamente o recorte (moldura).
  const buraco = ({ faixas }) => ({
    top: faixas[0].height,
    left: faixas[2].width,
    width: faixas[3].left - faixas[2].width,
    height: faixas[1].top - faixas[0].height,
  });

  it.each([
    [{ top: 120, left: 326, width: 174, height: 38 }],
    [{ top: 10.4, left: 0.6, width: 99.7, height: 20.2 }],
    [{ top: 300.5, left: 375.49, width: 124.51, height: 44.5 }],
  ])("moldura == área clara: %o", (retangulo) => {
    const g = geometriaDoHolofote(retangulo);
    expect(buraco(g)).toEqual(g.recorte);
    expect(g.faixas[2].top).toBe(g.recorte.top);
    expect(g.faixas[3].top).toBe(g.recorte.top);
    expect(g.faixas[2].height).toBe(g.recorte.height);
    expect(g.faixas[3].height).toBe(g.recorte.height);
  });

  it("a mesma folga dos quatro lados, em pixels inteiros", () => {
    const g = geometriaDoHolofote({
      top: 100,
      left: 50,
      width: 200,
      height: 40,
    });
    expect(g.recorte).toEqual({
      top: 100 - MARGEM_DO_HOLOFOTE,
      left: 50 - MARGEM_DO_HOLOFOTE,
      width: 200 + 2 * MARGEM_DO_HOLOFOTE,
      height: 40 + 2 * MARGEM_DO_HOLOFOTE,
    });
    expect(geometriaDoHolofote(null)).toBeNull();
  });

  it("elemento colado na borda: faixa de largura zero, nunca negativa", () => {
    const g = geometriaDoHolofote({ top: 2, left: 2, width: 10, height: 10 });
    expect(g.faixas[0].height).toBe(0);
    expect(g.faixas[2].width).toBe(0);
  });
});
