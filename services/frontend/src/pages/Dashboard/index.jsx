/**
 * MSSanté - Dashboard Principal
 * Page d'accueil après connexion avec statistiques du domaine
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useDomain } from '../../contexts/DomainContext';
import { getDomainStats, getRecentActivity } from '../../services/api';
import StatCard from '../../components/Admin/StatCard';
import MessagesChart from './components/MessagesChart';
import RecentActivity from './components/RecentActivity';
import QuotaProgress from './components/QuotaProgress';
import AlertsBanner from './components/AlertsBanner';
import Loader from '../../components/Common/Loader';

const Dashboard = () => {
  const { user } = useAuth();
  const { selectedDomain } = useDomain();
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadDashboardData = useCallback(async () => {
    if (!selectedDomain?.id) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const [statsData, activityData] = await Promise.all([
        getDomainStats(selectedDomain.id),
        getRecentActivity(selectedDomain.id, 10)
      ]);
      
      setStats(statsData);
      setActivity(activityData.activities || []);
      setAlerts(statsData.alerts || []);
    } catch (err) {
      console.error('Erreur chargement dashboard:', err);
      setError('Impossible de charger les données du dashboard');
    } finally {
      setLoading(false);
    }
  }, [selectedDomain?.id]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Rafraîchissement automatique toutes les 5 minutes
  useEffect(() => {
    const interval = setInterval(loadDashboardData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadDashboardData]);

  if (!selectedDomain) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center text-gray-500">
          <p className="text-lg mb-2">Aucun domaine sélectionné</p>
          <p className="text-sm">Veuillez sélectionner un domaine dans le menu</p>
        </div>
      </div>
    );
  }

  if (loading && !stats) {
    return <Loader message="Chargement du dashboard..." />;
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">{error}</p>
          <button 
            onClick={loadDashboardData}
            className="mt-2 text-red-600 hover:text-red-800 underline"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* En-tête */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Dashboard - {selectedDomain.organization_name}
          </h1>
          <p className="text-gray-500 mt-1">
            Bienvenue, {user?.first_name || user?.email}
          </p>
        </div>
        <div className="mt-4 md:mt-0 flex gap-3">
          <Link 
            to="/mailboxes/create"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            + Nouvelle BAL
          </Link>
          <button 
            onClick={loadDashboardData}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            disabled={loading}
          >
            {loading ? '⟳' : '↻'} Actualiser
          </button>
        </div>
      </div>

      {/* Alertes */}
      {alerts.length > 0 && <AlertsBanner alerts={alerts} />}

      {/* Statistiques principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="BAL actives"
          value={stats?.mailboxes_count || 0}
          icon="📬"
          trend={stats?.mailboxes_trend}
          color="blue"
          link="/mailboxes"
        />
        <StatCard
          title="Utilisateurs"
          value={stats?.users_count || 0}
          icon="👥"
          trend={stats?.users_trend}
          color="green"
          link="/users"
        />
        <StatCard
          title="Messages (30j)"
          value={stats?.messages_count || 0}
          icon="📧"
          trend={stats?.messages_trend}
          color="purple"
        />
        <StatCard
          title="Stockage utilisé"
          value={`${stats?.storage_used_gb?.toFixed(1) || 0} GB`}
          icon="💾"
          color="orange"
          subtitle={`sur ${selectedDomain.quotas?.max_storage_gb || 100} GB`}
        />
      </div>

      {/* Quotas */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Utilisation des quotas</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <QuotaProgress
            label="Boîtes aux lettres"
            current={stats?.mailboxes_count || 0}
            max={selectedDomain.quotas?.max_mailboxes || 100}
            unit="BAL"
          />
          <QuotaProgress
            label="Stockage"
            current={stats?.storage_used_gb || 0}
            max={selectedDomain.quotas?.max_storage_gb || 100}
            unit="GB"
          />
          <QuotaProgress
            label="Utilisateurs"
            current={stats?.users_count || 0}
            max={selectedDomain.quotas?.max_users || 200}
            unit="utilisateurs"
          />
        </div>
      </div>

      {/* Graphiques et activité */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MessagesChart 
          domainId={selectedDomain.id} 
          data={stats?.messages_by_day || []}
        />
        <RecentActivity 
          activities={activity}
          domainId={selectedDomain.id}
        />
      </div>

      {/* Informations du domaine */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Informations du domaine</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Domaine:</span>
            <p className="font-medium">{selectedDomain.domain_name}</p>
          </div>
          <div>
            <span className="text-gray-500">FINESS juridique:</span>
            <p className="font-medium">{selectedDomain.finess_juridique || '-'}</p>
          </div>
          <div>
            <span className="text-gray-500">Statut:</span>
            <p className="font-medium">
              <span className={`inline-flex px-2 py-1 rounded-full text-xs ${
                selectedDomain.status === 'active' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {selectedDomain.status === 'active' ? 'Actif' : selectedDomain.status}
              </span>
            </p>
          </div>
          <div>
            <span className="text-gray-500">Certificat expire le:</span>
            <p className="font-medium">
              {stats?.certificate_expiry 
                ? new Date(stats.certificate_expiry).toLocaleDateString('fr-FR')
                : '-'
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;