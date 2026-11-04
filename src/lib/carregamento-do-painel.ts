/*
  Carregamento de um painel externo (TB_PAINEL_EXTERNO): o que a tela diz
  enquanto o site de fora não responde, e a quem se conectar antes.

  O Looker Studio (datastudio.google.com/embed/…) leva ~5,6 s para entregar o
  painel na primeira abertura; até lá o quadro fica em branco. A cobertura
  (src/modulos/paineis-externos/carregamento-do-painel.tsx) diz o que está
  carregando, avisa a demora aos 20 s com "Abrir em nova aba" e mostra o
  erro. A pré-conexão (src/app/paineis-externos.ts) abre o DNS/TLS das
  origens do painel quando a pessoa aponta ou foca o item do menu, sem
  carregar o iframe.
*/

/** Demora: depois disto, "Está demorando mais que o normal". */
export const DEMORA_DO_PAINEL_MS = 20_000;
/** Painel que avisou que carrega e nunca disse "pronto": sai depois disto. */
export const ESPERA_MAXIMA_DO_PAINEL_MS = 45_000;
/* O primeiro aviso do painel pode chegar logo depois do `load`. */
export const FOLGA_DO_AVISO_MS = 300;

/*
  O painel que avisa (docs/painel-externo-avisa-que-carregou.md): "carregando"
  no início, "pronto" quando os dados estão na tela e "erro" quando não vêm.
*/
export const AVISO_DO_PAINEL_CARREGANDO = "agsus:painel-carregando";
export const AVISO_DO_PAINEL_PRONTO = "agsus:painel-pronto";
export const AVISO_DO_PAINEL_ERRO = "agsus:painel-erro";

/* Os serviços que os painéis cadastrados usam, pelo endereço. */
const SERVICOS: readonly { nome: string; hosts: readonly string[] }[] = [
  {
    nome: "Looker Studio",
    hosts: ["datastudio.google.com", "lookerstudio.google.com"],
  },
  { nome: "Power BI", hosts: ["app.powerbi.com"] },
];

/*
  As origens estáticas que o painel do Looker Studio busca logo depois da
  página (conferido no HTML do /embed em 03/11/2026): scripts e CSS em
  www.gstatic.com, a fonte em fonts.googleapis.com e o arquivo dela em
  fonts.gstatic.com.
*/
const ORIGENS_DO_GOOGLE = [
  "https://www.gstatic.com",
  "https://fonts.googleapis.com",
  "https://fonts.gstatic.com",
];

function lerEndereco(endereco: unknown): URL | null {
  try {
    const url = new URL(String(endereco ?? ""));
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

/** O nome do serviço do painel ("Looker Studio"), ou `null` se não for conhecido. */
export function servicoDoPainel(endereco: unknown): string | null {
  const host = lerEndereco(endereco)?.hostname.toLowerCase();
  if (!host) return null;
  return SERVICOS.find((s) => s.hosts.includes(host))?.nome ?? null;
}

/** "Carregando o painel do Looker Studio…" ou, sem serviço conhecido, "Carregando o painel…". */
export function rotuloDoCarregamento(endereco: unknown): string {
  const servico = servicoDoPainel(endereco);
  return servico
    ? `Carregando o painel do ${servico}…`
    : "Carregando o painel…";
}

/**
 * As origens a pré-conectar para um painel: a dele e, no Looker Studio, as
 * estáticas do Google. Endereço inválido: nenhuma.
 */
export function origensParaPreconectar(endereco: unknown): string[] {
  const url = lerEndereco(endereco);
  if (!url) return [];
  const origens = [url.origin];
  if (servicoDoPainel(endereco) === "Looker Studio")
    origens.push(...ORIGENS_DO_GOOGLE);
  return origens;
}

/** As fontes vêm com CORS: a pré-conexão delas precisa de `crossorigin`. */
export const precisaDeCrossorigin = (origem: string) =>
  origem === "https://fonts.gstatic.com";
