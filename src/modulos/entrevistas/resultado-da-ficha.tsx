import { useEffect, useRef } from "react";
import { classes } from "../../ui/classes.js";
import { animar } from "./campo-de-nota.tsx";

/*
  A lateral viva da ficha de notas (ficha.tsx): a prévia do resultado com as
  regras do banco (`calcularEntrevista`), mudando enquanto a pessoa digita.

  - O total grande "/ 20" dentro de um anel de progresso, com a marca do
    mínimo total; o número dá um pulo curto quando muda.
  - As competências em barras horizontais (a nota da banca sobre o máximo),
    com a marca do mínimo de cada uma: vermelha abaixo, verde ok.
  - O parecer em destaque (Apto verde, Inapto vermelho, Sem parecer cinza),
    com a cor em transição, e os motivos em frases curtas.
  - "18 de 24 notas" com a barra do progresso.
  Depois de salvar vale o que o banco devolveu (o payload novo recalcula).
*/

export type CompetenciaDoResultado = {
  id: string;
  nome: string;
  nota: number | null;
  maximo: number;
  minimo: number | null;
  abaixoDoMinimo: boolean;
  eliminatoria: boolean;
};

export type PropriedadesDoResultado = {
  parecer: string;
  total: number | null;
  maxima: number;
  minimoTotal: number | null;
  abaixoDoMinimoTotal: boolean;
  competencias: CompetenciaDoResultado[];
  motivos: string[];
  lancadas: number;
  esperadas: number;
  faltou: boolean;
  /**
   * O que ainda falta para o parecer ser definitivo ("faltam 9 notas", "falta
   * o comparecimento"); vazio = tudo lançado. Com falta, o cartão fica neutro
   * e diz "Prévia" — o cálculo é o mesmo, só a apresentação muda.
   */
  pendencia: string;
};

const ROTULO = {
  APTO: "Apto",
  INAPTO: "Inapto",
  SEM_PARECER: "Sem parecer",
} as Record<string, string>;
const ICONE = {
  APTO: "fa-circle-check",
  INAPTO: "fa-circle-xmark",
  SEM_PARECER: "fa-circle",
} as Record<string, string>;

export const numeroBR = (valor: number | null | undefined) =>
  valor === null || valor === undefined
    ? "—"
    : Number(valor).toLocaleString("pt-BR", { maximumFractionDigits: 2 });

const proporcao = (valor: number | null, maximo: number) =>
  valor === null || !maximo ? 0 : Math.max(0, Math.min(1, valor / maximo));

/* O anel: 270° abertos para baixo, como um medidor. */
const RAIO = 52;
const ARCO = 0.75;
const CIRCUNFERENCIA = 2 * Math.PI * RAIO;

function Anel({
  total,
  maxima,
  minimo,
  tom,
}: {
  total: number | null;
  maxima: number;
  minimo: number | null;
  tom: string;
}) {
  const cheio = CIRCUNFERENCIA * ARCO;
  const parte = cheio * proporcao(total, maxima);
  // Marca do mínimo: o ângulo a partir do início do arco (135°, sentido horário).
  const angulo = 135 + 270 * proporcao(minimo, maxima);
  const rad = (angulo * Math.PI) / 180;
  const ponto = (r: number) => [60 + r * Math.cos(rad), 60 + r * Math.sin(rad)];
  const [x1, y1] = ponto(RAIO - 9);
  const [x2, y2] = ponto(RAIO + 9);
  return (
    <svg
      className="entrevistas-anel"
      viewBox="0 0 120 120"
      aria-hidden="true"
      data-tom={tom}
    >
      <circle
        className="entrevistas-anel-trilha"
        cx="60"
        cy="60"
        r={RAIO}
        strokeDasharray={`${cheio} ${CIRCUNFERENCIA}`}
        transform="rotate(135 60 60)"
      />
      <circle
        className="entrevistas-anel-valor"
        opacity={parte > 0 ? 1 : 0}
        cx="60"
        cy="60"
        r={RAIO}
        strokeDasharray={`${parte} ${CIRCUNFERENCIA}`}
        transform="rotate(135 60 60)"
      />
      {minimo !== null && maxima ? (
        <line
          className="entrevistas-anel-minimo"
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
        />
      ) : null}
    </svg>
  );
}

export function ResultadoDaFicha({
  parecer,
  total,
  maxima,
  minimoTotal,
  abaixoDoMinimoTotal,
  competencias,
  motivos,
  lancadas,
  esperadas,
  faltou,
  pendencia,
}: PropriedadesDoResultado) {
  const tom = pendencia
    ? "neutro"
    : parecer === "APTO"
      ? "ok"
      : parecer === "INAPTO"
        ? "reprova"
        : "neutro";
  const numero = useRef<HTMLElement>(null);
  const anterior = useRef(total);
  useEffect(() => {
    if (anterior.current !== total)
      animar(
        numero.current,
        [
          { transform: "scale(1)" },
          { transform: "scale(1.08)" },
          { transform: "scale(1)" },
        ],
        240,
      );
    anterior.current = total;
  }, [total]);

  return (
    <aside
      className="entrevistas-analise-lateral entrevistas-resultado"
      aria-label="Prévia do resultado"
      data-tom={tom}
      data-tour="entrevistas-ficha-previa"
    >
      <div className="entrevistas-resultado-total">
        <Anel total={total} maxima={maxima} minimo={minimoTotal} tom={tom} />
        <div className="entrevistas-resultado-numero">
          <strong id="entrevistasFichaTotal" ref={numero}>
            {numeroBR(total)}
          </strong>
          <span>/ {numeroBR(maxima)}</span>
        </div>
        {minimoTotal !== null ? (
          <small
            className={classes(
              "entrevistas-resultado-minimo",
              abaixoDoMinimoTotal && "is-abaixo",
            )}
          >
            mínimo {numeroBR(minimoTotal)}
          </small>
        ) : null}
      </div>

      <div
        className="entrevistas-parecer"
        data-tom={tom}
        data-previa={pendencia ? "sim" : undefined}
        aria-live="polite"
        data-tour="entrevistas-ficha-parecer"
      >
        <i
          className={`fa-solid ${ICONE[parecer] || ICONE.SEM_PARECER}`}
          aria-hidden="true"
        />
        <div>
          <span className="entrevistas-parecer-rotulo">
            {pendencia ? "Prévia" : "Parecer"}
          </span>
          <strong>
            <span id="entrevistasFichaParecer">
              {ROTULO[parecer] || ROTULO.SEM_PARECER}
            </span>
            {pendencia ? (
              <small className="entrevistas-parecer-falta">
                {" "}
                · {pendencia}
              </small>
            ) : null}
          </strong>
        </div>
      </div>
      {motivos.length ? (
        <ul className="entrevistas-resultado-motivos">
          {motivos.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      ) : null}

      {faltou ? null : (
        <ul
          className="entrevistas-notas-da-banca"
          aria-label="Nota da banca por competência"
        >
          {competencias.map((c, i) => {
            const situacao =
              c.nota === null
                ? "vazia"
                : c.abaixoDoMinimo || c.eliminatoria
                  ? "abaixo"
                  : "ok";
            return (
              <li key={c.id} data-situacao={situacao}>
                <div className="entrevistas-nota-da-banca-rotulo">
                  <span title={c.nome}>
                    <small>{i + 1}</small> {c.nome}
                  </span>
                  <b>{numeroBR(c.nota)}</b>
                </div>
                <div className="entrevistas-nota-da-banca" aria-hidden="true">
                  <span
                    className="entrevistas-nota-da-banca-valor"
                    style={{
                      transform: `scaleX(${proporcao(c.nota, c.maximo)})`,
                    }}
                  />
                  {c.minimo !== null ? (
                    <span
                      className="entrevistas-nota-da-banca-minimo"
                      style={{
                        left: `${proporcao(c.minimo, c.maximo) * 100}%`,
                      }}
                    />
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {faltou ? null : (
        <div className="entrevistas-progresso">
          <span>
            <b>{lancadas}</b> de {esperadas} notas
          </span>
          <div
            className="entrevistas-progresso-barra"
            role="progressbar"
            aria-label="Notas lançadas"
            aria-valuemin={0}
            aria-valuemax={esperadas}
            aria-valuenow={lancadas}
          >
            <span
              style={{ transform: `scaleX(${proporcao(lancadas, esperadas)})` }}
            />
          </div>
        </div>
      )}
    </aside>
  );
}
