import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/overview');
    } catch {
      setError('Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FAF8F4',
      }}
    >
      <div style={{ width: '100%', maxWidth: 380 }}>
        {/* Hippos + wordmark */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div
            style={{
              fontSize: 32,
              fontWeight: 500,
              letterSpacing: '-0.02em',
              color: 'var(--text)',
              lineHeight: 1,
            }}
          >
            Hippo
          </div>
        </div>

        {/* Sign in card */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '0.5px solid rgba(0,0,0,.07)',
            borderRadius: 14,
            padding: '28px 32px',
          }}
        >
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: 'var(--text2)',
                  marginBottom: 6,
                }}
              >
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@company.com"
                style={{
                  width: '100%',
                  backgroundColor: '#F2EEE6',
                  border: '0.5px solid rgba(0,0,0,.12)',
                  borderRadius: 8,
                  padding: '10px 14px 13px',
                  fontSize: 13,
                  color: 'var(--text)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: 'var(--text2)',
                  marginBottom: 6,
                }}
              >
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter password"
                style={{
                  width: '100%',
                  backgroundColor: '#F2EEE6',
                  border: '0.5px solid rgba(0,0,0,.12)',
                  borderRadius: 8,
                  padding: '10px 14px 13px',
                  fontSize: 13,
                  color: 'var(--text)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {error && (
              <p style={{ fontSize: 13, color: '#DC2626', margin: 0 }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                backgroundColor: '#534AB7',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 8,
                padding: '11px',
                fontSize: 14,
                fontWeight: 500,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.5 : 1,
                transition: 'opacity 0.15s',
              }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p
            style={{
              textAlign: 'center',
              fontSize: 12,
              color: 'var(--text2)',
              marginTop: 14,
              marginBottom: 0,
            }}
          >
            Forgot password?{' '}
            <span
              style={{ color: 'var(--accent)', cursor: 'pointer' }}
            >
              Reset it
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
