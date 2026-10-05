import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  definirAreaAtual,
  redefinirDadosDoMonitoramento,
} from "../../src/componentes/dados-do-monitoramento.js";
import { montarClassificacao } from "../../src/modulos/classificacao/classificacao.jsx";
import {
  clicar,
  digitar,
  escolher,
  esperar,
} from "../componentes/interacoes.js";

/*
  A agenda das entrevistas na Classificação (visão "Agenda",
  src/modulos/classificacao/agenda.jsx): salvar a regra, gerar a agenda dos
  convocados da última convocação registrada (aviso de que não cabe), salvar,
  ajuste manual com conflito (salvar bloqueado), "Gerar de novo" que pergunta
  antes de sobrescrever ajustes manuais, quem só lê sem os controles, e o
  documento da convocação com DATA e HORA da agenda salva.
*/

const A = (n) => `00000000-0000-4000-8000-00000000000${n}`;
const REGRA_CLASSIFICACAO = {
  schema: 1,
  documental: { situacoes_aptas: ["Aprovado"] },
  composicao: { componentes: [{ codigo: "DOCUMENTAL", peso: 1 }], casas: 2 },
  desempate: [],
  empate_final: { metodo: "ORDEM_INSCRICAO", numeracao: "DENSA" },
  modalidades: [{ codigo: "AC" }],
  convocacao: { multiplo_vagas: 5, posicao_max_cr: 10, excecoes: [] },
};
const candidato = (n, nome) => ({
  analise_id: A(n),
  codigo: `10${n}`,
  nome,
  vaga: "169681",
  cargo: "Cirurgião Dentista",
  modalidade: "Ampla concorrência",
  status: "Aprovado",
  nota_documental: String(10 - n),
  quadro: "q1",
});
const EDITAL = {
  schema_version: 1,
  edital: { id: "e83", edital: "83/2026", unidade: "DSEI Xingu" },
  pode_editar: true,
  regra: { versao: 1, configuracao: REGRA_CLASSIFICACAO, versoes: [] },
  cronograma: [],
  quadro: [
    {
      id: "q1",
      ordem: 1,
      cargo: "Cirurgião Dentista",
      lotacao: "Polo Leonardo",
      modalidades: { "Ampla Concorrência": 1 },
      vagas_imediatas: 1,
      cadastro_reserva: true,
    },
  ],
  candidatos: [
    candidato(1, "Ana Primeira"),
    candidato(2, "Bia Segunda"),
    candidato(3, "Caio Terceiro"),
  ],
  entrevistas: [],
  listas: [
    {
      id: "l1",
      tipo: "CONVOCACAO",
      versao_regra: 1,
      hash: "a".repeat(64),
      gerada_em: "2026-10-02T13:00:00Z",
      por: "Gestora",
      pendencias: 0,
      publicada: true,
    },
  ],
  desempates: [],
};
const RETRATO = {
  schema: 1,
  tipo: "CONVOCACAO",
  edital: { id: "e83", edital: "83/2026", unidade: "DSEI Xingu" },
  regra_versao: 1,
  casas: 2,
  modalidades: [],
  vagas: [
    {
      chave: "169681",
      codigo: "169681",
      cargo: "Cirurgião Dentista",
      lotacao: "Polo Leonardo",
      cabecalho: "VAGA 169681",
      geral: [1, 2, 3].map((n) => ({
        posicao: n,
        analise_id: A(n),
        nome: ["", "Ana Primeira", "Bia Segunda", "Caio Terceiro"][n],
        nota: 10 - n,
        modalidades: ["AC"],
        situacao: "CONVOCADO",
      })),
      listas: {},
      eliminados: [],
    },
  ],
  avisos: [],
  pendencias: [],
  totais: {},
};
const REGRA_AGENDA = {
  schema: 1,
  datas: {
    modo: "LISTA",
    inicio: "",
    fim: "",
    so_dias_uteis: true,
    dias: ["2026-10-06"],
    excluir: [],
  },
  periodos: [{ inicio: "08:00", fim: "09:00" }],
  duracao_min: 30,
  intervalo_min: 0,
  pausa: null,
  bancas: 1,
  nomes_das_bancas: ["Sala A"],
  ordem: "CLASSIFICACAO",
  agrupar_por_cargo: false,
  reservar_primeiro_horario: false,
  fuso: "America/Sao_Paulo",
};
const item = (n, inicio, fim, origem = "GERADA", banca = 1) => ({
  analise_id: A(n),
  nome: ["", "Ana Primeira", "Bia Segunda", "Caio Terceiro"][n],
  vaga: "169681",
  cargo: "Cirurgião Dentista",
  modalidade: "Ampla concorrência",
  data: "2026-10-06",
  inicio,
  fim,
  banca,
  origem,
});
const agendaDoBanco = (campos = {}) => ({
  edital: { id: "e83", edital: "83/2026", unidade: "DSEI Xingu" },
  pode_editar: true,
  regra: null,
  itens: [],
  bancas: [
    { banca: 1, membros: [{ nome: "Maria Avaliadora", origem: "AgSUS" }] },
  ],
  historico: [],
  ultimo_registro: null,
  ...campos,
});
const regraSalva = (configuracao = REGRA_AGENDA, versao = 1) => ({
  versao,
  configuracao,
  atualizado_em: "2026-10-04T12:00:00Z",
  por: "Gestora",
  versoes: [{ versao, em: "2026-10-04T12:00:00Z", por: "Gestora" }],
});

function supabaseFalso(agenda = agendaDoBanco(), sobrescrever = {}) {
  let atual = structuredClone(agenda);
  const respostas = {
    listar_editais_classificacao: () => ({
      area: "saude-indigena",
      pode_editar: true,
      editais: [
        { id: "e83", edital: "83/2026", unidade: "DSEI Xingu", candidatos: 3 },
      ],
    }),
    obter_classificacao_do_edital: () => structuredClone(EDITAL),
    obter_lista_classificacao: () => ({
      lista: EDITAL.listas[0],
      resultado: structuredClone(RETRATO),
    }),
    obter_agenda_entrevista: () => structuredClone(atual),
    salvar_regra_agenda_entrevista: ({ p_configuracao }) => {
      atual = { ...atual, regra: regraSalva(p_configuracao) };
      return atual.regra;
    },
    salvar_agenda_entrevista: ({ p_dados }) => {
      atual = {
        ...atual,
        itens: p_dados.itens.map((i) => ({
          ...item(
            Number(i.analise.slice(-1)),
            i.inicio,
            i.fim,
            i.origem,
            i.banca,
          ),
          data: i.data,
        })),
        ultimo_registro: "h1",
        historico: [
          {
            id: "h1",
            acao: p_dados.acao,
            em: "2026-10-05T12:00:00Z",
            por: "Gestora",
            itens: p_dados.itens.length,
            alteracoes: p_dados.itens.length,
          },
        ],
      };
      return structuredClone(atual);
    },
    ...sobrescrever,
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
const toast = vi.fn();
const baixar = vi.fn();
const copiar = vi.fn(async () => "html");

async function montar(supabase) {
  secao = document.createElement("section");
  secao.id = "page-classificacao";
  secao.className = "page active";
  document.body.append(secao);
  await act(async () => {
    painel = montarClassificacao({
      supabase,
      toast,
      baixar,
      copiar,
      imprimir: vi.fn(),
      carregarLogo: vi.fn(async () => null),
      cabecalho: () => "AGÊNCIA DE TESTE",
    });
  });
  await act(async () => void painel.render());
  await esperar();
  await escolher(secao.querySelector(".classificacao-edital select"), "e83");
  await esperar();
}
const botao = (texto, raiz = document) =>
  [...raiz.querySelectorAll("button")].find((b) =>
    b.textContent.trim().startsWith(texto),
  );
async function abrirAgenda() {
  await clicar(secao.querySelector("[data-valor='agenda']"));
  await esperar();
  await esperar();
}
const linhas = () =>
  [...secao.querySelectorAll(".agenda-tabela tr[data-candidato]")].map((tr) =>
    [...tr.querySelectorAll("td")].slice(0, 3).map((td) => td.textContent),
  );
const chamada = (supabase, nome) =>
  supabase.rpc.mock.calls.filter(([n]) => n === nome).at(-1)?.[1];

beforeEach(() => {
  redefinirDadosDoMonitoramento();
  definirAreaAtual("saude-indigena");
});
afterEach(async () => {
  await act(async () => painel?.raiz?.unmount());
  secao?.remove();
  document.body.innerHTML = "";
  redefinirDadosDoMonitoramento();
  toast.mockClear();
  baixar.mockClear();
  copiar.mockClear();
});

describe("agenda das entrevistas na Classificação", () => {
  it("o botão da lista de convocação abre a agenda; a regra é salva como versão nova", async () => {
    const supabase = supabaseFalso();
    await montar(supabase);
    expect(supabase.rpc).toHaveBeenCalledWith("obter_agenda_entrevista", {
      p_edital: "e83",
    });
    await clicar(
      secao.querySelector(".classificacao-tipos [data-valor='CONVOCACAO']"),
    );
    await clicar(secao.querySelector("[data-acao='abrir-agenda']"));
    await esperar();
    expect(secao.querySelector(".agenda-regra")).not.toBeNull();
    // A banca do cadastro de Entrevistas aparece junto do nome da banca.
    expect(secao.querySelector(".agenda-regra").textContent).toContain(
      "Maria Avaliadora",
    );

    await digitar(secao.querySelector("[data-campo='inicio']"), "2026-10-06");
    await digitar(secao.querySelector("[data-campo='fim']"), "2026-10-07");
    await digitar(secao.querySelector("[data-campo='duracao']"), "40");
    await digitar(secao.querySelector("[data-campo='intervalo']"), "10");
    await escolher(secao.querySelector("[data-campo='ordem']"), "ALFABETICA");
    await clicar(secao.querySelector("[data-campo='agrupar']"));
    await clicar(secao.querySelector("[data-acao='salvar-regra-agenda']"));
    await esperar();
    const args = chamada(supabase, "salvar_regra_agenda_entrevista");
    expect(args).toMatchObject({
      p_edital: "e83",
      p_versao_atual: 0,
      p_motivo: null,
      p_configuracao: {
        schema: 1,
        datas: { modo: "INTERVALO", inicio: "2026-10-06", fim: "2026-10-07" },
        duracao_min: 40,
        intervalo_min: 10,
        ordem: "ALFABETICA",
        agrupar_por_cargo: true,
        fuso: "America/Sao_Paulo",
      },
    });
    expect(
      secao.querySelector(".agenda-regra .status-discreto").textContent,
    ).toContain("Versão 1");
  });

  it("regra inválida não salva e mostra o erro", async () => {
    const supabase = supabaseFalso();
    await montar(supabase);
    await abrirAgenda();
    await clicar(secao.querySelector("[data-acao='salvar-regra-agenda']"));
    expect(chamada(supabase, "salvar_regra_agenda_entrevista")).toBeUndefined();
    expect(secao.querySelector(".agenda-erros").textContent).toContain(
      "Informe a data de início e a de fim.",
    );
  });

  it("gera pela regra salva com os convocados da convocação registrada, avisa o que não cabe e salva", async () => {
    const supabase = supabaseFalso(agendaDoBanco({ regra: regraSalva() }));
    await montar(supabase);
    await abrirAgenda();
    expect(supabase.rpc).toHaveBeenCalledWith("obter_lista_classificacao", {
      p_lista: "l1",
    });
    expect(secao.querySelector(".agenda-fonte")).toBeNull();
    await clicar(secao.querySelector("[data-acao='gerar-agenda']"));
    expect(linhas()).toEqual([
      ["08:00–08:30", "Sala A", "Ana Primeira"],
      ["08:30–09:00", "Sala A", "Bia Segunda"],
      ["—", "—", "Caio Terceiro"],
    ]);
    expect(secao.querySelector("[data-aviso='NAO_CABE']").textContent).toBe(
      "1 convocado ficou sem horário: faltam cerca de 30 min de entrevistas com 1 banca. Acrescente dias, períodos ou bancas.",
    );
    await clicar(secao.querySelector("[data-acao='salvar-agenda']"));
    await esperar();
    expect(chamada(supabase, "salvar_agenda_entrevista")).toEqual({
      p_edital: "e83",
      p_dados: {
        acao: "GERAR",
        lista: "l1",
        versao_regra: 1,
        ultimo_registro: null,
        itens: [
          {
            analise: A(1),
            data: "2026-10-06",
            inicio: "08:00",
            fim: "08:30",
            banca: 1,
            origem: "GERADA",
          },
          {
            analise: A(2),
            data: "2026-10-06",
            inicio: "08:30",
            fim: "09:00",
            banca: 1,
            origem: "GERADA",
          },
        ],
      },
    });
    expect(secao.querySelector(".agenda-historico").textContent).toContain(
      "Gravações (1)",
    );
    expect(secao.querySelector("[data-acao='salvar-agenda']").disabled).toBe(
      true,
    );
    await clicar(secao.querySelector("[data-exportar='xlsx-agenda']"));
    expect(baixar).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      "agenda-entrevistas-83-2026.xlsx",
      expect.stringContaining("spreadsheetml"),
    );
  });

  it("ajuste manual: horário que sobrepõe outro na mesma banca acusa conflito e não salva", async () => {
    // A regra mudou depois de salvar: 08:15 sobrepõe o horário salvo da Ana.
    const regra = {
      ...REGRA_AGENDA,
      periodos: [{ inicio: "08:15", fim: "10:00" }],
    };
    const supabase = supabaseFalso(
      agendaDoBanco({
        regra: regraSalva(regra, 2),
        itens: [item(1, "08:00", "08:30"), item(2, "09:00", "09:30")],
        ultimo_registro: "h0",
      }),
    );
    await montar(supabase);
    await abrirAgenda();
    const linhaDaBia = secao.querySelector(`tr[data-candidato='${A(2)}']`);
    await clicar(linhaDaBia.querySelector("[data-acao='mudar']"));
    const seletor = document.querySelector("[data-campo='horario-livre']");
    const opcoes = [...seletor.options].map((o) => o.textContent);
    expect(opcoes).toContain("ter, 06/10/2026 · 08:15–08:45 · Sala A");
    await escolher(seletor, "2026-10-06|08:15|08:45|1");
    await clicar(document.querySelector("[data-acao='aplicar-ajuste']"));
    const conflitos = secao.querySelector(".agenda-conflitos");
    expect(conflitos.textContent).toContain(
      "Ana Primeira e Bia Segunda: Sala A, 06/10/2026, 08:00.",
    );
    expect(linhaDaBia.isConnected).toBe(true);
    expect(
      secao.querySelector(`tr[data-candidato='${A(2)}']`).textContent,
    ).toContain("Ajuste manual");
    expect(secao.querySelector("[data-acao='salvar-agenda']").disabled).toBe(
      true,
    );

    // Outro horário livre resolve o conflito e libera o salvar.
    await clicar(
      secao
        .querySelector(`tr[data-candidato='${A(2)}']`)
        .querySelector("[data-acao='mudar']"),
    );
    await clicar(
      document.querySelector("#agendaAjuste [data-valor='HORARIO']"),
    );
    await escolher(
      document.querySelector("[data-campo='horario-livre']"),
      "2026-10-06|09:15|09:45|1",
    );
    await clicar(document.querySelector("[data-acao='aplicar-ajuste']"));
    expect(secao.querySelector(".agenda-conflitos")).toBeNull();
    await clicar(secao.querySelector("[data-acao='salvar-agenda']"));
    await esperar();
    const args = chamada(supabase, "salvar_agenda_entrevista");
    expect(args.p_dados).toMatchObject({
      acao: "AJUSTAR",
      versao_regra: 2,
      ultimo_registro: "h0",
    });
    expect(args.p_dados.itens).toContainEqual({
      analise: A(2),
      data: "2026-10-06",
      inicio: "09:15",
      fim: "09:45",
      banca: 1,
      origem: "MANUAL",
    });
  });

  it("trocar dois de lugar troca horário e banca", async () => {
    const supabase = supabaseFalso(
      agendaDoBanco({
        regra: regraSalva(),
        itens: [item(1, "08:00", "08:30"), item(2, "08:30", "09:00")],
      }),
    );
    await montar(supabase);
    await abrirAgenda();
    await clicar(
      secao.querySelector(`tr[data-candidato='${A(1)}'] [data-acao='mudar']`),
    );
    await clicar(document.querySelector("#agendaAjuste [data-valor='TROCA']"));
    await escolher(document.querySelector("[data-campo='trocar-com']"), A(2));
    await clicar(document.querySelector("[data-acao='aplicar-ajuste']"));
    expect(linhas().slice(0, 2)).toEqual([
      ["08:00–08:30", "Sala A", "Bia Segunda"],
      ["08:30–09:00", "Sala A", "Ana Primeira"],
    ]);
  });

  it("gerar de novo sobre ajustes manuais pergunta antes; cancelar mantém os ajustes", async () => {
    const supabase = supabaseFalso(
      agendaDoBanco({
        regra: regraSalva(),
        itens: [item(1, "08:30", "09:00", "MANUAL"), item(2, "08:00", "08:30")],
      }),
    );
    await montar(supabase);
    await abrirAgenda();
    await clicar(secao.querySelector("[data-acao='gerar-agenda']"));
    const modal = document.querySelector("#agendaConfirmar");
    expect(modal.textContent).toContain("1 ajuste manual será substituído");
    await clicar(botao("Cancelar", modal));
    expect(document.querySelector("#agendaConfirmar")).toBeNull();
    expect(linhas()[0]).toEqual(["08:00–08:30", "Sala A", "Bia Segunda"]);
    await clicar(secao.querySelector("[data-acao='gerar-agenda']"));
    await clicar(document.querySelector("[data-acao='confirmar-gerar']"));
    expect(linhas()[0]).toEqual(["08:00–08:30", "Sala A", "Ana Primeira"]);
  });

  it("sem convocação registrada, usa o cálculo atual e avisa", async () => {
    const supabase = supabaseFalso(agendaDoBanco({ regra: regraSalva() }), {
      obter_classificacao_do_edital: () => ({
        ...structuredClone(EDITAL),
        listas: [],
      }),
    });
    await montar(supabase);
    await abrirAgenda();
    expect(secao.querySelector(".agenda-fonte").textContent).toContain(
      "Sem lista de convocação gerada",
    );
    await clicar(secao.querySelector("[data-acao='gerar-agenda']"));
    expect(linhas()[0][2]).toBe("Ana Primeira");
  });

  it("quem só lê vê a regra e a agenda, sem os controles", async () => {
    const supabase = supabaseFalso(
      agendaDoBanco({
        pode_editar: false,
        regra: regraSalva(),
        itens: [item(1, "08:00", "08:30")],
      }),
    );
    await montar(supabase);
    await abrirAgenda();
    expect(secao.querySelector(".agenda-resumo").textContent).toContain(
      "Períodos: 08:00–09:00",
    );
    expect(secao.querySelector("[data-acao='salvar-regra-agenda']")).toBeNull();
    expect(secao.querySelector("[data-acao='gerar-agenda']")).toBeNull();
    expect(secao.querySelector("[data-acao='mudar']")).toBeNull();
    expect(linhas()[0]).toEqual(["08:00–08:30", "Sala A", "Ana Primeira"]);
  });

  it("o documento da convocação (Copiar para o SEI) sai com DATA e HORA da agenda salva", async () => {
    const supabase = supabaseFalso(
      agendaDoBanco({
        regra: regraSalva(),
        itens: [item(1, "08:00", "08:30"), item(2, "08:30", "09:00")],
      }),
    );
    await montar(supabase);
    await clicar(
      secao.querySelector(".classificacao-tipos [data-valor='CONVOCACAO']"),
    );
    await clicar(secao.querySelector("[data-acao='copiar-sei']"));
    await esperar();
    const { html, texto } = copiar.mock.calls.at(-1)[0];
    expect(html).toContain("06/10/2026");
    expect(html).toContain("08:30");
    const linhaDaAna = texto
      .split("\n")
      .find((l) => l.includes("Ana Primeira"));
    expect(linhaDaAna).toContain("06/10/2026");
    expect(linhaDaAna).toContain("08:00");
    const linhaDoCaio = texto
      .split("\n")
      .find((l) => l.includes("Caio Terceiro"));
    expect(linhaDoCaio).not.toContain("06/10/2026");
  });
});
