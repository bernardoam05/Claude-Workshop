import pg from 'pg';

// Um Pool mantém ligações abertas e reutiliza-as entre pedidos.
// Abrir uma ligação ao Postgres (TCP + autenticação) é caro; o pool amortiza esse custo.
export function createPool(connectionString) {
  return new pg.Pool({ connectionString, max: 10 });
}
