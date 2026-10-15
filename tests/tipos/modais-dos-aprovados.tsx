import { criarEstadoDaListaDeAprovados } from "../../src/modulos/aprovados/estado.ts";
import {
  ModalDeAnexos,
  ModalDeStatus,
  ModalSubJudice,
} from "../../src/modulos/aprovados/modais.tsx";
import { ModalListasDoEdital } from "../../src/modulos/aprovados/modal-listas-do-edital.tsx";
import { GavetaDoCandidato } from "../../src/modulos/aprovados/gaveta-do-candidato.tsx";
import type {
  PropsDoCampoDeAnexos,
  PropsDoModalSubJudice,
  PropsDoModalDeStatus,
} from "../../src/modulos/aprovados/tipos-dos-modais.ts";
import type { CartaDoHistorico } from "../../src/lib/tipos-da-carta.ts";

const estado = criarEstadoDaListaDeAprovados();
const candidato = {
  candidato_id: "ana",
  nome: "Ana",
  status: null,
  cargo: null,
};
void (<ModalDeStatus estado={estado} candidato={candidato} perfil={null} />);
void (
  <ModalDeAnexos
    estado={estado}
    perfil={null}
    candidato={candidato}
    anexos={[]}
  />
);
void (
  <ModalSubJudice
    estado={estado}
    perfil={null}
    listas={[]}
    candidatos={[candidato]}
    aba="aprovado"
  />
);
void (
  <ModalListasDoEdital
    estado={estado}
    dados={estado.obter()}
    editalId="10"
    rotulo="Edital"
  />
);
void (
  <GavetaDoCandidato estado={estado} perfil={null} candidato={candidato} />
);
const anexos: PropsDoCampoDeAnexos = {
  jaAnexados: 0,
  // @ts-expect-error O rascunho contém arquivos, não nomes de arquivo.
  arquivos: ["termo.pdf"],
  aoMudar: (arquivos) => void arquivos[0]?.arrayBuffer(),
};
const subJudice: PropsDoModalSubJudice = {
  estado,
  perfil: null,
  listas: [],
  candidatos: [],
  // @ts-expect-error A aba inicial precisa ser uma das duas opções do modal.
  aba: "arquivos",
};
const status: PropsDoModalDeStatus = {
  estado,
  perfil: null,
  // @ts-expect-error Não se altera status de uma pessoa sem identificador.
  candidato: { nome: "Ana" },
};
// @ts-expect-error Toda carta exibida no histórico tem identificador validado.
const carta: CartaDoHistorico = { modelo: "Carta padrão" };
void [anexos, subJudice, status, carta];
