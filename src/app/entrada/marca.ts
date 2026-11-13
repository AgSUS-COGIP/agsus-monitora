/*
  A marca da tela de acesso: arte de fundo, cor do painel, logo, saudação,
  texto do botão e o rodapé institucional. Estado sem React (`obter`/`assinar`)
  que a tela de entrada (entrada.tsx) lê com `useSyncExternalStore`.

  ORDEM DE CARREGAMENTO
    0. antes do primeiro quadro — o script clássico do <head> do index.html
       aplica a arte e a cor guardadas (cópia mínima desta leitura);
    1. ao avaliar este módulo (é o primeiro import de src/main.ts) — a marca
       guardada da visita anterior, sem rede;
    2. em paralelo — `obter_branding_acesso_publico()`, que traz a identidade
       atual e não exige autenticação. Só quando a tela de acesso vai
       aparecer: com sessão guardada (`html.sessao-guardada`, script
       `marcarSessaoGuardada` do index.html) ela não aparece, e a
       configuração completa (passo 4) atualiza a cópia guardada; se a sessão
       não servir, a tela de acesso pede a marca ao aparecer
       (`atualizarMarcaUmaVez`, src/app/entrada/entrada.tsx);
    3. se a RPC respondeu, o cache é atualizado e os campos reaplicados;
    4. depois que o legado carrega TB_CONFIGURACAO, `definirMarcaDaConfiguracao`
       aplica a configuração completa (só as chaves que vieram do banco).

  O que uma falha **não** pode fazer: trocar uma identidade correta por outra.
  Se a RPC não responder, fica o que estava; se nada estava, a tela fica neutra.
  Nunca a arte padrão apresentada como se fosse escolha da instituição.

  A arte e a cor vão no `#loginScreen` (variáveis CSS e a classe
  `login-panel-dark`, que o CSS exige no próprio elemento); logo, saudação,
  texto do botão e rodapé vão para o estado, que a tela desenha.
*/

import {
  guardarMarca,
  lerMarcaGuardada,
  type MarcaGuardada,
} from "../../lib/access-branding-cache.ts";
import { buscarMarcaPublica } from "../../lib/access-branding-publico.ts";
import {
  DEFAULT_ACCESS_BRANDING,
  enderecosDaArteNaTela,
  normalizeAccessBackgroundUrl,
  normalizeAccessLogoUrl,
  normalizeAccessPanelColor,
} from "../../lib/access-branding.ts";
import {
  DESFOQUE_DO_VIDRO_EM_PX,
  ESTILO_VIDRO,
  MODO_AUTO,
  TEXTO_CLARO,
  corDoTextoPara,
  normalizarCorNoVidro,
  normalizarDesfoqueDoVidro,
  normalizarEstilo,
  normalizarModo,
  porcentagemDaCorNoVidro,
} from "../../lib/contraste.ts";

/** O rodapé institucional da tela de acesso (chaves `cogip_*`). */
export type RodapeDaEntrada = {
  nome: string;
  logoUrl: string;
  funcao: string;
  versao: string;
  departamento: string;
};

/** O que a tela de acesso desenha da marca (logo, saudação, botão, rodapé). */
export type IdentidadeDaEntrada = {
  logoUrl: string;
  saudacao: string;
  textoDoBotao: string;
  rodape: Readonly<RodapeDaEntrada>;
  resolvida: boolean;
};

/** O estado da marca, lido com `useSyncExternalStore` (`obter`/`assinar`). */
export type EstadoDaMarcaDaEntrada = {
  obter: () => Readonly<IdentidadeDaEntrada>;
  assinar: (ouvinte: () => void) => () => boolean;
  definir: (parcial: Partial<IdentidadeDaEntrada>) => void;
  reiniciarParaTestes: () => void;
};

/** O documento onde está o `#loginScreen` (o real ou um de teste). */
export type DocumentoDaEntrada = Pick<Document, "getElementById">;

/** A configuração que o legado repassa a `definirMarcaDaConfiguracao`. */
export type ConfiguracaoDaMarca = {
  valores?: Readonly<Record<string, string | null | undefined>>;
  carregou?: boolean;
  chaves?: ReadonlySet<string>;
};

const RODAPE_VAZIO: Readonly<RodapeDaEntrada> = Object.freeze({
  nome: "",
  logoUrl: "",
  funcao: "",
  versao: "",
  departamento: "",
});

export const MARCA_INICIAL: Readonly<IdentidadeDaEntrada> = Object.freeze({
  logoUrl: DEFAULT_ACCESS_BRANDING.logoUrl,
  saudacao: DEFAULT_ACCESS_BRANDING.greeting,
  textoDoBotao: "",
  rodape: RODAPE_VAZIO,
  /*
    Já se sabe qual é a marca (havia cópia guardada, a busca pública terminou
    ou a configuração chegou)? Até lá a tela não mostra o texto do botão:
    mostrar o padrão e trocar pelo configurado fazia o rótulo pular.
  */
  resolvida: false,
});

/** `url("…")` seguro: aspas e barras invertidas quebrariam a declaração CSS. */
function comoUrlCss(valor: unknown): string {
  return `url("${String(valor).replace(/["\\]/g, "")}")`;
}

/*
  A arte na tela, nas versões leves (enderecosDaArteNaTela): a nítida nas
  duas camadas e a miniatura no fundo desfocado. A medida (proporção e cor)
  é da nítida, a mesma que o script do <head> procura no cache.
*/
function aplicarArte(
  tela: { style: { setProperty(nome: string, valor: string): void } },
  url: string,
): void {
  const { nitida, desfocada } = enderecosDaArteNaTela(url);
  tela.style.setProperty("--login-background-image", comoUrlCss(nitida));
  tela.style.setProperty(
    "--login-background-image-desfocada",
    comoUrlCss(desfocada),
  );
  medirArte(tela, nitida);
}

const texto = (valor: unknown): string => String(valor ?? "").trim();

/** O estado da marca: `obter()`, `assinar(ouvinte)` e as escritas. */
/** O que a medida da arte usa de uma imagem (o `Image` do navegador). */
export type ImagemMedivel = {
  onload: ((evento: Event) => unknown) | null;
  onerror?: ((evento: Event | string) => unknown) | null;
  crossOrigin?: string | null;
  src: string;
  naturalWidth: number;
  naturalHeight: number;
};

/** A medida da arte que vai para o cache (access-branding-cache.ts). */
export type MedidaDaArte = {
  arteMedidaDe: string;
  arteProporcao: string;
  arteCor?: string;
};

const hex2 = (valor: number) => Math.round(valor).toString(16).padStart(2, "0");

/**
 * A cor média da borda esquerda da arte (o quarto da esquerda, onde fica o
 * cartão), em hex. Precisa de canvas e de imagem com CORS; sem um dos dois,
 * nulo (a tela fica no fundo padrão até a arte aparecer).
 */
export function corDaBordaDaArte(imagem: ImagemMedivel): string | null {
  try {
    if (
      typeof HTMLImageElement === "undefined" ||
      !(imagem instanceof HTMLImageElement)
    )
      return null;
    const canvas = globalThis.document?.createElement("canvas");
    const contexto = canvas?.getContext("2d");
    if (!canvas || !contexto) return null;
    canvas.width = 16;
    canvas.height = 9;
    contexto.drawImage(imagem, 0, 0, 16, 9);
    const dados = contexto.getImageData(0, 0, 4, 9).data;
    const soma = [0, 0, 0];
    for (let i = 0; i < dados.length; i += 4)
      for (let canal = 0; canal < 3; canal += 1)
        soma[canal] = (soma[canal] ?? 0) + (dados[i + canal] ?? 0);
    const pixels = dados.length / 4;
    if (!pixels) return null;
    return `#${soma.map((total) => hex2(total / pixels)).join("")}`;
  } catch {
    return null;
  }
}

/**
 * Mede a arte de acesso quando ela carrega: a proporção vai para
 * `--login-arte-proporcao` (largura ÷ altura), que platform-shell.css usa para
 * saber onde a arte nítida termina (11/11/2026; sem medida, 16:9), e a cor da
 * borda esquerda para `--login-arte-cor`, o fundo da tela enquanto a arte não
 * aparece. As duas são guardadas com o endereço medido, e o script do
 * index.html as aplica no primeiro quadro da próxima visita (13/11/2026: a
 * tela começava clara e com a arte fora do lugar, e piscava).
 *
 * A imagem é pedida com CORS, para a cor; se o servidor da arte não aceitar,
 * mede de novo sem CORS, só a proporção.
 */
export function medirArte(
  tela:
    | { style: { setProperty(nome: string, valor: string): void } }
    | null
    | undefined,
  url: string | null | undefined,
  {
    criarImagem = () => (typeof Image === "function" ? new Image() : null),
    lerCor = corDaBordaDaArte,
    guardar = (medida: MedidaDaArte) => void guardarMarca(medida),
  }: {
    criarImagem?: () => ImagemMedivel | null;
    lerCor?: (imagem: ImagemMedivel) => string | null;
    guardar?: (medida: MedidaDaArte) => void;
  } = {},
): void {
  const endereco = String(url ?? "").trim();
  if (!tela || !endereco) return;
  const medir = (comCors: boolean) => {
    const imagem = criarImagem();
    if (!imagem) return;
    if (comCors) imagem.crossOrigin = "anonymous";
    imagem.onload = () => {
      const { naturalWidth: largura, naturalHeight: altura } = imagem;
      if (!(largura > 0 && altura > 0)) return;
      const proporcao = (largura / altura).toFixed(4);
      tela.style.setProperty("--login-arte-proporcao", proporcao);
      const cor = comCors ? lerCor(imagem) : null;
      if (cor) tela.style.setProperty("--login-arte-cor", cor);
      guardar({
        arteMedidaDe: endereco,
        arteProporcao: proporcao,
        ...(cor ? { arteCor: cor } : {}),
      });
    };
    if (comCors) imagem.onerror = () => medir(false);
    imagem.src = endereco;
  };
  medir(true);
}

export function criarMarcaDaEntrada(): EstadoDaMarcaDaEntrada {
  let atual: Readonly<IdentidadeDaEntrada> = MARCA_INICIAL;
  const ouvintes = new Set<() => void>();
  const definir = (parcial: Partial<IdentidadeDaEntrada>) => {
    atual = { ...atual, ...parcial };
    ouvintes.forEach((ouvinte) => ouvinte());
  };
  return {
    obter: () => atual,
    assinar(ouvinte) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
    definir,
    reiniciarParaTestes: () => definir(MARCA_INICIAL),
  };
}

export const marcaDaEntrada = criarMarcaDaEntrada();

/*
  Aplicar a cor do painel é, sempre, aplicar também o contraste: a classe
  `login-panel-dark` sai de `corDoTextoPara(cor, modo)` toda vez que a cor é
  aplicada. Com `auto`, que é o padrão, a luminância decide; "claro" e
  "escuro" são escolha de identidade (quem escolhe vê o número em
  Configurações antes de salvar).
*/
export function aplicarCorDoPainel(
  tela: HTMLElement | null | undefined,
  cor: string | null | undefined,
  modo: string = MODO_AUTO,
): boolean {
  if (!tela || !cor) return false;
  tela.style.setProperty("--login-panel-color", cor);
  tela.classList.toggle(
    "login-panel-dark",
    corDoTextoPara(cor, modo) === TEXTO_CLARO,
  );
  return true;
}

/*
  O estilo do painel (Configurações › Tela de acesso): `login-panel-vidro` no
  `#loginScreen` deixa o painel translúcido sobre a arte (platform-shell.css).
  Sem estilo, ou com qualquer outro valor, sólido.
*/
export function aplicarEstiloDoPainel(
  tela: HTMLElement | null | undefined,
  estilo: unknown,
): void {
  tela?.classList.toggle(
    "login-panel-vidro",
    normalizarEstilo(estilo) === ESTILO_VIDRO,
  );
}

/*
  A cor no vidro e o desfoque da arte (Configurações › Aparência, 13/11/2026)
  viram `--vidro-cor` e `--vidro-desfoque` no `#loginScreen`, que
  platform-shell.css usa no painel de vidro.
*/
export function aplicarAjusteDoVidro(
  tela:
    | { style: { setProperty(nome: string, valor: string): void } }
    | null
    | undefined,
  corNoVidro: unknown,
  desfoque: unknown,
): void {
  if (!tela) return;
  tela.style.setProperty(
    "--vidro-cor",
    `${porcentagemDaCorNoVidro(corNoVidro)}%`,
  );
  tela.style.setProperty(
    "--vidro-desfoque",
    `${DESFOQUE_DO_VIDRO_EM_PX[normalizarDesfoqueDoVidro(desfoque)]}px`,
  );
}

/**
 * Aplica uma marca (campos do cache: backgroundUrl, panelColor, textoModo, painelEstilo,
 * logoUrl, greeting, buttonText). Cada campo é opcional; o que falta fica como
 * está. Os campos entram juntos: aplicar só a arte e a cor produzia tela
 * híbrida — o fundo de uma configuração com a saudação e o logotipo de outra.
 * @returns {boolean} `true` se algo chegou a ser aplicado.
 */
export function aplicarMarcaNaTela(
  marca: MarcaGuardada | null | undefined,
  documento: DocumentoDaEntrada | null | undefined = globalThis.document,
  estado: EstadoDaMarcaDaEntrada = marcaDaEntrada,
): boolean {
  if (!marca) return false;

  const tela = documento?.getElementById?.("loginScreen");
  if (tela && marca.backgroundUrl) aplicarArte(tela, marca.backgroundUrl);
  if (tela) aplicarCorDoPainel(tela, marca.panelColor, marca.textoModo);
  if (tela && marca.painelEstilo)
    aplicarEstiloDoPainel(tela, marca.painelEstilo);
  if (tela && (marca.vidroCor || marca.vidroDesfoque))
    aplicarAjusteDoVidro(tela, marca.vidroCor, marca.vidroDesfoque);

  const parcial: Partial<IdentidadeDaEntrada> = {};
  if (marca.logoUrl) parcial.logoUrl = marca.logoUrl;
  if (marca.greeting) parcial.saudacao = marca.greeting;
  if (marca.buttonText) parcial.textoDoBotao = marca.buttonText;
  if (Object.keys(parcial).length) estado.definir(parcial);

  return Boolean(tela) || Object.keys(parcial).length > 0;
}

export function aplicarMarcaGuardadaNoArranque(
  documento: DocumentoDaEntrada | null | undefined = globalThis.document,
  estado: EstadoDaMarcaDaEntrada = marcaDaEntrada,
): boolean {
  const guardada = lerMarcaGuardada();
  if (guardada) estado.definir({ resolvida: true });
  return aplicarMarcaNaTela(guardada, documento, estado);
}

let marcaPedida: Promise<boolean> | null = null;

/** A busca pública, no máximo uma vez por página (a tela de acesso apareceu). */
export function atualizarMarcaUmaVez(): Promise<boolean> {
  marcaPedida ??= atualizarMarcaComBrandingPublico();
  return marcaPedida;
}

/**
 * Busca a identidade atual e aplica-a, guardando-a para a próxima visita.
 * Falhar aqui é inofensivo por construção: nada é aplicado e nada é guardado.
 */
export async function atualizarMarcaComBrandingPublico(
  documento: DocumentoDaEntrada | null | undefined = globalThis.document,
  estado: EstadoDaMarcaDaEntrada = marcaDaEntrada,
): Promise<boolean> {
  const marca = await buscarMarcaPublica();
  /* Respondeu ou falhou, a espera acabou: a tela mostra o que tiver. */
  if (!estado.obter().resolvida) estado.definir({ resolvida: true });
  if (!marca) return false;

  /*
    Aplica o resultado da mescla, não a resposta crua. A resposta pública não
    carrega todos os campos que a tela conhece — aplicar só ela reverteria os
    ausentes para o padrão, que é o mesmo efeito que a mescla no cache existe
    para evitar.
  */
  const completa = guardarMarca(marca) || marca;
  return aplicarMarcaNaTela(completa, documento, estado);
}

/**
 * A configuração completa (TB_CONFIGURACAO), que o legado carrega e repassa
 * aqui a cada `loadConfig`.
 *
 * A identidade só é tocada quando veio do banco: exige-se prova dupla — a
 * configuração carregou (`carregou`) **e** a chave veio mesmo na resposta
 * (`chaves`). O caminho de erro do `loadConfig()` chega aqui com a
 * configuração vazia; sem a prova, os normalizadores devolveriam os padrões e
 * `guardarMarca()` os gravaria como se fossem a identidade da instituição,
 * contaminando a inicialização seguinte. O rodapé institucional é desenhado
 * com o que houver.
 */
export function definirMarcaDaConfiguracao(
  {
    valores = {},
    carregou = false,
    chaves = new Set<string>(),
  }: ConfiguracaoDaMarca = {},
  documento: DocumentoDaEntrada | null | undefined = globalThis.document,
  estado: EstadoDaMarcaDaEntrada = marcaDaEntrada,
): void {
  const valor = (chave: string) => texto(valores[chave]);
  const doBanco = (chave: string): string | null =>
    carregou && chaves.has(chave) ? (valores[chave] ?? "") : null;

  const fundoDoBanco = doBanco("auth_access_background_url");
  const painelDoBanco = doBanco("auth_access_panel_color");
  const logoDoBanco = doBanco("auth_access_logo_url");
  const saudacaoDoBanco = doBanco("auth_access_greeting");
  const estiloDoBanco = doBanco("auth_access_painel_estilo");
  const vidroCorDoBanco = doBanco("auth_access_vidro_cor");
  const vidroDesfoqueDoBanco = doBanco("auth_access_vidro_desfoque");

  const tela = documento?.getElementById?.("loginScreen");
  const marcaParaGuardar: MarcaGuardada = {};
  const parcial: Partial<IdentidadeDaEntrada> = {};

  if (tela && fundoDoBanco !== null) {
    const url = normalizeAccessBackgroundUrl(fundoDoBanco);
    aplicarArte(tela, url);
    marcaParaGuardar.backgroundUrl = url;
  }

  if (tela && painelDoBanco !== null) {
    const cor = normalizeAccessPanelColor(painelDoBanco);
    const modo = normalizarModo(valor("auth_access_texto_modo"));
    aplicarCorDoPainel(tela, cor, modo);
    marcaParaGuardar.panelColor = cor;
    marcaParaGuardar.textoModo = modo;
  }

  if (tela && estiloDoBanco !== null) {
    const estilo = normalizarEstilo(estiloDoBanco);
    aplicarEstiloDoPainel(tela, estilo);
    marcaParaGuardar.painelEstilo = estilo;
  }

  if (tela && (vidroCorDoBanco !== null || vidroDesfoqueDoBanco !== null)) {
    const corNoVidro = normalizarCorNoVidro(vidroCorDoBanco);
    const desfoque = normalizarDesfoqueDoVidro(vidroDesfoqueDoBanco);
    aplicarAjusteDoVidro(tela, corNoVidro, desfoque);
    marcaParaGuardar.vidroCor = corNoVidro;
    marcaParaGuardar.vidroDesfoque = desfoque;
  }

  if (logoDoBanco !== null) {
    const logo = normalizeAccessLogoUrl(logoDoBanco);
    parcial.logoUrl = logo;
    marcaParaGuardar.logoUrl = logo;
  }

  if (saudacaoDoBanco !== null) {
    const saudacao = saudacaoDoBanco || DEFAULT_ACCESS_BRANDING.greeting;
    parcial.saudacao = saudacao;
    marcaParaGuardar.greeting = saudacao;
  }

  parcial.rodape = {
    nome: valor("cogip_nome"),
    logoUrl: valor("cogip_logo_url"),
    funcao: valor("cogip_funcao"),
    versao: valor("cogip_versao"),
    departamento: valor("cogip_dept") || valor("footer_text"),
  };
  parcial.resolvida = true;
  estado.definir(parcial);

  /*
    Guarda os campos juntos, e só os que vieram do banco. Guardar apenas
    fundo e cor produzia tela híbrida: arte de uma configuração com
    saudação de outra.
  */
  if (Object.keys(marcaParaGuardar).length) guardarMarca(marcaParaGuardar);
}

/*
  O `#loginScreen` já existe quando este módulo é avaliado (src/main.ts é
  `type="module"`, portanto adiado até o HTML ser analisado); o
  `DOMContentLoaded` cobre quem o importar antes disso.
*/
if (typeof document !== "undefined") {
  if (!document.getElementById("loginScreen")) {
    document.addEventListener(
      "DOMContentLoaded",
      () => aplicarMarcaGuardadaNoArranque(),
      { once: true },
    );
  } else {
    aplicarMarcaGuardadaNoArranque();
  }

  /*
    A busca não é aguardada: o primeiro quadro já foi pintado com o que havia, e
    esta chamada apenas o corrige quando a resposta chega. Com sessão guardada a
    tela de acesso não aparece: quem pede é ela, se aparecer.
  */
  if (!document.documentElement?.classList.contains("sessao-guardada"))
    void atualizarMarcaUmaVez();
}
