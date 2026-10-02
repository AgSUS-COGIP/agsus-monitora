import { primeiroNome } from "./boas-vindas.js";
import { gravarArmazenamento, lerArmazenamento } from "./comemoracao.js";
import {
  AREAS_DO_SISTEMA,
  areasDoUsuario,
  nomeDaArea,
} from "./menu-lateral.js";
import { LEVELS, RESOURCES } from "./permissoes-recursos.js";

/*
  Comemoração de quem acabou de ganhar (ou recuperar) acesso, com a lista do
  que a pessoa pode usar agora. Sem DOM; quem mostra é
  src/modules/comemoracao-do-acesso.js, com o confete e o aviso comuns a todas
  as comemorações (src/modules/comemoracao.js, regra em src/lib/comemoracao.js).
  As marcas do fim do arquivo também são gravadas pela tela de pedido de
  acesso (src/app/entrada/pedido-de-acesso.js).

  Quando comemorar, sem campo novo no banco:
    - "reativado": a tela de acesso desativado já foi mostrada a esta pessoa
      neste navegador (marca por usuário) e agora o perfil está ativo;
    - "liberado": a pessoa clicou em "Entrar agora" na tela de pedido
      liberado (marca na sessão do navegador antes da recarga); ou é a
      primeira entrada de quem foi CONVIDADO: a conta Google (auth) foi criada
      há menos de um dia e o perfil já existia antes dela; ou o perfil foi
      criado há até 3 dias (pedido aprovado, acesso básico automático).
  "liberado" aparece uma vez por pessoa (chave por usuário no localStorage);
  "reativado", uma vez por reativação (a marca de desativado é apagada).
*/

export const CHAVE_PENDENTE = "agsus_monitora_acesso_liberado_pendente";
export const PREFIXO_DA_CHAVE = "agsus_monitora_acesso_liberado:";
export const PREFIXO_DA_DESATIVACAO = "agsus_monitora_acesso_desativado:";
export const JANELA_DA_PRIMEIRA_ENTRADA_MS = 24 * 60 * 60 * 1000;
export const JANELA_DO_PERFIL_NOVO_MS = 3 * 24 * 60 * 60 * 1000;

const limpo = (valor) => String(valor ?? "").trim();

export const chaveDoUsuario = (usuarioId) =>
  `${PREFIXO_DA_CHAVE}${limpo(usuarioId)}`;
export const chaveDaDesativacao = (usuarioId) =>
  `${PREFIXO_DA_DESATIVACAO}${limpo(usuarioId)}`;

const instante = (valor) => {
  if (!valor) return NaN;
  return (valor instanceof Date ? valor : new Date(valor)).getTime();
};

/**
 * Primeira entrada de convidado: conta de login recente e perfil anterior a
 * ela (foi cadastrado por um administrador antes de a pessoa entrar).
 */
export function primeiraEntradaDeConvidado({
  contaCriadaEm,
  perfilCriadoEm,
  agora = Date.now(),
} = {}) {
  const conta = instante(contaCriadaEm);
  const perfil = instante(perfilCriadoEm);
  const hoje = instante(agora);
  if ([conta, perfil, hoje].some(Number.isNaN)) return false;
  const idadeDaConta = hoje - conta;
  return (
    idadeDaConta >= 0 &&
    idadeDaConta <= JANELA_DA_PRIMEIRA_ENTRADA_MS &&
    perfil <= conta
  );
}

/**
 * Perfil criado há pouco (pedido aprovado, acesso básico automático): quem
 * ainda não viu a comemoração neste navegador vê agora.
 */
export function perfilRecente({ perfilCriadoEm, agora = Date.now() } = {}) {
  const perfil = instante(perfilCriadoEm);
  const hoje = instante(agora);
  if (Number.isNaN(perfil) || Number.isNaN(hoje)) return false;
  return hoje - perfil >= 0 && hoje - perfil <= JANELA_DO_PERFIL_NOVO_MS;
}

/** "reativado", "liberado" ou null (nada a comemorar). */
export function tipoDeComemoracao({
  usuarioId,
  estavaDesativada = false,
  jaComemorou = false,
  pedidoLiberado = false,
  contaCriadaEm = null,
  perfilCriadoEm = null,
  agora = Date.now(),
} = {}) {
  if (!limpo(usuarioId)) return null;
  if (estavaDesativada) return "reativado";
  if (jaComemorou) return null;
  if (pedidoLiberado) return "liberado";
  return primeiraEntradaDeConvidado({ contaCriadaEm, perfilCriadoEm, agora }) ||
    perfilRecente({ perfilCriadoEm, agora })
    ? "liberado"
    : null;
}

/** A frase, com o primeiro nome (ou a parte do e-mail antes do @). */
export function mensagemDaComemoracao(tipo, nome, email = "") {
  const primeiro = primeiroNome(
    limpo(nome) || limpo(email).split("@")[0].split(/[._-]/)[0],
  );
  const vocativo = primeiro ? `, ${primeiro}` : "";
  return tipo === "reativado"
    ? `Bem-vindo(a) de volta${vocativo}! Seu acesso foi reativado.`
    : `Parabéns${vocativo}! Seu acesso ao MONITORA foi liberado.`;
}

/*
  Nível com acesso (qualquer um acima de "sem_acesso"). Administrador global
  sem a matriz de níveis vê tudo.
*/
function temAcesso(perfil, recurso) {
  const nivel = perfil?.permissoes?.[recurso];
  if (!perfil?.permissoes) return Boolean(perfil?.admin_global);
  return LEVELS.findIndex(([valor]) => valor === nivel) >= 1;
}

/**
 * O que a pessoa pode usar agora, em linhas curtas, com os nomes do menu:
 *   ["Saúde Indígena: Visão geral, Editais, Análises curriculares", …]
 * Os módulos valem em todas as áreas da pessoa (a permissão não é por área).
 */
export function oQuePodeUsar(perfil) {
  if (!perfil) return [];
  const modulos = RESOURCES.filter(([id]) => temAcesso(perfil, id)).map(
    ([, rotulo]) => rotulo,
  );
  if (!modulos.length) return [];
  const areas = perfil.admin_global
    ? AREAS_DO_SISTEMA.map((area) => area.id)
    : areasDoUsuario(perfil.areas);
  const lista = modulos.join(", ");
  const nomes = areas.map(nomeDaArea).filter(Boolean);
  return nomes.length ? nomes.map((nome) => `${nome}: ${lista}`) : [lista];
}

// ── Marcas no navegador (armazenamento em try/catch: janela privada, bloqueado) ──

/** "Entrar agora" (pedido liberado), antes de recarregar a página. */
export function marcarBoasVindasPendentes(janela = globalThis.window) {
  gravarArmazenamento(janela?.sessionStorage, CHAVE_PENDENTE, "1");
}

/** A tela de acesso desativado foi mostrada: na volta, é "reativado". */
export function lembrarContaDesativada(usuarioId, janela = globalThis.window) {
  if (usuarioId)
    gravarArmazenamento(
      janela?.localStorage,
      chaveDaDesativacao(usuarioId),
      "1",
    );
}

/** A tela de conta desativada já foi mostrada a esta pessoa (e ela não voltou)? */
export function contaMarcadaComoDesativada(
  usuarioId,
  janela = globalThis.window,
) {
  return Boolean(
    usuarioId &&
    lerArmazenamento(janela?.localStorage, chaveDaDesativacao(usuarioId)),
  );
}
