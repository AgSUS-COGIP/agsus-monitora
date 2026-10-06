/*
  /api/rodar-carga — "Rodar agora" das cargas do GitHub Actions (Configurações ›
  Status das atualizações) e dos dashboards de Seleção e Entrevistas.
  GET ?robo=selecao|entrevistas e POST desses robôs também aceitam editor/admin
  do módulo, conferido na RPC pode_atualizar_dashboard. O GET sem filtro continua
  exclusivo do administrador global; consultas por módulo só leem seu workflow.

    GET   → { configurado: true, robos: { empregare: { rodando, execucao }, … } }
            (se cada workflow tem execução na fila ou rodando no GitHub)
    POST  { robo: "empregare" | "selecao" | "entrevistas" | "conferencias"
                  | "pre_classificacao", edital?: <uuid> }
          → 202 { ok: true } depois de pedir o workflow_dispatch

  Quem pode: o Bearer do Supabase de quem clicou é conferido em /auth/v1/user e
  na RPC pode_disparar_carga (administrador global, migration 20261005170000),
  chamada com o próprio token — o banco decide, não o front. Robô por edital
  (a pré-classificação) com um edital no pedido: quem não é administrador
  global passa se pode_recalcular_pre_classificacao(p_edital) disser que
  coordena a avaliação daquele edital (migration 20261006110000); o workflow
  recebe editais = o id do edital. O GET (o que roda no GitHub) continua só do
  administrador global.

  Só robôs da lista fixa (ROBOS_DE_CARGA em src/lib/robos-de-carga.js: robô →
  arquivo do workflow); o workflow recebe modo "normal" e disparado_por = id do
  usuário (o log do banco guarda quem disparou; nada pessoal vai ao log público).

  Variáveis da Vercel:
    GITHUB_DISPATCH_TOKEN   fine-grained token só com "Actions: read and write"
                            no repositório agsus-monitora. Nunca vai ao front.
                            Sem ele: 503 { configurado: false }.
    VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY (ou _ANON_KEY): as mesmas do front.

  Guia: docs/robo-empregare.md. Testes: tests/rodar-carga-api.test.js.
*/
import { origemDeTerceiro } from "../src/lib/origem-da-requisicao.js";
import {
  editalDoPedido,
  execucaoEmCurso,
  inputsDoDisparo,
  MENSAGENS_DO_DISPARO,
  RAMO_DAS_CARGAS,
  RPC_PODE_ATUALIZAR_DASHBOARD,
  REPOSITORIO_DAS_CARGAS,
  ROBOS_DE_CARGA,
  roboDeCarga,
} from "../src/lib/robos-de-carga.js";

const GITHUB = "https://api.github.com";
const TEMPO_LIMITE_MS = 10000;

function responder(res, status, corpo) {
  res.status(status);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(corpo));
}

function configuracaoDoSupabase(ambiente) {
  const url = String(
    ambiente.VITE_SUPABASE_URL || ambiente.SUPABASE_URL || "",
  ).replace(/\/$/, "");
  const chave =
    ambiente.VITE_SUPABASE_PUBLISHABLE_KEY ||
    ambiente.VITE_SUPABASE_ANON_KEY ||
    "";
  return { url, chave };
}

/**
 * Confere o Bearer e a permissão no Supabase. Devolve { id, admin } de quem
 * pode, { erro: "sem_sessao" }, { erro: "sem_permissao" } ou, com `edital`
 * (robô por edital), { erro: "sem_permissao_edital" } — quem não é
 * administrador global passa se coordena a avaliação do edital.
 */
export async function administradorDaRequisicao(
  autorizacao,
  { ambiente = process.env, buscar = fetch, edital = "", modulo = "" } = {},
) {
  const texto = String(autorizacao || "");
  const token = /^bearer\s+/i.test(texto)
    ? texto.replace(/^bearer\s+/i, "").trim()
    : "";
  const { url, chave } = configuracaoDoSupabase(ambiente);
  if (!token || !/^https:\/\//.test(url) || !chave)
    return { erro: "sem_sessao" };
  const cabecalhos = { Authorization: `Bearer ${token}`, apikey: chave };
  try {
    const usuario = await buscar(`${url}/auth/v1/user`, {
      headers: cabecalhos,
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    });
    if (!usuario.ok) return { erro: "sem_sessao" };
    const { id } = await usuario.json();
    if (!id) return { erro: "sem_sessao" };
    const permissao = await buscar(`${url}/rest/v1/rpc/pode_disparar_carga`, {
      method: "POST",
      headers: { ...cabecalhos, "Content-Type": "application/json" },
      body: "{}",
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    });
    if (permissao.ok && (await permissao.json()) === true)
      return { id: String(id), admin: true };
    if (["selecao", "entrevistas"].includes(modulo)) {
      const doModulo = await buscar(
        `${url}/rest/v1/rpc/${RPC_PODE_ATUALIZAR_DASHBOARD}`,
        {
          method: "POST",
          headers: { ...cabecalhos, "Content-Type": "application/json" },
          body: JSON.stringify({ p_modulo: modulo }),
          signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
        },
      );
      if (doModulo.ok && (await doModulo.json()) === true)
        return { id: String(id), admin: false };
      return { erro: "sem_permissao_modulo" };
    }
    if (!edital) return { erro: "sem_permissao" };
    const doEdital = await buscar(
      `${url}/rest/v1/rpc/pode_recalcular_pre_classificacao`,
      {
        method: "POST",
        headers: { ...cabecalhos, "Content-Type": "application/json" },
        body: JSON.stringify({ p_edital: edital }),
        signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
      },
    );
    if (!doEdital.ok || (await doEdital.json()) !== true)
      return { erro: "sem_permissao_edital" };
    return { id: String(id), admin: false };
  } catch {
    return { erro: "sem_sessao" };
  }
}

const cabecalhosDoGithub = (token) => ({
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${token}`,
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "agsus-monitora-rodar-carga",
});

/** Execuções em curso de cada robô no GitHub. */
export async function situacaoNoGithub(
  token,
  { buscar = fetch, selecionado = null } = {},
) {
  const robos = {};
  for (const robo of selecionado ? [selecionado] : ROBOS_DE_CARGA) {
    const resposta = await buscar(
      `${GITHUB}/repos/${REPOSITORIO_DAS_CARGAS}/actions/workflows/${robo.workflow}/runs?per_page=5`,
      {
        headers: cabecalhosDoGithub(token),
        signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
      },
    );
    if (!resposta.ok) {
      const erro = new Error(`github ${resposta.status}`);
      erro.status = resposta.status;
      throw erro;
    }
    const dados = await resposta.json();
    const emCurso = execucaoEmCurso(dados?.workflow_runs);
    const ultima = emCurso || dados?.workflow_runs?.[0];
    robos[robo.id] = {
      rodando: Boolean(emCurso),
      execucao: emCurso?.html_url || null,
      ...(selecionado
        ? {
            ultima: ultima
              ? {
                  id: ultima.id,
                  status: ultima.status,
                  conclusao: ultima.conclusion,
                }
              : null,
          }
        : {}),
    };
  }
  return robos;
}

function lerCorpo(req) {
  if (req.body && typeof req.body === "object") return req.body;
  try {
    return JSON.parse(String(req.body || "{}"));
  } catch {
    return {};
  }
}

const falhaDoGithub = (status) =>
  [401, 403, 404, 422].includes(status) ? "github_recusou" : "github_fora";

export default async function handler(req, res, opcoes = {}) {
  const ambiente = opcoes.ambiente || process.env;
  const buscar = opcoes.buscar || fetch;

  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return responder(res, 405, { erro: "Use GET ou POST." });
  }
  if (origemDeTerceiro(req))
    return responder(res, 403, { erro: "Origem não permitida." });

  // O pedido por edital (Recalcular da coordenação) só vale no POST de um robô por edital.
  const corpo = req.method === "POST" ? lerCorpo(req) : {};
  const filtro = req.method === "GET" ? String(req.query?.robo || "") : "";
  const roboPedido = roboDeCarga(req.method === "POST" ? corpo.robo : filtro);
  if (filtro && !["selecao", "entrevistas"].includes(filtro))
    return responder(res, 400, { erro: MENSAGENS_DO_DISPARO.robo_invalido });
  const modulo = ["selecao", "entrevistas"].includes(roboPedido?.id)
    ? roboPedido.id
    : "";
  const textoDoEdital = String(corpo.edital ?? "").trim();
  const edital = roboPedido?.porEdital ? editalDoPedido(textoDoEdital) : "";
  if (roboPedido?.porEdital && textoDoEdital && !edital)
    return responder(res, 400, { erro: MENSAGENS_DO_DISPARO.edital_invalido });

  const quem = await administradorDaRequisicao(req.headers?.authorization, {
    ambiente,
    buscar,
    edital,
    modulo,
  });
  if (quem.erro === "sem_sessao")
    return responder(res, 401, { erro: MENSAGENS_DO_DISPARO.sem_sessao });
  if (quem.erro)
    return responder(res, 403, {
      erro:
        (quem.erro === "sem_permissao_modulo"
          ? "É necessário ser editor ou administrador deste módulo para atualizar os dados."
          : MENSAGENS_DO_DISPARO[quem.erro]) ||
        MENSAGENS_DO_DISPARO.sem_permissao,
    });

  const token = String(ambiente.GITHUB_DISPATCH_TOKEN || "").trim();
  if (!token)
    return responder(res, 503, {
      configurado: false,
      erro: MENSAGENS_DO_DISPARO.sem_token,
    });

  let robos;
  try {
    robos = await situacaoNoGithub(token, {
      buscar,
      selecionado: modulo ? roboPedido : null,
    });
  } catch (erro) {
    return responder(res, 502, {
      configurado: true,
      erro: MENSAGENS_DO_DISPARO[falhaDoGithub(erro?.status)],
    });
  }
  if (req.method === "GET")
    return responder(res, 200, { configurado: true, robos });

  const robo = roboPedido;
  if (!robo)
    return responder(res, 400, { erro: MENSAGENS_DO_DISPARO.robo_invalido });
  if (robos[robo.id]?.rodando)
    return responder(res, 409, {
      erro: MENSAGENS_DO_DISPARO.rodando,
      robos,
    });

  let resposta;
  try {
    resposta = await buscar(
      `${GITHUB}/repos/${REPOSITORIO_DAS_CARGAS}/actions/workflows/${robo.workflow}/dispatches`,
      {
        method: "POST",
        headers: {
          ...cabecalhosDoGithub(token),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ref: RAMO_DAS_CARGAS,
          inputs: inputsDoDisparo(robo, quem.id, edital),
        }),
        signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
      },
    );
  } catch {
    return responder(res, 502, { erro: MENSAGENS_DO_DISPARO.github_fora });
  }
  if (!resposta.ok)
    return responder(res, 502, {
      erro: MENSAGENS_DO_DISPARO[falhaDoGithub(resposta.status)],
    });
  return responder(res, 202, { ok: true, robo: robo.id });
}
