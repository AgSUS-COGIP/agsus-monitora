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

const celula = (nivel, origem = "grupo", nivel_grupo = nivel, revisao = 0) => ({
  nivel,
  origem,
  nivel_grupo,
  revisao,
});

const GRUPOS = [
  {
    codigo: "usuario",
    nome: "Usuário",
    revisao: 1,
    sistema: true,
    usuarios: 1,
    niveis: {
      dashboard: "leitor",
      nucleo: "leitor",
      aprovados: "leitor",
      configuracoes: "sem_acesso",
      acessos: "sem_acesso",
    },
  },
  {
    codigo: "coordenador",
    nome: "Coordenador",
    revisao: 1,
    usuarios: 1,
    niveis: { nucleo: "editor", acessos: "editor" },
  },
  {
    codigo: "admin",
    nome: "Administrador global",
    admin_global: true,
    sistema: true,
    revisao: 1,
    niveis: {},
    usuarios: 0,
  },
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
      ativo: true,
      ultimo_acesso: "2026-09-29T15:00:00Z",
      convite_pendente: false,
      areas_efetivas: ["saude-indigena"],
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
      ativo: true,
      cadastrado_em: "2026-09-28T15:00:00Z",
      ultimo_acesso: null,
      convite_pendente: true,
      areas_efetivas: ["saude-indigena"],
      permissoes: { nucleo: celula("editor") },
    },
  ],
  total: 2,
  areas: [{ id: "saude-indigena", titulo: "Saúde Indígena" }],
  paineis: [],
  grupos: GRUPOS,
  coordenacoes: [
    {
      codigo: "norte",
      nome: "Norte",
      area: "saude-indigena",
      ativo: true,
      unidades: [],
      editais: [],
      usuarios: 2,
      revisao: 1,
    },
  ],
  teto,
  historico: [],
});

const TETO_ADMIN = {
  admin_global: true,
  usuario_id: "adm",
  coordenacao: null,
  niveis: {},
  paineis: [],
};
const TETO_COORD = {
  admin_global: false,
  usuario_id: "eu",
  coordenacao: "norte",
  niveis: {
    dashboard: "leitor",
    nucleo: "editor",
    aprovados: "editor",
    configuracoes: "sem_acesso",
    acessos: "sem_acesso",
  },
  paineis: [],
};
const PEDIDO = {
  id: "s1",
  nome: "Bia",
  email: "bia@agenciasus.org.br",
  coordenacao: "norte",
  coordenacao_nome: "Norte",
  created_at: "2026-09-29T10:00:00Z",
};

function supabaseFalso(teto, extra = {}) {
  const rpc = vi.fn((nome, args) => {
    if (extra[nome]) return Promise.resolve(extra[nome](args));
    if (nome === "obter_matriz_acessos")
      return Promise.resolve({ data: MATRIZ(teto), error: null });
    if (nome === "listar_solicitacoes_acesso")
      return Promise.resolve({ data: [PEDIDO], error: null });
    if (nome === "salvar_matriz_acessos")
      return Promise.resolve({ data: { alteradas: 1 }, error: null });
    if (nome === "salvar_grupo_acesso")
      return Promise.resolve({ data: { codigo: "usuario" }, error: null });
    if (nome === "obter_contexto_de_usuario")
      return Promise.resolve({
        data: {
          profile: {
            id: "u1",
            perfil: "usuario",
            areas: ["saude-indigena"],
            permissoes: { nucleo: "leitor" },
          },
          panel_ids: [],
          escopo: {},
        },
        error: null,
      });
    return Promise.resolve({ data: { ok: true }, error: null });
  });
  return {
    rpc,
    auth: {
      getSession: async () => ({
        data: { session: { access_token: "x" } },
        error: null,
      }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
    },
  };
}

let controlador = null;
async function montar({ perfil, teto, confirmar = () => true, extra = {} }) {
  document.body.innerHTML = '<div id="acessosApp" data-acessos></div>';
  const supabase = supabaseFalso(teto, extra);
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
const COORD = {
  admin_global: false,
  coordenacao: { codigo: "norte" },
  permissoes: { acessos: "editor" },
};
const abas = () =>
  [...document.querySelectorAll('[role="tab"]')].map((b) =>
    b.firstChild.textContent.trim(),
  );
const select = (rotulo) =>
  document.querySelector(`select[aria-label="${rotulo}"]`);
/** Liga "Ver permissões por módulo (avançado)": a matriz com um select por módulo. */
const verPorModulo = () =>
  clicar(
    [...document.querySelectorAll("label.acessos-alternar input")].find(
      (el) => el.type === "checkbox",
    ),
  );
const botao = (texto) =>
  [...document.querySelectorAll("button")].find(
    (b) => b.textContent.trim() === texto,
  );

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
    await verPorModulo();
    expect(select("Grupo de Ana <img src=x>").value).toBe("usuario");
    const aprovados = select("Lista de aprovados de Ana <img src=x>");
    expect(aprovados.value).toBe("editor");
    expect(
      aprovados.querySelector('optgroup[label="Do grupo"] option').textContent,
    ).toBe("Leitor");
    expect(
      aprovados.querySelector('optgroup[label="Individual"]').children,
    ).toHaveLength(4);
    expect(document.querySelector(".acessos-salvar")).toBeNull();
    await escolher(aprovados, "");
    expect(
      document.querySelector(".acessos-salvar summary").textContent,
    ).toContain("1 alteração em 1 pessoa");
    await digitar(document.getElementById("acessosMotivo"), "Fim da exceção");
    await clicar(botao("Salvar alterações"));
    const chamada = supabase.rpc.mock.calls.find(
      ([nome]) => nome === "salvar_matriz_acessos",
    );
    expect(chamada[1]).toEqual({
      p_alteracoes: [
        {
          tipo: "nivel",
          usuario_id: "u1",
          recurso: "aprovados",
          nivel: null,
          revisao: 2,
        },
      ],
      p_motivo: "Fim da exceção",
    });
  });

  it("coordenador: a própria linha trava, nível acima do teto e grupo com Acessos ficam fora", async () => {
    await montar({ perfil: COORD, teto: TETO_COORD });
    await verPorModulo();
    expect(select("Editais de Coord").disabled).toBe(true);
    const dashboard = select("Visão geral de Ana <img src=x>");
    expect(
      [...dashboard.options].find((o) => o.value === "editor").disabled,
    ).toBe(true);
    expect(
      select("Gestão de acessos de Ana <img src=x>").querySelector(
        'option[value="editor"]',
      ).disabled,
    ).toBe(true);
    expect(select("Coordenação de Ana <img src=x>")).toBeNull();
    const grupo = select("Grupo de Ana <img src=x>");
    expect(
      [...grupo.options].find((o) => o.value === "coordenador").disabled,
    ).toBe(true);
  });

  it("o nome abre a gaveta com áreas e como a pessoa vê", async () => {
    await montar({ perfil: ADMIN, teto: TETO_ADMIN });
    await clicar(document.querySelector(".acessos-nome"));
    const gaveta = document.getElementById("acessosGaveta");
    expect(gaveta.textContent).toContain(
      "Vê só o recorte da coordenação Norte.",
    );
    expect(gaveta.textContent).toContain("Como a pessoa vê");
  });

  it("entra no grupo, muda o nível do módulo e salva com motivo", async () => {
    const supabase = await montar({ perfil: ADMIN, teto: TETO_ADMIN });
    await clicar(document.getElementById("acessos-aba-grupos"));
    expect(document.getElementById("acessosGrupoNome").value).toBe("Usuário");
    const editais = document.querySelector(
      '[role="radiogroup"][aria-label="Editais: nível no grupo"]',
    );
    await clicar(
      [...editais.querySelectorAll("button")].find(
        (b) => b.textContent === "Editor",
      ),
    );
    await digitar(
      document.getElementById("acessosGrupoMotivo"),
      "Leitura vira edição",
    );
    await clicar(botao("Salvar grupo"));
    const chamada = supabase.rpc.mock.calls.find(
      ([nome]) => nome === "salvar_grupo_acesso",
    );
    expect(chamada[1].p_grupo).toMatchObject({
      codigo: "usuario",
      revisao: 1,
      niveis: expect.objectContaining({ nucleo: "editor" }),
    });
  });

  it("pedidos pendentes aparecem em 'Pendentes' e aprovam com grupo e coordenação", async () => {
    const supabase = await montar({ perfil: ADMIN, teto: TETO_ADMIN });
    await clicar(botao("Pendentes (1)"));
    expect(document.body.textContent).toContain("bia@agenciasus.org.br");
    await clicar(botao("Aprovar"));
    const chamada = supabase.rpc.mock.calls.find(
      ([nome]) => nome === "aprovar_solicitacao_acesso",
    );
    expect(chamada[1]).toMatchObject({
      p_solicitacao_id: "s1",
      p_grupo: "usuario",
      p_coordenacao: "norte",
      p_areas: null,
    });
  });

  it("banco sem as migrations novas (PGRST202): diz a causa no lugar das abas", async () => {
    document.body.innerHTML = '<div id="acessosApp" data-acessos></div>';
    const supabase = supabaseFalso(TETO_ADMIN);
    supabase.rpc.mockImplementation((nome) =>
      Promise.resolve(
        nome === "obter_matriz_acessos"
          ? {
              data: null,
              error: {
                code: "PGRST202",
                message: "Could not find the function",
              },
            }
          : { data: [], error: null },
      ),
    );
    await act(async () => {
      controlador = montarAcessos({
        raizDaTela: document.getElementById("acessosApp"),
        supabase,
        toast: vi.fn(),
        getProfile: () => ADMIN,
      });
    });
    await esperar(() => controlador.render());
    const alerta = document.querySelector('[role="alert"]');
    expect(alerta.textContent).toContain(
      "O banco ainda não tem a atualização de acessos.",
    );
    expect(alerta.textContent).toContain("20260929121000 a 20260929121300");
    expect(document.querySelector('[role="tab"]')).toBeNull();
  });

  it("adiciona pessoa pelo e-mail, com grupo, coordenação e motivo", async () => {
    const supabase = await montar({ perfil: ADMIN, teto: TETO_ADMIN });
    await clicar(botao("Adicionar pessoa"));
    await digitar(
      document.getElementById("acessosAdicionarEmail"),
      "Nova.Pessoa@agenciasus.org.br",
    );
    await digitar(
      document.getElementById("acessosAdicionarNome"),
      "Nova Pessoa",
    );
    await escolher(
      document.getElementById("acessosAdicionarCoordenacao"),
      "norte",
    );
    await digitar(
      document.getElementById("acessosAdicionarMotivo"),
      "Entrou na equipe",
    );
    await clicar(
      [...document.querySelectorAll("#acessosAdicionar button")].find(
        (b) => b.textContent.trim() === "Adicionar pessoa",
      ),
    );
    const chamada = supabase.rpc.mock.calls.find(
      ([nome]) => nome === "adicionar_pessoa_acesso",
    );
    expect(chamada[1]).toEqual({
      p_email: "nova.pessoa@agenciasus.org.br",
      p_nome: "Nova Pessoa",
      p_grupo: "usuario",
      p_coordenacao: "norte",
      p_areas: null,
      p_motivo: "Entrou na equipe",
    });
    // Passo "Convite pronto": mensagem, copiar e abrir no e-mail.
    const modal = document.getElementById("acessosAdicionar");
    expect(modal.querySelector("h3").textContent).toBe("Convite pronto");
    const mensagem = modal.querySelector(".acessos-convite-mensagem");
    expect(mensagem.textContent).toBe(
      `Olá, Nova Pessoa! Você foi convidado(a) para o MONITORA (AgSUS). Acesse ${window.location.origin} e entre com sua conta Google nova.pessoa@agenciasus.org.br.`,
    );
    const email = [...modal.querySelectorAll("a")].find(
      (a) => a.textContent.trim() === "Abrir no e-mail",
    );
    expect(email.getAttribute("href")).toMatch(
      /^mailto:nova\.pessoa@agenciasus\.org\.br\?subject=Convite%20para%20o%20MONITORA&body=Ol%C3%A1%2C%20Nova%20Pessoa!/,
    );
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    await clicar(botao("Copiar mensagem"));
    expect(writeText).toHaveBeenCalledWith(mensagem.textContent);
    expect(modal.textContent).toContain("Mensagem copiada.");
    await clicar(botao("Concluir"));
    expect(document.getElementById("acessosAdicionar")).toBeNull();
  });

  /*
    30/09: um admin clicou em "Mover para Coordenações" (no rodapé, ao lado
    de "Desativar acesso") numa conta de PESSOA achando que era um ajuste; a
    conta foi desativada. Agora a ação mora só no "Avançado", diz o que vai
    acontecer e pede CONFIRMAR (ou o e-mail) e motivo.
  */
  it("conta de setor vira coordenação só pelo Avançado, com confirmação escrita", async () => {
    const supabase = await montar({ perfil: ADMIN, teto: TETO_ADMIN });
    await clicar(document.querySelector(".acessos-nome"));
    const gaveta = document.getElementById("acessosGaveta");
    const rotulo =
      "Esta conta é de um setor (e-mail compartilhado)? Transformar em coordenação";
    // Não fica no rodapé: lá, só "Desativar acesso".
    const rodape = gaveta.querySelector(".acessos-gaveta-rodape");
    expect(
      [...rodape.querySelectorAll("button")].map((b) => b.textContent.trim()),
    ).toEqual(["Desativar acesso"]);
    const abrir = botao(rotulo);
    expect(abrir.closest("details.acessos-avancado")).not.toBeNull();
    await clicar(abrir);
    const form = gaveta.querySelector(".acessos-mover");
    expect(form.querySelector('[role="alert"]').textContent).toContain(
      "Isto vai DESATIVAR a conta ana@agenciasus.org.br (ela não entra mais) e criar a coordenação Ana <img src=x> na área Saúde Indígena. Use só para contas compartilhadas de setor.",
    );
    const confirmar = [...form.querySelectorAll("button")].find(
      (b) => b.textContent.trim() === "Desativar a conta e criar a coordenação",
    );
    await digitar(
      document.getElementById("acessosMoverMotivo"),
      "É a conta da COET",
    );
    expect(confirmar.disabled).toBe(true);
    await digitar(document.getElementById("acessosMoverConfirmacao"), "sim");
    expect(confirmar.disabled).toBe(true);
    await digitar(
      document.getElementById("acessosMoverConfirmacao"),
      "CONFIRMAR",
    );
    expect(confirmar.disabled).toBe(false);
    await clicar(confirmar);
    const chamada = supabase.rpc.mock.calls.find(
      ([nome]) => nome === "mover_conta_para_coordenacoes",
    );
    expect(chamada[1]).toEqual({
      p_perfil_usuario_id: "u1",
      p_area: "saude-indigena",
      p_motivo: "É a conta da COET",
    });
  });

  it("a própria conta não oferece transformar em coordenação (nem desativar)", async () => {
    const eu = {
      ...MATRIZ(TETO_ADMIN).usuarios[0],
      id: "adm",
      nome: "Eu Mesma",
      email: "eu@agenciasus.org.br",
    };
    const supabase = await montar({ perfil: ADMIN, teto: TETO_ADMIN });
    const original = supabase.rpc.getMockImplementation();
    supabase.rpc.mockImplementation((nome, args) =>
      nome === "obter_matriz_acessos"
        ? Promise.resolve({
            data: { ...MATRIZ(TETO_ADMIN), usuarios: [eu] },
            error: null,
          })
        : original(nome, args),
    );
    await esperar(() => controlador.estado.carregarMatriz());
    await clicar(document.querySelector(".acessos-nome"));
    const gaveta = document.getElementById("acessosGaveta");
    expect(gaveta.textContent).toContain(
      "Seu acesso: outra pessoa deve alterar.",
    );
    expect(gaveta.textContent).not.toContain("Transformar em coordenação");
    expect(gaveta.querySelector(".acessos-gaveta-rodape")).toBeNull();
  });

  /*
    30/09: o grupo mudava na linha da tabela, a gaveta dizia "salve na
    página" e "Como a pessoa vê" ainda mostrava o salvo. Agora a gaveta tem o
    grupo no topo, o próprio Salvar com motivo e mostra o resultado.
  */
  it("gaveta: grupo no topo, 'Como a pessoa vê' com o rascunho e Salvar com motivo só desta pessoa", async () => {
    const supabase = await montar({ perfil: ADMIN, teto: TETO_ADMIN });
    // Alteração em outra pessoa, feita na matriz: não pode ir junto.
    await verPorModulo();
    await escolher(select("Editais de Coord"), "leitor");
    await verPorModulo();
    await clicar(document.querySelector(".acessos-nome"));
    const gaveta = document.getElementById("acessosGaveta");
    expect(gaveta.querySelector(".acessos-gaveta-corpo h4").textContent).toBe(
      "Grupo",
    );
    expect(gaveta.querySelector(".acessos-selo-rascunho")).toBeNull();
    await escolher(
      gaveta.querySelector('select[aria-label="Grupo de Ana <img src=x>"]'),
      "admin",
    );
    const ve = gaveta.querySelector('[aria-labelledby="acessosGavetaVe"]');
    expect(ve.querySelector("h4").textContent).toContain("Depois de salvar");
    expect(ve.textContent).toContain(
      "Administrador global: vê todas as áreas.",
    );
    expect(gaveta.textContent).not.toContain("salve na página");
    const salvar = gaveta.querySelector(".acessos-salvar-gaveta");
    expect(salvar.querySelector("summary").textContent).toBe(
      "1 alteração pendente",
    );
    expect(salvar.textContent).toContain(
      "Grupo: Usuário → Administrador global",
    );
    await clicar(
      [...salvar.querySelectorAll("button")].find(
        (b) => b.textContent.trim() === "Salvar",
      ),
    );
    // Sem motivo não grava.
    expect(
      supabase.rpc.mock.calls.some(
        ([nome]) => nome === "salvar_matriz_acessos",
      ),
    ).toBe(false);
    await digitar(
      document.getElementById("acessosGavetaMotivo"),
      "Assumiu a gestão",
    );
    await clicar(
      [...salvar.querySelectorAll("button")].find(
        (b) => b.textContent.trim() === "Salvar",
      ),
    );
    const chamada = supabase.rpc.mock.calls.find(
      ([nome]) => nome === "salvar_matriz_acessos",
    );
    expect(chamada[1]).toEqual({
      p_alteracoes: [
        { tipo: "grupo", usuario_id: "u1", grupo: "admin", revisao: "t0" },
      ],
      p_motivo: "Assumiu a gestão",
    });
    // A alteração da outra pessoa segue pendente.
    const pendentes = [...controlador.estado.obter().rascunho.keys()];
    expect(pendentes).toEqual(["eu/nucleo"]);
  });

  it("guarda de saída: com alteração pendente pergunta, e descartar limpa", async () => {
    const confirmar = vi.fn(() => false);
    await montar({ perfil: ADMIN, teto: TETO_ADMIN, confirmar });
    await verPorModulo();
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

/*
  Pedidos de 29/09: o administrador global aparece com o nível real do grupo
  (em "Gestão de acessos" é Editor, não Administrador) e uma falha de rede no
  salvar vira mensagem clara, com o botão de volta — nunca "Salvando…" preso.
*/
describe("Acessos: administrador global e falha de rede", () => {
  const ADMIN_GLOBAL = {
    id: "adm2",
    nome: "COET",
    email: "coet@agenciasus.org.br",
    grupo: "admin",
    coordenacao: null,
    revisao_conta: "t2",
    admin_global: true,
    permissoes: {
      nucleo: celula("admin"),
      acessos: celula("editor"),
    },
  };

  it("admin global: texto com o nível do grupo, sem select, e Editor em Gestão de acessos", async () => {
    const supabase = await montar({ perfil: ADMIN, teto: TETO_ADMIN });
    supabase.rpc.mockImplementation((nome) =>
      Promise.resolve({
        data:
          nome === "obter_matriz_acessos"
            ? {
                ...MATRIZ(TETO_ADMIN),
                usuarios: [ADMIN_GLOBAL],
                grupos: GRUPOS.map((g) =>
                  g.codigo === "admin"
                    ? { ...g, niveis: { nucleo: "admin", acessos: "editor" } }
                    : g,
                ),
              }
            : [],
        error: null,
      }),
    );
    await act(async () => controlador.estado.carregarMatriz());
    await verPorModulo();
    expect(select("Editais de COET")).toBeNull();
    const linha = [...document.querySelectorAll("tbody tr")].find((tr) =>
      tr.textContent.includes("COET"),
    );
    const textos = [...linha.querySelectorAll(".acessos-nivel-fixo")].map(
      (el) => el.textContent,
    );
    const colunas = [...document.querySelectorAll("thead th")].map((th) =>
      th.textContent.trim(),
    );
    const celulaDe = (rotulo) =>
      linha.children[colunas.indexOf(rotulo)].textContent.trim();
    expect(celulaDe("Editais")).toBe("Administrador");
    expect(celulaDe("Gestão de acessos")).toBe("Editor");
    expect(textos).not.toContain("Leitor");
  });

  it("'Failed to fetch' no salvar: mensagem clara, rascunho mantido e botão de volta", async () => {
    const supabase = await montar({ perfil: ADMIN, teto: TETO_ADMIN });
    const original = supabase.rpc.getMockImplementation();
    supabase.rpc.mockImplementation((nome, args) =>
      nome === "salvar_matriz_acessos"
        ? Promise.reject(new TypeError("Failed to fetch"))
        : original(nome, args),
    );
    await verPorModulo();
    await escolher(select("Editais de Ana <img src=x>"), "editor");
    await digitar(document.getElementById("acessosMotivo"), "Nova função");
    await clicar(botao("Salvar alterações"));
    expect(document.body.textContent).toContain(
      "Não foi possível falar com o servidor. Verifique a conexão e tente de novo.",
    );
    expect(document.body.textContent).not.toContain("Failed to fetch");
    expect(botao("Salvar alterações").disabled).toBe(false);
    expect(controlador.estado.obter().rascunho.size).toBe(1);
  });
});

/*
  Pedidos de 30/09: a aba Usuários fica simples (pessoa, grupo, áreas,
  coordenação, situação) e a matriz por módulo vira opção avançada. Uma conta
  de administrador foi para "Usuário" sem área e entrou num sistema vazio: a
  gaveta avisa e o salvar espera a área (o banco recusa com 23514). Quem nunca
  entrou tem o convite para reenviar ou cancelar.
*/
describe("Acessos: visão simples, trava de área e convite", () => {
  const CONTA_ADMIN = {
    id: "adm3",
    nome: "Conta Admin",
    email: "contaadmin@agenciasus.org.br",
    grupo: "admin",
    coordenacao: null,
    revisao_conta: "t3",
    admin_global: true,
    ativo: true,
    ultimo_acesso: "2026-09-30T12:00:00Z",
    convite_pendente: false,
    areas_efetivas: ["saude-indigena"],
    permissoes: {
      "area:saude-indigena": celula("sem_acesso", "excecao", "sem_acesso"),
      nucleo: celula("admin"),
    },
  };

  async function montarCom(usuarios, extra = {}) {
    const supabase = await montar({ perfil: ADMIN, teto: TETO_ADMIN });
    const original = supabase.rpc.getMockImplementation();
    supabase.rpc.mockImplementation((nome, args) =>
      nome === "obter_matriz_acessos"
        ? Promise.resolve({
            data: { ...MATRIZ(TETO_ADMIN), usuarios },
            error: null,
          })
        : extra[nome]
          ? extra[nome](args)
          : original(nome, args),
    );
    await act(async () => controlador.estado.carregarMatriz());
    return supabase;
  }
  const linhaDe = (texto) =>
    [...document.querySelectorAll("tbody tr")].find((tr) =>
      tr.textContent.includes(texto),
    );
  const gaveta = () => document.getElementById("acessosGaveta");

  it("por padrão: pessoa, grupo, áreas, coordenação e situação; sem select por módulo", async () => {
    await montar({ perfil: ADMIN, teto: TETO_ADMIN });
    const colunas = [...document.querySelectorAll("thead th")].map((th) =>
      th.textContent.trim(),
    );
    expect(colunas).toEqual([
      "Pessoa",
      "Grupo",
      "Áreas",
      "Coordenação",
      "Situação",
    ]);
    expect(select("Editais de Ana <img src=x>")).toBeNull();
    const ana = linhaDe("Ana <img src=x>");
    expect(ana.textContent).toContain("ana@agenciasus.org.br");
    expect(ana.querySelector(".acessos-chip-grupo").textContent).toBe(
      "Usuário",
    );
    expect(ana.querySelector(".acessos-grupo small").textContent).toMatch(
      /^Leitura: vê .*não altera nada\.$/,
    );
    expect(ana.textContent).toContain("Saúde Indígena");
    expect(ana.textContent).toContain("Norte");
    expect(ana.textContent).toContain("Último acesso em 29/09/2026");
    const coord = linhaDe("coord@agenciasus.org.br");
    expect(coord.querySelector(".acessos-selo-convite").textContent).toBe(
      "Convidado · ainda não entrou",
    );
    // A linha inteira abre a gaveta.
    await clicar(ana.querySelector("td"));
    expect(gaveta().querySelector("h3").textContent).toBe("Ana <img src=x>");
    const titulos = [...gaveta().querySelectorAll("h4, summary")].map((el) =>
      el.textContent.trim(),
    );
    expect(titulos.slice(0, 4)).toEqual([
      "Grupo",
      "Áreas",
      "Coordenação",
      "Como a pessoa vê",
    ]);
    expect(
      gaveta().querySelector('select[aria-label="Grupo de Ana <img src=x>"]')
        .value,
    ).toBe("usuario");
    // Voltar à matriz: o toggle mostra um select por módulo.
    await clicar(gaveta().querySelector('button[aria-label="Fechar"]'));
    await verPorModulo();
    expect(select("Editais de Ana <img src=x>")).not.toBeNull();
  });

  it("admin que vira Usuário sem área: a gaveta avisa, o salvar espera; com a área, vai tudo num lote", async () => {
    const supabase = await montarCom([CONTA_ADMIN]);
    await clicar(linhaDe("Conta Admin").querySelector("td"));
    expect(gaveta().textContent).toContain(
      "Administrador global: vê todas as áreas.",
    );
    await escolher(
      gaveta().querySelector('select[aria-label="Grupo de Conta Admin"]'),
      "usuario",
    );
    expect(gaveta().querySelector(".acessos-sem-area").textContent).toContain(
      "Sem área e sem coordenação, Conta Admin entra e não vê nada.",
    );
    expect(gaveta().textContent).toContain(
      "Leitura: vê visão geral, editais e lista de aprovados, não altera nada.",
    );
    const barra = document.querySelector(".acessos-salvar");
    expect(barra.querySelector(".acessos-sem-area").textContent).toContain(
      "Conta Admin ficaria sem nenhuma área",
    );
    await digitar(document.getElementById("acessosMotivo"), "Saiu da gestão");
    expect(botao("Salvar alterações").disabled).toBe(true);

    const caixa = [...gaveta().querySelectorAll("label")]
      .find((l) => l.textContent.trim() === "Saúde Indígena")
      .querySelector("input");
    await clicar(caixa);
    expect(gaveta().querySelector(".acessos-sem-area")).toBeNull();
    expect(
      document.querySelector(".acessos-salvar .acessos-sem-area"),
    ).toBeNull();
    await clicar(gaveta().querySelector('button[aria-label="Fechar"]'));
    await clicar(botao("Salvar alterações"));
    const chamada = supabase.rpc.mock.calls.find(
      ([nome]) => nome === "salvar_matriz_acessos",
    );
    expect(chamada[1]).toEqual({
      p_alteracoes: [
        { tipo: "grupo", usuario_id: "adm3", grupo: "usuario", revisao: "t3" },
        {
          tipo: "nivel",
          usuario_id: "adm3",
          recurso: "area:saude-indigena",
          nivel: "leitor",
          revisao: 0,
        },
      ],
      p_motivo: "Saiu da gestão",
    });
  });

  it("recusa do banco (23514) aparece com a mensagem dele e o rascunho fica", async () => {
    const mensagem =
      "Ana ficaria sem nenhuma área e não veria nada no sistema. Marque ao menos uma área (ou uma coordenação) junto com a troca de grupo.";
    await montarCom(MATRIZ(TETO_ADMIN).usuarios, {
      salvar_matriz_acessos: () =>
        Promise.resolve({
          data: null,
          error: { code: "23514", message: mensagem },
        }),
    });
    await verPorModulo();
    await escolher(select("Editais de Ana <img src=x>"), "editor");
    await digitar(document.getElementById("acessosMotivo"), "Teste");
    await clicar(botao("Salvar alterações"));
    const aviso = document.querySelector('p.alert[role="status"]');
    expect(aviso.className).toContain("warn");
    expect(aviso.textContent).toContain(mensagem);
    expect(aviso.textContent).toContain("Nada foi salvo");
    expect(controlador.estado.obter().rascunho.size).toBe(1);
  });

  it("convite pendente: a gaveta reenvia (copiar / e-mail) e cancela com motivo", async () => {
    const supabase = await montar({ perfil: ADMIN, teto: TETO_ADMIN });
    await clicar(linhaDe("coord@agenciasus.org.br").querySelector("td"));
    const secao = gaveta().querySelector(
      '[aria-labelledby="acessosGavetaConvite"]',
    );
    expect(secao.textContent).toContain("Cadastrado em 28/09/2026.");
    expect(secao.querySelector("summary").textContent).toBe("Reenviar convite");
    expect(
      secao.querySelector(".acessos-convite-mensagem").textContent,
    ).toContain("Olá, Coord! Você foi convidado(a) para o MONITORA (AgSUS).");
    expect(
      [...secao.querySelectorAll("a")]
        .find((a) => a.textContent.trim() === "Abrir no e-mail")
        .getAttribute("href"),
    ).toMatch(/^mailto:coord@agenciasus\.org\.br\?subject=/);
    expect(secao.textContent).toContain("O link sozinho não dá acesso");
    // "Desativar acesso" some: para quem nunca entrou, é "Cancelar convite".
    expect(botao("Desativar acesso")).toBeUndefined();
    await clicar(botao("Cancelar convite"));
    await digitar(
      document.getElementById("acessosCancelarConviteMotivo"),
      "Não vai mais entrar",
    );
    await clicar(
      [...secao.querySelectorAll("form button")].find(
        (b) => b.textContent.trim() === "Cancelar convite",
      ),
    );
    const chamada = supabase.rpc.mock.calls.find(
      ([nome]) => nome === "desativar_acesso_usuario",
    );
    expect(chamada[1]).toEqual({
      p_perfil_usuario_id: "eu",
      p_motivo: "Não vai mais entrar",
    });
  });
});

describe("Acessos: contas desativadas e reativação", () => {
  const DESATIVADAS = [
    {
      id: "p9",
      nome: "Caio",
      email: "caio@agenciasus.org.br",
      grupo: "coordenador",
      grupo_nome: "Coordenador",
      coordenacao: "norte",
      areas: [],
      desativada_em: "2026-09-30T15:00:00Z",
      desativada_por: "adm@agenciasus.org.br",
      motivo: "Saiu da equipe",
      pedido_pendente: true,
      ultimo_acesso: null,
    },
    {
      id: "p8",
      nome: null,
      email: "antiga@agenciasus.org.br",
      grupo: "usuario",
      grupo_nome: "Usuário",
      coordenacao: null,
      areas: ["saude-indigena"],
      desativada_em: "2026-01-10T15:00:00Z",
      desativada_por: null,
      motivo: null,
      pedido_pendente: false,
      ultimo_acesso: null,
    },
  ];
  const comDesativadas = (mais = {}) => ({
    listar_contas_desativadas: () => ({
      data: { contas: DESATIVADAS },
      error: null,
    }),
    ...mais,
  });
  const chamadas = (supabase, nome) =>
    supabase.rpc.mock.calls.filter(([n]) => n === nome);
  const modal = () => document.getElementById("acessosReativar");
  const botaoNo = (raiz, texto) =>
    [...raiz.querySelectorAll("button")].find(
      (b) => b.textContent.trim() === texto,
    );
  const linhaDe = (texto) =>
    [...document.querySelectorAll("tbody tr")].find((tr) =>
      tr.textContent.includes(texto),
    );

  async function abrirReativacaoDoCaio(mais) {
    const supabase = await montar({
      perfil: ADMIN,
      teto: TETO_ADMIN,
      extra: comDesativadas(mais),
    });
    await clicar(botao("Desativadas (2)"));
    await clicar(botaoNo(linhaDe("caio@agenciasus.org.br"), "Reativar"));
    return supabase;
  }

  it("admin: aba 'Desativadas' com contagem, quando/por quem/motivo e 'Pediu reativação'", async () => {
    await montar({ perfil: ADMIN, teto: TETO_ADMIN, extra: comDesativadas() });
    expect(document.querySelector(".acessos-resumo-contas").textContent).toBe(
      "2 ativas · 2 desativadas",
    );
    await clicar(botao("Desativadas (2)"));
    const caio = linhaDe("caio@agenciasus.org.br");
    expect(caio.textContent).toContain(
      "Desativada em 30/09/2026 por adm@agenciasus.org.br",
    );
    expect(caio.textContent).toContain("Saiu da equipe");
    expect(caio.textContent).toContain("Coordenador");
    expect(caio.textContent).toContain("Norte");
    expect(caio.textContent).toContain("Pediu reativação");
    const antiga = linhaDe("antiga@agenciasus.org.br");
    expect(antiga.textContent).toContain("Desativada em 10/01/2026");
    expect(antiga.textContent).not.toContain(" por ");
    expect(antiga.textContent).toContain("motivo não registrado");
    expect(antiga.textContent).toContain("Saúde Indígena");
    expect(antiga.textContent).not.toContain("Pediu reativação");
  });

  it("a busca da aba vale para Desativadas", async () => {
    const supabase = await montar({
      perfil: ADMIN,
      teto: TETO_ADMIN,
      extra: comDesativadas(),
    });
    await clicar(botao("Desativadas (2)"));
    vi.useFakeTimers();
    try {
      await digitar(
        document.querySelector('.acessos-busca input[type="search"]'),
        "caio",
      );
      await act(async () => vi.advanceTimersByTime(350));
    } finally {
      vi.useRealTimers();
    }
    await esperar();
    expect(chamadas(supabase, "listar_contas_desativadas").at(-1)[1]).toEqual({
      p_busca: "caio",
    });
  });

  it("reativar: vem o que a pessoa tinha, com as travas da gaveta, motivo e toast", async () => {
    const supabase = await abrirReativacaoDoCaio();
    expect(modal().querySelector("h3").textContent).toBe("Reativar Caio");
    expect(document.getElementById("acessosReativarGrupo").value).toBe(
      "coordenador",
    );
    expect(document.getElementById("acessosReativarCoordenacao").value).toBe(
      "norte",
    );
    // Sem coordenação: o grupo gerencia acessos e não há área.
    await escolher(document.getElementById("acessosReativarCoordenacao"), "");
    const avisos = [...modal().querySelectorAll(".acessos-sem-area")].map(
      (el) => el.textContent,
    );
    expect(avisos.join(" ")).toContain(
      "Sem área e sem coordenação, Caio entra e não vê nada.",
    );
    expect(avisos.join(" ")).toContain("O grupo Coordenador gerencia acessos");
    expect(botaoNo(modal(), "Reativar").disabled).toBe(true);
    await escolher(
      document.getElementById("acessosReativarCoordenacao"),
      "norte",
    );
    expect(modal().querySelector(".acessos-sem-area")).toBeNull();
    // Motivo obrigatório.
    await clicar(botaoNo(modal(), "Reativar"));
    expect(modal().textContent).toContain("Informe o motivo");
    expect(chamadas(supabase, "reativar_acesso_usuario")).toHaveLength(0);

    await digitar(
      document.getElementById("acessosReativarMotivo"),
      "Voltou para a equipe",
    );
    const lidas = chamadas(supabase, "listar_contas_desativadas").length;
    await clicar(botaoNo(modal(), "Reativar"));
    expect(chamadas(supabase, "reativar_acesso_usuario")[0][1]).toEqual({
      p_perfil_usuario_id: "p9",
      p_grupo: "coordenador",
      p_coordenacao: "norte",
      p_areas: [],
      p_motivo: "Voltou para a equipe",
    });
    expect(controlador.estado.toast).toHaveBeenCalledWith(
      "Conta reativada. Na próxima entrada, Caio verá as boas-vindas de volta.",
      "success",
    );
    expect(modal()).toBeNull();
    expect(chamadas(supabase, "listar_contas_desativadas").length).toBe(
      lidas + 1,
    );
  });

  it("reativar sem coordenação manda as áreas marcadas", async () => {
    const supabase = await abrirReativacaoDoCaio();
    await escolher(document.getElementById("acessosReativarGrupo"), "usuario");
    await escolher(document.getElementById("acessosReativarCoordenacao"), "");
    const caixa = [...modal().querySelectorAll("label")]
      .find((l) => l.textContent.trim() === "Saúde Indígena")
      .querySelector("input");
    await clicar(caixa);
    await digitar(document.getElementById("acessosReativarMotivo"), "Voltou");
    await clicar(botaoNo(modal(), "Reativar"));
    expect(chamadas(supabase, "reativar_acesso_usuario")[0][1]).toMatchObject({
      p_grupo: "usuario",
      p_coordenacao: null,
      p_areas: ["saude-indigena"],
    });
  });

  it("recusa do banco (23514 / 42501) aparece no modal, que fica aberto", async () => {
    const mensagem =
      "O grupo coordenador gerencia acessos: escolha a coordenação da pessoa";
    await abrirReativacaoDoCaio({
      reativar_acesso_usuario: () => ({
        data: null,
        error: { code: "23514", message: mensagem },
      }),
    });
    await digitar(document.getElementById("acessosReativarMotivo"), "Voltou");
    await clicar(botaoNo(modal(), "Reativar"));
    expect(modal().querySelector(".acessos-recusa").textContent).toContain(
      mensagem,
    );
    await act(async () => controlador.raiz.unmount());
    await abrirReativacaoDoCaio({
      reativar_acesso_usuario: () => ({
        data: null,
        error: { code: "42501", message: "Somente o administrador global" },
      }),
    });
    await digitar(document.getElementById("acessosReativarMotivo"), "Voltou");
    await clicar(botaoNo(modal(), "Reativar"));
    expect(modal().querySelector(".acessos-recusa").textContent).toContain(
      "Só o administrador global pode reativar contas.",
    );
  });

  it("coordenador não vê 'Desativadas' nem lê as contas desativadas", async () => {
    const supabase = await montar({
      perfil: COORD,
      teto: TETO_COORD,
      extra: comDesativadas(),
    });
    expect(
      [...document.querySelectorAll('[role="radio"]')].map((b) =>
        b.textContent.trim(),
      ),
    ).toEqual(["Ativos", "Pendentes (1)"]);
    expect(document.querySelector(".acessos-resumo-contas")).toBeNull();
    expect(chamadas(supabase, "listar_contas_desativadas")).toHaveLength(0);
  });

  it("gaveta: 'Desativar acesso' pede o motivo (obrigatório) e a conta vai para Desativadas", async () => {
    const supabase = await montar({
      perfil: ADMIN,
      teto: TETO_ADMIN,
      extra: comDesativadas(),
    });
    await clicar(linhaDe("ana@agenciasus.org.br").querySelector("td"));
    await clicar(botao("Desativar acesso"));
    const formulario = document.querySelector(
      'form[aria-label="Desativar acesso"]',
    );
    const confirmar = botaoNo(formulario, "Desativar acesso");
    expect(confirmar.disabled).toBe(true);
    expect(formulario.textContent).toContain("Motivo da desativação");
    await digitar(
      document.getElementById("acessosDesativarMotivo"),
      "Saiu da equipe",
    );
    const lidas = chamadas(supabase, "listar_contas_desativadas").length;
    await clicar(botaoNo(formulario, "Desativar acesso"));
    expect(chamadas(supabase, "desativar_acesso_usuario")[0][1]).toEqual({
      p_perfil_usuario_id: "u1",
      p_motivo: "Saiu da equipe",
    });
    expect(chamadas(supabase, "listar_contas_desativadas").length).toBe(
      lidas + 1,
    );
  });

  it("Pendentes: pedido de reativação com selo, histórico e o grupo de antes", async () => {
    const supabase = await montar({
      perfil: ADMIN,
      teto: TETO_ADMIN,
      extra: comDesativadas({
        listar_solicitacoes_acesso: () => ({
          data: [
            {
              ...PEDIDO,
              id: "s2",
              nome: "Caio",
              email: "caio@agenciasus.org.br",
              reativacao: true,
              desativada_em: "2026-09-30T15:00:00Z",
              desativada_por: "adm@agenciasus.org.br",
              motivo_desativacao: "Saiu da equipe",
              grupo_anterior: "coordenador",
            },
          ],
          error: null,
        }),
      }),
    });
    await clicar(botao("Pendentes (1)"));
    const linha = linhaDe("caio@agenciasus.org.br");
    expect(linha.querySelector(".acessos-selo-reativacao").textContent).toBe(
      "Reativação",
    );
    expect(linha.textContent).toContain(
      "Desativada em 30/09 por adm@agenciasus.org.br · motivo: Saiu da equipe",
    );
    expect(select("Grupo de Caio").value).toBe("coordenador");
    await clicar(botaoNo(linha, "Aprovar"));
    expect(
      chamadas(supabase, "aprovar_solicitacao_acesso")[0][1],
    ).toMatchObject({ p_solicitacao_id: "s2", p_grupo: "coordenador" });
  });
});
