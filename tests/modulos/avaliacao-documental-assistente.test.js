import { readFileSync } from "node:fs";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  definirAreaAtual,
  redefinirDadosDoMonitoramento,
} from "../../src/componentes/dados-do-monitoramento.ts";
import { montarAvaliacaoDocumental } from "../../src/modulos/avaliacao-documental/avaliacao-documental.jsx";
import { DESEMPATES_DA_PROVISORIA } from "../../src/lib/avaliacao-documental/catalogo.js";
import { CATALOGO_DE_CRITERIOS } from "../../src/lib/classificacao/catalogo.js";
import {
  clicar,
  digitar,
  escolher,
  esperar,
} from "../componentes/interacoes.js";

/*
  O assistente da regra na aba Regra (src/modulos/avaliacao-documental/
  assistente/): nova regra a partir de um modelo, cardápio que marca e
  desmarca, perguntas da Empregare ligadas pelo enunciado com a cor de cada
  uma, nota mínima e desempate gravados na regra de classificação, resumo
  para o SEI e a dupla conferência. Fixtures sem dado pessoal.
*/

const ler = (arquivo) =>
  JSON.parse(
    readFileSync(`tests/fixtures/avaliacao-documental/${arquivo}`, "utf8"),
  );
const PROJ = ler("casos-de-pontuacao.json").regras["PROJ26-CURRICULAR"];
const VAGAS = ler("colunas-da-empregare-93-2026.json");

const CLASSIFICACAO = {
  schema: 1,
  documental: { nota_minima: 15, nota_minima_por_nivel: {} },
  desempate: [
    { criterio: "IDOSO_60", direcao: "SIM_PRIMEIRO" },
    { criterio: "MAIOR_IDADE", direcao: "MAIOR_PRIMEIRO" },
  ],
};

const regraSalva = (versao, configuracao = PROJ, extra = {}) => ({
  versao,
  situacao: "CONFERIR",
  modelo_origem: "PROJ26-CURRICULAR",
  configuracao,
  atualizado_em: "2026-10-06T12:00:00Z",
  por: "Gestora",
  conferir_pede_outra_pessoa: false,
  versoes: [
    {
      versao,
      em: "2026-10-06T12:00:00Z",
      por: "Gestora",
      motivo: "Copiada",
      configuracao,
    },
  ],
  ...extra,
});

function supabaseFalso({
  regra: inicial = null,
  pode = true,
  apoio = {},
  salvarPedeOutraPessoa = false,
} = {}) {
  let regra = inicial;
  const respostas = {
    listar_editais_avaliacao: () => ({
      area: "projetos",
      editais: [
        { id: "e93", edital: "93/2026", unidade: "Boa Vista", ativo: true },
      ],
    }),
    obter_regra_analise: () => ({
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
        {
          codigo: "PROJ26-CURRICULAR",
          nome: "Projetos — 93/2026",
          configuracao: PROJ,
        },
      ],
      nota_minima: { nota_minima: 15, nota_minima_por_nivel: {} },
      aldeias: { quantidade: 0 },
      pode_carregar_aldeias: false,
      perguntas: [],
      fichas_concluidas: 0,
    }),
    obter_equipe_edital: () => ({
      papel: "COORDENADOR",
      pode_coordenar: pode,
      gestores: [],
      equipe: [],
      pessoas: [],
      vagas: [],
    }),
    obter_apoio_regra_analise: () => ({
      perguntas_por_vaga: VAGAS,
      regras_da_area: [],
      classificacao: {
        pode_ler: true,
        pode_editar: true,
        regra: { versao: 3, configuracao: CLASSIFICACAO },
      },
      ...apoio,
    }),
    salvar_regra_analise: ({ p_configuracao, p_versao_atual }) => {
      regra = regraSalva(p_versao_atual + 1, p_configuracao, {
        conferir_pede_outra_pessoa: salvarPedeOutraPessoa,
      });
      return { regra, fichas_afetadas: [] };
    },
    conferir_regra_analise: () => {
      regra = { ...regra, situacao: "CONFERIDA", conferida_por: "Eu" };
      return { regra, fichas_afetadas: [] };
    },
    salvar_regra_classificacao: ({ p_configuracao }) => ({
      versao: 4,
      configuracao: p_configuracao,
      versoes: [],
    }),
  };
  return {
    rpc: vi.fn(async (nome, args) => ({
      data: respostas[nome]?.(args) ?? null,
      error: null,
    })),
    auth: {
      getSession: async () => ({ data: { session: { user: { id: "u" } } } }),
    },
  };
}

let secao;
let painel;

async function montar(supabase) {
  secao = document.createElement("section");
  secao.id = "page-avaliacao-documental";
  document.body.append(secao);
  await act(async () => {
    painel = montarAvaliacaoDocumental({ supabase, toast: vi.fn() });
  });
  await act(async () => void painel.render());
  await esperar();
  await escolher(secao.querySelector(".avd-edital select"), "e93");
  await esperar();
  await esperar();
}
const botao = (texto, raiz = secao) =>
  [...raiz.querySelectorAll("button")].find((b) =>
    b.textContent.trim().startsWith(texto),
  );
const passo = (id) => secao.querySelector(`[data-passo='${id}']`);
const cartao = (id) => secao.querySelector(`[data-cartao='${id}']`);

beforeEach(() => {
  redefinirDadosDoMonitoramento();
  definirAreaAtual("projetos");
  localStorage.removeItem("avd-regra-modo");
});
afterEach(async () => {
  await act(async () => painel?.raiz?.unmount());
  secao?.remove();
  document.body.innerHTML = "";
});

describe("assistente da regra", () => {
  it("nova regra: modelo + cardápio → versão 1 com o motivo do ponto de partida", async () => {
    const supabase = supabaseFalso();
    await montar(supabase);
    expect(secao.querySelector("#avdAstTitulo").textContent).toContain(
      "Nova regra",
    );
    expect(passo("cardapio").disabled).toBe(true);
    await clicar(secao.querySelector("[data-acao='usar-partida']"));
    expect(passo("cardapio").getAttribute("aria-current")).toBe("step");
    // Desmarcar some com o bloco.
    expect(cartao("bloco:CURSOS").dataset.marcado).toBe("sim");
    await clicar(
      cartao("bloco:CURSOS").querySelector("input[type='checkbox']"),
    );
    expect(cartao("bloco:CURSOS").dataset.marcado).toBe("nao");
    expect(
      cartao("bloco:CURSOS").querySelector(".avd-ast-cartao-corpo"),
    ).toBeNull();
    // O critério étnico não aparece em Projetos.
    expect(cartao("bloco:ETNICO")).toBeNull();
    await clicar(passo("conferir"));
    await clicar(secao.querySelector("[data-acao='salvar-assistente']"));
    await esperar();
    const chamada = supabase.rpc.mock.calls.find(
      ([nome]) => nome === "salvar_regra_analise",
    );
    expect(chamada[1]).toMatchObject({
      p_edital: "e93",
      p_versao_atual: 0,
      p_motivo: "Criada no assistente a partir do modelo PROJ26-CURRICULAR",
    });
    expect(
      chamada[1].p_configuracao.blocos.some((b) => b.tipo === "CURSOS"),
    ).toBe(false);
    expect(chamada[1].p_configuracao.edital_rotulo).toBe("Edital 93/2026");
    expect(secao.textContent).toContain("Versão 1");
  }, 20000);

  it("perguntas da Empregare: liga pelo enunciado e mostra a cor de cada uma", async () => {
    await montar(supabaseFalso({ regra: regraSalva(1) }));
    await clicar(passo("perguntas"));
    await esperar();
    expect(secao.textContent).toContain("pergunta(s) ligada(s) pelo enunciado");
    const formacao = secao.querySelector("[data-bloco='FORMACAO']");
    const linhas = formacao.querySelectorAll("[data-ligacao]");
    expect(linhas.length).toBeGreaterThan(0);
    expect(linhas[0].querySelector("input").value).toBe(
      "Qual seu Nível de Titulação Acadêmica",
    );
    expect(linhas[0].dataset.situacao).toBe("achou");
    // Um começo que casa com duas colunas da mesma vaga: amarelo.
    const cota = () => secao.querySelector("[data-bloco='COTA_PP']");
    expect(cota().querySelectorAll("li[data-situacao='achou']").length).toBe(3);
    await digitar(
      cota().querySelector("[data-ligacao] input"),
      "Candidatos concorrendo",
    );
    expect(cota().querySelector("[data-situacao='ambigua']")).not.toBeNull();
    // Escolher da lista troca pela pergunta inteira: verde de novo.
    const lista = cota().querySelector("[data-ligacao] select");
    await escolher(lista, [...lista.options][1].value);
    expect(cota().querySelector("[data-situacao='ambigua']")).toBeNull();
  }, 20000);

  it("nota mínima e desempate gravam na regra de classificação (sem versão nova da regra)", async () => {
    const supabase = supabaseFalso({ regra: regraSalva(2) });
    await montar(supabase);
    await clicar(passo("nota"));
    const minima = secao.querySelector(
      "[data-tour='avd-assistente-nota-minima'] input",
    );
    await digitar(minima, "16");
    await clicar(secao.querySelector("[aria-label='Subir o 2º']"));
    await clicar(passo("conferir"));
    expect(secao.querySelector("[data-salva-classificacao]")).not.toBeNull();
    await digitar(
      secao.querySelector(".avd-ast-salvar input"),
      "Nota mínima do edital retificado",
    );
    await clicar(secao.querySelector("[data-acao='salvar-assistente']"));
    await esperar();
    const chamada = supabase.rpc.mock.calls.find(
      ([nome]) => nome === "salvar_regra_classificacao",
    );
    expect(chamada[1]).toMatchObject({
      p_edital: "e93",
      p_versao_atual: 3,
      p_motivo: "Nota mínima do edital retificado",
    });
    expect(chamada[1].p_configuracao.documental.nota_minima).toBe(16);
    expect(chamada[1].p_configuracao.desempate.map((d) => d.criterio)).toEqual([
      "MAIOR_IDADE",
      "IDOSO_60",
    ]);
    expect(
      supabase.rpc.mock.calls.some(([nome]) => nome === "salvar_regra_analise"),
    ).toBe(false);
  }, 20000);

  it("passo 2: o grupo Na inscrição vem no topo", async () => {
    await montar(supabaseFalso({ regra: regraSalva(1) }));
    await clicar(passo("cardapio"));
    const grupos = [
      ...secao.querySelectorAll(".avd-ast-passo > .avd-ast-grupo"),
    ];
    expect(grupos[0].getAttribute("aria-label")).toBe("Na inscrição");
    expect(grupos.map((g) => g.getAttribute("aria-label"))).toEqual(
      expect.arrayContaining(["Requisitos que eliminam", "O que vale ponto"]),
    );
  });

  it("passo 4: o catálogo inteiro de desempate, em grupos, marca os usados e acrescenta", async () => {
    await montar(supabaseFalso({ regra: regraSalva(1) }));
    await clicar(passo("nota"));
    const [daClassificacao, daProvisoria] = secao.querySelectorAll(
      "[data-acao='acrescentar-criterio']",
    );
    await clicar(daClassificacao);
    const painel = secao.querySelector(".avd-ast-catalogo-painel");
    const itens = painel.querySelectorAll("[data-criterio]");
    expect(itens.length).toBe(CATALOGO_DE_CRITERIOS.length);
    expect(
      [...painel.querySelectorAll("[data-grupo]")].map((g) => g.dataset.grupo),
    ).toEqual(["legal", "pontuacao", "experiencia", "idade", "outros"]);
    const idoso = painel.querySelector("[data-criterio='IDOSO_60']");
    expect(idoso.disabled).toBe(true);
    expect(idoso.textContent).toContain("1º na lista");
    await clicar(painel.querySelector("[data-criterio='PCD']"));
    const lista = secao.querySelector("[data-tour='avd-assistente-desempate']");
    expect(lista.textContent).toContain("Ser pessoa com deficiência");
    // Busca sem acento.
    await digitar(painel.querySelector("input[type='search']"), "saude");
    expect(
      [...painel.querySelectorAll("[data-criterio]")].map(
        (b) => b.dataset.criterio,
      ),
    ).toEqual(["EXP_SAUDE_INDIGENA", "EXP_SAUDE_DIGITAL"]);
    // A Provisória mostra o catálogo dela inteiro.
    await clicar(daProvisoria);
    const paineis = secao.querySelectorAll(".avd-ast-catalogo-painel");
    expect(
      paineis[paineis.length - 1].querySelectorAll("[data-criterio]").length,
    ).toBe(DESEMPATES_DA_PROVISORIA.length);
  });

  it("passo 4: quem só lê a Classificação vê o aviso, sem seletor vazio", async () => {
    await montar(
      supabaseFalso({
        regra: regraSalva(1),
        apoio: {
          classificacao: {
            pode_ler: true,
            pode_editar: false,
            regra: { versao: 3, configuracao: CLASSIFICACAO },
          },
        },
      }),
    );
    await clicar(passo("nota"));
    const grupo = secao.querySelector("[aria-label='Regra de classificação']");
    expect(grupo.textContent).toContain(
      "Seu acesso à Classificação é de leitura",
    );
    expect(
      grupo.querySelector("[data-acao='acrescentar-criterio']"),
    ).toBeNull();
  });

  it("passo 5 sem mudanças: diz que a vigente continua valendo e conclui com ✓", async () => {
    const supabase = supabaseFalso({ regra: regraSalva(2) });
    await montar(supabase);
    // (O passo 3 liga sozinho as perguntas sem ligação: aí a regra muda.)
    for (const id of ["cardapio", "nota", "conferir"]) await clicar(passo(id));
    // Ordem: estado, resumo, comparar, testar (fechado); sem mudança, sem barra de salvar.
    const ordem = [
      ...secao.querySelectorAll(
        ".avd-ast-estado, .avd-ast-resumo, .avd-ast-comparar, .avd-previa, .avd-ast-salvar",
      ),
    ].map((s) => s.classList[1]);
    expect(ordem).toEqual([
      "avd-ast-estado",
      "avd-ast-resumo",
      "avd-ast-comparar",
      "avd-previa",
    ]);
    expect(secao.querySelector(".avd-previa-corpo")).toBeNull();
    const cartao = () => secao.querySelector(".avd-ast-estado");
    expect(cartao().dataset.modo).toBe("sem-mudancas");
    expect(cartao().textContent).toContain(
      "Sem mudanças — a Versão 2 continua valendo (a conferir)",
    );
    expect(secao.querySelector("[data-acao='salvar-assistente']")).toBeNull();
    const concluir = secao.querySelector("[data-acao='concluir-assistente']");
    expect(concluir.textContent).toContain("Concluir sem mudanças");
    expect(secao.querySelector(".avd-ast-navegacao").dataset.fixa).toBe("sim");
    const ultimoPasso = () =>
      secao.querySelector(".avd-ast-passos li:last-child");
    expect(ultimoPasso().dataset.estado).toBe("atual");
    await clicar(concluir);
    expect(ultimoPasso().dataset.estado).toBe("feito");
    expect(cartao().dataset.modo).toBe("concluido");
    // Voltar ao passo 2 e fechar o assistente.
    await clicar(secao.querySelector("[data-acao='voltar-ao-passo-2']"));
    expect(passo("cardapio").getAttribute("aria-current")).toBe("step");
    await clicar(passo("conferir"));
    await clicar(
      secao.querySelector("[data-acao='fechar-assistente-do-cartao']"),
    );
    expect(secao.querySelector(".avd-ast")).toBeNull();
    expect(
      secao.querySelector(".avd-ast-fechado .avd-ast-resumo"),
    ).not.toBeNull();
    await clicar(secao.querySelector("[data-acao='abrir-assistente']"));
    expect(secao.querySelector(".avd-ast")).not.toBeNull();
    expect(
      supabase.rpc.mock.calls.some(([nome]) => nome.startsWith("salvar_")),
    ).toBe(false);
  });

  it("passo 5 com mudanças: o que falta leva ao campo; salvar mostra a confirmação e confere ali", async () => {
    const supabase = supabaseFalso({ regra: regraSalva(2) });
    await montar(supabase);
    await clicar(passo("nota"));
    await digitar(
      secao.querySelector("[data-tour='avd-assistente-nota-minima'] input"),
      "16",
    );
    await clicar(passo("cardapio"));
    await clicar(
      cartao("bloco:CURSOS").querySelector("input[type='checkbox']"),
    );
    await clicar(passo("conferir"));
    const estadoDoPasso = () => secao.querySelector(".avd-ast-estado");
    const salvar = () => secao.querySelector("[data-acao='salvar-assistente']");
    expect(estadoDoPasso().dataset.modo).toBe("pronto");
    expect(estadoDoPasso().textContent).toContain(
      "Pronto para salvar como Versão 3",
    );
    expect(salvar().textContent).toContain("Salvar como Versão 3");
    expect(salvar().disabled).toBe(true);
    const falta = estadoDoPasso().querySelector(".avd-ast-falta-item");
    expect(falta.textContent).toContain(
      "Escreva o motivo da alteração (mín. 10 caracteres)",
    );
    await clicar(falta);
    await esperar(() => new Promise((r) => requestAnimationFrame(r)));
    expect(document.activeElement).toBe(
      secao.querySelector("[data-campo='motivo'] input"),
    );
    await digitar(
      secao.querySelector("[data-campo='motivo'] input"),
      "Edital retificado: sem cursos",
    );
    expect(estadoDoPasso().textContent).toContain("Tudo certo");
    expect(salvar().disabled).toBe(false);
    await clicar(salvar());
    await esperar();
    await esperar();
    // A aba remonta na versão nova: o assistente volta no passo 5, com ✓.
    expect(passo("conferir").getAttribute("aria-current")).toBe("step");
    expect(
      secao.querySelector(".avd-ast-passos li:last-child").dataset.estado,
    ).toBe("feito");
    expect(estadoDoPasso().dataset.modo).toBe("salvo");
    expect(estadoDoPasso().textContent).toContain("Versão 3 salva");
    await clicar(secao.querySelector("[data-acao='conferir-no-assistente']"));
    await esperar();
    expect(
      supabase.rpc.mock.calls.some(
        ([nome]) => nome === "conferir_regra_analise",
      ),
    ).toBe(true);
    expect(estadoDoPasso().textContent).toContain("(Conferida)");
    await clicar(secao.querySelector("[data-acao='fechar-assistente']"));
    expect(
      secao.querySelector("[data-acao='abrir-assistente']"),
    ).not.toBeNull();
  }, 20000);

  it("passo 5 depois de salvar: quem salvou vê por que não pode conferir", async () => {
    await montar(
      supabaseFalso({ regra: regraSalva(2), salvarPedeOutraPessoa: true }),
    );
    await clicar(passo("cardapio"));
    await clicar(
      cartao("bloco:CURSOS").querySelector("input[type='checkbox']"),
    );
    await clicar(passo("conferir"));
    await digitar(
      secao.querySelector("[data-campo='motivo'] input"),
      "Edital retificado: sem cursos",
    );
    await clicar(secao.querySelector("[data-acao='salvar-assistente']"));
    await esperar();
    await esperar();
    const cartaoDoPasso = secao.querySelector(".avd-ast-estado");
    expect(cartaoDoPasso.dataset.modo).toBe("salvo");
    expect(
      cartaoDoPasso.querySelector("[data-acao='conferir-no-assistente']"),
    ).toBeNull();
    expect(
      cartaoDoPasso.querySelector("[data-dupla-conferencia]").textContent,
    ).toContain("outra pessoa da coordenação");
  }, 20000);

  it("resumo de uma página e Copiar para o SEI", async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    await montar(supabaseFalso({ regra: regraSalva(1) }));
    await clicar(passo("conferir"));
    const resumo = secao.querySelector(".avd-ast-resumo");
    expect(resumo.textContent).toContain("O que elimina");
    expect(resumo.textContent).toContain("Nota mínima: 15 pontos");
    expect(resumo.textContent).toContain("Classificação: 1º 60 anos ou mais");
    await clicar(secao.querySelector("[data-acao='copiar-resumo']"));
    await esperar();
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("O QUE ELIMINA"),
    );
    delete navigator.clipboard;
  }, 20000);

  it("dupla conferência: quem salvou a versão não marca como conferida", async () => {
    await montar(
      supabaseFalso({
        regra: regraSalva(2, PROJ, { conferir_pede_outra_pessoa: true }),
      }),
    );
    const conferir = secao.querySelector("[data-acao='conferir-regra']");
    expect(conferir.disabled).toBe(true);
    expect(
      secao.querySelector("[data-dupla-conferencia]").textContent,
    ).toContain("outra pessoa da coordenação");
  });

  it("modo avançado continua disponível e lembra a escolha", async () => {
    await montar(supabaseFalso({ regra: regraSalva(1) }));
    await clicar(botao("Modo avançado"));
    expect(secao.querySelector("[data-acao='salvar-regra']")).not.toBeNull();
    expect(secao.querySelector(".avd-ast")).toBeNull();
    expect(localStorage.getItem("avd-regra-modo")).toBe("avancado");
  });

  it("quem só lê vê o resumo, sem o assistente", async () => {
    await montar(supabaseFalso({ regra: regraSalva(1), pode: false }));
    expect(secao.querySelector(".avd-ast")).toBeNull();
    expect(secao.querySelector(".avd-ast-resumo")).not.toBeNull();
  });
});
