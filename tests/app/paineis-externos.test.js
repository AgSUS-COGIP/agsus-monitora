import { beforeEach, describe, expect, it, vi } from "vitest";
import { criarPaineisExternos } from "../../src/app/paineis-externos.js";

/*
  Os painéis externos (src/app/paineis-externos.js): a lista, os liberados
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
    expect(quadro.getAttribute("allow")).toContain("fullscreen");
    expect(document.getElementById("externalTitle").textContent).toBe("BI RH");
    expect(document.getElementById("externalOpen").href).toBe(
      "https://bi.exemplo/rh",
    );
    expect(document.getElementById("page-external").classList).toContain(
      "active",
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

  it("o skeleton cobre o iframe até o site responder", async () => {
    const { paineis } = montar();
    await carregar(paineis);
    paineis.completarLiberados();
    paineis.mostrar("bi");
    expect(
      document.querySelector(
        "#external-panel-bi .esqueleto-do-painel, #external-panel-bi [class*='esqueleto']",
      ),
    ).not.toBeNull();
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
