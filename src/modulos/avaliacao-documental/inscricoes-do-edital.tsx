import {
  acompanhamentoDasInscricoes,
  diaEMes,
  textoDoHoje,
  type DadosDoAcompanhamento,
  type PontoDaSerie,
} from "../../lib/avaliacao-documental/acompanhamento-das-inscricoes.ts";
import { Selo } from "../../ui/index.js";

/*
  Cartão "Inscrições" no topo da aba Pré-classificação, só durante as
  inscrições do cronograma (da véspera do início a 3 dias depois do fim):
  os totais do último retrato (inscritos, finalizaram o questionário, aptos
  para análise pela regra, eliminados), o mini-gráfico diário até o fim das
  inscrições e, por vaga, inscritos · aptos · hoje +N. A conta é de
  src/lib/avaliacao-documental/acompanhamento-das-inscricoes.ts; os retratos
  vêm de obter_acompanhamento_inscricoes (20261009140000), gravados pelo job
  da pré-classificação a cada execução. Explicação: Aya, "Acompanhar
  inscrições" (docs/aya/regras-da-avaliacao-documental.md).
*/

const L = 280;
const A = 64;
const MARGEM = 4;
const VAGAS_ABERTAS = 8;

const numero = (n: number | null | undefined): string =>
  typeof n === "number" ? n.toLocaleString("pt-BR") : "—";

function pontos(
  serie: PontoDaSerie[],
  chave: "inscritos" | "aptos",
  maximo: number,
) {
  const passo = serie.length > 1 ? (L - 2 * MARGEM) / (serie.length - 1) : 0;
  return serie
    .map((p, i) => ({
      x: MARGEM + i * passo,
      valor: p[chave],
      data: p.data,
    }))
    .filter(
      (p): p is { x: number; valor: number; data: string } =>
        typeof p.valor === "number",
    )
    .map((p) => ({
      ...p,
      y: A - MARGEM - (p.valor / maximo) * (A - 2 * MARGEM),
    }));
}

function MiniGrafico({
  serie,
  fim,
}: {
  serie: PontoDaSerie[];
  fim: string | null;
}) {
  const maximo = Math.max(1, ...serie.map((p) => p.inscritos ?? 0));
  const inscritos = pontos(serie, "inscritos", maximo);
  const aptos = pontos(serie, "aptos", maximo);
  const linha = (lista: { x: number; y: number }[]) =>
    lista.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const ultimo = inscritos[inscritos.length - 1];
  return (
    <figure className="avd-insc-grafico">
      <svg
        viewBox={`0 0 ${L} ${A}`}
        role="img"
        aria-label={`Inscritos por dia até ${diaEMes(fim)}: ${serie
          .filter((p) => p.inscritos !== null)
          .map((p) => `${diaEMes(p.data)} ${p.inscritos}`)
          .join(", ")}`}
        preserveAspectRatio="none"
      >
        <line
          className="avd-insc-base"
          x1={MARGEM}
          x2={L - MARGEM}
          y1={A - MARGEM}
          y2={A - MARGEM}
        />
        {inscritos.length > 1 ? (
          <polyline
            className="avd-insc-linha"
            data-serie="inscritos"
            points={linha(inscritos)}
          />
        ) : null}
        {aptos.length > 1 ? (
          <polyline
            className="avd-insc-linha"
            data-serie="aptos"
            points={linha(aptos)}
          />
        ) : null}
        {inscritos.map((p) => (
          <circle
            key={p.data}
            className="avd-insc-alvo"
            cx={p.x}
            cy={p.y}
            r={6}
          >
            <title>{`${diaEMes(p.data)}: ${p.valor} inscritos`}</title>
          </circle>
        ))}
        {ultimo ? (
          <circle
            className="avd-insc-ponto"
            data-serie="inscritos"
            cx={ultimo.x}
            cy={ultimo.y}
            r={3}
          />
        ) : null}
      </svg>
      <figcaption className="avd-insc-legenda">
        <span data-serie="inscritos">Inscritos</span>
        <span data-serie="aptos">Aptos</span>
        <span className="avd-insc-eixo">
          {diaEMes(serie[0]?.data ?? null)} – {diaEMes(fim)}
        </span>
      </figcaption>
    </figure>
  );
}

export function InscricoesDoEdital({
  dados,
}: {
  dados: DadosDoAcompanhamento | null | undefined;
}) {
  const a = acompanhamentoDasInscricoes(dados);
  if (!a.mostrar) return null;
  const t = a.totais;
  return (
    <section
      className="ui-card avd-inscricoes"
      aria-label="Inscrições"
      data-inscricoes
    >
      <header className="avd-insc-topo">
        <h3>Inscrições</h3>
        <span className="ui-texto-secundario">
          {a.encerradas
            ? `encerradas em ${diaEMes(a.fim)}`
            : `até ${diaEMes(a.fim)}`}
        </span>
        {t?.previa ? (
          <Selo
            tom="pendente"
            titulo="Aptos pela regra ainda não conferida (prévia)"
          >
            prévia
          </Selo>
        ) : null}
      </header>
      {!t ? (
        <p className="ui-texto-secundario" data-sem-retrato>
          Aguardando a primeira carga da Empregare.
        </p>
      ) : (
        <>
          <div className="avd-insc-corpo">
            <dl className="avd-insc-totais">
              <div data-total="inscritos">
                <dt>Inscritos</dt>
                <dd>
                  {numero(t.inscritos)}
                  {t.hoje ? <small> hoje {textoDoHoje(t.hoje)}</small> : null}
                </dd>
              </div>
              <div data-total="finalizados">
                <dt>Finalizaram o questionário</dt>
                <dd>{numero(t.finalizados)}</dd>
              </div>
              <div data-total="aptos">
                <dt>Aptos para análise</dt>
                <dd>{numero(t.aptos)}</dd>
              </div>
              <div data-total="eliminados">
                <dt>Eliminados</dt>
                <dd>{numero(t.eliminados)}</dd>
              </div>
            </dl>
            <MiniGrafico serie={a.serie} fim={a.fim} />
          </div>
          {a.vagas.length ? (
            <details
              className="avd-insc-vagas"
              open={a.vagas.length <= VAGAS_ABERTAS}
            >
              <summary>Por vaga ({a.vagas.length})</summary>
              <div className="ui-tabela-rolagem">
                <table className="avd-tabela" aria-label="Inscrições por vaga">
                  <thead>
                    <tr>
                      <th scope="col">Vaga</th>
                      <th scope="col">Inscritos</th>
                      <th scope="col">Aptos</th>
                      <th scope="col">Hoje</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.vagas.map((v) => (
                      <tr key={v.codigo} data-vaga={v.codigo}>
                        <td>
                          <span className="avd-insc-codigo">{v.codigo}</span>
                          {v.cargo ? (
                            <span className="avd-insc-cargo"> {v.cargo}</span>
                          ) : null}
                        </td>
                        <td>{numero(v.inscritos)}</td>
                        <td>{numero(v.aptos)}</td>
                        <td>{textoDoHoje(v.hoje)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          ) : null}
        </>
      )}
    </section>
  );
}
