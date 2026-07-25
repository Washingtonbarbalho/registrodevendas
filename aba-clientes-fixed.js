const VERSION = '25';

const response = await fetch(`./aba-clientes.js?v=${VERSION}`, { cache: 'no-store' });
if (!response.ok) {
    throw new Error(`Não foi possível carregar a aba de clientes (${response.status}).`);
}

let source = await response.text();

source = source.replace(
    "import { Search, Phone, FileText, MapPin, ShieldCheck, Pencil, Trash2, Plus, Users, X, Lock, SlidersHorizontal } from 'https://esm.sh/lucide-react@0.292.0';",
    "import { Search, Phone, FileText, MapPin, ShieldCheck, Pencil, Trash2, Plus, Users, X, Lock, SlidersHorizontal, History } from 'https://esm.sh/lucide-react@0.292.0';"
);

source = source.replace(
    "import { Pagination, MoneyInput } from './components.js';",
    "import { Pagination, MoneyInput } from './components.js';\nimport { CustomerPurchaseHistoryModal } from './customer-history-modal.js';"
);

source = source.replace(
    "    const [creditModal, setCreditModal] = useState({ open: false, customer: null });",
    "    const [historyModal, setHistoryModal] = useState({ open: false, customer: null });\n    const [creditModal, setCreditModal] = useState({ open: false, customer: null });"
);

source = source.replace(
    'React.createElement(\'p\', { className: "page-description" }, "Dados de contato e situação de crédito em uma única lista.")',
    'React.createElement(\'p\', { className: "page-description" }, "Dados de contato, crédito e histórico de compras em uma única lista.")'
);

source = source.replace(
    'className: "list-header md:grid-cols-[minmax(0,1.7fr)_minmax(150px,1fr)_130px_140px_120px]"',
    'className: "list-header customer-list-header md:grid-cols-[minmax(0,1.7fr)_minmax(150px,1fr)_130px_140px_164px]"'
);

source = source.replace(
    'className: "list-row cursor-default grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1.7fr)_minmax(150px,1fr)_130px_140px_120px]"',
    'className: "list-row customer-list-row-actions cursor-default grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1.7fr)_minmax(150px,1fr)_130px_140px_164px]"'
);

const editButtonBlock = `                                React.createElement('button', {
                                    onClick: event => { event.stopPropagation(); setCustomerModalData({ open: true, data: customer }); },
                                    className: "list-action-button",
                                    title: "Editar cliente"
                                }, React.createElement(Pencil, { size: 17 })),`;

if (!source.includes(editButtonBlock)) {
    throw new Error('Não foi possível localizar as ações da lista de clientes.');
}

source = source.replace(editButtonBlock, `${editButtonBlock}
                                React.createElement('button', {
                                    onClick: event => { event.stopPropagation(); setHistoryModal({ open: true, customer }); },
                                    className: "list-action-button",
                                    title: "Histórico de compras"
                                }, React.createElement(History, { size: 17 })),`);

const modalTail = `        ),
        creditSettingsModal
    );`;

if (!source.includes(modalTail)) {
    throw new Error('Não foi possível conectar o histórico de compras à aba de clientes.');
}

source = source.replace(modalTail, `        ),
        React.createElement(CustomerPurchaseHistoryModal, {
            isOpen: historyModal.open,
            onClose: () => setHistoryModal({ open: false, customer: null }),
            customer: historyModal.customer,
            sales
        }),
        creditSettingsModal
    );`);

source = source.replace(
    /(['"])(\.\/[^'"]+?\.js)(?:\?[^'"]*)?\1/g,
    (match, quote, modulePath) => {
        const moduleUrl = new URL(modulePath, location.href);
        moduleUrl.search = `?v=${VERSION}`;
        return `'${moduleUrl.href}'`;
    }
);

const moduleUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
let originalModule;
try {
    originalModule = await import(moduleUrl);
} finally {
    URL.revokeObjectURL(moduleUrl);
}

export const AbaClientes = originalModule.AbaClientes;
