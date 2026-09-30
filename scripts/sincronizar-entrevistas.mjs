/*
  SINCRONIZAR ENTREVISTAS: PLANILHA -> SUPABASE

  Lê a aba Entrevistados da planilha "[dash] entrevistados" com a conta de
  serviço do Google (API do Sheets, só leitura) e envia para o banco pelas
  mesmas RPCs que o Apps Script usava: `sincronizar_entrevistas` em lotes de
  500 e `finalizar_sync_entrevistas` no fim. As tabelas (TB_ENTREVISTA,
  TB_ENTREVISTA_NOTA, TL_SYNC_ENTREVISTA) não mudam; muda só quem as alimenta.
  Roda todo dia às 9h pelo GitHub Actions (.github/workflows/sincronizar-entrevistas.yml).

  Onde está a planilha: `PLANILHAS.entrevistados` em src/lib/planilhas.js.
  Como a aba vira linhas: src/lib/entrevistas-da-planilha.js.

  Guia para quem for operar: docs/sincronizacao-das-entrevistas.md.

  Variáveis (do ambiente; na máquina, também do .env.local da raiz, que o git
  ignora — o que já estiver no ambiente vale mais)
    GOOGLE_SERVICE_ACCOUNT_JSON   conteúdo do JSON da conta de serviço (no Actions)
    GOOGLE_APPLICATION_CREDENTIALS  ou o caminho do arquivo JSON (na máquina)
    SUPABASE_URL                  https://<projeto>.supabase.co (aceita VITE_SUPABASE_URL)
    SUPABASE_SERVICE_ROLE_KEY     chave service_role (não precisa com --seco)

  Uso
    node scripts/sincronizar-entrevistas.mjs --seco    só lê a planilha e mostra o resumo
    node scripts/sincronizar-entrevistas.mjs           lê e grava no banco
    node scripts/sincronizar-entrevistas.mjs --forcar  aceita carga com menos da metade
                                                       das linhas ativas (confira antes)

  Saída: 0 concluída; 1 erro; 2 carga recusada pelo banco (menos da metade das
  linhas ativas — nada foi desativado).
*/
import { createSign, randomUUID } from "node:crypto";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { PLANILHAS } from "../src/lib/planilhas.js";
import {
  emLotes,
  identificadorDaCarga,
  linhasDaAbaEntrevistados,
} from "../src/lib/entrevistas-da-planilha.js";

const ESCOPO = "https://www.googleapis.com/auth/spreadsheets.readonly";
const TAMANHO_DO_LOTE = 500;

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const GUIA = "docs/sincronizacao-das-entrevistas.md";

const args = new Set(process.argv.slice(2));
const SECO = args.has("--seco");
const FORCAR = args.has("--forcar");

/* Na máquina, lê o .env.local sem sobrescrever o que já veio do ambiente. */
function carregarEnvLocal() {
  const arquivo = resolve(RAIZ, ".env.local");
  if (!existsSync(arquivo)) return;
  const valores = parseEnv(readFileSync(arquivo, "utf8"));
  for (const [nome, valor] of Object.entries(valores)) {
    if (process.env[nome] === undefined) process.env[nome] = valor;
  }
}

function contaDeServico() {
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

async function tokenDoGoogle(conta) {
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

async function lerAba(token, conta) {
  const { idGoogle, aba } = PLANILHAS.entrevistados;
  const faixa = encodeURIComponent(`'${aba}'`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${idGoogle}/values/${faixa}?valueRenderOption=FORMATTED_VALUE&majorDimension=ROWS`;
  const resposta = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
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

function configuracaoDoSupabase() {
  const url = String(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "",
  ).replace(/\/$/, "");
  const chave = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!/^https:\/\//.test(url))
    throw new Error("Falta SUPABASE_URL (https://…).");
  if (!chave) {
    throw new Error(
      "Falta SUPABASE_SERVICE_ROLE_KEY. Para gravar no banco, use o botão Run workflow " +
        `do GitHub (Actions → Sincronizar entrevistas); na máquina, rode com --seco (veja ${GUIA}).`,
    );
  }
  return { url, chave };
}

async function chamarRpc({ url, chave }, funcao, corpo) {
  let ultimoErro = null;
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    const resposta = await fetch(`${url}/rest/v1/rpc/${funcao}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: chave,
        Authorization: `Bearer ${chave}`,
      },
      body: JSON.stringify(corpo),
    });
    const texto = await resposta.text();
    if (resposta.ok) return texto ? JSON.parse(texto) : null;
    ultimoErro = new Error(
      `${funcao} respondeu ${resposta.status}: ${texto.slice(0, 500)}`,
    );
    // Erro do banco (4xx) não melhora repetindo; só rede/servidor (5xx).
    if (resposta.status < 500) break;
    await new Promise((r) => setTimeout(r, 1500 * tentativa));
  }
  throw ultimoErro;
}

function resumir(linhas) {
  const saida = [`## Entrevistas: planilha → MONITORA`, ""];
  for (const l of linhas) saida.push(`- ${l}`);
  const texto = saida.join("\n");
  console.log(texto);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${texto}\n`);
  }
}

async function principal() {
  carregarEnvLocal();
  const conta = contaDeServico();
  const supabase = SECO ? null : configuracaoDoSupabase();

  const token = await tokenDoGoogle(conta);
  const valores = await lerAba(token, conta);
  const linhas = linhasDaAbaEntrevistados(valores);
  if (!linhas.length) {
    throw new Error(
      `A aba "${PLANILHAS.entrevistados.aba}" não tem linhas para enviar.`,
    );
  }

  if (SECO) {
    const comCodigo = linhas.filter((l) => l.codigo).length;
    const comNotas = linhas.filter((l) => l.notas.length).length;
    resumir([
      "Modo seco: nada foi enviado ao banco.",
      `Linhas na aba (com cabeçalho): ${valores.length}`,
      `Linhas válidas para enviar: ${linhas.length}`,
      `Com código do candidato: ${comCodigo} · com notas por critério: ${comNotas}`,
      `Lotes de ${TAMANHO_DO_LOTE}: ${emLotes(linhas, TAMANHO_DO_LOTE).length}`,
    ]);
    return 0;
  }

  const sync = identificadorDaCarga(new Date(), randomUUID());
  const area = PLANILHAS.entrevistados.area;
  let gravadas = 0;
  for (const lote of emLotes(linhas, TAMANHO_DO_LOTE)) {
    const r = await chamarRpc(supabase, "sincronizar_entrevistas", {
      p_sync: sync,
      p_area: area,
      p_linhas: lote,
    });
    gravadas += Number(r?.gravadas || 0);
  }

  const fim = await chamarRpc(supabase, "finalizar_sync_entrevistas", {
    p_sync: sync,
    p_area: area,
    p_forcar: FORCAR,
  });

  if (fim?.situacao !== "CONCLUIDA") {
    resumir([
      `Carga ${sync} RECUSADA: a planilha trouxe ${fim?.linhas} linhas e o banco tem ${fim?.ativas} ativas (menos da metade).`,
      "Nada foi desativado. Confira a aba Entrevistados; se estiver certa, rode de novo com --forcar.",
    ]);
    return 2;
  }

  resumir([
    `Carga ${sync} concluída${FORCAR ? " (com forçar)" : ""}.`,
    `Linhas lidas: ${linhas.length} · gravadas: ${gravadas}`,
    `Ligadas à análise curricular: ${fim.ligadas_analise}`,
    `Sem análise encontrada: ${fim.sem_analise}`,
    `Sem edital cadastrado: ${fim.sem_edital}`,
    `Saíram da planilha (desativadas): ${fim.desativadas}`,
  ]);
  return 0;
}

principal().then(
  (codigo) => process.exit(codigo),
  (erro) => {
    console.error(erro?.message || erro);
    process.exit(1);
  },
);
