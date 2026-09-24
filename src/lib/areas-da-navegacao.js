/*
  Áreas da barra lateral.

  O MONITORA nasceu só da Saúde Indígena e passa a atender também a SEDE e os
  Projetos. A barra lateral deixa de ter três grupos fixos (Principal, Painéis,
  Administração) e passa a ter um grupo por área, recolhível, mais dois grupos
  transversais: Processos Seletivos (editais, cronograma e aprovados servem a
  todas as áreas) e Administração.

  Cada painel externo diz a que área pertence pela coluna `area` de
  `TB_PAINEL_EXTERNO`. Painel sem área, ou com área desconhecida, cai na Saúde
  Indígena, que é onde todos os painéis estavam até aqui.
*/

export const AREAS = Object.freeze([
  { id: "saude_indigena", titulo: "Saúde Indígena", icone: "fa-feather" },
  { id: "sede", titulo: "SEDE", icone: "fa-building-columns" },
  { id: "projetos", titulo: "Projetos", icone: "fa-diagram-project" },
]);

export const AREA_PADRAO = "saude_indigena";

export const GRUPO_SELECAO = Object.freeze({
  id: "selecao",
  titulo: "Processos Seletivos",
});

export const GRUPO_ADMINISTRACAO = Object.freeze({
  id: "administracao",
  titulo: "Administração",
});

const IDS_DE_AREA = new Set(AREAS.map((area) => area.id));

export function areaDoPainel(painel) {
  const area = String(painel?.area ?? "")
    .trim()
    .toLowerCase();
  return IDS_DE_AREA.has(area) ? area : AREA_PADRAO;
}

/*
  Recebe os itens já filtrados por permissão e devolve os grupos na ordem da
  barra. Grupo sem item não aparece: quem só enxerga Processos Seletivos não vê
  cabeçalhos vazios de SEDE e Projetos.

  `itensDaArea` traz os itens internos de cada área (hoje só o painel da Saúde
  Indígena); `paineis` são os externos, ordenados por `ordem`.
*/
export function montarGruposDaNavegacao({
  itensDaArea = {},
  paineis = [],
  selecao = [],
  administracao = [],
} = {}) {
  const externosPorArea = new Map(AREAS.map((area) => [area.id, []]));
  [...paineis]
    .sort((a, b) => Number(a?.ordem ?? 0) - Number(b?.ordem ?? 0))
    .forEach((painel) => {
      externosPorArea.get(areaDoPainel(painel)).push({
        view: "panel:" + painel.codigo,
        rotulo: painel.titulo,
        icone: painel.icone || "fa-arrow-up-right-from-square",
      });
    });

  const grupos = AREAS.map((area) => ({
    id: area.id,
    titulo: area.titulo,
    itens: [...(itensDaArea[area.id] || []), ...externosPorArea.get(area.id)],
  }));
  grupos.push({ ...GRUPO_SELECAO, itens: [...selecao] });
  grupos.push({ ...GRUPO_ADMINISTRACAO, itens: [...administracao] });
  return grupos.filter((grupo) => grupo.itens.length > 0);
}

/*
  Aberto ou fechado. O grupo que contém a tela atual fica sempre aberto — a
  pessoa não pode perder de vista onde está. Fora isso vale o que ela escolheu
  da última vez; sem escolha salva, o grupo começa aberto.
*/
export function grupoAberto(grupo, { estadoSalvo = {}, viewAtiva = "" } = {}) {
  if (grupo.itens.some((item) => item.view === viewAtiva)) return true;
  return estadoSalvo[grupo.id] !== false;
}

export function grupoDaView(grupos, view) {
  return (
    grupos.find((grupo) => grupo.itens.some((item) => item.view === view)) ||
    null
  );
}
