import {
  EditorDeRoteiro,
  VisaoDeRoteiros,
} from "../../src/modulos/entrevistas/roteiros.tsx";
import { trocarNaLista } from "../../src/modulos/entrevistas/partes.tsx";
import {
  dadosDoRoteiroParaSalvar,
  rascunhoDoRoteiro,
} from "../../src/lib/roteiro-de-entrevista.js";
import { frasesDaEliminacao } from "../../src/lib/resumo-da-entrevista.ts";
import type {
  DadosDoRoteiroParaSalvar,
  RoteiroDeEntrevista,
} from "../../src/lib/tipos-do-roteiro-de-entrevista.ts";
import type { EstadoDaConducaoComAcoes } from "../../src/modulos/entrevistas/tipos.ts";

declare const conducao: EstadoDaConducaoComAcoes;
declare const roteiro: RoteiroDeEntrevista;
const rascunho = rascunhoDoRoteiro(roteiro, { modo: "duplicar" });
const previa: string[] = frasesDaEliminacao(rascunho);
void previa;
const dados: DadosDoRoteiroParaSalvar = dadosDoRoteiroParaSalvar(rascunho);
void dados;
void (
  <VisaoDeRoteiros
    conducao={conducao}
    area="projetos"
    pedido={{ roteiro, vez: 1 }}
  />
);
void (
  <EditorDeRoteiro
    roteiro={null}
    modo="novo"
    area="projetos"
    aoFechar={() => {}}
    aoSalvar={async (payload) => {
      const nota: number | null = payload.competencias[0]?.nota_maxima ?? null;
      void nota;
      return { ok: true };
    }}
  />
);

const membros = [{ chave: "a1", nome: "Ana", competencias: ["c1"] }];
trocarNaLista(membros, "a1", "competencias", ["c2"]);
// @ts-expect-error A alteração precisa usar um campo existente.
trocarNaLista(membros, "a1", "campo_inexistente", "Ana");
// @ts-expect-error O valor deve corresponder ao tipo do campo.
trocarNaLista(membros, "a1", "competencias", "c2");
// @ts-expect-error O editor só aceita os quatro modos declarados.
rascunhoDoRoteiro(roteiro, { modo: "apagar" });
const passoTextual: DadosDoRoteiroParaSalvar = {
  ...dados,
  // @ts-expect-error Campos numéricos são convertidos antes de enviar ao banco.
  passo: "0,5",
};
void passoTextual;
