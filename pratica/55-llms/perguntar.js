// P1 · Um pedido à Messages API com o SDK oficial. Ver docs/55-llms.md, secção "Prática".
//
// Em todas as funções, `cliente` é um `new Anthropic(...)` já criado (nos testes, aponta para um
// servidor falso). Recebê-lo como parâmetro é injeção de dependências: o mesmo código serve a API a
// sério e os testes.
import { z } from 'zod'; // eslint-disable-line no-unused-vars
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'; // eslint-disable-line no-unused-vars

export const MODELO = 'claude-opus-5-5';

// resumir(cliente, texto) → { resumo, cortado }
//   - modelo MODELO, max_tokens 1024
//   - system: "Resumes textos em português de Portugal, em no máximo três frases."
//   - uma mensagem do utilizador com o texto ENTRE MARCAS, assim:  <texto>\n...o texto...\n</texto>
//     (as marcas separam claramente as instruções dos dados: ver a secção 5 do módulo)
//   - resumo: o texto de TODOS os blocos "text" da resposta, juntos
//   - cortado: true se a resposta parou por atingir o max_tokens (stop_reason "max_tokens")
//   - se o stop_reason for "refusal", lança um Error com "recusa" na mensagem
export async function resumir(cliente, texto) {
  throw new Error('Por fazer: P1');
}

// classificar(cliente, mensagemDoCliente) → { categoria, urgente }
// Usa saídas estruturadas: cliente.messages.parse com output_config.format = zodOutputFormat(esquema),
// onde o esquema é um objeto com categoria ∈ ["avaria", "faturacao", "duvida"] e urgente (booleano).
//   - modelo MODELO, max_tokens 1024, a mensagem do cliente entre <mensagem>...</mensagem>
//   - devolve o parsed_output; se vier null, lança um Error
export async function classificar(cliente, mensagemDoCliente) {
  throw new Error('Por fazer: P1');
}
