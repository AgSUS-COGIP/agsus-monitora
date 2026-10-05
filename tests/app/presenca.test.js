import { afterEach, describe, expect, it, vi } from "vitest";
import {
  INTERVALO_DA_PRESENCA_MS,
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

function montar({ perfil = GESTOR, lista = [], erroNaLista = null } = {}) {
  const ouvintesDaNavegacao = new Set();
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

  it("bate a cada 45 s e avisa na hora a troca de lugar", async () => {
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

  it("abrir a lista relê; Esc/fechar fecha", async () => {
    const { presenca, cliente } = montar();
    presenca.alternar();
    await Promise.resolve();
    expect(presenca.obter().aberto).toBe(true);
    expect(chamadas(cliente, "registrar_presenca_monitora")).toHaveLength(1);
    presenca.fechar();
    expect(presenca.obter().aberto).toBe(false);
  });
});
