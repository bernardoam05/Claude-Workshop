// P2 · SQS: uma fila de mensagens gerida, com uma fila de mensagens mortas (DLQ).
import { CreateQueueCommand, DeleteMessageCommand, GetQueueAttributesCommand, ReceiveMessageCommand, SendMessageCommand } from '@aws-sdk/client-sqs'; // eslint-disable-line no-unused-vars

// criarFilaComDlq(sqs, nome, { maxRecebimentos = 3, visibilidade = 1 })
//   → { filaUrl, dlqUrl }
//   1. cria a fila "<nome>-dlq"
//   2. obtém o ARN dela (GetQueueAttributes com AttributeNames: ["QueueArn"])
//   3. cria a fila "<nome>" com os atributos:
//        VisibilityTimeout: quantos segundos uma mensagem recebida fica invisível (String!)
//        RedrivePolicy: JSON.stringify({ deadLetterTargetArn: <ARN da dlq>, maxReceiveCount: <String> })
//   (os atributos do SQS são SEMPRE strings)
export async function criarFilaComDlq(sqs, nome, { maxRecebimentos = 3, visibilidade = 1 } = {}) {
  throw new Error('Por fazer: P2');
}

// enviar(sqs, filaUrl, evento): envia o evento como JSON (MessageBody).
export async function enviar(sqs, filaUrl, evento) {
  throw new Error('Por fazer: P2');
}

// processarLote(sqs, filaUrl, processar) → { processadas, falhadas }
//   - recebe até 10 mensagens, com long polling de 1 segundo (WaitTimeSeconds: 1)
//   - para cada uma: processar(JSON.parse(Body)). Se correr bem, APAGA a mensagem (DeleteMessage com o
//     ReceiptHandle). Se lançar um erro, NÃO a apaga: ela volta a aparecer depois do VisibilityTimeout,
//     e ao fim de maxReceiveCount tentativas o SQS move-a para a DLQ.
//   - um erro numa mensagem não pode impedir o processamento das outras do mesmo lote
export async function processarLote(sqs, filaUrl, processar) {
  throw new Error('Por fazer: P2');
}
