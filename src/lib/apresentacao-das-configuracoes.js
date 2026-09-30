/*
  Apresentação das seções legadas de Configurações (Página inicial, Tela de
  acesso e Recursos), sem DOM: como os campos se agrupam, as dicas de cada
  campo e os resumos que as prévias mostram. O desenho é de
  src/modules/config-apresentacao.js.

  Os campos continuam sendo os mesmos elementos, com os mesmos ids: o módulo
  só os move para dentro do grupo, como config-secoes.js faz com as seções.
*/

/**
 * Grupos por seção, na ordem da tela. `tom` escolhe a cor do ícone (paleta de
 * gráficos e estados do design.md; ver config-apresentacao.css).
 */
export const GRUPOS_POR_SECAO = Object.freeze({
  inicio: [
    {
      id: "cabecalho",
      titulo: "Cabeçalho da página",
      descricao: "Título e subtítulo que abrem a página inicial.",
      icone: "layout-dashboard",
      tom: "azul",
      campos: ["cfgPageTitle", "cfgPageSubtitle"],
    },
    {
      id: "aviso",
      titulo: "Aviso global",
      descricao: "Faixa no topo, vista por todos. Sem mensagem, não aparece.",
      icone: "megaphone",
      tom: "atencao",
      campos: ["cfgBroadcastType", "cfgBroadcastMsg"],
    },
    {
      id: "filtros",
      titulo: "Filtros",
      descricao: "Textos do painel de filtros do mapa e da tabela.",
      icone: "list-filter",
      tom: "petroleo",
      campos: [
        "cfgFilterTitle",
        "cfgFilterSubtitle",
        "cfgFilterToggleShow",
        "cfgFilterToggleHide",
      ],
    },
    {
      id: "indicadores",
      titulo: "Indicadores",
      descricao: "Rótulo de cada número do topo da página inicial.",
      icone: "gauge",
      tom: "sucesso",
      campos: [
        "cfgKpiProcessos",
        "cfgKpiVagas",
        "cfgKpiContratados",
        "cfgKpiOciosas",
        "cfgKpiCriticos",
        "cfgKpiInscritos",
      ],
    },
  ],
  acesso: [
    {
      id: "boas-vindas",
      titulo: "Boas-vindas",
      descricao: "O que a pessoa lê no cartão de entrada.",
      icone: "log-in",
      tom: "azul",
      campos: [
        "cfgLoginEyebrow",
        "cfgAccessGreeting",
        "cfgAccessInstruction",
        "cfgSubtitle",
      ],
    },
    {
      id: "google",
      titulo: "Entrar com Google",
      descricao: "O botão de entrada com a conta institucional.",
      icone: "globe",
      tom: "petroleo",
      campos: [
        "cfgGoogleEnabled",
        "cfgGoogleButtonText",
        "cfgGoogleDomainHint",
      ],
    },
    {
      id: "dominios",
      titulo: "Quem pode entrar",
      descricao: "Só e-mails destes domínios passam da tela de entrada.",
      icone: "shield-check",
      tom: "sucesso",
      campos: ["cfgGoogleAllowedDomains"],
    },
    {
      id: "senha",
      titulo: "Entrada com e-mail e senha",
      descricao: "Textos do formulário de e-mail e senha.",
      icone: "log-in",
      tom: "neutro",
      campos: [
        "cfgLoginEmailLabel",
        "cfgLoginEmailPlaceholder",
        "cfgLoginPasswordLabel",
        "cfgLoginPasswordPlaceholder",
        "cfgLoginButtonText",
        "cfgPasswordResetMessage",
      ],
    },
  ],
});

/** Dica de ajuda por campo (tooltip do ícone "?", design.md 11.10). */
export const DICAS_DOS_CAMPOS = Object.freeze({
  cfgPageTitle: "Título grande da página inicial.",
  cfgPageSubtitle: "Linha logo abaixo do título da página inicial.",
  cfgBroadcastType:
    "Informação (azul), Alerta (amarelo) ou Crítico (vermelho): a cor da faixa de aviso.",
  cfgBroadcastMsg: "Deixe em branco para não mostrar aviso.",
  cfgFilterToggleShow: "Texto do botão que abre o painel de filtros.",
  cfgFilterToggleHide: "Texto do mesmo botão quando os filtros estão abertos.",
  cfgKpiProcessos:
    "Os seis rótulos seguem a ordem dos indicadores na página inicial.",
  cfgAccessGreeting: "Título grande do cartão de entrada.",
  cfgAccessInstruction: "Frase curta abaixo da saudação, dizendo como entrar.",
  cfgGoogleEnabled: "Desligado, o botão do Google some da tela de entrada.",
  cfgGoogleDomainHint:
    "Domínio sugerido na tela do Google, para quem tem mais de uma conta conectada.",
  cfgGoogleAllowedDomains:
    "Separe por vírgula. Quem entra com e-mail de outro domínio não passa da tela de entrada.",
  cfgRealtimeEnabled:
    "Ligado, os dados do monitoramento se atualizam na tela quando mudam no banco, sem recarregar a página.",
});

const txt = (valor) => String(valor ?? "").trim();

/** Faixa de aviso: tom do design.md 11.12 para cada tipo gravado. */
export function tomDoAviso(tipo) {
  const tons = {
    info: { tom: "info", icone: "info", rotulo: "Informação" },
    warning: { tom: "warning", icone: "triangle-alert", rotulo: "Alerta" },
    danger: { tom: "danger", icone: "circle-alert", rotulo: "Crítico" },
  };
  return tons[txt(tipo)] || tons.info;
}

/**
 * Endereço de imagem que pode ir para um <img>: caminho do próprio site
 * ("/assets/…") ou http(s). Qualquer outra coisa (javascript:, data:) vira "".
 */
export function urlDeImagem(valor) {
  const bruto = txt(valor);
  if (!bruto) return "";
  if (/^\/(?!\/)/.test(bruto)) return bruto;
  try {
    const url = new URL(bruto);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : "";
  } catch {
    return "";
  }
}

/** Primeiro domínio da lista "a.org.br, b.org.br" (para "Conta @domínio"). */
export function primeiroDominio(lista) {
  return (
    txt(lista)
      .split(/[,;\s]+/)
      .map((d) => d.replace(/^@/, "").toLowerCase())
      .find(Boolean) || ""
  );
}

/**
 * Situação de cada painel externo, na mesma regra do selo da tabela
 * (config-ui.js): inativo > manutenção > ativo com URL > sem URL.
 */
export function situacaoDoPainel({ ativo, manutencao, url }) {
  if (!ativo) return "inativo";
  if (manutencao) return "manutencao";
  return txt(url) ? "ativo" : "semUrl";
}

export function resumoDosPaineis(paineis = []) {
  const resumo = {
    total: paineis.length,
    ativo: 0,
    manutencao: 0,
    inativo: 0,
    semUrl: 0,
  };
  for (const painel of paineis) resumo[situacaoDoPainel(painel)] += 1;
  return resumo;
}
