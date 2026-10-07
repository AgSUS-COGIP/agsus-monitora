/*
  "Rodar agora" das cargas pelo GitHub Actions, sem DOM e sem rede.

  Usado por:
    api/rodar-carga.js       a lista fixa (whitelist) robô → arquivo do workflow,
                             o que conta como execução em curso no GitHub, os
                             inputs do disparo e as mensagens de resposta;
    Configurações › Status   o estado do botão "Rodar agora" de cada carga
    das atualizações         (src/componentes/saude-das-cargas/) e o "Rodar
                             com opções": OPCOES_DOS_ROBOS (a lista branca de
                             cada robô), separarCodigos e validarOpcoes — a
                             mesma conferência na tela e na função;
    Avaliação documental ›   o "Recalcular" da coordenação, que dispara a
    Pré-classificação        pré-classificação de um edital só.

  O botão fica desabilitado enquanto a carga roda: pelo GitHub (execução na
  fila ou rodando), pelo log do banco (execução EM_ANDAMENTO começada há menos
  que o tempo limite do workflow) ou porque o pedido acabou de sair (o GitHub
  leva alguns segundos para mostrar a execução na fila).
*/

export const ENDERECO_RODAR_CARGA = "/api/rodar-carga";
export const REPOSITORIO_DAS_CARGAS = "AgSUS-COGIP/agsus-monitora";
export const RAMO_DAS_CARGAS = "main";

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
  que cada robô aceita no workflow_dispatch — a lista branca da função. Os
  modos são os `options` do input `modo` de cada workflow; `editais` diz o
  formato aceito ("numero" = 93/2026; "numero_ou_id" = 93/2026 ou o id do
  edital); `vagas`, códigos da Empregare; `limite`, máximo de vagas.
*/
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
    ]),
    editais: "numero",
    vagas: true,
    limite: Object.freeze({ min: 1, max: 500, padrao: 60 }),
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
const CHAVES_DAS_OPCOES = ["modo", "editais", "vagas", "limite"];

/**
 * Códigos de vaga colados (vírgula, ponto e vírgula, espaço ou linha):
 * { codigos } só com dígitos, sem repetir, e { invalidos } — o resto.
 */
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

  return { opcoes: { modo, editais, vagas, limite } };
}

/**
 * O edital que a coordenação pode pedir sem ser administrador global: só no
 * robô por edital, um edital pelo id, no modo normal e sem outras opções.
 * Fora disso, "" (só o administrador global).
 */
export function editalDaCoordenacao(robo, edital, opcoes) {
  if (!robo?.porEdital) return "";
  if (!opcoes) return editalDoPedido(edital);
  const soUmId =
    opcoes.editais?.length === 1 && editalDoPedido(opcoes.editais[0]);
  if (opcoes.modo !== "normal" || opcoes.vagas?.length || opcoes.limite)
    return "";
  return soUmId || "";
}

/**
 * Os inputs do workflow_dispatch de um robô (o edital só nos robôs por
 * edital). `opcoes` (de validarOpcoes, já conferidas) troca o modo e
 * acrescenta editais, vagas e limite — só os que o robô aceita.
 */
export function inputsDoDisparo(robo, usuario, edital = "", opcoes = null) {
  const inputs = {
    modo: opcoes?.modo || "normal",
    disparado_por: String(usuario || ""),
  };
  if (robo?.porEdital) inputs.editais = editalDoPedido(edital);
  if (!opcoes) return inputs;
  const aceitas = OPCOES_DOS_ROBOS[robo?.id] || {};
  if (aceitas.editais && opcoes.editais?.length)
    inputs.editais = opcoes.editais.join(",");
  if (aceitas.vagas && opcoes.vagas?.length)
    inputs.vagas = opcoes.vagas.join(",");
  if (aceitas.limite && opcoes.limite) inputs.limite = String(opcoes.limite);
  return inputs;
}

export const roboDeCarga = (id) =>
  ROBOS_DE_CARGA.find((r) => r.id === String(id || "")) || null;

/* Situações do GitHub Actions de uma execução que ainda não terminou. */
const EM_CURSO_NO_GITHUB = new Set([
  "queued",
  "in_progress",
  "waiting",
  "requested",
  "pending",
]);

/** A execução mais recente ainda em curso (lista de workflow_runs do GitHub), ou null. */
export function execucaoEmCurso(execucoes) {
  return (
    (Array.isArray(execucoes) ? execucoes : []).find((e) =>
      EM_CURSO_NO_GITHUB.has(String(e?.status || "")),
    ) || null
  );
}

/* Depois do clique, o botão espera até o GitHub mostrar a execução. */
export const ESPERA_DO_PEDIDO_MIN = 3;

/**
 * Estado do botão de um robô.
 *   disponibilidade  { status: "carregando" | "ok" | "sem_token" | "indisponivel" | "erro",
 *                      robos: { [id]: { rodando } } }  (resposta do GET de /api/rodar-carga)
 *   linha            a linha do Status das atualizações (emAndamento, partes[0].ultima)
 *   pedidoEm         Date do último clique nesta tela, ou null
 * Devolve { desabilitado, rotulo, aviso } — `aviso` é a frase curta que pede ação.
 */
export function estadoDoBotao({
  robo,
  disponibilidade,
  linha,
  pedidoEm = null,
  agora = new Date(),
}) {
  const status = disponibilidade?.status || "carregando";
  if (status === "sem_token")
    return {
      desabilitado: true,
      rotulo: "Rodar agora",
      aviso: "Falta configurar GITHUB_DISPATCH_TOKEN na Vercel.",
    };
  if (status === "indisponivel")
    return {
      desabilitado: true,
      rotulo: "Rodar agora",
      aviso: "Só na versão publicada.",
    };
  if (status === "erro")
    return {
      desabilitado: true,
      rotulo: "Rodar agora",
      aviso: disponibilidade?.erro || "Não consegui consultar o GitHub.",
    };
  if (status !== "ok")
    return { desabilitado: true, rotulo: "Rodar agora", aviso: "" };

  const minutos = (d) =>
    d instanceof Date ? (agora.getTime() - d.getTime()) / 60000 : Infinity;
  if (disponibilidade?.robos?.[robo.id]?.rodando)
    return { desabilitado: true, rotulo: "Rodando…", aviso: "" };
  const ultima = linha?.partes?.[0]?.ultima;
  if (
    ultima?.situacao === "andamento" &&
    minutos(ultima.inicio) < (robo.limiteMin || 120)
  )
    return { desabilitado: true, rotulo: "Rodando…", aviso: "" };
  if (minutos(pedidoEm) < ESPERA_DO_PEDIDO_MIN)
    return { desabilitado: true, rotulo: "Pedido enviado", aviso: "" };
  return { desabilitado: false, rotulo: "Rodar agora", aviso: "" };
}

/* Mensagens da função para a tela (sem detalhe interno). */
export const MENSAGENS_DO_DISPARO = Object.freeze({
  sem_sessao: "Entre no MONITORA de novo para rodar a carga.",
  sem_permissao: "Só o administrador global roda as cargas.",
  sem_permissao_edital:
    "Só a coordenação da avaliação do edital recalcula a pré-classificação.",
  edital_invalido: "Edital inválido.",
  edital_e_opcoes: "Mande o edital dentro das opções.",
  sem_token: "Falta configurar GITHUB_DISPATCH_TOKEN na Vercel.",
  robo_invalido: "Carga desconhecida.",
  rodando: "Esta carga já está rodando.",
  github_recusou:
    "O GitHub recusou o pedido: confira o GITHUB_DISPATCH_TOKEN (Actions: read and write).",
  github_fora: "O GitHub não respondeu. Tente de novo em instantes.",
});

/**
 * Por que o pedido a /api/rodar-carga não saiu, para a tela: a mensagem da
 * função (`corpo.erro`), "Só na versão publicada." no 404 (fora da Vercel a
 * função não existe) ou `padrao`.
 */
export function motivoDaRecusa(status, corpo, padrao) {
  if (typeof corpo?.erro === "string" && corpo.erro.trim()) return corpo.erro;
  return status === 404 ? "Só na versão publicada." : padrao;
}
