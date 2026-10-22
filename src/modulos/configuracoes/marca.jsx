import { useSyncExternalStore } from "react";
import {
  CHAVE_DA_COR_DA_BARRA,
  CHAVE_DO_LOGO_DA_BARRA,
} from "../../lib/marca-da-barra-lateral.js";
import { camposDaSecao } from "../../lib/publicacao-de-configuracoes.js";
import { CartaoDaMascote } from "./cartao-da-mascote.tsx";
import { CampoDaSecao, Grupo, Previa } from "./partes.jsx";
import { PreviaDaBarraLateral } from "./previa-da-barra-lateral.tsx";
import { SECOES } from "./secoes.js";

/*
  Configurações › Marca: a equipe responsável e o rodapé (que aparecem no pé
  do cartão da tela de acesso, `src/app/entrada/entrada.jsx`), o cabeçalho
  da agência nos documentos oficiais (Classificação), a prévia da barra
  lateral ao lado e a mascote da Aya em cada estado (cartao-da-mascote.tsx),
  para conferir. Os valores são do rascunho de `estado.js` e vão na
  publicação da barra fixa.

  A prévia é a barra de verdade (previa-da-barra-lateral.tsx); a cor e o
  logo dela são os da seção Aparência (com o rascunho, se houver).
*/

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

function PreviaDaMarca({ estado }) {
  return (
    <Previa rotulo="Prévia da barra lateral">
      <PreviaDaBarraLateral
        logo={estado.valor(CHAVE_DO_LOGO_DA_BARRA)}
        cor={estado.valor(CHAVE_DA_COR_DA_BARRA)}
        versao={{
          rotulo: estado.valor("sidebar_version_label"),
          valor: estado.valor("app_version_current"),
        }}
      />
    </Previa>
  );
}

export function SecaoMarca({ estado }) {
  // Assina o estado: cada tecla redesenha campos e prévia.
  const { secao } = useSyncExternalStore(estado.assinar, estado.obter);
  /*
    A prévia (um quadro com o CSS do app inteiro) só existe com a Marca
    aberta; sem seção escolhida ainda, a aberta é a primeira, a Marca.
  */
  const aberta = (secao || SECOES[0].id) === "marca";
  return (
    <div
      className="config-secao-react config-secao-react--com-previa"
      data-tour="config-marca"
    >
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
        <CartaoDaMascote />
      </div>
      {aberta ? <PreviaDaMarca estado={estado} /> : null}
    </div>
  );
}
