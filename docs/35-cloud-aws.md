# 35 · Cloud: AWS na prática

**Objetivo:** perceber o que é "estar na cloud", conhecer os serviços da AWS que aparecem em quase todas as empresas (IAM, VPC, EC2, ECS, Lambda, S3, RDS, DynamoDB, SQS, CloudWatch), saber como o sistema deste workshop ficaria lá, e usar o SDK da AWS a sério contra uma AWS local (o LocalStack), sem conta nem cartão de crédito.

**Ficheiros para ler:** `config/docker-compose.yml` (para o mapeamento da secção 9) e o módulo 33 (Terraform), que é como se cria tudo isto em empresas.

**Pré-requisitos:** módulos 02, 06, 25 e 33.

---

## 1. O que é a cloud

"A cloud" é usar os computadores de outra empresa, alugados ao minuto, através de uma API. Em vez de comprares um servidor, esperares que chegue, e o instalares num centro de dados, pedes um com um comando, e ele existe dois minutos depois. Quando não precisas dele, apagas, e deixas de pagar.

Os três grandes fornecedores são a **AWS** (Amazon, o maior), o **Azure** (Microsoft, forte em empresas que já usam produtos Microsoft) e o **Google Cloud**. Os conceitos são os mesmos nos três; os nomes mudam (tabela na secção 10). Este módulo usa a AWS porque é a que aparece em mais vagas.

Os serviços vêm em níveis de abstração diferentes:

| Modelo | Tu geres | O fornecedor gere | Exemplo AWS |
|---|---|---|---|
| **IaaS** (infraestrutura) | sistema operativo, runtime, app | hardware, rede, virtualização | EC2 (uma máquina virtual) |
| **PaaS / contentores geridos** | a app (ou a imagem) | também o sistema e o runtime | ECS Fargate, Elastic Beanstalk |
| **Serverless** | só o código de uma função | tudo o resto, incluindo escalar | Lambda |
| **Serviços geridos** | os dados e a configuração | a base de dados, as filas, as cópias de segurança | RDS, SQS, S3 |

Quanto mais para baixo na tabela, menos trabalho de operação e menos controlo. A regra prática numa equipa pequena: usa serviços geridos para tudo o que não é o teu produto. Gerir um Postgres com réplicas, cópias de segurança e atualizações de segurança é um trabalho a tempo inteiro; o RDS faz isso por ti.

## 2. Regiões, zonas e o modelo de responsabilidade partilhada

A AWS está dividida em **regiões** (`eu-west-1` é a Irlanda, `eu-south-2` é Espanha, `eu-central-1` é Frankfurt), e cada região tem várias **zonas de disponibilidade** (AZs): centros de dados separados, com energia e rede independentes, a poucos quilómetros uns dos outros. Para um sistema aguentar a falha de um centro de dados, corre em **pelo menos duas AZs**. A região escolhe-se pela proximidade dos utilizadores (latência) e pela lei (dados de clientes europeus, na Europa: o RGPD).

O **modelo de responsabilidade partilhada**: a AWS é responsável pela segurança **da** cloud (os edifícios, o hardware, a virtualização); tu és responsável pela segurança **na** cloud (quem tem acesso, que portas estão abertas, se o bucket é público, se os dados estão cifrados). A maior parte das fugas de dados em cloud não vem de falhas da AWS, mas de configurações erradas dos clientes: um bucket S3 público com dados de clientes é um clássico.

## 3. IAM: quem pode fazer o quê

Todos os pedidos à AWS são autenticados e autorizados pelo **IAM** (*Identity and Access Management*). É o serviço mais importante de aprender, porque é por onde passam todos os erros de segurança.

- **Utilizadores:** pessoas, com password e MFA. Nas empresas, quase sempre substituídos por login único (SSO).
- **Papéis** (*roles*): uma identidade que se **assume** temporariamente e que dá credenciais de curta duração. Uma máquina EC2, uma tarefa ECS ou uma Lambda correm com um papel; o SDK encontra as credenciais sozinho. É por isso que o código de produção **nunca** tem chaves de acesso escritas.
- **Políticas:** documentos JSON que dizem o que é permitido:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "LerUploads",
    "Effect": "Allow",
    "Action": ["s3:GetObject"],
    "Resource": "arn:aws:s3:::notas-uploads/uploads/*"
  }]
}
```

Cada recurso tem um **ARN** (*Amazon Resource Name*), um identificador único: `arn:aws:<serviço>:<região>:<conta>:<recurso>`. A avaliação é: tudo é **negado por omissão**; um `Allow` que case com a ação e o recurso permite; um `Deny` explícito ganha sempre.

As regras de ouro: **menor privilégio** (cada papel só pode o que precisa, e o P4 treina isso); **nunca uses a conta root** no dia a dia (ativa-lhe MFA e guarda-a); **nada de chaves de longa duração** em código, em CI ou em portáteis (no CI, usa OIDC, como no módulo 20, secção 10).

## 4. Rede: VPC

Uma **VPC** (*Virtual Private Cloud*) é a tua rede privada dentro da AWS, com um intervalo de IPs teu (ex.: `10.0.0.0/16`, o CIDR do módulo 25). Divide-se em **sub-redes**, cada uma numa AZ:

```
VPC 10.0.0.0/16
├── sub-rede pública   10.0.1.0/24 (AZ a)  ── Internet Gateway ── Internet
│     └── balanceador de carga
├── sub-rede privada   10.0.11.0/24 (AZ a) ── NAT Gateway (saída para a Internet, sem entrada)
│     └── API (ECS)
└── sub-rede de dados  10.0.21.0/24 (AZ a)  (sem acesso à Internet)
      └── Postgres (RDS)
   (e o mesmo nas AZs b e c)
```

Só o balanceador está exposto à Internet. A API e a base de dados vivem em sub-redes privadas: ninguém lá chega de fora, nem que saiba o IP. É o desenho do `docker-compose.yml` deste projeto, em que só o `web` está exposto, à escala de uma cloud.

Os **security groups** são firewalls por recurso, com estado, e referem-se uns aos outros: "o Postgres aceita ligações na porta 5432, **só** do security group da API". Isto é muito mais seguro do que listas de IPs, que mudam.

## 5. Computação: onde corre o código

| Serviço | O que é | Bom para | Cuidado com |
|---|---|---|---|
| **EC2** | máquinas virtuais | controlo total, cargas constantes, software que não está em contentores | gerir o sistema operativo, as atualizações e o escalamento |
| **ECS** (com **Fargate**) | contentores geridos: dás a imagem, a AWS corre-a | APIs e workers em contentores, como os deste projeto | é mais simples que o Kubernetes, mas é só da AWS |
| **EKS** | Kubernetes gerido (módulo 32) | equipas que já usam Kubernetes, ou várias clouds | o cluster custa dinheiro mesmo vazio, e a complexidade é a do Kubernetes |
| **Lambda** | uma função que corre por evento, até 15 minutos | eventos esporádicos (um upload, uma mensagem), tráfego muito irregular | o "arranque a frio", os limites de tempo, e o custo com tráfego constante alto |
| **App Runner** | "dá-me o código ou a imagem, e um URL" | protótipos e serviços simples | menos controlo |

## 6. Dados e armazenamento

- **S3:** armazenamento de objetos (ficheiros), quase infinito e barato, com 99,999999999% de durabilidade. Guarda uploads, cópias de segurança, ficheiros estáticos do frontend, e os *data lakes*. Os objetos vivem em **buckets** e têm uma **chave** (`uploads/ana/foto.jpg`). Não é um sistema de ficheiros: não há pastas a sério, só prefixos. Para dar a um browser acesso temporário a um ficheiro privado, gera-se um **URL pré-assinado** (o P1), em vez de tornar o bucket público.
- **RDS / Aurora:** Postgres (ou MySQL) gerido: cópias de segurança automáticas, réplicas de leitura, e uma réplica de reserva noutra AZ, que entra em funcionamento sozinha se o primário falhar (*Multi-AZ*).
- **DynamoDB:** uma base de dados chave-valor, sem servidores para gerir, que escala sem limite prático com latências de milissegundos. Em troca, modela-se **pelas consultas** (o desenho de chaves do P3) e não há joins. O módulo sobre NoSQL vai mais fundo.
- **ElastiCache:** Redis ou Valkey geridos (módulo 05).

## 7. Mensagens e eventos

- **SQS:** filas geridas, sem servidores, a escalar sozinhas. O modelo é o do RabbitMQ (módulo 06), com nomes diferentes: em vez de um *ack*, **apaga-se** a mensagem depois de a processar; uma mensagem recebida fica **invisível** durante o *visibility timeout* e, se não for apagada, volta à fila; ao fim de N tentativas vai para uma **DLQ**. A entrega é "pelo menos uma vez": o consumidor tem de ser idempotente.
- **SNS:** publicar e subscrever: uma mensagem, muitos destinatários (filas SQS, emails, Lambdas).
- **EventBridge:** um barramento de eventos com regras de encaminhamento.
- **Kinesis** e **MSK** (Kafka gerido, módulo 17): streams de grande volume.

## 8. Observabilidade e custos

O **CloudWatch** junta os logs, as métricas e os alarmes de todos os serviços (o papel do Prometheus e do Grafana do módulo 19). O **CloudTrail** regista **todas** as chamadas à API da conta: quem apagou aquele bucket, e quando. Liga-o sempre.

Os custos na cloud são a surpresa mais comum de quem começa:

- **Paga-se o que está ligado, e não o que se usa.** Uma máquina de testes esquecida durante um mês, um NAT Gateway (cerca de 35 $ por mês, mais o tráfego), um balanceador sem tráfego: tudo isso conta.
- **A transferência de dados para fora da AWS** (*egress*) paga-se, e é muitas vezes a parte da fatura que ninguém previu.
- **Cria um orçamento com alertas** (AWS Budgets) no primeiro dia, mesmo numa conta pessoal: um alerta a 10 $ evita uma fatura de 1 000 $.
- **Etiqueta tudo** (`projeto=notas`, `ambiente=dev`): é assim que se sabe quem gasta o quê.
- **O nível gratuito** (*free tier*) tem limites e prazos. Lê-os antes de criares recursos numa conta pessoal.

## 9. O sistema deste workshop na AWS

| Peça (compose) | Na AWS | Porquê |
|---|---|---|
| `web` (Nginx + estáticos) | S3 + CloudFront | estáticos servidos de uma CDN, sem servidores |
| `api`, `worker`, `activity`, `notifications` | ECS Fargate, atrás de um Application Load Balancer | contentores sem gerir máquinas; escalam por CPU |
| `postgres` | RDS for PostgreSQL, Multi-AZ | cópias de segurança e failover geridos |
| `redis` | ElastiCache | gerido |
| `rabbitmq` | Amazon MQ (RabbitMQ gerido), ou trocar por SQS | o SQS não precisa de nada, mas muda o código do publisher |
| `kafka` | MSK | Kafka gerido |
| `keycloak` | ECS com RDS, ou trocar por Cognito | o Cognito é o fornecedor de identidade da AWS |
| `prometheus`, `grafana` | Amazon Managed Prometheus/Grafana, ou CloudWatch | gerido |
| segredos (`JWT_SECRET`) | Secrets Manager | o ECS injeta-os como variáveis de ambiente |

E tudo isto descrito em Terraform (módulo 33), aplicado por um pipeline de CI (módulo 20) com OIDC. O código da aplicação quase não muda: lê as mesmas variáveis de ambiente. É o benefício de uma aplicação que segue os princípios da *twelve-factor app*: configuração no ambiente, processos sem estado, e serviços externos como recursos que se trocam por configuração.

## 10. AWS, Azure e Google Cloud

| Conceito | AWS | Azure | Google Cloud |
|---|---|---|---|
| máquinas virtuais | EC2 | Virtual Machines | Compute Engine |
| contentores geridos | ECS / Fargate | Container Apps | Cloud Run |
| Kubernetes | EKS | AKS | GKE |
| funções | Lambda | Functions | Cloud Functions / Cloud Run functions |
| ficheiros | S3 | Blob Storage | Cloud Storage |
| Postgres gerido | RDS / Aurora | Database for PostgreSQL | Cloud SQL / AlloyDB |
| chave-valor | DynamoDB | Cosmos DB | Firestore / Bigtable |
| filas | SQS | Service Bus / Queue Storage | Pub/Sub |
| identidade e acesso | IAM | Entra ID + RBAC | IAM |
| logs e métricas | CloudWatch | Monitor | Cloud Logging / Monitoring |

## 11. O LocalStack

O **LocalStack** imita dezenas de serviços da AWS num contentor Docker, com as mesmas APIs: o SDK, a CLI da AWS e o Terraform falam com ele apontando o *endpoint* para `http://localhost:4566`. Serve para desenvolver e testar sem conta, sem custos, e sem rede. Não é uma cópia perfeita (não aplica as políticas IAM por omissão, e alguns comportamentos e limites são diferentes), por isso os testes contra o LocalStack não substituem um ambiente de testes na AWS a sério antes de produção.

```bash
docker run -d --name localstack -p 127.0.0.1:4566:4566 localstack/localstack:4.10
aws --endpoint-url http://localhost:4566 s3 mb s3://teste     # com a CLI da AWS (credenciais quaisquer)
aws --endpoint-url http://localhost:4566 s3 ls
```

---

## Prática: escreve tu

Três serviços da AWS com o SDK oficial (v3), contra um LocalStack que o verificador arranca num contentor e apaga no fim, e uma política IAM avaliada por um pequeno avaliador que faz o essencial do que a AWS faz.

**Ficheiros:** `pratica/35-cloud-aws/` (`s3.js`, `sqs.js`, `dynamo.js`, `politica.json`). O `clientes.js` (os clientes apontados para o LocalStack) e o `verificar.mjs` já estão feitos.

**Verificar:** `npm run verificar 35` (dentro de `pratica/`). Só um exercício: `npm run verificar 35 s3`, `... 35 sqs`, `... 35 dynamo` ou `... 35 politica`. Precisa do Docker; a primeira vez descarrega a imagem do LocalStack (cerca de 1,8 GB). O `politica` não precisa de nada disto.

Se nunca usaste a prática, lê primeiro a introdução no [módulo 01](01-fundamentos.md#prática-escreve-tu).

### P1 · S3 (≈25 min)

**Ficheiro:** `s3.js`

Criar um bucket só se ainda não existir, guardar e ler ficheiros, listar por prefixo seguindo as páginas, e gerar um URL pré-assinado que um browser usa para descarregar um ficheiro privado sem credenciais.

**Sintaxe que vais praticar:** o padrão `cliente.send(new XCommand({...}))` do SDK v3, `error.name` e `error.$metadata.httpStatusCode`, `Body.transformToString()`, um ciclo `do...while` com o token de continuação, `getSignedUrl`.

<details>
<summary>Pista</summary>

Todas as listagens da AWS são paginadas: a resposta traz um token (`NextContinuationToken`) quando há mais, e o pedido seguinte envia-o de volta (`ContinuationToken`). Um `do { ... } while (token)` faz o primeiro pedido sem token e para quando a resposta já não traz nenhum.
</details>

<details>
<summary>Solução de referência</summary>

```js
import { CreateBucketCommand, GetObjectCommand, HeadBucketCommand, ListObjectsV2Command, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export async function garantirBucket(s3, nome) {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: nome }));
  } catch (e) {
    if (e.$metadata?.httpStatusCode !== 404) throw e; // 403 = existe mas é de outra conta: não é para criar
    await s3.send(new CreateBucketCommand({ Bucket: nome }));
  }
}

export async function guardar(s3, bucket, chave, conteudo, tipo) {
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: chave, Body: conteudo, ContentType: tipo }));
}

export async function ler(s3, bucket, chave) {
  try {
    const r = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: chave }));
    return await r.Body.transformToString(); // o Body é um stream: o SDK ajuda a lê-lo todo
  } catch (e) {
    if (e.name === 'NoSuchKey') return null;
    throw e;
  }
}

export async function listar(s3, bucket, prefixo) {
  const chaves = [];
  let token;
  do {
    const r = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefixo, MaxKeys: 2, ContinuationToken: token }));
    chaves.push(...(r.Contents ?? []).map((o) => o.Key));
    token = r.NextContinuationToken; // undefined na última página
  } while (token);
  return chaves.sort();
}

export async function linkTemporario(s3, bucket, chave, segundos) {
  // A assinatura é calculada localmente, com as credenciais do servidor: nenhum pedido à AWS.
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: chave }), { expiresIn: segundos });
}
```
</details>

### P2 · SQS com uma DLQ (≈30 min)

**Ficheiro:** `sqs.js`

Uma fila com uma fila de mensagens mortas, e um consumidor que só apaga as mensagens que processou com sucesso. Os testes enviam uma mensagem "venenosa" que falha sempre e confirmam que, ao fim das tentativas, ela está na DLQ, e que nunca bloqueou as outras.

**Sintaxe que vais praticar:** `CreateQueueCommand` com `Attributes`, `GetQueueAttributesCommand`, `JSON.stringify` dentro de um atributo, `ReceiveMessageCommand` com long polling, `DeleteMessageCommand` com o `ReceiptHandle`, valores por omissão em `const { Messages = [] } = ...`.

<details>
<summary>Pista</summary>

A DLQ tem de existir **antes** da fila principal, porque a `RedrivePolicy` da principal aponta para o ARN dela. E os atributos do SQS são sempre strings, mesmo os números: `VisibilityTimeout: "1"`.
</details>

<details>
<summary>Solução de referência</summary>

```js
import { CreateQueueCommand, DeleteMessageCommand, GetQueueAttributesCommand, ReceiveMessageCommand, SendMessageCommand } from '@aws-sdk/client-sqs';

export async function criarFilaComDlq(sqs, nome, { maxRecebimentos = 3, visibilidade = 1 } = {}) {
  const { QueueUrl: dlqUrl } = await sqs.send(new CreateQueueCommand({ QueueName: `${nome}-dlq` }));
  const { Attributes } = await sqs.send(new GetQueueAttributesCommand({ QueueUrl: dlqUrl, AttributeNames: ['QueueArn'] }));
  const { QueueUrl: filaUrl } = await sqs.send(
    new CreateQueueCommand({
      QueueName: nome,
      Attributes: {
        VisibilityTimeout: String(visibilidade),
        RedrivePolicy: JSON.stringify({ deadLetterTargetArn: Attributes.QueueArn, maxReceiveCount: String(maxRecebimentos) }),
      },
    }),
  );
  return { filaUrl, dlqUrl };
}

export async function enviar(sqs, filaUrl, evento) {
  await sqs.send(new SendMessageCommand({ QueueUrl: filaUrl, MessageBody: JSON.stringify(evento) }));
}

export async function processarLote(sqs, filaUrl, processar) {
  // Long polling: espera até 1 s por mensagens, em vez de responder logo vazio (menos pedidos pagos).
  const { Messages = [] } = await sqs.send(new ReceiveMessageCommand({ QueueUrl: filaUrl, MaxNumberOfMessages: 10, WaitTimeSeconds: 1 }));
  let processadas = 0;
  let falhadas = 0;
  for (const m of Messages) {
    try {
      await processar(JSON.parse(m.Body));
      // Só se apaga DEPOIS de processar com sucesso: é o "ack" do SQS (o mesmo do módulo 06).
      await sqs.send(new DeleteMessageCommand({ QueueUrl: filaUrl, ReceiptHandle: m.ReceiptHandle }));
      processadas++;
    } catch {
      falhadas++; // não se apaga: volta à fila depois do VisibilityTimeout, e um dia vai para a DLQ
    }
  }
  return { processadas, falhadas };
}
```
</details>

### P3 · DynamoDB (≈30 min)

**Ficheiro:** `dynamo.js`

Um desenho *single-table* (todas as notas de um utilizador na mesma partição), uma `Query` em vez de um `Scan`, uma escrita que não substitui o que já existe, e uma atualização com **bloqueio otimista**: só muda a nota se ninguém a tiver mudado desde que a leste.

**Sintaxe que vais praticar:** `PutCommand`, `QueryCommand`, `UpdateCommand` do `lib-dynamodb`, `KeyConditionExpression` com `begins_with`, `ConditionExpression`, `UpdateExpression` com `SET`, `ExpressionAttributeValues`, `ReturnValues: "ALL_NEW"`.

<details>
<summary>Pista</summary>

As condições do DynamoDB são avaliadas **no servidor**, de forma atómica, no mesmo pedido que a escrita: é isso que as torna seguras com vários clientes ao mesmo tempo (ler a versão e depois escrever, em dois pedidos, teria uma janela para outro cliente se meter no meio). Quando a condição falha, o erro tem `name === "ConditionalCheckFailedException"`.
</details>

<details>
<summary>Solução de referência</summary>

```js
import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'; // eslint-disable-line no-unused-vars

export const TABELA = 'Notas';

const chave = (utilizador, id) => ({ PK: `USER#${utilizador}`, SK: `NOTA#${id}` });
const paraNota = ({ SK, titulo, feita, versao }) => ({ id: SK.slice('NOTA#'.length), titulo, feita, versao });

export async function criarNota(ddb, { utilizador, id, titulo }) {
  try {
    await ddb.send(
      new PutCommand({
        TableName: TABELA,
        Item: { ...chave(utilizador, id), titulo, feita: false, versao: 1 },
        ConditionExpression: 'attribute_not_exists(PK)', // sem isto, o Put substituía a nota existente
      }),
    );
  } catch (e) {
    if (e.name === 'ConditionalCheckFailedException') throw new Error(`a nota ${id} já existe`);
    throw e;
  }
}

export async function notasDe(ddb, utilizador) {
  // Uma Query lê só uma partição, já ordenada pela sort key. Um Scan leria a tabela inteira.
  const { Items = [] } = await ddb.send(
    new QueryCommand({
      TableName: TABELA,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefixo)',
      ExpressionAttributeValues: { ':pk': `USER#${utilizador}`, ':prefixo': 'NOTA#' },
    }),
  );
  return Items.map(paraNota);
}

export async function marcarFeita(ddb, utilizador, id, versaoEsperada) {
  try {
    const { Attributes } = await ddb.send(
      new UpdateCommand({
        TableName: TABELA,
        Key: chave(utilizador, id),
        UpdateExpression: 'SET feita = :sim, versao = versao + :um',
        // Se a nota não existir, "versao" não existe e a condição falha: também é um conflito.
        ConditionExpression: 'versao = :esperada',
        ExpressionAttributeValues: { ':sim': true, ':um': 1, ':esperada': versaoEsperada },
        ReturnValues: 'ALL_NEW',
      }),
    );
    return paraNota(Attributes);
  } catch (e) {
    if (e.name === 'ConditionalCheckFailedException') throw new Error(`conflito: a nota ${id} mudou (ou não existe)`);
    throw e;
  }
}
```
</details>

### P4 · Uma política IAM de menor privilégio (≈20 min)

**Ficheiro:** `politica.json`

O pedido está no comentário do início de `politica.test.js`: a API de notas precisa de ler e escrever uploads, listar só esse prefixo, publicar numa fila e mexer numa tabela, e de **mais nada**. Os testes verificam o que tem de ser permitido e uma lista do que não pode ser, incluindo listar o bucket inteiro, fazer `Scan`, e apagar.

**Sintaxe que vais praticar:** a estrutura de uma política (`Version`, `Statement`, `Sid`, `Effect`, `Action`, `Resource`, `Condition`), ARNs, wildcards em recursos, uma condição `StringLike`.

<details>
<summary>Pista</summary>

O `s3:ListBucket` é uma ação sobre o **bucket** (`arn:aws:s3:::notas-uploads`), e não sobre os objetos (`.../notas-uploads/*`): por isso vai numa instrução à parte, com a sua própria `Condition`. Os ARNs do SQS e do DynamoDB têm a região e o número da conta.
</details>

<details>
<summary>Solução de referência</summary>

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "LerEEscreverUploads",
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject"],
      "Resource": "arn:aws:s3:::notas-uploads/uploads/*"
    },
    {
      "Sid": "ListarSoOsUploads",
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::notas-uploads",
      "Condition": { "StringLike": { "s3:prefix": ["uploads/*"] } }
    },
    {
      "Sid": "PublicarEventos",
      "Effect": "Allow",
      "Action": "sqs:SendMessage",
      "Resource": "arn:aws:sqs:eu-west-1:123456789012:notas-eventos"
    },
    {
      "Sid": "TabelaDeNotas",
      "Effect": "Allow",
      "Action": ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:Query"],
      "Resource": "arn:aws:dynamodb:eu-west-1:123456789012:table/Notas"
    }
  ]
}
```
</details>

## Experiências

Com um LocalStack teu a correr (o comando está na secção 11) e a [CLI da AWS](https://aws.amazon.com/cli/) instalada (com credenciais quaisquer: `aws configure`, chave `test`, segredo `test`, região `eu-west-1`).

1. **A CLI:** `aws --endpoint-url http://localhost:4566 s3 mb s3://experiencia`, depois copia um ficheiro (`s3 cp`) e lista (`s3 ls`). Gera um link: `aws --endpoint-url http://localhost:4566 s3 presign s3://experiencia/ficheiro --expires-in 30`. Abre-o no browser, espera 30 segundos, e volta a abrir.
2. **O visibility timeout a funcionar:** cria uma fila com `VisibilityTimeout` de 10 segundos, envia uma mensagem e recebe-a (`aws sqs receive-message`). Recebe outra vez logo a seguir: vem vazio. Espera 10 segundos e repete.
3. **Scan vs Query:** na tabela do P3, com 1 000 itens de 10 utilizadores, mede o `ConsumedCapacity` (`ReturnConsumedCapacity: "TOTAL"`) de um `Scan` com filtro por utilizador, e de uma `Query` à partição dele. Na AWS a sério, é essa capacidade que pagas.
4. **Terraform contra o LocalStack:** o provider `aws` do Terraform (módulo 33) aceita `endpoints { s3 = "http://localhost:4566" }` e `skip_credentials_validation = true`. Cria o bucket e a fila do P2 em Terraform. (A ferramenta `tflocal` faz esta configuração por ti.)

## Perguntas de pensamento crítico

1. Um programador mete a chave de acesso da AWS no `.env` do servidor de produção, "porque é mais simples". Que alternativa propões, e porque é melhor?
2. Porque é que a base de dados deve estar numa sub-rede sem acesso à Internet, se já tem uma password forte?
3. Uma startup com 3 programadores e 500 utilizadores pergunta se deve usar EKS, ECS ou Lambda para a API. O que lhes dizes?

<details>
<summary>Respostas</summary>

1. Um papel IAM associado ao serviço (à tarefa ECS, à máquina EC2 ou à Lambda): o SDK obtém credenciais temporárias sozinho, que expiram e são renovadas automaticamente, sem nada guardado em ficheiros. Uma chave de longa duração num `.env` pode ser copiada (por um colega, por um backup, por um atacante com acesso ao servidor) e funciona até alguém se lembrar de a revogar, de qualquer sítio do mundo.
2. Defesa em profundidade: uma password pode fugir (num log, num repositório, num portátil roubado), e uma base de dados exposta à Internet é atacada por força bruta e por falhas de segurança do próprio Postgres antes de haver um patch. Numa sub-rede privada, com um security group que só aceita a API, mesmo uma password roubada não chega para lá chegar de fora.
3. Que o EKS é exagero: um cluster Kubernetes para operar, com custo fixo, para um problema que não têm. Entre ECS Fargate e Lambda, depende do tráfego e do código: para uma API em contentores com tráfego razoavelmente constante, o ECS Fargate é o mais simples (dão a imagem Docker que já têm); a Lambda brilha com tráfego muito irregular ou com tarefas por evento. Em qualquer caso, com uma base de dados gerida (RDS), e tudo em Terraform desde o início.
</details>

<!-- quiz:start -->

## Quiz rápido (autoavaliação)

Perguntas específicas deste módulo. Responde primeiro sem espiar a resposta. Versão interativa e corrigida automaticamente: `node scripts/quiz.mjs 35`.

**1.** No modelo de responsabilidade partilhada da AWS, de quem é a culpa de um bucket S3 público com dados de clientes?

- a) Da AWS
- b) Do cliente: a segurança NA cloud (configuração, acessos) é responsabilidade dele
- c) De ninguém
- d) Do fornecedor de Internet

<details><summary>Resposta</summary>

**b) Do cliente: a segurança NA cloud (configuração, acessos) é responsabilidade dele** — A AWS protege a infraestrutura; quem configura os recursos protege o que lá põe.

</details>

**2.** Como deve uma API na AWS obter credenciais para falar com o S3?

- a) Uma chave de acesso no código
- b) Uma chave de acesso num .env
- c) Um papel IAM associado ao serviço: o SDK obtém credenciais temporárias sozinho
- d) A password da conta root

<details><summary>Resposta</summary>

**c) Um papel IAM associado ao serviço: o SDK obtém credenciais temporárias sozinho** — Credenciais de curta duração, renovadas automaticamente, sem nada guardado em ficheiros.

</details>

**3.** No SQS, o que acontece a uma mensagem recebida que o consumidor não apaga?

- a) Desaparece
- b) Fica invisível durante o visibility timeout e depois volta à fila; ao fim de N tentativas vai para a DLQ
- c) É reenviada imediatamente
- d) Fica bloqueada para sempre

<details><summary>Resposta</summary>

**b) Fica invisível durante o visibility timeout e depois volta à fila; ao fim de N tentativas vai para a DLQ** — É o equivalente ao nack do RabbitMQ; por isso só se apaga depois de processar com sucesso.

</details>

**4.** Que tipo de URL dá a um browser acesso temporário a um ficheiro privado do S3, sem credenciais?

<details><summary>Resposta</summary>

**pré-assinado** — A assinatura vai nos parâmetros do URL e expira ao fim do tempo pedido.

</details>

**5.** No DynamoDB, porque se prefere uma Query a um Scan?

- a) A Query devolve mais dados
- b) A Query lê só uma partição; o Scan lê a tabela inteira (lento e caro numa tabela grande)
- c) O Scan não existe
- d) A Query não tem custos

<details><summary>Resposta</summary>

**b) A Query lê só uma partição; o Scan lê a tabela inteira (lento e caro numa tabela grande)** — No DynamoDB modela-se pelas consultas: a chave de partição é escolhida para que cada consulta seja uma Query.

</details>

<!-- quiz:end -->
