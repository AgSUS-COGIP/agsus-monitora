import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ClienteDoAcompanhamento,
  ClienteDosMarcos,
  DadosDoMonitoramento,
  PropsDaTela,
} from "../../src/modulos/visao-geral/tipos.ts";
import {
  acompanhamentoDaResposta,
  enriquecerLinhas,
  filtrosVazios,
  linhasDaResposta,
  recortar,
} from "../../src/lib/visao-geral.ts";
import { criarEstadoDaVisaoGeral } from "../../src/modulos/visao-geral/estado.ts";
import { TabelaDeProcessos } from "../../src/modulos/visao-geral/tabela.tsx";
import { textosDaVisaoGeral } from "../../src/lib/visao-geral.ts";

declare const clienteReal: SupabaseClient;
const acompanhamento: ClienteDoAcompanhamento = clienteReal;
const marcos: ClienteDosMarcos = clienteReal;
void acompanhamento.rpc("listar_acompanhamento_da_visao_geral", {
  p_area: "sede",
});
void marcos.rpc("obter_marcos_da_area", { p_area: "sede" });
// @ts-expect-error Esta leitura não oferece RPCs de escrita.
void acompanhamento.rpc("salvar_monitoramento", { p_area: "sede" });
// @ts-expect-error A RPC de acompanhamento exige a área.
void acompanhamento.rpc("listar_acompanhamento_da_visao_geral", {});

declare const origem: DadosDoMonitoramento;
const estado = criarEstadoDaVisaoGeral({
  dados: origem,
  armazenamento: null,
  agora: () => 0,
});
estado.definirFiltro("unidade", ["Sede"]);
estado.alternarAtalho("pos:sem_lista");
estado.ordenarPor("data_fim");
// @ts-expect-error Campo fora do catálogo de filtros.
estado.definirFiltro("cargos", ["Analista"]);
// @ts-expect-error A seleção do filtro contém texto.
estado.definirFiltro("edital", [2026]);
// @ts-expect-error Pendência desconhecida.
estado.alternarAtalho("pos:inexistente");
// @ts-expect-error Coluna fora do catálogo.
estado.ordenarPor("inexistente");
// @ts-expect-error O relógio do estado retorna milissegundos.
criarEstadoDaVisaoGeral({ agora: () => new Date() });
const e = estado.obter();
// @ts-expect-error O snapshot é somente para leitura.
e.busca = "x";
// @ts-expect-error Coleções do snapshot não podem ser alteradas pelo consumidor.
e.filtradas.push(e.filtradas[0]!);
// @ts-expect-error Valores dos filtros não podem ser alterados pelo consumidor.
e.filtros.unidade.push("x");
// @ts-expect-error Colunas não podem ser alteradas diretamente.
e.colunas.push("status");

declare const bruto: unknown;
const etapas = acompanhamentoDaResposta(bruto)?.etapasPorEdital;
const linhas = enriquecerLinhas(linhasDaResposta(origem.obter().linhas));
const filtradas = recortar(linhas, {
  filtros: filtrosVazios(),
  chaveDsei: (linha) => String(linha.unidade ?? ""),
});
const unidade: string | undefined = filtradas[0]?.unidade;
void unidade;
void etapas;
// @ts-expect-error Dados externos precisam ser normalizados antes do enriquecimento.
enriquecerLinhas([bruto]);
const tabela = (
  <TabelaDeProcessos
    e={e}
    estado={estado}
    textos={textosDaVisaoGeral()}
    aoAbrir={(linha) => estado.destacar(linha.id)}
    agora={() => new Date()}
  />
);
// @ts-expect-error O callback recebe uma linha do recorte.
const callbackInvalido: Parameters<typeof TabelaDeProcessos>[0]["aoAbrir"] = (
  linha: number,
) => void linha;
declare const props: PropsDaTela;
const relogio: () => Date = props.agora;
void tabela;
void callbackInvalido;
void relogio;
