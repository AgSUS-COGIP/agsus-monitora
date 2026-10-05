import { useSyncExternalStore } from "react";
import { corDoTextoPara } from "../../lib/contraste.js";
import { camposDaSecao } from "../../lib/publicacao-de-configuracoes.js";
import { Icone } from "../../componentes/icone.jsx";
import { CampoDaSecao, Grupo, Imagem, Previa } from "./partes.jsx";

/*
  Configurações › Marca: a equipe responsável (pé da barra lateral), o
  rodapé e o cabeçalho da agência nos documentos oficiais (Classificação),
  com a prévia da barra lateral ao lado. Os valores são do rascunho
  de `estado.js` e vão na publicação da barra fixa.

  A cor e o logo da barra são os da seção Aparência (com o rascunho, se
  houver).
*/

const txt = (valor) => String(valor ?? "").trim();

const CAMPOS = camposDaSecao("marca");
const PREFIXO = "configMarca";

const GRUPOS = Object.freeze([
  {
    id: "equipe",
    titulo: "Equipe responsável",
    icone: "users",
    tom: "petroleo",
    campos: ["cogip_nome", "cogip_funcao", "cogip_dept", "cogip_logo_url"],
  },
  {
    id: "rodape",
    titulo: "Rodapé",
    icone: "file-text",
    tom: "neutro",
    campos: ["footer_text"],
  },
  {
    id: "documentos",
    titulo: "Documentos oficiais",
    icone: "file-text",
    tom: "neutro",
    campos: ["documento_cabecalho"],
  },
]);

function iniciais(nome) {
  const partes = txt(nome).split(/\s+/).filter(Boolean);
  return (
    (
      (partes[0]?.[0] || "") + (partes.length > 1 ? partes.at(-1)[0] : "")
    ).toUpperCase() || "?"
  );
}

function PreviaDaMarca({ estado }) {
  const fundo = txt(estado.valor("ui_sidebar_background_color")) || "#ffffff";
  const titulo = txt(estado.valor("app_title")) || "MONITORA";
  const equipe = txt(estado.valor("cogip_nome")) || "Nome da equipe";
  const funcao = txt(estado.valor("cogip_funcao")) || "Função / área";
  const departamento = txt(estado.valor("cogip_dept"));
  const rodape = txt(estado.valor("footer_text")) || "Rodapé das páginas";
  return (
    <Previa rotulo="Prévia da barra lateral">
      <div className="previa-marca">
        <div
          className="previa-marca__barra"
          style={{ background: fundo, color: corDoTextoPara(fundo) }}
        >
          <div className="previa-marca__topo">
            <Imagem
              url={estado.valor("ui_sidebar_logo_url")}
              alt=""
              className="previa-marca__logo"
              reserva={
                <span className="previa-marca__logo-reserva">
                  <Icone nome="layout-dashboard" tamanho={18} />
                </span>
              }
            />
            <strong>{titulo}</strong>
          </div>
          <ul className="previa-marca__menu" aria-hidden="true">
            {["Visão geral", "Editais", "Lista de aprovados"].map(
              (item, indice) => (
                <li key={item} className={indice === 0 ? "ativo" : ""}>
                  {item}
                </li>
              ),
            )}
          </ul>
          <div className="previa-marca__equipe">
            <Imagem
              url={estado.valor("cogip_logo_url")}
              alt={`Logo de ${equipe}`}
              className="previa-marca__avatar"
              reserva={
                <span className="previa-marca__avatar">{iniciais(equipe)}</span>
              }
            />
            <div>
              <strong>{equipe}</strong>
              <small>{funcao}</small>
              {departamento ? <small>{departamento}</small> : null}
            </div>
          </div>
        </div>
        <p className="previa-marca__rodape">{rodape}</p>
      </div>
    </Previa>
  );
}

export function SecaoMarca({ estado }) {
  // Assina o estado: cada tecla redesenha campos e prévia.
  useSyncExternalStore(estado.assinar, estado.obter);
  return (
    <div className="config-secao-react config-secao-react--com-previa">
      <div className="config-secao-react__campos">
        {GRUPOS.map((grupo) => (
          <Grupo key={grupo.id} secao="marca" {...grupo}>
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
      <PreviaDaMarca estado={estado} />
    </div>
  );
}
