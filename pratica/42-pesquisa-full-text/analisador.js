// P1 · O analisador: transformar texto em termos pesquisáveis (o mesmo para os documentos e para
// as consultas, senão não batem certo).

export const PALAVRAS_VAZIAS = new Set([
  'a', 'o', 'as', 'os', 'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'no', 'na', 'nos', 'nas',
  'um', 'uma', 'para', 'por', 'com', 'que', 'se', 'ao', 'aos',
]);

// normalizar(texto) → minúsculas e sem acentos ('Ações' → 'acoes').
//   Dica: normalize('NFD') separa a letra do acento; os acentos são a categoria Unicode \p{M}.
export function normalizar(texto) {
  throw new Error('Por fazer: P1');
}

// radical(palavra) → uma redução simples do plural (um "stemmer" muito pequeno), para uma palavra
//   já normalizada. A primeira regra que se aplica ganha:
//     termina em 'coes'        → troca por 'cao'   (acoes → acao)
//     termina em 'ais'         → troca por 'al'    (manuais → manual)
//     termina em 'res', 'zes' ou 'ses' → tira o 'es' (flores → flor, vezes → vez)
//     termina em 's' e tem mais de 3 letras → tira o 's' (tarefas → tarefa; mas 'mas' e 'gas' ficam)
//     senão fica igual
export function radical(palavra) {
  throw new Error('Por fazer: P1');
}

// tokenizar(texto) → lista de termos, pela ordem: normaliza, parte em tudo o que não é letra nem
//   algarismo, tira as palavras vazias, e reduz cada uma ao radical.
export function tokenizar(texto) {
  throw new Error('Por fazer: P1');
}
