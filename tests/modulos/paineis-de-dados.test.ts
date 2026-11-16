import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { criarPaineisDeDados } from "../../src/modulos/paineis-de-dados/paineis-de-dados.tsx";
import {
  MENSAGEM_SEM_PERMISSAO,
  MENSAGEM_SEM_PUBLICACAO,
} from "../../src/modulos/paineis-de-dados/estado.ts";
import { strFromU8, unzipSync } from "fflate";
import {
  clicar,
  digitar,
  escolher,
  esperar,
} from "../componentes/interacoes.ts";
import { paginasPermitidas } from "../../src/lib/access-roles.ts";
import { bloqueioDaTela } from "../../src/lib/navegacao.ts";
import { telaDaRota } from "../../src/lib/rotas.ts";
import type {
  NiveisPorRecurso,
  PerfilDeAcesso,
} from "../../src/lib/tipos-dos-acessos.ts";

/*
  Painéis (bloco Dados do menu): a tela, a permissão pelo recurso
  `paineis_dados`, a rota, a paginação e os downloads.
*/

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let raiz: Root | undefined;
let caixa: HTMLDivElement | undefined;
afterEach(async () => {
  await act(async () => raiz?.unmount());
  caixa?.remove();
});

const perfil = (permissoes: NiveisPorRecurso) =>
  ({ id: "u1", ativo: true, permissoes }) satisfies PerfilDeAcesso;

type Resposta = {
  data: unknown;
  error: { code: string; message?: string } | null;
};

/* Supabase falso: guarda as chamadas e responde por RPC. */
function supabaseFalso(respostas: Record<string, Resposta>) {
  const chamadas: { nome: string; args: unknown }[] = [];
  return {
    chamadas,
    rpc: vi.fn(async (nome: string, args: Record<string, unknown>) => {
      chamadas.push({ nome, args });
      return respostas[nome] ?? { data: { linhas: [] }, error: null };
    }),
  };
}

const RESUMO: Resposta = {
  data: {
    gerado_em: "2026-11-13T15:00:00Z",
    linhas: [
      {
        edital: "39/2026",
        unidade: "DSEI Teste",
        vagas_imediatas: 12,
        data_divulgacao: "2026-03-05",
        data_final: "2026-06-30",
      },
    ],
  },
  error: null,
};

async function montar(respostas: Record<string, Resposta> = {}) {
  const supabase = supabaseFalso(respostas);
  const salvos: { arquivo: Blob; nome: string }[] = [];
  const tela = criarPaineisDeDados({
    supabase,
    areaAtual: () => "saude-indigena",
    salvar: (arquivo, nome) => salvos.push({ arquivo, nome }),
    agora: () => new Date("2026-11-13T15:04:00Z"),
  });
  caixa = document.createElement("div");
  document.body.append(caixa);
  raiz = createRoot(caixa);
  await act(async () => raiz?.render(tela.conteudo));
  await esperar(() => tela.render());
  return { tela, supabase, salvos, caixa };
}

const botao = (rotulo: string) =>
  [...(caixa?.querySelectorAll("button") ?? [])].find(
    (b) => b.textContent?.trim() === rotulo,
  );

describe("Painéis", () => {
  it("abre no Resumo dos editais da área e desenha a tabela", async () => {
    const { supabase } = await montar({
      listar_resumo_dos_editais_do_painel: RESUMO,
    });
    expect(supabase.chamadas).toEqual([
      {
        nome: "listar_resumo_dos_editais_do_painel",
        args: { p_area: "saude-indigena" },
      },
    ]);
    expect(
      [...(caixa?.querySelectorAll("[role=tab]") ?? [])].map(
        (aba) => aba.textContent,
      ),
    ).toEqual(["Resumo dos editais", "Editais por cargo", "Aprovados"]);
    const celulas = [...(caixa?.querySelectorAll("tbody td") ?? [])].map(
      (td) => td.textContent,
    );
    expect(celulas).toEqual([
      "39/2026",
      "DSEI Teste",
      "12",
      "05/03/2026",
      "30/06/2026",
    ]);
  });

  it("cada aba lê o seu relatório uma vez", async () => {
    const { supabase } = await montar();
    await clicar(botao("Aprovados"));
    await esperar();
    await clicar(botao("Resumo dos editais"));
    await esperar();
    expect(supabase.chamadas.map((c) => c.nome)).toEqual([
      "listar_resumo_dos_editais_do_painel",
      "listar_aprovados_do_painel",
    ]);
    await clicar(botao("Sincronizar"));
    await esperar();
    expect(supabase.chamadas).toHaveLength(3);
    // Depois de sincronizar, a outra aba relê ao ser aberta.
    await clicar(botao("Aprovados"));
    await esperar();
    expect(supabase.chamadas.map((c) => c.nome).at(-1)).toBe(
      "listar_aprovados_do_painel",
    );
    expect(supabase.chamadas).toHaveLength(4);
  });

  it("o topo tem Sincronizar e a data da última leitura, uma vez só", async () => {
    await montar({ listar_resumo_dos_editais_do_painel: RESUMO });
    const topo = caixa?.querySelector(".ui-topo");
    expect(
      topo?.querySelector("[data-acao='atualizar']")?.textContent,
    ).toContain("Sincronizar");
    expect(topo?.querySelector("[data-status-da-carga]")?.textContent).toMatch(
      /^Sincronizado em 13\/11\/2026,? 12:00$/,
    );
    expect(caixa?.textContent?.match(/Sincronizado em/g)).toHaveLength(1);
    expect(botao("Atualizar")).toBeUndefined();
  });

  it("baixa o CSV e o XLSX do que está na tabela", async () => {
    const { salvos } = await montar({
      listar_resumo_dos_editais_do_painel: RESUMO,
    });
    await clicar(botao("Baixar CSV"));
    await esperar();
    await clicar(botao("Baixar XLSX"));
    await esperar(() => new Promise((ok) => setTimeout(ok, 50)));
    expect(salvos.map((s) => s.nome)).toEqual([
      "resumo-dos-editais-saude-indigena-2026-11-13-1204.csv",
      "resumo-dos-editais-saude-indigena-2026-11-13-1204.xlsx",
    ]);
    const csv = await salvos[0]!.arquivo.text();
    expect(csv).toContain("39/2026;DSEI Teste;12;05/03/2026;30/06/2026");
    expect(salvos[1]!.arquivo.size).toBeGreaterThan(0);
  });

  it("pagina a tabela: 50 por vez, setas e linhas por página", async () => {
    const linhas = Array.from({ length: 120 }, (_, i) => ({
      edital: `${i + 1}/2026`,
      unidade: "DSEI Teste",
      vagas_imediatas: i,
    }));
    await montar({
      listar_resumo_dos_editais_do_painel: { data: { linhas }, error: null },
    });
    const primeiraCelula = () =>
      caixa?.querySelector("tbody tr td")?.textContent ?? "";
    const paginacao = () =>
      caixa?.querySelector("[data-paginacao]")?.textContent ?? "";
    expect(caixa?.querySelectorAll("tbody tr")).toHaveLength(50);
    // A paginação fica acima da tabela.
    const barra = caixa?.querySelector("[data-paginacao]");
    const tabela = caixa?.querySelector("table");
    expect(
      barra && tabela
        ? barra.compareDocumentPosition(tabela) &
            Node.DOCUMENT_POSITION_FOLLOWING
        : 0,
    ).toBeTruthy();
    expect(paginacao()).toContain("Mostrando 1–50 de 120");
    expect(paginacao()).toContain("Página 1 de 3");
    expect(
      caixa
        ?.querySelector("[aria-label='Página anterior']")
        ?.hasAttribute("disabled"),
    ).toBe(true);

    await clicar(caixa?.querySelector("[aria-label='Próxima página']"));
    expect(primeiraCelula()).toBe("51/2026");
    expect(paginacao()).toContain("Mostrando 51–100 de 120");
    await clicar(caixa?.querySelector("[aria-label='Próxima página']"));
    expect(caixa?.querySelectorAll("tbody tr")).toHaveLength(20);
    expect(
      caixa
        ?.querySelector("[aria-label='Próxima página']")
        ?.hasAttribute("disabled"),
    ).toBe(true);

    await escolher(caixa?.querySelector("[data-paginacao] select"), "25");
    expect(primeiraCelula()).toBe("1/2026");
    expect(paginacao()).toContain("Página 1 de 5");
    expect(caixa?.querySelectorAll("tbody tr")).toHaveLength(25);
  });

  it("sem permissão ou sem a migration, o aviso no lugar da tabela", async () => {
    await montar({
      listar_resumo_dos_editais_do_painel: {
        data: null,
        error: { code: "42501" },
      },
    });
    expect(caixa?.querySelector("[role=alert]")?.textContent).toBe(
      MENSAGEM_SEM_PERMISSAO,
    );
    expect(botao("Baixar CSV")?.hasAttribute("disabled")).toBe(true);
    await act(async () => raiz?.unmount());
    caixa?.remove();
    await montar({
      listar_resumo_dos_editais_do_painel: {
        data: null,
        error: { code: "PGRST202" },
      },
    });
    expect(caixa?.querySelector("[role=alert]")?.textContent).toBe(
      MENSAGEM_SEM_PUBLICACAO,
    );
  });

  it("abre só com o recurso paineis_dados", () => {
    expect(
      paginasPermitidas(perfil({ paineis_dados: "leitor" }))[
        "paineis-de-dados"
      ],
    ).toBe(true);
    expect(
      paginasPermitidas(perfil({ paineis_dados: "sem_acesso" }))[
        "paineis-de-dados"
      ],
    ).toBe(false);
    expect(paginasPermitidas(perfil({}))["paineis-de-dados"]).toBe(false);
    expect(
      bloqueioDaTela("paineis-de-dados", perfil({ paineis_dados: "leitor" })),
    ).toBe("");
    expect(bloqueioDaTela("paineis-de-dados", perfil({}))).toBe(
      "Sem permissão para Painéis.",
    );
  });

  it("tem rota própria", () => {
    expect(telaDaRota("paineis-de-dados")).toMatchObject({
      caminho: "paineis-de-dados",
      titulo: "Painéis",
    });
  });
});

const FONTES_EDITAVEIS = {
  pode_editar: true,
  colunas: [
    {
      coluna: "vagas_imediatas",
      rotulo: "Total de vagas imediatas",
      tipo: "inteiro",
      padrao: "Padrão: vagas do cadastro do edital",
      escolha: null,
      opcoes: [
        {
          visao: "VW_EDITAL_QUADRO_DE_VAGAS",
          rotulo: "Quadro de vagas do edital",
          colunas: [
            {
              coluna: "QT_VAGA_IMEDIATA",
              rotulo: "Vagas imediatas (soma do quadro)",
            },
          ],
        },
      ],
    },
    {
      coluna: "data_divulgacao",
      rotulo: "Data da divulgação do edital",
      tipo: "data",
      padrao: "Padrão: início da 1ª etapa do cronograma",
      escolha: { visao: "VW_EDITAL_CADASTRO", coluna: "DT_INICIO" },
      opcoes: [
        {
          visao: "VW_EDITAL_CADASTRO",
          rotulo: "Cadastro do edital (sem o cronograma)",
          colunas: [
            { coluna: "DT_INICIO", rotulo: "Data de início do formulário" },
            { coluna: "DT_FIM", rotulo: "Data de fim do formulário" },
          ],
        },
      ],
    },
  ],
  historico: [
    {
      em: "2026-11-13T15:00:00Z",
      nome: "Pessoa Administradora",
      coluna: "Data da divulgação do edital",
      antes: "Padrão: início da 1ª etapa do cronograma",
      depois:
        "Cadastro do edital (sem o cronograma) › Data de início do formulário",
      motivo: "Conferência do cronograma.",
    },
  ],
};

const RESUMO_COM_FONTE: Resposta = {
  data: {
    ...(RESUMO.data as Record<string, unknown>),
    fontes: {
      vagas_imediatas: {
        padrao: false,
        visao: "VW_EDITAL_QUADRO_DE_VAGAS",
        coluna: "QT_VAGA_IMEDIATA",
        rotulo: "Quadro de vagas do edital › Vagas imediatas (soma do quadro)",
      },
      data_divulgacao: {
        padrao: true,
        visao: null,
        coluna: null,
        rotulo: "Padrão: início da 1ª etapa do cronograma",
      },
    },
    avisos: [
      'A fonte escolhida para "Data final do processo seletivo" não está disponível: a coluna ficou vazia.',
    ],
  },
  error: null,
};

const gaveta = () => document.querySelector("[role='dialog']");
const naGaveta = (coluna: string) =>
  gaveta()?.querySelector(`[data-coluna='${coluna}']`) ?? null;
const botaoEm = (onde: Element | null | undefined, rotulo: string) =>
  [...(onde?.querySelectorAll("button") ?? [])].find(
    (b) => b.textContent?.trim() === rotulo,
  );
const chamadasDe = (
  chamadas: { nome: string; args: unknown }[],
  nome: string,
) => chamadas.filter((c) => c.nome === nome);

describe("Fontes dos dados", () => {
  const respostas = (fontes: unknown = FONTES_EDITAVEIS) => ({
    listar_resumo_dos_editais_do_painel: RESUMO,
    listar_fontes_do_painel: { data: fontes, error: null },
    salvar_fonte_da_coluna: { data: fontes, error: null },
  });

  it("o botão Fontes dos dados abre a gaveta do relatório e da área", async () => {
    const { supabase } = await montar(respostas());
    await clicar(botao("Fontes dos dados"));
    await esperar();
    expect(chamadasDe(supabase.chamadas, "listar_fontes_do_painel")).toEqual([
      {
        nome: "listar_fontes_do_painel",
        args: { p_area: "saude-indigena", p_relatorio: "resumo-dos-editais" },
      },
    ]);
    expect(gaveta()?.textContent).toContain("Fontes dos dados");
    expect(naGaveta("vagas_imediatas")?.textContent).toContain(
      "Total de vagas imediatas",
    );
    expect(gaveta()?.textContent).toContain("Conferência do cronograma.");
  });

  it("quem não é Administrador vê a gaveta sem os controles", async () => {
    await montar(respostas({ ...FONTES_EDITAVEIS, pode_editar: false }));
    await clicar(botao("Fontes dos dados"));
    await esperar();
    expect(gaveta()?.querySelector("select")).toBeNull();
    expect(botaoEm(gaveta(), "Salvar")).toBeUndefined();
    expect(naGaveta("data_divulgacao")?.textContent).toContain(
      "Cadastro do edital (sem o cronograma) › Data de início do formulário",
    );
    expect(naGaveta("vagas_imediatas")?.textContent).toContain(
      "Padrão: vagas do cadastro do edital",
    );
  });

  it("salvar manda a fonte e o motivo e relê o relatório", async () => {
    const { supabase } = await montar(respostas());
    await clicar(botao("Fontes dos dados"));
    await esperar();
    const linha = naGaveta("vagas_imediatas");
    await escolher(
      linha?.querySelector("select[aria-label^='Origem']"),
      "VW_EDITAL_QUADRO_DE_VAGAS",
    );
    expect(
      (
        linha?.querySelector(
          "select[aria-label^='Coluna']",
        ) as HTMLSelectElement | null
      )?.value,
    ).toBe("QT_VAGA_IMEDIATA");
    await digitar(
      linha?.querySelector("input[aria-label^='Motivo']"),
      "Usar o quadro do edital.",
    );
    await clicar(botaoEm(linha, "Salvar"));
    await esperar();
    expect(chamadasDe(supabase.chamadas, "salvar_fonte_da_coluna")).toEqual([
      {
        nome: "salvar_fonte_da_coluna",
        args: {
          p_area: "saude-indigena",
          p_relatorio: "resumo-dos-editais",
          p_coluna: "vagas_imediatas",
          p_visao: "VW_EDITAL_QUADRO_DE_VAGAS",
          p_coluna_visao: "QT_VAGA_IMEDIATA",
          p_motivo: "Usar o quadro do edital.",
        },
      },
    ]);
    expect(
      chamadasDe(supabase.chamadas, "listar_resumo_dos_editais_do_painel"),
    ).toHaveLength(2);
  });

  it("Voltar ao padrão manda p_visao nulo", async () => {
    const { supabase } = await montar(respostas());
    await clicar(botao("Fontes dos dados"));
    await esperar();
    const linha = naGaveta("data_divulgacao");
    await digitar(
      linha?.querySelector("input[aria-label^='Motivo']"),
      "O cronograma foi revisado.",
    );
    await clicar(botaoEm(linha, "Voltar ao padrão"));
    await esperar();
    expect(
      chamadasDe(supabase.chamadas, "salvar_fonte_da_coluna")[0]?.args,
    ).toMatchObject({
      p_coluna: "data_divulgacao",
      p_visao: null,
      p_coluna_visao: null,
      p_motivo: "O cronograma foi revisado.",
    });
  });

  it("o erro do banco ao salvar aparece na gaveta", async () => {
    await montar({
      ...respostas(),
      salvar_fonte_da_coluna: {
        data: null,
        error: { code: "22023", message: "Motivo: de 3 a 500 caracteres." },
      },
    });
    await clicar(botao("Fontes dos dados"));
    await esperar();
    const linha = naGaveta("vagas_imediatas");
    await escolher(
      linha?.querySelector("select[aria-label^='Origem']"),
      "VW_EDITAL_QUADRO_DE_VAGAS",
    );
    await clicar(botaoEm(linha, "Salvar"));
    await esperar();
    expect(gaveta()?.querySelector("[role='alert']")?.textContent).toContain(
      "Motivo: de 3 a 500 caracteres.",
    );
  });

  it("coluna fora do padrão tem marcador no cabeçalho com a fonte na dica", async () => {
    await montar({ listar_resumo_dos_editais_do_painel: RESUMO_COM_FONTE });
    const cabecalhos = [...(caixa?.querySelectorAll("thead th") ?? [])];
    const vagas = cabecalhos.find((th) =>
      th.textContent?.includes("Total de vagas imediatas"),
    );
    const divulgacao = cabecalhos.find((th) =>
      th.textContent?.includes("Data da divulgação"),
    );
    expect(vagas?.querySelector("[data-fonte-diferente]")).not.toBeNull();
    expect(vagas?.getAttribute("title")).toContain(
      "Quadro de vagas do edital › Vagas imediatas (soma do quadro)",
    );
    expect(divulgacao?.querySelector("[data-fonte-diferente]")).toBeNull();
  });

  it("avisos da resposta aparecem acima da tabela", async () => {
    await montar({ listar_resumo_dos_editais_do_painel: RESUMO_COM_FONTE });
    expect(
      caixa?.querySelector("[data-tone='warning']")?.textContent,
    ).toContain(
      'A fonte escolhida para "Data final do processo seletivo" não está disponível',
    );
  });

  it("o XLSX baixado tem a aba Fontes", async () => {
    const { salvos } = await montar({
      listar_resumo_dos_editais_do_painel: RESUMO_COM_FONTE,
    });
    await clicar(botao("Baixar XLSX"));
    await esperar(() => new Promise((ok) => setTimeout(ok, 50)));
    const arquivos = unzipSync(
      new Uint8Array(await salvos[0]!.arquivo.arrayBuffer()),
    );
    expect(strFromU8(arquivos["xl/workbook.xml"]!)).toContain('name="Fontes"');
    expect(strFromU8(arquivos["xl/worksheets/sheet2.xml"]!)).toContain(
      "Quadro de vagas do edital › Vagas imediatas (soma do quadro)",
    );
  });
});
