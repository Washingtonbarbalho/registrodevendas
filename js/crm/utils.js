const formatCurrency = val => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL'
}).format(val || 0);
const parseMoney = valStr => {
  if (!valStr) return 0;
  if (typeof valStr === 'number') return valStr;
  const clean = valStr.replace(/\./g, '').replace(',', '.');
  return parseFloat(clean) || 0;
};
const maskMoney = value => {
  let v = value.replace(/\D/g, "");
  v = (v / 100).toFixed(2) + "";
  v = v.replace(".", ",");
  v = v.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");
  return v;
};
const formatDate = dateStr => {
  if (!dateStr) return '--/--/----';
  const isoDate = dateStr.split('T')[0];
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
};
const calculateDaysAgo = dateStr => {
  if (!dateStr) return Infinity;
  const saleDate = new Date(dateStr.split('T')[0]);
  const today = new Date();
  const diffTime = Math.abs(today - saleDate);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};
const getCurrentMonthStart = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toLocaleDateString('pt-BR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).split('/').reverse().join('-');
};
const getCurrentMonthEnd = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toLocaleDateString('pt-BR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).split('/').reverse().join('-');
};
const getPointMessageText = (name, points, storeName) => {
  const firstName = name.split(' ')[0];
  return `🎉 *PLANO FIDELIDADE*\n━━━━━━━━━━━━━━━━━━━\n\nOlá ${firstName}, tudo bem? 🎁\nPassando para te avisar que ganhou mais um ponto no nosso Fidelidade da *${storeName}*!\n\n📊 *Status:* ${points} de 7 pontos.\n\nContinue a comprar para resgatar o seu prêmio!\n\n━━━━━━━━━━━━━━━━━━━\nObrigado pela preferência!`;
};
const getRewardMessageText = (name, rewardValue, storeName) => {
  const firstName = name.split(' ')[0];
  return `🏆 *PRÊMIO DESBLOQUEADO*\n━━━━━━━━━━━━━━━━━━━\n\nParabéns ${firstName}! ✨\nVocê completou *7 pontos* no Plano Fidelidade da *${storeName}*!\n\n💵 *Crédito Disponível:* ${formatCurrency(rewardValue)}\n\nVenha nos visitar e trocar seu crédito por produtos!\n\n━━━━━━━━━━━━━━━━━━━\nTe aguardamos!`;
};
const getVipMessageText = (name, storeName) => {
  const firstName = name.split(' ')[0];
  return `⭐ *CLIENTE VIP*\n━━━━━━━━━━━━━━━━━━━\n\nOlá ${firstName}, tudo bem? 💖\nPassando aqui apenas para te agradecer!\n\nVocê é um dos nossos clientes VIP na *${storeName}*. É uma honra ter você com a gente.\n\nComo forma de agradecimento, temos algo especial preparado para a sua próxima compra!\n\n━━━━━━━━━━━━━━━━━━━\nMuito obrigado pela confiança!`;
};
const getMissYouMessageText = (name, storeName) => {
  const firstName = name.split(' ')[0];
  return `🛍️ *SENTIMOS SUA FALTA*\n━━━━━━━━━━━━━━━━━━━\n\nOlá ${firstName}! 🥺\nFaz um tempinho que não te vemos por aqui na *${storeName}*.\n\nChegaram várias novidades incríveis, que tal dar uma olhadinha?\n\nTemos uma condição super especial para você voltar!\n\n━━━━━━━━━━━━━━━━━━━\nAguardamos sua visita!`;
};
const getFeedbackMessageText = (name, storeName) => {
  const firstName = name.split(' ')[0];
  return `😊 *PÓS-VENDA*\n━━━━━━━━━━━━━━━━━━━\n\nOlá ${firstName}!\nMuito obrigado pela sua compra recente na *${storeName}*!\n\nEsperamos que esteja a gostar dos seus produtos. Está tudo certinho?\n\nQualquer dúvida ou se precisar de ajuda, estamos à inteira disposição!\n\n━━━━━━━━━━━━━━━━━━━\nUm excelente dia!`;
};

export { formatCurrency, parseMoney, maskMoney, formatDate, calculateDaysAgo, getCurrentMonthStart, getCurrentMonthEnd, getPointMessageText, getRewardMessageText, getVipMessageText, getMissYouMessageText, getFeedbackMessageText };
