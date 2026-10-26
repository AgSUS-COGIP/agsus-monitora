/*
  Publicação das Configurações, sem DOM: que chaves cada seção grava, como a
  publicação se compara com o retrato do banco (get_configuracoes_snapshot) e
  as validações de formato. O estado e as RPCs são de
  src/modulos/configuracoes/estado.ts.

  Todas as seções que publicam pela barra fixa são React: o valor de cada
  campo vem do rascunho do estado (CAMPOS_DAS_SECOES), e a publicação manda
  todas as chaves numa chamada só (uma transação). Os painéis externos
  (p_paineis) são de paineis-externos-das-configuracoes.ts.
*/

import {
  DEFAULT_ACCESS_BRANDING,
  normalizeAccessBackgroundUrl,
  normalizeAccessLogoUrl,
  normalizeAccessPanelColor,
} from "./access-branding.ts";
import { isValidAccessAssetUrl } from "./config-validation";
import { normalizarModo } from "./contraste.js";
import {
  corDaBarraSegura,
  logoDaBarraSegura,
} from "./marca-da-barra-lateral.js";
import { normalizeAllowedDomains } from "./platform-context";
import { EMAIL_DO_SUPORTE_PADRAO, emailValido } from "./chamado-da-aya.ts";
import {
  CABECALHO_PADRAO,
  CHAVE_DO_CABECALHO,
} from "./cabecalho-dos-documentos.js";
import {
  alteracoesDasComemoracoes,
  CHAVE_DAS_COMEMORACOES,
  errosDaConfiguracao,
  normalizarConfiguracao,
  serializarConfiguracao,
} from "./catalogo-de-comemoracoes.ts";
import type {
  AlteracoesDoPainel,
  CampoEditavelDoPainel,
  LinhaDePainelNoBanco,
  LinhaDoPainel,
  PainelExterno,
} from "./paineis-externos-das-configuracoes.ts";

const txt = (valor: unknown): string => String(valor ?? "").trim();

/** As seções que publicam pela barra fixa (chaves de CAMPOS_DAS_SECOES). */
export type SecaoQuePublica =
  "marca" | "inicio" | "acesso" | "aparencia" | "operacao" | "comemoracoes";

/** O tipo do campo (ver o comentário de CAMPOS_DAS_SECOES). */
export type TipoDoCampo =
  | "texto-longo"
  | "url"
  | "inteiro"
  | "email"
  | "dominio"
  | "url-de-acesso"
  | "booleano"
  | "opcoes"
  | "cor"
  | "gerenciado"
  | "comemoracoes";

/** Uma opção de lista: [valor gravado, rótulo na tela]. */
export type OpcaoDoCampo = readonly [valor: string, rotulo: string];

/** Um campo de seção: chave da TB_CONFIGURACAO, textos da tela e regras. */
export interface CampoDaSecao {
  chave: string;
  descricao: string;
  rotulo: string;
  tipo?: TipoDoCampo;
  placeholder?: string;
  largo?: boolean;
  padrao?: string;
  dica?: string;
  obrigatorio?: boolean;
  erro?: string;
  opcoes?: readonly OpcaoDoCampo[];
  minimo?: number;
  maximo?: number;
  normalizar?: (valor: string | undefined) => string;
}

/** Valores das configurações: Map chave → valor. */
export type ValoresDasConfiguracoes = Map<string, string>;

/** Configuração lida da TB_CONFIGURACAO como objeto chave → valor. */
export type ConfiguracaoCarregada = Readonly<
  Record<string, string | null | undefined>
>;

/** Linha de `p_config_rows` (salvar_configuracoes_e_paineis_v2). */
export interface LinhaDaConfiguracao {
  chave: string;
  valor: string;
  descricao: string;
}

/** Linha da TB_CONFIGURACAO no retrato do banco. */
export interface LinhaDeConfiguracaoNoBanco {
  chave: string;
  valor: string | null;
  descricao?: string | null;
}

/** O retrato que get_configuracoes_snapshot devolve. */
export interface RetratoDasConfiguracoesNoBanco {
  configuracoes?: LinhaDeConfiguracaoNoBanco[] | null;
  paineis?: LinhaDePainelNoBanco[] | null;
  gerado_em?: string | null;
}

/** O que outro administrador mudou nos mesmos campos. */
export interface ConflitoDaPublicacao {
  entity: "Configuração" | "Painel";
  label: string;
  field: string;
}

/** Uma linha da revisão (antes → depois). */
export interface AlteracaoParaRevisar extends ConflitoDaPublicacao {
  before: unknown;
  after: unknown;
}

/** Uma alteração gravada no histórico (get_configuracoes_historico). */
export interface AlteracaoGravada {
  entidade?: string | null;
  rotulo?: string | null;
  chave?: string | null;
  codigo?: string | null;
  campo?: string | null;
  antes?: unknown;
  depois?: unknown;
}

/** Uma versão do histórico das Configurações (get_configuracoes_historico). */
export interface VersaoDoHistorico {
  id: string | number;
  acao?: string | null;
  motivo?: string | null;
  alteracoes?: AlteracaoGravada[] | null;
  total_alteracoes?: number | null;
  created_by_email?: string | null;
  created_at?: string | null;
}

/** O que `conflitosDaPublicacao` compara com o retrato. */
export interface OpcoesDosConflitos {
  carregados: ReadonlyMap<string, string>;
  rascunho: ReadonlyMap<string, string>;
  paineisCarregados?: readonly PainelExterno[];
  rascunhoDosPaineis?: ReadonlyMap<string, AlteracoesDoPainel>;
}

const BOOLEANO_VERDADEIRO = ["true", "1", "sim", "yes", "on"];
const BOOLEANO_FALSO = ["false", "0", "nao", "não", "no", "off"];

/** "true"/"false" na regra do `cfgBool` do legado; desconhecido vira `padrao`. */
export function normalizarBooleano(valor: unknown, padrao = true): string {
  const bruto = txt(valor).toLowerCase();
  if (BOOLEANO_VERDADEIRO.includes(bruto)) return "true";
  if (BOOLEANO_FALSO.includes(bruto)) return "false";
  return String(padrao);
}

/** Inteiro ≥ `minimo` na regra do `cfgInt` do legado; sem número vira `padrao`. */
export function normalizarInteiro(
  valor: unknown,
  padrao: number,
  minimo = 1,
): string {
  const numero = parseInt(txt(valor), 10);
  return String(Math.max(minimo, Number.isFinite(numero) ? numero : padrao));
}

const ATIVO_INATIVO: readonly OpcaoDoCampo[] = Object.freeze([
  ["true", "Ativo"],
  ["false", "Inativo"],
]);

const texto = (
  chave: string,
  descricao: string,
  rotulo: string,
  extra: Omit<CampoDaSecao, "chave" | "descricao" | "rotulo"> = {},
): Readonly<CampoDaSecao> =>
  Object.freeze({ chave, descricao, rotulo, ...extra });

/*
  Campos das seções, por seção. `rotulo` e `placeholder` são os da tela;
  `descricao` é a da TB_CONFIGURACAO (vai na linha publicada e na revisão).

  `tipo`: "texto-longo" (várias linhas), "url" (http/https; vazio passa), "inteiro" (minimo..maximo), "email",
  "dominio" (agenciasus.org.br), "url-de-acesso" (caminho do site ou https),
  "booleano"/"opcoes" (lista `opcoes`), "cor" (seletor), "gerenciado" (sem
  campo de texto: a seção escolhe o valor por botões — imagens) e
  "comemoracoes" (o JSON dos marcos, editado pela seção Comemorações).
  `obrigatorio` recusa vazio. `erro` é a mensagem dos tipos sem mensagem
  própria.

  `normalizar` repete o que o formulário legado mostrava ao carregar
  (cfgBool/cfgInt, os normalizadores de access-branding.ts e os padrões de
  DEFAULT_CONFIG do legacy-app.js): o valor que a tela mostra é o que a
  publicação envia, como antes. `padrao` é o valor de DEFAULT_CONFIG quando a
  chave não veio do banco (o `cfgValue` do legado).
*/
export const CAMPOS_DAS_SECOES: Readonly<
  Record<SecaoQuePublica, readonly CampoDaSecao[]>
> = Object.freeze({
  marca: Object.freeze<CampoDaSecao[]>([
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
      placeholder: "https:// ou /caminho (PNG, JPG, WEBP ou SVG)",
    },
    {
      chave: "footer_text",
      descricao: "Texto do rodapé (fallback)",
      rotulo: "Rodapé",
    },
    {
      /* O timbrado dos documentos oficiais da Classificação (Word e prévia do SEI). */
      chave: CHAVE_DO_CABECALHO,
      descricao: "Cabeçalho da agência nos documentos oficiais",
      rotulo: "Cabeçalho da agência",
      tipo: "texto-longo",
      largo: true,
      padrao: CABECALHO_PADRAO,
      dica: "Uma linha por linha do timbrado: nome, endereço e site.",
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
      opcoes: Object.freeze<OpcaoDoCampo[]>([
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
    texto(
      "kpi_vagas_label",
      "Rótulo do KPI vagas imediatas",
      "Vagas imediatas",
    ),
    texto("kpi_contratadas_label", "Rótulo do KPI contratadas", "Contratadas"),
    texto("kpi_em_selecao_label", "Rótulo do KPI em seleção", "Em seleção"),
    texto("kpi_ociosas_label", "Rótulo do KPI vagas ociosas", "Ociosas"),
    texto(
      "kpi_cadastro_reserva_label",
      "Rótulo do KPI cadastro reserva",
      "Cadastro reserva",
    ),
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
      { placeholder: DEFAULT_ACCESS_BRANDING.buttonText },
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
        opcoes: Object.freeze<OpcaoDoCampo[]>([
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

  operacao: Object.freeze<CampoDaSecao[]>([
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
      /* Para onde o "Abrir chamado" da Aya abre o e-mail (src/lib/chamado-da-aya.ts). */
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

  /* Os marcos das comemorações (src/lib/catalogo-de-comemoracoes.ts); vazio = padrão. */
  comemoracoes: Object.freeze<CampoDaSecao[]>([
    {
      chave: CHAVE_DAS_COMEMORACOES,
      descricao: "Comemorações: marcos, efeitos e marcos personalizados",
      rotulo: "Comemorações",
      tipo: "comemoracoes",
      erro: "Revise os marcos personalizados em Comemorações.",
      normalizar: (valor) =>
        serializarConfiguracao(normalizarConfiguracao(valor)),
    },
  ]),
});

export const CHAVES_DAS_SECOES: readonly string[] = Object.freeze(
  Object.values(CAMPOS_DAS_SECOES).flatMap((campos) =>
    campos.map((campo) => campo.chave),
  ),
);

const CAMPO_POR_CHAVE = new Map<string, CampoDaSecao>(
  Object.values(CAMPOS_DAS_SECOES)
    .flat()
    .map((campo) => [campo.chave, campo]),
);

/** Os campos de uma seção, por chave (para as telas). */
export const camposDaSecao = (secao: string): Map<string, CampoDaSecao> =>
  new Map(
    (
      (CAMPOS_DAS_SECOES as Partial<Record<string, readonly CampoDaSecao[]>>)[
        secao
      ] || []
    ).map((c) => [c.chave, c]),
  );

export function urlHttpValida(valor: unknown): boolean {
  const bruto = txt(valor);
  if (!bruto) return true;
  try {
    return ["https:", "http:"].includes(new URL(bruto).protocol);
  } catch {
    return false;
  }
}

export function dominioValido(valor: unknown): boolean {
  const bruto = txt(valor);
  if (!bruto) return true;
  if (/[:/\s@]/.test(bruto)) return false;
  return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(bruto);
}

/**
 * Linhas de `p_config_rows`: { chave, valor, descricao }, uma por chave.
 * Com `chaves`, só essas (as que a pessoa mudou): a publicação não reenvia o
 * que outro administrador possa ter mudado depois que a tela carregou.
 */
export function linhasDasSecoes(
  valores: ReadonlyMap<string, string>,
  chaves: readonly string[] = CHAVES_DAS_SECOES,
): LinhaDaConfiguracao[] {
  const pedidas = new Set(chaves);
  return CHAVES_DAS_SECOES.filter((chave) => pedidas.has(chave)).map(
    (chave) => ({
      chave,
      valor: txt(valores.get(chave)),
      // Toda chave de CHAVES_DAS_SECOES está em CAMPO_POR_CHAVE.
      descricao: CAMPO_POR_CHAVE.get(chave)!.descricao,
    }),
  );
}

/**
 * Os valores lidos da TB_CONFIGURACAO como a tela os mostra: chave ausente
 * recebe o `padrao` (como o `cfgValue` do legado) e cada campo com
 * `normalizar` recebe o valor normalizado.
 */
export function normalizarValoresCarregados(
  config: ConfiguracaoCarregada | null = {},
): ValoresDasConfiguracoes {
  const valores = new Map<string, string>(
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

/* Os campos "inteiro" declaram sempre `minimo` e `maximo`. */
function inteiroValido(
  valor: unknown,
  { minimo, maximo }: CampoDaSecao,
): boolean {
  const numero = Number(txt(valor));
  return (
    Number.isInteger(numero) &&
    numero >= (minimo as number) &&
    numero <= (maximo as number)
  );
}

/** Validação de um tipo de campo: `true` quando o valor serve. */
type ValidacaoDoCampo = (
  valor: string | undefined,
  campo: CampoDaSecao,
) => boolean;

const VALIDACAO_POR_TIPO: Readonly<Partial<Record<string, ValidacaoDoCampo>>> =
  Object.freeze({
    email: emailValido,
    inteiro: inteiroValido,
    dominio: dominioValido,
    "url-de-acesso": isValidAccessAssetUrl,
    comemoracoes: (valor) =>
      errosDaConfiguracao(normalizarConfiguracao(valor)).length === 0,
  });

/** Erros dos campos: Map chave → mensagem. */
export function errosDasSecoes(
  valores: ReadonlyMap<string, string>,
): Map<string, string> {
  // `erro` existe em todo campo obrigatório ou validado por tipo.
  const erros = new Map<string, string>();
  for (const [chave, campo] of CAMPO_POR_CHAVE) {
    const valor = valores.get(chave);
    if (campo.obrigatorio && !txt(valor)) erros.set(chave, campo.erro!);
    else if (campo.tipo === "url" && !urlHttpValida(valor))
      erros.set(
        chave,
        `URL inválida no campo ${campo.rotulo}: use https:// ou http://.`,
      );
    else if (
      VALIDACAO_POR_TIPO[campo.tipo!] &&
      !VALIDACAO_POR_TIPO[campo.tipo!]!(valor, campo)
    )
      erros.set(chave, campo.erro!);
  }
  return erros;
}

/*
  get_configuracoes_snapshot devolve { configuracoes, paineis, gerado_em }.
  (A renomeação de 20260918160000 trocou a chave por '"TB_CONFIGURACAO"' e a
  revisão passou a mostrar toda configuração como "(vazio) → valor"; a
  migration 20260929220000 devolveu o nome.)
*/
export function snapshotMaps(
  snapshot: RetratoDasConfiguracoesNoBanco | null | undefined,
): {
  configMap: Map<string, LinhaDeConfiguracaoNoBanco>;
  panelMap: Map<string, LinhaDePainelNoBanco>;
} {
  const configMap = new Map<string, LinhaDeConfiguracaoNoBanco>(
    (snapshot?.configuracoes || []).map((item) => [item.chave, item]),
  );
  const panelMap = new Map<string, LinhaDePainelNoBanco>(
    (snapshot?.paineis || []).map((item) => [String(item.id), item]),
  );
  return { configMap, panelMap };
}

/**
 * O que outro administrador mudou no banco, depois que a tela carregou, nos
 * mesmos campos que a pessoa está mudando: [{ entity, label, field }].
 * `carregados` e `rascunho` são Maps chave → valor; os painéis vêm já
 * normalizados (`paineisCarregados`) e o rascunho é Map id → { campo: valor }.
 */
export function conflitosDaPublicacao(
  snapshot: RetratoDasConfiguracoesNoBanco | null | undefined,
  {
    carregados,
    rascunho,
    paineisCarregados = [],
    rascunhoDosPaineis = new Map(),
  }: OpcoesDosConflitos,
): ConflitoDaPublicacao[] {
  const { panelMap } = snapshotMaps(snapshot);
  const doBanco = normalizarValoresCarregados(
    Object.fromEntries(
      (snapshot?.configuracoes || []).map((item): [string, string | null] => [
        item.chave,
        item.valor,
      ]),
    ),
  );
  const conflitos: ConflitoDaPublicacao[] = [];
  for (const chave of rascunho.keys()) {
    if (txt(doBanco.get(chave)) === txt(carregados.get(chave))) continue;
    conflitos.push({
      entity: "Configuração",
      label: CAMPO_POR_CHAVE.get(chave)?.descricao || chave,
      field: "Valor",
    });
  }
  const rotulos: Record<CampoEditavelDoPainel, string> = {
    titulo: "Título",
    url: "URL",
    ativo: "Ativo",
    em_manutencao: "Manutenção",
  };
  for (const [id, campos] of rascunhoDosPaineis) {
    const carregado = paineisCarregados.find((painel) => painel.id === id);
    const banco = panelMap.get(String(id));
    if (!carregado || !banco) continue;
    for (const campo of Object.keys(campos) as CampoEditavelDoPainel[]) {
      const antes =
        campo === "ativo"
          ? banco.ativo !== false
          : campo === "em_manutencao"
            ? Boolean(banco.em_manutencao)
            : txt(banco[campo]);
      if (antes === carregado[campo]) continue;
      conflitos.push({
        entity: "Painel",
        label: carregado.nome || carregado.codigo || id,
        field: rotulos[campo] || campo,
      });
    }
  }
  return conflitos;
}

/** O que muda entre o banco e a tela: [{ entity, label, field, before, after }]. */
export function buildChanges(
  snapshot: RetratoDasConfiguracoesNoBanco | null | undefined,
  configRows: readonly LinhaDaConfiguracao[],
  panels: readonly LinhaDoPainel[],
): AlteracaoParaRevisar[] {
  const { configMap, panelMap } = snapshotMaps(snapshot);
  const changes: AlteracaoParaRevisar[] = [];

  configRows.forEach((row) => {
    const previous = configMap.get(row.chave);
    if (txt(previous?.valor) === txt(row.valor)) return;
    // Os marcos das comemorações: campo a campo, não o JSON inteiro.
    if (row.chave === CHAVE_DAS_COMEMORACOES) {
      const detalhes = alteracoesDasComemoracoes(previous?.valor, row.valor);
      if (detalhes.length) {
        for (const item of detalhes)
          changes.push({ entity: "Configuração", ...item });
        return;
      }
    }
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
    (
      [
        ["titulo", "Título"],
        ["url", "URL"],
        ["ativo", "Ativo"],
        ["em_manutencao", "Manutenção"],
      ] as const
    ).forEach(([field, label]) => {
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
export function alteracoesDaVersao(
  versao: VersaoDoHistorico | null | undefined,
): AlteracaoParaRevisar[] {
  return (versao?.alteracoes || []).map((item) => ({
    entity: item.entidade === "painel" ? ("Painel" as const) : "Configuração",
    label: item.rotulo || item.chave || item.codigo || "Alteração",
    field: item.campo || "Valor",
    before: item.antes,
    after: item.depois,
  }));
}

export function valorParaExibir(valor: unknown): string {
  if (valor === true || valor === "true") return "Sim";
  if (valor === false || valor === "false") return "Não";
  return txt(valor) || "(vazio)";
}

export function resumoDaVersao(alteracoes: unknown): string {
  const itens: AlteracaoGravada[] = Array.isArray(alteracoes) ? alteracoes : [];
  if (!itens.length) return "Sem detalhes registrados";
  const rotulos = itens
    .slice(0, 3)
    .map((item) => item.rotulo || item.chave || item.codigo || "Alteração");
  return `${rotulos.join(", ")}${itens.length > 3 ? ` e mais ${itens.length - 3}` : ""}`;
}
