/*
  Configurações › Painéis externos, sem DOM: os painéis que o legado lê da
  TB_PAINEL_EXTERNO (`loadPanels`), o rascunho das edições, as linhas que a
  publicação envia em `p_paineis` (salvar_configuracoes_e_paineis_v2), a
  validação e a situação de cada painel. O estado é de
  src/modulos/configuracoes/estado.ts; a tela, de paineis-externos.tsx.

  A RPC só atualiza painéis que já existem (por id) e só quatro colunas:
  titulo, url, ativo e em_manutencao. Por isso a linha enviada tem esses
  campos e o id, no mesmo formato do antigo `collectPanelRows`
  (src/modules/config-ui.js, removido).
*/

import { urlHttpValida } from "./publicacao-de-configuracoes.ts";

const txt = (valor: unknown): string => String(valor ?? "").trim();

/** Linha da TB_PAINEL_EXTERNO como o banco a devolve (loadPanels e o retrato). */
export interface LinhaDePainelNoBanco {
  id: string | number;
  codigo?: string | null;
  titulo?: string | null;
  url?: string | null;
  ativo?: boolean | null;
  em_manutencao?: boolean | null;
}

/** Painel externo como a tela o mostra (`normalizarPaineis`). */
export interface PainelExterno {
  id: string;
  codigo: string;
  titulo: string;
  url: string;
  ativo: boolean;
  em_manutencao: boolean;
  /** Rótulo fixo do painel: título carregado, código ou "painel". */
  nome: string;
}

/** Os campos do painel que a RPC atualiza. */
export type CampoEditavelDoPainel =
  "titulo" | "url" | "ativo" | "em_manutencao";

/** Valor de um campo editável: texto (título, URL) ou interruptor. */
export type ValorDoCampoDoPainel = string | boolean;

/** As alterações de um painel no rascunho. */
export type AlteracoesDoPainel = Partial<
  Pick<PainelExterno, CampoEditavelDoPainel>
>;

/** Rascunho dos painéis: Map id → alterações. */
export type RascunhoDosPaineis = Map<string, AlteracoesDoPainel>;

/** Linha de `p_paineis` (salvar_configuracoes_e_paineis_v2). */
export interface LinhaDoPainel {
  id: string;
  titulo: string;
  url: string;
  ativo: boolean;
  em_manutencao: boolean;
}

/** Situação do painel no selo da tabela. */
export type SituacaoDoPainel = "inativo" | "manutencao" | "ativo" | "semUrl";

/** Contagem dos painéis por situação, mais o total. */
export type ResumoDosPaineis = Record<SituacaoDoPainel | "total", number>;

export const CAMPOS_EDITAVEIS_DO_PAINEL: readonly CampoEditavelDoPainel[] =
  Object.freeze(["titulo", "url", "ativo", "em_manutencao"]);

/**
 * Painéis carregados como a tela os mostra: textos aparados, `ativo` só é
 * falso quando o banco diz `false`, manutenção só quando verdadeira. `nome`
 * é o rótulo fixo do painel (título carregado, código ou "painel").
 */
export function normalizarPaineis(lista: unknown): PainelExterno[] {
  return (Array.isArray(lista) ? lista : []).map(
    (painel: LinhaDePainelNoBanco | null | undefined) => ({
      id: txt(painel?.id),
      codigo: txt(painel?.codigo),
      titulo: txt(painel?.titulo),
      url: txt(painel?.url),
      ativo: painel?.ativo !== false,
      em_manutencao: Boolean(painel?.em_manutencao),
      nome: txt(painel?.titulo) || txt(painel?.codigo) || "painel",
    }),
  );
}

const ehCampoEditavel = (campo: string): campo is CampoEditavelDoPainel =>
  (CAMPOS_EDITAVEIS_DO_PAINEL as readonly string[]).includes(campo);

const igual = (campo: string, a: unknown, b: unknown): boolean =>
  campo === "ativo" || campo === "em_manutencao"
    ? Boolean(a) === Boolean(b)
    : txt(a) === txt(b);

/**
 * Rascunho (Map id → { campo: valor }) depois de mudar `campo` de um painel.
 * Voltar ao valor carregado tira o campo; painel sem campo alterado sai.
 */
export function mudarRascunhoDoPainel(
  rascunho: ReadonlyMap<string, AlteracoesDoPainel>,
  paineis: readonly PainelExterno[],
  id: string,
  campo: string,
  valor: ValorDoCampoDoPainel,
): RascunhoDosPaineis {
  const novo = new Map(rascunho);
  const carregado = paineis.find((painel) => painel.id === id);
  if (!carregado || !ehCampoEditavel(campo)) return novo;
  const alteracoes: Partial<
    Record<CampoEditavelDoPainel, ValorDoCampoDoPainel>
  > = { ...(novo.get(id) || {}) };
  if (igual(campo, carregado[campo], valor)) delete alteracoes[campo];
  else alteracoes[campo] = valor;
  // O valor vem da tela com o tipo do campo (texto ou interruptor).
  if (Object.keys(alteracoes).length)
    novo.set(id, alteracoes as AlteracoesDoPainel);
  else novo.delete(id);
  return novo;
}

/** Os painéis com o rascunho aplicado. */
export function paineisComRascunho(
  paineis: readonly PainelExterno[],
  rascunho: ReadonlyMap<string, AlteracoesDoPainel>,
): PainelExterno[] {
  return paineis.map((painel) =>
    rascunho.has(painel.id)
      ? { ...painel, ...rascunho.get(painel.id) }
      : painel,
  );
}

/**
 * `p_paineis`: [{ id, titulo, url, ativo, em_manutencao }], na ordem da
 * tela, só painéis com id (o que o `collectPanelRows` produzia).
 */
export function linhasDosPaineis(
  paineis: readonly PainelExterno[],
): LinhaDoPainel[] {
  return paineis
    .filter((painel) => txt(painel.id))
    .map((painel) => ({
      id: txt(painel.id),
      titulo: txt(painel.titulo),
      url: txt(painel.url),
      ativo: Boolean(painel.ativo),
      em_manutencao: Boolean(painel.em_manutencao),
    }));
}

/**
 * `p_paineis` só dos painéis que a pessoa mudou, a partir do que está no
 * banco agora (`paineisDoBanco`, do get_configuracoes_snapshot) com os
 * campos do rascunho por cima: os outros painéis e os campos não mexidos
 * ficam como outro administrador os deixou.
 */
export function linhasDosPaineisAlterados(
  paineisDoBanco: unknown,
  rascunho: ReadonlyMap<string, AlteracoesDoPainel>,
): LinhaDoPainel[] {
  const banco = normalizarPaineis(paineisDoBanco);
  return linhasDosPaineis(
    banco
      .filter((painel) => rascunho.has(painel.id))
      .map((painel) => ({ ...painel, ...rascunho.get(painel.id) })),
  );
}

/** Chave do erro do endereço de um painel em `errosDosCampos`. */
export const chaveDoErroDoPainel = (id: string): string => `painel:${id}:url`;

/** Erros dos painéis: Map chave → mensagem (as mensagens são as de antes). */
export function errosDosPaineis(
  paineis: readonly PainelExterno[],
): Map<string, string> {
  const erros = new Map<string, string>();
  for (const painel of paineis) {
    const chave = chaveDoErroDoPainel(painel.id);
    if (!urlHttpValida(painel.url))
      erros.set(
        chave,
        `URL inválida no campo Endereço do painel ${painel.nome}: use https:// ou http://.`,
      );
    else if (painel.ativo && !txt(painel.url))
      erros.set(chave, "Painéis ativos precisam de uma URL configurada.");
  }
  return erros;
}

/**
 * Situação do painel, na regra do selo da tabela: inativo > manutenção >
 * ativo com URL > sem URL.
 */
export function situacaoDoPainel({
  ativo,
  em_manutencao,
  url,
}: Pick<PainelExterno, "ativo" | "em_manutencao" | "url">): SituacaoDoPainel {
  if (!ativo) return "inativo";
  if (em_manutencao) return "manutencao";
  return txt(url) ? "ativo" : "semUrl";
}

export const SELO_DA_SITUACAO = Object.freeze({
  inativo: Object.freeze({ rotulo: "Inativo", tom: "reprovado" }),
  manutencao: Object.freeze({ rotulo: "Manutenção", tom: "pendente" }),
  ativo: Object.freeze({ rotulo: "Ativo", tom: "aprovado" }),
  semUrl: Object.freeze({ rotulo: "Sem URL", tom: "neutro" }),
});

export function resumoDosPaineis(
  paineis: readonly PainelExterno[] = [],
): ResumoDosPaineis {
  const resumo: ResumoDosPaineis = {
    total: paineis.length,
    ativo: 0,
    manutencao: 0,
    inativo: 0,
    semUrl: 0,
  };
  for (const painel of paineis) resumo[situacaoDoPainel(painel)] += 1;
  return resumo;
}
