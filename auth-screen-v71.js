import React, { useState } from 'https://esm.sh/react@18.2.0';
import {
  AlertTriangle, ArrowLeft, CheckCircle2, Eye, EyeOff, Lock, Mail, Store, UserCog
} from 'https://esm.sh/lucide-react@0.292.0';
import { doc, serverTimestamp, writeBatch } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword
} from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js';
import { APP_ID, auth, db } from './firebase-config.js?v=91';
import { maskPhone } from './utils.js?v=74';

const EMAIL_STORAGE_KEY = 'registro-vendas:login-email:v1';

const readRememberedEmail = () => {
  try { return localStorage.getItem(EMAIL_STORAGE_KEY) || ''; }
  catch (_) { return ''; }
};

const persistRememberedEmail = (email, remember) => {
  try {
    if (remember) localStorage.setItem(EMAIL_STORAGE_KEY, email);
    else localStorage.removeItem(EMAIL_STORAGE_KEY);
  } catch (_) {}
};

const normalizeEmail = value => String(value || '').trim().toLowerCase();

const authErrorMessage = (error, action = 'login') => {
  const code = error?.code || '';
  if (code === 'auth/invalid-email') return 'Confira o formato do e-mail informado.';
  if (code === 'auth/email-already-in-use') return 'Este e-mail já possui uma conta. Volte e entre com sua senha.';
  if (code === 'auth/weak-password') return 'Crie uma senha com pelo menos 6 caracteres.';
  if (code === 'auth/too-many-requests') return 'Muitas tentativas seguidas. Aguarde alguns minutos e tente novamente.';
  if (code === 'auth/network-request-failed') return 'Sem conexão com o servidor. Confira sua internet e tente novamente.';
  if (code === 'auth/user-disabled') return 'Este acesso foi desativado. Fale com o administrador.';
  if (action === 'register') return 'Não foi possível criar a conta agora. Tente novamente.';
  if (action === 'reset') return 'Não foi possível enviar o link agora. Tente novamente.';
  return 'E-mail ou senha incorretos.';
};

const PasswordField = ({ value, onChange, visible, onToggle, placeholder, autoComplete, autoFocus = false }) => React.createElement('div', { className: 'auth71-input-wrap' },
  React.createElement(Lock, { size: 19 }),
  React.createElement('input', {
    autoFocus,
    type: visible ? 'text' : 'password',
    value,
    onChange,
    placeholder,
    autoComplete,
    required: true
  }),
  React.createElement('button', {
    type: 'button',
    onClick: onToggle,
    className: 'auth71-password-toggle',
    'aria-label': visible ? 'Ocultar senha' : 'Mostrar senha'
  }, visible ? React.createElement(EyeOff, { size: 18 }) : React.createElement(Eye, { size: 18 }))
);

export const AuthScreen = () => {
  const rememberedEmail = readRememberedEmail();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState(rememberedEmail);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [storeName, setStoreName] = useState('');
  const [phone, setPhone] = useState('');
  const [rememberEmail, setRememberEmail] = useState(!!rememberedEmail);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const clearFeedback = () => { setError(''); setNotice(''); };

  const createInitialUserData = async uid => {
    const normalizedEmail = normalizeEmail(email);
    const profile = {
      uid,
      email: normalizedEmail,
      name: fullName.trim() || 'Usuário',
      storeName: storeName.trim() || 'Minha Hinode',
      phone,
      role: 'user',
      approved: false,
      status: 'pending',
      createdAt: serverTimestamp()
    };
    const batch = writeBatch(db);
    batch.set(doc(db, 'artifacts', APP_ID, 'users', uid, 'profile', 'info'), profile);
    batch.set(doc(db, 'artifacts', APP_ID, 'public', 'data', 'all_users', uid), profile);
    await batch.commit();
  };

  const handleLogin = async event => {
    event.preventDefault();
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || !password) return setError('Digite seu e-mail e sua senha.');
    clearFeedback();
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, normalizedEmail, password);
      persistRememberedEmail(normalizedEmail, rememberEmail);
    } catch (loginError) {
      setError(authErrorMessage(loginError));
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) return setError('Digite seu e-mail para receber o link de recuperação.');
    clearFeedback();
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, normalizedEmail);
      setNotice('Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha.');
    } catch (resetError) {
      setError(authErrorMessage(resetError, 'reset'));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async event => {
    event.preventDefault();
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || !fullName.trim() || !phone || !password) return setError('Preencha e-mail, nome, WhatsApp e senha.');
    if (password.length < 6) return setError('Crie uma senha com pelo menos 6 caracteres.');
    if (password !== confirmPassword) return setError('As senhas não coincidem.');
    clearFeedback();
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
      await createInitialUserData(userCredential.user.uid);
      persistRememberedEmail(normalizedEmail, rememberEmail);
    } catch (registerError) {
      setError(authErrorMessage(registerError, 'register'));
      setLoading(false);
    }
  };

  const switchMode = nextMode => {
    setMode(nextMode);
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    clearFeedback();
  };

  return React.createElement('main', { className: 'auth-screen auth71-screen' },
    React.createElement('section', { className: 'auth-panel auth71-panel bg-white w-full animate-fade-in', 'aria-labelledby': 'auth-title' },
      React.createElement('div', { className: 'auth71-brand' },
        React.createElement('div', { className: 'auth71-brand-mark' }, React.createElement(Store, { size: 29 })),
        React.createElement('div', null,
          React.createElement('h1', { id: 'auth-title' }, mode === 'login' ? 'Acesse sua loja' : 'Crie sua conta'),
          React.createElement('p', null, mode === 'login' ? 'Entre direto com e-mail e senha.' : 'Depois do cadastro, aguarde a liberação do administrador.')
        )
      ),

      error && React.createElement('div', { className: 'auth71-feedback is-error', role: 'alert' }, React.createElement(AlertTriangle, { size: 17 }), React.createElement('span', null, error)),
      notice && React.createElement('div', { className: 'auth71-feedback is-success', role: 'status' }, React.createElement(CheckCircle2, { size: 17 }), React.createElement('span', null, notice)),

      mode === 'login'
        ? React.createElement('form', { className: 'auth71-form', noValidate: true, onSubmit: handleLogin },
          React.createElement('label', { className: 'auth71-field' },
            React.createElement('span', null, 'E-mail'),
            React.createElement('div', { className: 'auth71-input-wrap' },
              React.createElement(Mail, { size: 19 }),
              React.createElement('input', {
                autoFocus: !rememberedEmail,
                type: 'email',
                inputMode: 'email',
                autoCapitalize: 'none',
                autoCorrect: 'off',
                autoComplete: 'email',
                value: email,
                onChange: event => { setEmail(event.target.value); clearFeedback(); },
                placeholder: 'seu@email.com',
                required: true
              })
            )
          ),
          React.createElement('label', { className: 'auth71-field' },
            React.createElement('span', null, 'Senha'),
            React.createElement(PasswordField, {
              value: password,
              onChange: event => { setPassword(event.target.value); clearFeedback(); },
              visible: showPassword,
              onToggle: () => setShowPassword(visible => !visible),
              placeholder: 'Sua senha',
              autoComplete: 'current-password',
              autoFocus: !!rememberedEmail
            })
          ),
          React.createElement('div', { className: 'auth71-options' },
            React.createElement('label', { className: 'auth71-remember' },
              React.createElement('input', { type: 'checkbox', checked: rememberEmail, onChange: event => setRememberEmail(event.target.checked) }),
              React.createElement('span', null, 'Lembrar meu e-mail')
            ),
            React.createElement('button', { type: 'button', disabled: loading, onClick: handleResetPassword, className: 'auth71-link' }, 'Esqueci a senha')
          ),
          React.createElement('button', { type: 'submit', disabled: loading, className: 'auth71-submit' }, loading ? 'Entrando...' : 'Entrar'),
          React.createElement('div', { className: 'auth71-secondary' },
            React.createElement('span', null, 'Primeiro acesso?'),
            React.createElement('button', { type: 'button', disabled: loading, onClick: () => switchMode('register') }, 'Criar conta')
          )
        )
        : React.createElement('form', { className: 'auth71-form', noValidate: true, onSubmit: handleRegister },
          React.createElement('button', { type: 'button', onClick: () => switchMode('login'), className: 'auth71-back' }, React.createElement(ArrowLeft, { size: 16 }), 'Voltar para o login'),
          React.createElement('label', { className: 'auth71-field' },
            React.createElement('span', null, 'E-mail'),
            React.createElement('div', { className: 'auth71-input-wrap' }, React.createElement(Mail, { size: 19 }), React.createElement('input', { autoFocus: true, type: 'email', inputMode: 'email', autoCapitalize: 'none', autoComplete: 'email', value: email, onChange: event => setEmail(event.target.value), placeholder: 'seu@email.com', required: true }))
          ),
          React.createElement('div', { className: 'auth71-register-grid' },
            React.createElement('label', { className: 'auth71-field' }, React.createElement('span', null, 'Nome completo'), React.createElement('input', { value: fullName, onChange: event => setFullName(event.target.value), autoComplete: 'name', placeholder: 'Seu nome', required: true })),
            React.createElement('label', { className: 'auth71-field' }, React.createElement('span', null, 'WhatsApp'), React.createElement('input', { type: 'tel', inputMode: 'tel', value: phone, onChange: event => setPhone(maskPhone(event.target.value)), autoComplete: 'tel', placeholder: '(00) 00000-0000', maxLength: 15, required: true }))
          ),
          React.createElement('label', { className: 'auth71-field' }, React.createElement('span', null, 'Nome da loja (opcional)'), React.createElement('div', { className: 'auth71-input-wrap' }, React.createElement(UserCog, { size: 19 }), React.createElement('input', { value: storeName, onChange: event => setStoreName(event.target.value), autoComplete: 'organization', placeholder: 'Minha loja' }))),
          React.createElement('div', { className: 'auth71-register-grid' },
            React.createElement('label', { className: 'auth71-field' }, React.createElement('span', null, 'Senha'), React.createElement(PasswordField, { value: password, onChange: event => setPassword(event.target.value), visible: showPassword, onToggle: () => setShowPassword(visible => !visible), placeholder: 'Mínimo 6 caracteres', autoComplete: 'new-password' })),
            React.createElement('label', { className: 'auth71-field' }, React.createElement('span', null, 'Confirmar senha'), React.createElement(PasswordField, { value: confirmPassword, onChange: event => setConfirmPassword(event.target.value), visible: showPassword, onToggle: () => setShowPassword(visible => !visible), placeholder: 'Repita a senha', autoComplete: 'new-password' }))
          ),
          React.createElement('label', { className: 'auth71-remember' }, React.createElement('input', { type: 'checkbox', checked: rememberEmail, onChange: event => setRememberEmail(event.target.checked) }), React.createElement('span', null, 'Lembrar meu e-mail neste aparelho')),
          React.createElement('button', { type: 'submit', disabled: loading, className: 'auth71-submit' }, loading ? 'Criando conta...' : 'Criar conta')
        )
    )
  );
};
