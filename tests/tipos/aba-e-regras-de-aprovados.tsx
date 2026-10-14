import {
  filterApprovedCandidates,
  paginateApprovedCandidates,
  canEditCandidateStatus,
} from "../../src/lib/lista-aprovados-rules.ts";
import type { FiltrosDasRegrasDeAprovados } from "../../src/lib/tipos-das-regras-de-aprovados.ts";
import type {
  PropsDaAbaDeAprovados,
  EstadoDaAbaDeAprovados,
} from "../../src/modulos/aprovados/tipos-da-aba-de-aprovados.ts";
import { AbaAprovados } from "../../src/modulos/aprovados/aba-aprovados.tsx";
import type { PropsDoCampoEditavel } from "../../src/modulos/aprovados/partes.tsx";
import {
  CampoEditavel,
  AcaoDeStatus,
} from "../../src/modulos/aprovados/partes.tsx";
const candidato = {
  candidato_id: "a1",
  nome: "Ana",
  cargo: "Enfermeiro",
  classificacao: 1,
  extra: true,
};
const candidatos = [candidato];
const filtrados = filterApprovedCandidates(candidatos, {
  cargo: ["Enfermeiro"],
  status: "",
});
const pagina = paginateApprovedCandidates(filtrados);
const extra: boolean | undefined = pagina.rows[0]?.extra;
void extra;
canEditCandidateStatus({ permissoes: { aprovados: "editor" } }, candidatos[0]);
const estado: EstadoDaAbaDeAprovados = {
  assinar: () => () => {},
  obter: () => ({ acao: null }),
  abrirCandidato: () => {},
  abrirAnexos: () => {},
  abrirStatus: () => {},
  abrirCarta: () => {},
  abrirAlteracaoJudicial: () => {},
  removerSubJudice: async () => true,
};
const props: PropsDaAbaDeAprovados = {
  ativa: true,
  estado,
  perfil: null,
  candidatos,
  anexos: new Map(),
  carregado: true,
  erroAoCarregar: "",
  opcoes: { editais: [], cargos: [], modalidades: [] },
  filtros: {
    candidatos: [],
    editalId: [],
    cargo: [],
    modalidade: [],
    status: [],
  },
  aoMudarFiltro: () => {},
  aoLimparFiltros: () => {},
  pagina,
  tamanho: 50,
  aoIrPara: () => true,
  aoMudarTamanho: () => {},
};
void (<AbaAprovados {...props} />);
void (
  <AcaoDeStatus perfil={null} candidato={candidato} aoAbrir={(id) => void id} />
);
void (
  <CampoEditavel
    valor={0}
    ler={Number}
    aoMudar={(numero) => void numero.toFixed(2)}
  />
);
void (
  <CampoEditavel
    valor="12"
    ler={Number}
    aoMudar={(numero) => void numero.toFixed(2)}
  />
);
void (
  <CampoEditavel valor="Ana" aoMudar={(texto) => void texto.toUpperCase()} />
);
const filtroInvalido: FiltrosDasRegrasDeAprovados = {
  // @ts-expect-error A seleção de cargos recebe texto ou números, não uma flag.
  cargo: true,
};
void filtroInvalido;
const campoInvalido: PropsDoCampoEditavel<number, number> = {
  valor: 0,
  ler: Number,
  // @ts-expect-error O conversor entrega um número ao callback.
  aoMudar: (texto: string) => void texto,
};
void campoInvalido;
