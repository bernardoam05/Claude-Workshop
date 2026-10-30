// Os clientes da AWS, apontados para o LocalStack (já feito: lê-o).
// Na AWS a sério, criarias os mesmos clientes SEM endpoint nem credenciais: o SDK encontra-as sozinho
// (variáveis de ambiente, o ~/.aws/credentials, ou o papel IAM da máquina onde corre).
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import { SQSClient } from '@aws-sdk/client-sqs';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

export function clientesAws(endpoint = process.env.LOCALSTACK_URL) {
  const comum = {
    endpoint,
    region: 'eu-west-1', // Irlanda
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' }, // o LocalStack aceita quaisquer
  };
  const ddbBase = new DynamoDBClient(comum);
  return {
    s3: new S3Client({ ...comum, forcePathStyle: true }), // http://host/bucket/chave, em vez de http://bucket.host/chave
    sqs: new SQSClient(comum),
    ddbBase,
    // O "Document client" converte objetos JS de e para o formato do DynamoDB ({ S: "texto" }, { N: "1" }...).
    ddb: DynamoDBDocumentClient.from(ddbBase),
  };
}
