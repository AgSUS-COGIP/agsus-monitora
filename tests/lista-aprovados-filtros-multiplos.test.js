import { describe, expect, it } from "vitest";
import {
  candidateCargosForEdital,
  candidateModalidadesForEdital,
  filterApprovedCandidates,
  summarizeApprovedCandidates,
} from "../src/lib/lista-aprovados-rules.js";

const candidatos = [
  {
    candidato_id: "1",
    nome: "Ana Ribeiro",
    modalidade: "Ampla concorrência",
    cargo: "Enfermeiro",
    edital_id: "10",
    edital: "03/2025",
    status: "Contratado",
  },
  {
    candidato_id: "2",
    nome: "Bruno Lima",
    modalidade: "Pessoa negra",
    cargo: "Médico",
    edital_id: "10",
    edital: "03/2025",
    status: "",
  },
  {
    candidato_id: "3",
    nome: "Carla Souza",
    modalidade: "Pessoa com deficiência",
    cargo: "Enfermeiro",
    edital_id: "20",
    edital: "04/2025",
    status: "Desistente",
  },
  {
    candidato_id: "4",
    nome: "Diego Alves",
    modalidade: "Ampla concorrência",
    cargo: "Dentista",
    edital_id: "30",
    edital: "05/2025",
    status: "Migração",
  },
];

const nomes = (rows) => rows.map((row) => row.nome);

describe("filterApprovedCandidates com escolha múltipla", () => {
  it("aceita vários editais ao mesmo tempo", () => {
    const resultado = filterApprovedCandidates(candidatos, {
      editalId: ["10", "30"],
    });
    expect(nomes(resultado)).toEqual([
      "Ana Ribeiro",
      "Bruno Lima",
      "Diego Alves",
    ]);
  });

  it("aceita vários cargos ao mesmo tempo", () => {
    const resultado = filterApprovedCandidates(candidatos, {
      cargo: ["Médico", "Dentista"],
    });
    expect(nomes(resultado)).toEqual(["Bruno Lima", "Diego Alves"]);
  });

  it("combina 'Sem status' com um status concreto", () => {
    const resultado = filterApprovedCandidates(candidatos, {
      status: ["__sem_status__", "Desistente"],
    });
    expect(nomes(resultado)).toEqual(["Bruno Lima", "Carla Souza"]);
  });

  it("cruza filtros de campos diferentes com E, não com OU", () => {
    const resultado = filterApprovedCandidates(candidatos, {
      editalId: ["10", "20"],
      cargo: ["Enfermeiro"],
    });
    expect(nomes(resultado)).toEqual(["Ana Ribeiro", "Carla Souza"]);
  });

  it("lista vazia não filtra nada", () => {
    const resultado = filterApprovedCandidates(candidatos, {
      editalId: [],
      cargo: [],
      status: [],
    });
    expect(resultado).toHaveLength(4);
  });

  /*
    A tela antiga mandava strings. `summarizeApprovedCandidates` ainda zera o
    status com `""`, por isso a forma antiga tem de continuar a valer.
  */
  it("continua a aceitar um valor único em string", () => {
    expect(
      nomes(filterApprovedCandidates(candidatos, { editalId: "20" })),
    ).toEqual(["Carla Souza"]);
    expect(
      nomes(filterApprovedCandidates(candidatos, { status: "__sem_status__" })),
    ).toEqual(["Bruno Lima"]);
  });

  /*
    A tela deixou de ter campo de busca livre, mas a regra mantém o suporte:
    quem chamar com `query` continua a cruzá-la com os filtros.
  */
  it("aceita várias modalidades ao mesmo tempo", () => {
    const resultado = filterApprovedCandidates(candidatos, {
      modalidade: ["Pessoa negra", "Pessoa com deficiência"],
    });
    expect(nomes(resultado)).toEqual(["Bruno Lima", "Carla Souza"]);
  });

  it("cruza modalidade com os outros campos", () => {
    const resultado = filterApprovedCandidates(candidatos, {
      editalId: ["10", "30"],
      modalidade: ["Ampla concorrência"],
    });
    expect(nomes(resultado)).toEqual(["Ana Ribeiro", "Diego Alves"]);
  });

  it("cruza a busca por texto com os filtros", () => {
    const resultado = filterApprovedCandidates(candidatos, {
      editalId: ["10", "20"],
      query: "carla",
    });
    expect(nomes(resultado)).toEqual(["Carla Souza"]);
  });
});

describe("summarizeApprovedCandidates com escolha múltipla", () => {
  /*
    Fim de fila é estado próprio, e não uma variação de desistência: quem o
    pediu continua na lista e será chamado depois de todos. O resumo tem de os
    contar à parte para a equipa saber quantos são.
  */
  it("conta o fim de fila à parte, sem o somar a desistente", () => {
    const resumo = summarizeApprovedCandidates(
      [
        ...candidatos,
        {
          candidato_id: "99",
          nome: "Elza Martins",
          modalidade: "Ampla concorrência",
          cargo: "Enfermeiro",
          edital_id: "10",
          edital: "03/2025",
          status: "Fim de Fila",
        },
      ],
      {},
    );
    expect(resumo.fimDeFila).toBe(1);
    expect(resumo.desistente).toBe(1);
  });

  it("conta dentro dos editais escolhidos, ignorando o filtro de status", () => {
    const resumo = summarizeApprovedCandidates(candidatos, {
      editalId: ["10", "20"],
      status: ["Contratado"],
    });
    expect(resumo).toMatchObject({
      total: 3,
      contratado: 1,
      desistente: 1,
      migracao: 0,
    });
  });
});

describe("candidateModalidadesForEdital", () => {
  it("junta as modalidades dos editais escolhidos, sem repetir", () => {
    expect(candidateModalidadesForEdital(candidatos, ["10", "30"])).toEqual([
      "Ampla concorrência",
      "Pessoa negra",
    ]);
  });

  it("sem edital escolhido, devolve as modalidades de toda a lista", () => {
    expect(candidateModalidadesForEdital(candidatos, [])).toEqual([
      "Ampla concorrência",
      "Pessoa com deficiência",
      "Pessoa negra",
    ]);
  });
});

describe("candidateCargosForEdital com escolha múltipla", () => {
  it("junta os cargos de todos os editais escolhidos, sem repetir", () => {
    expect(candidateCargosForEdital(candidatos, ["10", "20"])).toEqual([
      "Enfermeiro",
      "Médico",
    ]);
  });

  it("sem edital escolhido, devolve os cargos de toda a lista", () => {
    expect(candidateCargosForEdital(candidatos, [])).toEqual([
      "Dentista",
      "Enfermeiro",
      "Médico",
    ]);
  });
});
