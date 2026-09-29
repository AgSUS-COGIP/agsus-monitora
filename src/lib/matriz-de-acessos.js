import {
  LEVELS,
  RESOURCES,
  niveisDoRecurso,
  rotuloDoNivel,
  tipoDoRecurso,
} from "./permissoes-recursos.js";

/*
  Permissões de Configurações › Acessos, sem DOM e sem React.

  Cada pessoa segue um GRUPO (níveis por módulo); uma permissão INDIVIDUAL
  vale só para ela e passa por cima do grupo. Cada célula vem do banco
  (obter_matriz_acessos) como
    { nivel, origem: "grupo" | "excecao", nivel_grupo, revisao }
  e o usuário traz `grupo`, `coordenacao` e `revisao_conta` (trava das
  mudanças de conta).

  O RASCUNHO é autocontido: guarda, com cada alteração, a base lida e quem é a
  pessoa. Por isso dá para paginar, buscar e filtrar sem perder o que foi
  mudado.

    chave  "<usuario>/<alvo>"  alvo = recurso | "#grupo" | "#coordenacao"
    valor  { valor, base, usuario: { id, nome, email } }

  Numa célula de recurso, `valor` é um nível ou `null` ("do grupo": apaga a
  permissão individual no banco).
*/

export const ALVO_GRUPO = "#grupo";
export const ALVO_COORDENACAO = "#coordenacao";

const chave = (usuarioId, alvo) => `${usuarioId}/${alvo}`;
const quem = (usuario) => ({
  id: usuario.id,
  nome: usuario.nome || "",
  email: usuario.email || "",
});
const ehConta = (alvo) => alvo === ALVO_GRUPO || alvo === ALVO_COORDENACAO;

/** Colunas de módulo da tabela de usuários. */
export const MODULOS = Object.freeze(
  RESOURCES.map(([id, rotulo]) => ({ id, rotulo, tipo: "modulo" })),
);

function baseDoAlvo(usuario, alvo) {
  if (alvo === ALVO_GRUPO)
    return { valor: usuario.grupo ?? "", revisao: usuario.revisao_conta };
  if (alvo === ALVO_COORDENACAO)
    return { valor: usuario.coordenacao ?? null, revisao: usuario.revisao_conta };
  return (
    usuario.permissoes?.[alvo] || {
      nivel: "sem_acesso",
      origem: "grupo",
      nivel_grupo: "sem_acesso",
      revisao: 0,
    }
  );
}

/** A alteração não muda nada do que está salvo? */
function semEfeito(alvo, base, valor) {
  if (ehConta(alvo)) return (base.valor ?? null) === (valor ?? null);
  if (valor === null) return base.origem !== "excecao";
  return base.origem === "excecao" && base.nivel === valor;
}

/**
 * Registra uma alteração e devolve um rascunho NOVO. Voltar ao que está
 * salvo apaga a entrada.
 */
export function registrarNoRascunho(rascunho, usuario, alvo, valor) {
  const proximo = new Map(rascunho);
  const k = chave(usuario.id, alvo);
  const base = proximo.get(k)?.base ?? baseDoAlvo(usuario, alvo);
  if (
    valor !== null &&
    !ehConta(alvo) &&
    !niveisDoRecurso(alvo).some(([nivel]) => nivel === valor)
  )
    throw new Error("Nível inválido");
  if (semEfeito(alvo, base, valor)) proximo.delete(k);
  else proximo.set(k, { valor, base, usuario: quem(usuario) });
  return proximo;
}

export const contarPendencias = (rascunho) => rascunho.size;

export function pendenciasDoUsuario(rascunho, usuarioId) {
  let total = 0;
  for (const k of rascunho.keys()) if (k.startsWith(`${usuarioId}/`)) total += 1;
  return total;
}

/** Grupo em vigor na linha: o do rascunho, se houver; senão o salvo. */
export function grupoDaLinha(usuario, rascunho) {
  const entrada = rascunho.get(chave(usuario.id, ALVO_GRUPO));
  return entrada ? entrada.valor : usuario.grupo;
}

export function coordenacaoDaLinha(usuario, rascunho) {
  const entrada = rascunho.get(chave(usuario.id, ALVO_COORDENACAO));
  return entrada ? entrada.valor : (usuario.coordenacao ?? null);
}

export const alvoPendente = (rascunho, usuarioId, alvo) =>
  rascunho.has(chave(usuarioId, alvo));

/**
 * O que a célula mostra agora: nível, se vem do grupo ou é individual, o
 * nível do grupo em vigor e se há alteração pendente. Trocar o grupo no
 * rascunho já muda as células que seguem o grupo.
 */
export function celulaExibida(usuario, recurso, rascunho, gruposPorCodigo = {}) {
  const base = baseDoAlvo(usuario, recurso);
  const grupo = grupoDaLinha(usuario, rascunho);
  const nivelGrupo =
    tipoDoRecurso(recurso) === "modulo"
      ? (gruposPorCodigo[grupo]?.niveis?.[recurso] ?? base.nivel_grupo)
      : "sem_acesso";
  const entrada = rascunho.get(chave(usuario.id, recurso));
  if (entrada)
    return entrada.valor === null
      ? { nivel: nivelGrupo, individual: false, nivelGrupo, pendente: true }
      : { nivel: entrada.valor, individual: true, nivelGrupo, pendente: true };
  if (base.origem === "excecao")
    return { nivel: base.nivel, individual: true, nivelGrupo, pendente: false };
  return { nivel: nivelGrupo, individual: false, nivelGrupo, pendente: false };
}

/**
 * O `p_alteracoes` de salvar_matriz_acessos. Mudanças de conta (grupo,
 * coordenação) vão antes: o teto do coordenador confere os níveis com o grupo
 * novo.
 */
export function alteracoesDoRascunho(rascunho) {
  const conta = [];
  const niveis = [];
  for (const [k, { valor, base, usuario }] of rascunho) {
    const alvo = k.slice(k.indexOf("/") + 1);
    if (alvo === ALVO_GRUPO)
      conta.push({ tipo: "grupo", usuario_id: usuario.id, grupo: valor, revisao: base.revisao });
    else if (alvo === ALVO_COORDENACAO)
      conta.push({ tipo: "coordenacao", usuario_id: usuario.id, coordenacao: valor, revisao: base.revisao });
    else {
      if (valor !== null && !LEVELS.some(([nivel]) => nivel === valor))
        throw new Error("Nível inválido");
      niveis.push({
        tipo: "nivel",
        usuario_id: usuario.id,
        recurso: alvo,
        nivel: valor,
        revisao: base.revisao ?? 0,
      });
    }
  }
  return [...conta, ...niveis];
}

/**
 * Revisão agrupada por pessoa: [{ usuario, itens: [{ rotulo, de, para }] }].
 * `nomes` traduz alvo e valor (colunas, grupos e coordenações).
 */
export function resumoDoRascunho(
  rascunho,
  { colunas = MODULOS, grupos = [], coordenacoes = [] } = {},
) {
  const nomeDaColuna = new Map(colunas.map((c) => [c.id, c.rotulo]));
  const nomeDoGrupo = new Map(grupos.map((g) => [g.codigo, g.nome]));
  const nomeDaCoordenacao = new Map(coordenacoes.map((c) => [c.codigo, c.nome]));
  const doGrupo = (nivel, alvo) => `Do grupo (${rotuloDoNivel(nivel, alvo)})`;
  const porUsuario = new Map();
  for (const [k, { valor, base, usuario }] of rascunho) {
    const alvo = k.slice(k.indexOf("/") + 1);
    let item;
    if (alvo === ALVO_GRUPO)
      item = {
        rotulo: "Grupo",
        de: nomeDoGrupo.get(base.valor) || base.valor || "—",
        para: nomeDoGrupo.get(valor) || valor,
      };
    else if (alvo === ALVO_COORDENACAO)
      item = {
        rotulo: "Coordenação",
        de: nomeDaCoordenacao.get(base.valor) || "Sem coordenação",
        para: nomeDaCoordenacao.get(valor) || "Sem coordenação",
      };
    else
      item = {
        rotulo: nomeDaColuna.get(alvo) || alvo,
        de: base.origem === "excecao" ? rotuloDoNivel(base.nivel, alvo) : doGrupo(base.nivel_grupo, alvo),
        para: valor === null ? doGrupo(base.nivel_grupo, alvo) : rotuloDoNivel(valor, alvo),
      };
    if (!porUsuario.has(usuario.id)) porUsuario.set(usuario.id, { usuario, itens: [] });
    porUsuario.get(usuario.id).itens.push(item);
  }
  return [...porUsuario.values()];
}

/**
 * Depois de recarregar (conflito de revisão): o que ainda vale do rascunho.
 * Entrada cuja base mudou vira conflito e sai; as demais usam a base nova.
 */
export function rebasearRascunho(rascunho, usuariosRecarregados = []) {
  const porId = new Map(usuariosRecarregados.map((u) => [u.id, u]));
  const proximo = new Map();
  const conflitos = [];
  for (const [k, entrada] of rascunho) {
    const usuario = porId.get(entrada.usuario.id);
    if (!usuario) {
      proximo.set(k, entrada);
      continue;
    }
    const alvo = k.slice(k.indexOf("/") + 1);
    const nova = baseDoAlvo(usuario, alvo);
    if (String(nova.revisao ?? "") !== String(entrada.base.revisao ?? "")) {
      conflitos.push({ usuario: entrada.usuario, alvo });
      continue;
    }
    if (!semEfeito(alvo, nova, entrada.valor)) proximo.set(k, { ...entrada, base: nova });
  }
  return { rascunho: proximo, conflitos };
}
