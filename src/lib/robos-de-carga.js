/*
  "Rodar agora" das cargas pelo GitHub Actions, sem DOM e sem rede.

  Usado pelos dois lados:
    api/rodar-carga.js       a lista fixa (whitelist) robô → arquivo do workflow,
                             o que conta como execução em curso no GitHub e as
                             mensagens de resposta;
    Configurações › Status   o estado do botão "Rodar agora" de cada carga
    das atualizações         (src/componentes/saude-das-cargas/).

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
]);

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
  sem_token: "Falta configurar GITHUB_DISPATCH_TOKEN na Vercel.",
  robo_invalido: "Carga desconhecida.",
  rodando: "Esta carga já está rodando.",
  github_recusou:
    "O GitHub recusou o pedido: confira o GITHUB_DISPATCH_TOKEN (Actions: read and write).",
  github_fora: "O GitHub não respondeu. Tente de novo em instantes.",
});
