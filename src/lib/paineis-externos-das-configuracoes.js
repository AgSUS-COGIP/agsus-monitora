/*
  Configurações › Painéis externos, sem DOM: os painéis que o legado lê da
  TB_PAINEL_EXTERNO (`loadPanels`), o rascunho das edições, as linhas que a
  publicação envia em `p_paineis` (salvar_configuracoes_e_paineis_v2), a
  validação e a situação de cada painel. O estado é de
  src/componentes/configuracoes/estado.js; a tela, de paineis-externos.jsx.

  A RPC só atualiza painéis que já existem (por id) e só quatro colunas:
  titulo, url, ativo e em_manutencao. Por isso a linha enviada tem esses
  campos e o id, no mesmo formato do antigo `collectPanelRows`
  (src/modules/config-ui.js, removido).
*/

import { urlHttpValida } from "./publicacao-de-configuracoes.js";

const txt = (valor) => String(valor ?? "").trim();

export const CAMPOS_EDITAVEIS_DO_PAINEL = Object.freeze([
  "titulo",
  "url",
  "ativo",
  "em_manutencao",
]);

/**
 * Painéis carregados como a tela os mostra: textos aparados, `ativo` só é
 * falso quando o banco diz `false`, manutenção só quando verdadeira. `nome`
 * é o rótulo fixo do painel (título carregado, código ou "painel").
 */
export function normalizarPaineis(lista) {
  return (Array.isArray(lista) ? lista : []).map((painel) => ({
    id: txt(painel?.id),
    codigo: txt(painel?.codigo),
    titulo: txt(painel?.titulo),
    url: txt(painel?.url),
    ativo: painel?.ativo !== false,
    em_manutencao: Boolean(painel?.em_manutencao),
    nome: txt(painel?.titulo) || txt(painel?.codigo) || "painel",
  }));
}

const igual = (campo, a, b) =>
  campo === "ativo" || campo === "em_manutencao"
    ? Boolean(a) === Boolean(b)
    : txt(a) === txt(b);

/**
 * Rascunho (Map id → { campo: valor }) depois de mudar `campo` de um painel.
 * Voltar ao valor carregado tira o campo; painel sem campo alterado sai.
 */
export function mudarRascunhoDoPainel(rascunho, paineis, id, campo, valor) {
  const novo = new Map(rascunho);
  const carregado = paineis.find((painel) => painel.id === id);
  if (!carregado || !CAMPOS_EDITAVEIS_DO_PAINEL.includes(campo)) return novo;
  const alteracoes = { ...(novo.get(id) || {}) };
  if (igual(campo, carregado[campo], valor)) delete alteracoes[campo];
  else alteracoes[campo] = valor;
  if (Object.keys(alteracoes).length) novo.set(id, alteracoes);
  else novo.delete(id);
  return novo;
}

/** Os painéis com o rascunho aplicado. */
export function paineisComRascunho(paineis, rascunho) {
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
export function linhasDosPaineis(paineis) {
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

/** Chave do erro do endereço de um painel em `errosDosCampos`. */
export const chaveDoErroDoPainel = (id) => `painel:${id}:url`;

/** Erros dos painéis: Map chave → mensagem (as mensagens são as de antes). */
export function errosDosPaineis(paineis) {
  const erros = new Map();
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
export function situacaoDoPainel({ ativo, em_manutencao, url }) {
  if (!ativo) return "inativo";
  if (em_manutencao) return "manutencao";
  return txt(url) ? "ativo" : "semUrl";
}

export const SELO_DA_SITUACAO = Object.freeze({
  inativo: Object.freeze({ rotulo: "Inativo", tom: "danger" }),
  manutencao: Object.freeze({ rotulo: "Manutenção", tom: "warn" }),
  ativo: Object.freeze({ rotulo: "Ativo", tom: "ok" }),
  semUrl: Object.freeze({ rotulo: "Sem URL", tom: "neutral" }),
});

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
