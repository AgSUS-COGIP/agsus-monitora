import { useSyncExternalStore } from "react";
import { corDoTextoPara } from "../../lib/contraste.js";
import { CAMPOS_DAS_SECOES } from "../../lib/publicacao-de-configuracoes.js";
import { Icone } from "../icone.jsx";
import { Imagem } from "./partes.jsx";

/*
  Configurações › Marca: a equipe responsável (pé da barra lateral) e o
  rodapé, com a prévia da barra lateral ao lado. Os valores são do rascunho
  de `estado.js` e vão na publicação da barra fixa.

  A cor e o logo da barra são os da seção Aparência (com o rascunho, se
  houver).
*/

const txt = (valor) => String(valor ?? "").trim();

const CAMPOS = new Map(CAMPOS_DAS_SECOES.marca.map((c) => [c.chave, c]));

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
]);

const idDoCampo = (chave) =>
  `configMarca-${chave.replace(/_([a-z])/g, (_, letra) => letra.toUpperCase())}`;

function Campo({ estado, chave }) {
  const campo = CAMPOS.get(chave);
  const erro = estado.obter().errosDosCampos.get(chave);
  const id = idDoCampo(chave);
  const idDaDica = campo.dica ? `${id}-dica` : "";
  const idDoErro = `${id}-erro`;
  const descritoPor =
    [idDaDica, erro ? idDoErro : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className={campo.largo ? "form-row full" : "form-row"}>
      <div className="config-rotulo">
        <label htmlFor={id}>{campo.rotulo}</label>
        {campo.dica ? (
          <>
            <button
              type="button"
              className="config-dica"
              aria-label={`Ajuda: ${campo.rotulo}`}
              data-dica={campo.dica}
            >
              <Icone nome="circle-help" tamanho={14} />
            </button>
            <span id={idDaDica} className="sr-only">
              {campo.dica}
            </span>
          </>
        ) : null}
      </div>
      <input
        id={id}
        type={campo.tipo === "url" ? "url" : "text"}
        placeholder={campo.placeholder}
        value={estado.valor(chave)}
        className={erro ? "config-field-invalid" : undefined}
        aria-invalid={erro ? true : undefined}
        aria-describedby={descritoPor}
        onChange={(evento) => estado.mudarCampo(chave, evento.target.value)}
      />
      {erro ? (
        <small id={idDoErro} className="config-campo-erro">
          {erro}
        </small>
      ) : null}
    </div>
  );
}

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
    <aside className="config-previa" aria-label="Prévia da barra lateral">
      <p className="config-previa__rotulo">
        <Icone nome="eye" tamanho={14} />
        Prévia da barra lateral
      </p>
      <div className="config-previa__conteudo" aria-live="polite">
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
                  <span className="previa-marca__avatar">
                    {iniciais(equipe)}
                  </span>
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
      </div>
    </aside>
  );
}

export function SecaoMarca({ estado }) {
  // Assina o estado: cada tecla redesenha campos e prévia.
  useSyncExternalStore(estado.assinar, estado.obter);
  return (
    <div className="config-secao-react config-secao-react--com-previa">
      <div className="config-secao-react__campos">
        {GRUPOS.map((grupo) => {
          const tituloId = `configGrupo-marca-${grupo.id}`;
          return (
            <section
              key={grupo.id}
              className="config-grupo"
              data-tom={grupo.tom}
              data-grupo={grupo.id}
              aria-labelledby={tituloId}
            >
              <header className="config-grupo__cabecalho">
                <span className="config-grupo__icone" aria-hidden="true">
                  <Icone nome={grupo.icone} tamanho={16} />
                </span>
                <div>
                  <h4 id={tituloId}>{grupo.titulo}</h4>
                </div>
              </header>
              <div className="config-grupo__campos form-grid">
                {grupo.campos.map((chave) => (
                  <Campo key={chave} estado={estado} chave={chave} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
      <PreviaDaMarca estado={estado} />
    </div>
  );
}
