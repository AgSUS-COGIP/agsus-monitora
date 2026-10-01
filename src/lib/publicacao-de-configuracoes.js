/*
  Publicação das Configurações, sem DOM: que chaves cada seção grava, como a
  publicação se compara com o retrato do banco (get_configuracoes_snapshot) e
  as validações de formato. O estado e as RPCs são de
  src/componentes/configuracoes/estado.js.

  A página está migrando para React por seção. Enquanto houver seção legada,
  a publicação junta dois lados numa chamada só (uma transação):
    - CAMPOS_DO_LEGADO: os campos `cfg*` que ainda moram no index.html (o
      estado lê o valor no DOM);
    - CAMPOS_DAS_SECOES: os campos das seções já em React (o valor vem do
      rascunho do estado).
  Seção migrada: suas chaves saem de CAMPOS_DO_LEGADO e entram aqui. Os
  painéis externos (p_paineis) são de paineis-externos-das-configuracoes.js.
*/

const txt = (valor) => String(valor ?? "").trim();

/* [id do campo no index.html, chave, descrição, valor se o campo faltar] */
export const CAMPOS_DO_LEGADO = Object.freeze([
  ["cfgPageTitle", "page_title", "Título da página inicial"],
  ["cfgPageSubtitle", "page_subtitle", "Subtítulo da página inicial"],
  [
    "cfgGoogleEnabled",
    "auth_google_enabled",
    "Exibe ou oculta o login com Google",
    "true",
  ],
  [
    "cfgGoogleButtonText",
    "auth_google_button_text",
    "Texto do botão de autenticação Google",
  ],
  [
    "cfgGoogleDomainHint",
    "auth_google_domain_hint",
    "Domínio sugerido no login Google",
  ],
  [
    "cfgGoogleAllowedDomains",
    "auth_google_allowed_domains",
    "Domínios institucionais autorizados",
  ],
  [
    "cfgAccessBackgroundUrl",
    "auth_access_background_url",
    "Arte institucional da tela de acesso",
  ],
  [
    "cfgAccessBackgroundPath",
    "auth_access_background_path",
    "Caminho da arte institucional da tela de acesso",
  ],
  [
    "cfgAccessLogoUrl",
    "auth_access_logo_url",
    "Logo da AgSUS na tela de acesso",
  ],
  [
    "cfgAccessPanelColor",
    "auth_access_panel_color",
    "Cor do painel da tela de acesso",
  ],
  [
    "cfgAccessTextoModo",
    "auth_access_texto_modo",
    "Texto sobre o painel de acesso",
    "auto",
  ],
  ["cfgAccessGreeting", "auth_access_greeting", "Saudação da tela de acesso"],
  [
    "cfgAccessInstruction",
    "auth_access_instruction",
    "Instrução da tela de acesso",
  ],
  ["cfgFilterTitle", "filter_title", "Título dos filtros"],
  ["cfgFilterSubtitle", "filter_subtitle", "Subtítulo dos filtros"],
  ["cfgFilterToggleShow", "filter_toggle_show", "Texto para mostrar filtros"],
  ["cfgFilterToggleHide", "filter_toggle_hide", "Texto para ocultar filtros"],
  ["cfgKpiProcessos", "kpi_processos_label", "Rótulo do KPI processos"],
  ["cfgKpiVagas", "kpi_vagas_label", "Rótulo do KPI vagas"],
  ["cfgKpiContratados", "kpi_contratados_label", "Rótulo do KPI contratações"],
  ["cfgKpiOciosas", "kpi_ociosas_label", "Rótulo do KPI vagas ociosas"],
  ["cfgKpiCriticos", "kpi_criticos_label", "Rótulo do KPI críticos"],
  ["cfgKpiInscritos", "kpi_inscritos_label", "Rótulo do KPI inscritos"],
  ["cfgBroadcastType", "broadcast_type", "Tipo do aviso global", "info"],
  ["cfgBroadcastMsg", "broadcast_msg", "Mensagem do aviso global"],
]);

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

/*
  Campos das seções em React, por seção. `tipo: "url"` valida como endereço
  http(s) (vazio passa). `rotulo`, `dica` e `placeholder` são os da tela.
*/
export const CAMPOS_DAS_SECOES = Object.freeze({
  marca: Object.freeze([
    {
      chave: "cogip_nome",
      descricao: "Nome da equipe (COGIP)",
      rotulo: "Nome da equipe",
      placeholder: "Ex: COGIP",
      dica: "Nome da equipe que mantém o sistema. Aparece no pé da barra lateral.",
    },
    {
      chave: "cogip_funcao",
      descricao: "Função / área da equipe",
      rotulo: "Função / área",
      placeholder: "Ex: Desenvolvimento e sustentação",
      dica: "Linha curta abaixo do nome da equipe, como a área ou a função.",
    },
    {
      chave: "cogip_dept",
      descricao: "Texto institucional",
      rotulo: "Texto institucional",
      placeholder: "Ex: Gestão da Informação de Pessoal",
      dica: "Texto institucional exibido junto da equipe.",
    },
    {
      chave: "cogip_logo_url",
      descricao: "Logo da equipe",
      rotulo: "Logo da equipe (URL)",
      tipo: "url",
      largo: true,
      dica: "Endereço de uma imagem (PNG, JPG, WEBP ou SVG): https:// ou um caminho do próprio site, como /assets/logo.png.",
    },
    {
      chave: "footer_text",
      descricao: "Texto do rodapé (fallback)",
      rotulo: "Rodapé",
      dica: "Texto no pé das páginas, como créditos.",
    },
  ]),
  /*
    Operação. `normalizar` repete o que o formulário legado mostrava ao
    carregar (cfgBool/cfgInt e os padrões de DEFAULT_CONFIG): o valor que a
    tela mostra é o que a publicação envia, como antes.
  */
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
      opcoes: Object.freeze([
        ["true", "Ativo"],
        ["false", "Inativo"],
      ]),
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

/** Linhas de `p_config_rows` dos campos em React: { chave, valor, descricao }. */
export function linhasDasSecoes(valores) {
  return CHAVES_DAS_SECOES.map((chave) => ({
    chave,
    valor: txt(valores.get(chave)),
    descricao: CAMPO_POR_CHAVE.get(chave).descricao,
  }));
}

/**
 * Os valores lidos da TB_CONFIGURACAO como a tela os mostra: cada campo com
 * `normalizar` recebe o valor normalizado (e o padrão, se a chave falta).
 */
export function normalizarValoresCarregados(config = {}) {
  const valores = new Map(
    Object.entries(config || {}).map(([chave, valor]) => [chave, valor ?? ""]),
  );
  for (const [chave, campo] of CAMPO_POR_CHAVE)
    if (campo.normalizar)
      valores.set(chave, campo.normalizar(valores.get(chave)));
  return valores;
}

function inteiroValido(valor, { minimo, maximo }) {
  const numero = Number(txt(valor));
  return Number.isInteger(numero) && numero >= minimo && numero <= maximo;
}

/** Erros dos campos em React: Map chave → mensagem. */
export function errosDasSecoes(valores) {
  const erros = new Map();
  for (const [chave, campo] of CAMPO_POR_CHAVE) {
    if (campo.tipo === "url" && !urlHttpValida(valores.get(chave)))
      erros.set(
        chave,
        `URL inválida no campo ${campo.rotulo}: use https:// ou http://.`,
      );
    if (campo.tipo === "inteiro" && !inteiroValido(valores.get(chave), campo))
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
