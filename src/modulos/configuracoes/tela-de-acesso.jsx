import { useSyncExternalStore } from "react";
import { camposDaSecao } from "../../lib/publicacao-de-configuracoes.js";
import { CampoDaSecao, Grupo, PreviaDoAcesso } from "./partes.jsx";

/*
  Configurações › Tela de acesso: a saudação do cartão de entrada, o botão
  do Google (ligado, texto e domínio sugerido) e os domínios que podem
  entrar, com a prévia da tela ao lado. O slogan ("Monitoramento de
  Processos Seletivos") é fixo. A arte, o logo e a cor do cartão são da
  seção Aparência.
*/

const CAMPOS = camposDaSecao("acesso");
const PREFIXO = "configAcesso";

const GRUPOS = Object.freeze([
  {
    id: "boas-vindas",
    titulo: "Boas-vindas",
    icone: "log-in",
    tom: "azul",
    campos: ["auth_access_greeting"],
  },
  {
    id: "google",
    titulo: "Entrar com Google",
    icone: "globe",
    tom: "petroleo",
    campos: [
      "auth_google_enabled",
      "auth_google_button_text",
      "auth_google_domain_hint",
    ],
  },
  {
    id: "dominios",
    titulo: "Quem pode entrar",
    icone: "shield-check",
    tom: "sucesso",
    campos: ["auth_google_allowed_domains"],
  },
]);

export function SecaoTelaDeAcesso({ estado }) {
  useSyncExternalStore(estado.assinar, estado.obter);
  return (
    <div
      className="config-secao-react config-secao-react--com-previa"
      data-tour="config-acesso"
    >
      <div className="config-secao-react__campos">
        {GRUPOS.map((grupo) => (
          <Grupo key={grupo.id} secao="acesso" {...grupo}>
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
      <PreviaDoAcesso estado={estado} />
    </div>
  );
}
