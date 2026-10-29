import {
  canAnalisarRecursos,
  canViewAvaliacaoDocumental,
  canViewClassificacao,
  canViewCore,
  canViewEntrevistas,
  canViewRecursos,
  canViewSelecao,
  paginasPermitidas,
  permissaoLegada,
  podeAbrirConfiguracoes,
} from "./access-roles";

/*
  Regras da navegação do app (sem DOM): que tela o perfil pode abrir, qual é a
  tela inicial e o aviso quando a tela pedida não é dele. Quem aplica é
  src/app/navegacao.ts.

  `paineis` traz o que depende dos painéis externos carregados:
  `podeAbrir(codigo)` e `primeiro()` (o primeiro painel liberado, ou nada).
*/

/** O perfil da sessão, como as regras de acesso o recebem. */
type Perfil = Parameters<typeof permissaoLegada>[0];

/** O que depende dos painéis externos carregados. */
export interface PaineisDaNavegacao {
  podeAbrir(codigo: string): unknown;
  primeiro(): { codigo: string } | null | undefined;
}

/** A tela (view) e a visão dentro dela. */
export interface DestinoDaTela {
  view: string;
  visao: string;
}

/** Chave do localStorage com a última tela aberta. */
export const CHAVE_DA_TELA_GUARDADA = "agsus_monitora_current_view_v268";

/** Tela de quem não tem módulo liberado. */
export const TELA_SEM_ACESSO = "sem-acesso";

const PREFIXO_DO_PAINEL = "panel:";

/** `panel:<codigo>` → código do painel externo; outra tela → "". */
export function codigoDoPainel(view: unknown): string {
  const texto = String(view || "");
  return texto.startsWith(PREFIXO_DO_PAINEL)
    ? (texto.slice(PREFIXO_DO_PAINEL.length).split(":")[0] as string)
    : "";
}

export const ehPainelExterno = (view: unknown): boolean =>
  String(view || "").startsWith(PREFIXO_DO_PAINEL);

/*
  Links antigos: a tela de Entrevistas tinha três visões (Resultados,
  Conduzir entrevistas e Roteiros). Desde 07/10/2026 são duas entradas do
  menu — o Painel de entrevistas (view `entrevistas`) e Conduzir entrevistas
  (view `conduzir-entrevistas`, com Fila e Preparar; os roteiros ficam no
  Preparar). `entrevistas:<visão>` vai para o lugar novo.
*/
const TELAS_ANTIGAS: Readonly<Record<string, Readonly<DestinoDaTela>>> =
  Object.freeze({
    "entrevistas:resultados": Object.freeze({ view: "entrevistas", visao: "" }),
    "entrevistas:conduzir": Object.freeze({
      view: "conduzir-entrevistas",
      visao: "fila",
    }),
    "entrevistas:roteiros": Object.freeze({
      view: "conduzir-entrevistas",
      visao: "preparar",
    }),
  });

/** A tela pedida (e a visão dela), já trocando um link antigo pelo novo. */
export function destinoDaTela(pedida: unknown): DestinoDaTela {
  const tela = String(pedida ?? "").trim();
  return TELAS_ANTIGAS[tela] || { view: tela, visao: "" };
}

/*
  O que pode o perfil, tela a tela, e o aviso de quem não pode. A ordem e os
  textos são os de sempre (o `navigate` do legado).
*/
const BLOQUEIOS: Readonly<
  Record<string, readonly [(perfil: Perfil) => unknown, string]>
> = Object.freeze({
  dashboard: [
    (perfil) => permissaoLegada(perfil, "ind"),
    "Sem permissão para Saúde Indígena.",
  ],
  nucleo: [
    (perfil) => permissaoLegada(perfil, "cores"),
    "Sem permissão para Editais.",
  ],
  calendario: [
    (perfil) =>
      permissaoLegada(perfil, perfil?.permissoes ? "calendario" : "cores"),
    "Sem permissão para o Cronograma.",
  ],
  approved: [canViewCore, "Sem permissão para Lista de Aprovados."],
  analises: [
    (perfil) => permissaoLegada(perfil, "analises"),
    "Sem permissão para o Painel das análises.",
  ],
  "avaliacao-documental": [
    canViewAvaliacaoDocumental,
    "Sem permissão para a Avaliação documental.",
  ],
  "pre-classificacao": [
    canViewAvaliacaoDocumental,
    "Sem permissão para a Triagem.",
  ],
  recursos: [canViewRecursos, "Sem permissão para Recursos."],
  "analisar-recursos": [
    canAnalisarRecursos,
    "Sem permissão para analisar recursos.",
  ],
  entrevistas: [canViewEntrevistas, "Sem permissão para Entrevistas."],
  "conduzir-entrevistas": [
    canViewEntrevistas,
    "Sem permissão para Entrevistas.",
  ],
  classificacao: [canViewClassificacao, "Sem permissão para Classificação."],
  selecao: [canViewSelecao, "Sem permissão para Seleção."],
  config: [podeAbrirConfiguracoes, "Sem permissão para Configurações."],
});

/**
 * O aviso quando o perfil não pode abrir a tela (ou quando a tela não existe);
 * "" quando pode, e para "sem-acesso".
 */
export function bloqueioDaTela(
  view: string,
  perfil: Perfil,
  paineis?: PaineisDaNavegacao | null,
): string {
  if (ehPainelExterno(view))
    return paineis?.podeAbrir(codigoDoPainel(view))
      ? ""
      : "Sem permissão para este painel externo ou painel inativo.";
  const regra = BLOQUEIOS[view];
  /*
    Tela que não existe (link velho, `navigate("chat")`): antes passava, a
    navegação tirava a página ativa e ficava a tela em branco com o título da
    anterior. Agora é bloqueio com aviso, e a tela atual continua.
  */
  if (!regra)
    return view === TELA_SEM_ACESSO ? "" : `A tela "${view}" não existe.`;
  const [pode, aviso] = regra;
  return pode(perfil) ? "" : aviso;
}

/** A tela está liberada para o perfil (as mesmas regras do "Ver como" de Acessos). */
export function telaPermitida(
  view: string | null | undefined,
  perfil: Perfil,
  paineis?: PaineisDaNavegacao | null,
): boolean {
  if (!view) return false;
  const paginas = paginasPermitidas(perfil);
  if (Object.hasOwn(paginas, view))
    return (paginas as Readonly<Record<string, boolean>>)[view] as boolean;
  if (ehPainelExterno(view))
    return Boolean(paineis?.podeAbrir(codigoDoPainel(view)));
  return false;
}

/** Tela inicial do SISTEMA (nunca um painel externo, salvo se for o único acesso). */
export function telaInicialDoSistema(
  perfil: Perfil,
  paineis?: PaineisDaNavegacao | null,
): string {
  const pode = (permissao: string) => permissaoLegada(perfil, permissao);
  if (pode("ind")) return "dashboard";
  if (pode("cores")) return "nucleo";
  if (pode("calendario")) return "calendario";
  if (canViewCore(perfil)) return "approved";
  if (pode("analises")) return "analises";
  if (canViewAvaliacaoDocumental(perfil)) return "avaliacao-documental";
  if (canViewRecursos(perfil)) return "recursos";
  if (canViewEntrevistas(perfil)) return "entrevistas";
  if (canViewClassificacao(perfil)) return "classificacao";
  if (canViewSelecao(perfil)) return "selecao";
  if (podeAbrirConfiguracoes(perfil)) return "config";
  const painel = paineis?.primeiro();
  if (painel) return PREFIXO_DO_PAINEL + painel.codigo;
  return TELA_SEM_ACESSO;
}

/*
  A tela ao entrar: a última aberta, se ainda for permitida — EXCETO painel
  externo, para o app nunca abrir "preso" num painel (sem menu para voltar) ao
  recarregar —; senão, a inicial do sistema.
*/
export function telaDeEntrada(
  guardada: string | null | undefined,
  perfil: Perfil,
  paineis?: PaineisDaNavegacao | null,
): string {
  if (
    guardada &&
    !ehPainelExterno(guardada) &&
    telaPermitida(guardada, perfil, paineis)
  )
    return guardada;
  return telaInicialDoSistema(perfil, paineis);
}
