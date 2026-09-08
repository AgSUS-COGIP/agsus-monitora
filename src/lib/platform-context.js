const DEFAULT_INSTITUTIONAL_DOMAINS = ["agenciasus.org.br", "agsus.org.br"];

function clean(value) {
  return String(value ?? "").trim();
}

export function normalizeAllowedDomains(value) {
  const configured = Array.isArray(value) ? value : clean(value).split(",");
  const domains = configured
    .map((domain) => clean(domain).toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
  return [...new Set(domains.length ? domains : DEFAULT_INSTITUTIONAL_DOMAINS)];
}

export function isAllowedInstitutionalEmail(email, allowedDomains) {
  const normalizedEmail = clean(email).toLowerCase();
  const separator = normalizedEmail.lastIndexOf("@");
  if (separator <= 0) return false;
  return normalizeAllowedDomains(allowedDomains).includes(
    normalizedEmail.slice(separator + 1),
  );
}

export function normalizePlatformContext(payload) {
  const raw = Array.isArray(payload) ? payload[0] : payload;
  if (!raw || typeof raw !== "object") return null;

  const profile =
    raw.profile && typeof raw.profile === "object"
      ? raw.profile
      : raw.perfil && typeof raw.perfil === "object"
        ? raw.perfil
        : null;
  if (!profile?.id) return null;

  const panelIds = Array.isArray(raw.panel_ids)
    ? raw.panel_ids
    : Array.isArray(raw.paineis)
      ? raw.paineis
      : [];

  return {
    profile: { ...profile, ativo: profile.ativo !== false },
    panelIds: [...new Set(panelIds.map(clean).filter(Boolean))],
    modules: raw.modules && typeof raw.modules === "object" ? raw.modules : {},
  };
}

export function profileDisplayName(profile, user) {
  return clean(
    profile?.nome ||
      user?.user_metadata?.full_name ||
      user?.user_metadata?.name ||
      user?.email?.split("@")[0] ||
      "Usuário AgSUS",
  );
}
