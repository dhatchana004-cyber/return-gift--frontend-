import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../services/api';

export default function AdminLoginPage() {
  const { admin, adminLogin } = useAuth();
  const navigate = useNavigate();
  const [values, setValues] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [inputsUnlocked, setInputsUnlocked] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (admin) return <Navigate to="/admin" replace />;
  const unlockInputs = () => { if (!inputsUnlocked) setInputsUnlocked(true); };
  const submit = async (event) => {
    event.preventDefault(); setError(''); setBusy(true);
    try { await adminLogin({ email: values.email.trim(), password: values.password.trim() }); navigate('/admin'); }
    catch (e) { setError(getErrorMessage(e)); }
    finally { setBusy(false); }
  };
  return (
    <section className="auth-page admin-login-page">
      <div className="auth-card">
        <span className="auth-flower">V</span>
        <p className="eyebrow">VEDHIKA BRAND · BOUTIQUE TEAM</p>
        <h1>Your studio, all in one place.</h1>
        <p>Sign in to manage your collection and orders.</p>
        {error && <div className="alert alert-danger">{error}</div>}
        <form onSubmit={submit} autoComplete="off">
          <label>
            Admin email
            <input
              type="email"
              name="admin_email_input"
              autoComplete="off"
              readOnly={!inputsUnlocked}
              onFocus={unlockInputs}
              onPointerDown={unlockInputs}
              onPaste={unlockInputs}
              required
              value={values.email}
              onChange={(e) => { unlockInputs(); setValues({ ...values, email: e.target.value }); }}
            />
          </label>
          <label>
            Password
            <div className="password-input-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                name="admin_password_input"
                autoComplete="new-password"
                readOnly={!inputsUnlocked}
                onFocus={unlockInputs}
                onPointerDown={unlockInputs}
                onPaste={unlockInputs}
                required
                value={values.password}
                onChange={(e) => { unlockInputs(); setValues({ ...values, password: e.target.value }); }}
              />
              <button type="button" className="password-toggle-btn" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`} />
              </button>
            </div>
          </label>
          <button className="button button-gold w-100" disabled={busy}>
            {busy ? 'SIGNING IN…' : 'ENTER THE STUDIO'} <i className="bi bi-arrow-right" />
          </button>
        </form>
      </div>
    </section>
  );
}
