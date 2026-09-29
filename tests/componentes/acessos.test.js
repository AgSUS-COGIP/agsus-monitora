import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { montarAcessos } from "../../src/componentes/acessos/acessos.jsx";
import { clicar, digitar, escolher, esperar } from "./interacoes.js";

/*
  Configurações › Acessos em React: grupo (tag) + um select por módulo em
  Usuários, gaveta da pessoa, grupos em lista + detalhe, pedidos pendentes,
  teto do coordenador e guarda de saída. O banco confere tudo de novo; aqui é
  a tela não oferecer o que vai ser recusado.
*/

const celula = (nivel, origem = "grupo", nivel_grupo = nivel, revisao = 0) => ({ nivel, origem, nivel_grupo, revisao });

const GRUPOS = [
  { codigo: "usuario", nome: "Usuário", revisao: 1, sistema: true, usuarios: 1,
    niveis: { dashboard: "leitor", nucleo: "leitor", aprovados: "leitor", configuracoes: "sem_acesso", acessos: "sem_acesso" } },
  { codigo: "coordenador", nome: "Coordenador", revisao: 1, usuarios: 1, niveis: { nucleo: "editor", acessos: "editor" } },
  { codigo: "admin", nome: "Administrador global", admin_global: true, sistema: true, revisao: 1, niveis: {}, usuarios: 0 },
];

const MATRIZ = (teto) => ({
  usuarios: [
    {
      id: "u1",
      nome: "Ana <img src=x>",
      email: "ana@agenciasus.org.br",
      grupo: "usuario",
      coordenacao: "norte",
      revisao_conta: "t0",
      admin_global: false,
      permissoes: {
        "area:saude-indigena": celula("leitor", "excecao", "sem_acesso"),
        dashboard: celula("leitor"),
        nucleo: celula("leitor"),
        aprovados: celula("editor", "excecao", "leitor", 2),
        acessos: celula("sem_acesso"),
      },
    },
    {
      id: "eu",
      nome: "Coord",
      email: "coord@agenciasus.org.br",
      grupo: "coordenador",
      coordenacao: "norte",
      revisao_conta: "t1",
      admin_global: false,
      permissoes: { nucleo: celula("editor") },
    },
  ],
  total: 2,
  areas: [{ id: "saude-indigena", titulo: "Saúde Indígena" }],
  paineis: [],
  grupos: GRUPOS,
  coordenacoes: [{ codigo: "norte", nome: "Norte", area: "saude-indigena", ativo: true, unidades: [], editais: [], usuarios: 2, revisao: 1 }],
  teto,
  historico: [],
});

const TETO_ADMIN = { admin_global: true, usuario_id: "adm", coordenacao: null, niveis: {}, paineis: [] };
const TETO_COORD = {
  admin_global: false,
  usuario_id: "eu",
  coordenacao: "norte",
  niveis: { dashboard: "leitor", nucleo: "editor", aprovados: "editor", configuracoes: "sem_acesso", acessos: "sem_acesso" },
  paineis: [],
};
const PEDIDO = { id: "s1", nome: "Bia", email: "bia@agenciasus.org.br", coordenacao: "norte", coordenacao_nome: "Norte", created_at: "2026-09-29T10:00:00Z" };

function supabaseFalso(teto) {
  const rpc = vi.fn((nome) => {
    if (nome === "obter_matriz_acessos") return Promise.resolve({ data: MATRIZ(teto), error: null });
    if (nome === "listar_solicitacoes_acesso") return Promise.resolve({ data: [PEDIDO], error: null });
    if (nome === "salvar_matriz_acessos") return Promise.resolve({ data: { alteradas: 1 }, error: null });
    if (nome === "salvar_grupo_acesso") return Promise.resolve({ data: { codigo: "usuario" }, error: null });
    if (nome === "obter_contexto_de_usuario")
      return Promise.resolve({ data: { profile: { id: "u1", perfil: "usuario", areas: ["saude-indigena"], permissoes: { nucleo: "leitor" } }, panel_ids: [], escopo: {} }, error: null });
    return Promise.resolve({ data: { ok: true }, error: null });
  });
  return {
    rpc,
    auth: {
      getSession: async () => ({ data: { session: { access_token: "x" } }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  };
}

let controlador = null;
async function montar({ perfil, teto, confirmar = () => true }) {
  document.body.innerHTML = '<div id="acessosApp" data-acessos></div>';
  const supabase = supabaseFalso(teto);
  await act(async () => {
    controlador = montarAcessos({
      raizDaTela: document.getElementById("acessosApp"),
      supabase,
      toast: vi.fn(),
      getProfile: () => perfil,
      confirmar,
    });
  });
  await esperar(() => controlador.render());
  return supabase;
}

afterEach(async () => {
  controlador?.estado.desligar();
  await act(async () => controlador?.raiz?.unmount());
  controlador = null;
  document.body.innerHTML = "";
});

const ADMIN = { admin_global: true, permissoes: {} };
const COORD = { admin_global: false, coordenacao: { codigo: "norte" }, permissoes: { acessos: "editor" } };
const abas = () => [...document.querySelectorAll('[role="tab"]')].map((b) => b.firstChild.textContent.trim());
const select = (rotulo) => document.querySelector(`select[aria-label="${rotulo}"]`);
const botao = (texto) => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === texto);

describe("Configurações › Acessos", () => {
  it("admin vê Usuários, Grupos e Coordenações; coordenador, só Usuários", async () => {
    await montar({ perfil: ADMIN, teto: TETO_ADMIN });
    expect(abas()).toEqual(["Usuários", "Grupos", "Coordenações"]);
    await act(async () => controlador.raiz.unmount());
    await montar({ perfil: COORD, teto: TETO_COORD });
    expect(abas()).toEqual(["Usuários"]);
  });

  it("grupo é tag; módulo individual volta a 'Do grupo' e salva com motivo", async () => {
    const supabase = await montar({ perfil: ADMIN, teto: TETO_ADMIN });
    expect(document.body.textContent).toContain("Ana <img src=x>");
    expect(document.querySelector("img")).toBeNull();
    expect(select("Grupo de Ana <img src=x>").value).toBe("usuario");
    const aprovados = select("Lista de aprovados de Ana <img src=x>");
    expect(aprovados.value).toBe("editor");
    expect(aprovados.querySelector('optgroup[label="Do grupo"] option').textContent).toBe("Leitor");
    expect(aprovados.querySelector('optgroup[label="Individual"]').children).toHaveLength(4);
    expect(document.querySelector(".acessos-salvar")).toBeNull();
    await escolher(aprovados, "");
    expect(document.querySelector(".acessos-salvar summary").textContent).toContain("1 alteração em 1 pessoa");
    await digitar(document.getElementById("acessosMotivo"), "Fim da exceção");
    await clicar(botao("Salvar alterações"));
    const chamada = supabase.rpc.mock.calls.find(([nome]) => nome === "salvar_matriz_acessos");
    expect(chamada[1]).toEqual({
      p_alteracoes: [{ tipo: "nivel", usuario_id: "u1", recurso: "aprovados", nivel: null, revisao: 2 }],
      p_motivo: "Fim da exceção",
    });
  });

  it("coordenador: a própria linha trava, nível acima do teto e grupo com Acessos ficam fora", async () => {
    await montar({ perfil: COORD, teto: TETO_COORD });
    expect(select("Editais de Coord").disabled).toBe(true);
    const dashboard = select("Visão geral de Ana <img src=x>");
    expect([...dashboard.options].find((o) => o.value === "editor").disabled).toBe(true);
    expect(select("Gestão de acessos de Ana <img src=x>").querySelector('option[value="editor"]').disabled).toBe(true);
    expect(select("Coordenação de Ana <img src=x>")).toBeNull();
    const grupo = select("Grupo de Ana <img src=x>");
    expect([...grupo.options].find((o) => o.value === "coordenador").disabled).toBe(true);
  });

  it("o nome abre a gaveta com áreas e como a pessoa vê", async () => {
    await montar({ perfil: ADMIN, teto: TETO_ADMIN });
    await clicar(document.querySelector(".acessos-nome"));
    const gaveta = document.getElementById("acessosGaveta");
    expect(gaveta.textContent).toContain("Vê só o recorte da coordenação Norte.");
    expect(gaveta.textContent).toContain("Como a pessoa vê");
  });

  it("entra no grupo, muda o nível do módulo e salva com motivo", async () => {
    const supabase = await montar({ perfil: ADMIN, teto: TETO_ADMIN });
    await clicar(document.getElementById("acessos-aba-grupos"));
    expect(document.getElementById("acessosGrupoNome").value).toBe("Usuário");
    const editais = document.querySelector('[role="radiogroup"][aria-label="Editais: nível no grupo"]');
    await clicar([...editais.querySelectorAll("button")].find((b) => b.textContent === "Editor"));
    await digitar(document.getElementById("acessosGrupoMotivo"), "Leitura vira edição");
    await clicar(botao("Salvar grupo"));
    const chamada = supabase.rpc.mock.calls.find(([nome]) => nome === "salvar_grupo_acesso");
    expect(chamada[1].p_grupo).toMatchObject({ codigo: "usuario", revisao: 1, niveis: expect.objectContaining({ nucleo: "editor" }) });
  });

  it("pedidos pendentes aparecem em 'Pendentes' e aprovam com grupo e coordenação", async () => {
    const supabase = await montar({ perfil: ADMIN, teto: TETO_ADMIN });
    await clicar(botao("Pendentes (1)"));
    expect(document.body.textContent).toContain("bia@agenciasus.org.br");
    await clicar(botao("Aprovar"));
    const chamada = supabase.rpc.mock.calls.find(([nome]) => nome === "aprovar_solicitacao_acesso");
    expect(chamada[1]).toMatchObject({ p_solicitacao_id: "s1", p_grupo: "usuario", p_coordenacao: "norte", p_areas: null });
  });

  it("banco sem as migrations novas (PGRST202): diz a causa no lugar das abas", async () => {
    document.body.innerHTML = '<div id="acessosApp" data-acessos></div>';
    const supabase = supabaseFalso(TETO_ADMIN);
    supabase.rpc.mockImplementation((nome) =>
      Promise.resolve(
        nome === "obter_matriz_acessos"
          ? { data: null, error: { code: "PGRST202", message: "Could not find the function" } }
          : { data: [], error: null },
      ),
    );
    await act(async () => {
      controlador = montarAcessos({ raizDaTela: document.getElementById("acessosApp"), supabase, toast: vi.fn(), getProfile: () => ADMIN });
    });
    await esperar(() => controlador.render());
    const alerta = document.querySelector('[role="alert"]');
    expect(alerta.textContent).toContain("O banco ainda não tem a atualização de acessos.");
    expect(alerta.textContent).toContain("20260929121000 a 20260929121300");
    expect(document.querySelector('[role="tab"]')).toBeNull();
  });

  it("adiciona pessoa pelo e-mail, com grupo, coordenação e motivo", async () => {
    const supabase = await montar({ perfil: ADMIN, teto: TETO_ADMIN });
    await clicar(botao("Adicionar pessoa"));
    await digitar(document.getElementById("acessosAdicionarEmail"), "Nova.Pessoa@agenciasus.org.br");
    await digitar(document.getElementById("acessosAdicionarNome"), "Nova Pessoa");
    await escolher(document.getElementById("acessosAdicionarCoordenacao"), "norte");
    await digitar(document.getElementById("acessosAdicionarMotivo"), "Entrou na equipe");
    await clicar([...document.querySelectorAll("#acessosAdicionar button")].find((b) => b.textContent.trim() === "Adicionar pessoa"));
    const chamada = supabase.rpc.mock.calls.find(([nome]) => nome === "adicionar_pessoa_acesso");
    expect(chamada[1]).toEqual({
      p_email: "nova.pessoa@agenciasus.org.br",
      p_nome: "Nova Pessoa",
      p_grupo: "usuario",
      p_coordenacao: "norte",
      p_areas: null,
      p_motivo: "Entrou na equipe",
    });
  });

  it("conta que é coordenação vai para Coordenações pela gaveta", async () => {
    const supabase = await montar({ perfil: ADMIN, teto: TETO_ADMIN });
    await clicar(document.querySelector(".acessos-nome"));
    await clicar(botao("Mover para Coordenações"));
    await digitar(document.getElementById("acessosMoverMotivo"), "É a conta da COET");
    await clicar([...document.querySelectorAll(".acessos-mover button")].find((b) => b.textContent.trim() === "Mover para Coordenações"));
    const chamada = supabase.rpc.mock.calls.find(([nome]) => nome === "mover_conta_para_coordenacoes");
    expect(chamada[1]).toEqual({ p_perfil_usuario_id: "u1", p_area: "saude-indigena", p_motivo: "É a conta da COET" });
  });

  it("guarda de saída: com alteração pendente pergunta, e descartar limpa", async () => {
    const confirmar = vi.fn(() => false);
    await montar({ perfil: ADMIN, teto: TETO_ADMIN, confirmar });
    await escolher(select("Editais de Ana <img src=x>"), "editor");
    expect(controlador.temAlteracoesPendentes()).toBe(true);
    expect(controlador.confirmarSaida()).toBe(false);
    confirmar.mockReturnValue(true);
    await act(async () => {
      expect(controlador.confirmarSaida()).toBe(true);
    });
    expect(controlador.temAlteracoesPendentes()).toBe(false);
  });
});
