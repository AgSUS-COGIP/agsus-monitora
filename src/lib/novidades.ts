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
