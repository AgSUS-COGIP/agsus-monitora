/* Casos compilados, sem consultar o banco ou criar uma sessão real. */
import type { SupabaseClient } from "@supabase/supabase-js";
import { criarEstadoDaSelecao } from "../../src/modulos/selecao/estado.ts";
import type {
  ClienteDaSelecao,
  VagaDaSelecao,
} from "../../src/modulos/selecao/tipos.ts";
import { comTempoLimite } from "../../src/lib/falha-de-rede.js";
import {
  FILTROS_VAZIOS,
  normalizarPayload,
  somar,
  opcoesDosFiltros,
} from "../../src/lib/selecao-do-painel.ts";
import { Filtros, Indicadores } from "../../src/modulos/selecao/paineis.tsx";
import {
  TelaDeSelecao,
  montarSelecao,
} from "../../src/modulos/selecao/selecao.tsx";
import { Grafico, TabelaInfinita } from "../../src/ui/index.js";
import type { Plugin } from "chart.js";

declare const clienteReal: SupabaseClient;
const cliente: ClienteDaSelecao = clienteReal;
const estado = criarEstadoDaSelecao({ supabase: cliente });

estado.carregar("saude-indigena");
const cancelar: () => void = estado.assinar(() => {});
cancelar();
const snapshot = estado.obter();
if (snapshot.dados) {
  estado.exportarCsv(snapshot.dados.vagas);
  const inscritos: number | null | undefined =
    snapshot.dados.vagas[0]?.inscritos;
  // @ts-expect-error — contagens normalizadas não são texto.
  const inscritosComoTexto: string = snapshot.dados.vagas[0]?.inscritos;
  // @ts-expect-error — timestamps preservados do JSON não foram validados.
  snapshot.dados.geradoEm.toISOString();
}

// @ts-expect-error — área não é um número.
estado.carregar(7);
// @ts-expect-error — snapshots são somente leitura; alterações passam pelo store.
snapshot.area = "sede";
// @ts-expect-error — dados ainda podem estar ausentes na primeira carga.
estado.exportarCsv(snapshot.dados.vagas);
// @ts-expect-error — a Seleção usa apenas sua RPC de leitura.
cliente.rpc("publicar_classificacao", { p_area: "sede" });
// @ts-expect-error — a RPC exige o argumento p_area como string.
cliente.rpc("get_selecao_da_area", { p_area: 7 });

const comLimite: Promise<{ data: unknown; error: unknown }> = comTempoLimite(
  cliente.rpc("get_selecao_da_area", { p_area: "sede" }),
);
// @ts-expect-error — limitar o tempo mantém o tipo de retorno da operação.
const numeroComLimite: Promise<number> = comLimite;

declare const respostaExterna: unknown;
const normalizado = normalizarPayload(respostaExterna);
somar(normalizado.vagas, "inscritos");
// @ts-expect-error — apenas contagens podem ser somadas.
somar(normalizado.vagas, "edital");
const filtroInvalido = {
  ...FILTROS_VAZIOS,
  // @ts-expect-error — filtros recebem listas de texto.
  editais: [7],
} satisfies typeof FILTROS_VAZIOS;

<TelaDeSelecao estado={estado} />;
<Filtros
  filtros={FILTROS_VAZIOS}
  opcoes={opcoesDosFiltros(normalizado.vagas)}
  area="sede"
  carregado
  aoLimpar={() => {}}
  aoMudar={(campo, valores) => {
    const chave: "unidades" | "editais" | "cargos" | "vagas" = campo;
    const escolhas: readonly string[] = valores;
    // @ts-expect-error — o componente não inventa outros campos.
    const inexistente: "parecer" = campo;
  }}
/>;
// @ts-expect-error — indicadores exigem as contagens e a taxa do recorte.
<Indicadores indicadores={{ vagas: 1 }} carregado />;
// @ts-expect-error — a montagem exige um elemento do DOM ou null.
montarSelecao({ secao: "page-selecao" });

declare const pluginDeRosca: Plugin<"doughnut">;
<Grafico
  tipo="doughnut"
  plugins={[pluginDeRosca]}
  rotulo="Contratados"
  dependencias={[]}
  montar={() => ({ data: { datasets: [{ data: [2, 6] }] } })}
/>;
<Grafico
  tipo="bar"
  // @ts-expect-error — plugins da rosca não podem ser usados numa barra.
  plugins={[pluginDeRosca]}
  rotulo="Inscritos"
  dependencias={[]}
  montar={() => ({ data: { datasets: [{ data: [83] }] } })}
/>;

<TabelaInfinita
  idDoTitulo="base"
  titulo="Base"
  busca={{ placeholder: "Buscar", rotulo: "Busca" }}
  carregado
  itens={normalizado.vagas}
  colunas={[]}
  total={0}
  vazio="Sem vagas"
  filtrarPelaBusca={(itens) => itens}
  informacao={(quantos) => quantos}
  linha={(vaga) => {
    const tipada: VagaDaSelecao = vaga;
    // @ts-expect-error — a tabela preserva o tipo da linha, sem campos arbitrários.
    const inexistente: string = vaga.candidato;
    return (
      <tr>
        <td>{tipada.cargo}</td>
      </tr>
    );
  }}
/>;
