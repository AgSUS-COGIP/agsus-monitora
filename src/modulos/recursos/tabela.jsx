import { formatNumberBR } from "../../lib/formatters.js";
import {
  ETAPAS,
  FILTROS_VAZIOS,
  filtrarRecursos,
  rotuloDaOrigem,
  rotuloDaSituacao,
  tomDaSituacao,
} from "../../lib/recursos-dos-candidatos.js";
import { rotuloDoEstado, tomDoEstado } from "../../lib/resposta-do-recurso.js";
import { classes, Selo, TabelaInfinita } from "../../ui/index.js";

/*
  "Fila de recursos": a tabela do painel, na tabela de carregamento contínuo
  dos painéis (TabelaInfinita, src/ui/). A busca do cabeçalho vale só para a
  fila. Clique na linha (ou Enter) ou em "Detalhes" abre a gaveta.
*/

const COLUNAS = [
  { rotulo: "Nº", largura: "6%" },
  { rotulo: "Candidato", largura: "19%" },
  { rotulo: "Edital", largura: "13%" },
  { rotulo: "Origem", largura: "10%" },
  { rotulo: "Analista", largura: "11%" },
  { rotulo: "Situação", largura: "10%" },
  { rotulo: "Etapas", largura: "8%" },
  { rotulo: "Prazo", largura: "11%" },
  { rotulo: "Aberto há", largura: "6%" },
  { rotulo: "Ações", largura: "8%" },
];

export function dataBR(valor) {
  const texto = String(valor ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(texto)
    ? texto.split("-").reverse().join("/")
    : "";
}

/* O tom da situação no selo (Selo, src/ui/). */
const BADGE_DO_TOM = {
  warning: "pendente",
  success: "aprovado",
  danger: "reprovado",
  info: "revisar",
};

export function SeloDaSituacao({ situacao }) {
  return (
    <Selo tom={BADGE_DO_TOM[tomDaSituacao(situacao)]}>
      {rotuloDaSituacao(situacao)}
    </Selo>
  );
}

/* O estado da resposta escrita (resposta-do-recurso.js), no mesmo selo. */
export function SeloDaResposta({ estado }) {
  if (!estado) return null;
  return (
    <Selo
      tom={BADGE_DO_TOM[tomDoEstado(estado)]}
      titulo="Resposta ao candidato"
    >
      Resposta: {rotuloDoEstado(estado).toLowerCase()}
    </Selo>
  );
}

export function MarcaForaDasAnalises() {
  return <Selo>Fora das análises</Selo>;
}

/* Prazo com o destaque de atraso: vencido (vermelho), vence em até 2 dias (âmbar). */
export function detalheDoPrazo(recurso) {
  const { prazo, diasParaPrazo, atrasado, etapas } = recurso;
  if (!prazo.data) return { data: "", texto: "Não encontrado", tom: "neutral" };
  const respondido = etapas.resposta_candidato;
  const tom = atrasado
    ? "danger"
    : !respondido && diasParaPrazo <= 2
      ? "warning"
      : "neutral";
  const texto = respondido
    ? "respondido"
    : atrasado
      ? `vencido há ${formatNumberBR(-diasParaPrazo)} ${diasParaPrazo === -1 ? "dia" : "dias"}`
      : diasParaPrazo === 0
        ? "vence hoje"
        : `em ${formatNumberBR(diasParaPrazo)} ${diasParaPrazo === 1 ? "dia" : "dias"}`;
  return {
    data: `${dataBR(prazo.data)}${prazo.fonte === "abertura" ? "*" : ""}`,
    texto,
    tom,
  };
}

/*
  Recurso decidido: selo estático "No prazo" (verde) ou "Fora do prazo"
  (neutro), pela data da decisão contra o prazo do cronograma. Faz parte das
  comemorações (marcos do processo): some com elas desligadas. Sem confete.
*/
export function SeloDoPrazoCumprido({ recurso, ligado = true }) {
  if (!ligado || typeof recurso?.noPrazo !== "boolean") return null;
  return recurso.noPrazo ? (
    <Selo
      tom="aprovado"
      className="recursos-no-prazo"
      titulo="Decidido dentro do prazo de resposta"
    >
      No prazo
    </Selo>
  ) : (
    <Selo
      className="recursos-no-prazo"
      titulo="Decidido depois do prazo de resposta"
    >
      Fora do prazo
    </Selo>
  );
}

function Prazo({ recurso, comemoracoes }) {
  const { data, texto, tom } = detalheDoPrazo(recurso);
  return (
    <div title={recurso.prazo.aviso || recurso.prazo.atividade || undefined}>
      <div className="ui-texto-principal">{data || "—"}</div>
      <span className="ui-texto-secundario recursos-prazo" data-tone={tom}>
        {texto}
      </span>
      <SeloDoPrazoCumprido recurso={recurso} ligado={comemoracoes} />
    </div>
  );
}

export function MarcasDasEtapas({ etapas }) {
  return (
    <span
      className="recursos-etapas"
      aria-label={`${ETAPAS.filter((e) => etapas[e.id]).length} de ${ETAPAS.length} etapas`}
    >
      {ETAPAS.map((etapa) => (
        <span
          key={etapa.id}
          className={classes(
            "recursos-etapa-marca",
            etapas[etapa.id] && "is-feita",
          )}
          title={`${etapa.rotulo}: ${etapas[etapa.id] ? "feito" : "pendente"}`}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

const pelaBusca = (recursos, busca) =>
  filtrarRecursos(recursos, { ...FILTROS_VAZIOS, busca });

function LinhaDoRecurso({ recurso: r, origens, comemoracoes, aoAbrir }) {
  return (
    <tr
      className="recursos-linha"
      tabIndex={0}
      onClick={() => aoAbrir(r.id)}
      onKeyDown={(evento) => {
        if (
          evento.target === evento.currentTarget &&
          (evento.key === "Enter" || evento.key === " ")
        ) {
          evento.preventDefault();
          aoAbrir(r.id);
        }
      }}
      aria-label={`Recurso nº ${r.nu} de ${r.candidato}`}
    >
      <td>
        <div className="ui-texto-principal">{r.nu}</div>
      </td>
      <td>
        <div className="ui-texto-principal">{r.candidato}</div>
        <span className="ui-texto-secundario">
          {[r.codigo && `Cód. ${r.codigo}`, r.vaga && `Vaga ${r.vaga}`]
            .filter(Boolean)
            .join(" · ") || r.cargo}
        </span>
        {r.fora_analise ? <MarcaForaDasAnalises /> : null}
      </td>
      <td>
        <div className="ui-texto-principal">{r.edital}</div>
        <span className="ui-texto-secundario">{r.unidade}</span>
      </td>
      <td>{rotuloDaOrigem(r.origem, origens)}</td>
      <td>{r.analista || "Sem analista"}</td>
      <td>
        <SeloDaSituacao situacao={r.situacao} />
        <SeloDaResposta estado={r.respostaEstado} />
      </td>
      <td>
        <MarcasDasEtapas etapas={r.etapas} />
      </td>
      <td>
        <Prazo recurso={r} comemoracoes={comemoracoes} />
      </td>
      <td>
        {r.diasEmAberto === null || r.diasEmAberto === undefined
          ? "—"
          : `${formatNumberBR(r.diasEmAberto)} d`}
      </td>
      <td>
        <button
          type="button"
          className="btn secondary small"
          onClick={(evento) => {
            evento.stopPropagation();
            aoAbrir(r.id);
          }}
        >
          <i className="fa-solid fa-chevron-down" aria-hidden="true" /> Detalhes
        </button>
      </td>
    </tr>
  );
}

export function TabelaDeRecursos({
  recursos,
  total,
  origens,
  carregado,
  podeEditar,
  aoAbrir,
  aoNovo,
  comemoracoes = false,
}) {
  return (
    <TabelaInfinita
      idDoTitulo="recursosFilaTitulo"
      titulo="Fila de recursos"
      busca={{
        placeholder: "Buscar somente na fila de recursos",
        rotulo: "Buscar somente na fila de recursos",
      }}
      carregado={carregado}
      itens={recursos}
      filtrarPelaBusca={pelaBusca}
      colunas={COLUNAS}
      linha={(r) => (
        <LinhaDoRecurso
          key={r.id}
          recurso={r}
          origens={origens}
          comemoracoes={comemoracoes}
          aoAbrir={aoAbrir}
        />
      )}
      total={total}
      vazio={
        <>
          Nenhum recurso cadastrado nesta área.{" "}
          {podeEditar ? (
            <button
              type="button"
              className="btn secondary small"
              onClick={aoNovo}
            >
              <i className="fa-solid fa-plus" aria-hidden="true" /> Cadastrar o
              primeiro
            </button>
          ) : null}
        </>
      }
      informacao={(quantos) => (
        <span className="recursos-contagem">
          {quantos === null
            ? "Carregando…"
            : quantos === total
              ? `${formatNumberBR(total)} ${total === 1 ? "recurso" : "recursos"}`
              : `${formatNumberBR(quantos)} de ${formatNumberBR(total)}`}
        </span>
      )}
    />
  );
}
