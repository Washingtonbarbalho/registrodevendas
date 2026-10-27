# Asaas Pix: etapa de conexão no Sandbox

Este Worker prepara a integração Pix do Registro de Vendas. **Esta primeira etapa apenas verifica a autenticação no Asaas Sandbox e a existência de uma chave Pix ativa.** Não cria QR Codes, cobranças, pagamentos ou transferências, não acessa o Firebase e não altera a aplicação atual. As baixas automáticas do caixa e das parcelas ainda precisam ser implementadas.

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

4. Abra o endereço público do Worker. A página exibirá **Teste de conexão com o Asaas**.
5. Clique em **Gerar código** e depois em **Copiar código**. O código é criado localmente no seu navegador e não é a chave de API do Asaas.
6. Volte às configurações do Worker. Adicione um **Secret** chamado `SETUP_TOKEN`, cole o código e clique em **Deploy**.
7. Volte à página de teste e clique em **Testar conexão**. Se tiver fechado a página, cole o código salvo no campo **Código de configuração**.

Mantenha o código de configuração em local privado. A página não usa armazenamento local e não guarda esse código entre visitas. Não envie chaves ou códigos em conversas, capturas de tela, logs ou commits.

O teste informa se a API respondeu e se há uma chave Pix **ativa no Sandbox**. Ele não exibe CPF, saldo, chave Pix, chave de API nem respostas brutas do Asaas. Também não confirma que a conta ou as condições comerciais de Produção estejam aprovadas.

## Rotas

- `GET /`: página para preparar e executar o diagnóstico.
- `GET /health`: identifica esta etapa; não consulta o Asaas nem revela segredos.
- `POST /api/setup/check`: consulta somente `GET /v3/pix/addressKeys?status=ACTIVE&limit=1`, mediante o cabeçalho privado `X-Setup-Token`. A URL de Produção e qualquer outro destino são recusados.
- Nenhuma rota de Webhook está habilitada nesta etapa. Não configure ainda um Webhook de pagamentos apontando para este código: a rota retornará `404`.

## Verificação local

Na raiz do repositório:

```sh
npm run test:pix-setup
```

Os testes usam respostas simuladas e não chamam o Asaas nem movimentam dinheiro. Não são uma homologação da conta real ou do endpoint publicado.

Para também verificar a execução no runtime do Cloudflare Workers (workerd), instale as dependências de teste desta pasta e execute:

```sh
cd workers/asaas-pix-testes
npm ci
npm test
```

O teste no workerd usa a mesma chamada `fetch` do Worker e simula somente o servidor Asaas. Isso verifica a compatibilidade do runtime, além da lógica testada no Node. Workers aceita `redirect: 'manual'` ou `redirect: 'follow'`; a consulta usa `manual` e recusa respostas 3xx para não encaminhar a credencial a outro endereço.

## Próxima etapa

Após confirmar a conexão, preparar uma conta de serviço do Firebase com as permissões necessárias, cadastrar suas credenciais como Secrets e implementar a autenticação do usuário, o armazenamento de pedidos pendentes, as reservas de estoque, o tratamento de Webhooks e a reconciliação dos recebimentos. As baixas usarão uma identificação exclusiva do pagamento e uma transação do banco para impedir duplicidades.

As credenciais do Firebase, o código do Worker e as regras do Firestore não devem liberar acesso público às vendas. A integração financeira precisa ser testada antes da ativação no caixa e nas parcelas.

## Referências oficiais

- https://docs.asaas.com/reference/listar-chaves
- https://docs.asaas.com/docs/sandbox
- https://docs.asaas.com/docs/chaves-de-api
- https://developers.cloudflare.com/workers/configuration/secrets/
