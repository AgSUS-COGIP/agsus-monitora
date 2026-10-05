import {
  canViewAvaliacaoDocumental,
  canViewClassificacao,
  canViewCore,
  canViewEntrevistas,
  canViewRecursos,
  canViewSelecao,
  paginasPermitidas,
  permissaoLegada,
  podeAbrirConfiguracoes,
} from "./access-roles.js";

/*
  Regras da navegação do app (sem DOM): que tela o perfil pode abrir, qual é a
  tela inicial e o aviso quando a tela pedida não é dele. Quem aplica é
  src/app/navegacao.js.

  `paineis` traz o que depende dos painéis externos carregados:
  `podeAbrir(codigo)` e `primeiro()` (o primeiro painel liberado, ou nada).
*/

/** Chave do localStorage com a última tela aberta. */
export const CHAVE_DA_TELA_GUARDADA = "agsus_monitora_current_view_v268";

/** Tela de quem não tem módulo liberado. */
export const TELA_SEM_ACESSO = "sem-acesso";

const PREFIXO_DO_PAINEL = "panel:";

/** `panel:<codigo>` → código do painel externo; outra tela → "". */
export function codigoDoPainel(view) {
  const texto = String(view || "");
  return texto.startsWith(PREFIXO_DO_PAINEL)
    ? texto.slice(PREFIXO_DO_PAINEL.length).split(":")[0]
    : "";
}

export const ehPainelExterno = (view) =>
  String(view || "").startsWith(PREFIXO_DO_PAINEL);

/*
  O que pode o perfil, tela a tela, e o aviso de quem não pode. A ordem e os
  textos são os de sempre (o `navigate` do legado).
*/
const BLOQUEIOS = Object.freeze({
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
  recursos: [canViewRecursos, "Sem permissão para Recursos."],
  entrevistas: [canViewEntrevistas, "Sem permissão para Entrevistas."],
  classificacao: [canViewClassificacao, "Sem permissão para Classificação."],
  selecao: [canViewSelecao, "Sem permissão para Seleção."],
  config: [podeAbrirConfiguracoes, "Sem permissão para Configurações."],
});

/**
 * O aviso quando o perfil não pode abrir a tela; "" quando pode (ou quando a
 * tela não tem regra própria, como "sem-acesso").
 */
export function bloqueioDaTela(view, perfil, paineis) {
  if (ehPainelExterno(view))
    return paineis?.podeAbrir(codigoDoPainel(view))
      ? ""
      : "Sem permissão para este painel externo ou painel inativo.";
  const regra = BLOQUEIOS[view];
  if (!regra) return "";
  const [pode, aviso] = regra;
  return pode(perfil) ? "" : aviso;
}

/** A tela está liberada para o perfil (as mesmas regras do "Ver como" de Acessos). */
export function telaPermitida(view, perfil, paineis) {
  if (!view) return false;
  const paginas = paginasPermitidas(perfil);
  if (Object.hasOwn(paginas, view)) return paginas[view];
  if (ehPainelExterno(view))
    return Boolean(paineis?.podeAbrir(codigoDoPainel(view)));
  return false;
}

/** Tela inicial do SISTEMA (nunca um painel externo, salvo se for o único acesso). */
export function telaInicialDoSistema(perfil, paineis) {
  const pode = (permissao) => permissaoLegada(perfil, permissao);
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
export function telaDeEntrada(guardada, perfil, paineis) {
  if (
    guardada &&
    !ehPainelExterno(guardada) &&
    telaPermitida(guardada, perfil, paineis)
  )
    return guardada;
  return telaInicialDoSistema(perfil, paineis);
}
