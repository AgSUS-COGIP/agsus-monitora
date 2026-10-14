import { afterEach, describe, expect, it, vi } from "vitest";
import {
  INTERVALO_DA_PRESENCA_MS,
  LISTA_FECHADA_MS,
  criarPresenca,
  idDaAba,
} from "../../src/app/presenca.js";

/*
  Presença e acesso (src/app/presenca.js): auditoria, heartbeat, a batida da
  presença com o lugar da pessoa e a lista de "Pessoas online".
*/

const USUARIO = { id: "u1" };
const GESTOR = { id: "g", ativo: true, perfil: "edital_gestor" };
const USUARIO_COMUM = { id: "c", ativo: true, perfil: "usuario" };

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

function montar({ perfil = GESTOR, lista = [], erroNaLista = null } = {}) {
  const ouvintesDaNavegacao = new Set();
  const documento = criarDocumento();
  let view = "recursos";
  let lugar = "Recursos · Saúde Indígena";
  const cliente = {
    rpc: vi.fn(async (nome) => {
      if (nome === "listar_presenca_online_monitora")
        return erroNaLista
          ? { data: null, error: erroNaLista }
          : { data: lista, error: null };
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
    obterUsuario: () => USUARIO,
    obterPerfil: () => perfil,
    configuracao: { inteiro: () => 2, versao: () => "V9" },
    navegacao,
    local: () => lugar,
  });
  return {
    presenca,
    cliente,
    documento,
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

afterEach(() => vi.useRealTimers());

describe("auditoria", () => {
  it("registra o evento com a tela atual, a aba e a versão", async () => {
    const { presenca, cliente } = montar();
    await presenca.registrarEvento("logout", { detalhes: { x: 1 } });
    expect(cliente.rpc).toHaveBeenCalledWith("registrar_evento_acesso", {
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

  it("heartbeat a cada N minutos da configuração; para quando pedido", async () => {
    vi.useFakeTimers();
    const { presenca, cliente } = montar();
    presenca.iniciarHeartbeat();
    await vi.advanceTimersByTimeAsync(2 * 60 * 1000);
    expect(chamadas(cliente, "registrar_evento_acesso")).toHaveLength(1);
    expect(chamadas(cliente, "registrar_evento_acesso")[0][1].p_evento).toBe(
      "heartbeat",
    );
    presenca.pararHeartbeat();
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
    expect(chamadas(cliente, "registrar_evento_acesso")).toHaveLength(1);
  });

  it("a navegação avisa a abertura de tela (só quando muda)", async () => {
    const { presenca, cliente, avisarNavegacao } = montar();
    presenca.acompanhar();
    avisarNavegacao({
      tipo: "abertura",
      view: "nucleo",
      anterior: "dashboard",
    });
    avisarNavegacao({ tipo: "abertura", view: "nucleo", anterior: "nucleo" });
    await Promise.resolve();
    const eventos = chamadas(cliente, "registrar_evento_acesso");
    expect(eventos).toHaveLength(1);
    expect(eventos[0][1]).toMatchObject({
      p_evento: "abertura_tela",
      p_tela: "nucleo",
    });
  });
});

describe("presença", () => {
  it("Gestor vê a lista; a batida leva o lugar da pessoa", async () => {
    const { presenca, cliente } = montar({
      lista: [{ user_id: "u2", full_name: "Bia Lima", perfil: "Admin" }],
    });
    await presenca.sincronizar();
    expect(cliente.rpc).toHaveBeenCalledWith("registrar_presenca_monitora", {
      p_current_view: "Recursos · Saúde Indígena",
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

  it("quem não pode ver: bate a presença, mas o indicador fica escondido", async () => {
    const { presenca, cliente } = montar({ perfil: USUARIO_COMUM });
    await presenca.sincronizar();
    expect(chamadas(cliente, "registrar_presenca_monitora")).toHaveLength(1);
    expect(chamadas(cliente, "listar_presenca_online_monitora")).toHaveLength(
      0,
    );
    expect(presenca.obter().visivel).toBe(false);
  });

  it("falha na lista: fica visível, sem sincronizar", async () => {
    const { presenca } = montar({ erroNaLista: { message: "x" } });
    await presenca.sincronizar();
    expect(presenca.obter()).toMatchObject({
      visivel: true,
      sincronizado: false,
      pessoas: [],
    });
  });

  it("Gestor desativado não consulta nem exibe pessoas online", async () => {
    const { presenca, cliente } = montar({
      perfil: { ...GESTOR, ativo: false },
    });
    await presenca.sincronizar();
    expect(chamadas(cliente, "listar_presenca_online_monitora")).toHaveLength(
      0,
    );
    expect(presenca.obter().visivel).toBe(false);
  });

  it("bate a cada 90 s e avisa na hora a troca de lugar", async () => {
    vi.useFakeTimers();
    const { presenca, cliente, avisarNavegacao, mudar } = montar();
    presenca.acompanhar();
    presenca.iniciar();
    await vi.advanceTimersByTimeAsync(0);
    expect(chamadas(cliente, "registrar_presenca_monitora")).toHaveLength(1);
    // Marcação do menu sem troca de lugar: nada sai.
    avisarNavegacao({ tipo: "menu" });
    expect(chamadas(cliente, "registrar_presenca_monitora")).toHaveLength(1);
    mudar("nucleo", "Editais · SEDE");
    avisarNavegacao({ tipo: "menu" });
    await vi.advanceTimersByTimeAsync(0);
    expect(chamadas(cliente, "registrar_presenca_monitora")).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(INTERVALO_DA_PRESENCA_MS);
    expect(chamadas(cliente, "registrar_presenca_monitora")).toHaveLength(3);
    presenca.parar();
    await vi.advanceTimersByTimeAsync(INTERVALO_DA_PRESENCA_MS * 3);
    expect(chamadas(cliente, "registrar_presenca_monitora")).toHaveLength(3);
    expect(presenca.obter()).toMatchObject({ visivel: false, aberto: false });
  });

  it("abrir a lista relê só a lista; Esc/fechar fecha", async () => {
    const { presenca, cliente } = montar();
    presenca.alternar();
    await Promise.resolve();
    expect(presenca.obter().aberto).toBe(true);
    expect(chamadas(cliente, "listar_presenca_online_monitora")).toHaveLength(
      1,
    );
    expect(chamadas(cliente, "registrar_presenca_monitora")).toHaveLength(0);
    presenca.fechar();
    expect(presenca.obter().aberto).toBe(false);
  });

  it("aba oculta pausa a batida; a volta bate uma vez só, sem dobrar", async () => {
    vi.useFakeTimers();
    const { presenca, cliente, documento } = montar();
    presenca.acompanhar();
    presenca.iniciar();
    await vi.advanceTimersByTimeAsync(0);
    expect(chamadas(cliente, "registrar_presenca_monitora")).toHaveLength(1);
    documento.mudar("hidden");
    await vi.advanceTimersByTimeAsync(INTERVALO_DA_PRESENCA_MS * 4);
    expect(chamadas(cliente, "registrar_presenca_monitora")).toHaveLength(1);
    documento.mudar("visible");
    // Um segundo aviso de visível (o Supabase e o ciclo de fundo também avisam) não dobra.
    documento.mudar("visible");
    await vi.advanceTimersByTimeAsync(0);
    expect(chamadas(cliente, "registrar_presenca_monitora")).toHaveLength(2);
    // O relógio recomeça da volta: a próxima, 90 s depois.
    await vi.advanceTimersByTimeAsync(INTERVALO_DA_PRESENCA_MS - 1);
    expect(chamadas(cliente, "registrar_presenca_monitora")).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(chamadas(cliente, "registrar_presenca_monitora")).toHaveLength(3);
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
    expect(chamadas(cliente, "registrar_presenca_monitora")).toHaveLength(1);
  });

  it("iniciada com a aba oculta, só começa quando ela fica visível", async () => {
    vi.useFakeTimers();
    const { presenca, cliente, documento } = montar();
    presenca.acompanhar();
    documento.visibilityState = "hidden";
    presenca.iniciar();
    await vi.advanceTimersByTimeAsync(INTERVALO_DA_PRESENCA_MS * 2);
    expect(chamadas(cliente, "registrar_presenca_monitora")).toHaveLength(0);
    documento.mudar("visible");
    await vi.advanceTimersByTimeAsync(0);
    expect(chamadas(cliente, "registrar_presenca_monitora")).toHaveLength(1);
  });

  it("lista fechada: a contagem relida no máximo a cada 10 min; aberta, a cada batida", async () => {
    vi.useFakeTimers();
    const { presenca, cliente } = montar();
    const listas = () =>
      chamadas(cliente, "listar_presenca_online_monitora").length;
    presenca.iniciar();
    await vi.advanceTimersByTimeAsync(0);
    expect(listas()).toBe(1);
    await vi.advanceTimersByTimeAsync(INTERVALO_DA_PRESENCA_MS * 3);
    expect(chamadas(cliente, "registrar_presenca_monitora")).toHaveLength(4);
    expect(listas()).toBe(1);
    await vi.advanceTimersByTimeAsync(LISTA_FECHADA_MS);
    expect(listas()).toBe(2);
    presenca.alternar();
    await vi.advanceTimersByTimeAsync(0);
    const aoAbrir = listas();
    await vi.advanceTimersByTimeAsync(INTERVALO_DA_PRESENCA_MS * 2);
    expect(listas()).toBe(aoAbrir + 2);
  });
});
