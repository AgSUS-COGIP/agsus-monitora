/*
  Novidades do MONITORA: o "Novo: …" do aviso de versão nova
  (src/componentes/aviso-de-versao/).

  Quem está com uma versão antiga aberta não tem esta lista: o build copia as
  novidades marcadas com `visivel: true` para o `versao.json` publicado
  (vite.config.js), e a página antiga lê de lá. O aviso mostra a mais recente
  que a versão aberta ainda não tem; sem nenhuma, só "Há uma versão nova".

  Como adicionar (README, "Novidades do aviso de versão"): uma entrada no topo,
  `id` único (data + assunto), `data` (AAAA-MM-DD), `texto` curto, sem ponto
  final, em minúscula ("motivo padronizado na reabertura"), e `visivel: true`
  só quando a mudança importa para quem usa (correção interna fica `false`).
*/

export type Novidade = {
  id: string;
  data: string;
  texto: string;
  visivel: boolean;
};

/* Quantas novidades visíveis vão para o versao.json (as mais recentes). */
export const NOVIDADES_PUBLICADAS = 5;

export const NOVIDADES: readonly Novidade[] = [
  {
    id: "2026-11-18-aba-aberta-na-publicacao",
    data: "2026-11-18",
    texto: "página aberta numa atualização recarrega sozinha",
    visivel: false,
  },
  {
    id: "2026-11-17-visao-geral-painel-de-decisao",
    data: "2026-11-17",
    texto:
      "visão geral nova: vagas, o que pede ação e as fases em andamento no topo",
    visivel: true,
  },
  {
    id: "2026-11-17-comemoracoes-so-ocasioes-reais",
    data: "2026-11-17",
    texto:
      "comemorações só em ocasiões reais, uma por dia e sem a frase no meio da tela",
    visivel: true,
  },
  {
    id: "2026-11-17-responsivo-pente-fino",
    data: "2026-11-17",
    texto: "telas sem rolagem lateral no celular e botões maiores no toque",
    visivel: true,
  },
  {
    id: "2026-11-17-editais-ordem-e-aviso-das-listas",
    data: "2026-11-17",
    texto:
      "editais em ordem cronológica, colunas ordenáveis e aviso de edital sem aprovados",
    visivel: true,
  },
  {
    id: "2026-11-17-mapa-so-do-sigepsi",
    data: "2026-11-17",
    texto: "mapa da Saúde Indígena só com os dados do SIGEPSI",
    visivel: true,
  },
  {
    id: "2026-11-17-dseis-do-sigepsi",
    data: "2026-11-17",
    texto: "DSEIs, sedes, polos, CASAIs e unidades do mapa vindos do SIGEPSI",
    visivel: true,
  },
  {
    id: "2026-11-12-acabamento-visual",
    data: "2026-11-12",
    texto: "visual mais uniforme e tabelas que avisam quando a carga falha",
    visivel: true,
  },
  {
    id: "2026-11-11-resumo-por-cargo",
    data: "2026-11-11",
    texto: "resumo por cargo e status na lista de aprovados",
    visivel: true,
  },
  {
    id: "2026-11-11-validade-do-processo-seletivo",
    data: "2026-11-11",
    texto: "validade do processo seletivo no formulário do edital",
    visivel: true,
  },
  {
    id: "2026-10-21-aviso-de-versao",
    data: "2026-10-21",
    texto: "aviso de versão nova no topo da página",
    visivel: false,
  },
  {
    id: "2026-10-21-motivo-da-reabertura",
    data: "2026-10-21",
    texto: "motivo padronizado na reabertura",
    visivel: true,
  },
];

/** As novidades visíveis, da mais recente para a mais antiga (até `limite`). */
export function novidadesVisiveis(
  lista: readonly Novidade[] = NOVIDADES,
  limite = NOVIDADES_PUBLICADAS,
): Novidade[] {
  return lista
    .filter((n) => n.visivel)
    .toSorted((a, b) => b.data.localeCompare(a.data))
    .slice(0, limite);
}
