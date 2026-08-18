const replaceRequired = (source, marker, replacement, label) => {
  if (!source.includes(marker)) throw new Error(`Não foi possível preparar ${label}.`);
  return source.replace(marker, replacement);
};

export const applyProfitPatch = source => {
  const historyMarker = `        const getHistoryReceivedAmount = (historyItem) => {`;
  const profitHelper = `        const getDirectProfitNetAmount = (sale) => {
            const originalNet = getDirectNetAmount(sale);
            const cancellationImpact = (sale.cancellations || []).reduce((sum, event) => {
                const impact = event?.storeImpactAmount ?? event?.refundAmount ?? 0;
                return sum + (Number(impact) || 0);
            }, 0);
            return Math.max(0, originalNet - cancellationImpact);
        };
`;
  source = replaceRequired(source, historyMarker, profitHelper + historyMarker, 'o lucro líquido após cancelamentos');

  source = replaceRequired(
    source,
    `                    realProfit += netDirect - (s.totalCost || 0);`,
    `                    realProfit += getDirectProfitNetAmount(s) - (s.totalCost || 0);`,
    'o lucro real das vendas diretas'
  );

  source = replaceRequired(
    source,
    `                return acc + (getDirectNetAmount(s) - (s.totalCost || 0));`,
    `                return acc + (getDirectProfitNetAmount(s) - (s.totalCost || 0));`,
    'o lucro estimado das vendas diretas'
  );

  return source;
};
