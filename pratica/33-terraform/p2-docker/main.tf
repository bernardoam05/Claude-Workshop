# P2 · Infraestrutura a sério: rede, volume e dois contentores, com o provider kreuzwerker/docker.
#
# 1. Bloco terraform: exige o provider kreuzwerker/docker, versão ~> 3.6.
#    O bloco provider "docker" pode ficar vazio: usa o mesmo Docker que o teu comando docker.
# 2. Variáveis: "prefixo" (string, por omissão "tf-pratica") e "porta" (number, por omissão 8091).
# 3. Uma rede docker_network "rede", com o nome "<prefixo>-rede".
# 4. Um volume docker_volume "dados", com o nome "<prefixo>-redis-dados".
# 5. Duas imagens docker_image: "redis" (redis:7-alpine) e "nginx" (nginx:1.27-alpine), ambas com
#    keep_locally = true (o destroy não apaga as imagens do teu Docker).
# 6. Contentor docker_container "redis": nome "<prefixo>-redis", na rede, com o volume montado em
#    /data, e SEM portas publicadas.
# 7. Contentor docker_container "web": nome "<prefixo>-web", na rede, a porta 80 publicada SÓ em
#    127.0.0.1:<porta>, e um index.html com o texto "Feito com Terraform" (bloco upload, em
#    /usr/share/nginx/html/index.html).
# 8. Output "url": "http://127.0.0.1:<porta>".
