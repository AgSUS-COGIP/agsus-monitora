import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { COLUNAS_DO_MONITORAMENTO, criarCarga } from "../../src/app/carga.js";
import {
  assinaturaDoAcesso,
  montarCopia,
} from "../../src/lib/copia-da-sessao.js";
import {
  obterDadosDoMonitoramento,
  redefinirDadosDoMonitoramento,
} from "../../src/componentes/dados-do-monitoramento.js";

/*
  A carga dos dados (src/app/carga.js): consultas em paralelo na entrada,
  cópia da sessão, "Atualizar dados" sem tela de carregamento e o Realtime.
  O Supabase, a configuração, os painéis e a navegação são falsos.
*/

const USUARIO = { id: "u1", email: "ana@agenciasus.org.br" };
const PERFIL = { id: "p1", ativo: true, perfil: "edital_gestor" };
const LINHAS = [{ id: 1, unidade: "DSEI Xingu", CO_AREA: "saude-indigena" }];

/* Consulta preguiçosa como a do Supabase: só "sai" quando alguém chama then. */
function consultaPreguicosa(nome, resposta, registro) {
  const consulta = {
    nome,
    saiu: false,
    then(resolver, rejeitar) {
      if (!consulta.saiu) registro.push(nome);
      consulta.saiu = true;
      return Promise.resolve(resposta()).then(resolver, rejeitar);
    },
  };
  const encadear = () => consulta;
  Object.assign(consulta, {
    select: encadear,
    eq: encadear,
    in: encadear,
    order: encadear,
  });
  return consulta;
}

function montar({
  copiaGuardada = null,
  erroNasLinhas = null,
  perfil = PERFIL,
} = {}) {
  const saidas = [];
  const ordem = [];
  const respostas = {
    TB_CONFIGURACAO: [{ chave: "app_title", valor: "MONITORA" }],
    TB_PAINEL_EXTERNO: [{ id: "1", codigo: "bi" }],
    TB_CONFIG_MAPA_SAUDE_INDIG: [],
    TD_UNIDADE: [{ nome_oficial: "DSEI Xingu" }],
    TB_MONITORAMENTO_INDIGENA: LINHAS,
  };
  const canais = [];
  const cliente = {
    from: vi.fn((tabela) =>
      consultaPreguicosa(
        tabela,
        () =>
          tabela === "TB_MONITORAMENTO_INDIGENA" && erroNasLinhas
            ? { data: null, error: erroNasLinhas }
            : { data: respostas[tabela], error: null },
        saidas,
      ),
    ),
    rpc: vi.fn(async () => ({ data: { resumo: true }, error: null })),
    channel: vi.fn(() => {
      const canal = {
        ao: null,
        on(_tipo, _filtro, funcao) {
          canal.ao = funcao;
          return canal;
        },
        subscribe: vi.fn(() => canal),
      };
      canais.push(canal);
      return canal;
    }),
    removeChannel: vi.fn(),
  };
  const configuracao = {
    consulta: () => cliente.from("TB_CONFIGURACAO"),
    carregar: vi.fn(async ({ consulta }) => {
      ordem.push(["config", saidas.length]);
      return (await consulta).data;
    }),
    booleano: vi.fn(() => true),
  };
  let liberados = new Set(["1"]);
  const paineis = {
    consulta: () => cliente.from("TB_PAINEL_EXTERNO"),
    carregar: vi.fn(async ({ consulta }) => {
      ordem.push(["paineis"]);
      await consulta;
    }),
    completarLiberados: vi.fn(),
    liberados: () => liberados,
    descartarAbertos: vi.fn(),
    podeAbrir: (codigo) => codigo === "bi",
    esquecerAtual: vi.fn(),
  };
  let view = "dashboard";
  const navegacao = {
    obter: () => ({ view }),
    montarMenu: vi.fn(),
    irPara: vi.fn((tela) => {
      view = tela;
      ordem.push(["irPara", tela]);
    }),
    telaDeEntrada: () => "nucleo",
    telaPermitida: (tela) => tela !== "proibida",
    definir: (tela) => (view = tela),
  };
  const copia = {
    ler: vi.fn(async () => copiaGuardada),
    guardar: vi.fn(async () => {}),
    apagar: vi.fn(async () => {}),
    versao: "v1",
  };
  const abas = {
    consulta: () => Promise.resolve({ data: null, error: null }),
    carregar: vi.fn(async () => {}),
  };
  const situacao = {
    consulta: () => Promise.resolve({ data: null, error: null }),
    carregar: vi.fn(async () => {}),
  };
  const esqueleto = {
    esconder: vi.fn(() => ordem.push(["esconder"])),
    marcarAtualizacao: vi.fn(),
  };
  const visaoGeral = { obter: () => ({}), definirDadosDoMapa: vi.fn() };
  const avisar = vi.fn();
  const mostrarApp = vi.fn(() => ordem.push(["mostrarApp"]));
  const comemorar = vi.fn(() => ordem.push(["comemorar"]));
  const carga = criarCarga({
    cliente: () => cliente,
    configuracao,
    paineis,
    navegacao,
    obterPerfil: () => perfil,
    obterUsuario: () => USUARIO,
    avisar,
    mostrarApp,
    comemorar,
    copia,
    abas,
    situacao,
    esqueleto,
    visaoGeral,
    agora: () => 1_000,
  });
  return {
    carga,
    cliente,
    configuracao,
    paineis,
    navegacao,
    copia,
    esqueleto,
    avisar,
    mostrarApp,
    comemorar,
    saidas,
    ordem,
    canais,
    definirLiberados: (ids) => (liberados = new Set(ids)),
  };
}

const esperarTudo = () => new Promise((resolver) => setTimeout(resolver, 0));

beforeEach(() => redefinirDadosDoMonitoramento());
afterEach(() => vi.useRealTimers());

describe("entrada", () => {
  it("dispara todas as consultas antes da primeira espera", async () => {
    const { carga, ordem } = montar();
    await carga.carregarEntrada();
    // Quando a configuração começou a ser aplicada, as cinco consultas já tinham saído.
    expect(ordem.find(([etapa]) => etapa === "config")).toEqual(["config", 5]);
  });

  it("abre o app na tela de entrada, esconde o skeleton e comemora, nessa ordem", async () => {
    const { carga, ordem, navegacao } = montar();
    await expect(carga.carregarEntrada()).resolves.toBe(true);
    const fim = ordem.slice(ordem.findIndex(([e]) => e === "mostrarApp"));
    expect(fim).toEqual([
      ["mostrarApp"],
      ["irPara", "nucleo"],
      ["esconder"],
      ["comemorar"],
    ]);
    expect(navegacao.montarMenu).toHaveBeenCalled();
    expect(obterDadosDoMonitoramento().linhas).toEqual(LINHAS);
    expect(obterDadosDoMonitoramento().unidades).toHaveLength(1);
  });

  it("sem as linhas do monitoramento, não abre e tira o skeleton", async () => {
    const { carga, mostrarApp, esqueleto, avisar } = montar({
      erroNasLinhas: { message: "falhou" },
    });
    await expect(carga.carregarEntrada()).resolves.toBe(false);
    expect(mostrarApp).not.toHaveBeenCalled();
    expect(esqueleto.esconder).toHaveBeenCalled();
    expect(avisar).toHaveBeenCalledWith(
      "Erro ao carregar dados: falhou",
      "error",
    );
  });

  it("lê a cópia junto com o perfil (prepararEntrada) e uma vez só", async () => {
    const { carga, copia } = montar();
    carga.prepararEntrada();
    await carga.carregarEntrada();
    expect(copia.ler).toHaveBeenCalledTimes(1);
  });

  it("depois de abrir, guarda a cópia nova com as consultas reais", async () => {
    const { carga, copia } = montar();
    await carga.carregarEntrada();
    await esperarTudo();
    expect(copia.guardar).toHaveBeenCalledTimes(1);
    const guardada = copia.guardar.mock.calls[0][0];
    expect(guardada).toMatchObject({ usuarioId: "u1", versao: "v1" });
    expect(guardada.dados.monitoramento).toEqual({ linhas: LINHAS });
  });

  it("não chama a RPC do payload consolidado (ninguém o lia)", async () => {
    const { carga, cliente } = montar();
    await carga.carregarEntrada();
    await esperarTudo();
    await carga.atualizarDados();
    expect(cliente.rpc).not.toHaveBeenCalled();
  });

  it("a cópia que serve abre a tela; a configuração vem dela, não da rede", async () => {
    const dados = {
      config: [{ chave: "app_title", valor: "Da cópia" }],
      paineis: [],
      mapa: [],
      unidades: [],
      abas: null,
      monitoramento: { linhas: LINHAS },
    };
    const copiaGuardada = montarCopia({
      usuarioId: "u1",
      acesso: assinaturaDoAcesso(PERFIL, ["1"]),
      versao: "v1",
      agora: 500,
      dados,
    });
    const { carga, configuracao } = montar({ copiaGuardada });
    await carga.carregarEntrada();
    expect(await configuracao.carregar.mock.calls[0][0].consulta).toEqual({
      data: dados.config,
      error: null,
    });
  });

  it("apaga a cópia de outra pessoa", async () => {
    const { carga, copia } = montar({
      copiaGuardada: { usuarioId: "outra", dados: {} },
    });
    await carga.carregarEntrada();
    expect(copia.apagar).toHaveBeenCalled();
  });

  it("perfil sem monitoramento: linhas vazias e menu montado", async () => {
    const { carga, navegacao } = montar({
      perfil: { id: "x", ativo: true, permissoes: { recursos: "leitor" } },
    });
    await expect(carga.carregarLinhas()).resolves.toBe(true);
    expect(obterDadosDoMonitoramento().linhas).toEqual([]);
    expect(navegacao.montarMenu).toHaveBeenCalled();
  });
});

describe("atualizar dados", () => {
  it("marca a barra, descarta os painéis abertos e reabre a tela atual", async () => {
    const { carga, esqueleto, paineis, navegacao, avisar } = montar();
    navegacao.definir("recursos");
    await expect(carga.atualizarDados()).resolves.toBe(true);
    expect(esqueleto.marcarAtualizacao.mock.calls).toEqual([[true], [false]]);
    expect(paineis.descartarAbertos).toHaveBeenCalled();
    expect(navegacao.irPara).toHaveBeenLastCalledWith("recursos");
    expect(avisar).toHaveBeenCalledWith("Dados atualizados.");
  });

  it("painel que deixou de valer volta à tela de entrada", async () => {
    const { carga, navegacao, paineis } = montar();
    navegacao.definir("panel:sumiu");
    await carga.atualizarDados();
    expect(paineis.esquecerAtual).toHaveBeenCalled();
    expect(navegacao.irPara).toHaveBeenLastCalledWith("nucleo");
  });

  it("desmarca a barra mesmo quando falha, e dois cliques esperam a mesma carga", async () => {
    const { carga, esqueleto, cliente } = montar({
      erroNasLinhas: { message: "x" },
    });
    const [a, b] = [carga.atualizarDados(), carga.atualizarDados()];
    expect(await a).toBe(false);
    expect(await b).toBe(false);
    expect(
      cliente.from.mock.calls.filter(([t]) => t === "TB_CONFIGURACAO"),
    ).toHaveLength(1);
    expect(esqueleto.marcarAtualizacao).toHaveBeenLastCalledWith(false);
  });
});

describe("Realtime do monitoramento", () => {
  it("relê as linhas uma vez por rajada e para ao sair", async () => {
    vi.useFakeTimers();
    const { carga, cliente, canais, avisar } = montar();
    carga.iniciarRealtime();
    carga.iniciarRealtime();
    expect(cliente.channel).toHaveBeenCalledTimes(1);
    canais[0].ao();
    canais[0].ao();
    await vi.advanceTimersByTimeAsync(800);
    expect(avisar).toHaveBeenCalledWith(
      "Dashboard atualizado automaticamente.",
      "ok",
    );
    expect(
      cliente.from.mock.calls.filter(
        ([t]) => t === "TB_MONITORAMENTO_INDIGENA",
      ),
    ).toHaveLength(1);
    carga.pararRealtime();
    expect(cliente.removeChannel).toHaveBeenCalledWith(canais[0]);
  });

  it("releitura que falha não diz que atualizou (o erro já foi avisado)", async () => {
    vi.useFakeTimers();
    const { carga, canais, avisar } = montar({
      erroNasLinhas: { message: "falhou" },
    });
    carga.iniciarRealtime();
    canais[0].ao();
    await vi.advanceTimersByTimeAsync(800);
    expect(avisar).toHaveBeenCalledWith(
      "Erro ao carregar dados: falhou",
      "error",
    );
    expect(avisar).not.toHaveBeenCalledWith(
      "Dashboard atualizado automaticamente.",
      "ok",
    );
  });

  it("releitura que estoura vira aviso de erro, sem rejeição solta", async () => {
    vi.useFakeTimers();
    const { carga, canais, avisar, cliente } = montar();
    carga.iniciarRealtime();
    cliente.from.mockImplementation(() => {
      throw new Error("sem rede");
    });
    canais[0].ao();
    await vi.advanceTimersByTimeAsync(800);
    expect(avisar).toHaveBeenCalledWith(
      "Erro ao carregar dados: sem rede",
      "error",
    );
    expect(avisar).not.toHaveBeenCalledWith(
      "Dashboard atualizado automaticamente.",
      "ok",
    );
  });

  it("esquecer (saída) fecha o canal e tira as linhas do store; o próximo login assina de novo", async () => {
    const { carga, cliente, canais } = montar();
    await carga.carregarEntrada();
    carga.iniciarRealtime();
    expect(obterDadosDoMonitoramento().linhas).toEqual(LINHAS);

    carga.esquecer();
    expect(cliente.removeChannel).toHaveBeenCalledWith(canais[0]);
    expect(carga.linhas()).toEqual([]);
    expect(obterDadosDoMonitoramento()).toMatchObject({
      linhas: [],
      carregado: false,
    });

    carga.iniciarRealtime();
    expect(cliente.channel).toHaveBeenCalledTimes(2);
  });

  it("desligado na configuração, não assina", () => {
    const { carga, cliente, configuracao } = montar();
    configuracao.booleano.mockReturnValue(false);
    carga.iniciarRealtime();
    expect(cliente.channel).not.toHaveBeenCalled();
  });
});

describe("contratos da carga", () => {
  it("uma leitura só do monitoramento traz o cronograma e a área", () => {
    const colunas = COLUNAS_DO_MONITORAMENTO.split(",");
    for (const coluna of ["cronograma_automatico", "CO_AREA", "link_edital"])
      expect(colunas).toContain(coluna);
  });

  it("sem tela de carregamento (o skeleton e a barra do cabeçalho bastam)", () => {
    const fonte = readFileSync("src/app/carga.js", "utf8");
    expect(fonte).not.toContain("mostrarCarregamento");
    expect(fonte).not.toContain("loader(");
    expect(fonte).not.toContain("sleep(");
  });
});
