import {
  canManageAccess,
  canManageCoordinations,
  canManageGroups,
  isOwnAccessProfile,
} from "./access-roles.js";
import {
  niveisDoRecurso,
  posicaoDoNivel,
  rotuloDoNivel,
  tipoDoRecurso,
} from "./permissoes-recursos.js";

/*
  O que quem está logado pode fazer em Configurações › Acessos. O banco repete
  tudo (salvar_matriz_acessos, aprovar_solicitacao_acesso); aqui é só para a
  tela não oferecer o que vai ser recusado.

  O teto vem de obter_matriz_acessos:
    { admin_global, usuario_id, coordenacao, niveis: { recurso: nivel }, paineis: [id] }
  Admin global: sem teto. Coordenador: gerencia só a própria coordenação,
  concede até o próprio nível, nunca "acessos", não mexe em área nem em
  coordenação, e não altera a si mesmo.
*/

export const ABAS_DE_ACESSOS = Object.freeze([
  { id: "usuarios", rotulo: "Usuários" },
  { id: "grupos", rotulo: "Grupos" },
  { id: "coordenacoes", rotulo: "Coordenações" },
]);

/** Abas que o perfil logado vê. */
export function abasDeAcessos(perfil) {
  if (!canManageAccess(perfil)) return [];
  return ABAS_DE_ACESSOS.filter((aba) => {
    if (aba.id === "grupos") return canManageGroups(perfil);
    if (aba.id === "coordenacoes") return canManageCoordinations(perfil);
    return true;
  });
}

/** A pessoa pode ser editada? { pode, motivo } */
export function podeEditarUsuario(teto, alvo, usuarioLogado = null) {
  if (!teto || !alvo) return { pode: false, motivo: "" };
  if (
    (teto.usuario_id && teto.usuario_id === alvo.id) ||
    isOwnAccessProfile(usuarioLogado, alvo)
  )
    return { pode: false, motivo: "Seu acesso: outra pessoa deve alterar." };
  if (teto.admin_global) return { pode: true, motivo: "" };
  if (alvo.admin_global)
    return {
      pode: false,
      motivo: "Só um administrador altera outro administrador.",
    };
  if ((alvo.coordenacao ?? null) !== (teto.coordenacao ?? null))
    return { pode: false, motivo: "Fora da sua coordenação." };
  return { pode: true, motivo: "" };
}

/** Maior nível que o teto concede no recurso ("admin" para admin global). */
export function nivelMaximo(teto, recurso) {
  if (!teto) return "sem_acesso";
  if (teto.admin_global) return "admin";
  const tipo = tipoDoRecurso(recurso);
  if (recurso === "acessos" || tipo === "area") return "sem_acesso";
  if (tipo === "painel")
    return (teto.paineis || []).includes(recurso.slice("painel:".length))
      ? "leitor"
      : "sem_acesso";
  return teto.niveis?.[recurso] || "sem_acesso";
}

const cabe = (teto, recurso, nivel) =>
  posicaoDoNivel(nivel) <= posicaoDoNivel(nivelMaximo(teto, recurso));

/** A célula é só leitura para quem está logado? */
export function celulaSoLeitura(teto, recurso) {
  if (!teto || teto.admin_global) return false;
  return recurso === "acessos" || tipoDoRecurso(recurso) === "area";
}

/** Valor do select do módulo: "" = segue o grupo; senão o nível individual. */
export const valorDoSelect = (celula) =>
  celula.individual ? celula.nivel : "";

/**
 * Opções do select de um módulo: primeiro o nível do grupo (valor "", segue o grupo), depois os
 * níveis individuais. Acima do teto fica desabilitado; o valor atual sempre
 * aparece (a tela mostra o que está salvo).
 */
export function opcoesDoModulo(teto, recurso, celula) {
  const atual = valorDoSelect(celula);
  const soLeitura = celulaSoLeitura(teto, recurso);
  return [
    {
      valor: "",
      rotulo: rotuloDoNivel(celula.nivelGrupo, recurso),
      desabilitada:
        atual !== "" && (soLeitura || !cabe(teto, recurso, celula.nivelGrupo)),
    },
    ...niveisDoRecurso(recurso).map(([valor, rotulo]) => ({
      valor,
      rotulo,
      desabilitada:
        valor !== atual && (soLeitura || !cabe(teto, recurso, valor)),
    })),
  ];
}

/**
 * Grupos que quem está logado pode atribuir: admin global, todos; coordenador,
 * só os que não são de admin global, não dão "acessos" e cujos níveis cabem
 * todos no teto.
 */
export function gruposAtribuiveis(teto, grupos = []) {
  if (!teto) return [];
  if (teto.admin_global) return grupos;
  return grupos.filter(
    (grupo) =>
      !grupo.admin_global &&
      Object.entries(grupo.niveis || {}).every(([recurso, nivel]) =>
        recurso === "acessos"
          ? nivel === "sem_acesso"
          : cabe(teto, recurso, nivel),
      ),
  );
}

export const podeMudarCoordenacao = (teto) => Boolean(teto?.admin_global);
export const podeEditarAreas = (teto) => Boolean(teto?.admin_global);
