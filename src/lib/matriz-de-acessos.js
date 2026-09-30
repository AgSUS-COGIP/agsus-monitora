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
    return {
      valor: usuario.coordenacao ?? null,
      revisao: usuario.revisao_conta,
    };
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
  for (const k of rascunho.keys())
    if (k.startsWith(`${usuarioId}/`)) total += 1;
  return total;
}

/**
 * Separa o rascunho de uma pessoa do resto: { daPessoa, resto }. O "Salvar"
 * da gaveta grava só `daPessoa`; o que foi mudado em outras linhas continua
 * pendente.
 */
export function separarRascunhoDaPessoa(rascunho, usuarioId) {
  const daPessoa = new Map();
  const resto = new Map();
  for (const [k, entrada] of rascunho)
    (k.startsWith(`${usuarioId}/`) ? daPessoa : resto).set(k, entrada);
  return { daPessoa, resto };
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
export function celulaExibida(
  usuario,
  recurso,
  rascunho,
  gruposPorCodigo = {},
) {
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
      conta.push({
        tipo: "grupo",
        usuario_id: usuario.id,
        grupo: valor,
        revisao: base.revisao,
      });
    else if (alvo === ALVO_COORDENACAO)
      conta.push({
        tipo: "coordenacao",
        usuario_id: usuario.id,
        coordenacao: valor,
        revisao: base.revisao,
      });
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
  const nomeDaCoordenacao = new Map(
    coordenacoes.map((c) => [c.codigo, c.nome]),
  );
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
        de:
          base.origem === "excecao"
            ? rotuloDoNivel(base.nivel, alvo)
            : doGrupo(base.nivel_grupo, alvo),
        para:
          valor === null
            ? doGrupo(base.nivel_grupo, alvo)
            : rotuloDoNivel(valor, alvo),
      };
    if (!porUsuario.has(usuario.id))
      porUsuario.set(usuario.id, { usuario, itens: [] });
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
    if (!semEfeito(alvo, nova, entrada.valor))
      proximo.set(k, { ...entrada, base: nova });
  }
  return { rascunho: proximo, conflitos };
}

// ── Visão simples: grupo em uma frase, áreas da pessoa e a trava de área ───────

/** Módulos que contam para a frase do grupo ("acessos" vira frase à parte). */
const MODULOS_DA_FRASE = MODULOS.filter((m) => m.id !== "acessos");
/* "Tudo" não conta Configurações: o módulo não tem nível de leitura. */
const MODULOS_DE_TUDO = MODULOS_DA_FRASE.filter(
  (m) => m.id !== "configuracoes",
);

function listaCurta(rotulos, maximo = 3) {
  const nomes = rotulos.map((r) => r.toLocaleLowerCase("pt-BR"));
  if (nomes.length <= maximo)
    return nomes.length > 1
      ? `${nomes.slice(0, -1).join(", ")} e ${nomes.at(-1)}`
      : nomes[0] || "";
  return `${nomes.slice(0, maximo).join(", ")} e mais ${nomes.length - maximo}`;
}

/**
 * O que o grupo deixa fazer, em uma linha, lida dos níveis do grupo:
 *   "Leitura: vê tudo, não altera nada."
 *   "Edição: altera editais e cronograma; o resto só vê."
 */
export function explicacaoDoGrupo(grupo) {
  if (!grupo) return "";
  if (grupo.admin_global)
    return "Administrador: vê e altera tudo, em todas as áreas.";
  const niveis = grupo.niveis || {};
  const nivelDe = (id) => niveis[id] || "sem_acesso";
  const ve = MODULOS_DA_FRASE.filter((m) => nivelDe(m.id) !== "sem_acesso");
  const altera = ve.filter((m) => ["editor", "admin"].includes(nivelDe(m.id)));
  const gerencia = nivelDe("acessos") === "editor";
  const extra = gerencia ? " Gerencia os acessos da coordenação." : "";
  if (!ve.length)
    return gerencia
      ? `Só gestão de acessos.${extra}`
      : "Sem acesso: não vê nenhuma página.";
  const cobre = (lista) =>
    MODULOS_DE_TUDO.every((m) => lista.some((x) => x.id === m.id));
  const tudo = cobre(ve);
  if (!altera.length)
    return `Leitura: vê ${tudo ? "tudo" : listaCurta(ve.map((m) => m.rotulo))}, não altera nada.${extra}`;
  const resto = ve.length > altera.length ? "; o resto só vê" : "";
  return `Edição: altera ${
    cobre(altera) ? "tudo" : listaCurta(altera.map((m) => m.rotulo))
  }${resto}.${extra}`;
}

/** O grupo em vigor na linha (rascunho ou salvo) é de administrador global? */
export function adminGlobalDaLinha(usuario, rascunho, gruposPorCodigo = {}) {
  const grupo = gruposPorCodigo[grupoDaLinha(usuario, rascunho)];
  return grupo ? Boolean(grupo.admin_global) : Boolean(usuario.admin_global);
}

/** Áreas marcadas uma a uma (area:<id> = "leitor"), já com o rascunho. */
export function areasMarcadasDaLinha(usuario, rascunho, areas = []) {
  return areas
    .map((area) => area.id)
    .filter(
      (id) => celulaExibida(usuario, `area:${id}`, rascunho).nivel === "leitor",
    );
}

/**
 * Regra do banco (salvar_matriz_acessos, 23514): quem não é administrador
 * global só vê as áreas marcadas ou a da coordenação. Sem nenhuma das duas, a
 * pessoa entra e não vê nada.
 */
export function ficariaSemArea({ adminGlobal, coordenacao, areasMarcadas }) {
  return !adminGlobal && !coordenacao && !(areasMarcadas || []).length;
}

/** A pessoa, como está no rascunho, ficaria sem área? (inativa não conta) */
export function linhaFicariaSemArea(
  usuario,
  rascunho,
  { grupos = [], areas = [] } = {},
) {
  if (usuario.ativo === false) return false;
  const gruposPorCodigo = Object.fromEntries(grupos.map((g) => [g.codigo, g]));
  return ficariaSemArea({
    adminGlobal: adminGlobalDaLinha(usuario, rascunho, gruposPorCodigo),
    coordenacao: coordenacaoDaLinha(usuario, rascunho),
    areasMarcadas: areasMarcadasDaLinha(usuario, rascunho, areas),
  });
}

/**
 * Pessoas com alteração pendente que ficariam sem área: o salvar espera até
 * alguém marcar a área (o banco recusaria o lote inteiro). Só confere quem
 * está na página carregada; as demais o banco confere.
 */
export function pessoasSemAreaNoRascunho(rascunho, matriz = {}) {
  const ids = new Set([...rascunho.values()].map((e) => e.usuario.id));
  return (matriz.usuarios || []).filter(
    (usuario) =>
      ids.has(usuario.id) && linhaFicariaSemArea(usuario, rascunho, matriz),
  );
}

/**
 * Áreas que a pessoa vê, para a coluna "Áreas": { todas } para administrador
 * global; senão os ids. Sem alteração pendente vale o que o banco calculou
 * (areas_efetivas); com alteração, a coordenação e as áreas marcadas do
 * rascunho.
 */
export function areasDaLinha(
  usuario,
  rascunho,
  { grupos = [], areas = [], coordenacoes = [] } = {},
) {
  const gruposPorCodigo = Object.fromEntries(grupos.map((g) => [g.codigo, g]));
  if (adminGlobalDaLinha(usuario, rascunho, gruposPorCodigo))
    return { todas: true, ids: [] };
  if (
    !pendenciasDoUsuario(rascunho, usuario.id) &&
    Array.isArray(usuario.areas_efetivas)
  )
    return { todas: false, ids: usuario.areas_efetivas };
  const coordenacao = coordenacaoDaLinha(usuario, rascunho);
  const daCoordenacao = coordenacoes.find(
    (c) => c.codigo === coordenacao,
  )?.area;
  const ids = new Set(areasMarcadasDaLinha(usuario, rascunho, areas));
  if (daCoordenacao) ids.add(daCoordenacao);
  return { todas: false, ids: [...ids] };
}
