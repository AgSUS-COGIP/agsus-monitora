import { useSyncExternalStore } from "react";
import { CAMPOS_DAS_SECOES } from "../../lib/publicacao-de-configuracoes.js";
import { Icone } from "../icone.jsx";

/*
  Configurações › Operação: a versão do sistema, o Realtime do
  monitoramento e o heartbeat da auditoria. Os valores são do rascunho de
  `estado.js` e vão na publicação da barra fixa. O histórico de publicações
  fica logo abaixo (configuracoes.jsx).
*/

const CAMPOS = new Map(CAMPOS_DAS_SECOES.operacao.map((c) => [c.chave, c]));

const GRUPOS = Object.freeze([
  {
    id: "versao",
    titulo: "Versão",
    icone: "info",
    tom: "azul",
    campos: ["cogip_versao", "app_version_current"],
  },
  {
    id: "tecnico",
    titulo: "Avançado técnico",
    icone: "settings",
    tom: "neutro",
    campos: ["feature_realtime_monitoramento", "access_heartbeat_minutos"],
  },
]);

const idDoCampo = (chave) =>
  `configOperacao-${chave.replace(/_([a-z])/g, (_, letra) => letra.toUpperCase())}`;

function Campo({ estado, chave }) {
  const campo = CAMPOS.get(chave);
  const erro = estado.obter().errosDosCampos.get(chave);
  const id = idDoCampo(chave);
  const idDoErro = `${id}-erro`;
  const comum = {
    id,
    value: estado.valor(chave),
    className: erro ? "config-field-invalid" : undefined,
    "aria-invalid": erro ? true : undefined,
    "aria-describedby": erro ? idDoErro : undefined,
    onChange: (evento) => estado.mudarCampo(chave, evento.target.value),
  };
  return (
    <div className="form-row">
      <label htmlFor={id}>{campo.rotulo}</label>
      {campo.tipo === "booleano" ? (
        <select {...comum}>
          {campo.opcoes.map(([valor, rotulo]) => (
            <option key={valor} value={valor}>
              {rotulo}
            </option>
          ))}
        </select>
      ) : (
        <input
          {...comum}
          type={campo.tipo === "inteiro" ? "number" : "text"}
          min={campo.tipo === "inteiro" ? campo.minimo : undefined}
          max={campo.tipo === "inteiro" ? campo.maximo : undefined}
          step={campo.tipo === "inteiro" ? 1 : undefined}
          placeholder={campo.placeholder}
        />
      )}
      {erro ? (
        <small id={idDoErro} className="config-campo-erro">
          {erro}
        </small>
      ) : null}
    </div>
  );
}

export function SecaoOperacao({ estado }) {
  useSyncExternalStore(estado.assinar, estado.obter);
  return (
    <div className="config-secao-react">
      <div className="config-secao-react__campos">
        {GRUPOS.map((grupo) => {
          const tituloId = `configGrupo-operacao-${grupo.id}`;
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
    </div>
  );
}
