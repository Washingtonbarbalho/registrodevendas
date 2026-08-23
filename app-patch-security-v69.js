const replaceRequired = (source, marker, replacement, label) => {
  if (!source.includes(marker)) throw new Error(`Não foi possível preparar ${label}.`);
  return source.replace(marker, replacement);
};

const replaceBlock = (source, startMarker, endMarker, replacement, label) => {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error(`Não foi possível preparar ${label}.`);
  return source.slice(0, start) + replacement + '\n\n' + source.slice(end);
};

export const applySecurityReliabilityPatch = source => {
  const firestoreImport = 'import { collection, onSnapshot, query, doc, getDoc, updateDoc, deleteDoc, addDoc, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";';
  source = replaceRequired(
    source,
    firestoreImport,
    'import { collection, onSnapshot, query, doc, getDoc, updateDoc, deleteDoc, addDoc, serverTimestamp, setDoc, runTransaction, writeBatch } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";',
    'as operações atômicas do Firestore'
  );

  const utilsImport = "import { getCurrentMonthStart, getCurrentMonthEnd, getBrazilDateString, addDays, formatCurrency, formatDate } from './utils.js';";
  source = replaceRequired(
    source,
    utilsImport,
    utilsImport + "\nimport { aggregateSaleItems, buildSaleInventoryPlan } from './inventory-reliability-v69.js';",
    'a validação central de estoque'
  );

  const stockDirectionMarker = "        let isEntry = ['compra', 'ajuste_entrada', 'devolucao'].includes(movType);";
  source = replaceRequired(
    source,
    stockDirectionMarker,
    stockDirectionMarker + "\n\n        if (movQty <= 0) return alert('Informe uma quantidade inteira maior que zero.');\n        if (!isEntry && movQty > currentQty) return alert('Estoque disponível é ' + currentQty + ' un.');",
    'o bloqueio de estoque negativo nas movimentações'
  );

  source = replaceBlock(
    source,
    '    const handleAddSale = async (data) => {',
    '    const handleCancelSaleLogic = async (saleId, reason) => {',
    String.raw`    const handleAddSale = async (data) => {
        const saleRef = doc(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'sales'));
        const requestedItems = aggregateSaleItems(data?.items);

        try {
            await runTransaction(db, async transaction => {
                const productRefs = requestedItems.map(item => doc(db, 'artifacts', APP_ID, 'users', user.uid, 'products', item.productId));
                const productSnapshots = await Promise.all(productRefs.map(productRef => transaction.get(productRef)));
                const inventoryRecords = productSnapshots.map((snapshot, index) => snapshot.exists() ? {
                    productId: requestedItems[index].productId,
                    quantity: snapshot.data().quantity,
                    name: snapshot.data().name
                } : null).filter(Boolean);
                const inventoryPlan = buildSaleInventoryPlan(requestedItems, inventoryRecords);

                transaction.set(saleRef, {
                    ...data,
                    inventoryOperationId: saleRef.id,
                    inventoryCommittedAt: serverTimestamp()
                });
                inventoryPlan.forEach((plan, index) => {
                    transaction.update(productRefs[index], {
                        quantity: plan.newQuantity,
                        inventoryUpdatedAt: serverTimestamp()
                    });
                });
            });
            return saleRef.id;
        } catch (error) {
            console.error('Venda não concluída:', error);
            if (error?.name === 'InventoryReliabilityError') throw error;
            throw new Error('Não foi possível concluir a venda. Nenhuma venda ou baixa de estoque foi gravada. Tente novamente.');
        }
    };`,
    'a venda e a baixa de estoque como uma única operação'
  );

  source = replaceBlock(
    source,
    "        await updateDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'sales', saleId), {",
    '    const confirmCancelSale = async () => {',
    String.raw`        const saleRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'sales', saleId);
        const returnedByProduct = new Map();
        items.forEach(row => {
            if (!row.item.productId) return;
            const productId = String(row.item.productId);
            returnedByProduct.set(productId, (returnedByProduct.get(productId) || 0) + row.quantity);
        });
        const returnedItems = [...returnedByProduct.entries()].map(([productId, quantity]) => ({ productId, quantity }));
        const productRefs = returnedItems.map(item => doc(db, 'artifacts', APP_ID, 'users', user.uid, 'products', item.productId));

        await runTransaction(db, async transaction => {
            const snapshots = await Promise.all([transaction.get(saleRef), ...productRefs.map(productRef => transaction.get(productRef))]);
            const latestSaleSnapshot = snapshots[0];
            if (!latestSaleSnapshot.exists()) throw new Error('A venda não foi encontrada. Atualize a página e tente novamente.');
            const latestSale = latestSaleSnapshot.data();
            if (latestSale.status === 'canceled') throw new Error('Esta venda já foi cancelada.');

            const productSnapshots = snapshots.slice(1);
            productSnapshots.forEach((snapshot, index) => {
                if (!snapshot.exists()) throw new Error('Um produto da venda não foi encontrado. O cancelamento não foi realizado.');
                const currentQuantity = Number(snapshot.data().quantity);
                if (!Number.isInteger(currentQuantity) || currentQuantity < 0) throw new Error('O estoque de um produto está inválido. O cancelamento não foi realizado.');
            });

            transaction.update(saleRef, {
                status: 'canceled',
                cancelReason: String(reason || '').trim(),
                canceledAt: serverTimestamp(),
                cancellations: [...(latestSale.cancellations || []), event],
                lastCancellationAt: event.date,
                lastCancellationReason: event.reason
            });
            productSnapshots.forEach((snapshot, index) => {
                transaction.update(productRefs[index], {
                    quantity: Number(snapshot.data().quantity) + returnedItems[index].quantity,
                    inventoryUpdatedAt: serverTimestamp()
                });
            });
        });
    };`,
    'o cancelamento e a devolução ao estoque como uma única operação'
  );

  const cancelConfirmation = String.raw`    const confirmCancelSale = async () => {
        const reason = String(cancelModal.reason || '').trim();
        if (!reason) return alert('Informe o motivo do cancelamento.');
        await handleCancelSaleLogic(cancelModal.saleId, reason);
        setCancelModal({ open: false, saleId: null, reason: '' });
        setSelectedSaleDetail(null);
    };`;
  source = replaceRequired(
    source,
    cancelConfirmation,
    String.raw`    const confirmCancelSale = async () => {
        const reason = String(cancelModal.reason || '').trim();
        if (!reason) return alert('Informe o motivo do cancelamento.');
        try {
            await handleCancelSaleLogic(cancelModal.saleId, reason);
            setCancelModal({ open: false, saleId: null, reason: '' });
            setSelectedSaleDetail(null);
        } catch (error) {
            console.error('Cancelamento não concluído:', error);
            alert(error?.message || 'Não foi possível cancelar a venda. Nenhuma alteração foi gravada.');
        }
    };`,
    'o tratamento seguro de falhas no cancelamento'
  );

  const deleteRequest = "    const requestDelete = (type, id) => setDeleteModal({ open: true, type, id });";
  source = replaceRequired(
    source,
    deleteRequest,
    String.raw`    const requestDelete = (type, id) => {
        if (type === 'sale') return alert('Vendas não podem ser excluídas permanentemente. Use Cancelar venda para preservar o histórico e devolver os itens ao estoque.');
        setDeleteModal({ open: true, type, id });
    };`,
    'a preservação do histórico de vendas'
  );

  const deleteCollection = "        const col = type === 'sale' ? 'sales' : type === 'customer' ? 'customers' : 'products';";
  source = replaceRequired(
    source,
    deleteCollection,
    String.raw`        if (type === 'sale') {
            setDeleteModal({ open: false, type: null, id: null });
            return alert('A exclusão permanente de vendas foi desativada. Use o cancelamento para manter o estoque consistente.');
        }
        const col = type === 'customer' ? 'customers' : 'products';`,
    'a barreira defensiva contra exclusão direta de vendas'
  );

  source = replaceBlock(
    source,
    '    const handleUpdateProfile = async (updatedData) => {',
    '    const handleSavePaymentSettings = async settings => {',
    String.raw`    const handleUpdateProfile = async (updatedData) => {
        const privateProfile = {
            name: String(updatedData?.name || '').trim(),
            storeName: String(updatedData?.storeName || '').trim(),
            phone: String(updatedData?.phone || '').trim(),
            pixType: String(updatedData?.pixType || ''),
            pixKey: String(updatedData?.pixKey || '').trim(),
            pixBank: String(updatedData?.pixBank || '').trim(),
            pixName: String(updatedData?.pixName || '').trim(),
            updatedAt: serverTimestamp()
        };
        const directoryProfile = {
            name: privateProfile.name,
            storeName: privateProfile.storeName,
            phone: privateProfile.phone,
            updatedAt: serverTimestamp()
        };
        const batch = writeBatch(db);
        batch.update(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'profile', 'info'), privateProfile);
        batch.update(doc(db, 'artifacts', APP_ID, 'public', 'data', 'all_users', user.uid), directoryProfile);
        await batch.commit();
        setProfileModalOpen(false);
    };`,
    'a separação entre perfil privado e diretório administrativo'
  );

  source = replaceRequired(
    source,
    '    const [accessDenied, setAccessDenied] = useState(false);',
    '    const [accessDenied, setAccessDenied] = useState(null);',
    'os estados de revogação de acesso'
  );

  source = replaceBlock(
    source,
    '    useEffect(() => {\n        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {',
    '    if (loadingAuth) return React.createElement',
    String.raw`    useEffect(() => {
        let unsubscribeProfile = () => {};
        let missingProfileTimer = null;

        const stopProfileWatch = () => {
            unsubscribeProfile();
            unsubscribeProfile = () => {};
            if (missingProfileTimer) clearTimeout(missingProfileTimer);
            missingProfileTimer = null;
        };

        const unsubscribeAuth = onAuthStateChanged(auth, currentUser => {
            stopProfileWatch();
            if (!currentUser) {
                setUser(null);
                setUserProfile(null);
                setLoadingAuth(false);
                return;
            }

            setLoadingAuth(true);
            const profileRef = doc(db, 'artifacts', APP_ID, 'users', currentUser.uid, 'profile', 'info');
            unsubscribeProfile = onSnapshot(profileRef, async profileSnapshot => {
                if (!profileSnapshot.exists()) {
                    setUser(null);
                    setUserProfile(null);
                    if (!missingProfileTimer) {
                        missingProfileTimer = setTimeout(async () => {
                            setAccessDenied('deleted');
                            setLoadingAuth(false);
                            await signOut(auth);
                        }, 5000);
                    }
                    return;
                }

                if (missingProfileTimer) clearTimeout(missingProfileTimer);
                missingProfileTimer = null;
                const data = profileSnapshot.data();
                const status = String(data.status || (data.approved ? 'active' : 'pending'));
                if (data.approved === true && status !== 'blocked' && status !== 'deleted') {
                    setAccessDenied(null);
                    setUserProfile(data);
                    setUser(currentUser);
                    setLoadingAuth(false);
                    return;
                }

                setUser(null);
                setUserProfile(null);
                setAccessDenied(status === 'deleted' ? 'deleted' : status === 'blocked' ? 'blocked' : 'pending');
                setLoadingAuth(false);
                await signOut(auth);
            }, async error => {
                console.error('Não foi possível validar o acesso:', error);
                setUser(null);
                setUserProfile(null);
                setAccessDenied('error');
                setLoadingAuth(false);
                await signOut(auth);
            });
        });

        return () => {
            stopProfileWatch();
            unsubscribeAuth();
        };
    }, []);`,
    'a revogação de acesso em tempo real'
  );

  const deniedScreen = String.raw`    if (accessDenied) return React.createElement('div', { className: "min-h-screen flex flex-col items-center justify-center bg-red-50 p-6 text-center" },
        React.createElement(Lock, { size: 48, className: "text-red-500 mb-4" }),
        React.createElement('h1', { className: "text-2xl font-bold text-red-800 mb-2" }, "Acesso Negado"),
        React.createElement('p', { className: "text-red-600 mb-6" }, "Seu cadastro ainda está pendente de aprovação pelo administrador."),
        React.createElement('button', { onClick: () => { setAccessDenied(false); window.location.reload(); }, className: "px-6 py-3 bg-red-600 text-white font-bold rounded-xl" }, "Voltar")
    );`;
  source = replaceRequired(
    source,
    deniedScreen,
    String.raw`    if (accessDenied) return React.createElement('div', { className: "min-h-screen flex flex-col items-center justify-center bg-red-50 p-6 text-center" },
        React.createElement(Lock, { size: 48, className: "text-red-500 mb-4" }),
        React.createElement('h1', { className: "text-2xl font-bold text-red-800 mb-2" }, accessDenied === 'pending' ? "Cadastro em análise" : "Acesso revogado"),
        React.createElement('p', { className: "text-red-600 mb-6" }, accessDenied === 'pending'
            ? "Seu cadastro ainda está pendente de aprovação pelo administrador."
            : accessDenied === 'blocked'
                ? "Este usuário foi bloqueado pelo administrador."
                : accessDenied === 'deleted'
                    ? "Este usuário foi removido e não possui mais acesso ao sistema."
                    : "Não foi possível validar sua autorização. Tente entrar novamente."),
        React.createElement('button', { onClick: () => setAccessDenied(null), className: "px-6 py-3 bg-red-600 text-white font-bold rounded-xl" }, "Voltar ao login")
    );`,
    'as mensagens de acesso revogado'
  );

  return source;
};
