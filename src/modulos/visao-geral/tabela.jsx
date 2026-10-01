import { useEffect, useRef, useState } from "react";
import { formatNumberBR } from "../../lib/formatters.js";
import {
  COLUNAS_DA_TABELA,
  dataCurta,
  linkSeguro,
  observacaoLonga,
  prazoDoEdital,
  seloDoCronograma,
  seloDoRisco,
  seloDoStatus,
  taxaDeOciosidade,
  urgenciaDoCronograma,
} from "../../lib/visao-geral.js";
import { classes, Selo, TabelaInfinita } from "../../ui/index.js";

/*
  A tabela de processos seletivos da Visão geral (TabelaInfinita, src/ui/):
  colunas que ordenam (crescente, decrescente, sem ordem), "Colunas" para
  escolher as visíveis (guardadas no navegador), o prazo do edital e o
  cronograma na célula do edital, a taxa de ociosas e a observação longa com
  "Ver mais". A linha abre os detalhes do processo (clique, Enter ou espaço).

  A busca do cabeçalho vale para a página toda (KPIs, mapa, blocos): ela vai
  para o estado com uma pausa de 300 ms, e a tabela já recebe as linhas
  recortadas.
*/

const fmt = (valor) => formatNumberBR(valor);
const ESPERA_DA_BUSCA_MS = 300;
const DESTAQUE_MS = 2500;
const jaRecortadas = (itens) => itens;

function MenuDeColunas({ colunas, aoAlternar, textos }) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef(null);

  useEffect(() => {
    if (!aberto) return undefined;
    const aoClicar = (evento) => {
      if (!raiz.current?.contains(evento.target)) setAberto(false);
    };
    const aoTeclar = (evento) => {
      if (evento.key === "Escape") setAberto(false);
    };
    document.addEventListener("click", aoClicar);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("click", aoClicar);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto]);

  return (
    <div className="visao-geral-colunas" ref={raiz}>
      <button
        type="button"
        className="btn secondary small"
        aria-expanded={aberto}
        aria-controls="visaoGeralColunasMenu"
        onClick={() => setAberto((atual) => !atual)}
      >
        <i className="fa-solid fa-table-columns" aria-hidden="true" />{" "}
        {textos.colunas}
      </button>
      <div
        id="visaoGeralColunasMenu"
        className="visao-geral-colunas-menu"
        role="group"
        aria-label={textos.colunasTitulo}
        hidden={!aberto}
      >
        <strong>{textos.colunasTitulo}</strong>
        {COLUNAS_DA_TABELA.map(({ campo, rotulo }) => (
          <label key={campo}>
            <input
              type="checkbox"
              checked={colunas.includes(campo)}
              disabled={colunas.length === 1 && colunas.includes(campo)}
              onChange={(evento) => aoAlternar(campo, evento.target.checked)}
            />
            {rotulo}
          </label>
        ))}
      </div>
    </div>
  );
}

function CelulaDoEdital({ linha, hoje }) {
  const link = linkSeguro(linha.link_edital);
  const prazo = prazoDoEdital(linha, hoje);
  const cronograma = seloDoCronograma(linha);
  return (
    <td className="visao-geral-edital">
      {link ? (
        <a className="link" href={link} target="_blank" rel="noopener">
          {linha.edital || "-"} <span aria-hidden="true">↗</span>
        </a>
      ) : (
        <span className="ui-texto-principal">{linha.edital || "-"}</span>
      )}
      {prazo ? (
        <span
          className="visao-geral-prazo"
          data-tom={prazo.tom}
          title={prazo.rotulo}
        >
          <i className={`fa-solid ${prazo.icone}`} aria-hidden="true" />{" "}
          {prazo.rotulo}
        </span>
      ) : null}
      {cronograma ? (
        <span
          className="visao-geral-cronograma"
          data-urgencia={cronograma.tom}
          title={cronograma.titulo}
        >
          <i className="fa-solid fa-route" aria-hidden="true" />{" "}
          {cronograma.rotulo}
        </span>
      ) : null}
    </td>
  );
}

function CelulaDaObservacao({ texto }) {
  const [aberta, setAberta] = useState(false);
  const longa = observacaoLonga(texto);
  return (
    <td className="visao-geral-obs">
      <span className={classes("visao-geral-obs-texto", aberta && "is-aberta")}>
        {texto || "-"}
      </span>
      {longa ? (
        <button
          type="button"
          className="visao-geral-ver-mais"
          aria-expanded={aberta}
          onClick={() => setAberta((atual) => !atual)}
        >
          {aberta ? "Ver menos" : "Ver mais"}
        </button>
      ) : null}
    </td>
  );
}

function celula(campo, linha, hoje) {
  switch (campo) {
    case "unidade":
      return <td key={campo}>{linha.unidade}</td>;
    case "edital":
      return <CelulaDoEdital key={campo} linha={linha} hoje={hoje} />;
    case "data_inicio":
    case "data_fim":
      return <td key={campo}>{dataCurta(linha[campo])}</td>;
    case "vagas_total":
      return (
        <td key={campo} className="num">
          {fmt(linha.vagas_total)}
        </td>
      );
    case "contratados":
      return (
        <td key={campo} className="num visao-geral-contratados">
          {fmt(linha.contratados)}
        </td>
      );
    case "vagas_ociosas": {
      const taxa = taxaDeOciosidade(linha);
      return (
        <td key={campo} className="num visao-geral-ociosas">
          {fmt(linha.vagas_ociosas)}
          <span
            className="visao-geral-taxa"
            data-nivel={taxa.nivel}
            title={`${taxa.pct}% das vagas estão ociosas`}
          >
            {taxa.pct}%
          </span>
        </td>
      );
    }
    case "status":
      return (
        <td key={campo}>
          <Selo tom={seloDoStatus(linha.status)}>{linha.status || "-"}</Selo>
        </td>
      );
    case "etapa":
      return <td key={campo}>{linha.etapa}</td>;
    case "risco":
      return (
        <td key={campo}>
          <Selo tom={seloDoRisco(linha.risco)}>{linha.risco || "-"}</Selo>
        </td>
      );
    case "observacoes":
      return (
        <CelulaDaObservacao
          key={campo}
          texto={String(linha.observacoes ?? "").trim()}
        />
      );
    default:
      return null;
  }
}

/* Clique na linha abre os detalhes; link e botão dentro dela não. */
const cliqueEmControle = (evento) =>
  Boolean(evento.target.closest?.("a, button, input, label"));

export function TabelaDeProcessos({ e, estado, textos, aoAbrir, agora }) {
  const [rascunho, setRascunho] = useState(null);
  const [destacada, setDestacada] = useState("");
  const caixa = useRef(null);
  const hoje = new Date(agora());

  // A busca digitada vai ao estado depois de uma pausa (o mapa redesenha).
  useEffect(() => {
    if (rascunho === null) return undefined;
    const espera = setTimeout(() => {
      estado.definirBusca(rascunho);
      setRascunho(null);
    }, ESPERA_DA_BUSCA_MS);
    return () => clearTimeout(espera);
  }, [rascunho, estado]);

  // A busca global escolheu esta linha: rola até ela e destaca por um instante.
  const destaque = e.destaque;
  useEffect(() => {
    if (!destaque) return undefined;
    setDestacada(destaque.id);
    const alvo = [
      ...(caixa.current?.querySelectorAll("tr[data-linha]") || []),
    ].find((tr) => tr.dataset.linha === destaque.id);
    alvo?.scrollIntoView?.({ behavior: "smooth", block: "center" });
    const apagar = setTimeout(() => setDestacada(""), DESTAQUE_MS);
    return () => clearTimeout(apagar);
  }, [destaque]);

  const colunas = COLUNAS_DA_TABELA.filter((c) =>
    e.colunas.includes(c.campo),
  ).map(({ campo, rotulo, numero }) => ({
    rotulo,
    numero,
    ordem: e.ordenacao.campo === campo ? e.ordenacao.direcao : "",
    aoOrdenar: () => estado.ordenarPor(campo),
  }));
  const total = e.linhasDaArea.length;

  return (
    <div className="visao-geral-tabela-caixa" ref={caixa}>
      <TabelaInfinita
        idDoTitulo="visaoGeralTabelaTitulo"
        titulo={textos.tabela}
        busca={{
          placeholder: textos.busca,
          rotulo: textos.busca,
          valor: rascunho ?? e.busca,
          aoMudar: setRascunho,
        }}
        ferramentas={
          <MenuDeColunas
            colunas={e.colunas}
            aoAlternar={estado.alternarColuna}
            textos={textos}
          />
        }
        carregado={e.carregado}
        itens={e.filtradas}
        filtrarPelaBusca={jaRecortadas}
        colunas={colunas}
        classeDaTabela="visao-geral-tabela"
        total={total}
        vazio="Nenhum processo seletivo nesta área."
        informacao={(quantos) =>
          quantos === null
            ? "Carregando…"
            : `${fmt(quantos)} de ${fmt(total)} ${total === 1 ? "processo" : "processos"}`
        }
        linha={(linha) => {
          const id = String(linha.id);
          return (
            <tr
              key={id}
              data-linha={id}
              data-urgencia={urgenciaDoCronograma(linha).tom}
              className={classes(
                "visao-geral-linha",
                destacada === id && "is-destacada",
              )}
              tabIndex={0}
              title="Ver cronograma e detalhes do edital"
              onClick={(evento) => {
                if (!cliqueEmControle(evento)) aoAbrir(linha);
              }}
              onKeyDown={(evento) => {
                if (evento.target !== evento.currentTarget) return;
                if (evento.key !== "Enter" && evento.key !== " ") return;
                evento.preventDefault();
                aoAbrir(linha);
              }}
            >
              {e.colunas.map((campo) => celula(campo, linha, hoje))}
            </tr>
          );
        }}
      />
    </div>
  );
}
