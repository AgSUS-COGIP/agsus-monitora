// @vitest-environment jsdom
import { bloco } from "./apoio/bloco.ts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  guardarMarca,
  lerMarcaGuardada,
  limparMarcaGuardada,
} from "../src/lib/entrada/access-branding-cache.ts";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fonteDoApp, semTrechos } from "./fonte-do-app.ts";
import { semOPainelAntigoDeAnalises } from "../src/lib/paineis/pagina-do-painel";
import { RESOURCES } from "../src/lib/acessos/permissoes-recursos.ts";
import {
  paginasPermitidas,
  permissaoLegada,
  secaoDeConfiguracaoPermitida,
} from "../src/lib/acessos/access-roles.ts";
import {
  bloqueioDaTela,
  telaPermitida,
  CHAVE_DA_TELA_GUARDADA,
} from "../src/lib/navegacao/navegacao";
import {
  linhasDosPaineis,
  normalizarPaineis,
} from "../src/lib/configuracoes/paineis-externos-das-configuracoes.ts";
import { htmlDaPagina } from "./pagina-montada.ts";
import {
  normalizarArvoreDosModulos,
  normalizarResultadoDosModulos,
} from "../src/lib/navegacao/arvore-dos-modulos.ts";
import { criarEstadoDosModulos } from "../src/modulos/modulos/estado.ts";
import { createSafeAuthStorage } from "../src/modules/auth-storage.ts";
import { act, createElement, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AvisoDeContraste } from "../src/modulos/configuracoes/partes.tsx";
import {
  CAMPOS_DAS_SECOES,
  CHAVES_DAS_SECOES,
  linhasDasSecoes,
  normalizarValoresCarregados,
} from "../src/lib/configuracoes/publicacao-de-configuracoes.ts";
import {
  MINIMO_AA,
  MODO_AUTO,
  MODO_CLARO,
  MODO_ESCURO,
  TEXTO_CLARO,
  TEXTO_ESCURO,
  avaliarCor,
  corDoTextoPara,
  normalizarModo,
  razaoDeContraste,
} from "../src/lib/base/contraste.ts";
import {
  chaveDoDia,
  editaisComEtapaNaSemana,
  primeiroNome,
  resumoDoDia,
  saudacao,
} from "../src/lib/entrada/boas-vindas.ts";
import {
  buscarMarcaPublica,
  mapearBrandingPublico,
} from "../src/lib/entrada/access-branding-publico.ts";
import {
  aplicarCorDoPainel,
  aplicarMarcaGuardadaNoArranque,
  aplicarMarcaNaTela,
  atualizarMarcaComBrandingPublico,
  marcaDaEntrada,
  definirMarcaDaConfiguracao,
} from "../src/app/entrada/marca.ts";
import { SECOES } from "../src/modulos/configuracoes/secoes.ts";
import { criarNavegacao } from "../src/app/navegacao.ts";
import { montarTelasNoTeste } from "./app/telas-no-teste.ts";
import {
  ASSUNTO_DO_CONVITE,
  copiarTexto,
  dataCurta,
  linkDoEmailDoConvite,
  mensagemDoConvite,
  situacaoDoAcesso,
  dataHoraCurta,
} from "../src/lib/acessos/convite-de-acesso.ts";
import {
  areasDaLinha,
  explicacaoDoGrupo,
  ficariaSemArea,
  linhaFicariaSemArea,
  pessoasSemAreaNoRascunho,
  registrarNoRascunho,
  ALVO_GRUPO,
} from "../src/lib/acessos/matriz-de-acessos.ts";
import {
  buildCspViolationDetails,
  sanitizeBlockedUri,
} from "../src/lib/seguranca/csp-report-monitor";
import { SUPABASE_AUTH_STORAGE_KEY } from "../src/lib/sessao/env";
import {
  FORMATOS_DO_ESQUELETO,
  formatoDoEsqueleto,
} from "../src/lib/entrada/esqueleto-da-entrada";
import {
  esconderEsqueleto,
  esqueletoAtivo,
  instalarCarregamento,
  marcarAtualizacao,
  mostrarEsqueleto,
} from "../src/app/carregamento.ts";
import {
  getGoogleProfilePhotoUrl,
  renderGoogleProfilePhoto,
} from "../src/modules/google-profile-photo.ts";
import {
  FAVICON_PADRAO,
  aplicarFaviconDaMarca,
  definirPaginaDaAba,
  definirSistemaDaAba,
  escreverFavicon,
} from "../src/lib/sessao/identidade-da-aba";
import {
  criarImagensDaAparencia,
  EVENTO_FUNDO_DO_ACESSO,
} from "../src/modulos/configuracoes/imagens.ts";
import {
  ACCESS_BACKGROUND_MAX_BYTES,
  validateAccessBackgroundFile,
} from "../src/lib/entrada/access-background-storage.ts";
import { join } from "node:path";
import {
  cabecalhosDaTabela,
  tabelaEmCartoes,
  tabelasDaTelaEmCartoes,
} from "../src/app/casca/tabelas-em-cartoes.ts";
import {
  aplicarMarcaDaConfiguracao,
  logoDaBarraLateral,
  redefinirMarcaDaBarraLateral,
} from "../src/componentes/barra-lateral/marca.ts";
import { criarEstadoDosAcessos } from "../src/modulos/acessos/estado.ts";
import { SEM_SERVIDOR } from "../src/lib/carga/falha-de-rede";
import { montarTela } from "./montar-tela.ts";
import { criarAcessos } from "../src/modulos/acessos/acessos.tsx";
import {
  clicar,
  digitar,
  escolher,
  esperar,
  teclar,
} from "./componentes/interacoes.ts";
import {
  definirAreaAtual,
  redefinirDadosDoMonitoramento,
} from "../src/componentes/dados-do-monitoramento.ts";
import { criarClassificacao } from "../src/modulos/classificacao/classificacao.tsx";
import {
  guardaDeAlteracoes,
  criarGuardaDeAlteracoes,
} from "../src/app/guarda-de-alteracoes.ts";
import { montarRegrasDoEdital } from "./componentes/montar-regras-do-edital.ts";
import { CATALOGO_DE_CRITERIOS } from "../src/lib/classificacao/catalogo.ts";
import { criarRascunhoDaRegra } from "../src/app/rascunho-da-regra.ts";
import { criarEstadoDaAvaliacao } from "../src/modulos/avaliacao-documental/estado.ts";
import { EtapaDaAvaliacao } from "../src/modulos/regras-do-edital/etapas.tsx";
import { SECOES_DA_AYA } from "../src/lib/aya/aya-paginas.ts";
import {
  CHAVE_DA_PREFERENCIA_PESSOAL,
  CHAVE_DAS_COMEMORACOES,
} from "../src/lib/comemoracao/catalogo-de-comemoracoes.ts";
import {
  InterruptorPessoal,
  SecaoComemoracoes,
} from "../src/modulos/configuracoes/comemoracoes.tsx";
import {
  abrirSecaoNoTeste,
  montarConfiguracoesNoTeste,
} from "./modulos/configuracoes-no-teste.js";
import { criarEstadoDasConfiguracoes } from "../src/modulos/configuracoes/estado.ts";
import { EVENTO_TEMA_ALTERADO } from "../src/lib/navegacao/eventos-da-barra-lateral.ts";
import { CORES_DO_MAPA } from "../src/lib/mapas/mapa-saude-indigena/formas.ts";
import { EVENTO_DAS_TERRAS } from "../src/modules/indigenous-territories-layer.ts";
import { MapaSaudeIndigena } from "../src/modulos/mapa-saude-indigena/mapa-saude-indigena.tsx";
import { criarLeafletFalso } from "./modulos/leaflet-falso.js";
import { criarModulos } from "../src/modulos/modulos/modulos.tsx";
import { criarPreClassificacao } from "../src/modulos/avaliacao-documental/entrada-da-pre-classificacao.tsx";
import { needsLightForeground } from "../src/lib/entrada/access-branding.ts";
import {
  SESSION_IDLE_LIMIT_MS,
  dismissSessionNotice,
  formatSessionRemaining,
  getRemainingSessionMs,
  parseSessionActivityRecord,
} from "../src/lib/sessao/session-lifecycle";
import {
  AREAS_DA_SOLICITACAO,
  CAMPOS_VAZIOS,
  CARGOS_DA_SOLICITACAO,
  MOTIVOS_DE_RECUSA,
  SITUACOES,
  TEXTO_DESATIVADA,
  TITULO_DESATIVADA,
  argumentosDaSolicitacao,
  camposDoPedido,
  camposNaArea,
  cargosDaArea,
  diaEMes,
  erroDaJustificativa,
  grupoSugeridoDoPedido,
  resumoDoPedido,
  situacaoDaSolicitacao,
  telaDaSolicitacao,
  validarRecusa,
  validarSolicitacao,
} from "../src/lib/acessos/solicitacao-de-acesso.ts";
import {
  AVISO_CANCELADO,
  AVISO_SEM_CONSULTA,
  TITULO_VERIFICANDO,
  criarPedidoDeAcesso,
  visaoDoPedido,
} from "../src/app/entrada/pedido-de-acesso.ts";
import { PaginaDaSolicitacao } from "../src/app/entrada/solicitacao-de-acesso.tsx";
import { lembrarContaDesativada } from "../src/lib/acessos/acesso-liberado.ts";

bloco("access-branding-cache", () => {
  const CHAVE = "agsus_monitora_access_branding_v1";

  describe("cache da marca da tela de acesso", () => {
    beforeEach(() => localStorage.clear());
    afterEach(() => localStorage.clear());

    it("devolve null quando nunca houve visita anterior", () => {
      expect(lerMarcaGuardada()).toBeNull();
    });

    it("guarda e devolve a arte e a cor aplicadas", () => {
      guardarMarca({
        backgroundUrl: "https://exemplo/arte.jpg",
        panelColor: "#ffffff",
      });
      expect(lerMarcaGuardada()).toEqual({
        backgroundUrl: "https://exemplo/arte.jpg",
        panelColor: "#ffffff",
      });
    });

    it("ignora campos fora da lista, para não guardar dado de sessão", () => {
      guardarMarca({
        backgroundUrl: "https://exemplo/arte.jpg",
        accessToken: "nao-deve-ser-guardado",
        email: "pessoa@agenciasus.org.br",
      });
      const guardado = JSON.parse(localStorage.getItem(CHAVE));
      expect(guardado).toEqual({ backgroundUrl: "https://exemplo/arte.jpg" });
    });

    it("descarta valores vazios em vez de guardar cadeia em branco", () => {
      guardarMarca({ backgroundUrl: "   ", panelColor: "#012345" });
      expect(lerMarcaGuardada()).toEqual({ panelColor: "#012345" });
    });

    it("não guarda nada quando não sobra nenhum campo útil", () => {
      guardarMarca({ backgroundUrl: "", panelColor: "  " });
      expect(localStorage.getItem(CHAVE)).toBeNull();
    });

    /*
    O conteúdo corrompido é o caso que mais importa: se `lerMarcaGuardada`
    lançasse aqui, o erro subiria durante o arranque e derrubaria a tela de
    acesso inteira — trocando um problema estético por um que impede entrar.
  */
    it("devolve null quando o conteúdo guardado não é JSON válido", () => {
      localStorage.setItem(CHAVE, "{isto não é json");
      expect(lerMarcaGuardada()).toBeNull();
    });

    it("devolve null quando o JSON guardado não é um objeto", () => {
      localStorage.setItem(CHAVE, '"apenas um texto"');
      expect(lerMarcaGuardada()).toBeNull();
    });

    it("limpa o que estava guardado", () => {
      guardarMarca({ panelColor: "#012345" });
      limparMarcaGuardada();
      expect(lerMarcaGuardada()).toBeNull();
    });

    it("não lança quando o armazenamento é inacessível", () => {
      const original = Object.getOwnPropertyDescriptor(
        globalThis,
        "localStorage",
      );
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        get() {
          throw new Error("acesso negado ao armazenamento");
        },
      });

      expect(() => guardarMarca({ panelColor: "#012345" })).not.toThrow();
      expect(lerMarcaGuardada()).toBeNull();

      if (original) Object.defineProperty(globalThis, "localStorage", original);
    });
  });
});

bloco("analises-aba-interna", () => {
  /*
  Análises curriculares deixou de ser o painel externo `analises` e virou a
  view `analises`, com permissão só do recurso `analises`; desde a Etapa 4, é
  o módulo React src/modulos/analises/, sem quadro.
*/
  const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
  const legado = fonteDoApp();
  const trecho = (inicio, fim) =>
    legado.slice(
      legado.indexOf(inicio),
      legado.indexOf(fim, legado.indexOf(inicio)),
    );

  const PAINEIS = [
    { id: "1", codigo: "recrutamento", titulo: "Seleção", url: "https://a" },
    { id: "2", codigo: "analises", titulo: "Analises", url: "/analises.html" },
    { id: "3", codigo: "recursos", titulo: "Recursos", url: "https://b" },
  ];

  describe("a lista de painéis", () => {
    it("o painel antigo sai da lista (banco antes da migration, cópia da sessão)", () => {
      expect(
        semOPainelAntigoDeAnalises(PAINEIS).map((painel) => painel.codigo),
      ).toEqual(["recrutamento", "recursos"]);
      expect(semOPainelAntigoDeAnalises(undefined)).toEqual([]);
    });

    it("Painéis externos da Administração não mostram Análises, e o salvar lê as linhas certas", () => {
      const lista = normalizarPaineis(semOPainelAntigoDeAnalises(PAINEIS));
      expect(lista.map((painel) => painel.titulo)).not.toContain("Analises");
      expect(linhasDosPaineis(lista).map((linha) => linha.id)).toEqual([
        "1",
        "3",
      ]);
    });

    it("o recurso analises se chama Painel das análises na matriz", () => {
      expect(Object.fromEntries(RESOURCES).analises).toBe(
        "Painel das análises",
      );
    });
  });

  describe("o legado trata Análises como página", () => {
    it("a permissão é só o recurso analises", () => {
      // can(), isViewAllowed e buildNav delegam a access-roles.ts.
      const perfil = (analises) => ({
        role: "usuario",
        permissoes: { dashboard: "leitor", analises },
      });
      expect(permissaoLegada(perfil("leitor"), "analises")).toBe(true);
      expect(permissaoLegada(perfil("sem_acesso"), "analises")).toBe(false);
      expect(paginasPermitidas(perfil("leitor")).analises).toBe(true);
      expect(paginasPermitidas(perfil("sem_acesso")).analises).toBe(false);
      // A navegação (src/lib/navegacao/navegacao.ts) usa as mesmas regras de access-roles.ts.
      expect(telaPermitida("analises", perfil("leitor"))).toBe(true);
      expect(bloqueioDaTela("analises", perfil("sem_acesso"))).toBe(
        "Sem permissão para o Painel das análises.",
      );
    });

    it("navegar abre a tela React (a rota analises → criarAnalises, render())", () => {
      expect(ler("src/app/navegacao.ts")).not.toContain("abrirPaginaDoPainel");
      // Sob demanda (src/app/telas.tsx): o módulo baixa na abertura.
      const telas = ler("src/app/telas.tsx");
      expect(telas).toContain('import("../modulos/analises/analises.tsx")');
      expect(telas).toContain("m.criarAnalises({");
    });

    it("os painéis carregados perdem o antigo de análises", () => {
      const paineis = ler("src/app/paineis-externos.ts");
      expect(
        paineis.slice(paineis.indexOf("async function carregar(")),
      ).toMatch(/semOPainelAntigoDeAnalises(<[^>]*>)?\(data\)/);
    });

    it("o caminho do painel externo não tem mais caso de área", () => {
      const fonte = ler("src/app/paineis-externos.ts");
      const painel = fonte.slice(fonte.indexOf("function mostrar(codigo"));
      expect(painel).not.toMatch(/area/i);
      expect(legado).not.toContain("recarregarPainelNaAreaAtual");
    });

    it("o index.html tem a seção da página, sem quadro", () => {
      expect(htmlDaPagina()).toContain(
        '<section id="page-analises" class="page"></section>',
      );
    });
  });
});

bloco("arvore-dos-modulos", () => {
  describe("contrato da árvore de módulos e abas", () => {
    it("mantém campos usados pela tela e aceita listas opcionais ausentes", () => {
      const arvore = normalizarArvoreDosModulos({
        areas: [
          {
            co_area: "sede",
            ativo: false,
            abas: [{ co_aba: "editais", beta: true }],
          },
        ],
        paineis: [{ id: "p1", em_manutencao: true }],
        campoExtra: "ignorado",
      });
      expect(arvore.areas[0]).toMatchObject({ co_area: "sede", ativo: false });
      expect(arvore.areas[0].abas[0].beta).toBe(true);
      expect(arvore.paineis[0].em_manutencao).toBe(true);
      expect(arvore.abas).toEqual([]);
      expect(arvore.historico).toEqual([]);
      expect(arvore).not.toHaveProperty("campoExtra");
    });

    it.each([
      null,
      [],
      { areas: {} },
      { abas: [null] },
      { areas: [{ co_area: " " }] },
      { areas: [{ co_area: "sede", abas: [{ co_aba: 42 }] }] },
      { paineis: [{ id: "p1", ativo: "false" }] },
      { sistema: { comemoracoes: "true" } },
      { sistema: { mensagem: {} } },
      { historico: [{ quando: 123 }] },
    ])("recusa campos malformados: %j", (dados) => {
      expect(() => normalizarArvoreDosModulos(dados)).toThrow(
        "Resposta de módulos e abas inválida",
      );
    });

    it("usa o total do lote quando a confirmação não contém uma contagem válida", () => {
      for (const dados of [
        null,
        {},
        { alteradas: "2" },
        { alteradas: {} },
        { alteradas: -1 },
        { alteradas: 1.5 },
      ])
        expect(normalizarResultadoDosModulos(dados, 2)).toBe(2);
      expect(normalizarResultadoDosModulos({ alteradas: 0 }, 2)).toBe(0);
      expect(normalizarResultadoDosModulos({ alteradas: 3 }, 2)).toBe(3);
    });
  });

  function criarCliente(
    obterArvore = () => ({ areas: [{ co_area: "sede", ativo: true }] }),
  ) {
    let auth;
    const rpc = vi.fn(async () => ({ data: obterArvore(), error: null }));
    const cliente = {
      rpc,
      auth: {
        getSession: async () => ({
          data: { session: { access_token: "teste" } },
          error: null,
        }),
        onAuthStateChange: (callback) => {
          auth = callback;
          return { data: { subscription: { unsubscribe() {} } } };
        },
      },
    };
    return { cliente, auth: (...args) => auth(...args) };
  }

  describe("estado dos módulos diante de respostas e sessões inválidas", () => {
    it("mantém a árvore válida e o rascunho quando a releitura vem malformada", async () => {
      let dados = { areas: [{ co_area: "sede", ativo: true }] };
      const { cliente } = criarCliente(() => dados);
      const estado = criarEstadoDosModulos({ supabase: cliente });
      const consoleErro = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      try {
        await estado.carregar();
        const arvore = estado.obter().arvore;
        estado.mudarCampo(
          { escopo: "area", area: "sede" },
          "mensagem",
          "Ajuste",
        );
        dados = { areas: [{ co_area: "sede", ativo: "false" }] };
        await estado.carregar();
        expect(estado.obter()).toMatchObject({ status: "error", arvore });
        expect(estado.obter().erro).toContain("inválida");
        expect(estado.temAlteracoesPendentes()).toBe(true);
        dados = { areas: [{ co_area: "sede", ativo: true }] };
        await estado.carregar();
        expect(estado.obter().status).toBe("ready");
        expect(estado.temAlteracoesPendentes()).toBe(true);
      } finally {
        estado.desligar();
        consoleErro.mockRestore();
      }
    });

    it.each([null, { code: "42501" }])(
      "não publica um salvamento antigo após trocar de usuário (%j)",
      async (erro) => {
        const { cliente, auth } = criarCliente();
        const toast = vi.fn();
        const estado = criarEstadoDosModulos({ supabase: cliente, toast });
        let concluir;
        try {
          auth("SIGNED_IN", { user: { id: "admin-1" } });
          await estado.carregar();
          estado.mudarCampo(
            { escopo: "area", area: "sede" },
            "mensagem",
            "Primeiro ajuste",
          );
          cliente.rpc.mockImplementationOnce(
            () =>
              new Promise((resolve) => {
                concluir = resolve;
              }),
          );
          const salvamento = estado.salvar("Manutenção programada");
          await vi.waitFor(() => expect(concluir).toBeTypeOf("function"));
          auth("SIGNED_IN", { user: { id: "admin-2" } });
          await estado.carregar();
          estado.mudarCampo(
            { escopo: "area", area: "sede" },
            "mensagem",
            "Novo ajuste",
          );
          const rascunho = estado.obter().rascunho;
          const chamadas = cliente.rpc.mock.calls.length;
          concluir({ data: { alteradas: 1 }, error: erro });
          expect(await salvamento).toBe(false);
          expect(estado.obter().rascunho).toBe(rascunho);
          expect(estado.obter().aviso).toBeNull();
          expect(toast).not.toHaveBeenCalled();
          expect(cliente.rpc.mock.calls).toHaveLength(chamadas);
        } finally {
          estado.desligar();
        }
      },
    );
  });
});

bloco("auth-storage", () => {
  function createMemoryStorage() {
    const data = new Map();
    return {
      getItem(key) {
        return data.has(key) ? data.get(key) : null;
      },
      setItem(key, value) {
        data.set(key, String(value));
      },
      removeItem(key) {
        data.delete(key);
      },
    };
  }

  function createBrokenStorage() {
    return {
      getItem() {
        throw new Error("storage indisponivel");
      },
      setItem() {
        throw new Error("storage indisponivel");
      },
      removeItem() {
        throw new Error("storage indisponivel");
      },
    };
  }

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  describe("auth-storage", () => {
    it("remove somente as chaves pertencentes ao Yeendé", () => {
      const storageKey = "agsus-monitora-auth";
      const storage = createSafeAuthStorage(storageKey);

      localStorage.setItem(storageKey, "sessao");
      localStorage.setItem(`${storageKey}-code-verifier`, "verificador");
      localStorage.setItem("sb-outro-sistema-auth-token", "preservar");
      localStorage.setItem("outro-supabase-app", "preservar");

      storage.clearAuthState();

      expect(localStorage.getItem(storageKey)).toBeNull();
      expect(localStorage.getItem(`${storageKey}-code-verifier`)).toBeNull();
      expect(localStorage.getItem("sb-outro-sistema-auth-token")).toBe(
        "preservar",
      );
      expect(localStorage.getItem("outro-supabase-app")).toBe("preservar");
    });

    it("usa sessionStorage quando localStorage esta indisponivel no mobile", () => {
      const storageKey = "agsus-monitora-auth";
      const sessionFallback = createMemoryStorage();
      const storage = createSafeAuthStorage(storageKey, {
        localStorageRef: createBrokenStorage(),
        sessionStorageRef: sessionFallback,
      });

      storage.setItem(`${storageKey}-code-verifier`, "pkce-mobile");
      storage.setItem(storageKey, "sessao-mobile");

      expect(sessionFallback.getItem(`${storageKey}-code-verifier`)).toBe(
        "pkce-mobile",
      );
      expect(storage.getItem(`${storageKey}-code-verifier`)).toBe(
        "pkce-mobile",
      );
      expect(storage.getItem(storageKey)).toBe("sessao-mobile");
    });

    it("mantem copia do verificador PKCE em sessionStorage quando disponivel", () => {
      const storageKey = "agsus-monitora-auth";
      const local = createMemoryStorage();
      const session = createMemoryStorage();
      const storage = createSafeAuthStorage(storageKey, {
        localStorageRef: local,
        sessionStorageRef: session,
      });

      storage.setItem(`${storageKey}-code-verifier`, "verificador");

      expect(local.getItem(`${storageKey}-code-verifier`)).toBe("verificador");
      expect(session.getItem(`${storageKey}-code-verifier`)).toBe(
        "verificador",
      );

      storage.removeItem(`${storageKey}-code-verifier`);
      expect(local.getItem(`${storageKey}-code-verifier`)).toBeNull();
      expect(session.getItem(`${storageKey}-code-verifier`)).toBeNull();
    });

    it("nao quebra quando o navegador bloqueia o acesso as propriedades de storage", () => {
      const storageKey = "agsus-monitora-auth";
      const restrictedWindow = {};

      Object.defineProperties(restrictedWindow, {
        localStorage: {
          get() {
            throw new DOMException("Bloqueado", "SecurityError");
          },
        },
        sessionStorage: {
          get() {
            throw new DOMException("Bloqueado", "SecurityError");
          },
        },
      });

      expect(() =>
        createSafeAuthStorage(storageKey, { windowRef: restrictedWindow }),
      ).not.toThrow();

      const storage = createSafeAuthStorage(storageKey, {
        windowRef: restrictedWindow,
      });
      storage.setItem(storageKey, "sessao-em-memoria");
      expect(storage.getItem(storageKey)).toBe("sessao-em-memoria");
    });
  });
});

bloco("aviso-de-contraste", () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  const aparencia = readFileSync(
    "src/modulos/configuracoes/aparencia.tsx",
    "utf8",
  );

  /* Desenha o <AvisoDeContraste> (Configurações › Aparência) num contêiner. */
  let raiz = null;
  function desenhar(props) {
    const contenedor = document.createElement("div");
    document.body.appendChild(contenedor);
    act(() => {
      raiz = createRoot(contenedor);
      raiz.render(createElement(AvisoDeContraste, props));
    });
    return contenedor;
  }
  afterEach(() => {
    act(() => raiz?.unmount());
    raiz = null;
    document.body.innerHTML = "";
  });

  /*
  A Configurações tinha só um `<input type="color">` cru: escolhia-se um tom,
  salvava-se, e só então se descobria se dava para ler.

  Diferença deliberada em relação ao SIGAV, que mostra o mesmo aviso: lá o
  cálculo é sempre contra texto branco, e um painel lilás claro acusa 2.30
  mesmo quando a tela é desenhada com texto escuro. Aqui o primeiro plano é
  derivado da cor, então o número é o do texto que a pessoa vai ver.
*/
  describe("a razão de contraste", () => {
    it("bate com os valores conhecidos da WCAG", () => {
      expect(razaoDeContraste("#000000", "#ffffff")).toBeCloseTo(21, 5);
      expect(razaoDeContraste("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
    });

    it("não depende da ordem dos argumentos", () => {
      expect(razaoDeContraste("#102a43", "#c090eb")).toBeCloseTo(
        razaoDeContraste("#c090eb", "#102a43"),
        10,
      );
    });
  });

  describe("avaliação da cor escolhida", () => {
    it("mede contra o texto que a tela vai usar, não sempre contra o branco", () => {
      const claro = avaliarCor("#c090eb");
      expect(claro.corDoTexto).toBe(TEXTO_ESCURO);
      expect(claro.razao).toBeCloseTo(5.88, 1);
      expect(claro.passa).toBe(true);

      const escuro = avaliarCor("#6c009e");
      expect(escuro.corDoTexto).toBe(TEXTO_CLARO);
      expect(escuro.passa).toBe(true);
    });

    /*
    Derivar o primeiro plano garante a melhor das duas opções, não que ela
    baste: tons médios reprovam mesmo assim. É o que faz o aviso valer a pena.
  */
    it("acusa os tons médios, onde nenhum primeiro plano resolve", () => {
      const medio = avaliarCor("#8a7fb0");
      expect(medio.passa).toBe(false);
      expect(medio.razao).toBeLessThan(MINIMO_AA);
      expect(medio.mensagem).toContain("Abaixo do mínimo de 4,5");
      expect(medio.mensagem).toContain(
        medio.razao.toFixed(2).replace(".", ","),
      );
    });

    /*
    Num tom médio é o meio da escala que atrapalha, não a direção: escurecer faz
    o texto claro passar, clarear faz o escuro passar. A frase não pode mandar
    só escurecer.
  */
    /*
    O verde-petróleo #2a8478 mede 4,4966 com o texto claro: reprova. Arredondado,
    o aviso dizia "4,50 — abaixo do mínimo de 4,5", que se contradiz.
  */
    it("não arredonda para cima uma cor que reprova por pouco", () => {
      const quase = avaliarCor("#2a8478");
      expect(quase.corDoTexto).toBe(TEXTO_CLARO);
      expect(quase.passa).toBe(false);
      expect(quase.razao).toBe(4.49);
      expect(quase.mensagem).toContain(
        "Contraste do texto sobre esta cor: 4,49.",
      );
    });

    it("a mensagem de falha não manda só escurecer", () => {
      const medio = avaliarCor("#8a7fb0");
      expect(medio.mensagem).toContain("mais escura ou mais clara");
    });

    it("a mensagem de sucesso também traz o número", () => {
      const ok = avaliarCor("#c090eb");
      expect(ok.mensagem).toContain("Acima do mínimo de 4,5");
      expect(ok.mensagem).toContain("5,87");
    });

    it("recusa o que não é cor hexadecimal", () => {
      for (const entrada of [
        null,
        undefined,
        "",
        "azul",
        "#fff",
        "#12345g",
        42,
      ]) {
        expect(avaliarCor(entrada)).toBeNull();
      }
    });

    it("aceita maiúsculas e espaços, como o input devolve", () => {
      expect(avaliarCor("  #C090EB ").cor).toBe("#c090eb");
    });
  });

  describe("a prévia mostra o que a cor produz", () => {
    it("usa a cor escolhida como fundo e o texto derivado", () => {
      const caixa = desenhar({ cor: "#6c009e" });
      const previa = caixa.querySelector(".config-contraste__previa");
      expect(previa.style.background).toBe("rgb(108, 0, 158)");
      expect(previa.style.color).not.toBe("");
    });

    it("a barra lateral não mostra o botão de acesso, que ela não tem", () => {
      expect(
        desenhar({ cor: "#c090eb" }).querySelector(".config-contraste__botao"),
      ).toBeNull();
      act(() => raiz.unmount());
      expect(
        desenhar({ cor: "#c090eb", comBotao: true }).querySelector(
          ".config-contraste__botao",
        ),
      ).not.toBeNull();
    });
  });

  describe("o aviso no formulário", () => {
    it("desenha prévia e aviso de atenção quando reprova", () => {
      const caixa = desenhar({ cor: "#8a7fb0" });
      expect(caixa.querySelector(".config-contraste__previa")).toBeTruthy();
      const aviso = caixa.querySelector(".config-contraste__aviso");
      expect(aviso.dataset.tone).toBe("warning");
      expect(aviso.textContent).toContain("Abaixo do mínimo");
    });

    it("aviso informativo quando passa, com o número escrito", () => {
      const aviso = desenhar({ cor: "#c090eb" }).querySelector(
        ".config-contraste__aviso",
      );
      expect(aviso.dataset.tone).toBe("info");
      expect(aviso.textContent).toContain("5,87");
    });

    it("some quando a cor é inválida", () => {
      expect(desenhar({ cor: "nada" }).textContent).toBe("");
    });
  });

  describe("os dois campos de cor recebem o aviso", () => {
    it("o painel de acesso (com o botão e o modo) e a barra lateral (sem botão)", () => {
      expect(aparencia).toContain(
        'modo={estado.valor("auth_access_texto_modo")}',
      );
      expect(aparencia.match(/<AvisoDeContraste/g)).toHaveLength(2);
      expect(aparencia).toContain("comBotao");
    });

    it("o aviso não depende só de cor para se distinguir", () => {
      // O número vai escrito na mensagem, não só no realce.
      expect(avaliarCor("#8a7fb0").mensagem).toMatch(/\d,\d{2}/);
    });
  });

  /*
  Forçar o texto claro sobre um painel claro reprova a WCAG — e é uma escolha
  legítima de identidade visual. O papel do sistema é avisar com o número na
  tela, não decidir sozinho. Por isso o modo existe e `auto` continua o padrão.

  A parte difícil não foi a classe: a tela de acesso é pintada ANTES do login,
  a partir de `obter_branding_acesso_publico()`, cuja lista de chaves é fixa em
  SQL. Sem acrescentar `auth_access_texto_modo` a essa lista, a escolha não
  chega a quem ainda não entrou.
*/
  describe("modo do texto sobre o painel", () => {
    const html = readFileSync("index.html", "utf8");
    const governanca = readFileSync(
      "src/lib/configuracoes/publicacao-de-configuracoes.ts",
      "utf8",
    );
    const boot = readFileSync("src/app/entrada/marca.ts", "utf8");
    const cache = readFileSync(
      "src/lib/entrada/access-branding-cache.ts",
      "utf8",
    );
    const publico = readFileSync(
      "src/lib/entrada/access-branding-publico.ts",
      "utf8",
    );

    it("auto é o padrão e preserva o comportamento anterior", () => {
      expect(normalizarModo(undefined)).toBe(MODO_AUTO);
      expect(normalizarModo("qualquer coisa")).toBe(MODO_AUTO);
      expect(corDoTextoPara("#c090eb", MODO_AUTO)).toBe(TEXTO_ESCURO);
      expect(corDoTextoPara("#6c009e", MODO_AUTO)).toBe(TEXTO_CLARO);
    });

    it("claro e escuro impõem, independentemente da luminância", () => {
      expect(corDoTextoPara("#c090eb", MODO_CLARO)).toBe(TEXTO_CLARO);
      expect(corDoTextoPara("#6c009e", MODO_ESCURO)).toBe(TEXTO_ESCURO);
    });

    /*
    O ponto do pedido: dá para deixar claro, e o aviso diz o preço.
  */
    it("forçar claro num painel claro reprova, e o aviso mostra isso", () => {
      const forcado = avaliarCor("#c090eb", MODO_CLARO);
      expect(forcado.corDoTexto).toBe(TEXTO_CLARO);
      expect(forcado.passa).toBe(false);
      expect(forcado.razao).toBeLessThan(MINIMO_AA);
      expect(forcado.mensagem).toContain("Abaixo do mínimo de 4,5");

      const automatico = avaliarCor("#c090eb");
      expect(automatico.passa).toBe(true);
    });

    it("o aviso reage à troca de modo, não só à de cor", () => {
      expect(desenhar({ cor: "#c090eb", modo: "auto" }).textContent).toContain(
        "Acima do mínimo",
      );
      act(() => raiz.unmount());
      expect(desenhar({ cor: "#c090eb", modo: "claro" }).textContent).toContain(
        "Abaixo do mínimo",
      );
    });

    it("a tela aplica o modo, e não só a luminância", () => {
      const fn = boot.slice(
        boot.indexOf("export function aplicarCorDoPainel"),
        boot.indexOf("export function aplicarMarcaNaTela"),
      );
      expect(fn).toContain("corDoTextoPara(cor, modo)");
      expect(boot).toContain(
        "aplicarCorDoPainel(tela, marca.panelColor, marca.textoModo)",
      );
    });

    it("o modo viaja pelo cache e pelo mapa da RPC pública", () => {
      expect(cache).toContain('"textoModo"');
      expect(publico).toContain('auth_access_texto_modo: "textoModo"');
    });

    it("o pré-paint respeita o modo guardado", () => {
      expect(html).toContain("marca.textoModo");
      const bloco = html.slice(
        html.indexOf("aplicarMarcaAntesDoPrimeiroPaint"),
        html.indexOf(
          "</script>",
          html.indexOf("aplicarMarcaAntesDoPrimeiroPaint"),
        ),
      );
      expect(bloco).toContain('modo === "claro"');
      expect(bloco).toContain('modo === "escuro"');
    });

    // Um caminho só: a publicação de Configurações (publicacao-de-configuracoes.ts).
    it("a chave entra no caminho de gravação", () => {
      expect(governanca).toContain('"auth_access_texto_modo"');
    });

    it("o campo existe no formulário com as três opções", () => {
      const campo = CAMPOS_DAS_SECOES.aparencia.find(
        (c) => c.chave === "auth_access_texto_modo",
      );
      expect(campo.opcoes.map(([valor]) => valor)).toEqual([
        "auto",
        "claro",
        "escuro",
      ]);
    });
  });
});

bloco("boas-vindas", () => {
  describe("textos das boas-vindas", () => {
    it("saúda pela hora", () => {
      expect(saudacao(8)).toBe("Bom dia");
      expect(saudacao(12)).toBe("Boa tarde");
      expect(saudacao(19)).toBe("Boa noite");
    });

    it("usa o primeiro nome, sem caixa alta", () => {
      expect(primeiroNome("YASSURY SOUSA")).toBe("Yassury");
      expect(primeiroNome("  maria de fátima ")).toBe("Maria");
      expect(primeiroNome("ÂNGELA")).toBe("Ângela");
      expect(primeiroNome("")).toBe("");
    });

    it("conta editais com etapa nos 7 dias contando hoje (hoje a hoje + 6)", () => {
      // 12h de Brasília: o mesmo dia em qualquer fuso do computador.
      const hoje = new Date("2026-09-28T15:00:00Z");
      const linhas = [
        { cronograma_proxima_data: "2026-09-28" },
        { cronograma_proxima_data: "2026-10-04" },
        // Hoje + 7: fora desde 11/11/2026 (antes a janela tinha 8 dias).
        { cronograma_proxima_data: "2026-10-05" },
        { cronograma_proxima_data: "2026-09-27" },
        { cronograma_proxima_data: null },
      ];
      expect(editaisComEtapaNaSemana(linhas, hoje)).toBe(2);
    });

    it("usa o dia de Brasília e não conta edital cancelado (auditoria de 10/11/2026)", () => {
      // 23h30 de 27/09 em Brasília = 02h30 de 28/09 em UTC: o dia é 27/09.
      const noiteEmBrasilia = new Date("2026-09-28T02:30:00Z");
      const linhas = [
        { cronograma_proxima_data: "2026-09-27" },
        { cronograma_proxima_data: "2026-10-03" },
        { cronograma_proxima_data: "2026-10-04" },
        { cronograma_proxima_data: "2026-09-30", status: "Cancelado" },
      ];
      expect(editaisComEtapaNaSemana(linhas, noiteEmBrasilia)).toBe(2);
    });

    it("chaveDoDia segue o dia local do Date", () => {
      expect(chaveDoDia(new Date(2026, 8, 28))).toBe("2026-09-28");
    });

    it("resume o dia com informação real", () => {
      expect(resumoDoDia(0)).toBe(
        "Nenhum edital com etapa nos próximos 7 dias.",
      );
      expect(resumoDoDia(1)).toBe("1 edital tem etapa nos próximos 7 dias.");
      expect(resumoDoDia(1234)).toBe(
        "1.234 editais têm etapa nos próximos 7 dias.",
      );
    });
  });

  // O card na Visão geral (React): tests/telas-com-modulo-simulado-na-tela.test.js (bloco modulos/visao-geral).
});

bloco("branding-publico", () => {
  const URL_FALSA = "https://exemplo.supabase.co";
  const CHAVE_PUBLICA = "sb_publishable_chave_de_teste";

  /*
  O que a RPC devolve para uma instituição que configurou a sua identidade. A
  migration monta esta resposta por lista de chaves no próprio SQL — nunca
  `select *`.
*/
  const RESPOSTA_DA_RPC = {
    auth_access_background_url: "https://exemplo.org/agosto-lilas.jpg",
    auth_access_logo_url: "https://exemplo.org/logo.png",
    auth_access_panel_color: "#ffffff",
    auth_access_greeting: "Bem-vindo ao Agosto Lilás",
    auth_access_instruction: "Entre com sua conta institucional.",
    auth_google_button_text: "Entrar com sua conta institucional",
  };

  const IDENTIDADE_ATUAL = {
    backgroundUrl: "https://exemplo.org/agosto-lilas.jpg",
    logoUrl: "https://exemplo.org/logo.png",
    panelColor: "#ffffff",
    greeting: "Bem-vindo ao Agosto Lilás",
    buttonText: "Entrar com sua conta institucional",
  };

  const MARCA_ANTIGA = {
    backgroundUrl: "https://exemplo.org/campanha-do-ano-passado.jpg",
    panelColor: "#c296eb",
    greeting: "Saudação antiga",
  };

  /*
  Um JWT expirado e indecifrável, do formato que o PostgREST recusa com
  `401 PGRST301` — "None of the keys was able to decode the JWT". É o estado em
  que uma sessão corrompida deixa o armazenamento.
*/
  function jwtExpirado() {
    const b64 = (o) =>
      btoa(JSON.stringify(o))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
    const exp = Math.floor(Date.now() / 1000) - 7200;
    return [
      b64({ alg: "HS256", typ: "JWT" }),
      b64({
        sub: "00000000-0000-0000-0000-000000000000",
        role: "authenticated",
        exp,
      }),
      "assinatura-invalida",
    ].join(".");
  }

  function semearSessao(token) {
    localStorage.setItem(
      "agsus-monitora-auth",
      JSON.stringify({
        access_token: token,
        token_type: "bearer",
        refresh_token: "r",
      }),
    );
  }

  /** Espião de `fetch` que regista o cabeçalho realmente enviado. */
  function fetchQue(resultado) {
    const chamadas = [];
    const buscar = vi.fn(async (url, opcoes) => {
      chamadas.push({ url, headers: opcoes?.headers || {} });
      if (resultado instanceof Error) throw resultado;
      return resultado;
    });
    buscar.chamadas = chamadas;
    return buscar;
  }

  const respostaOk = (corpo) => ({
    ok: true,
    status: 200,
    json: async () => corpo,
  });
  const respostaErro = (status) => ({
    ok: false,
    status,
    json: async () => ({}),
  });

  const buscarCom = (buscar) =>
    buscarMarcaPublica({ buscar, url: URL_FALSA, chave: CHAVE_PUBLICA });

  /*
  A arte e a cor vão no `#loginScreen`; logo, saudação e texto do botão, no
  estado da marca que a tela de entrada (React) desenha.
*/
  function montarTelaDeAcesso() {
    document.body.innerHTML = `<div id="loginScreen"></div>`;
    marcaDaEntrada.definir({ logoUrl: "", saudacao: "", textoDoBotao: "" });
  }

  function identidadeNaTela() {
    const tela = document.getElementById("loginScreen");
    return {
      fundo: tela.style.getPropertyValue("--login-background-image"),
      painel: tela.style.getPropertyValue("--login-panel-color"),
      logo: marcaDaEntrada.obter().logoUrl,
      saudacao: marcaDaEntrada.obter().saudacao,
      botao: marcaDaEntrada.obter().textoDoBotao,
    };
  }

  beforeEach(() => {
    localStorage.clear();
    montarTelaDeAcesso();
  });
  afterEach(() => localStorage.clear());

  describe("tradução da resposta da RPC", () => {
    it("mapeia as chaves públicas para os campos do cache", () => {
      expect(mapearBrandingPublico(RESPOSTA_DA_RPC)).toEqual(IDENTIDADE_ATUAL);
    });

    /*
    A tela de acesso não tem mais instrução: a RPC ainda devolve a chave
    `auth_access_instruction` (o banco não mudou), e o front a ignora.
  */
    it("ignora a instrução que a RPC ainda devolve", () => {
      expect(RESPOSTA_DA_RPC).toHaveProperty("auth_access_instruction");
      expect(mapearBrandingPublico(RESPOSTA_DA_RPC)).not.toHaveProperty(
        "instruction",
      );
    });

    /*
    Segunda barreira. A lista no SQL já impede que outra chave seja lida; se
    ainda assim algo chegasse, não passaria daqui para o cache nem para a tela.
  */
    it("descarta qualquer campo fora da lista", () => {
      const marca = mapearBrandingPublico({
        ...RESPOSTA_DA_RPC,
        smtp_password: "segredo",
        auth_google_allowed_domains: "agenciasus.org.br",
        monit_id: "referência interna",
      });
      expect(marca).toEqual(IDENTIDADE_ATUAL);
      expect(JSON.stringify(marca)).not.toContain("segredo");
    });

    it("devolve null quando não sobra nada de útil", () => {
      expect(mapearBrandingPublico({})).toBeNull();
      expect(mapearBrandingPublico(null)).toBeNull();
      expect(mapearBrandingPublico([])).toBeNull();
      expect(mapearBrandingPublico({ auth_access_greeting: "   " })).toBeNull();
    });
  });

  /*
  O ponto central desta correção, em duas partes.

  A chamada é pública e não pode depender de haver — ou não haver — sessão válida
  no armazenamento. E a credencial pública não pode viajar em `Authorization`:
  esse cabeçalho é o lugar do JWT de quem está autenticado, e uma chave
  `sb_publishable_…` não é um JWT. O gateway identifica a aplicação pela `apikey`.

  Medido no banco real em 09/09/2026:

    cabeçalhos                      GET /configuracoes    POST /rpc/…
    só apikey                       200, dez chaves       404 PGRST202
    apikey + Bearer <chave>         200, dez chaves       404 PGRST202
    apikey + Bearer <JWT expirado>  401 PGRST301          401 PGRST301
*/
  describe("os cabeçalhos da chamada pública", () => {
    const cabecalhosDe = (buscar) => buscar.chamadas[0].headers;

    it("envia apikey", async () => {
      const buscar = fetchQue(respostaOk(RESPOSTA_DA_RPC));
      await buscarCom(buscar);
      expect(cabecalhosDe(buscar).apikey).toBe(CHAVE_PUBLICA);
    });

    /*
    A regressão que esta correção fecha: a chave publicável ia também em
    `Authorization: Bearer`, fingindo-se de identidade de utilizador.
  */
    it("NÃO envia Authorization", async () => {
      const buscar = fetchQue(respostaOk(RESPOSTA_DA_RPC));
      await buscarCom(buscar);
      const cabecalhos = cabecalhosDe(buscar);
      expect(cabecalhos).not.toHaveProperty("Authorization");
      expect(cabecalhos).not.toHaveProperty("authorization");
      expect(JSON.stringify(cabecalhos)).not.toContain("Bearer");
    });

    it("JWT inválido no armazenamento não altera os cabeçalhos", async () => {
      const token = jwtExpirado();
      semearSessao(token);

      const buscar = fetchQue(respostaOk(RESPOSTA_DA_RPC));
      const marca = await buscarCom(buscar);

      const cabecalhos = cabecalhosDe(buscar);
      expect(cabecalhos).toEqual({
        "Content-Type": "application/json",
        apikey: CHAVE_PUBLICA,
      });
      expect(JSON.stringify(cabecalhos)).not.toContain(token);
      expect(marca).toEqual(IDENTIDADE_ATUAL);
    });

    it("sessão válida no armazenamento também não altera os cabeçalhos", async () => {
      semearSessao("token-de-sessao-perfeitamente-valido");

      const buscar = fetchQue(respostaOk(RESPOSTA_DA_RPC));
      const marca = await buscarCom(buscar);

      expect(cabecalhosDe(buscar)).toEqual({
        "Content-Type": "application/json",
        apikey: CHAVE_PUBLICA,
      });
      expect(JSON.stringify(cabecalhosDe(buscar))).not.toContain(
        "token-de-sessao",
      );
      expect(marca).toEqual(IDENTIDADE_ATUAL);
    });

    it("a resposta continua filtrada pela whitelist, venha o que vier", async () => {
      const buscar = fetchQue(
        respostaOk({
          ...RESPOSTA_DA_RPC,
          smtp_password: "segredo",
          auth_google_allowed_domains: "agenciasus.org.br",
        }),
      );
      const marca = await buscarCom(buscar);
      expect(marca).toEqual(IDENTIDADE_ATUAL);
      expect(JSON.stringify(marca)).not.toContain("segredo");
    });

    it("não cria cliente Supabase: fala por fetch direto", async () => {
      const buscar = fetchQue(respostaOk(RESPOSTA_DA_RPC));
      await buscarCom(buscar);
      expect(buscar.chamadas[0].url).toBe(
        `${URL_FALSA}/rest/v1/rpc/obter_branding_acesso_publico`,
      );
    });
  });

  describe("degradação", () => {
    it("devolve null em resposta de erro, sem lançar", async () => {
      expect(await buscarCom(fetchQue(respostaErro(401)))).toBeNull();
      expect(await buscarCom(fetchQue(respostaErro(404)))).toBeNull();
    });

    it("devolve null quando a rede falha, sem lançar", async () => {
      expect(
        await buscarCom(fetchQue(new TypeError("Failed to fetch"))),
      ).toBeNull();
    });

    it("devolve null sem url ou sem chave", async () => {
      const buscar = fetchQue(respostaOk(RESPOSTA_DA_RPC));
      expect(
        await buscarMarcaPublica({ buscar, url: "", chave: CHAVE_PUBLICA }),
      ).toBeNull();
      expect(
        await buscarMarcaPublica({ buscar, url: URL_FALSA, chave: "" }),
      ).toBeNull();
      expect(buscar).not.toHaveBeenCalled();
    });
  });

  describe("os seis cenários de identidade", () => {
    it("1. cache vazio, nenhuma sessão: recebe a identidade configurada", async () => {
      expect(lerMarcaGuardada()).toBeNull();
      expect(aplicarMarcaGuardadaNoArranque(document)).toBe(false);

      const marca = await buscarCom(fetchQue(respostaOk(RESPOSTA_DA_RPC)));
      aplicarMarcaNaTela(marca, document);

      const naTela = identidadeNaTela();
      expect(naTela.fundo).toContain(IDENTIDADE_ATUAL.backgroundUrl);
      expect(naTela.painel).toBe(IDENTIDADE_ATUAL.panelColor);
      expect(naTela.logo).toBe(IDENTIDADE_ATUAL.logoUrl);
      expect(naTela.saudacao).toBe(IDENTIDADE_ATUAL.greeting);
      expect(naTela.botao).toBe(IDENTIDADE_ATUAL.buttonText);
    });

    it("2. cache vazio com JWT inválido no armazenamento: funciona na mesma", async () => {
      semearSessao(jwtExpirado());
      expect(lerMarcaGuardada()).toBeNull();

      const marca = await buscarCom(fetchQue(respostaOk(RESPOSTA_DA_RPC)));
      expect(marca).toEqual(IDENTIDADE_ATUAL);
      aplicarMarcaNaTela(marca, document);
      expect(identidadeNaTela().saudacao).toBe(IDENTIDADE_ATUAL.greeting);
    });

    /*
    Com cache válido e sessão corrompida, a única coisa proibida é regredir ao
    padrão. Atualizar para a identidade atual é bom; manter a guardada é aceitável.
  */
    it("3. cache válido com JWT inválido: nunca volta ao padrão", async () => {
      guardarMarca(MARCA_ANTIGA);
      semearSessao(jwtExpirado());
      aplicarMarcaGuardadaNoArranque(document);

      const marca = await buscarCom(fetchQue(respostaOk(RESPOSTA_DA_RPC)));
      guardarMarca(marca);
      aplicarMarcaNaTela(marca, document);

      const naTela = identidadeNaTela();
      expect(naTela.saudacao).toBe(IDENTIDADE_ATUAL.greeting);
      expect(naTela.saudacao).not.toBe("Boas-vindas!");
      expect(lerMarcaGuardada().backgroundUrl).toBe(
        IDENTIDADE_ATUAL.backgroundUrl,
      );
    });

    it("4. sessão autenticada válida: o branding também funciona", async () => {
      semearSessao("token-valido");
      const marca = await buscarCom(fetchQue(respostaOk(RESPOSTA_DA_RPC)));
      expect(marca).toEqual(IDENTIDADE_ATUAL);
    });

    it("5. RPC fora do ar com cache válido: o cache permanece", async () => {
      guardarMarca(IDENTIDADE_ATUAL);
      aplicarMarcaGuardadaNoArranque(document);

      const marca = await buscarCom(fetchQue(new TypeError("Failed to fetch")));
      expect(marca).toBeNull();

      expect(lerMarcaGuardada()).toEqual(IDENTIDADE_ATUAL);
      expect(identidadeNaTela().saudacao).toBe(IDENTIDADE_ATUAL.greeting);
    });

    it("6. RPC fora do ar sem cache: neutro, nunca a arte antiga", async () => {
      expect(aplicarMarcaGuardadaNoArranque(document)).toBe(false);

      const marca = await buscarCom(fetchQue(respostaErro(404)));
      expect(marca).toBeNull();
      expect(aplicarMarcaNaTela(marca, document)).toBe(false);

      const naTela = identidadeNaTela();
      expect(naTela.fundo).toBe("");
      expect(naTela.painel).toBe("");
      expect(naTela.saudacao).toBe("");
      expect(lerMarcaGuardada()).toBeNull();
    });
  });

  describe("cache antigo é substituído pela identidade atual", () => {
    it("a RPC nova atualiza o que estava guardado", async () => {
      guardarMarca(MARCA_ANTIGA);
      aplicarMarcaGuardadaNoArranque(document);
      expect(identidadeNaTela().saudacao).toBe(MARCA_ANTIGA.greeting);

      const marca = await buscarCom(fetchQue(respostaOk(RESPOSTA_DA_RPC)));
      guardarMarca(marca);
      aplicarMarcaNaTela(marca, document);

      expect(identidadeNaTela().saudacao).toBe(IDENTIDADE_ATUAL.greeting);
      expect(lerMarcaGuardada()).toEqual({
        ...MARCA_ANTIGA,
        ...IDENTIDADE_ATUAL,
      });
    });

    /*
    O `fetch` é substituído explicitamente. Sem isso, o teste dependeria de o
    ambiente **não** ter as variáveis do Supabase — e passaria a fazer chamada
    real assim que alguém criasse um `.env.local`. Foi exatamente o que
    aconteceu durante a validação do preview: a suíte começou a falar com
    produção e a gravar a marca verdadeira no cache.
  */
    it("uma falha não escreve no cache", async () => {
      guardarMarca(IDENTIDADE_ATUAL);
      const antes = lerMarcaGuardada();

      const original = globalThis.fetch;
      globalThis.fetch = async () => {
        throw new TypeError("Failed to fetch");
      };
      try {
        await atualizarMarcaComBrandingPublico(document);
      } finally {
        globalThis.fetch = original;
      }

      expect(lerMarcaGuardada()).toEqual(antes);
    });
  });

  /*
  O contraste é derivado da cor, sempre, em qualquer caminho que a aplique.

  Antes havia duas implementações da mesma identidade: `applyConfigToUi()`
  aplicava cor **e** classe; o arranque aplicava só a cor. Na tela de acesso não
  autenticada — onde `applyConfigToUi()` nem toca na identidade, porque `anon`
  não recebe `auth_access_panel_color` — o resultado era painel escuro com texto
  escuro. Ilegível, e permanente.

  A classe nunca é guardada: `panelColor` é a única fonte de verdade.
*/
  describe("cor do painel e contraste são atómicos", () => {
    const tela = () => document.getElementById("loginScreen");

    it("cor clara não recebe a classe escura", () => {
      for (const clara of ["#ffffff", "#f2f2f2", "#e1e4e5", "#c296eb"]) {
        tela().classList.add("login-panel-dark");
        aplicarCorDoPainel(tela(), clara);
        expect(tela().classList.contains("login-panel-dark"), clara).toBe(
          false,
        );
        expect(tela().style.getPropertyValue("--login-panel-color")).toBe(
          clara,
        );
      }
    });

    it("cor escura recebe a classe escura", () => {
      for (const escura of ["#0b2c4d", "#000000", "#102a43", "#1f2937"]) {
        tela().classList.remove("login-panel-dark");
        aplicarCorDoPainel(tela(), escura);
        expect(tela().classList.contains("login-panel-dark"), escura).toBe(
          true,
        );
        expect(tela().style.getPropertyValue("--login-panel-color")).toBe(
          escura,
        );
      }
    });

    it("alternar claro → escuro → claro acerta os dois sentidos", () => {
      aplicarCorDoPainel(tela(), "#ffffff");
      expect(tela().classList.contains("login-panel-dark")).toBe(false);
      aplicarCorDoPainel(tela(), "#0b2c4d");
      expect(tela().classList.contains("login-panel-dark")).toBe(true);
      aplicarCorDoPainel(tela(), "#ffffff");
      expect(tela().classList.contains("login-panel-dark")).toBe(false);
    });

    /*
    A regressão do print: F5 com cache de painel escuro abria com texto escuro,
    porque só a cor era restaurada.
  */
    it("cache com painel escuro já pinta com a classe no primeiro passo", () => {
      guardarMarca({ ...IDENTIDADE_ATUAL, panelColor: "#0b2c4d" });
      aplicarMarcaGuardadaNoArranque(document);
      expect(tela().style.getPropertyValue("--login-panel-color")).toBe(
        "#0b2c4d",
      );
      expect(tela().classList.contains("login-panel-dark")).toBe(true);
    });

    it("cache com painel claro não deixa a classe presa", () => {
      tela().classList.add("login-panel-dark");
      guardarMarca({ ...IDENTIDADE_ATUAL, panelColor: "#ffffff" });
      aplicarMarcaGuardadaNoArranque(document);
      expect(tela().classList.contains("login-panel-dark")).toBe(false);
    });

    it("marca vinda da RPC com painel escuro também aplica a classe", async () => {
      const buscar = fetchQue(
        respostaOk({ ...RESPOSTA_DA_RPC, auth_access_panel_color: "#0b2c4d" }),
      );
      const marca = await buscarCom(buscar);
      aplicarMarcaNaTela(marca, document);
      expect(tela().classList.contains("login-panel-dark")).toBe(true);
    });

    it("sem cor, nada é tocado", () => {
      tela().classList.remove("login-panel-dark");
      expect(aplicarCorDoPainel(tela(), "")).toBe(false);
      expect(aplicarCorDoPainel(null, "#0b2c4d")).toBe(false);
      expect(tela().classList.contains("login-panel-dark")).toBe(false);
    });

    /*
    O contrato que impede a regressão voltar: quem aplica a identidade não pode
    escrever a variável de cor sem passar por aqui.
  */
    it("nenhum módulo aplica a cor sem derivar o contraste", () => {
      const semComentarios = (f) =>
        readFileSync(f, "utf8")
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/^\s*\/\/.*$/gm, "");
      for (const ficheiro of [
        "src/app/configuracao.ts",
        "src/app/entrada/marca.ts",
      ]) {
        const codigo = semComentarios(ficheiro);
        const escritas = (
          codigo.match(/setProperty\(\s*"--login-panel-color"/g) || []
        ).length;
        const esperado = ficheiro.endsWith("marca.ts") ? 1 : 0;
        expect(
          escritas,
          `${ficheiro} escreve a cor fora da função partilhada`,
        ).toBe(esperado);
      }
    });
  });
});

bloco("config-secoes", () => {
  const html = htmlDaPagina();
  const main = readFileSync("src/main.ts", "utf8");
  const modulo = readFileSync("src/modulos/configuracoes/secoes.ts", "utf8");

  /*
  A página era um formulário corrido: um card com 47 campos e três subtítulos
  soltos. Agora tem as mesmas sete seções do SIGAV, mais Módulos e abas e
  Status das atualizações e Automação (só admin global). O conteúdo de cada seção é
  React (src/modulos/configuracoes/ e as telas de Acessos, Módulos e abas,
  Status e Automação), e cada seção é uma rota.
*/
  describe("as seções (as sete do SIGAV + Módulos e abas + Status das atualizações + Automação)", () => {
    it("são exatamente essas, nessa ordem", () => {
      expect(SECOES.map((s) => s.rotulo)).toEqual([
        "Marca",
        "Página inicial",
        "Tela de acesso",
        "Aparência",
        "Comemorações",
        "Acessos",
        "Painéis externos",
        "Módulos e abas",
        "Operação",
        "Status das atualizações",
        "Automação",
      ]);
    });

    it("cada uma tem ícone e descrição", () => {
      for (const secao of SECOES) {
        expect(secao.icone, `${secao.rotulo} sem ícone`).toMatch(/^fa-/);
        expect(
          secao.descricao.length,
          `${secao.rotulo} sem descrição`,
        ).toBeGreaterThan(20);
      }
    });
  });

  /*
  As seções são rotas (/administracao/configuracoes/<seção>): a página
  (src/app/telas.tsx) desenha um <article class="config-secao"> por seção e
  os blocos das quatro com tela própria; a navegação (src/app/navegacao.ts)
  escolhe a aberta pelas permissões do perfil.
*/
  const BLOCOS = {
    acessosApp: "acessos",
    modulosApp: "modulos",
    saudeDasCargasApp: "cargas",
    automacaoApp: "automacao",
  };

  describe("a página das seções", () => {
    it("cada seção tem o seu article, e os quatro blocos com tela própria estão dentro dela", () => {
      const pagina = document.createElement("div");
      pagina.innerHTML = html.slice(
        html.indexOf('<section id="page-config"'),
        html.indexOf('<section id="page-sem-acesso"'),
      );
      expect(
        [...pagina.querySelectorAll(".config-secao")].map(
          (a) => a.dataset.secao,
        ),
      ).toEqual(SECOES.map((s) => s.id));
      for (const [bloco, secao] of Object.entries(BLOCOS)) {
        const artigo = pagina
          .querySelector(`#${bloco}`)
          ?.closest(".config-secao");
        expect(artigo?.dataset.secao, `#${bloco}`).toBe(secao);
      }
    });

    it("o formulário legado saiu: nenhum campo cfg* em Configurações", () => {
      const inicio = html.indexOf('id="page-config"');
      const bloco = html.slice(inicio, html.indexOf('id="page-sem-acesso"'));
      expect(bloco).not.toMatch(/id="cfg/);
      expect(bloco).not.toContain("config-main-card");
      expect(bloco).not.toContain("admin-grid");
    });
  });

  const ADMIN = { id: "a", ativo: true, perfil: "admin", admin_global: true };
  // Admin global sem Configurações: só a seção Acessos.
  const SO_ACESSOS = { ...ADMIN, permissoes: { configuracoes: "sem_acesso" } };

  describe("as seções como rotas de Administração", () => {
    let montado = null;
    let acessos;

    function abrir({ perfil = ADMIN } = {}) {
      acessos = {
        render: vi.fn(),
        confirmarSaida: vi.fn(() => true),
        conteudo: createElement("input", { id: "buscaDeAcessos" }),
      };
      const navegacao = criarNavegacao({
        janela: { location: { reload: vi.fn() } },
        obterPerfil: () => perfil,
        confirmarSaida: () => true,
        aplicarAtualizacao: () => false,
      });
      montado = montarTelasNoTeste(navegacao, {
        config: {},
        "secao:acessos": acessos,
        "secao:modulos": { confirmarSaida: () => true },
      });
      montado.navegacao.montarMenu();
      return montado.navegacao;
    }

    const visivel = () =>
      [...document.querySelectorAll(".config-secao:not([hidden])")].map(
        (a) => a.dataset.secao,
      );
    const endereco = () => location.pathname;

    beforeEach(() => {
      document.body.innerHTML = '<main id="conteudoPrincipal"></main>';
      history.replaceState(null, "", "/");
    });
    afterEach(() => {
      montado?.desmontar();
      montado = null;
    });

    it("abre na primeira seção permitida, com ela no endereço", () => {
      const navegacao = abrir();
      navegacao.irPara("config");
      expect(navegacao.obter().secao).toBe("marca");
      expect(visivel()).toEqual(["marca"]);
      expect(endereco()).toBe("/administracao/configuracoes/marca");
      expect(document.getElementById("page-config").dataset.subgrupo).toBe(
        "marca",
      );
    });

    it("trocar de seção troca o article à vista e o endereço; Acessos relê a cada abertura", () => {
      const navegacao = abrir();
      navegacao.irPara("config");
      expect(navegacao.abrirSecao("acessos")).toBe(true);
      expect(visivel()).toEqual(["acessos"]);
      expect(endereco()).toBe("/administracao/configuracoes/acessos");
      expect(acessos.render).toHaveBeenCalledTimes(1);
      navegacao.abrirSecao("operacao");
      expect(acessos.render).toHaveBeenCalledTimes(1);
      navegacao.abrirSecao("acessos");
      expect(acessos.render).toHaveBeenCalledTimes(2);
    });

    it("a seção visitada continua montada: o rascunho fica", () => {
      const navegacao = abrir();
      navegacao.irPara("config");
      navegacao.abrirSecao("acessos");
      const campo = document.getElementById("buscaDeAcessos");
      campo.value = "Rascunho";
      navegacao.abrirSecao("marca");
      navegacao.abrirSecao("acessos");
      expect(document.getElementById("buscaDeAcessos")).toBe(campo);
      expect(campo.value).toBe("Rascunho");
    });

    it("recusa seção que não existe e não muda a aberta", () => {
      const navegacao = abrir();
      navegacao.irPara("config");
      expect(navegacao.abrirSecao("inexistente")).toBe(false);
      expect(navegacao.obter().secao).toBe("marca");
    });

    it("sair de Acessos com alteração não salva recusada fica em Acessos", () => {
      const navegacao = abrir();
      navegacao.irPara("config");
      navegacao.abrirSecao("acessos");
      acessos.confirmarSaida.mockReturnValue(false);
      expect(navegacao.abrirSecao("marca")).toBe(false);
      expect(navegacao.obter().secao).toBe("acessos");
      expect(visivel()).toEqual(["acessos"]);
    });

    it("só abre as seções permitidas; o endereço de uma proibida cai na primeira permitida", () => {
      history.replaceState(null, "", "/administracao/configuracoes/marca");
      const navegacao = abrir({ perfil: SO_ACESSOS });
      navegacao.abrirEntrada();
      expect(navegacao.obter().secao).toBe("acessos");
      expect(endereco()).toBe("/administracao/configuracoes/acessos");
      expect(navegacao.abrirSecao("marca")).toBe(false);
      expect(navegacao.obter().secao).toBe("acessos");
    });

    it("de outra página, abrir a seção abre Configurações já nela", () => {
      const navegacao = abrir();
      navegacao.irPara("nucleo");
      expect(navegacao.abrirSecao("acessos")).toBe(true);
      expect(navegacao.obter()).toMatchObject({
        view: "config",
        secao: "acessos",
      });
      expect(acessos.render).toHaveBeenCalledTimes(1);
    });
  });

  describe("integração no arranque", () => {
    it("nada de mover blocos pelo DOM nem de controlador em window", () => {
      expect(main).not.toContain("organizarConfiguracoesEmSecoes");
      expect(main).not.toMatch(/window\.\w+Controller\s*=/);
      expect(modulo).not.toContain("appendChild");
      expect(modulo).not.toContain("document");
    });
  });

  /*
  Um navegador só: a barra antiga de config-page-enhancements.js (cinco abas,
  busca e contador) saiu junto com o arquivo; o navegador é o menu de seções.
*/
  describe("um navegador só", () => {
    it("o arquivo da barra antiga não é mais instalado", () => {
      expect(main).not.toContain("config-page-enhancements");
      expect(main).not.toContain("removerNavegadorAntigo");
    });
  });

  /*
  As seções que publicam pela barra fixa são React: o legado não tem mais a
  marcação delas nem os módulos que as montavam.
*/
  describe("as seções do formulário saíram do legado", () => {
    it("o index.html não tem a marcação antiga e os módulos antigos não são instalados", () => {
      for (const id of [
        "panelAdmin",
        "cfgRealtimeEnabled",
        "cfgAccessHeartbeatMinutos",
        "cfgCogipVersao",
        "cfgAppVersionCurrent",
        "cfgMonitId",
        "cfgCnesJson",
        "cnesImportResumo",
        "cfgPageTitle",
        "cfgAccessGreeting",
        "cfgAccessPanelColor",
      ])
        expect(html, id).not.toContain(`id="${id}"`);
      expect(modulo).not.toContain("esconderAgrupadoresVazios");
      expect(modulo).not.toContain("SECAO_POR_CAMPO");
      expect(main).not.toContain("config-apresentacao.js");
      expect(main).not.toContain("aviso-de-contraste");
    });
  });
});

bloco("convite-de-acesso", () => {
  /*
  Visão simples de Acessos: situação (convite pendente / último acesso),
  mensagem e mailto do convite, o grupo em uma frase e a trava "ficaria sem
  área" (espelho do 23514 de salvar_matriz_acessos).
*/

  const ORIGEM = "https://monitora.agenciasus.org.br";

  describe("situação do acesso", () => {
    it("convite pendente vence o resto", () => {
      expect(
        situacaoDoAcesso({
          convite_pendente: true,
          ultimo_acesso: "2026-09-01T12:00:00Z",
        }),
      ).toEqual({ tipo: "convite", rotulo: "Convidado · ainda não entrou" });
    });

    it("último acesso com data e hora, no horário de Brasília", () => {
      expect(
        situacaoDoAcesso({ ultimo_acesso: "2026-09-30T15:00:00Z" }).rotulo,
      ).toBe("Último acesso em 30/09/2026 às 12:00");
      expect(dataHoraCurta("2026-10-01T12:13:09Z")).toBe("01/10/2026 às 09:13");
      expect(dataHoraCurta("inválida")).toBe("");
      // 01h UTC ainda é o dia anterior em Brasília.
      expect(dataCurta("2026-10-01T01:00:00Z")).toBe("30/09/2026");
    });

    it("sem data (ou data inválida) é 'Nunca'", () => {
      expect(situacaoDoAcesso({ ultimo_acesso: null })).toEqual({
        tipo: "nunca",
        rotulo: "Nunca",
      });
      expect(situacaoDoAcesso({ ultimo_acesso: "ontem" }).rotulo).toBe("Nunca");
      expect(situacaoDoAcesso(null).rotulo).toBe("Nunca");
    });
  });

  describe("mensagem do convite", () => {
    it("nome, endereço do sistema e a conta Google do e-mail", () => {
      expect(
        mensagemDoConvite({
          nome: "  Maria   Silva ",
          email: "maria@agenciasus.org.br",
          origem: `${ORIGEM}/`,
        }),
      ).toBe(
        `Olá, Maria Silva! Você foi convidado(a) para o Yeendé (AgSUS). Acesse ${ORIGEM} e entre com sua conta Google maria@agenciasus.org.br.`,
      );
      expect(mensagemDoConvite({ email: "x@y.z", origem: ORIGEM })).toMatch(
        /^Olá! /,
      );
    });

    it("mailto para o convidado, com assunto e corpo codificados", () => {
      const link = linkDoEmailDoConvite({
        nome: "João & Cia",
        email: "joao@agenciasus.org.br",
        origem: ORIGEM,
      });
      expect(link.startsWith("mailto:joao@agenciasus.org.br?subject=")).toBe(
        true,
      );
      const params = new URLSearchParams(link.slice(link.indexOf("?") + 1));
      expect(params.get("subject")).toBe(ASSUNTO_DO_CONVITE);
      expect(params.get("body")).toBe(
        mensagemDoConvite({
          nome: "João & Cia",
          email: "joao@agenciasus.org.br",
          origem: ORIGEM,
        }),
      );
      // "&" do nome não quebra os parâmetros.
      expect(link).not.toContain("João & Cia");
    });

    it("copia pela área de transferência; sem ela, pelo execCommand", async () => {
      const writeText = vi.fn(async () => {});
      expect(await copiarTexto("oi", { clipboard: { writeText } })).toBe(true);
      expect(writeText).toHaveBeenCalledWith("oi");

      const execCommand = vi.fn(() => true);
      const documento = {
        body: document.body,
        createElement: (tag) => document.createElement(tag),
        execCommand,
      };
      const negado = {
        writeText: vi.fn(async () => Promise.reject(new Error())),
      };
      expect(await copiarTexto("oi", { clipboard: negado, documento })).toBe(
        true,
      );
      expect(execCommand).toHaveBeenCalledWith("copy");
      expect(document.querySelector("textarea")).toBeNull();

      expect(await copiarTexto("oi", { clipboard: null, documento: {} })).toBe(
        false,
      );
    });
  });

  const GRUPOS = [
    {
      codigo: "usuario",
      nome: "Usuário",
      niveis: {
        dashboard: "leitor",
        analises: "leitor",
        avaliacao_documental: "leitor",
        nucleo: "leitor",
        calendario: "leitor",
        aprovados: "leitor",
        aprovados_pendencias: "leitor",
        entrevistas: "leitor",
        classificacao: "leitor",
        recursos: "leitor",
        selecao: "leitor",
        paineis_dados: "leitor",
        importacao: "leitor",
        paineis: "leitor",
        configuracoes: "sem_acesso",
        acessos: "sem_acesso",
      },
    },
    {
      codigo: "coordenador",
      nome: "Coordenador",
      niveis: {
        dashboard: "leitor",
        nucleo: "editor",
        calendario: "editor",
        acessos: "editor",
      },
    },
    { codigo: "admin", nome: "Administrador", admin_global: true, niveis: {} },
    { codigo: "vazio", nome: "Sem nada", niveis: {} },
  ];

  describe("grupo em uma frase", () => {
    it("lê os níveis do grupo", () => {
      expect(explicacaoDoGrupo(GRUPOS[0])).toBe(
        "Leitura: vê tudo, não altera nada.",
      );
      expect(explicacaoDoGrupo(GRUPOS[1])).toBe(
        "Edição: altera editais e cronograma; o resto só vê. Gerencia os acessos da coordenação.",
      );
      expect(explicacaoDoGrupo(GRUPOS[2])).toBe(
        "Administrador: vê e altera tudo, em todas as áreas.",
      );
      expect(explicacaoDoGrupo(GRUPOS[3])).toBe(
        "Sem acesso: não vê nenhuma página.",
      );
      expect(
        explicacaoDoGrupo({
          niveis: { dashboard: "leitor", nucleo: "leitor" },
        }),
      ).toBe("Leitura: vê visão geral e editais, não altera nada.");
      expect(explicacaoDoGrupo(null)).toBe("");
    });
  });

  const area = (nivel) => ({
    nivel,
    origem: "excecao",
    nivel_grupo: "sem_acesso",
    revisao: 0,
  });
  const ADMIN = {
    id: "a1",
    nome: "Conta Admin",
    email: "adm@agenciasus.org.br",
    grupo: "admin",
    coordenacao: null,
    revisao_conta: "t0",
    admin_global: true,
    ativo: true,
    areas_efetivas: ["saude-indigena", "sede"],
    permissoes: {
      "area:saude-indigena": area("sem_acesso"),
      "area:sede": area("sem_acesso"),
    },
  };
  const MATRIZ = {
    usuarios: [ADMIN],
    grupos: GRUPOS,
    areas: [
      { id: "saude-indigena", titulo: "Saúde Indígena" },
      { id: "sede", titulo: "Sede" },
    ],
    coordenacoes: [{ codigo: "norte", nome: "Norte", area: "saude-indigena" }],
  };

  describe("trava: ninguém fica sem área", () => {
    it("regra pura", () => {
      expect(
        ficariaSemArea({
          adminGlobal: false,
          coordenacao: null,
          areasMarcadas: [],
        }),
      ).toBe(true);
      expect(
        ficariaSemArea({
          adminGlobal: true,
          coordenacao: null,
          areasMarcadas: [],
        }),
      ).toBe(false);
      expect(
        ficariaSemArea({
          adminGlobal: false,
          coordenacao: "norte",
          areasMarcadas: [],
        }),
      ).toBe(false);
      expect(
        ficariaSemArea({
          adminGlobal: false,
          coordenacao: null,
          areasMarcadas: ["sede"],
        }),
      ).toBe(false);
    });

    it("administrador que vira Usuário sem área trava; marcar a área libera", () => {
      let rascunho = new Map();
      expect(linhaFicariaSemArea(ADMIN, rascunho, MATRIZ)).toBe(false);
      rascunho = registrarNoRascunho(rascunho, ADMIN, ALVO_GRUPO, "usuario");
      expect(linhaFicariaSemArea(ADMIN, rascunho, MATRIZ)).toBe(true);
      expect(
        pessoasSemAreaNoRascunho(rascunho, MATRIZ).map((u) => u.id),
      ).toEqual(["a1"]);
      expect(areasDaLinha(ADMIN, rascunho, MATRIZ)).toEqual({
        todas: false,
        ids: [],
      });
      rascunho = registrarNoRascunho(rascunho, ADMIN, "area:sede", "leitor");
      expect(pessoasSemAreaNoRascunho(rascunho, MATRIZ)).toEqual([]);
      expect(areasDaLinha(ADMIN, rascunho, MATRIZ).ids).toEqual(["sede"]);
    });

    it("coordenação no rascunho também resolve; inativa não conta", () => {
      let rascunho = registrarNoRascunho(
        new Map(),
        ADMIN,
        ALVO_GRUPO,
        "usuario",
      );
      rascunho = registrarNoRascunho(rascunho, ADMIN, "#coordenacao", "norte");
      expect(linhaFicariaSemArea(ADMIN, rascunho, MATRIZ)).toBe(false);
      expect(areasDaLinha(ADMIN, rascunho, MATRIZ).ids).toEqual([
        "saude-indigena",
      ]);
      const inativa = { ...ADMIN, ativo: false };
      expect(
        linhaFicariaSemArea(
          inativa,
          registrarNoRascunho(new Map(), inativa, ALVO_GRUPO, "usuario"),
          MATRIZ,
        ),
      ).toBe(false);
    });

    it("sem alteração, a coluna usa o que o banco calculou", () => {
      expect(areasDaLinha(ADMIN, new Map(), MATRIZ)).toEqual({
        todas: true,
        ids: [],
      });
      const pessoa = { ...ADMIN, grupo: "usuario", admin_global: false };
      expect(areasDaLinha(pessoa, new Map(), MATRIZ).ids).toEqual([
        "saude-indigena",
        "sede",
      ]);
    });
  });
});

bloco("csp-report-monitor", () => {
  describe("csp report monitor", () => {
    it("remove caminho e query de URLs bloqueadas", () => {
      expect(
        sanitizeBlockedUri("https://cdn.example.org/script.js?token=secret"),
      ).toBe("https://cdn.example.org");
    });

    it("preserva marcadores especiais do navegador", () => {
      expect(sanitizeBlockedUri("inline")).toBe("inline");
      expect(sanitizeBlockedUri("eval")).toBe("eval");
    });

    it("monta detalhes técnicos sem URL completa", () => {
      const details = buildCspViolationDetails({
        effectiveDirective: "script-src-elem",
        violatedDirective: "script-src",
        blockedURI: "https://cdn.example.org/app.js?token=secret",
        sourceFile: "https://app.example.org/index.html?code=private",
        disposition: "report",
        lineNumber: 20,
        columnNumber: 8,
      });

      expect(details.effective_directive).toBe("script-src-elem");
      expect(details.blocked_uri).toBe("https://cdn.example.org");
      expect(details.source_file_origin).toBe("https://app.example.org");
      expect(details.line_number).toBe(20);
      expect(JSON.stringify(details)).not.toContain("secret");
      expect(JSON.stringify(details)).not.toContain("private");
    });
  });
});

bloco("esqueleto-da-entrada", () => {
  const html = readFileSync("index.html", "utf8");
  const css = readFileSync("src/styles/carregamento.css", "utf8");
  const legado = fonteDoApp();

  const inicio = html.indexOf("(function marcarSessaoGuardada()");
  const script = html.slice(inicio, html.indexOf("</script>", inicio));

  const TELAS = [
    ["", "painel"],
    ["dashboard", "painel"],
    ["panel:bi-rh", "painel"],
    ["calendario", "calendario"],
    ["nucleo", "tabela"],
    ["approved", "tabela"],
    ["config", "tabela"],
    ["acessos", "tabela"],
  ];

  describe("formato do skeleton", () => {
    it.each(TELAS)("tela %j abre no formato %s", (tela, formato) => {
      expect(formatoDoEsqueleto(tela)).toBe(formato);
    });

    it("todo formato tem marcação no index.html e regra no CSS", () => {
      for (const formato of FORMATOS_DO_ESQUELETO) {
        expect(html).toContain(`data-formato="${formato}"`);
        expect(css).toContain(
          `html[data-esqueleto="${formato}"] [data-formato="${formato}"]`,
        );
      }
    });
  });

  describe("antes da primeira pintura (script do <head>)", () => {
    const raiz = document.documentElement;

    function rodar({ sessao = true, tela, barra, tema } = {}) {
      localStorage.clear();
      raiz.className = "";
      for (const nome of [
        "data-esqueleto",
        "data-esqueleto-barra",
        "data-theme",
      ])
        raiz.removeAttribute(nome);
      if (sessao)
        localStorage.setItem(
          SUPABASE_AUTH_STORAGE_KEY,
          JSON.stringify({ access_token: "a", refresh_token: "r" }),
        );
      if (tela !== undefined)
        localStorage.setItem("agsus_monitora_current_view_v268", tela);
      if (barra !== undefined)
        localStorage.setItem("agsus_monitora_sidebar_collapsed_v1", barra);
      if (tema !== undefined) localStorage.setItem("agsus_dark_mode_v1", tema);
      new Function(script)();
    }

    afterEach(() => {
      localStorage.clear();
      raiz.className = "";
    });

    it("usa as mesmas chaves que o legado", () => {
      const chaveDaTela = CHAVE_DA_TELA_GUARDADA;
      expect(script).toContain(`"${chaveDaTela}"`);
      expect(legado).toContain('"agsus_monitora_sidebar_collapsed_v1"');
      expect(script).toContain('"agsus_monitora_sidebar_collapsed_v1"');
      expect(legado).toContain('"agsus_dark_mode_v1"');
      expect(script).toContain('"agsus_dark_mode_v1"');
    });

    it.each(TELAS)(
      "a regra do <head> concorda com a do lib: %j",
      (tela, formato) => {
        rodar({ tela });
        expect(raiz.getAttribute("data-esqueleto")).toBe(formato);
      },
    );

    it("com sessão guardada, liga o skeleton", () => {
      rodar();
      expect(raiz.classList.contains("esqueleto-ativo")).toBe(true);
      expect(raiz.getAttribute("data-esqueleto")).toBe("painel");
    });

    it("sem sessão, fica a tela de acesso", () => {
      rodar({ sessao: false });
      expect(raiz.classList.contains("esqueleto-ativo")).toBe(false);
      expect(raiz.hasAttribute("data-esqueleto")).toBe(false);
    });

    it("barra aberta e tema escuro já saem na primeira pintura", () => {
      rodar({ barra: "0", tema: "1" });
      expect(raiz.getAttribute("data-esqueleto-barra")).toBe("aberta");
      expect(raiz.getAttribute("data-theme")).toBe("dark");
      rodar({ barra: "1", tema: "0" });
      expect(raiz.hasAttribute("data-esqueleto-barra")).toBe(false);
      expect(raiz.hasAttribute("data-theme")).toBe(false);
    });
  });

  describe("ligar e desligar", () => {
    const raiz = document.documentElement;
    const aviso = () => document.querySelector(".esqueleto-aviso");
    const tentar = () => aviso().querySelector("button");

    beforeEach(() => {
      vi.useFakeTimers({
        toFake: ["setTimeout", "clearTimeout", "performance"],
      });
      const pagina = new DOMParser().parseFromString(html, "text/html");
      document.body.replaceChildren(
        document.importNode(
          pagina.querySelector(".esqueleto-da-entrada"),
          true,
        ),
      );
      document.body.className = "sidebar-collapsed";
    });

    afterEach(() => {
      esconderEsqueleto();
      marcarAtualizacao(false);
      vi.useRealTimers();
    });

    it("liga no formato da tela e desliga", () => {
      mostrarEsqueleto("nucleo");
      expect(esqueletoAtivo()).toBe(true);
      expect(raiz.dataset.esqueleto).toBe("tabela");
      expect(raiz.dataset.esqueletoBarra).toBe("recolhida");
      esconderEsqueleto();
      expect(esqueletoAtivo()).toBe(false);
    });

    it("acompanha a barra lateral aberta", () => {
      document.body.className = "";
      mostrarEsqueleto("dashboard");
      expect(raiz.dataset.esqueletoBarra).toBe("aberta");
    });

    it("na demora, avisa; depois, oferece tentar de novo", () => {
      mostrarEsqueleto("dashboard");
      expect(aviso().hidden).toBe(true);
      vi.advanceTimersByTime(12_000);
      expect(aviso().hidden).toBe(false);
      expect(aviso().textContent).toContain("mais de tempo");
      expect(tentar().hidden).toBe(true);
      vi.advanceTimersByTime(13_000);
      expect(tentar().hidden).toBe(false);
    });

    it("desligar some com o aviso e para a contagem", () => {
      mostrarEsqueleto("dashboard");
      vi.advanceTimersByTime(12_000);
      esconderEsqueleto();
      expect(aviso().hidden).toBe(true);
      vi.advanceTimersByTime(20_000);
      expect(aviso().hidden).toBe(true);
    });

    it("religar no meio da espera não zera a contagem", () => {
      mostrarEsqueleto("dashboard");
      vi.advanceTimersByTime(8_000);
      mostrarEsqueleto("nucleo");
      vi.advanceTimersByTime(4_000);
      expect(aviso().hidden).toBe(false);
    });

    it("ligado pelo <head>, conta a demora desde o início da navegação", () => {
      raiz.classList.add("esqueleto-ativo");
      instalarCarregamento();
      vi.advanceTimersByTime(12_000);
      expect(aviso().hidden).toBe(false);
    });

    it("marca e desmarca a atualização dos dados", () => {
      marcarAtualizacao(true);
      expect(raiz.classList.contains("dados-atualizando")).toBe(true);
      marcarAtualizacao(false);
      expect(raiz.classList.contains("dados-atualizando")).toBe(false);
    });
  });
});

bloco("google-profile-photo", () => {
  function createRoot() {
    document.body.innerHTML = '<div id="topUserAvatar"></div>';
    return document;
  }

  describe("Google profile photo", () => {
    it("usa somente a foto retornada pela conta Google", () => {
      const user = {
        user_metadata: {
          avatar_url: "https://example.com/google-avatar.jpg",
          picture: "https://example.com/fallback.jpg",
        },
      };

      expect(getGoogleProfilePhotoUrl(user)).toBe(
        "https://example.com/google-avatar.jpg",
      );

      const image = renderGoogleProfilePhoto(user, createRoot());
      expect(image?.id).toBe("googleProfilePhoto");
      expect(image?.src).toBe("https://example.com/google-avatar.jpg");
    });

    it("não cria avatar alternativo quando o Google não fornece foto", () => {
      const root = createRoot();
      expect(renderGoogleProfilePhoto({ user_metadata: {} }, root)).toBeNull();
      expect(root.getElementById("googleProfilePhoto")).toBeNull();
    });
  });
});

bloco("identidade-da-aba", () => {
  const html = readFileSync("index.html", "utf8");
  const app = fonteDoApp();

  const semComentarios = (fonte) =>
    semTrechos(semTrechos(fonte, "<!--", "-->"), "/*", "*/");

  /*
  Dois defeitos, medidos antes de mexer.

  O ÍCONE nunca mudava: `<link id="appFavicon">` tinha id, mas nenhum código
  escrevia nele. Ficava preso numa imagem em `i.postimg.cc` — host de terceiros.

  O NOME era sobrescrito: `applyConfigToUi()` fazia
  `document.title = appVersion()`, e `appVersion()` devolve a **versão
  publicada**. A cada aplicação da configuração o nome da página virava uma
  string de versão. Era isso que fazia o título "voltar".
*/
  describe("a aba identifica Yeendé", () => {
    it("mantém a marca ao navegar e receber configuração antiga", () => {
      for (const section of [
        "Saúde Indígena",
        "Editais",
        "Configurações",
        "Análises",
        "",
      ]) {
        definirPaginaDaAba(section);
        expect(document.title).toBe("Yeendé");
        definirSistemaDaAba("Yeendé Web V2.9.35");
        expect(document.title).toBe("Yeendé");
      }
    });
  });

  describe("o ícone da aba", () => {
    const montarCabecalho = () => {
      document.head.innerHTML = `
      <link id="appFavicon" rel="icon" href="${FAVICON_PADRAO}" />
      <link rel="shortcut icon" href="${FAVICON_PADRAO}" />
      <link rel="apple-touch-icon" href="${FAVICON_PADRAO}" />`;
    };

    const hrefs = () =>
      [
        ...document.querySelectorAll(
          'link[rel="icon"],link[rel="shortcut icon"],link[rel="apple-touch-icon"]',
        ),
      ].map((l) => l.getAttribute("href"));

    beforeEach(montarCabecalho);

    /*
    `link[rel~="icon"]` não alcança `apple-touch-icon`: `~=` casa palavras
    separadas por espaço, e "apple-touch-icon" é uma palavra só. Com aquele
    seletor a tag do iOS ficava para trás enquanto as outras duas mudavam.
  */
    it("escreve nas três tags, inclusive apple-touch-icon", () => {
      expect(escreverFavicon("https://exemplo.org/marca.png")).toBe(true);
      expect(hrefs()).toEqual([
        "https://exemplo.org/marca.png",
        "https://exemplo.org/marca.png",
        "https://exemplo.org/marca.png",
      ]);
    });

    it("aceita caminho local e HTTPS, recusa o resto", () => {
      expect(escreverFavicon("/assets/outra.webp")).toBe(true);
      expect(escreverFavicon("http://inseguro.org/x.png")).toBe(false);
      expect(escreverFavicon("")).toBe(false);
      expect(escreverFavicon(null)).toBe(false);
    });

    /*
    Trocar antes de a imagem carregar deixaria a aba sem ícone nenhum quando a
    URL configurada estivesse errada — pior do que manter o anterior.
  */
    it("só troca depois de a imagem carregar", async () => {
      let instancia = null;
      const criarImagem = () => {
        instancia = {
          set src(v) {
            this._src = v;
          },
        };
        return instancia;
      };

      const promessa = aplicarFaviconDaMarca("https://exemplo.org/marca.png", {
        criarImagem,
      });
      // Enquanto não carregou, o ícone antigo permanece.
      expect(hrefs()[0]).toBe(FAVICON_PADRAO);

      instancia.onload();
      await promessa;
      expect(hrefs()[0]).toBe("https://exemplo.org/marca.png");
    });

    it("se a imagem falha, o ícone anterior fica", async () => {
      let instancia = null;
      const criarImagem = () => {
        instancia = {
          set src(v) {
            this._src = v;
          },
        };
        return instancia;
      };

      const promessa = aplicarFaviconDaMarca(
        "https://exemplo.org/quebrada.png",
        {
          criarImagem,
        },
      );
      instancia.onerror();
      expect(await promessa).toBe(false);
      expect(hrefs()).toEqual([FAVICON_PADRAO, FAVICON_PADRAO, FAVICON_PADRAO]);
    });

    it("uma URL inútil não chega a tentar carregar", async () => {
      let tentou = false;
      const criarImagem = () => {
        tentou = true;
        return { set src(v) {} };
      };
      expect(await aplicarFaviconDaMarca("", { criarImagem })).toBe(false);
      expect(tentou).toBe(false);
    });

    it("o padrão local é aplicado sem esperar rede", async () => {
      escreverFavicon("https://exemplo.org/marca.png");
      expect(await aplicarFaviconDaMarca(FAVICON_PADRAO)).toBe(true);
      expect(hrefs()[0]).toBe(FAVICON_PADRAO);
    });
  });

  describe("como o HTML e o app ficam", () => {
    /*
    O comentário deste ficheiro cita `i.postimg.cc` ao explicar o defeito
    corrigido; procurar no texto cru acusaria a própria explicação.
  */
    it("o índice não depende mais de host de terceiros para o ícone", () => {
      const cabecalho = semComentarios(html).slice(0, html.indexOf("</head>"));
      expect(cabecalho).not.toContain("postimg");
      expect(cabecalho).toContain('href="/icons/agsus-monitora.svg"');
    });

    it("traz as três tags, como o SIGAV", () => {
      const cabecalho = semComentarios(html);
      for (const rel of ["icon", "shortcut icon", "apple-touch-icon"]) {
        expect(cabecalho, `falta rel="${rel}"`).toContain(`rel="${rel}"`);
      }
    });

    /*
    As posições têm de sair do MESMO texto que se corta. Cortar o texto sem
    comentários com índices do original desloca tudo — erro que já me custou um
    falso vermelho antes.
  */
    it("a configuração do app não escreve document.title", () => {
      const codigo = semComentarios(
        readFileSync("src/app/configuracao.ts", "utf8"),
      );
      const fn = codigo.slice(
        codigo.indexOf("function aplicarNaTela"),
        codigo.indexOf("const consulta = () =>"),
      );
      expect(fn).not.toContain("document.title");
      expect(fn).toContain("definirSistemaDaAba(");
      expect(fn).toContain("aplicarFaviconDaMarca(");
    });

    it("o título da navegação delega a metade da página", () => {
      const navegacao = readFileSync("src/app/navegacao.ts", "utf8");
      const fn = navegacao.slice(
        navegacao.indexOf("function definirTitulo"),
        navegacao.indexOf("function subtituloDaArea"),
      );
      expect(fn).toContain("definirPaginaDaAba(titulo)");
      expect(fn).not.toContain("document.title");
    });

    /*
    `appVersion()` continua servindo a auditoria e o rodapé da barra lateral —
    o que saiu foi só o uso dela como nome de aba.
  */
    it("appVersion continua em uso onde faz sentido", () => {
      const codigo = semComentarios(fonteDoApp());
      expect(codigo).toContain("p_app_version: configuracao.versao()");
      expect(codigo).toContain('escrever("sidebarVersion", versao())');
    });
  });
});

bloco("identidade-do-acesso", () => {
  const MARCA_DA_INSTITUICAO = {
    backgroundUrl: "https://exemplo.org/agosto-lilas.jpg",
    panelColor: "#ffffff",
    logoUrl: "https://exemplo.org/logo-institucional.png",
    greeting: "Bem-vindo ao Agosto Lilás",
  };

  /* Arte e cor no `#loginScreen`; logo e saudação no estado que a tela (React) desenha. */
  function montarTelaDeAcesso() {
    document.body.innerHTML = `<div id="loginScreen"></div>`;
    marcaDaEntrada.definir({ logoUrl: "", saudacao: "" });
    return document.getElementById("loginScreen");
  }

  function identidadeNaTela() {
    const tela = document.getElementById("loginScreen");
    return {
      backgroundImage: tela.style.getPropertyValue("--login-background-image"),
      panelColor: tela.style.getPropertyValue("--login-panel-color"),
      logo: marcaDaEntrada.obter().logoUrl,
      greeting: marcaDaEntrada.obter().saudacao,
    };
  }

  beforeEach(() => {
    localStorage.clear();
    montarTelaDeAcesso();
  });
  afterEach(() => localStorage.clear());

  describe("cache da identidade", () => {
    it("guarda os quatro campos, não apenas fundo e cor", () => {
      guardarMarca(MARCA_DA_INSTITUICAO);
      expect(lerMarcaGuardada()).toEqual(MARCA_DA_INSTITUICAO);
    });

    /*
    Quem abriu a tela antes de a instrução sair tem `instruction` no cache. A
    leitura só considera os campos conhecidos: o resto da marca continua valendo
    e o campo velho some na próxima gravação.
  */
    it("cache antigo com instrução: lê o resto e descarta a instrução", () => {
      localStorage.setItem(
        "agsus_monitora_access_branding_v1",
        JSON.stringify({
          ...MARCA_DA_INSTITUICAO,
          instruction: "Acesse com sua conta institucional.",
        }),
      );
      expect(lerMarcaGuardada()).toEqual(MARCA_DA_INSTITUICAO);

      guardarMarca({ greeting: "Nova saudação" });
      const gravado = JSON.parse(
        localStorage.getItem("agsus_monitora_access_branding_v1"),
      );
      expect(gravado).not.toHaveProperty("instruction");
      expect(gravado.greeting).toBe("Nova saudação");
    });
  });

  describe("aplicação no arranque", () => {
    /*
    Aplicar só fundo e cor produzia tela híbrida: a arte de uma configuração com
    a saudação e o logotipo de outra. Os campos entram juntos.
  */
    it("aplica os quatro campos, sem deixar tela híbrida", () => {
      guardarMarca(MARCA_DA_INSTITUICAO);
      expect(aplicarMarcaGuardadaNoArranque(document)).toBe(true);

      const naTela = identidadeNaTela();
      expect(naTela.backgroundImage).toContain(
        MARCA_DA_INSTITUICAO.backgroundUrl,
      );
      expect(naTela.panelColor).toBe(MARCA_DA_INSTITUICAO.panelColor);
      expect(naTela.logo).toBe(MARCA_DA_INSTITUICAO.logoUrl);
      expect(naTela.greeting).toBe(MARCA_DA_INSTITUICAO.greeting);
    });

    /*
    Sem marca guardada, estado neutro: nada é pintado. A regra é não exibir uma
    identidade antiga como se fosse a configuração da instituição.
  */
    it("sem marca guardada não pinta nada", () => {
      expect(aplicarMarcaGuardadaNoArranque(document)).toBe(false);
      const naTela = identidadeNaTela();
      expect(naTela.backgroundImage).toBe("");
      expect(naTela.panelColor).toBe("");
      expect(naTela.greeting).toBe("");
    });

    /*
    O ciclo completo que a pessoa vê: primeiro carregamento, depois do logout e
    depois de recarregar precisam ser idênticos nos quatro valores.
  */
    it("login inicial = login após logout = login após reload", () => {
      guardarMarca(MARCA_DA_INSTITUICAO);

      aplicarMarcaGuardadaNoArranque(document);
      const inicial = identidadeNaTela();

      // Logout não toca no cache — nada aqui o altera.
      montarTelaDeAcesso();
      aplicarMarcaGuardadaNoArranque(document);
      const aposLogout = identidadeNaTela();

      montarTelaDeAcesso();
      aplicarMarcaGuardadaNoArranque(document);
      const aposReload = identidadeNaTela();

      expect(aposLogout).toEqual(inicial);
      expect(aposReload).toEqual(inicial);
    });
  });

  describe("falha ao carregar a configuração", () => {
    /*
    O defeito que chegou a produção: o caminho de erro de `loadConfig()` chamava
    `applyConfigToUi()` com a configuração vazia, os normalizadores devolviam os
    valores padrão, e `guardarMarca()` gravava-os como se fossem a identidade da
    instituição — contaminando a inicialização seguinte.
  */
    it("a última marca válida sobrevive a uma falha de carregamento", () => {
      guardarMarca(MARCA_DA_INSTITUICAO);

      // Uma falha não escreve no cache: nenhuma chamada a guardarMarca acontece.
      expect(lerMarcaGuardada()).toEqual(MARCA_DA_INSTITUICAO);

      montarTelaDeAcesso();
      aplicarMarcaGuardadaNoArranque(document);
      const naTela = identidadeNaTela();
      expect(naTela.backgroundImage).toContain(
        MARCA_DA_INSTITUICAO.backgroundUrl,
      );
      expect(naTela.panelColor).toBe(MARCA_DA_INSTITUICAO.panelColor);
    });
  });

  describe("tela de acesso sem repetição", () => {
    const tela = readFileSync("src/app/entrada/entrada.tsx", "utf8");
    const html = readFileSync("index.html", "utf8");

    /*
    Como no SIGAV: uma linha de apoio fixa acima do botão ("Acesse com sua
    conta institucional.", `ACCESS_INSTRUCTION`) e o rodapé institucional com o
    escudo. Sem campo de configuração para a linha de apoio e sem os antigos
    blocos de descrição e de aviso de segurança.
  */
    it("linha de apoio constante, sem campo para ela nem os blocos antigos", () => {
      expect(tela).toContain('id="loginGreeting"');
      expect(tela).toContain('id="googleLoginText"');
      expect(tela).toContain("{ACCESS_INSTRUCTION}");
      expect(html).toContain("Acesse com sua conta institucional.");
      for (const fonte of [tela, html]) {
        expect(fonte).not.toContain("loginDescription");
        expect(fonte).not.toContain("loginSecurity");
        expect(fonte).not.toContain("cfgAccessInstruction");
      }
    });
  });

  /*
  A configuração completa (TB_CONFIGURACAO) chega pelo legado a cada
  `loadConfig` e passa por `definirMarcaDaConfiguracao`.
*/
  describe("a marca vinda da configuração", () => {
    const COMPLETA = {
      auth_access_background_url: "https://exemplo.org/agosto-lilas.jpg",
      auth_access_panel_color: "#ffffff",
      auth_access_logo_url: "https://exemplo.org/logo-institucional.png",
      auth_access_greeting: "Bem-vindo ao Agosto Lilás",
    };

    it("a identidade só é gravada quando veio do banco", () => {
      // O caminho de erro do loadConfig: configuração vazia, nada carregou.
      definirMarcaDaConfiguracao({ valores: {}, carregou: false });
      expect(lerMarcaGuardada()).toBeNull();
      expect(identidadeNaTela().greeting).toBe("");

      // Carregou, mas sem as chaves da marca (anônimo): também não grava.
      definirMarcaDaConfiguracao({
        valores: { app_title: "MONITORA" },
        carregou: true,
        chaves: new Set(["app_title"]),
      });
      expect(lerMarcaGuardada()).toBeNull();
    });

    it("com as chaves do banco, aplica e grava os quatro campos juntos", () => {
      definirMarcaDaConfiguracao({
        valores: COMPLETA,
        carregou: true,
        chaves: new Set(Object.keys(COMPLETA)),
      });
      expect(identidadeNaTela()).toEqual({
        backgroundImage: `url("${MARCA_DA_INSTITUICAO.backgroundUrl}")`,
        panelColor: MARCA_DA_INSTITUICAO.panelColor,
        logo: MARCA_DA_INSTITUICAO.logoUrl,
        greeting: MARCA_DA_INSTITUICAO.greeting,
      });
      expect(lerMarcaGuardada()).toEqual({
        ...MARCA_DA_INSTITUICAO,
        textoModo: "auto",
      });
    });

    it("o rodapé institucional sai da configuração (departamento ou rodapé)", () => {
      definirMarcaDaConfiguracao({
        valores: { cogip_nome: "COGIP", footer_text: "AgSUS" },
        carregou: true,
        chaves: new Set(["cogip_nome", "footer_text"]),
      });
      expect(marcaDaEntrada.obter().rodape).toMatchObject({
        nome: "COGIP",
        departamento: "AgSUS",
      });
    });

    it("não existe chamada incondicional a guardarMarca", () => {
      // Os comentários do módulo citam a função ao explicar o defeito corrigido.
      const codigo = readFileSync("src/app/entrada/marca.ts", "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      expect(codigo).toMatch(
        /if \(Object\.keys\(marcaParaGuardar\)\.length\) guardarMarca/,
      );
      /*
      As outras: a do branding público, que guarda a resposta mesclada, e a da
      medida da arte (13/11/2026), que guarda só proporção, cor e endereço
      medido, nunca um campo da identidade.
    */
      expect([...codigo.matchAll(/guardarMarca\(/g)].length).toBe(3);
      expect(codigo).toMatch(
        /guardar = \(medida: MedidaDaArte\) => void guardarMarca\(medida\)/,
      );
    });

    it("o logout não apaga nem troca a identidade", () => {
      for (const arquivo of [
        "src/app/sistema.ts",
        "src/app/perfil.ts",
        "src/app/sessao.ts",
        "src/app/entrada/marca.ts",
      ])
        expect(readFileSync(arquivo, "utf8")).not.toContain(
          "limparMarcaGuardada",
        );
    });
  });
});

bloco("interface-acesso-e-paineis", () => {
  const app = fonteDoApp();
  const shellCss = readFileSync("src/styles/platform-shell.css", "utf8");

  const semComentarios = (fonte) =>
    fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  const arquivoDe = (bytes, type = "image/png") => ({ size: bytes, type });

  describe("imagens da tela de acesso até 6 MB", () => {
    const SEIS_MB = 6 * 1024 * 1024;

    it("o limite é seis megabytes", () => {
      expect(ACCESS_BACKGROUND_MAX_BYTES).toBe(SEIS_MB);
    });

    it("aceita 5,9 MB", () => {
      expect(validateAccessBackgroundFile(arquivoDe(5.9 * 1024 * 1024))).toBe(
        "",
      );
    });

    it("aceita exatamente 6 MB", () => {
      expect(validateAccessBackgroundFile(arquivoDe(SEIS_MB))).toBe("");
    });

    it("rejeita 6 MB mais um byte", () => {
      expect(validateAccessBackgroundFile(arquivoDe(SEIS_MB + 1))).toContain(
        "6 MB",
      );
    });

    it("continua aceitando JPG, PNG e WEBP", () => {
      for (const tipo of ["image/jpeg", "image/png", "image/webp"]) {
        expect(validateAccessBackgroundFile(arquivoDe(1024, tipo))).toBe("");
      }
    });

    it("continua rejeitando outros tipos", () => {
      for (const tipo of [
        "image/gif",
        "image/svg+xml",
        "application/pdf",
        "text/html",
      ]) {
        expect(validateAccessBackgroundFile(arquivoDe(1024, tipo))).toContain(
          "JPG",
        );
      }
    });
  });

  /*
  Apagar a arte ativa deixaria `auth_access_background_url` a apontar para um
  objeto inexistente, e o cache guardado no navegador de cada pessoa
  continuaria a pedir essa imagem. A galeria (Configurações › Aparência, em
  React) não oferece Apagar para a arte em uso, e o estado das imagens recusa
  por garantia, caso a interface e o estado divirjam por um instante.
*/
  describe("exclusão de artes guardadas", () => {
    function montar({ confirmar = () => true } = {}) {
      const armazenamento = {
        list: vi.fn(async () => ({ data: [], error: null })),
        remove: vi.fn(async () => ({ error: null })),
        getPublicUrl: (c) => ({ data: { publicUrl: `https://cdn.test/${c}` } }),
      };
      const avisar = vi.fn();
      const imagens = criarImagensDaAparencia({
        supabase: () => ({ storage: { from: () => armazenamento } }),
        configuracoes: {
          obter: () => ({
            valores: new Map([
              ["auth_access_background_path", "branding/acesso-ativa.png"],
            ]),
          }),
        },
        documento: document,
        avisar,
        confirmar,
      });
      return { imagens, armazenamento, avisar };
    }

    it("a exclusão recusa a arte ativa mesmo se a interface divergir", async () => {
      const { imagens, armazenamento, avisar } = montar();
      expect(
        await imagens.apagarFundo({
          caminho: "branding/acesso-ativa.png",
          nome: "acesso-ativa.png",
        }),
      ).toBe(false);
      expect(armazenamento.remove).not.toHaveBeenCalled();
      expect(avisar).toHaveBeenCalledWith(
        expect.stringContaining("Esta arte está em uso"),
        "warn",
      );
    });

    it("pede confirmação antes de apagar e recarrega a galeria", async () => {
      let resposta = false;
      const { imagens, armazenamento } = montar({ confirmar: () => resposta });
      const outra = { caminho: "branding/acesso-velha.png", nome: "velha" };
      expect(await imagens.apagarFundo(outra)).toBe(false);
      expect(armazenamento.remove).not.toHaveBeenCalled();
      resposta = true;
      expect(await imagens.apagarFundo(outra)).toBe(true);
      expect(armazenamento.remove).toHaveBeenCalledWith([outra.caminho]);
      expect(armazenamento.list).toHaveBeenCalled();
    });
  });

  describe("painel externo com um cabeçalho só", () => {
    it("entra em external-panel-mode ao abrir o painel", () => {
      const paineis = readFileSync("src/app/paineis-externos.ts", "utf8");
      const fn = paineis.slice(paineis.indexOf("function mostrar(codigo"));
      expect(fn).toContain('classList.add("external-panel-mode")');
    });

    /*
    O antigo `external-clean` escondia também a navegação lateral. O estado novo
    esconde apenas o cabeçalho superior — a sidebar fica, é por ela que se volta.
  */
    it("o estado novo esconde o cabeçalho e preserva a sidebar", () => {
      expect(shellCss).toContain("body.external-panel-mode .main > header.top");
      expect(shellCss).not.toMatch(
        /body\.external-panel-mode[^{]*(aside|\.side)[^{]*\{[^}]*display:\s*none/,
      );
    });

    it("devolve ao conteúdo a altura do cabeçalho removido", () => {
      const bloco = shellCss.slice(
        shellCss.indexOf("body.external-panel-mode .content"),
      );
      expect(bloco).toContain("padding-top: 0");
    });

    it("o modo é removido ao sair do painel", () => {
      const navegacao = readFileSync("src/app/navegacao.ts", "utf8");
      const remocoes = (
        (app + navegacao).match(
          /classList\.remove\("external-panel-mode"\)/g,
        ) || []
      ).length;
      expect(remocoes).toBeGreaterThanOrEqual(2);
    });
  });

  describe("uma única confirmação de saída", () => {
    /*
    `health-details-ux` embrulhava `window.logout` com um modal próprio, e
    `nielsen-shell-ux` — carregado depois — capturava a versão já embrulhada e
    somava o seu. Quem clicava em Sair via dois diálogos seguidos.
  */
    it("nenhum módulo redefine window.logout", () => {
      const codigo = semComentarios(app);
      expect(codigo).not.toMatch(/windowRef\.logout\s*=/);
      expect(codigo).not.toMatch(/window\.logout\s*=\s*(?!null)/);
    });
  });

  describe("botão de acesso no retorno do navegador", () => {
    /*
    Abaixo de 768 px o login é redirecionamento de página inteira. Ao voltar do
    Google pelo botão Voltar, o navegador restaura a página do bfcache com o
    botão ainda ocupado ("Entrando no sistema…"). Quem cuida é a sessão do app.
  */
    const sessao = semComentarios(readFileSync("src/app/sessao.ts", "utf8"));

    it("existe um listener de pageshow", () => {
      expect(sessao).toContain('addEventListener("pageshow"');
    });

    it("trata tanto bfcache como navegação de histórico", () => {
      const fn = sessao.slice(sessao.indexOf("function aoMostrarPagina"));
      expect(fn).toContain("evento.persisted");
      expect(fn).toContain("back_forward");
    });

    it("só restaura o botão quando não há sessão ativa", () => {
      const fn = sessao.slice(
        sessao.indexOf("function aoMostrarPagina"),
        sessao.indexOf("function instalarOuvintesDaJanela"),
      );
      expect(fn).toContain("estadoDaSessao");
      expect(fn).toContain("SESSAO_ATIVA");
      expect(fn).toContain("liberarBotao()");
    });

    /*
    Registado uma única vez: se fosse registado a cada tentativa de login, os
    listeners acumulariam.
  */
    it("é registado uma única vez", () => {
      expect((sessao.match(/addEventListener\("pageshow"/g) || []).length).toBe(
        1,
      );
      const fn = sessao.slice(
        sessao.indexOf("function instalarOuvintesDaJanela"),
      );
      expect(fn).toContain("if (ouvintesDaJanela");
    });
  });
});

bloco("layout-no-celular", () => {
  /*
  Auditoria das telas (13/10/2026), no celular (375px):
  - os cartões das tabelas (tabelas-em-cartoes) guardavam a largura mínima da
    tela — 560px na Classificação, 760px na Fila, 980px nas demais tabelas da
    rolagem — e passavam da borda; o reset valia só para Editais e Aprovados;
  - o "Gerada em … · SHA-256 …" da Classificação (.status-discreto, nowrap)
    alargava o cartão de exportação e a página rolava 287px de lado.
*/

  const semComentarios = (fonte) => fonte.replace(/\/\*[\s\S]*?\*\//g, "");

  function arquivosCss(pasta, saida = []) {
    for (const nome of readdirSync(pasta)) {
      const caminho = join(pasta, nome);
      if (statSync(caminho).isDirectory()) arquivosCss(caminho, saida);
      else if (nome.endsWith(".css")) saida.push(caminho);
    }
    return saida;
  }

  /* Especificidade simples: [ids, classes + atributos + pseudo-classes, tipos]. */
  function especificidade(seletor) {
    const s = seletor.replace(/::[\w-]+/g, "");
    const ids = (s.match(/#[\w-]+/g) || []).length;
    const classes = (s.match(/\.[\w-]+|\[[^\]]+\]|:(?!not\b)[\w-]+/g) || [])
      .length;
    const tipos = (
      s.replace(/\[[^\]]+\]/g, "").match(/(^|[\s>+~])[a-z]+/g) || []
    ).length;
    return ids * 10000 + classes * 100 + tipos;
  }

  /* Os seletores de regras que dão min-width a uma tabela da rolagem. */
  function regrasDeLargura() {
    const regras = [];
    for (const arquivo of arquivosCss("src")) {
      const fonte = semComentarios(readFileSync(arquivo, "utf8"));
      for (const m of fonte.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        if (!/min-width:\s*[1-9]/.test(m[2])) continue;
        for (const seletor of m[1].split(",").map((x) => x.trim()))
          if (/\.ui-tabela-rolagem table/.test(seletor))
            regras.push({ arquivo, seletor });
      }
    }
    return regras;
  }

  describe("tabelas no celular", () => {
    const css = semComentarios(
      readFileSync("src/styles/mobile-table-cards.css", "utf8"),
    );
    const RESET =
      ".ui-tabela-rolagem table.mobile-card-table[data-mobile-enhanced]";

    it("o cartão perde a largura mínima em toda tela, não só em Editais e Aprovados", () => {
      expect(css).toMatch(
        /\.ui-tabela-rolagem table\.mobile-card-table\[data-mobile-enhanced\]\s*\{\s*min-width:\s*0;/,
      );
      expect(css).not.toContain(
        ".nucleo-page-card .ui-tabela-rolagem table.mobile-card-table",
      );
    });

    it("o reset vence toda largura mínima das tabelas da rolagem", () => {
      const regras = regrasDeLargura();
      expect(regras.length).toBeGreaterThan(3);
      for (const { arquivo, seletor } of regras)
        expect(especificidade(RESET), `${arquivo}: ${seletor}`).toBeGreaterThan(
          especificidade(seletor),
        );
    });

    it("a tabela em cartão ganha a classe e o data-mobile-enhanced juntos", () => {
      document.body.innerHTML =
        "<table><thead><tr><th>Nome</th></tr></thead><tbody><tr><td>Ana</td></tr></tbody></table>";
      const tabela = document.querySelector("table");
      expect(tabelaEmCartoes(tabela)).toBe(true);
      expect(tabela.classList.contains("mobile-card-table")).toBe(true);
      expect(tabela.dataset.mobileEnhanced).toBe("true");
    });

    it("o texto discreto quebra linha fora do topo", () => {
      const ui = semComentarios(readFileSync("src/ui/ui.css", "utf8"));
      const geral = ui.match(/\n\.status-discreto\s*\{([^}]*)\}/)?.[1] || "";
      expect(geral).not.toContain("nowrap");
      expect(ui).toMatch(
        /\.ui-topo-acoes \.status-discreto\s*\{[^}]*white-space:\s*nowrap/,
      );
    });
  });

  describe("abas no celular", () => {
    const ui = semComentarios(readFileSync("src/ui/ui.css", "utf8"));
    const celular = ui.slice(ui.indexOf("@media (max-width: 640px)"));

    it("as abas não encolhem abaixo do texto: descem de linha", () => {
      expect(celular).toMatch(/\.ui-abas\s*\{[^}]*flex-wrap:\s*wrap/);
      expect(celular).toMatch(/\.ui-aba\s*\{[^}]*flex:\s*1 0 auto/);
      expect(celular).not.toMatch(/\.ui-aba\s*\{[^}]*min-width:\s*0/);
    });
  });

  describe("quais tabelas viram cartão", () => {
    const TABELA =
      "<thead><tr><th>Nome</th><th>UF</th></tr></thead><tbody><tr><td>Ana</td><td>AM</td></tr></tbody>";
    const larguraOriginal = window.innerWidth;
    const largura = (px) =>
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: px,
      });

    it("só no celular, com rótulo por coluna, sem as que rolam de lado ou são grade", () => {
      document.body.innerHTML = `
      <table id="comum">${TABELA}</table>
      <table id="rola" data-mobile-table="scroll">${TABELA}</table>
      <table id="grade" role="grid">${TABELA}</table>`;
      try {
        largura(1280);
        expect(tabelasDaTelaEmCartoes()).toBe(0);
        largura(390);
        expect(tabelasDaTelaEmCartoes()).toBe(1);
      } finally {
        largura(larguraOriginal);
      }
      expect(
        [...document.querySelectorAll("#comum td")].map(
          (td) => td.dataset.mobileLabel,
        ),
      ).toEqual(["Nome", "UF"]);
      expect(document.getElementById("rola").dataset.mobileEnhanced).toBe(
        undefined,
      );
      expect(document.getElementById("grade").dataset.mobileEnhanced).toBe(
        undefined,
      );
    });
  });

  describe("rótulo do cartão sem texto no cabeçalho", () => {
    it("usa o nome acessível do controle, não 'Campo 1'", () => {
      document.body.innerHTML =
        '<table><thead><tr><th><input type="checkbox" aria-label="Selecionar as fichas da lista"></th><th>Nome</th><th></th></tr></thead><tbody><tr><td></td><td>Ana</td><td></td></tr></tbody></table>';
      expect(cabecalhosDaTabela(document.querySelector("table"))).toEqual([
        "Selecionar as fichas da lista",
        "Nome",
        "Campo 3",
      ]);
    });
  });

  /*
  A arara da Aya (canto inferior direito) cobria o botão principal das barras
  presas ao pé: "Concluir e próxima" (ficha), "Salvar e próximo"
  (entrevistas) e "Salvar alterações" (Configurações).
*/
  describe("barras de ação e a arara da Aya", () => {
    const css = (caminho) => semComentarios(readFileSync(caminho, "utf8"));

    it("o canto da arara é um token só", () => {
      expect(css("src/styles/app.css")).toMatch(/--aya-reserva:\s*\d+px/);
    });

    it.each([
      [
        "src/modulos/avaliacao-documental/ficha/ficha.css",
        /\.avd-ficha-barra\s*\{[^}]*padding-right:[^;]*var\(--aya-reserva/,
      ],
      [
        "src/modulos/entrevistas/entrevistas.css",
        /\.entrevistas-analise-barra\s*\{[^}]*padding-right:[^;]*var\(--aya-reserva/,
      ],
      [
        "src/modulos/configuracoes/configuracoes.css",
        /\.config-barra\s*\{[^}]*right:[^;]*var\(--aya-reserva/,
      ],
    ])("%s recua da arara", (arquivo, regra) => {
      expect(css(arquivo)).toMatch(regra);
    });
  });
});

bloco("marca-da-barra-pela-configuracao", () => {
  /*
  A logo e a cor da barra lateral vêm da leitura da configuração que o app já
  faz (src/app/configuracao.ts), não de uma consulta própria a cada SIGNED_IN.
*/

  beforeEach(() => {
    document.body.innerHTML = '<img id="sideLogo" src="" alt="" />';
    document.documentElement.style.removeProperty("--sidebar-custom-bg");
  });

  describe("aplicarMarcaDaConfiguracao", () => {
    it("pinta com a cor e a logo da configuração", () => {
      expect(
        aplicarMarcaDaConfiguracao({ ui_sidebar_background_color: "#0b3d2e" }),
      ).toBe(true);
      expect(
        document.documentElement.style.getPropertyValue("--sidebar-custom-bg"),
      ).toBe("#0b3d2e");
      expect(document.body.classList.contains("sidebar-theme-dark")).toBe(true);
    });

    it("leitura sem as chaves (tela de acesso, sem sessão) não mexe no que está pintado", () => {
      expect(aplicarMarcaDaConfiguracao({ footer_text: "x" })).toBe(false);
      expect(aplicarMarcaDaConfiguracao(null)).toBe(false);
      expect(
        document.documentElement.style.getPropertyValue("--sidebar-custom-bg"),
      ).toBe("");
    });
  });
});

bloco("modulos/acessos-tempo-limite", () => {
  /*
  Uma chamada que nunca volta (rede caída no meio do caminho) não pode deixar
  a ação "Salvando…" presa: passado o tempo limite, o estado solta a ação e
  mostra a mensagem de rede.
*/
  afterEach(() => vi.useRealTimers());

  describe("Acessos: tempo limite das chamadas", () => {
    it("salvar que não responde termina em erro de rede e libera a ação", async () => {
      vi.useFakeTimers();
      const supabase = {
        rpc: vi.fn(() => new Promise(() => {})),
        auth: {
          getSession: async () => ({
            data: { session: { access_token: "x" } },
            error: null,
          }),
          onAuthStateChange: () => ({
            data: { subscription: { unsubscribe: () => {} } },
          }),
        },
      };
      const estado = criarEstadoDosAcessos({ supabase, toast: vi.fn() });
      estado.registrar(
        {
          id: "u1",
          nome: "Ana",
          email: "ana@x",
          permissoes: {
            nucleo: {
              nivel: "leitor",
              origem: "grupo",
              nivel_grupo: "leitor",
              revisao: 0,
            },
          },
        },
        "nucleo",
        "editor",
      );
      const salvando = estado.salvar("Mudança de função");
      await vi.advanceTimersByTimeAsync(0);
      expect(estado.obter().acao?.tipo).toBe("salvar");
      await vi.advanceTimersByTimeAsync(30000);
      await expect(salvando).resolves.toBe(false);
      expect(estado.obter().acao).toBeNull();
      expect(estado.obter().aviso.texto).toContain(SEM_SERVIDOR);
      expect(estado.obter().rascunho.size).toBe(1);
      estado.desligar();
    });
  });
});

bloco("modulos/acessos", () => {
  /*
  Configurações › Acessos em React: grupo (tag) + um select por módulo em
  Usuários, gaveta da pessoa, grupos em lista + detalhe, pedidos pendentes,
  teto do coordenador e guarda de saída. O banco confere tudo de novo; aqui é
  a tela não oferecer o que vai ser recusado.
*/

  const celula = (
    nivel,
    origem = "grupo",
    nivel_grupo = nivel,
    revisao = 0,
  ) => ({
    nivel,
    origem,
    nivel_grupo,
    revisao,
  });

  const GRUPOS = [
    {
      codigo: "usuario",
      nome: "Usuário",
      revisao: 1,
      sistema: true,
      usuarios: 1,
      niveis: {
        dashboard: "leitor",
        nucleo: "leitor",
        aprovados: "leitor",
        configuracoes: "sem_acesso",
        acessos: "sem_acesso",
      },
    },
    {
      codigo: "coordenador",
      nome: "Coordenador",
      revisao: 1,
      usuarios: 1,
      niveis: { nucleo: "editor", acessos: "editor" },
    },
    {
      codigo: "admin",
      nome: "Administrador global",
      admin_global: true,
      sistema: true,
      revisao: 1,
      niveis: {},
      usuarios: 0,
    },
  ];

  const MATRIZ = (teto) => ({
    usuarios: [
      {
        id: "u1",
        nome: "Ana <img src=x>",
        email: "ana@agenciasus.org.br",
        grupo: "usuario",
        coordenacao: "norte",
        revisao_conta: "t0",
        admin_global: false,
        ativo: true,
        ultimo_acesso: "2026-09-29T15:00:00Z",
        convite_pendente: false,
        areas_efetivas: ["saude-indigena"],
        permissoes: {
          "area:saude-indigena": celula("leitor", "excecao", "sem_acesso"),
          dashboard: celula("leitor"),
          nucleo: celula("leitor"),
          aprovados: celula("editor", "excecao", "leitor", 2),
          acessos: celula("sem_acesso"),
        },
      },
      {
        id: "eu",
        nome: "Coord",
        email: "coord@agenciasus.org.br",
        grupo: "coordenador",
        coordenacao: "norte",
        revisao_conta: "t1",
        admin_global: false,
        ativo: true,
        cadastrado_em: "2026-09-28T15:00:00Z",
        ultimo_acesso: null,
        convite_pendente: true,
        areas_efetivas: ["saude-indigena"],
        permissoes: { nucleo: celula("editor") },
      },
    ],
    total: 2,
    areas: [{ id: "saude-indigena", titulo: "Saúde Indígena" }],
    paineis: [],
    grupos: GRUPOS,
    coordenacoes: [
      {
        codigo: "norte",
        nome: "Norte",
        area: "saude-indigena",
        ativo: true,
        unidades: [],
        editais: [],
        usuarios: 2,
        revisao: 1,
      },
    ],
    teto,
    historico: [],
  });

  const TETO_ADMIN = {
    admin_global: true,
    usuario_id: "adm",
    coordenacao: null,
    niveis: {},
    paineis: [],
  };
  const TETO_COORD = {
    admin_global: false,
    usuario_id: "eu",
    coordenacao: "norte",
    niveis: {
      dashboard: "leitor",
      nucleo: "editor",
      aprovados: "editor",
      configuracoes: "sem_acesso",
      acessos: "sem_acesso",
    },
    paineis: [],
  };
  const PEDIDO = {
    id: "s1",
    nome: "Bia",
    email: "bia@agenciasus.org.br",
    coordenacao: "norte",
    coordenacao_nome: "Norte",
    created_at: "2026-09-29T10:00:00Z",
  };

  function supabaseFalso(teto, extra = {}) {
    const rpc = vi.fn((nome, args) => {
      if (extra[nome]) return Promise.resolve(extra[nome](args));
      if (nome === "obter_matriz_acessos")
        return Promise.resolve({ data: MATRIZ(teto), error: null });
      if (nome === "listar_solicitacoes_acesso")
        return Promise.resolve({ data: [PEDIDO], error: null });
      if (nome === "salvar_matriz_acessos")
        return Promise.resolve({ data: { alteradas: 1 }, error: null });
      if (nome === "salvar_grupo_acesso")
        return Promise.resolve({ data: { codigo: "usuario" }, error: null });
      if (nome === "obter_contexto_de_usuario")
        return Promise.resolve({
          data: {
            profile: {
              id: "u1",
              perfil: "usuario",
              areas: ["saude-indigena"],
              permissoes: { nucleo: "leitor" },
            },
            panel_ids: [],
            escopo: {},
          },
          error: null,
        });
      return Promise.resolve({ data: { ok: true }, error: null });
    });
    return {
      rpc,
      auth: {
        getSession: async () => ({
          data: { session: { access_token: "x" } },
          error: null,
        }),
        onAuthStateChange: () => ({
          data: { subscription: { unsubscribe: () => {} } },
        }),
      },
    };
  }

  let controlador = null;
  async function montar({ perfil, teto, confirmar = () => true, extra = {} }) {
    document.body.innerHTML = '<div id="acessosApp" data-acessos></div>';
    const supabase = supabaseFalso(teto, extra);
    await act(async () => {
      controlador = montarTela(criarAcessos, "", {
        secao: document.getElementById("acessosApp"),
        supabase,
        toast: vi.fn(),
        getProfile: () => perfil,
        confirmar,
      });
    });
    await esperar(() => controlador.render());
    return supabase;
  }

  afterEach(async () => {
    controlador?.estado.desligar();
    await act(async () => controlador?.raiz?.unmount());
    controlador = null;
    document.body.innerHTML = "";
  });

  const ADMIN = { admin_global: true, permissoes: {} };
  const COORD = {
    admin_global: false,
    coordenacao: { codigo: "norte" },
    permissoes: { acessos: "editor" },
  };
  const abas = () =>
    [...document.querySelectorAll('[role="tab"]')].map((b) =>
      b.firstChild.textContent.trim(),
    );
  const select = (rotulo) =>
    document.querySelector(`select[aria-label="${rotulo}"]`);
  /** Liga "Ver permissões por módulo (avançado)": a matriz com um select por módulo. */
  const verPorModulo = () =>
    clicar(
      [...document.querySelectorAll("label.acessos-alternar input")].find(
        (el) => el.type === "checkbox",
      ),
    );
  const botao = (texto) =>
    [...document.querySelectorAll("button")].find(
      (b) => b.textContent.trim() === texto,
    );

  describe("Configurações › Acessos", () => {
    it("admin vê Usuários, Grupos e Coordenações; coordenador, só Usuários", async () => {
      await montar({ perfil: ADMIN, teto: TETO_ADMIN });
      expect(abas()).toEqual(["Usuários", "Grupos", "Coordenações"]);
      await act(async () => controlador.raiz.unmount());
      await montar({ perfil: COORD, teto: TETO_COORD });
      expect(abas()).toEqual(["Usuários"]);
    });

    it("grupo é tag; módulo individual volta a 'Do grupo' e salva com motivo", async () => {
      const supabase = await montar({ perfil: ADMIN, teto: TETO_ADMIN });
      expect(document.body.textContent).toContain("Ana <img src=x>");
      expect(document.querySelector("img")).toBeNull();
      await verPorModulo();
      expect(select("Grupo de Ana <img src=x>").value).toBe("usuario");
      const aprovados = select("Lista de aprovados de Ana <img src=x>");
      expect(aprovados.value).toBe("editor");
      expect(
        aprovados.querySelector('optgroup[label="Do grupo"] option')
          .textContent,
      ).toBe("Leitor");
      expect(
        aprovados.querySelector('optgroup[label="Individual"]').children,
      ).toHaveLength(4);
      expect(document.querySelector(".acessos-salvar")).toBeNull();
      await escolher(aprovados, "");
      expect(
        document.querySelector(".acessos-salvar summary").textContent,
      ).toContain("1 alteração em 1 pessoa");
      await digitar(document.getElementById("acessosMotivo"), "Fim da exceção");
      await clicar(botao("Salvar alterações"));
      const chamada = supabase.rpc.mock.calls.find(
        ([nome]) => nome === "salvar_matriz_acessos",
      );
      expect(chamada[1]).toEqual({
        p_alteracoes: [
          {
            tipo: "nivel",
            usuario_id: "u1",
            recurso: "aprovados",
            nivel: null,
            revisao: 2,
          },
        ],
        p_motivo: "Fim da exceção",
      });
    });

    it("coordenador: a própria linha trava, nível acima do teto e grupo com Acessos ficam fora", async () => {
      await montar({ perfil: COORD, teto: TETO_COORD });
      await verPorModulo();
      expect(select("Editais de Coord").disabled).toBe(true);
      const dashboard = select("Visão geral de Ana <img src=x>");
      expect(
        [...dashboard.options].find((o) => o.value === "editor").disabled,
      ).toBe(true);
      expect(
        select("Gestão de acessos de Ana <img src=x>").querySelector(
          'option[value="editor"]',
        ).disabled,
      ).toBe(true);
      expect(select("Coordenação de Ana <img src=x>")).toBeNull();
      const grupo = select("Grupo de Ana <img src=x>");
      expect(
        [...grupo.options].find((o) => o.value === "coordenador").disabled,
      ).toBe(true);
    });

    it("o nome abre a gaveta com áreas e como a pessoa vê", async () => {
      await montar({ perfil: ADMIN, teto: TETO_ADMIN });
      await clicar(document.querySelector(".acessos-nome"));
      const gaveta = document.getElementById("acessosGaveta");
      expect(gaveta.textContent).toContain(
        "Vê só o recorte da coordenação Norte.",
      );
      expect(gaveta.textContent).toContain("Como a pessoa vê");
    });

    it("gaveta: depois de uma falha, a releitura que dá certo tira o erro", async () => {
      let falhar = true;
      const contexto = {
        profile: {
          id: "u1",
          perfil: "usuario",
          areas: ["saude-indigena"],
          permissoes: { nucleo: "leitor" },
        },
        panel_ids: [],
        escopo: {},
      };
      await montar({
        perfil: ADMIN,
        teto: TETO_ADMIN,
        extra: {
          obter_contexto_de_usuario: () =>
            falhar
              ? { data: null, error: { message: "falhou" } }
              : { data: contexto, error: null },
        },
      });
      await clicar(document.querySelector(".acessos-nome"));
      const gaveta = document.getElementById("acessosGaveta");
      expect(gaveta.textContent).toContain(
        "Não foi possível ler o acesso salvo.",
      );
      // Nova carga da matriz (como depois de salvar) relê o contexto.
      falhar = false;
      await esperar(() => controlador.estado.carregarMatriz());
      expect(gaveta.textContent).not.toContain(
        "Não foi possível ler o acesso salvo.",
      );
    });

    it("entra no grupo, muda o nível do módulo e salva com motivo", async () => {
      const supabase = await montar({ perfil: ADMIN, teto: TETO_ADMIN });
      await clicar(document.getElementById("acessos-aba-grupos"));
      expect(document.getElementById("acessosGrupoNome").value).toBe("Usuário");
      const editais = document.querySelector(
        '[role="radiogroup"][aria-label="Editais: nível no grupo"]',
      );
      await clicar(
        [...editais.querySelectorAll("button")].find(
          (b) => b.textContent === "Editor",
        ),
      );
      await digitar(
        document.getElementById("acessosGrupoMotivo"),
        "Leitura vira edição",
      );
      await clicar(botao("Salvar grupo"));
      const chamada = supabase.rpc.mock.calls.find(
        ([nome]) => nome === "salvar_grupo_acesso",
      );
      expect(chamada[1].p_grupo).toMatchObject({
        codigo: "usuario",
        revisao: 1,
        niveis: expect.objectContaining({ nucleo: "editor" }),
      });
    });

    it("excluir grupo pede o motivo no rodapé, sem window.prompt", async () => {
      const prompt = vi.spyOn(window, "prompt").mockImplementation(() => null);
      const grupos = [
        ...GRUPOS,
        {
          codigo: "temp",
          nome: "Temporário",
          revisao: 1,
          usuarios: 0,
          niveis: {},
        },
      ];
      const supabase = await montar({
        perfil: ADMIN,
        teto: TETO_ADMIN,
        extra: {
          obter_matriz_acessos: () => ({
            data: { ...MATRIZ(TETO_ADMIN), grupos },
            error: null,
          }),
        },
      });
      await clicar(document.getElementById("acessos-aba-grupos"));
      await clicar(
        [...document.querySelectorAll(".acessos-mestre-item")].find((b) =>
          b.textContent.includes("Temporário"),
        ),
      );
      await clicar(botao("Excluir grupo"));
      expect(prompt).not.toHaveBeenCalled();
      const confirmar = () =>
        document
          .querySelector(
            '[role="group"][aria-label="Excluir o grupo Temporário"]',
          )
          .querySelector("button.perigo");
      expect(confirmar().disabled).toBe(true);
      await digitar(
        document.getElementById("acessosExcluirGrupoMotivo"),
        "Grupo sem uso",
      );
      await clicar(confirmar());
      const chamada = supabase.rpc.mock.calls.find(
        ([nome]) => nome === "remover_grupo_acesso",
      );
      expect(chamada).toBeTruthy();
      expect(JSON.stringify(chamada[1])).toContain("Grupo sem uso");
      prompt.mockRestore();
    });

    it("revisão nova do grupo não apaga a edição em andamento", async () => {
      let revisao = 1;
      await montar({
        perfil: ADMIN,
        teto: TETO_ADMIN,
        extra: {
          obter_matriz_acessos: () => ({
            data: {
              ...MATRIZ(TETO_ADMIN),
              grupos: GRUPOS.map((g) =>
                g.codigo === "usuario" ? { ...g, revisao } : g,
              ),
            },
            error: null,
          }),
        },
      });
      await clicar(document.getElementById("acessos-aba-grupos"));
      await digitar(document.getElementById("acessosGrupoNome"), "Usuários");
      revisao = 2;
      await esperar(() => controlador.estado.carregarMatriz());
      expect(document.getElementById("acessosGrupoNome").value).toBe(
        "Usuários",
      );
      expect(document.getElementById("acessosGrupoMotivo")).not.toBeNull();
    });

    it("pedidos pendentes aparecem em 'Pendentes' e aprovam com grupo e coordenação", async () => {
      const supabase = await montar({ perfil: ADMIN, teto: TETO_ADMIN });
      await clicar(botao("Pendentes (1)"));
      expect(document.body.textContent).toContain("bia@agenciasus.org.br");
      await clicar(botao("Aprovar"));
      const chamada = supabase.rpc.mock.calls.find(
        ([nome]) => nome === "aprovar_solicitacao_acesso",
      );
      expect(chamada[1]).toMatchObject({
        p_solicitacao_id: "s1",
        p_grupo: "usuario",
        p_coordenacao: "norte",
        p_areas: null,
      });
    });

    it("banco sem as migrations novas (PGRST202): diz a causa no lugar das abas", async () => {
      document.body.innerHTML = '<div id="acessosApp" data-acessos></div>';
      const supabase = supabaseFalso(TETO_ADMIN);
      supabase.rpc.mockImplementation((nome) =>
        Promise.resolve(
          nome === "obter_matriz_acessos"
            ? {
                data: null,
                error: {
                  code: "PGRST202",
                  message: "Could not find the function",
                },
              }
            : { data: [], error: null },
        ),
      );
      await act(async () => {
        controlador = montarTela(criarAcessos, "", {
          secao: document.getElementById("acessosApp"),
          supabase,
          toast: vi.fn(),
          getProfile: () => ADMIN,
        });
      });
      await esperar(() => controlador.render());
      const alerta = document.querySelector('[role="alert"]');
      expect(alerta.textContent).toContain(
        "o banco ainda não tem a atualização de acessos.",
      );
      expect(alerta.textContent).toContain("20260929121000 a 20260929121300");
      expect(document.querySelector('[role="tab"]')).toBeNull();
    });

    it("adiciona pessoa pelo e-mail, com grupo, coordenação e motivo", async () => {
      const supabase = await montar({ perfil: ADMIN, teto: TETO_ADMIN });
      await clicar(botao("Adicionar pessoa"));
      await digitar(
        document.getElementById("acessosAdicionarEmail"),
        "Nova.Pessoa@agenciasus.org.br",
      );
      await digitar(
        document.getElementById("acessosAdicionarNome"),
        "Nova Pessoa",
      );
      await escolher(
        document.getElementById("acessosAdicionarCoordenacao"),
        "norte",
      );
      await digitar(
        document.getElementById("acessosAdicionarMotivo"),
        "Entrou na equipe",
      );
      await clicar(
        [...document.querySelectorAll("#acessosAdicionar button")].find(
          (b) => b.textContent.trim() === "Adicionar pessoa",
        ),
      );
      const chamada = supabase.rpc.mock.calls.find(
        ([nome]) => nome === "adicionar_pessoa_acesso",
      );
      expect(chamada[1]).toEqual({
        p_email: "nova.pessoa@agenciasus.org.br",
        p_nome: "Nova Pessoa",
        p_grupo: "usuario",
        p_coordenacao: "norte",
        p_areas: null,
        p_motivo: "Entrou na equipe",
      });
      // Passo "Convite pronto": mensagem, copiar e abrir no e-mail.
      const modal = document.getElementById("acessosAdicionar");
      expect(modal.querySelector("h3").textContent).toBe("Convite pronto");
      // O foco vai para "Concluir" (o botão de enviar sumiu com o formulário).
      expect(document.activeElement?.textContent.trim()).toBe("Concluir");
      const mensagem = modal.querySelector(".acessos-convite-mensagem");
      expect(mensagem.textContent).toBe(
        `Olá, Nova Pessoa! Você foi convidado(a) para o Yeendé (AgSUS). Acesse ${window.location.origin} e entre com sua conta Google nova.pessoa@agenciasus.org.br.`,
      );
      const email = [...modal.querySelectorAll("a")].find(
        (a) => a.textContent.trim() === "Abrir no e-mail",
      );
      expect(email.getAttribute("href")).toMatch(
        /^mailto:nova\.pessoa@agenciasus\.org\.br\?subject=Convite%20para%20o%20Yeend%C3%A9&body=Ol%C3%A1%2C%20Nova%20Pessoa!/,
      );
      const writeText = vi.fn(async () => {});
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText },
        configurable: true,
      });
      await clicar(botao("Copiar mensagem"));
      expect(writeText).toHaveBeenCalledWith(mensagem.textContent);
      expect(modal.textContent).toContain("Mensagem copiada.");
      await clicar(botao("Concluir"));
      expect(document.getElementById("acessosAdicionar")).toBeNull();
    });

    /*
    30/09: um admin clicou em "Mover para Coordenações" (no rodapé, ao lado
    de "Desativar acesso") numa conta de PESSOA achando que era um ajuste; a
    conta foi desativada. Agora a ação mora só no "Avançado", diz o que vai
    acontecer e pede CONFIRMAR (ou o e-mail) e motivo.
  */
    it("conta de setor vira coordenação só pelo Avançado, com confirmação escrita", async () => {
      const supabase = await montar({ perfil: ADMIN, teto: TETO_ADMIN });
      await clicar(document.querySelector(".acessos-nome"));
      const gaveta = document.getElementById("acessosGaveta");
      const rotulo = "Transformar em coordenação";
      // Não fica no rodapé: lá, só "Desativar acesso".
      const rodape = gaveta.querySelector(".acessos-gaveta-rodape");
      expect(
        [...rodape.querySelectorAll("button")].map((b) => b.textContent.trim()),
      ).toEqual(["Desativar acesso"]);
      const abrir = botao(rotulo);
      expect(abrir.closest("details.acessos-avancado")).not.toBeNull();
      await clicar(abrir);
      const form = gaveta.querySelector(".acessos-mover");
      expect(form.querySelector('[role="alert"]').textContent).toContain(
        "Isto vai DESATIVAR a conta ana@agenciasus.org.br (ela não entra mais) e criar a coordenação Ana <img src=x> na área Saúde Indígena. Use só para contas compartilhadas de setor.",
      );
      const confirmar = [...form.querySelectorAll("button")].find(
        (b) =>
          b.textContent.trim() === "Desativar a conta e criar a coordenação",
      );
      await digitar(
        document.getElementById("acessosMoverMotivo"),
        "É a conta da COET",
      );
      expect(confirmar.disabled).toBe(true);
      await digitar(document.getElementById("acessosMoverConfirmacao"), "sim");
      expect(confirmar.disabled).toBe(true);
      await digitar(
        document.getElementById("acessosMoverConfirmacao"),
        "CONFIRMAR",
      );
      expect(confirmar.disabled).toBe(false);
      await clicar(confirmar);
      const chamada = supabase.rpc.mock.calls.find(
        ([nome]) => nome === "mover_conta_para_coordenacoes",
      );
      expect(chamada[1]).toEqual({
        p_perfil_usuario_id: "u1",
        p_area: "saude-indigena",
        p_motivo: "É a conta da COET",
      });
    });

    it("a própria conta não oferece transformar em coordenação (nem desativar)", async () => {
      const eu = {
        ...MATRIZ(TETO_ADMIN).usuarios[0],
        id: "adm",
        nome: "Eu Mesma",
        email: "eu@agenciasus.org.br",
      };
      const supabase = await montar({ perfil: ADMIN, teto: TETO_ADMIN });
      const original = supabase.rpc.getMockImplementation();
      supabase.rpc.mockImplementation((nome, args) =>
        nome === "obter_matriz_acessos"
          ? Promise.resolve({
              data: { ...MATRIZ(TETO_ADMIN), usuarios: [eu] },
              error: null,
            })
          : original(nome, args),
      );
      await esperar(() => controlador.estado.carregarMatriz());
      await clicar(document.querySelector(".acessos-nome"));
      const gaveta = document.getElementById("acessosGaveta");
      expect(gaveta.textContent).toContain(
        "Seu acesso: outra pessoa deve alterar.",
      );
      expect(gaveta.textContent).not.toContain("Transformar em coordenação");
      expect(gaveta.querySelector(".acessos-gaveta-rodape")).toBeNull();
    });

    /*
    30/09: o grupo mudava na linha da tabela, a gaveta dizia "salve na
    página" e "Como a pessoa vê" ainda mostrava o salvo. Agora a gaveta tem o
    grupo no topo, o próprio Salvar com motivo e mostra o resultado.
  */
    it("gaveta: grupo no topo, 'Como a pessoa vê' com o rascunho e Salvar com motivo só desta pessoa", async () => {
      const supabase = await montar({ perfil: ADMIN, teto: TETO_ADMIN });
      // Alteração em outra pessoa, feita na matriz: não pode ir junto.
      await verPorModulo();
      await escolher(select("Editais de Coord"), "leitor");
      await verPorModulo();
      await clicar(document.querySelector(".acessos-nome"));
      const gaveta = document.getElementById("acessosGaveta");
      expect(gaveta.querySelector(".acessos-gaveta-corpo h4").textContent).toBe(
        "Grupo",
      );
      expect(gaveta.querySelector(".acessos-selo-rascunho")).toBeNull();
      await escolher(
        gaveta.querySelector('select[aria-label="Grupo de Ana <img src=x>"]'),
        "admin",
      );
      const ve = gaveta.querySelector('[aria-labelledby="acessosGavetaVe"]');
      expect(ve.querySelector("h4").textContent).toContain("Depois de salvar");
      expect(ve.textContent).toContain(
        "Administrador global: vê todas as áreas.",
      );
      expect(gaveta.textContent).not.toContain("salve na página");
      const salvar = gaveta.querySelector(".acessos-salvar-gaveta");
      expect(salvar.querySelector("summary").textContent).toBe(
        "1 alteração pendente",
      );
      expect(salvar.textContent).toContain(
        "Grupo: Usuário → Administrador global",
      );
      await clicar(
        [...salvar.querySelectorAll("button")].find(
          (b) => b.textContent.trim() === "Salvar",
        ),
      );
      // Sem motivo não grava.
      expect(
        supabase.rpc.mock.calls.some(
          ([nome]) => nome === "salvar_matriz_acessos",
        ),
      ).toBe(false);
      await digitar(
        document.getElementById("acessosGavetaMotivo"),
        "Assumiu a gestão",
      );
      await clicar(
        [...salvar.querySelectorAll("button")].find(
          (b) => b.textContent.trim() === "Salvar",
        ),
      );
      const chamada = supabase.rpc.mock.calls.find(
        ([nome]) => nome === "salvar_matriz_acessos",
      );
      expect(chamada[1]).toEqual({
        p_alteracoes: [
          { tipo: "grupo", usuario_id: "u1", grupo: "admin", revisao: "t0" },
        ],
        p_motivo: "Assumiu a gestão",
      });
      // A alteração da outra pessoa segue pendente.
      const pendentes = [...controlador.estado.obter().rascunho.keys()];
      expect(pendentes).toEqual(["eu/nucleo"]);
    });

    it("guarda de saída: com alteração pendente pergunta, e descartar limpa", async () => {
      const confirmar = vi.fn(() => false);
      await montar({ perfil: ADMIN, teto: TETO_ADMIN, confirmar });
      await verPorModulo();
      await escolher(select("Editais de Ana <img src=x>"), "editor");
      expect(controlador.temAlteracoesPendentes()).toBe(true);
      expect(controlador.confirmarSaida()).toBe(false);
      confirmar.mockReturnValue(true);
      await act(async () => {
        expect(controlador.confirmarSaida()).toBe(true);
      });
      expect(controlador.temAlteracoesPendentes()).toBe(false);
    });
  });

  /*
  Pedidos de 29/09: o administrador global aparece com o nível real do grupo
  (em "Gestão de acessos" é Editor, não Administrador) e uma falha de rede no
  salvar vira mensagem clara, com o botão de volta — nunca "Salvando…" preso.
*/
  describe("Acessos: administrador global e falha de rede", () => {
    const ADMIN_GLOBAL = {
      id: "adm2",
      nome: "COET",
      email: "coet@agenciasus.org.br",
      grupo: "admin",
      coordenacao: null,
      revisao_conta: "t2",
      admin_global: true,
      permissoes: {
        nucleo: celula("admin"),
        acessos: celula("editor"),
      },
    };

    it("admin global: texto com o nível do grupo, sem select, e Editor em Gestão de acessos", async () => {
      const supabase = await montar({ perfil: ADMIN, teto: TETO_ADMIN });
      supabase.rpc.mockImplementation((nome) =>
        Promise.resolve({
          data:
            nome === "obter_matriz_acessos"
              ? {
                  ...MATRIZ(TETO_ADMIN),
                  usuarios: [ADMIN_GLOBAL],
                  grupos: GRUPOS.map((g) =>
                    g.codigo === "admin"
                      ? { ...g, niveis: { nucleo: "admin", acessos: "editor" } }
                      : g,
                  ),
                }
              : [],
          error: null,
        }),
      );
      await act(async () => controlador.estado.carregarMatriz());
      await verPorModulo();
      expect(select("Editais de COET")).toBeNull();
      const linha = [...document.querySelectorAll("tbody tr")].find((tr) =>
        tr.textContent.includes("COET"),
      );
      const textos = [...linha.querySelectorAll(".acessos-nivel-fixo")].map(
        (el) => el.textContent,
      );
      const colunas = [...document.querySelectorAll("thead th")].map((th) =>
        th.textContent.trim(),
      );
      const celulaDe = (rotulo) =>
        linha.children[colunas.indexOf(rotulo)].textContent.trim();
      expect(celulaDe("Editais")).toBe("Administrador");
      expect(celulaDe("Gestão de acessos")).toBe("Editor");
      expect(textos).not.toContain("Leitor");
    });

    it("'Failed to fetch' no salvar: mensagem clara, rascunho mantido e botão de volta", async () => {
      const supabase = await montar({ perfil: ADMIN, teto: TETO_ADMIN });
      const original = supabase.rpc.getMockImplementation();
      supabase.rpc.mockImplementation((nome, args) =>
        nome === "salvar_matriz_acessos"
          ? Promise.reject(new TypeError("Failed to fetch"))
          : original(nome, args),
      );
      await verPorModulo();
      await escolher(select("Editais de Ana <img src=x>"), "editor");
      await digitar(document.getElementById("acessosMotivo"), "Nova função");
      await clicar(botao("Salvar alterações"));
      expect(document.body.textContent).toContain(
        "Não foi possível falar com o servidor. Verifique a conexão e tente de novo.",
      );
      expect(document.body.textContent).not.toContain("Failed to fetch");
      expect(botao("Salvar alterações").disabled).toBe(false);
      expect(controlador.estado.obter().rascunho.size).toBe(1);
    });
  });

  /*
  Pedidos de 30/09: a aba Usuários fica simples (pessoa, grupo, áreas,
  coordenação, situação) e a matriz por módulo vira opção avançada. Uma conta
  de administrador foi para "Usuário" sem área e entrou num sistema vazio: a
  gaveta avisa e o salvar espera a área (o banco recusa com 23514). Quem nunca
  entrou tem o convite para reenviar ou cancelar.
*/
  describe("Acessos: visão simples, trava de área e convite", () => {
    const CONTA_ADMIN = {
      id: "adm3",
      nome: "Conta Admin",
      email: "contaadmin@agenciasus.org.br",
      grupo: "admin",
      coordenacao: null,
      revisao_conta: "t3",
      admin_global: true,
      ativo: true,
      ultimo_acesso: "2026-09-30T12:00:00Z",
      convite_pendente: false,
      areas_efetivas: ["saude-indigena"],
      permissoes: {
        "area:saude-indigena": celula("sem_acesso", "excecao", "sem_acesso"),
        nucleo: celula("admin"),
      },
    };

    async function montarCom(usuarios, extra = {}) {
      const supabase = await montar({ perfil: ADMIN, teto: TETO_ADMIN });
      const original = supabase.rpc.getMockImplementation();
      supabase.rpc.mockImplementation((nome, args) =>
        nome === "obter_matriz_acessos"
          ? Promise.resolve({
              data: { ...MATRIZ(TETO_ADMIN), usuarios },
              error: null,
            })
          : extra[nome]
            ? extra[nome](args)
            : original(nome, args),
      );
      await act(async () => controlador.estado.carregarMatriz());
      return supabase;
    }
    const linhaDe = (texto) =>
      [...document.querySelectorAll("tbody tr")].find((tr) =>
        tr.textContent.includes(texto),
      );
    const gaveta = () => document.getElementById("acessosGaveta");

    it("por padrão: pessoa, grupo, áreas, coordenação e situação; sem select por módulo", async () => {
      await montar({ perfil: ADMIN, teto: TETO_ADMIN });
      const colunas = [...document.querySelectorAll("thead th")].map((th) =>
        th.textContent.trim(),
      );
      expect(colunas).toEqual([
        "Pessoa",
        "Grupo",
        "Áreas",
        "Coordenação",
        "Situação",
      ]);
      expect(select("Editais de Ana <img src=x>")).toBeNull();
      const ana = linhaDe("Ana <img src=x>");
      expect(ana.textContent).toContain("ana@agenciasus.org.br");
      expect(ana.querySelector(".acessos-chip-grupo").textContent).toBe(
        "Usuário",
      );
      // A explicação do grupo não ocupa a linha: fica só no title.
      expect(ana.querySelector(".acessos-grupo small")).toBeNull();
      expect(ana.querySelector(".acessos-grupo").title).toMatch(
        /^Leitura: vê .*não altera nada\.$/,
      );
      expect(ana.textContent).toContain("Saúde Indígena");
      expect(ana.textContent).toContain("Norte");
      expect(ana.textContent).toContain("Último acesso em 29/09/2026 às 12:00");
      const coord = linhaDe("coord@agenciasus.org.br");
      expect(coord.querySelector(".acessos-selo-convite").textContent).toBe(
        "Convidado · ainda não entrou",
      );
      // A linha inteira abre a gaveta.
      await clicar(ana.querySelector("td"));
      expect(gaveta().querySelector("h3").textContent).toBe("Ana <img src=x>");
      const titulos = [...gaveta().querySelectorAll("h4, summary")].map((el) =>
        el.textContent.trim(),
      );
      expect(titulos.slice(0, 4)).toEqual([
        "Grupo",
        "Coordenação",
        "Áreas",
        "Como a pessoa vê",
      ]);
      expect(
        gaveta().querySelector('select[aria-label="Grupo de Ana <img src=x>"]')
          .value,
      ).toBe("usuario");
      // Voltar à matriz: o toggle mostra um select por módulo.
      await clicar(gaveta().querySelector('button[aria-label="Fechar"]'));
      await verPorModulo();
      expect(select("Editais de Ana <img src=x>")).not.toBeNull();
    });

    it("admin que vira Usuário sem área: a gaveta avisa, o salvar espera; com a área, vai tudo num lote", async () => {
      const supabase = await montarCom([CONTA_ADMIN]);
      await clicar(linhaDe("Conta Admin").querySelector("td"));
      expect(gaveta().textContent).toContain(
        "Administrador global: vê todas as áreas.",
      );
      await escolher(
        gaveta().querySelector('select[aria-label="Grupo de Conta Admin"]'),
        "usuario",
      );
      expect(gaveta().querySelector(".acessos-sem-area").textContent).toContain(
        "Sem área e sem coordenação, Conta Admin entra e não vê nada.",
      );
      // A explicação do grupo fica no title do select, não no texto da gaveta.
      expect(
        gaveta().querySelector('select[aria-label="Grupo de Conta Admin"]')
          .title,
      ).toBe(
        "Leitura: vê visão geral, editais e lista de aprovados, não altera nada.",
      );
      expect(gaveta().textContent).not.toContain(
        "Leitura: vê visão geral, editais e lista de aprovados, não altera nada.",
      );
      const barra = document.querySelector(".acessos-salvar");
      expect(barra.querySelector(".acessos-sem-area").textContent).toContain(
        "Conta Admin ficaria sem nenhuma área",
      );
      await digitar(document.getElementById("acessosMotivo"), "Saiu da gestão");
      expect(botao("Salvar alterações").disabled).toBe(true);

      const caixa = [...gaveta().querySelectorAll("label")]
        .find((l) => l.textContent.trim() === "Saúde Indígena")
        .querySelector("input");
      await clicar(caixa);
      expect(gaveta().querySelector(".acessos-sem-area")).toBeNull();
      expect(
        document.querySelector(".acessos-salvar .acessos-sem-area"),
      ).toBeNull();
      await clicar(gaveta().querySelector('button[aria-label="Fechar"]'));
      await clicar(botao("Salvar alterações"));
      const chamada = supabase.rpc.mock.calls.find(
        ([nome]) => nome === "salvar_matriz_acessos",
      );
      expect(chamada[1]).toEqual({
        p_alteracoes: [
          {
            tipo: "grupo",
            usuario_id: "adm3",
            grupo: "usuario",
            revisao: "t3",
          },
          {
            tipo: "nivel",
            usuario_id: "adm3",
            recurso: "area:saude-indigena",
            nivel: "leitor",
            revisao: 0,
          },
        ],
        p_motivo: "Saiu da gestão",
      });
    });

    it("recusa do banco (23514) aparece com a mensagem dele e o rascunho fica", async () => {
      const mensagem =
        "Ana ficaria sem nenhuma área e não veria nada no sistema. Marque ao menos uma área (ou uma coordenação) junto com a troca de grupo.";
      await montarCom(MATRIZ(TETO_ADMIN).usuarios, {
        salvar_matriz_acessos: () =>
          Promise.resolve({
            data: null,
            error: { code: "23514", message: mensagem },
          }),
      });
      await verPorModulo();
      await escolher(select("Editais de Ana <img src=x>"), "editor");
      await digitar(document.getElementById("acessosMotivo"), "Teste");
      await clicar(botao("Salvar alterações"));
      const aviso = document.querySelector('.ui-aviso[role="status"]');
      expect(aviso.dataset.tone).toBe("warning");
      expect(aviso.textContent).toContain(mensagem);
      expect(aviso.textContent).toContain("Nada foi salvo");
      expect(controlador.estado.obter().rascunho.size).toBe(1);
    });

    it.each(["PT409", "40001"])(
      "conflito de versão (%s): relê a matriz, mantém o rascunho e avisa",
      async (code) => {
        const supabase = await montarCom(MATRIZ(TETO_ADMIN).usuarios, {
          salvar_matriz_acessos: () =>
            Promise.resolve({
              data: null,
              error: { code, message: "Conta alterada por outra pessoa." },
            }),
        });
        await verPorModulo();
        await escolher(select("Editais de Ana <img src=x>"), "editor");
        await digitar(document.getElementById("acessosMotivo"), "Teste");
        const leiturasAntes = supabase.rpc.mock.calls.filter(
          ([nome]) => nome === "obter_matriz_acessos",
        ).length;
        await clicar(botao("Salvar alterações"));
        await vi.waitFor(() =>
          expect(
            supabase.rpc.mock.calls.filter(
              ([nome]) => nome === "obter_matriz_acessos",
            ).length,
          ).toBeGreaterThan(leiturasAntes),
        );
        const salvamentos = supabase.rpc.mock.calls.filter(
          ([nome]) => nome === "salvar_matriz_acessos",
        );
        expect(salvamentos).toHaveLength(1);
        const aviso = document.querySelector('.ui-aviso[role="status"]');
        expect(aviso.dataset.tone).toBe("warning");
        expect(aviso.textContent).toContain("mudaram enquanto você editava");
        expect(controlador.estado.obter().rascunho.size).toBe(1);
      },
    );

    it("convite pendente: a gaveta reenvia (copiar / e-mail) e cancela com motivo", async () => {
      const supabase = await montar({ perfil: ADMIN, teto: TETO_ADMIN });
      await clicar(linhaDe("coord@agenciasus.org.br").querySelector("td"));
      const secao = gaveta().querySelector(
        '[aria-labelledby="acessosGavetaConvite"]',
      );
      expect(secao.textContent).toContain("Cadastrado em 28/09/2026.");
      expect(secao.querySelector("summary").textContent).toBe(
        "Reenviar convite",
      );
      expect(
        secao.querySelector(".acessos-convite-mensagem").textContent,
      ).toContain("Olá, Coord! Você foi convidado(a) para o Yeendé (AgSUS).");
      expect(
        [...secao.querySelectorAll("a")]
          .find((a) => a.textContent.trim() === "Abrir no e-mail")
          .getAttribute("href"),
      ).toMatch(/^mailto:coord@agenciasus\.org\.br\?subject=/);
      expect(secao.textContent).toContain(
        "Só funciona com coord@agenciasus.org.br.",
      );
      // "Desativar acesso" some: para quem nunca entrou, é "Cancelar convite".
      expect(botao("Desativar acesso")).toBeUndefined();
      await clicar(botao("Cancelar convite"));
      await digitar(
        document.getElementById("acessosCancelarConviteMotivo"),
        "Não vai mais entrar",
      );
      await clicar(
        [...secao.querySelectorAll("form button")].find(
          (b) => b.textContent.trim() === "Cancelar convite",
        ),
      );
      const chamada = supabase.rpc.mock.calls.find(
        ([nome]) => nome === "desativar_acesso_usuario",
      );
      expect(chamada[1]).toEqual({
        p_perfil_usuario_id: "eu",
        p_motivo: "Não vai mais entrar",
      });
    });
  });

  describe("Acessos: contas desativadas e reativação", () => {
    const DESATIVADAS = [
      {
        id: "p9",
        nome: "Caio",
        email: "caio@agenciasus.org.br",
        grupo: "coordenador",
        grupo_nome: "Coordenador",
        coordenacao: "norte",
        areas: [],
        desativada_em: "2026-09-30T15:00:00Z",
        desativada_por: "adm@agenciasus.org.br",
        motivo: "Saiu da equipe",
        pedido_pendente: true,
        ultimo_acesso: null,
      },
      {
        id: "p8",
        nome: null,
        email: "antiga@agenciasus.org.br",
        grupo: "usuario",
        grupo_nome: "Usuário",
        coordenacao: null,
        areas: ["saude-indigena"],
        desativada_em: "2026-01-10T15:00:00Z",
        desativada_por: null,
        motivo: null,
        pedido_pendente: false,
        ultimo_acesso: null,
      },
    ];
    const comDesativadas = (mais = {}) => ({
      listar_contas_desativadas: () => ({
        data: { contas: DESATIVADAS },
        error: null,
      }),
      ...mais,
    });
    const chamadas = (supabase, nome) =>
      supabase.rpc.mock.calls.filter(([n]) => n === nome);
    const modal = () => document.getElementById("acessosReativar");
    const botaoNo = (raiz, texto) =>
      [...raiz.querySelectorAll("button")].find(
        (b) => b.textContent.trim() === texto,
      );
    const linhaDe = (texto) =>
      [...document.querySelectorAll("tbody tr")].find((tr) =>
        tr.textContent.includes(texto),
      );

    async function abrirReativacaoDoCaio(mais) {
      const supabase = await montar({
        perfil: ADMIN,
        teto: TETO_ADMIN,
        extra: comDesativadas(mais),
      });
      await clicar(botao("Desativadas (2)"));
      await clicar(botaoNo(linhaDe("caio@agenciasus.org.br"), "Reativar"));
      return supabase;
    }

    it("admin: aba 'Desativadas' com contagem, quando/por quem/motivo e 'Pediu reativação'", async () => {
      await montar({
        perfil: ADMIN,
        teto: TETO_ADMIN,
        extra: comDesativadas(),
      });
      expect(document.querySelector(".acessos-resumo-contas").textContent).toBe(
        "2 ativas · 2 desativadas",
      );
      await clicar(botao("Desativadas (2)"));
      const caio = linhaDe("caio@agenciasus.org.br");
      expect(caio.textContent).toContain(
        "Desativada em 30/09/2026 por adm@agenciasus.org.br",
      );
      expect(caio.textContent).toContain("Saiu da equipe");
      expect(caio.textContent).toContain("Coordenador");
      expect(caio.textContent).toContain("Norte");
      expect(caio.textContent).toContain("Pediu reativação");
      const antiga = linhaDe("antiga@agenciasus.org.br");
      expect(antiga.textContent).toContain("Desativada em 10/01/2026");
      expect(antiga.textContent).not.toContain(" por ");
      expect(antiga.textContent).toContain("motivo não registrado");
      expect(antiga.textContent).toContain("Saúde Indígena");
      expect(antiga.textContent).not.toContain("Pediu reativação");
    });

    it("a busca da aba vale para Desativadas", async () => {
      const supabase = await montar({
        perfil: ADMIN,
        teto: TETO_ADMIN,
        extra: comDesativadas(),
      });
      await clicar(botao("Desativadas (2)"));
      vi.useFakeTimers();
      try {
        await digitar(
          document.querySelector('.acessos-busca input[type="search"]'),
          "caio",
        );
        await act(async () => vi.advanceTimersByTime(350));
      } finally {
        vi.useRealTimers();
      }
      await esperar();
      expect(chamadas(supabase, "listar_contas_desativadas").at(-1)[1]).toEqual(
        {
          p_busca: "caio",
        },
      );
    });

    it("reativar: vem o que a pessoa tinha, com as travas da gaveta, motivo e toast", async () => {
      const supabase = await abrirReativacaoDoCaio();
      expect(modal().querySelector("h3").textContent).toBe("Reativar Caio");
      expect(document.getElementById("acessosReativarGrupo").value).toBe(
        "coordenador",
      );
      expect(document.getElementById("acessosReativarCoordenacao").value).toBe(
        "norte",
      );
      // Sem coordenação: o grupo gerencia acessos e não há área.
      await escolher(document.getElementById("acessosReativarCoordenacao"), "");
      const avisos = [...modal().querySelectorAll(".acessos-sem-area")].map(
        (el) => el.textContent,
      );
      expect(avisos.join(" ")).toContain(
        "Sem área e sem coordenação, Caio entra e não vê nada.",
      );
      expect(avisos.join(" ")).toContain("Este grupo exige coordenação.");
      expect(botaoNo(modal(), "Reativar").disabled).toBe(true);
      await escolher(
        document.getElementById("acessosReativarCoordenacao"),
        "norte",
      );
      expect(modal().querySelector(".acessos-sem-area")).toBeNull();
      // Motivo obrigatório.
      await clicar(botaoNo(modal(), "Reativar"));
      expect(modal().textContent).toContain("Informe o motivo");
      expect(chamadas(supabase, "reativar_acesso_usuario")).toHaveLength(0);

      await digitar(
        document.getElementById("acessosReativarMotivo"),
        "Voltou para a equipe",
      );
      const lidas = chamadas(supabase, "listar_contas_desativadas").length;
      await clicar(botaoNo(modal(), "Reativar"));
      expect(chamadas(supabase, "reativar_acesso_usuario")[0][1]).toEqual({
        p_perfil_usuario_id: "p9",
        p_grupo: "coordenador",
        p_coordenacao: "norte",
        p_areas: [],
        p_motivo: "Voltou para a equipe",
      });
      expect(controlador.estado.toast).toHaveBeenCalledWith(
        "Conta reativada. Na próxima entrada, Caio verá as boas-vindas de volta.",
        "success",
      );
      expect(modal()).toBeNull();
      expect(chamadas(supabase, "listar_contas_desativadas").length).toBe(
        lidas + 1,
      );
    });

    it("reativar sem coordenação manda as áreas marcadas", async () => {
      const supabase = await abrirReativacaoDoCaio();
      await escolher(
        document.getElementById("acessosReativarGrupo"),
        "usuario",
      );
      await escolher(document.getElementById("acessosReativarCoordenacao"), "");
      const caixa = [...modal().querySelectorAll("label")]
        .find((l) => l.textContent.trim() === "Saúde Indígena")
        .querySelector("input");
      await clicar(caixa);
      await digitar(document.getElementById("acessosReativarMotivo"), "Voltou");
      await clicar(botaoNo(modal(), "Reativar"));
      expect(chamadas(supabase, "reativar_acesso_usuario")[0][1]).toMatchObject(
        {
          p_grupo: "usuario",
          p_coordenacao: null,
          p_areas: ["saude-indigena"],
        },
      );
    });

    it("recusa do banco (23514 / 42501) aparece no modal, que fica aberto", async () => {
      const mensagem =
        "O grupo coordenador gerencia acessos: escolha a coordenação da pessoa";
      await abrirReativacaoDoCaio({
        reativar_acesso_usuario: () => ({
          data: null,
          error: { code: "23514", message: mensagem },
        }),
      });
      await digitar(document.getElementById("acessosReativarMotivo"), "Voltou");
      await clicar(botaoNo(modal(), "Reativar"));
      expect(modal().querySelector(".acessos-recusa").textContent).toContain(
        mensagem,
      );
      await act(async () => controlador.raiz.unmount());
      await abrirReativacaoDoCaio({
        reativar_acesso_usuario: () => ({
          data: null,
          error: { code: "42501", message: "Somente o administrador global" },
        }),
      });
      await digitar(document.getElementById("acessosReativarMotivo"), "Voltou");
      await clicar(botaoNo(modal(), "Reativar"));
      expect(modal().querySelector(".acessos-recusa").textContent).toContain(
        "Só o administrador global pode reativar contas.",
      );
    });

    it("coordenador não vê 'Desativadas' nem lê as contas desativadas", async () => {
      const supabase = await montar({
        perfil: COORD,
        teto: TETO_COORD,
        extra: comDesativadas(),
      });
      expect(
        [...document.querySelectorAll('[role="radio"]')].map((b) =>
          b.textContent.trim(),
        ),
      ).toEqual(["Ativos", "Pendentes (1)"]);
      expect(document.querySelector(".acessos-resumo-contas")).toBeNull();
      expect(chamadas(supabase, "listar_contas_desativadas")).toHaveLength(0);
    });

    it("gaveta: 'Desativar acesso' pede o motivo (obrigatório) e a conta vai para Desativadas", async () => {
      const supabase = await montar({
        perfil: ADMIN,
        teto: TETO_ADMIN,
        extra: comDesativadas(),
      });
      await clicar(linhaDe("ana@agenciasus.org.br").querySelector("td"));
      await clicar(botao("Desativar acesso"));
      const formulario = document.querySelector(
        'form[aria-label="Desativar acesso"]',
      );
      const confirmar = botaoNo(formulario, "Desativar acesso");
      expect(confirmar.disabled).toBe(true);
      expect(formulario.textContent).toContain("Motivo da desativação");
      await digitar(
        document.getElementById("acessosDesativarMotivo"),
        "Saiu da equipe",
      );
      const lidas = chamadas(supabase, "listar_contas_desativadas").length;
      await clicar(botaoNo(formulario, "Desativar acesso"));
      expect(chamadas(supabase, "desativar_acesso_usuario")[0][1]).toEqual({
        p_perfil_usuario_id: "u1",
        p_motivo: "Saiu da equipe",
      });
      expect(chamadas(supabase, "listar_contas_desativadas").length).toBe(
        lidas + 1,
      );
    });

    it("Pendentes: pedido de reativação com selo, histórico e o grupo de antes", async () => {
      const supabase = await montar({
        perfil: ADMIN,
        teto: TETO_ADMIN,
        extra: comDesativadas({
          listar_solicitacoes_acesso: () => ({
            data: [
              {
                ...PEDIDO,
                id: "s2",
                nome: "Caio",
                email: "caio@agenciasus.org.br",
                reativacao: true,
                desativada_em: "2026-09-30T15:00:00Z",
                desativada_por: "adm@agenciasus.org.br",
                motivo_desativacao: "Saiu da equipe",
                grupo_anterior: "coordenador",
              },
            ],
            error: null,
          }),
        }),
      });
      await clicar(botao("Pendentes (1)"));
      const linha = linhaDe("caio@agenciasus.org.br");
      expect(linha.querySelector(".acessos-selo-reativacao").textContent).toBe(
        "Reativação",
      );
      expect(linha.textContent).toContain(
        "Desativada em 30/09 por adm@agenciasus.org.br · motivo: Saiu da equipe",
      );
      expect(select("Grupo de Caio").value).toBe("coordenador");
      await clicar(botaoNo(linha, "Aprovar"));
      expect(
        chamadas(supabase, "aprovar_solicitacao_acesso")[0][1],
      ).toMatchObject({ p_solicitacao_id: "s2", p_grupo: "coordenador" });
    });
  });

  describe("Pendentes: pedido por área (20261021140000)", () => {
    const PEDIDO_POR_AREA = {
      id: "s3",
      nome: "Duda",
      email: "duda@agenciasus.org.br",
      coordenacao: null,
      coordenacao_nome: null,
      area: "saude-indigena",
      area_nome: "Saúde Indígena",
      cargo: "COORDENACAO_DSEI",
      cargo_rotulo: "Coordenação de DSEI ou CASAI",
      setor: "DSEI Yanomami",
      justificativa: "Coordeno a equipe do DSEI e acompanho os editais.",
      created_at: "2026-10-20T10:00:00Z",
    };
    const comPedido = (mais = {}) => ({
      listar_solicitacoes_acesso: () => ({
        data: [{ ...PEDIDO_POR_AREA, ...mais }],
        error: null,
      }),
      recusar_solicitacao_acesso: () => ({
        data: { ok: true, status: "recusado" },
        error: null,
      }),
    });
    const chamadasDe = (supabase, nome) =>
      supabase.rpc.mock.calls.filter(([n]) => n === nome);

    it("mostra área, cargo, lotação e justificativa; o cargo sugere o grupo e a área vem marcada", async () => {
      const supabase = await montar({
        perfil: ADMIN,
        teto: TETO_ADMIN,
        extra: comPedido(),
      });
      await clicar(botao("Pendentes (1)"));
      const texto = document.body.textContent;
      expect(texto).toContain("Saúde Indígena · Coordenação de DSEI ou CASAI");
      expect(texto).toContain("DSEI Yanomami");
      expect(texto).toContain("Coordeno a equipe do DSEI");
      const grupo = select("Grupo de Duda");
      expect(grupo.value).toBe("coordenador");
      expect(grupo.selectedOptions[0].textContent).toBe(
        "Coordenador (sugerido)",
      );
      await escolher(grupo, "usuario");
      await clicar(botao("Aprovar"));
      expect(
        chamadasDe(supabase, "aprovar_solicitacao_acesso")[0][1],
      ).toMatchObject({
        p_solicitacao_id: "s3",
        p_grupo: "usuario",
        p_coordenacao: null,
        p_areas: ["saude-indigena"],
      });
    });

    it("coordenador: o grupo sugerido acima do teto vira Usuário e a coordenação é a dele", async () => {
      const supabase = await montar({
        perfil: COORD,
        teto: TETO_COORD,
        extra: comPedido({ coordenacao: "norte", coordenacao_nome: "Norte" }),
      });
      await clicar(botao("Pendentes (1)"));
      const grupo = select("Grupo de Duda");
      expect(grupo.value).toBe("usuario");
      expect([...grupo.options].map((o) => o.value)).not.toContain(
        "coordenador",
      );
      expect(select("Coordenação de Duda").disabled).toBe(true);
      await clicar(botao("Aprovar"));
      expect(
        chamadasDe(supabase, "aprovar_solicitacao_acesso")[0][1],
      ).toMatchObject({ p_grupo: "usuario", p_coordenacao: "norte" });
    });

    it("recusar pede o motivo da lista; 'Outro' exige descrição; a prévia mostra o que a pessoa verá", async () => {
      const supabase = await montar({
        perfil: ADMIN,
        teto: TETO_ADMIN,
        extra: comPedido(),
      });
      await clicar(botao("Pendentes (1)"));
      await clicar(botao("Recusar"));
      expect(
        document.getElementById("acessosRecusarPedidoTitulo").textContent,
      ).toBe("Recusar o pedido de Duda");
      await clicar(botao("Recusar pedido"));
      expect(chamadasDe(supabase, "recusar_solicitacao_acesso")).toHaveLength(
        0,
      );
      expect(document.body.textContent).toContain(
        "Escolha o motivo da recusa.",
      );
      await escolher(document.getElementById("acessosRecusarMotivo"), "OUTRO");
      await digitar(
        document.getElementById("acessosRecusarComplemento"),
        "curto",
      );
      await clicar(botao("Recusar pedido"));
      expect(chamadasDe(supabase, "recusar_solicitacao_acesso")).toHaveLength(
        0,
      );
      await escolher(
        document.getElementById("acessosRecusarMotivo"),
        "AREA_OU_LOTACAO",
      );
      await digitar(
        document.getElementById("acessosRecusarComplemento"),
        "o DSEI é outro",
      );
      expect(document.getElementById("acessosRecusarPrevia").textContent).toBe(
        "A pessoa verá: Área ou lotação não confere — o DSEI é outro",
      );
      await clicar(botao("Recusar pedido"));
      expect(chamadasDe(supabase, "recusar_solicitacao_acesso")[0][1]).toEqual({
        p_solicitacao_id: "s3",
        p_motivo: "AREA_OU_LOTACAO",
        p_complemento: "o DSEI é outro",
      });
      expect(document.getElementById("acessosRecusarPedido")).toBeNull();
    });
  });

  /*
  22/10: a gaveta lia `origem` de celulaExibida (que devolve `individual`) e
  não avisava quem gerencia Acessos por permissão individual sem coordenação;
  "Adicionar pessoa" aceitava e-mail de fora (o hook do Supabase recusa criar
  a conta) e já vinha com a área Saúde Indígena marcada.
*/
  describe("gaveta e adicionar pessoa", () => {
    it("permissão individual de editor em Acessos sem coordenação: a gaveta avisa", async () => {
      const matriz = MATRIZ(TETO_ADMIN);
      matriz.usuarios[0] = {
        ...matriz.usuarios[0],
        coordenacao: null,
        permissoes: {
          ...matriz.usuarios[0].permissoes,
          acessos: celula("editor", "excecao", "sem_acesso", 1),
        },
      };
      await montar({
        perfil: ADMIN,
        teto: TETO_ADMIN,
        extra: { obter_matriz_acessos: () => ({ data: matriz, error: null }) },
      });
      await clicar(document.querySelector(".acessos-nome"));
      expect(document.getElementById("acessosGaveta").textContent).toContain(
        "Este grupo exige coordenação.",
      );
    });

    it("só e-mail institucional; nenhuma área vem marcada quando há mais de uma", async () => {
      const matriz = MATRIZ(TETO_ADMIN);
      matriz.areas = [
        { id: "saude-indigena", titulo: "Saúde Indígena" },
        { id: "sede", titulo: "Sede" },
      ];
      const supabase = await montar({
        perfil: ADMIN,
        teto: TETO_ADMIN,
        extra: { obter_matriz_acessos: () => ({ data: matriz, error: null }) },
      });
      await clicar(botao("Adicionar pessoa"));
      await digitar(
        document.getElementById("acessosAdicionarEmail"),
        "fulano@gmail.com",
      );
      await digitar(document.getElementById("acessosAdicionarNome"), "Fulano");
      await digitar(
        document.getElementById("acessosAdicionarMotivo"),
        "Entrou na equipe",
      );
      const enviar = () =>
        [...document.querySelectorAll("#acessosAdicionar button")].find(
          (b) => b.textContent.trim() === "Adicionar pessoa",
        );
      await clicar(enviar());
      const modal = document.getElementById("acessosAdicionar");
      expect(modal.textContent).toContain(
        "Use um e-mail institucional (@agenciasus.org.br ou @agsus.org.br).",
      );
      // Sem coordenação e sem área marcada: pede a área.
      expect(modal.textContent).toContain("Escolha ao menos uma área.");
      expect(
        supabase.rpc.mock.calls.some(([n]) => n === "adicionar_pessoa_acesso"),
      ).toBe(false);
    });
  });

  describe("custo da tela", () => {
    it("digitar não dispara agsus:content-updated (só dados ou aba novos)", async () => {
      await montar({ perfil: ADMIN, teto: TETO_ADMIN });
      await clicar(botao("Adicionar pessoa"));
      const avisos = vi.fn();
      document.addEventListener("agsus:content-updated", avisos);
      try {
        await digitar(document.getElementById("acessosAdicionarNome"), "F");
        await digitar(document.getElementById("acessosAdicionarNome"), "Fu");
        expect(avisos).not.toHaveBeenCalled();
      } finally {
        document.removeEventListener("agsus:content-updated", avisos);
      }
    });
  });
});

bloco("modulos/agenda-das-entrevistas", () => {
  /*
  A agenda das entrevistas na Classificação (visão "Agenda",
  src/modulos/classificacao/agenda.tsx): salvar a regra, gerar a agenda dos
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
          {
            id: "e83",
            edital: "83/2026",
            unidade: "DSEI Xingu",
            candidatos: 3,
          },
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
      painel = montarTela(criarClassificacao, "page-classificacao", {
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
    // Sem edital escolhido, a Classificação mostra os cards dos editais.
    await clicar(
      secao.querySelector(".classificacao-editais [data-edital='e83']"),
    );
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
      // Leitura por GET: o supabase-js repete sozinho quando a conexão cai.
      expect(supabase.rpc).toHaveBeenCalledWith(
        "obter_agenda_entrevista",
        { p_edital: "e83" },
        { get: true },
      );
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
      expect(
        chamada(supabase, "salvar_regra_agenda_entrevista"),
      ).toBeUndefined();
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
      await clicar(
        document.querySelector("#agendaAjuste [data-valor='TROCA']"),
      );
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
          itens: [
            item(1, "08:30", "09:00", "MANUAL"),
            item(2, "08:00", "08:30"),
          ],
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

    it("agenda gerada e não salva: trocar de aba ou de edital pergunta; cancelar mantém, salvar libera", async () => {
      const supabase = supabaseFalso(agendaDoBanco({ regra: regraSalva() }));
      await montar(supabase);
      await abrirAgenda();
      const confirmar = vi.spyOn(window, "confirm").mockReturnValue(false);
      try {
        // Sem nada gerado, a troca de aba não pergunta.
        expect(guardaDeAlteracoes.comAlteracoes()).toBe(false);
        await clicar(secao.querySelector("[data-acao='gerar-agenda']"));
        expect(linhas()).toHaveLength(3);
        // O F5, o fechar e a troca de área passam a pedir confirmação.
        expect(guardaDeAlteracoes.comAlteracoes()).toBe(true);
        expect(guardaDeAlteracoes.podeRecarregar()).toBe(false);

        await clicar(secao.querySelector("[data-valor='listas']"));
        expect(confirmar).toHaveBeenCalledTimes(1);
        expect(confirmar.mock.calls[0][0]).toContain("não foram salvas");
        expect(linhas()).toHaveLength(3);

        await clicar(secao.querySelector("[data-acao='trocar-edital']"));
        expect(confirmar).toHaveBeenCalledTimes(2);
        expect(linhas()).toHaveLength(3);

        await clicar(secao.querySelector("[data-acao='salvar-agenda']"));
        await esperar();
        expect(guardaDeAlteracoes.comAlteracoes()).toBe(false);
        await clicar(secao.querySelector("[data-valor='listas']"));
        await esperar();
        expect(confirmar).toHaveBeenCalledTimes(2);
        expect(secao.querySelector(".agenda-tabela")).toBeNull();
      } finally {
        confirmar.mockRestore();
      }
    });

    it("agenda gerada e não salva: confirmar a troca de aba descarta e libera a guarda", async () => {
      const supabase = supabaseFalso(agendaDoBanco({ regra: regraSalva() }));
      await montar(supabase);
      await abrirAgenda();
      const confirmar = vi.spyOn(window, "confirm").mockReturnValue(true);
      try {
        await clicar(secao.querySelector("[data-acao='gerar-agenda']"));
        await clicar(secao.querySelector("[data-valor='listas']"));
        await esperar();
        expect(confirmar).toHaveBeenCalledTimes(1);
        expect(secao.querySelector(".agenda-tabela")).toBeNull();
        expect(guardaDeAlteracoes.comAlteracoes()).toBe(false);
      } finally {
        confirmar.mockRestore();
      }
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

    it("convocação registrada que não veio: erro com Tentar novamente, sem cair no cálculo atual", async () => {
      let falhar = true;
      const supabase = supabaseFalso(agendaDoBanco({ regra: regraSalva() }), {
        obter_lista_classificacao: () => {
          if (falhar) throw new Error("Failed to fetch");
          return {
            lista: EDITAL.listas[0],
            resultado: structuredClone(RETRATO),
          };
        },
      });
      await montar(supabase);
      await abrirAgenda();
      const falha = secao.querySelector(".agenda-falha-da-lista");
      expect(falha.textContent).toContain(
        "Não foi possível carregar a lista de convocação registrada",
      );
      expect(secao.querySelector(".agenda-fonte")).toBeNull();
      expect(secao.querySelector("[data-acao='gerar-agenda']").disabled).toBe(
        true,
      );

      falhar = false;
      await clicar(falha.querySelector("[data-acao='tentar-novamente']"));
      await esperar();
      expect(secao.querySelector(".agenda-falha-da-lista")).toBeNull();
      expect(secao.querySelector(".agenda-fonte")).toBeNull();
      expect(secao.querySelector("[data-acao='gerar-agenda']").disabled).toBe(
        false,
      );
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
      expect(
        secao.querySelector("[data-acao='salvar-regra-agenda']"),
      ).toBeNull();
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

  /*
  Os casos de 23/10 (114/2026: regra da agenda ainda não salva, nenhuma lista de
  convocação, agenda vazia). Nada disso é erro; a falha ao ler a agenda diz o
  que aconteceu (rede, permissão, edital), sem confundir com "sem lista".
*/
  describe("agenda: edital sem regra, sem lista e falhas ao ler", () => {
    const sem = (supabase, nome, resposta) => {
      const original = supabase.rpc.getMockImplementation();
      supabase.rpc.mockImplementation(async (n, args, opcoes) =>
        n === nome ? resposta() : original(n, args, opcoes),
      );
    };
    const editalSemLista = () => ({ ...structuredClone(EDITAL), listas: [] });

    it("sem regra da agenda e sem lista: formulário, aviso do cálculo atual e nada de erro", async () => {
      const supabase = supabaseFalso(
        agendaDoBanco({ regra: null, itens: [], bancas: [], historico: [] }),
        { obter_classificacao_do_edital: editalSemLista },
      );
      await montar(supabase);
      await abrirAgenda();
      expect(secao.querySelector("[role='alert']")).toBeNull();
      expect(secao.querySelector(".agenda-regra form")).not.toBeNull();
      expect(secao.querySelector(".agenda-fonte").textContent).toContain(
        "Sem lista de convocação gerada",
      );
      // Sem regra salva, "Gerar" espera a regra.
      expect(secao.querySelector("[data-acao='gerar-agenda']").disabled).toBe(
        true,
      );
      expect(chamada(supabase, "obter_lista_classificacao")).toBeUndefined();

      await digitar(secao.querySelector("[data-campo='inicio']"), "2026-10-06");
      await digitar(secao.querySelector("[data-campo='fim']"), "2026-10-06");
      await clicar(secao.querySelector("[data-acao='salvar-regra-agenda']"));
      await esperar();
      expect(secao.querySelector("[data-acao='gerar-agenda']").disabled).toBe(
        false,
      );
      await clicar(secao.querySelector("[data-acao='gerar-agenda']"));
      expect(linhas()[0][2]).toBe("Ana Primeira");
      await clicar(secao.querySelector("[data-acao='salvar-agenda']"));
      await esperar();
      expect(chamada(supabase, "salvar_agenda_entrevista")).toMatchObject({
        p_edital: "e83",
        p_dados: { acao: "GERAR", lista: null, versao_regra: 1 },
      });
    });

    it("com lista registrada e sem agenda salva: lê a lista uma vez; Atualizar não relê o retrato", async () => {
      const supabase = supabaseFalso(agendaDoBanco({ regra: regraSalva() }));
      await montar(supabase);
      await abrirAgenda();
      const leituras = () =>
        supabase.rpc.mock.calls.filter(
          ([n]) => n === "obter_lista_classificacao",
        ).length;
      const antes = leituras();
      expect(antes).toBeGreaterThan(0);
      expect(linhas().map((l) => l[2])).toEqual([
        "Ana Primeira",
        "Bia Segunda",
        "Caio Terceiro",
      ]);
      await clicar(secao.querySelector("[data-acao='atualizar']"));
      await esperar();
      await esperar();
      expect(leituras()).toBe(antes);
      expect(secao.querySelector(".agenda-falha-da-lista")).toBeNull();
    });

    it.each([
      [
        "rede",
        { message: "TypeError: Failed to fetch", code: "" },
        "Não foi possível falar com o servidor",
      ],
      [
        "permissão",
        { message: "Sem permissão", code: "42501" },
        "Seu acesso não inclui a agenda deste edital.",
      ],
      [
        "edital",
        { message: "Edital não encontrado", code: "22023" },
        "Edital não encontrado",
      ],
    ])(
      "falha ao ler a agenda (%s) diz o motivo e Tentar novamente lê de novo",
      async (_caso, erro, texto) => {
        const supabase = supabaseFalso(agendaDoBanco({ regra: null }), {
          obter_classificacao_do_edital: editalSemLista,
        });
        let falhar = true;
        sem(supabase, "obter_agenda_entrevista", () =>
          falhar
            ? { data: null, error: erro }
            : { data: agendaDoBanco({ regra: null }), error: null },
        );
        const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
        await montar(supabase);
        await abrirAgenda();
        const alerta = secao.querySelector("[role='alert']");
        expect(alerta.textContent).toContain(
          `Não foi possível carregar a agenda das entrevistas: ${texto}`,
        );
        expect(alerta.textContent).not.toContain("lista de convocação");
        expect(aviso).toHaveBeenCalled();
        aviso.mockRestore();

        falhar = false;
        await clicar(alerta.querySelector("[data-acao='tentar-novamente']"));
        await esperar();
        expect(secao.querySelector("[role='alert']")).toBeNull();
        expect(secao.querySelector(".agenda-regra form")).not.toBeNull();
      },
    );
  });
});

bloco("modulos/avaliacao-documental-assistente", () => {
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

  /* O editor da regra mora nas Regras do edital (Editais), etapa 2, desde 03/11/2026. */
  async function montar(supabase) {
    const montado = await montarRegrasDoEdital({
      supabase,
      editalId: "e93",
      etapa: "avaliacao",
      toast: vi.fn(),
    });
    secao = montado.secao;
    painel = montado;
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
      expect(secao.textContent).toContain(
        "pergunta(s) ligada(s) pelo enunciado",
      );
      const formacao = secao.querySelector("[data-bloco='FORMACAO']");
      const linhas = formacao.querySelectorAll("[data-ligacao]");
      expect(linhas.length).toBeGreaterThan(0);
      expect(linhas[0].querySelector("input").value).toBe(
        "Qual seu Nível de Titulação Acadêmica",
      );
      expect(linhas[0].dataset.situacao).toBe("achou");
      // Um começo que casa com duas colunas da mesma vaga: amarelo.
      const cota = () => secao.querySelector("[data-bloco='COTA_PP']");
      expect(cota().querySelectorAll("li[data-situacao='achou']").length).toBe(
        3,
      );
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
      expect(
        chamada[1].p_configuracao.desempate.map((d) => d.criterio),
      ).toEqual(["MAIOR_IDADE", "IDOSO_60"]);
      expect(
        supabase.rpc.mock.calls.some(
          ([nome]) => nome === "salvar_regra_analise",
        ),
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
      // O corte por pontos mínimos (e a base da nota do lote) é da Triagem.
      expect(secao.querySelector("[data-cartao='corte']")).toBeNull();
      expect(secao.textContent).not.toContain("Corte por pontos mínimos");
      expect(secao.textContent).not.toContain(
        "Nota do corte e da ordem do lote",
      );
    });

    it("passo 4: o catálogo inteiro de desempate, em grupos, marca os usados e acrescenta", async () => {
      await montar(supabaseFalso({ regra: regraSalva(1) }));
      await clicar(passo("nota"));
      // Só o desempate da Classificação: o da lista do lote é da Triagem.
      const seletores = secao.querySelectorAll(
        "[data-acao='acrescentar-criterio']",
      );
      expect(seletores).toHaveLength(1);
      expect(
        secao.querySelector(
          "[data-tour='avd-assistente-desempate-provisoria']",
        ),
      ).toBeNull();
      const [daClassificacao] = seletores;
      await clicar(daClassificacao);
      const painel = secao.querySelector(".avd-ast-catalogo-painel");
      const itens = painel.querySelectorAll("[data-criterio]");
      expect(itens.length).toBe(CATALOGO_DE_CRITERIOS.length);
      expect(
        [...painel.querySelectorAll("[data-grupo]")].map(
          (g) => g.dataset.grupo,
        ),
      ).toEqual(["legal", "pontuacao", "experiencia", "idade", "outros"]);
      const idoso = painel.querySelector("[data-criterio='IDOSO_60']");
      expect(idoso.disabled).toBe(true);
      expect(idoso.textContent).toContain("1º na lista");
      await clicar(painel.querySelector("[data-criterio='PCD']"));
      const lista = secao.querySelector(
        "[data-tour='avd-assistente-desempate']",
      );
      expect(lista.textContent).toContain("Ser pessoa com deficiência");
      // Busca sem acento.
      await digitar(painel.querySelector("input[type='search']"), "saude");
      expect(
        [...painel.querySelectorAll("[data-criterio]")].map(
          (b) => b.dataset.criterio,
        ),
      ).toEqual(["EXP_SAUDE_INDIGENA", "EXP_SAUDE_DIGITAL"]);
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
      const grupo = secao.querySelector(
        "[aria-label='Regra de classificação']",
      );
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
      for (const id of ["cardapio", "nota", "conferir"])
        await clicar(passo(id));
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
      expect(secao.querySelector(".avd-ast-navegacao").dataset.fixa).toBe(
        "sim",
      );
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
      const salvar = () =>
        secao.querySelector("[data-acao='salvar-assistente']");
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

    it("quem não coordena só lê a regra: sem assistente e sem salvar", async () => {
      await montar(supabaseFalso({ regra: regraSalva(1), pode: false }));
      expect(secao.querySelector(".avd-ast-passos")).toBeNull();
      expect(secao.querySelector("[data-acao='salvar-regra']")).toBeNull();
      expect(secao.querySelector(".avd-campos").disabled).toBe(true);
    });
  });
});

bloco("modulos/avaliacao-documental-rascunho", () => {
  /*
  Incidente de 13/10/2026 (114/2026): a regra editada no assistente se perdeu
  ao recarregar. Agora o rascunho da aba Regra é guardado a cada mudança
  (salvar_rascunho_regra) e volta ao abrir: "Continuar de onde parei" ou
  "Descartar"; a versão de onde ele partiu aparece se outra pessoa salvou no
  meio; salvar a versão nova apaga o rascunho; o F5 avisa.
*/

  const PROJ = JSON.parse(
    readFileSync(
      "tests/fixtures/avaliacao-documental/casos-de-pontuacao.json",
      "utf8",
    ),
  ).regras["PROJ26-CURRICULAR"];
  const DO_RASCUNHO = { ...PROJ, titulo_etapa: "Rascunho do incidente" };

  const regraSalva = (versao, configuracao = PROJ) => ({
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
  });

  function supabaseFalso({ versao = 2, guardado = null } = {}) {
    let regra = regraSalva(versao);
    let rascunho = guardado;
    const respostas = {
      listar_editais_avaliacao: () => ({
        area: "projetos",
        editais: [
          { id: "e114", edital: "114/2026", unidade: "SEDE", ativo: true },
        ],
      }),
      obter_regra_analise: () => ({
        schema_version: 1,
        edital: {
          id: "e114",
          edital: "114/2026",
          unidade: "SEDE",
          area: "projetos",
          numero: "114/2026",
          id_unidade: null,
        },
        papel: "COORDENADOR",
        pode_coordenar: true,
        origem: "PLANILHA",
        regra,
        modelos: [],
        nota_minima: { nota_minima: 15, nota_minima_por_nivel: {} },
        aldeias: { quantidade: 0 },
        pode_carregar_aldeias: false,
        fichas_concluidas: 0,
      }),
      obter_equipe_edital: () => ({
        papel: "COORDENADOR",
        pode_coordenar: true,
        gestores: [],
        equipe: [],
        pessoas: [],
        vagas: [],
      }),
      obter_apoio_regra_analise: () => ({
        perguntas_por_vaga: [],
        regras_da_area: [],
        classificacao: { pode_ler: false, pode_editar: false, regra: null },
      }),
      salvar_regra_analise: ({ p_configuracao, p_versao_atual }) => {
        regra = regraSalva(p_versao_atual + 1, p_configuracao);
        return { regra, fichas_afetadas: [] };
      },
      obter_rascunho_regra: () => rascunho,
      salvar_rascunho_regra: ({ p_conteudo, p_versao_base }) => {
        rascunho = {
          conteudo: p_conteudo,
          versao_base: p_versao_base,
          atualizado_em: new Date(2026, 9, 13, 15, 30).toISOString(),
        };
        return { atualizado_em: rascunho.atualizado_em };
      },
      descartar_rascunho_regra: () => {
        const havia = Boolean(rascunho);
        rascunho = null;
        return { descartado: havia };
      },
    };
    return {
      rpc: vi.fn(async (nome, args) => ({
        data: respostas[nome]?.(args) ?? null,
        error: null,
      })),
      auth: {
        getSession: async () => ({ data: { session: { user: { id: "u" } } } }),
      },
      rascunho: () => rascunho,
    };
  }

  let secao;
  let painel;
  let guarda;

  /*
  O editor da regra mora nas Regras do edital (Editais › Regras do edital,
  etapa 2) desde 03/11/2026: monta a etapa com a loja da Avaliação e um
  rascunho com a guarda e o atraso do teste.
*/
  async function montar(supabase) {
    secao = document.createElement("section");
    secao.id = "page-nucleo";
    document.body.append(secao);
    guarda = criarGuardaDeAlteracoes({ janela: window });
    const rascunho = criarRascunhoDaRegra({
      tipo: "ANALISE",
      supabase,
      atrasoMs: 0,
      guarda,
      janela: null,
    });
    const lojas = {
      avaliacao: criarEstadoDaAvaliacao({
        supabase,
        toast: vi.fn(),
        aoGravarVersao: (editalId) => void rascunho.esquecer(editalId),
      }),
      rascunhoDaAvaliacao: rascunho,
    };
    const raiz = createRoot(secao);
    painel = { raiz };
    await act(async () =>
      raiz.render(createElement(EtapaDaAvaliacao, { lojas, editalId: "e114" })),
    );
    await esperar();
    await esperar();
    await esperar();
  }
  const botao = (texto) =>
    [...secao.querySelectorAll("button")].find((b) =>
      b.textContent.trim().startsWith(texto),
    );
  const chamadas = (supabase, nome) =>
    supabase.rpc.mock.calls.filter(([n]) => n === nome);
  const aviso = () => secao.querySelector(".ui-aviso-de-rascunho");

  beforeEach(() => {
    redefinirDadosDoMonitoramento();
    definirAreaAtual("projetos");
    localStorage.clear();
  });
  afterEach(async () => {
    await act(async () => painel?.raiz?.unmount());
    secao?.remove();
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  describe("rascunho guardado da regra", () => {
    it("rascunho no banco: pergunta antes de mostrar o editor; continuar retoma no passo 2", async () => {
      const supabase = supabaseFalso({
        guardado: {
          conteudo: { regra: DO_RASCUNHO },
          versao_base: 2,
          // Hora local (a tela mostra a hora local): o teste vale em qualquer fuso.
          atualizado_em: new Date(2026, 9, 13, 14, 5).toISOString(),
        },
      });
      await montar(supabase);
      expect(aviso().textContent).toContain(
        "Você tem um rascunho não salvo de 13/10 14:05",
      );
      expect(aviso().querySelector("[data-rascunho-versao-mudou]")).toBeNull();
      expect(secao.querySelector("#avdAstTitulo")).toBeNull();
      await clicar(botao("Continuar de onde parei"));
      await esperar();
      expect(aviso()).toBeNull();
      expect(secao.querySelector(".avd-ast-chip").textContent).toContain(
        "Alterações não salvas",
      );
      expect(
        secao
          .querySelector("[data-passo='cardapio']")
          .getAttribute("aria-current"),
      ).toBe("step");
      // Regravado na versão vigente, com o mesmo conteúdo.
      expect(supabase.rascunho()).toMatchObject({
        versao_base: 2,
        conteudo: { regra: { titulo_etapa: "Rascunho do incidente" } },
      });
      expect(secao.querySelector("[data-rascunho]").textContent).toBe(
        "Rascunho guardado às 15:30",
      );
    });

    it("outra pessoa salvou no meio: mostra que o rascunho partiu da versão 1", async () => {
      const supabase = supabaseFalso({
        versao: 2,
        guardado: {
          conteudo: { regra: DO_RASCUNHO },
          versao_base: 1,
          // Hora local (a tela mostra a hora local): o teste vale em qualquer fuso.
          atualizado_em: new Date(2026, 9, 13, 14, 5).toISOString(),
        },
      });
      await montar(supabase);
      const texto = aviso()
        .querySelector("[data-rascunho-versao-mudou]")
        .textContent.replace(/\s+/g, " ");
      expect(texto).toContain("partiu da versão 1");
      expect(texto).toContain("a vigente agora é a versão 2");
    });

    it("descartar (confirmado) apaga o rascunho e abre a versão vigente", async () => {
      const supabase = supabaseFalso({
        guardado: {
          conteudo: { regra: DO_RASCUNHO },
          versao_base: 2,
          // Hora local (a tela mostra a hora local): o teste vale em qualquer fuso.
          atualizado_em: new Date(2026, 9, 13, 14, 5).toISOString(),
        },
      });
      await montar(supabase);
      vi.spyOn(window, "confirm").mockReturnValue(false);
      await clicar(botao("Descartar"));
      expect(aviso()).not.toBeNull();
      window.confirm.mockReturnValue(true);
      await clicar(botao("Descartar"));
      await esperar();
      expect(aviso()).toBeNull();
      expect(chamadas(supabase, "descartar_rascunho_regra")).toHaveLength(1);
      expect(supabase.rascunho()).toBeNull();
      expect(secao.querySelector("#avdAstTitulo").textContent).toContain(
        "Editar regra",
      );
      expect(secao.querySelector(".avd-ast-chip")).toBeNull();
    });

    it("rascunho igual à versão vigente some sem perguntar", async () => {
      const supabase = supabaseFalso({
        guardado: {
          conteudo: { regra: PROJ },
          versao_base: 2,
          // Hora local (a tela mostra a hora local): o teste vale em qualquer fuso.
          atualizado_em: new Date(2026, 9, 13, 14, 5).toISOString(),
        },
      });
      await montar(supabase);
      expect(aviso()).toBeNull();
      expect(chamadas(supabase, "descartar_rascunho_regra")).toHaveLength(1);
    });

    it("cada mudança é guardada; F5 pede confirmação; salvar a versão apaga o rascunho", async () => {
      const supabase = supabaseFalso();
      await montar(supabase);
      const sair = () => {
        const evento = new Event("beforeunload", { cancelable: true });
        window.dispatchEvent(evento);
        return evento.defaultPrevented;
      };
      expect(sair()).toBe(false);
      await clicar(secao.querySelector("[data-passo='cardapio']"));
      await clicar(
        secao
          .querySelector("[data-cartao='bloco:CURSOS']")
          .querySelector("input[type='checkbox']"),
      );
      // A gravação do rascunho pode levar mais que dois ciclos numa máquina lenta (CI).
      await vi.waitFor(() =>
        expect(
          chamadas(supabase, "salvar_rascunho_regra").length,
        ).toBeGreaterThan(0),
      );
      const [, args] = chamadas(supabase, "salvar_rascunho_regra").at(-1);
      expect(args).toMatchObject({
        p_tipo: "ANALISE",
        p_edital: "e114",
        p_versao_base: 2,
      });
      expect(sair()).toBe(true);
      // Salvar a versão nova apaga o rascunho antes de a aba remontar.
      await clicar(secao.querySelector("[data-passo='conferir']"));
      await digitar(
        secao.querySelector("[data-campo='motivo'] input"),
        "Tirei os cursos do edital 114",
      );
      await clicar(secao.querySelector("[data-acao='salvar-assistente']"));
      await vi.waitFor(() => {
        expect(chamadas(supabase, "salvar_regra_analise")).toHaveLength(1);
        expect(supabase.rascunho()).toBeNull();
      });
      expect(aviso()).toBeNull();
      expect(sair()).toBe(false);
    });
  });
});

bloco("modulos/comemoracoes", () => {
  /*
  Configurações › Comemorações: quem edita configurações vê a seção; mudar
  um marco vai para o rascunho como o JSON da chave comemoracoes_marcos
  (publicado depois, com motivo e histórico); "Testar" e o palco soltam na
  hora sem tocar no rascunho; a preferência pessoal fica neste navegador.
*/

  function criarEstado(valorInicial = "") {
    let valor = valorInicial;
    let versao = 0;
    const ouvintes = new Set();
    const mudarCampo = vi.fn((chave, novo) => {
      if (chave === CHAVE_DAS_COMEMORACOES) valor = novo;
      versao += 1;
      ouvintes.forEach((o) => o());
    });
    return {
      assinar: (o) => {
        ouvintes.add(o);
        return () => ouvintes.delete(o);
      },
      obter: () => versao,
      valor: (chave) => (chave === CHAVE_DAS_COMEMORACOES ? valor : ""),
      mudarCampo,
      atual: () => valor,
    };
  }

  function janelaFalsa({ movimento = true } = {}) {
    const guardado = new Map();
    return {
      matchMedia: () => ({ matches: !movimento }),
      localStorage: {
        getItem: (k) => (guardado.has(k) ? guardado.get(k) : null),
        setItem: (k, v) => guardado.set(k, String(v)),
        removeItem: (k) => guardado.delete(k),
      },
      guardado,
    };
  }

  let raiz = null;
  let host = null;

  async function montar(props) {
    host = document.createElement("div");
    document.body.append(host);
    raiz = createRoot(host);
    await act(async () => {
      raiz.render(createElement(SecaoComemoracoes, props));
    });
    return host;
  }

  afterEach(() => {
    act(() => raiz?.unmount());
    host?.remove();
    raiz = null;
  });

  const marco = (id) => host.querySelector(`[data-marco="${id}"]`);

  describe("seção Comemorações", () => {
    it("é uma seção de Configurações de quem edita configurações, com verbete da Aya", () => {
      expect(SECOES.map((s) => s.id)).toContain("comemoracoes");
      expect(SECOES_DA_AYA.comemoracoes.nome).toBe("Comemorações");
      const admin = { perfil: "admin" };
      const editor = {
        permissoes: { configuracoes: "editor" },
      };
      const leitor = {
        permissoes: { configuracoes: "leitor", acessos: "editor" },
      };
      expect(secaoDeConfiguracaoPermitida(admin, "comemoracoes")).toBe(true);
      expect(secaoDeConfiguracaoPermitida(editor, "comemoracoes")).toBe(true);
      expect(secaoDeConfiguracaoPermitida(leitor, "comemoracoes")).toBe(false);
    });

    it("lista os marcos em linhas agrupadas por módulo, com o padrão", async () => {
      const estado = criarEstado();
      await montar({
        estado,
        testar: vi.fn(),
        janela: janelaFalsa(),
        previa: false,
      });
      expect(host.querySelectorAll(".comemoracoes-marco")).toHaveLength(6);
      expect(
        [...host.querySelectorAll(".comemoracoes-grupo__titulo")].map(
          (h) => h.textContent,
        ),
      ).toEqual(["Análises", "Entrevistas", "Visão geral", "Acesso"]);
      expect(
        marco("acesso-liberado").querySelector(
          '[role="radio"][aria-checked="true"]',
        ).dataset.valor,
      ).toBe("suave");
      // Detalhes fechados: sem duração nem mensagem na linha.
      expect(
        host.querySelector("#comemoracoesMarco-acesso-liberado-duracao"),
      ).toBeNull();
      // Só aviso: sem efeito nem intensidade, e nos detalhes só a mensagem.
      for (const id of ["fila-zerada", "vaga-pronta"]) {
        expect(
          marco(id).querySelector(`#comemoracoesMarco-${id}-efeito`),
        ).toBeNull();
        expect(marco(id).querySelector('[role="radio"]')).toBeNull();
      }
      await clicar(
        host.querySelector(
          '[aria-label="Detalhes: Vaga pronta para a Classificação"]',
        ),
      );
      expect(
        host.querySelector("#comemoracoesMarco-vaga-pronta-mensagem"),
      ).not.toBeNull();
      expect(
        host.querySelector("#comemoracoesMarco-vaga-pronta-duracao"),
      ).toBeNull();
      expect(
        host.querySelector("#comemoracoesMarco-vaga-pronta-som"),
      ).toBeNull();
      // O palco vem antes dos marcos.
      expect(
        host.querySelector(".comemoracoes-palco + .comemoracoes-bloco"),
      ).not.toBeNull();
    });

    it("mudar um marco vai para o rascunho como JSON; um detalhe aberto por vez", async () => {
      const estado = criarEstado();
      await montar({
        estado,
        testar: vi.fn(),
        janela: janelaFalsa(),
        previa: false,
      });
      await escolher(
        host.querySelector("#comemoracoesMarco-edital-concluido-efeito"),
        "estrelas",
      );
      await clicar(
        marco("edital-concluido").querySelector(
          '[role="radio"][data-valor="normal"]',
        ),
      );
      await clicar(
        host.querySelector('[aria-label="Detalhes: Edital 100% analisado"]'),
      );
      await digitar(
        host.querySelector("#comemoracoesMarco-edital-concluido-duracao"),
        "9",
      );
      await clicar(
        host.querySelector('[aria-label="Detalhes: Fila de análises zerada"]'),
      );
      expect(
        host.querySelector("#comemoracoesMarco-edital-concluido-duracao"),
      ).toBeNull();
      expect(
        host.querySelector("#comemoracoesMarco-fila-zerada-mensagem"),
      ).not.toBeNull();
      await clicar(host.querySelector("#comemoracoesMarco-fila-zerada-ligado"));
      expect(JSON.parse(estado.atual())).toEqual({
        marcos: {
          "edital-concluido": {
            efeito: "estrelas",
            intensidade: "normal",
            duracaoS: 9,
          },
          "fila-zerada": { ligado: false },
        },
      });
      expect(marco("fila-zerada").dataset.ligado).toBe("false");
    });

    it("duração: dá para digitar 12 (o 1 do caminho não vira 2) e o limite entra ao sair", async () => {
      const estado = criarEstado();
      await montar({
        estado,
        testar: vi.fn(),
        janela: janelaFalsa(),
        previa: false,
      });
      await clicar(
        host.querySelector(
          '[aria-label="Detalhes: Marco do ano da área (1.000, 2.500… análises)"]',
        ),
      );
      const campo = () =>
        host.querySelector("#comemoracoesMarco-marco-do-ano-duracao");
      await digitar(campo(), "1");
      expect(campo().value).toBe("1");
      await digitar(campo(), "12");
      expect(campo().value).toBe("12");
      expect(JSON.parse(estado.atual()).marcos["marco-do-ano"].duracaoS).toBe(
        12,
      );
      await digitar(campo(), "1");
      await act(async () =>
        campo().dispatchEvent(new FocusEvent("focusout", { bubbles: true })),
      );
      expect(campo().value).toBe("2");
      expect(JSON.parse(estado.atual()).marcos["marco-do-ano"].duracaoS).toBe(
        2,
      );
    });

    it("Testar solta com as opções da tela e não toca no rascunho", async () => {
      const estado = criarEstado(
        JSON.stringify({
          marcos: { "edital-concluido": { efeito: "coracoes", som: true } },
        }),
      );
      const testar = vi.fn();
      await montar({ estado, testar, janela: janelaFalsa(), previa: false });
      await clicar(
        marco("edital-concluido").querySelector(".comemoracoes-testar"),
      );
      expect(testar).toHaveBeenCalledWith({
        texto:
          "Edital 114/2026 (Rio de Janeiro): as 1.512 fichas foram analisadas.",
        efeito: "coracoes",
        intensidade: "festa",
        duracaoMs: null,
        som: true,
        forma: "coracao",
      });
      // Marco só de aviso: o Testar pede só o aviso.
      await clicar(marco("fila-zerada").querySelector(".comemoracoes-testar"));
      expect(testar).toHaveBeenLastCalledWith({
        texto: "Nenhuma ficha pendente na SEDE.",
        efeito: null,
      });
      expect(estado.mudarCampo).not.toHaveBeenCalled();
    });

    it("o palco de testes solta o efeito escolhido nos botões, sem gravar", async () => {
      const estado = criarEstado();
      const testar = vi.fn();
      await montar({ estado, testar, janela: janelaFalsa(), previa: false });
      const palco = host.querySelector(".comemoracoes-palco");
      expect(palco.querySelectorAll("[data-efeito]")).toHaveLength(8);
      await clicar(palco.querySelector('[data-efeito="combinado"]'));
      await clicar(palco.querySelector('[role="radio"][data-valor="festa"]'));
      await digitar(host.querySelector("#comemoracoesPalcoDuracao"), "10");
      await clicar(host.querySelector(".comemoracoes-palco__soltar"));
      expect(testar).toHaveBeenCalledWith(
        expect.objectContaining({
          efeito: "combinado",
          intensidade: "festa",
          duracaoMs: 10000,
          som: false,
        }),
      );
      expect(estado.mudarCampo).not.toHaveBeenCalled();
    });

    it("marcos personalizados: mini-assistente cria, detalhes validam e removem", async () => {
      const estado = criarEstado();
      await montar({
        estado,
        testar: vi.fn(),
        janela: janelaFalsa(),
        previa: false,
      });
      await clicar(host.querySelector(".comemoracoes-adicionar"));
      await clicar(host.querySelector('[data-tipo="edital-contratados"]'));
      const criar = host.querySelector(".comemoracoes-assistente__criar");
      expect(criar.disabled).toBe(true);
      await digitar(host.querySelector("#comemoracoesNovo-nome"), "Edital 12");
      await digitar(host.querySelector("#comemoracoesNovo-edital"), "012/2026");
      await digitar(host.querySelector("#comemoracoesNovo-meta"), "30");
      await clicar(criar);
      expect(JSON.parse(estado.atual()).personalizados[0]).toMatchObject({
        id: "pessoal-1",
        nome: "Edital 12",
        tipo: "edital-contratados",
        edital: "012/2026",
        meta: 30,
      });
      expect(host.querySelector(".comemoracoes-assistente")).toBeNull();
      await clicar(host.querySelector('[aria-label="Detalhes: Edital 12"]'));
      await digitar(
        host.querySelector("#comemoracoesPessoal-pessoal-1-nome"),
        "",
      );
      expect(host.querySelector('[role="alert"]').textContent).toContain(
        "Dê um nome",
      );
      await clicar(
        host.querySelector('[aria-label="Remover marco personalizado"]'),
      );
      expect(estado.atual()).toBe("");
    });

    it("movimento reduzido: aviso e sem miniatura", async () => {
      const janela = janelaFalsa({ movimento: false });
      await montar({ estado: criarEstado(), testar: vi.fn(), janela });
      expect(host.textContent).toContain("Movimento reduzido");
      expect(host.querySelector(".comemoracoes-palco__previa")).toBeNull();
    });

    it("“Para mim” na linha do título guarda a preferência neste navegador", async () => {
      const janela = janelaFalsa();
      host = document.createElement("div");
      document.body.append(host);
      raiz = createRoot(host);
      await act(async () => {
        raiz.render(createElement(InterruptorPessoal, { janela }));
      });
      const caixa = host.querySelector("#comemoracoesParaMim");
      expect(caixa.checked).toBe(true);
      await clicar(caixa);
      expect(janela.guardado.get(CHAVE_DA_PREFERENCIA_PESSOAL)).toBe("1");
      expect(caixa.checked).toBe(false);
    });
  });
});

bloco("modulos/configuracoes-inicio-acesso-aparencia", () => {
  /*
  Configurações › Página inicial, Tela de acesso e Aparência em React (etapa
  3 da arquitetura). Antes eram campos `cfg*` do index.html: o estado lia o
  DOM para publicar, config-apresentacao.js montava grupos e prévias por
  createElement, aviso-de-contraste.js desenhava com innerHTML e o antigo
  sidebar-branding.js injetava o bloco da barra lateral. Agora os valores
  vêm do estado (o legado publica em loadConfig) e a publicação manda as
  mesmas chaves, com as mesmas descrições e a mesma normalização de antes.
*/

  // O que já está publicado (a tela carregada é igual ao banco).
  const PUBLICADO = {
    page_title: "Saúde Indígena",
    page_subtitle: "Monitoramento DSEI/CASAI",
    broadcast_type: "info",
    broadcast_msg: "",
    auth_google_enabled: "true",
    auth_google_button_text: "Entrar com a conta AgSUS",
    auth_google_domain_hint: "agenciasus.org.br",
    auth_google_allowed_domains: "agenciasus.org.br,agsus.org.br",
    auth_access_greeting: "Olá!",
    auth_access_background_url: "https://cdn.test/branding/acesso-1.webp",
    auth_access_background_path: "branding/acesso-1.webp",
    auth_access_logo_url: "https://cdn.test/logo.png",
    auth_access_panel_color: "#c090eb",
    auth_access_texto_modo: "auto",
    ui_sidebar_logo_url: "/assets/agsus-logo.webp",
    ui_sidebar_background_color: "#ffffff",
  };

  const snapshot = (config = PUBLICADO) => ({
    configuracoes: Object.entries(config).map(([chave, valor]) => ({
      chave,
      valor,
    })),
    paineis: [],
  });

  let cliente;
  let armazenamento;
  let controlador;
  let confirmar;
  let avisar;

  function criarCliente() {
    armazenamento = {
      list: vi.fn(async (pasta) => ({
        data:
          pasta === "branding"
            ? [
                { name: "acesso-1.webp" },
                { name: "acesso-2.png" },
                { name: "sidebar" },
              ]
            : [{ name: "logo-a.png" }, { name: "outra.txt" }],
        error: null,
      })),
      upload: vi.fn(async () => ({ error: null })),
      remove: vi.fn(async () => ({ error: null })),
      getPublicUrl: (caminho) => ({
        data: { publicUrl: `https://cdn.test/${caminho}` },
      }),
    };
    return {
      rpc: vi.fn(async (nome, argumentos) => {
        if (nome === "get_configuracoes_historico")
          return { data: [], error: null };
        if (nome === "definir_fundo_acesso_monitora")
          return {
            data: { url: argumentos.p_url, caminho: argumentos.p_caminho },
            error: null,
          };
        if (nome === "salvar_configuracoes_e_paineis_v2")
          return { data: { ok: true, total_alteracoes: 1 }, error: null };
        return { data: snapshot(), error: null };
      }),
      storage: { from: () => armazenamento },
    };
  }

  async function montar({ secao = "inicio", config = PUBLICADO } = {}) {
    const estado = criarEstadoDasConfiguracoes({
      supabase: () => cliente,
      confirmar: (mensagem) => confirmar(mensagem),
      alertar: vi.fn(),
      recarregar: vi.fn(),
    });
    const imagens = criarImagensDaAparencia({
      supabase: () => cliente,
      configuracoes: estado,
      avisar: (...args) => avisar(...args),
      confirmar: (mensagem) => confirmar(mensagem),
    });
    await act(async () => {
      controlador = montarConfiguracoesNoTeste({ estado, imagens, secao });
    });
    await act(async () => estado.definirValoresCarregados(config));
    await esperar();
    return estado;
  }

  const $ = (id) => document.getElementById(id);
  const salvar = () => document.querySelector(".config-barra__salvar");
  const sujo = () =>
    Boolean(document.querySelector(".config-cabecalho__pendente"));
  const tituloDoDialogo = () => $("configGovernanceTitle")?.textContent;
  const secao = (id) =>
    document.querySelector(`.config-secao[data-secao="${id}"]`);
  const previa = (id) => secao(id).querySelector(".config-previa__conteudo");

  async function publicar(motivo = "Ajuste") {
    await clicar(salvar());
    await esperar();
    expect(tituloDoDialogo()).toBe("Revisar publicação");
    await digitar($("configPublishReason"), motivo);
    await clicar(
      [...document.querySelectorAll(".config-governance-footer .btn")].at(-1),
    );
    await esperar();
    return cliente.rpc.mock.calls.find(
      ([nome]) => nome === "salvar_configuracoes_e_paineis_v2",
    )?.[1];
  }

  const linhasPorChave = (chamada) =>
    new Map(chamada.p_config_rows.map((linha) => [linha.chave, linha]));

  beforeEach(() => {
    cliente = criarCliente();
    confirmar = vi.fn(() => true);
    avisar = vi.fn();
  });
  afterEach(async () => {
    await act(async () => controlador?.raiz?.unmount());
    controlador = null;
    document.body.innerHTML = "";
    redefinirMarcaDaBarraLateral();
    document.documentElement.style.removeProperty("--sidebar-custom-bg");
  });

  describe("o estado não depende mais do DOM legado", () => {
    it("as três seções desenham no corpo da própria seção, sem campo cfg*", async () => {
      await montar();
      for (const id of ["inicio", "acesso", "aparencia"])
        expect(
          secao(id).querySelector(".config-secao-react"),
          id,
        ).not.toBeNull();
      expect(document.querySelectorAll('[id^="cfg"]')).toHaveLength(0);
    });

    it("as chaves e descrições das seções são as de antes; a publicação manda só a mudada", async () => {
      await montar();
      await digitar($("configInicio-pageTitle"), "Novo título");
      const chamada = await publicar();
      expect(chamada.p_config_rows).toEqual([
        {
          chave: "page_title",
          valor: "Novo título",
          descricao: "Título da página inicial",
        },
      ]);
      const linhas = linhasPorChave({
        p_config_rows: linhasDasSecoes(
          new Map([
            ["page_title", "Novo título"],
            ["auth_access_greeting", "Olá!"],
          ]),
        ),
      });
      const ESPERADO = {
        page_title: "Título da página inicial",
        page_subtitle: "Subtítulo da página inicial",
        auth_google_enabled: "Exibe ou oculta o login com Google",
        auth_google_button_text: "Texto do botão de autenticação Google",
        auth_google_domain_hint: "Domínio sugerido no login Google",
        auth_google_allowed_domains: "Domínios institucionais autorizados",
        auth_access_background_url: "Arte institucional da tela de acesso",
        auth_access_background_path:
          "Caminho da arte institucional da tela de acesso",
        auth_access_logo_url: "Logo da AgSUS na tela de acesso",
        auth_access_panel_color: "Cor do painel da tela de acesso",
        auth_access_texto_modo: "Texto sobre o painel de acesso",
        auth_access_greeting: "Saudação da tela de acesso",
        filter_title: "Título dos filtros",
        filter_subtitle: "Subtítulo dos filtros",
        filter_toggle_show: "Texto para mostrar filtros",
        filter_toggle_hide: "Texto para ocultar filtros",
        kpi_vagas_label: "Rótulo do KPI vagas imediatas",
        kpi_contratadas_label: "Rótulo do KPI contratadas",
        kpi_em_selecao_label: "Rótulo do KPI em seleção",
        kpi_ociosas_label: "Rótulo do KPI vagas ociosas",
        kpi_alem_das_vagas_label: "Rótulo do KPI contratações além das vagas",
        kpi_criticos_label: "Rótulo do KPI críticos",
        kpi_inscritos_label: "Rótulo do KPI inscritos",
        broadcast_type: "Tipo do aviso global",
        broadcast_msg: "Mensagem do aviso global",
        ui_sidebar_logo_url: "Logo independente da barra lateral do Yeendé",
        ui_sidebar_background_color: "Cor de fundo da barra lateral do Yeendé",
      };
      for (const [chave, descricao] of Object.entries(ESPERADO))
        expect(linhas.get(chave)?.descricao, chave).toBe(descricao);
      expect(linhas.get("page_title").valor).toBe("Novo título");
      expect(linhas.get("auth_access_greeting").valor).toBe("Olá!");
      expect(linhas.size).toBe(CHAVES_DAS_SECOES.length);
    });

    it("chave ausente no banco: o padrão que o formulário legado mostrava", async () => {
      const estado = await montar({ config: { page_title: "Painel" } });
      await digitar($("configInicio-pageSubtitle"), "x");
      const chaves = (await publicar()).p_config_rows.map((l) => l.chave);
      expect(chaves).toEqual(["page_subtitle"]);
      const linhas = linhasPorChave({
        p_config_rows: linhasDasSecoes(estado.obter().valores),
      });
      const valor = (chave) => linhas.get(chave).valor;
      expect(valor("broadcast_type")).toBe("info");
      expect(valor("auth_google_enabled")).toBe("true");
      expect(valor("auth_google_allowed_domains")).toBe(
        "agenciasus.org.br,agsus.org.br",
      );
      expect(valor("auth_access_greeting")).toBe("Boas-vindas!");
      expect(valor("auth_access_panel_color")).toBe("#c296eb");
      expect(valor("auth_access_texto_modo")).toBe("auto");
      expect(valor("auth_access_logo_url")).toMatch(
        /\/assets\/agsus-logo\.webp$/,
      );
      expect(valor("auth_access_background_url")).toMatch(
        /\/assets\/access-background-default\.svg$/,
      );
      expect(valor("auth_access_background_path")).toBe("");
      expect(valor("ui_sidebar_logo_url")).toBe("/assets/agsus-logo.webp");
      expect(valor("ui_sidebar_background_color")).toBe("#ffffff");
    });
  });

  describe("Página inicial", () => {
    it("a prévia acompanha o que se digita, como texto (nada de HTML)", async () => {
      await montar();
      expect(previa("inicio").textContent).toContain("Saúde Indígena");
      expect(previa("inicio").querySelector(".previa-aviso")).toBeNull();
      await escolher($("configInicio-broadcastType"), "danger");
      await digitar(
        $("configInicio-broadcastMsg"),
        "<img src=x onerror=alert(1)>Manutenção às 18h",
      );
      const aviso = previa("inicio").querySelector(
        '.previa-aviso[data-tom="danger"]',
      );
      expect(aviso.textContent).toContain("Crítico: <img src=x");
      expect(previa("inicio").querySelector("img")).toBeNull();
      await digitar($("configInicio-kpiVagasLabel"), "Postos");
      const kpis = previa("inicio").querySelectorAll(".ui-kpi");
      expect(kpis).toHaveLength(7);
      expect(kpis[0].textContent).toContain("Postos");
      expect(sujo()).toBe(true);
    });

    it("título em branco não publica e aponta o campo", async () => {
      await montar();
      await digitar($("configInicio-pageTitle"), "  ");
      cliente.rpc.mockClear();
      await clicar(salvar());
      expect(cliente.rpc).not.toHaveBeenCalled();
      expect(tituloDoDialogo()).toBe("Corrigir configurações");
      expect(document.body.textContent).toContain(
        "Informe o título da página inicial.",
      );
      expect($("configInicio-pageTitle").getAttribute("aria-invalid")).toBe(
        "true",
      );
    });

    it("sair com alteração pergunta; aceito, descarta e o campo volta ao publicado", async () => {
      const estado = await montar();
      await digitar($("configInicio-filterTitle"), "Refinar");
      expect(estado.confirmarSaida(() => false)).toBe(false);
      await act(async () =>
        expect(estado.confirmarSaida(() => true)).toBe(true),
      );
      expect($("configInicio-filterTitle").value).toBe("");
      expect(sujo()).toBe(false);
    });
  });

  describe("Tela de acesso", () => {
    it("prévia com saudação, slogan e botão do Google; desligado, sem botão", async () => {
      await montar({ secao: "acesso" });
      const texto = () => previa("acesso").textContent;
      expect(texto()).toContain("Olá!");
      expect(texto()).toContain("Gestão dos processos seletivos");
      expect(texto()).toContain("Entrar com a conta AgSUS");
      await digitar($("configAcesso-authAccessGreeting"), "Bem-vindo");
      expect(texto()).toContain("Bem-vindo");
      await escolher($("configAcesso-authGoogleEnabled"), "false");
      expect(
        previa("acesso").querySelector(".previa-acesso__google"),
      ).toBeNull();
      expect(texto()).toContain("Login Google desligado");
    });

    it("desligar o Google pede confirmação; recusado, não publica", async () => {
      await montar({ secao: "acesso" });
      await escolher($("configAcesso-authGoogleEnabled"), "false");
      confirmar.mockReturnValue(false);
      cliente.rpc.mockClear();
      await clicar(salvar());
      expect(confirmar).toHaveBeenCalledWith(
        expect.stringContaining("O login Google será desativado"),
      );
      expect(cliente.rpc).not.toHaveBeenCalled();
      confirmar.mockReturnValue(true);
      const linhas = linhasPorChave(await publicar());
      expect(linhas.get("auth_google_enabled").valor).toBe("false");
    });

    it("com o Google já desligado no banco, salvar outra coisa não pergunta de novo", async () => {
      await montar({
        secao: "acesso",
        config: { ...PUBLICADO, auth_google_enabled: "false" },
      });
      await digitar($("configAcesso-authAccessGreeting"), "Oi");
      await publicar();
      expect(confirmar).not.toHaveBeenCalledWith(
        expect.stringContaining("O login Google será desativado"),
      );
    });

    it("domínio sugerido fora do formato é recusado com a mensagem de antes", async () => {
      await montar({ secao: "acesso" });
      await digitar(
        $("configAcesso-authGoogleDomainHint"),
        "https://agsus.org.br",
      );
      await clicar(salvar());
      expect(tituloDoDialogo()).toBe("Corrigir configurações");
      expect(document.body.textContent).toContain(
        "O domínio Google deve estar no formato agenciasus.org.br, sem https://, @ ou barras.",
      );
    });

    it("domínios permitidos chegam normalizados (minúsculas, sem @, sem repetição)", async () => {
      await montar({
        secao: "acesso",
        config: {
          ...PUBLICADO,
          auth_google_allowed_domains:
            " @AgenciaSUS.org.br, agsus.org.br,agsus.org.br",
        },
      });
      expect($("configAcesso-authGoogleAllowedDomains").value).toBe(
        "agenciasus.org.br,agsus.org.br",
      );
    });
  });

  describe("Aparência", () => {
    it("a cor do painel mostra o contraste e reage ao modo do texto", async () => {
      await montar({ secao: "aparencia" });
      const contraste = () =>
        secao("aparencia").querySelector(".config-contraste").textContent;
      expect(contraste()).toContain("Acima do mínimo de 4,5");
      expect(contraste()).toContain("5,87");
      await escolher($("configAparencia-authAccessTextoModo"), "claro");
      expect(contraste()).toContain("Abaixo do mínimo de 4,5");
      // A prévia da tela de acesso usa a cor e o texto escolhidos.
      const cartao = previa("aparencia").querySelector(
        ".previa-acesso__cartao",
      );
      expect(cartao.style.getPropertyValue("--cor-do-cartao")).not.toBe("");
      expect(cartao.classList.contains("previa-acesso__cartao--vidro")).toBe(
        false,
      );
    });

    it("o painel de vidro aparece na prévia e o aviso diz que a arte decide", async () => {
      await montar({ secao: "aparencia" });
      await escolher($("configAparencia-authAccessPainelEstilo"), "vidro");
      const cartao = previa("aparencia").querySelector(
        ".previa-acesso__cartao",
      );
      expect(cartao.classList.contains("previa-acesso__cartao--vidro")).toBe(
        true,
      );
      expect(
        secao("aparencia").querySelector(".config-contraste").textContent,
      ).toContain("No vidro o painel fica sem cor");
    });

    /*
    13/11/2026: a cor no vidro e o desfoque da arte se escolhem aqui, só com o
    vidro escolhido; a prévia e o aviso de contraste acompanham.
  */
    it("com o vidro, escolhe a cor no vidro e o desfoque; a prévia acompanha", async () => {
      await montar({ secao: "aparencia" });
      expect($("configAparencia-authAccessVidroCor")).toBeNull();
      await escolher($("configAparencia-authAccessPainelEstilo"), "vidro");
      await escolher($("configAparencia-authAccessVidroCor"), "70");
      await escolher($("configAparencia-authAccessVidroDesfoque"), "leve");
      const cartao = previa("aparencia").querySelector(
        ".previa-acesso__cartao",
      );
      expect(cartao.style.getPropertyValue("--vidro-cor")).toBe("70%");
      expect(cartao.style.getPropertyValue("--vidro-desfoque")).toBe("8px");
      expect(
        secao("aparencia").querySelector(".config-contraste").textContent,
      ).toContain("70% da cor");
      await escolher($("configAparencia-authAccessPainelEstilo"), "solido");
      expect($("configAparencia-authAccessVidroCor")).toBeNull();
    });

    it("logo do acesso com endereço inválido não publica", async () => {
      await montar({ secao: "aparencia" });
      await digitar(
        $("configAparencia-authAccessLogoUrl"),
        "javascript:alert(1)",
      );
      await clicar(salvar());
      expect(tituloDoDialogo()).toBe("Corrigir configurações");
      expect(document.body.textContent).toContain(
        "URL inválida no campo Logo da AgSUS no acesso.",
      );
    });

    it("a cor da barra no rascunho pinta a barra de verdade; descartada, volta", async () => {
      const estado = await montar({ secao: "aparencia" });
      const corDaBarra = () =>
        document.documentElement.style.getPropertyValue("--sidebar-custom-bg");
      await digitar($("configAparencia-uiSidebarBackgroundColor"), "#102a43");
      expect(corDaBarra()).toBe("#102a43");
      expect(document.body.classList.contains("sidebar-theme-dark")).toBe(true);
      expect(
        secao("aparencia").querySelectorAll(".config-contraste"),
      ).toHaveLength(2);
      await act(async () => estado.confirmarSaida(() => true));
      expect(corDaBarra()).toBe("#ffffff");
    });

    it("galeria de artes: a em uso sem Apagar; usar outra aplica na hora", async () => {
      const ouvidos = [];
      document.addEventListener(EVENTO_FUNDO_DO_ACESSO, (e) =>
        ouvidos.push(e.detail),
      );
      await montar({ secao: "aparencia" });
      await esperar();
      const cartoes = secao("aparencia").querySelectorAll(
        '[data-formato="paisagem"] .config-galeria__cartao',
      );
      // A subpasta "sidebar" não é imagem.
      expect(cartoes).toHaveLength(2);
      expect(cartoes[0].textContent).toContain("Em uso");
      expect(cartoes[0].querySelector(".config-galeria__apagar")).toBeNull();
      await clicar(cartoes[1].querySelector(".config-galeria__item"));
      await esperar();
      expect(cliente.rpc).toHaveBeenCalledWith(
        "definir_fundo_acesso_monitora",
        {
          p_url: "https://cdn.test/branding/acesso-2.png",
          p_caminho: "branding/acesso-2.png",
        },
      );
      expect(ouvidos.at(-1)).toEqual({
        url: "https://cdn.test/branding/acesso-2.png",
        caminho: "branding/acesso-2.png",
      });
      expect(avisar).toHaveBeenCalledWith("Arte aplicada à tela de acesso.");
      // Aplicada na hora: não fica pendente para "Salvar alterações".
      expect(sujo()).toBe(false);
      const depois = secao("aparencia").querySelectorAll(
        '[data-formato="paisagem"] .config-galeria__cartao',
      );
      expect(depois[1].textContent).toContain("Em uso");
    });

    it("apagar uma arte pede confirmação e remove do armazenamento", async () => {
      await montar({ secao: "aparencia" });
      await esperar();
      const apagar = secao("aparencia").querySelector(
        '[data-formato="paisagem"] .config-galeria__apagar',
      );
      confirmar.mockReturnValueOnce(false);
      await clicar(apagar);
      expect(armazenamento.remove).not.toHaveBeenCalled();
      await clicar(apagar);
      await esperar();
      expect(armazenamento.remove).toHaveBeenCalledWith([
        "branding/acesso-2.png",
      ]);
      expect(avisar).toHaveBeenCalledWith("Arte apagada.");
    });

    it("enviar uma arte: guarda, grava e, se a gravação falha, apaga o arquivo", async () => {
      await montar({ secao: "aparencia" });
      const arquivo = new File(["x"], "arte.png", { type: "image/png" });
      const entrada = $("configAparencia-arteArquivo");
      const escolherArquivo = async (lista) => {
        Object.defineProperty(entrada, "files", {
          value: lista,
          configurable: true,
        });
        await act(async () => {
          entrada.dispatchEvent(new Event("change", { bubbles: true }));
        });
        await esperar();
      };
      await escolherArquivo([new File(["x"], "a.gif", { type: "image/gif" })]);
      expect(avisar).toHaveBeenCalledWith(
        "Use uma imagem JPG, PNG ou WEBP.",
        "warn",
      );
      expect(armazenamento.upload).not.toHaveBeenCalled();

      await escolherArquivo([arquivo]);
      expect(armazenamento.upload).toHaveBeenCalledWith(
        expect.stringMatching(/^branding\/acesso-.+\.png$/),
        arquivo,
        expect.objectContaining({ upsert: false }),
      );
      expect(avisar).toHaveBeenCalledWith(
        "Imagem guardada e aplicada à tela de acesso.",
      );

      cliente.rpc.mockImplementationOnce(async () => ({
        data: null,
        error: { message: "sem permissão" },
      }));
      await escolherArquivo([arquivo]);
      expect(armazenamento.remove).toHaveBeenCalled();
      expect(avisar).toHaveBeenCalledWith(
        "Não foi possível guardar a imagem: sem permissão",
        "error",
      );
    });

    it("sem armazenamento, enviar e apagar arte avisam com clareza (sem TypeError)", async () => {
      const semArmazenamento = { rpc: cliente.rpc };
      const imagens = criarImagensDaAparencia({
        supabase: () => semArmazenamento,
        configuracoes: criarEstadoDasConfiguracoes({
          supabase: () => semArmazenamento,
          confirmar: () => true,
          alertar: vi.fn(),
          recarregar: vi.fn(),
        }),
        avisar: (...args) => avisar(...args),
        confirmar: () => true,
      });
      const arquivo = new File(["x"], "arte.png", { type: "image/png" });
      const aviso =
        "Armazenamento indisponível: não foi possível conectar ao armazenamento das imagens.";

      expect(await imagens.enviarFundo(arquivo)).toBe(false);
      expect(avisar).toHaveBeenLastCalledWith(aviso, "error");
      expect(
        await imagens.apagarFundo({
          caminho: "branding/acesso-2.png",
          nome: "acesso-2.png",
          url: "https://cdn.test/branding/acesso-2.png",
        }),
      ).toBe(false);
      expect(avisar).toHaveBeenLastCalledWith(aviso, "error");
      expect(String(avisar.mock.calls)).not.toMatch(/TypeError|undefined/);
      expect(imagens.obter().fundoOcupado).toBe("");

      // Restaurar o padrão só grava pela RPC: segue funcionando sem armazenamento.
      expect(await imagens.restaurarFundo()).toBe(true);
    });

    it("logo da barra: enviar guarda o arquivo e a escolha vai na publicação", async () => {
      await montar({ secao: "aparencia" });
      await esperar();
      const logos = secao("aparencia").querySelectorAll(
        '[data-formato="quadrado"] .config-galeria__cartao',
      );
      // Só as logo-*.png|jpg|webp.
      expect(logos).toHaveLength(1);
      await clicar(logos[0].querySelector(".config-galeria__item"));
      expect(secao("aparencia").textContent).toContain(
        "Logo selecionada. Clique em Salvar alterações para publicar.",
      );
      expect(sujo()).toBe(true);
      // A barra lateral de verdade (o <img> dela lê marca.ts) já mostra a escolha.
      expect(logoDaBarraLateral()).toBe(
        "https://cdn.test/branding/sidebar/logo-a.png",
      );
      // A selecionada não pode ser apagada.
      expect(
        secao("aparencia").querySelector(
          '[data-formato="quadrado"] .config-galeria__apagar',
        ),
      ).toBeNull();
      const linhas = linhasPorChave(await publicar());
      expect(linhas.get("ui_sidebar_logo_url").valor).toBe(
        "https://cdn.test/branding/sidebar/logo-a.png",
      );
    });

    it("restaurar a logo padrão fica pendente até salvar", async () => {
      await montar({
        secao: "aparencia",
        config: {
          ...PUBLICADO,
          ui_sidebar_logo_url: "https://cdn.test/branding/sidebar/logo-a.png",
        },
      });
      const restaurar = [
        ...secao("aparencia").querySelectorAll(".config-imagem .btn"),
      ].filter((b) => b.textContent.includes("Restaurar padrão"))[1];
      await clicar(restaurar);
      expect(sujo()).toBe(true);
      expect(
        secao("aparencia").querySelector(".config-imagem__previa--logo").src,
      ).toMatch(/\/assets\/agsus-logo\.webp$/);
      // A publicada segue na barra de todo mundo até salvar: não se apaga.
      expect(
        secao("aparencia").querySelector(
          '[data-formato="quadrado"] .config-galeria__apagar',
        ),
      ).toBeNull();
    });
  });

  describe("regras do código", () => {
    const arquivos = [
      "pagina-inicial.tsx",
      "tela-de-acesso.tsx",
      "aparencia.tsx",
      "partes.tsx",
      "imagens.ts",
      "estado.ts",
    ].map((nome) => readFileSync(`src/modulos/configuracoes/${nome}`, "utf8"));

    it("sem innerHTML, sem dangerouslySetInnerHTML e sem ler campos cfg* do DOM", () => {
      for (const fonte of arquivos) {
        expect(fonte).not.toMatch(/innerHTML|dangerouslySetInnerHTML/);
        expect(fonte).not.toMatch(/getElementById\(\s*["']cfg/);
      }
    });

    it("o legado não tem mais a marcação nem o código das três seções", () => {
      const html = readFileSync("index.html", "utf8");
      const app = fonteDoApp();
      for (const id of [
        "cfgPageTitle",
        "cfgBroadcastMsg",
        "cfgGoogleEnabled",
        "cfgAccessGreeting",
        "cfgAccessPanelColor",
        "cfgAccessBackgroundGallery",
        "cfgLoginLogo",
      ])
        expect(html, id).not.toContain(`id="${id}"`);
      for (const nome of [
        "function renderConfigForm",
        "function uploadAccessBackground",
        "function loadAccessBackgroundGallery",
        "function previewImg",
      ])
        expect(app, nome).not.toContain(nome);
    });
  });
});

bloco("modulos/configuracoes-paineis-e-operacao", () => {
  /*
  Configurações › Painéis externos e Operação em React (01/10). Antes, a
  tabela de painéis era montada com innerHTML (config-ui.js) e os campos de
  Operação eram `cfg*` do index.html; a publicação lia tudo do DOM. Agora o
  legado publica os valores (loadConfig) e os painéis (loadPanels) no estado,
  e a publicação manda o mesmo `p_config_rows`/`p_paineis` de antes.
*/

  const PUBLICADO = {
    auth_google_enabled: "true",
    auth_access_texto_modo: "auto",
    broadcast_type: "info",
    page_title: "Saúde Indígena",
    feature_realtime_monitoramento: "true",
    access_heartbeat_minutos: "5",
    cogip_versao: "V.2.7.3",
    app_version_current: "Yeendé Web V2.9.35",
  };

  // Como `loadPanels` lê a TB_PAINEL_EXTERNO.
  const PAINEIS = [
    {
      id: "p1",
      codigo: "recursos",
      titulo: "Recursos",
      icone: "fa-file",
      url: "https://recursos.agenciasus.org.br",
      ordem: 1,
      ativo: true,
      em_manutencao: false,
      tipo_abertura: "iframe",
    },
    {
      id: "p2",
      codigo: "bi",
      titulo: "BI",
      icone: "fa-chart",
      url: "",
      ordem: 2,
      ativo: false,
      em_manutencao: false,
      tipo_abertura: "iframe",
    },
  ];

  const snapshot = () => ({
    // O banco igual à tela: as chaves que faltam vêm com o padrão que a tela mostra.
    configuracoes: [...normalizarValoresCarregados(PUBLICADO)].map(
      ([chave, valor]) => ({
        chave,
        valor,
      }),
    ),
    paineis: PAINEIS.map((painel) => ({ ...painel })),
  });

  const VERSAO = {
    id: "v1",
    acao: "salvar",
    motivo: "Painel em manutenção",
    alteracoes: [
      {
        entidade: "painel",
        rotulo: "Recursos",
        campo: "Manutenção",
        antes: false,
        depois: true,
      },
    ],
    total_alteracoes: 1,
  };

  let cliente;
  let controlador;
  let recarregar;

  async function montar({ secao = "recursos", config = PUBLICADO } = {}) {
    recarregar = vi.fn();
    const estado = criarEstadoDasConfiguracoes({
      supabase: () => cliente,
      confirmar: () => true,
      alertar: vi.fn(),
      recarregar,
    });
    await act(async () => {
      controlador = montarConfiguracoesNoTeste({ estado, secao });
    });
    await act(async () => {
      estado.definirValoresCarregados(config);
      estado.definirPaineisCarregados(PAINEIS);
    });
    await esperar();
    return estado;
  }

  const $ = (id) => document.getElementById(id);
  const salvar = () => document.querySelector(".config-barra__salvar");
  const sujo = () =>
    Boolean(document.querySelector(".config-cabecalho__pendente"));
  const tituloDoDialogo = () => $("configGovernanceTitle")?.textContent;
  const botaoFinal = () =>
    [...document.querySelectorAll(".config-governance-footer .btn")].at(-1);
  const secao = (id) =>
    document.querySelector(`.config-secao[data-secao="${id}"]`);

  async function publicar(motivo = "Ajuste") {
    await clicar(salvar());
    await esperar();
    expect(tituloDoDialogo()).toBe("Revisar publicação");
    await digitar($("configPublishReason"), motivo);
    await clicar(botaoFinal());
    await esperar();
    return cliente.rpc.mock.calls.find(
      ([nome]) => nome === "salvar_configuracoes_e_paineis_v2",
    )?.[1];
  }

  beforeEach(() => {
    cliente = {
      rpc: vi.fn(async (nome) => {
        if (nome === "get_configuracoes_historico")
          return { data: [VERSAO], error: null };
        if (nome === "get_configuracoes_snapshot")
          return { data: snapshot(), error: null };
        return { data: { ok: true, total_alteracoes: 1 }, error: null };
      }),
    };
  });
  afterEach(async () => {
    await act(async () => controlador?.raiz?.unmount());
    controlador = null;
    document.body.innerHTML = "";
  });

  describe("Painéis externos", () => {
    it("lista os painéis carregados, com selo e resumo, dentro da seção", async () => {
      await montar();
      const tabela = secao("recursos").querySelector(".painel-externo-tabela");
      expect(tabela).not.toBeNull();
      expect($("configPainel-0-titulo").value).toBe("Recursos");
      expect($("configPainel-0-url").value).toBe(
        "https://recursos.agenciasus.org.br",
      );
      expect($("configPainel-0-ativo").value).toBe("true");
      expect($("configPainel-1-ativo").value).toBe("false");
      expect($("configPainel-1-manutencao").value).toBe("false");
      expect(tabela.textContent).toContain("Código: bi");
      const selos = [...tabela.querySelectorAll(".ui-selo")].map(
        (selo) => selo.textContent,
      );
      expect(selos).toEqual(["Ativo", "Inativo"]);
      const resumo = secao("recursos").querySelector(".previa-recursos");
      expect(resumo.textContent).toContain("2 painéis externos");
      // Sem as frases explicativas do legado.
      expect(secao("recursos").textContent).not.toContain("Salvar alterações");
      expect(secao("recursos").textContent).not.toContain("Título, endereço");
    });

    it("sem painel cadastrado, diz que não há; recarregar a lista redesenha", async () => {
      const estado = await montar();
      await act(async () => estado.definirPaineisCarregados([]));
      expect(secao("recursos").textContent).toContain(
        "Nenhum painel externo cadastrado.",
      );
      expect(secao("recursos").querySelector("table")).toBeNull();
      await act(async () =>
        estado.definirPaineisCarregados([
          ...PAINEIS,
          { id: "p3", codigo: "novo", titulo: "Novo", ativo: true, url: "" },
        ]),
      );
      expect(secao("recursos").querySelectorAll("tbody tr")).toHaveLength(3);
      expect(secao("recursos").textContent).toContain("Sem URL");
    });

    it("editar marca a página; voltar ao valor carregado desmarca", async () => {
      await montar();
      await digitar($("configPainel-0-titulo"), "Recursos novos");
      expect(sujo()).toBe(true);
      expect(salvar().disabled).toBe(false);
      await digitar($("configPainel-0-titulo"), "Recursos");
      expect(sujo()).toBe(false);
      await escolher($("configPainel-0-manutencao"), "true");
      expect(sujo()).toBe(true);
      expect(
        secao("recursos").querySelector("tbody tr .ui-selo").textContent,
      ).toBe("Manutenção");
    });

    it("endereço inválido não publica e aponta o campo", async () => {
      await montar();
      await digitar($("configPainel-0-url"), "ftp://recursos");
      cliente.rpc.mockClear();
      await clicar(salvar());
      expect(cliente.rpc).not.toHaveBeenCalled();
      expect(tituloDoDialogo()).toBe("Corrigir configurações");
      expect($("configPainel-0-url").getAttribute("aria-invalid")).toBe("true");
      expect(document.body.textContent).toContain(
        "URL inválida no campo Endereço do painel Recursos: use https:// ou http://.",
      );
      // Corrigir tira a marca do campo.
      await clicar(document.querySelector('[aria-label="Fechar"]'));
      await digitar($("configPainel-0-url"), "https://recursos.org");
      expect($("configPainel-0-url").getAttribute("aria-invalid")).toBeNull();
    });

    it("painel ativo sem endereço não publica", async () => {
      await montar();
      await escolher($("configPainel-1-ativo"), "true");
      await clicar(salvar());
      expect(tituloDoDialogo()).toBe("Corrigir configurações");
      expect(document.body.textContent).toContain(
        "Painéis ativos precisam de uma URL configurada.",
      );
    });

    it("publica p_paineis no formato de antes, com a revisão do que mudou", async () => {
      await montar();
      await digitar($("configPainel-0-url"), "https://novo.agenciasus.org.br");
      await escolher($("configPainel-1-manutencao"), "true");
      await clicar(salvar());
      await esperar();
      const linhas = [...document.querySelectorAll(".config-change-row")].map(
        (linha) => linha.textContent,
      );
      expect(linhas).toHaveLength(2);
      expect(linhas[0]).toContain("Painel");
      expect(linhas[0]).toContain("https://novo.agenciasus.org.br");
      expect(linhas[1]).toContain("Manutenção");
      await digitar($("configPublishReason"), "Novo endereço");
      await clicar(botaoFinal());
      await esperar();
      const chamada = cliente.rpc.mock.calls.find(
        ([nome]) => nome === "salvar_configuracoes_e_paineis_v2",
      )[1];
      expect(chamada.p_paineis).toEqual([
        {
          id: "p1",
          titulo: "Recursos",
          url: "https://novo.agenciasus.org.br",
          ativo: true,
          em_manutencao: false,
        },
        { id: "p2", titulo: "BI", url: "", ativo: false, em_manutencao: true },
      ]);
      expect(chamada.p_motivo).toBe("Novo endereço");
      expect(recarregar).toHaveBeenCalled();
    });
  });

  describe("publicação sem desfazer o que outro administrador mudou", () => {
    it("manda só o painel mexido, a partir do banco, e avisa do conflito", async () => {
      await montar();
      // Depois que a tela carregou, outro administrador trocou o título e o endereço do p1.
      cliente.rpc.mockImplementation(async (nome) => {
        if (nome === "get_configuracoes_snapshot") {
          const retrato = snapshot();
          retrato.paineis[0] = {
            ...retrato.paineis[0],
            titulo: "Recursos 2026",
            url: "https://outro.agenciasus.org.br",
          };
          return { data: retrato, error: null };
        }
        if (nome === "get_configuracoes_historico")
          return { data: [VERSAO], error: null };
        return { data: { ok: true, total_alteracoes: 1 }, error: null };
      });
      await digitar($("configPainel-0-url"), "https://novo.agenciasus.org.br");
      await clicar(salvar());
      await esperar();
      expect(
        document.querySelector(".config-governance-body").textContent,
      ).toContain("Outro administrador mudou depois que você abriu:");
      await digitar($("configPublishReason"), "Novo endereço");
      await clicar(botaoFinal());
      await esperar();
      const chamada = cliente.rpc.mock.calls.find(
        ([nome]) => nome === "salvar_configuracoes_e_paineis_v2",
      )[1];
      expect(chamada.p_config_rows).toEqual([]);
      expect(chamada.p_paineis).toEqual([
        {
          id: "p1",
          titulo: "Recursos 2026",
          url: "https://novo.agenciasus.org.br",
          ativo: true,
          em_manutencao: false,
        },
      ]);
    });

    it("reler os painéis (ex.: depois de salvar Módulos e abas) não apaga o rascunho", async () => {
      const estado = await montar();
      await digitar($("configPainel-0-url"), "https://novo.agenciasus.org.br");
      await act(async () =>
        estado.definirPaineisCarregados(
          PAINEIS.map((p) => (p.id === "p2" ? { ...p, ativo: true } : p)),
        ),
      );
      expect($("configPainel-0-url").value).toBe(
        "https://novo.agenciasus.org.br",
      );
      expect(estado.obter().paineis[1].ativo).toBe(true);
    });
  });

  describe("Operação", () => {
    it("mostra os valores carregados, normalizados como no legado", async () => {
      await montar({
        secao: "operacao",
        config: {
          ...PUBLICADO,
          feature_realtime_monitoramento: "não",
          access_heartbeat_minutos: undefined,
        },
      });
      const corpo = secao("operacao");
      expect(corpo.contains($("configOperacao-cogipVersao"))).toBe(true);
      expect($("configOperacao-cogipVersao").value).toBe("V.2.7.3");
      expect($("configOperacao-appVersionCurrent").value).toBe(
        "Yeendé Web V2.9.35",
      );
      expect($("configOperacao-featureRealtimeMonitoramento").value).toBe(
        "false",
      );
      expect($("configOperacao-accessHeartbeatMinutos").value).toBe("5");
      // O histórico continua na seção, depois dos campos.
      expect(corpo.contains($("configHistoryCard"))).toBe(true);
      // Sem o cartão informativo do CNES.
      expect(corpo.textContent).not.toContain("CNES");
    });

    it("heartbeat fora de 1–60 não publica", async () => {
      await montar({ secao: "operacao" });
      await digitar($("configOperacao-accessHeartbeatMinutos"), "61");
      cliente.rpc.mockClear();
      await clicar(salvar());
      expect(cliente.rpc).not.toHaveBeenCalledWith(
        "get_configuracoes_snapshot",
      );
      expect(tituloDoDialogo()).toBe("Corrigir configurações");
      expect(
        $("configOperacao-accessHeartbeatMinutos").getAttribute("aria-invalid"),
      ).toBe("true");
      expect(document.body.textContent).toContain(
        "O heartbeat deve ser um número inteiro entre 1 e 60.",
      );
    });

    it("publica os campos de Operação em p_config_rows, sem monit_id", async () => {
      await montar({ secao: "operacao" });
      await escolher($("configOperacao-featureRealtimeMonitoramento"), "false");
      await digitar($("configOperacao-accessHeartbeatMinutos"), "10");
      await digitar($("configOperacao-cogipVersao"), "V.3.0.0");
      const chamada = await publicar("Operação");
      const linhas = new Map(chamada.p_config_rows.map((l) => [l.chave, l]));
      expect(linhas.get("feature_realtime_monitoramento").valor).toBe("false");
      expect(linhas.get("access_heartbeat_minutos").valor).toBe("10");
      expect(linhas.get("cogip_versao")).toEqual({
        chave: "cogip_versao",
        valor: "V.3.0.0",
        descricao: "Versão do sistema",
      });
      // Só o que mudou: a chave não mexida e os painéis ficam como estão no banco.
      expect(linhas.has("app_version_current")).toBe(false);
      expect(linhas.has("monit_id")).toBe(false);
      expect(chamada.p_paineis).toEqual([]);
    });

    it("sem mudança real, nada a publicar", async () => {
      const estado = await montar({ secao: "operacao" });
      await esperar(() => estado.revisar());
      expect(tituloDoDialogo()).toBe("Nenhuma alteração");
    });
  });

  describe("restaurar versão", () => {
    it("chama a RPC, descarta o rascunho e a recarga repõe os campos", async () => {
      const estado = await montar({ secao: "operacao" });
      await digitar($("configOperacao-cogipVersao"), "rascunho");
      await escolher($("configPainel-0-manutencao"), "true");
      await esperar();
      const cartao = $("configHistoryCard");
      await clicar(
        [...cartao.querySelectorAll(".btn")].find((b) =>
          b.textContent.includes("Restaurar"),
        ),
      );
      expect(tituloDoDialogo()).toBe("Restaurar versão");
      await digitar($("configRestoreReason"), "Voltar");
      await clicar(botaoFinal());
      await esperar();
      expect(cliente.rpc).toHaveBeenCalledWith(
        "restaurar_configuracoes_versao",
        {
          p_versao_id: "v1",
          p_motivo: "Voltar",
        },
      );
      expect(recarregar).toHaveBeenCalled();
      expect(sujo()).toBe(false);
      expect($("configOperacao-cogipVersao").value).toBe("V.2.7.3");
      expect($("configPainel-0-manutencao").value).toBe("false");

      // A página recarrega: loadConfig e loadPanels publicam os valores restaurados.
      await act(async () => {
        estado.definirValoresCarregados({ ...PUBLICADO, cogip_versao: "V.1" });
        estado.definirPaineisCarregados([
          { ...PAINEIS[0], em_manutencao: true },
          PAINEIS[1],
        ]);
      });
      expect($("configOperacao-cogipVersao").value).toBe("V.1");
      expect($("configPainel-0-manutencao").value).toBe("true");
      expect(sujo()).toBe(false);
    });
  });
});

bloco("modulos/configuracoes-sem-alteracao-falsa", () => {
  /*
  Configurações sem "alterações não salvas" falsas (relato de 03/11/2026: só
  abrir Comemorações e Acessos e sair, e o Sair avisava alteração não salva).
  Com a configuração publicada como está no banco (o JSON das comemorações
  igual ao de produção), abrir as seções, abrir os detalhes de cada marco e
  passar o foco por todos os campos não cria rascunho.
*/
  const COMEMORACOES = JSON.stringify({
    marcos: {
      "edital-concluido": { efeito: "combinado", intensidade: "festa" },
      "fila-zerada": { efeito: "estrelas", intensidade: "festa" },
      "vaga-pronta": { efeito: "confete", intensidade: "festa" },
      "acesso-liberado": { efeito: "coracoes", intensidade: "festa" },
      "fim-do-tour": { efeito: "confete" },
      "fim-da-trilha": { efeito: "baloes" },
    },
    personalizados: [
      {
        id: "pessoal-1",
        nome: "Dia produtivo",
        tipo: "analises-no-dia",
        meta: 200,
        intensidade: "festa",
      },
      {
        id: "pessoal-2",
        nome: "Dia produtivo",
        tipo: "analises-no-dia",
        meta: 300,
        efeito: "estrelas",
        intensidade: "festa",
      },
    ],
  });
  const PUBLICADO = {
    comemoracoes_marcos: COMEMORACOES,
    auth_google_enabled: "true",
    access_heartbeat_minutos: "5",
    password_reset_flow: "admin",
    page_title: "Saúde Indígena",
  };

  afterEach(() => {
    document.body.innerHTML = "";
  });

  describe("Configurações sem alteração falsa", () => {
    it("abrir Comemorações e Acessos, abrir os detalhes e passar o foco não marca alteração", async () => {
      const estado = criarEstadoDasConfiguracoes({ supabase: () => null });
      let controlador;
      await act(async () => {
        controlador = montarConfiguracoesNoTeste({ estado });
      });
      await act(async () => estado.definirValoresCarregados(PUBLICADO));
      for (const secao of ["comemoracoes", "acessos"]) {
        await act(async () => abrirSecaoNoTeste(secao));
        for (const botao of document.querySelectorAll(
          ".comemoracoes-detalhes",
        )) {
          await act(async () => botao.click());
          for (const campo of document.querySelectorAll(
            ".comemoracoes input, .comemoracoes select",
          ))
            await act(async () => {
              campo.focus();
              campo.blur();
            });
        }
      }
      // Sair da página (a seção fica escondida) também não mexe no rascunho.
      await act(async () =>
        document.getElementById("page-config").classList.remove("active"),
      );
      expect(estado.temAlteracoes()).toBe(false);
      expect(estado.confirmarSaida(() => false)).toBe(true);
      controlador.raiz.unmount();
    }, 60_000);
  });
});

bloco("modulos/configuracoes", () => {
  /*
  Moldura React de Configurações (src/modulos/configuracoes/): o
  cabeçalho da seção aberta, a barra fixa de salvar, a publicação com motivo,
  o histórico com restauração e a seção Marca. Pedidos de 29/09 e 30/09:
  - o cabeçalho é o da seção (nome e descrição), sem "Ajustes do sistema";
  - na seção Acessos, a barra fixa e o Ctrl+S não publicam Configurações;
  - "não salvo" só vale para os campos das seções e os painéis (busca e
    matriz de acessos, não);
  - falha de rede: mensagem clara e botões de volta (publicar, histórico,
    restaurar);
  - o histórico fica na seção Operação;
  - a revisão lê `configuracoes` do snapshot e, sem mudança, não acusa nada.
*/

  const SEM_SERVIDOR =
    "Não foi possível falar com o servidor. Verifique a conexão e tente de novo.";

  // O que já está publicado: a tela carregada é igual ao banco.
  const PUBLICADO = {
    auth_google_enabled: "true",
    auth_access_texto_modo: "auto",
    broadcast_type: "info",
    feature_realtime_monitoramento: "true",
    access_heartbeat_minutos: "5",
    page_title: "Saúde Indígena",
    cogip_nome: "COGIP",
    footer_text: "AgSUS",
  };
  // O banco igual à tela: as chaves que faltam vêm com o padrão que a tela mostra.
  const snapshotIgual = () => ({
    configuracoes: [...normalizarValoresCarregados(PUBLICADO)].map(
      ([chave, valor]) => ({
        chave,
        valor,
      }),
    ),
    paineis: [],
  });

  let cliente;
  let controlador;
  let alertar;
  let recarregar;

  async function montar({
    secao = "marca",
    confirmar = () => true,
    secoes,
  } = {}) {
    /* Campos de fora das seções da moldura (outra tela, o legado): não marcam a página. */
    document.body.innerHTML = `
    <input id="buscaDeAcessos" type="search" />
    <div class="form-row"><label>Outro</label><input id="campoSolto" /></div>`;
    alertar = vi.fn();
    recarregar = vi.fn();
    const estado = criarEstadoDasConfiguracoes({
      supabase: () => cliente,
      confirmar,
      alertar,
      recarregar,
    });
    await act(async () => {
      controlador = montarConfiguracoesNoTeste({ estado, secao, secoes });
    });
    await act(async () => estado.definirValoresCarregados(PUBLICADO));
    await esperar();
    return estado;
  }

  const $ = (id) => document.getElementById(id);
  const barra = () => document.querySelector(".config-barra");
  const salvar = () => document.querySelector(".config-barra__salvar");
  const sujo = () =>
    Boolean(document.querySelector(".config-cabecalho__pendente"));
  const tituloDoDialogo = () => $("configGovernanceTitle")?.textContent;
  const ctrlS = () => teclar(document, "s", { ctrlKey: true });

  /* Digita num campo que não é da tela React (busca de acessos, campo solto). */
  async function digitarForaDoReact(id, valor) {
    await act(async () => {
      const campo = $(id);
      campo.value = valor;
      campo.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  beforeEach(() => {
    cliente = {
      rpc: vi.fn(async (nome) => ({
        data: nome === "get_configuracoes_historico" ? [] : snapshotIgual(),
        error: null,
      })),
    };
  });
  afterEach(async () => {
    await act(async () => controlador?.raiz?.unmount());
    controlador = null;
    document.body.innerHTML = "";
  });

  describe("cabeçalho da seção", () => {
    it("mostra só o nome da seção aberta, sem descrição nem cabeçalho repetido", async () => {
      await montar();
      const cabecalho = document.querySelector(".config-cabecalho");
      expect(cabecalho.querySelector("h2").textContent).toBe("Marca");
      expect(cabecalho.querySelector("p")).toBeNull();
      expect(cabecalho.textContent).not.toContain(
        "Nomes, versão e identidade que aparecem em todo o sistema.",
      );
      expect(document.body.textContent).not.toContain("Ajustes do sistema");
      expect(document.querySelector(".config-secao__cabecalho")).toBeNull();
      // O mesmo ícone do item no menu lateral.
      expect(
        cabecalho.querySelector(".config-cabecalho__icone svg").dataset.icone,
      ).toBe("type");
    });

    it("acompanha a troca de seção", async () => {
      await montar();
      await act(async () => abrirSecaoNoTeste("operacao"));
      expect(document.querySelector(".config-cabecalho h2").textContent).toBe(
        "Operação",
      );
    });
  });

  describe("barra fixa", () => {
    it("o ícone da situação é um tile próprio, fora do texto", async () => {
      await montar();
      const icone = document.querySelector(".config-barra__icone");
      expect(icone.classList).toContain("config-barra__icone--limpo");
      expect(icone.closest(".config-barra__texto")).toBeNull();
      expect(icone.querySelector("svg").dataset.icone).toBe("circle-check");
      expect(barra().textContent).toContain("Nenhuma alteração pendente");
    });
  });

  describe("controle de 'não salvo'", () => {
    it("só os campos das seções marcam a página", async () => {
      await montar();
      await digitarForaDoReact("buscaDeAcessos", "ana");
      await digitarForaDoReact("campoSolto", "x");
      expect(sujo()).toBe(false);
      expect(salvar().disabled).toBe(true);
      await digitar($("configInicio-pageTitle"), "Novo título");
      expect(sujo()).toBe(true);
      expect(salvar().disabled).toBe(false);
      expect(
        document.querySelector(".config-barra__icone svg").dataset.icone,
      ).toBe("pencil");
    });

    it("um campo da Marca marca a página; voltar ao valor publicado desmarca", async () => {
      await montar();
      const nome = $("configMarca-cogipNome");
      expect(nome.value).toBe("COGIP");
      await digitar(nome, "Equipe nova");
      expect(sujo()).toBe(true);
      await digitar(nome, "COGIP");
      expect(sujo()).toBe(false);
    });

    it("sair com alteração pergunta; recusado, fica; aceito, descarta", async () => {
      const estado = await montar();
      expect(estado.confirmarSaida(() => false)).toBe(true);
      await digitar($("configMarca-footerText"), "Outro rodapé");
      expect(estado.confirmarSaida(() => false)).toBe(false);
      expect(sujo()).toBe(true);
      await act(async () =>
        expect(estado.confirmarSaida(() => true)).toBe(true),
      );
      expect(sujo()).toBe(false);
      expect($("configMarca-footerText").value).toBe("AgSUS");
    });
  });

  describe("seção Acessos", () => {
    it("a barra fixa some e o Ctrl+S não publica Configurações", async () => {
      await montar({ secao: "acessos" });
      expect(barra()).toBeNull();
      await digitar($("configInicio-pageTitle"), "Mudou em outra seção");
      cliente.rpc.mockClear();
      await ctrlS();
      expect(cliente.rpc).not.toHaveBeenCalled();
      expect(tituloDoDialogo()).toBeUndefined();
    });

    it("fora de Acessos, o Ctrl+S abre a revisão", async () => {
      await montar();
      expect(barra()).not.toBeNull();
      await digitar($("configInicio-pageTitle"), "Título novo");
      await ctrlS();
      await esperar();
      expect(tituloDoDialogo()).toBe("Revisar publicação");
    });
  });

  /*
  A barra fixa só nas seções com campos que ela publica. Em Status das
  atualizações (só acompanhamento) e em Automação aparecia "Salvar
  alterações" sem nada a salvar (11/11/2026).
*/
  describe("barra fixa só nas seções com campos", () => {
    const COM_CAMPOS = [
      "marca",
      "inicio",
      "acesso",
      "aparencia",
      "recursos",
      "comemoracoes",
      "operacao",
    ];
    const SEM_CAMPOS = ["acessos", "modulos", "cargas", "automacao"];
    // As telas próprias, falsas: o que importa aqui é a moldura.
    const TELAS_PROPRIAS = Object.fromEntries(
      SEM_CAMPOS.map((secao) => [
        `secao:${secao}`,
        { render: vi.fn(), confirmarSaida: () => true },
      ]),
    );

    it("aparece em cada seção da moldura e some nas telas sem campo da barra", async () => {
      await montar({ secoes: TELAS_PROPRIAS });
      for (const secao of [...COM_CAMPOS, ...SEM_CAMPOS]) {
        await act(async () => abrirSecaoNoTeste(secao));
        await esperar();
        expect({ secao, barra: Boolean(barra()) }).toEqual({
          secao,
          barra: COM_CAMPOS.includes(secao),
        });
      }
    });

    it("Status das atualizações: sem barra, sem “Alterações não salvas” e o Ctrl+S não publica", async () => {
      const estado = await montar({ secoes: TELAS_PROPRIAS });
      await digitar($("configMarca-cogipNome"), "Equipe nova");
      expect(sujo()).toBe(true);
      await act(async () => abrirSecaoNoTeste("cargas"));
      await esperar();
      expect(document.querySelector(".config-cabecalho h2").textContent).toBe(
        "Status das atualizações",
      );
      expect(barra()).toBeNull();
      expect(document.body.textContent).not.toContain("Salvar alterações");
      expect(sujo()).toBe(false);
      cliente.rpc.mockClear();
      await ctrlS();
      expect(cliente.rpc).not.toHaveBeenCalled();
      expect(tituloDoDialogo()).toBeUndefined();
      // A alteração da Marca continua guardada para quando voltar.
      expect(estado.temAlteracoes()).toBe(true);
    });
  });

  describe("revisão da publicação", () => {
    it("sem mudança real, nada a publicar (lê `configuracoes` do snapshot)", async () => {
      const estado = await montar();
      await esperar(() => estado.revisar());
      expect(tituloDoDialogo()).toBe("Nenhuma alteração");
    });

    it("uma mudança da Marca aparece sozinha, com o valor de antes", async () => {
      await montar();
      await digitar($("configMarca-cogipNome"), "Equipe nova");
      await clicar(salvar());
      await esperar();
      const linhas = document.querySelectorAll(".config-change-row");
      expect(linhas).toHaveLength(1);
      expect(linhas[0].textContent).toContain("COGIP");
      expect(linhas[0].textContent).toContain("Equipe nova");
    });

    it("URL inválida no logo da equipe: não publica e aponta o campo", async () => {
      await montar();
      await digitar($("configMarca-cogipLogoUrl"), "javascript:alert(1)");
      cliente.rpc.mockClear();
      await clicar(salvar());
      expect(cliente.rpc).not.toHaveBeenCalled();
      expect(tituloDoDialogo()).toBe("Corrigir configurações");
      expect($("configMarca-cogipLogoUrl").getAttribute("aria-invalid")).toBe(
        "true",
      );
      expect(
        document.querySelector(".config-validation-summary"),
      ).not.toBeNull();
    });

    it("publica a Marca e os campos legados numa chamada, com motivo", async () => {
      await montar();
      await digitar($("configMarca-cogipNome"), "Equipe nova");
      await clicar(salvar());
      await esperar();
      cliente.rpc.mockResolvedValue({
        data: { ok: true, total_alteracoes: 1 },
        error: null,
      });
      // Sem motivo, não envia.
      await clicar(
        [...document.querySelectorAll(".config-governance-footer .btn")].at(-1),
      );
      expect(cliente.rpc).not.toHaveBeenCalledWith(
        "salvar_configuracoes_e_paineis_v2",
        expect.anything(),
      );
      await digitar($("configPublishReason"), "Troca da equipe");
      await clicar(
        [...document.querySelectorAll(".config-governance-footer .btn")].at(-1),
      );
      await esperar();
      const chamada = cliente.rpc.mock.calls.find(
        ([nome]) => nome === "salvar_configuracoes_e_paineis_v2",
      );
      expect(chamada[1].p_motivo).toBe("Troca da equipe");
      const linhas = new Map(
        chamada[1].p_config_rows.map((l) => [l.chave, l.valor]),
      );
      expect(linhas.get("cogip_nome")).toBe("Equipe nova");
      // Só o que mudou vai: as outras chaves ficam como estão no banco.
      expect(linhas.has("page_title")).toBe(false);
      expect(alertar).toHaveBeenCalled();
      expect(recarregar).toHaveBeenCalled();
    });
  });

  describe("falha de rede", () => {
    it("ao preparar: mensagem clara e o botão volta a 'Salvar alterações'", async () => {
      await montar();
      await digitar($("configInicio-pageTitle"), "Título novo");
      cliente.rpc.mockRejectedValue(new TypeError("Failed to fetch"));
      await clicar(salvar());
      await esperar();
      expect(
        document.querySelector(".config-governance-body").textContent,
      ).toContain(SEM_SERVIDOR);
      expect(salvar().textContent).toContain("Salvar alterações");
      expect(salvar().disabled).toBe(false);
    });

    it("ao publicar: erro no diálogo e 'Tentar novamente' habilitado", async () => {
      await montar();
      await digitar($("configInicio-pageTitle"), "Título novo");
      await clicar(salvar());
      await esperar();
      cliente.rpc.mockResolvedValue({
        data: null,
        error: { message: "TypeError: Failed to fetch" },
      });
      await digitar($("configPublishReason"), "Ajuste");
      const publicar = () =>
        [...document.querySelectorAll(".config-governance-footer .btn")].at(-1);
      await clicar(publicar());
      await esperar();
      expect(
        document.querySelector(".config-governance-body").textContent,
      ).toContain(SEM_SERVIDOR);
      expect(publicar().disabled).toBe(false);
      expect(publicar().textContent).toContain("Tentar novamente");
      expect(sujo()).toBe(true);
      expect(recarregar).not.toHaveBeenCalled();
    });

    it("histórico e restauração: mensagem clara, sem 'Carregando…' nem botão preso", async () => {
      cliente.rpc.mockImplementation(async (nome) =>
        nome === "get_configuracoes_historico"
          ? {
              data: [
                {
                  id: "v1",
                  acao: "salvar",
                  motivo: "m",
                  alteracoes: [],
                  total_alteracoes: 1,
                },
              ],
              error: null,
            }
          : { data: snapshotIgual(), error: null },
      );
      await montar({ secao: "operacao" });
      await esperar();
      cliente.rpc.mockRejectedValue(new TypeError("Failed to fetch"));
      const cartao = $("configHistoryCard");
      await clicar(
        [...cartao.querySelectorAll(".btn")].find((b) =>
          b.textContent.includes("Restaurar"),
        ),
      );
      await digitar($("configRestoreReason"), "Voltar");
      const restaurar = () =>
        [...document.querySelectorAll(".config-governance-footer .btn")].at(-1);
      await clicar(restaurar());
      await esperar();
      expect(
        document.querySelector(".config-governance-body").textContent,
      ).toContain(SEM_SERVIDOR);
      expect(restaurar().disabled).toBe(false);

      await clicar(document.querySelector('[aria-label="Fechar"]'));
      await clicar(
        [...cartao.querySelectorAll(".btn")].find((b) =>
          b.textContent.includes("Atualizar"),
        ),
      );
      await esperar();
      expect(cartao.textContent).toContain(SEM_SERVIDOR);
      expect(cartao.textContent).not.toContain("Carregando");
    });
  });

  describe("histórico de configurações", () => {
    it("fica na seção Operação", async () => {
      await montar({ secao: "operacao" });
      const cartao = $("configHistoryCard");
      expect(
        cartao.closest('.config-secao[data-secao="operacao"]'),
      ).toBeTruthy();
    });
  });
});

bloco("modulos/mapa-saude-indigena", () => {
  /*
  O mapa da Saúde Indígena em React (src/modulos/mapa-saude-indigena/), com o
  Leaflet falso: visão nacional (bolhas, CASAIs nacionais, Territórios por
  vagas, legenda, tela cheia), o mapa do DSEI (unidades, filtros por
  tipo, vínculos externos, Terras Indígenas), o contrato com o pai (eventos
  e DSEI controlado), StrictMode limpo, tema e conteúdo sem HTML.
*/

  const LMAP = {
    dsei: [
      {
        k: "ALAGOAS E SERGIPE",
        n: "Alagoas e Sergipe",
        lat: -9.6,
        lon: -35.7,
        pop: 12000,
        sedeuf: "AL",
        ufs: ["AL", "SE"],
        // Os pontos do SIGEPSI (aplicarLocalizacoes): polos, CASAI e lotação.
        polos: [
          { n: "XITEI", lat: -9.9, lon: -36.0, uf: "AL", tipo: "polo" },
          { n: "LONGE", lat: -8.0, lon: -35.0, uf: "PE", tipo: "polo" },
          {
            n: "CASAI AL/SE",
            lat: -9.62,
            lon: -35.73,
            uf: "AL",
            tipo: "casai",
            municipio: "MACEIO",
          },
          {
            n: "UBSI <img src=x onerror=alert(1)>",
            lat: -10.1,
            lon: -36.4,
            uf: "AL",
            tipo: "unidade",
            municipio: "PORTO REAL",
          },
        ],
      },
      {
        k: "YANOMAMI",
        n: "Yanomami",
        lat: 2.81,
        lon: -60.67,
        pop: 30000,
        sedeuf: "RR",
        ufs: ["RR", "AM"],
        polos: [],
      },
      {
        k: "LESTE DE RORAIMA",
        n: "Leste de Roraima",
        lat: 2.82,
        lon: -60.67,
        pop: 50000,
        sedeuf: "RR",
        ufs: ["RR"],
        polos: [],
      },
    ],
  };

  /* As CASAIs nacionais do SIGEPSI (localização 131). */
  const CASAIS = [["CASAI DF", "131", -15.8, -47.9, "BRASILIA", "DF"]];

  const LINHAS = [
    {
      unidade: "DSEI Alagoas e Sergipe",
      vagas_total: 10,
      contratados: 9,
      status: "Concluído",
    },
    {
      unidade: "DSEI Yanomami",
      vagas_total: 40,
      contratados: 10,
      status: "Concluído",
    },
  ];

  let raiz = null;
  let host = null;
  let leaflet = null;

  function Pai(props) {
    return createElement(
      StrictMode,
      null,
      createElement(MapaSaudeIndigena, {
        lmap: LMAP,
        casaisNacionais: CASAIS,
        linhas: LINHAS,
        ...props,
      }),
    );
  }

  async function montar(props = {}) {
    host = document.createElement("div");
    document.body.append(host);
    raiz = createRoot(host);
    await act(async () => raiz.render(createElement(Pai, props)));
    return host;
  }

  async function rerender(props) {
    await act(async () => raiz.render(createElement(Pai, props)));
  }

  /* As bolhas dos DSEIs (sem os pontinhos do leque, que não recebem clique). */
  const bolhas = (mapa) =>
    leaflet
      .desenhadas(mapa, "circleMarker")
      .filter((b) => b.opcoes.interactive !== false);

  const mapaVivo = (id) =>
    leaflet.vivos().find((m) => m.elemento.id === id) || null;

  beforeEach(() => {
    leaflet = criarLeafletFalso();
    globalThis.L = leaflet.L;
  });

  afterEach(async () => {
    if (raiz) await act(async () => raiz.unmount());
    raiz = null;
    host?.remove();
    host = null;
    delete globalThis.L;
    delete window.matchMedia;
    document.documentElement.removeAttribute("data-theme");
    vi.restoreAllMocks();
  });

  describe("visão nacional", () => {
    it("cria um mapa só no #map, mesmo com o StrictMode desfazendo e refazendo", async () => {
      await montar();
      expect(leaflet.vivos()).toHaveLength(1);
      expect(leaflet.mapas.length).toBeGreaterThanOrEqual(1);
      expect(leaflet.mapas.filter((m) => m.removido)).toHaveLength(
        leaflet.mapas.length - 1,
      );
      const mapa = mapaVivo("map");
      expect(mapa).not.toBeNull();
      expect(host.querySelectorAll("#map")).toHaveLength(1);
      expect(host.querySelector("#detailMap")).toBeNull();
    });

    it("desenha uma bolha por DSEI e o losango da CASAI nacional", async () => {
      await montar();
      const mapa = mapaVivo("map");
      expect(bolhas(mapa)).toHaveLength(3);
      const casais = leaflet.desenhadas(mapa, "marker");
      expect(casais).toHaveLength(1);
      expect(casais[0].opcoes.title).toBe("CASAI DF");
      expect(casais[0].popup.textContent).toContain(
        "Casa de Saúde Indígena (referência nacional)",
      );
    });

    it("Territórios por vagas: ordem por vagas, contagem e clique que escolhe o DSEI", async () => {
      const aoEscolherDsei = vi.fn();
      await montar({ aoEscolherDsei });
      const itens = [...host.querySelectorAll(".mapa-si-territorio")];
      expect(itens.map((b) => b.querySelector("strong").textContent)).toEqual([
        "Yanomami",
        "Alagoas e Sergipe",
        "Leste de Roraima",
      ]);
      expect(itens[0].getAttribute("aria-label")).toBe(
        "Abrir o DSEI Yanomami: 40 vagas, 25% preenchidas",
      );
      expect(host.textContent).toContain("3 DSEIs · 1 CASAI");
      await clicar(itens[1]);
      expect(aoEscolherDsei).toHaveBeenCalledWith(LMAP.dsei[0]);
    });

    it("clicar na bolha escolhe o DSEI; na CASAI nacional, filtra pela busca", async () => {
      const aoEscolherDsei = vi.fn();
      const aoFiltrarPorBusca = vi.fn();
      await montar({ aoEscolherDsei, aoFiltrarPorBusca });
      const mapa = mapaVivo("map");
      const bolha = bolhas(mapa).find((b) => b.latlng[0] === -9.6);
      await act(async () => bolha.fire("click"));
      expect(aoEscolherDsei).toHaveBeenCalledTimes(1);
      const [casai] = leaflet.desenhadas(mapa, "marker");
      await act(async () => casai.fire("click"));
      expect(aoFiltrarPorBusca).toHaveBeenCalledWith("CASAI BRASILIA");
    });

    it("sedes no mesmo pixel abrem em leque, com traço até o ponto real", async () => {
      await montar();
      const mapa = mapaVivo("map");
      const roraima = leaflet
        .desenhadas(mapa, "circleMarker")
        .filter((b) => b.opcoes.radius && Math.abs(b.latlng[1] + 60.67) < 2);
      expect(roraima.length).toBeGreaterThanOrEqual(2);
      expect(
        roraima.some((b) => b.latlng[0] !== 2.81 && b.latlng[0] !== 2.82),
      ).toBe(true);
      expect(
        leaflet.desenhadas(mapa, "polyline").length,
      ).toBeGreaterThanOrEqual(2);
      expect(mapa.ouvintes("zoomend")).toBeGreaterThanOrEqual(1);
    });

    it("com filtro ativo, só os DSEIs do recorte e o mapa enquadra neles", async () => {
      await montar({
        filtroAtivo: true,
        linhas: [
          {
            unidade: "DSEI Yanomami",
            vagas_total: 4,
            contratados: 4,
            status: "Concluído",
          },
        ],
      });
      const mapa = mapaVivo("map");
      expect(bolhas(mapa)).toHaveLength(1);
      expect(leaflet.desenhadas(mapa, "marker")).toHaveLength(0);
      expect(
        mapa.chamadas.some(([nome, , z]) => nome === "setView" && z === 7),
      ).toBe(true);
      expect(host.textContent).toContain("1 DSEI");
    });

    it("sem modo Calor: a bolha é verde com processo e azul sem, e a legenda diz isso", async () => {
      await montar();
      const textos = [...host.querySelectorAll("button")].map(
        (b) => b.textContent,
      );
      expect(textos).not.toContain("Calor");
      const mapa = mapaVivo("map");
      const cores = new Set(bolhas(mapa).map((b) => b.opcoes.fillColor));
      expect([...cores].sort()).toEqual(
        [
          CORES_DO_MAPA.comEdital.preenchimento,
          CORES_DO_MAPA.semEdital.preenchimento,
        ].sort(),
      );
      await clicar(host.querySelector(".mapa-si-legenda__alternar"));
      const legenda = host.querySelector(".mapa-si-legenda").textContent;
      expect(legenda).toContain("DSEI com processo ativo");
      expect(legenda).not.toContain("ociosas");
    });

    it("Brasil volta à vista do país", async () => {
      await montar();
      const mapa = mapaVivo("map");
      const antes = mapa.chamadas.length;
      await clicar(
        [...host.querySelectorAll("button")].find(
          (b) => b.textContent === "Brasil",
        ),
      );
      // O remedir do requestAnimationFrame pode cair no meio (suíte carregada).
      expect(
        mapa.chamadas
          .slice(antes)
          .map(([n]) => n)
          .filter((n) => n !== "invalidateSize"),
      ).toEqual(["stop", "fitBounds"]);
    });

    it("a legenda começa recolhida, também no computador, e abre no botão", async () => {
      // Aberta, ela tapava parte do Sul e do Sudeste no enquadramento do Brasil.
      await montar();
      const alternar = host.querySelector(".mapa-si-legenda__alternar");
      expect(window.innerWidth).toBeGreaterThanOrEqual(1024);
      expect(alternar.getAttribute("aria-expanded")).toBe("false");
      expect(host.querySelector(".mapa-si-legenda__corpo").hidden).toBe(true);
      await clicar(alternar);
      expect(alternar.getAttribute("aria-expanded")).toBe("true");
    });

    it("dica da bolha só com ponteiro que flutua, e sem HTML", async () => {
      window.matchMedia = () => ({ matches: true });
      await montar();
      const mapa = mapaVivo("map");
      const bolha = leaflet
        .desenhadas(mapa, "circleMarker")
        .find((b) => b.dica?.textContent.includes("Alagoas"));
      expect(bolha.dica.textContent).toContain("Polos base: 2");
      expect(bolha.dica.textContent).toContain("No mapa:");
    });

    it("sem o Leaflet (offline), avisa e a lista continua", async () => {
      delete globalThis.L;
      await montar();
      expect(host.textContent).toContain("Mapa indisponível sem conexão");
      expect(host.querySelectorAll(".mapa-si-territorio")).toHaveLength(3);
    });

    it("tela cheia liga e o Esc desliga", async () => {
      await montar();
      const botao = [...host.querySelectorAll("button")].find(
        (b) => b.textContent === "Tela cheia",
      );
      await clicar(botao);
      expect(host.querySelector(".mapa-si--tela-cheia")).not.toBeNull();
      expect(botao.textContent).toBe("Sair da tela cheia");
      expect(document.body.style.overflow).toBe("hidden");
      await teclar(document, "Escape");
      expect(host.querySelector(".mapa-si--tela-cheia")).toBeNull();
      expect(document.body.style.overflow).toBe("");
    });

    it("é a página da aba Mapa: não se recolhe, nem com a escolha guardada do de Projetos", async () => {
      localStorage.setItem("agsus_yeende_mapa_recolhido_v1", "recolhido");
      await montar();
      const textos = [...host.querySelectorAll("button")].map(
        (b) => b.textContent,
      );
      expect(textos).not.toContain("Recolher mapa");
      expect(textos).not.toContain("Mostrar mapa");
      expect(textos).toContain("Tela cheia");
      expect(host.querySelector(".mapa-si--recolhido")).toBeNull();
      localStorage.removeItem("agsus_yeende_mapa_recolhido_v1");
    });

    it("restaura a rolagem anterior ao desmontar em tela cheia", async () => {
      document.body.style.overflow = "auto";
      await montar();
      await clicar(
        [...host.querySelectorAll("button")].find(
          (b) => b.textContent === "Tela cheia",
        ),
      );
      await act(async () => raiz.unmount());
      raiz = null;
      expect(document.body.style.overflow).toBe("auto");
      document.body.style.overflow = "";
    });
  });

  /*
  O enquadramento nacional acompanha o tamanho do contêiner (tela cheia,
  barra lateral, janela) até a pessoa mexer no mapa; "Brasil" volta a
  acompanhar. ResizeObserver e medidas falsos: o jsdom não tem layout.
*/
  describe("enquadramento e tamanho do contêiner", () => {
    let observadores;
    let medida;
    const originais = {};

    beforeEach(() => {
      observadores = [];
      medida = { largura: 870, altura: 600 };
      originais.ResizeObserver = globalThis.ResizeObserver;
      originais.raf = globalThis.requestAnimationFrame;
      globalThis.ResizeObserver = class {
        constructor(aoMudar) {
          this.aoMudar = aoMudar;
          observadores.push(this);
        }
        observe() {}
        disconnect() {}
      };
      globalThis.requestAnimationFrame = (fn) => {
        fn();
        return 1;
      };
      for (const [prop, chave] of [
        ["offsetWidth", "largura"],
        ["offsetHeight", "altura"],
      ])
        Object.defineProperty(HTMLElement.prototype, prop, {
          configurable: true,
          get: () => medida[chave],
        });
    });

    afterEach(() => {
      globalThis.ResizeObserver = originais.ResizeObserver;
      globalThis.requestAnimationFrame = originais.raf;
      delete HTMLElement.prototype.offsetWidth;
      delete HTMLElement.prototype.offsetHeight;
    });

    const enquadramentos = (mapa) =>
      mapa.chamadas.filter(([nome]) => nome === "fitBounds");

    async function redimensionar(largura, altura) {
      medida = { largura, altura };
      await act(async () => observadores.forEach((o) => o.aoMudar([])));
    }

    it("o Brasil é enquadrado com folga para a maior bolha (padding >= raio + 12)", async () => {
      await montar();
      const [, , opcoes] = enquadramentos(mapaVivo("map"))[0];
      expect(opcoes.padding[0]).toBeGreaterThanOrEqual(15 + 12);
      expect(opcoes.padding[1]).toBeGreaterThanOrEqual(15 + 12);
    });

    it("reenquadra ao mudar de tamanho (e ao sair da tela cheia) até a pessoa mexer", async () => {
      await montar();
      const mapa = mapaVivo("map");
      mapa.chamadas.length = 0;
      await redimensionar(1170, 600);
      expect(enquadramentos(mapa)).toHaveLength(1);
      mapa.elemento.dispatchEvent(new Event("wheel"));
      mapa.chamadas.length = 0;
      await redimensionar(870, 600);
      expect(enquadramentos(mapa)).toHaveLength(0);
      await clicar(
        [...host.querySelectorAll("button")].find(
          (b) => b.textContent === "Brasil",
        ),
      );
      mapa.chamadas.length = 0;
      await redimensionar(1170, 600);
      expect(enquadramentos(mapa)).toHaveLength(1);
    });
  });

  describe("mapa do DSEI", () => {
    async function abrirAlse(props = {}) {
      await montar({ dseiSelecionado: "ALAGOAS E SERGIPE", ...props });
      return mapaVivo("detailMap");
    }

    it("mostra os processos seletivos do DSEI e abre a Visão geral nas unidades dele", async () => {
      const aoAbrirNaVisaoGeral = vi.fn();
      await abrirAlse({ aoAbrirNaVisaoGeral });
      const cartao = host.querySelector(".mapa-si-processos");
      expect(cartao).not.toBeNull();
      const numeros = Object.fromEntries(
        [...cartao.querySelectorAll("dl > div")].map((d) => [
          d.querySelector("dt").textContent,
          d.querySelector("dd").textContent,
        ]),
      );
      expect(numeros).toEqual({
        "Editais abertos": "0",
        Vagas: "10",
        Contratadas: "9",
        // Nenhum edital sem resultado: não se aplica, não zero.
        "Em seleção": "—",
        Ociosas: "1",
        "Aguardando chamada": "—",
      });
      await act(async () =>
        [...cartao.querySelectorAll("button")]
          .find((b) => b.textContent === "Abrir na Visão geral")
          .click(),
      );
      expect(aoAbrirNaVisaoGeral).toHaveBeenCalledWith([
        "DSEI Alagoas e Sergipe",
      ]);
    });

    it("o seletor tem as CASAIs nacionais num grupo próprio", async () => {
      const aoEscolherCasai = vi.fn();
      await montar({ aoEscolherCasai });
      const seletor = host.querySelector(".mapa-si-resumo__seletor select");
      expect(
        host.querySelector(".mapa-si-resumo__seletor span").textContent,
      ).toBe("DSEI / CASAI");
      const grupo = seletor.querySelector('optgroup[label="CASAIs nacionais"]');
      expect(
        [...grupo.querySelectorAll("option")].map((o) => o.textContent),
      ).toEqual(["CASAI DF"]);
      await escolher(seletor, grupo.querySelector("option").value);
      expect(aoEscolherCasai).toHaveBeenCalledWith(
        expect.objectContaining({ nome: "CASAI DF", cidade: "BRASILIA" }),
      );
    });

    it("a CASAI aberta enquadra nela e mostra município, UF e os processos dela", async () => {
      const aoSairDoDsei = vi.fn();
      await montar({
        casaiSelecionada: "DF",
        aoSairDoDsei,
        linhas: [
          ...LINHAS,
          {
            unidade: "CASAI Brasília",
            vagas_total: 4,
            contratados: 1,
            status: "Concluído",
          },
        ],
      });
      const painel = host.querySelector(".mapa-si-casai");
      expect(painel.querySelector("h2").textContent).toBe("CASAI DF");
      expect(painel.textContent).toContain("BRASILIA · DF");
      const processos = host.querySelector(".mapa-si-processos");
      const numeros = Object.fromEntries(
        [...processos.querySelectorAll("dl > div")].map((d) => [
          d.querySelector("dt").textContent,
          d.querySelector("dd").textContent,
        ]),
      );
      expect(numeros).toMatchObject({
        Vagas: "4",
        Contratadas: "1",
        Ociosas: "3",
      });
      expect(
        host.querySelector(".mapa-si-resumo__seletor select").value,
      ).toMatch(/^casai:/);
      const mapa = mapaVivo("map");
      expect(
        mapa.chamadas.some(([nome, , z]) => nome === "setView" && z === 7),
      ).toBe(true);
      await act(async () =>
        [...painel.querySelectorAll("button")]
          .find((b) => b.textContent.includes("Voltar ao Brasil"))
          .click(),
      );
      expect(aoSairDoDsei).toHaveBeenCalled();
    });

    describe("território, acesso e CNES do SIGEPSI", () => {
      const fonte = (dados) => ({ ok: true, dados, linhas: 1, campos: [] });
      /* O acesso vem nos pontos (a /todas): XITEI e LONGE com acesso. */
      const ACESSO = {
        XITEI: {
          meios: ["Terrestre", "Fluvial"],
          acessibilidade: "Remoto",
          localidade: "Rural",
          floresta: "Sim",
        },
        LONGE: {
          meios: ["Aéreo"],
          acessibilidade: "Muito remoto",
          localidade: "Rural",
          floresta: "Não",
        },
      };
      const LMAP_COM_ACESSO = {
        dsei: LMAP.dsei.map((d) => ({
          ...d,
          polos: d.polos.map((p) => ({
            ...p,
            ...(ACESSO[p.n] || {
              meios: ["Não informado"],
              acessibilidade: "Não informado",
              localidade: "Não informado",
              floresta: "Não informado",
            }),
          })),
        })),
      };
      const PRONTO = {
        estado: "pronto",
        resposta: {
          territorio: fonte({
            "ALAGOAS SERGIPE": {
              nome: "DSEI ALAGOAS E SERGIPE",
              populacao: 12000,
              aldeias: 40,
              terras: 2,
              listaDeTerras: [],
            },
          }),
          cnes: fonte([
            {
              dsei: "ALAGOAS SERGIPE",
              nome: "Polo Base Xitei",
              cnes: "1234567",
              uf: "AL",
              municipio: "",
              lat: null,
              lon: null,
            },
          ]),
        },
      };
      const numerosDe = (cartao) =>
        Object.fromEntries(
          [...cartao.querySelectorAll("dl > div")].map((d) => [
            d.querySelector("dt").textContent,
            d.querySelector("dd").textContent,
          ]),
        );

      it("o DSEI mostra o território, o acesso e o CNES das unidades", async () => {
        await abrirAlse({ territorio: PRONTO, lmap: LMAP_COM_ACESSO });
        expect(
          numerosDe(host.querySelector(".mapa-si-territorio-do-dsei")),
        ).toEqual({
          "População indígena": "12.000",
          Aldeias: "40",
          "Terras indígenas": "2",
        });
        // Na lista lateral, o meio de acesso e o CNES.
        expect(
          [...host.querySelectorAll(".mapa-si-unidade__acesso")].map(
            (e) => e.textContent,
          ),
        ).toContain("Terrestre, Fluvial · CNES 1234567");
        const tabela = host.querySelector(".mapa-si-unidades__tabela");
        expect(tabela.textContent).toContain("1234567");
        expect(
          host.querySelector('.mapa-si-unidades [data-acao="exportar-excel"]'),
        ).not.toBeNull();
      });

      it("os filtros de acesso e floresta recortam a tabela", async () => {
        await abrirAlse({ territorio: PRONTO, lmap: LMAP_COM_ACESSO });
        const [meio, floresta] = host.querySelectorAll(
          ".mapa-si-filtros-de-acesso select",
        );
        await escolher(meio, "Aéreo");
        const linhas = () =>
          [...host.querySelectorAll(".mapa-si-unidades__tabela tbody tr")].map(
            (tr) => tr.querySelector("td").textContent,
          );
        expect(linhas()).toEqual(["LONGE"]);
        await escolher(floresta, "Sim");
        expect(linhas()).toEqual([]);
      });

      it("fonte negada diz que o dado está indisponível, nunca zero", async () => {
        await abrirAlse({
          territorio: {
            estado: "pronto",
            resposta: {
              ...PRONTO.resposta,
              territorio: {
                ok: false,
                status: 403,
                motivo: "a chave do Yeendé não lê esta rota",
              },
              cnes: {
                ok: false,
                status: 401,
                motivo: "a chave do Yeendé não lê esta rota",
              },
            },
          },
        });
        const cartao = host.querySelector(".mapa-si-territorio-do-dsei");
        expect(cartao.textContent).toContain("Dado do SIGEPSI indisponível");
        expect(cartao.querySelector("dl")).toBeNull();
        expect(host.querySelector(".mapa-si-unidades").textContent).toContain(
          "CNES: Dado do SIGEPSI indisponível",
        );
      });

      it("no Brasil, os DSEIs com unidade no filtro ao lado das ociosas", async () => {
        const aoEscolherDsei = vi.fn();
        await montar({
          territorio: PRONTO,
          lmap: LMAP_COM_ACESSO,
          aoEscolherDsei,
        });
        const secao = [...host.querySelectorAll(".mapa-si-unidades")].find(
          (s) => s.textContent.includes("Acesso e vagas ociosas"),
        );
        expect(secao).toBeDefined();
        const linha = secao.querySelector("tbody tr");
        expect(
          [...linha.querySelectorAll("td")].map((td) => td.textContent),
        ).toEqual(["Alagoas e Sergipe", "4", "10", "1"]);
        await act(async () => linha.querySelector("button").click());
        expect(aoEscolherDsei).toHaveBeenCalledWith(LMAP_COM_ACESSO.dsei[0]);
      });

      it("o pedido inteiro falhando não derruba o mapa", async () => {
        await montar({
          territorio: { estado: "indisponivel", resposta: null },
        });
        expect(mapaVivo("map")).not.toBeNull();
        expect(host.textContent).toContain("Dado do SIGEPSI indisponível");
      });
    });

    it("sem DSEI aberto não há cartão de processos", async () => {
      await montar();
      expect(host.querySelector(".mapa-si-processos")).toBeNull();
    });

    it("com DSEI escolhido, o nacional some e o #detailMap mostra o território", async () => {
      const mapa = await abrirAlse();
      expect(mapa).not.toBeNull();
      expect(host.querySelector(".mapa-si-painel--nacional").hidden).toBe(true);
      expect(host.querySelector("h2#detailMap-titulo").textContent).toBe(
        "Mapa do DSEI Alagoas e Sergipe",
      );
      expect(leaflet.vivos()).toHaveLength(2);
    });

    it("unidades: sede em estrela, polo uma vez, UBSI sem HTML", async () => {
      const mapa = await abrirAlse();
      const marcadores = leaflet.desenhadas(mapa, "marker");
      const titulos = marcadores.map((m) => m.opcoes.title);
      expect(titulos).toContain("Sede do DSEI Alagoas e Sergipe");
      expect(titulos.filter((t) => t.includes("XITEI"))).toHaveLength(1);
      const ubsi = marcadores.find((m) => m.opcoes.title.startsWith("UBSI"));
      expect(ubsi.popup.querySelector("img")).toBeNull();
      expect(ubsi.popup.textContent).toContain("<img src=x onerror=alert(1)>");
      expect(ubsi.opcoes.icon.html.querySelector("svg")).not.toBeNull();
      const sede = marcadores.find((m) => m.opcoes.title.startsWith("Sede"));
      expect(sede.opcoes.zIndexOffset).toBe(400);
    });

    it("vínculo fora da área: chip, linha pontilhada e enquadramento completo", async () => {
      const mapa = await abrirAlse();
      expect(host.querySelector(".mapa-si-chip-externo").textContent).toBe(
        "1 vínculo fora da área",
      );
      const linhas = leaflet
        .desenhadas(mapa, "polyline")
        .filter((l) => l.opcoes.dashArray);
      expect(linhas).toHaveLength(1);
      const alternar = [...host.querySelectorAll("button")].find((b) =>
        b.textContent.includes("vínculos externos"),
      );
      const antes = mapa.chamadas.length;
      await clicar(alternar);
      expect(alternar.textContent).toBe("Voltar ao território");
      const [, caixa] = mapa.chamadas
        .slice(antes)
        .find(([nome]) => nome === "fitBounds");
      expect(caixa.pontos).toContainEqual([-8, -35]);
    });

    it("filtros por tipo escondem da lista e do mapa; lista vazia diz por quê", async () => {
      const mapa = await abrirAlse();
      const chips = [...host.querySelectorAll(".mapa-si-filtros button")];
      expect(chips.map((c) => c.textContent)).toEqual([
        "Polo base 2",
        "CASAI 1",
        "UBSI 1",
      ]);
      for (const chip of chips) await clicar(chip);
      expect(
        chips.every((c) => c.getAttribute("aria-pressed") === "false"),
      ).toBe(true);
      expect(host.textContent).toContain("Nada a mostrar com estes filtros.");
      const titulos = leaflet
        .desenhadas(mapa, "marker")
        .map((m) => m.opcoes.title);
      expect(titulos).toEqual(["Sede do DSEI Alagoas e Sergipe"]);
    });

    it("clicar na unidade leva o mapa até ela e avisa o pai", async () => {
      const aoEscolherUnidade = vi.fn();
      const mapa = await abrirAlse({ aoEscolherUnidade });
      const botao = [...host.querySelectorAll(".mapa-si-unidade")].find((b) =>
        b.textContent.includes("CASAI AL/SE"),
      );
      await clicar(botao);
      const voo = mapa.chamadas.find(([nome]) => nome === "flyTo");
      expect(voo[1]).toEqual([-9.62, -35.73]);
      expect(voo[2]).toBe(11);
      expect(aoEscolherUnidade).toHaveBeenCalledWith(
        expect.objectContaining({ name: "CASAI AL/SE" }),
      );
    });

    it("'Voltar ao Brasil' só aparece com um DSEI aberto, no topo do painel", async () => {
      await montar();
      expect(host.querySelector(".mapa-si-voltar")).toBeNull();
      await rerender({ dseiSelecionado: "ALAGOAS E SERGIPE" });
      const voltar = host.querySelector(".mapa-si-voltar");
      expect(voltar.textContent).toContain("Voltar ao Brasil");
      expect(voltar.closest(".mapa-si-painel__topo")).not.toBeNull();
    });

    it("'Voltar ao Brasil' pede a saída; o nacional voa do distrito ao Brasil e o foco volta à linha do DSEI", async () => {
      const aoSairDoDsei = vi.fn();
      await abrirAlse({ aoSairDoDsei });
      const nacional = mapaVivo("map");
      await clicar(host.querySelector(".mapa-si-voltar"));
      expect(aoSairDoDsei).toHaveBeenCalledTimes(1);
      nacional.chamadas.length = 0;
      await rerender({ dseiSelecionado: null, aoSairDoDsei });
      expect(mapaVivo("detailMap")).toBeNull();
      expect(host.querySelector(".mapa-si-painel--nacional").hidden).toBe(
        false,
      );
      const nomes = nacional.chamadas.map(([nome]) => nome);
      // Parte do distrito, sem animar, e voa até o país.
      const partida = nacional.chamadas.find(([nome]) => nome === "setView");
      expect(partida[1]).toEqual([-9.6, -35.7]);
      expect(partida[3]).toEqual({ animate: false });
      expect(nomes.indexOf("setView")).toBeLessThan(
        nomes.indexOf("flyToBounds"),
      );
      const [, , opcoes] = nacional.chamadas.find(
        ([nome]) => nome === "flyToBounds",
      );
      expect(opcoes.duration).toBe(0.8);
      expect(opcoes.maxZoom).toBe(4.5);
      expect(opcoes.padding[0]).toBeGreaterThanOrEqual(15 + 12);
      expect(nomes).not.toContain("fitBounds");
      expect(document.activeElement.dataset.dsei).toBe("ALAGOAS E SERGIPE");
    });

    it("Esc volta ao Brasil com o foco no mapa, mas não num campo de fora", async () => {
      const aoSairDoDsei = vi.fn();
      await abrirAlse({ aoSairDoDsei });
      const campo = document.createElement("input");
      document.body.append(campo);
      campo.focus();
      await teclar(campo, "Escape");
      expect(aoSairDoDsei).not.toHaveBeenCalled();
      campo.remove();
      host.querySelector(".mapa-si-voltar").focus();
      await teclar(document.activeElement, "Escape");
      expect(aoSairDoDsei).toHaveBeenCalledTimes(1);
      const nacional = mapaVivo("map");
      nacional.chamadas.length = 0;
      await rerender({ dseiSelecionado: null, aoSairDoDsei });
      expect(nacional.chamadas.some(([nome]) => nome === "flyToBounds")).toBe(
        true,
      );
      expect(document.activeElement.dataset.dsei).toBe("ALAGOAS E SERGIPE");
      // Sem DSEI, o Esc não pede nada.
      await teclar(document, "Escape");
      expect(aoSairDoDsei).toHaveBeenCalledTimes(1);
    });

    it("na tela cheia, o 1º Esc volta ao Brasil e o 2º sai da tela cheia", async () => {
      const aoSairDoDsei = vi.fn();
      await abrirAlse({ aoSairDoDsei });
      await clicar(
        [...host.querySelectorAll("button")].find(
          (b) => b.textContent === "Tela cheia",
        ),
      );
      // A tecla nasce no elemento com foco (aqui, nenhum: o body) e, como no
      // navegador, pode ser cancelada.
      const esc = () => teclar(document.body, "Escape", { cancelable: true });
      await esc();
      expect(aoSairDoDsei).toHaveBeenCalledTimes(1);
      expect(host.querySelector(".mapa-si--tela-cheia")).not.toBeNull();
      await rerender({ dseiSelecionado: null, aoSairDoDsei });
      expect(host.querySelector(".mapa-si--tela-cheia")).not.toBeNull();
      await esc();
      expect(host.querySelector(".mapa-si--tela-cheia")).toBeNull();
      expect(aoSairDoDsei).toHaveBeenCalledTimes(1);
    });

    it("com menos movimento (prefers-reduced-motion), volta ao Brasil sem animação", async () => {
      window.matchMedia = (consulta) => ({
        matches: consulta.includes("prefers-reduced-motion"),
      });
      await abrirAlse();
      const nacional = mapaVivo("map");
      nacional.chamadas.length = 0;
      await rerender({ dseiSelecionado: null });
      const nomes = nacional.chamadas.map(([nome]) => nome);
      expect(nomes).not.toContain("flyToBounds");
      expect(nomes).not.toContain("flyTo");
      const [, , opcoes] = nacional.chamadas.find(
        ([nome]) => nome === "fitBounds",
      );
      expect(opcoes.animate).toBe(false);
    });

    it("o pai tirando o DSEI (chip da página) também voa, sem levar o foco", async () => {
      await abrirAlse();
      const nacional = mapaVivo("map");
      nacional.chamadas.length = 0;
      document.body.focus();
      await rerender({ dseiSelecionado: null });
      expect(nacional.chamadas.some(([nome]) => nome === "flyToBounds")).toBe(
        true,
      );
      expect(document.activeElement).toBe(document.body);
    });

    it("Terras Indígenas: recorte pela camada, lista, enquadrar e legenda das fases", async () => {
      const ocultas = new Set();
      leaflet = criarLeafletFalso({
        aoCriarMapa: (m) => {
          m.__agsusSetDseiCoverage = vi.fn();
          m.__agsusEnquadrarTerra = vi.fn();
          m.__agsusFaseDaTerraVisivel = (fase) => !ocultas.has(fase);
          m.__agsusAlternarFaseDaTerra = (fase) => {
            if (ocultas.has(fase)) ocultas.delete(fase);
            else ocultas.add(fase);
            m.fire(EVENTO_DAS_TERRAS);
          };
        },
      });
      globalThis.L = leaflet.L;
      const mapa = await abrirAlse();
      const [nome, pontos, ufs] = mapa.__agsusSetDseiCoverage.mock.calls[0];
      expect(nome).toBe("Alagoas e Sergipe");
      expect(pontos[0]).toEqual({ lat: -9.6, lon: -35.7 });
      expect(ufs).toEqual(["AL", "SE"]);

      await act(async () =>
        mapa.__agsusAoMudarTerras([
          {
            nome: "Xucuru-Kariri",
            povos: [],
            ufs: ["AL"],
            fase: "Regularizada",
            caixa: { oeste: -37, sul: -10, leste: -36, norte: -9 },
          },
        ]),
      );
      const terra = host.querySelector(".mapa-si-terra");
      expect(terra.textContent).toContain("povo não declarado pela Funai");
      await clicar(terra);
      expect(mapa.__agsusEnquadrarTerra).toHaveBeenCalledWith("Xucuru-Kariri", {
        oeste: -37,
        sul: -10,
        leste: -36,
        norte: -9,
      });

      const fase = host.querySelector(
        ".mapa-si-legenda--rodape .mapa-si-terra-fase",
      );
      expect(fase.getAttribute("aria-pressed")).toBe("true");
      await clicar(fase);
      expect(fase.getAttribute("aria-pressed")).toBe("false");
    });

    it("o nacional não enquadra escondido; ao voltar, enquadra com a medida nova", async () => {
      await montar({
        dseiSelecionado: "ALAGOAS E SERGIPE",
        filtroAtivo: true,
        linhas: [LINHAS[0]],
      });
      const nacional = mapaVivo("map");
      const antes = nacional.chamadas.length;
      expect(nacional.chamadas.some(([n]) => n === "setView")).toBe(false);
      await rerender({ dseiSelecionado: null });
      const depois = nacional.chamadas.slice(antes).map(([n]) => n);
      // Remede antes de partir do distrito e voar até o Brasil.
      expect(depois.indexOf("invalidateSize")).toBeGreaterThanOrEqual(0);
      expect(depois.indexOf("invalidateSize")).toBeLessThan(
        depois.indexOf("setView"),
      );
      expect(depois).toContain("flyToBounds");
    });

    it("desmontar remove os dois mapas", async () => {
      await abrirAlse();
      expect(leaflet.vivos()).toHaveLength(2);
      await act(async () => raiz.unmount());
      raiz = null;
      expect(leaflet.vivos()).toHaveLength(0);
    });
  });

  describe("tema", () => {
    it("segue o tema do app e aceita o tema forçado pelo pai", async () => {
      await montar();
      expect(host.querySelector(".mapa-si--escuro")).toBeNull();
      await act(async () => {
        document.documentElement.setAttribute("data-theme", "dark");
        document.dispatchEvent(new Event(EVENTO_TEMA_ALTERADO));
      });
      expect(host.querySelector(".mapa-si--escuro")).not.toBeNull();
      await rerender({ tema: "claro" });
      expect(host.querySelector(".mapa-si--escuro")).toBeNull();
    });
  });

  /*
  "O mapa quebra o nome quando passo o mouse ou clico em algum extremo": a
  dica centrada acima de um ponto na borda saía do contêiner do mapa. Os dois
  mapas (nacional e do DSEI) ligam src/lib/mapas/dica-dentro-do-mapa.ts.
*/
  describe("dicas e popups dentro do mapa", () => {
    /* Mede como o navegador: contêiner 600 × 400, dica 268 × 58. */
    function comMedidas(mapa, caixaDaDica) {
      const moldura = mapa.elemento;
      Object.defineProperty(moldura, "clientWidth", { value: 600 });
      Object.defineProperty(moldura, "clientHeight", { value: 400 });
      moldura.getBoundingClientRect = () => ({ left: 0, top: 0 });
      const elemento = document.createElement("div");
      elemento.getBoundingClientRect = () => caixaDaDica;
      return {
        elemento,
        options: { direction: "top" },
        getElement: () => elemento,
        getLatLng: () => [-6.9, -35.1],
        setLatLng: vi.fn(),
      };
    }

    it("a dica de um DSEI na borda leste vai para o lado em vez de ser cortada", async () => {
      window.matchMedia = () => ({ matches: true });
      await montar();
      const mapa = mapaVivo("map");
      expect(mapa.ouvintes("tooltipopen")).toBe(1);
      // Centrada acima de um ponto a 10 px da borda direita (x = 590).
      const dica = comMedidas(mapa, {
        left: 590 - 134,
        top: 200 - 6 - 58,
        width: 268,
        height: 58,
      });
      await act(async () => mapa.fire("tooltipopen", { tooltip: dica }));
      expect(dica.options.direction).toBe("left");
      expect(dica.setLatLng).toHaveBeenCalled();
      expect(dica.elemento.classList.contains("dica-no-mapa")).toBe(true);
    });

    it("no meio do mapa a dica continua em cima", async () => {
      window.matchMedia = () => ({ matches: true });
      await montar();
      const mapa = mapaVivo("map");
      const dica = comMedidas(mapa, {
        left: 300 - 134,
        top: 200 - 6 - 58,
        width: 268,
        height: 58,
      });
      await act(async () => mapa.fire("tooltipopen", { tooltip: dica }));
      expect(dica.options.direction).toBe("top");
    });

    it("popups com autoPan e largura relativa ao mapa, também no mapa do DSEI", async () => {
      await montar({ dseiSelecionado: "ALAGOAS E SERGIPE" });
      const mapa = mapaVivo("detailMap");
      expect(mapa.ouvintes("popupopen")).toBe(1);
      const [unidade] = leaflet.desenhadas(mapa, "marker");
      expect(unidade.opcoesDoPopup).toMatchObject({
        autoPan: true,
        keepInView: false,
        className: "popup-no-mapa",
      });
      // Aberto num mapa estreito (celular), o popup encolhe e refaz o autoPan.
      Object.defineProperty(mapa.elemento, "clientWidth", { value: 343 });
      Object.defineProperty(mapa.elemento, "clientHeight", { value: 360 });
      const popup = { options: { maxWidth: 300 }, update: vi.fn() };
      await act(async () => mapa.fire("popupopen", { popup }));
      expect(popup.options.maxWidth).toBeLessThan(343);
      expect(popup.options.maxHeight).toBeLessThan(360);
      expect(popup.update).toHaveBeenCalledTimes(1);
    });

    it("a CASAI nacional também abre o popup com autoPan", async () => {
      await montar();
      const [casai] = leaflet.desenhadas(mapaVivo("map"), "marker");
      expect(casai.opcoesDoPopup).toMatchObject({ autoPan: true });
    });
  });

  it("abre o mapa com dados geográficos inválidos sem derrubar a tela", async () => {
    await montar({
      lmap: {
        dsei: [null, { k: "A", n: "Distrito A", lat: [], lon: {}, polos: {} }],
      },
      casaisNacionais: {},
      dseiSelecionado: "A",
    });
    expect(host.querySelector(".mapa-si-painel--dsei")).not.toBeNull();
    expect(host.textContent).toContain("Nenhuma unidade georreferenciada.");
  });
});

bloco("modulos/modulos", () => {
  /*
  Configurações › Módulos e abas: só o admin global vê; as mudanças se
  acumulam e vão juntas em "Revisar e salvar", com motivo; as recusas do banco
  (23514: última área; 42501: sem permissão) aparecem em português claro.
*/

  const ARVORE = () => ({
    sistema: { situacao: "ATIVA", mensagem: null, previsao: null },
    areas: [
      {
        co_area: "saude-indigena",
        no_area: "Saúde Indígena",
        ativo: true,
        situacao: "ATIVA",
        mensagem: null,
        previsao: null,
        abas: [
          {
            co_aba: "editais",
            ativo: true,
            situacao: "ATIVA",
            mensagem: null,
            previsao: null,
          },
        ],
      },
      {
        co_area: "sede",
        no_area: "SEDE",
        ativo: true,
        situacao: "ATIVA",
        mensagem: null,
        previsao: null,
        abas: [],
      },
    ],
    abas: [
      {
        co_aba: "editais",
        no_aba: "Editais",
        ds_icone: "file-text",
        nu_ordem: 2,
        ativo: true,
        situacao: "ATIVA",
        mensagem: null,
        previsao: null,
        beta: false,
      },
    ],
    paineis: [
      { id: "p-1", titulo: "Painel BI", ativo: true, em_manutencao: false },
    ],
    historico: [
      {
        escopo: "area",
        area: "sede",
        campo: "situacao",
        anterior: "MANUTENCAO",
        novo: "ATIVA",
        motivo: "fim do ajuste",
        quando: "2026-09-29T10:00:00Z",
        autor: "adm@agenciasus.org.br",
      },
    ],
  });

  function supabaseFalso({ recusa = null } = {}) {
    const rpc = vi.fn((nome) => {
      if (nome === "obter_modulos_e_abas")
        return Promise.resolve({ data: ARVORE(), error: null });
      if (nome === "salvar_situacao_modulos")
        return Promise.resolve(
          recusa
            ? { data: null, error: recusa }
            : { data: { alteradas: 2 }, error: null },
        );
      return Promise.resolve({ data: null, error: null });
    });
    return {
      rpc,
      auth: {
        getSession: async () => ({
          data: { session: { access_token: "x" } },
          error: null,
        }),
        onAuthStateChange: () => ({
          data: { subscription: { unsubscribe: () => {} } },
        }),
      },
    };
  }

  let controlador = null;
  async function montar({
    perfil,
    recusa,
    confirmar = () => true,
    aoSalvar,
  } = {}) {
    document.body.innerHTML = '<div id="modulosApp" data-modulos></div>';
    const supabase = supabaseFalso({ recusa });
    const toast = vi.fn();
    await act(async () => {
      controlador = montarTela(criarModulos, "", {
        secao: document.getElementById("modulosApp"),
        supabase,
        toast,
        getProfile: () => perfil,
        confirmar,
        aoSalvar,
      });
    });
    await esperar(() => controlador.render());
    return { supabase, toast };
  }

  afterEach(async () => {
    controlador?.estado.desligar();
    await act(async () => controlador?.raiz?.unmount());
    controlador = null;
    document.body.innerHTML = "";
  });

  const ADMIN = { admin_global: true, permissoes: {} };
  const EDITOR = {
    admin_global: false,
    permissoes: { configuracoes: "admin" },
  };

  const botao = (texto, raiz = document) =>
    [...raiz.querySelectorAll("button")].find(
      (b) => b.textContent.trim() === texto,
    );
  const grupo = (rotulo) =>
    document.querySelector(`[role="radiogroup"][aria-label="${rotulo}"]`);
  const opcao = (rotulo, texto) => botao(texto, grupo(rotulo));
  const salvarChamadas = (supabase) =>
    supabase.rpc.mock.calls.filter(
      ([nome]) => nome === "salvar_situacao_modulos",
    );

  describe("Configurações › Módulos e abas", () => {
    it("exibe a falha da releitura sem remover a árvore nem as alterações pendentes", async () => {
      const { supabase } = await montar({ perfil: ADMIN });
      const consoleErro = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      try {
        await act(async () => {
          controlador.estado.mudarCampo(
            { escopo: "area", area: "sede" },
            "mensagem",
            "Ajuste",
          );
          supabase.rpc.mockResolvedValueOnce({
            data: { areas: {} },
            error: null,
          });
          await controlador.estado.carregar();
        });
        expect(document.body.textContent).toContain(
          "Resposta de módulos e abas inválida",
        );
        expect(grupo("Situação do sistema inteiro")).not.toBeNull();
        expect(controlador.estado.temAlteracoesPendentes()).toBe(true);
      } finally {
        consoleErro.mockRestore();
      }
    });
    it("quem não é admin global não carrega nem vê a árvore", async () => {
      const { supabase } = await montar({ perfil: EDITOR });
      expect(supabase.rpc).not.toHaveBeenCalled();
      expect(document.body.textContent).toContain(
        "Só o administrador global gerencia módulos e abas.",
      );
    });

    it("mostra sistema, uma área por cartão com as abas, abas, painéis e histórico", async () => {
      await montar({ perfil: ADMIN });
      const titulos = [...document.querySelectorAll(".modulos-cartao h4")].map(
        (h) => h.textContent,
      );
      expect(titulos).toEqual([
        "Sistema inteiro",
        "Saúde Indígena",
        "SEDE",
        "Abas (em todas as áreas)",
        "Painéis externos",
        "Histórico",
      ]);
      expect(grupo("Situação de Editais")).not.toBeNull();
      expect(
        document.querySelector(".modulos-historico").textContent,
      ).toContain("Área SEDE · Situação: Em manutenção → Ativa");
      // Nada pendente, nada a salvar.
      expect(botao("Revisar e salvar")).toBeUndefined();
    });

    it("acumula as mudanças e salva tudo junto, com motivo", async () => {
      const { supabase, toast } = await montar({ perfil: ADMIN });
      await clicar(opcao("Situação do sistema inteiro", "Em manutenção"));
      await digitar(
        document.getElementById("modulos-sistema-mensagem"),
        "Atualização do banco",
      );
      await clicar(
        document.querySelector(".modulos-beta input[type=checkbox]"),
      );
      expect(document.querySelector(".modulos-salvar").textContent).toContain(
        "3 alterações pendentes",
      );
      await clicar(botao("Revisar e salvar"));
      const revisao = document.querySelector(".modulos-revisao").textContent;
      expect(revisao).toContain(
        "Sistema inteiro · Situação: Ativa → Em manutenção",
      );
      expect(revisao).toContain("Aba Editais (todas as áreas) · Selo BETA");

      // Sem motivo, não salva.
      await clicar(botao("Salvar alterações"));
      expect(salvarChamadas(supabase)).toHaveLength(0);
      expect(document.body.textContent).toContain("Informe o motivo");

      await digitar(
        document.getElementById("modulosMotivo"),
        "janela de manutenção",
      );
      await clicar(botao("Salvar alterações"));
      await esperar();
      const [[, argumentos]] = salvarChamadas(supabase);
      expect(argumentos).toEqual({
        p_alteracoes: [
          { escopo: "sistema", campo: "situacao", valor: "MANUTENCAO" },
          {
            escopo: "sistema",
            campo: "mensagem",
            valor: "Atualização do banco",
          },
          { escopo: "aba", aba: "editais", campo: "beta", valor: "S" },
        ],
        p_motivo: "janela de manutenção",
      });
      expect(toast).toHaveBeenCalledWith(
        expect.stringContaining("2 alterações salvas"),
        "success",
      );
      expect(controlador.temAlteracoesPendentes()).toBe(false);
    });

    it("não deixa salvar com todas as áreas desativadas", async () => {
      const { supabase } = await montar({ perfil: ADMIN });
      await clicar(opcao("Situação da área Saúde Indígena", "Desativada"));
      await clicar(opcao("Situação da área SEDE", "Desativada"));
      await clicar(botao("Revisar e salvar"));
      expect(
        document.querySelector(".modulos-problemas").textContent,
      ).toContain("Pelo menos uma área precisa ficar ativa.");
      expect(botao("Salvar alterações").disabled).toBe(true);
      expect(salvarChamadas(supabase)).toHaveLength(0);
    });

    it("recusa 23514 do banco vira aviso claro e mantém o rascunho", async () => {
      await montar({
        perfil: ADMIN,
        recusa: {
          code: "23514",
          message: "Pelo menos uma área precisa ficar ativa",
        },
      });
      await clicar(opcao("Situação de Painel BI", "Em manutenção"));
      await clicar(botao("Revisar e salvar"));
      await digitar(
        document.getElementById("modulosMotivo"),
        "teste de recusa",
      );
      await clicar(botao("Salvar alterações"));
      await esperar();
      expect(document.querySelector('[role="alert"]').textContent).toContain(
        "Pelo menos uma área precisa ficar ativa. Reative uma área",
      );
      expect(controlador.temAlteracoesPendentes()).toBe(true);
    });

    it("recusa 42501 diz que só o admin global pode", async () => {
      await montar({
        perfil: ADMIN,
        recusa: { code: "42501", message: "Somente o administrador global" },
      });
      await clicar(opcao("Situação de Editais", "Desativada"));
      await clicar(botao("Revisar e salvar"));
      await digitar(document.getElementById("modulosMotivo"), "sem poder");
      await clicar(botao("Salvar alterações"));
      await esperar();
      expect(document.body.textContent).toContain(
        "Só o administrador global pode mudar módulos e abas.",
      );
    });

    it("aba em manutenção numa área pede mensagem e previsão", async () => {
      const { supabase } = await montar({ perfil: ADMIN });
      const linha = document.querySelector(
        '[data-alvo="modulos-aba_area-saude-indigena-editais"]',
      );
      await clicar(botao("Em manutenção", linha));
      await digitar(
        document.getElementById(
          "modulos-aba_area-saude-indigena-editais-previsao",
        ),
        "2026-10-10",
      );
      await clicar(botao("Revisar e salvar"));
      await digitar(document.getElementById("modulosMotivo"), "ajuste local");
      await clicar(botao("Salvar alterações"));
      await esperar();
      expect(salvarChamadas(supabase)[0][1].p_alteracoes).toEqual([
        {
          escopo: "aba_area",
          area: "saude-indigena",
          aba: "editais",
          campo: "situacao",
          valor: "MANUTENCAO",
        },
        {
          escopo: "aba_area",
          area: "saude-indigena",
          aba: "editais",
          campo: "previsao",
          valor: "2026-10-10",
        },
      ]);
    });

    it("sair com pendência pergunta antes", async () => {
      const confirmar = vi.fn(() => false);
      await montar({ perfil: ADMIN, confirmar });
      await clicar(opcao("Situação de Editais", "Em manutenção"));
      expect(controlador.confirmarSaida()).toBe(false);
      expect(confirmar).toHaveBeenCalled();
      confirmar.mockReturnValue(true);
      expect(controlador.confirmarSaida()).toBe(true);
      expect(controlador.temAlteracoesPendentes()).toBe(false);
    });
    it("desliga as comemorações do sistema inteiro pelo rascunho, com motivo", async () => {
      const { supabase } = await montar({ perfil: ADMIN });
      const caixa = document.querySelector(
        ".modulos-comemoracoes input[type=checkbox]",
      );
      expect(caixa.checked).toBe(true);
      await clicar(caixa);
      await clicar(botao("Revisar e salvar"));
      expect(document.querySelector(".modulos-revisao").textContent).toContain(
        "Sistema inteiro · Comemorações: Ligadas → Desligadas",
      );
      await digitar(
        document.getElementById("modulosMotivo"),
        "pedido da gestão",
      );
      await clicar(botao("Salvar alterações"));
      await esperar();
      expect(salvarChamadas(supabase)[0][1].p_alteracoes).toEqual([
        { escopo: "sistema", campo: "comemoracoes", valor: "N" },
      ]);
    });
  });

  /*
  22/10: salvar painéis aqui não relia a lista de painéis do app (menu e
  Configurações › Painéis externos); e um efeito sem dependências disparava
  agsus:content-updated a cada render (a cada tecla).
*/
  describe("depois de salvar e a cada tecla", () => {
    it("salvar avisa quem relê os painéis", async () => {
      const aoSalvar = vi.fn();
      await montar({ perfil: ADMIN, aoSalvar });
      await clicar(
        document.querySelector(".modulos-beta input[type=checkbox]"),
      );
      await clicar(botao("Revisar e salvar"));
      await digitar(document.getElementById("modulosMotivo"), "teste");
      await clicar(botao("Salvar alterações"));
      await esperar();
      expect(aoSalvar).toHaveBeenCalledTimes(1);
    });

    it("digitar não dispara agsus:content-updated", async () => {
      await montar({ perfil: ADMIN });
      await clicar(opcao("Situação do sistema inteiro", "Em manutenção"));
      const avisos = vi.fn();
      document.addEventListener("agsus:content-updated", avisos);
      try {
        await digitar(document.getElementById("modulos-sistema-mensagem"), "a");
        await digitar(
          document.getElementById("modulos-sistema-mensagem"),
          "ab",
        );
        expect(avisos).not.toHaveBeenCalled();
      } finally {
        document.removeEventListener("agsus:content-updated", avisos);
      }
    });
  });
});

bloco("modulos/pre-classificacao-independente", () => {
  /* A página não acessa a RPC de triagem até o backend confirmar
   pode_coordenar para aquele edital; perfil que só lê Seleção não a libera. */
  const ID = "00000000-0000-4000-8000-000000000114";
  function supabaseFalso(coordena) {
    return {
      auth: {
        getSession: async () => ({
          data: { session: { user: { id: "usuario-de-teste" } } },
        }),
      },
      rpc: vi.fn(async (nome, args) => {
        switch (nome) {
          case "listar_editais_avaliacao":
            return {
              data: {
                area: "projetos",
                editais: [
                  {
                    id: ID,
                    edital: "114/2026",
                    unidade: "Rio Doce",
                    ativo: true,
                    status: "Em andamento",
                    papel: coordena ? "COORDENADOR" : "ANALISTA",
                  },
                ],
              },
              error: null,
            };
          case "obter_regra_analise":
            return {
              data: {
                edital: {
                  id: args.p_edital,
                  edital: "114/2026",
                  area: "projetos",
                },
                papel: coordena ? "COORDENADOR" : "ANALISTA",
                pode_coordenar: coordena,
                origem: "PLANILHA",
                regra: null,
                modelos: [],
                nota_minima: null,
                aldeias: { quantidade: 0 },
              },
              error: null,
            };
          case "obter_equipe_edital":
            return {
              data: {
                pode_coordenar: coordena,
                gestores: [],
                equipe: [],
                pessoas: [],
                vagas: [],
              },
              error: null,
            };
          case "obter_pre_classificacao":
            // Um snapshot mínimo: a prova principal é que só a coordenação
            // chega a solicitar dados e as chamadas não alteram o edital.
            return { data: null, error: null };
          default:
            return { data: null, error: null };
        }
      }),
    };
  }

  let secao;
  let controller;

  async function montar(supabase) {
    secao = document.createElement("section");
    secao.id = "page-pre-classificacao";
    document.body.append(secao);
    await act(async () => {
      controller = montarTela(criarPreClassificacao, "page-pre-classificacao", {
        secao,
        supabase,
        areaAtual: () => "projetos",
        toast: vi.fn(),
      });
    });
    await act(async () => controller.render());
    await esperar();
    await esperar();
  }

  beforeEach(() => {
    redefinirDadosDoMonitoramento();
    definirAreaAtual("projetos");
    localStorage.clear();
    sessionStorage.clear();
  });
  afterEach(async () => {
    await act(async () => controller?.raiz?.unmount());
    secao?.remove();
    controller = null;
    secao = null;
  });

  describe("entrada independente de Triagem", () => {
    it("analista vê o aviso e não consulta dados da triagem", async () => {
      const supabase = supabaseFalso(false);
      await montar(supabase);
      expect(secao.textContent).toContain("restrita à coordenação");
      expect(
        supabase.rpc.mock.calls.some(([nome]) =>
          /^obter_(resumo_)?pre_classificacao$/.test(nome),
        ),
      ).toBe(false);
      expect(
        supabase.rpc.mock.calls.some(
          ([nome]) => nome === "obter_regra_analise",
        ),
      ).toBe(true);
    });

    it("coordenação autenticada chega à mesma RPC da Triagem", async () => {
      const supabase = supabaseFalso(true);
      await montar(supabase);
      expect(
        supabase.rpc.mock.calls.some(([nome]) =>
          /^obter_(resumo_)?pre_classificacao$/.test(nome),
        ),
      ).toBe(true);
      expect(
        secao.querySelector("[data-tour='pre-seletor-edital']"),
      ).not.toBeNull();
      // Um cabeçalho só (o da Triagem, com o edital), também enquanto ela lê.
      const cabecalhos = secao.querySelectorAll(".ui-cabecalho-da-tela");
      expect(cabecalhos).toHaveLength(1);
      expect(
        cabecalhos[0].querySelector(".ui-cabecalho-titulo").textContent,
      ).toBe("Triagem");
      expect(
        cabecalhos[0].querySelector(".ui-cabecalho-trilha").textContent,
      ).toBe("Projetos / Seleção");
      expect(
        cabecalhos[0]
          .querySelector("[data-acao='atualizar']")
          .getAttribute("aria-label"),
      ).toBe("Atualizar");
    });

    it("a entrada não concede acesso ao recurso Seleção", async () => {
      const supabase = supabaseFalso(false);
      await montar(supabase);
      expect(
        supabase.rpc.mock.calls.some(([nome]) =>
          /^obter_(resumo_)?pre_classificacao$/.test(nome),
        ),
      ).toBe(false);
      expect(secao.textContent).toContain("Painel da Seleção");
    });
  });
});

bloco("piscada-do-login", () => {
  const html = readFileSync("index.html", "utf8");
  const cache = readFileSync(
    "src/lib/entrada/access-branding-cache.ts",
    "utf8",
  );
  const marca = readFileSync("src/lib/entrada/access-branding.ts", "utf8");

  /*
  A piscada ao recarregar a tela de acesso.

  `main.ts` é `type="module"`, portanto adiado: só roda depois de o HTML ser
  analisado, quando o navegador já pintou a tela com os padrões neutros do CSS.
  A marca guardada era aplicada ali — e a cada recarga via-se claro e neutro
  primeiro, escuro e institucional logo depois.

  A correção não muda a lógica: antecipa-a. Dois scripts clássicos, síncronos,
  bloqueiam o analisador antes de o conteúdo existir.

  O preço é uma cópia da leitura do cache dentro do `index.html`, que não pode
  importar módulos. Estes testes são o que impede as duas cópias de se
  separarem em silêncio.
*/

  function scriptDoHead() {
    const i = html.indexOf("aplicarMarcaAntesDoPrimeiroPaint");
    expect(i, "script de pré-paint ausente do index.html").toBeGreaterThan(-1);
    return html.slice(i, html.indexOf("</script>", i));
  }

  describe("a marca é aplicada antes do primeiro paint", () => {
    it("o script do head é clássico e síncrono", () => {
      const trecho = html.slice(
        0,
        html.indexOf("aplicarMarcaAntesDoPrimeiroPaint"),
      );
      const abertura = trecho.lastIndexOf("<script");
      const tag = trecho.slice(abertura);
      expect(tag).not.toContain('type="module"');
      expect(tag).not.toContain("defer");
      expect(tag).not.toContain("async");
    });

    /*
    Os comentários deste ficheiro citam `<body>` ao explicar por que o script
    precisa correr antes dele. Procurar a marca no texto cru acusaria a própria
    explicação; o que vale é o documento sem comentários.
  */
    it("roda no <head>, antes do <body>", () => {
      const semComentarios = semTrechos(html, "<!--", "-->");
      expect(
        semComentarios.indexOf("aplicarMarcaAntesDoPrimeiroPaint"),
      ).toBeLessThan(semComentarios.indexOf("<body"));
    });

    /*
    A classe é exigida em `#loginScreen.login-panel-dark` pela seção Login de
    platform-shell.css. Aplicá-la no elemento — e não no <html> —
    reaproveita todos esses seletores sem duplicar nenhum.
  */
    it("a classe é aplicada logo depois do elemento existir", () => {
      const elemento = html.indexOf('id="loginScreen"');
      const aplicacao = html.indexOf("__agsusPainelEscuro", elemento);
      const cartao = html.indexOf('class="login-card"', elemento);
      expect(aplicacao).toBeGreaterThan(elemento);
      expect(aplicacao).toBeLessThan(cartao);
    });

    it("a variável da cor vai na raiz, para ser herdada antes do elemento", () => {
      expect(scriptDoHead()).toContain(
        'raiz.style.setProperty("--login-panel-color", cor)',
      );
    });
  });

  describe("as duas cópias não podem divergir", () => {
    it("usam a mesma chave de armazenamento", () => {
      const chave = cache.match(/const CHAVE = "([^"]+)"/)?.[1];
      expect(chave).toBeTruthy();
      expect(scriptDoHead()).toContain(chave);
    });

    it("usam o mesmo limiar de luminância", () => {
      const formula = marca.match(
        /\(red \* (\d+) \+ green \* (\d+) \+ blue \* (\d+)\) \/ (\d+) < (\d+)/,
      );
      expect(formula, "fórmula de luminância mudou de forma").toBeTruthy();
      const [, r, g, b, div, limiar] = formula;
      const inline = scriptDoHead();
      expect(inline).toContain(`r * ${r} + g * ${g} + b * ${b}`);
      expect(inline).toContain(`/ ${div} < ${limiar}`);
    });

    it("escrevem os mesmos nomes de variável CSS que o CSS lê", () => {
      const inline = scriptDoHead();
      for (const nome of ["--login-panel-color", "--login-background-image"]) {
        expect(inline).toContain(nome);
      }
    });

    /*
    Só os campos que a tela pinta. Se o script inline passasse a ler algo fora
    de CAMPOS, leria um dado que o cache nunca guarda.
  */
    it("só lê campos que o cache guarda", () => {
      const campos = [...cache.matchAll(/^\s*"(\w+)",$/gm)].map((m) => m[1]);
      const inline = scriptDoHead();
      for (const lido of ["panelColor", "backgroundUrl"]) {
        expect(campos, `${lido} não está em CAMPOS`).toContain(lido);
        expect(inline).toContain(`marca.${lido}`);
      }
    });
  });

  describe("os estados que a medição no navegador confirmou", () => {
    /*
    Medido no preview em 09/09/2026, recarregando a página:

      com cache #052029  -> var na raiz #052029, classe aplicada,
                            card rgb(5, 32, 41)
      sem cache          -> var vazia, sem classe,
                            fundo rgb(238, 244, 248), card branco
      com cache #f2e8d5  -> sem classe escura, título rgb(16, 42, 67)
  */
    it("uma cor escura pede primeiro plano claro", () => {
      expect(needsLightForeground("#052029")).toBe(true);
    });

    it("uma cor clara não pede", () => {
      expect(needsLightForeground("#f2e8d5")).toBe(false);
      expect(needsLightForeground("#ffffff")).toBe(false);
    });

    /*
    Sem cache a tela fica neutra — nunca a arte padrão apresentada como se
    fosse escolha da instituição, e nunca o roxo do legado.
  */
    it("o CSS de partida continua neutro", () => {
      const tuning = readFileSync(
        "src/styles/post157-interface-tuning.css",
        "utf8",
      );
      expect(tuning).toContain(
        "background-color: var(--login-arte-cor, #eef4f8);",
      );
      expect(tuning).not.toContain("#4d2270");
      expect(tuning).not.toContain("#c296eb");
    });

    it("o script tolera armazenamento bloqueado", () => {
      const inline = scriptDoHead();
      expect(inline).toContain("try {");
      expect(inline).toContain("catch (erro)");
    });

    /*
    Aspas e barras invertidas na URL quebrariam a declaração CSS — a mesma
    proteção que `comoUrlCss` faz do lado do módulo.
  */
    it("a URL da arte é higienizada antes de virar url()", () => {
      expect(scriptDoHead()).toContain('replace(/["\\\\]/g, "")');
    });
  });

  /*
  O modo do texto não sobrevivia a um F5.

  Sequência medida: o carregamento autenticado guardava `textoModo` no cache; o
  pré-paint o aplicava; e então `obter_branding_acesso_publico()` respondia com
  a sua lista fixa de seis chaves, `guardarMarca` **substituía** o cache inteiro
  por essa resposta, e o campo desaparecia — a tela revertia para o padrão no
  mesmo carregamento, e o F5 seguinte já nascia sem ele.

  Substituir contradizia a regra que o próprio módulo declara: uma resposta
  incompleta não pode trocar uma identidade correta por outra.
*/
  describe("uma resposta parcial não apaga o cache", () => {
    beforeEach(() => {
      limparMarcaGuardada();
    });

    it("mescla em vez de substituir", () => {
      guardarMarca({ panelColor: "#c090eb", textoModo: "claro" });
      // A RPC pública responde sem o modo, como faz hoje.
      guardarMarca({ panelColor: "#c090eb", greeting: "Olá" });

      const guardada = lerMarcaGuardada();
      expect(guardada.textoModo).toBe("claro");
      expect(guardada.greeting).toBe("Olá");
    });

    it("devolve a marca completa, para quem aplica não usar a resposta crua", () => {
      guardarMarca({ panelColor: "#c090eb", textoModo: "claro" });
      const completa = guardarMarca({ greeting: "Olá" });
      expect(completa.textoModo).toBe("claro");
      expect(completa.panelColor).toBe("#c090eb");
    });

    it("o que a resposta traz continua vencendo o que estava guardado", () => {
      guardarMarca({ panelColor: "#c090eb" });
      guardarMarca({ panelColor: "#6c009e" });
      expect(lerMarcaGuardada().panelColor).toBe("#6c009e");
    });

    it("quem aplica usa o resultado da mescla", () => {
      const boot = readFileSync("src/app/entrada/marca.ts", "utf8");
      expect(boot).toContain("const completa = guardarMarca(marca) || marca");
      expect(boot).toContain("aplicarMarcaNaTela(completa, documento, estado)");
    });
  });

  /*
  A tela de acesso antiga — foto em i.postimg.cc e cartão branco — aparecia
  sempre que o CSS dos módulos atrasava, porque app.css ainda a desenhava.
  Sem arte configurada, o fundo é liso, em todos os arquivos que pintam a tela.
*/
  describe("fundo da tela de acesso sem arte configurada", () => {
    const folhas = [
      "src/styles/app.css",
      "src/styles/platform-shell.css",
      "src/modulos/configuracoes/configuracoes.css",
    ].map((arquivo) => [arquivo, readFileSync(arquivo, "utf8")]);

    it.each(folhas)("%s não carrega imagem de host externo", (_, css) => {
      expect(css).not.toMatch(/url\(\s*["']?https?:/);
    });

    it.each(folhas)("%s não usa mais o roxo legado", (_, css) => {
      expect(css).not.toContain("#4d2270");
    });

    it("a alternativa da arte é nenhuma imagem", () => {
      const [, app] = folhas[0];
      const regra = app.slice(app.indexOf(".login-screen {"));
      expect(regra.slice(0, regra.indexOf("}"))).toContain(
        "background-image: var(--login-background-image, none)",
      );
    });
  });
});

bloco("recarga-logado", () => {
  /*
  Recarregar a página já logado mostrava a tela de acesso (com a arte de
  fundo) até a sessão ser confirmada: durante `body.config-loading`, app.css
  deixa o login visível. Um script no <head> marca `html.sessao-guardada`
  antes da primeira pintura, e o login fica escondido nessa espera.
*/
  const html = readFileSync("index.html", "utf8");
  const inicio = html.indexOf("(function marcarSessaoGuardada()");
  const script = html.slice(inicio, html.indexOf("</script>", inicio));
  // O comentário do <head> cita `<body>`; a tag real é a que tem classes.
  const tagBody = html.indexOf("<body class=");

  function rodarScript() {
    document.documentElement.className = "";
    new Function(script)();
    return document.documentElement.classList.contains("sessao-guardada");
  }

  describe("recarregar já logado não mostra a tela de acesso", () => {
    beforeEach(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    it("o script roda no <head>, antes do <body>", () => {
      expect(inicio).toBeGreaterThan(-1);
      expect(tagBody).toBeGreaterThan(-1);
      expect(inicio).toBeLessThan(tagBody);
    });

    it("lê a mesma chave de sessão que o cliente Supabase usa", () => {
      expect(script).toContain(`"${SUPABASE_AUTH_STORAGE_KEY}"`);
    });

    it("com sessão guardada, marca a página", () => {
      localStorage.setItem(
        SUPABASE_AUTH_STORAGE_KEY,
        JSON.stringify({ access_token: "a", refresh_token: "r" }),
      );
      expect(rodarScript()).toBe(true);
    });

    it("sem sessão, com sessão sem refresh_token ou com lixo, não marca", () => {
      expect(rodarScript()).toBe(false);
      localStorage.setItem(
        SUPABASE_AUTH_STORAGE_KEY,
        JSON.stringify({ access_token: "a" }),
      );
      expect(rodarScript()).toBe(false);
      localStorage.setItem(SUPABASE_AUTH_STORAGE_KEY, "{quebrado");
      expect(rodarScript()).toBe(false);
    });

    it("a regra esconde o login só durante o carregamento", () => {
      expect(html).toMatch(
        /html\.sessao-guardada body\.config-loading #loginScreen\s*\{\s*display:\s*none;/,
      );
    });
  });
});

bloco("session-lifecycle", () => {
  describe("session lifecycle", () => {
    it("formata o contador de uma hora", () => {
      expect(formatSessionRemaining(SESSION_IDLE_LIMIT_MS)).toBe("01:00:00");
      expect(formatSessionRemaining(10 * 60 * 1000 + 1000)).toBe("00:10:01");
      expect(formatSessionRemaining(0)).toBe("00:00:00");
    });

    it("calcula o tempo restante a partir da última atividade", () => {
      const activityAt = 1_000_000;

      expect(getRemainingSessionMs(activityAt, activityAt)).toBe(
        SESSION_IDLE_LIMIT_MS,
      );
      expect(
        getRemainingSessionMs(activityAt, activityAt + 30 * 60 * 1000),
      ).toBe(30 * 60 * 1000);
      expect(
        getRemainingSessionMs(activityAt, activityAt + SESSION_IDLE_LIMIT_MS),
      ).toBe(0);
    });

    it("não retorna tempo negativo após a expiração", () => {
      expect(
        getRemainingSessionMs(1000, 1000 + SESSION_IDLE_LIMIT_MS + 1),
      ).toBe(0);
    });

    it("interpreta apenas registros compartilhados válidos", () => {
      expect(
        parseSessionActivityRecord(
          JSON.stringify({ userId: "usuario-1", at: 123456 }),
        ),
      ).toEqual({ userId: "usuario-1", at: 123456 });
      expect(parseSessionActivityRecord("conteúdo inválido")).toBeNull();
      expect(
        parseSessionActivityRecord(JSON.stringify({ userId: "", at: 123456 })),
      ).toBeNull();
    });

    it("oculta aviso de sessão obsoleto após nova atividade", () => {
      const notice = document.createElement("div");
      notice.id = "agsusSessionNotice";
      notice.hidden = false;
      notice.dataset.level = "critical";
      document.body.appendChild(notice);

      expect(dismissSessionNotice()).toBe(true);
      expect(notice.hidden).toBe(true);

      notice.remove();
    });

    it("monta o contador pelo DOM, sem innerHTML", async () => {
      vi.resetModules();
      vi.doMock("../src/lib/sessao/supabaseClient", () => ({
        getSupabaseClient: () => null,
      }));
      const definir = vi.spyOn(Element.prototype, "innerHTML", "set");
      try {
        const { installSessionLifecycle } =
          await import("../src/lib/sessao/session-lifecycle");
        installSessionLifecycle();

        const timer = document.getElementById("agsusSessionTimer");
        expect(timer).not.toBeNull();
        expect(timer.getAttribute("role")).toBe("timer");
        const [icone, texto] = timer.children;
        expect(timer.children).toHaveLength(2);
        expect(icone.getAttribute("aria-hidden")).toBe("true");
        expect(icone.textContent).toBe("⏱");
        expect(texto.id).toBe("agsusSessionTimerText");
        expect(texto.textContent).toBe("");
        expect(definir).not.toHaveBeenCalled();
      } finally {
        definir.mockRestore();
        vi.doUnmock("../src/lib/sessao/supabaseClient");
      }
    });
  });
});

bloco("solicitacao-de-acesso", () => {
  /*
  Solicitação de acesso por área (20261021140000): abas Projetos · Saúde
  Indígena · SEDE com os campos da área, justificativa com texto mínimo,
  pedido enviado com Editar e Cancelar, recusa com motivo e conta desativada
  com "Pedir reativação". O acesso continua só por aprovação.
*/

  const JUSTIFICATIVA = "Vou avaliar as fichas da análise curricular do DSEI.";

  const PENDENTE = {
    id: "s1",
    status: "pendente",
    created_at: "2026-10-20T13:00:00Z",
    nome: "Ana Souza",
    area: "saude-indigena",
    area_nome: "Saúde Indígena",
    cargo: "AVALIADOR",
    cargo_rotulo: "Avaliador(a) da análise curricular",
    setor: "DSEI Yanomami",
    justificativa: JUSTIFICATIVA,
  };

  const RECUSADO = {
    ...PENDENTE,
    status: "recusado",
    avaliado_em: "2026-10-21T12:00:00Z",
    motivo_recusa: "AREA_OU_LOTACAO",
    observacao_admin: "Área ou lotação não confere — o DSEI é outro",
  };

  const OPCOES = {
    areas: [],
    unidades: [
      { area: "saude-indigena", nome: "CASAI São Paulo", tipo: "CASAI" },
      { area: "saude-indigena", nome: "DSEI Yanomami", tipo: "DSEI" },
      { area: "saude-indigena", nome: "DSEI Altamira", tipo: "DSEI" },
      { area: "projetos", nome: "Saúde nas Fronteiras", tipo: null },
      { area: "projetos", nome: "MFC", tipo: null },
    ],
    coordenacoes: [{ codigo: "norte", nome: "Norte", area: "saude-indigena" }],
  };

  describe("listas fixas", () => {
    it("as abas são Projetos · Saúde Indígena · SEDE, com a lotação de cada uma", () => {
      expect(AREAS_DA_SOLICITACAO.map((a) => [a.rotulo, a.lotacao])).toEqual([
        ["Projetos", "lista"],
        ["Saúde Indígena", "lista"],
        ["SEDE", "texto"],
      ]);
    });

    it("cada área tem a própria lista de cargos, sempre com 'Outro'", () => {
      const codigos = (area) => cargosDaArea(area).map((c) => c.codigo);
      expect(codigos("saude-indigena")).toContain("COORDENACAO_DSEI");
      expect(codigos("saude-indigena")).not.toContain("JURIDICO");
      expect(codigos("projetos")).toContain("COORDENACAO_PROJETO");
      expect(codigos("sede")).toEqual(
        expect.arrayContaining(["JURIDICO", "COORDENACAO_SEDE"]),
      );
      for (const area of ["projetos", "saude-indigena", "sede"])
        expect(codigos(area).at(-1)).toBe("OUTRO");
    });

    it("o cargo sugere o grupo, se quem aprova pode atribuí-lo", () => {
      const todos = [
        "usuario",
        "avaliador",
        "edital_gestor",
        "coordenador",
      ].map((codigo) => ({ codigo }));
      expect(grupoSugeridoDoPedido({ cargo: "AVALIADOR" }, todos)).toBe(
        "avaliador",
      );
      expect(grupoSugeridoDoPedido({ cargo: "COORDENACAO_DSEI" }, todos)).toBe(
        "coordenador",
      );
      // Coordenador com teto baixo: o grupo sugerido não está entre os possíveis.
      expect(
        grupoSugeridoDoPedido({ cargo: "COORDENACAO_DSEI" }, [
          { codigo: "usuario" },
          { codigo: "avaliador" },
        ]),
      ).toBe("usuario");
      expect(
        grupoSugeridoDoPedido(
          {
            cargo: "AVALIADOR",
            reativacao: true,
            grupo_anterior: "coordenador",
          },
          todos,
        ),
      ).toBe("coordenador");
      expect(grupoSugeridoDoPedido({}, [{ codigo: "avaliador" }])).toBe(
        "avaliador",
      );
    });

    it("cada cargo aponta para um grupo de TB_GRUPO_ACESSO", () => {
      const grupos = [
        "usuario",
        "avaliador",
        "edital_gestor",
        "contratador",
        "juridico",
        "coordenador",
      ];
      for (const c of CARGOS_DA_SOLICITACAO) expect(grupos).toContain(c.grupo);
    });
  });

  describe("situação do pedido", () => {
    it("sem pedido (ou cancelado): formulário", () => {
      expect(situacaoDaSolicitacao({})).toBe(SITUACOES.SEM_PEDIDO);
      expect(
        situacaoDaSolicitacao({ solicitacao: { status: "cancelado" } }),
      ).toBe(SITUACOES.SEM_PEDIDO);
      expect(telaDaSolicitacao({})).toMatchObject({
        conteudo: "formulario",
        texto: "",
      });
    });

    it("pendente: 'Pedido enviado — aguardando aprovação', resumo", () => {
      const tela = telaDaSolicitacao({ solicitacao: PENDENTE });
      expect(tela).toMatchObject({
        situacao: SITUACOES.PENDENTE,
        titulo: "Pedido enviado — aguardando aprovação",
        conteudo: "resumo",
      });
      expect(tela.texto).toContain("Enviado em 20/10");
    });

    it("recusado: mostra o motivo e volta ao formulário", () => {
      const tela = telaDaSolicitacao({ solicitacao: RECUSADO });
      expect(tela.titulo).toBe("Pedido recusado em 21/10");
      expect(tela.texto).toBe(
        "Motivo: Área ou lotação não confere — o DSEI é outro. Você pode corrigir e enviar um novo pedido.",
      );
      expect(tela.conteudo).toBe("formulario");
    });

    it("conta desativada vence qualquer pedido; pendente é a reativação", () => {
      for (const status of ["aprovado", "recusado", null])
        expect(
          telaDaSolicitacao({
            solicitacao: status ? { status } : null,
            contaDesativada: true,
          }),
        ).toMatchObject({
          titulo: TITULO_DESATIVADA,
          texto: TEXTO_DESATIVADA,
          conteudo: "oculto",
          oferecerReativacao: true,
        });
      expect(
        telaDaSolicitacao({ solicitacao: PENDENTE, contaDesativada: true }),
      ).toMatchObject({
        situacao: SITUACOES.REATIVACAO_PENDENTE,
        conteudo: "resumo",
        reativacao: true,
      });
    });

    it("aprovado: com perfil ativo é 'Entrar agora'; sem, acesso tirado depois", () => {
      expect(
        telaDaSolicitacao({
          solicitacao: { status: "aprovado" },
          perfilAtivo: true,
        }),
      ).toMatchObject({ situacao: SITUACOES.LIBERADO, entrar: true });
      expect(
        situacaoDaSolicitacao({ solicitacao: { status: "aprovado" } }),
      ).toBe(SITUACOES.DESATIVADA);
    });

    it("dia e mês no fuso de Brasília", () => {
      expect(diaEMes("2026-10-01T02:00:00Z")).toBe("30/09");
      expect(diaEMes("x")).toBe("");
    });

    it("o resumo diz o que foi pedido, com o rótulo da lotação da área", () => {
      expect(resumoDoPedido(PENDENTE)).toEqual([
        { rotulo: "Nome", valor: "Ana Souza" },
        { rotulo: "Área", valor: "Saúde Indígena" },
        {
          rotulo: "Cargo ou função",
          valor: "Avaliador(a) da análise curricular",
        },
        { rotulo: "DSEI ou CASAI", valor: "DSEI Yanomami" },
        { rotulo: "Justificativa", valor: JUSTIFICATIVA },
      ]);
      expect(
        resumoDoPedido({
          ...PENDENTE,
          cargo: "OUTRO",
          cargo_outro: "Apoio",
        })[2],
      ).toEqual({ rotulo: "Cargo ou função", valor: "Outro: Apoio" });
    });
  });

  describe("campos e validação", () => {
    const valido = {
      ...CAMPOS_VAZIOS,
      area: "saude-indigena",
      nome: "Ana Souza",
      cargo: "AVALIADOR",
      lotacao: "DSEI Yanomami",
      justificativa: JUSTIFICATIVA,
    };

    it("válido não tem erro", () => {
      expect(validarSolicitacao(valido)).toEqual({});
    });

    it("justificativa: obrigatória, 20 caracteres e 3 palavras de verdade", () => {
      expect(erroDaJustificativa("")).toBe(
        "Explique por que precisa do acesso.",
      );
      expect(erroDaJustificativa("Preciso ver")).toBe(
        "Escreva ao menos 20 caracteres (faltam 9).",
      );
      expect(erroDaJustificativa("dsdfsdfsfsa dvdddddddd TESTE FDFDF")).toMatch(
        /pelo menos 3 palavras/,
      );
      expect(erroDaJustificativa("aaaaaaaaaaaaaaaaaaaaaaaa")).not.toBe("");
      expect(erroDaJustificativa(JUSTIFICATIVA)).toBe("");
    });

    it("cada campo da área diz o que falta", () => {
      expect(
        validarSolicitacao({ ...CAMPOS_VAZIOS, area: "saude-indigena" }),
      ).toEqual({
        nome: "Informe seu nome completo.",
        justificativa: "Explique por que precisa do acesso.",
        cargo: "Escolha o cargo ou a função.",
        lotacao: "Escolha o DSEI ou a CASAI.",
      });
      expect(
        validarSolicitacao({ ...valido, area: "projetos", lotacao: "" })
          .lotacao,
      ).toBe("Escolha o projeto.");
      expect(
        validarSolicitacao({
          ...valido,
          area: "sede",
          cargo: "JURIDICO",
          lotacao: "",
        }).lotacao,
      ).toBe("Informe o setor ou a diretoria.");
    });

    it("cargo de outra área não vale; 'Outro' pede a descrição", () => {
      expect(validarSolicitacao({ ...valido, cargo: "JURIDICO" }).cargo).toBe(
        "Escolha o cargo ou a função.",
      );
      expect(
        validarSolicitacao({ ...valido, cargo: "OUTRO", cargoOutro: "x" })
          .cargoOutro,
      ).toMatch(/Descreva o cargo/);
      expect(
        validarSolicitacao({ ...valido, cargo: "OUTRO", cargoOutro: "Apoio" }),
      ).toEqual({});
    });

    it("lotação fora da lista carregada não vale", () => {
      expect(
        validarSolicitacao(valido, { lotacoes: ["DSEI Altamira"] }).lotacao,
      ).toBe("Escolha uma opção da lista.");
    });

    it("reativação: só nome e justificativa", () => {
      expect(
        validarSolicitacao(
          { nome: "Ana", justificativa: JUSTIFICATIVA },
          { reativacao: true },
        ),
      ).toEqual({});
      expect(
        argumentosDaSolicitacao(
          { ...valido, coordenacao: "norte" },
          { reativacao: true },
        ),
      ).toEqual({
        p_nome: "Ana Souza",
        p_area: null,
        p_cargo: null,
        p_cargo_outro: null,
        p_lotacao: null,
        p_justificativa: JUSTIFICATIVA,
        p_coordenacao: "norte",
      });
    });

    it("argumentos do pedido por área", () => {
      expect(
        argumentosDaSolicitacao({
          ...valido,
          cargo: "OUTRO",
          cargoOutro: "  Apoio técnico ",
        }),
      ).toEqual({
        p_nome: "Ana Souza",
        p_area: "saude-indigena",
        p_cargo: "OUTRO",
        p_cargo_outro: "Apoio técnico",
        p_lotacao: "DSEI Yanomami",
        p_justificativa: JUSTIFICATIVA,
        p_coordenacao: null,
      });
      expect(argumentosDaSolicitacao(valido).p_cargo_outro).toBeNull();
    });

    it("trocar de aba tira o que não vale na área nova", () => {
      const comCoordenacao = { ...valido, coordenacao: "norte" };
      expect(camposNaArea(comCoordenacao, "projetos")).toMatchObject({
        area: "projetos",
        cargo: "AVALIADOR",
        lotacao: "",
        coordenacao: "",
        nome: "Ana Souza",
        justificativa: JUSTIFICATIVA,
      });
      expect(
        camposNaArea({ ...valido, cargo: "COORDENACAO_DSEI" }, "sede").cargo,
      ).toBe("");
    });

    it("campos do pedido gravado (pedido antigo sem área: aba padrão, sem lotação)", () => {
      expect(camposDoPedido(PENDENTE)).toMatchObject({
        area: "saude-indigena",
        cargo: "AVALIADOR",
        lotacao: "DSEI Yanomami",
      });
      expect(
        camposDoPedido({ nome: "", setor: "COGIP" }, "Nome do Google"),
      ).toMatchObject({ nome: "Nome do Google", lotacao: "", cargo: "" });
    });
  });

  describe("recusa com motivo da lista", () => {
    it("a lista termina em 'Outro'", () => {
      expect(MOTIVOS_DE_RECUSA.at(-1)).toEqual({
        codigo: "OUTRO",
        rotulo: "Outro",
      });
    });

    it("motivo obrigatório; 'Outro' pede descrição com 3 palavras", () => {
      expect(validarRecusa({ motivo: "" })).toMatchObject({
        ok: false,
        campo: "motivo",
      });
      expect(
        validarRecusa({ motivo: "OUTRO", complemento: "curto" }),
      ).toMatchObject({ ok: false, campo: "complemento" });
      expect(
        validarRecusa({
          motivo: "OUTRO",
          complemento: "O e-mail não é da equipe do DSEI",
        }),
      ).toEqual({
        ok: true,
        argumentos: {
          p_motivo: "OUTRO",
          p_complemento: "O e-mail não é da equipe do DSEI",
        },
        texto: "O e-mail não é da equipe do DSEI",
      });
    });

    it("motivo da lista com complemento: o texto que a pessoa vê", () => {
      expect(
        validarRecusa({
          motivo: "AREA_OU_LOTACAO",
          complemento: "  o DSEI é outro ",
        }),
      ).toEqual({
        ok: true,
        argumentos: {
          p_motivo: "AREA_OU_LOTACAO",
          p_complemento: "o DSEI é outro",
        },
        texto: "Área ou lotação não confere — o DSEI é outro",
      });
      expect(
        validarRecusa({ motivo: "JA_TEM_ACESSO", complemento: "dddddddd" }),
      ).toMatchObject({ ok: false, campo: "complemento" });
    });
  });

  // ── A página (src/app/entrada/) ─────────────────────────────────────────────

  /** RPCs da página; `pedidos` responde obter_minha_solicitacao_acesso em fila. */
  function supabaseDaTela({
    pedidos = [null],
    desativadaNoBanco = false,
    contexto = null,
    opcoes = OPCOES,
    falhaNasOpcoes = false,
    erroNoEnvio = null,
    redeCaiNoEnvio = false,
  } = {}) {
    const fila = [...pedidos];
    return {
      rpc: vi.fn(async (nome) => {
        if (nome === "minha_conta_desativada")
          return { data: desativadaNoBanco, error: null };
        if (nome === "obter_minha_solicitacao_acesso")
          return {
            data: fila.length > 1 ? fila.shift() : fila[0],
            error: null,
          };
        if (nome === "listar_opcoes_da_solicitacao_acesso")
          return falhaNasOpcoes
            ? { data: null, error: { message: "falhou" } }
            : { data: opcoes, error: null };
        if (nome === "obter_contexto_monitora")
          return { data: contexto, error: null };
        if (nome === "registrar_solicitacao_acesso" && redeCaiNoEnvio)
          throw new TypeError("Failed to fetch");
        if (nome === "registrar_solicitacao_acesso")
          return erroNoEnvio
            ? { data: null, error: erroNoEnvio }
            : { data: { ok: true, status: "pendente" }, error: null };
        if (nome === "cancelar_minha_solicitacao_acesso")
          return { data: { ok: true, status: "cancelado" }, error: null };
        return { data: null, error: null };
      }),
    };
  }

  const USUARIO = (id) => ({
    id,
    email: `${id}@agenciasus.org.br`,
    user_metadata: { full_name: "Ana Souza" },
  });

  let raiz = null;
  const sessaoFalsa = { entrarComGoogle: vi.fn(), limparSessao: vi.fn() };

  async function desenhar(
    sb,
    { usuario = USUARIO("u1"), consultar = true } = {},
  ) {
    const pedido = criarPedidoDeAcesso({ cliente: () => sb, janela: window });
    document.body.innerHTML = `<div id="raiz"></div>`;
    raiz = createRoot(document.getElementById("raiz"));
    await act(async () => {
      raiz.render(
        createElement(PaginaDaSolicitacao, {
          pedido,
          sessao: sessaoFalsa,
          logoUrl: "/assets/agsus-logo.webp",
          slogan: "Gestão dos processos seletivos",
          instituicao: "Agência Brasileira de Apoio à Gestão do SUS",
        }),
      );
    });
    await act(async () => {
      await pedido.carregar({ usuario, consultar });
    });
    return pedido;
  }

  const $ = (id) => document.getElementById(id);
  const aba = (rotulo) =>
    [...document.querySelectorAll('[role="tab"]')].find(
      (b) => b.textContent === rotulo,
    );
  const chamadas = (sb, nome) => sb.rpc.mock.calls.filter(([n]) => n === nome);
  const opcoesDe = (id) => [...$(id).options].map((o) => o.textContent);

  beforeEach(() => localStorage.clear());
  afterEach(async () => {
    if (raiz) await act(async () => raiz.unmount());
    raiz = null;
    document.body.innerHTML = "";
    localStorage.clear();
    sessionStorage.clear();
  });

  describe("página: abas e campos por área", () => {
    it("duas colunas (marca com a Aya e o pedido), nome do Google e e-mail só leitura", async () => {
      await desenhar(supabaseDaTela());
      expect(document.querySelector(".solicitacao-marca")).not.toBeNull();
      expect(
        document.querySelector(".solicitacao-aya-fala").textContent,
      ).toMatch(/Escolha a aba de onde você trabalha/);
      expect($("accessRequestTitulo").textContent).toBe(
        "Solicitação de acesso",
      );
      expect($("solicitacaoOnde").textContent).toBe("Onde você trabalha?");
      expect(document.querySelector(".solicitacao-onde").textContent).toContain(
        "Vai avaliar outra área? Diga na justificativa",
      );
      expect($("accessReqNome").value).toBe("Ana Souza");
      expect($("accessReqEmailCampo").readOnly).toBe(true);
      expect($("accessReqEmailCampo").value).toBe("u1@agenciasus.org.br");
      expect(
        [...document.querySelectorAll('[role="tab"]')].map(
          (b) => b.textContent,
        ),
      ).toEqual(["Projetos", "Saúde Indígena", "SEDE"]);
      expect(aba("Saúde Indígena").getAttribute("aria-selected")).toBe("true");
    });

    it("Saúde Indígena: DSEI antes de CASAI, cargos da área e coordenação", async () => {
      await desenhar(supabaseDaTela());
      const grupos = [
        ...$("accessReqLotacao").querySelectorAll("optgroup"),
      ].map((g) => g.label);
      expect(grupos).toEqual(["DSEI", "CASAI"]);
      expect(opcoesDe("accessReqLotacao")).toEqual([
        "Escolha",
        "DSEI Altamira",
        "DSEI Yanomami",
        "CASAI São Paulo",
      ]);
      expect(opcoesDe("accessReqCargo")).toContain(
        "Coordenação de DSEI ou CASAI",
      );
      expect(opcoesDe("accessReqCargo")).not.toContain("Jurídico");
      expect(opcoesDe("accessReqCoordenacao")).toEqual(["Não sei", "Norte"]);
    });

    it("Projetos: lista de projetos, sem coordenação; SEDE: setor em texto e Jurídico", async () => {
      const pedido = await desenhar(supabaseDaTela());
      await clicar(aba("Projetos"));
      expect(pedido.obter().campos.area).toBe("projetos");
      expect(opcoesDe("accessReqLotacao")).toEqual([
        "Escolha",
        "MFC",
        "Saúde nas Fronteiras",
      ]);
      expect($("accessReqCoordenacao")).toBeNull();
      expect(opcoesDe("accessReqCargo")).toContain("Coordenação de projeto");
      await clicar(aba("SEDE"));
      expect($("accessReqLotacao").tagName).toBe("INPUT");
      expect(opcoesDe("accessReqCargo")).toContain("Jurídico");
    });

    it("'Outro' abre o campo da descrição", async () => {
      await desenhar(supabaseDaTela());
      expect($("accessReqCargoOutro")).toBeNull();
      await escolher($("accessReqCargo"), "OUTRO");
      expect($("accessReqCargoOutro")).not.toBeNull();
    });

    it("lista de unidades que não carregou: erro e 'Tentar de novo'", async () => {
      const sb = supabaseDaTela({ falhaNasOpcoes: true });
      await desenhar(sb);
      expect(document.body.textContent).toContain(
        "Não foi possível carregar a lista.",
      );
      await clicar($("accessReqLotacaoRecarregar"));
      expect(chamadas(sb, "listar_opcoes_da_solicitacao_acesso")).toHaveLength(
        2,
      );
    });

    it("justificativa curta: nada vai ao banco e o campo diz o que falta", async () => {
      const sb = supabaseDaTela();
      await desenhar(sb);
      await escolher($("accessReqCargo"), "AVALIADOR");
      await escolher($("accessReqLotacao"), "DSEI Yanomami");
      await digitar($("accessReqJustificativa"), "Preciso ver");
      await clicar($("accessRequestBtn"));
      expect(chamadas(sb, "registrar_solicitacao_acesso")).toHaveLength(0);
      expect(document.body.textContent).toContain(
        "Escreva ao menos 20 caracteres (faltam 9).",
      );
    });
  });

  describe("página: pedido enviado, editar e cancelar", () => {
    async function preencherEEnviar(sb) {
      await escolher($("accessReqCargo"), "AVALIADOR");
      await escolher($("accessReqLotacao"), "DSEI Yanomami");
      await digitar($("accessReqJustificativa"), JUSTIFICATIVA);
      await clicar($("accessRequestBtn"));
      return chamadas(sb, "registrar_solicitacao_acesso").at(-1)?.[1];
    }

    it("enviado: argumentos por área e 'Pedido enviado — aguardando aprovação' com o resumo", async () => {
      const sb = supabaseDaTela({ pedidos: [null, PENDENTE] });
      await desenhar(sb);
      expect(await preencherEEnviar(sb)).toEqual({
        p_nome: "Ana Souza",
        p_area: "saude-indigena",
        p_cargo: "AVALIADOR",
        p_cargo_outro: null,
        p_lotacao: "DSEI Yanomami",
        p_justificativa: JUSTIFICATIVA,
        p_coordenacao: null,
      });
      expect($("accessRequestStatusTitulo").textContent).toBe(
        "Pedido enviado — aguardando aprovação",
      );
      expect($("accessRequestResumo").textContent).toContain("DSEI Yanomami");
      expect($("accessRequestForm")).toBeNull();
      expect(
        document.querySelector(".solicitacao-aya-fala").textContent,
      ).toMatch(/Não chega e-mail/);
    });

    it("editar: o formulário volta com o pedido; salvar grava e volta ao resumo", async () => {
      const sb = supabaseDaTela({
        pedidos: [PENDENTE, { ...PENDENTE, setor: "DSEI Altamira" }],
      });
      await desenhar(sb);
      await clicar($("accessRequestEditarBtn"));
      expect($("accessReqLotacao").value).toBe("DSEI Yanomami");
      expect($("accessRequestBtn").textContent).toBe("Salvar alterações");
      expect($("accessRequestStatus")).toBeNull();
      await escolher($("accessReqLotacao"), "DSEI Altamira");
      await clicar($("accessRequestBtn"));
      expect(
        chamadas(sb, "registrar_solicitacao_acesso").at(-1)[1].p_lotacao,
      ).toBe("DSEI Altamira");
      expect($("accessRequestResumo").textContent).toContain("DSEI Altamira");
    });

    it("editar e voltar: nada vai ao banco", async () => {
      const sb = supabaseDaTela({ pedidos: [PENDENTE] });
      await desenhar(sb);
      await clicar($("accessRequestEditarBtn"));
      await clicar($("accessRequestVoltarBtn"));
      expect($("accessRequestResumo")).not.toBeNull();
      expect(chamadas(sb, "registrar_solicitacao_acesso")).toHaveLength(0);
    });

    it("cancelar pede confirmação, cancela e volta ao formulário com o que foi pedido", async () => {
      const sb = supabaseDaTela({
        pedidos: [PENDENTE, { ...PENDENTE, status: "cancelado" }],
      });
      await desenhar(sb);
      await clicar($("accessRequestCancelarBtn"));
      expect(chamadas(sb, "cancelar_minha_solicitacao_acesso")).toHaveLength(0);
      await clicar($("accessRequestConfirmarCancelamento"));
      expect(chamadas(sb, "cancelar_minha_solicitacao_acesso")).toHaveLength(1);
      expect(document.body.textContent).toContain(AVISO_CANCELADO);
      expect($("accessReqLotacao").value).toBe("DSEI Yanomami");
      expect($("accessRequestBtn").textContent).toBe("Enviar pedido");
    });

    it("falha no envio: aviso com a mensagem do banco e o botão volta", async () => {
      const sb = supabaseDaTela({
        erroNoEnvio: {
          code: "22023",
          message: "Escolha o DSEI ou a CASAI na lista.",
        },
      });
      const pedido = await desenhar(sb);
      await preencherEEnviar(sb);
      expect(document.body.textContent).toContain(
        "Não foi possível enviar o pedido: Escolha o DSEI ou a CASAI na lista.",
      );
      expect(pedido.obter().enviando).toBe(false);
    });

    it("rede cai no envio (a promessa rejeita): aviso e o botão não fica preso", async () => {
      const sb = supabaseDaTela({ redeCaiNoEnvio: true });
      const pedido = await desenhar(sb);
      await preencherEEnviar(sb);
      expect(document.body.textContent).toContain(
        "Não foi possível enviar o pedido",
      );
      expect(pedido.obter().enviando).toBe(false);
    });
  });

  describe("página: recusado, desativada e liberado", () => {
    it("recusado: mostra o motivo e permite novo pedido com o que foi pedido", async () => {
      await desenhar(supabaseDaTela({ pedidos: [RECUSADO] }));
      expect($("accessRequestStatusTexto").textContent).toContain(
        "Motivo: Área ou lotação não confere — o DSEI é outro.",
      );
      expect($("accessReqLotacao").value).toBe("DSEI Yanomami");
      expect($("accessRequestBtn").textContent).toBe("Enviar novo pedido");
    });

    it("conta desativada: 'Pedir reativação' abre só nome e justificativa", async () => {
      const sb = supabaseDaTela({
        desativadaNoBanco: true,
        pedidos: [{ status: "aprovado" }, { ...PENDENTE, area: null }],
      });
      await desenhar(sb);
      expect($("accessRequestTitulo").textContent).toBe("Acesso desativado");
      expect($("accessRequestForm")).toBeNull();
      await clicar($("accessRequestReativarBtn"));
      expect(document.querySelector('[role="tab"]')).toBeNull();
      expect($("accessReqCargo")).toBeNull();
      await digitar($("accessReqJustificativa"), JUSTIFICATIVA);
      await clicar($("accessRequestBtn"));
      expect(chamadas(sb, "registrar_solicitacao_acesso")[0][1]).toMatchObject({
        p_area: null,
        p_cargo: null,
        p_lotacao: null,
      });
      expect($("accessRequestStatusTitulo").textContent).toBe(
        "Pedido de reativação enviado",
      );
    });

    it("a marca da tela de desativada segura a reativação quando o banco não diz", async () => {
      lembrarContaDesativada("u1", window);
      await desenhar(supabaseDaTela({ pedidos: [PENDENTE] }));
      expect($("accessRequestTitulo").textContent).toBe("Acesso desativado");
    });

    it("aprovado com perfil ativo: 'Entrar agora'", async () => {
      await desenhar(
        supabaseDaTela({
          pedidos: [{ status: "aprovado" }],
          contexto: { profile: { id: "p1", ativo: true, perfil: "usuario" } },
        }),
      );
      expect($("accessRequestEnterBtn")).not.toBeNull();
    });

    it("os botões da conta chamam a sessão", async () => {
      await desenhar(supabaseDaTela());
      await clicar($("accessSwitchAccountBtn"));
      await clicar($("accessReturnLoginBtn"));
      expect(sessaoFalsa.entrarComGoogle).toHaveBeenCalled();
      expect(sessaoFalsa.limparSessao).toHaveBeenCalled();
    });
  });

  describe("estado: antes de saber a situação e sem consulta", () => {
    it("verificando: sem formulário", () => {
      const visao = visaoDoPedido({
        ...criarPedidoDeAcesso({ cliente: () => null }).obter(),
        carregando: true,
      });
      expect(visao).toMatchObject({
        titulo: TITULO_VERIFICANDO,
        conteudo: "oculto",
      });
    });

    it("consulta que falha: formulário com aviso", async () => {
      const sb = supabaseDaTela();
      sb.rpc.mockImplementation(async (nome) =>
        nome === "obter_minha_solicitacao_acesso"
          ? { data: null, error: { message: "x" } }
          : { data: null, error: null },
      );
      await desenhar(sb);
      expect(document.body.textContent).toContain(AVISO_SEM_CONSULTA);
      expect($("accessRequestForm")).not.toBeNull();
    });

    it("o front nunca pede acesso automático (garantir_acesso_basico)", async () => {
      const sb = supabaseDaTela();
      await desenhar(sb);
      expect(chamadas(sb, "garantir_acesso_basico")).toHaveLength(0);
    });
  });
});
