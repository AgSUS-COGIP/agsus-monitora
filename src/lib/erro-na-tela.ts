/*
  O texto de um erro para a tela: o que aconteceu e o que fazer, sem termo de
  banco nem de código (DESIGN.md, textos da interface).

  As RPCs do MONITORA já recusam em português ("Sem acesso a esta área",
  "Edital da agenda inválido."): essas frases passam iguais. O que vira frase
  fixa é o técnico, que chega do navegador, do PostgREST ou do Postgres:
  - sem conexão ("Failed to fetch"…) → SEM_SERVIDOR (src/lib/falha-de-rede.ts);
  - arquivo de uma versão anterior ("dynamically imported module") →
    MENSAGEM_DE_VERSAO_NOVA (src/lib/importar-com-recarga.ts);
  - sessão vencida (JWT) → entrar de novo;
  - tempo esgotado no banco (57014, "statement timeout") → tentar de novo;
  - permissão negada pelo Postgres em inglês ("permission denied") → sem permissão;
  - qualquer outro texto técnico (código PGRST, SQLSTATE, mensagem em inglês)
    → ERRO_INESPERADO.
  O detalhe técnico continua no console (quem chama faz o console.warn).
*/

import { SEM_SERVIDOR, ehFalhaDeConexao } from "./falha-de-rede.ts";
import { MENSAGEM_DE_VERSAO_NOVA } from "./importar-com-recarga.ts";

const VERSAO_ANTERIOR =
  /dynamically imported module|Importing a module script failed|error loading dynamically|ChunkLoadError/i;

export const SESSAO_VENCIDA =
  "Sua sessão expirou. Saia e entre de novo no Yeendé.";
export const TEMPO_ESGOTADO_NO_BANCO =
  "O servidor demorou demais para responder. Tente de novo em instantes.";
export const SEM_PERMISSAO = "Você não tem permissão para ver isto.";
export const ERRO_INESPERADO =
  "Erro inesperado. Tente de novo; se continuar, avise o suporte.";

type ErroLido = { message?: unknown; code?: unknown; details?: unknown };

const texto = (erro: unknown): string => {
  if (typeof erro === "string") return erro.trim();
  const lido = erro as ErroLido | null | undefined;
  return String(lido?.message ?? lido?.details ?? erro ?? "").trim();
};

const codigo = (erro: unknown): string =>
  typeof erro === "object" && erro
    ? String((erro as ErroLido).code ?? "").trim()
    : "";

/* Texto de máquina: código do PostgREST/Postgres ou frase em inglês sem acento. */
const TECNICO =
  /\bPGRST\d+|SQLSTATE|\bviolates\b|\bdoes not exist\b|\brelation\b|syntax error|\bnull value\b|\bduplicate key\b|\bcould not\b|\bunexpected\b|\bundefined\b|\bnull\b|\bTypeError\b|\bSyntaxError\b|\bat [\w.<>]+ \(|\bstatus code\b/i;
const INGLES =
  /\b(the|is|not|failed|error|invalid|cannot|unable|request|response|function|column|query)\b/i;
const PORTUGUES = /[áàâãéêíóôõúç]|\b(não|sem|para|de|do|da|edital|área)\b/i;

/** A frase para a pessoa a partir de um erro (string, Error ou erro do supabase-js). */
export function erroParaATela(erro: unknown): string {
  if (!erro) return ERRO_INESPERADO;
  const msg = texto(erro);
  // Só o arquivo de uma versão anterior (o "Failed to fetch" sozinho é rede).
  if (VERSAO_ANTERIOR.test(msg)) return MENSAGEM_DE_VERSAO_NOVA;
  if (ehFalhaDeConexao(erro)) return SEM_SERVIDOR;
  const cod = codigo(erro);
  if (
    /jwt|token (is )?expired|invalid (refresh )?token|PGRST30[0-3]/i.test(
      `${msg} ${cod}`,
    )
  )
    return SESSAO_VENCIDA;
  if (cod === "57014" || /statement timeout|canceling statement/i.test(msg))
    return TEMPO_ESGOTADO_NO_BANCO;
  if (/permission denied/i.test(msg)) return SEM_PERMISSAO;
  if (!msg) return ERRO_INESPERADO;
  // Frase em português das RPCs: passa igual.
  if (PORTUGUES.test(msg) && !TECNICO.test(msg)) return msg;
  if (TECNICO.test(msg) || INGLES.test(msg)) return ERRO_INESPERADO;
  return msg;
}
