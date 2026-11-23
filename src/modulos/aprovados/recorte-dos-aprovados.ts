import type {
  CandidatoAprovado,
  ListaDeAprovados,
  SnapshotDosAprovados,
} from "./tipos-do-estado.ts";
import type { FiltrosDaTabelaDeAprovados } from "./tipos-da-aba-de-aprovados.ts";
import { useMemo, useState } from "react";
import {
  naLocalidade,
  opcoesDeLocalidade,
} from "../../lib/aprovados/localidade-da-vaga.ts";
import {
  candidateCargosForEdital,
  candidateModalidadesForEdital,
  filterApprovedCandidates,
  manterSoAsOpcoes,
  opcoesDeEdital,
} from "../../lib/aprovados/lista-aprovados-rules.ts";
import { separarAprovados } from "../../lib/aprovados/ativos-e-historico-dos-aprovados.ts";
import {
  vistaDaLista,
  type VistaDaLista,
} from "../../lib/base/ativos-e-historico.ts";
import { soDosEditais } from "../../componentes/dados-do-monitoramento.ts";
import { usarEstadoDaSessao } from "../../ui/index.ts";

/*
  O RECORTE DA LISTA DE APROVADOS: os candidatos e as listas dos editais da
  área, separados em Ativos e Histórico, com os filtros (edital, localidade,
  cargo, modalidade, situação) e as opções que cada filtro oferece. É o mesmo
  na Lista de aprovados (aba Aprovados) e no relatório "Resumo por cargo e
  status" de Relatórios (src/modulos/paineis-de-dados/resumo-por-cargo.tsx),
  que contam a mesma lista com as mesmas regras.

  Cargo e modalidade só oferecem o que existe nos editais escolhidos, e o que
  deixou de ser opção deixa de filtrar — estaria a esconder linhas sem
  aparecer na tela. A localidade (16/11/2026) sai do texto do cargo
  (localidade-da-vaga.ts); com uma escolhida, o filtro Cargo só oferece os
  cargos dela.
*/

export const FILTROS_INICIAIS: FiltrosDaTabelaDeAprovados = Object.freeze({
  candidatos: [],
  editalId: [],
  localidade: [],
  cargo: [],
  modalidade: [],
  status: [],
});

export interface AreaDoRecorte {
  /** Os editais da área (os da tela). */
  ids: ReadonlySet<string>;
  /** As linhas do monitoramento da área (Ativos × Histórico). */
  linhas: readonly unknown[];
  /** A chave da vista guardada na sessão da aba. */
  chaveDaVista: string;
  /** Os filtros ao montar (o atalho de outra tela). */
  filtrosIniciais?: Partial<FiltrosDaTabelaDeAprovados>;
  /** A vista ao montar, se não houver uma guardada. */
  vistaInicial?: VistaDaLista;
}

export function usarRecorteDosAprovados(
  dados: Pick<SnapshotDosAprovados, "listas" | "candidatos">,
  {
    ids,
    linhas,
    chaveDaVista,
    filtrosIniciais,
    vistaInicial = "ativos",
  }: AreaDoRecorte,
) {
  const listas = useMemo<ListaDeAprovados[]>(
    () => soDosEditais(dados.listas, ids),
    [dados.listas, ids],
  );
  const candidatos = useMemo<CandidatoAprovado[]>(
    () => soDosEditais(dados.candidatos, ids),
    [dados.candidatos, ids],
  );
  /*
    Ativos (o padrão) e Histórico: a lista de trabalho tem só os candidatos
    de edital vigente e lista ativa; o filtro de Edital, os indicadores e a
    contagem partem da vista (src/lib/aprovados/ativos-e-historico-dos-aprovados.ts).
  */
  const [vista, setVista] = usarEstadoDaSessao<VistaDaLista>(
    chaveDaVista,
    vistaInicial,
    vistaDaLista,
  );
  const separados = useMemo(
    () => separarAprovados(listas, candidatos, linhas),
    [listas, candidatos, linhas],
  );
  const listasDaVista = separados[vista].listas;
  const candidatosDaVista = separados[vista].candidatos;
  const [filtros, setFiltros] = useState<FiltrosDaTabelaDeAprovados>(() => ({
    ...FILTROS_INICIAIS,
    ...filtrosIniciais,
  }));

  const opcoesEditais = useMemo(
    () => opcoesDeEdital(listasDaVista),
    [listasDaVista],
  );
  // Os editais das duas vistas: o pedido de filtro e a faixa das etapas.
  const opcoesDeTodos = useMemo(() => opcoesDeEdital(listas), [listas]);
  const editais = manterSoAsOpcoes(filtros.editalId, opcoesEditais);
  const chaveDosEditais = editais.join("\u0000");
  const localidades = useMemo(
    () => opcoesDeLocalidade(candidatosDaVista, editais),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [candidatosDaVista, chaveDosEditais],
  );
  const localidadesEscolhidas = manterSoAsOpcoes(
    filtros.localidade,
    localidades,
  );
  const chaveDasLocalidades = localidadesEscolhidas.join("\u0000");
  const opcoes = useMemo(
    () => ({
      editais: opcoesEditais,
      localidades,
      cargos: candidateCargosForEdital(candidatosDaVista, editais).filter(
        (cargo) => naLocalidade(cargo, localidadesEscolhidas),
      ),
      modalidades: candidateModalidadesForEdital(candidatosDaVista, editais),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      candidatosDaVista,
      opcoesEditais,
      chaveDosEditais,
      localidades,
      chaveDasLocalidades,
    ],
  );
  const efetivos: FiltrosDaTabelaDeAprovados = {
    candidatos: filtros.candidatos,
    editalId: editais,
    localidade: localidadesEscolhidas,
    cargo: manterSoAsOpcoes(filtros.cargo, opcoes.cargos),
    modalidade: manterSoAsOpcoes(filtros.modalidade, opcoes.modalidades),
    status: filtros.status,
  };
  /*
    O banco confere o total da exportação por edital, cargo e modalidade
    (registrar_exportacao_aprovados): a localidade vai como os cargos dela.
  */
  const filtrosParaExportar: FiltrosDaTabelaDeAprovados = {
    ...efetivos,
    cargo:
      efetivos.localidade.length && !efetivos.cargo.length
        ? [...opcoes.cargos]
        : efetivos.cargo,
  };
  const chaveDosFiltros = JSON.stringify(efetivos);
  const filtrados = useMemo(
    () => filterApprovedCandidates(candidatosDaVista, efetivos),
    // A chave é o conteúdo dos filtros (objetos novos a cada desenho).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [candidatosDaVista, chaveDosFiltros],
  );

  function mudarFiltro(
    campo: keyof FiltrosDaTabelaDeAprovados,
    valores: string[],
  ) {
    setFiltros((atuais) => {
      const proximos = { ...atuais, [campo]: valores };
      if (campo === "editalId") {
        proximos.localidade = manterSoAsOpcoes(
          atuais.localidade,
          opcoesDeLocalidade(candidatosDaVista, valores),
        );
        proximos.cargo = manterSoAsOpcoes(
          atuais.cargo,
          candidateCargosForEdital(candidatosDaVista, valores),
        );
        proximos.modalidade = manterSoAsOpcoes(
          atuais.modalidade,
          candidateModalidadesForEdital(candidatosDaVista, valores),
        );
      }
      return proximos;
    });
  }

  const limparFiltros = () => setFiltros(FILTROS_INICIAIS);

  // Trocar de vista recomeça os filtros (os editais de uma não são da outra).
  function mudarVista(nova: VistaDaLista) {
    if (nova === vista) return;
    setVista(nova);
    limparFiltros();
  }

  return {
    listas,
    candidatos,
    separados,
    vista,
    setVista,
    mudarVista,
    listasDaVista,
    candidatosDaVista,
    filtros,
    setFiltros,
    opcoesEditais,
    opcoesDeTodos,
    editais,
    opcoes,
    efetivos,
    filtrosParaExportar,
    filtrados,
    mudarFiltro,
    limparFiltros,
  };
}
