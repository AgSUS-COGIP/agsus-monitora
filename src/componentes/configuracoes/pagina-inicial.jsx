import { useSyncExternalStore } from "react";
import { tomDoAviso } from "../../lib/apresentacao-das-configuracoes.js";
import { camposDaSecao } from "../../lib/publicacao-de-configuracoes.js";
import { INDICADORES } from "../../lib/visao-geral.js";
import { GradeDeKpis, Kpi } from "../../ui/index.js";
import { Icone } from "../icone.jsx";
import { CampoDaSecao, Grupo, Previa } from "./partes.jsx";

/*
  Configurações › Página inicial: título e subtítulo, o aviso global (faixa
  no topo, para todos), os textos dos filtros e os rótulos dos seis
  indicadores, com a prévia da página ao lado. Os valores são do rascunho de
  `estado.js` e vão na publicação da barra fixa.
*/

const CAMPOS = camposDaSecao("inicio");
const PREFIXO = "configInicio";

const GRUPOS = Object.freeze([
  {
    id: "cabecalho",
    titulo: "Cabeçalho da página",
    icone: "layout-dashboard",
    tom: "azul",
    campos: ["page_title", "page_subtitle"],
  },
  {
    id: "aviso",
    titulo: "Aviso global",
    icone: "megaphone",
    tom: "atencao",
    campos: ["broadcast_type", "broadcast_msg"],
  },
  {
    id: "filtros",
    titulo: "Filtros",
    icone: "list-filter",
    tom: "petroleo",
    campos: [
      "filter_title",
      "filter_subtitle",
      "filter_toggle_show",
      "filter_toggle_hide",
    ],
  },
  {
    id: "indicadores",
    titulo: "Indicadores",
    icone: "gauge",
    tom: "sucesso",
    campos: [
      "kpi_processos_label",
      "kpi_vagas_label",
      "kpi_contratados_label",
      "kpi_ociosas_label",
      "kpi_criticos_label",
      "kpi_inscritos_label",
    ],
  },
]);

const txt = (valor) => String(valor ?? "").trim();

function PreviaDaPaginaInicial({ estado }) {
  const valor = (chave) => txt(estado.valor(chave));
  const mensagem = valor("broadcast_msg");
  const aviso = tomDoAviso(valor("broadcast_type"));
  return (
    <Previa rotulo="Prévia da página inicial">
      <div className="previa-inicio">
        <strong className="previa-inicio__titulo">
          {valor("page_title") || "Título da página inicial"}
        </strong>
        <small className="previa-inicio__subtitulo">
          {valor("page_subtitle") || "Subtítulo"}
        </small>
        {mensagem ? (
          <div className="previa-aviso" data-tom={aviso.tom}>
            <Icone nome={aviso.icone} tamanho={14} />
            <span>
              <strong>{aviso.rotulo}: </strong>
              {mensagem}
            </span>
          </div>
        ) : null}
        <div className="previa-inicio__filtros">
          <Icone nome="list-filter" tamanho={14} />
          <div>
            <strong>{valor("filter_title") || "Filtros"}</strong>
            {valor("filter_subtitle") ? (
              <small>{valor("filter_subtitle")}</small>
            ) : null}
          </div>
          <span className="previa-inicio__botao">
            {valor("filter_toggle_show") || "Mostrar filtros"}
          </span>
        </div>
        <GradeDeKpis
          className="previa-inicio__kpis"
          rotulo="Indicadores da página inicial"
        >
          {INDICADORES.map(([chave, padrao, icone, tom]) => (
            <Kpi
              key={chave}
              chave={chave}
              tom={tom}
              icone={icone}
              rotulo={valor(chave) || padrao}
              valor="—"
            />
          ))}
        </GradeDeKpis>
      </div>
    </Previa>
  );
}

export function SecaoPaginaInicial({ estado }) {
  // Assina o estado: cada tecla redesenha campos e prévia.
  useSyncExternalStore(estado.assinar, estado.obter);
  return (
    <div className="config-secao-react config-secao-react--com-previa">
      <div className="config-secao-react__campos">
        {GRUPOS.map((grupo) => (
          <Grupo key={grupo.id} secao="inicio" {...grupo}>
            {grupo.campos.map((chave) => (
              <CampoDaSecao
                key={chave}
                estado={estado}
                campos={CAMPOS}
                prefixo={PREFIXO}
                chave={chave}
              />
            ))}
          </Grupo>
        ))}
      </div>
      <PreviaDaPaginaInicial estado={estado} />
    </div>
  );
}
