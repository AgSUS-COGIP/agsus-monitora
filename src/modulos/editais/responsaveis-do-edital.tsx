import { useEffect, useMemo, useState } from "react";
import type { PessoaDaDemanda } from "../../lib/demandas-internas.ts";
import { lerPessoas } from "../../lib/demandas-internas.ts";
import { getSupabaseClient } from "../../lib/supabaseClient";
import { MultiSelectBusca } from "../../componentes/multi-select-busca.tsx";
import { Aviso, Campo } from "../../ui/index.ts";

/*
  Responsáveis pelo edital (migration 20261104120000): pessoas do sistema,
  em RL_RESPONSAVEL_EDITAL, no formulário do edital. Grava sozinho, à parte
  do "Salvar" do edital (que exige motivo para mexer no cronograma). A coluna
  antiga "responsavel" (USI/CORES) segue no formulário, intocada.

  Quem pode editar vem do banco (`pode_editar`: gestor da área ou
  administrador global); quem só vê lê os nomes. Banco sem as RPCs: o bloco
  não aparece.
*/

type Resposta = PromiseLike<{ data: unknown; error: unknown }>;
export type ClienteDosResponsaveis = {
  rpc: {
    (
      nome: "obter_responsaveis_do_edital",
      argumentos: { p_edital: string },
    ): Resposta;
    (
      nome: "salvar_responsaveis_do_edital",
      argumentos: { p_edital: string; p_responsaveis: string[] },
    ): Resposta;
    (
      nome: "listar_pessoas_da_area",
      argumentos: { p_area: string; p_edital: string | null },
    ): Resposta;
  };
};

type Leitura = {
  area: string;
  podeEditar: boolean;
  responsaveis: PessoaDaDemanda[];
};

const registro = (valor: unknown): Record<string, unknown> =>
  valor && typeof valor === "object" ? (valor as Record<string, unknown>) : {};

export function lerResponsaveisDoEdital(valor: unknown): Leitura {
  const bruta = registro(valor);
  return {
    area: typeof bruta.area === "string" ? bruta.area : "",
    podeEditar: bruta.pode_editar === true,
    responsaveis: lerPessoas(bruta.responsaveis),
  };
}

async function chamar(promessa: Resposta) {
  const resposta = await promessa;
  if (resposta.error) throw resposta.error;
  return resposta.data;
}

const mensagem = (erro: unknown, reserva: string) => {
  const texto = registro(erro).message;
  return typeof texto === "string" && texto ? texto : reserva;
};

const mesmaLista = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && [...a].sort().join() === [...b].sort().join();

export function ResponsaveisDoEdital({
  editalId,
  supabase = getSupabaseClient() as ClienteDosResponsaveis | null,
}: {
  editalId: string;
  supabase?: ClienteDosResponsaveis | null;
}) {
  const [leitura, setLeitura] = useState<Leitura | null>(null);
  const [pessoas, setPessoas] = useState<PessoaDaDemanda[]>([]);
  const [escolhidos, setEscolhidos] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    if (!supabase || !editalId) return;
    let vivo = true;
    chamar(supabase.rpc("obter_responsaveis_do_edital", { p_edital: editalId }))
      .then((dados) => {
        if (!vivo) return;
        const lida = lerResponsaveisDoEdital(dados);
        setLeitura(lida);
        setEscolhidos(lida.responsaveis.map((pessoa) => pessoa.id));
        if (!lida.podeEditar || !lida.area) return;
        return chamar(
          supabase.rpc("listar_pessoas_da_area", {
            p_area: lida.area,
            p_edital: editalId,
          }),
        ).then((lista) => {
          if (vivo) setPessoas(lerPessoas(lista));
        });
      })
      .catch(() => {
        // Sem as RPCs (banco antigo) ou sem acesso: o bloco não aparece.
      });
    return () => {
      vivo = false;
    };
  }, [supabase, editalId]);

  const opcoes = useMemo(() => {
    const porId = new Map(pessoas.map((pessoa) => [pessoa.id, pessoa.nome]));
    for (const pessoa of leitura?.responsaveis || [])
      if (!porId.has(pessoa.id)) porId.set(pessoa.id, pessoa.nome);
    return [...porId].map(([value, label]) => ({ value, label }));
  }, [pessoas, leitura]);

  if (!leitura) return null;

  const atuais = leitura.responsaveis.map((pessoa) => pessoa.id);
  const mudou = !mesmaLista(atuais, escolhidos);

  async function salvar() {
    if (!supabase) return;
    setSalvando(true);
    setErro("");
    setSalvo(false);
    try {
      const lida = lerResponsaveisDoEdital(
        await chamar(
          supabase.rpc("salvar_responsaveis_do_edital", {
            p_edital: editalId,
            p_responsaveis: escolhidos,
          }),
        ),
      );
      setLeitura(lida);
      setEscolhidos(lida.responsaveis.map((pessoa) => pessoa.id));
      setSalvo(true);
    } catch (falha) {
      setErro(mensagem(falha, "Não foi possível salvar os responsáveis."));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section
      id="editalResponsaveis"
      className="edital-responsaveis"
      aria-labelledby="editalResponsaveisTitulo"
    >
      <div className="subsection" id="editalResponsaveisTitulo">
        Responsáveis pelo edital
      </div>
      {leitura.podeEditar ? (
        <div className="edital-responsaveis-linha">
          <Campo
            rotulo="Pessoas"
            idDoControle="editalResponsaveisEscolha"
            largo
          >
            <MultiSelectBusca
              id="editalResponsaveisEscolha"
              opcoes={opcoes}
              selecionados={escolhidos}
              placeholder="Ninguém"
              aoMudar={(valores) => {
                setEscolhidos(valores);
                setSalvo(false);
              }}
            />
          </Campo>
          <button
            id="editalResponsaveisSalvar"
            type="button"
            className="btn secondary small"
            disabled={!mudou || salvando}
            onClick={() => void salvar()}
          >
            {salvando ? "Salvando…" : "Salvar responsáveis"}
          </button>
          {salvo && !mudou ? (
            <span className="edital-responsaveis-salvo" role="status">
              Responsáveis salvos.
            </span>
          ) : null}
        </div>
      ) : (
        <p id="editalResponsaveisLista" className="edital-responsaveis-lista">
          {leitura.responsaveis.length
            ? leitura.responsaveis.map((pessoa) => pessoa.nome).join(", ")
            : "Nenhum responsável definido."}
        </p>
      )}
      {erro ? (
        <Aviso tom="danger" papel="alert">
          {erro}
        </Aviso>
      ) : null}
    </section>
  );
}
