import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CHAVE_DA_ROTA_PEDIDA,
  TEXTO_ROTA_DESCONHECIDA,
  criarNavegacao,
} from "../../src/app/navegacao.ts";
import { criarPresenca } from "../../src/app/presenca.ts";
import {
  carregarTela,
  registrarTelas,
} from "../../src/app/registro-das-telas.ts";
import { CHAVE_DA_TELA_GUARDADA } from "../../src/lib/navegacao";
import { TELAS_DAS_AREAS } from "../../src/lib/rotas.ts";
import {
  definirAreaAtual,
  obterDadosDoMonitoramento,
  redefinirDadosDoMonitoramento,
} from "../../src/componentes/dados-do-monitoramento.ts";
import {
  obterEstadoDaBarraLateral,
  redefinirBarraLateral,
} from "../../src/componentes/barra-lateral/estado.ts";
import {
  obterPaginaDaAya,
  redefinirPaginaDaAya,
} from "../../src/modulos/aya/estado.ts";
import { comAct, montarTelasNoTeste } from "./telas-no-teste.js";

/*
  A navegação do app (src/app/navegacao.ts) com as telas como rotas
  (src/app/telas.tsx): troca de tela, título, menu, permissões, guarda de
  saída, versão nova esperando, painel externo, o endereço (link direto,
  voltar/avançar, área na URL) e os avisos para quem acompanha (auditoria e
  presença, uma vez por navegação).
*/

const EDITAL = "0b7c9a52-2d55-4c4e-9f7a-1c3d5e7f9a1b";
const GESTOR = {
  id: "g",
  ativo: true,
  perfil: "edital_gestor",
  areas: ["saude-indigena", "sede"],
};
const SO_EDITAIS = { id: "e", ativo: true, permissoes: { nucleo: "leitor" } };

let montado = null;

function telasFalsas() {
  return {
    dashboard: { render: vi.fn() },
    nucleo: { render: vi.fn() },
    calendario: { render: vi.fn() },
    recursos: { render: vi.fn() },
    classificacao: { render: vi.fn(), abrirEdital: vi.fn() },
    "conduzir-entrevistas": {
      render: vi.fn(),
      abrirVisao: vi.fn(),
      abrirEdital: vi.fn(),
    },
  };
}

function criar(opcoes = {}, { telas = telasFalsas(), menu = true } = {}) {
  const janela = { location: { reload: vi.fn() } };
  const paineis = {
    podeAbrir: (codigo) => codigo === "bi",
    primeiro: () => ({ codigo: "bi" }),
    doMenu: () => [],
    mostrar: vi.fn(() => ({ titulo: "BI RH" })),
    esquecerAtual: vi.fn(),
  };
  const avisar = vi.fn();
  const crua = criarNavegacao({
    janela,
    obterPerfil: () => GESTOR,
    paineis,
    avisar,
    configuracao: (chave) =>
      ({ nucleo_page_subtitle: "Editais da área" })[chave] || "",
    confirmarSaida: () => true,
    aplicarAtualizacao: () => false,
    ...opcoes,
  });
  montado = montarTelasNoTeste(crua, telas, { avisar });
  const { navegacao } = montado;
  if (menu) navegacao.montarMenu();
  return { navegacao, janela, paineis, avisar, telas };
}

/* O sistema aberto (a entrada já passou): o endereço passa a trocar a tela. */
function entrar(navegacao) {
  navegacao.abrirEntrada();
}

const ativas = () =>
  [...document.querySelectorAll(".page.active")].map((pagina) => pagina.id);
const endereco = () => location.pathname + location.search;
const $ = (id) => document.getElementById(id);

/* Voltar/avançar do navegador: o jsdom avisa o popstate depois. */
async function noHistorico(passo) {
  await act(async () => {
    const mudou = new Promise((resolver) =>
      addEventListener("popstate", resolver, { once: true }),
    );
    history.go(passo);
    await mudou;
  });
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  document.body.className = "";
  document.body.innerHTML = '<main id="conteudoPrincipal"></main>';
});
afterEach(() => {
  montado?.desmontar();
  montado = null;
  redefinirDadosDoMonitoramento();
  redefinirBarraLateral();
  redefinirPaginaDaAya();
  document.body.innerHTML = "";
});

describe("troca de tela", () => {
  it("deixa só a página pedida ativa, com título, menu, endereço e render da tela", () => {
    const { navegacao, telas } = criar();
    entrar(navegacao);
    navegacao.irPara("recursos");
    expect(ativas()).toEqual(["page-recursos"]);
    expect($("pageTitle").textContent).toBe("Painel de recursos");
    expect($("pageSubtitle").textContent).toBe("Saúde Indígena");
    expect(telas.recursos.render).toHaveBeenCalledTimes(1);
    expect(navegacao.obter().view).toBe("recursos");
    expect(obterEstadoDaBarraLateral().ativo.view).toBe("recursos");
    expect(localStorage.getItem(CHAVE_DA_TELA_GUARDADA)).toBe("recursos");
    expect(endereco()).toBe("/saude-indigena/painel-de-recursos");
    expect(obterPaginaDaAya()).toMatchObject({
      view: "recursos",
      titulo: "Painel de recursos",
    });
  });

  it("render que falha vira aviso amigável, sem rejeição solta", async () => {
    const telas = telasFalsas();
    telas.recursos.render.mockRejectedValue(new Error("tabela fora do ar"));
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    const { navegacao, avisar } = criar({}, { telas });
    navegacao.irPara("recursos");
    await vi.waitFor(() =>
      expect(avisar).toHaveBeenCalledWith(
        "Não foi possível abrir Painel de recursos: tabela fora do ar",
        "error",
      ),
    );
    expect(navegacao.obter().view).toBe("recursos");
    erro.mockRestore();
  });

  it("reabrir a mesma tela chama o render de novo (Atualizar dados)", () => {
    const { navegacao, telas } = criar();
    navegacao.irPara("nucleo");
    navegacao.reabrir();
    expect(telas.nucleo.render).toHaveBeenCalledTimes(2);
  });

  it("o subtítulo das telas das áreas vem depois da área", () => {
    const { navegacao } = criar();
    navegacao.irPara("nucleo");
    expect($("pageSubtitle").textContent).toBe(
      "Saúde Indígena · Editais da área",
    );
  });

  it("toda tela das áreas tem título e caminho próprio", () => {
    const caminhos = TELAS_DAS_AREAS.map((tela) => tela.caminho);
    expect(new Set(caminhos).size).toBe(caminhos.length);
    for (const tela of TELAS_DAS_AREAS)
      expect(tela.titulo, tela.view).toBeTruthy();
  });

  it("sem view, abre a tela de entrada (a guardada, se permitida)", () => {
    localStorage.setItem(CHAVE_DA_TELA_GUARDADA, "nucleo");
    const { navegacao } = criar();
    expect(navegacao.telaDeEntrada()).toBe("nucleo");
    navegacao.irPara("");
    expect(ativas()).toEqual(["page-nucleo"]);
  });

  it("sem permissão, avisa e fica onde está (e o endereço também)", () => {
    const { navegacao, avisar } = criar({ obterPerfil: () => SO_EDITAIS });
    navegacao.irPara("nucleo");
    const antes = endereco();
    navegacao.irPara("config");
    expect(avisar).toHaveBeenCalledWith(
      "Sem permissão para Configurações.",
      "warn",
    );
    expect(ativas()).toEqual(["page-nucleo"]);
    expect(navegacao.obter().view).toBe("nucleo");
    expect(endereco()).toBe(antes);
  });

  it("sem módulo liberado, mostra o aviso de sem acesso", () => {
    const { navegacao } = criar();
    navegacao.irPara("sem-acesso");
    expect(ativas()).toEqual(["page-sem-acesso"]);
    expect($("page-sem-acesso").textContent).toContain(
      "não tem módulos liberados",
    );
    expect($("pageTitle").textContent).toBe("Acesso aos módulos");
    expect(endereco()).toBe("/sem-acesso");
  });
});

describe("guarda de saída e versão nova", () => {
  it("alteração não salva confirmada como não: não sai da tela", () => {
    const confirmarSaida = vi.fn(() => false);
    const { navegacao } = criar({ confirmarSaida });
    expect(navegacao.irPara("dashboard")).toBe(true);
    confirmarSaida.mockClear();
    // Recusada: devolve false (quem trocou a área antes a desfaz).
    expect(navegacao.irPara("recursos")).toBe(false);
    expect(confirmarSaida).toHaveBeenCalledTimes(1);
    expect(navegacao.obter().view).toBe("dashboard");
  });

  it("reabrir a mesma tela não pergunta", () => {
    const confirmarSaida = vi.fn(() => false);
    const { navegacao } = criar({ confirmarSaida });
    navegacao.irPara("dashboard");
    expect(confirmarSaida).not.toHaveBeenCalled();
  });

  it("a guarda padrão consulta Acessos e Módulos já baixados (antes da carga, deixam sair)", async () => {
    const confirmarSaida = vi.fn(() => false);
    registrarTelas({
      "secao:acessos": {
        carregar: async () => ({
          conteudo: null,
          nome: "Acessos",
          render() {},
          confirmarSaida,
        }),
      },
      "secao:modulos": {
        carregar: async () => ({
          conteudo: null,
          nome: "Módulos",
          render() {},
          confirmarSaida: () => true,
        }),
      },
    });
    const navegacao = comAct(
      criarNavegacao({
        janela: { location: { reload: vi.fn() } },
        obterPerfil: () => GESTOR,
        aplicarAtualizacao: () => false,
      }),
    );
    // Antes da carga, nada aberto, nada a perder.
    expect(navegacao.irPara("nucleo")).toBe(true);
    await carregarTela("secao:acessos");
    expect(navegacao.irPara("dashboard")).toBe(false);
    expect(confirmarSaida).toHaveBeenCalled();
    expect(navegacao.obter().view).toBe("nucleo");
    navegacao.desligar();
    registrarTelas({});
  });

  it("versão nova esperando: guarda a tela pedida, vai ao endereço dela e recarrega", () => {
    const { navegacao, janela } = criar({
      aplicarAtualizacao: (recarregar) => {
        recarregar();
        return true;
      },
    });
    navegacao.irPara("nucleo");
    expect(localStorage.getItem(CHAVE_DA_TELA_GUARDADA)).toBe("nucleo");
    expect(endereco()).toBe("/saude-indigena/editais");
    expect(janela.location.reload).toHaveBeenCalled();
    expect(ativas()).toEqual(["page-dashboard"]);
  });

  it("versão nova esperando com rascunho ainda não guardado: não recarrega e troca de tela", () => {
    const aplicarAtualizacao = vi.fn(() => true);
    const { navegacao, janela } = criar({
      aplicarAtualizacao,
      podeRecarregar: () => false,
    });
    navegacao.irPara("nucleo");
    expect(aplicarAtualizacao).not.toHaveBeenCalled();
    expect(janela.location.reload).not.toHaveBeenCalled();
    expect(navegacao.obter().view).toBe("nucleo");
  });
});

describe("painel externo", () => {
  it("abre pelo dono dos painéis, no endereço /paineis/<código>; outra tela esquece o painel", () => {
    const { navegacao, paineis } = criar();
    navegacao.irPara("panel:bi");
    expect(paineis.mostrar).toHaveBeenCalledWith("bi");
    expect(ativas()).toEqual(["page-external"]);
    expect(endereco()).toBe("/paineis/bi");
    expect(paineis.esquecerAtual).not.toHaveBeenCalled();
    navegacao.irPara("nucleo");
    expect(paineis.esquecerAtual).toHaveBeenCalled();
    expect(ativas()).toEqual(["page-nucleo"]);
  });

  it("tira o modo de painel externo ao trocar de tela", () => {
    const { navegacao } = criar();
    document.body.classList.add("external-panel-mode", "external-clean");
    navegacao.irPara("nucleo");
    expect(document.body.classList.contains("external-panel-mode")).toBe(false);
    expect(document.body.classList.contains("external-clean")).toBe(false);
  });
});

describe("o endereço (rotas)", () => {
  it("link direto: entra na tela e na área do endereço", () => {
    history.replaceState(null, "", "/sede/cronograma");
    const { navegacao, telas } = criar();
    entrar(navegacao);
    expect(ativas()).toEqual(["page-calendario"]);
    expect(obterDadosDoMonitoramento().areaAtual).toBe("sede");
    expect($("pageSubtitle").textContent).toContain("SEDE");
    expect(telas.calendario.render).toHaveBeenCalledTimes(1);
    expect(endereco()).toBe("/sede/cronograma");
  });

  it("link direto guardado antes de entrar (volta do Google em /?auth=google)", () => {
    history.replaceState(null, "", "/sede/editais");
    criarNavegacao({ obterPerfil: () => null }).desligar();
    expect(sessionStorage.getItem(CHAVE_DA_ROTA_PEDIDA)).toBe("/sede/editais");
    history.replaceState(null, "", "/?auth=google");
    const { navegacao } = criar();
    entrar(navegacao);
    expect(ativas()).toEqual(["page-nucleo"]);
    expect(endereco()).toBe("/sede/editais");
    expect(sessionStorage.getItem(CHAVE_DA_ROTA_PEDIDA)).toBeNull();
  });

  it("link para tela proibida: avisa e abre a tela de entrada no lugar (sem empilhar)", () => {
    history.replaceState(null, "", "/administracao/configuracoes/acessos");
    const tamanho = history.length;
    const { navegacao, avisar } = criar({ obterPerfil: () => SO_EDITAIS });
    entrar(navegacao);
    expect(avisar).toHaveBeenCalledWith(
      "Sem permissão para Configurações.",
      "warn",
    );
    expect(ativas()).toEqual(["page-nucleo"]);
    expect(endereco()).toBe("/saude-indigena/editais");
    expect(history.length).toBe(tamanho);
  });

  it("endereço que não é tela: avisa e abre a tela de entrada", () => {
    history.replaceState(null, "", "/sede/nao-existe");
    const { navegacao, avisar } = criar();
    entrar(navegacao);
    expect(avisar).toHaveBeenCalledWith(TEXTO_ROTA_DESCONHECIDA, "warn");
    expect(ativas()).toEqual(["page-dashboard"]);
    expect(endereco()).toBe("/saude-indigena/visao-geral");
  });

  it("área do endereço que não é da pessoa: fica a área dela", () => {
    history.replaceState(null, "", "/projetos/editais");
    const { navegacao } = criar();
    entrar(navegacao);
    expect(ativas()).toEqual(["page-nucleo"]);
    expect(obterDadosDoMonitoramento().areaAtual).toBe("saude-indigena");
    expect(endereco()).toBe("/saude-indigena/editais");
  });

  it("link com edital: a tela abre e então recebe o edital; o endereço volta a ser o da tela", async () => {
    history.replaceState(null, "", `/saude-indigena/classificacao/${EDITAL}`);
    const { navegacao, telas } = criar();
    entrar(navegacao);
    expect(telas.classificacao.render).toHaveBeenCalledTimes(1);
    await vi.waitFor(() =>
      expect(telas.classificacao.abrirEdital).toHaveBeenCalledWith(EDITAL),
    );
    expect(endereco()).toBe("/saude-indigena/classificacao");
  });

  it('o edital do "Ir para…" vai no endereço e chega na tela', async () => {
    const { navegacao, telas } = criar();
    entrar(navegacao);
    navegacao.irPara("conduzir-entrevistas", { edital: EDITAL });
    await vi.waitFor(() =>
      expect(telas["conduzir-entrevistas"].abrirEdital).toHaveBeenCalledWith(
        EDITAL,
      ),
    );
  });

  it("link antigo com visão (entrevistas:conduzir): a visão chega na tela", () => {
    const { navegacao, telas } = criar();
    navegacao.irPara("entrevistas:conduzir");
    expect(telas["conduzir-entrevistas"].abrirVisao).toHaveBeenCalledWith(
      "fila",
    );
    expect(endereco()).toBe("/saude-indigena/entrevistas");
  });

  it("voltar e avançar do navegador trocam a tela (e o render roda de novo)", async () => {
    const { navegacao, telas } = criar();
    entrar(navegacao);
    navegacao.irPara("nucleo");
    navegacao.irPara("recursos");
    expect(endereco()).toBe("/saude-indigena/painel-de-recursos");

    await noHistorico(-1);
    expect(ativas()).toEqual(["page-nucleo"]);
    expect(navegacao.obter().view).toBe("nucleo");
    expect(telas.nucleo.render).toHaveBeenCalledTimes(2);

    await noHistorico(1);
    expect(ativas()).toEqual(["page-recursos"]);
    expect(telas.recursos.render).toHaveBeenCalledTimes(2);
  });

  it("voltar troca a área junto (Editais da SEDE → da Saúde Indígena)", async () => {
    const { navegacao } = criar();
    entrar(navegacao);
    navegacao.irPara("nucleo");
    act(() => definirAreaAtual("sede"));
    navegacao.irPara("nucleo");
    expect(endereco()).toBe("/sede/editais");
    await noHistorico(-1);
    expect(obterDadosDoMonitoramento().areaAtual).toBe("saude-indigena");
    expect($("pageSubtitle").textContent).toContain("Saúde Indígena");
  });

  it("voltar com alteração não salva recusada: fica na tela e o endereço volta", async () => {
    let podeSair = true;
    const { navegacao } = criar({ confirmarSaida: () => podeSair });
    entrar(navegacao);
    navegacao.irPara("nucleo");
    navegacao.irPara("recursos");
    podeSair = false;
    await noHistorico(-1);
    expect(ativas()).toEqual(["page-recursos"]);
    expect(endereco()).toBe("/saude-indigena/painel-de-recursos");
  });

  it("entrada do histórico com o mesmo endereço (marca das Regras do edital) não reabre", async () => {
    const { navegacao, telas } = criar();
    entrar(navegacao);
    navegacao.irPara("nucleo");
    history.pushState({ monitoraRegrasDoEdital: { id: "e1" } }, "");
    await noHistorico(-1);
    expect(telas.nucleo.render).toHaveBeenCalledTimes(1);
  });

  it("fora do sistema (tela de acesso), voltar não abre tela", async () => {
    const { navegacao, telas, avisar } = criar();
    entrar(navegacao);
    navegacao.irPara("nucleo");
    navegacao.irPara("recursos");
    navegacao.fechar();
    await noHistorico(-1);
    expect(navegacao.obter().view).toBe("recursos");
    expect(telas.nucleo.render).toHaveBeenCalledTimes(1);
    expect(avisar).not.toHaveBeenCalled();
  });
});

describe("quem acompanha a navegação", () => {
  it("recebe uma abertura por tela (com a anterior)", () => {
    const { navegacao } = criar();
    const eventos = [];
    navegacao.assinar((evento) => eventos.push(evento));
    navegacao.irPara("nucleo");
    navegacao.irPara("recursos");
    expect(eventos.filter((e) => e.tipo === "abertura")).toEqual([
      { tipo: "abertura", view: "nucleo", anterior: "dashboard" },
      { tipo: "abertura", view: "recursos", anterior: "nucleo" },
    ]);
    // Trocar de tela não manda "menu" à parte (era o registro em dobro).
    expect(eventos.some((e) => e.tipo === "menu")).toBe(false);
  });

  it("a troca de área refaz o cabeçalho da Visão geral", () => {
    const { navegacao } = criar();
    const parar = navegacao.acompanharArea();
    navegacao.irPara("dashboard");
    const antes = $("pageTitle").textContent;
    act(() => definirAreaAtual("sede"));
    expect($("pageTitle").textContent).not.toBe(antes);
    parar();
  });

  it("a presença registra a navegação uma vez por troca de tela", async () => {
    const { navegacao } = criar();
    const cliente = {
      rpc: vi.fn(async () => ({ data: { status: "OK" }, error: null })),
    };
    const presenca = criarPresenca({
      cliente: () => cliente,
      agente: () => "teste",
      obterUsuario: () => ({ id: "u1" }),
      obterPerfil: () => GESTOR,
      configuracao: { inteiro: () => 2, versao: () => "V9" },
      navegacao,
      local: (view) => `lugar ${view}`,
    });
    const parar = presenca.acompanhar();
    presenca.iniciar();
    await vi.waitFor(() => expect(cliente.rpc).toHaveBeenCalled());
    const daNavegacao = () =>
      cliente.rpc.mock.calls.filter(
        ([nome, args]) =>
          nome === "registrar_navegacao_monitora" &&
          args.p_evento === "abertura_tela",
      );
    // Toda chamada de registrar_navegacao_monitora (evento ou só presença).
    const registros = () =>
      cliente.rpc.mock.calls.filter(
        ([nome]) => nome === "registrar_navegacao_monitora",
      ).length;
    const antes = registros();
    navegacao.irPara("nucleo");
    await act(async () => {});
    expect(daNavegacao()).toHaveLength(1);
    expect(registros() - antes).toBe(1);
    navegacao.irPara("recursos");
    await act(async () => {});
    expect(daNavegacao()).toHaveLength(2);
    expect(daNavegacao()[1][1]).toMatchObject({ p_tela: "recursos" });
    expect(registros() - antes).toBe(2);
    parar();
    presenca.pararTudo();
  });
});

describe("telas sob demanda", () => {
  it('"Carregando…" enquanto baixa; a falha mostra "Tentar de novo", que baixa de novo e abre', async () => {
    const render = vi.fn();
    let tentativas = 0;
    let falhar = () => {};
    const crua = criarNavegacao({
      obterPerfil: () => GESTOR,
      confirmarSaida: () => true,
      aplicarAtualizacao: () => false,
    });
    montado = montarTelasNoTeste(crua, {});
    act(() =>
      registrarTelas({
        recursos: {
          carregar: () => {
            tentativas += 1;
            if (tentativas === 1)
              return new Promise((_, rejeitar) => {
                falhar = () => rejeitar(new Error("rede caída"));
              });
            return Promise.resolve({
              nome: "o painel de recursos",
              conteudo: "Painel carregado",
              render,
            });
          },
        },
      }),
    );
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    montado.navegacao.irPara("recursos");
    expect($("page-recursos").textContent).toBe("Carregando…");
    await act(async () => falhar());
    expect($("page-recursos").textContent).toContain(
      "Não foi possível carregar esta tela.",
    );
    const botao = $("page-recursos").querySelector("button");
    expect(botao.textContent).toBe("Tentar de novo");
    await act(async () => botao.click());
    await vi.waitFor(() =>
      expect($("page-recursos").textContent).toBe("Painel carregado"),
    );
    expect(tentativas).toBe(2);
    expect(render).toHaveBeenCalledTimes(1);
    erro.mockRestore();
  });
});
