const ROLE_ALIASES = Object.freeze({
  usuario: "usuario",
  leitor: "usuario",
  edital_gestor: "edital_gestor",
  editor: "edital_gestor",
  contratador: "contratador",
  admin: "admin",
  master: "admin",
});

const ROLE_LEVEL = Object.freeze({
  usuario: 0,
  edital_gestor: 1,
  contratador: 2,
  admin: 3,
});

export const ACCESS_ROLES = Object.freeze([
  { value: "usuario", label: "Usuário" },
  { value: "edital_gestor", label: "Edital gestor" },
  { value: "contratador", label: "Contratador" },
  { value: "admin", label: "Admin" },
]);

export function normalizeRole(profile) {
  if (!profile || profile.ativo === false) return "";
  const value = String(profile.perfil ?? profile.role ?? "")
    .trim()
    .toLowerCase();
  return ROLE_ALIASES[value] || "";
}

export function roleLabel(profile) {
  const role = normalizeRole(profile);
  return ACCESS_ROLES.find((item) => item.value === role)?.label || "Usuário";
}

export function isOwnAccessProfile(currentUser, targetProfile) {
  if (!currentUser || !targetProfile) return false;

  const currentId = String(currentUser.id ?? "").trim();
  const targetUserId = String(
    targetProfile.user_id ?? targetProfile.userId ?? "",
  ).trim();
  if (currentId && targetUserId && currentId === targetUserId) return true;

  const currentEmail = String(currentUser.email ?? "")
    .trim()
    .toLowerCase();
  const targetEmail = String(targetProfile.email ?? "")
    .trim()
    .toLowerCase();
  return Boolean(currentEmail && targetEmail && currentEmail === targetEmail);
}

function hasLevel(profile, minimum) {
  const role = normalizeRole(profile);
  return role !== "" && ROLE_LEVEL[role] >= ROLE_LEVEL[minimum];
}

export function canViewCore(profile) {
  return normalizeRole(profile) !== "";
}

export function canManageEditais(profile) {
  return hasLevel(profile, "edital_gestor");
}

export function canImportApprovedList(profile) {
  return hasLevel(profile, "edital_gestor");
}

export function canReplaceApprovedList(profile) {
  return hasLevel(profile, "admin");
}

export function canChangeCandidateStatus(profile) {
  return hasLevel(profile, "contratador");
}

export function canManageSubJudice(profile) {
  return hasLevel(profile, "contratador");
}

export function canManageSettings(profile) {
  return hasLevel(profile, "admin");
}

export function canManageAccess(profile) {
  return hasLevel(profile, "admin");
}
