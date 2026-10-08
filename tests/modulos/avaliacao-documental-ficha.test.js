import { readFileSync } from "node:fs";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  definirAreaAtual,
  redefinirDadosDoMonitoramento,
} from "../../src/componentes/dados-do-monitoramento.ts";
import { montarAvaliacaoDocumental } from "../../src/modulos/avaliacao-documental/avaliacao-documental.jsx";
import { criarEstadoDaFicha } from "../../src/modulos/avaliacao-documental/ficha/estado-da-ficha.js";
import {
  clicar,
  digitar,
  escolher,
  esperar,
  teclar,
} from "../componentes/interacoes.js";

/*
  A ficha no modo de análise da aba Fila: o cabeçalho enxuto, o stepper com o
  progresso, o MODO FOCO (um item por vez; Conforme avança sozinho; Não
  conforme e Não enviado abrem os motivos em chips), "Ver todos" (a lista,
  lembrada no navegador), as teclas 1/2/3, J/K, Ctrl+S e Ctrl+Enter, os itens
  que pontuam na hora, a nota com justificativa, a lateral só com a nota e a
  composição, a Conclusão (resumo, parecer só com tudo conferido), o rascunho,
  "Concluir e próxima" e a ficha concluída só para leitura com "Reabrir".
  AM-7 a AM-12. Dados fictícios; a regra é o modelo PROJ26-CURRICULAR dos
  casos dourados.
*/
const CASOS = JSON.parse(
  readFileSync(
    "tests/fixtures/avaliacao-documental/casos-de-pontuacao.json",
    "utf8",
  ),
);
const REGRA = structuredClone(CASOS.regras["PROJ26-CURRICULAR"]);
const PERGUNTAS = {
  IDENTIDADE: ["Anexe o documento de identificação"],
  FORMACAO: ["Qual seu Nível de Titulação Acadêmica"],
  CURSOS: ["Selecione a pontuação relativa à carga horária de Cursos"],
  EXPERIENCIA: ["Experiência Profissional em atividades"],
};
for (const b of REGRA.blocos) b.perguntas = PERGUNTAS[b.codigo] ?? [];
REGRA.edital_rotulo = "Edital 93/2026";
REGRA.provisoria = {
  ...REGRA.provisoria,
  nota_declarada: [
    {
      parcial: "FORMACAO",
      pergunta: "Qual seu Nível de Titulação Acadêmica",
      tipo: "OPCAO",
      pontos: { Especialização: 5, Mestrado: 8 },
    },
    {
      parcial: "CURSOS",
      pergunta: "Selecione a pontuação relativa à carga horária de Cursos",
      tipo: "OPCAO",
      pontos: { "3 pontos": 3, "5 pontos": 5 },
    },
  ],
};
const RESPOSTAS = {
  "Pergunta 4 - Anexe o documento de identificação com foto": "Anexo",
  "Pergunta 11 - Experiência Profissional em atividades compatíveis com o cargo:":
    '"4 anos ou mais"',
  "Pergunta 13 - Qual seu Nível de Titulação Acadêmica?": '"Especialização"',
  "Pergunta 14 - Selecione a pontuação relativa à carga horária de Cursos":
    '"3 pontos"',
};
const EU = "u-ana";
const DAQUI_A_POUCO = new Date(Date.now() + 10 * 60 * 1000).toISOString();

const cabecalho = (extra = {}) => ({
  id: "f1",
  versao: 5,
  vaga: "179698",
  cargo: "Engenheiro de Segurança do Trabalho",
  codigo: "7001",
  nome: "Pessoa Fictícia",
  posicao: 1,
  lote: 1,
  art: 13,
  modalidade: "AC",
  situacao: "EM_ANALISE",
  responsavel: EU,
  responsavel_nome: "Ana",
  versao_regra: 4,
  reserva: {
    usuario: EU,
    nome: "Ana",
    desde: new Date().toISOString(),
    expira: DAQUI_A_POUCO,
  },
  ...extra,
});

function fichaDoBanco({
  situacao = "EM_ANALISE",
  lancamento = null,
  editar = true,
  reabrir = false,
  papel = reabrir ? "COORDENADOR" : "ANALISTA",
} = {}) {
  return {
    schema_version: 1,
    edital: { id: "e93", rotulo: "93/2026" },
    papel,
    eu: EU,
    pode_editar: editar,
    pode_reabrir: reabrir,
    ficha: {
      ...cabecalho({ situacao }),
      lancamento,
      resultado: null,
      parecer: situacao === "CONCLUIDA" ? "Parecer gravado" : null,
      rascunho_em: null,
      concluida_por: situacao === "CONCLUIDA" ? "Ana" : null,
    },
    regra: {
      versao: 4,
      vigente: 4,
      situacao: "CONFERIDA",
      configuracao: REGRA,
    },
    documental: { nota_minima: 15, nota_minima_por_nivel: {} },
    declarada_gravada: {
      art: 13,
      total: 8,
      parciais: { FORMACAO: 5, CURSOS: 3 },
    },
    respostas: RESPOSTAS,
    historico:
      situacao === "CONCLUIDA"
        ? [
            {
              versao: 9,
              acao: "CONCLUIR",
              quando: new Date().toISOString(),
              por: "Ana",
              alteracao: [
                {
                  campo: "parcial",
                  rotulo: "Experiência na área ou no SUS",
                  de: 25,
                  para: 20,
                },
              ],
            },
          ]
        : [],
  };
}

function filaDoBanco() {
  return {
    schema_version: 1,
    edital: { id: "e93", rotulo: "93/2026" },
    papel: "ANALISTA",
    pode_coordenar: false,
    pode_pegar: true,
    eu: EU,
    prazo_reserva_min: 15,
    distribuicao: { modo: "PEGAR_PROXIMO" },
    sem_ficha: 0,
    vagas: [{ codigo: "179698", cargo: "Engenheiro" }],
    analistas: [],
    filtros: [],
    candidatos: [
      {
        id: "c1",
        vaga: "179698",
        codigo: "7001",
        nome: "Pessoa Fictícia",
        situacao_pre: "NO_LOTE",
        posicao: 1,
        lote: 1,
        art: 13,
        modalidade: "AC",
        ficha: {
          id: "f1",
          versao: 5,
          situacao: "EM_ANALISE",
          responsavel: EU,
          responsavel_nome: "Ana",
          reserva: null,
        },
      },
      {
        id: "c2",
        vaga: "179698",
        codigo: "7002",
        nome: "Outra Pessoa",
        situacao_pre: "NO_LOTE",
        posicao: 2,
        lote: 1,
        art: 12,
        modalidade: "AC",
        ficha: {
          id: "f2",
          versao: 2,
          situacao: "CONCLUIDA",
          resultado: "APTO",
          nota_final: 22.5,
          responsavel: EU,
          reserva: null,
        },
      },
    ],
  };
}

function supabaseFalso(ficha = fichaDoBanco(), extra = {}) {
  const respostas = {
    listar_editais_avaliacao: () => ({
      area: "projetos",
      editais: [
        {
          id: "e93",
          edital: "93/2026",
          unidade: "",
          ativo: true,
          status: "Em andamento",
        },
      ],
    }),
    obter_regra_analise: () => ({
      edital: { id: "e93", edital: "93/2026", area: "projetos" },
      papel: "ANALISTA",
      pode_coordenar: false,
      origem: "PLANILHA",
      regra: null,
      modelos: [],
      nota_minima: null,
      aldeias: { quantidade: 0 },
      perguntas: [],
    }),
    obter_equipe_edital: () => ({
      gestores: [],
      equipe: [],
      pessoas: [],
      vagas: [],
    }),
    obter_fila_avaliacao: () => filaDoBanco(),
    reservar_ficha: () => ({
      ficha: cabecalho({ situacao: ficha.ficha.situacao }),
      reservada: ficha.pode_editar,
      somente_leitura: !ficha.pode_editar,
    }),
    obter_ficha_analise: () => ficha,
    salvar_rascunho_ficha: ({ p_versao }) => ({
      versao: p_versao + 1,
      salvo_em: new Date().toISOString(),
      alteracoes: 1,
    }),
    concluir_ficha: ({ p_versao }) => ({
      versao: p_versao + 1,
      resultado: "APTO",
      nota_final: 33,
      versao_regra: 4,
    }),
    reabrir_ficha: ({ p_versao }) => ({ versao: p_versao + 1 }),
    registrar_acesso_ficha: () => ({ registrado: true }),
    pegar_proxima_ficha: () => ({
      ficha: null,
      reservada: false,
      motivo: "Nenhuma ficha livre na fila.",
    }),
    liberar_reserva: ({ p_fichas }) => ({ liberadas: p_fichas.length }),
    renovar_reserva: () => ({ ficha: cabecalho() }),
    ...extra,
  };
  return {
    rpc: vi.fn(async (nome, args) => {
      const r = respostas[nome]?.(args);
      if (r instanceof Error) return { data: null, error: r };
      return { data: r ?? null, error: null };
    }),
    auth: {
      getSession: async () => ({ data: { session: { user: { id: EU } } } }),
    },
  };
}

let secao;
let painel;
const toast = vi.fn();
const chamadas = (supabase, nome) =>
  supabase.rpc.mock.calls.filter(([n]) => n === nome).map(([, a]) => a);
const botao = (texto, raiz = document.body) =>
  [...raiz.querySelectorAll("button")].find((b) =>
    b.textContent.trim().startsWith(texto),
  );
const cartao = (codigo) => document.querySelector(`[data-bloco='${codigo}']`);

async function abrirFicha(supabase) {
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
  await clicar(
    secao.querySelector("[data-tour='avd-visoes'] [data-valor='fila']"),
  );
  await esperar();
  await clicar(botao("Abrir", secao.querySelector("[data-candidato='7001']")));
  await esperar();
  await esperar();
}

beforeEach(() => {
  redefinirDadosDoMonitoramento();
  definirAreaAtual("projetos");
  try {
    globalThis.sessionStorage?.clear();
  } catch {
    /* sem sessão */
  }
});
afterEach(async () => {
  await act(async () => painel?.raiz?.unmount());
  secao?.remove();
  document.body.innerHTML = "";
  redefinirDadosDoMonitoramento();
  toast.mockClear();
});

/* ── Apoio do modo foco ─────────────────────────────────────────────── */

const CHAVE_DO_MODO = "monitora.avaliacao-documental.ficha-modo";
beforeEach(() => {
  try {
    globalThis.localStorage?.removeItem(CHAVE_DO_MODO);
  } catch {
    /* sem armazenamento */
  }
});
const raiz = () => document.querySelector(".avd-ficha");
const etapa = (codigo) =>
  document.querySelector(
    `[data-tour='avd-ficha-etapas'] [data-etapa='${codigo}']`,
  );
const irAo = (codigo) => clicar(etapa(codigo));
/* O avanço sozinho espera a animação do ✓ (ficha.jsx: ESPERA_PARA_AVANCAR_MS). */
const esperarAvanco = () =>
  esperar(() => new Promise((r) => setTimeout(r, 500)));
const conforme = (codigo) =>
  clicar(cartao(codigo).querySelector("[data-valor='CONFORME']"));
const parte = (parcial) =>
  document.querySelector(
    `[data-tour='avd-ficha-composicao'] [data-parcial='${parcial}']`,
  );
const abrirMais = () =>
  clicar(document.querySelector("[data-acao='mais-acoes']"));
const rodape = () => document.querySelector("[data-tour='avd-ficha-barra']");

/* Lança um título, um curso de 120 h e um vínculo de 3 anos, como declarados. */
async function lancarItensComoDeclarados() {
  await irAo("FORMACAO");
  await clicar(botao("Adicionar título", cartao("FORMACAO")));
  await irAo("CURSOS");
  await clicar(botao("Adicionar curso", cartao("CURSOS")));
  await digitar(
    cartao("CURSOS").querySelector("input[aria-label='Carga horária']"),
    "120",
  );
  await irAo("EXPERIENCIA");
  await clicar(botao("Adicionar vínculo", cartao("EXPERIENCIA")));
  await digitar(
    cartao("EXPERIENCIA").querySelector("input[aria-label='Início']"),
    "2020-01-01",
  );
  await digitar(
    cartao("EXPERIENCIA").querySelector("input[aria-label='Fim']"),
    "2022-12-31",
  );
}

describe("ficha: modo foco, um item por vez (AM-7)", () => {
  it("abre no primeiro item, com o stepper, o progresso e a lateral só com a nota", async () => {
    await abrirFicha(supabaseFalso());
    const cartoes = document.querySelectorAll(".avd-ficha-cartao");
    expect(cartoes).toHaveLength(1);
    expect(cartoes[0].dataset.bloco).toBe("IDENTIDADE");
    expect(cartoes[0].dataset.modo).toBe("foco");
    expect(cartoes[0].textContent).toContain("Item 1 de 6");
    const nomes = [
      ...document.querySelectorAll(
        "[data-tour='avd-ficha-etapas'] [data-etapa]",
      ),
    ].map((b) => b.querySelector(".avd-ficha-etapa-nome").textContent);
    expect(nomes).toEqual([
      "Identidade",
      "Formação",
      "Conselho",
      "Titulação",
      "Cursos",
      "Experiência",
      "Conclusão",
    ]);
    expect(etapa("IDENTIDADE").getAttribute("aria-current")).toBe("step");
    expect(etapa("IDENTIDADE").dataset.estado).toBe("nao_conferido");
    const progresso = document.querySelector(
      "[data-tour='avd-ficha-etapas'] [role='progressbar']",
    );
    expect(progresso.getAttribute("aria-valuenow")).toBe("0");
    expect(progresso.getAttribute("aria-valuemax")).toBe("6");
    expect(
      document.querySelector("[data-tour='avd-ficha-etapas']").textContent,
    ).toContain("0 de 6 itens conferidos");
    // A lateral: nota parcial, "Em análise", composição sem apurado antes de conferir.
    const total = document.querySelector(".avd-ficha-total");
    expect(total.textContent).toContain(
      "Em análise · 0 de 4 requisitos conferidos",
    );
    expect(total.textContent).toContain("parcial");
    expect(total.textContent).not.toContain("Inapto");
    expect(total.querySelector(".ui-selo").dataset.tom).toBe("neutro");
    const partes = [
      ...document.querySelectorAll("[data-tour='avd-ficha-composicao'] li"),
    ];
    expect(partes.map((l) => l.dataset.conferido)).toEqual([
      "nao",
      "nao",
      "nao",
    ]);
    expect(
      partes.map((l) => l.querySelector(".avd-ficha-parte-valor").textContent),
    ).toEqual(["— / 10", "— / 5", "— / 35"]);
    expect(document.querySelectorAll("[data-divergente='sim']")).toHaveLength(
      0,
    );
    // Sem "Falta: …" longo nem parecer fora da Conclusão.
    expect(document.querySelector(".avd-ficha-falta")).toBeNull();
    expect(document.querySelector(".avd-ficha-parecer")).toBeNull();
    expect(
      document.querySelector("[data-tour='avd-ficha']").textContent,
    ).not.toMatch(/\d{3}\.\d{3}\.\d{3}-\d{2}/);
  });

  it("Conforme (clique ou tecla 1) marca com o ✓ e avança sozinho ao próximo item", async () => {
    await abrirFicha(supabaseFalso());
    await conforme("IDENTIDADE");
    const escolhido = cartao("IDENTIDADE").querySelector(
      "[aria-pressed='true']",
    );
    expect(escolhido.dataset.valor).toBe("CONFORME");
    expect(escolhido.getAttribute("title")).toBe("Conforme (tecla 1)");
    expect(etapa("IDENTIDADE").dataset.estado).toBe("CONFORME");
    await esperarAvanco();
    expect(cartao("IDENTIDADE")).toBeNull();
    expect(cartao("ESCOLARIDADE")).not.toBeNull();
    expect(etapa("ESCOLARIDADE").getAttribute("aria-current")).toBe("step");
    await teclar(raiz(), "1");
    await esperarAvanco();
    expect(etapa("ESCOLARIDADE").dataset.estado).toBe("CONFORME");
    expect(cartao("REGISTRO_CONSELHO")).not.toBeNull();
    // O progresso enche.
    expect(
      document
        .querySelector("[data-tour='avd-ficha-etapas'] [role='progressbar']")
        .getAttribute("aria-valuenow"),
    ).toBe("2");
    // O anúncio para leitor de tela acompanha o item.
    expect(
      document.querySelector(".avd-ficha [aria-live='polite']").textContent,
    ).toBe("Item 3 de 6: Registro ativo no conselho de classe, quando exigido");
  });

  it("Não enviado (tecla 3) fica no item e abre os motivos em chips; o motivo elimina", async () => {
    await abrirFicha(supabaseFalso());
    await irAo("ESCOLARIDADE");
    await teclar(raiz(), "3");
    await esperarAvanco();
    expect(cartao("ESCOLARIDADE").dataset.situacao).toBe("NAO_ENVIADO");
    expect(etapa("ESCOLARIDADE").dataset.estado).toBe("pendencia");
    expect(cartao("ESCOLARIDADE").textContent).toContain("Escolha o motivo.");
    const chips = cartao("ESCOLARIDADE").querySelectorAll(".avd-ficha-chip");
    expect(chips.length).toBeGreaterThan(0);
    expect(chips[0].getAttribute("aria-pressed")).toBe("false");
    await clicar(chips[0]);
    expect(chips[0].getAttribute("aria-pressed")).toBe("true");
    expect(cartao("ESCOLARIDADE").textContent).not.toContain(
      "Escolha o motivo.",
    );
    expect(etapa("ESCOLARIDADE").dataset.estado).toBe("NAO_ENVIADO");
    expect(document.querySelector(".avd-ficha-total").textContent).toContain(
      "Inapto (requisito)",
    );
  });

  it("J e K andam entre os itens; Anterior e Próximo do rodapé também", async () => {
    await abrirFicha(supabaseFalso());
    await teclar(raiz(), "j");
    expect(cartao("ESCOLARIDADE")).not.toBeNull();
    await teclar(raiz(), "j");
    expect(cartao("REGISTRO_CONSELHO")).not.toBeNull();
    await teclar(raiz(), "k");
    expect(cartao("ESCOLARIDADE")).not.toBeNull();
    await clicar(rodape().querySelector("[data-acao='item-proximo']"));
    expect(cartao("REGISTRO_CONSELHO")).not.toBeNull();
    await clicar(rodape().querySelector("[data-acao='item-anterior']"));
    expect(cartao("ESCOLARIDADE")).not.toBeNull();
    // Os atalhos também valem com o foco fora da ficha (na página).
    await teclar(document.body, "j");
    expect(cartao("REGISTRO_CONSELHO")).not.toBeNull();
  });

  it("o botão primário segue o momento: some no item a decidir, Próximo pendente, Revisar e concluir", async () => {
    await abrirFicha(supabaseFalso());
    const primaria = () => rodape().querySelector(".avd-ficha-primaria");
    expect(primaria()).toBeNull();
    await conforme("IDENTIDADE");
    await irAo("IDENTIDADE");
    expect(primaria().textContent).toBe("Próximo pendente");
    await clicar(primaria());
    expect(cartao("ESCOLARIDADE")).not.toBeNull();
  });

  it("Ver todos troca para a lista completa e a escolha fica lembrada", async () => {
    await abrirFicha(supabaseFalso());
    await clicar(document.querySelector("[data-acao='alternar-modo']"));
    expect(localStorage.getItem(CHAVE_DO_MODO)).toBe("lista");
    const naoSeAplicam = ["COTA_PP", "COTA_PCD", "COTA_PI", "COTA_PQ"];
    const codigos = [...document.querySelectorAll(".avd-ficha-cartao")].map(
      (s) => s.dataset.bloco,
    );
    expect(codigos).toEqual([
      ...REGRA.blocos
        .map((b) => b.codigo)
        .filter((c) => !naoSeAplicam.includes(c)),
      ...naoSeAplicam,
    ]);
    expect(cartao("EXPERIENCIA").textContent).toContain("4 anos ou mais");
    const grupo = document.querySelector(
      ".avd-ficha-principal [data-tour='avd-ficha-nao-se-aplicam']",
    );
    expect(grupo.tagName).toBe("DETAILS");
    expect(grupo.querySelector("summary").textContent).toBe(
      "Não se aplicam: Pretos e pardos, Pessoa com deficiência, Indígenas, Quilombolas",
    );
    expect(cartao("COTA_PP").textContent).toContain("Não se aplica");
    expect(cartao("COTA_PP").querySelector(".avd-ficha-decisoes")).toBeNull();
    // Na lista, Conforme não muda de item e "Concluir e próxima" fica à vista (travado).
    await conforme("IDENTIDADE");
    expect(cartao("ESCOLARIDADE")).not.toBeNull();
    expect(botao("Concluir e próxima").disabled).toBe(true);
    await clicar(document.querySelector("[data-acao='alternar-modo']"));
    expect(localStorage.getItem(CHAVE_DO_MODO)).toBe("foco");
    expect(document.querySelectorAll(".avd-ficha-cartao")).toHaveLength(1);
  });

  it("atalhos no '?', e situação, responsável e reserva no 'i' do cabeçalho", async () => {
    await abrirFicha(supabaseFalso());
    await clicar(document.querySelector("[data-acao='atalhos']"));
    expect(
      document.querySelector(
        "[data-tour='avd-ficha-atalhos'] .ui-popover-painel",
      ).textContent,
    ).toBe(
      "1Conforme2Não conforme3Não enviadoJ / KPróximo / anteriorCtrl+SSalvar rascunhoCtrl+EnterConcluir e próxima",
    );
    await clicar(document.querySelector("[data-acao='informacoes-da-ficha']"));
    const info = document.querySelector(
      "[data-tour='avd-ficha-informacoes'] .ui-popover-painel",
    ).textContent;
    expect(info).toContain("SituaçãoEm análise");
    expect(info).toContain("ResponsávelAna");
    expect(info).toMatch(/ReservaCom você até \d{2}:\d{2}/);
    expect(info).toContain("RegraVersão 4");
    // Reserva com folga: sem aviso no cabeçalho.
    expect(document.querySelector(".avd-chip-alerta")).toBeNull();
  });
});

describe("ficha: Conclusão e parecer (sem resultado antes da hora)", () => {
  it("a Conclusão resume os itens (clicáveis), trava o concluir e a prévia do parecer não traz resultado", async () => {
    await abrirFicha(supabaseFalso());
    await irAo("CONCLUSAO");
    expect(document.querySelector(".avd-ficha-cartao")).toBeNull();
    expect(
      document.querySelector("[data-tour='avd-ficha-lateral']"),
    ).toBeNull();
    const resumo = document.querySelector("[data-tour='avd-ficha-resumo']");
    expect(resumo.querySelectorAll("[data-resumo]")).toHaveLength(6);
    expect(resumo.textContent).toContain(
      "Não se aplicam: Pretos e pardos, Pessoa com deficiência, Indígenas, Quilombolas",
    );
    const parecer = document.querySelector(".avd-ficha-parecer");
    expect(parecer.textContent).toContain(
      "Em análise — o parecer é gerado quando todos os itens forem conferidos",
    );
    expect(parecer.textContent).not.toMatch(/HABILITADO/);
    expect(botao("Copiar parecer")).toBeUndefined();
    const concluir = botao("Concluir e próxima");
    expect(concluir.disabled).toBe(true);
    expect(concluir.getAttribute("title")).toMatch(/^Falta: /);
    // Clicar no resumo volta ao item.
    await clicar(resumo.querySelector("[data-resumo='REGISTRO_CONSELHO']"));
    expect(cartao("REGISTRO_CONSELHO")).not.toBeNull();
    // Um requisito conferido elimina: Inapto; o parecer continua sem resultado, só o motivo.
    await clicar(
      cartao("REGISTRO_CONSELHO").querySelector("[data-valor='NAO_ENVIADO']"),
    );
    await clicar(cartao("REGISTRO_CONSELHO").querySelector(".avd-ficha-chip"));
    expect(document.querySelector(".avd-ficha-total").textContent).toContain(
      "Inapto (requisito)",
    );
    await irAo("CONCLUSAO");
    const previa = document.querySelector(".avd-ficha-parecer");
    expect(previa.textContent).not.toMatch(/HABILITADO/);
    expect(previa.querySelectorAll("li")).toHaveLength(1);
    expect(previa.querySelector("li").textContent).toMatch(/^Item 6\.4: /);
    expect(
      document.querySelector("[data-resumo='REGISTRO_CONSELHO']").textContent,
    ).toContain("Não enviado");
  });

  it("a diferença para a declarada aparece só depois de conferir", async () => {
    await abrirFicha(supabaseFalso());
    await irAo("FORMACAO");
    expect(
      cartao("FORMACAO").querySelector("input[data-divergente]"),
    ).toBeNull();
    await conforme("FORMACAO");
    // Conforme sem itens confirma o declarado (valor explícito): sem divergência.
    expect(parte("FORMACAO").dataset.divergente).toBeUndefined();
    expect(
      parte("FORMACAO").querySelector(".avd-ficha-parte-valor").textContent,
    ).toBe("5 / 10");
    // Títulos ainda sem item: o Conforme não avança (é a hora de lançar o comprovado).
    await esperarAvanco();
    expect(cartao("FORMACAO")).not.toBeNull();
    // Um apurado abaixo do declarado diverge.
    await clicar(
      cartao("FORMACAO").querySelector("[aria-label='Diminuir meio ponto']"),
    );
    expect(parte("FORMACAO").dataset.divergente).toBe("sim");
    expect(cartao("FORMACAO").textContent).toContain(
      "Por que o apurado é menor que o declarado?",
    );
  });

  it("o apurado começa com o declarado e a decisão mexe nele (AM-10)", async () => {
    const supabase = supabaseFalso();
    await abrirFicha(supabase);
    await irAo("CURSOS");
    const apurado = () =>
      cartao("CURSOS").querySelector("[data-tour='avd-ficha-nota'] input");
    const resumo = () =>
      cartao("CURSOS").querySelector(".avd-ficha-pontos-resumo");
    // Antes de decidir: preenchido com o declarado e a frase de conferência.
    expect(apurado().value).toBe("3");
    expect(cartao("CURSOS").textContent).toContain(
      "Confira o documento: se comprova os pontos declarados, marque Conforme",
    );
    expect(resumo().textContent).toMatch(/Declarado\s*3\s*→\s*Apurado\s*3/);
    expect(resumo().dataset.diferenca).toBe("nenhuma");
    // Não conforme zera, com aviso.
    await clicar(cartao("CURSOS").querySelector("[data-valor='NAO_CONFORME']"));
    expect(apurado().value).toBe("0");
    expect(cartao("CURSOS").textContent).toContain("Apurado zerado");
    expect(resumo().textContent).toContain("−3");
    // De volta ao Conforme: o declarado de novo, gravado explícito.
    await conforme("CURSOS");
    expect(apurado().value).toBe("3");
    expect(cartao("CURSOS").textContent).not.toContain("Apurado zerado");
    await teclar(raiz(), "s", { ctrlKey: true });
    await esperar();
    const gravado = chamadas(supabase, "salvar_rascunho_ficha").at(-1);
    expect(gravado.p_lancamento.blocos.CURSOS.nota_ajustada).toBe(3);
    // O primeiro curso lançado devolve o apurado ao calculado.
    await clicar(botao("Adicionar curso", cartao("CURSOS")));
    await digitar(
      cartao("CURSOS").querySelector("input[aria-label='Carga horária']"),
      "40",
    );
    expect(apurado().value).toBe("1");
    expect(resumo().dataset.diferenca).toBe("menor");
  });

  it("tecla 3 (Não enviado) também zera o apurado", async () => {
    await abrirFicha(supabaseFalso());
    await irAo("CURSOS");
    await teclar(raiz(), "3");
    expect(
      cartao("CURSOS").querySelector("[data-tour='avd-ficha-nota'] input")
        .value,
    ).toBe("0");
    expect(cartao("CURSOS").textContent).toContain(
      "o documento não foi enviado",
    );
  });
});

describe("ficha: itens, nota e justificativa (AM-9, AM-10, AM-11)", () => {
  it("curso lançado pontua na hora; nota diferente da declarada pede justificativa, que vai ao parecer", async () => {
    await abrirFicha(supabaseFalso());
    // Com a experiência mínima (sem ela, inapto por requisito não pede justificativa).
    await irAo("EXPERIENCIA");
    await clicar(botao("Adicionar vínculo", cartao("EXPERIENCIA")));
    await digitar(
      cartao("EXPERIENCIA").querySelector("input[aria-label='Início']"),
      "2020-01-01",
    );
    await digitar(
      cartao("EXPERIENCIA").querySelector("input[aria-label='Fim']"),
      "2022-12-31",
    );
    await irAo("CURSOS");
    await conforme("CURSOS");
    await clicar(botao("Adicionar curso", cartao("CURSOS")));
    await digitar(
      cartao("CURSOS").querySelector("input[aria-label='Carga horária']"),
      "120",
    );
    expect(
      parte("CURSOS").querySelector(".avd-ficha-parte-valor").textContent,
    ).toBe("3 / 5");
    expect(parte("CURSOS").dataset.divergente).toBeUndefined();
    expect(parte("CURSOS").getAttribute("title")).toBe("Declarado 3");
    // O passador do apurado: meio ponto a menos diverge e pede justificativa.
    await clicar(
      cartao("CURSOS").querySelector("[aria-label='Diminuir meio ponto']"),
    );
    expect(
      cartao("CURSOS").querySelector("[data-tour='avd-ficha-nota'] input")
        .value,
    ).toBe("2.5");
    await digitar(
      cartao("CURSOS").querySelector(
        "[data-tour='avd-ficha-nota'] input[type='number']",
      ),
      "2",
    );
    expect(cartao("CURSOS").textContent).toContain(
      "Nota diferente da declarada: escolha a justificativa.",
    );
    const chip = [
      ...cartao("CURSOS").querySelectorAll(
        "[data-tour='avd-ficha-justificativa'] .avd-ficha-chip",
      ),
    ].find((b) => b.textContent.includes("Nota de cursos diminuída"));
    await clicar(chip);
    expect(cartao("CURSOS").textContent).not.toContain(
      "Nota diferente da declarada",
    );
    for (const codigo of [
      "IDENTIDADE",
      "ESCOLARIDADE",
      "REGISTRO_CONSELHO",
      "FORMACAO",
      "EXPERIENCIA",
    ]) {
      await irAo(codigo);
      await conforme(codigo);
    }
    await irAo("CONCLUSAO");
    expect(
      document.querySelector(".avd-ficha-parecer pre").textContent,
    ).toContain("Nota de cursos de aperfeiçoamento diminuída");
    expect(
      document.querySelector("[data-resumo='CURSOS']").textContent,
    ).toContain("2 pontos");
    // Muitos passos pelo stepper: mais tempo que o padrão sob carga.
  }, 20000);

  it("vínculo com datas calcula a experiência; recusado pede motivo", async () => {
    await abrirFicha(supabaseFalso());
    await irAo("EXPERIENCIA");
    await clicar(botao("Adicionar vínculo", cartao("EXPERIENCIA")));
    await digitar(
      cartao("EXPERIENCIA").querySelector("input[aria-label='Início']"),
      "2020-01-01",
    );
    await digitar(
      cartao("EXPERIENCIA").querySelector("input[aria-label='Fim']"),
      "2022-12-31",
    );
    expect(cartao("EXPERIENCIA").textContent).toMatch(
      /Calculado pelos itens\s*25/,
    );
    await clicar(
      cartao("EXPERIENCIA").querySelector(".avd-ficha-aceito input"),
    );
    expect(cartao("EXPERIENCIA").textContent).toContain(
      "Item recusado sem motivo.",
    );
    await escolher(
      cartao("EXPERIENCIA").querySelector(
        "select[aria-label='Motivo da recusa']",
      ),
      "ANTES_DO_DIPLOMA",
    );
    expect(cartao("EXPERIENCIA").textContent).not.toContain(
      "Item recusado sem motivo.",
    );
  });
});

describe("ficha: rascunho, concluir e próxima, voltar (AM-12)", () => {
  it("Ctrl+S salva o rascunho com o lançamento, o resultado e o parecer na versão", async () => {
    const supabase = supabaseFalso();
    await abrirFicha(supabase);
    await teclar(raiz(), "1");
    expect(document.querySelector(".avd-ficha-salvo").textContent).toBe(
      "Alteração não salva",
    );
    await teclar(raiz(), "s", { ctrlKey: true });
    await esperar();
    const [args] = chamadas(supabase, "salvar_rascunho_ficha");
    expect(args).toMatchObject({ p_ficha: "f1", p_versao: 5 });
    expect(args.p_lancamento.blocos.IDENTIDADE.situacao).toBe("CONFORME");
    expect(args.p_resultado).toMatchObject({
      declarada: { FORMACAO: 5, CURSOS: 3 },
    });
    expect(args.p_parecer).toContain("Edital 93/2026");
    expect(document.querySelector(".avd-ficha-salvo").textContent).toMatch(
      /^Salvo às \d{2}:\d{2}$/,
    );
  });

  it("concluir com pendência não chama o banco; completa, a Conclusão conclui e pega a próxima", async () => {
    const supabase = supabaseFalso();
    await abrirFicha(supabase);
    // Ctrl+Enter com pendência não vai ao banco.
    await teclar(raiz(), "Enter", { ctrlKey: true });
    await esperar();
    expect(chamadas(supabase, "concluir_ficha")).toHaveLength(0);
    await lancarItensComoDeclarados();
    for (const codigo of [
      "IDENTIDADE",
      "ESCOLARIDADE",
      "REGISTRO_CONSELHO",
      "FORMACAO",
      "CURSOS",
      "EXPERIENCIA",
    ]) {
      await irAo(codigo);
      await conforme(codigo);
    }
    expect(document.querySelector(".avd-ficha-pendencias")).toBeNull();
    expect(
      document.querySelector("[data-tour='avd-ficha-etapas']").textContent,
    ).toContain("6 de 6 itens conferidos");
    expect(etapa("CONCLUSAO").dataset.estado).toBe("pronta");
    // Tudo conferido: fora da Conclusão, o primário leva a ela.
    const primaria = rodape().querySelector(".avd-ficha-primaria");
    expect(primaria.textContent).toBe("Revisar e concluir");
    await clicar(primaria);
    expect(
      document.querySelector("[data-tour='avd-ficha-conclusao']"),
    ).not.toBeNull();
    expect(botao("Concluir e próxima").disabled).toBe(false);
    await clicar(botao("Concluir e próxima"));
    await esperar();
    await esperar();
    const [args] = chamadas(supabase, "concluir_ficha");
    expect(args).toMatchObject({ p_ficha: "f1", p_versao_regra: 4 });
    expect(args.p_resultado).toMatchObject({
      resultado: "APTO",
      nota_final: 33,
      parciais: { FORMACAO: 5, CURSOS: 3, EXPERIENCIA: 25 },
    });
    expect(chamadas(supabase, "pegar_proxima_ficha")).toHaveLength(1);
    // Muitos passos pelo stepper: mais tempo que o padrão sob carga.
  }, 20000);

  it("Copiar código (no '⋯') registra o acesso; Voltar à fila salva antes de soltar a reserva", async () => {
    const supabase = supabaseFalso();
    await abrirFicha(supabase);
    await abrirMais();
    await clicar(botao("Copiar código"));
    await esperar();
    expect(chamadas(supabase, "registrar_acesso_ficha")).toEqual([
      { p_ficha: "f1", p_tipo: "COPIAR_CODIGO" },
    ]);
    expect(
      rodape().querySelector(".avd-ficha-aviso-rapido").textContent,
    ).toMatch(/^(Código copiado|Não foi possível copiar)$/);
    await abrirMais();
    expect(
      document
        .querySelector("[data-tour='avd-ficha-empregare'] a")
        .getAttribute("href"),
    ).toBe("https://corporate.empregare.com/empresa/vagas");
    await teclar(raiz(), "1");
    await clicar(document.querySelector("[data-acao='voltar-a-fila']"));
    await esperar();
    await esperar();
    const nomes = supabase.rpc.mock.calls.map(([n]) => n);
    expect(nomes.indexOf("salvar_rascunho_ficha")).toBeGreaterThan(-1);
    expect(nomes.lastIndexOf("liberar_reserva")).toBeGreaterThan(
      nomes.indexOf("salvar_rascunho_ficha"),
    );
    expect(document.querySelector("[data-tour='avd-ficha']")).toBeNull();
  });
});

describe("ficha concluída: só leitura, histórico e reabrir", () => {
  it("abre na Conclusão; decisões travadas, histórico com de quanto para quanto e a coordenação reabre com motivo", async () => {
    const lancamento = {
      nivel: "superior",
      modalidade: "AC",
      blocos: { IDENTIDADE: { situacao: "CONFORME" } },
      titulos: [{ titulo: "ESPECIALIZACAO", aceito: true }],
      cursos: [],
      vinculos: [],
    };
    const supabase = supabaseFalso(
      fichaDoBanco({
        situacao: "CONCLUIDA",
        lancamento,
        editar: false,
        reabrir: true,
      }),
    );
    await abrirFicha(supabase);
    expect(
      document.querySelector("[data-tour='avd-ficha-conclusao']"),
    ).not.toBeNull();
    expect(etapa("CONCLUSAO").getAttribute("aria-current")).toBe("step");
    expect(document.querySelector(".avd-ficha-parecer pre").textContent).toBe(
      "Parecer gravado",
    );
    expect(botao("Concluir e próxima")).toBeUndefined();
    expect(document.querySelector("[data-acao='atalhos']")).toBeNull();
    expect(document.querySelector(".avd-ficha-salvo").textContent).toBe(
      "Concluída por Ana",
    );
    expect(
      document.querySelector("[data-tour='avd-ficha-historico']").textContent,
    ).toContain("Experiência na área ou no SUS: 25 → 20");
    await irAo("IDENTIDADE");
    expect(
      cartao("IDENTIDADE").querySelector(".avd-ficha-decisao").disabled,
    ).toBe(true);
    await clicar(botao("Reabrir"));
    await digitar(
      document.querySelector(".avd-ficha-barra input"),
      "Conferir de novo os cursos",
    );
    await clicar(
      botao("Reabrir", document.querySelector(".avd-ficha-barra .avd-inline")),
    );
    await esperar();
    expect(chamadas(supabase, "reabrir_ficha")).toEqual([
      { p_ficha: "f1", p_versao: 5, p_motivo: "Conferir de novo os cursos" },
    ]);
  });

  it("na fila, as concluídas mostram nota e resultado", async () => {
    await abrirFicha(supabaseFalso());
    await clicar(document.querySelector("[data-acao='voltar-a-fila']"));
    await esperar();
    await clicar(
      secao.querySelector(
        "[data-tour='avd-fila-etapas'] [data-valor='concluidas']",
      ),
    );
    const linha = secao.querySelector("[data-candidato='7002']");
    expect(linha.textContent).toContain("22,5");
    expect(linha.textContent).toContain("Apto");
  });
});

describe("estado da ficha: salvamento automático", () => {
  function loja(rpc) {
    const agendados = [];
    const estado = criarEstadoDaFicha({
      rpc,
      toast,
      agendar: (fn) => agendados.push(fn),
      cancelar: () => {},
    });
    return { estado, agendados };
  }
  const rpcFalso = (extra = {}) =>
    vi.fn(async (nome, args) => {
      const r = {
        obter_ficha_analise: () => fichaDoBanco(),
        salvar_rascunho_ficha: () => ({
          versao: args.p_versao + 1,
          salvo_em: "2026-10-07T13:05:00Z",
        }),
        ...extra,
      }[nome]?.(args);
      if (r instanceof Error) throw r;
      return r;
    });

  it("a declarada segue o nível do lançamento (experiência com pontos por nível)", async () => {
    const ficha = fichaDoBanco();
    ficha.regra.configuracao = structuredClone(REGRA);
    ficha.regra.configuracao.provisoria.nota_declarada.push({
      parcial: "EXPERIENCIA",
      pergunta: "Experiência Profissional",
      tipo: "OPCAO",
      pontos_por_nivel: {
        superior: { "4 anos ou mais": 35 },
        tecnico: { "4 anos ou mais": 28 },
      },
    });
    const { estado } = loja(
      rpcFalso({ obter_ficha_analise: () => structuredClone(ficha) }),
    );
    await estado.carregar("f1");
    expect(estado.obter().lancamento.nivel).toBe("superior");
    expect(estado.obter().declarada.parciais.EXPERIENCIA).toBe(35);
    estado.mudar((l) => ({ ...l, nivel: "tecnico" }));
    expect(estado.obter().declarada.parciais.EXPERIENCIA).toBe(28);
    estado.descartar();
  });

  it("cada mudança agenda o rascunho; mudança durante o envio salva de novo com a versão nova", async () => {
    let soltar;
    const rpc = rpcFalso({
      salvar_rascunho_ficha: (a) =>
        a.p_versao === 5
          ? new Promise(
              (r) =>
                (soltar = () =>
                  r({ versao: 6, salvo_em: "2026-10-07T13:05:00Z" })),
            )
          : { versao: a.p_versao + 1, salvo_em: "2026-10-07T13:06:00Z" },
    });
    const { estado, agendados } = loja(rpc);
    await estado.carregar("f1");
    estado.mudar((l) => ({ ...l, observacoes: "a" }));
    expect(agendados).toHaveLength(1);
    const primeiro = estado.salvar();
    await Promise.resolve();
    estado.mudar((l) => ({ ...l, observacoes: "ab" }));
    soltar();
    await primeiro;
    const versoes = rpc.mock.calls
      .filter(([n]) => n === "salvar_rascunho_ficha")
      .map(([, a]) => a.p_versao);
    expect(versoes).toEqual([5, 6]);
    expect(estado.obter()).toMatchObject({ versao: 7, sujo: false });
  });

  it("versão velha (40001) para a edição com o aviso", async () => {
    const erro = Object.assign(new Error("Esta ficha mudou"), {
      code: "40001",
    });
    const { estado } = loja(rpcFalso({ salvar_rascunho_ficha: () => erro }));
    await estado.carregar("f1");
    estado.mudar((l) => ({ ...l, observacoes: "x" }));
    expect(await estado.salvar()).toBe(false);
    expect(estado.obter().podeEditar).toBe(false);
    expect(estado.obter().aviso).toContain("mudou desde que você abriu");
  });

  it("só leitura não muda nem salva", async () => {
    const rpc = rpcFalso({
      obter_ficha_analise: () => fichaDoBanco({ editar: false }),
    });
    const { estado, agendados } = loja(rpc);
    await estado.carregar("f1");
    estado.mudar((l) => ({ ...l, observacoes: "x" }));
    expect(agendados).toHaveLength(0);
    expect(estado.obter().sujo).toBe(false);
  });
});

describe("ficha: abrir o candidato na Empregare (F7)", () => {
  const LINK =
    "https://corporate.empregare.com/empresa/curriculo/detalhes?tokenCandidato=TKfict&id=IDfict|&candidatura=CDfict||";
  const linkDoMenu = async () => {
    await abrirMais();
    return document.querySelector("[data-tour='avd-ficha-empregare'] a");
  };
  // O jsdom não navega: o clique no link segue para o React, sem abrir a aba.
  const semNavegar = (ev) => {
    if (ev.target.closest?.("a[target='_blank']")) ev.preventDefault();
  };
  beforeEach(() => {
    // A etapa da fila fica guardada no navegador (outro teste deixa em Concluídas).
    globalThis.localStorage?.clear();
    document.addEventListener("click", semNavegar);
  });
  afterEach(() => document.removeEventListener("click", semNavegar));

  it("com o link capturado, abre o candidato em nova aba e registra o acesso", async () => {
    const supabase = supabaseFalso({
      ...fichaDoBanco(),
      empregare: {
        link_candidato: LINK,
        vaga_interno: "Ab1cD2eF3g|",
        link_vaga:
          "https://corporate.empregare.com/empresa/vagas/candidaturas/Ab1cD2eF3g|",
      },
    });
    await abrirFicha(supabase);
    const a = await linkDoMenu();
    expect(a.textContent).toContain("Abrir candidato na Empregare");
    expect(a.getAttribute("href")).toBe(LINK);
    expect(a.getAttribute("target")).toBe("_blank");
    expect(a.getAttribute("rel")).toContain("noopener");
    await clicar(a);
    await esperar();
    expect(chamadas(supabase, "registrar_acesso_ficha")).toEqual([
      { p_ficha: "f1", p_tipo: "ABRIR_EMPREGARE" },
    ]);
    // Abrir fecha o menu.
    expect(
      document.querySelector("[data-tour='avd-ficha-empregare']"),
    ).toBeNull();
  });

  it("link fora da Empregare não vira botão; com o identificador, abre a vaga e copia o código do candidato", async () => {
    const escrever = vi.fn(async () => {});
    vi.stubGlobal("navigator", { clipboard: { writeText: escrever } });
    try {
      const supabase = supabaseFalso({
        ...fichaDoBanco(),
        empregare: {
          link_candidato: "javascript:alert(1)",
          vaga_interno: "Ab1cD2eF3g|",
        },
      });
      await abrirFicha(supabase);
      const a = await linkDoMenu();
      expect(a.textContent).toContain("Abrir vaga na Empregare");
      expect(a.getAttribute("href")).toBe(
        "https://corporate.empregare.com/empresa/vagas/candidaturas/Ab1cD2eF3g|",
      );
      await clicar(a);
      await esperar();
      expect(escrever).toHaveBeenCalledWith("7001");
      expect(chamadas(supabase, "registrar_acesso_ficha")).toEqual([
        { p_ficha: "f1", p_tipo: "ABRIR_EMPREGARE" },
      ]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("sem links, cai na lista de vagas e copia o código da vaga", async () => {
    const supabase = supabaseFalso({ ...fichaDoBanco(), empregare: null });
    await abrirFicha(supabase);
    const a = await linkDoMenu();
    expect(a.textContent).toContain("Abrir vagas na Empregare");
    expect(a.getAttribute("href")).toBe(
      "https://corporate.empregare.com/empresa/vagas",
    );
  });

  it("anexo declarado: Abrir na Empregare abre o candidato, diz onde achar o arquivo e registra o acesso", async () => {
    const supabase = supabaseFalso({
      ...fichaDoBanco(),
      empregare: { link_candidato: LINK },
    });
    await abrirFicha(supabase);
    const ver = cartao("IDENTIDADE").querySelector(".avd-ficha-ver-anexo");
    expect(ver.textContent).toContain("Abrir na Empregare");
    expect(ver.getAttribute("href")).toBe(LINK);
    expect(ver.getAttribute("rel")).toContain("noopener");
    expect(
      cartao("IDENTIDADE").querySelector(".avd-ficha-dica-anexo").textContent,
    ).toBe(
      "Na Empregare: aba Questionários › Pergunta 4 — Anexe o documento de identificação com foto",
    );
    await clicar(ver);
    await esperar();
    expect(chamadas(supabase, "registrar_acesso_ficha")).toEqual([
      { p_ficha: "f1", p_tipo: "ABRIR_EMPREGARE" },
    ]);
    // Só ao lado de "Anexo": a titulação declarada tem o link do candidato, sem a dica.
    await irAo("FORMACAO");
    expect(cartao("FORMACAO").querySelector(".avd-ficha-ver-anexo")).toBeNull();
    expect(
      cartao("FORMACAO").querySelector(".avd-ficha-dica-anexo"),
    ).toBeNull();
    expect(
      cartao("FORMACAO")
        .querySelector(".avd-ficha-ver-candidato")
        .getAttribute("href"),
    ).toBe(LINK);
  });

  it("anexo sem o link do candidato: abre as vagas, copia o código da vaga e avisa no rodapé", async () => {
    const escrever = vi.fn(async () => {});
    vi.stubGlobal("navigator", { clipboard: { writeText: escrever } });
    try {
      const supabase = supabaseFalso({ ...fichaDoBanco(), empregare: null });
      await abrirFicha(supabase);
      const ver = cartao("IDENTIDADE").querySelector(".avd-ficha-ver-anexo");
      expect(ver.getAttribute("href")).toBe(
        "https://corporate.empregare.com/empresa/vagas",
      );
      await clicar(ver);
      await esperar();
      expect(escrever).toHaveBeenCalledWith("179698");
      expect(chamadas(supabase, "registrar_acesso_ficha")).toEqual([
        { p_ficha: "f1", p_tipo: "ABRIR_EMPREGARE" },
      ]);
      expect(
        rodape().querySelector(".avd-ficha-aviso-rapido").textContent,
      ).toContain("Código da vaga 179698 copiado");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("modo de análise: cabeçalho enxuto e nível da vaga", () => {
  it("o cabeçalho traz o nome, o código, a vaga com o nível e só os chips essenciais", async () => {
    await abrirFicha(supabaseFalso());
    const topo = document.querySelector(".avd-analise-topo");
    expect(topo.querySelector(".avd-analise-nome").textContent).toBe(
      "Pessoa Fictícia",
    );
    expect(topo.querySelector(".avd-analise-codigo").textContent).toBe(
      "Código 7001",
    );
    expect(topo.querySelector(".avd-analise-vaga").textContent).toBe(
      "179698 · Engenheiro de Segurança do Trabalho · Superior",
    );
    expect(
      [...topo.querySelectorAll(".avd-analise-dados .avd-chip")].map(
        (c) => c.textContent,
      ),
    ).toEqual(["Declarada 13", "1º", "AC"]);
    expect(topo.textContent).not.toContain("Responsável");
  });

  it("reserva perto do fim: o aviso aparece no cabeçalho", async () => {
    const supabase = supabaseFalso(fichaDoBanco(), {
      reservar_ficha: () => ({
        ficha: cabecalho({
          reserva: {
            usuario: EU,
            nome: "Ana",
            desde: new Date().toISOString(),
            expira: new Date(Date.now() + 3 * 60 * 1000).toISOString(),
          },
        }),
        reservada: true,
        somente_leitura: false,
      }),
    });
    await abrirFicha(supabase);
    expect(document.querySelector(".avd-chip-alerta").textContent).toMatch(
      /^ Reserva acaba em [34] min$/,
    );
  });

  it("nível da vaga: só leitura para o analista (no cabeçalho, sem o seletor)", async () => {
    await abrirFicha(supabaseFalso());
    await abrirMais();
    expect(document.querySelector("[data-acao='nivel-da-vaga']")).toBeNull();
    expect(document.querySelector(".avd-analise-vaga").textContent).toContain(
      "Superior",
    );
  });

  it("nível da vaga: a coordenação muda no '⋯', com o aviso de que muda os pontos declarados", async () => {
    const supabase = supabaseFalso(fichaDoBanco({ papel: "COORDENADOR" }));
    await abrirFicha(supabase);
    await abrirMais();
    const menu = document.querySelector("[data-tour='avd-ficha-empregare']");
    const nivel = menu.querySelector("[data-acao='nivel-da-vaga']");
    expect(nivel.value).toBe("superior");
    expect(menu.textContent).toContain(
      "Mudar o nível muda os pontos declarados.",
    );
    await escolher(nivel, "tecnico");
    expect(document.querySelector(".avd-analise-vaga").textContent).toContain(
      "Técnico",
    );
    await teclar(raiz(), "s", { ctrlKey: true });
    await esperar();
    const [args] = chamadas(supabase, "salvar_rascunho_ficha");
    expect(args.p_lancamento.nivel).toBe("tecnico");
  });
});
