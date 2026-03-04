'use client';
/**
 * Live log viewer with real-time Socket.IO streaming.
 * Shows backend logs in chronological order with filtering,
 * color-coding by severity, and search.
 */
import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { formatDistanceToNow } from 'date-fns';
import { Search, Pause, Play, Trash2, Download } from 'lucide-react';

interface LogEntry {
  id: string;
  level: string;
  service: string;
  message: string;
  storeId?: string | null;
  traceId?: string;
  timestamp: string;
}

const LEVEL_STYLES: Record<string, string> = {
  DEBUG: 'text-gray-500',
  INFO: 'text-green-400',
  WARN: 'text-amber-400',
  ERROR: 'text-red-400',
  CRITICAL: 'text-red-300 font-bold',
};

const LEVEL_BG: Record<string, string> = {
  DEBUG: '',
  INFO: '',
  WARN: 'bg-amber-900/10',
  ERROR: 'bg-red-900/20',
  CRITICAL: 'bg-red-900/40',
};

interface Props {
  initialLogs: LogEntry[];
  token: string;
}

export function LiveLogViewer({ initialLogs, token }: Props) {
  const [logs, setLogs] = useState<LogEntry[]>(initialLogs);
  const [paused, setPaused] = useState(false);
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const socket = io(apiUrl, { auth: { token } });
    socketRef.current = socket;

    socket.on('connect', () => console.log('Log stream connected'));
    socket.on('log', (log: LogEntry) => {
      if (!paused) {
        setLogs((prev) => [log, ...prev].slice(0, 1000)); // Keep last 1000
      }
    });

    return () => { socket.disconnect(); };
  }, [token, paused]);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [logs, autoScroll]);

  const filteredLogs = logs.filter((log) => {
    if (levelFilter && log.level !== levelFilter) return false;
    if (serviceFilter && log.service !== serviceFilter) return false;
    if (search && !log.message.toLowerCase().includes(search.toLowerCase()) &&
        !log.traceId?.includes(search)) return false;
    return true;
  });

  const downloadLogs = () => {
    const content = filteredLogs.map((l) =>
      `[${l.timestamp}] [${l.level}] [${l.service}] ${l.message}`
    ).join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${new Date().toISOString()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 p-4 border-b border-gray-800 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
          <input
            className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-violet-500"
            placeholder="Search logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-violet-500"
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value)}
        >
          <option value="">All Levels</option>
          {['DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL'].map((l) => <option key={l} value={l}>{l}</option>)}
        </select>

        <select
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-violet-500"
          value={serviceFilter}
          onChange={(e) => setServiceFilter(e.target.value)}
        >
          <option value="">All Services</option>
          {['api', 'admin', 'store'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={() => setPaused(!paused)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              paused ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
          >
            {paused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
            {paused ? 'Resume' : 'Pause'}
          </button>
          <button onClick={() => setLogs([])} className="p-1.5 text-gray-500 hover:text-gray-300 hover:bg-gray-700 rounded-lg transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={downloadLogs} className="p-1.5 text-gray-500 hover:text-gray-300 hover:bg-gray-700 rounded-lg transition-colors">
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex gap-4 px-4 py-2 bg-gray-900/50 border-b border-gray-800 text-xs text-gray-500">
        <span className="text-green-400">{filteredLogs.filter((l) => l.level === 'INFO').length} INFO</span>
        <span className="text-amber-400">{filteredLogs.filter((l) => l.level === 'WARN').length} WARN</span>
        <span className="text-red-400">{filteredLogs.filter((l) => l.level === 'ERROR' || l.level === 'CRITICAL').length} ERROR</span>
        <span className="ml-auto">{filteredLogs.length} entries{paused ? ' (paused)' : ' (live)'}</span>
      </div>

      {/* Log entries */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto font-mono text-xs"
      >
        {filteredLogs.map((log) => (
          <div key={log.id} className={`flex items-start gap-3 px-4 py-1.5 hover:bg-gray-800/50 border-b border-gray-900 ${LEVEL_BG[log.level] ?? ''}`}>
            <span className="text-gray-600 flex-shrink-0 w-20 truncate">
              {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <span className={`flex-shrink-0 w-14 font-semibold uppercase ${LEVEL_STYLES[log.level] ?? 'text-gray-400'}`}>
              {log.level.slice(0, 5)}
            </span>
            <span className="text-violet-400 flex-shrink-0 w-10">{log.service}</span>
            <span className="text-gray-300 flex-1 break-all">{log.message}</span>
            {log.storeId && (
              <span className="text-gray-600 flex-shrink-0 max-w-[80px] truncate" title={log.storeId}>
                {log.storeId.slice(-8)}
              </span>
            )}
          </div>
        ))}
        {filteredLogs.length === 0 && (
          <div className="flex items-center justify-center h-32 text-gray-600 text-sm">
            No log entries {search ? 'matching your search' : 'yet'}
          </div>
        )}
      </div>
    </div>
  );
}
