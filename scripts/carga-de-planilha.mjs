/*
  CARGA DE PLANILHA DO GOOGLE -> SUPABASE: O QUE AS CARGAS TÊM EM COMUM

  Usado por scripts/sincronizar-entrevistas.mjs e scripts/sincronizar-selecao.mjs:
  a credencial (conta de serviço do Google), a leitura de uma aba pela API do
  Sheets (só leitura), a chamada das RPCs de carga com a service_role e o
  resumo que aparece no terminal e na página da execução do GitHub Actions.
  Sem dependências: o token do Google é assinado com node:crypto.

  Variáveis (do ambiente; na máquina, também do .env.local da raiz, que o git
  ignora — o que já estiver no ambiente vale mais)
    GOOGLE_SERVICE_ACCOUNT_JSON     conteúdo do JSON da conta de serviço (no Actions)
    GOOGLE_APPLICATION_CREDENTIALS  ou o caminho do arquivo JSON (na máquina)
    SUPABASE_URL                    https://<projeto>.supabase.co (aceita VITE_SUPABASE_URL)
    SUPABASE_SERVICE_ROLE_KEY       chave service_role (não precisa com --seco)

  Guia para quem for operar: docs/sincronizacao-das-planilhas.md.
*/
import { createSign } from "node:crypto";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

const ESCOPO = "https://www.googleapis.com/auth/spreadsheets.readonly";
const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const GUIA = "docs/sincronizacao-das-planilhas.md";
/** Tempo máximo de cada chamada HTTP: conexão pendurada não come os 10 min do job. */
const TEMPO_LIMITE_MS = 60_000;

/** `--seco` (só lê) e `--forcar` (aceita carga pequena). */
export function argumentos(lista = process.argv.slice(2)) {
  const args = new Set(lista);
  return { seco: args.has("--seco"), forcar: args.has("--forcar") };
}

/* Na máquina, lê o .env.local sem sobrescrever o que já veio do ambiente. */
export function carregarEnvLocal() {
  const arquivo = resolve(RAIZ, ".env.local");
  if (!existsSync(arquivo)) return;
  const valores = parseEnv(readFileSync(arquivo, "utf8"));
  for (const [nome, valor] of Object.entries(valores)) {
    if (process.env[nome] === undefined) process.env[nome] = valor;
  }
}

export function contaDeServico() {
  let bruto = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim() || "";
  if (!bruto && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const caminho = process.env.GOOGLE_APPLICATION_CREDENTIALS.trim();
    const absoluto = isAbsolute(caminho) ? caminho : resolve(RAIZ, caminho);
    if (!existsSync(absoluto)) {
      throw new Error(
        `A credencial do Google não está em ${absoluto}. Confira GOOGLE_APPLICATION_CREDENTIALS no .env.local (veja ${GUIA}).`,
      );
    }
    bruto = readFileSync(absoluto, "utf8");
  }
  if (!bruto) {
    throw new Error(
      `Falta a credencial do Google: ponha GOOGLE_APPLICATION_CREDENTIALS=<caminho do JSON> no .env.local (veja ${GUIA}).`,
    );
  }
  const conta = JSON.parse(bruto);
  if (
    conta.type !== "service_account" ||
    !conta.client_email ||
    !conta.private_key
  ) {
    throw new Error("O JSON do Google não é de uma conta de serviço.");
  }
  return conta;
}

const base64url = (valor) => Buffer.from(valor).toString("base64url");

export async function tokenDoGoogle(conta) {
  const agora = Math.floor(Date.now() / 1000);
  const tokenUri = conta.token_uri || "https://oauth2.googleapis.com/token";
  const cabecalho = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const corpo = base64url(
    JSON.stringify({
      iss: conta.client_email,
      scope: ESCOPO,
      aud: tokenUri,
      iat: agora,
      exp: agora + 3600,
    }),
  );
  const assinatura = createSign("RSA-SHA256")
    .update(`${cabecalho}.${corpo}`)
    .sign(conta.private_key, "base64url");

  const resposta = await fetch(tokenUri, {
    method: "POST",
    signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${cabecalho}.${corpo}.${assinatura}`,
    }),
  });
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok || !dados.access_token) {
    throw new Error(
      `Google recusou a conta de serviço (${resposta.status}): ${dados.error_description || dados.error || "sem detalhe"}`,
    );
  }
  return dados.access_token;
}

/** Os valores formatados de uma aba (matriz de textos, com o cabeçalho). */
export async function lerAba(token, conta, { idGoogle, aba }) {
  const faixa = encodeURIComponent(`'${aba}'`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${idGoogle}/values/${faixa}?valueRenderOption=FORMATTED_VALUE&majorDimension=ROWS`;
  const resposta = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
  });
  const dados = await resposta.json().catch(() => ({}));
  if (resposta.status === 403 || resposta.status === 404) {
    throw new Error(
      `Sem acesso à planilha (${resposta.status}): ${dados.error?.message || ""}\n` +
        `Confira se a API do Google Sheets está ativada no projeto ${conta.project_id} ` +
        `e se a planilha está compartilhada (leitor) com ${conta.client_email}.`,
    );
  }
  if (!resposta.ok) {
    throw new Error(
      `API do Sheets respondeu ${resposta.status}: ${dados.error?.message || "sem detalhe"}`,
    );
  }
  return dados.values || [];
}

export function configuracaoDoSupabase(workflow) {
  const url = String(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "",
  ).replace(/\/$/, "");
  const chave = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!/^https:\/\//.test(url))
    throw new Error("Falta SUPABASE_URL (https://…).");
  if (!chave) {
    throw new Error(
      "Falta SUPABASE_SERVICE_ROLE_KEY. Para gravar no banco, use o botão Run workflow " +
        `do GitHub (Actions → ${workflow}); na máquina, rode com --seco (veja ${GUIA}).`,
    );
  }
  return { url, chave };
}

/**
  Só `code` e `message` do erro do PostgREST. `details` e `hint` ficam de fora:
  o Postgres põe neles a linha recusada inteira ("Failing row contains (...)"),
  com nome e e-mail do candidato, e o log do Actions é público.
*/
export function textoDoErro(texto) {
  let corpo;
  try {
    corpo = JSON.parse(texto);
  } catch {
    return "resposta sem JSON";
  }
  if (!corpo || typeof corpo !== "object") return "resposta sem JSON";
  const codigo = String(corpo.code || "").trim();
  const mensagem = String(corpo.message || "").trim();
  if (codigo && mensagem) return `${codigo}: ${mensagem}`;
  return codigo || mensagem || "erro sem mensagem";
}

export async function chamarRpc(
  { url, chave },
  funcao,
  corpo,
  {
    buscar = fetch,
    esperar = (ms) => new Promise((r) => setTimeout(r, ms)),
  } = {},
) {
  let ultimoErro = null;
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    let resposta;
    try {
      resposta = await buscar(`${url}/rest/v1/rpc/${funcao}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: chave,
          Authorization: `Bearer ${chave}`,
        },
        body: JSON.stringify(corpo),
        signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
      });
    } catch (erro) {
      // Rede caiu ou estourou o tempo: repete, como o 5xx.
      ultimoErro = new Error(
        `${funcao} sem resposta: ${erro?.name || "erro de rede"}`,
      );
      await esperar(1500 * tentativa);
      continue;
    }
    const texto = await resposta.text();
    if (resposta.ok) return texto ? JSON.parse(texto) : null;
    ultimoErro = new Error(
      `${funcao} respondeu ${resposta.status}: ${textoDoErro(texto)}`,
    );
    // Erro do banco (4xx) não melhora repetindo; só rede/servidor (5xx).
    if (resposta.status < 500) break;
    await esperar(1500 * tentativa);
  }
  throw ultimoErro;
}

/** Resumo no terminal e, no GitHub Actions, na página da execução. */
export function resumir(titulo, linhas) {
  const saida = [`## ${titulo}`, ""];
  for (const l of linhas) saida.push(`- ${l}`);
  const texto = saida.join("\n");
  console.log(texto);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${texto}\n`);
  }
}

/** Roda a carga: 0 concluída; 1 erro; 2 recusada (o que `principal` devolver). */
export function rodar(principal) {
  principal().then(
    (codigo) => process.exit(codigo),
    (erro) => {
      console.error(erro?.message || erro);
      process.exit(1);
    },
  );
}
