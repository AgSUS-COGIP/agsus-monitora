import {
  rascunhoDoRoteiro,
  dadosDoRoteiroParaSalvar,
  opcoesDaEscala,
  moverItem,
} from "../../src/lib/roteiro-de-entrevista.ts";
import {
  novoAvaliador,
  rascunhoDaConfiguracao,
  dadosDaConfiguracaoParaSalvar,
  avaliadoresDaCompetencia,
  calcularEntrevista,
  notasAlteradas,
} from "../../src/lib/conducao-de-entrevista.ts";
import type { DadosDoRoteiroParaSalvar } from "../../src/lib/tipos-do-roteiro-de-entrevista.ts";
import type { DadosDaConfiguracaoDaEntrevista } from "../../src/modulos/entrevistas/tipos.ts";
import type {
  NotaParaSalvar,
  ResultadoDoCalculoDaFicha,
} from "../../src/modulos/entrevistas/tipos-da-ficha.ts";

const rascunho = rascunhoDoRoteiro(null, { modo: "novo", area: "sede" });
const roteiro: DadosDoRoteiroParaSalvar = dadosDoRoteiroParaSalvar(rascunho);
const configuracao = rascunhoDaConfiguracao(null);
configuracao.avaliadores.push(novoAvaliador("DSEI", 1));
const dados: DadosDaConfiguracaoDaEntrevista =
  dadosDaConfiguracaoParaSalvar(configuracao);
const notas: NotaParaSalvar[] = notasAlteradas({}, { "c1|a1": "2,5" });
const opcoes: number[] = opcoesDaEscala(
  { escala: "FAIXA", passo: "0,5" },
  5,
).map((o) => o.valor);
const membros = avaliadoresDaCompetencia(
  [{ id: "a1", competencias: null, nome: "Ana" }],
  "c1",
  [{ id: "c1" }],
);
const nome: string | undefined = membros[0]?.nome;
const itens = moverItem([{ id: "c1", peso: 1 }], 0, 1);
const peso: number | undefined = itens[0]?.peso;
const resultado: ResultadoDoCalculoDaFicha = calcularEntrevista({
  roteiro: null,
  compareceu: "S",
  avaliacoes: [],
});
void [roteiro, dados, notas, opcoes, nome, peso, resultado];

// @ts-expect-error O conversor exige um rascunho com os campos do formulário.
dadosDoRoteiroParaSalvar({ nome: "Roteiro" });
// @ts-expect-error Valores do formulário são texto, o DTO de saída é numérico.
rascunho.passo = 0.5;
// @ts-expect-error O mapa da digitação mantém texto até o salvamento.
notasAlteradas({}, { "c1|a1": 2 });
// @ts-expect-error A configuração enviada precisa incluir a banca e os avaliadores.
dadosDaConfiguracaoParaSalvar({ roteiro: "r1" });
// @ts-expect-error Comparecimento aceita apenas os códigos conhecidos.
calcularEntrevista({ roteiro: null, compareceu: "SIM", avaliacoes: [] });
// @ts-expect-error O resultado contém notas numéricas ou null.
const notaTextual: string = resultado.total;
void notaTextual;
