import { useState } from 'react';
import api from '../lib/api';

interface ExportButtonProps {
  label: string;
  exportUrl: string;
  onNeedsAuth?: () => void;
}

export default function ExportButton({ label, exportUrl, onNeedsAuth }: ExportButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const res = await api.get(exportUrl);
      if (res.data.url) {
        window.open(res.data.url, '_blank');
      }
    } catch (err: any) {
      if (err.response?.data?.needsAuth) {
        onNeedsAuth?.();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-white cursor-pointer disabled:opacity-50 transition-opacity"
      style={{ backgroundColor: '#2D7A3A' }}
    >
      {loading ? 'Exporting...' : label}
    </button>
  );
}
