import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { criarCarga } from "../../src/app/carga.ts";
import { acompanharPaginaAberta } from "../../src/app/pagina-aberta.ts";
import {
  linhasPedidas,
  obterDadosDoMonitoramento,
  redefinirDadosDoMonitoramento,
} from "../../src/componentes/dados-do-monitoramento.ts";
import {
  TELAS_COM_LINHAS,
  telaUsaAsLinhas,
} from "../../src/lib/telas-com-linhas.ts";
import {
  buscarAcompanhamentoNoSupabase,
  criarEstadoDaVisaoGeral,
} from "../../src/modulos/visao-geral/estado.ts";

/*
  A página aberta decide o que se carrega (src/app/pagina-aberta.ts): as
  linhas do monitoramento só para as páginas que as usam
  (src/lib/telas-com-linhas.ts) e o acompanhamento da Visão geral só com ela
  aberta. Em 19/10/2026 o Supabase NANO saturou com ~10 avaliadores que
  entravam direto na Avaliação documental e, mesmo assim, liam tudo isso.
*/

function navegacaoFalsa(telaDeEntrada) {
  const ouvintes = new Set();
  let view = "";
  const avisarTodos = (evento) =>
    ouvintes.forEach((ouvinte) => ouvinte(evento));
  return {
    obter: () => ({ view }),
    assinar(ouvinte) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
    montarMenu: vi.fn(),
    telaDeEntrada: () => telaDeEntrada,
    telaPermitida: () => true,
    irPara: vi.fn((tela) => {
      const anterior = view;
      view = tela;
      avisarTodos({ tipo: "abertura", view: tela, anterior });
    }),
    mostrarAviso(tela) {
      view = tela;
      avisarTodos({ tipo: "aviso", view: tela });
    },
  };
}

describe("as páginas que usam as linhas", () => {
  it("Visão geral, Editais, Cronograma e Lista de aprovados; não a Avaliação documental", () => {
    expect([...TELAS_COM_LINHAS].sort()).toEqual(
      ["approved", "calendario", "dashboard", "nucleo"].sort(),
    );
    for (const view of [
      "avaliacao-documental",
      "analises",
      "recursos",
      "entrevistas",
      "classificacao",
      "selecao",
      "config",
      "panel:bi",
      "",
      null,
    ])
      expect(telaUsaAsLinhas(view)).toBe(false);
  });
});

describe("acompanharPaginaAberta", () => {
  function montar() {
    const navegacao = navegacaoFalsa("nucleo");
    const devolver = vi.fn();
    const pedirLinhas = vi.fn(() => devolver);
    const visaoGeral = { definirAberta: vi.fn() };
    const parar = acompanharPaginaAberta({
      navegacao,
      pedirLinhas,
      visaoGeral,
    });
    return { navegacao, pedirLinhas, devolver, visaoGeral, parar };
  }

  it("um pedido de linhas enquanto a página aberta as usa; devolve ao sair dela", () => {
    const { navegacao, pedirLinhas, devolver } = montar();
    navegacao.irPara("dashboard");
    navegacao.irPara("nucleo");
    navegacao.irPara("calendario");
    expect(pedirLinhas).toHaveBeenCalledTimes(1);
    expect(devolver).not.toHaveBeenCalled();
    navegacao.irPara("avaliacao-documental");
    expect(devolver).toHaveBeenCalledTimes(1);
    navegacao.irPara("approved");
    expect(pedirLinhas).toHaveBeenCalledTimes(2);
  });

  it("aviso no lugar da página (desligada, manutenção) devolve o pedido", () => {
    const { navegacao, devolver, visaoGeral } = montar();
    navegacao.irPara("dashboard");
    navegacao.mostrarAviso("dashboard");
    expect(devolver).toHaveBeenCalledTimes(1);
    expect(visaoGeral.definirAberta).toHaveBeenLastCalledWith(false);
  });

  it("a Visão geral sabe se está aberta", () => {
    const { navegacao, visaoGeral } = montar();
    navegacao.irPara("dashboard");
    expect(visaoGeral.definirAberta).toHaveBeenLastCalledWith(true);
    navegacao.irPara("nucleo");
    expect(visaoGeral.definirAberta).toHaveBeenLastCalledWith(false);
  });

  it("parar devolve o pedido e fecha a Visão geral", () => {
    const { navegacao, devolver, visaoGeral, parar } = montar();
    navegacao.irPara("dashboard");
    parar();
    expect(devolver).toHaveBeenCalledTimes(1);
    expect(visaoGeral.definirAberta).toHaveBeenLastCalledWith(false);
    navegacao.irPara("nucleo");
    expect(visaoGeral.definirAberta).toHaveBeenCalledTimes(2);
  });
});

/*
  MEDIÇÃO: as chamadas ao banco de quem entra, com cliente falso, na carga de
  verdade (src/app/carga.ts), a página aberta de verdade e o estado da Visão
  geral de verdade (montado escondido, como no app).

  ANTES (main de 19/10/2026), um avaliador entrando direto na Avaliação
  documental fazia 8 chamadas, mais o canal do Realtime: TB_CONFIGURACAO,
  TB_PAINEL_EXTERNO, TD_UNIDADE, listar_mapa_da_saude_indigena,
  listar_abas_do_menu, obter_situacao_do_sistema,
  listar_monitoramento_operacional (~0,8 s) e
  listar_acompanhamento_da_visao_geral_se_mudou (a Visão geral escondida, a
  cada carga das linhas) — e, com as comemorações ligadas, obter_marcos_da_area;
  cada mudança de edital (Realtime) relia as linhas e o acompanhamento.
  DEPOIS: as 6 primeiras e nenhum canal. Fora da carga, as da própria
  Avaliação documental e a presença, iguais nos dois casos.
*/
describe("entrada: chamadas ao banco", () => {
  const LINHAS = [{ id: 1, unidade: "DSEI Xingu", CO_AREA: "saude-indigena" }];
  let carga;
  let parar;

  function montar(telaDeEntrada) {
    const chamadas = [];
    const consulta = (nome, data) => {
      const pedido = {
        then(resolver, rejeitar) {
          chamadas.push(nome);
          return Promise.resolve({ data, error: null }).then(
            resolver,
            rejeitar,
          );
        },
      };
      const encadear = () => pedido;
      Object.assign(pedido, {
        select: encadear,
        eq: encadear,
        order: encadear,
      });
      return pedido;
    };
    const cliente = {
      from: (tabela) => consulta(tabela, []),
      rpc: vi.fn(async (nome) => {
        chamadas.push(nome);
        if (nome === "listar_monitoramento_operacional")
          return { data: { versao: "v", linhas: LINHAS }, error: null };
        if (nome === "listar_mapa_da_saude_indigena")
          return { data: { versao: "m", linhas: [] }, error: null };
        if (nome === "obter_inicio_da_sessao")
          return {
            data: {
              configuracao: [],
              paineis: [],
              abas: null,
              situacao: null,
              unidades: [],
            },
            error: null,
          };
        return { data: null, error: null };
      }),
      channel: vi.fn(() => {
        const canal = { on: () => canal, subscribe: () => canal };
        return canal;
      }),
      removeChannel: vi.fn(),
    };
    const navegacao = navegacaoFalsa(telaDeEntrada);
    const visaoGeral = criarEstadoDaVisaoGeral({
      aberta: false,
      armazenamento: null,
    });
    visaoGeral.definirBuscaDoAcompanhamento(
      buscarAcompanhamentoNoSupabase(cliente),
    );
    parar = acompanharPaginaAberta({ navegacao, visaoGeral });
    carga = criarCarga({
      cliente: () => cliente,
      configuracao: {
        consulta: () => cliente.from("TB_CONFIGURACAO"),
        carregar: async ({ consulta: c }) => (await c).data,
        booleano: () => true,
      },
      paineis: {
        consulta: () => cliente.from("TB_PAINEL_EXTERNO"),
        carregar: async ({ consulta: c }) => c,
        completarLiberados: () => {},
        liberados: () => new Set(),
      },
      navegacao,
      obterPerfil: () => ({
        id: "a",
        ativo: true,
        permissoes: { dashboard: "leitor", avaliacao_documental: "editor" },
      }),
      obterUsuario: () => ({ id: "u-avaliador" }),
      avisar: () => {},
      copia: {
        ler: async () => null,
        guardar: async () => {},
        apagar: async () => {},
        versao: "v1",
      },
      abas: {
        consulta: (sb) => sb.rpc("listar_abas_do_menu"),
        carregar: async () => {},
      },
      situacao: {
        consulta: (sb) => sb.rpc("obter_situacao_do_sistema"),
        carregar: async () => {},
      },
      esqueleto: { esconder: () => {}, marcarAtualizacao: () => {} },
      visaoGeral,
    });
    return { chamadas, cliente, navegacao };
  }

  const esperar = () => new Promise((resolver) => setTimeout(resolver, 0));

  beforeEach(() => redefinirDadosDoMonitoramento());
  afterEach(() => {
    parar?.();
    carga?.esquecer();
    redefinirDadosDoMonitoramento();
  });

  it("avaliador direto na Avaliação documental: 2 chamadas, sem linhas, acompanhamento nem Realtime", async () => {
    const { chamadas, cliente } = montar("avaliacao-documental");
    await carga.carregarEntrada();
    carga.iniciarRealtime();
    await esperar();
    expect([...chamadas].sort()).toEqual(
      // Configuração, painéis, abas, situação e unidades: obter_inicio_da_sessao.
      ["listar_mapa_da_saude_indigena", "obter_inicio_da_sessao"].sort(),
    );
    expect(cliente.channel).not.toHaveBeenCalled();
    expect(linhasPedidas()).toBe(false);
  });

  it("quem entra na Visão geral continua com as linhas e o acompanhamento na entrada", async () => {
    const { chamadas, cliente } = montar("dashboard");
    await carga.carregarEntrada();
    carga.iniciarRealtime();
    await esperar();
    expect(chamadas).toContain("listar_monitoramento_operacional");
    expect(chamadas).toContain("listar_acompanhamento_da_visao_geral_se_mudou");
    expect(
      chamadas.filter((nome) => nome === "listar_monitoramento_operacional"),
    ).toHaveLength(1);
    expect(obterDadosDoMonitoramento().linhas).toEqual(LINHAS);
    expect(cliente.channel).toHaveBeenCalledTimes(1);
  });

  it("o avaliador que abre Editais depois lê as linhas uma vez; a Visão geral escondida não pede nada", async () => {
    const { chamadas, navegacao } = montar("avaliacao-documental");
    await carga.carregarEntrada();
    navegacao.irPara("nucleo");
    await esperar();
    expect(
      chamadas.filter((nome) => nome === "listar_monitoramento_operacional"),
    ).toHaveLength(1);
    expect(chamadas).not.toContain(
      "listar_acompanhamento_da_visao_geral_se_mudou",
    );
    navegacao.irPara("avaliacao-documental");
    navegacao.irPara("nucleo");
    await esperar();
    expect(
      chamadas.filter((nome) => nome === "listar_monitoramento_operacional"),
    ).toHaveLength(1);
  });
});
