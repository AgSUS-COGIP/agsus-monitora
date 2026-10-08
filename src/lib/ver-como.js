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
import { areasDoUsuario, montarArvoreDoMenu } from "./menu-lateral.ts";
import { normalizePlatformContext } from "./platform-context.js";
import {
  RESOURCES,
  niveisDoRecurso,
  rotuloDoNivel,
} from "./permissoes-recursos.js";
import {
  MODULOS,
  adminGlobalDaLinha,
  alvoPendente,
  areasDaLinha,
  celulaExibida,
  coordenacaoDaLinha,
  grupoDaLinha,
  pendenciasDoUsuario,
} from "./matriz-de-acessos.js";

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
  if (escopo.rascunho) return `${onde}.`;
  if (!escopo.recortado)
    return `${onde} — vê todos os ${escopo.editais_da_area ?? 0} editais da área.`;
  return `${onde} — vê ${escopo.editais_visiveis ?? 0} de ${escopo.editais_da_area ?? 0} editais da área.`;
}

/**
 * "Como a pessoa vê" DEPOIS DE SALVAR: o contexto salvo (obter_contexto_de_
 * usuario) com o rascunho da gaveta aplicado — grupo, administrador global,
 * níveis por módulo, áreas, coordenação e painéis. Sem alteração pendente,
 * devolve o contexto como veio. O `escopo` (contagem de editais) é do que
 * está salvo, então sai e vira `{ rascunho: true }`.
 */
export function contextoDepoisDeSalvar(
  payload,
  usuario,
  rascunho,
  { grupos = [], areas = [], coordenacoes = [], paineis = [] } = {},
) {
  const raw = Array.isArray(payload) ? payload[0] : payload;
  const contexto = normalizePlatformContext(raw);
  if (!contexto || !usuario || !pendenciasDoUsuario(rascunho, usuario.id))
    return payload;
  const gruposPorCodigo = Object.fromEntries(grupos.map((g) => [g.codigo, g]));
  const codigo = grupoDaLinha(usuario, rascunho);
  const grupo = gruposPorCodigo[codigo];
  const adminGlobal = adminGlobalDaLinha(usuario, rascunho, gruposPorCodigo);
  const salvo = contexto.profile;
  const permissoes = Object.fromEntries(
    MODULOS.map((m) => {
      if (adminGlobal)
        return [
          m.id,
          salvo.admin_global && salvo.permissoes?.[m.id]
            ? salvo.permissoes[m.id]
            : niveisDoRecurso(m.id).at(-1)[0],
        ];
      return [
        m.id,
        celulaExibida(usuario, m.id, rascunho, gruposPorCodigo).nivel,
      ];
    }),
  );
  const codigoDaCoordenacao = adminGlobal
    ? null
    : coordenacaoDaLinha(usuario, rascunho);
  const coordenacao = codigoDaCoordenacao
    ? (() => {
        const c = coordenacoes.find((x) => x.codigo === codigoDaCoordenacao);
        return {
          codigo: codigoDaCoordenacao,
          nome: c?.nome || codigoDaCoordenacao,
          area: c?.area || null,
        };
      })()
    : null;
  const areasVisiveis = adminGlobal
    ? areas.map((a) => a.id)
    : areasDaLinha(usuario, rascunho, { grupos, areas, coordenacoes }).ids;
  const ativos = paineis.filter((p) => p.ativo !== false);
  let panelIds;
  if (adminGlobal) panelIds = ativos.map((p) => String(p.id));
  else {
    const liberados = new Set(salvo.admin_global ? [] : contexto.panelIds);
    for (const p of ativos) {
      const recurso = `painel:${p.id}`;
      if (!alvoPendente(rascunho, usuario.id, recurso) && !salvo.admin_global)
        continue;
      if (celulaExibida(usuario, recurso, rascunho).nivel === "leitor")
        liberados.add(String(p.id));
      else liberados.delete(String(p.id));
    }
    panelIds = [...liberados];
  }
  return {
    ...raw,
    profile: {
      ...salvo,
      perfil: codigo,
      grupo: grupo ? { codigo, nome: grupo.nome } : salvo.grupo,
      admin_global: adminGlobal,
      permissoes,
      areas: areasVisiveis,
      coordenacao,
    },
    panel_ids: panelIds,
    escopo: { rascunho: true },
  };
}
