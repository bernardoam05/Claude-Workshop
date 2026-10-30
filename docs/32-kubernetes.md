# 32 · Kubernetes

**Objetivo:** perceber o que o Kubernetes faz que o Docker Compose não faz, ler o `config/k8s/api.yaml` deste projeto linha a linha, e saber escrever os objetos que aparecem em todas as empresas que o usam: Deployment, Service, ConfigMap, Secret, Ingress, HPA e CronJob.

**Ficheiros para ler:** `config/k8s/api.yaml`, e o `config/docker-compose.yml` ao lado, para comparar.

**Pré-requisitos:** módulo 02 (imagens, contentores, compose) e a secção de health checks do módulo 11.

---

## 1. Do Compose a um orquestrador

O `docker compose` descreve uma stack para **uma** máquina. Se essa máquina morrer, morre tudo. Se precisares de mais capacidade, só podes comprar uma máquina maior.

O Kubernetes (abreviado **K8s**: "K", oito letras, "s") gere **um conjunto de máquinas** (um *cluster*) como se fossem uma só. Tu dizes o que queres ("3 cópias da API, cada uma com 128 MiB") e ele decide **onde** as pôr, **reinicia** o que morre, **move** o que estava numa máquina que caiu, e **troca versões** sem parar o serviço.

| Problema | Docker Compose | Kubernetes |
|---|---|---|
| Uma máquina morre | a stack morre | os pods são recriados noutras máquinas |
| Mais carga | `--scale` manual, na mesma máquina | autoescala (HPA), em várias máquinas |
| Nova versão | `up -d` para e arranca | *rolling update*: troca pod a pod, sem downtime |
| Um contentor bloqueia | `restart:` só vê o processo morrer | *liveness probe* deteta que deixou de responder |
| Segredos | variáveis de ambiente no ficheiro | objeto `Secret`, com controlo de acesso |

O preço é a complexidade: um cluster tem dezenas de componentes, e uma equipa pequena com um só servidor quase nunca precisa dele. O módulo 13 (secção 6.1) discute esta decisão. Mesmo assim, em empresas médias e grandes vais encontrá-lo quase sempre, e numa entrevista esperam que conheças os conceitos.

## 2. A ideia central: estado desejado e reconciliação

No Compose, dás **ordens**: "arranca isto". No Kubernetes, **declaras o estado que queres** e há programas (os *controllers*) que, em ciclo, comparam o que existe com o que pediste e corrigem a diferença:

```
o que pediste: 3 réplicas  ─┐
                            ├─▶ controller: "faltam 2" ─▶ cria 2 pods ─▶ (e volta a comparar)
o que existe:  1 réplica   ─┘
```

Este ciclo chama-se **reconciliação**, e explica quase tudo o que o Kubernetes faz sozinho. Se apagares um pod à mão, o controller vê "pedido 3, existem 2" e cria outro. Não precisas de nenhum `restart: always`. Isto é a **autocura** (*self-healing*).

Consequência prática: **não se editam pods**. Edita-se o objeto que os cria (o Deployment) e o controller trata do resto.

## 3. As peças de um cluster

```
┌──────────── control plane ────────────┐      ┌──────────── nó (worker) ──────────┐
│ kube-apiserver  ◀── kubectl, CI, ...   │      │ kubelet      ← arranca os pods    │
│ etcd            (a BD do cluster)      │ ───▶ │ kube-proxy   ← rede dos Services  │
│ scheduler       (em que nó fica?)      │      │ containerd   ← corre contentores  │
│ controller-manager (os ciclos do §2)   │      │ [pod] [pod] [pod]                 │
└────────────────────────────────────────┘      └───────────────────────────────────┘
```

- **kube-apiserver:** a única porta de entrada. O `kubectl`, o teu CI e os próprios componentes falam todos com ele, por HTTP e JSON.
- **etcd:** uma base de dados chave-valor onde fica guardado todo o estado do cluster. Perder o etcd é perder o cluster.
- **scheduler:** escolhe o nó de cada pod novo, conforme a memória e o CPU livres.
- **kubelet:** um agente em cada nó que recebe "corre este pod" e fala com o *container runtime*.

Numa cloud (EKS na AWS, AKS na Azure, GKE na Google), o control plane é gerido pelo fornecedor e só vês os nós. Em casa, o **kind** (Kubernetes in Docker) cria um cluster inteiro dentro de contentores Docker (secção 11).

## 4. Os objetos que vais escrever

Tudo no Kubernetes é um **objeto** descrito em YAML, com sempre as mesmas quatro partes:

```yaml
apiVersion: apps/v1      # o "grupo/versão" da API onde este tipo existe
kind: Deployment         # o tipo de objeto
metadata:                # nome, namespace, labels
  name: notas
spec:                    # o ESTADO DESEJADO (o que pedes)
  ...
# status:                # o estado REAL, escrito pelo Kubernetes; nunca o escreves tu
```

| Objeto | Para que serve | Analogia no Compose |
|---|---|---|
| **Pod** | um ou mais contentores que partilham rede e disco; a unidade mínima | um contentor |
| **Deployment** | mantém N pods iguais e faz *rolling updates* | um serviço com `deploy.replicas` |
| **Service** | um nome e um IP estáveis à frente de pods que mudam | o nome do serviço na rede do compose |
| **Ingress** | encaminha HTTP de fora (por host e caminho) para Services | o Nginx do módulo 10 |
| **ConfigMap** | configuração não secreta | `environment:` |
| **Secret** | configuração secreta | `environment:` com cuidado extra |
| **Namespace** | separa grupos de objetos (equipas, ambientes) | um projeto (`-p`) do compose |
| **HorizontalPodAutoscaler** | ajusta o número de réplicas à carga | não existe |
| **Job / CronJob** | uma tarefa que termina, uma vez ou agendada | `docker compose run` + cron |
| **StatefulSet + PersistentVolumeClaim** | pods com identidade e disco próprios (bases de dados) | `volumes:` |

Quase nunca crias **Pods** diretamente. Um pod criado à mão não tem quem o recrie se morrer. Crias um Deployment, que cria um *ReplicaSet*, que cria os pods.

## 5. Labels e selectors: a cola de tudo

O Kubernetes não liga objetos por nome, liga-os por **labels**. Um Deployment sabe quais pods são seus porque procura pods com certas labels; um Service sabe para onde mandar tráfego da mesma forma:

```yaml
# Deployment
spec:
  selector:
    matchLabels:
      app: api          # "os meus pods são os que têm app=api"
  template:
    metadata:
      labels:
        app: api        # os pods que crio levam app=api
---
# Service
spec:
  selector:
    app: api            # "mando tráfego para pods com app=api"
```

O erro mais comum de quem começa: o selector do Service tem `app: notas` e os pods têm `app: nota`. Não dá erro nenhum. O Service fica simplesmente **sem endpoints** e todos os pedidos falham. O diagnóstico é:

```bash
kubectl get endpoints notas     # sem IPs na lista = o selector não apanha nenhum pod
kubectl get pods --show-labels  # compara as labels a sério com as do selector
```

No Deployment, o Kubernetes é mais rígido: se o `selector` não coincidir com as labels do `template`, o `kubectl apply` recusa o objeto.

## 6. O `config/k8s/api.yaml`, linha a linha

Abre o ficheiro ao lado. As partes que interessam:

```yaml
spec:
  replicas: 2
```

Duas cópias da API. Se uma morrer, ou estiver a ser substituída por uma versão nova, a outra continua a responder.

```yaml
image: registry.example.com/workshop-api:1.0.0   # nunca uses :latest em produção
```

Uma tag fixa. Com `:latest`, dois nós podem ter versões diferentes da "mesma" imagem, e um *rollback* não sabe para onde voltar.

```yaml
envFrom:
  - secretRef:
      name: api-secrets
```

As variáveis secretas vêm de um objeto `Secret` criado à parte (o comentário no topo do ficheiro mostra como). O manifesto vai para o Git; os segredos não.

```yaml
readinessProbe:
  httpGet:
    path: /api/health
    port: 3000
livenessProbe:
  tcpSocket:
    port: 3000
```

As duas probes respondem a perguntas diferentes, e trocá-las é um erro clássico:

| Probe | Pergunta | Se falhar | O que deve verificar |
|---|---|---|---|
| **readiness** | "posso receber tráfego agora?" | o pod sai do Service (deixa de receber pedidos), mas continua vivo | as dependências: BD, Redis |
| **liveness** | "estou bloqueado?" | o Kubernetes **mata e reinicia** o contentor | só o próprio processo, de forma barata |
| **startup** | "já acabei de arrancar?" | adia as outras duas | útil para apps lentas a arrancar (JVM) |

Porque é que a liveness **não** chama o `/api/health`? Imagina que o Postgres cai. O `/api/health` passa a responder 503. Se a liveness o usasse, o Kubernetes reiniciaria **todas** as réplicas da API, em ciclo, sem resolver nada: o problema está na BD, não na API. Com a readiness, a API apenas deixa de receber tráfego até a BD voltar. É a mesma distinção que o módulo 11 fez entre *liveness* e *readiness*.

```yaml
resources:
  requests: { cpu: 100m, memory: 128Mi }
  limits:   { cpu: 500m, memory: 256Mi }
```

- **requests:** o que o scheduler **reserva** num nó. Um pod só é colocado num nó com pelo menos isto livre.
- **limits:** o **teto**. Acima do limite de memória, o contentor é morto com `OOMKilled`. Acima do limite de CPU, é abrandado (*throttling*), não morto.
- `100m` é 100 *milicores*, ou seja 0,1 de um núcleo. `128Mi` são 128 mebibytes (potências de 2; `M` seria potências de 10).

Sem `requests`, o scheduler põe pods a mais no mesmo nó e eles disputam a memória. Sem `limits`, uma fuga de memória num pod pode deitar abaixo os vizinhos.

```yaml
securityContext:
  runAsNonRoot: true
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
```

O mesmo princípio do `USER node` do módulo 02, com mais força: o Kubernetes **recusa arrancar** o contentor se ele tentar correr como root, e o sistema de ficheiros fica só de leitura. Se alguém explorar uma falha na app, não consegue escrever um binário malicioso no disco.

```yaml
kind: Service
spec:
  type: ClusterIP
  ports:
    - port: 80
      targetPort: 3000
```

Dentro do cluster, qualquer pod chega à API em `http://api` (ou `http://api.<namespace>.svc.cluster.local`), na porta 80, e o Service distribui os pedidos pelas réplicas **que estão prontas** (readiness). Os tipos de Service:

| Tipo | Quem chega lá |
|---|---|
| `ClusterIP` | só quem está dentro do cluster (o habitual) |
| `NodePort` | qualquer um, numa porta alta (30000–32767) de cada nó; usado em testes |
| `LoadBalancer` | numa cloud, cria um balanceador externo com IP público (e custa dinheiro) |

Para HTTP vindo de fora, o normal é um único **Ingress** à frente de vários Services ClusterIP, como no P3.

## 7. ConfigMap e Secret

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: api-secrets
stringData:
  JWT_SECRET: muda-isto
```

Um aviso que aparece em todas as entrevistas: **um Secret não é cifrado**, é codificado em **base64**, que qualquer pessoa descodifica com `base64 -d`. O que o protege é:

1. o **RBAC** do cluster (quem pode fazer `kubectl get secret`);
2. a cifra do etcd em disco, se o administrador a ativou;
3. **não ir para o Git**. Por isso, em empresas, os segredos chegam ao cluster por ferramentas como External Secrets (que os lê do AWS Secrets Manager ou do Vault) ou Sealed Secrets (que os cifra para poderem ir para o Git).

Há duas formas de os usar num pod:

```yaml
envFrom:                         # TODAS as chaves viram variáveis de ambiente
  - configMapRef: { name: notas-config }
env:                             # uma chave escolhida a dedo
  - name: DATABASE_URL
    valueFrom:
      secretKeyRef: { name: notas-secrets, key: DATABASE_URL }
```

Também se podem montar como **ficheiros** (`volumes` + `volumeMounts`), que é o que se faz com um certificado TLS ou um ficheiro de configuração inteiro.

## 8. Atualizações sem downtime e rollback

Quando mudas a imagem de um Deployment, ele não troca tudo de uma vez. Cria um pod novo, espera que fique **pronto** (readiness), tira um velho, e repete:

```yaml
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1          # no máximo 1 pod A MAIS do que replicas, durante a troca
      maxUnavailable: 0    # nunca menos do que replicas prontos
```

```bash
kubectl set image deployment/notas notas=workshop/notas:1.1.0   # inicia a troca
kubectl rollout status deployment/notas                          # acompanha
kubectl rollout undo deployment/notas                            # volta à versão anterior
kubectl rollout history deployment/notas
```

Se a versão nova nunca ficar pronta (a readiness falha sempre), a troca **para a meio** e os pods antigos continuam a servir. É aqui que uma readiness bem escrita te salva de um deploy partido.

## 9. Escalar: HPA

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
spec:
  scaleTargetRef: { apiVersion: apps/v1, kind: Deployment, name: notas }
  minReplicas: 2
  maxReplicas: 6
  metrics:
    - type: Resource
      resource:
        name: cpu
        target: { type: Utilization, averageUtilization: 70 }
```

Em ciclo, o HPA mede o CPU médio dos pods e calcula quantas réplicas manteriam a média nos 70%. Duas condições, que costumam falhar a quem começa:

- a percentagem é **sobre os `requests`**. Sem `requests` de CPU no Deployment, o HPA não tem com que comparar e não faz nada;
- precisa do **metrics-server** instalado no cluster (no kind não vem; instala-se à parte).

Escalar só funciona se a app for **sem estado** (*stateless*): se guardasses sessões em memória, um utilizador mudaria de pod e perdia a sessão. A API deste projeto guarda tudo no Postgres e no Redis, por isso escala sem mudanças. É a mesma razão do módulo 07 para os workers.

## 10. Namespaces, contexto e RBAC

Um **namespace** é uma "pasta" de objetos. Nomes só têm de ser únicos dentro do namespace, e as permissões e quotas aplicam-se por namespace. Padrões comuns: um por equipa, ou `dev`/`staging`/`prod` em clusters pequenos.

O **RBAC** (*Role-Based Access Control*) define quem pode fazer o quê: um `Role` lista verbos (`get`, `list`, `create`...) sobre recursos, e um `RoleBinding` dá esse Role a um utilizador ou a uma *ServiceAccount* (a identidade dos pods). O princípio é o mesmo das `permissions:` do GitHub Actions (módulo 20): o mínimo necessário.

## 11. kubectl e kind, na prática

```bash
# Um cluster local de um nó, dentro do Docker (≈1 GB de imagem, ≈1 GB de RAM)
kind create cluster --name workshop
kubectl cluster-info

kubectl apply -f manifests/app.yaml        # cria ou atualiza (é declarativo: corre as vezes que quiseres)
kubectl get pods -o wide                    # lista, com o nó e o IP de cada pod
kubectl describe pod <nome>                 # os EVENTOS no fim explicam quase todos os problemas
kubectl logs <pod> [-f] [--previous]        # --previous: os logs do contentor ANTES de reiniciar
kubectl exec -it <pod> -- sh                # uma shell dentro do contentor
kubectl port-forward svc/notas 8080:80      # liga localhost:8080 ao Service, para testares
kubectl delete -f manifests/app.yaml

kind delete cluster --name workshop         # liberta tudo
```

Para usar imagens tuas no kind sem um registo, carrega-as no cluster: `kind load docker-image workshop-api:dev --name workshop`.

Os estados de erro que vais ver mais vezes, e o que significam:

| Estado | Causa habitual |
|---|---|
| `ImagePullBackOff` | a imagem não existe, a tag está errada, ou o registo é privado e falta o `imagePullSecret` |
| `CrashLoopBackOff` | o contentor arranca e morre logo: vê `kubectl logs --previous` |
| `Pending` | nenhum nó tem os `requests` livres, ou falta um volume |
| `OOMKilled` | passou o limite de memória |
| `Running` mas `0/1 READY` | a readiness está a falhar: vê `kubectl describe pod` |

## 12. Helm e Kustomize

Escrever o mesmo YAML para `dev` e `prod`, só com valores diferentes, depressa se torna repetitivo. Há duas soluções, e vais encontrar ambas:

- **Kustomize** (integrado no `kubectl apply -k`): uma pasta `base/` com os manifests e pastas `overlays/dev`, `overlays/prod` com *patches* por cima. Sem templates, só YAML.
- **Helm**: "pacotes" de Kubernetes (*charts*) com templates Go (`{{ .Values.replicas }}`) e um `values.yaml` por ambiente. É como se instalam coisas de terceiros: `helm install monitoring prometheus-community/kube-prometheus-stack`.

E, cada vez mais, o deploy não é um `kubectl apply` no CI, mas **GitOps**: o Argo CD ou o Flux correm dentro do cluster e reconciliam-no com o que está num repositório Git. É o §2 aplicado ao próprio deploy.

## Em resumo

- O Kubernetes orquestra contentores em **muitas** máquinas: declaras o **estado desejado** e os controladores **reconciliam** continuamente o estado real com ele.
- Um cluster tem um plano de controlo (API server, etcd, scheduler, controladores) e nós que correm os **pods** (um ou mais contentores juntos).
- Escreves sobretudo **Deployments** (réplicas e atualizações), **Services** (um nome estável para um conjunto de pods) e **Ingress** (a entrada HTTP); as **labels** e os **selectors** ligam-nos.
- As **probes** dizem ao Kubernetes se um pod está vivo (*liveness*) e pronto (*readiness*); os *requests* e *limits* reservam e limitam CPU e memória.
- A configuração vem de **ConfigMaps** e **Secrets** (que estão só codificados em base64, não cifrados).
- Os *rolling updates* trocam pods sem parar o serviço, com `rollout undo` para voltar atrás; o **HPA** escala pelo uso.
- Namespaces e RBAC separam equipas e permissões; o **Helm** e o **Kustomize** gerem os manifestos para vários ambientes.

---

## Prática: escreve tu

Quatro ficheiros de manifests, do Deployment mais simples a uma tarefa agendada. Não precisas de um cluster: os testes leem o teu YAML como o `kubectl` o leria, verificam as regras de cada exercício (labels, portas, probes, referências entre objetos), e passam cada ficheiro pelo **kubeconform**, que o valida contra o esquema oficial do Kubernetes 1.33. Esse último teste precisa de Docker.

**Ficheiros:** `pratica/32-kubernetes/manifests/` (`app.yaml`, `config.yaml`, `exposicao-e-escala.yaml`, `cronjob.yaml`)

**Verificar:** `npm run verificar 32` (dentro de `pratica/`). Só um exercício: `npm run verificar 32 app`, `... 32 config`, `... 32 exposicao` ou `... 32 cronjob`. O teste do esquema chama-se `esquema`.

Como no módulo 20: **dois espaços por nível, nunca tabs**. Um campo mal indentado não dá erro de YAML, passa a pertencer a outro objeto. Se o kubeconform disser `additional properties 'x' not allowed`, ou o nome do campo está errado (as maiúsculas contam: `containerPort`, não `containerport`) ou está no nível errado.

Se nunca usaste a prática, lê primeiro a introdução no [módulo 01](01-fundamentos.md#prática-escreve-tu).

### P1 · Deployment e Service (≈30 min)

**Ficheiro:** `manifests/app.yaml`

O pedido completo está no comentário do ficheiro: um Deployment `notas` com 2 réplicas, a porta 3000 com o nome `http`, as duas probes, requests e limits, e um Service ClusterIP na porta 80.

**Sintaxe que vais praticar:** `apiVersion`/`kind`/`metadata`/`spec`, `---` entre objetos, `selector.matchLabels`, `template.metadata.labels`, `containers[].ports[].name`, `readinessProbe.httpGet`, `livenessProbe.tcpSocket`, `resources.requests`/`limits`, `targetPort` por nome.

<details>
<summary>Pista</summary>

Começa por copiar a **estrutura** do `config/k8s/api.yaml` (não os valores) e muda o resto. Uma porta com nome declara-se com `- name: http` e `containerPort: 3000` no mesmo item da lista; depois, as probes e o Service podem usar `port: http` em vez do número.
</details>

<details>
<summary>Solução de referência</summary>

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: notas
  labels:
    app: notas
spec:
  replicas: 2
  selector:
    matchLabels:
      app: notas              # TEM de coincidir com as labels do template, logo abaixo
  template:
    metadata:
      labels:
        app: notas
    spec:
      containers:
        - name: notas
          image: workshop/notas:1.0.0
          ports:
            - name: http      # um nome para a porta: o Service e as probes referem-se a ele
              containerPort: 3000
          readinessProbe:     # "posso receber tráfego?" Se falhar, o pod sai do Service
            httpGet:
              path: /health
              port: http
            periodSeconds: 10
          livenessProbe:      # "estou vivo?" Se falhar, o Kubernetes reinicia o contentor
            tcpSocket:
              port: http
            initialDelaySeconds: 15
            periodSeconds: 20
          resources:
            requests:         # o que o escalonador reserva num nó
              cpu: 100m
              memory: 64Mi
            limits:           # o teto: acima da memória, o contentor é morto (OOMKilled)
              cpu: 500m
              memory: 128Mi
---
apiVersion: v1
kind: Service
metadata:
  name: notas
spec:
  type: ClusterIP
  selector:
    app: notas                # envia tráfego para os pods com esta label
  ports:
    - port: 80                # a porta do Service, dentro do cluster
      targetPort: http        # a porta do contentor, pelo nome
```
</details>

### P2 · Namespace, ConfigMap e Secret (≈25 min)

**Ficheiro:** `manifests/config.yaml`

Um namespace `workshop`, a configuração de um worker separada em ConfigMap (o que não é secreto) e Secret (a `DATABASE_URL`), e um Deployment que recebe o ConfigMap inteiro e só uma chave do Secret.

**Sintaxe que vais praticar:** `kind: Namespace`, `metadata.namespace`, `data` vs `stringData`, `envFrom[].configMapRef`, `env[].valueFrom.secretKeyRef`.

<details>
<summary>Pista</summary>

Num ConfigMap, **todos** os valores são strings: `60` sem aspas é um número em YAML, e o Kubernetes recusa-o. No Secret, `stringData` aceita o valor em claro e o Kubernetes converte-o para base64; `data` exigiria que já o desses em base64.
</details>

<details>
<summary>Solução de referência</summary>

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: workshop
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: notas-config
  namespace: workshop
data:
  LOG_LEVEL: info
  CACHE_TTL_SECONDS: "60"     # sem aspas seria um número, e um ConfigMap só aceita strings
---
apiVersion: v1
kind: Secret
metadata:
  name: notas-secrets
  namespace: workshop
type: Opaque
stringData:                   # em claro aqui; o Kubernetes guarda-o em base64 (que NÃO é cifra)
  DATABASE_URL: postgres://notas:notas@postgres:5432/notas
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: notas-worker
  namespace: workshop
spec:
  replicas: 1
  selector:
    matchLabels:
      app: notas-worker
  template:
    metadata:
      labels:
        app: notas-worker
    spec:
      containers:
        - name: worker
          image: workshop/notas-worker:1.0.0
          envFrom:            # todas as chaves do ConfigMap passam a variáveis de ambiente
            - configMapRef:
                name: notas-config
          env:                # só UMA chave do Secret, escolhida a dedo
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: notas-secrets
                  key: DATABASE_URL
```

Repara que este Secret está num ficheiro que irias pôr no Git, com a password lá dentro. Num projeto a sério, ele não estaria aqui (secção 7).
</details>

### P3 · Ingress, autoescala e PodDisruptionBudget (≈30 min)

**Ficheiro:** `manifests/exposicao-e-escala.yaml`

Três objetos que apontam para o que escreveste no P1: um Ingress para `notas.local`, um HPA entre 2 e 6 réplicas, e um PodDisruptionBudget. Os testes confirmam também que as referências estão certas: o Ingress aponta para um Service e uma porta que existem mesmo no `app.yaml`.

**Sintaxe que vais praticar:** `networking.k8s.io/v1` Ingress com `rules[].host`, `paths[].pathType`, `backend.service.port.number`; `autoscaling/v2` com `scaleTargetRef` e `metrics`; `policy/v1` PodDisruptionBudget.

<details>
<summary>Pista</summary>

O HPA não escala "o Service", escala o **Deployment**, por isso o `scaleTargetRef` tem o `apiVersion`, o `kind` e o `name` do Deployment. Um **PodDisruptionBudget** protege contra perturbações *voluntárias*: quando um administrador esvazia um nó para o atualizar (`kubectl drain`), o Kubernetes recusa tirar o último pod da app. Não protege contra um nó que morre sozinho.
</details>

<details>
<summary>Solução de referência</summary>

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: notas
spec:
  ingressClassName: nginx     # qual controlador de Ingress trata isto (tem de estar instalado no cluster)
  rules:
    - host: notas.local
      http:
        paths:
          - path: /
            pathType: Prefix  # "/" com Prefix apanha qualquer caminho
            backend:
              service:
                name: notas
                port:
                  number: 80
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: notas
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: notas
  minReplicas: 2
  maxReplicas: 6
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70   # 70% dos 100m pedidos em requests, em média por pod
---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: notas
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: notas
```
</details>

### P4 · Uma tarefa agendada (≈15 min)

**Ficheiro:** `manifests/cronjob.yaml`

Um CronJob que corre todas as noites às 03:00, sem execuções sobrepostas, com limite de tentativas e de tempo.

**Sintaxe que vais praticar:** expressão cron, `concurrencyPolicy`, `jobTemplate.spec`, `backoffLimit`, `activeDeadlineSeconds`, `restartPolicy`, `command`.

<details>
<summary>Pista</summary>

Um CronJob tem três níveis encaixados, e é fácil perderes-te: o **CronJob** (quando) → `jobTemplate.spec` (o **Job**: quantas tentativas, quanto tempo) → `template.spec` (o **Pod**: que contentor). Uma expressão cron tem cinco campos: minuto, hora, dia do mês, mês e dia da semana.
</details>

<details>
<summary>Solução de referência</summary>

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: limpeza
spec:
  schedule: "0 3 * * *"        # minuto 0, hora 3, todos os dias
  concurrencyPolicy: Forbid    # se a de ontem ainda estiver a correr, a de hoje não arranca
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 1
  jobTemplate:
    spec:
      backoffLimit: 2            # no máximo 2 novas tentativas
      activeDeadlineSeconds: 600 # e nunca mais de 10 minutos no total
      template:
        spec:
          restartPolicy: OnFailure
          containers:
            - name: limpeza
              image: workshop/notas:1.0.0
              command: ["node", "limpeza.js", "--dias=30"]
```

Atenção ao fuso horário: o `schedule` é interpretado no fuso do control plane (normalmente UTC), a menos que acrescentes `timeZone: Europe/Lisbon`.
</details>

**Depois de passar:** se tiveres o `kind` instalado, aplica-os a um cluster a sério (secção 11). Os objetos do P1 vão ficar em `ImagePullBackOff`, porque a imagem `workshop/notas:1.0.0` não existe em nenhum registo. É um bom primeiro diagnóstico: `kubectl describe pod` diz-te exatamente isso nos eventos.

## Experiências

Precisas do [kind](https://kind.sigs.k8s.io/) e do `kubectl`. O cluster gasta cerca de 1 GB de RAM; desliga a stack do workshop antes.

1. **Autocura:** faz uma cópia do teu `app.yaml` (P1) com uma imagem que existe: `nginxinc/nginx-unprivileged:1.27-alpine` (um Nginx que não corre como root), `containerPort: 8080` e a readiness em `/` em vez de `/health`. Aplica-a, apaga um pod com `kubectl delete pod <nome>` e, logo a seguir, corre `kubectl get pods -w`. Vês um pod novo a nascer: é a reconciliação do §2.
2. **Labels erradas:** na mesma cópia, muda o selector do Service para `app: notass` e aplica. Faz `kubectl get endpoints notas`: a lista fica vazia, e o `kubectl apply` não deu erro nenhum.
3. **OOMKilled:** num Deployment de teste com `limits.memory: 20Mi`, corre um contentor `python:3.12-alpine` com `command: ["python", "-c", "x = ' ' * 100_000_000"]`. Vê o estado com `kubectl get pods` e o motivo com `kubectl describe pod`.
4. **Rolling update que não acaba:** na cópia da experiência 1, muda a imagem para uma tag que não existe (`nginxinc/nginx-unprivileged:nao-existe`) e corre `kubectl rollout status deployment/notas`. A troca para, e os pods antigos continuam a responder. Desfaz com `kubectl rollout undo`.

## Perguntas de pensamento crítico

1. A API deste projeto tem a readiness no `/api/health` e a liveness num `tcpSocket`. Um colega propõe usar o `/api/health` também na liveness, "para ser mais completo". O que acontece no dia em que o Redis cai?
2. Porque é que um HPA configurado para 70% de CPU não escala nada num Deployment sem `resources.requests`?
3. Uma equipa de três pessoas, com uma app e um servidor, pergunta se deve migrar do Docker Compose para Kubernetes. O que lhes perguntas antes de responder?

<details>
<summary>Respostas</summary>

1. O `/api/health` passa a responder 503 em todas as réplicas, a liveness falha, e o Kubernetes reinicia todas as APIs, em ciclo, enquanto o Redis estiver em baixo. Os reinícios não resolvem nada (o problema está no Redis) e ainda tiram de serviço as rotas que funcionavam sem Redis. A liveness deve verificar só se o próprio processo está bloqueado; as dependências são trabalho da readiness, que tira o pod do tráfego sem o matar.
2. Porque a "utilização" é uma percentagem **dos requests**: 70% de nada não é um número. Sem requests de CPU, o HPA não consegue calcular a métrica e mostra `<unknown>` no `kubectl get hpa`.
3. Se precisam do que o Kubernetes dá e o Compose não: várias máquinas, autoescala, deploys sem downtime frequentes, várias equipas a partilhar a infraestrutura. Se a resposta for "não", o Kubernetes acrescenta um cluster para manter (atualizações, certificados, rede, RBAC) sem resolver nenhum problema que tenham. Um serviço gerido (ECS, Cloud Run, Azure Container Apps) ou o próprio Compose num servidor são alternativas mais baratas.
</details>

<!-- quiz:start -->

## Quiz rápido (autoavaliação)

Perguntas específicas deste módulo. Responde primeiro sem espiar a resposta. Versão interativa e corrigida automaticamente: `node scripts/quiz.mjs 32`.

**1.** O que acontece se o selector de um Service não coincidir com as labels dos pods?

- a) O kubectl apply recusa o Service
- b) O Service fica sem endpoints e os pedidos falham, sem erro nenhum no apply
- c) O Kubernetes corrige as labels sozinho
- d) Os pods são reiniciados em ciclo

<details><summary>Resposta</summary>

**b) O Service fica sem endpoints e os pedidos falham, sem erro nenhum no apply** — O Kubernetes liga objetos por labels, não por nome. Um selector que não apanha nenhum pod não é um erro de sintaxe: o Service existe, mas não tem para onde enviar tráfego (kubectl get endpoints mostra a lista vazia).

</details>

**2.** Porque é que a liveness probe da API NÃO deve verificar a base de dados?

- a) Porque a liveness não aceita pedidos HTTP
- b) Porque, com a BD em baixo, o Kubernetes reiniciaria todas as réplicas da API em ciclo, sem resolver nada
- c) Porque a BD não tem um endpoint /health
- d) Porque a liveness só corre uma vez, no arranque

<details><summary>Resposta</summary>

**b) Porque, com a BD em baixo, o Kubernetes reiniciaria todas as réplicas da API em ciclo, sem resolver nada** — A liveness responde a 'estou bloqueado?', e se falhar o contentor é reiniciado. As dependências são trabalho da readiness, que só tira o pod do tráfego.

</details>

**3.** Um HPA configurado para 70% de CPU não escala. O que falta quase de certeza?

- a) Um Service do tipo LoadBalancer
- b) resources.requests de CPU no Deployment (a percentagem é sobre eles) ou o metrics-server no cluster
- c) Uma livenessProbe
- d) Mais nós no cluster

<details><summary>Resposta</summary>

**b) resources.requests de CPU no Deployment (a percentagem é sobre eles) ou o metrics-server no cluster** — A utilização é calculada em relação aos requests. Sem requests, ou sem o metrics-server a recolher métricas, o HPA mostra <unknown> e não faz nada.

</details>

**4.** Que estado vês num pod cujo contentor arranca e morre repetidamente (em inglês, como o kubectl o mostra)?

<details><summary>Resposta</summary>

**crashloopbackoff** — O Kubernetes reinicia-o com esperas cada vez maiores. O diagnóstico é kubectl logs --previous, que mostra os logs do contentor antes de morrer.

</details>

**5.** Um Secret do Kubernetes guarda os valores...

- a) cifrados com AES por omissão, por isso pode ir para o Git
- b) em base64, que é uma codificação e não uma cifra: quem lê o Secret lê o valor
- c) com hash bcrypt, como as passwords
- d) só na memória dos pods, nunca no etcd

<details><summary>Resposta</summary>

**b) em base64, que é uma codificação e não uma cifra: quem lê o Secret lê o valor** — base64 descodifica-se com um comando. A proteção vem do RBAC, da cifra do etcd (se ativada) e de os Secrets não irem para o Git (External Secrets, Sealed Secrets).

</details>

<!-- quiz:end -->
