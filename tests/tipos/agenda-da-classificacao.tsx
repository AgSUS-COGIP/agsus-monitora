import { Agenda } from "../../src/modulos/classificacao/agenda.tsx";
import { calcularClassificacao } from "../../src/modulos/classificacao/classificacao.tsx";
import { criarEstadoDaAgenda } from "../../src/modulos/classificacao/estado-da-agenda.ts";
import type { EstadoDaClassificacao } from "../../src/modulos/classificacao/tipos-do-estado.ts";
import {
  gerarAgenda,
  itensParaSalvar,
} from "../../src/lib/agenda-das-entrevistas.ts";
export function conferirAgenda(estado: EstadoDaClassificacao) {
  const agenda = criarEstadoDaAgenda();
  void agenda.salvarAgenda({
    acao: "GERAR",
    itens: itensParaSalvar(gerarAgenda([], null).itens),
  });
  return (
    <Agenda
      estado={estado}
      agenda={agenda}
      e={estado.obter()}
      calcular={calcularClassificacao}
    />
  );
}
export function rejeitarAgendaInvalida() {
  const agenda = criarEstadoDaAgenda();
  // @ts-expect-error A ação precisa corresponder às gravações aceitas pelo banco.
  void agenda.salvarAgenda({ acao: "PUBLICAR", itens: [] });
  // @ts-expect-error Candidato precisa de identidade, metadados e horários tipados.
  agenda.exportarXlsx([{ nome: "Ana" }]);
}
