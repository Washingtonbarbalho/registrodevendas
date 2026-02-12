// Payment Confirmation Modal
function showPaymentModal(installment) {
    let paidAmount = prompt('Enter the paid amount for installment ' + installment.id);

    if (paidAmount) {
        paidAmount = parseFloat(paidAmount);

        if (installment.isLast && paidAmount > installment.total) {
            alert('Excess payments are not allowed on the last installment!');
            return;
        }

        const remaining = installment.total - installment.paid;

        if (paidAmount > remaining) {
            installment.paid += remaining;
            const excess = paidAmount - remaining;
            alert('Excess payment of ' + excess + ' will be applied to the next installment.');
            if (installment.next) {
                installment.next.balance += excess;
            }
        } else {
            installment.paid += paidAmount;
        }

        updatePaymentHistory(installment.id, paidAmount);
        alert('Payment updated! Current paid amount: ' + installment.paid);
    }
}

// Track Payment History
const paymentHistories = {};

function updatePaymentHistory(installmentId, amount) {
    if (!paymentHistories[installmentId]) {
        paymentHistories[installmentId] = [];
    }
    paymentHistories[installmentId].push({ amount: amount, date: new Date() });
}

