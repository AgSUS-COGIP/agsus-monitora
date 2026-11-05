import {
  Suspense,
  lazy,
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { ComponentType, LazyExoticComponent } from "react";
import { ErrorBoundary } from "./ErrorBoundary.tsx";
import { avisar, mostrarCarregamento } from "./avisos.ts";
import { chamarAcaoDaCasca } from "./casca/acoes.ts";
import {
  usarAviso,
  usarEstadoDaNavegacao,
  usarNavegacao,
} from "./contexto-do-app.ts";
import {
  assinarTelas,
  ehSecaoComTela,
  ehTelaRegistrada,
  registrarTelas,
  telaCriada,
  telaNaHora,
  telaPronta,
  carregarTela,
  versaoDasTelas,
  viewDaSecao,
} from "./registro-das-telas.ts";
import type {
  ControladorDeTela,
  SecaoComTela,
  ViewDeTela,
} from "./registro-das-telas.ts";
import type { EstadoDaNavegacao, LeituraDaNavegacao } from "./navegacao.ts";
import { erroAmigavel } from "../lib/erro-amigavel";
import { ehPainelExterno } from "../lib/navegacao";
import { situacaoDoSistema } from "../modules/situacao-dos-modulos.ts";
import { criarVisaoGeral } from "../modulos/visao-geral/visao-geral.tsx";
import { criarNucleo } from "../modulos/editais/nucleo.tsx";
import { SECOES } from "../modulos/configuracoes/secoes.ts";
import { ContextoDaPaginaDeConfiguracoes } from "../modulos/configuracoes/pagina.ts";

/*
  As telas do app como rotas: a navegação (src/app/navegacao.ts) diz qual
  está aberta, pelo endereço, e aqui ela aparece. Cada tela de página
  inteira tem a sua `<section class="page" id="page-<view>">` (os ids de
  sempre: CSS, tours da Aya e testes os usam); só a aberta tem `.active`.

  - A tela visitada continua montada, escondida: filtros, aba e rolagem
    ficam como a pessoa deixou (era assim com as ilhas).
  - Visão geral e Editais vêm no pacote principal; as outras baixam na
    primeira abertura (`React.lazy` sobre `carregarTela`, que recarrega a
    página uma vez se a versão publicada mudou). Enquanto baixa,
    "Carregando…"; se falhar, o aviso com "Tentar de novo" (refaz o `lazy`).
  - Cada tela tem o seu ErrorBoundary: erro de desenho numa não derruba o
    resto.
  - A cada abertura (`abertura` da navegação) a tela recebe `render()` — o
    mesmo contrato de antes —, e, vindos do endereço, a visão e o edital.
*/

/** Os ids das seções, na ordem de sempre (a Visão geral primeiro). */
export const TELAS_DA_CASCA: readonly ViewDeTela[] = Object.freeze([
  // src/modulos/visao-geral/ (mapas da Saúde Indígena e de Projetos).
  "dashboard",
  // src/modulos/editais/nucleo.tsx (modal do edital e linha do tempo em portal).
  "nucleo",
  // src/modulos/cronograma/ (o popup do dia é portal no fim do body).
  "calendario",
  // src/modulos/aprovados/ (os modais são portais no fim do body).
  "approved",
  // src/modulos/recursos/ — Painel de recursos e Analisar recursos.
  "recursos",
  "analisar-recursos",
  // src/modulos/entrevistas/ — Painel de entrevistas e Conduzir entrevistas.
  "entrevistas",
  "conduzir-entrevistas",
  // src/modulos/analises/.
  "analises",
  // src/modulos/avaliacao-documental/ — Avaliação documental e Triagem.
  "avaliacao-documental",
  "pre-classificacao",
  // src/modulos/classificacao/.
  "classificacao",
  // src/modulos/selecao/.
  "selecao",
]);

const TEXTO_SEM_ACESSO =
  "Seu usuário ainda não tem módulos liberados. Solicite a liberação a um administrador.";
const TEXTO_FALHA_NA_CARGA =
  "Não foi possível carregar esta tela. Confira a conexão e tente de novo.";

const comemoracoesLigadas = () => situacaoDoSistema().comemoracoes === true;
const perfilDoApp = () => window.getMonitoraProfile?.() ?? null;

/**
 * Registra as telas (src/app/raiz.tsx, uma vez). `navegacao` responde se a
 * tela está aberta (Análises só relê a área com a página à vista; Status das
 * atualizações, com a seção à vista). `aoSalvarModulos`: Módulos e abas
 * salvou (os painéis externos do menu releem).
 */
export function registrarTelasDoApp({
  navegacao,
  aoSalvarModulos,
}: {
  navegacao: Pick<LeituraDaNavegacao, "obter">;
  aoSalvarModulos?: (() => unknown) | undefined;
}) {
  const aberta = (view: string) => () => {
    const { view: atual, aviso } = navegacao.obter();
    return atual === view && !aviso;
  };
  const secaoAberta = (secao: string) => () => {
    const { view: atual, aviso, secao: aberta } = navegacao.obter();
    return atual === "config" && !aviso && aberta === secao;
  };
  registrarTelas({
    dashboard: {
      criar: () => criarVisaoGeral({ toast: avisar, comemoracoesLigadas }),
    },
    nucleo: {
      criar: () =>
        criarNucleo({
          toast: avisar,
          loader: mostrarCarregamento,
          getProfile: perfilDoApp,
        }),
    },
    // Sem loader de tela cheia: skeleton na carga, e cada ação mostra o estado no botão.
    approved: {
      carregar: () =>
        import("../modulos/aprovados/lista-aprovados.tsx").then((m) =>
          m.criarListaAprovados({ toast: avisar, getProfile: perfilDoApp }),
        ),
    },
    // Sem loader de tela cheia: a grade mostra "Carregando…" por conta própria.
    calendario: {
      carregar: () =>
        import("../modulos/cronograma/calendario-editais.tsx").then((m) =>
          m.criarCalendarioEditais({ toast: avisar }),
        ),
    },
    /*
      Recursos, em duas entradas do menu: o Painel (acompanhar) e Analisar
      recursos (fazer), cada um com o próprio estado. `render()` recarrega a
      cada abertura: o que se decide em Analisar aparece no painel ao voltar.
    */
    recursos: {
      carregar: () =>
        import("../modulos/recursos/recursos.tsx").then((m) =>
          m.criarRecursos({ toast: avisar, comemoracoesLigadas }),
        ),
    },
    "analisar-recursos": {
      carregar: () =>
        import("../modulos/recursos/recursos.tsx").then((m) =>
          m.criarAnaliseDeRecursos({ toast: avisar, comemoracoesLigadas }),
        ),
    },
    /*
      Entrevistas, também em duas: o Painel e Conduzir. Gravar notas ou
      convocar em Conduzir relê o painel (se já aberto); as entrevistas do
      painel, quando lidas, marcam "com entrevistas" na lista de Conduzir.
    */
    entrevistas: {
      carregar: () =>
        import("../modulos/entrevistas/entrevistas.tsx").then((m) =>
          m.criarEntrevistas({ toast: avisar, comemoracoesLigadas }),
        ),
    },
    "conduzir-entrevistas": {
      carregar: () =>
        import("../modulos/entrevistas/conduzir.tsx").then((m) =>
          m.criarConducaoDeEntrevistas({
            toast: avisar,
            comemoracoesLigadas,
            aoMudarResultados: () => {
              const painel = telaPronta("entrevistas")?.estado;
              if (painel?.obter().area) void painel.carregar();
            },
            doPainel: () =>
              telaPronta("entrevistas")?.estado.obter().dados?.entrevistas ||
              [],
          }),
        ),
    },
    analises: {
      carregar: () =>
        import("../modulos/analises/analises.tsx").then((m) =>
          m.criarAnalises({
            toast: avisar,
            comemoracoesLigadas,
            visivel: aberta("analises"),
          }),
        ),
    },
    selecao: {
      carregar: () =>
        import("../modulos/selecao/selecao.tsx").then((m) =>
          m.criarSelecao({ toast: avisar }),
        ),
    },
    classificacao: {
      carregar: () =>
        import("../modulos/classificacao/classificacao.tsx").then((m) =>
          m.criarClassificacao({ toast: avisar }),
        ),
    },
    "avaliacao-documental": {
      carregar: () =>
        import("../modulos/avaliacao-documental/avaliacao-documental.tsx").then(
          (m) =>
            m.criarAvaliacaoDocumental({
              toast: avisar,
              getProfile: perfilDoApp,
            }),
        ),
    },
    // Triagem: página própria, sob o mesmo recurso da Avaliação documental.
    "pre-classificacao": {
      carregar: () =>
        import("../modulos/avaliacao-documental/entrada-da-pre-classificacao.tsx").then(
          (m) => m.criarPreClassificacao({ toast: avisar }),
        ),
    },
    /*
      Configurações (/administracao/configuracoes/<seção>): a moldura baixa
      na primeira abertura (só quem administra abre); as quatro seções com
      tela própria, na primeira abertura de cada uma (ou com o mouse no item
      do menu).
    */
    config: {
      carregar: () =>
        import("../modulos/configuracoes/configuracoes.tsx").then((m) =>
          m.criarConfiguracoes(),
        ),
    },
    "secao:acessos": {
      carregar: () =>
        import("../modulos/acessos/acessos.tsx").then((m) =>
          m.criarAcessos({
            toast: avisar,
            getProfile: perfilDoApp,
            secoesDeConfiguracao: SECOES,
          }),
        ),
    },
    "secao:modulos": {
      carregar: () =>
        import("../modulos/modulos/modulos.tsx").then((m) =>
          m.criarModulos({
            toast: avisar,
            getProfile: perfilDoApp,
            ...(aoSalvarModulos ? { aoSalvar: aoSalvarModulos } : {}),
          }),
        ),
    },
    // Relê a cada abertura da seção, e sozinho só com ela à vista.
    "secao:cargas": {
      carregar: () =>
        import("../componentes/saude-das-cargas/saude-das-cargas.tsx").then(
          (m) =>
            m.criarSaudeDasCargas({
              getProfile: perfilDoApp,
              naTela: secaoAberta("cargas"),
            }),
        ),
    },
    "secao:automacao": {
      carregar: () =>
        import("../modulos/automacao/automacao.tsx").then((m) =>
          m.criarAutomacao({ toast: avisar, getProfile: perfilDoApp }),
        ),
    },
  });
}

// ── Abertura ──────────────────────────────────────────────────────────────

/*
  A tela abriu (uma `abertura` nova da navegação, com ela à vista): a visão,
  o `render()` (a falha vira aviso, sem rejeição solta) e o edital, depois
  da carga. O edital e a visão do endereço valem uma vez.
*/
function abrirNaTela(
  controlador: ControladorDeTela,
  { visao, edital, titulo }: EstadoDaNavegacao,
  navegacao: LeituraDaNavegacao,
  avisarFalha: (texto: string, tom?: string) => void,
) {
  if (visao) controlador.abrirVisao?.(visao);
  // O render() roda já (como antes); a promessa dele, quando houver, é esperada.
  let aberta: unknown;
  try {
    aberta = controlador.render();
  } catch (erro) {
    aberta = Promise.reject(erro);
  }
  void Promise.resolve(aberta)
    .catch((erro: unknown) => {
      console.error(`Falha ao abrir ${titulo}:`, erro);
      avisarFalha(
        `Não foi possível abrir ${titulo}: ${erroAmigavel(erro)}`,
        "error",
      );
    })
    .then(() => (edital ? controlador.abrirEdital?.(edital) : undefined))
    .catch(() => {});
  if (visao || edital) navegacao.esquecerEditalEVisao();
}

/*
  Uma tela abre com a `abertura` da navegação estando à vista; uma seção de
  Configurações (`secao`), com a `aberturaDaSecao` estando ela aberta.
*/
function aberturaAtendivel(
  estado: EstadoDaNavegacao,
  view: string,
  secao: string | undefined,
): number {
  if (estado.aviso) return 0;
  if (secao)
    return estado.view === "config" && estado.secao === secao
      ? estado.aberturaDaSecao
      : 0;
  return estado.view === view ? estado.abertura : 0;
}

function usarAberturaDaTela(
  view: string,
  controlador: ControladorDeTela,
  secao?: string,
) {
  const navegacao = usarNavegacao();
  const avisarFalha = usarAviso();
  const estado = usarEstadoDaNavegacao();
  // A última abertura atendida: o StrictMode e as releituras não repetem o render().
  const atendida = useRef(0);
  useEffect(() => {
    const abertura = aberturaAtendivel(estado, view, secao);
    if (!abertura || abertura === atendida.current) return;
    atendida.current = abertura;
    abrirNaTela(controlador, estado, navegacao, avisarFalha);
  }, [estado, view, secao, controlador, navegacao, avisarFalha]);
}

/** A tela pronta: abre a cada abertura e desenha no próprio ErrorBoundary. */
function TelaAberta({
  view,
  controlador,
  secao,
}: {
  view: string;
  controlador: ControladorDeTela;
  /** A seção de Configurações que esta tela é (abre com a seção). */
  secao?: string | undefined;
}) {
  usarAberturaDaTela(view, controlador, secao);
  return (
    <ErrorBoundary nome={controlador.nome}>
      {controlador.conteudo}
    </ErrorBoundary>
  );
}

// ── Telas sob demanda ─────────────────────────────────────────────────────

const preguicosas = new Map<string, LazyExoticComponent<ComponentType>>();

/* O `lazy` da tela: um por tentativa (o React guarda a falha do anterior). */
function telaPreguicosa(view: ViewDeTela, secao?: string) {
  let tela = preguicosas.get(view);
  if (!tela) {
    tela = lazy(() =>
      carregarTela(view).then((controlador: ControladorDeTela) => ({
        default: function TelaCarregada() {
          return (
            <TelaAberta view={view} controlador={controlador} secao={secao} />
          );
        },
      })),
    );
    preguicosas.set(view, tela);
  }
  return tela;
}

function Carregando() {
  return (
    <div className="ui-vazio" data-tela-sob-demanda="carregando" role="status">
      Carregando…
    </div>
  );
}

function TelaSobDemanda({
  view,
  secao,
}: {
  view: ViewDeTela;
  secao?: string | undefined;
}) {
  const [tentativa, definirTentativa] = useState(0);
  const Tela = telaPreguicosa(view, secao);
  return (
    <ErrorBoundary
      key={tentativa}
      nome={`a carga da tela ${view}`}
      mensagem={TEXTO_FALHA_NA_CARGA}
      aoTentarDeNovo={() => {
        preguicosas.delete(view);
        definirTentativa((atual) => atual + 1);
      }}
    >
      <Suspense fallback={<Carregando />}>
        <Tela />
      </Suspense>
    </ErrorBoundary>
  );
}

function ConteudoDaTela({
  view,
  secao,
}: {
  view: ViewDeTela;
  /** A seção de Configurações que esta tela é (abre com a seção). */
  secao?: string | undefined;
}) {
  if (telaNaHora(view)) {
    const controlador = telaPronta(view);
    return controlador ? (
      <TelaAberta view={view} controlador={controlador} secao={secao} />
    ) : null;
  }
  return <TelaSobDemanda view={view} secao={secao} />;
}

// ── As áreas das telas ────────────────────────────────────────────────────

const classeDaPagina = (ativa: boolean) => (ativa ? "page active" : "page");

/*
  As telas visitadas (e as criadas por outra, como a Lista de aprovados
  aberta de Editais) ficam montadas; as do pacote principal, desde o início.
*/
function usarTelasMontadas(view: string, aviso: string) {
  const [visitadas, definirVisitadas] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  if (!aviso && ehTelaRegistrada(view) && !visitadas.has(view))
    definirVisitadas(new Set(visitadas).add(view));
  useSyncExternalStore(assinarTelas, versaoDasTelas, versaoDasTelas);
  return (tela: ViewDeTela) =>
    ehTelaRegistrada(tela) &&
    (telaNaHora(tela) || visitadas.has(tela) || telaCriada(tela));
}

/**
 * O `.content` do app: as seções das telas, o quadro dos painéis externos,
 * Configurações e o aviso de quem não tem módulo liberado.
 */
export function Telas() {
  const { view, aviso } = usarEstadoDaNavegacao();
  const montada = usarTelasMontadas(view, aviso);
  const aberta = (tela: string) => view === tela && !aviso;
  return (
    <div className="content">
      {TELAS_DA_CASCA.map((tela) => (
        <section
          key={tela}
          id={`page-${tela}`}
          className={classeDaPagina(aberta(tela))}
        >
          {montada(tela) ? <ConteudoDaTela view={tela} /> : null}
        </section>
      ))}
      <QuadroDoPainelExterno ativo={ehPainelExterno(view) && !aviso} />
      <PaginaDeConfiguracoes ativa={aberta("config")} />
      <section
        id="page-sem-acesso"
        className={classeDaPagina(aviso === "sem-acesso")}
      >
        <div className="alert warn">{TEXTO_SEM_ACESSO}</div>
      </section>
    </div>
  );
}

/*
  O quadro dos painéis externos (`src/app/paineis-externos.ts`): título,
  "Atualizar", "Abrir em nova aba" e o `#externalMount`, onde cada painel
  ganha o próprio iframe na primeira abertura.
*/
function QuadroDoPainelExterno({ ativo }: { ativo: boolean }) {
  return (
    <section id="page-external" className={classeDaPagina(ativo)}>
      <ConteudoDoQuadro />
    </section>
  );
}

/* Sem props: o título, o link e os iframes são escritos por paineis-externos.ts. */
const ConteudoDoQuadro = memo(function ConteudoDoQuadro() {
  return (
    <div className="table-card card">
      <div className="table-head">
        <h3 id="externalTitle"></h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            id="externalRefreshBtn"
            className="btn secondary"
            onClick={() => void chamarAcaoDaCasca("reloadExternal")}
          >
            <i className="fa-solid fa-rotate-right"></i>{" "}
            <span id="externalRefreshText"></span>
          </button>{" "}
          <a
            id="externalOpen"
            className="btn green"
            target="_blank"
            rel="noopener"
          ></a>
        </div>
      </div>
      <div id="externalMount" className="external-placeholder"></div>
    </div>
  );
});

/*
  Configurações (/administracao/configuracoes/<seção>): um
  `<article class="config-secao">` por seção, só o da seção aberta à vista
  (a navegação diz qual). A moldura (`#configuracoesApp`: cabeçalho, barra de
  salvar, diálogos e as seções que publicam pela barra, por portal no corpo
  de cada uma) baixa na primeira abertura da página; Acessos, Módulos e abas,
  Status das atualizações e Automação são telas próprias, cada uma no seu
  bloco (`#acessosApp`…), baixadas na primeira abertura da seção. As
  visitadas continuam montadas (o rascunho de Acessos fica).
*/
const BLOCO_DA_SECAO: Readonly<Record<SecaoComTela, [string, string]>> =
  Object.freeze({
    acessos: ["acessosApp", "data-acessos"],
    modulos: ["modulosApp", "data-modulos"],
    cargas: ["saudeDasCargasApp", "data-saude-das-cargas"],
    automacao: ["automacaoApp", "data-automacao"],
  });

function PaginaDeConfiguracoes({ ativa }: { ativa: boolean }) {
  const { secao } = usarEstadoDaNavegacao();
  const aberta = secao || SECOES[0]!.id;
  const [pagina, definirPagina] = useState<HTMLElement | null>(null);
  const [corpos, definirCorpos] = useState<
    Partial<Record<string, Element | null>>
  >({});
  // Um callback de ref estável por seção: guarda o corpo (alvo dos portais da moldura).
  const guardarCorpo = useMemo(
    () =>
      Object.fromEntries(
        SECOES.map(({ id }) => [
          id,
          (corpo: HTMLDivElement | null) =>
            definirCorpos((atuais) =>
              atuais[id] === corpo ? atuais : { ...atuais, [id]: corpo },
            ),
        ]),
      ),
    [],
  );
  const [visitadas, definirVisitadas] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  if (ativa && !visitadas.has(aberta))
    definirVisitadas(new Set(visitadas).add(aberta));
  const contexto = useMemo(() => ({ pagina, corpos }), [pagina, corpos]);

  return (
    <section
      id="page-config"
      ref={definirPagina}
      className={classeDaPagina(ativa)}
      data-subgrupo={aberta}
    >
      <div id="configuracoesApp" data-configuracoes="">
        {visitadas.size ? (
          <ContextoDaPaginaDeConfiguracoes.Provider value={contexto}>
            <ConteudoDaTela view="config" />
          </ContextoDaPaginaDeConfiguracoes.Provider>
        ) : null}
      </div>
      <div className="config-layout">
        <div className="config-painel">
          {SECOES.map(({ id, rotulo }) => (
            <article
              key={id}
              className="config-secao"
              data-secao={id}
              aria-label={rotulo}
              hidden={id !== aberta}
            >
              <div
                className="config-secao__corpo form-grid"
                ref={guardarCorpo[id]}
              >
                {ehSecaoComTela(id) ? (
                  <BlocoDaSecao secao={id} visitada={visitadas.has(id)} />
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* O bloco de uma seção com tela própria; a tela baixa na primeira abertura. */
function BlocoDaSecao({
  secao,
  visitada,
}: {
  secao: SecaoComTela;
  visitada: boolean;
}) {
  const [id, atributo] = BLOCO_DA_SECAO[secao];
  return (
    <div id={id} className="full" {...{ [atributo]: "" }}>
      {visitada ? (
        <ConteudoDaTela view={viewDaSecao(secao)} secao={secao} />
      ) : null}
    </div>
  );
}
