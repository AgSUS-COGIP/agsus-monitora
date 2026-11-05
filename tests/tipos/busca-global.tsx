import {
  BuscaGlobal,
  avisarEscolha,
} from "../../src/componentes/busca-global/busca-global.tsx";
import { buscarLinhas } from "../../src/lib/busca-global.ts";
import {
  obterDadosDoMonitoramento,
  soDosEditais,
} from "../../src/componentes/dados-do-monitoramento.ts";
import type { ResultadoDaBusca } from "../../src/componentes/busca-global/tipos.ts";

const resultado: ResultadoDaBusca = { id: 0, unidade: "DSEI Xingu" };
const busca = (
  <BuscaGlobal
    estaConectado={() => true}
    aoEscolher={(linha) => {
      const id: string | number = linha.id;
      void id;
    }}
  />
);
void busca;
void resultado;
avisarEscolha(resultado);
const achados: readonly ResultadoDaBusca[] = buscarLinhas(
  [{ id: "uuid" }],
  "x",
);
void achados;
const etapas = soDosEditais(
  [{ editalId: "uuid", descricao: "Etapa" }],
  new Set(["uuid"]),
  "editalId",
);
// @ts-expect-error O recorte preserva o tipo dos campos de cada registro.
const descricaoNumerica: number = etapas[0]!.descricao;
void descricaoNumerica;

// @ts-expect-error Resultado selecionável precisa de identificação.
const semId: ResultadoDaBusca = { unidade: "DSEI Xingu" };
void semId;
// @ts-expect-error A guarda de sessão deve devolver booleano.
void (<BuscaGlobal estaConectado={() => "conectado"} aoEscolher={() => {}} />);
void (
  (
    // @ts-expect-error A escolha recebe uma linha, não apenas seu id.
    <BuscaGlobal estaConectado={() => true} aoEscolher={(id: string) => id} />
  )
);
// @ts-expect-error A chave de recorte deve existir no registro.
soDosEditais([{ editalId: 1 }], new Set(["1"]), "outroCampo");
// @ts-expect-error O snapshot muda apenas pela publicação.
obterDadosDoMonitoramento().carregado = true;
// @ts-expect-error As listas publicadas são somente para leitura.
obterDadosDoMonitoramento().linhas.push(resultado);
