import { FichaDoCandidato } from "../../src/modulos/entrevistas/ficha.tsx";
import type { DadosDoEdital } from "../../src/modulos/entrevistas/tipos.ts";
import type { PayloadDasNotas } from "../../src/modulos/entrevistas/tipos-da-ficha.ts";

declare const dados: DadosDoEdital;
const notas: PayloadDasNotas = {
  notas: [
    { competencia: "c1", avaliador: "a1", nota: null },
    {
      competencia: "c2",
      avaliador: "a1",
      aspectos: [{ aspecto: "x1", nota: 4 }],
    },
    { competencia: "c3", avaliador: "a1", aspectos: null },
  ],
  observacoes: [{ avaliador: "a1", texto: null }],
  justificativa: "Justificativa da banca",
  compareceu: "S",
  banca: 1,
};
void notas;
void (
  <FichaDoCandidato
    dados={dados}
    convocado={{ id: "i1" }}
    salvando={false}
    aoSalvar={async (payload) => {
      const confirmado: PayloadDasNotas = payload;
      void confirmado;
      return { ok: true };
    }}
    aoAbrir={(id) => {
      const entrevista: string = id;
      void entrevista;
    }}
    aoFechar={() => {}}
  />
);

const notaTextual: PayloadDasNotas = {
  // @ts-expect-error O texto digitado deve ser convertido antes do salvamento.
  notas: [{ competencia: "c1", avaliador: "a1", nota: "4,5" }],
};
const notaAmbigua: PayloadDasNotas = {
  // @ts-expect-error Uma nota usa valor direto ou aspectos, nunca ambos.
  notas: [{ competencia: "c1", avaliador: "a1", nota: 4, aspectos: null }],
};
const comparecimentoInvalido: PayloadDasNotas = {
  notas: [],
  // @ts-expect-error O banco aceita os códigos S e N.
  compareceu: "SIM",
};
void [notaTextual, notaAmbigua, comparecimentoInvalido];
