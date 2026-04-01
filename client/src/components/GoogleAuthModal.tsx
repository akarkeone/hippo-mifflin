import { useState } from 'react';
import api from '../lib/api';

interface GoogleAuthModalProps {
  open: boolean;
  onClose: () => void;
}

export default function GoogleAuthModal({ open, onClose }: GoogleAuthModalProps) {
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleConnect = async () => {
    setLoading(true);
    try {
      const res = await api.get('/auth/google');
      window.location.href = res.data.url;
    } catch {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div
        className="relative rounded-xl p-6 w-full max-w-sm"
        style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
      >
        <h2 className="text-[15px] font-medium mb-2" style={{ color: 'var(--text)' }}>
          Connect Google Account
        </h2>
        <p className="text-[13px] mb-4" style={{ color: 'var(--text2)' }}>
          To export to Google Sheets and Drive, please connect your Google account.
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleConnect}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-[13px] font-medium text-white cursor-pointer disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            {loading ? 'Connecting...' : 'Connect Google'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-[13px] font-medium cursor-pointer"
            style={{ color: 'var(--text2)', backgroundColor: 'var(--bg2)' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
