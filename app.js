import { React, useState, useEffect, createRoot, Home, HeartHandshake, Shield } from './js/core.js';
import MainModuleApp from './js/main-module.js';
import AdmAuraModule from './js/adm-module.js';
import CrmAuraModule from './js/crm-module.js';

const UNIFIED_SYSTEMS = [
  { id: 'main', label: 'Principal', icon: Home },
  { id: 'crm', label: 'CRM', icon: HeartHandshake },
  { id: 'admin', label: 'ADM', icon: Shield }
];

const getInitialUnifiedView = () => {
  if (typeof window === 'undefined') return 'main';
  const valid = UNIFIED_SYSTEMS.map(item => item.id);
  const hash = (window.location.hash || '').replace('#', '').toLowerCase();
  const saved = window.localStorage.getItem('aura-unified-view');
  if (valid.includes(hash)) return hash;
  if (valid.includes(saved)) return saved;
  return 'main';
};

const SystemDock = ({ activeView, onChange }) => React.createElement(
  'div',
  { className: 'fixed bottom-4 left-1/2 -translate-x-1/2 z-[95]' },
  React.createElement(
    'div',
    { className: 'flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/95 p-1.5 shadow-2xl backdrop-blur-sm' },
    UNIFIED_SYSTEMS.map((item) => {
      const Icon = item.icon;
      const active = activeView === item.id;
      return React.createElement(
        'button',
        {
          key: item.id,
          onClick: () => onChange(item.id),
          className: 'flex items-center gap-2 rounded-full px-3 py-2 text-sm font-bold transition-all ' + (active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-300 hover:bg-slate-800 hover:text-white')
        },
        React.createElement(Icon, { size: 16, className: active ? 'text-yellow-500' : 'text-slate-400' }),
        React.createElement('span', null, item.label)
      );
    })
  )
);

function UnifiedApp() {
  const [activeView, setActiveView] = useState(getInitialUnifiedView);

  useEffect(() => {
    window.localStorage.setItem('aura-unified-view', activeView);
    const newHash = activeView === 'main' ? '' : '#' + activeView;
    const nextUrl = window.location.pathname + window.location.search + newHash;
    window.history.replaceState(null, '', nextUrl);
  }, [activeView]);

  useEffect(() => {
    const handleHashChange = () => {
      const next = getInitialUnifiedView();
      setActiveView(prev => prev === next ? prev : next);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const ActiveModule = activeView === 'crm'
    ? CrmAuraModule
    : activeView === 'admin'
      ? AdmAuraModule
      : MainModuleApp;

  return React.createElement(
    React.Fragment,
    null,
    React.createElement(ActiveModule),
    React.createElement(SystemDock, { activeView, onChange: setActiveView })
  );
}

const root = createRoot(document.getElementById('root'));
root.render(React.createElement(UnifiedApp));
