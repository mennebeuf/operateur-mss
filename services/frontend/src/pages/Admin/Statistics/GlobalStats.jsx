// services/frontend/src/pages/Admin/Statistics/GlobalStats.jsx
/**
 * Statistiques globales - Administration
 */

import React, { useState, useEffect } from 'react';

import Loader from '../../../components/Common/Loader';
import { adminApi } from '../../../services/adminApi';

const GlobalStats = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30d');

  useEffect(() => {
    loadStats();
  }, [period]);

  const loadStats = async () => {
    try {
      setLoading(true);
      const response = await adminApi.getGlobalStatistics(period);
      setStats(response.data || response);
    } catch (error) {
      console.error('Erreur chargement stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, value, subtitle, icon, color = 'blue' }) => {
    const colors = {
      blue: 'bg-blue-50 text-blue-600',
      green: 'bg-green-50 text-green-600',
      purple: 'bg-purple-50 text-purple-600',
      orange: 'bg-orange-50 text-orange-600'
    };

    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-500">{title}</span>
          <span className={`p-2 rounded-lg ${colors[color]}`}>{icon}</span>
        </div>
        <p className="text-3xl font-bold text-gray-900">{value}</p>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>
    );
  };

  if (loading) {
    return <Loader message="Chargement des statistiques..." />;
  }

  return (
    <div className="p-6 space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Statistiques globales</h1>
          <p className="text-gray-500">Vue d'ensemble de l'activité MSSanté</p>
        </div>
        <div className="flex gap-2">
          {['7d', '30d', '90d', '1y'].map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg transition ${
                period === p ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              {p === '7d'
                ? '7 jours'
                : p === '30d'
                  ? '30 jours'
                  : p === '90d'
                    ? '90 jours'
                    : '1 an'}
            </button>
          ))}
        </div>
      </div>

      {/* Statistiques principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Domaines actifs"
          value={stats?.domains_count || 0}
          icon="🌐"
          color="blue"
        />
        <StatCard
          title="Boîtes aux lettres"
          value={stats?.mailboxes_count || 0}
          subtitle={`${stats?.mailboxes_active || 0} actives`}
          icon="📬"
          color="green"
        />
        <StatCard title="Utilisateurs" value={stats?.users_count || 0} icon="👥" color="purple" />
        <StatCard
          title="Messages échangés"
          value={(stats?.messages_total || 0).toLocaleString()}
          subtitle={`${((stats?.messages_sent || 0) / 1000).toFixed(1)}k envoyés`}
          icon="📧"
          color="orange"
        />
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Évolution des messages */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Évolution des messages</h2>
          <div className="h-64 flex items-center justify-center text-gray-400">
            {/* Ici viendrait un graphique Recharts */}
            <div className="text-center">
              <p className="text-4xl mb-2">📈</p>
              <p>Graphique d'évolution</p>
              <p className="text-sm">
                Envoyés: {(stats?.messages_sent || 0).toLocaleString()} | Reçus:{' '}
                {(stats?.messages_received || 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Répartition par type de BAL */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Répartition des BAL</h2>
          <div className="space-y-4">
            {[
              {
                label: 'Personnelles',
                value: stats?.mailboxes_personal || 0,
                color: 'bg-blue-500'
              },
              {
                label: 'Organisationnelles',
                value: stats?.mailboxes_organizational || 0,
                color: 'bg-green-500'
              },
              {
                label: 'Applicatives',
                value: stats?.mailboxes_application || 0,
                color: 'bg-purple-500'
              }
            ].map((item, index) => {
              const total = stats?.mailboxes_count || 1;
              const percentage = ((item.value / total) * 100).toFixed(1);
              return (
                <div key={index}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{item.label}</span>
                    <span>
                      {item.value} ({percentage}%)
                    </span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${item.color} rounded-full`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Statistiques de stockage */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Utilisation du stockage</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-3xl font-bold text-gray-900">{stats?.storage_total_gb || 0} GB</p>
            <p className="text-sm text-gray-500">Stockage total</p>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <p className="text-3xl font-bold text-blue-600">{stats?.storage_used_gb || 0} GB</p>
            <p className="text-sm text-gray-500">Utilisé</p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <p className="text-3xl font-bold text-green-600">
              {(((stats?.storage_used_gb || 0) / (stats?.storage_total_gb || 1)) * 100).toFixed(1)}%
            </p>
            <p className="text-sm text-gray-500">Taux d'utilisation</p>
          </div>
        </div>
      </div>

      {/* Top domaines */}
      {stats?.top_domains && stats.top_domains.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Top domaines par activité</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">#</th>
                  <th className="px-4 py-2 text-left">Domaine</th>
                  <th className="px-4 py-2 text-right">BAL</th>
                  <th className="px-4 py-2 text-right">Messages</th>
                  <th className="px-4 py-2 text-right">Stockage</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {stats.top_domains.map((domain, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium">{index + 1}</td>
                    <td className="px-4 py-2">{domain.name}</td>
                    <td className="px-4 py-2 text-right">{domain.mailboxes}</td>
                    <td className="px-4 py-2 text-right">{domain.messages?.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right">{domain.storage_gb} GB</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Performance */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Performance du service</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{stats?.uptime || 99.9}%</p>
            <p className="text-sm text-gray-500">Disponibilité</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">{stats?.avg_delivery_time || '< 5s'}</p>
            <p className="text-sm text-gray-500">Temps moyen de livraison</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{stats?.delivery_rate || 99.5}%</p>
            <p className="text-sm text-gray-500">Taux de délivrabilité</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-orange-600">{stats?.bounce_rate || 0.5}%</p>
            <p className="text-sm text-gray-500">Taux de rebond</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GlobalStats;
