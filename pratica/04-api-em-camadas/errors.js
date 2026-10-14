// P2 · Erros do domínio. A camada de serviço lança-os; só a camada HTTP sabe que códigos lhes dar.
//
// Exporta três classes:
//   DomainError    → base de todos os erros "esperados" do domínio (estende Error)
//   NotFoundError  → estende DomainError; o construtor recebe o que não foi encontrado,
//                    ex.: new NotFoundError('Nota') tem a mensagem "Nota não encontrada"
//   ConflictError  → estende DomainError; o construtor recebe a mensagem
// Em todas, err.name tem de ser o nome da classe (ex.: "NotFoundError"), para aparecer bem nos logs.
