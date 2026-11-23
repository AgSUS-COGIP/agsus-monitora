// @vitest-environment jsdom
import { bloco } from "./apoio/bloco.ts";
import { createElement, useState, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  beforeEach,
  afterEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";
import { CampoEditavel } from "../src/modulos/aprovados/partes.tsx";
import { lerInteiro } from "../src/lib/aprovados/carta-de-convocacao/configuracao-de-convocacao.ts";
import {
  lerTermos,
  modeloDeReferencia,
} from "../src/lib/aprovados/carta-de-convocacao/modelo-de-convocacao.ts";
import { achar, acharTodos } from "./dom.ts";
import {
  digitar,
  clicar,
  escolher,
  esperar,
  teclar,
} from "./componentes/interacoes.ts";
import { criarListaAprovados } from "../src/modulos/aprovados/lista-aprovados.tsx";
import {
  compactarPorArea,
  type CandidatoDoTeste,
  compactarCandidatos,
} from "./componentes/candidatos-compactos-falsos.ts";
import {
  publicarLinhasDoMonitoramento,
  redefinirDadosDoMonitoramento,
  definirAreaAtual,
} from "../src/componentes/dados-do-monitoramento.ts";
import {
  aberturaPelasChamadasDeAntes,
  type RespostaDoTeste,
} from "./componentes/abertura-dos-aprovados.ts";
import { definido } from "./definido.ts";
import { montarTela } from "./montar-tela.ts";
import { PLANILHAS } from "../src/lib/base/planilhas.ts";
import { type OpcoesDaTelaDosAprovados } from "../src/modulos/aprovados/tipos-do-estado.ts";
import { EditorDaChamada } from "../src/modulos/aprovados/chamada-para-contratacao.tsx";
import { LEI_15142_ESPALHADA } from "./modelos-de-convocacao-antigos.ts";
import { type ReferenciaDoModelo } from "../src/lib/aprovados/carta-de-convocacao/tipos-da-configuracao-de-convocacao.ts";
import { clienteDosAprovados } from "./clientes-falsos.ts";
import { registrarTelas } from "../src/app/registro-das-telas.ts";
import { pedirFiltro } from "../src/app/pedido-de-filtro.js";
import {
  ESPACO_EM_BRANCO,
  MODELO_PADRAO,
  assinaturaDaEmissao,
  camposDesconhecidos,
  camposParaRegistrar,
  camposUsados,
  chaveDoCampo,
  conteudoParaSalvar,
  dataLimitePadrao,
  emissaoInicial,
  hojeEmBrasilia,
  lerModelosDoBanco,
  mascararCpf,
  modelosParaEmitir,
  preencherCarta,
  rascunhoDoModelo,
  validarEmissao,
  validarModelo,
} from "../src/lib/aprovados/carta-de-convocacao/carta-de-convocacao.ts";
import {
  gerarDocxDasCartas,
  gerarZipDasCartas,
  htmlParaSei,
  montarCartas,
  paginaDaPrevia,
  soACarta,
  textoParaSei,
} from "../src/lib/aprovados/carta-de-convocacao/carta-de-convocacao-documento.ts";
import {
  candidatosDoPacote,
  candidatosDoEstado,
  listasDoEstado,
  anexosDoEstado,
  resultadoDaMarcacao,
} from "../src/lib/aprovados/dados-do-estado-de-aprovados.ts";
import { criarEstadoDaListaDeAprovados } from "../src/modulos/aprovados/estado.ts";

bloco("componentes/campos-dos-aprovados", () => {
  let raiz: Root;
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    document.body.innerHTML = "<div id='campo'></div>";
    raiz = createRoot(achar("#campo"));
  });
  afterEach(async () => {
    await act(async () => raiz.unmount());
    document.body.innerHTML = "";
  });
  describe("texto e valor dos campos de Aprovados", () => {
    it("apagar zero não repõe o zero e uma mudança externa atualiza o campo", async () => {
      let mudarPorFora: (valor: number) => void = () => {};
      const mudou = vi.fn();
      function Tela() {
        const [valor, setValor] = useState(0);
        mudarPorFora = setValor;
        return createElement(CampoEditavel<number, number>, {
          valor,
          ler: lerInteiro,
          aoMudar: (v: number) => {
            mudou(v);
            setValor(v);
          },
        });
      }
      await act(async () => raiz.render(createElement(Tela)));
      const campo = achar("input");
      await digitar(campo, "");
      expect(campo.value).toBe("");
      expect(mudou).toHaveBeenLastCalledWith(0);
      await digitar(campo, "12");
      expect(campo.value).toBe("12");
      expect(mudou).toHaveBeenLastCalledWith(12);
      await act(async () => mudarPorFora(33));
      expect(campo.value).toBe("33");
    });
    it("preserva o separador enquanto se escreve e recebe uma lista externa", async () => {
      let mudarPorFora: (valor: string[]) => void = () => {};
      const mudou = vi.fn();
      function Tela() {
        const [valor, setValor] = useState<string[]>([]);
        mudarPorFora = setValor;
        return createElement(CampoEditavel<string[], string[]>, {
          valor,
          ler: lerTermos,
          escrever: (v: string[]) => v.join("; "),
          aoMudar: (v: string[]) => {
            mudou(v);
            setValor(v);
          },
        });
      }
      await act(async () => raiz.render(createElement(Tela)));
      const campo = achar("input");
      await digitar(campo, "ampla; ");
      expect(campo.value).toBe("ampla; ");
      expect(mudou).toHaveBeenLastCalledWith(["ampla"]);
      await digitar(campo, "ampla; indigena");
      expect(mudou).toHaveBeenLastCalledWith(["ampla", "indigena"]);
      await act(async () => mudarPorFora(["pcd", "ampla"]));
      expect(campo.value).toBe("pcd; ampla");
    });
    it("sem conversor continua entregando texto", async () => {
      const mudou = vi.fn();
      await act(async () =>
        raiz.render(
          createElement(CampoEditavel, { valor: "Ana", aoMudar: mudou }),
        ),
      );
      await digitar(document.querySelector("input"), "Ana Maria");
      expect(mudou).toHaveBeenLastCalledWith("Ana Maria");
    });
  });
});

bloco("componentes/convocado-e-carta", () => {
  type Argumentos = Record<string, unknown>;

  /* O tamanho da lista que a RPC recebeu (quebra se não for lista). */
  function tamanho(valor: unknown): number {
    if (!Array.isArray(valor))
      throw new TypeError("a RPC não recebeu uma lista");
    return valor.length;
  }

  /* Um campo dentro dos argumentos de uma chamada (`a.b.c`). */
  function campoDe(valor: unknown, ...caminho: string[]): unknown {
    return caminho.reduce<unknown>(
      (atual, chave) =>
        typeof atual === "object" && atual !== null
          ? Reflect.get(atual, chave)
          : undefined,
      valor,
    );
  }

  /*
  O status Convocado e a carta de convocação na Lista de aprovados, pelas
  histórias de docs/historias-de-usuario/lista-de-aprovados.md:
    H1 Marcar um candidato como Convocado (com a data)
    H2 Seguir o fluxo a partir do Convocado
    H3 Ver convocados nos indicadores, filtros, ordem de chamada e CSV
    H4 Manter o modelo da carta (versões)
    H5 Emitir a carta para um ou vários candidatos
    H6 Marcar como Convocado depois de emitir
    H7 Ver as cartas emitidas na gaveta do candidato
*/

  beforeEach(() =>
    publicarLinhasDoMonitoramento([{ id: "10", CO_AREA: "saude-indigena" }]),
  );
  afterEach(() => redefinirDadosDoMonitoramento());

  const HOJE = "2026-10-05";
  const LISTA = {
    lista_id: "L10",
    edital_id: "10",
    edital: "03/2025",
    unidade: "DSEI Manaus",
    ativo: true,
    arquivo_nome: "aprovados.xlsx",
  };
  const base = {
    cargo: "Enfermeiro",
    modalidade: "Ampla concorrência",
    nota: 90,
    edital_id: "10",
    edital: "03/2025",
    unidade: "DSEI Manaus",
    codigo_vaga: "VG-1",
    lista_ativa: true,
    lista_id: "L10",
    status: "",
  };
  const CANDIDATOS = () => [
    {
      ...base,
      candidato_id: "ana",
      nome: "Ana Ribeiro",
      classificacao: 1,
      nota: 99,
      status: "Convocado",
    },
    {
      ...base,
      candidato_id: "bruno",
      nome: "Bruno Lima",
      classificacao: 2,
      nota: 98,
    },
    {
      ...base,
      candidato_id: "carla",
      nome: "Carla Souza",
      classificacao: 3,
      nota: 97,
    },
    {
      ...base,
      candidato_id: "diego",
      nome: "Diego Alves",
      classificacao: 4,
      nota: 96,
      status: "Contratado",
      matricula: "M-4",
    },
  ];
  const MODELOS = {
    pode_editar: true,
    modelos: [
      {
        modelo_id: "m1",
        area: "saude-indigena",
        nome: "Carta padrão",
        ativo: true,
        versao: 2,
        cartas: 1,
        vigente: {
          titulo: "CARTA DE CONVOCAÇÃO",
          texto:
            "Prezado(a) **{NOME}**,\nApresente-se até {DATA_LIMITE} em {LOCAL}.",
          local: "Sede",
          documentos: "RG",
          contato: "",
          prazo_dias: 5,
        },
        versoes: [
          {
            versao: 2,
            motivo: "Prazo novo",
            usuario: "Fulana",
            salvo_em: "2026-10-04T12:00:00Z",
          },
          {
            versao: 1,
            motivo: null,
            usuario: "Fulana",
            salvo_em: "2026-10-01T12:00:00Z",
          },
        ],
      },
    ],
  };

  function supabaseFalso({
    modelos = MODELOS,
    candidatos = CANDIDATOS(),
  }: { modelos?: unknown; candidatos?: CandidatoDoTeste[] } = {}) {
    let versao = 1;
    const responderRpc = (
      nome: string,
      argumentos?: Argumentos,
    ): Promise<RespostaDoTeste> => {
      let resposta: RespostaDoTeste = { data: { ok: true }, error: null };
      if (nome === "listar_candidatos_aprovados_compacto")
        resposta = {
          data: compactarPorArea(candidatos, {
            area:
              typeof argumentos?.p_area === "string"
                ? argumentos.p_area
                : undefined,
            versao: `v${versao}`,
          }),
          error: null,
        };
      else if (nome === "listar_listas_aprovados")
        resposta = { data: [LISTA], error: null };
      else if (
        nome === "listar_modelos_convocacao" ||
        nome === "listar_configuracao_convocacao"
      )
        resposta = { data: [], error: null };
      else if (nome === "listar_anexos_candidatos_aprovados")
        resposta = { data: [], error: null };
      else if (nome === "listar_convocacoes_aprovados")
        resposta = {
          data: [
            { candidato_id: "ana", data_convocacao: "2026-10-01", cartas: 1 },
          ],
          error: null,
        };
      else if (nome === "listar_modelos_carta_convocacao")
        resposta = { data: modelos, error: null };
      else if (nome === "registrar_carta_convocacao")
        resposta = {
          data: {
            carta_id: "carta-1",
            emitida_em: "2026-10-05T13:00:00Z",
            candidatos: tamanho(definido(argumentos).p_candidatos),
          },
          error: null,
        };
      else if (nome === "marcar_candidatos_convocados")
        resposta = {
          data: {
            marcados: tamanho(definido(argumentos).p_candidatos),
            ignorados: [],
            data_convocacao: definido(argumentos).p_data_convocacao,
          },
          error: null,
        };
      else if (nome === "salvar_modelo_carta_convocacao")
        resposta = {
          data: {
            modelo_id: definido(argumentos).p_modelo || "novo",
            versao: Number(definido(argumentos).p_versao_atual || 0) + 1,
          },
          error: null,
        };
      else if (nome === "listar_cartas_do_candidato")
        resposta = {
          data: {
            data_convocacao: "2026-10-01",
            cartas: [
              {
                carta_id: "c1",
                emitida_em: "2026-10-01T12:00:00Z",
                usuario: "Fulana",
                modelo: "Carta padrão",
                versao: 1,
                saida: "PDF",
                data_limite: "2026-10-06",
                candidatos: 3,
                convocacao_marcada: "2026-10-01",
              },
            ],
          },
          error: null,
        };
      if (/^(alterar|marcar|salvar|registrar)_/.test(nome)) versao += 1;
      return Promise.resolve(resposta);
    };
    // A abertura da página numa chamada, montada com as respostas acima.
    const rpc = vi.fn(
      (nome: string, argumentos?: Argumentos): Promise<RespostaDoTeste> =>
        nome === "abrir_lista_aprovados"
          ? aberturaPelasChamadasDeAntes(responderRpc, argumentos)
          : responderRpc(nome, argumentos),
    );
    return { rpc, storage: { from: vi.fn() } };
  }

  const montarLista = (
    opcoes: Parameters<typeof criarListaAprovados>[0] & {
      secao: HTMLElement | null;
    },
  ) => montarTela(criarListaAprovados, "page-approved", opcoes);

  let controlador: ReturnType<typeof montarLista> | null = null;
  let perfilAtual: Record<string, unknown> | null = null;

  async function montar({
    perfil = { perfil: "contratador" },
    supabase = supabaseFalso(),
    toast = vi.fn(),
  }: {
    perfil?: Record<string, unknown>;
    supabase?: ReturnType<typeof supabaseFalso>;
    toast?: (mensagem: string, tom?: string) => void;
  } = {}) {
    document.body.innerHTML = `<section id="page-approved" class="page active"></section>`;
    perfilAtual = perfil;
    const copiar = vi.fn(
      async (_conteudo: { html: string; texto: string }) => "html",
    );
    const imprimir = vi.fn();
    const baixar = vi.fn((_arquivo: Blob, _nome: string) => {});
    await act(async () => {
      controlador = montarLista({
        secao: document.getElementById("page-approved"),
        supabase,
        toast,
        getProfile: () => perfilAtual,
        confirmar: () => true,
        novaAba: () => ({ mostrar: vi.fn(), fechar: vi.fn() }),
        copiar,
        imprimir,
        baixar,
        carregarLogo: async () => null,
        cabecalho: () => "AGÊNCIA DO ENSAIO",
        hoje: () => HOJE,
      });
    });
    await esperar(() => definido(controlador).render());
    return { supabase, toast, copiar, imprimir, baixar };
  }

  afterEach(async () => {
    await act(async () => controlador?.raiz?.unmount());
    controlador = null;
    document.body.innerHTML = "";
  });

  const $ = (id: string) => document.getElementById(id);
  const campo = (id: string) =>
    document.querySelector<HTMLInputElement>(`#${id}`);
  const botao = (id: string) =>
    document.querySelector<HTMLButtonElement>(`#${id}`);
  const linhaDe = (painel: string, nome: string) =>
    [...document.querySelectorAll(`#${painel} tr`)].find(
      (linha) =>
        linha.querySelector(".approved-name strong")?.textContent === nome,
    );
  /* Uma ação do "⋯ Mais ações" da linha da aba Aprovados (abre o menu). */
  async function doMenuDaLinha(nome: string, acao: string) {
    const linha = linhaDe("approvedPanelAprovados", nome);
    await clicar(linha?.querySelector("[data-acao='abrir-menu']"));
    return linha?.querySelector<HTMLButtonElement>(
      `[role='menuitem'][data-approved-action="${acao}"]`,
    );
  }
  const chamadas = (supabase: ReturnType<typeof supabaseFalso>, nome: string) =>
    supabase.rpc.mock.calls.filter(([n]) => n === nome).map(([, a]) => a);
  const irParaConvocacao = () => clicar($("approvedTabConvocacao"));

  describe("H1/H2: status Convocado com a data", () => {
    it("Fim de Fila saiu das opções; Convocado pede a data, que não pode ser futura", async () => {
      const { supabase } = await montar();
      await clicar(
        linhaDe("approvedPanelAprovados", "Bruno Lima")?.querySelector(
          '[data-approved-action="status"]',
        ),
      );
      const opcoes = [
        ...definido(
          document.querySelector<HTMLSelectElement>("#approvedStatusSelect"),
        ).options,
      ].map((o) => o.value);
      expect(opcoes).not.toContain("Fim de Fila");
      expect(opcoes).toContain("Convocado");
      await escolher($("approvedStatusSelect"), "Convocado");
      expect(campo("approvedStatusDataConvocacao")?.value).toBe(HOJE);
      expect(campo("approvedStatusDataConvocacao")?.max).toBe(HOJE);
      await digitar($("approvedStatusDataConvocacao"), "2026-10-03");
      supabase.rpc.mockClear();
      await clicar($("approvedStatusSave"));
      expect(supabase.rpc).toHaveBeenCalledWith(
        "alterar_status_aprovado_com_observacao",
        {
          p_observacao: null,
          p_candidato_id: "bruno",
          p_status: "Convocado",
          p_processo_sei: null,
          p_matricula: null,
          p_data_convocacao: "2026-10-03",
        },
      );
    });

    it("do Convocado, quem edita segue o fluxo (sem cadeado), mas não deixa sem status", async () => {
      await montar();
      const ana = linhaDe("approvedPanelAprovados", "Ana Ribeiro");
      expect(ana?.querySelector(".approved-status-data")?.textContent).toBe(
        "em 01/10/2026",
      );
      await clicar(ana?.querySelector('[data-approved-action="status"]'));
      expect(
        $("approvedStatusSelect")?.querySelector<HTMLOptionElement>(
          'option[value=""]',
        )?.disabled,
      ).toBe(true);
      expect(campo("approvedStatusDataConvocacao")?.value).toBe("2026-10-01");
    });

    it("contratado continua bloqueado para quem não é admin", async () => {
      await montar();
      const diego = linhaDe("approvedPanelAprovados", "Diego Alves");
      expect(
        diego?.querySelector(".ui-acoes-da-linha > button")?.textContent,
      ).toBe("Abrir");
      const status = await doMenuDaLinha("Diego Alves", "status");
      expect(status?.disabled).toBe(true);
      expect(status?.textContent).toContain("só o admin altera");
    });
  });

  describe("H3: convocados nos indicadores, na ordem de chamada e no CSV", () => {
    it("aprovados: KPI Convocados no lugar de Fim de fila; contratados não somam convocados", async () => {
      await montar();
      expect($("approvedKpiConvocado")?.textContent).toBe("1");
      expect($("approvedKpiContratado")?.textContent).toBe("1");
      expect($("approvedKpiFimDeFila")).toBeNull();
    });

    it("convocação: A convocar não conta quem já foi chamado; CSV com a data", async () => {
      const { baixar } = await montar();
      await irParaConvocacao();
      expect($("convocacaoKpiConvocados")?.textContent).toBe("1");
      // Sem quadro de vagas, ninguém é vaga imediata: nada a convocar.
      expect($("convocacaoKpiAConvocar")?.textContent).toBe("0");
      await clicar($("convocacaoCsvBtn"));
      const [arquivo, nome] = definido(baixar.mock.calls[0]);
      expect(nome).toBe("ordem-de-convocacao.csv");
      const texto = await arquivo.text();
      expect(texto).toContain("Data da convocação");
      expect(texto).toContain("Ana Ribeiro");
      expect(texto).toContain("01/10/2026");
    });

    it("quem só consulta não escolhe nem emite, mas exporta o CSV", async () => {
      await montar({ perfil: { perfil: "usuario" } });
      await irParaConvocacao();
      expect(
        document.querySelector('[data-convocacao-action="escolher"]'),
      ).toBeNull();
      expect($("convocacaoCartaBtn")).toBeNull();
      expect($("convocacaoModelosBtn")).toBeNull();
      expect($("convocacaoCsvBtn")).not.toBeNull();
      expect(
        document.querySelector('[data-convocacao-action="carta"]'),
      ).toBeNull();
    });
  });

  describe("H5/H6: emitir a carta e marcar como Convocado", () => {
    it("escolhe dois na convocação, vê a prévia, copia para o SEI (registra) e marca os dois", async () => {
      const { supabase, copiar } = await montar();
      await irParaConvocacao();
      for (const nome of ["Bruno Lima", "Carla Souza"])
        await clicar(
          linhaDe("approvedPanelConvocacao", nome)?.querySelector(
            '[data-convocacao-action="escolher"]',
          ),
        );
      expect($("convocacaoAcoes")?.textContent).toContain("2 escolhidos");
      await clicar($("convocacaoCartaBtn"));
      await esperar(() => Promise.resolve());
      expect($("cartaSubtitulo")?.textContent).toBe("2 candidatos");
      expect(campo("cartaModelo")?.value).toBe("m1");
      // A data limite começa pelo prazo padrão do modelo (5 dias).
      expect(campo("carta-dataLimite")?.value).toBe("2026-10-10");
      expect($("cartaPrevia")?.getAttribute("srcdoc")).toContain(
        "Prezado(a) <strong>Bruno Lima</strong>",
      );
      expect($("cartaPrevia")?.getAttribute("srcdoc")).toContain("Carla Souza");

      supabase.rpc.mockClear();
      await clicar($("cartaCopiarSei"));
      expect(chamadas(supabase, "registrar_carta_convocacao")).toEqual([
        {
          p_modelo: "m1",
          p_versao: 2,
          p_candidatos: ["bruno", "carla"],
          p_agrupamento: "UNICO",
          p_saida: "SEI",
          p_campos: {
            data_limite: "2026-10-10",
            local: "Sede",
            documentos: "RG",
            contato: "",
          },
        },
      ]);
      expect(definido(copiar.mock.calls[0])[0].html).toContain(
        "Texto_Justificado_Recuo_Primeira_Linha",
      );

      // A mesma carta não registra de novo.
      await clicar($("cartaPdf"));
      expect(chamadas(supabase, "registrar_carta_convocacao")).toHaveLength(1);

      await clicar($("cartaMarcarConvocados"));
      expect(chamadas(supabase, "marcar_candidatos_convocados")).toEqual([
        {
          p_candidatos: ["bruno", "carla"],
          p_data_convocacao: HOJE,
          p_carta: "carta-1",
        },
      ]);
      expect(document.querySelector(".carta-emitida")?.textContent).toContain(
        "2 marcado(s) como Convocado",
      );
    });

    it("uma carta por candidato: DOCX sai num .zip e o SEI copia uma por vez", async () => {
      const { supabase, baixar } = await montar();
      await irParaConvocacao();
      for (const nome of ["Bruno Lima", "Carla Souza"])
        await clicar(
          linhaDe("approvedPanelConvocacao", nome)?.querySelector(
            '[data-convocacao-action="escolher"]',
          ),
        );
      await clicar($("convocacaoCartaBtn"));
      await esperar(() => Promise.resolve());
      await clicar(
        document.querySelector(
          '.carta-agrupamento [data-valor="POR_CANDIDATO"]',
        ),
      );
      expect($("cartaNavegacao")?.textContent).toContain("Carta 1 de 2");
      await clicar($("cartaDocx"));
      expect(baixar.mock.calls.at(-1)?.[1]).toMatch(/\.zip$/);
      await clicar(document.querySelector('[aria-label="Próxima carta"]'));
      await clicar($("cartaCopiarSei"));
      const registros = chamadas(supabase, "registrar_carta_convocacao");
      expect(registros.at(-1)).toMatchObject({
        p_candidatos: ["carla"],
        p_agrupamento: "POR_CANDIDATO",
        p_saida: "SEI",
      });
    });

    it("data limite que já passou bloqueia as saídas", async () => {
      await montar();
      await clicar(await doMenuDaLinha("Bruno Lima", "carta"));
      await esperar(() => Promise.resolve());
      await digitar($("carta-dataLimite"), "2026-10-01");
      expect(
        document.querySelector(".carta-pendencias")?.textContent,
      ).toContain("A data limite já passou.");
      expect(botao("cartaCopiarSei")?.disabled).toBe(true);
    });

    it("sem modelo ativo, oferece criar um", async () => {
      await montar({
        supabase: supabaseFalso({
          modelos: { pode_editar: true, modelos: [] },
        }),
      });
      await clicar(await doMenuDaLinha("Bruno Lima", "carta"));
      await esperar(() => Promise.resolve());
      expect($("cartaSemModelo")?.textContent).toContain("Nenhum modelo ativo");
      await clicar($("cartaCriarModelo"));
      expect($("cartaModelosModal")).not.toBeNull();
    });
  });

  describe("H4: modelos da carta, versionados", () => {
    it("cria um modelo da área com o texto padrão", async () => {
      const { supabase } = await montar();
      await irParaConvocacao();
      await clicar($("convocacaoModelosBtn"));
      await esperar(() => Promise.resolve());
      expect($("cartaListaDeModelos")?.textContent).toContain("Carta padrão");
      await clicar($("cartaNovoModelo"));
      await digitar($("cartaModeloNome"), "Carta do DSEI");
      supabase.rpc.mockClear();
      await clicar($("cartaModeloSalvar"));
      const [salvo] = chamadas(supabase, "salvar_modelo_carta_convocacao");
      expect(salvo).toMatchObject({
        p_modelo: null,
        p_area: "saude-indigena",
        p_edital: null,
        p_versao_atual: null,
        p_motivo: null,
      });
      expect(campoDe(salvo, "p_conteudo")).toMatchObject({
        nome: "Carta do DSEI",
        prazo_dias: 5,
      });
      expect(campoDe(salvo, "p_conteudo", "texto")).toContain("{DOCUMENTOS}");
    });

    it("editar pede o motivo e manda a versão aberta", async () => {
      const { supabase } = await montar();
      await irParaConvocacao();
      await clicar($("convocacaoModelosBtn"));
      await esperar(() => Promise.resolve());
      await clicar(document.querySelector('[data-modelo-action="editar"]'));
      expect(botao("cartaModeloSalvar")?.disabled).toBe(true);
      expect(
        document.querySelector(".carta-pendencias")?.textContent,
      ).toContain("Informe o motivo");
      await digitar($("cartaModeloMotivo"), "Novo local");
      supabase.rpc.mockClear();
      await clicar($("cartaModeloSalvar"));
      expect(
        chamadas(supabase, "salvar_modelo_carta_convocacao")[0],
      ).toMatchObject({
        p_modelo: "m1",
        p_versao_atual: 2,
        p_motivo: "Novo local",
      });
    });

    it("campo desconhecido no texto não salva", async () => {
      await montar();
      await irParaConvocacao();
      await clicar($("convocacaoModelosBtn"));
      await esperar(() => Promise.resolve());
      await clicar($("cartaNovoModelo"));
      await digitar($("cartaModeloTexto"), "Olá {MATRICULA}");
      expect(
        document.querySelector(".carta-pendencias")?.textContent,
      ).toContain("Campo desconhecido: {MATRICULA}.");
      expect(botao("cartaModeloSalvar")?.disabled).toBe(true);
    });
  });

  describe("H7: cartas emitidas na gaveta do candidato", () => {
    it("histórico malformado mostra nova tentativa e recupera as cartas", async () => {
      const supabase = supabaseFalso();
      const original = supabase.rpc.getMockImplementation();
      let invalido = true;
      supabase.rpc.mockImplementation((nome, argumentos) =>
        nome === "listar_cartas_do_candidato" && invalido
          ? Promise.resolve({
              data: { cartas: [{ carta_id: "x", modelo: {} }] },
              error: null,
            })
          : definido(original)(nome, argumentos),
      );
      await montar({ supabase });
      await clicar(
        linhaDe("approvedPanelAprovados", "Ana Ribeiro")?.querySelector(
          '[data-approved-action="candidato"]',
        ),
      );
      await esperar(() => Promise.resolve());
      expect($("approvedCandidatoCartas")).toBeNull();
      const repetir = [
        ...document.querySelectorAll("#approvedCandidatoGaveta button"),
      ].find((b) => b.textContent.includes("Tentar de novo"));
      expect(repetir).toBeTruthy();
      invalido = false;
      await clicar(repetir);
      expect($("approvedCandidatoCartas")?.textContent).toContain(
        "Carta padrão",
      );
    });
    it("o nome abre a gaveta com os dados e o histórico das cartas", async () => {
      const { supabase } = await montar();
      await clicar(
        linhaDe("approvedPanelAprovados", "Ana Ribeiro")?.querySelector(
          '[data-approved-action="candidato"]',
        ),
      );
      await esperar(() => Promise.resolve());
      expect(chamadas(supabase, "listar_cartas_do_candidato")).toEqual([
        { p_candidato: "ana" },
      ]);
      expect($("approvedCandidatoTitulo")?.textContent).toBe("Ana Ribeiro");
      const cartas = $("approvedCandidatoCartas")?.textContent;
      expect(cartas).toContain("Carta padrão");
      expect(cartas).toContain("com mais 2 candidatos");
      expect(cartas).toContain("marcado Convocado em 01/10/2026");
    });
  });
});

bloco("componentes/lista-aprovados", () => {
  type TelaDosAprovados = ReturnType<typeof criarListaAprovados>;

  /* O `data` de uma resposta como objeto para espalhar (espalhar null não traz nada). */
  const objeto = (valor: unknown): object =>
    typeof valor === "object" && valor !== null ? valor : {};

  /*
  A tela só mostra os editais da área atual (a padrão é a Saúde Indígena); os
  editais das fixtures precisam estar nas linhas do monitoramento. Registrado
  antes dos outros ganchos, o afterEach roda depois de desmontar.
*/
  beforeEach(() => {
    publicarLinhasDoMonitoramento(
      ["10", "20"].map((id) => ({ id, CO_AREA: "saude-indigena" })),
    );
    // A vista (Ativos ou Histórico) fica na sessão: cada teste começa nos Ativos.
    sessionStorage.clear();
  });
  afterEach(() => redefinirDadosDoMonitoramento());

  /*
  A Lista de Aprovados em React: a aba de aprovados (indicadores, filtros,
  tabela paginada) e os modais de status, sub judice e listas do edital. A aba
  de convocação tem o seu próprio arquivo (`lista-de-convocacao.test.js`).
*/

  const LISTA_ATIVA = {
    lista_id: "L10",
    edital_id: "10",
    edital: "03/2025",
    unidade: "DSEI Manaus",
    ativo: true,
    arquivo_nome: "aprovados-03-2025.xlsx",
    arquivo_path: "10/arquivo.xlsx",
    total_candidatos: 3,
  };
  const LISTA_INATIVA = {
    lista_id: "L20",
    edital_id: "20",
    edital: "04/2025",
    unidade: "CASAI São Paulo",
    ativo: false,
  };

  let sequencial = 0;
  const candidato = (extra: Record<string, unknown> = {}): CandidatoDoTeste => {
    sequencial += 1;
    return {
      candidato_id: `c${sequencial}`,
      nome: `Candidato ${sequencial}`,
      cargo: "Enfermeiro",
      modalidade: "Ampla concorrência",
      classificacao: sequencial,
      nota: 90.5,
      edital_id: "10",
      edital: "03/2025",
      unidade: "DSEI Manaus",
      codigo_vaga: "VG-1",
      lista_ativa: true,
      status: "",
      ...extra,
    };
  };

  const CANDIDATOS = () => [
    candidato({
      candidato_id: "ana",
      nome: "Ana Ribeiro",
      status: "Contratado",
      matricula: "M-1",
    }),
    candidato({
      candidato_id: "bruno",
      nome: "Bruno Lima",
      cargo: "Médico",
      modalidade: "Pessoa negra",
    }),
    candidato({ candidato_id: "carla", nome: "Carla Souza", sub_judice: true }),
    candidato({
      candidato_id: "diego",
      nome: "Diego Alves",
      cargo: "Dentista",
      edital_id: "20",
      edital: "04/2025",
      lista_ativa: false,
      status: "Desistente",
    }),
  ];

  interface OpcoesDoBancoFalso {
    candidatos?: readonly CandidatoDoTeste[];
    listas?: readonly object[];
    anexos?: readonly unknown[];
    erros?: Readonly<Record<string, string>>;
    porArea?: boolean;
  }

  function supabaseFalso({
    candidatos = CANDIDATOS(),
    listas = [LISTA_ATIVA, LISTA_INATIVA],
    anexos = [],
    erros = {},
    porArea = true,
  }: OpcoesDoBancoFalso = {}) {
    /*
    O que o banco tem: a versão dos dados muda a cada escrita (como a
    assinatura de FC_VERSAO_APROVADOS_AREA); `candidatos` pode ser trocado.
  */
    const banco: { candidatos: readonly CandidatoDoTeste[]; versao: string } = {
      candidatos,
      versao: "v1",
    };
    let novos = 0;
    const responder = (nome: string): RespostaDoTeste => {
      const erro = erros[nome];
      if (erro) return { data: null, error: { message: erro } };
      if (nome === "listar_listas_aprovados")
        return { data: listas, error: null };
      if (nome === "listar_anexos_candidatos_aprovados")
        return { data: anexos, error: null };
      if (nome === "registrar_anexo_candidato_aprovado")
        return { data: { ok: true, anexo_id: `novo-${++novos}` }, error: null };
      if (nome === "baixar_anexo_candidato_aprovado")
        return {
          data: { arquivo_nome: "termo.pdf", arquivo_base64: btoa("%PDF-1.4") },
          error: null,
        };
      if (nome === "alterar_status_candidatos_aprovados")
        return { data: { marcados: 2, ignorados: [] }, error: null };
      if (nome === "listar_modelos_convocacao")
        return { data: [], error: null };
      if (nome === "listar_configuracao_convocacao")
        return { data: [], error: null };
      if (nome === "pedir_casamento_da_lista")
        return {
          data: {
            pedido_id: "99999999-9999-4999-8999-999999999999",
            situacao: "CALCULADO",
          },
          error: null,
        };
      if (nome === "obter_casamento_da_lista")
        return {
          data: {
            pedido_id: "99999999-9999-4999-8999-999999999999",
            origem: "XLSX",
            situacao: "CALCULADO",
            exige_motivo: false,
            anteriores: 0,
            novos_total: 2,
            plano: {
              versao: 1,
              vinculos: [],
              resumo: { casados: 0, entram: 2 },
              pendencias: [],
              mudam: [],
              revisar: [],
            },
          },
          error: null,
        };
      if (nome === "aplicar_casamento_da_lista")
        return {
          data: { ok: true, candidatos: 2, preservados: 0 },
          error: null,
        };
      return { data: { ok: true }, error: null };
    };
    const pacote = (argumentos?: Record<string, unknown>): RespostaDoTeste => {
      const mensagem =
        erros.listar_candidatos_aprovados_compacto ||
        erros.listar_candidatos_aprovados;
      if (mensagem) return { data: null, error: { message: mensagem } };
      // Sem argumentos: a função de antes da migration (formato 1, todas as áreas).
      if (!argumentos)
        return { data: compactarCandidatos(banco.candidatos), error: null };
      if (!porArea)
        return {
          data: null,
          error: { code: "PGRST202", message: "função ausente" },
        };
      const { p_area: area, p_versao: versao } = argumentos;
      if (versao && versao === banco.versao)
        return {
          data: { formato: 2, area, versao, inalterado: true },
          error: null,
        };
      return {
        data: compactarPorArea(banco.candidatos, {
          area: typeof area === "string" ? area : undefined,
          versao: banco.versao,
        }),
        error: null,
      };
    };
    const responderRpc = (
      nome: string,
      argumentos?: Record<string, unknown>,
    ): Promise<RespostaDoTeste> => {
      if (nome === "listar_candidatos_aprovados_compacto")
        return Promise.resolve(pacote(argumentos));
      // Toda escrita muda a versão dos dados no banco.
      if (/^(alterar|incluir|remover|importar|definir|salvar)_/.test(nome))
        banco.versao = `v${Number(banco.versao.slice(1)) + 1}`;
      const resposta: Promise<RespostaDoTeste> & { range: () => unknown } =
        Object.assign(Promise.resolve(responder(nome)), {
          range: () => resposta,
        });
      return resposta;
    };
    // A abertura da página numa chamada, montada com as respostas acima.
    const rpc = vi.fn((nome: string, argumentos?: Record<string, unknown>) =>
      nome === "abrir_lista_aprovados"
        ? aberturaPelasChamadasDeAntes(responderRpc, argumentos)
        : responderRpc(nome, argumentos),
    );
    const bucket = {
      upload: vi.fn(
        async (
          _caminho: string,
          _arquivo: File,
          _opcoes: { contentType: string; upsert: boolean },
        ) => ({ data: {}, error: null }),
      ),
      download: vi.fn(async (_caminho: string) => ({
        data: new Blob(["x"]),
        error: null,
      })),
    };
    const storage = { from: vi.fn(() => bucket) };
    return { rpc, storage, bucket, banco };
  }

  type BancoFalso = ReturnType<typeof supabaseFalso>;

  let controlador: (TelaDosAprovados & { raiz: Root | null }) | null = null;
  let perfilAtual: unknown = null;

  interface OpcoesDaMontagem extends Pick<
    OpcoesDaTelaDosAprovados,
    | "confirmar"
    | "lerPlanilha"
    | "novaAba"
    | "armazenamento"
    | "esperar"
    | "baixar"
  > {
    perfil?: unknown;
    supabase?: BancoFalso;
    toast?: Mock<(mensagem: string, tom?: string) => void>;
    secaoAtiva?: boolean;
    carregar?: boolean;
  }

  async function montar({
    perfil = { perfil: "contratador" },
    supabase = supabaseFalso(),
    toast = vi.fn<(mensagem: string, tom?: string) => void>(),
    confirmar = () => true,
    lerPlanilha = async () => [{ nome: "X" }, { nome: "Y" }],
    novaAba = () => ({ mostrar: vi.fn(), fechar: vi.fn() }),
    secaoAtiva = true,
    carregar = true,
    armazenamento,
    esperar: esperarOJob = async () => {},
    baixar,
  }: OpcoesDaMontagem = {}) {
    /*
      Montar de novo no mesmo teste desmonta a tela anterior: viva fora da
      página, ela continuava a consumir os pedidos de filtro ("approved").
    */
    await act(async () => controlador?.raiz?.unmount());
    document.body.innerHTML = `<section id="page-approved" class="page${secaoAtiva ? " active" : ""}"></section>`;
    perfilAtual = perfil;
    await act(async () => {
      controlador = montarTela<OpcoesDaTelaDosAprovados, TelaDosAprovados>(
        criarListaAprovados,
        "page-approved",
        {
          secao: document.getElementById("page-approved"),
          supabase,
          toast,
          getProfile: () => perfilAtual,
          confirmar,
          lerPlanilha,
          novaAba,
          armazenamento,
          esperar: esperarOJob,
          ...(baixar ? { baixar } : {}),
        },
      );
    });
    if (carregar) await esperar(() => definido(controlador).render());
    return { supabase, toast };
  }

  afterEach(async () => {
    await act(async () => controlador?.raiz?.unmount());
    controlador = null;
    document.body.innerHTML = "";
  });

  /* O elemento que o teste sabe que existe, pelo id; `talvez` quando pode faltar. */
  const $ = <E extends HTMLElement = HTMLElement>(id: string) =>
    achar<E>(`#${id}`);
  const talvez = (id: string) => document.getElementById(id);
  /* Os argumentos de cada chamada a listar_candidatos_aprovados_compacto. */
  /* O pacote da área: pela abertura numa chamada ou, banco antigo, pela RPC dele. */
  const chamadasDoPacote = (supabase: BancoFalso) =>
    supabase.rpc.mock.calls
      .filter(([nome]) =>
        [
          "abrir_lista_aprovados",
          "listar_candidatos_aprovados_compacto",
        ].includes(nome),
      )
      .map(
        ([, argumentos]) =>
          argumentos && {
            p_area: argumentos.p_area,
            p_versao: argumentos.p_versao,
          },
      );
  const nomes = () =>
    acharTodos("#approvedRows .approved-name strong").map(
      (item) => item.textContent,
    );
  const linhaDe = (nome: string) =>
    acharTodos("#approvedRows tr").find(
      (linha) =>
        linha.querySelector(".approved-name strong")?.textContent === nome,
    );
  // Ativos e Histórico: o controle acima dos filtros.
  const vistaDosAprovados = (valor: "ativos" | "historico") =>
    achar(`[data-tour="aprovados-ativos-e-historico"] [data-valor="${valor}"]`);
  const verHistorico = () => clicar(vistaDosAprovados("historico"));
  /*
    As ações da linha (revisão de 17/11/2026): a principal fica à vista e as
    outras no "⋯ Mais ações de <nome>". Devolve a ação pedida, abrindo o menu
    quando ela está nele (null quando a linha não a tem).
  */
  async function acaoDaLinha(nome: string, acao: string) {
    const linha = definido(linhaDe(nome));
    const seletor = `[data-approved-action="${acao}"]`;
    const direta = linha.querySelector<HTMLButtonElement>(
      `.ui-acoes-da-linha > button${seletor}`,
    );
    if (direta) return direta;
    const menu = linha.querySelector<HTMLButtonElement>(
      "[data-acao='abrir-menu']",
    );
    if (!menu) return null;
    if (menu.getAttribute("aria-expanded") !== "true") await clicar(menu);
    return linha.querySelector<HTMLButtonElement>(
      `[role='menuitem']${seletor}`,
    );
  }
  /* Os rótulos do "⋯" da linha (abre o menu). */
  async function maisAcoesDe(nome: string) {
    const linha = definido(linhaDe(nome));
    const menu = linha.querySelector<HTMLButtonElement>(
      "[data-acao='abrir-menu']",
    );
    if (!menu) return [];
    if (menu.getAttribute("aria-expanded") !== "true") await clicar(menu);
    return acharTodos("[role='menuitem']", linha).map((b) => b.textContent);
  }
  const opcaoDoFiltro = (filtro: string, rotulo: string) =>
    acharTodos(
      ".multi-select-option",
      definido($(filtro).closest(".multi-select")),
    )
      .find((opcao) => opcao.textContent === rotulo)
      ?.querySelector("input");
  const opcoesDoFiltro = (filtro: string) =>
    acharTodos(
      ".multi-select-option",
      definido($(filtro).closest(".multi-select")),
    ).map((opcao) => opcao.textContent);

  describe("topo e visões", () => {
    it("as visões são abas (tablist) com o visual do controle segmentado, no topo", async () => {
      await montar();
      const visoes = achar(
        "#page-approved .ui-topo .ui-segmentado[role='tablist']",
      );
      expect(visoes).not.toBeNull();
      const abas = acharTodos("[role='tab']", visoes);
      const aprovados = definido(abas[0]);
      const convocacao = $("approvedTabConvocacao");
      expect(aprovados.id).toBe("approvedTabAprovados");
      expect(aprovados.getAttribute("aria-selected")).toBe("true");
      expect(aprovados.classList.contains("is-ativo")).toBe(true);
      expect(aprovados.getAttribute("aria-controls")).toBe(
        "approvedPanelAprovados",
      );
      await clicar(convocacao);
      expect(convocacao.getAttribute("aria-selected")).toBe("true");
      expect($("approvedPanelConvocacao").classList.contains("hidden")).toBe(
        false,
      );
      expect($("approvedPanelAprovados").classList.contains("hidden")).toBe(
        true,
      );
      expect($("approvedHeadActions").classList.contains("hidden")).toBe(true);
      expect(
        achar("#page-approved [data-status-da-carga]").textContent,
      ).toMatch(/^Atualizado em /);
    });

    it("KPIs no Kpi compacto de src/ui, nas duas abas", async () => {
      await montar();
      for (const painel of [
        "approvedPanelAprovados",
        "approvedPanelConvocacao",
      ]) {
        const grade = achar(".approved-kpis.ui-kpis", $(painel));
        expect(grade.querySelectorAll(".ui-kpi").length).toBeGreaterThanOrEqual(
          5,
        );
      }
      expect($("approvedKpiTotal").classList.contains("ui-kpi-valor")).toBe(
        true,
      );
    });
  });

  describe("carregamento", () => {
    it("antes do dado chegar, mostra skeleton — e não zero", async () => {
      await montar({ carregar: false });
      expect($("approvedKpiTotal").textContent).toBe("");
      expect($("approvedKpiTotal").classList.contains("ui-esqueleto")).toBe(
        true,
      );
      expect($("convocacaoKpiVagas").classList.contains("ui-esqueleto")).toBe(
        true,
      );
      expect($("approvedCount").textContent).toBe("Carregando…");
      expect(achar("#page-approved [data-status-da-carga]").textContent).toBe(
        "Carregando dados…",
      );
      expect(
        document.querySelectorAll("#approvedRows tr.ui-esqueleto-tr"),
      ).toHaveLength(8);
      expect(
        $("convocacaoRows").querySelector("tr.ui-esqueleto-tr"),
      ).not.toBeNull();
    });

    it("carregar não cobre a tela: não há tela de carregamento a chamar", async () => {
      const fonte = await import("node:fs").then(({ readFileSync }) =>
        readFileSync("src/modulos/aprovados/estado.ts", "utf8"),
      );
      expect(fonte).not.toContain("loader");
    });

    it("se a primeira carga falha, mostra o erro e tenta de novo", async () => {
      const erros: Record<string, string> = {
        listar_listas_aprovados: "sem rede",
      };
      const supabase = supabaseFalso({ erros });
      await montar({ supabase });
      expect($("approvedErro").textContent).toContain(
        "Não foi possível carregar a lista de aprovados: sem rede",
      );
      expect($("approvedRows").textContent).toBe("Sem dados.");
      expect($("approvedRows").querySelector(".ui-esqueleto-tr")).toBeNull();
      expect($("convocacaoRows").textContent).toBe("Sem dados.");
      expect($("approvedCount").textContent).toBe("Sem dados");

      delete erros.listar_listas_aprovados;
      await clicar(achar('[data-acao="tentar-novamente"]', $("approvedErro")));
      await esperar(() => new Promise((resolver) => setTimeout(resolver, 0)));
      expect(nomes()).toContain("Ana Ribeiro");
      expect($("approvedCount").textContent).toBe("3 candidatos");
    });

    it("desenha as linhas e os indicadores", async () => {
      await montar();
      // A lista de trabalho (Ativos): a lista inativa do Diego fica no Histórico.
      expect(nomes()).toEqual(["Ana Ribeiro", "Bruno Lima", "Carla Souza"]);
      expect($("approvedKpiTotal").textContent).toBe("3");
      expect($("approvedKpiContratado").textContent).toBe("1");
      expect($("approvedKpiDesistente").textContent).toBe("0");
      expect($("approvedCount").textContent).toBe("3 candidatos");
      expect(
        achar('.approved-status[data-tom="sucesso"]', linhaDe("Ana Ribeiro"))
          .textContent,
      ).toBe("Contratado");
      expect(achar(".approved-status", linhaDe("Bruno Lima")).textContent).toBe(
        "Sem status",
      );
      expect(
        achar("td.num:nth-of-type(8)", linhaDe("Ana Ribeiro")).textContent,
      ).toBe("90,5");
    });

    it("busca os candidatos da área atual numa chamada só", async () => {
      const muitos = Array.from({ length: 1003 }, () => candidato());
      const supabase = supabaseFalso({ candidatos: muitos });
      await montar({ supabase });
      expect(chamadasDoPacote(supabase)).toEqual([
        { p_area: "saude-indigena", p_versao: null },
      ]);
      expect($("approvedKpiTotal").textContent).toBe("1.003");
    });

    it("busca a abertura inteira numa chamada só (abrir_lista_aprovados)", async () => {
      const supabase = supabaseFalso();
      await montar({ supabase });
      expect(supabase.rpc.mock.calls.map(([nome]) => nome)).toEqual([
        "abrir_lista_aprovados",
      ]);
      expect(supabase.rpc).toHaveBeenCalledWith("abrir_lista_aprovados", {
        p_area: "saude-indigena",
        p_versao: null,
        p_com_candidatos: true,
      });
    });

    it("sem a função por área no banco, usa a de antes (todas as áreas)", async () => {
      const supabase = supabaseFalso({ porArea: false });
      await montar({ supabase });
      // Banco antigo: sem a abertura numa chamada, nem o pacote por área.
      expect(chamadasDoPacote(supabase)).toEqual([
        { p_area: "saude-indigena", p_versao: null },
        { p_area: "saude-indigena", p_versao: null },
        undefined,
      ]);
      expect(supabase.rpc).toHaveBeenCalledWith("listar_listas_aprovados");
      // A tela recorta pela área, como sempre: os 4 são de editais da área
      // (3 na lista de trabalho; o da lista inativa, no Histórico).
      expect($("approvedKpiTotal").textContent).toBe("3");
    });

    it("avisa o erro de carregamento", async () => {
      const toast = vi.fn();
      await montar({
        supabase: supabaseFalso({
          erros: { listar_listas_aprovados: "sem rede" },
        }),
        toast,
      });
      expect(toast).toHaveBeenCalledWith(
        "Erro ao carregar lista de aprovados: sem rede",
        "error",
      );
    });

    it("anuncia a carga para o resto do app", async () => {
      const ouvinte = vi.fn();
      document.addEventListener("agsus:listas-aprovados-loaded", ouvinte);
      await montar();
      document.removeEventListener("agsus:listas-aprovados-loaded", ouvinte);
      expect(ouvinte).toHaveBeenCalledTimes(1);
      expect(definido(ouvinte.mock.calls[0])[0].detail.lists).toHaveLength(2);
    });
  });

  describe("filtros e paginação", () => {
    it("abre filtros recolhidos, permite filtrar e limpa todo o recorte", async () => {
      await montar();
      const painel = definido(
        $("approvedFiltrosTitulo").closest<HTMLElement>(".ui-filtros"),
      );
      expect(painel.classList.contains("approved-filters")).toBe(true);
      expect(achar(".ui-filtros-corpo", painel).hidden).toBe(true);
      await clicar(achar('[data-acao="recolher-filtros"]', painel));
      expect(achar(".ui-filtros-corpo", painel).hidden).toBe(false);
      await clicar(opcaoDoFiltro("approvedFilterCargo", "Médico"));
      expect(nomes()).toEqual(["Bruno Lima"]);
      await clicar(achar('[data-acao="limpar-filtros"]', painel));
      expect(nomes()).toHaveLength(3);
    });
    it("filtra pela localidade do cargo e o Cargo passa a oferecer só os dela", async () => {
      // Sem localidade no texto do cargo, o filtro não aparece.
      await montar();
      expect(document.getElementById("approvedFilterLocalidade")).toBeNull();

      await montar({
        supabase: supabaseFalso({
          candidatos: [
            candidato({
              candidato_id: "ana",
              nome: "Ana Ribeiro",
              cargo: "Enfermeiro - Pacaraima/RR",
            }),
            candidato({
              candidato_id: "bruno",
              nome: "Bruno Lima",
              cargo: "Enfermeiro - Boa Vista/RR",
            }),
            candidato({
              candidato_id: "carla",
              nome: "Carla Souza",
              cargo: "Gerente de Saúde - PACARAIMA/RR",
            }),
            candidato({
              candidato_id: "diego",
              nome: "Diego Alves",
              cargo: "Médico",
            }),
          ],
        }),
      });
      expect(opcoesDoFiltro("approvedFilterLocalidade")).toEqual([
        "Boa Vista/RR",
        "Pacaraima/RR",
      ]);
      await clicar(opcaoDoFiltro("approvedFilterLocalidade", "Pacaraima/RR"));
      expect(nomes().sort()).toEqual(["Ana Ribeiro", "Carla Souza"]);
      expect(opcoesDoFiltro("approvedFilterCargo")).toEqual([
        "Enfermeiro - Pacaraima/RR",
        "Gerente de Saúde - PACARAIMA/RR",
      ]);
    });
    it("escolher um edital encolhe os cargos e descarta o cargo que sumiu", async () => {
      // Os dois editais com lista ativa (os dois na lista de trabalho).
      await montar({
        supabase: supabaseFalso({
          candidatos: CANDIDATOS().map((c) => ({ ...c, lista_ativa: true })),
          listas: [LISTA_ATIVA, { ...LISTA_INATIVA, ativo: true }],
        }),
      });
      expect(opcoesDoFiltro("approvedFilterCargo")).toEqual([
        "Dentista",
        "Enfermeiro",
        "Médico",
      ]);
      await clicar(opcaoDoFiltro("approvedFilterCargo", "Dentista"));
      expect(nomes()).toEqual(["Diego Alves"]);

      await clicar(
        opcaoDoFiltro("approvedFilterEdital", "03/2025 · DSEI Manaus"),
      );
      expect(opcoesDoFiltro("approvedFilterCargo")).toEqual([
        "Enfermeiro",
        "Médico",
      ]);
      // O Dentista era do outro edital: deixou de filtrar.
      expect(nomes()).toEqual(["Ana Ribeiro", "Bruno Lima", "Carla Souza"]);
      expect($("approvedCount").textContent).toBe("3 candidatos");
    });

    it("os indicadores ignoram o filtro de status", async () => {
      await montar();
      await clicar(opcaoDoFiltro("approvedFilterStatus", "Contratado"));
      expect(nomes()).toEqual(["Ana Ribeiro"]);
      expect($("approvedKpiTotal").textContent).toBe("3");
    });

    it("KPI clicável: filtra a Situação, marca o card e clicar de novo limpa", async () => {
      await montar();
      const alvo = (chave: string) =>
        achar<HTMLButtonElement>(
          `#approvedPanelAprovados [data-kpi="${chave}"] .ui-kpi-alvo`,
        );
      const contratado = alvo("contratado");
      // Botão nativo: recebe foco, e Enter/Espaço o acionam pelo navegador.
      expect(contratado.tagName).toBe("BUTTON");
      expect(contratado.type).toBe("button");
      contratado.focus();
      expect(document.activeElement).toBe(contratado);
      expect(contratado.getAttribute("aria-pressed")).toBe("false");

      await clicar(contratado);
      expect(nomes()).toEqual(["Ana Ribeiro"]);
      expect(contratado.getAttribute("aria-pressed")).toBe("true");
      expect(
        achar('#approvedPanelAprovados [data-kpi="contratado"]').classList,
      ).toContain("is-ativo");
      // Os números não mudam com o filtro de Situação.
      expect($("approvedKpiTotal").textContent).toBe("3");

      await clicar(contratado);
      expect(nomes()).toHaveLength(3);
      expect(contratado.getAttribute("aria-pressed")).toBe("false");
      expect(
        achar('#approvedPanelAprovados [data-kpi="contratado"]').classList,
      ).not.toContain("is-ativo");

      // Trocar de card troca o filtro; o Total o tira.
      await clicar(contratado);
      await clicar(alvo("desistente"));
      expect(contratado.getAttribute("aria-pressed")).toBe("false");
      expect(alvo("desistente").getAttribute("aria-pressed")).toBe("true");
      expect(alvo("total").hasAttribute("aria-pressed")).toBe(false);
      await clicar(alvo("total"));
      expect(nomes()).toHaveLength(3);
      expect(alvo("desistente").getAttribute("aria-pressed")).toBe("false");
    });

    it("rolagem contínua da TabelaInfinita: 50 por vez, sem paginação", async () => {
      const muitos = Array.from({ length: 120 }, (_, indice) =>
        candidato({ cargo: indice < 60 ? "Enfermeiro" : "Médico" }),
      );
      await montar({ supabase: supabaseFalso({ candidatos: muitos }) });
      const card = definido(
        $("approvedRows").closest<HTMLElement>(".ui-card.ui-tabela"),
      );
      expect(achar("#approvedTabelaTitulo", card).textContent).toBe(
        "Candidatos aprovados",
      );
      // A barra de páginas saiu: é a tabela das outras telas.
      expect(talvez("approvedPaginacao")).toBeNull();
      expect(document.querySelectorAll("#approvedRows tr")).toHaveLength(50);
      expect(achar("[data-tabela-mostrando]", card).textContent).toBe(
        "Mostrando 50 de 120 registros",
      );
      expect(achar("[data-tabela-contagem]", card).textContent).toBe(
        "120 candidatos",
      );

      await clicar(achar('[data-acao="carregar-mais"]', card));
      expect(document.querySelectorAll("#approvedRows tr")).toHaveLength(100);
      await clicar(achar('[data-acao="carregar-mais"]', card));
      expect(document.querySelectorAll("#approvedRows tr")).toHaveLength(120);
      expect(card.querySelector('[data-acao="carregar-mais"]')).toBeNull();
      expect(achar(".ui-tabela-status", card).textContent).toBe(
        "Todos os 120 registros do recorte foram carregados",
      );

      // Filtrar recomeça do topo, com 50 linhas.
      await clicar(opcaoDoFiltro("approvedFilterCargo", "Médico"));
      expect(document.querySelectorAll("#approvedRows tr")).toHaveLength(50);
      expect(achar("[data-tabela-contagem]", card).textContent).toBe(
        "60 de 120 candidatos",
      );
    });

    it("rolar até perto do fim carrega mais 50", async () => {
      const muitos = Array.from({ length: 80 }, () => candidato());
      await montar({ supabase: supabaseFalso({ candidatos: muitos }) });
      const caixa = definido(
        $("approvedRows").closest<HTMLElement>(".ui-tabela-rolagem"),
      );
      Object.defineProperties(caixa, {
        scrollHeight: { configurable: true, value: 1000 },
        clientHeight: { configurable: true, value: 400 },
      });
      caixa.scrollTop = 500;
      await act(async () => caixa.dispatchEvent(new Event("scroll")));
      expect(document.querySelectorAll("#approvedRows tr")).toHaveLength(80);
    });

    it("a busca da tabela procura pelo nome, e Limpar filtros a limpa", async () => {
      await montar();
      await digitar($("approvedBusca"), "bruno");
      expect(nomes()).toEqual(["Bruno Lima"]);
      // A busca é só da tabela: o contador do topo segue os filtros.
      expect($("approvedCount").textContent).toBe("3 candidatos");
      await digitar($("approvedBusca"), "ninguém com esse nome");
      expect($("approvedRows").textContent).toBe(
        "Nenhum resultado para os filtros aplicados.",
      );
      await clicar(
        achar(
          '[data-acao="limpar-filtros"]',
          $("approvedFiltrosTitulo").closest(".ui-filtros"),
        ),
      );
      expect($<HTMLInputElement>("approvedBusca").value).toBe("");
      expect(nomes()).toHaveLength(3);
    });

    it("ordena pelo cabeçalho (asc → desc → ordem da lista), com aria-sort", async () => {
      await montar();
      const original = nomes();
      const cabecalho = (rotulo: string) =>
        acharTodos("#page-approved thead th").find(
          (th) => th.textContent === rotulo,
        );
      const nome = definido(cabecalho("Nome"));
      expect(nome.getAttribute("aria-sort")).toBe("none");
      await clicar(achar("button.ui-ordenar", nome));
      expect(nome.getAttribute("aria-sort")).toBe("ascending");
      expect(nomes()).toEqual([...original].sort((a, b) => a.localeCompare(b)));
      await clicar(achar("button.ui-ordenar", nome));
      expect(nome.getAttribute("aria-sort")).toBe("descending");
      expect(nomes()).toEqual([...original].sort((a, b) => b.localeCompare(a)));
      await clicar(achar("button.ui-ordenar", nome));
      expect(nome.getAttribute("aria-sort")).toBe("none");
      expect(nomes()).toEqual(original);
      // "Ações" não ordena.
      expect(definido(cabecalho("Ações")).querySelector("button")).toBeNull();
    });

    it("o cabeçalho e o filtro dizem Situação, como nas outras telas", async () => {
      await montar();
      const cabecalhos = acharTodos("#approvedPanelAprovados thead th").map(
        (th) => th.textContent,
      );
      expect(cabecalhos).toEqual([
        "Nome",
        "Vaga",
        "Cargo",
        "Lotação",
        "Edital",
        "Modalidade",
        "Classificação",
        "Nota",
        "Situação",
        "Ações",
      ]);
      expect(achar('label[for="approvedFilterStatus"]').textContent).toBe(
        "Situação",
      );
    });

    it("clicar na linha (ou Enter nela) abre a gaveta; os botões da linha não", async () => {
      await montar();
      const ana = definido(linhaDe("Ana Ribeiro"));
      expect(ana.tabIndex).toBe(0);
      await clicar(achar("td:nth-child(2)", ana));
      expect(talvez("approvedCandidatoGaveta")).not.toBeNull();
    });

    it("sem candidato na área, a tabela diz isso", async () => {
      await montar({ supabase: supabaseFalso({ candidatos: [] }) });
      expect($("approvedRows").textContent).toBe(
        "Nenhum candidato aprovado nesta área.",
      );
    });
  });

  describe("ações por perfil", () => {
    it("lista inativa: a principal é Abrir e o status aparece bloqueado, com o motivo", async () => {
      await montar();
      await verHistorico();
      const status = await acaoDaLinha("Diego Alves", "status");
      expect(status?.getAttribute("role")).toBe("menuitem");
      expect(status?.disabled).toBe(true);
      expect(status?.textContent).toBe("Mudar status (lista inativa)");
      expect(
        achar(".ui-acoes-da-linha > button", linhaDe("Diego Alves"))
          .textContent,
      ).toBe("Abrir");
    });

    it("a principal tem nome e o resto fica em Mais ações, com nome acessível", async () => {
      await montar();
      const bruno = definido(linhaDe("Bruno Lima"));
      expect(achar(".ui-acoes-da-linha > button", bruno).textContent).toBe(
        "Mudar status",
      );
      expect(
        achar("[data-acao='abrir-menu']", bruno).getAttribute("aria-label"),
      ).toBe("Mais ações de Bruno Lima");
      expect(await maisAcoesDe("Bruno Lima")).toEqual(
        expect.arrayContaining([
          "Ver detalhes",
          "Carta de convocação",
          "Ver na Classificação",
        ]),
      );
      // Nenhum ícone solto na célula de ações.
      expect(bruno.querySelector(".approved-icone-acao")).toBeNull();
    });

    it("quem só consulta vê um traço, e não o botão de sub judice", async () => {
      await montar({ perfil: { perfil: "usuario" } });
      expect(
        document.querySelector('[data-approved-action="status"]'),
      ).toBeNull();
      expect(
        achar(".ui-acoes-da-linha > button", linhaDe("Ana Ribeiro"))
          .textContent,
      ).toBe("Abrir");
      expect(talvez("approvedAddSubJudiceBtn")).toBeNull();
    });

    it("o perfil é relido a cada abertura da página", async () => {
      await montar({ perfil: { perfil: "usuario" } });
      perfilAtual = { perfil: "contratador" };
      await esperar(() => definido(controlador).render());
      expect(
        document.querySelector('[data-approved-action="status"]'),
      ).not.toBeNull();
    });

    it("sem lista ativa, incluir sub judice fica desligado e diz porquê", async () => {
      await montar({ supabase: supabaseFalso({ listas: [LISTA_INATIVA] }) });
      const botao = $<HTMLButtonElement>("approvedAddSubJudiceBtn");
      expect(botao.disabled).toBe(true);
      expect(botao.title).toBe("É necessário ter uma lista ativa");
    });
  });

  describe("modal de status", () => {
    it("abre com os dados do candidato e exige matrícula para Contratado", async () => {
      const { supabase, toast } = await montar();
      await clicar(
        achar('[data-approved-action="status"]', linhaDe("Bruno Lima")),
      );
      expect($("approvedStatusCandidate").textContent).toBe(
        "Bruno Lima · Médico",
      );
      expect(document.activeElement).toBe($("approvedStatusSelect"));

      await escolher($("approvedStatusSelect"), "Contratado");
      expect($("approvedMatriculaHint").textContent).toBe(
        "Obrigatória para este status.",
      );
      expect($<HTMLInputElement>("approvedStatusMatricula").required).toBe(
        true,
      );

      supabase.rpc.mockClear();
      await clicar($("approvedStatusSave"));
      expect(toast).toHaveBeenCalledWith(
        "Informe a matrícula para Contratado ou Migração.",
        "warn",
      );
      expect(supabase.rpc).not.toHaveBeenCalled();
      // O que foi digitado continua lá.
      expect($<HTMLInputElement>("approvedStatusSelect").value).toBe(
        "Contratado",
      );
    });

    it("salva pela RPC, fecha e recarrega", async () => {
      const { supabase, toast } = await montar();
      await clicar(
        achar('[data-approved-action="status"]', linhaDe("Bruno Lima")),
      );
      await escolher($("approvedStatusSelect"), "Contratado");
      await digitar($("approvedStatusSei"), "00700.000001/2026-00");
      await digitar($("approvedStatusMatricula"), " 12345 ");

      supabase.rpc.mockClear();
      await clicar($("approvedStatusSave"));
      expect(supabase.rpc).toHaveBeenCalledWith(
        "alterar_status_aprovado_com_observacao",
        {
          p_observacao: null,
          p_candidato_id: "bruno",
          p_status: "Contratado",
          p_processo_sei: "00700.000001/2026-00",
          p_matricula: "12345",
        },
      );
      expect(talvez("approvedStatusModal")).toBeNull();
      expect(toast).toHaveBeenCalledWith("Status do candidato atualizado.");
      expect(supabase.rpc).toHaveBeenCalledWith(
        "abrir_lista_aprovados",
        expect.objectContaining({ p_area: "saude-indigena" }),
      );
    });

    it("Esc fecha e devolve o foco ao botão que abriu", async () => {
      await montar();
      const lapis = achar(
        '[data-approved-action="status"]',
        linhaDe("Bruno Lima"),
      );
      lapis.focus();
      await clicar(lapis);
      await teclar(document, "Escape");
      expect(talvez("approvedStatusModal")).toBeNull();
      expect(document.activeElement).toBe(lapis);
    });

    it("prende o foco dentro do modal", async () => {
      await montar();
      await clicar(
        achar('[data-approved-action="status"]', linhaDe("Bruno Lima")),
      );
      const salvar = $("approvedStatusSave");
      salvar.focus();
      await teclar(document, "Tab");
      // Do último controle, o Tab volta ao primeiro (o Fechar do cabeçalho).
      expect(document.activeElement?.textContent).toBe("Fechar");
    });
  });

  /*
  As ações não cobrem mais a tela: o botão da ação em curso mostra o andamento,
  e os das outras ficam desativados até ela terminar.
*/
  describe("anexos do candidato", () => {
    const ADMIN = { perfil: "admin" };
    const ANEXOS = () => [
      {
        anexo_id: "x1",
        candidato_id: "bruno",
        arquivo_nome: "termo.pdf",
        tamanho: 2048,
        incluido_em: "2026-09-28T12:00:00Z",
      },
    ];
    const pdf = (nome: string, tamanho = 1000, tipo = "application/pdf") =>
      new File([new Uint8Array(tamanho)], nome, { type: tipo });
    async function escolherArquivos(arquivos: File[]) {
      const campo = $("approvedStatusAnexos");
      Object.defineProperty(campo, "files", {
        configurable: true,
        value: arquivos,
      });
      await act(async () => {
        campo.dispatchEvent(new Event("change", { bubbles: true }));
      });
    }
    const botaoDeAnexos = async (nome: string) =>
      definido(await acaoDaLinha(nome, "anexos"));
    // A releitura depois de salvar não volta: o que aparecer veio da confirmação.
    function segurarRecarga(supabase: BancoFalso) {
      const responder = definido(supabase.rpc.getMockImplementation());
      supabase.rpc.mockImplementation((nome, ...resto) =>
        nome === "abrir_lista_aprovados"
          ? new Promise<never>(() => {})
          : responder(nome, ...resto),
      );
    }
    const abrirStatusDe = (nome: string) =>
      clicar(achar('[data-approved-action="status"]', linhaDe(nome)));

    it("com anexo, Mais ações tem Ver anexos (N); sem anexo, não tem", async () => {
      await montar({ supabase: supabaseFalso({ anexos: ANEXOS() }) });
      expect((await botaoDeAnexos("Bruno Lima")).textContent).toBe(
        "Ver anexos (1)",
      );
      expect(await acaoDaLinha("Ana Ribeiro", "anexos")).toBeNull();
    });

    it("abre o PDF que vem do banco numa aba nova", async () => {
      const aba = { mostrar: vi.fn(), fechar: vi.fn() };
      // O jsdom não implementa URL.createObjectURL.
      let pdfAberto = null as Blob | null;
      URL.createObjectURL = vi.fn((blob: Blob) => {
        pdfAberto = blob;
        return "blob:pdf";
      });
      URL.revokeObjectURL = vi.fn();
      const supabase = supabaseFalso({ anexos: ANEXOS() });
      await montar({ supabase, novaAba: () => aba, perfil: ADMIN });
      await clicar(await botaoDeAnexos("Bruno Lima"));
      expect($("approvedAnexosLista").textContent).toContain("termo.pdf");
      await clicar(
        achar('[data-approved-action="abrir-anexo"]', $("approvedAnexosModal")),
      );
      expect(supabase.rpc).toHaveBeenCalledWith(
        "baixar_anexo_candidato_aprovado",
        { p_anexo_id: "x1" },
      );
      expect(supabase.storage.from).not.toHaveBeenCalled();
      expect(aba.mostrar).toHaveBeenCalledWith("blob:pdf");
      expect(pdfAberto?.type).toBe("application/pdf");
      expect(await pdfAberto?.text()).toBe("%PDF-1.4");
    });

    it("pop-up bloqueado ao abrir o anexo: avisa em vez de falhar em silêncio", async () => {
      const aba = { mostrar: vi.fn(() => false), fechar: vi.fn() };
      URL.createObjectURL = vi.fn(() => "blob:pdf");
      URL.revokeObjectURL = vi.fn();
      const supabase = supabaseFalso({ anexos: ANEXOS() });
      const { toast } = await montar({
        supabase,
        novaAba: () => aba,
        perfil: ADMIN,
      });
      await clicar(await botaoDeAnexos("Bruno Lima"));
      await clicar(
        achar('[data-approved-action="abrir-anexo"]', $("approvedAnexosModal")),
      );
      expect(aba.mostrar).toHaveBeenCalledWith("blob:pdf");
      expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:pdf");
      expect(toast).toHaveBeenCalledWith(
        expect.stringContaining("bloqueou a aba do anexo"),
        "error",
      );
    });

    it("anexo com arquivo inválido: fecha a aba em branco e avisa", async () => {
      const aba = { mostrar: vi.fn(), fechar: vi.fn() };
      URL.createObjectURL = vi.fn(() => "blob:pdf");
      URL.revokeObjectURL = vi.fn();
      const supabase = supabaseFalso({ anexos: ANEXOS() });
      const responder = supabase.rpc.getMockImplementation();
      supabase.rpc.mockImplementation(
        async (nome: string, args?: Record<string, unknown>) =>
          nome === "baixar_anexo_candidato_aprovado"
            ? {
                data: {
                  arquivo_nome: "termo.pdf",
                  arquivo_base64: "@@não é base64@@",
                },
                error: null,
              }
            : responder!(nome, args),
      );
      const { toast } = await montar({
        supabase,
        novaAba: () => aba,
        perfil: ADMIN,
      });
      await clicar(await botaoDeAnexos("Bruno Lima"));
      await clicar(
        achar('[data-approved-action="abrir-anexo"]', $("approvedAnexosModal")),
      );
      expect(aba.mostrar).not.toHaveBeenCalled();
      expect(aba.fechar).toHaveBeenCalled();
      expect(toast).toHaveBeenCalledWith(
        expect.stringContaining("Erro ao abrir o anexo"),
        "error",
      );
    });

    it("duplo clique no anexo abre uma aba só", async () => {
      const abas: {
        mostrar: Mock<(url: string) => void>;
        fechar: Mock<() => void>;
      }[] = [];
      URL.createObjectURL = vi.fn(() => "blob:pdf");
      URL.revokeObjectURL = vi.fn();
      const supabase = supabaseFalso({ anexos: ANEXOS() });
      await montar({
        supabase,
        novaAba: () => {
          const aba = { mostrar: vi.fn(), fechar: vi.fn() };
          abas.push(aba);
          return aba;
        },
        perfil: ADMIN,
      });
      await clicar(await botaoDeAnexos("Bruno Lima"));
      const abrir = achar(
        '[data-approved-action="abrir-anexo"]',
        $("approvedAnexosModal"),
      );
      await act(async () => {
        (abrir as HTMLElement).click();
        (abrir as HTMLElement).click();
      });
      expect(abas).toHaveLength(1);
      expect(
        supabase.rpc.mock.calls.filter(
          ([n]) => n === "baixar_anexo_candidato_aprovado",
        ),
      ).toHaveLength(1);
    });

    it("remove o anexo pela RPC, com o arquivo junto", async () => {
      const supabase = supabaseFalso({ anexos: ANEXOS() });
      await montar({ supabase, perfil: ADMIN });
      await clicar(await botaoDeAnexos("Bruno Lima"));
      await clicar(
        achar(
          '[data-approved-action="remover-anexo"]',
          $("approvedAnexosModal"),
        ),
      );
      expect(supabase.rpc).toHaveBeenCalledWith(
        "remover_anexo_candidato_aprovado",
        { p_anexo_id: "x1" },
      );
      expect(supabase.storage.from).not.toHaveBeenCalled();
    });

    it("salvar o status grava cada PDF no banco, em base64", async () => {
      const supabase = supabaseFalso();
      const { toast } = await montar({ supabase, perfil: ADMIN });
      await abrirStatusDe("Bruno Lima");
      const conteudo = new File(
        ["%PDF-1.7 termo"],
        "Termo de desistência.pdf",
        {
          type: "application/pdf",
        },
      );
      await escolherArquivos([conteudo, pdf("b.pdf")]);
      expect($("approvedAnexosHint").textContent).toContain("2 de 5");
      await clicar($("approvedStatusSave"));

      expect(supabase.storage.from).not.toHaveBeenCalled();
      const registros = supabase.rpc.mock.calls.filter(
        ([nome]) => nome === "registrar_anexo_candidato_aprovado",
      );
      expect(registros).toHaveLength(2);
      expect(definido(registros[0])[1]).toEqual({
        p_candidato_id: "bruno",
        p_arquivo_nome: "Termo de desistência.pdf",
        p_arquivo_base64: btoa("%PDF-1.7 termo"),
      });
      expect(toast).toHaveBeenCalledWith(
        "Status atualizado e 2 anexo(s) enviados.",
      );
    });

    it("com 5 anexos, o campo não aceita mais arquivo", async () => {
      const cinco = Array.from({ length: 5 }, (_, i) => ({
        ...ANEXOS()[0],
        anexo_id: `a${i}`,
      }));
      await montar({
        supabase: supabaseFalso({ anexos: cinco }),
        perfil: ADMIN,
      });
      await abrirStatusDe("Bruno Lima");
      expect($<HTMLButtonElement>("approvedStatusAnexos").disabled).toBe(true);
      expect($("approvedAnexosHint").textContent).toContain("5 de 5");
    });

    it("recusa o que não é PDF e o maior que 2 MB, sem enviar", async () => {
      const supabase = supabaseFalso();
      await montar({ supabase, perfil: ADMIN });
      await abrirStatusDe("Bruno Lima");
      await escolherArquivos([pdf("foto.png", 10, "image/png")]);
      expect($("approvedStatusModal").textContent).toContain("não é PDF");
      expect($<HTMLButtonElement>("approvedStatusSave").disabled).toBe(true);

      await clicar(achar('[aria-label^="Tirar"]', $("approvedStatusModal")));
      await escolherArquivos([pdf("grande.pdf", 2 * 1024 * 1024 + 1)]);
      expect($("approvedStatusModal").textContent).toContain("passa de 2 MB");
      expect($<HTMLButtonElement>("approvedStatusSave").disabled).toBe(true);
      expect(supabase.rpc).not.toHaveBeenCalledWith(
        "registrar_anexo_candidato_aprovado",
        expect.anything(),
      );
    });

    it("status e anexos entram na linha sem esperar a releitura", async () => {
      const supabase = supabaseFalso();
      await montar({ supabase, perfil: ADMIN });
      segurarRecarga(supabase);
      await abrirStatusDe("Bruno Lima");
      await escolher($("approvedStatusSelect"), "Desistente");
      await escolherArquivos([pdf("termo.pdf"), pdf("rg.pdf")]);
      await clicar($("approvedStatusSave"));

      expect(supabase.rpc).toHaveBeenCalledWith(
        "abrir_lista_aprovados",
        expect.objectContaining({ p_area: "saude-indigena" }),
      );
      expect(achar(".approved-status", linhaDe("Bruno Lima")).textContent).toBe(
        "Desistente",
      );
      expect((await botaoDeAnexos("Bruno Lima")).textContent).toBe(
        "Ver anexos (2)",
      );
      // Os botões não esperam a releitura.
      await clicar(await botaoDeAnexos("Bruno Lima"));
      expect($("approvedAnexosLista").textContent).toContain("rg.pdf");
    });

    it("remover o anexo tira da linha na hora", async () => {
      const supabase = supabaseFalso({ anexos: ANEXOS() });
      await montar({ supabase, perfil: ADMIN });
      segurarRecarga(supabase);
      await clicar(await botaoDeAnexos("Bruno Lima"));
      await clicar(
        achar(
          '[data-approved-action="remover-anexo"]',
          $("approvedAnexosModal"),
        ),
      );
      expect($("approvedAnexosModal").textContent).toContain(
        "Nenhum anexo para este candidato.",
      );
      expect(await acaoDaLinha("Bruno Lima", "anexos")).toBeNull();
    });

    it("o contratador altera o status, mas não vê o campo de anexar", async () => {
      await montar();
      await abrirStatusDe("Bruno Lima");
      expect(talvez("approvedStatusSelect")).not.toBeNull();
      expect(talvez("approvedStatusAnexos")).toBeNull();
      expect($("approvedStatusModal").textContent).not.toContain(
        "Anexar documentos",
      );
    });

    it("o contratador vê os anexos, mas não remove", async () => {
      await montar({ supabase: supabaseFalso({ anexos: ANEXOS() }) });
      await clicar(await botaoDeAnexos("Bruno Lima"));
      expect($("approvedAnexosLista").textContent).toContain("termo.pdf");
      expect(
        $("approvedAnexosModal").querySelector(
          '[data-approved-action="abrir-anexo"]',
        ),
      ).not.toBeNull();
      expect(
        $("approvedAnexosModal").querySelector(
          '[data-approved-action="remover-anexo"]',
        ),
      ).toBeNull();
    });

    it("status já definido: o contratador vê o status bloqueado e o modal não abre", async () => {
      const { toast } = await montar();
      const bloqueado = definido(await acaoDaLinha("Ana Ribeiro", "status"));
      expect(bloqueado.disabled).toBe(true);
      expect(bloqueado.textContent).toBe(
        "Mudar status (status já definido: só o admin altera)",
      );
      // Mesmo chamado por fora (o legado), o estado recusa e diz porquê.
      await act(async () => definido(controlador).estado.abrirStatus("ana"));
      expect(talvez("approvedStatusModal")).toBeNull();
      expect(toast).toHaveBeenCalledWith(
        "O status já foi definido. Só o admin pode alterá-lo.",
        "warn",
      );
    });

    it("o admin anexa também a candidato com status já definido", async () => {
      const supabase = supabaseFalso();
      await montar({ supabase, perfil: ADMIN });
      await abrirStatusDe("Ana Ribeiro");
      expect(talvez("approvedStatusAnexos")).not.toBeNull();
      await escolherArquivos([pdf("contrato.pdf")]);
      await clicar($("approvedStatusSave"));
      expect(supabase.rpc).toHaveBeenCalledWith(
        "registrar_anexo_candidato_aprovado",
        expect.objectContaining({ p_candidato_id: "ana" }),
      );
    });

    it("o admin continua alterando um status já definido", async () => {
      await montar({ perfil: { perfil: "admin" } });
      await abrirStatusDe("Ana Ribeiro");
      expect($("approvedStatusTitle").textContent).toBe(
        "Alterar status do candidato",
      );
      expect($<HTMLSelectElement>("approvedStatusSelect").disabled).toBe(false);
    });

    it("registro recusado pelo banco avisa qual arquivo não entrou", async () => {
      const supabase = supabaseFalso({
        erros: { registrar_anexo_candidato_aprovado: "limite" },
      });
      const { toast } = await montar({ supabase, perfil: ADMIN });
      await abrirStatusDe("Bruno Lima");
      await escolherArquivos([pdf("a.pdf")]);
      await clicar($("approvedStatusSave"));
      expect(await acaoDaLinha("Bruno Lima", "anexos")).toBeNull();
      expect(toast).toHaveBeenCalledWith(
        "Status atualizado, mas 1 anexo(s) não foram enviados. a.pdf: limite",
        "error",
      );
    });
  });

  describe("ações sem tela de carregamento", () => {
    function supabaseQueEspera(rpcDemorada: string) {
      const supabase = supabaseFalso();
      const responder = definido(supabase.rpc.getMockImplementation());
      let concluir = () => {};
      supabase.rpc.mockImplementation((nome, ...resto) => {
        if (nome !== rpcDemorada) return responder(nome, ...resto);
        return new Promise<RespostaDoTeste>((resolver) => {
          concluir = () => resolver({ data: { ok: true }, error: null });
        });
      });
      return { supabase, concluir: () => concluir() };
    }
    const removerDaCarla = async () =>
      definido(await acaoDaLinha("Carla Souza", "remove-subjudice"));
    const terminar = (concluir: () => void) =>
      esperar(async () => {
        concluir();
        await new Promise((resolver) => setTimeout(resolver, 0));
      });

    it("o botão mostra o andamento e as outras ações esperam", async () => {
      const { supabase, concluir } = supabaseQueEspera(
        "alterar_status_aprovado_com_observacao",
      );
      await montar({ supabase });
      await clicar(
        achar('[data-approved-action="status"]', linhaDe("Bruno Lima")),
      );
      await escolher($("approvedStatusSelect"), "Desistente");
      await clicar($("approvedStatusSave"));

      const salvar = $<HTMLButtonElement>("approvedStatusSave");
      expect(salvar.disabled).toBe(true);
      expect(salvar.getAttribute("aria-busy")).toBe("true");
      expect(salvar.textContent).toContain("Salvando…");
      expect((await removerDaCarla()).disabled).toBe(true);

      await terminar(concluir);
      expect(talvez("approvedStatusModal")).toBeNull();
      expect((await removerDaCarla()).disabled).toBe(false);
    });

    it("no menu da linha, Remover sub judice diz Removendo… enquanto grava", async () => {
      const { supabase, concluir } = supabaseQueEspera("remover_sub_judice");
      await montar({ supabase });
      await clicar(await removerDaCarla());
      const item = await removerDaCarla();
      expect(item.textContent).toBe("Removendo…");
      expect(item.disabled).toBe(true);
      await terminar(concluir);
      expect((await removerDaCarla()).textContent).toBe("Remover sub judice");
    });

    it("com uma ação em curso, a segunda não sai para a rede", async () => {
      const { supabase, concluir } = supabaseQueEspera("remover_sub_judice");
      await montar({ supabase });
      await clicar(await removerDaCarla());
      await esperar(() =>
        definido(controlador).estado.removerSubJudice("carla"),
      );
      expect(
        supabase.rpc.mock.calls.filter(
          ([nome]) => nome === "remover_sub_judice",
        ),
      ).toHaveLength(1);
      await terminar(concluir);
    });
  });

  describe("sub judice", () => {
    it("inclui pela RPC, com a nota em formato brasileiro", async () => {
      const { supabase } = await montar();
      await clicar($("approvedAddSubJudiceBtn"));
      // Só a lista ativa recebe sub judice.
      expect(
        [...$<HTMLSelectElement>("subJudiceEdital").options].map(
          (opcao) => opcao.value,
        ),
      ).toEqual(["10"]);
      expect(
        [...$<HTMLSelectElement>("subJudiceCargo").options].map(
          (opcao) => opcao.value,
        ),
      ).toEqual(["Enfermeiro", "Médico"]);
      await digitar($("subJudiceNome"), "Elza Martins");
      await escolher($("subJudiceCargo"), "Médico");
      await digitar($("subJudiceNota"), "87,5");

      supabase.rpc.mockClear();
      await clicar($("subJudiceSave"));
      expect(supabase.rpc).toHaveBeenCalledWith("incluir_sub_judice", {
        p_edital_id: "10",
        p_cargo: "Médico",
        p_nome: "Elza Martins",
        p_nota: 87.5,
        p_modalidade: null,
        p_processo: null,
        p_observacao: null,
      });
      expect(talvez("subJudiceModal")).toBeNull();
    });

    it("recusa nota inválida sem chamar o banco", async () => {
      const { supabase, toast } = await montar();
      await clicar($("approvedAddSubJudiceBtn"));
      await digitar($("subJudiceNome"), "Elza Martins");
      await digitar($("subJudiceNota"), "abc");
      supabase.rpc.mockClear();
      await clicar($("subJudiceSave"));
      expect(supabase.rpc).not.toHaveBeenCalled();
      expect(toast).toHaveBeenCalledWith(
        "Preencha edital, cargo, nome e uma nota válida.",
        "warn",
      );
    });

    it("remover pede confirmação citando a pessoa", async () => {
      const confirmar = vi.fn((_mensagem: string) => true);
      const { supabase } = await montar({ confirmar });
      await clicar(await acaoDaLinha("Carla Souza", "remove-subjudice"));
      expect(definido(confirmar.mock.calls[0])[0]).toContain("Carla Souza");
      expect(supabase.rpc).toHaveBeenCalledWith("remover_sub_judice", {
        p_candidato_id: "carla",
      });
    });

    it("sem confirmação, nada acontece", async () => {
      const { supabase } = await montar({ confirmar: () => false });
      supabase.rpc.mockClear();
      await clicar(await acaoDaLinha("Carla Souza", "remove-subjudice"));
      expect(supabase.rpc).not.toHaveBeenCalled();
    });
  });

  describe("sub judice: candidato já aprovado (decisão judicial)", () => {
    const ADMIN = { perfil: "admin" };
    const martelo = (nome: string) => acaoDaLinha(nome, "alteracao-judicial");
    /* Tirou 33, a Justiça deu 40: o banco já guardou o resultado publicado. */
    const ALTERADA = () =>
      candidato({
        candidato_id: "elza",
        nome: "Elza Martins",
        nota: 40,
        sub_judice: true,
        alterado_judicialmente: true,
        nota_original: 33,
        modalidade_original: "Ampla concorrência",
        classificacao_original: 7,
      });

    it("o editor só vê a aba de novo candidato e nenhum martelo", async () => {
      await montar();
      expect(await martelo("Ana Ribeiro")).toBeNull();
      await clicar($("approvedAddSubJudiceBtn"));
      expect(talvez("subJudiceTabAprovado")).toBeNull();
      expect(talvez("subJudicePainelAprovado")).toBeNull();
      expect(talvez("subJudiceSave")).not.toBeNull();
    });

    it("o admin escolhe edital, cargo e candidato e registra a nota nova", async () => {
      const { supabase } = await montar({ perfil: ADMIN });
      await clicar($("approvedAddSubJudiceBtn"));
      await clicar($("subJudiceTabAprovado"));
      expect($("subJudiceTabAprovado").getAttribute("aria-selected")).toBe(
        "true",
      );
      await escolher($("subJudiceAprovadoCargo"), "Médico");
      expect(
        [...$<HTMLSelectElement>("subJudiceAprovadoCandidato").options].map(
          (opcao) => opcao.value,
        ),
      ).toEqual(["", "bruno"]);
      await escolher($("subJudiceAprovadoCandidato"), "bruno");
      // Começa com a nota e a modalidade atuais.
      expect($<HTMLInputElement>("alteracaoJudicialNota").value).toBe("90,5");
      expect($<HTMLInputElement>("alteracaoJudicialModalidade").value).toBe(
        "Pessoa negra",
      );
      await digitar($("alteracaoJudicialNota"), "95");
      await digitar(
        $("alteracaoJudicialProcesso"),
        "1000000-00.2026.4.01.3400",
      );

      supabase.rpc.mockClear();
      await clicar($("alteracaoJudicialSalvar"));
      expect(supabase.rpc).toHaveBeenCalledWith(
        "alterar_candidato_sub_judice",
        {
          p_candidato_id: "bruno",
          p_nota: 95,
          p_modalidade: null,
          p_processo: "1000000-00.2026.4.01.3400",
          p_observacao: null,
        },
      );
      expect(talvez("subJudiceModal")).toBeNull();
    });

    it("muda só a modalidade, sem mandar a nota", async () => {
      const { supabase } = await montar({ perfil: ADMIN });
      await clicar(await martelo("Ana Ribeiro"));
      await escolher($("alteracaoJudicialModalidade"), "Pessoa negra");
      supabase.rpc.mockClear();
      await clicar($("alteracaoJudicialSalvar"));
      expect(supabase.rpc).toHaveBeenCalledWith(
        "alterar_candidato_sub_judice",
        expect.objectContaining({
          p_candidato_id: "ana",
          p_nota: null,
          p_modalidade: "Pessoa negra",
        }),
      );
    });

    it("o martelo da linha abre na aba do candidato já aprovado, com ele escolhido", async () => {
      await montar({ perfil: ADMIN });
      await clicar(await martelo("Ana Ribeiro"));
      expect($("subJudiceTabAprovado").getAttribute("aria-selected")).toBe(
        "true",
      );
      expect($("subJudicePainelNovo").classList.contains("hidden")).toBe(true);
      expect($<HTMLInputElement>("subJudiceAprovadoCandidato").value).toBe(
        "ana",
      );
    });

    it("sem mudar nota nem modalidade, não sai para o banco", async () => {
      const { supabase, toast } = await montar({ perfil: ADMIN });
      await clicar(await martelo("Ana Ribeiro"));
      supabase.rpc.mockClear();
      await clicar($("alteracaoJudicialSalvar"));
      expect(supabase.rpc).not.toHaveBeenCalled();
      expect(toast).toHaveBeenCalledWith(
        "Informe uma nota ou modalidade diferente da atual.",
        "warn",
      );
    });

    it("o alterado mostra 33 → 40 e não tem o botão de remover", async () => {
      await montar({
        supabase: supabaseFalso({ candidatos: [...CANDIDATOS(), ALTERADA()] }),
      });
      const linha = linhaDe("Elza Martins");
      expect(achar(".approved-de-para s", linha).textContent).toBe("33");
      expect(achar(".approved-de-para strong", linha).textContent).toBe("40");
      expect(
        definido(linha).querySelector(
          '[data-approved-action="remove-subjudice"]',
        ),
      ).toBeNull();
    });

    it("o admin desfaz a alteração, com confirmação", async () => {
      const confirmar = vi.fn((_mensagem: string) => true);
      const { supabase } = await montar({
        perfil: ADMIN,
        confirmar,
        supabase: supabaseFalso({ candidatos: [...CANDIDATOS(), ALTERADA()] }),
      });
      await clicar(await martelo("Elza Martins"));
      expect(achar(".approved-decisao-original").textContent).toContain("33");
      supabase.rpc.mockClear();
      await clicar($("alteracaoJudicialDesfazer"));
      expect(definido(confirmar.mock.calls[0])[0]).toContain("Elza Martins");
      expect(supabase.rpc).toHaveBeenCalledWith(
        "desfazer_alteracao_sub_judice",
        {
          p_candidato_id: "elza",
          p_observacao: null,
        },
      );
    });
  });

  describe("modal de listas do edital", () => {
    const abrir = (editalId = "10") =>
      esperar(() =>
        definido(controlador).openImportModal(
          editalId,
          "03/2025 · DSEI Manaus",
        ),
      );

    it("sem permissão, não abre e avisa", async () => {
      const { toast } = await montar({ perfil: { perfil: "usuario" } });
      await abrir();
      expect(talvez("approvedImportModal")).toBeNull();
      expect(toast).toHaveBeenCalledWith(
        "Sem permissão para gerir lista de aprovados.",
        "warn",
      );
    });

    it("abre por cima de qualquer página, mesmo com a de aprovados escondida", async () => {
      await montar({ secaoAtiva: false, carregar: false });
      await abrir();
      const modal = $("approvedImportModal");
      expect(modal.parentElement).toBe(document.body);
      expect($("approvedImportEdital").textContent).toBe(
        "03/2025 · DSEI Manaus",
      );
    });

    it("para quem não é admin, a lista importada é só ativar/inativar", async () => {
      await montar({ perfil: { perfil: "edital_gestor" } });
      await abrir();
      expect($("approvedImportCurrentState").textContent).toContain(
        "aprovados-03-2025.xlsx",
      );
      expect($("approvedImportFileRow").classList.contains("hidden")).toBe(
        true,
      );
      expect(talvez("approvedImportSubmit")).toBeNull();
      expect(talvez("approvedImportRemove")).toBeNull();
      expect($("approvedImportPermissionNote").textContent).toContain(
        "Só admin substitui ou remove o XLSX.",
      );
    });

    it("o admin pode substituir e remover", async () => {
      await montar({ perfil: { perfil: "admin" } });
      await abrir();
      expect(talvez("approvedImportPermissionNote")).toBeNull();
      expect($("approvedImportSubmit").textContent).toContain(
        "Substituir XLSX",
      );
      expect(talvez("approvedImportRemove")).not.toBeNull();
      expect(
        document.querySelector(".approved-import-replace-warning"),
      ).not.toBeNull();
    });

    it("edital sem lista oferece a importação e o modelo de planilha", async () => {
      await montar();
      await abrir("99");
      expect($("approvedImportCurrentState").textContent).toBe(
        "Sem lista importada",
      );
      expect($("approvedImportSubmit").textContent).toContain("Importar lista");
      expect(talvez("approvedImportDownloadCurrent")).toBeNull();
      const modelo = $("approvedImportModelLink");
      expect(modelo.getAttribute("href")).toBe(
        PLANILHAS.modeloListaAprovados.url,
      );
      expect(modelo.getAttribute("download")).toBe(
        PLANILHAS.modeloListaAprovados.nomeDoArquivo,
      );
    });

    it("aplica a situação escolhida pela RPC", async () => {
      const { supabase } = await montar();
      await abrir();
      expect($<HTMLInputElement>("approvedImportActive").value).toBe("true");
      await escolher($("approvedImportActive"), "false");
      supabase.rpc.mockClear();
      await clicar($("approvedImportToggleActive"));
      expect(supabase.rpc).toHaveBeenCalledWith(
        "definir_lista_aprovados_ativa",
        {
          p_lista_id: "L10",
          p_ativo: false,
        },
      );
      // Continua aberto, para a pessoa ver o resultado.
      expect(talvez("approvedImportModal")).not.toBeNull();
    });

    it("importa: lê o XLSX, anexa no bucket e grava os candidatos", async () => {
      const supabase = supabaseFalso();
      const lerPlanilha = vi.fn(async () => [{ nome: "X" }, { nome: "Y" }]);
      const mudou = vi.fn();
      document.addEventListener("agsus:listas-aprovados-changed", mudou);
      const { toast } = await montar({ supabase, lerPlanilha });
      await abrir("99");

      const arquivo = new File(["x"], "Lista Açaí 2026.xlsx");
      Object.defineProperty($("approvedImportFile"), "files", {
        value: [arquivo],
      });
      supabase.rpc.mockClear();
      await clicar($("approvedImportSubmit"));
      document.removeEventListener("agsus:listas-aprovados-changed", mudou);

      expect(lerPlanilha).toHaveBeenCalledWith(arquivo);
      expect(supabase.storage.from).toHaveBeenCalledWith(
        PLANILHAS.listaAprovadosImportada.bucket,
      );
      const [caminho] = definido(supabase.bucket.upload.mock.calls[0]);
      expect(caminho).toMatch(/^99\/\d+-.+-Lista-Acai-2026\.xlsx$/);
      expect(supabase.rpc).toHaveBeenCalledWith("pedir_casamento_da_lista", {
        p_edital: "99",
        p_origem: "XLSX",
        p_candidatos: [{ nome: "X" }, { nome: "Y" }],
        p_arquivo_nome: "Lista Açaí 2026.xlsx",
      });
      expect(supabase.rpc).toHaveBeenCalledWith("aplicar_casamento_da_lista", {
        p_pedido: "99999999-9999-4999-8999-999999999999",
        p_motivo: null,
        p_ativo: true,
        p_arquivo_path: caminho,
      });
      expect(toast).toHaveBeenCalledWith(
        "2 candidato(s) importados com sucesso.",
      );
      expect(talvez("approvedImportModal")).toBeNull();
      expect(mudou).toHaveBeenCalledTimes(1);
    });

    it("sem arquivo, ou grande demais, avisa sem enviar nada", async () => {
      const supabase = supabaseFalso();
      const { toast } = await montar({ supabase });
      await abrir("99");
      await clicar($("approvedImportSubmit"));
      expect(toast).toHaveBeenLastCalledWith(
        "Selecione o arquivo XLSX.",
        "warn",
      );

      const grande = new File(["x"], "grande.xlsx");
      Object.defineProperty(grande, "size", { value: 11 * 1024 * 1024 });
      Object.defineProperty($("approvedImportFile"), "files", {
        value: [grande],
      });
      await clicar($("approvedImportSubmit"));
      expect(toast).toHaveBeenLastCalledWith(
        "O XLSX deve ter no máximo 10 MB.",
        "warn",
      );
      expect(supabase.bucket.upload).not.toHaveBeenCalled();
    });

    it("remover a lista pede confirmação e avisa o resto do app", async () => {
      const confirmar = vi.fn((_mensagem: string) => true);
      const { supabase } = await montar({
        perfil: { perfil: "admin" },
        confirmar,
      });
      await abrir();
      supabase.rpc.mockClear();
      await clicar($("approvedImportRemove"));
      expect(confirmar).toHaveBeenCalledTimes(1);
      expect(definido(confirmar.mock.calls[0])[0]).toContain(
        "os contratados do edital voltam a zero",
      );
      expect(supabase.rpc).toHaveBeenCalledWith("remover_lista_aprovados", {
        p_lista_id: "L10",
      });
    });

    it("baixa o XLSX atual do bucket", async () => {
      const supabase = supabaseFalso();
      await montar({ supabase });
      const baixados: string[] = [];
      const original = URL.createObjectURL;
      URL.createObjectURL = () => "blob:falso";
      const clique = vi
        .spyOn(HTMLAnchorElement.prototype, "click")
        .mockImplementation(function (this: HTMLAnchorElement) {
          baixados.push(this.download);
        });
      await abrir();
      await clicar($("approvedImportDownloadCurrent"));
      clique.mockRestore();
      URL.createObjectURL = original;
      expect(supabase.bucket.download).toHaveBeenCalledWith("10/arquivo.xlsx");
      expect(baixados).toEqual(["aprovados-03-2025.xlsx"]);
    });

    describe("substituir o XLSX: prévia do casamento (job Python) antes de confirmar", () => {
      const PEDIDO = "11111111-1111-4111-8111-111111111111";
      const ANA = "22222222-2222-4222-8222-222222222222";
      const BRUNO = "33333333-3333-4333-8333-333333333333";
      const PAULO = "44444444-4444-4444-8444-444444444444";
      const linha = (classificacao: number, nota: number, nome: string) => ({
        codigo_vaga: "VG-1",
        cargo: "Enfermeiro",
        classificacao,
        nota,
        nome,
        modalidade: "AC",
      });
      const PLANILHA = [
        linha(1, 90, "ANA RIBEIRO"),
        linha(2, 80, "Bruno  Lima"),
        linha(3, 70, "Nova Pessoa"),
      ];
      // O plano como o job Python grava (python/monitora/aprovados/casamento.py).
      const casamento = (extra: Record<string, unknown> = {}) => ({
        pedido_id: PEDIDO,
        origem: "XLSX",
        situacao: "CALCULADO",
        erro: null,
        disparo: "ACEITO",
        exige_motivo: true,
        pode_substituir: true,
        anteriores: 4,
        novos_total: 3,
        manuais: {},
        plano: {
          versao: 1,
          vinculos: [
            { candidato_id: ANA, chave: "1", forma: "NOME" },
            { candidato_id: BRUNO, chave: "2", forma: "NOME" },
          ],
          resumo: {
            casados: 2,
            entram: 1,
            sem_par: 1,
            sem_dono: 1,
            preservados: 1,
            mudam: 0,
            sub_judice_mantidos: 1,
            ambiguos: 0,
          },
          pendencias: [
            {
              candidato_id: PAULO,
              nome: "Paulo Fora",
              codigo_vaga: "VG-1",
              status: "Desistente",
            },
          ],
          mudam: [],
          revisar: [PAULO],
        },
        novos: null,
        revisar: [],
        ...extra,
      });
      function comCasamento(
        supabase: BancoFalso,
        respostas: Record<string, unknown>[] = [casamento()],
      ) {
        const original = definido(supabase.rpc.getMockImplementation());
        const fila = [...respostas];
        supabase.rpc.mockImplementation((nome, argumentos) => {
          if (nome === "pedir_casamento_da_lista")
            return Promise.resolve({
              data: { pedido_id: PEDIDO, situacao: "PENDENTE" },
              error: null,
            });
          if (nome === "obter_casamento_da_lista")
            return Promise.resolve({
              data: structuredClone(fila.length > 1 ? fila.shift() : fila[0]),
              error: null,
            });
          if (nome === "aplicar_casamento_da_lista")
            return Promise.resolve({
              data: { ok: true, candidatos: 3, preservados: 1, pendencias: [] },
              error: null,
            });
          return original(nome, argumentos);
        });
        return supabase;
      }
      const escolherArquivo = () =>
        Object.defineProperty($("approvedImportFile"), "files", {
          value: [new File(["x"], "nova.xlsx")],
        });
      const kpi = (chave: string) =>
        achar(`#approvedImportPrevia [data-kpi='${chave}'] .ui-kpi-valor`)
          .textContent;

      it("o aviso diz o que é preservado ao substituir", async () => {
        await montar({ perfil: { perfil: "admin" } });
        await abrir();
        expect(achar("[data-aviso-substituicao]").textContent).toContain(
          "Substituir mantém status, matrícula, convocação, sub judice e anexos",
        );
      });

      it("pede o casamento ao banco, espera o job e mostra o plano, sem gravar nada", async () => {
        const pendente = { ...casamento(), situacao: "PENDENTE", plano: null };
        const supabase = comCasamento(supabaseFalso(), [
          pendente,
          pendente,
          casamento(),
        ]);
        const esperar = vi.fn(async () => {});
        await montar({
          perfil: { perfil: "admin" },
          supabase,
          lerPlanilha: async () => PLANILHA,
          esperar,
        });
        await abrir();
        escolherArquivo();
        supabase.rpc.mockClear();
        await clicar($("approvedImportSubmit"));
        expect(supabase.rpc).toHaveBeenCalledWith("pedir_casamento_da_lista", {
          p_edital: "10",
          p_origem: "XLSX",
          p_candidatos: PLANILHA,
          p_arquivo_nome: "nova.xlsx",
        });
        expect(
          supabase.rpc.mock.calls.filter(
            ([nome]) => nome === "obter_casamento_da_lista",
          ),
        ).toHaveLength(3);
        expect(esperar).toHaveBeenCalledTimes(2);
        expect(supabase.bucket.upload).not.toHaveBeenCalled();
        expect(supabase.rpc).not.toHaveBeenCalledWith(
          "aplicar_casamento_da_lista",
          expect.anything(),
        );
        expect(kpi("casados")).toBe("2");
        expect(kpi("entram")).toBe("1");
        expect(kpi("sem-par")).toBe("1");
        expect(kpi("sem-dono")).toBe("1");
        expect(kpi("sub-judice")).toBe("1");
        expect(achar(".approved-import-sem-dono").textContent).toContain(
          "Paulo Fora",
        );
        expect(talvez("approvedImportMotivo")).not.toBeNull();
        // Cancelar volta ao botão de substituir.
        await clicar($("approvedImportCancelPrevia"));
        expect(talvez("approvedImportPrevia")).toBeNull();
        expect(talvez("approvedImportSubmit")).not.toBeNull();
      });

      it("confirma: anexa o XLSX e o banco aplica o plano, com o motivo", async () => {
        const supabase = comCasamento(supabaseFalso());
        const lerPlanilha = vi.fn(async () => PLANILHA);
        const { toast } = await montar({
          perfil: { perfil: "admin" },
          supabase,
          lerPlanilha,
        });
        await abrir();
        escolherArquivo();
        await clicar($("approvedImportSubmit"));
        await clicar($("approvedImportConfirm"));
        expect(toast).toHaveBeenCalledWith(
          expect.stringContaining("motivo da substituição"),
          "warn",
        );
        await digitar(
          $("approvedImportMotivo"),
          "Planilha corrigida pela banca",
        );
        supabase.rpc.mockClear();
        await clicar($("approvedImportConfirm"));
        // A planilha é lida uma vez só: a confirmação usa a da prévia.
        expect(lerPlanilha).toHaveBeenCalledTimes(1);
        const [caminho] = definido(supabase.bucket.upload.mock.calls[0]);
        expect(supabase.rpc).toHaveBeenCalledWith(
          "aplicar_casamento_da_lista",
          {
            p_pedido: PEDIDO,
            p_motivo: "Planilha corrigida pela banca",
            p_ativo: true,
            p_arquivo_path: caminho,
          },
        );
        expect(toast).toHaveBeenCalledWith(
          "3 candidato(s) importados; 1 com status, matrícula ou sub judice preservados.",
        );
        expect(talvez("approvedImportModal")).toBeNull();
      });

      it("lista sem status: não pede motivo", async () => {
        const supabase = comCasamento(supabaseFalso(), [
          casamento({ exige_motivo: false }),
        ]);
        await montar({
          perfil: { perfil: "admin" },
          supabase,
          lerPlanilha: async () => PLANILHA,
        });
        await abrir();
        escolherArquivo();
        await clicar($("approvedImportSubmit"));
        expect(talvez("approvedImportMotivo")).toBeNull();
        supabase.rpc.mockClear();
        await clicar($("approvedImportConfirm"));
        expect(supabase.rpc).toHaveBeenCalledWith(
          "aplicar_casamento_da_lista",
          expect.objectContaining({ p_pedido: PEDIDO, p_motivo: null }),
        );
      });

      it("o pedido não chegou ao GitHub: avisa e não mostra prévia", async () => {
        const supabase = comCasamento(supabaseFalso(), [
          {
            ...casamento(),
            situacao: "PENDENTE",
            plano: null,
            disparo: "SEM_TOKEN",
          },
        ]);
        const { toast } = await montar({
          perfil: { perfil: "admin" },
          supabase,
          lerPlanilha: async () => PLANILHA,
        });
        await abrir();
        escolherArquivo();
        await clicar($("approvedImportSubmit"));
        expect(talvez("approvedImportPrevia")).toBeNull();
        expect(toast).toHaveBeenCalledWith(
          "O pedido do cálculo do casamento não chegou ao GitHub.",
          "warn",
        );
      });

      it("a lista mudou depois da prévia (PT409): avisa para conferir de novo", async () => {
        const supabase = comCasamento(supabaseFalso(), [
          casamento({ exige_motivo: false }),
        ]);
        const original = definido(supabase.rpc.getMockImplementation());
        supabase.rpc.mockImplementation((nome, argumentos) =>
          nome === "aplicar_casamento_da_lista"
            ? Promise.resolve({
                data: null,
                error: { code: "PT409", message: "mudou" },
              })
            : original(nome, argumentos),
        );
        const { toast } = await montar({
          perfil: { perfil: "admin" },
          supabase,
          lerPlanilha: async () => PLANILHA,
        });
        await abrir();
        escolherArquivo();
        await clicar($("approvedImportSubmit"));
        await clicar($("approvedImportConfirm"));
        expect(toast).toHaveBeenCalledWith(
          "A lista do edital mudou depois da prévia. Confira a substituição de novo.",
          "error",
        );
      });
    });

    it("reabrir começa na aba do arquivo, com rascunho limpo", async () => {
      await montar();
      await abrir();
      await clicar(achar('[data-import-tab="convocacao"]'));
      expect($("approvedImportPanelArquivo").classList.contains("hidden")).toBe(
        true,
      );
      await clicar(achar("#approvedImportModal .modal-head .btn"));
      await abrir();
      expect($("approvedImportPanelArquivo").classList.contains("hidden")).toBe(
        false,
      );
    });
  });

  describe("lista de aprovados publicada da Classificação", () => {
    const DA_CLASSIFICACAO = {
      ...LISTA_ATIVA,
      origem: "CLASSIFICACAO",
      lista_classificacao_id: "lc1",
      arquivo_nome: "Classificação — resultado final (regra v2)",
      arquivo_path: "",
      importado_em: "2026-10-05T15:00:00Z",
    };
    const SITUACAO = {
      edital_id: "10",
      pode_publicar: true,
      tem_analises: true,
      resultado_final: {
        id: "lc2",
        gerada_em: "2026-10-05T18:00:00Z",
        versao_regra: 2,
        pendencias: 0,
      },
      vigente: { lista_id: "L10", origem: "CLASSIFICACAO", candidatos: [] },
      publicacoes: [
        {
          id: "p1",
          origem: "CLASSIFICACAO",
          em: "2026-10-05T15:00:00Z",
          por: "Gestora",
          versao_regra: 2,
          candidatos: 3,
          entram: 1,
          saem: 1,
          mudam: 2,
          pendencias: [{ nome: "Fulano Fora" }],
        },
      ],
    };
    function comSituacao(supabase: BancoFalso, situacao: unknown = SITUACAO) {
      const original = definido(supabase.rpc.getMockImplementation());
      supabase.rpc.mockImplementation((nome, argumentos) =>
        nome === "obter_publicacao_lista_aprovados"
          ? Promise.resolve({ data: situacao, error: null })
          : original(nome, argumentos),
      );
      return supabase;
    }
    const abrir = (editalId = "10") =>
      esperar(() =>
        definido(controlador).openImportModal(
          editalId,
          "03/2025 · DSEI Manaus",
        ),
      );

    it("mostra a origem; trocar pela planilha pede motivo e o manda ao banco", async () => {
      const supabase = comSituacao(
        supabaseFalso({ listas: [DA_CLASSIFICACAO, LISTA_INATIVA] }),
      );
      const { toast } = await montar({ perfil: { perfil: "admin" }, supabase });
      await abrir();
      expect($("approvedImportCurrentState").textContent).toContain(
        "Publicada da Classificação em 05/10",
      );
      expect(talvez("approvedImportDownloadCurrent")).toBeNull();
      Object.defineProperty($("approvedImportFile"), "files", {
        value: [new File(["x"], "troca.xlsx")],
      });
      const anterior = definido(supabase.rpc.getMockImplementation());
      supabase.rpc.mockImplementation((nome, argumentos) =>
        nome === "obter_casamento_da_lista"
          ? anterior(nome, argumentos).then((r) => ({
              ...r,
              data: { ...objeto(r.data), exige_motivo: true, anteriores: 3 },
            }))
          : anterior(nome, argumentos),
      );
      supabase.rpc.mockClear();
      await clicar($("approvedImportSubmit"));
      // A prévia pede o motivo: a lista foi publicada da Classificação.
      expect(talvez("approvedImportPrevia")).not.toBeNull();
      await clicar($("approvedImportConfirm"));
      expect(toast).toHaveBeenCalledWith(
        expect.stringContaining("motivo da substituição"),
        "warn",
      );
      expect(supabase.rpc).not.toHaveBeenCalledWith(
        "aplicar_casamento_da_lista",
        expect.anything(),
      );
      await digitar($("approvedImportMotivo"), "Edital sem análise no sistema");
      await clicar($("approvedImportConfirm"));
      expect(supabase.rpc).toHaveBeenCalledWith(
        "aplicar_casamento_da_lista",
        expect.objectContaining({ p_motivo: "Edital sem análise no sistema" }),
      );
    });

    it("edital com resultado final oferece publicar da Classificação e mostra o histórico", async () => {
      const supabase = comSituacao(supabaseFalso());
      await montar({ perfil: { perfil: "admin" }, supabase });
      window.navigate = vi.fn();
      await abrir();
      expect(supabase.rpc).toHaveBeenCalledWith(
        "obter_publicacao_lista_aprovados",
        {
          p_edital: "10",
          p_com_candidatos: false,
        },
      );
      const botao = achar("[data-acao='ir-para-classificacao']");
      expect(botao.textContent).toContain("Publicar da Classificação");
      expect(achar(".approved-import-historico").textContent).toContain(
        "Fulano Fora",
      );
      await clicar(botao);
      expect(window.navigate).toHaveBeenCalledWith("classificacao");
      expect(talvez("approvedImportModal")).toBeNull();
      delete window.navigate;
    });

    it("publicações malformadas não quebram o modal e permitem nova tentativa", async () => {
      const supabase = comSituacao(supabaseFalso(), {
        ...SITUACAO,
        publicacoes: [{ id: "p1" }, { id: "p2", pendencias: {} }],
      });
      await montar({ perfil: { perfil: "admin" }, supabase });
      await abrir();
      expect(talvez("approvedImportModal")).not.toBeNull();
      expect(document.querySelector(".approved-import-historico")).toBeNull();
      const repetir = achar('[data-acao="recarregar-publicacoes"]');
      expect(repetir).not.toBeNull();
      comSituacao(supabase);
      await clicar(repetir);
      expect(
        document.querySelector('[data-acao="recarregar-publicacoes"]'),
      ).toBeNull();
      expect(achar(".approved-import-historico").textContent).toContain(
        "Fulano Fora",
      );
    });

    it("a aba de aprovados diz a origem das listas", async () => {
      await montar({
        supabase: supabaseFalso({
          listas: [DA_CLASSIFICACAO, { ...LISTA_INATIVA, ativo: true }],
          candidatos: CANDIDATOS().map((c) => ({ ...c, lista_ativa: true })),
        }),
      });
      expect(achar("[data-origem-das-listas]").textContent).toBe(
        "Listas: 1 publicada da Classificação · 1 manual (planilha)",
      );
    });
  });

  /*
  Só as listas e os candidatos dos editais da área escolhida no menu: o
  recorte é pelo conjunto de ids das linhas do monitoramento daquela área.
*/
  describe("Ativos e Histórico", () => {
    it("Ativos é a lista de trabalho; o Histórico tem a lista inativa, a um clique", async () => {
      await montar();
      expect(vistaDosAprovados("ativos").textContent).toBe("Ativos1");
      expect(vistaDosAprovados("historico").textContent).toBe("Histórico1");
      expect(vistaDosAprovados("ativos").getAttribute("aria-checked")).toBe(
        "true",
      );
      expect(opcoesDoFiltro("approvedFilterEdital")).toEqual([
        "03/2025 · DSEI Manaus",
      ]);
      expect($("approvedKpiTotal").textContent).toBe("3");
      expect(acharTodos("#approvedRows tr").length).toBe(3);

      await verHistorico();
      expect(nomes()).toEqual(["Diego Alves"]);
      expect(opcoesDoFiltro("approvedFilterEdital")).toEqual([
        "04/2025 · CASAI São Paulo",
      ]);
      expect($("approvedKpiTotal").textContent).toBe("1");
      expect($("approvedKpiDesistente").textContent).toBe("1");
      expect($("approvedCount").textContent).toBe("1 candidato");
    });

    it("edital concluído com lista ativa fica nos Ativos; o cancelado vai para o Histórico", async () => {
      // Em produção, com a regra de Editais (concluído no Histórico), os
      // Ativos ficaram vazios: quase toda lista é de edital já concluído.
      publicarLinhasDoMonitoramento([
        { id: "10", CO_AREA: "saude-indigena", status: "Concluído" },
        { id: "20", CO_AREA: "saude-indigena", status: "Cancelado" },
      ]);
      await montar({
        supabase: supabaseFalso({
          listas: [LISTA_ATIVA, { ...LISTA_INATIVA, ativo: true }],
          candidatos: CANDIDATOS().map((c) => ({ ...c, lista_ativa: true })),
        }),
      });
      expect(nomes()).toEqual(["Ana Ribeiro", "Bruno Lima", "Carla Souza"]);
      expect(
        achar('[data-tour="aprovados-ativos-e-historico"] .ui-ativos-situacoes')
          .textContent,
      ).toContain("Concluído");
      await verHistorico();
      expect(nomes()).toEqual(["Diego Alves"]);
      expect(
        achar('[data-tour="aprovados-ativos-e-historico"] .ui-ativos-situacoes')
          .textContent,
      ).toContain("Cancelado");
    });

    it("o pedido de um edital do Histórico (faixa das etapas, Visão geral) abre o Histórico nele", async () => {
      // Como na navegação: o pedido sai antes, a tela abre e o aplica.
      pedirFiltro("approved", { edital: "04/2025", editalId: "20" });
      await montar();
      await vi.waitFor(() =>
        expect(
          vistaDosAprovados("historico").getAttribute("aria-checked"),
        ).toBe("true"),
      );
      expect(nomes()).toEqual(["Diego Alves"]);
      // E voltar aos Ativos recomeça os filtros.
      await clicar(vistaDosAprovados("ativos"));
      expect(nomes()).toEqual(["Ana Ribeiro", "Bruno Lima", "Carla Souza"]);
    });
  });

  describe("área atual", () => {
    it("candidatos, contador e seletor de edital seguem a área", async () => {
      publicarLinhasDoMonitoramento([
        { id: "10", CO_AREA: "saude-indigena" },
        { id: "20", CO_AREA: "sede" },
      ]);
      await montar();
      expect(nomes()).toEqual(["Ana Ribeiro", "Bruno Lima", "Carla Souza"]);
      expect($("approvedCount").textContent).toBe("3 candidatos");

      await act(async () => definirAreaAtual("sede"));
      // A sede só tem a lista inativa do Diego: a lista de trabalho fica vazia.
      expect(nomes()).toEqual([]);
      await verHistorico();
      expect(nomes()).toEqual(["Diego Alves"]);
      expect($("approvedCount").textContent).toBe("1 candidato");
      expect(opcoesDoFiltro("approvedFilterEdital")).toEqual([
        expect.stringContaining("04/2025"),
      ]);

      await act(async () => definirAreaAtual("projetos"));
      expect(nomes()).toEqual([]);
    });
  });

  describe("candidatos por área, com a cópia do navegador", () => {
    const USUARIO = { perfil: "contratador", user_id: "u1" };
    const ADMIN = { perfil: "admin" };

    /* O texto da cópia guardada (`{ texto }`). */
    function textoGuardado(valor: unknown): string {
      if (
        typeof valor === "object" &&
        valor !== null &&
        "texto" in valor &&
        typeof valor.texto === "string"
      )
        return valor.texto;
      throw new TypeError("Sem a cópia guardada");
    }

    function armazenamentoEmMemoria() {
      const dados = new Map<string, unknown>();
      return {
        dados,
        ler: async (chave: string) => structuredClone(dados.get(chave) ?? null),
        guardar: async (chave: string, valor: unknown) => {
          dados.set(chave, structuredClone(valor));
        },
        apagarTudo: async () => dados.clear(),
      };
    }

    // A gravação da cópia não é esperada pela carga: dá a vez às promessas.
    const assentar = () => esperar(() => new Promise((r) => setTimeout(r, 0)));

    it("trocar de área no menu busca os candidatos da área nova", async () => {
      publicarLinhasDoMonitoramento([
        { id: "10", CO_AREA: "saude-indigena" },
        { id: "30", CO_AREA: "sede" },
      ]);
      const supabase = supabaseFalso({
        candidatos: [
          ...CANDIDATOS(),
          candidato({
            candidato_id: "sede",
            nome: "Sara Sede",
            edital_id: "30",
          }),
        ],
      });
      await montar({ supabase });
      expect(nomes()).not.toContain("Sara Sede");

      await esperar(() => definirAreaAtual("sede"));
      await esperar(() => definido(controlador).render());
      expect(chamadasDoPacote(supabase).at(-1)).toEqual({
        p_area: "sede",
        p_versao: null,
      });
      expect(nomes()).toEqual(["Sara Sede"]);
    });

    it("depois de uma escrita, relê do banco com a versão da tela e fica com a nova", async () => {
      const supabase = supabaseFalso();
      await montar({ supabase, perfil: ADMIN });
      await clicar(
        achar('[data-approved-action="status"]', linhaDe("Bruno Lima")),
      );
      await escolher($("approvedStatusSelect"), "Desistente");
      supabase.banco.candidatos = supabase.banco.candidatos.map((c) =>
        c.candidato_id === "bruno" ? { ...c, status: "Desistente" } : c,
      );
      await clicar($("approvedStatusSave"));
      await assentar();
      expect(chamadasDoPacote(supabase).at(-1)).toEqual({
        p_area: "saude-indigena",
        p_versao: "v1",
      });
      expect(achar(".approved-status", linhaDe("Bruno Lima")).textContent).toBe(
        "Desistente",
      );
    });

    it("versão que continua valendo mantém os candidatos da tela", async () => {
      const supabase = supabaseFalso();
      await montar({ supabase });
      const antes = definido(controlador).estado.obter().candidatos;
      await esperar(() =>
        definido(controlador).estado.carregar({ emSegundoPlano: true }),
      );
      expect(chamadasDoPacote(supabase).at(-1)).toEqual({
        p_area: "saude-indigena",
        p_versao: "v1",
      });
      expect(definido(controlador).estado.obter().candidatos).toBe(antes);
    });

    it("a próxima abertura mostra a cópia guardada e só pergunta a versão", async () => {
      const armazenamento = armazenamentoEmMemoria();
      await montar({ perfil: USUARIO, armazenamento });
      await assentar();
      expect(armazenamento.dados.has("aprovados:saude-indigena")).toBe(true);
      await act(async () => definido(definido(controlador).raiz).unmount());

      // Mesmo banco, mesma versão: a lista vem da cópia, sem baixar de novo.
      const supabase = supabaseFalso({ candidatos: [] });
      await montar({ perfil: USUARIO, armazenamento, supabase });
      await assentar();
      expect(chamadasDoPacote(supabase)).toEqual([
        { p_area: "saude-indigena", p_versao: "v1" },
      ]);
      expect(nomes()).toContain("Bruno Lima");
    });

    it("sem rede, a próxima abertura mostra a cópia guardada com a data dela", async () => {
      const armazenamento = armazenamentoEmMemoria();
      await montar({ perfil: USUARIO, armazenamento });
      await assentar();
      await act(async () => definido(definido(controlador).raiz).unmount());

      const supabase = supabaseFalso();
      supabase.rpc.mockImplementation(async () => ({
        data: null,
        error: { message: "TypeError: Failed to fetch", code: "" },
      }));
      const { toast } = await montar({
        perfil: USUARIO,
        armazenamento,
        supabase,
      });
      await assentar();
      expect(nomes()).toContain("Bruno Lima");
      expect(toast).not.toHaveBeenCalled();
      expect(
        achar("[data-status-da-carga]", document.body).textContent,
      ).toMatch(/^Dados de \d{2}\/\d{2}, \d{2}:\d{2}$/);
      expect(definido(controlador).estado.obter().listas).toHaveLength(2);
    });

    it("a cópia aparece na hora e a versão nova do banco a substitui", async () => {
      const armazenamento = armazenamentoEmMemoria();
      await montar({ perfil: USUARIO, armazenamento });
      await assentar();
      await act(async () => definido(definido(controlador).raiz).unmount());

      const supabase = supabaseFalso({
        candidatos: [candidato({ candidato_id: "nova", nome: "Nina Nova" })],
      });
      supabase.banco.versao = "v9";
      await montar({ perfil: USUARIO, armazenamento, supabase });
      await assentar();
      expect(nomes()).toEqual(["Nina Nova"]);
      const guardada = JSON.parse(
        textoGuardado(armazenamento.dados.get("aprovados:saude-indigena")),
      );
      expect(guardada.versao).toBe("v9");
    });

    it("sem acesso à área na revalidação, a cópia sai e a lista fica vazia", async () => {
      const armazenamento = armazenamentoEmMemoria();
      await montar({ perfil: USUARIO, armazenamento });
      await assentar();
      await act(async () => definido(definido(controlador).raiz).unmount());

      const supabase = supabaseFalso();
      const responder = definido(supabase.rpc.getMockImplementation());
      // A abertura volta com o pacote recusado (as outras partes vêm).
      supabase.rpc.mockImplementation(async (nome, ...resto) => {
        const resposta = await responder(nome, ...resto);
        if (nome !== "abrir_lista_aprovados") return resposta;
        return {
          ...resposta,
          data: {
            ...objeto(resposta.data),
            pacote: null,
            erros: { pacote: { code: "42501", message: "Sem permissão" } },
          },
        };
      });
      const { toast } = await montar({
        perfil: USUARIO,
        armazenamento,
        supabase,
      });
      await assentar();
      expect(nomes()).toEqual([]);
      expect(armazenamento.dados.size).toBe(0);
      expect(toast).toHaveBeenCalledWith(
        "Erro ao carregar lista de aprovados: Sem permissão",
        "error",
      );
    });
  });

  describe("Contratado em outra lista (20261024120000)", () => {
    const MOTIVO =
      "A pessoa foi contratada pela linha Ampla Concorrência · 137º · vaga MED: a convocação alcançou a pessoa nas duas.";
    /* A mesma matrícula Contratado na ampla e na cota do mesmo edital; o job decidiu a ampla. */
    const PAR = () => [
      candidato({
        candidato_id: "ac",
        nome: "Pessoa Fictícia",
        status: "Contratado",
        matricula: "M-9",
        codigo_vaga: "MED",
        contratacao_situacao: "CONTRATACAO",
        contratacao_motivo: "Esta é a contratação.",
      }),
      candidato({
        candidato_id: "cota",
        nome: "Pessoa Fictícia",
        status: "Contratado",
        matricula: "M-9",
        modalidade: "PPIQ",
        codigo_vaga: "MED PPIQ",
        contratacao_situacao: "OUTRA_LISTA",
        contratacao_motivo: MOTIVO,
      }),
      candidato({
        candidato_id: "amb",
        nome: "Outra Pessoa",
        status: "Contratado",
        matricula: "M-7",
        contratacao_situacao: "AMBIGUO",
        contratacao_motivo: "A regra não decide.",
      }),
    ];
    it("a linha espelho mostra o rótulo com o motivo e não conta nos contratados", async () => {
      await montar({ supabase: supabaseFalso({ candidatos: PAR() }) });
      expect($("approvedKpiContratado").textContent).toBe("2");
      expect($("approvedKpiContratadoEmOutraLista").textContent).toBe("1");
      const selos = acharTodos("#approvedRows [data-contratacao]");
      const espelho = definido(
        selos.find((s) => s.getAttribute("data-contratacao") === "OUTRA_LISTA"),
      );
      expect(espelho.textContent).toBe("Contratado em outra lista");
      expect(espelho.title).toBe(MOTIVO);
      expect(espelho.classList.contains("approved-status-calculado")).toBe(
        true,
      );
      const ambiguo = definido(
        selos.find((s) => s.getAttribute("data-contratacao") === "AMBIGUO"),
      );
      expect(ambiguo.textContent).toBe("Contratado");
      expect(ambiguo.querySelector(".fa-triangle-exclamation")).not.toBeNull();
    });

    it("o filtro de status acha a linha decidida pelo sistema", async () => {
      await montar({ supabase: supabaseFalso({ candidatos: PAR() }) });
      expect(opcoesDoFiltro("approvedFilterStatus")).toContain(
        "Contratado em outra lista",
      );
      await clicar(
        opcaoDoFiltro("approvedFilterStatus", "Contratado em outra lista"),
      );
      expect(
        acharTodos("#approvedRows [data-contratacao]").map((s) =>
          s.getAttribute("data-contratacao"),
        ),
      ).toEqual(["OUTRA_LISTA"]);
    });

    it("o admin escolhe o status explícito, que guarda a matrícula", async () => {
      const { supabase } = await montar({
        perfil: { perfil: "admin" },
        supabase: supabaseFalso({ candidatos: PAR() }),
      });
      const lapis = acharTodos('[data-approved-action="status"]').find((b) =>
        b.closest("tr")?.querySelector('[data-contratacao="AMBIGUO"]'),
      );
      await clicar(lapis);
      expect($("approvedPeloSistemaHint").textContent).toBe(
        "A regra não decide.",
      );
      await escolher($("approvedStatusSelect"), "Contratado em outra lista");
      expect(talvez("approvedOutraListaHint")).not.toBeNull();
      expect($<HTMLInputElement>("approvedStatusMatricula").required).toBe(
        false,
      );
      supabase.rpc.mockClear();
      await clicar($("approvedStatusSave"));
      expect(supabase.rpc).toHaveBeenCalledWith(
        "alterar_status_aprovado_com_observacao",
        {
          p_observacao: null,
          p_candidato_id: "amb",
          p_status: "Contratado em outra lista",
          p_processo_sei: null,
          p_matricula: "M-7",
        },
      );
    });

    it("marcar Contratado sugere a outra linha da mesma matrícula, sem marcar sozinho", async () => {
      const linhas = [
        candidato({
          candidato_id: "x1",
          nome: "Pessoa X",
          status: "Contratado",
          matricula: "00123",
        }),
        candidato({
          candidato_id: "x2",
          nome: "Pessoa X",
          modalidade: "PCD",
          codigo_vaga: "VG-PCD",
          classificacao: 2,
          status: "",
        }),
      ];
      const { supabase } = await montar({
        perfil: { perfil: "admin" },
        supabase: supabaseFalso({ candidatos: linhas }),
      });
      const lapis = acharTodos('[data-approved-action="status"]').find((b) =>
        b.closest("tr")?.textContent.includes("PCD"),
      );
      await clicar(lapis);
      await escolher($("approvedStatusSelect"), "Contratado");
      await digitar($("approvedStatusMatricula"), "123");
      expect($("approvedOutraListaSugestao").textContent).toContain(
        "Esta matrícula já está Contratado em outra linha do edital:",
      );
      expect($<HTMLInputElement>("approvedOutraListaMarcar").checked).toBe(
        false,
      );
      supabase.rpc.mockClear();
      await clicar($("approvedOutraListaMarcar"));
      await clicar($("approvedStatusSave"));
      const chamadas = supabase.rpc.mock.calls.filter(
        ([nome]) =>
          nome === "alterar_status_aprovado_com_observacao" ||
          nome === "alterar_status_candidato_aprovado",
      );
      expect(chamadas.map(([, a]) => [a?.p_candidato_id, a?.p_status])).toEqual(
        [
          ["x2", "Contratado"],
          ["x1", "Contratado em outra lista"],
        ],
      );
      expect(definido(chamadas[1])[1]?.p_matricula).toBe("00123");
    });
  });

  describe("Exportar a lista de aprovados (issue #583)", () => {
    const REGISTRO = {
      exportacao_id: "0f0e0d0c-0b0a-4000-8000-000000000001",
      emitida_em: "2026-11-10T17:30:00Z",
    };
    const comRegistro = (
      supabase: BancoFalso,
      resposta: RespostaDoTeste = { data: REGISTRO, error: null },
    ) => {
      const original = definido(supabase.rpc.getMockImplementation());
      supabase.rpc.mockImplementation((nome, argumentos) =>
        nome === "registrar_exportacao_aprovados"
          ? Promise.resolve(resposta)
          : original(nome, argumentos),
      );
    };
    const chamadasDoRegistro = (supabase: BancoFalso) =>
      supabase.rpc.mock.calls.filter(
        ([nome]) => nome === "registrar_exportacao_aprovados",
      );

    it("registra no banco com os filtros da tela e baixa o CSV com a identificação", async () => {
      const supabase = supabaseFalso();
      comRegistro(supabase);
      const baixar = vi.fn<(arquivo: Blob, nome: string) => void>();
      const { toast } = await montar({ supabase, baixar });

      await clicar($("approvedExportBtn"));
      expect($("approvedExportResumo").textContent).toContain("3 registros");
      await clicar(
        acharTodos("#approvedExportModal [role=radio]").find(
          (b) => b.textContent === "CSV",
        ),
      );
      await clicar($("approvedExportConfirmar"));
      await esperar(() => new Promise((pronto) => setTimeout(pronto, 0)));

      expect(chamadasDoRegistro(supabase).map(([, a]) => a)).toEqual([
        {
          p_area: "saude-indigena",
          p_formato: "CSV",
          p_editais: ["10"],
          p_cargos: [],
          p_modalidades: [],
          p_situacoes: [],
          p_recorte_do_aviso: false,
          p_total_na_tela: 3,
          p_registros: 3,
        },
      ]);
      expect(baixar).toHaveBeenCalledTimes(1);
      // O arquivo é gerado sem bloquear a tela: espera o download de fato (no CI,
      // com cobertura, um ciclo só não basta).
      await vi.waitFor(() => expect(baixar).toHaveBeenCalled(), {
        timeout: 5000,
      });
      const [arquivo, nome] = definido(baixar.mock.calls[0]);
      expect(nome).toBe(
        "lista-de-aprovados-saude-indigena-2026-11-10-1430.csv",
      );
      expect(arquivo.type).toContain("text/csv");
      const csv = await arquivo.text();
      expect(csv).toContain("Ana Ribeiro");
      expect(csv).toContain(REGISTRO.exportacao_id);
      expect(csv).toContain("Emitida em;10/11/2026, 14:30");
      expect(talvez("approvedExportModal")).toBeNull();
      expect(toast).toHaveBeenCalledWith(
        "Lista exportada em CSV: 3 registros.",
        "success",
      );
    });

    it("com situação escolhida, manda o total do recorte e só os registros filtrados", async () => {
      const supabase = supabaseFalso();
      comRegistro(supabase);
      const baixar = vi.fn<(arquivo: Blob, nome: string) => void>();
      await montar({ supabase, baixar });
      await clicar(opcaoDoFiltro("approvedFilterStatus", "Contratado"));

      await clicar($("approvedExportBtn"));
      expect($("approvedExportResumo").textContent).toContain(
        "1 registro de 3 na lista vigente",
      );
      await clicar($("approvedExportConfirmar"));
      await esperar(() => new Promise((pronto) => setTimeout(pronto, 0)));

      expect(chamadasDoRegistro(supabase)[0]?.[1]).toMatchObject({
        p_formato: "XLSX",
        p_situacoes: ["Contratado"],
        p_total_na_tela: 3,
        p_registros: 1,
      });
      // O arquivo é gerado sem bloquear a tela: espera o download de fato (no CI,
      // com cobertura, um ciclo só não basta).
      await vi.waitFor(() => expect(baixar).toHaveBeenCalled(), {
        timeout: 5000,
      });
      const [arquivo, nome] = definido(baixar.mock.calls[0]);
      expect(nome.endsWith(".xlsx")).toBe(true);
      expect(arquivo.size).toBeGreaterThan(0);
    });

    it("recusa do banco (lista mudou): avisa, não baixa nada e o modal fica aberto", async () => {
      const supabase = supabaseFalso();
      comRegistro(supabase, {
        data: null,
        error: {
          code: "40001",
          message:
            "A lista mudou desde que a tela foi carregada (4 na tela, 5 no banco). Clique em Atualizar e exporte de novo.",
        },
      });
      const baixar = vi.fn<(arquivo: Blob, nome: string) => void>();
      const { toast } = await montar({ supabase, baixar });
      await clicar($("approvedExportBtn"));
      await clicar($("approvedExportConfirmar"));
      await esperar(() => new Promise((pronto) => setTimeout(pronto, 0)));

      expect(baixar).not.toHaveBeenCalled();
      expect(toast).toHaveBeenCalledWith(
        expect.stringContaining("Clique em Atualizar"),
        "error",
      );
      expect(talvez("approvedExportModal")).not.toBeNull();
    });

    it("o botão é da aba Aprovados: some na Convocação", async () => {
      await montar();
      expect($("approvedHeadActions").contains($("approvedExportBtn"))).toBe(
        true,
      );
      await clicar($("approvedTabConvocacao"));
      expect($("approvedHeadActions").classList.contains("hidden")).toBe(true);
    });
  });

  /*
  Status em lote (11/11/2026): quem muda status marca as linhas (ou todas as da
  tabela) e muda de uma vez; a janela mostra quem fica de fora e por quê.
*/
  describe("status em lote", () => {
    it("seleciona todos, mostra quem fica de fora e grava só os que mudam", async () => {
      const { supabase, toast } = await montar();
      expect(
        acharTodos("[data-selecao-do-candidato]").length,
      ).toBeGreaterThanOrEqual(3);
      // Poucos candidatos: a página é o resultado inteiro.
      await clicar(achar('[data-acao="selecionar-pagina"]'));
      expect(achar("[data-alcance-da-selecao]").textContent).toMatch(
        /^Todos os \d+ candidatos do resultado selecionados$/,
      );
      expect(
        document.querySelector('[data-acao="selecionar-todos-os-resultados"]'),
      ).toBeNull();
      await clicar(achar("[data-abrir-status-em-lote]"));
      const opcoes = [
        ...$<HTMLSelectElement>("approvedStatusEmLoteSelect").options,
      ].map((o) => o.value);
      expect(opcoes).toEqual([
        "Convocado",
        "Desistente",
        "Documentação Rejeitada",
      ]);
      await escolher($("approvedStatusEmLoteSelect"), "Desistente");
      // Ana já é Contratado: quem edita não muda status definido.
      expect(achar("[data-fora-do-lote]").textContent).toContain(
        "Status já definido (Contratado): só o admin muda",
      );
      expect(achar("[data-alcance-da-acao]").textContent).toMatch(
        /^2 candidatos serão afetados · \d+ dos marcados não se aplicam$/,
      );
      const confirmar = achar<HTMLButtonElement>("[data-confirmar-lote]");
      expect(confirmar.textContent).toBe("Mudar 2 candidatos para Desistente");

      supabase.rpc.mockClear();
      await clicar(confirmar);
      const chamada = supabase.rpc.mock.calls.find(
        ([nome]) => nome === "alterar_status_candidatos_aprovados",
      );
      expect(chamada?.[1]).toEqual({
        p_candidatos: expect.arrayContaining(["bruno", "carla"]),
        p_status: "Desistente",
      });
      expect(
        (chamada?.[1] as { p_candidatos: string[] }).p_candidatos,
      ).toHaveLength(2);
      expect(talvez("approvedStatusEmLoteModal")).toBeNull();
      expect(toast).toHaveBeenCalledWith(
        "2 candidato(s) agora como Desistente.",
        "success",
      );
      expect(document.querySelector("[data-abrir-status-em-lote]")).toBeNull();
    });

    it("Convocado leva a data; marcar uma linha só muda aquela", async () => {
      const { supabase } = await montar();
      await clicar(achar("[data-selecao-do-candidato]", linhaDe("Bruno Lima")));
      await clicar(achar("[data-abrir-status-em-lote]"));
      const data = $<HTMLInputElement>("approvedStatusEmLoteData");
      expect(data.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      supabase.rpc.mockClear();
      await clicar(achar("[data-confirmar-lote]"));
      expect(supabase.rpc).toHaveBeenCalledWith(
        "alterar_status_candidatos_aprovados",
        {
          p_candidatos: ["bruno"],
          p_status: "Convocado",
          p_data_convocacao: data.value,
        },
      );
    });

    it("quem só lê não vê seleção", async () => {
      await montar({ perfil: { permissoes: { aprovados: "leitor" } } });
      expect(document.querySelector("[data-selecao-do-candidato]")).toBeNull();
      expect(
        document.querySelector('[data-acao="selecionar-pagina"]'),
      ).toBeNull();
    });
  });

  describe("Resumo por cargo (pedido da CORES)", () => {
    it("conta a lista vigente ativa por vaga e modalidade, com reserva pela fila e total geral", async () => {
      await montar();
      await clicar($("approvedTabResumo"));
      expect($("approvedPanelResumo").classList.contains("hidden")).toBe(false);
      expect($("approvedHeadActions").classList.contains("hidden")).toBe(true);
      const total = definido(achar("#approvedPanelResumo tfoot tr"));
      const celulas = acharTodos("td", total).map((td) =>
        td.textContent?.trim(),
      );
      // Aprovados, Contratados, Desistentes, Em reserva, Outros.
      expect(
        acharTodos("#approvedPanelResumo thead th").map((th) =>
          th.textContent?.trim(),
        ),
      ).toEqual([
        "Cargo e vaga",
        "Aprovados",
        "Contratados",
        "Desistentes",
        "Em reserva",
        "Outros",
      ]);
      expect(celulas).toEqual(["3", "1", "0", "2", "0"]);
      const avisos = definido(
        achar("#approvedPanelResumo .approved-resumo-avisos"),
      ).textContent;
      // A lista inativa nem chega ao resumo dos Ativos (está no Histórico).
      expect(avisos).not.toMatch(/lista inativa ficou fora/);
      expect(avisos).toMatch(/Não informado no cargo/);
      expect($("approvedPanelResumo").textContent).not.toMatch(/Diego Alves/);
    });

    it("o número abre os vínculos daquele recorte numa gaveta que fecha com Esc", async () => {
      await montar();
      await clicar($("approvedTabResumo"));
      const reserva = definido(
        achar<HTMLButtonElement>(
          "#approvedPanelResumo tfoot button[aria-label^='Ver os 2 de Em reserva']",
        ),
      );
      await clicar(reserva);
      const gaveta = $("approvedResumoDetalhe");
      expect(gaveta.textContent).toMatch(/Bruno Lima/);
      expect(gaveta.textContent).toMatch(/Carla Souza/);
      expect(gaveta.textContent).not.toMatch(/Ana Ribeiro/);
      await teclar(document, "Escape");
      expect(document.getElementById("approvedResumoDetalhe")).toBeNull();
    });

    it("o filtro Situação restringe a base e diz isso", async () => {
      await montar();
      await clicar($("approvedTabResumo"));
      await clicar(opcaoDoFiltro("approvedResumoFiltroStatus", "Contratado"));
      const total = definido(achar("#approvedPanelResumo tfoot tr"));
      expect(acharTodos("td", total)[0]?.textContent?.trim()).toBe("1");
      expect(
        definido(achar("#approvedPanelResumo .approved-resumo-avisos"))
          .textContent,
      ).toMatch(/Situação restringe a base/);
    });

    it("sem a lista carregada, diz que o resumo depende dela (não é vazio)", async () => {
      await montar({
        supabase: supabaseFalso({
          erros: { listar_listas_aprovados: "sem rede" },
        }),
      });
      await clicar($("approvedTabResumo"));
      expect($("approvedPanelResumo").textContent).toMatch(/não carregou/);
    });
  });
});

bloco("componentes/lista-de-convocacao", () => {
  /* Um campo dentro de um objeto que veio da RPC (sem tipo): `a.b.c`. */
  function campoDe(valor: unknown, ...caminho: string[]): unknown {
    return caminho.reduce<unknown>(
      (atual, chave) =>
        typeof atual === "object" && atual !== null
          ? Reflect.get(atual, chave)
          : undefined,
      valor,
    );
  }

  /*
  A tela só mostra os editais da área atual (a padrão é a Saúde Indígena); os
  editais das fixtures precisam estar nas linhas do monitoramento. Registrado
  antes dos outros ganchos, o afterEach roda depois de desmontar.
*/
  beforeEach(() =>
    publicarLinhasDoMonitoramento(
      ["7"].map((id) => ({ id, CO_AREA: "saude-indigena" })),
    ),
  );
  afterEach(() => redefinirDadosDoMonitoramento());

  /*
  A costura entre as peças da lista de convocação: o modelo e a configuração
  como o banco os devolve, a derivação do quadro, o cálculo da ordem e o
  desenho em React — inclusive as permissões, que decidem se o botão de alterar
  status aparece e se o formulário do edital pode ser editado.
*/

  let sequencial = 0;
  const candidato = (
    nome: string,
    modalidade: string,
    extra: Record<string, unknown> = {},
  ): CandidatoDoTeste => {
    sequencial += 1;
    return {
      candidato_id: `c${sequencial}`,
      nome,
      modalidade,
      nota: 100 - sequencial,
      classificacao: sequencial,
      cargo: "ENFERMEIRO",
      codigo_vaga: "VG-001",
      edital_id: "7",
      edital: "53/2025",
      unidade: "CASAI São Paulo",
      lista_ativa: true,
      status: "",
      ...extra,
    };
  };

  const MODELO_ID = "11111111-1111-1111-1111-111111111111";

  /** O modelo de referência na forma que `listar_modelos_convocacao` devolve. */
  /* `base`: um id do catálogo, ou o próprio modelo (por omissão, um salvo na ordem espalhada). */
  const linhaDoModelo = (
    mudancas: Record<string, unknown> = {},
    base0: string | ReferenciaDoModelo = LEI_15142_ESPALHADA,
  ) => {
    const base = definido(
      typeof base0 === "string" ? modeloDeReferencia(base0) : base0,
    );
    return {
      modelo_id: MODELO_ID,
      nome: base.nome,
      descricao: base.descricao,
      distribuicao: base.distribuicao,
      cota_multipla: base.cotaMultipla,
      // Nenhum modelo tem `minimoParaReserva`: o campo vai sempre vazio.
      minimo_reserva: undefined,
      editais: 1,
      categorias: base.categorias.map((categoria) => ({
        ...categoria,
        termos: definido(categoria.termos).join("; "),
        posicoes: (categoria.posicoes || []).join("; "),
        cascata: (categoria.cascata || []).join("; "),
      })),
      ...mudancas,
    };
  };

  /*
  Fingimos as RPCs de leitura. `rpc` devolve por nome, e a promessa tem
  `range` porque os candidatos vêm paginados.
*/
  interface OpcoesDoBanco {
    candidatos?: CandidatoDoTeste[];
    modelo?: Record<string, unknown> | null;
    padraoImediata?: number;
    vagas?: Record<string, unknown>[];
    proporcionalidade?: boolean;
    comModelo?: boolean;
  }

  const supabaseFalso = ({
    candidatos = [],
    modelo = linhaDoModelo(),
    padraoImediata = 0,
    vagas = [],
    proporcionalidade = true,
    comModelo = true,
  }: OpcoesDoBanco = {}) => {
    const responder = (nome: string): RespostaDoTeste => {
      if (nome === "listar_listas_aprovados")
        return {
          data: [
            {
              lista_id: "L7",
              edital_id: "7",
              edital: "53/2025",
              unidade: "CASAI São Paulo",
              ativo: true,
            },
          ],
          error: null,
        };
      if (nome === "listar_candidatos_aprovados_compacto")
        return { data: compactarCandidatos(candidatos), error: null };
      if (nome === "listar_modelos_convocacao")
        return { data: modelo ? [modelo] : [], error: null };
      if (nome === "listar_configuracao_convocacao")
        return {
          data: [
            {
              edital_id: "7",
              proporcionalidade,
              modelo_id: comModelo ? MODELO_ID : null,
              padrao_imediata: padraoImediata,
              vagas,
            },
          ],
          error: null,
        };
      return { data: { ok: true }, error: null };
    };
    const responderRpc = (
      nome: string,
      _argumentos?: Record<string, unknown>,
    ): Promise<RespostaDoTeste> & { range: () => unknown } => {
      const resposta: Promise<RespostaDoTeste> & { range: () => unknown } =
        Object.assign(Promise.resolve(responder(nome)), {
          range: () => resposta,
        });
      return resposta;
    };
    // A abertura da página numa chamada, montada com as respostas acima.
    const rpc = vi.fn(
      (
        nome: string,
        argumentos?: Record<string, unknown>,
      ): Promise<RespostaDoTeste> =>
        nome === "abrir_lista_aprovados"
          ? aberturaPelasChamadasDeAntes(responderRpc, argumentos)
          : responderRpc(nome, argumentos),
    );
    return { rpc, storage: clienteDosAprovados(rpc).storage };
  };

  /** Quadro exato numa vaga, sem depender da conta do percentual. */
  const vagaManual = (codigo: string, quadro: Record<string, number>) => ({
    codigo_vaga: codigo,
    cargo: null,
    imediatas: Object.values(quadro).reduce((soma, valor) => soma + valor, 0),
    manual: true,
    quadro,
  });

  const montarLista = (
    opcoes: Parameters<typeof criarListaAprovados>[0] & {
      secao: HTMLElement | null;
    },
  ) => montarTela(criarListaAprovados, "page-approved", opcoes);

  let controlador: ReturnType<typeof montarLista> | null = null;
  let perfilAtual: Record<string, unknown> | null = null;

  interface OpcoesDaMontagem extends OpcoesDoBanco {
    perfil?: Record<string, unknown>;
    toast?: (mensagem: string, tom?: string) => void;
  }

  async function montar({
    candidatos = [],
    perfil = { perfil: "contratador" },
    toast = () => {},
    ...banco
  }: OpcoesDaMontagem = {}) {
    document.body.innerHTML = `<section id="page-approved" class="page active"></section>`;
    perfilAtual = perfil;
    const supabase = supabaseFalso({ candidatos, ...banco });
    await act(async () => {
      controlador = montarLista({
        secao: document.getElementById("page-approved"),
        supabase,
        toast,
        getProfile: () => perfilAtual,
        confirmar: () => true,
      });
    });
    await esperar(() => definido(controlador).render());
    return { supabase };
  }

  let raizDoFormulario: ReturnType<typeof createRoot> | null = null;

  afterEach(async () => {
    await act(async () => raizDoFormulario?.unmount());
    raizDoFormulario = null;
    await act(async () => controlador?.raiz?.unmount());
    controlador = null;
    document.body.innerHTML = "";
  });

  const $ = (id: string) => document.getElementById(id);
  const entrada = (id: string) =>
    document.querySelector<HTMLInputElement>(`#${id}`);
  const abrirAbaDeConvocacao = () =>
    clicar(document.querySelector('[data-approved-tab="convocacao"]'));
  const nomesNaTabela = () =>
    [...document.querySelectorAll("#convocacaoRows tr")]
      .map((linha) => linha.querySelector(".approved-name strong")?.textContent)
      .filter(Boolean);

  /*
  O formulário da convocação mora nas Regras do edital (etapa Chamada para
  contratação): o EditorDaChamada sobre a MESMA loja da Lista de aprovados.
*/
  async function abrirFormulario() {
    const lugar = document.createElement("div");
    lugar.id = "regrasChamada";
    document.body.append(lugar);
    await act(async () => {
      const raiz = createRoot(lugar);
      raizDoFormulario = raiz;
      raiz.render(
        createElement(EditorDaChamada, {
          estado: definido(controlador).estado,
          editalId: "7",
        }),
      );
    });
    await esperar(() => Promise.resolve());
  }

  describe("aba da lista de convocação", () => {
    it("desenha a ordem de convocação, e não a de classificação", async () => {
      await montar({
        candidatos: [
          candidato("JOÃO", '"Pretos e Pardos"'),
          candidato("MARIA", "Ampla Concorrência"),
          candidato("PEDRO", '"Pretos e Pardos"'),
        ],
        vagas: [vagaManual("VG-001", { ampla: 2, pretos_pardos: 1 })],
      });
      await abrirAbaDeConvocacao();
      expect(nomesNaTabela()).toEqual(["JOÃO", "PEDRO", "MARIA"]);
      expect($("convocacaoKpiImediatas")?.textContent).toBe("3");
    });

    /*
    O caminho real: percentual do modelo mais o total de vagas. 10 x 25% = 2,5
    sobe para 3; 10 x 5% = 0,5 sobe para 1; 3% e 2% descem para 0. Sobram 6.
  */
    it("deriva o quadro do percentual do modelo", async () => {
      await montar({
        candidatos: [candidato("MARIA", "Ampla Concorrência")],
        padraoImediata: 10,
      });
      const cabecalho = document.querySelector(".convocacao-grupo");
      expect(cabecalho?.textContent).toContain("10 vagas imediatas");
      expect(cabecalho?.textContent).toContain("AC 6 · PP 3 · PCD 1");
    });

    it("respeita o total próprio da vaga", async () => {
      await montar({
        candidatos: [
          candidato("A", "Ampla", { codigo_vaga: "VG-001" }),
          candidato("B", "Ampla", { codigo_vaga: "VG-002", cargo: "MÉDICO" }),
        ],
        padraoImediata: 5,
        vagas: [
          {
            codigo_vaga: "VG-002",
            cargo: "MÉDICO",
            imediatas: 0,
            manual: false,
            quadro: {},
          },
        ],
      });
      const cabecalhos = [
        ...document.querySelectorAll(".convocacao-grupo"),
      ].map((linha) => linha.textContent);
      expect(cabecalhos[0]).toContain("5 vagas imediatas");
      expect(cabecalhos[1]).toContain("Sem vaga imediata");
    });

    it("mostra quem desistiu fora da numeração, sem gastar vaga", async () => {
      await montar({
        candidatos: [
          candidato("MARIA", "Ampla", { status: "Desistente" }),
          candidato("CARLOS", "Ampla"),
        ],
        vagas: [vagaManual("VG-001", { ampla: 1 })],
      });
      expect(nomesNaTabela()).toEqual(["CARLOS", "MARIA"]);
      expect(document.querySelector(".convocacao-vaga.fora")).not.toBeNull();
      expect($("convocacaoKpiForaDaFila")?.textContent).toBe("1");
    });

    /*
    Status é filtro de exibição e entra DEPOIS do cálculo: o desistente some da
    tabela, mas continua a não gastar vaga.
  */
    it("filtrar por status não muda a ordem de quem fica", async () => {
      await montar({
        candidatos: [
          candidato("MARIA", "Ampla", { status: "Desistente" }),
          candidato("CARLOS", "Ampla"),
        ],
        vagas: [vagaManual("VG-001", { ampla: 1 })],
      });
      await abrirAbaDeConvocacao();
      await clicar(
        [
          ...document.querySelectorAll(
            "#approvedPanelConvocacao .multi-select-option",
          ),
        ]
          .find((opcao) => opcao.textContent === "Sem status")
          ?.querySelector("input"),
      );
      expect(nomesNaTabela()).toEqual(["CARLOS"]);
      expect(
        document.querySelector("#convocacaoRows td.num")?.textContent,
      ).toBe("1");
    });

    /*
    O termo desconhecido é do MODELO, não do sistema: o aviso aparece para que
    o gestor saiba que basta acrescentar o termo àquela categoria.
  */
    it("avisa quando a modalidade declarada não foi reconhecida", async () => {
      await montar({
        candidatos: [candidato("LUA", "Pessoa Trans")],
        padraoImediata: 1,
      });
      expect(document.querySelector(".convocacao-alerta")).not.toBeNull();
    });

    it("mostra as duas reservas declaradas e destaca a que vale", async () => {
      await montar({
        candidatos: [candidato("ANA", '"pretos e pardos" e "quilombola"')],
        vagas: [vagaManual("VG-001", { ampla: 1 })],
      });
      const modalidade = document.querySelector(".convocacao-modalidade");
      expect(modalidade?.textContent).toContain("PP");
      expect(modalidade?.textContent).toContain("QUI");
      expect(modalidade?.querySelector("strong")?.textContent).toBe("PP");
      expect(document.querySelector(".convocacao-multipla")).not.toBeNull();
    });

    /*
    A trava é a mesma da lista de aprovados e vem do candidato: lista inativa
    não se altera de nenhuma das duas abas.
  */
    it("bloqueia a ação de status quando a lista está inativa", async () => {
      await montar({
        candidatos: [candidato("MARIA", "Ampla", { lista_ativa: false })],
        vagas: [vagaManual("VG-001", { ampla: 1 })],
      });
      expect(
        document.querySelector(
          '#convocacaoRows [data-convocacao-action="status"]',
        ),
      ).toBeNull();
      expect(
        document.querySelector("#convocacaoRows button[disabled]"),
      ).not.toBeNull();
    });

    it("abre o mesmo modal de status da lista de aprovados", async () => {
      await montar({
        candidatos: [candidato("MARIA", "Ampla")],
        vagas: [vagaManual("VG-001", { ampla: 1 })],
      });
      await abrirAbaDeConvocacao();
      await clicar(
        document.querySelector(
          '#convocacaoRows [data-convocacao-action="status"]',
        ),
      );
      expect($("approvedStatusModal")).not.toBeNull();
      expect($("approvedStatusCandidate")?.textContent).toBe(
        "MARIA · ENFERMEIRO",
      );
    });

    /*
    Edital sem modelo não inventa reserva: as vagas que o gestor digitou
    continuam de pé, todas como ampla. Nem mesmo quem declarou cota recebe
    posição reservada, porque não há regra que a crie.
  */
    it("sem modelo, as vagas saem todas como ampla", async () => {
      await montar({
        candidatos: [candidato("MARIA", '"Pretos e Pardos"')],
        comModelo: false,
        padraoImediata: 10,
      });
      const cabecalho =
        document.querySelector(".convocacao-grupo")?.textContent;
      expect(cabecalho).toContain("10 vagas imediatas");
      expect(cabecalho).toContain("AC 10");
      expect(cabecalho).not.toContain("PP");
    });

    it("some com as ações da lista de aprovados ao trocar de aba", async () => {
      await montar();
      const acoes = () =>
        $("approvedHeadActions")?.classList.contains("hidden");
      expect(acoes()).toBe(false);
      await abrirAbaDeConvocacao();
      expect(acoes()).toBe(true);
      expect($("approvedPanelAprovados")?.classList.contains("hidden")).toBe(
        true,
      );
      await clicar(document.querySelector('[data-approved-tab="aprovados"]'));
      expect(acoes()).toBe(false);
    });
  });

  describe("aba Lista de convocação do modal de listas", () => {
    it("só resume a chamada e leva às Regras do edital para editar", async () => {
      await montar({
        candidatos: [candidato("A", "Ampla", { codigo_vaga: "VG-001" })],
        padraoImediata: 3,
      });
      await esperar(() =>
        definido(controlador).openImportModal("7", "53/2025 · CASAI"),
      );
      await clicar(document.querySelector('[data-import-tab="convocacao"]'));
      const painel = $("approvedImportPanelConvocacao");
      expect(painel?.textContent).toContain("Com reserva de vagas");
      expect(painel?.textContent).toContain("3 por vaga (padrão)");
      expect($("convocacaoSalvar")).toBeNull();
      expect(painel?.querySelector("select, input")).toBeNull();
      window.navigate = vi.fn();
      // As Regras do edital são rota de Editais (src/app/navegacao.ts).
      try {
        await clicar(
          painel?.querySelector("[data-acao='editar-nas-regras-do-edital']"),
        );
        expect(window.navigate).toHaveBeenCalledWith("nucleo", {
          edital: "7",
          regras: "chamada",
        });
        expect($("approvedImportModal")).toBeNull();
      } finally {
        delete window.navigate;
        registrarTelas({});
      }
    });

    it("quem não configura a convocação vê o resumo sem o botão", async () => {
      await montar({
        candidatos: [candidato("A", "Ampla", { codigo_vaga: "VG-001" })],
      });
      await esperar(() =>
        definido(controlador).openImportModal("7", "53/2025 · CASAI"),
      );
      perfilAtual = { perfil: "usuario" };
      await esperar(() => definido(controlador).render());
      await clicar(document.querySelector('[data-import-tab="convocacao"]'));
      expect(
        $("approvedImportPanelConvocacao")?.querySelector(
          "[data-acao='editar-nas-regras-do-edital']",
        ),
      ).toBeNull();
    });
  });

  describe("formulário de convocação do edital", () => {
    it("lista as vagas que vieram da lista importada", async () => {
      await montar({
        candidatos: [
          candidato("A", "Ampla", { codigo_vaga: "VG-001" }),
          candidato("B", "Ampla", { codigo_vaga: "VG-001" }),
          candidato("C", "Ampla", { codigo_vaga: "VG-002", cargo: "MÉDICO" }),
        ],
      });
      await abrirFormulario();
      expect(
        [
          ...document.querySelectorAll<HTMLElement>("[data-convocacao-vaga]"),
        ].map((linha) => linha.dataset.convocacaoVaga),
      ).toEqual(["VG-001", "VG-002"]);
      expect($("convocacaoVagasResumo")?.textContent).toBe("2 vagas");
    });

    it("mostra o quadro derivado ao lado do total de cada vaga", async () => {
      await montar({
        candidatos: [candidato("A", "Ampla", { codigo_vaga: "VG-001" })],
        padraoImediata: 10,
      });
      await abrirFormulario();
      expect(
        document.querySelector(".convocacao-quadro-derivado")?.textContent,
      ).toBe("AC 6 · PP 3 · PCD 1");
    });

    it("redesenha o quadro da vaga enquanto se digita o total", async () => {
      await montar({
        candidatos: [candidato("A", "Ampla", { codigo_vaga: "VG-001" })],
      });
      await abrirFormulario();
      const campo = document.querySelector<HTMLInputElement>(
        "[data-convocacao-imediatas]",
      );
      await digitar(campo, "");
      // Apagar não repõe o "0": quem vai escrever "12" não fica com "012".
      expect(campo?.value).toBe("");
      await digitar(campo, "10");
      expect(
        document.querySelector(".convocacao-quadro-derivado")?.textContent,
      ).toBe("AC 6 · PP 3 · PCD 1");
    });

    it("resume o modelo e avisa quando ele é partilhado", async () => {
      await montar({
        candidatos: [candidato("A", "Ampla", { codigo_vaga: "VG-001" })],
        modelo: linhaDoModelo({ editais: 6 }),
      });
      await abrirFormulario();
      const resumo = $("convocacaoModeloResumo");
      expect(resumo?.textContent).toContain("PP 25%");
      expect(resumo?.textContent).toContain("usado por 6 editais");
      expect(resumo?.classList.contains("compartilhado")).toBe(true);
    });

    it("manda para a RPC o tipo, o modelo e as vagas", async () => {
      const { supabase } = await montar({
        candidatos: [
          candidato("A", "Ampla", { codigo_vaga: "VG-001" }),
          candidato("C", "Ampla", { codigo_vaga: "VG-002", cargo: "MÉDICO" }),
        ],
        padraoImediata: 4,
      });
      await abrirFormulario();

      supabase.rpc.mockClear();
      await clicar($("convocacaoSalvar"));

      const [nome, argumentos] = definido(supabase.rpc.mock.calls[0]);
      expect(nome).toBe("salvar_configuracao_convocacao");
      expect(argumentos?.p_edital_id).toBe("7");
      expect(argumentos?.p_modelo_id).toBe(MODELO_ID);
      expect(argumentos?.p_padrao_imediata).toBe(4);
      expect(argumentos?.p_vagas).toEqual([
        expect.objectContaining({ codigo_vaga: "VG-001", imediatas: 4 }),
        expect.objectContaining({ codigo_vaga: "VG-002", imediatas: 4 }),
      ]);
      // Salvar recarrega a página: a ordem de convocação depende destas vagas.
      expect(supabase.rpc).toHaveBeenCalledWith(
        "abrir_lista_aprovados",
        expect.objectContaining({ p_area: "saude-indigena" }),
      );
    });

    it("aplica o total padrão a todas as vagas", async () => {
      await montar({
        candidatos: [candidato("A", "Ampla", { codigo_vaga: "VG-001" })],
      });
      await abrirFormulario();
      await digitar($("convocacaoPadraoImediata"), "4");
      await clicar($("convocacaoAplicarPadrao"));
      expect(
        document.querySelector<HTMLInputElement>("[data-convocacao-imediatas]")
          ?.value,
      ).toBe("4");
    });

    /*
    Ligar a sobrescrita copia o quadro derivado para os campos: começar do zero
    faria a vaga perder, sem aviso, as vagas que o percentual já lhe dava.
  */
    it("ao ligar a sobrescrita manual, parte do quadro derivado", async () => {
      await montar({
        candidatos: [candidato("A", "Ampla", { codigo_vaga: "VG-001" })],
        padraoImediata: 4,
      });
      await abrirFormulario();
      await clicar(document.querySelector("[data-convocacao-manual]"));
      const campos = Object.fromEntries(
        [
          ...document.querySelectorAll<HTMLInputElement>(
            "[data-convocacao-vaga-cota]",
          ),
        ].map((campo) => [campo.dataset.convocacaoVagaCota, campo.value]),
      );
      expect(campos).toMatchObject({ ampla: "3", pretos_pardos: "1" });
    });

    it("tranca o formulário quando o perfil perde a permissão", async () => {
      await montar({
        candidatos: [candidato("A", "Ampla", { codigo_vaga: "VG-001" })],
      });
      await abrirFormulario();
      perfilAtual = { perfil: "usuario" };
      await esperar(() => definido(controlador).render());

      expect($("convocacaoSalvar")).toBeNull();
      expect(
        document.querySelector<HTMLInputElement>("[data-convocacao-vaga] input")
          ?.disabled,
      ).toBe(true);
      expect($("convocacaoPermissionNote")?.textContent).toContain(
        "Sem permissão",
      );
    });
  });

  describe("editor do modelo de regras", () => {
    const abrirEditor = async (opcoes = {}) => {
      const montado = await montar({
        candidatos: [candidato("A", "Ampla", { codigo_vaga: "VG-001" })],
        ...opcoes,
      });
      await abrirFormulario();
      await clicar($("convocacaoEditarModelo"));
      return montado;
    };
    const fichas = () =>
      [
        ...document.querySelectorAll<HTMLElement>(
          "[data-convocacao-categoria]",
        ),
      ].map((ficha) => ficha.dataset.convocacaoCategoria);

    it("desenha uma ficha por categoria do modelo", async () => {
      await abrirEditor();
      expect(fichas()).toEqual([
        "ampla",
        "pretos_pardos",
        "indigena",
        "quilombola",
        "pcd",
      ]);
    });

    /*
    O ponto todo do modelo configurável: acrescentar a reserva que o edital
    tem e o sistema não conhecia — como a cota trans do 97/2025.
  */
    it("acrescenta e remove categoria", async () => {
      await abrirEditor();
      await clicar($("convocacaoAdicionarCategoria"));
      expect(fichas()).toHaveLength(6);

      await clicar(
        document.querySelector(
          '[data-convocacao-categoria="pcd"] [data-convocacao-remover-categoria]',
        ),
      );
      expect(fichas()).not.toContain("pcd");
    });

    it("a ampla não tem percentual nem botão de remover", async () => {
      await abrirEditor();
      const ampla = document.querySelector(
        '[data-convocacao-categoria="ampla"]',
      );
      expect(
        ampla?.querySelector("[data-convocacao-remover-categoria]"),
      ).toBeNull();
      expect(ampla?.textContent).toContain("fica com o resto");
    });

    /* Trocar a distribuição faz aparecer os campos de posição do edital da FCC. */
    it("mostra os campos de posição ao escolher posições publicadas", async () => {
      await abrirEditor();
      expect(
        document.querySelector('[data-convocacao-cat="posicoes"]'),
      ).toBeNull();
      await escolher(
        document.querySelector('[data-convocacao-modelo="distribuicao"]'),
        "posicao_fixa",
      );
      expect(
        document.querySelector('[data-convocacao-cat="posicoes"]'),
      ).not.toBeNull();
    });

    it("manda o modelo inteiro para a RPC ao salvar", async () => {
      const { supabase } = await abrirEditor();
      await digitar(
        document.querySelector(
          '[data-convocacao-categoria="indigena"] [data-convocacao-cat="percentual"]',
        ),
        "7",
      );
      await digitar(
        document.querySelector(
          '[data-convocacao-categoria="indigena"] [data-convocacao-cat="termos"]',
        ),
        "indigena*; aldeado",
      );

      supabase.rpc.mockClear();
      await clicar($("convocacaoSalvarModelo"));

      const enviado = campoDe(
        definido(
          supabase.rpc.mock.calls.find(
            ([nome]) => nome === "salvar_modelo_convocacao",
          ),
        )[1],
        "p_modelo",
      );
      expect(campoDe(enviado, "id")).toBe(MODELO_ID);
      const categorias = campoDe(enviado, "categorias");
      const indigena = (Array.isArray(categorias) ? categorias : []).find(
        (c) => campoDe(c, "id") === "indigena",
      );
      expect(campoDe(indigena, "percentual")).toBe(7);
      // Os termos viajam como texto, que é como a coluna os guarda.
      expect(campoDe(indigena, "termos")).toBe("indigena*; aldeado");
      // Salvo, o editor fecha e as vagas voltam.
      expect(document.querySelector("[data-convocacao-categoria]")).toBeNull();
      expect($("convocacaoVagasBloco")?.classList.contains("hidden")).toBe(
        false,
      );
    });

    it("recusa percentuais que somem mais de 100%", async () => {
      const avisos: [string, string | undefined][] = [];
      const { supabase } = await abrirEditor({
        perfil: { perfil: "admin" },
        toast: (mensagem: string, tom?: string) => avisos.push([mensagem, tom]),
      });
      await digitar(
        document.querySelector(
          '[data-convocacao-categoria="pretos_pardos"] [data-convocacao-cat="percentual"]',
        ),
        "95",
      );

      supabase.rpc.mockClear();
      await clicar($("convocacaoSalvarModelo"));

      expect(supabase.rpc).not.toHaveBeenCalled();
      expect(avisos.at(-1)?.[1]).toBe("warn");
      expect(avisos.at(-1)?.[0]).toContain("105%");
    });

    /*
    Duplicar é a saída de quem quer mudar só o seu edital sem mexer nos outros
    que partilham o modelo.
  */
    it("duplicar abre uma cópia sem id, para virar modelo novo", async () => {
      await abrirEditor({ modelo: linhaDoModelo({ editais: 6 }) });
      expect(document.querySelector(".convocacao-editor-aviso")).not.toBeNull();

      await clicar($("convocacaoDuplicarModelo"));
      expect(
        document.querySelector<HTMLInputElement>(
          '[data-convocacao-modelo="nome"]',
        )?.value,
      ).toContain("(cópia)");
      expect($("convocacaoDuplicarModelo")).toBeNull();
      expect(document.querySelector(".convocacao-editor-aviso")).toBeNull();
    });

    it("remover pede confirmação, e o edital fica sem modelo", async () => {
      const { supabase } = await abrirEditor();
      supabase.rpc.mockClear();
      await clicar($("convocacaoRemoverModelo"));
      expect(supabase.rpc).toHaveBeenCalledWith("remover_modelo_convocacao", {
        p_modelo_id: MODELO_ID,
      });
      expect(entrada("convocacaoModelo")?.value).toBe("");
    });
  });

  describe("quadro manual e clareza do editor", () => {
    const abrir = async (opcoes = {}) => {
      await montar({
        candidatos: [candidato("A", "Ampla", { codigo_vaga: "VG-001" })],
        ...opcoes,
      });
      await abrirFormulario();
    };

    /*
    A sobrescrita manual mostra um campo por categoria do modelo — eram cinco,
    e a tela estava sem modelo escolhido, quando só existe a ampla.
  */
    it("a sobrescrita manual dá um campo por categoria do modelo", async () => {
      await abrir({ padraoImediata: 10 });
      await clicar(document.querySelector("[data-convocacao-manual]"));
      expect(
        [
          ...document.querySelectorAll<HTMLInputElement>(
            "[data-convocacao-vaga-cota]",
          ),
        ].map((campo) => campo.dataset.convocacaoVagaCota),
      ).toEqual(["ampla", "pretos_pardos", "indigena", "quilombola", "pcd"]);
    });

    /*
    O quadro de cada vaga é DERIVADO do modelo. Pedir números antes de haver
    regra mostraria um resultado que muda sozinho assim que o modelo aparece,
    então as vagas só entram em cena depois.
  */
    it("sem modelo, as vagas do edital não aparecem e a tela diz o que falta", async () => {
      await abrir({ comModelo: false, padraoImediata: 10 });
      expect($("convocacaoVagasBloco")?.classList.contains("hidden")).toBe(
        true,
      );
      const aviso = $("convocacaoVagasBloqueadas");
      expect(aviso?.classList.contains("hidden")).toBe(false);
      expect(aviso?.textContent).toContain("Escolha um modelo");
    });

    it("escolher um modelo traz as vagas de volta", async () => {
      await abrir({ comModelo: false, padraoImediata: 10 });
      await escolher($("convocacaoModelo"), MODELO_ID);
      expect($("convocacaoVagasBloco")?.classList.contains("hidden")).toBe(
        false,
      );
    });

    /* Uma tarefa de cada vez: enquanto se mexe no modelo, as vagas saem da frente. */
    it("com o editor aberto, as vagas saem da frente e voltam ao fechar", async () => {
      await abrir({ padraoImediata: 4 });
      const escondido = () =>
        $("convocacaoVagasBloco")?.classList.contains("hidden");
      expect(escondido()).toBe(false);

      await clicar($("convocacaoEditarModelo"));
      expect(escondido()).toBe(true);
      expect($("convocacaoVagasBloqueadas")?.textContent).toContain(
        "Termine o modelo",
      );

      await clicar($("convocacaoCancelarModelo"));
      expect(escondido()).toBe(false);
    });

    /*
    Modelo que existe mas não tem reserva nenhuma: as vagas aparecem — o gestor
    declarou que elas existem —, mas a sobrescrita manual não, porque só haveria
    uma coluna e ela não distribui nada.
  */
    it("modelo só com ampla mostra as vagas, mas tranca a sobrescrita manual", async () => {
      const soAmpla = linhaDoModelo({
        categorias: [
          {
            id: "ampla",
            rotulo: "Ampla concorrência",
            sigla: "AC",
            ampla: true,
            termos: "ampla*",
            posicoes: "",
            cascata: "",
          },
        ],
      });
      await abrir({ modelo: soAmpla, padraoImediata: 10 });
      expect($("convocacaoVagasBloco")?.classList.contains("hidden")).toBe(
        false,
      );
      const manual = document.querySelector<HTMLButtonElement>(
        "[data-convocacao-manual]",
      );
      expect(manual?.disabled).toBe(true);
      expect(manual?.title).toContain("modelo de regras");
    });

    /* A ordem da cascata decide quem recebe a vaga; tem de estar visível. */
    it("numera a cascata na ordem em que será tentada", async () => {
      await abrir();
      await clicar($("convocacaoEditarModelo"));
      const quilombola = document.querySelector(
        '[data-convocacao-categoria="quilombola"]',
      );
      const marcadas = [
        ...definido(quilombola).querySelectorAll(
          ".convocacao-cascata-item.marcada",
        ),
      ].map((item) => item.textContent.replace(/\s+/g, " ").trim());
      expect(marcadas).toEqual(["1º IND", "2º PP"]);
    });

    it("a numeração acompanha a ordem em que se marca", async () => {
      await abrir();
      await clicar($("convocacaoEditarModelo"));
      const pcd = () =>
        document.querySelector('[data-convocacao-categoria="pcd"]');
      await clicar(
        pcd()?.querySelector('[data-convocacao-cascata="quilombola"]'),
      );
      await clicar(
        pcd()?.querySelector('[data-convocacao-cascata="indigena"]'),
      );
      const marcadas = [
        ...definido(pcd()).querySelectorAll(".convocacao-cascata-item.marcada"),
      ].map((item) => item.textContent.replace(/\s+/g, " ").trim());
      expect(marcadas).toEqual(["1º QUI", "2º IND"]);
    });

    /*
    As duas escolhas do modelo não se explicam pelo rótulo, e a ajuda num
    `title` ninguém descobre.
  */
    it("mostra a ajuda da opção escolhida, e troca com ela", async () => {
      await abrir();
      await clicar($("convocacaoEditarModelo"));
      const ajudas = () =>
        [...document.querySelectorAll(".convocacao-editor-ajuda")]
          .map((item) => item.textContent)
          .join(" ");
      expect(ajudas()).toContain("pretos e pardos (25%)");
      await escolher(
        document.querySelector('[data-convocacao-modelo="cotaMultipla"]'),
        "acumula_com_acumulavel",
      );
      expect(ajudas()).toContain("guarda as DUAS reservas");
    });

    it("não pede mais o fundamento: o nome do modelo já identifica a regra", async () => {
      await abrir();
      await clicar($("convocacaoEditarModelo"));
      expect(
        document.querySelector('[data-convocacao-modelo="descricao"]'),
      ).toBeNull();
      expect(
        document.querySelector('[data-convocacao-modelo="nome"]'),
      ).not.toBeNull();
    });
  });

  describe("armadilha da cota acumulável", () => {
    /*
    Escolher "só quando uma delas for a cota acumulável" sem marcar nenhuma
    categoria faz a regra degradar em silêncio para "só a de maior percentual".
    O gestor ficaria a achar que configurou o 91/2026.
  */
    it("avisa quando a regra de acumulação não tem categoria marcada", async () => {
      await montar({
        candidatos: [candidato("A", "Ampla", { codigo_vaga: "VG-001" })],
      });
      await abrirFormulario();
      await clicar($("convocacaoEditarModelo"));
      expect(document.querySelector(".convocacao-editor-aviso")).toBeNull();

      await escolher(
        document.querySelector('[data-convocacao-modelo="cotaMultipla"]'),
        "acumula_com_acumulavel",
      );
      const aviso = document.querySelector(".convocacao-editor-aviso");
      expect(aviso).not.toBeNull();
      expect(aviso?.textContent).toContain("acumulável");

      // Marcar a caixa de PCD resolve, e o aviso sai.
      await clicar(
        document.querySelector(
          '[data-convocacao-categoria="pcd"] [data-convocacao-cat="acumulavel"]',
        ),
      );
      expect(document.querySelector(".convocacao-editor-aviso")).toBeNull();
    });
  });

  describe("escolha da base de um modelo novo", () => {
    beforeEach(async () => {
      await montar({
        candidatos: [candidato("A", "Ampla", { codigo_vaga: "VG-001" })],
      });
      await abrirFormulario();
    });

    const siglas = () =>
      [
        ...document.querySelectorAll<HTMLElement>(
          "[data-convocacao-categoria]",
        ),
      ].map((ficha) => ficha.dataset.convocacaoCategoria);

    /*
    São quatro formatos distintos entre os editais lidos. Reescrever qualquer um
    deles à mão convida ao erro, então a criação parte de um catálogo.
  */
    it("oferece os formatos de edital já lidos, mais o branco", async () => {
      await clicar($("convocacaoNovoModelo"));
      const bases = [
        ...document.querySelectorAll<HTMLElement>("[data-convocacao-base]"),
      ].map((botao) => botao.dataset.convocacaoBase);
      expect(bases).toContain("mgi-simulador");
      expect(bases).toContain("saude-indigena-91-2026");
      // Os que repetiam o do MGI saíram do catálogo.
      expect(bases).not.toContain("lei-15142-2025");
      expect(bases).not.toContain("fgv-minimos-por-cargo");
      expect(bases).toContain("lei-15142-reserva-unica");
      expect(bases).toContain("etnico-racial-posicoes");
      expect(bases).toContain("");
    });

    it("troca as categorias ao trocar de base", async () => {
      await clicar($("convocacaoNovoModelo"));
      expect(siglas()).toContain("pretos_pardos");
      await clicar(
        document.querySelector(
          '[data-convocacao-base="lei-15142-reserva-unica"]',
        ),
      );
      expect(siglas()).toEqual(["ampla", "ppiq", "pcd"]);
      await clicar(document.querySelector('[data-convocacao-base=""]'));
      expect(siglas()).toEqual(["ampla"]);
    });

    /* O nome é do edital, não da regra: sobrevive à troca de base. */
    it("preserva o nome já digitado ao trocar de base", async () => {
      await clicar($("convocacaoNovoModelo"));
      await digitar(
        document.querySelector('[data-convocacao-modelo="nome"]'),
        "Projeto Caminhoneiros — 96/2025",
      );
      await clicar(
        document.querySelector(
          '[data-convocacao-base="etnico-racial-posicoes"]',
        ),
      );
      expect(
        document.querySelector<HTMLInputElement>(
          '[data-convocacao-modelo="nome"]',
        )?.value,
      ).toBe("Projeto Caminhoneiros — 96/2025");
    });

    /* Modelo já salvo não oferece base: trocá-la apagaria o que está configurado. */
    it("não oferece base ao editar um modelo existente", async () => {
      await clicar($("convocacaoEditarModelo"));
      expect(document.querySelector("[data-convocacao-base]")).toBeNull();
    });
  });

  describe("prévia da ordem de chamada", () => {
    const faixa = (id: string) =>
      [...document.querySelectorAll(`#${id} .convocacao-previa-posicao`)].map(
        (item) => item.textContent,
      );
    const vaga = (codigo: string, imediatas: number) => ({
      codigo_vaga: codigo,
      cargo: null,
      imediatas,
      manual: false,
      quadro: {},
    });

    it("mostra a ordem do modelo escolhido com as vagas da maior vaga", async () => {
      await montar({
        modelo: linhaDoModelo({}, "mgi-simulador"),
        vagas: [vaga("VG-001", 10), vaga("VG-002", 45)],
      });
      await abrirFormulario();
      expect(entrada("convocacaoPreviaDoModeloTotal")?.value).toBe("45");
      const posicoes = faixa("convocacaoPreviaDoModelo");
      expect(posicoes).toHaveLength(45);
      expect(posicoes[1]).toBe("2ªPP");
      expect(posicoes[4]).toBe("5ªPCD");
      expect(posicoes[16]).toBe("17ªIND");
      expect($("convocacaoPreviaDoModelo")?.textContent).toContain(
        "1ª vaga na 25ª posição",
      );

      // 25% de 6 = 1,5, que sobe para 2: pretos e pardos na 2ª e na 6ª.
      await digitar($("convocacaoPreviaDoModeloTotal"), "6");
      expect(faixa("convocacaoPreviaDoModelo")).toEqual([
        "1ªAC",
        "2ªPP",
        "3ªAC",
        "4ªAC",
        "5ªPCD",
        "6ªPP",
      ]);
    });

    it("no editor, acompanha o rascunho e a troca para a ordem do MGI", async () => {
      await montar({ vagas: [vaga("VG-001", 45)] });
      await abrirFormulario();
      await clicar($("convocacaoEditarModelo"));
      expect(faixa("convocacaoPreviaDoEditor")[4]).toBe("5ªAC");
      await escolher(
        document.querySelector('[data-convocacao-modelo="distribuicao"]'),
        "serie_mgi",
      );
      expect(faixa("convocacaoPreviaDoEditor")[4]).toBe("5ªPCD");
      // A série da PCD fica escrita na ficha, e não escondida no cálculo.
      expect(
        document.querySelector('[data-convocacao-regras="pcd"]')?.textContent,
      ).toContain("posições 5ª, 21ª e depois de 20 em 20");
    });

    it("os modelos prontos aparecem em cartões com o que cada um faz", async () => {
      await montar();
      await abrirFormulario();
      await clicar($("convocacaoNovoModelo"));
      const cartao = (id: string) =>
        document.querySelector(`[data-convocacao-base="${id}"]`);
      expect(cartao("mgi-simulador")?.getAttribute("aria-pressed")).toBe(
        "true",
      );
      expect(cartao("saude-indigena-91-2026")?.textContent).toContain(
        "PCD vaga vai para os indígenas",
      );
      expect(cartao("saude-indigena-2026")?.textContent).toContain(
        "PCD vaga vai para a ampla",
      );
      await clicar(cartao("saude-indigena-91-2026"));
      expect(
        cartao("saude-indigena-91-2026")?.getAttribute("aria-pressed"),
      ).toBe("true");
      expect(cartao("mgi-simulador")?.getAttribute("aria-pressed")).toBe(
        "false",
      );
      expect(
        document.querySelector<HTMLInputElement>(
          '[data-convocacao-modelo="distribuicao"]',
        )?.value,
      ).toBe("serie_mgi");
    });
  });

  /* O modelo salvo antes da ordem do MGI não muda sozinho: a prévia diz a regra e oferece a troca. */
  describe("modelo salvo com a ordem antiga", () => {
    it("a prévia diz a regra e o botão abre o editor já na ordem do MGI", async () => {
      await montar({
        vagas: [
          {
            codigo_vaga: "VG-001",
            cargo: null,
            imediatas: 45,
            manual: false,
            quadro: {},
          },
        ],
      });
      await abrirFormulario();
      const regra = () =>
        document.querySelector<HTMLElement>(
          "#convocacaoPreviaDoModelo [data-convocacao-previa-regra]",
        );
      expect(regra()?.dataset.convocacaoPreviaRegra).toBe("proporcional");
      await clicar($("convocacaoUsarOrdemDoMgi"));
      expect(
        document.querySelector<HTMLInputElement>(
          '[data-convocacao-modelo="distribuicao"]',
        )?.value,
      ).toBe("serie_mgi");
      const quinta = document.querySelectorAll(
        "#convocacaoPreviaDoEditor .convocacao-previa-posicao",
      )[4];
      expect(quinta?.textContent).toBe("5ªPCD");
      // É o mesmo modelo, editado: salvar muda a regra dele.
      expect($("convocacaoDuplicarModelo")).not.toBeNull();
    });

    it("modelo já na ordem do MGI não oferece a troca", async () => {
      await montar({ modelo: linhaDoModelo({}, "mgi-simulador") });
      await abrirFormulario();
      expect($("convocacaoUsarOrdemDoMgi")).toBeNull();
    });
  });
});

bloco("componentes/pendencias-do-edital", () => {
  type TelaDosAprovados = ReturnType<typeof criarListaAprovados>;

  /*
  A aba Pendências da Lista de aprovados (migration 20261026190000), com dados
  fictícios: o selo com as abertas, os indicadores por tipo, o filtro de
  edital, o botão Decidir só para quem o banco diz que pode, o modal que pede
  a escolha e o motivo e manda a RPC certa, e o caso do aviso de conferência
  que abre a aba no edital.
*/

  beforeEach(() =>
    publicarLinhasDoMonitoramento(
      ["e1", "e2"].map((id) => ({ id, CO_AREA: "saude-indigena" })),
    ),
  );
  afterEach(() => redefinirDadosDoMonitoramento());

  const linha = (id: string, extra: Record<string, unknown> = {}) => ({
    id,
    nome: `Pessoa Fictícia ${id}`,
    cargo: "Enfermeiro",
    vaga: "100",
    modalidade: "Ampla Concorrência",
    posicao: 1,
    nota: 80,
    status: "",
    matricula: "",
    convocado_em: null,
    lista_ativa: true,
    removida: false,
    ...extra,
  });

  const PENDENCIAS = (podeDecidir = true) => [
    {
      id: "p-listas",
      tipo: "CONTRATADO_EM_DUAS_LISTAS",
      situacao: "ABERTA",
      edital_id: "e1",
      edital: "01/2026",
      unidade: "DSEI Fictício",
      detalhe: { linhas: 2, motivo: "NENHUMA_ALCANCADA" },
      detectada_em: "2026-10-26T09:00:00Z",
      pode_decidir: podeDecidir,
      linhas: [
        linha("a1", { status: "Contratado", matricula: "M-1" }),
        linha("a2", {
          status: "Contratado",
          matricula: "M-1",
          modalidade: "PPIQ",
          vaga: "101",
        }),
      ],
      historico: [],
    },
    {
      id: "p-posicao",
      tipo: "POSICAO_REPETIDA",
      situacao: "ABERTA",
      edital_id: "e2",
      edital: "02/2026",
      unidade: "CASAI Fictícia",
      detalhe: { linhas: 2, posicao: 7 },
      detectada_em: "2026-10-26T09:00:00Z",
      pode_decidir: podeDecidir,
      linhas: [linha("b1", { posicao: 7 }), linha("b2", { posicao: 7 })],
      historico: [],
    },
    {
      id: "p-convocado",
      tipo: "CONVOCADO_SEM_DESFECHO",
      situacao: "ABERTA",
      edital_id: "e2",
      edital: "02/2026",
      unidade: "CASAI Fictícia",
      detalhe: { linhas: 1, convocado_em: "2026-09-01", dias: 55, prazo: 15 },
      detectada_em: "2026-10-26T09:00:00Z",
      pode_decidir: podeDecidir,
      linhas: [
        linha("c1", { status: "Convocado", convocado_em: "2026-09-01" }),
      ],
      historico: [],
    },
    {
      id: "p-resolvida",
      tipo: "PESSOA_REPETIDA",
      situacao: "RESOLVIDA",
      edital_id: "e1",
      edital: "01/2026",
      unidade: "DSEI Fictício",
      detalhe: { linhas: 2 },
      detectada_em: "2026-10-20T09:00:00Z",
      decisao: "LINHA_MANTIDA",
      motivo: "Duplicada na importação",
      decidida_em: "2026-10-21T12:00:00Z",
      decidida_por: "Gestora Fictícia",
      pode_decidir: podeDecidir,
      linhas: [linha("d1"), linha("d2", { removida: true })],
      historico: [
        {
          evento: "DECISAO",
          decisao: "LINHA_MANTIDA",
          motivo: "Duplicada na importação",
          por: "Gestora Fictícia",
          em: "2026-10-21T12:00:00Z",
          alteracoes: [
            { candidato: "d2", campo: "removido", antes: false, depois: true },
          ],
        },
      ],
    },
  ];

  function supabaseFalso({
    podeDecidir = true,
  }: { podeDecidir?: boolean } = {}) {
    const banco: { pendencias: Record<string, unknown>[] } = {
      pendencias: PENDENCIAS(podeDecidir),
    };
    const responderRpc = (
      nome: string,
      argumentos?: Record<string, unknown>,
    ): Promise<RespostaDoTeste> => {
      if (nome === "listar_pendencias_do_edital")
        return Promise.resolve({
          data: {
            schema_version: 1,
            area: definido(argumentos).p_area,
            pendencias: banco.pendencias,
          },
          error: null,
        });
      if (nome === "listar_candidatos_aprovados_compacto")
        return Promise.resolve({
          data: compactarPorArea([], {
            area:
              typeof argumentos?.p_area === "string"
                ? argumentos.p_area
                : undefined,
            versao: "v1",
          }),
          error: null,
        });
      if (nome === "escolher_lista_da_contratacao") {
        banco.pendencias = banco.pendencias.map((p) =>
          p.id === definido(argumentos).p_pendencia
            ? { ...p, situacao: "RESOLVIDA", decisao: "LISTA_ESCOLHIDA" }
            : p,
        );
        return Promise.resolve({ data: { ok: true }, error: null });
      }
      if (nome === "confirmar_empate_da_posicao")
        return Promise.resolve({
          data: null,
          error: {
            message: "Sem permissão para decidir as pendências deste edital",
          },
        });
      const resposta: Promise<RespostaDoTeste> & { range: () => unknown } =
        Object.assign(Promise.resolve({ data: [], error: null }), {
          range: () => resposta,
        });
      return resposta;
    };
    // A abertura da página numa chamada, montada com as respostas acima.
    const rpc = vi.fn((nome: string, argumentos?: Record<string, unknown>) =>
      nome === "abrir_lista_aprovados"
        ? aberturaPelasChamadasDeAntes(responderRpc, argumentos)
        : responderRpc(nome, argumentos),
    );
    return { rpc, storage: { from: vi.fn() } };
  }

  let controlador: (TelaDosAprovados & { raiz: Root | null }) | null = null;

  async function montar(opcoes: { podeDecidir?: boolean } = {}) {
    document.body.innerHTML = `<section id="page-approved" class="page active"></section>`;
    const supabase = supabaseFalso(opcoes);
    const toast = vi.fn();
    await act(async () => {
      controlador = montarTela<OpcoesDaTelaDosAprovados, TelaDosAprovados>(
        criarListaAprovados,
        "page-approved",
        {
          secao: document.getElementById("page-approved"),
          supabase,
          toast,
          getProfile: () => ({ perfil: "edital_gestor" }),
          hoje: () => "2026-10-26",
        },
      );
    });
    await esperar(() => definido(controlador).render());
    await esperar(() =>
      definido(controlador).pendencias.carregar("saude-indigena"),
    );
    return { supabase, toast };
  }

  afterEach(async () => {
    await act(async () => controlador?.raiz?.unmount());
    controlador = null;
    document.body.innerHTML = "";
  });

  /* O elemento que o teste sabe que existe, pelo id. */
  const $ = (id: string) => achar(`#${id}`);
  const cartoes = () =>
    acharTodos("#approvedPanelPendencias .pendencia-cartao");

  describe("aba Pendências", () => {
    it("o selo vem com a abertura da página; abrir a aba não lê de novo", async () => {
      document.body.innerHTML = `<section id="page-approved" class="page active"></section>`;
      const supabase = supabaseFalso();
      await act(async () => {
        controlador = montarTela<OpcoesDaTelaDosAprovados, TelaDosAprovados>(
          criarListaAprovados,
          "page-approved",
          {
            secao: document.getElementById("page-approved"),
            supabase,
            toast: vi.fn(),
            getProfile: () => ({ perfil: "edital_gestor" }),
            hoje: () => "2026-10-26",
          },
        );
      });
      await esperar(() => definido(controlador).render());
      expect($("approvedPendenciasSelo").textContent).toBe("3");
      await clicar($("approvedTabPendencias"));
      expect(cartoes()).toHaveLength(3);
      expect(supabase.rpc.mock.calls.map(([nome]) => nome)).toEqual([
        "abrir_lista_aprovados",
      ]);
    });

    it("carregando: blocos no lugar dos cartões, sem linha de tabela solta", async () => {
      document.body.innerHTML = `<section id="page-approved" class="page active"></section>`;
      await act(async () => {
        controlador = montarTela<OpcoesDaTelaDosAprovados, TelaDosAprovados>(
          criarListaAprovados,
          "page-approved",
          {
            secao: document.getElementById("page-approved"),
            supabase: supabaseFalso(),
            toast: vi.fn(),
            getProfile: () => ({ perfil: "edital_gestor" }),
            hoje: () => "2026-10-26",
          },
        );
      });
      const painel = $("approvedPanelPendencias");
      // <tr> fora de <table> é HTML inválido (o React avisa e o navegador o descarta).
      expect(painel.querySelectorAll("tr")).toHaveLength(0);
      expect(
        painel.querySelectorAll(".pendencias-lista .ui-esqueleto-bloco"),
      ).toHaveLength(4);
    });

    it("é a terceira aba, com o selo das abertas", async () => {
      await montar();
      const aba = $("approvedTabPendencias");
      expect(aba.getAttribute("role")).toBe("tab");
      expect($("approvedPendenciasSelo").textContent).toBe("3");
      await clicar(aba);
      expect($("approvedPanelPendencias").classList.contains("hidden")).toBe(
        false,
      );
      expect($("approvedPanelAprovados").classList.contains("hidden")).toBe(
        true,
      );
    });

    it("mostra as abertas com o detalhe; indicadores por tipo filtram", async () => {
      await montar();
      await clicar($("approvedTabPendencias"));
      expect(cartoes().map((c) => c.dataset.tipo)).toEqual([
        "CONTRATADO_EM_DUAS_LISTAS",
        "POSICAO_REPETIDA",
        "CONVOCADO_SEM_DESFECHO",
      ]);
      expect(cartoes()[1]?.textContent).toContain(
        "Posição 7 em 2 linhas da mesma vaga e modalidade",
      );
      expect(cartoes()[2]?.textContent).toContain(
        "Convocado em 01/09/2026, há 55 dias",
      );
      await clicar(
        document.querySelector(
          '#approvedPanelPendencias [data-kpi="POSICAO_REPETIDA"] .ui-kpi-alvo',
        ),
      );
      expect(cartoes().map((c) => c.dataset.tipo)).toEqual([
        "POSICAO_REPETIDA",
      ]);
    });

    it("filtra por edital e mostra as resolvidas com decisão, motivo e histórico", async () => {
      await montar();
      await clicar($("approvedTabPendencias"));
      const edital = achar<HTMLSelectElement>(
        "#approvedPanelPendencias .pendencias-filtros select",
      );
      expect([...edital.options].map((o) => o.textContent)).toEqual([
        "Todos os editais",
        "01/2026 · DSEI Fictício (1)",
        "02/2026 · CASAI Fictícia (2)",
      ]);
      await escolher(edital, "e1");
      expect(cartoes()).toHaveLength(1);
      const resolvidas = [
        ...document.querySelectorAll(
          "#approvedPanelPendencias .ui-segmentado-opcao",
        ),
      ].find((b) => b.textContent?.includes("Resolvidas"));
      await clicar(resolvidas);
      expect(cartoes()).toHaveLength(1);
      expect(cartoes()[0]?.textContent).toContain(
        "Linha mantida, a outra saiu",
      );
      expect(cartoes()[0]?.textContent).toContain(
        "Motivo: Duplicada na importação",
      );
      expect(cartoes()[0]?.textContent).toContain("saiu da lista");
      expect(cartoes()[0]?.querySelector("[data-acao='decidir']")).toBeNull();
    });

    it("decidir: escolhe a lista, motivo obrigatório, manda a RPC e recarrega", async () => {
      const { supabase, toast } = await montar();
      await clicar($("approvedTabPendencias"));
      await clicar(cartoes()[0]?.querySelector("[data-acao='decidir']"));
      expect(document.getElementById("pendenciaModal")).not.toBeNull();
      const modal = $("pendenciaModal");
      // Sem escolha e sem motivo: a tela recusa antes do banco.
      await clicar(modal.querySelector("[data-acao='gravar-decisao']"));
      expect(achar(".pendencia-erro", modal).textContent).toMatch(/motivo/);
      await digitar(modal.querySelector("textarea"), "Contratada pela ampla");
      await clicar(modal.querySelector("[data-acao='gravar-decisao']"));
      expect(achar(".pendencia-erro", modal).textContent).toMatch(/lista/);
      await clicar(modal.querySelector("input[type='radio'][value='a1']"));
      await clicar(modal.querySelector("[data-acao='gravar-decisao']"));
      await esperar(() => Promise.resolve());
      expect(supabase.rpc).toHaveBeenCalledWith(
        "escolher_lista_da_contratacao",
        {
          p_pendencia: "p-listas",
          p_motivo: "Contratada pela ampla",
          p_candidato: "a1",
        },
      );
      expect(toast).toHaveBeenCalledWith("Decisão registrada.", "success");
      expect(document.getElementById("pendenciaModal")).toBeNull();
      expect($("approvedPendenciasSelo").textContent).toBe("2");
      // A lista de aprovados recarrega (status mudou lá).
      expect(
        supabase.rpc.mock.calls.filter(([n]) => n === "abrir_lista_aprovados")
          .length,
      ).toBeGreaterThan(1);
    });

    it("o erro do banco fica no modal (permissão)", async () => {
      await montar();
      await clicar($("approvedTabPendencias"));
      await clicar(cartoes()[1]?.querySelector("[data-acao='decidir']"));
      const modal = $("pendenciaModal");
      await clicar(
        [...modal.querySelectorAll(".ui-segmentado-opcao")].find((b) =>
          b.textContent?.includes("Empate previsto"),
        ),
      );
      await digitar(modal.querySelector("textarea"), "Empate do item 9.3");
      await clicar(modal.querySelector("[data-acao='gravar-decisao']"));
      await esperar(() => Promise.resolve());
      expect(
        achar(".pendencia-erro", $("pendenciaModal")).textContent,
      ).toContain("Sem permissão");
    });

    it("Convocado: nova data ou desfecho com matrícula, validados", async () => {
      const { supabase } = await montar();
      await clicar($("approvedTabPendencias"));
      await clicar(cartoes()[2]?.querySelector("[data-acao='decidir']"));
      const modal = $("pendenciaModal");
      await escolher(modal.querySelector("select"), "Contratado");
      await digitar(modal.querySelector("textarea"), "Assinou o contrato");
      await clicar(modal.querySelector("[data-acao='gravar-decisao']"));
      expect(achar(".pendencia-erro", modal).textContent).toMatch(/matrícula/);
      await escolher(modal.querySelector("select"), "Convocado");
      await digitar(modal.querySelector("input[type='date']"), "2026-10-30");
      await clicar(modal.querySelector("[data-acao='gravar-decisao']"));
      expect(achar(".pendencia-erro", modal).textContent).toMatch(/futura/);
      await digitar(modal.querySelector("input[type='date']"), "2026-10-20");
      await clicar(modal.querySelector("[data-acao='gravar-decisao']"));
      await esperar(() => Promise.resolve());
      expect(supabase.rpc).toHaveBeenCalledWith(
        "registrar_desfecho_da_pendencia",
        {
          p_pendencia: "p-convocado",
          p_motivo: "Assinou o contrato",
          p_status: "Convocado",
          p_matricula: null,
          p_data_convocacao: "2026-10-20",
        },
      );
    });

    it("quem não pode decidir vê as pendências sem o botão Decidir", async () => {
      await montar({ podeDecidir: false });
      await clicar($("approvedTabPendencias"));
      expect(cartoes()).toHaveLength(3);
      expect(
        document.querySelector(
          "#approvedPanelPendencias [data-acao='decidir']",
        ),
      ).toBeNull();
    });

    it("o caso de um aviso de conferência abre a aba no edital", async () => {
      await montar();
      await act(async () =>
        pedirFiltro("approved", {
          pendencias: true,
          edital: "e2",
          candidatos: ["c1"],
        }),
      );
      expect($("approvedTabPendencias").getAttribute("aria-selected")).toBe(
        "true",
      );
      expect(cartoes().map((c) => c.dataset.pendencia)).toEqual([
        "p-posicao",
        "p-convocado",
      ]);
    });
  });
});

bloco("lib/carta-de-convocacao", () => {
  /*
  A carta de convocação sem DOM. Os testes seguem as histórias de
  docs/historias-de-usuario/lista-de-aprovados.md ("Manter o modelo da carta",
  "Emitir a carta de convocação").
*/

  const ANA = {
    candidato_id: "ana",
    nome: "Ana Ribeiro",
    cargo: "Enfermeiro",
    codigo_vaga: "VG-1",
    unidade: "DSEI Manaus",
    edital: "03/2025",
    edital_id: "10",
    classificacao: 2,
    modalidade: '"Pessoa negra"',
    status: "",
  };
  const BRUNO = {
    ...ANA,
    candidato_id: "bruno",
    nome: "Bruno Lima",
    classificacao: 3,
  };
  const EMISSAO = {
    dataLimite: "2026-10-12",
    local: "Sede do DSEI Manaus",
    documentos: "RG\n- CPF\n3) Comprovante de residência",
    contato: "rh@agsus.org.br",
  };
  const VIGENTE = {
    titulo: "CARTA DE CONVOCAÇÃO",
    texto: [
      "Prezado(a) **{NOME}**,",
      "",
      "Convocamos para o cargo de {CARGO} (vaga {VAGA}, {LOTAÇÃO/UNIDADE}), Edital {EDITAL}, {POSIÇÃO}ª posição, {Modalidade}.",
      "Apresente-se até {DATA_LIMITE} em {LOCAL}, com:",
      "{DOCUMENTOS}",
      "- Leve também {DOCUMENTOS}.",
      "Dúvidas: {CONTATO}.",
    ].join("\n"),
  };
  const MODELO = { id: "m1", nome: "Padrão", versao: 2, vigente: VIGENTE };

  describe("campos do modelo", () => {
    it("aceita acento, caixa e LOTAÇÃO/UNIDADE", () => {
      expect(chaveDoCampo("Lotação/Unidade")).toBe("LOTACAO");
      expect(chaveDoCampo("POSIÇÃO")).toBe("POSICAO");
      expect(chaveDoCampo("data limite")).toBe("DATA_LIMITE");
      expect(camposUsados(VIGENTE.titulo, VIGENTE.texto)).toEqual([
        "NOME",
        "CARGO",
        "VAGA",
        "LOTACAO",
        "EDITAL",
        "POSICAO",
        "MODALIDADE",
        "DATA_LIMITE",
        "LOCAL",
        "DOCUMENTOS",
        "CONTATO",
      ]);
    });

    it("aponta o campo que a carta não conhece", () => {
      expect(camposDesconhecidos("Olá {NOME}, {MATRICULA} e {RG}")).toEqual([
        "MATRICULA",
        "RG",
      ]);
    });

    it("CPF só mascarado, e só com 11 dígitos", () => {
      expect(mascararCpf("123.456.789-01")).toBe("***.456.789-**");
      expect(mascararCpf("12345678901")).toBe("***.456.789-**");
      expect(mascararCpf("123")).toBe("");
      expect(mascararCpf(null)).toBe("");
    });

    it("data limite padrão em dias corridos, e hoje em Brasília", () => {
      expect(dataLimitePadrao("2026-10-28", 5)).toBe("2026-11-02");
      expect(dataLimitePadrao("2026-10-05", 0)).toBe("2026-10-05");
      expect(dataLimitePadrao("x", 5)).toBe("");
      // 02:00 UTC de 6/10 ainda é 5/10 em Brasília.
      expect(hojeEmBrasilia(new Date("2026-10-06T02:00:00Z"))).toBe(
        "2026-10-05",
      );
    });
  });

  describe("preencher a carta (história: Emitir a carta de convocação)", () => {
    it("troca os campos do candidato e da emissão; {DOCUMENTOS} sozinho vira itens", () => {
      const carta = preencherCarta(VIGENTE, ANA, {
        ...EMISSAO,
        data: "2026-10-05",
      });
      expect(carta.titulo).toBe("CARTA DE CONVOCAÇÃO");
      expect(carta.blocos[0]).toEqual({
        tipo: "paragrafo",
        texto: "Prezado(a) **Ana Ribeiro**,",
      });
      expect(carta.blocos[1]?.texto).toBe(
        "Convocamos para o cargo de Enfermeiro (vaga VG-1, DSEI Manaus), Edital 03/2025, 2ª posição, Pessoa negra.",
      );
      expect(carta.blocos[2]?.texto).toBe(
        "Apresente-se até 12/10/2026 em Sede do DSEI Manaus, com:",
      );
      expect(carta.blocos.slice(3, 6)).toEqual([
        { tipo: "item", texto: "RG" },
        { tipo: "item", texto: "CPF" },
        { tipo: "item", texto: "Comprovante de residência" },
      ]);
      // No meio do texto, os documentos vão separados por ponto e vírgula.
      expect(carta.blocos[6]).toEqual({
        tipo: "item",
        texto: "Leve também RG; CPF; Comprovante de residência.",
      });
      expect(carta.faltando).toEqual([]);
    });

    it("campo sem valor sai em branco e é anotado; desconhecido fica como está", () => {
      const carta = preencherCarta(
        { titulo: "Carta", texto: "CPF {CPF}; {MATRICULA}" },
        ANA,
        {},
      );
      expect(carta.blocos[0]?.texto).toBe(
        `CPF ${ESPACO_EM_BRANCO}; {MATRICULA}`,
      );
      expect(carta.faltando).toEqual(["CPF"]);
      expect(
        preencherCarta(
          { titulo: "C", texto: "CPF {CPF}" },
          { ...ANA, cpf: "12345678901" },
          {},
        ).blocos[0]?.texto,
      ).toBe("CPF ***.456.789-**");
    });
  });

  describe("validar o modelo (história: Manter o modelo da carta)", () => {
    it("o padrão é válido e avisa só do que importa", () => {
      expect(validarModelo(rascunhoDoModelo(null))).toEqual({
        erros: [],
        avisos: [],
      });
    });

    it("recusa nome curto, campo desconhecido e chave sem par", () => {
      const { erros } = validarModelo({
        nome: "X",
        titulo: "Carta",
        texto: "Olá {NOME}, {RG} e {CARGO",
      });
      expect(erros).toContain(
        "O nome do modelo deve ter de 3 a 120 caracteres.",
      );
      expect(erros).toContain("Campo desconhecido: {RG}.");
      expect(erros).toContain("Há uma chave { ou } sem par no texto.");
    });

    it("a partir da 2ª versão, o motivo é obrigatório", () => {
      const rascunho = rascunhoDoModelo(null);
      expect(validarModelo(rascunho, { versaoAtual: 1 }).erros).toContain(
        "Informe o motivo da alteração (3 a 500 caracteres).",
      );
      expect(
        validarModelo(
          { ...rascunho, motivo: "Prazo do edital" },
          { versaoAtual: 1 },
        ).erros,
      ).toEqual([]);
    });

    it("{CPF} no modelo avisa que a lista não guarda CPF", () => {
      expect(
        validarModelo({ ...rascunhoDoModelo(null), texto: "CPF {CPF}" })
          .avisos[0],
      ).toMatch(/não guarda CPF/);
    });

    it("prazo de 0 a 90 dias", () => {
      expect(
        validarModelo({ ...rascunhoDoModelo(null), prazoDias: "91" }).erros,
      ).toContain("O prazo vai de 0 a 90 dias.");
      expect(
        validarModelo({ ...rascunhoDoModelo(null), prazoDias: "" }).erros,
      ).toEqual([]);
    });

    it("o conteúdo salvo: documentos um por linha, prazo número ou nulo", () => {
      expect(
        conteudoParaSalvar({
          ...rascunhoDoModelo(null),
          documentos: "- RG\n\n• CPF ",
          prazoDias: "",
        }),
      ).toMatchObject({ documentos: "RG\nCPF", prazo_dias: null });
    });
  });

  describe("validar a emissão", () => {
    it("exige data limite futura e os campos da emissão que o modelo usa", () => {
      const { erros } = validarEmissao({
        modelo: VIGENTE,
        candidatos: [ANA],
        emissao: { dataLimite: "2026-10-01" },
        hoje: "2026-10-05",
      });
      expect(erros).toEqual([
        "A data limite já passou.",
        "Informe local de apresentação.",
        "Informe documentos exigidos.",
        "Informe contato para dúvidas.",
      ]);
    });

    it("avisa quem fica com campo em branco e quem já tem outro status", () => {
      const { erros, avisos } = validarEmissao({
        modelo: { titulo: "C", texto: "{NOME} {CPF}" },
        candidatos: [ANA, { ...BRUNO, status: "Contratado" }],
        emissao: EMISSAO,
        hoje: "2026-10-05",
      });
      expect(erros).toEqual([]);
      expect(avisos).toEqual([
        "CPF mascarado (***.456.789-**) em branco para 2 candidatos.",
        "Bruno Lima já está com outro status (Contratado).",
      ]);
    });

    it("sem candidato ou sem modelo não emite", () => {
      expect(validarEmissao({ modelo: null, candidatos: [] }).erros).toEqual([
        "Escolha o modelo da carta.",
        "Escolha ao menos um candidato.",
      ]);
    });
  });

  describe("modelos do banco", () => {
    const dados = {
      pode_editar: true,
      modelos: [
        {
          modelo_id: "a",
          nome: "Da área",
          ativo: true,
          versao: 2,
          vigente: { titulo: "T", texto: "X", prazo_dias: 5 },
          versoes: [{ versao: 2, motivo: "m" }],
        },
        {
          modelo_id: "b",
          nome: "Do edital 10",
          edital_id: "10",
          ativo: true,
          versao: 1,
          vigente: { titulo: "T", texto: "Y" },
        },
        {
          modelo_id: "c",
          nome: "Do edital 20",
          edital_id: "20",
          ativo: true,
          versao: 1,
          vigente: {},
        },
        {
          modelo_id: "d",
          nome: "Inativo",
          ativo: false,
          versao: 1,
          vigente: {},
        },
      ],
    };

    it("normaliza a resposta", () => {
      const { podeEditar, modelos } = lerModelosDoBanco(dados);
      expect(podeEditar).toBe(true);
      expect(modelos[0]).toMatchObject({
        id: "a",
        versao: 2,
        vigente: { prazoDias: "5" },
        versoes: [{ versao: 2, motivo: "m" }],
      });
      expect(modelos[3]?.ativo).toBe(false);
    });

    it("para emitir: ativos, os do edital (de todos os candidatos) primeiro", () => {
      const { modelos } = lerModelosDoBanco(dados);
      expect(modelosParaEmitir(modelos, [ANA, BRUNO]).map((m) => m.id)).toEqual(
        ["b", "a"],
      );
      expect(
        modelosParaEmitir(modelos, [ANA, { ...BRUNO, edital_id: "20" }]).map(
          (m) => m.id,
        ),
      ).toEqual(["a"]);
    });

    it("a emissão começa com os valores da versão vigente e a data pelo prazo", () => {
      const { modelos } = lerModelosDoBanco(dados);
      expect(emissaoInicial(modelos[0], "2026-10-05").dataLimite).toBe(
        "2026-10-10",
      );
      expect(emissaoInicial(modelos[1], "2026-10-05").dataLimite).toBe("");
    });

    it("a mesma carta registra uma vez só (DOCX e PDF da mesma emissão)", () => {
      const base = {
        modeloId: "a",
        versao: 2,
        candidatoIds: ["ana"],
        agrupamento: "UNICO",
        emissao: EMISSAO,
      };
      expect(assinaturaDaEmissao(base)).toBe(assinaturaDaEmissao({ ...base }));
      expect(assinaturaDaEmissao(base)).not.toBe(
        assinaturaDaEmissao({
          ...base,
          emissao: { ...EMISSAO, dataLimite: "2026-10-13" },
        }),
      );
      expect(camposParaRegistrar(EMISSAO)).toEqual({
        data_limite: "2026-10-12",
        local: "Sede do DSEI Manaus",
        documentos: "RG\nCPF\nComprovante de residência",
        contato: "rh@agsus.org.br",
      });
    });
  });

  describe("o documento (SEI, PDF, DOCX)", () => {
    const doc = montarCartas({
      modelo: MODELO,
      candidatos: [ANA, BRUNO],
      emissao: EMISSAO,
      hoje: "2026-10-05",
    });

    it("uma carta por candidato, com local e data", () => {
      expect(doc.cartas.map((c) => c.nome)).toEqual([
        "Ana Ribeiro",
        "Bruno Lima",
      ]);
      expect(doc.nome).toBe("Carta de convocação - 2 candidatos");
      expect(doc.localData).toBe("Brasília, na data da assinatura digital.");
      expect(doc.localDataPorExtenso).toBe("Brasília, 5 de outubro de 2026.");
      expect(soACarta(doc, 1)?.nome).toBe("Carta de convocação - Bruno Lima");
    });

    it("HTML para o SEI com as classes do SEI, negrito e quebra de página entre as cartas", () => {
      const html = htmlParaSei(doc);
      expect(html).toContain(
        '<p class="Texto_Centralizado_Maiusculas">CARTA DE CONVOCAÇÃO</p>',
      );
      expect(html).toContain(
        '<p class="Texto_Justificado_Recuo_Primeira_Linha">Prezado(a) <strong>Ana Ribeiro</strong>,</p>',
      );
      expect(html).toContain('<p class="Texto_Justificado">&bull; RG</p>');
      expect(html.match(/page-break-after: always/g)).toHaveLength(1);
      expect(
        htmlParaSei({
          ...doc,
          cartas: [
            { ...definido(doc.cartas[0]), titulo: "<script>x</script>" },
          ],
        }),
      ).not.toContain("<script>");
    });

    it("texto puro sem as marcas de negrito", () => {
      const t = textoParaSei(doc);
      expect(t).toContain("Prezado(a) Ana Ribeiro,");
      expect(t).toContain("• RG");
      expect(t).not.toContain("**");
    });

    it("prévia: timbrado, uma carta por página, sem script", () => {
      const pagina = paginaDaPrevia(doc, {
        cabecalho: "AGÊNCIA X\nRua Y",
        logo: "/assets/agsus-logo.webp",
      });
      const lida = new DOMParser().parseFromString(pagina, "text/html");
      expect(lida.querySelectorAll("section.carta")).toHaveLength(2);
      expect(lida.querySelectorAll("section.quebra-de-pagina")).toHaveLength(1);
      expect(
        [...lida.querySelectorAll(".timbrado p")].map((p) => p.textContent),
      ).toEqual(["AGÊNCIA X", "Rua Y"]);
      expect(pagina).not.toContain("posta pelo SEI");
      expect(lida.querySelector("script")).toBeNull();
    });

    it("DOCX: um arquivo com as duas cartas; ZIP: um .docx por candidato", () => {
      const leitor = new TextDecoder();
      const docx = leitor.decode(
        gerarDocxDasCartas(doc, { quando: new Date("2026-10-05T12:00:00Z") }),
      );
      expect(docx).toContain("word/document.xml");
      expect(docx).toContain('<w:br w:type="page"/>');
      expect(docx).toContain("Ana Ribeiro");
      expect(docx).toContain("Bruno Lima");
      expect(docx).toContain('<w:ind w:firstLine="1418"/>');
      const zip = leitor.decode(
        gerarZipDasCartas(doc, { quando: new Date("2026-10-05T12:00:00Z") }),
      );
      expect(zip).toContain("01 - Ana Ribeiro.docx");
      expect(zip).toContain("02 - Bruno Lima.docx");
    });

    it("o modelo padrão preenche sem campo desconhecido", () => {
      expect(
        camposDesconhecidos(MODELO_PADRAO.titulo, MODELO_PADRAO.texto),
      ).toEqual([]);
    });
  });
});

bloco("lib/dados-do-estado-de-aprovados", () => {
  const candidato = (id: string) => ({
    candidato_id: id,
    nome: id,
    edital_id: "10",
    cargo: "Enfermeiro",
    edital: "03/2025",
    unidade: "Manaus",
    lista_ativa: true,
    status: null,
  });
  function preparar(confirmacao: unknown) {
    let pacote: unknown = compactarPorArea([
      candidato("ana"),
      candidato("bia"),
    ]);
    const toast = vi.fn();
    const responder = async (
      nome: string,
      _argumentos?: Record<string, unknown>,
    ): Promise<RespostaDoTeste> => {
      if (nome === "listar_candidatos_aprovados_compacto")
        return { data: pacote, error: null };
      if (nome === "listar_listas_aprovados")
        return {
          data: [{ lista_id: "l1", edital_id: "10", ativo: true }],
          error: null,
        };
      if (nome === "marcar_candidatos_convocados")
        return { data: confirmacao, error: null };
      return { data: [], error: null };
    };
    // A abertura da página numa chamada, montada com as respostas acima.
    const rpc = vi.fn((nome: string, argumentos?: Record<string, unknown>) =>
      nome === "abrir_lista_aprovados"
        ? aberturaPelasChamadasDeAntes(responder, argumentos)
        : responder(nome, argumentos),
    );
    const estado = criarEstadoDaListaDeAprovados({
      supabase: clienteDosAprovados(rpc),
      getProfile: () => ({ perfil: "admin" }),
      areaAtual: () => "saude-indigena",
      hoje: () => "2026-10-15",
      toast,
    });
    return {
      estado,
      rpc,
      toast,
      trocarPacote: (novo: unknown) => {
        pacote = novo;
      },
    };
  }

  describe("Dados do estado de Aprovados", () => {
    it("preserva ordem, campos adicionais e posições nulas do pacote", () => {
      const pacote = compactarPorArea([candidato("bia"), candidato("ana")]);
      expect(candidatosDoPacote(pacote)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            candidato_id: "bia",
            sub_judice: null,
            codigo_vaga: null,
          }),
        ]),
      );
      expect(candidatosDoPacote(pacote).map((c) => c.candidato_id)).toEqual([
        "bia",
        "ana",
      ]);
      const pessoa = { ...candidato("ana"), campo_adicional: { valor: 42 } };
      expect(candidatosDoEstado([pessoa])[0]).toBe(pessoa);
    });
    it.each([
      null,
      {},
      { linhas: [] },
      { colunas: [], colunas_da_lista: [], linhas: [null], listas: [] },
    ])("recusa pacote incompleto: %j", (pacote) => {
      expect(() => candidatosDoPacote(pacote)).toThrow(/inválido/);
    });
    it("não transforma uma coleção parcialmente inválida em menos candidatos", () => {
      expect(() =>
        candidatosDoEstado([candidato("ana"), { candidato_id: "bia" }]),
      ).toThrow(/candidatos/);
      expect(() =>
        listasDoEstado([{ edital_id: "10" }, { edital_id: {} }]),
      ).toThrow(/listas/);
      expect(() =>
        anexosDoEstado([{ anexo_id: "a", candidato_id: "ana" }, {}]),
      ).toThrow(/anexos/);
    });
    it("preserva os candidatos anteriores se uma recarga vier malformada", async () => {
      const { estado, trocarPacote, toast } = preparar(null);
      expect(await estado.carregar()).toBe(true);
      const anteriores = estado.obter().candidatos;
      trocarPacote({ linhas: [] });
      expect(await estado.carregar()).toBe(false);
      expect(estado.obter().candidatos).toBe(anteriores);
      expect(toast).toHaveBeenLastCalledWith(
        expect.stringContaining("inválido"),
        "error",
      );
    });
    it.each([
      null,
      { marcados: 2 },
      { marcados: 0, ignorados: [] },
      { marcados: "2", ignorados: [] },
      {
        marcados: 1,
        ignorados: [{ candidato_id: "fora", motivo: "Não existe" }],
      },
      {
        marcados: 0,
        ignorados: [
          { candidato_id: "ana", motivo: "X" },
          { candidato_id: "ana", motivo: "X" },
        ],
      },
    ])(
      "não muda status nem anuncia sucesso com confirmação inválida: %j",
      async (confirmacao) => {
        const { estado, rpc, toast } = preparar(confirmacao);
        await estado.carregar();
        const anteriores = estado.obter().candidatos;
        expect(
          await estado.marcarConvocados(["ana", "bia"], "2026-10-15"),
        ).toBeNull();
        expect(estado.obter().candidatos).toBe(anteriores);
        expect(estado.obter().convocacoes.size).toBe(0);
        expect(estado.obter().acao).toBeNull();
        expect(toast).toHaveBeenLastCalledWith(
          expect.stringContaining("Não foi possível confirmar"),
          "error",
        );
        expect(
          rpc.mock.calls.filter(([nome]) => nome === "abrir_lista_aprovados"),
        ).toHaveLength(1);
      },
    );
    it("confirma um resultado parcial e atualiza somente quem o banco marcou", async () => {
      const confirmacao = {
        marcados: 1,
        ignorados: [
          {
            candidato_id: "bia",
            nome: "Bia",
            motivo: "Já está como Contratado",
          },
        ],
      };
      const { estado, toast } = preparar(confirmacao);
      await estado.carregar();
      // Observa a atualização confirmada antes da releitura em segundo plano.
      const observar = vi.fn();
      const cancelar = estado.assinar(() => {
        if (estado.obter().candidatos[0]?.status === "Convocado")
          observar(estado.obter());
      });
      expect(
        await estado.marcarConvocados(["ana", "bia"], "2026-10-15"),
      ).toEqual(confirmacao);
      expect(observar).toHaveBeenCalledWith(
        expect.objectContaining({
          candidatos: [
            expect.objectContaining({
              candidato_id: "ana",
              status: "Convocado",
            }),
            expect.objectContaining({ candidato_id: "bia", status: null }),
          ],
        }),
      );
      expect(toast).toHaveBeenLastCalledWith(
        expect.stringContaining("Bia (Já está como Contratado)"),
        "warn",
      );
      cancelar();
    });
    it("confere IDs distintos, como a RPC faz, sem rejeitar pedidos repetidos", () => {
      expect(
        resultadoDaMarcacao({ marcados: 1, ignorados: [] }, ["ana", "ana"]),
      ).toEqual({ marcados: 1, ignorados: [] });
    });
  });
});
