// @vitest-environment jsdom
import { bloco } from "./apoio/bloco.ts";
import * as reactDaBarraNs from "react";
import * as alcanceDaBarraNs from "../src/lib/base/alcance-da-selecao.ts";
import { BarraDeSelecao } from "../src/ui/barra-de-selecao.tsx";
import { TabelaInfinita as TabelaInfinitaDaBarra } from "../src/ui/tabela-infinita.tsx";
import { BotoesDeExportacao } from "../src/ui/botoes-de-exportacao.tsx";
import {
  act,
  createElement,
  type ComponentProps,
  useState,
  type ReactElement,
  createElement as h,
} from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { achar, acharTodos } from "./dom.ts";
import { definido } from "./definido.ts";
import { InscricoesDoEdital } from "../src/modulos/avaliacao-documental/inscricoes-do-edital.tsx";
import { DADOS_114 } from "./fixtures/acompanhamento-das-inscricoes.js";
import {
  type ContextoDaEmpregare,
  type Lancamento,
  type LojaDaFicha,
  type Mudar,
  type ParteDaNota,
} from "../src/modulos/avaliacao-documental/ficha/tipos.ts";
import { clicar, digitar, esperar, teclar } from "./componentes/interacoes.ts";
import { type PropriedadesDoResumo } from "../src/modulos/avaliacao-documental/ficha/resumo-da-nota.tsx";
import { RodapeDaFicha } from "../src/modulos/avaliacao-documental/ficha/rodape-da-ficha.tsx";
import { TravaDasInscricoes } from "../src/modulos/avaliacao-documental/trava-das-inscricoes.tsx";
import {
  erroDoMotivo,
  lerTrava,
  mostrarTrava,
  textoDoEvento,
} from "../src/lib/avaliacao-documental/trava-das-inscricoes.ts";
import { createHash } from "node:crypto";
import { espelhoDaEliminacaoPreAnalise } from "../src/lib/avaliacao-documental/espelho-da-pre-classificacao.ts";
import {
  espelhoDeExemplo,
  folhaDoEspelho,
  linhasDoTimbrado,
  paginaDoEspelho,
} from "../src/lib/avaliacao-documental/espelho-de-nota.ts";
import {
  carregarBibliotecasDoPdf,
  pdfDoEspelho,
} from "../src/lib/avaliacao-documental/espelho-em-pdf.ts";
import {
  comMarcadorNoCursor,
  TEXTOS_PADRAO_DO_ESPELHO,
  textosDoModelo,
} from "../src/lib/avaliacao-documental/modelo-do-espelho.ts";
import { CABECALHO_PADRAO } from "../src/lib/base/cabecalho-dos-documentos.ts";
import {
  CampoNumero,
  type NumeroDigitado,
} from "../src/modulos/avaliacao-documental/campos.tsx";
import { readFileSync } from "node:fs";
import { ModeloDoEspelhoDeNota } from "../src/modulos/avaliacao-documental/modelo-do-espelho.tsx";
import { FundamentosDaEliminacao } from "../src/modulos/avaliacao-documental/fundamentos-da-eliminacao.tsx";
import { SininhoDoResumo } from "../src/modulos/resumo-do-dia/resumo-do-dia.tsx";
import { criarEstadoDoResumoDoDia } from "../src/modulos/resumo-do-dia/estado.ts";
import { desenharNoTeste } from "./montar-tela.ts";
import {
  erroDoMotivoDoCritico,
  motivosDeAtencao,
} from "../src/lib/visao-geral/criticos-da-visao-geral.ts";
import {
  acompanhamentoDaResposta,
  enriquecerLinhas,
} from "../src/lib/visao-geral/visao-geral.ts";
import {
  buscarAcompanhamentoNoSupabase,
  RPC_ACOMPANHAMENTO,
  RPC_CRITICOS_MANUAIS,
} from "../src/modulos/visao-geral/estado.ts";
import { type ClienteDoAcompanhamento } from "../src/modulos/visao-geral/tipos.ts";
import {
  CriticoDoEdital,
  lerCriticoDoEdital,
  type ClienteDoCritico,
} from "../src/modulos/editais/critico-do-edital.tsx";
import { fonteDoApp } from "./fonte-do-app.ts";
import { htmlDaPagina } from "./pagina-montada.ts";
import {
  Abas,
  ContagemDaAba,
  formatarContagem,
  Segmentado,
  SeloDePrazo,
} from "../src/ui/index.ts";

bloco("componentes/cabecalho-da-ficha", async () => {
  /*
  O cabeçalho da ficha no notebook (cabecalho-da-ficha.tsx): "enxuto" em tela
  baixa (até 860 px de altura CSS), "compacto" em tela muito baixa (até 680 px)
  ou ao rolar a página, e volta ao normal quando a rolagem volta ao alto. A
  vaga inteira e o nome inteiro ficam na dica. Dados fictícios.
*/
  const { CabecalhoDaFicha } =
    await import("../src/modulos/avaliacao-documental/ficha/cabecalho-da-ficha.tsx");

  let telas: string[] = [];
  function simularTela(casam: string[]) {
    telas = casam;
    vi.stubGlobal("matchMedia", (consulta: string) => ({
      matches: telas.some((t) => consulta.includes(t)),
      addEventListener() {},
      removeEventListener() {},
    }));
  }

  let montagem: Root | undefined;
  let raiz: HTMLDivElement | undefined;
  const PROPS: Parameters<typeof CabecalhoDaFicha>[0] = {
    codigo: "7001",
    nome: "Maria Exemplo da Silva",
    vaga: "182428",
    cargo: "CARGO 2: BIÓLOGO - Análise da Água (Nível Superior)",
    nivel: "Superior",
    declarada: "40",
    posicao: "1º",
    modalidade: "AC",
    informacoes: [],
    voltar: () => {},
    navegacao: {
      posicao: 0,
      total: 3,
      anterior: null,
      proxima: null,
      abrindo: false,
      ir: () => {},
    },
  };
  async function montar() {
    const novaRaiz = document.createElement("div");
    raiz = novaRaiz;
    document.body.append(novaRaiz);
    const novaMontagem = createRoot(novaRaiz);
    montagem = novaMontagem;
    await act(async () =>
      novaMontagem.render(createElement(CabecalhoDaFicha, PROPS)),
    );
    return achar(".avd-analise-topo", novaRaiz);
  }
  let quadros: (() => void)[] = [];
  async function rolarAte(y: number) {
    await act(async () => {
      Object.defineProperty(window, "scrollY", {
        configurable: true,
        value: y,
      });
      window.dispatchEvent(new Event("scroll"));
      // O próximo quadro de animação.
      quadros.splice(0).forEach((fn) => fn());
    });
  }

  beforeEach(() => {
    quadros = [];
    vi.stubGlobal("requestAnimationFrame", (fn: () => void) =>
      quadros.push(fn),
    );
    vi.stubGlobal("cancelAnimationFrame", () => {});
    Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
    Object.defineProperty(document.documentElement, "scrollHeight", {
      configurable: true,
      value: 3000,
    });
  });
  afterEach(async () => {
    await act(async () => montagem?.unmount());
    raiz?.remove();
    vi.unstubAllGlobals();
  });

  describe("cabeçalho da ficha no notebook", () => {
    it("tela alta: normal, com a vaga e o nome inteiros na dica", async () => {
      simularTela([]);
      const topo = await montar();
      expect(topo.dataset.tamanho).toBeUndefined();
      expect(achar(".avd-analise-vaga", topo).title).toBe(
        "182428 · CARGO 2: BIÓLOGO - Análise da Água (Nível Superior) · Superior",
      );
      expect(achar(".avd-analise-nome", topo).title).toBe(
        "Maria Exemplo da Silva",
      );
      // "Voltar à fila" continua com nome acessível mesmo só com a seta.
      expect(
        topo.querySelector("[data-acao='voltar-a-fila']")?.textContent,
      ).toContain("Voltar à fila");
    });

    it("tela baixa: enxuto; muito baixa: compacto", async () => {
      simularTela(["max-height: 860px"]);
      expect((await montar()).dataset.tamanho).toBe("enxuto");
      await act(async () => definido(montagem).unmount());
      definido(raiz).remove();
      simularTela(["max-height: 860px", "max-height: 680px"]);
      expect((await montar()).dataset.tamanho).toBe("compacto");
    });

    it("ao rolar compacta e volta ao alto sem vaivém", async () => {
      simularTela([]);
      const topo = await montar();
      await rolarAte(30);
      expect(topo.dataset.tamanho).toBeUndefined();
      await rolarAte(120);
      expect(topo.dataset.tamanho).toBe("compacto");
      await rolarAte(30); // entre 8 e 48 px: continua compacto
      expect(topo.dataset.tamanho).toBe("compacto");
      await rolarAte(0);
      expect(topo.dataset.tamanho).toBeUndefined();
    });

    it("página quase sem rolagem não compacta (evita o vaivém)", async () => {
      Object.defineProperty(document.documentElement, "scrollHeight", {
        configurable: true,
        value: window.innerHeight + 100,
      });
      simularTela([]);
      const topo = await montar();
      await rolarAte(90);
      expect(topo.dataset.tamanho).toBeUndefined();
    });
  });
});

bloco("componentes/inscricoes-do-edital", () => {
  /*
  Cartão "Inscrições" no topo da Triagem: aparece só durante as
  inscrições, mostra os totais, o mini-gráfico e a tabela por vaga; sem
  retrato, um estado vazio curto; com prévia, o selo.
*/

  let raiz: Root | undefined;
  let alvo: HTMLElement | undefined;
  function montar(dados: ComponentProps<typeof InscricoesDoEdital>["dados"]) {
    alvo = document.createElement("div");
    document.body.append(alvo);
    const novaRaiz = createRoot(alvo);
    raiz = novaRaiz;
    act(() => novaRaiz.render(createElement(InscricoesDoEdital, { dados })));
    return alvo;
  }
  afterEach(() => {
    act(() => raiz?.unmount());
    alvo?.remove();
  });

  describe("cartão Inscrições", () => {
    it("mostra os totais, o gráfico e as vagas durante as inscrições", () => {
      const el = montar(DADOS_114);
      const cartao = el.querySelector("[data-inscricoes]");
      expect(cartao).not.toBeNull();
      expect(cartao?.textContent).toContain("até 14/10");
      const total = (nome: string) =>
        achar(`[data-total="${nome}"] dd`, el).textContent;
      expect(total("inscritos")).toBe("21 hoje +3");
      expect(total("finalizados")).toBe("19");
      expect(total("aptos")).toBe("8");
      expect(total("eliminados")).toBe("2");
      expect(el.querySelectorAll("polyline")).toHaveLength(2);
      expect(achar("svg", el).getAttribute("aria-label")).toContain("09/10 21");
      const linha = achar('[data-vaga="181100"]', el);
      expect(acharTodos("td", linha).map((td) => td.textContent)).toEqual([
        "181100 Analista — Belo Horizonte",
        "18",
        "7",
        "+3",
      ]);
      expect(achar('[data-vaga="181101"] td:last-child', el).textContent).toBe(
        "—",
      );
      expect(achar("details", el).open).toBe(true);
      expect(el.textContent).not.toContain("prévia");
    });

    it("não aparece fora das inscrições", () => {
      const el = montar({ ...DADOS_114, hoje: "2026-10-20" });
      expect(el.querySelector("[data-inscricoes]")).toBeNull();
    });

    it("sem retrato ainda: estado vazio curto", () => {
      const el = montar({ ...DADOS_114, retratos: [] });
      expect(achar("[data-sem-retrato]", el).textContent).toBe(
        "Aguardando a primeira carga da Empregare.",
      );
      expect(el.querySelector("table")).toBeNull();
    });

    it("aptos de prévia ganham o selo; depois do fim, 'encerradas'", () => {
      const retratos = DADOS_114.retratos.map((r) => ({ ...r, previa: true }));
      const el = montar({ ...DADOS_114, retratos, hoje: "2026-10-15" });
      expect(achar(".ui-selo", el).textContent).toBe("prévia");
      expect(el.textContent).toContain("encerradas em 14/10");
    });
  });
});

bloco("componentes/leitura-dos-arquivos-na-ficha", async () => {
  /*
  O que o robô leu dos arquivos, na ficha (leitura-dos-arquivos.tsx): o
  "Lido do arquivo" ao lado do arquivo e a conferência de cada item lido —
  Aceitar vira linha, Recusar pede o motivo em chips, teclas A e R na linha
  focada, "Aceitar todos sem alerta" e, só leitura, sem botões.
*/
  const { ConferenciaDoLido, LidoDoArquivo } =
    await import("../src/modulos/avaliacao-documental/ficha/leitura-dos-arquivos.tsx");
  const { itensParaConferir, leiturasDaFicha } =
    await import("../src/lib/avaliacao-documental/leitura-dos-arquivos.ts");

  let montagem: Root | undefined;
  let raiz = document.createElement("div");
  async function montar(elemento: ReactElement) {
    raiz = document.createElement("div");
    document.body.append(raiz);
    const novaMontagem = createRoot(raiz);
    montagem = novaMontagem;
    await act(async () => novaMontagem.render(elemento));
  }

  /*
  O lançamento e o contexto da Empregare com o que o teste dá; o resto vai
  vazio, como a ficha nova (a conferência só lê a lista do bloco).
*/
  const lancamentoDeTeste = (campos: Partial<Lancamento>): Lancamento => ({
    nivel: "",
    modalidade: "",
    blocos: {},
    titulos: [],
    cursos: [],
    vinculos: [],
    ...campos,
  });
  const empregareDeTeste = (
    registrar: LojaDaFicha["registrarAcesso"],
  ): ContextoDaEmpregare => ({
    loja: { registrarAcesso: registrar },
    enderecos: { candidato: null, vaga: null, vagaDireta: false },
    codigoDoCandidato: "",
    codigoDaVaga: "",
    aoAvisar: () => {},
  });

  type Alerta = { codigo: string; texto: string };
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
  const curso = (
    nome: string,
    horas: number,
    pagina: number,
    alertas: Alerta[] = [],
  ) => ({
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
    inicial = lancamentoDeTeste({ nivel: "superior", cursos: [] }),
  }: {
    desabilitado?: boolean;
    registrar?: LojaDaFicha["registrarAcesso"];
    aoMudar?: (lancamento: Lancamento) => void;
    inicial?: Lancamento;
  }) {
    const [lancamento, setLancamento] = useState(inicial);
    const mudar: Mudar = (transformar) =>
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
      empregare: empregareDeTeste(registrar),
    });
  }

  describe("lido do arquivo", () => {
    it("o resumo do robô e os alertas do arquivo numa linha; sem leitura, nada", async () => {
      await montar(
        createElement("div", null, [
          createElement(LidoDoArquivo, {
            key: 1,
            leitura: {
              ...definido(leituras[0]),
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
      expect(raiz.querySelectorAll<HTMLElement>(".avd-lido")).toHaveLength(1);
      expect(
        raiz.querySelector<HTMLElement>(".avd-lido-resumo")?.textContent,
      ).toContain(
        "Lido do arquivo: 3 certificados · 145 h, 60 h, 20 h · nome confere",
      );
      expect(
        raiz.querySelector<HTMLElement>(".avd-lido-alertas")?.textContent,
      ).toBe("O CPF do documento não é o do candidato");
    });
  });

  describe("conferência dos itens lidos", () => {
    it("cada item com o texto, a página e Aceitar/Recusar; o com alerta destacado", async () => {
      await montar(createElement(Conferencia));
      const linhas = raiz.querySelectorAll<HTMLElement>(".avd-conferir-item");
      expect(linhas).toHaveLength(3);
      expect(linhas[0]?.textContent).toContain(
        "Enfrentamento das Arboviroses · 145 h · Fiocruz MS · 2023",
      );
      expect(
        linhas[0]?.querySelector<HTMLElement>(".avd-conferir-arquivo")
          ?.textContent,
      ).toContain("pág. 1");
      expect(linhas[2]?.dataset.alerta).toBe("leve");
      expect(
        linhas[2]?.querySelector<HTMLElement>(".avd-conferir-alertas")
          ?.textContent,
      ).toContain("abaixo do mínimo");
      expect(
        raiz.querySelector<HTMLElement>(".avd-conferir-titulo")?.textContent,
      ).toContain("3 certificados lidos");
      expect(
        raiz.querySelector<HTMLElement>(".avd-conferir-titulo")?.textContent,
      ).toContain("3 para conferir");
    });

    it("aceitar vira linha marcada do arquivo; recusar pede o motivo e guarda", async () => {
      const mudancas: Lancamento[] = [];
      await montar(
        createElement(Conferencia, { aoMudar: (l) => mudancas.push(l) }),
      );
      const linhas = () =>
        raiz.querySelectorAll<HTMLElement>(".avd-conferir-item");
      await clicar(
        linhas()[0]?.querySelector<HTMLElement>('[data-acao="aceitar"]'),
      );
      expect(mudancas.at(-1)?.cursos).toEqual([
        {
          nome: "Enfrentamento das Arboviroses",
          horas: 145,
          aceito: true,
          do_arquivo: "8019889:555:1:0",
        },
      ]);
      expect(linhas()[0]?.dataset.estado).toBe("aceito");
      await clicar(
        linhas()[2]?.querySelector<HTMLElement>('[data-acao="recusar"]'),
      );
      const chips = [
        ...definido(linhas()[2]).querySelectorAll<HTMLElement>(
          ".avd-ficha-chip",
        ),
      ];
      expect(chips.map((c) => c.textContent)).toEqual([
        "fora da área da vaga",
        "carga horária não comprovada",
        "nome divergente",
        "ilegível",
        "período sobreposto",
        "outro…",
      ]);
      await clicar(chips[1]);
      expect(mudancas.at(-1)?.recusas_lidas).toEqual({
        "8019889:555:1:2": { motivo: "CARGA_NAO_COMPROVADA" },
      });
      expect(linhas()[2]?.dataset.estado).toBe("recusado");
      // A recusa continua visível e editável (o chip marcado).
      expect(
        linhas()[2]?.querySelector<HTMLElement>(
          '.avd-ficha-chip[aria-pressed="true"]',
        )?.textContent,
      ).toBe("carga horária não comprovada");
      // Desfazer volta a pendente.
      await clicar(
        [...definido(linhas()[2]).querySelectorAll<HTMLElement>("button")].find(
          (b) => b.textContent?.includes("Desfazer"),
        ),
      );
      expect(linhas()[2]?.dataset.estado).toBe("pendente");
    });

    it("teclas A e R na linha focada; aceitar todos sem alerta deixa o com alerta", async () => {
      const mudancas: Lancamento[] = [];
      await montar(
        createElement(Conferencia, { aoMudar: (l) => mudancas.push(l) }),
      );
      const linha = definido(
        raiz.querySelectorAll<HTMLElement>(".avd-conferir-item")[1],
      );
      linha.focus();
      await act(async () => {
        linha.dispatchEvent(
          new KeyboardEvent("keydown", { key: "a", bubbles: true }),
        );
      });
      expect(mudancas.at(-1)?.cursos.map((c) => c.horas)).toEqual([60]);
      const terceira = definido(
        raiz.querySelectorAll<HTMLElement>(".avd-conferir-item")[2],
      );
      await act(async () => {
        terceira.dispatchEvent(
          new KeyboardEvent("keydown", { key: "r", bubbles: true }),
        );
      });
      expect(
        terceira.querySelectorAll<HTMLElement>(".avd-ficha-chip"),
      ).toHaveLength(6);
      // Só sobra 1 pendente sem alerta: o "Aceitar todos sem alerta" só aparece com 2 ou mais.
      expect(
        raiz.querySelector<HTMLElement>(
          '.avd-conferir-topo [data-acao="aceitar-sem-alerta"]',
        ),
      ).toBeNull();
    });

    it("aceitar todos sem alerta", async () => {
      const mudancas: Lancamento[] = [];
      await montar(
        createElement(Conferencia, { aoMudar: (l) => mudancas.push(l) }),
      );
      const botao = definido(
        raiz.querySelector<HTMLElement>(
          '.avd-conferir-topo [data-acao="aceitar-sem-alerta"]',
        ),
      );
      expect(botao.textContent).toContain("Aceitar todos sem alerta (2)");
      await clicar(botao);
      expect(mudancas.at(-1)?.cursos.map((c) => c.horas)).toEqual([145, 60]);
      expect(
        raiz.querySelectorAll<HTMLElement>(
          '.avd-conferir-item[data-estado="pendente"]',
        ),
      ).toHaveLength(1);
    });

    it("conferir todos: aceita os pendentes de uma vez, sem mexer no recusado, e desfaz", async () => {
      const mudancas: Lancamento[] = [];
      const { recusarItemLido } =
        await import("../src/lib/avaliacao-documental/leitura-dos-arquivos.ts");
      const inicial = recusarItemLido(
        lancamentoDeTeste({ nivel: "superior", cursos: [] }),
        CURSOS,
        definido(itens[1]).chave,
        "FORA_DA_AREA",
      );
      await montar(
        createElement(Conferencia, {
          inicial,
          aoMudar: (l) => mudancas.push(l),
        }),
      );
      const botao = definido(
        raiz.querySelector<HTMLElement>(
          '.avd-conferir-topo [data-acao="conferir-todos"]',
        ),
      );
      expect(botao.textContent).toContain("Conferir todos (2)");
      await clicar(botao);
      // Uma só mudança no lançamento (o rascunho grava como no clique de um item).
      expect(mudancas).toHaveLength(1);
      expect(mudancas[0]?.cursos.map((c) => c.horas)).toEqual([145, 20]);
      expect(
        mudancas[0]?.recusas_lidas?.[definido(itens[1]).chave]?.motivo,
      ).toBe("FORA_DA_AREA");
      expect(
        raiz.querySelectorAll<HTMLElement>(
          '.avd-conferir-item[data-estado="aceito"]',
        ),
      ).toHaveLength(2);
      expect(
        raiz.querySelector<HTMLElement>(
          '.avd-conferir-topo [data-acao="conferir-todos"]',
        ),
      ).toBeNull();
      const desfazer = definido(
        raiz.querySelector<HTMLElement>(
          '.avd-conferir-topo [data-acao="desfazer-todos"]',
        ),
      );
      expect(desfazer.textContent).toContain("Desfazer (2)");
      await clicar(desfazer);
      expect(mudancas.at(-1)?.cursos).toEqual([]);
      expect(
        mudancas.at(-1)?.recusas_lidas?.[definido(itens[1]).chave]?.motivo,
      ).toBe("FORA_DA_AREA");
      expect(
        raiz.querySelector<HTMLElement>(
          '.avd-conferir-topo [data-acao="desfazer-todos"]',
        ),
      ).toBeNull();
    });

    it("só leitura: sem botões nem teclas; abrir o arquivo registra o acesso", async () => {
      const registrar = vi.fn(async () => {});
      await montar(
        createElement(Conferencia, { desabilitado: true, registrar }),
      );
      expect(
        raiz.querySelectorAll<HTMLElement>(".avd-conferir-botao"),
      ).toHaveLength(0);
      expect(
        raiz
          .querySelector<HTMLElement>(".avd-conferir-item")
          ?.getAttribute("tabindex"),
      ).toBeNull();
      const link = definido(
        raiz.querySelector<HTMLElement>(".avd-conferir-arquivo"),
      );
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
  const vinculo = (extra: Record<string, unknown>) => ({
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
            texto:
              "Concomitante com outro vínculo (pode ser legítimo): confira",
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

  function ConferenciaDeVinculos({
    aoMudar = () => {},
  }: {
    aoMudar?: (lancamento: Lancamento) => void;
  }) {
    const [lancamento, setLancamento] = useState(
      lancamentoDeTeste({
        nivel: "superior",
        vinculos: [],
      }),
    );
    const mudar: Mudar = (transformar) =>
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
      empregare: empregareDeTeste(vi.fn()),
    });
  }

  describe("corrigir o item lido e alertas resumidos", () => {
    it("um alerta visível por item (o resto no +N); concomitante vira selo; 'até hoje' no texto; só o que impede em laranja", async () => {
      await montar(createElement(ConferenciaDeVinculos));
      const linhas = raiz.querySelectorAll<HTMLElement>(".avd-conferir-item");
      // 1º: empregador não lido, leve (cinza), com +1 na dica.
      const alerta1 = definido(linhas[0]).querySelectorAll<HTMLElement>(
        ".avd-conferir-alertas",
      );
      expect(alerta1).toHaveLength(1);
      expect(alerta1[0]?.dataset.tom).toBe("leve");
      expect(alerta1[0]?.textContent).toContain("Empregador não encontrado");
      const mais = definido(
        definido(alerta1[0]).querySelector<HTMLElement>(".avd-conferir-mais"),
      );
      expect(mais.textContent).toBe("+1");
      expect(mais.getAttribute("title")).toBe("Confira o nome neste item");
      // 2º: atual sem emissão e concomitante: sem alerta, "até hoje" e o selo neutro.
      expect(
        linhas[1]?.querySelector<HTMLElement>(".avd-conferir-alertas"),
      ).toBeNull();
      expect(linhas[1]?.textContent).toContain("984 dias até hoje");
      expect(
        linhas[1]?.querySelector<HTMLElement>(".avd-conferir-selo")
          ?.textContent,
      ).toBe("concomitante");
      // 3º: o mesmo empregador repetido: laranja.
      expect(linhas[2]?.dataset.alerta).toBe("grave");
      expect(
        linhas[2]?.querySelector<HTMLElement>(".avd-conferir-alertas")?.dataset
          .tom,
      ).toBe("grave");
    });

    it("Corrigir abre a linha preenchida; aceitar com a correção marca corrigido; o atual sem fim abre direto no Corrigir", async () => {
      const mudancas: Lancamento[] = [];
      await montar(
        createElement(ConferenciaDeVinculos, {
          aoMudar: (l) => mudancas.push(l),
        }),
      );
      const linha = (n: number) =>
        definido(raiz.querySelectorAll<HTMLElement>(".avd-conferir-item")[n]);
      // O atual sem data de fim não conta sozinho: Aceitar abre o Corrigir.
      await clicar(
        linha(1).querySelector<HTMLElement>("[data-acao='aceitar']"),
      );
      expect(mudancas).toHaveLength(0);
      const editor = () =>
        linha(1).querySelector<HTMLElement>(".avd-conferir-corrigir");
      expect(editor()).not.toBeNull();
      expect(
        editor()?.querySelector<HTMLInputElement>(
          "input[aria-label='Empregador ou cargo']",
        )?.value,
      ).toBe("Missão Caiuá · Enfermeiro");
      expect(
        editor()?.querySelector<HTMLInputElement>("input[aria-label='Início']")
          ?.value,
      ).toBe("2024-02-01");
      const fim = definido(
        editor()?.querySelector<HTMLInputElement>("input[aria-label='Fim']"),
      );
      expect(fim.getAttribute("aria-invalid")).toBe("true");
      const aceitarCorrecao = () =>
        editor()?.querySelector<HTMLButtonElement>(
          "[data-acao='aceitar-correcao']",
        );
      expect(aceitarCorrecao()?.disabled).toBe(true);
      await digitar(fim, "2026-10-13");
      await clicar(aceitarCorrecao());
      expect(mudancas.at(-1)?.vinculos).toEqual([
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
        linha(1).querySelector<HTMLElement>(".avd-conferir-corrigido")
          ?.textContent,
      ).toContain("01/02/2024 a 13/10/2026");
      // Corrigir pelo botão no item pendente: troca o empregador não lido.
      await clicar(
        linha(0).querySelector<HTMLElement>("[data-acao='corrigir']"),
      );
      await digitar(
        linha(0).querySelector<HTMLInputElement>(
          "input[aria-label='Empregador ou cargo']",
        ),
        "SESAI · Agente",
      );
      await clicar(
        linha(0).querySelector<HTMLElement>("[data-acao='aceitar-correcao']"),
      );
      expect(mudancas.at(-1)?.vinculos.map((v) => v.empregador)).toEqual([
        "Missão Caiuá · Enfermeiro",
        "SESAI · Agente",
      ]);
      // Cancelar não grava nada.
      const antes = mudancas.length;
      await clicar(
        linha(2).querySelector<HTMLElement>("[data-acao='corrigir']"),
      );
      await clicar(
        [...linha(2).querySelectorAll<HTMLElement>("button")].find(
          (b) => b.textContent === "Cancelar",
        ),
      );
      expect(mudancas).toHaveLength(antes);
      expect(
        linha(2).querySelector<HTMLElement>(".avd-conferir-corrigir"),
      ).toBeNull();
    });
  });
});

bloco("componentes/resumo-da-nota-da-ficha", async () => {
  /*
  A nota na lateral da ficha (resumo-da-nota.tsx): o item sem decisão mostra a
  prévia em tom neutro com "(prévia)", a nota parcial avisa que soma prévias e
  o Inapto diz por quê, com o link para o item.
*/
  const { ResumoDaNota } =
    await import("../src/modulos/avaliacao-documental/ficha/resumo-da-nota.tsx");

  let montagem: Root | undefined;
  let raiz: HTMLDivElement | undefined;
  async function montar(props: PropriedadesDoResumo) {
    const elemento = document.createElement("div");
    raiz = elemento;
    document.body.append(elemento);
    const novaMontagem = createRoot(elemento);
    montagem = novaMontagem;
    await act(async () =>
      novaMontagem.render(createElement(ResumoDaNota, props)),
    );
  }
  afterEach(async () => {
    await act(async () => montagem?.unmount());
    raiz?.remove();
  });

  const parte = (extra: Partial<ParteDaNota>): ParteDaNota => ({
    bloco: "EXPERIENCIA",
    parcial: "EXPERIENCIA",
    rotulo: "Experiência Profissional",
    apurado: null,
    declarado: 15,
    teto: 35,
    divergente: false,
    previa: null,
    ...extra,
  });

  describe("nota da ficha", () => {
    it("item sem decisão: a prévia, neutra, e a nota parcial com prévias", async () => {
      await montar({
        nota: 20,
        parcial: true,
        comPrevia: true,
        minima: 15,
        selo: { tom: "neutro", texto: "Em análise" },
        partes: [parte({ previa: 20 })],
      });
      const linha = achar(".avd-ficha-parte", raiz);
      expect(linha.dataset.previa).toBe("sim");
      expect(achar(".avd-ficha-parte-valor", linha).textContent).toBe(
        "20 / 35 (prévia)",
      );
      expect(achar(".avd-ficha-nota-total", raiz).textContent).toBe(
        "20 parcial (com prévias)",
      );
    });

    it("conferido: o apurado, sem prévia", async () => {
      await montar({
        nota: 15,
        parcial: false,
        minima: 15,
        selo: { tom: "aprovado", texto: "Apto" },
        partes: [parte({ apurado: 15 })],
      });
      const linha = achar(".avd-ficha-parte", raiz);
      expect(linha.dataset.previa).toBeUndefined();
      expect(achar(".avd-ficha-parte-valor", linha).textContent).toBe(
        "15 / 35",
      );
    });

    it("Inapto: o motivo com o link para o item", async () => {
      const aoIr = vi.fn();
      await montar({
        nota: 0,
        parcial: false,
        minima: 15,
        selo: { tom: "reprovado", texto: "Inapto (requisito)" },
        resultado: "INAPTO_REQUISITO",
        motivos: [
          {
            bloco: "EXPERIENCIA",
            texto:
              "Experiência mínima de 6 meses não comprovada (comprovado 0 meses) — item 1.1.1 c",
          },
        ],
        aoIr,
        partes: [],
      });
      const link = achar(".avd-ficha-motivos-resultado button", raiz);
      expect(link.textContent).toContain("comprovado 0 meses");
      await clicar(link);
      expect(aoIr).toHaveBeenCalledWith("EXPERIENCIA");
    });
  });
});

bloco("componentes/rodape-da-ficha", () => {
  /*
  No celular as setas Anterior / Próximo da ficha escondem o texto
  (ficha.css, display: none no span) e ficavam sem nome acessível
  (auditoria das telas, 13/10/2026).
*/
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  let raiz: Root | null = null;
  afterEach(() => {
    act(() => raiz?.unmount());
    raiz = null;
    document.body.innerHTML = "";
  });

  describe("rodapé da ficha", () => {
    it("as setas têm nome mesmo sem o texto à vista", () => {
      const conteiner = document.createElement("div");
      document.body.append(conteiner);
      const novaRaiz = createRoot(conteiner);
      raiz = novaRaiz;
      act(() =>
        novaRaiz.render(
          createElement(RodapeDaFicha, {
            estado: "Salvo às 10:43",
            anterior: {
              rotulo: "Anterior",
              acao: "anterior",
              aoClicar: () => {},
            },
            proximo: { rotulo: "Próximo", acao: "proximo", aoClicar: () => {} },
          }),
        ),
      );
      expect(
        conteiner
          .querySelector("[data-acao=anterior]")
          ?.getAttribute("aria-label"),
      ).toBe("Anterior");
      expect(
        conteiner
          .querySelector("[data-acao=proximo]")
          ?.getAttribute("aria-label"),
      ).toBe("Próximo");
    });
  });
});

bloco("componentes/trava-das-inscricoes", () => {
  type RpcDaTrava = NonNullable<
    Parameters<typeof TravaDasInscricoes>[0]["rpc"]
  >;

  /*
  Cartão "Inscrições congeladas" da aba Triagem (migration
  20261020170000): congelado, todos veem (quem, quando, motivo); a
  coordenação/administrador congela ou libera com motivo; liberado e sem
  permissão, não aparece; banco sem a migration, não aparece. RPC falsa.
*/

  const EDITAL = "bcecfb08-88ef-4e06-8401-bcad6bf88fd0";
  const CONGELADO = {
    congelado: true,
    motivo: "Inscrições encerradas em 14/10/2026.",
    em: "2026-10-20T19:00:00Z",
    por: "Gestão da Informação",
    pode_alterar: true,
    historico: [
      {
        tipo: "CONGELAR",
        motivo: "Inscrições encerradas em 14/10/2026.",
        em: "2026-10-20T19:00:00Z",
        por: "Gestão da Informação",
      },
    ],
  };
  const LIBERADO = { congelado: false, pode_alterar: true, historico: [] };

  let raiz: Root | undefined;
  let alvo: HTMLDivElement | undefined;
  async function montar(rpc: RpcDaTrava) {
    const novoAlvo = document.createElement("div");
    alvo = novoAlvo;
    document.body.append(novoAlvo);
    const novaRaiz = createRoot(novoAlvo);
    raiz = novaRaiz;
    await esperar(async () => {
      novaRaiz.render(
        createElement(TravaDasInscricoes, { editalId: EDITAL, rpc }),
      );
    });
    await esperar();
    return novoAlvo;
  }
  afterEach(() => {
    act(() => raiz?.unmount());
    alvo?.remove();
  });

  describe("regras da trava", () => {
    it("lê a resposta do banco com segurança e diz quando mostrar", () => {
      const t = lerTrava(CONGELADO);
      expect(t.congelado).toBe(true);
      expect(t.em).toBeInstanceOf(Date);
      expect(t.historico).toHaveLength(1);
      expect(mostrarTrava(t)).toBe(true);
      expect(
        mostrarTrava(lerTrava({ congelado: false, pode_alterar: false })),
      ).toBe(false);
      expect(mostrarTrava(lerTrava(null))).toBe(false);
      expect(lerTrava({ historico: [{ tipo: "USO" }, "x"] }).historico).toEqual(
        [],
      );
    });

    it("motivo de 10 a 500 caracteres e o evento em texto", () => {
      expect(erroDoMotivo("curto")).toContain("10 a 500");
      expect(erroDoMotivo("Motivo suficiente")).toBe("");
      expect(textoDoEvento(definido(lerTrava(CONGELADO).historico[0]))).toMatch(
        /^Congelou em \d\d\/\d\d por Gestão da Informação: Inscrições encerradas/,
      );
    });
  });

  describe("cartão Inscrições congeladas", () => {
    it("congelado: mostra a trava e libera com motivo", async () => {
      const rpc = vi.fn(async (nome: string, args: Record<string, unknown>) => {
        if (nome === "obter_congelamento_inscricoes") return CONGELADO;
        if (nome === "alterar_congelamento_inscricoes")
          return { ...LIBERADO, historico: [] };
        throw new Error(nome + JSON.stringify(args));
      });
      const el = await montar(rpc);
      expect(rpc).toHaveBeenCalledWith("obter_congelamento_inscricoes", {
        p_edital: EDITAL,
      });
      const cartao = el.querySelector('[data-trava="congelada"]');
      expect(cartao).not.toBeNull();
      expect(cartao?.textContent).toContain("Inscrições congeladas");
      expect(cartao?.textContent).toContain("por Gestão da Informação");
      expect(cartao?.textContent).toContain("Histórico (1)");

      await clicar(el.querySelector('[data-acao="abrir-liberar"]'));
      const confirmar = achar<HTMLButtonElement>('[data-acao="liberar"]', el);
      expect(confirmar.disabled).toBe(true);
      await digitar(
        el.querySelector('[data-campo="motivo-da-trava"]'),
        "curto",
      );
      expect(el.textContent).toContain(
        "Informe o motivo (10 a 500 caracteres).",
      );
      await digitar(
        el.querySelector('[data-campo="motivo-da-trava"]'),
        "Coordenação autorizou nova carga",
      );
      expect(
        achar<HTMLButtonElement>('[data-acao="liberar"]', el).disabled,
      ).toBe(false);
      await clicar(el.querySelector('[data-acao="liberar"]'));
      await esperar();
      expect(rpc).toHaveBeenLastCalledWith("alterar_congelamento_inscricoes", {
        p_edital: EDITAL,
        p_congelar: false,
        p_motivo: "Coordenação autorizou nova carga",
      });
      expect(el.querySelector('[data-trava="liberada"]')).not.toBeNull();
      expect(el.querySelector('[data-acao="abrir-congelar"]')).not.toBeNull();
    });

    it("liberado: a coordenação congela; o erro do banco aparece", async () => {
      const rpc = vi.fn(async (nome: string) => {
        if (nome === "obter_congelamento_inscricoes") return LIBERADO;
        throw {
          code: "42501",
          message:
            "Só a coordenação da avaliação do edital ou o administrador global congela ou libera as inscrições.",
        };
      });
      const el = await montar(rpc);
      expect(el.textContent).not.toContain("desde");
      await clicar(el.querySelector('[data-acao="abrir-congelar"]'));
      expect(el.textContent).toContain("deixam de mexer neste edital");
      await digitar(
        el.querySelector('[data-campo="motivo-da-trava"]'),
        "Inscrições encerradas",
      );
      await clicar(el.querySelector('[data-acao="congelar"]'));
      await esperar();
      expect(el.querySelector('[role="alert"]')?.textContent).toContain(
        "Só a coordenação",
      );
    });

    it("liberado e sem permissão, ou sem a migration: não aparece", async () => {
      let el = await montar(
        vi.fn(async () => ({ congelado: false, pode_alterar: false })),
      );
      expect(el.querySelector("[data-trava]")).toBeNull();
      act(() => definido(raiz).unmount());
      definido(alvo).remove();
      el = await montar(
        vi.fn(async () => {
          throw { code: "PGRST202", message: "Could not find the function" };
        }),
      );
      expect(el.querySelector("[data-trava]")).toBeNull();
    });

    it("congelado e sem permissão: só leitura, sem botões", async () => {
      const el = await montar(
        vi.fn(async () => ({ ...CONGELADO, pode_alterar: false })),
      );
      expect(el.querySelector('[data-trava="congelada"]')).not.toBeNull();
      expect(el.querySelector("button")).toBeNull();
    });
  });
});

bloco("lib/avaliacao-documental-espelho-visual", async () => {
  /*
  O visual do espelho de nota (issue #588): a folha HTML no padrão do Manual
  de Identidade da AgSUS (General Sans, azul do manual, impressão A4 e prévia
  responsiva), sem XSS pelos textos do modelo, pelo nome ou pelo timbrado; o
  PDF igual ao de antes (o desenho não mudou com o visual da folha); e o
  comunicado de eliminação antes da análise, documento distinto, que não vira
  nota apurada nem nota zero. Só dados fictícios.
*/

  const parse = (html: string) =>
    new DOMParser().parseFromString(html, "text/html");

  describe("folha do espelho no padrão do manual", () => {
    const html = paginaDoEspelho(espelhoDeExemplo("COM_PONTOS"));
    const estilo = parse(html).querySelector("style")?.textContent ?? "";

    it("General Sans do próprio site, com reserva, e o azul do manual", () => {
      expect(estilo).toContain('font-family: "General Sans"');
      expect(estilo).toContain(
        'url("/fonts/general-sans/GeneralSans-Variable.woff2")',
      );
      expect(estilo).toMatch(
        /body \{[^}]*font-family: "General Sans", Calibri, Carlito, "Segoe UI", Arial, sans-serif/,
      );
      expect(estilo).toContain("--azul: #0055a1");
      // A cor antiga (antes do manual) saiu da folha.
      expect(estilo).not.toContain("#003b70");
    });

    it("impressão: A4 sem margem do navegador, cores de fundo e títulos presos ao quadro", () => {
      expect(estilo).toContain("@page { size: A4; margin: 0; }");
      expect(estilo).toContain("print-color-adjust: exact");
      expect(estilo).toMatch(/h2 \{[^}]*break-after: avoid/);
      expect(estilo).toContain(
        ".folha + .folha { break-before: page; page-break-before: always; }",
      );
      // Os ajustes de tela (mesa, sombra, celular) não valem no papel.
      const telas = [...estilo.matchAll(/@media ([^{]+)\{/g)].map((m) =>
        (m[1] ?? "").trim(),
      );
      expect(telas).toEqual(["screen", "screen and (max-width: 640px)"]);
    });

    it("prévia responsiva: em largura de celular, a folha perde a margem de papel", () => {
      expect(estilo).toMatch(
        /@media screen and \(max-width: 640px\) \{[^@]*\.folha \{ margin: 0; padding: 20px 16px 24px;/,
      );
    });

    it("acessível: idioma, título do documento, cabeçalhos das linhas e das colunas", () => {
      const doc = parse(html);
      expect(doc.documentElement.getAttribute("lang")).toBe("pt-BR");
      expect(doc.title).toBe("Espelho de nota (exemplo)");
      expect(doc.querySelectorAll("h1")).toHaveLength(1);
      for (const th of doc.querySelectorAll("table.dados th"))
        expect(th.getAttribute("scope")).toBe("row");
      for (const th of doc.querySelectorAll("table.criterios thead th"))
        expect(th.getAttribute("scope")).toBe("col");
      expect(doc.querySelector("script")).toBeNull();
    });

    it("os dois modelos continuam: com pontos tem critérios; eliminado, não", () => {
      const com = parse(paginaDoEspelho(espelhoDeExemplo("COM_PONTOS")));
      const eli = parse(paginaDoEspelho(espelhoDeExemplo("ELIMINADO")));
      expect(com.querySelector<HTMLElement>(".folha")?.dataset.modelo).toBe(
        "COM_PONTOS",
      );
      expect(com.querySelector("table.criterios")).not.toBeNull();
      expect(eli.querySelector<HTMLElement>(".folha")?.dataset.modelo).toBe(
        "ELIMINADO",
      );
      expect(eli.querySelector("table.criterios")).toBeNull();
      expect(eli.querySelector("table.notas")?.textContent).toContain(
        TEXTOS_PADRAO_DO_ESPELHO.nao_se_aplica,
      );
      expect(eli.body.textContent).not.toContain(
        TEXTOS_PADRAO_DO_ESPELHO.rotulo_autodeclarada,
      );
    });
  });

  describe("sem XSS na folha", () => {
    const ATAQUE = '<script>alert(1)</script><img src=x onerror="alert(2)">';

    function semCodigo(html: string) {
      const doc = parse(html);
      expect(doc.querySelector("script")).toBeNull();
      expect(doc.querySelector("img[src='x']")).toBeNull();
      for (const el of doc.querySelectorAll("*"))
        for (const atributo of Array.from(el.attributes))
          expect(atributo.name.startsWith("on"), atributo.name).toBe(false);
      return doc;
    }

    it("textos do modelo, nome do candidato e timbrado entram como texto", () => {
      const textos = {
        ...TEXTOS_PADRAO_DO_ESPELHO,
        titulo: `Título ${ATAQUE}`,
        subtitulo: ATAQUE,
        saudacao: `Prezado(a) {candidato} ${ATAQUE}`,
        abertura: `Para {candidato}: ${ATAQUE}`,
        secao_dados: ATAQUE,
        rodape: ATAQUE,
      };
      const espelho = {
        ...espelhoDeExemplo("COM_PONTOS", textos),
        candidato: `Pessoa ${ATAQUE}`,
        justificativas: [ATAQUE],
      };
      const doc = semCodigo(
        folhaDoEspelho(espelho, { cabecalho: `AGÊNCIA\n${ATAQUE}` }),
      );
      expect(doc.querySelector("h1")?.textContent).toBe(`Título ${ATAQUE}`);
      expect(doc.querySelector(".timbrado")?.textContent).toContain(ATAQUE);
      expect(doc.querySelector("strong")?.textContent).toBe(`Pessoa ${ATAQUE}`);
    });

    it("logo só por endereço http(s) ou do próprio site", () => {
      for (const logo of [
        "javascript:alert(1)",
        'x" onerror="alert(1)',
        "data:text/html,<script>alert(1)</script>",
      ])
        expect(
          parse(
            folhaDoEspelho(espelhoDeExemplo("ELIMINADO"), { logo }),
          ).querySelector("img"),
        ).toBeNull();
      const doc = parse(
        folhaDoEspelho(espelhoDeExemplo("ELIMINADO"), {
          logo: "/assets/logo.svg",
        }),
      );
      expect(doc.querySelector("img")?.getAttribute("alt")).toBe("AgSUS");
    });

    it("modelo salvo com marcador estranho volta ao padrão (a folha nunca sai quebrada)", () => {
      const textos = textosDoModelo({ titulo: "Olá {constructor}" });
      expect(textos.titulo).toBe(TEXTOS_PADRAO_DO_ESPELHO.titulo);
    });
  });

  describe("timbrado e marcador do editor", () => {
    it("linhasDoTimbrado: as linhas do cabeçalho; vazio = o padrão da AgSUS", () => {
      expect(
        linhasDoTimbrado(" AGÊNCIA DE TESTE \r\n\r\nRua de Exemplo "),
      ).toEqual(["AGÊNCIA DE TESTE", "Rua de Exemplo"]);
      expect(linhasDoTimbrado("")).toEqual(CABECALHO_PADRAO.split("\n"));
      expect(linhasDoTimbrado(undefined)).toEqual(CABECALHO_PADRAO.split("\n"));
    });

    it("comMarcadorNoCursor: no cursor, no lugar da seleção ou no fim", () => {
      expect(comMarcadorNoCursor("Olá, !", 5, 5)).toEqual({
        valor: "Olá, {candidato}!",
        cursor: 16,
      });
      expect(comMarcadorNoCursor("Olá, NOME!", 5, 9)).toEqual({
        valor: "Olá, {candidato}!",
        cursor: 16,
      });
      expect(comMarcadorNoCursor("Olá, ", null, null)).toEqual({
        valor: "Olá, {candidato}",
        cursor: 16,
      });
      // Posições fora do texto ficam nas pontas.
      expect(comMarcadorNoCursor("ab", -3, 99).valor).toBe("{candidato}");
    });
  });

  const libs = await carregarBibliotecasDoPdf();

  describe("PDF do espelho (regressão)", () => {
    /*
    O conteúdo desenhado nas páginas (os streams sem compressão), sem as
    datas do PDF. Mudou o desenho do PDF ou a versão do jsPDF de propósito?
    Confira o PDF gerado e atualize a impressão digital aqui.
  */
    function impressaoDigital(modelo: "COM_PONTOS" | "ELIMINADO") {
      const bytes = pdfDoEspelho(espelhoDeExemplo(modelo), libs, {
        comprimir: false,
      });
      const bruto = new TextDecoder("latin1").decode(bytes);
      const streams = [
        ...bruto.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g),
      ]
        .map((m) => m[1])
        .join("\n--\n");
      return {
        paginas: (bruto.match(/\/Type \/Page\b/g) ?? []).length,
        hash: createHash("sha256").update(streams).digest("hex").slice(0, 16),
      };
    }

    it("com pontos e eliminado: o mesmo desenho de antes do visual novo da folha", () => {
      expect(impressaoDigital("COM_PONTOS")).toEqual(PDF_COM_PONTOS);
      expect(impressaoDigital("ELIMINADO")).toEqual(PDF_ELIMINADO);
    });

    it("determinístico: o mesmo espelho dá o mesmo desenho", () => {
      expect(impressaoDigital("COM_PONTOS")).toEqual(
        impressaoDigital("COM_PONTOS"),
      );
    });
  });

  describe("comunicado de eliminação antes da análise: documento distinto", () => {
    const eliminado = {
      codigo: "C900",
      nome: "Pessoa Fictícia",
      vaga: "V900",
      cargo: "Cargo Fictício",
      edital: "Edital 900/2026",
      situacao: "ELIMINADO",
      motivo: "Documento obrigatório não enviado.",
      motivo_codigo: "OUTRO",
      art: null,
      declarada: 12.5,
    };
    const DO_EDITAL = {
      ...TEXTOS_PADRAO_DO_ESPELHO,
      titulo: "Espelho do edital",
      rotulo_consolidada: "Nota após a análise",
      nao_se_aplica: "Eliminado na análise",
    };

    it("não usa o título nem as notas do modelo do edital", () => {
      const espelho = espelhoDaEliminacaoPreAnalise(eliminado, DO_EDITAL);
      expect(espelho.titulo).toBe("Comunicado de eliminação na triagem");
      const rotulos = espelho.notas.map((n) => n.rotulo);
      expect(rotulos).not.toContain(DO_EDITAL.rotulo_consolidada);
      expect(rotulos).toContain(
        "Nota declarada/recalculada da inscrição (não apurada)",
      );
      expect(espelho.notas.map((n) => n.valor)).not.toContain(
        DO_EDITAL.nao_se_aplica,
      );
    });

    it("nota declarada não é apurada e ausência de nota nunca vira zero", () => {
      const html = folhaDoEspelho(
        espelhoDaEliminacaoPreAnalise({ ...eliminado, declarada: null }),
      );
      const notas = parse(html).querySelector("table.notas")?.textContent ?? "";
      expect(notas).toContain("Não se aplica — análise não realizada");
      expect(notas).not.toMatch(/(^|\D)0(,0+)?(\D|$)/);
      expect(notas).not.toContain("declarada");
    });
  });

  /* A impressão digital do PDF de exemplo (espelhoDeExemplo, timbrado padrão, sem logo). */
  const PDF_COM_PONTOS = { paginas: 1, hash: "1edea29090eb0492" };
  const PDF_ELIMINADO = { paginas: 1, hash: "47a975da855116a9" };
});

bloco("modulos/avaliacao-documental-campo-decimal", () => {
  /*
  O campo de número da regra da avaliação documental. Antes, a cada tecla o
  texto virava número e voltava à tela: "0," virava "0" e a vírgula sumia, de
  modo que digitar "0,25" gravava 25.
*/

  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  let raiz: Root | undefined;
  let caixa: HTMLDivElement | undefined;
  afterEach(async () => {
    await act(async () => raiz?.unmount());
    caixa?.remove();
  });

  async function montar(inicial: NumeroDigitado = null) {
    const gravados: NumeroDigitado[] = [];
    function Teste() {
      const [valor, setValor] = useState<NumeroDigitado>(inicial);
      return createElement(CampoNumero, {
        rotulo: "Pontos por mês",
        valor,
        aoMudar: (v: NumeroDigitado) => {
          gravados.push(v);
          setValor(v);
        },
      });
    }
    caixa = document.createElement("div");
    document.body.append(caixa);
    raiz = createRoot(caixa);
    await act(async () => raiz!.render(createElement(Teste)));
    const campo = caixa.querySelector("input");
    if (!campo) throw new Error("campo não encontrado");
    return { campo, gravados };
  }

  /** Digita tecla a tecla, como o navegador: cada tecla vai ao fim do que está na tela. */
  async function teclaATecla(campo: HTMLInputElement, texto: string) {
    for (const tecla of texto) await digitar(campo, campo.value + tecla);
  }

  describe("CampoNumero da avaliação documental", () => {
    it("aceita decimal com vírgula digitado tecla a tecla", async () => {
      const { campo, gravados } = await montar();
      await teclaATecla(campo, "0,25");
      expect(campo.value).toBe("0,25");
      expect(gravados.at(-1)).toBe(0.25);
    });

    it("mantém a vírgula no meio da digitação de 1,5", async () => {
      const { campo, gravados } = await montar();
      await teclaATecla(campo, "1,");
      expect(campo.value).toBe("1,");
      await digitar(campo, "1,5");
      expect(gravados.at(-1)).toBe(1.5);
    });

    it("ao sair do campo mostra o número no formato da tela", async () => {
      const { campo } = await montar();
      await digitar(campo, "2,50");
      await act(async () => {
        campo.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
      });
      expect(campo.value).toBe("2,5");
    });

    it("mostra o valor que já vem gravado e devolve null quando apagado", async () => {
      const { campo, gravados } = await montar(0.75);
      expect(campo.value).toBe("0,75");
      await digitar(campo, "");
      expect(gravados.at(-1)).toBeNull();
    });

    it("texto que não é número volta como texto (a validação recusa)", async () => {
      const { campo, gravados } = await montar();
      await digitar(campo, "abc");
      expect(gravados.at(-1)).toBe("abc");
    });
  });
});

bloco("modulos/avaliacao-documental-editor-do-espelho-acessivel", () => {
  /*
  O editor do modelo do espelho (issue #588): cabeçalho institucional à vista,
  seções com nome, foco e teclado (Ctrl+S, "Inserir {candidato}", ir ao campo
  com erro), rótulos e descrições ligados aos campos, só leitura para quem não
  coordena, "Imprimir exemplo" e o CSS responsivo e só com tokens (o tema
  escuro vem deles). Dados fictícios.
*/

  type Argumentos = Record<string, unknown>;

  let raiz: Root | null = null;
  let lugar: HTMLDivElement | null = null;
  afterEach(() => {
    act(() => raiz?.unmount());
    lugar?.remove();
    raiz = null;
  });

  function rpcFalso({ podeEditar = true } = {}) {
    return vi.fn(async (nome: string, args: Argumentos) => {
      if (nome === "obter_modelo_espelho_nota")
        return {
          versao: 4,
          textos: {},
          atualizado_em: "2026-11-12T12:00:00Z",
          atualizado_por: "Coordenação Fictícia",
          pode_editar: podeEditar,
        };
      if (nome === "salvar_modelo_espelho_nota")
        return {
          versao: Number(args.p_versao_atual) + 1,
          textos: args.p_textos,
          atualizado_em: "2026-11-12T12:05:00Z",
          atualizado_por: "Coordenação Fictícia",
          pode_editar: true,
        };
      throw new Error(`rpc inesperada ${nome}`);
    });
  }

  async function montar(
    rpc: ReturnType<typeof rpcFalso>,
    imprimir: (html: string) => void = () => {},
  ) {
    lugar = document.createElement("div");
    document.body.append(lugar);
    const r = createRoot(lugar);
    raiz = r;
    await act(async () => {
      r.render(
        createElement(ModeloDoEspelhoDeNota, {
          editalId: "e900",
          rpc,
          aoFechar: () => {},
          marca: () => ({ cabecalho: "AGÊNCIA FICTÍCIA\nRua de Exemplo, 0" }),
          imprimir,
        }),
      );
    });
    await esperar();
  }

  const campo = <T extends HTMLElement = HTMLInputElement>(chave: string) => {
    const el = document.querySelector<T>(`[data-campo='${chave}']`);
    if (!el) throw new Error(`campo ${chave} não encontrado`);
    return el;
  };
  const botao = (acao: string) =>
    document.querySelector<HTMLButtonElement>(`[data-acao='${acao}']`);
  const previa = () =>
    document
      .querySelector(".avd-modelo-espelho-folha")
      ?.getAttribute("srcdoc") ?? "";

  describe("editor do espelho: estrutura e acessibilidade", () => {
    it("mostra o cabeçalho institucional de Configurações, só para leitura", async () => {
      await montar(rpcFalso());
      const timbrado = document.querySelector("[data-secao='timbrado']");
      expect(timbrado?.getAttribute("aria-labelledby")).toBeTruthy();
      expect(
        [...(timbrado?.querySelectorAll("p") ?? [])].map((p) => p.textContent),
      ).toEqual(["AGÊNCIA FICTÍCIA", "Rua de Exemplo, 0"]);
      expect(timbrado?.querySelector("input, textarea")).toBeNull();
      expect(previa()).toContain("AGÊNCIA FICTÍCIA");
    });

    it("seções nomeadas, e todo campo tem rótulo e descrição ligados", async () => {
      await montar(rpcFalso());
      const legendas = [...document.querySelectorAll("fieldset legend")].map(
        (l) => l.textContent,
      );
      expect(legendas).toEqual([
        "Título e abertura",
        "Nomes dos quadros",
        "Notas",
        "Textos fixos e rodapé",
      ]);
      const controles = document.querySelectorAll<
        HTMLInputElement | HTMLTextAreaElement
      >(
        ".avd-modelo-espelho-campos input, .avd-modelo-espelho-campos textarea",
      );
      expect(controles.length).toBe(14);
      const rotulos = [...document.querySelectorAll("label")];
      for (const c of controles) {
        const rotulado =
          c.closest("label") || rotulos.some((l) => c.id && l.htmlFor === c.id);
        expect(rotulado, c.dataset.campo).toBeTruthy();
        const descrito = c.getAttribute("aria-describedby");
        if (descrito)
          expect(
            document.getElementById(descrito),
            c.dataset.campo,
          ).not.toBeNull();
      }
      // A abertura (texto longo) mostra o contador; a saudação, a dica do marcador.
      const abertura = campo<HTMLTextAreaElement>("abertura");
      const dica = document.getElementById(
        abertura.getAttribute("aria-describedby") ?? "",
      );
      expect(dica?.textContent).toMatch(/\d+ de 2\.000 caracteres/);
      expect(
        document.getElementById(
          campo("saudacao").getAttribute("aria-describedby") ?? "",
        )?.textContent,
      ).toContain("{candidato} vira o nome do candidato.");
      expect(campo("titulo").required).toBe(true);
      expect(campo("subtitulo").required).toBe(false);
    });

    it("prévia: seção com título, modelo por radiogroup e iframe com título e sem script", async () => {
      await montar(rpcFalso());
      const secao = document.querySelector(".avd-modelo-espelho-previa");
      const titulo = document.getElementById(
        secao?.getAttribute("aria-labelledby") ?? "",
      );
      expect(titulo?.textContent).toBe("Prévia do documento");
      expect(
        secao?.querySelector("[role='radiogroup']")?.getAttribute("aria-label"),
      ).toBe("Modelo da prévia");
      const iframe = secao?.querySelector("iframe");
      expect(iframe?.getAttribute("title")).toContain("com pontos");
      expect(iframe?.getAttribute("sandbox")).toBe("allow-same-origin");
      // Setas trocam o modelo (Segmentado) e o título do quadro acompanha.
      const marcado = secao?.querySelector(
        "[role='radio'][aria-checked='true']",
      );
      if (!marcado) throw new Error("sem opção marcada");
      await teclar(marcado, "ArrowRight");
      expect(iframe?.getAttribute("title")).toContain("eliminado");
      expect(previa()).toContain('data-modelo="ELIMINADO"');
    });
  });

  describe("editor do espelho: teclado e foco", () => {
    it("Ctrl+S salva quando há mudança válida", async () => {
      const rpc = rpcFalso();
      await montar(rpc);
      const titulo = campo("titulo");
      await teclar(titulo, "s", { ctrlKey: true });
      expect(rpc).toHaveBeenCalledTimes(1); // nada mudou: não salva
      expect(document.body.textContent).toContain("Textos padrão");

      await digitar(titulo, "Espelho fictício");
      expect(document.body.textContent).toContain("Alterações não salvas");
      await teclar(titulo, "s", { ctrlKey: true });
      await esperar();
      expect(rpc).toHaveBeenLastCalledWith("salvar_modelo_espelho_nota", {
        p_edital: "e900",
        p_textos: { titulo: "Espelho fictício" },
        p_versao_atual: 4,
      });
      expect(document.body.textContent).toContain("Modelo salvo (versão 5)");
    });

    it("Inserir {candidato} põe o marcador onde está o cursor", async () => {
      await montar(rpcFalso());
      const saudacao = campo("saudacao");
      await digitar(saudacao, "Olá, !");
      saudacao.setSelectionRange(5, 5);
      await clicar(botao("inserir-candidato-saudacao"));
      expect(saudacao.value).toBe("Olá, {candidato}!");
      expect(previa()).toContain(
        "Olá, <strong>Maria Exemplo da Silva</strong>!",
      );
      expect(botao("inserir-candidato-titulo")).toBeNull();
    });

    it("o resumo de erros leva o foco ao primeiro campo inválido", async () => {
      await montar(rpcFalso());
      await digitar(campo("secao_notas"), "");
      await digitar(campo("titulo"), "");
      const ir = botao("modelo-espelho-ir-ao-erro");
      expect(ir?.textContent).toContain("2 campos com erro");
      expect(botao("modelo-espelho-salvar")?.disabled).toBe(true);
      await clicar(ir);
      expect(document.activeElement).toBe(campo("titulo"));
      expect(campo("titulo").getAttribute("aria-invalid")).toBe("true");
    });

    it("Imprimir exemplo manda a folha da prévia para a impressão", async () => {
      const imprimir = vi.fn();
      await montar(rpcFalso(), imprimir);
      await clicar(botao("modelo-espelho-imprimir"));
      expect(imprimir).toHaveBeenCalledWith(previa());
      expect(imprimir.mock.calls[0]?.[0]).toContain("@page { size: A4;");
    });

    it("quem não coordena só lê: campos travados, sem salvar nem inserir", async () => {
      await montar(rpcFalso({ podeEditar: false }));
      expect(campo("titulo").disabled).toBe(true);
      expect(botao("modelo-espelho-salvar")).toBeNull();
      expect(botao("inserir-candidato-saudacao")).toBeNull();
      expect(document.body.textContent).toContain("Somente leitura");
    });
  });

  describe("editor do espelho: CSS responsivo e só com tokens", () => {
    const css = readFileSync(
      "src/modulos/avaliacao-documental/espelho-editor.css",
      "utf8",
    ).replace(/\/\*[\s\S]*?\*\//g, "");

    it("duas colunas na tela larga, uma na estreita, prévia fixa ao rolar", () => {
      expect(css).toMatch(
        /@media \(min-width: 1000px\) \{\s*\.avd-modelo-espelho-corpo \{\s*grid-template-columns: minmax\(320px, 5fr\) minmax\(0, 7fr\);/,
      );
      expect(css).toMatch(
        /\.avd-modelo-espelho-corpo \{[^}]*grid-template-columns: minmax\(0, 1fr\);/,
      );
      expect(css).toContain("position: sticky;");
      expect(css).toContain("@container (max-width: 640px)");
    });

    it("cores só por token (tema escuro), foco visível e sem !important nem #id", () => {
      expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
      expect(css).not.toContain("!important");
      expect(css).not.toMatch(/(^|[\s,{])#[a-z]/im);
      expect(css).toContain("outline: 2px solid var(--focus-ring)");
      expect(css).toContain("prefers-reduced-motion: no-preference");
    });

    it("o CSS do editor mora num lugar só", () => {
      const daTela = readFileSync(
        "src/modulos/avaliacao-documental/avaliacao-documental.css",
        "utf8",
      );
      expect(daTela).not.toContain(".avd-modelo-espelho");
    });
  });
});

bloco("modulos/avaliacao-documental-fundamentos-da-eliminacao", () => {
  /*
  Quadro "Fundamento das eliminações" (aba Eliminados da Triagem, issue #593):
  quem pode conferir (o banco diz, pode_conferir) vê o botão; o formulário começa
  vazio (nada presumido), avisa e exige justificativa para o item da nota mínima
  do lote, e grava por conferir_fundamento_da_eliminacao. Dados fictícios.
*/

  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  const EDITAL = "aaaaaaaa-0000-4000-8000-000000000001";

  const quadro = (podeConferir: boolean) => ({
    pode_conferir: podeConferir,
    regra: { versao: 2, situacao: "CONFERIDA", item_da_nota: "8.2.6" },
    motivos: [
      {
        codigo: "QUESTIONARIO",
        motivo: "Não finalizou o questionário",
        item_na_regra: "8.2.6",
        eliminados: 3,
        fundamento: null,
      },
      {
        codigo: "CANCELADO",
        motivo: "Cancelou a inscrição",
        item_na_regra: null,
        eliminados: 1,
        fundamento: {
          situacao: "CONFERIDO",
          item_edital: "6.4",
          versao_regra: 2,
          fonte: "Edital nº 1/2099 publicado",
        },
      },
    ],
    fora_da_regra: [],
    fora_do_lote_por_nota: 5,
    historico: [],
  });

  let raiz: Root | undefined;
  let caixa: HTMLDivElement | undefined;
  afterEach(async () => {
    await act(async () => raiz?.unmount());
    caixa?.remove();
    document.body.innerHTML = "";
  });

  async function montar(podeConferir: boolean, rpc = vi.fn()) {
    rpc.mockImplementation(async (nome: string) =>
      nome === "obter_fundamentos_da_eliminacao"
        ? quadro(podeConferir)
        : { ok: true },
    );
    caixa = document.createElement("div");
    document.body.append(caixa);
    raiz = createRoot(caixa);
    await act(async () =>
      raiz!.render(
        createElement(FundamentosDaEliminacao, {
          pre: { rpc },
          editalId: EDITAL,
          leitura: "1",
        }),
      ),
    );
    return rpc;
  }

  describe("Fundamento das eliminações", () => {
    it("mostra o fundamento de cada motivo e quem ficou fora do lote pela nota, sem botão para quem não pode", async () => {
      await montar(false);
      const linhas = [...document.querySelectorAll("tr[data-motivo]")].map(
        (tr) => tr.textContent,
      );
      expect(linhas[0]).toContain("Sem fundamento conferido");
      expect(linhas[1]).toContain("Item 6.4 · regra v2");
      expect(
        document.querySelector('[data-acao="fora-do-lote-por-nota"]')
          ?.textContent,
      ).toMatch(/5 inscrito\(s\) fora do lote pela nota: não são eliminados/);
      expect(
        document.querySelector('[data-acao="conferir-fundamento"]'),
      ).toBeNull();
    });

    it("o formulário começa vazio e o item da nota exige justificativa antes de gravar", async () => {
      const rpc = await montar(true);
      await clicar(
        document.querySelector(
          'tr[data-motivo="QUESTIONARIO"] [data-acao="conferir-fundamento"]',
        ),
      );
      const item = document.querySelector<HTMLInputElement>(
        '[data-acao="fundamento-item"]',
      );
      expect(item?.value).toBe(""); // a regra cita 8.2.6, mas nada vem preenchido
      await digitar(item, "8.2.6");
      await digitar(
        document.querySelector('[data-acao="fundamento-fonte"]'),
        "Edital nº 1/2099 publicado",
      );
      expect(document.body.textContent).toContain(
        "O item 8.2.6 é o da nota mínima do lote",
      );
      await clicar(document.querySelector('[data-acao="gravar-fundamento"]'));
      expect(rpc).not.toHaveBeenCalledWith(
        "conferir_fundamento_da_eliminacao",
        expect.anything(),
      );

      await digitar(item, "6.3");
      await clicar(document.querySelector('[data-acao="gravar-fundamento"]'));
      expect(rpc).toHaveBeenCalledWith("conferir_fundamento_da_eliminacao", {
        p_edital: EDITAL,
        p_motivo: "QUESTIONARIO",
        p_versao_regra: 2,
        p_item_edital: "6.3",
        p_fonte: "Edital nº 1/2099 publicado",
        p_justificativa: null,
      });
      // Releu o quadro depois de gravar.
      expect(
        rpc.mock.calls.filter(
          ([nome]) => nome === "obter_fundamentos_da_eliminacao",
        ),
      ).toHaveLength(2);
    });

    it("banco sem a migration: sem quadro e sem erro na tela", async () => {
      const rpc = vi.fn(async () => {
        throw Object.assign(new Error("função ausente"), { code: "PGRST202" });
      });
      caixa = document.createElement("div");
      document.body.append(caixa);
      raiz = createRoot(caixa);
      await act(async () =>
        raiz!.render(
          createElement(FundamentosDaEliminacao, {
            pre: { rpc },
            editalId: EDITAL,
            leitura: "1",
          }),
        ),
      );
      expect(caixa.textContent).toBe("");
    });
  });
});

bloco("componentes/resumo-do-dia", () => {
  /*
  O sininho do topo e o popup do resumo do dia (20261104130000). "Agora" é
  15/09/2026 às 10h de Brasília (13h UTC): "Bom dia".
*/
  const AGORA = new Date("2026-09-15T13:00:00Z");

  const item = (campos: Record<string, unknown>) => ({
    tipo: "etapa",
    edital_id: "e1",
    edital: "10/2026",
    unidade: "DSEI Manaus",
    area: "saude-indigena",
    data_inicio: "2026-09-15",
    data_fim: "2026-09-15",
    marco: "dia_unico",
    data: "2026-09-15",
    pode_concluir: false,
    ...campos,
  });

  const RESUMO = {
    data: "2026-09-15",
    perfil: "p1",
    nome: "Ana Maria Souza",
    responsavel: true,
    editais: ["e1"],
    demandas: ["d1"],
    mostrar_ao_entrar: true,
    hoje: [item({ id: "c1", titulo: "Entrevistas", marco: "fim" })],
    proximos: Array.from({ length: 7 }, (_, i) =>
      item({
        id: `c${i + 2}`,
        titulo: `Inscrições ${i + 1}`,
        marco: "inicio",
        data: `2026-09-${16 + i}`,
      }),
    ),
    atrasadas: [
      item({
        tipo: "demanda",
        id: "d1",
        titulo: "Relatório mensal",
        edital_id: null,
        edital: null,
        unidade: null,
        data_inicio: "2026-09-08",
        data_fim: "2026-09-10",
        marco: "fim",
        data: "2026-09-10",
        pode_concluir: true,
      }),
    ],
  };

  function cliente(resumo = RESUMO) {
    return {
      rpc: vi.fn(
        async (
          nome: string,
          argumentos?: {
            p_id?: string;
            p_mostrar?: boolean;
            p_concluida?: boolean;
          },
        ) => {
          if (nome === "obter_meu_resumo_do_dia")
            return { data: resumo, error: null };
          if (nome === "concluir_demanda_interna")
            return { data: { id: definido(argumentos).p_id }, error: null };
          if (nome === "salvar_minha_preferencia_do_resumo")
            return {
              data: { mostrar_ao_entrar: definido(argumentos).p_mostrar },
              error: null,
            };
          return { data: null, error: { code: "PGRST202" } };
        },
      ),
    };
  }

  /* O localStorage de mentira (Storage completo), com o mapa à vista do teste. */
  function armazenamentoFalso(): Storage & { mapa: Map<string, string> } {
    const mapa = new Map<string, string>();
    return {
      get length() {
        return mapa.size;
      },
      key: (indice: number) => [...mapa.keys()][indice] ?? null,
      getItem: (chave: string) => mapa.get(chave) ?? null,
      setItem: (chave: string, valor: string) => {
        mapa.set(chave, String(valor));
      },
      removeItem: (chave: string) => {
        mapa.delete(chave);
      },
      clear: () => mapa.clear(),
      mapa,
    };
  }

  const $ = (id: string) => document.getElementById(id);
  let desmontar = () => {};
  afterEach(() => desmontar());

  async function entrar({
    resumo = RESUMO,
    armazenamento = armazenamentoFalso(),
    livre = true,
  } = {}) {
    const supabase = cliente(resumo);
    const estado = criarEstadoDoResumoDoDia({
      cliente: () => supabase,
      armazenamento: () => armazenamento,
      podeAbrirSozinho: () => livre,
    });
    const janela = { navigate: vi.fn() };
    document.body.innerHTML = `<div id="topo"></div>`;
    await act(async () => {
      ({ desmontar } = desenharNoTeste(
        $("topo"),
        createElement(SininhoDoResumo, { estado, agora: () => AGORA, janela }),
      ));
    });
    await esperar(() => estado.verificar({ aoEntrar: true }));
    return { estado, supabase, armazenamento, janela };
  }

  describe("resumo do dia do responsável", () => {
    it("abre no primeiro acesso: saudação, três blocos, cor do tipo e 'e mais N'", async () => {
      await entrar();
      expect($("resumoDoDia")).not.toBeNull();
      expect($("resumoDoDia")?.querySelector("h3")?.textContent).toBe(
        "Bom dia, Ana — seus editais hoje",
      );
      const blocos = [
        ...document.querySelectorAll<HTMLElement>(".resumo-bloco"),
      ];
      expect(blocos.map((bloco) => bloco.dataset.bloco)).toEqual([
        "hoje",
        "proximos",
        "atrasadas",
      ]);
      const proximos = definido(blocos[1]);
      expect(proximos.querySelectorAll(".resumo-item")).toHaveLength(5);
      expect(proximos.querySelector(".resumo-mais")?.textContent).toBe(
        "e mais 2",
      );
      // "Entrevistas": a cor das entrevistas no Cronograma.
      expect(
        blocos[0]?.querySelector<HTMLElement>(".resumo-item")?.dataset.cor,
      ).toBe("violeta-claro");
      expect(blocos[0]?.textContent).toContain("10/2026 · DSEI Manaus");
      expect(blocos[0]?.textContent).toContain("termina 15/09");
      const atrasada = blocos[2]?.querySelector<HTMLElement>(".resumo-item");
      expect(atrasada?.dataset.cor).toBe("demanda");
      expect(atrasada?.textContent).toContain("venceu 10/09");
      expect($("resumoDoDiaSininho")?.getAttribute("aria-label")).toBe(
        "Resumo do dia: 9 pendências",
      );
      expect($("resumoDoDiaSininho")?.textContent).toBe("9");
    });

    it("Fechar não deixa voltar sozinho no mesmo dia; o sininho reabre", async () => {
      const armazenamento = armazenamentoFalso();
      await entrar({ armazenamento });
      await clicar($("resumoFechar"));
      expect($("resumoDoDia")).toBeNull();
      expect(
        armazenamento.mapa.get("agsus:resumo-do-dia:visto:p1:2026-09-15"),
      ).toBe("1");
      desmontar();

      // Nova entrada no mesmo dia, mesmo navegador: não abre sozinho.
      const { supabase } = await entrar({ armazenamento });
      expect($("resumoDoDia")).toBeNull();
      await clicar($("resumoDoDiaSininho"));
      expect($("resumoDoDia")).not.toBeNull();
      // Uma chamada ao entrar e outra ao abrir pelo sininho; sem polling.
      expect(supabase.rpc).toHaveBeenCalledTimes(2);
    });

    it("sem pendência não abre; sem ser responsável, nem sininho", async () => {
      await entrar({
        resumo: { ...RESUMO, hoje: [], proximos: [], atrasadas: [] },
      });
      expect($("resumoDoDia")).toBeNull();
      expect($("resumoDoDiaSininho")?.getAttribute("aria-label")).toBe(
        "Resumo do dia",
      );
      desmontar();

      await entrar({ resumo: { ...RESUMO, responsavel: false } });
      expect($("resumoDoDiaSininho")).toBeNull();
      expect($("resumoDoDia")).toBeNull();
    });

    it("preferência desligada: só o sininho; a caixa grava a preferência", async () => {
      const { supabase } = await entrar({
        resumo: { ...RESUMO, mostrar_ao_entrar: false },
      });
      expect($("resumoDoDia")).toBeNull();
      await clicar($("resumoDoDiaSininho"));
      expect(
        document.querySelector<HTMLInputElement>("#resumoMostrarAoEntrar")
          ?.checked,
      ).toBe(false);
      await clicar($("resumoMostrarAoEntrar"));
      expect(
        supabase.rpc.mock.calls.find(
          ([nome]) => nome === "salvar_minha_preferencia_do_resumo",
        )?.[1],
      ).toEqual({ p_mostrar: true });
    });

    it("com a tela ocupada (modal aberto ou digitação) não abre sozinho", async () => {
      await entrar({ livre: false });
      expect($("resumoDoDia")).toBeNull();
      expect($("resumoDoDiaSininho")).not.toBeNull();
    });

    it("Concluir na demanda atrasada grava, tira da lista e avisa o Cronograma", async () => {
      const ouvinte = vi.fn();
      document.addEventListener("agsus:nucleo-cronograma-saved", ouvinte);
      const { supabase } = await entrar();
      await clicar(document.querySelector('[data-concluir="d1"]'));
      expect(
        supabase.rpc.mock.calls.find(
          ([nome]) => nome === "concluir_demanda_interna",
        )?.[1],
      ).toEqual({ p_id: "d1", p_concluida: true });
      expect(document.querySelector('[data-bloco="atrasadas"]')).toBeNull();
      expect(ouvinte).toHaveBeenCalledTimes(1);
      expect($("resumoDoDiaSininho")?.textContent).toBe("8");
      document.removeEventListener("agsus:nucleo-cronograma-saved", ouvinte);
    });

    it("Ver no cronograma fecha e abre o Cronograma só com os da pessoa", async () => {
      const { janela } = await entrar();
      await clicar($("resumoVerNoCronograma"));
      expect($("resumoDoDia")).toBeNull();
      expect(janela.navigate).toHaveBeenCalledWith("calendario", {
        visao: "meus",
      });
    });

    it("banco sem a RPC: nada aparece", async () => {
      const estado = criarEstadoDoResumoDoDia({
        cliente: () => ({
          rpc: vi.fn(async () => ({ data: null, error: { code: "PGRST202" } })),
        }),
        armazenamento: () => armazenamentoFalso(),
        podeAbrirSozinho: () => true,
      });
      document.body.innerHTML = `<div id="topo"></div>`;
      await act(async () => {
        ({ desmontar } = desenharNoTeste(
          $("topo"),
          createElement(SininhoDoResumo, { estado }),
        ));
      });
      await esperar(() => estado.verificar({ aoEntrar: true }));
      expect($("resumoDoDiaSininho")).toBeNull();
    });
  });
});

bloco("componentes/edital-critico", () => {
  /*
  Edital crítico marcado à mão (20261110150000): gestor, coordenador ou
  administrador global marca o edital como crítico, com motivo; a Visão geral
    conta somente a marcação manual. Quem pode marcar o banco
  decide (`pode_marcar`).
*/

  const HOJE = "2026-11-10";
  const aberto = (extra: Record<string, unknown> = {}) => ({
    id: "e1",
    status: "Em andamento",
    etapa: "Entrevistas",
    inscritos: 100,
    vagas_total: 10,
    contratados: 0,
    data_fim: "2026-12-01",
    ...extra,
  });

  describe("a regra: marcação manual conta como crítico", () => {
    it("edital sem motivo automático fica crítico só pela marcação, com quem marcou", () => {
      expect(motivosDeAtencao(aberto(), { hoje: HOJE })).toEqual([]);
      const motivos = motivosDeAtencao(aberto(), {
        hoje: HOJE,
        marcacao: { motivo: "Banca sem quórum", quem: "Ana Souza" },
      });
      expect(motivos).toEqual([
        {
          codigo: "marcado",
          rotulo: "Marcado como crítico por Ana Souza: Banca sem quórum",
          tom: "perigo",
        },
      ]);
    });

    it("somente a marcação manual torna o processo crítico", () => {
      const codigos = motivosDeAtencao(aberto({ data_fim: "2026-11-01" }), {
        hoje: HOJE,
        marcacao: { motivo: "Banca sem quórum" },
      }).map((m) => m.codigo);
      expect(codigos).toEqual(["marcado"]);
    });

    it("edital concluído marcado também é crítico; cancelado nunca", () => {
      const concluido = aberto({ status: "Concluído", contratados: 10 });
      expect(
        motivosDeAtencao(concluido, {
          hoje: HOJE,
          marcacao: { motivo: "Contratação judicializada" },
        }).map((m) => m.codigo),
      ).toEqual(["marcado"]);
      expect(
        motivosDeAtencao(aberto({ status: "Cancelado" }), {
          hoje: HOJE,
          marcacao: { motivo: "Qualquer motivo" },
        }),
      ).toEqual([]);
    });

    it("o motivo segue a regra do banco: 10 a 500 caracteres e 2 palavras", () => {
      expect(erroDoMotivoDoCritico("curto")).toMatch(/10 a 500/);
      expect(erroDoMotivoDoCritico("x".repeat(501))).toMatch(/10 a 500/);
      expect(erroDoMotivoDoCritico("aaaaaaaaaaaa")).toMatch(/2 palavras/);
      expect(erroDoMotivoDoCritico("Banca sem quórum")).toBe("");
    });
  });

  describe("a Visão geral lê a marcação junto com o acompanhamento", () => {
    it("criticos_manuais vira a marcação de cada edital", () => {
      const acompanhamento = acompanhamentoDaResposta({
        etapas: [],
        listas: [],
        criticos_manuais: [
          {
            monitoramento_id: "e1",
            motivo: "Banca sem quórum",
            quem: "Ana Souza",
            quando: "2026-11-10T13:00:00Z",
          },
          { monitoramento_id: "e2", motivo: "" },
        ],
      });
      const [e1, e2] = enriquecerLinhas([aberto(), aberto({ id: "e2" })], {
        hoje: HOJE,
        acompanhamento,
      });
      expect(e1?.atencao.map((m) => m.codigo)).toEqual(["marcado"]);
      expect(e2?.atencao).toEqual([]);
    });

    function cliente(criticos: { data: unknown; error: unknown }) {
      const rpc = vi.fn(async (nome: string, _parametros?: object) =>
        nome === RPC_ACOMPANHAMENTO
          ? { data: { versao: "v1", etapas: [], listas: [] }, error: null }
          : criticos,
      );
      // Uma função com parâmetros mais largos serve às duas assinaturas do cliente.
      const supabase: ClienteDoAcompanhamento = { rpc };
      return { supabase, rpc };
    }

    it("busca as duas leituras da área e junta a marcação ao pacote", async () => {
      const { supabase, rpc } = cliente({
        data: [{ monitoramento_id: "e1", motivo: "Banca sem quórum" }],
        error: null,
      });
      const pacote = await buscarAcompanhamentoNoSupabase(supabase)("projetos");
      expect(rpc).toHaveBeenCalledWith(RPC_CRITICOS_MANUAIS, {
        p_area: "projetos",
      });
      expect(pacote).toMatchObject({
        versao: "v1",
        criticos_manuais: [{ monitoramento_id: "e1" }],
      });
    });

    it("sem mudança, o mesmo objeto; marcação nova, objeto novo", async () => {
      let marcados: unknown[] = [];
      // O primeiro acompanhamento vem inteiro; os seguintes, inalterados.
      let primeiraLeitura = true;
      const rpc = vi.fn(
        async (
          nome: string,
          _parametros?: object,
        ): Promise<{ data: unknown; error: unknown }> => {
          if (nome !== RPC_ACOMPANHAMENTO)
            return { data: marcados, error: null };
          if (primeiraLeitura) {
            primeiraLeitura = false;
            return {
              data: { versao: "v1", etapas: [], listas: [] },
              error: null,
            };
          }
          return { data: { inalterado: true, versao: "v1" }, error: null };
        },
      );
      const supabase: ClienteDoAcompanhamento = { rpc };
      const buscar = buscarAcompanhamentoNoSupabase(supabase);
      const primeiro = await buscar("area-da-marcacao");
      expect(await buscar("area-da-marcacao")).toBe(primeiro);
      marcados = [{ monitoramento_id: "e1", motivo: "Banca sem quórum" }];
      const depois = await buscar("area-da-marcacao");
      expect(depois).not.toBe(primeiro);
      expect(depois).toMatchObject({ criticos_manuais: marcados });
    });

    it("se a leitura da marcação falhar, a Visão geral segue sem ela", async () => {
      const { supabase } = cliente({ data: null, error: { code: "PGRST202" } });
      const pacote = await buscarAcompanhamentoNoSupabase(supabase)("sede");
      expect(pacote).toMatchObject({ versao: "v1", criticos_manuais: [] });
    });
  });

  describe("o bloco Edital crítico no formulário do edital", () => {
    function clienteDoCritico(inicial: Record<string, unknown>) {
      let estado = { ...inicial };
      const rpc = vi.fn(
        async (
          nome: string,
          argumentos: {
            p_edital?: string;
            p_critico?: boolean;
            p_motivo?: string;
          } = {},
        ) => {
          if (nome === "obter_critico_do_edital")
            return { data: estado, error: null };
          if (nome === "marcar_edital_critico") {
            estado = argumentos.p_critico
              ? {
                  ...estado,
                  marcado: true,
                  motivo: argumentos.p_motivo,
                  quem: "Ana Souza",
                  quando: "2026-11-10T13:00:00Z",
                }
              : { ...estado, marcado: false, motivo: null, quem: null };
            return { data: estado, error: null };
          }
          return { data: null, error: { code: "PGRST202" } };
        },
      );
      const cliente: ClienteDoCritico = { rpc };
      return Object.assign(cliente, { rpc });
    }

    let desmontar = () => {};
    afterEach(() => desmontar());
    const $ = (id: string) => document.getElementById(id);

    async function desenhar(supabase: ClienteDoCritico) {
      document.body.innerHTML = `<div id="raiz"></div>`;
      await act(async () => {
        ({ desmontar } = desenharNoTeste(
          $("raiz"),
          createElement(CriticoDoEdital, { editalId: "e1", supabase }),
        ));
      });
      await esperar();
    }

    it("quem não pode marcar e o edital não está marcado: o bloco não aparece", async () => {
      await desenhar(clienteDoCritico({ marcado: false, pode_marcar: false }));
      expect($("editalCritico")).toBeNull();
    });

    it("quem não pode marcar lê a marcação, sem botões", async () => {
      await desenhar(
        clienteDoCritico({
          marcado: true,
          motivo: "Banca sem quórum",
          quem: "Ana Souza",
          quando: "2026-11-10T13:00:00Z",
          pode_marcar: false,
        }),
      );
      expect($("editalCriticoMarcado")?.textContent).toBe(
        "Marcado como crítico por Ana Souza em 10/11/2026: Banca sem quórum",
      );
      expect($("editalCriticoMarcar")).toBeNull();
    });

    it("gestor marca com motivo; sem motivo válido, não grava", async () => {
      const supabase = clienteDoCritico({ marcado: false, pode_marcar: true });
      await desenhar(supabase);
      await clicar($("editalCriticoMarcar"));
      expect(
        supabase.rpc.mock.calls.filter(
          ([nome]) => nome === "marcar_edital_critico",
        ),
      ).toHaveLength(0);
      expect($("editalCritico")?.textContent).toMatch(/10 a 500/);

      await digitar($("editalCriticoMotivo"), "Banca sem quórum");
      await clicar($("editalCriticoMarcar"));
      await esperar();
      expect(supabase.rpc).toHaveBeenCalledWith("marcar_edital_critico", {
        p_edital: "e1",
        p_critico: true,
        p_motivo: "Banca sem quórum",
      });
      expect($("editalCriticoMarcado")?.textContent).toContain(
        "Banca sem quórum",
      );
      expect($("editalCriticoDesmarcar")).not.toBeNull();
    });

    it("desmarcar também pede motivo", async () => {
      const supabase = clienteDoCritico({
        marcado: true,
        motivo: "Banca sem quórum",
        pode_marcar: true,
      });
      await desenhar(supabase);
      await digitar(
        $("editalCriticoMotivo"),
        "Banca recomposta pela coordenação",
      );
      await clicar($("editalCriticoDesmarcar"));
      await esperar();
      expect(supabase.rpc).toHaveBeenCalledWith("marcar_edital_critico", {
        p_edital: "e1",
        p_critico: false,
        p_motivo: "Banca recomposta pela coordenação",
      });
      expect($("editalCriticoMarcado")).toBeNull();
    });

    it("a leitura do banco aceita campos ausentes", () => {
      expect(lerCriticoDoEdital(null)).toEqual({
        marcado: false,
        motivo: "",
        quem: "",
        quando: "",
        podeMarcar: false,
      });
    });
  });
});

bloco("modules/visao-geral-por-area", () => {
  /*
  Saúde Indígena, SEDE e Projetos abrem a mesma Visão geral (#page-dashboard,
  React em src/modulos/visao-geral/). O mapa é da área e é React: o da Saúde
  Indígena em src/modulos/mapa-saude-indigena/, o de Projetos em
  src/modulos/mapa-de-projetos/ (o componente é testado em
  tests/mapas-e-visao-geral-na-tela.test.js (bloco modulos/mapa-de-projetos)), e a SEDE não tem. Aqui, o que o
  legado ainda faz por área e o que saiu dele.
*/

  const indexHtml = htmlDaPagina();
  const legado = fonteDoApp();

  describe("a Visão geral não tem mapa legado", () => {
    it("o index.html não tem o bloco do mapa nem a reserva", () => {
      for (const id of [
        "mapaDaVisaoGeral",
        "reservaDoMapaDaVisaoGeral",
        "mapaDosProjetos",
        "mapaDosProjetosBrasil",
        "brasilDseiList",
        "brasilDseiCount",
        "masterMapCount",
      ])
        expect(indexHtml, id).not.toContain(`id="${id}"`);
      expect(indexHtml).not.toContain("health-map-");
      expect(indexHtml).toMatch(
        /<section id="page-dashboard" class="page active"><\/section>/,
      );
    });

    /*
    As camadas de Terras Indígenas e Mapa/Satélite enfeitam os mapas com id
    `map`/`detailMap`: esses ids são do mapa da Saúde Indígena (React). Dois
    na página quebrariam as camadas.
  */
    it("não usa os ids do mapa da Saúde Indígena", () => {
      expect(indexHtml).not.toContain('id="map"');
      expect(indexHtml).not.toContain('id="detailMap"');
    });

    it("o módulo e o CSS do mapa legado saíram", () => {
      const main = readFileSync("src/main.ts", "utf8");
      expect(main).not.toContain("health-map-workspace.css");
      expect(main).not.toContain("health-reference-kpis.css");
      expect(main).toContain("./modulos/mapa-de-projetos/mapa-de-projetos.css");
      for (const css of ["src/styles/app.css", "src/styles/mobile-app.css"])
        expect(readFileSync(css, "utf8"), css).not.toContain(
          "#mapaDosProjetos",
        );
    });
  });

  describe("o legado usa a área atual", () => {
    it("filtros, KPIs, mapa e tabela partem dos editais da área atual", () => {
      // O recorte é do estado da Visão geral (React); os mapas leem dele.
      const estado = readFileSync("src/modulos/visao-geral/estado.ts", "utf8");
      expect(estado).toContain(
        "linhasDaArea(linhasDaResposta(linhas), areaAtual)",
      );
      expect(legado).not.toMatch(/rows\.filter\(ehEditalDaSaudeIndigena\)/);
    });

    it("o legado não tem mais mapa: os dois são React", () => {
      for (const removido of [
        "renderMap",
        "desenharMunicipiosNoMapa",
        "scheduleMapResize",
        "criarCarregadorDeMunicipios",
        "municipios-da-visao-geral",
        "mapaDosProjetos",
        "MAPA_DOS_MUNICIPIOS",
        "initLeaflet",
        "drawDSEIBubbles",
        "drawCasai",
        "renderDetailMap",
        "detailRecordsForDsei",
        "drawPolos",
        "drawRedeAssistencial",
        "__agsusSuspenderCamadasIndigenas",
        "ligarMapa",
      ])
        expect(legado, removido).not.toContain(removido);
    });

    it("trocar de área refaz o cabeçalho (o mapa é do estado da Visão geral)", () => {
      // A navegação (src/app/navegacao.ts; comportamento em tests/casca-sessao-e-interface-na-tela.test.ts (bloco app/navegacao)).
      const navegacao = readFileSync("src/app/navegacao.ts", "utf8");
      const troca = navegacao.slice(
        navegacao.indexOf("function acompanharArea"),
      );
      expect(troca).toContain("assinarDadosDoMonitoramento(");
      // O DSEI aberto e os filtros são do estado da Visão geral, que ouve os mesmos dados.
      expect(troca).toContain("tituloDaVisaoGeral();");
      expect(troca).not.toContain("renderMap");
    });

    it("os dados do mapa da Saúde Indígena vão para o estado da Visão geral", () => {
      const fonte = readFileSync("src/app/carga.ts", "utf8");
      const carga = fonte.slice(
        fonte.indexOf("async function carregarMapa"),
        fonte.indexOf("async function carregarLinhas"),
      );
      expect(carga).toContain("visaoGeral.definirDadosDoMapa(");
      expect(fonte).toContain("visaoGeral = estadoDaVisaoGeral");
    });

    it("as terras saem sem apagar a preferência da pessoa", () => {
      const camada = readFileSync(
        "src/modules/indigenous-territories-layer.ts",
        "utf8",
      );
      const inicio = camada.indexOf("map.__agsusSuspenderCamadasIndigenas =");
      const suspender = camada.slice(
        inicio,
        camada.indexOf("map.__agsusDefinirTerrasVisiveis", inicio),
      );
      expect(suspender).toContain("clearVector()");
      expect(suspender).toContain("renderDseiCoverage()");
      expect(suspender).not.toContain("storeVisibility");
      expect(camada).toMatch(
        /!suspensas &&\s+map\.__agsusIndigenousTerritoriesVisible/,
      );
      // Mapa removido (React desmonta) também não desenha nada que chegue depois.
      expect(camada).toMatch(/!removido &&\s+!suspensas/);
    });

    it("a view separada da SEDE e de Projetos saiu", () => {
      expect(legado).not.toContain("visao-area");
      expect(indexHtml).not.toContain("page-visao-area");
    });
  });
});

bloco("ui/contagem-da-aba", () => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;

  let raiz: Root | null = null;

  function montar(elemento: ReactElement) {
    const caixa = document.createElement("div");
    document.body.append(caixa);
    raiz = createRoot(caixa);
    act(() => raiz!.render(elemento));
    return caixa;
  }

  afterEach(() => {
    act(() => raiz?.unmount());
    raiz = null;
    document.body.innerHTML = "";
  });

  describe("formatarContagem", () => {
    it("milhar com ponto, texto como veio, nada no zero", () => {
      expect(formatarContagem(18325)).toBe("18.325");
      expect(formatarContagem(7)).toBe("7");
      expect(formatarContagem("3%")).toBe("3%");
      expect(formatarContagem(" 4/12 ")).toBe("4/12");
      expect(formatarContagem(0)).toBe("");
      expect(formatarContagem("0")).toBe("");
      expect(formatarContagem("")).toBe("");
      expect(formatarContagem(null)).toBe("");
      expect(formatarContagem(undefined)).toBe("");
      expect(formatarContagem(Number.NaN)).toBe("");
      expect(formatarContagem(0, true)).toBe("0");
    });
  });

  describe("ContagemDaAba", () => {
    it("desenha o número com o tom; some no zero", () => {
      const caixa = montar(
        h("div", null, [
          h(ContagemDaAba, { key: "a", valor: 18325, id: "alertas" }),
          h(ContagemDaAba, { key: "b", valor: 3, tom: "alerta", id: "pend" }),
          h(ContagemDaAba, { key: "c", valor: 0, id: "zero" }),
        ]),
      );
      const alertas = caixa.querySelector("#alertas")!;
      expect(alertas.textContent).toBe("18.325");
      expect(alertas.className).toBe("ui-aba-contagem");
      expect(alertas.getAttribute("data-tom")).toBe("neutro");
      expect(caixa.querySelector("#pend")!.getAttribute("data-tom")).toBe(
        "alerta",
      );
      expect(caixa.querySelector("#zero")).toBeNull();
    });
  });

  describe("contagem no rótulo", () => {
    it("Abas: o número entra no nome da aba", () => {
      const caixa = montar(
        h(Abas, {
          rotulo: "Visões",
          ativa: "alertas",
          aoEscolher: vi.fn(),
          abas: [
            { id: "alertas", rotulo: "Alertas", contagem: 18325 },
            { id: "cobertura", rotulo: "Cobertura", contagem: "3%" },
            { id: "vazia", rotulo: "Vazia", contagem: 0 },
          ],
        }),
      );
      const textos = [...caixa.querySelectorAll('[role="tab"]')].map(
        (aba) => aba.textContent,
      );
      expect(textos).toEqual(["Alertas18.325", "Cobertura3%", "Vazia"]);
      expect(caixa.querySelectorAll(".ui-aba-contagem")).toHaveLength(2);
    });

    it("Segmentado: a opção leva a contagem e o tom", () => {
      const caixa = montar(
        h(Segmentado, {
          rotulo: "Seções",
          valor: "fila",
          aoMudar: vi.fn(),
          opcoes: [
            { valor: "fila", rotulo: "Fila", contagem: 12 },
            {
              valor: "pendencias",
              rotulo: "Pendências",
              contagem: 2,
              tomDaContagem: "alerta",
            },
            { valor: "preparar", rotulo: "Preparar" },
          ],
        }),
      );
      const opcoes = caixa.querySelectorAll('[role="radio"]');
      expect(opcoes[0]!.textContent).toBe("Fila12");
      expect(
        opcoes[1]!.querySelector(".ui-aba-contagem")!.getAttribute("data-tom"),
      ).toBe("alerta");
      expect(opcoes[2]!.querySelector(".ui-aba-contagem")).toBeNull();
    });
  });
});

bloco("ui/selo-de-prazo", () => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;

  let raiz: Root | null = null;
  afterEach(() => {
    act(() => raiz?.unmount());
    raiz = null;
    document.body.innerHTML = "";
  });

  function selo(data: string | null) {
    const caixa = document.createElement("div");
    document.body.append(caixa);
    raiz = createRoot(caixa);
    act(() =>
      raiz!.render(
        h(SeloDePrazo, { data, hoje: "2026-11-18", diaFormatado: "dia" }),
      ),
    );
    return caixa.querySelector(".ui-selo-de-prazo");
  }

  describe("SeloDePrazo", () => {
    it.each([
      ["2026-11-15", "Venceu há 3 dias", "perigo", "vencido"],
      ["2026-11-18", "Vence hoje", "alerta", "ate-30"],
      ["2026-12-30", "Vence em 42 dias", "info", "ate-90"],
      ["2027-03-01", "Vence em 103 dias", "neutro", "ate-180"],
      ["2028-01-01", "Vence em 409 dias", "neutro", "depois"],
    ])("%s: %s", (data, texto, tom, faixa) => {
      const el = selo(data)!;
      expect(el.textContent).toBe(texto);
      expect(el.getAttribute("data-tom")).toBe(tom);
      expect(el.getAttribute("data-faixa")).toBe(faixa);
      expect(el.getAttribute("title")).toMatch(/dia$/);
    });

    it("sem data, nada", () => {
      expect(selo(null)).toBeNull();
    });
  });
});

bloco("componentes/barra-de-selecao", () => {
  const { act, createElement, useCallback, useMemo, useState } = reactDaBarraNs;
  const { alcanceDaSelecao, marcarPagina } = alcanceDaBarraNs;
  const TabelaInfinita = TabelaInfinitaDaBarra;
  /*
    A barra da seleção com a TabelaInfinita de verdade: a "página" são as 50
    linhas desenhadas (aoMostrar), e "todos os N resultados" é outro botão.
  */
  type Item = { id: string };
  const ITENS: Item[] = Array.from({ length: 120 }, (_, i) => ({
    id: `i${i}`,
  }));
  const semBusca = (itens: readonly Item[]) => itens;

  function Tela() {
    const [marcados, setMarcados] = useState<ReadonlySet<string>>(new Set());
    const [pagina, setPagina] = useState<readonly string[]>([]);
    const aoMostrar = useCallback(
      (visiveis: readonly Item[]) => setPagina(visiveis.map((i) => i.id)),
      [],
    );
    const recorte = useMemo(() => ITENS.map((i) => i.id), []);
    const alcance = alcanceDaSelecao(marcados, pagina, recorte);
    return createElement(
      "div",
      null,
      createElement(BarraDeSelecao, {
        alcance,
        nome: { singular: "item", plural: "itens" },
        rotulo: "Seleção de itens",
        aoMarcarPagina: (sim: boolean) =>
          setMarcados((m) => marcarPagina(m, pagina, sim)),
        aoMarcarTodos: () => setMarcados(new Set(recorte)),
        aoLimpar: () => setMarcados(new Set()),
        children: createElement(
          "button",
          { type: "button", "data-acao": "agir" },
          "Agir",
        ),
      }),
      createElement(TabelaInfinita<Item>, {
        idDoTitulo: "t",
        titulo: "Itens",
        colunas: [{ rotulo: "Id" }],
        informacao: () => "",
        vazio: "Nada",
        carregado: true,
        itens: ITENS,
        filtrarPelaBusca: semBusca,
        total: ITENS.length,
        aoMostrar,
        linha: (item: Item) =>
          createElement(
            "tr",
            { key: item.id },
            createElement("td", null, item.id),
          ),
      }),
    );
  }

  let desmontar = () => {};
  afterEach(() => {
    act(() => desmontar());
    document.body.innerHTML = "";
  });

  const achar = (seletor: string) => document.querySelector(seletor);
  const alcance = () => achar("[data-alcance-da-selecao]")?.textContent;

  describe("BarraDeSelecao com a TabelaInfinita", () => {
    it("separa esta página (50 desenhadas) de todos os 120 resultados", async () => {
      const raiz = document.createElement("div");
      document.body.append(raiz);
      act(() => {
        desmontar = desenharNoTeste(raiz, createElement(Tela)).desmontar;
      });
      const pagina = achar(
        '[data-acao="selecionar-pagina"]',
      ) as HTMLInputElement;
      expect(pagina.parentElement?.textContent).toBe(
        "Selecionar esta página (50)",
      );
      // Sem nada marcado, nenhuma ação.
      expect(achar('[data-acao="agir"]')).toBeNull();

      await clicar(pagina);
      expect(alcance()).toBe(
        "50 itens desta página selecionados (de 120 no resultado)",
      );
      const todos = achar(
        '[data-acao="selecionar-todos-os-resultados"]',
      ) as HTMLButtonElement;
      expect(todos.textContent).toBe("Selecionar todos os 120 resultados");
      expect(achar('[data-acao="agir"]')).not.toBeNull();

      await clicar(todos);
      expect(alcance()).toBe("Todos os 120 itens do resultado selecionados");
      expect(achar('[data-acao="selecionar-todos-os-resultados"]')).toBeNull();
      expect(achar("[data-alcance]")?.getAttribute("data-alcance")).toBe(
        "todos",
      );

      await clicar(achar('[data-acao="limpar-selecao"]') as HTMLButtonElement);
      expect(alcance()).toBe("");
      expect(pagina.checked).toBe(false);
    });
  });
});

bloco("ui/botoes-de-exportacao", () => {
  let raiz: Root | null = null;
  afterEach(() => {
    act(() => raiz?.unmount());
    raiz = null;
    document.body.innerHTML = "";
  });
  function montarBotoes(
    propriedades: ComponentProps<typeof BotoesDeExportacao>,
  ) {
    const caixa = document.createElement("div");
    document.body.append(caixa);
    raiz = createRoot(caixa);
    act(() => raiz!.render(h(BotoesDeExportacao, propriedades)));
    return caixa;
  }

  it("sempre os mesmos nomes, na mesma ordem; só aparece o que a tela passa", () => {
    const ambos = montarBotoes({ excel: vi.fn(), pdf: vi.fn() });
    expect(
      [...ambos.querySelectorAll("button")].map((b) => b.textContent?.trim()),
    ).toEqual(["Exportar em Excel", "Salvar em PDF"]);
    act(() => raiz!.render(h(BotoesDeExportacao, { excel: vi.fn() })));
    expect(
      [...ambos.querySelectorAll("button")].map((b) => b.dataset.acao),
    ).toEqual(["exportar-excel"]);
    act(() => raiz!.render(h(BotoesDeExportacao, {})));
    expect(ambos.querySelector(".ui-exportacao")).toBeNull();
  });

  it("enquanto gera: Gerando…, ocupado e os dois desativados", async () => {
    let terminar: () => void = () => {};
    const pdf = vi.fn(
      () => new Promise<void>((pronto) => (terminar = () => pronto())),
    );
    const caixa = montarBotoes({ excel: vi.fn(), pdf });
    const [excelBtn, pdfBtn] = [...caixa.querySelectorAll("button")];
    await clicar(definido(pdfBtn));
    expect(pdfBtn?.textContent?.trim()).toBe("Gerando…");
    expect(pdfBtn?.getAttribute("aria-busy")).toBe("true");
    expect(excelBtn?.disabled).toBe(true);
    await act(async () => terminar());
    expect(pdfBtn?.textContent?.trim()).toBe("Salvar em PDF");
    expect(excelBtn?.disabled).toBe(false);
    expect(pdf).toHaveBeenCalledTimes(1);
  });

  it("desativado: nenhum dos dois responde", () => {
    const excel = vi.fn();
    const caixa = montarBotoes({ excel, desativado: true });
    expect(caixa.querySelector("button")?.disabled).toBe(true);
  });
});
