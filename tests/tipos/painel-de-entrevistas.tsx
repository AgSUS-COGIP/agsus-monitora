/* Contratos da apresentação; não consultam o banco nem montam a tela. */
import type { ComponentProps } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClienteDoPainel } from "../../src/modulos/entrevistas/tipos-do-painel.ts";
import { criarEstadoDasEntrevistas } from "../../src/modulos/entrevistas/estado.ts";
import {
  TelaDeEntrevistas,
  montarEntrevistas,
} from "../../src/modulos/entrevistas/entrevistas.tsx";
import { normalizarPayload } from "../../src/lib/entrevistas-do-painel.ts";
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
} from "../../src/lib/entrevistas-do-painel.ts";

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

declare const supabase: SupabaseClient;
const cliente: ClienteDoPainel = supabase;
const estado = criarEstadoDasEntrevistas({ supabase: cliente });
<TelaDeEntrevistas estado={estado} />;
montarEntrevistas({ supabase: cliente, areaAtual: () => "sede" });
estado.carregar("sede");
estado.carregarAgenda("edital-1");
estado.abrirGaveta("e1");
estado.exportarCsv(normalizarPayload({}).entrevistas);
const snapshot = estado.obter();
// @ts-expect-error — o snapshot só muda pelo store.
snapshot.area = "sede";
// @ts-expect-error — dados podem não ter chegado na primeira carga.
snapshot.dados.entrevistas.map((e) => e.id);
// @ts-expect-error — abertura de gaveta exige um ID textual.
estado.abrirGaveta(7);
// @ts-expect-error — o painel não oferece RPCs de gravação.
cliente.rpc("publicar_classificacao", { p_edital: "e1" });
// @ts-expect-error — a agenda recebe o argumento específico da RPC.
cliente.rpc("obter_agenda_entrevista", { p_area: "sede" });
// @ts-expect-error — a data bruta não foi validada como Date.
normalizarPayload({}).geradoEm.toISOString();
