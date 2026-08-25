import { getBrazilDateString } from './utils.js';
import { money, projectSalesAsOf, sumMoney } from './financial-core-v70.js';
import {
  buildDailySalesEvolution,
  buildPeriodComparison,
  buildRecurringCustomers,
  buildReplenishmentForecast,
  getNetOperatingResult
} from './reports-engine-v73.js?v=86';
import {
  buildCollectionQueue,
  buildRepurchaseSuggestions,
  calculateMonthlyGoals,
  normalizeCommercialGoals
} from './commercial-engine-v74.js?v=86';

export const buildExecutiveInsights = ({
  sales = [], products = [], customers = [], financialData = {},
  userProfile = {}, startDate, endDate, today = getBrazilDateString()
} = {}) => {
  const effectiveEndDate = endDate && endDate < today ? endDate : today;
  const context = { sales, products, customers, financialData, startDate, endDate: effectiveEndDate };
  const result = getNetOperatingResult(context);
  const comparison = startDate && effectiveEndDate && startDate <= effectiveEndDate
    ? buildPeriodComparison(context) : null;
  const visible = projectSalesAsOf(sales, effectiveEndDate).filter(sale => (
    sale.status !== 'canceled' && sale.saleDate >= startDate && sale.saleDate <= effectiveEndDate
  ));
  const customersHistory = buildRecurringCustomers(context);
  const buyers = customersHistory.filter(customer => customer.periodSales.length > 0);
  const newCustomers = buyers.filter(customer => customer.firstDate >= startDate);
  const recurringCustomers = buyers.filter(customer => customer.recurrent);
  const forecast = buildReplenishmentForecast(context);
  const stockAlerts = forecast.filter(item => item.needsReplenishment);
  const collections = buildCollectionQueue({ sales, customers, today, horizonDays: 7 });
  const repurchases = buildRepurchaseSuggestions({ sales, products, customers, today, horizonDays: 14 });
  const goals = calculateMonthlyGoals({
    sales,
    customers,
    goals: normalizeCommercialGoals(userProfile?.commercialGoals),
    month: effectiveEndDate.slice(0, 7),
    today
  });
  const ticket = visible.length ? money(sumMoney(visible, sale => sale.totalPrice) / visible.length) : 0;

  return {
    startDate,
    endDate,
    effectiveEndDate,
    revenue: result.accrual.net,
    grossProfit: result.accrual.profit,
    netResult: result.netResult,
    salesCount: visible.length,
    ticket,
    buyers: buyers.length,
    newCustomers: newCustomers.length,
    recurringCustomers: recurringCustomers.length,
    stockAlerts: stockAlerts.length,
    stockoutProducts: forecast.filter(item => item.currentStock <= 0).length,
    pendingCollections: collections.length,
    repurchaseOpportunities: repurchases.length,
    comparison,
    dailyEvolution: buildDailySalesEvolution(context),
    goals,
    forecast,
    collections,
    repurchases
  };
};
