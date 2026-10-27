# Asaas Pix: testes do caixa e das parcelas no Sandbox

Este Worker prepara a integração Pix do Registro de Vendas. **A etapa 6 permite gerar uma cobrança de homologação a partir do carrinho do caixa ou do saldo atual de uma parcela.** O pagamento confirmado gera uma venda ou parcela em uma cópia privada de teste, com recibo único e baixa de estoque simulada. A aplicação v103 mantém a escolha manual como padrão e identifica o Sandbox em todos os pontos de entrada. Nenhum desses testes grava vendas, parcelas, saldo ou estoque reais.

O teste inicial de R$ 5,00 e seu retorno automático já devem estar concluídos para a chave conectada antes desses novos testes. As credenciais existentes, o endereço do Worker, o Webhook autenticado e as regras do Firestore continuam válidos. Não há ativação de Produção nesta versão.

Os diagnósticos Firebase acessam somente a coleção `_pix_connection_check`. O teste de gravação cria, atualiza, lê e exclui um documento temporário. A configuração por usuário usa `_asaas_integrations`; a cobrança inicial fica em `_asaas_sandbox_checks/{uid}`. As novas cópias, intenções pendentes, vínculos e recibos ficam sob `_asaas_flow_sandbox/{uid}`. Todas são coleções privadas, bloqueadas pelo fechamento das regras atuais. Não há chaves no perfil comum nem no diretório público de usuários.

## Testar no sistema v103

1. Abra `integrations/atualizar-worker.html?v=103-partes`. A página oferece **Copiar primeira parte** e **Copiar segunda parte** do código completo, sem compactação, divididas em quantidades de linhas aproximadamente iguais. Confere o tamanho e o SHA-256 do arquivo e de cada parte antes de liberar os botões. Só renderiza uma parte em uma caixa de texto se a cópia automática falhar.
2. No editor Cloudflare do Worker existente, apague o código antigo e cole a primeira parte. Depois cole a segunda no final da primeira, sem apagá-la. Publique com Deploy somente com as duas partes juntas. Preserve todos os Secrets, especialmente `PIX_ENCRYPTION_KEY`. Não há novos Secrets.
3. No caixa, adicione produtos normalmente, selecione Pix e marque **Testar Pix automático do Asaas (Sandbox)**. O botão passa a **Gerar Pix de teste**. A opção de teste começa desmarcada; não há mudança automática para recebimento manual se o Asaas estiver indisponível.
4. Gere o Pix e use **Simular pagamento no Sandbox**. A resposta da simulação não conclui o pedido. A confirmação vem do Webhook autenticado, após conferir a cobrança na API. **Conferir no Asaas** permite conciliar uma entrega que atrasou; a interface identifica a origem da confirmação.
5. Nas parcelas, abra o recebimento normal e use **Testar Pix Asaas da parcela inteira**. O servidor usa o saldo do registro atual, sem aceitar um valor ou uma confirmação enviados pelo navegador. Os pagamentos parciais manuais continuam no fluxo original. Se a parcela for paga, editada ou cancelada durante a simulação, o resultado fica para conferência.
6. Feche e retome pedidos em **Meu Perfil → Testes pendentes**. Há no máximo cinco pendências por usuário. Cada intenção conserva seu identificador nas repetições. Uma parcela com teste pendente não pode gerar outro até o anterior ser encerrado. Ações de cancelar conferem o estado no Asaas antes de liberar a pendência; cancelar não significa reembolsar valores recebidos.
7. Enquanto houver teste pendente, não é possível remover ou substituir sua credencial nem desativar a integração. O perfil informa a pendência. Conclua ou cancele os testes primeiro.

Os testes aceitam de 1 a 10 linhas de carrinho e valores totais entre R$ 5,00 e R$ 50.000,00. Usam cliente fictício, sem e-mail ou telefone, com notificações desabilitadas. Produtos e contratos originais são lidos somente para formar e conferir a cópia. O módulo do servidor possui uma restrição adicional que recusa qualquer escrita fora do espaço privado de testes e dos metadados da própria integração.

## Intenções, recibos e consistência

As intenções são salvas antes das chamadas que criam recursos no Asaas. Checkpoints, referência externa, trava com vencimento e precondições de versão permitem retomar respostas interrompidas. Quando uma criação pode ter ocorrido e ainda não aparece na consulta, o POST não é repetido automaticamente.

O resultado, o recibo, a retirada da lista de pendências e o contador da credencial são gravados juntos em `documents:commit`, com precondições em cada documento. Uma falha ou disputa não aplica metade do resultado. Duplicatas não criam outro recibo nem liberam o contador duas vezes. Uma reserva privada impede novas intenções da mesma parcela enquanto houver outra pendente. Reembolsos conferidos estornam somente o resultado da simulação; estados incompatíveis exigem conferência. Não há escrita financeira real para estornar nesta etapa.

O cálculo da parcela e o plano de estoque usam as mesmas funções puras do aplicativo (`financial-core-v70.js` e `inventory-reliability-v69.js`). A cópia preserva o histórico da parcela e vincula o novo item ao ID do pagamento Asaas. O plano de estoque pertence à cópia de cada pedido e não reserva unidades do estoque real.

## Código de manutenção e código para celular

`worker.entry.js` e `flow.js` são as fontes. Execute `npm ci` e `npm run build` nesta pasta para gerar `worker.js`, o pacote completo independente, e `worker-mobile.js`, o pacote compacto para o editor do celular. Não edite os arquivos gerados diretamente.

Ambos contêm as APIs e todas as funções de integração. O compacto usa uma página inicial resumida, sem o formulário antigo de diagnóstico; os diagnósticos continuam disponíveis pelas rotas protegidas. `worker-mobile-manifest.json` registra o tamanho e o SHA-256 do pacote. Nenhum pacote busca ou executa código remoto em tempo de execução.

O build também gera `worker-full-manifest.json`, com as linhas de divisão e o tamanho e SHA-256 das duas metades de `worker.js`. A página de cópia usa exclusivamente esse pacote completo e preserva todos os seus bytes ao juntar as partes. A divisão ocorre junto a uma declaração de nível superior perto da metade das linhas. As partes isoladas não são um Worker publicável.

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
8. Depois de validar o Worker e a proteção, publique os arquivos da aplicação v103. No perfil, selecione **Asaas — ambiente de testes**, informe sua chave Sandbox e clique em **Salvar conexão Asaas**. O campo da chave será limpo. Clique em **Testar chave salva** para validar a recuperação da chave no banco.
9. Para atualizar um Worker já configurado pelo celular, a página `integrations/atualizar-worker.html` copia `worker.js` em duas partes. Cole a segunda no final da primeira e só então publique. Preserve todos os Secrets existentes; nenhuma chave nova é necessária nesta etapa.
10. Em **Meu Perfil → Teste de cobrança e retorno automático**, toque em **Criar cobrança de teste**. O Worker cria ou recupera um Webhook próprio, um cliente fictício e uma cobrança Pix de R$ 5,00 na conta Sandbox conectada. O cliente usa o CPF de exemplo da documentação oficial Asaas (`24971563792`), sem e-mail ou telefone e com notificações desabilitadas. O e-mail da identidade validada no Firebase é usado somente como contato do Webhook, exigido pelo Asaas.
11. Toque em **Simular pagamento no Sandbox**. Não use o banco para pagar o QR Code. A simulação usa a rota exclusiva de Sandbox e não movimenta dinheiro real. A tela consulta o retorno salvo no Firebase a cada oito segundos por até dois minutos, enquanto estiver visível. Não faz polling de cobranças no Asaas. É possível reabrir o perfil e tocar em **Verificar retorno**.
12. O teste só conclui com status `RECEIVED` consultado pelo servidor e um Webhook autenticado. `CONFIRMED` não é tratado como recebido. A simulação, por si só, não grava um sucesso local. Se o aviso não chegar, confira os Logs de Webhooks do Asaas e se a Cloudflare permite o POST autenticado no endereço exato, sem redirecionamentos. Não libere o Firestore nem exponha os Secrets.

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
- `GET /api/integrations/asaas/sandbox-charge`: exige origem e ID token; carrega somente o teste da conta conectada, sem consultar o Asaas.
- `POST /api/integrations/asaas/sandbox-charge`: prepara ou retoma a cobrança isolada. Não aceita corpo com valores, clientes ou IDs. Usa uma trava com versão e vencimento; salva referência e checkpoints antes de criar recursos. Em timeout, procura pela referência antes de retomar. Se uma criação pode ter ocorrido mas não aparece na consulta, não repete o POST automaticamente. A resposta pede conferir o Sandbox.
- `POST /api/integrations/asaas/sandbox-charge/simulate`: aceita somente a cobrança isolada preparada para esse usuário e essa chave. Confere ID, cliente, referência, tipo PIX e valor exato de R$ 5,00 na API antes de chamar `/sandbox/payment/{id}/confirm`. Não altera o estado recebido no Firebase.
- `POST /api/webhooks/asaas/sandbox/{uid}`: recebe avisos da cobrança inicial e dos pedidos de homologação do caixa e das parcelas. Exige `asaas-access-token` específico do usuário, calculado com HMAC-SHA256 e domínio próprio a partir do Secret existente. O token é enviado diretamente ao Asaas e não aparece na resposta ou interface. Valida corpo limitado a 128 KiB, cobrança armazenada, integração ainda ativa, perfil aprovado e chave correspondente. Consulta a cobrança na API com destino fixo e confere todos os vínculos antes de salvar status. Eventos repetidos não duplicam registros. Precondições de versão impedem sobrescrever atualizações concorrentes; falhas pedem repetição da entrega. Avisos de outras cobranças são ignorados. Nenhuma rota de baixa financeira real está habilitada.
- `GET /api/integrations/asaas/flow/charges`: lista os testes pendentes do usuário autenticado.
- `POST /api/integrations/asaas/flow/charges`: cria ou recupera uma intenção do caixa (`kind`, `idempotencyKey`, `items` com produto, quantidade e total da linha em centavos) ou de parcela (`kind`, `saleId`, `installmentIndex`). Recusa ambiente, UID, caminhos, clientes e outros campos fornecidos pelo navegador.
- `GET /api/integrations/asaas/flow/charges/{id}`: devolve somente o andamento e um resumo seguro do teste.
- `POST /api/integrations/asaas/flow/charges/{id}/prepare`: retoma a preparação de uma intenção já salva.
- `POST /api/integrations/asaas/flow/charges/{id}/simulate`: simula somente a cobrança vinculada à intenção e à chave do usuário, no endpoint exclusivo do Sandbox.
- `POST /api/integrations/asaas/flow/charges/{id}/reconcile`: confere a cobrança na API e aplica somente seu resultado de teste, com as mesmas precondições do Webhook.
- `POST /api/integrations/asaas/flow/charges/{id}/cancel`: cancela uma cobrança de teste ainda pendente ou um rascunho que comprovadamente não chegou a criar pagamento. Não reembolsa recebimentos.

## Verificação local

Na raiz do repositório:

```sh
npm run test:pix-setup
```

Os testes usam respostas simuladas e chaves RSA descartáveis geradas localmente. Não chamam o Asaas ou o Google reais nem movimentam dinheiro. Não são uma homologação da conta real ou do endpoint publicado.

Na raiz, `npm run check` valida a aplicação e inclui os testes de perfil, Sandbox e `test:pix-flow`. O formulário do caixa é exercitado nos modos manual e Sandbox, comprovando que o teste não chama a gravação de venda real. O diagnóstico inicial permanece em `npm run test:pix-setup`.

Para também verificar a execução no runtime do Cloudflare Workers (workerd), instale as dependências de teste desta pasta e execute:

```sh
cd workers/asaas-pix-testes
npm ci
npm test
```

`npm test` recompila e executa a mesma suíte contra o pacote completo e o compacto. Os testes no workerd cobrem os ciclos criar → simular → Webhook → recebido, tanto da cobrança inicial quanto do caixa e da parcela, com Asaas, OAuth e Firestore simulados. Os testes Node cobrem autenticação, isolamento, criptografia, valores divergentes, concorrência, falha atômica, recuperação após timeout, reembolso, cancelamento, limite de pendências e alterações manuais na origem. Não comprovam a homologação da conta publicada; ela depende do teste do usuário após o Deploy.

## Próxima etapa

Homologar pelo celular o caixa e a parcela, incluindo retomada de uma intenção pendente. Antes de habilitar recebimentos reais, implementar e testar a migração para credenciais de Produção, a reserva e liberação de estoque real e as baixas financeiras reais com leitura transacional da origem, política de cancelamento e reembolso, credenciais de cobranças em andamento e reconciliação. A implementação atual está deliberadamente restrita a cópias de homologação e não deve ser apresentada como integração de Produção pronta.

As credenciais do Firebase, o código do Worker e as regras do Firestore não devem liberar acesso público às vendas. A integração financeira precisa ser testada antes da ativação no caixa e nas parcelas.

## Referências oficiais

- https://docs.asaas.com/reference/listar-chaves
- https://docs.asaas.com/docs/sandbox
- https://docs.asaas.com/docs/chaves-de-api
- https://docs.asaas.com/reference/criar-novo-cliente
- https://docs.asaas.com/reference/criar-nova-cobranca
- https://docs.asaas.com/reference/obter-qr-code-para-pagamentos-via-pix
- https://docs.asaas.com/reference/confirmar-pagamento
- https://docs.asaas.com/reference/criar-novo-webhook
- https://docs.asaas.com/reference/excluir-cobranca
- https://docs.cloud.google.com/firestore/docs/reference/rest/v1/projects.databases.documents/commit
- https://docs.asaas.com/docs/sobre-os-webhooks
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
