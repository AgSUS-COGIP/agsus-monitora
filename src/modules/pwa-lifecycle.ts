let refreshingForUpdate = false;
let updateReloadRequested = false;
/* Versão nova ativada por outra aba, esperando a próxima troca de página para recarregar. */
let atualizacaoPendente = false;
let lastUpdateCheckAt = 0;
/* O registro do service worker (o `waiting` dele é a versão nova esperando o aceite). */
let registroAtual: Pick<ServiceWorkerRegistration, "waiting"> | null = null;
/* Esta página já tinha service worker: a troca de controlador é versão nova, não a primeira instalação. */
let tinhaControlador = false;
let recarregarAoTrocar: () => void = () => window.location.reload();

const UPDATE_CHECK_INTERVAL_MS = 15 * 60 * 1000;
/* Se a troca de controlador não vier (navegador lento, worker que morreu), recarrega assim mesmo. */
const ESPERA_DA_TROCA_MS = 4000;

export function shouldCheckForUpdate({
  now,
  lastCheckedAt,
  online,
  visible,
  minimumInterval = UPDATE_CHECK_INTERVAL_MS,
}: {
  now: number;
  lastCheckedAt: number;
  online: boolean;
  visible: boolean;
  minimumInterval?: number;
}): boolean {
  if (!online || !visible) return false;
  if (!lastCheckedAt) return true;
  return now - lastCheckedAt >= minimumInterval;
}

export function shouldReloadAfterControllerChange({
  updateRequested,
  alreadyReloading,
}: {
  updateRequested: unknown;
  alreadyReloading: unknown;
}): boolean {
  return Boolean(updateRequested && !alreadyReloading);
}

function checkRegistrationForUpdate(registration: ServiceWorkerRegistration) {
  const now = Date.now();
  const shouldCheck = shouldCheckForUpdate({
    now,
    lastCheckedAt: lastUpdateCheckAt,
    online: navigator.onLine,
    visible: document.visibilityState === "visible",
  });

  if (!shouldCheck) return;

  lastUpdateCheckAt = now;
  registration.update().catch(() => {});
}

function bindUpdateRefresh(registration: ServiceWorkerRegistration) {
  const requestUpdateCheck = () => checkRegistrationForUpdate(registration);

  document.addEventListener("visibilitychange", requestUpdateCheck);
  window.addEventListener("online", requestUpdateCheck);
}

/*
  O service worker novo só assume quando a pessoa aceita (como no SIGAV).
  Instalado, ele fica esperando (`registration.waiting`): esta página segue
  com o anterior e os arquivos dele, sem trocar nada por baixo de quem
  trabalha. O aceite é o "Atualizar" do aviso de versão
  (src/app/aviso-de-versao.ts → aplicarVersaoNova): SKIP_WAITING ao que
  espera, o controlador troca e a página recarrega uma vez só.

  Antes a própria página mandava o SKIP_WAITING assim que o novo instalava, e
  a recarga ficava para a próxima troca de página. Isso continua valendo para
  as outras abas: quando uma aceita, o novo assume todas; nas que não pediram,
  a recarga espera a próxima troca de página (aplicarAtualizacaoPendente,
  chamada pelo navigate do legado depois da guarda de alterações não salvas e
  só quando nenhuma tela tem rascunho por guardar — src/app/
  guarda-de-alteracoes.ts), e quem digita não perde o texto.
*/
function bindServiceWorkerUpdates() {
  if (!("serviceWorker" in navigator)) return;
  tinhaControlador = Boolean(navigator.serviceWorker.controller);

  navigator.serviceWorker.ready
    .then((registration) => {
      registroAtual = registration;
      bindUpdateRefresh(registration);
      lastUpdateCheckAt = Date.now();
    })
    .catch(() => {});

  navigator.serviceWorker.addEventListener("controllerchange", () =>
    aoTrocarDeControlador(),
  );
}

function recarregarUmaVez() {
  const shouldReload = shouldReloadAfterControllerChange({
    updateRequested: updateReloadRequested,
    alreadyReloading: refreshingForUpdate,
  });
  if (!shouldReload) return;
  updateReloadRequested = false;
  refreshingForUpdate = true;
  recarregarAoTrocar();
}

/**
 * O controlador trocou. Pedido nesta página (aplicarVersaoNova): recarrega
 * agora, uma vez. Pedido por outra aba: a versão nova entra na próxima troca
 * de página. Primeira instalação (a página não tinha controlador): nada.
 */
export function aoTrocarDeControlador(): void {
  const eraVersaoNova = tinhaControlador;
  tinhaControlador = true;
  if (updateReloadRequested) {
    recarregarUmaVez();
    return;
  }
  if (eraVersaoNova && !refreshingForUpdate) atualizacaoPendente = true;
}

/**
 * A pessoa aceitou a versão nova. Com um service worker novo esperando, manda
 * o SKIP_WAITING e recarrega quando ele assume (ou passado o prazo, se a
 * troca não vier); sem ele, recarrega já (a navegação vem da rede). Nunca
 * recarrega duas vezes.
 */
export function aplicarVersaoNova({
  registro = registroAtual,
  recarregar = () => window.location.reload(),
  esperaMs = ESPERA_DA_TROCA_MS,
}: {
  registro?: Pick<ServiceWorkerRegistration, "waiting"> | null;
  recarregar?: () => void;
  esperaMs?: number;
} = {}): void {
  if (refreshingForUpdate || updateReloadRequested) return;
  recarregarAoTrocar = recarregar;
  updateReloadRequested = true;
  const esperando = registro?.waiting;
  if (!esperando) {
    recarregarUmaVez();
    return;
  }
  esperando.postMessage({ type: "SKIP_WAITING" });
  setTimeout(recarregarUmaVez, esperaMs);
}

/**
 * Se há versão nova esperando, recarrega agora (a pessoa acabou de pedir
 * outra página: nada digitado se perde) e devolve true — quem chamou não segue
 * com a navegação; a tela pedida abre depois da recarga, porque o legado já
 * guardou a última tela. Sem versão nova, devolve false.
 */
export function aplicarAtualizacaoPendente(
  recarregar: () => void = () => window.location.reload(),
): boolean {
  if (!atualizacaoPendente || refreshingForUpdate) return false;
  atualizacaoPendente = false;
  refreshingForUpdate = true;
  recarregar();
  return true;
}

/** Só para teste: simula a versão nova ativa esperando a troca de página. */
export function marcarAtualizacaoPendenteParaTeste(
  valor = true,
  { controlador = true }: { controlador?: boolean } = {},
): void {
  atualizacaoPendente = valor;
  refreshingForUpdate = false;
  updateReloadRequested = false;
  tinhaControlador = controlador;
}

const AVISO_SEM_SERVICE_WORKER = "Service worker do Yeendé não foi registrado:";

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  // No `npm run dev:frontend` o Vite serve módulos soltos que mudam a cada
  // edição. Um service worker guardava versões velhas e a tela de login ficava
  // carregando pela metade, sem CSS. Em dev, desfaz o que houver registrado.
  if (import.meta.env?.DEV && import.meta.env?.MODE !== "test") {
    navigator.serviceWorker
      .getRegistrations()
      .then((registros) => registros.forEach((r) => void r.unregister()))
      .catch(() => {});
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error: unknown) => {
      console.warn(AVISO_SEM_SERVICE_WORKER, error);
    });
  });
}

export function initPwaLifecycle(): void {
  registerServiceWorker();
  bindServiceWorkerUpdates();
}
