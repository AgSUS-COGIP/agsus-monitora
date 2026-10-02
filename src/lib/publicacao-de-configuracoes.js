/*
  Publicação das Configurações, sem DOM: que chaves cada seção grava, como a
  publicação se compara com o retrato do banco (get_configuracoes_snapshot) e
  as validações de formato. O estado e as RPCs são de
  src/componentes/configuracoes/estado.js.

  Todas as seções que publicam pela barra fixa são React: o valor de cada
  campo vem do rascunho do estado (CAMPOS_DAS_SECOES), e a publicação manda
  todas as chaves numa chamada só (uma transação). Os painéis externos
  (p_paineis) são de paineis-externos-das-configuracoes.js.
*/

import {
  DEFAULT_ACCESS_BRANDING,
  normalizeAccessBackgroundUrl,
  normalizeAccessLogoUrl,
  normalizeAccessPanelColor,
} from "./access-branding.js";
import { isValidAccessAssetUrl } from "./config-validation.js";
import { normalizarModo } from "./contraste.js";
import {
  corDaBarraSegura,
  logoDaBarraSegura,
} from "./marca-da-barra-lateral.js";
import { normalizeAllowedDomains } from "./platform-context.js";
import { EMAIL_DO_SUPORTE_PADRAO, emailValido } from "./chamado-da-aya.js";

const txt = (valor) => String(valor ?? "").trim();

const BOOLEANO_VERDADEIRO = ["true", "1", "sim", "yes", "on"];
const BOOLEANO_FALSO = ["false", "0", "nao", "não", "no", "off"];

/** "true"/"false" na regra do `cfgBool` do legado; desconhecido vira `padrao`. */
export function normalizarBooleano(valor, padrao = true) {
  const bruto = txt(valor).toLowerCase();
  if (BOOLEANO_VERDADEIRO.includes(bruto)) return "true";
  if (BOOLEANO_FALSO.includes(bruto)) return "false";
  return String(padrao);
}

/** Inteiro ≥ `minimo` na regra do `cfgInt` do legado; sem número vira `padrao`. */
export function normalizarInteiro(valor, padrao, minimo = 1) {
  const numero = parseInt(txt(valor), 10);
  return String(Math.max(minimo, Number.isFinite(numero) ? numero : padrao));
}

const ATIVO_INATIVO = Object.freeze([
  ["true", "Ativo"],
  ["false", "Inativo"],
]);

const texto = (chave, descricao, rotulo, extra = {}) =>
  Object.freeze({ chave, descricao, rotulo, ...extra });

/*
  Campos das seções, por seção. `rotulo` e `placeholder` são os da tela;
  `descricao` é a da TB_CONFIGURACAO (vai na linha publicada e na revisão).

  `tipo`: "url" (http/https; vazio passa), "inteiro" (minimo..maximo), "email",
  "dominio" (agenciasus.org.br), "url-de-acesso" (caminho do site ou https),
  "booleano"/"opcoes" (lista `opcoes`), "cor" (seletor) e "gerenciado" (sem
  campo de texto: a seção escolhe o valor por botões — imagens).
  `obrigatorio` recusa vazio. `erro` é a mensagem dos tipos sem mensagem
  própria.

  `normalizar` repete o que o formulário legado mostrava ao carregar
  (cfgBool/cfgInt, os normalizadores de access-branding.js e os padrões de
  DEFAULT_CONFIG do legacy-app.js): o valor que a tela mostra é o que a
  publicação envia, como antes. `padrao` é o valor de DEFAULT_CONFIG quando a
  chave não veio do banco (o `cfgValue` do legado).
*/
export const CAMPOS_DAS_SECOES = Object.freeze({
  marca: Object.freeze([
    {
      chave: "cogip_nome",
      descricao: "Nome da equipe (COGIP)",
      rotulo: "Nome da equipe",
      placeholder: "Ex: COGIP",
    },
    {
      chave: "cogip_funcao",
      descricao: "Função / área da equipe",
      rotulo: "Função / área",
      placeholder: "Ex: Desenvolvimento e sustentação",
    },
    {
      chave: "cogip_dept",
      descricao: "Texto institucional",
      rotulo: "Texto institucional",
      placeholder: "Ex: Gestão da Informação de Pessoal",
    },
    {
      chave: "cogip_logo_url",
      descricao: "Logo da equipe",
      rotulo: "Logo da equipe (URL)",
      tipo: "url",
      largo: true,
      dica: "PNG/JPG/WEBP/SVG; https:// ou /caminho",
    },
    {
      chave: "footer_text",
      descricao: "Texto do rodapé (fallback)",
      rotulo: "Rodapé",
    },
  ]),

  inicio: Object.freeze([
    texto("page_title", "Título da página inicial", "Título", {
      placeholder: "Ex: Saúde Indígena",
      obrigatorio: true,
      erro: "Informe o título da página inicial.",
    }),
    texto("page_subtitle", "Subtítulo da página inicial", "Subtítulo", {
      placeholder: "Ex: Monitoramento DSEI/CASAI",
    }),
    texto("broadcast_type", "Tipo do aviso global", "Tipo", {
      tipo: "opcoes",
      opcoes: Object.freeze([
        ["info", "Informação"],
        ["warning", "Alerta"],
        ["danger", "Crítico"],
      ]),
      normalizar: (valor) => valor || "info",
    }),
    texto("broadcast_msg", "Mensagem do aviso global", "Mensagem", {
      placeholder: "Mensagem global",
      largo: true,
    }),
    texto("filter_title", "Título dos filtros", "Título"),
    texto("filter_subtitle", "Subtítulo dos filtros", "Subtítulo"),
    texto("filter_toggle_show", "Texto para mostrar filtros", "Mostrar"),
    texto("filter_toggle_hide", "Texto para ocultar filtros", "Ocultar"),
    texto("kpi_processos_label", "Rótulo do KPI processos", "Processos"),
    texto("kpi_vagas_label", "Rótulo do KPI vagas", "Vagas"),
    texto(
      "kpi_contratados_label",
      "Rótulo do KPI contratações",
      "Contratações",
    ),
    texto("kpi_ociosas_label", "Rótulo do KPI vagas ociosas", "Ociosas"),
    texto("kpi_criticos_label", "Rótulo do KPI críticos", "Críticos"),
    texto("kpi_inscritos_label", "Rótulo do KPI inscritos", "Inscritos"),
  ]),

  acesso: Object.freeze([
    texto("auth_access_greeting", "Saudação da tela de acesso", "Saudação", {
      placeholder: DEFAULT_ACCESS_BRANDING.greeting,
      largo: true,
      normalizar: (valor) => valor || DEFAULT_ACCESS_BRANDING.greeting,
    }),
    texto(
      "auth_google_enabled",
      "Exibe ou oculta o login com Google",
      "Login Google",
      {
        tipo: "booleano",
        opcoes: ATIVO_INATIVO,
        normalizar: (valor) => normalizarBooleano(valor, true),
      },
    ),
    texto(
      "auth_google_button_text",
      "Texto do botão de autenticação Google",
      "Texto do botão",
      { placeholder: "Entrar com sua conta institucional" },
    ),
    texto(
      "auth_google_domain_hint",
      "Domínio sugerido no login Google",
      "Domínio sugerido",
      {
        tipo: "dominio",
        placeholder: "agenciasus.org.br",
        erro: "O domínio Google deve estar no formato agenciasus.org.br, sem https://, @ ou barras.",
      },
    ),
    texto(
      "auth_google_allowed_domains",
      "Domínios institucionais autorizados",
      "Domínios permitidos",
      {
        placeholder: "agenciasus.org.br,agsus.org.br",
        largo: true,
        padrao: "agenciasus.org.br,agsus.org.br",
        normalizar: (valor) => normalizeAllowedDomains(valor).join(","),
      },
    ),
  ]),

  aparencia: Object.freeze([
    texto(
      "auth_access_background_url",
      "Arte institucional da tela de acesso",
      "Arte de fundo",
      { tipo: "gerenciado", normalizar: normalizeAccessBackgroundUrl },
    ),
    texto(
      "auth_access_background_path",
      "Caminho da arte institucional da tela de acesso",
      "Caminho da arte de fundo",
      { tipo: "gerenciado" },
    ),
    texto(
      "auth_access_logo_url",
      "Logo da AgSUS na tela de acesso",
      "Logo no acesso",
      {
        tipo: "url-de-acesso",
        placeholder: "/assets/agsus-logo.webp",
        largo: true,
        erro: "URL inválida no campo Logo da AgSUS no acesso.",
        normalizar: normalizeAccessLogoUrl,
      },
    ),
    texto(
      "auth_access_panel_color",
      "Cor do painel da tela de acesso",
      "Cor do painel",
      { tipo: "cor", normalizar: normalizeAccessPanelColor },
    ),
    texto(
      "auth_access_texto_modo",
      "Texto sobre o painel de acesso",
      "Texto sobre o painel",
      {
        tipo: "opcoes",
        opcoes: Object.freeze([
          ["auto", "Automático"],
          ["claro", "Sempre claro"],
          ["escuro", "Sempre escuro"],
        ]),
        normalizar: normalizarModo,
      },
    ),
    texto(
      "ui_sidebar_logo_url",
      "Logo independente da barra lateral do AgSUS Monitora",
      "Logo da barra lateral",
      { tipo: "gerenciado", normalizar: logoDaBarraSegura },
    ),
    texto(
      "ui_sidebar_background_color",
      "Cor de fundo da barra lateral do AgSUS Monitora",
      "Cor da barra lateral",
      { tipo: "cor", normalizar: corDaBarraSegura },
    ),
  ]),

  operacao: Object.freeze([
    {
      chave: "cogip_versao",
      descricao: "Versão do sistema",
      rotulo: "Versão do sistema",
      placeholder: "Ex: V.2.7.3",
    },
    {
      chave: "app_version_current",
      descricao: "Versão corrente publicada",
      rotulo: "Versão publicada",
      placeholder: "Ex: MONITORA Web V2.9.35",
    },
    {
      chave: "feature_realtime_monitoramento",
      descricao: "Habilita atualização em tempo real do monitoramento",
      rotulo: "Realtime do monitoramento",
      tipo: "booleano",
      opcoes: ATIVO_INATIVO,
      normalizar: (valor) => normalizarBooleano(valor, true),
    },
    {
      chave: "access_heartbeat_minutos",
      descricao: "Intervalo de auditoria heartbeat, em minutos",
      rotulo: "Heartbeat de auditoria (min)",
      tipo: "inteiro",
      minimo: 1,
      maximo: 60,
      placeholder: "5",
      erro: "O heartbeat deve ser um número inteiro entre 1 e 60.",
      normalizar: (valor) => normalizarInteiro(valor, 5, 1),
    },
    {
      /* Para onde o "Abrir chamado" da Aya abre o e-mail (src/lib/chamado-da-aya.js). */
      chave: "support_email",
      descricao: "E-mail do suporte (chamados abertos pela Aya)",
      rotulo: "E-mail do suporte",
      tipo: "email",
      obrigatorio: true,
      padrao: EMAIL_DO_SUPORTE_PADRAO,
      placeholder: EMAIL_DO_SUPORTE_PADRAO,
      largo: true,
      erro: "Informe um e-mail válido, como nome@agenciasus.org.br.",
      normalizar: (valor) => txt(valor),
    },
  ]),
});

export const CHAVES_DAS_SECOES = Object.freeze(
  Object.values(CAMPOS_DAS_SECOES).flatMap((campos) =>
    campos.map((campo) => campo.chave),
  ),
);

const CAMPO_POR_CHAVE = new Map(
  Object.values(CAMPOS_DAS_SECOES)
    .flat()
    .map((campo) => [campo.chave, campo]),
);

/** Os campos de uma seção, por chave (para as telas). */
export const camposDaSecao = (secao) =>
  new Map((CAMPOS_DAS_SECOES[secao] || []).map((c) => [c.chave, c]));

export function urlHttpValida(valor) {
  const bruto = txt(valor);
  if (!bruto) return true;
  try {
    return ["https:", "http:"].includes(new URL(bruto).protocol);
  } catch {
    return false;
  }
}

export function dominioValido(valor) {
  const bruto = txt(valor);
  if (!bruto) return true;
  if (/[:/\s@]/.test(bruto)) return false;
  return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(bruto);
}

/** Linhas de `p_config_rows`: { chave, valor, descricao }, uma por chave. */
export function linhasDasSecoes(valores) {
  return CHAVES_DAS_SECOES.map((chave) => ({
    chave,
    valor: txt(valores.get(chave)),
    descricao: CAMPO_POR_CHAVE.get(chave).descricao,
  }));
}

/**
 * Os valores lidos da TB_CONFIGURACAO como a tela os mostra: chave ausente
 * recebe o `padrao` (como o `cfgValue` do legado) e cada campo com
 * `normalizar` recebe o valor normalizado.
 */
export function normalizarValoresCarregados(config = {}) {
  const valores = new Map(
    Object.entries(config || {}).map(([chave, valor]) => [chave, valor ?? ""]),
  );
  for (const [chave, campo] of CAMPO_POR_CHAVE) {
    const bruto =
      !valores.has(chave) && campo.padrao !== undefined
        ? campo.padrao
        : valores.get(chave);
    if (campo.normalizar) valores.set(chave, campo.normalizar(bruto));
    else if (bruto !== undefined) valores.set(chave, bruto);
  }
  return valores;
}

function inteiroValido(valor, { minimo, maximo }) {
  const numero = Number(txt(valor));
  return Number.isInteger(numero) && numero >= minimo && numero <= maximo;
}

const VALIDACAO_POR_TIPO = Object.freeze({
  email: emailValido,
  inteiro: inteiroValido,
  dominio: dominioValido,
  "url-de-acesso": isValidAccessAssetUrl,
});

/** Erros dos campos: Map chave → mensagem. */
export function errosDasSecoes(valores) {
  const erros = new Map();
  for (const [chave, campo] of CAMPO_POR_CHAVE) {
    const valor = valores.get(chave);
    if (campo.obrigatorio && !txt(valor)) erros.set(chave, campo.erro);
    else if (campo.tipo === "url" && !urlHttpValida(valor))
      erros.set(
        chave,
        `URL inválida no campo ${campo.rotulo}: use https:// ou http://.`,
      );
    else if (
      VALIDACAO_POR_TIPO[campo.tipo] &&
      !VALIDACAO_POR_TIPO[campo.tipo](valor, campo)
    )
      erros.set(chave, campo.erro);
  }
  return erros;
}

/*
  get_configuracoes_snapshot devolve { configuracoes, paineis, gerado_em }.
  (A renomeação de 20260918160000 trocou a chave por '"TB_CONFIGURACAO"' e a
  revisão passou a mostrar toda configuração como "(vazio) → valor"; a
  migration 20260929220000 devolveu o nome.)
*/
export function snapshotMaps(snapshot) {
  const configMap = new Map(
    (snapshot?.configuracoes || []).map((item) => [item.chave, item]),
  );
  const panelMap = new Map(
    (snapshot?.paineis || []).map((item) => [String(item.id), item]),
  );
  return { configMap, panelMap };
}

/** O que muda entre o banco e a tela: [{ entity, label, field, before, after }]. */
export function buildChanges(snapshot, configRows, panels) {
  const { configMap, panelMap } = snapshotMaps(snapshot);
  const changes = [];

  configRows.forEach((row) => {
    const previous = configMap.get(row.chave);
    if (txt(previous?.valor) === txt(row.valor)) return;
    changes.push({
      entity: "Configuração",
      label: row.descricao || row.chave,
      field: "Valor",
      before: previous?.valor ?? "",
      after: row.valor ?? "",
    });
  });

  panels.forEach((panel) => {
    const previous = panelMap.get(String(panel.id));
    if (!previous) return;
    [
      ["titulo", "Título"],
      ["url", "URL"],
      ["ativo", "Ativo"],
      ["em_manutencao", "Manutenção"],
    ].forEach(([field, label]) => {
      if (String(previous[field] ?? "") === String(panel[field] ?? "")) return;
      changes.push({
        entity: "Painel",
        label: previous.titulo || previous.codigo || panel.id,
        field: label,
        before: previous[field] ?? "",
        after: panel[field] ?? "",
      });
    });
  });

  return changes;
}

/** As alterações gravadas numa versão do histórico, no formato da revisão. */
export function alteracoesDaVersao(versao) {
  return (versao?.alteracoes || []).map((item) => ({
    entity: item.entidade === "painel" ? "Painel" : "Configuração",
    label: item.rotulo || item.chave || item.codigo || "Alteração",
    field: item.campo || "Valor",
    before: item.antes,
    after: item.depois,
  }));
}

export function valorParaExibir(valor) {
  if (valor === true || valor === "true") return "Sim";
  if (valor === false || valor === "false") return "Não";
  return txt(valor) || "(vazio)";
}

export function resumoDaVersao(alteracoes) {
  const itens = Array.isArray(alteracoes) ? alteracoes : [];
  if (!itens.length) return "Sem detalhes registrados";
  const rotulos = itens
    .slice(0, 3)
    .map((item) => item.rotulo || item.chave || item.codigo || "Alteração");
  return `${rotulos.join(", ")}${itens.length > 3 ? ` e mais ${itens.length - 3}` : ""}`;
}
