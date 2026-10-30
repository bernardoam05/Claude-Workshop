// P4 · Pesquisa de texto no Postgres: tsvector, tsquery, pesos, ranking, excertos e "querias dizer".
// A tabela (criada pelos testes): artigos(id serial, titulo text, corpo text)

// prepararPesquisa(db):
//   1. acrescenta à tabela artigos uma coluna `pesquisa` do tipo tsvector, GERADA a partir do título
//      (peso 'A') e do corpo (peso 'B'), com a configuração 'portuguese' (o Postgres mantém-na
//      sozinha a cada INSERT/UPDATE)
//   2. cria um índice GIN nessa coluna
//   3. cria um índice GIN de trigramas no título (gin_trgm_ops), para as sugestões
export async function prepararPesquisa(db) {
  throw new Error('Por fazer: P4');
}

// pesquisar(db, texto, { limite = 10 }) → [{ id, titulo, excerto }]
//   Converte o texto com websearch_to_tsquery('portuguese', ...) (aceita "frases entre aspas",
//   OR e -excluir, como um motor de pesquisa); devolve os artigos que correspondem, por ts_rank
//   decrescente (empate: id crescente). O excerto é o ts_headline do corpo, com os termos entre
//   <b> e </b>, entre 4 e 12 palavras (opções 'StartSel=<b>, StopSel=</b>, MinWords=4, MaxWords=12').
export async function pesquisar(db, texto, { limite = 10 } = {}) {
  throw new Error('Por fazer: P4');
}

// sugerirTitulo(db, texto) → o título mais parecido com o texto (similarity do pg_trgm) se a
//   semelhança for maior do que 0.3; senão null. Serve para o "querias dizer...?" com erros de escrita.
export async function sugerirTitulo(db, texto) {
  throw new Error('Por fazer: P4');
}
