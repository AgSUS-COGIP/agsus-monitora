import { useSyncExternalStore } from "react";

/*
  Botão de uma ação que escreve no banco. O `estado` é o store da tela
  (`assinar`/`obter`), com `acao: { tipo, rotulo } | null` — a ação em curso,
  uma por vez. Enquanto a dele corre, o botão mostra o rótulo dela e fica
  desativado; enquanto outra corre, só desativado. É o que a tela de
  carregamento fazia, sem cobrir a página. `soIcone`: o botão de linha de
  tabela, sem espaço para o rótulo (vai para o leitor de tela).

  Usado pela Lista de aprovados, Acessos e Módulos e abas.
*/
export function BotaoDeAcao({
  estado,
  acao,
  soIcone = false,
  disabled = false,
  children,
  ...atributos
}) {
  const { acao: emCurso } = useSyncExternalStore(estado.assinar, estado.obter);
  const minha = emCurso?.tipo === acao;
  return (
    <button
      type="button"
      {...atributos}
      disabled={disabled || Boolean(emCurso)}
      aria-busy={minha || undefined}
    >
      {minha ? (
        <>
          <span className="botao-girando" aria-hidden="true" />
          {soIcone ? (
            <span className="sr-only">{emCurso.rotulo}</span>
          ) : (
            ` ${emCurso.rotulo}`
          )}
        </>
      ) : (
        children
      )}
    </button>
  );
}
