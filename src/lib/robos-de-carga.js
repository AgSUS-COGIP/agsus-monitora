/*
  Os robôs de carga (GitHub Actions) e o pedido pelo banco, sem DOM e sem rede.

  Usado por:
    Configurações › Status   a lista fixa (robô → arquivo do workflow), o
    das atualizações         estado do botão "Rodar agora" e o "Rodar com
                             opções": OPCOES_DOS_ROBOS (a lista branca de cada
                             robô), separarCodigos e validarOpcoes — a mesma
                             conferência que o banco refaz em disparar_robo;
    Avaliação documental ›   o "Recalcular" da coordenação, que pede a
    Pré-classificação        pré-classificação de um edital só.

  O pedido vai pela RPC disparar_robo (20261008140000): o banco confere quem
  pede e as opções e chama o GitHub com a chave do Vault (github_disparo_robos).
  A tela acompanha por situacao_do_disparo_robo (PEDIDO → ACEITO, FALHOU ou
  SEM_TOKEN). O botão fica desabilitado enquanto a carga roda (execução
  EM_ANDAMENTO no log do banco, começada há menos que o tempo limite do
  workflow) e por alguns minutos depois do pedido.
*/

/* O id é o mesmo da linha do Status das atualizações (visaoSimples). */
export const ROBOS_DE_CARGA = Object.freeze([
  Object.freeze({
    id: "empregare",
    nome: "Robô da Empregare",
    workflow: "robo-empregare.yml",
    limiteMin: 120,
  }),
  Object.freeze({
    id: "selecao",
    nome: "Seleção",
    workflow: "sincronizar-selecao.yml",
    limiteMin: 10,
  }),
  Object.freeze({
    id: "entrevistas",
    nome: "Entrevistas",
    workflow: "sincronizar-entrevistas.yml",
    limiteMin: 10,
  }),
  Object.freeze({
    id: "conferencias",
    nome: "Conferências de consistência",
    workflow: "conferencias.yml",
    limiteMin: 20,
  }),
  /* Tira do Storage os arquivos da fila de expurgo dos anexos do chat (20261007250000). */
  Object.freeze({
    id: "expurgo_chat",
    nome: "Expurgo dos anexos do chat",
    workflow: "expurgo-anexos-chat.yml",
    limiteMin: 20,
  }),
  /*
    porEdital: além do administrador global (Rodar agora, todos os editais),
    a coordenação do edital dispara para um edital só (Recalcular da aba
    Pré-classificação); o banco decide em pode_recalcular_pre_classificacao.
  */
  Object.freeze({
    id: "pre_classificacao",
    nome: "Pré-classificação (Avaliação documental)",
    workflow: "pre-classificacao.yml",
    limiteMin: 20,
    porEdital: true,
  }),
]);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** O id de edital do pedido (uuid) ou "" (todos os editais). */
export function editalDoPedido(valor) {
  const texto = String(valor ?? "").trim();
  return UUID.test(texto) ? texto.toLowerCase() : "";
}

/*
  "Rodar com opções" (Status das atualizações, só administrador global): o
  que cada robô aceita no workflow_dispatch — a mesma lista branca de
  disparar_robo, no banco. Os modos são os `options` do input `modo` de
  cada workflow; `editais` diz o
  formato aceito ("numero" = 93/2026; "numero_ou_id" = 93/2026 ou o id do
  edital); `vagas`, códigos da Empregare; `limite`, máximo de vagas;
  `anexos`, aceita "Guardar links dos anexos do questionário" (só nos modos
  normal e forcar). O modo sondar pede uma única vaga, sem editais, e limite
  de 1 a 3 candidatos (20261008190000).
*/
/** @type {Readonly<Record<string, import("../componentes/saude-das-cargas/tipos.ts").OpcoesDoRobo>>} */
export const OPCOES_DOS_ROBOS = Object.freeze({
  empregare: Object.freeze({
    modos: Object.freeze([
      {
        valor: "normal",
        rotulo: "Normal",
        explicacao: "Exporta, baixa e grava os candidatos de cada vaga.",
      },
      {
        valor: "seco",
        rotulo: "Seco",
        explicacao:
          "Só lista as vagas que exportaria, sem entrar na Empregare. O resultado fica no resumo do GitHub.",
      },
      {
        valor: "fumaca",
        rotulo: "Fumaça",
        explicacao:
          "Só testa o login na Empregare; editais e vagas não contam.",
      },
      {
        valor: "forcar",
        rotulo: "Forçar",
        explicacao:
          "Grava mesmo se o arquivo vier com menos da metade dos candidatos ativos.",
      },
      {
        valor: "sondar",
        rotulo: "Sondar",
        explicacao:
          "Só lê a estrutura das respostas do questionário de 1 a 3 candidatos de uma vaga (diagnóstico); não grava nada.",
      },
    ]),
    editais: "numero",
    vagas: true,
    limite: Object.freeze({ min: 1, max: 500, padrao: 60 }),
    anexos: true,
  }),
  pre_classificacao: Object.freeze({
    modos: Object.freeze([
      {
        valor: "normal",
        rotulo: "Normal",
        explicacao: "Calcula e grava a Lista Provisória e o lote de cada vaga.",
      },
      {
        valor: "seco",
        rotulo: "Seco",
        explicacao:
          "Só calcula; nada é gravado. O resultado fica no resumo do GitHub.",
      },
      {
        valor: "refazer_lote",
        rotulo: "Refazer lote",
        explicacao:
          "Recorta o lote de convocação do zero. Só antes das fichas começarem.",
      },
    ]),
    editais: "numero_ou_id",
    vagas: false,
    limite: null,
  }),
  conferencias: Object.freeze({
    modos: Object.freeze([
      {
        valor: "normal",
        rotulo: "Normal",
        explicacao: "Confere e grava os avisos.",
      },
      {
        valor: "seco",
        rotulo: "Seco",
        explicacao:
          "Só confere; nenhum aviso muda. O resultado fica no resumo do GitHub.",
      },
    ]),
    editais: null,
    vagas: false,
    limite: null,
  }),
});

export const MAXIMO_DE_EDITAIS = 100;
export const MAXIMO_DE_VAGAS = 500;
const NUMERO_DO_EDITAL = /^\d{1,4}\/\d{4}$/;
const CODIGO_DE_VAGA = /^\d{1,20}$/;
const CHAVES_DAS_OPCOES = ["modo", "editais", "vagas", "limite", "anexos"];
/* Os modos em que o robô da Empregare guarda os links dos anexos. */
export const MODOS_COM_ANEXOS = Object.freeze(["normal", "forcar"]);
export const LIMITE_DA_SONDAGEM = 3;

/**
 * Códigos de vaga colados (vírgula, ponto e vírgula, espaço ou linha):
 * { codigos } só com dígitos, sem repetir, e { invalidos } — o resto.
 */
/** @param {unknown} texto @returns {{ codigos: string[], invalidos: string[] }} */
export function separarCodigos(texto) {
  const partes = (Array.isArray(texto) ? texto : [texto])
    .flatMap((t) => String(t ?? "").split(/[\s,;]+/))
    .filter(Boolean);
  const codigos = [];
  const invalidos = [];
  for (const parte of partes) {
    const lista = CODIGO_DE_VAGA.test(parte) ? codigos : invalidos;
    if (!lista.includes(parte)) lista.push(parte);
  }
  return { codigos, invalidos };
}

const listaDoPedido = (valor) =>
  (Array.isArray(valor) ? valor : String(valor ?? "").split(","))
    .map((v) => String(v ?? "").trim())
    .filter(Boolean);

/**
 * Confere as opções de "Rodar com opções" contra a lista branca do robô.
 * Devolve { opcoes: { modo, editais, vagas, limite } } ou
 * { erro: <código>, texto } — texto curto para a tela.
 */
/**
 * @param {import("../componentes/saude-das-cargas/tipos.ts").RoboDeCarga | null} robo
 * @param {unknown} bruto
 * @returns {import("../componentes/saude-das-cargas/tipos.ts").ResultadoDasOpcoes}
 */
export function validarOpcoes(robo, bruto) {
  const aceitas = OPCOES_DOS_ROBOS[robo?.id];
  if (!aceitas)
    return {
      erro: "sem_opcoes",
      texto: "Esta carga só roda com os padrões.",
    };
  if (!bruto || typeof bruto !== "object" || Array.isArray(bruto))
    return { erro: "opcoes_invalidas", texto: "Opções inválidas." };
  for (const chave of Object.keys(bruto)) {
    const valor = bruto[chave];
    const vazio =
      valor === null ||
      valor === undefined ||
      valor === "" ||
      valor === false ||
      valor === "false" ||
      (Array.isArray(valor) && !valor.length);
    if (
      !CHAVES_DAS_OPCOES.includes(chave) ||
      (!aceitas[chave] && !vazio && chave !== "modo")
    )
      return {
        erro: "opcao_nao_aceita",
        texto: `${robo.nome} não aceita “${String(chave).slice(0, 30)}”.`,
      };
  }

  const modo = String(bruto.modo ?? "normal").trim() || "normal";
  if (!aceitas.modos.some((m) => m.valor === modo))
    return { erro: "modo_invalido", texto: "Modo inválido para este robô." };

  const editais = [];
  if (aceitas.editais)
    for (const texto of listaDoPedido(bruto.editais)) {
      const id = editalDoPedido(texto);
      const valido =
        NUMERO_DO_EDITAL.test(texto) ||
        (aceitas.editais === "numero_ou_id" && id);
      if (!valido)
        return {
          erro: "edital_invalido",
          texto:
            aceitas.editais === "numero"
              ? `Edital inválido: ${texto.slice(0, 40)} (use o número, como 93/2026).`
              : `Edital inválido: ${texto.slice(0, 40)}.`,
        };
      const normalizado = id || texto;
      if (!editais.includes(normalizado)) editais.push(normalizado);
    }
  if (editais.length > MAXIMO_DE_EDITAIS)
    return {
      erro: "editais_demais",
      texto: `No máximo ${MAXIMO_DE_EDITAIS} editais por vez.`,
    };

  let vagas = [];
  if (aceitas.vagas) {
    const { codigos, invalidos } = separarCodigos(bruto.vagas ?? "");
    if (invalidos.length)
      return {
        erro: "vaga_invalida",
        texto: `Código de vaga inválido: ${invalidos.slice(0, 3).join(", ").slice(0, 60)} (só dígitos).`,
      };
    if (codigos.length > MAXIMO_DE_VAGAS)
      return {
        erro: "vagas_demais",
        texto: `No máximo ${MAXIMO_DE_VAGAS} vagas por vez.`,
      };
    vagas = codigos;
  }

  let limite = null;
  const textoDoLimite = String(bruto.limite ?? "").trim();
  if (aceitas.limite && textoDoLimite) {
    const numero = /^\d{1,3}$/.test(textoDoLimite)
      ? Number(textoDoLimite)
      : NaN;
    if (!(numero >= aceitas.limite.min && numero <= aceitas.limite.max))
      return {
        erro: "limite_invalido",
        texto: `Limite de ${aceitas.limite.min} a ${aceitas.limite.max} vagas.`,
      };
    limite = numero;
  }

  if (modo === "sondar") {
    if (vagas.length !== 1 || editais.length)
      return {
        erro: "sondar_uma_vaga",
        texto: "O modo Sondar pede um único código de vaga (sem editais).",
      };
    if (limite !== null && limite > LIMITE_DA_SONDAGEM)
      return {
        erro: "limite_invalido",
        texto: `No modo Sondar, o limite é de 1 a ${LIMITE_DA_SONDAGEM} candidatos.`,
      };
  }

  const anexos =
    Boolean(aceitas.anexos) &&
    (bruto.anexos === true || bruto.anexos === "true");
  if (anexos && !MODOS_COM_ANEXOS.includes(modo))
    return {
      erro: "anexos_no_modo",
      texto: "Guardar os links dos anexos só nos modos Normal e Forçar.",
    };

  return {
    opcoes: {
      modo,
      editais,
      vagas,
      limite,
      ...(anexos ? { anexos: true } : {}),
    },
  };
}

/** @param {unknown} id @returns {import("../componentes/saude-das-cargas/tipos.ts").RoboDeCarga | null} */
export const roboDeCarga = (id) =>
  ROBOS_DE_CARGA.find((r) => r.id === String(id || "")) || null;

/* Depois do clique, o botão espera até o GitHub mostrar a execução. */
export const ESPERA_DO_PEDIDO_MIN = 3;

/**
 * Estado do botão de um robô.
 *   linha     a linha do Status das atualizações (partes[0].ultima)
 *   pedidoEm  Date do último clique nesta tela, ou null
 * Devolve { desabilitado, rotulo }.
 */
/**
 * @param {{ robo: import("../componentes/saude-das-cargas/tipos.ts").RoboDeCarga, linha: import("../componentes/saude-das-cargas/tipos.ts").LinhaDaSaude, pedidoEm?: Date | null, agora?: Date }} props
 */
export function estadoDoBotao({
  robo,
  linha,
  pedidoEm = null,
  agora = new Date(),
}) {
  const minutos = (d) =>
    d instanceof Date ? (agora.getTime() - d.getTime()) / 60000 : Infinity;
  const ultima = linha?.partes?.[0]?.ultima;
  if (
    ultima?.situacao === "andamento" &&
    minutos(ultima.inicio) < (robo.limiteMin || 120)
  )
    return { desabilitado: true, rotulo: "Rodando…" };
  if (minutos(pedidoEm) < ESPERA_DO_PEDIDO_MIN)
    return { desabilitado: true, rotulo: "Pedido enviado" };
  return { desabilitado: false, rotulo: "Rodar agora" };
}

/* ── O pedido pelo banco (20261008140000) ─────────────────────────────── */

export const RPC_DISPARAR_ROBO = "disparar_robo";
export const RPC_SITUACAO_DO_DISPARO = "situacao_do_disparo_robo";

export const MENSAGEM_DA_CHAVE =
  "A chave de disparo dos robôs expirou ou foi recusada; um administrador precisa trocá-la no cofre (Vault) com o nome github_disparo_robos.";

/* Os códigos HTTP do GitHub que querem dizer "a chave não serve". */
const CHAVE_RECUSADA = new Set([401, 403, 404]);

/**
 * O que vai em p_inputs de disparar_robo: as opções já conferidas por
 * validarOpcoes (modo, editais, vagas, limite, anexos) ou, no Recalcular da
 * coordenação, só o edital. Sem nada, {} (o banco usa o modo normal).
 */
/** @param {{ opcoes?: import("../componentes/saude-das-cargas/tipos.ts").OpcoesConferidas | null, edital?: string }} [pedido] @returns {import("../componentes/saude-das-cargas/tipos.ts").InputsDoPedido} */
export function inputsDoPedido({ opcoes = null, edital = "" } = {}) {
  const inputs = {};
  if (opcoes?.modo) inputs.modo = opcoes.modo;
  if (opcoes?.editais?.length) inputs.editais = [...opcoes.editais];
  if (opcoes?.vagas?.length) inputs.vagas = [...opcoes.vagas];
  if (opcoes?.limite) inputs.limite = String(opcoes.limite);
  if (opcoes?.anexos) inputs.anexos = true;
  // O banco confere o id (e se quem pede coordena o edital).
  const id = String(edital ?? "").trim();
  if (!opcoes && id) inputs.editais = [id];
  return inputs;
}

/**
 * A resposta de situacao_do_disparo_robo em { situacao, http, mensagem,
 * terminou, aviso } — `aviso` ({ tom, texto }) só quando o GitHub não aceitou.
 */
/** @param {unknown} entrada @returns {import("../componentes/saude-das-cargas/tipos.ts").SituacaoDoPedido} */
export function situacaoDoPedido(entrada) {
  const bruta =
    entrada !== null && typeof entrada === "object" && !Array.isArray(entrada)
      ? entrada
      : {};
  const situacao =
    typeof bruta.situacao === "string" && bruta.situacao
      ? bruta.situacao
      : "PEDIDO";
  const http =
    (typeof bruta.http === "number" ||
      (typeof bruta.http === "string" && bruta.http.trim() !== "")) &&
    Number.isFinite(Number(bruta.http))
      ? Number(bruta.http)
      : null;
  const mensagem =
    typeof bruta.mensagem === "string" ? bruta.mensagem.trim() : "";
  let aviso = null;
  if (
    situacao === "SEM_TOKEN" ||
    (situacao === "FALHOU" && CHAVE_RECUSADA.has(http))
  )
    aviso = { tom: "erro", texto: MENSAGEM_DA_CHAVE };
  else if (situacao === "FALHOU")
    aviso = {
      tom: "erro",
      texto: `O GitHub não aceitou o pedido${mensagem ? ` (${mensagem})` : ""}. Tente de novo em instantes.`,
    };
  return {
    situacao,
    http,
    mensagem,
    terminou: situacao !== "PEDIDO",
    aceito: situacao === "ACEITO",
    aviso,
  };
}

/* O erro da RPC em frase curta para a tela (a mensagem do banco já é em pt-BR). */
/** @param {unknown} erro @param {string} [padrao] @returns {string} */
export function mensagemDoErroDoDisparo(
  erro,
  padrao = "Não consegui pedir a carga.",
) {
  if (erro?.code === "PGRST202")
    return "O banco ainda não tem o disparo dos robôs (migration 20261008140000).";
  const texto = String(erro?.message || "").trim();
  return texto || padrao;
}
