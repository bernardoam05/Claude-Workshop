// P1 · S3: guardar e servir ficheiros. Ver docs/35-cloud-aws.md, secção "Prática".
import { CreateBucketCommand, GetObjectCommand, HeadBucketCommand, ListObjectsV2Command, PutObjectCommand } from '@aws-sdk/client-s3'; // eslint-disable-line no-unused-vars
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'; // eslint-disable-line no-unused-vars

// garantirBucket(s3, nome): cria o bucket se ainda não existir (HeadBucket para saber; se der erro
// com $metadata.httpStatusCode 404, CreateBucket). Chamá-la duas vezes não dá erro.
export async function garantirBucket(s3, nome) {
  throw new Error('Por fazer: P1');
}

// guardar(s3, bucket, chave, conteudo, tipo): PutObject com o ContentType dado.
export async function guardar(s3, bucket, chave, conteudo, tipo) {
  throw new Error('Por fazer: P1');
}

// ler(s3, bucket, chave) → o conteúdo, como string (o Body da resposta tem .transformToString()).
// Se a chave não existir, devolve null (o erro tem name "NoSuchKey").
export async function ler(s3, bucket, chave) {
  throw new Error('Por fazer: P1');
}

// listar(s3, bucket, prefixo) → as chaves que começam pelo prefixo, ordenadas. Atenção: a resposta
// vem em páginas de no máximo MaxKeys chaves; usa MaxKeys: 2 e segue o NextContinuationToken até
// ao fim (os testes guardam 5 ficheiros, por isso precisas de pelo menos 3 pedidos).
export async function listar(s3, bucket, prefixo) {
  throw new Error('Por fazer: P1');
}

// linkTemporario(s3, bucket, chave, segundos) → um URL pré-assinado para descarregar o ficheiro
// SEM credenciais, válido durante `segundos` (getSignedUrl com um GetObjectCommand e expiresIn).
export async function linkTemporario(s3, bucket, chave, segundos) {
  throw new Error('Por fazer: P1');
}
