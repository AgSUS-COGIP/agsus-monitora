import { ABAS_DO_MENU, nomeDaArea } from "./menu-lateral.js";

function text(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function initials(name) {
  return (
    text(name)
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("") || "AG"
  );
}

export function normalizeOnlinePresenceList(value) {
  const rows = Array.isArray(value)
    ? value
    : Array.isArray(value?.people)
      ? value.people
      : [];
  const people = new Map();
  for (const row of rows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const userId = text(row.userId || row.user_id);
    const fullName = text(row.fullName || row.full_name || row.nome);
    if (!userId || !fullName) continue;
    people.set(userId, {
      userId,
      fullName,
      initials: initials(fullName),
      avatarUrl: text(row.avatarUrl || row.avatar_url) || null,
      profileLabel:
        text(row.profileLabel || row.profile_label || row.perfil) || "Usuário",
      currentView: rotuloDoLocal(text(row.currentView || row.current_view)),
      onlineAt: text(row.onlineAt || row.online_at),
    });
  }
  return [...people.values()].sort((a, b) =>
    a.fullName.localeCompare(b.fullName, "pt-BR"),
  );
}

/*
  Onde a pessoa está, como aparece em "Pessoas online": o nome da página e a
  área ("Análises curriculares · Saúde Indígena"), ou a seção de Configurações
  ("Configurações › Acessos"). Antes ia o código da view ("analises",
  "approved"), que não diz nada a quem lê. O banco guarda até 120 caracteres.
*/
const PAGINAS_SEM_AREA = Object.freeze({
  config: "Configurações",
});

function rotuloDaView(view) {
  if (view.startsWith("panel:")) return "Painel externo";
  return (
    ABAS_DO_MENU.find((aba) => aba.view === view)?.rotulo ||
    PAGINAS_SEM_AREA[view] ||
    ""
  );
}

export function ondeEstaNoMonitora({ view, area, rotuloDaSecao } = {}) {
  const codigo = text(view);
  if (!codigo) return "";
  const pagina = rotuloDaView(codigo) || codigo;
  if (codigo === "config") {
    const secao = text(rotuloDaSecao);
    return secao ? `${pagina} › ${secao}` : pagina;
  }
  const nome = ABAS_DO_MENU.some((aba) => aba.view === codigo)
    ? nomeDaArea(text(area))
    : "";
  return (nome ? `${pagina} · ${nome}` : pagina).slice(0, 120);
}

/*
  O que chegou do banco, pronto para a tela. Quem ainda está com a versão
  anterior aberta manda só o código da view: vira o nome da página.
*/
export function rotuloDoLocal(valor) {
  const local = text(valor);
  return rotuloDaView(local) || local;
}
