// Assuming sortedProducts is an array of product objects with a property code
function generateNextProductCode(sortedProducts) {
    const lastCode = sortedProducts.length ? sortedProducts[sortedProducts.length - 1].code : '0';
    const numericCode = parseInt(lastCode.replace(/\D/g, ''), 10) || 0;
    return (numericCode + 1).toString();
}

// Replace the logic in your app.js appropriately where generateNextProductCode is used
