# O módulo "site": um contentor Nginx que serve uma página com uma mensagem.
#
# 1. Também precisa de um bloco terraform com required_providers do kreuzwerker/docker.
#    (Sem ele, o Terraform assume "hashicorp/docker", que não existe. Experimenta tirá-lo!)
# 2. Uma docker_image nginx:1.27-alpine, com keep_locally = true.
# 3. Um docker_container com o nome var.nome, a porta 80 publicada em 127.0.0.1:var.porta, e um
#    index.html com var.mensagem (bloco upload).
