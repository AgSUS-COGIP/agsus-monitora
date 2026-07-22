import { SUPABASE_AUTH_STORAGE_KEY } from "../lib/env.js";

/**
 * Injeta a mesma storageKey usada pelo aplicativo no próximo cliente Supabase
 * criado sem storageKey explícita. O wrapper é removido logo após esse uso,
 * evitando qualquer alteração permanente na biblioteca global.
 */
export function installConfigGovernanceAuthShim() {
  const supabaseGlobal = window.supabase;
  if (!supabaseGlobal?.createClient) return false;
  if (supabaseGlobal.createClient.__configGovernanceAuthShim) return true;

  const originalCreateClient = supabaseGlobal.createClient.bind(supabaseGlobal);

  function createClientWithSharedSession(url, key, options = {}) {
    const auth = options?.auth || {};
    const shouldInject = Boolean(auth.storage) && !auth.storageKey;
    const nextOptions = shouldInject
      ? {
          ...options,
          auth: {
            ...auth,
            storageKey: SUPABASE_AUTH_STORAGE_KEY
          }
        }
      : options;

    // Uso único: após criar o cliente de governança, restaura o método global.
    supabaseGlobal.createClient = originalCreateClient;
    return originalCreateClient(url, key, nextOptions);
  }

  createClientWithSharedSession.__configGovernanceAuthShim = true;
  supabaseGlobal.createClient = createClientWithSharedSession;
  return true;
}
