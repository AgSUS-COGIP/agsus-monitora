import { readFileSync } from "node:fs";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  definirAreaAtual,
  redefinirDadosDoMonitoramento,
} from "../../src/componentes/dados-do-monitoramento.ts";
import { montarAvaliacaoDocumental } from "../../src/modulos/avaliacao-documental/avaliacao-documental.jsx";
import { comecoDoEnunciado } from "../../src/lib/avaliacao-documental/nota-declarada.js";
import {
  clicar,
  digitar,
  escolher,
  esperar,
  teclar,
} from "../componentes/interacoes.js";

/*
  A tela Avaliação documental como módulo do app
  (src/modulos/avaliacao-documental/), fase F1: monta na
  `#page-avaliacao-documental`, lista os editais da área, abre a regra e a
  equipe, cria a regra a partir de um modelo, salva versão nova com motivo,
  confere, testa com um candidato fictício sem gravar e grava a equipe.
  Códigos AM-1.x, AM-2.x e AM-3.x de docs/historias-de-usuario/analises-no-monitora.md.
*/

const { regras } = JSON.parse(
  readFileSync(
    "tests/fixtures/avaliacao-documental/casos-de-pontuacao.json",
    "utf8",
  ),
);
const PROJ = regras["PROJ26-CURRICULAR"];
const U = (n) => `00000000-0000-4000-a000-00000000000${n}`;

const regraSalva = (versao, configuracao = PROJ, situacao = "CONFERIR") => ({
  versao,
  situacao,
  modelo_origem: "PROJ26-CURRICULAR",
  configuracao,
  atualizado_em: "2026-10-06T12:00:00Z",
  por: "Gestora",
  versoes: [
    {
      versao,
      em: "2026-10-06T12:00:00Z",
      por: "Gestora",
      motivo: "Copiada do modelo",
      configuracao,
    },
  ],
});

const DADOS = (regra, pode = true) => ({
  schema_version: 1,
  edital: {
    id: "e93",
    edital: "93/2026",
    unidade: "Boa Vista",
    area: "projetos",
    numero: "93/2026",
    id_unidade: null,
  },
  papel: pode ? "COORDENADOR" : null,
  pode_coordenar: pode,
  origem: "PLANILHA",
  regra,
  modelos: [
    { codigo: "PROJ26-CURRICULAR", nome: "Projetos", configuracao: PROJ },
  ],
  nota_minima: { nota_minima: 15, nota_minima_por_nivel: {} },
  aldeias: { quantidade: 0 },
  pode_carregar_aldeias: false,
  vagas_empregare: 1,
  fichas_concluidas: 0,
});
/* obter_perguntas_carga_analise (20261009180000): só a coordenação recebe as perguntas. */
const PERGUNTAS_DA_CARGA = (pode) => ({
  schema_version: 1,
  perguntas: pode
    ? [
        {
          coluna: "Pergunta 5 - Sistema de concorrência",
          respostas: [{ valor: "Ampla concorrência", quantidade: 2 }],
          outras: 1,
          distintas: 2,
        },
        {
          coluna: "Pergunta 9 - Informe seu CPF",
          respostas: [],
          outras: 3,
          distintas: 3,
          dado_pessoal: true,
        },
      ]
    : [],
});
const EQUIPE = {
  papel: "COORDENADOR",
  pode_coordenar: true,
  gestores: [{ usuario: U(1), nome: "Gestora" }],
  equipe: [],
  pessoas: [
    { usuario: U(2), nome: "Ana Analista", nivel: 2, gestor: false },
    { usuario: U(3), nome: "Rui Revisor", nivel: 2, gestor: false },
  ],
  vagas: ["177001"],
};

function supabaseFalso({ comRegra = true, pode = true, salvarEquipe } = {}) {
  let regra = comRegra ? regraSalva(1) : null;
  const respostas = {
    listar_editais_avaliacao: () => ({
      area: "projetos",
      editais: [
        {
          id: "e93",
          edital: "93/2026",
          unidade: "Boa Vista",
          ativo: true,
          versao_regra: regra?.versao ?? null,
        },
      ],
    }),
    obter_regra_analise: () => DADOS(regra, pode),
    obter_perguntas_carga_analise: () => PERGUNTAS_DA_CARGA(pode),
    obter_equipe_edital: () => ({ ...EQUIPE, pode_coordenar: pode }),
    definir_origem_analise: ({ p_origem }) => ({
      origem: p_origem,
      anterior: "PLANILHA",
      mudou: true,
      publicadas: 0,
      devolvidas: 0,
    }),
    copiar_modelo_regra_analise: () => {
      regra = regraSalva(1);
      return { regra, fichas_afetadas: [] };
    },
    salvar_regra_analise: ({ p_configuracao, p_versao_atual }) => {
      regra = regraSalva(p_versao_atual + 1, p_configuracao);
      return { regra, fichas_afetadas: [] };
    },
    conferir_regra_analise: () => {
      regra = { ...regra, situacao: "CONFERIDA" };
      return { regra, fichas_afetadas: [] };
    },
    salvar_equipe_edital:
      salvarEquipe ??
      (({ p_equipe }) => ({
        ...EQUIPE,
        equipe: p_equipe.map((l, i) => ({
          id: `r${i}`,
          ...l,
          nome: "Ana Analista",
          nivel: 2,
        })),
      })),
  };
  return {
    rpc: vi.fn(async (nome, args) => {
      const r = respostas[nome]?.(args);
      return r instanceof Error
        ? { data: null, error: r }
        : { data: r ?? null, error: null };
    }),
    auth: {
      getSession: async () => ({ data: { session: { user: { id: "u" } } } }),
    },
  };
}

let secao;
let painel;
const toast = vi.fn();

async function montar(supabase) {
  secao = document.createElement("section");
  secao.id = "page-avaliacao-documental";
  secao.className = "page active";
  document.body.append(secao);
  await act(async () => {
    painel = montarAvaliacaoDocumental({ supabase, toast });
  });
  await act(async () => void painel.render());
  await esperar();
  await escolher(secao.querySelector(".avd-edital select"), "e93");
  await esperar();
}
const botao = (texto, raiz = document) =>
  [...raiz.querySelectorAll("button")].find((b) =>
    b.textContent.trim().startsWith(texto),
  );

beforeEach(() => {
  redefinirDadosDoMonitoramento();
  definirAreaAtual("projetos");
});
afterEach(async () => {
  await act(async () => painel?.raiz?.unmount());
  secao?.remove();
  document.body.innerHTML = "";
  redefinirDadosDoMonitoramento();
  toast.mockClear();
});

describe("regra da avaliação (AM-2)", () => {
  // Estes casos são do modo avançado (o formulário inteiro); o assistente tem os seus
  // (tests/modulos/avaliacao-documental-assistente.test.js).
  beforeEach(() => localStorage.setItem("avd-regra-modo", "avancado"));
  afterEach(() => localStorage.removeItem("avd-regra-modo"));
  it("AM-2.1: edital sem regra cria a versão 1 a partir do modelo", async () => {
    const supabase = supabaseFalso({ comRegra: false });
    await montar(supabase);
    expect(secao.textContent).toContain("Criar a regra do edital");
    await clicar(secao.querySelector("[data-acao='copiar-modelo']"));
    await esperar();
    expect(supabase.rpc).toHaveBeenCalledWith("copiar_modelo_regra_analise", {
      p_edital: "e93",
      p_modelo: "PROJ26-CURRICULAR",
    });
    expect(secao.textContent).toContain("Versão 1");
    expect(secao.textContent).toContain("Conferir");
    expect(secao.querySelectorAll(".avd-bloco").length).toBe(
      PROJ.blocos.length,
    );
  });

  it("AM-2.2: mudar pede o motivo e salva como versão nova", async () => {
    const supabase = supabaseFalso();
    await montar(supabase);
    const titulo = secao
      .querySelector("#avdGeral")
      .closest("section")
      .querySelector("input");
    await digitar(titulo, "Avaliação Documental e de Títulos — 93/2026");
    await clicar(secao.querySelector("[data-acao='salvar-regra']"));
    await esperar();
    expect(supabase.rpc).not.toHaveBeenCalledWith(
      "salvar_regra_analise",
      expect.anything(),
    );
    expect(secao.textContent).toContain("De 10 a 2.000 caracteres.");
    const motivo = [...secao.querySelectorAll(".ui-barra-de-salvar input")][0];
    await digitar(motivo, "Título conforme o edital publicado");
    await clicar(secao.querySelector("[data-acao='salvar-regra']"));
    await esperar();
    const chamada = supabase.rpc.mock.calls.find(
      ([nome]) => nome === "salvar_regra_analise",
    );
    expect(chamada[1]).toMatchObject({
      p_edital: "e93",
      p_versao_atual: 1,
      p_motivo: "Título conforme o edital publicado",
    });
    expect(chamada[1].p_configuracao.titulo_etapa).toBe(
      "Avaliação Documental e de Títulos — 93/2026",
    );
    expect(secao.textContent).toContain("Versão 2");
    // O formulário do PROJ26 inteiro (com as cotas PI e PQ) passa dos 5 s sob carga.
  }, 20000);

  it("marca como conferida", async () => {
    const supabase = supabaseFalso();
    await montar(supabase);
    await clicar(secao.querySelector("[data-acao='conferir-regra']"));
    await esperar();
    expect(supabase.rpc).toHaveBeenCalledWith("conferir_regra_analise", {
      p_edital: "e93",
      p_versao: 1,
    });
    expect(secao.querySelector(".avd-resumo-da-regra").textContent).toContain(
      "Conferida",
    );
  });

  it("salvar com uma leitura no ar: o cabeçalho fica na versão nova, sem voltar à anterior", async () => {
    const supabase = supabaseFalso();
    await montar(supabase);
    await clicar(secao.querySelector("[data-acao='conferir-regra']"));
    await esperar();
    const resumo = () =>
      secao.querySelector(".avd-resumo-da-regra").textContent;
    expect(resumo()).toContain("Conferida");

    // Banco lento: a leitura do "Atualizar" sai com a regra v1 e só volta
    // depois de a versão 2 ser gravada.
    const normal = supabase.rpc.getMockImplementation();
    let soltar;
    supabase.rpc.mockImplementation(async (nome, args) => {
      if (nome !== "obter_regra_analise") return normal(nome, args);
      const velha = await normal(nome, args);
      await new Promise((r) => {
        soltar = r;
      });
      return velha;
    });
    await clicar(secao.querySelector("[data-acao='atualizar']"));
    await esperar();
    expect(soltar).toBeTypeOf("function");
    supabase.rpc.mockImplementation(normal);

    const titulo = secao
      .querySelector("#avdGeral")
      .closest("section")
      .querySelector("input");
    await digitar(titulo, "Avaliação Documental e de Títulos — 93/2026");
    await digitar(
      secao.querySelector(".ui-barra-de-salvar input"),
      "Título conforme o edital publicado",
    );
    await clicar(secao.querySelector("[data-acao='salvar-regra']"));
    await esperar();
    expect(resumo()).toContain("Versão 2");

    await act(async () => soltar());
    await esperar();
    expect(resumo()).toContain("Versão 2");
    expect(resumo()).toContain("Conferir");
    expect(secao.querySelector("[data-acao='conferir-regra']")).not.toBeNull();
    expect(
      secao.querySelector("[data-acao='salvar-regra']").textContent,
    ).toContain("versão 3");
    expect(secao.querySelector("[data-status-da-carga]").textContent).toBe(
      "Versão 2 · Conferir",
    );
  }, 20000);

  it("AM-2.4: liga uma pergunta da carga a um bloco", async () => {
    await montar(supabaseFalso());
    const perguntas = secao.querySelector("#avdPerguntas").closest("section");
    await escolher(perguntas.querySelector("select"), "COTA_PP");
    await clicar(botao("Ligar", perguntas));
    expect(perguntas.textContent).toContain("Ligada");
    // Liga pelo começo do enunciado, não pelo número (que muda de vaga para vaga).
    expect(comecoDoEnunciado("Pergunta 15 - Outras formações")).toBe(
      "Outras formações",
    );
    expect(
      comecoDoEnunciado(
        "Pergunta 11 - Experiência Profissional em atividades compatíveis com o cargo: (contabilizada a partir de 06 meses",
      ),
    ).toBe("Experiência Profissional em atividades compatíveis com o cargo");
    expect(
      comecoDoEnunciado(
        "Pergunta 19 - Candidatos&nbsp;concorrendo às vagas destinadas a Pretos ou Pardos, grave um vídeo",
      ),
    ).toBe(
      "Candidatos concorrendo às vagas destinadas a Pretos ou Pardos, grave um vídeo",
    );
    expect(comecoDoEnunciado("SITUAÇÃO")).toBe("SITUAÇÃO");
  });

  it("nota declarada com pontos por nível: uma coluna por nível, salva em pontos_por_nivel", async () => {
    const supabase = supabaseFalso();
    await montar(supabase);
    const grupo = [...secao.querySelectorAll(".avd-subgrupo")].find((g) =>
      g.querySelector("h3")?.textContent.startsWith("Nota recalculada"),
    );
    await clicar(botao("Pergunta pontuada", grupo));
    const item = [...grupo.querySelectorAll(".avd-declarada")].at(-1);
    const caixa = [...item.querySelectorAll("label")]
      .find((l) => l.textContent.includes("Pontos por nível"))
      .querySelector("input");
    await clicar(caixa);
    const rotulo = [...item.querySelectorAll("label")].find((l) =>
      l.textContent.includes("Pergunta (começo"),
    );
    const pergunta = document.getElementById(rotulo.htmlFor);
    await digitar(pergunta, "Experiência Profissional");
    const resposta = item.querySelector(
      "input[placeholder='Texto exato da resposta']",
    );
    await digitar(resposta, "1 ano");
    await teclar(resposta, "Enter");
    const linha = item.querySelector(".avd-recuo");
    expect(linha.textContent).toContain("1 ano");
    expect(linha.textContent).toContain("Superior");
    expect(linha.textContent).toContain("Técnico");
    expect(linha.textContent).toContain("Médio");
    const [superior, tecnico] = linha.querySelectorAll("input");
    await digitar(superior, "5");
    await digitar(tecnico, "4");
    const motivo = [...secao.querySelectorAll(".ui-barra-de-salvar input")][0];
    await digitar(motivo, "Experiência por nível conforme o edital");
    await clicar(secao.querySelector("[data-acao='salvar-regra']"));
    await esperar();
    const chamada = supabase.rpc.mock.calls.find(
      ([nome]) => nome === "salvar_regra_analise",
    );
    const salvo = chamada[1].p_configuracao.provisoria.nota_declarada.at(-1);
    expect(salvo.pontos).toBeUndefined();
    expect(salvo.pontos_por_nivel).toEqual({
      superior: { "1 ano": 5 },
      tecnico: { "1 ano": 4 },
      medio: { "1 ano": 0 },
    });
  }, 20000);

  it("AM-2.7: a prévia calcula a nota, a situação e o parecer sem gravar", async () => {
    const supabase = supabaseFalso();
    await montar(supabase);
    const previa = secao.querySelector(".avd-previa");
    await clicar(botao("Abrir", previa));
    // O corpo da prévia carrega ao abrir (lazy).
    await esperar(
      () =>
        import("../../src/modulos/avaliacao-documental/corpo-da-previa.tsx"),
    );
    await esperar();
    const chamadas = supabase.rpc.mock.calls.length;
    expect(previa.querySelector("[data-resultado]").dataset.resultado).toBe(
      "INAPTO_REQUISITO",
    );
    await clicar(botao("Vínculo", previa));
    const datas = previa.querySelectorAll("input[type='date']");
    await digitar(datas[0], "2020-01-01");
    await digitar(datas[1], "2022-12-31");
    expect(previa.querySelector("[data-resultado]").dataset.resultado).toBe(
      "APTO",
    );
    expect(previa.querySelector(".avd-nota-valor").textContent).toBe("25,0");
    expect(previa.querySelector(".avd-parecer").textContent).toContain(
      "HABILITADO(A)",
    );
    expect(supabase.rpc.mock.calls.length).toBe(chamadas);
  });

  it("quem só lê vê a regra travada, sem salvar nem perguntas", async () => {
    const supabase = supabaseFalso({ pode: false });
    await montar(supabase);
    expect(secao.querySelector(".avd-campos").disabled).toBe(true);
    expect(secao.querySelector("[data-acao='salvar-regra']")).toBeNull();
    expect(secao.querySelector("#avdPerguntas")).toBeNull();
    // As perguntas da carga nem são pedidas a quem só lê.
    expect(
      supabase.rpc.mock.calls.some(
        ([nome]) => nome === "obter_perguntas_carga_analise",
      ),
    ).toBe(false);
  });

  it("as perguntas da carga vêm da RPC própria, uma vez por edital", async () => {
    const supabase = supabaseFalso();
    await montar(supabase);
    expect(secao.querySelector("#avdPerguntas")).not.toBeNull();
    const pedidos = supabase.rpc.mock.calls.filter(
      ([nome]) => nome === "obter_perguntas_carga_analise",
    );
    expect(pedidos).toEqual([
      ["obter_perguntas_carga_analise", { p_edital: "e93" }],
    ]);
    // Pergunta que pede dado pessoal aparece sem respostas, com o aviso.
    const cpf = secao.querySelector(
      "[data-pergunta='Pergunta 9 - Informe seu CPF']",
    );
    expect(cpf.querySelector("[data-dado-pessoal]").textContent).toBe(
      "Dado pessoal — não resumido",
    );
  });
});

describe("equipe do edital (AM-3)", () => {
  async function abrirEquipe(supabase) {
    await montar(supabase);
    await clicar(botao("Equipe", secao));
    await esperar();
  }

  it("AM-3.1: o gestor aparece como coordenação; inclui analista e salva", async () => {
    const supabase = supabaseFalso();
    await abrirEquipe(supabase);
    expect(secao.textContent).toContain("Gestor do edital");
    await clicar(botao("Pessoa", secao));
    await escolher(secao.querySelector("[data-linha-equipe='0'] select"), U(2));
    await clicar(secao.querySelector("[data-acao='salvar-equipe']"));
    await esperar();
    expect(supabase.rpc).toHaveBeenCalledWith("salvar_equipe_edital", {
      p_edital: "e93",
      p_equipe: [
        { usuario: U(2), papel: "ANALISTA", vaga: null, limite: null },
      ],
      p_motivo: null,
    });
  });

  it("AM-3.2: a recusa do banco aparece com a permissão que falta", async () => {
    const erro = Object.assign(
      new Error(
        "Ana Analista não tem Editor em Avaliação documental (tem Leitor); peça em Configurações › Acessos.",
      ),
      { code: "42501" },
    );
    await abrirEquipe(supabaseFalso({ salvarEquipe: () => erro }));
    await clicar(botao("Pessoa", secao));
    await escolher(secao.querySelector("[data-linha-equipe='0'] select"), U(2));
    await clicar(secao.querySelector("[data-acao='salvar-equipe']"));
    await esperar();
    expect(secao.textContent).toContain(
      "não tem Editor em Avaliação documental (tem Leitor)",
    );
  });
});

describe("dono da avaliação do edital (20261009200000)", () => {
  it("a coordenação passa o edital para o MONITORA com confirmação e motivo", async () => {
    const supabase = supabaseFalso();
    await montar(supabase);
    const rotulo = secao.querySelector("[data-origem]");
    expect(rotulo.textContent).toContain("Avaliação: Planilha");
    await clicar(secao.querySelector("[data-acao='trocar-origem-da-analise']"));
    const confirmar = document.querySelector(
      "[data-acao='confirmar-origem-da-analise']",
    );
    expect(document.body.textContent).toContain(
      "As fichas deste edital passam a alimentar o Painel das análises",
    );
    expect(confirmar.disabled).toBe(true);
    await digitar(
      document.querySelector(".modal textarea"),
      "Edital analisado pelas fichas",
    );
    expect(confirmar.disabled).toBe(false);
    await clicar(confirmar);
    await esperar();
    expect(supabase.rpc).toHaveBeenCalledWith("definir_origem_analise", {
      p_edital: "e93",
      p_origem: "MONITORA",
      p_motivo: "Edital analisado pelas fichas",
    });
    expect(secao.querySelector("[data-origem]").textContent).toContain(
      "Avaliação: MONITORA",
    );
    expect(botao("Voltar para a planilha", secao)).toBeTruthy();
    expect(document.querySelector(".modal")).toBeNull();
  });

  it("quem não coordena só vê o dono, sem o botão", async () => {
    await montar(supabaseFalso({ pode: false }));
    expect(secao.querySelector("[data-origem]").textContent).toContain(
      "Avaliação: Planilha",
    );
    expect(
      secao.querySelector("[data-acao='trocar-origem-da-analise']"),
    ).toBeNull();
  });
});
