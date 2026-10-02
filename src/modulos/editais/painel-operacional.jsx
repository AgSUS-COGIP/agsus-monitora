import { indicadoresDoResumo } from "../../lib/editais-do-nucleo.js";
import {
  ChipDeFiltro,
  ChipsDeFiltro,
  EstadoVazio,
  ErroAoCarregar,
  GradeDeKpis,
  Kpi,
} from "../../ui/index.js";

/*
  "Cronogramas e alertas": os indicadores do resumo (`Kpi` de src/ui/, card
  compacto de altura igual), que também filtram a tabela. Antes do primeiro
  pedido e enquanto ele corre, os cards são skeleton (carregando não é zero);
  sem edital ativo, um estado vazio curto; erro, o aviso com "Tentar
  novamente" — o detalhe técnico fica no console.

  O filtro ativo aparece como chip, com o "x" que o tira.
*/

/* A cor de cada indicador (`tone` de editais-do-nucleo.js) no tom do Kpi. */
const TOM = {
  blue: "info",
  cyan: "info",
  green: "sucesso",
  red: "perigo",
  amber: "alerta",
  purple: "neutro",
};

/* Os indicadores de sempre, sem número: o formato do skeleton. */
const ESQUELETO = indicadoresDoResumo([]);

export function PainelOperacional({ estado, nucleo }) {
  const { resumo, statusDoResumo, filtro } = nucleo;
  const tentarDeNovo = () =>
    void estado.carregarResumo({ force: true }).catch(() => {});

  if (statusDoResumo === "error")
    return (
      <section id="nucleoOperationalKpis" aria-label="Cronogramas e alertas">
        <ErroAoCarregar
          idDoBotao="nucleoSummaryRetry"
          oQue="os alertas dos editais"
          aoTentar={tentarDeNovo}
        />
      </section>
    );

  const carregando = !resumo.length && statusDoResumo !== "ready";
  if (!resumo.length && !carregando)
    return (
      <section id="nucleoOperationalKpis" aria-label="Cronogramas e alertas">
        <EstadoVazio className="ui-card ui-vazio">
          Nenhum edital ativo nesta área.
        </EstadoVazio>
      </section>
    );

  const indicadores = carregando ? ESQUELETO : indicadoresDoResumo(resumo);
  const filtroAtivo =
    !carregando && filtro !== "todos"
      ? indicadores.find((cartao) => cartao.key === filtro)?.label || filtro
      : "";

  return (
    <>
      <GradeDeKpis
        id="nucleoOperationalKpis"
        className="editais-kpis"
        rotulo="Cronogramas e alertas"
      >
        {indicadores.map((cartao) => (
          <Kpi
            key={cartao.key}
            chave={cartao.key}
            tom={TOM[cartao.tone] || "neutro"}
            icone={cartao.icon}
            rotulo={cartao.label}
            valor={cartao.value.toLocaleString("pt-BR")}
            carregando={carregando}
            ativo={carregando ? undefined : filtro === cartao.key}
            titulo={`Filtrar: ${cartao.label}`}
            aoClicar={
              carregando ? undefined : () => estado.filtrarPor(cartao.key)
            }
          />
        ))}
      </GradeDeKpis>
      {filtroAtivo ? (
        <div id="nucleoActiveAlertFilter" role="status">
          <ChipsDeFiltro>
            <ChipDeFiltro
              rotulo="Alerta"
              aoTirar={() => estado.filtrarPor("todos")}
            >
              {filtroAtivo}
            </ChipDeFiltro>
          </ChipsDeFiltro>
        </div>
      ) : null}
    </>
  );
}
