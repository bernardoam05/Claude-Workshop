// P1 · Injeção de SQL (OWASP A03: Injection). Ver docs/26-seguranca-owasp.md, secção "Prática".
//
// Este código FUNCIONA, mas é vulnerável. Corrige-o sem mudar o que faz para quem o usa bem:
//   - o texto pesquisado tem de ir como PARÂMETRO ($1), nunca colado dentro do SQL;
//   - "ordenar" não pode ser um parâmetro (o SQL não aceita parâmetros em nomes de colunas):
//     só aceita "titulo" ou "criada_em" (uma lista de permitidos). Qualquer outro valor lança um
//     Error cuja mensagem contém "ordenar".
//   - "dono" também vai como parâmetro.
//
// db.query(sql, params) é a mesma interface do driver pg (e do módulo 03).
export async function procurarNotas(db, { dono, texto = '', ordenar = 'criada_em' }) {
  const sql = `
    SELECT id, titulo FROM notas
    WHERE dono = ${dono} AND titulo ILIKE '%${texto}%'
    ORDER BY ${ordenar}, id`;
  const { rows } = await db.query(sql);
  return rows;
}
