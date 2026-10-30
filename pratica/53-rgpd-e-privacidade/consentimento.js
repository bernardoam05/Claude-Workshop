// P3 · Consentimento como um registo de eventos (nunca se apaga: precisas de PROVAR o que tinhas).

// Cada evento: { titular, finalidade, tipo: 'dado' | 'retirado', em: '2026-10-01T10:00:00Z', versaoTexto }

// temConsentimento(eventos, { titular, finalidade, em, versaoMinima = 1 }) → true/false
//   Olha só para os eventos desse titular e dessa finalidade com data <= em (o registo pode vir
//   desordenado). O último deles decide: 'dado' com versaoTexto >= versaoMinima → true.
//   (Se o texto do pedido de consentimento mudou de forma importante, os consentimentos dados
//   à versão antiga deixam de valer.) Sem eventos → false: o consentimento nunca se presume.
export function temConsentimento(eventos, { titular, finalidade, em, versaoMinima = 1 }) {
  throw new Error('Por fazer: P3');
}

// titularesPara(eventos, { finalidade, em, versaoMinima }) → lista ORDENADA dos titulares que
//   têm consentimento para essa finalidade nesse instante (ex.: a quem se pode mandar a newsletter).
export function titularesPara(eventos, { finalidade, em, versaoMinima = 1 }) {
  throw new Error('Por fazer: P3');
}
