import {
  montarConvocacaoDaVaga,
  montarListaDeConvocacao,
  ordenarPorClassificacao,
  normalizarQuadro,
  csvDaConvocacao,
} from "../../src/lib/lista-convocacao-rules.ts";
import { modeloEmBranco } from "../../src/lib/modelo-de-convocacao.ts";
import { AbaConvocacao } from "../../src/modulos/aprovados/aba-convocacao.tsx";
import type {
  EstadoDaAbaDaConvocacao,
  CandidatoDaTabelaDaConvocacao,
} from "../../src/modulos/aprovados/tipos-da-aba-de-convocacao.ts";
const modelo = modeloEmBranco();
const candidatos = [
  { candidato_id: "a1", nome: "Ana", nota: 90, extra: true, edital_id: "e1" },
];
const ordenados = ordenarPorClassificacao(candidatos);
const extra: boolean | undefined = ordenados[0]?.extra;
const resultado = montarConvocacaoDaVaga({
  candidatos,
  modelo,
  quadro: { ampla: 1 },
});
const nota: number | undefined = resultado.linhas[0]?.candidato.nota;
const grupos = montarListaDeConvocacao(candidatos, () => ({
  modelo,
  quadro: { ampla: 1 },
}));
const csv: string = csvDaConvocacao(grupos, {
  rotulo: (g, id) => g.modelo.nome + id,
});
const estado: EstadoDaAbaDaConvocacao = {
  abrirCandidato: () => {},
  abrirStatus: () => {},
  abrirCarta: () => {},
  abrirModelosDaCarta: () => {},
  baixarArquivo: () => {},
};
void (
  <AbaConvocacao
    ativa
    estado={estado}
    perfil={null}
    candidatos={candidatos}
    listas={[]}
    configs={new Map()}
    modelos={new Map()}
    carregado
    erroAoCarregar={false}
  />
);
void [extra, nota, csv];
// @ts-expect-error O quadro usa chaves de categorias, não uma lista.
normalizarQuadro([], modelo);
// @ts-expect-error A sequência contém identificadores textuais.
const ciclo: number[] = resultado.ciclo;
void ciclo;
const semIdentidade: CandidatoDaTabelaDaConvocacao[] = [
  // @ts-expect-error A tabela exige identidade e nome do candidato.
  { nota: 90 },
];
void semIdentidade;
