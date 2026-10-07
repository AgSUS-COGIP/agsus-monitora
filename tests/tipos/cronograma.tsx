/* Contratos compilados: nenhuma RPC real é executada. */
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ClienteDoCalendario,
  EtapaDoCalendario,
} from "../../src/modulos/cronograma/tipos.ts";
import { criarEstadoDoCalendario } from "../../src/modulos/cronograma/estado.ts";
import {
  CalendarioEditais,
  montarCalendarioEditais,
} from "../../src/modulos/cronograma/calendario-editais.tsx";
import { Seletor, GradeDoMes } from "../../src/modulos/cronograma/partes.tsx";
import {
  comLimite,
  editaisComCronograma,
  montarEtapasDosEditais,
  montarGradeDoMes,
  filtrarEtapas,
  proximasEtapas,
  FILTROS_VAZIOS,
} from "../../src/lib/calendario-editais.ts";
import { soDosEditais } from "../../src/componentes/dados-do-monitoramento.js";

declare const clienteReal: SupabaseClient;
const cliente: ClienteDoCalendario = clienteReal;
cliente.rpc("get_monitoramento_cronograma", { p_monitoramento_id: 1 });
cliente.rpc("get_monitoramento_cronograma", { p_monitoramento_id: "uuid" });
// @ts-expect-error — este módulo não escreve cronogramas.
cliente.rpc("salvar_monitoramento_cronograma", { p_monitoramento_id: "uuid" });
// @ts-expect-error — ler um cronograma exige o identificador.
cliente.rpc("get_monitoramento_cronograma");
// @ts-expect-error — argumentos de outra RPC não pertencem à carga em lote.
cliente.rpc("listar_etapas_do_cronograma", { p_area: "sede" });

const estado = criarEstadoDoCalendario({ supabase: cliente });
estado.carregar(true);
estado.invalidar();
const cancelar: () => void = estado.assinar(() => {});
cancelar();
const snapshot = estado.obter();
// @ts-expect-error — o snapshot é somente leitura.
snapshot.erro = "falha";
// @ts-expect-error — a coleção de etapas do store não é editada pelo componente.
snapshot.etapas.push({});
// @ts-expect-error — a carga aceita apenas um indicador booleano.
estado.carregar("forçar");
<CalendarioEditais estado={estado} agora={() => new Date()} />;
// @ts-expect-error — o relógio da tela entrega Date.
<CalendarioEditais estado={estado} agora={() => "2026-10-07"} />;
// @ts-expect-error — montar exige um elemento do DOM.
montarCalendarioEditais({ secao: "page-calendario" });

declare const json: unknown;
const editais = editaisComCronograma(json);
const normalizadas = montarEtapasDosEditais(editais, []);
const etapas: EtapaDoCalendario[] = soDosEditais(
  normalizadas.etapas,
  new Set(["uuid"]),
  "editalId",
);
// @ts-expect-error — o recorte de área preserva o tipo de cada etapa.
soDosEditais(normalizadas.etapas, new Set(), "candidatoId");
// @ts-expect-error — filtros recebem texto.
filtrarEtapas(etapas, { unidade: 7 });
// @ts-expect-error — filtros vazios são somente leitura.
FILTROS_VAZIOS.busca = "Manaus";
const proximas: EtapaDoCalendario[] = proximasEtapas(etapas);
// @ts-expect-error — a data de início normalizada é texto.
const dataNumerica: number = proximas[0]?.data_inicio;
const grade = montarGradeDoMes(new Date(), etapas);
<GradeDoMes
  celulas={grade}
  selecionado=""
  aoEscolherDia={(chave) => {
    const dia: string = chave;
    // @ts-expect-error — a chave do dia não é Date.
    const data: Date = chave;
  }}
/>;
<Seletor
  id="edital"
  vazio="Todos"
  valor=""
  opcoes={[["uuid", "Edital"]]}
  aoMudar={(valor) => {
    const id: string = valor;
  }}
/>;

const resultados: Promise<(number | null)[]> = comLimite(
  ["a", "bb"],
  2,
  (item) => item.length,
);
// @ts-expect-error — uma tarefa pode falhar, preservando null na posição.
const semFalhas: Promise<number[]> = resultados;
// @ts-expect-error — o resultado da tarefa não é texto.
const textos: Promise<string[]> = resultados;
