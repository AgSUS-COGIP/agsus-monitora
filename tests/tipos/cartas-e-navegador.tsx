import { criarEstadoDaCarta } from "../../src/modulos/aprovados/carta-de-convocacao/estado.ts";
import type {
  CandidatoDaCarta,
  EstadoPaiDaCarta,
  ModeloDaCarta,
} from "../../src/lib/tipos-da-carta.ts";
import {
  montarCartas,
  gerarDocxDasCartas,
} from "../../src/lib/carta-de-convocacao-documento.ts";
import {
  copiarParaAreaDeTransferencia,
  imprimirPagina,
  logoEmPng,
} from "../../src/modulos/classificacao/documento-no-navegador.ts";
import { ModalDaCarta } from "../../src/modulos/aprovados/carta-de-convocacao/modal-da-carta.tsx";
import { ModelosDaCarta } from "../../src/modulos/aprovados/carta-de-convocacao/modelos-da-carta.tsx";

const carta = criarEstadoDaCarta({
  supabase: { rpc: async () => ({ data: null, error: null }) },
});
const estado: EstadoPaiDaCarta = {
  carta,
  fecharModal: () => {},
  abrirModelosDaCarta: () => {},
  assinar: () => () => {},
  obter: () => ({ acao: null }),
};
const candidatos: CandidatoDaCarta[] = [
  { candidato_id: "a1", nome: "Ana", classificacao: 1 },
];
const modelo: ModeloDaCarta | null = carta.obter().modelos[0] ?? null;
void (
  <ModalDaCarta estado={estado} candidatos={candidatos} podeEditarModelos />
);
void (<ModelosDaCarta estado={estado} candidatos={candidatos} listas={[]} />);
const doc = montarCartas({ modelo, candidatos });
const bytes: Uint8Array = gerarDocxDasCartas(doc);
void bytes;
const copia: Promise<"html" | "texto" | ""> = copiarParaAreaDeTransferencia({
  html: "<p>Ana</p>",
  texto: "Ana",
});
void copia;
// @ts-expect-error A impressão recebe HTML textual.
imprimirPagina(123);
// @ts-expect-error A largura do logo é numérica.
logoEmPng("/logo.png", { largura: "320" });
// @ts-expect-error A saída da carta é um formato conhecido.
carta.emitir({ modelo, candidatos, emissao: {}, saida: "EXE" });
