import { Fragment, useMemo } from "react";
import type { ReactNode } from "react";
import { nomeDoCargo } from "../../lib/conducao-de-entrevista.ts";
import {
  RECORTES,
  rotuloDoDia,
  SITUACOES_NA_TELA,
  situacaoNaTela,
  type ItemDaFila,
  type Recorte,
  type SituacaoNaTela,
} from "../../lib/fila-de-conducao.ts";
import { formatNumberBR } from "../../lib/formatters";
import {
  AcoesDaLinha,
  BarraDaLista,
  CardDaLista,
  CelulaDaPessoa,
  FaixaDeSituacao,
  MenuDeAcoes,
  Segmentado,
  Selo,
  TabelaDaLista,
} from "../../ui/index.ts";
import type {
  AcaoDoMenu,
  AcaoPrincipalDaLinha,
  ColunaDaTabela,
  ItemDaFaixa,
} from "../../ui/index.ts";
import { numeroBR } from "./resultado-da-ficha.tsx";

/*
  A Fila de "Conduzir entrevistas" no layout das telas da seleção:

  - a faixa de situação: o período (Hoje, Próximos ou Todos), Aguardando,
    Em andamento, Concluídas, Faltaram e, quando há, Sem nota (quem não foi
    concluído depois do dia marcado, de qualquer dia); cada número é o total
    da lista que ele abre e clicar filtra (de novo, tira). Embaixo, a barra
    da distribuição, o contador "X de Y hoje" e a próxima entrevista do dia
    com "Iniciar";
  - num card só, a barra da lista (Hoje · Próximos · Todos, a busca por nome
    ou código com "/", Vaga, Banca — com "Minha banca" para o avaliador — e
    o "⋯" da tela) e a tabela em ordem de horário (50 e mais 50 ao rolar):
    o horário em destaque (os encerrados acinzentados; fora de hoje, o dia),
    a linha "Agora · HH:MM" entre o que passou e o que vem, em Hoje, a
    pessoa (nome e "código · modalidade"), a vaga, a banca, a situação com
    bolinha e a ação: azul só quando há o que fazer (Continuar, Lançar
    nota), neutra nas outras (Iniciar, Ver, Remarcar), com o "⋯".

  A ficha abre em tela cheia (ficha.tsx), com "Salvar e abrir o próximo" na
  ordem desta lista.
*/

export type FiltrosDaFila = {
  busca: string;
  vaga: string;
  banca: string;
  situacao: SituacaoNaTela | "";
};

export type PropriedadesDaFila = {
  /** A fila do edital com a busca, a vaga e a banca (sem período nem situação). */
  base: ItemDaFila[];
  /** No período escolhido. */
  doRecorte: ItemDaFila[];
  /** A lista na tela (período e situação): a ordem do "próximo". */
  naTela: ItemDaFila[];
  hoje: string;
  agora: string;
  recorte: Recorte;
  contagem: Record<Recorte, number>;
  aoMudarRecorte: (recorte: Recorte) => void;
  filtros: FiltrosDaFila;
  aoMudarFiltros: (parte: Partial<FiltrosDaFila>) => void;
  vagas: { codigo: string; cargo: string }[];
  bancas: number[];
  /** As bancas de quem está na tela (o perfil entre os avaliadores). */
  minhasBancas: number[];
  contador: { feitas: number; total: number; completo: boolean };
  proxima: ItemDaFila | null;
  aoAbrir: (id: string) => void;
  aoRemarcar: () => void;
  aoCopiar: (codigo: string) => void;
  /** As ações da tela no "⋯" da barra. */
  acoesDaTela: AcaoDoMenu[];
};

const ORDEM_DAS_SITUACOES: SituacaoNaTela[] = [
  "aguardando",
  "em_andamento",
  "concluida",
  "faltou",
  "sem_nota",
];
const TOM_DA_FAIXA: Record<SituacaoNaTela, string> = {
  aguardando: "neutro",
  em_andamento: "info",
  concluida: "sucesso",
  faltou: "perigo",
  sem_nota: "alerta",
};
const ROTULO_DA_FAIXA: Record<SituacaoNaTela, string> = {
  aguardando: "Aguardando",
  em_andamento: "Em andamento",
  concluida: "Concluídas",
  faltou: "Faltaram",
  sem_nota: "Sem nota",
};
/* "Minha banca" no filtro Banca: as bancas do avaliador que está na tela. */
export const MINHA_BANCA = "minha";

function NotasDaLinha({ item }: { item: ItemDaFila }) {
  const nota = item.convocado.nota;
  if (item.situacao === "concluida" && nota !== null && nota !== undefined)
    return (
      <span className="entrevistas-fila-nota" title="Nota da entrevista">
        {numeroBR(nota)} pts
      </span>
    );
  if (item.situacao !== "em_andamento" || !item.esperadas || !item.lancadas)
    return null;
  return (
    <span
      className="entrevistas-fila-notas"
      title={`${item.lancadas} de ${item.esperadas} notas lançadas`}
    >
      {item.lancadas} de {item.esperadas}
    </span>
  );
}

/* O botão da linha: azul só quando há o que fazer. */
function principalDaLinha(
  situacao: SituacaoNaTela,
  abrir: () => void,
  remarcar: () => void,
): AcaoPrincipalDaLinha {
  if (situacao === "em_andamento")
    return {
      rotulo: "Continuar",
      destaque: true,
      acao: "abrir-ficha",
      aoClicar: abrir,
    };
  if (situacao === "sem_nota")
    return {
      rotulo: "Lançar nota",
      destaque: true,
      acao: "abrir-ficha",
      aoClicar: abrir,
    };
  if (situacao === "aguardando")
    return { rotulo: "Iniciar", acao: "abrir-ficha", aoClicar: abrir };
  if (situacao === "faltou")
    return { rotulo: "Remarcar", acao: "remarcar", aoClicar: remarcar };
  return { rotulo: "Ver", acao: "abrir-ficha", aoClicar: abrir };
}

const COLUNAS: ColunaDaTabela[] = [
  { rotulo: "Horário", largura: "6.5rem" },
  { rotulo: "Pessoa" },
  { rotulo: "Vaga" },
  { rotulo: "Banca" },
  { rotulo: "Situação" },
  {
    rotulo: "Ações",
    chave: "acoes",
    numero: true,
    cabecalho: <span className="sr-only">Ações</span>,
  },
];

export function FilaDoDia({
  base,
  doRecorte,
  naTela,
  hoje,
  agora,
  recorte,
  contagem,
  aoMudarRecorte,
  filtros,
  aoMudarFiltros,
  vagas,
  bancas,
  minhasBancas,
  contador,
  proxima,
  aoAbrir,
  aoRemarcar,
  aoCopiar,
  acoesDaTela,
}: PropriedadesDaFila) {
  const situacao = filtros.situacao;
  // Os números da faixa: do período; "Sem nota", de qualquer dia (a lista dele também).
  const resumo = useMemo(() => {
    const r: Record<SituacaoNaTela, number> = {
      aguardando: 0,
      em_andamento: 0,
      concluida: 0,
      faltou: 0,
      sem_nota: 0,
    };
    for (const i of doRecorte) {
      const s = situacaoNaTela(i, hoje);
      if (s !== "sem_nota") r[s] += 1;
    }
    for (const i of base)
      if (situacaoNaTela(i, hoje) === "sem_nota") r.sem_nota += 1;
    return r;
  }, [base, doRecorte, hoje]);
  const rotuloDoRecorte =
    RECORTES.find((r) => r.valor === recorte)?.rotulo ?? "Todos";
  const itens: ItemDaFaixa[] = [
    {
      chave: "todas",
      rotulo: rotuloDoRecorte,
      valor: doRecorte.length,
      tom: "neutro",
      ativo: !situacao,
      titulo: "Mostrar todas do período",
      aoClicar: () => aoMudarFiltros({ situacao: "" }),
    },
    ...ORDEM_DAS_SITUACOES.filter(
      (s) => s !== "sem_nota" || resumo.sem_nota > 0 || situacao === s,
    ).map((s): ItemDaFaixa => ({
      chave: s,
      rotulo: ROTULO_DA_FAIXA[s],
      valor: resumo[s],
      tom: TOM_DA_FAIXA[s],
      contexto:
        s === "sem_nota"
          ? "depois do dia marcado"
          : s === "aguardando" && proxima && recorte === "hoje"
            ? `próxima às ${proxima.inicio}`
            : undefined,
      ativo: situacao === s,
      titulo: `Mostrar ${ROTULO_DA_FAIXA[s].toLowerCase()}`,
      aoClicar: () => aoMudarFiltros({ situacao: situacao === s ? "" : s }),
    })),
  ];
  const cargoDaVaga = useMemo(
    () => new Map(vagas.map((v) => [v.codigo, v.cargo])),
    [vagas],
  );
  // A linha "Agora": antes da primeira de hoje que começa a partir de agora.
  const primeiraDepoisDeAgora =
    recorte === "hoje" && !situacao
      ? naTela.find((i) => i.data === hoje && (i.inicio ?? "") >= agora)
      : undefined;
  const mostrarAgora =
    primeiraDepoisDeAgora !== undefined && naTela[0] !== primeiraDepoisDeAgora;

  const linha = (item: ItemDaFila) => {
    const s = situacaoNaTela(item, hoje);
    const abrir = () => aoAbrir(item.id);
    const principal = principalDaLinha(s, abrir, aoRemarcar);
    const outras: AcaoDoMenu[] = [
      ...(principal.acao === "abrir-ficha"
        ? []
        : [
            {
              id: "ficha",
              rotulo: "Ver ficha",
              icone: "fa-folder-open",
              dados: { "data-acao": "linha-ver-ficha" },
              aoEscolher: abrir,
            },
          ]),
      ...(principal.acao === "remarcar"
        ? []
        : [
            {
              id: "remarcar",
              rotulo: "Remarcar na agenda",
              icone: "fa-calendar-days",
              dados: { "data-acao": "linha-remarcar" },
              aoEscolher: aoRemarcar,
            },
          ]),
      ...(item.convocado.codigo
        ? [
            {
              id: "copiar",
              rotulo: "Copiar código",
              icone: "fa-copy",
              dados: { "data-acao": "linha-copiar-codigo" },
              aoEscolher: () => aoCopiar(String(item.convocado.codigo)),
            },
          ]
        : []),
    ];
    const encerrada = s === "concluida" || s === "faltou";
    const cargo = nomeDoCargo(
      cargoDaVaga.get(item.vaga) || item.convocado.cargo || "",
    );
    const dia =
      item.data && item.data !== hoje ? rotuloDoDia(item.data, hoje) : "";
    const tr: ReactNode = (
      <tr
        key={item.id}
        className="entrevistas-fila-linha"
        data-convocado={item.id}
        data-situacao={s}
        data-encerrada={encerrada ? "" : undefined}
      >
        <td>
          {item.inicio ? (
            <span className="entrevistas-fila-hora">
              <time
                dateTime={item.data ? `${item.data}T${item.inicio}` : undefined}
              >
                {item.inicio}
              </time>
              {dia ? <small>{dia}</small> : null}
            </span>
          ) : (
            <span className="ui-texto-secundario">Sem horário</span>
          )}
        </td>
        <td>
          <CelulaDaPessoa
            nome={item.nome}
            codigo={item.convocado.codigo}
            modalidade={item.convocado.modalidade}
          />
        </td>
        <td>
          <span className="ui-pessoa">
            <strong>{item.vaga || "—"}</strong>
            {cargo ? <span>{cargo}</span> : null}
          </span>
        </td>
        <td>{item.banca !== null ? `Banca ${item.banca}` : "—"}</td>
        <td>
          <Selo tom={SITUACOES_NA_TELA[s].tom} ponto>
            {SITUACOES_NA_TELA[s].rotulo}
          </Selo>{" "}
          <NotasDaLinha item={item} />
        </td>
        <td className="num">
          <AcoesDaLinha
            pessoa={item.convocado.codigo || item.nome}
            principal={principal}
            outras={outras}
          />
        </td>
      </tr>
    );
    if (!mostrarAgora || item !== primeiraDepoisDeAgora) return tr;
    return (
      <Fragment key={item.id}>
        <tr className="entrevistas-agora" data-agora="">
          <td colSpan={COLUNAS.length}>
            <span>Agora · {agora}</span>
          </td>
        </tr>
        {tr}
      </Fragment>
    );
  };

  const distribuicao = ORDEM_DAS_SITUACOES.filter((s) => s !== "sem_nota").map(
    (s) => ({
      chave: s,
      rotulo: ROTULO_DA_FAIXA[s],
      valor: resumo[s],
      tom: TOM_DA_FAIXA[s],
    }),
  );

  return (
    <div className="entrevistas-fila-tela" data-tour="conduzir-fila">
      <FaixaDeSituacao
        rotulo="Situação das entrevistas"
        tour="conduzir-situacoes"
        className="entrevistas-fila-faixa"
        itens={itens}
        rotuloDaDistribuicao={`Distribuição (${rotuloDoRecorte.toLowerCase()})`}
        totalDaDistribuicao={doRecorte.length}
        distribuicao={doRecorte.length ? distribuicao : null}
      >
        {contador.total ? (
          <span
            className="entrevistas-contador-do-dia"
            data-completo={contador.completo ? "sim" : undefined}
            data-tour="conduzir-contador"
            role="status"
          >
            <strong>
              {contador.feitas} de {contador.total}
            </strong>{" "}
            hoje
          </span>
        ) : null}
        {proxima ? (
          <span className="entrevistas-proxima" data-proxima={proxima.id}>
            <span className="entrevistas-proxima-rotulo">Próxima</span>
            <strong>
              {[proxima.inicio, proxima.nome].filter(Boolean).join(" · ")}
            </strong>
            <span className="ui-texto-secundario">
              {[
                nomeDoCargo(
                  cargoDaVaga.get(proxima.vaga) ||
                    proxima.convocado.cargo ||
                    "",
                ) || proxima.vaga,
                proxima.banca !== null ? `Banca ${proxima.banca}` : "",
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
            <button
              type="button"
              className="btn small"
              data-acao="iniciar-proxima"
              onClick={() => aoAbrir(proxima.id)}
            >
              Iniciar
            </button>
          </span>
        ) : null}
      </FaixaDeSituacao>

      <CardDaLista
        rotulo="Fila das entrevistas"
        tour="conduzir-lista"
        className="entrevistas-fila"
      >
        <BarraDaLista
          rotulo="Encontrar a pessoa"
          tour="conduzir-busca"
          className="entrevistas-fila-barra"
          busca={{
            valor: filtros.busca,
            aoMudar: (busca) => aoMudarFiltros({ busca }),
            placeholder: "Buscar por nome ou código",
            rotulo: "Buscar por nome ou código",
            acao: "fila-busca",
          }}
          quantos={
            [
              filtros.busca.trim(),
              filtros.vaga,
              filtros.banca,
              situacao,
            ].filter(Boolean).length
          }
          aoLimpar={() =>
            aoMudarFiltros({ busca: "", vaga: "", banca: "", situacao: "" })
          }
          acoes={
            acoesDaTela.length ? (
              <MenuDeAcoes
                compacto
                rotulo="Mais ações"
                tour="conduzir-acoes"
                acoes={acoesDaTela}
              />
            ) : null
          }
        >
          <Segmentado
            rotulo="Período"
            className="entrevistas-fila-recortes"
            tour="conduzir-recortes"
            opcoes={RECORTES.map((r) => ({
              valor: r.valor,
              rotulo: `${r.rotulo} (${formatNumberBR(contagem[r.valor])})`,
            }))}
            valor={recorte}
            aoMudar={(valor: string) => aoMudarRecorte(valor as Recorte)}
          />
          {vagas.length > 1 ? (
            <select
              aria-label="Vaga"
              data-campo="fila-vaga"
              value={filtros.vaga}
              onChange={(ev) => aoMudarFiltros({ vaga: ev.target.value })}
            >
              <option value="">Todas as vagas</option>
              {vagas.map((v) => (
                <option key={v.codigo} value={v.codigo}>
                  {[v.codigo, nomeDoCargo(v.cargo)].filter(Boolean).join(" · ")}
                </option>
              ))}
            </select>
          ) : null}
          {bancas.length > 1 || minhasBancas.length ? (
            <select
              aria-label="Banca"
              data-campo="fila-banca"
              value={filtros.banca}
              onChange={(ev) => aoMudarFiltros({ banca: ev.target.value })}
            >
              <option value="">Todas as bancas</option>
              {minhasBancas.length ? (
                <option value={MINHA_BANCA}>Minha banca</option>
              ) : null}
              {bancas.map((b) => (
                <option key={b} value={String(b)}>
                  Banca {b}
                </option>
              ))}
            </select>
          ) : null}
        </BarraDaLista>
        <TabelaDaLista
          rotulo="Entrevistas"
          classeDaTabela="entrevistas-fila-tabela"
          colunas={COLUNAS}
          carregado
          itens={naTela}
          chaveDoRecorte={JSON.stringify([recorte, filtros])}
          vazio={
            situacao || filtros.busca.trim() || filtros.vaga || filtros.banca
              ? "Nenhuma entrevista nesta situação com esses filtros."
              : recorte === "hoje"
                ? "Nenhuma entrevista hoje."
                : recorte === "proximos"
                  ? "Nenhuma entrevista agendada nos próximos dias."
                  : "Nenhum candidato convocado ainda."
          }
          linha={linha}
        />
      </CardDaLista>
    </div>
  );
}
