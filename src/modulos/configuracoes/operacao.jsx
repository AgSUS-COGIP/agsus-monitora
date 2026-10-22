import { useSyncExternalStore } from "react";
import { camposDaSecao } from "../../lib/publicacao-de-configuracoes.js";
import { CampoDaSecao, Grupo } from "./partes.jsx";

/*
  Configurações › Operação: a versão do sistema, o e-mail do suporte (para
  onde a Aya abre chamados), o Realtime do monitoramento e o heartbeat da
  auditoria. Os valores são do rascunho de
  `estado.js` e vão na publicação da barra fixa. O histórico de publicações
  fica logo abaixo (configuracoes.jsx).
*/

const CAMPOS = camposDaSecao("operacao");
const PREFIXO = "configOperacao";

const GRUPOS = Object.freeze([
  {
    id: "versao",
    titulo: "Versão",
    icone: "info",
    tom: "azul",
    campos: ["cogip_versao", "app_version_current"],
  },
  {
    id: "suporte",
    titulo: "Suporte",
    icone: "mail",
    tom: "azul",
    campos: ["support_email"],
  },
  {
    id: "tecnico",
    titulo: "Avançado técnico",
    icone: "settings",
    tom: "neutro",
    campos: ["feature_realtime_monitoramento", "access_heartbeat_minutos"],
  },
]);

export function SecaoOperacao({ estado }) {
  useSyncExternalStore(estado.assinar, estado.obter);
  return (
    <div className="config-secao-react" data-tour="config-operacao">
      <div className="config-secao-react__campos">
        {GRUPOS.map((grupo) => (
          <Grupo key={grupo.id} secao="operacao" {...grupo}>
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
    </div>
  );
}
