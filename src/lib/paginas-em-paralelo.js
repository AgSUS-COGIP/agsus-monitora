/*
  Busca uma consulta paginada inteira, com as páginas em paralelo.

  O Supabase devolve no máximo 1.000 linhas por pedido. A Lista de Aprovados
  pedia 16 páginas uma depois da outra, ~750 ms cada: 12 segundos com a tela
  bloqueada. A primeira página traz também o total (`count: "exact"`); com ele
  sabe-se quantas faltam e elas saem juntas, `concorrencia` por vez.

  A consulta precisa ter ordem determinística (ORDER BY), senão páginas
  pedidas ao mesmo tempo podem repetir ou pular linhas. O resultado volta na
  ordem das páginas, igual à busca sequencial.

  `buscarPagina(inicio, fim, { contar })` devolve `{ data, error, count }`,
  como o supabase-js.
*/
export async function buscarTodasAsPaginas(
  buscarPagina,
  { tamanho = 1000, concorrencia = 6 } = {},
) {
  const primeira = await buscarPagina(0, tamanho - 1, { contar: true });
  if (primeira.error) return { data: [], error: primeira.error };
  const inicio = Array.isArray(primeira.data) ? primeira.data : [];
  if (inicio.length < tamanho) return { data: inicio, error: null };

  // Sem total (o servidor não contou), cai na busca sequencial.
  if (!Number.isFinite(primeira.count)) {
    const linhas = [...inicio];
    for (let de = tamanho; ; de += tamanho) {
      const pagina = await buscarPagina(de, de + tamanho - 1, {
        contar: false,
      });
      if (pagina.error) return { data: linhas, error: pagina.error };
      const lote = Array.isArray(pagina.data) ? pagina.data : [];
      linhas.push(...lote);
      if (lote.length < tamanho) return { data: linhas, error: null };
    }
  }

  const totalDePaginas = Math.ceil(primeira.count / tamanho);
  const paginas = new Array(totalDePaginas);
  paginas[0] = inicio;
  let proxima = 1;
  let erro = null;

  async function trabalhador() {
    while (!erro && proxima < totalDePaginas) {
      const indice = proxima++;
      const de = indice * tamanho;
      const resposta = await buscarPagina(de, de + tamanho - 1, {
        contar: false,
      });
      if (resposta.error) {
        erro = resposta.error;
        return;
      }
      paginas[indice] = Array.isArray(resposta.data) ? resposta.data : [];
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(concorrencia, totalDePaginas - 1) },
      trabalhador,
    ),
  );
  if (erro) return { data: paginas.filter(Boolean).flat(), error: erro };
  return { data: paginas.flat(), error: null };
}
