import { useEffect, useState } from "react";
import { erroDoMotivoDoCritico } from "../../lib/criticos-da-visao-geral.ts";
import { getSupabaseClient } from "../../lib/supabaseClient";
import { Aviso, Campo } from "../../ui/index.ts";

/*
  Edital crítico marcado à mão (migration 20261110150000): gestor, coordenador
  ou administrador global marca o edital como crítico, com motivo; a Visão geral
  passa a contá-lo nos críticos junto com os motivos automáticos. Grava sozinho,
  à parte do "Salvar" do edital, e fica no histórico (TH_EDITAL_CRITICO).

  Quem pode marcar vem do banco (`pode_marcar`); quem só vê lê a marcação.
  Banco sem as RPCs, ou edital sem marcação para quem não pode marcar: o bloco
  não aparece.
*/

type Resposta = PromiseLike<{ data: unknown; error: unknown }>;
export type ClienteDoCritico = {
  rpc: {
    (
      nome: "obter_critico_do_edital",
      argumentos: { p_edital: string },
    ): Resposta;
    (
      nome: "marcar_edital_critico",
      argumentos: { p_edital: string; p_critico: boolean; p_motivo: string },
    ): Resposta;
  };
};

export type LeituraDoCritico = {
  marcado: boolean;
  motivo: string;
  quem: string;
  quando: string;
  podeMarcar: boolean;
};

const registro = (valor: unknown): Record<string, unknown> =>
  valor && typeof valor === "object" ? (valor as Record<string, unknown>) : {};
const texto = (valor: unknown) => (typeof valor === "string" ? valor : "");

export function lerCriticoDoEdital(valor: unknown): LeituraDoCritico {
  const bruta = registro(valor);
  return {
    marcado: bruta.marcado === true,
    motivo: texto(bruta.motivo),
    quem: texto(bruta.quem),
    quando: texto(bruta.quando),
    podeMarcar: bruta.pode_marcar === true,
  };
}

/** "10/11/2026" a partir do instante gravado (dia de Brasília). */
function dataCurta(instante: string): string {
  const data = new Date(instante);
  return Number.isNaN(data.getTime())
    ? ""
    : data.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

async function chamar(promessa: Resposta) {
  const resposta = await promessa;
  if (resposta.error) throw resposta.error;
  return resposta.data;
}

const mensagem = (erro: unknown, reserva: string) => {
  const conteudo = registro(erro).message;
  return typeof conteudo === "string" && conteudo ? conteudo : reserva;
};

export function CriticoDoEdital({
  editalId,
  supabase = getSupabaseClient() as ClienteDoCritico | null,
}: {
  editalId: string;
  supabase?: ClienteDoCritico | null;
}) {
  const [leitura, setLeitura] = useState<LeituraDoCritico | null>(null);
  const [motivo, setMotivo] = useState("");
  const [tentou, setTentou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!supabase || !editalId) return;
    let vivo = true;
    chamar(supabase.rpc("obter_critico_do_edital", { p_edital: editalId }))
      .then((dados) => {
        if (vivo) setLeitura(lerCriticoDoEdital(dados));
      })
      .catch(() => {
        // Sem as RPCs (banco antigo) ou sem acesso: o bloco não aparece.
      });
    return () => {
      vivo = false;
    };
  }, [supabase, editalId]);

  if (!leitura || (!leitura.podeMarcar && !leitura.marcado)) return null;

  const erroDoMotivo = erroDoMotivoDoCritico(motivo);
  const quando = dataCurta(leitura.quando);

  async function gravar(critico: boolean) {
    setTentou(true);
    setErro("");
    if (!supabase || erroDoMotivo) return;
    setSalvando(true);
    try {
      const lida = lerCriticoDoEdital(
        await chamar(
          supabase.rpc("marcar_edital_critico", {
            p_edital: editalId,
            p_critico: critico,
            p_motivo: motivo.trim(),
          }),
        ),
      );
      setLeitura(lida);
      setMotivo("");
      setTentou(false);
    } catch (falha) {
      setErro(mensagem(falha, "Não foi possível gravar a marcação."));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section
      id="editalCritico"
      className="edital-critico"
      aria-labelledby="editalCriticoTitulo"
    >
      <div className="subsection" id="editalCriticoTitulo">
        Edital crítico
      </div>
      {leitura.marcado ? (
        <Aviso tom="danger">
          <span id="editalCriticoMarcado">
            Marcado como crítico
            {leitura.quem ? ` por ${leitura.quem}` : ""}
            {quando ? ` em ${quando}` : ""}: {leitura.motivo}
          </span>
        </Aviso>
      ) : null}
      {leitura.podeMarcar ? (
        <div className="edital-critico-linha">
          <Campo
            rotulo={
              leitura.marcado
                ? "Motivo para alterar ou desmarcar"
                : "Motivo para marcar como crítico"
            }
            idDoControle="editalCriticoMotivo"
            erro={tentou && erroDoMotivo ? erroDoMotivo : undefined}
            largo
          >
            <textarea
              id="editalCriticoMotivo"
              rows={2}
              maxLength={500}
              value={motivo}
              onChange={(ev) => {
                setMotivo(ev.target.value);
                setErro("");
              }}
            />
          </Campo>
          <div className="ui-acoes">
            {leitura.marcado ? (
              <button
                id="editalCriticoDesmarcar"
                type="button"
                className="btn secondary small"
                disabled={salvando}
                onClick={() => void gravar(false)}
              >
                Desmarcar
              </button>
            ) : null}
            <button
              id="editalCriticoMarcar"
              type="button"
              className="btn small"
              disabled={salvando}
              onClick={() => void gravar(true)}
            >
              {salvando
                ? "Gravando..."
                : leitura.marcado
                  ? "Alterar motivo"
                  : "Marcar como crítico"}
            </button>
          </div>
        </div>
      ) : null}
      {erro ? (
        <Aviso tom="danger" papel="alert">
          {erro}
        </Aviso>
      ) : null}
    </section>
  );
}
