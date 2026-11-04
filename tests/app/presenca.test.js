import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CARONA_MAXIMA,
  INTERVALO_DA_PRESENCA_MS,
  LISTA_FECHADA_MS,
  ONLINE_NO_BANCO_MS,
  criarPresenca,
  idDaAba,
} from "../../src/app/presenca.ts";

/*
  Presença e acesso (src/app/presenca.ts): uma chamada por batida
  (registrar_navegacao_monitora, migration 20261103230000) com a presença, o
  evento que coincide com ela, os de carona e, quando vencida, a lista de
  "Pessoas online".
*/

const USUARIO = { id: "u1" };
const GESTOR = { id: "g", ativo: true, perfil: "edital_gestor" };
const USUARIO_COMUM = { id: "c", ativo: true, perfil: "usuario" };
const BATIDA = "registrar_navegacao_monitora";
const LISTA = "listar_presenca_online_monitora";
const PRESENCA = "registrar_presenca_monitora";
const EVENTO = "registrar_evento_acesso";

/* Documento falso: a visibilidade da aba muda pelo teste. */
function criarDocumento() {
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

/*
  `banco`: "batida" (com 20261103230000), "navegacao" (só 20261029121700: a
  chamada com p_eventos/p_listar é recusada com PGRST202) ou "antiga" (sem a
  função).
*/
function montar({
  perfil = GESTOR,
  lista = [],
  erroNaLista = null,
  banco = "batida",
  respostaDaNavegacao = { status: "OK", versao_do_catalogo: "c1" },
  usuario = USUARIO,
} = {}) {
  const ouvintesDaNavegacao = new Set();
  const documento = criarDocumento();
  let view = "recursos";
  let lugar = "Recursos · Saúde Indígena";
  const quem = { atual: usuario };
  const cliente = {
    rpc: vi.fn(async (nome, args = {}) => {
      if (nome === LISTA)
        return erroNaLista
          ? { data: null, error: erroNaLista }
          : { data: lista, error: null };
      if (nome === BATIDA) {
        const nova = "p_eventos" in args || "p_listar" in args;
        if (banco === "antiga" || (banco === "navegacao" && nova))
          return { data: null, error: { code: "PGRST202" } };
        const dados = { ...respostaDaNavegacao };
        if (args.p_listar)
          Object.assign(
            dados,
            erroNaLista
              ? { pessoas_erro: { codigo: "42501" } }
              : { pessoas: lista },
          );
        return { data: dados, error: null };
      }
      return { data: null, error: null };
    }),
  };
  const navegacao = {
    obter: () => ({ view }),
    assinar: (ouvinte) => {
      ouvintesDaNavegacao.add(ouvinte);
      return () => ouvintesDaNavegacao.delete(ouvinte);
    },
  };
  const presenca = criarPresenca({
    cliente: () => cliente,
    documento,
    agente: () => "teste",
    obterUsuario: () => quem.atual,
    obterPerfil: () => perfil,
    configuracao: { inteiro: () => 5, versao: () => "V9" },
    navegacao,
    local: () => lugar,
  });
  return {
    presenca,
    cliente,
    documento,
    quem,
    avisarNavegacao: (evento) =>
      ouvintesDaNavegacao.forEach((ouvinte) => ouvinte(evento)),
    mudar: (novaView, novoLugar) => {
      view = novaView;
      lugar = novoLugar;
    },
  };
}

const chamadas = (cliente, nome) =>
  cliente.rpc.mock.calls.filter(([rpc]) => rpc === nome);
const batidas = (cliente) =>
  chamadas(cliente, BATIDA).filter(([, args]) => args.p_presenca);

afterEach(() => vi.useRealTimers());

describe("intervalos e limite de online", () => {
  it("batida a cada 150 s; o banco conta online por duas batidas e um minuto", () => {
    expect(INTERVALO_DA_PRESENCA_MS).toBe(150_000);
    expect(ONLINE_NO_BANCO_MS).toBe(6 * 60_000);
    // Uma batida perdida não derruba ninguém.
    expect(ONLINE_NO_BANCO_MS).toBeGreaterThanOrEqual(
      2 * INTERVALO_DA_PRESENCA_MS + 60_000,
    );
    expect(LISTA_FECHADA_MS).toBe(10 * 60_000);
  });

  it("o limite do banco (migration) é o mesmo da tela", () => {
    const sql = readFileSync(
      "supabase/migrations/20261103230000_presenca_enxuta.sql",
      "utf8",
    );
    expect(sql).toContain(
      `po.seen_at > timezone('utc', now()) - interval '${ONLINE_NO_BANCO_MS / 60_000} minutes'`,
    );
  });

  it("chamadas por hora de uma pessoa com a aba visível: 24 batidas, nada a mais", async () => {
    vi.useFakeTimers();
    const { presenca, cliente } = montar();
    presenca.iniciarHeartbeat();
    presenca.iniciar({ nome: "login_google", tela: "login" });
    await vi.advanceTimersByTimeAsync(60 * 60_000);
    // A entrada (t=0) e uma a cada 150 s: 1 + 24. Heartbeat e lista vão dentro.
    expect(cliente.rpc).toHaveBeenCalledTimes(25);
    expect(chamadas(cliente, BATIDA)).toHaveLength(25);
    const heartbeats = chamadas(cliente, BATIDA).filter(
      ([, args]) => args.p_evento === "heartbeat",
    );
    // Heartbeat de 5 min: a cada duas batidas.
    expect(heartbeats).toHaveLength(12);
    const comLista = chamadas(cliente, BATIDA).filter(
      ([, args]) => args.p_listar,
    );
    // Lista fechada: a da entrada e uma a cada 10 min.
    expect(comLista).toHaveLength(7);
    presenca.parar();
  });
});

describe("auditoria", () => {
  it("registra o evento com a tela atual, a aba e a versão", async () => {
    const { presenca, cliente } = montar();
    await presenca.registrarEvento("logout", { detalhes: { x: 1 } });
    expect(cliente.rpc).toHaveBeenCalledWith(EVENTO, {
      p_evento: "logout",
      p_tela: "recursos",
      p_origem: "index",
      p_detalhes: { x: 1 },
      p_client_session_id: idDaAba(),
      p_user_agent: "teste",
      p_app_version: "V9",
    });
  });

  it("o id da aba é o mesmo durante a sessão da aba", () => {
    expect(idDaAba()).toBe(idDaAba());
  });

  it("heartbeat a cada N minutos da configuração, de carona na batida; para quando pedido", async () => {
    vi.useFakeTimers();
    const { presenca, cliente } = montar({ perfil: USUARIO_COMUM });
    presenca.iniciarHeartbeat();
    presenca.iniciar();
    const heartbeats = () =>
      chamadas(cliente, BATIDA).filter(
        ([, args]) => args.p_evento === "heartbeat",
      );
    // Batidas aos 150 e 300 s; o heartbeat (5 min) vai na de 300 s.
    await vi.advanceTimersByTimeAsync(INTERVALO_DA_PRESENCA_MS * 2);
    expect(heartbeats()).toHaveLength(1);
    expect(heartbeats()[0][1]).toMatchObject({
      p_tela: "recursos",
      p_detalhes: { current_view: "recursos", page_title: "MONITORA" },
      p_presenca: true,
      p_current_view: "Recursos · Saúde Indígena",
      p_listar: false,
    });
    expect(chamadas(cliente, EVENTO)).toHaveLength(0);
    // A batida da entrada e as de 150 e 300 s (esta com o heartbeat): nada a mais.
    expect(cliente.rpc).toHaveBeenCalledTimes(3);
    presenca.pararHeartbeat();
    await vi.advanceTimersByTimeAsync(20 * 60 * 1000);
    expect(heartbeats()).toHaveLength(1);
  });

  it("heartbeat com o banco sem registrar_navegacao_monitora: as duas chamadas de antes", async () => {
    vi.useFakeTimers();
    const { presenca, cliente } = montar({
      perfil: USUARIO_COMUM,
      banco: "antiga",
    });
    presenca.iniciarHeartbeat();
    presenca.iniciar();
    await vi.advanceTimersByTimeAsync(INTERVALO_DA_PRESENCA_MS * 2);
    const eventos = chamadas(cliente, EVENTO);
    expect(eventos).toHaveLength(1);
    expect(eventos[0][1]).toMatchObject({
      p_evento: "heartbeat",
      p_detalhes: { current_view: "recursos", page_title: "MONITORA" },
    });
    expect(chamadas(cliente, PRESENCA)).toHaveLength(3);
  });

  it("com a aba oculta, nem batida nem heartbeat", async () => {
    vi.useFakeTimers();
    const { presenca, cliente, documento } = montar({ perfil: USUARIO_COMUM });
    presenca.acompanhar();
    presenca.iniciarHeartbeat();
    presenca.iniciar();
    await vi.advanceTimersByTimeAsync(0);
    const antes = cliente.rpc.mock.calls.length;
    documento.mudar("hidden");
    await vi.advanceTimersByTimeAsync(30 * 60 * 1000);
    expect(cliente.rpc).toHaveBeenCalledTimes(antes);
  });

  it("a navegação avisa a abertura de tela (só quando muda), numa chamada", async () => {
    const { presenca, cliente, avisarNavegacao } = montar();
    presenca.acompanhar();
    avisarNavegacao({
      tipo: "abertura",
      view: "nucleo",
      anterior: "dashboard",
    });
    avisarNavegacao({ tipo: "abertura", view: "nucleo", anterior: "nucleo" });
    await Promise.resolve();
    const eventos = chamadas(cliente, BATIDA);
    expect(eventos).toHaveLength(1);
    expect(eventos[0][1]).toMatchObject({
      p_evento: "abertura_tela",
      p_tela: "nucleo",
      p_origem: "index",
      p_client_session_id: idDaAba(),
      p_user_agent: "teste",
      p_app_version: "V9",
      // A presença não estava ligada: só o evento.
      p_presenca: false,
      p_eventos: [],
      p_listar: false,
    });
    expect(chamadas(cliente, EVENTO)).toHaveLength(0);
  });

  it("abrir outra tela com a presença ligada: evento e lugar numa chamada só", async () => {
    vi.useFakeTimers();
    const { presenca, cliente, avisarNavegacao, mudar } = montar();
    presenca.acompanhar();
    presenca.iniciar();
    await vi.advanceTimersByTimeAsync(0);
    const antes = cliente.rpc.mock.calls.length;
    mudar("nucleo", "Editais · SEDE");
    avisarNavegacao({ tipo: "abertura", view: "nucleo", anterior: "recursos" });
    await vi.advanceTimersByTimeAsync(0);
    const depois = cliente.rpc.mock.calls.slice(antes);
    expect(depois.map(([nome]) => nome)).toEqual([BATIDA]);
    expect(depois[0][1]).toMatchObject({
      p_evento: "abertura_tela",
      p_tela: "nucleo",
      p_presenca: true,
      p_current_view: "Editais · SEDE",
    });
  });

  it("abrir tela pelo menu (menu + abertura no mesmo instante): uma chamada só", async () => {
    vi.useFakeTimers();
    const { presenca, cliente, avisarNavegacao, mudar } = montar();
    presenca.acompanhar();
    presenca.iniciar();
    await vi.advanceTimersByTimeAsync(0);
    // O que navegacao.ts faz ao abrir: marcarMenu (menu) e depois abriu (abertura).
    const abrir = async (view, lugar, anterior) => {
      const antes = cliente.rpc.mock.calls.length;
      mudar(view, lugar);
      avisarNavegacao({ tipo: "menu" });
      avisarNavegacao({ tipo: "abertura", view, anterior });
      await vi.advanceTimersByTimeAsync(0);
      return cliente.rpc.mock.calls.slice(antes);
    };
    const primeira = await abrir(
      "aprovados",
      "Lista de aprovados · SEDE",
      "recursos",
    );
    expect(primeira.map(([nome]) => nome)).toEqual([BATIDA]);
    expect(primeira[0][1]).toMatchObject({
      p_evento: "abertura_tela",
      p_tela: "aprovados",
      p_presenca: true,
      p_current_view: "Lista de aprovados · SEDE",
    });
    const segunda = await abrir("nucleo", "Editais · SEDE", "aprovados");
    expect(segunda.map(([nome]) => nome)).toEqual([BATIDA]);
    expect(segunda[0][1]).toMatchObject({ p_tela: "nucleo" });
    presenca.parar();
  });

  it("a entrada vai junto com a primeira batida, com a lista", async () => {
    vi.useFakeTimers();
    const { presenca, cliente } = montar({
      lista: [{ user_id: "u2", full_name: "Bia Lima", perfil: "Admin" }],
    });
    presenca.iniciar({ nome: "sessao_restaurada", tela: "boot" });
    await vi.advanceTimersByTimeAsync(0);
    expect(cliente.rpc).toHaveBeenCalledTimes(1);
    expect(chamadas(cliente, BATIDA)[0][1]).toMatchObject({
      p_evento: "sessao_restaurada",
      p_tela: "boot",
      p_presenca: true,
      p_current_view: "Recursos · Saúde Indígena",
      p_listar: true,
    });
    expect(presenca.obter()).toMatchObject({
      visivel: true,
      sincronizado: true,
    });
    expect(presenca.obter().pessoas[0]).toMatchObject({ fullName: "Bia Lima" });
    presenca.parar();
  });

  it("banco sem registrar_navegacao_monitora: as duas chamadas de antes", async () => {
    vi.useFakeTimers();
    const { presenca, cliente, avisarNavegacao, mudar } = montar({
      banco: "antiga",
    });
    presenca.acompanhar();
    presenca.iniciar();
    await vi.advanceTimersByTimeAsync(0);
    mudar("nucleo", "Editais · SEDE");
    avisarNavegacao({ tipo: "abertura", view: "nucleo", anterior: "recursos" });
    await vi.advanceTimersByTimeAsync(0);
    expect(chamadas(cliente, EVENTO)[0][1]).toMatchObject({
      p_evento: "abertura_tela",
      p_tela: "nucleo",
    });
    expect(chamadas(cliente, PRESENCA).at(-1)[1]).toEqual({
      p_current_view: "Editais · SEDE",
    });
    // A lista, à parte.
    expect(chamadas(cliente, LISTA)).toHaveLength(1);
    // Descoberto uma vez (um degrau por recusa): depois, direto às antigas.
    const recusas = chamadas(cliente, BATIDA).length;
    expect(recusas).toBe(2);
    mudar("dashboard", "Visão geral · SEDE");
    avisarNavegacao({
      tipo: "abertura",
      view: "dashboard",
      anterior: "nucleo",
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(chamadas(cliente, BATIDA)).toHaveLength(recusas);
    presenca.parar();
  });

  it("banco sem p_eventos/p_listar: a batida pelos nove nomes e a lista à parte", async () => {
    vi.useFakeTimers();
    const { presenca, cliente } = montar({ banco: "navegacao" });
    presenca.iniciar({ nome: "login_google", tela: "login" });
    await vi.advanceTimersByTimeAsync(0);
    const aceitas = chamadas(cliente, BATIDA).filter(
      ([, args]) => !("p_listar" in args),
    );
    expect(aceitas).toHaveLength(1);
    expect(aceitas[0][1]).toMatchObject({
      p_evento: "login_google",
      p_presenca: true,
    });
    expect(chamadas(cliente, LISTA)).toHaveLength(1);
    // Depois de descoberto, a próxima batida já vai sem os dois.
    const antes = chamadas(cliente, BATIDA).length;
    await vi.advanceTimersByTimeAsync(INTERVALO_DA_PRESENCA_MS);
    const novas = chamadas(cliente, BATIDA).slice(antes);
    expect(novas).toHaveLength(1);
    expect("p_listar" in novas[0][1]).toBe(false);
    presenca.parar();
  });

  it("presença recusada na navegação (perfil inativo): o lugar não conta como gravado", async () => {
    vi.useFakeTimers();
    const { presenca, cliente, avisarNavegacao, mudar } = montar({
      respostaDaNavegacao: {
        evento_id: 1,
        presenca_erro: {
          codigo: "P0002",
          mensagem: "Perfil institucional nao localizado.",
        },
      },
    });
    presenca.acompanhar();
    presenca.iniciar();
    await vi.advanceTimersByTimeAsync(0);
    const antes = chamadas(cliente, BATIDA).length;
    mudar("nucleo", "Editais · SEDE");
    avisarNavegacao({ tipo: "menu" });
    await vi.advanceTimersByTimeAsync(0);
    // A próxima troca de menu, com o mesmo lugar, tenta de novo.
    avisarNavegacao({ tipo: "menu" });
    await vi.advanceTimersByTimeAsync(0);
    expect(chamadas(cliente, BATIDA).length - antes).toBe(2);
    presenca.parar();
  });
});

describe("eventos de carona", () => {
  const RETRATO = {
    evento: "frontend_performance",
    tela: "monitora",
    origem: "frontend",
    detalhes: { lcp: 1200 },
    client_session_id: "performance-monitor",
    app_version: "frontend-performance-v1",
  };

  it("vai com a próxima batida, sem chamada própria", async () => {
    vi.useFakeTimers();
    const { presenca, cliente } = montar({ perfil: USUARIO_COMUM });
    presenca.acompanhar();
    presenca.iniciar();
    await vi.advanceTimersByTimeAsync(0);
    presenca.enfileirarEvento(RETRATO);
    await vi.advanceTimersByTimeAsync(0);
    expect(cliente.rpc).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(INTERVALO_DA_PRESENCA_MS);
    expect(cliente.rpc).toHaveBeenCalledTimes(2);
    expect(chamadas(cliente, BATIDA)[1][1]).toMatchObject({
      p_presenca: true,
      p_eventos: [RETRATO],
    });
    // Foi uma vez só.
    await vi.advanceTimersByTimeAsync(INTERVALO_DA_PRESENCA_MS);
    expect(chamadas(cliente, BATIDA)[2][1].p_eventos).toEqual([]);
    expect(chamadas(cliente, EVENTO)).toHaveLength(0);
    presenca.parar();
  });

  it("vai com a navegação, se ela vier antes da batida", async () => {
    vi.useFakeTimers();
    const { presenca, cliente, avisarNavegacao, mudar } = montar();
    presenca.acompanhar();
    presenca.iniciar();
    await vi.advanceTimersByTimeAsync(0);
    presenca.enfileirarEvento(RETRATO);
    mudar("nucleo", "Editais · SEDE");
    avisarNavegacao({ tipo: "abertura", view: "nucleo", anterior: "recursos" });
    await vi.advanceTimersByTimeAsync(0);
    expect(chamadas(cliente, BATIDA).at(-1)[1]).toMatchObject({
      p_evento: "abertura_tela",
      p_eventos: [RETRATO],
    });
    presenca.parar();
  });

  it("a aba que fica oculta despacha a fila na hora (sem presença)", async () => {
    vi.useFakeTimers();
    const { presenca, cliente, documento } = montar();
    presenca.acompanhar();
    presenca.iniciar();
    await vi.advanceTimersByTimeAsync(0);
    presenca.enfileirarEvento(RETRATO);
    documento.mudar("hidden");
    await vi.advanceTimersByTimeAsync(0);
    expect(chamadas(cliente, BATIDA).at(-1)[1]).toMatchObject({
      p_evento: null,
      p_presenca: false,
      p_eventos: [RETRATO],
    });
  });

  it("antes da pessoa ser conhecida, espera a primeira batida; no máximo 10", async () => {
    vi.useFakeTimers();
    const { presenca, cliente, quem } = montar({ usuario: null });
    for (let i = 0; i < CARONA_MAXIMA + 2; i += 1)
      presenca.enfileirarEvento({ ...RETRATO, detalhes: { i } });
    await vi.advanceTimersByTimeAsync(0);
    expect(cliente.rpc).not.toHaveBeenCalled();
    quem.atual = USUARIO;
    presenca.iniciar({ nome: "login_google", tela: "login" });
    await vi.advanceTimersByTimeAsync(0);
    const primeira = chamadas(cliente, BATIDA)[0][1];
    expect(primeira.p_evento).toBe("login_google");
    expect(primeira.p_eventos).toHaveLength(CARONA_MAXIMA);
    expect(primeira.p_eventos[0].detalhes).toEqual({ i: 2 });
    presenca.parar();
  });

  it("banco sem p_eventos: cada evento numa chamada à parte, com a origem dele", async () => {
    vi.useFakeTimers();
    const { presenca, cliente } = montar({ banco: "navegacao" });
    presenca.iniciar();
    await vi.advanceTimersByTimeAsync(0);
    presenca.enfileirarEvento(RETRATO);
    await vi.advanceTimersByTimeAsync(INTERVALO_DA_PRESENCA_MS);
    expect(chamadas(cliente, EVENTO)).toHaveLength(1);
    expect(chamadas(cliente, EVENTO)[0][1]).toEqual({
      p_evento: "frontend_performance",
      p_tela: "monitora",
      p_origem: "frontend",
      p_detalhes: { lcp: 1200 },
      p_client_session_id: "performance-monitor",
      p_user_agent: "teste",
      p_app_version: "frontend-performance-v1",
    });
    presenca.parar();
  });

  it("a saída leva a fila junto", async () => {
    vi.useFakeTimers();
    const { presenca, cliente } = montar();
    presenca.iniciar();
    await vi.advanceTimersByTimeAsync(0);
    presenca.enfileirarEvento(RETRATO);
    await presenca.registrarEvento("logout");
    expect(chamadas(cliente, EVENTO)).toHaveLength(0);
    expect(chamadas(cliente, BATIDA).at(-1)[1]).toMatchObject({
      p_evento: "logout",
      p_presenca: false,
      p_eventos: [RETRATO],
    });
    presenca.parar();
  });
});

describe("presença", () => {
  it("Gestor vê a lista, que vem na própria batida com o lugar da pessoa", async () => {
    const { presenca, cliente } = montar({
      lista: [{ user_id: "u2", full_name: "Bia Lima", perfil: "Admin" }],
    });
    await presenca.sincronizar();
    expect(cliente.rpc).toHaveBeenCalledTimes(1);
    expect(chamadas(cliente, BATIDA)[0][1]).toMatchObject({
      p_presenca: true,
      p_current_view: "Recursos · Saúde Indígena",
      p_listar: true,
    });
    expect(presenca.obter()).toMatchObject({
      visivel: true,
      sincronizado: true,
    });
    expect(presenca.obter().pessoas[0]).toMatchObject({
      fullName: "Bia Lima",
      profileLabel: "Administrador global",
    });
  });

  it("quem não pode ver: bate a presença sem pedir a lista; o indicador fica escondido", async () => {
    const { presenca, cliente } = montar({ perfil: USUARIO_COMUM });
    await presenca.sincronizar();
    expect(batidas(cliente)).toHaveLength(1);
    expect(batidas(cliente)[0][1].p_listar).toBe(false);
    expect(chamadas(cliente, LISTA)).toHaveLength(0);
    expect(presenca.obter().visivel).toBe(false);
  });

  it("lista recusada na batida: fica visível, sem sincronizar", async () => {
    const { presenca } = montar({ erroNaLista: { message: "x" } });
    await presenca.sincronizar();
    expect(presenca.obter()).toMatchObject({
      visivel: true,
      sincronizado: false,
      pessoas: [],
    });
  });

  it("falha na lista à parte (banco sem p_listar): fica visível, sem sincronizar", async () => {
    const { presenca } = montar({
      banco: "navegacao",
      erroNaLista: { message: "x" },
    });
    await presenca.sincronizar();
    expect(presenca.obter()).toMatchObject({
      visivel: true,
      sincronizado: false,
    });
  });

  it("Gestor desativado não consulta nem exibe pessoas online", async () => {
    const { presenca, cliente } = montar({
      perfil: { ...GESTOR, ativo: false },
    });
    await presenca.sincronizar();
    expect(chamadas(cliente, LISTA)).toHaveLength(0);
    expect(batidas(cliente)[0][1].p_listar).toBe(false);
    expect(presenca.obter().visivel).toBe(false);
  });

  it("bate a cada 150 s e avisa na hora a troca de lugar", async () => {
    vi.useFakeTimers();
    const { presenca, cliente, avisarNavegacao, mudar } = montar();
    presenca.acompanhar();
    presenca.iniciar();
    await vi.advanceTimersByTimeAsync(0);
    expect(batidas(cliente)).toHaveLength(1);
    // Marcação do menu sem troca de lugar: nada sai.
    avisarNavegacao({ tipo: "menu" });
    expect(batidas(cliente)).toHaveLength(1);
    mudar("nucleo", "Editais · SEDE");
    avisarNavegacao({ tipo: "menu" });
    await vi.advanceTimersByTimeAsync(0);
    expect(batidas(cliente)).toHaveLength(2);
    expect(batidas(cliente)[1][1]).toMatchObject({
      p_evento: null,
      p_presenca: true,
      p_current_view: "Editais · SEDE",
    });
    await vi.advanceTimersByTimeAsync(INTERVALO_DA_PRESENCA_MS - 1);
    expect(batidas(cliente)).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(batidas(cliente)).toHaveLength(3);
    presenca.parar();
    await vi.advanceTimersByTimeAsync(INTERVALO_DA_PRESENCA_MS * 3);
    expect(batidas(cliente)).toHaveLength(3);
    expect(presenca.obter()).toMatchObject({ visivel: false, aberto: false });
  });

  it("abrir a lista sem a presença batendo relê só a lista; Esc/fechar fecha", async () => {
    const { presenca, cliente } = montar();
    presenca.alternar();
    await Promise.resolve();
    expect(presenca.obter().aberto).toBe(true);
    expect(chamadas(cliente, LISTA)).toHaveLength(1);
    expect(chamadas(cliente, BATIDA)).toHaveLength(0);
    presenca.fechar();
    expect(presenca.obter().aberto).toBe(false);
  });

  it("abrir a lista com a presença batendo: uma batida adiantada com a lista; o relógio recomeça", async () => {
    vi.useFakeTimers();
    const { presenca, cliente } = montar();
    presenca.iniciar();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(batidas(cliente)).toHaveLength(1);
    presenca.alternar();
    await vi.advanceTimersByTimeAsync(0);
    expect(batidas(cliente)).toHaveLength(2);
    expect(batidas(cliente)[1][1].p_listar).toBe(true);
    expect(chamadas(cliente, LISTA)).toHaveLength(0);
    // A próxima, 150 s depois da abertura (não aos 150 s da entrada).
    await vi.advanceTimersByTimeAsync(INTERVALO_DA_PRESENCA_MS - 1);
    expect(batidas(cliente)).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(batidas(cliente)).toHaveLength(3);
    // Aberta: cada batida traz a lista.
    expect(batidas(cliente)[2][1].p_listar).toBe(true);
    presenca.parar();
  });

  it("aba oculta pausa a batida; a volta bate uma vez só, sem dobrar", async () => {
    vi.useFakeTimers();
    const { presenca, cliente, documento } = montar();
    presenca.acompanhar();
    presenca.iniciar();
    await vi.advanceTimersByTimeAsync(0);
    expect(batidas(cliente)).toHaveLength(1);
    documento.mudar("hidden");
    await vi.advanceTimersByTimeAsync(INTERVALO_DA_PRESENCA_MS * 4);
    expect(cliente.rpc).toHaveBeenCalledTimes(1);
    documento.mudar("visible");
    // Um segundo aviso de visível (o Supabase e o ciclo de fundo também avisam) não dobra.
    documento.mudar("visible");
    await vi.advanceTimersByTimeAsync(0);
    expect(batidas(cliente)).toHaveLength(2);
    // O relógio recomeça da volta: a próxima, 150 s depois.
    await vi.advanceTimersByTimeAsync(INTERVALO_DA_PRESENCA_MS - 1);
    expect(batidas(cliente)).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(batidas(cliente)).toHaveLength(3);
  });

  it("volta rápida (antes do intervalo) não bate na hora", async () => {
    vi.useFakeTimers();
    const { presenca, cliente, documento } = montar();
    presenca.acompanhar();
    presenca.iniciar();
    await vi.advanceTimersByTimeAsync(0);
    documento.mudar("hidden");
    await vi.advanceTimersByTimeAsync(10_000);
    documento.mudar("visible");
    await vi.advanceTimersByTimeAsync(0);
    expect(batidas(cliente)).toHaveLength(1);
  });

  it("iniciada com a aba oculta, só começa quando ela fica visível", async () => {
    vi.useFakeTimers();
    const { presenca, cliente, documento } = montar();
    presenca.acompanhar();
    documento.visibilityState = "hidden";
    presenca.iniciar();
    await vi.advanceTimersByTimeAsync(INTERVALO_DA_PRESENCA_MS * 2);
    expect(cliente.rpc).not.toHaveBeenCalled();
    documento.mudar("visible");
    await vi.advanceTimersByTimeAsync(0);
    expect(batidas(cliente)).toHaveLength(1);
  });

  it("lista fechada: a contagem relida no máximo a cada 10 min; aberta, a cada batida — sempre na batida", async () => {
    vi.useFakeTimers();
    const { presenca, cliente } = montar();
    const listas = () =>
      batidas(cliente).filter(([, args]) => args.p_listar).length;
    presenca.iniciar();
    await vi.advanceTimersByTimeAsync(0);
    expect(listas()).toBe(1);
    await vi.advanceTimersByTimeAsync(INTERVALO_DA_PRESENCA_MS * 3);
    expect(batidas(cliente)).toHaveLength(4);
    expect(listas()).toBe(1);
    await vi.advanceTimersByTimeAsync(LISTA_FECHADA_MS);
    expect(listas()).toBe(2);
    presenca.alternar();
    await vi.advanceTimersByTimeAsync(0);
    const aoAbrir = listas();
    await vi.advanceTimersByTimeAsync(INTERVALO_DA_PRESENCA_MS * 2);
    expect(listas()).toBe(aoAbrir + 2);
    // Nenhuma chamada à parte para a lista.
    expect(chamadas(cliente, LISTA)).toHaveLength(0);
  });
});
