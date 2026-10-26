/*
  Rascunho do formulário do edital — o que a pessoa preencheu e ainda não
  salvou, guardado no navegador (localStorage) para não se perder se a aba
  fechar, a página recarregar ou a sessão cair.

  Uma chave por usuário e por edital ("novo" é por área: o edital novo nasce na
  área do menu). Só o formulário e o cronograma entram — nada de sessão,
  token ou perfil. Todo acesso ao armazenamento passa por try/catch: janela
  privada ou armazenamento bloqueado só deixam de guardar, sem quebrar a tela.

  "Mexido" compara o estado atual com o de quando o formulário abriu
  (`estadoComparavel`): fechar um formulário sem mudança não pergunta nada.
*/

const PREFIXO = "agsus_monitora_rascunho_edital_v1";
/** Rascunho mais velho que isto é ignorado (e apagado) ao abrir. */
const VALIDADE_MS = 14 * 24 * 60 * 60 * 1000;

const txt = (valor) => String(valor ?? "").trim();

/* Os campos do cronograma que a pessoa edita; carga, erro e histórico ficam de fora. */
const CAMPOS_DO_CRONOGRAMA = Object.freeze([
  "automatico",
  "etapas",
  "statusExcepcional",
  "etapaExcepcional",
  "motivoExcepcional",
  "dataExcepcional",
  "retomada",
  "motivo",
  "errata",
]);

function armazenamentoPadrao() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Quem é o usuário, para a chave: o id da conta; na falta dele, o e-mail. */
export function usuarioDoPerfil(perfil) {
  return (
    txt(perfil?.user_id) ||
    txt(perfil?.id) ||
    txt(perfil?.email).toLowerCase() ||
    "anonimo"
  );
}

export function chaveDoRascunho({ usuario, id, area }) {
  const alvo = txt(id)
    ? `edital-${txt(id)}`
    : `novo-${txt(area) || "sem-area"}`;
  return `${PREFIXO}:${txt(usuario) || "anonimo"}:${alvo}`;
}

/** Só as partes editáveis do cronograma. */
export function cronogramaDoRascunho(cronograma) {
  const c = cronograma || {};
  return Object.fromEntries(
    CAMPOS_DO_CRONOGRAMA.map((campo) => [campo, c[campo]]),
  );
}

/**
 * Uma "foto" comparável do formulário. Enquanto o cronograma carrega, ele não
 * entra: nada ali foi mexido ainda.
 */
export function estadoComparavel(formulario, cronograma) {
  return JSON.stringify({
    formulario: formulario || {},
    cronograma: cronograma?.carregando
      ? null
      : cronogramaDoRascunho(cronograma),
  });
}

export function lerRascunho(
  chave,
  armazenamento = armazenamentoPadrao(),
  agora = new Date(),
) {
  try {
    const bruto = armazenamento?.getItem(chave);
    if (!bruto) return null;
    const dados = JSON.parse(bruto);
    const salvoEm = new Date(dados?.salvoEm);
    const valido =
      dados &&
      typeof dados.formulario === "object" &&
      typeof dados.cronograma === "object" &&
      !Number.isNaN(salvoEm.getTime());
    if (!valido || agora.getTime() - salvoEm.getTime() > VALIDADE_MS) {
      armazenamento.removeItem(chave);
      return null;
    }
    return dados;
  } catch {
    return null;
  }
}

export function guardarRascunho(
  chave,
  { formulario, cronograma },
  agora = new Date(),
  armazenamento = armazenamentoPadrao(),
) {
  try {
    armazenamento?.setItem(
      chave,
      JSON.stringify({
        salvoEm: agora.toISOString(),
        formulario,
        cronograma: cronogramaDoRascunho(cronograma),
      }),
    );
    return true;
  } catch {
    return false;
  }
}

export function apagarRascunho(chave, armazenamento = armazenamentoPadrao()) {
  try {
    armazenamento?.removeItem(chave);
  } catch {
    // Sem armazenamento: não havia o que apagar.
  }
}

const doisDigitos = (numero) => String(numero).padStart(2, "0");

/** "14:32" se foi hoje; "27/09 às 14:32" se foi antes. */
export function horaDoRascunho(salvoEm, hoje = new Date()) {
  const data = new Date(salvoEm);
  if (Number.isNaN(data.getTime())) return "";
  const hora = `${doisDigitos(data.getHours())}:${doisDigitos(data.getMinutes())}`;
  const mesmoDia = data.toDateString() === hoje.toDateString();
  if (mesmoDia) return hora;
  return `${doisDigitos(data.getDate())}/${doisDigitos(data.getMonth() + 1)} às ${hora}`;
}
