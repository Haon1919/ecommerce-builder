'use client';
import { useEffect, useState } from 'react';
import { LiveLogViewer } from '@/components/LiveLogViewer';
import { logsApi } from '@/lib/api';

export default function LogsPage() {
  const [token, setToken] = useState('');
  const [initialLogs, setInitialLogs] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem('super_admin_token') ?? '';
    setToken(t);
    logsApi.list({ limit: '200' }).then((data) => {
      setInitialLogs(data.logs);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  return (
    <div className="flex flex-col h-screen">
      <div className="px-8 py-5 border-b border-gray-800 flex-shrink-0">
        <h1 className="text-2xl font-bold text-white">Live Log Viewer</h1>
        <p className="text-gray-400 mt-1 text-sm">
          Real-time backend logs — PII is never logged, only system metadata
        </p>
      </div>

      <div className="flex-1 overflow-hidden">
        {!loaded ? (
          <div className="flex items-center justify-center h-full text-gray-500">Loading logs...</div>
        ) : (
          <LiveLogViewer initialLogs={initialLogs} token={token} />
        )}
      </div>
    </div>
  );
}
