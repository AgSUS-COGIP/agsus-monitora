// @vitest-environment jsdom
// Antes do react-dom: conta os desenhos de cada componente.
import { renders } from "./componentes/contar-renders.ts";
import { bloco } from "./apoio/bloco.ts";
import { describe, expect, it, afterEach, vi, beforeEach } from "vitest";
import {
  crc32,
  documentoXml,
  escaparXml,
  gerarDocx,
  linhasDoTexto,
  montarPaginaDeImpressao,
  nomeDoDocumento,
  zipSemCompressao,
} from "../src/lib/recursos/documento-da-resposta.ts";
import {
  cargoCurto,
  gravarPorVagaAberto,
  lerPorVagaAberto,
  ordenarPorVaga,
  resumoPorVaga,
} from "../src/lib/avaliacao-documental/andamento-por-vaga.ts";
import { readFileSync } from "node:fs";
import { act, createElement, createElement as h } from "react";
import { createRoot } from "react-dom/client";
import {
  errosDaRegraDaTriagem,
  obterRegraDaTriagem,
  resumoDaRegraDaTriagem,
  salvarRegraDaTriagem,
  textoDoLote,
} from "../src/lib/triagem/regra-da-triagem.ts";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.ts";
import { EditorDaRegraDaTriagem } from "../src/modulos/triagem/editor-da-regra.tsx";
import { abrirRegrasDoEdital } from "../src/modulos/regras-do-edital/abrir.ts";
import {
  chaveDoMarco,
  comemoracaoDasAnalises,
  comemoracaoDasEntrevistas,
  comemoracoesLigadasNaResposta,
  editaisConcluidos,
  estadoGuardadoDasVagas,
  estadoGuardadoDosEditais,
  filaZerou,
  formaDoMarco,
  marcoAlcancado,
  marcoNovo,
  mensagemDaFilaZerada,
  mensagemDaVagaPronta,
  mensagemDoEditalConcluido,
  mensagemDoMarcoDoAno,
  naArea,
  pendentesDaFila,
  proximoEstadoDoMarco,
  situacaoDasVagas,
  situacaoDosEditais,
  trocarEstadoGuardado,
} from "../src/lib/comemoracao/comemoracao.ts";
import { decididoNoPrazo } from "../src/lib/recursos/prazo-do-recurso.ts";
import { enriquecerRecurso } from "../src/lib/recursos/recursos-dos-candidatos.ts";
import { normalizarSituacaoDoSistema } from "../src/lib/navegacao/situacao-dos-modulos.ts";
import { filaDeComemoracoes } from "../src/app/fila-de-comemoracoes.ts";
import { comemoracoesNaPagina } from "./shows-de-comemoracao.js";
import {
  avaliarMarco,
  carregarComemoracao,
} from "../src/app/comemoracao-sob-demanda.ts";
import { avaliarMarcosDasAnalises } from "../src/modulos/analises/marcos.ts";
import { espelhoDaFichaGravada } from "../src/lib/avaliacao-documental/espelho-da-ficha-gravada.ts";
import {
  calcularFicha,
  declaradaDaFicha,
  regraDaFicha,
} from "../src/lib/avaliacao-documental/ficha.ts";
import {
  espelhoDoDetalhe,
  TEXTOS_DO_ESPELHO_NO_PAINEL,
} from "../src/lib/analises/espelho-do-painel-de-analises.ts";
import { mesclarDetalhe } from "../src/lib/analises/lista-do-painel-de-analises.ts";
import { GavetaDaAnalise } from "../src/modulos/analises/gaveta.tsx";
import {
  definirAreaAtual,
  redefinirDadosDoMonitoramento,
} from "../src/componentes/dados-do-monitoramento.ts";
import {
  coordenaOEdital,
  editalParaAbrir,
  lembrarEdital,
  lerEditalLembrado,
  visaoNaTela,
} from "../src/modulos/avaliacao-documental/abas-e-entrada.ts";
import { criarAvaliacaoDocumental } from "../src/modulos/avaliacao-documental/avaliacao-documental.tsx";
import { editalVigente } from "../src/lib/avaliacao-documental/editais.ts";
import {
  clicar,
  esperar,
  digitar,
  escolher,
  teclar,
} from "./componentes/interacoes.ts";
import { carregarCatalogoDeAbas } from "../src/modules/catalogo-de-abas.ts";
import { montarTela } from "./montar-tela.ts";
import { DiferencasPorCargo } from "../src/modulos/avaliacao-documental/assistente/diferencas-por-cargo.tsx";
import { validarRegraAnalise } from "../src/lib/avaliacao-documental/regra.ts";
import { concluidosDaFila } from "../src/lib/avaliacao-documental/documentos-em-lote.ts";
import { DocumentosEmLote } from "../src/modulos/avaliacao-documental/documentos-em-lote.tsx";
import { EspelhosEmMassa } from "../src/modulos/avaliacao-documental/espelhos-em-massa.tsx";
import {
  baixarEspelhoEmPdf,
  baixarZipDosEspelhos,
} from "../src/modulos/avaliacao-documental/ficha/espelho-de-nota.ts";
import { carregarBibliotecasDoPdf } from "../src/lib/avaliacao-documental/espelho-em-pdf.ts";
import { unzipSync } from "fflate";
import { criarEstadoDaFicha } from "../src/modulos/avaliacao-documental/ficha/estado-da-ficha.ts";
import { ItemDaFicha } from "../src/modulos/avaliacao-documental/ficha/item-da-ficha.tsx";
import {
  criarEstadoDaFila,
  INATIVIDADE_MAXIMA_MS,
  RENOVAR_A_CADA_MS,
} from "../src/modulos/avaliacao-documental/estado-da-fila.ts";
import { TEXTOS_PADRAO_DO_ESPELHO } from "../src/lib/avaliacao-documental/modelo-do-espelho.ts";
import { ModeloDoEspelhoDeNota } from "../src/modulos/avaliacao-documental/modelo-do-espelho.tsx";
import {
  mensagemDoErroDoModelo,
  textosParaOEspelho,
} from "../src/modulos/avaliacao-documental/modelo-do-espelho-no-banco.ts";
import { contadoresDaPreClassificacao } from "../src/lib/avaliacao-documental/tela-da-pre-classificacao.ts";
import { criarEstadoDaPreClassificacao } from "../src/modulos/avaliacao-documental/estado-da-pre-classificacao.ts";
import {
  linhasDaPreInteira,
  motivosDasLinhas,
  resumoDaPreInteira,
} from "../src/lib/avaliacao-documental/paginas-da-pre-classificacao.ts";
import { RelatorioDeMotivos } from "../src/modulos/avaliacao-documental/relatorio-de-motivos.tsx";
import { montarRegrasDoEdital } from "./componentes/montar-regras-do-edital.ts";
import { comecoDoEnunciado } from "../src/lib/avaliacao-documental/nota-declarada.ts";
import { registrarTelas } from "../src/app/registro-das-telas.ts";
import { Gaveta } from "../src/ui/index.ts";
import {
  CHAVE_DO_PROTOTIPO,
  SecaoMontarParecer,
} from "../src/modulos/recursos/parecer-em-blocos/secao-montar-parecer.tsx";
import { EditorDoParecer } from "../src/modulos/recursos/parecer-em-blocos/montar-parecer.tsx";
import { dadosFicticios } from "../src/modulos/recursos/parecer-em-blocos/dados-ficticios.ts";
import { linhasVisiveis } from "../src/modulos/recursos/parecer-em-blocos/simulador.ts";
import {
  comporParecer,
  linhasDeTexto,
  rascunhoInicial,
} from "../src/lib/recursos/parecer-em-blocos.ts";
import {
  agoraEmBrasilia,
  calcularRitmo,
  destaquesDoDia,
  MINIMO_DO_SELO,
  diasUteisAtePrazo,
  diaUtilDepois,
  domingoDePascoa,
  ehDiaUtil,
  etapaDaAnalise,
  lerRitmoDaAnalise,
  nomeCurtoDaEtapa,
  ritmosDaArea,
  fracaoDoExpediente,
  gravarRitmoRecolhido,
  lerRitmoRecolhido,
  noMomentoDoResumo,
  ritmoDoDia,
  seloDoCard,
  textoDeReferencia,
  textoDoDia,
  textoDoMomento,
  textoDoPrazo,
  textoRecolhido,
} from "../src/lib/analises/ritmo-da-analise.ts";

bloco("documento-da-resposta", () => {
  /*
  O documento da resposta sem dependência: o .docx é um ZIP "stored" com o
  mínimo do formato, e o texto entra escapado; a página de impressão é
  montada com textContent (nada de HTML vindo do texto).
*/

  /* Lê um ZIP sem compressão pelos cabeçalhos locais: nome → bytes. */
  function lerZip(bytes) {
    const vista = new DataView(
      bytes.buffer,
      bytes.byteOffset,
      bytes.byteLength,
    );
    const arquivos = new Map();
    let p = 0;
    while (vista.getUint32(p, true) === 0x04034b50) {
      expect(vista.getUint16(p + 8, true)).toBe(0); // stored
      const crc = vista.getUint32(p + 14, true);
      const tamanho = vista.getUint32(p + 18, true);
      const nomeTamanho = vista.getUint16(p + 26, true);
      const nome = new TextDecoder().decode(
        bytes.slice(p + 30, p + 30 + nomeTamanho),
      );
      const dados = bytes.slice(
        p + 30 + nomeTamanho,
        p + 30 + nomeTamanho + tamanho,
      );
      expect(crc32(dados)).toBe(crc);
      arquivos.set(nome, new TextDecoder().decode(dados));
      p += 30 + nomeTamanho + tamanho;
    }
    // Diretório central e fim do arquivo.
    expect(vista.getUint32(p, true)).toBe(0x02014b50);
    const fim = bytes.length - 22;
    expect(vista.getUint32(fim, true)).toBe(0x06054b50);
    expect(vista.getUint16(fim + 10, true)).toBe(arquivos.size);
    expect(vista.getUint32(fim + 16, true)).toBe(p);
    return arquivos;
  }

  describe("docx", () => {
    it("CRC-32 do padrão", () => {
      expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
    });

    it("tem as partes mínimas e o texto em parágrafos, título em negrito", () => {
      const bytes = gerarDocx("RESPOSTA A RECURSO\n\nPrezada Ana,\nDeferido.", {
        titulo: "Resposta ao recurso nº 7",
        quando: new Date(2026, 8, 29, 10, 30),
      });
      const partes = lerZip(bytes);
      expect([...partes.keys()]).toEqual([
        "[Content_Types].xml",
        "_rels/.rels",
        "docProps/core.xml",
        "word/document.xml",
      ]);
      const documento = partes.get("word/document.xml");
      expect(documento.match(/<w:p>|<w:p\/>/g)).toHaveLength(4);
      expect(documento).toContain(
        '<w:b/></w:rPr><w:t xml:space="preserve">RESPOSTA A RECURSO</w:t>',
      );
      expect(documento).toContain(">Prezada Ana,</w:t>");
      expect(partes.get("docProps/core.xml")).toContain(
        "<dc:title>Resposta ao recurso nº 7</dc:title>",
      );
      expect(partes.get("[Content_Types].xml")).toContain(
        'PartName="/word/document.xml"',
      );
    });

    it("escapa o texto para XML e tira caracteres de controle", () => {
      expect(escaparXml(`a & b < c > "d" 'e'\u0001`)).toBe(
        "a &amp; b &lt; c &gt; &quot;d&quot; &apos;e&apos;",
      );
      const xml = documentoXml("Título\n<script>alert(1)</script> & </w:t>");
      expect(xml).not.toContain("<script>");
      expect(xml).toContain(
        "&lt;script&gt;alert(1)&lt;/script&gt; &amp; &lt;/w:t&gt;",
      );
      // Continua um XML bem formado.
      const doc = new DOMParser().parseFromString(xml, "application/xml");
      expect(doc.getElementsByTagName("parsererror")).toHaveLength(0);
    });

    it("zip com nomes UTF-8 e conteúdo binário", () => {
      const partes = lerZip(
        zipSemCompressao([
          { nome: "ç.txt", conteudo: "olá" },
          { nome: "b.bin", conteudo: new Uint8Array([1, 2, 3]) },
        ]),
      );
      expect(partes.get("ç.txt")).toBe("olá");
      expect(partes.has("b.bin")).toBe(true);
    });

    it("nome do arquivo com o nº e o candidato, sem acento", () => {
      expect(
        nomeDoDocumento({ nu: 12, candidato: "Ana Ribeiro Ç. Souza" }),
      ).toBe("resposta-recurso-12-ana-ribeiro-c-souza");
      expect(linhasDoTexto("a\r\nb\rc")).toEqual(["a", "b", "c"]);
    });
  });

  describe("página de impressão", () => {
    it("um parágrafo por linha, como texto; o título vira o nome sugerido do PDF", () => {
      const documento = document.implementation.createHTMLDocument("x");
      montarPaginaDeImpressao(
        documento,
        "RESPOSTA\n\n<img src=x onerror=alert(1)> Prezada",
        { titulo: "resposta-recurso-7" },
      );
      expect(documento.title).toBe("resposta-recurso-7");
      const paragrafos = [...documento.body.querySelectorAll("p")];
      expect(paragrafos.map((p) => p.className)).toEqual([
        "titulo",
        "vazio",
        "",
      ]);
      expect(paragrafos[2].textContent).toBe(
        "<img src=x onerror=alert(1)> Prezada",
      );
      expect(documento.querySelector("img")).toBeNull();
      expect(documento.head.querySelector("style").textContent).toContain(
        "@page",
      );
    });
  });
});

bloco("lib/avaliacao-documental-andamento-por-vaga", () => {
  const vaga = (codigo, lote, concluidas, pendentes = lote - concluidas) => ({
    codigo,
    cargo: "",
    lote,
    concluidas,
    em_analise: lote - concluidas - pendentes,
    revisao: 0,
    pendentes,
  });

  describe("cargoCurto", () => {
    it("tira o 'CARGO n:' da frente e o '(Nível …)' do fim", () => {
      expect(
        cargoCurto("CARGO 1: QUÍMICO - Análise da Água (Nível Superior)"),
      ).toBe("QUÍMICO - Análise da Água");
      expect(
        cargoCurto("CARGO 10: SUPERVISOR DE SAÚDE AMBIENTAL (Nivel Médio)"),
      ).toBe("SUPERVISOR DE SAÚDE AMBIENTAL");
      expect(cargoCurto("Enfermeiro")).toBe("Enfermeiro");
      expect(cargoCurto(null)).toBe("");
      // Sem nada depois do prefixo, fica o texto inteiro.
      expect(cargoCurto("CARGO 3:")).toBe("CARGO 3:");
    });
  });

  describe("ordenarPorVaga", () => {
    const lista = [
      vaga("182430", 10, 10),
      vaga("182418", 44, 0),
      vaga("182420", 30, 3),
    ];
    const codigos = (o) => ordenarPorVaga(lista, o).map((v) => v.codigo);

    it("banco mantém a ordem; vaga, progresso e pendentes reordenam", () => {
      expect(codigos("banco")).toEqual(["182430", "182418", "182420"]);
      expect(codigos("vaga")).toEqual(["182418", "182420", "182430"]);
      expect(codigos("progresso")).toEqual(["182418", "182420", "182430"]);
      expect(codigos("pendentes")).toEqual(["182418", "182420", "182430"]);
    });

    it("empate fica na ordem do edital e não muda a lista original", () => {
      const empate = [vaga("2", 5, 0), vaga("1", 5, 0)];
      expect(ordenarPorVaga(empate, "pendentes").map((v) => v.codigo)).toEqual([
        "2",
        "1",
      ]);
      expect(empate.map((v) => v.codigo)).toEqual(["2", "1"]);
    });
  });

  describe("resumoPorVaga", () => {
    it("conta as vagas com pendências e as concluídas", () => {
      expect(
        resumoPorVaga([vaga("1", 10, 10), vaga("2", 44, 0), vaga("3", 30, 3)]),
      ).toBe("3 vagas · 2 com pendências · 1 concluída");
      expect(resumoPorVaga([vaga("1", 2, 2)])).toBe(
        "1 vaga · nenhuma com pendências · 1 concluída",
      );
    });
  });

  describe("aberto lembrado por usuário", () => {
    afterEach(() => {
      vi.restoreAllMocks();
      globalThis.localStorage?.clear();
    });

    it("fechado por padrão; grava e lê por usuário", () => {
      expect(lerPorVagaAberto("u1")).toBe(false);
      gravarPorVagaAberto("u1", true);
      expect(lerPorVagaAberto("u1")).toBe(true);
      expect(lerPorVagaAberto("u2")).toBe(false);
      gravarPorVagaAberto("u1", false);
      expect(lerPorVagaAberto("u1")).toBe(false);
    });

    it("sem armazenamento (navegação privada): fechado, sem erro", () => {
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("bloqueado");
      });
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("bloqueado");
      });
      expect(() => gravarPorVagaAberto("u1", true)).not.toThrow();
      expect(lerPorVagaAberto("u1")).toBe(false);
    });
  });
});

bloco("lib/regra-da-triagem", () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  /* A seção migrada do 93/2026 no ensaio (tests/fixtures/avaliacao-documental). */
  const ENSAIO = JSON.parse(
    readFileSync(
      "tests/fixtures/avaliacao-documental/regras-da-triagem-no-ensaio.json",
      "utf8",
    ),
  );
  const DO_93 = ENSAIO.find((e) => e.rotulo === "93/2026").triagem;

  describe("regra da Triagem: contrato e resumo", () => {
    it("as três RPCs estão no contrato", () => {
      expect(CONTRATO_RPC.obter_regra_triagem.argumentos).toEqual(["p_edital"]);
      expect(CONTRATO_RPC.salvar_regra_triagem.argumentos).toEqual([
        "p_edital",
        "p_configuracao",
        "p_versao_atual",
        "p_motivo",
        "p_nome",
      ]);
      expect(CONTRATO_RPC.conferir_regra_triagem.argumentos).toEqual([
        "p_edital",
        "p_versao",
      ]);
    });

    it("resume a regra migrada do 93/2026 em linhas curtas", () => {
      const linhas = Object.fromEntries(
        resumoDaRegraDaTriagem(DO_93).map((l) => [l.rotulo, l.valor]),
      );
      expect(Object.keys(linhas)).toEqual([
        "Requisitos",
        "Nota da lista",
        "Tolerância ART × declarada",
        "Desempate",
        "Lote",
      ]);
      expect(linhas.Lote).toContain("nota mínima 15 (item 8.2.6)");
      expect(linhas["Nota da lista"]).toMatch(/^nota declarada recalculada/);
      expect(resumoDaRegraDaTriagem(null)).toEqual([]);
    });

    it("o lote sem regra usa o padrão do cálculo (3 × as vagas)", () => {
      expect(textoDoLote(undefined)).toMatch(/^3 × as vagas/);
      expect(textoDoLote({ base: "FIXO", fixo: 120 })).toMatch(
        /^120 inscritos por vaga/,
      );
    });

    it("a validação da tela pega o óbvio; a do banco vale", () => {
      expect(errosDaRegraDaTriagem(DO_93)).toEqual([]);
      expect(
        errosDaRegraDaTriagem({
          formato: 1,
          lote: { base: "FIXO" },
          requisitos: { eliminacao_automatica: [{ codigo: "x", motivo: "" }] },
          nota: { base_da_nota: "DECLARADA", nota_declarada: [] },
        }),
      ).toEqual([
        "Lote: número fixo de 1 a 100.000.",
        "Eliminação 1: código em maiúsculas.",
        "Eliminação 1: informe o motivo.",
        "Base da nota pela declarada: configure a nota declarada.",
      ]);
    });

    it("chama as RPCs com os argumentos do contrato e devolve o erro do banco", async () => {
      const rpc = vi.fn(async () => ({
        data: { regra: { versao: 2 } },
        error: null,
      }));
      await salvarRegraDaTriagem(
        { rpc },
        {
          edital: "e93",
          configuracao: DO_93,
          versaoAtual: 1,
          motivo: "Motivo da mudança",
        },
      );
      expect(rpc).toHaveBeenCalledWith("salvar_regra_triagem", {
        p_edital: "e93",
        p_configuracao: DO_93,
        p_versao_atual: 1,
        p_motivo: "Motivo da mudança",
        p_nome: null,
      });
      const falha = {
        rpc: async () => ({ data: null, error: { message: "Sem permissão" } }),
      };
      await expect(obterRegraDaTriagem(falha, "e93")).rejects.toThrow(
        "Sem permissão",
      );
    });

    it("Editar nas Regras do edital abre Editais nas Regras do edital, na etapa (a rota)", () => {
      const janela = { navigate: vi.fn() };
      expect(abrirRegrasDoEdital("e93", "triagem", janela)).toBe(true);
      expect(janela.navigate).toHaveBeenCalledWith("nucleo", {
        edital: "e93",
        regras: "triagem",
      });
      expect(abrirRegrasDoEdital("e93", "triagem", {})).toBe(false);
      expect(abrirRegrasDoEdital("", "triagem", janela)).toBe(false);
      // Navegação recusada (alteração não salva): devolve false.
      expect(
        abrirRegrasDoEdital("e93", "triagem", { navigate: () => false }),
      ).toBe(false);
    });
  });

  describe("editor da regra da Triagem (Regras do edital, etapa 1)", () => {
    let raiz = null;
    afterEach(async () => {
      await act(async () => raiz?.unmount());
      raiz = null;
      document.body.innerHTML = "";
    });

    async function montar(pode) {
      const chamadas = [];
      let regra = {
        versao: 1,
        situacao: "CONFERIR",
        configuracao: DO_93,
        versoes: [{ versao: 1, nome: "Migrada da regra da análise" }],
      };
      const cliente = {
        rpc: vi.fn(async (nome, args) => {
          chamadas.push([nome, args]);
          if (nome === "obter_regra_triagem")
            return { data: { pode_coordenar: pode, regra }, error: null };
          if (nome === "salvar_regra_triagem") {
            regra = { ...regra, versao: 2, configuracao: args.p_configuracao };
            return { data: { regra }, error: null };
          }
          if (nome === "conferir_regra_triagem") {
            regra = { ...regra, situacao: "CONFERIDA" };
            return { data: { regra }, error: null };
          }
          return { data: null, error: null };
        }),
      };
      const div = document.createElement("div");
      document.body.appendChild(div);
      await act(async () => {
        raiz = createRoot(div);
        raiz.render(
          createElement(EditorDaRegraDaTriagem, { edital: "e93", cliente }),
        );
      });
      await act(async () => {});
      return chamadas;
    }

    const botao = (texto) =>
      [...document.querySelectorAll("button")].find((b) =>
        b.textContent.includes(texto),
      );

    it("quem não coordena só lê: sem salvar nem conferir", async () => {
      await montar(false);
      expect(document.body.textContent).toContain("só para leitura");
      expect(botao("Salvar versão nova")).toBeUndefined();
      expect(document.querySelector("fieldset").disabled).toBe(true);
    });

    it("quem coordena salva versão nova com motivo e confere", async () => {
      const chamadas = await montar(true);
      await act(async () => botao("Salvar versão nova").click());
      expect(document.body.textContent).toContain("Informe o motivo");
      const motivo = [...document.querySelectorAll("textarea")].at(-1);
      await act(async () => {
        const set = Object.getOwnPropertyDescriptor(
          HTMLTextAreaElement.prototype,
          "value",
        ).set;
        set.call(motivo, "Ajuste do lote pela coordenação");
        motivo.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await act(async () => botao("Salvar versão nova").click());
      await act(async () => {});
      const salvar = chamadas.find(([n]) => n === "salvar_regra_triagem");
      expect(salvar[1].p_versao_atual).toBe(1);
      expect(salvar[1].p_configuracao.lote).toEqual(DO_93.lote);
      expect(salvar[1].p_configuracao.requisitos).toEqual(DO_93.requisitos);
      expect(document.body.textContent).toContain("Versão 2 salva");
      await act(async () => botao("Conferir versão 2").click());
      await act(async () => {});
      expect(chamadas.some(([n]) => n === "conferir_regra_triagem")).toBe(true);
    });

    it("desempate em lista ordenada: liga, desliga e muda a ordem pelas setas", async () => {
      const chamadas = await montar(true);
      const ordem = () =>
        [...document.querySelectorAll(".triagem-criterio[data-ligado]")].map(
          (li) =>
            `${li.querySelector(".triagem-criterio__ordem").textContent} ${li.dataset.criterio}`,
        );
      const antes = ordem();
      expect(antes.length).toBeGreaterThan(0);
      expect(antes[0]).toMatch(/^1º /);
      const segundo = antes[1]?.split(" ")[1];
      if (segundo) {
        await act(async () =>
          document
            .querySelector(`[data-criterio='${segundo}'] [aria-label^='Subir']`)
            .click(),
        );
        expect(ordem()[0]).toBe(`1º ${segundo}`);
      }
      const desligado = document.querySelector(
        ".triagem-criterio:not([data-ligado]) input[role='switch']",
      );
      if (desligado) {
        await act(async () => desligado.click());
        expect(ordem().at(-1)).toMatch(new RegExp(`^${ordem().length}º `));
      }
      // Requisitos com o botão comum e sem chamar o banco antes de salvar.
      expect(botao("Acrescentar requisito").className).toContain("secondary");
      expect(chamadas.filter(([n]) => n === "salvar_regra_triagem")).toEqual(
        [],
      );
    });
  });
});

bloco("marcos-e-comemoracoes", () => {
  // O desenho chega por import(): o aviso aparece depois da promessa.

  /*
  Marcos e comemorações: só transições vistas por esta pessoa (linha de base
  silenciosa na primeira vez), do processo e da equipe, uma vez cada, com o
  liga/desliga global.
*/

  function armazenamentoFalso() {
    const dados = new Map();
    return {
      getItem: (k) => (dados.has(k) ? dados.get(k) : null),
      setItem: (k, v) => dados.set(k, String(v)),
      removeItem: (k) => dados.delete(k),
      dados,
    };
  }

  const linha = (edital, unidade, status) => ({
    edital,
    unidade,
    status_consolidado: status,
  });

  describe("liga/desliga das comemorações", () => {
    it("lê sistema.comemoracoes; sem resposta, desligado; sem o campo, ligado", () => {
      expect(
        comemoracoesLigadasNaResposta({ sistema: { comemoracoes: true } }),
      ).toBe(true);
      expect(
        comemoracoesLigadasNaResposta({ sistema: { comemoracoes: false } }),
      ).toBe(false);
      expect(comemoracoesLigadasNaResposta({ sistema: {} })).toBe(true);
      expect(comemoracoesLigadasNaResposta(null)).toBe(false);
      expect(comemoracoesLigadasNaResposta({ areas: [] })).toBe(false);
    });

    it("a situação do sistema carrega o flag; sem resposta, desligado", () => {
      expect(
        normalizarSituacaoDoSistema({
          sistema: { situacao: "ATIVA", comemoracoes: false },
          areas: [],
        }).comemoracoes,
      ).toBe(false);
      expect(
        normalizarSituacaoDoSistema({
          sistema: { situacao: "ATIVA", comemoracoes: true },
          areas: [],
        }).comemoracoes,
      ).toBe(true);
      expect(normalizarSituacaoDoSistema(null).comemoracoes).toBe(false);
    });
  });

  describe("linha de base", () => {
    it("a primeira leitura só grava; a seguinte devolve a anterior", () => {
      const armazenamento = armazenamentoFalso();
      const chave = chaveDoMarco("fila", "u1", "sede");
      expect(chave).toBe("agsus_monitora_marco:fila:u1:sede");
      expect(
        trocarEstadoGuardado({ armazenamento, chave, atual: 3 }),
      ).toBeNull();
      expect(trocarEstadoGuardado({ armazenamento, chave, atual: 0 })).toBe(3);
    });

    it("sem armazenamento (bloqueado), nada a comemorar", () => {
      const quebrado = {
        getItem: () => {
          throw new Error("bloqueado");
        },
        setItem: () => {
          throw new Error("bloqueado");
        },
      };
      expect(
        trocarEstadoGuardado({ armazenamento: quebrado, chave: "x", atual: 1 }),
      ).toBeNull();
    });
  });

  describe("edital concluído e fila zerada", () => {
    const antes = [
      linha("01/2026", "DSEI Xingu", "Aprovado"),
      linha("01/2026", "DSEI Xingu", "Pendente"),
      linha("02/2026", "DSEI Yanomami", "Pendente"),
      linha("03/2026", "DSEI Leste", "Aprovado"),
    ];
    const depois = [
      linha("01/2026", "DSEI Xingu", "Aprovado"),
      linha("01/2026", "DSEI Xingu", "Reprovado"),
      linha("02/2026", "DSEI Yanomami", "Pendente"),
      linha("03/2026", "DSEI Leste", "Aprovado"),
    ];

    it("comemora o edital que tinha pendência e zerou; não o que já estava completo", () => {
      const anterior = estadoGuardadoDosEditais(situacaoDosEditais(antes));
      const concluidos = editaisConcluidos(
        anterior,
        situacaoDosEditais(depois),
      );
      expect(concluidos.map((e) => e.edital)).toEqual(["01/2026"]);
    });

    it("sem linha de base, nada; edital novo já completo, nada", () => {
      expect(editaisConcluidos(null, situacaoDosEditais(depois))).toEqual([]);
      expect(
        editaisConcluidos(
          {},
          situacaoDosEditais([linha("9/2026", "X", "Aprovado")]),
        ),
      ).toEqual([]);
    });

    it("status vazio conta como pendente; Revisar não", () => {
      expect(
        pendentesDaFila([
          linha("1", "A", ""),
          linha("1", "A", "Revisar"),
          linha("1", "A", "Pendente"),
        ]),
      ).toBe(2);
    });

    it("Em análise segura o edital e a fila: só zera quando a ficha é concluída", () => {
      const pegou = [
        linha("114/2026", "Projetos", "Aprovado"),
        linha("114/2026", "Projetos", "Em análise"),
      ];
      const anterior = estadoGuardadoDosEditais(
        situacaoDosEditais([
          linha("114/2026", "Projetos", "Aprovado"),
          linha("114/2026", "Projetos", "Pendente"),
        ]),
      );
      expect(pendentesDaFila(pegou)).toBe(1);
      expect(editaisConcluidos(anterior, situacaoDosEditais(pegou))).toEqual(
        [],
      );
      const concluiu = [pegou[0], linha("114/2026", "Projetos", "Reprovado")];
      expect(
        editaisConcluidos(anterior, situacaoDosEditais(concluiu)).map(
          (e) => e.edital,
        ),
      ).toEqual(["114/2026"]);
    });

    it("fila: de >0 para 0", () => {
      expect(filaZerou(4, 0)).toBe(true);
      expect(filaZerou(0, 0)).toBe(false);
      expect(filaZerou(null, 0)).toBe(false);
      expect(filaZerou(4, 1)).toBe(false);
    });

    it("um aviso só: o primeiro edital na frase, o resto na lista", () => {
      const situacao = situacaoDosEditais(depois.slice(0, 2));
      const comemoracao = comemoracaoDasAnalises({
        anteriorEditais: { "01/2026|DSEI Xingu": 1 },
        anteriorFila: 1,
        situacao,
        pendentes: 0,
        nomeDaArea: "SEDE",
      });
      expect(comemoracao.texto).toBe(
        "Edital 01/2026 (DSEI Xingu): as 2 fichas foram analisadas.",
      );
      expect(comemoracao.itens).toEqual(["Nenhuma ficha pendente na SEDE."]);
      // Edital concluído desenha um coração no céu.
      expect(comemoracao.forma).toBe("coracao");
      expect(comemoracao.marco).toBe("edital-concluido");
      expect(comemoracao.editais).toEqual(["01/2026"]);
    });

    it("as frases dizem o fato com o número, sem exclamação nem agradecimento", () => {
      expect(
        mensagemDoEditalConcluido({
          edital: "114/2026",
          unidade: "Rio de Janeiro",
          total: 1512,
        }),
      ).toBe(
        "Edital 114/2026 (Rio de Janeiro): as 1.512 fichas foram analisadas.",
      );
      expect(
        mensagemDoEditalConcluido({ edital: "7/2026", unidade: "", total: 1 }),
      ).toBe("Edital 7/2026: a ficha foi analisada.");
      expect(mensagemDaFilaZerada("SEDE")).toBe(
        "Nenhuma ficha pendente na SEDE.",
      );
      expect(mensagemDaFilaZerada("Saúde Indígena")).toBe(
        "Nenhuma ficha pendente na Saúde Indígena.",
      );
      expect(mensagemDaFilaZerada("Projetos")).toBe(
        "Nenhuma ficha pendente em Projetos.",
      );
      expect(mensagemDaFilaZerada("")).toBe("Nenhuma ficha pendente.");
      expect(naArea("projetos")).toBe("em projetos");
      expect(naArea("")).toBe("");
      expect(mensagemDaVagaPronta({ vaga: "179698", cargo: "Químico" })).toBe(
        "Vaga 179698 (Químico): todas as entrevistas têm parecer. Já pode seguir para a Classificação.",
      );
      expect(mensagemDaVagaPronta({ vaga: "179698", cargo: "" })).toBe(
        "Vaga 179698: todas as entrevistas têm parecer. Já pode seguir para a Classificação.",
      );
    });

    it("só a fila zerada: o aviso dela (sem efeito, pelo catálogo)", () => {
      const situacao = situacaoDosEditais([linha("01/2026", "X", "Apto")]);
      expect(
        comemoracaoDasAnalises({
          anteriorEditais: { "01/2026|X": 0 },
          anteriorFila: 3,
          situacao,
          pendentes: 0,
          nomeDaArea: "Saúde Indígena",
        }),
      ).toEqual({
        texto: "Nenhuma ficha pendente na Saúde Indígena.",
        itens: [],
        forma: "estrela",
        marco: "fila-zerada",
        editais: [],
      });
    });
  });

  describe("vaga pronta", () => {
    const dados = (parecer, semEntrevista = []) => ({
      entrevistas: [
        { edital: "E1", vaga: "V10", cargo: "Enfermeiro", parecer: "APTO" },
        { edital: "E1", vaga: "V10", cargo: "Enfermeiro", parecer },
      ],
      aprovadosSemEntrevista: semEntrevista,
    });

    it("pronta com todos entrevistados e com parecer", () => {
      expect(situacaoDasVagas(dados("INAPTO"))["E1|V10"].pronta).toBe(true);
      expect(situacaoDasVagas(dados("SEM_PARECER"))["E1|V10"].pronta).toBe(
        false,
      );
      expect(
        situacaoDasVagas(dados("APTO", [{ edital: "E1", vaga: "V10" }]))[
          "E1|V10"
        ].pronta,
      ).toBe(false);
    });

    it("comemora só a transição de incompleta para pronta", () => {
      const anterior = estadoGuardadoDasVagas(
        situacaoDasVagas(dados("SEM_PARECER")),
      );
      const comemoracao = comemoracaoDasEntrevistas({
        anterior,
        situacao: situacaoDasVagas(dados("APTO")),
      });
      expect(comemoracao.texto).toBe(
        "Vaga V10 (Enfermeiro): todas as entrevistas têm parecer. Já pode seguir para a Classificação.",
      );
      expect(
        comemoracaoDasEntrevistas({
          anterior: { "E1|V10": true },
          situacao: situacaoDasVagas(dados("APTO")),
        }),
      ).toBeNull();
    });
  });

  describe("marcos do ano", () => {
    it("1.000, 2.500, 5.000, 7.500, 10.000 e a cada 5.000", () => {
      expect(marcoAlcancado(999)).toBe(0);
      expect(marcoAlcancado(1000)).toBe(1000);
      expect(marcoAlcancado(2600)).toBe(2500);
      expect(marcoAlcancado(7600)).toBe(7500);
      expect(marcoAlcancado(14999)).toBe(10000);
      expect(marcoAlcancado(15000)).toBe(15000);
      expect(marcoAlcancado(26000)).toBe(25000);
    });

    it("primeira vez em silêncio (linha de base); depois só contra o guardado; ano novo recomeça", () => {
      expect(marcoNovo(null, { ano: 2026, quantidade: 8000 })).toBe(0);
      expect(marcoNovo(null, { ano: 2026, quantidade: 400 })).toBe(0);
      expect(
        proximoEstadoDoMarco(null, { ano: 2026, quantidade: 8000 }),
      ).toEqual({ estado: { ano: 2026, marco: 7500 }, novo: 0 });
      expect(
        marcoNovo({ ano: 2026, marco: 5000 }, { ano: 2026, quantidade: 7600 }),
      ).toBe(7500);
      expect(
        marcoNovo({ ano: 2026, marco: 7500 }, { ano: 2026, quantidade: 7900 }),
      ).toBe(0);
      expect(
        marcoNovo({ ano: 2025, marco: 10000 }, { ano: 2026, quantidade: 1200 }),
      ).toBe(1000);
    });

    it("o guardado não desce no mesmo ano", () => {
      expect(
        proximoEstadoDoMarco(
          { ano: 2026, marco: 7500 },
          { ano: 2026, quantidade: 7400 },
        ),
      ).toEqual({ estado: { ano: 2026, marco: 7500 }, novo: 0 });
    });

    it("a frase: a área, o número e o ano; o número no céu", () => {
      expect(
        mensagemDoMarcoDoAno({
          nomeDaArea: "Saúde Indígena",
          marco: 7500,
          ano: 2026,
        }),
      ).toBe("Saúde Indígena: 7.500 análises concluídas em 2026.");
      expect(
        mensagemDoMarcoDoAno({
          nomeDaArea: "Projetos",
          marco: 1000,
          ano: 2026,
        }),
      ).toBe("Projetos: 1.000 análises concluídas em 2026.");
      expect(formaDoMarco(10000)).toEqual({ tipo: "numero", texto: "10.000" });
    });
  });

  describe("recurso decidido no prazo", () => {
    it("no dia do prazo ou antes: no prazo; depois: fora; sem prazo: nada", () => {
      expect(decididoNoPrazo("2026-09-10", "2026-09-10")).toBe(true);
      expect(decididoNoPrazo("2026-09-11", "2026-09-10")).toBe(false);
      expect(decididoNoPrazo("2026-09-11", null)).toBeNull();
      expect(decididoNoPrazo("", "2026-09-10")).toBeNull();
    });

    it("enriquecerRecurso: noPrazo só no decidido", () => {
      const cronogramas = new Map([
        [
          "7",
          [
            {
              atividade: "Resposta aos recursos da análise curricular",
              inicio: "2026-09-01",
              fim: "2026-09-10",
            },
          ],
        ],
      ]);
      const base = {
        edital_id: 7,
        origem: "analise-curricular",
        criado_em: "2026-09-02T12:00:00",
      };
      const hoje = "2026-09-30";
      expect(
        enriquecerRecurso(
          { ...base, situacao: "DEFERIDO", decisao_em: "2026-09-09T12:00:00" },
          { cronogramas, hoje },
        ).noPrazo,
      ).toBe(true);
      expect(
        enriquecerRecurso(
          { ...base, situacao: "DEFERIDO", decisao_em: "2026-09-12T12:00:00" },
          { cronogramas, hoje },
        ).noPrazo,
      ).toBe(false);
      expect(
        enriquecerRecurso(
          { ...base, situacao: "EM_ANALISE" },
          { cronogramas, hoje },
        ).noPrazo,
      ).toBeNull();
    });
  });

  describe("avaliar um marco na tela", () => {
    afterEach(() => {
      document.body.innerHTML = "";
    });
    comemoracoesNaPagina();

    const janelaSemMovimento = {
      matchMedia: () => ({ matches: true }),
      requestAnimationFrame: vi.fn(),
    };

    it("primeira vez em silêncio; na transição, o aviso (sem fogos com menos movimento), uma vez", async () => {
      const armazenamento = armazenamentoFalso();
      const decidir = (anterior) =>
        anterior > 0 ? { texto: "Fila zerada!", itens: [] } : null;
      const avaliar = (atual) =>
        avaliarMarco({
          armazenamento,
          chave: "k",
          atual,
          ligadas: true,
          decidir,
          janela: janelaSemMovimento,
        });
      expect(avaliar(2)).toBeNull();
      expect(document.querySelector(".comemoracao")).toBeNull();
      expect(avaliar(0)).toEqual({ texto: "Fila zerada!", itens: [] });
      await vi.waitFor(() =>
        expect(document.querySelector(".comemoracao")).not.toBeNull(),
      );
      expect(document.querySelector(".comemoracao").textContent).toContain(
        "Fila zerada!",
      );
      expect(document.querySelector(".comemoracao__fogos")).toBeNull();
      expect(janelaSemMovimento.requestAnimationFrame).not.toHaveBeenCalled();
      // Recarregou: o estado já é 0, nada de novo.
      act(() => filaDeComemoracoes.esvaziar());
      expect(avaliar(0)).toBeNull();
    });

    it("desligadas: guarda o estado, não mostra nada", async () => {
      const armazenamento = armazenamentoFalso();
      const decidir = () => ({ texto: "x", itens: [] });
      avaliarMarco({
        armazenamento,
        chave: "k",
        atual: 2,
        ligadas: false,
        decidir,
      });
      expect(
        avaliarMarco({
          armazenamento,
          chave: "k",
          atual: 0,
          ligadas: false,
          decidir,
        }),
      ).toBeNull();
      expect(armazenamento.getItem("k")).toBe("0");
      await new Promise((resolver) => setTimeout(resolver, 20));
      expect(document.querySelector(".comemoracao")).toBeNull();
    });

    it("o × fecha o aviso", async () => {
      const armazenamento = armazenamentoFalso();
      armazenamento.setItem("k", "1");
      avaliarMarco({
        armazenamento,
        chave: "k",
        atual: 0,
        ligadas: true,
        decidir: () => ({ texto: "Pronto", itens: [] }),
        janela: janelaSemMovimento,
      });
      await vi.waitFor(() =>
        expect(document.querySelector(".comemoracao__fechar")).not.toBeNull(),
      );
      act(() => document.querySelector(".comemoracao__fechar").click());
      expect(document.querySelector(".comemoracao")).toBeNull();
    });
  });
});

bloco("marcos-nos-paineis", () => {
  /* O desenho da comemoração chega por import(): espera ele e o aviso. */
  async function depoisDoDesenho() {
    await carregarComemoracao();
    await new Promise((resolver) => setTimeout(resolver, 0));
  }

  /*
  Onde os marcos aparecem: o aviso de edital concluído / fila zerada na tela
  de Análises curriculares. O card de marcos do ano na Visão geral (React) é
  testado em tests/telas-com-modulo-simulado-na-tela.test.js (bloco modulos/visao-geral).
*/

  describe("marcos de Análises curriculares", () => {
    beforeEach(() => {
      localStorage.clear();
      window.matchMedia = () => ({ matches: true });
    });
    afterEach(() => {
      document.body.innerHTML = "";
      delete window.matchMedia;
    });
    comemoracoesNaPagina();

    const linhas = (status) => [
      { edital: "05/2026", unidade: "SEDE", status_consolidado: "Aprovado" },
      { edital: "05/2026", unidade: "SEDE", status_consolidado: status },
    ];
    const avaliar = (status, escopo = "ativo", ligadas = true) =>
      avaliarMarcosDasAnalises({
        ligadas,
        usuarioId: "u1",
        area: "sede",
        nomeDaArea: "SEDE",
        escopo,
        linhas: linhas(status),
      });

    it("edital e fila: linha de base, depois o aviso na transição", async () => {
      expect(await avaliar("Pendente")).toBeNull();
      const comemoracao = await avaliar("Reprovado");
      expect(comemoracao.texto).toBe(
        "Edital 05/2026 (SEDE): as 2 fichas foram analisadas.",
      );
      expect(comemoracao.itens).toEqual(["Nenhuma ficha pendente na SEDE."]);
      await depoisDoDesenho();
      expect(document.querySelector(".comemoracao")).not.toBeNull();
    });

    it("comemorações desligadas: guarda o estado em silêncio, sem aviso", async () => {
      expect(await avaliar("Pendente", "ativo", false)).toBeNull();
      expect(await avaliar("Reprovado", "ativo", false)).toBeNull();
      await depoisDoDesenho();
      expect(document.querySelector(".comemoracao")).toBeNull();
      expect(localStorage.length).toBe(1);
    });

    it("fora do escopo Ativo, não avalia", async () => {
      expect(await avaliar("Pendente", "todos")).toBeNull();
      expect(localStorage.length).toBe(0);
    });
  });
});

bloco("modulos/analises-espelho-na-gaveta", () => {
  /*
  A gaveta do Painel das análises com o espelho de nota (migration
  20261020150000: get_analise_detalhe_do_painel manda "espelho" na linha da
  ficha concluída). Os números e textos da gaveta têm de ser OS MESMOS do
  espelho de nota da mesma ficha (espelhoDaFichaGravada, a montagem dos
  espelhos em massa); a linha da planilha segue como antes.
*/

  const f114 = JSON.parse(
    readFileSync(
      "tests/fixtures/avaliacao-documental/ficha-114-2026.json",
      "utf8",
    ),
  );
  const MOTORISTA = "CARGO 14: MOTORISTA - Categoria B (Nível Médio)";
  const DOCUMENTAL = { nota_minima: 15 };
  const EDITAL = { id: "e-114", rotulo: "114/2026", area: "projetos" };

  const ELIMINADO = {
    nivel: "medio",
    modalidade: "AC",
    vaga: "182513",
    cargo: MOTORISTA,
    blocos: {
      IDENTIDADE: { situacao: "CONFORME" },
      ESCOLARIDADE: { situacao: "CONFORME" },
      REQUISITO_DO_CARGO: {
        situacao: "NAO_CONFORME",
        motivos: ["OUTRO"],
        motivo_livre: "CNH enviada cortada, sem a data de validade visível.",
      },
    },
    titulos: [],
    cursos: [{ horas: 60, aceito: true }],
    vinculos: [],
  };

  const COM_PONTOS = {
    nivel: "medio",
    modalidade: "AC",
    vaga: "182513",
    cargo: MOTORISTA,
    blocos: {
      IDENTIDADE: { situacao: "CONFORME" },
      ESCOLARIDADE: { situacao: "CONFORME" },
      REQUISITO_DO_CARGO: { situacao: "CONFORME" },
      CURSOS: {
        situacao: "CONFORME",
        nota_ajustada: 1,
        justificativas: ["OUTRO"],
        motivo_livre: "Certificado de 40 h sem assinatura da instituição.",
      },
      EXPERIENCIA: { situacao: "CONFORME" },
    },
    titulos: [],
    cursos: [
      { horas: 120, aceito: true },
      { horas: 20, aceito: false, motivo: "Sem carga" },
    ],
    vinculos: [
      {
        categoria: f114.regra.blocos.find((b) => b.tipo === "VINCULOS")
          .categorias[0].codigo,
        inicio: "2019-01-01",
        fim: "2024-12-31",
        aceito: true,
      },
    ],
  };

  /** A ficha concluída como obter_espelhos_de_nota a devolve (com nome e código). */
  function fichaDoBanco(lancamento) {
    const regra = regraDaFicha(structuredClone(f114.regra), lancamento);
    const avaliacao = calcularFicha(regra, lancamento, DOCUMENTAL);
    const declarada = declaradaDaFicha(
      regra,
      f114.vagas["182528"].respostas,
      lancamento.nivel,
    );
    return {
      id: "f-1",
      codigo: "7001",
      nome: "Maria Exemplo",
      vaga: "182513",
      cargo: MOTORISTA,
      modalidade: "AC",
      posicao: 3,
      art: 40,
      resultado: avaliacao.resultado,
      nota_final: avaliacao.nota_final,
      regra: "r1:1",
      declarada: { ...declarada.parciais },
      lancamento: structuredClone(lancamento),
    };
  }

  /** O "espelho" do detalhe (a mesma ficha, sem nome, código, cargo nem modalidade). */
  function detalheComEspelho(ficha) {
    return {
      id: "a-1",
      area: "projetos",
      chave_natural: "monitora|e-114|c-1",
      analise: "Parecer da ficha.",
      nota_final_ajustada: ficha.nota_final,
      pontuacao_escolaridade: 0,
      pontuacao_cursos_aperfeicoamento: 1,
      pontuacao_experiencia_profissional: 20,
      espelho: {
        schema_version: 1,
        ficha: {
          id: ficha.id,
          vaga: ficha.vaga,
          art: ficha.art,
          resultado: ficha.resultado,
          nota_final: ficha.nota_final,
          regra: ficha.regra,
          declarada: ficha.declarada,
          lancamento: ficha.lancamento,
        },
        regra: structuredClone(f114.regra),
        documental: DOCUMENTAL,
        edital: EDITAL,
      },
    };
  }

  const LINHA = {
    __chave: "a-1",
    __busca: "",
    __buscaDaFila: "",
    id: "a-1",
    candidato: "Maria Exemplo",
    status_consolidado: "Aprovado",
    responsavel_analise: "Avaliadora",
    edital: "114/2026",
    codigo_vaga: "182513",
    etapa: "Análise curricular",
    modalidade_concorrencia: "Ampla concorrência",
  };

  let raiz;
  let caixa;
  afterEach(() => {
    act(() => raiz?.unmount());
    caixa?.remove();
    raiz = null;
  });

  function abrir(dados) {
    caixa = document.createElement("div");
    document.body.append(caixa);
    raiz = createRoot(caixa);
    act(() =>
      raiz.render(
        createElement(GavetaDaAnalise, {
          linha: { ...LINHA },
          detalhe: { situacao: "pronto", dados },
          area: "projetos",
          aoFechar() {},
          aoTentarDeNovo() {},
        }),
      ),
    );
    return document.getElementById("analisesGaveta");
  }

  const textos = (raizDaBusca, seletor) =>
    [...raizDaBusca.querySelectorAll(seletor)].map((n) => n.textContent.trim());
  const kvs = (secao) =>
    [...secao.querySelectorAll(".ui-kv")].map((kv) => [
      kv.querySelector(".ui-kv-rotulo").textContent,
      kv.querySelector(".ui-kv-valor").textContent,
    ]);

  describe("gaveta com a ficha do sistema", () => {
    const ficha = fichaDoBanco(COM_PONTOS);
    // O espelho de nota da mesma ficha (padrão do espelho e o da gaveta).
    const espelhoDeNota = espelhoDaFichaGravada(
      ficha,
      structuredClone(f114.regra),
      DOCUMENTAL,
      EDITAL,
    );

    it("declarada × após a análise × teto idênticos ao espelho de nota", () => {
      const gaveta = abrir(detalheComEspelho(ficha));
      const secao = gaveta.querySelector('[data-section="espelho"]');
      expect(secao).not.toBeNull();

      // Notas: os mesmos valores do espelho, com os rótulos da gaveta.
      expect(kvs(secao)).toEqual([
        ["Nota autodeclarada (antes da análise)", espelhoDeNota.notas[0].valor],
        ["Nota consolidada (após a análise)", espelhoDeNota.notas[1].valor],
      ]);

      // Critérios: as mesmas linhas, colunas e números do quadro do espelho.
      expect(textos(secao, "thead th")).toEqual([
        "Critério",
        "Declarada",
        "Após análise",
        "Teto",
      ]);
      const linhas = [
        ...secao.querySelectorAll("tbody tr:not([data-nota])"),
      ].map((tr) => textos(tr, "td"));
      expect(linhas).toEqual(
        espelhoDeNota.criterios.map((c) => [
          c.rotulo,
          c.declarada,
          c.apurada,
          c.teto,
        ]),
      );
      expect(linhas.length).toBeGreaterThan(1);

      // As justificativas: só no critério que mudou, com o texto do espelho.
      const mudaram = espelhoDeNota.criterios.filter(
        (c) => c.declarada !== c.apurada,
      );
      expect(mudaram.length).toBeGreaterThan(0);
      expect(textos(secao, "tr[data-nota] li")).toEqual(
        mudaram.flatMap((c) => c.justificativas),
      );
      expect(textos(secao, "tr[data-mudou] td:first-child")).toEqual(
        mudaram.map((c) => c.rotulo),
      );
      expect(secao.textContent).toContain(
        "Certificado de 40 h sem assinatura da instituição.",
      );

      // Sem repetir a nota final e a pontuação por critério da linha.
      const rotulos = textos(gaveta, ".ui-kv-rotulo");
      expect(rotulos).not.toContain("Nota final");
      expect(rotulos).not.toContain("Escolaridade");
      expect(rotulos).not.toContain("Cursos");
      expect(rotulos).toContain("Modalidade");
      // Logo depois da situação.
      expect(textos(gaveta, ".ui-secao-topo span").slice(0, 2)).toEqual([
        "Situação da análise",
        "Nota antes e após a análise",
      ]);
    });

    it("espelhoDoDetalhe dá os mesmos números com os textos da gaveta", () => {
      const painel = espelhoDoDetalhe(detalheComEspelho(ficha));
      const comTextosDaGaveta = espelhoDaFichaGravada(
        ficha,
        structuredClone(f114.regra),
        DOCUMENTAL,
        EDITAL,
        TEXTOS_DO_ESPELHO_NO_PAINEL,
      );
      expect(painel.notas).toEqual(comTextosDaGaveta.notas);
      expect(painel.notas.map((n) => n.valor)).toEqual(
        espelhoDeNota.notas.map((n) => n.valor),
      );
      expect(
        painel.criterios.map(({ mudou: _m, justificativas: _j, ...c }) => c),
      ).toEqual(
        espelhoDeNota.criterios.map(({ justificativas: _j, ...c }) => c),
      );
    });

    it("o espelho fica no detalhe: não vai para a linha", () => {
      const linha = { ...LINHA };
      mesclarDetalhe(linha, detalheComEspelho(ficha));
      expect(linha).not.toHaveProperty("espelho");
      expect(linha.analise).toBe("Parecer da ficha.");
    });
  });

  describe("linha da planilha", () => {
    it("sem espelho, a gaveta segue como antes (nota final e composição)", () => {
      const gaveta = abrir({
        id: "a-1",
        area: "projetos",
        chave_natural: "planilha|x",
        analise: "Parecer da planilha.",
        nota_final_ajustada: 42,
        pontuacao_escolaridade: 10,
        pontuacao_cursos_aperfeicoamento: 2,
        pontuacao_experiencia_profissional: 30,
        espelho: null,
      });
      expect(gaveta.querySelector('[data-section="espelho"]')).toBeNull();
      expect(gaveta.querySelector("table")).toBeNull();
      expect(kvs(gaveta.querySelector('[data-section="result"]'))).toEqual([
        ["Nota final", "42"],
        ["Modalidade", "Ampla concorrência"],
      ]);
      expect(kvs(gaveta.querySelector('[data-section="score"]'))).toEqual([
        ["Escolaridade", "10"],
        ["Cursos", "2"],
        ["Experiência profissional", "30"],
      ]);
    });

    it("espelho que não se monta: volta à gaveta de antes", () => {
      expect(espelhoDoDetalhe({ espelho: { ficha: {} } })).toBeNull();
      expect(espelhoDoDetalhe(null)).toBeNull();
    });
  });

  describe("eliminado", () => {
    const ficha = fichaDoBanco(ELIMINADO);
    const espelhoDeNota = espelhoDaFichaGravada(
      ficha,
      structuredClone(f114.regra),
      DOCUMENTAL,
      EDITAL,
    );

    it("sem a declarada nem critérios: só a consolidada (Não se aplica) e os motivos", () => {
      expect(espelhoDeNota.modelo).toBe("ELIMINADO");
      const gaveta = abrir(detalheComEspelho(ficha));
      const secao = gaveta.querySelector('[data-section="espelho"]');
      expect(kvs(secao)).toEqual([
        ["Nota consolidada (após a análise)", espelhoDeNota.notas[0].valor],
      ]);
      expect(espelhoDeNota.notas[0].valor).toMatch(/^Não se aplica/);
      expect(secao.textContent).not.toContain("Nota autodeclarada");
      expect(secao.querySelector("table")).toBeNull();
      expect(textos(secao, ".ui-lista-de-motivos li")).toEqual(
        espelhoDeNota.justificativas,
      );
      expect(secao.textContent).toContain("CNH enviada cortada");
    });
  });
});

bloco("modulos/avaliacao-documental-abas", () => {
  /*
  Abas por papel e entrada da Avaliação documental (abas-e-entrada.ts):
  Regra, Equipe e Triagem só para quem coordena o edital; quem
  analisa vê só a Fila (sem seletor). Sem edital escolhido, cartões dos
  editais vigentes; com um só (ou o último aberto), abre direto nele.
  Fixtures sem dado pessoal.
*/

  const EU = "u-ana";
  const edital = (id, numero, papel, extra = {}) => ({
    id,
    edital: numero,
    unidade: "Boa Vista",
    ativo: true,
    status: "Em andamento",
    versao_regra: 2,
    nome_regra: null,
    situacao_regra: "CONFERIDA",
    papel,
    ...extra,
  });

  const FILA = (coordena) => ({
    schema_version: 1,
    edital: { id: "e93", rotulo: "93/2026" },
    papel: coordena ? "COORDENADOR" : "ANALISTA",
    pode_coordenar: coordena,
    pode_pegar: true,
    eu: EU,
    prazo_reserva_min: 15,
    distribuicao: { modo: "PEGAR_PROXIMO", criterio: "PARTES_IGUAIS" },
    sem_ficha: 0,
    vagas: [{ codigo: "179698", cargo: "Técnico" }],
    analistas: [],
    filtros: [],
    candidatos: [
      {
        id: "c-7001",
        vaga: "179698",
        codigo: "7001",
        nome: "Pessoa 7001",
        situacao_pre: "NO_LOTE",
        posicao: 1,
        lote: 1,
        art: 20,
        modalidade: "AC",
        ficha: { id: "f1", versao: 1, situacao: "PENDENTE", reserva: null },
      },
    ],
  });

  function supabaseFalso({
    editais,
    coordena,
    regraAtrasada = null,
    concluida = null,
  }) {
    const respostas = {
      listar_editais_avaliacao: () => ({ area: "projetos", editais }),
      obter_regra_analise: ({ p_edital }) => ({
        edital: { id: p_edital, edital: "93/2026", area: "projetos" },
        papel: coordena ? "COORDENADOR" : "ANALISTA",
        pode_coordenar: coordena,
        origem: "PLANILHA",
        regra: null,
        modelos: [],
        nota_minima: null,
        aldeias: { quantidade: 0 },
      }),
      obter_equipe_edital: () => ({
        pode_coordenar: coordena,
        gestores: [],
        equipe: [],
        pessoas: [],
        vagas: [],
      }),
      obter_fila_avaliacao: () => ({
        ...FILA(coordena),
        candidatos: [
          ...FILA(coordena).candidatos,
          ...(concluida ? [concluida] : []),
        ],
      }),
    };
    return {
      rpc: vi.fn(async (nome, args) => {
        if (nome === "obter_regra_analise" && regraAtrasada)
          await regraAtrasada;
        return { data: respostas[nome]?.(args) ?? null, error: null };
      }),
      auth: {
        getSession: async () => ({ data: { session: { user: { id: EU } } } }),
      },
    };
  }

  let secao;
  let painel;

  async function montar(supabase) {
    secao = document.createElement("section");
    secao.id = "page-avaliacao-documental";
    secao.className = "page active";
    document.body.append(secao);
    await act(async () => {
      painel = montarTela(
        criarAvaliacaoDocumental,
        "page-avaliacao-documental",
        {
          supabase,
          toast: vi.fn(),
        },
      );
    });
    await act(async () => void painel.render());
    await esperar();
    await esperar();
  }
  const abas = () =>
    [...secao.querySelectorAll("[data-tour='avd-visoes'] [data-valor]")].map(
      (b) => b.getAttribute("data-valor"),
    );
  const botoes = () =>
    [...secao.querySelectorAll("button")].map((b) => b.textContent.trim());
  const chamou = (supabase, nome) =>
    supabase.rpc.mock.calls.some(([n]) => n === nome);

  beforeEach(() => {
    redefinirDadosDoMonitoramento();
    definirAreaAtual("projetos");
    localStorage.clear();
    sessionStorage.clear();
  });
  afterEach(async () => {
    await act(async () => painel?.raiz?.unmount());
    secao?.remove();
    await carregarCatalogoDeAbas({ consulta: Promise.resolve(null) });
    vi.unstubAllGlobals();
  });

  describe("abas por papel", () => {
    it("quem coordena vê as quatro áreas, a configuração e o atalho legado", async () => {
      const supabase = supabaseFalso({
        editais: [edital("e93", "93/2026", "COORDENADOR")],
        coordena: true,
      });
      await montar(supabase);
      expect(abas()).toEqual(["fila", "espelhos", "configuracoes"]);
      expect(painel.estado.obter().visao).toBe("fila");
      // A equipe (com as pessoas) só é lida quando a aba Equipe abre.
      expect(chamou(supabase, "obter_equipe_edital")).toBe(false);
      expect(botoes()).toContain("Abrir triagem");
      act(() => painel.estado.mudarVisao("pre"));
      expect(botoes()).not.toContain("Abrir triagem");
      act(() => painel.estado.mudarVisao("configuracoes"));
      expect(
        secao.querySelector(
          "[aria-label='Configurações da avaliação documental']",
        ),
      ).not.toBeNull();
      expect(botoes()).toContain("Abrir triagem");
      // A aba Equipe abre e só então lê a equipe.
      await act(async () => painel.estado.mudarVisao("equipe"));
      await act(async () => new Promise((r) => setTimeout(r, 0)));
      expect(chamou(supabase, "obter_equipe_edital")).toBe(true);
      act(() => painel.estado.mudarVisao("espelhos"));
      expect(
        secao.querySelector("[aria-label='Emissão dos espelhos de nota']"),
      ).not.toBeNull();
      // Espelhos concluídos: busca por código ou nome e marcação múltipla.
      expect(secao.querySelector("#espelhos-concluidos-busca")).not.toBeNull();
      // Os comunicados de eliminação ficam na Triagem: aqui, só o atalho.
      expect(
        secao.querySelector("[data-acao='baixar-comunicado-eliminacao']"),
      ).toBeNull();
      await clicar(
        secao.querySelector("[data-acao='abrir-comunicados-na-pre']"),
      );
      expect(painel.estado.obter().visao).toBe("pre");
    });

    it("quem analisa vê Fila sem operações da coordenação", async () => {
      const supabase = supabaseFalso({
        editais: [edital("e93", "93/2026", "ANALISTA")],
        coordena: false,
      });
      await montar(supabase);
      // Uma seção só (a Fila): o cabeçalho não mostra o seletor de seções.
      expect(abas()).toEqual([]);
      expect(painel.estado.obter().visao).toBe("fila");
      expect(secao.querySelector("[data-candidato='7001']")).not.toBeNull();
      // Nenhum atalho para as abas da coordenação, e a equipe nem é lida.
      for (const rotulo of ["Regra", "Equipe", "Triagem"])
        expect(botoes()).not.toContain(rotulo);
      expect(chamou(supabase, "obter_equipe_edital")).toBe(false);
      expect(chamou(supabase, "obter_pre_classificacao")).toBe(false);
      act(() => painel.estado.mudarVisao("resultados"));
      expect(painel.estado.obter().visao).toBe("fila");
      act(() => painel.estado.mudarVisao("espelhos"));
      act(() => painel.estado.mudarVisao("configuracoes"));
      expect(painel.estado.obter().visao).toBe("fila");
    });

    it("a visão antiga Resultados direciona para a Fila sem modificar fichas", async () => {
      const supabase = supabaseFalso({
        editais: [edital("e93", "93/2026", "ANALISTA")],
        coordena: false,
      });
      await montar(supabase);
      act(() => painel.estado.mudarVisao("resultados"));
      expect(painel.estado.obter().visao).toBe("fila");
      expect(
        secao.querySelector("[data-tour='avd-fila-tabela']"),
      ).not.toBeNull();
    });

    it("a visão 'regra' guardada vira Fila para quem analisa (e não volta)", async () => {
      const supabase = supabaseFalso({
        editais: [edital("e93", "93/2026", "ANALISTA")],
        coordena: false,
      });
      await montar(supabase);
      // O estado agora começa na Fila, sem expor configurações.
      expect(painel.estado.obter().visao).toBe("fila");
      act(() => painel.estado.mudarVisao("regra"));
      act(() => painel.estado.mudarVisao("pre"));
      expect(painel.estado.obter().visao).toBe("fila");
      expect(secao.querySelector(".avd-campos")).toBeNull();
    });

    it("enquanto o edital carrega, a aba proibida não pisca", async () => {
      let soltar;
      const regraAtrasada = new Promise((r) => (soltar = r));
      const supabase = supabaseFalso({
        editais: [edital("e93", "93/2026", "ANALISTA")],
        coordena: false,
        regraAtrasada,
      });
      await montar(supabase);
      expect(painel.estado.obter().dados).toBeNull();
      expect(abas()).toEqual([]);
      expect(botoes()).not.toContain("Regra");
      await act(async () => soltar());
      await esperar();
      expect(abas()).toEqual([]);
      expect(secao.querySelector("[data-tour='avd-fila']")).not.toBeNull();
    });
  });

  describe("transição do atalho da Triagem", () => {
    const UUID = "a153f5d2-37bc-41a5-8d0f-67606f0de114";

    it("mantém acesso legado quando a aba nova está desativada no banco", async () => {
      await carregarCatalogoDeAbas({
        consulta: Promise.resolve({
          data: [
            {
              co_aba: "avaliacao-documental",
              no_aba: "Avaliação documental",
              co_view: "avaliacao-documental",
              co_recurso: "avaliacao_documental",
              areas: [{ co_area: "projetos" }],
            },
          ],
          error: null,
        }),
      });
      const navegar = vi.fn();
      vi.stubGlobal("navigate", navegar);
      await montar(
        supabaseFalso({
          editais: [edital(UUID, "114/2026", "COORDENADOR")],
          coordena: true,
        }),
      );
      const botao = [...secao.querySelectorAll("button")].find((el) =>
        el.textContent.includes("Abrir triagem"),
      );
      expect(botao).toBeDefined();
      await clicar(botao);
      expect(painel.estado.obter().visao).toBe("pre");
      expect(navegar).not.toHaveBeenCalled();
    });

    it("com a aba ativa no catálogo, remove o atalho duplicado", async () => {
      await carregarCatalogoDeAbas({
        consulta: Promise.resolve({
          data: [
            {
              co_aba: "pre-classificacao",
              no_aba: "Triagem",
              co_view: "pre-classificacao",
              co_recurso: "avaliacao_documental",
              areas: [{ co_area: "projetos" }],
            },
          ],
          error: null,
        }),
      });
      const navegar = vi.fn();
      vi.stubGlobal("navigate", navegar);
      await montar(
        supabaseFalso({
          editais: [edital(UUID, "114/2026", "COORDENADOR")],
          coordena: true,
        }),
      );
      const botao = [...secao.querySelectorAll("button")].find((el) =>
        el.textContent.includes("Abrir triagem"),
      );
      expect(botao).toBeUndefined();
      expect(navegar).not.toHaveBeenCalled();
    });
  });

  describe("entrada da tela", () => {
    const VARIOS = [
      edital("e93", "93/2026", "ANALISTA", {
        fichas: { concluidas: 4, pendentes: 10, minhas_em_analise: 2 },
      }),
      edital("e114", "114/2026", "REVISOR", { situacao_regra: "CONFERIR" }),
      edital("e23", "23/2025", null, { status: "Concluído" }),
    ];

    it("com vários editais: cartões dos vigentes, sem abas; clicar abre", async () => {
      const supabase = supabaseFalso({ editais: VARIOS, coordena: false });
      await montar(supabase);
      expect(painel.estado.obter().editalId).toBe("");
      expect(secao.querySelector("[data-tour='avd-visoes']")).toBeNull();
      const cartoes = [...secao.querySelectorAll(".avd-entrada-cartao")];
      expect(cartoes.map((c) => c.getAttribute("data-edital"))).toEqual([
        "e93",
        "e114",
      ]);
      expect(cartoes[0].textContent).toContain("Conferida");
      expect(cartoes[0].textContent).toContain("4 concluídas · 10 pendentes");
      expect(cartoes[0].textContent).toContain("Suas fichas: 2 em análise");
      expect(cartoes[1].textContent).toContain("A conferir");
      await clicar(cartoes[1]);
      await esperar();
      expect(painel.estado.obter().editalId).toBe("e114");
      expect(secao.querySelector(".avd-entrada")).toBeNull();
      expect(lerEditalLembrado(EU, "projetos")).toBe("e114");
    });

    it("com um edital vigente só, abre direto nele", async () => {
      const supabase = supabaseFalso({
        editais: [edital("e93", "93/2026", "COORDENADOR"), VARIOS[2]],
        coordena: true,
      });
      await montar(supabase);
      expect(painel.estado.obter().editalId).toBe("e93");
      expect(secao.querySelector(".avd-entrada")).toBeNull();
    });

    it("reabre no último edital aberto pela pessoa", async () => {
      lembrarEdital(EU, "projetos", "e114");
      const supabase = supabaseFalso({ editais: VARIOS, coordena: false });
      await montar(supabase);
      expect(painel.estado.obter().editalId).toBe("e114");
    });
  });

  describe("abas-e-entrada (regras puras)", () => {
    it("coordenaOEdital: o edital carregado decide; antes, o papel da lista", () => {
      const editais = [{ id: "a", papel: "COORDENADOR" }, { id: "b" }];
      expect(coordenaOEdital({ editais, editalId: "" })).toBeNull();
      expect(coordenaOEdital({ editais, editalId: "a" })).toBe(true);
      expect(coordenaOEdital({ editais, editalId: "b" })).toBeNull();
      expect(
        coordenaOEdital({
          editais,
          editalId: "a",
          dados: { pode_coordenar: 0 },
        }),
      ).toBe(false);
      expect(visaoNaTela({ editais, editalId: "b", visao: "pre" })).toBe(
        "fila",
      );
      expect(visaoNaTela({ editais, editalId: "a", visao: "pre" })).toBe("pre");
    });

    it("editalParaAbrir: preferido, único vigente ou único na equipe", () => {
      const v = (id, papel = null, ativo = true) => ({ id, papel, ativo });
      expect(editalParaAbrir([v("a"), v("b")], editalVigente, ["b"])).toBe("b");
      expect(editalParaAbrir([v("a"), v("b")], editalVigente, ["x"])).toBe("");
      expect(
        editalParaAbrir([v("a"), v("b", null, false)], editalVigente),
      ).toBe("a");
      expect(editalParaAbrir([v("a"), v("b", "ANALISTA")], editalVigente)).toBe(
        "b",
      );
    });

    it("lembrar o edital tolera navegador sem armazenamento", () => {
      const quebrado = {
        getItem() {
          throw new Error("bloqueado");
        },
        setItem() {
          throw new Error("bloqueado");
        },
        removeItem() {
          throw new Error("bloqueado");
        },
      };
      expect(() => lembrarEdital(EU, "projetos", "e1", quebrado)).not.toThrow();
      expect(lerEditalLembrado(EU, "projetos", quebrado)).toBe("");
      expect(lerEditalLembrado(null, "projetos")).toBe("");
    });
  });
});

bloco("modulos/avaliacao-documental-diferencas-por-cargo", () => {
  /*
  "Diferenças por cargo" no assistente e no modo avançado: acrescentar uma
  diferença, escolher as vagas do edital e o cargo do quadro, mudar teto e
  faixas dos cursos, um item extra e um requisito — e a regra continua válida.
*/
  const CASOS = JSON.parse(
    readFileSync(
      "tests/fixtures/avaliacao-documental/casos-de-pontuacao.json",
      "utf8",
    ),
  );
  const BASE = structuredClone(CASOS.regras["E114-POR-CARGO"]);
  delete BASE.por_cargo;

  let alvo;
  let raiz;
  let regra;
  beforeEach(() => {
    alvo = document.createElement("div");
    document.body.append(alvo);
    raiz = createRoot(alvo);
    regra = structuredClone(BASE);
  });
  afterEach(() => {
    act(() => raiz.unmount());
    alvo.remove();
  });

  async function desenhar() {
    await act(async () => {
      raiz.render(
        createElement(DiferencasPorCargo, {
          regra,
          aoMudar: (nova) => {
            regra = nova;
          },
          vagas: [
            {
              vaga: "182528",
              cargo: "CARGO 15 MOTORISTA - Categoria D",
              colunas: [],
            },
            {
              vaga: "182567",
              cargo: "CARGO 15 MOTORISTA - Categoria D",
              colunas: [],
            },
          ],
          cargosDoQuadro: ["CARGO 15: MOTORISTA - Categoria D (Nível Médio)"],
        }),
      );
    });
  }
  const porTexto = (seletor, texto) =>
    [...alvo.querySelectorAll(seletor)].find((e) =>
      e.textContent.includes(texto),
    );
  const caixa = (texto) =>
    [...alvo.querySelectorAll("label.avd-caixa")]
      .find(
        (l) =>
          l.textContent.trim() === texto ||
          l.textContent.trim().startsWith(`${texto} ·`),
      )
      .querySelector("input");
  const campo = (rotulo, dentro = alvo) => {
    const label = [...dentro.querySelectorAll(".ui-campo > label")].find((l) =>
      l.textContent.trim().startsWith(rotulo),
    );
    return label ? dentro.querySelector(`[id="${label.htmlFor}"]`) : null;
  };

  describe("Diferenças por cargo", () => {
    it("monta a diferença do Motorista D pela tela e a regra fica válida", async () => {
      await desenhar();
      await clicar(porTexto("button", "Diferença por cargo"));
      await desenhar();
      expect(regra.por_cargo).toHaveLength(1);
      alvo.querySelector("details.avd-ast-cargo").open = true;
      await digitar(campo("Nome"), "Cargo 15 — Motorista D");
      await desenhar();
      await clicar(caixa("182528"));
      await desenhar();
      await clicar(caixa("182567"));
      await desenhar();
      await clicar(caixa("CARGO 15"));
      await desenhar();
      expect(regra.por_cargo[0]).toMatchObject({
        rotulo: "Cargo 15 — Motorista D",
        vagas: ["182528", "182567"],
        cargos: ["CARGO 15"],
      });

      const cursos = alvo.querySelector(
        "details.avd-ast-cargo-do-bloco summary",
      );
      expect(cursos).not.toBeNull();
      const doCursos = porTexto(
        "details.avd-ast-cargo-do-bloco",
        "Cursos de aperfeiçoamento",
      );
      doCursos.open = true;
      await clicar(caixa("Faixas e teto próprios do cargo"));
      await desenhar();
      expect(
        regra.por_cargo[0].blocos.CURSOS.faixas.map((f) => f.pontos),
      ).toEqual([2, 4, 6]);
      await digitar(
        campo(
          "Teto",
          porTexto(
            "details.avd-ast-cargo-do-bloco",
            "Cursos de aperfeiçoamento",
          ),
        ),
        "15",
      );
      await desenhar();
      await clicar(
        [
          ...porTexto(
            "details.avd-ast-cargo-do-bloco",
            "Cursos de aperfeiçoamento",
          ).querySelectorAll("button"),
        ].find((b) => b.textContent.includes("Item extra que pontua")),
      );
      await desenhar();
      const doCursosAgora = porTexto(
        "details.avd-ast-cargo-do-bloco",
        "Cursos de aperfeiçoamento",
      );
      await digitar(campo("Item extra", doCursosAgora), "Certificado UMCQA");
      await desenhar();
      await digitar(
        campo(
          "Pontos",
          porTexto(
            "details.avd-ast-cargo-do-bloco",
            "Cursos de aperfeiçoamento",
          ).querySelector(".avd-ast-cargo-lista"),
        ),
        "5",
      );
      await desenhar();
      expect(regra.por_cargo[0].blocos.CURSOS).toMatchObject({
        teto: 15,
        extras: [{ codigo: "EXTRA_1", rotulo: "Certificado UMCQA", pontos: 5 }],
      });

      await clicar(
        [
          ...porTexto(
            "details.avd-ast-cargo-do-bloco",
            "Requisito específico do cargo",
          ).querySelectorAll("button"),
        ].find((b) => b.textContent.includes("Requisito do cargo")),
      );
      await desenhar();
      const req = porTexto(
        "details.avd-ast-cargo-do-bloco",
        "Requisito específico do cargo",
      );
      await digitar(campo("Requisito", req), "CNH categoria D vigente");
      await desenhar();
      await digitar(
        campo(
          "Motivo da eliminação",
          porTexto(
            "details.avd-ast-cargo-do-bloco",
            "Requisito específico do cargo",
          ),
        ),
        "Não apresentou CNH categoria D vigente.",
      );
      await desenhar();
      expect(regra.por_cargo[0].blocos.REQUISITO_DO_CARGO.requisitos).toEqual([
        {
          codigo: "REQUISITO_1",
          rotulo: "CNH categoria D vigente",
          motivo: "Não apresentou CNH categoria D vigente.",
          item_edital: "",
        },
      ]);
      expect(validarRegraAnalise(regra)).toEqual([]);
    });

    it("tirar a última diferença tira por_cargo da regra", async () => {
      regra.por_cargo = [
        {
          codigo: "CARGO_1",
          rotulo: "X",
          vagas: ["182528"],
          blocos: { EXPERIENCIA: { area: "Motorista" } },
        },
      ];
      await desenhar();
      alvo.querySelector("details.avd-ast-cargo").open = true;
      await clicar(
        alvo.querySelector('button[aria-label="Tirar a diferença"]'),
      );
      expect(regra.por_cargo).toBeUndefined();
    });
  });
});

bloco("modulos/avaliacao-documental-documentos-em-lote", () => {
  /*
  A lista dos Espelhos das avaliações concluídas (aba Documentos): busca por
  nome, marcação múltipla e as saídas PDF (uma pessoa), ZIP e impressão.
  Dados fictícios; PDF, ZIP e impressão são dublês.
*/

  const concluida = (resultado) => ({ situacao: "CONCLUIDA", resultado });
  const PESSOAS = concluidosDaFila([
    {
      vaga: "1",
      codigo: "9001",
      nome: "Ana Conceição",
      ficha: concluida("APTO"),
    },
    {
      vaga: "1",
      codigo: "9002",
      nome: "Bruno Alves",
      ficha: concluida("APTO"),
    },
    {
      vaga: "2",
      codigo: "9003",
      nome: "Ana Paula",
      ficha: concluida("INAPTO_NOTA"),
    },
  ]);

  let raiz;
  let caixa;
  afterEach(async () => {
    await act(async () => raiz?.unmount());
    caixa?.remove();
  });

  async function montar(props) {
    caixa = document.createElement("div");
    document.body.append(caixa);
    raiz = createRoot(caixa);
    await act(async () => {
      raiz.render(
        createElement(DocumentosEmLote, {
          id: "espelhos-concluidos",
          pessoas: PESSOAS,
          vagas: [{ codigo: "1" }, { codigo: "2" }],
          rotuloDoDetalhe: "Resultado",
          rotuloDoDocumento: "espelho",
          tituloDaImpressao: "Espelhos de nota",
          prefixoDoZip: "espelhos",
          edital: "93/2026",
          agora: () => new Date(2026, 9, 29),
          ...props,
        }),
      );
    });
  }
  const busca = () => caixa.querySelector("#espelhos-concluidos-busca");
  const linhas = () =>
    [...caixa.querySelectorAll("tbody tr")].map((tr) => tr.dataset.pessoa);
  const acao = (nome) =>
    caixa.querySelector(`[data-acao='espelhos-concluidos-${nome}']`);
  const comoDocumentos = async (escolhidas) => ({
    documentos: escolhidas.map((p) => ({ candidato: p.nome })),
    avisos: [],
  });

  describe("Documentos em lote", () => {
    it("busca por nome, marca os da busca e baixa o ZIP só das marcadas", async () => {
      const montarDocs = vi.fn(comoDocumentos);
      const baixarZip = vi.fn(async (docs) => docs.length);
      await montar({ montar: montarDocs, baixarZip });
      expect(linhas()).toEqual(["9001", "9002", "9003"]);
      expect(acao("zip").disabled).toBe(true);
      await digitar(busca(), "ana");
      expect(linhas()).toEqual(["9001", "9003"]);
      await clicar(acao("marcar-todos"));
      expect(acao("marcadas").textContent).toBe("2 marcada(s)");
      expect(acao("marcar-todos").checked).toBe(true);
      expect(acao("barra").className).toContain("avd-docs-lote-acoes-fixa");
      expect(acao("pdf").disabled).toBe(true);
      await clicar(acao("zip"));
      await esperar();
      expect(montarDocs.mock.calls[0][0].map((p) => p.codigo)).toEqual([
        "9001",
        "9003",
      ]);
      expect(baixarZip).toHaveBeenCalledWith(
        [{ candidato: "Ana Conceição" }, { candidato: "Ana Paula" }],
        "espelhos-93-2026-2026-10-29.zip",
        expect.any(Object),
      );
      expect(caixa.textContent).toContain("2 espelhos em espelhos-93-2026");
    });

    it("uma marcada: PDF individual; várias: impressão num documento só", async () => {
      const montarDocs = vi.fn(async (escolhidas) => ({
        ...(await comoDocumentos(escolhidas)),
        avisos: ["1 marcada(s) sem ficha concluída disponível agora."],
      }));
      const baixarPdf = vi.fn(async () => "espelho-1-9002.pdf");
      const abrir = vi.fn();
      await montar({ montar: montarDocs, baixarPdf, abrir });
      await clicar(caixa.querySelector("input[aria-label='Marcar 9002']"));
      await clicar(acao("pdf"));
      await esperar();
      expect(baixarPdf).toHaveBeenCalledWith({ candidato: "Bruno Alves" });
      expect(caixa.textContent).toContain(
        "Arquivo preparado: espelho-1-9002.pdf",
      );
      expect(acao("avisos").textContent).toContain("sem ficha concluída");
      await clicar(caixa.querySelector("input[aria-label='Marcar 9001']"));
      await clicar(acao("imprimir"));
      await esperar();
      expect(abrir).toHaveBeenCalledWith(
        [{ candidato: "Ana Conceição" }, { candidato: "Bruno Alves" }],
        { titulo: "Espelhos de nota" },
      );
    });

    it("50 por vez; a caixa do cabeçalho marca todos da busca, não só os desenhados", async () => {
      const muitas = concluidosDaFila(
        Array.from({ length: 120 }, (_, i) => ({
          vaga: "1",
          codigo: String(8000 + i),
          nome: `Pessoa Fictícia ${String(i).padStart(3, "0")}`,
          ficha: concluida("APTO"),
        })),
      );
      await montar({ pessoas: muitas, montar: vi.fn(comoDocumentos) });
      expect(linhas()).toHaveLength(50);
      expect(caixa.querySelector("[data-tabela-mostrando]").textContent).toBe(
        "Mostrando 50 de 120 registros",
      );
      expect(acao("barra").className).not.toContain("avd-docs-lote-acoes-fixa");
      await clicar(caixa.querySelector("input[aria-label='Marcar 8000']"));
      expect(acao("marcar-todos").indeterminate).toBe(true);
      expect(acao("marcar-todos").dataset.estado).toBe("parte");
      await clicar(acao("marcar-todos"));
      expect(acao("marcadas").textContent).toBe("120 marcada(s)");
      expect(acao("marcar-todos").checked).toBe(true);
      expect(acao("marcar-todos").indeterminate).toBe(false);
      await clicar(caixa.querySelector("[data-acao='carregar-mais']"));
      expect(linhas()).toHaveLength(100);
      await clicar(acao("limpar"));
      expect(acao("marcadas").textContent).toBe("0 marcada(s)");
      expect(acao("marcar-todos").checked).toBe(false);
    });
  });
});

bloco("modulos/avaliacao-documental-espelhos-zip", async () => {
  /*
  Espelhos de nota em massa no formato ZIP (um PDF por candidato): o botão
  "Baixar ZIP" lê as fichas, gera os PDFs com "x de N" e baixa o ZIP com o
  nome do edital e da data; "Imprimir tudo junto" segue abrindo um documento
  só. E o "Baixar PDF" do espelho individual.
*/

  const f114 = JSON.parse(
    readFileSync(
      "tests/fixtures/avaliacao-documental/ficha-114-2026.json",
      "utf8",
    ),
  );
  const MOTORISTA = "CARGO 14: MOTORISTA - Categoria B (Nível Médio)";
  const ELIMINADO = {
    nivel: "medio",
    modalidade: "AC",
    vaga: "182513",
    cargo: MOTORISTA,
    blocos: {
      IDENTIDADE: { situacao: "CONFORME" },
      ESCOLARIDADE: { situacao: "CONFORME" },
      REQUISITO_DO_CARGO: {
        situacao: "NAO_CONFORME",
        motivos: ["OUTRO"],
        motivo_livre: "CNH cortada.",
      },
    },
    titulos: [],
    cursos: [],
    vinculos: [],
  };

  const linha = (codigo, nome) => ({
    id: `f-${codigo}`,
    codigo,
    nome,
    vaga: "182513",
    cargo: MOTORISTA,
    modalidade: "AC",
    posicao: 1,
    art: 10,
    resultado: "INAPTO_REQUISITO",
    nota_final: 0,
    regra: "r1:1",
    declarada: {},
    lancamento: structuredClone(ELIMINADO),
  });

  function rpcFalso() {
    return vi.fn(async (nome) =>
      nome === "obter_modelo_espelho_nota"
        ? { versao: 1, textos: { titulo: "Título do 114" }, pode_editar: true }
        : {
            edital: { id: "e114", rotulo: "114/2026", area: "projetos" },
            documental: { nota_minima: 15 },
            regras: { "r1:1": structuredClone(f114.regra) },
            fichas: [linha("7001", "Ana Lúcia"), linha("7002", "Bruno")],
            nao_concluidos: [],
            proximo: null,
          },
    );
  }

  const FILA = [
    { vaga: "182513", codigo: "7001", ficha: { situacao: "CONCLUIDA" } },
    { vaga: "182513", codigo: "7002", ficha: { situacao: "CONCLUIDA" } },
  ];

  let raiz = null;
  let lugar = null;
  afterEach(() => {
    act(() => raiz?.unmount());
    lugar?.remove();
    raiz = null;
  });

  async function montar(props) {
    lugar = document.createElement("div");
    document.body.append(lugar);
    raiz = createRoot(lugar);
    await act(async () => {
      raiz.render(
        createElement(EspelhosEmMassa, {
          editalId: "e114",
          vagas: [{ codigo: "182513", cargo: MOTORISTA }],
          fila: FILA,
          aoFechar: () => {},
          agora: () => new Date(2026, 9, 19, 9, 30),
          ...props,
        }),
      );
    });
  }
  const botao = (seletor) => document.querySelector(seletor);

  describe("Espelhos de nota em massa: ZIP", () => {
    it("o padrão é o ZIP: gera um PDF por candidato com progresso e baixa", async () => {
      const rpc = rpcFalso();
      let continuar;
      const progresso = [];
      const baixarZip = vi.fn(
        (espelhos, nome, { aoProgredir }) =>
          new Promise((resolver) => {
            aoProgredir(1, espelhos.length);
            continuar = () => resolver(espelhos.length);
          }),
      );
      await montar({ rpc, baixarZip, abrir: vi.fn() });
      expect(botao("[data-acao='gerar-espelhos']").textContent).toContain(
        "Baixar ZIP",
      );
      await clicar(botao("[data-acao='gerar-espelhos']"));
      expect(baixarZip).toHaveBeenCalledTimes(1);
      const [espelhos, nome] = baixarZip.mock.calls[0];
      expect(espelhos.map((e) => e.codigoDoCandidato)).toEqual([
        "7001",
        "7002",
      ]);
      expect(nome).toBe("espelhos-114-2026-2026-10-19.zip");
      // Os textos do modelo do edital (obter_modelo_espelho_nota).
      expect(espelhos.map((e) => e.titulo)).toEqual([
        "Título do 114",
        "Título do 114",
      ]);
      progresso.push(botao("[data-acao='espelhos-pdfs']").textContent);
      expect(progresso[0]).toContain("1 de 2 PDFs");
      await esperar(() => continuar());
      expect(botao("[data-acao='espelhos-pdfs']")).toBeNull();
      expect(document.body.textContent).toContain(
        "2 PDF(s) em espelhos-114-2026-2026-10-19.zip",
      );
      expect(botao("[data-acao='espelhos-de-novo']").textContent).toBe(
        "Baixar de novo",
      );
    });

    it("com a vaga escolhida, o nome do ZIP leva a vaga", async () => {
      const baixarZip = vi.fn(async (espelhos) => espelhos.length);
      await montar({ rpc: rpcFalso(), baixarZip });
      const select = document.querySelector("select");
      await act(async () => {
        Object.getOwnPropertyDescriptor(
          HTMLSelectElement.prototype,
          "value",
        ).set.call(select, "182513");
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await clicar(botao("[data-acao='gerar-espelhos']"));
      expect(baixarZip.mock.calls[0][1]).toBe(
        "espelhos-114-2026-vaga-182513-2026-10-19.zip",
      );
    });

    it("Imprimir tudo junto segue abrindo um documento só", async () => {
      const abrir = vi.fn();
      const baixarZip = vi.fn();
      await montar({ rpc: rpcFalso(), baixarZip, abrir });
      await clicar(botao("[data-valor='imprimir']"));
      expect(botao("[data-acao='gerar-espelhos']").textContent).toContain(
        "Gerar e imprimir",
      );
      await clicar(botao("[data-acao='gerar-espelhos']"));
      expect(baixarZip).not.toHaveBeenCalled();
      expect(abrir).toHaveBeenCalledTimes(1);
      expect(abrir.mock.calls[0][0]).toHaveLength(2);
      expect(botao("[data-acao='espelhos-de-novo']").textContent).toBe(
        "Abrir de novo",
      );
    });
  });

  const libs = await carregarBibliotecasDoPdf();

  describe("baixar o PDF e o ZIP (sem rede: marca e download falsos)", () => {
    const marca = async () => ({ cabecalho: "AGÊNCIA DE TESTE", logo: null });

    it("baixarZipDosEspelhos baixa um application/zip com um PDF por espelho", async () => {
      const espelhos = [linha("7001", "Ana"), linha("7002", "Bia")].map((f) =>
        espelhoDaFichaGravada(
          f,
          structuredClone(f114.regra),
          {},
          {
            rotulo: "114/2026",
          },
        ),
      );
      const baixar = vi.fn();
      const n = await baixarZipDosEspelhos(espelhos, "x.zip", {
        carregar: async () => libs,
        baixar,
        marca,
      });
      expect(n).toBe(2);
      const [bytes, nome, tipo] = baixar.mock.calls[0];
      expect([nome, tipo]).toEqual(["x.zip", "application/zip"]);
      expect(Object.keys(unzipSync(bytes))).toEqual([
        "espelho-182513-7001-ana.pdf",
        "espelho-182513-7002-bia.pdf",
      ]);
    });

    it("baixarEspelhoEmPdf baixa o PDF da ficha concluída com o nome legível", async () => {
      const regra = regraDaFicha(structuredClone(f114.regra), ELIMINADO);
      const avaliacao = calcularFicha(regra, ELIMINADO, { nota_minima: 15 });
      const baixar = vi.fn();
      const nome = await baixarEspelhoEmPdf(
        {
          regra,
          lancamento: ELIMINADO,
          avaliacao,
          declarada: null,
          dados: { edital: { rotulo: "114/2026", area: "projetos" } },
        },
        {
          nome: "José da Silva",
          codigo: "7003",
          vaga: "182513",
          cargo: MOTORISTA,
          tp_resultado: avaliacao.resultado,
        },
        { carregar: async () => libs, baixar, marca },
      );
      expect(nome).toBe("espelho-182513-7003-jose-da-silva.pdf");
      const [bytes, , tipo] = baixar.mock.calls[0];
      expect(tipo).toBe("application/pdf");
      expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    });
  });
});

bloco("modulos/avaliacao-documental-ficha-por-cargo", () => {
  /*
  A ficha com as diferenças por cargo (regra do 114/2026 dos casos dourados):
  a regra da vaga no estado da ficha, a lista de requisitos DAQUELE cargo com
  Confere / Não confere e o motivo pronto, a linha extra do UMCQA nos Cursos
  do Motorista D (somando até o teto 15), o aviso do 8.2.7 e a área exigida
  da experiência. Dados fictícios.
*/
  const CASOS = JSON.parse(
    readFileSync(
      "tests/fixtures/avaliacao-documental/casos-de-pontuacao.json",
      "utf8",
    ),
  );
  const REGRA = CASOS.regras["E114-POR-CARGO"];

  function fichaDoBanco(vaga = "182528") {
    return {
      schema_version: 1,
      edital: { id: "e114", rotulo: "114/2026" },
      papel: "ANALISTA",
      eu: "u-ana",
      pode_editar: true,
      ficha: {
        id: "f1",
        versao: 3,
        vaga,
        cargo: null,
        codigo: "8001",
        nome: "Pessoa Fictícia",
        modalidade: "AC",
        situacao: "EM_ANALISE",
        lancamento: { nivel: "medio" },
        rascunho_em: null,
      },
      regra: {
        versao: 8,
        vigente: 8,
        situacao: "CONFERIDA",
        configuracao: REGRA,
      },
      documental: { nota_minima: 10, nota_minima_por_nivel: {} },
      respostas: {},
      historico: [],
    };
  }

  async function abrir(vaga) {
    const salvos = [];
    const loja = criarEstadoDaFicha({
      rpc: async (nome, args) => {
        // A leve (20261014231000) sem regra.chave: o mesmo payload.
        if (
          nome === "obter_ficha_analise" ||
          nome === "obter_ficha_analise_leve"
        )
          return fichaDoBanco(vaga);
        if (nome === "salvar_rascunho_ficha") {
          salvos.push(args);
          return {
            versao: args.p_versao + 1,
            salvo_em: new Date().toISOString(),
          };
        }
        throw new Error(`rpc inesperada ${nome}`);
      },
      agendar: () => 0,
      cancelar: () => {},
      toast: () => {},
    });
    await loja.carregar("f1");
    return { loja, salvos };
  }

  let alvo;
  let raiz;
  beforeEach(() => {
    alvo = document.createElement("div");
    document.body.append(alvo);
    raiz = createRoot(alvo);
  });
  afterEach(() => {
    act(() => raiz.unmount());
    alvo.remove();
  });

  const EMPREGARE = {
    enderecos: { candidato: null, vaga: null, vagaDireta: false },
    codigoDoCandidato: "8001",
    codigoDaVaga: "182528",
    loja: { registrarAcesso: async () => {} },
    aoAvisar: () => {},
  };

  async function mostrar(loja, codigo) {
    const st = loja.obter();
    const bloco = st.regra.blocos.find((b) => b.codigo === codigo);
    await act(async () => {
      raiz.render(
        createElement(ItemDaFicha, {
          st,
          bloco,
          modo: "foco",
          ativo: true,
          desabilitado: false,
          mostrarFaltaDeSituacao: false,
          empregare: EMPREGARE,
          mudar: loja.mudar,
        }),
      );
    });
  }
  const botao = (seletor, rotulo) =>
    [...alvo.querySelectorAll(`${seletor} button`)].find(
      (b) => b.textContent.trim() === rotulo,
    );

  describe("ficha do Motorista D (vaga 182528)", () => {
    it("o estado usa a regra da vaga e o lançamento leva a vaga", async () => {
      const { loja } = await abrir();
      const st = loja.obter();
      expect(st.regra.cargo.codigo).toBe("MOTORISTA_D");
      expect(st.lancamento.vaga).toBe("182528");
      const cursos = st.regra.blocos.find((b) => b.codigo === "CURSOS");
      expect(cursos.teto).toBe(15);
    });

    it("Requisito do cargo: só os do Motorista D; Não confere elimina com o motivo pronto", async () => {
      const { loja } = await abrir();
      await mostrar(loja, "REQUISITO_DO_CARGO");
      const linhas = [...alvo.querySelectorAll("[data-requisito]")].map(
        (l) => l.dataset.requisito,
      );
      expect(linhas).toEqual(["CNH_D", "DIRECAO_DEFENSIVA"]);
      expect(alvo.textContent).not.toContain("Cromatografia");
      await clicar(botao('[data-requisito="CNH_D"]', "Não confere"));
      await mostrar(loja, "REQUISITO_DO_CARGO");
      expect(
        alvo.querySelector('[data-requisito="CNH_D"]').textContent,
      ).toContain(
        "Item 2 e Anexo I: Não apresentou CNH categoria D vigente (Anexo I).",
      );
      const st = loja.obter();
      expect(st.lancamento.blocos.REQUISITO_DO_CARGO).toMatchObject({
        situacao: "NAO_CONFORME",
        motivos: ["CNH_D"],
        requisitos: { CNH_D: false },
      });
      expect(st.avaliacao.resultado).toBe("INAPTO_REQUISITO");
    });

    it("Cursos: a linha UMCQA soma 5 até o teto 15; o aviso do 8.2.7", async () => {
      const { loja } = await abrir();
      loja.mudar((l) => ({
        ...l,
        blocos: {
          ...l.blocos,
          CURSOS: { situacao: "CONFORME", edita_nota: true },
          REQUISITO_DO_CARGO: {
            situacao: "CONFORME",
            requisitos: { CNH_D: true, DIRECAO_DEFENSIVA: true },
          },
        },
        cursos: [
          { nome: "Curso de direção defensiva", horas: 40, aceito: true },
          { nome: "Primeiros socorros", horas: 61, aceito: true },
        ],
      }));
      expect(loja.obter().avaliacao.parciais.CURSOS).toBe(6);
      expect(
        loja
          .obter()
          .pendencias.some((p) => p.bloco === "CURSOS" && p.tipo === "extra"),
      ).toBe(true);
      await mostrar(loja, "CURSOS");
      expect(alvo.querySelector('[data-extra="UMCQA"]').textContent).toContain(
        "+5",
      );
      expect(alvo.querySelector('[data-aviso="8.2.7"]').textContent).toContain(
        '"Curso de direção defensiva" parece ser o requisito',
      );
      await clicar(botao('[data-extra="UMCQA"]', "Confere"));
      const st = loja.obter();
      expect(st.lancamento.blocos.CURSOS.extras).toEqual({ UMCQA: true });
      expect(st.avaliacao.parciais.CURSOS).toBe(11);
      expect(st.pendencias.some((p) => p.tipo === "extra")).toBe(false);
    });

    it("Experiência mostra a área exigida do cargo", async () => {
      const { loja } = await abrir();
      await mostrar(loja, "EXPERIENCIA");
      expect(alvo.querySelector(".avd-ficha-cargo-area").textContent).toContain(
        "Condução de veículos de maior porte",
      );
    });
  });

  describe("outro cargo", () => {
    it("cargo 11 (vaga 182444): sem lista de requisitos nem UMCQA; cursos no teto do nível", async () => {
      const { loja } = await abrir("182444");
      const st = loja.obter();
      expect(st.regra.cargo.codigo).toBe("AUXILIAR_LOGISTICA");
      await mostrar(loja, "REQUISITO_DO_CARGO");
      expect(alvo.querySelector("[data-requisito]")).toBeNull();
      await mostrar(loja, "CURSOS");
      expect(alvo.querySelector("[data-extra]")).toBeNull();
    });
  });
});

bloco("modulos/avaliacao-documental-ficha", () => {
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
      painel = montarTela(
        criarAvaliacaoDocumental,
        "page-avaliacao-documental",
        {
          supabase,
          toast,
        },
      );
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
    await clicar(
      botao("Abrir", secao.querySelector("[data-candidato='7001']")),
    );
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
  /* O avanço sozinho espera a animação do ✓ (ficha.tsx: ESPERA_PARA_AVANCAR_MS). */
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
        partes.map(
          (l) => l.querySelector(".avd-ficha-parte-valor").textContent,
        ),
      ).toEqual(["0 / 10 (prévia)", "0 / 5 (prévia)", "0 / 35 (prévia)"]);
      expect(partes.map((l) => l.dataset.previa)).toEqual([
        "sim",
        "sim",
        "sim",
      ]);
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
      ).toBe(
        "Item 3 de 6: Registro ativo no conselho de classe, quando exigido",
      );
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
      await clicar(
        document.querySelector("[data-acao='informacoes-da-ficha']"),
      );
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
        cartao("REGISTRO_CONSELHO").querySelector(
          ".avd-ficha-nao-enviou input",
        ),
      );
      await clicar(
        cartao("REGISTRO_CONSELHO").querySelector(".avd-ficha-chip"),
      );
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
          .compareDocumentPosition(resultado) &
          Node.DOCUMENT_POSITION_FOLLOWING,
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
      await clicar(
        cartao("CURSOS").querySelector("[data-valor='NAO_CONFERE']"),
      );
      const c = cartao("CURSOS");
      expect(c.querySelector(".avd-ficha-itens")).toBeNull();
      expect(c.querySelector("[data-tour='avd-ficha-motivos']")).not.toBeNull();
      expect(
        c.querySelector("[data-tour='avd-ficha-justificativa']"),
      ).toBeNull();
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
      expect(
        c.querySelector("[data-tour='avd-ficha-justificativa']"),
      ).toBeNull();
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
        cartao("EXPERIENCIA").querySelector(
          "[data-tour='avd-ficha-nota'] input",
        ).value,
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
      for (const codigo of [
        "IDENTIDADE",
        "ESCOLARIDADE",
        "REGISTRO_CONSELHO",
      ]) {
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
      const barra = () =>
        document.querySelector(".avd-ficha-barra .avd-inline");
      const confirmar = () =>
        clicar(barra().querySelector("[data-acao='confirmar-reabrir']"));
      // Sem motivo da lista, nada vai ao banco.
      await confirmar();
      expect(barra().textContent).toContain("Escolha o motivo da reabertura.");
      expect(chamadas(supabase, "reabrir_ficha")).toEqual([]);
      // "Outro" com sequência aleatória também não.
      const motivo = barra().querySelector(
        "[data-campo='motivo-da-reabertura']",
      );
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
      const barra = () =>
        document.querySelector(".avd-ficha-barra .avd-inline");
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
      expect(
        supabase.rpc.mock.calls.slice(antes).map(([nome]) => nome),
      ).toEqual(["obter_modelo_espelho_nota"]);
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
          obter_ficha_analise: () =>
            fichaDoBanco({ lancamento, editar: false }),
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
      for (
        let volta = 0;
        volta < 4 && estado.obter().pendencias.length;
        volta++
      )
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
      expect(
        rpc.mock.calls.filter(([n]) => n === "concluir_ficha"),
      ).toHaveLength(1);
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
      expect(
        cartao("FORMACAO").querySelector(".avd-ficha-ver-anexo"),
      ).toBeNull();
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
      expect(chamadas(supabase, "registrar_acesso_ficha").at(-1)).toMatchObject(
        {
          p_tipo: "ABRIR_EMPREGARE",
        },
      );
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
      expect(chamadas(supabase, "registrar_acesso_ficha").at(-1)).toMatchObject(
        {
          p_tipo: "ABRIR_EMPREGARE",
        },
      );
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
      expect(chamadas(supabase, "registrar_acesso_ficha").at(-1)).toMatchObject(
        {
          p_tipo: "ABRIR_EMPREGARE",
        },
      );
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
      expect(
        c().querySelector("[data-acao='confirmar-pelos-itens']"),
      ).toBeNull();
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

    it("rascunho 10 s depois da última mudança, mas no máximo 60 s depois da primeira pendente", async () => {
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
      expect(agendados.at(-1).ms).toBe(10000);
      // Mudanças a cada 8 s: a espera encurta até fechar 60 s da primeira.
      for (const t of [8000, 16000, 24000, 32000, 40000, 48000, 56000]) {
        agora = t;
        nivel(t % 16000 ? "superior" : "tecnico");
      }
      expect(agendados.at(-1).ms).toBe(4000);
      await agendados.at(-1).fn();
      expect(
        rpc.mock.calls.filter(([n]) => n === "salvar_rascunho_ficha"),
      ).toHaveLength(1);
      // Depois do envio, a próxima mudança volta aos 10 s.
      agora = 70000;
      nivel("tecnico");
      expect(agendados.at(-1).ms).toBe(10000);
      estado.descartar();
    });

    it("conteúdo igual ao último rascunho salvo não vai ao banco", async () => {
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
        agendar: (fn, ms) => agendados.push({ fn, ms }),
        cancelar: () => {},
        regras: new Map(),
      });
      await estado.carregar("f1");
      const nivel = (n) => estado.mudar((l) => ({ ...l, nivel: n }));
      const salvamentos = () =>
        rpc.mock.calls.filter(([n]) => n === "salvar_rascunho_ficha").length;
      nivel("superior");
      await estado.salvar();
      expect(salvamentos()).toBe(1);
      // Marca e desmarca: volta ao que foi salvo, nada a enviar.
      nivel("tecnico");
      nivel("superior");
      expect(await estado.salvar()).toBe(true);
      expect(salvamentos()).toBe(1);
      expect(estado.obter().sujo).toBe(false);
      nivel("tecnico");
      await estado.salvar();
      expect(salvamentos()).toBe(2);
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

  describe("ficha aberta: reserva vencida e troca de área sem perder o rascunho", () => {
    it("trocar de área salva a alteração pendente e só depois libera a reserva", async () => {
      const supabase = supabaseFalso();
      await abrirFicha(supabase);
      await teclar(raiz(), "1");
      // O rascunho ainda está no temporizador (3 s) quando a área muda.
      expect(chamadas(supabase, "salvar_rascunho_ficha")).toHaveLength(0);
      await act(async () => definirAreaAtual("saude-indigena"));
      await esperar();
      await esperar();
      const nomes = supabase.rpc.mock.calls.map(([n]) => n);
      expect(nomes.indexOf("salvar_rascunho_ficha")).toBeGreaterThan(-1);
      expect(nomes.lastIndexOf("liberar_reserva")).toBeGreaterThan(
        nomes.indexOf("salvar_rascunho_ficha"),
      );
    });

    it("minha reserva vencida: o cabeçalho pede para reabrir a ficha", async () => {
      const vencida = new Date(Date.now() - 60 * 1000).toISOString();
      const supabase = supabaseFalso(fichaDoBanco(), {
        reservar_ficha: () => ({
          ficha: cabecalho({
            reserva: {
              usuario: EU,
              nome: "Ana",
              desde: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
              expira: vencida,
            },
          }),
          reservada: true,
          somente_leitura: false,
        }),
      });
      await abrirFicha(supabase);
      expect(
        document.querySelector("[data-reserva='vencida']").textContent,
      ).toContain("Reserva vencida: reabra a ficha");
    });
  });

  describe("estado da ficha: descartar salva antes", () => {
    it("descartar com alteração pendente envia o rascunho e devolve o envio", async () => {
      const rpc = vi.fn(async (nome, args) => {
        if (nome === "obter_ficha_analise") return fichaDoBanco();
        if (nome === "salvar_rascunho_ficha")
          return {
            versao: args.p_versao + 1,
            salvo_em: "2026-10-22T13:00:00Z",
          };
        return null;
      });
      const estado = criarEstadoDaFicha({
        rpc,
        toast,
        agendar: () => 1,
        cancelar: () => {},
      });
      await estado.carregar("f1");
      estado.mudar((l) => ({ ...l, observacoes: "pendente" }));
      expect(await estado.descartar()).toBe(true);
      expect(
        rpc.mock.calls.filter(([n]) => n === "salvar_rascunho_ficha"),
      ).toHaveLength(1);
    });

    it("descartar sem alteração não vai ao banco", async () => {
      const rpc = vi.fn(async (nome) =>
        nome === "obter_ficha_analise" ? fichaDoBanco() : null,
      );
      const estado = criarEstadoDaFicha({ rpc, toast });
      await estado.carregar("f1");
      expect(await estado.descartar()).toBe(true);
      expect(
        rpc.mock.calls.filter(([n]) => n === "salvar_rascunho_ficha"),
      ).toHaveLength(0);
    });
  });

  describe("ficha importada da planilha (F8, 16/11/2026)", () => {
    it("mostra o resultado da planilha só para ler, sem itens, com Reabrir para a coordenação", async () => {
      const ficha = fichaDoBanco({
        situacao: "CONCLUIDA",
        editar: false,
        reabrir: true,
        lancamento: {
          importada_da_planilha: {
            linha: "l1",
            versao: 6,
            em: "2026-11-16T23:40:00+00:00",
            status: "Aprovado",
            responsavel: "Bia Analista",
            data: "2026-10-06",
            nota_final: 52.5,
            parciais: { FORMACAO: 20, EXPERIENCIA: 32.5 },
            modalidade: "Ampla concorrência",
            link_pdf: "https://drive.google.com/espelho",
          },
        },
      });
      ficha.ficha.tp_resultado = "APTO";
      ficha.ficha.nota_final = 52.5;
      ficha.ficha.parecer = "Parecer da planilha";
      await abrirFicha(supabaseFalso(ficha));
      const raiz = document.querySelector(".avd-ficha[data-importada='sim']");
      expect(raiz).toBeTruthy();
      expect(raiz.textContent).toContain(
        "Resultado importado da planilha em 16/11/2026.",
      );
      expect(raiz.textContent).toContain("52,50");
      expect(raiz.textContent).toContain("Escolaridade");
      expect(raiz.textContent).toContain("Bia Analista em 06/10/2026");
      expect(raiz.textContent).toContain("Parecer da planilha");
      const espelho = raiz.querySelector("a.btn");
      expect(espelho.textContent).toBe("Espelho da planilha");
      expect(espelho.getAttribute("href")).toBe(
        "https://drive.google.com/espelho",
      );
      expect(espelho.getAttribute("rel")).toBe("noopener noreferrer");
      expect(raiz.querySelector(".avd-ficha-decisao")).toBeNull();
      expect(document.querySelector(".avd-ficha-salvo").textContent).toBe(
        "Concluída na planilha",
      );
      expect(botao("Reabrir", raiz)).toBeTruthy();
    });
  });
});

bloco("modulos/avaliacao-documental-fila", () => {
  /*
  A aba Fila da Avaliação documental (fase F3): etapas com contadores,
  filtros (e salvos), Pegar próximo, Minhas fichas, ações em lote da
  coordenação com prévia e motivo, a ficha aberta com a reserva e o seletor
  de editais só com os vigentes. Códigos AM-6.x, AM-12.2 e AM-3.3 de
  docs/historias-de-usuario/analises-no-monitora.md.
*/

  const EU = "u-ana";
  const AGORA_MAIS = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const ficha = (id, situacao, extra = {}) => ({
    id,
    versao: 3,
    situacao,
    responsavel: null,
    responsavel_nome: null,
    reserva: null,
    ...extra,
  });
  const inscrito = (codigo, extra) => ({
    id: `c-${codigo}`,
    vaga: "179698",
    codigo,
    nome: `Pessoa ${codigo}`,
    situacao_pre: "NO_LOTE",
    posicao: 1,
    lote: 1,
    art: 20,
    modalidade: "AC",
    ficha: null,
    ...extra,
  });

  function fila({ coordena = true, pegar = true } = {}) {
    return {
      schema_version: 1,
      edital: { id: "e93", rotulo: "93/2026" },
      papel: coordena ? "COORDENADOR" : "ANALISTA",
      pode_coordenar: coordena,
      pode_pegar: pegar,
      eu: EU,
      prazo_reserva_min: 15,
      distribuicao: {
        modo: "PEGAR_PROXIMO",
        criterio: "PARTES_IGUAIS",
        novos: "MENOS_PENDENTES",
      },
      sem_ficha: 1,
      vagas: [{ codigo: "179698", cargo: "Técnico" }],
      analistas: [
        { usuario: EU, nome: "Ana", vagas: null, limite: null, pendentes: 1 },
        {
          usuario: "u-beto",
          nome: "Beto",
          vagas: null,
          limite: null,
          pendentes: 0,
        },
      ],
      filtros: [
        {
          id: "fs1",
          nome: "Minhas em análise",
          filtro: { etapa: "em_analise", responsavel: "eu" },
        },
      ],
      candidatos: [
        inscrito("7001", {
          posicao: 1,
          ficha: ficha("f1", "EM_ANALISE", {
            responsavel: EU,
            responsavel_nome: "Ana",
            reserva: {
              usuario: "u-beto",
              nome: "Beto",
              desde: new Date().toISOString(),
              expira: AGORA_MAIS,
            },
          }),
        }),
        inscrito("7002", { posicao: 2, ficha: ficha("f2", "PENDENTE") }),
        inscrito("7003", { posicao: 3, ficha: ficha("f3", "PENDENTE") }),
        inscrito("7004", { posicao: 4 }),
        inscrito("7009", {
          situacao_pre: "ELIMINADO",
          posicao: null,
          lote: null,
          motivo_eliminacao: "Cancelou",
        }),
      ],
    };
  }

  function supabaseFalso(dados = fila(), extra = {}) {
    const respostas = {
      listar_editais_avaliacao: () => ({
        area: "projetos",
        editais: [
          {
            id: "e93",
            edital: "93/2026",
            unidade: "Boa Vista",
            ativo: true,
            status: "Em andamento",
          },
          {
            id: "e23",
            edital: "23/2025",
            unidade: "Boa Vista",
            ativo: true,
            status: "Concluído",
          },
          {
            id: "fcc",
            edital: "FCC",
            unidade: "",
            ativo: true,
            status: "Concluído",
          },
        ],
      }),
      obter_regra_analise: () => ({
        edital: { id: "e93", edital: "93/2026", area: "projetos" },
        papel: dados.papel,
        pode_coordenar: dados.pode_coordenar,
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
      obter_fila_avaliacao: () => dados,
      reservar_ficha: ({ p_ficha }) => ({
        ficha: {
          id: p_ficha,
          versao: 4,
          vaga: "179698",
          cargo: "Técnico",
          codigo: "7001",
          nome: "Pessoa 7001",
          posicao: 1,
          lote: 1,
          art: 20,
          modalidade: "AC",
          situacao: "EM_ANALISE",
          responsavel_nome: "Ana",
          reserva: {
            usuario: "u-beto",
            nome: "Beto",
            desde: new Date().toISOString(),
            expira: AGORA_MAIS,
          },
        },
        reservada: false,
        somente_leitura: true,
        motivo: "Em uso por outra pessoa.",
      }),
      pegar_proxima_ficha: () => ({
        ficha: null,
        reservada: false,
        motivo: "Nenhuma ficha livre na fila.",
      }),
      distribuir_fichas: ({ p_atribuicoes }) => ({
        alteradas: p_atribuicoes.length,
      }),
      liberar_reserva: ({ p_fichas }) => ({ liberadas: p_fichas.length }),
      mandar_fichas_revisao: ({ p_fichas }) => ({ alteradas: p_fichas.length }),
      abrir_fichas_do_edital: () => ({ criadas: 1 }),
      salvar_filtro_fila: ({ p_nome, p_filtro }) => [
        { id: "fs2", nome: p_nome, filtro: p_filtro },
      ],
      excluir_filtro_fila: () => [],
      // Banco sem as páginas dos eliminados (antes de 20261029120000): a lista inteira.
      listar_eliminados_fila: () =>
        Object.assign(new Error("Could not find the function"), {
          code: "PGRST202",
        }),
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

  async function montar(supabase, { abrirFila = true, getProfile } = {}) {
    secao = document.createElement("section");
    secao.id = "page-avaliacao-documental";
    secao.className = "page active";
    document.body.append(secao);
    await act(async () => {
      painel = montarTela(
        criarAvaliacaoDocumental,
        "page-avaliacao-documental",
        {
          supabase,
          toast,
          getProfile,
        },
      );
    });
    await act(async () => void painel.render());
    await esperar();
    await escolher(secao.querySelector(".avd-edital select"), "e93");
    await esperar();
    // Quem não coordena já abre na Fila, sem o seletor de abas.
    const aba = secao.querySelector(
      "[data-tour='avd-visoes'] [data-valor='fila']",
    );
    if (abrirFila && aba) {
      await clicar(aba);
      await esperar();
    }
  }
  const botao = (texto, raiz = document.body) =>
    [...raiz.querySelectorAll("button")].find((b) =>
      b.textContent.trim().startsWith(texto),
    );
  /* O menu "Ações da coordenação" (as ações só aparecem com ele aberto). */
  const abrirMenu = () =>
    clicar(
      secao.querySelector(
        "[data-tour='avd-fila-acoes-coordenacao'] [data-acao='abrir-menu']",
      ),
    );
  const linhas = () =>
    [
      ...secao.querySelectorAll(
        "[data-tour='avd-fila-tabela'] tbody tr[data-candidato]",
      ),
    ].map((tr) => tr.dataset.candidato);
  /* A faixa de situação (os números-filtro e os links da linha de baixo). */
  const faixa = () => secao.querySelector("[data-tour='avd-fila-etapas']");
  const numeroDaFaixa = (valor) =>
    faixa().querySelector(`[data-valor='${valor}'] .ui-faixa-numero`)
      ?.textContent;
  /* Etapas fora da faixa (Inscritos, Eliminados: filtro salvo ou endereço). */
  const irParaEtapa = async (etapa) => {
    await act(async () => painel.fila.mudarFiltro({ etapa }));
    await esperar();
  };
  const filtro = (rotulo) =>
    secao.querySelector(`.avd-fila-filtros select[aria-label='${rotulo}']`);
  const contagemDaLista = () =>
    secao.querySelector("[data-tour='avd-fila-tabela'] .ui-lista-contagem")
      .textContent;

  beforeEach(() => {
    redefinirDadosDoMonitoramento();
    definirAreaAtual("projetos");
    try {
      globalThis.sessionStorage?.clear();
    } catch {
      /* sem sessão */
    }
    try {
      globalThis.localStorage?.clear();
    } catch {
      /* sem armazenamento */
    }
  });
  afterEach(async () => {
    await act(async () => painel?.raiz?.unmount());
    secao?.remove();
    document.body.innerHTML = "";
    redefinirDadosDoMonitoramento();
    toast.mockClear();
  });

  describe("seletor de editais: só os vigentes", () => {
    it("esconde os concluídos e mostra todos com a caixa; o escolhido fica", async () => {
      await montar(supabaseFalso(), { abrirFila: false });
      const opcoes = () =>
        [...secao.querySelectorAll(".avd-edital select option")]
          .map((o) => o.value)
          .filter(Boolean);
      expect(opcoes()).toEqual(["e93"]);
      const caixa = secao.querySelector(
        "[data-tour='avd-todos-editais'] input",
      );
      await clicar(caixa);
      expect(opcoes()).toEqual(["e93", "e23", "fcc"]);
      await escolher(secao.querySelector(".avd-edital select"), "e23");
      await esperar();
      await clicar(caixa);
      expect(opcoes()).toEqual(["e93", "e23"]);
    });
  });

  describe("Fila (AM-6)", () => {
    it("etapas com contadores filtram a lista; No lote é a inicial", async () => {
      const supabase = supabaseFalso();
      await montar(supabase);
      expect(supabase.rpc).toHaveBeenCalledWith("obter_fila_avaliacao", {
        p_edital: "e93",
      });
      expect(
        ["lote", "pendentes", "em_analise", "revisao", "concluidas"].map(
          numeroDaFaixa,
        ),
      ).toEqual(["4", "3", "1", "0", "0"]);
      expect(
        faixa()
          .querySelector("[data-valor='lote']")
          .getAttribute("aria-pressed"),
      ).toBe("true");
      expect(faixa().querySelector("[data-valor='fora']").textContent).toBe(
        "1 fora do lote",
      );
      // A barra da distribuição diz a proporção no nome acessível.
      expect(
        faixa().querySelector("[role='img']").getAttribute("aria-label"),
      ).toBe("Distribuição do lote: 25% em análise, 75% pendentes");
      expect(linhas()).toEqual(["7001", "7002", "7003", "7004"]);
      await clicar(faixa().querySelector("[data-valor='fora']"));
      expect(linhas()).toEqual(["7009"]);
      await clicar(faixa().querySelector("[data-valor='pendentes']"));
      expect(linhas()).toEqual(["7002", "7003", "7004"]);
    });

    it("Minhas fichas, filtro salvo e salvar um filtro novo", async () => {
      const supabase = supabaseFalso();
      await montar(supabase);
      await escolher(filtro("Responsável"), "eu");
      expect(linhas()).toEqual(["7001"]);
      // Os filtros salvos ficam em "Filtros" (os secundários).
      await clicar(secao.querySelector("[data-acao='mais-filtros']"));
      await clicar(botao("Salvar filtro", secao));
      await digitar(
        secao.querySelector("[data-tour='avd-fila-filtros-salvos'] form input"),
        "Só as minhas",
      );
      await clicar(
        botao(
          "Salvar",
          secao.querySelector("[data-tour='avd-fila-filtros-salvos'] form"),
        ),
      );
      await esperar();
      expect(supabase.rpc).toHaveBeenCalledWith("salvar_filtro_fila", {
        p_nome: "Só as minhas",
        p_filtro: {
          etapa: "lote",
          vaga: "",
          responsavel: "eu",
          modalidade: "",
          busca: "",
        },
      });
    });

    it("AM-6.4 e AM-12.2: o código abre direto; ficha em uso por outra pessoa só para leitura", async () => {
      const supabase = supabaseFalso();
      await montar(supabase);
      expect(
        secao.querySelector("[data-candidato='7001']").textContent,
      ).toMatch(/Em uso por Beto desde \d{2}:\d{2}/);
      const busca = secao.querySelector("[data-tour='avd-fila-busca']");
      await digitar(busca, "7001");
      await teclar(busca, "Enter");
      await esperar();
      expect(supabase.rpc).toHaveBeenCalledWith("reservar_ficha", {
        p_ficha: "f1",
      });
      const gaveta = document.querySelector("[data-tour='avd-ficha']");
      expect(gaveta.textContent).toContain("Código 7001");
      expect(gaveta.textContent).toContain(
        "Só leitura: Em uso por outra pessoa.",
      );
      // O conteúdo da ficha (F4) é lido à parte: tests/avaliacao-e-recursos-na-tela.test.js (bloco modulos/avaliacao-documental-ficha).
      expect(supabase.rpc).toHaveBeenCalledWith("obter_ficha_analise", {
        p_ficha: "f1",
      });
      expect(gaveta.textContent).not.toMatch(/\d{3}\.\d{3}\.\d{3}-\d{2}/);
      // A coordenação libera a reserva presa, com motivo.
      await clicar(botao("Liberar a reserva"));
      await digitar(gaveta.querySelector("input"), "Reserva presa desde ontem");
      // Duplo clique: um pedido só (antes saíam dois, com auditoria em dobro).
      const liberar = botao("Liberar", gaveta);
      await act(async () => {
        liberar.click();
        liberar.click();
      });
      await esperar();
      expect(supabase.rpc).toHaveBeenCalledWith("liberar_reserva", {
        p_edital: "e93",
        p_fichas: ["f1"],
        p_motivo: "Reserva presa desde ontem",
      });
      expect(
        supabase.rpc.mock.calls.filter(([nome]) => nome === "liberar_reserva"),
      ).toHaveLength(1);
    });

    it("AM-6.1: Pegar próximo sem ficha livre avisa", async () => {
      const supabase = supabaseFalso();
      await montar(supabase);
      await clicar(secao.querySelector("[data-tour='avd-fila-pegar']"));
      await esperar();
      expect(supabase.rpc).toHaveBeenCalledWith("pegar_proxima_ficha", {
        p_edital: "e93",
        p_vaga: null,
      });
      expect(toast).toHaveBeenCalledWith(
        "Nenhuma ficha livre na fila.",
        "info",
      );
    });

    it("AM-6.2: distribuir as livres mostra a prévia e só grava ao confirmar", async () => {
      const supabase = supabaseFalso();
      await montar(supabase);
      await abrirMenu();
      await clicar(
        secao.querySelector("[data-tour='avd-fila-distribuir-livres']"),
      );
      const gaveta = document.querySelector("[data-tour='avd-fila-confirmar']");
      const previa = [...gaveta.querySelectorAll("tbody tr")].map(
        (tr) => tr.textContent,
      );
      expect(previa).toEqual(["Ana12", "Beto11"]);
      expect(supabase.rpc).not.toHaveBeenCalledWith(
        "distribuir_fichas",
        expect.anything(),
      );
      await clicar(gaveta.querySelector("[data-acao='confirmar-distribuir']"));
      await esperar();
      expect(supabase.rpc).toHaveBeenCalledWith("distribuir_fichas", {
        p_edital: "e93",
        p_atribuicoes: [
          { ficha: "f2", versao: 3, usuario: "u-beto" },
          { ficha: "f3", versao: 3, usuario: EU },
        ],
        p_motivo: null,
      });
    });

    it("AM-6.3: redistribuir pede motivo; versão velha volta com a mensagem do banco", async () => {
      const erro = Object.assign(
        new Error(
          "1 ficha(s) mudaram desde que você abriu a fila; atualize e confira.",
        ),
        { code: "40001" },
      );
      const supabase = supabaseFalso(fila(), { distribuir_fichas: () => erro });
      await montar(supabase);
      await clicar(secao.querySelector("[aria-label='Selecionar 7001']"));
      await clicar(
        secao.querySelector("[data-acao='distribuir-selecionadas']"),
      );
      const gaveta = document.querySelector("[data-tour='avd-fila-confirmar']");
      await escolher(gaveta.querySelector("select"), "u-beto");
      const confirmar = gaveta.querySelector(
        "[data-acao='confirmar-distribuir']",
      );
      expect(confirmar.disabled).toBe(true);
      await digitar(
        gaveta.querySelector("textarea"),
        "Ana de férias na semana",
      );
      expect(confirmar.disabled).toBe(false);
      await clicar(confirmar);
      await esperar();
      expect(gaveta.textContent).toContain(
        "mudaram desde que você abriu a fila",
      );
    });

    it("ficha concluída: Reabrir na seleção com o motivo da lista; Atribuir e Revisão ficam fora (AM-6.3)", async () => {
      const dados = fila();
      dados.candidatos.push(
        inscrito("7005", {
          posicao: 5,
          ficha: ficha("f5", "CONCLUIDA", {
            responsavel: "u-beto",
            responsavel_nome: "Beto",
            resultado: "INAPTO",
          }),
        }),
      );
      const supabase = supabaseFalso(dados, {
        reabrir_fichas: ({ p_fichas }) => ({ reabertas: p_fichas.length }),
      });
      await montar(supabase);
      await clicar(secao.querySelector("[aria-label='Selecionar 7005']"));
      const lote = secao.querySelector("[data-tour='avd-fila-acoes-lote']");
      expect(
        lote.querySelector("[data-acao='distribuir-selecionadas']").disabled,
      ).toBe(true);
      expect(
        lote.querySelector("[data-acao='mandar-para-revisao']").disabled,
      ).toBe(true);
      const reabrir = lote.querySelector("[data-acao='reabrir-selecionadas']");
      expect(reabrir.disabled).toBe(false);
      await clicar(reabrir);
      const gaveta = document.querySelector("[data-tour='avd-fila-confirmar']");
      expect(gaveta.textContent).toContain("Reabrir fichas");
      const confirmar = gaveta.querySelector("[data-acao='confirmar-reabrir']");
      expect(confirmar.disabled).toBe(true);
      await escolher(
        gaveta.querySelector("[data-campo='motivo-da-reabertura']"),
        "COORDENACAO",
      );
      expect(confirmar.disabled).toBe(false);
      await clicar(confirmar);
      await esperar();
      expect(supabase.rpc).toHaveBeenCalledWith("reabrir_fichas", {
        p_edital: "e93",
        p_fichas: [{ ficha: "f5", versao: 3 }],
        p_motivo: "COORDENACAO",
        p_complemento: null,
      });
    });

    it("Reabrir com “Outro” exige a descrição", async () => {
      const dados = fila();
      dados.candidatos.push(
        inscrito("7005", { posicao: 5, ficha: ficha("f5", "CONCLUIDA") }),
      );
      await montar(supabaseFalso(dados));
      await clicar(secao.querySelector("[aria-label='Selecionar 7005']"));
      await clicar(secao.querySelector("[data-acao='reabrir-selecionadas']"));
      const gaveta = document.querySelector("[data-tour='avd-fila-confirmar']");
      const confirmar = gaveta.querySelector("[data-acao='confirmar-reabrir']");
      await escolher(
        gaveta.querySelector("[data-campo='motivo-da-reabertura']"),
        "OUTRO",
      );
      expect(confirmar.disabled).toBe(true);
      await digitar(
        gaveta.querySelector("[data-campo='complemento-da-reabertura']"),
        "Pedido da banca para conferir a vaga",
      );
      expect(confirmar.disabled).toBe(false);
    });

    it("analista não vê as ações da coordenação", async () => {
      await montar(supabaseFalso(fila({ coordena: false })));
      expect(secao.querySelector("[aria-label='Selecionar 7001']")).toBeNull();
      expect(
        secao.querySelector("[data-tour='avd-fila-distribuir-livres']"),
      ).toBeNull();
      expect(
        secao.querySelector("[data-tour='avd-fila-acoes-coordenacao']"),
      ).toBeNull();
      expect(
        secao.querySelector("[data-tour='avd-fila-pegar']"),
      ).not.toBeNull();
      expect(
        [...filtro("Responsável").options].map((o) => o.textContent),
      ).toContain("Minhas fichas");
    });
  });

  describe("listas da fila: colunas por aba, ordem, N de M e CSV", () => {
    const cabecalhos = () =>
      [...secao.querySelectorAll("[data-tour='avd-fila-tabela'] thead th")].map(
        (th) => th.textContent.trim(),
      );

    it("Eliminados mostra o motivo e a ART, sem posição, responsável nem reserva", async () => {
      await montar(supabaseFalso());
      await irParaEtapa("eliminados");
      expect(cabecalhos()).toEqual([
        "Pessoa",
        "Vaga",
        "Motivo da eliminação",
        "Nota declarada",
      ]);
      const art = secao.querySelector(
        "[data-tour='avd-fila-tabela'] thead th:last-child",
      );
      expect(art.title).toMatch(/^ART: Autodeclaração de Requisitos e Títulos/);
      const linha = secao.querySelector("[data-candidato='7009']");
      expect(linha.textContent).toContain("Cancelou");
      expect(linha.textContent).toContain("20");
    });

    it("a tabela não fica dentro de um card com padding (cabeçalho fixo no topo da rolagem)", async () => {
      await montar(supabaseFalso());
      const rolagem = secao.querySelector(
        "[data-tour='avd-fila-tabela'] .ui-tabela-rolagem",
      );
      expect(rolagem.classList.contains("ui-card")).toBe(false);
      expect(
        rolagem.querySelector("thead input[type='checkbox']"),
      ).not.toBeNull();
    });

    it("ordena pela coluna, mostra N de M e exporta o CSV da aba na ordem da tela", async () => {
      const supabase = supabaseFalso();
      await montar(supabase);
      const ordenar = (nome) =>
        [
          ...secao.querySelectorAll("[data-tour='avd-fila-tabela'] th button"),
        ].find((b) => b.textContent.trim() === nome);
      expect(contagemDaLista()).toBe("Mostrando 4 de 4");
      // A pessoa ordena pelo nome.
      await clicar(ordenar("Pessoa"));
      await clicar(ordenar("Pessoa"));
      expect(linhas()).toEqual(["7004", "7003", "7002", "7001"]);
      expect(
        secao.querySelector(
          "[data-tour='avd-fila-tabela'] th[aria-sort='descending']",
        ).textContent,
      ).toContain("Pessoa");
      // A pessoa: o nome e, embaixo, "código · modalidade".
      expect(
        secao.querySelector("[data-candidato='7004'] .ui-pessoa").textContent,
      ).toBe("Pessoa 70047004 · AC");
      await digitar(
        secao.querySelector("[data-tour='avd-fila-busca']"),
        "7002",
      );
      expect(contagemDaLista()).toBe("Mostrando 1 de 1");
      await digitar(secao.querySelector("[data-tour='avd-fila-busca']"), "");
      const blobs = [];
      const original = {
        criar: URL.createObjectURL,
        soltar: URL.revokeObjectURL,
      };
      URL.createObjectURL = (blob) => {
        blobs.push(blob);
        return "blob:falso";
      };
      URL.revokeObjectURL = () => {};
      const clique = vi
        .spyOn(HTMLAnchorElement.prototype, "click")
        .mockImplementation(() => {});
      try {
        await clicar(secao.querySelector("[data-acao='exportar-csv']"));
        expect(blobs).toHaveLength(1);
        const texto = await blobs[0].text();
        const [cabeca, primeira] = texto.replace(/^\uFEFF/, "").split("\r\n");
        expect(cabeca).toBe(
          "Vaga;Posição;Código;Nome;Nota declarada (ART);Situação;Responsável;Reserva",
        );
        expect(primeira.split(";")[2]).toBe("7004");
      } finally {
        clique.mockRestore();
        URL.createObjectURL = original.criar;
        URL.revokeObjectURL = original.soltar;
      }
    });
  });

  describe("modo de análise: a ficha ocupa a tela", () => {
    /* Cada ficha reservada para mim, com o cabeçalho do inscrito. */
    const reservarMinha = ({ p_ficha }) => {
      const c = fila().candidatos.find((x) => x.ficha?.id === p_ficha);
      return {
        ficha: {
          ...c.ficha,
          id: p_ficha,
          vaga: c.vaga,
          codigo: c.codigo,
          nome: c.nome,
          posicao: c.posicao,
          art: c.art,
          modalidade: c.modalidade,
          reserva: {
            usuario: EU,
            nome: "Ana",
            desde: new Date().toISOString(),
            expira: AGORA_MAIS,
          },
        },
        reservada: true,
        somente_leitura: false,
      };
    };
    const abrirPelaLista = async (codigo) => {
      await clicar(
        secao.querySelector(
          `[data-candidato='${codigo}'] [data-acao='abrir-ficha']`,
        ),
      );
      await esperar();
    };

    it("abrir esconde a lista, o topo da tela e o edital; Voltar à fila (ou Esc) volta e solta a reserva", async () => {
      const supabase = supabaseFalso(fila(), { reservar_ficha: reservarMinha });
      await montar(supabase);
      await abrirPelaLista("7002");
      const analise = secao.querySelector("[data-tour='avd-ficha']");
      expect(analise.tagName).toBe("SECTION");
      // O nome grande com o código; os chips só com o essencial (a ART com a dica).
      expect(analise.querySelector("h2").textContent).toBe(
        "Pessoa 7002Código 7002",
      );
      expect(analise.querySelector(".avd-analise-dados").textContent).toContain(
        "Declarada 20",
      );
      expect(
        analise.querySelector(
          ".avd-analise-dados .avd-chip[title^='ART: Autodeclaração']",
        ),
      ).not.toBeNull();
      expect(secao.querySelector("[data-tour='avd-fila-tabela']")).toBeNull();
      expect(secao.querySelector("[data-tour='avd-visoes']")).toBeNull();
      expect(secao.querySelector(".avd-edital")).toBeNull();
      expect(secao.querySelector(".avd-tela").dataset.modo).toBe("analise");
      expect(document.querySelector(".modal.show")).toBeNull();
      expect(
        JSON.parse(
          sessionStorage.getItem("monitora.avaliacao-documental.ficha-aberta"),
        ),
      ).toEqual({
        edital: "e93",
        ficha: "f2",
      });

      await clicar(secao.querySelector("[data-acao='voltar-a-fila']"));
      await esperar();
      expect(secao.querySelector("[data-tour='avd-ficha']")).toBeNull();
      expect(
        secao.querySelector("[data-tour='avd-fila-tabela']"),
      ).not.toBeNull();
      expect(supabase.rpc).toHaveBeenCalledWith("liberar_reserva", {
        p_edital: "e93",
        p_fichas: ["f2"],
        p_motivo: null,
      });
      expect(
        sessionStorage.getItem("monitora.avaliacao-documental.ficha-aberta"),
      ).toBeNull();

      await abrirPelaLista("7003");
      await teclar(document.body, "Escape");
      await esperar();
      expect(secao.querySelector("[data-tour='avd-ficha']")).toBeNull();
    });

    it("Anterior / Próxima andam pela lista filtrada, na ordem da tabela", async () => {
      const supabase = supabaseFalso(fila(), { reservar_ficha: reservarMinha });
      await montar(supabase);
      const ordenar = [
        ...secao.querySelectorAll("[data-tour='avd-fila-tabela'] th button"),
      ].find((b) => b.textContent.trim() === "Pessoa");
      await clicar(ordenar);
      await clicar(ordenar);
      await abrirPelaLista("7003");
      const navegacao = () => secao.querySelector(".avd-analise-navegacao");
      expect(navegacao().textContent).toContain("1 de 3");
      expect(secao.querySelector("[data-acao='ficha-anterior']").disabled).toBe(
        true,
      );
      await clicar(secao.querySelector("[data-acao='ficha-proxima']"));
      await esperar();
      expect(
        secao.querySelector("[data-tour='avd-ficha'] h2").textContent,
      ).toContain("Código 7002");
      expect(navegacao().textContent).toContain("2 de 3");
      await clicar(secao.querySelector("[data-acao='ficha-proxima']"));
      await esperar();
      expect(
        secao.querySelector("[data-tour='avd-ficha'] h2").textContent,
      ).toContain("Código 7001");
      expect(secao.querySelector("[data-acao='ficha-proxima']").disabled).toBe(
        true,
      );
      await clicar(secao.querySelector("[data-acao='ficha-anterior']"));
      await esperar();
      expect(
        secao.querySelector("[data-tour='avd-ficha'] h2").textContent,
      ).toContain("Código 7002");
      const reservas = supabase.rpc.mock.calls
        .filter(([n]) => n === "reservar_ficha")
        .map(([, a]) => a.p_ficha);
      expect(reservas).toEqual(["f3", "f2", "f1", "f2"]);
    });

    it("recarregar a página volta ao edital, à Fila e à ficha que estava aberta", async () => {
      sessionStorage.setItem(
        "monitora.avaliacao-documental.ficha-aberta",
        JSON.stringify({ edital: "e93", ficha: "f3" }),
      );
      const supabase = supabaseFalso(fila(), { reservar_ficha: reservarMinha });
      secao = document.createElement("section");
      secao.id = "page-avaliacao-documental";
      secao.className = "page active";
      document.body.append(secao);
      await act(async () => {
        painel = montarTela(
          criarAvaliacaoDocumental,
          "page-avaliacao-documental",
          { supabase, toast },
        );
      });
      await act(async () => void painel.render());
      await esperar();
      await esperar();
      await esperar();
      expect(supabase.rpc).toHaveBeenCalledWith("reservar_ficha", {
        p_ficha: "f3",
      });
      expect(
        secao.querySelector("[data-tour='avd-ficha'] h2").textContent,
      ).toContain("Código 7003");
    });
  });

  describe("estado da fila: reserva", () => {
    it("renova enquanto a ficha está aberta e libera ao fechar", async () => {
      const agendados = [];
      const supabase = supabaseFalso(fila(), {
        reservar_ficha: ({ p_ficha }) => ({
          ficha: { id: p_ficha, versao: 2 },
          reservada: true,
          somente_leitura: false,
        }),
        renovar_reserva: ({ p_ficha }) => ({
          ficha: { id: p_ficha, versao: 2, reserva: { expira: AGORA_MAIS } },
        }),
      });
      const estado = criarEstadoDaFila({
        supabase,
        toast,
        armazenamento: null,
        agendar: (fn) => agendados.push(fn) && agendados.length,
        cancelar: () => {},
      });
      await estado.carregar("e93");
      await estado.abrir("f2");
      expect(agendados).toHaveLength(1);
      await agendados[0]();
      expect(supabase.rpc).toHaveBeenCalledWith("renovar_reserva", {
        p_ficha: "f2",
      });
      await estado.fechar();
      expect(supabase.rpc).toHaveBeenCalledWith("liberar_reserva", {
        p_edital: "e93",
        p_fichas: ["f2"],
        p_motivo: null,
      });
      expect(estado.obter().aberta).toBeNull();
    });

    it("renovação recusada vira só leitura com o motivo", async () => {
      const agendados = [];
      const erro = Object.assign(new Error("A ficha não está mais com você"), {
        code: "40001",
      });
      const supabase = supabaseFalso(fila(), {
        reservar_ficha: ({ p_ficha }) => ({
          ficha: { id: p_ficha, versao: 2 },
          reservada: true,
        }),
        renovar_reserva: () => erro,
      });
      const estado = criarEstadoDaFila({
        supabase,
        armazenamento: null,
        agendar: (fn) => agendados.push(fn),
        cancelar: () => {},
      });
      await estado.carregar("e93");
      await estado.abrir("f2");
      await agendados[0]();
      expect(estado.obter().aberta.somente_leitura).toBe(true);
      expect(estado.obter().aberta.motivo).toContain("não está mais com você");
    });
  });

  /*
  A reserva só é renovada com alguém na ficha: aba no fundo ou 20 minutos sem
  mexer param a renovação (a reserva vence sozinha no banco); a volta renova.
*/
  describe("estado da fila: reserva só com alguém na ficha", () => {
    function documentoFalso() {
      const alvo = new EventTarget();
      return Object.assign(alvo, { visibilityState: "visible" });
    }
    async function montarReserva({ renovar } = {}) {
      vi.useFakeTimers();
      const documento = documentoFalso();
      const salvar = vi.fn(async () => true);
      const supabase = supabaseFalso(fila(), {
        reservar_ficha: ({ p_ficha }) => ({
          ficha: { id: p_ficha, versao: 2 },
          reservada: true,
          somente_leitura: false,
        }),
        renovar_reserva:
          renovar ??
          (({ p_ficha }) => ({
            ficha: { id: p_ficha, versao: 2, reserva: { expira: AGORA_MAIS } },
          })),
      });
      const estado = criarEstadoDaFila({
        supabase,
        toast,
        armazenamento: null,
        sessao: null,
        documento,
        agora: () => Date.now(),
      });
      await estado.carregar("e93");
      await estado.abrir("f2");
      estado.registrarSalvamento("f2", salvar);
      const renovacoes = () =>
        supabase.rpc.mock.calls.filter(([nome]) => nome === "renovar_reserva")
          .length;
      return { documento, estado, salvar, renovacoes };
    }
    afterEach(() => vi.useRealTimers());

    it("aba no fundo não renova; a volta renova na hora", async () => {
      const { documento, salvar, renovacoes } = await montarReserva();
      await vi.advanceTimersByTimeAsync(RENOVAR_A_CADA_MS);
      expect(renovacoes()).toBe(1);
      documento.visibilityState = "hidden";
      documento.dispatchEvent(new Event("visibilitychange"));
      await vi.advanceTimersByTimeAsync(RENOVAR_A_CADA_MS);
      expect(renovacoes()).toBe(1);
      // Parou: o rascunho pendente foi salvo e nada mais vai ao banco.
      expect(salvar).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(RENOVAR_A_CADA_MS * 12);
      expect(renovacoes()).toBe(1);
      documento.visibilityState = "visible";
      documento.dispatchEvent(new Event("visibilitychange"));
      await vi.advanceTimersByTimeAsync(0);
      expect(renovacoes()).toBe(2);
      await vi.advanceTimersByTimeAsync(RENOVAR_A_CADA_MS);
      expect(renovacoes()).toBe(3);
    });

    it("20 minutos sem atividade param a renovação; a atividade a retoma", async () => {
      const { documento, renovacoes } = await montarReserva();
      await vi.advanceTimersByTimeAsync(INATIVIDADE_MAXIMA_MS);
      // Renovou nos 5, 10 e 15 minutos; aos 20, ninguém mexeu: para.
      expect(renovacoes()).toBe(3);
      await vi.advanceTimersByTimeAsync(RENOVAR_A_CADA_MS * 6);
      expect(renovacoes()).toBe(3);
      documento.dispatchEvent(new Event("keydown"));
      documento.dispatchEvent(new Event("pointerdown"));
      await vi.advanceTimersByTimeAsync(0);
      expect(renovacoes()).toBe(4);
    });

    it("atividade adia a pausa", async () => {
      const { documento, renovacoes } = await montarReserva();
      for (let i = 0; i < 8; i += 1) {
        await vi.advanceTimersByTimeAsync(RENOVAR_A_CADA_MS);
        documento.dispatchEvent(new Event("wheel"));
      }
      expect(renovacoes()).toBe(8);
    });

    it("outra pessoa pegou a ficha no intervalo: só leitura com o aviso, sem apagar o rascunho", async () => {
      let vezes = 0;
      const { documento, estado, renovacoes } = await montarReserva({
        renovar: ({ p_ficha }) =>
          (vezes += 1) === 1
            ? { ficha: { id: p_ficha, versao: 2 } }
            : Object.assign(
                new Error(
                  "A ficha não está mais com você (reserva liberada ou com outra pessoa); abra de novo.",
                ),
                { code: "PT409" },
              ),
      });
      documento.visibilityState = "hidden";
      await vi.advanceTimersByTimeAsync(RENOVAR_A_CADA_MS);
      expect(renovacoes()).toBe(0);
      documento.visibilityState = "visible";
      documento.dispatchEvent(new Event("visibilitychange"));
      await vi.advanceTimersByTimeAsync(0);
      expect(renovacoes()).toBe(1);
      expect(estado.obter().aberta.reservada).toBe(true);
      await vi.advanceTimersByTimeAsync(RENOVAR_A_CADA_MS);
      expect(renovacoes()).toBe(2);
      const aberta = estado.obter().aberta;
      expect(aberta.somente_leitura).toBe(true);
      expect(aberta.ficha.id).toBe("f2");
      expect(aberta.motivo).toContain("não está mais com você");
    });

    it("volta com a reserva tomada: avisa que venceu enquanto estava fora", async () => {
      const { documento, estado, renovacoes } = await montarReserva({
        renovar: () =>
          Object.assign(new Error("A ficha não está mais com você"), {
            code: "PT409",
          }),
      });
      documento.visibilityState = "hidden";
      await vi.advanceTimersByTimeAsync(RENOVAR_A_CADA_MS);
      documento.visibilityState = "visible";
      documento.dispatchEvent(new Event("visibilitychange"));
      await vi.advanceTimersByTimeAsync(0);
      expect(renovacoes()).toBe(1);
      expect(estado.obter().aberta.somente_leitura).toBe(true);
      expect(estado.obter().aberta.motivo).toContain(
        "venceu enquanto você estava fora",
      );
      // Sem reserva, nada mais é renovado.
      documento.dispatchEvent(new Event("keydown"));
      await vi.advanceTimersByTimeAsync(RENOVAR_A_CADA_MS * 3);
      expect(renovacoes()).toBe(1);
    });

    it("fechar a ficha solta a escuta da atividade", async () => {
      const { documento, estado, renovacoes } = await montarReserva();
      documento.visibilityState = "hidden";
      await vi.advanceTimersByTimeAsync(RENOVAR_A_CADA_MS);
      await estado.fechar();
      documento.visibilityState = "visible";
      documento.dispatchEvent(new Event("visibilitychange"));
      await vi.advanceTimersByTimeAsync(RENOVAR_A_CADA_MS);
      expect(renovacoes()).toBe(0);
    });
  });

  describe("fila: inclusão no lote por decisão da coordenação", () => {
    const comDecisao = (coordena = true) => {
      const d = fila({ coordena });
      d.candidatos = d.candidatos.map((c) =>
        c.codigo === "7003"
          ? { ...c, entrada: "DECISAO", decisao: "Critério CORES" }
          : c.codigo === "7009"
            ? { ...c, motivo_codigo: "QUESTIONARIO" }
            : c,
      );
      return d;
    };
    const reservar = ({ p_ficha }) => {
      const c = comDecisao().candidatos.find((x) => x.ficha?.id === p_ficha);
      return {
        ficha: {
          ...c.ficha,
          vaga: c.vaga,
          codigo: c.codigo,
          nome: c.nome,
          posicao: c.posicao,
          art: c.art,
          modalidade: c.modalidade,
          reserva: {
            usuario: EU,
            nome: "Ana",
            desde: new Date().toISOString(),
            expira: AGORA_MAIS,
          },
        },
        reservada: true,
        somente_leitura: false,
      };
    };

    it('selo "Decisão: Critério CORES" na lista e no topo da ficha; "N pela regra + M por decisão"; revogar com motivo', async () => {
      const revogar = vi.fn(() => ({ revogadas: 1, fichas_fora_do_lote: 1 }));
      const supabase = supabaseFalso(comDecisao(), {
        reservar_ficha: reservar,
        revogar_decisao_lote: revogar,
      });
      await montar(supabase);
      expect(secao.querySelector("[data-lote-da-fila]").textContent).toBe(
        "3 pela regra + 1 por decisão",
      );
      const linha = secao.querySelector("[data-candidato='7003']");
      expect(linha.querySelector(".avd-selo-decisao").textContent).toBe(
        "Decisão: Critério CORES",
      );
      expect(
        secao.querySelector("[data-candidato='7002'] .avd-selo-decisao"),
      ).toBeNull();

      // Pendente: o botão da linha é "Analisar" (azul).
      await clicar(botao("Analisar", linha));
      await esperar();
      const topo = secao.querySelector(".avd-analise-topo");
      expect(topo.querySelector(".avd-selo-decisao").textContent).toBe(
        "Decisão: Critério CORES",
      );
      await clicar(topo.querySelector("[data-acao='abrir-revogar-decisao']"));
      await digitar(
        topo.querySelector("[data-revogar='7003'] input"),
        "Decisão registrada por engano",
      );
      await clicar(topo.querySelector("[data-acao='revogar-decisao']"));
      await esperar();
      expect(revogar).toHaveBeenCalledWith({
        p_edital: "e93",
        p_codigos: ["7003"],
        p_motivo: "Decisão registrada por engano",
        p_vaga: "179698",
      });
    });

    it('com o filtro de vaga, "N pela regra + M por decisão" continua sendo do edital, como o No lote', async () => {
      const d = comDecisao();
      d.vagas = [...d.vagas, { codigo: "180001", cargo: "Enfermeiro" }];
      d.candidatos = [
        ...d.candidatos,
        inscrito("8001", { vaga: "180001", ficha: ficha("f9", "PENDENTE") }),
      ];
      await montar(supabaseFalso(d));
      const lote = () =>
        secao.querySelector("[data-lote-da-fila]")?.textContent;
      expect(numeroDaFaixa("lote")).toBe("5");
      expect(lote()).toBe("4 pela regra + 1 por decisão");
      await escolher(filtro("Vaga"), "180001");
      expect(numeroDaFaixa("lote")).toBe("5");
      expect(lote()).toBe("4 pela regra + 1 por decisão");
    });

    it("a inclusão por decisão não fica na Fila (só na Triagem); o selo continua", async () => {
      await montar(supabaseFalso(comDecisao()));
      await abrirMenu();
      expect(
        secao.querySelector("[data-acao='incluir-por-decisao']"),
      ).toBeNull();
      expect(
        secao.querySelector("[data-candidato='7003'] .avd-selo-decisao"),
      ).not.toBeNull();
    });
  });

  describe("fila: andamento, menu da coordenação e tabela agrupada por vaga", () => {
    const duasVagas = () => {
      const d = fila();
      d.vagas = [
        { codigo: "179698", cargo: "Técnico" },
        { codigo: "180001", cargo: "Enfermeiro" },
      ];
      d.candidatos = [
        ...d.candidatos.map((c) => ({
          ...c,
          nota: 30 - (Number(c.codigo) % 10),
        })),
        inscrito("8001", {
          vaga: "180001",
          nota: 22,
          ficha: ficha("f9", "CONCLUIDA", {
            resultado: "APTO",
            nota_final: 20,
          }),
        }),
        inscrito("8002", {
          vaga: "180001",
          posicao: 2,
          nota: 18,
          entrada: "DECISAO",
          decisao: "Critério CORES",
          ficha: ficha("f10", "PENDENTE"),
        }),
      ];
      return d;
    };

    it("andamento: a barra do lote e o bloco Por vaga recolhido na faixa; clicar na vaga filtra", async () => {
      await montar(supabaseFalso(duasVagas()));
      expect(
        faixa().querySelector("[role='img']").getAttribute("aria-label"),
      ).toBe(
        "Distribuição do lote: 16,6% concluídas, 16,6% em análise, 66,6% pendentes",
      );
      expect(
        faixa().querySelector("[data-valor='concluidas'] .ui-faixa-contexto")
          .textContent,
      ).toBe("16,6% · 1 apta");
      const resumo = faixa().querySelector("[data-tour='avd-fila-andamento']");
      const porVaga = resumo.querySelector("details[data-por-vaga]");
      // Fechado por padrão: a grade de cartões por vaga não polui o topo.
      expect(porVaga.open).toBe(false);
      expect(porVaga.querySelector("summary").textContent).toBe(
        "Por vaga (2)2 vagas · 2 com pendências",
      );
      const linhasDaVaga = () =>
        [...resumo.querySelectorAll("tr[data-linha-vaga]")].map((tr) =>
          [...tr.cells].map((td) => td.textContent),
        );
      expect(linhasDaVaga()).toEqual([
        ["179698Técnico", "0 de 4", "1", "3"],
        ["180001Enfermeiro", "1 de 2", "0", "1"],
      ]);
      // O título da coluna ordena; de novo, volta à ordem do edital.
      const ordenar = () => resumo.querySelector("[data-ordenar='pendentes']");
      await clicar(ordenar());
      expect(ordenar().getAttribute("aria-pressed")).toBe("true");
      expect(linhasDaVaga().map((l) => l[3])).toEqual(["3", "1"]);
      await clicar(ordenar());
      expect(ordenar().getAttribute("aria-pressed")).toBe("false");
      await clicar(resumo.querySelector("[data-vaga='180001']"));
      expect(linhas()).toEqual(["8001", "8002"]);
      expect(
        resumo
          .querySelector("[data-vaga='180001']")
          .getAttribute("aria-pressed"),
      ).toBe("true");
      // O filtro de vaga é o mesmo da barra da lista.
      expect(filtro("Vaga").value).toBe("180001");
      // Filtrada por vaga, a tabela não agrupa.
      expect(secao.querySelector("tr.ui-tabela-grupo")).toBeNull();
      await escolher(filtro("Vaga"), "");
      expect(linhas()).toHaveLength(6);
    });

    it("Por vaga: aberto ou fechado fica lembrado por usuário", async () => {
      await montar(supabaseFalso(duasVagas()));
      let porVaga = secao.querySelector("details[data-por-vaga]");
      porVaga.open = true;
      porVaga.dispatchEvent(new Event("toggle"));
      await esperar();
      expect(
        globalThis.localStorage.getItem(
          `monitora.avaliacao-documental.por-vaga-aberto:${EU}`,
        ),
      ).toBe("1");
      await act(async () => painel?.raiz?.unmount());
      secao.remove();
      await montar(supabaseFalso(duasVagas()));
      porVaga = secao.querySelector("details[data-por-vaga]");
      expect(porVaga.open).toBe(true);
    });

    it("todas as vagas: grupo por vaga com o lote e a linha de corte, recolhível", async () => {
      await montar(supabaseFalso(duasVagas()));
      const grupos = () => [
        ...secao.querySelectorAll(
          "[data-tour='avd-fila-tabela'] tr.ui-tabela-grupo",
        ),
      ];
      expect(grupos().map((g) => g.textContent)).toEqual([
        "179698Técnico · lote 4 · linha de corte 26 · 4 nesta lista",
        "180001Enfermeiro · lote 2 (1 pela regra + 1 por decisão) · linha de corte 22 · 2 nesta lista",
      ]);
      await clicar(grupos()[0].querySelector("button"));
      expect(linhas()).toEqual(["8001", "8002"]);
      expect(grupos()).toHaveLength(2);
      await clicar(grupos()[0].querySelector("button"));
      expect(linhas()).toHaveLength(6);
    });

    it("as ações da coordenação ficam no ⋯; com seleção, a barra da seleção em lote", async () => {
      await montar(supabaseFalso());
      const menu = secao.querySelector(
        "[data-tour='avd-fila-acoes-coordenacao']",
      );
      expect(
        menu
          .querySelector("[data-acao='abrir-menu']")
          .getAttribute("aria-label"),
      ).toBe("Ações da coordenação");
      expect(
        secao.querySelector("[data-acao='incluir-por-decisao']"),
      ).toBeNull();
      // A barra da seleção já mostra "Selecionar esta página"; ações só com algo marcado.
      const lote = secao.querySelector("[data-tour='avd-fila-acoes-lote']");
      expect(
        lote.querySelector("[data-acao='selecionar-pagina']").parentElement
          .textContent,
      ).toMatch(/^Selecionar esta página \(\d+\)$/);
      expect(lote.querySelector("[data-acao='liberar-reservas']")).toBeNull();
      await clicar(secao.querySelector("[aria-label='Selecionar 7002']"));
      expect(
        lote.querySelector("[data-alcance-da-selecao]").textContent,
      ).toMatch(/^1 ficha selecionada \(de \d+ no resultado\)$/);
      expect(
        secao.querySelector("[data-candidato='7002']").dataset.marcada,
      ).toBe("sim");
      expect(
        lote.querySelector("[data-acao='liberar-reservas']").disabled,
      ).toBe(true);
      expect(
        lote.querySelector("[data-acao='mandar-para-revisao']").disabled,
      ).toBe(false);
      await abrirMenu();
      expect(
        [...menu.querySelectorAll("[role='menuitem']")].map(
          (b) => b.textContent,
        ),
      ).toEqual([
        "Distribuir as livres (2)",
        "Relatório de motivos",
        "Abrir fichas do lote (1)",
      ]);
      await clicar(lote.querySelector("[data-acao='limpar-selecao']"));
      expect(lote.querySelector("[data-alcance-da-selecao]").textContent).toBe(
        "",
      );
      expect(lote.querySelector("[data-acao='liberar-reservas']")).toBeNull();
    });

    it("alcance da seleção: esta página, depois todos os resultados; trocar a etapa limpa (revisão de 17/11)", async () => {
      const dados = fila();
      for (let i = 0; i < 70; i += 1)
        dados.candidatos.push(
          inscrito(String(7100 + i), {
            posicao: 10 + i,
            ficha: ficha(`f${7100 + i}`, "PENDENTE"),
          }),
        );
      await montar(supabaseFalso(dados));
      const lote = secao.querySelector("[data-tour='avd-fila-acoes-lote']");
      const alcance = () =>
        lote.querySelector("[data-alcance-da-selecao]").textContent;
      // Trocar de etapa limpa a seleção: nenhuma ação pega ficha fora da tela.
      await clicar(secao.querySelector("[aria-label='Selecionar 7002']"));
      expect(alcance()).toMatch(/^1 ficha selecionada/);
      await clicar(
        secao.querySelector(".avd-fila-faixa [data-valor='pendentes']"),
      );
      expect(alcance()).toBe("");
      await clicar(secao.querySelector(".avd-fila-faixa [data-valor='lote']"));
      await clicar(lote.querySelector("[data-acao='selecionar-pagina']"));
      expect(alcance()).toMatch(
        /^(\d+) fichas desta página selecionadas \(de 73 no resultado\)$/,
      );
      const naPagina = Number(alcance().split(" ")[0]);
      expect(naPagina).toBeLessThan(73);
      const todos = lote.querySelector(
        "[data-acao='selecionar-todos-os-resultados']",
      );
      expect(todos.textContent).toBe("Selecionar todos os 73 resultados");
      await clicar(todos);
      expect(alcance()).toBe("Todas as 73 fichas do resultado selecionadas");
      await clicar(lote.querySelector("[data-acao='mandar-para-revisao']"));
      const gaveta = document.querySelector("[data-tour='avd-fila-confirmar']");
      expect(gaveta.textContent).toContain(
        `73 fichas serão afetadas · todos os resultados do filtro, não só os ${naPagina} desta página`,
      );
    });
  });

  describe("fila: relatório de motivos", () => {
    it("a coordenação abre o Relatório de motivos pelo menu, com os atalhos", async () => {
      await montar(supabaseFalso());
      await abrirMenu();
      await clicar(secao.querySelector("[data-acao='relatorio-de-motivos']"));
      const gaveta = document.querySelector(
        "[data-tour='avd-relatorio-motivos']",
      );
      expect(gaveta).not.toBeNull();
      expect(gaveta.querySelectorAll("[data-atalho]")).toHaveLength(3);
    });

    it("abrir o relatório, trocar filtros e fechar não redesenham a Fila por trás (nem chamam o banco)", async () => {
      const supabase = supabaseFalso();
      await montar(supabase);
      await abrirMenu();
      renders.zerar();
      await clicar(secao.querySelector("[data-acao='relatorio-de-motivos']"));
      expect(
        document.querySelector("[data-tour='avd-relatorio-motivos']"),
      ).not.toBeNull();
      expect(renders.de("Fila")).toBe(0);
      expect(renders.de("TabelaDaFila")).toBe(0);
      const chamadas = supabase.rpc.mock.calls.length;
      renders.zerar();
      await escolher(
        document.querySelector("[data-filtro='resultado']"),
        "APTO",
      );
      await clicar(document.querySelector("[data-filtro='ajustada']"));
      expect(renders.de("Fila")).toBe(0);
      expect(renders.de("RelatorioDeMotivos")).toBe(0);
      expect(supabase.rpc.mock.calls.length).toBe(chamadas);
      renders.zerar();
      await clicar(
        document.querySelector(
          "[data-tour='avd-relatorio-motivos'] .ui-gaveta-fechar",
        ),
      );
      expect(
        document.querySelector("[data-tour='avd-relatorio-motivos']"),
      ).toBeNull();
      expect(renders.de("Fila")).toBe(0);
      expect(renders.de("TabelaDaFila")).toBe(0);
    });
  });

  describe("fila: reiniciar as fichas do edital (dois administradores)", () => {
    const ADMIN = { getProfile: () => ({ ativo: true, admin_global: true }) };
    const MOTIVO = "A análise foi feita com a regra errada do edital";
    const leitura = (extra = {}) => ({
      schema_version: 1,
      edital: "e93",
      numero: "93/2026",
      validade_horas: 24,
      impacto: {
        concluidas: 1509,
        em_analise: 12,
        com_lancamento: 10,
        iniciadas: 1530,
        exige_aprovacao: true,
      },
      bloqueio: null,
      pedido: null,
      historico: [],
      ...extra,
    });
    const pedido = (extra = {}) => ({
      id: 7,
      situacao: "PENDENTE",
      vencido: false,
      motivo: MOTIVO,
      por: "Beto",
      meu: false,
      em: "2026-10-22T12:00:00Z",
      validade: "2026-10-23T12:00:00Z",
      impacto: { concluidas: 1509, em_analise: 12, iniciadas: 1530 },
      ...extra,
    });
    const erroDoBanco = (message, code) =>
      Object.assign(new Error(message), { code });
    const gaveta = () =>
      document.querySelector("[data-tour='avd-fila-reinicio']");
    const abrirReinicio = async () => {
      await abrirMenu();
      await clicar(secao.querySelector("[data-acao='reiniciar-fichas']"));
      await esperar();
    };

    it("quem não é admin global não vê o menu nem lê o reinício", async () => {
      const supabase = supabaseFalso();
      await montar(supabase);
      await abrirMenu();
      expect(secao.querySelector("[data-acao='reiniciar-fichas']")).toBeNull();
      expect(
        supabase.rpc.mock.calls.some(
          ([nome]) => nome === "obter_reinicio_fichas_do_edital",
        ),
      ).toBe(false);
    });

    it("com fichas concluídas, pede o reinício com motivo e o número do edital", async () => {
      const supabase = supabaseFalso(fila(), {
        obter_reinicio_fichas_do_edital: () => leitura(),
        pedir_reinicio_fichas_do_edital: () =>
          leitura({ pedido: pedido({ meu: true, por: "Ana" }) }),
      });
      await montar(supabase, ADMIN);
      await abrirReinicio();
      const g = gaveta();
      expect(g.textContent).toContain("1.509 concluídas e 12 em análise");
      expect(g.textContent).toContain("Outro administrador global");
      const pedir = g.querySelector("[data-acao='pedir-reinicio']");
      expect(pedir.disabled).toBe(true);
      await digitar(
        g.querySelector("[data-campo='motivo-do-reinicio']"),
        MOTIVO,
      );
      await digitar(
        g.querySelector("[data-campo='numero-do-edital']"),
        "93/2025",
      );
      expect(pedir.disabled).toBe(true);
      expect(g.textContent).toContain("Não confere.");
      await digitar(
        g.querySelector("[data-campo='numero-do-edital']"),
        "93/2026",
      );
      expect(pedir.disabled).toBe(false);
      await clicar(pedir);
      await esperar();
      expect(supabase.rpc).toHaveBeenCalledWith(
        "pedir_reinicio_fichas_do_edital",
        { p_edital: "e93", p_motivo: MOTIVO, p_confirmacao: "93/2026" },
      );
      // Nada de reiniciar direto.
      expect(
        supabase.rpc.mock.calls.some(
          ([nome]) => nome === "reiniciar_fichas_do_edital",
        ),
      ).toBe(false);
      expect(
        gaveta().querySelector("[data-acao='cancelar-pedido-de-reinicio']"),
      ).not.toBeNull();
      expect(
        secao.querySelector("[data-reinicio='meu-pedido']"),
      ).not.toBeNull();
    });

    it("motivo que não parece texto não habilita o pedido", async () => {
      await montar(
        supabaseFalso(fila(), {
          obter_reinicio_fichas_do_edital: () => leitura(),
        }),
        ADMIN,
      );
      await abrirReinicio();
      const g = gaveta();
      await digitar(
        g.querySelector("[data-campo='motivo-do-reinicio']"),
        "dsdfsdfsfsa fdfdf",
      );
      await digitar(
        g.querySelector("[data-campo='numero-do-edital']"),
        "93/2026",
      );
      expect(g.querySelector("[data-acao='pedir-reinicio']").disabled).toBe(
        true,
      );
      expect(g.textContent).toContain("pelo menos 3 palavras");
    });

    it("outro admin vê o aviso e aprova digitando o número; a fila relê", async () => {
      const supabase = supabaseFalso(fila(), {
        obter_reinicio_fichas_do_edital: () => leitura({ pedido: pedido() }),
        aprovar_reinicio_fichas_do_edital: () => ({
          resultado: { reiniciadas: 1521 },
          reinicio: leitura({ pedido: null }),
        }),
      });
      await montar(supabase, ADMIN);
      const aviso = secao.querySelector(
        "[data-reinicio='aguardando-aprovacao']",
      );
      expect(aviso.textContent).toContain(
        "Reinício pedido por Beto aguardando sua aprovação",
      );
      await clicar(secao.querySelector("[data-acao='ver-pedido-de-reinicio']"));
      await esperar();
      const g = gaveta();
      expect(g.querySelector("[data-motivo-do-pedido]").textContent).toBe(
        MOTIVO,
      );
      const aprovar = g.querySelector("[data-acao='aprovar-reinicio']");
      expect(aprovar.disabled).toBe(true);
      expect(g.querySelector("[data-acao='recusar-reinicio']").disabled).toBe(
        true,
      );
      await digitar(
        g.querySelector("[data-campo='numero-do-edital']"),
        "093/2026",
      );
      expect(aprovar.disabled).toBe(false);
      const leiturasDaFila = () =>
        supabase.rpc.mock.calls.filter(
          ([nome]) => nome === "obter_fila_avaliacao",
        ).length;
      const antes = leiturasDaFila();
      await clicar(aprovar);
      await esperar();
      expect(supabase.rpc).toHaveBeenCalledWith(
        "aprovar_reinicio_fichas_do_edital",
        { p_pedido: 7, p_confirmacao: "093/2026" },
      );
      expect(toast).toHaveBeenCalledWith(
        "1521 ficha(s) de volta ao início.",
        "success",
      );
      expect(leiturasDaFila()).toBeGreaterThan(antes);
      expect(gaveta()).toBeNull();
      expect(
        secao.querySelector("[data-reinicio='aguardando-aprovacao']"),
      ).toBeNull();
    });

    it("outro admin recusa com motivo opcional", async () => {
      const supabase = supabaseFalso(fila(), {
        obter_reinicio_fichas_do_edital: () => leitura({ pedido: pedido() }),
        recusar_reinicio_fichas_do_edital: () => leitura(),
      });
      await montar(supabase, ADMIN);
      await clicar(secao.querySelector("[data-acao='ver-pedido-de-reinicio']"));
      await esperar();
      const g = gaveta();
      await digitar(
        g.querySelector("[data-campo='numero-do-edital']"),
        "93/2026",
      );
      await digitar(
        g.querySelector("[data-campo='motivo-da-recusa']"),
        "curto",
      );
      expect(g.querySelector("[data-acao='recusar-reinicio']").disabled).toBe(
        true,
      );
      await digitar(g.querySelector("[data-campo='motivo-da-recusa']"), "");
      await clicar(g.querySelector("[data-acao='recusar-reinicio']"));
      await esperar();
      expect(supabase.rpc).toHaveBeenCalledWith(
        "recusar_reinicio_fichas_do_edital",
        { p_pedido: 7, p_confirmacao: "93/2026", p_motivo: null },
      );
      expect(
        secao.querySelector("[data-reinicio='aguardando-aprovacao']"),
      ).toBeNull();
    });

    it("quem pediu não aprova: só cancela; a recusa do banco aparece", async () => {
      const supabase = supabaseFalso(fila(), {
        obter_reinicio_fichas_do_edital: () =>
          leitura({ pedido: pedido({ meu: true, por: "Ana" }) }),
        cancelar_reinicio_fichas_do_edital: () =>
          erroDoBanco(
            "Este pedido de reinício não está mais pendente (executado).",
            "55000",
          ),
      });
      await montar(supabase, ADMIN);
      expect(
        secao.querySelector("[data-reinicio='aguardando-aprovacao']"),
      ).toBeNull();
      await clicar(secao.querySelector("[data-acao='ver-pedido-de-reinicio']"));
      await esperar();
      const g = gaveta();
      expect(g.querySelector("[data-acao='aprovar-reinicio']")).toBeNull();
      await clicar(
        g.querySelector("[data-acao='cancelar-pedido-de-reinicio']"),
      );
      await esperar();
      expect(supabase.rpc).toHaveBeenCalledWith(
        "cancelar_reinicio_fichas_do_edital",
        { p_pedido: 7 },
      );
      expect(g.querySelector("[role='alert']").textContent).toContain(
        "não está mais pendente",
      );
    });

    it("pedido vencido: o aviso some e a gaveta volta a pedir", async () => {
      await montar(
        supabaseFalso(fila(), {
          obter_reinicio_fichas_do_edital: () =>
            leitura({ pedido: pedido({ vencido: true }) }),
        }),
        ADMIN,
      );
      expect(secao.querySelector("[data-reinicio]")).toBeNull();
      await abrirReinicio();
      expect(
        gaveta().querySelector("[data-acao='pedir-reinicio']"),
      ).not.toBeNull();
    });

    it("edital congelado: só a frase do bloqueio, sem botão", async () => {
      await montar(
        supabaseFalso(fila(), {
          obter_reinicio_fichas_do_edital: () =>
            leitura({
              bloqueio:
                "As inscrições deste edital estão congeladas. Libere o congelamento na Triagem antes de reiniciar as fichas.",
            }),
        }),
        ADMIN,
      );
      await abrirReinicio();
      const g = gaveta();
      expect(g.querySelector("[role='alert']").textContent).toContain(
        "congeladas",
      );
      expect(g.querySelector("[data-acao='pedir-reinicio']")).toBeNull();
      expect(g.querySelector("[data-acao='aprovar-reinicio']")).toBeNull();
    });

    it("sem ficha trabalhada: reinicia direto, com um administrador", async () => {
      const supabase = supabaseFalso(fila(), {
        obter_reinicio_fichas_do_edital: () =>
          leitura({
            impacto: {
              concluidas: 0,
              em_analise: 1,
              com_lancamento: 0,
              iniciadas: 1,
              exige_aprovacao: false,
            },
          }),
        reiniciar_fichas_do_edital: () => ({ reiniciadas: 1 }),
      });
      await montar(supabase, ADMIN);
      await abrirReinicio();
      const g = gaveta();
      expect(g.querySelector("[data-acao='pedir-reinicio']")).toBeNull();
      await digitar(
        g.querySelector("[data-campo='motivo-do-reinicio']"),
        MOTIVO,
      );
      await digitar(
        g.querySelector("[data-campo='numero-do-edital']"),
        "93/2026",
      );
      await clicar(g.querySelector("[data-acao='reiniciar-direto']"));
      await esperar();
      expect(supabase.rpc).toHaveBeenCalledWith("reiniciar_fichas_do_edital", {
        p_edital: "e93",
        p_motivo: MOTIVO,
      });
      expect(gaveta()).toBeNull();
    });
  });

  describe("fila leve: o lote em toda leitura, os de fora do lote sob demanda", () => {
    /* schema_version 2 (20261014180000_fila_leve.sql): os eliminados não vêm em "candidatos". */
    function filaLeve(versao = "v1") {
      const base = fila();
      return {
        ...base,
        schema_version: 2,
        candidatos: base.candidatos.filter(
          (c) => c.situacao_pre !== "ELIMINADO",
        ),
        fora_do_lote: {
          total: 1,
          eliminados: 1,
          ranqueados: 0,
          modalidades: ["AC"],
          versao,
        },
      };
    }
    const eliminado = () =>
      fila().candidatos.find((c) => c.situacao_pre === "ELIMINADO");
    const chamadasDeFora = (supabase) =>
      supabase.rpc.mock.calls.filter(
        ([nome]) => nome === "obter_fila_fora_do_lote",
      );

    it("Eliminados no banco (20261029120000): 50 por vez, ordem no banco, sem ler os de fora do lote", async () => {
      const pedidos = [];
      const supabase = supabaseFalso(filaLeve(), {
        listar_eliminados_fila: (args) => {
          pedidos.push(args);
          return { candidatos: [eliminado()], proximo: null, total: 1 };
        },
      });
      await montar(supabase);
      await irParaEtapa("eliminados");
      expect(linhas()).toEqual(["7009"]);
      expect(chamadasDeFora(supabase)).toHaveLength(0);
      expect(pedidos.at(-1)).toEqual({
        p_edital: "e93",
        p_vaga: null,
        p_modalidade: null,
        p_busca: null,
        p_ordem: null,
        p_sentido: "asc",
        p_apos: null,
        p_limite: 50,
      });
      expect(contagemDaLista()).toBe("Mostrando 1 de 1");
      // Ordenar pela coluna pede de novo ao banco, na ordem da coluna (a pessoa: o nome).
      const nome = [...secao.querySelectorAll("button.ui-ordenar")].find((b) =>
        b.textContent.startsWith("Pessoa"),
      );
      await clicar(nome);
      await esperar();
      expect(pedidos.at(-1)).toMatchObject({
        p_ordem: "nome",
        p_sentido: "asc",
        p_apos: null,
      });
      // O CSV lê o recorte inteiro em páginas maiores.
      await clicar(secao.querySelector("[data-acao='exportar-csv']"));
      await esperar();
      expect(pedidos.at(-1)).toMatchObject({ p_ordem: "nome", p_limite: 2000 });
    });

    it("No lote não pede os de fora; Eliminados pede uma vez (em páginas) e guarda", async () => {
      const supabase = supabaseFalso(filaLeve(), {
        obter_fila_fora_do_lote: () => ({
          candidatos: [eliminado()],
          proximo: null,
        }),
      });
      await montar(supabase);
      expect(faixa().querySelector("[data-valor='fora']").textContent).toBe(
        "1 fora do lote",
      );
      expect(chamadasDeFora(supabase)).toHaveLength(0);

      await clicar(faixa().querySelector("[data-valor='fora']"));
      await esperar();
      expect(chamadasDeFora(supabase)).toEqual([
        [
          "obter_fila_fora_do_lote",
          { p_edital: "e93", p_apos: null, p_limite: 2000 },
        ],
      ]);
      expect(linhas()).toEqual(["7009"]);

      await irParaEtapa("inscritos");
      expect(linhas()).toEqual(["7001", "7002", "7003", "7004", "7009"]);
      // Etapa fora da faixa: aparece como link marcado na linha de baixo.
      expect(
        faixa()
          .querySelector("[data-valor='inscritos']")
          .getAttribute("aria-pressed"),
      ).toBe("true");
      expect(chamadasDeFora(supabase)).toHaveLength(1);
    });

    it("estado: lê todas as páginas; só relê quando a versão de fora muda", async () => {
      let versao = "v1";
      const paginas = {
        null: { candidatos: [eliminado()], proximo: "c-7009" },
        "c-7009": {
          candidatos: [{ ...eliminado(), id: "c-7010", codigo: "7010" }],
          proximo: null,
        },
      };
      const supabase = supabaseFalso(undefined, {
        obter_fila_avaliacao: () => filaLeve(versao),
        obter_fila_fora_do_lote: ({ p_apos }) => paginas[String(p_apos)],
      });
      const estado = criarEstadoDaFila({
        supabase,
        toast,
        armazenamento: null,
      });
      await estado.carregar("e93");
      expect(estado.obter().fora.linhas).toBeNull();
      expect(await estado.carregarForaDoLote()).toBe(true);
      expect(estado.obter().fora.linhas.map((c) => c.codigo)).toEqual([
        "7009",
        "7010",
      ]);
      expect(chamadasDeFora(supabase)).toHaveLength(2);

      await estado.carregar();
      await estado.carregarForaDoLote();
      expect(chamadasDeFora(supabase)).toHaveLength(2);

      versao = "v2";
      await estado.carregar();
      await esperar();
      expect(chamadasDeFora(supabase)).toHaveLength(4);
      expect(estado.obter().fora.versao).toBe("v2");
    });

    it("estado: banco sem a fila leve (sem fora_do_lote) não pede a lista de fora", async () => {
      const supabase = supabaseFalso();
      const estado = criarEstadoDaFila({
        supabase,
        toast,
        armazenamento: null,
      });
      await estado.carregar("e93");
      expect(await estado.carregarForaDoLote()).toBe(true);
      expect(estado.obter().fora.linhas).toEqual([]);
      expect(chamadasDeFora(supabase)).toHaveLength(0);
    });
  });

  describe("fila só com o que mudou (20261014231000)", () => {
    /* obter_fila_avaliacao_desde: inteira sem p_desde; depois, parcial. */
    function comDesde(mudou = () => []) {
      const base = fila();
      const leituras = [];
      const supabase = supabaseFalso(base, {
        obter_fila_avaliacao_desde: (args) => {
          leituras.push(args);
          if (!args.p_desde)
            return { ...base, gerado_em: "t0", marca: "m1", parcial: false };
          const { vagas: _vagas, candidatos, ...resto } = base;
          return {
            ...resto,
            gerado_em: `t${leituras.length}`,
            marca: "m1",
            parcial: true,
            candidatos: mudou(candidatos),
            saiu: [],
            total_nucleo: candidatos.length,
          };
        },
        reservar_ficha: ({ p_ficha }) => ({
          ficha: { id: p_ficha, versao: 4, situacao: "EM_ANALISE" },
          reservada: true,
        }),
        pegar_proxima_ficha: () => ({
          ficha: { id: "f3", versao: 3, situacao: "EM_ANALISE" },
          reservada: true,
        }),
      });
      return { supabase, leituras };
    }
    const nomes = (supabase) => supabase.rpc.mock.calls.map(([nome]) => nome);
    const criar = (supabase) =>
      criarEstadoDaFila({
        supabase,
        toast,
        armazenamento: null,
        agendar: () => 0,
        cancelar: () => {},
      });

    it("a primeira leitura é inteira; a seguinte manda o gerado_em e a marca e junta as linhas", async () => {
      const { supabase, leituras } = comDesde((candidatos) => [
        { ...candidatos[0], nome: "Nome novo" },
      ]);
      const estado = criar(supabase);
      await estado.carregar("e93");
      const antes = estado.obter().dados.candidatos;
      await estado.carregar("e93");
      expect(leituras).toEqual([
        { p_edital: "e93", p_desde: null, p_marca: null },
        { p_edital: "e93", p_desde: "t0", p_marca: "m1" },
      ]);
      const depois = estado.obter().dados;
      expect(depois.candidatos).toHaveLength(antes.length);
      expect(depois.candidatos[0].nome).toBe("Nome novo");
      expect(depois.candidatos[1]).toBe(antes[1]);
      expect(depois.vagas).toEqual(fila().vagas);
      expect(depois.gerado_em).toBe("t2");
      expect(nomes(supabase)).not.toContain("obter_fila_avaliacao");
    });

    it("passar de uma ficha a outra não relê a fila; voltar à lista relê só o que mudou", async () => {
      const { supabase, leituras } = comDesde();
      const estado = criar(supabase);
      await estado.carregar("e93");
      await estado.abrir("f2");
      await estado.pegarProxima();
      await estado.abrir("f4");
      expect(leituras).toHaveLength(1);
      expect(estado.estaDesatualizada()).toBe(true);
      // Sair da página (ou desmontar a aba) também não relê.
      await estado.fechar({ reler: false });
      expect(leituras).toHaveLength(1);
      await estado.abrir("f2");
      // "Voltar à fila": a lista aparece e é relida (parcial).
      await estado.fechar({ esquecer: true });
      await esperar();
      expect(leituras).toHaveLength(2);
      expect(leituras[1].p_desde).toBe("t0");
      expect(estado.estaDesatualizada()).toBe(false);
    });

    it("parcial que não bate (linha nova): lê a fila inteira", async () => {
      const { supabase, leituras } = comDesde(() => [
        { id: "c-novo", vaga: "179698", codigo: "7999" },
      ]);
      const estado = criar(supabase);
      await estado.carregar("e93");
      await estado.carregar("e93");
      expect(leituras.map((l) => l.p_desde)).toEqual([null, "t0", null]);
      expect(estado.obter().dados.parcial).toBe(false);
    });

    it("banco sem a RPC nova: a fila de sempre", async () => {
      const ausente = Object.assign(new Error("Could not find"), {
        code: "PGRST202",
      });
      const supabase = supabaseFalso(fila(), {
        obter_fila_avaliacao_desde: () => ausente,
      });
      const estado = criar(supabase);
      await estado.carregar("e93");
      await estado.carregar("e93");
      expect(nomes(supabase)).toEqual([
        "obter_fila_avaliacao_desde",
        "obter_fila_avaliacao",
        "obter_fila_avaliacao",
      ]);
    });
  });

  describe("layout da seleção na Fila: faixa de situação, barra da lista e ⋯ da linha", () => {
    const ativa = () =>
      faixa().querySelector("[aria-pressed='true']")?.dataset.valor;

    it("a faixa dá o andamento e filtra a etapa; o responsável e Limpar ficam na barra", async () => {
      await montar(supabaseFalso());
      expect(
        ["concluidas", "em_analise", "pendentes"].map(numeroDaFaixa),
      ).toEqual(["0", "1", "3"]);
      expect(
        faixa().querySelector("[data-valor='concluidas'] .ui-faixa-contexto")
          .textContent,
      ).toBe("0%");
      expect(
        faixa().querySelector("[data-valor='pendentes'] .ui-faixa-contexto")
          .textContent,
      ).toBe("75%");
      // Sem o ritmo (não veio): só as concluídas de hoje, sem selo.
      expect(secao.querySelector("[data-hoje-da-fila]").textContent).toBe(
        "Hoje 0",
      );
      expect(faixa().querySelector(".ui-selo")).toBeNull();
      await clicar(faixa().querySelector("[data-valor='pendentes']"));
      expect(ativa()).toBe("pendentes");
      expect(linhas()).toEqual(["7002", "7003", "7004"]);
      await clicar(faixa().querySelector("[data-valor='em_analise']"));
      expect(secao.querySelector("[data-acao='limpar-filtros']")).toBeNull();
      await escolher(filtro("Responsável"), "eu");
      expect(linhas()).toEqual(["7001"]);
      await clicar(secao.querySelector("[data-acao='limpar-filtros']"));
      expect(secao.querySelector("[data-acao='limpar-filtros']")).toBeNull();
      // Limpar tira os filtros e fica na etapa escolhida.
      expect(ativa()).toBe("em_analise");
    });

    it("vazia: Ninguém por aqui", async () => {
      await montar(supabaseFalso());
      await clicar(faixa().querySelector("[data-valor='revisao']"));
      expect(linhas()).toEqual([]);
      expect(
        secao.querySelector("[data-tour='avd-fila-tabela'] .ui-lista-vazia")
          .textContent,
      ).toBe("Ninguém por aquiNenhuma ficha nesta situação com esses filtros.");
    });

    it("com o ritmo do Painel das análises, a faixa mostra o selo e a meta do dia", async () => {
      const hoje = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
      }).format(new Date());
      const ritmo = {
        editais: [
          {
            id: "e93",
            edital: "93/2026",
            situacoes: { pendente: 2, em_analise: 1, revisar: 0, concluida: 0 },
            por_dia: [{ dia: hoje, qt: 0 }],
            qt_equipe: 2,
            cronograma: [
              {
                ordem: 1,
                atividade: "Análise documental",
                inicio: "2026-01-01",
                fim: "2099-12-31",
              },
            ],
          },
        ],
      };
      const supabase = supabaseFalso(fila(), {
        obter_ritmo_da_analise: () => ritmo,
      });
      await montar(supabase);
      await esperar();
      expect(supabase.rpc).toHaveBeenCalledWith("obter_ritmo_da_analise", {
        p_area: "projetos",
      });
      const hojeDaFila = secao.querySelector("[data-hoje-da-fila]").textContent;
      const util = ![0, 6].includes(new Date(`${hoje}T12:00:00Z`).getUTCDay());
      // O selo do ritmo aparece uma vez só.
      expect(faixa().querySelectorAll(".ui-selo")).toHaveLength(1);
      if (util) expect(hojeDaFila).toMatch(/^Hoje 0 de \d+$/);
      else expect(hojeDaFila).toBe("Hoje 0");
    });

    it("o ⋯ da linha: Atribuir abre a mesma gaveta com uma ficha; o analista só copia", async () => {
      const distribuir = vi.fn(({ p_atribuicoes }) => ({
        alteradas: p_atribuicoes.length,
      }));
      await montar(supabaseFalso(fila(), { distribuir_fichas: distribuir }));
      const linha = secao.querySelector("[data-candidato='7002']");
      // Pendente: "Analisar", azul; em análise: "Abrir", neutro.
      const principal = linha.querySelector("[data-acao='abrir-ficha']");
      expect(principal.textContent.trim()).toBe("Analisar");
      expect(principal.className).toBe("btn small");
      const emAnalise = secao.querySelector(
        "[data-candidato='7001'] [data-acao='abrir-ficha']",
      );
      expect(emAnalise.textContent.trim()).toBe("Abrir");
      expect(emAnalise.className).toBe("btn contorno small");
      await clicar(linha.querySelector("[data-acao='abrir-menu']"));
      expect(
        [...linha.querySelectorAll("[role='menuitem']")].map((b) =>
          b.textContent.trim(),
        ),
      ).toEqual(["Atribuir a…", "Mandar para revisão", "Copiar código"]);
      await clicar(linha.querySelector("[data-acao='ficha-distribuir']"));
      const gaveta = document.querySelector("[data-tour='avd-fila-confirmar']");
      expect(gaveta.textContent).toContain("1 ficha será afetada");
      await escolher(gaveta.querySelector("select"), "u-beto");
      await clicar(gaveta.querySelector("[data-acao='confirmar-distribuir']"));
      await esperar();
      expect(distribuir).toHaveBeenCalledWith(
        expect.objectContaining({
          p_atribuicoes: [{ ficha: "f2", versao: 3, usuario: "u-beto" }],
        }),
      );

      // A reserva de outra pessoa: o ⋯ oferece liberar (com motivo, na gaveta).
      const reservada = secao.querySelector("[data-candidato='7001']");
      await clicar(reservada.querySelector("[data-acao='abrir-menu']"));
      expect(
        reservada.querySelector("[data-acao='ficha-liberar']"),
      ).not.toBeNull();

      await act(async () => painel.raiz.unmount());
      secao.remove();
      await montar(supabaseFalso(fila({ coordena: false })));
      const doAnalista = secao.querySelector("[data-candidato='7002']");
      await clicar(doAnalista.querySelector("[data-acao='abrir-menu']"));
      expect(
        [...doAnalista.querySelectorAll("[role='menuitem']")].map((b) =>
          b.textContent.trim(),
        ),
      ).toEqual(["Copiar código"]);
    });
  });
});

bloco("modulos/avaliacao-documental-modelo-do-espelho", () => {
  /*
  O editor "Modelo do espelho de nota": abre o modelo do edital, mostra a
  prévia com dados fictícios, salva só as diferenças do padrão com a versão
  aberta, "Restaurar padrão", conflito (PT409) pede para recarregar; e a
  leitura para montar o espelho nunca falha (sem RPC = padrão).
*/

  let raiz = null;
  let lugar = null;
  afterEach(() => {
    act(() => raiz?.unmount());
    lugar?.remove();
    raiz = null;
  });

  function rpcFalso({
    versao = 2,
    textos = { titulo: "Título do edital" },
    salvar,
  } = {}) {
    return vi.fn(async (nome, args) => {
      if (nome === "obter_modelo_espelho_nota")
        return {
          versao,
          textos,
          atualizado_em: "2026-10-19T12:00:00Z",
          atualizado_por: "Gestão Pessoal",
          pode_editar: true,
        };
      if (nome === "salvar_modelo_espelho_nota") {
        if (salvar) return salvar(args);
        return {
          versao: args.p_versao_atual + 1,
          textos: args.p_textos,
          atualizado_em: "2026-10-19T12:05:00Z",
          atualizado_por: "Gestão Pessoal",
          pode_editar: true,
        };
      }
      throw new Error(`rpc inesperada ${nome}`);
    });
  }

  async function montar(rpc) {
    lugar = document.createElement("div");
    document.body.append(lugar);
    raiz = createRoot(lugar);
    await act(async () => {
      raiz.render(
        createElement(ModeloDoEspelhoDeNota, {
          editalId: "e114",
          rpc,
          aoFechar: () => {},
          marca: () => ({ cabecalho: "AGÊNCIA DE TESTE" }),
        }),
      );
    });
    await esperar();
  }
  const campo = (chave) => document.querySelector(`[data-campo='${chave}']`);
  const previa = () =>
    document.querySelector(".avd-modelo-espelho-folha").getAttribute("srcdoc");

  describe("editor do modelo do espelho", () => {
    it("abre o modelo do edital com a prévia e salva só as diferenças com a versão aberta", async () => {
      const rpc = rpcFalso();
      await montar(rpc);
      expect(rpc).toHaveBeenCalledWith("obter_modelo_espelho_nota", {
        p_edital: "e114",
      });
      expect(
        document.querySelector(".ui-modal-institucional-topo h2")?.textContent,
      ).toBe("Modelo do espelho de nota");
      expect(
        document.querySelector(".ui-modal-institucional-rodape"),
      ).not.toBeNull();
      expect(
        document.querySelector(".ui-modal-institucional-conteudo"),
      ).not.toBeNull();
      expect(
        document.querySelector(
          ".ui-modal-institucional-acoes [data-acao='modelo-espelho-salvar']",
        ),
      ).not.toBeNull();
      expect(campo("titulo").value).toBe("Título do edital");
      expect(previa()).toContain("<h1>Título do edital</h1>");
      expect(previa()).toContain("AGÊNCIA DE TESTE");
      const salvar = document.querySelector(
        "[data-acao='modelo-espelho-salvar']",
      );
      expect(salvar.disabled).toBe(true);

      await digitar(campo("rodape"), "Rodapé do edital.");
      expect(previa()).toContain("Rodapé do edital.");
      await clicar(campo("mostrar_autodeclarada"));
      expect(previa()).not.toContain("autodeclarada");
      expect(salvar.disabled).toBe(false);
      await clicar(salvar);
      await esperar();
      expect(rpc).toHaveBeenCalledWith("salvar_modelo_espelho_nota", {
        p_edital: "e114",
        p_textos: {
          titulo: "Título do edital",
          rodape: "Rodapé do edital.",
          mostrar_autodeclarada: false,
        },
        p_versao_atual: 2,
      });
      expect(document.body.textContent).toContain("Modelo salvo (versão 3)");
    });

    it("campo inválido trava o salvar e mostra o erro", async () => {
      await montar(rpcFalso());
      await digitar(campo("saudacao"), "Prezado(a),");
      expect(document.body.textContent).toContain("Inclua {candidato}");
      expect(
        document.querySelector("[data-acao='modelo-espelho-salvar']").disabled,
      ).toBe(true);
    });

    it("Restaurar padrão volta aos textos de hoje e salva {}", async () => {
      const rpc = rpcFalso();
      await montar(rpc);
      await clicar(
        document.querySelector("[data-acao='modelo-espelho-padrao']"),
      );
      expect(campo("titulo").value).toBe(TEXTOS_PADRAO_DO_ESPELHO.titulo);
      await clicar(
        document.querySelector("[data-acao='modelo-espelho-salvar']"),
      );
      await esperar();
      expect(rpc.mock.calls.at(-1)).toEqual([
        "salvar_modelo_espelho_nota",
        { p_edital: "e114", p_textos: {}, p_versao_atual: 2 },
      ]);
    });

    it("conflito de versão (PT409) pede para recarregar", async () => {
      const rpc = rpcFalso({
        salvar: () => {
          throw Object.assign(new Error("alterado"), { code: "PT409" });
        },
      });
      await montar(rpc);
      await digitar(campo("titulo"), "Mais um");
      await clicar(
        document.querySelector("[data-acao='modelo-espelho-salvar']"),
      );
      await esperar();
      expect(document.body.textContent).toContain(
        "O modelo foi alterado em outra aba ou por outra pessoa",
      );
    });
  });

  describe("textosParaOEspelho", () => {
    it("lê o modelo do edital", async () => {
      const t = await textosParaOEspelho(rpcFalso(), "e114");
      expect(t.titulo).toBe("Título do edital");
      expect(t.rodape).toBe(TEXTOS_PADRAO_DO_ESPELHO.rodape);
    });

    it("sem RPC, sem edital ou com erro: o padrão", async () => {
      const falha = vi.fn(async () => {
        throw Object.assign(new Error("função não existe"), {
          code: "PGRST202",
        });
      });
      expect(await textosParaOEspelho(falha, "e114")).toEqual(
        TEXTOS_PADRAO_DO_ESPELHO,
      );
      expect(await textosParaOEspelho(null, "e114")).toEqual(
        TEXTOS_PADRAO_DO_ESPELHO,
      );
      expect(await textosParaOEspelho(falha, "")).toEqual(
        TEXTOS_PADRAO_DO_ESPELHO,
      );
    });

    it("mensagem de erro comum", () => {
      expect(mensagemDoErroDoModelo(new Error("x"))).toBe(
        "Não foi possível salvar o modelo: x",
      );
    });
  });
});

bloco("modulos/avaliacao-documental-pre-classificacao", () => {
  /*
  A aba Triagem da Avaliação documental (fase F2): lê o que o job
  Python gravou (obter_pre_classificacao), mostra os contadores, a linha de
  corte, a divergência ART × declarada e os eliminados; a coordenação pede o
  recálculo (RPC disparar_robo com o edital), muda o tamanho do lote por
  vaga (versão nova da regra) e registra/exporta as listas PROVISORIA e LOTE.
  Códigos AM-4.x, AM-5.x e AM-16.x de docs/historias-de-usuario/analises-no-monitora.md.
*/

  const { regras } = JSON.parse(
    readFileSync(
      "tests/fixtures/avaliacao-documental/casos-de-pontuacao.json",
      "utf8",
    ),
  );
  const PROJ = regras["PROJ26-CURRICULAR"];
  const CONFIG = {
    ...PROJ,
    lote: { ...PROJ.lote, base: "MULTIPLO_VAGAS", publica_reposicao: true },
  };

  const regraSalva = (
    versao,
    configuracao = CONFIG,
    situacao = "CONFERIDA",
  ) => ({
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
        motivo: "",
        configuracao,
      },
    ],
  });

  const inscrito = (codigo, extra) => ({
    id: `id-${codigo}`,
    vaga: "179698",
    codigo,
    nome: `Pessoa ${codigo}`,
    situacao: "RANQUEADO",
    motivo: null,
    art: 20,
    nota: 20,
    origem_nota: "ART",
    declarada: null,
    divergente: false,
    modalidade: "AC",
    posicao: null,
    lote: null,
    motivo_entrada: null,
    ...extra,
  });

  const PRE = (regra, pode = true, extra = {}) => ({
    schema_version: 1,
    edital: {
      id: "e93",
      edital: "93/2026",
      unidade: "Boa Vista",
      area: "projetos",
      rotulo: "93/2026",
    },
    papel: pode ? "COORDENADOR" : null,
    pode_coordenar: pode,
    pode_registrar_lista: pode,
    pode_publicar_lista: pode,
    regra: regra
      ? {
          versao: regra.versao,
          situacao: regra.situacao,
          configuracao: regra.configuracao,
        }
      : null,
    regra_classificacao: { versao: 1, configuracao: {} },
    em_andamento: false,
    ultima_execucao: {
      id: "precl-1",
      inicio: "2026-10-06T12:00:00Z",
      fim: "2026-10-06T12:01:00Z",
      situacao: "CONCLUIDA",
      disparo: "ROBO",
      edital: { edital: "e93", situacao: "PROCESSADO" },
    },
    vagas: [
      {
        codigo: "179698",
        candidatos_empregare: 5,
        cargo: "Técnico de Segurança do Trabalho",
        lotacao: "Boa Vista",
        vagas_imediatas: 1,
        cadastro_reserva: true,
        inscritos: 5,
        eliminados: 1,
        ranqueados: 4,
        no_lote: 2,
        tamanho: 2,
        descricao: "1 × (1 + CR) = 2",
        art_corte: 24,
        divergencias: 1,
        avisos: ["FORA_DO_LOTE_ACIMA_DO_CORTE"],
      },
      {
        codigo: "180231",
        candidatos_empregare: 7,
        inscritos: null,
        tamanho: null,
        avisos: [],
      },
    ],
    candidatos: [
      inscrito("7000001", {
        situacao: "NO_LOTE",
        posicao: 1,
        art: 26,
        nota: 26,
        lote: 1,
        motivo_entrada: "Lote inicial",
      }),
      inscrito("7000003", {
        situacao: "NO_LOTE",
        posicao: 2,
        art: 24,
        nota: 24,
        lote: 2,
        declarada: 10,
        divergente: true,
        motivo_entrada: "Entrou no lugar de 7000009 (Cancelou a inscrição)",
      }),
      inscrito("7000004", { posicao: 3, art: 22, nota: 22 }),
      inscrito("7000005", { posicao: 4, art: 18, nota: 18 }),
      inscrito("7000009", {
        situacao: "ELIMINADO",
        motivo: "Cancelou a inscrição",
        art: 29,
        nota: 29,
      }),
    ],
    listas: [],
    ...extra,
  });

  /*
  O banco em partes (20261029120000), tirado da mesma triagem
  inteira: o resumo da abertura, as vagas, as listas, as páginas de cada
  vaga (cursor = deslocamento) e a conferência dos comunicados marcados.
*/
  function partesDoBanco(atual) {
    return {
      obter_resumo_pre_classificacao: () => {
        const {
          vagas: _vagas,
          listas: _listas,
          lotes: _lotes,
          regra_classificacao: _rc,
          ...cabecalho
        } = resumoDaPreInteira(atual());
        // Os totais do edital, como o banco soma do instantâneo.
        const c = contadoresDaPreClassificacao(atual());
        return {
          ...cabecalho,
          congelamento: null,
          totais: {
            inscritos: c.inscritos,
            eliminados: c.eliminados,
            ranqueados: c.ranqueados,
            no_lote: c.noLote,
            no_lote_regra: c.noLotePelaRegra,
            no_lote_decisao: c.noLotePorDecisao,
            tamanho: c.tamanho,
            divergencias: c.divergencias,
            vagas_sem_pre: c.vagasSemPreClassificacao,
          },
        };
      },
      obter_vagas_pre_classificacao: () => ({
        vagas: resumoDaPreInteira(atual()).vagas,
      }),
      obter_listas_pre_classificacao: () => {
        const r = resumoDaPreInteira(atual());
        return {
          listas: r.listas,
          lotes: r.lotes,
          regra_classificacao: r.regra_classificacao,
        };
      },
      listar_pre_classificacao: ({
        p_vaga,
        p_grupo,
        p_busca,
        p_apos,
        p_limite,
        p_motivo,
      }) => {
        const recorte = {
          vaga: p_vaga,
          grupo: p_grupo,
          busca: p_busca ?? "",
        };
        const todos = linhasDaPreInteira(atual(), {
          ...recorte,
          motivo: p_motivo ?? "",
        });
        const inicio = p_apos ?? 0;
        const por_vaga = {};
        for (const c of todos) por_vaga[c.vaga] = (por_vaga[c.vaga] ?? 0) + 1;
        return {
          candidatos: todos.slice(inicio, inicio + p_limite),
          proximo: inicio + p_limite < todos.length ? inicio + p_limite : null,
          total: todos.length,
          por_vaga,
          ...(p_grupo === "ELIMINADOS"
            ? {
                por_motivo: motivosDasLinhas(
                  linhasDaPreInteira(atual(), recorte),
                ),
              }
            : {}),
        };
      },
      conferir_eliminados_pre_classificacao: ({ p_chaves }) => ({
        candidatos: atual().candidatos.filter((c) =>
          p_chaves.includes(`${c.vaga}|${c.codigo}`),
        ),
        vagas: atual().vagas,
      }),
    };
  }

  /* Responde a leitura inteira e as partes com esta triagem; o resto, como antes. */
  const comPre = (pre, normal) => {
    const partes = {
      obter_pre_classificacao: () => pre,
      ...partesDoBanco(() => pre),
    };
    return async (nome, args) =>
      partes[nome]
        ? { data: partes[nome](args), error: null }
        : normal(nome, args);
  };
  const ausente = () => ({
    data: null,
    error: { code: "PGRST202", message: "Could not find the function" },
  });
  const chamadasDe = (rpc, nome) =>
    rpc.mock.calls.filter(([n]) => n === nome).map(([, a]) => a);
  const esperarBusca = () =>
    act(async () => new Promise((r) => setTimeout(r, 350)));

  function supabaseFalso({
    pode = true,
    situacao = "CONFERIDA",
    pre,
    disparo = "ACEITO",
  } = {}) {
    let regra = regraSalva(2, CONFIG, situacao);
    /* A regra própria da Triagem (20261029160000): a seção tirada da regra acima. */
    let triagem = {
      versao: 1,
      situacao,
      configuracao: { formato: 1, lote: CONFIG.lote },
      versoes: [{ versao: 1, nome: null }],
    };
    const respostas = {
      obter_regra_triagem: () => ({
        pode_coordenar: pode,
        papel: pode ? "COORDENADOR" : null,
        regra: triagem,
      }),
      salvar_regra_triagem: ({ p_configuracao, p_versao_atual }) => {
        triagem = {
          versao: p_versao_atual + 1,
          situacao: "CONFERIR",
          configuracao: p_configuracao,
          versoes: [],
        };
        return { regra: triagem };
      },
      disparar_robo: () => 61,
      situacao_do_disparo_robo: () => ({ disparo: 61, situacao: disparo }),
      listar_editais_avaliacao: () => ({
        area: "projetos",
        editais: [
          {
            id: "e93",
            edital: "93/2026",
            unidade: "Boa Vista",
            ativo: true,
            versao_regra: regra.versao,
          },
        ],
      }),
      obter_regra_analise: () => ({
        edital: { id: "e93", edital: "93/2026", area: "projetos" },
        papel: pode ? "COORDENADOR" : null,
        pode_coordenar: pode,
        origem: "PLANILHA",
        regra,
        modelos: [],
        nota_minima: { nota_minima: 15 },
        aldeias: { quantidade: 0 },
        fichas_concluidas: 0,
      }),
      obter_equipe_edital: () => ({
        papel: null,
        pode_coordenar: pode,
        gestores: [],
        equipe: [],
        pessoas: [],
        vagas: [],
      }),
      obter_pre_classificacao: () => pre ?? PRE(regra, pode),
      ...partesDoBanco(() => pre ?? PRE(regra, pode)),
      salvar_regra_analise: ({ p_configuracao, p_versao_atual }) => {
        regra = regraSalva(p_versao_atual + 1, p_configuracao, "CONFERIR");
        return { regra, fichas_afetadas: [] };
      },
      registrar_lista_pre_classificacao: ({ p_tipo, p_lote }) => ({
        lista: { id: `lista-${p_tipo}`, tipo: p_tipo },
        resultado: {
          schema: 1,
          tipo: p_tipo,
          lote: p_lote,
          edital: { id: "e93", edital: "Edital 93/2026", unidade: "Boa Vista" },
          casas: 1,
          modalidades: [],
          vagas: [
            {
              chave: "179698",
              codigo: "179698",
              cabecalho:
                "VAGA 179698 - Técnico de Segurança do Trabalho - 1 vaga + CR",
              geral: [
                {
                  posicao: 1,
                  nome: "Pessoa 7000001",
                  nota: 26,
                  modalidades: ["AC"],
                },
                {
                  posicao: 2,
                  nome: "Pessoa 7000003",
                  nota: 24,
                  modalidades: ["AC"],
                },
              ],
              listas: {},
              eliminados:
                p_tipo === "PROVISORIA"
                  ? [
                      {
                        nome: "Pessoa 7000009",
                        motivo: "Cancelou a inscrição",
                        detalhe: "",
                      },
                    ]
                  : [],
            },
          ],
          totais: { elegiveis: 2, eliminados: 1 },
        },
      }),
    };
    return {
      rpc: vi.fn(async (nome, args) => ({
        data: respostas[nome]?.(args) ?? null,
        error: null,
      })),
      auth: {
        getSession: async () => ({
          data: { session: { user: { id: "u" }, access_token: "t" } },
        }),
      },
    };
  }

  let secao;
  let painel;
  const toast = vi.fn();
  /* As releituras do acompanhamento do Recalcular: o teste as roda à mão. */
  let agendados = [];
  const agendar = (fn) => agendados.push(fn);
  const rodarAgendado = () =>
    act(async () => {
      await agendados.shift()();
    });

  async function montar(supabase) {
    secao = document.createElement("section");
    secao.id = "page-avaliacao-documental";
    secao.className = "page active";
    document.body.append(secao);
    await act(async () => {
      painel = montarTela(
        criarAvaliacaoDocumental,
        "page-avaliacao-documental",
        {
          supabase,
          toast,
          agendar,
        },
      );
    });
    await act(async () => void painel.render());
    await esperar();
    await escolher(secao.querySelector(".avd-edital select"), "e93");
    await esperar();
    const aba = abaDaPre();
    // Quem não coordena não tem a aba (abre na Fila).
    if (aba) await clicar(aba);
    await esperar();
  }
  const abaDaPre = () =>
    [...secao.querySelectorAll("button")].find(
      (b) =>
        b.textContent.includes("Triagem") ||
        b.textContent.includes("Abrir triagem"),
    );
  const botao = (texto) =>
    [...secao.querySelectorAll("button")].find((b) =>
      b.textContent.trim().startsWith(texto),
    );
  /*
  As partes da Triagem: as seções Pessoas, Por vaga e Regra (o Resumo e as
  Listas oficiais de antes ficam na Regra) e os Eliminados, pelo número da
  faixa de situação.
*/
  const SECAO = { resumo: "regra", listas: "regra" };
  async function abrirAba(id) {
    await clicar(
      id === "eliminados"
        ? secao.querySelector(
            "[data-tour='triagem-kpis'] [data-valor='eliminados']",
          )
        : secao.querySelector(
            `.avd-pre [role='radio'][data-valor='${SECAO[id] ?? id}']`,
          ),
    );
    await esperar();
  }
  const faixaDaTriagem = () =>
    secao.querySelector("[data-tour='triagem-kpis']");
  const secaoAberta = () =>
    secao.querySelector(".avd-pre [role='radio'][aria-checked='true']")?.dataset
      .valor;
  /* Na aba Por vaga, abre a vaga (as listas dela só carregam aberta). */
  async function abrirVaga(codigo) {
    if (!secao.querySelector(".avd-pre-vagas")) await abrirAba("vagas");
    const vaga = secao.querySelector(`[data-vaga-recolhida='${codigo}']`);
    await act(async () => {
      vaga.open = true;
      vaga.dispatchEvent(new Event("toggle"));
    });
    await esperar();
    return secao.querySelector(`[data-vaga='${codigo}']`);
  }
  /* Uma ação do menu "Ações" (abre o menu se estiver fechado). */
  async function itemDoMenu(acao) {
    if (!secao.querySelector(".avd-pre [role='menu']"))
      await clicar(secao.querySelector(".avd-pre [data-acao='abrir-menu']"));
    return secao.querySelector(`[role='menuitem'][data-acao='${acao}']`);
  }
  /* Recalcular: escolher no menu e confirmar. */
  async function pedirRecalculo() {
    await clicar(await itemDoMenu("recalcular"));
    await clicar(secao.querySelector("[data-acao='confirmar-recalcular']"));
  }

  beforeEach(() => {
    redefinirDadosDoMonitoramento();
    definirAreaAtual("projetos");
  });
  afterEach(async () => {
    await act(async () => painel?.raiz?.unmount());
    secao?.remove();
    document.body.innerHTML = "";
    sessionStorage.clear();
    redefinirDadosDoMonitoramento();
    toast.mockClear();
    agendados = [];
  });

  describe("Triagem (AM-4)", () => {
    it("AM-4.4: contadores, linha de corte, divergência e eliminados à parte", async () => {
      const supabase = supabaseFalso();
      await montar(supabase);
      // A tela abre em Pessoas: o resumo, as vagas (a faixa e o filtro) e 50
      // linhas de cada lista; as listas oficiais, não.
      expect(supabase.rpc).toHaveBeenCalledWith(
        "obter_resumo_pre_classificacao",
        {
          p_edital: "e93",
        },
      );
      expect(secaoAberta()).toBe("pessoas");
      expect(
        chamadasDe(supabase.rpc, "obter_vagas_pre_classificacao"),
      ).toHaveLength(1);
      expect(
        chamadasDe(supabase.rpc, "obter_listas_pre_classificacao"),
      ).toHaveLength(0);
      const linhasDePessoas = chamadasDe(
        supabase.rpc,
        "listar_pre_classificacao",
      ).length;
      // As duas listas de "Todas" (50 linhas) e a conta de "Podem entrar" (uma linha).
      expect(
        chamadasDe(supabase.rpc, "listar_pre_classificacao").map(
          (a) => `${a.p_grupo}:${a.p_limite}`,
        ),
      ).toEqual(
        expect.arrayContaining([
          "CLASSIFICADOS:50",
          "ELIMINADOS:50",
          "PODE_INCLUIR:1",
        ]),
      );
      expect(linhasDePessoas).toBe(3);
      // "Por decisão" é número informativo: não é botão nem filtro.
      const decisao = faixaDaTriagem().querySelector("[data-valor='decisao']");
      expect(decisao.tagName).toBe("DIV");
      expect(decisao.hasAttribute("aria-pressed")).toBe(false);
      // "Podem entrar": o total da própria lista que o número abre.
      expect(
        faixaDaTriagem().querySelector(
          "[data-valor='pode-entrar'] .ui-faixa-numero",
        ).textContent,
      ).not.toBe("");
      expect(chamadasDe(supabase.rpc, "obter_pre_classificacao")).toHaveLength(
        0,
      );
      expect(
        chamadasDe(supabase.rpc, "obter_pre_classificacao_se_mudou"),
      ).toHaveLength(0);
      // A trava vem no resumo: nada de chamada à parte.
      expect(
        chamadasDe(supabase.rpc, "obter_congelamento_inscricoes"),
      ).toHaveLength(0);
      const kpis = faixaDaTriagem().textContent;
      expect(kpis).toContain("Inscritos5");
      expect(kpis).toContain("Eliminados1");
      // O lote: o número grande, a % dos inscritos e, embaixo, o lote da regra.
      const lote = faixaDaTriagem().querySelector("[data-valor='lote']");
      expect(lote.querySelector(".ui-faixa-numero").textContent).toBe("2");
      expect(lote.querySelector(".ui-faixa-contexto").textContent).toBe("40%");
      expect(
        faixaDaTriagem().querySelector("[data-lote-da-triagem]").textContent,
      ).toBe("Lote: 2 de 2");
      // ART × recalculada: na Regra, com o atalho para os casos.
      await abrirAba("resumo");
      expect(
        secao.querySelector("[data-acao='ver-divergencias']").textContent,
      ).toContain("1 com ART × recalculada");
      // Por vaga: a parte das vagas só agora; cada vaga com os números à vista.
      await abrirAba("vagas");
      expect(
        chamadasDe(supabase.rpc, "obter_vagas_pre_classificacao"),
      ).toHaveLength(1);
      expect(
        secao.querySelector("[data-vaga-recolhida='179698'] summary")
          .textContent,
      ).toContain("5 inscritos · 1 eliminados");
      expect(chamadasDe(supabase.rpc, "listar_pre_classificacao")).toHaveLength(
        linhasDePessoas,
      );
      const vaga = await abrirVaga("179698");
      // As linhas de cada vaga vêm 50 por vez, só com a vaga aberta.
      expect(
        chamadasDe(supabase.rpc, "listar_pre_classificacao"),
      ).toContainEqual({
        p_edital: "e93",
        p_vaga: "179698",
        p_grupo: "CLASSIFICADOS",
        p_busca: null,
        p_apos: null,
        p_limite: 50,
      });
      expect(vaga.textContent).toContain(
        "VAGA 179698 - Técnico de Segurança do Trabalho - Boa Vista - 1 vaga + CR",
      );
      expect(vaga.textContent).toContain("linha de corte 24");
      const linhas = [...vaga.querySelectorAll("tbody tr")].map(
        (tr) => tr.dataset.candidato || tr.textContent,
      );
      expect(linhas.slice(0, 5)).toEqual([
        "7000001",
        "7000003",
        "Linha de corte",
        "7000004",
        "7000005",
      ]);
      expect(
        vaga.querySelector("[data-candidato='7000003']").textContent,
      ).toContain("diverge");
      // Os eliminados da vaga só são lidos quando o grupo abre.
      expect(
        chamadasDe(supabase.rpc, "listar_pre_classificacao").some(
          (a) => a.p_grupo === "ELIMINADOS" && a.p_vaga === "179698",
        ),
      ).toBe(false);
      const grupo = vaga.querySelector(".avd-eliminados");
      await act(async () => {
        grupo.open = true;
        grupo.dispatchEvent(new Event("toggle"));
      });
      await esperar();
      expect(grupo.textContent).toContain("Cancelou a inscrição");
      // Os eliminados rolam dentro do cartão, como o lote (a tabela solta
      // herdava min-width 1180px de app.css e a página rolava de lado).
      expect(
        vaga.querySelector(".avd-eliminados .ui-tabela-rolagem > table"),
      ).not.toBeNull();
      expect(vaga.textContent).toContain(
        "Fora do lote com nota acima da linha de corte",
      );
      expect(
        secao.querySelector("[data-vaga-recolhida='180231']").textContent,
      ).toContain("ainda sem triagem");
      // Listas oficiais: a parte só ao abrir a Regra.
      await abrirAba("listas");
      expect(
        chamadasDe(supabase.rpc, "obter_listas_pre_classificacao"),
      ).toHaveLength(1);
    });

    it("Recalcular pede o job só do edital; leitor não vê o botão", async () => {
      const supabase = supabaseFalso();
      await montar(supabase);
      // O menu pede confirmação antes de disparar.
      await clicar(await itemDoMenu("recalcular"));
      expect(chamadasDe(supabase.rpc, "disparar_robo")).toHaveLength(0);
      expect(
        secao.querySelector("[aria-label='Confirmar o recálculo']").textContent,
      ).toContain("Recalcular a triagem de");
      await clicar(secao.querySelector("[data-acao='confirmar-recalcular']"));
      await esperar();
      expect(supabase.rpc).toHaveBeenCalledWith("disparar_robo", {
        p_robo: "pre_classificacao",
        p_inputs: { editais: ["e93"] },
      });
      expect((await itemDoMenu("recalcular")).textContent).toBe(
        "Recalcular (pedido enviado)",
      );
      await act(async () => painel.raiz.unmount());
      secao.remove();
      // Quem não coordena nem tem a aba Triagem (nem a lê do banco).
      const leitor = supabaseFalso({ pode: false });
      await montar(leitor);
      expect(abaDaPre()).toBeUndefined();
      expect(secao.querySelector("[data-acao='abrir-menu']")).toBeNull();
      expect(secao.querySelector("[data-acao='recalcular']")).toBeNull();
      expect(secao.querySelector(".avd-vaga input")).toBeNull();
      expect(
        leitor.rpc.mock.calls.some(([n]) =>
          n.startsWith("obter_pre_classificacao"),
        ),
      ).toBe(false);
    });

    it("Atualizar e a reabertura da tela relêem a triagem da aba aberta", async () => {
      const supabase = supabaseFalso();
      await montar(supabase);
      const kpis = () => faixaDaTriagem().textContent;
      expect(kpis()).toContain("Inscritos5");
      const normal = supabase.rpc.getMockImplementation();
      const comInscritos = (n) => {
        const pre = PRE(regraSalva(2));
        pre.vagas[0] = { ...pre.vagas[0], inscritos: n };
        supabase.rpc.mockImplementation(comPre(pre, normal));
      };
      comInscritos(9);
      await clicar(secao.querySelector("[data-acao='atualizar']"));
      await esperar();
      expect(kpis()).toContain("Inscritos9");
      // Voltar à tela pelo menu ou "Atualizar dados" do app chamam render().
      comInscritos(11);
      await act(async () => void painel.render());
      await esperar();
      expect(kpis()).toContain("Inscritos11");
    });

    it("Recalcular que falha diz por quê e o botão volta", async () => {
      const supabase = supabaseFalso();
      await montar(supabase);
      // Na Regra (o aviso do recálculo fica lá); as listas oficiais já lidas.
      await abrirAba("resumo");
      supabase.rpc.mockImplementationOnce(async () => ({
        data: null,
        error: {
          code: "42501",
          message:
            "Só a coordenação da avaliação do edital recalcula a triagem.",
        },
      }));
      await pedirRecalculo();
      await esperar();
      expect(secao.querySelector("[role='alert']").textContent).toBe(
        "Recálculo não pedido: Só a coordenação da avaliação do edital recalcula a triagem.",
      );
      expect((await itemDoMenu("recalcular")).textContent).toBe("Recalcular");
      expect((await itemDoMenu("recalcular")).disabled).toBe(false);
      expect(toast).toHaveBeenLastCalledWith(
        "Recálculo não pedido: Só a coordenação da avaliação do edital recalcula a triagem.",
        "error",
      );

      supabase.rpc.mockImplementationOnce(async () => {
        throw new TypeError("Failed to fetch");
      });
      await pedirRecalculo();
      await esperar();
      expect(secao.querySelector("[role='alert']").textContent).toMatch(
        /^Recálculo não pedido: /,
      );
      expect((await itemDoMenu("recalcular")).disabled).toBe(false);
      expect(agendados).toHaveLength(0);
    });

    it("Recalcular com a chave do cofre vencida: diz o que fazer e o botão volta", async () => {
      const supabase = supabaseFalso({ disparo: "SEM_TOKEN" });
      await montar(supabase);
      await pedirRecalculo();
      await esperar();
      expect(supabase.rpc).toHaveBeenCalledWith("disparar_robo", {
        p_robo: "pre_classificacao",
        p_inputs: { editais: ["e93"] },
      });
      // A conferência do pedido (3 s) vem antes das releituras.
      await rodarAgendado();
      await esperar();
      expect(supabase.rpc).toHaveBeenCalledWith("situacao_do_disparo_robo", {
        p_disparo: 61,
      });
      expect(secao.querySelector("[role='alert']").textContent).toBe(
        "Recálculo não pedido: A chave de disparo dos robôs expirou ou foi recusada; um administrador precisa trocá-la no cofre (Vault) com o nome github_disparo_robos.",
      );
      expect((await itemDoMenu("recalcular")).disabled).toBe(false);
    });

    it("Recalcular pedido avisa e relê sozinho até a execução terminar", async () => {
      const supabase = supabaseFalso();
      await montar(supabase);
      await pedirRecalculo();
      await esperar();
      expect(secao.querySelector("[role='status']").textContent).toMatch(
        /^Recálculo pedido às \d\d:\d\d\. A lista atualiza sozinha quando terminar\.$/,
      );
      // A conferência do pedido (o GitHub aceitou) e a primeira releitura.
      expect(agendados).toHaveLength(2);
      await rodarAgendado();
      expect(secao.querySelector("[role='alert']")).toBeNull();
      expect(agendados).toHaveLength(1);

      const normal = supabase.rpc.getMockImplementation();
      const responder = (pre) =>
        supabase.rpc.mockImplementation(comPre(pre, normal));
      // 1ª releitura: o job está rodando.
      responder(PRE(regraSalva(2), true, { em_andamento: true }));
      await rodarAgendado();
      expect((await itemDoMenu("recalcular")).textContent).toBe(
        "Recalcular (rodando…)",
      );
      expect(agendados).toHaveLength(1);
      // 2ª releitura: terminou, com a execução nova e os números novos.
      const nova = PRE(regraSalva(2), true, {
        ultima_execucao: {
          id: "precl-2",
          inicio: "2026-10-06T13:00:00Z",
          fim: "2026-10-06T13:01:00Z",
          situacao: "CONCLUIDA",
          disparo: "TELA",
          edital: { edital: "e93", situacao: "PROCESSADO" },
        },
      });
      nova.vagas[0] = { ...nova.vagas[0], inscritos: 9 };
      responder(nova);
      await rodarAgendado();
      expect(agendados).toHaveLength(0);
      expect(faixaDaTriagem().textContent).toContain("Inscritos9");
      expect(secao.querySelector("[role='status']").textContent).toMatch(
        /^Triagem recalculada às \d\d:\d\d\.$/,
      );
      expect((await itemDoMenu("recalcular")).textContent).toBe("Recalcular");
      expect(toast).toHaveBeenLastCalledWith(
        expect.stringMatching(/^Triagem recalculada/),
        "success",
      );
    });

    it("regra não conferida trava o Recalcular e diz o que fazer", async () => {
      await montar(supabaseFalso({ situacao: "CONFERIR" }));
      expect((await itemDoMenu("recalcular")).disabled).toBe(true);
      await abrirAba("resumo");
      expect(secao.textContent).toContain(
        "Confira a regra da Triagem (Editais › Regras do edital) para recalcular.",
      );
    });

    it("edital sem regra conferida na última execução vira aviso", async () => {
      const supabase = supabaseFalso();
      const regra = regraSalva(2);
      const pre = PRE(regra, true, {
        ultima_execucao: {
          id: "x",
          inicio: "2026-10-06T12:00:00Z",
          situacao: "CONCLUIDA",
          edital: { situacao: "SEM_REGRA" },
        },
      });
      await montar({
        ...supabase,
        rpc: vi.fn(comPre(pre, (nome, args) => supabase.rpc(nome, args))),
      });
      await abrirAba("resumo");
      expect(secao.textContent).toContain("Edital sem regra conferida");
    });
  });

  describe("lote por vaga (AM-5.0)", () => {
    it("o tamanho editado vira versão nova da regra da Triagem com motivo", async () => {
      const supabase = supabaseFalso();
      await montar(supabase);
      await abrirVaga("179698");
      const campo = secao.querySelector(
        "[data-vaga='179698'] input[type='number']",
      );
      expect(campo.placeholder).toBe("6");
      await digitar(campo, "4");
      expect(
        secao.querySelector("[data-acao='salvar-tamanhos']").disabled,
      ).toBe(true);
      await digitar(
        secao.querySelector("[aria-label='Salvar os tamanhos do lote'] input"),
        "Lote do 93 definido pela coordenação",
      );
      await clicar(secao.querySelector("[data-acao='salvar-tamanhos']"));
      await esperar();
      const chamada = supabase.rpc.mock.calls.find(
        ([nome]) => nome === "salvar_regra_triagem",
      );
      expect(chamada[1].p_configuracao.lote.por_vaga).toEqual({ 179698: 4 });
      expect(chamada[1].p_configuracao.formato).toBe(1);
      expect(chamada[1].p_motivo).toBe("Lote do 93 definido pela coordenação");
      expect(chamada[1].p_versao_atual).toBe(1);
      // A regra da análise não é mais tocada pela Triagem.
      expect(
        supabase.rpc.mock.calls.some(
          ([nome]) => nome === "salvar_regra_analise",
        ),
      ).toBe(false);
    });
  });

  describe("listas PROVISORIA e LOTE (AM-16)", () => {
    it("registra a Provisória e o lote de cada reposição e exporta pelo gerador da Classificação", async () => {
      const supabase = supabaseFalso();
      await montar(supabase);
      await abrirAba("listas");
      await clicar(botao("Registrar"));
      await esperar();
      expect(supabase.rpc).toHaveBeenCalledWith(
        "registrar_lista_pre_classificacao",
        {
          p_edital: "e93",
          p_tipo: "PROVISORIA",
          p_lote: null,
        },
      );
      // publica_reposicao: o lote inicial e a reposição 2 aparecem para registrar.
      expect(botao("Registrar o lote inicial (1)")).toBeTruthy();
      await clicar(botao("Registrar a reposição 2 (1)"));
      await esperar();
      expect(supabase.rpc).toHaveBeenCalledWith(
        "registrar_lista_pre_classificacao",
        {
          p_edital: "e93",
          p_tipo: "LOTE",
          p_lote: 2,
        },
      );
      expect(botao("Copiar para o SEI")).toBeTruthy();
      expect(botao("Eliminados: DOCX")).toBeTruthy();
    });
  });

  describe("inclusão no lote por decisão da coordenação", () => {
    const COM_DECISAO = (pode = true) => {
      const base = PRE(regraSalva(2), pode);
      return {
        ...base,
        vagas: [
          {
            ...base.vagas[0],
            no_lote: 3,
            no_lote_regra: 2,
            no_lote_decisao: 1,
          },
          base.vagas[1],
        ],
        candidatos: base.candidatos.map((c) =>
          c.codigo === "7000005"
            ? {
                ...c,
                situacao: "NO_LOTE",
                lote: 2,
                entrada: "DECISAO",
                motivo_entrada: "Critério CORES",
                decisao: {
                  motivo: "Critério CORES",
                  por: "Gestora",
                  em: "2026-10-07T12:00:00Z",
                  situacao_regra: "RANQUEADO",
                },
              }
            : c.codigo === "7000009"
              ? { ...c, motivo_codigo: "CANCELADO" }
              : c,
        ),
      };
    };
    const comRespostas = (pre, extras) => {
      const supabase = supabaseFalso({ pre });
      const original = supabase.rpc.getMockImplementation();
      supabase.rpc.mockImplementation(async (nome, args) =>
        extras[nome] ? extras[nome](args) : original(nome, args),
      );
      return supabase;
    };

    it('mostra o selo "Decisão: Critério CORES" e "N pela regra + M por decisão"; inclui com a sugestão do motivo', async () => {
      const incluir = vi.fn(() => ({
        data: { incluidos: 1, fichas_criadas: 1 },
        error: null,
      }));
      const supabase = comRespostas(COM_DECISAO(), {
        incluir_no_lote_por_decisao: incluir,
      });
      await montar(supabase);
      // A faixa: o lote inteiro, os por decisão e, embaixo, a composição.
      const numero = (v) =>
        faixaDaTriagem().querySelector(`[data-valor='${v}'] .ui-faixa-numero`)
          .textContent;
      expect(numero("lote")).toBe("3");
      expect(numero("decisao")).toBe("1");
      expect(
        faixaDaTriagem().querySelector("[data-lote-da-triagem]").textContent,
      ).toBe("Lote: 2 de 2 pela regra + 1 por decisão");
      const vaga = await abrirVaga("179698");
      expect(vaga.querySelector("[data-lote-da-vaga]").textContent).toContain(
        "Lote: 2 de 2 pela regra + 1 por decisão",
      );
      const linha = vaga.querySelector("[data-candidato='7000005']");
      expect(linha.querySelector(".avd-selo-decisao").textContent).toBe(
        "Decisão: Critério CORES",
      );
      expect(linha.querySelector(".avd-selo-decisao").title).toContain(
        "Por Gestora",
      );

      await clicar(vaga.querySelector("[data-acao='incluir-por-decisao']"));
      const opcoes = [
        ...document.querySelectorAll(
          "table[aria-label='Candidatos fora do lote pela regra'] tbody tr",
        ),
      ].map((tr) => tr.dataset.candidato);
      expect(opcoes).toEqual(["7000004", "7000009"]);
      const motivo = document.querySelector(
        "input[list='avdMotivosDaDecisao']",
      );
      expect(motivo.value).toBe("Critério CORES");
      const confirmar = document.querySelector(
        "[data-acao='confirmar-incluir-por-decisao']",
      );
      expect(confirmar.disabled).toBe(true);
      await clicar(
        document.querySelector("input[aria-label='Incluir 7000009']"),
      );
      await clicar(confirmar);
      await esperar();
      expect(incluir).toHaveBeenCalledWith({
        p_edital: "e93",
        p_codigos: ["7000009"],
        p_motivo: "Critério CORES",
        p_vaga: "179698",
      });
      expect(toast).toHaveBeenCalledWith(
        "1 candidato incluído no lote por decisão da coordenação.",
        "success",
      );
    });

    it('o menu "Ações" tem "Incluir por decisão" em qualquer aba, sem abrir vaga (coordenação e administrador global)', async () => {
      // O banco diz COORDENADOR também ao administrador global (FC_PAPEL_AVALIACAO).
      const incluir = vi.fn(() => ({
        data: { incluidos: 1, fichas_criadas: 1 },
        error: null,
      }));
      const supabase = comRespostas(COM_DECISAO(), {
        incluir_no_lote_por_decisao: incluir,
      });
      await montar(supabase);
      for (const aba of ["resumo", "eliminados", "vagas"]) {
        await abrirAba(aba);
        const item = await itemDoMenu("incluir-por-decisao-edital");
        expect(item, `aba ${aba}`).not.toBeNull();
        expect(item.disabled, `aba ${aba}`).toBe(false);
        // Fecha o menu sem escolher.
        await clicar(secao.querySelector(".avd-pre [data-acao='abrir-menu']"));
      }
      // Nenhuma vaga aberta: a ação não depende do cartão da vaga.
      expect(
        secao.querySelector("[data-acao='incluir-por-decisao']"),
      ).toBeNull();

      await clicar(await itemDoMenu("incluir-por-decisao-edital"));
      await esperar();
      expect(
        chamadasDe(supabase.rpc, "listar_pre_classificacao"),
      ).toContainEqual(
        expect.objectContaining({ p_vaga: null, p_grupo: "PODE_INCLUIR" }),
      );
      const opcoes = [
        ...document.querySelectorAll(
          "table[aria-label='Candidatos fora do lote pela regra'] tbody tr",
        ),
      ].map((tr) => tr.dataset.candidato);
      expect(opcoes).toEqual(expect.arrayContaining(["7000004", "7000009"]));
      await clicar(
        document.querySelector("input[aria-label='Incluir 7000004']"),
      );
      await clicar(
        document.querySelector("[data-acao='confirmar-incluir-por-decisao']"),
      );
      await esperar();
      expect(incluir).toHaveBeenCalledWith({
        p_edital: "e93",
        p_codigos: ["7000004"],
        p_motivo: "Critério CORES",
        p_vaga: "179698",
      });
    });

    it("Pessoas: o card Inscritos abre a aba; a busca vai ao banco no edital todo e o filtro volta ao reabrir", async () => {
      const supabase = comRespostas(COM_DECISAO(), {});
      await montar(supabase);
      // A Triagem abre em Pessoas, com o número Inscritos marcado.
      await clicar(faixaDaTriagem().querySelector("[data-valor='inscritos']"));
      await esperar();
      expect(secaoAberta()).toBe("pessoas");
      expect(
        faixaDaTriagem()
          .querySelector("[data-valor='inscritos']")
          .getAttribute("aria-pressed"),
      ).toBe("true");
      // "Todas": classificados e eliminados do edital todo, 50 por vez.
      for (const grupo of ["CLASSIFICADOS", "ELIMINADOS"])
        expect(
          chamadasDe(supabase.rpc, "listar_pre_classificacao"),
        ).toContainEqual({
          p_edital: "e93",
          p_vaga: null,
          p_grupo: grupo,
          p_busca: null,
          p_apos: null,
          p_limite: 50,
        });
      // "Todas": as duas listas no mesmo card, cada uma com o título.
      expect(
        [...secao.querySelectorAll(".avd-pessoas .ui-lista-subtitulo")].map(
          (h) => h.textContent,
        ),
      ).toEqual(["Classificados", "Eliminados"]);
      await digitar(
        secao.querySelector("[data-acao='buscar-pessoa']"),
        "7000004",
      );
      // A busca vai ao banco 300 ms depois da última tecla.
      await esperar(() => new Promise((ok) => setTimeout(ok, 350)));
      await esperar();
      for (const grupo of ["CLASSIFICADOS", "ELIMINADOS"])
        expect(
          chamadasDe(supabase.rpc, "listar_pre_classificacao"),
        ).toContainEqual(
          expect.objectContaining({
            p_vaga: null,
            p_grupo: grupo,
            p_busca: "7000004",
          }),
        );
      const linhas = [
        ...secao.querySelectorAll(
          ".avd-pessoas-lista tbody tr[data-candidato]",
        ),
      ].map((tr) => tr.dataset.candidato);
      expect(linhas).toEqual(["7000004"]);
      // Com filtro, a barra mostra "Limpar".
      expect(
        secao.querySelector("[data-acao='limpar-filtros']"),
      ).not.toBeNull();
      expect(
        JSON.parse(sessionStorage.getItem("monitora:triagem:pessoas:e93")),
      ).toEqual({ busca: "7000004", vaga: "", situacao: "TODAS" });

      // F5: a tela monta de novo e volta com o filtro (na aba Pessoas).
      await act(async () => painel.raiz.unmount());
      secao.remove();
      await montar(supabase);
      await abrirAba("pessoas");
      expect(secao.querySelector("[data-acao='buscar-pessoa']").value).toBe(
        "7000004",
      );
      await clicar(secao.querySelector("[data-acao='limpar-filtros']"));
      expect(secao.querySelector("[data-acao='buscar-pessoa']").value).toBe("");
      expect(sessionStorage.getItem("monitora:triagem:pessoas:e93")).toBeNull();
    });

    it("Podem entrar: o número da faixa é o total da lista que ele abre", async () => {
      const supabase = comRespostas(COM_DECISAO(), {});
      await montar(supabase);
      const chip = faixaDaTriagem().querySelector("[data-valor='pode-entrar']");
      const numero = chip.querySelector(".ui-faixa-numero").textContent;
      await clicar(chip);
      await esperar();
      expect(chip.getAttribute("aria-pressed")).toBe("true");
      expect(
        secao.querySelector(".avd-pessoas .ui-lista-contagem").textContent,
      ).toBe(`Mostrando ${numero} de ${numero}`);
    });

    it('Pessoas: a ação da linha inclui no lote com a pessoa já marcada; o "⋯" revoga e mostra a vaga', async () => {
      const incluir = vi.fn(() => ({
        data: { incluidos: 1, fichas_criadas: 1 },
        error: null,
      }));
      const supabase = comRespostas(COM_DECISAO(), {
        incluir_no_lote_por_decisao: incluir,
      });
      await montar(supabase);
      await abrirAba("pessoas");
      const linha = (codigo) =>
        secao.querySelector(`.avd-pessoas-lista [data-candidato='${codigo}']`);
      // Fora do lote: o botão da linha é "Incluir no lote".
      const principal = linha("7000004").querySelector(
        "[data-acao='incluir-pessoa']",
      );
      expect(principal.textContent).toContain("Incluir no lote");
      // No lote pela regra: nada a incluir.
      expect(
        linha("7000001").querySelector("[data-acao='incluir-pessoa']"),
      ).toBeNull();
      // Eliminado: o comunicado é a ação principal.
      expect(
        linha("7000009").querySelector("[data-acao='espelho-eliminado-pre']"),
      ).not.toBeNull();
      await clicar(principal);
      expect(
        document.querySelector("input[aria-label='Incluir 7000004']").checked,
      ).toBe(true);
      await clicar(
        document.querySelector("[data-acao='confirmar-incluir-por-decisao']"),
      );
      await esperar();
      expect(incluir).toHaveBeenCalledWith({
        p_edital: "e93",
        p_codigos: ["7000004"],
        p_motivo: "Critério CORES",
        p_vaga: "179698",
      });

      // Incluído por decisão: o "⋯" tem "Revogar decisão" (pede motivo na gaveta).
      await clicar(linha("7000005").querySelector("[data-acao='abrir-menu']"));
      const menu = linha("7000005").querySelector("[role='menu']");
      expect(menu.getAttribute("aria-label")).toBe("Mais ações de 7000005");
      expect(
        [...menu.querySelectorAll("[role='menuitem']")].map((b) =>
          b.textContent.trim(),
        ),
      ).toEqual(["Revogar decisão", "Copiar código"]);
      // Sem o que fazer na linha, o botão dela é "Ver na vaga" (neutro).
      expect(
        linha("7000005").querySelector("[data-acao='pessoa-ver-vaga']")
          .className,
      ).toBe("btn contorno small");
      await clicar(menu.querySelector("[data-acao='pessoa-revogar']"));
      const gaveta = document.querySelector("[data-revogar='7000005']");
      expect(
        gaveta.querySelector("[data-acao='revogar-decisao']").disabled,
      ).toBe(true);
      await clicar(
        [...document.querySelectorAll(".ui-gaveta button")].find(
          (b) => b.textContent.trim() === "Cancelar",
        ),
      );
      expect(document.querySelector("[data-revogar='7000005']")).toBeNull();

      // "Ver na vaga": a aba Por vaga, com a vaga aberta.
      await clicar(linha("7000005").querySelector("[data-acao='abrir-menu']"));
      await clicar(
        linha("7000005").querySelector("[data-acao='pessoa-ver-vaga']"),
      );
      await esperar();
      expect(secaoAberta()).toBe("vagas");
      expect(secao.querySelector("[data-vaga-recolhida='179698']").open).toBe(
        true,
      );
      expect(secao.querySelector("[data-vaga='179698']")).not.toBeNull();
    });

    it("revoga com motivo; a ficha concluída o banco recusa e a tela diz por quê", async () => {
      const revogar = vi.fn(() => ({
        data: null,
        error: {
          code: "22023",
          message:
            "O candidato 7000005 já tem a ficha concluída: a decisão não se revoga.",
        },
      }));
      await montar(
        comRespostas(COM_DECISAO(), { revogar_decisao_lote: revogar }),
      );
      await abrirVaga("179698");
      const linha = () => secao.querySelector("[data-candidato='7000005']");
      await clicar(
        linha().querySelector("[data-acao='abrir-revogar-decisao']"),
      );
      const campo = linha().querySelector("[data-revogar='7000005'] input");
      await digitar(campo, "curto");
      expect(
        linha().querySelector("[data-acao='revogar-decisao']").disabled,
      ).toBe(true);
      await digitar(campo, "Decisão registrada por engano");
      await clicar(linha().querySelector("[data-acao='revogar-decisao']"));
      await esperar();
      expect(revogar).toHaveBeenCalledWith({
        p_edital: "e93",
        p_codigos: ["7000005"],
        p_motivo: "Decisão registrada por engano",
        p_vaga: "179698",
      });
      expect(linha().textContent).toContain("ficha concluída");
    });

    it("quem não coordena não vê a aba, nem incluir nem revogar", async () => {
      await montar(supabaseFalso({ pode: false, pre: COM_DECISAO(false) }));
      expect(abaDaPre()).toBeUndefined();
      expect(secao.querySelector("[data-vaga='179698']")).toBeNull();
      expect(
        secao.querySelector("[data-acao='incluir-por-decisao']"),
      ).toBeNull();
      expect(
        secao.querySelector("[data-acao='incluir-por-decisao-edital']"),
      ).toBeNull();
      expect(
        secao.querySelector("[data-acao='abrir-revogar-decisao']"),
      ).toBeNull();
    });
  });

  describe("estado da triagem: voltar à aba não relê", () => {
    it("relê só com outro edital, outra versão da regra ou depois de 5 minutos", async () => {
      let agora = new Date("2026-10-15T12:00:00Z");
      const rpc = vi.fn(async (nome) => ({
        data: nome === "obter_resumo_pre_classificacao" ? { vagas: [] } : null,
        error: null,
      }));
      const pre = criarEstadoDaPreClassificacao({
        supabase: { rpc },
        agora: () => agora,
      });
      const leituras = () =>
        rpc.mock.calls.filter(([n]) => n === "obter_resumo_pre_classificacao")
          .length;
      await pre.garantirCarregado("e1", "2");
      await pre.garantirCarregado("e1", "2");
      expect(leituras()).toBe(1);
      await pre.garantirCarregado("e1", "3");
      expect(leituras()).toBe(2);
      await pre.garantirCarregado("e2", "3");
      expect(leituras()).toBe(3);
      agora = new Date(agora.getTime() + 5 * 60 * 1000);
      await pre.garantirCarregado("e2", "3");
      expect(leituras()).toBe(4);
      await pre.carregar();
      expect(leituras()).toBe(5);
    });
  });

  describe("Triagem por versão (20261014230000), banco sem as partes (antes de 20261029120000)", () => {
    /* Um banco com a leitura por versão e a situação leve, sem o resumo nem as páginas. */
    function bancoNovo() {
      const estado = {
        versao: "v1",
        execucao: { id: "precl-1", situacao: "CONCLUIDA" },
        andamento: false,
      };
      const pacote = () => ({
        schema_version: 1,
        em_andamento: estado.andamento,
        ultima_execucao: estado.execucao,
        vagas: [{ codigo: "179698", inscritos: 2 }],
        versao: estado.versao,
        candidatos_em_colunas: {
          colunas: ["codigo", "situacao", "vaga"],
          dicionarios: { situacao: ["NO_LOTE"], vaga: ["179698"] },
          linhas: [
            ["7000001", 0, 0],
            ["7000003", 0, 0],
          ],
        },
      });
      const rpc = vi.fn(async (nome, args) => {
        if (nome === "obter_pre_classificacao_se_mudou")
          return {
            data:
              args.p_versao === estado.versao
                ? { inalterado: true, versao: estado.versao }
                : pacote(),
            error: null,
          };
        if (nome === "obter_situacao_pre_classificacao")
          return {
            data: {
              em_andamento: estado.andamento,
              ultima_execucao: estado.execucao,
            },
            error: null,
          };
        if (nome === "disparar_robo") return { data: 61, error: null };
        if (
          nome.endsWith("_pre_classificacao") &&
          nome !== "obter_situacao_pre_classificacao"
        )
          return ausente();
        return { data: null, error: null };
      });
      return { estado, rpc };
    }
    const chamadas = (rpc, nome) =>
      rpc.mock.calls.filter(([n]) => n === nome).map(([, a]) => a);

    it("refaz os inscritos das colunas; a releitura sem mudança manda a versão e fica com o que tem", async () => {
      const { rpc } = bancoNovo();
      const pre = criarEstadoDaPreClassificacao({
        supabase: { rpc },
        copias: null,
      });
      await pre.carregar("e1");
      const dados = pre.obter().dados;
      // O resumo sai da leitura inteira; as páginas, dela também.
      expect(dados.candidatos).toBeUndefined();
      expect(dados.lotes).toEqual([]);
      const pagina = await pre.listar({
        vaga: "179698",
        grupo: "CLASSIFICADOS",
      });
      expect(pagina.linhas.map((c) => c.codigo)).toEqual([
        "7000001",
        "7000003",
      ]);
      expect(pagina.total).toBe(2);
      await pre.carregar("e1");
      expect(chamadas(rpc, "obter_pre_classificacao_se_mudou")).toEqual([
        { p_edital: "e1", p_versao: null },
        { p_edital: "e1", p_versao: "v1" },
      ]);
      expect(pre.obter().dados).toEqual(dados);
      expect(chamadas(rpc, "obter_pre_classificacao")).toHaveLength(0);
      // Banco sem as partes: depois da primeira recusa, a página vem da leitura guardada.
      expect(chamadas(rpc, "listar_pre_classificacao")).toHaveLength(0);
    });

    it("Recalcular acompanha pela situação leve e relê o pacote só no fim", async () => {
      const { estado, rpc } = bancoNovo();
      const fila = [];
      const pre = criarEstadoDaPreClassificacao({
        supabase: { rpc },
        copias: null,
        toast: () => {},
        agendar: (fn) => fila.push(fn),
      });
      await pre.carregar("e1");
      await pre.recalcular();
      // A conferência do pedido e a primeira volta do acompanhamento.
      await fila.shift()();
      estado.andamento = true;
      estado.versao = "v2";
      await fila.shift()();
      expect(pre.obter().dados.em_andamento).toBe(true);
      await fila.shift()();
      estado.andamento = false;
      estado.execucao = { id: "precl-2", situacao: "CONCLUIDA", fim: null };
      estado.versao = "v3";
      await fila.shift()();
      expect(fila).toHaveLength(0);
      expect(chamadas(rpc, "obter_situacao_pre_classificacao")).toHaveLength(3);
      // Uma leitura ao abrir e uma no fim: nenhuma a cada volta.
      expect(chamadas(rpc, "obter_pre_classificacao_se_mudou")).toEqual([
        { p_edital: "e1", p_versao: null },
        { p_edital: "e1", p_versao: "v1" },
      ]);
      expect(pre.obter().dados.ultima_execucao.id).toBe("precl-2");
      expect(pre.obter().aviso.texto).toMatch(/^Triagem recalculada/);
    });
  });

  describe("aba Eliminados da Triagem", () => {
    it("busca e filtra no banco (vaga e motivo), marca o filtro e imprime conferindo só os marcados", async () => {
      const base = PRE(regraSalva(2));
      const supabase = supabaseFalso({
        pre: {
          ...base,
          candidatos: base.candidatos.map((c) =>
            c.codigo === "7000009" ? { ...c, motivo_codigo: "CANCELADO" } : c,
          ),
        },
      });
      await montar(supabase);
      await abrirAba("eliminados");
      // A lista é a do edital todo, 50 por vez, com as opções de motivo.
      expect(
        chamadasDe(supabase.rpc, "listar_pre_classificacao"),
      ).toContainEqual({
        p_edital: "e93",
        p_vaga: null,
        p_grupo: "ELIMINADOS",
        p_busca: null,
        p_apos: null,
        p_limite: 50,
      });
      const motivos = [
        ...secao.querySelectorAll(
          "[data-acao='filtro-motivo-eliminados'] option",
        ),
      ].map((o) => o.textContent);
      expect(motivos).toEqual(["Todos os motivos", "Cancelou a inscrição (1)"]);
      // Os comunicados em lote aparecem com alguém marcado.
      expect(secao.querySelector("[data-acao='comunicados-zip']")).toBeNull();
      await escolher(
        secao.querySelector("[data-acao='filtro-motivo-eliminados']"),
        secao.querySelector(
          "[data-acao='filtro-motivo-eliminados'] option:last-child",
        ).value,
      );
      await esperar();
      expect(
        chamadasDe(supabase.rpc, "listar_pre_classificacao").some(
          (a) => a.p_grupo === "ELIMINADOS" && a.p_motivo,
        ),
      ).toBe(true);
      await digitar(
        secao.querySelector("[data-acao='buscar-espelho-eliminado']"),
        "pessoa 7000009",
      );
      await esperar();
      expect(
        chamadasDe(supabase.rpc, "listar_pre_classificacao").some(
          (a) => a.p_grupo === "ELIMINADOS" && a.p_busca === "pessoa 7000009",
        ),
      ).toBe(true);
      await clicar(
        secao.querySelector("[data-acao='comunicados-marcar-busca']"),
      );
      await esperar();
      expect(
        secao.querySelector("[data-acao='comunicados-marcados']").textContent,
      ).toBe("1 marcado(s)");
      expect(
        secao.querySelector(
          "[data-candidato='7000009'] [data-acao='marcar-comunicado']",
        ).checked,
      ).toBe(true);
      expect(
        secao.querySelector("[data-acao='comunicados-pdf']").disabled,
      ).toBe(false);
      await clicar(secao.querySelector("[data-acao='comunicados-imprimir']"));
      await esperar();
      // Confere só os marcados, como estão agora (nunca a triagem inteira).
      expect(
        chamadasDe(supabase.rpc, "conferir_eliminados_pre_classificacao"),
      ).toEqual([{ p_edital: "e93", p_chaves: ["179698|7000009"] }]);
      expect(chamadasDe(supabase.rpc, "obter_pre_classificacao")).toHaveLength(
        0,
      );
      expect(secao.textContent).toContain(
        "1 comunicado no documento para imprimir.",
      );
    });

    it("a marcação vale nas duas abas: marcar na vaga aparece em Eliminados", async () => {
      const supabase = supabaseFalso();
      await montar(supabase);
      const vaga = await abrirVaga("179698");
      const grupo = vaga.querySelector(".avd-eliminados");
      await act(async () => {
        grupo.open = true;
        grupo.dispatchEvent(new Event("toggle"));
      });
      await esperar();
      await clicar(
        vaga.querySelector(
          "[data-candidato='7000009'] [data-acao='marcar-comunicado']",
        ),
      );
      await abrirAba("eliminados");
      expect(
        secao.querySelector("[data-acao='comunicados-marcados']").textContent,
      ).toBe("1 marcado(s)");
    });
  });

  describe("caixa marcar todos no cabeçalho dos eliminados", () => {
    it("na aba Eliminados, marca e desmarca todos do filtro (não só a página)", async () => {
      const supabase = supabaseFalso();
      await montar(supabase);
      await abrirAba("eliminados");
      await digitar(
        secao.querySelector("[data-acao='buscar-espelho-eliminado']"),
        "pessoa 7000009",
      );
      await esperar();
      const todos = () =>
        secao.querySelector(
          "[data-aba-da-triagem='eliminados'] [data-acao='marcar-todos-eliminados']",
        );
      expect(todos().dataset.estado).toBe("nenhuma");
      await clicar(todos());
      await esperar();
      expect(
        chamadasDe(supabase.rpc, "listar_pre_classificacao"),
      ).toContainEqual(
        expect.objectContaining({
          p_vaga: null,
          p_grupo: "ELIMINADOS",
          p_busca: "pessoa 7000009",
          p_limite: 500,
        }),
      );
      expect(
        secao.querySelector("[data-acao='comunicados-marcados']").textContent,
      ).toBe("1 marcado(s)");
      expect(todos().checked).toBe(true);
      await clicar(todos());
      expect(
        secao.querySelector("[data-acao='comunicados-marcados']").textContent,
      ).toBe("0 marcado(s)");
    });

    it("na aba Por vaga, a caixa da vaga marca os eliminados da vaga", async () => {
      const supabase = supabaseFalso();
      await montar(supabase);
      const vaga = await abrirVaga("179698");
      const grupo = vaga.querySelector(".avd-eliminados");
      await act(async () => {
        grupo.open = true;
        grupo.dispatchEvent(new Event("toggle"));
      });
      await esperar();
      await clicar(vaga.querySelector("[data-acao='marcar-todos-eliminados']"));
      await esperar();
      expect(
        chamadasDe(supabase.rpc, "listar_pre_classificacao"),
      ).toContainEqual(
        expect.objectContaining({ p_vaga: "179698", p_grupo: "ELIMINADOS" }),
      );
      await abrirAba("eliminados");
      expect(
        secao.querySelector("[data-acao='comunicados-marcados']").textContent,
      ).toBe("1 marcado(s)");
    });
  });

  describe("menu Ações da Triagem", () => {
    it("só quem coordena tem o menu; Recalcular espera a confirmação e Cancelar não dispara", async () => {
      const supabase = supabaseFalso();
      await montar(supabase);
      await clicar(await itemDoMenu("recalcular"));
      await clicar(botao("Cancelar"));
      expect(chamadasDe(supabase.rpc, "disparar_robo")).toHaveLength(0);
      expect(
        secao.querySelector("[data-acao='confirmar-recalcular']"),
      ).toBeNull();
    });
  });
});

bloco("modulos/avaliacao-documental-relatorio-de-motivos", () => {
  // Antes do react-dom: conta os desenhos de cada componente.

  /*
  Relatório de motivos (gaveta da coordenação): o atalho "Outro motivo por
  critério" pede ao banco Identidade + OUTRO nas concluídas, lê todas as
  páginas, mostra a contagem, a tabela com os textos e os textos agrupados;
  o CSV sai do que foi lido, sem nova chamada.
*/
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  const { regra } = JSON.parse(
    readFileSync(
      "tests/fixtures/avaliacao-documental/ficha-114-2026.json",
      "utf8",
    ),
  );

  const ficha = (codigo, texto) => ({
    id: `f-${codigo}`,
    codigo,
    nome: `Candidato ${codigo}`,
    vaga: "182502",
    cargo: "CARGO 13",
    situacao: "CONCLUIDA",
    resultado: "INAPTO_REQUISITO",
    nota_final: 0,
    avaliador: "Emanuel Serrano",
    concluida_em: "2026-10-16T19:30:22Z",
    blocos: {
      IDENTIDADE: {
        situacao: "NAO_CONFORME",
        motivos: ["ILEGIVEL", "OUTRO"],
        motivo_livre: texto,
      },
    },
  });

  function rpcFalso() {
    return vi.fn(async (_nome, { p_filtros }) =>
      p_filtros.apos
        ? {
            fichas: [ficha("3", "Frente sem verso.")],
            total: null,
            proximo: null,
          }
        : {
            fichas: [
              ficha("1", "Documento não integral."),
              ficha("2", "documento NÃO integral"),
            ],
            total: 3,
            avaliadores: [{ usuario: "u1", nome: "Emanuel Serrano" }],
            proximo: "f-2",
          },
    );
  }

  let raiz = null;
  let lugar = null;
  afterEach(() => {
    act(() => raiz?.unmount());
    lugar?.remove();
    raiz = null;
  });

  async function montar(props) {
    lugar = document.createElement("div");
    document.body.append(lugar);
    raiz = createRoot(lugar);
    await act(async () => {
      raiz.render(
        createElement(RelatorioDeMotivos, {
          editalId: "e114",
          edital: "114/2026",
          regra,
          vagas: [{ codigo: "182502", cargo: "CARGO 13" }],
          aoFechar: () => {},
          agora: () => new Date(2026, 9, 20, 9, 0),
          ...props,
        }),
      );
    });
  }
  const $ = (seletor) => document.querySelector(seletor);

  describe("Relatório de motivos", () => {
    it("o atalho Outro motivo por critério lê todas as páginas e agrupa os textos", async () => {
      const rpc = rpcFalso();
      await montar({ rpc });
      await clicar($("[data-atalho='outro-por-criterio']"));
      await esperar();
      expect(rpc).toHaveBeenCalledTimes(2);
      expect(rpc.mock.calls[0]).toEqual([
        "listar_relatorio_de_motivos",
        {
          p_edital: "e114",
          p_filtros: {
            limite: 500,
            blocos: ["IDENTIDADE"],
            motivo: "OUTRO",
            situacoes_ficha: ["CONCLUIDA"],
          },
        },
      ]);
      expect(rpc.mock.calls[1][1].p_filtros.apos).toBe("f-2");
      expect($("[data-kpi='fichas'] .ui-kpi-valor").textContent).toBe("3");
      expect($("[data-kpi='textos-distintos'] .ui-kpi-valor").textContent).toBe(
        "2",
      );
      // Os textos agrupados, do que mais repete para o que menos.
      const grupos = [...document.querySelectorAll("[data-grupo-quantidade]")];
      expect(grupos.map((g) => g.dataset.grupoQuantidade)).toEqual(["2", "1"]);
      // O critério e o motivo escolhidos ficam nos filtros.
      expect($("[data-filtro='criterio']").value).toBe("IDENTIDADE");
      expect($("[data-filtro='motivo']").value).toBe("OUTRO");
      // A tabela mostra o texto do motivo, não o código.
      const linha = $("tr[data-codigo='1']");
      expect(linha.textContent).toContain("Documento não integral");
      expect(linha.textContent).not.toContain("ILEGIVEL");
      // O filtro de avaliador passa a listar quem concluiu fichas.
      expect(
        [...$("[data-filtro='avaliador']").options].map((o) => o.textContent),
      ).toEqual(["Todos", "Emanuel Serrano"]);
    });

    it("CSV e XLSX saem do que foi lido, sem ir ao banco de novo", async () => {
      const rpc = rpcFalso();
      const baixar = vi.fn();
      await montar({ rpc, baixar });
      expect($("[data-acao='relatorio-csv']")).toBeNull();
      await clicar($("[data-atalho='outro-por-criterio']"));
      await esperar();
      const chamadas = rpc.mock.calls.length;
      await clicar($("[data-acao='relatorio-csv']"));
      await clicar($("[data-acao='relatorio-xlsx']"));
      expect(rpc).toHaveBeenCalledTimes(chamadas);
      const [csv, nome, tipo] = baixar.mock.calls[0];
      expect(nome).toBe(
        "relatorio-de-motivos-114-2026-identidade-2026-10-20.csv",
      );
      expect(tipo).toContain("text/csv");
      expect(csv.startsWith("\uFEFFCódigo;")).toBe(true);
      expect(csv.trimEnd().split("\r\n")).toHaveLength(4);
      expect(baixar.mock.calls[1][1]).toBe(
        "relatorio-de-motivos-114-2026-identidade-2026-10-20.xlsx",
      );
    });

    it("filtros manuais: o critério troca a lista de motivos e Gerar relatório pede ao banco", async () => {
      const rpc = vi.fn(async () => ({ fichas: [], total: 0, proximo: null }));
      await montar({ rpc });
      await escolher($("[data-filtro='criterio']"), "CURSOS");
      const motivos = [...$("[data-filtro='motivo']").options].map(
        (o) => o.value,
      );
      expect(motivos).toContain("CAPACITACAO_UMCQA");
      expect(motivos).not.toContain("ILEGIVEL");
      expect(motivos.at(-1)).toBe("OUTRO");
      await escolher($("[data-filtro='resultado']"), "APTO");
      await clicar($("[data-acao='gerar-relatorio']"));
      await esperar();
      expect(rpc.mock.calls[0][1].p_filtros).toEqual({
        limite: 500,
        blocos: ["CURSOS"],
        resultados: ["APTO"],
        situacoes_ficha: ["CONCLUIDA"],
      });
      expect(document.body.textContent).toContain(
        "Nenhuma ficha com estes filtros.",
      );
    });

    it("erro do banco (quem não coordena) aparece como alerta", async () => {
      const rpc = vi.fn(async () => {
        throw new Error(
          "Só o administrador e a coordenação do edital tiram o relatório de motivos",
        );
      });
      await montar({ rpc });
      await clicar($("[data-acao='gerar-relatorio']"));
      await esperar();
      expect($("[role='alert']").textContent).toContain(
        "Só o administrador e a coordenação do edital",
      );
    });

    it("trocar filtros não redesenha a tabela nem o resultado, e não vai ao banco", async () => {
      // 120 fichas: a tabela mostra 50 de cada vez.
      const fichas = Array.from({ length: 120 }, (_, i) =>
        ficha(String(i + 1), `Texto ${i % 4}.`),
      );
      const rpc = vi.fn(async () => ({ fichas, total: 120, proximo: null }));
      await montar({ rpc });
      await clicar($("[data-atalho='outro-por-criterio']"));
      await esperar();
      expect(document.querySelectorAll("tr[data-codigo]")).toHaveLength(50);
      renders.zerar();
      await escolher($("[data-filtro='resultado']"), "APTO");
      await escolher($("[data-filtro='vaga']"), "182502");
      await escolher($("[data-filtro='situacao']"), "NAO_CONFORME");
      await clicar($("[data-filtro='ajustada']"));
      // Só o painel de filtros redesenha; linhas, tabela e contagem ficam.
      expect(renders.de("PainelDeFiltros")).toBe(4);
      expect(renders.de("LinhaDaFicha")).toBe(0);
      expect(renders.de("TabelaInfinita")).toBe(0);
      expect(renders.de("RelatorioDeMotivos")).toBe(0);
      expect(rpc).toHaveBeenCalledTimes(1);
      expect($("[data-filtro='resultado']").value).toBe("APTO");
      expect($("[data-filtro='ajustada']").checked).toBe(true);
      // O próximo Gerar relatório leva os filtros escolhidos.
      await clicar($("[data-acao='gerar-relatorio']"));
      await esperar();
      expect(rpc.mock.calls[1][1].p_filtros).toMatchObject({
        blocos: ["IDENTIDADE"],
        resultados: ["APTO"],
        vagas: ["182502"],
        ajustada: true,
      });
    });

    it("a busca da tabela recorta as linhas; agrupar não redesenha as linhas", async () => {
      const rpc = rpcFalso();
      await montar({ rpc });
      await clicar($("[data-atalho='outro-por-criterio']"));
      await esperar();
      renders.zerar();
      await clicar($("[data-filtro='agrupar']"));
      expect(document.querySelectorAll("[data-grupo-quantidade]")).toHaveLength(
        0,
      );
      expect(renders.de("LinhaDaFicha")).toBe(0);
      await digitar($("input[type='search']"), "frente");
      expect(
        [...document.querySelectorAll("tr[data-codigo]")].map(
          (tr) => tr.dataset.codigo,
        ),
      ).toEqual(["3"]);
      expect(rpc).toHaveBeenCalledTimes(2);
    });
  });
});

bloco("modulos/avaliacao-documental", () => {
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

  function supabaseFalso({
    comRegra = true,
    pode = true,
    salvarEquipe,
    previa,
  } = {}) {
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
      previa_importacao_da_planilha: () => previa ?? null,
      importar_avaliacao_da_planilha: () => ({
        origem: "MONITORA",
        anterior: "PLANILHA",
        mudou: true,
        publicadas: 97,
        devolvidas: 0,
        importadas: 94,
        fora_do_lote: 2,
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
      painel = montarTela(
        criarAvaliacaoDocumental,
        "page-avaliacao-documental",
        {
          supabase,
          toast,
        },
      );
    });
    await act(async () => void painel.render());
    await esperar();
    await escolher(secao.querySelector(".avd-edital select"), "e93");
    await esperar();
    act(() => painel.estado.mudarVisao("regra"));
    await esperar();
  }
  /*
  O editor da regra mora nas Regras do edital (Editais) desde 03/11/2026: os
  casos do editor montam a página na etapa 2; a tela da Avaliação mostra só
  o resumo, com "Editar nas Regras do edital".
*/
  let lojas;
  async function montarRegra(supabase) {
    const montado = await montarRegrasDoEdital({
      supabase,
      editalId: "e93",
      etapa: "avaliacao",
      toast,
    });
    secao = montado.secao;
    painel = montado;
    lojas = montado.lojas;
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
    // (tests/casca-sessao-e-interface-na-tela.test.js (bloco modulos/avaliacao-documental-assistente)).
    beforeEach(() => localStorage.setItem("avd-regra-modo", "avancado"));
    afterEach(() => localStorage.removeItem("avd-regra-modo"));
    it("AM-2.1: edital sem regra cria a versão 1 a partir do modelo", async () => {
      const supabase = supabaseFalso({ comRegra: false });
      await montarRegra(supabase);
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
      await montarRegra(supabase);
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
      const motivo = [
        ...secao.querySelectorAll(".ui-barra-de-salvar input"),
      ][0];
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
      await montarRegra(supabase);
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
      await montarRegra(supabase);
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
      // A releitura do edital (a mesma do "Atualizar" da tela) fica no ar.
      act(() => void lojas.avaliacao.escolherEdital("e93"));
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
      expect(
        secao.querySelector("[data-acao='conferir-regra']"),
      ).not.toBeNull();
      expect(
        secao.querySelector("[data-acao='salvar-regra']").textContent,
      ).toContain("versão 3");
    }, 20000);

    it("AM-2.4: liga uma pergunta da carga a um bloco", async () => {
      await montarRegra(supabaseFalso());
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

    it("AM-2.7: a prévia calcula a nota, a situação e o parecer sem gravar", async () => {
      const supabase = supabaseFalso();
      await montarRegra(supabase);
      const previa = secao.querySelector(".avd-previa");
      await clicar(botao("Abrir", previa));
      // O corpo da prévia carrega ao abrir (lazy).
      await esperar(
        () => import("../src/modulos/avaliacao-documental/corpo-da-previa.tsx"),
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

    it("a tela mostra a regra resumida e leva às Regras do edital", async () => {
      await montar(supabaseFalso());
      // O resumo baixa as regras por import() (fora do pacote de entrada).
      await act(async () => {
        await import("../src/lib/regras-do-edital/regras-do-edital-resumos.ts");
      });
      const resumo = secao.querySelector("[data-tour='avd-regra-resumo']");
      expect(resumo.textContent).toContain("Regra da Avaliação documental");
      expect(resumo.textContent).toContain("Nota mínima");
      expect(secao.querySelector(".avd-campos")).toBeNull();
      window.navigate = vi.fn();
      // As Regras do edital são rota de Editais (src/app/navegacao.ts).
      try {
        await clicar(
          resumo.querySelector("[data-acao='editar-nas-regras-do-edital']"),
        );
        expect(window.navigate).toHaveBeenCalledWith("nucleo", {
          edital: "e93",
          regras: "avaliacao",
        });
      } finally {
        delete window.navigate;
        registrarTelas({});
      }
    });

    it("o editor não tem mais Provisória nem Lote (são da regra da Triagem)", async () => {
      await montarRegra(supabaseFalso());
      expect(secao.querySelector(".avd-campos")).not.toBeNull();
      expect(secao.querySelector("#avdProvisoria")).toBeNull();
      expect(secao.querySelector("#avdLote")).toBeNull();
    });

    it("quem não coordena não vê a regra, sem salvar nem perguntas", async () => {
      const supabase = supabaseFalso({ pode: false });
      await montar(supabase);
      expect(botao("Regra", secao)).toBeUndefined();
      expect(secao.querySelector(".avd-campos")).toBeNull();
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
      await montarRegra(supabase);
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
      await escolher(
        secao.querySelector("[data-linha-equipe='0'] select"),
        U(2),
      );
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

    it("AM-3.3: a coordenação vê quem aparece em Pessoa e como incluir outra", async () => {
      await abrirEquipe(supabaseFalso());
      const ajuda = secao.querySelector("[data-quem-entra]");
      expect(ajuda.textContent).toContain(
        "Em “Pessoa” aparecem 2 pessoas: quem tem a área Projetos e Editor (ou mais) em Avaliação documental.",
      );
      expect(ajuda.textContent).toContain("Configurações › Acessos");
    });

    it("AM-3.4: sem coordenar, nem a aba Equipe nem a orientação aparecem", async () => {
      await montar(supabaseFalso({ pode: false }));
      expect(botao("Equipe", secao)).toBeUndefined();
      expect(secao.querySelector("[data-quem-entra]")).toBeNull();
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
      await escolher(
        secao.querySelector("[data-linha-equipe='0'] select"),
        U(2),
      );
      await clicar(secao.querySelector("[data-acao='salvar-equipe']"));
      await esperar();
      expect(secao.textContent).toContain(
        "não tem Editor em Avaliação documental (tem Leitor)",
      );
    });
  });

  describe("dono da avaliação do edital (20261009200000)", () => {
    it("a coordenação passa o edital para o Yeendé com confirmação e motivo", async () => {
      const supabase = supabaseFalso();
      await montar(supabase);
      const rotulo = secao.querySelector("[data-origem]");
      expect(rotulo.textContent).toContain("Avaliação: Planilha");
      await clicar(
        secao.querySelector("[data-acao='trocar-origem-da-analise']"),
      );
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
        "Avaliação: Yeendé",
      );
      expect(botao("Voltar para a planilha", secao)).toBeTruthy();
      expect(document.querySelector(".modal")).toBeNull();
      // Quem coordena vê a origem e a troca só em Configurações (não na faixa do edital).
      act(() => painel.estado.mudarVisao("fila"));
      await esperar();
      expect(secao.querySelector("[data-origem]")).toBeNull();
      expect(botao("Voltar para a planilha", secao)).toBeUndefined();
    });

    it("edital decidido pela planilha: a janela mostra a prévia e importa (F8, 16/11/2026)", async () => {
      const supabase = supabaseFalso({
        previa: {
          aprovados: 60,
          reprovados: 34,
          em_aberto: 0,
          saem_do_lote: 2,
          analista_sem_cadastro: 0,
          problemas: {},
          origem: "PLANILHA",
        },
      });
      await montar(supabase);
      await clicar(
        secao.querySelector("[data-acao='trocar-origem-da-analise']"),
      );
      await esperar();
      expect(supabase.rpc).toHaveBeenCalledWith(
        "previa_importacao_da_planilha",
        {
          p_edital: "e93",
        },
      );
      const previa = document.querySelector("[data-importacao='previa']");
      expect(previa.textContent).toContain(
        "60 aprovados e 34 reprovados viram fichas concluídas",
      );
      expect(previa.textContent).toContain(
        "2 fichas sem análise na planilha saem do lote",
      );
      const confirmar = document.querySelector(
        "[data-acao='confirmar-origem-da-analise']",
      );
      expect(confirmar.textContent).toBe("Importar e passar para o Yeendé");
      await digitar(
        document.querySelector(".modal textarea"),
        "Planilhas de Projetos aposentadas",
      );
      await clicar(confirmar);
      await esperar();
      expect(supabase.rpc).toHaveBeenCalledWith(
        "importar_avaliacao_da_planilha",
        {
          p_edital: "e93",
          p_motivo: "Planilhas de Projetos aposentadas",
        },
      );
      expect(supabase.rpc).not.toHaveBeenCalledWith(
        "definir_origem_analise",
        expect.anything(),
      );
      expect(secao.querySelector("[data-origem]").textContent).toContain(
        "Avaliação: Yeendé",
      );
      expect(toast).toHaveBeenCalledWith(
        "94 análises importadas da planilha. A avaliação deste edital passa a ser feita no Yeendé.",
        "success",
      );
    });

    it("com problema na prévia, a importação fica travada e diz o que resolver", async () => {
      await montar(
        supabaseFalso({
          previa: {
            aprovados: 10,
            reprovados: 0,
            problemas: { EM_REVISAO: 1, SEM_INSCRITO: 2 },
          },
        }),
      );
      await clicar(
        secao.querySelector("[data-acao='trocar-origem-da-analise']"),
      );
      await esperar();
      await digitar(
        document.querySelector(".modal textarea"),
        "Planilhas de Projetos aposentadas",
      );
      expect(document.body.textContent).toContain(
        "1 análise em revisão na planilha (termine a revisão lá)",
      );
      expect(document.body.textContent).toContain(
        "2 análises da planilha sem inscrito no Yeendé",
      );
      expect(
        document.querySelector("[data-acao='confirmar-origem-da-analise']")
          .disabled,
      ).toBe(true);
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
});

bloco("modulos/recursos-montar-parecer", () => {
  /*
  "Montar parecer" na gaveta do recurso (protótipo): desligado por padrão; com
  a chave, abre a montagem por cima da gaveta (o Esc fecha só ela), com a
  prévia igual ao texto de comporParecer, que muda quando o formulário muda.
*/

  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  let raiz = null;

  async function montar(elemento) {
    document.body.innerHTML = `<div id="raiz"></div>`;
    await act(async () => {
      raiz = createRoot(document.getElementById("raiz"));
      raiz.render(elemento);
    });
  }

  afterEach(async () => {
    await act(async () => raiz?.unmount());
    raiz = null;
    document.body.innerHTML = "";
    localStorage.removeItem(CHAVE_DO_PROTOTIPO);
  });

  const recurso = { id: "r-1", nu: 1, candidato: "Maria Fictícia da Silva" };

  describe("Montar parecer na gaveta", () => {
    it("fica escondido sem a chave do protótipo", async () => {
      await montar(h(SecaoMontarParecer, { recurso }));
      expect(document.querySelector('[data-acao="montar-parecer"]')).toBeNull();
    });

    it("abre por cima da gaveta; o Esc fecha só a montagem", async () => {
      localStorage.setItem(CHAVE_DO_PROTOTIPO, "1");
      const fecharGaveta = vi.fn();
      await montar(
        h(
          Gaveta,
          {
            titulo: "Recurso",
            aoFechar: fecharGaveta,
            rotuloDoFechar: "Fechar",
          },
          h(SecaoMontarParecer, { recurso }),
        ),
      );
      await clicar(document.querySelector('[data-acao="montar-parecer"]'));
      // O módulo da montagem chega por import() e os dados, por promessa.
      for (
        let i = 0;
        i < 20 && !document.querySelector(".parecer-documento");
        i++
      )
        await esperar(() => new Promise((r) => setTimeout(r, 20)));
      expect(document.querySelector(".parecer-documento")).not.toBeNull();
      expect(document.querySelectorAll(".modal")).toHaveLength(2);

      await teclar(document, "Escape");
      expect(document.querySelector(".parecer-documento")).toBeNull();
      expect(fecharGaveta).not.toHaveBeenCalled();
      await teclar(document, "Escape");
      expect(fecharGaveta).toHaveBeenCalledTimes(1);
    });
  });

  describe("o editor", () => {
    it("a prévia é o texto de comporParecer e acompanha o formulário", async () => {
      await montar(
        h(EditorDoParecer, { fonte: dadosFicticios, recursoId: "ficticio-1" }),
      );
      await esperar(() => new Promise((r) => setTimeout(r, 0)));
      const { rascunho } = rascunhoInicial(
        await dadosFicticios.carregar("ficticio-1"),
      );
      const previa = () =>
        linhasVisiveis(document.querySelector(".parecer-documento"));
      expect(previa()).toEqual(linhasDeTexto(comporParecer(rascunho)));
      // De onde veio: o selo "da ficha" na experiência.
      expect(
        document.querySelector(
          '[data-tour="parecer-bloco-experiencia"] .parecer-fonte',
        ).textContent,
      ).toBe("da ficha");

      await digitar(
        document.querySelector('[aria-label="2. Relatório"] textarea'),
        "o prazo foi cumprido",
      );
      expect(previa().join("\n")).toContain(
        "alega, em síntese, que : o prazo foi cumprido.",
      );

      const intempestivo = [
        ...document.querySelectorAll('[role="radio"]'),
      ].find((b) => b.textContent === "Intempestivo");
      await clicar(intempestivo);
      expect(previa().join("\n")).toContain("NÃO CONHECIMENTO");
      expect(previa().join("\n")).not.toContain("4. ANÁLISE DE MÉRITO");
    });

    it("tirar um bloco tira o texto dele; o chip põe de volta", async () => {
      await montar(
        h(EditorDoParecer, { fonte: dadosFicticios, recursoId: "ficticio-1" }),
      );
      await esperar(() => new Promise((r) => setTimeout(r, 0)));
      const texto = () =>
        document.querySelector(".parecer-documento").textContent;
      expect(texto()).toContain("Avaliação Biopsicossocial");
      const cartao = document.querySelector('[data-tour="parecer-bloco-pcd"]');
      await clicar(
        [...cartao.querySelectorAll("button")].find((b) =>
          b.textContent.includes("Tirar"),
        ),
      );
      expect(texto()).not.toContain("Avaliação Biopsicossocial");
      const chip = [
        ...document.querySelectorAll(".parecer-fora .ui-chip"),
      ].find((b) => b.textContent.includes("PcD"));
      await clicar(chip);
      expect(
        document.querySelector('[data-tour="parecer-bloco-pcd"]'),
      ).not.toBeNull();
    });
  });
});

bloco("ritmo-da-analise", () => {
  /* O cronograma real do 114/2026 (resumido nas etapas que importam). */
  const CRONOGRAMA_114 = [
    {
      ordem: 3,
      atividade: "Período de Inscrições",
      tipo: null,
      inicio: "2026-10-05",
      fim: "2026-10-14",
    },
    {
      ordem: 4,
      atividade:
        "Validação das inscrições, por meio da verificação da documentação obrigatória / Análise do processo de Heteroidentificação",
      tipo: null,
      inicio: "2026-10-15",
      fim: "2026-10-22",
    },
    {
      ordem: 5,
      atividade:
        "Divulgação do resultado preliminar da validação da documentação obrigatória e da heteroidentificação e abertura do prazo para interposição de recurso",
      tipo: null,
      inicio: "2026-10-26",
      fim: "2026-10-26",
    },
    {
      ordem: 7,
      atividade:
        "Envio do espelho da análise de títulos e experiência profissional",
      tipo: null,
      inicio: "2026-10-28",
      fim: "2026-10-30",
    },
    {
      ordem: 8,
      atividade: "Submissão de recursos relativos à análise documental",
      tipo: null,
      inicio: "2026-11-03",
      fim: "2026-11-04",
    },
  ];

  const edital = (mudancas = {}) => ({
    id: "bcecfb08",
    edital: "114/2026",
    situacoes: {
      pendente: 1086,
      em_analise: 12,
      revisar: 0,
      concluida: 414,
      fora_lote: 448,
    },
    porDia: [
      { dia: "2026-10-16", qt: 266 },
      { dia: "2026-10-19", qt: 148 },
    ],
    qtEquipe: 9,
    qtAvaliadoresRecentes: 7,
    cronograma: CRONOGRAMA_114,
    ...mudancas,
  });

  const SEGUNDA_MEIO_DIA = { hoje: "2026-10-19", hora: 12 };

  describe("dias úteis", () => {
    it("segunda a sexta, sem fim de semana nem feriado nacional fixo", () => {
      expect(ehDiaUtil("2026-10-16")).toBe(true); // sexta
      expect(ehDiaUtil("2026-10-17")).toBe(false); // sábado
      expect(ehDiaUtil("2026-10-18")).toBe(false); // domingo
      expect(ehDiaUtil("2026-10-12")).toBe(false); // feriado (segunda)
      expect(ehDiaUtil("2026-11-02")).toBe(false); // Finados
    });

    it("Páscoa pelo calendário gregoriano", () => {
      expect(domingoDePascoa(2024)).toBe("2024-03-31");
      expect(domingoDePascoa(2025)).toBe("2025-04-20");
      expect(domingoDePascoa(2026)).toBe("2026-04-05");
      expect(domingoDePascoa(2027)).toBe("2027-03-28");
      expect(domingoDePascoa(2038)).toBe("2038-04-25"); // a mais tardia possível
      expect(domingoDePascoa(2285)).toBe("2285-03-22"); // a mais cedo possível
    });

    it("Sexta-feira Santa não é dia útil; carnaval e Corpus Christi são", () => {
      expect(ehDiaUtil("2026-04-03")).toBe(false); // Sexta-feira Santa
      expect(ehDiaUtil("2027-03-26")).toBe(false);
      expect(ehDiaUtil("2026-04-02")).toBe(true); // quinta antes
      expect(ehDiaUtil("2026-02-16")).toBe(true); // segunda de carnaval
      expect(ehDiaUtil("2026-06-04")).toBe(true); // Corpus Christi
      // A semana da Páscoa de 2026 tem 4 dias úteis (30/03 a 03/04).
      expect(
        diasUteisAtePrazo({ hoje: "2026-03-30", hora: 9 }, "2026-04-03"),
      ).toBe(4);
    });

    it("hoje conta até o fim do expediente (18h)", () => {
      expect(diasUteisAtePrazo(SEGUNDA_MEIO_DIA, "2026-10-22")).toBe(4);
      expect(
        diasUteisAtePrazo({ hoje: "2026-10-19", hora: 18 }, "2026-10-22"),
      ).toBe(3);
    });

    it("no fim de semana, começa na segunda", () => {
      expect(
        diasUteisAtePrazo({ hoje: "2026-10-17", hora: 10 }, "2026-10-22"),
      ).toBe(4);
      expect(diaUtilDepois("2026-10-16", 1)).toBe("2026-10-19");
    });

    it("hoje e hora em Brasília", () => {
      expect(agoraEmBrasilia(new Date("2026-10-19T15:00:00Z"))).toEqual({
        ...SEGUNDA_MEIO_DIA,
        minuto: 0,
      });
      expect(agoraEmBrasilia(new Date("2026-10-20T02:30:00Z"))).toEqual({
        hoje: "2026-10-19",
        hora: 23,
        minuto: 30,
      });
    });
  });

  describe("etapa da análise no cronograma", () => {
    it("acha a validação da documentação do 114, não a divulgação nem os recursos", () => {
      expect(etapaDaAnalise(CRONOGRAMA_114, "2026-10-19")?.ordem).toBe(4);
      expect(nomeCurtoDaEtapa(CRONOGRAMA_114[1].atividade)).toBe(
        "Validação da documentação",
      );
    });

    it("com o prazo passado, fica a última que casou", () => {
      expect(etapaDaAnalise(CRONOGRAMA_114, "2026-10-27")?.ordem).toBe(4);
    });

    it("análise curricular e o tipo da atividade, quando houver", () => {
      const cronograma = [
        {
          ordem: 1,
          atividade: "Período de Análise Curricular",
          tipo: null,
          inicio: "2026-09-30",
          fim: "2026-10-08",
        },
        {
          ordem: 2,
          atividade: "Resultado preliminar da análise curricular",
          tipo: null,
          inicio: "2026-10-09",
          fim: "2026-10-09",
        },
        {
          ordem: 3,
          atividade: "Etapa X",
          tipo: "analise_documental",
          inicio: "2026-10-10",
          fim: "2026-10-20",
        },
      ];
      expect(etapaDaAnalise(cronograma.slice(0, 2), "2026-10-01")?.ordem).toBe(
        1,
      );
      expect(etapaDaAnalise(cronograma, "2026-10-01")?.ordem).toBe(3);
    });

    it("sem cronograma ou sem etapa que case: nada", () => {
      expect(etapaDaAnalise([], "2026-10-19")).toBeNull();
      expect(etapaDaAnalise([CRONOGRAMA_114[0]], "2026-10-19")).toBeNull();
    });
  });

  describe("calcularRitmo", () => {
    it("o 114 em 19/10 ao meio-dia: ≈275 por dia, ≈31 por avaliador, um dia útil depois do prazo", () => {
      const r = calcularRitmo(edital(), SEGUNDA_MEIO_DIA);
      expect(r).toMatchObject({
        faltam: 1098,
        concluidas: 414,
        percentual: 27,
        diasRestantes: 4,
        porDia: 275,
        avaliadores: 9,
        avaliadoresDaEquipe: true,
        porAvaliador: 31,
        ritmo: 266,
        diasDoRitmo: 1,
        concluidasHoje: 148,
        termino: "2026-10-23",
        diasDeAtraso: 1,
        situacao: "abaixo",
      });
      expect(textoDoPrazo(r)).toBe("Prazo: 22/10 · Validação da documentação");
    });

    it("ritmo suficiente: no ritmo, antes do prazo", () => {
      const r = calcularRitmo(
        edital({
          porDia: [
            { dia: "2026-10-15", qt: 380 },
            { dia: "2026-10-16", qt: 400 },
          ],
        }),
        SEGUNDA_MEIO_DIA,
      );
      expect(r.ritmo).toBe(390);
      expect(r.situacao).toBe("no-ritmo");
    });

    it("média dos últimos 3 dias com análise; hoje entra depois do expediente", () => {
      const porDia = [
        { dia: "2026-10-13", qt: 10 },
        { dia: "2026-10-14", qt: 100 },
        { dia: "2026-10-15", qt: 200 },
        { dia: "2026-10-16", qt: 300 },
        { dia: "2026-10-19", qt: 400 },
      ];
      expect(calcularRitmo(edital({ porDia }), SEGUNDA_MEIO_DIA).ritmo).toBe(
        200,
      );
      expect(
        calcularRitmo(edital({ porDia }), { hoje: "2026-10-19", hora: 19 })
          .ritmo,
      ).toBe(300);
    });

    it("prazo passado: vencido, sem necessárias por dia", () => {
      const r = calcularRitmo(edital(), { hoje: "2026-10-26", hora: 9 });
      expect(r.situacao).toBe("vencido");
      expect(r.porDia).toBeNull();
      expect(r.porAvaliador).toBeNull();
    });

    it("concluído", () => {
      const r = calcularRitmo(
        edital({
          situacoes: {
            pendente: 0,
            em_analise: 0,
            revisar: 0,
            concluida: 1500,
            fora_lote: 448,
          },
        }),
        SEGUNDA_MEIO_DIA,
      );
      expect(r).toMatchObject({
        situacao: "concluido",
        percentual: 100,
        faltam: 0,
        porDia: null,
        termino: null,
      });
    });

    it("sem cronograma: sem prazo e sem inventar data", () => {
      const r = calcularRitmo(edital({ cronograma: [] }), SEGUNDA_MEIO_DIA);
      expect(r).toMatchObject({
        situacao: "sem-prazo",
        etapa: null,
        porDia: null,
      });
      expect(textoDoPrazo(r)).toBe("Sem etapa de análise no cronograma");
    });

    it("sem histórico: sem ritmo e sem projeção", () => {
      const r = calcularRitmo(
        edital({ porDia: [{ dia: "2026-10-19", qt: 20 }] }),
        SEGUNDA_MEIO_DIA,
      );
      expect(r).toMatchObject({
        situacao: "sem-historico",
        ritmo: null,
        termino: null,
        porDia: 275,
      });
    });

    it("por avaliador: a equipe; sem equipe, quem concluiu nos últimos 7 dias; sem ninguém, nada", () => {
      expect(
        calcularRitmo(edital({ qtEquipe: 0 }), SEGUNDA_MEIO_DIA),
      ).toMatchObject({
        avaliadores: 7,
        avaliadoresDaEquipe: false,
        porAvaliador: 40,
      });
      expect(
        calcularRitmo(
          edital({ qtEquipe: 0, qtAvaliadoresRecentes: 0 }),
          SEGUNDA_MEIO_DIA,
        ).porAvaliador,
      ).toBeNull();
    });
  });

  describe("leitura e editais do card", () => {
    it("lê o retrato da RPC e descarta o malformado", () => {
      const [e] = lerRitmoDaAnalise([
        {
          editais: [
            {
              id: "x",
              edital: "114/2026",
              situacoes: { pendente: "3", concluida: 2 },
              por_dia: [
                { dia: "2026-10-16", qt: 2 },
                { dia: "lixo", qt: 1 },
              ],
              qt_equipe: 2,
              cronograma: [
                {
                  ordem: 1,
                  atividade: "Análise curricular",
                  fim: "2026-10-22",
                },
              ],
            },
            { edital: "sem id" },
          ],
        },
      ]);
      expect(e).toMatchObject({
        id: "x",
        situacoes: { pendente: 3, em_analise: 0, concluida: 2 },
        qtEquipe: 2,
      });
      expect(e.porDia).toEqual([{ dia: "2026-10-16", qt: 2 }]);
      expect(lerRitmoDaAnalise(null)).toEqual([]);
      expect(lerRitmoDaAnalise({ editais: "x" })).toEqual([]);
    });

    it("edital sem nenhuma concluída e com o prazo vencido sai (análise feita fora do sistema)", () => {
      const fora = edital({
        id: "93",
        situacoes: {
          pendente: 93,
          em_analise: 3,
          revisar: 0,
          concluida: 0,
          fora_lote: 1,
        },
        porDia: [],
        cronograma: [
          {
            ordem: 4,
            atividade: "Período de Análise Curricular",
            tipo: null,
            inicio: "2026-09-30",
            fim: "2026-10-08",
          },
        ],
      });
      expect(
        ritmosDaArea([edital(), fora], SEGUNDA_MEIO_DIA).map((r) => r.id),
      ).toEqual(["bcecfb08"]);
    });
  });

  /*
  O bloco "Hoje" (pedido de 19/10/2026): a meta do dia e um selo que oscila ao
  longo do expediente (08:00–18:00, Brasília).
*/
  describe("o dia: meta, feito e o selo que oscila", () => {
    const PRAZO = "2026-10-22"; // segunda 19 → 19, 20, 21 e 22: 4 dias úteis
    const dia = (faltam, feito, agora, prazo = PRAZO) =>
      ritmoDoDia({ faltam, feito, prazo, avaliadores: 9 }, agora);

    it("a fração do expediente: 0 antes das 8h, metade às 13h, 1 depois das 18h", () => {
      expect(fracaoDoExpediente({ hoje: "2026-10-19", hora: 7 })).toBe(0);
      expect(fracaoDoExpediente({ hoje: "2026-10-19", hora: 13 })).toBe(0.5);
      expect(
        fracaoDoExpediente({ hoje: "2026-10-19", hora: 12, minuto: 30 }),
      ).toBeCloseTo(0.45);
      expect(fracaoDoExpediente({ hoje: "2026-10-19", hora: 19 })).toBe(1);
    });

    it("antes das 8h: meta inteira pela frente, esperado 0, no ritmo", () => {
      expect(dia(1000, 0, { hoje: "2026-10-19", hora: 7 })).toEqual({
        situacao: "no-ritmo",
        meta: 250,
        feito: 0,
        faltam: 250,
        porAvaliador: 28,
        esperado: 0,
        excedente: 0,
      });
    });

    it("no meio do expediente, o selo depende do esperado para a hora", () => {
      const meio = { hoje: "2026-10-19", hora: 13 };
      // A meta é a do começo do dia: (faltam + feito) ÷ 4 = 250, feito o que for.
      expect(dia(900, 100, meio)).toMatchObject({
        meta: 250,
        esperado: 125,
        faltam: 150,
        situacao: "abaixo",
      });
      expect(dia(870, 130, meio)).toMatchObject({
        meta: 250,
        situacao: "no-ritmo",
        porAvaliador: 14,
      });
    });

    it("depois das 18h, o esperado é a meta", () => {
      expect(dia(800, 200, { hoje: "2026-10-19", hora: 19 })).toMatchObject({
        esperado: 250,
        situacao: "abaixo",
        faltam: 50,
      });
    });

    it("meta batida: faltam 0, com o excedente", () => {
      expect(dia(740, 260, { hoje: "2026-10-19", hora: 15 })).toMatchObject({
        situacao: "batida",
        faltam: 0,
        excedente: 10,
        porAvaliador: null,
      });
    });

    it("fim de semana e feriado não são dia útil; sem prazo, sem meta", () => {
      expect(dia(1000, 0, { hoje: "2026-10-17", hora: 10 }).situacao).toBe(
        "nao-util",
      );
      expect(
        dia(1000, 0, { hoje: "2026-11-02", hora: 10 }, "2026-11-30").situacao,
      ).toBe("nao-util");
      expect(dia(1000, 0, SEGUNDA_MEIO_DIA, null).situacao).toBe("sem-meta");
    });

    it("prazo vencido: tudo é a meta de hoje", () => {
      expect(dia(300, 20, SEGUNDA_MEIO_DIA, "2026-10-16").meta).toBe(320);
    });

    it("o card: o selo principal é o do dia; recolhido, 'hoje X de Y'", () => {
      const r = calcularRitmo(edital(), { hoje: "2026-10-19", hora: 13 });
      // (1.098 + 148 feitas hoje) ÷ 4 = 311,5 → 312; esperado às 13h: 156.
      expect(r.dia).toMatchObject({ meta: 312, feito: 148, esperado: 156 });
      expect(seloDoCard(r)).toEqual({
        rotulo: "Abaixo do ritmo hoje",
        situacao: "abaixo",
      });
      expect(textoRecolhido(r)).toBe("hoje 148 de 312");
      expect(textoDoDia(r)).toBe(
        "≈19 por avaliador até o fim do expediente (9 avaliadores) · esperado até agora: 156",
      );
      expect(textoDeReferencia(r)).toMatch(
        /^Média dos últimos dias ≈\d+\/dia · termina por volta de \d{2}\/\d{2}/,
      );
      const sabado = calcularRitmo(edital(), { hoje: "2026-10-17", hora: 10 });
      expect(seloDoCard(sabado).rotulo).toBe("Hoje não é dia útil");
      expect(textoRecolhido(sabado)).toBe("faltam 1.098");
      // Tudo concluído: o selo "Concluído" já diz; o texto não o repete.
      const pronto = calcularRitmo(
        edital({
          situacoes: {
            pendente: 0,
            em_analise: 0,
            revisar: 0,
            concluida: 1500,
            fora_lote: 0,
          },
        }),
        { hoje: "2026-10-19", hora: 13 },
      );
      expect(seloDoCard(pronto).rotulo).toBe("Concluído");
      expect(textoRecolhido(pronto)).toBe("");
    });
  });

  describe("as contagens do resumo do Painel", () => {
    const linha = (status, mudancas = {}) => ({
      edital: "114/2026",
      status_consolidado: status,
      ...mudancas,
    });

    it("faltam = Pendente + Em análise + Revisar; concluídas = Aprovado + Reprovado; hoje pela data", () => {
      const linhas = [
        linha("Pendente"),
        linha("Pendente"),
        linha("Em análise"),
        linha("Revisar", { data_analise: "19/10/2026" }),
        linha("Aprovado", { data_analise: "19/10/2026" }),
        linha("Reprovado", { data_analise: "2026-10-19" }),
        linha("Aprovado", { data_analise: "16/10/2026" }),
        // Outro edital não entra; o mesmo número com zero à esquerda, sim.
        linha("Pendente", { edital: "93/2026" }),
        linha("Pendente", { edital: "Edital 0114/2026 (Projetos)" }),
      ];
      const [e] = noMomentoDoResumo([edital()], linhas, "2026-10-19");
      expect(e.situacoes).toEqual({
        pendente: 3,
        em_analise: 1,
        revisar: 1,
        concluida: 3,
        fora_lote: 448,
      });
      // Hoje: as do resumo (2), não as ao vivo (148); os dias anteriores ficam.
      expect(e.porDia).toEqual([
        { dia: "2026-10-16", qt: 266 },
        { dia: "2026-10-19", qt: 2 },
      ]);
    });

    it("em Todos, só as linhas do pacote Ativo contam (Inativo e desativadas ficam fora)", () => {
      const linha = (status_consolidado, __escopo) => ({
        edital: "114/2026",
        status_consolidado,
        __escopo,
      });
      const [e] = noMomentoDoResumo(
        [edital()],
        [
          linha("Pendente", "ativo"),
          linha("Aprovado", "ativo"),
          linha("Pendente", "desativadas"),
          linha("Pendente", "inativo"),
          // Linha sem a marca (payload antigo): conta, como antes.
          linha("Pendente", undefined),
        ],
        "2026-10-19",
      );
      expect(e.situacoes.pendente).toBe(2);
      expect(e.situacoes.concluida).toBe(1);
    });

    it("edital sem linha no resumo sai", () => {
      expect(noMomentoDoResumo([edital()], [], "2026-10-19")).toEqual([]);
      expect(noMomentoDoResumo([edital()], null, "2026-10-19")).toEqual([]);
    });

    it("o momento é o do 'Conferido às' do topo", () => {
      const agora = new Date("2026-10-19T15:00:00Z");
      expect(textoDoMomento("114/2026", "2026-10-19T14:20:00Z", agora)).toBe(
        "Conferido às 11:20 · só o 114/2026",
      );
      expect(textoDoMomento("114/2026", null, agora)).toBe("Só o 114/2026");
    });
  });

  describe("recolher o card: escolha de cada pessoa", () => {
    afterEach(() => localStorage.clear());

    it("recolhido por padrão; aberto fica guardado só para quem abriu", () => {
      expect(lerRitmoRecolhido("u1")).toBe(true);
      gravarRitmoRecolhido("u1", false);
      expect(lerRitmoRecolhido("u1")).toBe(false);
      expect(lerRitmoRecolhido("u2")).toBe(true);
      gravarRitmoRecolhido("u1", true);
      expect(lerRitmoRecolhido("u1")).toBe(true);
    });
  });

  describe("destaques de hoje: medalhas e selo Precisão", () => {
    const HOJE = "2026-10-21";
    const retrato = (avaliadores, dia = HOJE) => ({ dia, avaliadores });
    const a = (nome, qt, reabertas = 0) => ({ nome, qt, reabertas });

    it("as três maiores contagens levam ouro, prata e bronze; empate leva a mesma", () => {
      const { medalhas } = destaquesDoDia(
        retrato([
          a("Bruna Lima", 30),
          a("Ana Souza", 30),
          a("Caio Reis", 25),
          a("Davi Melo", 20),
          a("Eva Dias", 12),
        ]),
        HOJE,
      );
      expect(medalhas.map((m) => [m.posicao, m.nome])).toEqual([
        [1, "Ana Souza"],
        [1, "Bruna Lima"],
        [2, "Caio Reis"],
        [3, "Davi Melo"],
      ]);
    });

    it("selo Precisão: mínimo de fichas no dia e nenhuma reaberta", () => {
      expect(MINIMO_DO_SELO).toBe(10);
      const { precisao } = destaquesDoDia(
        retrato([
          a("Ana Souza", 40, 1), // ouro, mas teve ficha reaberta: sem selo
          a("Caio Reis", 15),
          a("Davi Melo", 10),
          a("Eva Dias", 9), // pódio (bronze), abaixo do mínimo: sem selo
        ]),
        HOJE,
      );
      expect(precisao).toEqual(["Caio Reis", "Davi Melo"]);
    });

    it("zera no dia seguinte: retrato de ontem não mostra nada", () => {
      const ontem = retrato([a("Ana Souza", 40)], "2026-10-20");
      expect(destaquesDoDia(ontem, HOJE)).toEqual({
        medalhas: [],
        precisao: [],
      });
      expect(destaquesDoDia(ontem, "2026-10-20").medalhas).toHaveLength(1);
      expect(destaquesDoDia(null, HOJE).medalhas).toEqual([]);
    });

    it("lê o campo da RPC e o card só calcula para hoje", () => {
      const [e] = lerRitmoDaAnalise({
        editais: [
          {
            id: "x",
            edital: "114/2026",
            destaques: {
              dia: HOJE,
              avaliadores: [
                { nome: "Ana Souza", qt: "12", reabertas: 0 },
                { nome: "", qt: 5 },
                { nome: "Sem fichas", qt: 0 },
              ],
            },
          },
          { id: "y", edital: "1/2026" },
        ],
      });
      expect(e.destaques).toEqual({
        dia: HOJE,
        avaliadores: [{ nome: "Ana Souza", qt: 12, reabertas: 0 }],
      });
      const r = calcularRitmo(edital({ destaques: e.destaques }), {
        hoje: HOJE,
        hora: 10,
      });
      expect(r.destaques.medalhas[0]).toMatchObject({
        nome: "Ana Souza",
        posicao: 1,
      });
      expect(r.destaques.precisao).toEqual(["Ana Souza"]);
      expect(
        calcularRitmo(edital({ destaques: e.destaques }), {
          hoje: "2026-10-22",
          hora: 10,
        }).destaques.medalhas,
      ).toEqual([]);
    });

    it("meta da equipe batida: o selo do dia é 'batida'", () => {
      const agora = { hoje: "2026-10-19", hora: 15 };
      const batida = calcularRitmo(
        edital({ porDia: [{ dia: "2026-10-19", qt: 400 }] }),
        agora,
      );
      expect(batida.dia.situacao).toBe("batida");
    });
  });
});
