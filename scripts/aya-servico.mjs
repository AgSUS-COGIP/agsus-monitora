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
import { urlDoTunel } from "./endereco-do-tunel.mjs";

const RAIZ = fileURLToPath(new URL("../", import.meta.url));
const PORTA_BRIDGE = Number(process.env.AYA_BRIDGE_PORT || 8787);
const INTERVALO_BATIMENTO_MS = 5 * 60 * 1000;
const ESPERA_REINICIO_MS = 5000;
const TEMPO_LIMITE_DA_SONDA_MS = 8000;
// "it may take some time to be reachable", diz o próprio cloudflared ao criar
// um quick tunnel. Medido nesta máquina: o hostname passa a resolver em menos
// de um segundo, mas a margem é larga porque errar aqui derruba um túnel bom.
const TENTATIVAS_DE_SONDA = 12;
const ESPERA_ENTRE_SONDAS_MS = 5000;
// Resolvedor público por HTTPS. Ver o comentário de `hostnameDoTunelExiste`.
const DNS_PUBLICO = "https://dns.google/resolve";

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
  O TÚNEL PODE MORRER SEM QUE O CLOUDFLARED MORRA

  O batimento reanunciava `urlAtual` de cinco em cinco minutos sem nunca
  perguntar se aquele endereço ainda existia. E um quick tunnel é derrubado do
  lado da Cloudflare: o hostname deixa de resolver e o processo local continua
  de pé, sem sair, sem erro, sem nada que o `on("exit")` abaixo pudesse ouvir.

  A partir daí o serviço anunciava um endereço morto para sempre — e sempre
  fresco, de modo que a defesa do outro lado, que recusa registo com mais de 30
  minutos, nunca disparava: ela distingue máquina presente de registo velho, e
  este registo era novo e falso ao mesmo tempo. A Aya ficava sem IA sem que
  nada no log dissesse porquê. Foi o caso de
  `special-considers-tips-immigration`, anunciado durante horas sem resolver.

  POR QUE A PERGUNTA VAI A UM RESOLVEDOR PÚBLICO, E NÃO AO DA REDE

  A primeira versão desta defesa buscava `${url}/health` e ficava por aí. Nesta
  máquina isso derrubava túnel bom em ciclo: o resolvedor da rede local não
  resolve `*.trycloudflare.com` de todo. Medido no mesmo hostname, no mesmo
  instante:

      resolvedor da rede     não encontrou
      1.1.1.1 e 8.8.8.8      104.16.230.132, 104.16.231.132

  Quem lê este anúncio é a função em `/api/aya`, que resolve pela rede dela, e
  não por esta. Perguntar ao resolvedor local seria julgar o túnel por um
  impedimento que não é dele.

  Por isso a pergunta vai por DNS-over-HTTPS, que atravessa o resolvedor da
  rede, e é só sobre existir: NXDOMAIN é o sinal de que o túnel acabou.
  Qualquer outra coisa — rede fora, resolvedor sem resposta — devolve `null`,
  e sem veredito não se derruba nada. Falso negativo aqui custa uma troca de
  túnel à toa; falso positivo custa a Aya inteira.
*/
async function hostnameDoTunelExiste(url) {
  let hostname = "";
  try {
    hostname = new URL(url).hostname;
  } catch {
    return null;
  }

  try {
    const resposta = await fetch(
      `${DNS_PUBLICO}?name=${encodeURIComponent(hostname)}&type=A`,
      {
        headers: { Accept: "application/dns-json" },
        signal: AbortSignal.timeout(TEMPO_LIMITE_DA_SONDA_MS),
      },
    );
    if (!resposta.ok) return null;
    const dados = await resposta.json();
    // 3 é NXDOMAIN: o nome não existe. É o único veredito negativo que aceitamos.
    if (dados?.Status === 3) return false;
    if (dados?.Status !== 0) return null;
    return Array.isArray(dados.Answer) && dados.Answer.length > 0;
  } catch {
    return null;
  }
}

const dormir = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

/*
  Um hostname acabado de criar leva um instante a existir. Anunciá-lo antes
  disso é prometer uma IA que ninguém alcança.
*/
async function esperarOTunelAbrir(url) {
  for (let tentativa = 1; tentativa <= TENTATIVAS_DE_SONDA; tentativa += 1) {
    if ((await hostnameDoTunelExiste(url)) === true) return true;
    if (tentativa < TENTATIVAS_DE_SONDA) await dormir(ESPERA_ENTRE_SONDAS_MS);
  }
  return false;
}

/*
  O cloudflared imprime a URL do quick tunnel no stderr, dentro de uma moldura.
  Não há saída estruturada: extrair do texto é a via disponível.

  Nem todo `*.trycloudflare.com` que aparece ali é o túnel: quem separa uns
  dos outros é `urlDoTunel`, em `endereco-do-tunel.mjs`.
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
    const url = urlDoTunel(pedaco);
    if (!url || anunciado) return;
    anunciado = true;
    aoObterUrl(url);
  };
  processo.stdout.on("data", procurar);
  processo.stderr.on("data", procurar);

  processo.on("exit", (codigo) => {
    log(`túnel encerrou (código ${codigo}); reiniciando`);
    // Um túnel novo recebe hostname novo, então o anúncio tem de repetir.
    setTimeout(() => {
      processoDoTunel = subirTunel(aoObterUrl);
    }, ESPERA_REINICIO_MS);
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
let processoDoTunel = null;
subirBridge();
processoDoTunel = subirTunel(async (url) => {
  if (!(await esperarOTunelAbrir(url))) {
    log(`o túnel ${url} não abriu; derrubando para pegar outro`);
    processoDoTunel?.kill();
    return;
  }
  urlAtual = url;
  await registrarUrl(url);
});

/*
  Sem `unref`: o batimento é uma das âncoras que mantêm o serviço vivo. Se o
  túnel estiver entre uma queda e o reinício, é a única.

  Ele confere antes de anunciar. Ver o comentário de `hostnameDoTunelExiste`:
  anunciar sem conferir foi o que deixou a Aya horas sem IA com o log a dizer
  que estava tudo bem.
*/
setInterval(async () => {
  if (!urlAtual) return;

  // Só NXDOMAIN derruba. Sem veredito, continua-se a anunciar o que se tem.
  if ((await hostnameDoTunelExiste(urlAtual)) === false) {
    log(`o túnel ${urlAtual} deixou de existir; derrubando para pegar outro`);
    urlAtual = "";
    processoDoTunel?.kill();
    return;
  }

  await registrarUrl(urlAtual);
}, INTERVALO_BATIMENTO_MS);

for (const sinal of ["SIGINT", "SIGTERM"]) {
  process.on(sinal, () => {
    log("encerrando");
    process.exit(0);
  });
}
