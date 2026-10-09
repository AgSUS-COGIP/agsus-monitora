/* Contratos da apresentação; não consultam o banco nem montam a tela. */
import type { ComponentProps } from "react";
import type {
  EntrevistaDoPainel,
  AprovadoSemEntrevista,
  FiltrosDoPainel,
  OpcoesDosFiltros,
  CampoDoFiltro,
} from "../../src/modulos/entrevistas/tipos-do-painel.ts";
import { Filtros, Graficos } from "../../src/modulos/entrevistas/paineis.tsx";
import {
  TabelaDeEntrevistas,
  ResumoDaAnalise,
} from "../../src/modulos/entrevistas/tabela.tsx";
import {
  GavetaDaEntrevista,
  GavetaDosSemEntrevista,
} from "../../src/modulos/entrevistas/gaveta.tsx";
import {
  filtrarEntrevistas,
  mediaPorCriterio,
} from "../../src/lib/entrevistas-do-painel.js";

declare const entrevistas: readonly EntrevistaDoPainel[];
declare const entrevista: EntrevistaDoPainel;
declare const aprovados: readonly AprovadoSemEntrevista[];
declare const filtros: FiltrosDoPainel;
declare const opcoes: OpcoesDosFiltros;
declare const graficos: ComponentProps<typeof Graficos>;

<Filtros
  filtros={filtros}
  opcoes={opcoes}
  carregado
  aoLimpar={() => {}}
  aoMudar={(campo, valor) => {
    const chave: CampoDoFiltro = campo;
    const texto: string = valor;
    // @ts-expect-error — callbacks usam os campos conhecidos do painel.
    const desconhecido: "recurso" = campo;
  }}
/>;
<TabelaDeEntrevistas
  entrevistas={entrevistas}
  total={2}
  carregado
  empates={new Map([["e1", 2]])}
  aoAbrir={(id) => {
    const identificador: string = id;
    // @ts-expect-error — a tabela fornece o ID, não o objeto completo.
    const objeto: EntrevistaDoPainel = id;
  }}
/>;
<ResumoDaAnalise analise={null} />;
<GavetaDaEntrevista entrevista={entrevista} aoFechar={() => {}} />;
<GavetaDosSemEntrevista aprovados={aprovados} aoFechar={() => {}} />;
<Graficos {...graficos} />;

const recorte: EntrevistaDoPainel[] = filtrarEntrevistas(entrevistas, filtros);
const media: number | null | undefined = mediaPorCriterio(entrevistas, [
  { indice: 0, texto: "Postura", curto: "Postura" },
])[0]?.media;
// @ts-expect-error — nota pode estar ausente na planilha.
const notaObrigatoria: number = entrevista.nota;
// @ts-expect-error — os identificadores preservados do JSON não foram validados como texto.
const identificadorExterno: string = entrevista.edital_id;
// @ts-expect-error — a análise pode não estar ligada à entrevista.
entrevista.analise.nota.toFixed(2);
// @ts-expect-error — os filtros não aceitam números.
const filtrosInvalidos: FiltrosDoPainel = { ...filtros, parecer: 7 };
const comparecimentoInvalido: EntrevistaDoPainel = {
  ...entrevista,
  // @ts-expect-error — comparecimento usa os códigos normalizados da planilha.
  compareceu: "talvez",
};
// @ts-expect-error — agregações entregam números, não texto.
const mediaEmTexto: string | undefined = mediaPorCriterio(entrevistas, [])[0]
  ?.media;
