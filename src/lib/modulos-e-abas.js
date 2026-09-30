/*
  Configurações › Módulos e abas, sem DOM: o rascunho das alterações e o que
  vai para `salvar_situacao_modulos(p_alteracoes, p_motivo)`.

  A árvore é a resposta de `obter_modulos_e_abas()` (só admin global):
  sistema, áreas (cada uma com as suas abas), abas (em todas as áreas),
  painéis externos e as 50 últimas mudanças. O desenho é de
  `src/componentes/modulos/`.

  Cada campo editável é identificado por um ALVO — `{ escopo, area?, aba?,
  painel? }`, com escopo em 'sistema' | 'area' | 'aba' | 'aba_area' | 'painel'
  — e um CAMPO ('ativo' | 'situacao' | 'mensagem' | 'previsao' | 'beta' |
  'comemoracoes'). Os valores ficam como o banco compara: 'S'/'N' em ativo,
  beta e comemoracoes, 'ATIVA'/
  'MANUTENCAO' em situação, '' para mensagem e previsão vazias.

  O rascunho guarda só o que difere do original: voltar um campo ao valor
  lido tira a alteração da lista.

  A situação que a tela mostra junta ativo e situação em três estados —
  'ativa', 'manutencao', 'desativada'. O sistema inteiro não desativa (só
  entra ou sai de manutenção); painel externo não tem mensagem nem previsão;
  o selo BETA é só da aba (em todas as áreas); ligar ou desligar as
  comemorações (marcos do processo) é só do sistema inteiro. São as regras do banco,
  repetidas aqui para a tela não oferecer o que vai ser recusado.
*/
import { dataDaPrevisao, formatarPrevisao } from "./situacao-dos-modulos.js";

export const ESTADOS = Object.freeze(["ativa", "manutencao", "desativada"]);
export const LIMITE_DA_MENSAGEM = 500;
export const MOTIVO_MINIMO = 3;
export const MOTIVO_MAXIMO = 500;

const texto = (valor) => String(valor ?? "").trim();
const sn = (booleano) => (booleano ? "S" : "N");
const situacaoDe = (valor) =>
  texto(valor).toUpperCase() === "MANUTENCAO" ? "MANUTENCAO" : "ATIVA";

export const temAtivo = (alvo) => alvo?.escopo !== "sistema";
export const temMensagem = (alvo) => alvo?.escopo !== "painel";

export function chaveDoCampo(alvo, campo) {
  return [
    alvo.escopo,
    alvo.area || "",
    alvo.aba || "",
    alvo.painel || "",
    campo,
  ].join("|");
}

/** Os valores lidos, por chave: `Map<chave, { alvo, campo, valor }>`. */
export function originaisDaArvore(arvore) {
  const originais = new Map();
  const guardar = (alvo, campo, valor) =>
    originais.set(chaveDoCampo(alvo, campo), { alvo, campo, valor });
  const guardarManutencao = (alvo, linha) => {
    guardar(alvo, "situacao", situacaoDe(linha?.situacao));
    guardar(alvo, "mensagem", texto(linha?.mensagem));
    guardar(alvo, "previsao", dataDaPrevisao(linha?.previsao) || "");
  };
  if (!arvore) return originais;

  guardarManutencao({ escopo: "sistema" }, arvore.sistema);
  // Sem o campo (banco anterior à migration 20260930150000): ligadas.
  guardar(
    { escopo: "sistema" },
    "comemoracoes",
    sn(arvore.sistema?.comemoracoes !== false),
  );
  for (const area of arvore.areas || []) {
    const alvo = { escopo: "area", area: area.co_area };
    guardar(alvo, "ativo", sn(area.ativo !== false));
    guardarManutencao(alvo, area);
    for (const aba of area.abas || []) {
      const naArea = {
        escopo: "aba_area",
        area: area.co_area,
        aba: aba.co_aba,
      };
      guardar(naArea, "ativo", sn(aba.ativo !== false));
      guardarManutencao(naArea, aba);
    }
  }
  for (const aba of arvore.abas || []) {
    const alvo = { escopo: "aba", aba: aba.co_aba };
    guardar(alvo, "ativo", sn(aba.ativo !== false));
    guardarManutencao(alvo, aba);
    guardar(alvo, "beta", sn(aba.beta === true));
  }
  for (const painel of arvore.paineis || []) {
    const alvo = { escopo: "painel", painel: painel.id };
    guardar(alvo, "ativo", sn(painel.ativo !== false));
    guardar(alvo, "situacao", painel.em_manutencao ? "MANUTENCAO" : "ATIVA");
  }
  return originais;
}

/** O valor em vigor na tela: o do rascunho, se houver; senão, o lido. */
export function valorDoCampo(rascunho, originais, alvo, campo) {
  const chave = chaveDoCampo(alvo, campo);
  if (rascunho.has(chave)) return rascunho.get(chave).valor;
  return originais.get(chave)?.valor ?? "";
}

const comparavel = (campo, valor) =>
  campo === "mensagem" || campo === "previsao" ? texto(valor) : valor;

/** Novo rascunho com o campo alterado (ou sem ele, se voltou ao lido). */
export function registrarCampo(rascunho, originais, alvo, campo, valor) {
  const chave = chaveDoCampo(alvo, campo);
  const proximo = new Map(rascunho);
  const original = originais.get(chave)?.valor ?? "";
  const novo = String(valor ?? "");
  if (comparavel(campo, novo) === comparavel(campo, original))
    proximo.delete(chave);
  else proximo.set(chave, { alvo, campo, valor: novo });
  return proximo;
}

/** 'ativa' | 'manutencao' | 'desativada', do que está em vigor na tela. */
export function estadoDoAlvo(rascunho, originais, alvo) {
  if (
    temAtivo(alvo) &&
    valorDoCampo(rascunho, originais, alvo, "ativo") === "N"
  )
    return "desativada";
  return valorDoCampo(rascunho, originais, alvo, "situacao") === "MANUTENCAO"
    ? "manutencao"
    : "ativa";
}

/*
  Muda o estado de três posições. Desativar não mexe na situação (volta a
  que foi lida): quem reativa encontra a manutenção como estava.
*/
export function registrarEstado(rascunho, originais, alvo, estado) {
  if (!ESTADOS.includes(estado)) return rascunho;
  if (estado === "desativada" && !temAtivo(alvo)) return rascunho;
  let proximo = rascunho;
  if (temAtivo(alvo))
    proximo = registrarCampo(
      proximo,
      originais,
      alvo,
      "ativo",
      estado === "desativada" ? "N" : "S",
    );
  const situacao =
    estado === "desativada"
      ? (originais.get(chaveDoCampo(alvo, "situacao"))?.valor ?? "ATIVA")
      : estado === "manutencao"
        ? "MANUTENCAO"
        : "ATIVA";
  return registrarCampo(proximo, originais, alvo, "situacao", situacao);
}

export const contarPendencias = (rascunho) => rascunho?.size || 0;

/** Os itens de `p_alteracoes`, na ordem em que foram feitos. */
export function alteracoesDoRascunho(rascunho) {
  return [...rascunho.values()].map(({ alvo, campo, valor }) => ({
    escopo: alvo.escopo,
    ...(alvo.area ? { area: alvo.area } : {}),
    ...(alvo.aba ? { aba: alvo.aba } : {}),
    ...(alvo.painel ? { painel: alvo.painel } : {}),
    campo,
    valor: campo === "mensagem" || campo === "previsao" ? texto(valor) : valor,
  }));
}

/** Problemas que o banco recusaria; lista vazia = pode salvar. */
export function problemasDoRascunho(arvore, rascunho, originais) {
  const problemas = [];
  const areas = arvore?.areas || [];
  const ativas = areas.filter(
    (area) =>
      valorDoCampo(
        rascunho,
        originais,
        { escopo: "area", area: area.co_area },
        "ativo",
      ) !== "N",
  );
  if (areas.length && !ativas.length)
    problemas.push("Pelo menos uma área precisa ficar ativa.");
  for (const { campo, valor } of rascunho.values()) {
    if (campo === "mensagem" && texto(valor).length > LIMITE_DA_MENSAGEM)
      problemas.push(
        `A mensagem de manutenção tem mais de ${LIMITE_DA_MENSAGEM} caracteres.`,
      );
    if (campo === "previsao" && texto(valor) && !dataDaPrevisao(valor))
      problemas.push("A previsão de volta precisa ser uma data.");
  }
  return [...new Set(problemas)];
}

export function motivoValido(motivo) {
  const tamanho = texto(motivo).length;
  return tamanho >= MOTIVO_MINIMO && tamanho <= MOTIVO_MAXIMO;
}

// ── Textos para a revisão e o histórico ─────────────────────────────────────

function nomes(arvore) {
  const areas = new Map(
    (arvore?.areas || []).map((a) => [a.co_area, a.no_area]),
  );
  const abas = new Map((arvore?.abas || []).map((a) => [a.co_aba, a.no_aba]));
  const paineis = new Map(
    (arvore?.paineis || []).map((p) => [String(p.id), p.titulo]),
  );
  return {
    area: (id) => areas.get(id) || id || "",
    aba: (id) => abas.get(id) || id || "",
    painel: (id) => paineis.get(String(id)) || "painel removido",
  };
}

/** Onde a alteração vale, em português. */
export function ondeDoAlvo(arvore, alvo) {
  const n = nomes(arvore);
  switch (alvo?.escopo) {
    case "sistema":
      return "Sistema inteiro";
    case "area":
      return `Área ${n.area(alvo.area)}`;
    case "aba":
      return `Aba ${n.aba(alvo.aba)} (todas as áreas)`;
    case "aba_area":
      return `Aba ${n.aba(alvo.aba)} em ${n.area(alvo.area)}`;
    case "painel":
      return `Painel ${n.painel(alvo.painel)}`;
    default:
      return texto(alvo?.escopo);
  }
}

const ROTULO_DO_CAMPO = Object.freeze({
  ativo: "Ativo",
  situacao: "Situação",
  mensagem: "Mensagem",
  previsao: "Previsão de volta",
  beta: "Selo BETA",
  comemoracoes: "Comemorações",
});

export function valorLegivel(campo, valor) {
  const v = texto(valor);
  switch (campo) {
    case "ativo":
      return v === "N" ? "Desativado" : "Ativo";
    case "situacao":
      return v === "MANUTENCAO" ? "Em manutenção" : "Ativa";
    case "beta":
      return v === "S" ? "Com selo" : "Sem selo";
    case "comemoracoes":
      return v === "N" ? "Desligadas" : "Ligadas";
    case "previsao":
      return formatarPrevisao(v) || "sem previsão";
    case "mensagem":
      return v ? `"${v}"` : "vazia";
    default:
      return v;
  }
}

/** Uma linha da revisão: onde, o campo, de → para. */
export function resumoDoRascunho(arvore, rascunho, originais) {
  return [...rascunho.values()].map(({ alvo, campo, valor }) => ({
    chave: chaveDoCampo(alvo, campo),
    onde: ondeDoAlvo(arvore, alvo),
    campo: ROTULO_DO_CAMPO[campo] || campo,
    de: valorLegivel(
      campo,
      originais.get(chaveDoCampo(alvo, campo))?.valor ?? "",
    ),
    para: valorLegivel(campo, valor),
  }));
}

/** `2026-09-30T14:05:00Z` → `30/09/2026 11:05` (no fuso de quem vê). */
export function formatarQuando(valor) {
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "";
  const dois = (n) => String(n).padStart(2, "0");
  return `${dois(data.getDate())}/${dois(data.getMonth() + 1)}/${data.getFullYear()} ${dois(data.getHours())}:${dois(data.getMinutes())}`;
}

/** Uma linha do histórico, em português. */
export function linhaDoHistorico(arvore, registro) {
  const alvo = {
    escopo: registro?.escopo,
    area: registro?.area,
    aba: registro?.aba,
    painel: registro?.painel,
  };
  const campo = texto(registro?.campo);
  return {
    quando: formatarQuando(registro?.quando),
    onde: ondeDoAlvo(arvore, alvo),
    campo: ROTULO_DO_CAMPO[campo] || campo,
    de: valorLegivel(campo, registro?.anterior),
    para: valorLegivel(campo, registro?.novo),
    motivo: texto(registro?.motivo),
    autor: texto(registro?.autor),
  };
}
