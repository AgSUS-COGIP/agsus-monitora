import { SUPABASE_AUTH_STORAGE_KEY, SUPABASE_KEY, SUPABASE_URL } from "../lib/env.js";

  // ============================================================
  // AgSUS Monitora Web V2.9.35
  // Melhorias aplicadas nesta versão:
  //   - CSS consolidado: 9 blocos → 1 bloco limpo sem conflitos
  //   - Debounce na busca: elimina re-renders a cada keystroke
  //   - Renderização granular: mapa só re-renderiza quando UF muda
  //   - Segurança: grants anon removidos (ver script SQL 03)
  //   - Recuperação automática de senha removida; redefinição via administrador
  // ============================================================

  const APP_VERSION_FALLBACK = "";

  const RPC_SAVE_MONITORAMENTO = "salvar_monitoramento_indigena";
  const RPC_SAVE_CONFIG        = "salvar_configuracoes_e_paineis";
  const RPC_ACCESS_LOG         = "registrar_evento_acesso";
  const MONITORAMENTO_DASHBOARD_PAYLOAD_RPC = "get_monitoramento_dashboard_payload";
  const MAPA_CONFIG_TABLE = "mapa_saude_indigena_config";
  const DEFAULT_ACCESS_HEARTBEAT_MINUTES = 5;
  const DETAILS_TABLE_SOURCE_MODE = "client";
  const PASSWORD_RESET_ADMIN_MESSAGE_FALLBACK = "";

  const DEFAULT_CONFIG = {
    monit_id:"",
    app_title:"",
    app_slogan:"",
    app_subtitle:"",
    footer_text:"",
    app_version_current:APP_VERSION_FALLBACK,
    page_title:"",
    page_subtitle:"",
    login_eyebrow:"",
    login_email_label:"",
    login_email_placeholder:"",
    login_password_label:"",
    login_password_placeholder:"",
    login_button_text:"",
    password_reset_message:PASSWORD_RESET_ADMIN_MESSAGE_FALLBACK,
    sidebar_user_label:"",
    sidebar_version_label:"",
    logout_text:"",
    filter_title:"",
    filter_subtitle:"",
    filter_toggle_show:"",
    filter_toggle_hide:"",
    feature_realtime_monitoramento:"true",
    feature_modo_executivo:"true",
    access_heartbeat_minutos:String(DEFAULT_ACCESS_HEARTBEAT_MINUTES),
    password_reset_flow:"admin",
    login_bg_url:"",
    login_logo_url:"",
    mascot_url:"",
    cogip_nome:"",
    cogip_logo_url:"",
    cogip_funcao:"",
    cogip_versao:"",
    cogip_dept:"",
    broadcast_msg:"",
    broadcast_type:"info",
    loader_initial_title:"",
    loader_initial_subtitle:"",
    loader_environment_title:"",
    loader_environment_subtitle:"",
    loader_config_title:"",
    loader_config_subtitle:"",
    loader_panels_title:"",
    loader_panels_subtitle:"",
    loader_map_title:"",
    loader_map_subtitle:"",
    loader_units_title:"",
    loader_units_subtitle:"",
    loader_data_title:"",
    loader_data_subtitle:"",
    loader_finish_title:"",
    loader_finish_subtitle:"",
    offline_message:"",
    skip_link_text:"",
    password_toggle_label:"",
    sidebar_toggle_label:"",
    external_back_text:"Voltar ao sistema",
    dark_mode_label:"",
    action_export_text:"",
    action_more_label:"",
    action_fullscreen_text:"",
    action_refresh_text:"",
    action_export_pdf_text:"",
    dashboard_section_processos:"",
    kpi_processos_label:"",
    kpi_vagas_label:"",
    kpi_contratados_label:"",
    kpi_ociosas_label:"",
    kpi_criticos_label:"",
    kpi_criticos_chip:"",
    kpi_inscritos_label:"",
    panel_status_summary_title:"",
    panel_operational_status_title:"",
    panel_attention_title:"",
    details_title:"",
    table_search_placeholder:"",
    hide_closed_show:"",
    hide_closed_hide:"",
    columns_button_text:"",
    columns_menu_title:"",
    keyboard_hint:"",
    external_default_title:"",
    external_refresh_text:"",
    external_open_text:"",
    external_placeholder:"",
    maintenance_title:"",
    maintenance_message:"",
    config_nav_title:"",
    config_page_subtitle:"",
    nucleo_nav_title:"",
    nucleo_page_subtitle:"",
    permissions_empty_text:""
    ,executive_mode_enter_text:""
    ,executive_mode_exit_text:""
    ,auth_google_enabled:"false"
    ,auth_google_button_text:""
    ,auth_google_domain_hint:""
  };

  const DEFAULT_PANELS = [];

  let sb = null;
  let currentUser = null;
  let profile = null;
  let appConfig = {};
  let loadedConfigKeys = new Set();
  let configLoadOk = false;
  let rows = [];
  let filtered = [];
  let monitoramentoPayload = null;
  let unidadesCatalog = [];
  let tableSort = { field:"", direction:"" };
  const VIEW_STORAGE_KEY = "agsus_monitora_current_view_v268";
  const FILTER_CONFIG = [
    { id:"filterUnidade", field:"unidade", label:"Unidade", all:"Todas" },
    { id:"filterEdital",  field:"edital",  label:"Edital",  all:"Todos" },
    { id:"filterEtapa",   field:"etapa",   label:"Etapa",   all:"Todas" },
    { id:"filterStatus",  field:"status",  label:"Status",  all:"Todos" },
    { id:"filterRisco",   field:"risco",   label:"Risco",   all:"Todos" },
    { id:"filterUf",      field:"uf",      label:"UF",      all:"Todas" }
  ];
  const FILTER_ID_TO_FIELD = Object.fromEntries(FILTER_CONFIG.map(f => [f.id, f.field]));
  let filterState = Object.fromEntries(FILTER_CONFIG.map(f => [f.field, new Set()]));
  const FILTER_STORAGE_KEY = "agsus_monitora_filters_v1";
  function saveFilterState(){
    try{
      const plain = {}; FILTER_CONFIG.forEach(f=>{ plain[f.field] = Array.from(filterState[f.field]||[]); });
      localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(plain));
    }catch(e){}
  }
  function loadFilterState(){
    try{
      const raw = localStorage.getItem(FILTER_STORAGE_KEY); if(!raw) return;
      const plain = JSON.parse(raw);
      FILTER_CONFIG.forEach(f=>{ if(Array.isArray(plain[f.field])) filterState[f.field] = new Set(plain[f.field]); });
    }catch(e){}
  }
  let panels = [...DEFAULT_PANELS];
  let allowedPanelIds = new Set();
  let accessRequests = [];
  let mapConfigLoadOk = false;
  let currentPanel = null;
  let currentView = "dashboard";
  let statusChart = null;
  let chartsReady = false;
  let dataLoadedAtLeastOnce = false;
  let externalPanelsWarmed = false;
  let manualLogoutInProgress = false;
  let accessHeartbeatHandle = null;
  let activeSessionLoadPromise = null;
  let activeLoadDataPromise = null;
  let loadDataRunCounter = 0;
  let activeRefreshDataPromise = null;
  const SIDEBAR_LOCK_BREAKPOINT = 1480;
  const SIDEBAR_FORCE_LOCK_VIEWS = new Set([]);

  // ── Renderização granular: rastreia último conjunto de UFs para evitar
  //    re-render do mapa quando apenas texto da busca muda ──────────────
  let lastMapUfKey = null;
  // Detecta se há qualquer filtro (dropdowns) ou busca de texto ativos.
  // Usado para o mapa focar só nas unidades filtradas e dar zoom.
  function hasActiveFilter(){
    const anySelect = (typeof FILTER_CONFIG!=="undefined") &&
      FILTER_CONFIG.some(cfg => (filterState[cfg.field]||new Set()).size > 0);
    const qt = ($("tableSearch")?.value || "").trim();
    return anySelect || qt.length>0;
  }
  let hideClosed = false; // toggle "Ocultar encerrados" da tabela de detalhes
  function toggleHideClosed(){
    hideClosed = !hideClosed;
    try{ localStorage.setItem("agsus_hide_closed_v1", hideClosed?"1":"0"); }catch(e){}
    syncHideClosedBtn();
    applyFilters();
    toast(hideClosed ? "Ocultando processos cancelados e concluídos." : "Mostrando todos os processos.");
  }
  function syncHideClosedBtn(){
    const btn = $("hideClosedBtn"); const lbl = $("hideClosedLabel");
    if(!btn) return;
    btn.setAttribute("aria-pressed", hideClosed ? "true" : "false");
    const ic = btn.querySelector("i");
    if(ic) ic.className = hideClosed ? "fa-solid fa-eye-slash" : "fa-solid fa-eye";
    if(lbl) lbl.textContent = hideClosed ? cfgValue("hide_closed_show") : cfgValue("hide_closed_hide");
    btn.classList.toggle("outline", hideClosed);
  }

  // ── Debounce na busca da tabela (300ms) ─────────────────────────────
  let searchDebounceTimer = null;
  function debouncedSearch(){
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => applyFilters(), 300);
  }

  function $(id){ return document.getElementById(id); }
  function n(v){ const x = Number(v || 0); return Number.isFinite(x) ? x : 0; }
  function txt(v){ return String(v ?? "").trim(); }
  function low(v){ return txt(v).toLowerCase(); }
  function cfgValue(key){ return loadedConfigKeys.has(key) ? (appConfig[key] ?? "") : (DEFAULT_CONFIG[key] || ""); }
  function cfgBool(key, fallback=false){
    const value = low(cfgValue(key));
    if(["true","1","sim","yes","on"].includes(value)) return true;
    if(["false","0","nao","não","no","off"].includes(value)) return false;
    return fallback;
  }
  function cfgInt(key, fallback=0){
    const value = parseInt(cfgValue(key), 10);
    return Number.isFinite(value) ? value : fallback;
  }
  function appVersion(){ return cfgValue("app_version_current") || APP_VERSION_FALLBACK; }
  function passwordResetMessage(){ return cfgValue("password_reset_message") || PASSWORD_RESET_ADMIN_MESSAGE_FALLBACK; }
  function setText(id, value){ const el=$(id); if(el) el.textContent = value || ""; }
  function setAttr(id, name, value){ const el=$(id); if(el) el.setAttribute(name, value || ""); }
  function setImg(id, url, alt=""){
    const el=$(id); if(!el) return;
    if(url){ el.src = url; el.alt = alt || ""; el.style.display = ""; }
    else { el.removeAttribute("src"); el.alt = alt || ""; el.style.display = "none"; }
  }
  function setLoginButtonReady(){
    const btn = $("loginBtn"); if(!btn) return;
    btn.innerHTML = `<i class="fa-solid fa-right-to-bracket"></i> Iniciar sessão`;
  }
  function fmt(v){ return n(v).toLocaleString("pt-BR"); }
  const ESC_MAP={"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"};
  function esc(v){ return String(v ?? "").replace(/[&<>"']/g, c=>ESC_MAP[c]); }
  function attr(v){ return esc(v).replaceAll("`","&#096;"); }
  // Sanitiza URLs vindas do banco: só permite http(s). Bloqueia javascript:, data:, etc.
  function safeUrl(v){ const s=txt(v); if(!s) return ""; try{ const u=new URL(s, window.location.origin); return (u.protocol==="http:"||u.protocol==="https:") ? s : ""; }catch(e){ return ""; } }
  function isInternalPanelUrl(v){
    const s=txt(v);
    if(!s) return false;
    try{ const u=new URL(s, window.location.origin); return u.origin === window.location.origin; }catch(e){ return false; }
  }
  function isSystemShellUrl(v){
    const s=txt(v);
    if(!s) return false;
    try{
      const u=new URL(s, window.location.origin);
      const path = u.pathname.replace(/\/+$/,"") || "/";
      return path === "/" || path.endsWith("/index.html");
    }catch(e){ return false; }
  }
  function rpcFirst(data){ return Array.isArray(data) ? (data[0] || null) : (data || null); }
  function sleep(ms){ return new Promise(resolve => setTimeout(resolve, ms)); }

  function fmtDate(v){
    if(!v) return "";
    const s = txt(v);
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if(!m) return s;
    return `${m[3]}/${m[2]}/${m[1]}`;
  }

  function previewImg(inputId, imgId){
    const url = txt($(inputId)?.value);
    const img = $(imgId);
    if(!img) return;
    if(!url){ img.style.display="none"; img.src=""; return; }
    img.src = url;
    img.style.display = "block";
    img.onerror = () => { img.style.display="none"; };
  }

  function toggleMoreActions(){
    const menu = $("moreActionsMenu");
    const btn  = $("moreActionsBtn");
    if(!menu) return;
    const opening = menu.hidden;
    menu.hidden = !opening;
    if(btn) btn.setAttribute("aria-expanded", opening ? "true" : "false");
    if(opening){
      const close = (e) => {
        if(!e.target.closest("#moreActionsWrap")){ closeMoreActions(); document.removeEventListener("click", close); }
      };
      setTimeout(() => document.addEventListener("click", close), 0);
    }
  }

  function closeMoreActions(){
    const menu = $("moreActionsMenu");
    const btn  = $("moreActionsBtn");
    if(menu) menu.hidden = true;
    if(btn)  btn.setAttribute("aria-expanded","false");
  }

  function toast(message, type="ok"){
    const box = $("toastBox");
    const el = document.createElement("div");
    el.className = "toast " + type;
    el.innerHTML = `<div>${esc(message)}</div><button onclick="this.parentElement.remove()">×</button>`;
    box.appendChild(el);
    setTimeout(() => { try{ el.remove(); }catch(e){} }, 4500);
  }

  function loader(show, title="Carregando", sub="Aguarde...", pct=0){
    if(show && document.body.classList.contains("config-loading")) return;
    $("loader").classList.toggle("show", !!show);
    $("loaderTitle").textContent = title;
    $("loaderSub").textContent = sub;
    $("loaderPct").textContent = Math.round(pct) + "%";
    $("loaderBar").style.width = Math.max(0,Math.min(100,pct)) + "%";
  }

  function showAlert(id, msg, type=""){
    const el = $(id);
    el.textContent = msg || "";
    el.className = "alert " + type;
    el.classList.toggle("hidden", !msg);
  }

  function initSupabase(){
    if(!SUPABASE_URL || !SUPABASE_KEY || SUPABASE_KEY.includes("COLE_AQUI")){
      showAlert("configMsg","Configure SUPABASE_URL e SUPABASE_KEY no arquivo index.html.","error");
      return false;
    }
    if(!window.supabase){
      showAlert("configMsg","Não foi possível carregar a biblioteca do Supabase. Verifique a internet.","error");
      return false;
    }
    // Em iframes de terceiros (ex.: Google Sites), o navegador pode bloquear ou
    // particionar o localStorage, fazendo o acesso LANÇAR exceção. Sem tratamento,
    // isso quebra o login/sessão do Supabase e "trava" o painel inteiro.
    // Usamos um adaptador seguro: tenta localStorage; se falhar, cai para memória.
    const safeAuthStorage = (() => {
      let backing = null;
      try {
        const k = "__agsus_probe__";
        window.localStorage.setItem(k, "1");
        window.localStorage.removeItem(k);
        backing = window.localStorage;
      } catch (e) {
        backing = null; // armazenamento indisponível no iframe -> usa memória
      }
      const mem = new Map();
      return {
        getItem(key){ try { return backing ? backing.getItem(key) : (mem.has(key) ? mem.get(key) : null); } catch(_) { return mem.has(key) ? mem.get(key) : null; } },
        setItem(key, value){ try { backing ? backing.setItem(key, value) : mem.set(key, value); } catch(_) { mem.set(key, value); } },
        removeItem(key){ try { backing ? backing.removeItem(key) : mem.delete(key); } catch(_) { mem.delete(key); } }
      };
    })();
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        storage: safeAuthStorage,
        storageKey: SUPABASE_AUTH_STORAGE_KEY,
        persistSession: true,
        autoRefreshToken: true,
        flowType: "implicit",
        detectSessionInUrl: true
      }
    });
    return true;
  }

  function can(perm){
    if(!profile) return false;
    if(low(profile.perfil) === "master") return true;
    return profile["p_" + perm] === true;
  }

  function getClientSessionId(){
    try{
      const key = "agsus_monitora_client_session_id";
      let value = sessionStorage.getItem(key);
      if(!value){ value = `${Date.now()}-${Math.random().toString(36).slice(2,10)}`; sessionStorage.setItem(key, value); }
      return value;
    }catch(e){ return `${Date.now()}-fallback`; }
  }

  async function trackAccess(evento, options={}){
    if(!sb || !currentUser?.id || !evento) return;
    try{
      await sb.rpc(RPC_ACCESS_LOG, {
        p_evento: evento, p_tela: options.tela ?? currentView ?? null,
        p_origem: "index", p_detalhes: options.detalhes ?? {},
        p_client_session_id: getClientSessionId(),
        p_user_agent: navigator.userAgent || "", p_app_version: appVersion()
      });
    }catch(error){ console.warn("Falha ao registrar auditoria:", error); }
  }

  function stopAccessHeartbeat(){ if(accessHeartbeatHandle){ clearInterval(accessHeartbeatHandle); accessHeartbeatHandle = null; } }
  function startAccessHeartbeat(){
    stopAccessHeartbeat();
    if(!currentUser?.id) return;
    const minutes = Math.max(1, cfgInt("access_heartbeat_minutos", DEFAULT_ACCESS_HEARTBEAT_MINUTES));
    accessHeartbeatHandle = setInterval(() => trackAccess("heartbeat", { detalhes:{ current_view:currentView, page_title:document.title } }), minutes * 60 * 1000);
  }

  function resetSignedOutState(message="", type="warn"){
    currentUser = null; profile = null; rows = []; filtered = []; dataLoadedAtLeastOnce = false;
    allowedPanelIds = new Set(); accessRequests = [];
    stopAccessHeartbeat(); clearExternalPanelCache();
    document.body.classList.remove("access-request-mode");
    $("appScreen").classList.add("hidden"); $("loginScreen").classList.remove("hidden");
    $("loginPassword").value = "";
    const accessCard = $("accessRequestCard"); if(accessCard) accessCard.classList.add("hidden");
    const accessStatus = $("accessRequestStatus"); if(accessStatus) accessStatus.classList.add("hidden");
    const accessBtn = $("accessRequestBtn"); if(accessBtn) accessBtn.disabled = false;
    if(message) showAlert("loginMsg", message, type);
  }

  async function refreshProfileAfterSessionUpdate(nextSession){
    currentUser = nextSession?.user || null;
    if(!currentUser || $("appScreen").classList.contains("hidden")) return;
    try{
      const ok = await loadProfile();
      if(!ok){ await showAccessRequestState(); return; }
      await loadPanelPermissions();
      buildNav();
      if(!isViewAllowed(currentView)) navigate(startView());
    }
    catch(error){ console.error("Falha ao atualizar perfil:", error); }
  }

  async function handleSignedInSession(nextSession, source="auth"){
    if(!nextSession?.user || manualLogoutInProgress) return;
    if(activeSessionLoadPromise) return activeSessionLoadPromise;
    currentUser = nextSession.user;
    openApp(currentUser);
    activeSessionLoadPromise = (async()=>{
      const ready = await loadInitialData();
      if(ready){
        await trackAccess(source === "boot" ? "sessao_restaurada" : "login_google", { tela:source });
        startAccessHeartbeat();
        startRealtime();
      }
    })();
    try{
      await activeSessionLoadPromise;
    }catch(error){
      console.error("Falha ao finalizar login:", error);
      forceAccessRequestFallback("Seu e-mail entrou com Google, mas ainda precisa ser liberado por um administrador.");
    }finally{
      clearOAuthUrl();
      activeSessionLoadPromise = null;
      loader(false);
      document.body.classList.remove("config-loading");
      const googleBtn = $("googleLoginBtn"); if(googleBtn) googleBtn.disabled = false;
    }
  }

  async function handleOAuthCodeCallback(){
    const qs = new URLSearchParams(window.location.search || "");
    const code = qs.get("code");
    if(!code) return false;
    loader(true, "Autenticando com Google", "Finalizando acesso seguro...", 18);
    try{
      const { data, error } = await sb.auth.exchangeCodeForSession(code);
      if(error) throw error;
      const session = data?.session || (await sb.auth.getSession()).data?.session;
      if(session?.user){
        await handleSignedInSession(session, "oauth_callback");
        return true;
      }
      throw new Error("Sessão não encontrada após retorno do Google.");
    }catch(error){
      console.error("Falha no callback OAuth:", error);
      clearOAuthUrl();
      loader(false);
      document.body.classList.remove("config-loading");
      resetSignedOutState("Não foi possível finalizar o login Google. Tente novamente escolhendo a conta.", "error");
      return true;
    }
  }

  async function waitForAuthSession(maxWaitMs=3500){
    const started = Date.now();
    while(Date.now() - started < maxWaitMs){
      const { data } = await sb.auth.getSession();
      if(data?.session?.user) return data.session;
      await sleep(150);
    }
    const { data } = await sb.auth.getSession();
    return data?.session || null;
  }

  async function boot(){
    if(!initSupabase()) return;
    loader(true, "Carregando", "", 5);
    applyStoredSidebarState();
    applyStoredDisplayModes();
    sb.auth.onAuthStateChange((event, session) => {
      if(event === "PASSWORD_RECOVERY"){
        currentUser = null;
        manualLogoutInProgress = true;
        if(sb) sb.auth.signOut();
        clearRecoveryUrl();
        resetSignedOutState(passwordResetMessage(), "warn");
        return;
      }
      if(event === "SIGNED_OUT"){
        const message = manualLogoutInProgress ? "" : "Sessão encerrada. Faça login novamente.";
        manualLogoutInProgress = false; resetSignedOutState(message); return;
      }
      if(event === "TOKEN_REFRESHED"){ currentUser = session?.user || currentUser; return; }
      if(event === "USER_UPDATED"){ setTimeout(() => refreshProfileAfterSessionUpdate(session), 0); }
      if(event === "SIGNED_IN"){ setTimeout(() => handleSignedInSession(session, "oauth"), 0); }
    });
    await loadConfig({ silent:true });
    const handledOAuth = await handleOAuthCodeCallback();
    if(handledOAuth) return;
    const qs = new URLSearchParams(window.location.search || "");
    const authError = qs.get("auth_error");
    const authOk = qs.get("auth") === "google";
    const sessionFromCallback = authOk ? await waitForAuthSession() : null;
    const { data } = sessionFromCallback ? { data:{ session:sessionFromCallback } } : await sb.auth.getSession();
    if(hasPasswordRecoveryParams()){
      currentUser = null;
      manualLogoutInProgress = true;
      if(sb) await sb.auth.signOut();
      clearRecoveryUrl();
      resetSignedOutState(passwordResetMessage(), "warn");
      return;
    }
    if(data && data.session){
      await handleSignedInSession(data.session, "boot");
    } else {
      loader(false);
      document.body.classList.remove("config-loading");
      if(authError){
        showAlert("loginMsg","Não foi possível finalizar o login Google. Tente novamente escolhendo a conta.","error");
        clearOAuthUrl();
      }
    }
  }

  function hasPasswordRecoveryParams(){
    const qs = new URLSearchParams(window.location.search || "");
    const hash = new URLSearchParams(String(window.location.hash || "").replace(/^#/, ""));
    // OAuth com Google tambem volta com ?code=...; isso nao e recuperacao de senha.
    // So trate como recovery quando o tipo vier explicitamente como recovery ou reset=1.
    return qs.get("reset") === "1" || qs.get("type") === "recovery" ||
      hash.get("type") === "recovery";
  }

  function clearRecoveryUrl(){ history.replaceState({}, document.title, window.location.pathname); }
  function clearOAuthUrl(){
    const qs = new URLSearchParams(window.location.search || "");
    const hash = new URLSearchParams(String(window.location.hash || "").replace(/^#/, ""));
    if(qs.has("code") || qs.has("auth") || qs.has("auth_error") || hash.has("access_token") || hash.has("refresh_token")){
      history.replaceState({}, document.title, window.location.pathname);
    }
  }

  function applyStoredSidebarState(){
    if(isSidebarLockedViewport()) return;
    try{ const saved = localStorage.getItem("agsus_monitora_sidebar_collapsed_v1"); if(saved==="0") document.body.classList.remove("sidebar-collapsed"); if(saved==="1") document.body.classList.add("sidebar-collapsed"); }catch(e){}
  }
  function togglePassword(){ const p = $("loginPassword"); p.type = p.type==="password" ? "text" : "password"; }

  async function login(){
    if(!sb && !initSupabase()) return;
    const email = txt($("loginEmail").value); const password = $("loginPassword").value;
    if(!email || !password){ showAlert("loginMsg","Informe usuário e senha.","warn"); return; }
    $("loginBtn").disabled = true; $("loginBtn").textContent = "Entrando...";
    loader(true,"Autenticando","Validando credenciais...",12);
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if(error){
      loader(false); $("loginBtn").disabled = false; setLoginButtonReady();
      showAlert("loginMsg","Falha no login: " + error.message,"error"); return;
    }
    currentUser = data.user; openApp(currentUser);
    const ready = await loadInitialData();
    if(ready){
      await trackAccess("login", { tela:"login", detalhes:{ email } }); startAccessHeartbeat();
      startRealtime();
      loader(false); toast("Login realizado com sucesso.");
    }
    $("loginBtn").disabled = false; setLoginButtonReady();
  }

  async function loginWithGoogle(){
    if(!sb && !initSupabase()) return;
    if(!cfgBool("auth_google_enabled", false)) return;
    const btn = $("googleLoginBtn");
    if(btn) btn.disabled = true;
    // Para testes e troca de perfil, limpe a sessao local antes do OAuth.
    // O Google ainda pode ter conta ativa no navegador; prompt=select_account
    // forca a tela de escolha de conta.
    try{ await sb.auth.signOut({ scope:"local" }); }catch(e){}
    currentUser = null;
    profile = null;
    const redirectTo = window.location.origin && window.location.origin !== "null"
      ? window.location.origin + window.location.pathname
      : window.location.href.split("#")[0].split("?")[0];
    const domainHint = txt(cfgValue("auth_google_domain_hint"));
    const queryParams = { prompt:"select_account" };
    if(domainHint) queryParams.hd = domainHint;
    const options = { redirectTo, queryParams };
    const { error } = await sb.auth.signInWithOAuth({ provider:"google", options });
    if(error){
      if(btn) btn.disabled = false;
      showAlert("loginMsg","Falha ao iniciar login Google: " + error.message,"error");
    }
  }

  async function logout(){
    await trackAccess("logout", { detalhes:{ current_view:currentView } });
    stopRealtime();
    manualLogoutInProgress = true; if(sb) await sb.auth.signOut(); resetSignedOutState("","");
  }

  function openApp(user){
    document.body.classList.remove("access-request-mode");
    $("loginScreen").classList.add("hidden"); $("appScreen").classList.remove("hidden"); $("userEmail").textContent = user?.email || "-";
  }

  async function loadInitialData(){
    loader(true,cfgValue("loader_environment_title"),cfgValue("loader_environment_subtitle"),22);
    const profileOk = await loadProfile();
    if(!profileOk){
      loader(true,cfgValue("loader_panels_title"),cfgValue("loader_panels_subtitle"),35);
      try{ await loadPanels(); }catch(error){ console.warn("Falha ao carregar paineis para solicitacao:", error); panels=[...DEFAULT_PANELS]; }
      try{ await showAccessRequestState(); }
      catch(error){
        console.error("Falha ao exibir solicitacao de acesso:", error);
        forceAccessRequestFallback("Seu e-mail entrou com Google, mas ainda precisa ser liberado por um administrador.");
      }
      loader(false);
      return false;
    }
    loader(true,cfgValue("loader_config_title"),cfgValue("loader_config_subtitle"),34); await loadConfig();
    loader(true,cfgValue("loader_panels_title"),cfgValue("loader_panels_subtitle"),48); await loadPanels(); await loadPanelPermissions(); buildNav(); warmExternalPanels(); await sleep(180);
    loader(true,cfgValue("loader_map_title"),cfgValue("loader_map_subtitle"),52); await loadMapaConfig();
    loader(true,cfgValue("loader_units_title"),cfgValue("loader_units_subtitle"),55); await loadUnidades();
    loader(true,cfgValue("loader_data_title"),cfgValue("loader_data_subtitle"),62);
    const dataOk = await loadData({ showLoader:false }); if(!dataOk){ loader(false); return; }
    loader(true,cfgValue("loader_finish_title"),cfgValue("loader_finish_subtitle"),88); navigate(startView()); loader(false);
    return true;
  }

  function isViewAllowed(view){
    if(!view) return false;
    if(view==="dashboard") return can("ind");
    if(view==="nucleo")    return can("cores");
    if(view==="config")    return can("config");
    if(view.startsWith("panel:")){ const code=view.split(":")[1]; return canAccessPanelCode(code); }
    return false;
  }
  function rememberView(view){ if(!view) return; try{ localStorage.setItem(VIEW_STORAGE_KEY,view); }catch(e){} }
  function storedView(){ try{ return localStorage.getItem(VIEW_STORAGE_KEY)||""; }catch(e){ return ""; } }
  function systemHomeView(){
    // Tela inicial do SISTEMA (nunca um painel externo).
    if(can("ind"))    return "dashboard";
    if(can("cores"))  return "nucleo";
    if(can("config")) return "config";
    const firstPanel = panels.find(panelAllowed);
    if(firstPanel) return "panel:"+firstPanel.codigo;
    return "dashboard";
  }
  function startView(){
    // Restaura a última tela — EXCETO painéis externos, para o app nunca abrir
    // "preso" num painel externo (sem menu para voltar) ao recarregar.
    const stored=storedView();
    if(stored && !stored.startsWith("panel:") && isViewAllowed(stored)) return stored;
    return systemHomeView();
  }

  async function loadProfile(){
    if(!currentUser?.id) return false;
    const { data, error } = await sb.rpc("meu_usuario");
    if(error){
      console.warn("Perfil indisponivel para o usuario atual:", error);
      profile = null;
      return false;
    }
    const row = rpcFirst(data);
    if(!row){ profile = null; return false; }
    profile = { ...row, ativo:true };
    // Exibir perfil na sidebar
    const badge = $("userProfileBadge");
    if(badge && profile.perfil){
      const label = low(profile.perfil) === "master" ? "Master" : txt(profile.perfil);
      badge.textContent = label;
      badge.style.display = "inline-block";
    }
    return true;
  }

  function userDisplayName(){
    const meta = currentUser?.user_metadata || {};
    return txt(meta.full_name || meta.name || meta.nome || currentUser?.email?.split("@")[0] || "");
  }

  async function showAccessRequestState(){
    stopRealtime();
    stopAccessHeartbeat();
    loader(false);
    document.body.classList.remove("config-loading");
    $("appScreen").classList.add("hidden");
    $("loginScreen").classList.remove("hidden");
    document.body.classList.add("access-request-mode");
    const emailInput = $("loginEmail");
    if(emailInput) emailInput.value = currentUser?.email || "";
    setText("accessReqEmail", currentUser?.email || "-");
    $("loginPassword").value = "";
    showAlert("loginMsg","Seu e-mail entrou com Google, mas ainda precisa ser liberado por um administrador.","warn");
    const card = $("accessRequestCard");
    if(card) card.classList.remove("hidden");
    const nome = $("accessReqNome");
    if(nome && !txt(nome.value)) nome.value = userDisplayName();
    renderAccessPanelChoices();
    try{ await loadMyAccessRequest(); }
    catch(error){
      console.warn("Nao foi possivel consultar solicitacao anterior:", error);
      const status = $("accessRequestStatus");
      if(status){
        status.classList.remove("hidden");
        status.textContent = "Preencha e envie a solicitação. Não foi possível consultar solicitações anteriores neste momento.";
      }
      const btn = $("accessRequestBtn"); if(btn) btn.disabled = false;
    }
  }

  function forceAccessRequestFallback(message){
    stopRealtime();
    stopAccessHeartbeat();
    loader(false);
    document.body.classList.remove("config-loading");
    $("appScreen")?.classList.add("hidden");
    $("loginScreen")?.classList.remove("hidden");
    document.body.classList.add("access-request-mode");
    const emailInput = $("loginEmail"); if(emailInput) emailInput.value = currentUser?.email || "";
    setText("accessReqEmail", currentUser?.email || "-");
    const pass = $("loginPassword"); if(pass) pass.value = "";
    showAlert("loginMsg", message || "Solicite acesso para continuar.", "warn");
    $("accessRequestCard")?.classList.remove("hidden");
    const nome = $("accessReqNome"); if(nome && !txt(nome.value)) nome.value = userDisplayName();
    renderAccessPanelChoices();
    const btn = $("accessRequestBtn"); if(btn) btn.disabled = false;
  }

  function renderAccessPanelChoices(selectedIds=[]){
    const box = $("accessPanelChoices"); if(!box) return;
    const activePanels = panels.filter(p=>p.ativo!==false);
    if(!activePanels.length){
      box.innerHTML = `<div class="access-status">Nenhum painel externo ativo encontrado.</div>`;
      return;
    }
    const selected = new Set(selectedIds.map(String));
    box.innerHTML = activePanels.map(p=>`
      <label class="panel-check">
        <input type="checkbox" class="access-panel-choice" value="${attr(p.id||"")}" ${selected.has(String(p.id))?"checked":""}>
        <span>${esc(p.titulo||p.codigo)}</span>
      </label>
    `).join("");
  }

  async function loadMyAccessRequest(){
    if(!currentUser?.id) return null;
    const { data, error } = await sb
      .from("solicitacoes_acesso")
      .select("id,status,observacao_admin,created_at,solicitacoes_acesso_paineis(painel_id)")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending:false })
      .limit(1);
    const status = $("accessRequestStatus");
    const btn = $("accessRequestBtn");
    if(error){
      if(status){ status.classList.remove("hidden"); status.textContent = "Não foi possível consultar sua solicitação anterior: "+friendlyError(error); }
      if(btn) btn.disabled = false;
      return null;
    }
    const req = Array.isArray(data) ? data[0] : null;
    if(!req){
      if(status) status.classList.add("hidden");
      if(btn) btn.disabled = false;
      return null;
    }
    const panelIds = (req.solicitacoes_acesso_paineis||[]).map(r=>r.painel_id).filter(Boolean);
    renderAccessPanelChoices(panelIds);
    if(status){
      status.classList.remove("hidden");
      const msg = req.status === "pendente"
        ? "Solicitação enviada. Aguarde a liberação de um administrador."
        : req.status === "aprovado"
          ? "Solicitação aprovada. Saia e entre novamente para carregar o perfil."
          : req.status === "recusado"
            ? "Solicitação recusada. Você pode ajustar os dados e enviar uma nova solicitação."
            : "Status da solicitação: "+req.status;
      status.textContent = req.observacao_admin ? `${msg} Observação: ${req.observacao_admin}` : msg;
    }
    if(btn) btn.disabled = req.status === "pendente" || req.status === "aprovado";
    return req;
  }

  async function submitAccessRequest(){
    if(!sb || !currentUser?.id) return showAlert("loginMsg","Faça login com Google antes de solicitar acesso.","warn");
    const btn = $("accessRequestBtn");
    if(btn) btn.disabled = true;
    const nome = txt($("accessReqNome")?.value) || userDisplayName();
    const setor = txt($("accessReqSetor")?.value);
    const justificativa = txt($("accessReqJustificativa")?.value);
    const selectedPanels = Array.from(document.querySelectorAll(".access-panel-choice:checked")).map(el=>txt(el.value)).filter(Boolean);
    if(!nome || !justificativa){
      if(btn) btn.disabled = false;
      return showAlert("loginMsg","Informe seu nome e uma justificativa breve.","warn");
    }
    const { data, error } = await sb.from("solicitacoes_acesso").insert({
      user_id: currentUser.id,
      email: currentUser.email,
      nome,
      setor,
      justificativa,
      perfil_solicitado: "leitor",
      status: "pendente"
    }).select("id").single();
    if(error){
      if(btn) btn.disabled = false;
      return showAlert("loginMsg","Não foi possível enviar a solicitação: "+friendlyError(error),"error");
    }
    if(selectedPanels.length){
      const panelRows = selectedPanels.map(painel_id=>({ solicitacao_id:data.id, painel_id }));
      const { error:panelErr } = await sb.from("solicitacoes_acesso_paineis").insert(panelRows);
      if(panelErr) toast("Solicitação enviada, mas houve erro ao registrar os painéis solicitados: "+friendlyError(panelErr),"warn");
    }
    showAlert("loginMsg","Solicitação enviada. Um administrador poderá liberar seu acesso.","success");
    await loadMyAccessRequest();
  }

  async function loadConfig(options={}){
    const silent = options.silent === true;
    appConfig = {};
    loadedConfigKeys = new Set();
    configLoadOk = false;
    const { data, error } = await sb.from("configuracoes").select("chave,valor,descricao");
    if(error){ if(!silent) toast("Erro ao carregar configurações: "+friendlyError(error),"error"); applyConfigToUi(); renderConfigForm(); document.body.classList.remove("config-loading"); return false; }
    if(Array.isArray(data)) data.forEach(r => { if(r.chave){ loadedConfigKeys.add(r.chave); appConfig[r.chave] = r.valor ?? ""; } });
    configLoadOk = true;
    applyConfigToUi(); renderConfigForm(); document.body.classList.remove("config-loading"); return true;
  }

  function applyConfigToUi(){
    // Títulos e slogan
    document.title = appVersion() || "AgSUS Monitora";
    const metaDesc = document.querySelector('meta[name="description"]');
    if(metaDesc) metaDesc.setAttribute("content", "AgSUS Monitora - Monitoramento de Processos Seletivos");
    setText("skipLink", cfgValue("skip_link_text"));
    setText("offlineBar", cfgValue("offline_message"));
    setLoginButtonReady();
    const googleBtn = $("googleLoginBtn");
    if(googleBtn){
      const enabled = cfgBool("auth_google_enabled", false);
      googleBtn.style.display = enabled ? "flex" : "none";
      setText("googleLoginText", cfgValue("auth_google_button_text"));
    }
    setText("sidebarUserLabel", cfgValue("sidebar_user_label"));
    setText("sidebarVersionLabel", cfgValue("sidebar_version_label"));
    setText("sidebarVersion", appVersion());
    setText("logoutText", cfgValue("logout_text"));
    setText("pageTitle", cfgValue("page_title"));
    setText("pageSubtitle", cfgValue("page_subtitle"));
    setText("filterTitle", cfgValue("filter_title"));
    setText("filterSubtitle", cfgValue("filter_subtitle"));
    setText("externalBackText", cfgValue("external_back_text"));
    setText("darkModeLabel", cfgValue("dark_mode_label"));
    setText("exportCsvText", cfgValue("action_export_text"));
    setText("fullscreenActionText", cfgValue("action_fullscreen_text"));
    setText("refreshActionText", cfgValue("action_refresh_text"));
    setText("exportPdfActionText", cfgValue("action_export_pdf_text"));
    setText("dashboardSectionProcessos", cfgValue("dashboard_section_processos"));
    setText("kpiProcessosLabel", cfgValue("kpi_processos_label"));
    setText("kpiVagasLabel", cfgValue("kpi_vagas_label"));
    setText("kpiContratadosLabel", cfgValue("kpi_contratados_label"));
    setText("kpiOciosasLabel", cfgValue("kpi_ociosas_label"));
    setText("kpiCriticosLabel", cfgValue("kpi_criticos_label"));
    setText("panicChip", cfgValue("kpi_criticos_chip"));
    setText("kpiInscritosLabel", cfgValue("kpi_inscritos_label"));
    setText("statusSummaryTitle", cfgValue("panel_status_summary_title"));
    setText("operationalStatusTitle", cfgValue("panel_operational_status_title"));
    setText("attentionTitle", cfgValue("panel_attention_title"));
    setText("detailsTitle", cfgValue("details_title"));
    setText("columnsButtonText", cfgValue("columns_button_text"));
    setText("columnsMenuTitle", cfgValue("columns_menu_title"));
    setText("keyboardHint", cfgValue("keyboard_hint"));
    setText("externalTitle", cfgValue("external_default_title"));
    setText("externalRefreshText", cfgValue("external_refresh_text"));
    setText("externalOpen", cfgValue("external_open_text"));
    const externalMount = $("externalMount");
    if(externalMount && externalMount.classList.contains("external-placeholder")) externalMount.textContent = cfgValue("external_placeholder");
    if($("tableSearch")){
      $("tableSearch").placeholder = cfgValue("table_search_placeholder");
      $("tableSearch").setAttribute("aria-label", cfgValue("table_search_placeholder"));
    }
    ["globalSidebarToggle","hambToggle"].forEach(id => { setAttr(id,"title",cfgValue("sidebar_toggle_label")); setAttr(id,"aria-label",cfgValue("sidebar_toggle_label")); });
    ["externalBackBtn"].forEach(id => { setAttr(id,"title",cfgValue("external_back_text")); setAttr(id,"aria-label",cfgValue("external_back_text")); });
    setAttr("moreActionsBtn","title",cfgValue("action_more_label"));
    setAttr("moreActionsBtn","aria-label",cfgValue("action_more_label"));
    syncFilterToggleText();
    syncHideClosedBtn();
    // COGIP rodapé
    const cogipBlock = document.querySelector(".login-cogip");
    const cogipParts = [cfgValue("cogip_nome"), cfgValue("cogip_funcao"), cfgValue("cogip_versao"), cfgValue("cogip_dept"), cfgValue("cogip_logo_url")].filter(Boolean);
    if(cogipBlock) cogipBlock.style.display = cogipParts.length ? "flex" : "none";
    const foot = $("loginFoot"); if(foot) foot.textContent = cfgValue("cogip_dept") || cfgValue("footer_text");
    const cogipName = $("loginCogipName"); if(cogipName) cogipName.textContent = cfgValue("cogip_nome");
    const roleParts = [cfgValue("cogip_funcao"), cfgValue("cogip_versao")].filter(Boolean);
    const cogipRole = $("loginCogipRole"); if(cogipRole) cogipRole.textContent = roleParts.join(" · ");
    const cogipVer  = $("loginVersion");  if(cogipVer)  cogipVer.textContent  = cfgValue("cogip_versao");
    setImg("loginCogipLogo", cfgValue("cogip_logo_url"), cfgValue("cogip_nome"));
    // Imagens
    setImg("sideLogo", cfgValue("mascot_url"), cfgValue("app_title"));
  }

  function normalizeUnitName(value){ return low(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim(); }
  function sortUnits(a,b){
    const ta=txt(a.tipo),tb=txt(b.tipo);
    if(ta!==tb) return ta.localeCompare(tb,"pt-BR",{numeric:true});
    return txt(a.nome_oficial||a.unidade||a.nome).localeCompare(txt(b.nome_oficial||b.unidade||b.nome),"pt-BR",{numeric:true});
  }

  async function loadUnidades(){
    if(!sb){ unidadesCatalog=[]; populateModalUnidades(); return false; }
    const { data, error } = await sb.from("dim_unidades").select("id_unidade,sigla,nome_oficial,tipo,uf_sede,ativo").eq("ativo",true).order("tipo",{ascending:true}).order("nome_oficial",{ascending:true});
    if(error){ unidadesCatalog=[]; populateModalUnidades(); toast("Catálogo dim_unidades não disponível.","warn"); return false; }
    unidadesCatalog = Array.isArray(data) ? data.filter(u=>txt(u.nome_oficial)).sort(sortUnits) : [];
    populateModalUnidades(); return true;
  }

  function fallbackUnitsFromRows(){
    const map = new Map();
    rows.forEach(r => {
      const nome = txt(r.unidade); if(!nome||map.has(normalizeUnitName(nome))) return;
      map.set(normalizeUnitName(nome), { id_unidade:txt(r.id_unidade)||"", sigla:txt(r.sigla_unidade)||"", nome_oficial:nome, tipo:txt(r.tipo_unidade)||(nome.toUpperCase().startsWith("CASAI")?"CASAI":"DSEI"), uf_sede:txt(r.uf).toUpperCase(), ativo:true, fallback:true });
    });
    return Array.from(map.values()).sort(sortUnits);
  }

  function unidadesForModal(){
    const primary = unidadesCatalog.length ? unidadesCatalog : [];
    const byName = new Map(primary.map(u=>[normalizeUnitName(u.nome_oficial),u]));
    fallbackUnitsFromRows().forEach(u=>{ if(!byName.has(normalizeUnitName(u.nome_oficial))) byName.set(normalizeUnitName(u.nome_oficial),u); });
    return Array.from(byName.values()).sort(sortUnits);
  }

  function unidadeOptionValue(unit){ return txt(unit.id_unidade)||txt(unit.nome_oficial); }
  function findUnitByValue(value){ const clean=txt(value); if(!clean) return null; return unidadesForModal().find(u=>unidadeOptionValue(u)===clean||txt(u.id_unidade)===clean||txt(u.nome_oficial)===clean)||null; }
  function findUnitForRow(row){
    if(!row) return null;
    const byId=txt(row.id_unidade); if(byId){ const found=unidadesForModal().find(u=>txt(u.id_unidade)===byId); if(found) return found; }
    const rowName=normalizeUnitName(row.unidade); if(rowName){ const found=unidadesForModal().find(u=>normalizeUnitName(u.nome_oficial)===rowName); if(found) return found; }
    return null;
  }

  function populateModalUnidades(selectedValue=""){
    const select=$("mUnidade"); if(!select) return;
    const current=selectedValue||select.value;
    const units=unidadesForModal();
    select.innerHTML=`<option value="">Selecione a unidade</option>`+units.map(u=>{
      const value=unidadeOptionValue(u);
      const label=`${txt(u.nome_oficial)}${txt(u.uf_sede)?" — "+txt(u.uf_sede).toUpperCase():""}`;
      return `<option value="${attr(value)}" data-id="${attr(u.id_unidade)}" data-sigla="${attr(u.sigla)}" data-tipo="${attr(u.tipo)}" data-uf="${attr(u.uf_sede)}" data-nome="${attr(u.nome_oficial)}">${esc(label)}</option>`;
    }).join("");
    if(current&&Array.from(select.options).some(o=>o.value===current)) select.value=current;
  }

  function selectedModalUnidade(){
    const select=$("mUnidade"); if(!select) return null;
    const unit=findUnitByValue(select.value); if(unit) return unit;
    const opt=select.options[select.selectedIndex]; if(!opt||!txt(opt.value)) return null;
    return { id_unidade:opt.dataset.id||"", sigla:opt.dataset.sigla||"", nome_oficial:opt.dataset.nome||opt.textContent||"", tipo:opt.dataset.tipo||"", uf_sede:opt.dataset.uf||"" };
  }

  function onModalUnidadeChange(){
    const unit=selectedModalUnidade();
    setFieldValue("mIdUnidade", unit?.id_unidade||""); setFieldValue("mSiglaUnidade", unit?.sigla||"");
    setFieldValue("mTipoUnidade", unit?.tipo||""); setFieldValue("mUf", txt(unit?.uf_sede).toUpperCase());
  }

  async function loadPanels(){
    const { data, error } = await sb.from("paineis_externos").select("id,codigo,titulo,icone,url,ordem,ativo,em_manutencao,tipo_abertura").order("ordem",{ascending:true});
    if(!error&&Array.isArray(data)&&data.length) panels=data; else panels=[...DEFAULT_PANELS];
    renderPanelAdmin();
  }

  async function loadPanelPermissions(){
    allowedPanelIds = new Set();
    if(!profile?.id || !can("paineis")) return true;
    if(low(profile.perfil) === "master"){
      panels.filter(p=>p.ativo!==false).forEach(p=>{ if(p.id) allowedPanelIds.add(p.id); });
      return true;
    }
    const { data, error } = await sb
      .from("perfis_paineis_externos")
      .select("painel_id,ativo")
      .eq("perfil_usuario_id", profile.id)
      .eq("ativo", true);
    if(error){
      toast("Não foi possível carregar permissões dos painéis externos: "+friendlyError(error),"warn");
      return false;
    }
    (data||[]).forEach(r=>{ if(r.painel_id) allowedPanelIds.add(r.painel_id); });
    return true;
  }

  function panelAllowed(panel){
    if(!panel || panel.ativo===false || !can("paineis")) return false;
    if(low(profile?.perfil) === "master") return true;
    return !!panel.id && allowedPanelIds.has(panel.id);
  }

  function canAccessPanelCode(code){
    return panels.some(p=>p.codigo===code && panelAllowed(p));
  }

  async function saveMapaConfigToSupabase(options={}){
    if(!sb || !can("config")) return false;
    const silent = options.silent === true;
    const rowsToSave = [
      { chave:"lmap", payload:LMAP, descricao:"Mapa dos DSEIs e polos base usado pelo dashboard" },
      { chave:"rede_cnes", payload:REDE_CNES, descricao:"Rede assistencial CNES/UBSI/CASAI usada pelo mapa" }
    ];
    const { error } = await sb.from(MAPA_CONFIG_TABLE).upsert(rowsToSave, { onConflict:"chave" });
    if(error){
      if(!silent) toast("Erro ao salvar mapa/rede no Supabase: "+friendlyError(error),"error");
      return false;
    }
    mapConfigLoadOk = true;
    if(!silent) toast("Mapa e rede assistencial salvos no Supabase.");
    return true;
  }

  async function loadMapaConfig(){
    mapConfigLoadOk = false;
    if(!sb) return false;
    const { data, error } = await sb.from(MAPA_CONFIG_TABLE).select("chave,payload").in("chave",["lmap","rede_cnes"]);
    if(error){
      console.warn("Mapa/rede do Supabase indisponível:", error);
      if(can("config")) toast("Mapa/rede do Supabase indisponível. Verifique a tabela de configuração do mapa.","warn");
      return false;
    }
    const byKey = Object.fromEntries((data||[]).map(r => [r.chave, r.payload]));
    if(byKey.lmap && Array.isArray(byKey.lmap.dsei)) LMAP = byKey.lmap;
    if(byKey.rede_cnes && byKey.rede_cnes.rede) REDE_CNES = byKey.rede_cnes;
    rebuildDseiIndex();
    mapConfigLoadOk = !!(byKey.lmap && byKey.rede_cnes);
    if(!mapConfigLoadOk && can("config")) toast("Configuração do mapa incompleta no Supabase.","warn");
    return mapConfigLoadOk;
  }

  async function loadMonitoramentoPayload(){
    if(!sb) return null;
    const { data, error } = await sb.rpc(MONITORAMENTO_DASHBOARD_PAYLOAD_RPC);
    if(error){
      console.warn("Payload consolidado de monitoramento indisponível; usando carregamento legado:", error);
      return null;
    }
    return data || null;
  }

  async function loadData(options={}){
    if(activeLoadDataPromise) return activeLoadDataPromise;
    const showOwnLoader = options.showLoader !== false;
    const runId = ++loadDataRunCounter;
    activeLoadDataPromise = (async () => {
      if(!can("ind")&&!can("cores")){ rows=[]; filtered=[]; buildNav(); return true; }
      if(showOwnLoader) loader(true,"Atualizando","Sincronizando dados...",62);
      const [payloadResponse, tableResponse] = await Promise.all([
        loadMonitoramentoPayload(),
        sb.from("monitoramento_indigena").select("aprovados_analise,aprovados_prova,aptos_analise,ativo,cancelados,cargos,ciclo,contratados,data_fim,data_inicio,edital,eliminados_nota,entrevistados,etapa,id,id_unidade,inscritos,link_edital,observacoes,observacoes_internas,processo,reprovados_analise,responsavel,risco,sigla_unidade,status,tipo_unidade,total_eliminados,uf,unidade,vagas_ociosas,vagas_total").eq("ativo",true).order("unidade",{ascending:true}).order("edital",{ascending:true})
      ]);
      if(runId!==loadDataRunCounter) return false;
      monitoramentoPayload = payloadResponse || null;
      const { data, error } = tableResponse;
      if(error){ if(showOwnLoader) loader(false); toast("Erro ao carregar dados: "+friendlyError(error),"error"); return false; }
      rows = Array.isArray(data) ? data : [];
      dataLoadedAtLeastOnce = true;
      lastMapUfKey = null; // invalida cache do mapa ao recarregar dados
      populateModalUnidades(); populateFilters(); applyFilters(); setUpdated();
      if(showOwnLoader) loader(false); return true;
    })();
    try{ return await activeLoadDataPromise; }finally{ activeLoadDataPromise=null; }
  }

  function setUpdated(){ const now=new Date(); $("updatedText").textContent="Atualizado em "+now.toLocaleString("pt-BR"); $("updatedPill").classList.remove("hidden"); }

  async function refreshData(){
    if(activeRefreshDataPromise) return activeRefreshDataPromise;
    const previousView=currentView;
    const previousPanelCode=previousView&&previousView.startsWith("panel:")?previousView.split(":")[1]:"";
    activeRefreshDataPromise=(async()=>{
      loader(true,"Atualizando configurações","Buscando parâmetros e painéis...",24); await loadConfig(); await loadPanels(); await loadPanelPermissions(); await loadMapaConfig(); buildNav();
      loader(true,"Atualizando painéis","Reconstruindo cache...",48); warmExternalPanels(true); await sleep(180);
      loader(true,"Atualizando unidades","Atualizando catálogo DSEI/CASAI...",58); await loadUnidades();
      loader(true,"Atualizando dados","Sincronizando monitoramento...",68);
      const dataOk=await loadData({showLoader:false}); if(!dataOk){ loader(false); return false; }
      if(previousPanelCode){ const activePanel=panels.find(p=>p.codigo===previousPanelCode&&panelAllowed(p)); if(activePanel){ currentPanel=activePanel; openPanel(previousPanelCode); }else{ currentPanel=null; navigate(startView()); } }
      else if(isViewAllowed(previousView)) navigate(previousView); else navigate(startView());
      loader(false); toast("Dados atualizados."); return true;
    })();
    try{ return await activeRefreshDataPromise; }finally{ activeRefreshDataPromise=null; }
  }

  function buildNav(){
    const nav=$("nav"); let html="";
    if(can("ind"))    html+=navButton("dashboard",cfgValue("page_title"),"fa-feather-pointed");
    if(can("cores"))  html+=navButton("nucleo",cfgValue("nucleo_nav_title"),"fa-pen-to-square");
    if(can("paineis")) panels.filter(panelAllowed).sort((a,b)=>n(a.ordem)-n(b.ordem)).forEach(p=>{ html+=navButton("panel:"+p.codigo,p.titulo,p.icone||"fa-arrow-up-right-from-square"); });
    if(can("config")) html+=navButton("config",cfgValue("config_nav_title"),"fa-gear");
    nav.innerHTML=html||`<div class="alert warn">${esc(cfgValue("permissions_empty_text"))}</div>`;
    setActiveNav(currentView);
  }

  function navIconHTML(ico){ return `<i class="fa-solid ${attr(/^fa-/.test(String(ico||""))?ico:"fa-circle")}" aria-hidden="true"></i>`; }
  function navButton(view,label,ico){ return `<button data-view="${attr(view)}" onclick="navigate('${attr(view)}')" aria-label="${attr(label)}" title="${attr(label)}"><span class="nav-ico">${navIconHTML(ico)}</span><span class="nav-text">${esc(label)}</span></button>`; }
  function setActiveNav(view){ document.querySelectorAll("#nav button").forEach(b=>b.classList.toggle("active",b.dataset.view===view)); }

  function navigate(view){
    const previousView = currentView;
    const requestedView = txt(view) || startView();

    // Valida permissão antes de alterar currentView e antes de esconder páginas.
    // A versão anterior mudava o estado primeiro; se a permissão falhasse,
    // o painel podia ficar sem página ativa.
    if(requestedView === "dashboard" && !can("ind")){
      toast("Sem permissão para Saúde Indígena.","warn");
      return;
    }
    if(requestedView === "nucleo" && !can("cores")){
      toast("Sem permissão para Equipe Núcleo.","warn");
      return;
    }
    if(requestedView === "config" && !can("config")){
      toast("Sem permissão para Configurações.","warn");
      return;
    }
    if(requestedView.startsWith("panel:")){
      const code = requestedView.split(":")[1];
      const panelOk = canAccessPanelCode(code);
      if(!panelOk){
        toast("Sem permissão para este painel externo ou painel inativo.","warn");
        return;
      }
    }

    document.body.classList.remove("external-clean");
    currentView = requestedView;
    rememberView(requestedView);
    if(!requestedView.startsWith("panel:")) currentPanel = null;
    enforceResponsiveSidebar();
    applyExecutiveModeForCurrentView();
    setActiveNav(requestedView);
    document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));

    if(requestedView === "dashboard"){
      $("page-dashboard").classList.add("active");
      setPageTitle(cfgValue("page_title"),cfgValue("page_subtitle"));
      renderAll();
      if(previousView !== requestedView) trackAccess("abertura_tela",{tela:requestedView});
      return;
    }
    if(requestedView === "nucleo"){
      $("page-nucleo").classList.add("active");
      setPageTitle(cfgValue("nucleo_nav_title"),cfgValue("nucleo_page_subtitle"));
      renderNucleo();
      if(previousView !== requestedView) trackAccess("abertura_tela",{tela:requestedView});
      return;
    }
    if(requestedView === "config"){
      $("page-config").classList.add("active");
      setPageTitle(cfgValue("config_nav_title"),cfgValue("config_page_subtitle"));
      renderConfigForm();
      if(previousView !== requestedView) trackAccess("abertura_tela",{tela:requestedView});
      return;
    }
    if(requestedView.startsWith("panel:")){
      openPanel(requestedView.split(":")[1]);
      if(previousView !== requestedView) trackAccess("abertura_tela",{tela:requestedView});
    }
  }

  function setPageTitle(title,sub){
    $("pageTitle").textContent=title;
    $("pageSubtitle").textContent=sub;
    document.title=[title,cfgValue("app_title")].filter(Boolean).join(" - ");
  }

  function isSidebarLockedViewport(){ return window.matchMedia(`(max-width:${SIDEBAR_LOCK_BREAKPOINT}px)`).matches; }
  function shouldLockSidebar(){ return isSidebarLockedViewport()||SIDEBAR_FORCE_LOCK_VIEWS.has(currentView); }
  function enforceResponsiveSidebar(){ const locked=shouldLockSidebar(); document.body.classList.toggle("sidebar-locked",locked); if(locked) document.body.classList.add("sidebar-collapsed"); }

  function toggleSidebar(){
    enforceResponsiveSidebar();
    if(shouldLockSidebar()){ document.body.classList.add("sidebar-collapsed"); if(currentView==="dashboard") scheduleMapResize(240); return; }
    document.body.classList.toggle("sidebar-collapsed");
    try{ localStorage.setItem("agsus_monitora_sidebar_collapsed_v1",document.body.classList.contains("sidebar-collapsed")?"1":"0"); }catch(e){}
    if(currentView==="dashboard") scheduleMapResize(240);
  }

  function syncFilterToggleText(){
    const btn = $("filterToggleBtn"); const body = $("filterBody");
    if(!btn || !body) return;
    btn.textContent = body.classList.contains("hidden") ? cfgValue("filter_toggle_show") : cfgValue("filter_toggle_hide");
  }
  function toggleFilters(){ $("filterBody").classList.toggle("hidden"); syncFilterToggleText(); }

  function selectedValues(field){ return Array.from(filterState[field]||[]); }
  function rowValue(r,field){ return txt(r[field]); }
  function rowMatchesFilterState(r,ignoreField=""){
    if(hideClosed && isEncerrado(r)) return false; // toggle "Ocultar encerrados"
    return FILTER_CONFIG.every(cfg=>{ if(cfg.field===ignoreField) return true; const selected=filterState[cfg.field]; if(!selected||selected.size===0) return true; return selected.has(rowValue(r,cfg.field)); });
  }
  function optionValuesFor(field){ const values=new Set(); rows.forEach(r=>{ if(rowMatchesFilterState(r,field)){ const value=rowValue(r,field); if(value) values.add(value); } }); return Array.from(values).sort((a,b)=>a.localeCompare(b,"pt-BR",{numeric:true})); }
  function pruneFilterSelections(){ let changed=false; FILTER_CONFIG.forEach(cfg=>{ const allowed=new Set(optionValuesFor(cfg.field)); const selected=filterState[cfg.field]||new Set(); Array.from(selected).forEach(value=>{ if(!allowed.has(value)){ selected.delete(value); changed=true; } }); }); return changed; }
  function filterLabel(cfg){ const selected=selectedValues(cfg.field); if(!selected.length) return cfg.all; if(selected.length===1) return selected[0]; return `${selected.length} selecionados`; }

  function renderFilterControls(){
    FILTER_CONFIG.forEach(cfg=>{
      const el=$(cfg.id); if(!el) return;
      const values=optionValuesFor(cfg.field); const selected=filterState[cfg.field]||new Set(); const label=filterLabel(cfg);
      const options=values.length?values.map(value=>`<label class="multi-option" title="${attr(value)}"><input type="checkbox" ${selected.has(value)?"checked":""} onchange="toggleFilterValue('${attr(cfg.field)}','${attr(value)}')"><span>${esc(value)}</span></label>`).join(""):`<div class="multi-option empty">Nenhuma opção disponível</div>`;
      el.innerHTML=`<button type="button" class="multi-select-toggle" onclick="toggleFilterMenu('${attr(cfg.id)}')" title="${attr(label)}"><span class="multi-label">${esc(label)}</span><span class="multi-caret">▾</span></button><div class="multi-select-menu"><div class="multi-select-actions"><button type="button" class="multi-mini-btn" onclick="selectAllFilterValues('${attr(cfg.field)}')">Selecionar visíveis</button><button type="button" class="multi-mini-btn" onclick="clearFilterField('${attr(cfg.field)}')">Limpar</button></div><div class="multi-options">${options}</div><div class="multi-hint">${values.length} opção(ões) disponível(is).</div></div>`;
    });
  }

  function closeFilterMenus(exceptId=""){ document.querySelectorAll(".multi-select.open").forEach(el=>{ if(!exceptId||el.id!==exceptId) el.classList.remove("open"); }); }
  function toggleFilterMenu(id){ const el=$(id); if(!el) return; const opening=!el.classList.contains("open"); closeFilterMenus(id); el.classList.toggle("open",opening); }
  function applyFilterStateChange(){ pruneFilterSelections(); saveFilterState(); renderFilterControls(); applyFilters(); }
  function toggleFilterValue(field,value){ const selected=filterState[field]||new Set(); if(selected.has(value)) selected.delete(value); else selected.add(value); filterState[field]=selected; applyFilterStateChange(); }
  function selectAllFilterValues(field){ filterState[field]=new Set(optionValuesFor(field)); applyFilterStateChange(); }
  function clearFilterField(field){ filterState[field]=new Set(); applyFilterStateChange(); }
  function initFilterControls(){ document.addEventListener("click",ev=>{ if(!ev.target.closest||!ev.target.closest(".multi-select")) closeFilterMenus(); }); }
  function populateFilters(){
    loadFilterState();
    try{ hideClosed = localStorage.getItem("agsus_hide_closed_v1")==="1"; }catch(e){}
    try{ syncMapLevelUI(); }catch(e){}
    syncHideClosedBtn();
    pruneFilterSelections(); renderFilterControls();
  }
  function clearFilters(){
    hideClosed=false;
    try{ localStorage.setItem("agsus_hide_closed_v1","0"); }catch(e){}
    syncHideClosedBtn();
    filterState=Object.fromEntries(FILTER_CONFIG.map(f=>[f.field,new Set()]));
    ["tableSearch"].forEach(id=>{ const el=$(id); if(el) el.value=""; });
    saveFilterState(); renderFilterControls(); applyFilters();
    // mapa volta à visão Brasil (sem polos nem estado destacado)
    if(_leaflet){
      if(_layerPolos) _layerPolos.clearLayers();
      if(_layerUF) _layerUF.clearLayers();
      $("drillBackBtn") && ($("drillBackBtn").style.display="none");
      drawDSEIBubbles();
    }
  }

  function applyFilters(){
    const qt = low($("tableSearch")?.value);
    filtered = rows.filter(r=>{
      const hay = [r.processo,r.edital,r.unidade,r.ciclo,r.uf,r.status,r.etapa,r.responsavel,r.cargos,r.risco,r.observacoes,r.observacoes_internas,r.link_edital].map(low).join(" | ");
      return rowMatchesFilterState(r) && (!qt || hay.includes(qt));
    }).sort(compareRowsForTable);

    // A chave do mapa precisa considerar UF e quantidade.
    // Antes era apenas a lista de UFs; quando a busca mudava a quantidade,
    // mas mantinha as mesmas UFs, o mapa ficava visualmente desatualizado.
    const mapCounts = {};
    filtered.forEach(r=>{
      const k = dseiKey(r.unidade);
      if(k) mapCounts[k] = (mapCounts[k] || 0) + 1;
    });
    const newUfKey = (hasActiveFilter()?"F|":"A|") + Object.entries(mapCounts)
      .sort((a,b)=>a[0].localeCompare(b[0],"pt-BR"))
      .map(([k,count])=>`${k}:${count}`)
      .join("|");
    const mapChanged = newUfKey !== lastMapUfKey;
    lastMapUfKey = newUfKey;

    renderKpis();
    renderMultiUnits();
    renderStatusSummary();
    renderChart();
    if(mapChanged) renderMap();
    renderRisks();
    renderActiveFilters();
    renderTable();
    if(currentView === "nucleo") renderNucleo();
  }

  function toggleSelectFilter(selectId,value,label){
    const field=FILTER_ID_TO_FIELD[selectId];
    if(field){
      const cleanValue=txt(value); const selected=filterState[field]||new Set();
      const removing=selected.size===1&&selected.has(cleanValue);
      filterState[field]=removing?new Set():new Set([cleanValue]);
      applyFilterStateChange(); toast(removing?`${label} removido.`:`${label}: ${cleanValue}`); return;
    }
    const el=$(selectId); if(!el) return;
    const cleanValue=txt(value); const removing=txt(el.value)===cleanValue;
    el.value=removing?"":cleanValue; applyFilters();
    toast(removing?`${label} removido.`:`${label}: ${cleanValue}`);
  }

  // Processo encerrado (concluído ou cancelado) não é risco ativo a monitorar.
  function isEncerrado(r){ return ["concluído","concluido","cancelado","cancelada"].includes(low(r.status)); }
  function isRiscoAtivo(r){ return !isEncerrado(r) && ["alto","médio","medio"].includes(low(r.risco)); }
  function criticalRiskValues(){ const values=optionValuesFor("risco").filter(v=>["alto","médio","medio"].includes(low(v))); return values.length?values:["Alto","Médio"]; }
  function isCriticalRiskFilterActive(){ const sel=Array.from(filterState.risco||[]); return sel.length>0 && sel.every(v=>["alto","médio","medio"].includes(low(v))); }
  function toggleCriticalRiskFilter(){
    const active = isCriticalRiskFilterActive();
    filterState.risco = active ? new Set() : new Set(criticalRiskValues());
    applyFilterStateChange();
    toast(active ? "Filtro de risco removido." : "Filtro aplicado: risco Médio/Alto.");
  }

  function riskRank(value){ const rank={"alto":0,"médio":1,"medio":1,"baixo":2}; return rank[low(value)]??9; }
  function compareRows(a,b){ const ar=riskRank(a.risco),br=riskRank(b.risco); if(ar!==br) return ar-br; return n(b.vagas_ociosas)-n(a.vagas_ociosas); }
  function sortValue(row,field){
    if(["vagas_total","contratados","vagas_ociosas"].includes(field)) return n(row[field]);
    if(field==="risco") return riskRank(row.risco);
    if(field==="data_inicio"||field==="data_fim"){ const v=txt(row[field]); const t=v?Date.parse(v):NaN; return Number.isFinite(t)?t:0; }
    return txt(row[field]).toLocaleLowerCase("pt-BR");
  }
  function compareRowsForTable(a,b){
    if(!tableSort.field||!tableSort.direction) return compareRows(a,b);
    const av=sortValue(a,tableSort.field),bv=sortValue(b,tableSort.field);
    let result=0;
    if(typeof av==="number"&&typeof bv==="number") result=av-bv;
    else result=String(av).localeCompare(String(bv),"pt-BR",{numeric:true,sensitivity:"base"});
    if(result===0) result=compareRows(a,b);
    return tableSort.direction==="desc"?-result:result;
  }
  function sortDetails(field){
    if(tableSort.field!==field) tableSort={field,direction:"asc"};
    else if(tableSort.direction==="asc") tableSort={field,direction:"desc"};
    else tableSort={field:"",direction:""};
    applyFilters();
  }
  function renderSortIndicators(){
    document.querySelectorAll(".details-table th[data-sort-field]").forEach(th=>{
      const field=th.getAttribute("data-sort-field");
      th.classList.toggle("sorted-asc",tableSort.field===field&&tableSort.direction==="asc");
      th.classList.toggle("sorted-desc",tableSort.field===field&&tableSort.direction==="desc");
      const icon=th.querySelector(".sort-icon"); if(icon&&tableSort.field!==field) icon.textContent="↕";
    });
  }

  function sum(field){ return filtered.reduce((acc,r)=>acc+n(r[field]),0); }
  function renderAll(){ renderKpis(); renderMultiUnits(); renderStatusSummary(); renderChart(); renderMap(); renderRisks(); renderTable(); if(currentView==="nucleo") renderNucleo(); }
  function canUseMonitoramentoPayload(){
    return !!monitoramentoPayload && !hasActiveFilter() && !hideClosed;
  }

  function renderKpis(){
    const payloadKpis = canUseMonitoramentoPayload() ? monitoramentoPayload.kpis : null;
    const vagas   = payloadKpis ? n(payloadKpis.vagas_total) : sum("vagas_total");
    const contrat = payloadKpis ? n(payloadKpis.contratados) : sum("contratados");
    const ociosas = payloadKpis ? n(payloadKpis.vagas_ociosas) : sum("vagas_ociosas");
    const inscritos = payloadKpis ? n(payloadKpis.inscritos) : sum("inscritos");
    const processos = payloadKpis ? n(payloadKpis.processos_ativos) : filtered.length;
    const kProcessos = $("kProcessos");
    const kVagas = $("kVagas");
    const kContratados = $("kContratados");
    const kOciosas = $("kOciosas");
    const kCriticos = $("kCriticos");
    const kInscritos = $("kInscritos");

    if(kProcessos) kProcessos.textContent = fmt(processos);
    if(kVagas) kVagas.textContent = fmt(vagas);
    if(kContratados) kContratados.textContent = fmt(contrat);
    if(kOciosas) kOciosas.textContent = fmt(ociosas);
    if(kCriticos) kCriticos.textContent = fmt(filtered.filter(isRiscoAtivo).length);
    if(kInscritos) kInscritos.textContent = fmt(inscritos);

    // Taxa de preenchimento: o alvo correto é o card .kpi, não o <b>.
    // Na versão anterior a barra era injetada dentro do número do KPI,
    // quebrando a semântica visual e podendo deixar barras antigas.
    function setRate(valueElementId, pct, color){
      const valueEl = $(valueElementId);
      const card = valueEl?.closest(".kpi");
      if(!card) return;
      let bar = card.querySelector(".kpi-rate");
      if(!bar){
        bar = document.createElement("div");
        bar.className = "kpi-rate";
        bar.innerHTML = `<div class="kpi-rate-bar"><div class="kpi-rate-fill"></div></div><span class="kpi-rate-pct"></span>`;
        card.appendChild(bar);
      }
      const safePct = Math.max(0, Math.min(100, Number.isFinite(Number(pct)) ? Number(pct) : 0));
      const fill = bar.querySelector(".kpi-rate-fill");
      const label = bar.querySelector(".kpi-rate-pct");
      if(fill) fill.style.cssText = `width:${safePct}%;background:${color}`;
      if(label) label.textContent = `${safePct}% das vagas`;
    }
    function clearRate(valueElementId){
      const card = $(valueElementId)?.closest(".kpi");
      card?.querySelector(".kpi-rate")?.remove();
    }

    if(vagas){
      setRate("kContratados", Math.round((contrat/vagas)*100), "#0b8f58");
      setRate("kOciosas",     Math.round((ociosas/vagas)*100), "#d92d3a");
    }else{
      clearRate("kContratados");
      clearRate("kOciosas");
    }

    const criticalActive = isCriticalRiskFilterActive();
    const criticalCard = $("kpiCriticosCard");
    if(criticalCard) criticalCard.classList.toggle("active-filter", criticalActive);
    if($("panicChip")) $("panicChip").textContent = criticalActive ? "FILTRO ATIVO" : "MÉDIO/ALTO";
  }

  function group(field){ const out={}; filtered.forEach(r=>{ const k=txt(r[field])||"Não informado"; out[k]=(out[k]||0)+1; }); return Object.entries(out).sort((a,b)=>b[1]-a[1]); }
  function etapaChipClass(etapa){ const l=low(etapa); if(l.includes("conclu")) return "green"; if(l.includes("entrevista")) return "blue"; if(l.includes("análise")||l.includes("analise")) return "cyan"; if(l.includes("resultado")) return "yellow"; if(l.includes("cancel")) return "red"; return "gray"; }
  function renderStatusSummary(){
    const entries = group("etapa");
    const total = entries.reduce((s,[,v])=>s+v,0);
    if(!entries.length){ $("statusSummary").innerHTML=`<div class="alert">Sem dados.</div>`; return; }
    $("statusSummary").innerHTML = entries.map(([k,v])=>{
      const cls = etapaChipClass(k);
      const pct = total ? Math.round((v/total)*100) : 0;
      const barColor = cls==="green"?"#0b8f58":cls==="blue"?"#0d6efd":cls==="cyan"?"#00a8d6":cls==="yellow"?"#f2b705":cls==="red"?"#d92d3a":"#60758f";
      return `<div data-etapa-toggle="true" onclick="toggleSelectFilter('filterEtapa','${attr(k)}','Filtro de etapa')" title="Clique para filtrar" style="border-bottom:1px solid var(--line);padding:10px 0;cursor:pointer;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:6px;">
          <b style="font-size:13px;font-weight:700;color:#10243e">${esc(k)}</b>
          <div style="display:flex;align-items:center;gap:7px;flex-shrink:0;">
            <span style="font-size:12px;color:#60758f;font-weight:700">${pct}%</span>
            <span class="chip ${cls}">${fmt(v)}</span>
          </div>
        </div>
        <div style="height:5px;background:#e8f0f8;border-radius:99px;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:${barColor};border-radius:99px;transition:width .4s ease;"></div>
        </div>
      </div>`;
    }).join("");
  }

  function renderMultiUnits(){
    const card=$("multiUnitsCard"); if(!card) return;
    const counts={}; filtered.forEach(r=>{ const unidade=txt(r.unidade)||"Não informada"; counts[unidade]=(counts[unidade]||0)+1; });
    const units=Object.entries(counts).filter(([,count])=>count>1).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],"pt-BR")).slice(0,8);
    if(!units.length){ card.classList.add("hidden"); card.innerHTML=""; return; }
    card.classList.remove("hidden");
    card.innerHTML=`<div class="multi-units-title"><i class="fa-solid fa-layer-group"></i> Unidades com mais de um processo seletivo</div><div class="multi-units-list">${units.map(([unit,count])=>`<button type="button" class="multi-unit-chip" data-unit="${attr(unit)}" title="Filtrar por ${attr(unit)}">${esc(unit)} <span class="chip blue">${fmt(count)}</span></button>`).join("")}</div>`;
    card.querySelectorAll(".multi-unit-chip").forEach(btn=>btn.addEventListener("click",()=>toggleSelectFilter("filterUnidade",btn.dataset.unit,"Filtro de unidade")));
  }

  function renderChart(){
    const canvas=$("statusChart"); if(!canvas||!window.Chart) return;
    const entries=group("status"); const labels=entries.map(x=>x[0]); const values=entries.map(x=>x[1]);
    const colors=labels.map(label=>{ const l=low(label); if(l.includes("conclu")) return "#0ea76b"; if(l.includes("andamento")) return "#0d6efd"; if(l.includes("elabora")) return "#00b8d9"; if(l.includes("cancel")) return "#e4323b"; return "#7d8da5"; });
    // Atualiza in-place se o gráfico já existe (mais rápido, sem flash visual)
    if(statusChart){
      statusChart.data.labels = labels;
      statusChart.data.datasets[0].data = values;
      statusChart.data.datasets[0].backgroundColor = colors;
      statusChart.update();
      return;
    }
    statusChart=new Chart(canvas,{ type:"doughnut", data:{ labels, datasets:[{ data:values, backgroundColor:colors, borderWidth:0 }] }, options:{ responsive:true, maintainAspectRatio:false, cutout:"68%", plugins:{ legend:{ position:"top", labels:{ usePointStyle:true, boxWidth:10, font:{ weight:"bold" } } } }, onClick:(evt,items)=>{ if(!items.length) return; toggleSelectFilter("filterStatus",statusChart.data.labels[items[0].index],"Filtro de status"); } } });
  }

  // ── Mapa do Brasil (SVG coroplético autônomo, sem dependência de API externa) ──
  // ===== MAPA LEAFLET (fundo real OpenStreetMap) =====
  let LMAP = {"dsei":[],"casai":[]};
  const UF_GEO = {"type":"FeatureCollection","features":[{"type":"Feature","properties":{"uf":"AC"},"geometry":{"type":"Polygon","coordinates":[[[-73.8,-7.11],[-72.66,-7.62],[-70.58,-8.1],[-66.63,-9.93],[-67.05,-10.28],[-67.41,-10.38],[-67.71,-10.71],[-68.05,-10.67],[-68.26,-10.97],[-68.54,-11.11],[-68.71,-11.13],[-68.8,-10.99],[-69.42,-10.93],[-69.74,-10.97],[-69.94,-10.92],[-70.31,-11.07],[-70.52,-10.94],[-70.62,-11.0],[-70.62,-9.82],[-70.53,-9.71],[-70.6,-9.56],[-70.49,-9.43],[-71.23,-9.97],[-72.06,-10.0],[-72.18,-9.99],[-72.15,-9.8],[-72.27,-9.75],[-72.25,-9.61],[-72.37,-9.49],[-73.21,-9.41],[-72.95,-9.13],[-72.94,-8.99],[-73.13,-8.71],[-73.29,-8.62],[-73.28,-8.47],[-73.54,-8.35],[-73.63,-8.02],[-73.77,-7.9],[-73.69,-7.78],[-73.99,-7.55],[-73.92,-7.46],[-73.96,-7.35],[-73.7,-7.3],[-73.8,-7.11]]]}},{"type":"Feature","properties":{"uf":"AL"},"geometry":{"type":"Polygon","coordinates":[[[-35.47,-8.82],[-35.15,-8.92],[-35.3,-9.18],[-35.37,-9.27],[-36.27,-10.28],[-36.39,-10.5],[-36.46,-10.41],[-36.55,-10.42],[-36.63,-10.26],[-36.84,-10.2],[-36.99,-9.98],[-37.78,-9.64],[-38.2,-9.42],[-38.24,-9.33],[-37.98,-9.15],[-37.76,-8.86],[-37.7,-8.99],[-37.49,-8.96],[-37.23,-9.24],[-37.08,-9.25],[-36.95,-9.38],[-36.87,-9.27],[-36.6,-9.34],[-36.24,-9.17],[-36.27,-9.11],[-36.06,-8.91],[-35.47,-8.82]],[[-35.29,-9.15],[-35.29,-9.15],[-35.29,-9.15],[-35.29,-9.15]]]}},{"type":"Feature","properties":{"uf":"AM"},"geometry":{"type":"Polygon","coordinates":[[[-67.41,2.25],[-67.28,1.88],[-67.15,1.84],[-67.1,1.73],[-67.08,1.18],[-66.86,1.23],[-66.32,0.76],[-66.12,0.75],[-65.74,1.0],[-65.58,1.0],[-65.49,0.88],[-65.58,0.74],[-65.55,0.66],[-65.43,0.7],[-65.32,0.93],[-65.18,0.92],[-65.1,1.16],[-65.02,1.12],[-64.8,1.31],[-64.73,1.24],[-64.4,1.52],[-64.35,1.5],[-64.4,1.4],[-64.33,1.37],[-64.11,1.59],[-64.0,1.98],[-63.66,2.02],[-63.38,2.21],[-63.14,2.17],[-63.07,2.04],[-62.71,1.94],[-62.8,1.6],[-62.62,1.4],[-62.44,0.97],[-62.53,0.5],[-62.42,0.08],[-62.19,-0.33],[-62.31,-0.51],[-62.3,-0.65],[-62.39,-0.72],[-62.49,-0.68],[-62.5,-0.77],[-62.04,-1.12],[-61.9,-1.4],[-61.6,-1.45],[-61.48,-1.58],[-61.63,-1.3],[-61.55,-0.81],[-61.21,-0.5],[-60.92,-0.56],[-60.67,-0.89],[-60.31,-0.72],[-60.4,-0.51],[-60.04,0.26],[-59.19,0.26],[-58.9,-0.01],[-58.87,-0.34],[-58.73,-0.43],[-58.7,-0.68],[-58.44,-0.88],[-58.32,-1.14],[-58.16,-1.23],[-58.02,-1.11],[-57.95,-1.41],[-57.39,-1.72],[-57.16,-1.72],[-57.03,-1.91],[-56.73,-2.02],[-56.77,-2.14],[-56.7,-2.2],[-56.41,-2.18],[-56.1,-2.03],[-56.47,-2.42],[-56.43,-2.52],[-58.27,-6.47],[-58.47,-6.67],[-58.43,-6.91],[-58.2,-7.14],[-58.14,-7.36],[-58.2,-7.62],[-58.38,-7.85],[-58.29,-8.13],[-58.44,-8.7],[-58.33,-8.72],[-58.5,-8.8],[-61.58,-8.8],[-61.71,-8.69],[-61.98,-8.87],[-62.12,-8.8],[-62.19,-8.59],[-62.34,-8.6],[-62.36,-8.4],[-62.52,-8.38],[-62.84,-7.99],[-63.55,-7.97],[-63.78,-8.33],[-63.93,-8.32],[-63.92,-8.57],[-64.13,-8.72],[-64.14,-8.95],[-64.82,-8.99],[-64.92,-9.05],[-64.92,-9.23],[-65.09,-9.43],[-65.18,-9.43],[-65.25,-9.26],[-65.44,-9.31],[-65.43,-9.46],[-65.6,-9.41],[-65.79,-9.59],[-65.97,-9.41],[-66.41,-9.41],[-66.5,-9.63],[-66.81,-9.81],[-68.73,-9.0],[-70.58,-8.1],[-72.66,-7.62],[-73.8,-7.12],[-73.64,-6.75],[-73.14,-6.5],[-73.24,-6.03],[-72.96,-5.65],[-72.88,-5.17],[-72.81,-5.11],[-71.89,-4.52],[-71.63,-4.47],[-71.61,-4.53],[-71.27,-4.38],[-70.95,-4.38],[-70.81,-4.18],[-70.69,-4.2],[-70.65,-4.13],[-70.61,-4.19],[-70.33,-4.15],[-70.2,-4.36],[-70.11,-4.26],[-70.04,-4.35],[-69.96,-4.3],[-69.4,-1.13],[-69.62,-0.75],[-69.61,-0.51],[-70.05,-0.19],[-70.03,0.56],[-69.8,0.58],[-69.68,0.67],[-69.61,0.63],[-69.48,0.74],[-69.36,0.61],[-69.12,0.64],[-69.19,0.75],[-69.14,0.89],[-69.25,1.05],[-69.84,1.09],[-69.84,1.58],[-69.83,1.72],[-69.55,1.79],[-69.38,1.73],[-68.16,1.74],[-68.27,1.83],[-68.18,1.98],[-67.93,1.83],[-67.77,2.04],[-67.62,2.02],[-67.41,2.25]]]}},{"type":"Feature","properties":{"uf":"AP"},"geometry":{"type":"Polygon","coordinates":[[[-51.25,4.19],[-51.08,3.88],[-51.01,3.04],[-50.7,2.14],[-50.45,2.2],[-50.23,1.8],[-49.91,1.7],[-49.9,1.19],[-50.06,0.8],[-50.41,0.62],[-50.6,0.25],[-51.33,-0.27],[-51.68,-0.79],[-51.7,-1.07],[-51.89,-1.17],[-51.98,-1.12],[-52.05,-1.23],[-52.43,-1.05],[-52.4,-0.88],[-52.53,-0.84],[-52.53,-0.58],[-52.67,-0.54],[-52.68,-0.31],[-52.93,-0.14],[-53.09,0.2],[-53.17,0.38],[-53.1,0.68],[-53.41,0.95],[-53.43,1.24],[-53.54,1.21],[-53.55,1.35],[-53.65,1.34],[-53.65,1.41],[-53.85,1.39],[-54.09,1.49],[-54.15,1.64],[-54.3,1.74],[-54.75,1.79],[-54.81,2.06],[-54.76,2.2],[-54.88,2.43],[-54.69,2.44],[-54.66,2.33],[-54.44,2.21],[-54.19,2.18],[-53.76,2.38],[-53.75,2.31],[-53.53,2.26],[-53.34,2.35],[-53.23,2.27],[-53.28,2.22],[-53.27,2.17],[-52.95,2.17],[-52.55,2.52],[-52.33,3.17],[-51.97,3.72],[-51.65,4.04],[-51.54,4.43],[-51.25,4.19]]]}},{"type":"Feature","properties":{"uf":"BA"},"geometry":{"type":"Polygon","coordinates":[[[-39.29,-8.56],[-39.22,-8.71],[-38.8,-8.79],[-38.64,-8.99],[-38.51,-8.83],[-38.5,-8.98],[-38.29,-9.04],[-38.32,-9.14],[-38.2,-9.42],[-38.01,-9.48],[-38.0,-9.91],[-37.82,-10.02],[-37.74,-10.33],[-37.85,-10.41],[-37.81,-10.69],[-38.0,-10.76],[-38.21,-10.71],[-38.23,-10.91],[-37.98,-11.19],[-37.98,-11.39],[-37.8,-11.52],[-37.52,-11.55],[-37.34,-11.44],[-38.05,-12.63],[-38.35,-12.95],[-38.49,-13.01],[-38.61,-12.93],[-38.97,-13.28],[-38.89,-13.64],[-39.0,-13.74],[-38.93,-13.94],[-39.06,-14.71],[-38.86,-15.85],[-39.21,-17.17],[-39.13,-17.69],[-39.49,-18.0],[-39.66,-18.34],[-40.22,-17.98],[-40.22,-17.73],[-40.61,-17.42],[-40.49,-16.88],[-40.28,-16.9],[-40.26,-16.82],[-40.34,-16.79],[-40.29,-16.6],[-40.16,-16.58],[-39.86,-16.11],[-40.23,-15.8],[-40.56,-15.8],[-40.83,-15.65],[-41.13,-15.77],[-41.33,-15.74],[-41.36,-15.5],[-41.79,-15.11],[-42.09,-15.19],[-42.17,-15.09],[-42.44,-15.06],[-42.95,-14.71],[-43.19,-14.65],[-43.53,-14.81],[-43.88,-14.65],[-43.78,-14.34],[-44.22,-14.23],[-44.58,-14.35],[-45.09,-14.75],[-45.17,-14.73],[-45.45,-14.95],[-45.57,-14.94],[-45.72,-15.11],[-45.95,-15.14],[-46.09,-15.25],[-45.97,-14.99],[-46.05,-14.83],[-46.02,-14.42],[-45.91,-14.35],[-46.27,-14.1],[-46.21,-14.02],[-46.26,-13.69],[-46.16,-13.59],[-46.23,-13.56],[-46.24,-13.43],[-46.04,-13.27],[-46.28,-13.35],[-46.33,-13.25],[-46.27,-13.02],[-46.11,-12.92],[-46.3,-12.95],[-46.29,-12.63],[-46.16,-12.47],[-46.25,-12.49],[-46.35,-12.34],[-46.4,-12.03],[-46.17,-11.9],[-46.37,-11.87],[-46.31,-11.63],[-46.08,-11.64],[-46.48,-11.52],[-46.62,-11.29],[-46.28,-10.91],[-46.19,-10.63],[-45.83,-10.44],[-45.7,-10.27],[-45.72,-10.15],[-45.6,-10.11],[-45.4,-10.45],[-45.43,-10.63],[-45.25,-10.82],[-44.91,-10.91],[-44.58,-10.63],[-44.34,-10.55],[-44.13,-10.63],[-43.66,-10.0],[-43.65,-9.84],[-43.78,-9.76],[-43.85,-9.55],[-43.49,-9.27],[-43.28,-9.42],[-42.98,-9.4],[-42.95,-9.51],[-42.77,-9.62],[-42.23,-9.29],[-41.84,-9.24],[-41.72,-9.01],[-41.54,-8.96],[-41.38,-8.71],[-41.11,-8.7],[-41.03,-8.84],[-40.92,-8.84],[-40.81,-9.08],[-40.67,-9.16],[-40.77,-9.45],[-40.59,-9.47],[-40.34,-9.35],[-40.25,-9.06],[-39.96,-9.05],[-39.89,-8.83],[-39.67,-8.78],[-39.69,-8.66],[-39.41,-8.54],[-39.29,-8.56]],[[-39.58,-18.09],[-39.57,-18.08],[-39.58,-18.08],[-39.58,-18.09]]]}},{"type":"Feature","properties":{"uf":"CE"},"geometry":{"type":"MultiPolygon","coordinates":[[[[-40.02,-2.84],[-39.26,-3.22],[-38.65,-3.68],[-38.47,-3.71],[-38.01,-4.25],[-37.59,-4.62],[-37.33,-4.7],[-37.25,-4.83],[-37.64,-4.93],[-37.9,-5.5],[-38.08,-5.67],[-38.16,-5.95],[-38.29,-6.07],[-38.45,-6.08],[-38.58,-6.28],[-38.6,-6.39],[-38.52,-6.41],[-38.67,-6.7],[-38.62,-6.79],[-38.77,-6.99],[-38.67,-7.05],[-38.69,-7.19],[-38.53,-7.29],[-38.66,-7.57],[-38.97,-7.84],[-39.1,-7.85],[-39.15,-7.72],[-39.31,-7.67],[-39.32,-7.54],[-39.66,-7.31],[-40.15,-7.41],[-40.55,-7.39],[-40.37,-6.8],[-40.73,-6.65],[-40.91,-6.04],[-40.93,-5.17],[-41.24,-4.86],[-41.17,-4.67],[-41.24,-4.57],[-41.09,-4.17],[-41.12,-4.04],[-41.25,-4.04],[-41.22,-3.94],[-41.3,-3.83],[-41.24,-3.71],[-41.34,-3.68],[-41.37,-3.57],[-41.3,-3.49],[-41.42,-3.37],[-41.26,-3.08],[-41.32,-2.92],[-40.51,-2.79],[-40.02,-2.84]]],[[[-40.02,-2.83],[-40.03,-2.84],[-40.02,-2.83],[-40.02,-2.83]]]]}},{"type":"Feature","properties":{"uf":"ES"},"geometry":{"type":"MultiPolygon","coordinates":[[[[-40.72,-20.84],[-40.96,-21.3],[-41.72,-21.12],[-41.71,-20.87],[-41.88,-20.76],[-41.8,-20.48],[-41.85,-20.36],[-41.75,-20.21],[-41.38,-20.19],[-41.3,-19.94],[-41.18,-19.89],[-41.17,-19.67],[-40.95,-19.47],[-40.92,-19.26],[-41.06,-19.05],[-41.02,-18.98],[-41.24,-18.84],[-40.92,-18.8],[-40.94,-18.69],[-41.05,-18.63],[-41.02,-18.46],[-41.18,-18.44],[-41.16,-18.31],[-41.06,-18.17],[-40.77,-18.16],[-40.9,-17.98],[-40.67,-18.01],[-40.53,-17.89],[-40.22,-17.98],[-39.67,-18.33],[-39.75,-18.79],[-39.69,-19.31],[-39.81,-19.65],[-39.99,-19.75],[-40.14,-19.95],[-40.42,-20.64],[-40.46,-20.62],[-40.63,-20.84],[-40.65,-20.79],[-40.72,-20.84]],[[-40.52,-20.66],[-40.52,-20.67],[-40.51,-20.67],[-40.52,-20.66]],[[-40.54,-20.67],[-40.52,-20.69],[-40.53,-20.68],[-40.54,-20.67]]],[[[-40.48,-20.66],[-40.47,-20.65],[-40.47,-20.66],[-40.48,-20.66]]],[[[-40.72,-20.85],[-40.72,-20.84],[-40.72,-20.85],[-40.72,-20.85]]]]}},{"type":"Feature","properties":{"uf":"GO"},"geometry":{"type":"Polygon","coordinates":[[[-50.16,-12.41],[-50.3,-12.68],[-50.29,-12.84],[-49.37,-13.27],[-49.34,-13.07],[-49.12,-12.79],[-48.98,-12.96],[-48.85,-12.81],[-48.6,-13.06],[-48.58,-13.31],[-48.51,-13.13],[-48.44,-13.29],[-48.17,-13.15],[-48.16,-13.3],[-48.06,-13.24],[-47.8,-13.33],[-47.68,-13.46],[-47.63,-13.1],[-47.43,-13.29],[-46.82,-13.0],[-46.45,-12.96],[-46.42,-12.82],[-46.36,-12.99],[-46.12,-12.93],[-46.32,-13.1],[-46.27,-13.35],[-46.04,-13.28],[-46.24,-13.44],[-46.24,-13.55],[-46.16,-13.59],[-46.28,-13.8],[-46.21,-14.01],[-46.26,-14.1],[-45.91,-14.35],[-46.01,-14.41],[-46.06,-14.91],[-46.29,-14.93],[-46.32,-14.81],[-46.5,-14.71],[-46.56,-14.8],[-46.5,-15.05],[-46.92,-15.06],[-46.85,-15.37],[-46.95,-15.56],[-46.85,-15.62],[-46.82,-15.88],[-47.32,-16.04],[-47.38,-15.9],[-47.32,-15.59],[-47.42,-15.51],[-48.2,-15.5],[-48.27,-16.05],[-47.3,-16.06],[-47.45,-16.5],[-47.26,-16.66],[-47.13,-17.01],[-47.45,-17.35],[-47.51,-17.33],[-47.54,-17.45],[-47.27,-17.61],[-47.37,-17.84],[-47.28,-18.06],[-47.95,-18.5],[-48.26,-18.33],[-48.82,-18.38],[-48.92,-18.3],[-49.2,-18.41],[-49.38,-18.64],[-49.53,-18.49],[-49.79,-18.64],[-50.02,-18.6],[-50.31,-18.7],[-50.51,-18.94],[-50.54,-19.1],[-50.82,-19.29],[-50.84,-19.5],[-51.09,-19.31],[-52.32,-18.83],[-52.45,-18.69],[-52.91,-18.64],[-52.96,-18.55],[-52.76,-18.35],[-53.1,-18.31],[-53.14,-18.08],[-53.08,-17.97],[-53.24,-17.71],[-53.24,-17.5],[-53.01,-16.86],[-52.78,-16.74],[-52.74,-16.59],[-52.63,-16.53],[-52.68,-16.3],[-52.35,-16.08],[-52.25,-15.89],[-51.88,-15.83],[-51.7,-15.5],[-51.65,-15.18],[-51.53,-15.07],[-51.34,-14.97],[-51.27,-15.04],[-51.08,-14.91],[-50.96,-14.25],[-50.83,-14.07],[-50.87,-13.73],[-50.61,-13.31],[-50.61,-13.06],[-50.48,-12.71],[-50.16,-12.41]]]}},{"type":"Feature","properties":{"uf":"MA"},"geometry":{"type":"MultiPolygon","coordinates":[[[[-47.07,-9.06],[-46.9,-8.81],[-46.85,-8.48],[-46.78,-8.37],[-46.55,-8.32],[-46.47,-8.08],[-46.63,-7.9],[-47.04,-8.05],[-47.5,-7.44],[-47.59,-7.44],[-47.48,-7.32],[-47.65,-7.3],[-47.75,-7.19],[-47.53,-6.98],[-47.38,-6.25],[-47.5,-5.53],[-47.84,-5.38],[-47.88,-5.26],[-48.18,-5.26],[-48.36,-5.17],[-48.74,-5.35],[-47.79,-4.58],[-47.62,-4.57],[-47.37,-4.24],[-47.33,-4.06],[-47.09,-3.86],[-47.04,-3.56],[-46.68,-3.09],[-46.68,-2.88],[-46.58,-2.84],[-46.66,-2.69],[-46.41,-2.52],[-46.43,-2.25],[-46.28,-2.15],[-46.21,-1.83],[-46.32,-1.76],[-46.15,-1.68],[-46.11,-1.33],[-46.16,-1.28],[-46.02,-1.07],[-45.97,-1.05],[-45.96,-1.23],[-45.84,-1.05],[-45.91,-1.18],[-45.86,-1.15],[-45.86,-1.28],[-45.81,-1.17],[-45.8,-1.22],[-45.84,-1.28],[-45.78,-1.27],[-45.69,-1.13],[-45.75,-1.24],[-45.72,-1.4],[-45.64,-1.37],[-45.59,-1.26],[-45.59,-1.31],[-45.53,-1.27],[-45.55,-1.29],[-45.56,-1.33],[-45.55,-1.35],[-45.5,-1.29],[-45.52,-1.36],[-45.53,-1.4],[-45.52,-1.41],[-45.41,-1.29],[-45.48,-1.54],[-45.32,-1.32],[-45.29,-1.37],[-45.3,-1.43],[-45.39,-1.48],[-45.38,-1.55],[-45.3,-1.49],[-45.35,-1.74],[-45.31,-1.6],[-45.25,-1.62],[-45.15,-1.47],[-45.13,-1.53],[-45.13,-1.46],[-45.1,-1.42],[-45.1,-1.36],[-45.1,-1.38],[-45.1,-1.49],[-45.09,-1.51],[-45.1,-1.48],[-45.08,-1.49],[-45.07,-1.47],[-45.07,-1.45],[-44.94,-1.52],[-44.82,-1.42],[-44.9,-1.61],[-44.82,-1.58],[-44.79,-1.61],[-44.78,-1.65],[-44.7,-1.56],[-44.72,-1.61],[-44.65,-1.62],[-44.79,-1.68],[-44.79,-1.74],[-44.7,-1.73],[-44.8,-1.81],[-44.66,-1.74],[-44.66,-1.8],[-44.65,-1.72],[-44.59,-1.75],[-44.63,-1.79],[-44.63,-1.83],[-44.6,-1.85],[-44.64,-1.86],[-44.59,-1.85],[-44.57,-1.8],[-44.58,-1.86],[-44.53,-1.84],[-44.59,-1.9],[-44.49,-1.93],[-44.49,-2.14],[-44.36,-2.33],[-44.41,-2.41],[-44.31,-2.5],[-44.02,-2.4],[-44.1,-2.46],[-43.97,-2.47],[-43.98,-2.57],[-43.62,-2.22],[-43.5,-2.37],[-43.17,-2.38],[-42.48,-2.71],[-41.82,-2.72],[-41.87,-2.88],[-41.8,-2.97],[-41.94,-3.19],[-42.12,-3.26],[-42.2,-3.44],[-42.5,-3.45],[-42.67,-3.67],[-42.73,-3.91],[-42.98,-4.22],[-42.96,-4.38],[-42.85,-4.48],[-42.95,-4.77],[-42.8,-5.18],[-42.83,-5.35],[-43.1,-5.63],[-43.08,-6.04],[-42.83,-6.34],[-42.95,-6.71],[-43.42,-6.84],[-43.71,-6.7],[-44.03,-6.76],[-44.31,-7.12],[-44.56,-7.23],[-44.7,-7.39],[-44.82,-7.36],[-44.93,-7.47],[-45.46,-7.67],[-45.78,-8.62],[-45.99,-8.93],[-45.79,-9.48],[-45.95,-10.26],[-46.04,-10.18],[-46.37,-10.17],[-46.51,-9.8],[-46.65,-9.73],[-46.56,-9.49],[-46.67,-9.39],[-46.76,-9.41],[-46.92,-9.07],[-47.07,-9.06]],[[-44.81,-1.8],[-44.81,-1.8],[-44.81,-1.8],[-44.81,-1.8]],[[-44.57,-1.92],[-44.57,-1.92],[-44.57,-1.92],[-44.57,-1.92]],[[-45.75,-1.37],[-45.74,-1.37],[-45.75,-1.37],[-45.75,-1.37]],[[-45.89,-1.18],[-45.88,-1.18],[-45.89,-1.18],[-45.89,-1.18]],[[-45.82,-1.31],[-45.82,-1.3],[-45.82,-1.3],[-45.82,-1.31]],[[-44.69,-1.82],[-44.69,-1.81],[-44.69,-1.82],[-44.69,-1.82]],[[-45.39,-1.69],[-45.39,-1.69],[-45.39,-1.69],[-45.39,-1.69]],[[-44.8,-1.63],[-44.79,-1.62],[-44.8,-1.63],[-44.8,-1.63]],[[-45.13,-1.54],[-45.11,-1.54],[-45.13,-1.54],[-45.13,-1.54]],[[-45.82,-1.25],[-45.82,-1.24],[-45.82,-1.25],[-45.82,-1.25]],[[-45.58,-1.34],[-45.57,-1.33],[-45.58,-1.34],[-45.58,-1.34]],[[-45.8,-1.33],[-45.8,-1.34],[-45.8,-1.32],[-45.8,-1.33]],[[-44.83,-1.82],[-44.82,-1.82],[-44.83,-1.82],[-44.83,-1.82]],[[-45.37,-1.44],[-45.36,-1.43],[-45.37,-1.43],[-45.37,-1.44]],[[-45.9,-1.24],[-45.91,-1.25],[-45.9,-1.26],[-45.9,-1.24]],[[-45.59,-1.34],[-45.59,-1.32],[-45.59,-1.32],[-45.59,-1.34]],[[-45.39,-1.56],[-45.38,-1.54],[-45.39,-1.54],[-45.39,-1.56]]],[[[-45.02,-1.33],[-44.96,-1.28],[-44.84,-1.33],[-44.9,-1.33],[-44.98,-1.41],[-45.02,-1.33]],[[-44.92,-1.34],[-44.92,-1.34],[-44.92,-1.34],[-44.92,-1.34]],[[-44.9,-1.31],[-44.9,-1.31],[-44.92,-1.3],[-44.9,-1.31]]],[[[-45.68,-1.3],[-45.64,-1.29],[-45.62,-1.12],[-45.6,-1.18],[-45.63,-1.22],[-45.62,-1.24],[-45.64,-1.3],[-45.64,-1.33],[-45.63,-1.34],[-45.63,-1.35],[-45.7,-1.36],[-45.68,-1.35],[-45.68,-1.32],[-45.67,-1.32],[-45.68,-1.3]],[[-45.66,-1.3],[-45.66,-1.31],[-45.65,-1.31],[-45.66,-1.3]]],[[[-44.8,-1.53],[-44.8,-1.56],[-44.83,-1.54],[-44.76,-1.48],[-44.8,-1.53]]],[[[-44.74,-1.51],[-44.76,-1.49],[-44.76,-1.48],[-44.77,-1.46],[-44.75,-1.46],[-44.74,-1.51]]],[[[-45.7,-1.22],[-45.66,-1.22],[-45.68,-1.26],[-45.7,-1.22]]],[[[-45.57,-1.19],[-45.53,-1.23],[-45.59,-1.25],[-45.57,-1.19]]],[[[-44.6,-1.82],[-44.59,-1.77],[-44.58,-1.78],[-44.6,-1.82]]],[[[-44.73,-1.56],[-44.76,-1.58],[-44.74,-1.54],[-44.73,-1.56]]],[[[-45.82,-1.12],[-45.8,-1.15],[-45.82,-1.15],[-45.82,-1.12]]],[[[-45.8,-1.21],[-45.78,-1.21],[-45.79,-1.22],[-45.8,-1.21]]],[[[-45.53,-1.32],[-45.55,-1.31],[-45.53,-1.3],[-45.53,-1.32]]],[[[-45.07,-1.39],[-45.09,-1.43],[-45.07,-1.37],[-45.07,-1.39]]],[[[-45.1,-1.47],[-45.07,-1.46],[-45.07,-1.48],[-45.1,-1.47]]],[[[-45.04,-1.35],[-45.05,-1.36],[-45.05,-1.34],[-45.04,-1.35]]],[[[-44.75,-1.69],[-44.73,-1.69],[-44.74,-1.7],[-44.75,-1.69]]],[[[-45.69,-1.3],[-45.68,-1.31],[-45.69,-1.29],[-45.69,-1.3]]],[[[-44.47,-2.08],[-44.48,-2.08],[-44.45,-2.07],[-44.47,-2.08]]],[[[-44.48,-2.11],[-44.46,-2.1],[-44.47,-2.12],[-44.48,-2.11]]],[[[-45.41,-1.41],[-45.4,-1.41],[-45.41,-1.41],[-45.41,-1.41]]],[[[-45.06,-1.44],[-45.08,-1.44],[-45.06,-1.43],[-45.06,-1.44]]],[[[-44.72,-1.66],[-44.72,-1.68],[-44.74,-1.67],[-44.72,-1.66]]],[[[-44.45,-2.02],[-44.45,-2.02],[-44.44,-2.01],[-44.45,-2.02]]],[[[-44.62,-1.8],[-44.62,-1.81],[-44.63,-1.79],[-44.62,-1.8]]],[[[-45.09,-1.43],[-45.08,-1.42],[-45.08,-1.44],[-45.09,-1.43]]],[[[-45.51,-1.4],[-45.52,-1.4],[-45.51,-1.39],[-45.51,-1.4]]],[[[-45.05,-1.33],[-45.04,-1.34],[-45.05,-1.33],[-45.05,-1.33]]],[[[-45.79,-1.25],[-45.8,-1.24],[-45.79,-1.24],[-45.79,-1.25]]],[[[-45.0,-1.4],[-45.0,-1.41],[-45.02,-1.4],[-45.0,-1.4]]],[[[-44.61,-1.83],[-44.61,-1.82],[-44.6,-1.83],[-44.61,-1.83]]],[[[-45.63,-1.32],[-45.62,-1.32],[-45.63,-1.34],[-45.63,-1.32]]],[[[-44.83,-1.56],[-44.82,-1.56],[-44.82,-1.57],[-44.83,-1.56]]],[[[-45.56,-1.26],[-45.56,-1.26],[-45.57,-1.27],[-45.56,-1.26]]],[[[-42.76,-2.55],[-42.75,-2.55],[-42.76,-2.56],[-42.76,-2.55]]],[[[-44.01,-2.4],[-44.0,-2.39],[-44.0,-2.4],[-44.01,-2.4]]],[[[-44.61,-1.78],[-44.62,-1.78],[-44.61,-1.77],[-44.61,-1.78]]],[[[-45.64,-1.31],[-45.64,-1.3],[-45.64,-1.32],[-45.64,-1.31]]],[[[-45.65,-1.36],[-45.64,-1.36],[-45.65,-1.36],[-45.65,-1.36]]],[[[-45.64,-1.25],[-45.65,-1.25],[-45.64,-1.25],[-45.64,-1.25]]],[[[-44.02,-2.4],[-44.01,-2.4],[-44.02,-2.41],[-44.02,-2.4]]],[[[-45.14,-1.47],[-45.13,-1.47],[-45.14,-1.48],[-45.14,-1.47]]],[[[-44.78,-1.57],[-44.78,-1.57],[-44.78,-1.57],[-44.78,-1.57]]],[[[-44.88,-1.34],[-44.88,-1.34],[-44.88,-1.34],[-44.88,-1.34]]],[[[-45.04,-1.39],[-45.04,-1.4],[-45.04,-1.39],[-45.04,-1.39]]],[[[-45.14,-1.49],[-45.13,-1.49],[-45.14,-1.49],[-45.14,-1.49]]],[[[-44.46,-2.13],[-44.45,-2.13],[-44.46,-2.13],[-44.46,-2.13]]],[[[-45.82,-1.26],[-45.81,-1.26],[-45.82,-1.26],[-45.82,-1.26]]],[[[-47.03,-8.98],[-47.03,-8.98],[-47.03,-8.98],[-47.03,-8.98]]],[[[-45.11,-1.4],[-45.11,-1.41],[-45.11,-1.4],[-45.11,-1.4]]],[[[-45.11,-1.39],[-45.11,-1.4],[-45.11,-1.39],[-45.11,-1.39]]],[[[-45.56,-1.26],[-45.55,-1.26],[-45.56,-1.26],[-45.56,-1.26]]],[[[-44.76,-1.59],[-44.75,-1.59],[-44.76,-1.59],[-44.76,-1.59]]],[[[-45.76,-1.19],[-45.76,-1.19],[-45.76,-1.19],[-45.76,-1.19]]]]}},{"type":"Feature","properties":{"uf":"MG"},"geometry":{"type":"Polygon","coordinates":[[[-44.21,-14.24],[-43.78,-14.34],[-43.88,-14.65],[-43.53,-14.81],[-43.19,-14.65],[-42.95,-14.71],[-42.44,-15.06],[-42.17,-15.09],[-42.09,-15.19],[-41.81,-15.1],[-41.36,-15.5],[-41.33,-15.74],[-40.7,-15.67],[-40.56,-15.8],[-40.23,-15.8],[-39.86,-16.11],[-40.16,-16.58],[-40.29,-16.6],[-40.34,-16.79],[-40.26,-16.82],[-40.28,-16.9],[-40.49,-16.88],[-40.57,-17.06],[-40.61,-17.42],[-40.22,-17.73],[-40.22,-17.98],[-40.53,-17.89],[-40.67,-18.01],[-40.83,-17.95],[-40.9,-17.99],[-40.77,-18.16],[-41.06,-18.17],[-41.16,-18.31],[-41.18,-18.44],[-41.02,-18.46],[-41.05,-18.63],[-40.94,-18.69],[-40.92,-18.8],[-41.24,-18.84],[-41.02,-18.98],[-41.06,-19.05],[-40.92,-19.26],[-40.95,-19.47],[-41.17,-19.67],[-41.18,-19.89],[-41.3,-19.94],[-41.38,-20.19],[-41.75,-20.21],[-41.85,-20.33],[-41.81,-20.64],[-41.98,-20.93],[-42.15,-20.97],[-42.08,-21.03],[-42.37,-21.62],[-42.27,-21.71],[-43.07,-22.09],[-43.25,-22.01],[-43.77,-22.06],[-44.23,-22.27],[-44.46,-22.26],[-45.09,-22.48],[-45.4,-22.65],[-45.47,-22.59],[-45.66,-22.65],[-45.72,-22.58],[-45.69,-22.65],[-45.81,-22.71],[-45.71,-22.76],[-45.77,-22.85],[-46.35,-22.9],[-46.33,-22.77],[-46.48,-22.68],[-46.39,-22.66],[-46.41,-22.54],[-46.65,-22.42],[-46.72,-22.31],[-46.6,-22.14],[-46.72,-22.08],[-46.61,-22.01],[-46.68,-21.82],[-46.52,-21.61],[-46.51,-21.48],[-46.66,-21.36],[-47.01,-21.42],[-47.22,-20.91],[-47.1,-20.66],[-47.15,-20.52],[-47.29,-20.45],[-47.26,-20.16],[-47.47,-19.96],[-47.64,-20.05],[-47.86,-19.99],[-47.89,-20.12],[-47.98,-20.04],[-48.11,-20.14],[-48.24,-20.03],[-48.25,-20.14],[-48.82,-20.16],[-48.9,-20.44],[-48.97,-20.39],[-48.99,-20.17],[-49.07,-20.15],[-49.22,-20.3],[-49.31,-20.1],[-49.25,-19.97],[-49.55,-19.91],[-49.88,-19.94],[-50.49,-19.79],[-51.0,-20.09],[-51.05,-19.73],[-50.93,-19.59],[-50.96,-19.48],[-50.83,-19.49],[-50.82,-19.29],[-50.54,-19.1],[-50.51,-18.94],[-50.31,-18.7],[-50.02,-18.6],[-49.79,-18.64],[-49.53,-18.49],[-49.38,-18.64],[-49.2,-18.41],[-48.92,-18.3],[-48.82,-18.38],[-48.26,-18.33],[-47.95,-18.5],[-47.28,-18.06],[-47.37,-17.84],[-47.27,-17.61],[-47.32,-17.53],[-47.49,-17.53],[-47.54,-17.39],[-47.13,-16.98],[-47.26,-16.66],[-47.45,-16.47],[-47.3,-16.02],[-46.81,-15.87],[-46.85,-15.62],[-46.95,-15.56],[-46.85,-15.37],[-46.92,-15.06],[-46.5,-15.05],[-46.56,-14.8],[-46.47,-14.71],[-46.29,-14.93],[-46.02,-14.88],[-45.97,-14.96],[-46.12,-15.2],[-46.08,-15.26],[-45.2,-14.74],[-45.08,-14.75],[-44.56,-14.34],[-44.21,-14.24]]]}},{"type":"Feature","properties":{"uf":"MS"},"geometry":{"type":"MultiPolygon","coordinates":[[[[-53.95,-17.92],[-53.69,-18.01],[-53.08,-18.04],[-53.14,-18.07],[-53.07,-18.34],[-52.76,-18.35],[-52.96,-18.54],[-52.92,-18.64],[-52.53,-18.66],[-52.02,-18.98],[-51.05,-19.34],[-50.92,-19.58],[-51.05,-19.74],[-51.0,-20.1],[-51.07,-20.25],[-51.32,-20.34],[-51.59,-20.64],[-51.62,-20.93],[-51.88,-21.15],[-51.86,-21.34],[-51.97,-21.5],[-52.08,-21.52],[-52.05,-21.66],[-52.41,-22.14],[-53.61,-22.95],[-53.73,-23.32],[-53.98,-23.46],[-54.11,-23.96],[-54.29,-24.06],[-54.67,-23.81],[-54.94,-23.96],[-55.35,-23.99],[-55.53,-23.63],[-55.53,-23.19],[-55.66,-22.88],[-55.61,-22.66],[-55.85,-22.28],[-56.21,-22.27],[-56.39,-22.08],[-56.5,-22.09],[-56.63,-22.26],[-56.7,-22.22],[-56.84,-22.3],[-57.58,-22.17],[-57.61,-22.09],[-57.8,-22.15],[-57.99,-22.09],[-57.88,-21.69],[-57.97,-21.52],[-57.85,-21.34],[-57.92,-21.28],[-57.85,-21.22],[-57.82,-20.94],[-57.93,-20.89],[-57.86,-20.83],[-57.95,-20.78],[-57.86,-20.75],[-57.92,-20.66],[-57.98,-20.7],[-58.0,-20.43],[-58.17,-20.17],[-57.86,-19.98],[-58.13,-19.76],[-57.78,-19.03],[-57.7,-19.02],[-57.56,-18.24],[-57.46,-18.23],[-57.72,-17.83],[-57.8,-17.56],[-57.71,-17.54],[-57.68,-17.71],[-57.45,-17.9],[-57.04,-17.73],[-56.73,-17.31],[-56.44,-17.33],[-56.11,-17.17],[-55.64,-17.34],[-55.52,-17.48],[-55.13,-17.65],[-54.86,-17.62],[-54.58,-17.47],[-54.3,-17.66],[-54.08,-17.62],[-54.03,-17.48],[-53.71,-17.23],[-53.72,-17.67],[-53.88,-17.74],[-53.95,-17.92]]],[[[-53.87,-17.92],[-53.88,-17.92],[-53.87,-17.92],[-53.87,-17.92]]]]}},{"type":"Feature","properties":{"uf":"MT"},"geometry":{"type":"MultiPolygon","coordinates":[[[[-60.39,-13.45],[-60.28,-13.09],[-60.09,-12.9],[-60.06,-12.6],[-59.85,-12.47],[-59.79,-12.35],[-59.89,-12.24],[-59.98,-11.91],[-60.1,-11.84],[-60.11,-11.58],[-59.92,-11.4],[-59.98,-11.12],[-60.35,-11.11],[-60.46,-10.99],[-61.55,-10.98],[-61.46,-10.42],[-61.6,-10.15],[-61.51,-9.89],[-61.57,-9.73],[-61.48,-9.64],[-61.63,-9.28],[-61.53,-9.25],[-61.48,-8.91],[-61.58,-8.8],[-58.41,-8.79],[-58.33,-8.72],[-58.44,-8.7],[-58.29,-8.13],[-58.38,-7.85],[-58.2,-7.62],[-58.14,-7.35],[-57.97,-7.53],[-57.83,-7.97],[-57.64,-8.22],[-57.69,-8.41],[-57.59,-8.76],[-57.2,-8.92],[-57.06,-9.06],[-57.06,-9.18],[-56.82,-9.25],[-56.76,-9.4],[-50.23,-9.84],[-50.6,-10.66],[-50.61,-11.07],[-50.74,-11.45],[-50.64,-11.89],[-50.69,-12.2],[-50.62,-12.45],[-50.71,-12.61],[-50.62,-12.82],[-50.5,-12.87],[-50.61,-13.06],[-50.61,-13.31],[-50.87,-13.73],[-50.83,-14.07],[-50.96,-14.25],[-51.08,-14.91],[-51.27,-15.04],[-51.34,-14.97],[-51.53,-15.07],[-51.65,-15.18],[-51.7,-15.5],[-51.88,-15.83],[-52.25,-15.89],[-52.35,-16.08],[-52.68,-16.3],[-52.63,-16.55],[-52.74,-16.59],[-52.78,-16.74],[-53.01,-16.86],[-53.22,-17.3],[-53.24,-17.67],[-53.07,-18.04],[-53.77,-18.0],[-53.95,-17.92],[-53.84,-17.69],[-53.72,-17.67],[-53.71,-17.23],[-54.03,-17.48],[-54.08,-17.62],[-54.34,-17.66],[-54.58,-17.47],[-54.86,-17.62],[-55.13,-17.65],[-55.52,-17.48],[-55.64,-17.34],[-56.11,-17.17],[-56.44,-17.33],[-56.73,-17.31],[-57.04,-17.73],[-57.45,-17.9],[-57.68,-17.71],[-57.71,-17.54],[-57.88,-17.45],[-58.04,-17.49],[-58.4,-17.18],[-58.47,-16.75],[-58.33,-16.49],[-58.33,-16.27],[-58.43,-16.32],[-60.17,-16.27],[-60.24,-15.47],[-60.56,-15.12],[-60.27,-14.62],[-60.49,-14.19],[-60.38,-13.99],[-60.47,-13.8],[-60.72,-13.68],[-60.39,-13.45]]],[[[-60.36,-13.3],[-60.36,-13.3],[-60.36,-13.3],[-60.36,-13.3]]]]}},{"type":"Feature","properties":{"uf":"PA"},"geometry":{"type":"MultiPolygon","coordinates":[[[[-46.95,-0.73],[-46.98,-0.78],[-46.95,-0.86],[-46.84,-0.73],[-46.85,-0.85],[-46.79,-0.9],[-46.77,-0.82],[-46.74,-0.92],[-46.72,-0.83],[-46.64,-0.79],[-46.67,-0.98],[-46.55,-0.9],[-46.54,-0.98],[-46.43,-0.86],[-46.49,-0.97],[-46.42,-1.06],[-46.39,-0.99],[-46.38,-1.05],[-46.34,-1.0],[-46.35,-1.07],[-46.3,-1.08],[-46.33,-1.07],[-46.27,-1.0],[-46.27,-0.92],[-46.19,-0.89],[-46.25,-1.0],[-46.21,-1.04],[-46.28,-1.17],[-46.17,-0.99],[-46.2,-1.13],[-46.17,-1.16],[-46.16,-1.08],[-46.15,-1.14],[-46.15,-1.07],[-46.07,-1.02],[-46.09,-1.05],[-46.1,-1.2],[-46.16,-1.28],[-46.11,-1.33],[-46.15,-1.68],[-46.32,-1.76],[-46.21,-1.83],[-46.28,-2.15],[-46.43,-2.25],[-46.41,-2.52],[-46.66,-2.69],[-46.58,-2.84],[-46.68,-2.88],[-46.68,-3.09],[-46.94,-3.37],[-47.08,-3.84],[-47.33,-4.06],[-47.37,-4.24],[-47.62,-4.57],[-47.79,-4.58],[-48.75,-5.36],[-48.38,-5.39],[-48.13,-5.64],[-48.29,-5.76],[-48.23,-5.93],[-48.34,-6.02],[-48.3,-6.11],[-48.43,-6.18],[-48.38,-6.38],[-48.5,-6.35],[-48.63,-6.48],[-48.66,-6.66],[-49.21,-6.93],[-49.19,-7.24],[-49.38,-7.54],[-49.15,-7.81],[-49.22,-8.19],[-49.57,-8.81],[-49.74,-8.9],[-50.04,-9.3],[-50.22,-9.84],[-56.75,-9.41],[-56.81,-9.26],[-57.05,-9.19],[-57.04,-9.1],[-57.19,-8.93],[-57.6,-8.75],[-57.69,-8.41],[-57.64,-8.21],[-58.21,-7.13],[-58.41,-6.94],[-58.48,-6.7],[-58.26,-6.47],[-56.4,-2.46],[-56.46,-2.43],[-56.41,-2.32],[-56.1,-2.03],[-56.68,-2.21],[-56.77,-2.17],[-56.73,-2.03],[-57.04,-1.91],[-57.16,-1.73],[-57.4,-1.71],[-57.96,-1.4],[-58.03,-1.1],[-58.16,-1.23],[-58.43,-1.03],[-58.43,-0.89],[-58.7,-0.67],[-58.73,-0.44],[-58.87,-0.3],[-58.9,1.23],[-58.82,1.17],[-58.7,1.29],[-58.5,1.27],[-58.51,1.46],[-58.38,1.47],[-58.32,1.6],[-58.0,1.5],[-57.99,1.66],[-57.77,1.73],[-57.54,1.7],[-57.31,2.0],[-57.23,1.94],[-57.09,2.03],[-57.01,1.92],[-56.79,1.85],[-56.45,1.96],[-55.98,1.84],[-55.9,2.03],[-56.14,2.27],[-56.09,2.38],[-56.02,2.34],[-55.99,2.52],[-55.71,2.4],[-55.34,2.45],[-55.32,2.52],[-55.0,2.59],[-54.79,2.31],[-54.75,1.79],[-54.3,1.74],[-54.15,1.64],[-54.09,1.49],[-53.85,1.39],[-53.65,1.41],[-53.65,1.34],[-53.55,1.35],[-53.54,1.21],[-53.43,1.24],[-53.41,0.95],[-53.1,0.68],[-53.17,0.38],[-52.93,-0.14],[-52.68,-0.31],[-52.63,-0.59],[-52.53,-0.58],[-52.53,-0.84],[-52.4,-0.88],[-52.43,-1.05],[-52.12,-1.15],[-52.1,-1.23],[-51.98,-1.12],[-51.89,-1.17],[-51.7,-1.07],[-51.68,-0.79],[-51.27,-0.2],[-50.6,0.25],[-50.41,0.62],[-50.16,0.7],[-50.04,0.57],[-50.02,0.33],[-49.65,0.35],[-49.39,0.01],[-48.91,-0.23],[-48.41,-0.26],[-48.47,-0.5],[-47.99,-0.71],[-47.9,-0.55],[-47.84,-0.68],[-47.8,-0.55],[-47.77,-0.63],[-47.72,-0.54],[-47.63,-0.69],[-47.56,-0.59],[-47.49,-0.77],[-47.42,-0.59],[-47.43,-0.65],[-47.32,-0.59],[-47.22,-0.64],[-47.25,-0.7],[-47.16,-0.67],[-47.18,-0.75],[-47.17,-0.77],[-47.09,-0.66],[-47.06,-0.81],[-47.04,-0.73],[-46.95,-0.73]]],[[[-46.41,-0.93],[-46.41,-0.97],[-46.44,-0.98],[-46.41,-0.93]]],[[[-46.09,-1.06],[-46.06,-1.09],[-46.07,-1.1],[-46.09,-1.06]]],[[[-47.03,-0.71],[-47.03,-0.69],[-47.01,-0.7],[-47.03,-0.71]]],[[[-46.38,-1.0],[-46.38,-1.01],[-46.38,-1.01],[-46.38,-1.0]]],[[[-47.84,-0.66],[-47.83,-0.65],[-47.84,-0.67],[-47.84,-0.66]]],[[[-46.44,-1.01],[-46.45,-1.01],[-46.44,-1.0],[-46.44,-1.01]]],[[[-46.33,-0.95],[-46.32,-0.95],[-46.32,-0.95],[-46.33,-0.95]]],[[[-46.61,-0.83],[-46.6,-0.83],[-46.6,-0.83],[-46.61,-0.83]]],[[[-46.61,-0.86],[-46.6,-0.85],[-46.61,-0.86],[-46.61,-0.86]]],[[[-47.03,-0.72],[-47.04,-0.72],[-47.04,-0.72],[-47.03,-0.72]]],[[[-46.47,-0.96],[-46.47,-0.96],[-46.47,-0.96],[-46.47,-0.96]]],[[[-46.21,-0.94],[-46.2,-0.94],[-46.21,-0.94],[-46.21,-0.94]]],[[[-46.95,-0.74],[-46.95,-0.74],[-46.95,-0.74],[-46.95,-0.74]]],[[[-47.02,-0.71],[-47.02,-0.72],[-47.02,-0.71],[-47.02,-0.71]]],[[[-46.27,-0.93],[-46.27,-0.94],[-46.27,-0.93],[-46.27,-0.93]]]]}},{"type":"Feature","properties":{"uf":"PB"},"geometry":{"type":"MultiPolygon","coordinates":[[[[-37.23,-6.04],[-37.16,-6.15],[-37.38,-6.34],[-37.48,-6.71],[-37.28,-6.69],[-37.23,-6.82],[-36.99,-6.71],[-36.96,-6.79],[-36.79,-6.77],[-36.72,-6.98],[-36.51,-6.82],[-36.52,-6.6],[-36.44,-6.63],[-36.53,-6.45],[-36.39,-6.29],[-36.31,-6.28],[-36.25,-6.44],[-36.07,-6.41],[-36.01,-6.48],[-35.66,-6.45],[-35.17,-6.56],[-34.97,-6.49],[-34.94,-6.75],[-34.86,-7.03],[-34.83,-6.98],[-34.79,-7.15],[-34.83,-7.55],[-34.95,-7.54],[-35.08,-7.4],[-35.48,-7.45],[-35.51,-7.64],[-36.0,-7.81],[-36.41,-7.81],[-36.45,-7.92],[-36.62,-7.96],[-36.64,-8.12],[-36.99,-8.3],[-37.16,-8.17],[-37.19,-7.96],[-37.35,-7.97],[-37.15,-7.78],[-37.17,-7.59],[-36.98,-7.48],[-37.23,-7.28],[-37.47,-7.36],[-37.75,-7.66],[-37.86,-7.65],[-38.07,-7.82],[-38.28,-7.83],[-38.36,-7.68],[-38.59,-7.75],[-38.72,-7.61],[-38.53,-7.29],[-38.69,-7.19],[-38.67,-7.05],[-38.77,-6.99],[-38.62,-6.79],[-38.67,-6.7],[-38.52,-6.41],[-38.6,-6.39],[-38.46,-6.33],[-38.49,-6.4],[-38.12,-6.52],[-37.76,-6.29],[-37.75,-6.2],[-37.23,-6.04]]],[[[-34.87,-7.0],[-34.85,-6.98],[-34.85,-7.01],[-34.87,-7.0]]]]}},{"type":"Feature","properties":{"uf":"PE"},"geometry":{"type":"MultiPolygon","coordinates":[[[[-37.26,-7.27],[-36.98,-7.48],[-37.17,-7.59],[-37.15,-7.78],[-37.35,-7.97],[-37.19,-7.96],[-37.16,-8.17],[-36.99,-8.3],[-36.64,-8.12],[-36.62,-7.96],[-36.45,-7.92],[-36.41,-7.81],[-36.0,-7.81],[-35.51,-7.64],[-35.48,-7.45],[-35.08,-7.4],[-34.95,-7.54],[-34.83,-7.55],[-34.84,-8.01],[-35.15,-8.91],[-35.46,-8.82],[-35.75,-8.91],[-35.9,-8.85],[-36.13,-8.97],[-36.27,-9.1],[-36.22,-9.17],[-36.6,-9.34],[-36.87,-9.27],[-36.94,-9.38],[-37.11,-9.24],[-37.23,-9.23],[-37.49,-8.97],[-37.69,-9.0],[-37.78,-8.87],[-37.98,-9.15],[-38.23,-9.32],[-38.29,-9.04],[-38.5,-8.98],[-38.51,-8.83],[-38.64,-8.99],[-38.8,-8.79],[-39.22,-8.71],[-39.29,-8.56],[-39.38,-8.53],[-39.69,-8.67],[-39.67,-8.79],[-39.89,-8.83],[-39.87,-8.93],[-39.98,-9.05],[-40.13,-9.11],[-40.24,-9.06],[-40.36,-9.38],[-40.62,-9.48],[-40.78,-9.45],[-40.67,-9.17],[-40.82,-9.08],[-40.92,-8.84],[-41.02,-8.84],[-41.11,-8.71],[-41.36,-8.71],[-40.59,-8.14],[-40.54,-7.83],[-40.67,-7.76],[-40.64,-7.61],[-40.71,-7.49],[-40.65,-7.43],[-39.66,-7.32],[-39.33,-7.53],[-39.31,-7.66],[-39.13,-7.72],[-39.09,-7.86],[-38.96,-7.84],[-38.72,-7.62],[-38.59,-7.75],[-38.36,-7.69],[-38.29,-7.83],[-38.08,-7.83],[-37.85,-7.65],[-37.74,-7.66],[-37.5,-7.37],[-37.26,-7.27]]],[[[-32.44,-3.85],[-32.42,-3.88],[-32.47,-3.88],[-32.44,-3.85]]],[[[-32.4,-3.84],[-32.4,-3.83],[-32.4,-3.84],[-32.4,-3.84]]]]}},{"type":"Feature","properties":{"uf":"PI"},"geometry":{"type":"Polygon","coordinates":[[[-41.82,-2.75],[-41.6,-2.9],[-41.33,-2.92],[-41.26,-3.0],[-41.42,-3.37],[-41.3,-3.49],[-41.34,-3.68],[-41.24,-3.71],[-41.3,-3.83],[-41.22,-3.94],[-41.25,-4.04],[-41.11,-4.04],[-41.09,-4.17],[-41.24,-4.57],[-41.19,-4.66],[-41.25,-4.87],[-40.92,-5.18],[-40.91,-6.05],[-40.78,-6.33],[-40.79,-6.52],[-40.71,-6.68],[-40.37,-6.81],[-40.52,-7.31],[-40.71,-7.47],[-40.67,-7.76],[-40.54,-7.83],[-40.59,-8.14],[-40.93,-8.45],[-41.0,-8.4],[-41.21,-8.64],[-41.38,-8.71],[-41.56,-8.97],[-41.73,-9.02],[-41.85,-9.24],[-42.24,-9.29],[-42.76,-9.61],[-42.95,-9.52],[-42.97,-9.41],[-43.28,-9.42],[-43.48,-9.27],[-43.85,-9.55],[-43.77,-9.77],[-43.65,-9.85],[-43.67,-10.03],[-44.13,-10.64],[-44.34,-10.55],[-44.58,-10.63],[-44.93,-10.93],[-45.25,-10.82],[-45.44,-10.62],[-45.4,-10.46],[-45.59,-10.11],[-45.79,-10.27],[-45.95,-10.25],[-45.78,-9.48],[-45.89,-9.34],[-45.99,-8.94],[-45.77,-8.61],[-45.49,-7.73],[-45.32,-7.57],[-44.92,-7.47],[-44.82,-7.37],[-44.69,-7.39],[-44.56,-7.23],[-44.31,-7.12],[-44.04,-6.77],[-43.72,-6.7],[-43.46,-6.85],[-43.03,-6.76],[-42.92,-6.67],[-42.83,-6.34],[-43.08,-6.05],[-43.09,-5.61],[-42.83,-5.35],[-42.8,-5.19],[-42.95,-4.79],[-42.85,-4.49],[-42.99,-4.23],[-42.73,-3.92],[-42.68,-3.68],[-42.5,-3.45],[-42.2,-3.42],[-42.13,-3.28],[-42.0,-3.24],[-41.83,-3.03],[-41.82,-2.75]]]}},{"type":"Feature","properties":{"uf":"PR"},"geometry":{"type":"Polygon","coordinates":[[[-52.13,-22.53],[-51.71,-22.67],[-51.28,-22.67],[-50.89,-22.8],[-50.73,-22.96],[-50.65,-22.9],[-50.23,-22.95],[-49.99,-22.9],[-49.91,-23.05],[-49.73,-23.11],[-49.57,-23.43],[-49.63,-23.51],[-49.55,-23.7],[-49.61,-23.85],[-49.2,-24.34],[-49.3,-24.67],[-48.58,-24.67],[-48.5,-24.74],[-48.6,-25.0],[-48.56,-25.08],[-48.41,-24.98],[-48.33,-25.07],[-48.24,-24.99],[-48.18,-25.21],[-48.02,-25.23],[-48.44,-25.65],[-48.59,-25.98],[-49.17,-26.0],[-49.56,-26.23],[-49.94,-26.01],[-50.18,-26.08],[-50.25,-26.03],[-50.33,-26.13],[-50.56,-26.01],[-50.73,-26.25],[-50.9,-26.29],[-51.08,-26.23],[-51.21,-26.3],[-51.3,-26.42],[-51.24,-26.63],[-51.4,-26.71],[-51.49,-26.59],[-51.88,-26.6],[-52.19,-26.45],[-52.74,-26.34],[-53.11,-26.38],[-53.28,-26.25],[-53.54,-26.29],[-53.83,-25.97],[-53.89,-25.62],[-54.08,-25.56],[-54.1,-25.62],[-54.1,-25.5],[-54.17,-25.58],[-54.39,-25.6],[-54.43,-25.7],[-54.59,-25.59],[-54.62,-25.46],[-54.43,-25.15],[-54.44,-24.95],[-54.26,-24.36],[-54.34,-24.13],[-54.1,-23.95],[-53.98,-23.46],[-53.73,-23.32],[-53.61,-22.95],[-52.98,-22.57],[-52.7,-22.63],[-52.58,-22.57],[-52.22,-22.67],[-52.13,-22.53]]]}},{"type":"Feature","properties":{"uf":"RJ"},"geometry":{"type":"MultiPolygon","coordinates":[[[[-44.51,-23.29],[-44.72,-23.37],[-44.83,-23.29],[-44.89,-23.22],[-44.8,-23.0],[-44.49,-22.85],[-44.27,-22.83],[-44.16,-22.68],[-44.39,-22.57],[-44.63,-22.61],[-44.79,-22.39],[-43.77,-22.07],[-43.56,-22.09],[-43.35,-22.0],[-43.07,-22.09],[-42.31,-21.73],[-42.27,-21.68],[-42.37,-21.62],[-42.25,-21.49],[-42.21,-21.18],[-42.08,-21.04],[-42.15,-20.98],[-41.97,-20.92],[-41.88,-20.77],[-41.75,-20.81],[-41.7,-21.13],[-41.09,-21.22],[-40.96,-21.3],[-41.07,-21.52],[-40.99,-22.0],[-41.69,-22.3],[-41.96,-22.53],[-41.98,-22.72],[-41.87,-22.76],[-41.97,-22.82],[-42.03,-22.9],[-42.01,-23.0],[-42.38,-22.93],[-43.05,-22.98],[-43.13,-22.94],[-43.03,-22.74],[-43.09,-22.68],[-43.27,-22.78],[-43.29,-22.81],[-43.24,-22.88],[-43.16,-22.9],[-43.15,-22.95],[-43.29,-23.02],[-43.71,-23.05],[-43.58,-23.04],[-43.85,-22.9],[-44.19,-23.05],[-44.36,-23.02],[-44.3,-22.96],[-44.35,-22.92],[-44.44,-23.02],[-44.67,-23.06],[-44.72,-23.19],[-44.71,-23.23],[-44.64,-23.18],[-44.69,-23.25],[-44.62,-23.25],[-44.66,-23.3],[-44.56,-23.23],[-44.51,-23.29]],[[-43.41,-22.99],[-43.32,-23.0],[-43.31,-23.01],[-43.41,-22.99]]],[[[-44.23,-23.09],[-44.09,-23.18],[-44.35,-23.21],[-44.37,-23.17],[-44.23,-23.09]]],[[[-43.9,-23.03],[-43.79,-23.06],[-44.01,-23.08],[-43.9,-23.03]]],[[[-43.19,-22.79],[-43.17,-22.83],[-43.26,-22.81],[-43.19,-22.79]]],[[[-43.91,-22.96],[-43.88,-22.92],[-43.87,-22.93],[-43.91,-22.96]]],[[[-43.21,-22.87],[-43.24,-22.84],[-43.23,-22.84],[-43.21,-22.87]]],[[[-43.92,-23.0],[-43.94,-23.0],[-43.92,-22.99],[-43.92,-23.0]]],[[[-44.6,-23.21],[-44.6,-23.22],[-44.62,-23.22],[-44.6,-23.21]]],[[[-44.05,-23.01],[-44.03,-23.0],[-44.03,-23.01],[-44.05,-23.01]]],[[[-44.68,-23.16],[-44.7,-23.16],[-44.69,-23.15],[-44.68,-23.16]]],[[[-41.69,-22.41],[-41.7,-22.42],[-41.7,-22.41],[-41.69,-22.41]]],[[[-44.51,-23.29],[-44.5,-23.3],[-44.51,-23.29],[-44.51,-23.29]]],[[[-43.11,-22.76],[-43.1,-22.76],[-43.11,-22.77],[-43.11,-22.76]]],[[[-43.11,-22.76],[-43.11,-22.75],[-43.1,-22.75],[-43.11,-22.76]]],[[[-43.18,-22.9],[-43.17,-22.89],[-43.18,-22.9],[-43.18,-22.9]]],[[[-44.65,-23.07],[-44.64,-23.07],[-44.64,-23.07],[-44.65,-23.07]]],[[[-43.86,-22.95],[-43.86,-22.95],[-43.86,-22.95],[-43.86,-22.95]]],[[[-41.69,-22.4],[-41.69,-22.4],[-41.69,-22.4],[-41.69,-22.4]]],[[[-44.58,-23.2],[-44.58,-23.2],[-44.58,-23.2],[-44.58,-23.2]]],[[[-44.58,-23.19],[-44.57,-23.19],[-44.58,-23.19],[-44.58,-23.19]]],[[[-43.91,-22.98],[-43.91,-22.98],[-43.91,-22.98],[-43.91,-22.98]]],[[[-44.65,-23.23],[-44.65,-23.23],[-44.65,-23.23],[-44.65,-23.23]]],[[[-41.89,-22.78],[-41.88,-22.78],[-41.88,-22.78],[-41.89,-22.78]]],[[[-44.13,-23.04],[-44.13,-23.04],[-44.13,-23.04],[-44.13,-23.04]]],[[[-43.92,-22.94],[-43.92,-22.94],[-43.92,-22.94],[-43.92,-22.94]]],[[[-43.51,-23.07],[-43.51,-23.07],[-43.51,-23.07],[-43.51,-23.07]]],[[[-43.15,-23.06],[-43.15,-23.07],[-43.15,-23.06],[-43.15,-23.06]]],[[[-44.64,-23.23],[-44.63,-23.23],[-44.64,-23.23],[-44.64,-23.23]]],[[[-43.94,-23.02],[-43.94,-23.02],[-43.94,-23.02],[-43.94,-23.02]]],[[[-44.69,-23.21],[-44.69,-23.22],[-44.69,-23.21],[-44.69,-23.21]]],[[[-43.95,-23.0],[-43.95,-23.01],[-43.95,-23.0],[-43.95,-23.0]]],[[[-43.21,-23.04],[-43.2,-23.04],[-43.21,-23.04],[-43.21,-23.04]]],[[[-44.67,-23.1],[-44.67,-23.1],[-44.67,-23.1],[-44.67,-23.1]]],[[[-43.95,-23.02],[-43.95,-23.02],[-43.95,-23.02],[-43.95,-23.02]]],[[[-43.86,-22.95],[-43.86,-22.95],[-43.86,-22.95],[-43.86,-22.95]]],[[[-44.67,-23.11],[-44.67,-23.11],[-44.67,-23.11],[-44.67,-23.11]]]]}},{"type":"Feature","properties":{"uf":"RN"},"geometry":{"type":"Polygon","coordinates":[[[-37.15,-4.93],[-36.96,-4.92],[-36.69,-5.09],[-35.95,-5.04],[-35.49,-5.16],[-35.26,-5.48],[-34.97,-6.48],[-35.17,-6.56],[-35.66,-6.45],[-36.01,-6.48],[-36.07,-6.41],[-36.25,-6.44],[-36.31,-6.28],[-36.39,-6.29],[-36.53,-6.45],[-36.44,-6.63],[-36.52,-6.6],[-36.51,-6.82],[-36.72,-6.98],[-36.79,-6.77],[-36.96,-6.79],[-36.99,-6.71],[-37.23,-6.82],[-37.28,-6.69],[-37.48,-6.71],[-37.38,-6.34],[-37.16,-6.15],[-37.2,-6.04],[-37.75,-6.2],[-37.76,-6.29],[-38.12,-6.52],[-38.49,-6.4],[-38.46,-6.33],[-38.58,-6.35],[-38.45,-6.08],[-38.29,-6.07],[-38.16,-5.95],[-38.08,-5.67],[-37.9,-5.5],[-37.64,-4.93],[-37.25,-4.83],[-37.15,-4.93]]]}},{"type":"Feature","properties":{"uf":"RO"},"geometry":{"type":"MultiPolygon","coordinates":[[[[-66.46,-9.88],[-66.81,-9.81],[-66.5,-9.63],[-66.41,-9.41],[-65.97,-9.41],[-65.79,-9.59],[-65.6,-9.41],[-65.43,-9.46],[-65.44,-9.31],[-65.25,-9.26],[-65.18,-9.43],[-65.09,-9.43],[-64.92,-9.23],[-64.87,-9.01],[-64.14,-8.95],[-64.13,-8.72],[-63.92,-8.57],[-63.93,-8.32],[-63.78,-8.33],[-63.63,-8.02],[-62.87,-7.97],[-62.69,-8.1],[-62.52,-8.38],[-62.36,-8.4],[-62.34,-8.6],[-62.19,-8.59],[-62.12,-8.8],[-61.92,-8.88],[-61.71,-8.69],[-61.48,-8.91],[-61.53,-9.25],[-61.63,-9.28],[-61.48,-9.64],[-61.57,-9.73],[-61.51,-9.89],[-61.6,-10.15],[-61.46,-10.42],[-61.55,-10.98],[-60.46,-10.99],[-60.35,-11.11],[-59.98,-11.12],[-59.92,-11.4],[-60.11,-11.58],[-60.1,-11.84],[-59.98,-11.91],[-59.89,-12.24],[-59.79,-12.35],[-59.85,-12.47],[-60.06,-12.6],[-60.08,-12.88],[-60.28,-13.09],[-60.39,-13.45],[-60.72,-13.69],[-61.04,-13.48],[-61.84,-13.55],[-62.17,-13.12],[-62.41,-13.13],[-62.65,-12.97],[-62.78,-13.01],[-63.15,-12.62],[-63.29,-12.68],[-63.79,-12.43],[-63.95,-12.53],[-64.29,-12.5],[-64.5,-12.37],[-64.51,-12.22],[-64.69,-12.19],[-64.71,-12.09],[-64.75,-12.16],[-64.78,-12.09],[-64.83,-12.12],[-64.84,-12.01],[-65.03,-11.99],[-65.09,-11.71],[-65.25,-11.71],[-65.21,-11.53],[-65.31,-11.49],[-65.29,-11.32],[-65.36,-11.25],[-65.25,-10.99],[-65.42,-10.62],[-65.43,-10.48],[-65.29,-10.22],[-65.29,-9.85],[-65.39,-9.69],[-65.56,-9.84],[-65.77,-9.73],[-65.79,-9.79],[-65.92,-9.75],[-66.46,-9.88]]],[[[-66.46,-9.88],[-66.46,-9.88],[-66.46,-9.88],[-66.46,-9.88]]]]}},{"type":"Feature","properties":{"uf":"RR"},"geometry":{"type":"Polygon","coordinates":[[[-59.81,3.37],[-59.99,2.69],[-59.9,2.37],[-59.72,2.28],[-59.75,1.86],[-59.66,1.87],[-59.69,1.76],[-59.53,1.72],[-59.25,1.39],[-58.92,1.32],[-58.9,0.61],[-59.19,0.26],[-60.04,0.26],[-60.4,-0.51],[-60.3,-0.71],[-60.48,-0.77],[-60.53,-0.88],[-60.75,-0.86],[-60.92,-0.56],[-61.09,-0.5],[-61.46,-0.66],[-61.55,-0.81],[-61.63,-1.3],[-61.48,-1.58],[-61.6,-1.45],[-61.9,-1.4],[-62.04,-1.12],[-62.5,-0.77],[-62.49,-0.68],[-62.39,-0.72],[-62.3,-0.65],[-62.31,-0.51],[-62.19,-0.33],[-62.42,0.08],[-62.53,0.5],[-62.47,1.09],[-62.53,1.09],[-62.64,1.44],[-62.8,1.6],[-62.71,1.94],[-63.07,2.04],[-63.14,2.17],[-63.36,2.2],[-63.42,2.44],[-63.72,2.38],[-64.03,2.47],[-63.99,2.77],[-64.23,3.12],[-64.25,3.41],[-64.19,3.56],[-64.48,3.79],[-64.82,4.24],[-64.69,4.25],[-64.59,4.11],[-64.17,4.13],[-63.96,3.87],[-63.86,3.95],[-63.67,3.91],[-63.68,4.01],[-63.5,3.84],[-63.43,3.98],[-63.21,3.95],[-63.22,3.83],[-62.96,3.61],[-62.84,3.73],[-62.74,3.67],[-62.75,4.04],[-62.56,4.02],[-62.44,4.18],[-62.15,4.08],[-61.98,4.18],[-61.93,4.11],[-61.77,4.25],[-61.56,4.25],[-61.51,4.4],[-61.28,4.47],[-61.32,4.54],[-61.0,4.52],[-60.91,4.71],[-60.74,4.76],[-60.59,4.93],[-60.72,5.22],[-60.43,5.18],[-60.21,5.27],[-60.0,5.09],[-59.99,4.97],[-60.03,4.7],[-60.16,4.51],[-59.79,4.47],[-59.68,4.38],[-59.72,4.18],[-59.52,3.94],[-59.67,3.7],[-59.86,3.58],[-59.81,3.37]]]}},{"type":"Feature","properties":{"uf":"RS"},"geometry":{"type":"MultiPolygon","coordinates":[[[[-52.03,-31.7],[-52.04,-31.57],[-52.06,-31.56],[-52.11,-31.56],[-52.07,-31.68],[-52.23,-31.75],[-52.26,-31.85],[-52.07,-32.03],[-52.1,-32.16],[-52.34,-32.43],[-52.62,-33.11],[-53.4,-33.75],[-53.53,-33.65],[-53.43,-33.5],[-53.43,-33.16],[-53.32,-33.05],[-53.26,-33.1],[-53.12,-32.79],[-53.07,-32.83],[-52.98,-32.73],[-52.9,-32.89],[-52.76,-32.87],[-52.59,-32.52],[-52.69,-32.32],[-52.62,-32.15],[-52.8,-32.27],[-52.74,-32.4],[-52.96,-32.49],[-53.07,-32.65],[-53.4,-32.58],[-53.63,-32.39],[-53.74,-32.08],[-53.98,-31.92],[-54.1,-31.93],[-54.58,-31.46],[-54.84,-31.44],[-55.01,-31.27],[-55.07,-31.33],[-55.24,-31.26],[-55.35,-31.04],[-55.58,-30.84],[-55.87,-31.07],[-56.01,-31.07],[-56.02,-30.79],[-56.82,-30.1],[-57.07,-30.09],[-57.22,-30.29],[-57.52,-30.29],[-57.64,-30.19],[-57.34,-29.99],[-57.29,-29.82],[-56.97,-29.64],[-56.59,-29.12],[-56.42,-29.07],[-56.29,-28.79],[-56.0,-28.6],[-56.02,-28.51],[-55.89,-28.48],[-55.87,-28.36],[-55.7,-28.43],[-55.67,-28.33],[-55.77,-28.24],[-55.44,-28.09],[-55.2,-27.86],[-55.03,-27.86],[-55.08,-27.79],[-54.94,-27.77],[-54.81,-27.53],[-54.68,-27.57],[-54.58,-27.45],[-54.53,-27.5],[-54.41,-27.41],[-54.28,-27.45],[-54.18,-27.27],[-54.08,-27.3],[-53.87,-27.13],[-53.64,-27.22],[-53.37,-27.09],[-53.29,-27.13],[-53.31,-27.22],[-53.02,-27.08],[-52.99,-27.22],[-52.85,-27.17],[-52.69,-27.28],[-52.45,-27.22],[-52.21,-27.33],[-52.17,-27.27],[-51.95,-27.38],[-52.01,-27.4],[-51.88,-27.52],[-51.63,-27.49],[-51.08,-27.83],[-50.62,-28.39],[-50.16,-28.5],[-50.13,-28.43],[-49.77,-28.46],[-49.69,-28.62],[-49.92,-28.72],[-49.96,-29.1],[-50.16,-29.25],[-50.04,-29.35],[-50.11,-29.26],[-49.91,-29.21],[-49.72,-29.34],[-50.04,-29.81],[-50.33,-30.49],[-50.7,-31.01],[-51.25,-31.57],[-52.08,-32.16],[-52.01,-31.94],[-52.1,-31.84],[-51.85,-31.87],[-51.79,-31.81],[-51.86,-31.8],[-51.66,-31.77],[-51.48,-31.57],[-51.44,-31.62],[-51.43,-31.48],[-51.36,-31.53],[-51.24,-31.46],[-51.17,-31.07],[-50.99,-31.05],[-50.97,-30.9],[-50.7,-30.75],[-50.72,-30.35],[-50.65,-30.39],[-50.63,-30.34],[-50.65,-30.44],[-50.57,-30.47],[-50.54,-30.27],[-50.6,-30.19],[-50.66,-30.29],[-50.91,-30.32],[-50.92,-30.44],[-51.05,-30.39],[-51.03,-30.28],[-51.24,-30.19],[-51.23,-30.06],[-51.29,-30.0],[-51.33,-30.22],[-51.29,-30.3],[-51.09,-30.37],[-51.26,-30.47],[-51.29,-30.74],[-51.33,-30.63],[-51.39,-30.66],[-51.37,-30.87],[-51.5,-30.91],[-51.45,-31.09],[-51.62,-31.14],[-51.62,-31.27],[-51.92,-31.31],[-52.03,-31.7]]],[[[-51.32,-30.78],[-51.28,-30.8],[-51.3,-30.82],[-51.32,-30.78]]],[[[-50.1,-29.24],[-50.09,-29.21],[-50.08,-29.23],[-50.1,-29.24]]],[[[-51.15,-30.47],[-51.15,-30.5],[-51.15,-30.47],[-51.15,-30.47]]],[[[-49.96,-29.07],[-49.95,-29.05],[-49.94,-29.06],[-49.96,-29.07]]],[[[-51.3,-30.05],[-51.27,-30.05],[-51.3,-30.05],[-51.3,-30.05]]],[[[-52.1,-31.8],[-52.11,-31.79],[-52.1,-31.8],[-52.1,-31.8]]],[[[-53.41,-33.12],[-53.41,-33.11],[-53.41,-33.11],[-53.41,-33.12]]],[[[-49.97,-29.12],[-49.96,-29.11],[-49.97,-29.12],[-49.97,-29.12]]],[[[-51.47,-31.55],[-51.46,-31.55],[-51.47,-31.55],[-51.47,-31.55]]],[[[-51.17,-30.26],[-51.16,-30.27],[-51.17,-30.26],[-51.17,-30.26]]],[[[-51.1,-30.26],[-51.1,-30.26],[-51.1,-30.26],[-51.1,-30.26]]],[[[-52.04,-31.57],[-52.05,-31.57],[-52.04,-31.57],[-52.04,-31.57]]],[[[-51.19,-30.23],[-51.19,-30.24],[-51.19,-30.23],[-51.19,-30.23]]]]}},{"type":"Feature","properties":{"uf":"SC"},"geometry":{"type":"MultiPolygon","coordinates":[[[[-53.75,-26.71],[-53.64,-26.25],[-53.29,-26.25],[-53.09,-26.39],[-52.74,-26.34],[-52.19,-26.45],[-51.87,-26.6],[-51.51,-26.58],[-51.41,-26.72],[-51.23,-26.62],[-51.29,-26.44],[-51.24,-26.32],[-51.08,-26.23],[-50.9,-26.29],[-50.72,-26.24],[-50.57,-26.0],[-50.34,-26.13],[-50.25,-26.03],[-50.18,-26.08],[-49.94,-26.01],[-49.55,-26.24],[-49.17,-26.0],[-48.6,-25.98],[-48.58,-26.16],[-48.49,-26.22],[-48.69,-26.68],[-48.59,-26.78],[-48.6,-27.12],[-48.47,-27.14],[-48.62,-27.25],[-48.52,-27.33],[-48.65,-27.48],[-48.57,-27.6],[-48.64,-27.64],[-48.57,-27.89],[-48.74,-28.51],[-49.33,-28.91],[-49.71,-29.32],[-49.96,-29.2],[-50.11,-29.26],[-50.1,-29.28],[-50.06,-29.31],[-50.04,-29.35],[-50.15,-29.29],[-50.14,-29.19],[-50.09,-29.24],[-50.1,-29.16],[-49.96,-29.11],[-49.94,-28.73],[-49.69,-28.62],[-49.77,-28.46],[-50.1,-28.48],[-50.13,-28.43],[-50.16,-28.5],[-50.25,-28.43],[-50.54,-28.43],[-51.08,-27.84],[-51.63,-27.49],[-51.89,-27.52],[-52.01,-27.4],[-51.96,-27.38],[-52.17,-27.27],[-52.21,-27.33],[-52.29,-27.26],[-52.3,-27.32],[-52.44,-27.22],[-52.7,-27.28],[-52.85,-27.17],[-52.98,-27.22],[-53.03,-27.08],[-53.31,-27.22],[-53.36,-27.09],[-53.51,-27.2],[-53.83,-27.17],[-53.67,-26.94],[-53.75,-26.71]]],[[[-48.41,-27.39],[-48.36,-27.45],[-48.49,-27.79],[-48.57,-27.84],[-48.55,-27.46],[-48.41,-27.39]]],[[[-48.56,-27.48],[-48.56,-27.48],[-48.56,-27.48],[-48.56,-27.48]]]]}},{"type":"Feature","properties":{"uf":"SE"},"geometry":{"type":"Polygon","coordinates":[[[-37.96,-9.53],[-36.97,-9.99],[-36.91,-10.14],[-36.62,-10.26],[-36.56,-10.42],[-36.46,-10.41],[-36.39,-10.5],[-36.85,-10.74],[-37.33,-11.43],[-37.55,-11.55],[-37.7,-11.56],[-37.94,-11.42],[-37.97,-11.2],[-38.24,-10.86],[-38.21,-10.71],[-38.0,-10.76],[-37.84,-10.7],[-37.86,-10.43],[-37.74,-10.32],[-37.83,-10.0],[-38.0,-9.92],[-38.04,-9.57],[-37.96,-9.53]]]}},{"type":"Feature","properties":{"uf":"SP"},"geometry":{"type":"MultiPolygon","coordinates":[[[[-46.14,-23.86],[-46.18,-23.99],[-46.29,-24.04],[-46.38,-23.97],[-46.94,-24.28],[-47.02,-24.42],[-47.77,-24.91],[-47.91,-25.16],[-48.1,-25.31],[-48.02,-25.23],[-48.18,-25.21],[-48.24,-24.99],[-48.33,-25.07],[-48.41,-24.98],[-48.56,-25.08],[-48.6,-25.0],[-48.5,-24.74],[-48.58,-24.67],[-49.3,-24.67],[-49.2,-24.34],[-49.61,-23.85],[-49.55,-23.7],[-49.63,-23.51],[-49.57,-23.43],[-49.68,-23.16],[-49.91,-23.05],[-49.99,-22.9],[-50.18,-22.95],[-50.65,-22.9],[-50.73,-22.96],[-50.89,-22.8],[-51.28,-22.67],[-51.71,-22.67],[-52.1,-22.52],[-52.22,-22.67],[-52.58,-22.57],[-53.11,-22.61],[-52.34,-22.06],[-52.05,-21.66],[-52.08,-21.52],[-51.97,-21.5],[-51.86,-21.34],[-51.88,-21.15],[-51.62,-20.93],[-51.59,-20.64],[-51.35,-20.36],[-51.13,-20.29],[-50.93,-20.01],[-50.58,-19.82],[-49.26,-19.96],[-49.3,-20.12],[-49.24,-20.29],[-48.99,-20.16],[-48.9,-20.44],[-48.84,-20.17],[-48.22,-20.13],[-48.23,-20.03],[-48.09,-20.15],[-47.98,-20.04],[-47.9,-20.12],[-47.85,-19.99],[-47.63,-20.04],[-47.47,-19.96],[-47.26,-20.17],[-47.29,-20.43],[-47.1,-20.64],[-47.24,-20.89],[-47.14,-20.98],[-47.01,-21.42],[-46.66,-21.36],[-46.51,-21.47],[-46.52,-21.61],[-46.69,-21.84],[-46.61,-22.02],[-46.72,-22.08],[-46.6,-22.13],[-46.72,-22.31],[-46.67,-22.41],[-46.41,-22.54],[-46.39,-22.66],[-46.48,-22.7],[-46.34,-22.76],[-46.35,-22.9],[-46.14,-22.86],[-46.14,-22.92],[-45.91,-22.82],[-45.79,-22.86],[-45.71,-22.81],[-45.73,-22.72],[-45.82,-22.72],[-45.7,-22.65],[-45.72,-22.58],[-45.67,-22.65],[-45.47,-22.59],[-45.4,-22.65],[-44.81,-22.41],[-44.63,-22.61],[-44.39,-22.57],[-44.16,-22.68],[-44.27,-22.83],[-44.79,-22.98],[-44.89,-23.22],[-44.72,-23.37],[-44.91,-23.34],[-45.06,-23.42],[-45.08,-23.52],[-45.16,-23.49],[-45.21,-23.58],[-45.31,-23.57],[-45.41,-23.62],[-45.41,-23.82],[-45.84,-23.76],[-46.14,-23.86]]],[[[-45.29,-23.91],[-45.46,-23.9],[-45.32,-23.72],[-45.23,-23.78],[-45.29,-23.87],[-45.23,-23.91],[-45.26,-23.96],[-45.29,-23.91]]],[[[-45.08,-23.56],[-45.06,-23.53],[-45.04,-23.53],[-45.08,-23.56]]],[[[-45.14,-23.8],[-45.12,-23.81],[-45.16,-23.81],[-45.14,-23.8]]],[[[-45.16,-23.57],[-45.15,-23.56],[-45.15,-23.57],[-45.16,-23.57]]],[[[-45.02,-23.76],[-45.01,-23.75],[-45.01,-23.76],[-45.02,-23.76]]],[[[-45.77,-23.86],[-45.79,-23.87],[-45.78,-23.86],[-45.77,-23.86]]],[[[-45.3,-23.6],[-45.29,-23.59],[-45.28,-23.6],[-45.3,-23.6]]],[[[-45.02,-23.75],[-45.02,-23.74],[-45.02,-23.75],[-45.02,-23.75]]],[[[-45.73,-23.8],[-45.72,-23.8],[-45.72,-23.8],[-45.73,-23.8]]],[[[-45.53,-23.85],[-45.52,-23.85],[-45.52,-23.85],[-45.53,-23.85]]],[[[-46.91,-24.39],[-46.9,-24.39],[-46.91,-24.39],[-46.91,-24.39]]],[[[-46.91,-24.37],[-46.9,-24.38],[-46.91,-24.38],[-46.91,-24.37]]],[[[-45.03,-23.55],[-45.02,-23.54],[-45.03,-23.55],[-45.03,-23.55]]],[[[-44.85,-23.4],[-44.85,-23.4],[-44.85,-23.4],[-44.85,-23.4]]],[[[-44.95,-23.39],[-44.94,-23.38],[-44.95,-23.39],[-44.95,-23.39]]],[[[-46.98,-24.37],[-46.98,-24.37],[-46.98,-24.37],[-46.98,-24.37]]],[[[-47.91,-25.17],[-47.91,-25.17],[-47.91,-25.17],[-47.91,-25.17]]],[[[-45.23,-23.81],[-45.23,-23.82],[-45.23,-23.81],[-45.23,-23.81]]],[[[-45.33,-23.92],[-45.32,-23.92],[-45.33,-23.92],[-45.33,-23.92]]],[[[-45.71,-23.79],[-45.71,-23.79],[-45.71,-23.79],[-45.71,-23.79]]],[[[-45.28,-23.85],[-45.28,-23.85],[-45.28,-23.85],[-45.28,-23.85]]],[[[-45.3,-23.92],[-45.29,-23.92],[-45.3,-23.92],[-45.3,-23.92]]],[[[-45.16,-23.83],[-45.15,-23.83],[-45.16,-23.83],[-45.16,-23.83]]],[[[-45.67,-23.8],[-45.67,-23.8],[-45.67,-23.8],[-45.67,-23.8]]]]}},{"type":"Feature","properties":{"uf":"TO"},"geometry":{"type":"Polygon","coordinates":[[[-46.92,-8.86],[-47.07,-9.06],[-46.91,-9.08],[-46.77,-9.4],[-46.56,-9.48],[-46.64,-9.74],[-46.49,-9.83],[-46.36,-10.17],[-46.03,-10.18],[-46.0,-10.26],[-45.79,-10.27],[-45.7,-10.17],[-45.83,-10.44],[-46.21,-10.65],[-46.28,-10.9],[-46.62,-11.3],[-46.47,-11.52],[-46.09,-11.62],[-46.3,-11.62],[-46.37,-11.88],[-46.17,-11.91],[-46.4,-12.04],[-46.37,-12.29],[-46.25,-12.49],[-46.15,-12.48],[-46.28,-12.58],[-46.3,-12.91],[-46.12,-12.93],[-46.36,-12.99],[-46.42,-12.82],[-46.45,-12.96],[-46.82,-13.0],[-47.43,-13.29],[-47.63,-13.1],[-47.68,-13.46],[-47.8,-13.33],[-48.06,-13.24],[-48.16,-13.3],[-48.17,-13.15],[-48.44,-13.29],[-48.51,-13.13],[-48.58,-13.31],[-48.6,-13.06],[-48.86,-12.8],[-48.98,-12.96],[-49.12,-12.79],[-49.24,-12.88],[-49.37,-13.27],[-50.29,-12.84],[-50.3,-12.68],[-50.2,-12.55],[-50.22,-12.53],[-50.16,-12.44],[-50.17,-12.41],[-50.36,-12.54],[-50.51,-12.86],[-50.62,-12.82],[-50.7,-12.61],[-50.62,-12.43],[-50.69,-12.04],[-50.64,-11.88],[-50.72,-11.74],[-50.66,-11.6],[-50.74,-11.45],[-50.61,-11.07],[-50.6,-10.66],[-50.11,-9.59],[-50.04,-9.3],[-49.74,-8.9],[-49.59,-8.83],[-49.27,-8.34],[-49.15,-7.81],[-49.38,-7.54],[-49.19,-7.24],[-49.21,-6.93],[-48.66,-6.66],[-48.63,-6.48],[-48.5,-6.35],[-48.38,-6.38],[-48.43,-6.18],[-48.3,-6.11],[-48.34,-6.02],[-48.23,-5.93],[-48.29,-5.76],[-48.17,-5.71],[-48.14,-5.6],[-48.38,-5.39],[-48.74,-5.37],[-48.61,-5.34],[-48.52,-5.19],[-47.94,-5.24],[-47.84,-5.38],[-47.5,-5.53],[-47.38,-6.25],[-47.53,-6.98],[-47.75,-7.19],[-47.65,-7.3],[-47.48,-7.32],[-47.59,-7.44],[-47.5,-7.44],[-47.04,-8.05],[-46.63,-7.9],[-46.49,-7.98],[-46.51,-8.27],[-46.78,-8.37],[-46.92,-8.6],[-46.92,-8.86]]]}},{"type":"Feature","properties":{"uf":"DF"},"geometry":{"type":"Polygon","coordinates":[[[-47.37,-15.96],[-47.32,-16.05],[-48.27,-16.05],[-48.2,-15.5],[-47.42,-15.51],[-47.32,-15.59],[-47.37,-15.96]]]}}]};
  const BR_OUTLINE = {"type":"MultiPolygon","coordinates":[[[[-32.47,-3.88],[-32.44,-3.85],[-32.42,-3.88],[-32.42,-3.88],[-32.47,-3.88]]],[[[-73.99,-7.55],[-73.92,-7.46],[-73.96,-7.35],[-73.71,-7.3],[-73.8,-7.11],[-73.64,-6.75],[-73.14,-6.5],[-73.24,-6.03],[-72.96,-5.65],[-72.88,-5.17],[-72.81,-5.11],[-71.89,-4.52],[-71.63,-4.47],[-71.6,-4.53],[-71.27,-4.38],[-70.95,-4.38],[-70.81,-4.18],[-70.69,-4.2],[-70.65,-4.13],[-70.61,-4.19],[-70.33,-4.15],[-70.2,-4.35],[-70.11,-4.26],[-70.04,-4.35],[-69.96,-4.3],[-69.4,-1.13],[-69.62,-0.75],[-69.61,-0.51],[-70.05,-0.19],[-70.03,0.56],[-69.8,0.58],[-69.68,0.67],[-69.61,0.63],[-69.48,0.74],[-69.36,0.61],[-69.13,0.65],[-69.19,0.75],[-69.14,0.89],[-69.25,1.05],[-69.84,1.09],[-69.83,1.72],[-69.55,1.79],[-69.38,1.73],[-68.19,1.74],[-68.27,1.83],[-68.18,1.98],[-67.93,1.83],[-67.77,2.04],[-67.62,2.02],[-67.41,2.25],[-67.28,1.88],[-67.15,1.84],[-67.1,1.73],[-67.08,1.18],[-66.86,1.23],[-66.32,0.76],[-66.12,0.75],[-65.74,1.0],[-65.58,1.0],[-65.49,0.88],[-65.58,0.74],[-65.55,0.67],[-65.43,0.7],[-65.32,0.93],[-65.18,0.92],[-65.1,1.16],[-65.02,1.12],[-64.8,1.31],[-64.72,1.24],[-64.4,1.52],[-64.35,1.5],[-64.4,1.4],[-64.33,1.37],[-64.11,1.59],[-64.0,1.98],[-63.66,2.02],[-63.37,2.22],[-63.42,2.44],[-63.72,2.38],[-64.03,2.47],[-63.99,2.77],[-64.23,3.12],[-64.25,3.41],[-64.19,3.56],[-64.48,3.79],[-64.82,4.24],[-64.69,4.25],[-64.59,4.11],[-64.17,4.13],[-63.96,3.87],[-63.86,3.95],[-63.68,3.91],[-63.68,4.01],[-63.5,3.85],[-63.43,3.98],[-63.21,3.95],[-63.22,3.83],[-62.96,3.61],[-62.84,3.73],[-62.74,3.68],[-62.75,4.04],[-62.56,4.02],[-62.44,4.18],[-62.15,4.08],[-61.98,4.18],[-61.93,4.12],[-61.77,4.25],[-61.56,4.25],[-61.51,4.4],[-61.29,4.47],[-61.32,4.54],[-61.0,4.52],[-60.91,4.71],[-60.74,4.76],[-60.59,4.93],[-60.72,5.22],[-60.43,5.18],[-60.21,5.27],[-60.0,5.09],[-59.99,4.97],[-60.03,4.7],[-60.15,4.51],[-59.79,4.47],[-59.68,4.38],[-59.72,4.18],[-59.52,3.94],[-59.67,3.7],[-59.86,3.58],[-59.81,3.37],[-59.99,2.69],[-59.9,2.37],[-59.72,2.28],[-59.75,1.87],[-59.66,1.87],[-59.69,1.76],[-59.53,1.72],[-59.25,1.39],[-58.92,1.32],[-58.92,1.23],[-58.83,1.17],[-58.7,1.29],[-58.5,1.27],[-58.51,1.46],[-58.38,1.47],[-58.32,1.6],[-58.01,1.5],[-57.99,1.66],[-57.77,1.73],[-57.54,1.7],[-57.31,2.0],[-57.23,1.94],[-57.09,2.03],[-57.01,1.92],[-56.79,1.85],[-56.45,1.96],[-55.98,1.84],[-55.9,2.03],[-56.14,2.27],[-56.09,2.38],[-56.02,2.35],[-55.99,2.52],[-55.71,2.4],[-55.35,2.45],[-55.32,2.52],[-55.0,2.59],[-54.88,2.43],[-54.69,2.44],[-54.66,2.33],[-54.44,2.21],[-54.19,2.18],[-53.76,2.38],[-53.75,2.31],[-53.53,2.26],[-53.34,2.35],[-53.23,2.27],[-53.26,2.17],[-52.95,2.17],[-52.55,2.52],[-52.33,3.17],[-51.97,3.72],[-51.65,4.04],[-51.54,4.43],[-51.25,4.19],[-51.08,3.88],[-51.01,3.04],[-50.7,2.15],[-50.45,2.2],[-50.23,1.8],[-49.91,1.7],[-49.9,1.19],[-50.06,0.8],[-50.31,0.67],[-50.16,0.7],[-50.04,0.57],[-50.02,0.33],[-49.65,0.35],[-49.39,0.01],[-48.91,-0.23],[-48.41,-0.26],[-48.47,-0.5],[-48.0,-0.71],[-47.9,-0.55],[-47.84,-0.66],[-47.8,-0.55],[-47.77,-0.62],[-47.72,-0.54],[-47.63,-0.68],[-47.56,-0.59],[-47.49,-0.75],[-47.42,-0.59],[-47.42,-0.64],[-47.32,-0.59],[-47.22,-0.64],[-47.23,-0.69],[-47.16,-0.67],[-47.17,-0.76],[-47.09,-0.66],[-47.06,-0.77],[-46.95,-0.73],[-46.95,-0.85],[-46.84,-0.73],[-46.8,-0.89],[-46.77,-0.82],[-46.74,-0.89],[-46.64,-0.79],[-46.66,-0.97],[-46.55,-0.9],[-46.53,-0.97],[-46.43,-0.86],[-46.49,-0.97],[-46.42,-1.05],[-46.34,-1.0],[-46.34,-1.07],[-46.27,-0.92],[-46.19,-0.89],[-46.25,-1.0],[-46.2,-1.04],[-46.17,-0.99],[-46.18,-1.15],[-46.07,-1.02],[-46.09,-1.16],[-45.97,-1.05],[-45.95,-1.21],[-45.84,-1.05],[-45.89,-1.15],[-45.85,-1.24],[-45.81,-1.17],[-45.78,-1.21],[-45.82,-1.28],[-45.69,-1.13],[-45.75,-1.24],[-45.71,-1.4],[-45.64,-1.37],[-45.7,-1.36],[-45.62,-1.12],[-45.64,-1.32],[-45.53,-1.27],[-45.51,-1.39],[-45.41,-1.29],[-45.46,-1.5],[-45.32,-1.32],[-45.3,-1.43],[-45.38,-1.53],[-45.3,-1.49],[-45.32,-1.59],[-45.26,-1.62],[-45.07,-1.37],[-45.06,-1.45],[-44.94,-1.52],[-44.82,-1.42],[-44.89,-1.6],[-44.82,-1.58],[-44.77,-1.64],[-44.7,-1.56],[-44.71,-1.61],[-44.65,-1.62],[-44.79,-1.68],[-44.79,-1.73],[-44.7,-1.73],[-44.72,-1.77],[-44.65,-1.72],[-44.53,-1.84],[-44.58,-1.9],[-44.49,-1.93],[-44.49,-2.14],[-44.36,-2.33],[-44.41,-2.41],[-44.31,-2.5],[-44.0,-2.39],[-44.08,-2.45],[-43.97,-2.47],[-43.96,-2.55],[-43.62,-2.22],[-43.5,-2.37],[-43.17,-2.38],[-42.48,-2.71],[-41.82,-2.72],[-41.6,-2.9],[-41.32,-2.92],[-40.51,-2.79],[-40.02,-2.84],[-39.26,-3.22],[-38.65,-3.68],[-38.47,-3.71],[-38.01,-4.25],[-37.59,-4.62],[-37.33,-4.7],[-37.15,-4.93],[-36.96,-4.92],[-36.69,-5.09],[-35.95,-5.04],[-35.49,-5.16],[-35.26,-5.48],[-34.79,-7.15],[-34.84,-8.01],[-35.15,-8.92],[-35.3,-9.18],[-36.27,-10.28],[-36.39,-10.5],[-36.85,-10.74],[-38.05,-12.63],[-38.35,-12.95],[-38.49,-13.01],[-38.61,-12.93],[-38.97,-13.28],[-38.89,-13.64],[-39.0,-13.74],[-38.93,-13.94],[-39.06,-14.71],[-38.86,-15.85],[-39.21,-17.17],[-39.13,-17.69],[-39.49,-18.0],[-39.67,-18.35],[-39.75,-18.79],[-39.69,-19.31],[-39.81,-19.65],[-39.99,-19.75],[-40.14,-19.95],[-40.42,-20.64],[-40.46,-20.63],[-40.63,-20.84],[-40.65,-20.8],[-40.72,-20.84],[-41.07,-21.52],[-40.99,-22.0],[-41.69,-22.3],[-41.96,-22.53],[-41.98,-22.72],[-41.87,-22.76],[-42.03,-22.9],[-42.01,-23.0],[-42.38,-22.93],[-43.05,-22.98],[-43.13,-22.94],[-43.03,-22.74],[-43.09,-22.68],[-43.29,-22.81],[-43.15,-22.95],[-43.29,-23.02],[-43.71,-23.05],[-43.61,-23.03],[-43.85,-22.9],[-44.19,-23.05],[-44.36,-23.02],[-44.31,-22.96],[-44.35,-22.92],[-44.44,-23.02],[-44.67,-23.07],[-44.71,-23.22],[-44.64,-23.18],[-44.68,-23.25],[-44.56,-23.23],[-44.51,-23.29],[-44.72,-23.37],[-44.91,-23.34],[-45.06,-23.42],[-45.08,-23.52],[-45.16,-23.49],[-45.21,-23.58],[-45.31,-23.57],[-45.41,-23.62],[-45.41,-23.81],[-45.32,-23.72],[-45.23,-23.78],[-45.29,-23.87],[-45.23,-23.91],[-45.26,-23.96],[-45.46,-23.9],[-45.41,-23.82],[-45.84,-23.76],[-46.14,-23.86],[-46.18,-23.99],[-46.29,-24.04],[-46.38,-23.97],[-46.94,-24.28],[-47.02,-24.42],[-47.77,-24.91],[-47.91,-25.16],[-48.44,-25.65],[-48.6,-25.99],[-48.58,-26.16],[-48.49,-26.22],[-48.69,-26.68],[-48.59,-26.78],[-48.6,-27.12],[-48.47,-27.14],[-48.61,-27.25],[-48.52,-27.33],[-48.65,-27.48],[-48.57,-27.6],[-48.55,-27.46],[-48.41,-27.39],[-48.36,-27.45],[-48.49,-27.79],[-48.58,-27.85],[-48.74,-28.51],[-49.33,-28.91],[-49.74,-29.32],[-50.04,-29.81],[-50.33,-30.49],[-50.7,-31.01],[-51.25,-31.57],[-52.08,-32.16],[-52.01,-31.94],[-52.1,-31.84],[-51.85,-31.87],[-51.8,-31.82],[-51.86,-31.8],[-51.66,-31.77],[-51.48,-31.57],[-51.44,-31.6],[-51.43,-31.48],[-51.36,-31.53],[-51.24,-31.46],[-51.17,-31.07],[-50.99,-31.05],[-50.97,-30.9],[-50.7,-30.75],[-50.72,-30.35],[-50.65,-30.39],[-50.63,-30.34],[-50.65,-30.44],[-50.57,-30.46],[-50.54,-30.27],[-50.59,-30.2],[-50.66,-30.29],[-50.91,-30.32],[-50.92,-30.44],[-51.05,-30.39],[-51.03,-30.28],[-51.24,-30.19],[-51.23,-30.06],[-51.29,-30.01],[-51.29,-30.3],[-51.09,-30.37],[-51.26,-30.47],[-51.29,-30.74],[-51.33,-30.64],[-51.39,-30.66],[-51.37,-30.87],[-51.5,-30.92],[-51.45,-31.09],[-51.62,-31.14],[-51.62,-31.27],[-51.92,-31.31],[-52.03,-31.7],[-52.04,-31.57],[-52.1,-31.56],[-52.07,-31.68],[-52.23,-31.75],[-52.26,-31.85],[-52.07,-32.03],[-52.1,-32.15],[-52.34,-32.43],[-52.62,-33.11],[-53.4,-33.75],[-53.53,-33.65],[-53.43,-33.5],[-53.43,-33.16],[-53.32,-33.05],[-53.26,-33.09],[-53.12,-32.79],[-53.07,-32.83],[-52.98,-32.73],[-52.9,-32.89],[-52.76,-32.87],[-52.59,-32.52],[-52.69,-32.32],[-52.64,-32.17],[-52.8,-32.27],[-52.74,-32.4],[-52.96,-32.49],[-53.07,-32.65],[-53.4,-32.58],[-53.63,-32.39],[-53.74,-32.08],[-53.98,-31.92],[-54.1,-31.93],[-54.58,-31.46],[-54.84,-31.44],[-55.01,-31.27],[-55.07,-31.33],[-55.24,-31.26],[-55.35,-31.04],[-55.58,-30.84],[-55.87,-31.07],[-56.01,-31.07],[-56.02,-30.79],[-56.82,-30.1],[-57.07,-30.09],[-57.22,-30.29],[-57.52,-30.29],[-57.64,-30.19],[-57.34,-29.99],[-57.29,-29.82],[-56.97,-29.64],[-56.59,-29.12],[-56.42,-29.07],[-56.29,-28.79],[-56.0,-28.6],[-56.02,-28.51],[-55.89,-28.48],[-55.87,-28.36],[-55.7,-28.42],[-55.67,-28.33],[-55.77,-28.24],[-55.44,-28.09],[-55.2,-27.86],[-55.04,-27.86],[-55.08,-27.79],[-54.94,-27.77],[-54.81,-27.53],[-54.68,-27.57],[-54.58,-27.45],[-54.53,-27.5],[-54.41,-27.41],[-54.28,-27.45],[-54.18,-27.27],[-54.08,-27.3],[-53.87,-27.13],[-53.81,-27.15],[-53.67,-26.94],[-53.75,-26.71],[-53.64,-26.25],[-53.59,-26.24],[-53.83,-25.97],[-53.89,-25.62],[-54.07,-25.56],[-54.1,-25.62],[-54.11,-25.52],[-54.17,-25.58],[-54.39,-25.6],[-54.43,-25.7],[-54.59,-25.59],[-54.62,-25.46],[-54.43,-25.15],[-54.44,-24.95],[-54.26,-24.36],[-54.34,-24.13],[-54.24,-24.04],[-54.67,-23.81],[-54.94,-23.96],[-55.35,-23.99],[-55.53,-23.63],[-55.53,-23.19],[-55.66,-22.88],[-55.61,-22.66],[-55.85,-22.28],[-56.21,-22.27],[-56.39,-22.08],[-56.5,-22.09],[-56.63,-22.26],[-56.7,-22.22],[-56.84,-22.3],[-57.58,-22.17],[-57.61,-22.09],[-57.8,-22.15],[-57.99,-22.09],[-57.88,-21.69],[-57.97,-21.52],[-57.85,-21.34],[-57.92,-21.28],[-57.85,-21.22],[-57.82,-20.95],[-57.93,-20.89],[-57.87,-20.83],[-57.95,-20.78],[-57.87,-20.74],[-57.92,-20.66],[-57.98,-20.7],[-58.0,-20.43],[-58.17,-20.17],[-57.87,-19.98],[-58.13,-19.76],[-57.78,-19.03],[-57.7,-19.01],[-57.56,-18.24],[-57.47,-18.22],[-57.72,-17.83],[-57.8,-17.56],[-57.73,-17.53],[-57.88,-17.45],[-58.04,-17.49],[-58.4,-17.18],[-58.47,-16.75],[-58.33,-16.49],[-58.33,-16.28],[-58.43,-16.32],[-60.17,-16.27],[-60.24,-15.47],[-60.56,-15.12],[-60.27,-14.62],[-60.49,-14.19],[-60.38,-13.99],[-60.47,-13.8],[-61.04,-13.48],[-61.84,-13.55],[-62.17,-13.12],[-62.41,-13.13],[-62.65,-12.97],[-62.78,-13.01],[-63.15,-12.62],[-63.29,-12.68],[-63.79,-12.43],[-63.95,-12.53],[-64.29,-12.5],[-64.5,-12.37],[-64.51,-12.22],[-64.69,-12.19],[-64.71,-12.11],[-64.75,-12.16],[-64.78,-12.1],[-64.83,-12.12],[-64.85,-12.01],[-65.03,-11.99],[-65.09,-11.71],[-65.25,-11.71],[-65.21,-11.53],[-65.31,-11.49],[-65.29,-11.32],[-65.36,-11.25],[-65.25,-10.99],[-65.42,-10.62],[-65.43,-10.48],[-65.29,-10.22],[-65.29,-9.85],[-65.39,-9.7],[-65.56,-9.84],[-65.76,-9.73],[-65.79,-9.79],[-65.92,-9.75],[-66.46,-9.88],[-67.17,-9.66],[-66.63,-9.93],[-67.05,-10.28],[-67.41,-10.38],[-67.71,-10.71],[-68.05,-10.67],[-68.26,-10.97],[-68.54,-11.11],[-68.71,-11.13],[-68.8,-10.99],[-69.42,-10.93],[-69.74,-10.97],[-69.94,-10.92],[-70.31,-11.07],[-70.52,-10.94],[-70.62,-11.0],[-70.62,-9.82],[-70.53,-9.71],[-70.6,-9.56],[-70.54,-9.48],[-71.23,-9.97],[-72.18,-9.99],[-72.15,-9.8],[-72.27,-9.75],[-72.25,-9.61],[-72.37,-9.49],[-73.21,-9.41],[-72.95,-9.13],[-72.94,-8.99],[-73.13,-8.71],[-73.29,-8.62],[-73.28,-8.47],[-73.54,-8.35],[-73.63,-8.02],[-73.77,-7.9],[-73.69,-7.78],[-73.99,-7.55]],[[-35.87,-8.88],[-35.9,-8.85],[-35.95,-8.88],[-35.94,-8.89],[-35.87,-8.88]],[[-36.89,-10.13],[-36.92,-10.12],[-36.9,-10.14],[-36.89,-10.13]],[[-37.19,-6.07],[-37.22,-6.05],[-37.2,-6.08],[-37.19,-6.07]],[[-37.96,-11.27],[-37.98,-11.39],[-37.95,-11.41],[-37.94,-11.4],[-37.96,-11.27]],[[-38.01,-9.54],[-37.99,-9.53],[-38.0,-9.53],[-38.01,-9.54]],[[-38.23,-10.91],[-38.18,-10.94],[-38.22,-10.89],[-38.23,-10.91]],[[-38.28,-9.08],[-38.32,-9.14],[-38.25,-9.29],[-38.24,-9.28],[-38.28,-9.08]],[[-38.58,-6.28],[-38.57,-6.33],[-38.52,-6.21],[-38.58,-6.28]],[[-38.59,-6.35],[-38.58,-6.38],[-38.53,-6.35],[-38.59,-6.35]],[[-40.55,-7.34],[-40.63,-7.43],[-40.49,-7.4],[-40.55,-7.34]],[[-40.52,-16.97],[-40.59,-17.24],[-40.58,-17.25],[-40.52,-16.97]],[[-40.68,-7.7],[-40.64,-7.61],[-40.69,-7.53],[-40.7,-7.55],[-40.68,-7.7]],[[-40.75,-17.98],[-40.86,-17.98],[-40.75,-17.99],[-40.75,-17.98]],[[-40.79,-6.51],[-40.77,-6.53],[-40.77,-6.51],[-40.79,-6.51]],[[-40.88,-15.69],[-40.83,-15.65],[-40.89,-15.68],[-40.88,-15.69]],[[-41.0,-8.4],[-41.04,-8.47],[-40.98,-8.42],[-41.0,-8.4]],[[-41.19,-4.66],[-41.18,-4.7],[-41.18,-4.66],[-41.19,-4.66]],[[-41.32,-3.19],[-41.28,-3.06],[-41.33,-3.19],[-41.32,-3.19]],[[-41.73,-20.93],[-41.71,-20.88],[-41.73,-20.86],[-41.74,-20.87],[-41.73,-20.93]],[[-41.83,-20.45],[-41.8,-20.48],[-41.82,-20.44],[-41.83,-20.45]],[[-41.82,-2.79],[-41.87,-2.88],[-41.84,-2.92],[-41.83,-2.91],[-41.82,-2.79]],[[-42.0,-3.21],[-42.07,-3.26],[-41.99,-3.22],[-42.0,-3.21]],[[-42.34,-21.56],[-42.25,-21.49],[-42.24,-21.39],[-42.26,-21.39],[-42.34,-21.56]],[[-42.29,-21.68],[-42.28,-21.69],[-42.28,-21.68],[-42.29,-21.68]],[[-42.96,-4.3],[-42.9,-4.43],[-42.89,-4.43],[-42.96,-4.3]],[[-43.02,-6.73],[-43.14,-6.78],[-43.01,-6.74],[-43.02,-6.73]],[[-43.23,-22.02],[-43.26,-22.02],[-43.24,-22.03],[-43.23,-22.02]],[[-43.44,-6.83],[-43.54,-6.81],[-43.44,-6.84],[-43.44,-6.83]],[[-43.72,-22.06],[-43.56,-22.09],[-43.46,-22.04],[-43.47,-22.03],[-43.72,-22.06]],[[-44.46,-22.26],[-44.61,-22.33],[-44.43,-22.27],[-44.46,-22.26]],[[-44.6,-1.81],[-44.59,-1.85],[-44.58,-1.81],[-44.6,-1.81]],[[-44.62,-1.79],[-44.6,-1.81],[-44.6,-1.78],[-44.62,-1.79]],[[-44.81,-22.41],[-44.74,-22.47],[-44.8,-22.38],[-45.25,-22.58],[-44.81,-22.41]],[[-45.07,-1.46],[-45.1,-1.44],[-45.1,-1.46],[-45.07,-1.46]],[[-45.44,-7.67],[-45.46,-7.68],[-45.45,-7.69],[-45.44,-7.67]],[[-45.55,-1.34],[-45.54,-1.32],[-45.56,-1.32],[-45.55,-1.34]],[[-45.79,-10.35],[-45.7,-10.27],[-45.71,-10.22],[-45.73,-10.22],[-45.79,-10.35]],[[-45.71,-22.81],[-45.73,-22.79],[-45.74,-22.82],[-45.71,-22.81]],[[-45.73,-22.72],[-45.76,-22.74],[-45.73,-22.74],[-45.73,-22.72]],[[-45.95,-15.14],[-46.04,-15.24],[-45.89,-15.14],[-45.95,-15.14]],[[-46.0,-10.26],[-45.97,-10.25],[-46.01,-10.22],[-46.0,-10.26]],[[-46.12,-15.19],[-46.08,-15.23],[-45.99,-15.01],[-46.0,-15.01],[-46.12,-15.19]],[[-46.04,-14.85],[-46.05,-14.88],[-46.03,-14.87],[-46.04,-14.85]],[[-46.09,-22.9],[-46.13,-22.88],[-46.14,-22.91],[-46.13,-22.91],[-46.09,-22.9]],[[-46.25,-13.77],[-46.25,-13.89],[-46.24,-13.9],[-46.25,-13.77]],[[-46.26,-12.57],[-46.27,-12.6],[-46.25,-12.58],[-46.26,-12.57]],[[-46.29,-13.09],[-46.32,-13.12],[-46.3,-13.13],[-46.29,-13.09]],[[-46.32,-14.81],[-46.41,-14.78],[-46.3,-14.9],[-46.32,-14.81]],[[-46.48,-8.11],[-46.49,-8.07],[-46.5,-8.11],[-46.48,-8.11]],[[-46.64,-8.34],[-46.55,-8.29],[-46.65,-8.33],[-46.64,-8.34]],[[-46.62,-9.44],[-46.72,-9.41],[-46.62,-9.45],[-46.62,-9.44]],[[-46.94,-3.37],[-46.94,-3.42],[-46.81,-3.24],[-46.94,-3.37]],[[-46.92,-8.6],[-46.9,-8.81],[-46.87,-8.52],[-46.92,-8.6]],[[-47.14,-20.59],[-47.21,-20.49],[-47.22,-20.5],[-47.14,-20.59]],[[-47.24,-20.88],[-47.21,-20.9],[-47.18,-20.79],[-47.24,-20.88]],[[-47.3,-17.59],[-47.37,-17.53],[-47.38,-17.54],[-47.3,-17.59]],[[-47.45,-16.5],[-47.42,-16.5],[-47.44,-16.49],[-47.45,-16.5]],[[-47.86,-5.32],[-47.92,-5.27],[-47.87,-5.33],[-47.86,-5.32]],[[-48.16,-5.61],[-48.16,-5.59],[-48.17,-5.59],[-48.16,-5.61]],[[-48.22,-5.73],[-48.17,-5.68],[-48.23,-5.72],[-48.22,-5.73]],[[-48.22,-20.12],[-48.24,-20.08],[-48.24,-20.13],[-48.22,-20.12]],[[-48.32,-5.19],[-48.39,-5.2],[-48.32,-5.2],[-48.32,-5.19]],[[-48.56,-27.61],[-48.64,-27.64],[-48.58,-27.83],[-48.57,-27.82],[-48.56,-27.61]],[[-48.73,-5.34],[-48.61,-5.34],[-48.58,-5.29],[-48.6,-5.28],[-48.73,-5.34]],[[-49.02,-20.17],[-49.13,-20.21],[-49.13,-20.23],[-49.02,-20.17]],[[-49.18,-12.84],[-49.25,-12.95],[-49.17,-12.84],[-49.18,-12.84]],[[-49.36,-8.47],[-49.27,-8.29],[-49.37,-8.48],[-49.36,-8.47]],[[-49.67,-23.19],[-49.7,-23.17],[-49.68,-23.2],[-49.67,-23.19]],[[-49.97,-29.22],[-49.95,-29.2],[-49.98,-29.21],[-49.97,-29.22]],[[-50.15,-9.64],[-50.1,-9.53],[-50.1,-9.52],[-50.15,-9.64]],[[-50.2,-28.49],[-50.37,-28.43],[-50.38,-28.44],[-50.2,-28.49]],[[-50.2,-12.56],[-50.23,-12.54],[-50.24,-12.59],[-50.2,-12.56]],[[-50.23,-12.47],[-50.36,-12.54],[-50.38,-12.61],[-50.37,-12.61],[-50.23,-12.47]],[[-50.35,-19.82],[-50.52,-19.82],[-50.34,-19.84],[-50.35,-19.82]],[[-50.62,-28.39],[-50.59,-28.38],[-50.76,-28.2],[-50.62,-28.39]],[[-50.69,-12.2],[-50.65,-12.28],[-50.68,-12.17],[-50.69,-12.2]],[[-50.66,-11.6],[-50.72,-11.52],[-50.69,-11.65],[-50.66,-11.6]],[[-50.98,-19.48],[-50.88,-19.48],[-51.02,-19.37],[-51.03,-19.38],[-50.98,-19.48]],[[-52.02,-18.98],[-51.41,-19.18],[-52.07,-18.94],[-52.02,-18.98]],[[-52.26,-27.29],[-52.29,-27.29],[-52.26,-27.3],[-52.26,-27.29]],[[-52.63,-0.59],[-52.58,-0.57],[-52.63,-0.56],[-52.63,-0.59]],[[-52.7,-22.63],[-52.63,-22.57],[-52.82,-22.6],[-52.7,-22.63]],[[-52.99,-18.32],[-53.06,-18.34],[-52.99,-18.33],[-52.99,-18.32]],[[-53.07,-22.62],[-53.29,-22.73],[-53.29,-22.74],[-53.07,-22.62]],[[-53.1,-17.04],[-53.22,-17.41],[-53.08,-17.04],[-53.1,-17.04]],[[-53.64,-27.22],[-53.62,-27.19],[-53.69,-27.19],[-53.64,-27.22]],[[-54.78,2.19],[-54.77,2.21],[-54.78,2.2],[-54.78,2.19]],[[-56.56,-2.18],[-56.22,-2.09],[-56.22,-2.07],[-56.56,-2.18]],[[-56.4,-2.46],[-56.46,-2.45],[-56.43,-2.51],[-56.4,-2.46]],[[-57.87,-7.77],[-57.83,-7.97],[-57.68,-8.15],[-57.68,-8.14],[-57.87,-7.77]],[[-58.17,-7.25],[-58.07,-7.41],[-58.16,-7.23],[-58.17,-7.25]],[[-58.31,-1.12],[-58.3,-1.15],[-58.28,-1.15],[-58.31,-1.12]],[[-58.44,-8.78],[-58.38,-8.77],[-58.38,-8.75],[-58.44,-8.78]],[[-58.82,-0.35],[-58.87,-0.34],[-58.83,-0.36],[-58.82,-0.35]],[[-59.19,0.26],[-58.88,-0.08],[-58.9,0.61],[-59.19,0.26]],[[-60.47,-0.8],[-60.42,-0.75],[-60.49,-0.79],[-60.47,-0.8]],[[-61.06,-0.51],[-61.1,-0.52],[-61.05,-0.53],[-61.06,-0.51]],[[-61.36,-0.63],[-61.52,-0.75],[-61.51,-0.77],[-61.36,-0.63]],[[-61.95,-8.85],[-61.81,-8.78],[-61.81,-8.77],[-61.95,-8.85]],[[-63.29,-8.0],[-63.55,-7.97],[-63.57,-8.01],[-63.56,-8.02],[-63.29,-8.0]],[[-64.88,-9.04],[-64.92,-9.05],[-64.91,-9.15],[-64.9,-9.14],[-64.88,-9.04]]],[[[-45.29,-23.59],[-45.28,-23.6],[-45.3,-23.6],[-45.29,-23.59]]],[[[-45.53,-1.23],[-45.59,-1.25],[-45.57,-1.19],[-45.53,-1.23]]],[[[-44.74,-1.51],[-44.83,-1.54],[-44.75,-1.46],[-44.74,-1.51]]],[[[-42.76,-2.56],[-42.76,-2.55],[-42.75,-2.55],[-42.76,-2.56]]],[[[-43.23,-22.84],[-43.21,-22.87],[-43.24,-22.84],[-43.23,-22.84]]],[[[-41.7,-22.42],[-41.7,-22.41],[-41.69,-22.41],[-41.7,-22.42]]],[[[-43.11,-22.77],[-43.1,-22.75],[-43.11,-22.77],[-43.11,-22.77]]],[[[-43.26,-22.81],[-43.19,-22.79],[-43.17,-22.83],[-43.17,-22.83],[-43.26,-22.81]]],[[[-44.01,-23.08],[-43.9,-23.03],[-43.79,-23.06],[-43.79,-23.06],[-44.01,-23.08]]],[[[-43.92,-23.0],[-43.92,-22.99],[-43.92,-22.99],[-43.92,-23.0]]],[[[-44.37,-23.17],[-44.23,-23.09],[-44.09,-23.18],[-44.35,-23.21],[-44.37,-23.17]]],[[[-44.6,-23.22],[-44.6,-23.21],[-44.6,-23.21],[-44.6,-23.22]]],[[[-44.73,-1.56],[-44.74,-1.54],[-44.74,-1.54],[-44.73,-1.56]]],[[[-45.02,-1.33],[-44.96,-1.28],[-44.84,-1.33],[-45.0,-1.41],[-45.02,-1.33]]],[[[-45.01,-23.76],[-45.01,-23.75],[-45.01,-23.75],[-45.01,-23.76]]],[[[-45.04,-23.53],[-45.06,-23.53],[-45.04,-23.53],[-45.04,-23.53]]],[[[-45.04,-1.35],[-45.05,-1.36],[-45.05,-1.34],[-45.04,-1.35]]],[[[-45.12,-23.81],[-45.14,-23.8],[-45.12,-23.81],[-45.12,-23.81]]],[[[-45.15,-23.57],[-45.16,-23.57],[-45.15,-23.56],[-45.15,-23.57]]],[[[-45.7,-1.22],[-45.66,-1.22],[-45.68,-1.26],[-45.7,-1.22]]],[[[-45.77,-23.86],[-45.78,-23.86],[-45.77,-23.86],[-45.77,-23.86]]],[[[-45.82,-1.15],[-45.82,-1.12],[-45.8,-1.15],[-45.82,-1.15]]],[[[-46.41,-0.97],[-46.41,-0.93],[-46.41,-0.93],[-46.41,-0.97]]],[[[-46.91,-24.38],[-46.91,-24.37],[-46.9,-24.38],[-46.91,-24.38]]],[[[-47.03,-0.71],[-47.03,-0.69],[-47.01,-0.7],[-47.03,-0.71]]],[[[-51.32,-30.78],[-51.28,-30.8],[-51.28,-30.8],[-51.3,-30.82],[-51.32,-30.78]]]]};
  // ===== REDE ASSISTENCIAL (UBSI + CASAI) com coordenadas oficiais do CNES, embutida =====
  // Formato compacto por estabelecimento: [nome, cnes, lat, lon, municipio, uf]
  let REDE_CNES = {"rede":{},"nac":[]};
  function _unpackEstab(a){ return {n:a[0], cnes:a[1], lat:a[2], lon:a[3], mun:a[4], uf:a[5]}; }

  let _leaflet=null, _layerDSEI=null, _layerPolos=null, _layerCasai=null, _layerUF=null, _layerBR=null, _mapInited=false;
  let _lastMapAutoFitKey = "";
  let _ptsZoom=null;  // pontos a enquadrar no zoom (DSEIs + CASAIs nacionais filtradas)
  let _heatMode=false; // mapa de calor de vagas ociosas
  const _BRASIL_VIEW = [[-33.5,-73.0],[5.5,-34.5]]; // enquadramento padrão (Brasil, justo)
  let _saBounds=null;        // limites de navegação (derivados da vista do Brasil)
  let _homeFlyTimer=null;    // controla reaplicação dos limites após enquadrar
  let _suppressAutoFit=false; // evita o enquadramento instantâneo brigar com a animação
  // Define os limites de navegação A PARTIR da vista atual do Brasil (quando no zoom
  // mínimo), com uma folga. Como o zoom mínimo é o mais "afastado", qualquer outro
  // zoom cabe dentro destes limites — então o mapa nunca "treme" tentando se corrigir,
  // em qualquer tamanho de tela.
  function setBrazilMaxBounds(){
    if(!_leaflet) return;
    try{
      const z=_leaflet.getZoom(), mz=_leaflet.getMinZoom();
      if(z<=mz+0.05){
        // No zoom mínimo (vista do Brasil): limites justos derivados da própria vista.
        _saBounds=_leaflet.getBounds().pad(0.12);
        _leaflet.setMaxBounds(_saBounds);
      } else if(_saBounds){
        // Com zoom maior, mantém os limites já derivados da vista do Brasil
        // (que contêm qualquer vista mais aproximada) — nunca deixa sem limite.
        _leaflet.setMaxBounds(_saBounds);
      }
    }catch(e){}
  }
  // Volta à visão do Brasil sem tremer: solta os limites, enquadra na hora (sem
  // animação concorrente) e recalcula os limites a partir da nova vista.
  function flyToBrasil(bounds){
    if(!_leaflet) return;
    try{ _leaflet.stop(); }catch(e){}
    try{ _leaflet.setMaxBounds(null); }catch(e){}
    try{ _leaflet.fitBounds(bounds,{animate:false}); }catch(e){}
    clearTimeout(_homeFlyTimer);
    _homeFlyTimer=setTimeout(setBrazilMaxBounds, 0);
  }
  function buscarLocalMapa(termo){
    if(!_leaflet) return;
    const norm=s=>txt(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
    const q=norm(termo).trim();
    if(!q){ toast("Digite o nome de um DSEI, polo ou município."); return; }
    let alvo=LMAP.dsei.find(d=>norm(d.n).includes(q)||norm(d.k).includes(q));
    if(alvo){ _leaflet.flyTo([alvo.lat,alvo.lon],6,{duration:0.6}); toast("DSEI "+alvo.n+" localizado."); return; }
    for(const d of LMAP.dsei){
      const p=polosCorrigidosPorCnes(d).find(p=>norm(p.n).includes(q));
      if(p){ _leaflet.flyTo([p.lat,p.lon],8,{duration:0.6}); toast("Polo "+p.n+" ("+d.n+") localizado."); return; }
    }
    for(const k in (REDE_CNES.rede||{})){
      const rede=REDE_CNES.rede[k];
      const ach=[...(rede.u||[]),...(rede.c||[])].find(a=>norm(a[4]||"").includes(q));
      if(ach){ _leaflet.flyTo([ach[2],ach[3]],9,{duration:0.6}); toast("Município "+(ach[4]||"")+" localizado."); return; }
    }
    toast("Não encontrei \""+termo+"\" no mapa.");
  }
  function toggleHeatMap(){
    _heatMode=!_heatMode;
    const b=$("heatBtn"); if(b){ b.classList.toggle("active",_heatMode); b.setAttribute("aria-pressed",_heatMode?"true":"false"); }
    lastMapUfKey=null; drawDSEIBubbles();
    toast(_heatMode?"Mapa de calor: cor por % de vagas ociosas.":"Mapa de calor desativado.");
  }
  let _layerUbsi=null, _layerCasaiLocal=null;
  let DSEI_BY_K = {};
  function rebuildDseiIndex(){ DSEI_BY_K = {}; (LMAP.dsei||[]).forEach(d=>{ DSEI_BY_K[d.k]=d; }); }
  rebuildDseiIndex();

  // Normaliza nome de unidade ignorando preposições (de/do/da), acentos e hífen,
  // para casar "Kaiapó de Mato Grosso" (CSV) com "Kaiapó do Mato Grosso" (mapa).
  function dseiKey(s){
    let u=txt(s).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
    u=u.replace(/^DSEI\s+/,"").replace(/^CASAI\s+/,"").replace(/\bNACIONAL\b/g," ").replace(/-/g," ");
    u=u.replace(/\b(DE|DO|DA|DOS|DAS|E)\b/g," ").replace(/\s+/g," ").trim();
    return u;
  }
  function mapNameKey(s){
    let u=txt(s).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
    u=u.replace(/\([^)]*\)/g," ");
    u=u.replace(/\b(DISTRITO|SANITARIO|ESPECIAL|INDIGENA|SAUDE|DE|DO|DA|DOS|DAS|E|TIPO|I|II|III|IV)\b/g," ");
    u=u.replace(/\b(POLO|BASE|DSEI|UBSI|UBS|UNIDADE|BASICA|POSTO)\b/g," ");
    u=u.replace(/[^A-Z0-9]+/g," ").replace(/\s+/g," ").trim();
    return u;
  }
  // Casamento de nome como PALAVRA INTEIRA (evita "ANTA" casar dentro de "CANTAGALO").
  function _wordContains(hay,needle){
    if(!hay||!needle) return false;
    return new RegExp("(^| )"+needle.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"( |$)").test(hay);
  }
  function _strongNameMatch(nk,pk){
    if(!nk||!pk) return false;
    if(nk===pk) return true;
    const shorter = nk.length<pk.length ? nk : pk;
    if(shorter.length<5) return false;            // tokens curtos só casam se idênticos
    return _wordContains(nk,pk) || _wordContains(pk,nk);
  }
  function findOfficialPoloCoord(d,p){
    const rede=REDE_CNES.rede[d.k]; if(!rede) return null;
    const poloKey=mapNameKey(p.n);
    const poloUf=txt(p.uf).toUpperCase();
    // 1ª passada: registros que são "POLO BASE" no CNES (mais confiável)
    const candidates=(rede.u||[])
      .filter(a=>/\bPOLO\b/i.test(txt(a[0])))
      .map(a=>{
        const nameKey=mapNameKey(a[0]);
        const munKey=mapNameKey(a[4]);
        const uf=txt(a[5]).toUpperCase();
        let score=0;
        if(nameKey && poloKey && (nameKey.includes(poloKey)||poloKey.includes(nameKey))) score+=100;
        if(munKey && poloKey && (munKey.includes(poloKey)||poloKey.includes(munKey))) score+=60;
        if(poloUf && uf && poloUf===uf) score+=10;
        return {a,nameKey,munKey,score};
      })
      .filter(x=>x.score>=70)
      .sort((a,b)=>b.score-a.score);
    if(candidates[0]) return candidates[0].a;
    // 2ª passada (fallback): qualquer estabelecimento (UBSI/POSTO) cujo NOME bate forte
    // com o nome do polo. Usa a coordenada da unidade que atende o polo quando não há
    // um "POLO BASE" cadastrado. Regra estrita p/ não casar nomes parecidos por acaso.
    if(!poloKey) return null;
    const fb=(rede.u||[])
      .map(a=>{
        const nameKey=mapNameKey(a[0]);
        const uf=txt(a[5]).toUpperCase();
        let score=_strongNameMatch(nameKey,poloKey)?100:0;
        if(score && poloUf && uf && poloUf===uf) score+=10;
        return {a,score};
      })
      .filter(x=>x.score>=100)
      .sort((a,b)=>b.score-a.score);
    return fb[0]?.a || null;
  }
  function polosCorrigidosPorCnes(d){
    return (d.polos||[]).map(p=>{
      const oficial=findOfficialPoloCoord(d,p);
      if(!oficial) return p;
      return Object.assign({},p,{
        lat:oficial[2],
        lon:oficial[3],
        coord_oficial:true,
        coord_fonte:"CNES",
        coord_nome:oficial[0],
        cnes:oficial[1],
        mun_cnes:oficial[4],
        uf_cnes:oficial[5]
      });
    });
  }
  function procCounts(){
    const byUf={}, byDsei={}, vagasDsei={}, ociosasDsei={};
    filtered.forEach(r=>{
      const uf=txt(r.uf).toUpperCase(); if(uf) byUf[uf]=(byUf[uf]||0)+1;
      const u=dseiKey(r.unidade);
      if(u){
        byDsei[u]=(byDsei[u]||0)+1;
        vagasDsei[u]=(vagasDsei[u]||0)+n(r.vagas_total);
        ociosasDsei[u]=(ociosasDsei[u]||0)+n(r.vagas_ociosas);
      }
    });
    return {byUf,byDsei,vagasDsei,ociosasDsei};
  }
  // Cor do mapa de calor conforme % de ociosidade do DSEI
  function heatColor(pct){
    if(pct>=60) return "#d92d3a";   // crítico (vermelho)
    if(pct>=40) return "#f2730c";   // alto (laranja)
    if(pct>=20) return "#f2b705";   // médio (amarelo)
    return "#0b8f58";               // baixo (verde)
  }

  function initLeaflet(){
    const el=$("map"); if(!el || _mapInited) return;
    if(typeof L==="undefined"){ el.innerHTML='<div role="alert" style="padding:28px 24px;text-align:center;color:#5a6b82;font-size:13px;line-height:1.5"><div style="font-size:28px;margin-bottom:8px">🌐</div><b style="color:#10243e;display:block;margin-bottom:6px">Mapa indisponível offline</b>O fundo geográfico do mapa precisa de internet para carregar.<br>Os dados, KPIs e a tabela continuam funcionando normalmente.<br><button type="button" onclick="reloadExternal&&reloadExternal()" style="margin-top:12px;background:var(--agsus-azul);color:#fff;border:0;border-radius:8px;padding:8px 16px;font-size:13px;font-weight:600;cursor:pointer">Tentar novamente</button></div>'; return; }
    _mapInited=true;
    // Limites de navegação derivados da própria vista do Brasil (ver setBrazilMaxBounds).
    // Não se define maxBounds na construção para não atrapalhar o enquadramento inicial.
    const BRASIL_BOUNDS = L.latLngBounds(_BRASIL_VIEW[0], _BRASIL_VIEW[1]);
    _leaflet=L.map(el,{
      zoomControl:true, scrollWheelZoom:true, attributionControl:true,
      minZoom:4, maxZoom:18,
      maxBoundsViscosity: 1.0,
      worldCopyJump:false
    });
    _leaflet.fitBounds(BRASIL_BOUNDS);
    // Trava o zoom mínimo no nível que enquadra o Brasil (impede afastar e ver outros
    // países) e define os limites de pan a partir dessa vista.
    _leaflet.whenReady(function(){
      try{
        _leaflet.setMinZoom(_leaflet.getZoom());
        setBrazilMaxBounds();
      }catch(e){}
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{
      maxZoom:18, attribution:'© OpenStreetMap'
    }).addTo(_leaflet);
    _layerBR=L.layerGroup().addTo(_leaflet);     // contorno do Brasil (fundo)
    _layerUF=L.layerGroup().addTo(_leaflet);     // estados destacados
    _layerDSEI=L.layerGroup().addTo(_leaflet);
    _layerPolos=L.layerGroup().addTo(_leaflet);
    _layerCasaiLocal=L.layerGroup().addTo(_leaflet);   // CASAIs do DSEI/locais (drill-down)
    _layerUbsi=L.layerGroup().addTo(_leaflet);         // UBSIs (drill-down)
    _layerCasai=L.layerGroup().addTo(_leaflet);        // CASAI Nacional (sempre)
    drawBrasilOutline();

    // Botão "ver Brasil inteiro" dentro do mapa (controle Leaflet, canto superior direito)
    const HomeCtl = L.Control.extend({
      options:{ position:"topright" },
      onAdd:function(){
        const wrap=L.DomUtil.create("div","");
        wrap.style.cssText="display:flex;gap:6px;";
        const b=L.DomUtil.create("button","",wrap);
        b.type="button"; b.title="Voltar à visão do Brasil inteiro";
        b.innerHTML='🗺️ Brasil';
        b.style.cssText="background:#fff;border:1px solid #bcd;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:600;color:#22577a;cursor:pointer;box-shadow:0 2px 8px rgba(15,35,60,.18);";
        L.DomEvent.on(b,"click",function(e){ L.DomEvent.stop(e); mapVoltar(); });
        const h=L.DomUtil.create("button","",wrap);
        h.id="heatBtn"; h.type="button"; h.title="Mapa de calor: cor por % de vagas ociosas"; h.setAttribute("aria-pressed","false");
        h.innerHTML='🔥 Calor';
        h.style.cssText="background:#fff;border:1px solid #bcd;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:600;color:#a3322b;cursor:pointer;box-shadow:0 2px 8px rgba(15,35,60,.18);";
        L.DomEvent.on(h,"click",function(e){ L.DomEvent.stop(e); toggleHeatMap(); });
        L.DomEvent.disableClickPropagation(wrap);
        return wrap;
      }
    });
    _leaflet.addControl(new HomeCtl());

    // Legenda fixa dentro do mapa (controle Leaflet, canto inferior esquerdo)
    const LegendCtl = L.Control.extend({
      options:{ position:"bottomleft" },
      onAdd:function(){
        const d=L.DomUtil.create("div","");
        d.id="mapLegendBox";
        d.style.cssText="background:rgba(255,255,255,.94);border:1px solid #d7e5f2;border-radius:10px;padding:8px 10px;font-size:11px;font-weight:600;color:#43566d;box-shadow:0 2px 10px rgba(15,35,60,.12);line-height:1.7;max-width:230px;";
        L.DomEvent.disableClickPropagation(d);
        return d;
      }
    });
    _leaflet.addControl(new LegendCtl());
  }

  function scheduleMapResize(delay=80){
    clearTimeout(window.__mapResizeTimer);
    window.__mapResizeTimer = setTimeout(()=>{
      try{ _leaflet?.invalidateSize?.({ animate:false, pan:false }); }catch(e){}
      setBrazilMaxBounds(); // re-deriva os limites após mudar o tamanho do mapa
    }, delay);
  }

  // Contorno do Brasil (linha tracejada ao redor do território) — desenhado uma vez
  function drawBrasilOutline(){
    if(!_leaflet || !_layerBR) return;
    _layerBR.clearLayers();
    try{
      // divisas internas dos estados, bem sutis (referência)
      L.geoJSON(UF_GEO,{
        style:{ color:"#5b7fa6", weight:0.6, opacity:0.35, fill:false, interactive:false }
      }).addTo(_layerBR);
      // contorno externo do Brasil, linha forte e visível
      L.geoJSON(BR_OUTLINE,{
        style:{ color:"#0d3b66", weight:2.6, opacity:0.9, fill:false, interactive:false }
      }).addTo(_layerBR);
    }catch(e){}
  }

  // Destacar os estados contemplados por um DSEI (preenchimento leve + borda)
  function highlightUFs(ufs){
    if(!_leaflet || !_layerUF) return;
    _layerUF.clearLayers();
    if(!ufs || !ufs.length) return;
    const set=new Set(ufs);
    try{
      L.geoJSON(UF_GEO,{
        filter:f=>set.has(f.properties.uf),
        style:{ color:"#1f6f4a", weight:2, opacity:0.9, fillColor:"#2e8b57", fillOpacity:0.18, interactive:false }
      }).addTo(_layerUF);
    }catch(e){}
  }

  // Nível 1: bolhas dos DSEIs
  function drawDSEIBubbles(){
    if(!_leaflet) return;
    _layerDSEI.clearLayers(); _layerPolos.clearLayers();
    if(_layerUbsi) _layerUbsi.clearLayers();
    if(_layerCasaiLocal) _layerCasaiLocal.clearLayers();
    if(_layerUF) _layerUF.clearLayers();   // visão Brasil: nenhum estado destacado
    const {byDsei,vagasDsei,ociosasDsei}=procCounts();
    const popMax=Math.max(...LMAP.dsei.map(d=>d.pop||0))||1;
    const filtroAtivo = hasActiveFilter();
    const heatOn = !!_heatMode;
    const ptsVisiveis = [];   // para enquadrar o zoom nos DSEIs filtrados
    _ptsZoom = ptsVisiveis;   // compartilha com drawCasai (adiciona nacionais visíveis)
    // desempilhar bolhas na mesma sede (ex.: Yanomami + Leste de Roraima em Boa Vista)
    const seen={};
    LMAP.dsei.forEach(d=>{
      const dk=dseiKey(d.k);
      const nproc=byDsei[dk]||0, hp=nproc>0;
      // Com filtro ativo, mostrar SOMENTE os DSEIs que tem processos no resultado filtrado.
      if(filtroAtivo && !hp) return;
      const vagas=vagasDsei[dk]||0, ociosas=ociosasDsei[dk]||0;
      const pctOcio = vagas>0 ? Math.round(ociosas/vagas*100) : 0;
      const key=d.lat.toFixed(2)+","+d.lon.toFixed(2);
      let lat=d.lat, lon=d.lon;
      if(seen[key]!==undefined){ const a=seen[key]*1.1; lat+=0.55*Math.cos(a); lon+=0.55*Math.sin(a); seen[key]++; }
      else seen[key]=1;
      const r=7+18*Math.sqrt((d.pop||0)/popMax);
      ptsVisiveis.push([lat,lon]);
      // Cor: modo calor usa % de ociosidade; modo normal usa verde(tem proc)/azul(sem)
      const fillC = heatOn ? (hp?heatColor(pctOcio):"#cfd8e3") : (hp?"#0b8f58":"#5b9bd5");
      const strokeC = heatOn ? (hp?heatColor(pctOcio):"#9fb0c4") : (hp?"#f2b705":"#1f6f4a");
      const m=L.circleMarker([lat,lon],{
        radius:r, color:strokeC, weight:hp?3:1.5,
        fillColor:fillC, fillOpacity:heatOn?0.82:0.7
      });
      const heatLine = heatOn && hp ? `<br><b style="color:${heatColor(pctOcio)}">Ociosidade: ${pctOcio}%</b> (${fmt(ociosas)} de ${fmt(vagas)} vagas)` : (hp?`<br>Vagas ociosas: ${fmt(ociosas)} de ${fmt(vagas)}`:"");
      m.bindTooltip(`<b>DSEI ${esc(d.n)}</b><br>População do DSEI: ${fmt(d.pop)} indígenas<br>Polos base: ${(d.polos||[]).length}<br>Estados: ${(d.ufs||[d.sedeuf]).join(", ")}<br>Processos seletivos: ${nproc}${heatLine}<br><i>clique para ver os polos base</i>`,{direction:"top"});
      m.on("click",()=>{
        const s=$("tableSearch"); if(s) s.value=d.n; applyFilters();
        highlightUFs(d.ufs);
        drawPolos(d);
        _leaflet.flyToBounds(polosBounds(d), {padding:[40,40], maxZoom:8, duration:0.6});
        { const _b=$("drillBackBtn"); if(_b) _b.style.display="inline-flex"; }
        const ufTxt=(d.ufs&&d.ufs.length)? " ("+d.ufs.join(", ")+")":"";
        toast("DSEI "+d.n+ufTxt+": exibindo polos base.");
      });
      _layerDSEI.addLayer(m);
    });
    drawCasai();
    { const _b=$("drillBackBtn"); if(_b) _b.style.display="none"; }
    // Zoom automático: com filtro ativo, enquadra apenas os DSEIs/CASAIs filtrados.
    // Sem filtro, volta para a visão geral do Brasil.
    const autoFitKey = (filtroAtivo ? "F|" : "A|") + ptsVisiveis
      .map(p=>p.map(v=>Number(v).toFixed(4)).join(","))
      .join("|");
    if(autoFitKey !== _lastMapAutoFitKey){
      _lastMapAutoFitKey = autoFitKey;
      if(!_suppressAutoFit) try{
        if(filtroAtivo && ptsVisiveis.length){
        if(ptsVisiveis.length===1){
          _leaflet.setView(ptsVisiveis[0], 7, {animate:false});
        } else {
          _leaflet.fitBounds(L.latLngBounds(ptsVisiveis), {padding:[60,60], maxZoom:7, animate:false});
        }
        } else if(!filtroAtivo){
          _leaflet.fitBounds(L.latLngBounds(_BRASIL_VIEW[0],_BRASIL_VIEW[1]), {animate:false});
        }
      }catch(e){}
    }
    _ptsZoom=null;
    syncMapLevelUI();
  }

  // CASAI Nacionais (Brasília e São Paulo) — pontos especiais (losango roxo)
  function drawCasai(){
    if(!_leaflet || !_layerCasai) return;
    _layerCasai.clearLayers();
    const {byDsei}=procCounts();
    // CASAIs nacionais: desenhar DIRETO de REDE_CNES.nac (fonte de verdade), não da lista fixa do LMAP
    const ufNum2sigla={'53':'DF','35':'SP','51':'MT','50':'MS','52':'GO'};
    const filtroAtivoC = hasActiveFilter();
    (REDE_CNES.nac||[]).forEach(a=>{
      const nome=a[0], lat=a[2], lon=a[3], cidade=a[4]||'';
      const uf = ufNum2sigla[String(a[5])] || String(a[5]||'');
      const c={n:nome, cidade:cidade, uf:uf};
      const nproc=byDsei[dseiKey(c.n)]||0;
      // Com filtro ativo, só exibir a CASAI nacional se ela aparecer no resultado filtrado.
      if(filtroAtivoC && nproc===0) return;
      // adiciona ao enquadramento do zoom (quando filtrado)
      if(_ptsZoom) _ptsZoom.push([lat,lon]);
      const aprox = /≈|aproxim|por endere/i.test(nome);
      const fonteCoord = aprox? '≈ posição aproximada por endereço' : '📍 coordenada oficial do CNES';
      const mk=L.marker([lat,lon],{
        icon: L.divIcon({
          className:"",
          html:'<div style="width:16px;height:16px;background:#7b2ff7;border:2px solid #fff;transform:rotate(45deg);box-shadow:0 1px 4px rgba(0,0,0,.4);"></div>',
          iconSize:[16,16], iconAnchor:[8,8]
        })
      });
      mk.bindTooltip(`<b>${esc(c.n)}</b><br>${esc(c.cidade)} – ${c.uf}<br>Processos seletivos: ${nproc}<br><i>clique para filtrar</i>`,{direction:"top"});
      mk.bindPopup(`<b>${esc(c.n)}</b><br>Casa de Saúde Indígena (referência nacional)<br>${esc(c.cidade)} – ${c.uf}<br>Processos seletivos: ${nproc}<br><span style="font-size:10px;color:#6b7d92">${fonteCoord}</span>`);
      mk.on("click",()=>{
        const termo="CASAI "+c.cidade;
        const s=$("tableSearch"); if(s) s.value=termo; applyFilters();
        toast(esc(c.n)+": "+nproc+" processo(s).");
      });
      _layerCasai.addLayer(mk);
    });
  }

  function polosBounds(d){
    let pts=[[d.lat,d.lon]].concat(polosCorrigidosPorCnes(d).map(p=>[p.lat,p.lon]));
    const rede=REDE_CNES.rede[d.k];
    if(rede){
      (rede.c||[]).forEach(a=>pts.push([a[2],a[3]]));
    }
    return L.latLngBounds(pts);
  }

  // Nível 2 (complemento): CASAIs locais do DSEI (coordenadas oficiais do CNES)
  function _spread(items){
    // desempilha estabelecimentos na mesma coordenada
    const seen={};
    return items.map(it=>{
      const key=it.lat.toFixed(3)+","+it.lon.toFixed(3);
      let lat=it.lat, lon=it.lon;
      if(seen[key]!==undefined){
        const i=seen[key], ang=i*2.399963, raio=0.05+0.02*Math.floor(i/8);
        lat+=raio*Math.cos(ang); lon+=raio*Math.sin(ang); seen[key]++;
      } else seen[key]=1;
      return Object.assign({}, it, {_lat:lat,_lon:lon});
    });
  }
  function drawRedeAssistencial(d){
    if(!_leaflet) return;
    if(_layerUbsi) _layerUbsi.clearLayers();
    if(_layerCasaiLocal) _layerCasaiLocal.clearLayers();
    const rede = REDE_CNES.rede[d.k];
    if(!rede) return;

    // CASAIs locais/DSEI — losango verde-escuro
    const casais=_spread((rede.c||[]).map(_unpackEstab));
    casais.forEach(c=>{
      const mk=L.marker([c._lat,c._lon],{ icon:L.divIcon({
        className:"",
        html:'<div style="width:14px;height:14px;background:#d92d3a;border:2px solid #fff;transform:rotate(45deg);box-shadow:0 1px 3px rgba(0,0,0,.4);"></div>',
        iconSize:[14,14], iconAnchor:[7,7]
      })});
      mk.bindTooltip(`<b>CASAI</b> ${esc(c.n)}<br>${esc(c.mun||"")}${c.uf?(" – "+c.uf):""}<br><i>clique para filtrar processos</i>`,{direction:"top"});
      mk.bindPopup(`<b>CASAI — Casa de Saúde Indígena</b><br>${esc(c.n)}<br>${esc(c.mun||"")}${c.uf?(" – "+c.uf):""}<br>CNES: ${esc(c.cnes||"-")}<br><span style="font-size:10px;color:#6b7d92">📍 coordenada oficial do CNES</span>`);
      mk.on("click",()=>{ const s=$("tableSearch"); if(s){ s.value=d.n; applyFilters(); } toast("Filtrando processos do DSEI "+d.n+"."); });
      _layerCasaiLocal.addLayer(mk);
    });
  }

  // Nível 2: polos base de um DSEI
  function drawPolos(d){
    if(!_leaflet) return;
    _layerPolos.clearLayers();
    drawRedeAssistencial(d);
    const polosBase = polosCorrigidosPorCnes(d);
    const sede=polosBase.find(p=>!p.fora)||polosBase[0];
    // desempilhar polos na mesma coordenada (vários polos no mesmo município)
    const seen={};
    const polos=polosBase.map(p=>{
      const key=p.lat.toFixed(3)+","+p.lon.toFixed(3);
      let lat=p.lat, lon=p.lon;
      if(seen[key]!==undefined){
        const i=seen[key], ang=i*2.399963; // ângulo áureo p/ espalhar uniforme
        const raio=0.06+0.02*Math.floor(i/8);
        lat+=raio*Math.cos(ang); lon+=raio*Math.sin(ang);
        seen[key]++;
      } else seen[key]=1;
      return Object.assign({}, p, {_lat:lat,_lon:lon});
    });
    polos.forEach(p=>{
      if(p.fora && sede){
        L.polyline([[sede.lat,sede.lon],[p._lat,p._lon]],{color:"#e8730c",weight:1.6,dashArray:"6,5",opacity:0.8}).addTo(_layerPolos);
      }
      const mk=L.circleMarker([p._lat,p._lon],{
        radius:p.fora?6:5, color:"#fff", weight:1.5,
        fillColor:p.fora?"#e8730c":"#1d4e89", fillOpacity:0.95
      });
      mk.bindTooltip(esc(p.n)+(p.fora?` <i>(${p.uf}, fora da sede)</i>`:""),{direction:"top"});
      const fonte = p.coord_oficial
        ? `📍 coordenada oficial do CNES<br>CNES: ${esc(p.cnes||"-")}${p.coord_nome?`<br>Registro: ${esc(p.coord_nome)}`:""}`
        : "≈ posição aproximada (centro do município)";
      mk.bindPopup(`<b>Polo base: ${esc(p.n)}</b><br>UF: ${p.uf}<br>População do polo: ${fmt(p.p)} indígenas${p.fora?'<br><i>Pertence ao DSEI '+esc(d.n)+', em outro estado</i>':''}<br><span style="font-size:10px;color:#6b7d92">${fonte}</span>`);
      _layerPolos.addLayer(mk);
    });
    syncMapLevelUI();
  }

  // compat: chamada antiga renderMap() agora inicializa/atualiza o Leaflet
  function renderMap(){
    if(currentView!=="dashboard") return;
    initLeaflet();
    if(!_leaflet) return;
    scheduleMapResize(60);
    drawDSEIBubbles();
  }

  function mapVoltar(){
    const s=$("tableSearch"); if(s) s.value="";
    filterState.uf=new Set(); lastMapUfKey=null; applyFilters();
    if(_leaflet){ _layerPolos.clearLayers(); if(_layerUbsi)_layerUbsi.clearLayers(); if(_layerCasaiLocal)_layerCasaiLocal.clearLayers(); if(_layerUF) _layerUF.clearLayers(); flyToBrasil(L.latLngBounds(_BRASIL_VIEW[0],_BRASIL_VIEW[1]),{duration:0.6}); }
    { const _b=$("drillBackBtn"); if(_b) _b.style.display="none"; }
    _suppressAutoFit=true;          // a câmera é controlada pelo flyToBrasil acima
    try{ drawDSEIBubbles(); } finally { _suppressAutoFit=false; }
    toast("Visão geral do Brasil.");
  }

  // Botão dentro do mapa: enquadra TODOS os DSEIs (Brasil inteiro), sem mexer nos filtros
  function mapVerBrasil(){
    if(!_leaflet) return;
    const pts=LMAP.dsei.map(d=>[d.lat,d.lon]).concat((REDE_CNES.nac||[]).map(a=>[a[2],a[3]]));
    try{ flyToBrasil(L.latLngBounds(pts),{padding:[30,30],duration:0.6}); }
    catch(e){ flyToBrasil(L.latLngBounds(_BRASIL_VIEW[0],_BRASIL_VIEW[1]),{duration:0.6}); }
  }

  // ===== IMPORTAÇÃO DA REDE ASSISTENCIAL (UBSI + CASAI) DO JSON v4 =====
  // As coordenadas oficiais do CNES no JSON v4 estão nos estabelecimentos (UBSI/CASAI),
  // não nos polos base (que vêm com latitude/longitude nulas). Esta função lê o JSON v4,
  // agrupa os estabelecimentos por DSEI e atualiza REDE_CNES nesta sessão.
  function _dseiKeyNorm(s){
    let u=txt(s).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
    u=u.replace(/^DSEI\s+/,"").replace(/^CASAI\s+/,"").replace(/\bNACIONAL\b/g," ").replace(/-/g," ");
    u=u.replace(/\b(DE|DO|DA|DOS|DAS|E)\b/g," ").replace(/\s+/g," ").trim();
    return u;
  }
  function _redeFromV4(json){
    // mapa: chave normalizada do DSEI -> k original do mapa
    const keyToK={}; LMAP.dsei.forEach(d=>{ keyToK[_dseiKeyNorm(d.k)]=d.k; });
    const rede={}; const nac=[];
    let nUbsi=0, nCasai=0, semDsei=0;
    const okLoc=e=>{ const l=e&&e.localizacao; return l && typeof l.latitude==="number" && typeof l.longitude==="number"; };
    const pack=e=>[e.nome, e.cnes, +e.localizacao.latitude.toFixed(6), +e.localizacao.longitude.toFixed(6), e.municipio, e.uf];
    const add=(dseiNome,e,tipo)=>{
      const k=keyToK[_dseiKeyNorm(dseiNome)];
      if(!k){ semDsei++; return; }
      if(!rede[k]) rede[k]={u:[],c:[]};
      if(tipo==="UBSI"){ rede[k].u.push(pack(e)); nUbsi++; }
      else { rede[k].c.push(pack(e)); nCasai++; }
    };
    (json.ubsis_amostra_por_dsei||[]).forEach(b=>(b.ubsis||[]).forEach(e=>{ if(okLoc(e)) add(b.dsei,e,"UBSI"); }));
    (json.casais_dsei_ou_local_por_dsei||[]).forEach(b=>(b.casais||[]).forEach(e=>{ if(okLoc(e)) add(b.dsei,e,"CASAI"); }));
    (json.casais_nacionais||[]).forEach(e=>{ if(okLoc(e)) nac.push(pack(e)); });
    return {rede, nac, nUbsi, nCasai, semDsei};
  }

  function _parseCnesTextarea(){
    const raw=($("cfgCnesJson")&&$("cfgCnesJson").value||"").trim();
    if(!raw) throw new Error("Cole o conteúdo do JSON v4 primeiro.");
    let json;
    try{ json=JSON.parse(raw); }catch(e){ throw new Error("O texto colado não é um JSON válido."); }
    if(!json.dseis && !json.ubsis_amostra_por_dsei && !json.casais_dsei_ou_local_por_dsei)
      throw new Error("JSON sem as chaves esperadas (dseis / ubsis_amostra_por_dsei / casais_dsei_ou_local_por_dsei) — confira se é o arquivo v4 correto.");
    return json;
  }

  function previewCnesCoords(){
    const box=$("cnesImportResumo");
    try{
      const json=_parseCnesTextarea();
      const {nUbsi, nCasai, nac, semDsei}=_redeFromV4(json);
      if(box){
        box.style.display="block";
        box.style.background="#f0f7ff"; box.style.borderColor="#d7e5f2"; box.style.color="#234";
        box.innerHTML=`<b>Pré-visualização:</b> o arquivo traz <b>${nUbsi}</b> UBSIs e <b>${nCasai}</b> CASAIs de DSEI/locais com coordenada oficial do CNES, além de <b>${nac.length}</b> CASAI(s) nacional(is). `+
          (semDsei? `(${semDsei} estabelecimento(s) sem DSEI reconhecido foram ignorados.) `:``)+
          `Clique em <b>Aplicar ao mapa</b> para usar estes estabelecimentos no drill-down dos DSEIs.`;
      }
    }catch(e){
      if(box){ box.style.display="block"; box.style.background="#fff3f3"; box.style.borderColor="#f0c0c0"; box.style.color="#a02020"; box.textContent=e.message; }
    }
  }

  async function aplicarCnesCoords(){
    const box=$("cnesImportResumo");
    try{
      const json=_parseCnesTextarea();
      const {rede, nac, nUbsi, nCasai}=_redeFromV4(json);
      // Substitui a rede em memória e persiste no Supabase para os próximos acessos.
      REDE_CNES.rede = rede;
      REDE_CNES.nac = nac;
      const savedOnSupabase = await saveMapaConfigToSupabase({ silent:true });
      // redesenhar: visão Brasil e CASAIs nacionais
      if(_leaflet){
        if(_layerPolos)_layerPolos.clearLayers();
        if(_layerUbsi)_layerUbsi.clearLayers();
        if(_layerCasaiLocal)_layerCasaiLocal.clearLayers();
        if(_layerUF)_layerUF.clearLayers();
        drawDSEIBubbles();
      }
      if(box){
        box.style.display="block"; box.style.background="#edfaf0"; box.style.borderColor="#bfe6cd"; box.style.color="#16603a";
        box.innerHTML=`<b>Rede assistencial aplicada${savedOnSupabase ? " e salva no Supabase" : ""}.</b> ${nUbsi} UBSIs e ${nCasai} CASAIs de DSEI/locais com coordenada oficial do CNES disponíveis no drill-down. `+
          `<br><i>Clique num DSEI no mapa para ver as unidades.</i>`;
      }
      toast(savedOnSupabase ? "Rede do CNES aplicada e salva ("+nUbsi+" UBSIs, "+nCasai+" CASAIs)." : "Rede aplicada nesta tela, mas não foi salva no Supabase.", savedOnSupabase ? "ok" : "warn");
    }catch(e){
      if(box){ box.style.display="block"; box.style.background="#fff3f3"; box.style.borderColor="#f0c0c0"; box.style.color="#a02020"; box.textContent=e.message; }
    }
  }

  function syncMapLevelUI(){
    const showingPolos = (_layerPolos && _layerPolos.getLayers().length>0)
      || (_layerCasaiLocal && _layerCasaiLocal.getLayers().length>0);
    const box=$("mapLegendBox");
    if(box){
      const dot=(c)=>`<span style="width:12px;height:12px;border-radius:50%;background:${c};border:1.5px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.15);display:inline-block;vertical-align:middle;margin-right:6px;"></span>`;
      const losango=(c)=>`<span style="width:11px;height:11px;background:${c};border:1.5px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.2);display:inline-block;transform:rotate(45deg);vertical-align:middle;margin-right:7px;margin-left:1px;"></span>`;
      const tracejado='<span style="border-top:2.5px dashed #e8730c;width:18px;display:inline-block;vertical-align:middle;margin-right:6px;"></span>';
      const quadUF='<span style="width:12px;height:12px;background:#2e8b57;opacity:.45;border:1.5px solid #1f6f4a;display:inline-block;vertical-align:middle;margin-right:6px;"></span>';
      box.innerHTML = showingPolos
        ? `<b style="color:#22577a">Polos base do DSEI</b><br>${dot('#1d4e89')}polo base<br>${dot('#e8730c')}polo em outro estado<br>${losango('#d92d3a')}CASAI (Casa de Saúde)<br>${tracejado}ligação ao DSEI<br>${quadUF}estado atendido`
        : `<b style="color:#22577a">Legenda</b><br>${dot('#5b9bd5')}DSEI (tamanho = nº de indígenas)<br>${dot('#0b8f58')}DSEI com processo ativo<br>${losango('#7b2ff7')}CASAI Nacional`;
    }
    const lgDsei=$("mapLegendDsei");
    if(lgDsei) lgDsei.innerHTML = showingPolos
      ? '<span style="width:11px;height:11px;border-radius:50%;background:#1d4e89;display:inline-block;"></span> polo base &nbsp; <span style="width:11px;height:11px;border-radius:50%;background:#e8730c;display:inline-block;"></span> polo em outro estado'
      : '<span style="width:11px;height:11px;border-radius:50%;background:#5b9bd5;display:inline-block;"></span> DSEI &nbsp; <span style="width:11px;height:11px;border-radius:50%;background:#0b8f58;display:inline-block;"></span> com processo';
  }


  function renderRisks(){
    const critical=filtered.filter(isRiscoAtivo).slice(0,30);
    $("riskList").innerHTML=critical.map(r=>{ const isHigh=low(r.risco)==="alto"; return `<div class="risk-item"><div class="top-line"><span>${esc(r.edital||"-")}</span><span class="chip ${isHigh?"red":"yellow"}">${esc(r.risco||"-")}</span></div><small>${esc(r.etapa||"Etapa não informada")} <span style="float:right">${esc(r.unidade||"")}</span></small></div>`; }).join("")||`<div class="alert">Nenhum processo crítico com os filtros atuais.</div>`;
  }

  function statusChip(status){ const l=low(status); const cls=l.includes("conclu")?"green":l.includes("andamento")?"blue":l.includes("elabora")?"cyan":l.includes("cancel")?"red":"gray"; return `<span class="chip ${cls}">${esc(status||"-")}</span>`; }
  function riscoChip(risco){ const l=low(risco); const cls=l==="alto"?"red":(l==="médio"||l==="medio")?"yellow":"green"; return `<span class="chip ${cls}">${esc(risco||"-")}</span>`; }
  function shouldShowObsToggle(value){ return txt(value).length>180; }
  function toggleObs(button){ const cell=button.closest(".obs-cell"); if(!cell) return; const text=cell.querySelector(".obs"); if(!text) return; const expanded=text.classList.toggle("expanded"); button.textContent=expanded?"Ver menos":"Ver mais"; button.setAttribute("aria-expanded",expanded?"true":"false"); }

  // ── Definição de colunas configuráveis ──────────────────────────────────
  const TABLE_COLS = [
    { key:"unidade",     label:"Unidade",       default:true  },
    { key:"edital",      label:"Edital",        default:true  },
    { key:"data_inicio", label:"Início",        default:true  },
    { key:"data_fim",    label:"Encerramento",  default:true  },
    { key:"vagas_total", label:"Vagas",         default:true, num:true },
    { key:"contratados", label:"Contratados",   default:true, num:true },
    { key:"vagas_ociosas",label:"Ociosas",      default:true, num:true },
    { key:"status",      label:"Status",        default:true  },
    { key:"etapa",       label:"Etapa",         default:true  },
    { key:"risco",       label:"Risco",         default:true  },
    { key:"observacoes", label:"Observações",   default:true  },
  ];
  let visibleCols = null;

  function loadVisibleCols(){
    try{
      const saved = localStorage.getItem("agsus_visible_cols_v1");
      if(saved) return new Set(JSON.parse(saved));
    }catch(e){}
    return new Set(TABLE_COLS.filter(c=>c.default).map(c=>c.key));
  }
  function saveVisibleCols(){ try{ localStorage.setItem("agsus_visible_cols_v1", JSON.stringify([...visibleCols])); }catch(e){} }

  function buildColMenu(){
    if(!visibleCols) visibleCols = loadVisibleCols();
    const menu = $("colToggleMenu"); if(!menu) return;
    const items = TABLE_COLS.map(c=>`
      <label class="col-toggle-item">
        <input type="checkbox" ${visibleCols.has(c.key)?"checked":""} onchange="toggleCol('${c.key}',this.checked)">
        ${esc(c.label)}
      </label>`).join("");
    // preservar o header
    const header = menu.querySelector("div");
    menu.innerHTML = "";
    if(header) menu.appendChild(header);
    menu.insertAdjacentHTML("beforeend", items);
  }

  function toggleCol(key, checked){
    if(!visibleCols) visibleCols = loadVisibleCols();
    if(checked) visibleCols.add(key); else visibleCols.delete(key);
    if(visibleCols.size === 0){ visibleCols.add(key); return; } // mínimo 1
    saveVisibleCols(); renderTable();
  }

  function toggleColMenu(){
    buildColMenu();
    const menu = $("colToggleMenu");
    if(menu){ menu.classList.toggle("open");
      if(menu.classList.contains("open")){
        const close=(e)=>{ if(!e.target.closest(".col-toggle-wrap")){ menu.classList.remove("open"); document.removeEventListener("click",close); } };
        setTimeout(()=>document.addEventListener("click",close),0);
      }
    }
  }

  // ── Alerta de encerramento próximo ──────────────────────────────────────
  function daysUntil(dateStr){
    if(!dateStr) return null;
    // Parseia 'YYYY-MM-DD' como data LOCAL (evita erro de fuso: Date.parse trata como UTC).
    const m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
    let target;
    if(m){ target = new Date(Number(m[1]), Number(m[2])-1, Number(m[3])); }
    else { const t = Date.parse(dateStr); if(!Number.isFinite(t)) return null; target = new Date(t); }
    const now = new Date(); const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((target - today) / (1000*60*60*24));
  }

  function expiryBadge(r){
    if(["cancelado","cancelada"].includes(low(r.status))) return `<span class="expiry-badge done"><i class="fa-solid fa-ban"></i> Cancelado</span>`;
    if(["concluído","concluido"].includes(low(r.status))) return `<span class="expiry-badge done"><i class="fa-solid fa-check"></i> Concluído</span>`;
    if(!r.data_fim) return "";
    const days = daysUntil(r.data_fim);
    if(days === null) return "";
    if(days < 0)  return `<span class="expiry-badge done">Encerrado</span>`;
    if(days <= 7)  return `<span class="expiry-badge crit"><i class="fa-solid fa-fire"></i> ${days}d</span>`;
    if(days <= 30) return `<span class="expiry-badge warn"><i class="fa-solid fa-clock"></i> ${days}d</span>`;
    return "";
  }

  function rowExpiryClass(r){
    if(isEncerrado(r)) return "";
    const days = daysUntil(r.data_fim);
    if(days === null) return "";
    if(days <= 7)  return "row-ending-critical";
    if(days <= 30) return "row-ending-soon";
    return "";
  }

  // ── Pills de filtros ativos ──────────────────────────────────────────────
  function renderActiveFilters(){
    const bar = $("activeFiltersBar"); if(!bar) return;
    const searchQ = txt($("tableSearch")?.value);
    const pills = [];
    FILTER_CONFIG.forEach(cfg=>{
      const selected = Array.from(filterState[cfg.field]||[]);
      selected.forEach(v=>{
        pills.push(`<span class="filter-pill">${esc(cfg.label)}: ${esc(v)}<button onclick="removeFilterPill('${attr(cfg.field)}','${attr(v)}')" title="Remover filtro" aria-label="Remover ${esc(v)}">×</button></span>`);
      });
    });
    if(searchQ) pills.push(`<span class="filter-pill"><i class="fa-solid fa-magnifying-glass" style="font-size:10px;"></i> "${esc(searchQ)}"<button onclick="clearSearchPill()" title="Limpar busca">×</button></span>`);
    if(hideClosed) pills.push(`<span class="filter-pill" style="background:#eef2f7;border-color:#d5dfec;color:#334155"><i class="fa-solid fa-eye-slash" style="font-size:10px;"></i> Encerrados ocultos<button onclick="toggleHideClosed()" title="Mostrar encerrados">×</button></span>`);
    if(!pills.length){ bar.classList.add("hidden"); bar.innerHTML=""; return; }
    bar.classList.remove("hidden");
    bar.innerHTML = pills.join("") + `<button class="filters-clear-all" onclick="clearFilters()"><i class="fa-solid fa-xmark"></i> Limpar todos</button>`;
  }

  function removeFilterPill(field,value){
    const selected = filterState[field]||new Set();
    selected.delete(value); filterState[field]=selected;
    applyFilterStateChange();
  }

  function clearSearchPill(){
    const el=$("tableSearch"); if(el) el.value="";
    applyFilters();
  }

  function renderTable(){
    if(!visibleCols) visibleCols = loadVisibleCols();
    const detailRows=filtered; const totalRows=rows;
    renderSortIndicators();
    renderActiveFilters();
    const sortText=tableSort.field?` Ordenação: ${tableSort.direction==="asc"?"crescente":"decrescente"}.`:" Clique nos cabeçalhos para ordenar.";
    $("tableMeta").textContent=`Exibindo ${fmt(detailRows.length)} de ${fmt(totalRows.length)} registros.${sortText}`;

    // sync cabeçalhos
    const thead = document.querySelector(".details-table thead tr");
    if(thead){
      const allTh = [...thead.querySelectorAll("th[data-sort-field]")];
      allTh.forEach(th=>{ th.style.display = visibleCols.has(th.dataset.sortField) ? "" : "none"; });
    }

    $("monitorRows").innerHTML=detailRows.map(r=>{
      const link=safeUrl(r.link_edital);
      const edital=link?`<a class="link" href="${attr(link)}" target="_blank" rel="noopener">${esc(r.edital||"-")} ↗</a>`:esc(r.edital||"-");
      const observacoes=txt(r.observacoes)||"-";
      const obsToggle=shouldShowObsToggle(observacoes)?`<button type="button" class="obs-toggle" onclick="toggleObs(this)" aria-expanded="false">Ver mais</button>`:"";
      const badge = expiryBadge(r);
      const rowCls = rowExpiryClass(r);

      const cells = {
        unidade:      `<td>${esc(r.unidade)}</td>`,
        edital:       `<td>${edital}${badge?`<div style="margin-top:4px">${badge}</div>`:""}</td>`,
        data_inicio:  `<td>${esc(fmtDate(r.data_inicio))}</td>`,
        data_fim:     `<td>${esc(fmtDate(r.data_fim))}</td>`,
        vagas_total:  `<td class="num">${fmt(r.vagas_total)}</td>`,
        contratados:  `<td class="num green-text">${fmt(r.contratados)}</td>`,
        vagas_ociosas:`<td class="num red-text">${fmt(r.vagas_ociosas)}</td>`,
        status:       `<td>${statusChip(r.status)}</td>`,
        etapa:        `<td>${esc(r.etapa)}</td>`,
        risco:        `<td>${riscoChip(r.risco)}</td>`,
        observacoes:  `<td class="obs-col"><div class="obs-cell"><div class="obs">${esc(observacoes)}</div>${obsToggle}</div></td>`,
      };
      const tds = TABLE_COLS.filter(c=>visibleCols.has(c.key)).map(c=>cells[c.key]).join("");
      return `<tr class="${rowCls}">${tds}</tr>`;
    }).join("")||`<tr><td colspan="${TABLE_COLS.filter(c=>visibleCols.has(c.key)).length||1}" style="text-align:center;padding:22px">Nenhum registro encontrado com os filtros atuais.</td></tr>`;

    // Linha de totais (rodapé): soma das colunas numéricas visíveis
    const foot = $("monitorFoot");
    if(foot){
      if(!detailRows.length){ foot.innerHTML = ""; }
      else {
        const tot = { vagas_total:0, contratados:0, vagas_ociosas:0 };
        detailRows.forEach(r=>{ tot.vagas_total+=n(r.vagas_total); tot.contratados+=n(r.contratados); tot.vagas_ociosas+=n(r.vagas_ociosas); });
        const footCells = {
          unidade:      `<td><b>Totais (${fmt(detailRows.length)})</b></td>`,
          edital:       `<td></td>`,
          data_inicio:  `<td></td>`,
          data_fim:     `<td></td>`,
          vagas_total:  `<td class="num"><b>${fmt(tot.vagas_total)}</b></td>`,
          contratados:  `<td class="num green-text"><b>${fmt(tot.contratados)}</b></td>`,
          vagas_ociosas:`<td class="num red-text"><b>${fmt(tot.vagas_ociosas)}</b></td>`,
          status:       `<td></td>`,
          etapa:        `<td></td>`,
          risco:        `<td></td>`,
          observacoes:  `<td class="obs-col"></td>`,
        };
        const ftds = TABLE_COLS.filter(c=>visibleCols.has(c.key)).map(c=>footCells[c.key]).join("");
        foot.innerHTML = `<tr style="position:sticky;bottom:0;background:#eef5fc;border-top:2px solid var(--agsus-ciano)">${ftds}</tr>`;
      }
    }
  }

  let nucleoDebounce=null;
  function debouncedNucleo(){ clearTimeout(nucleoDebounce); nucleoDebounce=setTimeout(renderNucleo,250); }
  function renderNucleo(){
    const q=low($("nucleoSearch").value);
    const data=rows.filter(r=>!q||[r.edital,r.unidade,r.status,r.etapa,r.risco,r.processo].map(low).join(" | ").includes(q)).sort(compareRows);
    $("nucleoRows").innerHTML=data.map(r=>`<tr>
      <td>${esc(r.unidade)}</td>
      <td>${safeUrl(r.link_edital)?`<a class="link" href="${attr(safeUrl(r.link_edital))}" target="_blank" rel="noopener">${esc(r.edital||"-")}</a>`:esc(r.edital||"-")}</td>
      <td>${statusChip(r.status)}</td>
      <td>${esc(r.etapa)}</td>
      <td class="num">${fmt(r.vagas_total)}</td>
      <td class="num green-text">${fmt(r.contratados)}</td>
      <td class="num red-text">${fmt(r.vagas_ociosas)}</td>
      <td>${riscoChip(r.risco)}</td>
      <td style="text-align:center">
        <button class="btn icon outline" onclick="openEditModal('${attr(r.id)}')" title="Editar registro" aria-label="Editar ${esc(r.edital||r.unidade)}">
          <i class="fa-solid fa-pen-to-square"></i>
        </button>
      </td>
    </tr>`).join("")||`<tr><td colspan="9" style="text-align:center;padding:22px">Nenhum registro encontrado.</td></tr>`;
  }

  function setFieldValue(id,value){ const el=$(id); if(el) el.value=value??""; }
  function setMetricValue(id,value){ const el=$(id); if(el) el.textContent=fmt(value); }
  function dateOrNull(id){ const v=txt($(id)?.value); return v||null; }

  function openEditModal(id){
    if(!can("cores")) return toast("Sem permissão para editar registros.","warn");
    const r=id?rows.find(x=>String(x.id)===String(id)):{};
    $("editModalTitle").textContent=id?"Editar edital":"Novo edital";
    setFieldValue("mId",r?.id||""); setFieldValue("mProcesso",r?.processo||""); setFieldValue("mEdital",r?.edital||"");
    const rowUnit=findUnitForRow(r); const unitValue=rowUnit?unidadeOptionValue(rowUnit):"";
    populateModalUnidades(unitValue); setFieldValue("mUnidade",unitValue);
    if(rowUnit){ onModalUnidadeChange(); }else{ setFieldValue("mIdUnidade",r?.id_unidade||""); setFieldValue("mSiglaUnidade",r?.sigla_unidade||""); setFieldValue("mTipoUnidade",r?.tipo_unidade||""); setFieldValue("mUf",r?.uf||""); }
    setFieldValue("mCiclo",r?.ciclo||""); setFieldValue("mLink",r?.link_edital||""); setFieldValue("mVagas",r?.vagas_total||0);
    setFieldValue("mDataInicio",r?.data_inicio||""); setFieldValue("mDataFim",r?.data_fim||"");
    setFieldValue("mStatus",r?.status||""); setFieldValue("mEtapa",r?.etapa||""); setFieldValue("mRisco",r?.risco||"Baixo");
    setFieldValue("mResponsavel",r?.responsavel||""); setFieldValue("mObs",r?.observacoes||""); setFieldValue("mObsInternas",r?.observacoes_internas||"");
    setMetricValue("mAutoInscritos",r?.inscritos); setMetricValue("mAutoAptosAnalise",r?.aptos_analise);
    setMetricValue("mAutoCancelados",r?.cancelados); setMetricValue("mAutoEliminadosNota",r?.eliminados_nota);
    setMetricValue("mAutoReprovadosAnalise",r?.reprovados_analise); setMetricValue("mAutoTotalEliminados",r?.total_eliminados);
    setMetricValue("mAutoAprovadosAnalise",r?.aprovados_analise); setMetricValue("mAutoAprovadosProva",r?.aprovados_prova);
    setMetricValue("mAutoEntrevistados",r?.entrevistados); setMetricValue("mAutoContratados",r?.contratados);
    setMetricValue("mAutoOciosas",r?.vagas_ociosas);
    $("editModal").classList.add("show");
    setTimeout(()=>{ try{ $("mProcesso")?.focus(); }catch(e){} }, 60);
  }
  function closeEditModal(){ $("editModal").classList.remove("show"); }

  async function saveEdital(){
    if(!can("cores")) return toast("Sem permissão para salvar registros.","warn");
    const id=txt($("mId").value); const unit=selectedModalUnidade();
    const payload={ processo:txt($("mProcesso").value), edital:txt($("mEdital").value), id_unidade:txt(unit?.id_unidade)||null, sigla_unidade:txt(unit?.sigla)||null, tipo_unidade:txt(unit?.tipo)||null, unidade:txt(unit?.nome_oficial), uf:txt(unit?.uf_sede).toUpperCase(), ciclo:txt($("mCiclo").value), vagas_total:n($("mVagas").value), data_inicio:dateOrNull("mDataInicio"), data_fim:dateOrNull("mDataFim"), status:txt($("mStatus").value), etapa:txt($("mEtapa").value), risco:txt($("mRisco").value), responsavel:txt($("mResponsavel").value), link_edital:txt($("mLink").value), observacoes:txt($("mObs").value), observacoes_internas:txt($("mObsInternas").value), ativo:true };
    if(id) payload.id=id;
    if(!payload.edital||!payload.unidade){ toast("Informe pelo menos edital e unidade.","warn"); return; }
    if(payload.data_inicio && payload.data_fim && payload.data_inicio > payload.data_fim){
      toast("A data de início não pode ser posterior à data de encerramento.","warn"); return;
    }
    const btn=$("saveEditalBtn"); btn.disabled=true; btn.textContent="Salvando...";
    loader(true,"Equipe Núcleo","Salvando no Supabase...",70);
    const result=await sb.rpc(RPC_SAVE_MONITORAMENTO,{p_payload:payload});
    btn.disabled=false; btn.textContent="Salvar";
    if(result.error){ loader(false); toast("Erro ao salvar: "+friendlyError(result.error),"error"); return; }
    const saved=rpcFirst(result.data);
    if(!saved||!saved.id){ loader(false); toast("Não foi possível confirmar o salvamento. Verifique as permissões da Equipe Núcleo.","error"); return; }
    closeEditModal(); await loadData({showLoader:false}); loader(false);
    toast(`${saved.edital || "Registro"} — ${saved.unidade || ""} salvo com sucesso.`);
    navigate("nucleo");
  }

  function warmExternalPanels(force=false){
    if(!can("paineis")) return;
    const mount=$("externalMount"); if(!mount) return;
    if(force){ document.querySelectorAll(".external-panel").forEach(el=>el.remove()); externalPanelsWarmed=false; }
    if(externalPanelsWarmed) return;
    if(mount.classList.contains("external-placeholder")){ mount.className=""; mount.innerHTML=""; }
    panels.filter(p=>p.ativo!==false).sort((a,b)=>n(a.ordem)-n(b.ordem)).forEach(panel=>{
      const code=txt(panel.codigo); if(!code) return;
      let holder=document.getElementById("external-panel-"+code); if(holder) return;
      holder=document.createElement("div"); holder.id="external-panel-"+code; holder.className="external-panel"; holder.hidden=true;
      mount.appendChild(holder); buildExternalPanel(holder,panel);
    });
    externalPanelsWarmed=true;
  }

  function clearExternalPanelCache(){
    document.querySelectorAll(".external-panel").forEach(el=>el.remove());
    const mount=$("externalMount");
    if(mount){ mount.className="external-placeholder"; mount.textContent=cfgValue("external_placeholder"); }
    externalPanelsWarmed=false; currentPanel=null;
  }

  function openPanel(code){
    const panel=panels.find(p=>p.codigo===code&&panelAllowed(p));
    if(!panel){ toast("Painel indisponível ou inativo.","warn"); return; }
    const safePanelUrl = safeUrl(panel.url);
    if(safePanelUrl && isInternalPanelUrl(safePanelUrl) && isSystemShellUrl(safePanelUrl)){
      rememberView(systemHomeView());
      window.location.assign(new URL(safePanelUrl, window.location.origin).href);
      return;
    }
    document.body.classList.add("external-clean");
    currentPanel=panel; currentView="panel:"+code; rememberView(currentView); enforceResponsiveSidebar(); setActiveNav(currentView);
    document.querySelectorAll(".page").forEach(p=>p.classList.remove("active")); $("page-external").classList.add("active");
    setPageTitle(panel.titulo,cfgValue("external_default_title"));
    $("externalTitle").textContent=panel.titulo; $("externalOpen").href=safeUrl(panel.url)||"#";
    const mount=$("externalMount");
    if(mount.classList.contains("external-placeholder")){ mount.className=""; mount.innerHTML=""; }
    document.querySelectorAll(".external-panel").forEach(el=>el.hidden=true);
    let holder=document.getElementById("external-panel-"+code);
    if(!holder){ holder=document.createElement("div"); holder.id="external-panel-"+code; holder.className="external-panel"; mount.appendChild(holder); buildExternalPanel(holder,panel); }
    holder.hidden=false;
  }

  function buildExternalPanel(holder,panel){
    if(panel.em_manutencao){ holder.innerHTML=`<div class="external-placeholder"><div><div style="font-size:58px;color:#555"><i class="fa-solid fa-screwdriver-wrench"></i></div><h2>${esc(cfgValue("maintenance_title"))}</h2><p>${esc(cfgValue("maintenance_message"))}</p></div></div>`; return; }
    const safePanelUrl = safeUrl(panel.url);
    if(!safePanelUrl){ holder.innerHTML=`<div class="external-placeholder"><div><h2>${esc(panel.titulo)}</h2><p>Cadastre uma URL http(s) válida deste painel em paineis_externos.</p></div></div>`; return; }
    holder.innerHTML=`<iframe class="external-frame" src="${attr(safePanelUrl)}" loading="eager" referrerpolicy="no-referrer-when-downgrade" allow="fullscreen *; clipboard-read *; clipboard-write *; encrypted-media *; geolocation *; display-capture *" allowfullscreen="true"></iframe>`;
  }

  function reloadExternal(){
    if(!currentPanel) return;
    const holder=document.getElementById("external-panel-"+currentPanel.codigo);
    if(holder) holder.remove(); openPanel(currentPanel.codigo);
  }

  function renderConfigForm(){
    $("cfgMonitId").value    = cfgValue("monit_id");
    $("cfgTitle").value      = cfgValue("app_title");
    $("cfgSubtitle") && ($("cfgSubtitle").value = cfgValue("app_subtitle"));
    $("cfgSlogan").value     = cfgValue("app_slogan");
    $("cfgPageTitle") && ($("cfgPageTitle").value = cfgValue("page_title"));
    $("cfgPageSubtitle") && ($("cfgPageSubtitle").value = cfgValue("page_subtitle"));
    $("cfgLoginEyebrow") && ($("cfgLoginEyebrow").value = cfgValue("login_eyebrow"));
    $("cfgLoginEmailLabel") && ($("cfgLoginEmailLabel").value = cfgValue("login_email_label"));
    $("cfgLoginEmailPlaceholder") && ($("cfgLoginEmailPlaceholder").value = cfgValue("login_email_placeholder"));
    $("cfgLoginPasswordLabel") && ($("cfgLoginPasswordLabel").value = cfgValue("login_password_label"));
    $("cfgLoginPasswordPlaceholder") && ($("cfgLoginPasswordPlaceholder").value = cfgValue("login_password_placeholder"));
    $("cfgLoginButtonText") && ($("cfgLoginButtonText").value = cfgValue("login_button_text"));
    $("cfgPasswordResetMessage") && ($("cfgPasswordResetMessage").value = passwordResetMessage());
    $("cfgGoogleEnabled") && ($("cfgGoogleEnabled").value = String(cfgBool("auth_google_enabled", false)));
    $("cfgGoogleButtonText") && ($("cfgGoogleButtonText").value = cfgValue("auth_google_button_text"));
    $("cfgGoogleDomainHint") && ($("cfgGoogleDomainHint").value = cfgValue("auth_google_domain_hint"));
    $("cfgFilterTitle") && ($("cfgFilterTitle").value = cfgValue("filter_title"));
    $("cfgFilterSubtitle") && ($("cfgFilterSubtitle").value = cfgValue("filter_subtitle"));
    $("cfgFilterToggleShow") && ($("cfgFilterToggleShow").value = cfgValue("filter_toggle_show"));
    $("cfgFilterToggleHide") && ($("cfgFilterToggleHide").value = cfgValue("filter_toggle_hide"));
    $("cfgKpiProcessos") && ($("cfgKpiProcessos").value = cfgValue("kpi_processos_label"));
    $("cfgKpiVagas") && ($("cfgKpiVagas").value = cfgValue("kpi_vagas_label"));
    $("cfgKpiContratados") && ($("cfgKpiContratados").value = cfgValue("kpi_contratados_label"));
    $("cfgKpiOciosas") && ($("cfgKpiOciosas").value = cfgValue("kpi_ociosas_label"));
    $("cfgKpiCriticos") && ($("cfgKpiCriticos").value = cfgValue("kpi_criticos_label"));
    $("cfgKpiInscritos") && ($("cfgKpiInscritos").value = cfgValue("kpi_inscritos_label"));
    $("cfgFooter").value     = cfgValue("footer_text");
    $("cfgMascot").value     = cfgValue("mascot_url");
    $("cfgLoginLogo").value  = cfgValue("login_logo_url");
    $("cfgLoginBg").value    = cfgValue("login_bg_url");
    $("cfgCogipNome")  && ($("cfgCogipNome").value   = cfgValue("cogip_nome"));
    $("cfgCogipFuncao")&& ($("cfgCogipFuncao").value = cfgValue("cogip_funcao"));
    $("cfgCogipVersao")&& ($("cfgCogipVersao").value = cfgValue("cogip_versao"));
    $("cfgCogipDept")  && ($("cfgCogipDept").value   = cfgValue("cogip_dept"));
    $("cfgAppVersionCurrent") && ($("cfgAppVersionCurrent").value = appVersion());
    $("cfgCogipLogo")  && ($("cfgCogipLogo").value   = cfgValue("cogip_logo_url"));
    $("cfgBroadcastType").value = cfgValue("broadcast_type") || "info";
    $("cfgBroadcastMsg").value  = cfgValue("broadcast_msg");
    $("cfgRealtimeEnabled") && ($("cfgRealtimeEnabled").value = String(cfgBool("feature_realtime_monitoramento", true)));
    $("cfgAccessHeartbeatMinutos") && ($("cfgAccessHeartbeatMinutos").value = String(Math.max(1, cfgInt("access_heartbeat_minutos", DEFAULT_ACCESS_HEARTBEAT_MINUTES))));
    $("cfgExecutiveModeEnabled") && ($("cfgExecutiveModeEnabled").value = String(cfgBool("feature_modo_executivo", true)));
    previewImg("cfgMascot","prevMascot");
    previewImg("cfgLoginLogo","prevLoginLogo");
    previewImg("cfgLoginBg","prevLoginBg");
    if($("cfgCogipLogo")) previewImg("cfgCogipLogo","prevCogipLogo");
    renderAccessRequestsAdmin();
    renderPanelAdmin();
  }

  function renderPanelAdmin(){
    const box=$("panelAdmin"); if(!box) return;
    box.innerHTML=`<h3 style="margin:0 0 12px">Painéis externos</h3>`+panels.map((p,i)=>{
      const hasUrl = !!txt(p.url);
      const manut = p.em_manutencao;
      const inativo = p.ativo===false;
      const statusIcon = inativo
        ? `<span title="Inativo" style="font-size:11px;padding:2px 9px;border-radius:999px;background:#ffe1e3;color:#9f0714;font-weight:800;border:1px solid #ffb8bf">Inativo</span>`
        : manut
          ? `<span title="Em manutenção" style="font-size:11px;padding:2px 9px;border-radius:999px;background:#fff1b8;color:#684600;font-weight:800;border:1px solid #f3cf54">Manutenção</span>`
          : hasUrl
            ? `<span title="Ativo e configurado" style="font-size:11px;padding:2px 9px;border-radius:999px;background:#dff8ea;color:#00824c;font-weight:800;border:1px solid #bfeccd">Ativo</span>`
            : `<span title="URL não configurada" style="font-size:11px;padding:2px 9px;border-radius:999px;background:#eef2f7;color:#334155;font-weight:800;border:1px solid #d5dfec">Sem URL</span>`;
      return `<div style="margin-bottom:12px;padding:12px;border:1px solid var(--line);border-radius:14px;background:#fafcff;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;gap:8px;">
          <span style="font-weight:800;font-size:14px;color:#10243e">${esc(p.titulo||p.codigo)}</span>
          ${statusIcon}
        </div>
        <input type="hidden" id="panelId${i}" value="${attr(p.id||"")}">
        <div class="form-grid">
          <div class="form-row"><label>Título</label><input id="panelTitulo${i}" value="${attr(p.titulo||"")}"></div>
          <div class="form-row"><label>Código</label><input value="${attr(p.codigo||"")}" readonly></div>
          <div class="form-row full"><label>URL</label><input id="panelUrl${i}" value="${attr(p.url||"")}" placeholder="URL do painel" oninput="this.style.borderColor=this.value?'#0b8f58':'var(--line)'"></div>
          <div class="form-row"><label>Ativo</label><select id="panelAtivo${i}"><option value="true" ${p.ativo!==false?"selected":""}>Sim</option><option value="false" ${p.ativo===false?"selected":""}>Não</option></select></div>
          <div class="form-row"><label>Manutenção</label><select id="panelManut${i}"><option value="false" ${!p.em_manutencao?"selected":""}>Não</option><option value="true" ${p.em_manutencao?"selected":""}>Sim</option></select></div>
        </div>
      </div>`;
    }).join("")+`<p style="color:var(--muted);font-weight:800;font-size:12px;">As alterações só são enviadas ao Supabase quando clicar em Salvar configurações.</p>`;
  }

  async function renderAccessRequestsAdmin(){
    const card = $("accessRequestsAdminCard");
    const box = $("accessRequestsAdmin");
    if(!card || !box) return;
    const allowed = can("admin") || can("config");
    card.classList.toggle("hidden", !allowed);
    if(!allowed) return;
    box.innerHTML = `<div class="access-status">Carregando solicitações...</div>`;
    const { data, error } = await sb
      .from("solicitacoes_acesso")
      .select("id,user_id,email,nome,setor,justificativa,perfil_solicitado,status,observacao_admin,created_at,solicitacoes_acesso_paineis(painel_id)")
      .order("created_at", { ascending:false })
      .limit(50);
    if(error){
      box.innerHTML = `<div class="alert error">Erro ao carregar solicitações: ${esc(friendlyError(error))}</div>`;
      return;
    }
    accessRequests = Array.isArray(data) ? data : [];
    if(!accessRequests.length){
      box.innerHTML = `<div class="access-status">Nenhuma solicitação de acesso encontrada.</div>`;
      return;
    }
    box.innerHTML = accessRequests.map(renderAccessRequestAdminItem).join("");
  }

  function renderAccessRequestAdminItem(req){
    const selectedPanels = new Set((req.solicitacoes_acesso_paineis||[]).map(r=>String(r.painel_id)));
    const profileValue = ["leitor","editor","admin"].includes(req.perfil_solicitado) ? req.perfil_solicitado : "leitor";
    const editable = req.status === "pendente";
    const disabled = editable ? "" : "disabled";
    const painelChecks = panels.filter(p=>p.ativo!==false).map(p=>`
      <label class="panel-check">
        <input type="checkbox" data-access-panel="${attr(req.id)}" value="${attr(p.id||"")}" ${selectedPanels.has(String(p.id))?"checked":""} ${disabled}>
        <span>${esc(p.titulo||p.codigo)}</span>
      </label>
    `).join("") || `<div class="access-status">Nenhum painel externo ativo.</div>`;
    return `<div class="access-admin-item" data-access-request="${attr(req.id)}">
      <div class="access-admin-head">
        <div>
          <strong>${esc(req.nome || req.email)}</strong>
          <span>${esc(req.email)}${req.setor ? " · "+esc(req.setor) : ""}</span>
          ${req.justificativa ? `<span>${esc(req.justificativa)}</span>` : ""}
        </div>
        <div class="access-status-pill ${attr(req.status)}">${esc(req.status)}</div>
      </div>
      <div class="access-admin-controls">
        <div class="form-row">
          <label>Perfil</label>
          <select id="accessPerfil${attr(req.id)}" ${disabled}>
            <option value="leitor" ${profileValue==="leitor"?"selected":""}>Leitor</option>
            <option value="editor" ${profileValue==="editor"?"selected":""}>Editor</option>
            <option value="admin" ${profileValue==="admin"?"selected":""}>Admin</option>
          </select>
        </div>
        <div>
          <label>Permissões internas</label>
          <div class="permission-checks">
            ${permissionCheckHTML(req.id,"ind","Saúde Indígena",true,disabled)}
            ${permissionCheckHTML(req.id,"cores","Núcleo",false,disabled)}
            ${permissionCheckHTML(req.id,"paineis","Painéis",true,disabled)}
            ${permissionCheckHTML(req.id,"config","Config",false,disabled)}
            ${permissionCheckHTML(req.id,"admin","Admin",false,disabled)}
          </div>
        </div>
      </div>
      <div style="margin-top:12px">
        <label>Painéis externos liberados</label>
        <div class="panel-check-list">${painelChecks}</div>
      </div>
      <div class="form-row" style="margin-top:12px">
        <label>Observação administrativa</label>
        <input id="accessObs${attr(req.id)}" value="${attr(req.observacao_admin||"")}" placeholder="Opcional" ${disabled}>
      </div>
      <div class="access-admin-actions">
        ${editable ? `<button class="btn green" type="button" onclick="approveAccessRequest('${attr(req.id)}')"><i class="fa-solid fa-check"></i> Aprovar acesso</button>
        <button class="btn red" type="button" onclick="denyAccessRequest('${attr(req.id)}')"><i class="fa-solid fa-xmark"></i> Recusar</button>` : ""}
      </div>
    </div>`;
  }

  function permissionCheckHTML(id,key,label,checked,disabled){
    return `<label class="permission-check"><input type="checkbox" id="accessPerm_${attr(key)}_${attr(id)}" ${checked?"checked":""} ${disabled}><span>${esc(label)}</span></label>`;
  }

  function accessRequestById(id){
    return accessRequests.find(r=>String(r.id)===String(id));
  }

  function selectedAdminPanelIds(id){
    return Array.from(document.querySelectorAll("[data-access-panel]:checked"))
      .filter(el=>String(el.getAttribute("data-access-panel"))===String(id))
      .map(el=>txt(el.value))
      .filter(Boolean);
  }

  async function approveAccessRequest(id){
    const req = accessRequestById(id);
    if(!req) return toast("Solicitação não encontrada.","warn");
    const perfil = txt($("accessPerfil"+id)?.value) || "leitor";
    const p_paineis = $("accessPerm_paineis_"+id)?.checked === true;
    const selectedPanels = selectedAdminPanelIds(id);
    const profilePayload = {
      user_id: req.user_id,
      email: req.email,
      nome: req.nome || req.email,
      perfil,
      ativo: true,
      p_ind: $("accessPerm_ind_"+id)?.checked === true,
      p_cores: $("accessPerm_cores_"+id)?.checked === true,
      p_paineis,
      p_config: $("accessPerm_config_"+id)?.checked === true,
      p_admin: $("accessPerm_admin_"+id)?.checked === true
    };
    loader(true,"Aprovando acesso","Criando perfil e permissões...",55);
    const { data:profileRows, error:profileErr } = await sb
      .from("perfis_usuarios")
      .upsert(profilePayload, { onConflict:"email" })
      .select("id")
      .limit(1);
    if(profileErr){ loader(false); return toast("Erro ao criar perfil: "+friendlyError(profileErr),"error"); }
    const profileId = Array.isArray(profileRows) ? profileRows[0]?.id : profileRows?.id;
    if(!profileId){ loader(false); return toast("Perfil salvo, mas não foi possível confirmar o ID. Recarregue e tente novamente.","error"); }
    const { error:deleteErr } = await sb.from("perfis_paineis_externos").delete().eq("perfil_usuario_id", profileId);
    if(deleteErr){ loader(false); return toast("Erro ao limpar permissões antigas de painéis: "+friendlyError(deleteErr),"error"); }
    if(p_paineis && selectedPanels.length){
      const rowsToInsert = selectedPanels.map(painel_id=>({ perfil_usuario_id:profileId, painel_id, ativo:true }));
      const { error:panelErr } = await sb.from("perfis_paineis_externos").insert(rowsToInsert);
      if(panelErr){ loader(false); return toast("Erro ao liberar painéis: "+friendlyError(panelErr),"error"); }
    }
    const { error:reqErr } = await sb.from("solicitacoes_acesso").update({
      status:"aprovado",
      avaliado_por: currentUser?.id || null,
      avaliado_em: new Date().toISOString(),
      observacao_admin: txt($("accessObs"+id)?.value)
    }).eq("id", id);
    loader(false);
    if(reqErr) return toast("Perfil criado, mas erro ao marcar solicitação como aprovada: "+friendlyError(reqErr),"warn");
    toast("Acesso aprovado.");
    await renderAccessRequestsAdmin();
  }

  async function denyAccessRequest(id){
    const req = accessRequestById(id);
    if(!req) return toast("Solicitação não encontrada.","warn");
    const { error } = await sb.from("solicitacoes_acesso").update({
      status:"recusado",
      avaliado_por: currentUser?.id || null,
      avaliado_em: new Date().toISOString(),
      observacao_admin: txt($("accessObs"+id)?.value)
    }).eq("id", id);
    if(error) return toast("Erro ao recusar solicitação: "+friendlyError(error),"error");
    toast("Solicitação recusada.");
    await renderAccessRequestsAdmin();
  }

  async function saveAdminSettings(){
    if(!can("config")) return toast("Sem permissão para salvar configurações.","warn");
    if(!configLoadOk) return toast("As configurações não foram carregadas do Supabase. Recarregue antes de salvar para evitar sobrescrever valores bons.","warn");
    loader(true,"Configurações","Salvando ajustes no Supabase...",60);
    const configRows=[
      {chave:"monit_id",       valor:txt($("cfgMonitId").value),       descricao:"ID / referência da base"},
      {chave:"page_title",     valor:txt($("cfgPageTitle")?.value||""), descricao:"Título da página inicial"},
      {chave:"page_subtitle",  valor:txt($("cfgPageSubtitle")?.value||""), descricao:"Subtítulo da página inicial"},
      {chave:"auth_google_enabled", valor:txt($("cfgGoogleEnabled")?.value||"false"), descricao:"Exibe ou oculta o login com Google"},
      {chave:"auth_google_button_text", valor:txt($("cfgGoogleButtonText")?.value||""), descricao:"Texto do botão de autenticação Google"},
      {chave:"auth_google_domain_hint", valor:txt($("cfgGoogleDomainHint")?.value||""), descricao:"Domínio sugerido no login Google"},
      {chave:"filter_title", valor:txt($("cfgFilterTitle")?.value||""), descricao:"Título dos filtros"},
      {chave:"filter_subtitle", valor:txt($("cfgFilterSubtitle")?.value||""), descricao:"Subtítulo dos filtros"},
      {chave:"filter_toggle_show", valor:txt($("cfgFilterToggleShow")?.value||""), descricao:"Texto para mostrar filtros"},
      {chave:"filter_toggle_hide", valor:txt($("cfgFilterToggleHide")?.value||""), descricao:"Texto para ocultar filtros"},
      {chave:"kpi_processos_label", valor:txt($("cfgKpiProcessos")?.value||""), descricao:"Rótulo do KPI processos"},
      {chave:"kpi_vagas_label", valor:txt($("cfgKpiVagas")?.value||""), descricao:"Rótulo do KPI vagas"},
      {chave:"kpi_contratados_label", valor:txt($("cfgKpiContratados")?.value||""), descricao:"Rótulo do KPI contratações"},
      {chave:"kpi_ociosas_label", valor:txt($("cfgKpiOciosas")?.value||""), descricao:"Rótulo do KPI vagas ociosas"},
      {chave:"kpi_criticos_label", valor:txt($("cfgKpiCriticos")?.value||""), descricao:"Rótulo do KPI críticos"},
      {chave:"kpi_inscritos_label", valor:txt($("cfgKpiInscritos")?.value||""), descricao:"Rótulo do KPI inscritos"},
      {chave:"footer_text",    valor:txt($("cfgFooter").value),        descricao:"Texto do rodapé (fallback)"},
      {chave:"mascot_url",     valor:txt($("cfgMascot").value),        descricao:"Logo / mascote da sidebar"},
      {chave:"cogip_nome",     valor:txt($("cfgCogipNome")?.value||""),  descricao:"Nome da equipe (COGIP)"},
      {chave:"cogip_funcao",   valor:txt($("cfgCogipFuncao")?.value||""),descricao:"Função / área da equipe"},
      {chave:"cogip_versao",   valor:txt($("cfgCogipVersao")?.value||""),descricao:"Versão do sistema"},
      {chave:"cogip_dept",     valor:txt($("cfgCogipDept")?.value||""),  descricao:"Texto institucional"},
      {chave:"app_version_current", valor:txt($("cfgAppVersionCurrent")?.value||""), descricao:"Versão corrente publicada"},
      {chave:"cogip_logo_url", valor:txt($("cfgCogipLogo")?.value||""),  descricao:"Logo da equipe"},
      {chave:"broadcast_type", valor:txt($("cfgBroadcastType").value), descricao:"Tipo do aviso global"},
      {chave:"broadcast_msg",  valor:txt($("cfgBroadcastMsg").value),  descricao:"Mensagem do aviso global"},
      {chave:"feature_realtime_monitoramento", valor:txt($("cfgRealtimeEnabled")?.value||"true"), descricao:"Habilita atualização em tempo real do monitoramento"},
      {chave:"access_heartbeat_minutos", valor:String(Math.max(1, n($("cfgAccessHeartbeatMinutos")?.value||DEFAULT_ACCESS_HEARTBEAT_MINUTES))), descricao:"Intervalo de auditoria heartbeat, em minutos"},
      {chave:"feature_modo_executivo", valor:txt($("cfgExecutiveModeEnabled")?.value||"true"), descricao:"Habilita o modo executivo no dashboard principal"}
    ];

    // Preserva o índice original da lista renderizada.
    // A versão anterior aplicava filter(...).map((panel,i)=>...), e o índice podia
    // apontar para inputs errados quando houvesse painéis padrão/sem id no array.
    const panelRows = panels
      .map((panel,i)=> panel.id ? {
        id:txt(panel.id),
        titulo:txt($("panelTitulo"+i)?.value),
        url:txt($("panelUrl"+i)?.value),
        ativo:$("panelAtivo"+i)?.value === "true",
        em_manutencao:$("panelManut"+i)?.value === "true"
      } : null)
      .filter(Boolean);

    const { error:cfgErr } = await sb.rpc(RPC_SAVE_CONFIG,{ p_config_rows:configRows, p_paineis:panelRows });
    if(cfgErr){ loader(false); return toast("Erro ao salvar configurações: "+friendlyError(cfgErr),"error"); }

    await loadConfig();
    await loadPanels();
    if(currentUser?.id){ startAccessHeartbeat(); stopRealtime(); startRealtime(); }
    buildNav();
    loader(false);
    toast("Configurações salvas.");
  }

  function isDashboardView(){ return currentView==="dashboard"; }
  function applyExecutiveModeForCurrentView(){
    const dashboard=isDashboardView() && cfgBool("feature_modo_executivo", true); let storedActive=false;
    try{ storedActive=localStorage.getItem("agsus_monitora_executive_mode_v1")==="1"; }catch(e){}
    document.body.classList.toggle("executive-mode",dashboard&&storedActive); syncDisplayModeButtons();
  }
  function syncDisplayModeButtons(){
    const exec=$("executiveModeBtn"); const dashboard=isDashboardView() && cfgBool("feature_modo_executivo", true);
    const executiveActive=dashboard&&document.body.classList.contains("executive-mode");
    if(exec){ exec.classList.toggle("hidden",!dashboard); exec.setAttribute("aria-hidden",dashboard?"false":"true"); exec.setAttribute("aria-pressed",executiveActive?"true":"false"); exec.innerHTML=executiveActive?`<i class="fa-solid fa-display"></i> ${esc(cfgValue("executive_mode_exit_text"))}`:`<i class="fa-solid fa-display"></i> ${esc(cfgValue("executive_mode_enter_text"))}`; }
    const fullscreenActive = !!document.fullscreenElement || document.body.classList.contains("app-fullscreen-fallback");
    const moreMenu = $("moreActionsMenu");
    if(moreMenu){
      const fsBtn = moreMenu.querySelector("button:first-child i");
      if(fsBtn) fsBtn.className = fullscreenActive ? "fa-solid fa-compress" : "fa-solid fa-expand";
    }
  }
  function applyStoredDisplayModes(){ applyExecutiveModeForCurrentView(); }
  function toggleExecutiveMode(){
    if(!isDashboardView()){ syncDisplayModeButtons(); return; }
    const active=!document.body.classList.contains("executive-mode");
    document.body.classList.toggle("executive-mode",active);
    try{ localStorage.setItem("agsus_monitora_executive_mode_v1",active?"1":"0"); }catch(e){}
    syncDisplayModeButtons(); if(currentView==="dashboard") scheduleMapResize(220);
    toast(active ? cfgValue("executive_mode_enter_text") : cfgValue("executive_mode_exit_text"));
  }

  // Sai de um painel externo e volta para o sistema. Também encerra a tela cheia
  // (nativa ou fallback) — atende "ao tirar a tela cheia, voltar para o sistema".
  function exitExternalPanel(){
    try{
      if(document.fullscreenElement && document.exitFullscreen){
        const p=document.exitFullscreen(); if(p&&p.catch) p.catch(()=>{});
      }
    }catch(e){}
    if(document.body.classList.contains("app-fullscreen-fallback")) toggleAppFullscreenFallback(false);
    document.body.classList.remove("external-clean");
    currentPanel=null;
    navigate(systemHomeView());
  }

  function getFullscreenTarget(){
    if(currentView && currentView.startsWith("panel:") && currentPanel){
      const holder = document.getElementById("external-panel-"+currentPanel.codigo);
      const frame = holder?.querySelector?.(".external-frame");
      if(frame) return frame;
    }
    return document.documentElement;
  }

  function toggleAppFullscreenFallback(force){
    const active = typeof force === "boolean" ? force : !document.body.classList.contains("app-fullscreen-fallback");
    document.body.classList.toggle("app-fullscreen-fallback", active);
    document.body.classList.toggle("system-fullscreen-mode", active || !!document.fullscreenElement);
    syncDisplayModeButtons();
    if(currentView==="dashboard") scheduleMapResize(220);
    toast(active ? "Modo expandido ativado." : "Modo expandido desativado.");
  }

  function toggleBrowserFullscreen(){
    try{
      if(document.body.classList.contains("app-fullscreen-fallback")){
        toggleAppFullscreenFallback(false);
        return;
      }
      if(document.fullscreenElement){
        const exiting = document.exitFullscreen?.();
        if(exiting?.catch) exiting.catch(()=>toggleAppFullscreenFallback(false));
        return;
      }
      const target = getFullscreenTarget();
      if(!document.fullscreenEnabled || !target?.requestFullscreen){ toggleAppFullscreenFallback(true); return; }
      const entering = target.requestFullscreen();
      if(entering?.catch) entering.catch(()=>toggleAppFullscreenFallback(true));
    }catch(error){ toggleAppFullscreenFallback(true); }
  }

  document.addEventListener("fullscreenchange",()=>{ document.body.classList.toggle("system-fullscreen-mode",!!document.fullscreenElement||document.body.classList.contains("app-fullscreen-fallback")); syncDisplayModeButtons(); if(currentView==="dashboard") scheduleMapResize(220); });

  function exportCSV(){
    const source = filtered.length ? filtered : rows;
    const fieldMap = [
      { key:"unidade",       label:"Unidade"              },
      { key:"uf",            label:"UF"                   },
      { key:"edital",        label:"Edital"               },
      { key:"processo",      label:"Processo SEI"         },
      { key:"ciclo",         label:"Ciclo"                },
      { key:"vagas_total",   label:"Vagas Previstas"      },
      { key:"contratados",   label:"Contratados"          },
      { key:"vagas_ociosas", label:"Vagas Ociosas"        },
      { key:"inscritos",     label:"Inscritos"            },
      { key:"status",        label:"Status"               },
      { key:"etapa",         label:"Etapa"                },
      { key:"risco",         label:"Risco"                },
      { key:"data_inicio",   label:"Data de Início"       },
      { key:"data_fim",      label:"Data de Encerramento" },
      { key:"responsavel",   label:"Responsável"          },
      { key:"observacoes",   label:"Observações"          },
      { key:"link_edital",   label:"Link do Edital"       },
    ];
    const clean = v => `"${String(v ?? "").replaceAll('"','""').replaceAll("\r"," ").replaceAll("\n"," ")}"`;
    const headers = fieldMap.map(f => `"${f.label}"`).join(";");
    const data = source.map(r => fieldMap.map(f => clean(r[f.key])).join(";")).join("\r\n");
    const now = new Date();
    const stamp = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}`;
    const blob = new Blob(["\ufeff" + headers + "\n" + data], {type:"text/csv;charset=utf-8;"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `AgSUS_Monitora_SaudeIndigena_${stamp}.csv`;
    a.click(); URL.revokeObjectURL(a.href);
  }

  // Exporta relatório em PDF (via diálogo de impressão do navegador — funciona offline)
  function exportPDF(){
    closeMoreActions && closeMoreActions();
    const now=new Date();
    const dataStr=now.toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"});
    // Resumo dos filtros ativos
    const ativos=[];
    if(typeof FILTER_CONFIG!=="undefined"){
      FILTER_CONFIG.forEach(cfg=>{ const sel=Array.from(filterState[cfg.field]||[]); if(sel.length) ativos.push(cfg.all.replace("Todas","").replace("Todos","").trim()+": "+sel.join(", ")); });
    }
    const busca=($("tableSearch")?.value||"").trim();
    if(busca) ativos.push("Busca: "+busca);
    const filtrosTxt = ativos.length ? ativos.join(" · ") : "Nenhum filtro aplicado (todos os processos)";
    // KPIs do conjunto filtrado
    const vagas=sum("vagas_total"), contrat=sum("contratados"), ociosas=sum("vagas_ociosas");
    const pctO = vagas>0?Math.round(ociosas/vagas*100):0;
    // Cabeçalho de relatório (inserido só para a impressão)
    let head=document.getElementById("printReportHeader");
    if(head) head.remove();
    head=document.createElement("div");
    head.id="printReportHeader";
    head.className="print-only";
    head.innerHTML=`<div style="padding:0 0 12px;border-bottom:2px solid #003b70;margin-bottom:14px;">
      <div style="font-size:20px;font-weight:700;color:#003b70;">AgSUS Monitora — Saúde Indígena</div>
      <div style="font-size:12px;color:#444;margin-top:2px;">Relatório de processos seletivos · gerado em ${dataStr}</div>
      <div style="font-size:11px;color:#555;margin-top:6px;"><b>Filtros:</b> ${esc(filtrosTxt)}</div>
      <div style="font-size:12px;color:#222;margin-top:8px;display:flex;gap:18px;flex-wrap:wrap;">
        <span><b>${fmt(filtered.length)}</b> processos</span>
        <span><b>${fmt(vagas)}</b> vagas previstas</span>
        <span><b>${fmt(contrat)}</b> contratações</span>
        <span style="color:#a3322b;"><b>${fmt(ociosas)}</b> ociosas (${pctO}%)</span>
      </div>
    </div>`;
    const content=document.querySelector(".content")||document.body;
    content.insertBefore(head, content.firstChild);
    const cleanup=()=>{ const h=document.getElementById("printReportHeader"); if(h) h.remove(); window.removeEventListener("afterprint",cleanup); };
    window.addEventListener("afterprint",cleanup);
    setTimeout(()=>{ window.print(); setTimeout(cleanup,1500); }, 120);
    toast("Gerando relatório PDF… escolha \"Salvar como PDF\" na janela de impressão.");
  }

  function friendlyError(error){
    const msg=error?.message||String(error||"Erro desconhecido");
    if(msg.includes("vagas_ociosas")) return "Campo calculado protegido pelo banco. Atualize a página e tente novamente.";
    if(msg.includes(RPC_SAVE_MONITORAMENTO)||msg.includes(RPC_SAVE_CONFIG)) return "As funções RPC necessárias ainda não estão disponíveis. Aplique o script SQL institucional no Supabase.";
    if(msg.includes("Sem permissão para salvar monitoramento indígena")) return "Seu usuário não tem permissão para salvar registros da Equipe Núcleo.";
    if(msg.includes("Sem permissão para salvar configurações")) return "Seu usuário não tem permissão para alterar configurações do sistema.";
    if(msg.includes("permission denied")||msg.includes("violates row-level security")) return "Permissão insuficiente para esta ação. Verifique o perfil do usuário e as políticas RLS.";
    if(msg.includes("JWT")||msg.includes("session")) return "Sessão expirada. Faça login novamente.";
    return msg;
  }


  // ── Dark mode ───────────────────────────────────────────────────────────
  function applyDarkMode(dark){
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "");
    const thumb = $("darkModeThumb"); const track = $("darkModeToggle");
    if(thumb) thumb.style.transform = dark ? "translateX(18px)" : "translateX(0)";
    if(track) track.style.background = dark ? "#00a8d6" : "#334e6a";
  }
  function toggleDarkMode(){
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const next = !isDark;
    try{ localStorage.setItem("agsus_dark_mode_v1", next ? "1" : "0"); }catch(e){}
    applyDarkMode(next);
    // re-renderiza o mapa para adaptar ao fundo
    setTimeout(()=>{ if(currentView==="dashboard") scheduleMapResize(80); }, 200);
  }
  function loadDarkModePreference(){
    try{
      const saved = localStorage.getItem("agsus_dark_mode_v1");
      if(saved === "1"){ applyDarkMode(true); return; }
      if(saved === "0"){ applyDarkMode(false); return; }
      // Sem preferência salva: não aplicar dark mode automaticamente
      // para não afetar a tela de login no primeiro acesso
      applyDarkMode(false);
    }catch(e){
      applyDarkMode(false);
    }
  }

  // ── Busca global Ctrl+K ─────────────────────────────────────────────────
  let searchIdx = -1;

  function openSearchModal(){
    $("searchModal").classList.add("show");
    setTimeout(()=>{ $("searchModalInput").focus(); $("searchModalInput").value=""; runGlobalSearch(""); },50);
    document.body.style.overflow = "hidden";
  }
  function closeSearchModal(){
    $("searchModal").classList.remove("show");
    document.body.style.overflow = "";
    searchIdx = -1;
  }
  function runGlobalSearch(q){
    searchIdx = -1;
    const el = $("searchResults"); if(!el) return;
    if(!q.trim()){
      el.innerHTML = `<div style="padding:18px;text-align:center;color:#9fb3c8;font-size:13px;font-weight:700;">Digite para buscar em todos os processos seletivos</div>`;
      return;
    }
    const ql = low(q);
    const results = rows.filter(r=>[r.edital,r.unidade,r.etapa,r.status,r.uf,r.risco,r.ciclo,r.responsavel,r.observacoes].map(low).join(" ").includes(ql)).slice(0,12);
    if(!results.length){ el.innerHTML=`<div style="padding:18px;text-align:center;color:#9fb3c8;font-size:13px;font-weight:700;">Nenhum resultado encontrado</div>`; return; }
    el.innerHTML = results.map((r,i)=>{
      const risco = low(r.risco);
      const riscoColor = risco==="alto"?"#d92d3a":risco==="médio"||risco==="medio"?"#f2b705":"#0b8f58";
      const riscoText  = risco==="alto"?"Alto":risco==="médio"||risco==="medio"?"Médio":"Baixo";
      return `<div class="search-result-item" data-idx="${i}" data-id="${attr(r.id)}" onclick="selectSearchResult('${attr(r.id)}')" onmouseenter="searchIdx=${i};highlightSearchItems()">
        <div class="search-result-icon" style="background:#f0f7ff"><i class="fa-solid fa-folder-open" style="color:#0075c9"></i></div>
        <div class="search-result-body">
          <div class="search-result-title">${esc(r.edital||"-")} — ${esc(r.unidade)}</div>
          <div class="search-result-sub">${esc(r.etapa||"")}${r.uf?" · "+r.uf:""}</div>
        </div>
        <span class="search-result-chip" style="background:${riscoColor}1a;color:${riscoColor};border:1px solid ${riscoColor}40">${riscoText}</span>
      </div>`;
    }).join("");
  }
  function highlightSearchItems(){
    document.querySelectorAll(".search-result-item").forEach((el,i)=>el.classList.toggle("active", i===searchIdx));
  }
  function searchModalKey(e){
    const items = [...document.querySelectorAll(".search-result-item")];
    if(e.key==="Escape"){ closeSearchModal(); return; }
    if(e.key==="ArrowDown"){ e.preventDefault(); searchIdx=Math.min(searchIdx+1,items.length-1); highlightSearchItems(); items[searchIdx]?.scrollIntoView({block:"nearest"}); return; }
    if(e.key==="ArrowUp")  { e.preventDefault(); searchIdx=Math.max(searchIdx-1,0); highlightSearchItems(); items[searchIdx]?.scrollIntoView({block:"nearest"}); return; }
    if(e.key==="Enter" && searchIdx>=0){ const item=items[searchIdx]; if(item) selectSearchResult(item.dataset.id); }
  }
  function selectSearchResult(id){
    closeSearchModal();
    const r = rows.find(x=>String(x.id)===String(id));
    if(!r) return;

    if(!can("ind")){
      toast("Busca localizada, mas seu perfil não tem acesso ao dashboard de Saúde Indígena.","warn");
      return;
    }

    // Garante que o item escolhido fique visível, mesmo se havia filtros/busca ativos.
    FILTER_CONFIG.forEach(cfg=>{ filterState[cfg.field] = new Set(); });
    if($("tableSearch")) $("tableSearch").value = "";
    if(r.unidade) filterState.unidade = new Set([txt(r.unidade)]);
    if(r.edital)  filterState.edital  = new Set([txt(r.edital)]);

    navigate("dashboard");
    applyFilters();

    setTimeout(()=>{
      const rows2 = document.querySelectorAll("#monitorRows tr");
      rows2.forEach(tr=>{
        if(tr.textContent.includes(r.edital||"") && tr.textContent.includes(r.unidade||"")){
          tr.scrollIntoView({behavior:"smooth",block:"center"});
          tr.style.outline = "2px solid var(--agsus-ciano)";
          tr.style.borderRadius = "8px";
          setTimeout(()=>{ tr.style.outline=""; tr.style.borderRadius=""; },2500);
        }
      });
    },400);
  }

  // ── Realtime Supabase ───────────────────────────────────────────────────
  let realtimeChannel = null;
  let realtimeEnabled = false;
  function startRealtime(){
    if(!sb || !currentUser) return;
    if(!cfgBool("feature_realtime_monitoramento", true)) return;
    if(realtimeChannel) return;
    try{
      realtimeChannel = sb
        .channel("monitoramento_changes")
        .on("postgres_changes",
          { event:"*", schema:"public", table:"monitoramento_indigena" },
          () => {
            // Debounce: evita múltiplas chamadas em rajada
            clearTimeout(window.__realtimeDebounce);
            window.__realtimeDebounce = setTimeout(async () => {
              await loadData({ showLoader:false });
              toast("Dashboard atualizado automaticamente.", "ok");
            }, 800);
          }
        )
        .subscribe((status) => {
          realtimeEnabled = (status === "SUBSCRIBED");
        });
    }catch(e){
      console.warn("Realtime não disponível:", e);
      realtimeChannel = null;
    }
  }
  function stopRealtime(){
    clearTimeout(window.__realtimeDebounce);
    if(realtimeChannel && sb){
      try{ sb.removeChannel(realtimeChannel); }catch(e){}
      realtimeChannel = null;
      realtimeEnabled = false;
    }
  }

  window.addEventListener("resize",()=>{ clearTimeout(window.__responsiveResize); window.__responsiveResize=setTimeout(()=>{ enforceResponsiveSidebar(); if(currentView==="dashboard") scheduleMapResize(80); },220); });
  window.addEventListener("orientationchange",()=>{ setTimeout(()=>{ enforceResponsiveSidebar(); if(currentView==="dashboard") scheduleMapResize(80); },300); });

  // Indicador de conexão (offline)
  function updateOnlineStatus(){
    const bar=$("offlineBar"); if(!bar) return;
    const off = (typeof navigator!=="undefined" && navigator.onLine===false);
    bar.style.display = off ? "block" : "none";
    document.body.style.paddingTop = off ? "32px" : "";
  }
  window.addEventListener("online", ()=>{ updateOnlineStatus(); toast("Conexão restabelecida."); });
  window.addEventListener("offline", ()=>{ updateOnlineStatus(); toast("Você está offline. Os dados continuam visíveis."); });
  updateOnlineStatus();

  // Ctrl+K / Cmd+K abre busca global
  document.addEventListener("keydown", e=>{
    if((e.ctrlKey||e.metaKey) && e.key==="k"){
      e.preventDefault();
      if($("searchModal").classList.contains("show")) closeSearchModal();
      else if(currentUser) openSearchModal();
    }
    if(e.key==="Escape" && $("searchModal").classList.contains("show")) closeSearchModal();
  });
  // Fechar modal de busca ao clicar fora
  $("searchModal")?.addEventListener("click", e=>{ if(e.target===$("searchModal")) closeSearchModal(); });

  // Esc fecha o modal de edição; clique no backdrop também fecha.
  document.addEventListener("keydown", e=>{
    if(e.key !== "Escape") return;
    if($("editModal")?.classList.contains("show")) closeEditModal();
  });
  $("editModal")?.addEventListener("click", e=>{ if(e.target===$("editModal")) closeEditModal(); });

  loadDarkModePreference();
  enforceResponsiveSidebar();
  initFilterControls();
  Object.defineProperty(window, "searchIdx", {
    configurable: true,
    get(){ return searchIdx; },
    set(value){ searchIdx = Number(value) || 0; }
  });
  Object.assign(window, {
    $,
    aplicarCnesCoords,
    approveAccessRequest,
    clearFilters,
    clearFilterField,
    clearSearchPill,
    closeEditModal,
    closeMoreActions,
    closeSearchModal,
    debouncedNucleo,
    debouncedSearch,
    denyAccessRequest,
    exitExternalPanel,
    exportCSV,
    exportPDF,
    highlightSearchItems,
    login,
    loginWithGoogle,
    logout,
    navigate,
    openEditModal,
    previewCnesCoords,
    previewImg,
    refreshData,
    reloadExternal,
    removeFilterPill,
    runGlobalSearch,
    saveAdminSettings,
    saveEdital,
    searchModalKey,
    selectAllFilterValues,
    selectSearchResult,
    sortDetails,
    submitAccessRequest,
    toggleBrowserFullscreen,
    toggleColMenu,
    toggleCriticalRiskFilter,
    toggleDarkMode,
    toggleExecutiveMode,
    toggleFilterMenu,
    toggleFilters,
    toggleHideClosed,
    toggleMoreActions,
    toggleObs,
    togglePassword,
    toggleSelectFilter,
    toggleSidebar
  });
  boot();
