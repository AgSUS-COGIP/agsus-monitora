export interface ConvocadoDaAgenda {
  analiseId: string;
  nome: string;
  vaga: string;
  cargo: string;
  lotacao?: string;
  posicao: number | null;
  modalidades: string[];
}
export interface HorarioDaAgenda {
  data: string;
  inicio: string;
  fim: string;
  banca: number;
}
export interface ItemDaAgenda extends ConvocadoDaAgenda {
  data: string | null;
  inicio: string | null;
  fim: string | null;
  banca: number | null;
  origem: "GERADA" | "MANUAL";
  foraDaLista?: boolean;
}
export type ItemComHorario = ItemDaAgenda & HorarioDaAgenda;
export interface ItemParaSalvar {
  analise: string;
  data: string;
  inicio: string;
  fim: string;
  banca: number;
  origem: "GERADA" | "MANUAL";
}
export interface RegraDaAgenda {
  schema: number;
  datas: {
    modo: string;
    inicio: string;
    fim: string;
    so_dias_uteis: boolean;
    dias: string[];
    excluir: string[];
  };
  periodos: { inicio: string; fim: string }[];
  duracao_min: number;
  intervalo_min: number;
  pausa: { inicio: string; fim: string } | null;
  bancas: number;
  nomes_das_bancas: string[];
  ordem: string;
  agrupar_por_cargo: boolean;
  reservar_primeiro_horario: boolean;
  fuso: string;
}
export type AvisoDaAgenda = {
  codigo: string;
  tom: "danger" | "warning";
  texto: string;
};
