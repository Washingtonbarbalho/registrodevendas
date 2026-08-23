export class InventoryReliabilityError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'InventoryReliabilityError';
    this.code = code;
    this.details = details;
  }
}

const wholeQuantity = (value, label) => {
  const quantity = Number(value);
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new InventoryReliabilityError(
      'invalid-quantity',
      `${label || 'Produto'}: informe uma quantidade inteira maior que zero.`
    );
  }
  return quantity;
};

export const aggregateSaleItems = (items = []) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new InventoryReliabilityError('empty-sale', 'Adicione pelo menos um produto antes de concluir a venda.');
  }
  const aggregated = new Map();
  for (const item of items) {
    if (!item?.productId) {
      throw new InventoryReliabilityError('invalid-product', 'Um item da venda não está vinculado a um produto válido. Atualize a página e tente novamente.');
    }
    const productId = String(item.productId);
    const productName = String(item.productName || item.name || 'Produto');
    const quantity = wholeQuantity(item.quantity, productName);
    const current = aggregated.get(productId);
    if (current) current.requestedQuantity += quantity;
    else aggregated.set(productId, { productId, productName, requestedQuantity: quantity });
  }
  return [...aggregated.values()];
};

export const buildSaleInventoryPlan = (requestedItems = [], inventoryRecords = []) => {
  const inventory = new Map((Array.isArray(inventoryRecords) ? inventoryRecords : []).map(record => [String(record.productId), record]));
  return requestedItems.map(requested => {
    const record = inventory.get(String(requested.productId));
    if (!record) {
      throw new InventoryReliabilityError(
        'product-not-found',
        `${requested.productName}: o produto não foi encontrado. Atualize a página e tente novamente.`,
        { productId: requested.productId }
      );
    }

    const currentQuantity = Number(record.quantity);
    if (!Number.isInteger(currentQuantity) || currentQuantity < 0) {
      throw new InventoryReliabilityError(
        'invalid-stock',
        `${requested.productName}: o saldo de estoque está inválido e precisa ser corrigido.`,
        { productId: requested.productId, currentQuantity }
      );
    }
    if (requested.requestedQuantity > currentQuantity) {
      throw new InventoryReliabilityError(
        'insufficient-stock',
        `${requested.productName}: estoque disponível é ${currentQuantity} un., mas a venda solicita ${requested.requestedQuantity} un.`,
        { productId: requested.productId, currentQuantity, requestedQuantity: requested.requestedQuantity }
      );
    }

    return {
      productId: requested.productId,
      productName: requested.productName,
      previousQuantity: currentQuantity,
      requestedQuantity: requested.requestedQuantity,
      newQuantity: currentQuantity - requested.requestedQuantity
    };
  });
};
