import { act, createElement, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clicar, digitar } from "./interacoes.js";

/*
  O que o robô leu dos arquivos, na ficha (leitura-dos-arquivos.tsx): o
  "Lido do arquivo" ao lado do arquivo e a conferência de cada item lido —
  Aceitar vira linha, Recusar pede o motivo em chips, teclas A e R na linha
  focada, "Aceitar todos sem alerta" e, só leitura, sem botões.
*/
const { ConferenciaDoLido, LidoDoArquivo } =
  await import("../../src/modulos/avaliacao-documental/ficha/leitura-dos-arquivos.tsx");
const { itensParaConferir, leiturasDaFicha } =
  await import("../../src/lib/avaliacao-documental/leitura-dos-arquivos.ts");

let montagem;
let raiz;
async function montar(elemento) {
  raiz = document.createElement("div");
  document.body.append(raiz);
  montagem = createRoot(raiz);
  await act(async () => montagem.render(elemento));
}
afterEach(async () => {
  await act(async () => montagem?.unmount());
  raiz?.remove();
});

const CURSOS = { codigo: "CURSOS", tipo: "CURSOS", titulo: "Cursos" };
const ANEXO = {
  resposta: "8019889",
  pergunta: "555",
  arquivo: 1,
  link: "https://corporate.empregare.com/Company/VacancyTests/GetViewerLogArquivo?arquivo=a.pdf&nome=Case",
  nome: "a.pdf",
};
const curso = (nome, horas, pagina, alertas = []) => ({
  tipo: "CURSO",
  curso: nome,
  horas,
  instituicao: "Fiocruz MS",
  conclusao: "2023-05-12",
  pagina,
  alertas,
});
const LEITURA = {
  resposta: "8019889",
  pergunta: "555",
  arquivo: 1,
  situacao: "LIDO",
  metodo: "TEXTO",
  itens: [
    curso("Enfrentamento das Arboviroses", 145, 1),
    curso("Saúde Indígena", 60, 3),
    curso("Primeiros Socorros", 20, 5, [
      {
        codigo: "HORAS_ABAIXO_MINIMO",
        texto: "20 h, abaixo do mínimo de 40 h do edital",
      },
    ]),
  ],
  alertas: [],
  resumo: "3 certificados · 145 h, 60 h, 20 h · nome confere",
};
const leituras = leiturasDaFicha([LEITURA]);
const itens = itensParaConferir(CURSOS, leituras, [ANEXO]);

function Conferencia({
  desabilitado = false,
  registrar = vi.fn(),
  aoMudar = () => {},
}) {
  const [lancamento, setLancamento] = useState({
    nivel: "superior",
    cursos: [],
  });
  const mudar = (transformar) =>
    setLancamento((l) => {
      const novo = transformar(structuredClone(l));
      aoMudar(novo);
      return novo;
    });
  return createElement(ConferenciaDoLido, {
    bloco: CURSOS,
    itens,
    lancamento,
    mudar,
    desabilitado,
    empregare: {
      loja: { registrarAcesso: registrar },
      enderecos: {},
      aoAvisar: () => {},
    },
  });
}

describe("lido do arquivo", () => {
  it("o resumo do robô e os alertas do arquivo numa linha; sem leitura, nada", async () => {
    await montar(
      createElement("div", null, [
        createElement(LidoDoArquivo, {
          key: 1,
          leitura: {
            ...leituras[0],
            alertas: [
              {
                codigo: "CPF_DIVERGENTE",
                texto: "O CPF do documento não é o do candidato",
              },
            ],
          },
        }),
        createElement(LidoDoArquivo, { key: 2, leitura: null }),
      ]),
    );
    expect(raiz.querySelectorAll(".avd-lido")).toHaveLength(1);
    expect(raiz.querySelector(".avd-lido-resumo").textContent).toContain(
      "Lido do arquivo: 3 certificados · 145 h, 60 h, 20 h · nome confere",
    );
    expect(raiz.querySelector(".avd-lido-alertas").textContent).toBe(
      "O CPF do documento não é o do candidato",
    );
  });
});

describe("conferência dos itens lidos", () => {
  it("cada item com o texto, a página e Aceitar/Recusar; o com alerta destacado", async () => {
    await montar(createElement(Conferencia));
    const linhas = raiz.querySelectorAll(".avd-conferir-item");
    expect(linhas).toHaveLength(3);
    expect(linhas[0].textContent).toContain(
      "Enfrentamento das Arboviroses · 145 h · Fiocruz MS · 2023",
    );
    expect(
      linhas[0].querySelector(".avd-conferir-arquivo").textContent,
    ).toContain("pág. 1");
    expect(linhas[2].dataset.alerta).toBe("leve");
    expect(
      linhas[2].querySelector(".avd-conferir-alertas").textContent,
    ).toContain("abaixo do mínimo");
    expect(raiz.querySelector(".avd-conferir-titulo").textContent).toContain(
      "3 certificados lidos",
    );
    expect(raiz.querySelector(".avd-conferir-titulo").textContent).toContain(
      "3 para conferir",
    );
  });

  it("aceitar vira linha marcada do arquivo; recusar pede o motivo e guarda", async () => {
    const mudancas = [];
    await montar(
      createElement(Conferencia, { aoMudar: (l) => mudancas.push(l) }),
    );
    const linhas = () => raiz.querySelectorAll(".avd-conferir-item");
    await clicar(linhas()[0].querySelector('[data-acao="aceitar"]'));
    expect(mudancas.at(-1).cursos).toEqual([
      {
        nome: "Enfrentamento das Arboviroses",
        horas: 145,
        aceito: true,
        do_arquivo: "8019889:555:1:0",
      },
    ]);
    expect(linhas()[0].dataset.estado).toBe("aceito");
    await clicar(linhas()[2].querySelector('[data-acao="recusar"]'));
    const chips = [...linhas()[2].querySelectorAll(".avd-ficha-chip")];
    expect(chips.map((c) => c.textContent)).toEqual([
      "fora da área da vaga",
      "carga horária não comprovada",
      "nome divergente",
      "ilegível",
      "período sobreposto",
      "outro…",
    ]);
    await clicar(chips[1]);
    expect(mudancas.at(-1).recusas_lidas).toEqual({
      "8019889:555:1:2": { motivo: "CARGA_NAO_COMPROVADA" },
    });
    expect(linhas()[2].dataset.estado).toBe("recusado");
    // A recusa continua visível e editável (o chip marcado).
    expect(
      linhas()[2].querySelector('.avd-ficha-chip[aria-pressed="true"]')
        .textContent,
    ).toBe("carga horária não comprovada");
    // Desfazer volta a pendente.
    await clicar(
      [...linhas()[2].querySelectorAll("button")].find((b) =>
        b.textContent.includes("Desfazer"),
      ),
    );
    expect(linhas()[2].dataset.estado).toBe("pendente");
  });

  it("teclas A e R na linha focada; aceitar todos sem alerta deixa o com alerta", async () => {
    const mudancas = [];
    await montar(
      createElement(Conferencia, { aoMudar: (l) => mudancas.push(l) }),
    );
    const linha = raiz.querySelectorAll(".avd-conferir-item")[1];
    linha.focus();
    await act(async () => {
      linha.dispatchEvent(
        new KeyboardEvent("keydown", { key: "a", bubbles: true }),
      );
    });
    expect(mudancas.at(-1).cursos.map((c) => c.horas)).toEqual([60]);
    const terceira = raiz.querySelectorAll(".avd-conferir-item")[2];
    await act(async () => {
      terceira.dispatchEvent(
        new KeyboardEvent("keydown", { key: "r", bubbles: true }),
      );
    });
    expect(terceira.querySelectorAll(".avd-ficha-chip")).toHaveLength(6);
    // Só sobra 1 pendente sem alerta: o atalho de "todos" só aparece com 2 ou mais.
    expect(raiz.querySelector(".avd-conferir-topo button")).toBeNull();
  });

  it("aceitar todos sem alerta", async () => {
    const mudancas = [];
    await montar(
      createElement(Conferencia, { aoMudar: (l) => mudancas.push(l) }),
    );
    const botao = raiz.querySelector(".avd-conferir-topo button");
    expect(botao.textContent).toContain("Aceitar todos sem alerta (2)");
    await clicar(botao);
    expect(mudancas.at(-1).cursos.map((c) => c.horas)).toEqual([145, 60]);
    expect(
      raiz.querySelectorAll('.avd-conferir-item[data-estado="pendente"]'),
    ).toHaveLength(1);
  });

  it("só leitura: sem botões nem teclas; abrir o arquivo registra o acesso", async () => {
    const registrar = vi.fn(async () => {});
    await montar(createElement(Conferencia, { desabilitado: true, registrar }));
    expect(raiz.querySelectorAll(".avd-conferir-botao")).toHaveLength(0);
    expect(
      raiz.querySelector(".avd-conferir-item").getAttribute("tabindex"),
    ).toBeNull();
    const link = raiz.querySelector(".avd-conferir-arquivo");
    link.addEventListener("click", (ev) => ev.preventDefault());
    await clicar(link);
    expect(registrar).toHaveBeenCalledWith("ABRIR_EMPREGARE");
  });
});

/* ── Corrigir o item lido e os alertas resumidos (vínculos) ─────────── */

const EXPERIENCIA = {
  codigo: "EXPERIENCIA",
  tipo: "VINCULOS",
  titulo: "Experiência",
  categorias: [{ codigo: "AREA_OU_SUS" }],
};
const vinculo = (extra) => ({
  tipo: "VINCULO",
  empregador: "Missão Caiuá",
  cargo: "Enfermeiro",
  inicio: "2022-03-01",
  fim: "2023-06-30",
  atual: false,
  carga_semanal: 40,
  dias: 487,
  pagina: 1,
  alertas: [],
  ...extra,
});
const LEITURA_VINCULOS = {
  ...LEITURA,
  pergunta: "912",
  metodo: "OCR",
  itens: [
    vinculo({
      empregador: null,
      alertas: [
        { codigo: "SEM_EMPREGADOR", texto: "Empregador não encontrado" },
        { codigo: "NOME_A_CONFERIR", texto: "Confira o nome neste item" },
      ],
    }),
    vinculo({
      inicio: "2024-02-01",
      fim: null,
      atual: true,
      dias: 984,
      pagina: 2,
      alertas: [
        {
          codigo: "SEM_DATA_FIM",
          texto: "Vínculo atual sem data de emissão: dias contados até hoje",
        },
        {
          codigo: "PERIODO_CONCOMITANTE",
          texto: "Concomitante com outro vínculo (pode ser legítimo): confira",
        },
      ],
    }),
    vinculo({
      pagina: 3,
      alertas: [
        {
          codigo: "PERIODO_SOBREPOSTO",
          texto: "Período sobreposto a outro vínculo do mesmo empregador",
        },
      ],
    }),
  ],
  resumo: "3 vínculos · 1.958 dias · nome confere",
};
const itensVinculos = itensParaConferir(
  EXPERIENCIA,
  leiturasDaFicha([LEITURA_VINCULOS]),
  [{ ...ANEXO, pergunta: "912" }],
);

function ConferenciaDeVinculos({ aoMudar = () => {} }) {
  const [lancamento, setLancamento] = useState({
    nivel: "superior",
    vinculos: [],
  });
  const mudar = (transformar) =>
    setLancamento((l) => {
      const novo = transformar(structuredClone(l));
      aoMudar(novo);
      return novo;
    });
  return createElement(ConferenciaDoLido, {
    bloco: EXPERIENCIA,
    itens: itensVinculos,
    lancamento,
    mudar,
    desabilitado: false,
    empregare: {
      loja: { registrarAcesso: vi.fn() },
      enderecos: {},
      aoAvisar: () => {},
    },
  });
}

describe("corrigir o item lido e alertas resumidos", () => {
  it("um alerta visível por item (o resto no +N); concomitante vira selo; 'até hoje' no texto; só o que impede em laranja", async () => {
    await montar(createElement(ConferenciaDeVinculos));
    const linhas = raiz.querySelectorAll(".avd-conferir-item");
    // 1º: empregador não lido, leve (cinza), com +1 na dica.
    const alerta1 = linhas[0].querySelectorAll(".avd-conferir-alertas");
    expect(alerta1).toHaveLength(1);
    expect(alerta1[0].dataset.tom).toBe("leve");
    expect(alerta1[0].textContent).toContain("Empregador não encontrado");
    const mais = alerta1[0].querySelector(".avd-conferir-mais");
    expect(mais.textContent).toBe("+1");
    expect(mais.getAttribute("title")).toBe("Confira o nome neste item");
    // 2º: atual sem emissão e concomitante: sem alerta, "até hoje" e o selo neutro.
    expect(linhas[1].querySelector(".avd-conferir-alertas")).toBeNull();
    expect(linhas[1].textContent).toContain("984 dias até hoje");
    expect(linhas[1].querySelector(".avd-conferir-selo").textContent).toBe(
      "concomitante",
    );
    // 3º: o mesmo empregador repetido: laranja.
    expect(linhas[2].dataset.alerta).toBe("grave");
    expect(linhas[2].querySelector(".avd-conferir-alertas").dataset.tom).toBe(
      "grave",
    );
  });

  it("Corrigir abre a linha preenchida; aceitar com a correção marca corrigido; o atual sem fim abre direto no Corrigir", async () => {
    const mudancas = [];
    await montar(
      createElement(ConferenciaDeVinculos, {
        aoMudar: (l) => mudancas.push(l),
      }),
    );
    const linha = (n) => raiz.querySelectorAll(".avd-conferir-item")[n];
    // O atual sem data de fim não conta sozinho: Aceitar abre o Corrigir.
    await clicar(linha(1).querySelector("[data-acao='aceitar']"));
    expect(mudancas).toHaveLength(0);
    const editor = () => linha(1).querySelector(".avd-conferir-corrigir");
    expect(editor()).not.toBeNull();
    expect(
      editor().querySelector("input[aria-label='Empregador ou cargo']").value,
    ).toBe("Missão Caiuá · Enfermeiro");
    expect(editor().querySelector("input[aria-label='Início']").value).toBe(
      "2024-02-01",
    );
    const fim = editor().querySelector("input[aria-label='Fim']");
    expect(fim.getAttribute("aria-invalid")).toBe("true");
    const aceitarCorrecao = () =>
      editor().querySelector("[data-acao='aceitar-correcao']");
    expect(aceitarCorrecao().disabled).toBe(true);
    await digitar(fim, "2026-10-13");
    await clicar(aceitarCorrecao());
    expect(mudancas.at(-1).vinculos).toEqual([
      {
        empregador: "Missão Caiuá · Enfermeiro",
        categoria: "AREA_OU_SUS",
        inicio: "2024-02-01",
        fim: "2026-10-13",
        aceito: true,
        do_arquivo: "8019889:912:1:1",
        corrigido: true,
      },
    ]);
    expect(linha(1).dataset.estado).toBe("aceito");
    expect(linha(1).textContent).toContain("Aceito, corrigido");
    expect(
      linha(1).querySelector(".avd-conferir-corrigido").textContent,
    ).toContain("01/02/2024 a 13/10/2026");
    // Corrigir pelo botão no item pendente: troca o empregador não lido.
    await clicar(linha(0).querySelector("[data-acao='corrigir']"));
    await digitar(
      linha(0).querySelector("input[aria-label='Empregador ou cargo']"),
      "SESAI · Agente",
    );
    await clicar(linha(0).querySelector("[data-acao='aceitar-correcao']"));
    expect(mudancas.at(-1).vinculos.map((v) => v.empregador)).toEqual([
      "Missão Caiuá · Enfermeiro",
      "SESAI · Agente",
    ]);
    // Cancelar não grava nada.
    const antes = mudancas.length;
    await clicar(linha(2).querySelector("[data-acao='corrigir']"));
    await clicar(
      [...linha(2).querySelectorAll("button")].find(
        (b) => b.textContent === "Cancelar",
      ),
    );
    expect(mudancas).toHaveLength(antes);
    expect(linha(2).querySelector(".avd-conferir-corrigir")).toBeNull();
  });
});
