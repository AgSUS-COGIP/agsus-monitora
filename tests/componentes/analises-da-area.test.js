import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { montarAnalisesDaArea } from "../../src/componentes/analises-da-area/analises-da-area.jsx";
import { clicar, digitar, escolher, esperar } from "./interacoes.js";
import {
  definirAreaAtual,
  definirAreasDoUsuario,
  redefinirDadosDoMonitoramento,
} from "../../src/componentes/dados-do-monitoramento.js";

/*
  O painel de Análises por área em React: a costura entre a RPC
  get_analises_da_area (payload posicional), a lógica de
  src/lib/analises-da-area.js e o desenho. A área atual começa em Projetos.
*/

const COLUNAS = [
  "id",
  "unidade",
  "edital",
  "codigo_vaga",
  "nome_vaga",
  "municipio",
  "uf",
  "candidato",
  "status_consolidado",
  "responsavel_analise",
  "data_analise",
  "experiencia_profissional_anos",
  "experiencia_profissional_meses",
  "experiencia_profissional_dias",
  "experiencia_profissional_total",
  "link_pdf",
  "origem_arquivo_id",
  "ativo",
];

const VAGA = (cidade, uf) =>
  `Cargo 1: Médico - UBS móvel ${cidade}/${uf} - Cadastro Reserva`;

function linhaProjetos(i, status, responsavel = "Ana", cidade = "Seropédica") {
  return [
    `p${i}`,
    "Especialistas Caminhoneiros",
    "30/2026",
    String(1000 + i),
    VAGA(cidade, cidade === "Irati" ? "PR" : "RJ"),
    null, // município vem do nome da vaga (rede de segurança)
    null,
    `Candidato ${String(i).padStart(3, "0")}`,
    status,
    responsavel,
    `2026-06-${String(10 + (i % 3)).padStart(2, "0")}`,
    8,
    2,
    15,
    2995,
    "https://drive.google.com/file/d/abc/view",
    "1sw9t3-zr3KVqra_twCw1o9dYbxFEmnSXDKq_SvL7BL4",
    true,
  ];
}

const PROJETOS = [
  linhaProjetos(1, "Aprovado"),
  linhaProjetos(2, "Reprovado", "Bruno"),
  linhaProjetos(3, "Aprovado", "Bruno", "Irati"),
  linhaProjetos(4, "Pendente", ""),
];

const payload = (area, rows) => ({
  schema_version: 1,
  area,
  scope: "ativo",
  columns: COLUNAS,
  rows,
  editais: [
    {
      unidade: "Agora tem Especialistas Caminhoneiros",
      edital: "30/2026",
      ativo: true,
      data_inicio_analise: "2026-06-11",
      data_fim_analise: "2026-07-02",
    },
  ],
  total: rows.length,
});

function supabaseFalso({ linhas = PROJETOS, erro = null } = {}) {
  return {
    auth: {
      getSession: async () => ({
        data: { session: { access_token: "token" } },
        error: null,
      }),
    },
    rpc: vi.fn(async (nome, argumentos) => {
      if (nome === "get_analises_da_area") {
        if (erro) return { data: null, error: erro };
        if (argumentos.p_area === "sede")
          return { data: payload("sede", []), error: null };
        return { data: payload(argumentos.p_area, linhas), error: null };
      }
      if (nome === "get_analise_detalhe_da_area")
        return {
          data: {
            id: argumentos.p_id,
            analise: "Comprovou 8 anos de experiência.",
            regime: "Presencial",
          },
          error: null,
        };
      throw new Error(`RPC inesperada: ${nome}`);
    }),
  };
}

let controlador = null;

beforeEach(() => {
  definirAreasDoUsuario(["saude-indigena", "sede", "projetos"]);
  definirAreaAtual("projetos");
});

async function montar(opcoes = {}) {
  document.body.innerHTML = `<section id="page-analises" class="page active"></section>`;
  const supabase = opcoes.supabase || supabaseFalso();
  await act(async () => {
    controlador = montarAnalisesDaArea({
      secao: document.getElementById("page-analises"),
      supabase,
      agora: () => new Date(2026, 8, 28),
    });
  });
  if (opcoes.abrir !== false) await esperar(() => controlador.render());
  return { supabase };
}

afterEach(async () => {
  await act(async () => controlador?.raiz?.unmount());
  controlador = null;
  document.body.innerHTML = "";
  redefinirDadosDoMonitoramento();
  vi.restoreAllMocks();
});

const $ = (id) => document.getElementById(id);
const indicador = (chave) =>
  document.querySelector(`[data-indicador="${chave}"]`);
const valor = (chave) => indicador(chave).querySelector("strong").textContent;
const candidatos = () =>
  [...document.querySelectorAll("#aaLinhas .aa-candidato strong")].map(
    (celula) => celula.textContent,
  );

describe("carregamento", () => {
  it("não pede nada antes de a página abrir; ao abrir, pede a área atual e as ativas", async () => {
    const { supabase } = await montar({ abrir: false });
    expect(supabase.rpc).not.toHaveBeenCalled();
    await esperar(() => controlador.render());
    expect(supabase.rpc).toHaveBeenCalledWith("get_analises_da_area", {
      p_area: "projetos",
      p_scope: "ativo",
    });
    expect($("aaTitulo").textContent).toBe("Análises · Projetos");
  });

  it("reabrir dentro do minuto usa o cache", async () => {
    const { supabase } = await montar();
    await esperar(() => controlador.render());
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
  });

  it("troca de área no menu pede a área nova; SEDE sem dados mostra o aviso", async () => {
    const { supabase } = await montar();
    await esperar(() => definirAreaAtual("sede"));
    expect(supabase.rpc).toHaveBeenLastCalledWith("get_analises_da_area", {
      p_area: "sede",
      p_scope: "ativo",
    });
    expect($("aaTitulo").textContent).toBe("Análises · SEDE");
    expect(document.querySelector(".aa-vazio").textContent).toBe(
      "Ainda não há análises da SEDE. Elas aparecem quando a planilha da SEDE começar a enviar.",
    );
  });

  it("Situação pede de novo com o escopo escolhido", async () => {
    const { supabase } = await montar();
    await escolher($("aaEscopo"), "todos");
    expect(supabase.rpc).toHaveBeenLastCalledWith("get_analises_da_area", {
      p_area: "projetos",
      p_scope: "todos",
    });
  });

  it("sem permissão, diz isso em vez de despejar o erro do banco", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await montar({
      supabase: supabaseFalso({
        erro: { code: "42501", message: "Sem permissão" },
      }),
    });
    expect(document.querySelector('[role="alert"]').textContent).toContain(
      "Seu perfil não tem acesso às análises desta área.",
    );
  });
});

describe("indicadores e filtros", () => {
  it("conta os status como o painel antigo", async () => {
    await montar();
    expect(valor("total")).toBe("4");
    expect(valor("realizadas")).toBe("3");
    expect(valor("pendentes")).toBe("1");
    expect(valor("aprovados")).toBe("2");
    expect(valor("reprovados")).toBe("1");
    expect(valor("taxa")).toBe("75%");
  });

  it("clicar num indicador filtra a tabela; clicar de novo desliga", async () => {
    await montar();
    await clicar(indicador("aprovados"));
    expect(indicador("aprovados").getAttribute("aria-pressed")).toBe("true");
    expect(candidatos()).toEqual(["Candidato 001", "Candidato 003"]);
    // Os outros cartões continuam contando tudo que os filtros deixam.
    expect(valor("reprovados")).toBe("1");

    await clicar(indicador("aprovados"));
    expect(indicador("aprovados").getAttribute("aria-pressed")).toBe("false");
    expect(candidatos()).toHaveLength(4);
  });

  it("Projetos tem Município/UF: coluna e filtro", async () => {
    await montar();
    expect(
      [...document.querySelectorAll(".aa-tabela th")].map(
        (th) => th.textContent,
      ),
    ).toContain("Município/UF");
    await escolher($("aaMunicipio"), "Irati/PR");
    expect(candidatos()).toEqual(["Candidato 003"]);
  });

  it("busca sem acento e Limpar volta tudo", async () => {
    await montar();
    await digitar($("aaBusca"), "bruno");
    expect(candidatos()).toEqual(["Candidato 002", "Candidato 003"]);
    await clicar($("aaLimpar"));
    expect(candidatos()).toHaveLength(4);
  });

  it("gráficos por responsável e diário", async () => {
    await montar();
    const nomes = [...document.querySelectorAll(".aa-barra-nome")].map(
      (item) => item.textContent,
    );
    expect(nomes).toEqual(["Bruno", "Ana", "Sem responsável"]);
    expect(document.querySelectorAll(".aa-colunas li")).toHaveLength(3);
  });
});

describe("tabela", () => {
  it("desenha 50 por vez e carrega mais no botão", async () => {
    const muitas = Array.from({ length: 120 }, (_, i) =>
      linhaProjetos(i + 1, "Pendente"),
    );
    await montar({ supabase: supabaseFalso({ linhas: muitas }) });
    expect(candidatos()).toHaveLength(50);
    await clicar(
      [...document.querySelectorAll(".aa-mais button")].find(
        (botao) => botao.textContent === "Carregar mais",
      ),
    );
    expect(candidatos()).toHaveLength(100);
  });

  it("detalhe abre com experiência por extenso e o texto da análise", async () => {
    const { supabase } = await montar();
    await clicar(
      document.querySelector(
        'button[aria-label="Ver detalhes de Candidato 001"]',
      ),
    );
    await esperar();
    const gaveta = $("aaDetalhe");
    expect(gaveta).not.toBeNull();
    expect(supabase.rpc).toHaveBeenCalledWith("get_analise_detalhe_da_area", {
      p_id: "p1",
    });
    expect(gaveta.textContent).toContain("8 anos, 2 meses e 15 dias");
    expect(gaveta.textContent).toContain("Comprovou 8 anos de experiência.");
    expect(gaveta.textContent).toContain("11/06/2026 a 02/07/2026");
    expect(gaveta.textContent).not.toContain("Critério étnico");
    expect(gaveta.querySelector('a[href*="docs.google.com"]')).not.toBeNull();

    await clicar(gaveta.querySelector('button[aria-label="Fechar detalhes"]'));
    expect($("aaDetalhe")).toBeNull();
  });

  it("exporta o CSV das linhas filtradas", async () => {
    let blob = null;
    URL.createObjectURL = vi.fn((recebido) => {
      blob = recebido;
      return "blob:teste";
    });
    URL.revokeObjectURL = vi.fn();
    const clique = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    await montar();
    await clicar(indicador("reprovados"));
    await clicar($("aaExportar"));
    expect(clique).toHaveBeenCalled();
    const texto = await blob.text();
    const linhas = texto.replace(/^\uFEFF/, "").split("\r\n");
    expect(linhas).toHaveLength(2);
    expect(linhas[1]).toContain("Candidato 002");
  });
});
