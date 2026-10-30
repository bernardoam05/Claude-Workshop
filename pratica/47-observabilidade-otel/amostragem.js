// P4 · Amostragem: guardar todos os traces de um sistema grande custa uma fortuna.

// deveAmostrar(traceId, taxa) → true/false, de forma DETERMINISTA: o mesmo traceId dá sempre a
// mesma resposta, em qualquer serviço (assim, um trace não fica guardado só a meio).
//   - usa os últimos 16 caracteres hex do traceId como um número de 64 bits (BigInt)
//   - amostra se esse número for menor do que taxa × 2^64
//   - taxa 0 → nunca; taxa 1 → sempre
export function deveAmostrar(traceId, taxa) {
  throw new Error('Por fazer: P4');
}

// guardarTrace(spans, { taxa, lentoMs = 1000 }) → true/false: a decisão de amostragem "de cauda",
// tomada no FIM do trace, quando já se sabe como correu. spans: [{ traceId, duracaoMs, erro }]
//   - guarda SEMPRE se algum span teve erro, ou se algum demorou >= lentoMs
//   - senão, decide com deveAmostrar(traceId, taxa) (todos os spans de um trace têm o mesmo traceId)
export function guardarTrace(spans, { taxa, lentoMs = 1000 }) {
  throw new Error('Por fazer: P4');
}
