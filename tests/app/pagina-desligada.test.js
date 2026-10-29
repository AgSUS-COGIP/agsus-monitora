import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { criarNavegacao } from "../../src/app/navegacao.ts";
import {
  INTERVALO_DA_PRESENCA_MS,
  criarPresenca,
} from "../../src/app/presenca.ts";
import {
  criarVigiaDoCatalogo,
  versaoDaResposta,
} from "../../src/app/vigia-do-catalogo.ts";
import {
  definirAreaAtual,
  definirAreasDoUsuario,
  obterDadosDoMonitoramento,
  redefinirDadosDoMonitoramento,
} from "../../src/componentes/dados-do-monitoramento.ts";
import {
  obterEstadoDaBarraLateral,
  redefinirBarraLateral,
} from "../../src/componentes/barra-lateral/estado.ts";
import { ABAS_DO_MENU, abasDoCatalogo } from "../../src/lib/menu-lateral.ts";
import {
  paginaDesligada,
  primeiraPaginaLigada,
} from "../../src/lib/pagina-desligada.ts";
import { normalizarSituacaoDoSistema } from "../../src/lib/situacao-dos-modulos.ts";
import { carregarCatalogoDeAbas } from "../../src/modules/catalogo-de-abas.ts";
import {
  carregarSituacaoDoSistema,
  esquecerSituacaoDoSistema,
} from "../../src/modules/situacao-dos-modulos.ts";
import { redefinirPaginaDaAya } from "../../src/modulos/aya/estado.ts";

/*
  Página desligada pela coordenação fecha sem recarregar (19/10/2026: o banco
  saturou e quem já estava numa aba desligada continuava nela, consultando,
  até recarregar).

  - a regra pura (src/lib/pagina-desligada.ts);
  - a checagem periódica: a versão do catálogo vem de carona na presença, a
    cada 90 s com a aba visível, e para com a aba oculta (src/app/presenca.ts);
  - o vigia (src/app/vigia-do-catalogo.ts) relê o catálogo só quando a versão
    muda;
  - a navegação (src/app/navegacao.ts) troca a página pelo aviso, sem
    chamar a tela de novo; com trabalho não salvo, só a faixa; religada, o
    menu volta.
*/

/* O catálogo no formato de `listar_abas_do_menu`, sem as ligações `fora` ("aba@area"). */
function catalogo(fora = []) {
  return ABAS_DO_MENU.map((aba) => ({
    co_aba: aba.id,
    no_aba: aba.rotulo,
    ds_icone: aba.icone,
    nu_ordem: aba.ordem,
    co_view: aba.view,
    co_recurso: aba.recurso,
    tp_aba: aba.tipo,
    areas: aba.areas
      .filter(({ area }) => !fora.includes(`${aba.id}@${area}`))
      .map(({ area }) => ({ co_area: area, nu_ordem: aba.ordem })),
  })).filter((linha) => !fora.includes(linha.co_aba));
}

const situacaoCom = (areas) =>
  normalizarSituacaoDoSistema({
    sistema: { situacao: "ATIVA" },
    areas: areas.map(([co_area, ativo]) => ({
      co_area,
      ativo,
      situacao: "ATIVA",
    })),
  });

describe("a regra da página desligada", () => {
  const semEditaisNaSede = abasDoCatalogo(catalogo(["editais@sede"]));

  it("aba tirada da área está desligada nela, e só nela", () => {
    const base = { abas: semEditaisNaSede, doBanco: true, view: "nucleo" };
    expect(paginaDesligada({ ...base, area: "sede" })).toBe(true);
    expect(paginaDesligada({ ...base, area: "saude-indigena" })).toBe(false);
  });

  it("aba desligada em todas as áreas (fora do catálogo do banco)", () => {
    const abas = abasDoCatalogo(catalogo(["selecao"]));
    expect(
      paginaDesligada({ abas, doBanco: true, view: "selecao", area: "sede" }),
    ).toBe(true);
    // Sem área: desligada porque não está em área nenhuma.
    expect(paginaDesligada({ abas, doBanco: true, view: "selecao" })).toBe(
      true,
    );
  });

  it("a Triagem (já ativada) segue a regra das outras abas", () => {
    // Sem catálogo (inclusive falha de rede), nada está desligado: a Triagem
    // está no catálogo do código desde a ativação (#597).
    expect(
      paginaDesligada({
        abas: ABAS_DO_MENU,
        doBanco: false,
        view: "pre-classificacao",
        area: "projetos",
      }),
    ).toBe(false);
    const catalogoAtivado = abasDoCatalogo(
      catalogo(["pre-classificacao@sede", "pre-classificacao@saude-indigena"]),
    );
    expect(
      paginaDesligada({
        abas: catalogoAtivado,
        doBanco: true,
        view: "pre-classificacao",
        area: "projetos",
      }),
    ).toBe(false);
    expect(
      paginaDesligada({
        abas: catalogoAtivado,
        doBanco: true,
        view: "pre-classificacao",
        area: "sede",
      }),
    ).toBe(true);
  });

  it("área desligada fecha as páginas dela", () => {
    const abas = abasDoCatalogo(catalogo());
    const situacao = situacaoCom([
      ["sede", false],
      ["projetos", true],
    ]);
    const base = { abas, doBanco: true, situacao, view: "dashboard" };
    expect(paginaDesligada({ ...base, area: "sede" })).toBe(true);
    expect(paginaDesligada({ ...base, area: "projetos" })).toBe(false);
  });

  it("sem o catálogo do banco, ou fora das abas, nada está desligado", () => {
    expect(
      paginaDesligada({
        abas: ABAS_DO_MENU,
        doBanco: false,
        view: "nucleo",
        area: "sede",
      }),
    ).toBe(false);
    for (const view of ["config", "panel:bi", "sem-acesso"])
      expect(
        paginaDesligada({
          abas: semEditaisNaSede,
          doBanco: true,
          view,
          area: "sede",
        }),
      ).toBe(false);
  });

  it("o botão vai à primeira página da área atual; sem ela, à de outro grupo", () => {
    const arvore = [
      {
        id: "saude-indigena",
        itens: [{ view: "dashboard", area: "saude-indigena" }],
      },
      { id: "sede", itens: [{ view: "nucleo", area: "sede" }] },
    ];
    expect(primeiraPaginaLigada(arvore, "sede", "approved")?.view).toBe(
      "nucleo",
    );
    expect(primeiraPaginaLigada(arvore, "sede", "nucleo")?.view).toBe(
      "dashboard",
    );
    expect(primeiraPaginaLigada([], "sede", "nucleo")).toBeNull();
  });
});

/* Documento falso da presença: a visibilidade da aba muda pelo teste. */
function documentoFalso() {
  const ouvintes = new Set();
  const documento = {
    visibilityState: "visible",
    title: "MONITORA",
    addEventListener: (_nome, ouvinte) => ouvintes.add(ouvinte),
    removeEventListener: (_nome, ouvinte) => ouvintes.delete(ouvinte),
    mudar(estado) {
      documento.visibilityState = estado;
      ouvintes.forEach((ouvinte) => ouvinte());
    },
  };
  return documento;
}

describe("checagem periódica: carona na presença", () => {
  afterEach(() => vi.useRealTimers());

  it("a cada 90 s com a aba visível, nenhuma com ela oculta; a versão chega ao vigia", async () => {
    vi.useFakeTimers();
    const documento = documentoFalso();
    const cliente = {
      rpc: vi.fn(async () => ({
        data: { status: "OK", versao_do_catalogo: "v1" },
        error: null,
      })),
    };
    const aoRegistrar = vi.fn();
    const presenca = criarPresenca({
      cliente: () => cliente,
      documento,
      obterUsuario: () => ({ id: "u1" }),
      obterPerfil: () => ({ id: "c", ativo: true, perfil: "usuario" }),
      navegacao: { obter: () => ({ view: "nucleo" }), assinar: () => () => {} },
      local: () => "Editais · SEDE",
      aoRegistrar,
    });
    presenca.acompanhar();
    presenca.iniciar();
    await vi.advanceTimersByTimeAsync(0);
    expect(cliente.rpc).toHaveBeenCalledTimes(1);
    expect(aoRegistrar).toHaveBeenLastCalledWith({
      status: "OK",
      versao_do_catalogo: "v1",
    });
    await vi.advanceTimersByTimeAsync(INTERVALO_DA_PRESENCA_MS);
    expect(cliente.rpc).toHaveBeenCalledTimes(2);

    documento.mudar("hidden");
    await vi.advanceTimersByTimeAsync(INTERVALO_DA_PRESENCA_MS * 5);
    expect(cliente.rpc).toHaveBeenCalledTimes(2);
    expect(aoRegistrar).toHaveBeenCalledTimes(2);

    // A volta da aba, passado o intervalo, bate (e checa) uma vez só.
    documento.mudar("visible");
    await vi.advanceTimersByTimeAsync(0);
    expect(cliente.rpc).toHaveBeenCalledTimes(3);
    // Só a presença: nenhuma chamada nova ao banco por causa do catálogo.
    expect(
      cliente.rpc.mock.calls.every(
        ([nome]) => nome === "registrar_presenca_monitora",
      ),
    ).toBe(true);
    presenca.pararTudo();
  });

  it("quem ouve a resposta não derruba a presença", async () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    const presenca = criarPresenca({
      cliente: () => ({ rpc: async () => ({ data: {}, error: null }) }),
      documento: documentoFalso(),
      obterUsuario: () => ({ id: "u1" }),
      obterPerfil: () => ({ id: "c", ativo: true, perfil: "usuario" }),
      local: () => "x",
      aoRegistrar: () => {
        throw new Error("falhou");
      },
    });
    await presenca.sincronizar();
    expect(aviso).toHaveBeenCalled();
    aviso.mockRestore();
  });
});

describe("o vigia relê o catálogo só quando a versão muda", () => {
  function montar({ falhar = false } = {}) {
    const navegacao = {
      montarMenu: vi.fn(),
      reavaliarTelaAtual: vi.fn(),
    };
    const resposta = (data) =>
      Promise.resolve(
        falhar
          ? { data: null, error: { message: "Failed to fetch" } }
          : { data, error: null },
      );
    const abas = {
      consulta: vi.fn(() => resposta(catalogo())),
      carregar: vi.fn(async () => true),
    };
    const situacao = {
      consulta: vi.fn(() => resposta({ sistema: {}, areas: [] })),
      carregar: vi.fn(async () => ({})),
    };
    const vigia = criarVigiaDoCatalogo({
      cliente: () => ({}),
      abas,
      situacao,
      navegacao,
    });
    return { vigia, navegacao, abas, situacao };
  }

  it("lê a versão da resposta da presença", () => {
    expect(versaoDaResposta({ status: "OK", versao_do_catalogo: "a" })).toBe(
      "a",
    );
    expect(versaoDaResposta({ status: "OK" })).toBeNull();
    expect(versaoDaResposta(null)).toBeNull();
  });

  it("a primeira versão só guarda; a mesma não relê; outra relê, remonta o menu e reavalia", async () => {
    const { vigia, navegacao, abas, situacao } = montar();
    expect(vigia.aoRegistrarPresenca({ versao_do_catalogo: "v1" })).toBeNull();
    expect(vigia.aoRegistrarPresenca({ versao_do_catalogo: "v1" })).toBeNull();
    expect(abas.consulta).not.toHaveBeenCalled();
    expect(navegacao.reavaliarTelaAtual).toHaveBeenCalledTimes(2);

    await vigia.aoRegistrarPresenca({ versao_do_catalogo: "v2" });
    expect(abas.consulta).toHaveBeenCalledTimes(1);
    expect(situacao.consulta).toHaveBeenCalledTimes(1);
    expect(abas.carregar).toHaveBeenCalledTimes(1);
    expect(situacao.carregar).toHaveBeenCalledTimes(1);
    expect(navegacao.montarMenu).toHaveBeenCalledTimes(1);
    expect(navegacao.reavaliarTelaAtual).toHaveBeenCalledTimes(3);
    expect(vigia.versao()).toBe("v2");
  });

  it("banco sem a migration (sem versão): nada é relido", () => {
    const { vigia, abas } = montar();
    vigia.aoRegistrarPresenca({ status: "OK" });
    vigia.aoRegistrarPresenca({ status: "OK" });
    expect(abas.consulta).not.toHaveBeenCalled();
    expect(vigia.versao()).toBeNull();
  });

  it("falha ao reler: o menu fica como está e a próxima batida tenta de novo", async () => {
    const { vigia, navegacao, abas } = montar({ falhar: true });
    vigia.aoRegistrarPresenca({ versao_do_catalogo: "v1" });
    expect(await vigia.aoRegistrarPresenca({ versao_do_catalogo: "v2" })).toBe(
      false,
    );
    expect(abas.carregar).not.toHaveBeenCalled();
    expect(navegacao.montarMenu).not.toHaveBeenCalled();
    expect(vigia.versao()).toBe("v1");
    await vigia.aoRegistrarPresenca({ versao_do_catalogo: "v2" });
    expect(abas.consulta).toHaveBeenCalledTimes(2);
  });

  it("depois de sair, a próxima entrada recomeça (a primeira versão só guarda)", () => {
    const { vigia, abas } = montar();
    vigia.aoRegistrarPresenca({ versao_do_catalogo: "v1" });
    vigia.esquecer();
    vigia.aoRegistrarPresenca({ versao_do_catalogo: "v9" });
    expect(abas.consulta).not.toHaveBeenCalled();
    expect(vigia.versao()).toBe("v9");
  });
});

describe("a página aberta que foi desligada vira o aviso", () => {
  const PERFIL = {
    id: "g",
    ativo: true,
    perfil: "edital_gestor",
    areas: ["saude-indigena", "sede"],
  };

  function montarPaginas() {
    document.body.innerHTML = `
      <h1 id="pageTitle"></h1><p id="pageSubtitle"></p>
      <main id="conteudoPrincipal"><div class="content">
        <section id="page-dashboard" class="page"></section>
        <section id="page-nucleo" class="page"></section>
        <section id="page-calendario" class="page"></section>
      </div></main>`;
  }

  async function usarCatalogo(fora = []) {
    await carregarCatalogoDeAbas({
      consulta: Promise.resolve({ data: catalogo(fora), error: null }),
    });
  }

  function criar({ trabalho = () => false } = {}) {
    const janela = {
      nucleoController: { render: vi.fn() },
      calendarioEditaisController: { render: vi.fn() },
      location: { reload: vi.fn() },
    };
    const navegacao = criarNavegacao({
      janela,
      obterPerfil: () => PERFIL,
      paineis: {
        podeAbrir: () => false,
        primeiro: () => null,
        doMenu: () => [],
        mostrar: vi.fn(),
        esquecerAtual: vi.fn(),
      },
      confirmarSaida: () => true,
      aplicarAtualizacao: () => false,
      temTrabalhoNaoSalvo: trabalho,
    });
    return { navegacao, janela };
  }

  const aviso = () => document.getElementById("page-manutencao");
  const ativas = () =>
    [...document.querySelectorAll(".page.active")].map((pagina) => pagina.id);
  const viewsDoMenu = (area) =>
    obterEstadoDaBarraLateral()
      .arvore.find((grupo) => grupo.id === area)
      ?.itens.map((item) => item.view) ?? [];

  beforeEach(async () => {
    localStorage.clear();
    montarPaginas();
    definirAreasDoUsuario(PERFIL.areas);
    definirAreaAtual("sede");
    await carregarSituacaoDoSistema({
      consulta: Promise.resolve({
        data: { sistema: {}, areas: [] },
        error: null,
      }),
    });
    await usarCatalogo();
  });
  afterEach(async () => {
    await carregarCatalogoDeAbas({
      consulta: Promise.resolve({ data: null, error: null }),
    });
    esquecerSituacaoDoSistema(document);
    redefinirDadosDoMonitoramento();
    redefinirBarraLateral();
    redefinirPaginaDaAya();
    document.body.innerHTML = "";
  });

  it("desligada no meio da sessão: menu sem ela, aviso no lugar e a tela não é chamada de novo", async () => {
    const { navegacao, janela } = criar();
    navegacao.montarMenu();
    navegacao.irPara("nucleo");
    expect(ativas()).toEqual(["page-nucleo"]);
    expect(janela.nucleoController.render).toHaveBeenCalledTimes(1);

    // O vigia releu o catálogo: Editais saiu da SEDE.
    await usarCatalogo(["editais@sede"]);
    navegacao.montarMenu();
    navegacao.reavaliarTelaAtual();

    expect(viewsDoMenu("sede")).not.toContain("nucleo");
    expect(ativas()).toEqual(["page-manutencao"]);
    expect(aviso().textContent).toContain(
      "Esta página foi desativada pela coordenação.",
    );
    expect(document.getElementById("pageTitle").textContent).toBe(
      "Página desativada",
    );
    expect(janela.nucleoController.render).toHaveBeenCalledTimes(1);
    // As próximas checagens não mexem em nada.
    navegacao.reavaliarTelaAtual();
    expect(janela.nucleoController.render).toHaveBeenCalledTimes(1);

    // O botão leva à primeira página ligada da área.
    const botao = aviso().querySelector("button");
    expect(botao.hidden).toBe(false);
    expect(botao.textContent).toBe("Ir para a página inicial");
    botao.click();
    expect(navegacao.obter().view).toBe("dashboard");
    expect(ativas()).toEqual(["page-dashboard"]);
  });

  it("religada: o menu volta sozinho; o aviso fica até a pessoa escolher", async () => {
    const { navegacao, janela } = criar();
    navegacao.montarMenu();
    navegacao.irPara("nucleo");
    await usarCatalogo(["editais@sede"]);
    navegacao.montarMenu();
    navegacao.reavaliarTelaAtual();
    expect(ativas()).toEqual(["page-manutencao"]);

    await usarCatalogo();
    navegacao.montarMenu();
    navegacao.reavaliarTelaAtual();
    expect(viewsDoMenu("sede")).toContain("nucleo");
    expect(ativas()).toEqual(["page-manutencao"]);
    navegacao.irPara("nucleo");
    expect(ativas()).toEqual(["page-nucleo"]);
    expect(janela.nucleoController.render).toHaveBeenCalledTimes(2);
  });

  it("com trabalho não salvo, só a faixa; fecha na checagem depois de salvo", async () => {
    let pendente = true;
    const { navegacao } = criar({ trabalho: () => pendente });
    navegacao.montarMenu();
    navegacao.irPara("nucleo");
    await usarCatalogo(["editais@sede"]);
    navegacao.montarMenu();
    navegacao.reavaliarTelaAtual();

    expect(ativas()).toEqual(["page-nucleo"]);
    const faixa = document.getElementById("faixaDeManutencao");
    expect(faixa.hidden).toBe(false);
    expect(faixa.textContent).toContain(
      "Esta página foi desativada pela coordenação. Salve",
    );

    pendente = false;
    navegacao.reavaliarTelaAtual();
    expect(ativas()).toEqual(["page-manutencao"]);
    expect(faixa.hidden).toBe(true);
  });

  it("a tela guardada desligada não reabre na entrada", async () => {
    const { navegacao } = criar();
    navegacao.guardarTela("nucleo");
    await usarCatalogo(["editais@sede"]);
    navegacao.montarMenu();
    expect(navegacao.telaDeEntrada()).toBe("dashboard");
  });

  /*
    A tela inicial respeita o catálogo: o grupo Avaliador tem a Visão geral
    (dashboard leitor), mas, com ela desligada na área, entra direto na
    primeira página ligada que pode abrir — sem montar a Visão geral nem ler
    as linhas do monitoramento.
  */
  describe("tela inicial com a Visão geral desligada", () => {
    const avaliador = (areas = ["saude-indigena"]) => ({
      id: "a",
      ativo: true,
      permissoes: { dashboard: "leitor", avaliacao_documental: "editor" },
      areas,
    });

    function criarAvaliador(perfil = avaliador()) {
      document
        .querySelector(".content")
        .insertAdjacentHTML(
          "beforeend",
          '<section id="page-avaliacao-documental" class="page"></section>',
        );
      const janela = {
        avaliacaoDocumentalController: { render: vi.fn() },
        location: { reload: vi.fn() },
      };
      const navegacao = criarNavegacao({
        janela,
        obterPerfil: () => perfil,
        paineis: {
          podeAbrir: () => false,
          primeiro: () => null,
          doMenu: () => [],
          mostrar: vi.fn(),
          esquecerAtual: vi.fn(),
        },
        confirmarSaida: () => true,
        aplicarAtualizacao: () => false,
      });
      return { navegacao, janela };
    }

    beforeEach(() => {
      definirAreasDoUsuario(["saude-indigena"]);
      definirAreaAtual("saude-indigena");
    });

    // A Triagem (mesmo recurso, antes da Avaliação documental no menu) fica
    // desligada aqui para a primeira página ligada ser a Avaliação documental.
    it("sem tela guardada, entra na primeira página ligada (Avaliação documental)", async () => {
      await usarCatalogo([
        "visao-geral@saude-indigena",
        "pre-classificacao@saude-indigena",
      ]);
      const { navegacao, janela } = criarAvaliador();
      navegacao.montarMenu();
      expect(navegacao.telaDeEntrada()).toBe("avaliacao-documental");
      navegacao.irPara(navegacao.telaDeEntrada());
      expect(ativas()).toEqual(["page-avaliacao-documental"]);
      expect(janela.avaliacaoDocumentalController.render).toHaveBeenCalled();
    });

    it("a inicial do sistema (sair do painel externo) também", async () => {
      await usarCatalogo([
        "visao-geral@saude-indigena",
        "pre-classificacao@saude-indigena",
      ]);
      const { navegacao } = criarAvaliador();
      navegacao.montarMenu();
      expect(navegacao.telaInicialDoSistema()).toBe("avaliacao-documental");
    });

    it("ligada, a Visão geral continua sendo a inicial", () => {
      const { navegacao } = criarAvaliador();
      navegacao.montarMenu();
      expect(navegacao.telaDeEntrada()).toBe("dashboard");
      expect(navegacao.telaInicialDoSistema()).toBe("dashboard");
    });

    it("sem página ligada na área atual, a de outra área — e ela vira a atual", async () => {
      await usarCatalogo([
        "visao-geral@saude-indigena",
        "avaliacao-documental@saude-indigena",
        "pre-classificacao@saude-indigena",
        "pre-classificacao@sede",
      ]);
      const { navegacao } = criarAvaliador(
        avaliador(["saude-indigena", "sede"]),
      );
      navegacao.montarMenu();
      expect(obterDadosDoMonitoramento().areaAtual).toBe("saude-indigena");
      expect(navegacao.telaDeEntrada()).toBe("avaliacao-documental");
      expect(obterDadosDoMonitoramento().areaAtual).toBe("sede");
    });
  });

  it("abrir por link ou busca uma página desligada mostra o aviso", async () => {
    const { navegacao, janela } = criar();
    await usarCatalogo(["editais@sede"]);
    navegacao.montarMenu();
    navegacao.irPara("nucleo");
    expect(ativas()).toEqual(["page-manutencao"]);
    expect(janela.nucleoController.render).not.toHaveBeenCalled();
  });

  it("aba em manutenção no meio da sessão: o aviso de manutenção, com o botão", async () => {
    const { navegacao } = criar();
    navegacao.montarMenu();
    navegacao.irPara("nucleo");
    const comManutencao = catalogo().map((linha) =>
      linha.co_aba === "editais"
        ? { ...linha, tp_situacao: "MANUTENCAO", ds_mensagem: "Volta já" }
        : linha,
    );
    await carregarCatalogoDeAbas({
      consulta: Promise.resolve({ data: comManutencao, error: null }),
    });
    navegacao.montarMenu();
    navegacao.reavaliarTelaAtual();
    expect(ativas()).toEqual(["page-manutencao"]);
    expect(aviso().textContent).toContain("Volta já");
    expect(aviso().querySelector("button").hidden).toBe(false);
  });
});
