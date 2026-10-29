import { Aviso, GradeDeKv, Kv, Selo } from "../../ui/index.ts";
import { resumoDaRegraDaTriagem } from "../../lib/triagem/regra-da-triagem.ts";
import type { RespostaDaRegraDaTriagem } from "../../lib/triagem/regra-da-triagem.ts";

/*
  Resumo só-leitura da regra da Triagem, no topo da tela da Triagem: versão,
  situação (conferida ou a conferir) e as regras em uma linha cada. Editar é
  nas Regras do edital (Editais › Regras da Triagem): o botão leva até lá.
*/
export function ResumoDaRegraDaTriagem({
  resposta,
  erro,
  aoEditar,
}: {
  resposta: RespostaDaRegraDaTriagem | null;
  erro?: string;
  aoEditar?: () => void;
}) {
  if (erro)
    return (
      <Aviso tom="danger" papel="alert">
        Não foi possível ler a regra da Triagem: {erro}
      </Aviso>
    );
  if (!resposta)
    return (
      <section className="ui-card triagem-regra" aria-busy="true">
        <div className="ui-esqueleto-linha" />
      </section>
    );
  const regra = resposta.regra;
  return (
    <section
      className="ui-card triagem-regra"
      aria-labelledby="triagemRegraTitulo"
      data-tour="triagem-regra"
    >
      <header className="triagem-regra__topo">
        <h2 className="ui-titulo" id="triagemRegraTitulo">
          Regra da Triagem
        </h2>
        {regra ? (
          <>
            <span className="triagem-regra__versao">
              versão {regra.versao}
              {regra.nome ? ` · ${regra.nome}` : ""}
            </span>
            <Selo
              tom={regra.situacao === "CONFERIDA" ? "aprovado" : "pendente"}
            >
              {regra.situacao === "CONFERIDA" ? "Conferida" : "A conferir"}
            </Selo>
          </>
        ) : (
          <Selo tom="pendente">Sem regra</Selo>
        )}
        {aoEditar ? (
          <button
            type="button"
            className="btn secondary small triagem-regra__editar"
            onClick={aoEditar}
          >
            Editar nas Regras do edital
          </button>
        ) : null}
      </header>
      {regra ? (
        <GradeDeKv rotulo="Resumo da regra da Triagem">
          {resumoDaRegraDaTriagem(regra.configuracao).map((linha) => (
            <Kv key={linha.rotulo} rotulo={linha.rotulo}>
              {linha.valor}
            </Kv>
          ))}
        </GradeDeKv>
      ) : (
        <p className="ui-texto-suave">
          O edital ainda não tem regra da Triagem: sem ela, a Triagem não
          calcula a lista nem o lote.
        </p>
      )}
    </section>
  );
}
