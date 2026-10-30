# 33 · Infraestrutura como código com Terraform

**Objetivo:** perceber porque é que as empresas descrevem servidores, redes e bases de dados em ficheiros de texto em vez de os criarem à mão, e saber escrever, planear e aplicar configurações Terraform: providers, recursos, variáveis, outputs, `for_each`, módulos e, sobretudo, o **estado**.

**Ficheiros para ler:** nenhum do projeto ainda (o workshop corre em Docker Compose, sem cloud). Os exemplos deste módulo criam recursos **reais** no teu Docker, com o provider `kreuzwerker/docker`, para não precisares de uma conta na AWS nem de cartão de crédito.

**Pré-requisitos:** módulo 02 (Docker). O módulo 32 (Kubernetes) ajuda, porque a ideia de "estado desejado" é a mesma.

---

## 1. O problema: infraestrutura feita à mão

Imagina que a empresa precisa de um ambiente novo para um cliente: uma rede, duas máquinas, uma base de dados, um balanceador e as regras de firewall. Alguém abre a consola da cloud e clica durante uma tarde. Seis meses depois:

- ninguém sabe exatamente o que foi criado, nem porquê;
- o ambiente de testes é "quase igual" ao de produção, mas não totalmente, e um bug só aparece em produção;
- um colega mudou uma regra de firewall "só para testar" e não a desfez;
- recriar tudo depois de um desastre demora dias, porque os passos estavam na cabeça de quem saiu da empresa.

A isto chama-se, com alguma ironia, **ClickOps**. A **infraestrutura como código** (IaC) resolve-o da mesma forma que o Git resolveu o código: a infraestrutura passa a estar descrita em ficheiros de texto, que vão para o Git, são revistos em Pull Requests, e são aplicados por uma ferramenta, sempre da mesma maneira.

## 2. Declarativo, não imperativo

Um script de shell é **imperativo**: "cria a rede; cria o contentor; liga-o à rede". Se o correres duas vezes, tenta criar tudo outra vez e falha (ou, pior, cria duplicados).

O Terraform é **declarativo**: descreves **o resultado que queres**, e ele calcula os passos para lá chegar a partir do que já existe:

```hcl
resource "docker_network" "rede" {
  name = "tf-pratica-rede"
}
```

Isto não diz "cria uma rede". Diz "**deve existir** uma rede com este nome". Se já existir, o Terraform não faz nada. Se não existir, cria-a. Se apagares o bloco do ficheiro, ele apaga a rede. É a mesma ideia de estado desejado e reconciliação do Kubernetes (módulo 32, secção 2), só que corrida por ti, à mão ou no CI, em vez de em ciclo permanente.

## 3. O ecossistema: Terraform, OpenTofu e os outros

| Ferramenta | Notas |
|---|---|
| **Terraform** (HashiCorp, agora da IBM) | O padrão de facto. Linguagem HCL. Em 2023 mudou para uma licença não totalmente livre (BSL). |
| **OpenTofu** | Fork do Terraform, mantido pela Linux Foundation, de licença livre. Compatível: o comando é `tofu` em vez de `terraform`, e o resto deste módulo aplica-se igual. |
| **Pulumi** | A mesma ideia, mas escreves em TypeScript, Python, Go ou C# em vez de HCL. |
| **CloudFormation** (AWS), **Bicep** (Azure) | Ferramentas de cada cloud, só servem para essa cloud. |
| **Ansible** | Pode criar infraestrutura, mas brilha noutra coisa: **configurar** máquinas que já existem. É o módulo 34. |

A divisão mais comum numa empresa: o **Terraform cria** as máquinas, redes e bases de dados (o "hardware"); o **Ansible**, uma imagem Docker ou o Kubernetes tratam do que corre **dentro** delas.

## 4. As peças de uma configuração

```hcl
terraform {
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"   # quem publica o provider no registry
      version = "~> 3.6"               # aceita 3.6, 3.7, 3.9..., mas não 4.0
    }
  }
}

provider "docker" {}                   # configuração do provider (vazio = valores por omissão)

variable "porta" {                     # uma ENTRADA, que podes mudar sem tocar no código
  type    = number
  default = 8091
}

locals {                               # valores calculados, para não repetires expressões
  nome = "tf-${var.porta}"
}

resource "docker_container" "web" {    # um objeto que o Terraform CRIA e GERE
  name  = local.nome
  image = docker_image.nginx.image_id  # referência a outro recurso (cria uma dependência)
}

data "docker_network" "bridge" {       # um objeto que já existe e que o Terraform só LÊ
  name = "bridge"
}

output "url" {                         # uma SAÍDA, mostrada no fim e legível por outros
  value = "http://127.0.0.1:${var.porta}"
}
```

| Bloco | Para que serve |
|---|---|
| **provider** | O plugin que sabe falar com uma API: AWS, Azure, Google Cloud, Docker, Kubernetes, GitHub, Cloudflare... Há milhares no [registry](https://registry.terraform.io). |
| **resource** | Algo que o Terraform cria, atualiza e apaga. O nome completo é `tipo.nome` (ex.: `docker_container.web`). |
| **data** | Algo que existe fora do Terraform e que ele só lê (ex.: a imagem mais recente de Ubuntu na AWS). |
| **variable** | Uma entrada. Valores por `-var`, por ficheiro `.tfvars` ou por variável de ambiente `TF_VAR_porta`. |
| **locals** | Valores intermédios, só visíveis dentro da configuração. |
| **output** | Uma saída: o IP de uma máquina, o URL de um site. |
| **module** | Um conjunto de recursos reutilizável (secção 8). |

O Terraform lê **todos** os ficheiros `.tf` da pasta como se fossem um só. A divisão em `main.tf`, `variables.tf` e `outputs.tf` é só convenção, mas é a que vais encontrar em todo o lado.

## 5. O ciclo de trabalho

```bash
terraform init       # descarrega os providers para .terraform/ e cria o .terraform.lock.hcl
terraform fmt        # formata os ficheiros (2 espaços, = alinhados): sem discussões de estilo
terraform validate   # erros de sintaxe e de tipos, sem falar com nenhuma API
terraform plan       # o que VAI acontecer, sem fazer nada
terraform apply      # mostra o plano, pede confirmação, e executa
terraform destroy    # apaga tudo o que esta configuração criou
```

O `plan` é o passo mais importante, e é o que se revê num Pull Request. Os símbolos:

```
  + create                       # vai ser criado
  ~ update in-place              # vai ser alterado sem ser recriado
  - destroy                      # vai ser apagado
-/+ destroy and then create      # vai ser RECRIADO: o atributo que mudou não pode ser alterado no sítio
```

O `-/+` merece atenção redobrada. Numa base de dados, "recriar" quer dizer **apagar os dados**. O plano mostra que atributo força a recriação (`# forces replacement`). Lê sempre o plano antes de dizeres "yes".

O `.terraform.lock.hcl` é o `package-lock.json` dos providers: fixa as versões exatas e os seus checksums, e **vai para o Git**. A pasta `.terraform/`, com os binários descarregados, não vai.

## 6. O estado: a peça que mais confunde (e mais importa)

Como é que o Terraform sabe que a rede `tf-pratica-rede` foi criada **por ele**, e não por outra pessoa? Guarda um ficheiro, `terraform.tfstate`, com o mapa entre o código e o mundo real:

```
docker_network.rede   →  id = 56005befe39c...
docker_container.web  →  id = 8b1f...,  ports = [...],  ...
```

Em cada `plan`, o Terraform compara **três** coisas: o código (o que queres), o estado (o que ele acha que criou) e a API real (o que existe mesmo). Daí saem três regras que aparecem em todas as entrevistas:

1. **O estado nunca vai para o Git.** Contém, em texto simples, todos os atributos dos recursos, incluindo passwords de bases de dados e chaves geradas. O `.gitignore` deste projeto já exclui `*.tfstate`.
2. **Numa equipa, o estado vive num backend remoto**, partilhado por todos e pelo CI:
   ```hcl
   terraform {
     backend "s3" {
       bucket       = "empresa-terraform-state"
       key          = "notas/producao.tfstate"
       region       = "eu-west-1"
       encrypt      = true
       use_lockfile = true   # bloqueio: dois "apply" ao mesmo tempo corromperiam o estado
     }
   }
   ```
   As versões mais antigas do Terraform faziam o bloqueio com uma tabela do DynamoDB, e vais ver isso em muitos projetos. Outras opções são o Terraform Cloud/HCP, Azure Storage ou Google Cloud Storage.
3. **Nunca se mexe na infraestrutura à mão.** Se alguém mudar uma regra na consola, o código e a realidade divergem (*drift*). O próximo `plan` mostra a diferença e o `apply` desfaz a alteração manual. Às vezes é isso que queres; às vezes é a correção urgente de ontem a ser apagada.

Comandos de estado que vais usar:

```bash
terraform state list                         # o que o Terraform está a gerir
terraform state show docker_container.web    # os atributos guardados de um recurso
terraform import docker_network.rede <id>    # passa a gerir algo criado à mão (ou um bloco import {})
terraform apply -replace=docker_container.web   # força a recriação de um recurso
```

Para mudar o nome de um recurso no código sem o recriar, usa-se um bloco `moved`:

```hcl
moved {
  from = docker_container.web
  to   = docker_container.site
}
```

Sem isto, o Terraform veria "o `web` desapareceu do código, e apareceu um `site` novo": apagava um e criava o outro.

## 7. Dependências e o grafo

O Terraform não corre os blocos pela ordem do ficheiro. Constrói um **grafo de dependências** a partir das referências, e cria em paralelo tudo o que não depende de nada:

```hcl
resource "docker_container" "redis" {
  image = docker_image.redis.image_id        # depende da imagem
  networks_advanced {
    name = docker_network.rede.name           # e da rede
  }
}
```

Primeiro cria a imagem e a rede (as duas em paralelo), depois o contentor. No `destroy`, faz o inverso. Podes ver o grafo com `terraform graph`.

Quando a dependência existe mas não aparece numa referência (ex.: uma app que precisa que uma permissão exista), declara-se com `depends_on = [recurso]`. É raro, e normalmente é sinal de que falta uma referência.

## 8. `count`, `for_each` e expressões

Para criar vários recursos iguais, há duas formas:

```hcl
resource "local_file" "config" {
  for_each = { api = 3000, worker = 3001 }      # um por chave
  filename = "gerado/${each.key}.env"
  content  = "PORT=${each.value}\n"
}
# endereços: local_file.config["api"], local_file.config["worker"]
```

```hcl
resource "local_file" "config" {
  count    = 2                                 # um por índice
  filename = "gerado/servico-${count.index}.env"
}
# endereços: local_file.config[0], local_file.config[1]
```

Prefere **`for_each`**. Com `count`, os recursos são identificados pela posição. Se tiveres `["a", "b", "c"]` e tirares o `"a"`, o `b` passa para a posição 0 e o `c` para a 1: o Terraform vê "o 0 mudou, o 1 mudou, o 2 desapareceu", e recria dois recursos que não precisavam de ser tocados. Com `for_each`, cada recurso é identificado pela chave, e tirar o `"a"` apaga só o `"a"`.

Expressões que vais usar a toda a hora:

```hcl
"${var.ambiente}-api"                          # interpolação
var.ambiente == "prod" ? 3 : 1                 # condicional
[for s in var.servicos : upper(s)]             # lista a partir de outra
{ for k, v in var.servicos : k => v + 1000 }   # map a partir de outro
contains(["dev", "prod"], var.ambiente)        # funções: contains, length, sort, basename, ...
```

Para experimentar expressões sem criar nada: `terraform console`.

## 9. Módulos

Um **módulo** é só uma pasta com ficheiros `.tf`, que outra configuração usa como se fosse um recurso:

```hcl
module "site" {
  source   = "./modulos/site"   # ou do registry: "terraform-aws-modules/vpc/aws"
  for_each = var.sites

  nome  = "tf-pratica-${each.key}"   # as variables do módulo são os seus "parâmetros"
  porta = each.value.porta
}

output "urls" {
  value = { for k, s in module.site : k => s.url }   # os outputs do módulo são o seu "return"
}
```

Com módulos, a equipa de plataforma escreve uma vez "uma base de dados como a empresa gosta" (cifrada, com backups, nas sub-redes certas), e as equipas de produto usam-na com três linhas. É o mesmo princípio de uma função: entradas, saídas e o interior escondido.

Uma armadilha que o P3 te mostra: cada módulo declara os providers de que precisa. Se o módulo usar recursos `docker_*` sem um bloco `required_providers`, o Terraform assume que "docker" é o `hashicorp/docker`, que não existe:

```
hashicorp/docker: provider registry registry.terraform.io does not have a
provider named registry.terraform.io/hashicorp/docker
```

## 10. Ambientes: dev, staging e produção

Três padrões, por ordem de popularidade em empresas:

1. **Uma pasta por ambiente**, que chama os mesmos módulos com valores diferentes (`envs/dev/main.tf`, `envs/prod/main.tf`). Cada uma tem o seu estado. É o mais explícito e o mais seguro.
2. **Um ficheiro de variáveis por ambiente**: `terraform apply -var-file=prod.tfvars`, com um backend diferente para cada um.
3. **Workspaces** (`terraform workspace new prod`): o mesmo código com estados separados. Prático, mas é fácil aplicares em produção quando achavas que estavas em dev.

## 11. Como é na cloud (lido, não corrido)

Com o provider da AWS, uma máquina numa rede própria parece-se com isto. Não o corras sem perceber os custos: cada um destes recursos é cobrado.

```hcl
provider "aws" {
  region = "eu-west-1"   # Irlanda
}

resource "aws_s3_bucket" "uploads" {
  bucket = "notas-uploads-producao"
}

resource "aws_instance" "api" {
  ami           = data.aws_ami.ubuntu.id
  instance_type = "t3.small"
  subnet_id     = aws_subnet.privada.id
  tags          = { Name = "notas-api", Ambiente = "producao" }
}
```

As credenciais **nunca** ficam no código. Na tua máquina vêm do `aws configure` (ou de SSO). No CI, vêm de OIDC, com um papel de curta duração: é a mesma ideia do `id-token: write` do módulo 20, secção 10.

## 12. Boas práticas que te vão pedir

- **Fixar versões:** do Terraform (`required_version = ">= 1.10"`) e dos providers (`~> 3.6`). Uma versão nova de um provider pode mudar comportamentos.
- **O `plan` no Pull Request:** o CI corre `terraform plan` e comenta o resultado no PR; o `apply` só acontece depois do merge. Ferramentas: Atlantis, HCP Terraform, ou um workflow do GitHub Actions.
- **Análise estática:** `tflint`, `trivy config` ou `checkov` apanham buckets públicos, portas abertas ao mundo e discos sem cifra antes do `apply`.
- **Proteger o que não pode morrer:**
  ```hcl
  lifecycle {
    prevent_destroy = true   # o plan falha se tentar apagar este recurso
  }
  ```
- **Ambientes pequenos e estados pequenos:** um estado gigante com tudo da empresa torna cada `plan` lento e cada erro perigoso. Separa por sistema e por ambiente.

---

## Prática: escreve tu

Três configurações Terraform que criam coisas **reais**: ficheiros no teu disco (P1) e contentores, redes e volumes no teu Docker (P2 e P3). Os testes correm o Terraform a sério: `fmt -check`, `validate`, `plan`, `apply`, um segundo `plan` (que tem de dizer "No changes") e, no fim, `destroy`. Depois inspecionam o resultado com o `docker inspect` e pedidos HTTP.

**Ficheiros:** `pratica/33-terraform/` (`p1-ficheiros/main.tf`, `p2-docker/main.tf`, `p3-modulo/main.tf` e `p3-modulo/modulos/site/*.tf`)

**Verificar:** `npm run verificar 33` (dentro de `pratica/`). Só um exercício: `npm run verificar 33 p1`, `... 33 p2` ou `... 33 p3`. O P2 e o P3 precisam do Docker a correr.

**O Terraform:** se o tiveres instalado, os testes usam o teu. Se não, a primeira execução descarrega o binário oficial 1.14.0 para `pratica/.ferramentas/`, verificando o checksum. Para o usares à mão: `../.ferramentas/terraform-1.14.0 plan` (dentro da pasta de um exercício). Se preferires instalá-lo, segue as [instruções oficiais](https://developer.hashicorp.com/terraform/install).

Corre `terraform fmt` antes dos testes: o primeiro teste de cada exercício verifica a formatação, como um CI de uma empresa faria.

Se nunca usaste a prática, lê primeiro a introdução no [módulo 01](01-fundamentos.md#prática-escreve-tu).

### P1 · Variáveis, `for_each` e outputs (≈30 min)

**Ficheiro:** `p1-ficheiros/main.tf`

Com o provider `hashicorp/local`, que cria ficheiros no disco, escreve um ficheiro `.env` por serviço. As regras estão no comentário do ficheiro. Os testes também mudam as variáveis (`-var 'servicos={ api = 4000 }' -var ambiente=prod`) e confirmam que o Terraform apaga o ficheiro que deixou de existir e altera o outro.

**Sintaxe que vais praticar:** `terraform { required_providers }`, `variable` com `type`, `default` e `validation`, `locals`, `resource` com `for_each`, `each.key`/`each.value`, interpolação `"${...}"`, `path.module`, expressão `for`, funções `sort`, `basename` e `contains`, `output`.

<details>
<summary>Pista</summary>

Um bloco `validation` vive **dentro** do `variable` e tem duas partes: `condition` (uma expressão que tem de ser verdadeira) e `error_message`. Para o output, percorre o recurso como se fosse um map: `[for f in local_file.config : ...]`, e cada `f` tem o atributo `filename`.
</details>

<details>
<summary>Solução de referência</summary>

```hcl
terraform {
  required_providers {
    local = {
      source  = "hashicorp/local"
      version = "~> 2.5"
    }
  }
}

variable "ambiente" {
  type        = string
  default     = "dev"
  description = "Onde vai correr: dev ou prod."

  validation {
    condition     = contains(["dev", "prod"], var.ambiente)
    error_message = "O ambiente tem de ser \"dev\" ou \"prod\"."
  }
}

variable "servicos" {
  type        = map(number)
  default     = { api = 3000, worker = 3001 }
  description = "Nome do serviço → porta."
}

locals {
  prefixo = "${var.ambiente}-"
}

# Um ficheiro por entrada do map. each.key é o nome do serviço, each.value é a porta.
resource "local_file" "config" {
  for_each = var.servicos

  filename = "${path.module}/gerado/${local.prefixo}${each.key}.env"
  content  = "PORT=${each.value}\nAMBIENTE=${var.ambiente}\n"
}

output "ficheiros" {
  value = sort([for f in local_file.config : basename(f.filename)])
}
```
</details>

### P2 · Rede, volume e contentores no Docker (≈40 min)

**Ficheiro:** `p2-docker/main.tf`

O equivalente, em Terraform, a um pequeno `compose.yaml`: uma rede, um volume, um Redis sem portas publicadas e um Nginx publicado só em `127.0.0.1:8091`. Compara com o compose que escreveste no P2 do módulo 02.

**Sintaxe que vais praticar:** provider de terceiros (`kreuzwerker/docker`), referências entre recursos (`docker_image.redis.image_id`, `docker_network.rede.name`), blocos encaixados (`networks_advanced`, `volumes`, `ports`, `upload`), `keep_locally`.

<details>
<summary>Pista</summary>

Os nomes dos atributos estão na [documentação do provider](https://registry.terraform.io/providers/kreuzwerker/docker/latest/docs/resources/container): procura `networks_advanced`, `volumes`, `ports` e `upload`. Usa as **referências** (`docker_network.rede.name`) em vez de repetires o nome em texto: é isso que diz ao Terraform a ordem por que tem de criar as coisas.
</details>

<details>
<summary>Solução de referência</summary>

```hcl
terraform {
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.6"
    }
  }
}

# Vazio: usa o mesmo Docker que o comando docker (a variável DOCKER_HOST, ou o socket por omissão).
provider "docker" {}

variable "prefixo" {
  type    = string
  default = "tf-pratica"
}

variable "porta" {
  type    = number
  default = 8091
}

resource "docker_network" "rede" {
  name = "${var.prefixo}-rede"
}

resource "docker_volume" "dados" {
  name = "${var.prefixo}-redis-dados"
}

resource "docker_image" "redis" {
  name         = "redis:7-alpine"
  keep_locally = true # o destroy não apaga a imagem do teu Docker
}

resource "docker_image" "nginx" {
  name         = "nginx:1.27-alpine"
  keep_locally = true
}

resource "docker_container" "redis" {
  name  = "${var.prefixo}-redis"
  image = docker_image.redis.image_id # esta referência cria a dependência: a imagem vem primeiro

  networks_advanced {
    name = docker_network.rede.name
  }

  volumes {
    volume_name    = docker_volume.dados.name
    container_path = "/data"
  }
  # sem bloco ports: o redis só é visível dentro da rede
}

resource "docker_container" "web" {
  name  = "${var.prefixo}-web"
  image = docker_image.nginx.image_id

  networks_advanced {
    name = docker_network.rede.name
  }

  ports {
    internal = 80
    external = var.porta
    ip       = "127.0.0.1"
  }

  upload {
    content = "<h1>Feito com Terraform</h1>\n"
    file    = "/usr/share/nginx/html/index.html"
  }
}

output "url" {
  value = "http://127.0.0.1:${var.porta}"
}
```
</details>

### P3 · Um módulo reutilizado (≈40 min)

**Ficheiros:** `p3-modulo/main.tf` e `p3-modulo/modulos/site/` (`main.tf`, `variables.tf`, `outputs.tf`)

Escreve um módulo `site` (um Nginx com uma mensagem) e usa-o duas vezes, com `for_each`, a partir da raiz. O módulo valida a porta; a raiz junta os URLs de todos os sites num único output.

**Sintaxe que vais praticar:** `module` com `source` e `for_each`, `type = map(object({...}))`, variáveis e outputs de um módulo, `module.site[...]`, expressão `for` sobre módulos, `terraform fmt -recursive`.

<details>
<summary>Pista</summary>

Pensa no módulo como uma função: as `variable` são os parâmetros, os `output` são o valor de retorno. Na raiz, `module.site` é um map (porque usaste `for_each`), e cada elemento tem os outputs do módulo como atributos: `module.site["azul"].url`. Lembra-te do aviso da secção 9 sobre o `required_providers` dentro do módulo.
</details>

<details>
<summary>Solução de referência</summary>

`p3-modulo/main.tf`:

```hcl
terraform {
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.6"
    }
  }
}

provider "docker" {}

variable "sites" {
  type = map(object({
    porta    = number
    mensagem = string
  }))
  default = {
    azul  = { porta = 8092, mensagem = "Site azul" }
    verde = { porta = 8093, mensagem = "Site verde" }
  }
}

# Uma instância do módulo por entrada do map: module.site["azul"], module.site["verde"].
module "site" {
  source   = "./modulos/site"
  for_each = var.sites

  nome     = "tf-pratica-${each.key}"
  porta    = each.value.porta
  mensagem = each.value.mensagem
}

output "urls" {
  value = { for chave, site in module.site : chave => site.url }
}
```

`p3-modulo/modulos/site/main.tf`:

```hcl
# Cada módulo declara os providers de que precisa. Sem isto, "docker" seria lido como hashicorp/docker.
terraform {
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.6"
    }
  }
}

resource "docker_image" "nginx" {
  name         = "nginx:1.27-alpine"
  keep_locally = true
}

resource "docker_container" "site" {
  name  = var.nome
  image = docker_image.nginx.image_id

  ports {
    internal = 80
    external = var.porta
    ip       = "127.0.0.1"
  }

  upload {
    content = "<h1>${var.mensagem}</h1>\n"
    file    = "/usr/share/nginx/html/index.html"
  }
}
```

`p3-modulo/modulos/site/variables.tf`:

```hcl
variable "nome" {
  type        = string
  description = "Nome do contentor."
}

variable "porta" {
  type        = number
  description = "Porta em 127.0.0.1 onde o site fica acessível."

  validation {
    condition     = var.porta >= 1024 && var.porta <= 65535
    error_message = "A porta tem de estar entre 1024 e 65535 (abaixo de 1024 são portas de sistema)."
  }
}

variable "mensagem" {
  type        = string
  description = "Texto da página."
}
```

`p3-modulo/modulos/site/outputs.tf`:

```hcl
output "url" {
  value = "http://127.0.0.1:${var.porta}"
}
```
</details>

## Experiências

Faz-as na pasta do P2, com o teu `main.tf` já a passar nos testes, e com o Terraform à mão (`../.ferramentas/terraform-1.14.0`, ou `terraform` se o instalaste). No fim de cada uma, `destroy`.

1. **Drift:** `apply`, depois apaga o contentor por fora: `docker rm -f tf-pratica-web`. Corre `plan`. O Terraform repara que o contentor desapareceu e propõe recriá-lo. Agora o contrário: deixa o contentor, e muda-lhe só a porta no `main.tf`. Repara no `-/+` e no `# forces replacement`: um contentor não pode mudar de porta sem ser recriado.
2. **Lê o estado:** abre o `terraform.tfstate` num editor (é JSON) e procura o contentor do Redis. Tudo o que o provider sabe sobre ele está lá, em texto simples. Imagina que um dos atributos era a password de uma base de dados: é por isto que o estado nunca vai para o Git.
3. **`count` vs `for_each`:** no P1, troca o `for_each` por `count = length(var.lista)` com uma lista `["api", "worker", "admin"]`. Aplica, e depois tira o `"api"` da lista. Lê o plano: quantos ficheiros vão ser alterados? Volta ao `for_each` e repete.
4. **O grafo:** `terraform graph | grep -- '->'` mostra as dependências que o Terraform deduziu das tuas referências. Encontra a seta do contentor `redis` para a rede.

## Perguntas de pensamento crítico

1. Um colega corrige um problema em produção mudando uma regra de firewall diretamente na consola da AWS, às 3 da manhã. Na semana seguinte, outro colega faz `terraform apply` para uma alteração sem relação nenhuma. O que acontece à correção? Como se evita?
2. Porque é que o ficheiro de estado tem de ser partilhado e bloqueado numa equipa, e o que pode acontecer se duas pessoas fizerem `apply` ao mesmo tempo com estados locais?
3. Terraform e Ansible conseguem ambos criar uma máquina virtual e instalar lá o Nginx. Porque é que as empresas costumam usar o Terraform para a primeira parte e outra ferramenta para a segunda?

<details>
<summary>Respostas</summary>

1. O `apply` compara o código com a realidade, vê a regra diferente, e repõe a versão do código: a correção desaparece sem ninguém reparar. Evita-se com duas regras de equipa: alterações só pelo código (mesmo as urgentes, num PR rápido), e um `plan` periódico no CI que alerta quando há *drift*, para que a diferença seja vista antes de alguém a apagar sem querer.
2. Porque o estado é a memória do Terraform sobre o que existe. Com estados locais, cada pessoa tem uma memória diferente: uma pode criar recursos duplicados, ou apagar coisas que a outra criou porque "não estão no seu estado". Sem bloqueio, dois `apply` ao mesmo tempo sobre o mesmo estado podem corrompê-lo. Um backend remoto com bloqueio garante uma só memória, e uma pessoa (ou um job de CI) de cada vez.
3. Porque são bons em coisas diferentes. O Terraform é declarativo e tem estado: sabe criar, alterar e apagar recursos de uma API, e calcula a diferença. Configurar o interior de uma máquina (pacotes, ficheiros, serviços) é uma sequência de passos sobre um sistema operativo, que o Ansible (ou uma imagem Docker já construída) faz melhor. Na prática, com contentores e Kubernetes, a "segunda parte" é cada vez mais uma imagem, e o Ansible fica para as máquinas que ainda são geridas como servidores.
</details>

<!-- quiz:start -->

## Quiz rápido (autoavaliação)

Perguntas específicas deste módulo. Responde primeiro sem espiar a resposta. Versão interativa e corrigida automaticamente: `node scripts/quiz.mjs 33`.

**1.** Porque é que o ficheiro terraform.tfstate nunca vai para o Git?

- a) Porque é muito grande
- b) Porque contém, em texto simples, os atributos dos recursos, incluindo passwords e chaves
- c) Porque o Terraform o apaga no fim de cada apply
- d) Porque o Git não aceita ficheiros JSON

<details><summary>Resposta</summary>

**b) Porque contém, em texto simples, os atributos dos recursos, incluindo passwords e chaves** — O estado é a memória do Terraform sobre o mundo real, com tudo o que o provider sabe. Numa equipa, vive num backend remoto, cifrado e com bloqueio.

</details>

**2.** No output de um terraform plan, o que significa -/+ ?

- a) O recurso vai ser alterado no sítio
- b) O recurso vai ser apagado e criado de novo, porque o atributo que mudou não pode ser alterado no sítio
- c) O recurso já não existe e vai ser ignorado
- d) O plano falhou

<details><summary>Resposta</summary>

**b) O recurso vai ser apagado e criado de novo, porque o atributo que mudou não pode ser alterado no sítio** — Lê sempre o '# forces replacement': numa base de dados, recriar quer dizer perder os dados.

</details>

**3.** Porque se prefere for_each a count para criar vários recursos parecidos?

- a) O count não existe nas versões recentes
- b) Com count, os recursos são identificados pela posição: tirar um do meio da lista desloca os outros e recria-os sem necessidade
- c) for_each é mais rápido a aplicar
- d) count não aceita variáveis

<details><summary>Resposta</summary>

**b) Com count, os recursos são identificados pela posição: tirar um do meio da lista desloca os outros e recria-os sem necessidade** — Com for_each, cada recurso é identificado por uma chave estável, e tirar um só apaga esse.

</details>

**4.** Que comando do Terraform mostra o que vai mudar, sem mudar nada?

<details><summary>Resposta</summary>

**terraform plan** — O plan é o passo que se revê num Pull Request antes do apply.

</details>

**5.** Num módulo que usa recursos docker_*, falta o bloco required_providers. O que acontece no init?

- a) Funciona igual, porque a raiz já declara o provider
- b) O Terraform assume hashicorp/docker, que não existe no registry, e o init falha
- c) O módulo é ignorado
- d) O Terraform instala a versão mais recente de todos os providers

<details><summary>Resposta</summary>

**b) O Terraform assume hashicorp/docker, que não existe no registry, e o init falha** — Cada módulo declara os providers de que precisa. Sem a fonte (kreuzwerker/docker), o nome curto é interpretado como hashicorp/<nome>.

</details>

<!-- quiz:end -->
