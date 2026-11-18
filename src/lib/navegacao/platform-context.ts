const DEFAULT_INSTITUTIONAL_DOMAINS = ["agenciasus.org.br", "agsus.org.br"];

/** Objeto vindo do banco: só os campos lidos aqui são conhecidos. */
type Registro = Record<string, unknown>;

/** O perfil de `obter_contexto_monitora`, com `ativo` já resolvido. */
export type PerfilDaPlataforma = Registro & { id?: unknown; ativo: boolean };

export interface ContextoDaPlataforma {
  profile: PerfilDaPlataforma;
  panelIds: string[];
  modules: object;
}

/** O que `profileDisplayName` lê do usuário do Supabase Auth. */
export interface UsuarioComNome {
  email?: string | null;
  user_metadata?: { full_name?: unknown; name?: unknown } | null;
}

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

export function normalizeAllowedDomains(value: unknown): string[] {
  const configured: unknown[] = Array.isArray(value)
    ? value
    : clean(value).split(",");
  const domains = configured
    .map((domain) => clean(domain).toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
  return [...new Set(domains.length ? domains : DEFAULT_INSTITUTIONAL_DOMAINS)];
}

export function isAllowedInstitutionalEmail(
  email: unknown,
  allowedDomains: unknown,
): boolean {
  const normalizedEmail = clean(email).toLowerCase();
  const separator = normalizedEmail.lastIndexOf("@");
  if (separator <= 0) return false;
  return normalizeAllowedDomains(allowedDomains).includes(
    normalizedEmail.slice(separator + 1),
  );
}

export function normalizePlatformContext(
  payload: unknown,
): ContextoDaPlataforma | null {
  const raw: unknown = Array.isArray(payload) ? payload[0] : payload;
  if (!raw || typeof raw !== "object") return null;
  const dados = raw as Registro;

  const profile =
    dados.profile && typeof dados.profile === "object"
      ? (dados.profile as Registro)
      : dados.perfil && typeof dados.perfil === "object"
        ? (dados.perfil as Registro)
        : null;
  if (!profile?.id) return null;

  const panelIds: unknown[] = Array.isArray(dados.panel_ids)
    ? dados.panel_ids
    : Array.isArray(dados.paineis)
      ? dados.paineis
      : [];

  return {
    profile: { ...profile, ativo: profile.ativo !== false },
    panelIds: [...new Set(panelIds.map(clean).filter(Boolean))],
    modules:
      dados.modules && typeof dados.modules === "object" ? dados.modules : {},
  };
}

export function profileDisplayName(
  profile: { nome?: unknown } | null | undefined,
  user: UsuarioComNome | null | undefined,
): string {
  return clean(
    profile?.nome ||
      user?.user_metadata?.full_name ||
      user?.user_metadata?.name ||
      user?.email?.split("@")[0] ||
      "Usuário AgSUS",
  );
}
