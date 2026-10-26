import type { PreviaDaSubstituicao } from "../../lib/previa-da-substituicao-de-aprovados.ts";
import { numerosDaPrevia } from "../../lib/previa-da-substituicao-de-aprovados.ts";
import { MOTIVO_MAXIMO } from "../../lib/publicacao-de-aprovados.ts";
import { Aviso, GradeDeKpis, Kpi } from "../../ui/index.ts";

/*
  O resumo do casamento antes de confirmar "Substituir XLSX" (a conta é de
  src/lib/previa-da-substituicao-de-aprovados.ts): quantos casam e levam o
  estado, quantos entram, quantos ficam sem par e quais status ficariam sem
  dono. Com status na lista vigente (ou lista publicada da Classificação),
  pede o motivo.
*/

const texto = (valor: unknown) => String(valor ?? "").trim();
const LIMITE_DE_NOMES = 50;

export function PreviaDaSubstituicaoDaLista({
  previa,
  motivo,
  aoMudarMotivo,
}: {
  previa: PreviaDaSubstituicao;
  motivo: string;
  aoMudarMotivo: (valor: string) => void;
}) {
  const n = numerosDaPrevia(previa);
  const kpis: [string, string, string, string, number][] = [
    ["casados", "sucesso", "fa-link", "Casados (levam o estado)", n.casados],
    ["entram", "info", "fa-user-plus", "Entram", n.entram],
    ["sem-par", "alerta", "fa-user-minus", "Sem par", n.semPar],
    [
      "sem-dono",
      n.semDono ? "perigo" : "neutro",
      "fa-triangle-exclamation",
      "Status sem dono",
      n.semDono,
    ],
  ];
  if (n.subJudiceMantidos)
    kpis.push([
      "sub-judice",
      "destaque",
      "fa-gavel",
      "Sub judice mantidos",
      n.subJudiceMantidos,
    ]);
  const semDono = previa.resumo.pendencias;
  return (
    <section
      id="approvedImportPrevia"
      className="approved-import-previa"
      aria-labelledby="approvedImportPreviaTitulo"
      data-tour="aprovados-listas-previa"
    >
      <h4 id="approvedImportPreviaTitulo">
        Prévia: {previa.anteriores.length} na lista vigente ·{" "}
        {previa.novos.length} na planilha
      </h4>
      <GradeDeKpis rotulo="O que a substituição faz">
        {kpis.map(([chave, tom, icone, rotulo, valor]) => (
          <Kpi
            key={chave}
            chave={chave}
            tom={tom}
            icone={icone}
            rotulo={rotulo}
            valor={String(valor)}
          />
        ))}
      </GradeDeKpis>
      {semDono.length ? (
        <Aviso tom="warning" papel="status">
          <span>
            {semDono.length} pessoa(s) com status ou matrícula não estão na
            planilha: o que têm fica só na lista anterior (histórico).
          </span>
          <ul className="approved-import-sem-dono">
            {semDono.slice(0, LIMITE_DE_NOMES).map((a) => (
              <li key={a.candidato_id}>
                <strong>{a.nome}</strong>{" "}
                <span className="ui-texto-secundario">
                  {[
                    a.codigo_vaga || a.cargo,
                    texto(a.status),
                    texto(a.matricula) ? `matrícula ${a.matricula}` : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        </Aviso>
      ) : null}
      {previa.exigeMotivo ? (
        <div className="form-row full">
          <label htmlFor="approvedImportMotivo">Motivo da substituição</label>
          <textarea
            id="approvedImportMotivo"
            rows={2}
            maxLength={MOTIVO_MAXIMO}
            value={motivo}
            onChange={(evento) => aoMudarMotivo(evento.target.value)}
          />
        </div>
      ) : null}
    </section>
  );
}
