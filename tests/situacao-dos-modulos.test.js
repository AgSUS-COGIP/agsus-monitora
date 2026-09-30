import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  abaDaPagina,
  areaEstaAtiva,
  dicaDaManutencao,
  filtrarAreasAtivas,
  formatarPrevisao,
  MENSAGEM_PADRAO_DE_MANUTENCAO,
  normalizarSituacaoDoSistema,
  situacaoEfetiva,
  SITUACAO_PADRAO,
  textoDaFaixaDoAdministrador,
  textosDaManutencao,
} from "../src/lib/situacao-dos-modulos.js";
import {
  abasDoCatalogo,
  ABAS_DO_MENU,
  montarArvoreDoMenu,
  paginasDaArea,
} from "../src/lib/menu-lateral.js";
import { secaoDeConfiguracaoPermitida } from "../src/lib/access-roles.js";
import {
  aplicarManutencaoNaNavegacao,
  carregarSituacaoDoSistema,
  consultaDaSituacaoDoSistema,
  esquecerSituacaoDoSistema,
  situacaoDoSistema,
} from "../src/modules/situacao-dos-modulos.js";

/*
  Módulos e abas: o sistema, cada área, cada aba (em todas as áreas ou só
  numa) podem estar desativados ou em manutenção. A situação efetiva de uma
  página segue sistema > área > aba > aba na área, e falha de rede vale como
  tudo ativo — ninguém fica trancado por erro de conexão.
*/

const RESPOSTA = (mudancas = {}) => ({
  admin_global: false,
  sistema: {
    situacao: "ATIVA",
    mensagem: null,
    previsao: null,
    atualizado_em: "2026-09-30T12:00:00Z",
  },
  areas: [
    {
      co_area: "saude-indigena",
      ativo: true,
      situacao: "ATIVA",
      mensagem: null,
      previsao: null,
    },
    {
      co_area: "sede",
      ativo: true,
      situacao: "MANUTENCAO",
      mensagem: "SEDE em ajuste",
      previsao: "2026-10-05",
    },
    {
      co_area: "projetos",
      ativo: false,
      situacao: "ATIVA",
      mensagem: null,
      previsao: null,
    },
  ],
  ...mudancas,
});

/* Linhas de listar_abas_do_menu como o banco manda depois da migration. */
const linha = (
  co_aba,
  co_view,
  extras = {},
  areas = ["saude-indigena", "sede"],
) => ({
  co_aba,
  no_aba: co_aba,
  ds_icone: "file-text",
  nu_ordem: 1,
  co_view,
  co_recurso: co_view,
  tp_aba: "nativa",
  st_beta: false,
  tp_situacao: "ATIVA",
  ds_mensagem: null,
  dt_previsao: null,
  areas: areas.map((co_area) => ({
    co_area,
    nu_ordem: 1,
    co_view,
    ds_icone: "file-text",
    tp_situacao: "ATIVA",
    ds_mensagem: null,
    dt_previsao: null,
  })),
  ...extras,
});

describe("situação do sistema (obter_situacao_do_sistema)", () => {
  it("normaliza sistema e áreas", () => {
    const situacao = normalizarSituacaoDoSistema(RESPOSTA());
    expect(situacao.carregada).toBe(true);
    expect(situacao.sistema).toBeNull();
    expect(situacao.areas.map((a) => [a.id, a.ativo])).toEqual([
      ["saude-indigena", true],
      ["sede", true],
      ["projetos", false],
    ]);
    expect(situacao.areas[1].manutencao).toEqual({
      mensagem: "SEDE em ajuste",
      previsao: "2026-10-05",
    });
  });

  it("resposta estranha vale como tudo ativo", () => {
    for (const dados of [null, undefined, "x", [], 3]) {
      expect(normalizarSituacaoDoSistema(dados)).toBe(SITUACAO_PADRAO);
    }
    expect(areaEstaAtiva(SITUACAO_PADRAO, "projetos")).toBe(true);
  });

  it("tira as áreas desativadas", () => {
    const situacao = normalizarSituacaoDoSistema(RESPOSTA());
    expect(
      filtrarAreasAtivas(["saude-indigena", "sede", "projetos"], situacao),
    ).toEqual(["saude-indigena", "sede"]);
  });

  it("formata a previsão em dd/mm/aaaa", () => {
    expect(formatarPrevisao("2026-10-05")).toBe("05/10/2026");
    expect(formatarPrevisao("2026-10-05T00:00:00")).toBe("05/10/2026");
    expect(formatarPrevisao(null)).toBe("");
    expect(formatarPrevisao("amanhã")).toBe("");
  });
});

describe("situação efetiva de uma página", () => {
  const abas = abasDoCatalogo([
    linha("editais", "nucleo"),
    linha("cronograma", "calendario", {
      tp_situacao: "MANUTENCAO",
      ds_mensagem: "Cronograma novo",
      dt_previsao: "2026-10-01",
    }),
    linha("aprovados", "approved", {
      areas: [
        {
          co_area: "saude-indigena",
          nu_ordem: 4,
          co_view: "approved",
          tp_situacao: "MANUTENCAO",
          ds_mensagem: "Só na Saúde Indígena",
          dt_previsao: null,
        },
        {
          co_area: "sede",
          nu_ordem: 4,
          co_view: "approved",
          tp_situacao: "ATIVA",
        },
      ],
    }),
  ]);
  const ativa = normalizarSituacaoDoSistema(RESPOSTA({ areas: [] }));

  it("tudo ativo: nenhuma manutenção", () => {
    expect(
      situacaoEfetiva({ situacao: ativa, abas, view: "nucleo", area: "sede" }),
    ).toBeNull();
    expect(situacaoEfetiva({ abas, view: "nucleo", area: "sede" })).toBeNull();
  });

  it("aba em manutenção em todas as áreas", () => {
    expect(
      situacaoEfetiva({
        situacao: ativa,
        abas,
        view: "calendario",
        area: "saude-indigena",
      }),
    ).toEqual({
      origem: "aba",
      mensagem: "Cronograma novo",
      previsao: "2026-10-01",
    });
  });

  it("aba em manutenção só numa área", () => {
    const naSaude = situacaoEfetiva({
      situacao: ativa,
      abas,
      view: "approved",
      area: "saude-indigena",
    });
    expect(naSaude.origem).toBe("aba_area");
    expect(
      situacaoEfetiva({
        situacao: ativa,
        abas,
        view: "approved",
        area: "sede",
      }),
    ).toBeNull();
  });

  it("área em manutenção vale antes da aba; sistema vale antes de tudo", () => {
    const comArea = normalizarSituacaoDoSistema(RESPOSTA());
    expect(
      situacaoEfetiva({
        situacao: comArea,
        abas,
        view: "calendario",
        area: "sede",
      }),
    ).toMatchObject({ origem: "area", mensagem: "SEDE em ajuste" });

    const comSistema = normalizarSituacaoDoSistema(
      RESPOSTA({
        sistema: {
          situacao: "MANUTENCAO",
          mensagem: "Tudo parado",
          previsao: null,
        },
      }),
    );
    for (const view of ["calendario", "config", "panel:x", "nucleo"]) {
      expect(
        situacaoEfetiva({ situacao: comSistema, abas, view, area: "sede" }),
      ).toMatchObject({ origem: "sistema", mensagem: "Tudo parado" });
    }
  });

  it("Configurações e painéis não são abas: só o sistema os alcança", () => {
    const comArea = normalizarSituacaoDoSistema(RESPOSTA());
    expect(
      situacaoEfetiva({
        situacao: comArea,
        abas,
        view: "config",
        area: "sede",
      }),
    ).toBeNull();
    expect(abaDaPagina(abas, "panel:x", "sede")).toBeNull();
  });

  it("textos da tela e da faixa", () => {
    expect(
      textosDaManutencao({ origem: "aba", mensagem: "", previsao: null }),
    ).toEqual({
      titulo: "Em manutenção",
      mensagem: MENSAGEM_PADRAO_DE_MANUTENCAO,
      previsao: "",
    });
    expect(
      textosDaManutencao({
        origem: "aba",
        mensagem: "Oi",
        previsao: "2026-10-05",
      }).previsao,
    ).toBe("Previsão de volta: 05/10/2026");
    expect(textoDaFaixaDoAdministrador({ origem: "aba" })).toBe(
      "Em manutenção para os demais usuários.",
    );
    expect(textoDaFaixaDoAdministrador({ origem: "sistema" })).toContain(
      "sistema inteiro",
    );
    expect(
      dicaDaManutencao({ mensagem: "Ajuste", previsao: "2026-10-05" }),
    ).toBe("Em manutenção · Ajuste · Previsão de volta: 05/10/2026");
  });
});

describe("menu: selo BETA e manutenção vêm do banco", () => {
  it("st_beta do banco vale sobre o do código", () => {
    const abas = abasDoCatalogo([
      linha("editais", "nucleo", { st_beta: true }),
      linha("recursos", "recursos", { st_beta: false }),
    ]);
    expect(abas.find((a) => a.id === "editais").beta).toBe(true);
    expect(abas.find((a) => a.id === "recursos").beta).toBeUndefined();
    // Sem catálogo, o código continua valendo (Recursos é beta ali).
    expect(ABAS_DO_MENU.find((a) => a.id === "recursos").beta).toBe(true);
  });

  it("aba ativa não ganha o campo manutencao; em manutenção, ganha", () => {
    const abas = abasDoCatalogo([
      linha("editais", "nucleo"),
      linha("cronograma", "calendario", { tp_situacao: "MANUTENCAO" }),
    ]);
    const paginas = paginasDaArea(abas, "sede");
    expect(Object.hasOwn(paginas[0], "manutencao")).toBe(false);
    expect(paginas[1].manutencao).toEqual({ mensagem: "", previsao: null });
  });

  it("área desativada sai do menu; área em manutenção leva o aviso", () => {
    const situacao = normalizarSituacaoDoSistema(RESPOSTA());
    const arvore = montarArvoreDoMenu({
      permitidas: { nucleo: true },
      areas: ["saude-indigena", "sede", "projetos"],
      situacao,
    });
    expect(arvore.map((g) => g.id)).toEqual(["saude-indigena", "sede"]);
    expect(arvore[1].manutencao.mensagem).toBe("SEDE em ajuste");
    expect(Object.hasOwn(arvore[0], "manutencao")).toBe(false);
  });

  it("sem situação (RPC falhou), o menu é o de sempre", () => {
    const arvore = montarArvoreDoMenu({
      permitidas: { nucleo: true },
      areas: ["saude-indigena", "sede", "projetos"],
    });
    expect(arvore.map((g) => g.id)).toEqual([
      "saude-indigena",
      "sede",
      "projetos",
    ]);
  });
});

describe("seção Módulos e abas", () => {
  it("só o administrador global vê", () => {
    expect(
      secaoDeConfiguracaoPermitida(
        { admin_global: true, permissoes: {} },
        "modulos",
      ),
    ).toBe(true);
    expect(
      secaoDeConfiguracaoPermitida(
        {
          admin_global: false,
          permissoes: { configuracoes: "admin", acessos: "admin" },
        },
        "modulos",
      ),
    ).toBe(false);
  });
});

describe("tela de manutenção e faixa do administrador", () => {
  const abas = abasDoCatalogo([
    linha("editais", "nucleo", {
      tp_situacao: "MANUTENCAO",
      ds_mensagem: "Editais em ajuste",
      dt_previsao: "2026-10-05",
    }),
    linha("cronograma", "calendario"),
  ]);

  beforeEach(async () => {
    document.body.innerHTML =
      '<main id="conteudoPrincipal"><div class="content"><section id="page-nucleo" class="page"></section></div></main>';
    await carregarSituacaoDoSistema({
      consulta: Promise.resolve({ data: RESPOSTA({ areas: [] }), error: null }),
    });
  });
  afterEach(() => {
    esquecerSituacaoDoSistema(document);
    document.body.innerHTML = "";
  });

  it("quem não é admin vê a tela de manutenção com mensagem e previsão", () => {
    const parou = aplicarManutencaoNaNavegacao({
      view: "nucleo",
      area: "sede",
      abas,
      adminGlobal: false,
    });
    expect(parou).toBe(true);
    const pagina = document.getElementById("page-manutencao");
    expect(pagina.classList.contains("active")).toBe(true);
    expect(pagina.querySelector("h2").textContent).toBe("Em manutenção");
    expect(pagina.textContent).toContain("Editais em ajuste");
    expect(pagina.textContent).toContain("Previsão de volta: 05/10/2026");
    expect(document.getElementById("faixaDeManutencao")).toBeNull();
  });

  it("o admin global vê a página, com a faixa âmbar", () => {
    const parou = aplicarManutencaoNaNavegacao({
      view: "nucleo",
      area: "sede",
      abas,
      adminGlobal: true,
    });
    expect(parou).toBe(false);
    const faixa = document.getElementById("faixaDeManutencao");
    expect(faixa.hidden).toBe(false);
    expect(faixa.textContent).toContain(
      "Em manutenção para os demais usuários",
    );
    // Outra página, sem manutenção: a faixa some.
    aplicarManutencaoNaNavegacao({
      view: "calendario",
      area: "sede",
      abas,
      adminGlobal: true,
    });
    expect(faixa.hidden).toBe(true);
  });

  it("sair da manutenção esconde a tela de manutenção", () => {
    aplicarManutencaoNaNavegacao({ view: "nucleo", area: "sede", abas });
    expect(
      aplicarManutencaoNaNavegacao({ view: "calendario", area: "sede", abas }),
    ).toBe(false);
    expect(
      document.getElementById("page-manutencao").classList.contains("active"),
    ).toBe(false);
  });

  it("sistema em manutenção fecha até Configurações para quem não é admin", async () => {
    await carregarSituacaoDoSistema({
      consulta: Promise.resolve({
        data: RESPOSTA({
          areas: [],
          sistema: {
            situacao: "MANUTENCAO",
            mensagem: "Volta já",
            previsao: null,
          },
        }),
        error: null,
      }),
    });
    expect(aplicarManutencaoNaNavegacao({ view: "config", abas })).toBe(true);
    expect(document.getElementById("page-manutencao").textContent).toContain(
      "Volta já",
    );
  });

  it("falha na consulta vale como tudo ativo", async () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    await carregarSituacaoDoSistema({
      consulta: Promise.resolve({
        data: null,
        error: { message: "Failed to fetch" },
      }),
    });
    expect(situacaoDoSistema()).toBe(SITUACAO_PADRAO);
    await carregarSituacaoDoSistema({
      consulta: Promise.reject(new Error("x")),
    });
    expect(situacaoDoSistema()).toBe(SITUACAO_PADRAO);
    aviso.mockRestore();
    // Mesmo assim a manutenção da aba (do catálogo) continua valendo.
    expect(
      aplicarManutencaoNaNavegacao({ view: "calendario", area: "sede", abas }),
    ).toBe(false);
  });

  it("a consulta nunca rejeita", async () => {
    const sb = { rpc: vi.fn(() => Promise.reject(new Error("rede"))) };
    const resposta = await consultaDaSituacaoDoSistema(sb);
    expect(resposta.data).toBeNull();
    expect(sb.rpc).toHaveBeenCalledWith("obter_situacao_do_sistema");
    expect(await consultaDaSituacaoDoSistema(null)).toEqual({
      data: null,
      error: null,
    });
  });
});
