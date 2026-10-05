/*
  Regras puras do chat do MONITORA (src/modulos/chat/), sem DOM e sem React.

  Banco: supabase/migrations/20261002210000_chat.sql. O que o banco confere
  (tamanho do texto, formato do link da tela) é conferido aqui também, para a
  tela avisar antes de enviar — e o link que CHEGA também passa por
  `linkDaTela`: a navegação é só dentro do app (view, área, seção e edital),
  nunca um endereço.
*/

import { ABAS_DO_MENU, nomeDaArea } from "./menu-lateral.js";

export const LIMITE_DO_TEXTO = 4000;
/** Quantas mensagens por página (listar_mensagens_chat aceita até 100). */
export const MENSAGENS_POR_PAGINA = 50;

const texto = (valor) => (typeof valor === "string" ? valor : "");
const semAcento = (valor) =>
  texto(valor).normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR");

/** O texto pode ser enviado? `{ ok, erro }` com a mesma regra do banco. */
export function validarTexto(valor) {
  const bruto = texto(valor);
  if (!bruto.trim()) return { ok: false, erro: "Escreva a mensagem." };
  if (bruto.length > LIMITE_DO_TEXTO)
    return {
      ok: false,
      erro: `A mensagem passa de ${LIMITE_DO_TEXTO.toLocaleString("pt-BR")} caracteres.`,
    };
  return { ok: true, erro: "" };
}

// ── Datas ───────────────────────────────────────────────────────────────────

const doisDigitos = (n) => String(n).padStart(2, "0");

function dataValida(valor) {
  if (valor === null || valor === undefined || valor === "") return null;
  const data = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(data.getTime()) ? null : data;
}

const chaveDoDia = (data) =>
  `${data.getFullYear()}-${doisDigitos(data.getMonth() + 1)}-${doisDigitos(data.getDate())}`;

/** "Hoje", "Ontem", "02/10" (este ano) ou "02/10/2025". Hora local. */
export function rotuloDoDia(valor, agora = new Date()) {
  const data = dataValida(valor);
  if (!data) return "";
  const hoje = dataValida(agora) || new Date();
  if (chaveDoDia(data) === chaveDoDia(hoje)) return "Hoje";
  const ontem = new Date(
    hoje.getFullYear(),
    hoje.getMonth(),
    hoje.getDate() - 1,
  );
  if (chaveDoDia(data) === chaveDoDia(ontem)) return "Ontem";
  const dia = `${doisDigitos(data.getDate())}/${doisDigitos(data.getMonth() + 1)}`;
  return data.getFullYear() === hoje.getFullYear()
    ? dia
    : `${dia}/${data.getFullYear()}`;
}

/** "14:05" (hora local). */
export function horaCurta(valor) {
  const data = dataValida(valor);
  return data
    ? `${doisDigitos(data.getHours())}:${doisDigitos(data.getMinutes())}`
    : "";
}

/** Na lista de conversas: a hora se for hoje; senão o dia ("Ontem", "02/10"). */
export function quandoNaLista(valor, agora = new Date()) {
  const rotulo = rotuloDoDia(valor, agora);
  return rotulo === "Hoje" ? horaCurta(valor) : rotulo;
}

/**
 * As mensagens (em ordem de envio) agrupadas por dia:
 * `[{ chave: "2026-10-02", rotulo: "Hoje", mensagens: [...] }]`.
 */
export function agruparPorDia(mensagens, agora = new Date()) {
  const grupos = [];
  for (const mensagem of Array.isArray(mensagens) ? mensagens : []) {
    const data = dataValida(mensagem?.criada_em);
    if (!data) continue;
    const chave = chaveDoDia(data);
    const ultimo = grupos.at(-1);
    if (ultimo?.chave === chave) ultimo.mensagens.push(mensagem);
    else
      grupos.push({
        chave,
        rotulo: rotuloDoDia(data, agora),
        mensagens: [mensagem],
      });
  }
  return grupos;
}

// ── Mensagens e conversas ───────────────────────────────────────────────────

const instante = (valor) => dataValida(valor)?.getTime() ?? 0;

function ordemDeEnvio(a, b) {
  return (
    instante(a.criada_em) - instante(b.criada_em) ||
    String(a.id).localeCompare(String(b.id))
  );
}

/**
 * Junta mensagens novas às que já estão na tela, sem duplicar (pelo id): a
 * resposta do envio, o Realtime e a recarga ao voltar para a aba podem trazer
 * a mesma mensagem. A versão que chega substitui a de antes (edição, apagar);
 * a que está pendente na tela some quando a gravada chega.
 */
export function mesclarMensagens(atuais, novas) {
  const porId = new Map();
  for (const m of Array.isArray(atuais) ? atuais : [])
    if (m?.id) porId.set(String(m.id), m);
  for (const m of Array.isArray(novas) ? novas : []) {
    if (!m?.id) continue;
    const anterior = porId.get(String(m.id));
    porId.set(String(m.id), anterior ? { ...anterior, ...m } : m);
  }
  return [...porId.values()].sort(ordemDeEnvio);
}

/**
 * Linha do Realtime (TB_MENSAGEM, colunas MAD) no formato da tela — o mesmo de
 * FC_CHAT_MENSAGEM_JSON. Linha sem id ou sem conversa → null.
 */
export function mensagemDaLinha(linha) {
  if (!linha?.CO_MENSAGEM || !linha?.CO_CONVERSA) return null;
  return {
    id: linha.CO_MENSAGEM,
    conversa: linha.CO_CONVERSA,
    autor: linha.CO_USUARIO_AUTOR,
    texto: texto(linha.DS_TEXTO),
    link: linha.DS_LINK_TELA ?? null,
    mencoes: Array.isArray(linha.CO_USUARIOS_MENCIONADOS)
      ? linha.CO_USUARIOS_MENCIONADOS
      : [],
    criada_em: linha.DT_CRIACAO,
    editada_em: linha.DT_EDICAO ?? null,
    apagada: linha.ST_APAGADA === "S",
  };
}

/** Não lidas de uma conversa a partir das mensagens: de outras pessoas, depois da última leitura. */
export function naoLidasDasMensagens(mensagens, lidaEm, eu) {
  const desde = lidaEm ? instante(lidaEm) : -Infinity;
  return (Array.isArray(mensagens) ? mensagens : []).filter(
    (m) =>
      m &&
      !m.apagada &&
      !m.pendente &&
      String(m.autor) !== String(eu) &&
      instante(m.criada_em) > desde,
  ).length;
}

/** O total do ícone e da aba: soma das não lidas, fora as silenciadas. */
export function totalDeNaoLidas(conversas) {
  return (Array.isArray(conversas) ? conversas : []).reduce(
    (total, c) =>
      c?.silenciada ? total : total + Math.max(0, Number(c?.nao_lidas) || 0),
    0,
  );
}

/** As outras pessoas da conversa (sem quem está logado). */
export function outrasPessoas(conversa, eu) {
  return (conversa?.participantes || []).filter(
    (p) => String(p.id) !== String(eu),
  );
}

/** O nome da conversa: a outra pessoa (direta), o nome (grupo) ou o edital. */
export function tituloDaConversa(conversa, eu) {
  if (!conversa) return "";
  if (conversa.tipo === "GRUPO") return texto(conversa.nome) || "Grupo";
  if (conversa.tipo === "EDITAL")
    return `Edital ${texto(conversa.edital?.titulo) || ""}`.trim();
  return outrasPessoas(conversa, eu)[0]?.nome || "Conversa";
}

/** Alguém da conversa (fora quem está logado) está online agora? */
export function temAlguemOnline(conversa, eu) {
  return outrasPessoas(conversa, eu).some((p) => p.online);
}

/** Prévia da última mensagem na lista ("Você: …", "Mensagem apagada"). */
export function previaDaUltima(conversa, eu) {
  const ultima = conversa?.ultima;
  if (!ultima) return "";
  if (ultima.apagada) return "Mensagem apagada";
  const corpo = texto(ultima.texto).replace(/\s+/g, " ").trim();
  if (String(ultima.autor) === String(eu)) return `Você: ${corpo}`;
  if (conversa.tipo === "DIRETA") return corpo;
  const autor = (conversa.participantes || []).find(
    (p) => String(p.id) === String(ultima.autor),
  );
  const primeiro = texto(autor?.nome).split(/\s+/)[0];
  return primeiro ? `${primeiro}: ${corpo}` : corpo;
}

/** Busca da lista: pelo título, pelos participantes e pelo edital. */
export function filtrarConversas(conversas, busca, eu) {
  const termo = semAcento(busca).trim();
  const lista = Array.isArray(conversas) ? conversas : [];
  if (!termo) return lista;
  return lista.filter((c) =>
    [
      tituloDaConversa(c, eu),
      texto(c.edital?.unidade),
      ...(c.participantes || []).map((p) => p.nome),
    ].some((parte) => semAcento(parte).includes(termo)),
  );
}

/** Ordem da lista: a conversa com mensagem mais recente primeiro. */
export function ordenarConversas(conversas) {
  return [...(Array.isArray(conversas) ? conversas : [])].sort(
    (a, b) =>
      instante(b.atualizada_em) - instante(a.atualizada_em) ||
      String(a.id).localeCompare(String(b.id)),
  );
}

// ── Menções ─────────────────────────────────────────────────────────────────

const fimDaMencao = /[\s.,;:!?)\]]/;
/* O "@" abre palavra: no começo, depois de espaço ou de parêntese ("email@ana" não menciona). */
const ABRE_MENCAO = /[\s([]/;

/**
 * Quem foi mencionado: pessoas cujo "@Nome" aparece no texto (sem diferenciar
 * maiúsculas e acentos), terminando em espaço, pontuação ou fim do texto. Nome
 * mais longo vence ("@Ana Paula" não menciona também "@Ana").
 */
export function extrairMencoes(valor, pessoas) {
  const alvo = semAcento(valor);
  const candidatos = (Array.isArray(pessoas) ? pessoas : [])
    .filter((p) => p?.id && texto(p.nome).trim())
    .sort((a, b) => texto(b.nome).length - texto(a.nome).length);
  const ocupados = [];
  const ids = [];
  for (const pessoa of candidatos) {
    const procura = `@${semAcento(pessoa.nome).trim()}`;
    let de = 0;
    for (;;) {
      const em = alvo.indexOf(procura, de);
      if (em < 0) break;
      const fim = em + procura.length;
      const depois = alvo[fim];
      const livre = !ocupados.some(([a, b]) => em < b && fim > a);
      const abre = em === 0 || ABRE_MENCAO.test(alvo[em - 1]);
      if ((depois === undefined || fimDaMencao.test(depois)) && livre && abre) {
        ocupados.push([em, fim]);
        if (!ids.includes(pessoa.id)) ids.push(pessoa.id);
      }
      de = fim;
    }
  }
  return ids;
}

/**
 * O texto em partes para desenhar: `{ tipo: "texto" | "mencao", texto }`.
 * Só vira menção o "@Nome" de quem a mensagem menciona de fato.
 */
export function partesDoTexto(valor, pessoasMencionadas) {
  const bruto = texto(valor);
  const alvo = semAcento(bruto);
  const trechos = [];
  const pessoas = (
    Array.isArray(pessoasMencionadas) ? pessoasMencionadas : []
  ).sort((a, b) => texto(b.nome).length - texto(a.nome).length);
  for (const pessoa of pessoas) {
    const procura = `@${semAcento(pessoa.nome).trim()}`;
    if (procura.length < 2) continue;
    let de = 0;
    for (;;) {
      const em = alvo.indexOf(procura, de);
      if (em < 0) break;
      const fim = em + procura.length;
      const depois = alvo[fim];
      if (
        (em === 0 || ABRE_MENCAO.test(alvo[em - 1])) &&
        (depois === undefined || fimDaMencao.test(depois)) &&
        !trechos.some(([a, b]) => em < b && fim > a)
      )
        trechos.push([em, fim]);
      de = fim;
    }
  }
  trechos.sort((a, b) => a[0] - b[0]);
  const partes = [];
  let cursor = 0;
  for (const [em, fim] of trechos) {
    if (em > cursor)
      partes.push({ tipo: "texto", texto: bruto.slice(cursor, em) });
    partes.push({ tipo: "mencao", texto: bruto.slice(em, fim) });
    cursor = fim;
  }
  if (cursor < bruto.length)
    partes.push({ tipo: "texto", texto: bruto.slice(cursor) });
  return partes;
}

/**
 * A menção sendo digitada antes do cursor ("@ana" → `{ inicio, termo: "ana" }`),
 * para sugerir pessoas; null se não há. O "@" tem de abrir palavra.
 */
export function mencaoEmDigitacao(valor, cursor) {
  const bruto = texto(valor);
  const ate = Math.max(0, Math.min(Number(cursor) || 0, bruto.length));
  const antes = bruto.slice(0, ate);
  const em = antes.lastIndexOf("@");
  if (em < 0) return null;
  if (em > 0 && !/\s/.test(antes[em - 1])) return null;
  const termo = antes.slice(em + 1);
  // Termina em espaço: a menção já foi escrita (ou escolhida).
  if (
    termo.length > 40 ||
    /[\n@]/.test(termo) ||
    /\s{2,}/.test(termo) ||
    /\s$/.test(termo)
  )
    return null;
  return { inicio: em, termo };
}

/** Pessoas que combinam com o termo da menção (até 6); nome já completo não sugere. */
export function sugestoesDeMencao(pessoas, termo) {
  const procura = semAcento(termo).trim();
  const lista = Array.isArray(pessoas) ? pessoas : [];
  if (procura && lista.some((p) => semAcento(p.nome).trim() === procura))
    return [];
  return lista
    .filter((p) => !procura || semAcento(p.nome).includes(procura))
    .slice(0, 6);
}

/** Troca o "@termo" em digitação pelo "@Nome " escolhido; devolve texto e cursor. */
export function inserirMencao(valor, cursor, mencao, pessoa) {
  const bruto = texto(valor);
  const nome = `@${texto(pessoa?.nome).trim()} `;
  const ate = Math.max(0, Math.min(Number(cursor) || 0, bruto.length));
  const novo = bruto.slice(0, mencao.inicio) + nome + bruto.slice(ate);
  return { texto: novo, cursor: mencao.inicio + nome.length };
}

// ── Link da tela ────────────────────────────────────────────────────────────

const VIEWS_SEM_AREA = Object.freeze({ config: "Configurações" });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function rotuloDaView(view) {
  return (
    ABAS_DO_MENU.find((aba) => aba.view === view)?.rotulo ||
    VIEWS_SEM_AREA[view] ||
    ""
  );
}

/**
 * O link interno de uma tela, conferido: `{ view, area?, secao?, edital?:
 * { id, titulo }, rotulo }` — só views que o app desenha (as do menu e
 * Configurações), área e seção em formato de código, edital com uuid. Qualquer
 * outra coisa (URL, painel externo, campo a mais) → null. Vale para o link que
 * sai (Compartilhar esta tela) e para o que chega (antes de navegar).
 */
export function linkDaTela(entrada) {
  if (!entrada || typeof entrada !== "object" || Array.isArray(entrada))
    return null;
  const view = texto(entrada.view).trim();
  if (!/^[a-z][a-z_]{0,39}$/.test(view) || !rotuloDaView(view)) return null;
  const link = { view };
  const area = texto(entrada.area).trim();
  if (area) {
    if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(area)) return null;
    if (!VIEWS_SEM_AREA[view]) link.area = area;
  }
  const secao = texto(entrada.secao).trim();
  if (secao) {
    if (!/^[a-z0-9][a-z0-9_-]{0,39}$/.test(secao)) return null;
    if (view === "config") link.secao = secao;
  }
  if (entrada.edital != null) {
    const id = texto(entrada.edital?.id).trim();
    if (!UUID.test(id)) return null;
    link.edital = {
      id,
      titulo: texto(entrada.edital?.titulo).trim().slice(0, 120),
    };
  }
  link.rotulo = rotuloDoLink(link).slice(0, 200);
  return link;
}

/** "Classificação · Saúde Indígena · Edital 83/2026". */
export function rotuloDoLink(link, rotuloDaSecao = "") {
  if (!link?.view) return "";
  const partes = [rotuloDaView(link.view) || link.view];
  if (link.area) partes.push(nomeDaArea(link.area) || link.area);
  if (link.view === "config" && (rotuloDaSecao || link.secao))
    partes.push(rotuloDaSecao || link.secao);
  if (link.edital) partes.push(`Edital ${link.edital.titulo || ""}`.trim());
  return partes.join(" · ");
}

// ── Avisos ──────────────────────────────────────────────────────────────────

/**
 * A mensagem que chegou pede aviso (som ou notificação)? Não: a própria, a de
 * conversa silenciada, a apagada, e a da conversa aberta com a aba à vista.
 */
export function deveAvisar({ mensagem, eu, conversa, abertaAVista }) {
  if (!mensagem || mensagem.apagada) return false;
  if (String(mensagem.autor) === String(eu)) return false;
  if (!conversa || conversa.silenciada) return false;
  return !abertaAVista;
}
