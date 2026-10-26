/*
  Comemorações do MONITORA, sem DOM: a regra de QUANDO comemorar e O QUE dizer.
  O desenho (fogos de artifício em <canvas>, a Aya voando e o aviso) é de
  src/modules/comemoracao.js; o roteiro e a física dos fogos, de src/lib/fogos.ts
  (com a cena em fogos-cena.ts e o marco desenhado no céu em fogos-formas.ts).
  Cada comemoração diz que FORMA o estouro do marco desenha: coração (edital
  100% analisado), estrela (fila zerada), o número (marco do ano), visto
  (acesso liberado).

  Comemora-se o PROCESSO e a EQUIPE, nunca uma pessoa (nada de ranking):
    - edital 100% analisado e fila de análises zerada (painel de análises);
    - vaga pronta para o resultado final (painel de entrevistas);
    - marcos do ano da área (1.000, 2.500, 5.000, 7.500, 10.000 e, dali em
      diante, a cada 5.000 análises concluídas);
    - o acesso liberado (src/lib/acesso-liberado.ts).

  Liga/desliga global: `sistema.comemoracoes` de obter_situacao_do_sistema
  (Configurações › Módulos e abas › Sistema inteiro). Sem resposta, desligado:
  comemoração nunca é motivo para travar nada, e na dúvida não aparece.

  LINHA DE BASE: só comemora TRANSIÇÃO vista por esta pessoa neste navegador.
  Na primeira vez que um tipo de marco é avaliado para o usuário e a área, o
  estado atual é guardado em silêncio (localStorage); a comemoração vem quando
  uma leitura seguinte mostra a mudança. Assim, publicar a novidade não solta
  dezenas de fogos pelo que já estava concluído. Guardar o estado novo
  depois de comemorar faz cada marco aparecer uma vez por pessoa.

  Armazenamento sempre em try/catch (janela privada, bloqueado): sem ele, não
  há linha de base e, portanto, nenhuma comemoração de marco.
*/

import { STATUS_PENDENTES } from "./status-da-analise.ts";

/* A duração dos fogos padrão ("cheio"); de 5 s ("pequeno") a 6 s ("festa"), em src/lib/fogos.ts. */
export const DURACAO_DOS_FOGOS_MS = 5500;
export const PREFIXO_DO_MARCO = "agsus_monitora_marco:";
/* Os marcos do ano; depois do último, a cada PASSO_DOS_MARCOS. */
export const MARCOS_DO_ANO = Object.freeze([1000, 2500, 5000, 7500, 10000]);
export const PASSO_DOS_MARCOS = 5000;

const texto = (valor: unknown): string => String(valor ?? "").trim();

/**
 * O armazenamento do navegador, no que estas regras usam. Sem `removeItem`,
 * apagar falha dentro do try e `gravarArmazenamento` devolve false.
 */
export type ArmazenamentoSimples = Pick<Storage, "getItem" | "setItem"> &
  Partial<Pick<Storage, "removeItem">>;

/** Linha do painel de análises, no que estas regras leem. */
export interface LinhaDaAnalise {
  edital?: unknown;
  unidade?: unknown;
  status_consolidado?: unknown;
}

export interface SituacaoDoEdital {
  edital: string;
  unidade: string;
  total: number;
  pendentes: number;
}

/** Entrevista ou aprovado sem entrevista, no que estas regras leem. */
export interface ItemDaVaga {
  edital?: unknown;
  vaga?: unknown;
  cargo?: unknown;
  parecer?: unknown;
}

export interface SituacaoDaVaga {
  vaga: string;
  cargo: string;
  edital: string;
  pronta: boolean;
}

/** Forma do último estouro dos fogos (src/lib/fogos-formas.ts). */
export interface FormaDoMarco {
  tipo: "numero";
  texto: string;
}

export interface ComemoracaoDasAnalises {
  texto: string;
  itens: string[];
  forma: "coracao" | "estrela";
  marco: "edital-concluido" | "fila-zerada";
  editais: string[];
}

export interface ComemoracaoDasEntrevistas {
  texto: string;
  itens: string[];
  marco: "vaga-pronta";
}

/** Marco do ano guardado: `{ ano, marco }`. */
export interface EstadoDoMarco {
  ano: number;
  marco: number;
}

// ── Armazenamento ───────────────────────────────────────────────────────────

export function lerArmazenamento(
  armazenamento: ArmazenamentoSimples | null | undefined,
  chave: string,
): string | null {
  try {
    return armazenamento?.getItem(chave) ?? null;
  } catch {
    return null;
  }
}

/** Grava (ou apaga, com `null`). Devolve se conseguiu. */
export function gravarArmazenamento(
  armazenamento: ArmazenamentoSimples | null | undefined,
  chave: string,
  valor: string | null,
): boolean {
  try {
    if (!armazenamento) return false;
    if (valor === null) armazenamento.removeItem!(chave);
    else armazenamento.setItem(chave, valor);
    return true;
  } catch {
    return false;
  }
}

/** A chave do estado guardado de um tipo de marco, por usuário e área. */
export function chaveDoMarco(
  tipo: unknown,
  usuarioId: unknown,
  area: unknown,
): string {
  return `${PREFIXO_DO_MARCO}${texto(tipo)}:${texto(usuarioId)}:${texto(area)}`;
}

/**
 * Compara o estado atual com o guardado e guarda o atual. Devolve o anterior,
 * ou `null` quando não havia (a linha de base acabou de ser gravada) ou não
 * há armazenamento — nos dois casos, nada a comemorar.
 */
export function trocarEstadoGuardado({
  armazenamento,
  chave,
  atual,
}: {
  armazenamento: ArmazenamentoSimples | null | undefined;
  chave: string;
  atual: unknown;
}): unknown {
  const bruto = lerArmazenamento(armazenamento, chave);
  let anterior: unknown = null;
  if (bruto !== null) {
    try {
      anterior = JSON.parse(bruto);
    } catch {
      anterior = null;
    }
  }
  const gravou = gravarArmazenamento(
    armazenamento,
    chave,
    JSON.stringify(atual),
  );
  return gravou ? anterior : null;
}

// ── Liga/desliga ────────────────────────────────────────────────────────────

/**
 * `sistema.comemoracoes` da resposta de obter_situacao_do_sistema. Resposta
 * sem o objeto `sistema` (falha, sem sessão) desliga; `sistema` sem o campo
 * (banco anterior à migration 20260930150000) vale o padrão do banco: ligado.
 */
export function comemoracoesLigadasNaResposta(dados: unknown): boolean {
  if (!dados || typeof dados !== "object" || Array.isArray(dados)) return false;
  const sistema = (dados as { sistema?: unknown }).sistema;
  if (!sistema || typeof sistema !== "object") return false;
  return (sistema as { comemoracoes?: unknown }).comemoracoes !== false;
}

// ── Painel de análises: edital concluído e fila zerada ──────────────────────

/*
  Ainda sem decisão: "Pendente" (ou sem status) e "Em análise" (a ficha da
  Avaliação documental aberta por alguém). A mesma regra do KPI "Pendentes"
  (STATUS_PENDENTES): o edital só está 100% analisado, e a fila só zera,
  quando a última ficha aberta é concluída, não quando é pega.
*/
export const analisePendente = (
  linha: LinhaDaAnalise | null | undefined,
): boolean =>
  STATUS_PENDENTES.includes(texto(linha?.status_consolidado) || "Pendente");

const chaveDoEdital = (linha: LinhaDaAnalise | null | undefined): string =>
  `${texto(linha?.edital)}|${texto(linha?.unidade)}`;

/**
 * Por edital (número + unidade): total de análises e quantas estão
 * pendentes. `{ [chave]: { edital, unidade, total, pendentes } }`.
 */
export function situacaoDosEditais(
  linhas: unknown,
): Record<string, SituacaoDoEdital> {
  const mapa: Record<string, SituacaoDoEdital> = {};
  for (const linha of (Array.isArray(linhas)
    ? linhas
    : []) as (LinhaDaAnalise | null)[]) {
    if (!texto(linha?.edital)) continue;
    const chave = chaveDoEdital(linha);
    mapa[chave] ??= {
      edital: texto(linha!.edital),
      unidade: texto(linha!.unidade),
      total: 0,
      pendentes: 0,
    };
    mapa[chave]!.total += 1;
    if (analisePendente(linha)) mapa[chave]!.pendentes += 1;
  }
  return mapa;
}

/** O que se guarda dos editais: `{ [chave]: pendentes }`. */
export function estadoGuardadoDosEditais(
  situacao: Readonly<Record<string, SituacaoDoEdital>> | null | undefined,
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(situacao || {}).map(([chave, e]) => [chave, e.pendentes]),
  );
}

/**
 * Os editais que TINHAM pendências na leitura anterior e agora não têm
 * nenhuma (com pelo menos uma análise). Edital que não estava na leitura
 * anterior não conta: não houve transição vista.
 */
export function editaisConcluidos(
  anterior: unknown,
  situacao: Readonly<Record<string, SituacaoDoEdital>> | null | undefined,
): SituacaoDoEdital[] {
  if (!anterior || typeof anterior !== "object") return [];
  return Object.entries(situacao || {})
    .filter(
      ([chave, e]) =>
        Number((anterior as Record<string, unknown>)[chave]) > 0 &&
        e.total >= 1 &&
        e.pendentes === 0,
    )
    .map(([, e]) => e);
}

export const pendentesDaFila = (linhas: unknown): number =>
  ((Array.isArray(linhas) ? linhas : []) as (LinhaDaAnalise | null)[]).filter(
    analisePendente,
  ).length;

/** A fila foi de >0 pendentes para 0 (com a leitura anterior conhecida). */
export function filaZerou(anterior: unknown, pendentes: number): boolean {
  return Number(anterior) > 0 && pendentes === 0;
}

export function mensagemDoEditalConcluido({
  edital,
  unidade,
}: {
  edital?: unknown;
  unidade?: unknown;
}): string {
  const nome = [texto(edital), texto(unidade)].filter(Boolean).join(" · ");
  return `Edital ${nome} concluído! 🎉 Todas as análises foram feitas.`;
}

/*
  "equipe da Saúde Indígena", "equipe da SEDE", "equipe de Projetos" — o
  agradecimento é sempre à equipe da área, nunca a uma pessoa.
*/
export function equipeDaArea(nomeDaArea: unknown): string {
  const nome = texto(nomeDaArea);
  if (!nome) return "equipe";
  return `equipe ${/^projetos$/i.test(nome) ? "de" : "da"} ${nome}`;
}

export function mensagemDaFilaZerada(nomeDaArea: unknown): string {
  return `Fila de análises zerada! Obrigado, ${equipeDaArea(nomeDaArea)}. 🎉`;
}

/**
 * O que o painel de análises comemora nesta leitura. `anterior` é
 * `{ editais, fila }` guardado (ou nulos, na linha de base). Devolve
 * `{ texto, itens, forma, marco, editais }` ou `null`: um aviso só, com os
 * demais editais na lista; `editais` são os textos dos editais concluídos
 * (a tela de encerramento sabe que os fogos deles já saíram).
 */
export function comemoracaoDasAnalises({
  anteriorEditais,
  anteriorFila,
  situacao,
  pendentes,
  nomeDaArea,
}: {
  anteriorEditais: unknown;
  anteriorFila: unknown;
  situacao: Readonly<Record<string, SituacaoDoEdital>> | null | undefined;
  pendentes: number;
  nomeDaArea: unknown;
}): ComemoracaoDasAnalises | null {
  const concluidos = editaisConcluidos(anteriorEditais, situacao);
  const zerou = filaZerou(anteriorFila, pendentes);
  const mensagens = [
    ...concluidos.map(mensagemDoEditalConcluido),
    ...(zerou ? [mensagemDaFilaZerada(nomeDaArea)] : []),
  ];
  if (!mensagens.length) return null;
  const [primeira, ...demais] = mensagens;
  return {
    texto: primeira!,
    itens: demais,
    forma: concluidos.length ? "coracao" : "estrela",
    // O id do catálogo (src/lib/catalogo-de-comemoracoes.ts).
    marco: concluidos.length ? "edital-concluido" : "fila-zerada",
    editais: concluidos.map((e) => e.edital),
  };
}

// ── Painel de entrevistas: vaga pronta ──────────────────────────────────────

const chaveDaVaga = (item: ItemDaVaga | null | undefined): string =>
  `${texto(item?.edital)}|${texto(item?.vaga)}`;

/**
 * Por vaga (edital + código): pronta quando tem entrevista, nenhum aprovado
 * na análise está sem entrevista e toda entrevista tem parecer.
 * `{ [chave]: { vaga, cargo, edital, pronta } }`.
 */
export function situacaoDasVagas({
  entrevistas,
  aprovadosSemEntrevista,
}: { entrevistas?: unknown; aprovadosSemEntrevista?: unknown } = {}): Record<
  string,
  SituacaoDaVaga
> {
  const mapa: Record<string, SituacaoDaVaga> = {};
  for (const e of (Array.isArray(entrevistas)
    ? entrevistas
    : []) as (ItemDaVaga | null)[]) {
    if (!texto(e?.vaga)) continue;
    const chave = chaveDaVaga(e);
    mapa[chave] ??= {
      vaga: texto(e!.vaga),
      cargo: texto(e!.cargo),
      edital: texto(e!.edital),
      pronta: true,
    };
    if (!mapa[chave]!.cargo && texto(e!.cargo))
      mapa[chave]!.cargo = texto(e!.cargo);
    if (texto(e!.parecer || "SEM_PARECER") === "SEM_PARECER")
      mapa[chave]!.pronta = false;
  }
  for (const a of (Array.isArray(aprovadosSemEntrevista)
    ? aprovadosSemEntrevista
    : []) as (ItemDaVaga | null)[]) {
    if (!texto(a?.vaga)) continue;
    const chave = chaveDaVaga(a);
    mapa[chave] ??= {
      vaga: texto(a!.vaga),
      cargo: texto(a!.cargo),
      edital: texto(a!.edital),
      pronta: false,
    };
    mapa[chave]!.pronta = false;
  }
  return mapa;
}

export function estadoGuardadoDasVagas(
  situacao: Readonly<Record<string, SituacaoDaVaga>> | null | undefined,
): Record<string, boolean> {
  return Object.fromEntries(
    Object.entries(situacao || {}).map(([chave, v]) => [chave, v.pronta]),
  );
}

/** As vagas que estavam incompletas na leitura anterior e agora estão prontas. */
export function vagasProntas(
  anterior: unknown,
  situacao: Readonly<Record<string, SituacaoDaVaga>> | null | undefined,
): SituacaoDaVaga[] {
  if (!anterior || typeof anterior !== "object") return [];
  return Object.entries(situacao || {})
    .filter(
      ([chave, v]) =>
        (anterior as Record<string, unknown>)[chave] === false && v.pronta,
    )
    .map(([, v]) => v);
}

export function mensagemDaVagaPronta({
  vaga,
  cargo,
}: {
  vaga?: unknown;
  cargo?: unknown;
}): string {
  const nome = [texto(vaga), texto(cargo)].filter(Boolean).join(" · ");
  return `Vaga ${nome} pronta para o resultado final.`;
}

export function comemoracaoDasEntrevistas({
  anterior,
  situacao,
}: {
  anterior: unknown;
  situacao: Readonly<Record<string, SituacaoDaVaga>> | null | undefined;
}): ComemoracaoDasEntrevistas | null {
  const prontas = vagasProntas(anterior, situacao);
  if (!prontas.length) return null;
  const [primeira, ...demais] = prontas.map(mensagemDaVagaPronta);
  return { texto: primeira!, itens: demais, marco: "vaga-pronta" };
}

// ── Marcos do ano ───────────────────────────────────────────────────────────

/** O maior marco já alcançado com `quantidade` (0 se nenhum). */
export function marcoAlcancado(quantidade: unknown): number {
  const n = Math.floor(Number(quantidade) || 0);
  const ultimo = MARCOS_DO_ANO.at(-1)!;
  if (n >= ultimo)
    return (
      ultimo + Math.floor((n - ultimo) / PASSO_DOS_MARCOS) * PASSO_DOS_MARCOS
    );
  return [...MARCOS_DO_ANO].reverse().find((marco) => n >= marco) || 0;
}

/**
 * O marco novo desta leitura, ou 0. `anterior` é `{ ano, marco }` guardado;
 * sem ele (primeira vez da pessoa), anuncia o marco já alcançado no ano — é
 * notícia da equipe, não uma pendência antiga (pedido de 30/09). Guardado de um ano
 * anterior: a contagem recomeçou, e o ano novo parte de zero para quem já
 * acompanhava.
 */
export function marcoNovo(
  anterior: unknown,
  { ano, quantidade }: { ano: unknown; quantidade: unknown },
): number {
  if (!anterior || typeof anterior !== "object")
    return marcoAlcancado(quantidade);
  const anoAnterior = Number((anterior as { ano?: unknown }).ano);
  if (anoAnterior > Number(ano)) return 0;
  const jaVisto =
    anoAnterior === Number(ano)
      ? Number((anterior as { marco?: unknown }).marco) || 0
      : 0;
  const atual = marcoAlcancado(quantidade);
  return atual > jaVisto ? atual : 0;
}

/**
 * O que guardar e o que comemorar numa leitura de obter_marcos_da_area.
 * `{ estado: { ano, marco }, novo }`: `novo` é o marco a anunciar (0 se
 * nenhum). O marco guardado nunca desce no mesmo ano (uma análise
 * desativada não faz o mesmo marco voltar).
 */
export function proximoEstadoDoMarco(
  anterior: unknown,
  { ano, quantidade }: { ano: unknown; quantidade: unknown },
): { estado: EstadoDoMarco; novo: number } {
  const alcancado = marcoAlcancado(quantidade);
  const mesmoAno =
    anterior &&
    typeof anterior === "object" &&
    Number((anterior as { ano?: unknown }).ano) === Number(ano);
  const guardado = mesmoAno
    ? Number((anterior as { marco?: unknown }).marco) || 0
    : 0;
  return {
    estado: { ano: Number(ano), marco: Math.max(alcancado, guardado) },
    novo: marcoNovo(anterior, { ano, quantidade }),
  };
}

export const formatarMarco = (numero: unknown): string =>
  Math.floor(Number(numero) || 0).toLocaleString("pt-BR");

export function mensagemDoMarcoDoAno({
  nomeDaArea,
  marco,
  ano,
}: {
  nomeDaArea: unknown;
  marco: unknown;
  ano: unknown;
}): string {
  return `🎉 A ${equipeDaArea(nomeDaArea)} passou de ${formatarMarco(marco)} análises concluídas em ${ano}!`;
}

/** O agradecimento dos fogos do marco do ano: "1.000 análises concluídas em 2026. Obrigado, equipe de Projetos!" */
export function agradecimentoDoMarco({
  nomeDaArea,
  marco,
  ano,
}: {
  nomeDaArea: unknown;
  marco: unknown;
  ano: unknown;
}): string {
  return `${formatarMarco(marco)} análises concluídas em ${ano}. Obrigado, ${equipeDaArea(nomeDaArea)}!`;
}

/** A forma do marco do ano no céu: o número ("1.000", "2.500"). */
export const formaDoMarco = (marco: unknown): FormaDoMarco => ({
  tipo: "numero",
  texto: formatarMarco(marco),
});
