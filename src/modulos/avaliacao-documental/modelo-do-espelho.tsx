import { useEffect, useMemo, useState } from "react";
import { paginaDoEspelho } from "../../lib/avaliacao-documental/espelho-de-nota.ts";
import { espelhoDeExemplo } from "../../lib/avaliacao-documental/espelho-de-nota.ts";
import type { ModeloDoEspelho } from "../../lib/avaliacao-documental/espelho-de-nota.ts";
import {
  CAMPOS_DO_MODELO,
  diferencasDoPadrao,
  MARCADOR_DO_CANDIDATO,
  TEXTOS_PADRAO_DO_ESPELHO,
  validarModeloDoEspelho,
  type CampoDoModelo,
  type ModeloDoEdital,
  type TextosDoEspelho,
} from "../../lib/avaliacao-documental/modelo-do-espelho.ts";
import { formatarDataHora } from "../../lib/cronograma-do-edital.js";
import { Aviso, Campo, Carregando, Modal, Segmentado } from "../../ui/index.ts";
import { marcaDaPagina } from "./ficha/espelho-de-nota.ts";
import {
  mensagemDoErroDoModelo,
  obterModeloDoEspelho,
  salvarModeloDoEspelho,
} from "./modelo-do-espelho-no-banco.ts";

/*
  "Modelo do espelho de nota" (Avaliação documental › Fila › Ações da
  coordenação, ao lado de "Espelhos de nota em massa"; só quem coordena o
  edital vê, e o banco confere de novo): os textos da folha do edital —
  título, subtítulo, saudação com {candidato}, abertura, nomes dos quadros,
  rótulos das notas, "Não se aplica" do eliminado, "Sem observação
  registrada.", rodapé e a nota autodeclarada no modelo com pontos —, com a
  prévia ao lado (dados fictícios, com pontos ou eliminado) e "Restaurar
  padrão". Salvar vale na hora para o espelho da ficha, os em massa, a
  impressão e o PDF/ZIP; sem deploy. O conteúdo (quem aparece, notas,
  critérios) não se edita aqui.
*/

type Rpc = (
  nome: string,
  argumentos: Record<string, unknown>,
) => Promise<unknown>;

const PREVIAS = [
  { valor: "COM_PONTOS", rotulo: "Com pontos" },
  { valor: "ELIMINADO", rotulo: "Eliminado" },
] as const;

const GRUPOS = [...new Set(CAMPOS_DO_MODELO.map((c) => c.grupo))];

const iguais = (a: TextosDoEspelho, b: TextosDoEspelho) =>
  JSON.stringify(diferencasDoPadrao(a)) ===
  JSON.stringify(diferencasDoPadrao(b));

function CampoDeTexto({
  campo,
  valor,
  erro,
  desabilitado,
  aoMudar,
}: {
  campo: CampoDoModelo;
  valor: string;
  erro?: string;
  desabilitado: boolean;
  aoMudar: (valor: string) => void;
}) {
  const dica = campo.aceitaCandidato
    ? `${MARCADOR_DO_CANDIDATO} vira o nome do candidato.`
    : campo.podeFicarVazio
      ? "Vazio: some da folha."
      : undefined;
  return (
    <Campo rotulo={campo.rotulo} dica={dica} erro={erro}>
      {campo.linhas > 1 ? (
        <textarea
          rows={campo.linhas}
          value={valor}
          maxLength={campo.maximo}
          disabled={desabilitado}
          data-campo={campo.chave}
          onChange={(ev) => aoMudar(ev.target.value)}
        />
      ) : (
        <input
          type="text"
          value={valor}
          maxLength={campo.maximo}
          disabled={desabilitado}
          data-campo={campo.chave}
          onChange={(ev) => aoMudar(ev.target.value)}
        />
      )}
    </Campo>
  );
}

export function ModeloDoEspelhoDeNota({
  editalId,
  rpc,
  aoFechar,
  marca = marcaDaPagina,
}: {
  editalId: string;
  rpc: Rpc;
  aoFechar: () => void;
  marca?: () => { cabecalho?: string; logo?: string };
}) {
  const [modelo, setModelo] = useState<ModeloDoEdital | null>(null);
  const [rascunho, setRascunho] = useState<TextosDoEspelho>({
    ...TEXTOS_PADRAO_DO_ESPELHO,
  });
  const [previa, setPrevia] = useState<ModeloDoEspelho>("COM_PONTOS");
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [leitura, setLeitura] = useState(0);

  useEffect(() => {
    let vivo = true;
    setErro("");
    obterModeloDoEspelho(rpc, editalId)
      .then((m) => {
        if (!vivo) return;
        setModelo(m);
        setRascunho(m.textos);
      })
      .catch((e: unknown) => {
        if (vivo)
          setErro(
            `Não foi possível abrir o modelo: ${(e as { message?: string })?.message || String(e)}`,
          );
      });
    return () => {
      vivo = false;
    };
  }, [rpc, editalId, leitura]);

  const erros = validarModeloDoEspelho(
    rascunho as unknown as Record<string, unknown>,
  );
  const temErro = Object.keys(erros).length > 0;
  const mudou = modelo ? !iguais(rascunho, modelo.textos) : false;
  const noPadrao = iguais(rascunho, TEXTOS_PADRAO_DO_ESPELHO);
  const podeEditar = Boolean(modelo?.podeEditar);
  const pagina = useMemo(
    () => paginaDoEspelho(espelhoDeExemplo(previa, rascunho), marca()),
    [previa, rascunho, marca],
  );

  const mudar = (chave: keyof TextosDoEspelho, valor: string | boolean) => {
    setAviso("");
    setRascunho((r) => ({ ...r, [chave]: valor }));
  };

  async function salvar() {
    if (!modelo) return;
    setSalvando(true);
    setErro("");
    setAviso("");
    try {
      const salvo = await salvarModeloDoEspelho(
        rpc,
        editalId,
        rascunho,
        modelo.versao,
      );
      setModelo(salvo);
      setRascunho(salvo.textos);
      setAviso(
        `Modelo salvo (versão ${salvo.versao}). Os próximos espelhos do edital já saem com ele.`,
      );
    } catch (e) {
      setErro(mensagemDoErroDoModelo(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      rotuloId="avdModeloEspelhoTitulo"
      aoFechar={aoFechar}
      fecharAoClicarFora={false}
      cartaoClassName="avd-modelo-espelho"
      tour="avd-modelo-espelho"
    >
      <div className="avd-modelo-espelho-topo">
        <h2 id="avdModeloEspelhoTitulo">Modelo do espelho de nota</h2>
        <button
          type="button"
          className="ui-gaveta-fechar"
          aria-label="Fechar"
          title="Fechar"
          onClick={aoFechar}
        >
          <i className="fa-solid fa-xmark" aria-hidden="true" />
        </button>
      </div>
      {modelo?.atualizadoEm ? (
        <small className="avd-modelo-espelho-salvo">
          Versão {modelo.versao} · {formatarDataHora(modelo.atualizadoEm)}
          {modelo.atualizadoPor ? ` · ${modelo.atualizadoPor}` : ""}
        </small>
      ) : null}
      {!modelo && !erro ? <Carregando /> : null}
      {modelo ? (
        <div className="avd-modelo-espelho-corpo">
          <form
            className="avd-modelo-espelho-campos"
            onSubmit={(ev) => {
              ev.preventDefault();
              if (podeEditar && mudou && !temErro) void salvar();
            }}
          >
            {GRUPOS.map((grupo) => (
              <fieldset key={grupo} className="avd-modelo-espelho-grupo">
                <legend>{grupo}</legend>
                {CAMPOS_DO_MODELO.filter((c) => c.grupo === grupo).map(
                  (campo) => (
                    <CampoDeTexto
                      key={campo.chave}
                      campo={campo}
                      valor={rascunho[campo.chave]}
                      erro={erros[campo.chave]}
                      desabilitado={!podeEditar || salvando}
                      aoMudar={(v) => mudar(campo.chave, v)}
                    />
                  ),
                )}
                {grupo === "Notas" ? (
                  <label className="avd-modelo-espelho-opcao">
                    <input
                      type="checkbox"
                      checked={rascunho.mostrar_autodeclarada}
                      disabled={!podeEditar || salvando}
                      data-campo="mostrar_autodeclarada"
                      onChange={(ev) =>
                        mudar("mostrar_autodeclarada", ev.target.checked)
                      }
                    />{" "}
                    Mostrar a nota autodeclarada (modelo com pontos)
                  </label>
                ) : null}
              </fieldset>
            ))}
          </form>
          <div className="avd-modelo-espelho-previa">
            <Segmentado
              rotulo="Prévia"
              opcoes={PREVIAS}
              valor={previa}
              aoMudar={(v: ModeloDoEspelho) => setPrevia(v)}
            />
            <iframe
              className="avd-modelo-espelho-folha"
              title="Prévia do espelho com dados fictícios"
              sandbox=""
              srcDoc={pagina}
            />
          </div>
        </div>
      ) : null}
      {aviso ? (
        <Aviso tom="info" papel="status">
          {aviso}
        </Aviso>
      ) : null}
      {erro ? (
        <Aviso tom="danger" papel="alert">
          {erro}{" "}
          <button
            type="button"
            className="btn secondary small"
            onClick={() => {
              setModelo(null);
              setLeitura((n) => n + 1);
            }}
          >
            Recarregar
          </button>
        </Aviso>
      ) : null}
      <div className="ui-acoes">
        <button type="button" className="btn secondary" onClick={aoFechar}>
          {mudou ? "Descartar e fechar" : "Fechar"}
        </button>
        {podeEditar ? (
          <>
            <button
              type="button"
              className="btn secondary"
              data-acao="modelo-espelho-padrao"
              disabled={salvando || noPadrao}
              onClick={() => {
                setAviso("");
                setRascunho({ ...TEXTOS_PADRAO_DO_ESPELHO });
              }}
            >
              Restaurar padrão
            </button>
            <button
              type="button"
              className="btn green"
              data-acao="modelo-espelho-salvar"
              disabled={salvando || !mudou || temErro}
              onClick={() => void salvar()}
            >
              <i className="fa-solid fa-floppy-disk" aria-hidden="true" />{" "}
              {salvando ? "Salvando…" : "Salvar modelo"}
            </button>
          </>
        ) : null}
      </div>
    </Modal>
  );
}
