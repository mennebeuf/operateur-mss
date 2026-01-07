// services/frontend/src/pages/Admin/Dashboard/index.jsx
/**
 * Dashboard Administration
 * Vue d'ensemble pour les administrateurs
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

import Loader from '../../../components/Common/Loader';
import { useAuth } from '../../../contexts/AuthContext';
import { adminApi } from '../../../services/adminApi';

const StatCard = ({ title, value, icon, color = 'blue', trend, link }) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
    red: 'bg-red-50 text-red-600'
  };

  const content = (
    <div className="bg-white rounded-lg shadow p-6 hover:shadow-md transition">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
          {trend !== undefined && (
            <p className={`text-sm mt-1 ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}% ce mois
            </p>
          )}
        </div>
        <div className={`p-4 rounded-full ${colorClasses[color]}`}>
          <span className="text-2xl">{icon}</span>
        </div>
      </div>
    </div>
  );

  return link ? <Link to={link}>{content}</Link> : content;
};

const AdminDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isSuperAdmin = user?.is_super_admin || user?.role === 'super_admin';

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [statsData, alertsData, activityData] = await Promise.all([
        adminApi.getDashboardStats(),
        adminApi.getAlerts(),
        adminApi.getRecentActivity(10)
      ]);
      setStats(statsData.data || statsData);
      setAlerts(alertsData.data || alertsData || []);
      setRecentActivity(activityData.data || activityData || []);
    } catch (err) {
      console.error('Erreur chargement dashboard admin:', err);
      setError('Impossible de charger les données');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <Loader message="Chargement du dashboard..." />;
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
          <button onClick={loadDashboardData} className="ml-4 underline">
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Administration {isSuperAdmin ? 'Globale' : 'du Domaine'}
          </h1>
          <p className="text-gray-500">Bienvenue, {user?.first_name || user?.email}</p>
        </div>
        <button
          onClick={loadDashboardData}
          className="px-4 py-2 text-sm bg-white border rounded-lg hover:bg-gray-50"
        >
          🔄 Actualiser
        </button>
      </div>

      {/* Alertes */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, index) => (
            <div
              key={index}
              className={`p-4 rounded-lg border ${
                alert.type === 'error'
                  ? 'bg-red-50 border-red-200 text-red-700'
                  : alert.type === 'warning'
                    ? 'bg-yellow-50 border-yellow-200 text-yellow-700'
                    : 'bg-blue-50 border-blue-200 text-blue-700'
              }`}
            >
              <span className="font-medium">{alert.title}:</span> {alert.message}
            </div>
          ))}
        </div>
      )}

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {isSuperAdmin && (
          <StatCard
            title="Domaines"
            value={stats?.domains_count || 0}
            icon="🌐"
            color="blue"
            link="/admin/domains"
          />
        )}
        <StatCard
          title="Utilisateurs"
          value={stats?.users_count || 0}
          icon="👥"
          color="purple"
          trend={stats?.users_trend}
          link="/admin/users"
        />
        <StatCard
          title="Boîtes aux lettres"
          value={stats?.mailboxes_count || 0}
          icon="📬"
          color="green"
          trend={stats?.mailboxes_trend}
        />
        <StatCard
          title="Messages (30j)"
          value={stats?.messages_count || 0}
          icon="📧"
          color="orange"
          trend={stats?.messages_trend}
        />
        <StatCard
          title="Certificats"
          value={stats?.certificates_count || 0}
          icon="🔐"
          color="blue"
          link="/admin/certificates"
        />
      </div>

      {/* Contenu principal */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activité récente */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Activité récente</h2>
          {recentActivity.length > 0 ? (
            <div className="space-y-3">
              {recentActivity.map((activity, index) => (
                <div key={index} className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg">
                  <span className="text-xl">
                    {activity.type === 'user_created'
                      ? '👤'
                      : activity.type === 'mailbox_created'
                        ? '📬'
                        : activity.type === 'certificate_renewed'
                          ? '🔐'
                          : '📌'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900">{activity.description}</p>
                    <p className="text-xs text-gray-500">{activity.created_at}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">Aucune activité récente</p>
          )}
          <Link
            to="/admin/audit"
            className="block text-center text-sm text-blue-600 hover:underline mt-4"
          >
            Voir tous les logs →
          </Link>
        </div>

        {/* Accès rapides */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Accès rapides</h2>
          <div className="grid grid-cols-2 gap-4">
            <Link
              to="/admin/users/new"
              className="p-4 border rounded-lg hover:bg-gray-50 transition text-center"
            >
              <span className="text-2xl block mb-2">➕</span>
              <span className="text-sm">Nouvel utilisateur</span>
            </Link>
            {isSuperAdmin && (
              <Link
                to="/admin/domains/new"
                className="p-4 border rounded-lg hover:bg-gray-50 transition text-center"
              >
                <span className="text-2xl block mb-2">🌐</span>
                <span className="text-sm">Nouveau domaine</span>
              </Link>
            )}
            <Link
              to="/admin/certificates"
              className="p-4 border rounded-lg hover:bg-gray-50 transition text-center"
            >
              <span className="text-2xl block mb-2">🔐</span>
              <span className="text-sm">Certificats</span>
            </Link>
            <Link
              to="/admin/statistics"
              className="p-4 border rounded-lg hover:bg-gray-50 transition text-center"
            >
              <span className="text-2xl block mb-2">📊</span>
              <span className="text-sm">Statistiques</span>
            </Link>
            <Link
              to="/admin/annuaire"
              className="p-4 border rounded-lg hover:bg-gray-50 transition text-center"
            >
              <span className="text-2xl block mb-2">📋</span>
              <span className="text-sm">Annuaire ANS</span>
            </Link>
            <Link
              to="/admin/monitoring"
              className="p-4 border rounded-lg hover:bg-gray-50 transition text-center"
            >
              <span className="text-2xl block mb-2">💻</span>
              <span className="text-sm">Monitoring</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
