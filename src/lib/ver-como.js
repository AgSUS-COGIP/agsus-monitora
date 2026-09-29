import {
  canChangeCandidateStatus,
  canImportApprovedList,
  canManageAccess,
  canManageEditais,
  canManageSettings,
  canReplaceApprovedList,
  canUnlockCandidateStatus,
  paginasPermitidas,
  paineisPermitidos,
  secaoDeConfiguracaoPermitida,
} from "./access-roles.js";
import { areasDoUsuario, montarArvoreDoMenu } from "./menu-lateral.js";
import { normalizePlatformContext } from "./platform-context.js";
import { RESOURCES, rotuloDoNivel } from "./permissoes-recursos.js";

/*
  "Ver como usuário": com o contexto de outra pessoa (obter_contexto_de_usuario,
  mesmo formato de obter_contexto_monitora), monta o menu que ela vê com as
  MESMAS regras da barra lateral (paginasPermitidas, paineisPermitidos,
  secaoDeConfiguracaoPermitida → montarArvoreDoMenu). Só leitura do que está
  salvo; não é entrar como a pessoa.
*/

export function perfilDoContexto(payload) {
  return normalizePlatformContext(payload)?.profile || null;
}

export function menuDoContexto(
  payload,
  { paineis = [], secoesDeConfiguracao = [] } = {},
) {
  const contexto = normalizePlatformContext(payload);
  if (!contexto) return [];
  const perfil = contexto.profile;
  return montarArvoreDoMenu({
    permitidas: paginasPermitidas(perfil),
    paineis: paineisPermitidos(perfil, paineis, contexto.panelIds),
    secoesDeConfiguracao: secoesDeConfiguracao.filter((secao) =>
      secaoDeConfiguracaoPermitida(perfil, secao.id),
    ),
    areas: areasDoUsuario(perfil.areas),
  });
}

/** Níveis efetivos por módulo, com rótulo. */
export function permissoesEfetivas(perfil) {
  return RESOURCES.map(([id, rotulo]) => ({
    id,
    rotulo,
    nivel: perfil?.permissoes?.[id] || "sem_acesso",
    rotuloDoNivel: rotuloDoNivel(perfil?.permissoes?.[id] || "sem_acesso", id),
  }));
}

/** O que a pessoa consegue fazer, em frases. */
export function capacidadesDoPerfil(perfil) {
  return [
    [canManageEditais(perfil), "Cadastra e edita editais e cronogramas"],
    [canImportApprovedList(perfil), "Importa listas de aprovados"],
    [canReplaceApprovedList(perfil), "Substitui e remove listas de aprovados"],
    [canChangeCandidateStatus(perfil), "Muda o status dos candidatos"],
    [
      canUnlockCandidateStatus(perfil),
      "Desfaz status já definido e anexa documentos",
    ],
    [canManageSettings(perfil), "Edita as configurações do sistema"],
    [canManageAccess(perfil), "Gerencia acessos"],
  ]
    .filter(([pode]) => pode)
    .map(([, frase]) => frase);
}

/** O recorte de dados, em uma frase. */
export function resumoDoEscopo(payload, nomesDasAreas = new Map()) {
  const perfil = perfilDoContexto(payload);
  const escopo = (Array.isArray(payload) ? payload[0] : payload)?.escopo || {};
  if (!perfil) return "";
  if (perfil.admin_global) return "Administrador global: vê todas as áreas.";
  const areas = (perfil.areas || []).map((a) => nomesDasAreas.get(a) || a);
  const onde = perfil.coordenacao
    ? `Coordenação ${perfil.coordenacao.nome}`
    : `Áreas: ${areas.join(", ") || "nenhuma"}`;
  if (!escopo.recortado)
    return `${onde} — vê todos os ${escopo.editais_da_area ?? 0} editais da área.`;
  return `${onde} — vê ${escopo.editais_visiveis ?? 0} de ${escopo.editais_da_area ?? 0} editais da área.`;
}
