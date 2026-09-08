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
      currentView: text(row.currentView || row.current_view),
      onlineAt: text(row.onlineAt || row.online_at),
    });
  }
  return [...people.values()].sort((a, b) =>
    a.fullName.localeCompare(b.fullName, "pt-BR"),
  );
}
