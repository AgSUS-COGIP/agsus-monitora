/*
  Retenção das mensagens do chat (Configurações › Mensagens (chat), só o
  administrador global), sem DOM: escolha e validação do prazo, quantas
  mensagens um prazo apagaria (pelas idades que o banco devolve), o texto da
  confirmação, a validação do "Zerar mensagens" e a leitura de
  `obter_retencao_chat` num formato seguro para a tela.

  O banco repete as regras (20261005190000_chat_retencao_das_mensagens.sql):
  prazo nulo ou de 7 a 3.650 dias, motivo de 3 a 500 caracteres e a palavra
  ZERAR exata. O desenho é de src/modulos/configuracoes/mensagens-do-chat.jsx.
*/
import { formatNumberBR } from "./formatters.js";

export const PRAZO_MINIMO = 7;
export const PRAZO_MAXIMO = 3650;
export const MOTIVO_MINIMO = 3;
export const MOTIVO_MAXIMO = 500;
export const PALAVRA_DE_CONFIRMACAO = "ZERAR";

/** As escolhas do prazo, na ordem da tela: para sempre, as fixas e "outro". */
export const SEMPRE = "sempre";
export const OUTRO = "outro";
export const PRAZOS_FIXOS = Object.freeze([30, 90, 180, 365]);
export const ESCOLHAS_DE_PRAZO = Object.freeze([
  { valor: SEMPRE, rotulo: "Guardar para sempre" },
  ...PRAZOS_FIXOS.map((dias) => ({
    valor: String(dias),
    rotulo: rotuloDoPrazo(dias),
  })),
  { valor: OUTRO, rotulo: "Outro prazo" },
]);

const inteiro = (valor) => {
  const n = Number(valor);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
};
const quantidade = (valor) => Math.max(0, inteiro(valor));
const dataOuNulo = (valor) => {
  if (!valor) return null;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
};
const textoOuVazio = (valor) => String(valor ?? "").trim();

/** "N mensagens" com o número no formato brasileiro e o singular certo. */
export function plural(n, um, varios) {
  return `${formatNumberBR(n)} ${n === 1 ? um : varios}`;
}

/** Nome do prazo: "Guardar para sempre", "30 dias", "365 dias (1 ano)". */
export function rotuloDoPrazo(dias) {
  if (dias === null || dias === undefined) return "Guardar para sempre";
  if (dias === 365) return "365 dias (1 ano)";
  return plural(dias, "dia", "dias");
}

/** A escolha da tela para um prazo salvo (nulo → para sempre; fora das fixas → outro). */
export function escolhaDoPrazo(dias) {
  if (dias === null || dias === undefined) return SEMPRE;
  return PRAZOS_FIXOS.includes(dias) ? String(dias) : OUTRO;
}

/**
 * Prazo da escolha (e do valor livre, em "outro"): `{ ok, dias, erro }`.
 * `dias` nulo é "guardar para sempre". O valor livre é um inteiro de 7 a
 * 3.650, só com dígitos.
 */
export function validarPrazo(escolha, livre = "") {
  if (escolha === SEMPRE) return { ok: true, dias: null, erro: "" };
  if (escolha !== OUTRO) {
    const dias = Number(escolha);
    return PRAZOS_FIXOS.includes(dias)
      ? { ok: true, dias, erro: "" }
      : { ok: false, dias: null, erro: "Escolha um prazo." };
  }
  const texto = textoOuVazio(livre);
  if (!/^\d{1,5}$/.test(texto))
    return {
      ok: false,
      dias: null,
      erro: `Informe o prazo em dias (de ${PRAZO_MINIMO} a ${formatNumberBR(PRAZO_MAXIMO)}).`,
    };
  const dias = Number(texto);
  if (dias < PRAZO_MINIMO || dias > PRAZO_MAXIMO)
    return {
      ok: false,
      dias: null,
      erro: `O prazo vai de ${PRAZO_MINIMO} a ${formatNumberBR(PRAZO_MAXIMO)} dias.`,
    };
  return { ok: true, dias, erro: "" };
}

/** Motivo do histórico: 3 a 500 caracteres, sem os espaços das pontas. */
export function validarMotivo(motivo) {
  const texto = textoOuVazio(motivo);
  if (texto.length < MOTIVO_MINIMO)
    return { ok: false, motivo: texto, erro: "Informe o motivo." };
  if (texto.length > MOTIVO_MAXIMO)
    return {
      ok: false,
      motivo: texto,
      erro: `O motivo passa de ${MOTIVO_MAXIMO} caracteres.`,
    };
  return { ok: true, motivo: texto, erro: "" };
}

/**
 * Quantas mensagens o prazo apagaria, pelas idades do banco
 * (`[{ dias, mensagens }]`, dias = idade inteira): as que têm `dias` ou mais.
 * Prazo nulo não apaga nada.
 */
export function quantasApagaria(idades, dias) {
  if (dias === null || dias === undefined) return 0;
  let total = 0;
  for (const idade of Array.isArray(idades) ? idades : [])
    if (inteiro(idade?.dias) >= dias) total += quantidade(idade?.mensagens);
  return total;
}

/**
 * Texto da confirmação ao salvar um prazo que apaga mensagens existentes;
 * nulo quando não apaga nada (salva sem perguntar).
 */
export function textoDaConfirmacaoDoPrazo(dias, apagaria) {
  if (dias === null || dias === undefined || !apagaria) return null;
  return `Isto apaga ${plural(apagaria, "mensagem", "mensagens")} com mais de ${plural(dias, "dia", "dias")}; não dá para desfazer.`;
}

/**
 * O "Zerar mensagens" pode ir? A palavra precisa ser exatamente ZERAR (sem
 * espaço, maiúsculas) e o motivo ter 3 a 500 caracteres.
 */
export function validarZerar({ confirmacao, motivo } = {}) {
  const erros = {};
  if (confirmacao !== PALAVRA_DE_CONFIRMACAO)
    erros.confirmacao = `Digite ${PALAVRA_DE_CONFIRMACAO} para confirmar.`;
  const conferido = validarMotivo(motivo);
  if (!conferido.ok) erros.motivo = conferido.erro;
  return {
    ok: Object.keys(erros).length === 0,
    motivo: conferido.motivo,
    erros,
  };
}

/** O que o "Zerar mensagens" vai apagar, linha a linha (contagens de agora). */
export function oQueOZerarApaga(dados, incluirConversas = false) {
  const linhas = [
    plural(dados?.mensagens ?? 0, "mensagem", "mensagens"),
    plural(dados?.reacoes ?? 0, "reação", "reações"),
  ];
  if (dados?.anexos) linhas.push(plural(dados.anexos, "anexo", "anexos"));
  if (incluirConversas)
    linhas.push(
      plural(
        dados?.conversasSemParticipante ?? 0,
        "conversa sem participante ativo",
        "conversas sem participante ativo",
      ),
    );
  return linhas;
}

function normalizarLimpeza(item) {
  const tipo = item?.tipo === "ZERAR" ? "ZERAR" : "PRAZO";
  return {
    id: textoOuVazio(item?.id),
    tipo,
    origem: item?.origem === "AGENDA" ? "AGENDA" : "ADMIN",
    dias:
      item?.dias === null || item?.dias === undefined
        ? null
        : inteiro(item.dias),
    corte: dataOuNulo(item?.corte),
    mensagens: quantidade(item?.mensagens),
    reacoes: quantidade(item?.reacoes),
    anexos: quantidade(item?.anexos),
    conversas: quantidade(item?.conversas),
    motivo: textoOuVazio(item?.motivo),
    quem: textoOuVazio(item?.nome) || textoOuVazio(item?.email),
    em: dataOuNulo(item?.em),
  };
}

/** A resposta de obter_retencao_chat (ou das outras duas) no formato da tela. */
export function normalizarRetencao(bruto) {
  const dados = bruto && typeof bruto === "object" ? bruto : {};
  return {
    dias:
      dados.dias === null || dados.dias === undefined
        ? null
        : inteiro(dados.dias),
    atualizadoEm: dataOuNulo(dados.atualizado_em),
    atualizadoPor: textoOuVazio(dados.atualizado_por),
    geradoEm: dataOuNulo(dados.gerado_em),
    mensagens: quantidade(dados.mensagens),
    reacoes: quantidade(dados.reacoes),
    anexos: quantidade(dados.anexos),
    /* Arquivos à espera de sair do Storage (20261007210000_chat_v2.sql). */
    expurgoPendente: quantidade(dados.expurgo_pendente),
    conversas: quantidade(dados.conversas),
    conversasSemParticipante: quantidade(dados.conversas_sem_participante),
    maisAntiga: dataOuNulo(dados.mais_antiga),
    idades: (Array.isArray(dados.idades) ? dados.idades : [])
      .map((i) => ({
        dias: inteiro(i?.dias),
        mensagens: quantidade(i?.mensagens),
      }))
      .filter((i) => i.mensagens > 0),
    historico: (Array.isArray(dados.historico) ? dados.historico : []).map(
      normalizarLimpeza,
    ),
  };
}

/** Nome da limpeza no histórico. */
export function rotuloDaLimpeza(item) {
  if (item.tipo === "ZERAR") return "Zerar mensagens";
  if (item.dias === null) return "Prazo: guardar para sempre";
  const nome = `Prazo de ${rotuloDoPrazo(item.dias)}`;
  return item.origem === "AGENDA" ? `${nome} (limpeza diária)` : nome;
}

/** Contagens da limpeza no histórico: "12 mensagens · 3 reações · 2 anexos · 1 conversa". */
export function contagensDaLimpeza(item) {
  const partes = [plural(item.mensagens, "mensagem", "mensagens")];
  if (item.reacoes) partes.push(plural(item.reacoes, "reação", "reações"));
  if (item.anexos) partes.push(plural(item.anexos, "anexo", "anexos"));
  if (item.conversas)
    partes.push(plural(item.conversas, "conversa", "conversas"));
  return partes.join(" · ");
}

/** Mensagem de erro das RPCs de retenção, em português de gente. */
export function mensagemDeErroDaRetencao(erro) {
  const codigo = String(erro?.code ?? "");
  if (codigo === "42501")
    return "Só o administrador global cuida da retenção das mensagens.";
  if (codigo === "PGRST202")
    return "O banco ainda não tem a retenção das mensagens. Aplique a migration 20261005190000_chat_retencao_das_mensagens.sql e recarregue a página.";
  return textoOuVazio(erro?.message) || "Não foi possível falar com o banco.";
}
