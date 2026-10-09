import {
  enriquecerRecursos,
  filtrarRecursos,
  FILTROS_VAZIOS,
  opcoesDosFiltros,
  calcularIndicadores,
  pendenciasPrioritarias,
  csvDosRecursos,
} from "../../src/lib/recursos-dos-candidatos.ts";
import {
  Graficos,
  Indicadores,
  Filtros,
  Recorte,
  filtrosAtivos,
} from "../../src/modulos/recursos/paineis.tsx";
import { TabelaDeRecursos } from "../../src/modulos/recursos/tabela.tsx";
import type {
  AoFiltrarRecursos,
  RecursoDoPainel,
} from "../../src/lib/tipos-dos-recursos.ts";

const recursos = enriquecerRecursos(
  {
    recursos: [
      {
        id: "r1",
        candidato: "Ana",
        criado_em: "2026-10-09T12:00:00Z",
        campoAdicional: "preservado",
      },
    ],
    cronogramas: [],
  },
  "2026-10-09",
);
const campoAdicional: string | undefined = recursos[0]?.campoAdicional;
const recorte = filtrarRecursos(recursos, FILTROS_VAZIOS);
const opcoes = opcoesDosFiltros(recursos);
const aoFiltrar: AoFiltrarRecursos = (campo, valor) => {
  void [campo, valor];
};
const indicadores = calcularIndicadores(recorte);
const pendencias = pendenciasPrioritarias(recorte);
const tela = (
  <>
    <Filtros
      filtros={FILTROS_VAZIOS}
      opcoes={opcoes}
      carregado
      aoMudar={aoFiltrar}
      aoLimpar={() => {}}
    />
    <Indicadores
      indicadores={indicadores}
      carregado
      filtros={FILTROS_VAZIOS}
      aoFiltrar={aoFiltrar}
    />
    <Recorte
      ativos={filtrosAtivos(FILTROS_VAZIOS, opcoes)}
      recursos={recorte}
      carregado
    />
    <Graficos
      recursos={recorte}
      pendencias={pendencias}
      carregado
      filtros={FILTROS_VAZIOS}
      aoFiltrar={aoFiltrar}
      escuro={false}
    />
    <TabelaDeRecursos
      recursos={recorte}
      total={recursos.length}
      carregado
      analise
      aoAbrir={(id) => {
        void id;
      }}
      aoNovo={() => {}}
    />
  </>
);
// @ts-expect-error Campo desconhecido não pode atualizar o recorte.
aoFiltrar("status", "DEFERIDO");
// @ts-expect-error Os indicadores recebem recursos enriquecidos, incluindo prazo e etapas.
calcularIndicadores([{ id: "r1" }]);
// @ts-expect-error Dias para o prazo exigem número ou null.
const diasInvalidos: RecursoDoPainel["diasParaPrazo"] = "amanhã";
// @ts-expect-error Não há etapa arbitrária no fluxo do recurso.
const etapaInvalida: RecursoDoPainel["etapas"] = { resposta: true };
void [
  tela,
  campoAdicional,
  csvDosRecursos(recursos),
  diasInvalidos,
  etapaInvalida,
];
