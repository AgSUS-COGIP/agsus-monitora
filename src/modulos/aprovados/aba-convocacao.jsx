import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  OPCOES_DO_FILTRO_DE_STATUS,
  SEM_STATUS,
  candidateCargosForEdital,
  manterSoAsOpcoes,
  opcoesDeEdital,
  paginateApprovedCandidates,
} from "../../lib/lista-aprovados-rules.js";
import {
  csvDaConvocacao,
  estaAConvocar,
  montarListaDeConvocacao,
  resumirConvocacao,
} from "../../lib/lista-convocacao-rules.js";
import { canChangeCandidateStatus } from "../../lib/access-roles.js";
import {
  lerModalidade,
  rotuloDaCategoria,
  siglaDaCategoria,
} from "../../lib/modelo-de-convocacao.js";
import {
  configuracaoDaVaga,
  ordinalFeminino,
  resumirQuadro,
} from "../../lib/configuracao-de-convocacao.js";
import { MultiSelectBusca } from "../../componentes/multi-select-busca.jsx";
import { formatNumberBR } from "../../lib/formatters.js";
import {
  Campo,
  GradeDeKpis,
  Kpi,
  LinhasEsqueleto,
  PainelDeFiltros,
  classes,
} from "../../ui/index.js";
import {
  AcaoDeCarta,
  AcaoDeStatus,
  NomeDoCandidato,
  NotaDoCandidato,
  Paginacao,
  SeloDeStatus,
} from "./partes.jsx";

/*
  A aba "Lista de convocação" da página: a ordem de chamada que sai do modelo
  de regras e das vagas imediatas de cada edital. O cálculo está em
  `lib/lista-convocacao-rules.js`; aqui fica o desenho.

  Ordem e Classificação geral são coisas diferentes, e mostrar as duas lado a
  lado é o ponto: Ordem é a posição que o cálculo de convocação deu;
  Classificação geral é o número que veio pronto no XLSX importado, antes de
  qualquer cota entrar em jogo. Uma pessoa pode ter Ordem 2 e Classificação 5
  porque foi chamada mais cedo por conta de uma reserva.
*/

const text = (value) => String(value ?? "").trim();
const FILTROS_INICIAIS = Object.freeze({ editalId: [], cargo: [], status: [] });

/*
  Devolve um teste de status já resolvido: a lista de escolhas é lida uma vez
  por desenho, e não por linha.
*/
function filtroDeStatus(escolhidos) {
  if (!escolhidos.length) return () => true;
  return (candidato) => {
    const status = text(candidato?.status);
    return escolhidos.some((escolha) =>
      escolha === SEM_STATUS ? !status : escolha === status,
    );
  };
}

/*
  A tabela é plana para poder paginar; o cabeçalho de cada vaga é reinserido
  no desenho, sempre que o grupo muda dentro da página. Paginar por grupo
  deixaria uma página com 3 linhas e outra com 400.

  Status é filtro de exibição e entra só aqui, DEPOIS do cálculo — recortar
  por ele antes tiraria da fila o desistente que o cálculo precisa de ver para
  saltar.
*/
function linhasPlanas(grupos, passaNoStatus) {
  const linhas = [];
  grupos.forEach((grupo) => {
    [...grupo.linhas, ...grupo.foraDaFila].forEach((linha) => {
      if (passaNoStatus(linha.candidato)) linhas.push({ grupo, linha });
    });
  });
  return linhas;
}

/*
  As linhas da página já vêm agrupadas por vaga — `linhasPlanas` percorre um
  grupo de cada vez —, então basta juntar as consecutivas do mesmo grupo. Cada
  bloco vira um <table> com o seu próprio cabeçalho.
*/
function emBlocos(linhas) {
  const blocos = [];
  linhas.forEach(({ grupo, linha }) => {
    const ultimo = blocos.at(-1);
    if (ultimo && ultimo.grupo === grupo) ultimo.linhas.push(linha);
    else blocos.push({ grupo, linhas: [linha] });
  });
  return blocos;
}

function VagaDaConvocacao({ grupo, linha }) {
  if (!linha.posicao)
    return <span className="convocacao-vaga fora">Fora da fila</span>;
  if (!grupo.proporcionalidade)
    return linha.imediata ? (
      <span className="convocacao-vaga imediata">
        {ordinalFeminino(linha.posicao)} · Vaga imediata
      </span>
    ) : (
      <span className="convocacao-vaga reserva">Cadastro de reserva</span>
    );
  const categoria = rotuloDaCategoria(grupo.modelo, linha.categoria);
  return (
    <>
      {linha.imediata ? (
        <span className="convocacao-vaga imediata">
          {ordinalFeminino(linha.posicao)} · {categoria}
        </span>
      ) : (
        <span className="convocacao-vaga reserva">Reserva · {categoria}</span>
      )}
      {linha.categoriaReservada ? (
        <small className="convocacao-reversao">
          Vaga de {rotuloDaCategoria(grupo.modelo, linha.categoriaReservada)}{" "}
          sem candidato
        </small>
      ) : null}
    </>
  );
}

/*
  A coluna mostra o que a pessoa DECLAROU, e não a reserva em que acabou por
  concorrer: são coisas diferentes desde que a regra de cota múltipla entrou
  no cálculo. Quem declarou duas vê as duas siglas, com a que vale em
  destaque — sem isso, a lista pareceria ter perdido uma das cotas da pessoa.
*/
function ModalidadeDeclarada({ candidato, linha, modelo }) {
  const declarada = text(candidato.modalidade);
  if (!declarada)
    return <span className="convocacao-modalidade vazia">Não declarada</span>;
  const reconhecida = lerModalidade(declarada, modelo).reconhecida;
  const reservas = linha.reservas || [];
  const efetivas = linha.reservasEfetivas || [];
  return (
    <div className="convocacao-modalidade">
      <span>{declarada}</span>
      {reservas.length ? (
        <small className="convocacao-siglas">
          {reservas.map((id, indice) => {
            const sigla = siglaDaCategoria(modelo, id);
            return (
              <Fragment key={id}>
                {indice ? " · " : ""}
                {efetivas.includes(id) && reservas.length > 1 ? (
                  <strong>{sigla}</strong>
                ) : (
                  sigla
                )}
              </Fragment>
            );
          })}
        </small>
      ) : null}
      {reservas.length > 1 && efetivas.length < reservas.length ? (
        <small className="convocacao-multipla">
          Concorre só na de maior percentual
        </small>
      ) : null}
      {reconhecida ? null : (
        <small className="convocacao-alerta">
          <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />{" "}
          Termo não reconhecido — disputa só a ampla
        </small>
      )}
    </div>
  );
}

/*
  O bloco por vaga: o texto descritivo ("Enfermeiro · UBS Móvel Itatiaia/RJ —
  4 vagas imediatas…") vem SEMPRE antes do cabeçalho de colunas daquela vaga,
  e não misturado como uma linha entre candidatos. Cada vaga tem o seu próprio
  <table>, com o seu próprio <thead>.
*/
function CabecalhoDoGrupo({ grupo }) {
  const quadro = grupo.proporcionalidade
    ? resumirQuadro(grupo.quadro, grupo.modelo)
    : "";
  const total = grupo.totalImediatas;
  const imediatas = total
    ? `${total} vaga${total === 1 ? "" : "s"} imediata${total === 1 ? "" : "s"}${quadro ? ` (${quadro})` : ""}`
    : "Sem vaga imediata — cadastro de reserva";
  const tipo = grupo.proporcionalidade ? "" : " · sem proporcionalidade";
  return (
    <div className="convocacao-grupo">
      <div className="convocacao-grupo-copy">
        <strong>
          {grupo.codigoVaga || "Sem código de vaga"} ·{" "}
          {grupo.cargo || "Cargo não informado"}
        </strong>
        <small>
          {grupo.edital || "Edital"}
          {grupo.unidade ? ` · ${grupo.unidade}` : ""} — {imediatas}
          {tipo}
        </small>
      </div>
    </div>
  );
}

function TabelaDoGrupo({
  grupo,
  linhas,
  perfil,
  estado,
  convocacoes,
  selecao,
}) {
  const podeEscolher = Boolean(selecao);
  return (
    <>
      <CabecalhoDoGrupo grupo={grupo} />
      <table className="approved-table convocacao-table">
        <thead>
          <tr>
            {podeEscolher ? (
              <th className="convocacao-th-escolha">
                <span className="sr-only">Escolher para a carta</span>
              </th>
            ) : null}
            <th className="num">Ordem</th>
            <th className="num">Classificação geral</th>
            <th>Vaga da convocação</th>
            <th>Nome</th>
            <th className="num">Nota</th>
            <th>Modalidade declarada</th>
            <th>Status</th>
            <th className="approved-th-acoes">Ações</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha) => {
            const candidato = linha.candidato;
            return (
              <tr
                key={candidato.candidato_id}
                className={classes(
                  linha.imediata && "convocacao-linha-imediata",
                  !linha.posicao && "convocacao-linha-fora",
                )}
                data-a-convocar={estaAConvocar(linha) ? "" : undefined}
              >
                {podeEscolher ? (
                  <td className="convocacao-escolha">
                    {candidato.lista_ativa ? (
                      <input
                        type="checkbox"
                        data-convocacao-action="escolher"
                        data-candidate-id={candidato.candidato_id}
                        aria-label={`Escolher ${candidato.nome} para a carta de convocação`}
                        checked={selecao.tem(candidato.candidato_id)}
                        onChange={() =>
                          selecao.alternar(candidato.candidato_id)
                        }
                      />
                    ) : null}
                  </td>
                ) : null}
                <td className="num">{linha.posicao ?? "—"}</td>
                <td className="num">{candidato.classificacao ?? "—"}</td>
                <td>
                  <VagaDaConvocacao grupo={grupo} linha={linha} />
                </td>
                <td>
                  <NomeDoCandidato
                    candidato={candidato}
                    aoAbrir={estado.abrirCandidato}
                  />
                </td>
                <td className="num">
                  <NotaDoCandidato candidato={candidato} />
                </td>
                <td>
                  <ModalidadeDeclarada
                    candidato={candidato}
                    linha={linha}
                    modelo={grupo.modelo}
                  />
                </td>
                <td>
                  <SeloDeStatus
                    status={text(candidato.status)}
                    dataConvocacao={
                      convocacoes.get(String(candidato.candidato_id))?.data
                    }
                  />
                </td>
                <td className="approved-actions">
                  <div className="approved-actions-grupo">
                    <AcaoDeStatus
                      perfil={perfil}
                      candidato={candidato}
                      atributos={{ "data-convocacao-action": "status" }}
                      aoAbrir={estado.abrirStatus}
                    />
                    <AcaoDeCarta
                      perfil={perfil}
                      candidato={candidato}
                      atributos={{ "data-convocacao-action": "carta" }}
                      aoAbrir={estado.abrirCarta}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}

export function AbaConvocacao({
  ativa,
  estado,
  perfil,
  candidatos,
  listas,
  configs,
  modelos,
  convocacoes = new Map(),
  carregado,
  erroAoCarregar,
}) {
  const [filtros, setFiltros] = useState(FILTROS_INICIAIS);
  /*
    Os escolhidos para a carta: sobrevivem a trocar de página e de filtro (a
    barra diz quantos são); quem saiu da lista carregada deixa de contar.
  */
  const [escolhidos, setEscolhidos] = useState(() => new Set());
  const podeEmitir = canChangeCandidateStatus(perfil);
  const [pagina, setPagina] = useState(1);
  const [tamanho, setTamanho] = useState(50);
  const tabela = useRef(null);

  const opcoesEditais = useMemo(() => opcoesDeEdital(listas), [listas]);
  const editais = manterSoAsOpcoes(filtros.editalId, opcoesEditais);
  const opcoesCargos = useMemo(
    () => candidateCargosForEdital(candidatos, editais),
    // `editais` é recalculado a cada desenho; a chave é o conteúdo.
    [candidatos, editais.join("\u0000")],
  );
  const cargos = manterSoAsOpcoes(filtros.cargo, opcoesCargos);

  /*
    Edital e cargo recortam ANTES do cálculo: cada vaga é uma convocação
    independente, então tirar as outras do caminho não mexe na ordem de nenhuma.
  */
  const grupos = useMemo(() => {
    const noRecorte = candidatos.filter((row) => {
      if (editais.length && !editais.includes(String(row.edital_id)))
        return false;
      if (cargos.length && !cargos.includes(text(row.cargo))) return false;
      return true;
    });
    return montarListaDeConvocacao(noRecorte, (editalId, codigoVaga) =>
      configuracaoDaVaga(configs, modelos, editalId, codigoVaga),
    );
  }, [
    candidatos,
    configs,
    modelos,
    editais.join("\u0000"),
    cargos.join("\u0000"),
  ]);

  const resumo = resumirConvocacao(grupos);
  const ativos = useMemo(
    () =>
      new Set(
        candidatos
          .filter((row) => row.lista_ativa)
          .map((row) => String(row.candidato_id)),
      ),
    [candidatos],
  );
  const escolhidosValidos = [...escolhidos].filter((id) => ativos.has(id));
  const selecao = podeEmitir
    ? {
        tem: (id) => escolhidos.has(String(id)),
        alternar: (id) =>
          setEscolhidos((atuais) => {
            const proximos = new Set(atuais);
            const chave = String(id);
            if (proximos.has(chave)) proximos.delete(chave);
            else proximos.add(chave);
            return proximos;
          }),
      }
    : null;

  /* "Escolher os a convocar": as vagas imediatas ainda sem chamada, no recorte. */
  function escolherAConvocar() {
    const ids = grupos.flatMap((grupo) =>
      grupo.linhas
        .filter((linha) => estaAConvocar(linha) && linha.candidato.lista_ativa)
        .map((linha) => String(linha.candidato.candidato_id)),
    );
    setEscolhidos(new Set(ids));
  }

  function exportarCsv() {
    const conteudo = csvDaConvocacao(grupos, {
      convocacoes,
      rotulo: (grupo, categoria) => rotuloDaCategoria(grupo.modelo, categoria),
    });
    estado.baixarArquivo(
      new Blob([conteudo], { type: "text/csv;charset=utf-8" }),
      "ordem-de-convocacao.csv",
    );
  }
  const todas = useMemo(
    () => linhasPlanas(grupos, filtroDeStatus(filtros.status)),
    [grupos, filtros.status],
  );
  const paginaAtual = useMemo(
    () => paginateApprovedCandidates(todas, pagina, tamanho),
    [todas, pagina, tamanho],
  );

  useEffect(() => {
    document.dispatchEvent(new CustomEvent("agsus:content-updated"));
  }, [paginaAtual.rows]);

  function mudarFiltro(campo, valores) {
    setFiltros((atuais) => {
      const proximos = { ...atuais, [campo]: valores };
      // Trocar de edital muda quais cargos existem.
      if (campo === "editalId")
        proximos.cargo = manterSoAsOpcoes(
          atuais.cargo,
          candidateCargosForEdital(candidatos, valores),
        );
      return proximos;
    });
    setPagina(1);
  }

  function limparFiltros() {
    setFiltros(FILTROS_INICIAIS);
    setPagina(1);
  }

  function irPara(destino) {
    const alvo = paginateApprovedCandidates(todas, destino, tamanho).page;
    if (alvo === paginaAtual.page) return;
    setPagina(alvo);
    tabela.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }

  const carregando = !carregado && !erroAoCarregar;
  const quantos = [editais, cargos, filtros.status].filter(
    (lista) => lista.length,
  ).length;
  const kpi = (idDoValor, chave, tom, icone, rotulo, valor) => (
    <Kpi
      idDoValor={idDoValor}
      chave={chave}
      tom={tom}
      icone={icone}
      rotulo={rotulo}
      valor={formatNumberBR(valor)}
      carregando={carregando}
    />
  );

  return (
    <div
      id="approvedPanelConvocacao"
      className={classes("approved-tabpanel", !ativa && "hidden")}
      role="tabpanel"
      aria-labelledby="approvedTabConvocacao"
    >
      <GradeDeKpis
        className="approved-kpis"
        rotulo="Resumo da lista de convocação"
      >
        {kpi(
          "convocacaoKpiVagas",
          "vagas",
          "info",
          "fa-list-ol",
          "Vagas na lista",
          resumo.vagas,
        )}
        {kpi(
          "convocacaoKpiImediatas",
          "imediatas",
          "destaque",
          "fa-bullseye",
          "Vagas imediatas",
          resumo.imediatas,
        )}
        {kpi(
          "convocacaoKpiAConvocar",
          "a-convocar",
          "sucesso",
          "fa-bell",
          "A convocar",
          resumo.aConvocar,
        )}
        {kpi(
          "convocacaoKpiConvocados",
          "convocados",
          "alerta",
          "fa-envelope-open-text",
          "Convocados",
          resumo.convocados,
        )}
        {kpi(
          "convocacaoKpiReserva",
          "reserva",
          "alerta",
          "fa-user-clock",
          "Cadastro de reserva",
          resumo.reserva,
        )}
        {kpi(
          "convocacaoKpiForaDaFila",
          "fora-da-fila",
          "perigo",
          "fa-user-xmark",
          "Fora da fila",
          resumo.foraDaFila,
        )}
      </GradeDeKpis>

      <PainelDeFiltros
        idDoTitulo="convocacaoFiltrosTitulo"
        className="approved-filters convocacao-filters"
        quantos={quantos}
        aoLimpar={limparFiltros}
      >
        <div className="ui-grade-de-campos">
          <Campo rotulo="Edital" idDoControle="convocacaoFilterEdital">
            <MultiSelectBusca
              id="convocacaoFilterEdital"
              placeholder="Todos os editais"
              opcoes={opcoesEditais}
              selecionados={editais}
              aoMudar={(valores) => mudarFiltro("editalId", valores)}
            />
          </Campo>
          <Campo rotulo="Cargo" idDoControle="convocacaoFilterCargo">
            <MultiSelectBusca
              id="convocacaoFilterCargo"
              placeholder="Todos os cargos"
              opcoes={opcoesCargos}
              selecionados={cargos}
              aoMudar={(valores) => mudarFiltro("cargo", valores)}
            />
          </Campo>
          <Campo rotulo="Status" idDoControle="convocacaoFilterStatus">
            <MultiSelectBusca
              id="convocacaoFilterStatus"
              placeholder="Todos os status"
              opcoes={OPCOES_DO_FILTRO_DE_STATUS}
              selecionados={filtros.status}
              aoMudar={(valores) => mudarFiltro("status", valores)}
            />
          </Campo>
        </div>
      </PainelDeFiltros>

      <div className="convocacao-acoes" id="convocacaoAcoes">
        {podeEmitir ? (
          <>
            <span className="convocacao-escolhidos" aria-live="polite">
              {escolhidosValidos.length
                ? `${formatNumberBR(escolhidosValidos.length)} escolhido${escolhidosValidos.length === 1 ? "" : "s"}`
                : ""}
            </span>
            <button
              type="button"
              className="btn secondary"
              id="convocacaoEscolherAConvocar"
              disabled={!carregado || !resumo.aConvocar}
              onClick={escolherAConvocar}
            >
              <i className="fa-solid fa-list-check" aria-hidden="true" />{" "}
              Escolher os a convocar
            </button>
            {escolhidosValidos.length ? (
              <button
                type="button"
                className="btn secondary"
                id="convocacaoLimparEscolha"
                onClick={() => setEscolhidos(new Set())}
              >
                Limpar escolha
              </button>
            ) : null}
            <button
              type="button"
              className="btn green"
              id="convocacaoCartaBtn"
              disabled={!escolhidosValidos.length}
              onClick={() => estado.abrirCarta(escolhidosValidos)}
            >
              <i
                className="fa-solid fa-envelope-open-text"
                aria-hidden="true"
              />{" "}
              Carta de convocação
            </button>
            <button
              type="button"
              className="btn secondary"
              id="convocacaoModelosBtn"
              onClick={estado.abrirModelosDaCarta}
            >
              <i className="fa-solid fa-file-pen" aria-hidden="true" /> Modelos
              da carta
            </button>
          </>
        ) : null}
        <button
          type="button"
          className="btn secondary"
          id="convocacaoCsvBtn"
          disabled={!carregado || !grupos.length}
          onClick={exportarCsv}
        >
          <i className="fa-solid fa-file-excel" aria-hidden="true" /> Exportar
          CSV
        </button>
      </div>

      <section
        className="ui-card ui-tabela approved-page-card"
        aria-label="Ordem de convocação"
      >
        <div className="ui-tabela-rolagem" ref={tabela}>
          <div id="convocacaoRows" className="convocacao-grupos">
            {carregando ? (
              <table
                className="approved-table convocacao-table"
                aria-busy="true"
              >
                <tbody>
                  <LinhasEsqueleto colunas={podeEmitir ? 9 : 8} />
                </tbody>
              </table>
            ) : erroAoCarregar ? (
              <p className="ui-vazio">Sem dados.</p>
            ) : paginaAtual.rows.length ? (
              emBlocos(paginaAtual.rows).map(({ grupo, linhas }, indice) => (
                <TabelaDoGrupo
                  key={`${grupo.chave}\u0000${indice}`}
                  grupo={grupo}
                  linhas={linhas}
                  perfil={perfil}
                  estado={estado}
                  convocacoes={convocacoes}
                  selecao={selecao}
                />
              ))
            ) : (
              <p className="ui-vazio">
                Nenhum candidato encontrado para os filtros selecionados.
              </p>
            )}
          </div>
        </div>
        <Paginacao
          prefixo="convocacao"
          pagina={paginaAtual}
          tamanho={tamanho}
          unidade="linhas"
          aoIrPara={irPara}
          aoMudarTamanho={(valor) => {
            setTamanho(valor);
            setPagina(1);
          }}
        />
      </section>
    </div>
  );
}
