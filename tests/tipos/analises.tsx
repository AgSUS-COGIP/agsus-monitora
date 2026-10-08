import { TelaDeAnalises } from "../../src/modulos/analises/analises.tsx";
import { criarEstadoDasAnalises } from "../../src/modulos/analises/estado.ts";
import { criarConsultasDasAnalises } from "../../src/modulos/analises/consultas.ts";
import {
  FILTROS_VAZIOS,
  filtrarLinhas,
  prepararLinhas,
} from "../../src/lib/analises-curriculares.ts";
import type {
  ClienteDasAnalises,
  EstadoDasAnalises,
  CampoDoFiltro,
} from "../../src/modulos/analises/tipos.ts";

const cliente: ClienteDasAnalises = {
  rpc: () => Promise.resolve({ data: null, error: null }),
};
const consultas = criarConsultasDasAnalises({ supabase: cliente });
const estado: EstadoDasAnalises = criarEstadoDasAnalises({
  supabase: cliente,
  consultas,
});
const tela = <TelaDeAnalises estado={estado} />;
void tela;
void estado.carregar("sede", { escopo: "ativo" });
void estado.exportarCsv((linhas) => filtrarLinhas(linhas, FILTROS_VAZIOS));
prepararLinhas([{ id: "a1" }], { area: "projetos" }).map((linha) =>
  linha.__chave.toUpperCase(),
);

// @ts-expect-error Apenas as RPCs existentes do módulo são aceitas.
void cliente.rpc("nova_rpc", {});
// @ts-expect-error O id da gaveta deve ser textual.
void estado.abrirDetalhe(15);
// @ts-expect-error O snapshot só muda pelas ações do estado.
estado.obter().escopo = "todos";
// @ts-expect-error As linhas expostas não podem ser acrescentadas pelo consumidor.
estado.obter().linhas.push(prepararLinhas([{}])[0]);
// @ts-expect-error Apenas nomes de filtros existentes são aceitos.
const campo: CampoDoFiltro = "departamento";
void campo;
// @ts-expect-error Seleções de filtro são listas de texto.
filtrarLinhas([], { ...FILTROS_VAZIOS, edital: [2026] });
// @ts-expect-error O CSV precisa selecionar linhas, não retornar texto.
void estado.exportarCsv(() => "csv");
// @ts-expect-error A tela exige um estado com ações e assinatura.
const telaInvalida = <TelaDeAnalises estado={{}} />;
void telaInvalida;
