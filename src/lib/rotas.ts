/*
  As rotas do app: a área e a tela no endereço (`/saude-indigena/cronograma`).
  Regra pura, sem DOM: quem lê e escreve o endereço é src/app/endereco.ts, e
  quem decide se a tela abre é a navegação (src/app/navegacao.ts), com as
  mesmas permissões de sempre (src/lib/navegacao.ts).

    /<area>/<tela>[/<edital>][?visao=<visão>]   telas das áreas (Saúde Indígena, SEDE, Projetos)
    /<area>/editais/<edital>/regras/<etapa>     Regras do edital (Editais), na etapa
    /administracao/configuracoes[/<seção>]      Configurações
    /paineis/<código>                           painel externo
    /sem-acesso                                 quem não tem módulo liberado
    /                                           a tela de entrada (guardada ou inicial)

  A `view` é o nome interno de sempre (o do menu, das permissões e do
  catálogo de abas); o caminho é o nome que a pessoa lê no endereço.
*/
import { etapaDasRegras } from "./regras-do-edital.ts";

/** Para onde ir: a tela (view) e o que vai com ela. */
export interface DestinoDaRota {
  view: string;
  /** Área do sistema (só nas telas das áreas). */
  area?: string;
  /** Edital aberto na tela (Classificação, Entrevistas, Triagem). */
  edital?: string;
  /** Visão dentro da tela (links antigos: `entrevistas:conduzir`). */
  visao?: string;
  /** Seção de Configurações. */
  secao?: string;
  /** Regras do edital abertas em Editais (com `edital`): a etapa. */
  regras?: string;
}

/** Uma tela de área: o caminho no endereço, o título e se aceita edital. */
export interface TelaDaRota {
  view: string;
  caminho: string;
  titulo: string;
  /** Subtítulo depois da área; recebe o texto de TB_CONFIGURACAO. */
  subtitulo?: (configuracao: (chave: string) => string) => string;
  comEdital?: boolean;
  /** A tela abre as Regras do edital de um edital (Editais). */
  comRegras?: boolean;
}

/*
  As telas de página inteira das áreas. A Visão geral também é uma delas
  (título próprio, da área: src/lib/visao-geral-da-area.ts).
*/
const TELAS: TelaDaRota[] = [
  { view: "dashboard", caminho: "visao-geral", titulo: "Visão geral" },
  {
    view: "nucleo",
    caminho: "editais",
    titulo: "Editais",
    subtitulo: (configuracao) => configuracao("nucleo_page_subtitle"),
    comRegras: true,
  },
  {
    view: "calendario",
    caminho: "cronograma",
    titulo: "Cronograma",
    subtitulo: () => "Etapas dos editais, por data.",
  },
  {
    view: "approved",
    caminho: "aprovados",
    titulo: "Lista de Aprovados",
    subtitulo: () => "Candidatos por edital e situação de contratação.",
  },
  {
    view: "recursos",
    caminho: "painel-de-recursos",
    titulo: "Painel de recursos",
  },
  { view: "analisar-recursos", caminho: "recursos", titulo: "Recursos" },
  {
    view: "entrevistas",
    caminho: "painel-de-entrevistas",
    titulo: "Painel de entrevistas",
  },
  {
    view: "conduzir-entrevistas",
    caminho: "entrevistas",
    titulo: "Entrevistas",
    comEdital: true,
  },
  {
    view: "classificacao",
    caminho: "classificacao",
    titulo: "Classificação",
    comEdital: true,
  },
  { view: "analises", caminho: "analises", titulo: "Painel das análises" },
  {
    view: "avaliacao-documental",
    caminho: "avaliacao-documental",
    titulo: "Avaliação documental",
  },
  {
    view: "pre-classificacao",
    caminho: "triagem",
    titulo: "Triagem",
    comEdital: true,
  },
  { view: "selecao", caminho: "selecao", titulo: "Painel da Seleção" },
];
export const TELAS_DAS_AREAS: readonly TelaDaRota[] = Object.freeze(
  TELAS.map((tela) => Object.freeze(tela)),
);

const POR_VIEW: ReadonlyMap<string, TelaDaRota> = new Map(
  TELAS_DAS_AREAS.map((tela) => [tela.view, tela]),
);
const POR_CAMINHO: ReadonlyMap<string, TelaDaRota> = new Map(
  TELAS_DAS_AREAS.map((tela) => [tela.caminho, tela]),
);

/** A tela de área da view (ou `undefined` para Configurações, painéis…). */
export function telaDaRota(view: string | null | undefined) {
  return POR_VIEW.get(String(view ?? ""));
}

export const AREA_DAS_CONFIGURACOES_NA_ROTA = "administracao";
export const CAMINHO_DAS_CONFIGURACOES = "configuracoes";
export const AREA_DOS_PAINEIS_NA_ROTA = "paineis";
export const CAMINHO_SEM_ACESSO = "sem-acesso";
export const CAMINHO_DAS_REGRAS = "regras";
const PREFIXO_DO_PAINEL = "panel:";
/* O primeiro pedaço que não é área (Configurações, painéis, sem acesso). */
const AREAS_RESERVADAS: ReadonlySet<string> = new Set([
  AREA_DAS_CONFIGURACOES_NA_ROTA,
  AREA_DOS_PAINEIS_NA_ROTA,
  CAMINHO_SEM_ACESSO,
]);

/* Um pedaço do caminho: letras, números, hífen e sublinhado (ids e códigos). */
const PEDACO = /^[A-Za-z0-9_-]+$/;

const texto = (valor: unknown) => String(valor ?? "").trim();
const pedaco = (valor: unknown) => {
  const limpo = texto(valor);
  return PEDACO.test(limpo) ? limpo : "";
};

function decodificar(parte: string) {
  try {
    return decodeURIComponent(parte);
  } catch {
    return "";
  }
}

/**
 * O endereço do destino (caminho e busca). Tela de área sem área conhecida,
 * ou tela que não existe, devolve "/" (a tela de entrada).
 */
export function caminhoDoDestino(destino: DestinoDaRota): string {
  const view = texto(destino.view);
  if (view === CAMINHO_SEM_ACESSO) return `/${CAMINHO_SEM_ACESSO}`;
  if (view.startsWith(PREFIXO_DO_PAINEL)) {
    const codigo = pedaco(view.slice(PREFIXO_DO_PAINEL.length).split(":")[0]);
    return codigo ? `/${AREA_DOS_PAINEIS_NA_ROTA}/${codigo}` : "/";
  }
  if (view === "config") {
    const secao = pedaco(destino.secao);
    return `/${AREA_DAS_CONFIGURACOES_NA_ROTA}/${CAMINHO_DAS_CONFIGURACOES}${secao ? `/${secao}` : ""}`;
  }
  const tela = POR_VIEW.get(view);
  const area = pedaco(destino.area);
  if (!tela || !area) return "/";
  const daRegra = tela.comRegras ? pedaco(destino.edital) : "";
  if (daRegra && destino.regras)
    return `/${area}/${tela.caminho}/${daRegra}/${CAMINHO_DAS_REGRAS}/${etapaDasRegras(destino.regras)}`;
  const edital = tela.comEdital ? pedaco(destino.edital) : "";
  const visao = pedaco(destino.visao);
  return (
    `/${area}/${tela.caminho}` +
    (edital ? `/${edital}` : "") +
    (visao ? `?visao=${visao}` : "")
  );
}

/**
 * O destino do endereço. `null` na raiz (`/`, `/index.html`) e em caminho que
 * não é rota do app (quem chamou decide: a raiz abre a tela de entrada; o
 * desconhecido, também, com aviso).
 */
export function destinoDoCaminho(
  caminho: string,
  busca = "",
): DestinoDaRota | null {
  const partes = String(caminho ?? "")
    .split("/")
    .filter(Boolean)
    .map(decodificar);
  if (!partes.length || (partes.length === 1 && partes[0] === "index.html"))
    return null;
  if (partes.some((parte) => !PEDACO.test(parte))) return null;
  const [primeira, segunda, terceira, ...resto] = partes as [
    string,
    string | undefined,
    string | undefined,
    ...string[],
  ];
  const regras = AREAS_RESERVADAS.has(primeira)
    ? null
    : regrasDoCaminho(segunda, terceira, resto);
  if (regras) return { ...regras, area: primeira };
  if (resto.length) return null;
  if (primeira === CAMINHO_SEM_ACESSO)
    return segunda ? null : { view: CAMINHO_SEM_ACESSO };
  if (primeira === AREA_DOS_PAINEIS_NA_ROTA)
    return segunda && !terceira
      ? { view: `${PREFIXO_DO_PAINEL}${segunda}` }
      : null;
  if (primeira === AREA_DAS_CONFIGURACOES_NA_ROTA)
    return segunda === CAMINHO_DAS_CONFIGURACOES
      ? { view: "config", ...(terceira ? { secao: terceira } : {}) }
      : null;
  const tela = segunda ? POR_CAMINHO.get(segunda) : undefined;
  if (!tela || (terceira && !tela.comEdital)) return null;
  const visao = pedaco(new URLSearchParams(busca || "").get("visao"));
  return {
    view: tela.view,
    area: primeira,
    ...(terceira ? { edital: terceira } : {}),
    ...(visao ? { visao } : {}),
  };
}

/*
  `/<area>/editais/<edital>/regras[/<etapa>]`: as Regras do edital (sem
  etapa, a primeira). Etapa que não existe não é rota.
*/
function regrasDoCaminho(
  segunda: string | undefined,
  edital: string | undefined,
  resto: readonly string[],
): { view: string; edital: string; regras: string } | null {
  const tela = segunda ? POR_CAMINHO.get(segunda) : undefined;
  if (!tela?.comRegras || !edital || resto[0] !== CAMINHO_DAS_REGRAS)
    return null;
  if (resto.length > 2) return null;
  const pedida = resto[1];
  if (pedida && etapaDasRegras(pedida) !== pedida) return null;
  return { view: tela.view, edital, regras: etapaDasRegras(pedida) };
}

/** O caminho é a raiz do app (abre a tela de entrada)? */
export function ehRaizDoApp(caminho: string): boolean {
  const limpo = String(caminho ?? "").replace(/\/+$/, "");
  return limpo === "" || limpo === "/index.html";
}
