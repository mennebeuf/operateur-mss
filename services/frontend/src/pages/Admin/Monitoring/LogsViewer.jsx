// services/frontend/src/pages/Admin/Monitoring/LogsViewer.jsx
/**
 * Composant de visualisation des logs système
 * Affiche les logs en temps réel avec filtres
 */

import React, { useState, useEffect, useRef } from 'react';

const LogsViewer = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    service: 'all',
    level: 'all',
    search: '',
  });
  const [autoScroll, setAutoScroll] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const logsContainerRef = useRef(null);
  const eventSourceRef = useRef(null);

  const services = [
    { value: 'all', label: 'Tous les services' },
    { value: 'api', label: 'API Backend' },
    { value: 'frontend', label: 'Frontend' },
    { value: 'postfix', label: 'Postfix (SMTP)' },
    { value: 'dovecot', label: 'Dovecot (IMAP)' },
    { value: 'postgres', label: 'PostgreSQL' },
    { value: 'redis', label: 'Redis' },
    { value: 'nginx', label: 'Nginx' },
  ];

  const levels = [
    { value: 'all', label: 'Tous les niveaux' },
    { value: 'error', label: 'Erreur', color: 'red' },
    { value: 'warn', label: 'Warning', color: 'yellow' },
    { value: 'info', label: 'Info', color: 'blue' },
    { value: 'debug', label: 'Debug', color: 'gray' },
  ];

  useEffect(() => {
    loadLogs();
  }, [filters.service, filters.level]);

  useEffect(() => {
    if (autoScroll && logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const loadLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.service !== 'all') params.append('service', filters.service);
      if (filters.level !== 'all') params.append('level', filters.level);
      params.append('limit', '500');
      
      const response = await fetch(`/api/v1/admin/monitoring/logs?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) throw new Error('Erreur chargement logs');
      
      const data = await response.json();
      setLogs(data.logs || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const startStreaming = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const token = localStorage.getItem('token');
    const params = new URLSearchParams();
    if (filters.service !== 'all') params.append('service', filters.service);
    if (filters.level !== 'all') params.append('level', filters.level);
    params.append('token', token);

    const eventSource = new EventSource(`/api/v1/admin/monitoring/logs/stream?${params}`);
    
    eventSource.onmessage = (event) => {
      try {
        const log = JSON.parse(event.data);
        setLogs(prev => [...prev.slice(-999), log]);
      } catch (e) {
        console.error('Erreur parsing log:', e);
      }
    };

    eventSource.onerror = () => {
      setStreaming(false);
      eventSource.close();
    };

    eventSourceRef.current = eventSource;
    setStreaming(true);
  };

  const stopStreaming = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setStreaming(false);
  };

  const handleExport = () => {
    const content = logs.map(log => 
      `[${log.timestamp}] [${log.level?.toUpperCase()}] [${log.service}] ${log.message}`
    ).join('\n');
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    setLogs([]);
  };

  const getLevelColor = (level) => {
    const colors = {
      error: 'text-red-400',
      err: 'text-red-400',
      warn: 'text-yellow-400',
      warning: 'text-yellow-400',
      info: 'text-blue-400',
      debug: 'text-gray-500',
    };
    return colors[level?.toLowerCase()] || 'text-gray-400';
  };

  const getLevelBg = (level) => {
    const colors = {
      error: 'bg-red-900/20',
      err: 'bg-red-900/20',
      warn: 'bg-yellow-900/20',
      warning: 'bg-yellow-900/20',
    };
    return colors[level?.toLowerCase()] || '';
  };

  const filteredLogs = logs.filter(log => {
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      return (
        log.message?.toLowerCase().includes(searchLower) ||
        log.service?.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  if (loading && logs.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <span className="text-4xl mb-4 block">⚠️</span>
        <p className="text-red-700">{error}</p>
        <button
          onClick={loadLogs}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Barre d'outils */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4 items-center">
          {/* Filtre service */}
          <select
            value={filters.service}
            onChange={(e) => setFilters({ ...filters, service: e.target.value })}
            className="border rounded px-3 py-2 text-sm"
          >
            {services.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          {/* Filtre niveau */}
          <select
            value={filters.level}
            onChange={(e) => setFilters({ ...filters, level: e.target.value })}
            className="border rounded px-3 py-2 text-sm"
          >
            {levels.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>

          {/* Recherche */}
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Rechercher dans les logs..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            {streaming ? (
              <button
                onClick={stopStreaming}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 flex items-center gap-2"
              >
                <span className="animate-pulse">●</span>
                Arrêter
              </button>
            ) : (
              <button
                onClick={startStreaming}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 flex items-center gap-2"
              >
                ▶ Stream
              </button>
            )}
            
            <button
              onClick={loadLogs}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              disabled={loading}
            >
              🔄 Rafraîchir
            </button>

            <button
              onClick={handleExport}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
            >
              📥 Exporter
            </button>

            <button
              onClick={handleClear}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
            >
              🗑️ Vider
            </button>
          </div>
        </div>

        {/* Options */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded"
            />
            Auto-scroll
          </label>
          <span className="text-sm text-gray-500">
            {filteredLogs.length} logs affichés
          </span>
        </div>
      </div>

      {/* Console de logs */}
      <div
        ref={logsContainerRef}
        className="bg-gray-900 rounded-lg shadow overflow-hidden font-mono text-sm"
        style={{ height: '500px', overflowY: 'auto' }}
      >
        {filteredLogs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            Aucun log à afficher
          </div>
        ) : (
          <div className="p-2">
            {filteredLogs.map((log, index) => (
              <div
                key={index}
                className={`py-1 px-2 hover:bg-gray-800 rounded ${getLevelBg(log.level)}`}
              >
                <span className="text-gray-500">
                  {formatTimestamp(log.timestamp)}
                </span>
                {' '}
                <span className={`font-bold ${getLevelColor(log.level)}`}>
                  [{log.level?.toUpperCase()?.padEnd(5) || 'INFO '}]
                </span>
                {' '}
                <span className="text-purple-400">
                  [{log.service || 'system'}]
                </span>
                {' '}
                <span className="text-gray-300">
                  {highlightSearch(log.message, filters.search)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Helpers
const formatTimestamp = (ts) => {
  if (!ts) return '';
  const date = new Date(ts);
  return date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  });
};

const highlightSearch = (text, search) => {
  if (!search || !text) return text;
  
  const parts = text.split(new RegExp(`(${search})`, 'gi'));
  return parts.map((part, i) => 
    part.toLowerCase() === search.toLowerCase() ? (
      <mark key={i} className="bg-yellow-500 text-black px-0.5 rounded">
        {part}
      </mark>
    ) : part
  );
};

export default LogsViewer;