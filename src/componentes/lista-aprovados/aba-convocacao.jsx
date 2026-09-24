import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  OPCOES_DO_FILTRO_DE_STATUS,
  SEM_STATUS,
  candidateCargosForEdital,
  formatarNota,
  manterSoAsOpcoes,
  opcoesDeEdital,
  paginateApprovedCandidates,
} from "../../lib/lista-aprovados-rules.js";
import {
  montarListaDeConvocacao,
  resumirConvocacao,
} from "../../lib/lista-convocacao-rules.js";
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
import { MultiSelectBusca } from "../multi-select-busca.jsx";
import {
  AcaoDeStatus,
  Kpi,
  NomeDoCandidato,
  Paginacao,
  SeloDeStatus,
  classes,
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

function TabelaDoGrupo({ grupo, linhas, perfil, aoAbrirStatus }) {
  return (
    <>
      <CabecalhoDoGrupo grupo={grupo} />
      <table className="approved-table convocacao-table">
        <thead>
          <tr>
            <th className="num">Ordem</th>
            <th className="num">Classificação geral</th>
            <th>Vaga da convocação</th>
            <th>Nome</th>
            <th className="num">Nota</th>
            <th>Modalidade declarada</th>
            <th>Status</th>
            <th style={{ textAlign: "center" }}>Ações</th>
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
              >
                <td className="num">{linha.posicao ?? "—"}</td>
                <td className="num">{candidato.classificacao ?? "—"}</td>
                <td>
                  <VagaDaConvocacao grupo={grupo} linha={linha} />
                </td>
                <td>
                  <NomeDoCandidato candidato={candidato} />
                </td>
                <td className="num">{formatarNota(candidato.nota)}</td>
                <td>
                  <ModalidadeDeclarada
                    candidato={candidato}
                    linha={linha}
                    modelo={grupo.modelo}
                  />
                </td>
                <td>
                  <SeloDeStatus status={text(candidato.status)} />
                </td>
                <td className="approved-actions">
                  <AcaoDeStatus
                    perfil={perfil}
                    candidato={candidato}
                    atributos={{ "data-convocacao-action": "status" }}
                    aoAbrir={aoAbrirStatus}
                  />
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
  carregado,
}) {
  const [filtros, setFiltros] = useState(FILTROS_INICIAIS);
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

  function irPara(destino) {
    const alvo = paginateApprovedCandidates(todas, destino, tamanho).page;
    if (alvo === paginaAtual.page) return;
    setPagina(alvo);
    tabela.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }

  return (
    <div
      id="approvedPanelConvocacao"
      className={classes("approved-tabpanel", !ativa && "hidden")}
      role="tabpanel"
      aria-labelledby="approvedTabConvocacao"
    >
      <div className="approved-kpis" aria-label="Resumo da lista de convocação">
        <Kpi
          id="convocacaoKpiVagas"
          tom="total"
          icone="fa-list-ol"
          rotulo="Vagas na lista"
          valor={resumo.vagas}
          carregado={carregado}
        />
        <Kpi
          id="convocacaoKpiImediatas"
          tom="info"
          icone="fa-bullseye"
          rotulo="Vagas imediatas"
          valor={resumo.imediatas}
          carregado={carregado}
        />
        <Kpi
          id="convocacaoKpiConvocaveis"
          tom="success"
          icone="fa-bell"
          rotulo="Convocáveis agora"
          valor={resumo.convocaveis}
          carregado={carregado}
        />
        <Kpi
          id="convocacaoKpiReserva"
          tom="warning"
          icone="fa-user-clock"
          rotulo="Cadastro de reserva"
          valor={resumo.reserva}
          carregado={carregado}
        />
        <Kpi
          id="convocacaoKpiForaDaFila"
          tom="danger"
          icone="fa-user-xmark"
          rotulo="Fora da fila"
          valor={resumo.foraDaFila}
          carregado={carregado}
        />
      </div>
      <div className="approved-filters convocacao-filters">
        <div className="form-row">
          <label htmlFor="convocacaoFilterEdital">Edital</label>
          <MultiSelectBusca
            id="convocacaoFilterEdital"
            placeholder="Todos os editais"
            opcoes={opcoesEditais}
            selecionados={editais}
            aoMudar={(valores) => mudarFiltro("editalId", valores)}
          />
        </div>
        <div className="form-row">
          <label htmlFor="convocacaoFilterCargo">Cargo</label>
          <MultiSelectBusca
            id="convocacaoFilterCargo"
            placeholder="Todos os cargos"
            opcoes={opcoesCargos}
            selecionados={cargos}
            aoMudar={(valores) => mudarFiltro("cargo", valores)}
          />
        </div>
        <div className="form-row">
          <label htmlFor="convocacaoFilterStatus">Status</label>
          <MultiSelectBusca
            id="convocacaoFilterStatus"
            placeholder="Todos os status"
            opcoes={OPCOES_DO_FILTRO_DE_STATUS}
            selecionados={filtros.status}
            aoMudar={(valores) => mudarFiltro("status", valores)}
          />
        </div>
      </div>
      <div className="table-meta" id="convocacaoAviso">
        A ordem vem do quadro de vagas de cada edital, configurado no formulário
        da lista de aprovados.
      </div>
      <div className="table-wrap" ref={tabela}>
        <div id="convocacaoRows" className="convocacao-grupos">
          {!carregado ? (
            <p className="approved-empty">Carregando lista de convocação...</p>
          ) : paginaAtual.rows.length ? (
            emBlocos(paginaAtual.rows).map(({ grupo, linhas }, indice) => (
              <TabelaDoGrupo
                key={`${grupo.chave}\u0000${indice}`}
                grupo={grupo}
                linhas={linhas}
                perfil={perfil}
                aoAbrirStatus={estado.abrirStatus}
              />
            ))
          ) : (
            <p className="approved-empty">
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
    </div>
  );
}
