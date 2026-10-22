import {
  fonteDaConvocacao,
  gruposDaConvocacao,
  aConvocar,
  avisosDaConvocacao,
} from "../../src/lib/convocacao-da-entrevista.ts";
import {
  ListaDeConvocacao,
  BotaoIrPara,
  DesempateDaClassificacao,
} from "../../src/modulos/entrevistas/conducao.tsx";
import type { FonteDaConvocacao } from "../../src/lib/tipos-da-convocacao-da-entrevista.ts";
import type { DadosDoEdital } from "../../src/modulos/entrevistas/tipos.ts";

const dados: DadosDoEdital = {
  edital: { id: "e1" },
  configuracao: null,
  avaliadores: [],
  convocados: [],
  lista_convocacao: { lista: { id: "l1" }, retrato: { vagas: [] } },
};
const fonte = fonteDaConvocacao(dados);
const grupos = gruposDaConvocacao(fonte.resultado, dados.convocados);
const ids: string[] = aConvocar(grupos);
const avisos = avisosDaConvocacao(dados, fonte, grupos);
if (fonte.tipo === "LISTA") {
  const id: string = fonte.lista.id;
  void id;
}
const tela = (
  <ListaDeConvocacao
    dados={dados}
    fonte={fonte}
    grupos={grupos}
    salvando={false}
    ocupado={false}
    aoConvocar={async (analises) => ({ ok: analises.length > 0 })}
    aoDesconvocar={async (entrevista, motivo) => ({
      ok: Boolean(entrevista && motivo),
    })}
  />
);
const botao = (
  <BotaoIrPara view="classificacao" edital={dados.edital}>
    Classificação
  </BotaoIrPara>
);
const desempate = (
  <DesempateDaClassificacao regra={{ desempate: [] }} edital={dados.edital} />
);
void [ids, avisos, tela, botao, desempate];
// @ts-expect-error Fonte LISTA exige os metadados da lista vigente.
const semLista: FonteDaConvocacao = {
  tipo: "LISTA",
  lista: null,
  resultado: { vagas: [] },
};
// @ts-expect-error Cálculo de consulta não carrega uma lista convocável.
const calculoComLista: FonteDaConvocacao = {
  tipo: "CALCULO",
  lista: { id: "l1" },
  resultado: { vagas: [] },
};
// @ts-expect-error Avisos recebem os grupos normalizados, não o JSON bruto.
avisosDaConvocacao(dados, fonte, [{ vaga: "V1" }]);
void [semLista, calculoComLista];
