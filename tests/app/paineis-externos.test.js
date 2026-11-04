import { beforeEach, describe, expect, it, vi } from "vitest";
import { criarPaineisExternos } from "../../src/app/paineis-externos.ts";

/*
  Os painéis externos (src/app/paineis-externos.ts): a lista, os liberados
  para o perfil e o quadro de cada painel (iframe na primeira abertura).
*/

const PAINEIS = [
  {
    id: "1",
    codigo: "bi",
    titulo: "BI RH",
    url: "https://bi.exemplo/rh",
    ordem: 2,
  },
  {
    id: "2",
    codigo: "obras",
    titulo: "Obras",
    url: "https://obras.exemplo",
    ordem: 1,
  },
  {
    id: "3",
    codigo: "inativo",
    titulo: "Velho",
    url: "https://x",
    ativo: false,
  },
  {
    id: "4",
    codigo: "manut",
    titulo: "Em obra",
    url: "https://y",
    em_manutencao: true,
  },
  { id: "5", codigo: "semurl", titulo: "Sem URL", url: "javascript:alert(1)" },
  { id: "6", codigo: "analises", titulo: "Analises", url: "/analises.html" },
];

const COM_MATRIZ = { id: "m", ativo: true, permissoes: { paineis: "leitor" } };
const GESTOR = { id: "g", ativo: true, perfil: "edital_gestor" };

function montar(perfil = GESTOR) {
  document.body.className = "";
  document.body.innerHTML = `
    <section id="page-external" class="page">
      <h3 id="externalTitle"></h3><a id="externalOpen"></a>
      <div id="externalMount" class="external-placeholder">Escolha</div>
    </section>`;
  const estado = { definirPaineisCarregados: vi.fn() };
  const avisar = vi.fn();
  const aoTentarDeNovo = vi.fn();
  const paineis = criarPaineisExternos({
    cliente: () => null,
    origem: () => "https://monitora.exemplo",
    obterPerfil: () => perfil,
    configuracao: (chave) =>
      ({
        maintenance_title: "Em manutenção",
        maintenance_message: "Volte mais tarde",
        external_placeholder: "Escolha um painel",
      })[chave] || "",
    avisar,
    aoTentarDeNovo,
    estado,
  });
  return { paineis, estado, avisar };
}

const carregar = (paineis, dados = PAINEIS) =>
  paineis.carregar({ consulta: Promise.resolve({ data: dados, error: null }) });

beforeEach(() => vi.restoreAllMocks());

describe("lista e permissões", () => {
  it("tira o painel antigo de análises e publica para as Configurações", async () => {
    const { paineis, estado } = montar();
    await carregar(paineis);
    const publicados = estado.definirPaineisCarregados.mock.calls[0][0];
    expect(publicados.map((p) => p.codigo)).not.toContain("analises");
  });

  it("sem matriz: todos os ativos ficam liberados; o menu sai em ordem", async () => {
    const { paineis } = montar();
    await carregar(paineis);
    paineis.completarLiberados();
    expect(paineis.podeAbrir("bi")).toBe(true);
    expect(paineis.podeAbrir("inativo")).toBe(false);
    // Sem ordem conta como 0.
    expect(paineis.doMenu().map((p) => p.codigo)).toEqual([
      "manut",
      "semurl",
      "obras",
      "bi",
    ]);
    expect(paineis.primeiro().codigo).toBe("bi");
  });

  it("com matriz: só os ids liberados pela sessão", async () => {
    const { paineis } = montar(COM_MATRIZ);
    await carregar(paineis);
    paineis.definirLiberados(["2"]);
    paineis.completarLiberados();
    expect(paineis.podeAbrir("obras")).toBe(true);
    expect(paineis.podeAbrir("bi")).toBe(false);
  });

  it("erro na consulta: lista vazia", async () => {
    const { paineis } = montar();
    await paineis.carregar({
      consulta: Promise.resolve({ data: null, error: { message: "x" } }),
    });
    expect(paineis.doMenu()).toEqual([]);
  });
});

describe("quadro", () => {
  it("o iframe nasce na primeira abertura e é reaproveitado", async () => {
    const { paineis } = montar();
    await carregar(paineis);
    paineis.completarLiberados();
    expect(paineis.mostrar("bi").titulo).toBe("BI RH");
    const quadro = document.querySelector("#external-panel-bi iframe");
    expect(quadro.getAttribute("src")).toBe("https://bi.exemplo/rh");
    expect(quadro.className).toBe("external-frame");
    expect(quadro.getAttribute("allow")).toBe("fullscreen; clipboard-write");
    // Apps Script e Looker Studio precisam destes; nada de navegar o topo sem clique.
    const sandbox = quadro.getAttribute("sandbox").split(" ");
    expect(sandbox).toEqual(
      expect.arrayContaining([
        "allow-scripts",
        "allow-same-origin",
        "allow-forms",
        "allow-popups",
        "allow-popups-to-escape-sandbox",
        "allow-downloads",
        "allow-top-navigation-by-user-activation",
      ]),
    );
    expect(sandbox).not.toContain("allow-top-navigation");
    expect(document.getElementById("externalTitle").textContent).toBe("BI RH");
    expect(document.getElementById("externalOpen").href).toBe(
      "https://bi.exemplo/rh",
    );
    expect(document.body.classList).toContain("external-panel-mode");
    paineis.mostrar("obras");
    expect(document.getElementById("external-panel-bi").hidden).toBe(true);
    paineis.mostrar("bi");
    expect(document.querySelectorAll("#external-panel-bi iframe")).toHaveLength(
      1,
    );
    expect(document.getElementById("external-panel-obras").hidden).toBe(true);
  });

  it("a cobertura diz o que está carregando até o site responder", async () => {
    const { paineis } = montar();
    await carregar(paineis);
    paineis.completarLiberados();
    paineis.mostrar("bi");
    expect(
      document.querySelector("#external-panel-bi .carregamento-do-painel")
        ?.textContent,
    ).toContain("Carregando o painel");
  });

  it("em manutenção ou sem endereço válido: aviso, sem iframe", async () => {
    const { paineis } = montar();
    await carregar(paineis);
    paineis.completarLiberados();
    paineis.mostrar("manut");
    const manut = document.getElementById("external-panel-manut");
    expect(manut.querySelector("iframe")).toBeNull();
    expect(manut.textContent).toContain("Volte mais tarde");
    paineis.mostrar("semurl");
    const sem = document.getElementById("external-panel-semurl");
    expect(sem.querySelector("iframe")).toBeNull();
    expect(sem.textContent).toContain("Cadastre uma URL");
  });

  it("painel não liberado: avisa e não abre", async () => {
    const { paineis, avisar } = montar();
    await carregar(paineis);
    expect(paineis.mostrar("inativo")).toBeNull();
    expect(avisar).toHaveBeenCalledWith(
      "Painel indisponível ou inativo.",
      "warn",
    );
  });

  it("descartar, descartar os abertos e limpar ao sair", async () => {
    const { paineis } = montar();
    await carregar(paineis);
    paineis.completarLiberados();
    paineis.mostrar("bi");
    paineis.mostrar("obras");
    paineis.descartar("bi");
    expect(document.getElementById("external-panel-bi")).toBeNull();
    paineis.descartarAbertos();
    expect(document.querySelectorAll(".external-panel")).toHaveLength(0);
    paineis.mostrar("bi");
    paineis.limpar();
    expect(paineis.atual()).toBeNull();
    const montagem = document.getElementById("externalMount");
    expect(montagem.className).toBe("external-placeholder");
    expect(montagem.textContent).toBe("Escolha um painel");
    expect(paineis.liberados().size).toBe(0);
  });
});

describe("pré-conexão dos painéis", () => {
  const LOOKER = {
    id: "7",
    codigo: "recrutamento",
    titulo: "Formas de Ingresso",
    url: "https://datastudio.google.com/embed/reporting/x/page/y",
    ordem: 3,
    tipo_abertura: "iframe",
  };
  const links = () =>
    [...document.head.querySelectorAll("link[data-preconexao-do-painel]")].map(
      (l) =>
        `${l.rel} ${l.href.replace(/\/$/, "")}${l.crossOrigin ? " cors" : ""}`,
    );

  beforeEach(() => {
    document.head.innerHTML = "";
  });

  it("apontar ou focar o item do painel no menu pré-conecta, sem criar o iframe", async () => {
    const { paineis } = montar();
    await carregar(paineis, [...PAINEIS, LOOKER]);
    paineis.completarLiberados();
    const parar = paineis.preconectarAoApontar();
    const item = document.createElement("button");
    item.dataset.view = "panel:recrutamento";
    item.innerHTML = "<span>Formas de Ingresso</span>";
    document.body.append(item);
    item.firstChild.dispatchEvent(new Event("pointerover", { bubbles: true }));
    expect(links()).toEqual([
      "preconnect https://datastudio.google.com",
      "dns-prefetch https://datastudio.google.com",
      "preconnect https://www.gstatic.com",
      "dns-prefetch https://www.gstatic.com",
      "preconnect https://fonts.googleapis.com",
      "dns-prefetch https://fonts.googleapis.com",
      "preconnect https://fonts.gstatic.com cors",
      "dns-prefetch https://fonts.gstatic.com",
    ]);
    // Uma vez por origem.
    item.dispatchEvent(new Event("focusin", { bubbles: true }));
    expect(links()).toHaveLength(8);
    expect(document.querySelector("iframe")).toBeNull();
    parar();
  });

  it("não pré-conecta painel em manutenção, sem permissão ou de outro item do menu", async () => {
    const { paineis } = montar(COM_MATRIZ);
    await carregar(paineis, [...PAINEIS, LOOKER]);
    paineis.definirLiberados(["4"]);
    paineis.completarLiberados();
    paineis.preconectar("recrutamento");
    paineis.preconectar("manut");
    const parar = paineis.preconectarAoApontar();
    const item = document.createElement("button");
    item.dataset.view = "dashboard";
    document.body.append(item);
    item.dispatchEvent(new Event("pointerover", { bubbles: true }));
    expect(links()).toEqual([]);
    parar();
  });

  it("no ócio depois da entrada: só os painéis em iframe que a pessoa vê", async () => {
    vi.useFakeTimers();
    const { paineis } = montar();
    await carregar(paineis, [
      ...PAINEIS,
      LOOKER,
      {
        ...LOOKER,
        id: "8",
        codigo: "aba",
        url: "https://aba.exemplo",
        tipo_abertura: "aba_interna",
      },
    ]);
    paineis.completarLiberados();
    const ocioso = window.requestIdleCallback;
    window.requestIdleCallback = undefined;
    try {
      paineis.preconectarNoOcioso();
      expect(links()).toEqual([]);
      vi.advanceTimersByTime(2_000);
    } finally {
      window.requestIdleCallback = ocioso;
      vi.useRealTimers();
    }
    const origens = links().filter((l) => l.startsWith("preconnect"));
    expect(origens).toContain("preconnect https://bi.exemplo");
    expect(origens).toContain("preconnect https://obras.exemplo");
    expect(origens).toContain("preconnect https://datastudio.google.com");
    expect(origens.join()).not.toContain("aba.exemplo");
    expect(origens.join()).not.toContain("https://y");
  });
});
