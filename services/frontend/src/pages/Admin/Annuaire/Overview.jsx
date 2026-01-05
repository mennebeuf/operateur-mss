// services/frontend/src/pages/Admin/Annuaire/Overview.jsx
import React, { useState, useEffect } from 'react';
import { Link, useOutletContext } from 'react-router-dom';

const AnnuaireOverview = () => {
  const { syncStatus } = useOutletContext();
  const [stats, setStats] = useState(null);
  const [recentPublications, setRecentPublications] = useState([]);
  const [pendingIndicators, setPendingIndicators] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOverviewData();
  }, []);

  const loadOverviewData = async () => {
    try {
      const [statsRes, pubsRes, indicRes] = await Promise.all([
        fetch('/api/v1/annuaire/statistics', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }),
        fetch('/api/v1/annuaire/publications?limit=5', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }),
        fetch('/api/v1/annuaire/indicators?period=month', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        })
      ]);

      const [statsData, pubsData, indicData] = await Promise.all([
        statsRes.json(),
        pubsRes.json(),
        indicRes.json()
      ]);

      setStats(statsData);
      setRecentPublications(pubsData.publications || []);
      setPendingIndicators(indicData);
    } catch (error) {
      console.error('Erreur chargement données:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cartes statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="BAL Publiées"
          value={stats?.published_count || 0}
          icon="📋"
          color="blue"
          trend={stats?.published_trend}
        />
        <StatCard
          title="En attente"
          value={stats?.pending_count || 0}
          icon="⏳"
          color="yellow"
        />
        <StatCard
          title="Erreurs"
          value={stats?.error_count || 0}
          icon="⚠️"
          color="red"
          link="/admin/annuaire/publications?status=error"
        />
        <StatCard
          title="Sync réussies"
          value={`${stats?.sync_success_rate || 0}%`}
          icon="✅"
          color="green"
        />
      </div>

      {/* Alertes */}
      {stats?.error_count > 0 && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded">
          <div className="flex items-center">
            <span className="text-red-400 text-xl mr-3">⚠️</span>
            <div>
              <h3 className="text-red-800 font-medium">
                {stats.error_count} publication(s) en erreur
              </h3>
              <p className="text-red-700 text-sm mt-1">
                Des BAL n'ont pas pu être publiées dans l'annuaire.
                <Link to="/admin/annuaire/publications?status=error" className="underline ml-1">
                  Voir les détails
                </Link>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Indicateurs en attente */}
      {pendingIndicators && !pendingIndicators.submitted_at && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <span className="text-yellow-400 text-xl mr-3">📊</span>
              <div>
                <h3 className="text-yellow-800 font-medium">
                  Indicateurs mensuels à soumettre
                </h3>
                <p className="text-yellow-700 text-sm mt-1">
                  Les indicateurs de {pendingIndicators.period} doivent être soumis avant le 10 du mois.
                </p>
              </div>
            </div>
            <Link
              to="/admin/annuaire/indicateurs"
              className="bg-yellow-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-yellow-700"
            >
              Soumettre
            </Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Publications récentes */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Publications récentes</h2>
            <Link to="/admin/annuaire/publications" className="text-blue-600 text-sm hover:underline">
              Voir tout
            </Link>
          </div>

          {recentPublications.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Aucune publication récente</p>
          ) : (
            <div className="space-y-3">
              {recentPublications.map((pub) => (
                <div key={pub.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{pub.email}</p>
                    <p className="text-sm text-gray-500">
                      {pub.operation} • {new Date(pub.attempted_at).toLocaleString('fr-FR')}
                    </p>
                  </div>
                  <StatusBadge status={pub.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Statut synchronisation */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Synchronisation</h2>
            <Link to="/admin/annuaire/synchronisation" className="text-blue-600 text-sm hover:underline">
              Gérer
            </Link>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Dernière synchronisation</span>
              <span className="font-medium">
                {syncStatus?.last_sync 
                  ? new Date(syncStatus.last_sync).toLocaleString('fr-FR')
                  : 'Jamais'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Statut</span>
              <StatusBadge status={syncStatus?.status || 'unknown'} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Prochaine sync planifiée</span>
              <span className="font-medium">
                {syncStatus?.next_sync 
                  ? new Date(syncStatus.next_sync).toLocaleString('fr-FR')
                  : '02:00'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">BAL synchronisées</span>
              <span className="font-medium">{syncStatus?.synced_count || 0}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon, color, trend, link }) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    red: 'bg-red-50 text-red-600',
  };

  const content = (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold">{value}</p>
          {trend !== undefined && (
            <p className={`text-sm mt-2 ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {trend >= 0 ? '↗' : '↘'} {Math.abs(trend)}% ce mois
            </p>
          )}
        </div>
        <div className={`text-4xl ${colorClasses[color]} p-4 rounded-lg`}>
          {icon}
        </div>
      </div>
    </div>
  );

  return link ? <Link to={link}>{content}</Link> : content;
};

const StatusBadge = ({ status }) => {
  const statusConfig = {
    success: { bg: 'bg-green-100', text: 'text-green-800', label: 'Succès' },
    pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'En attente' },
    error: { bg: 'bg-red-100', text: 'text-red-800', label: 'Erreur' },
    retry: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Retry' },
    unknown: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Inconnu' },
  };

  const config = statusConfig[status] || statusConfig.unknown;

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
};

export default AnnuaireOverview;