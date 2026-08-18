const replaceRequired = (source, marker, replacement, label) => {
  if (!source.includes(marker)) throw new Error(`Não foi possível preparar ${label}.`);
  return source.replace(marker, replacement);
};

export const applySetupPatches = source => {
  const iconImport = "import { Users, User, LogOut, Lock, LayoutDashboard, Receipt, WalletCards, Package, Contact, Store, ShieldCheck, BadgePercent } from 'https://esm.sh/lucide-react@0.292.0';";
  const financeImport = "import { AbaTaxas } from './aba-taxas.js';";
  const navMarker = "        { id: 'rates', label: 'Taxas e juros', shortLabel: 'Taxas', icon: BadgePercent }";
  const financeRender = "                    : React.createElement(AbaTaxas, {";
  const stockImport = `    ConfirmModal, WhatsAppChooserModal, ProductModal, StockMovementModal\n} from './modals.js?v=4';`;
  const privateProfile = "        const { paymentSettings: ignoredSettings, paymentSettingsUpdatedAt: ignoredSettingsDate, ...profileData } = updatedData;";
  const publicProfile = "        await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'all_users', user.uid), profileData);";
  const initialPublicProfile = "                        const { paymentSettings: ignoredSettings, paymentSettingsUpdatedAt: ignoredSettingsDate, ...publicProfile } = profileSnap.data();";
  const cancelState = "    const [cancelModal, setCancelModal] = useState({ open: false, saleId: null, reason: '' });";
  const cancelOpen = "onCancelSale: saleId => setCancelModal({ open: true, saleId, reason: '' })";

  source = replaceRequired(source, iconImport,
    "import { Users, User, LogOut, Lock, LayoutDashboard, Receipt, WalletCards, Package, Contact, Store, ShieldCheck, BadgePercent, Banknote } from 'https://esm.sh/lucide-react@0.292.0';",
    'o ícone do Financeiro');
  source = replaceRequired(source, financeImport,
    financeImport + "\nimport { AbaFinanceiro } from './aba-financeiro-v54.js';\nimport { SaleCancellationModal } from './sale-cancellation-modal-v57.js';",
    'os módulos do Financeiro');
  source = replaceRequired(source, navMarker,
    "        { id: 'finance', label: 'Financeiro', shortLabel: 'Fin.', icon: Banknote },\n" + navMarker,
    'a navegação do Financeiro');
  source = replaceRequired(source, financeRender,
    `                    : view === 'finance' ? React.createElement(AbaFinanceiro, {
                        userId: user.uid,
                        sales,
                        products,
                        onOpenSale: sale => setSelectedSaleDetail(sale),
                        onOpenProduct: product => setProductDetailsData({ open: true, data: product }),
                        onReceiveInstallment: (sale, index) => handleClickPay(sale, index)
                    })
                    : React.createElement(AbaTaxas, {`,
    'a tela do Financeiro');
  source = replaceRequired(source, stockImport,
    `    ConfirmModal, WhatsAppChooserModal, ProductModal
} from './modals.js?v=4';
import { StockMovementModal } from './stock-movement-modal-v52.js';`,
    'o modal de estoque');
  source = replaceRequired(source, privateProfile,
    "        const { paymentSettings: ignoredSettings, paymentSettingsUpdatedAt: ignoredSettingsDate, financialData: ignoredFinancialData, financialUpdatedAt: ignoredFinancialDate, ...profileData } = updatedData;",
    'a privacidade dos dados financeiros');
  if (!source.includes(publicProfile)) throw new Error('Não foi possível validar o perfil público.');
  source = replaceRequired(source, initialPublicProfile,
    "                        const { paymentSettings: ignoredSettings, paymentSettingsUpdatedAt: ignoredSettingsDate, financialData: ignoredFinancialData, financialUpdatedAt: ignoredFinancialDate, ...publicProfile } = profileSnap.data();",
    'a privacidade do perfil público inicial');
  source = replaceRequired(source, cancelState,
    "    const [cancelModal, setCancelModal] = useState({ open: false, saleId: null });",
    'o estado de cancelamento');
  source = replaceRequired(source, cancelOpen,
    "onCancelSale: saleId => setCancelModal({ open: true, saleId })",
    'a abertura do cancelamento');
  return source;
};
