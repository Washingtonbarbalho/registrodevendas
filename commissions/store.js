import { archiveCommission, grant, makeAgreement, makePayout, portfolio, productBase, quote, readBook, recordTransition, terms } from './core.js?v=111';

const must = (v, msg) => { if (!v) throw new Error(msg); };
const field = key => 'financialData.commissionBook.' + key;
export const stampFor = (user, name, date, at = new Date().toISOString()) => ({
  date, at, actor: user.uid, by: name || user.email || user.uid
});
export const bookFrom = snapshot => readBook(snapshot.data()?.financialData?.commissionBook);
const activeSeller = (book, id) => book.sellers.find(s => s.id === id && s.active !== false);

export function createSaleCommission(sale, draft, book, stamp) {
  const c = terms(activeSeller(book, draft.sellerId), draft.expenseCents);
  c.grants.push(grant({ ...stamp, id: 'sale:' + sale.id, mode: draft.mode, units: draft.units,
    kind: 'sale', reason: 'Comissão combinada na venda' }, productBase(sale)));
  return recordTransition(null, { ...sale, commission: c }, stamp);
}

export function archiveBeforeDelete(tx, ref, book, sale) {
  if (!book.archives.some(s => s.id === sale.id)) {
    tx.update(ref, { [field('archives')]: [...book.archives, archiveCommission(sale)] });
  }
}

// Restrito ao perfil privado da loja. Atualizações por caminho preservam entries/accounts
// e os demais dados do perfil. Leituras e escritas relacionadas fazem parte da mesma transação.
export async function postCommission(env, cmd) {
  const { runTransaction, db, profileRef, saleRef, user, name, today } = env;
  const day = cmd.date || today;
  must(/^\d{4}-\d{2}-\d{2}$/.test(day) && day <= today && Number.isFinite(Date.parse(day))
    && new Date(day).toISOString().slice(0, 10) === day, 'Informe uma data válida, até hoje.');
  must(typeof cmd.id === 'string' && cmd.id.length > 0, 'Identificador da operação ausente.');
  const stamp = stampFor(user, name, day);
  return runTransaction(db, async tx => {
    const snapshot = await tx.get(profileRef);
    must(snapshot.exists(), 'O perfil da loja não foi encontrado.');
    const book = bookFrom(snapshot);
    const put = (key, value) => tx.update(profileRef, { [field(key)]: value });

    if (cmd.kind === 'seller') {
      const label = String(cmd.name || '').trim();
      const phone = String(cmd.phone || '').replace(/\D/g, '');
      must(label && label.length <= 90, 'Informe um nome de até 90 caracteres.');
      must(!phone || [10, 11, 12, 13].includes(phone.length), 'Informe o WhatsApp com DDD ou deixe em branco.');
      quote('percent', cmd.rate, 0);
      const old = book.sellers.find(v => v.id === (cmd.sellerId || cmd.id));
      if (cmd.sellerId) must(old, 'O vendedor não foi encontrado.');
      if (old && !cmd.sellerId) return old.id;
      const seller = { id: old?.id || cmd.id, name: label, phone, rate: cmd.rate, active: cmd.active !== false,
        createdAt: old?.createdAt || stamp.at, updatedAt: stamp.at, updatedBy: user.uid };
      put('sellers', old ? book.sellers.map(s => s.id === old.id ? seller : s) : [...book.sellers, seller]);
      return seller.id;
    }
    const seller = book.sellers.find(s => s.id === cmd.sellerId);
    must(seller, 'Selecione um vendedor cadastrado.');
    // O mesmo identificador em um reenvio não movimenta o saldo pela segunda vez.
    if ([...book.payouts, ...book.agreements, ...book.bonuses].some(e => e.id === cmd.id)) return cmd.id;
    const ids = [...new Set((cmd.kind === 'payout' ? (cmd.lines || []).map(l => l.saleId) : [cmd.saleId]).filter(Boolean))];
    const refs = ids.map(saleRef);
    const snapshots = await Promise.all(refs.map(ref => tx.get(ref)));
    const live = snapshots.flatMap((s, i) => s.exists() && !s.data().deleted ? [{ ...s.data(), id: ids[i] }] : []);
    const port = portfolio(live, book);
    const reason = String(cmd.reason || '').trim();
    must(reason.length <= 320, 'O motivo deve ter até 320 caracteres.');
    if (cmd.kind === 'credit') {
      must(seller.active !== false, 'Reative o vendedor antes de lançar uma nova comissão.');
      const sale = live[0];
      if (cmd.saleId) {
        must(sale && sale.status !== 'canceled', 'Selecione uma venda que não esteja cancelada ou excluída.');
        must(!sale.commission || sale.commission.sellerId === seller.id, 'Esta venda pertence a outro vendedor.');
        must(day >= sale.saleDate, 'O lançamento não pode anteceder a venda.');
        if (sale.commission?.grants.some(g => g.id === cmd.id)) return cmd.id;
      } else must(cmd.mode === 'fixed', 'Bônus sem venda deve ser informado em reais.');
      const credit = grant({ ...stamp, id: cmd.id, mode: cmd.mode, units: cmd.units, kind: 'credit', reason }, sale ? productBase(sale) : 0);
      if (!sale) put('bonuses', [...book.bonuses, { ...credit, sellerId: seller.id }]);
      else {
        const c = sale.commission || terms(seller, cmd.expenseCents ?? 0);
        const commission = { ...c, grants: [...c.grants, credit] };
        tx.update(refs[0], { commission: recordTransition(sale, { ...sale, commission }, stamp) });
      }
    } else if (cmd.kind === 'agreement') {
      const agreement = makeAgreement(port, { ...stamp, id: cmd.id, grantId: cmd.grantId, sellerId: seller.id, amount: cmd.amount, reason });
      put('agreements', [...book.agreements, agreement]);
    } else if (cmd.kind === 'payout') {
      const payout = makePayout(port, { ...stamp, id: cmd.id, sellerId: seller.id, sellerName: seller.name,
        lines: cmd.lines, offset: cmd.offset, method: cmd.method, reason });
      put('payouts', [...book.payouts, payout]);
    } else throw new Error('Tipo de lançamento desconhecido.');
    return cmd.id;
  });
}
