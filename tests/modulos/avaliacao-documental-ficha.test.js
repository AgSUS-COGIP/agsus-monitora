import { readFileSync } from "node:fs";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  definirAreaAtual,
  redefinirDadosDoMonitoramento,
} from "../../src/componentes/dados-do-monitoramento.js";
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
  O conteúdo da ficha (fase F4) dentro da gaveta da aba Fila: os blocos da
  regra com o que o candidato declarou, as teclas 1/2/3, o motivo em lista, os
  itens que pontuam na hora, a nota com justificativa, a lateral com
  declarado × apurado e o parecer, o rascunho, "Concluir e próxima" e a ficha
  concluída só para leitura com "Reabrir". AM-7 a AM-12. Dados fictícios; a
  regra é o modelo PROJ26-CURRICULAR dos casos dourados.
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
} = {}) {
  return {
    schema_version: 1,
    edital: { id: "e93", rotulo: "93/2026" },
    papel: reabrir ? "COORDENADOR" : "ANALISTA",
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
});
afterEach(async () => {
  await act(async () => painel?.raiz?.unmount());
  secao?.remove();
  document.body.innerHTML = "";
  redefinirDadosDoMonitoramento();
  toast.mockClear();
});

describe("ficha: blocos e declarado (AM-7)", () => {
  it("um cartão por bloco na ordem da regra, com a resposta da Empregare", async () => {
    await abrirFicha(supabaseFalso());
    const codigos = [...document.querySelectorAll("[data-bloco]")].map(
      (s) => s.dataset.bloco,
    );
    expect(codigos).toEqual(REGRA.blocos.map((b) => b.codigo));
    expect(cartao("EXPERIENCIA").textContent).toContain("4 anos ou mais");
    expect(cartao("FORMACAO").textContent).toContain("Especialização");
    expect(cartao("COTA_PP").textContent).toContain("Não se aplica");
    expect(cartao("COTA_PP").querySelector(".avd-ficha-situacoes")).toBeNull();
    expect(
      document.querySelector("[data-tour='avd-ficha']").textContent,
    ).not.toMatch(/\d{3}\.\d{3}\.\d{3}-\d{2}/);
  });

  it("teclas 1, 2 e 3 marcam o bloco ativo; Conforme passa ao próximo", async () => {
    await abrirFicha(supabaseFalso());
    const raiz = document.querySelector(".avd-ficha");
    await teclar(raiz, "1");
    expect(cartao("IDENTIDADE").dataset.situacao).toBe("CONFORME");
    expect(cartao("ESCOLARIDADE").dataset.ativo).toBe("sim");
    await teclar(raiz, "3");
    expect(cartao("ESCOLARIDADE").dataset.situacao).toBe("NAO_ENVIADO");
    // Não enviado pede o motivo em lista, sem digitar.
    expect(cartao("ESCOLARIDADE").textContent).toContain("Escolha o motivo.");
    await clicar(
      cartao("ESCOLARIDADE").querySelector("fieldset input[type='checkbox']"),
    );
    expect(cartao("ESCOLARIDADE").textContent).not.toContain(
      "Escolha o motivo.",
    );
    expect(document.querySelector(".avd-ficha-total").textContent).toContain(
      "Inapto (requisito)",
    );
  });
});

describe("ficha: itens, nota e justificativa (AM-9, AM-10, AM-11)", () => {
  it("curso lançado pontua na hora; nota diferente da declarada pede justificativa, que vai ao parecer", async () => {
    await abrirFicha(supabaseFalso());
    await clicar(botao("Curso", cartao("CURSOS")));
    await digitar(
      cartao("CURSOS").querySelector("input[aria-label='Carga horária']"),
      "120",
    );
    const lateral = document.querySelector(
      "[data-tour='avd-ficha-comparacao']",
    );
    const linhaCursos = [...lateral.querySelectorAll(".avd-ficha-linha")].find(
      (tr) => tr.textContent.includes("Cursos"),
    );
    expect(linhaCursos.textContent).toMatch(/Cursos de Aperfeiçoamento\s*33/);
    expect(linhaCursos.dataset.divergente).toBeUndefined();
    // Com a experiência mínima (sem ela, inapto por requisito não pede justificativa).
    await clicar(botao("Vínculo", cartao("EXPERIENCIA")));
    await digitar(
      cartao("EXPERIENCIA").querySelector("input[aria-label='Início']"),
      "2020-01-01",
    );
    await digitar(
      cartao("EXPERIENCIA").querySelector("input[aria-label='Fim']"),
      "2022-12-31",
    );
    // Ajusta a nota para menos: diverge da declarada e pede justificativa.
    await digitar(
      cartao("CURSOS").querySelector(
        "[data-tour='avd-ficha-nota'] input[type='number']",
      ),
      "2",
    );
    expect(cartao("CURSOS").textContent).toContain(
      "Nota diferente da declarada: escolha a justificativa.",
    );
    const caixa = [
      ...cartao("CURSOS").querySelectorAll(
        "[data-tour='avd-ficha-justificativa'] label",
      ),
    ].find((l) => l.textContent.includes("Nota de cursos diminuída"));
    await clicar(caixa.querySelector("input"));
    expect(cartao("CURSOS").textContent).not.toContain(
      "Nota diferente da declarada",
    );
    expect(
      document.querySelector(".avd-ficha-parecer pre").textContent,
    ).toContain("Nota de cursos de aperfeiçoamento diminuída");
    expect(
      [
        ...document.querySelectorAll(".avd-ficha-linha[data-divergente='sim']"),
      ].find((tr) => tr.textContent.includes("Cursos")).textContent,
    ).toContain("Nota de cursos diminuída");
  });

  it("vínculo com datas calcula a experiência; recusado pede motivo", async () => {
    await abrirFicha(supabaseFalso());
    await clicar(botao("Vínculo", cartao("EXPERIENCIA")));
    await digitar(
      cartao("EXPERIENCIA").querySelector("input[aria-label='Início']"),
      "2020-01-01",
    );
    await digitar(
      cartao("EXPERIENCIA").querySelector("input[aria-label='Fim']"),
      "2022-12-31",
    );
    expect(cartao("EXPERIENCIA").textContent).toMatch(/Calculado\s*25/);
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

describe("ficha: rascunho, concluir e próxima, fechar (AM-12)", () => {
  it("salvar rascunho manda o lançamento, o resultado e o parecer com a versão", async () => {
    const supabase = supabaseFalso();
    await abrirFicha(supabase);
    await teclar(document.querySelector(".avd-ficha"), "1");
    expect(document.querySelector(".avd-ficha-salvo").textContent).toBe(
      "Alteração não salva",
    );
    await clicar(botao("Salvar rascunho"));
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

  it("concluir com pendência não chama o banco; completa, conclui e pega a próxima", async () => {
    const supabase = supabaseFalso();
    await abrirFicha(supabase);
    await clicar(botao("Concluir e próxima"));
    await esperar();
    expect(chamadas(supabase, "concluir_ficha")).toHaveLength(0);
    expect(document.querySelector(".avd-ficha-erro").textContent).toMatch(
      /^Falta: \d+ item/,
    );
    const raiz = document.querySelector(".avd-ficha");
    for (let i = 0; i < 6; i++) await teclar(raiz, "1");
    // Títulos e cursos como declarados; experiência de 3 anos.
    await clicar(botao("Título", cartao("FORMACAO")));
    await clicar(botao("Curso", cartao("CURSOS")));
    await digitar(
      cartao("CURSOS").querySelector("input[aria-label='Carga horária']"),
      "120",
    );
    await clicar(botao("Vínculo", cartao("EXPERIENCIA")));
    await digitar(
      cartao("EXPERIENCIA").querySelector("input[aria-label='Início']"),
      "2020-01-01",
    );
    await digitar(
      cartao("EXPERIENCIA").querySelector("input[aria-label='Fim']"),
      "2022-12-31",
    );
    expect(document.querySelector(".avd-ficha-pendencias")).toBeNull();
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
  });

  it("Copiar código registra o acesso; Fechar e liberar salva antes de soltar a reserva", async () => {
    const supabase = supabaseFalso();
    await abrirFicha(supabase);
    await clicar(botao("Copiar código"));
    await esperar();
    expect(chamadas(supabase, "registrar_acesso_ficha")).toEqual([
      { p_ficha: "f1", p_tipo: "COPIAR_CODIGO" },
    ]);
    expect(
      document
        .querySelector("[data-tour='avd-ficha-empregare'] a")
        .getAttribute("href"),
    ).toBe("https://corporate.empregare.com/empresa/vagas/candidaturas/179698");
    await teclar(document.querySelector(".avd-ficha"), "1");
    await clicar(botao("Fechar e liberar"));
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
  it("botões travados, histórico com de quanto para quanto e a coordenação reabre com motivo", async () => {
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
      cartao("IDENTIDADE").querySelector(".avd-ficha-situacao").disabled,
    ).toBe(true);
    expect(botao("Concluir e próxima")).toBeUndefined();
    expect(document.querySelector(".avd-ficha-parecer pre").textContent).toBe(
      "Parecer gravado",
    );
    expect(document.querySelector(".avd-ficha-salvo").textContent).toBe(
      "Concluída por Ana",
    );
    expect(
      document.querySelector("[data-tour='avd-ficha-historico']").textContent,
    ).toContain("Experiência na área ou no SUS: 25 → 20");
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
    await clicar(botao("Fechar e liberar"));
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
