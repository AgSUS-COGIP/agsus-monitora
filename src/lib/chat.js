/*
  Regras puras do chat do MONITORA (src/modulos/chat/), sem DOM e sem React.

  Banco: supabase/migrations/20261002210000_chat.sql,
  20261005100000_chat_limpar_e_reacoes.sql e 20261007210000_chat_v2.sql. O que
  o banco confere (tamanho do texto, formato do link da tela) é conferido aqui
  também, para a tela avisar antes de enviar — e o link que CHEGA também passa
  por `linkDaTela`: a navegação é só dentro do app (view, área, seção, edital
  e ficha da avaliação documental), nunca um endereço. Da v2: citação,
  encaminhada, cartões, Visto, busca, fixadas, não lida e status.
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

/**
 * A mensagem pode ir? Texto até o limite; vazio só com anexo ou cartão (a
 * mesma regra do CHECK CK_MENSAGEM_DSTEXTO).
 */
export function podeEnviar(valor, { anexos = 0, link = null } = {}) {
  const bruto = texto(valor);
  if (bruto.length > LIMITE_DO_TEXTO) return validarTexto(bruto);
  if (!bruto.trim() && !(Number(anexos) > 0) && !link)
    return { ok: false, erro: "Escreva a mensagem." };
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
 * Tira as mensagens pelos ids (o DELETE do Realtime traz só a chave: a
 * retenção ou o "Zerar mensagens" das Configurações apagaram de fato). Sem
 * nenhuma delas na lista, devolve a mesma lista (o estado não muda).
 */
export function tirarMensagens(mensagens, ids) {
  const fora = new Set((Array.isArray(ids) ? ids : [ids]).map(String));
  const lista = Array.isArray(mensagens) ? mensagens : [];
  const restantes = lista.filter((m) => !fora.has(String(m?.id)));
  return restantes.length === lista.length ? lista : restantes;
}

/**
 * Releitura da página mais nova da conversa: a mensagem que estava na tela e
 * não voltou foi apagada de fato (retenção ou zerar), então sai. Ficam as que
 * vieram, a pendente e a que falhou (ainda não estão no banco), as mais novas
 * que a página (chegaram pelo Realtime enquanto a leitura corria) e, se há
 * páginas mais antigas (`temMais`), as anteriores à mais antiga da página.
 */
export function reconciliarPagina(atuais, recebidas, temMais) {
  const vieram = Array.isArray(recebidas) ? recebidas : [];
  const ids = new Set(vieram.map((m) => String(m?.id)));
  const instantes = vieram.map((m) => instante(m?.criada_em));
  const maisAntiga = vieram.length ? Math.min(...instantes) : null;
  const maisNova = vieram.length ? Math.max(...instantes) : null;
  const ficam = (Array.isArray(atuais) ? atuais : []).filter(
    (m) =>
      m?.pendente ||
      m?.falhou ||
      ids.has(String(m?.id)) ||
      (maisNova !== null && instante(m?.criada_em) > maisNova) ||
      (temMais && maisAntiga !== null && instante(m?.criada_em) < maisAntiga),
  );
  return mesclarMensagens(ficam, vieram);
}

/**
 * Linha do Realtime (TB_MENSAGEM, colunas MAD) no formato da tela — o mesmo de
 * FC_CHAT_MENSAGEM_JSON. Linha sem id ou sem conversa → null.
 */
export function mensagemDaLinha(linha) {
  if (!linha?.CO_MENSAGEM || !linha?.CO_CONVERSA) return null;
  const apagada = linha.ST_APAGADA === "S";
  const quantos = apagada ? 0 : Math.max(0, Number(linha.QT_ANEXO) || 0);
  const resposta = linha.CO_MENSAGEM_RESPOSTA ?? null;
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
    apagada,
    encaminhada: linha.ST_ENCAMINHADA === "S",
    /*
      A linha diz quantos anexos e qual a citada; os dados deles vêm de
      obter_mensagem_chat (precisaCompletar). Sem anexo ou sem citação, a
      linha já é a verdade.
    */
    qt_anexo: quantos,
    resposta_id: resposta,
    ...(quantos ? {} : { anexos: [] }),
    ...(resposta ? {} : { resposta: null }),
    // As reações vêm por RL_MENSAGEM_REACAO; a apagada fica sem elas.
    ...(apagada ? { reacoes: [] } : {}),
  };
}

/**
 * A mensagem que chegou pelo Realtime (já mesclada com a da tela) ainda não
 * tem os anexos ou a citação que a linha anuncia: pede obter_mensagem_chat.
 */
export function precisaCompletar(mensagem) {
  if (!mensagem || mensagem.apagada || mensagem.pendente) return false;
  const quantos = Number(mensagem.qt_anexo) || 0;
  if (quantos && (mensagem.anexos?.length || 0) !== quantos) return true;
  if (mensagem.resposta_id && mensagem.resposta?.id !== mensagem.resposta_id)
    return true;
  return false;
}

/**
 * A mensagem aparece para quem limpou a conversa? Só as enviadas depois da
 * limpeza (`limpa_em` da conversa); a pendente na tela sempre aparece.
 */
export function depoisDaLimpeza(mensagem, limpaEm) {
  if (!mensagem) return false;
  if (!limpaEm || mensagem.pendente || mensagem.falhou) return true;
  return instante(mensagem.criada_em) > instante(limpaEm);
}

// ── Reações ─────────────────────────────────────────────────────────────────

/**
 * As reações rápidas, na ordem da tela. Espelho de private."FC_CHAT_REACOES"
 * e do CHECK CK_MENSREACAO_DSEMOJI (20261005100000_chat_limpar_e_reacoes.sql).
 */
export const REACOES_RAPIDAS = Object.freeze([
  "👍",
  "✅",
  "❤️",
  "😂",
  "👀",
  "🙏",
]);

const ordemDaReacao = (emoji) => {
  const i = REACOES_RAPIDAS.indexOf(emoji);
  return i < 0 ? REACOES_RAPIDAS.length : i;
};

/**
 * As reações de uma mensagem com a de `usuario` posta (`ativa: true`), tirada
 * (`false`) ou alternada (sem `ativa`): `[{ emoji, usuarios }]`, na ordem das
 * reações rápidas, sem emoji vazio. Não muda a lista recebida.
 */
export function reacoesComAlternancia(reacoes, emoji, usuario, ativa) {
  const lista = (Array.isArray(reacoes) ? reacoes : []).map((r) => ({
    emoji: r.emoji,
    usuarios: Array.isArray(r.usuarios) ? [...r.usuarios] : [],
  }));
  if (!emoji || !usuario) return lista;
  let item = lista.find((r) => r.emoji === emoji);
  if (!item) {
    item = { emoji, usuarios: [] };
    lista.push(item);
  }
  const tem = item.usuarios.some((u) => String(u) === String(usuario));
  const por = ativa === undefined ? !tem : Boolean(ativa);
  if (por && !tem) item.usuarios.push(usuario);
  if (!por && tem)
    item.usuarios = item.usuarios.filter((u) => String(u) !== String(usuario));
  return lista
    .filter((r) => r.usuarios.length)
    .sort((a, b) => ordemDaReacao(a.emoji) - ordemDaReacao(b.emoji));
}

/**
 * Linha do Realtime de RL_MENSAGEM_REACAO aplicada às mensagens da tela.
 * Mensagem que não está na tela (ou linha incompleta): devolve a mesma lista.
 */
export function aplicarReacaoDaLinha(mensagens, linha) {
  const lista = Array.isArray(mensagens) ? mensagens : [];
  if (!linha?.CO_MENSAGEM || !linha?.CO_USUARIO || !linha?.DS_EMOJI)
    return lista;
  const id = String(linha.CO_MENSAGEM);
  if (!lista.some((m) => String(m.id) === id)) return lista;
  return lista.map((m) =>
    String(m.id) === id
      ? {
          ...m,
          reacoes: reacoesComAlternancia(
            m.reacoes,
            linha.DS_EMOJI,
            linha.CO_USUARIO,
            linha.ST_REGISTRO_ATIVO !== "N",
          ),
        }
      : m,
  );
}

/**
 * Para desenhar: `[{ emoji, total, minha, quem }]` — `quem` é "Ana Souza,
 * Você" (para o title). `nomeDe(id)` dá o nome de cada pessoa.
 */
export function resumoDasReacoes(reacoes, eu, nomeDe = () => "Pessoa") {
  return (Array.isArray(reacoes) ? reacoes : [])
    .filter((r) => r?.emoji && r.usuarios?.length)
    .sort((a, b) => ordemDaReacao(a.emoji) - ordemDaReacao(b.emoji))
    .map((r) => {
      const minha = r.usuarios.some((u) => String(u) === String(eu));
      const outros = r.usuarios
        .filter((u) => String(u) !== String(eu))
        .map((u) => nomeDe(u));
      return {
        emoji: r.emoji,
        total: r.usuarios.length,
        minha,
        quem: [...outros, ...(minha ? ["Você"] : [])].join(", "),
      };
    });
}

// ── Campo de escrita ────────────────────────────────────────────────────────

/**
 * Põe `trecho` (um emoji) no lugar da seleção `[inicio, fim)` do texto e
 * devolve o texto e o cursor logo depois. Passaria do limite: não muda.
 */
export function inserirNoCursor(valor, inicio, fim, trecho) {
  const bruto = texto(valor);
  const novo = texto(trecho);
  const de = Math.max(0, Math.min(Number(inicio) || 0, bruto.length));
  const ate = Math.max(de, Math.min(Number(fim ?? de) || de, bruto.length));
  const resultado = bruto.slice(0, de) + novo + bruto.slice(ate);
  if (!novo || resultado.length > LIMITE_DO_TEXTO)
    return { texto: bruto, cursor: ate };
  return { texto: resultado, cursor: de + novo.length };
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

/** Não lidas de uma conversa na lista: as do banco ou 1 se a pessoa marcou como não lida. */
export function naoLidasDaConversa(conversa) {
  const n = Math.max(0, Number(conversa?.nao_lidas) || 0);
  return n || (conversa?.marcada_nao_lida ? 1 : 0);
}

/**
 * O total do ícone e da aba: soma das não lidas (ou 1 na marcada como não
 * lida); da silenciada, só as menções a quem está logado.
 */
export function totalDeNaoLidas(conversas) {
  return (Array.isArray(conversas) ? conversas : []).reduce(
    (total, c) =>
      total +
      (c?.silenciada
        ? Math.max(0, Number(c?.mencoes) || 0)
        : naoLidasDaConversa(c)),
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
  const corpo =
    texto(ultima.texto).replace(/\s+/g, " ").trim() ||
    rotuloSemTexto(ultima.anexos, ultima.link);
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

/**
 * Ordem da lista: as fixadas primeiro (a fixada por último no topo), depois a
 * conversa com mensagem mais recente.
 */
export function ordenarConversas(conversas) {
  const fixada = (c) => (c?.fixada_em ? instante(c.fixada_em) : -Infinity);
  return [...(Array.isArray(conversas) ? conversas : [])].sort(
    (a, b) =>
      (fixada(b) === fixada(a) ? 0 : fixada(b) > fixada(a) ? 1 : -1) ||
      instante(b.atualizada_em) - instante(a.atualizada_em) ||
      String(a.id).localeCompare(String(b.id)),
  );
}

/** Mensagem sem texto: "Anexo", "3 anexos" ou "Cartão de tela". */
export function rotuloSemTexto(anexos, link) {
  const n = Number(anexos) || 0;
  if (n === 1) return "Anexo";
  if (n > 1) return `${n} anexos`;
  return link ? "Cartão de tela" : "";
}

// ── Responder e encaminhar ──────────────────────────────────────────────────

/** A citação de uma mensagem inteira (para o "Respondendo a…" do campo). */
export function citacaoDe(mensagem) {
  if (!mensagem?.id) return null;
  return {
    id: mensagem.id,
    autor: mensagem.autor,
    texto: texto(mensagem.texto).slice(0, 160),
    apagada: Boolean(mensagem.apagada),
    anexos: Array.isArray(mensagem.anexos)
      ? mensagem.anexos.length
      : Number(mensagem.qt_anexo) || 0,
    link: Boolean(mensagem.link),
  };
}

/** O texto de uma linha da citação (resposta do banco ou citacaoDe). */
export function textoDaCitacao(resposta) {
  if (!resposta) return "";
  if (resposta.apagada) return "Mensagem apagada";
  const corpo = texto(resposta.texto).replace(/\s+/g, " ").trim();
  if (corpo) return corpo.length > 120 ? `${corpo.slice(0, 119)}…` : corpo;
  return rotuloSemTexto(resposta.anexos, resposta.link) || "Mensagem";
}

// ── Visto ───────────────────────────────────────────────────────────────────

/**
 * Quem já viu a minha mensagem: participantes (fora eu) com `lida_em` depois
 * do envio. Só a minha, gravada; sem `lida_em` nos participantes (quem não
 * participa não recebe), devolve null.
 * `{ total, viram: [nomes], todos }`.
 */
export function vistoPor(mensagem, conversa, eu) {
  if (!mensagem || String(mensagem.autor) !== String(eu)) return null;
  if (mensagem.pendente || mensagem.falhou || mensagem.apagada) return null;
  const outros = outrasPessoas(conversa, eu);
  if (!outros.length || !outros.some((p) => "lida_em" in p)) return null;
  const enviada = instante(mensagem.criada_em);
  const viram = outros
    .filter((p) => p.lida_em && instante(p.lida_em) >= enviada)
    .map((p) => texto(p.nome) || "Pessoa");
  return {
    total: outros.length,
    viram,
    todos: viram.length === outros.length,
  };
}

/** Atualiza a leitura (`lida_em`) de um participante pela linha do Realtime. */
export function aplicarLeituraDaLinha(conversa, linha) {
  if (!conversa || !linha?.CO_USUARIO) return conversa;
  if (String(linha.CO_CONVERSA) !== String(conversa.id)) return conversa;
  let mudou = false;
  const participantes = (conversa.participantes || []).map((p) => {
    if (String(p.id) !== String(linha.CO_USUARIO) || !("lida_em" in p))
      return p;
    const lida = linha.DT_ULTIMA_LEITURA ?? null;
    if (instante(lida) <= instante(p.lida_em)) return p;
    mudou = true;
    return { ...p, lida_em: lida };
  });
  return mudou ? { ...conversa, participantes } : conversa;
}

/** A mensagem menciona quem está logado? */
export function mencionaMe(mensagem, eu) {
  return (mensagem?.mencoes || []).some((id) => String(id) === String(eu));
}

// ── Status (presença) ───────────────────────────────────────────────────────

/** Espelho do CHECK CK_STATUSPRESENCA_TPSTATUS. */
export const STATUS_DE_PRESENCA = Object.freeze([
  Object.freeze({ valor: "DISPONIVEL", rotulo: "Disponível" }),
  Object.freeze({ valor: "OCUPADO", rotulo: "Ocupado" }),
  Object.freeze({ valor: "AUSENTE", rotulo: "Ausente" }),
]);

/**
 * A presença para desenhar: "disponivel" (online), "ocupado" e "ausente"
 * (online, com o status escolhido) ou "offline".
 */
export function presencaDe(pessoa) {
  if (!pessoa?.online) return "offline";
  if (pessoa.status === "OCUPADO") return "ocupado";
  if (pessoa.status === "AUSENTE") return "ausente";
  return "disponivel";
}

const ROTULOS_DA_PRESENCA = Object.freeze({
  disponivel: "Online",
  ocupado: "Ocupado",
  ausente: "Ausente",
  offline: "",
});

export const rotuloDaPresenca = (pessoa) =>
  ROTULOS_DA_PRESENCA[presencaDe(pessoa)];

// ── Busca ───────────────────────────────────────────────────────────────────

/** O termo da busca pode ir ao banco? (buscar_mensagens_chat pede 2 a 100.) */
export function termoDeBuscaValido(termo) {
  const t = texto(termo).trim();
  return t.length >= 2 && t.length <= 100;
}

/**
 * O trecho do resultado em partes, com o termo destacado (sem diferenciar
 * maiúsculas e acentos): `[{ tipo: "texto" | "termo", texto }]`.
 */
export function partesDoTrecho(trecho, termo) {
  const bruto = texto(trecho).normalize("NFC");
  const alvo = semAcento(bruto);
  const procura = semAcento(termo).trim();
  if (!bruto) return [];
  if (!procura || alvo.length !== bruto.length)
    return [{ tipo: "texto", texto: bruto }];
  const partes = [];
  let cursor = 0;
  for (;;) {
    const em = alvo.indexOf(procura, cursor);
    if (em < 0) break;
    if (em > cursor)
      partes.push({ tipo: "texto", texto: bruto.slice(cursor, em) });
    partes.push({ tipo: "termo", texto: bruto.slice(em, em + procura.length) });
    cursor = em + procura.length;
  }
  if (cursor < bruto.length)
    partes.push({ tipo: "texto", texto: bruto.slice(cursor) });
  return partes;
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
  /*
    As posições são achadas no texto sem acento e recortadas no original: só
    batem se os dois têm o mesmo tamanho. Texto colado em NFD (PDF, macOS)
    encolhe ao perder as marcas — daí o NFC; se ainda assim divergir, sem realce.
  */
  const bruto = texto(valor).normalize("NFC");
  const alvo = semAcento(bruto);
  if (alvo.length !== bruto.length)
    return bruto ? [{ tipo: "texto", texto: bruto }] : [];
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
 * { id, titulo }, ficha?: { id?, codigo }, rotulo }` — só views que o app
 * desenha (as do menu e Configurações), área e seção em formato de código,
 * edital com uuid, ficha da avaliação documental pelo código do candidato
 * (só com edital). Qualquer outra coisa (URL, painel externo) → null. Vale
 * para o link que sai (Compartilhar esta tela / esta ficha) e para o que chega
 * (antes de navegar). Espelho de private."FC_CHAT_VALIDAR_LINK".
 */
export function linkDaTela(entrada) {
  if (!entrada || typeof entrada !== "object" || Array.isArray(entrada))
    return null;
  const view = texto(entrada.view).trim();
  if (!/^[a-z][a-z_-]{0,39}$/.test(view) || !rotuloDaView(view)) return null;
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
  if (entrada.ficha != null) {
    const codigo = texto(entrada.ficha?.codigo).trim();
    const id = texto(entrada.ficha?.id).trim();
    if (!link.edital || !/^[0-9A-Za-z._-]{1,30}$/.test(codigo)) return null;
    if (id && !UUID.test(id)) return null;
    link.ficha = id ? { id, codigo } : { codigo };
  }
  link.rotulo = rotuloDoLink(link).slice(0, 200);
  return link;
}

/** "Classificação · Saúde Indígena · Edital 83/2026" (ficha: "Candidato 123 · …"). */
export function rotuloDoLink(link, rotuloDaSecao = "") {
  if (!link?.view) return "";
  const partes = link.ficha ? [`Candidato ${link.ficha.codigo}`] : [];
  partes.push(rotuloDaView(link.view) || link.view);
  if (link.area) partes.push(nomeDaArea(link.area) || link.area);
  if (link.view === "config" && (rotuloDaSecao || link.secao))
    partes.push(rotuloDaSecao || link.secao);
  if (link.edital) partes.push(`Edital ${link.edital.titulo || ""}`.trim());
  return partes.join(" · ");
}

/**
 * O cartão do link (o que a mensagem mostra): `{ tipo: "tela" | "edital" |
 * "ficha", titulo, detalhe, icone, podeAbrir, link }`. `paginas` é
 * `paginasPermitidas(perfil)` de quem vê: sem a página, "Abrir" não aparece
 * (o banco confere de novo ao abrir). Link que não vale → null.
 */
export function cartaoDoLink(entrada, paginas = null) {
  const link = linkDaTela(entrada);
  if (!link) return null;
  const tela = rotuloDaView(link.view);
  const area = link.area ? nomeDaArea(link.area) || link.area : "";
  const edital = link.edital ? `Edital ${link.edital.titulo || ""}`.trim() : "";
  const podeAbrir = paginas ? Boolean(paginas[link.view]) : true;
  if (link.ficha)
    return {
      tipo: "ficha",
      titulo: `Candidato ${link.ficha.codigo}`,
      detalhe: [tela, area, edital].filter(Boolean).join(" · "),
      icone: "fa-id-card",
      podeAbrir,
      link,
    };
  if (link.edital)
    return {
      tipo: "edital",
      titulo: edital,
      detalhe: [tela, area].filter(Boolean).join(" · "),
      icone: "fa-file-lines",
      podeAbrir,
      link,
    };
  return {
    tipo: "tela",
    titulo:
      link.view === "config" && link.secao ? `${tela} · ${link.secao}` : tela,
    detalhe: area,
    icone: "fa-display",
    podeAbrir,
    link,
  };
}

// ── Avisos ──────────────────────────────────────────────────────────────────

/**
 * A mensagem que chegou pede aviso (som ou notificação)? Não: a própria, a
 * apagada, a da conversa aberta com a aba à vista e a de conversa silenciada
 * — a não ser que mencione quem está logado (menção sempre avisa).
 */
export function deveAvisar({ mensagem, eu, conversa, abertaAVista }) {
  if (!mensagem || mensagem.apagada) return false;
  if (String(mensagem.autor) === String(eu)) return false;
  if (!conversa) return false;
  if (conversa.silenciada && !mencionaMe(mensagem, eu)) return false;
  return !abertaAVista;
}
