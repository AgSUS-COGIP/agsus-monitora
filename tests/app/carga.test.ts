import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  COLUNAS_DO_MONITORAMENTO,
  INTERVALO_DO_REALTIME_MS,
  criarCarga,
} from "../../src/app/carga.ts";
import type {
  ConsultaDaCarga,
  DependenciasDaCarga,
  OpcoesDaConsulta,
} from "../../src/app/carga.ts";
import type { OpcoesDaCargaDaConfiguracao } from "../../src/app/configuracao.ts";
import type { CopiaDaSessao } from "../../src/lib/copia-da-sessao";
import type { PerfilDeAcesso } from "../../src/lib/tipos-dos-acessos.ts";
import { definido } from "../definido.ts";
import { assinaturaDoAcesso, montarCopia } from "../../src/lib/copia-da-sessao";
import {
  obterDadosDoMonitoramento,
  redefinirDadosDoMonitoramento,
} from "../../src/componentes/dados-do-monitoramento.ts";

/*
  A carga dos dados (src/app/carga.ts): consultas em paralelo na entrada,
  cópia da sessão, "Atualizar dados" sem tela de carregamento e o Realtime.
  O Supabase, a configuração, os painéis e a navegação são falsos.
*/

const USUARIO = { id: "u1", email: "ana@agenciasus.org.br" };
const PERFIL: PerfilDeAcesso = {
  id: "p1",
  ativo: true,
  perfil: "edital_gestor",
};
const LINHAS = [{ id: 1, unidade: "DSEI Xingu", CO_AREA: "saude-indigena" }];
const VERSAO_DAS_LINHAS = "md5-das-linhas";
const MAPA = [{ chave: "lmap", payload: { dsei: [] } }];
const VERSAO_DO_MAPA = "md5-do-mapa";

/* Consulta preguiçosa como a do Supabase: só "sai" quando alguém chama then. */
type Resposta = { data: unknown; error: unknown };

function consultaPreguicosa(
  nome: string,
  resposta: () => Resposta,
  registro: string[],
) {
  const consulta = {
    nome,
    saiu: false,
    then<R1 = Resposta, R2 = never>(
      resolver?: ((valor: Resposta) => R1 | PromiseLike<R1>) | null,
      rejeitar?: ((motivo: unknown) => R2 | PromiseLike<R2>) | null,
    ): PromiseLike<R1 | R2> {
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

/*
  Quem precisa das linhas (src/componentes/dados-do-monitoramento.ts), falso:
  `pedir()` é a página aberta que as usa; devolve a devolução.
*/
function pedidosFalsos() {
  const ouvintes = new Set<() => void>();
  let quantos = 0;
  const avisarTodos = () => ouvintes.forEach((ouvinte) => ouvinte());
  return {
    ha: () => quantos > 0,
    assinar(ouvinte: () => void) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
    pedir() {
      quantos += 1;
      avisarTodos();
      let devolvido = false;
      return () => {
        if (devolvido) return;
        devolvido = true;
        quantos -= 1;
        avisarTodos();
      };
    },
  };
}

/*
  As dependências falsas têm só o que a carga usa (o cliente do Supabase, a
  navegação e a configuração reais descrevem muito mais). A guarda confere as
  três obrigatórias e devolve o objeto.
*/
function ehDependencias(deps: object): deps is DependenciasDaCarga {
  return "configuracao" in deps && "paineis" in deps && "navegacao" in deps;
}
function comoDependencias(deps: object): DependenciasDaCarga {
  if (!ehDependencias(deps)) throw new TypeError("dependências incompletas");
  return deps;
}

type OpcoesDaMontagem = {
  copiaGuardada?: CopiaDaSessao | null;
  erroNasLinhas?: { message: string } | null;
  perfil?: PerfilDeAcesso | null;
  pedindo?: boolean;
  telaDeEntrada?: string;
  semInicio?: boolean;
  agora?: () => number;
};

/* Um canal do Realtime falso: `ao` é o aviso de mudança que a carga registrou. */
type CanalFalso = {
  ao: (() => unknown) | null;
  on(tipo: unknown, filtro: unknown, funcao: () => unknown): CanalFalso;
  subscribe: () => CanalFalso;
};

type ArgumentosDoRpc = { p_versao?: unknown };

function montar({
  copiaGuardada = null,
  erroNasLinhas = null,
  perfil = PERFIL,
  // Por padrão, a página aberta usa as linhas (o comportamento de antes).
  pedindo = true,
  telaDeEntrada = "nucleo",
  // O banco sem obter_inicio_da_sessao (migration ainda não aplicada).
  semInicio = false,
  // O relógio da cópia da sessão; o Realtime usa o falso do vitest (`Date.now`).
  agora = () => 1_000,
}: OpcoesDaMontagem = {}) {
  const saidas: string[] = [];
  const ordem: unknown[][] = [];
  const respostas: Record<string, unknown[]> = {
    TB_CONFIGURACAO: [{ chave: "app_title", valor: "MONITORA" }],
    TB_PAINEL_EXTERNO: [{ id: "1", codigo: "bi" }],
    TD_UNIDADE: [{ nome_oficial: "DSEI Xingu" }],
  };
  const canais: CanalFalso[] = [];
  const cliente = {
    from: vi.fn((tabela: string) =>
      consultaPreguicosa(
        tabela,
        () => ({ data: respostas[tabela], error: null }),
        saidas,
      ),
    ),
    // O monitoramento vem por RPC com versão (migration 20261013160000).
    rpc: vi.fn(
      async (
        nome: string,
        { p_versao }: ArgumentosDoRpc = {},
      ): Promise<Resposta> => {
        saidas.push(nome);
        // O mapa também (migration 20261015000100).
        if (nome === "listar_mapa_da_saude_indigena")
          return p_versao === VERSAO_DO_MAPA
            ? { data: { inalterado: true, versao: p_versao }, error: null }
            : { data: { versao: VERSAO_DO_MAPA, linhas: MAPA }, error: null };
        // Configuração, painéis, abas, situação e unidades numa chamada (20261029121700).
        if (nome === "obter_inicio_da_sessao")
          return semInicio
            ? { data: null, error: { code: "PGRST202" } }
            : {
                data: {
                  configuracao: respostas.TB_CONFIGURACAO,
                  paineis: respostas.TB_PAINEL_EXTERNO,
                  unidades: respostas.TD_UNIDADE,
                  abas: null,
                  situacao: null,
                },
                error: null,
              };
        if (nome !== "listar_monitoramento_operacional")
          return { data: { resumo: true }, error: null };
        if (erroNasLinhas) return { data: null, error: erroNasLinhas };
        if (p_versao === VERSAO_DAS_LINHAS)
          return { data: { inalterado: true, versao: p_versao }, error: null };
        return {
          data: { versao: VERSAO_DAS_LINHAS, linhas: LINHAS },
          error: null,
        };
      },
    ),
    channel: vi.fn(() => {
      const canal: CanalFalso = {
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
    carregar: vi.fn(async ({ consulta }: OpcoesDaCargaDaConfiguracao) => {
      ordem.push(["config", saidas.length]);
      return definido(await consulta).data;
    }),
    booleano: vi.fn(() => true),
  };
  let liberados = new Set<unknown>(["1"]);
  const paineis = {
    consulta: () => cliente.from("TB_PAINEL_EXTERNO"),
    carregar: vi.fn(async ({ consulta }: { consulta?: ConsultaDaCarga }) => {
      ordem.push(["paineis"]);
      await consulta;
    }),
    completarLiberados: vi.fn(),
    liberados: () => liberados,
    descartarAbertos: vi.fn(),
    podeAbrir: (codigo: string) => codigo === "bi",
    esquecerAtual: vi.fn(),
  };
  let view = "dashboard";
  const irPara = vi.fn((tela: string) => {
    view = tela;
    ordem.push(["irPara", tela]);
  });
  const navegacao = {
    obter: () => ({ view }),
    montarMenu: vi.fn(),
    irPara,
    telaDeEntrada: () => telaDeEntrada,
    telaPermitida: (tela: string) => tela !== "proibida",
    definir: (tela: string) => (view = tela),
    // A entrada abre a tela de entrada; reabrir é a tela de agora de novo.
    abrirEntrada: vi.fn(() => irPara(telaDeEntrada)),
    reabrir: vi.fn(() => irPara(view)),
  };
  const copia = {
    ler: vi.fn(async () => copiaGuardada),
    guardar: vi.fn(async (_copia: CopiaDaSessao) => {}),
    apagar: vi.fn(async () => {}),
    versao: "v1",
  };
  const abas = {
    consulta: () => Promise.resolve({ data: null, error: null }),
    carregar: vi.fn(async (_opcoes: OpcoesDaConsulta) => {}),
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
  const pedidos = pedidosFalsos();
  if (pedindo) pedidos.pedir();
  const mostrarApp = vi.fn(() => ordem.push(["mostrarApp"]));
  const comemorar = vi.fn(() => ordem.push(["comemorar"]));
  const carga = criarCarga(
    comoDependencias({
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
      pedidos,
      agora,
    }),
  );
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
    pedidos,
    definirLiberados: (ids: unknown[]) => (liberados = new Set(ids)),
  };
}

const esperarTudo = () => new Promise((resolver) => setTimeout(resolver, 0));

beforeEach(() => redefinirDadosDoMonitoramento());
afterEach(() => vi.useRealTimers());

describe("entrada", () => {
  it("dispara todas as consultas antes da primeira espera", async () => {
    const { carga, ordem, saidas } = montar();
    await carga.carregarEntrada();
    // Quando a configuração começou a ser aplicada, o início da sessão (uma
    // chamada para configuração, painéis, abas, situação e unidades) já tinha
    // saído; mapa e monitoramento saem assim que a cópia local é lida.
    expect(
      ordem.find(([etapa]) => etapa === "config")?.[1],
    ).toBeGreaterThanOrEqual(1);
    expect(saidas).toContain("obter_inicio_da_sessao");
    expect(saidas).toContain("listar_monitoramento_operacional");
    expect(saidas).toContain("listar_mapa_da_saude_indigena");
  });

  it("configuração, painéis, abas, situação e unidades: uma chamada, não cinco", async () => {
    const { carga, saidas, cliente } = montar();
    await carga.carregarEntrada();
    await esperarTudo();
    expect(saidas.filter((s) => s === "obter_inicio_da_sessao")).toHaveLength(
      1,
    );
    expect(cliente.from).not.toHaveBeenCalled();
    expect(obterDadosDoMonitoramento().unidades).toHaveLength(1);
    // "Atualizar dados" pergunta de novo (o início usado na entrada foi esquecido).
    await carga.atualizarDados();
    expect(saidas.filter((s) => s === "obter_inicio_da_sessao")).toHaveLength(
      2,
    );
    expect(cliente.from).not.toHaveBeenCalled();
  });

  it("banco sem obter_inicio_da_sessao: as consultas de antes, cada uma uma vez", async () => {
    const { carga, saidas, configuracao } = montar({ semInicio: true });
    await expect(carga.carregarEntrada()).resolves.toBe(true);
    await esperarTudo();
    for (const tabela of ["TB_CONFIGURACAO", "TB_PAINEL_EXTERNO", "TD_UNIDADE"])
      expect(saidas.filter((s) => s === tabela)).toHaveLength(1);
    expect(configuracao.carregar).toHaveBeenCalled();
    expect(obterDadosDoMonitoramento().unidades).toHaveLength(1);
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

  it("falha nas linhas do monitoramento avisa uma vez e abre o app mesmo assim", async () => {
    const { carga, mostrarApp, esqueleto, avisar, cliente } = montar({
      erroNasLinhas: { message: "falhou" },
    });
    await expect(carga.carregarEntrada()).resolves.toBe(true);
    expect(mostrarApp).toHaveBeenCalled();
    expect(esqueleto.esconder).toHaveBeenCalled();
    expect(avisar).toHaveBeenCalledWith(
      "Erro ao carregar dados: falhou",
      "error",
    );
    await esperarTudo();
    const leituras = cliente.rpc.mock.calls.filter(
      ([nome]) => nome === "listar_monitoramento_operacional",
    );
    expect(leituras).toHaveLength(1);
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
    const guardada = definido(copia.guardar.mock.calls[0])[0];
    expect(guardada).toMatchObject({ usuarioId: "u1", versao: "v1" });
    expect(guardada.dados.monitoramento).toEqual({
      linhas: LINHAS,
      versao: VERSAO_DAS_LINHAS,
    });
  });

  it("não chama a RPC do payload consolidado (ninguém o lia)", async () => {
    const { carga, cliente } = montar();
    await carga.carregarEntrada();
    await esperarTudo();
    await carga.atualizarDados();
    const nomes = new Set(cliente.rpc.mock.calls.map(([nome]) => nome));
    expect([...nomes].sort()).toEqual([
      "listar_mapa_da_saude_indigena",
      "listar_monitoramento_operacional",
      "obter_inicio_da_sessao",
    ]);
  });

  it("o monitoramento pergunta pela versão que já tem: sem mudança, as linhas ficam", async () => {
    const { carga, cliente } = montar();
    await carga.carregarEntrada();
    await esperarTudo();
    await carga.atualizarDados();
    const pedidos = cliente.rpc.mock.calls.filter(
      ([nome]) => nome === "listar_monitoramento_operacional",
    );
    expect(pedidos.map(([, argumentos]) => argumentos?.p_versao)).toEqual([
      null,
      VERSAO_DAS_LINHAS,
    ]);
    expect(carga.linhas()).toEqual(LINHAS);
  });

  it("o mapa também pergunta pela versão: sem mudança, o mesmo mapa", async () => {
    const { carga, cliente } = montar();
    await carga.carregarEntrada();
    await esperarTudo();
    await carga.atualizarDados();
    const pedidos = cliente.rpc.mock.calls.filter(
      ([nome]) => nome === "listar_mapa_da_saude_indigena",
    );
    expect(pedidos.map(([, argumentos]) => argumentos?.p_versao)).toEqual([
      null,
      VERSAO_DO_MAPA,
    ]);
  });

  it("a cópia guarda a versão do mapa e a próxima entrada a manda", async () => {
    const primeira = montar();
    await primeira.carga.carregarEntrada();
    await esperarTudo();
    const guardada = definido(primeira.copia.guardar.mock.calls[0])[0];
    expect(guardada.dados.mapa).toEqual(MAPA);
    expect(guardada.dados.versaoDoMapa).toBe(VERSAO_DO_MAPA);
    const { carga, cliente } = montar({ copiaGuardada: guardada });
    await carga.carregarEntrada();
    await esperarTudo();
    const pedido = cliente.rpc.mock.calls.find(
      ([nome]) => nome === "listar_mapa_da_saude_indigena",
    );
    expect(pedido?.[1]).toEqual({ p_versao: VERSAO_DO_MAPA });
  });

  it("a cópia da sessão leva a versão das linhas: a entrada não baixa de novo", async () => {
    const dados = {
      config: [{ chave: "app_title", valor: "MONITORA" }],
      paineis: [{ id: "1", codigo: "bi" }],
      mapa: [],
      unidades: [{ nome_oficial: "DSEI Xingu" }],
      abas: null,
      monitoramento: { linhas: LINHAS, versao: VERSAO_DAS_LINHAS },
    };
    const copiaGuardada = montarCopia({
      usuarioId: "u1",
      acesso: assinaturaDoAcesso(PERFIL, ["1"]),
      versao: "v1",
      agora: 500,
      dados,
    });
    const { carga, cliente } = montar({ copiaGuardada });
    await carga.carregarEntrada();
    await esperarTudo();
    const pedido = cliente.rpc.mock.calls.find(
      ([nome]) => nome === "listar_monitoramento_operacional",
    );
    expect(pedido?.[1]).toEqual({ p_versao: VERSAO_DAS_LINHAS });
    expect(carga.linhas()).toEqual(LINHAS);
  });

  it("a cópia que serve abre a tela; a configuração vem dela, não da rede", async () => {
    const dados = {
      config: [{ chave: "app_title", valor: "Da cópia" }],
      paineis: [],
      mapa: [],
      unidades: [],
      abas: null,
      monitoramento: { linhas: LINHAS, versao: undefined },
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
    expect(
      await definido(configuracao.carregar.mock.calls[0])[0].consulta,
    ).toEqual({
      data: dados.config,
      error: null,
    });
  });

  it("apaga a cópia de outra pessoa", async () => {
    const { carga, copia } = montar({
      copiaGuardada: {
        usuarioId: "outra",
        acesso: undefined,
        versao: undefined,
        guardadaEm: undefined,
        dados: {},
      },
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
      cliente.rpc.mock.calls.filter(
        ([nome]) => nome === "obter_inicio_da_sessao",
      ),
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
    definido(definido(canais[0]).ao)();
    definido(definido(canais[0]).ao)();
    await vi.advanceTimersByTimeAsync(800);
    expect(avisar).toHaveBeenCalledWith(
      "Dashboard atualizado automaticamente.",
      "ok",
    );
    expect(
      cliente.rpc.mock.calls.filter(
        ([nome]) => nome === "listar_monitoramento_operacional",
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
    definido(definido(canais[0]).ao)();
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
    cliente.rpc.mockImplementation(() => {
      throw new Error("sem rede");
    });
    definido(definido(canais[0]).ao)();
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
    // O pedido da página continua: o próximo login assina de novo.
    expect(cliente.channel).toHaveBeenCalledTimes(2);
  });

  it("relê no máximo uma vez por intervalo, sem perder a última mudança", async () => {
    vi.useFakeTimers();
    const { carga, cliente, canais } = montar({ agora: () => Date.now() });
    const leituras = () =>
      cliente.rpc.mock.calls.filter(
        ([nome]) => nome === "listar_monitoramento_operacional",
      ).length;
    carga.iniciarRealtime();
    definido(definido(canais[0]).ao)();
    await vi.advanceTimersByTimeAsync(800);
    expect(leituras()).toBe(1);
    // Escritas seguidas por 20 s: nenhuma releitura antes do intervalo.
    for (let i = 0; i < 20; i += 1) {
      definido(definido(canais[0]).ao)();
      await vi.advanceTimersByTimeAsync(1_000);
    }
    expect(leituras()).toBe(1);
    // A última vira uma releitura só, no fim do intervalo.
    await vi.advanceTimersByTimeAsync(INTERVALO_DO_REALTIME_MS);
    expect(leituras()).toBe(2);
    await vi.advanceTimersByTimeAsync(INTERVALO_DO_REALTIME_MS * 3);
    expect(leituras()).toBe(2);
  });

  it("resposta inalterada não avisa que atualizou", async () => {
    vi.useFakeTimers();
    const { carga, cliente, canais, avisar } = montar({
      agora: () => Date.now(),
    });
    await carga.carregarEntrada();
    carga.iniciarRealtime();
    definido(definido(canais[0]).ao)();
    await vi.advanceTimersByTimeAsync(INTERVALO_DO_REALTIME_MS);
    const leituras = cliente.rpc.mock.calls.filter(
      ([nome]) => nome === "listar_monitoramento_operacional",
    );
    expect(leituras).toHaveLength(2);
    expect(leituras[1]?.[1]).toEqual({ p_versao: VERSAO_DAS_LINHAS });
    expect(avisar).not.toHaveBeenCalledWith(
      "Dashboard atualizado automaticamente.",
      "ok",
    );
  });

  it("a volta do fundo relê com a versão as linhas já lidas", async () => {
    vi.useFakeTimers();
    const { carga, cliente } = montar({ agora: () => Date.now() });
    const leituras = () =>
      cliente.rpc.mock.calls.filter(
        ([nome]) => nome === "listar_monitoramento_operacional",
      );
    await carga.carregarEntrada();
    carga.iniciarRealtime();
    expect(leituras()).toHaveLength(1);
    carga.pararRealtime();
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    carga.retomarRealtime();
    await vi.advanceTimersByTimeAsync(0);
    expect(cliente.channel).toHaveBeenCalledTimes(2);
    expect(leituras()).toHaveLength(2);
    expect(leituras()[1]?.[1]).toEqual({ p_versao: VERSAO_DAS_LINHAS });
  });

  it("a volta do fundo sem linhas lidas não lê nada", async () => {
    const { carga, cliente } = montar({
      pedindo: false,
      telaDeEntrada: "avaliacao-documental",
    });
    await carga.carregarEntrada();
    carga.iniciarRealtime();
    carga.pararRealtime();
    carga.retomarRealtime();
    await esperarTudo();
    expect(
      cliente.rpc.mock.calls.filter(
        ([nome]) => nome === "listar_monitoramento_operacional",
      ),
    ).toHaveLength(0);
  });

  it("desligado na configuração, não assina", () => {
    const { carga, cliente, configuracao } = montar();
    configuracao.booleano.mockReturnValue(false);
    carga.iniciarRealtime();
    expect(cliente.channel).not.toHaveBeenCalled();
  });
});

/*
  As linhas sob demanda (19/10/2026: o Supabase NANO saturou com avaliadores
  que nunca abriam uma página com elas). Quem entra numa página sem linhas não
  paga `listar_monitoramento_operacional` nem assina o Realtime.
*/
describe("linhas do monitoramento sob demanda", () => {
  const RPC = "listar_monitoramento_operacional";
  const pedidosDasLinhas = (cliente: ReturnType<typeof montar>["cliente"]) =>
    cliente.rpc.mock.calls.filter(([nome]) => nome === RPC);
  const COPIA_COM_LINHAS = () =>
    montarCopia({
      usuarioId: "u1",
      acesso: assinaturaDoAcesso(PERFIL, ["1"]),
      versao: "v1",
      agora: 500,
      dados: {
        config: [{ chave: "app_title", valor: "MONITORA" }],
        paineis: [{ id: "1", codigo: "bi" }],
        mapa: MAPA,
        versaoDoMapa: VERSAO_DO_MAPA,
        unidades: [{ nome_oficial: "DSEI Xingu" }],
        abas: null,
        monitoramento: { linhas: LINHAS, versao: VERSAO_DAS_LINHAS },
      },
    });

  it("entrar direto na Avaliação documental não lê as linhas", async () => {
    const { carga, cliente, navegacao, copia } = montar({
      pedindo: false,
      telaDeEntrada: "avaliacao-documental",
    });
    await expect(carga.carregarEntrada()).resolves.toBe(true);
    await esperarTudo();
    expect(navegacao.irPara).toHaveBeenCalledWith("avaliacao-documental");
    expect(pedidosDasLinhas(cliente)).toHaveLength(0);
    expect(obterDadosDoMonitoramento().carregado).toBe(false);
    // A cópia da sessão vai sem linhas (ninguém as leu), e sem quebrar.
    expect(copia.guardar).toHaveBeenCalledTimes(1);
    expect(
      definido(copia.guardar.mock.calls[0])[0].dados.monitoramento,
    ).toBeNull();
  });

  it("a página que usa as linhas, aberta depois, lê uma vez", async () => {
    const { carga, cliente, pedidos } = montar({
      pedindo: false,
      telaDeEntrada: "avaliacao-documental",
    });
    await carga.carregarEntrada();
    const devolver = pedidos.pedir();
    pedidos.pedir();
    await esperarTudo();
    expect(pedidosDasLinhas(cliente)).toHaveLength(1);
    expect(obterDadosDoMonitoramento().linhas).toEqual(LINHAS);
    devolver();
    pedidos.pedir();
    await esperarTudo();
    expect(pedidosDasLinhas(cliente)).toHaveLength(1);
  });

  describe("leitura que falha", () => {
    const avisosDeErro = (avisar: ReturnType<typeof montar>["avisar"]) =>
      avisar.mock.calls.filter(([texto]) =>
        String(texto).startsWith("Erro ao carregar dados"),
      );

    it("dois pedidos juntos: uma chamada, um aviso e o erro guardado para a tela", async () => {
      const { carga, cliente, pedidos, avisar } = montar({
        pedindo: false,
        telaDeEntrada: "avaliacao-documental",
        erroNasLinhas: { message: "falhou" },
      });
      await carga.carregarEntrada();
      pedidos.pedir();
      pedidos.pedir();
      await esperarTudo();
      expect(pedidosDasLinhas(cliente)).toHaveLength(1);
      expect(avisosDeErro(avisar)).toHaveLength(1);
      expect(obterDadosDoMonitoramento().erro).toBe("falhou");
      expect(obterDadosDoMonitoramento().carregado).toBe(false);
    });

    it("pedido novo depois da falha tenta de novo, sem repetir o mesmo aviso", async () => {
      const { carga, cliente, pedidos, avisar } = montar({
        pedindo: false,
        telaDeEntrada: "avaliacao-documental",
        erroNasLinhas: { message: "falhou" },
      });
      await carga.carregarEntrada();
      pedidos.pedir();
      await esperarTudo();
      pedidos.pedir();
      await esperarTudo();
      // Falha transitória não deixa a tela sem nova tentativa...
      expect(pedidosDasLinhas(cliente)).toHaveLength(2);
      // ...e a mesma falha não vira um segundo toast.
      expect(avisosDeErro(avisar)).toHaveLength(1);
    });
  });

  it("antes da entrada terminar, o pedido espera (não lê fora da sessão)", async () => {
    const { carga, cliente, pedidos } = montar({
      pedindo: false,
      telaDeEntrada: "avaliacao-documental",
    });
    pedidos.pedir();
    await esperarTudo();
    expect(pedidosDasLinhas(cliente)).toHaveLength(0);
    await carga.carregarEntrada();
    await esperarTudo();
    // O pedido que já estava (da página da sessão anterior) vale na entrada.
    expect(pedidosDasLinhas(cliente)).toHaveLength(1);
  });

  it("com a cópia da sessão, a página pinta pelas linhas dela e pergunta pela versão", async () => {
    const { carga, cliente, pedidos, copia } = montar({
      pedindo: false,
      telaDeEntrada: "avaliacao-documental",
      copiaGuardada: COPIA_COM_LINHAS(),
    });
    await carga.carregarEntrada();
    await esperarTudo();
    expect(pedidosDasLinhas(cliente)).toHaveLength(0);
    // A cópia nova não perde as linhas (nem a versão) da anterior.
    expect(
      definido(copia.guardar.mock.calls[0])[0].dados.monitoramento,
    ).toEqual({
      linhas: LINHAS,
      versao: VERSAO_DAS_LINHAS,
    });
    let responder: (() => void) | undefined;
    cliente.rpc.mockImplementationOnce(
      (_nome, argumentos) =>
        new Promise<Resposta>((resolver) => {
          responder = () =>
            resolver({
              data: { inalterado: true, versao: definido(argumentos).p_versao },
              error: null,
            });
        }),
    );
    pedidos.pedir();
    await esperarTudo();
    // Pintou pela cópia antes de o banco responder.
    expect(obterDadosDoMonitoramento()).toMatchObject({
      linhas: LINHAS,
      carregado: true,
    });
    expect(pedidosDasLinhas(cliente)[0]?.[1]).toEqual({
      p_versao: VERSAO_DAS_LINHAS,
    });
    definido(responder)();
    await esperarTudo();
    expect(carga.linhas()).toEqual(LINHAS);
  });

  it('"Atualizar dados" sem página com linhas não as lê', async () => {
    const { carga, cliente } = montar({
      pedindo: false,
      telaDeEntrada: "avaliacao-documental",
    });
    await carga.carregarEntrada();
    await expect(carga.atualizarDados()).resolves.toBe(true);
    expect(pedidosDasLinhas(cliente)).toHaveLength(0);
  });

  it("sem ninguém usando as linhas, o Realtime nem assina", async () => {
    const { carga, cliente, pedidos } = montar({
      pedindo: false,
      telaDeEntrada: "avaliacao-documental",
    });
    await carga.carregarEntrada();
    carga.iniciarRealtime();
    expect(cliente.channel).not.toHaveBeenCalled();
    // Abriu uma página com linhas: assina.
    pedidos.pedir();
    await esperarTudo();
    expect(cliente.channel).toHaveBeenCalledTimes(1);
  });

  it("mudança com a pessoa em outra página só marca desatualizadas; a volta relê uma vez", async () => {
    vi.useFakeTimers();
    const { carga, cliente, canais, pedidos, avisar } = montar({
      pedindo: false,
      telaDeEntrada: "avaliacao-documental",
    });
    await carga.carregarEntrada();
    carga.iniciarRealtime();
    const devolver = pedidos.pedir();
    await vi.advanceTimersByTimeAsync(0);
    expect(pedidosDasLinhas(cliente)).toHaveLength(1);
    devolver();
    // O canal fica (as linhas foram lidas), mas a rajada não relê ninguém.
    expect(cliente.removeChannel).not.toHaveBeenCalled();
    definido(definido(canais[0]).ao)();
    definido(definido(canais[0]).ao)();
    await vi.advanceTimersByTimeAsync(INTERVALO_DO_REALTIME_MS);
    expect(pedidosDasLinhas(cliente)).toHaveLength(1);
    expect(avisar).not.toHaveBeenCalledWith(
      "Dashboard atualizado automaticamente.",
      "ok",
    );
    pedidos.pedir();
    pedidos.pedir();
    await vi.advanceTimersByTimeAsync(0);
    expect(pedidosDasLinhas(cliente)).toHaveLength(2);
    expect(pedidosDasLinhas(cliente)[1]?.[1]).toEqual({
      p_versao: VERSAO_DAS_LINHAS,
    });
  });

  it("sair fecha o canal e esquece as linhas; a próxima sessão começa sem elas", async () => {
    const { carga, cliente, pedidos } = montar({
      pedindo: false,
      telaDeEntrada: "avaliacao-documental",
    });
    await carga.carregarEntrada();
    carga.iniciarRealtime();
    const devolver = pedidos.pedir();
    await esperarTudo();
    devolver();
    carga.esquecer();
    expect(cliente.removeChannel).toHaveBeenCalledTimes(1);
    await carga.carregarEntrada();
    carga.iniciarRealtime();
    expect(cliente.channel).toHaveBeenCalledTimes(1);
    expect(pedidosDasLinhas(cliente)).toHaveLength(1);
  });
});

describe("contratos da carga", () => {
  it("uma leitura só do monitoramento traz o cronograma e a área", () => {
    const colunas = COLUNAS_DO_MONITORAMENTO.split(",");
    for (const coluna of ["cronograma_automatico", "CO_AREA", "link_edital"])
      expect(colunas).toContain(coluna);
  });

  it("sem tela de carregamento (o skeleton e a barra do cabeçalho bastam)", () => {
    const fonte = readFileSync("src/app/carga.ts", "utf8");
    expect(fonte).not.toContain("mostrarCarregamento");
    expect(fonte).not.toContain("loader(");
    expect(fonte).not.toContain("sleep(");
  });
});
