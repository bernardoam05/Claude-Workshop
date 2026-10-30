// P4 · RAG (Retrieval-Augmented Generation): procurar os documentos relevantes e dá-los ao modelo.
//
// `db` é uma BD Postgres (PGlite) com a extensão pgvector já ativa e esta tabela já criada:
//   CREATE TABLE pedacos (id SERIAL PRIMARY KEY, documento TEXT, texto TEXT, embedding vector(<dim>))
// `embed(texto)` devolve um array de números (o embedding do texto). Nos testes é um embedder
// falso e determinista; a sério, seria a API de um fornecedor de embeddings.

// partir(texto, tamanho, sobreposicao) → array de pedaços com no máximo `tamanho` PALAVRAS cada,
// em que cada pedaço começa `tamanho - sobreposicao` palavras depois do anterior. Palavras são o
// que está separado por espaços (incluindo quebras de linha). O último pedaço pode ser mais curto;
// não cries um pedaço que só tenha palavras já incluídas no anterior.
//   partir("a b c d e f g", 3, 1) → ["a b c", "c d e", "e f g"]
// Error se sobreposicao >= tamanho.
export function partir(texto, tamanho, sobreposicao) {
  throw new Error('Por fazer: P4');
}

// indexar(db, documentos, embed, { tamanho = 50, sobreposicao = 10 })
//   documentos: [{ nome, texto }]. Parte cada texto e insere cada pedaço com o seu embedding.
//   O embedding vai para o SQL como texto no formato do pgvector: "[0.1,0.2,0.3]" (JSON.stringify
//   de um array dá exatamente isso), SEMPRE como parâmetro ($3), nunca colado no SQL.
//   Devolve quantos pedaços inseriu.
export async function indexar(db, documentos, embed, { tamanho = 50, sobreposicao = 10 } = {}) {
  throw new Error('Por fazer: P4');
}

// procurar(db, pergunta, embed, k = 3) → os k pedaços mais próximos da pergunta:
//   [{ id, documento, texto, distancia }], do mais próximo para o mais longe, usando a distância
//   de cosseno do pgvector (o operador <=>).
export async function procurar(db, pergunta, embed, k = 3) {
  throw new Error('Por fazer: P4');
}

// responder(cliente, db, pergunta, embed) → { resposta, fontes }
//   - procura os 3 pedaços mais próximos
//   - system: "Respondes só com base nos documentos fornecidos. Se a resposta não estiver lá, diz
//     que não sabes."
//   - a mensagem do utilizador tem os pedaços dentro de <documentos>, cada um assim:
//       <documento nome="NOME">TEXTO</documento>
//     e depois a pergunta dentro de <pergunta>...</pergunta>
//   - modelo "claude-opus-5-5", max_tokens 1024
//   - fontes: os nomes dos documentos usados, sem repetições, pela ordem de relevância
export async function responder(cliente, db, pergunta, embed) {
  throw new Error('Por fazer: P4');
}
