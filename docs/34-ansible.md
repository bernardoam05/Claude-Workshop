# 34 · Gestão de configuração com Ansible

**Objetivo:** perceber o que é gerir a configuração de servidores como código, e saber escrever inventários, playbooks, templates, handlers e roles do Ansible, com a propriedade que os distingue de um script de shell: correr duas vezes não muda nada.

**Ficheiros para ler:** os da prática, em `pratica/34-ansible/` (o `ansible.cfg` e o `requirements.yml` já estão feitos).

**Pré-requisitos:** módulo 02 (Docker) e módulo 33 (Terraform), para a comparação.

---

## 1. O problema que o Ansible resolve

O Terraform (módulo 33) cria a máquina. Mas uma máquina acabada de criar é um Linux vazio: falta instalar pacotes, criar utilizadores, copiar ficheiros de configuração, abrir portas, configurar o serviço para arrancar sozinho. Em dez servidores. E repetir tudo quando muda uma linha da configuração.

A primeira solução de toda a gente é um script de shell, corrido por SSH em cada máquina. Funciona até ao dia em que o corres pela segunda vez:

```bash
useradd app                     # 2.ª vez: "useradd: user 'app' already exists" e o script para
echo "porta=8080" >> app.conf   # 2.ª vez: a linha fica duplicada
```

O **Ansible** descreve o **estado** que cada máquina deve ter ("o utilizador `app` existe", "o ficheiro tem este conteúdo"), e só muda o que estiver diferente. Correr o mesmo playbook dez vezes deixa a máquina igual à primeira. A esta propriedade chama-se **idempotência**, e é a ideia mais importante deste módulo.

## 2. Como o Ansible funciona

```
a tua máquina (controlador)                    as máquinas geridas
┌──────────────────────────┐   SSH (ou docker   ┌─────────────┐
│ inventário  (quem)       │   exec, WinRM...)  │ ans-web1    │
│ playbook    (o quê)      │ ─────────────────▶ │ ans-web2    │
│ ansible-playbook         │                    │ ans-db1     │
└──────────────────────────┘                    └─────────────┘
```

- **Sem agente:** nas máquinas geridas só é preciso SSH e Python. Não há nenhum serviço do Ansible instalado lá. É a grande diferença em relação ao Puppet e ao Chef, as ferramentas anteriores, que exigiam um agente em cada servidor.
- **Push:** és tu (ou o CI) que corres o `ansible-playbook`, e ele liga-se a cada máquina, copia pequenos programas Python (os **módulos**), executa-os e apaga-os.
- **Ligações:** o normal é SSH. Na prática deste módulo, as "máquinas" são contentores Docker, e a ligação é `community.docker.docker` (por `docker exec`): o resto é exatamente igual.

## 3. Ansible vs Terraform vs Docker

| | Terraform | Ansible | Imagem Docker |
|---|---|---|---|
| Para quê | criar recursos de uma API (máquinas, redes, BDs) | configurar o interior de máquinas que já existem | empacotar a app com tudo o que precisa |
| Estado | ficheiro de estado (módulo 33, §6) | sem estado: verifica a máquina a cada execução | imutável: muda-se construindo outra |
| Estilo | declarativo | declarativo por tarefa, executado por ordem | um Dockerfile, passo a passo |

Hoje, com contentores, o Ansible já não instala a tua app na maior parte das empresas: a app vem numa imagem. Mas continua em todo o lado para o resto: preparar os próprios servidores (os nós do Kubernetes, máquinas de bases de dados, *bastions*), configurar equipamento de rede, e automatizar tarefas de operação ("rodar os certificados em todos os servidores").

## 4. O inventário: quem

```ini
[web]
ans-web1
ans-web2

[db]
ans-db1

[all:vars]
ansible_connection=community.docker.docker
```

Grupos entre parêntesis retos, um host por linha, e variáveis por grupo em `[grupo:vars]`. O grupo `all` existe sempre e contém tudo. Num inventário com SSH, verias coisas como `web1 ansible_host=10.0.1.15 ansible_user=ubuntu`.

O inventário também pode ser em YAML, ou **dinâmico**: um plugin que pergunta à AWS "que máquinas têm a tag `papel=web`?" em cada execução. Em cloud, é o normal, porque as máquinas mudam.

```bash
ansible-inventory --graph              # a árvore de grupos e hosts
ansible all -m ansible.builtin.ping    # comando "ad hoc": um módulo em todos os hosts, sem playbook
ansible web -m ansible.builtin.shell -a "uptime"
```

## 5. Playbooks, plays, tarefas e módulos

```yaml
- name: Base comum             # uma PLAY: um conjunto de tarefas para um grupo de hosts
  hosts: all
  tasks:
    - name: O utilizador "app" existe      # uma TAREFA: o name é o que aparece na saída
      ansible.builtin.user:                 # o MÓDULO que faz o trabalho
        name: app
        system: true

    - name: A pasta da aplicação existe
      ansible.builtin.file:
        path: /srv/app
        state: directory
        owner: app
        mode: "0755"
```

Um **playbook** é uma lista de plays. Cada play diz a que hosts se aplica e que tarefas corre, **por ordem**, em todos esses hosts em paralelo (cinco de cada vez, por omissão).

Repara como se escreve o nome de cada tarefa: "o utilizador existe", e não "criar o utilizador". Descreves o estado, não a ação.

Os módulos que vais usar quase sempre:

| Módulo | Estado que garante |
|---|---|
| `ansible.builtin.user` / `group` | um utilizador ou grupo existe (ou não) |
| `ansible.builtin.file` | uma pasta, um link, ou permissões de um ficheiro |
| `ansible.builtin.copy` | um ficheiro com um conteúdo exato |
| `ansible.builtin.template` | um ficheiro gerado a partir de um template Jinja2 |
| `ansible.builtin.lineinfile` | uma linha específica num ficheiro existente |
| `ansible.builtin.package` / `apt` / `dnf` | um pacote instalado |
| `ansible.builtin.service` / `systemd` | um serviço a correr e ativado no arranque |
| `ansible.builtin.command` / `shell` | **corre um comando**: o último recurso |

Os nomes completos (`ansible.builtin.user`, e não só `user`) chamam-se **FQCN** (*fully qualified collection name*). Os nomes curtos ainda funcionam, mas o `ansible-lint` pede os completos, para não haver dúvidas sobre de que coleção vem o módulo.

## 6. Idempotência: o que a quebra

Na saída de cada tarefa, o Ansible diz `ok` (já estava como pedido, não fez nada) ou `changed` (mudou alguma coisa). No fim, o **PLAY RECAP** conta tudo:

```
ans-web1 : ok=4  changed=0  unreachable=0  failed=0  skipped=0
```

Um playbook bem escrito, corrido duas vezes seguidas, tem `changed=0` na segunda. Os testes da prática verificam exatamente isto.

O que mais quebra a idempotência:

- **`command` e `shell`:** o Ansible não sabe o que o comando fez, por isso diz sempre `changed` e corre-o sempre. Se não houver alternativa, diz-lhe quando o comando já não é preciso:
  ```yaml
  - name: A base de dados foi inicializada
    ansible.builtin.command: /opt/app/init-db.sh
    args:
      creates: /var/lib/app/.inicializada   # se este ficheiro existir, a tarefa não corre
  ```
- **Acrescentar a ficheiros** com `shell: echo ... >>`: usa `lineinfile` ou `template`.
- **Valores que mudam sempre**, como datas num template: o ficheiro muda em cada execução.

Antes de aplicares a máquinas importantes, há o modo de ensaio:

```bash
ansible-playbook site.yml --check --diff   # o que MUDARIA, e as diferenças nos ficheiros, sem mudar nada
```

## 7. Variáveis e precedência

As variáveis podem vir de muitos sítios, e a pergunta "qual ganha?" aparece em entrevistas. Do mais fraco para o mais forte (uma versão simplificada da lista oficial):

1. `defaults/main.yml` de uma role (pensados para serem substituídos)
2. `group_vars/all.yml`
3. `group_vars/<grupo>.yml`
4. `host_vars/<host>.yml`
5. `vars:` na play
6. `-e` / `--extra-vars` na linha de comandos (ganha **sempre**)

As pastas `group_vars/` e `host_vars/`, ao lado do inventário ou do playbook, são carregadas sozinhas: um ficheiro `group_vars/web.yml` aplica-se a todos os hosts do grupo `web`, sem mais configuração. Há também variáveis que o Ansible preenche: `inventory_hostname` (o nome do host no inventário) e os **facts** (`ansible_facts.os_family`, `ansible_facts.memtotal_mb`...), recolhidos no início de cada play.

Uma subtileza que o P3 te mostra: quando um nível mais forte define uma **lista**, ela **substitui** a lista do nível mais fraco, não se soma a ela.

## 8. Templates com Jinja2

```jinja
# Gerido pelo Ansible: não edites à mão.
porta = {{ porta }}
host = {{ inventory_hostname }}
workers:
{% for w in workers %}
  - {{ w }}
{% endfor %}
{% if ambiente == "producao" %}
log_level = warn
{% endif %}
Utilizadores: {{ utilizadores | join(', ') }}
```

- `{{ ... }}` escreve um valor; `{% ... %}` é lógica (`for`, `if`); `{# ... #}` é um comentário que não aparece no resultado.
- Os **filtros** transformam valores: `join`, `upper`, `default('x')`, `to_nice_json`, `length`.
- A primeira linha avisa quem abrir o ficheiro no servidor: se o editar à mão, a próxima execução do Ansible apaga a alteração.

O mesmo Jinja2 aparece também dentro dos YAML: `path: "/srv/app/{{ item }}"`. Quando um valor **começa** por `{{`, as aspas são obrigatórias, senão o YAML confunde as chavetas com um dicionário.

## 9. Loops, condições e handlers

```yaml
- name: As pastas da aplicação existem
  ansible.builtin.file:
    path: "/srv/app/{{ item }}"
    state: directory
  loop: [logs, dados, tmp]                         # item toma cada valor

- name: Instalar o cliente de Postgres (só em Debian)
  ansible.builtin.apt:
    name: postgresql-client
  when: ansible_facts.os_family == "Debian"       # condição

- name: A configuração do Nginx está atualizada
  ansible.builtin.template:
    src: nginx.conf.j2
    dest: /etc/nginx/nginx.conf
  notify: recarregar nginx                         # avisa o handler, SE esta tarefa mudar algo

handlers:
  - name: recarregar nginx
    ansible.builtin.service:
      name: nginx
      state: reloaded
```

Um **handler** é uma tarefa que só corre quando é notificada por uma tarefa que **mudou** alguma coisa, e corre **uma só vez**, no fim da play, mesmo que várias tarefas o notifiquem. É assim que se evita reiniciar o Nginx em cada execução: só se reinicia quando a configuração mudou mesmo.

## 10. Roles: organizar para reutilizar

Quando um playbook cresce, divide-se em **roles**, com uma estrutura fixa de pastas que o Ansible conhece:

```
roles/base/
├── defaults/main.yml    # variáveis por omissão (fáceis de substituir)
├── tasks/main.yml       # as tarefas
├── handlers/main.yml    # os handlers
├── templates/motd.j2    # os templates (o "src:" procura aqui sozinho)
├── files/               # ficheiros copiados tal como estão
└── vars/main.yml        # variáveis internas (difíceis de substituir)
```

O playbook passa a dizer só **a quem** se aplica o quê:

```yaml
- name: Base de todos os servidores
  hosts: all
  roles:
    - base
```

Roles e módulos de terceiros partilham-se em **coleções**, pelo [Ansible Galaxy](https://galaxy.ansible.com). Um `requirements.yml` fixa as versões, como um `package.json`:

```bash
ansible-galaxy collection install -r requirements.yml
```

## 11. Segredos: Ansible Vault

Uma password de base de dados num `group_vars` vai para o Git. O **Vault** cifra o ficheiro (com AES-256) e o Ansible decifra-o quando o usa:

```bash
ansible-vault create group_vars/db/segredos.yml     # abre um editor; o ficheiro fica cifrado
ansible-vault edit group_vars/db/segredos.yml
ansible-playbook site.yml --ask-vault-pass          # ou --vault-password-file, no CI
```

O ficheiro cifrado pode ir para o Git. A password do Vault não: vive num gestor de segredos ou num secret do CI.

## 12. Boas práticas que te vão pedir

- **`ansible-lint`** no CI: apanha `shell` onde havia um módulo, tarefas sem `name`, permissões sem aspas (`mode: 0755` sem aspas é lido como número em octal, e dá surpresas).
- **`--check --diff`** antes de aplicar em produção, e numa máquina de cada vez primeiro (`--limit ans-web1`).
- **Testar roles com o Molecule**, que as aplica a contentores descartáveis e verifica a idempotência. É o que os testes desta prática fazem, à mão.
- **Nada à mão nos servidores:** a mesma regra do Terraform. Uma alteração manual é apagada na próxima execução, ou (pior) fica, e o servidor deixa de ser reprodutível.

## Em resumo

- O Ansible **configura máquinas que já existem** (pacotes, ficheiros, serviços), por SSH e sem agente; o Terraform cria a infraestrutura, e o Docker empacota a aplicação.
- O **inventário** diz que máquinas existem e em que grupos; um **playbook** aplica tarefas a grupos, e cada tarefa usa um **módulo**.
- **Idempotência**: correr duas vezes deixa o mesmo resultado, e a segunda corrida não muda nada. Os módulos de `shell` quebram-na se não tiveres cuidado.
- As **variáveis** têm uma ordem de precedência (`group_vars`, `host_vars`, extras); os **templates** Jinja2 geram ficheiros de configuração.
- Os **handlers** só correm quando algo mudou (reiniciar um serviço depois de mudar a configuração); as **roles** organizam tudo para reutilizar.
- Os segredos cifram-se com o **Ansible Vault**.

---

## Prática: escreve tu

Um inventário, dois playbooks e uma role, aplicados a três "servidores": contentores Alpine com Python (`ans-web1`, `ans-web2`, `ans-db1`) que os testes criam do zero em cada execução. Os testes correm os teus playbooks com o `ansible-playbook` e entram nos contentores para confirmar o resultado: utilizadores, ficheiros, permissões, conteúdos. E correm cada playbook **duas vezes**: na segunda, o `PLAY RECAP` tem de mostrar `changed=0`.

**Ficheiros:** `pratica/34-ansible/` (`inventario.ini`, `p1-basico.yml`, `p2-config.yml`, `templates/app.conf.j2`, `group_vars/web.yml`, `group_vars/db.yml`, `p3-site.yml` e `roles/base/`)

**Verificar:** `npm run verificar 34` (dentro de `pratica/`). Só um exercício: `npm run verificar 34 p1`, `... 34 p2` ou `... 34 p3`. Precisa do Docker a correr.

**Primeira vez:** o `verificar` cria o ambiente Python em `pratica/.venv` (com o `ansible-core`) e os testes instalam a coleção `community.docker` em `pratica/34-ansible/.colecoes/`. Para correres o Ansible à mão, dentro de `pratica/34-ansible/`: `../.venv/bin/ansible-playbook p1-basico.yml` (os contentores só existem enquanto os testes correm; para os teres à mão, cria-os com `docker run -d --name ans-web1 python:3.12-alpine sleep infinity`).

Se nunca usaste a prática, lê primeiro a introdução no [módulo 01](01-fundamentos.md#prática-escreve-tu).

### P1 · Inventário e o primeiro playbook (≈30 min)

**Ficheiros:** `inventario.ini` e `p1-basico.yml`

Dois grupos no inventário, a ligação por Docker para todos, e uma play com três tarefas para todos os hosts: um utilizador, uma pasta e um ficheiro.

**Sintaxe que vais praticar:** inventário INI com `[grupo]` e `[all:vars]`, `- name:`/`hosts:`/`tasks:`, módulos `ansible.builtin.user`, `file` e `copy`, `mode: "0755"` entre aspas.

<details>
<summary>Pista</summary>

Um playbook é uma **lista** de plays, por isso começa com `- name:`. Corre `../.venv/bin/ansible-inventory --graph` para confirmares que o inventário tem o aspeto que esperas. Se a segunda execução disser `changed`, vê qual foi a tarefa: é quase sempre um módulo que não verifica o estado.
</details>

<details>
<summary>Solução de referência</summary>

`inventario.ini`:

```ini
[web]
ans-web1
ans-web2

[db]
ans-db1

[all:vars]
# Em vez de SSH, o Ansible entra nos contentores com "docker exec".
ansible_connection=community.docker.docker
```

`p1-basico.yml`:

```yaml
- name: Base comum
  hosts: all
  tasks:
    - name: O utilizador de sistema "app" existe
      ansible.builtin.user:
        name: app
        system: true

    - name: A pasta da aplicação existe e pertence ao "app"
      ansible.builtin.file:
        path: /srv/app
        state: directory
        owner: app
        mode: "0755"

    - name: O LEIA-ME avisa que isto é gerido pelo Ansible
      ansible.builtin.copy:
        dest: /srv/app/LEIA-ME
        content: "Gerido pelo Ansible\n"
        mode: "0644"
```
</details>

### P2 · Variáveis, templates e handlers (≈40 min)

**Ficheiros:** `p2-config.yml`, `templates/app.conf.j2` e `group_vars/web.yml`

Uma play só para o grupo `web`: um loop de pastas, um ficheiro de configuração gerado por template com as variáveis do grupo, e um handler que só corre quando o ficheiro muda. Os testes correm o playbook três vezes: a primeira cria tudo (e o handler corre); a segunda não muda nada (e o handler **não** corre); a terceira com `-e porta=9090`, que muda o ficheiro e volta a chamar o handler.

**Sintaxe que vais praticar:** `hosts: web`, `loop:` com `{{ item }}`, `ansible.builtin.template`, `notify:`, `handlers:`, `group_vars/`, Jinja2 com `{{ }}`, `{% for %}` e `inventory_hostname`.

<details>
<summary>Pista</summary>

O texto do `notify:` tem de ser **igual** ao `name:` do handler. No template, o Ansible remove a quebra de linha a seguir a cada `{% ... %}` (a opção `trim_blocks`), por isso podes pôr o `{% for %}` e o `{% endfor %}` em linhas próprias sem aparecerem linhas em branco no resultado.
</details>

<details>
<summary>Solução de referência</summary>

`p2-config.yml`:

```yaml
- name: Configurar a app
  hosts: web
  tasks:
    - name: As pastas da aplicação existem
      ansible.builtin.file:
        path: "/srv/app/{{ item }}"
        state: directory
        mode: "0755"
      loop:
        - logs
        - dados
        - tmp

    - name: O ficheiro de configuração está atualizado
      ansible.builtin.template:
        src: templates/app.conf.j2
        dest: /srv/app/app.conf
        mode: "0644"
      notify: recarregar app

  handlers:
    - name: recarregar app
      ansible.builtin.shell: echo recarregado >> /srv/app/recarregamentos
```

`templates/app.conf.j2`:

```jinja
# Gerido pelo Ansible: não edites à mão.
porta = {{ porta }}
ambiente = {{ ambiente }}
host = {{ inventory_hostname }}
workers:
{% for w in workers %}
  - {{ w }}
{% endfor %}
```

`group_vars/web.yml`:

```yaml
porta: 8080
ambiente: producao
workers:
  - envio
  - limpeza
```

O handler usa `shell` com `>>`, que não é idempotente, mas aqui é de propósito: é a forma de os testes contarem quantas vezes ele correu. Num caso real, seria `ansible.builtin.service` com `state: reloaded`.
</details>

### P3 · Uma role com defaults e group_vars (≈40 min)

**Ficheiros:** `p3-site.yml`, `roles/base/` (`defaults`, `tasks`, `templates`, `handlers`) e `group_vars/db.yml`

Uma role `base` com utilizadores e uma mensagem de boas-vindas (`/etc/motd`), aplicada a todos os hosts. Os servidores `web` usam os valores por omissão da role; o `ans-db1` substitui-os com o `group_vars/db.yml`. Os testes confirmam que a lista do grupo **substitui** a da role (o `bruno` não pode existir no `ans-db1`).

**Sintaxe que vais praticar:** `roles:` num playbook, a estrutura de pastas de uma role, `defaults/main.yml`, `loop: "{{ utilizadores }}"`, o filtro `join`, a precedência de variáveis.

<details>
<summary>Pista</summary>

Dentro de uma role, os ficheiros `tasks/main.yml` e `handlers/main.yml` são **listas de tarefas** diretamente (sem `- name: ... hosts:` à volta), e o `src:` de um template procura sozinho na pasta `templates/` da role. Quando o valor de uma chave começa por `{{`, põe-no entre aspas.
</details>

<details>
<summary>Solução de referência</summary>

`p3-site.yml`:

```yaml
- name: Base de todos os servidores
  hosts: all
  roles:
    - base
```

`roles/base/defaults/main.yml`:

```yaml
equipa: plataforma
utilizadores:
  - ana
  - bruno
```

`roles/base/tasks/main.yml`:

```yaml
- name: Os utilizadores da equipa existem
  ansible.builtin.user:
    name: "{{ item }}"
    shell: /bin/sh
  loop: "{{ utilizadores }}"

- name: A mensagem de boas-vindas descreve o servidor
  ansible.builtin.template:
    src: motd.j2
    dest: /etc/motd
    mode: "0644"
  notify: motd alterado
```

`roles/base/templates/motd.j2`:

```jinja
Servidor {{ inventory_hostname }} · equipa {{ equipa }}
Utilizadores: {{ utilizadores | join(', ') }}
```

`roles/base/handlers/main.yml`:

```yaml
- name: motd alterado
  ansible.builtin.shell: echo alterado >> /var/log/motd-alteracoes
```

`group_vars/db.yml`:

```yaml
equipa: dados
utilizadores:
  - ana
  - carla
```
</details>

## Experiências

Para estas, arranca os três contentores à mão (o comando está na introdução da prática) e corre o Ansible dentro de `pratica/34-ansible/`. No fim: `docker rm -f ans-web1 ans-web2 ans-db1`.

1. **Quebra a idempotência de propósito:** no P1, troca a tarefa do `copy` por `ansible.builtin.shell: echo "Gerido pelo Ansible" > /srv/app/LEIA-ME`. Corre o playbook duas vezes e compara o `PLAY RECAP`. O resultado no servidor é igual; o que o Ansible consegue dizer-te sobre ele, não.
2. **Ensaio:** muda a `porta` no `group_vars/web.yml` e corre `ansible-playbook p2-config.yml --check --diff`. Vês a linha que mudaria no `app.conf`, e o servidor fica intacto.
3. **Precedência:** corre o P3 com `-e equipa=urgente`. Em que hosts mudou o motd? E se puseres `equipa: x` no `vars:` da play, quem ganha ao `-e`?
4. **Alteração manual apagada:** entra num servidor (`docker exec -it ans-web1 sh`), edita o `/srv/app/app.conf` à mão, sai, e corre o P2 outra vez. Repara no `changed` e no handler a correr.

## Perguntas de pensamento crítico

1. Um colega escreve um playbook só com tarefas `shell`, porque "já sabe os comandos de cor". Funciona na primeira vez. Que problemas aparecem com o tempo?
2. Porque é que o handler "reiniciar nginx" é melhor do que uma tarefa normal no fim do playbook que reinicia o Nginx sempre?
3. Com contentores e Kubernetes, ainda faz sentido aprender Ansible?

<details>
<summary>Respostas</summary>

1. O Ansible não sabe o que cada comando fez, por isso marca tudo como `changed` em todas as execuções: perdes a informação de "o que mudou neste servidor", que é o que torna o `--check` e o `PLAY RECAP` úteis. Os comandos que não são idempotentes (acrescentar linhas, criar coisas que já existem) partem na segunda execução ou duplicam dados. E as tarefas deixam de ser portáveis entre distribuições, que é o que módulos como `package` e `user` tratam por ti.
2. Porque só reinicia quando a configuração mudou mesmo. Um reinício desnecessário corta ligações a meio e, em vários servidores, pode deitar o serviço abaixo durante o deploy. Além disso, se várias tarefas mudarem coisas que precisam de reinício, o handler junta-as num só, no fim.
3. Sim, mas para outras coisas. A app em si vem numa imagem, e não é instalada pelo Ansible. Mas os servidores onde os contentores correm, as máquinas que não estão em Kubernetes (bases de dados geridas à mão, *bastions*, equipamento de rede), e as tarefas de operação em massa ("atualizar o OpenSSL em 200 máquinas") continuam a ser trabalho de Ansible em muitas empresas, e aparece com frequência em vagas de DevOps e de administração de sistemas.
</details>

<!-- quiz:start -->

## Quiz rápido (autoavaliação)

Perguntas específicas deste módulo. Responde primeiro sem espiar a resposta. Versão interativa e corrigida automaticamente: `node scripts/quiz.mjs 34`.

**1.** O que quer dizer que um playbook é idempotente?

- a) Que corre em todos os hosts ao mesmo tempo
- b) Que corrê-lo várias vezes deixa as máquinas no mesmo estado que a primeira vez, e a segunda execução tem changed=0
- c) Que não precisa de inventário
- d) Que nunca falha

<details><summary>Resposta</summary>

**b) Que corrê-lo várias vezes deixa as máquinas no mesmo estado que a primeira vez, e a segunda execução tem changed=0** — Os módulos verificam o estado antes de agir. É o que distingue o Ansible de um script de shell corrido por SSH.

</details>

**2.** Porque é que tarefas com ansible.builtin.shell estragam a idempotência?

- a) Porque o shell não existe em Linux
- b) Porque o Ansible não sabe o que o comando fez, por isso diz sempre 'changed' e corre-o sempre
- c) Porque o shell só funciona com SSH
- d) Porque o shell corre como root

<details><summary>Resposta</summary>

**b) Porque o Ansible não sabe o que o comando fez, por isso diz sempre 'changed' e corre-o sempre** — Se não houver um módulo para o que precisas, usa creates:/removes: ou changed_when: para dizer ao Ansible quando o comando é necessário.

</details>

**3.** Quando corre um handler?

- a) No início da play, antes das tarefas
- b) Sempre no fim da play
- c) Só quando uma tarefa que o notifica mudou alguma coisa, e uma só vez, no fim da play
- d) Quando o playbook falha

<details><summary>Resposta</summary>

**c) Só quando uma tarefa que o notifica mudou alguma coisa, e uma só vez, no fim da play** — É assim que se reinicia um serviço só quando a sua configuração mudou mesmo.

</details>

**4.** Que variável do Ansible tem o nome do host tal como está no inventário?

<details><summary>Resposta</summary>

**inventory_hostname** — Usada nos templates (host = {{ inventory_hostname }}) para personalizar ficheiros por máquina.

</details>

**5.** Uma variável é definida nos defaults/ de uma role, no group_vars/ do grupo e com -e na linha de comandos. Qual ganha?

- a) A dos defaults da role
- b) A do group_vars
- c) A do -e (extra vars), que ganha sempre
- d) A que aparecer primeiro no ficheiro

<details><summary>Resposta</summary>

**c) A do -e (extra vars), que ganha sempre** — Os defaults de uma role são a prioridade mais baixa (feitos para serem substituídos); as extra vars são a mais alta.

</details>

<!-- quiz:end -->
