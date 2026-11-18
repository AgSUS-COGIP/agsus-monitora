// @vitest-environment node
import { bloco } from "./apoio/bloco.ts";
import { describe, expect, it, afterEach, vi, beforeEach } from "vitest";
import {
  ACCESS_BACKGROUND_MAX_BYTES,
  createAccessBackgroundPath,
  validateAccessBackgroundFile,
} from "../src/lib/entrada/access-background-storage.ts";
import {
  DEFAULT_ACCESS_BRANDING,
  needsLightForeground,
  normalizeAccessBackgroundUrl,
  normalizeAccessLogoUrl,
  normalizeAccessPanelColor,
} from "../src/lib/entrada/access-branding.ts";
import {
  chaveDaDesativacao,
  chaveDoUsuario,
  mensagemDaComemoracao,
  oQuePodeUsar,
  primeiraEntradaDeConvidado,
  tipoDeComemoracao,
} from "../src/lib/acessos/acesso-liberado.ts";
import {
  tomDoAviso,
  urlDeImagem,
} from "../src/lib/configuracoes/apresentacao-das-configuracoes.ts";
import {
  areaParaLocalizar,
  buscarLinhas,
  ehAtalhoDaBusca,
  LIMITE_DE_RESULTADOS,
  partesRealcadas,
  proximoIndice,
  seloDoRisco,
  subtituloDoResultado,
  textoDaBusca,
  tituloDoResultado,
} from "../src/lib/navegacao/busca-global.ts";
import { readFileSync, readdirSync, statSync } from "node:fs";
import {
  ABAS_DO_MENU,
  AREAS_DO_SISTEMA,
  abasDoCatalogo,
  montarArvoreDoMenu,
  paginasDaArea,
  AREA_DOS_PAINEIS,
  AREAS_DO_MENU,
  BLOCOS_DA_AREA,
  FLUTUANTE_FECHADO,
  areaAberta,
  areasDoUsuario,
  blocoDaAba,
  blocosDaAdministracao,
  blocosDaArea,
  destinoAoTrocarDeArea,
  ehAreaDoSistema,
  iconesDoCatalogo,
  itemAtivoDaArvore,
  navegacaoTransborda,
  nomeDaArea,
  posicaoDoPainelFlutuante,
  proximoFlutuante,
  recortarArvorePorArea,
} from "../src/lib/navegacao/menu-lateral.ts";
import {
  RESOURCES,
  hasResource,
} from "../src/lib/acessos/permissoes-recursos.ts";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.ts";
import {
  abasDoMenu,
  carregarCatalogoDeAbas,
  consultaDoCatalogoDeAbas,
} from "../src/modules/catalogo-de-abas.ts";
import { join } from "node:path";
import { SUPABASE_AUTH_STORAGE_KEY } from "../src/lib/sessao/env";
import {
  MOTIVO_NAO_REGISTRADO,
  argumentosDaReativacao,
  contasDaResposta,
  errosDaReativacao,
  grupoInicialDoPedido,
  linhaDaDesativacao,
  linhaDoPedidoDeReativacao,
  mensagemDaRecusaDeReativacao,
  mensagemDeContaReativada,
  motivoDaDesativacao,
  resumoDeContas,
  valoresIniciaisDaReativacao,
} from "../src/lib/acessos/contas-desativadas.ts";
import {
  gerenciariaAcessosSemCoordenacao,
  ALVO_COORDENACAO,
  ALVO_GRUPO,
  alteracoesDoRascunho as alteracoesDoRascunho__1,
  celulaExibida,
  avisoDoConflito,
  rebasearRascunho,
  registrarNoRascunho,
  resumoDoRascunho as resumoDoRascunho__2,
} from "../src/lib/acessos/matriz-de-acessos.ts";
import {
  canManageAccess,
  roleLabel,
  ACCESS_ROLES,
  podeEditarCoordenadas,
  podeVerPessoasOnline,
  canManageEditais,
  canChangeCandidateStatus,
  canImportApprovedList,
  secaoDeConfiguracaoPermitida,
  canMoveEditalBetweenAreas,
  isAdminGlobal,
  paginasPermitidas,
  podeAbrirConfiguracoes,
  paineisPermitidos,
} from "../src/lib/acessos/access-roles.ts";
import {
  PARTES_DA_COPIA,
  VALIDADE_DA_COPIA_MS,
  assinaturaDoAcesso,
  assinaturaDoTexto,
  consultasDosDados,
  copiaServe,
  dadosDasRespostas,
  montarCopia,
  partesQueMudaram,
  respostasDasConsultas,
} from "../src/lib/sessao/copia-da-sessao";
import {
  ESQUEMA_DA_COPIA,
  VERSAO_DA_COPIA,
  apagarCopiaDaSessao,
  guardarCopiaDaSessao,
  lerCopiaDaSessao,
} from "../src/modules/copia-da-sessao-indexeddb.ts";
import { COLUNAS_DO_MONITORAMENTO } from "../src/app/carga.ts";
import {
  sanitizeCsvCell,
  sanitizeCsvDocument,
} from "../src/lib/seguranca/csv-security";
import {
  SAIDA_DESCONHECIDA,
  SAIDA_EXPIRADA,
  SAIDA_MANUAL,
  SAIDA_REVOGADA,
  causaDaSaida,
  declararSaida,
  encerrarTransicaoDeSaida,
  mensagemDaSaida,
  reivindicarSaida,
  reiniciarEstadoDeSaidaParaTestes,
  saidaJaAplicada,
} from "../src/lib/sessao/estado-de-saida";
import { origemDeTerceiro } from "../src/lib/seguranca/origem-da-requisicao.ts";
import {
  avisoDeTransformarEmCoordenacao,
  codigoAPartirDoNome,
  confirmacaoDeTransformarValida,
  nomeDaCoordenacaoDaConta,
  coordenacaoParaSalvar,
  coordenacaoVazia,
  opcoesDeUnidadesDaCoordenacao,
  grupoParaSalvar,
  grupoVazio,
  resumoDaCoordenacao,
  validarCoordenacao,
  validarGrupo,
} from "../src/lib/acessos/grupos-e-coordenacoes.ts";
import { linkInterno } from "../src/lib/navegacao/link-interno.ts";
import { irParaTela } from "../src/app/ir-para-tela.ts";
import {
  getLoadingStage,
  isGenericLoadingCopy,
  normalizeLoadingProgress,
} from "../src/lib/entrada/loading-copy";
import { SECOES } from "../src/modulos/configuracoes/secoes.ts";
import { NOMES_DE_ICONES } from "../src/modules/icones.ts";
import {
  isMobileOAuthContext,
  startMobileGoogleOAuth,
} from "../src/lib/sessao/auth-flow";
import {
  alteracoesDoRascunho,
  estadoDoAlvo,
  linhaDoHistorico,
  motivoValido,
  originaisDaArvore,
  problemasDoRascunho,
  registrarCampo,
  registrarEstado,
  resumoDoRascunho,
  valorDoCampo,
} from "../src/lib/navegacao/modulos-e-abas.ts";
import { criarEstadoDosAcessos } from "../src/modulos/acessos/estado.ts";
import {
  TELA_SEM_ACESSO,
  bloqueioDaTela,
  codigoDoPainel,
  ehPainelExterno,
  telaDeEntrada,
  telaInicialDoSistema,
  telaPermitida,
} from "../src/lib/navegacao/navegacao";
import {
  POLITICA_PADRAO,
  comNovasTentativas,
  criarOrcamento,
  ehTokenVencido,
  esperaAntesDaTentativa,
  esperaPedidaPeloServidor,
} from "../src/lib/sessao/novas-tentativas.ts";
import { esperaDaReleitura } from "../src/lib/classificacao/relatorio-de-desempate.ts";
import {
  normalizeOnlinePresenceList,
  ondeEstaNoMonitora,
  rotuloDoLocal,
} from "../src/lib/sessao/online-presence";
import {
  chaveDoErroDoPainel,
  errosDosPaineis,
  linhasDosPaineis,
  mudarRascunhoDoPainel,
  normalizarPaineis,
  paineisComRascunho,
  resumoDosPaineis,
  situacaoDoPainel,
} from "../src/lib/configuracoes/paineis-externos-das-configuracoes.ts";
import {
  CHAVES_DAS_SECOES,
  errosDasSecoes,
  linhasDasSecoes,
  normalizarBooleano,
  normalizarInteiro,
  normalizarValoresCarregados,
} from "../src/lib/configuracoes/publicacao-de-configuracoes.ts";
import {
  isAllowedInstitutionalEmail,
  normalizeAllowedDomains,
  normalizePlatformContext,
  profileDisplayName,
} from "../src/lib/navegacao/platform-context";
import { fonteDoApp } from "./fonte-do-app.ts";
import { LOGO_PADRAO_DA_BARRA } from "../src/lib/navegacao/marca-da-barra-lateral.ts";
import { criarNavegacao } from "../src/app/navegacao.ts";
import {
  shouldCheckForUpdate,
  shouldReloadAfterControllerChange,
} from "../src/modules/pwa-lifecycle.ts";
import {
  TELAS_DAS_AREAS,
  caminhoDoDestino,
  destinoDoCaminho,
  editalEhAPagina,
  ehRaizDoApp,
  telaDaRota,
} from "../src/lib/navegacao/rotas.ts";
import { paginaDoCaminho } from "../server/servidor.ts";
import {
  aptosEEliminados,
  calcularIndicadores,
  tabelaDaSelecao,
  eliminadosAntesDaAnalise,
  FILTROS_VAZIOS,
  filtrarVagas,
  filtrosAtivos,
  formatarQuantidade,
  formatarTaxa,
  normalizarPayload,
  observacoesDoRecorte,
  opcoesDosFiltros,
  PAINEL_DE_SELECAO,
  payloadMudou,
  rotuloDaUnidade,
  somar,
  taxaDeContratacao,
  topUnidades,
  triadosEReprovados,
} from "../src/lib/selecao/selecao-do-painel.ts";
import {
  AuthApiError,
  AuthRetryableFetchError,
  AuthSessionMissingError,
} from "@supabase/supabase-js";
import {
  FalhaDeConexao,
  SESSAO_ATIVA,
  SESSAO_ENCERRADA,
  SESSAO_INDETERMINADA,
  SessaoEncerrada,
  ehFalhaTransitoria,
  ehSessaoEncerrada,
  estadoDaSessao,
  exigirSessao,
} from "../src/lib/sessao/sessao";
import {
  abaDaPagina,
  areaEstaAtiva,
  dicaDaManutencao,
  filtrarAreasAtivas,
  formatarPrevisao,
  MENSAGEM_PADRAO_DE_MANUTENCAO,
  normalizarSituacaoDoSistema,
  situacaoEfetiva,
  SITUACAO_PADRAO,
  textoDaFaixaDoAdministrador,
  textosDaManutencao,
} from "../src/lib/navegacao/situacao-dos-modulos.ts";
import {
  carregarSituacaoDoSistema,
  consultaDaSituacaoDoSistema,
  esquecerSituacaoDoSistema,
  situacaoDoSistema,
} from "../src/app/situacao-do-sistema.ts";
import { avisoDaPagina } from "../src/lib/navegacao/pagina-desligada.ts";
import {
  abasDeAcessos,
  celulaSoLeitura,
  gruposAtribuiveis,
  nivelMaximo,
  opcoesDoModulo,
  podeEditarUsuario,
  valorDoSelect,
} from "../src/lib/acessos/teto-de-acessos.ts";
import {
  capacidadesDoPerfil,
  contextoDepoisDeSalvar,
  menuDoContexto,
  resumoDoEscopo,
} from "../src/lib/acessos/ver-como.ts";

bloco("access-background-storage", () => {
  describe("access background storage", () => {
    it("accepts supported images up to the bucket limit", () => {
      expect(
        validateAccessBackgroundFile({
          type: "image/webp",
          size: ACCESS_BACKGROUND_MAX_BYTES,
        }),
      ).toBe("");
    });

    it("rejects unsupported or oversized files", () => {
      expect(
        validateAccessBackgroundFile({ type: "image/svg+xml", size: 10 }),
      ).toContain("JPG");
      expect(
        validateAccessBackgroundFile({
          type: "image/png",
          size: ACCESS_BACKGROUND_MAX_BYTES + 1,
        }),
      ).toContain("6 MB");
    });

    it("creates immutable branding paths to avoid stale CDN content", () => {
      expect(
        createAccessBackgroundPath(
          { type: "image/png" },
          () => "123e4567-e89b-12d3-a456-426614174000",
        ),
      ).toBe("branding/acesso-123e4567-e89b-12d3-a456-426614174000.png");
    });
  });
});

bloco("access-branding", () => {
  describe("access branding", () => {
    it("accepts secure and local background URLs", () => {
      expect(
        normalizeAccessBackgroundUrl("https://example.org/campaign.png"),
      ).toBe("https://example.org/campaign.png");
      expect(normalizeAccessBackgroundUrl("/assets/campaign.png")).toBe(
        "/assets/campaign.png",
      );
    });

    it("rejects unsafe background URLs", () => {
      expect(normalizeAccessBackgroundUrl("javascript:alert(1)")).toBe(
        DEFAULT_ACCESS_BRANDING.backgroundUrl,
      );
    });

    it("uses the official local AgSUS logo by default", () => {
      expect(normalizeAccessLogoUrl("")).toBe("/assets/agsus-logo.webp");
      expect(normalizeAccessLogoUrl("https://example.org/agsus.svg")).toBe(
        "https://example.org/agsus.svg",
      );
      expect(normalizeAccessLogoUrl("data:image/svg+xml,unsafe")).toBe(
        "/assets/agsus-logo.webp",
      );
    });

    it("normalizes panel color and contrast", () => {
      expect(normalizeAccessPanelColor("#C296EB")).toBe("#c296eb");
      expect(normalizeAccessPanelColor("purple")).toBe(
        DEFAULT_ACCESS_BRANDING.panelColor,
      );
      expect(needsLightForeground("#101c2a")).toBe(true);
      expect(needsLightForeground("#ffffff")).toBe(false);
    });
  });
});

bloco("acesso-liberado", () => {
  const AGORA = Date.parse("2026-09-30T15:00:00Z");
  const HORA = 60 * 60 * 1000;

  describe("que comemoração mostrar", () => {
    it("perfil criado há até 3 dias (pedido aprovado): liberado; mais antigo, não", () => {
      const base = { usuarioId: "u1", agora: AGORA };
      expect(
        tipoDeComemoracao({
          ...base,
          contaCriadaEm: new Date(AGORA - 200 * HORA),
          perfilCriadoEm: new Date(AGORA - 5 * HORA),
        }),
      ).toBe("liberado");
      expect(
        tipoDeComemoracao({
          ...base,
          contaCriadaEm: new Date(AGORA - 200 * HORA),
          perfilCriadoEm: new Date(AGORA - 80 * HORA),
        }),
      ).toBeNull();
    });

    it("depois de 'Entrar agora': liberado, uma vez por pessoa", () => {
      expect(tipoDeComemoracao({ usuarioId: "u1", pedidoLiberado: true })).toBe(
        "liberado",
      );
      expect(
        tipoDeComemoracao({
          usuarioId: "u1",
          pedidoLiberado: true,
          jaComemorou: true,
        }),
      ).toBeNull();
      expect(
        tipoDeComemoracao({ usuarioId: "", pedidoLiberado: true }),
      ).toBeNull();
    });

    it("primeira entrada de convidado: conta Google nova e perfil anterior a ela", () => {
      const convidado = {
        usuarioId: "u1",
        contaCriadaEm: new Date(AGORA - HORA).toISOString(),
        perfilCriadoEm: new Date(AGORA - 30 * HORA).toISOString(),
        agora: AGORA,
      };
      expect(tipoDeComemoracao(convidado)).toBe("liberado");
      expect(tipoDeComemoracao({ ...convidado, jaComemorou: true })).toBeNull();
    });

    it("não comemora conta antiga, perfil criado depois da conta, nem sem datas", () => {
      expect(
        primeiraEntradaDeConvidado({
          contaCriadaEm: new Date(AGORA - 48 * HORA),
          perfilCriadoEm: new Date(AGORA - 72 * HORA),
          agora: AGORA,
        }),
      ).toBe(false);
      // Perfil criado depois da conta (pedido aprovado, acesso básico): não é convite.
      expect(
        primeiraEntradaDeConvidado({
          contaCriadaEm: new Date(AGORA - 2 * HORA),
          perfilCriadoEm: new Date(AGORA - HORA),
          agora: AGORA,
        }),
      ).toBe(false);
      expect(tipoDeComemoracao({ usuarioId: "u1" })).toBeNull();
    });

    it("quem viu a tela de desativado e voltou: reativado (mesmo já tendo comemorado antes)", () => {
      expect(
        tipoDeComemoracao({
          usuarioId: "u1",
          estavaDesativada: true,
          jaComemorou: true,
        }),
      ).toBe("reativado");
      expect(chaveDaDesativacao("u1")).not.toBe(chaveDoUsuario("u1"));
    });

    it("frases com o primeiro nome", () => {
      expect(mensagemDaComemoracao("liberado", "ANA LUÍSA costa")).toBe(
        "Boas-vindas, Ana! Seu acesso ao Yeendé foi liberado.",
      );
      expect(
        mensagemDaComemoracao("reativado", "", "joao.silva@agenciasus.org.br"),
      ).toBe("Que bom ter você de volta, Joao! Seu acesso foi reativado.");
      expect(mensagemDaComemoracao("liberado", "", "")).toBe(
        "Boas-vindas! Seu acesso ao Yeendé foi liberado.",
      );
    });
  });

  describe("o que a pessoa pode usar agora", () => {
    it("áreas da pessoa com os módulos que têm nível, com os nomes do menu", () => {
      expect(
        oQuePodeUsar({
          areas: ["saude-indigena"],
          permissoes: {
            dashboard: "leitor",
            analises: "leitor",
            nucleo: "editor",
            calendario: "sem_acesso",
            acessos: "sem_acesso",
          },
        }),
      ).toEqual(["Saúde Indígena: Visão geral, Painel das análises, Editais"]);
    });

    it("administrador global: todas as áreas; sem nenhum módulo, lista vazia", () => {
      const linhas = oQuePodeUsar({ admin_global: true });
      expect(linhas.length).toBeGreaterThan(1);
      expect(linhas[0]).toMatch(/^Saúde Indígena: Visão geral, /);
      expect(linhas[0]).toContain("Gestão de acessos");
      expect(
        oQuePodeUsar({ areas: ["sede"], permissoes: { nucleo: "sem_acesso" } }),
      ).toEqual([]);
      expect(oQuePodeUsar(null)).toEqual([]);
    });
  });
});

bloco("apresentacao-das-configuracoes", () => {
  /*
  Regras sem DOM das prévias de Configurações (os grupos e as prévias são
  React: src/modulos/configuracoes/; o comportamento na tela está em
  tests/casca-sessao-e-interface-na-tela.test.js (bloco modulos/configuracoes-inicio-acesso-aparencia)).
*/
  describe("regras da apresentação", () => {
    it("aviso: cada tipo tem tom, ícone e rótulo; desconhecido vira informação", () => {
      expect(tomDoAviso("danger")).toMatchObject({
        tom: "danger",
        rotulo: "Crítico",
      });
      expect(tomDoAviso("warning").tom).toBe("warning");
      expect(tomDoAviso("xyz").tom).toBe("info");
    });

    it("imagem só de caminho do site ou http(s)", () => {
      expect(urlDeImagem("/assets/logo.png")).toBe("/assets/logo.png");
      expect(urlDeImagem("https://x.org/l.png")).toBe("https://x.org/l.png");
      expect(urlDeImagem("javascript:alert(1)")).toBe("");
      expect(urlDeImagem("data:image/png;base64,AAA")).toBe("");
      expect(urlDeImagem("//outro.site/l.png")).toBe("");
    });
  });
});

bloco("busca-global", () => {
  const linha = (extra) => ({
    id: 1,
    edital: "Edital 01/2026",
    unidade: "DSEI Xavante",
    etapa: "Inscrições",
    uf: "MT",
    risco: "Alto",
    ...extra,
  });

  describe("buscarLinhas", () => {
    it("descarta resultados sem id e entradas malformadas, aceitando id zero", () => {
      expect(
        buscarLinhas(
          [
            null,
            linha({ id: undefined }),
            linha({ id: {} }),
            linha({ unidade: {} }),
            linha({ id: 0 }),
          ],
          "xavante",
        ).map((l) => l.id),
      ).toEqual([0]);
      expect(buscarLinhas([linha()], "xavante", 0)).toEqual([]);
      expect(buscarLinhas([linha()], "xavante", Infinity)).toEqual([]);
    });

    it("para de ler a fonte quando alcança o limite", () => {
      const posteriores = {
        get id() {
          throw new Error("Não deveria ler além do limite");
        },
      };
      expect(buscarLinhas([linha(), posteriores], "xavante", 1)).toHaveLength(
        1,
      );
    });
    it("termo vazio ou só espaços não lista nada", () => {
      expect(buscarLinhas([linha()], "")).toEqual([]);
      expect(buscarLinhas([linha()], "   ")).toEqual([]);
    });

    it("procura nos nove campos, sem diferenciar maiúsculas e ignorando espaços nas pontas", () => {
      const linhas = [
        linha({ id: 1, status: "Em andamento" }),
        linha({ id: 2, ciclo: "2026" }),
        linha({ id: 3, responsavel: "Maria" }),
        linha({ id: 4, observacoes: "Aguardando PUBLICAÇÃO" }),
        linha({ id: 5, unidade: "DSEI Yanomami", uf: "RR" }),
      ];
      expect(buscarLinhas(linhas, "  maria ").map((l) => l.id)).toEqual([3]);
      expect(buscarLinhas(linhas, "publicação").map((l) => l.id)).toEqual([4]);
      expect(buscarLinhas(linhas, "andamento").map((l) => l.id)).toEqual([1]);
      expect(buscarLinhas(linhas, "rr").map((l) => l.id)).toEqual([5]);
      expect(buscarLinhas(linhas, "alto")).toHaveLength(5);
    });

    it("não procura em campos fora da lista", () => {
      expect(buscarLinhas([linha({ municipio: "Barra" })], "barra")).toEqual(
        [],
      );
    });

    it("os campos viram um texto só: o termo pode atravessar dois deles", () => {
      expect(textoDaBusca(linha())).toContain("edital 01/2026 dsei xavante");
      expect(buscarLinhas([linha()], "2026 dsei")).toHaveLength(1);
    });

    it("mantém a ordem das linhas e para em 12", () => {
      const linhas = Array.from({ length: 20 }, (_, i) => linha({ id: i }));
      const achadas = buscarLinhas(linhas, "xavante");
      expect(LIMITE_DE_RESULTADOS).toBe(12);
      expect(achadas.map((l) => l.id)).toEqual([...Array(12).keys()]);
    });

    it("aceita lista ausente", () => {
      expect(buscarLinhas(null, "x")).toEqual([]);
    });
  });

  describe("textos do resultado", () => {
    it("título: edital (ou '-') e unidade", () => {
      expect(tituloDoResultado(linha())).toBe("Edital 01/2026 — DSEI Xavante");
      expect(tituloDoResultado(linha({ edital: "" }))).toBe("- — DSEI Xavante");
    });

    it("subtítulo: etapa e, se houver, UF", () => {
      expect(subtituloDoResultado(linha())).toBe("Inscrições · MT");
      expect(subtituloDoResultado(linha({ uf: "" }))).toBe("Inscrições");
      expect(subtituloDoResultado(linha({ etapa: null, uf: "AM" }))).toBe(
        " · AM",
      );
    });

    it("selo do risco: Alto, Médio (com ou sem acento) e Baixo para o resto", () => {
      expect(seloDoRisco("ALTO")).toEqual({ tom: "red", texto: "Alto" });
      expect(seloDoRisco("médio")).toEqual({ tom: "yellow", texto: "Médio" });
      expect(seloDoRisco("medio")).toEqual({ tom: "yellow", texto: "Médio" });
      expect(seloDoRisco("baixo")).toEqual({ tom: "green", texto: "Baixo" });
      expect(seloDoRisco(undefined)).toEqual({ tom: "green", texto: "Baixo" });
    });
  });

  describe("partesRealcadas", () => {
    it("preserva espaços e índices do realce nas pontas", () => {
      expect(partesRealcadas("  Saúde  ", "saude")).toEqual([
        { texto: "  ", realce: false },
        { texto: "Saúde", realce: true },
        { texto: "  ", realce: false },
      ]);
    });
    it("marca todas as ocorrências, sem diferenciar maiúsculas", () => {
      expect(partesRealcadas("Dsei dsei X", " DSEI ")).toEqual([
        { texto: "Dsei", realce: true },
        { texto: " ", realce: false },
        { texto: "dsei", realce: true },
        { texto: " X", realce: false },
      ]);
    });

    it("sem termo ou sem ocorrência, o texto inteiro sem marca", () => {
      expect(partesRealcadas("Xavante", "")).toEqual([
        { texto: "Xavante", realce: false },
      ]);
      expect(partesRealcadas("Xavante", "zzz")).toEqual([
        { texto: "Xavante", realce: false },
      ]);
      expect(partesRealcadas("", "x")).toEqual([]);
    });
  });

  describe("proximoIndice", () => {
    it("setas andam sem passar das pontas; -1 é nenhum", () => {
      expect(proximoIndice(-1, "ArrowDown", 3)).toBe(0);
      expect(proximoIndice(2, "ArrowDown", 3)).toBe(2);
      expect(proximoIndice(0, "ArrowUp", 3)).toBe(0);
      expect(proximoIndice(-1, "ArrowUp", 3)).toBe(0);
      expect(proximoIndice(-1, "ArrowDown", 0)).toBe(-1);
      expect(proximoIndice(-1, "ArrowUp", 0)).toBe(-1);
      expect(proximoIndice(1, "Enter", 3)).toBe(1);
    });
  });

  describe("ehAtalhoDaBusca", () => {
    it("Ctrl+K e Cmd+K", () => {
      expect(ehAtalhoDaBusca({ ctrlKey: true, key: "k" })).toBe(true);
      expect(ehAtalhoDaBusca({ metaKey: true, key: "k" })).toBe(true);
      expect(ehAtalhoDaBusca({ key: "k" })).toBe(false);
      expect(ehAtalhoDaBusca({ ctrlKey: true, key: "j" })).toBe(false);
    });
  });

  describe("busca sem acento e atalho com Caps Lock", () => {
    it("'saude indigena' acha 'Saúde Indígena' e o realce cai no lugar certo", () => {
      const l = linha({ unidade: "Saúde Indígena", etapa: "Convocação" });
      expect(buscarLinhas([l], "saude indigena")).toHaveLength(1);
      expect(buscarLinhas([l], "convocacao")).toHaveLength(1);
      expect(partesRealcadas("Saúde Indígena", "indigena")).toEqual([
        { texto: "Saúde ", realce: false },
        { texto: "Indígena", realce: true },
      ]);
    });

    it("Ctrl+K com Caps Lock ou Shift também abre", () => {
      expect(ehAtalhoDaBusca({ ctrlKey: true, key: "K" })).toBe(true);
    });
  });

  describe("área ao abrir um resultado", () => {
    const areas = ["saude-indigena", "sede"];
    it("linha de outra área do usuário: troca para ela", () => {
      expect(areaParaLocalizar("sede", "saude-indigena", areas)).toBe("sede");
    });
    it("mesma área, área que o usuário não tem ou sem área: fica", () => {
      expect(areaParaLocalizar("sede", "sede", areas)).toBe("");
      expect(areaParaLocalizar("projetos", "sede", areas)).toBe("");
      expect(areaParaLocalizar("", "sede", areas)).toBe("");
    });
  });
});

bloco("catalogo-de-abas", () => {
  /*
  Etapa 1 do "tudo vira aba": as abas de cada área saem do código para o banco
  (TB_ABA × RL_ABA_AREA, lidas por `listar_abas_do_menu`), e nada muda na tela.

  A prova tem duas pontas (as migrations saíram do repositório; vale a resposta real):
  - a resposta real da função, capturada no ensaio do menu
    (`fixtures/listar-abas-do-menu-triagem.json`), é o catálogo do código (`ABAS_DO_MENU`);
  - a árvore do menu, com o catálogo do banco ou com o do código, é a de antes
    desta mudança (`fixtures/menu-lateral-antes-do-catalogo.json`, gerada com o
    código antigo) em toda combinação de permissão e área.
*/
  const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
  const RESPOSTA_DO_ENSAIO_DO_MENU = JSON.parse(
    ler("tests/fixtures/listar-abas-do-menu-triagem.json"),
  );
  /*
  A resposta de `listar_abas_do_menu` com todas as áreas: a do ensaio da Pré-classificação com
  as trocas do menu reorganizado (20261029150000) já aplicadas, gravada quando as migrations
  saíram do repositório.
*/
  const RESPOSTA_DO_ENSAIO = JSON.parse(
    ler("tests/fixtures/listar-abas-do-menu-completo.json"),
  );
  const ARVORES_DE_ANTES = JSON.parse(
    ler("tests/fixtures/menu-lateral-antes-do-catalogo.json"),
  );

  const camposDaAba = ({ id, rotulo, icone, ordem, view, recurso, tipo }) => ({
    id,
    rotulo,
    icone,
    ordem,
    view,
    recurso,
    tipo,
  });
  const paginasPorArea = (abas) =>
    Object.fromEntries(
      AREAS_DO_SISTEMA.map((area) => [area.id, paginasDaArea(abas, area.id)]),
    );

  describe("o catálogo do banco é o do código", () => {
    const doBanco = abasDoCatalogo(RESPOSTA_DO_ENSAIO);

    it("as mesmas abas, com os mesmos campos", () => {
      // A Triagem (código técnico pre-classificacao) já está ligada no banco
      // (#597) e entra também no catálogo do código.
      expect(doBanco.map(camposDaAba)).toEqual(ABAS_DO_MENU.map(camposDaAba));
      expect(
        doBanco.find((aba) => aba.id === "pre-classificacao"),
      ).toMatchObject({
        id: "pre-classificacao",
        rotulo: "Triagem",
        icone: "list-checks",
        view: "pre-classificacao",
        ordem: 8,
        recurso: "avaliacao_documental",
      });
    });

    it("as mesmas páginas em cada área (view, rótulo, ícone e ordem)", () => {
      expect(paginasPorArea(doBanco)).toEqual(paginasPorArea(ABAS_DO_MENU));
    });

    it("a resposta real do ensaio do menu novo é o catálogo do código", () => {
      expect(
        abasDoCatalogo(RESPOSTA_DO_ENSAIO_DO_MENU).map(camposDaAba),
      ).toEqual(ABAS_DO_MENU.map(camposDaAba));
    });

    it("o recurso de cada aba é um recurso de permissão que existe", () => {
      const recursos = new Set(RESOURCES.map(([id]) => id));
      expect(ABAS_DO_MENU.filter((aba) => !recursos.has(aba.recurso))).toEqual(
        [],
      );
    });

    it("toda view do catálogo é uma tela que o front desenha", () => {
      const telas = new Set([
        "dashboard",
        "nucleo",
        "calendario",
        "approved",
        "analises",
        "avaliacao-documental",
        "pre-classificacao",
        "entrevistas",
        "conduzir-entrevistas",
        "recursos",
        "analisar-recursos",
        "selecao",
        "classificacao",
        "paineis-de-dados",
      ]);
      const views = Object.values(paginasPorArea(ABAS_DO_MENU)).flatMap(
        (paginas) => paginas.map((pagina) => pagina.view),
      );
      expect(views.filter((view) => !telas.has(view))).toEqual([]);
    });
  });

  /*
  As mesmas entradas que geraram a fixture com o código de antes: um painel,
  uma seção de configuração, e as permissões como o `buildNav` as calcula.
*/
  const PERMISSOES = {
    admin: {
      dashboard: true,
      nucleo: true,
      calendario: true,
      approved: true,
      analises: true,
      config: true,
    },
    usuario: {
      dashboard: true,
      nucleo: true,
      calendario: true,
      approved: true,
      analises: false,
      config: false,
    },
    "so-editais": { nucleo: true, approved: true },
    "sem-permissao": {},
  };
  const AREAS = {
    todas: ["saude-indigena", "sede", "projetos"],
    si: ["saude-indigena"],
    sede: ["sede"],
    projetos: ["projetos"],
    "sede-e-projetos": ["sede", "projetos"],
    "contexto-antigo": undefined,
  };
  const COMBINACOES = Object.entries(PERMISSOES).flatMap(([p, permitidas]) =>
    Object.entries(AREAS).map(([a, areas]) => [
      `${p} × ${a}`,
      permitidas,
      areas,
    ]),
  );

  const resumo = (arvore) =>
    arvore.map(
      (grupo) =>
        `${grupo.id}: ${grupo.itens
          .map((i) =>
            [i.view, i.rotulo, i.icone, i.area ?? i.secao ?? ""].join("|"),
          )
          .join(" · ")}`,
    );
  const arvore = (permitidas, areas, abas) =>
    montarArvoreDoMenu({
      permitidas,
      paineis: [{ codigo: "recursos", titulo: "Recursos" }],
      secoesDeConfiguracao: [{ id: "acessos", rotulo: "Acessos" }],
      areas,
      abas,
    });

  /*
  A fixture guarda a árvore de cada combinação (permissão × área). Foi gerada
  com o código de antes do catálogo e regenerada no menu reorganizado de
  29/10 (blocos Acompanhar/Processo seletivo, nova ordem): com o catálogo do
  banco ou com o do código, a árvore é a mesma.
*/
  describe("a árvore é a mesma com o catálogo do banco ou do código", () => {
    it("a fixture cobre todas as combinações", () => {
      expect(Object.keys(ARVORES_DE_ANTES).sort()).toEqual(
        COMBINACOES.map(([nome]) => nome).sort(),
      );
    });

    const doBanco = abasDoCatalogo(RESPOSTA_DO_ENSAIO);

    it.each(COMBINACOES)("%s", (nome, permitidas, areas) => {
      const antes = ARVORES_DE_ANTES[nome];
      expect(resumo(arvore(permitidas, areas))).toEqual(antes);
      expect(resumo(arvore(permitidas, areas, doBanco))).toEqual(antes);
      expect(arvore(permitidas, areas, doBanco)).toEqual(
        arvore(permitidas, areas),
      );
    });
  });

  describe("a árvore segue o catálogo do banco quando ele chega", () => {
    it("aba fora de uma área some só dela; troca de ordem e ícone vale", () => {
      const resposta = structuredClone(RESPOSTA_DO_ENSAIO);
      const analises = resposta.find((aba) => aba.co_aba === "analises");
      analises.areas = analises.areas.filter((a) => a.co_area !== "sede");
      const editais = resposta.find((aba) => aba.co_aba === "editais");
      Object.assign(
        editais.areas.find((a) => a.co_area === "projetos"),
        { nu_ordem: 99, ds_icone: "folder" },
      );
      const grupos = Object.fromEntries(
        arvore(PERMISSOES.admin, AREAS.todas, abasDoCatalogo(resposta)).map(
          (g) => [g.id, g.itens],
        ),
      );
      expect(grupos.sede.map((i) => i.view)).not.toContain("analises");
      expect(grupos["saude-indigena"].map((i) => i.view)).toContain("analises");
      expect(grupos.projetos.at(-1)).toEqual({
        view: "nucleo",
        rotulo: "Editais",
        bloco: "processo",
        icone: "folder",
        area: "projetos",
      });
    });
  });

  describe("resposta estranha vira o catálogo do código", () => {
    it.each([
      ["nula", null],
      ["objeto", { co_aba: "editais" }],
      ["lista vazia", []],
      ["só linhas sem código, rótulo ou view", [{ co_aba: "x" }, null, 7]],
    ])("%s: abasDoCatalogo devolve null", (_, dados) => {
      expect(abasDoCatalogo(dados)).toBeNull();
    });

    it("linha incompleta sai; área sem código também", () => {
      const abas = abasDoCatalogo([
        { co_aba: "x", no_aba: "X" },
        {
          co_aba: "editais",
          no_aba: "Editais",
          ds_icone: "file-text",
          nu_ordem: 2,
          co_view: "nucleo",
          areas: [{ co_area: "sede" }, { nu_ordem: 1 }],
        },
      ]);
      expect(abas.map((aba) => aba.id)).toEqual(["editais"]);
      expect(paginasDaArea(abas, "sede")).toEqual([
        {
          view: "nucleo",
          rotulo: "Editais",
          icone: "file-text",
          bloco: "processo",
        },
      ]);
    });

    it("montarArvoreDoMenu sem catálogo (ou vazio) usa o do código", () => {
      const esperado = arvore(PERMISSOES.admin, AREAS.todas, ABAS_DO_MENU);
      expect(arvore(PERMISSOES.admin, AREAS.todas, null)).toEqual(esperado);
      expect(arvore(PERMISSOES.admin, AREAS.todas, [])).toEqual(esperado);
    });
  });

  describe("carga do catálogo na sessão", () => {
    afterEach(async () => {
      vi.restoreAllMocks();
      await carregarCatalogoDeAbas({ consulta: Promise.resolve(null) });
    });

    it("pede listar_abas_do_menu, sem argumentos", async () => {
      const sb = {
        rpc: vi.fn(() => Promise.resolve({ data: [], error: null })),
      };
      await consultaDoCatalogoDeAbas(sb);
      expect(sb.rpc).toHaveBeenCalledWith("listar_abas_do_menu");
    });

    it("consulta que rejeita vira resposta com erro, sem lançar", async () => {
      const erro = new Error("rede");
      const sb = { rpc: () => Promise.reject(erro) };
      await expect(consultaDoCatalogoDeAbas(sb)).resolves.toEqual({
        data: null,
        error: erro,
      });
      await expect(consultaDoCatalogoDeAbas(null)).resolves.toEqual({
        data: null,
        error: null,
      });
    });

    it("com o catálogo do banco, o menu passa a vir dele", async () => {
      const usou = await carregarCatalogoDeAbas({
        consulta: Promise.resolve({ data: RESPOSTA_DO_ENSAIO, error: null }),
      });
      expect(usou).toBe(true);
      expect(abasDoMenu()).not.toBe(ABAS_DO_MENU);
      expect(abasDoMenu().map((aba) => aba.id)).toEqual(
        ABAS_DO_MENU.map((aba) => aba.id),
      );
    });

    it.each([
      [
        "função ainda não publicada",
        { data: null, error: { code: "PGRST202" } },
        false,
      ],
      ["erro do banco", { data: null, error: { code: "42501" } }, true],
      ["resposta vazia", { data: [], error: null }, false],
    ])("%s: volta ao catálogo do código", async (_, resposta, avisa) => {
      const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
      await carregarCatalogoDeAbas({
        consulta: Promise.resolve({ data: RESPOSTA_DO_ENSAIO, error: null }),
      });
      const usou = await carregarCatalogoDeAbas({
        consulta: Promise.resolve(resposta),
      });
      expect(usou).toBe(false);
      expect(abasDoMenu()).toBe(ABAS_DO_MENU);
      expect(aviso).toHaveBeenCalledTimes(avisa ? 1 : 0);
    });

    it("consulta que rejeita também volta ao catálogo do código", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const usou = await carregarCatalogoDeAbas({
        consulta: Promise.reject(new Error("rede")),
      });
      expect(usou).toBe(false);
      expect(abasDoMenu()).toBe(ABAS_DO_MENU);
    });
  });

  describe("contrato e acesso da função", () => {
    it("está no contrato, sem argumentos e sem derrubar a verificação", () => {
      expect(CONTRATO_RPC.listar_abas_do_menu).toMatchObject({
        argumentos: [],
        critica: false,
      });
    });
  });

  /*
  Selo "BETA": campo opcional só do front por enquanto (`ABAS_DO_MENU`), fora
  da comparação seed × código. Quando o banco mandar `ds_selo` ou `beta`, vale
  o do banco; sem eles, o do código.
*/
  describe("selo beta das abas", () => {
    const recursosDe = (abas) =>
      abas.find((aba) => aba.id === "analisar-recursos");

    it("no fallback, somente as abas já publicadas no banco são beta", () => {
      const beta = [
        "entrevistas",
        "selecao",
        "pre-classificacao",
        "avaliacao-documental",
        "analisar-recursos",
        "conduzir-entrevistas",
        "classificacao",
        "paineis-de-dados",
      ];
      expect(
        ABAS_DO_MENU.filter((aba) => aba.beta).map((aba) => aba.id),
      ).toEqual(beta);
      expect(
        ABAS_DO_MENU.filter((aba) => !beta.includes(aba.id)).some((aba) =>
          Object.hasOwn(aba, "beta"),
        ),
      ).toBe(false);
    });

    it("o banco de hoje (sem ds_selo) herda o selo do código", () => {
      expect(recursosDe(abasDoCatalogo(RESPOSTA_DO_ENSAIO)).beta).toBe(true);
      expect(
        paginasDaArea(abasDoCatalogo(RESPOSTA_DO_ENSAIO), "sede").find(
          (pagina) => pagina.view === "analisar-recursos",
        ),
      ).toEqual({
        view: "analisar-recursos",
        rotulo: "Recursos",
        icone: "gavel",
        bloco: "processo",
        beta: true,
      });
    });

    it("ds_selo ou beta do banco valem sobre o código", () => {
      const comSelo = (campos) =>
        abasDoCatalogo(
          RESPOSTA_DO_ENSAIO.map((aba) => ({
            ...aba,
            ...(aba.co_aba === "analisar-recursos" ? campos : {}),
            ...(aba.co_aba === "editais" ? { ds_selo: "BETA" } : {}),
          })),
        );
      expect(recursosDe(comSelo({ ds_selo: null })).beta).toBeUndefined();
      expect(recursosDe(comSelo({ beta: false })).beta).toBeUndefined();
      expect(comSelo({}).find((aba) => aba.id === "editais").beta).toBe(true);
    });

    it("o item do menu leva o selo da página beta", () => {
      const itens = montarArvoreDoMenu({
        permitidas: { nucleo: true, "analisar-recursos": true },
      })[0].itens;
      expect(itens.find((i) => i.view === "analisar-recursos").beta).toBe(true);
      expect(
        Object.hasOwn(
          itens.find((i) => i.view === "nucleo"),
          "beta",
        ),
      ).toBe(false);
    });
  });
});

bloco("catalogo-do-menu-invalido", () => {
  const aba = {
    co_aba: "editais",
    no_aba: "Editais",
    co_view: "nucleo",
    co_recurso: "nucleo",
    ds_icone: "file-text",
    nu_ordem: 2,
    areas: [{ co_area: "sede" }],
  };

  describe("catálogo do menu recebido do banco", () => {
    it.each([null, {}, "catálogo", [null, [], 12, false, {}]])(
      "usa a alternativa do código quando não há abas válidas: %j",
      (dados) => {
        expect(abasDoCatalogo(dados)).toBeNull();
        const arvore = montarArvoreDoMenu({
          permitidas: { nucleo: true },
          areas: ["sede"],
          abas: abasDoCatalogo(dados),
        });
        expect(arvore[0].itens[0].view).toBe("nucleo");
      },
    );

    it("ignora linhas e áreas malformadas sem transformar objetos em identificações", () => {
      const catalogo = abasDoCatalogo([
        null,
        { ...aba, co_aba: {} },
        { ...aba, no_aba: [] },
        { ...aba, co_view: 123 },
        {
          ...aba,
          areas: [null, { co_area: {} }, { co_area: "sede", nu_ordem: false }],
        },
      ]);
      expect(catalogo).toHaveLength(1);
      expect(catalogo[0].areas).toHaveLength(1);
      expect(catalogo[0].areas[0].ordem).toBeNull();
      expect(paginasDaArea(catalogo, "sede")[0].view).toBe("nucleo");
    });

    it("preserva manutenção, beta e substituições de view e ícone por área", () => {
      const catalogo = abasDoCatalogo([
        {
          ...aba,
          st_beta: true,
          tp_situacao: "MANUTENCAO",
          ds_mensagem: "Ajustes",
          dt_previsao: "2026-10-10",
          areas: [
            {
              co_area: "sede",
              co_view: "calendario",
              ds_icone: "calendar-days",
              nu_ordem: 1,
            },
          ],
        },
      ]);
      expect(paginasDaArea(catalogo, "sede")).toEqual([
        {
          view: "calendario",
          rotulo: "Editais",
          icone: "calendar-days",
          bloco: "processo",
          beta: true,
          manutencao: { mensagem: "Ajustes", previsao: "2026-10-10" },
        },
      ]);
    });
  });
});

bloco("chaves-de-sessao", () => {
  /*
  As suítes de navegador semeiam a sessão escrevendo direto no armazenamento, e
  precisam usar a mesma chave que a aplicação lê. Elas não podem importar
  `src/lib/sessao/env.ts`: esse módulo lê `import.meta.env`, que não existe no runtime do
  Playwright e derruba o ficheiro inteiro ao ser carregado.

  A chave fica, portanto, literal nos specs — e este teste é o que impede a
  divergência. Ele existe porque a divergência já aconteceu: até 08/09/2026 o
  spec de Análises usava "sb-gnudtaxhjfgtvwkwpsel-auth-token", nome anterior à
  unificação do cliente. Quem definisse só a sessão semeava numa chave que
  ninguém consulta, e a corrida seguia por um caminho não autenticado sem avisar.
*/

  const specs = readdirSync("tests")
    .filter((nome) => nome.endsWith(".spec.js"))
    .map((nome) => ({
      nome,
      fonte: readFileSync(join("tests", nome), "utf8"),
    }));

  describe("chave de armazenamento da sessão nos testes de navegador", () => {
    it("todo spec que semeia sessão usa a chave da aplicação", () => {
      const semeadores = specs.filter(({ fonte }) =>
        fonte.includes("E2E_SUPABASE_STORAGE_KEY"),
      );
      expect(semeadores.length, "nenhum spec semeia sessão").toBeGreaterThan(0);

      for (const { nome, fonte } of semeadores) {
        expect(fonte, `${nome} não usa a chave da aplicação`).toContain(
          `|| "${SUPABASE_AUTH_STORAGE_KEY}"`,
        );
      }
    });

    it("nenhum spec carrega a chave antiga como valor padrão", () => {
      for (const { nome, fonte } of specs) {
        const semComentarios = fonte
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/^\s*\/\/.*$/gm, "");
        expect(
          semComentarios,
          `${nome} ainda usa a chave antiga`,
        ).not.toContain("sb-gnudtaxhjfgtvwkwpsel-auth-token");
      }
    });

    /*
    Um spec autenticado que rodasse sem sessão passaria por vacuidade — verde sem
    ter exercitado nada. Todos precisam pular explicitamente quando falta a
    variável de ambiente.
  */
    it("todo spec autenticado pula quando falta a sessão, em vez de passar vazio", () => {
      const autenticados = specs.filter(({ fonte }) =>
        fonte.includes("E2E_SUPABASE_SESSION_JSON"),
      );
      expect(autenticados.length).toBeGreaterThan(0);
      for (const { nome, fonte } of autenticados) {
        expect(fonte, `${nome} não pula sem sessão`).toMatch(
          /test\.skip\(\s*!sessionJson/,
        );
      }
    });
  });
});

bloco("contas-desativadas", () => {
  /*
  Contas desativadas: desativar fazia a conta sumir, sem reativar e sem o
  motivo. Agora a aba "Desativadas" diz quando, por quem e por quê, e
  reativa com as mesmas travas do banco (23514).
*/

  const GRUPOS = [
    { codigo: "usuario", nome: "Usuário", niveis: { acessos: "sem_acesso" } },
    {
      codigo: "coordenador",
      nome: "Coordenador",
      niveis: { acessos: "editor" },
    },
    { codigo: "admin", nome: "Administrador", admin_global: true, niveis: {} },
  ];

  const CONTA = {
    id: "p1",
    nome: "Ana",
    email: "ana@agenciasus.org.br",
    grupo: "coordenador",
    coordenacao: "norte",
    areas: ["saude-indigena"],
    desativada_em: "2026-09-30T15:00:00Z",
    desativada_por: "adm@agenciasus.org.br",
    motivo: "Saiu da equipe",
  };

  describe("lista de contas desativadas", () => {
    it("resposta vira lista, mesmo vazia ou estranha", () => {
      expect(contasDaResposta({ contas: [CONTA] })).toEqual([CONTA]);
      expect(contasDaResposta({ ok: true })).toEqual([]);
      expect(contasDaResposta(null)).toEqual([]);
    });

    it("quando e por quem; sem autor, sem 'por'", () => {
      expect(linhaDaDesativacao(CONTA)).toBe(
        "Desativada em 30/09/2026 por adm@agenciasus.org.br",
      );
      expect(linhaDaDesativacao({ ...CONTA, desativada_por: null })).toBe(
        "Desativada em 30/09/2026",
      );
    });

    it("motivo, ou 'motivo não registrado' nas antigas", () => {
      expect(motivoDaDesativacao(CONTA)).toBe("Saiu da equipe");
      expect(motivoDaDesativacao({ ...CONTA, motivo: null })).toBe(
        MOTIVO_NAO_REGISTRADO,
      );
      expect(MOTIVO_NAO_REGISTRADO).toBe("motivo não registrado");
    });

    it("resumo: '23 ativas · 2 desativadas' e singular", () => {
      expect(resumoDeContas({ ativas: 23, desativadas: 2 })).toBe(
        "23 ativas · 2 desativadas",
      );
      expect(resumoDeContas({ ativas: 1, desativadas: 1 })).toBe(
        "1 ativa · 1 desativada",
      );
      expect(resumoDeContas({ ativas: 1200, desativadas: null })).toBe(
        "1.200 ativas",
      );
    });
  });

  describe("reativação", () => {
    it("começa com o grupo, a coordenação e as áreas de antes", () => {
      expect(valoresIniciaisDaReativacao(CONTA, GRUPOS)).toEqual({
        grupo: "coordenador",
        coordenacao: "norte",
        areas: ["saude-indigena"],
        motivo: "",
      });
      // Grupo que não existe mais: volta para "usuario".
      expect(
        valoresIniciaisDaReativacao({ ...CONTA, grupo: "sumiu" }, GRUPOS).grupo,
      ).toBe("usuario");
    });

    it("travas: sem área e sem coordenação; quem gerencia acessos sem coordenação; motivo", () => {
      const base = { grupo: "usuario", coordenacao: "", areas: [], motivo: "" };
      expect(errosDaReativacao(base, GRUPOS)).toMatchObject({
        semArea: true,
        motivo: expect.stringContaining("motivo"),
      });
      expect(
        errosDaReativacao(
          { ...base, areas: ["saude-indigena"], motivo: "Voltou" },
          GRUPOS,
        ),
      ).toEqual({});
      expect(
        errosDaReativacao(
          {
            ...base,
            grupo: "coordenador",
            areas: ["saude-indigena"],
            motivo: "Voltou",
          },
          GRUPOS,
        ),
      ).toEqual({ semCoordenacao: true });
      expect(
        errosDaReativacao(
          {
            ...base,
            grupo: "coordenador",
            coordenacao: "norte",
            motivo: "Voltou",
          },
          GRUPOS,
        ),
      ).toEqual({});
      // Administrador global não precisa de área nem de coordenação.
      expect(
        errosDaReativacao(
          { ...base, grupo: "admin", motivo: "Voltou" },
          GRUPOS,
        ),
      ).toEqual({});
      expect(
        errosDaReativacao(
          { ...base, grupo: "admin", motivo: "x".repeat(501) },
          GRUPOS,
        ).motivo,
      ).toBeTruthy();
    });

    it("argumentos: admin sem coordenação/áreas; com coordenação, sem áreas", () => {
      expect(
        argumentosDaReativacao(
          CONTA,
          {
            grupo: "usuario",
            coordenacao: "",
            areas: ["saude-indigena"],
            motivo: " Voltou ",
          },
          GRUPOS,
        ),
      ).toEqual({
        p_perfil_usuario_id: "p1",
        p_grupo: "usuario",
        p_coordenacao: null,
        p_areas: ["saude-indigena"],
        p_motivo: "Voltou",
      });
      expect(
        argumentosDaReativacao(
          CONTA,
          {
            grupo: "coordenador",
            coordenacao: "norte",
            areas: ["x"],
            motivo: "Voltou",
          },
          GRUPOS,
        ),
      ).toMatchObject({ p_coordenacao: "norte", p_areas: [] });
      expect(
        argumentosDaReativacao(
          CONTA,
          { grupo: "admin", coordenacao: "norte", areas: ["x"], motivo: "V1" },
          GRUPOS,
        ),
      ).toMatchObject({ p_grupo: "admin", p_coordenacao: null, p_areas: [] });
    });

    it("recusas do banco: 23514 e 22023 com a mensagem dele; 42501 explicada", () => {
      expect(
        mensagemDaRecusaDeReativacao({
          code: "23514",
          message: "Sem coordenação, escolha ao menos uma área",
        }),
      ).toBe("Sem coordenação, escolha ao menos uma área");
      expect(
        mensagemDaRecusaDeReativacao({ code: "42501", message: "x" }),
      ).toBe("Só o administrador global pode reativar contas.");
      expect(
        mensagemDaRecusaDeReativacao({
          code: "22023",
          message: "Esta conta já está ativa",
        }),
      ).toBe("Esta conta já está ativa");
    });

    it("toast com o nome", () => {
      expect(mensagemDeContaReativada(CONTA)).toBe(
        "Conta reativada. Na próxima entrada, Ana verá as boas-vindas de volta.",
      );
      expect(mensagemDeContaReativada({ email: "b@x.org" })).toContain(
        "b@x.org",
      );
    });
  });

  describe("pedido de reativação em Pendentes", () => {
    const PEDIDO = {
      reativacao: true,
      desativada_em: "2026-09-30T15:00:00Z",
      desativada_por: "adm@agenciasus.org.br",
      motivo_desativacao: "Saiu da equipe",
      grupo_anterior: "coordenador",
    };

    it("linha: quando, por quem e o motivo", () => {
      expect(linhaDoPedidoDeReativacao(PEDIDO)).toBe(
        "Desativada em 30/09 por adm@agenciasus.org.br · motivo: Saiu da equipe",
      );
      expect(
        linhaDoPedidoDeReativacao({
          ...PEDIDO,
          desativada_por: null,
          motivo_desativacao: null,
        }),
      ).toBe("Desativada em 30/09 · motivo: motivo não registrado");
    });

    it("grupo do Aprovar: o de antes, se quem aprova pode atribuir", () => {
      expect(grupoInicialDoPedido(PEDIDO, GRUPOS)).toBe("coordenador");
      expect(grupoInicialDoPedido(PEDIDO, GRUPOS.slice(0, 1))).toBe("usuario");
      expect(grupoInicialDoPedido({ grupo_anterior: "admin" }, GRUPOS)).toBe(
        "usuario",
      );
    });
  });
});

bloco("coordenador-exige-coordenacao", () => {
  /*
  30/09: uma conta ficou em Coordenador sem coordenação; o menu mostrava
  Acessos e o banco recusava (42501). A tela e o banco passam a exigir a
  coordenação de quem gerencia acessos sem ser administrador global.
*/
  describe("coordenador exige coordenação", () => {
    it("gerenciar acessos sem coordenação e sem ser admin global é bloqueado", () => {
      expect(
        gerenciariaAcessosSemCoordenacao({
          adminGlobal: false,
          coordenacao: null,
          nivelAcessos: "editor",
        }),
      ).toBe(true);
      expect(
        gerenciariaAcessosSemCoordenacao({
          adminGlobal: false,
          coordenacao: "norte",
          nivelAcessos: "editor",
        }),
      ).toBe(false);
      expect(
        gerenciariaAcessosSemCoordenacao({
          adminGlobal: true,
          coordenacao: null,
          nivelAcessos: "admin",
        }),
      ).toBe(false);
      expect(
        gerenciariaAcessosSemCoordenacao({
          adminGlobal: false,
          coordenacao: null,
          nivelAcessos: "sem_acesso",
        }),
      ).toBe(false);
    });

    it("o menu só oferece Acessos ao coordenador que tem coordenação", () => {
      const base = { perfil: "coordenador", permissoes: { acessos: "editor" } };
      expect(canManageAccess({ ...base, coordenacao: null })).toBe(false);
      expect(
        canManageAccess({ ...base, coordenacao: { codigo: "norte" } }),
      ).toBe(true);
    });

    it("o rótulo do perfil mostra o grupo de verdade", () => {
      expect(
        roleLabel({
          perfil: "coordenador",
          grupo: { codigo: "coordenador", nome: "Coordenador" },
        }),
      ).toBe("Coordenador");
    });
  });
});

bloco("copia-da-sessao", () => {
  const ok = (data) => ({ data, error: null });
  const falha = { data: null, error: { message: "401" } };

  const RESPOSTAS = {
    config: ok([{ chave: "app_title", valor: "Monitora" }]),
    paineis: ok([{ id: 1, codigo: "bi" }]),
    // O mapa também vem com versão (migration 20261015000100).
    mapa: {
      ...ok([{ chave: "lmap", payload: { dsei: [] } }]),
      versao: "md5-do-mapa",
    },
    unidades: ok([{ id_unidade: 7, nome_oficial: "DSEI Yanomami" }]),
    abas: ok([{ co_aba: "editais", no_aba: "Editais", co_view: "nucleo" }]),
    // A RPC do monitoramento manda a versão das linhas (migration 20261013160000).
    monitoramento: {
      ...ok([{ id: 10, edital: "01/2026" }]),
      versao: "md5-das-linhas",
    },
  };

  const PERFIL = {
    id: "p1",
    perfil: "gestor",
    permissoes: { dashboard: 1, nucleo: 2 },
    areas: ["saude-indigena"],
    atualizado_em: "2026-09-28T10:00:00Z",
    ultimo_acesso: "2026-09-28T10:00:00Z",
  };

  describe("assinatura do acesso", () => {
    it("não muda com datas nem com a ordem de chaves e painéis", () => {
      const outraHora = {
        ultimo_acesso: "2026-09-29T08:00:00Z",
        areas: ["saude-indigena"],
        permissoes: { nucleo: 2, dashboard: 1 },
        perfil: "gestor",
        id: "p1",
        atualizado_em: "2026-09-29T08:00:00Z",
      };
      expect(assinaturaDoAcesso(outraHora, new Set(["b", "a"]))).toBe(
        assinaturaDoAcesso(PERFIL, ["a", "b"]),
      );
    });

    it.each([
      ["permissão", { permissoes: { dashboard: 1, nucleo: 1 } }],
      ["área", { areas: ["outra"] }],
      ["perfil", { perfil: "leitor" }],
      ["campo novo", { unidades_permitidas: [3] }],
    ])("muda quando muda %s", (_, mudanca) => {
      expect(assinaturaDoAcesso({ ...PERFIL, ...mudanca }, [])).not.toBe(
        assinaturaDoAcesso(PERFIL, []),
      );
    });

    it("muda quando muda um painel liberado", () => {
      expect(assinaturaDoAcesso(PERFIL, ["a"])).not.toBe(
        assinaturaDoAcesso(PERFIL, ["a", "b"]),
      );
    });
  });

  describe("dados das respostas", () => {
    it("guarda os dados de cada parte", () => {
      expect(dadosDasRespostas(RESPOSTAS)).toEqual({
        config: [{ chave: "app_title", valor: "Monitora" }],
        paineis: [{ id: 1, codigo: "bi" }],
        mapa: [{ chave: "lmap", payload: { dsei: [] } }],
        unidades: [{ id_unidade: 7, nome_oficial: "DSEI Yanomami" }],
        abas: [{ co_aba: "editais", no_aba: "Editais", co_view: "nucleo" }],
        versaoDoMapa: "md5-do-mapa",
        // As linhas e a versão delas: a próxima entrada pergunta só se mudou.
        monitoramento: {
          linhas: [{ id: 10, edital: "01/2026" }],
          versao: "md5-das-linhas",
        },
      });
    });

    it.each(["config", "paineis", "mapa", "unidades"])(
      "nenhuma cópia se %s falhou",
      (parte) => {
        expect(dadosDasRespostas({ ...RESPOSTAS, [parte]: falha })).toBeNull();
      },
    );

    /*
    O catálogo de abas tem reserva no código (o mesmo menu): falhar, ou a função
    ainda não existir no banco, não joga a cópia fora.
  */
    it("o catálogo de abas que falhou fica nulo, e a cópia continua", () => {
      const dados = dadosDasRespostas({ ...RESPOSTAS, abas: falha });
      expect(dados).not.toBeNull();
      expect(dados.abas).toBeNull();
      const semAbas = { ...RESPOSTAS };
      delete semAbas.abas;
      expect(dadosDasRespostas(semAbas).abas).toBeNull();
    });

    it("cópia antiga, sem a versão do mapa, volta sem versão (o banco manda o mapa inteiro)", async () => {
      const antiga = dadosDasRespostas(RESPOSTAS);
      delete antiga.versaoDoMapa;
      const { mapa } = await respostasDasConsultas(consultasDosDados(antiga));
      expect(mapa).toEqual({ ...RESPOSTAS.mapa, versao: null });
    });

    it("cópia antiga, sem o catálogo de abas, volta com as abas vazias", async () => {
      const antiga = dadosDasRespostas(RESPOSTAS);
      delete antiga.abas;
      const { abas } = await respostasDasConsultas(consultasDosDados(antiga));
      expect(abas).toEqual(ok(null));
    });

    it("nenhuma cópia se a tabela do monitoramento falhou", () => {
      expect(
        dadosDasRespostas({ ...RESPOSTAS, monitoramento: falha }),
      ).toBeNull();
    });

    it("sem permissão de monitoramento, a parte fica vazia", () => {
      expect(
        dadosDasRespostas({ ...RESPOSTAS, monitoramento: null }).monitoramento,
      ).toBeNull();
    });

    it("a cópia volta no formato das consultas", async () => {
      const dados = dadosDasRespostas(RESPOSTAS);
      const respostas = await respostasDasConsultas(consultasDosDados(dados));
      expect(respostas).toEqual(RESPOSTAS);
    });
  });

  describe("quando a cópia serve", () => {
    const sessao = { usuarioId: "u1", acesso: "a1", versao: "v1" };
    const agora = Date.UTC(2026, 8, 28);
    const copia = montarCopia({
      ...sessao,
      agora,
      dados: dadosDasRespostas(RESPOSTAS),
    });

    it("serve para o mesmo usuário, acesso e versão", () => {
      expect(copiaServe(copia, { ...sessao, agora: agora + 1000 })).toBe(true);
    });

    it.each([
      ["outro usuário", { usuarioId: "u2" }],
      ["acesso diferente", { acesso: "a2" }],
      ["outra versão publicada", { versao: "v2" }],
      ["vencida", { agora: agora + VALIDADE_DA_COPIA_MS + 1 }],
      ["guardada no futuro", { agora: agora - 1 }],
      ["sem usuário", { usuarioId: "" }],
    ])("não serve: %s", (_, mudanca) => {
      expect(copiaServe(copia, { ...sessao, agora, ...mudanca })).toBe(false);
    });

    it("não serve sem cópia ou sem dados", () => {
      expect(copiaServe(null, { ...sessao, agora })).toBe(false);
      expect(copiaServe({ ...copia, dados: null }, { ...sessao, agora })).toBe(
        false,
      );
    });
  });

  describe("o que mudou desde a cópia", () => {
    const anteriores = dadosDasRespostas(RESPOSTAS);

    it("nada, quando as respostas são as mesmas", () => {
      expect(
        partesQueMudaram(anteriores, structuredClone(anteriores)).size,
      ).toBe(0);
    });

    it("só a parte alterada", () => {
      const atuais = structuredClone(anteriores);
      atuais.monitoramento.linhas[0].edital = "02/2026";
      expect([...partesQueMudaram(anteriores, atuais)]).toEqual([
        "monitoramento",
      ]);
    });

    it("o catálogo de abas conta como parte", () => {
      const atuais = structuredClone(anteriores);
      atuais.abas = null;
      expect([...partesQueMudaram(anteriores, atuais)]).toEqual(["abas"]);
    });
  });

  /** IndexedDB mínimo: o jsdom não tem um. Chamadas assíncronas, como no navegador. */
  function indexedDBFalso() {
    const lojas = new Map();
    const depois = (fn) => setTimeout(fn, 0);
    return {
      open() {
        const pedido = {};
        depois(() => {
          const banco = {
            createObjectStore: (nome) => lojas.set(nome, new Map()),
            transaction(nome) {
              const transacao = {};
              const loja = lojas.get(nome);
              const operar = (fazer) => {
                const op = {};
                depois(() => {
                  op.result = fazer();
                  depois(() => transacao.oncomplete?.());
                });
                return op;
              };
              transacao.objectStore = () => ({
                get: (chave) => operar(() => structuredClone(loja.get(chave))),
                put: (valor, chave) =>
                  operar(
                    () => loja.set(chave, structuredClone(valor)) && chave,
                  ),
                delete: (chave) =>
                  operar(() => loja.delete(chave) && undefined),
              });
              return transacao;
            },
            close() {},
          };
          pedido.result = banco;
          if (!lojas.size) pedido.onupgradeneeded?.();
          pedido.onsuccess?.();
        });
        return pedido;
      },
    };
  }

  describe("armazenamento da cópia", () => {
    const original = globalThis.indexedDB;
    afterEach(() => {
      globalThis.indexedDB = original;
    });

    it("guarda, lê e apaga", async () => {
      globalThis.indexedDB = indexedDBFalso();
      const copia = { usuarioId: "u1", dados: { config: [] } };
      expect(await lerCopiaDaSessao()).toBeNull();
      expect(await guardarCopiaDaSessao(copia)).toBe(true);
      expect(await lerCopiaDaSessao()).toEqual(copia);
      await apagarCopiaDaSessao();
      expect(await lerCopiaDaSessao()).toBeNull();
    });

    it("sem IndexedDB, não há cópia e nada lança erro", async () => {
      globalThis.indexedDB = undefined;
      expect(await lerCopiaDaSessao()).toBeNull();
      expect(await guardarCopiaDaSessao({ usuarioId: "u1" })).toBe(false);
      await expect(apagarCopiaDaSessao()).resolves.toBeUndefined();
    });
  });

  describe("versão da cópia", () => {
    it("é o formato do registro, não o endereço do bundle: uma publicação nova não perde a cópia", () => {
      expect(VERSAO_DA_COPIA).not.toMatch(/https?:|file:|\/assets\//);
      expect(VERSAO_DA_COPIA.startsWith(`${ESQUEMA_DA_COPIA}:`)).toBe(true);
      for (const parte of PARTES_DA_COPIA)
        expect(VERSAO_DA_COPIA).toContain(parte);
    });

    it("a assinatura das colunas é estável e muda quando a lista muda", () => {
      expect(assinaturaDoTexto("a,b,c")).toBe(assinaturaDoTexto("a,b,c"));
      expect(assinaturaDoTexto("a,b,c")).not.toBe(assinaturaDoTexto("a,b,c,d"));
      expect(assinaturaDoTexto("")).toMatch(/^[0-9a-f]{8}$/);
    });
  });
});

bloco("cronograma-sem-duplicata", () => {
  const CRONOGRAMA = [
    "cronograma_automatico",
    "cronograma_percentual",
    "cronograma_atividade_atual",
    "cronograma_proxima_atividade",
    "cronograma_proxima_data",
    "cronograma_dias_para_proxima",
  ];

  /*
  As seis colunas de `CRONOGRAMA` não existem em `TB_MONITORAMENTO_INDIGENA` —
  são calculadas em `VW_MONITORAMENTO_INDIGENA_OPERACIONAL`, que a RPC
  `listar_monitoramento_operacional` lê (migration 20261013160000).
*/

  /*
  O servidor não era o gargalo (medido em 09/09/2026: a view inteira em 31 ms).
  O atraso estava no navegador: a tabela era desenhada pela requisição
  principal, sem as colunas de cronograma, e o selo de cada linha só nascia
  quando uma SEGUNDA leitura completa da mesma view voltava
  (`health-status-details.js`, que saiu com a Visão geral em React). Hoje há uma
  leitura só: a da carga principal, que a Visão geral lê de
  dados-do-monitoramento.ts.
*/
  describe("uma leitura só do monitoramento", () => {
    it("a requisição principal traz as seis colunas de cronograma", () => {
      const colunas = COLUNAS_DO_MONITORAMENTO.split(",");
      expect(colunas.length).toBeGreaterThan(30);
      for (const coluna of CRONOGRAMA) {
        expect(colunas, `${coluna} ausente da carga principal`).toContain(
          coluna,
        );
      }
    });

    it("nenhuma coluna usada pela tabela e pelos detalhes falta na carga principal", () => {
      const colunas = new Set(COLUNAS_DO_MONITORAMENTO.split(","));
      for (const usada of [
        ...CRONOGRAMA,
        "status",
        "unidade",
        "edital",
        "link_edital",
        "responsavel",
        "observacoes",
      ]) {
        expect(
          colunas,
          `${usada} é lida por src/lib/visao-geral/visao-geral.ts`,
        ).toContain(usada);
      }
    });

    it("a Visão geral não relê a view por conta própria", () => {
      const pasta = "src/modulos/visao-geral";
      for (const arquivo of readdirSync(pasta)) {
        const fonte = readFileSync(`${pasta}/${arquivo}`, "utf8");
        expect(fonte, arquivo).not.toContain('.from("TB_');
      }
    });
  });
});

bloco("csv-security", () => {
  describe("csv-security", () => {
    it("neutraliza os prefixos interpretados como fórmula por planilhas", () => {
      expect(sanitizeCsvCell('=HYPERLINK("https://example.com")')).toBe(
        '\'=HYPERLINK("https://example.com")',
      );
      expect(sanitizeCsvCell("+CMD")).toBe("'+CMD");
      expect(sanitizeCsvCell("-1+1")).toBe("'-1+1");
      expect(sanitizeCsvCell("@SUM(A1:A2)")).toBe("'@SUM(A1:A2)");
      expect(sanitizeCsvCell("  =1+1")).toBe("'  =1+1");
    });

    it("preserva textos e números comuns", () => {
      expect(sanitizeCsvCell("Candidato A")).toBe("Candidato A");
      expect(sanitizeCsvCell("12345")).toBe("12345");
      expect(sanitizeCsvCell(0)).toBe("0");
    });

    it("protege todas as células de um documento separado por ponto e vírgula", () => {
      const csv =
        'nome;analise\nMaria;=HYPERLINK("https://example.com")\nJoão;Regular';
      expect(sanitizeCsvDocument(csv)).toBe(
        'nome;analise\nMaria;\'=HYPERLINK("https://example.com")\nJoão;Regular',
      );
    });

    it("não parte células entre aspas que têm ; ou quebra de linha", () => {
      const csv = 'nome;obs\r\nMaria;"faltou;\n- reagendar; -5"\r\n';
      expect(sanitizeCsvDocument(csv)).toBe(csv);
    });

    it("protege a célula entre aspas que começa com fórmula", () => {
      // Exportação que põe toda célula entre aspas (ex.: exportCSV do legado).
      const csv = '"Edital";"Obs"\n"01/2026";"=HYPERLINK(""https://x"")"';
      expect(sanitizeCsvDocument(csv)).toBe(
        '"Edital";"Obs"\n"01/2026";"\'=HYPERLINK(""https://x"")"',
      );
    });

    it("não protege de novo a célula já protegida", () => {
      const csv = "a;\"'=1+1\";'-2";
      expect(sanitizeCsvDocument(csv)).toBe(csv);
    });
  });
});

bloco("estado-de-saida", () => {
  beforeEach(() => reiniciarEstadoDeSaidaParaTestes());

  describe("causa da saída", () => {
    it("começa desconhecida", () => {
      expect(causaDaSaida()).toBe(SAIDA_DESCONHECIDA);
    });

    it("saída voluntária não produz mensagem", () => {
      declararSaida(SAIDA_MANUAL);
      expect(mensagemDaSaida()).toBe("");
    });

    it("expiração e revogação produzem mensagens distintas", () => {
      declararSaida(SAIDA_EXPIRADA);
      const expirada = mensagemDaSaida();
      declararSaida(SAIDA_REVOGADA);
      const revogada = mensagemDaSaida();
      expect(expirada).toContain("Sessão encerrada");
      expect(revogada).not.toBe(expirada);
      expect(revogada).toBeTruthy();
    });

    it("causa inválida cai em desconhecida, nunca em manual", () => {
      declararSaida("qualquer-coisa");
      expect(causaDaSaida()).toBe(SAIDA_DESCONHECIDA);
    });

    /*
    `unknown` não é `expired`. Um `SIGNED_OUT` pode vir de outra aba, da
    sincronização do cliente, de um `signOut` local ou do arranque depois de uma
    saída — nada disso é expiração, e anunciá-la transforma um sucesso em falha
    aparente. Só a causa declarada com prova fala.
  */
    it("causa desconhecida é silêncio, nunca expiração", () => {
      declararSaida(SAIDA_DESCONHECIDA);
      expect(mensagemDaSaida()).toBe("");
      declararSaida("valor-que-nao-existe");
      expect(mensagemDaSaida()).toBe("");
    });

    it("somente expired produz a mensagem de expiração", () => {
      const comMensagemDeExpiracao = [
        SAIDA_MANUAL,
        SAIDA_EXPIRADA,
        SAIDA_REVOGADA,
        SAIDA_DESCONHECIDA,
      ].filter((causa) => mensagemDaSaida(causa).includes("Sessão encerrada"));
      expect(comMensagemDeExpiracao).toEqual([SAIDA_EXPIRADA]);
    });
  });

  describe("dono único da transição", () => {
    it("só a primeira reivindicação vence", () => {
      expect(reivindicarSaida()).toBe(true);
      expect(reivindicarSaida()).toBe(false);
      expect(reivindicarSaida()).toBe(false);
      expect(saidaJaAplicada()).toBe(true);
    });

    /*
    A regressão observada em produção: sair pelo botão, confirmar uma vez, e
    ainda assim ver o alerta amarelo "Sessão encerrada".

    A causa era um booleano consumido no primeiro `SIGNED_OUT`. Um segundo evento
    encontrava-o já em `false` e era lido como expiração. Aqui simula-se
    exatamente isso: vários eventos após uma saída manual.
  */
    it("vários SIGNED_OUT após saída manual não viram expiração", () => {
      declararSaida(SAIDA_MANUAL);

      const mensagens = [];
      for (let i = 0; i < 5; i += 1) {
        // Cada evento consulta a causa; só o primeiro aplica a transição.
        const aplicou = reivindicarSaida();
        mensagens.push({ aplicou, mensagem: mensagemDaSaida() });
      }

      expect(mensagens[0].aplicou).toBe(true);
      expect(mensagens.slice(1).every((m) => m.aplicou === false)).toBe(true);
      for (const { mensagem } of mensagens) {
        expect(mensagem).toBe("");
        expect(mensagem).not.toContain("Sessão encerrada");
      }
    });

    it("a causa manual sobrevive à transição inteira", () => {
      declararSaida(SAIDA_MANUAL);
      reivindicarSaida();
      expect(causaDaSaida()).toBe(SAIDA_MANUAL);
      expect(mensagemDaSaida()).toBe("");
    });

    it("entrar encerra a transição e devolve o estado ao início", () => {
      declararSaida(SAIDA_MANUAL);
      reivindicarSaida();
      encerrarTransicaoDeSaida();
      expect(causaDaSaida()).toBe(SAIDA_DESCONHECIDA);
      expect(saidaJaAplicada()).toBe(false);
    });

    /*
    Depois de entrar de novo, uma expiração real precisa voltar a ser
    distinguível — senão a correção de um bug criaria outro, silenciando avisos
    legítimos.
  */
    it("expiração real continua distinguível depois de uma saída manual", () => {
      declararSaida(SAIDA_MANUAL);
      reivindicarSaida();
      encerrarTransicaoDeSaida();

      declararSaida(SAIDA_EXPIRADA);
      expect(reivindicarSaida()).toBe(true);
      expect(mensagemDaSaida()).toContain("Sessão encerrada");
    });
  });
});

bloco("funai-proxy-endurecido", () => {
  function req(headers) {
    return { headers };
  }

  describe("origem da requisição aos proxies da Funai", () => {
    it("aceita requisição da própria aplicação", () => {
      expect(
        origemDeTerceiro(
          req({
            host: "yeende.vercel.app",
            referer: "https://yeende.vercel.app/index.html",
          }),
        ),
      ).toBe(false);
    });

    it("recusa site de terceiro usando o Yeendé como relé", () => {
      expect(
        origemDeTerceiro(
          req({
            host: "yeende.vercel.app",
            origin: "https://site-qualquer.example",
          }),
        ),
      ).toBe(true);
    });

    /*
    Deliberadamente frouxo: navegador ou política de privacidade que remove o
    cabeçalho não pode ficar sem mapa. O vetor de abuso real — terceiro
    embutindo nosso endereço — sempre envia a origem dele.
  */
    it("deixa passar quem não declara origem", () => {
      expect(origemDeTerceiro(req({ host: "yeende.vercel.app" }))).toBe(false);
    });

    it("vale em preview e em desenvolvimento, sem domínio fixo em código", () => {
      expect(
        origemDeTerceiro(
          req({ host: "localhost:8000", referer: "http://localhost:8000/" }),
        ),
      ).toBe(false);
      expect(
        origemDeTerceiro(
          req({
            host: "agsus-monitora-git-branch.vercel.app",
            origin: "https://agsus-monitora-git-branch.vercel.app",
          }),
        ),
      ).toBe(false);
    });

    it("ignora cabeçalho malformado em vez de quebrar", () => {
      expect(
        origemDeTerceiro(
          req({ host: "app.example", referer: "não é uma url" }),
        ),
      ).toBe(false);
      expect(origemDeTerceiro(req({}))).toBe(false);
      expect(origemDeTerceiro(undefined)).toBe(false);
    });

    it("compara sem diferenciar maiúsculas", () => {
      expect(
        origemDeTerceiro(
          req({ host: "App.Example", origin: "https://app.example" }),
        ),
      ).toBe(false);
    });
  });
});

bloco("gestor-e-coordenadas", () => {
  /*
  O perfil edital_gestor aparece como "Gestor" (o código não muda) e corrige
  coordenadas nos dois mapas, como o administrador global
  (private."FC_PODE_EDITAR_COORDENADA", 20261002200000).
*/
  describe('perfil "Gestor"', () => {
    it("o rótulo é Gestor e o valor interno continua edital_gestor", () => {
      expect(ACCESS_ROLES.find((r) => r.value === "edital_gestor").label).toBe(
        "Gestor",
      );
      expect(ACCESS_ROLES.map((r) => r.label)).not.toContain("Edital gestor");
      expect(roleLabel({ perfil: "edital_gestor" })).toBe("Gestor");
      // O nome do grupo vindo do banco continua mandando.
      expect(
        roleLabel({ perfil: "edital_gestor", grupo: { nome: "Gestor" } }),
      ).toBe("Gestor");
    });
  });

  describe("podeEditarCoordenadas", () => {
    it("administrador global e Gestor ativo podem", () => {
      expect(
        podeEditarCoordenadas({
          ativo: true,
          perfil: "admin",
          admin_global: true,
        }),
      ).toBe(true);
      expect(podeEditarCoordenadas({ ativo: true, perfil: "admin" })).toBe(
        true,
      );
      expect(
        podeEditarCoordenadas({ ativo: true, perfil: "edital_gestor" }),
      ).toBe(true);
      expect(
        podeEditarCoordenadas({
          ativo: true,
          perfil: "edital_gestor",
          admin_global: false,
          permissoes: { nucleo: "editor" },
        }),
      ).toBe(true);
    });

    it("usuário, leitor, contratador, coordenador, inativo e sem perfil não podem", () => {
      for (const perfil of ["usuario", "leitor", "contratador", "coordenador"])
        expect(podeEditarCoordenadas({ ativo: true, perfil }), perfil).toBe(
          false,
        );
      expect(
        podeEditarCoordenadas({ ativo: false, perfil: "edital_gestor" }),
      ).toBe(false);
      expect(
        podeEditarCoordenadas({ perfil: "admin", admin_global: false }),
      ).toBe(false);
      expect(podeEditarCoordenadas(null)).toBe(false);
      expect(podeEditarCoordenadas({})).toBe(false);
    });
  });

  describe("Pessoas online", () => {
    it("só administrador global e Gestor veem", () => {
      expect(
        podeVerPessoasOnline({
          ativo: true,
          perfil: "admin",
          admin_global: true,
        }),
      ).toBe(true);
      expect(
        podeVerPessoasOnline({ ativo: true, perfil: "edital_gestor" }),
      ).toBe(true);
      expect(podeVerPessoasOnline({ ativo: true, perfil: "usuario" })).toBe(
        false,
      );
      expect(podeVerPessoasOnline(null)).toBe(false);
    });
  });
});

bloco("grupos-e-coordenacoes", () => {
  describe("grupo de permissões", () => {
    it("código sai do nome, sem acento", () => {
      expect(codigoAPartirDoNome("Gestão Regional", "_")).toBe(
        "gestao_regional",
      );
      expect(codigoAPartirDoNome("Coordenação Norte 2")).toBe(
        "coordenacao-norte-2",
      );
    });

    it("novo grupo exige nome único e todo módulo com nível válido", () => {
      const rascunho = { ...grupoVazio(), nome: "Usuário" };
      expect(
        validarGrupo(rascunho, {
          existentes: [{ codigo: "usuario", nome: "Usuário" }],
        }).nome,
      ).toBeTruthy();
      const ok = { ...grupoVazio(), nome: "Analista" };
      expect(validarGrupo(ok)).toEqual({});
      expect(grupoParaSalvar(ok)).toMatchObject({
        codigo: "analista",
        nome: "Analista",
        revisao: null,
      });
      expect(Object.keys(grupoParaSalvar(ok).niveis)).toContain("acessos");
      expect(
        validarGrupo({
          ...ok,
          niveis: { ...ok.niveis, configuracoes: "leitor" },
        }).configuracoes,
      ).toBeTruthy();
    });
  });

  describe("coordenação", () => {
    it("valida nome e área; payload sem repetição", () => {
      expect(validarCoordenacao(coordenacaoVazia("")).nome).toBeTruthy();
      expect(
        validarCoordenacao({ ...coordenacaoVazia(""), nome: "Norte" }).area,
      ).toBeTruthy();
      const r = {
        ...coordenacaoVazia("saude-indigena"),
        nome: "Norte",
        unidades: ["DSEI X", "DSEI X"],
        editais: ["1"],
      };
      expect(validarCoordenacao(r)).toEqual({});
      expect(coordenacaoParaSalvar(r)).toEqual({
        codigo: "norte",
        nome: "Norte",
        area: "saude-indigena",
        responsavel: null,
        unidades: ["DSEI X"],
        editais: ["1"],
        ativo: true,
        revisao: null,
      });
    });

    it("resume o recorte; sem nada, a área inteira", () => {
      expect(resumoDaCoordenacao({ unidades: [], editais: [] })).toBe(
        "A área inteira",
      );
      expect(
        resumoDaCoordenacao({
          responsavel: "USI",
          unidades: ["a", "b"],
          editais: ["e"],
        }),
      ).toBe("USI · 2 unidades · 1 edital");
    });

    it("unidades: só as da área e, com responsável, só as dele", () => {
      const catalogo = [
        { nome_oficial: "DSEI Alto Rio Negro", id_unidade: "1" },
      ];
      const unidadesPorArea = [
        { unidade: "SEDE", area: "sede" },
        { unidade: "MFC", area: "projetos" },
      ];
      const daSaude = opcoesDeUnidadesDaCoordenacao({
        area: "saude-indigena",
        responsavel: "",
        catalogo,
        unidadesPorArea,
      });
      expect(daSaude.map((o) => o.value)).toEqual(["DSEI Alto Rio Negro"]);
      const daSede = opcoesDeUnidadesDaCoordenacao({
        area: "sede",
        responsavel: "CORES",
        catalogo,
        unidadesPorArea,
      });
      expect(daSede.map((o) => o.value)).toEqual(["SEDE"]);
      expect(
        opcoesDeUnidadesDaCoordenacao({
          area: "sede",
          responsavel: "USI",
          catalogo,
          unidadesPorArea,
        }),
      ).toEqual([]);
    });
  });

  /*
  Em 30/09 "transformar a conta em coordenação" foi usado numa conta de
  PESSOA: a conta foi desativada. A confirmação diz as consequências e só
  aceita CONFIRMAR ou o e-mail da conta.
*/
  describe("conta de setor vira coordenação", () => {
    const conta = { nome: "COET – Saúde", email: "coet@agenciasus.org.br" };

    it("o aviso diz que desativa a conta e cria a coordenação na área", () => {
      expect(avisoDeTransformarEmCoordenacao(conta, "Saúde Indígena")).toBe(
        "Isto vai DESATIVAR a conta coet@agenciasus.org.br (ela não entra mais) e criar a coordenação COET – Saúde na área Saúde Indígena. Use só para contas compartilhadas de setor.",
      );
      expect(
        nomeDaCoordenacaoDaConta({ email: "setor.x@agenciasus.org.br" }),
      ).toBe("setor.x");
    });

    it("confirmação: CONFIRMAR (exato) ou o e-mail (sem caixa)", () => {
      expect(confirmacaoDeTransformarValida("CONFIRMAR", conta)).toBe(true);
      expect(
        confirmacaoDeTransformarValida(" COET@agenciasus.org.br ", conta),
      ).toBe(true);
      expect(confirmacaoDeTransformarValida("confirmar", conta)).toBe(false);
      expect(confirmacaoDeTransformarValida("sim", conta)).toBe(false);
      expect(confirmacaoDeTransformarValida("", conta)).toBe(false);
    });
  });
});

bloco("ir-para-tela", () => {
  /*
  Os botões "Ir para…" (Entrevistas, Recursos, Lista de aprovados) navegam só
  para telas do app, conferidas (src/lib/navegacao/link-interno.ts), e com o edital
  ele vai junto no endereço (src/app/ir-para-tela.ts); quem abre a tela já
  nele é a rota (tests/app/telas.test.js).
*/
  const EDITAL = "0b7c9a52-2d55-4c4e-9f7a-1c3d5e7f9a1b";

  describe("linkInterno", () => {
    it("aceita as telas do menu, com ou sem edital", () => {
      expect(linkInterno({ view: "classificacao" })).toEqual({
        view: "classificacao",
      });
      expect(
        linkInterno({
          view: "classificacao",
          edital: { id: EDITAL, titulo: " 93/2026 " },
        }),
      ).toEqual({
        view: "classificacao",
        edital: { id: EDITAL, titulo: "93/2026" },
      });
    });

    it("recusa endereço, tela que não existe e edital sem uuid", () => {
      for (const ruim of [
        null,
        "classificacao",
        [],
        { view: "https://exemplo.invalid" },
        { view: "chat" },
        { view: "classificacao", edital: { id: "83/2026" } },
      ])
        expect(linkInterno(ruim)).toBeNull();
    });
  });

  describe("irParaTela", () => {
    it("troca de tela pelo navigate, com o edital junto (vai no endereço)", () => {
      const janela = { navigate: vi.fn() };
      for (const view of [
        "classificacao",
        "conduzir-entrevistas",
        "pre-classificacao",
      ]) {
        expect(
          irParaTela({ view, edital: { id: EDITAL, titulo: "" } }, janela),
        ).toBe(true);
        expect(janela.navigate).toHaveBeenLastCalledWith(view, {
          edital: EDITAL,
        });
      }
    });

    it("sem edital, só a tela", () => {
      const janela = { navigate: vi.fn() };
      expect(irParaTela({ view: "recursos" }, janela)).toBe(true);
      expect(janela.navigate).toHaveBeenCalledWith("recursos");
    });

    it("destino que não vale ou sem navigate: não navega", () => {
      const janela = { navigate: vi.fn() };
      expect(irParaTela({ view: "https://exemplo.invalid" }, janela)).toBe(
        false,
      );
      expect(janela.navigate).not.toHaveBeenCalled();
      expect(irParaTela({ view: "recursos" }, {})).toBe(false);
    });
  });
});

bloco("loading-copy", () => {
  describe("loading copy", () => {
    it("normaliza o progresso dentro dos limites", () => {
      expect(normalizeLoadingProgress("42%")).toBe(42);
      expect(normalizeLoadingProgress(-10)).toBe(0);
      expect(normalizeLoadingProgress(140)).toBe(100);
      expect(normalizeLoadingProgress("inválido")).toBe(0);
    });

    it("reconhece mensagens genéricas sem substituir conteúdo específico", () => {
      expect(isGenericLoadingCopy("Carregando...")).toBe(true);
      expect(isGenericLoadingCopy("Preparando dados…")).toBe(true);
      expect(isGenericLoadingCopy("Validando permissões do seu perfil")).toBe(
        false,
      );
    });

    it("avança as mensagens conforme o progresso", () => {
      const initial = getLoadingStage({ progress: 5 });
      const data = getLoadingStage({ progress: 55 });
      const finish = getLoadingStage({ progress: 95 });

      expect(initial.title).toBe("Preparando o Yeendé");
      expect(data.title).toBe("Buscando dados atualizados");
      expect(finish.title).toBe("Finalizando o painel");
    });

    it("orienta sobre demora e oferece nova tentativa", () => {
      const delayed = getLoadingStage({ progress: 45, elapsedMs: 12_000 });
      const retry = getLoadingStage({ progress: 45, elapsedMs: 25_000 });

      expect(delayed.delayed).toBe(true);
      expect(delayed.canRetry).toBe(false);
      expect(retry.canRetry).toBe(true);
      expect(retry.delayMessage).toContain("tentar novamente");
    });
  });
});

bloco("logo-em-fundo-escuro", () => {
  // A tela de acesso e a marca da barra lateral são de platform-shell.css (seção Login).
  const shell = readFileSync("src/styles/platform-shell.css", "utf8").replace(
    /\r\n/g,
    "\n",
  );
  const semComentarios = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");
  const sidebar = readFileSync(
    "src/componentes/barra-lateral/marca.ts",
    "utf8",
  );

  /*
  A logo da barra lateral sumia quando a cor escolhida era escura.

  O tema escuro do app já clareava a marca; a **cor da barra**, escolhida em
  Configurações, não — e as duas são independentes. Dava para ter barra escura
  com tema claro, e aí a logo escura ficava sobre fundo escuro.

  O fundo branco atrás dela não salvava: `.side-logo-wrap` não tem fundo
  próprio, então a imagem repousa direto sobre a cor da barra.

  Medido no navegador, nas quatro combinações:

    barra escura + tema claro   -> brightness(0) invert(0.96)   (era `none`)
    barra escura + tema escuro  -> brightness(0) invert(0.96)
    barra clara  + tema escuro  -> brightness(0) invert(0.96)
    tudo claro                  -> none
*/
  describe("a marca acompanha o contraste da barra lateral", () => {
    const regra = shell.slice(
      shell.indexOf("#loginScreen.login-panel-dark #loginLogo"),
      shell.indexOf("#loginScreen.login-panel-dark .login-product-mark i"),
    );

    it("a cor escolhida da barra clareia a logo", () => {
      expect(regra).toContain("body.sidebar-theme-dark .app #sideLogo");
      expect(regra).toContain("body.sidebar-theme-dark .app .side-logo");
    });

    it("usa o mesmo filtro já aplicado ao tema escuro e ao login", () => {
      // Sem !important: nenhuma outra regra dá filtro à logo.
      expect(regra).toContain("filter: brightness(0) invert(0.96);");
      // Um filtro só, para as quatro situações — não uma variante por caso.
      expect(regra.match(/filter:/g)).toHaveLength(1);
    });

    it("os casos que já funcionavam continuam na mesma regra", () => {
      expect(regra).toContain("#loginScreen.login-panel-dark #loginLogo");
      expect(regra).toContain('html[data-theme="dark"] .app .side-logo');
    });

    /*
    Se o fundo do invólucro voltasse a ser branco, a logo escura teria onde
    repousar e o filtro deixaria de ser necessário — nenhum CSS lhe dá fundo.
  */
    it("o invólucro continua sem fundo próprio", () => {
      const comFundo = readdirSync("src/styles")
        .filter((nome) => nome.endsWith(".css"))
        .flatMap((nome) =>
          [
            ...semComentarios(
              readFileSync(`src/styles/${nome}`, "utf8"),
            ).matchAll(/([^{}]*)\{([^}]*)\}/g),
          ]
            .filter(([, seletor]) =>
              seletor
                .split(",")
                .some((s) => /\.side-logo-wrap$/.test(s.trim())),
            )
            .filter(([, , corpo]) =>
              /background(-color|-image)?\s*:\s*(?!transparent|none)/.test(
                corpo,
              ),
            )
            .map(([, seletor]) => `${nome}: ${seletor.trim()}`),
        );
      expect(comFundo).toEqual([]);
    });

    it("quem decide o contraste continua sendo a luminância da cor", () => {
      expect(sidebar).toContain("needsLightForeground(corAtual)");
      expect(sidebar).toContain("sidebar-theme-dark");
    });

    it("a classe só aparece em cores que pedem primeiro plano claro", () => {
      expect(needsLightForeground("#1b2d3e")).toBe(true);
      expect(needsLightForeground("#052029")).toBe(true);
      expect(needsLightForeground("#ffffff")).toBe(false);
      expect(needsLightForeground("#f2e8d5")).toBe(false);
    });
  });

  /*
  O botão de acesso, claro como no SIGAV.

  Ele era fixo em #101c2a — azul quase preto. O SIGAV usa
  `bg-white text-[#003b70] shadow-lg hover:bg-slate-100`, e é essa a aparência
  pedida.

  Medido contra os painéis reais:

    branco sobre #c090eb (o atual)   2.49:1
    branco sobre #c898eb (o SIGAV)   2.30:1
    branco sobre #6c009e (escuro)    9.85:1
    texto #003b70 sobre branco      11.29:1
    borda #003b70 sobre #c090eb      4.53:1

  O preenchimento branco fica abaixo de 3:1 num painel claro — no SIGAV também.
  A WCAG pede que a **borda do componente** seja perceptível, e é a borda que
  garante isso aqui.
*/
  describe("o botão de acesso é claro, como no SIGAV", () => {
    const regra = shell.slice(
      shell.indexOf(".login-screen .google-login-btn {"),
    );

    const canal = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const linear = (v) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    };
    const luminancia = (h) => {
      const [r, g, b] = canal(h);
      return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
    };
    const contraste = (a, b) => {
      const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
      return (x + 0.05) / (y + 0.05);
    };

    // O azul do SIGAV (#003b70) virou o blue-800 do Design System AgSUS (#153B6F).
    it("usa o azul institucional do Design System", () => {
      expect(regra).toContain("background: #ffffff");
      expect(regra).toContain("color: var(--color-blue-800)");
    });

    it("o hover é o slate-100 do SIGAV", () => {
      const hover = shell.slice(
        shell.indexOf(".login-screen .google-login-btn:hover {"),
      );
      expect(hover).toContain("background: #f1f5f9");
      // O texto é escuro; o hover clareia, então continua legível.
      expect(contraste("#f1f5f9", "#153B6F")).toBeGreaterThan(4.5);
    });

    /*
    Sem a borda, a aresta do botão mede 2.49:1 contra o painel atual — é o que
    acontece no SIGAV. Com ela, 4.53:1.
  */
    it("a borda torna a aresta perceptível onde o preenchimento não basta", () => {
      expect(regra).toContain("border: 1px solid var(--color-blue-800)");
      expect(contraste("#ffffff", "#c090eb")).toBeLessThan(3);
      expect(contraste("#153B6F", "#c090eb")).toBeGreaterThan(3);
      expect(contraste("#153B6F", "#c898eb")).toBeGreaterThan(3);
    });

    it("o texto sobre o botão tem folga larga", () => {
      expect(contraste("#153B6F", "#ffffff")).toBeGreaterThan(7);
    });

    /*
    Num painel escuro o branco sozinho já resolve — a borda some no fundo e não
    faz falta.
  */
    it("num painel escuro o botão claro tem contraste de sobra", () => {
      expect(contraste("#ffffff", "#6c009e")).toBeGreaterThan(7);
    });

    /* O "G" é o do Google nas quatro cores, em SVG de tamanho fixo. */
    it("o G é o do Google, colorido, com 20px", () => {
      const icones = readFileSync(
        "src/app/entrada/icones-da-entrada.tsx",
        "utf8",
      );
      for (const cor of ["#EA4335", "#4285F4", "#FBBC05", "#34A853"])
        expect(icones).toContain(`fill="${cor}"`);
      const gmark = shell.slice(
        shell.indexOf(".login-screen .google-login-btn .gmark {"),
      );
      expect(gmark).toContain("width: 20px");
      expect(gmark).toContain("height: 20px");
    });

    /*
    Escopado à `.login-screen`: a regra vale para o botão principal e para o
    de trocar de conta, e não escapa para outras telas.
  */
    it("vale só na tela de acesso", () => {
      expect(regra).toContain(".login-screen .google-login-btn");
      expect(shell).not.toMatch(/^\.google-login-btn\s*\{/m);
    });
  });
});

bloco("menu-lateral", () => {
  const TUDO = {
    dashboard: true,
    nucleo: true,
    calendario: true,
    approved: true,
    analises: true,
    config: true,
  };
  const PAINEIS = [
    { codigo: "recursos", titulo: "Recursos" },
    { codigo: "sem-titulo", titulo: "  " },
    { codigo: "", titulo: "Sem código" },
  ];
  const TODAS = ["saude-indigena", "sede", "projetos"];

  const porGrupo = (arvore) =>
    Object.fromEntries(arvore.map((grupo) => [grupo.id, grupo.itens]));

  /*
  O menu tem um grupo por área do usuário (Saúde Indígena, SEDE, Projetos),
  cada um com as mesmas páginas de edital, e depois Painéis e Administração.
*/
  describe("o catálogo", () => {
    it("são as três áreas, Painéis e Administração, nessa ordem", () => {
      expect(AREAS_DO_MENU.map((area) => area.rotulo)).toEqual([
        "Saúde Indígena",
        "SEDE",
        "Projetos",
        "Painéis",
        "Administração",
      ]);
      expect(AREAS_DO_SISTEMA.map((area) => area.icone)).toEqual([
        "heart-pulse",
        "building-2",
        "folder-kanban",
      ]);
      expect(new Set(AREAS_DO_MENU.map((area) => area.id)).size).toBe(
        AREAS_DO_MENU.length,
      );
    });

    it("toda aba só aponta para áreas que existem", () => {
      const areas = new Set(AREAS_DO_SISTEMA.map((area) => area.id));
      const usadas = ABAS_DO_MENU.flatMap((aba) =>
        aba.areas.map((item) => item.area),
      );
      expect(usadas.every((area) => areas.has(area))).toBe(true);
      expect(AREAS_DO_MENU.some((area) => area.id === AREA_DOS_PAINEIS)).toBe(
        true,
      );
    });

    it("todo ícone que o catálogo pede existe no registro Lucide", () => {
      const registrados = new Set(NOMES_DE_ICONES);
      expect(
        iconesDoCatalogo().filter((nome) => !registrados.has(nome)),
      ).toEqual([]);
    });

    it("as áreas do usuário: só as conhecidas, na ordem do catálogo; sem nada, Saúde Indígena", () => {
      expect(areasDoUsuario(["projetos", "x", "saude-indigena"])).toEqual([
        "saude-indigena",
        "projetos",
      ]);
      expect(areasDoUsuario(undefined)).toEqual(["saude-indigena"]);
      expect(areasDoUsuario([])).toEqual(["saude-indigena"]);
      expect(nomeDaArea("sede")).toBe("SEDE");
      expect(nomeDaArea("nenhuma")).toBe("");
    });
  });

  describe("a árvore do menu segue o perfil e as áreas", () => {
    it("quem só tem Saúde Indígena vê um grupo de área, com Análises dentro", () => {
      const arvore = montarArvoreDoMenu({
        permitidas: TUDO,
        paineis: PAINEIS,
        secoesDeConfiguracao: SECOES,
        areas: ["saude-indigena"],
      });
      const grupos = porGrupo(arvore);

      expect(arvore.map((grupo) => grupo.id)).toEqual([
        "saude-indigena",
        "paineis",
        "administracao",
      ]);
      expect(grupos["saude-indigena"].map((item) => item.rotulo)).toEqual([
        "Visão geral",
        "Painel das análises",
        "Cronograma",
        "Editais",
        "Lista de aprovados",
      ]);
      expect(grupos["saude-indigena"].at(-1)).toEqual({
        view: "approved",
        rotulo: "Lista de aprovados",
        icone: "user-round-check",
        bloco: "processo",
        area: "saude-indigena",
      });
      expect(
        grupos["saude-indigena"].every(
          (item) => item.area === "saude-indigena",
        ),
      ).toBe(true);
      // Os painéis externos vão para Painéis, sem área, no bloco Acompanhar.
      expect(grupos.paineis).toEqual([
        {
          view: "panel:recursos",
          rotulo: "Recursos",
          icone: "square-arrow-out-up-right",
          bloco: "acompanhamento",
        },
        {
          view: "panel:sem-titulo",
          rotulo: "sem-titulo",
          icone: "square-arrow-out-up-right",
          bloco: "acompanhamento",
        },
      ]);
      expect(grupos.administracao.map((item) => item.secao)).toEqual(
        SECOES.map((secao) => secao.id),
      );
      // Cada seção leva o grupo dela em Administração.
      expect(grupos.administracao.map((item) => item.bloco)).toEqual(
        SECOES.map((secao) => secao.grupo),
      );
      expect(grupos.administracao.every((item) => item.view === "config")).toBe(
        true,
      );
    });

    it("o admin vê as três áreas, todas com a mesma Visão geral e com Análises", () => {
      const grupos = porGrupo(
        montarArvoreDoMenu({
          permitidas: TUDO,
          paineis: PAINEIS,
          areas: TODAS,
        }),
      );
      expect(Object.keys(grupos)).toEqual([
        "saude-indigena",
        "sede",
        "projetos",
        "paineis",
      ]);
      // A Visão geral é a mesma página (`dashboard`, ícone `map`) nas três.
      for (const area of ["saude-indigena", "sede", "projetos"]) {
        expect(grupos[area][0].icone).toBe("map");
        expect(grupos[area].map((item) => item.view)).toEqual([
          "dashboard",
          "analises",
          "calendario",
          "nucleo",
          "approved",
        ]);
        expect(grupos[area][0].rotulo).toBe("Visão geral");
        expect(grupos[area].at(-1).rotulo).toBe("Lista de aprovados");
        expect(grupos[area].every((item) => item.area === area)).toBe(true);
      }
      // A mesma página, uma vez em cada área; Painéis só tem os externos.
      expect(grupos.paineis.map((item) => item.view)).toEqual([
        "panel:recursos",
        "panel:sem-titulo",
      ]);
    });

    it("sem áreas no contexto (contrato antigo), vale a Saúde Indígena", () => {
      const arvore = montarArvoreDoMenu({ permitidas: { nucleo: true } });
      expect(arvore.map((grupo) => grupo.id)).toEqual(["saude-indigena"]);
    });

    it("quem só tem a SEDE vê Análises na SEDE", () => {
      const grupos = porGrupo(
        montarArvoreDoMenu({
          permitidas: { nucleo: true, analises: true },
          areas: ["sede"],
        }),
      );
      expect(Object.keys(grupos)).toEqual(["sede"]);
      expect(grupos.sede.map((item) => item.view)).toEqual([
        "analises",
        "nucleo",
      ]);
    });

    it("Análises só com o recurso analises; os painéis externos não a trazem", () => {
      const grupos = porGrupo(
        montarArvoreDoMenu({
          permitidas: { nucleo: true },
          paineis: [{ codigo: "analises", titulo: "Analises" }],
          areas: ["sede"],
        }),
      );
      expect(grupos.sede.map((item) => item.view)).toEqual(["nucleo"]);
      // O painel antigo não tem mais lugar especial: se chegasse, seria um
      // painel comum (o legado o tira antes, em `semOPainelAntigoDeAnalises`).
      expect(grupos.paineis.map((item) => item.view)).toEqual([
        "panel:analises",
      ]);
    });

    it("grupo sem página permitida não aparece", () => {
      const arvore = montarArvoreDoMenu({
        permitidas: { nucleo: true },
        secoesDeConfiguracao: SECOES,
      });
      expect(arvore.map((grupo) => grupo.id)).toEqual(["saude-indigena"]);
      expect(montarArvoreDoMenu({ permitidas: {} })).toEqual([]);
      expect(montarArvoreDoMenu()).toEqual([]);
    });
  });

  describe("a página aberta no menu", () => {
    const arvore = montarArvoreDoMenu({
      permitidas: TUDO,
      paineis: PAINEIS,
      secoesDeConfiguracao: SECOES,
      areas: TODAS,
    });

    it("acha o item da área atual e o grupo dele", () => {
      const ativo = itemAtivoDaArvore(
        arvore,
        "calendario",
        null,
        "saude-indigena",
      );
      expect(ativo.area).toBe("saude-indigena");
      expect(ativo.item.rotulo).toBe("Cronograma");
    });

    it("Editais da SEDE ativo não acende Editais da Saúde Indígena", () => {
      const ativo = itemAtivoDaArvore(arvore, "nucleo", null, "sede");
      expect(ativo.area).toBe("sede");
      expect(ativo.item.area).toBe("sede");
      expect(itemAtivoDaArvore(arvore, "nucleo", null, "projetos").area).toBe(
        "projetos",
      );
    });

    it("a Visão geral acende na área atual; painel acende em Painéis", () => {
      expect(itemAtivoDaArvore(arvore, "dashboard", null, "sede").area).toBe(
        "sede",
      );
      expect(
        itemAtivoDaArvore(arvore, "dashboard", null, "projetos").area,
      ).toBe("projetos");
      expect(
        itemAtivoDaArvore(arvore, "panel:sem-titulo", null, "sede").area,
      ).toBe("paineis");
    });

    it("em Configurações, a seção aberta; sem seção que bata, a primeira", () => {
      expect(itemAtivoDaArvore(arvore, "config", "aparencia").item.secao).toBe(
        "aparencia",
      );
      expect(itemAtivoDaArvore(arvore, "config", "nenhuma").item.secao).toBe(
        "marca",
      );
    });

    it("página fora do menu não marca nada", () => {
      expect(itemAtivoDaArvore(arvore, "sem-acesso")).toBeNull();
      expect(itemAtivoDaArvore([], "dashboard")).toBeNull();
    });
  });

  /*
  As áreas nascem abertas. Guarda-se a lista das fechadas, então uma área nova
  no catálogo aparece aberta sem ninguém a ter aberto antes.
*/
  describe("áreas abertas por padrão", () => {
    it("só a área que a pessoa fechou fica fechada", () => {
      const fechadas = new Set(["administracao"]);
      expect(areaAberta(fechadas, "sede")).toBe(true);
      expect(areaAberta(fechadas, "administracao")).toBe(false);
      expect(areaAberta(new Set(), "area-nova")).toBe(true);
    });
  });

  describe("transbordo da navegação recolhida", () => {
    it("rola só quando o conteúdo passa do espaço, com folga de subpixel", () => {
      expect(navegacaoTransborda(400, 560)).toBe(false);
      expect(navegacaoTransborda(560, 560)).toBe(false);
      expect(navegacaoTransborda(560.6, 560)).toBe(false);
      expect(navegacaoTransborda(720, 560)).toBe(true);
    });
  });

  describe("posição do painel flutuante da barra recolhida", () => {
    it("centra a pílula do nome no ícone", () => {
      expect(
        posicaoDoPainelFlutuante({
          topoDoGatilho: 100,
          alturaDoGatilho: 36,
          alturaDoPainel: 200,
          alturaDaJanela: 900,
        }),
      ).toBe(104);
    });

    it("sobe até caber quando o painel passaria do pé da janela", () => {
      expect(
        posicaoDoPainelFlutuante({
          topoDoGatilho: 700,
          alturaDoGatilho: 36,
          alturaDoPainel: 300,
          alturaDaJanela: 800,
        }),
      ).toBe(492);
    });

    it("nunca passa da margem do topo", () => {
      expect(
        posicaoDoPainelFlutuante({
          topoDoGatilho: 20,
          alturaDoGatilho: 36,
          alturaDoPainel: 900,
          alturaDaJanela: 600,
        }),
      ).toBe(8);
    });
  });

  /*
  O painel flutuante tem estado próprio porque `:hover` e `:focus-within` não
  bastam: o `Esc` não fecharia (o foco volta ao ícone, dentro da área), um
  clique prenderia o painel aberto e hover e foco abririam dois painéis.
*/
  describe("estado do painel flutuante", () => {
    const passo = (estado, tipo, area) =>
      proximoFlutuante(estado, { tipo, area });

    it("abre ao apontar e fecha ao desapontar", () => {
      const aberto = passo(FLUTUANTE_FECHADO, "apontar", "sede");
      expect(aberto).toMatchObject({
        aberta: "sede",
        origem: "ponteiro",
      });
      expect(passo(aberto, "desapontar", "sede").aberta).toBeNull();
    });

    it("só um painel por vez: apontar outra área troca", () => {
      const um = passo(FLUTUANTE_FECHADO, "apontar", "sede");
      expect(passo(um, "apontar", "administracao").aberta).toBe(
        "administracao",
      );
    });

    it("aberto pelo foco, não fecha quando o ponteiro sai", () => {
      const pelaMao = passo(FLUTUANTE_FECHADO, "apontar", "sede");
      const focado = passo(pelaMao, "focar", "sede");
      expect(focado.origem).toBe("foco");
      expect(passo(focado, "desapontar", "sede").aberta).toBe("sede");
      expect(passo(focado, "desfocar", "sede").aberta).toBeNull();
    });

    it("o clique fixa; o segundo clique fecha e não deixa o foco reabrir", () => {
      const fixado = passo(FLUTUANTE_FECHADO, "alternar", "sede");
      expect(fixado).toMatchObject({ aberta: "sede", origem: "clique" });
      expect(passo(fixado, "desapontar", "sede").aberta).toBe("sede");

      const fechado = passo(fixado, "alternar", "sede");
      expect(fechado).toMatchObject({ aberta: null, suprimida: "sede" });
      expect(passo(fechado, "focar", "sede").aberta).toBeNull();
    });

    it("Esc dispensa: o foco devolvido ao ícone não reabre até sair da área", () => {
      const aberto = passo(FLUTUANTE_FECHADO, "focar", "sede");
      const dispensado = passo(aberto, "dispensar", "sede");
      expect(dispensado).toMatchObject({
        aberta: null,
        suprimida: "sede",
      });
      expect(passo(dispensado, "focar", "sede").aberta).toBeNull();

      const saiu = passo(dispensado, "desfocar", "sede");
      expect(saiu.suprimida).toBeNull();
      expect(passo(saiu, "focar", "sede").aberta).toBe("sede");
    });

    it("clique fora, rolagem ou troca da barra fecham tudo", () => {
      const aberto = passo(FLUTUANTE_FECHADO, "alternar", "administracao");
      expect(passo(aberto, "fechar")).toEqual(FLUTUANTE_FECHADO);
    });

    it("evento desconhecido não muda nada", () => {
      const aberto = passo(FLUTUANTE_FECHADO, "apontar", "sede");
      expect(passo(aberto, "piscar", "sede")).toBe(aberto);
    });
  });

  describe("Visão geral da SEDE e de Projetos", () => {
    it("segue a permissão da Visão geral: sem ela, SEDE e Projetos não a mostram", () => {
      const grupos = porGrupo(
        montarArvoreDoMenu({
          permitidas: { nucleo: true, dashboard: false },
          areas: ["sede", "projetos"],
        }),
      );
      expect(grupos.sede.map((item) => item.view)).toEqual(["nucleo"]);
      expect(grupos.projetos.map((item) => item.view)).toEqual(["nucleo"]);
    });

    it("acende o item da área atual", () => {
      const arvore = montarArvoreDoMenu({
        permitidas: { dashboard: true, nucleo: true },
        areas: TODAS,
      });
      const ativo = itemAtivoDaArvore(arvore, "dashboard", null, "projetos");
      expect(ativo.area).toBe("projetos");
    });
  });

  /*
  Seletor de área: a árvore segue com todas as áreas; a barra desenha só a
  atual. Trocar de área mantém a página, se a área nova a tem. As páginas vêm
  da árvore: o teste não supõe qual view é a Visão geral de cada área.
*/
  describe("seletor de área", () => {
    const arvore = montarArvoreDoMenu({
      permitidas: TUDO,
      paineis: [{ codigo: "bi", titulo: "BI" }],
      secoesDeConfiguracao: SECOES,
      areas: TODAS,
    });
    const itens = porGrupo(arvore);

    it("só as áreas do sistema entram no seletor", () => {
      expect(ehAreaDoSistema("sede")).toBe(true);
      expect(ehAreaDoSistema("administracao")).toBe(false);
      expect(ehAreaDoSistema(AREA_DOS_PAINEIS)).toBe(false);
    });

    it("recorta a área atual, com os painéis dentro, e deixa Administração embaixo", () => {
      const recorte = recortarArvorePorArea(arvore, "sede");
      expect(recorte.comSeletor).toBe(true);
      expect(recorte.areas.map((g) => g.id)).toEqual(TODAS);
      expect(recorte.grupoAtual.id).toBe("sede");
      expect(recorte.demais.map((g) => g.id)).toEqual(["administracao"]);
      // Os painéis entram no fim da área, os mesmos objetos da árvore.
      expect(recorte.grupoAtual.itens.at(-1)).toBe(itens[AREA_DOS_PAINEIS][0]);
      expect(recorte.grupoAtual.itens.slice(0, -1)).toEqual(itens.sede);
      // A árvore não muda: a SEDE continua sem os painéis.
      expect(itens.sede.some((item) => item.view === "panel:bi")).toBe(false);
    });

    it("sem área para recebê-los, os painéis ficam no grupo deles", () => {
      const soPaineis = montarArvoreDoMenu({
        permitidas: { config: true },
        paineis: [{ codigo: "bi", titulo: "BI" }],
        secoesDeConfiguracao: SECOES,
      });
      const recorte = recortarArvorePorArea(soPaineis, "sede");
      expect(recorte.grupoAtual).toBeNull();
      expect(recorte.demais.map((g) => g.id)).toEqual([
        AREA_DOS_PAINEIS,
        "administracao",
      ]);
    });

    it("área atual fora das do usuário cai na primeira; uma área só, sem seletor", () => {
      expect(recortarArvorePorArea(arvore, "outra").grupoAtual.id).toBe(
        "saude-indigena",
      );
      const umaSo = montarArvoreDoMenu({ permitidas: TUDO, areas: ["sede"] });
      expect(recortarArvorePorArea(umaSo, "sede").comSeletor).toBe(false);
      expect(recortarArvorePorArea([], "sede")).toEqual({
        areas: [],
        grupoAtual: null,
        demais: [],
        comSeletor: false,
      });
    });

    it("trocar de área mantém a página; sem ela, a primeira da área", () => {
      expect(destinoAoTrocarDeArea(arvore, "projetos", "calendario").view).toBe(
        "calendario",
      );
      expect(destinoAoTrocarDeArea(arvore, "projetos", "calendario").area).toBe(
        "projetos",
      );
      // Hoje toda aba existe nas três áreas; sem a página na área nova, a primeira.
      const semVisaoGeral = arvore.map((grupo) =>
        grupo.id === "sede"
          ? {
              ...grupo,
              itens: grupo.itens.filter((item) => item.view !== "dashboard"),
            }
          : grupo,
      );
      expect(destinoAoTrocarDeArea(semVisaoGeral, "sede", "dashboard")).toBe(
        semVisaoGeral.find((grupo) => grupo.id === "sede").itens[0],
      );
      expect(destinoAoTrocarDeArea(arvore, "sede", "config")).toBe(
        itens.sede[0],
      );
      expect(destinoAoTrocarDeArea(arvore, "inexistente", "nucleo")).toBeNull();
    });
  });

  /*
  Dentro de cada área, dois blocos: Acompanhar (consulta) e Processo
  seletivo (onde se trabalha, na ordem das etapas). A árvore guarda o bloco
  em cada item; o desenho separa com `blocosDaArea`.
*/
  describe("blocos da área", () => {
    const TODAS_AS_VIEWS = Object.fromEntries(
      ABAS_DO_MENU.map((aba) => [aba.view, true]),
    );

    it("são Acompanhar, Processo seletivo e Dados, nessa ordem", () => {
      expect(BLOCOS_DA_AREA.map((bloco) => bloco.rotulo)).toEqual([
        "Acompanhar",
        "Processo seletivo",
        "Dados",
      ]);
    });

    it("com todas as abas, cada bloco na ordem pedida", () => {
      for (const area of TODAS) {
        const arvore = montarArvoreDoMenu({
          permitidas: TODAS_AS_VIEWS,
          areas: [area],
        });
        const blocos = blocosDaArea(arvore[0].itens);
        expect(
          blocos.map((bloco) => [
            bloco.rotulo,
            bloco.itens.map((item) => item.rotulo),
          ]),
        ).toEqual([
          [
            "Acompanhar",
            [
              "Visão geral",
              "Painel das análises",
              "Painel de recursos",
              "Painel de entrevistas",
              "Painel da Seleção",
              "Cronograma",
            ],
          ],
          [
            "Processo seletivo",
            [
              "Editais",
              "Triagem",
              "Avaliação documental",
              "Recursos",
              "Entrevistas",
              "Classificação",
              "Lista de aprovados",
            ],
          ],
          ["Dados", ["Painéis"]],
        ]);
      }
    });

    it("Painéis entra no bloco Dados, sozinho", () => {
      const arvore = montarArvoreDoMenu({
        permitidas: { "paineis-de-dados": true },
      });
      expect(
        blocosDaArea(arvore[0].itens).map((b) => [
          b.id,
          b.itens.map((i) => i.view),
        ]),
      ).toEqual([["dados", ["paineis-de-dados"]]]);
    });

    it("bloco sem página permitida some", () => {
      const soTrabalho = montarArvoreDoMenu({
        permitidas: { nucleo: true, approved: true },
      });
      expect(blocosDaArea(soTrabalho[0].itens).map((b) => b.id)).toEqual([
        "processo",
      ]);
      const soConsulta = montarArvoreDoMenu({ permitidas: { selecao: true } });
      expect(blocosDaArea(soConsulta[0].itens).map((b) => b.id)).toEqual([
        "acompanhamento",
      ]);
      expect(blocosDaArea([])).toEqual([]);
    });

    it("painel externo entra em Acompanhar, depois das páginas", () => {
      const arvore = montarArvoreDoMenu({
        permitidas: TUDO,
        paineis: [{ codigo: "bi", titulo: "BI" }],
        areas: ["sede"],
      });
      const { grupoAtual } = recortarArvorePorArea(arvore, "sede");
      const [acompanhamento] = blocosDaArea(grupoAtual.itens);
      expect(acompanhamento.itens.map((item) => item.view)).toEqual([
        "dashboard",
        "analises",
        "calendario",
        "panel:bi",
      ]);
    });

    it("aba nova nativa vai para Processo seletivo; aba externa, para Acompanhar", () => {
      expect(blocoDaAba({ id: "nova", tipo: "nativa" })).toBe("processo");
      expect(blocoDaAba({ id: "bi", tipo: "externa" })).toBe("acompanhamento");
      expect(blocoDaAba({ id: "aprovados", tipo: "nativa" })).toBe("processo");
      expect(blocoDaAba({ id: "selecao", tipo: "nativa" })).toBe(
        "acompanhamento",
      );
      expect(blocoDaAba({ id: "cronograma", tipo: "nativa" })).toBe(
        "acompanhamento",
      );
      expect(blocoDaAba({ id: "pre-classificacao", tipo: "nativa" })).toBe(
        "processo",
      );
      // Item sem bloco (árvore montada à mão) vale como Processo seletivo.
      expect(
        blocosDaArea([{ view: "x", rotulo: "X", icone: "map" }]).map(
          (b) => b.id,
        ),
      ).toEqual(["processo"]);
    });
  });

  /*
  Administração em três grupos (decisão de 29/10): Aparência, Pessoas e
  acessos, Sistema. Seção sem grupo conhecido vai para Sistema.
*/
  describe("grupos de Administração", () => {
    it("cada seção no grupo pedido, na ordem do menu", () => {
      const arvore = montarArvoreDoMenu({
        permitidas: { config: true },
        secoesDeConfiguracao: SECOES,
      });
      const admin = arvore.find((grupo) => grupo.id === "administracao");
      expect(
        blocosDaAdministracao(admin.itens).map((bloco) => [
          bloco.rotulo,
          bloco.itens.map((item) => item.rotulo),
        ]),
      ).toEqual([
        [
          "Aparência",
          [
            "Marca",
            "Página inicial",
            "Tela de acesso",
            "Aparência",
            "Comemorações",
          ],
        ],
        ["Pessoas e acessos", ["Acessos", "Painéis externos"]],
        [
          "Sistema",
          [
            "Módulos e abas",
            "Operação",
            "Status das atualizações",
            "Automação",
          ],
        ],
      ]);
    });

    it("grupo vazio some; seção sem grupo vai para Sistema", () => {
      expect(
        blocosDaAdministracao([
          { view: "config", secao: "x", rotulo: "X", icone: "x" },
        ]).map((bloco) => bloco.id),
      ).toEqual(["sistema"]);
      expect(blocosDaAdministracao([])).toEqual([]);
    });
  });

  /*
  Ícones únicos: cada item do menu (páginas do catálogo, em qualquer área,
  seções de Administração e os grupos) tem o seu. Os painéis externos são
  links do mesmo grupo e dividem o ícone dele, de propósito.
*/
  describe("ícones do menu", () => {
    const repetidos = (usos) => {
      const donos = new Map();
      for (const [icone, dono] of usos)
        donos.set(icone, new Set([...(donos.get(icone) ?? []), dono]));
      return [...donos]
        .filter(([, lista]) => lista.size > 1)
        .map(([icone, lista]) => [icone, [...lista]]);
    };

    it("nenhum ícone se repete entre os itens do menu", () => {
      expect(
        repetidos([
          ...AREAS_DO_MENU.map((area) => [area.icone, `grupo ${area.id}`]),
          ...ABAS_DO_MENU.flatMap((aba) =>
            [aba.icone, ...aba.areas.map((area) => area.icone)]
              .filter(Boolean)
              .map((icone) => [icone, `aba ${aba.id}`]),
          ),
          ...SECOES.map((secao) => [secao.iconeDoMenu, `seção ${secao.id}`]),
        ]),
      ).toEqual([]);
    });

    it("o catálogo do banco (ensaio do menu novo) também não repete ícone", () => {
      const resposta = JSON.parse(
        readFileSync("tests/fixtures/listar-abas-do-menu-triagem.json", "utf8"),
      );
      expect(resposta.length).toBeGreaterThan(0);
      expect(
        repetidos(
          resposta.flatMap((aba) =>
            [aba.ds_icone, ...aba.areas.map((area) => area.ds_icone)].map(
              (icone) => [icone, aba.co_aba],
            ),
          ),
        ),
      ).toEqual([]);
    });

    it("todo ícone do menu existe no Lucide (o pacote de `npm run icones`)", async () => {
      const lucide = await import("lucide");
      const pascal = (nome) =>
        nome
          .split("-")
          .map((parte) => parte[0].toUpperCase() + parte.slice(1))
          .join("");
      const nomes = [
        ...iconesDoCatalogo(),
        ...SECOES.map((secao) => secao.iconeDoMenu),
      ];
      expect(
        nomes.filter((nome) => !Array.isArray(lucide[pascal(nome)])),
      ).toEqual([]);
    });
  });
});

bloco("mobile-google-oauth", () => {
  /*
  O clique no celular (redirecionamento, sem popup) é decidido pela sessão do
  app: tests/casca-sessao-e-interface-na-tela.test.ts (bloco app/sessao) cobre o botão e a mensagem de erro.
*/

  describe("mobile Google OAuth", () => {
    it("detecta navegadores mobile e iPad com user agent de desktop", () => {
      expect(
        isMobileOAuthContext({
          userAgent: "Mozilla/5.0 (iPhone)",
          platform: "iPhone",
        }),
      ).toBe(true);
      expect(
        isMobileOAuthContext({
          userAgent: "Mozilla/5.0 (Macintosh)",
          platform: "MacIntel",
          maxTouchPoints: 5,
        }),
      ).toBe(true);
      expect(
        isMobileOAuthContext({
          userAgent: "Mozilla/5.0 (Windows NT 10.0)",
          platform: "Win32",
          maxTouchPoints: 0,
        }),
      ).toBe(false);
    });

    it("inicia OAuth sem executar signOut antes do redirecionamento", async () => {
      const signInWithOAuth = vi.fn().mockResolvedValue({ error: null });
      const clearAuthState = vi.fn();
      const removeItem = vi.fn();

      await startMobileGoogleOAuth({
        client: { auth: { signInWithOAuth } },
        authStorage: { clearAuthState },
        locationRef: new URL("https://yeende.vercel.app/"),
        sessionStorageRef: { removeItem },
        timeoutMs: 1000,
      });

      expect(clearAuthState).toHaveBeenCalledTimes(1);
      expect(removeItem).toHaveBeenCalledWith("agsus_oauth_callback_ok");
      expect(signInWithOAuth).toHaveBeenCalledWith(
        expect.objectContaining({ provider: "google" }),
      );
    });
  });
});

bloco("modulos-e-abas", () => {
  /*
  Rascunho de Configurações › Módulos e abas: guarda só o que difere do lido,
  junta ativo + situação em três estados e monta o `p_alteracoes` de
  `salvar_situacao_modulos` com as regras do banco.
*/

  const ARVORE = {
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
        situacao: "MANUTENCAO",
        mensagem: "Ajuste",
        previsao: "2026-10-05",
        abas: [],
      },
    ],
    abas: [
      {
        co_aba: "editais",
        no_aba: "Editais",
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
    historico: [],
  };

  const originais = originaisDaArvore(ARVORE);
  const SISTEMA = { escopo: "sistema" };
  const SAUDE = { escopo: "area", area: "saude-indigena" };
  const SEDE = { escopo: "area", area: "sede" };
  const EDITAIS = { escopo: "aba", aba: "editais" };
  const EDITAIS_NA_SAUDE = {
    escopo: "aba_area",
    area: "saude-indigena",
    aba: "editais",
  };
  const PAINEL = { escopo: "painel", painel: "p-1" };

  describe("rascunho de módulos e abas", () => {
    it("lê os valores como o banco compara", () => {
      const vazio = new Map();
      expect(valorDoCampo(vazio, originais, SEDE, "situacao")).toBe(
        "MANUTENCAO",
      );
      expect(valorDoCampo(vazio, originais, SEDE, "previsao")).toBe(
        "2026-10-05",
      );
      expect(valorDoCampo(vazio, originais, SISTEMA, "mensagem")).toBe("");
      expect(valorDoCampo(vazio, originais, EDITAIS, "beta")).toBe("N");
      expect(valorDoCampo(vazio, originais, PAINEL, "situacao")).toBe("ATIVA");
      expect(estadoDoAlvo(vazio, originais, SEDE)).toBe("manutencao");
      expect(estadoDoAlvo(vazio, originais, SISTEMA)).toBe("ativa");
    });

    it("voltar ao valor lido tira a alteração", () => {
      let rascunho = registrarCampo(new Map(), originais, EDITAIS, "beta", "S");
      expect(rascunho.size).toBe(1);
      rascunho = registrarCampo(rascunho, originais, EDITAIS, "beta", "N");
      expect(rascunho.size).toBe(0);
      rascunho = registrarCampo(
        rascunho,
        originais,
        SEDE,
        "mensagem",
        "  Ajuste ",
      );
      expect(rascunho.size).toBe(0);
    });

    it("três estados: ativa, manutenção, desativada", () => {
      let rascunho = registrarEstado(new Map(), originais, SAUDE, "manutencao");
      expect(alteracoesDoRascunho(rascunho)).toEqual([
        {
          escopo: "area",
          area: "saude-indigena",
          campo: "situacao",
          valor: "MANUTENCAO",
        },
      ]);
      rascunho = registrarEstado(rascunho, originais, SAUDE, "desativada");
      // Desativar devolve a situação à lida: só o ativo muda.
      expect(alteracoesDoRascunho(rascunho)).toEqual([
        { escopo: "area", area: "saude-indigena", campo: "ativo", valor: "N" },
      ]);
      expect(estadoDoAlvo(rascunho, originais, SAUDE)).toBe("desativada");
      rascunho = registrarEstado(rascunho, originais, SAUDE, "ativa");
      expect(rascunho.size).toBe(0);
    });

    it("o sistema inteiro não desativa", () => {
      expect(
        registrarEstado(new Map(), originais, SISTEMA, "desativada").size,
      ).toBe(0);
      const rascunho = registrarEstado(
        new Map(),
        originais,
        SISTEMA,
        "manutencao",
      );
      expect(alteracoesDoRascunho(rascunho)).toEqual([
        { escopo: "sistema", campo: "situacao", valor: "MANUTENCAO" },
      ]);
    });

    it("monta os itens de cada escopo com os campos do banco", () => {
      let rascunho = registrarEstado(
        new Map(),
        originais,
        EDITAIS_NA_SAUDE,
        "manutencao",
      );
      rascunho = registrarCampo(
        rascunho,
        originais,
        EDITAIS_NA_SAUDE,
        "mensagem",
        " Volta já ",
      );
      rascunho = registrarCampo(
        rascunho,
        originais,
        EDITAIS_NA_SAUDE,
        "previsao",
        "2026-10-10",
      );
      rascunho = registrarEstado(rascunho, originais, PAINEL, "desativada");
      rascunho = registrarCampo(rascunho, originais, SEDE, "previsao", "");
      expect(alteracoesDoRascunho(rascunho)).toEqual([
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
          campo: "mensagem",
          valor: "Volta já",
        },
        {
          escopo: "aba_area",
          area: "saude-indigena",
          aba: "editais",
          campo: "previsao",
          valor: "2026-10-10",
        },
        { escopo: "painel", painel: "p-1", campo: "ativo", valor: "N" },
        { escopo: "area", area: "sede", campo: "previsao", valor: "" },
      ]);
    });

    it("aponta o que o banco recusaria: todas as áreas desativadas", () => {
      let rascunho = registrarEstado(new Map(), originais, SAUDE, "desativada");
      expect(problemasDoRascunho(ARVORE, rascunho, originais)).toEqual([]);
      rascunho = registrarEstado(rascunho, originais, SEDE, "desativada");
      expect(problemasDoRascunho(ARVORE, rascunho, originais)).toEqual([
        "Pelo menos uma área precisa ficar ativa.",
      ]);
      const longa = registrarCampo(
        new Map(),
        originais,
        SISTEMA,
        "mensagem",
        "x".repeat(501),
      );
      expect(problemasDoRascunho(ARVORE, longa, originais)[0]).toContain("500");
    });

    it("motivo de 3 a 500 caracteres", () => {
      expect(motivoValido("ok")).toBe(false);
      expect(motivoValido(" ok ")).toBe(false);
      expect(motivoValido("ajuste")).toBe(true);
      expect(motivoValido("x".repeat(501))).toBe(false);
    });

    it("revisão e histórico em português", () => {
      const rascunho = registrarEstado(
        new Map(),
        originais,
        EDITAIS,
        "manutencao",
      );
      expect(resumoDoRascunho(ARVORE, rascunho, originais)).toEqual([
        {
          chave: "aba||editais||situacao",
          onde: "Aba Editais (todas as áreas)",
          campo: "Situação",
          de: "Ativa",
          para: "Em manutenção",
        },
      ]);
      expect(
        linhaDoHistorico(ARVORE, {
          escopo: "aba_area",
          area: "sede",
          aba: "editais",
          campo: "ativo",
          anterior: "S",
          novo: "N",
          motivo: "teste",
          quando: "not a date",
          autor: "adm@agenciasus.org.br",
        }),
      ).toEqual({
        quando: "",
        onde: "Aba Editais em SEDE",
        campo: "Ativo",
        de: "Ativo",
        para: "Desativado",
        motivo: "teste",
        autor: "adm@agenciasus.org.br",
      });
    });
  });
});

bloco("modulos/acessos-pagina-vazia", () => {
  /*
  Desativar (ou mover para Coordenações) a única pessoa da última página
  recarregava a mesma página, agora vazia: a tabela dizia "Nenhuma pessoa com
  acesso ativo." e a paginação sumia. Mover e adicionar com reativação também
  não recarregavam a aba Desativadas.
*/
  function supabaseFalso({ total }) {
    const chamadas = [];
    return {
      chamadas,
      rpc: async (nome, argumentos) => {
        chamadas.push({ nome, argumentos });
        if (nome === "obter_matriz_acessos") {
          const restantes = Math.max(
            0,
            Math.min(30, total() - argumentos.p_offset),
          );
          return {
            data: {
              usuarios: Array.from({ length: restantes }, (_, i) => ({
                id: `u${argumentos.p_offset + i}`,
              })),
              total: total(),
            },
            error: null,
          };
        }
        if (nome === "listar_contas_desativadas")
          return { data: { contas: [] }, error: null };
        if (nome === "adicionar_pessoa_acesso")
          return { data: { reativada: true }, error: null };
        return { data: { nome: "Coordenação" }, error: null };
      },
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

  const ofsetsDaMatriz = (supabase) =>
    supabase.chamadas
      .filter((c) => c.nome === "obter_matriz_acessos")
      .map((c) => c.argumentos.p_offset);

  describe("Acessos: página que fica vazia", () => {
    it("desativar a única pessoa da última página volta para a página anterior", async () => {
      let total = 31;
      const supabase = supabaseFalso({ total: () => total });
      const estado = criarEstadoDosAcessos({ supabase, toast: () => {} });
      await estado.carregarMatriz({ offset: 30 });
      expect(estado.obter().matriz.usuarios).toHaveLength(1);

      total = 30;
      await estado.desativarUsuario(
        { id: "u30", nome: "Ana" },
        "saiu da equipe",
      );

      expect(estado.obter().offset).toBe(0);
      expect(estado.obter().matriz.usuarios).toHaveLength(30);
      expect(ofsetsDaMatriz(supabase)).toEqual([30, 30, 0]);
    });

    it("mover para Coordenações também volta para a última página com gente", async () => {
      let total = 61;
      const supabase = supabaseFalso({ total: () => total });
      const estado = criarEstadoDosAcessos({ supabase, toast: () => {} });
      await estado.carregarMatriz({ offset: 60 });

      total = 60;
      await estado.moverParaCoordenacoes(
        { id: "u60", nome: "Polo" },
        "SI",
        "virou coordenação",
      );

      expect(estado.obter().offset).toBe(30);
      expect(estado.obter().matriz.usuarios).toHaveLength(30);
    });

    it("mover para Coordenações recarrega a aba Desativadas já aberta", async () => {
      const supabase = supabaseFalso({ total: () => 1 });
      const estado = criarEstadoDosAcessos({ supabase, toast: () => {} });
      await estado.carregarDesativadas();
      supabase.chamadas.length = 0;

      await estado.moverParaCoordenacoes(
        { id: "u0", nome: "Polo" },
        "SI",
        "virou coordenação",
      );

      expect(supabase.chamadas.map((c) => c.nome)).toContain(
        "listar_contas_desativadas",
      );
    });

    it("adicionar quem estava desativado recarrega a aba Desativadas já aberta", async () => {
      const supabase = supabaseFalso({ total: () => 1 });
      const estado = criarEstadoDosAcessos({ supabase, toast: () => {} });
      await estado.carregarDesativadas();
      supabase.chamadas.length = 0;

      await estado.adicionarPessoa(
        { email: "ana@x", nome: "Ana", grupo: "leitura", areas: ["si"] },
        "voltou para a equipe",
      );

      expect(supabase.chamadas.map((c) => c.nome)).toContain(
        "listar_contas_desativadas",
      );
    });
  });
});

bloco("modulos/acessos-pedidos-concorrentes", () => {
  /*
  Filtro, busca e página disparam cargas sem esperar a anterior. Antes, a
  resposta que chegasse por último ficava na tela — mesmo sendo a do filtro
  anterior —, e a tabela mostrava pessoas que não eram do filtro escolhido.
*/
  function supabaseControlado() {
    const pendentes = [];
    return {
      pendentes,
      rpc: (nome, argumentos) =>
        new Promise((resolver) =>
          pendentes.push({ nome, argumentos, resolver }),
        ),
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

  const matrizCom = (id) => ({ usuarios: [{ id }], total: 1 });

  describe("Acessos: cargas concorrentes", () => {
    it("a resposta do filtro anterior não substitui a do filtro atual", async () => {
      const supabase = supabaseControlado();
      const estado = criarEstadoDosAcessos({ supabase, toast: () => {} });
      const primeira = estado.carregarMatriz({ filtroGrupo: "a" });
      const segunda = estado.carregarMatriz({ filtroGrupo: "b" });
      // espera as duas chamadas chegarem ao "banco"
      while (supabase.pendentes.length < 2) await Promise.resolve();
      supabase.pendentes[1].resolver({ data: matrizCom("do-b"), error: null });
      await segunda;
      supabase.pendentes[0].resolver({ data: matrizCom("do-a"), error: null });
      await primeira;
      expect(estado.obter().filtroGrupo).toBe("b");
      expect(estado.obter().matriz.usuarios).toEqual([{ id: "do-b" }]);
    });

    it("a busca anterior das contas desativadas não substitui a atual", async () => {
      const supabase = supabaseControlado();
      const estado = criarEstadoDosAcessos({ supabase, toast: () => {} });
      const primeira = estado.carregarDesativadas({ busca: "an" });
      const segunda = estado.carregarDesativadas({ busca: "ana" });
      while (supabase.pendentes.length < 2) await Promise.resolve();
      supabase.pendentes[1].resolver({ data: { contas: [] }, error: null });
      await segunda;
      supabase.pendentes[0].resolver({
        data: { contas: [{ id: "x", email: "antonio@x" }] },
        error: null,
      });
      await primeira;
      expect(estado.obter().buscaDasDesativadas).toBe("ana");
      expect(estado.obter().desativadas).toEqual([]);
    });
  });
});

bloco("navegacao", () => {
  /* Regras puras da navegação (src/lib/navegacao/navegacao.ts). */

  const paineisDe = (...codigos) => ({
    podeAbrir: (codigo) => codigos.includes(codigo),
    primeiro: () => (codigos.length ? { codigo: codigos[0] } : null),
  });
  const SEM_PAINEIS = paineisDe();

  const comMatriz = (permissoes) => ({ id: "p", ativo: true, permissoes });
  const GESTOR = { id: "g", ativo: true, perfil: "edital_gestor" };

  describe("painel externo", () => {
    it("lê o código de panel:<codigo>", () => {
      expect(codigoDoPainel("panel:selecao")).toBe("selecao");
      expect(codigoDoPainel("panel:a:b")).toBe("a");
      expect(codigoDoPainel("dashboard")).toBe("");
      expect(ehPainelExterno("panel:x")).toBe(true);
      expect(ehPainelExterno(null)).toBe(false);
    });
  });

  describe("bloqueioDaTela", () => {
    it("avisa com o texto da tela quando o perfil não pode", () => {
      const perfil = comMatriz({ nucleo: "leitor" });
      expect(bloqueioDaTela("dashboard", perfil, SEM_PAINEIS)).toBe(
        "Sem permissão para Saúde Indígena.",
      );
      expect(bloqueioDaTela("nucleo", perfil, SEM_PAINEIS)).toBe("");
      expect(bloqueioDaTela("config", perfil, SEM_PAINEIS)).toBe(
        "Sem permissão para Configurações.",
      );
      expect(bloqueioDaTela("recursos", perfil, SEM_PAINEIS)).toBe(
        "Sem permissão para Recursos.",
      );
    });

    it("Triagem exige recurso próprio, não permissão do Painel da Seleção", () => {
      const somentePainel = comMatriz({
        selecao: "editor",
        avaliacao_documental: "sem_acesso",
      });
      expect(bloqueioDaTela("selecao", somentePainel, SEM_PAINEIS)).toBe("");
      expect(telaPermitida("selecao", somentePainel, SEM_PAINEIS)).toBe(true);
      expect(
        bloqueioDaTela("pre-classificacao", somentePainel, SEM_PAINEIS),
      ).toBe("Sem permissão para a Triagem.");
      expect(
        telaPermitida("pre-classificacao", somentePainel, SEM_PAINEIS),
      ).toBe(false);

      const avaliador = comMatriz({
        selecao: "sem_acesso",
        avaliacao_documental: "leitor",
      });
      expect(bloqueioDaTela("pre-classificacao", avaliador, SEM_PAINEIS)).toBe(
        "",
      );
      expect(telaPermitida("pre-classificacao", avaliador, SEM_PAINEIS)).toBe(
        true,
      );
      expect(telaPermitida("selecao", avaliador, SEM_PAINEIS)).toBe(false);
      // O papel por edital continua obrigatório na RPC e no componente:
      // esta checagem concede apenas a rota, não a operação.
    });

    it("tela que não existe é bloqueada com aviso (antes ficava em branco)", () => {
      expect(bloqueioDaTela("chat", GESTOR, SEM_PAINEIS)).toBe(
        'A tela "chat" não existe.',
      );
      expect(bloqueioDaTela(TELA_SEM_ACESSO, GESTOR, SEM_PAINEIS)).toBe("");
    });

    it("Cronograma: com matriz, o módulo calendario; sem matriz, o de Editais", () => {
      expect(
        bloqueioDaTela(
          "calendario",
          comMatriz({ nucleo: "leitor" }),
          SEM_PAINEIS,
        ),
      ).toBe("Sem permissão para o Cronograma.");
      expect(
        bloqueioDaTela(
          "calendario",
          comMatriz({ calendario: "leitor" }),
          SEM_PAINEIS,
        ),
      ).toBe("");
      expect(bloqueioDaTela("calendario", GESTOR, SEM_PAINEIS)).toBe("");
    });

    it("página do edital: quem vê Visão geral, Editais ou Cronograma", () => {
      for (const recurso of ["dashboard", "nucleo", "calendario"])
        expect(
          bloqueioDaTela(
            "edital",
            comMatriz({ [recurso]: "leitor" }),
            SEM_PAINEIS,
          ),
          recurso,
        ).toBe("");
      expect(bloqueioDaTela("edital", GESTOR, SEM_PAINEIS)).toBe("");
      // Só a Lista de aprovados, ou só a Classificação: a página não abre.
      for (const recurso of ["aprovados", "classificacao", "entrevistas"]) {
        const perfil = comMatriz({ [recurso]: "editor" });
        expect(bloqueioDaTela("edital", perfil, SEM_PAINEIS), recurso).toBe(
          "Sem permissão para a página do edital.",
        );
        expect(telaPermitida("edital", perfil, SEM_PAINEIS), recurso).toBe(
          false,
        );
      }
    });

    it("painel externo segue os painéis liberados", () => {
      expect(bloqueioDaTela("panel:bi", GESTOR, paineisDe("bi"))).toBe("");
      expect(bloqueioDaTela("panel:outro", GESTOR, paineisDe("bi"))).toBe(
        "Sem permissão para este painel externo ou painel inativo.",
      );
    });

    it("tela sem regra própria não bloqueia", () => {
      expect(bloqueioDaTela(TELA_SEM_ACESSO, null, SEM_PAINEIS)).toBe("");
    });
  });

  describe("telaPermitida", () => {
    it("usa as páginas do perfil e os painéis", () => {
      const perfil = comMatriz({ dashboard: "leitor" });
      expect(telaPermitida("dashboard", perfil, SEM_PAINEIS)).toBe(true);
      expect(telaPermitida("nucleo", perfil, SEM_PAINEIS)).toBe(false);
      expect(telaPermitida("panel:bi", perfil, paineisDe("bi"))).toBe(true);
      expect(telaPermitida("", perfil, SEM_PAINEIS)).toBe(false);
      expect(telaPermitida("desconhecida", perfil, SEM_PAINEIS)).toBe(false);
    });
  });

  describe("telaInicialDoSistema e telaDeEntrada", () => {
    it("segue a ordem das telas do sistema", () => {
      expect(telaInicialDoSistema(GESTOR, SEM_PAINEIS)).toBe("dashboard");
      expect(
        telaInicialDoSistema(comMatriz({ recursos: "leitor" }), SEM_PAINEIS),
      ).toBe("recursos");
    });

    it("sem tela do sistema: o primeiro painel, ou sem-acesso", () => {
      const perfil = comMatriz({});
      expect(telaInicialDoSistema(perfil, paineisDe("bi"))).toBe("panel:bi");
      expect(telaInicialDoSistema(perfil, SEM_PAINEIS)).toBe(TELA_SEM_ACESSO);
    });

    it("reabre a tela guardada, se permitida e se não for painel", () => {
      const perfil = comMatriz({ dashboard: "leitor", nucleo: "leitor" });
      expect(telaDeEntrada("nucleo", perfil, SEM_PAINEIS)).toBe("nucleo");
      expect(telaDeEntrada("config", perfil, SEM_PAINEIS)).toBe("dashboard");
      expect(telaDeEntrada("panel:bi", perfil, paineisDe("bi"))).toBe(
        "dashboard",
      );
      expect(telaDeEntrada("", perfil, SEM_PAINEIS)).toBe("dashboard");
    });
  });
});

bloco("novas-tentativas", () => {
  const REST = "https://x.supabase.co/rest/v1/TB_CONFIGURACAO?select=*";
  const RPC = "https://x.supabase.co/rest/v1/rpc/salvar_algo";

  function resposta(status, corpo = {}, cabecalhos = {}) {
    return new Response(JSON.stringify(corpo), {
      status,
      headers: { "Content-Type": "application/json", ...cabecalhos },
    });
  }

  function montar(respostas, opcoes = {}) {
    const fila = [...respostas];
    const base = vi.fn(async () => {
      const proxima = fila.shift();
      if (proxima instanceof Error) throw proxima;
      return proxima;
    });
    const esperas = [];
    const fetch = comNovasTentativas(base, {
      esperar: async (ms) => {
        esperas.push(ms);
      },
      sorteio: () => 1,
      ...opcoes,
    });
    return { base, esperas, fetch };
  }

  describe("espera crescente com sorteio e teto", () => {
    it("dobra a cada tentativa, com metade sorteada, até o teto", () => {
      const politica = { baseMs: 500, tetoMs: 8000 };
      expect(esperaAntesDaTentativa(1, politica, () => 1)).toBe(500);
      expect(esperaAntesDaTentativa(1, politica, () => 0)).toBe(250);
      expect(esperaAntesDaTentativa(2, politica, () => 1)).toBe(1000);
      expect(esperaAntesDaTentativa(3, politica, () => 1)).toBe(2000);
      expect(esperaAntesDaTentativa(10, politica, () => 1)).toBe(8000);
      expect(esperaAntesDaTentativa(10, politica, () => 0)).toBe(4000);
    });

    it("lê o Retry-After em segundos ou em data", () => {
      expect(esperaPedidaPeloServidor("3")).toBe(3000);
      expect(
        esperaPedidaPeloServidor(
          "Wed, 29 Oct 2026 12:00:10 GMT",
          Date.parse("2026-10-29T12:00:00Z"),
        ),
      ).toBe(10000);
      expect(esperaPedidaPeloServidor("")).toBeNull();
      expect(esperaPedidaPeloServidor("amanhã")).toBeNull();
    });

    it("a releitura do relatório de desempate cresce de 10 s até 60 s", () => {
      expect(esperaDaReleitura(1, () => 1)).toBe(10000);
      expect(esperaDaReleitura(2, () => 1)).toBe(20000);
      expect(esperaDaReleitura(9, () => 1)).toBe(60000);
    });
  });

  describe("o que é repetido", () => {
    it("leitura com status passageiro: repete até o limite e devolve a última", async () => {
      const { base, esperas, fetch } = montar([
        resposta(503),
        resposta(503),
        resposta(503),
        resposta(200),
      ]);
      const final = await fetch(REST, { method: "GET" });
      expect(final.status).toBe(503);
      expect(base).toHaveBeenCalledTimes(POLITICA_PADRAO.maximoDeTentativas);
      expect(esperas).toEqual([500, 1000]);
    });

    it("leitura que falhou na rede: repete e devolve a que deu certo", async () => {
      const { base, fetch } = montar([
        new TypeError("Failed to fetch"),
        resposta(200, []),
      ]);
      const final = await fetch(REST, { method: "GET" });
      expect(final.status).toBe(200);
      expect(base).toHaveBeenCalledTimes(2);
    });

    it("gravação (POST de RPC) nunca é repetida às cegas", async () => {
      const { base, fetch } = montar([resposta(503), resposta(200)]);
      expect((await fetch(RPC, { method: "POST", body: "{}" })).status).toBe(
        503,
      );
      const falha = montar([new TypeError("Failed to fetch")]);
      await expect(
        falha.fetch(RPC, { method: "POST", body: "{}" }),
      ).rejects.toThrow("Failed to fetch");
      expect(base).toHaveBeenCalledTimes(1);
      expect(falha.base).toHaveBeenCalledTimes(1);
    });

    it("cancelamento e status definitivos não são repetidos", async () => {
      const abortada = Object.assign(new Error("abortada"), {
        name: "AbortError",
      });
      const cancelada = montar([abortada]);
      await expect(cancelada.fetch(REST, { method: "GET" })).rejects.toBe(
        abortada,
      );
      expect(cancelada.base).toHaveBeenCalledTimes(1);
      const definitiva = montar([resposta(404), resposta(200)]);
      expect((await definitiva.fetch(REST, { method: "GET" })).status).toBe(
        404,
      );
      expect(definitiva.base).toHaveBeenCalledTimes(1);
    });

    it("Retry-After maior que o teto devolve a resposta sem esperar", async () => {
      const { base, esperas, fetch } = montar([
        resposta(429, {}, { "Retry-After": "120" }),
        resposta(200),
      ]);
      expect((await fetch(REST)).status).toBe(429);
      expect(base).toHaveBeenCalledTimes(1);
      expect(esperas).toEqual([]);
    });

    it("Retry-After dentro do teto é respeitado", async () => {
      const { esperas, fetch } = montar([
        resposta(503, {}, { "Retry-After": "2" }),
        resposta(200),
      ]);
      expect((await fetch(REST)).status).toBe(200);
      expect(esperas).toEqual([2000]);
    });

    it("Auth, Realtime e Edge Functions passam direto", async () => {
      const { base, fetch } = montar([resposta(503), resposta(200)]);
      const final = await fetch(
        "https://x.supabase.co/auth/v1/token?grant_type=refresh_token",
        {
          method: "GET",
        },
      );
      expect(final.status).toBe(503);
      expect(base).toHaveBeenCalledTimes(1);
    });
  });

  describe("orçamento comum", () => {
    it("com o banco fora, as chamadas juntas não passam do orçamento da janela", async () => {
      let agora = 0;
      const orcamento = criarOrcamento(
        { novasPorJanela: 3, janelaMs: 30000 },
        () => agora,
      );
      const base = vi.fn(async () => resposta(503));
      const fetch = comNovasTentativas(base, {
        orcamento,
        esperar: async () => {},
        sorteio: () => 0,
      });
      await Promise.all(Array.from({ length: 5 }, () => fetch(REST)));
      expect(base).toHaveBeenCalledTimes(5 + 3);
      agora = 31000;
      expect(orcamento.gastar()).toBe(true);
    });
  });

  describe("token vencido", () => {
    const vencido = { code: "PGRST303", message: "JWT expired" };

    it("reconhece o 401 de token vencido, não o de permissão", () => {
      expect(ehTokenVencido(vencido)).toBe(true);
      expect(ehTokenVencido({ code: "PGRST301" })).toBe(true);
      expect(
        ehTokenVencido({ code: "42501", message: "permission denied" }),
      ).toBe(false);
      expect(ehTokenVencido(null)).toBe(false);
    });

    it("renova uma vez e reenvia a mesma chamada (inclusive gravação) com o token novo", async () => {
      const renovarToken = vi.fn(async () => "novo");
      const { base, fetch } = montar([resposta(401, vencido), resposta(200)], {
        renovarToken,
      });
      const final = await fetch(RPC, {
        method: "POST",
        body: '{"p":1}',
        headers: new Headers({ Authorization: "Bearer velho" }),
      });
      expect(final.status).toBe(200);
      expect(renovarToken).toHaveBeenCalledWith("velho");
      const [, segunda] = base.mock.calls[1];
      expect(new Headers(segunda.headers).get("Authorization")).toBe(
        "Bearer novo",
      );
      expect(segunda.body).toBe('{"p":1}');
    });

    it("não insiste: sem token novo, ou 401 de novo, devolve o 401", async () => {
      const semToken = montar([resposta(401, vencido)], {
        renovarToken: async () => null,
      });
      expect(
        (
          await semToken.fetch(RPC, {
            method: "POST",
            headers: { Authorization: "Bearer a" },
          })
        ).status,
      ).toBe(401);
      const deNovo = montar(
        [resposta(401, vencido), resposta(401, vencido), resposta(200)],
        {
          renovarToken: async () => "b",
        },
      );
      expect(
        (
          await deNovo.fetch(RPC, {
            method: "POST",
            headers: { Authorization: "Bearer a" },
          })
        ).status,
      ).toBe(401);
      expect(deNovo.base).toHaveBeenCalledTimes(2);
    });
  });

  describe("o cliente único usa esta regra", () => {
    it("desliga a repetição da biblioteca e passa o fetch por comNovasTentativas", () => {
      const fonte = readFileSync("src/lib/sessao/supabaseClient.ts", "utf8");
      expect(fonte).toMatch(/db:\s*\{\s*retry:\s*false\s*\}/);
      expect(fonte).toMatch(/comNovasTentativas\(/);
    });
  });
});

bloco("onde-esta-no-monitora", () => {
  describe("onde a pessoa está, em Pessoas online", () => {
    it("página da área: nome da página e da área", () => {
      expect(
        ondeEstaNoMonitora({ view: "analises", area: "saude-indigena" }),
      ).toBe("Painel das análises · Saúde Indígena");
      expect(ondeEstaNoMonitora({ view: "approved", area: "projetos" })).toBe(
        "Lista de aprovados · Projetos",
      );
      expect(ondeEstaNoMonitora({ view: "dashboard", area: "sede" })).toBe(
        "Visão geral · SEDE",
      );
    });

    it("Configurações: a seção aberta, sem área", () => {
      expect(
        ondeEstaNoMonitora({
          view: "config",
          area: "saude-indigena",
          rotuloDaSecao: "Acessos",
        }),
      ).toBe("Configurações › Acessos");
      expect(ondeEstaNoMonitora({ view: "config" })).toBe("Configurações");
    });

    it("painel externo e view desconhecida", () => {
      expect(ondeEstaNoMonitora({ view: "panel:recursos", area: "sede" })).toBe(
        "Painel externo",
      );
      expect(ondeEstaNoMonitora({ view: "outra" })).toBe("outra");
      expect(ondeEstaNoMonitora({})).toBe("");
    });

    it("o que vem de quem ainda tem a versão anterior (só o código) vira o nome", () => {
      expect(rotuloDoLocal("analises")).toBe("Painel das análises");
      expect(rotuloDoLocal("entrevistas")).toBe("Painel de entrevistas");
      expect(rotuloDoLocal("conduzir-entrevistas")).toBe("Entrevistas");
      expect(rotuloDoLocal("Recursos · Projetos")).toBe("Recursos · Projetos");
      expect(rotuloDoLocal("")).toBe("");
    });

    it("a lista mostra o local legível", () => {
      const [pessoa] = normalizeOnlinePresenceList([
        {
          user_id: "u1",
          full_name: "Gabriel Benjamin da Silva",
          profile_label: "Admin",
          current_view: "analises",
        },
      ]);
      expect(pessoa.currentView).toBe("Painel das análises");
    });
  });
});

bloco("online-presence", () => {
  describe("online presence", () => {
    it("normaliza, remove duplicados e ordena pessoas", () => {
      expect(
        normalizeOnlinePresenceList([
          { userId: "2", fullName: "Zuleica Lima", perfil: "editor" },
          {
            user_id: "1",
            nome: "Ana Souza",
            avatar_url: "https://example.com/a.png",
          },
          { userId: "2", fullName: "Zuleica Lima", currentView: "Análises" },
        ]),
      ).toEqual([
        expect.objectContaining({
          userId: "1",
          fullName: "Ana Souza",
          initials: "AS",
        }),
        expect.objectContaining({
          userId: "2",
          fullName: "Zuleica Lima",
          currentView: "Análises",
        }),
      ]);
    });

    it("ignora linhas sem identidade", () => {
      expect(normalizeOnlinePresenceList([null, {}, { userId: "1" }])).toEqual(
        [],
      );
    });
  });
});

bloco("origem-da-permissao", () => {
  const alteracoesDoRascunho = alteracoesDoRascunho__1;
  const resumoDoRascunho = resumoDoRascunho__2;
  const usuario = {
    id: "u1",
    nome: "Ana",
    email: "ana@agenciasus.org.br",
    grupo: "usuario",
    coordenacao: null,
    revisao_conta: "t0",
    permissoes: {
      nucleo: {
        nivel: "leitor",
        origem: "grupo",
        nivel_grupo: "leitor",
        revisao: 0,
      },
      aprovados: {
        nivel: "editor",
        origem: "excecao",
        nivel_grupo: "leitor",
        revisao: 3,
      },
    },
  };
  const grupos = {
    usuario: { niveis: { nucleo: "leitor", aprovados: "leitor" } },
    edital_gestor: { niveis: { nucleo: "editor", aprovados: "leitor" } },
  };

  describe("grupo + permissão individual", () => {
    it("célula individual mostra o nível próprio e o do grupo", () => {
      expect(celulaExibida(usuario, "aprovados", new Map(), grupos)).toEqual({
        nivel: "editor",
        individual: true,
        nivelGrupo: "leitor",
        pendente: false,
      });
    });

    it("'Do grupo' grava null; em célula que já segue o grupo não gera alteração", () => {
      let rascunho = registrarNoRascunho(new Map(), usuario, "aprovados", null);
      expect(alteracoesDoRascunho(rascunho)).toEqual([
        {
          tipo: "nivel",
          usuario_id: "u1",
          recurso: "aprovados",
          nivel: null,
          revisao: 3,
        },
      ]);
      expect(
        celulaExibida(usuario, "aprovados", rascunho, grupos),
      ).toMatchObject({
        nivel: "leitor",
        individual: false,
        pendente: true,
      });
      rascunho = registrarNoRascunho(new Map(), usuario, "nucleo", null);
      expect(rascunho.size).toBe(0);
    });

    it("escolher explicitamente o mesmo nível do grupo fixa uma permissão individual", () => {
      const rascunho = registrarNoRascunho(
        new Map(),
        usuario,
        "nucleo",
        "leitor",
      );
      expect(celulaExibida(usuario, "nucleo", rascunho, grupos)).toMatchObject({
        nivel: "leitor",
        individual: true,
      });
    });

    it("voltar ao valor salvo apaga a entrada", () => {
      let rascunho = registrarNoRascunho(
        new Map(),
        usuario,
        "aprovados",
        "admin",
      );
      expect(rascunho.size).toBe(1);
      rascunho = registrarNoRascunho(rascunho, usuario, "aprovados", "editor");
      expect(rascunho.size).toBe(0);
    });

    it("trocar o grupo no rascunho já muda as células que seguem o grupo", () => {
      const rascunho = registrarNoRascunho(
        new Map(),
        usuario,
        ALVO_GRUPO,
        "edital_gestor",
      );
      expect(celulaExibida(usuario, "nucleo", rascunho, grupos).nivel).toBe(
        "editor",
      );
      expect(celulaExibida(usuario, "aprovados", rascunho, grupos).nivel).toBe(
        "editor",
      );
    });

    it("mudanças de conta vão antes dos níveis, com a revisão da conta", () => {
      let rascunho = registrarNoRascunho(
        new Map(),
        usuario,
        "nucleo",
        "editor",
      );
      rascunho = registrarNoRascunho(
        rascunho,
        usuario,
        ALVO_COORDENACAO,
        "norte",
      );
      rascunho = registrarNoRascunho(
        rascunho,
        usuario,
        ALVO_GRUPO,
        "edital_gestor",
      );
      expect(alteracoesDoRascunho(rascunho).map((a) => a.tipo)).toEqual([
        "coordenacao",
        "grupo",
        "nivel",
      ]);
      expect(alteracoesDoRascunho(rascunho)[1]).toEqual({
        tipo: "grupo",
        usuario_id: "u1",
        grupo: "edital_gestor",
        revisao: "t0",
      });
    });

    it("recusa nível que o módulo não aceita", () => {
      expect(() =>
        registrarNoRascunho(new Map(), usuario, "configuracoes", "leitor"),
      ).toThrow("Nível inválido");
      expect(() =>
        registrarNoRascunho(new Map(), usuario, "acessos", "admin"),
      ).toThrow("Nível inválido");
    });

    it("revisão agrupada por pessoa, com de → para", () => {
      const rascunho = registrarNoRascunho(
        new Map(),
        usuario,
        "aprovados",
        null,
      );
      const [grupo] = resumoDoRascunho(rascunho);
      expect(grupo.usuario.email).toBe("ana@agenciasus.org.br");
      expect(grupo.itens[0]).toEqual({
        rotulo: "Lista de aprovados",
        de: "Editor",
        para: "Do grupo (Leitor)",
      });
    });

    it("depois de um conflito, a alteração cuja base mudou sai; as outras ficam", () => {
      let rascunho = registrarNoRascunho(
        new Map(),
        usuario,
        "aprovados",
        "admin",
      );
      rascunho = registrarNoRascunho(rascunho, usuario, "nucleo", "editor");
      const recarregado = {
        ...usuario,
        permissoes: {
          ...usuario.permissoes,
          aprovados: {
            nivel: "leitor",
            origem: "excecao",
            nivel_grupo: "leitor",
            revisao: 4,
          },
        },
      };
      const { rascunho: novo, conflitos } = rebasearRascunho(rascunho, [
        recarregado,
      ]);
      expect(conflitos).toEqual([
        {
          usuario: { id: "u1", nome: "Ana", email: "ana@agenciasus.org.br" },
          alvo: "aprovados",
        },
      ]);
      expect([...novo.keys()]).toEqual(["u1/nucleo"]);
    });

    it("quem não veio na recarga sai do rascunho: o conflito não se repete", () => {
      const outra = { ...usuario, id: "u2", nome: "Bia" };
      let rascunho = registrarNoRascunho(
        new Map(),
        usuario,
        "nucleo",
        "editor",
      );
      rascunho = registrarNoRascunho(rascunho, outra, "nucleo", "editor");
      const {
        rascunho: novo,
        conflitos,
        foraDaLista,
      } = rebasearRascunho(rascunho, [usuario]);
      expect(conflitos).toEqual([]);
      expect(foraDaLista.map((f) => [f.usuario.id, f.alvo])).toEqual([
        ["u2", "nucleo"],
      ]);
      expect([...novo.keys()]).toEqual(["u1/nucleo"]);
      expect(avisoDoConflito(conflitos, foraDaLista)).toBe(
        "Saiu 1 alteração de pessoas fora desta página, que não puderam ser conferidas. Revise e salve de novo.",
      );
    });

    it("o aviso do conflito conta os acessos que saíram", () => {
      expect(avisoDoConflito([{}, {}], [])).toBe(
        "Outra pessoa mudou 2 acessos que você estava alterando; essas alterações saíram. Revise e salve de novo.",
      );
      expect(avisoDoConflito([], [])).toContain("A lista foi recarregada");
    });
  });
});

bloco("paineis-externos-das-configuracoes", () => {
  /*
  Painéis externos e Operação em React (01/10): a regra sem DOM. O ponto
  delicado é o formato enviado ao banco, que tem de ser o mesmo do antigo
  `collectPanelRows` (src/modules/config-ui.js): [{ id, titulo, url, ativo,
  em_manutencao }], só painéis com id, textos aparados, booleanos.
*/

  // Como a TB_PAINEL_EXTERNO chega de `loadPanels` (todas as colunas lidas).
  const DO_BANCO = [
    {
      id: "p1",
      codigo: "recursos",
      titulo: " Recursos ",
      icone: "fa-file",
      url: "https://a.org/x ",
      ordem: 1,
      ativo: true,
      em_manutencao: false,
      tipo_abertura: "iframe",
    },
    {
      id: "p2",
      codigo: "bi",
      titulo: "",
      url: null,
      ordem: 2,
      ativo: false,
      em_manutencao: null,
    },
    { id: "", codigo: "sem-id", titulo: "Sem id", ativo: null },
  ];

  describe("painéis: carga e formato enviado", () => {
    it("normaliza como a tabela antiga mostrava (ativo só falso com false)", () => {
      const [p1, p2, p3] = normalizarPaineis(DO_BANCO);
      expect(p1).toEqual({
        id: "p1",
        codigo: "recursos",
        titulo: "Recursos",
        url: "https://a.org/x",
        ativo: true,
        em_manutencao: false,
        nome: "Recursos",
      });
      expect(p2).toMatchObject({
        titulo: "",
        url: "",
        ativo: false,
        nome: "bi",
      });
      expect(p3.ativo).toBe(true);
      expect(normalizarPaineis(undefined)).toEqual([]);
    });

    it("p_paineis tem o formato do collectPanelRows, sem os painéis sem id", () => {
      const linhas = linhasDosPaineis(normalizarPaineis(DO_BANCO));
      expect(linhas).toEqual([
        {
          id: "p1",
          titulo: "Recursos",
          url: "https://a.org/x",
          ativo: true,
          em_manutencao: false,
        },
        { id: "p2", titulo: "", url: "", ativo: false, em_manutencao: false },
      ]);
      for (const linha of linhas)
        expect(Object.keys(linha)).toEqual([
          "id",
          "titulo",
          "url",
          "ativo",
          "em_manutencao",
        ]);
    });

    it("o rascunho guarda só o que difere do carregado", () => {
      const paineis = normalizarPaineis(DO_BANCO);
      let rascunho = mudarRascunhoDoPainel(
        new Map(),
        paineis,
        "p1",
        "url",
        "https://b.org",
      );
      rascunho = mudarRascunhoDoPainel(
        rascunho,
        paineis,
        "p2",
        "em_manutencao",
        true,
      );
      expect(Object.fromEntries(rascunho)).toEqual({
        p1: { url: "https://b.org" },
        p2: { em_manutencao: true },
      });
      const atuais = paineisComRascunho(paineis, rascunho);
      expect(atuais[0].url).toBe("https://b.org");
      expect(atuais[1].em_manutencao).toBe(true);
      // Voltar ao valor carregado (com espaços) desfaz.
      rascunho = mudarRascunhoDoPainel(
        rascunho,
        paineis,
        "p1",
        "url",
        " https://a.org/x",
      );
      rascunho = mudarRascunhoDoPainel(
        rascunho,
        paineis,
        "p2",
        "em_manutencao",
        false,
      );
      expect(rascunho.size).toBe(0);
      // Campo que a RPC não grava (ícone, ordem) ou painel desconhecido: nada.
      expect(
        mudarRascunhoDoPainel(new Map(), paineis, "p1", "ordem", 9).size,
      ).toBe(0);
      expect(
        mudarRascunhoDoPainel(new Map(), paineis, "x", "url", "https://c").size,
      ).toBe(0);
    });
  });

  describe("painéis: validação e situação", () => {
    it("endereço http(s) ou vazio; ativo precisa de endereço", () => {
      const paineis = normalizarPaineis([
        { id: "a", titulo: "A", url: "ftp://x", ativo: true },
        { id: "b", codigo: "b", url: "javascript:alert(1)", ativo: false },
        { id: "c", titulo: "C", url: "", ativo: true },
        { id: "d", titulo: "D", url: "", ativo: false },
        { id: "e", titulo: "E", url: "http://intranet", ativo: true },
      ]);
      const erros = errosDosPaineis(paineis);
      expect(Object.fromEntries(erros)).toEqual({
        [chaveDoErroDoPainel("a")]:
          "URL inválida no campo Endereço do painel A: use https:// ou http://.",
        [chaveDoErroDoPainel("b")]:
          "URL inválida no campo Endereço do painel b: use https:// ou http://.",
        [chaveDoErroDoPainel("c")]:
          "Painéis ativos precisam de uma URL configurada.",
      });
    });

    it("situação: inativo > manutenção > ativo com URL > sem URL", () => {
      expect(
        situacaoDoPainel({ ativo: false, em_manutencao: true, url: "x" }),
      ).toBe("inativo");
      expect(
        situacaoDoPainel({ ativo: true, em_manutencao: true, url: "" }),
      ).toBe("manutencao");
      expect(situacaoDoPainel({ ativo: true, url: " " })).toBe("semUrl");
      expect(
        resumoDosPaineis([{ ativo: true, url: "x" }, { ativo: false }]),
      ).toEqual({ total: 2, ativo: 1, manutencao: 0, inativo: 1, semUrl: 0 });
    });
  });

  describe("Operação: campos em React", () => {
    const OPERACAO = [
      "cogip_versao",
      "app_version_current",
      "feature_realtime_monitoramento",
      "access_heartbeat_minutos",
    ];

    it("entraram nas seções (monit_id, morto, saiu)", () => {
      for (const chave of OPERACAO) expect(CHAVES_DAS_SECOES).toContain(chave);
      expect(CHAVES_DAS_SECOES).not.toContain("monit_id");
      // O aviso global é da Página inicial, também em React.
      expect(CHAVES_DAS_SECOES).toContain("broadcast_msg");
    });

    it("normaliza como cfgBool/cfgInt do legado", () => {
      expect(normalizarBooleano("SIM")).toBe("true");
      expect(normalizarBooleano("0")).toBe("false");
      expect(normalizarBooleano("")).toBe("true");
      expect(normalizarInteiro("7min", 5)).toBe("7");
      expect(normalizarInteiro("0", 5)).toBe("1");
      expect(normalizarInteiro("", 5)).toBe("5");
      const valores = normalizarValoresCarregados({
        feature_realtime_monitoramento: "não",
        cogip_nome: "COGIP",
      });
      expect(valores.get("feature_realtime_monitoramento")).toBe("false");
      // Chave ausente: o padrão que o formulário legado mostrava.
      expect(valores.get("access_heartbeat_minutos")).toBe("5");
      expect(valores.get("cogip_nome")).toBe("COGIP");
      expect(valores.has("cogip_versao")).toBe(false);
    });

    it("heartbeat inteiro de 1 a 60; as linhas levam a descrição de antes", () => {
      const erro = (valor) =>
        errosDasSecoes(new Map([["access_heartbeat_minutos", valor]])).get(
          "access_heartbeat_minutos",
        );
      expect(erro("5")).toBeUndefined();
      expect(erro("60")).toBeUndefined();
      for (const ruim of ["0", "61", "2.5", ""])
        expect(erro(ruim)).toBe(
          "O heartbeat deve ser um número inteiro entre 1 e 60.",
        );
      const linhas = new Map(
        linhasDasSecoes(
          normalizarValoresCarregados({ cogip_versao: " V.2 " }),
        ).map((linha) => [linha.chave, linha]),
      );
      expect(linhas.get("cogip_versao")).toEqual({
        chave: "cogip_versao",
        valor: "V.2",
        descricao: "Versão do sistema",
      });
      expect(linhas.get("feature_realtime_monitoramento")).toEqual({
        chave: "feature_realtime_monitoramento",
        valor: "true",
        descricao: "Habilita atualização em tempo real do monitoramento",
      });
      expect(linhas.get("access_heartbeat_minutos").descricao).toBe(
        "Intervalo de auditoria heartbeat, em minutos",
      );
      expect(linhas.get("app_version_current").descricao).toBe(
        "Versão corrente publicada",
      );
    });
  });
});

bloco("permissoes-recursos", () => {
  describe("permissões por recurso", () => {
    it("nega módulo omitido, desconhecido e usuário desativado, inclusive admin", () => {
      const p = {
        perfil: "admin",
        permissoes: { nucleo: "leitor", calendario: "invalido" },
      };
      expect(hasResource(p, "dashboard")).toBe(false);
      expect(hasResource(p, "calendario")).toBe(false);
      expect(hasResource({ ...p, ativo: false }, "nucleo")).toBe(false);
      expect(canManageEditais(p)).toBe(false);
    });
    it("concede edição apenas no módulo escolhido sem elevar o perfil global", () => {
      const p = {
        perfil: "usuario",
        permissoes: {
          calendario: "editor",
          aprovados: "leitor",
          importacao: "editor",
        },
      };
      expect(canManageEditais(p)).toBe(true);
      expect(canChangeCandidateStatus(p)).toBe(false);
      expect(canImportApprovedList(p)).toBe(true);
      expect(canManageAccess(p)).toBe(false);
    });
  });
});

bloco("platform-context", () => {
  describe("contexto institucional da plataforma", () => {
    it("normaliza domínios e valida contas institucionais", () => {
      expect(
        normalizeAllowedDomains(
          "@AgenciaSUS.org.br, agsus.org.br, agsus.org.br",
        ),
      ).toEqual(["agenciasus.org.br", "agsus.org.br"]);
      expect(
        isAllowedInstitutionalEmail(
          "Pessoa@AgenciaSUS.org.br",
          "agenciasus.org.br",
        ),
      ).toBe(true);
      expect(
        isAllowedInstitutionalEmail("pessoa@gmail.com", "agenciasus.org.br"),
      ).toBe(false);
    });

    it("converte a resposta única do banco sem duplicar painéis", () => {
      expect(
        normalizePlatformContext({
          profile: { id: "perfil-1", nome: "Ana", ativo: true },
          panel_ids: ["painel-1", "painel-1", "painel-2"],
          modules: { ind: true },
        }),
      ).toEqual({
        profile: { id: "perfil-1", nome: "Ana", ativo: true },
        panelIds: ["painel-1", "painel-2"],
        modules: { ind: true },
      });
    });

    it("prioriza o nome institucional no shell", () => {
      expect(
        profileDisplayName(
          { nome: "Ana Souza" },
          { email: "ana@agenciasus.org.br" },
        ),
      ).toBe("Ana Souza");
    });
  });
});

bloco("pos159-regressoes", () => {
  const app = fonteDoApp();
  const governance = readFileSync(
    "src/modulos/configuracoes/estado.ts",
    "utf8",
  );
  const sidebar = readFileSync(
    "src/componentes/barra-lateral/marca.ts",
    "utf8",
  );
  const mapGuard = readFileSync(
    "src/modulos/mapa-saude-indigena/guarda-do-mapa.ts",
    "utf8",
  );
  const lifecycle = readFileSync("src/lib/sessao/session-lifecycle.ts", "utf8");
  // A barra lateral é React: o <img id="sideLogo"> nasce no componente da marca.
  const barraLateral = readFileSync(
    "src/componentes/barra-lateral/barra-lateral.tsx",
    "utf8",
  );
  const tuning = readFileSync(
    "src/styles/post157-interface-tuning.css",
    "utf8",
  );

  const semComentarios = (fonte) =>
    fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  /*
  1 — A cor da barra lateral não persistia.

  O botão Salvar (e o Ctrl+S) publica pelo estado de Configurações
  (src/modulos/configuracoes/estado.ts), que chama `revisar` direto — o `saveAdminSettings` do legado, que nesse fluxo
  nunca rodava, saiu. As chaves da barra lateral tinham sido acrescentadas só
  a ele: a coleta das linhas não as via, `buildChanges()` não achava
  diferença e mudar apenas a cor terminava em "Nada para publicar".
*/
  describe("as chaves da barra lateral chegam ao caminho que realmente salva", () => {
    it("o fluxo de governança é quem publica", () => {
      const codigo = semComentarios(governance);
      expect(codigo).not.toMatch(/window.saveAdminSettingss*=/);
      expect(codigo).toContain("void revisar()");
      expect(semComentarios(app)).not.toContain("function saveAdminSettings");
    });

    it("as linhas da publicação incluem as da barra lateral", () => {
      const fn = semComentarios(governance).slice(
        semComentarios(governance).indexOf("const linhasDaPublicacao"),
        semComentarios(governance).indexOf("async function revisar"),
      );
      expect(fn).toContain(
        "linhasDasSecoes(valoresAtuais(), [...estado.rascunho.keys()])",
      );
      expect(CHAVES_DAS_SECOES).toContain("ui_sidebar_logo_url");
      expect(CHAVES_DAS_SECOES).toContain("ui_sidebar_background_color");
    });

    /*
    A guarda de antes (sem os campos no DOM, nenhuma linha) existia para um
    salvamento não gravar os valores padrão por cima de uma personalização.
    Agora os valores vêm do que o banco devolveu: a personalização volta
    intacta na publicação.
  */
    it("publicar outra coisa não troca a personalização da barra pelo padrão", () => {
      const linhas = new Map(
        linhasDasSecoes(
          normalizarValoresCarregados({
            ui_sidebar_logo_url: "https://cdn.test/logo.png",
            ui_sidebar_background_color: "#123456",
          }),
        ).map((linha) => [linha.chave, linha.valor]),
      );
      expect(linhas.get("ui_sidebar_logo_url")).toBe(
        "https://cdn.test/logo.png",
      );
      expect(linhas.get("ui_sidebar_background_color")).toBe("#123456");
    });
  });

  /*
  2 — A logo sumia no shell.

  A apresentação dependia de `.side-logo-wrap { background-image: var(...) }`,
  que o antigo `system-ui-fixes.css` anulava com `background: transparent !important` — o
  atalho `background` zera `background-image` e o `!important` vence a regra
  normal. Com o `<img>` em `opacity: 0`, não sobrava nada visível.
*/
  describe("a logo da barra lateral é o <img> real", () => {
    it("o <img> não é mais escondido por opacidade", () => {
      expect(tuning).not.toMatch(
        /\.side-logo-wrap\s+\.side-logo\s*\{[^}]*opacity:\s*0/,
      );
    });

    it("a apresentação por background-image saiu", () => {
      expect(tuning).not.toContain("--sidebar-logo-image");
      expect(semComentarios(sidebar)).not.toContain("--sidebar-logo-image");
    });

    /*
    A logo é o `src` do <img> que o React desenha (barra-lateral.tsx), lido da
    marca gravada (marca.ts). O comportamento está em
    tests/casca-com-modulo-simulado-na-tela.test.ts (bloco componentes/barra-lateral); aqui, só que não volta a esconder.
  */
    it("a barra desenha a logo gravada no próprio <img>", () => {
      expect(barraLateral).toContain("logoDaBarraLateral");
      expect(barraLateral).toContain("usarLogo(logo ?? gravada)");
    });

    it("a logo que não carrega devolve o padrão em vez de esconder", () => {
      expect(barraLateral).toContain(
        "src: falhou === logo ? LOGO_PADRAO_DA_BARRA : logo",
      );
      expect(barraLateral).toContain("onError: () => definirFalhou(logo)");
      expect(barraLateral).not.toMatch(/display\s*[:=]\s*["']none["']/);
    });

    /*
    O `src` de fábrica apontava para i.postimg.cc, um host externo, e o `onerror`
    inline escondia a imagem. Uma logo padrão precisa aparecer mesmo sem rede
    para terceiros e mesmo se a leitura do banco falhar.
  */
    it("o <img> da barra lateral nasce com a logo local, sem host externo", () => {
      const marca = barraLateral.indexOf('id="sideLogo"');
      expect(marca).toBeGreaterThan(-1);
      const tag = barraLateral.slice(
        marca,
        barraLateral.indexOf(">", barraLateral.indexOf("/>", marca)),
      );
      // O `src` vem de marca.ts, que nasce com a logo local padrão.
      expect(LOGO_PADRAO_DA_BARRA).toBe("/assets/agsus-logo.webp");
      expect(sidebar).toContain("let logoAtual = LOGO_PADRAO_DA_BARRA;");
      expect(barraLateral).not.toContain("postimg.cc");
      expect(tag).not.toMatch(/onerror/i);
    });

    it("a configuração do app não sobrescreve mais a logo da barra lateral", () => {
      const fn = readFileSync("src/app/configuracao.ts", "utf8");
      expect(fn).not.toContain('"sideLogo"');
    });
  });

  /*
  3 — Área desperdiçada nos mapas.
*/
  describe("enquadramento do Brasil medido no contorno real", () => {
    /*
    A constante contra os vértices do contorno (a cópia única, em
    src/lib/mapas/mapa-saude-indigena/contornos.js) é conferida em
    tests/mapas-e-visao-geral.test.js (bloco mapa-saude-indigena).
  */
    it("a guarda do mapa usa a medição, não um retângulo à mão", () => {
      expect(mapGuard).toMatch(
        /import\s*\{\s*BRASIL_BOUNDS,\s*NAVEGACAO_BOUNDS,?\s*\}\s*from "\.\.\/\.\.\/lib\/mapas\/brasil-bounds\.ts"/,
      );
      expect(semComentarios(mapGuard)).not.toContain("-34.9");
      expect(semComentarios(mapGuard)).not.toContain("-74.2");
    });
  });

  describe("um dono só para o enquadramento inicial", () => {
    /*
    Os disparos em 120 ms e 420 ms eram prazos chutados: se o card demorasse mais
    que isso para assentar, o mapa ficava enquadrado para uma medida vencida.
  */
    it("os reenquadramentos por temporizador saíram", () => {
      const ready = mapGuard.slice(
        mapGuard.indexOf("map.whenReady(() => {"),
        mapGuard.indexOf('map.on("resize"'),
      );
      expect(ready).not.toMatch(/setTimeout\(fitBrazilOverview/);
      expect(ready).toContain("observarTamanhoDoCard(map, fitBrazilOverview)");
    });

    it("quem avisa é o tamanho do container", () => {
      const fn = mapGuard.slice(
        mapGuard.indexOf("function observarTamanhoDoCard"),
      );
      expect(fn).toContain("new ResizeObserver");
      expect(fn).toContain("map.getContainer");
      expect(fn).toContain("observador.disconnect()");
    });

    it("o overview é derivado do zoom, não só da bandeira", () => {
      const fn = mapGuard.slice(
        mapGuard.indexOf("function emOverview"),
        mapGuard.indexOf("function observarTamanhoDoCard"),
      );
      expect(fn).toContain("map.__agsusOverviewMode");
      expect(fn).toContain("getZoom");
    });
  });

  /*
  Um mapa principal de cada vez (o nacional ou o do DSEI) é do componente
  React: tests/casca-sessao-e-interface-na-tela.test.js (bloco modulos/mapa-saude-indigena).
*/

  /*
  5 — "Sessão: 01:00:00" anunciava um encerramento desligado desde 08/09/2026.
*/
  describe("nada de contagem regressiva para uma ação que não acontece", () => {
    it("o encerramento por inatividade continua desligado", () => {
      expect(lifecycle).toContain("let encerrarPorInatividadeAtivo = false;");
    });

    it("o relógio fica oculto enquanto o encerramento estiver desligado", () => {
      const fn = lifecycle.slice(
        lifecycle.indexOf("function updateTimerUi"),
        lifecycle.indexOf("function showNotice"),
      );
      expect(fn).toContain(
        "timer.hidden = !activeUserId || !encerrarPorInatividadeAtivo;",
      );
      expect(fn).toContain("if (timer.hidden) return;");
    });

    it("os avisos de 10 minutos e de 1 minuto não disparam", () => {
      const fn = lifecycle.slice(
        lifecycle.indexOf("function warnWhenNeeded"),
        lifecycle.indexOf("function tickSession"),
      );
      const codigo = semComentarios(fn);
      expect(
        codigo.indexOf("if (!encerrarPorInatividadeAtivo) return;"),
      ).toBeGreaterThan(-1);
      expect(
        codigo.indexOf("if (!encerrarPorInatividadeAtivo) return;"),
      ).toBeLessThan(codigo.indexOf("warnedOneMinute"));
    });

    it("a auditoria e a sincronização entre abas continuam", () => {
      expect(lifecycle).toContain("function auditExpiration");
      expect(lifecycle).toContain("function readSharedActivity");
      expect(lifecycle).toContain("registerActivity");
    });
  });
});

bloco("pwa-lifecycle", () => {
  const lifecycleSource = readFileSync("src/modules/pwa-lifecycle.ts", "utf8");

  describe("ciclo web sem oferta de instalação", () => {
    it("não registra prompt nem orientação de instalação", () => {
      expect(lifecycleSource).not.toContain("beforeinstallprompt");
      expect(lifecycleSource).not.toContain("appinstalled");
      expect(lifecycleSource).not.toContain("Instalar Yeendé");
      expect(lifecycleSource).not.toContain("Instalar no iPhone ou iPad");
      expect(lifecycleSource).not.toContain("Adicionar à Tela de Início");
    });

    it("não injeta manifest nem meta tags de app instalável", () => {
      expect(lifecycleSource).not.toContain("manifest.webmanifest");
      expect(lifecycleSource).not.toContain("mobile-web-app-capable");
      expect(lifecycleSource).not.toContain("apple-mobile-web-app-capable");
    });

    it("preserva o service worker para atualização e operação offline", () => {
      expect(lifecycleSource).toContain(
        'navigator.serviceWorker.register("/sw.js")',
      );
      expect(lifecycleSource).toContain("navigator.serviceWorker.ready");
      expect(lifecycleSource).toContain("SKIP_WAITING");
    });

    it("verifica atualização somente online, visível e após o intervalo", () => {
      const base = {
        now: 1_000_000,
        lastCheckedAt: 100_000,
        online: true,
        visible: true,
        minimumInterval: 900_000,
      };

      expect(shouldCheckForUpdate(base)).toBe(true);
      expect(shouldCheckForUpdate({ ...base, online: false })).toBe(false);
      expect(shouldCheckForUpdate({ ...base, visible: false })).toBe(false);
      expect(shouldCheckForUpdate({ ...base, lastCheckedAt: 200_000 })).toBe(
        false,
      );
    });

    it("permite a primeira verificação sem histórico", () => {
      expect(
        shouldCheckForUpdate({
          now: 100,
          lastCheckedAt: 0,
          online: true,
          visible: true,
          minimumInterval: 900_000,
        }),
      ).toBe(true);
    });

    it("não recarrega em controllerchange não solicitado", () => {
      expect(
        shouldReloadAfterControllerChange({
          updateRequested: false,
          alreadyReloading: false,
        }),
      ).toBe(false);
    });

    it("recarrega uma única vez após atualização solicitada", () => {
      expect(
        shouldReloadAfterControllerChange({
          updateRequested: true,
          alreadyReloading: false,
        }),
      ).toBe(true);
      expect(
        shouldReloadAfterControllerChange({
          updateRequested: true,
          alreadyReloading: true,
        }),
      ).toBe(false);
    });
  });

  describe("versão nova espera a troca de página", () => {
    it("sem versão nova esperando, não recarrega", async () => {
      const { aplicarAtualizacaoPendente, marcarAtualizacaoPendenteParaTeste } =
        await import("../src/modules/pwa-lifecycle.ts");
      marcarAtualizacaoPendenteParaTeste(false);
      let recargas = 0;
      expect(aplicarAtualizacaoPendente(() => (recargas += 1))).toBe(false);
      expect(recargas).toBe(0);
    });

    it("com versão nova esperando, recarrega uma vez só", async () => {
      const { aplicarAtualizacaoPendente, marcarAtualizacaoPendenteParaTeste } =
        await import("../src/modules/pwa-lifecycle.ts");
      marcarAtualizacaoPendenteParaTeste(true);
      let recargas = 0;
      expect(aplicarAtualizacaoPendente(() => (recargas += 1))).toBe(true);
      expect(aplicarAtualizacaoPendente(() => (recargas += 1))).toBe(false);
      expect(recargas).toBe(1);
    });

    it("a troca de controlador não recarrega na hora (quem digita não perde o texto)", () => {
      const trecho = lifecycleSource.slice(
        lifecycleSource.indexOf('addEventListener("controllerchange"'),
      );
      const handler = trecho.slice(
        0,
        trecho.indexOf("export function aplicarAtualizacaoPendente"),
      );
      expect(handler).not.toContain("location.reload");
      expect(handler).toContain("atualizacaoPendente = true");
    });

    it("o navigate aplica a versão nova depois da guarda de alterações não salvas", () => {
      // src/app/navegacao.ts: a guarda pergunta primeiro; recusada, nada recarrega.
      const ordem = [];
      const navegacao = criarNavegacao({
        janela: { location: { reload() {} } },
        confirmarSaida: () => {
          ordem.push("guarda");
          return ordem.length > 1;
        },
        aplicarAtualizacao: () => {
          ordem.push("versao");
          return true;
        },
      });
      navegacao.irPara("nucleo");
      expect(ordem).toEqual(["guarda"]);
      navegacao.irPara("nucleo");
      expect(ordem).toEqual(["guarda", "guarda", "versao"]);
      expect(navegacao.obter().view).toBe("dashboard");
      navegacao.desligar();
    });
  });
});

bloco("rotas", () => {
  /*
  As rotas do app (src/lib/navegacao/rotas.ts): a área e a tela no endereço. O caminho
  vai e volta sem perder nada, o que não é rota fica de fora, e a Vercel e o
  servidor entregam o index.html para toda rota (o link direto não dá 404).
*/
  const EDITAL = "0b7c9a52-2d55-4c4e-9f7a-1c3d5e7f9a1b";

  describe("caminho ↔ destino", () => {
    it("as telas das áreas: /<área>/<tela>", () => {
      expect(caminhoDoDestino({ view: "calendario", area: "sede" })).toBe(
        "/sede/cronograma",
      );
      expect(caminhoDoDestino({ view: "dashboard", area: "projetos" })).toBe(
        "/projetos/visao-geral",
      );
      expect(
        caminhoDoDestino({ view: "pre-classificacao", area: "sede" }),
      ).toBe("/sede/triagem");
      expect(destinoDoCaminho("/saude-indigena/editais")).toEqual({
        view: "nucleo",
        area: "saude-indigena",
      });
    });

    it("todas as telas vão e voltam, em todas as áreas", () => {
      for (const { id: area } of AREAS_DO_SISTEMA)
        for (const { view, editalObrigatorio } of TELAS_DAS_AREAS) {
          // A página do edital só existe com o edital: vai e volta com ele.
          const destino = editalObrigatorio
            ? { view, area, edital: "105-2026" }
            : { view, area };
          const caminho = caminhoDoDestino(destino);
          expect(destinoDoCaminho(caminho), caminho).toEqual(destino);
        }
    });

    it("a página do edital: /<área>/edital/<número-ano>, o edital fica e é obrigatório", () => {
      expect(
        caminhoDoDestino({
          view: "edital",
          area: "saude-indigena",
          edital: "105-2026",
        }),
      ).toBe("/saude-indigena/edital/105-2026");
      expect(destinoDoCaminho("/sede/edital/105-2026")).toEqual({
        view: "edital",
        area: "sede",
        edital: "105-2026",
      });
      expect(destinoDoCaminho(`/projetos/edital/${EDITAL}`)).toEqual({
        view: "edital",
        area: "projetos",
        edital: EDITAL,
      });
      // Sem o edital não é rota (nem vai para o endereço).
      expect(destinoDoCaminho("/sede/edital")).toBeNull();
      expect(caminhoDoDestino({ view: "edital", area: "sede" })).toBe("/");
      // Não confunde com Editais nem com as Regras do edital.
      expect(destinoDoCaminho("/sede/edital/105-2026/regras")).toBeNull();
      expect(destinoDoCaminho("/sede/editais")).toEqual({
        view: "nucleo",
        area: "sede",
      });
      expect(editalEhAPagina("edital")).toBe(true);
      expect(editalEhAPagina("classificacao")).toBe(false);
      expect(telaDaRota("edital")?.tituloNaTela).toBe(true);
    });

    it("o edital só nas telas que o abrem; a visão na busca", () => {
      expect(
        caminhoDoDestino({
          view: "classificacao",
          area: "sede",
          edital: EDITAL,
        }),
      ).toBe(`/sede/classificacao/${EDITAL}`);
      expect(
        caminhoDoDestino({ view: "nucleo", area: "sede", edital: EDITAL }),
      ).toBe("/sede/editais");
      expect(
        destinoDoCaminho(`/sede/entrevistas/${EDITAL}`, "?visao=fila"),
      ).toEqual({
        view: "conduzir-entrevistas",
        area: "sede",
        edital: EDITAL,
        visao: "fila",
      });
      expect(destinoDoCaminho(`/sede/editais/${EDITAL}`)).toBeNull();
    });

    it("Regras do edital: /<área>/editais/<edital>/regras/<etapa>", () => {
      expect(
        caminhoDoDestino({
          view: "nucleo",
          area: "sede",
          edital: EDITAL,
          regras: "classificacao",
        }),
      ).toBe(`/sede/editais/${EDITAL}/regras/classificacao`);
      expect(
        destinoDoCaminho(`/sede/editais/${EDITAL}/regras/classificacao`),
      ).toEqual({
        view: "nucleo",
        area: "sede",
        edital: EDITAL,
        regras: "classificacao",
      });
      // Sem etapa, a primeira (Triagem).
      expect(destinoDoCaminho(`/sede/editais/${EDITAL}/regras`)).toEqual({
        view: "nucleo",
        area: "sede",
        edital: EDITAL,
        regras: "triagem",
      });
      // Etapa que não existe, outra tela ou área reservada: não é rota.
      for (const caminho of [
        `/sede/editais/${EDITAL}/regras/outra`,
        `/sede/editais/${EDITAL}/regras/triagem/mais`,
        `/sede/cronograma/${EDITAL}/regras/triagem`,
        `/administracao/editais/${EDITAL}/regras/triagem`,
      ])
        expect(destinoDoCaminho(caminho), caminho).toBeNull();
      // Sem edital, as regras não vão para o endereço.
      expect(
        caminhoDoDestino({ view: "nucleo", area: "sede", regras: "triagem" }),
      ).toBe("/sede/editais");
    });

    it("Configurações, painel externo e sem acesso", () => {
      expect(caminhoDoDestino({ view: "config", secao: "acessos" })).toBe(
        "/administracao/configuracoes/acessos",
      );
      expect(caminhoDoDestino({ view: "config" })).toBe(
        "/administracao/configuracoes",
      );
      expect(destinoDoCaminho("/administracao/configuracoes/marca")).toEqual({
        view: "config",
        secao: "marca",
      });
      expect(caminhoDoDestino({ view: "panel:bi-rh" })).toBe("/paineis/bi-rh");
      expect(destinoDoCaminho("/paineis/bi-rh")).toEqual({
        view: "panel:bi-rh",
      });
      expect(caminhoDoDestino({ view: "sem-acesso" })).toBe("/sem-acesso");
      expect(destinoDoCaminho("/sem-acesso")).toEqual({ view: "sem-acesso" });
    });

    it("o que não é rota: a raiz, tela que não existe, pedaço estranho", () => {
      expect(destinoDoCaminho("/")).toBeNull();
      expect(destinoDoCaminho("/index.html")).toBeNull();
      expect(ehRaizDoApp("/")).toBe(true);
      expect(ehRaizDoApp("/index.html")).toBe(true);
      expect(ehRaizDoApp("/sede/editais")).toBe(false);
      for (const caminho of [
        "/sede",
        "/sede/nao-existe",
        "/sede/editais/a/b",
        "/sede/%3Cscript%3E",
        "/sede/editais%2F..",
        "/paineis",
        "/administracao/outra",
      ])
        expect(destinoDoCaminho(caminho), caminho).toBeNull();
      // Sem área conhecida, a tela vai para a raiz (a de entrada decide).
      expect(caminhoDoDestino({ view: "nucleo" })).toBe("/");
      expect(caminhoDoDestino({ view: "chat", area: "sede" })).toBe("/");
      expect(telaDaRota("config")).toBeUndefined();
    });
  });

  describe("hospedagem: toda rota entrega o app", () => {
    const exemplos = [
      ...AREAS_DO_SISTEMA.flatMap(({ id: area }) =>
        TELAS_DAS_AREAS.map(({ view }) => caminhoDoDestino({ view, area })),
      ),
      caminhoDoDestino({
        view: "conduzir-entrevistas",
        area: "sede",
        edital: EDITAL,
      }),
      caminhoDoDestino({
        view: "nucleo",
        area: "sede",
        edital: EDITAL,
        regras: "classificacao",
      }),
      caminhoDoDestino({ view: "config", secao: "acessos" }),
      caminhoDoDestino({ view: "panel:bi" }),
      caminhoDoDestino({ view: "sem-acesso" }),
    ];

    it("o servidor (server/servidor.ts) entrega o index.html", () => {
      for (const caminho of exemplos)
        expect(paginaDoCaminho(caminho), caminho).toBe("index.html");
    });

    it("a Vercel reescreve as mesmas áreas para a página inicial", () => {
      const vercel = JSON.parse(readFileSync("vercel.json", "utf8"));
      const [areas, semAcesso] = vercel.rewrites;
      // Com cleanUrls, /index.html responde 308; o destino tem de ser "/".
      expect(vercel.cleanUrls).toBe(true);
      expect(areas.destination).toBe("/");
      const lista = /\/:area\(([^)]+)\)\/:caminho\*/.exec(areas.source)?.[1];
      expect(lista?.split("|").sort()).toEqual(
        AREAS_DO_MENU.map((area) => area.id).sort(),
      );
      expect(semAcesso).toEqual({
        source: "/sem-acesso",
        destination: "/",
      });
      // Arquivos e funções continuam com a Vercel (o sistema de arquivos vem antes).
      for (const fora of ["/api/", "/assets/", "/auth/", "/icons/", "/data/"])
        expect(areas.source.startsWith(fora)).toBe(false);
    });
  });
});

bloco("selecao-do-painel", () => {
  /* O formato de get_selecao_da_area (20261001090000_selecao.sql). */
  const PAYLOAD = {
    schema_version: 1,
    area: "saude-indigena",
    gerado_em: "2026-10-01T12:00:00Z",
    ultima_carga: { em: "2026-10-01T09:02:00", linhas: 3, sem_edital: 1 },
    vagas: [
      {
        id: "v1",
        edital_id: "m6",
        edital: "06/2026",
        unidade: "DSEI Xingu",
        vaga: "104123",
        cargo: "Enfermeiro",
        inscritos: 83,
        aptos: 72,
        cancelados: 2,
        reprovados_questionario: 9,
        eliminados_nota: 0,
        reprovados_analise: 3,
        triados: 69,
        total_eliminados: 11,
        observacao: "1 Interessado",
        convocados: 10,
        origem_convocados: "entrevistas",
        aprovados: 8,
        contratados: 2,
        nao_contratados: 6,
      },
      {
        id: "v2",
        edital_id: "m6",
        edital: "06/2026",
        unidade: "DSEI Yanomami",
        vaga: "104124",
        cargo: "Médico",
        inscritos: 10,
        aptos: 8,
        cancelados: 1,
        reprovados_questionario: 1,
        triados: 6,
        reprovados_analise: 2,
        total_eliminados: 2,
        observacao: "1 interessado",
        convocados: 0,
        origem_convocados: "entrevistas",
        aprovados: null,
        contratados: null,
      },
      {
        id: "v3",
        edital_id: null,
        edital: "96/2025",
        unidade: "Projeto Agora Tem Especialistas Caminhoneiros",
        vaga: null,
        vaga_planilha: "CARGO 1: MÉDICO",
        cargo: "CARGO 1: MÉDICO",
        inscritos: 39,
        total_eliminados: 0,
        convocados: 4,
        origem_convocados: "planilha",
        aprovados: null,
      },
    ],
  };

  const vagas = normalizarPayload(PAYLOAD).vagas;
  const ids = (xs) => xs.map((v) => v.id);

  describe("payload da seleção", () => {
    it("normaliza números, vaga e origem dos convocados", () => {
      expect(vagas[0]).toMatchObject({
        vaga: "104123",
        inscritos: 83,
        eliminadosNota: 0,
        aprovados: 8,
        origemConvocados: "entrevistas",
      });
      // Outra banca: cargo no lugar da vaga, sem código e com os números vazios.
      expect(vagas[2]).toMatchObject({
        vaga: null,
        cargo: "CARGO 1: MÉDICO",
        aptos: null,
        origemConvocados: "planilha",
      });
    });

    it("payload estranho vira lista vazia", () => {
      expect(normalizarPayload(null).vagas).toEqual([]);
      expect(normalizarPayload({ vagas: "x" }).vagas).toEqual([]);
    });

    it("ignora entradas que não são objetos e mantém zero separado de número ausente", () => {
      const dados = normalizarPayload({
        vagas: [
          null,
          false,
          7,
          "vaga",
          [],
          {},
          {
            id: "valida",
            inscritos: "12.6",
            aptos: 0,
            triados: "",
            convocados: "não informado",
            aprovados: null,
          },
        ],
      });
      expect(dados.vagas).toHaveLength(1);
      expect(dados.vagas[0]).toMatchObject({
        id: "valida",
        inscritos: 13,
        aptos: 0,
        triados: null,
        convocados: null,
        aprovados: null,
      });
      expect(calcularIndicadores(dados.vagas)).toMatchObject({
        vagas: 1,
        inscritos: 13,
        aptos: 0,
        triados: null,
        taxa: null,
      });
      for (const externo of [undefined, "resposta", 7, false, []]) {
        expect(normalizarPayload(externo)).toMatchObject({
          area: "",
          vagas: [],
        });
        expect(PAINEL_DE_SELECAO.valido(externo)).toBe(false);
      }
    });
  });

  describe("filtros de escolha múltipla (DSEI, edital, cargo, vaga)", () => {
    it("vazio é tudo; cada filtro aceita vários valores; a busca olha a observação", () => {
      expect(ids(filtrarVagas(vagas))).toEqual(["v1", "v2", "v3"]);
      expect(
        ids(
          filtrarVagas(vagas, {
            ...FILTROS_VAZIOS,
            unidades: ["DSEI Xingu", "DSEI Yanomami"],
          }),
        ),
      ).toEqual(["v1", "v2"]);
      expect(
        ids(filtrarVagas(vagas, { ...FILTROS_VAZIOS, editais: ["96/2025"] })),
      ).toEqual(["v3"]);
      expect(
        ids(filtrarVagas(vagas, { ...FILTROS_VAZIOS, vagas: ["104124"] })),
      ).toEqual(["v2"]);
      expect(ids(filtrarVagas(vagas, FILTROS_VAZIOS, "interessado"))).toEqual([
        "v1",
        "v2",
      ]);
      expect(ids(filtrarVagas(vagas, FILTROS_VAZIOS, "medico"))).toEqual([
        "v2",
        "v3",
      ]);
    });

    it("as opções de um filtro seguem os outros filtros escolhidos", () => {
      const todas = opcoesDosFiltros(vagas);
      expect(todas.editais).toEqual(["06/2026", "96/2025"]);
      expect(todas.vagas).toEqual(["104123", "104124"]);
      const soXingu = opcoesDosFiltros(vagas, {
        ...FILTROS_VAZIOS,
        unidades: ["DSEI Xingu"],
      });
      expect(soXingu.editais).toEqual(["06/2026"]);
      expect(soXingu.cargos).toEqual(["Enfermeiro"]);
      // O filtro escolhido não limita as próprias opções.
      expect(soXingu.unidades).toHaveLength(3);
    });

    it("os filtros ativos (chips e recorte) dizem o que foi escolhido; fora da SI a unidade não é DSEI", () => {
      const filtros = {
        ...FILTROS_VAZIOS,
        editais: ["06/2026"],
        unidades: ["DSEI Xingu"],
      };
      expect(filtrosAtivos(filtros).map((f) => f.rotulo)).toEqual([
        "Nome DSEI",
        "Edital",
      ]);
      expect(filtrosAtivos(filtros, "sede")[0]).toEqual({
        campo: "unidades",
        rotulo: "Unidade",
        valores: ["DSEI Xingu"],
      });
      expect(filtrosAtivos(FILTROS_VAZIOS)).toEqual([]);
      expect(rotuloDaUnidade("sede")).toBe("Unidade");
    });
  });

  describe("os 7 KPIs", () => {
    it("soma ignora vazio; taxa = contratados / aprovados", () => {
      expect(somar(vagas, "inscritos")).toBe(132);
      expect(calcularIndicadores(vagas)).toEqual({
        vagas: 3,
        inscritos: 132,
        aptos: 80,
        triados: 75,
        convocados: 14,
        aprovados: 8,
        contratados: 2,
        taxa: 0.25,
      });
      expect(taxaDeContratacao(0, 0)).toBeNull();
    });

    it("a taxa só conta as vagas com aprovados (não passa de 100%)", () => {
      const base = vagas[0];
      const recorte = [
        { ...base, aprovados: 4, contratados: 2 },
        { ...base, aprovados: null, contratados: 5 },
      ];
      const kpis = calcularIndicadores(recorte);
      expect(kpis.contratados).toBe(7);
      expect(kpis.taxa).toBe(0.5);
    });

    it("formata como o painel antigo (zero sem número, taxa em %)", () => {
      expect(formatarQuantidade(null)).toBe("0");
      expect(formatarQuantidade(1234)).toBe("1.234");
      expect(formatarTaxa(0.25)).toBe("25%");
      expect(formatarTaxa(1 / 3)).toBe("33,3%");
      expect(formatarTaxa(null)).toBe("0%");
    });
  });

  describe("os 5 gráficos", () => {
    it("eliminados antes da análise, aptos × eliminados, triados × reprovados", () => {
      expect(eliminadosAntesDaAnalise(vagas).map((x) => x.valor)).toEqual([
        3, 10, 0,
      ]);
      expect(aptosEEliminados(vagas).map((x) => x.valor)).toEqual([80, 13]);
      expect(triadosEReprovados(vagas).map((x) => x.valor)).toEqual([75, 5]);
    });

    it("top DSEIs por inscritos", () => {
      expect(topUnidades(vagas, 2)).toEqual([
        { rotulo: "DSEI Xingu", valor: 83 },
        { rotulo: "Projeto Agora Tem Especialistas Caminhoneiros", valor: 39 },
      ]);
    });
  });

  describe("alertas da coluna Observação", () => {
    it("cada observação uma vez (sem diferenciar caixa), com onde aparece", () => {
      expect(observacoesDoRecorte(vagas)).toEqual([
        {
          texto: "1 Interessado",
          vagas: 2,
          unidades: ["DSEI Xingu", "DSEI Yanomami"],
          editais: ["06/2026"],
        },
      ]);
      expect(observacoesDoRecorte([vagas[2]])).toEqual([]);
    });
  });

  describe("Exportação e cópia guardada", () => {
    it("a tabela da exportação: números como número, vazio em branco", () => {
      const perigosa = normalizarPayload({
        vagas: [
          { id: "z", edital: "1/2026", cargo: "=HYPERLINK(1)", inscritos: 3 },
        ],
      }).vagas;
      const { colunas, linhas } = tabelaDaSelecao(perigosa);
      expect(colunas.slice(0, 4)).toEqual([
        "DSEI / Unidade",
        "Edital",
        "Cargo",
        "Vaga",
      ]);
      const linha = linhas[0];
      expect(linha[2]).toBe("=HYPERLINK(1)");
      expect(linha[colunas.indexOf("Inscritos")]).toBe(3);
      expect(linha[colunas.indexOf("Aptos para análise")]).toBeNull();
      expect(linha).toContain("Planilha Auditoria (dado antigo)");
    });

    it("tipo da cópia e mudança sem contar gerado_em", () => {
      expect(PAINEL_DE_SELECAO.chave({ area: "sede" })).toBe("selecao:sede");
      expect(PAINEL_DE_SELECAO.valido(PAYLOAD)).toBe(true);
      expect(PAINEL_DE_SELECAO.valido({ vagas: null })).toBe(false);
      expect(
        payloadMudou(PAYLOAD, { ...PAYLOAD, gerado_em: "2026-10-02" }),
      ).toBe(false);
      expect(payloadMudou(PAYLOAD, { ...PAYLOAD, vagas: [] })).toBe(true);
    });
  });

  describe("registro da aba", async () => {
    const { ABAS_DO_MENU } =
      await import("../src/lib/navegacao/menu-lateral.ts");
    const { RESOURCES } =
      await import("../src/lib/acessos/permissoes-recursos.ts");
    const { canViewSelecao, paginasPermitidas } =
      await import("../src/lib/acessos/access-roles.ts");
    const { NOMES_DE_ICONES } = await import("../src/modules/icones.ts");

    it("o Painel da Seleção fica em Acompanhar, depois do Painel de entrevistas, como beta", () => {
      const lista = ABAS_DO_MENU.map((aba) => aba.id);
      expect(lista.indexOf("selecao")).toBe(lista.indexOf("entrevistas") + 1);
      expect(ABAS_DO_MENU.find((aba) => aba.id === "selecao")).toMatchObject({
        view: "selecao",
        recurso: "selecao",
        icone: "funnel",
        ordem: 5,
        beta: true,
      });
      expect(NOMES_DE_ICONES).toContain("funnel");
      expect(RESOURCES).toContainEqual(["selecao", "Painel da Seleção"]);
    });

    it("leitor vê; sem a chave na matriz, a aba some", () => {
      const perfil = (nivel) => ({
        perfil: "usuario",
        permissoes: { selecao: nivel },
      });
      expect(canViewSelecao(perfil("leitor"))).toBe(true);
      expect(canViewSelecao(perfil("sem_acesso"))).toBe(false);
      expect(canViewSelecao({ perfil: "admin", permissoes: {} })).toBe(false);
      expect(paginasPermitidas(perfil("leitor")).selecao).toBe(true);
    });
  });
});

bloco("sessao", () => {
  const clienteQue = (resposta) => ({
    auth: {
      getSession: async () => {
        if (resposta instanceof Error) throw resposta;
        return resposta;
      },
    },
  });

  const sessaoValida = { session: { access_token: "abc", user: { id: "u1" } } };

  describe("classificação de falha transitória", () => {
    it("reconhece a falha de rede do auth-js", () => {
      expect(
        ehFalhaTransitoria(new AuthRetryableFetchError("Failed to fetch", 0)),
      ).toBe(true);
    });

    it("reconhece o TypeError que o fetch lança quando a rede cai", () => {
      expect(ehFalhaTransitoria(new TypeError("Failed to fetch"))).toBe(true);
    });

    it("reconhece requisição abortada e tempo esgotado", () => {
      const abortada = new Error("abort");
      abortada.name = "AbortError";
      expect(ehFalhaTransitoria(abortada)).toBe(true);
    });

    it("reconhece indisponibilidade temporária do servidor", () => {
      expect(ehFalhaTransitoria({ status: 503 })).toBe(true);
      expect(ehFalhaTransitoria({ status: 429 })).toBe(true);
    });

    it("não confunde falta de permissão com falha de rede", () => {
      expect(ehFalhaTransitoria({ status: 403, code: "42501" })).toBe(false);
    });
  });

  describe("classificação de sessão encerrada", () => {
    it("aceita a ausência de sessão declarada pela biblioteca", () => {
      expect(ehSessaoEncerrada(new AuthSessionMissingError())).toBe(true);
    });

    it("aceita 401 vindo da API de autenticação", () => {
      expect(
        ehSessaoEncerrada(new AuthApiError("invalid claim", 401, "bad_jwt")),
      ).toBe(true);
    });

    it("aceita os códigos de JWT vencido do PostgREST", () => {
      expect(ehSessaoEncerrada({ code: "PGRST301" })).toBe(true);
    });

    /*
    Este é o teste da regressão original. A mensagem abaixo é uma função ausente
    no banco — contém a palavra "session" no nome do parâmetro, e era isso que
    fazia o sistema anunciar expiração a quem estava perfeitamente autenticado.
  */
    it("não trata função ausente como sessão expirada", () => {
      const ausente = {
        code: "PGRST202",
        message:
          "Could not find the function public.registrar_evento_acesso(p_client_session_id, p_evento) in the schema cache",
      };
      expect(ehSessaoEncerrada(ausente)).toBe(false);
    });

    it("não trata falta de permissão como sessão expirada", () => {
      expect(
        ehSessaoEncerrada(new AuthApiError("forbidden", 403, "not_admin")),
      ).toBe(false);
      expect(
        ehSessaoEncerrada({
          code: "42501",
          message: "permission denied for table configuracoes",
        }),
      ).toBe(false);
    });

    it("não trata queda de rede como sessão expirada", () => {
      expect(
        ehSessaoEncerrada(new AuthRetryableFetchError("Failed to fetch", 0)),
      ).toBe(false);
      expect(ehSessaoEncerrada(new TypeError("Failed to fetch"))).toBe(false);
    });
  });

  describe("estado da sessão", () => {
    it("é ativa quando há token", async () => {
      const r = await estadoDaSessao(
        clienteQue({ data: sessaoValida, error: null }),
      );
      expect(r.estado).toBe(SESSAO_ATIVA);
      expect(r.sessao.access_token).toBe("abc");
    });

    it("é encerrada quando a leitura funciona e não há sessão guardada", async () => {
      const r = await estadoDaSessao(
        clienteQue({ data: { session: null }, error: null }),
      );
      expect(r.estado).toBe(SESSAO_ENCERRADA);
    });

    /*
    O caso que motivou tudo: a renovação do token falhou porque a rede caiu. A
    sessão continua válida — só não deu para confirmar agora.
  */
    it("é indeterminada quando a rede falha, nunca encerrada", async () => {
      const r = await estadoDaSessao(
        clienteQue({
          data: { session: null },
          error: new AuthRetryableFetchError("Failed to fetch", 0),
        }),
      );
      expect(r.estado).toBe(SESSAO_INDETERMINADA);
    });

    it("é indeterminada quando getSession lança por rede", async () => {
      const r = await estadoDaSessao(
        clienteQue(new TypeError("Failed to fetch")),
      );
      expect(r.estado).toBe(SESSAO_INDETERMINADA);
    });

    it("é indeterminada, e não encerrada, sem cliente algum", async () => {
      expect((await estadoDaSessao(null)).estado).toBe(SESSAO_INDETERMINADA);
    });
  });

  describe("exigirSessao", () => {
    it("devolve a sessão quando ativa", async () => {
      const s = await exigirSessao(
        clienteQue({ data: sessaoValida, error: null }),
      );
      expect(s.access_token).toBe("abc");
    });

    it("lança SessaoEncerrada só com prova", async () => {
      await expect(
        exigirSessao(clienteQue({ data: { session: null }, error: null })),
      ).rejects.toBeInstanceOf(SessaoEncerrada);
    });

    it("lança FalhaDeConexao — não SessaoEncerrada — quando a rede cai", async () => {
      const erro = await exigirSessao(
        clienteQue({
          data: null,
          error: new AuthRetryableFetchError("Failed to fetch", 0),
        }),
      ).catch((e) => e);
      expect(erro).toBeInstanceOf(FalhaDeConexao);
      expect(erro.sessaoEncerrada).toBeUndefined();
      expect(erro.message).not.toContain("Sessão expirada");
    });
  });
});

bloco("situacao-dos-modulos", () => {
  /*
  Módulos e abas: o sistema, cada área, cada aba (em todas as áreas ou só
  numa) podem estar desativados ou em manutenção. A situação efetiva de uma
  página segue sistema > área > aba > aba na área, e falha de rede vale como
  tudo ativo — ninguém fica trancado por erro de conexão.
*/

  const RESPOSTA = (mudancas = {}) => ({
    admin_global: false,
    sistema: {
      situacao: "ATIVA",
      mensagem: null,
      previsao: null,
      atualizado_em: "2026-09-30T12:00:00Z",
    },
    areas: [
      {
        co_area: "saude-indigena",
        ativo: true,
        situacao: "ATIVA",
        mensagem: null,
        previsao: null,
      },
      {
        co_area: "sede",
        ativo: true,
        situacao: "MANUTENCAO",
        mensagem: "SEDE em ajuste",
        previsao: "2026-10-05",
      },
      {
        co_area: "projetos",
        ativo: false,
        situacao: "ATIVA",
        mensagem: null,
        previsao: null,
      },
    ],
    ...mudancas,
  });

  /* Linhas de listar_abas_do_menu como o banco manda depois da migration. */
  const linha = (
    co_aba,
    co_view,
    extras = {},
    areas = ["saude-indigena", "sede"],
  ) => ({
    co_aba,
    no_aba: co_aba,
    ds_icone: "file-text",
    nu_ordem: 1,
    co_view,
    co_recurso: co_view,
    tp_aba: "nativa",
    st_beta: false,
    tp_situacao: "ATIVA",
    ds_mensagem: null,
    dt_previsao: null,
    areas: areas.map((co_area) => ({
      co_area,
      nu_ordem: 1,
      co_view,
      ds_icone: "file-text",
      tp_situacao: "ATIVA",
      ds_mensagem: null,
      dt_previsao: null,
    })),
    ...extras,
  });

  describe("situação do sistema (obter_situacao_do_sistema)", () => {
    it("normaliza sistema e áreas", () => {
      const situacao = normalizarSituacaoDoSistema(RESPOSTA());
      expect(situacao.carregada).toBe(true);
      expect(situacao.sistema).toBeNull();
      expect(situacao.areas.map((a) => [a.id, a.ativo])).toEqual([
        ["saude-indigena", true],
        ["sede", true],
        ["projetos", false],
      ]);
      expect(situacao.areas[1].manutencao).toEqual({
        mensagem: "SEDE em ajuste",
        previsao: "2026-10-05",
      });
    });

    it("resposta estranha vale como tudo ativo", () => {
      for (const dados of [null, undefined, "x", [], 3]) {
        expect(normalizarSituacaoDoSistema(dados)).toBe(SITUACAO_PADRAO);
      }
      expect(areaEstaAtiva(SITUACAO_PADRAO, "projetos")).toBe(true);
    });

    it("tira as áreas desativadas", () => {
      const situacao = normalizarSituacaoDoSistema(RESPOSTA());
      expect(
        filtrarAreasAtivas(["saude-indigena", "sede", "projetos"], situacao),
      ).toEqual(["saude-indigena", "sede"]);
    });

    it("formata a previsão em dd/mm/aaaa", () => {
      expect(formatarPrevisao("2026-10-05")).toBe("05/10/2026");
      expect(formatarPrevisao("2026-10-05T00:00:00")).toBe("05/10/2026");
      expect(formatarPrevisao(null)).toBe("");
      expect(formatarPrevisao("amanhã")).toBe("");
    });
  });

  describe("situação efetiva de uma página", () => {
    const abas = abasDoCatalogo([
      linha("editais", "nucleo"),
      linha("cronograma", "calendario", {
        tp_situacao: "MANUTENCAO",
        ds_mensagem: "Cronograma novo",
        dt_previsao: "2026-10-01",
      }),
      linha("aprovados", "approved", {
        areas: [
          {
            co_area: "saude-indigena",
            nu_ordem: 4,
            co_view: "approved",
            tp_situacao: "MANUTENCAO",
            ds_mensagem: "Só na Saúde Indígena",
            dt_previsao: null,
          },
          {
            co_area: "sede",
            nu_ordem: 4,
            co_view: "approved",
            tp_situacao: "ATIVA",
          },
        ],
      }),
    ]);
    const ativa = normalizarSituacaoDoSistema(RESPOSTA({ areas: [] }));

    it("tudo ativo: nenhuma manutenção", () => {
      expect(
        situacaoEfetiva({
          situacao: ativa,
          abas,
          view: "nucleo",
          area: "sede",
        }),
      ).toBeNull();
      expect(
        situacaoEfetiva({ abas, view: "nucleo", area: "sede" }),
      ).toBeNull();
    });

    it("aba em manutenção em todas as áreas", () => {
      expect(
        situacaoEfetiva({
          situacao: ativa,
          abas,
          view: "calendario",
          area: "saude-indigena",
        }),
      ).toEqual({
        origem: "aba",
        mensagem: "Cronograma novo",
        previsao: "2026-10-01",
      });
    });

    it("aba em manutenção só numa área", () => {
      const naSaude = situacaoEfetiva({
        situacao: ativa,
        abas,
        view: "approved",
        area: "saude-indigena",
      });
      expect(naSaude.origem).toBe("aba_area");
      expect(
        situacaoEfetiva({
          situacao: ativa,
          abas,
          view: "approved",
          area: "sede",
        }),
      ).toBeNull();
    });

    it("área em manutenção vale antes da aba; sistema vale antes de tudo", () => {
      const comArea = normalizarSituacaoDoSistema(RESPOSTA());
      expect(
        situacaoEfetiva({
          situacao: comArea,
          abas,
          view: "calendario",
          area: "sede",
        }),
      ).toMatchObject({ origem: "area", mensagem: "SEDE em ajuste" });

      const comSistema = normalizarSituacaoDoSistema(
        RESPOSTA({
          sistema: {
            situacao: "MANUTENCAO",
            mensagem: "Tudo parado",
            previsao: null,
          },
        }),
      );
      for (const view of ["calendario", "config", "panel:x", "nucleo"]) {
        expect(
          situacaoEfetiva({ situacao: comSistema, abas, view, area: "sede" }),
        ).toMatchObject({ origem: "sistema", mensagem: "Tudo parado" });
      }
    });

    it("Configurações e painéis não são abas: só o sistema os alcança", () => {
      const comArea = normalizarSituacaoDoSistema(RESPOSTA());
      expect(
        situacaoEfetiva({
          situacao: comArea,
          abas,
          view: "config",
          area: "sede",
        }),
      ).toBeNull();
      expect(abaDaPagina(abas, "panel:x", "sede")).toBeNull();
    });

    it("textos da tela e da faixa", () => {
      expect(
        textosDaManutencao({ origem: "aba", mensagem: "", previsao: null }),
      ).toEqual({
        titulo: "Em manutenção",
        mensagem: MENSAGEM_PADRAO_DE_MANUTENCAO,
        previsao: "",
      });
      expect(
        textosDaManutencao({
          origem: "aba",
          mensagem: "Oi",
          previsao: "2026-10-05",
        }).previsao,
      ).toBe("Previsão de volta: 05/10/2026");
      expect(textoDaFaixaDoAdministrador({ origem: "aba" })).toBe(
        "Em manutenção para os demais usuários.",
      );
      expect(textoDaFaixaDoAdministrador({ origem: "sistema" })).toContain(
        "sistema inteiro",
      );
      expect(
        dicaDaManutencao({ mensagem: "Ajuste", previsao: "2026-10-05" }),
      ).toBe("Em manutenção · Ajuste · Previsão de volta: 05/10/2026");
    });
  });

  describe("menu: selo BETA e manutenção vêm do banco", () => {
    it("st_beta do banco vale sobre o do código", () => {
      const abas = abasDoCatalogo([
        linha("editais", "nucleo", { st_beta: true }),
        linha("analisar-recursos", "analisar-recursos", { st_beta: false }),
      ]);
      expect(abas.find((a) => a.id === "editais").beta).toBe(true);
      expect(
        abas.find((a) => a.id === "analisar-recursos").beta,
      ).toBeUndefined();
      // Sem catálogo, o código continua valendo (Analisar recursos é beta ali).
      expect(ABAS_DO_MENU.find((a) => a.id === "analisar-recursos").beta).toBe(
        true,
      );
    });

    it("aba ativa não ganha o campo manutencao; em manutenção, ganha", () => {
      const abas = abasDoCatalogo([
        linha("editais", "nucleo"),
        linha("cronograma", "calendario", { tp_situacao: "MANUTENCAO" }),
      ]);
      const paginas = paginasDaArea(abas, "sede");
      expect(Object.hasOwn(paginas[0], "manutencao")).toBe(false);
      expect(paginas[1].manutencao).toEqual({ mensagem: "", previsao: null });
    });

    it("área desativada sai do menu; área em manutenção leva o aviso", () => {
      const situacao = normalizarSituacaoDoSistema(RESPOSTA());
      const arvore = montarArvoreDoMenu({
        permitidas: { nucleo: true },
        areas: ["saude-indigena", "sede", "projetos"],
        situacao,
      });
      expect(arvore.map((g) => g.id)).toEqual(["saude-indigena", "sede"]);
      expect(arvore[1].manutencao.mensagem).toBe("SEDE em ajuste");
      expect(Object.hasOwn(arvore[0], "manutencao")).toBe(false);
    });

    it("sem situação (RPC falhou), o menu é o de sempre", () => {
      const arvore = montarArvoreDoMenu({
        permitidas: { nucleo: true },
        areas: ["saude-indigena", "sede", "projetos"],
      });
      expect(arvore.map((g) => g.id)).toEqual([
        "saude-indigena",
        "sede",
        "projetos",
      ]);
    });
  });

  describe("seção Módulos e abas", () => {
    it("só o administrador global vê", () => {
      expect(
        secaoDeConfiguracaoPermitida(
          { admin_global: true, permissoes: {} },
          "modulos",
        ),
      ).toBe(true);
      expect(
        secaoDeConfiguracaoPermitida(
          {
            admin_global: false,
            permissoes: { configuracoes: "admin", acessos: "admin" },
          },
          "modulos",
        ),
      ).toBe(false);
    });
  });

  describe("tela de manutenção e faixa do administrador", () => {
    const abas = abasDoCatalogo([
      linha("editais", "nucleo", {
        tp_situacao: "MANUTENCAO",
        ds_mensagem: "Editais em ajuste",
        dt_previsao: "2026-10-05",
      }),
      linha("cronograma", "calendario"),
    ]);

    beforeEach(async () => {
      await carregarSituacaoDoSistema({
        consulta: Promise.resolve({
          data: RESPOSTA({ areas: [] }),
          error: null,
        }),
      });
    });
    afterEach(() => {
      esquecerSituacaoDoSistema();
    });
    // A decisão é pura (src/lib/navegacao/pagina-desligada.ts); quem desenha é a rota (tests/casca-sessao-e-interface-na-tela.test.ts (bloco app/pagina-desligada)).
    const decidir = (opcoes) =>
      avisoDaPagina({
        situacao: situacaoDoSistema(),
        abas,
        area: "sede",
        ...opcoes,
      });

    it("quem não é admin vê o aviso de manutenção com mensagem e previsão", () => {
      const { pagina, faixa } = decidir({ view: "nucleo", adminGlobal: false });
      expect(pagina).toMatchObject({
        origem: "aba",
        icone: "wrench",
        titulo: "Em manutenção",
        mensagem: "Editais em ajuste",
        previsao: "Previsão de volta: 05/10/2026",
      });
      expect(faixa).toBeNull();
    });

    it("o admin global vê a página, com a faixa âmbar", () => {
      const { pagina, faixa } = decidir({ view: "nucleo", adminGlobal: true });
      expect(pagina).toBeNull();
      expect(faixa.texto).toContain("Em manutenção para os demais usuários");
      // Outra página, sem manutenção: sem faixa.
      expect(decidir({ view: "calendario", adminGlobal: true })).toEqual({
        pagina: null,
        faixa: null,
      });
    });

    it("página desligada pela coordenação: o aviso, para todos", () => {
      const { pagina } = decidir({
        view: "calendario",
        adminGlobal: true,
        desligada: true,
      });
      expect(pagina).toMatchObject({
        origem: "desligada",
        icone: "circle-alert",
        titulo: "Página desativada",
        mensagem: "Esta página foi desativada pela coordenação.",
      });
    });

    it("sistema em manutenção fecha até Configurações para quem não é admin", async () => {
      await carregarSituacaoDoSistema({
        consulta: Promise.resolve({
          data: RESPOSTA({
            areas: [],
            sistema: {
              situacao: "MANUTENCAO",
              mensagem: "Volta já",
              previsao: null,
            },
          }),
          error: null,
        }),
      });
      expect(decidir({ view: "config", area: "" }).pagina.mensagem).toBe(
        "Volta já",
      );
    });

    it("falha na consulta vale como tudo ativo", async () => {
      const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
      await carregarSituacaoDoSistema({
        consulta: Promise.resolve({
          data: null,
          error: { message: "Failed to fetch" },
        }),
      });
      expect(situacaoDoSistema()).toBe(SITUACAO_PADRAO);
      await carregarSituacaoDoSistema({
        consulta: Promise.reject(new Error("x")),
      });
      expect(situacaoDoSistema()).toBe(SITUACAO_PADRAO);
      aviso.mockRestore();
      // Mesmo assim a manutenção da aba (do catálogo) continua valendo.
      expect(decidir({ view: "calendario" }).pagina).toBeNull();
      expect(decidir({ view: "nucleo" }).pagina?.mensagem).toBe(
        "Editais em ajuste",
      );
    });

    it("a consulta nunca rejeita", async () => {
      const sb = { rpc: vi.fn(() => Promise.reject(new Error("rede"))) };
      const resposta = await consultaDaSituacaoDoSistema(sb);
      expect(resposta.data).toBeNull();
      expect(sb.rpc).toHaveBeenCalledWith("obter_situacao_do_sistema");
      expect(await consultaDaSituacaoDoSistema(null)).toEqual({
        data: null,
        error: null,
      });
    });
  });
});

bloco("supabase-cliente-unico", () => {
  function arquivosJs(raiz) {
    const achados = [];
    for (const nome of readdirSync(raiz)) {
      const caminho = join(raiz, nome);
      if (statSync(caminho).isDirectory()) achados.push(...arquivosJs(caminho));
      else if (/.(js|jsx|ts|tsx)$/.test(nome)) achados.push(caminho);
    }
    return achados;
  }

  /*
  A regra que este arquivo protege: existe **um** cliente Supabase de verdade em
  todo o frontend, criado em `src/lib/sessao/supabaseClient.ts`; tudo mais o pede por
  `getSupabaseClient()` (não há mais `window.supabase`).

  Dois clientes reais na mesma página significam dois `GoTrueClient` disputando a
  mesma chave de armazenamento, dois relógios de renovação de token e dois
  verificadores PKCE. Foi assim que nasceu boa parte da falsa "Sessão expirada".

  Estes testes falham se alguém "consertar" um problema criando outro cliente.
*/
  describe("um único cliente Supabase", () => {
    it("só `lib/sessao/supabaseClient.ts` importa createClient da biblioteca", () => {
      const culpados = arquivosJs("src").filter((caminho) => {
        const fonte = readFileSync(caminho, "utf8");
        return /import\s*\{[^}]*\bcreateClient\b[^}]*\}\s*from\s*["']@supabase\/supabase-js["']/.test(
          fonte,
        );
      });
      expect(culpados).toEqual([
        join("src", "lib", "sessao", "supabaseClient.ts"),
      ]);
    });

    it("nenhum módulo importa o pacote direto para montar cliente próprio", () => {
      const culpados = arquivosJs("src").filter((caminho) => {
        if (caminho.endsWith(join("lib", "sessao", "supabaseClient.ts")))
          return false;
        const fonte = readFileSync(caminho, "utf8");
        return (
          /from\s*["']@supabase\/supabase-js["']/.test(fonte) &&
          /createClient\s*\(/.test(fonte)
        );
      });
      expect(culpados).toEqual([]);
    });

    it("a chave de armazenamento é declarada uma única vez", () => {
      const declaracoes = arquivosJs("src").filter((caminho) =>
        /SUPABASE_AUTH_STORAGE_KEY\s*=/.test(readFileSync(caminho, "utf8")),
      );
      expect(declaracoes).toEqual([join("src", "lib", "sessao", "env.ts")]);
    });
  });

  describe("a instância compartilhada", () => {
    beforeEach(() => {
      vi.stubEnv("VITE_SUPABASE_URL", "https://exemplo.supabase.co");
      vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "chave-de-teste");
      vi.resetModules();
    });

    afterEach(() => {
      vi.unstubAllEnvs();
      vi.resetModules();
    });

    it("devolve sempre o mesmo objeto", async () => {
      const { getSupabaseClient } =
        await import("../src/lib/sessao/supabaseClient");
      const primeiro = getSupabaseClient();
      const segundo = getSupabaseClient();
      expect(primeiro).not.toBeNull();
      expect(primeiro).toBe(segundo);
    });

    it("usa a chave de armazenamento única e o fluxo PKCE", async () => {
      const { getSupabaseClient } =
        await import("../src/lib/sessao/supabaseClient");
      const { SUPABASE_AUTH_STORAGE_KEY } =
        await import("../src/lib/sessao/env");
      const cliente = getSupabaseClient();
      expect(SUPABASE_AUTH_STORAGE_KEY).toBe("agsus-monitora-auth");
      expect(cliente.auth.storageKey).toBe(SUPABASE_AUTH_STORAGE_KEY);
      expect(cliente.auth.flowType).toBe("pkce");
    });
  });
});

bloco("teto-do-coordenador", () => {
  const coordenador = {
    perfil: "coordenador",
    admin_global: false,
    coordenacao: { codigo: "norte", nome: "Norte", area: "saude-indigena" },
    permissoes: {
      dashboard: "leitor",
      nucleo: "editor",
      aprovados: "editor",
      configuracoes: "sem_acesso",
      acessos: "editor",
    },
  };
  const admin = {
    perfil: "admin",
    admin_global: true,
    permissoes: { configuracoes: "sem_acesso" },
  };

  const tetoDoCoordenador = {
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
    paineis: ["p1"],
  };

  describe("quem gerencia acessos", () => {
    it("admin global vem do banco; sem o campo, do papel antigo", () => {
      expect(isAdminGlobal(admin)).toBe(true);
      expect(isAdminGlobal({ perfil: "admin" })).toBe(true);
      expect(isAdminGlobal({ perfil: "admin", admin_global: false })).toBe(
        false,
      );
      expect(isAdminGlobal({ ...admin, ativo: false })).toBe(false);
    });

    it("coordenador gerencia acessos, mas não move edital de área", () => {
      expect(canManageAccess(coordenador)).toBe(true);
      expect(canMoveEditalBetweenAreas(coordenador)).toBe(false);
      expect(canManageAccess({ permissoes: { configuracoes: "admin" } })).toBe(
        false,
      );
    });

    it("admin sem Configurações ainda abre a página e só a seção Acessos", () => {
      expect(podeAbrirConfiguracoes(admin)).toBe(true);
      expect(secaoDeConfiguracaoPermitida(admin, "acessos")).toBe(true);
      expect(secaoDeConfiguracaoPermitida(admin, "marca")).toBe(false);
    });

    it("editor de Configurações sem Acessos não recebe a seção Acessos vazia", () => {
      const editor = { permissoes: { configuracoes: "editor" } };
      expect(secaoDeConfiguracaoPermitida(editor, "acessos")).toBe(false);
      expect(secaoDeConfiguracaoPermitida(editor, "marca")).toBe(true);
    });

    it("coordenador abre Configurações pela gestão de acessos", () => {
      expect(paginasPermitidas(coordenador)).toMatchObject({
        config: true,
        nucleo: true,
        dashboard: true,
      });
    });
  });

  describe("abas de Acessos", () => {
    it("admin vê Usuários, Grupos e Coordenações; coordenador, só Usuários; os demais, nenhuma", () => {
      expect(abasDeAcessos(admin).map((a) => a.id)).toEqual([
        "usuarios",
        "grupos",
        "coordenacoes",
      ]);
      expect(abasDeAcessos(coordenador).map((a) => a.id)).toEqual(["usuarios"]);
      expect(abasDeAcessos({ permissoes: { nucleo: "editor" } })).toEqual([]);
    });
  });

  describe("teto do coordenador", () => {
    it("não altera a si mesmo, quem é de fora, nem admin global", () => {
      expect(
        podeEditarUsuario(tetoDoCoordenador, { id: "eu", coordenacao: "norte" })
          .pode,
      ).toBe(false);
      expect(
        podeEditarUsuario(tetoDoCoordenador, { id: "u2", coordenacao: "sul" })
          .pode,
      ).toBe(false);
      expect(
        podeEditarUsuario(tetoDoCoordenador, {
          id: "u3",
          coordenacao: "norte",
          admin_global: true,
        }).pode,
      ).toBe(false);
      expect(
        podeEditarUsuario(tetoDoCoordenador, { id: "u4", coordenacao: "norte" })
          .pode,
      ).toBe(true);
    });

    it("o select do módulo começa por 'Do grupo'; nível acima do próprio fica desabilitado", () => {
      const celula = {
        nivel: "leitor",
        individual: false,
        nivelGrupo: "leitor",
      };
      const opcoes = opcoesDoModulo(tetoDoCoordenador, "dashboard", celula);
      expect(opcoes[0]).toMatchObject({
        valor: "",
        rotulo: "Leitor",
        desabilitada: false,
      });
      expect(opcoes.filter((o) => o.desabilitada).map((o) => o.valor)).toEqual([
        "editor",
        "admin",
      ]);
      expect(valorDoSelect(celula)).toBe("");
    });

    it("o valor individual atual aparece mesmo acima do teto; voltar ao grupo exige que o grupo caiba", () => {
      const celula = { nivel: "admin", individual: true, nivelGrupo: "admin" };
      const opcoes = opcoesDoModulo(tetoDoCoordenador, "nucleo", celula);
      expect(opcoes.find((o) => o.valor === "admin").desabilitada).toBe(false);
      expect(opcoes[0].desabilitada).toBe(true);
      expect(valorDoSelect(celula)).toBe("admin");
    });

    it("Acessos e áreas são só leitura; painel só se ele tem o painel", () => {
      expect(celulaSoLeitura(tetoDoCoordenador, "acessos")).toBe(true);
      expect(celulaSoLeitura(tetoDoCoordenador, "area:sede")).toBe(true);
      expect(nivelMaximo(tetoDoCoordenador, "painel:p1")).toBe("leitor");
      expect(nivelMaximo(tetoDoCoordenador, "painel:p2")).toBe("sem_acesso");
    });

    it("atribui só grupos que cabem no teto e não dão Acessos", () => {
      const grupos = [
        {
          codigo: "usuario",
          niveis: {
            dashboard: "leitor",
            nucleo: "leitor",
            acessos: "sem_acesso",
          },
        },
        {
          codigo: "coordenador",
          niveis: { nucleo: "editor", acessos: "editor" },
        },
        {
          codigo: "gestor",
          niveis: { nucleo: "admin", acessos: "sem_acesso" },
        },
        { codigo: "admin", admin_global: true, niveis: {} },
      ];
      expect(
        gruposAtribuiveis(tetoDoCoordenador, grupos).map((g) => g.codigo),
      ).toEqual(["usuario"]);
      expect(gruposAtribuiveis({ admin_global: true }, grupos)).toHaveLength(4);
    });
  });
});

bloco("ver-como-usuario", () => {
  const SECOES = [
    { id: "marca", rotulo: "Marca" },
    { id: "acessos", rotulo: "Acessos" },
  ];
  const paineis = [
    { id: "p1", codigo: "painel-a", titulo: "Painel A", ordem: 1 },
  ];

  const contexto = {
    profile: {
      id: "u1",
      perfil: "coordenador",
      admin_global: false,
      areas: ["saude-indigena"],
      coordenacao: { codigo: "norte", nome: "Norte", area: "saude-indigena" },
      permissoes: {
        dashboard: "leitor",
        nucleo: "editor",
        calendario: "leitor",
        paineis: "leitor",
        acessos: "editor",
      },
    },
    panel_ids: ["p1"],
    escopo: { editais_da_area: 40, editais_visiveis: 12, recortado: true },
  };

  describe("ver como usuário", () => {
    it("o menu é o mesmo que a barra lateral montaria para a pessoa", () => {
      const perfil = { ...contexto.profile, ativo: true };
      const esperado = montarArvoreDoMenu({
        permitidas: paginasPermitidas(perfil),
        paineis: paineisPermitidos(perfil, paineis, ["p1"]),
        secoesDeConfiguracao: SECOES.filter((s) =>
          secaoDeConfiguracaoPermitida(perfil, s.id),
        ),
        areas: areasDoUsuario(perfil.areas),
      });
      const menu = menuDoContexto(contexto, {
        paineis,
        secoesDeConfiguracao: SECOES,
      });
      expect(menu).toEqual(esperado);
      const secoes = menu
        .flatMap((g) => g.itens)
        .filter((i) => i.view === "config")
        .map((i) => i.secao);
      expect(secoes).toEqual(["acessos"]);
    });

    it("escopo e capacidades em frases", () => {
      expect(resumoDoEscopo(contexto)).toBe(
        "Coordenação Norte — vê 12 de 40 editais da área.",
      );
      expect(capacidadesDoPerfil(contexto.profile)).toContain(
        "Gerencia acessos",
      );
      expect(
        resumoDoEscopo({ profile: { id: "a", admin_global: true } }),
      ).toMatch(/todas as áreas/);
    });
  });

  /*
  "Como a pessoa vê" na gaveta reflete o RASCUNHO ("Depois de salvar"): em
  30/09 a gaveta dizia "Administrador global" com o grupo já trocado para
  Usuário no rascunho.
*/
  describe("como a pessoa vê depois de salvar", () => {
    const GRUPOS = [
      {
        codigo: "usuario",
        nome: "Usuário",
        niveis: {
          dashboard: "leitor",
          nucleo: "leitor",
          acessos: "sem_acesso",
        },
      },
      {
        codigo: "admin",
        nome: "Administrador global",
        admin_global: true,
        niveis: {},
      },
    ];
    const AREAS = [
      { id: "saude-indigena", titulo: "Saúde Indígena" },
      { id: "sede", titulo: "SEDE" },
    ];
    const ADMIN = {
      id: "u9",
      nome: "Bia",
      email: "bia@agenciasus.org.br",
      grupo: "admin",
      admin_global: true,
      coordenacao: null,
      revisao_conta: "t9",
      permissoes: {},
    };
    const salvo = {
      profile: {
        id: "u9",
        perfil: "admin",
        admin_global: true,
        areas: ["saude-indigena", "sede"],
        permissoes: { dashboard: "admin", nucleo: "admin", acessos: "editor" },
      },
      panel_ids: [],
      escopo: { editais_da_area: 10, editais_visiveis: 10 },
    };
    const matriz = {
      grupos: GRUPOS,
      areas: AREAS,
      coordenacoes: [],
      paineis: [],
    };

    it("sem pendência, é o contexto salvo", () => {
      expect(contextoDepoisDeSalvar(salvo, ADMIN, new Map(), matriz)).toBe(
        salvo,
      );
    });

    it("admin que vai para Usuário com uma área: deixa de ser admin e perde a gestão", () => {
      let rascunho = registrarNoRascunho(new Map(), ADMIN, "#grupo", "usuario");
      rascunho = registrarNoRascunho(rascunho, ADMIN, "area:sede", "leitor");
      const depois = contextoDepoisDeSalvar(salvo, ADMIN, rascunho, matriz);
      expect(depois.profile).toMatchObject({
        perfil: "usuario",
        admin_global: false,
        areas: ["sede"],
        coordenacao: null,
        grupo: { codigo: "usuario", nome: "Usuário" },
      });
      expect(depois.profile.permissoes).toMatchObject({
        dashboard: "leitor",
        nucleo: "leitor",
        acessos: "sem_acesso",
      });
      expect(
        resumoDoEscopo(depois, new Map(AREAS.map((a) => [a.id, a.titulo]))),
      ).toBe("Áreas: SEDE.");
      expect(capacidadesDoPerfil(depois.profile)).not.toContain(
        "Gerencia acessos",
      );
      // O salvo não muda.
      expect(salvo.profile.admin_global).toBe(true);
    });
  });
});
