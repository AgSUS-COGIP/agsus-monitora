/*
  A carta de convocação para contratação, sem DOM: os campos do modelo, o
  preenchimento por candidato, a validação do modelo e da emissão, e a leitura
  dos modelos que o banco guarda (migration 20261005180000). O documento (SEI,
  DOCX, PDF) sai de carta-de-convocacao-documento.js; a tela, de
  src/modulos/aprovados/carta-de-convocacao/.

  O MODELO
    Texto livre, um parágrafo por linha (linha vazia separa e some),
    **negrito** como no documento oficial da Classificação, e campos entre
    chaves. A linha que é só {DOCUMENTOS} vira a lista dos documentos, um por
    linha; no meio do texto, eles vão separados por ponto e vírgula. Linha que
    começa com "- " vira item.
    O nome do campo aceita acento e caixa ({Lotação}, {POSIÇÃO}) e
    {LOTAÇÃO/UNIDADE} vale {LOTACAO}.

  CPF
    A lista de aprovados não guarda CPF. {CPF} só aparece se o candidato
    trouxer `cpf`, e sempre mascarado (***.456.789-**); sem ele, a carta sai
    com o espaço em branco e a emissão avisa quem ficou sem.
*/

import { dataPorExtenso } from "./classificacao/documento-sei.js";
import { modalidadeSemAspas } from "./lista-aprovados-rules.js";

const texto = (valor) => String(valor ?? "").trim();

/** O que vai no lugar de um campo sem valor: um espaço para preencher à mão. */
export const ESPACO_EM_BRANCO = "__________";

export const CAMPOS_DA_CARTA = Object.freeze(
  [
    ["NOME", "Nome do candidato", "candidato"],
    ["CPF", "CPF mascarado (***.456.789-**)", "candidato"],
    ["CARGO", "Cargo", "candidato"],
    ["VAGA", "Código da vaga", "candidato"],
    ["LOTACAO", "Lotação (unidade do edital)", "candidato"],
    ["UNIDADE", "Unidade do edital", "candidato"],
    ["EDITAL", "Número do edital", "candidato"],
    ["POSICAO", "Posição na classificação", "candidato"],
    ["MODALIDADE", "Modalidade de concorrência", "candidato"],
    ["DATA_LIMITE", "Data limite para apresentação", "emissao"],
    ["LOCAL", "Local de apresentação", "emissao"],
    ["DOCUMENTOS", "Documentos exigidos", "emissao"],
    ["CONTATO", "Contato para dúvidas", "emissao"],
    ["DATA", "Data da emissão, por extenso", "emissao"],
  ].map(([chave, rotulo, origem]) => Object.freeze({ chave, rotulo, origem })),
);

const CHAVES = new Set(CAMPOS_DA_CARTA.map((campo) => campo.chave));

/** "Lotação/Unidade" → "LOTACAO"; "data limite" → "DATA_LIMITE". */
export function chaveDoCampo(bruto) {
  return texto(bruto)
    .split("/")[0]
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .trim()
    .replace(/[\s-]+/g, "_");
}

const PADRAO_DO_CAMPO = /\{([^{}\n]{1,40})\}/g;

/** Os campos que o texto usa, na ordem em que aparecem, sem repetir. */
export function camposUsados(...textos) {
  const vistos = [];
  for (const t of textos)
    for (const [, bruto] of String(t ?? "").matchAll(PADRAO_DO_CAMPO)) {
      const chave = chaveDoCampo(bruto);
      if (chave && !vistos.includes(chave)) vistos.push(chave);
    }
  return vistos;
}

/** Os campos usados que a carta não conhece (sairiam como estão). */
export function camposDesconhecidos(...textos) {
  return camposUsados(...textos).filter((chave) => !CHAVES.has(chave));
}

/* Chave aberta sem fechar (ou fechada sem abrir) numa mesma linha. */
function chavesQuebradas(valor) {
  return String(valor ?? "")
    .split(/\r?\n/)
    .some((linha) => {
      const sem = linha.replace(PADRAO_DO_CAMPO, "");
      return sem.includes("{") || sem.includes("}");
    });
}

/** CPF com 11 dígitos → "***.456.789-**"; qualquer outra coisa → "". */
export function mascararCpf(cpf) {
  const digitos = String(cpf ?? "").replace(/\D/g, "");
  if (digitos.length !== 11) return "";
  return `***.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-**`;
}

/** "2026-10-12" → "12/10/2026". */
export function dataCurta(valor) {
  const m = texto(valor).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/** O dia de hoje em Brasília, "AAAA-MM-DD". */
export function hojeEmBrasilia(agora = new Date()) {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(agora)
      .map((p) => [p.type, p.value]),
  );
  return `${partes.year}-${partes.month}-${partes.day}`;
}

/** Data limite padrão: `dias` corridos depois de `hoje` ("AAAA-MM-DD"). */
export function dataLimitePadrao(hoje, dias) {
  const n = Number(dias);
  const m = texto(hoje).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m || !Number.isInteger(n) || n < 0) return "";
  const data = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + n));
  return data.toISOString().slice(0, 10);
}

/** Os documentos, um por linha (sem marcadores no começo). */
export function listaDeDocumentos(valor) {
  return String(valor ?? "")
    .split(/\r?\n/)
    .map((linha) => linha.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, "").trim())
    .filter(Boolean);
}

/**
 * Os valores dos campos para um candidato numa emissão.
 *   candidato  linha da lista de aprovados (nome, cargo, codigo_vaga,
 *              unidade, edital, classificacao, modalidade, cpf?)
 *   emissao    { dataLimite, local, documentos, contato, data }
 */
export function valoresDaCarta(candidato = {}, emissao = {}) {
  const documentos = listaDeDocumentos(emissao.documentos);
  const posicao = Number(candidato.classificacao);
  return {
    NOME: texto(candidato.nome),
    CPF: mascararCpf(candidato.cpf),
    CARGO: texto(candidato.cargo),
    VAGA: texto(candidato.codigo_vaga),
    LOTACAO: texto(candidato.lotacao) || texto(candidato.unidade),
    UNIDADE: texto(candidato.unidade),
    EDITAL: texto(candidato.edital),
    POSICAO:
      Number.isFinite(posicao) && posicao > 0 ? String(Math.trunc(posicao)) : "",
    MODALIDADE: modalidadeSemAspas(candidato.modalidade),
    DATA_LIMITE: dataCurta(emissao.dataLimite),
    LOCAL: texto(emissao.local),
    DOCUMENTOS: documentos.join("; "),
    CONTATO: texto(emissao.contato),
    DATA: dataPorExtenso(emissao.data || hojeEmBrasilia()),
  };
}

/** Troca os campos de uma linha; devolve o texto e os campos que ficaram sem valor. */
export function trocarCampos(linha, valores) {
  const faltando = [];
  const saida = String(linha ?? "").replace(PADRAO_DO_CAMPO, (inteiro, bruto) => {
    const chave = chaveDoCampo(bruto);
    if (!CHAVES.has(chave)) return inteiro;
    const valor = texto(valores[chave]);
    if (valor) return valor;
    if (!faltando.includes(chave)) faltando.push(chave);
    return ESPACO_EM_BRANCO;
  });
  return { texto: saida, faltando };
}

/**
 * A carta de um candidato: { titulo, blocos: [{ tipo: "paragrafo" | "item",
 * texto }], faltando: [chaves sem valor] }.
 */
export function preencherCarta(modelo = {}, candidato = {}, emissao = {}) {
  const valores = valoresDaCarta(candidato, emissao);
  const faltando = new Set();
  const anotar = (lista) => lista.forEach((chave) => faltando.add(chave));
  const titulo = trocarCampos(texto(modelo.titulo), valores);
  anotar(titulo.faltando);
  const blocos = [];
  for (const bruta of String(modelo.texto ?? "").split(/\r?\n/)) {
    const linha = bruta.trim();
    if (!linha) continue;
    const soOCampo = linha.match(/^\{([^{}]{1,40})\}$/);
    if (soOCampo && chaveDoCampo(soOCampo[1]) === "DOCUMENTOS") {
      const documentos = listaDeDocumentos(emissao.documentos);
      if (!documentos.length) {
        faltando.add("DOCUMENTOS");
        blocos.push({ tipo: "item", texto: ESPACO_EM_BRANCO });
      } else
        documentos.forEach((documento) =>
          blocos.push({ tipo: "item", texto: documento }),
        );
      continue;
    }
    const item = linha.match(/^[-•]\s+(.*)$/);
    const trocada = trocarCampos(item ? item[1] : linha, valores);
    anotar(trocada.faltando);
    blocos.push({ tipo: item ? "item" : "paragrafo", texto: trocada.texto });
  }
  return { titulo: titulo.texto, blocos, faltando: [...faltando] };
}

// ── Validação ───────────────────────────────────────────────────────────

const ROTULO = Object.fromEntries(
  CAMPOS_DA_CARTA.map((campo) => [campo.chave, campo.rotulo]),
);
export const rotuloDoCampo = (chave) => ROTULO[chave] || chave;

/**
 * O rascunho do modelo antes de salvar: { erros, avisos }.
 * `versaoAtual` > 0 = editando (o motivo passa a ser obrigatório).
 */
export function validarModelo(rascunho = {}, { versaoAtual = 0 } = {}) {
  const erros = [];
  const avisos = [];
  const nome = texto(rascunho.nome);
  const titulo = texto(rascunho.titulo);
  const corpo = texto(rascunho.texto);
  if (nome.length < 3 || nome.length > 120)
    erros.push("O nome do modelo deve ter de 3 a 120 caracteres.");
  if (!titulo || titulo.length > 300)
    erros.push("O título deve ter de 1 a 300 caracteres.");
  if (!corpo || corpo.length > 20000)
    erros.push("O texto da carta deve ter de 1 a 20.000 caracteres.");
  if (texto(rascunho.local).length > 500 || texto(rascunho.contato).length > 500)
    erros.push("Local e contato vão até 500 caracteres.");
  if (texto(rascunho.documentos).length > 5000)
    erros.push("Os documentos vão até 5.000 caracteres.");
  const prazo = texto(rascunho.prazoDias);
  if (prazo && !/^\d{1,2}$/.test(prazo)) erros.push("O prazo vai de 0 a 90 dias.");
  else if (prazo && Number(prazo) > 90) erros.push("O prazo vai de 0 a 90 dias.");
  const desconhecidos = camposDesconhecidos(titulo, corpo);
  if (desconhecidos.length)
    erros.push(
      `Campo desconhecido: ${desconhecidos.map((c) => `{${c}}`).join(", ")}.`,
    );
  if (chavesQuebradas(titulo) || chavesQuebradas(corpo))
    erros.push("Há uma chave { ou } sem par no texto.");
  if (versaoAtual > 0) {
    const motivo = texto(rascunho.motivo);
    if (motivo.length < 3 || motivo.length > 500)
      erros.push("Informe o motivo da alteração (3 a 500 caracteres).");
  }
  if (camposUsados(titulo, corpo).includes("CPF"))
    avisos.push(
      "A lista de aprovados não guarda CPF: {CPF} sai em branco até o CPF chegar à lista.",
    );
  return { erros, avisos };
}

/**
 * A emissão antes de gerar: { erros, avisos }.
 *   modelo     a versão vigente ({ titulo, texto })
 *   candidatos as linhas escolhidas
 *   emissao    { dataLimite, local, documentos, contato }
 *   hoje       "AAAA-MM-DD"
 */
export function validarEmissao({
  modelo,
  candidatos = [],
  emissao = {},
  hoje = hojeEmBrasilia(),
} = {}) {
  const erros = [];
  const avisos = [];
  if (!modelo) erros.push("Escolha o modelo da carta.");
  if (!candidatos.length) erros.push("Escolha ao menos um candidato.");
  if (candidatos.length > 500) erros.push("No máximo 500 candidatos por carta.");
  if (!modelo) return { erros, avisos };
  const usados = camposUsados(modelo.titulo, modelo.texto);
  if (usados.includes("DATA_LIMITE")) {
    if (!texto(emissao.dataLimite)) erros.push("Informe a data limite.");
    else if (texto(emissao.dataLimite) < hoje)
      erros.push("A data limite já passou.");
  }
  for (const [chave, campo] of [
    ["LOCAL", "local"],
    ["DOCUMENTOS", "documentos"],
    ["CONTATO", "contato"],
  ])
    if (usados.includes(chave) && !texto(emissao[campo]))
      erros.push(`Informe ${rotuloDoCampo(chave).toLowerCase()}.`);
  const semValor = new Map();
  for (const candidato of candidatos) {
    const { faltando } = preencherCarta(modelo, candidato, emissao);
    faltando
      .filter((chave) => CAMPOS_DA_CARTA.find((c) => c.chave === chave)?.origem === "candidato")
      .forEach((chave) => {
        if (!semValor.has(chave)) semValor.set(chave, []);
        semValor.get(chave).push(texto(candidato.nome));
      });
  }
  for (const [chave, nomes] of semValor)
    avisos.push(
      `${rotuloDoCampo(chave)} em branco para ${nomes.length === 1 ? nomes[0] : `${nomes.length} candidatos`}.`,
    );
  const comStatus = candidatos.filter(
    (c) => texto(c.status) && texto(c.status) !== "Convocado",
  );
  if (comStatus.length)
    avisos.push(
      `${comStatus.length === 1 ? `${texto(comStatus[0].nome)} já está` : `${comStatus.length} candidatos já estão`} com outro status (${[...new Set(comStatus.map((c) => texto(c.status)))].join(", ")}).`,
    );
  return { erros, avisos };
}

// ── Modelos do banco ────────────────────────────────────────────────────

/** O modelo que a tela oferece quando a área ainda não tem nenhum. */
export const MODELO_PADRAO = Object.freeze({
  nome: "Carta de convocação para contratação",
  titulo: "CARTA DE CONVOCAÇÃO PARA CONTRATAÇÃO",
  texto: [
    "Prezado(a) **{NOME}**,",
    "A Agência Brasileira de Apoio à Gestão do SUS (AgSUS) convoca Vossa Senhoria, aprovado(a) no processo seletivo do Edital nº {EDITAL} na {POSICAO}ª posição ({MODALIDADE}), para a contratação no cargo de **{CARGO}**, vaga {VAGA}, com lotação em {LOTACAO}.",
    "Vossa Senhoria deverá apresentar-se até **{DATA_LIMITE}**, em {LOCAL}, com os seguintes documentos:",
    "{DOCUMENTOS}",
    "O não comparecimento no prazo será considerado desistência da vaga, nos termos do edital.",
    "Dúvidas: {CONTATO}.",
  ].join("\n"),
  local: "",
  documentos: [
    "Documento de identidade com foto",
    "CPF",
    "Comprovante de residência",
    "Comprovante de escolaridade exigida para o cargo",
    "Registro no conselho de classe, quando exigido",
  ].join("\n"),
  contato: "",
  prazoDias: "5",
});

const versaoDe = (bruto) => ({
  titulo: texto(bruto?.titulo),
  texto: String(bruto?.texto ?? ""),
  local: texto(bruto?.local),
  documentos: String(bruto?.documentos ?? ""),
  contato: texto(bruto?.contato),
  prazoDias:
    bruto?.prazo_dias === null || bruto?.prazo_dias === undefined
      ? ""
      : String(bruto.prazo_dias),
  usuario: texto(bruto?.usuario),
  salvoEm: texto(bruto?.salvo_em),
});

/** A resposta de listar_modelos_carta_convocacao, normalizada. */
export function lerModelosDoBanco(dados) {
  const modelos = Array.isArray(dados?.modelos) ? dados.modelos : [];
  return {
    podeEditar: dados?.pode_editar === true,
    modelos: modelos.map((m) => ({
      id: texto(m.modelo_id),
      area: texto(m.area),
      editalId: m.edital_id ? texto(m.edital_id) : "",
      edital: texto(m.edital),
      unidade: texto(m.unidade),
      nome: texto(m.nome),
      ativo: m.ativo !== false,
      motivoSituacao: texto(m.motivo_situacao),
      versao: Number(m.versao) || 1,
      atualizadoEm: texto(m.atualizado_em),
      cartas: Number(m.cartas) || 0,
      vigente: versaoDe(m.vigente),
      versoes: (Array.isArray(m.versoes) ? m.versoes : []).map((v) => ({
        versao: Number(v.versao) || 0,
        motivo: texto(v.motivo),
        usuario: texto(v.usuario),
        salvoEm: texto(v.salvo_em),
      })),
    })),
  };
}

/**
 * Os modelos que servem para emitir a carta destes candidatos: ativos, da
 * área ou do edital de TODOS eles; os do edital primeiro.
 */
export function modelosParaEmitir(modelos, candidatos) {
  const editais = new Set((candidatos || []).map((c) => texto(c.edital_id)));
  const unico = editais.size === 1 ? [...editais][0] : "";
  return (modelos || [])
    .filter((m) => m.ativo && (!m.editalId || m.editalId === unico))
    .sort(
      (a, b) =>
        Number(Boolean(b.editalId)) - Number(Boolean(a.editalId)) ||
        a.nome.localeCompare(b.nome, "pt-BR"),
    );
}

/** O rascunho do formulário a partir de um modelo (ou do padrão, para criar). */
export function rascunhoDoModelo(modelo = null) {
  if (!modelo)
    return { ...MODELO_PADRAO, editalId: "", motivo: "" };
  return {
    nome: modelo.nome,
    titulo: modelo.vigente.titulo,
    texto: modelo.vigente.texto,
    local: modelo.vigente.local,
    documentos: modelo.vigente.documentos,
    contato: modelo.vigente.contato,
    prazoDias: modelo.vigente.prazoDias,
    editalId: modelo.editalId,
    motivo: "",
  };
}

/** O p_conteudo de salvar_modelo_carta_convocacao. */
export function conteudoParaSalvar(rascunho = {}) {
  const prazo = texto(rascunho.prazoDias);
  return {
    nome: texto(rascunho.nome),
    titulo: texto(rascunho.titulo),
    texto: String(rascunho.texto ?? "").replace(/\r\n?/g, "\n").trim(),
    local: texto(rascunho.local),
    documentos: listaDeDocumentos(rascunho.documentos).join("\n"),
    contato: texto(rascunho.contato),
    prazo_dias: prazo === "" ? null : Number(prazo),
  };
}

/** Os valores da emissão a partir da versão vigente do modelo. */
export function emissaoInicial(modelo, hoje = hojeEmBrasilia()) {
  const vigente = modelo?.vigente || {};
  return {
    dataLimite:
      vigente.prazoDias === "" || vigente.prazoDias === undefined
        ? ""
        : dataLimitePadrao(hoje, Number(vigente.prazoDias)),
    local: vigente.local || "",
    documentos: vigente.documentos || "",
    contato: vigente.contato || "",
  };
}

/** O p_campos de registrar_carta_convocacao. */
export function camposParaRegistrar(emissao = {}) {
  return {
    data_limite: texto(emissao.dataLimite) || null,
    local: texto(emissao.local),
    documentos: listaDeDocumentos(emissao.documentos).join("\n"),
    contato: texto(emissao.contato),
  };
}

/**
 * A assinatura de uma emissão (modelo, versão, candidatos na ordem,
 * agrupamento e valores): a tela registra uma vez por assinatura, mesmo que a
 * pessoa baixe o DOCX e depois imprima o PDF da mesma carta.
 */
export function assinaturaDaEmissao({
  modeloId,
  versao,
  candidatoIds,
  agrupamento,
  emissao,
}) {
  return JSON.stringify([
    modeloId,
    versao,
    candidatoIds,
    agrupamento,
    camposParaRegistrar(emissao),
  ]);
}
