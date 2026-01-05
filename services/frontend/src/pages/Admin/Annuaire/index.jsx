// services/frontend/src/pages/Admin/Annuaire/index.jsx
import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';

const AnnuaireAdmin = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [syncStatus, setSyncStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSyncStatus();
  }, []);

  const loadSyncStatus = async () => {
    try {
      const response = await fetch('/api/v1/annuaire/sync/status', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setSyncStatus(data);
    } catch (error) {
      console.error('Erreur chargement statut sync:', error);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { path: '/admin/annuaire', label: 'Vue d\'ensemble', exact: true },
    { path: '/admin/annuaire/publications', label: 'Publications' },
    { path: '/admin/annuaire/synchronisation', label: 'Synchronisation' },
    { path: '/admin/annuaire/indicateurs', label: 'Indicateurs ANS' },
    { path: '/admin/annuaire/rapports', label: 'Comptes Rendus' },
  ];

  const isActive = (tab) => {
    if (tab.exact) {
      return location.pathname === tab.path;
    }
    return location.pathname.startsWith(tab.path);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Annuaire National MSSanté</h1>
          <p className="text-gray-600 mt-1">
            Gestion des publications et indicateurs ANS
          </p>
        </div>
        
        {syncStatus && (
          <div className={`px-4 py-2 rounded-lg ${
            syncStatus.status === 'success' 
              ? 'bg-green-100 text-green-800' 
              : syncStatus.status === 'error'
              ? 'bg-red-100 text-red-800'
              : 'bg-yellow-100 text-yellow-800'
          }`}>
            <span className="text-sm font-medium">
              Dernière sync: {syncStatus.last_sync 
                ? new Date(syncStatus.last_sync).toLocaleString('fr-FR')
                : 'Jamais'}
            </span>
          </div>
        )}
      </div>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <Link
              key={tab.path}
              to={tab.path}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                isActive(tab)
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>

      <Outlet context={{ syncStatus, refreshSyncStatus: loadSyncStatus }} />
    </div>
  );
};

export default AnnuaireAdmin;