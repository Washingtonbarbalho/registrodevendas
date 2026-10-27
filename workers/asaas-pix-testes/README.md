# Asaas Pix: conexão Sandbox e diagnóstico Firebase

Este Worker prepara a integração Pix do Registro de Vendas. **A etapa 4 acrescenta o cadastro da chave Asaas Sandbox pelo perfil de cada usuário, com criptografia e isolamento de contas.** Mantém os diagnósticos anteriores. A aplicação v101 inclui a opção de conectar, testar a chave salva, selecionar Pix manual e remover a integração. Ainda não cria cobranças nem recebe Webhooks financeiros: o caixa, os QR Codes manuais e os pagamentos de parcelas continuam com seu comportamento atual.

Os diagnósticos Firebase acessam somente a coleção `_pix_connection_check`. O teste de gravação cria, atualiza, lê e exclui um documento temporário. A configuração por usuário usa a coleção privada `_asaas_integrations`; não grava chaves no perfil comum nem no diretório público de usuários.

Endereço informado para o Worker de testes:

https://registro-vendas-pix-testes.washington-wn8.workers.dev

## Publicar pelo painel da Cloudflare

1. Abra **Workers & Pages → registro-vendas-pix-testes → Edit code**.
2. Substitua o código inicial pelo conteúdo completo de `worker.js`, desta pasta, e clique em **Deploy**.
3. Em **Settings → Variables and Secrets**, confira:

| Tipo | Nome | Valor |
| --- | --- | --- |
| Secret | `ASAAS_API_KEY` | Chave da conta **Sandbox** do Asaas |
| Text | `ASAAS_BASE_URL` | `https://api-sandbox.asaas.com/v3` |
| Secret | `FIREBASE_SERVICE_ACCOUNT` | JSON completo da conta de serviço do projeto `vendas-aura` |
| Secret | `SETUP_TOKEN` | Código de configuração de 64 caracteres já cadastrado |
| Secret | `PIX_ENCRYPTION_KEY` | Chave aleatória de 64 caracteres hexadecimais gerada no próprio navegador pela página do Worker |

4. Abra o endereço público do Worker. A página exibirá **Teste de conexão com o Asaas e Firebase**.
5. Para a primeira configuração de proteção, clique em **Gerar chave de proteção → Copiar chave de proteção**. Cadastre o valor como Secret `PIX_ENCRYPTION_KEY` e clique em **Deploy**. Não envie esse valor na conversa. Se esse Secret já existir, preserve o valor: substituí-lo impede abrir as chaves anteriormente criptografadas. Rotação exige uma migração específica.
6. Cole o código `SETUP_TOKEN` já configurado e clique em **Testar proteção**. Não cole a chave do Asaas nem o JSON do Firebase no campo da página. Os outros botões repetem os diagnósticos anteriores.
7. Se tiver perdido `SETUP_TOKEN`, gere outro código de configuração e atualize somente esse Secret antes de testar.
8. Depois de validar o Worker e a proteção, publique os arquivos da aplicação v101. No perfil, selecione **Asaas — ambiente de testes**, informe sua chave Sandbox e clique em **Salvar conexão Asaas**. O campo da chave será limpo. Clique em **Testar chave salva** para validar a recuperação da chave no banco.

A origem permitida da aplicação é `https://washingtonbarbalho.github.io`, correspondente ao GitHub Pages do repositório. Se o sistema passar a usar outro domínio, configure a variável de texto `APP_ORIGIN` com a origem exata, incluindo `https://`, sem caminho ou barra final. As APIs do perfil recusam outras origens, não usam cookies e exigem ID token do Firebase em todas as operações. `SETUP_TOKEN` protege somente os diagnósticos e não autoriza configurar contas de usuários.

Para gerar a credencial Firebase: no projeto `vendas-aura`, abra **Configurações do projeto → Contas de serviço → Firebase Admin SDK → Gerar nova chave privada**. Copie o JSON completo para o Secret `FIREBASE_SERVICE_ACCOUNT`. Ele contém a chave privada e nunca deve ser colocado no código público, no perfil carregado pelo navegador ou em uma conversa. O Worker usa OAuth com escopo `datastore` e destinos fixos; ignora URLs externas vindas do JSON.

O sucesso do teste de leitura comprova autenticação e leitura. O sucesso do teste completo comprova também criação, atualização e exclusão do diagnóstico. As alterações e a limpeza usam precondições de versão para evitar sobrescrever ou apagar um documento que sofreu alteração concorrente. Se alguma etapa falhar, a resposta informa a etapa e se a limpeza foi confirmada. Quando não há confirmação, pode permanecer um documento sem dados pessoais nem credenciais na coleção de diagnóstico; a resposta identifica esse documento. Não são apagados documentos sem identidade ou versão reconhecida.

Se houver erro de permissão, revise o IAM da conta de serviço. Não altere as regras do Firestore para acesso público: a credencial de servidor é autorizada por IAM.

## Cadastro privado por usuário

- O navegador envia seu ID token atual. O Worker valida emissor, projeto, validade e UID, e consulta o Firebase Auth REST para validar a autenticidade do token, usuário desabilitado e revogação. Depois confere aprovação e status em `artifacts/vendas-aura-main/users/{uid}/profile/info`.
- O UID é obtido da identidade validada. Não é aceito um UID ou caminho fornecido pelo formulário. Administradores também configuram apenas sua própria integração por essas rotas.
- A chave Asaas é validada somente no Sandbox. A variável global `ASAAS_API_KEY`, usada no diagnóstico inicial, não é usada nas integrações individuais.
- O Worker usa AES-256-GCM, IV aleatório de 12 bytes e dados autenticados vinculados ao projeto, ambiente, versão e UID. Salva somente cifra, IV e metadados em `_asaas_integrations/{uid}`. `PIX_ENCRYPTION_KEY` permanece somente no Worker.
- As regras atuais de `firestore.rules` recusam acesso direto do aplicativo à coleção privada pelo bloqueio final. Não adicione permissões de cliente a essa coleção.
- As respostas de perfil devolvem somente estado, ambiente e datas. Não devolvem chave, cifra, IV, tokens ou JSON da conta de serviço. O campo da chave é transitório e é limpo após salvar e ao fechar o perfil. Não há persistência da chave em armazenamento do navegador.
- Atualização e exclusão usam a versão do documento como precondição. Conflitos são informados sem sobrescrever a configuração concorrente.
- O Web API Key do Firebase no Worker é o mesmo identificador público já usado em `firebase-config.js`; ele identifica o projeto no Firebase Auth REST e não substitui o ID token do usuário nem a chave privada da conta de serviço.

Mantenha o código de configuração em local privado. A página não usa armazenamento local e não guarda esse código entre visitas. Não envie chaves ou códigos em conversas, capturas de tela, logs ou commits.

O teste informa se a API respondeu e se há uma chave Pix **ativa no Sandbox**. Ele não exibe CPF, saldo, chave Pix, chave de API nem respostas brutas do Asaas. Também não confirma que a conta ou as condições comerciais de Produção estejam aprovadas.

## Rotas

- `GET /`: página para preparar e executar o diagnóstico.
- `GET /health`: identifica a etapa de diagnóstico; não consulta os provedores nem revela segredos.
- `POST /api/setup/check`: consulta somente `GET /v3/pix/addressKeys?status=ACTIVE&limit=1`, mediante o cabeçalho privado `X-Setup-Token`. A URL de Produção e qualquer outro destino são recusados.
- `POST /api/setup/firebase-check`: com o mesmo `X-Setup-Token`, assina um JWT RS256 usando Web Crypto, obtém um token OAuth e faz `GET` na coleção de diagnóstico. Respostas brutas, tokens, e-mail da conta de serviço e chave privada não são devolvidos. OAuth e Firestore compartilham um prazo de 20 segundos, com redirecionamentos bloqueados.
- `POST /api/setup/firebase-write-check`: com o mesmo `X-Setup-Token`, obtém um token OAuth e cria um diagnóstico aleatório, atualiza somente seu campo `stage`, confere a persistência e exclui o documento com precondição `updateTime`. Uma falha aciona uma tentativa de limpeza de até 8 segundos, somente na última versão reconhecida. O navegador aguarda até 45 segundos. Caminhos, IDs de usuários e documentos enviados pelo cliente são ignorados; os destinos são fixos.
- `POST /api/setup/encryption-check`: exige `X-Setup-Token`; testa cifragem e decifragem de um valor descartável sem acessar provedores ou persistir dados.
- `GET /api/integrations/asaas`: exige ID token e origem permitida; devolve somente os metadados da integração do usuário.
- `PUT /api/integrations/asaas`: recebe JSON de até 4096 bytes, somente campos `apiKey` e `enabled`; valida e cifra a chave antes de salvar. Sem nova chave, permite selecionar Pix manual ou reativar a chave salva após testar.
- `POST /api/integrations/asaas/test`: recupera e decifra a chave privada do usuário, testa no Sandbox e atualiza os metadados. O navegador não precisa reenviar a chave.
- `DELETE /api/integrations/asaas`: remove somente a configuração do usuário autenticado, com precondição de versão.
- Nenhuma rota de Webhook está habilitada nesta etapa. Não configure ainda um Webhook de pagamentos apontando para este código: a rota retornará `404`.

## Verificação local

Na raiz do repositório:

```sh
npm run test:pix-setup
```

Os testes usam respostas simuladas e chaves RSA descartáveis geradas localmente. Não chamam o Asaas ou o Google reais nem movimentam dinheiro. Não são uma homologação da conta real ou do endpoint publicado.

Na raiz, `npm run check` valida a aplicação e inclui `npm run test:pix-profile`, com testes de autenticação, isolamento, criptografia, revogação, conflitos, transporte e cancelamento do cliente. O diagnóstico inicial permanece em `npm run test:pix-setup`.

Para também verificar a execução no runtime do Cloudflare Workers (workerd), instale as dependências de teste desta pasta e execute:

```sh
cd workers/asaas-pix-testes
npm ci
npm test
```

Os testes no workerd usam a chamada `fetch` do Worker e simulam os servidores Asaas, OAuth Google e Firestore. Verificam importação PKCS8, assinatura RSA, leitura, ciclo de gravação e limpeza com precondições e bloqueio de redirecionamentos. Os testes Node também cobrem conflitos, falhas de permissão, mudanças concorrentes, caminhos retornados pelo servidor e timeouts após uma atualização possivelmente persistida. Workers aceita `redirect: 'manual'` ou `redirect: 'follow'`; as consultas usam `manual` e recusam respostas 3xx para não encaminhar credenciais a outro endereço.

## Próxima etapa

Após validar a conexão pelo perfil e o teste da chave recuperada do banco, implementar criação de cobranças Sandbox, pedidos pendentes, reservas de estoque, Webhooks autenticados e reconciliação. As baixas usarão uma identificação exclusiva do pagamento e uma transação do banco para impedir duplicidades. A substituição ou remoção de credenciais precisará considerar cobranças pendentes antes de ativar esses fluxos financeiros. A conexão atual, por si só, não confirma vendas ou parcelas e não recebe Pix reais.

As credenciais do Firebase, o código do Worker e as regras do Firestore não devem liberar acesso público às vendas. A integração financeira precisa ser testada antes da ativação no caixa e nas parcelas.

## Referências oficiais

- https://docs.asaas.com/reference/listar-chaves
- https://docs.asaas.com/docs/sandbox
- https://docs.asaas.com/docs/chaves-de-api
- https://developers.cloudflare.com/workers/configuration/secrets/
- https://developers.cloudflare.com/workers/runtime-apis/web-crypto/
- https://developers.google.com/identity/protocols/oauth2/service-account
- https://docs.cloud.google.com/firestore/docs/reference/rest/v1/projects.databases.documents/list
- https://docs.cloud.google.com/firestore/docs/reference/rest/v1/projects.databases.documents/createDocument
- https://docs.cloud.google.com/firestore/docs/reference/rest/v1/projects.databases.documents/patch
- https://docs.cloud.google.com/firestore/docs/reference/rest/v1/projects.databases.documents/delete
- https://docs.cloud.google.com/firestore/docs/reference/rest/v1/Precondition
- https://firebase.google.com/docs/reference/rest/auth#section-get-account-info
- https://firebase.google.com/docs/auth/admin/verify-id-tokens
