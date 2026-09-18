/*
  Serviço da Aya: sobe o bridge, sobe o túnel, anuncia o endereço e mantém tudo
  de pé.

  O PROBLEMA QUE ESTE ARQUIVO RESOLVE

  Sem domínio próprio, o túnel é um quick tunnel da Cloudflare, que sorteia um
  hostname novo a cada execução. O endereço vivia numa variável da Vercel, então
  todo reinício da máquina exigia reconfigurar a variável e redeployar à mão. Na
  prática, a Aya ficava sem IA até alguém perceber.

  Aqui o endereço deixa de ser configuração e vira fato anunciado: assim que o
  túnel sobe, o serviço grava a URL no banco pela RPC `registrar_bridge_aya`, e
  a `/api/aya` lê de lá.

  O QUE ELE VIGIA

  O bridge e o cloudflared são reiniciados se caírem. Um túnel novo tem hostname
  novo, então todo reinício do cloudflared é seguido de novo anúncio. O batimento
  periódico serve para outra coisa: renova `atualizado_em`, que é como a
  `/api/aya` distingue "a máquina está ligada" de "o registro é velho".
*/

import { spawn } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = fileURLToPath(new URL("../", import.meta.url));
const PORTA_BRIDGE = Number(process.env.AYA_BRIDGE_PORT || 8787);
const INTERVALO_BATIMENTO_MS = 5 * 60 * 1000;
const ESPERA_REINICIO_MS = 5000;

function agora() {
  return new Date().toISOString().slice(11, 19);
}

function log(mensagem) {
  console.log(`[${agora()}] ${mensagem}`);
}

/*
  Lê `.env.local` sem dependência externa. Só precisamos das duas variáveis
  públicas do Supabase; variável já presente no ambiente tem precedência.
*/
function carregarEnvLocal() {
  for (const nome of [".env.local", ".env"]) {
    const caminho = join(RAIZ, nome);
    if (!existsSync(caminho)) continue;
    for (const linha of readFileSync(caminho, "utf8").split(/\r?\n/)) {
      const par = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!par) continue;
      const valor = par[2].replace(/^["']|["']$/g, "");
      if (!process.env[par[1]]) process.env[par[1]] = valor;
    }
  }
}

/*
  O cloudflared do wrangler fica sob um diretório com a versão no nome, que muda
  a cada atualização. Procurar é mais estável que fixar o caminho.
*/
function acharCloudflared() {
  if (process.env.CLOUDFLARED_PATH) return process.env.CLOUDFLARED_PATH;
  const base = join(
    process.env.APPDATA || "",
    "xdg.config",
    ".wrangler",
    "cloudflared",
  );
  if (!existsSync(base)) return null;
  for (const entrada of readdirSync(base)) {
    const alvo = join(base, entrada, "cloudflared.exe");
    if (existsSync(alvo) && statSync(alvo).isFile()) return alvo;
  }
  return null;
}

async function registrarUrl(url) {
  const supabaseUrl = String(process.env.VITE_SUPABASE_URL || "").replace(
    /\/$/,
    "",
  );
  const chavePublicavel = String(
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      "",
  );
  const segredo = String(process.env.AYA_LOCAL_BRIDGE_KEY || "");

  if (!supabaseUrl || !chavePublicavel) {
    log("sem VITE_SUPABASE_URL/VITE_SUPABASE_PUBLISHABLE_KEY: anúncio pulado");
    return false;
  }

  try {
    const resposta = await fetch(
      `${supabaseUrl}/rest/v1/rpc/registrar_bridge_aya`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: chavePublicavel,
          Authorization: `Bearer ${chavePublicavel}`,
        },
        body: JSON.stringify({ p_chave: segredo, p_url: url }),
        signal: AbortSignal.timeout(10000),
      },
    );
    const texto = (await resposta.text()).replace(/^"|"$/g, "").trim();
    if (!resposta.ok) {
      log(`anúncio recusado pelo banco (HTTP ${resposta.status}): ${texto}`);
      return false;
    }
    if (texto !== "ok") {
      // `segredo_nao_definido` é o estado normal antes de alguém rodar
      // `definir_segredo_bridge_aya` uma vez. Não é erro de execução.
      log(`anúncio não aceito: ${texto}`);
      return false;
    }
    log(`endereço anunciado: ${url}`);
    return true;
  } catch (erro) {
    log(`falha ao anunciar: ${erro?.message || erro}`);
    return false;
  }
}

function subirBridge() {
  log("subindo o bridge");
  const processo = spawn(process.execPath, ["scripts/aya-local-bridge.mjs"], {
    cwd: RAIZ,
    stdio: ["ignore", "inherit", "inherit"],
    env: process.env,
  });
  processo.on("exit", (codigo) => {
    log(`bridge encerrou (código ${codigo}); reiniciando`);
    setTimeout(subirBridge, ESPERA_REINICIO_MS);
  });
  return processo;
}

/*
  O cloudflared imprime a URL do quick tunnel no stderr, dentro de uma moldura.
  Não há saída estruturada: extrair do texto é a via disponível.
*/
function subirTunel(aoObterUrl) {
  const executavel = acharCloudflared();
  if (!executavel) {
    log("cloudflared não encontrado; defina CLOUDFLARED_PATH");
    return null;
  }

  log("subindo o túnel");
  const processo = spawn(
    executavel,
    [
      "tunnel",
      "--no-autoupdate",
      "--url",
      `http://127.0.0.1:${PORTA_BRIDGE}`,
      "--loglevel",
      "info",
    ],
    { cwd: RAIZ, stdio: ["ignore", "pipe", "pipe"] },
  );

  let anunciado = false;
  const procurar = (pedaco) => {
    const achado = String(pedaco).match(
      /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i,
    );
    if (achado && !anunciado) {
      anunciado = true;
      aoObterUrl(achado[0]);
    }
  };
  processo.stdout.on("data", procurar);
  processo.stderr.on("data", procurar);

  processo.on("exit", (codigo) => {
    log(`túnel encerrou (código ${codigo}); reiniciando`);
    // Um túnel novo recebe hostname novo, então o anúncio tem de repetir.
    setTimeout(() => subirTunel(aoObterUrl), ESPERA_REINICIO_MS);
  });
  return processo;
}

carregarEnvLocal();

if (!process.env.AYA_LOCAL_BRIDGE_KEY) {
  console.error(
    'Defina AYA_LOCAL_BRIDGE_KEY. No Windows, uma vez: setx AYA_LOCAL_BRIDGE_KEY "<chave>"',
  );
  process.exit(1);
}

let urlAtual = "";
subirBridge();
subirTunel(async (url) => {
  urlAtual = url;
  await registrarUrl(url);
});

// Sem `unref`: o batimento é uma das âncoras que mantêm o serviço vivo. Se o
// túnel estiver entre uma queda e o reinício, é a única.
setInterval(() => {
  if (urlAtual) registrarUrl(urlAtual);
}, INTERVALO_BATIMENTO_MS);

for (const sinal of ["SIGINT", "SIGTERM"]) {
  process.on(sinal, () => {
    log("encerrando");
    process.exit(0);
  });
}
