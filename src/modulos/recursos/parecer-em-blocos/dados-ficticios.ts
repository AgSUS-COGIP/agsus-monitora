import { diasDosIntervalos } from "../../../lib/avaliacao-documental/pontuacao.ts";
import {
  periodoDeInterposicao,
  type DadosParaOParecer,
  type FonteDoParecer,
} from "../../../lib/parecer-em-blocos.ts";
import { classificarCronograma } from "../../../lib/prazo-do-recurso.ts";

/*
  A fonte de dados do PROTÓTIPO do parecer: um caso fictício, no formato que
  as RPCs entregariam (docs/recursos/parecer-em-blocos.md diz qual RPC dá cada
  campo). Nada aqui lê ou grava no banco. O cronograma passa pela mesma
  classificação do prazo do recurso (prazo-do-recurso.ts) e os meses da ficha
  pela mesma conta da Avaliação documental (diasDosIntervalos ÷ 30).
*/

const CRONOGRAMA_FICTICIO = [
  {
    edital_id: "e-99",
    ordem: 9,
    atividade: "Resultado preliminar da avaliação documental",
    inicio: "2026-10-17",
    fim: "2026-10-17",
  },
  {
    edital_id: "e-99",
    ordem: 10,
    atividade: "Prazo de recurso do resultado preliminar documental",
    inicio: "2026-10-20",
    fim: "2026-10-21",
  },
  {
    edital_id: "e-99",
    ordem: 11,
    atividade: "Análise e resposta ao recurso",
    inicio: "2026-10-22",
    fim: "2026-10-30",
  },
];

const VINCULOS_FICTICIOS = [
  {
    empregador: "Hospital Regional Fictício",
    categoria: "CLT",
    inicio: "2019-03-01",
    fim: "2021-02-28",
    aceito: true,
  },
  {
    empregador: "UBS Aldeia Exemplo",
    categoria: "PUBLICO",
    inicio: "2020-06-01",
    fim: "2022-05-31",
    aceito: true,
  },
  {
    empregador: "Clínica Modelo Ltda.",
    categoria: "CLT",
    inicio: "2023-01-02",
    fim: "2023-08-31",
    aceito: false,
    motivo: "CTPS digital sem a data de saída",
  },
];

function casoFicticio(): DadosParaOParecer {
  const etapas = classificarCronograma(CRONOGRAMA_FICTICIO);
  const aceitos = VINCULOS_FICTICIOS.filter((v) => v.aceito);
  return {
    recurso: {
      id: "ficticio-1",
      candidato: "Maria Fictícia da Silva",
      codigo: 990001,
      edital: "99/2026",
      unidade: "DSEI Yanomami",
      vaga: "Enfermeiro",
      cargo: "Enfermeiro",
      processo_sei: "25000.000000/2026-00",
      situacao: "PARCIALMENTE_INDEFERIDO",
      enviado_em: "2026-10-21T18:40:00-03:00",
      criado_em: "2026-10-22T09:05:00-03:00",
      observacao:
        "a experiência na UBS Aldeia Exemplo não foi computada e o mestrado foi desconsiderado",
    },
    periodo: periodoDeInterposicao(
      etapas.map((e) => ({ ...e, atividade: e.atividade })),
      "analise-curricular",
    ),
    ficha: {
      nivel: "superior",
      modalidades: ["PCD"],
      indigena: true,
      mora_aldeia: true,
      blocos: [
        { codigo: "IDENTIDADE", tipo: "DOCUMENTO", situacao: "CONFORME" },
        { codigo: "ESCOLARIDADE", tipo: "DOCUMENTO", situacao: "CONFORME" },
        {
          codigo: "CRITERIO_ETNICO",
          tipo: "PONTUACAO",
          situacao: "CONFORME",
          efeito: "SEM_PONTOS_ALDEIA",
        },
        { codigo: "TITULACAO", tipo: "TITULOS", situacao: "CONFORME" },
        { codigo: "EXPERIENCIA", tipo: "VINCULOS", situacao: "CONFORME" },
        {
          codigo: "COTA_PCD",
          tipo: "COTA",
          titulo: "Laudo PcD",
          situacao: "NAO_CONFORME",
          efeito: "SEGUE_AMPLA",
        },
      ],
      titulos: [
        { titulo: "ESPECIALIZACAO", aceito: true },
        {
          titulo: "MESTRADO",
          aceito: false,
          motivo: "ata de defesa no lugar do diploma",
        },
      ],
      vinculos: VINCULOS_FICTICIOS,
      meses_apurados: Math.floor(diasDosIntervalos(aceitos) / 30),
    },
    regra: {
      blocos: [
        {
          codigo: "CRITERIO_ETNICO",
          tipo: "PONTUACAO",
          item_edital: "8.10",
          indigena: 8,
          aldeia: 8,
        },
        { codigo: "TITULACAO", tipo: "TITULOS", item_edital: "8.12" },
        {
          codigo: "EXPERIENCIA",
          tipo: "VINCULOS",
          item_edital: "8.15",
          pontos_por_mes: 0.2,
        },
      ],
      referencias_do_parecer: { anexo_pcd: "VIII" },
    },
    ajuste: { situacao: "APROVADO", nota_antiga: 12.4, nota_nova: 13.6 },
  };
}

/** A fonte fictícia: cada carga devolve uma cópia nova do mesmo caso. */
export const dadosFicticios: FonteDoParecer = {
  carregar: async () => casoFicticio(),
};
