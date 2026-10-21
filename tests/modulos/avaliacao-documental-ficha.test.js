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
  // Quem não coordena já abre na Fila, sem o seletor de abas.
  const aba = secao.querySelector(
    "[data-tour='avd-visoes'] [data-valor='fila']",
  );
  if (aba) await clicar(aba);
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
  clicar(cartao(codigo).querySelector("[data-valor='CONFERE']"));
const parte = (parcial) =>
  document.querySelector(
    `[data-tour='avd-ficha-composicao'] [data-parcial='${parcial}']`,
  );
const abrirMais = () =>
  clicar(document.querySelector("[data-acao='mais-acoes']"));
const rodape = () => document.querySelector("[data-tour='avd-ficha-barra']");

/*
  Confere em Titulação, Cursos e Experiência e lança um título, um curso de
  120 h e um vínculo de 3 anos. Com Declarado > 0 o Confere já abre a linha;
  sem ela, "Adicionar …".
*/
async function linhaPronta(codigo, rotulo) {
  if (!cartao(codigo).querySelector(".avd-ficha-item"))
    await clicar(botao(rotulo, cartao(codigo)));
}

async function lancarItensComoDeclarados() {
  await irAo("FORMACAO");
  await conforme("FORMACAO");
  await linhaPronta("FORMACAO", "Adicionar título");
  // Cursos: pela faixa/nota do bloco (Confere = o declarado), sem lista.
  await irAo("CURSOS");
  await conforme("CURSOS");
  await irAo("EXPERIENCIA");
  await conforme("EXPERIENCIA");
  await linhaPronta("EXPERIENCIA", "Adicionar vínculo");
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
    ).toContain("0 de 6 conferidos");
    // A lateral: nota parcial, "Em análise"; antes de conferir, cada parte é a
    // prévia (o Apurado que o item mostra: o calculado pelos itens, 0 sem item).
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
    ).toEqual(["0 / 10 (prévia)", "0 / 5 (prévia)", "0 / 35 (prévia)"]);
    expect(partes.map((l) => l.dataset.previa)).toEqual(["sim", "sim", "sim"]);
    // A nota parcial soma as prévias e diz que são prévias.
    expect(total.querySelector(".avd-ficha-nota-total").textContent).toBe(
      "0 parcial (com prévias)",
    );
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
    expect(escolhido.dataset.valor).toBe("CONFERE");
    expect(escolhido.getAttribute("title")).toBe("Confere (tecla 1)");
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

  it("Não confere (tecla 2) fica no item e pede só o motivo; o 'não enviou' vira Não enviado; o motivo elimina", async () => {
    await abrirFicha(supabaseFalso());
    await irAo("ESCOLARIDADE");
    // Formação não pontua: só Confere e Não confere (a tecla 3 não faz nada).
    expect(
      cartao("ESCOLARIDADE").querySelectorAll(".avd-ficha-decisao"),
    ).toHaveLength(2);
    await teclar(raiz(), "3");
    expect(cartao("ESCOLARIDADE").dataset.situacao).toBe("");
    await teclar(raiz(), "2");
    await esperarAvanco();
    expect(cartao("ESCOLARIDADE").dataset.situacao).toBe("NAO_CONFORME");
    expect(etapa("ESCOLARIDADE").dataset.estado).toBe("pendencia");
    // O "!" diz o motivo ao passar o mouse; e o contador não conta o item.
    expect(etapa("ESCOLARIDADE").getAttribute("title")).toBe(
      "Formação: Escolha o motivo.",
    );
    expect(
      document.querySelector("[data-tour='avd-ficha-etapas']").textContent,
    ).toContain("0 de 6 conferidos");
    // Uma só mensagem no item.
    const mensagens = cartao("ESCOLARIDADE").querySelectorAll(
      ".avd-ficha-mensagem",
    );
    expect(mensagens).toHaveLength(1);
    expect(mensagens[0].textContent).toBe("Escolha o motivo.");
    await clicar(
      cartao("ESCOLARIDADE").querySelector(".avd-ficha-nao-enviou input"),
    );
    expect(cartao("ESCOLARIDADE").dataset.situacao).toBe("NAO_ENVIADO");
    const chips = cartao("ESCOLARIDADE").querySelectorAll(".avd-ficha-chip");
    expect(chips.length).toBeGreaterThan(0);
    expect(chips[0].getAttribute("aria-pressed")).toBe("false");
    await clicar(chips[0]);
    expect(chips[0].getAttribute("aria-pressed")).toBe("true");
    expect(
      cartao("ESCOLARIDADE").querySelector(".avd-ficha-mensagem"),
    ).toBeNull();
    expect(etapa("ESCOLARIDADE").dataset.estado).toBe("NAO_ENVIADO");
    expect(
      document.querySelector("[data-tour='avd-ficha-etapas']").textContent,
    ).toContain("1 de 6 conferidos");
    expect(document.querySelector(".avd-ficha-total").textContent).toContain(
      "Inapto (requisito)",
    );
  });

  it("Outro motivo (descrever) vale como motivo e a Observação do avaliador fica no fim de todo item", async () => {
    const supabase = supabaseFalso();
    await abrirFicha(supabase);
    await irAo("ESCOLARIDADE");
    const c = () => cartao("ESCOLARIDADE");
    // A observação aparece já antes da decisão, no fim do card.
    const obs = () => c().querySelector(".avd-ficha-observacao-do-item");
    expect(obs()).not.toBeNull();
    expect(c().lastElementChild).toBe(obs());
    await teclar(raiz(), "2");
    await esperarAvanco();
    // Sem o campo avulso de antes: o texto só com o "Outro motivo".
    expect(c().querySelector(".avd-ficha-motivo-escrito")).toBeNull();
    const outro = c().querySelector("[data-motivo='OUTRO']");
    expect(outro.textContent).toContain("Outro motivo (descrever)");
    await clicar(outro);
    const campo = c().querySelector(".avd-ficha-motivo-escrito input");
    expect(campo).not.toBeNull();
    await digitar(campo, "curto");
    expect(c().querySelector(".avd-ficha-mensagem").textContent).toBe(
      "Descreva o outro motivo (10 caracteres ou mais).",
    );
    await digitar(campo, "Diploma sem o verso.");
    expect(c().querySelector(".avd-ficha-mensagem")).toBeNull();
    expect(etapa("ESCOLARIDADE").dataset.estado).toBe("NAO_CONFORME");
    await digitar(obs().querySelector("textarea"), "Pediu prazo por e-mail.");
    await teclar(raiz(), "s", { ctrlKey: true });
    await esperar();
    const gravado = chamadas(supabase, "salvar_rascunho_ficha").at(-1);
    expect(gravado.p_lancamento.blocos.ESCOLARIDADE).toMatchObject({
      situacao: "NAO_CONFORME",
      motivos: ["OUTRO"],
      motivo_livre: "Diploma sem o verso.",
      observacao: "Pediu prazo por e-mail.",
    });
    // Desmarcar o "Outro motivo" tira o texto.
    await clicar(c().querySelector("[data-motivo='OUTRO']"));
    expect(c().querySelector(".avd-ficha-motivo-escrito")).toBeNull();
    expect(c().querySelector(".avd-ficha-mensagem").textContent).toBe(
      "Escolha o motivo.",
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
      "1Confere2Não confere3Editar notaJ / KPróximo / anteriorCtrl+SSalvar rascunhoCtrl+EnterConcluir e próxima",
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
    expect(botao("Espelho de nota")).toBeUndefined();
    const concluir = botao("Concluir e próxima");
    expect(concluir.disabled).toBe(true);
    expect(concluir.getAttribute("title")).toMatch(/^Falta: /);
    // Clicar no resumo volta ao item.
    await clicar(resumo.querySelector("[data-resumo='REGISTRO_CONSELHO']"));
    expect(cartao("REGISTRO_CONSELHO")).not.toBeNull();
    // Um requisito conferido elimina: Inapto; o parecer continua sem resultado, só o motivo.
    await clicar(
      cartao("REGISTRO_CONSELHO").querySelector("[data-valor='NAO_CONFERE']"),
    );
    await clicar(
      cartao("REGISTRO_CONSELHO").querySelector(".avd-ficha-nao-enviou input"),
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

  it("ordem do item: declarado e anexo, a pergunta com as três escolhas e, só depois, a lista", async () => {
    await abrirFicha(supabaseFalso());
    await irAo("CURSOS");
    const c = cartao("CURSOS");
    const resposta = c.querySelector(".avd-ficha-respostas");
    const decidir = c.querySelector(".avd-ficha-decidir");
    expect(
      resposta.compareDocumentPosition(decidir) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(c.querySelector(".avd-ficha-decidir-pergunta").textContent).toBe(
      "O documento confere com o declarado?",
    );
    expect(
      [...c.querySelectorAll(".avd-ficha-decisao-rotulo")].map(
        (b) => b.textContent,
      ),
    ).toEqual(["Confere", "Não confere", "Editar nota"]);
    // Antes da escolha: nem lista, nem pontuação, nem mensagem.
    expect(c.querySelector(".avd-ficha-itens")).toBeNull();
    expect(c.querySelector(".avd-ficha-resultado")).toBeNull();
    expect(c.querySelector(".avd-ficha-mensagem")).toBeNull();
    // Escolhido (Cursos, pela faixa/nota): sem lista; o resumo depois da pergunta.
    await conforme("CURSOS");
    expect(cartao("CURSOS").querySelector(".avd-ficha-itens")).toBeNull();
    const resultado = cartao("CURSOS").querySelector(".avd-ficha-resultado");
    expect(
      cartao("CURSOS")
        .querySelector(".avd-ficha-decidir")
        .compareDocumentPosition(resultado) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("Titulação: Confere abre a linha com o título da resposta e segura o item para ver o registro", async () => {
    await abrirFicha(supabaseFalso());
    await irAo("FORMACAO");
    await conforme("FORMACAO");
    const linha = cartao("FORMACAO").querySelector(".avd-ficha-item");
    expect(linha.querySelector("select[aria-label='Título']").value).toBe(
      "ESPECIALIZACAO",
    );
    expect(parte("FORMACAO").dataset.divergente).toBeUndefined();
    expect(
      parte("FORMACAO").querySelector(".avd-ficha-parte-valor").textContent,
    ).toBe("5 / 10");
    expect(
      cartao("FORMACAO").querySelector(".avd-ficha-resultado").textContent,
    ).toBe("Pontuação:5de 10· declarou 5");
    // A linha acabou de abrir: o item fica para conferir o registro.
    await esperarAvanco();
    expect(cartao("FORMACAO")).not.toBeNull();
    expect(etapa("FORMACAO").dataset.estado).toBe("CONFORME");
  });

  it("Cursos com declarado 0 (Não possuo): Confere sem linha e avança", async () => {
    const semCursos = fichaDoBanco();
    semCursos.regra = structuredClone(semCursos.regra);
    semCursos.regra.configuracao.provisoria.nota_declarada[1].pontos[
      "Não possuo"
    ] = 0;
    semCursos.respostas = {
      ...semCursos.respostas,
      "Pergunta 14 - Selecione a pontuação relativa à carga horária de Cursos":
        '"Não possuo"',
    };
    await abrirFicha(supabaseFalso(semCursos));
    await irAo("CURSOS");
    await conforme("CURSOS");
    expect(cartao("CURSOS").querySelector(".avd-ficha-item")).toBeNull();
    await esperarAvanco();
    expect(cartao("CURSOS")).toBeNull();
  });

  it("Confere em Cursos (declarado 3): pontuação = declarado, sem a lista dos cursos e sem pendência", async () => {
    const supabase = supabaseFalso();
    await abrirFicha(supabase);
    await irAo("CURSOS");
    await conforme("CURSOS");
    // Pela faixa/nota do bloco: nada de digitar curso por curso.
    expect(
      document.querySelector("[data-bloco='CURSOS'] .avd-ficha-item"),
    ).toBeNull();
    expect(
      document.querySelector(
        "[data-bloco='CURSOS'] input[aria-label='Carga horária']",
      ),
    ).toBeNull();
    expect(document.body.textContent).not.toContain(
      "Registre ao menos um curso",
    );
    expect(etapa("CURSOS").dataset.estado).toBe("CONFORME");
    await teclar(raiz(), "s", { ctrlKey: true });
    await esperar();
    const gravado = chamadas(supabase, "salvar_rascunho_ficha").at(-1);
    expect(gravado.p_lancamento.cursos ?? []).toEqual([]);
    expect(gravado.p_lancamento.blocos.CURSOS).toMatchObject({
      situacao: "CONFORME",
      edita_nota: false,
      nota_ajustada: 3,
    });
    expect(gravado.p_resultado.parciais.CURSOS).toBe(3);
  });

  it("Não confere em Cursos: só o motivo, pontuação 0, sem linhas e sem 'Apurado zerado'", async () => {
    await abrirFicha(supabaseFalso());
    await irAo("CURSOS");
    await clicar(cartao("CURSOS").querySelector("[data-valor='NAO_CONFERE']"));
    const c = cartao("CURSOS");
    expect(c.querySelector(".avd-ficha-itens")).toBeNull();
    expect(c.querySelector("[data-tour='avd-ficha-motivos']")).not.toBeNull();
    expect(c.querySelector("[data-tour='avd-ficha-justificativa']")).toBeNull();
    expect(c.querySelector(".avd-ficha-resultado").textContent).toBe(
      "Pontuação:0de 5· declarou 3−3",
    );
    expect(c.textContent).not.toContain("Apurado zerado");
    expect(c.querySelectorAll(".avd-ficha-mensagem")).toHaveLength(1);
  });

  it("Editar nota em Cursos: sem lista, a nota começa no declarado, passador com justificativa", async () => {
    const supabase = supabaseFalso();
    await abrirFicha(supabase);
    // Com a experiência mínima (sem ela, inapto por requisito não pede justificativa).
    await irAo("EXPERIENCIA");
    await teclar(raiz(), "3");
    await digitar(
      cartao("EXPERIENCIA").querySelector("input[aria-label='Início']"),
      "2020-01-01",
    );
    await digitar(
      cartao("EXPERIENCIA").querySelector("input[aria-label='Fim']"),
      "2022-12-31",
    );
    await irAo("CURSOS");
    await teclar(raiz(), "3");
    const c = () => cartao("CURSOS");
    expect(c().dataset.escolha).toBe("EDITAR");
    expect(c().querySelector(".avd-ficha-item")).toBeNull();
    const valor = () =>
      c().querySelector("[data-tour='avd-ficha-nota'] input").value;
    expect(valor()).toBe("3");
    expect(c().querySelector(".avd-ficha-mensagem")).toBeNull();
    // Meio ponto a menos: diverge do declarado e pede justificativa (uma área).
    await clicar(c().querySelector("[aria-label='Diminuir meio ponto']"));
    expect(valor()).toBe("2.5");
    expect(c().querySelector(".avd-ficha-mensagem").textContent).toBe(
      "Pontuação diferente da declarada: escolha a justificativa.",
    );
    expect(
      c().querySelectorAll("[data-tour='avd-ficha-justificativa']"),
    ).toHaveLength(1);
    // Sem lista, sem "Usar o calculado".
    expect(c().textContent).not.toContain("Usar o calculado");
    await teclar(raiz(), "s", { ctrlKey: true });
    await esperar();
    const gravado = chamadas(supabase, "salvar_rascunho_ficha").at(-1);
    expect(gravado.p_lancamento.blocos.CURSOS).toMatchObject({
      situacao: "CONFORME",
      edita_nota: true,
      nota_ajustada: 2.5,
    });
  });

  it("rascunho antigo de Cursos (declarado gravado como ajuste, sem item): Confere, sem lista e sem pendência", async () => {
    const antigo = fichaDoBanco({
      lancamento: {
        nivel: "superior",
        modalidade: "AC",
        blocos: { CURSOS: { situacao: "CONFORME", nota_ajustada: 3 } },
        titulos: [],
        cursos: [],
        vinculos: [],
      },
    });
    await abrirFicha(supabaseFalso(antigo));
    await irAo("CURSOS");
    const c = cartao("CURSOS");
    expect(c.dataset.escolha).toBe("CONFERE");
    expect(c.querySelector(".avd-ficha-item")).toBeNull();
    expect(c.querySelector("[data-tour='avd-ficha-justificativa']")).toBeNull();
    expect(c.textContent).not.toContain("Registre ao menos um curso");
    expect(etapa("CURSOS").dataset.estado).toBe("CONFORME");
  });

  it("ficha antiga com cursos lançados continua abrindo com a lista", async () => {
    const antiga = fichaDoBanco({
      lancamento: {
        nivel: "superior",
        modalidade: "AC",
        blocos: { CURSOS: { situacao: "CONFORME", edita_nota: true } },
        titulos: [],
        cursos: [{ nome: "NR-10", horas: 120, aceito: true }],
        vinculos: [],
      },
    });
    await abrirFicha(supabaseFalso(antiga));
    await irAo("CURSOS");
    const c = cartao("CURSOS");
    expect(c.querySelector(".avd-ficha-item")).not.toBeNull();
    expect(c.querySelector("[data-tour='avd-ficha-nota'] input").value).toBe(
      "3",
    );
  });
});

describe("ficha: itens, nota e justificativa (AM-9, AM-10, AM-11)", () => {
  it("Editar nota em Cursos pontua na hora; nota diferente da declarada pede justificativa, que vai ao parecer", async () => {
    await abrirFicha(supabaseFalso());
    // Com a experiência mínima (sem ela, inapto por requisito não pede justificativa).
    await irAo("EXPERIENCIA");
    await teclar(raiz(), "3");
    await digitar(
      cartao("EXPERIENCIA").querySelector("input[aria-label='Início']"),
      "2020-01-01",
    );
    await digitar(
      cartao("EXPERIENCIA").querySelector("input[aria-label='Fim']"),
      "2022-12-31",
    );
    await irAo("CURSOS");
    await teclar(raiz(), "3");
    // Cursos pela faixa/nota: o Editar começa no declarado.
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
      "Pontuação diferente da declarada: escolha a justificativa.",
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
    await teclar(raiz(), "3");
    await digitar(
      cartao("EXPERIENCIA").querySelector("input[aria-label='Início']"),
      "2020-01-01",
    );
    await digitar(
      cartao("EXPERIENCIA").querySelector("input[aria-label='Fim']"),
      "2022-12-31",
    );
    expect(
      cartao("EXPERIENCIA").querySelector("[data-tour='avd-ficha-nota'] input")
        .value,
    ).toBe("25");
    await clicar(
      cartao("EXPERIENCIA").querySelector(".avd-ficha-aceito input"),
    );
    expect(cartao("EXPERIENCIA").textContent).toContain(
      "Escolha o motivo da recusa do item.",
    );
    await escolher(
      cartao("EXPERIENCIA").querySelector(
        "select[aria-label='Motivo da recusa']",
      ),
      "ANTES_DO_DIPLOMA",
    );
    expect(cartao("EXPERIENCIA").textContent).not.toContain(
      "Escolha o motivo da recusa do item.",
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
    for (const codigo of ["IDENTIDADE", "ESCOLARIDADE", "REGISTRO_CONSELHO"]) {
      await irAo(codigo);
      await conforme(codigo);
    }
    expect(document.querySelector(".avd-ficha-mensagem")).toBeNull();
    expect(
      document.querySelector("[data-tour='avd-ficha-etapas']").textContent,
    ).toContain("6 de 6 conferidos");
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
    const barra = () => document.querySelector(".avd-ficha-barra .avd-inline");
    const confirmar = () =>
      clicar(barra().querySelector("[data-acao='confirmar-reabrir']"));
    // Sem motivo da lista, nada vai ao banco.
    await confirmar();
    expect(barra().textContent).toContain("Escolha o motivo da reabertura.");
    expect(chamadas(supabase, "reabrir_ficha")).toEqual([]);
    // "Outro" com sequência aleatória também não.
    const motivo = barra().querySelector("[data-campo='motivo-da-reabertura']");
    const complemento = () =>
      barra().querySelector("[data-campo='complemento-da-reabertura']");
    await escolher(motivo, "OUTRO");
    await digitar(complemento(), "dsdfsdfsfsa TERERTERTE");
    await confirmar();
    expect(barra().textContent).toContain(
      "Descreva o motivo com pelo menos 15 caracteres e 3 palavras.",
    );
    expect(chamadas(supabase, "reabrir_ficha")).toEqual([]);
    // Motivo da lista com complemento: o código e o texto vão ao banco.
    await escolher(motivo, "CURSOS");
    await digitar(complemento(), "  certificado   de 40h ");
    await confirmar();
    await esperar();
    expect(chamadas(supabase, "reabrir_ficha")).toEqual([
      {
        p_ficha: "f1",
        p_versao: 5,
        p_motivo: "CURSOS",
        p_complemento: "certificado de 40h",
      },
    ]);
  });

  it("reabrir: o erro do banco aparece; banco sem p_complemento repete a chamada antiga com o texto legível", async () => {
    const lancamento = {
      nivel: "superior",
      modalidade: "AC",
      blocos: { IDENTIDADE: { situacao: "CONFORME" } },
      titulos: [],
      cursos: [],
      vinculos: [],
    };
    const recusa = Object.assign(
      new Error(
        "Escolha o motivo da reabertura na lista. Se a lista não aparece, recarregue a página.",
      ),
      { code: "22023" },
    );
    let banco = "novo";
    const supabase = supabaseFalso(
      fichaDoBanco({
        situacao: "CONCLUIDA",
        lancamento,
        editar: false,
        reabrir: true,
      }),
      {
        reabrir_ficha: (args) => {
          if (banco === "recusa") return recusa;
          if (banco === "antigo" && "p_complemento" in args)
            return Object.assign(new Error("Could not find the function"), {
              code: "PGRST202",
            });
          return { versao: args.p_versao + 1 };
        },
      },
    );
    await abrirFicha(supabase);
    await clicar(botao("Reabrir"));
    const barra = () => document.querySelector(".avd-ficha-barra .avd-inline");
    await escolher(
      barra().querySelector("[data-campo='motivo-da-reabertura']"),
      "EXPERIENCIA",
    );
    banco = "recusa";
    await clicar(barra().querySelector("[data-acao='confirmar-reabrir']"));
    await esperar();
    expect(barra().textContent).toContain("recarregue a página");
    banco = "antigo";
    await clicar(barra().querySelector("[data-acao='confirmar-reabrir']"));
    await esperar();
    expect(chamadas(supabase, "reabrir_ficha").slice(-2)).toEqual([
      {
        p_ficha: "f1",
        p_versao: 5,
        p_motivo: "EXPERIENCIA",
        p_complemento: null,
      },
      { p_ficha: "f1", p_versao: 5, p_motivo: "Correção de experiência" },
    ]);
  });

  it("o Espelho de nota abre a impressão no navegador, sem gravar nada", async () => {
    const lancamento = {
      nivel: "superior",
      modalidade: "AC",
      blocos: { IDENTIDADE: { situacao: "CONFORME" } },
      titulos: [{ titulo: "ESPECIALIZACAO", aceito: true }],
      cursos: [],
      vinculos: [],
    };
    const ficha = fichaDoBanco({
      situacao: "CONCLUIDA",
      lancamento,
      editar: false,
    });
    ficha.ficha.tp_resultado = "APTO";
    ficha.ficha.nota_final = 30;
    const supabase = supabaseFalso(ficha);
    await abrirFicha(supabase);
    const antes = supabase.rpc.mock.calls.length;
    await clicar(botao("Espelho de nota"));
    const quadro = document.querySelector("iframe[srcdoc]");
    expect(quadro).not.toBeNull();
    const html = quadro.getAttribute("srcdoc");
    expect(html).toContain("Espelho de Pontuação da Análise Curricular");
    expect(html).toContain('data-modelo="COM_PONTOS"');
    expect(html).toContain("Pontuação por critério");
    // Só a leitura do modelo do edital (os textos da folha); nada é gravado.
    expect(supabase.rpc.mock.calls.slice(antes).map(([nome]) => nome)).toEqual([
      "obter_modelo_espelho_nota",
    ]);
    quadro.remove();
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

  it("a justificativa do ajuste acompanha os itens: preenche na abertura sem marcar alterada, refaz com os itens e guarda o texto editado", async () => {
    const lancamento = {
      nivel: "superior",
      modalidade: "AC",
      blocos: { CURSOS: { situacao: "CONFORME" } },
      titulos: [],
      cursos: [
        { nome: "A", horas: 120, aceito: true },
        { nome: "B", horas: 30, aceito: true },
      ],
      vinculos: [],
    };
    const { estado, agendados } = loja(
      rpcFalso({ obter_ficha_analise: () => fichaDoBanco({ lancamento }) }),
    );
    await estado.carregar("f1");
    const texto = () =>
      estado.obter().lancamento.blocos.CURSOS.justificativa_livre;
    expect(texto()).toBe(
      "Aceito 1 curso: 120 h (faixa ≥120 h, 3 pontos). Não pontuados: 1 curso de 30 h — abaixo de 40 h (8.2.6).",
    );
    expect(estado.obter().sujo).toBe(false);
    expect(agendados).toHaveLength(0);
    expect(estado.obter().avaliacao.parecer).toContain(
      "- Item 8.2.6: Aceito 1 curso: 120 h",
    );
    estado.mudar((l) => {
      l.cursos.push({ nome: "C", horas: 60, aceito: true });
      return l;
    });
    expect(texto()).toContain("Aceitos 2 cursos (180 h)");
    estado.mudar((l) => {
      l.blocos.CURSOS.justificativa_livre = "Texto do avaliador.";
      return l;
    });
    estado.mudar((l) => {
      l.cursos.pop();
      return l;
    });
    expect(texto()).toBe("Texto do avaliador.");
    estado.descartar();
  });

  it("na ficha só para leitura, a justificativa gravada não muda", async () => {
    const lancamento = {
      nivel: "superior",
      modalidade: "AC",
      blocos: { CURSOS: { situacao: "CONFORME" } },
      titulos: [],
      cursos: [{ nome: "B", horas: 30, aceito: true }],
      vinculos: [],
    };
    const { estado } = loja(
      rpcFalso({
        obter_ficha_analise: () => fichaDoBanco({ lancamento, editar: false }),
      }),
    );
    await estado.carregar("f1");
    expect(
      estado.obter().lancamento.blocos.CURSOS.justificativa_livre,
    ).toBeUndefined();
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

  it.each(["PT409", "40001"])(
    "conflito de versão (%s) para a edição e o salvamento automático, com o aviso",
    async (code) => {
      const erro = Object.assign(new Error("Esta ficha mudou"), { code });
      const rpc = rpcFalso({ salvar_rascunho_ficha: () => erro });
      const { estado, agendados } = loja(rpc);
      await estado.carregar("f1");
      estado.mudar((l) => ({ ...l, observacoes: "x" }));
      // O salvamento automático dispara e recebe o conflito.
      agendados.at(-1)();
      await vi.waitFor(() => expect(estado.obter().podeEditar).toBe(false));
      expect(estado.obter().aviso).toBe(
        "Esta ficha foi alterada em outra aba ou por outra pessoa. Recarregue para continuar.",
      );
      // Nada mais vai ao banco: nem nova mudança, nem novo agendamento, nem salvar.
      const envios = () =>
        rpc.mock.calls.filter(([n]) => n === "salvar_rascunho_ficha").length;
      const antes = agendados.length;
      estado.mudar((l) => ({ ...l, observacoes: "xy" }));
      expect(agendados).toHaveLength(antes);
      await estado.salvar();
      expect(envios()).toBe(1);
    },
  );

  it("concluir duas vezes (duplo clique, Ctrl+Enter) vai ao banco uma vez só e nada muda durante a conclusão", async () => {
    let soltar;
    const rpc = rpcFalso({
      concluir_ficha: (a) =>
        new Promise(
          (r) =>
            (soltar = () =>
              r({ versao: a.p_versao + 1, resultado: "INAPTO_REQUISITO" })),
        ),
    });
    const { estado } = loja(rpc);
    await estado.carregar("f1");
    // Não confere em tudo, com o motivo: nada falta para concluir.
    for (let volta = 0; volta < 4 && estado.obter().pendencias.length; volta++)
      estado.mudar((l) => {
        for (const p of estado.obter().pendencias) {
          const bloco = estado
            .obter()
            .regra.blocos.find((b) => b.codigo === p.bloco);
          const lb = (l.blocos[p.bloco] ??= {});
          lb.situacao = "NAO_CONFORME";
          if (bloco.motivos?.length) lb.motivos = [bloco.motivos[0].codigo];
          else lb.motivo_livre = "Documento não apresentado.";
        }
        return l;
      });
    expect(estado.obter().pendencias).toEqual([]);
    const primeira = estado.concluir();
    const segunda = await estado.concluir();
    expect(segunda).toEqual({ ok: false, emAndamento: true });
    await vi.waitFor(() => expect(soltar).toBeTypeOf("function"));
    const antes = estado.obter().lancamento;
    estado.mudar((l) => ({ ...l, observacoes: "durante" }));
    expect(estado.obter().lancamento).toBe(antes);
    soltar();
    expect((await primeira).ok).toBe(true);
    expect(rpc.mock.calls.filter(([n]) => n === "concluir_ficha")).toHaveLength(
      1,
    );
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

  it("o CPF que o candidato informou no questionário, formatado, ao lado do código", async () => {
    const ficha = fichaDoBanco();
    ficha.cpf_informado = "12345678909";
    await abrirFicha(supabaseFalso(ficha));
    const topo = document.querySelector(".avd-analise-topo");
    expect(topo.querySelector(".avd-analise-cpf").textContent).toBe(
      "CPF 123.456.789-09",
    );
  });

  it("sem o CPF no questionário, o cabeçalho não mostra nada", async () => {
    await abrirFicha(supabaseFalso());
    expect(document.querySelector(".avd-analise-cpf")).toBeNull();
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

describe("ficha: o que o candidato informou (respostas, arquivos e linhas sugeridas)", () => {
  it("os arquivos da pergunta de anexo, cada um com o link direto e o nome", async () => {
    const ficha = fichaDoBanco();
    const link = (arquivo) =>
      `https://corporate.empregare.com/Company/VacancyTests/GetViewerLogArquivo?arquivo=${arquivo}&nome=Case&token=TK&questionarioRespostaID=9`;
    ficha.empregare = {
      anexos: [1, 2].map((n) => ({
        resposta: "9",
        pergunta: "4",
        arquivo: n,
        ordem: 4,
        enunciado: "Anexe o documento de identificação com foto",
        coluna: "Pergunta 4 - Anexe o documento de identificação com foto",
        link: link(n === 1 ? "RG%20frente.pdf" : "RG%20verso.pdf"),
      })),
    };
    const supabase = supabaseFalso(ficha);
    await abrirFicha(supabase);
    const c = cartao("IDENTIDADE");
    expect(c.querySelector(".avd-ficha-informou").textContent).toBe(
      "O que o candidato informou",
    );
    const arquivos = [...c.querySelectorAll(".avd-ficha-arquivo")];
    expect(arquivos.map((a) => a.textContent)).toEqual([
      "RG frente.pdf",
      "RG verso.pdf",
    ]);
    expect(arquivos[1].getAttribute("href")).toBe(link("RG%20verso.pdf"));
    expect(arquivos[0].getAttribute("target")).toBe("_blank");
    await clicar(arquivos[0]);
    expect(chamadas(supabase, "registrar_acesso_ficha").at(-1)).toMatchObject({
      p_tipo: "ABRIR_EMPREGARE",
    });
  });

  it("Cursos pela faixa/nota: as linhas que o job tirou das respostas não abrem lista", async () => {
    const ficha = fichaDoBanco();
    ficha.sugestoes = {
      CURSOS: [
        {
          nome: "NR-10 Segurança em eletricidade",
          horas: 120,
          aceito: true,
          da_resposta: true,
        },
      ],
    };
    const supabase = supabaseFalso(ficha);
    await abrirFicha(supabase);
    await irAo("CURSOS");
    await conforme("CURSOS");
    expect(
      document.querySelector("[data-bloco='CURSOS'] .avd-ficha-item"),
    ).toBeNull();
    expect(etapa("CURSOS").dataset.estado).toBe("CONFORME");
  });

  it("só a resposta vigente no item; os envios anteriores recolhidos na lateral, com os arquivos", async () => {
    const ficha = fichaDoBanco();
    const link = (resposta, arquivo) =>
      `https://corporate.empregare.com/Company/VacancyTests/GetViewerLogArquivo?arquivo=${arquivo}&nome=Case&token=TK&questionarioRespostaID=${resposta}`;
    const coluna = "Pergunta 4 - Anexe o documento de identificação com foto";
    ficha.empregare = {
      anexos: [
        {
          resposta: "8019889",
          pergunta: "183219",
          arquivo: 1,
          ordem: 4,
          enunciado: "Anexe o documento de identificação com foto",
          coluna,
          link: link("8019889", "RG%20novo.pdf"),
        },
      ],
      envios_anteriores: [
        {
          resposta: "7995988",
          perguntas: 25,
          arquivos: [
            {
              pergunta: "179828",
              arquivo: 1,
              ordem: 4,
              enunciado: "Anexe o documento de identificação com foto",
              coluna,
              link: link("7995988", "RG%20antigo.pdf"),
            },
          ],
        },
      ],
    };
    const supabase = supabaseFalso(ficha);
    await abrirFicha(supabase);
    expect(
      [...cartao("IDENTIDADE").querySelectorAll(".avd-ficha-arquivo")].map(
        (a) => a.textContent,
      ),
    ).toEqual(["RG novo.pdf"]);
    const envios = document.querySelector(
      ".avd-ficha-lateral .avd-ficha-envios",
    );
    expect(envios.open).toBe(false);
    expect(envios.querySelector("summary").textContent).toBe(
      "O candidato enviou o questionário 2 vezes — ver envios anteriores",
    );
    const anterior = envios.querySelector(".avd-ficha-envio li a");
    expect(anterior.textContent).toBe("Pergunta 4");
    expect(anterior.getAttribute("href")).toBe(
      link("7995988", "RG%20antigo.pdf"),
    );
    await clicar(anterior);
    expect(chamadas(supabase, "registrar_acesso_ficha").at(-1)).toMatchObject({
      p_tipo: "ABRIR_EMPREGARE",
    });
  });

  it("resposta lida sem arquivo na pergunta: 'Sem arquivo enviado' e 'Conferir na Empregare', não um falso documento", async () => {
    const LINK =
      "https://corporate.empregare.com/empresa/curriculo/detalhes?tokenCandidato=TKfict&id=IDfict|";
    const supabase = supabaseFalso({
      ...fichaDoBanco(),
      empregare: {
        link_candidato: LINK,
        respostas: [{ resposta: "8019889", perguntas: 27, anexos: 0 }],
        anexos: [],
      },
    });
    await abrirFicha(supabase);
    const c = cartao("IDENTIDADE");
    expect(c.querySelector(".avd-ficha-texto-declarado").textContent).toBe(
      "Sem arquivo enviado",
    );
    const conferir = c.querySelector(".avd-ficha-ver-anexo");
    expect(conferir.textContent).toContain("Conferir na Empregare");
    expect(conferir.getAttribute("href")).toBe(LINK);
    expect(c.querySelector(".avd-ficha-dica-anexo").textContent).toBe(
      "A resposta lida na Empregare não traz arquivo nesta pergunta",
    );
    await clicar(conferir);
    await esperar();
    expect(chamadas(supabase, "registrar_acesso_ficha").at(-1)).toMatchObject({
      p_tipo: "ABRIR_EMPREGARE",
    });
  });

  it("sem envio anterior, nada de envios na lateral", async () => {
    await abrirFicha(supabaseFalso(fichaDoBanco()));
    expect(document.querySelector(".avd-ficha-envios")).toBeNull();
  });
});

describe("ficha: Confere vale com um clique só", () => {
  it("Confere em Cursos vale com um clique; clicar Confere de novo não desmarca e avança", async () => {
    await abrirFicha(supabaseFalso());
    await irAo("CURSOS");
    await conforme("CURSOS");
    // Pela faixa/nota: conferido sem lista para completar.
    expect(etapa("CURSOS").dataset.estado).toBe("CONFORME");
    // Quem clica Confere de novo (por hábito) confirma: não desmarca e avança.
    if (cartao("CURSOS")) {
      expect(cartao("CURSOS").dataset.escolha).toBe("CONFERE");
      await conforme("CURSOS");
    }
    expect(etapa("CURSOS").dataset.estado).toBe("CONFORME");
    await esperarAvanco();
    expect(cartao("CURSOS")).toBeNull();
    expect(etapa("CURSOS").dataset.estado).toBe("CONFORME");
  });
});

describe("ficha: a mesma escolha de novo só confirma", () => {
  it("Não confere com 'não enviou': clicar Não confere outra vez não muda a situação nem os motivos", async () => {
    await abrirFicha(supabaseFalso());
    await irAo("ESCOLARIDADE");
    const c = () => cartao("ESCOLARIDADE");
    await clicar(c().querySelector("[data-valor='NAO_CONFERE']"));
    await clicar(c().querySelector(".avd-ficha-nao-enviou input"));
    await clicar(c().querySelector(".avd-ficha-chip"));
    expect(c().dataset.situacao).toBe("NAO_ENVIADO");
    await clicar(c().querySelector("[data-valor='NAO_CONFERE']"));
    await teclar(raiz(), "2");
    expect(c().dataset.situacao).toBe("NAO_ENVIADO");
    expect(
      c().querySelector(".avd-ficha-chip").getAttribute("aria-pressed"),
    ).toBe("true");
  });
});

/* ── Pelos itens lidos do arquivo ─────────────────────────────────────── */

const COL_CERTIFICADOS =
  "Pergunta 15 - Anexe os seus Certificados de Conclusão dos Cursos";

/* A ficha com os certificados lidos pelo robô (145 h e 60 h) no item Cursos (declarou 3). */
function fichaComLeitura() {
  const ficha = fichaDoBanco();
  const regra = structuredClone(REGRA);
  regra.blocos
    .find((b) => b.codigo === "CURSOS")
    .perguntas.push("Anexe os seus Certificados de Conclusão");
  ficha.regra = { ...ficha.regra, configuracao: regra };
  ficha.respostas = { ...RESPOSTAS, [COL_CERTIFICADOS]: "Anexo" };
  ficha.empregare = {
    anexos: [
      {
        resposta: "9",
        pergunta: "15",
        arquivo: 1,
        ordem: 15,
        enunciado: "Anexe os seus Certificados de Conclusão dos Cursos",
        coluna: COL_CERTIFICADOS,
        link: "https://corporate.empregare.com/Company/VacancyTests/GetViewerLogArquivo?arquivo=certificados.pdf&nome=Case&token=TK&questionarioRespostaID=9",
      },
    ],
  };
  const curso = (nome, horas, pagina) => ({
    tipo: "CURSO",
    curso: nome,
    horas,
    instituicao: "Fiocruz",
    conclusao: "2023-05-12",
    pagina,
    alertas: [],
  });
  ficha.leituras = [
    {
      resposta: "9",
      pergunta: "15",
      arquivo: 1,
      situacao: "LIDO",
      metodo: "TEXTO",
      documento: "CERTIFICADO",
      paginas: 4,
      nome_confere: true,
      cpf_confere: null,
      alertas: [],
      itens: [curso("Arboviroses", 145, 1), curso("Saúde Indígena", 60, 3)],
      resumo: "2 certificados · 145 h, 60 h · nome confere",
    },
  ];
  return ficha;
}

describe("ficha: pelos itens lidos (conferir → pontuação dos aceitos → confirmar)", () => {
  it("anexo que é foto: o ícone de foto (o visualizador da Empregare não vira miniatura) e 'por imagem — confira'", async () => {
    const ficha = fichaComLeitura();
    ficha.empregare.anexos[0].link = ficha.empregare.anexos[0].link.replace(
      "certificados.pdf",
      "certificado-foto.jpg",
    );
    ficha.leituras[0].metodo = "OCR";
    await abrirFicha(supabaseFalso(ficha));
    await irAo("CURSOS");
    const arquivo = [
      ...cartao("CURSOS").querySelectorAll(".avd-ficha-arquivo"),
    ].find((a) => a.textContent.includes("certificado-foto.jpg"));
    expect(arquivo.dataset.imagem).toBe("true");
    expect(arquivo.querySelector(".fa-image")).not.toBeNull();
    expect(arquivo.querySelector("img")).toBeNull();
    expect(
      cartao("CURSOS").querySelector(".avd-lido-metodo").textContent,
    ).toContain("por imagem — confira");
  });

  it("Cursos com certificados lidos: as três escolhas (pela faixa/nota), sem a conferência item a item; o resumo do robô fica ao lado do arquivo", async () => {
    await abrirFicha(supabaseFalso(fichaComLeitura()));
    await irAo("CURSOS");
    const c = () => cartao("CURSOS");
    expect(c().querySelector(".avd-ficha-decidir")).not.toBeNull();
    expect(c().querySelector(".avd-conferir")).toBeNull();
    expect(c().querySelector("[data-acao='confirmar-pelos-itens']")).toBeNull();
    expect(c().querySelector(".avd-lido-resumo").textContent).toContain(
      "2 certificados",
    );
    await conforme("CURSOS");
    expect(etapa("CURSOS").dataset.estado).toBe("CONFORME");
  });
});

describe("estado da ficha: menos chamadas (20261014231000)", () => {
  const salvarFalso = (args) => ({
    versao: args.p_versao + 1,
    salvo_em: "2026-10-15T13:05:00Z",
  });

  it("rascunho 3 s depois da última mudança, mas no máximo 15 s depois da primeira pendente", async () => {
    let agora = 0;
    const agendados = [];
    const rpc = vi.fn(async (nome, args) =>
      nome === "salvar_rascunho_ficha"
        ? salvarFalso(args)
        : nome === "obter_ficha_analise"
          ? fichaDoBanco()
          : null,
    );
    const estado = criarEstadoDaFicha({
      rpc,
      toast,
      relogio: () => agora,
      agendar: (fn, ms) => agendados.push({ fn, ms }),
      cancelar: () => {},
      regras: new Map(),
    });
    await estado.carregar("f1");
    const nivel = (n) => estado.mudar((l) => ({ ...l, nivel: n }));
    nivel("tecnico");
    expect(agendados.at(-1).ms).toBe(3000);
    // Mudanças a cada 2 s: a espera encurta até fechar 15 s da primeira.
    for (const t of [2000, 4000, 6000, 8000, 10000, 12000, 14000]) {
      agora = t;
      nivel(t % 4000 ? "superior" : "tecnico");
    }
    expect(agendados.at(-1).ms).toBe(1000);
    await agendados.at(-1).fn();
    expect(
      rpc.mock.calls.filter(([n]) => n === "salvar_rascunho_ficha"),
    ).toHaveLength(1);
    // Depois do envio, a próxima mudança volta aos 3 s.
    agora = 20000;
    nivel("superior");
    expect(agendados.at(-1).ms).toBe(3000);
    estado.descartar();
  });

  it("a ficha leve: a segunda ficha manda a chave da regra e usa a configuração guardada", async () => {
    const regras = new Map();
    const chamadas = [];
    const completa = fichaDoBanco();
    const rpc = vi.fn(async (nome, args) => {
      if (nome !== "obter_ficha_analise_leve") return null;
      chamadas.push(args.p_regra_chave);
      const f = structuredClone(completa);
      f.regra.chave = "k1";
      if (args.p_regra_chave === "k1") {
        f.regra.configuracao = null;
        f.regra_omitida = true;
      } else f.regra_omitida = false;
      return f;
    });
    const criar = () =>
      criarEstadoDaFicha({
        rpc,
        toast,
        agendar: () => 0,
        cancelar: () => {},
        regras,
      });
    const primeira = criar();
    await primeira.carregar("f1");
    const segunda = criar();
    await segunda.carregar("f1");
    expect(chamadas).toEqual([null, "k1"]);
    expect(segunda.obter().dados.regra.configuracao).toEqual(
      completa.regra.configuracao,
    );
    // Cópia: a ficha não divide o objeto da regra com as outras.
    expect(segunda.obter().dados.regra.configuracao).not.toBe(
      primeira.obter().dados.regra.configuracao,
    );
    expect(segunda.obter().regra).toEqual(primeira.obter().regra);
    primeira.descartar();
    segunda.descartar();
  });

  it("banco sem a ficha leve: a de sempre", async () => {
    const ausente = Object.assign(new Error("Could not find"), {
      code: "PGRST202",
    });
    const rpc = vi.fn(async (nome) => {
      if (nome === "obter_ficha_analise_leve") throw ausente;
      return nome === "obter_ficha_analise" ? fichaDoBanco() : null;
    });
    const estado = criarEstadoDaFicha({
      rpc,
      toast,
      agendar: () => 0,
      cancelar: () => {},
      regras: new Map(),
    });
    expect(await estado.carregar("f1")).toBe(true);
    expect(await estado.carregar("f1")).toBe(true);
    expect(rpc.mock.calls.map(([n]) => n)).toEqual([
      "obter_ficha_analise_leve",
      "obter_ficha_analise",
      "obter_ficha_analise",
    ]);
    estado.descartar();
  });
});
