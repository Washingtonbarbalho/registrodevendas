import React, { useEffect, useId, useRef } from 'https://esm.sh/react@18.2.0';
import { createPortal } from 'https://esm.sh/react-dom@18.2.0';
import { X } from 'https://esm.sh/lucide-react@0.292.0';

const h = React.createElement;
const tabbable = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]';

export function CommissionDialog({ title, subtitle, icon: Icon, onClose, busy = false, onSubmit, actions, children }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const opener = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const target = ref.current?.querySelector('[data-initial-focus]') || ref.current;
    target?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = previousOverflow;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);
  const onKeyDown = e => {
    if (e.key === 'Escape' && !e.defaultPrevented) {
      e.stopPropagation();
      if (!busy) onClose();
    } else if (e.key === 'Tab') {
      const focusable = [...ref.current.querySelectorAll(tabbable)].filter(el => el.getClientRects().length);
      const first = focusable[0], last = focusable.at(-1);
      if (!first || (e.shiftKey && (e.target === first || e.target === ref.current)) || (!e.shiftKey && e.target === last)) {
        e.preventDefault();
        (e.shiftKey ? last : first)?.focus();
      }
    }
  };
  return createPortal(h('div', {
    className: 'app-modal-overlay com-modal-overlay', role: 'presentation',
    onClick: e => { if (e.target === e.currentTarget && !busy) onClose(); }
  }, h(onSubmit ? 'form' : 'section', {
    ref, className: 'app-modal-panel com-modal', role: 'dialog', 'aria-modal': true, 'aria-labelledby': titleId,
    tabIndex: -1, onSubmit, onKeyDown, 'aria-busy': busy || undefined, 'data-no-restore': true
  },
    h('header', { className: 'com-modal-head' },
      Icon && h('span', { className: 'com-icon' }, h(Icon, { size: 21, 'aria-hidden': true })),
      h('div', null, h('h2', { id: titleId }, title), subtitle && h('p', { className: 'com-muted' }, subtitle)),
      h('button', { type: 'button', className: 'app-icon-button com-close', 'aria-label': 'Fechar', onClick: onClose, disabled: busy },
        h(X, { size: 18, 'aria-hidden': true }))),
    h('div', { className: 'com-modal-body' }, children),
    h('footer', { className: 'com-modal-footer' }, actions)
  )), document.body);
}
